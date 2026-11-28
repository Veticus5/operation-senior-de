#!/usr/bin/env node
/**
 * Generuje PDF rozdziałów Knowledge Base: npm run kb:pdf [id-rozdziału ...]
 *
 * Jedno źródło treści: skrypt ładuje przez Vite te same obiekty rozdziałów i ten sam komponent treści,
 * z których korzysta strona (src/knowledge-base/print.tsx), składa samodzielny dokument HTML i drukuje go
 * do PDF w Chromium bez interfejsu. Bez nowych zależności: Vite i React już są, przeglądarka jest z systemu.
 *
 * Wynik: apps/web/public/kb/<id>.pdf oraz wpis w src/knowledge-base/pdf-manifest.json (skrót treści,
 * liczba stron, rozmiar). Test porównuje skrót z bieżącą treścią, więc po zmianie rozdziału trzeba
 * uruchomić skrypt ponownie.
 *
 * Wymagania: Chrome albo Chromium (ścieżkę można podać w CHROME_BIN) i dostęp do fonts.googleapis.com,
 * skąd skrypt pobiera te same czcionki, których używa strona, i osadza je w dokumencie.
 */
import { execFile } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { promisify } from 'node:util';
import { createServer } from 'vite';

const run = promisify(execFile);
const web = fileURLToPath(new URL('..', import.meta.url));
const kb = join(web, 'src', 'knowledge-base');
const FONTS = 'https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,600&family=Figtree:ital,wght@0,400;0,500;0,600;1,400&family=JetBrains+Mono:wght@400;500&display=block';
// Bez nagłówka przeglądarki Google Fonts zwraca stare formaty zamiast woff2 z podziałem na zakresy znaków.
const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';

async function findChrome() {
  if (process.env.CHROME_BIN) return process.env.CHROME_BIN;
  for (const name of ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser']) {
    try {
      return (await run('which', [name])).stdout.trim();
    } catch {
      /* szukamy dalej */
    }
  }
  const fixed = ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Chromium.app/Contents/MacOS/Chromium'];
  // Przeglądarki pobrane przez Playwright, jeśli ktoś ma je już na dysku.
  const cache = join(homedir(), '.cache', 'ms-playwright');
  if (existsSync(cache)) {
    for (const dir of readdirSync(cache).filter(d => /^chromium-\d+$/.test(d)).sort().reverse()) {
      for (const sub of readdirSync(join(cache, dir))) fixed.push(join(cache, dir, sub, 'chrome'));
    }
  }
  const found = fixed.find(existsSync);
  if (found) return found;
  throw new Error('Nie znalazłem Chrome ani Chromium. Zainstaluj przeglądarkę albo podaj ścieżkę w zmiennej CHROME_BIN.');
}

/** Reguły @font-face z plikami woff2 osadzonymi jako data URI. Tylko zakresy łacińskie: wystarczą dla polskiego. */
async function embeddedFonts() {
  const response = await fetch(FONTS, { headers: { 'User-Agent': UA } });
  if (!response.ok) throw new Error(`Google Fonts odpowiedziało ${response.status}. PDF bez czcionek platformy nie powstanie.`);
  const css = await response.text();
  const faces = [...css.matchAll(/\/\* ([a-z-]+) \*\/\s*(@font-face\s*{[^}]+})/g)].filter(m => m[1] === 'latin' || m[1] === 'latin-ext').map(m => m[2]);
  if (!faces.length) throw new Error('Nie rozpoznałem odpowiedzi Google Fonts (brak zakresów latin).');
  const files = new Map();
  for (const face of faces) {
    const url = face.match(/url\((https:[^)]+)\)/)?.[1];
    if (!url) throw new Error('Reguła @font-face bez adresu pliku.');
    if (!files.has(url)) {
      const font = await fetch(url);
      if (!font.ok) throw new Error(`Nie pobrałem czcionki ${url} (${font.status}).`);
      files.set(url, `data:font/woff2;base64,${Buffer.from(await font.arrayBuffer()).toString('base64')}`);
    }
  }
  return faces.map(face => face.replace(/url\((https:[^)]+)\)/, (_, url) => `url(${files.get(url)})`)).join('\n');
}

const pageCount = pdf => (pdf.toString('latin1').match(/\/Type\s*\/Page(?![a-zA-Z])/g) ?? []).length;

const vite = await createServer({ root: web, configFile: join(web, 'vite.config.ts'), server: { middlewareMode: true }, appType: 'custom', logLevel: 'warn' });
const work = await mkdtemp(join(tmpdir(), 'kb-pdf-'));
try {
  const { chapters, renderPrintDocument, contentHash, pdfPath } = await vite.ssrLoadModule('/src/knowledge-base/print.tsx');
  const wanted = process.argv.slice(2);
  const unknown = wanted.filter(id => !chapters.some(c => c.id === id));
  if (unknown.length) throw new Error(`Nie ma rozdziału: ${unknown.join(', ')}. Dostępne: ${chapters.map(c => c.id).join(', ')}.`);
  const selected = wanted.length ? chapters.filter(c => wanted.includes(c.id)) : chapters;

  const chrome = await findChrome();
  const css = `${await readFile(join(kb, 'kb-content.css'), 'utf8')}\n${await readFile(join(kb, 'print.css'), 'utf8')}`;
  const fontCss = await embeddedFonts();
  const manifestPath = join(kb, 'pdf-manifest.json');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));

  for (const chapter of selected) {
    const html = join(work, `${chapter.id}.html`);
    const out = join(web, 'public', pdfPath(chapter.id));
    await mkdir(join(out, '..'), { recursive: true });
    await writeFile(html, renderPrintDocument([chapter], { css, fontCss }));
    await run(chrome, [
      '--headless=new',
      '--disable-gpu',
      '--no-pdf-header-footer',
      '--generate-pdf-document-outline',
      '--virtual-time-budget=10000',
      `--user-data-dir=${join(work, 'profile')}`,
      ...(process.env.CHROME_ARGS ? process.env.CHROME_ARGS.split(' ') : []),
      `--print-to-pdf=${out}`,
      pathToFileURL(html).href
    ]);
    const pdf = await readFile(out);
    const pages = pageCount(pdf);
    if (!pdf.subarray(0, 5).equals(Buffer.from('%PDF-')) || pages === 0) throw new Error(`Chromium nie zapisał poprawnego PDF: ${out}`);
    manifest[chapter.id] = { contentHash: contentHash(chapter), pages, bytes: (await stat(out)).size };
    console.log(`${pdfPath(chapter.id)}: ${pages} stron, ${Math.round(pdf.length / 1024)} kB`);
  }
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
} finally {
  await vite.close();
  await rm(work, { recursive: true, force: true });
}

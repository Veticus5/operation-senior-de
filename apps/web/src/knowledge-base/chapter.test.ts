import { describe, expect, it } from 'vitest';
import { lessons } from '@content/index';
import { glossary } from '@content/glossary';
import { chapters, chapterById, type KbBlock, type KbFigure } from '@content/knowledge-base/index';
import facts from '../../../../docs/verified-facts.md?raw';
import { parseRich, termIds } from '../lib/richText';
import { END, cellCounts, chapterRich, contentHash, outline, pdfPath, readingMinutes, scannedParts } from './outline';
import { renderPrintDocument } from './print';
import manifest from './pdf-manifest.json';

const pdfFiles = Object.keys(import.meta.glob('../../public/kb/*.pdf', { query: '?url' }));
const pdfs: Record<string, { contentHash: string; pages: number; bytes: number } | undefined> = manifest;
const blocks = (id: string): KbBlock[] => chapterById(id)!.sections.flatMap(s => s.blocks);
const figures = (id: string): KbFigure[] => blocks(id).flatMap(b => (b.type === 'figure' ? [b.figure] : []));
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
/** Najdłuższa linia kodu, która mieści się bez zawijania na stronie PDF i na ekranie 390 px. */
const CODE_WIDTH = 44;

describe('Knowledge Base: rejestr rozdziałów', () => {
  it('ma unikalne identyfikatory, które nadają się na adres i nazwę pliku', () => {
    const ids = chapters.map(c => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(SLUG);
  });
  it('nie zmienił identyfikatorów, bo są częścią adresów i nazw plików PDF', () => {
    expect(chapters.map(c => c.id)).toEqual(['database-architecture']);
    expect(chapterById('database-architecture')!.sections.map(s => s.id)).toEqual([
      'oltp-olap', 'wiersze-kolumny', 'projekt-logiczny-fizyczny', 'normalizacja', 'denormalizacja', 'klucze', 'indeksy',
      'pruning', 'plan-wykonania', 'transakcje', 'warehouse-lake-lakehouse', 'etl-elt', 'storage-compute', 'dobor-architektury'
    ]);
  });
});

describe.each(chapters)('Knowledge Base: rozdział $id', chapter => {
  it('ma komplet części: wstęp, treść, podsumowanie, słownik, błędne przekonania i źródła', () => {
    expect(chapter.lead.length).toBeGreaterThan(0);
    expect(chapter.sections.length).toBeGreaterThan(0);
    expect(chapter.keyPoints.length).toBeGreaterThanOrEqual(5);
    expect(chapter.glossary.length).toBeGreaterThanOrEqual(10);
    expect(chapter.misconceptions.length).toBeGreaterThanOrEqual(5);
    expect(chapter.sources.length).toBeGreaterThan(0);
    expect(chapter.checked).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(readingMinutes(chapter)).toBeGreaterThan(0);
    for (const section of chapter.sections) expect(section.blocks.length, section.id).toBeGreaterThan(0);
  });
  it('wskazuje na istniejącą lekcję, jeśli ją podaje', () => {
    if (chapter.lessonId) expect(lessons.some(l => l.id === chapter.lessonId)).toBe(true);
  });
  it('ma unikalne identyfikatory części, różne od sekcji zamykających', () => {
    const ids = outline(chapter).map(e => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(SLUG);
    expect(outline(chapter).slice(-4).map(e => e.id)).toEqual([END.keyPoints.id, END.glossary.id, END.misconceptions.id, END.sources.id]);
  });
  it('każdy fragment HTML się parsuje, a użyte hasła słownika platformy istnieją', () => {
    for (const html of chapterRich(chapter)) {
      expect(() => parseRich(html), html.slice(0, 60)).not.toThrow();
      for (const id of termIds(html)) expect(glossary[id], id).toBeDefined();
    }
  });
  it('tabele mają tyle komórek w wierszu, ile kolumn', () => {
    for (const block of chapter.sections.flatMap(s => s.blocks)) {
      if (block.type === 'table') for (const row of block.rows) expect(row.length, block.columns.join('|')).toBe(block.columns.length);
      if (block.type === 'tables') {
        for (const t of block.tables) {
          for (const key of t.key) expect(t.columns, t.name).toContain(key);
          for (const row of t.rows) expect(row.length, t.name).toBe(t.columns.length);
        }
      }
    }
  });
  it(`kod SQL i YAML mieści się w ${CODE_WIDTH} znakach na linię`, () => {
    for (const block of chapter.sections.flatMap(s => s.blocks)) {
      if (block.type !== 'code' || block.lang === 'plan') continue;
      for (const line of block.code.split('\n')) expect(line.length, line).toBeLessThanOrEqual(CODE_WIDTH);
    }
  });
  it('ilustracje mają spójne dane', () => {
    for (const block of chapter.sections.flatMap(s => s.blocks)) {
      if (block.type !== 'figure') continue;
      const f = block.figure;
      expect(block.caption, 'ilustracja jest podpisana jako ilustracja').toMatch(/^Ilustracja\./);
      if (f.kind === 'cells') {
        for (const row of f.rows) expect(row.length).toBe(f.columns.length);
        for (const c of f.need) expect(c).toBeLessThan(f.columns.length);
      }
      if (f.kind === 'path') for (const step of f.steps) expect(step.options[step.pick], step.name).toBeDefined();
      if (f.kind === 'partitions') {
        for (const layout of f.layouts) for (const [min, max] of layout.parts) expect(min >= 1 && min <= max && max <= f.units.length, layout.label).toBe(true);
      }
    }
  });
  it('słownik rozdziału jest alfabetyczny i bez powtórzeń', () => {
    const terms = chapter.glossary.map(g => g.term);
    expect(new Set(terms).size).toBe(terms.length);
    expect(terms).toEqual([...terms].sort((a, b) => a.localeCompare(b, 'pl')));
  });
  it('każde źródło jest spisane w docs/verified-facts.md', () => {
    const urls = chapter.sources.map(s => s.url);
    expect(new Set(urls).size).toBe(urls.length);
    for (const url of urls) {
      expect(url).toMatch(/^https:\/\//);
      expect(facts.includes(url), url).toBe(true);
    }
  });
  it('ma aktualny PDF: plik istnieje, a skrót treści w manifeście zgadza się z bieżącą treścią', () => {
    // Nie zgadza się? Treść zmieniła się po wygenerowaniu PDF. Uruchom: npm run kb:pdf
    expect(pdfFiles.some(f => f.endsWith(`/public/${pdfPath(chapter.id)}`)), pdfPath(chapter.id)).toBe(true);
    expect(pdfs[chapter.id]?.contentHash, 'uruchom npm run kb:pdf').toBe(contentHash(chapter));
    expect(pdfs[chapter.id]!.pages).toBeGreaterThan(1);
  });
  it('dokument do PDF zawiera każdą część dokładnie raz i każdy link ze spisu treści ma cel', () => {
    const html = renderPrintDocument([chapter], { css: '', fontCss: '' });
    for (const entry of outline(chapter)) {
      expect(html.split(`id="${entry.id}"`).length - 1, entry.id).toBe(1);
      expect(html.includes(`href="#${entry.id}"`), entry.id).toBe(true);
    }
    expect(html).toContain('<html lang="pl">');
  });
});

describe('Knowledge Base: skrót treści i podręcznik z wielu rozdziałów', () => {
  it('skrót zmienia się razem z treścią', () => {
    const chapter = chapters[0];
    expect(contentHash(chapter)).toBe(contentHash({ ...chapter }));
    expect(contentHash({ ...chapter, subtitle: `${chapter.subtitle}.` })).not.toBe(contentHash(chapter));
    expect(contentHash({ ...chapter, lead: [...chapter.lead].reverse() })).not.toBe(contentHash(chapter));
  });
  it('kilka rozdziałów w jednym dokumencie nie daje powtórzonych kotwic', () => {
    const second = { ...chapters[0], id: 'drugi-rozdzial' };
    const html = renderPrintDocument([chapters[0], second], { css: '', fontCss: '', title: 'Podręcznik' });
    const ids = [...html.matchAll(/ id="([^"]+)"/g)].map(m => m[1]);
    expect(ids.length).toBe(2 * outline(chapters[0]).length);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(html.includes(`href="#${id}"`), id).toBe(true);
  });
});

describe('Knowledge Base: liczby w tekście rozdziału Database & Data Architecture wynikają z danych ilustracji', () => {
  const id = 'database-architecture';
  it('zapis wierszowy czyta 30 wartości, żeby użyć 12, a kolumnowy czyta 12', () => {
    const f = figures(id).find(x => x.kind === 'cells')!;
    if (f.kind !== 'cells') throw new Error('brak ilustracji zapisu');
    expect(cellCounts(f.rows.length, f.columns.length, f.need, 'row')).toEqual({ read: 30, needed: 12, total: 30 });
    expect(cellCounts(f.rows.length, f.columns.length, f.need, 'column')).toEqual({ read: 12, needed: 12, total: 30 });
  });
  it('filtr po marcu czyta 1 z 8 mikropartycji przy danych ułożonych po dacie i 7 z 8 przy wymieszanych', () => {
    const f = figures(id).find(x => x.kind === 'partitions')!;
    if (f.kind !== 'partitions') throw new Error('brak ilustracji mikropartycji');
    expect(f.layouts.map(l => scannedParts(l.parts, f.filter.range).filter(Boolean).length)).toEqual([1, 7]);
    expect(f.layouts.every(l => l.parts.length === 8)).toBe(true);
  });
  it('droga przez indeks ma trzy poziomy drzewa i jedną stronę tabeli', () => {
    const f = figures(id).find(x => x.kind === 'path')!;
    if (f.kind !== 'path') throw new Error('brak ilustracji indeksu');
    expect(f.steps.length).toBe(4);
    expect(f.total).toContain('4 zamiast 10 000');
  });
  it('tabela denormalizacji i tabela izolacji zgadzają się z tekstem', () => {
    const tables = blocks(id).flatMap(b => (b.type === 'table' ? [b] : []));
    expect(tables.find(t => t.columns[1] === 'Znormalizowany (3NF)')!.rows.map(r => r.slice(1))).toEqual([['2', '0'], ['2', '4'], ['1', '3']]);
    expect(tables.find(t => t.columns[0] === 'Poziom izolacji')!.rows).toEqual([
      ['Read uncommitted', 'możliwy', 'możliwy', 'możliwy'],
      ['Read committed', 'wykluczony', 'możliwy', 'możliwy'],
      ['Repeatable read', 'wykluczony', 'wykluczony', 'możliwy'],
      ['Serializable', 'wykluczony', 'wykluczony', 'wykluczony']
    ]);
  });
});

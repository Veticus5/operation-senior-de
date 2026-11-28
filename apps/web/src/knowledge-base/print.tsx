import { renderToStaticMarkup } from 'react-dom/server';
import { AREA_LABEL } from '@content/index';
import { chapters as allChapters, type KbChapter } from '@content/knowledge-base/index';
import { ChapterBody } from './ChapterBody';
import { contentHash, outline, pdfPath } from './outline';

/**
 * Dokument do PDF. Powstaje z tych samych obiektów rozdziałów i tego samego komponentu ChapterBody co strona,
 * ale jest osobnym, samodzielnym dokumentem HTML: okładka, spis treści, treść, własne style strony (print.css).
 * Skrypt scripts/kb-pdf.mjs ładuje ten moduł przez Vite, a wynik drukuje do PDF w Chromium bez interfejsu.
 *
 * Funkcja przyjmuje listę rozdziałów. Jeden rozdział daje jego PDF, kilka dałoby jeden podręcznik:
 * przy więcej niż jednym rozdziale kotwice dostają przedrostek z id rozdziału, więc się nie powtarzają.
 */

export { contentHash, pdfPath };
export const chapters = allChapters;

const number = (chapter: KbChapter) => String(allChapters.indexOf(chapter) + 1).padStart(2, '0');

function Cover({ chapter }: { chapter: KbChapter }) {
  return (
    <header className="cover">
      <p className="cover-brand">
        <b>operation</b>-senior-de
      </p>
      <div className="cover-main">
        <p className="cover-k">Knowledge Base · Rozdział {number(chapter)}</p>
        <h1>{chapter.title}</h1>
        <p className="cover-sub">{chapter.subtitle}</p>
      </div>
      <p className="cover-meta">
        {AREA_LABEL[chapter.area]} · {chapter.sections.length} części
        <br />
        fakty sprawdzone {chapter.checked}
      </p>
    </header>
  );
}

function Contents({ chapter, anchor }: { chapter: KbChapter; anchor: (id: string) => string }) {
  return (
    <nav className="toc">
      <h2>Spis treści</h2>
      <ol>
        {outline(chapter).map(entry => (
          <li key={entry.id}>
            <a href={`#${anchor(entry.id)}`}>
              <i>{entry.n ? String(entry.n).padStart(2, '0') : ''}</i>
              {entry.title}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}

function PrintDocument({ chapters }: { chapters: KbChapter[] }) {
  return (
    <>
      {chapters.map(chapter => {
        const anchor = (id: string) => (chapters.length > 1 ? `${chapter.id}--${id}` : id);
        return (
          <article key={chapter.id} className="doc">
            <Cover chapter={chapter} />
            <Contents chapter={chapter} anchor={anchor} />
            <ChapterBody chapter={chapter} anchor={anchor} />
          </article>
        );
      })}
    </>
  );
}

const escapeHtml = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

/**
 * Kompletny dokument HTML gotowy do druku. `css` to kb-content.css i print.css, `fontCss` to reguły @font-face
 * z osadzonymi plikami czcionek. Oba dostarcza skrypt, żeby ten moduł nie czytał plików ani sieci.
 */
export function renderPrintDocument(chapters: KbChapter[], options: { css: string; fontCss: string; title?: string }): string {
  const title = options.title ?? `${chapters[0].title} · Knowledge Base`;
  // Tytuł w żywej paginie. Trafia do CSS jako napis, więc cudzysłów i ukośnik trzeba zabezpieczyć.
  const running = `@page{@top-left{content:"${title.replace(/["\\]/g, '\\$&')}"}}`;
  const body = renderToStaticMarkup(<PrintDocument chapters={chapters} />);
  return `<!DOCTYPE html>
<html lang="pl">
<head>
<meta charset="utf-8">
<title>${escapeHtml(title)}</title>
<meta name="author" content="operation-senior-de">
<style>${options.fontCss}</style>
<style>${options.css}</style>
<style>${running}</style>
</head>
<body>${body}</body>
</html>`;
}

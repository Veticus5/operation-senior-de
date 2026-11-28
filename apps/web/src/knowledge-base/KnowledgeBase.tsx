import { useEffect, useState } from 'react';
import { AREA_LABEL, lessons } from '@content/index';
import { chapters, type KbChapter } from '@content/knowledge-base/index';
import { href } from '../lib/router';
import { ChapterBody } from './ChapterBody';
import { outline, pdfPath, readingMinutes } from './outline';
import manifest from './pdf-manifest.json';
import './kb-content.css';
import './kb.css';

const pdfs: Record<string, { contentHash: string; pages: number; bytes: number } | undefined> = manifest;
const number = (chapter: KbChapter) => String(chapters.indexOf(chapter) + 1).padStart(2, '0');
const jump = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'instant' });
const megabytes = (bytes: number) => (bytes / 1024 / 1024).toFixed(1).replace('.', ',');

/** Lista rozdziałów. */
export function KbHome() {
  return (
    <main className="page">
      <div className="home">
        <p className="eyebrow">Knowledge Base</p>
        <h1>Podręcznik</h1>
        <p className="lede">Do czytania i powtórek. Każdy rozdział tłumaczy temat od podstaw, bez quizów i symulatorów, i da się go pobrać jako PDF.</p>
        <div style={{ marginTop: 48 }}>
          {chapters.map(c => (
            <a key={c.id} className="lesson-row" href={href('kb', c.id)}>
              <h3>{c.title}</h3>
              <span className="m">
                Rozdział {number(c)} · {AREA_LABEL[c.area]}
                <br />
                {c.sections.length} części · ok. {readingMinutes(c)} min czytania
              </span>
              <p>{c.subtitle}</p>
            </a>
          ))}
        </div>
      </div>
    </main>
  );
}

/**
 * Rozdział: nagłówek, spis treści i treść. Adres części to #/kb/<rozdział>/<część>, więc da się go podlinkować,
 * a przycisk wstecz wraca do poprzednio czytanej części.
 */
export function Chapter({ chapter, sectionId }: { chapter: KbChapter; sectionId?: string }) {
  const toc = outline(chapter);
  const [tocOpen, setTocOpen] = useState(false);
  const [active, setActive] = useState(sectionId ?? toc[0].id);
  const pdf = pdfs[chapter.id];
  const lesson = lessons.find(l => l.id === chapter.lessonId);

  // Skok bez animacji: strona ma włączone płynne przewijanie, a rozdział jest zbyt długi, żeby przewijać go płynnie.
  useEffect(() => {
    if (sectionId) jump(sectionId);
    else window.scrollTo({ top: 0, behavior: 'instant' });
  }, [chapter.id, sectionId]);

  // Podświetla w spisie część, która jest właśnie przy górnej krawędzi okna.
  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        const visible = entries.filter(e => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (visible) setActive(visible.target.id);
      },
      // Pas zaczyna się poniżej miejsca, w które trafia początek części po skoku (scroll-margin-top w kb.css).
      { rootMargin: '-125px 0px -60% 0px' }
    );
    for (const entry of outline(chapter)) {
      const el = document.getElementById(entry.id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, [chapter]);

  return (
    <main className="page kb">
      <header className="kb-head">
        <p className="eyebrow">
          <a href={href('kb')}>Knowledge Base</a> · Rozdział {number(chapter)}
        </p>
        <h1>{chapter.title}</h1>
        <p className="lede">{chapter.subtitle}</p>
        <p className="kb-meta">
          {AREA_LABEL[chapter.area]} · {chapter.sections.length} części · ok. {readingMinutes(chapter)} min czytania · fakty sprawdzone {chapter.checked}
        </p>
        <p className="kb-actions">
          {pdf && (
            <a className="btn solid" href={pdfPath(chapter.id)} download={`${chapter.id}.pdf`}>
              Pobierz PDF
              <small>
                {pdf.pages} stron · {megabytes(pdf.bytes)} MB
              </small>
            </a>
          )}
          {lesson && (
            <a className="btn" href={href('academy', lesson.id)}>
              Lekcja w Academy
            </a>
          )}
        </p>
      </header>
      <div className="kb-layout">
        <nav className={tocOpen ? 'kb-toc open' : 'kb-toc'} aria-label="Spis treści rozdziału">
          <button type="button" className="kb-toc-toggle" aria-expanded={tocOpen} onClick={() => setTocOpen(open => !open)}>
            Spis treści
            <span aria-hidden="true">{tocOpen ? '−' : '+'}</span>
          </button>
          <p className="kb-toc-h">Spis treści</p>
          <ol>
            {toc.map(entry => (
              <li key={entry.id} className={entry.n ? undefined : 'kb-toc-end'}>
                <a
                  href={href('kb', chapter.id, entry.id)}
                  aria-current={active === entry.id ? 'location' : undefined}
                  onClick={() => {
                    setTocOpen(false);
                    // Ten sam adres nie wywoła zdarzenia hashchange, więc przewijamy także tutaj.
                    jump(entry.id);
                  }}
                >
                  {entry.n && <i>{String(entry.n).padStart(2, '0')}</i>}
                  {entry.title}
                </a>
              </li>
            ))}
          </ol>
        </nav>
        <article>
          <ChapterBody chapter={chapter} />
          <p className="kb-foot">
            <a href={href('kb', chapter.id)} onClick={() => window.scrollTo({ top: 0, behavior: 'instant' })}>
              Do początku rozdziału
            </a>
            <a href={href('kb')}>Wszystkie rozdziały</a>
          </p>
        </article>
      </div>
    </main>
  );
}

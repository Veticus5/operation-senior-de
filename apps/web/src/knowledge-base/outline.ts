import type { KbBlock, KbChapter, KbFigure } from '@content/knowledge-base/index';
import { plainText } from '../lib/richText';

/**
 * Czysta logika Knowledge Base: spis treści, teksty do sprawdzenia, czas czytania, skrót treści.
 * Bez Reacta i bez DOM, więc używa jej strona, generator PDF i testy.
 */

/** Sekcje zamykające każdy rozdział. Identyfikatory są częścią adresu, więc są stałe. */
export const END = {
  keyPoints: { id: 'do-zapamietania', title: 'Najważniejsze rzeczy do zapamiętania' },
  glossary: { id: 'slownik', title: 'Słownik pojęć' },
  misconceptions: { id: 'bledne-przekonania', title: 'Typowe błędne przekonania' },
  sources: { id: 'zrodla', title: 'Źródła' }
} as const;

export interface TocEntry {
  id: string;
  title: string;
  /** Numer części. Sekcje zamykające numeru nie mają. */
  n?: number;
}

export const outline = (chapter: KbChapter): TocEntry[] => [
  ...chapter.sections.map((s, i) => ({ id: s.id, title: s.title, n: i + 1 })),
  END.keyPoints,
  END.glossary,
  END.misconceptions,
  END.sources
];

const figureTexts = (f: KbFigure): string[] => {
  switch (f.kind) {
    case 'cells':
      return [...f.panels.flatMap(x => [x.label, x.note]), ...Object.values(f.legend)];
    case 'path':
      return [...f.steps.flatMap(s => [s.name, s.note]), f.total];
    case 'partitions':
      return [f.filter.label, ...f.layouts.flatMap(l => [l.label, l.note]), ...Object.values(f.legend)];
    case 'stacks':
      return f.columns.flatMap(c => [c.label, ...c.layers.flatMap(l => [l.name, l.text])]);
    case 'lanes':
      return f.lanes.flatMap(l => [l.label, ...l.steps.flatMap(s => [s.name, s.where])]);
    case 'clusters':
      return f.panels.flatMap(x => [x.label, x.shared ?? '', ...x.nodes.flatMap(n => [n.name, n.note])]);
  }
};

/** Fragmenty bloku, które przechodzą przez komponent Html. */
export const blockRich = (b: KbBlock): string[] => {
  switch (b.type) {
    case 'p':
      return [b.html];
    case 'list':
      return b.items;
    case 'table':
      return [...b.rows.flat(), b.caption ?? ''];
    case 'tables':
      return [b.caption];
    case 'figure':
      return [b.caption];
    case 'callout':
      return b.html;
    default:
      return [];
  }
};

/** Wszystkie fragmenty rozdziału renderowane jako HTML. Test sprawdza, że każdy się parsuje. */
export const chapterRich = (c: KbChapter): string[] => [
  ...c.lead,
  ...c.sections.flatMap(s => s.blocks.flatMap(blockRich)),
  ...c.keyPoints,
  ...c.misconceptions.flatMap(m => [m.myth, m.fact]),
  ...c.glossary.map(g => g.def)
];

const blockWords = (b: KbBlock): string[] => {
  if (b.type === 'h3') return [b.text];
  if (b.type === 'code') return [b.code];
  if (b.type === 'table') return [...b.columns, ...blockRich(b).map(plainText)];
  if (b.type === 'figure') return [plainText(b.caption), ...figureTexts(b.figure)];
  if (b.type === 'tables') return [plainText(b.caption), ...b.tables.flatMap(t => [t.name, ...t.columns, ...t.rows.flat()])];
  return blockRich(b).map(plainText);
};

export const wordCount = (c: KbChapter): number =>
  [...c.lead.map(plainText), ...c.sections.flatMap(s => [s.title, ...s.blocks.flatMap(blockWords)]), ...c.keyPoints.map(plainText), ...c.glossary.flatMap(g => [g.term, g.def]), ...c.misconceptions.flatMap(m => [m.myth, m.fact])]
    .join(' ')
    .split(/\s+/)
    .filter(Boolean).length;

/** Czas czytania przy spokojnym tempie tekstu technicznego (180 słów na minutę), zaokrąglony do 5 minut. */
export const readingMinutes = (c: KbChapter): number => Math.max(5, Math.round(wordCount(c) / 180 / 5) * 5);

/** Ścieżka pliku PDF względem katalogu public aplikacji. */
export const pdfPath = (chapterId: string): string => `kb/${chapterId}.pdf`;

/**
 * Skrót treści rozdziału (FNV-1a, dwa przebiegi po 32 bity). Generator PDF zapisuje go w pdf-manifest.json,
 * a test porównuje z bieżącą treścią. Zmiana treści bez wygenerowania PDF od nowa wywala test.
 * To kontrola aktualności, nie zabezpieczenie.
 */
export function contentHash(c: KbChapter): string {
  const text = JSON.stringify(c);
  let a = 0x811c9dc5;
  let b = 0x01000193;
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    a = Math.imul(a ^ code, 0x01000193);
    b = Math.imul(b ^ (code + i), 0x85ebca6b);
  }
  return [a, b].map(n => (n >>> 0).toString(16).padStart(8, '0')).join('');
}

/** Ile mikropartycji z ilustracji trzeba przeczytać: te, których zakres przecina zakres filtra. */
export const scannedParts = (parts: [number, number][], range: [number, number]): boolean[] => parts.map(([min, max]) => min <= range[1] && max >= range[0]);

/** Liczniki ilustracji zapisu: ile wartości czyta dany układ i ile z nich jest potrzebnych. */
export function cellCounts(rows: number, columns: number, need: number[], layout: 'row' | 'column'): { read: number; needed: number; total: number } {
  const needed = rows * need.length;
  return { read: layout === 'row' ? rows * columns : needed, needed, total: rows * columns };
}

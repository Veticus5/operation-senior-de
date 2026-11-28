import type { Area } from '../types';

/**
 * Model treści Knowledge Base. Rozdział to czyste dane: lista sekcji, a w każdej lista bloków.
 * Ten sam obiekt renderuje strona internetowa i generator PDF, więc treść nie zna żadnego z nich.
 *
 * Pola `html` przechodzą przez parser apps/web/src/lib/richText.ts (dozwolone m.in. b, i, code).
 * Kod w bloku `code` to zwykły tekst: nie jest parsowany, więc `<` zapisuje się tam wprost.
 */

/** Mała tabela z przykładowymi wierszami. `key` to kolumny klucza głównego (podkreślane). */
export interface KbMiniTable {
  name: string;
  key: string[];
  columns: string[];
  rows: string[][];
}

/** Statyczne ilustracje. Każdy rodzaj ma własny mały komponent w apps/web/src/knowledge-base/Figures.tsx. */
export type KbFigure =
  /** Ta sama tabela w zapisie wierszowym i kolumnowym. `need` to indeksy kolumn potrzebnych do wyniku. */
  | {
      kind: 'cells';
      columns: string[];
      rows: string[][];
      need: number[];
      panels: { layout: 'row' | 'column'; label: string; note: string }[];
      legend: { read: string; need: string; skipped: string; count: string };
    }
  /** Droga od wartości do wiersza przez kolejne poziomy indeksu. `pick` to wybrana pozycja w `options`. */
  | { kind: 'path'; steps: { name: string; note: string; options: string[]; pick: number }[]; total: string }
  /** Mikropartycje z zakresem wartości. Porcja jest czytana, gdy jej zakres przecina `filter.range`. */
  | {
      kind: 'partitions';
      units: string[];
      filter: { label: string; range: [number, number] };
      layouts: { label: string; note: string; parts: [number, number][] }[];
      legend: { read: string; skipped: string; count: string };
    }
  /** Kolumny warstw, czytane od dołu (storage) do góry (odbiorcy). */
  | { kind: 'stacks'; columns: { label: string; layers: { name: string; text: string }[] }[] }
  /** Tory z kolejnymi krokami. `hot` wyróżnia krok, o który chodzi w porównaniu. */
  | { kind: 'lanes'; lanes: { label: string; steps: { name: string; where: string; hot: boolean }[] }[] }
  /** Układy klastra: węzły i opcjonalny wspólny storage pod nimi. */
  | { kind: 'clusters'; panels: { label: string; nodes: { name: string; note: string }[]; shared?: string }[] };

export type KbBlock =
  | { type: 'p'; html: string }
  | { type: 'h3'; text: string }
  | { type: 'list'; items: string[]; ordered?: boolean }
  /** `plan` to wydruk narzędzia skopiowany ze źródła: długich linii nie skracamy, zawijają się. */
  | { type: 'code'; lang: 'sql' | 'yaml' | 'plan'; title?: string; code: string }
  | { type: 'table'; columns: string[]; rows: string[][]; caption?: string }
  | { type: 'tables'; tables: KbMiniTable[]; caption: string }
  | { type: 'figure'; figure: KbFigure; caption: string }
  /** `known`: powiązanie ze Snowflake albo dbt. `warn`: miejsce, w którym łatwo o błąd. `deeper`: dopowiedzenie. */
  | { type: 'callout'; tone: 'known' | 'warn' | 'deeper'; title: string; html: string[] };

export interface KbSection {
  /** Stabilny identyfikator: jest częścią adresu (#/kb/<rozdział>/<sekcja>) i kotwicą w PDF. */
  id: string;
  title: string;
  blocks: KbBlock[];
}

export interface KbChapter {
  /** Stabilny identyfikator: adres strony i nazwa pliku PDF. */
  id: string;
  area: Area;
  title: string;
  subtitle: string;
  /** Identyfikator lekcji z Learning Academy o tym samym zakresie, jeśli istnieje. */
  lessonId?: string;
  /** Data sprawdzenia faktów w źródłach, RRRR-MM-DD. */
  checked: string;
  /** Wstęp: po co jest rozdział i jak go czytać. */
  lead: string[];
  sections: KbSection[];
  keyPoints: string[];
  glossary: { term: string; def: string }[];
  misconceptions: { myth: string; fact: string }[];
  /** Skąd są fakty, jedno lub dwa zdania. */
  sourcesNote: string;
  sources: { label: string; url: string }[];
}

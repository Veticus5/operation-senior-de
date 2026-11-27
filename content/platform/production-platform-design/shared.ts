/** Wspólne kształty danych lekcji Production Data Platform Design. Czyste dane, bez importów z aplikacji. */

/** Zwinięte pogłębienie, poza domyślną ścieżką. */
export interface More {
  title: string;
  html: string[];
}

/** Jedna opcja porównania: etykieta, wiersze „cecha → wartość" i jedno zdanie wniosku. Wartości i wniosek to fragmenty HTML. */
export interface CompareOption {
  id: string;
  label: string;
  rows: [string, string][];
  verdict: string;
}

/** Porównanie kilku wariantów tej samej decyzji. Jeden przełącznik, widoczny skutek. */
export interface Compare {
  label: string;
  assumptions: string;
  defaultId: string;
  options: CompareOption[];
}

/** Sytuacja z wyborem pierwszego kroku: najpierw wybór, potem uzasadnienie i jego zakres. */
export interface Scenario {
  setup: string;
  options: string[];
  correct: number;
  why: string;
  scope: string;
}

export interface QuizItem {
  q: string;
  setup?: string;
  options: string[];
  correct: number;
  why: string;
}

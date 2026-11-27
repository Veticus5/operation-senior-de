/** Model treści. Treść nie importuje niczego z aplikacji: to czyste dane. */

export type Area = 'spark' | 'delta-lake' | 'databricks' | 'architecture' | 'data-modeling';
export type Priority = 'P0' | 'P1' | 'P2';

export interface Bilingual {
  pl: string;
  en: string;
}

export interface FollowUp {
  /** Pytanie pogłębiające, po angielsku (tak padnie na rozmowie). */
  q: string;
  /** Odpowiedź do powiedzenia na głos, po angielsku. */
  a: string;
  /** Jedno zdanie po polsku: sedno albo haczyk. */
  pl: string;
}

export interface Question {
  /** Stabilny identyfikator pytania. Nie zmieniaj po publikacji: wisi na nim zapisany postęp. */
  id: string;
  /** Stabilny identyfikator zagadnienia. Lekcja o tym samym topicId jest automatycznie podpinana. */
  topicId: string;
  area: Area;
  priority: Priority;
  /** Krótka nazwa do list i wyszukiwarki. */
  title: string;
  question: Bilingual;
  /** Odpowiedź na 30–60 sekund mówienia. */
  answer: Bilingual;
  /** Opcjonalne rozwinięcie na poziomie seniora: co dopowiedzieć, gdy rozmówca drąży. */
  senior?: Bilingual;
  /**
   * Wyjaśnienie mechanizmu od podstaw, po polsku, akapitami. To materiał do zrozumienia, nie do powiedzenia
   * na głos: w interfejsie jest zwinięte. Dozwolone znaczniki: b, code oraz <term id="...">tekst</term>
   * (hasło z content/glossary.ts). Liczby opisane jako pomiar muszą mieć pokrycie w labs/.
   */
  explain: string[];
  keywords: string[];
  followUps: FollowUp[];
  /** Typowe błędy kandydatów. */
  mistakes: string[];
  /** Laby, które odtwarzają liczby z tego pytania. Identyfikatory z labs/registry.json. */
  labIds?: string[];
}

/**
 * Lab z allowlisty labs/registry.json: skrypt, który lokalny runner może uruchomić z interfejsu.
 * Identyfikator jest stabilny, bo wiążą się nim lekcje i pytania.
 */
export interface Lab {
  id: string;
  /** Ścieżka skryptu względem katalogu labs/. */
  script: string;
  title: string;
  /** Co lab mierzy, jedno zdanie po polsku. */
  summary: string;
  /** Jak daleko wolno uogólniać wynik. Dozwolone znaczniki jak w Question.explain. */
  scope: string;
  /** Limit czasu jednego uruchomienia, egzekwowany przez runner. */
  timeoutSec: number;
}

/** Hasło słownika. Definicja ma być zrozumiała bez znajomości innych haseł. */
export interface GlossaryEntry {
  /** Nazwa wyświetlana w dymku. */
  term: string;
  /** Jedno do trzech zdań, po polsku. */
  def: string;
}

/**
 * Most do tego, co uczeń już zna (SQL, Snowflake, dbt). Pole `breaks` jest obowiązkowe:
 * analogia bez wskazania, gdzie się kończy, uczy błędnego modelu.
 */
export interface Bridge {
  /** Skąd jest analogia, np. "dbt" albo "Snowflake". */
  from: string;
  /** Znane pojęcie. */
  known: string;
  /** Jego odpowiednik w nowym temacie. */
  fresh: string;
  /** Gdzie analogia przestaje działać. */
  breaks: string;
}

/** Jedna linia kodu albo planu z wyjaśnieniem. Używa tego komponent CodeExplainer. */
export interface ExplainedLine {
  /** Linia dokładnie tak, jak ją wypisuje narzędzie. */
  code: string;
  /** Krótka etykieta, np. odpowiednik w SQL. */
  label: string;
  /** Wyjaśnienie po polsku. Dozwolone znaczniki jak w Question.explain. */
  text: string;
}

export interface LessonMeta {
  id: string;
  topicId: string;
  area: Area;
  title: string;
  subtitle: string;
  /** Szacowany czas w minutach. */
  minutes: number;
}

export const AREA_LABEL: Record<Area, string> = {
  spark: 'Spark',
  'delta-lake': 'Delta Lake',
  databricks: 'Databricks',
  architecture: 'Data Architecture',
  'data-modeling': 'Data Modeling'
};

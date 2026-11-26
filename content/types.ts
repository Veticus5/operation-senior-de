/** Model treści. Treść nie importuje niczego z aplikacji: to czyste dane. */

export type Area = 'spark' | 'delta-lake' | 'databricks';
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
  keywords: string[];
  followUps: FollowUp[];
  /** Typowe błędy kandydatów. */
  mistakes: string[];
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
  databricks: 'Databricks'
};

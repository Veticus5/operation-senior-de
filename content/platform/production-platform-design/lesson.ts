import type { LessonMeta } from '../../types';

/**
 * Lekcja: Production Data Platform Design. Jeden przykład przez całą lekcję: platforma analityki subskrypcji
 * wymyślonego serwisu wideo (źródła: baza billingowa, API dostawcy płatności, zdarzenia z aplikacji).
 * Punkty odniesienia to Snowflake, dbt, Python i AWS, ale zasady są niezależne od narzędzia.
 *
 * Treść jest podzielona na pliki według etapów lekcji:
 *   architecture.ts  warstwy RAW / STG / MRT, schemat, kiedy warstw jest za dużo
 *   pipelines.ts     ładowanie przyrostowe, high-water mark, retry, deduplikacja, backfill, orkiestracja
 *   scale.ts         skalowanie, izolacja obciążeń, wąskie gardła, multi-tenant
 *   trust.ts         jakość i obserwowalność, SLA / SLO / SLI, RPO / RTO, PII, własność danych
 *   streaming.ts     batch, micro-batch, streaming, czas zdarzenia, semantyki dostarczenia
 *   practice.ts      etap Interview (scenariusze awarii, zadanie projektowe) i sprawdzian
 *
 * Skąd są fakty: oficjalna dokumentacja Snowflake, dbt, AWS, Monte Carlo, Apache Kafka i Apache Spark,
 * spisana w docs/verified-facts.md, sekcja „Lekcja: Production Data Platform Design".
 * Ta lekcja nie ma labu. Wszystkie symulacje i liczby w ilustracjach są wymyślone i tak podpisane:
 * pokazują mechanizm, nie pomiar. Dane przykładowe (klienci, płatności, kwoty) są wymyślone.
 * Pytania rekrutacyjne, krótkie odpowiedzi i follow-upy nie są tu powtórzone: lekcja bierze je z Interview Banku.
 */
export const meta: LessonMeta = {
  id: 'platform-production-design',
  topicId: 'platform.production-design',
  area: 'platform',
  title: 'Production Data Platform Design',
  subtitle: 'Jak zaprojektować platformę danych, która przeżyje awarię, duplikat, spóźniony rekord i pytanie „a co, jeśli…" na rozmowie. Na jednym przykładzie: analityka subskrypcji.',
  minutes: 90
};

/** Zagadnienia z Interview Banku ćwiczone w etapie Interview, w tej kolejności. */
export const interviewTopics = [
  'platform.production-design',
  'platform.layered-architecture',
  'platform.incremental-loading',
  'platform.idempotency',
  'platform.scalability',
  'platform.data-reliability',
  'platform.batch-streaming'
];

export * from './shared';
export * as architecture from './architecture';
export * as pipelines from './pipelines';
export * as scale from './scale';
export * as trust from './trust';
export * as streaming from './streaming';
export * as practice from './practice';

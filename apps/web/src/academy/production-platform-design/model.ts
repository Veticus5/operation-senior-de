import type { DeliveredEvent, Payment, SourceVersion } from '@content/platform/production-platform-design/pipelines';
import type { StreamEvent, WindowEvent } from '@content/platform/production-platform-design/streaming';

/**
 * Czysta logika symulacji lekcji Production Data Platform Design. To JavaScript, nie Snowflake ani Kafka:
 * modele są celowo małe i uproszczone, a założenia każdego są opisane w treści obok symulacji.
 * Liczby, które treść podaje w werdyktach, wynikają z tych funkcji i są pilnowane testem lekcji.
 */

export type VersionStatus = 'waiting' | 'loaded' | 'duplicate' | 'missed';
export interface HwmResult {
  /** Znacznik po ostatnim wykonanym ładowaniu, w minutach od północy. Null przed pierwszym ładowaniem. */
  mark: number | null;
  /** Identyfikatory wersji przeczytanych przez każde wykonane ładowanie. */
  reads: string[][];
  status: Record<string, VersionStatus>;
  /** Liczba wierszy w tabeli docelowej. */
  targetRows: number;
  missed: number;
  duplicates: number;
}

/**
 * Ładowanie przyrostowe po znaczniku. Każde ładowanie czyta wersje widoczne w chwili uruchomienia
 * z updated_at nowszym niż (znacznik − okno wstecz), a potem przesuwa znacznik na najnowszy przeczytany updated_at.
 */
export function hwmRuns(versions: SourceVersion[], runTimes: number[], lookback: number, write: 'append' | 'merge', runsDone: number): HwmResult {
  let mark: number | null = null;
  const reads: string[][] = [];
  const times = new Map<string, number>();
  for (const at of runTimes.slice(0, runsDone)) {
    const from = mark === null ? -Infinity : mark - lookback;
    const read = versions.filter(v => v.visibleAt <= at && v.updatedAt > from);
    reads.push(read.map(v => v.id));
    for (const v of read) times.set(v.id, (times.get(v.id) ?? 0) + 1);
    if (read.length) mark = Math.max(mark ?? -Infinity, ...read.map(v => v.updatedAt));
  }
  const lastRun = runsDone > 0 ? runTimes[runsDone - 1] : null;
  const status: Record<string, VersionStatus> = {};
  for (const v of versions) {
    const n = times.get(v.id) ?? 0;
    if (n > 1 && write === 'append') status[v.id] = 'duplicate';
    else if (n > 0) status[v.id] = 'loaded';
    // Wersja już widoczna, a nieprzeczytana: znacznik ją minął i żadne kolejne ładowanie o nią nie zapyta.
    else if (lastRun !== null && v.visibleAt <= lastRun) status[v.id] = 'missed';
    else status[v.id] = 'waiting';
  }
  const loaded = versions.filter(v => times.has(v.id));
  const totalReads = [...times.values()].reduce((a, b) => a + b, 0);
  return {
    mark,
    reads,
    status,
    targetRows: write === 'append' ? totalReads : new Set(loaded.map(v => v.key)).size,
    missed: versions.filter(v => status[v.id] === 'missed').length,
    duplicates: write === 'append' ? totalReads - loaded.length : 0
  };
}

export type RetryStrategy = 'append' | 'overwrite' | 'merge';

/**
 * Stan tabeli docelowej po `step` uruchomieniach: pierwsze pada po `chunksBeforeCrash` porcjach, kolejne kończą się sukcesem.
 * Zwraca liczbę kopii każdej płatności w tabeli.
 */
export function retryRows(batch: Payment[], chunk: number, chunksBeforeCrash: number, strategy: RetryStrategy, step: number): { id: string; amount: number; copies: number }[] {
  const partial = chunk * chunksBeforeCrash;
  return batch.map((p, i) => {
    const inPartial = i < partial;
    let copies = 0;
    if (strategy === 'append') copies = (step >= 1 && inPartial ? 1 : 0) + Math.max(0, step - 1);
    // Jedna transakcja: awaria wycofuje wszystko, każde udane uruchomienie zostawia dokładnie komplet.
    else if (strategy === 'overwrite') copies = step >= 2 ? 1 : 0;
    else copies = step >= 2 || (step === 1 && inPartial) ? 1 : 0;
    return { ...p, copies };
  });
}

export const retryTotal = (rows: { amount: number; copies: number }[]) => rows.reduce((n, r) => n + r.amount * r.copies, 0);
export const retryCount = (rows: { copies: number }[]) => rows.reduce((n, r) => n + r.copies, 0);

export type DedupKey = 'none' | 'natural' | 'event';

/** Numery zdarzeń (pole `n`), które zostają po deduplikacji wybranym kluczem. Z każdej grupy zostaje pierwsze dostarczone. */
export function dedupe(events: DeliveredEvent[], key: DedupKey): number[] {
  if (key === 'none') return events.map(e => e.n);
  const seen = new Set<string>();
  const kept: number[] = [];
  for (const e of events) {
    const k = key === 'event' ? e.eventId : `${e.userId}|${e.amount}|${e.at}`;
    if (seen.has(k)) continue;
    seen.add(k);
    kept.push(e.n);
  }
  return kept;
}

export interface WindowResult {
  /** Początek okna (minuty po 12:00) -> liczba policzonych zdarzeń. */
  counts: Record<number, number>;
  /** Początek okna, do którego trafiło zdarzenie, albo null, gdy zostało odrzucone jako spóźnione. */
  assigned: Record<string, number | null>;
  /** Kiedy wynik pierwszego okna jest ostateczny (minuty po 12:00). */
  readyAt: number;
}

/**
 * Zliczanie w oknach. `event`: zdarzenie należy do okna swojego czasu zdarzenia i jest liczone, jeśli dotarło,
 * zanim zegar minął koniec okna plus dopuszczalne spóźnienie. `processing`: zdarzenie należy do okna, w którym dotarło.
 */
export function windowCounts(events: WindowEvent[], basis: 'event' | 'processing', lateness: number, size: number): WindowResult {
  const counts: Record<number, number> = {};
  const assigned: Record<string, number | null> = {};
  for (const e of events) {
    const start = Math.floor((basis === 'event' ? e.eventAt : e.arrivedAt) / size) * size;
    const ok = basis === 'processing' || e.arrivedAt < start + size + lateness;
    assigned[e.id] = ok ? start : null;
    if (ok) counts[start] = (counts[start] ?? 0) + 1;
  }
  return { counts, assigned, readyAt: size + (basis === 'event' ? lateness : 0) };
}

export type Delivery = 'most' | 'least' | 'exactly';

/** Zawartość tabeli docelowej po awarii i restarcie konsumenta: identyfikatory zdarzeń w kolejności zapisu. */
export function deliver(events: StreamEvent[], writtenBeforeCrash: number, mode: Delivery): string[] {
  const before = events.slice(0, writtenBeforeCrash).map(e => e.id);
  const all = events.map(e => e.id);
  if (mode === 'most') return before;
  if (mode === 'least') return [...before, ...all];
  return all;
}

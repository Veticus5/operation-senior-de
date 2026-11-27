import type { Commit, DataFile, MergeRow, Row, UcObject } from '@content/databricks/platform-delta-lake/lesson';

/**
 * Czysta logika wizualizacji lekcji Databricks Platform & Delta Lake. To model protokołu Delta w JavaScripcie,
 * nie Delta Lake: odtwarza listę plików z akcji add i remove tak, jak opisuje to PROTOCOL.md
 * (odtwarzaj commity rosnąco, dla każdego pliku wygrywa najnowsza akcja).
 */

/** Nazwa pliku commitu: wersja dopełniona zerami do 20 cyfr. */
export const commitFile = (version: number): string => `${String(version).padStart(20, '0')}.json`;

/** Stan tabeli w danej wersji: pliki, które po odtworzeniu logu zostały na liście, i ich wiersze. */
export function snapshot(commits: Commit[], version: number): { files: DataFile[]; rows: Row[] } {
  const live = new Map<string, DataFile>();
  for (const c of commits) {
    if (c.version > version) break;
    for (const path of c.remove) live.delete(path);
    for (const file of c.add) live.set(file.path, file);
  }
  const files = [...live.values()];
  return { files, rows: files.flatMap(f => f.rows).sort((a, b) => a.id - b.id) };
}

/** Wszystkie pliki danych, które fizycznie powstały do danej wersji włącznie (żadna akcja ich nie kasuje). */
export function written(commits: Commit[], version: number): DataFile[] {
  return commits.filter(c => c.version <= version).flatMap(c => c.add);
}

/** Dzień, w którym plik został oznaczony w logu jako usunięty, albo undefined, gdy nadal należy do tabeli. */
export function removedOn(commits: Commit[], path: string): number | undefined {
  return commits.find(c => c.remove.includes(path))?.day;
}

/**
 * Pliki, które skasuje VACUUM uruchomiony dziś: nie należą do bieżącej wersji i zostały oznaczone
 * jako usunięte co najmniej `retentionDays` dni temu.
 */
export function vacuumed(commits: Commit[], today: number, retentionDays: number): string[] {
  const latest = commits[commits.length - 1].version;
  const current = new Set(snapshot(commits, latest).files.map(f => f.path));
  return written(commits, latest)
    .map(f => f.path)
    .filter(path => {
      const day = removedOn(commits, path);
      return !current.has(path) && day !== undefined && today - day >= retentionDays;
    });
}

export type VersionStatus = 'current' | 'ok' | 'outside' | 'files' | 'log';

/** Czy wersję da się dziś odczytać. Kolejność warunków: bieżąca, log, pliki, okno retencji. */
export function versionStatus(
  commits: Commit[], version: number, today: number, vacuumRan: boolean,
  retention: { fileDays: number; logDays: number }
): VersionStatus {
  const latest = commits[commits.length - 1].version;
  if (version === latest) return 'current';
  const commit = commits.find(c => c.version === version) as Commit;
  const age = today - commit.day;
  if (age > retention.logDays) return 'log';
  if (vacuumRan) {
    const gone = new Set(vacuumed(commits, today, retention.fileDays));
    if (snapshot(commits, version).files.some(f => gone.has(f.path))) return 'files';
  }
  return age > retention.fileDays ? 'outside' : 'ok';
}

export type MergeTag = 'same' | 'updated' | 'inserted' | 'deleted';
export interface MergeOutcome { error: boolean; rows: (MergeRow & { tag: MergeTag })[] }

/**
 * Semantyka MERGE po kluczu id. Błąd, gdy więcej niż jeden wiersz źródła pasuje do tego samego wiersza celu,
 * a klauzula WHEN MATCHED chce go zmienić. Wiersze usunięte zostają w wyniku z etykietą, żeby było je widać.
 */
export function mergeRows(
  target: MergeRow[], source: MergeRow[],
  clauses: { matched: boolean; notMatched: boolean; bySource: boolean }
): MergeOutcome {
  const bySourceId = new Map<number, MergeRow[]>();
  for (const s of source) bySourceId.set(s.id, [...(bySourceId.get(s.id) ?? []), s]);
  const targetIds = new Set(target.map(t => t.id));
  if (clauses.matched && target.some(t => (bySourceId.get(t.id)?.length ?? 0) > 1)) return { error: true, rows: [] };

  const rows: MergeOutcome['rows'] = target.map(t => {
    const match = bySourceId.get(t.id)?.[0];
    if (match) return clauses.matched && (match.name !== t.name || match.tier !== t.tier) ? { ...match, tag: 'updated' } : { ...t, tag: 'same' };
    return { ...t, tag: clauses.bySource ? 'deleted' : 'same' };
  });
  if (clauses.notMatched) for (const s of source) if (!targetIds.has(s.id)) rows.push({ ...s, tag: 'inserted' });
  return { error: false, rows };
}

/**
 * Reguła odczytu tabeli w Unity Catalog: SELECT nadany na tabeli albo wyżej (dziedziczenie w dół)
 * oraz USE CATALOG i USE SCHEMA na obiektach nadrzędnych. Model ma jeden katalog, a USE SCHEMA dotyczy schematu sales.
 */
export function canRead(
  object: UcObject, grant: 'catalog' | 'schema' | 'table',
  use: { catalog: boolean; salesSchema: boolean }
): boolean {
  if (object.kind !== 'table') return false;
  const select = grant === 'catalog' || (grant === 'schema' && object.schema === 'sales') || (grant === 'table' && object.id === 'orders');
  return select && use.catalog && use.salesSchema && object.schema === 'sales';
}

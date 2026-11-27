import { describe, expect, it } from 'vitest';
import { lessons, questions } from '@content/index';
import { glossary } from '@content/glossary';
import type { Bridge } from '@content/types';
import * as l from '@content/databricks/platform-delta-lake/lesson';
import { parseRich, plainText, termIds } from '../../lib/richText';
import { canRead, commitFile, mergeRows, snapshot, vacuumed, versionStatus, written } from './engine';

const words = (text: string) => plainText(text).split(/\s+/).filter(Boolean).length;
const mores = (items: l.More[]) => items.flatMap(m => m.html);
const commits = l.log.commits;
const latest = commits[commits.length - 1].version;
const retention = { fileDays: l.timeTravel.fileRetentionDays, logDays: l.timeTravel.logRetentionDays };

const bridges: Bridge[] = [
  ...l.beats.flatMap(b => (b.bridge ? [b.bridge] : [])),
  l.timeTravel.bridge, l.clustering.bridge, l.arch.bridge, l.uc.bridge, l.lakeflow.bridge
];
const rich: string[] = [
  ...l.beats.flatMap(b => [b.html, b.after ?? '', ...(b.more?.html ?? [])]),
  ...l.log.intro, ...l.log.takeaway, ...mores(l.log.more),
  ...l.conflict.intro, l.conflict.takeaway, ...mores(l.conflict.more),
  ...l.merge.intro, l.merge.takeaway, ...l.merge.lines.map(x => x.text), ...mores(l.merge.more),
  ...l.schema.intro, l.schema.takeaway, ...mores(l.schema.more),
  ...l.timeTravel.intro, ...l.timeTravel.takeaway, ...l.timeTravel.lines.map(x => x.text), ...mores(l.timeTravel.more),
  ...l.compaction.intro, l.compaction.takeaway, ...mores(l.compaction.more),
  ...l.clustering.intro, l.clustering.takeaway, ...mores(l.clustering.more),
  ...l.cdf.intro, l.cdf.takeaway, ...mores(l.cdf.more),
  ...l.arch.intro, l.arch.takeaway, ...mores(l.arch.more),
  ...l.compute.intro, l.compute.takeaway, ...mores(l.compute.more),
  ...l.uc.intro, l.uc.takeaway, ...mores(l.uc.more),
  ...l.lakeflow.intro, l.lakeflow.takeaway, ...l.lakeflow.lines.map(x => x.text), ...mores(l.lakeflow.more),
  ...l.deploy.intro, l.deploy.takeaway, ...l.deploy.lines.map(x => x.text), ...l.deploy.flow.map(f => f.text), ...mores(l.deploy.more),
  ...l.microsoft.intro, l.microsoft.takeaway,
  ...l.compare.intro, l.compare.takeaway, ...mores(l.compare.more),
  l.choose.takeaway,
  ...l.quiz.flatMap(q => [q.q, q.why]),
  ...bridges.flatMap(b => [b.known, b.fresh, b.breaks])
];

describe('lekcja Databricks Platform & Delta Lake', () => {
  it('jest zarejestrowana i ma pytania w banku dla każdego ćwiczonego zagadnienia', () => {
    expect(lessons.some(x => x.id === l.meta.id)).toBe(true);
    expect(l.meta.minutes).toBe(60);
    expect(l.interviewTopics[0]).toBe(l.meta.topicId);
    for (const topic of l.interviewTopics) expect(questions.some(q => q.topicId === topic), topic).toBe(true);
    expect(l.interviewTopics.flatMap(t => questions.filter(q => q.topicId === t).map(q => q.id))).toEqual([
      'databricks-beyond-spark', 'delta-acid-log', 'delta-concurrent-writes', 'delta-merge-idempotency',
      'delta-optimize-vacuum', 'databricks-unity-catalog', 'databricks-snowflake-fabric-choice'
    ]);
  });
  it('etap Interview nie dubluje banku', () => {
    expect('questionPl' in l.interview).toBe(false);
    expect('followUps' in l.interview).toBe(false);
  });
  it('treść przechodzi przez parser, a każde hasło istnieje w słowniku', () => {
    for (const html of rich) {
      expect(() => parseRich(html), html.slice(0, 60)).not.toThrow();
      for (const id of termIds(html)) expect(glossary[id], `hasło "${id}" w: ${html.slice(0, 60)}`).toBeDefined();
    }
  });
  it('każdy most mówi, gdzie analogia się kończy', () => {
    expect(bridges.length).toBe(6);
    for (const b of bridges) for (const part of [b.known, b.fresh, b.breaks]) expect(words(part), b.from).toBeGreaterThanOrEqual(8);
  });

  it('log: wersje są kolejne, a odtworzenie daje stany opisane w lekcji', () => {
    expect(commits.map(c => c.version)).toEqual([0, 1, 2, 3, 4]);
    expect(commitFile(0)).toBe('00000000000000000000.json');
    expect(commitFile(12)).toHaveLength(25);
    expect(commits.map(c => snapshot(commits, c.version).rows.length)).toEqual([3, 5, 5, 4, 4]);
    expect(commits.map(c => snapshot(commits, c.version).files.length)).toEqual([1, 2, 2, 2, 1]);
    // remove nie kasuje pliku: po pięciu commitach w katalogu leży pięć plików, a tabela używa jednego.
    expect(written(commits, latest).length).toBe(5);
    // Każdy plik oznaczony jako usunięty musiał wcześniej zostać dodany i nadal należeć do tabeli.
    for (const c of commits) for (const path of c.remove) expect(snapshot(commits, c.version - 1).files.some(f => f.path === path), path).toBe(true);
  });
  it('log: UPDATE i DELETE zmieniają wiersze, a OPTIMIZE tylko układ plików', () => {
    expect(snapshot(commits, 1).rows.find(r => r.id === 2)?.status).toBe('new');
    expect(snapshot(commits, 2).rows.find(r => r.id === 2)?.status).toBe('paid');
    expect(snapshot(commits, 3).rows.some(r => r.id === 5)).toBe(false);
    expect(snapshot(commits, 4).rows).toEqual(snapshot(commits, 3).rows);
    expect(commits[4].operation).toBe('OPTIMIZE');
  });
  it('time travel i VACUUM: statusy wersji wynikają z retencji', () => {
    const statuses = (today: number, vacuum: boolean) => commits.map(c => versionStatus(commits, c.version, today, vacuum, retention));
    expect(l.timeTravel.days).toContain(l.timeTravel.defaultDay);
    for (const s of ['current', 'ok', 'outside', 'files', 'log']) expect(l.timeTravel.statuses[s], s).toBeDefined();
    // Dzień 5: nic nie przekroczyło 7 dni, więc VACUUM niczego nie kasuje.
    expect(vacuumed(commits, 5, 7)).toEqual([]);
    expect(statuses(5, true)).toEqual(['ok', 'ok', 'ok', 'ok', 'current']);
    // Dzień 9: part-a (remove w dniu 2) ma 7 dni. Bez VACUUM wersje 0 i 1 są poza oknem, po VACUUM nie mają plików.
    expect(vacuumed(commits, 9, 7)).toEqual(['part-a.parquet']);
    expect(statuses(9, false)).toEqual(['outside', 'outside', 'ok', 'ok', 'current']);
    expect(statuses(9, true)).toEqual(['files', 'files', 'ok', 'ok', 'current']);
    // Dzień 40: wpisy logu starsze niż 30 dni znikają niezależnie od VACUUM. Bieżąca wersja zostaje.
    expect(statuses(40, false)).toEqual(['log', 'log', 'log', 'log', 'current']);
    expect(vacuumed(commits, 40, 7).sort()).toEqual(['part-a.parquet', 'part-b.parquet', 'part-c.parquet', 'part-d.parquet']);
    expect(snapshot(commits, latest).files.map(f => f.path)).toEqual(['part-e.parquet']);
  });
  it('konflikty: tabela zgadza się z dokumentacją Databricks dla WriteSerializable', () => {
    expect(l.conflict.steps.length).toBe(4);
    expect(Object.fromEntries(l.conflict.cases.map(c => [c.id, c.ok]))).toEqual({ append: true, 'same-file': false, 'row-level': true, 'insert-update': true });
    for (const c of l.conflict.cases) for (const text of [c.setup, c.check, c.verdict]) expect(words(text), c.id).toBeGreaterThanOrEqual(8);
  });
  it('MERGE: klauzule dają opisane wyniki, a duplikat w źródle to błąd', () => {
    const all = { matched: true, notMatched: true, bySource: false };
    const tags = (out: ReturnType<typeof mergeRows>) => out.rows.map(r => `${r.id}:${r.tag}`);
    expect(tags(mergeRows(l.merge.target, l.merge.source, all))).toEqual(['1:same', '2:updated', '3:same', '4:updated', '5:inserted']);
    expect(tags(mergeRows(l.merge.target, l.merge.source, { ...all, bySource: true }))).toEqual(['1:deleted', '2:updated', '3:deleted', '4:updated', '5:inserted']);
    expect(tags(mergeRows(l.merge.target, l.merge.source, { matched: false, notMatched: false, bySource: false }))).toEqual(['1:same', '2:same', '3:same', '4:same']);
    const withDuplicate = [...l.merge.source, l.merge.duplicate];
    expect(mergeRows(l.merge.target, withDuplicate, all).error).toBe(true);
    // Bez klauzuli, która zmienia dopasowany wiersz, duplikat w źródle nie jest błędem.
    expect(mergeRows(l.merge.target, withDuplicate, { ...all, matched: false }).error).toBe(false);
    expect(l.merge.clauses.map(c => c.id)).toEqual(['matched', 'notMatched', 'bySource']);
    expect(l.merge.target.some(t => t.id === l.merge.duplicate.id)).toBe(true);
  });
  it('schemat: cztery kombinacje, odrzucona jest tylko nowa kolumna bez ewolucji', () => {
    const keys = l.schema.batches.flatMap(b => l.schema.modes.map(m => `${b.id}|${m.id}`));
    expect(Object.keys(l.schema.results).sort()).toEqual([...keys].sort());
    expect(keys.filter(k => !l.schema.results[k].ok)).toEqual(['extra|enforce']);
    expect(l.schema.results['extra|enforce'].columns).toEqual(l.schema.tableColumns);
    expect(l.schema.results['extra|evolve'].columns).toEqual([...l.schema.tableColumns, 'channel']);
  });
  it('kompaktowanie, clustering i CDF: liczby w opisach wynikają z danych', () => {
    expect(l.compaction.states.map(s => [s.current, s.stored])).toEqual([[24, 24], [1, 25], [1, 1]]);
    expect(l.compaction.smallFiles * l.compaction.smallMb).toBe(120);
    const skipped = l.clustering.layouts.map(x => x.files.filter(f => l.clustering.value < f.min || l.clustering.value > f.max).length);
    expect(skipped).toEqual([0, 3]);
    for (const r of l.cdf.rows) expect(r.length).toBe(l.cdf.columns.length);
    // Wiersze CDF odpowiadają commitom 2 (UPDATE id = 2) i 3 (DELETE id = 5) z symulacji logu.
    expect(l.cdf.rows.map(r => `${r[0]}:${r[4]}:${r[5]}`)).toEqual(['2:update_preimage:2', '2:update_postimage:2', '5:delete:3']);
  });
  it('Unity Catalog: do odczytu potrzeba SELECT oraz obu uprawnień USE', () => {
    const read = (grant: 'catalog' | 'schema' | 'table', catalog: boolean, salesSchema: boolean) =>
      l.uc.objects.filter(o => canRead(o, grant, { catalog, salesSchema })).map(o => o.id);
    expect(read('schema', true, true)).toEqual(['orders', 'customers']);
    expect(read('table', true, true)).toEqual(['orders']);
    // SELECT na katalogu obejmuje finance.invoices, ale bez USE SCHEMA na finance tabela pozostaje niedostępna.
    expect(read('catalog', true, true)).toEqual(['orders', 'customers']);
    expect(read('catalog', false, true)).toEqual([]);
    expect(read('catalog', true, false)).toEqual([]);
    expect(l.uc.grants.some(g => g.id === l.uc.defaultGrant)).toBe(true);
  });
  it('platforma i ekosystem: wizualizacje mają komplet danych', () => {
    expect(l.beats.length).toBe(3);
    expect(l.arch.boxes.map(b => [b.id, b.owner])).toEqual([['control', 'databricks'], ['serverless', 'databricks'], ['classic', 'you'], ['storage', 'you']]);
    expect(l.arch.boxes.some(b => b.id === l.arch.defaultBox)).toBe(true);
    expect(l.compute.cases.some(c => c.id === l.compute.defaultCase)).toBe(true);
    expect(l.microsoft.items.map(x => x.id)).toEqual(['adls', 'adf', 'azdb', 'fabric', 'onelake', 'lhwh', 'semantic']);
    expect(l.microsoft.items.some(x => x.id === l.microsoft.defaultItem)).toBe(true);
    expect(l.compare.dims.some(d => d.id === l.compare.defaultDim)).toBe(true);
    for (const d of l.compare.dims) for (const text of [d.snowflake, d.databricks, d.fabric]) expect(words(text), d.id).toBeGreaterThanOrEqual(8);
    expect(l.versus.rows.every(r => r.length === l.versus.columns.length)).toBe(true);
    expect(l.myths.items.length).toBe(9);
  });
  it('scenariusze i sprawdzian mają poprawne odpowiedzi oraz wyjaśnienia', () => {
    expect(l.choose.cases.length).toBe(4);
    // Każda z trzech platform i wariant „obie" są dobrą odpowiedzią dokładnie raz, żeby ćwiczenie nie sugerowało rankingu.
    expect(l.choose.cases.map(c => c.options[c.correct])).toEqual(['Snowflake', 'Databricks', 'Microsoft Fabric', 'Nie migrować: najpierw sprawdzić opcje ML w Snowflake, a drugi silnik dołożyć tylko przy realnej potrzebie']);
    for (const c of l.choose.cases) {
      expect(c.correct, c.setup).toBeLessThan(c.options.length);
      expect(new Set(c.options).size, c.setup).toBe(c.options.length);
      for (const text of [c.setup, c.why, c.scope]) expect(words(text), c.setup).toBeGreaterThanOrEqual(8);
    }
    expect(l.quiz.length).toBe(12);
    for (const q of l.quiz) {
      expect(q.correct, q.q).toBeLessThan(q.options.length);
      expect(new Set(q.options).size, q.q).toBe(q.options.length);
      expect(words(q.why), q.q).toBeGreaterThanOrEqual(12);
    }
    // Poprawna odpowiedź nie stoi zawsze w tym samym miejscu.
    expect(new Set(l.quiz.map(q => q.correct)).size).toBe(3);
  });
});

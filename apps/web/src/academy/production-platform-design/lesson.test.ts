import { describe, expect, it } from 'vitest';
import { AREA_LABEL, lessons, questions } from '@content/index';
import { glossary } from '@content/glossary';
import type { Bridge } from '@content/types';
import * as l from '@content/platform/production-platform-design/lesson';
import { parseRich, plainText, termIds } from '../../lib/richText';
import { dedupe, deliver, hwmRuns, retryCount, retryRows, retryTotal, windowCounts } from './model';

const words = (text: string) => plainText(text).split(/\s+/).filter(Boolean).length;
const { architecture: a, pipelines: p, scale: s, trust: t, streaming: st, practice: pr } = l;

const compares: l.Compare[] = [a.schema, p.strategies, s.tenants, t.recovery, st.modes];
const mores: l.More[] = [a.map.more, a.layers.more, a.schema.more, p.hwm.more, p.api.more, p.retry.more, p.backfill.more, p.dag.more, s.workload.more, s.distributed.more, t.incidents.more, t.slo.more, t.recovery.more, t.access.more, st.windows.more, st.semantics.more];
const scenarios: l.Scenario[] = [...a.fewer.cases, ...st.needs.cases];
const bridges: Bridge[] = [a.layers.bridge, p.hwm.bridge, t.incidents.bridge, st.semantics.bridge];
const explained = [...p.api.lines, ...p.dedup.lines];

/** Wszystkie fragmenty, które przechodzą przez komponent Html. */
const rich: string[] = [
  a.opening.html, s.opening.html, t.opening.html, st.opening.html,
  a.map.assumptions, a.map.takeaway,
  ...[...a.map.flow, ...a.map.cross].flatMap(n => [n.role, n.example, n.fails, n.decision]),
  a.layers.intro, a.layers.assumptions, a.layers.takeaway, ...a.layers.items.flatMap(x => [...x.did, x.didNot]),
  a.schema.takeaway, a.fewer.takeaway,
  p.strategies.intro, p.strategies.takeaway,
  p.hwm.intro, p.hwm.assumptions, p.hwm.takeaway,
  p.api.takeaway, p.retry.assumptions, p.retry.takeaway,
  p.dedup.intro, p.dedup.assumptions, p.dedup.takeaway,
  p.backfill.intro, p.backfill.assumptions, p.backfill.takeaway,
  p.dag.assumptions, p.dag.takeaway,
  s.workload.assumptions, s.workload.takeaway, ...s.workload.cases.flatMap(c => Object.values(c.outcomes).map(o => o.verdict)),
  s.distributed.intro, ...s.distributed.points, s.distributed.takeaway, s.capacity.takeaway,
  s.tenants.intro, s.tenants.takeaway,
  t.incidents.assumptions, t.incidents.takeaway, ...t.incidents.items.flatMap(i => [i.lesson, ...i.catches.map(c => c.why)]),
  t.slo.intro, t.slo.assumptions, t.slo.takeaway,
  t.recovery.intro, t.recovery.takeaway, t.access.assumptions, t.access.takeaway,
  ...t.ownership.points, t.ownership.takeaway,
  st.modes.intro, st.modes.takeaway, st.needs.takeaway,
  st.windows.intro, st.windows.assumptions, st.windows.takeaway,
  st.semantics.intro, st.semantics.assumptions, st.semantics.takeaway,
  ...compares.flatMap(c => [c.assumptions, ...c.options.flatMap(o => [o.verdict, ...o.rows.map(r => r[1])])]),
  ...mores.flatMap(m => m.html),
  ...explained.map(x => x.text),
  ...bridges.flatMap(b => [b.known, b.fresh, b.breaks]),
  ...pr.design.steps.flatMap(x => x.solution),
  ...pr.quiz.flatMap(q => [q.q, q.setup ?? '', q.why, ...q.options])
];

describe('lekcja Production Data Platform Design', () => {
  it('jest zarejestrowana, ma obszar z etykietą i pytania w banku dla każdego ćwiczonego zagadnienia', () => {
    expect(lessons.some(x => x.id === l.meta.id)).toBe(true);
    expect(AREA_LABEL[l.meta.area]).toBe('Platform Design');
    expect(l.meta.minutes).toBe(90);
    expect(l.interviewTopics[0]).toBe(l.meta.topicId);
    expect(l.interviewTopics.flatMap(topic => questions.filter(q => q.topicId === topic).map(q => q.id))).toEqual([
      'platform-design-end-to-end', 'platform-layered-architecture', 'platform-incremental-loading', 'platform-idempotent-pipelines',
      'platform-scalability-isolation', 'platform-data-reliability', 'platform-batch-vs-streaming'
    ]);
    expect(questions.filter(q => q.area === 'platform').length).toBe(7);
  });
  it('etap Interview nie dubluje banku', () => {
    expect('questionPl' in pr.interview).toBe(false);
    expect('followUps' in pr.interview).toBe(false);
  });
  it('treść przechodzi przez parser, a każde hasło istnieje w słowniku', () => {
    for (const html of rich) {
      expect(() => parseRich(html), html.slice(0, 60)).not.toThrow();
      for (const id of termIds(html)) expect(glossary[id], `hasło "${id}" w: ${html.slice(0, 60)}`).toBeDefined();
    }
  });
  it('każdy most mówi, gdzie analogia się kończy', () => {
    for (const b of bridges) for (const part of [b.known, b.fresh, b.breaks]) expect(words(part), b.from).toBeGreaterThanOrEqual(8);
  });
  it('porównania, pogłębienia i kod linia po linii są kompletne', () => {
    for (const c of compares) {
      expect(c.options.some(o => o.id === c.defaultId), c.label).toBe(true);
      expect(new Set(c.options.map(o => o.id)).size, c.label).toBe(c.options.length);
      // Te same cechy w każdej opcji, żeby przełączanie porównywało to samo.
      for (const o of c.options) expect(o.rows.map(r => r[0]), `${c.label}: ${o.id}`).toEqual(c.options[0].rows.map(r => r[0]));
    }
    for (const m of mores) expect(m.html.length, m.title).toBeGreaterThanOrEqual(2);
    for (const x of explained) expect(words(x.text), x.code).toBeGreaterThanOrEqual(8);
  });
  it('mapa architektury: każdy element ma komplet opisów', () => {
    const nodes = [...a.map.flow, ...a.map.cross];
    expect(a.map.flow.map(n => n.id)).toEqual(['sources', 'ingest', 'raw', 'stg', 'mrt', 'bi']);
    expect(new Set(nodes.map(n => n.id)).size).toBe(nodes.length);
    expect(nodes.some(n => n.id === a.map.defaultId)).toBe(true);
    for (const n of nodes) for (const text of [n.role, n.example, n.fails, n.decision]) expect(words(text), n.id).toBeGreaterThanOrEqual(8);
  });
  it('warstwy: liczby w opisach wynikają z przykładowych rekordów', () => {
    const [raw, stg, mrt] = a.layers.items;
    expect([raw.rows.length, stg.rows.length, mrt.rows.length]).toEqual([6, 5, 1]);
    for (const layer of a.layers.items) for (const r of layer.rows) expect(r.cells.length, layer.id).toBe(layer.columns.length);
    // STG: jeden wiersz na payment_id, jeden odłożony do kwarantanny. MRT: tylko udane i nie z konta testowego.
    const ids = stg.rows.map(r => r.cells[0]);
    expect(new Set(ids).size).toBe(ids.length);
    expect(stg.rows.filter(r => r.flag).length).toBe(1);
    const counted = stg.rows.filter(r => !r.flag && r.cells[3] === 'succeeded' && r.cells[1] !== 'c-test');
    expect(counted.map(r => r.cells[0])).toEqual(['p-101', 'p-102']);
    expect(counted.reduce((n, r) => n + Number(r.cells[2]), 0)).toBe(148);
    expect(mrt.rows[0].cells).toEqual(['2026-11-20', '2', '148.00']);
  });
  it('high-water mark: werdykty zgadzają się z modelem', () => {
    const run = (lookback: number, write: 'append' | 'merge') => hwmRuns(p.hwm.versions, p.hwm.runs, lookback, write, p.hwm.runs.length);
    const strict = run(0, 'append');
    expect(strict.reads.map(r => r.length)).toEqual([3, 2, 1]);
    expect([strict.missed, strict.duplicates, strict.targetRows]).toEqual([1, 0, 6]);
    expect(strict.status.s4).toBe('missed');
    expect(run(0, 'merge').missed).toBe(1);
    const lookback = run(p.hwm.lookbackMinutes, 'append');
    expect(lookback.reads.map(r => r.length)).toEqual([3, 5, 2]);
    expect([lookback.missed, lookback.duplicates]).toEqual([0, 3]);
    const safe = run(p.hwm.lookbackMinutes, 'merge');
    expect([safe.missed, safe.duplicates, safe.targetRows]).toEqual([0, 0, new Set(p.hwm.versions.map(v => v.key)).size]);
    // Przed pierwszym ładowaniem nic nie jest zgubione, a znacznik po pierwszym to 09:59.
    expect(hwmRuns(p.hwm.versions, p.hwm.runs, 0, 'append', 0).missed).toBe(0);
    expect(hwmRuns(p.hwm.versions, p.hwm.runs, 0, 'append', 1).mark).toBe(599);
    for (const w of p.hwm.windows) for (const x of p.hwm.writes) expect(p.hwm.verdicts[`${w.id}|${x.id}`], `${w.id}|${x.id}`).toBeDefined();
    for (const v of p.hwm.versions) {
      expect(v.visibleAt).toBeGreaterThanOrEqual(v.updatedAt);
      expect(v.updatedAt).toBeGreaterThan(p.hwm.axis[0]);
      expect(v.visibleAt).toBeLessThan(p.hwm.axis[1]);
    }
  });
  it('retry: liczby wierszy i sumy w werdyktach wynikają z modelu', () => {
    const state = (strategy: 'append' | 'overwrite' | 'merge', step: number) => {
      const rows = retryRows(p.retry.batch, p.retry.chunk, p.retry.chunksBeforeCrash, strategy, step);
      return [retryCount(rows), retryTotal(rows)];
    };
    expect(p.retry.batch.reduce((n, x) => n + x.amount, 0)).toBe(374);
    expect([0, 1, 2, 3].map(step => state('append', step))).toEqual([[0, 0], [4, 246], [10, 620], [16, 994]]);
    expect([0, 1, 2, 3].map(step => state('overwrite', step))).toEqual([[0, 0], [0, 0], [6, 374], [6, 374]]);
    expect([0, 1, 2, 3].map(step => state('merge', step))).toEqual([[0, 0], [4, 246], [6, 374], [6, 374]]);
    expect(p.retry.strategies.map(x => x.id)).toEqual(['append', 'overwrite', 'merge']);
    for (const x of p.retry.strategies) expect(x.verdicts.length, x.id).toBe(p.retry.steps.length - 1);
  });
  it('deduplikacja: tylko identyfikator zdarzenia daje prawdziwy przychód', () => {
    const total = (key: 'none' | 'natural' | 'event') => {
      const kept = dedupe(p.dedup.events, key);
      return p.dedup.events.filter(e => kept.includes(e.n)).reduce((n, e) => n + e.amount, 0);
    };
    expect(total('event')).toBe(p.dedup.expectedTotal);
    expect(total('none') - p.dedup.expectedTotal).toBe(148);
    expect(p.dedup.expectedTotal - total('natural')).toBe(49);
    expect(dedupe(p.dedup.events, 'event').length).toBe(5);
    expect(p.dedup.keys.map(k => k.id)).toEqual(['none', 'natural', 'event']);
  });
  it('backfill i orkiestracja: scenariusze są spójne', () => {
    expect(p.backfill.steps.length).toBe(4);
    for (const x of p.backfill.steps) {
      expect(x.correct, x.ask).toBeLessThan(x.options.length);
      expect(new Set(x.options).size, x.ask).toBe(x.options.length);
      expect(words(x.why), x.ask).toBeGreaterThanOrEqual(12);
    }
    expect(p.backfill.steps[p.backfill.steps.length - 1].days).toBe('verified');
    expect(p.backfill.affected.map(i => p.backfill.dayLabels[i])).toEqual(['18', '19', '20']);
    for (const c of p.dag.cases) {
      expect(c.status.length, c.id).toBe(p.dag.tasks.length);
      // Po pierwszym niepowodzeniu wszystko, co od niego zależy, jest pominięte.
      const failed = c.status.indexOf('fail');
      if (failed >= 0) expect(c.status.slice(failed + 1).every(x => x === 'skip'), c.id).toBe(true);
      else expect(c.status.every(x => x === 'ok'), c.id).toBe(true);
    }
  });
  it('skala: każdy przypadek ma wynik dla każdej zmiany, a rachunki się zgadzają', () => {
    for (const c of s.workload.cases) {
      expect(Object.keys(c.outcomes).sort(), c.id).toEqual(s.workload.fixes.map(f => f.id).sort());
      expect(Object.values(c.outcomes).filter(o => o.fit === 'good').length, c.id).toBe(1);
    }
    // Zdanie „większy warehouse wychodzi taniej": 30 min × 8 kredytów/h < 96 min × 4 kredyty/h.
    const cost = (minutes: number, rate: number) => (minutes / 60) * rate;
    expect(cost(s.heavy.baseMinutes, s.heavy.mediumRate)).toBeCloseTo(6.4, 6);
    expect(cost(s.heavy.biggerMinutes, s.heavy.largeRate)).toBeCloseTo(4, 6);
    const { users, eventsPerUser, bytesPerEvent, peakFactor } = s.capacity.inputs;
    const perDay = users * eventsPerUser;
    expect(perDay).toBe(80_000_000);
    expect((perDay * bytesPerEvent) / 1e9).toBe(40);
    expect((40 * 365) / 1000).toBeCloseTo(14.6, 6);
    expect(Math.round(perDay / 86_400 / 10) * 10).toBe(930);
    expect(Math.round((930 * peakFactor) / 100) * 100).toBe(2800);
    for (const r of s.capacity.rows) expect(r.length).toBe(s.capacity.columns.length);
  });
  it('zaufanie: incydenty, budżet błędów i role są spójne', () => {
    for (const i of t.incidents.items) expect(i.catches.length, i.id).toBe(t.incidents.mechanisms.length);
    // Żaden mechanizm nie łapie wszystkiego i każdy incydent ma choć jeden pewny sposób wykrycia.
    t.incidents.mechanisms.forEach((m, n) => expect(t.incidents.items.every(i => i.catches[n].by === 'yes'), m.id).toBe(false));
    for (const i of t.incidents.items) expect(i.catches.some(c => c.by === 'yes'), i.id).toBe(true);
    const allowed = t.slo.targets.map(x => Math.floor((t.slo.runsPerQuarter * (100 - x.pct)) / 100 + 1e-9));
    expect(allowed).toEqual([9, 4, 0, 0]);
    expect(t.slo.targets.some(x => x.pct === t.slo.defaultTarget)).toBe(true);
    for (const r of t.access.roles) for (const row of r.rows) expect(row.length, r.id).toBe(t.access.columns.length);
    expect(t.access.roles.map(r => r.rows.length)).toEqual([3, 2, 3]);
  });
  it('streaming: okna i gwarancje dostarczenia zgadzają się z modelem', () => {
    const w = st.windows;
    const count = (lateness: number) => windowCounts(w.events, 'event', lateness, w.windowMinutes).counts[0];
    expect(w.lateness.map(count)).toEqual([3, 4, 5]);
    expect(w.lateness.map(x => windowCounts(w.events, 'event', x, w.windowMinutes).readyAt)).toEqual([5, 10, 25]);
    const processing = windowCounts(w.events, 'processing', 0, w.windowMinutes).counts;
    expect(processing).toEqual({ 0: 3, 5: 1, 20: 1 });
    for (const x of w.lateness) expect(w.verdicts[`event|${x}`], String(x)).toBeDefined();
    const sem = st.semantics;
    expect(deliver(sem.events, sem.writtenBeforeCrash, 'most')).toEqual(['e-1', 'e-2']);
    expect(deliver(sem.events, sem.writtenBeforeCrash, 'least')).toEqual(['e-1', 'e-2', 'e-1', 'e-2', 'e-3']);
    expect(deliver(sem.events, sem.writtenBeforeCrash, 'exactly')).toEqual(['e-1', 'e-2', 'e-3']);
    expect(sem.options.map(o => o.id)).toEqual(['most', 'least', 'exactly']);
    // Każdy tryb jest dobrą odpowiedzią dokładnie raz, żeby ćwiczenie nie sugerowało rankingu.
    expect(st.needs.cases.map(c => c.correct).sort()).toEqual([0, 1, 2]);
  });
  it('scenariusze, zadanie projektowe i sprawdzian mają poprawne odpowiedzi oraz wyjaśnienia', () => {
    for (const c of scenarios) {
      expect(c.correct, c.setup).toBeLessThan(c.options.length);
      expect(new Set(c.options).size, c.setup).toBe(c.options.length);
      for (const text of [c.setup, c.why, c.scope]) expect(words(text), c.setup).toBeGreaterThanOrEqual(8);
    }
    expect(pr.failures.items.length).toBeGreaterThanOrEqual(4);
    for (const f of pr.failures.items) {
      expect(words(f.a), f.q).toBeGreaterThanOrEqual(55);
      expect(words(f.a), f.q).toBeLessThanOrEqual(140);
    }
    expect(pr.design.steps.map(x => x.id)).toEqual(['requirements', 'solution', 'tradeoffs']);
    expect(pr.design.minChars).toBeGreaterThanOrEqual(60);
    for (const x of pr.design.steps) expect(x.solution.length, x.id).toBeGreaterThanOrEqual(5);
    expect(pr.quiz.length).toBe(10);
    for (const q of pr.quiz) {
      expect(q.correct, q.q).toBeLessThan(q.options.length);
      expect(new Set(q.options).size, q.q).toBe(q.options.length);
      expect(words(q.why), q.q).toBeGreaterThanOrEqual(12);
    }
  });
});

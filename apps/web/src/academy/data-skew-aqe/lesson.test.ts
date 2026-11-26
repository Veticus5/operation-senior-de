import { describe, expect, it } from 'vitest';
import { labById, lessons, questions } from '@content/index';
import { glossary } from '@content/glossary';
import type { Bridge } from '@content/types';
import * as l from '@content/spark/data-skew-aqe/lesson';
import { parseRich, plainText, termIds } from '../../lib/richText';

const words = (text: string) => plainText(text).split(/\s+/).filter(Boolean).length;
const seconds = (s: l.SimScenario) => s.tasks.map(t => (t.rest + t.hot) * l.sim.secondsPerMillion);
const rows = (s: l.SimScenario) => s.tasks.reduce((n, t) => n + t.rest + t.hot, 0);
const scenario = (id: string) => l.sim.scenarios.find(s => s.id === id) as l.SimScenario;

const bridges: Bridge[] = [...l.beats.flatMap(b => (b.bridge ? [b.bridge] : [])), l.moves.bridge];
const rich: string[] = [
  ...l.beats.flatMap(b => [b.html, b.after ?? '', ...(b.more?.html ?? [])]),
  l.sim.intro, l.sim.assumptions, ...l.sim.takeaway, ...l.sim.simNotes, ...l.sim.measured,
  l.metrics.intro, l.metrics.takeaway, ...l.metrics.lines.map(x => x.text), ...l.metrics.nulls, ...l.metrics.other,
  ...l.moves.intro, l.moves.takeaway, ...l.moves.plan, ...l.moves.items.flatMap(m => [m.sees, m.does, m.measured, m.note]),
  l.limits.takeaway, ...l.limits.measured, ...l.limits.tune, ...l.limits.ops.map(o => o.why),
  l.salting.intro, l.salting.takeaway, ...l.salting.lines.map(x => x.text), ...l.salting.measured, ...l.salting.more,
  l.lab.intro, l.lab.note, l.troubleshoot.takeaway,
  ...l.quiz.flatMap(q => [q.q, q.why]),
  ...bridges.flatMap(b => [b.known, b.fresh, b.breaks])
];

describe('lekcja Data Skew & AQE', () => {
  it('jest zarejestrowana i ma pytania w banku dla każdego ćwiczonego zagadnienia', () => {
    expect(lessons.some(x => x.id === l.meta.id)).toBe(true);
    expect(l.meta.minutes).toBe(30);
    expect(l.interviewTopics[0]).toBe(l.meta.topicId);
    for (const topic of l.interviewTopics) expect(questions.some(q => q.topicId === topic), topic).toBe(true);
    expect(l.interviewTopics.flatMap(t => questions.filter(q => q.topicId === t).map(q => q.id))).toEqual(['spark-data-skew', 'spark-aqe', 'spark-salting', 'spark-slow-job']);
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
    expect(bridges.length).toBe(2);
    for (const b of bridges) for (const part of [b.known, b.fresh, b.breaks]) expect(words(part), b.from).toBeGreaterThanOrEqual(8);
  });
  it('wskazuje lab z rejestru', () => {
    expect(labById(l.labId)?.script).toBe('data_skew/skew_aqe_lab.py');
  });
  it('symulacja: każdy scenariusz liczy te same 16 mln wierszy i mieści się na osi', () => {
    expect(l.sim.scenarios.some(s => s.id === l.sim.defaultId)).toBe(true);
    expect(new Set(l.sim.scenarios.map(s => s.id)).size).toBe(l.sim.scenarios.length);
    for (const s of l.sim.scenarios) {
      expect(rows(s), s.id).toBeCloseTo(16, 6);
      expect(Math.max(...seconds(s)), s.id).toBeLessThanOrEqual(l.sim.scaleSeconds);
      expect(s.tasks.reduce((n, t) => n + t.hot, 0), s.id).toBeCloseTo(s.skewed ? 8.8 : 0, 6);
    }
  });
  it('symulacja: liczby w opisach wynikają z modelu', () => {
    expect(Math.max(...seconds(scenario('even')))).toBeCloseTo(20, 6);
    expect(Math.max(...seconds(scenario('skew')))).toBeCloseTo(97, 6);
    expect(Math.min(...seconds(scenario('skew')))).toBeCloseTo(9, 6);
    expect(Math.max(...seconds(scenario('more')))).toBeCloseTo(92.5, 6);
    expect(Math.max(...seconds(scenario('aqe')))).toBeCloseTo(19.4, 6);
    expect(scenario('aqe').tasks.length).toBe(12);
    // Więcej partycji nie rusza gorącego klucza: nadal siedzi w jednym tasku.
    expect(scenario('more').tasks.filter(t => t.hot > 0).length).toBe(1);
    expect(scenario('salt').tasks.every(t => t.hot > 0)).toBe(true);
  });
  it('granice AQE: przykładowe rozmiary pokrywają oba progi', () => {
    const ok = (mb: number) => mb > l.limits.factor * l.limits.medianMb && mb > l.limits.thresholdMb;
    expect(l.limits.sizes.map(s => ok(s.mb))).toEqual([false, true, true]);
    // 220 MB przechodzi próg 5 x mediana, ale nie 256 MB. Na tym stoi wniosek tej części.
    expect(220 > l.limits.factor * l.limits.medianMb && 220 < l.limits.thresholdMb).toBe(true);
    expect(l.limits.sizes.some(s => s.mb === l.limits.defaultSize)).toBe(true);
    expect(l.limits.ops.some(o => o.id === l.limits.defaultOp)).toBe(true);
    expect(l.limits.ops.filter(o => o.ok).map(o => o.id)).toEqual(['inner', 'left']);
  });
  it('scenariusze i sprawdzian mają poprawne odpowiedzi oraz wyjaśnienia', () => {
    expect(l.troubleshoot.cases.length).toBe(4);
    for (const c of l.troubleshoot.cases) {
      expect(c.correct, c.setup).toBeLessThan(c.options.length);
      expect(new Set(c.options).size, c.setup).toBe(c.options.length);
      for (const text of [c.setup, c.why, c.scope]) expect(words(text), c.setup).toBeGreaterThanOrEqual(8);
    }
    expect(l.quiz.length).toBe(7);
    for (const q of l.quiz) {
      expect(q.correct, q.q).toBeLessThan(q.options.length);
      expect(new Set(q.options).size, q.q).toBe(q.options.length);
      expect(words(q.why), q.q).toBeGreaterThanOrEqual(12);
    }
  });
  it('ilustracje mają komplet danych', () => {
    expect(l.metrics.cases.length).toBe(2);
    for (const c of l.metrics.cases) expect(c.rows.length).toBe(4);
    expect(l.moves.items.map(m => m.id)).toEqual(['coalesce', 'join', 'skew']);
    for (const r of l.lab.rows) expect(r.length).toBe(l.lab.columns.length);
    expect(l.keys.rows.reduce((n, r) => n + r.count, 0)).toBe(10_000_000);
  });
});

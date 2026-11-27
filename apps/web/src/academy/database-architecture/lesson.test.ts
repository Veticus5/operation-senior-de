import { describe, expect, it } from 'vitest';
import { AREA_LABEL, lessons, questions } from '@content/index';
import { glossary } from '@content/glossary';
import type { Bridge } from '@content/types';
import * as l from '@content/architecture/database-architecture/lesson';
import { parseRich, plainText, termIds } from '../../lib/richText';
import { scannedParts, storageCounts } from './Visuals';

const words = (text: string) => plainText(text).split(/\s+/).filter(Boolean).length;

const bridges: Bridge[] = [...l.beats.flatMap(b => (b.bridge ? [b.bridge] : [])), l.design.bridge, l.denormalization.bridge, l.keys.bridge, l.pruning.bridge, l.etl.bridge];
const rich: string[] = [
  ...l.beats.flatMap(b => [b.html, b.after ?? '', ...(b.more?.html ?? [])]),
  l.design.intro, l.design.takeaway, ...l.design.more,
  l.normalization.takeaway, ...l.normalization.more,
  l.denormalization.takeaway, ...l.denormalization.more,
  l.keys.intro, l.keys.takeaway, l.keys.testsIntro, ...l.keys.testsLines.map(x => x.text), ...l.keys.more,
  l.index.intro, l.index.takeaway, l.index.snowTakeaway, ...l.index.more,
  l.pruning.intro, l.pruning.takeaway, ...l.pruning.more,
  l.plans.intro, l.plans.takeaway, l.plans.profileIntro, l.plans.profileTakeaway, ...l.plans.lines.map(x => x.text), ...l.plans.more,
  l.acid.intro, l.acid.isoIntro, l.acid.takeaway, ...l.acid.more,
  l.architectures.takeaway, ...l.architectures.more,
  l.etl.takeaway, l.separation.takeaway, ...l.separation.more, l.choose.takeaway,
  ...l.quiz.flatMap(q => [q.q, q.why]),
  ...bridges.flatMap(b => [b.known, b.fresh, b.breaks])
];
const mine = questions.filter(q => q.area === 'architecture');

describe('lekcja Database & Data Architecture', () => {
  it('jest zarejestrowana, ma własny obszar i pytanie w banku dla każdego ćwiczonego zagadnienia', () => {
    expect(lessons.some(x => x.id === l.meta.id)).toBe(true);
    expect(AREA_LABEL[l.meta.area]).toBe('Data Architecture');
    expect(l.meta.minutes).toBe(60);
    expect(l.interviewTopics[0]).toBe(l.meta.topicId);
    expect(new Set(l.interviewTopics).size).toBe(l.interviewTopics.length);
    for (const topic of l.interviewTopics) expect(questions.filter(q => q.topicId === topic).length, topic).toBe(1);
    expect(mine.map(q => q.topicId)).toEqual(l.interviewTopics);
  });
  it('etap Interview nie dubluje banku', () => {
    expect('questionPl' in l.interview).toBe(false);
    expect('followUps' in l.interview).toBe(false);
    expect(l.interview.recall.length).toBe(8);
    for (const r of l.interview.recall) expect(r.points.length, r.prompt).toBeGreaterThanOrEqual(3);
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
  it('odpowiedzi mówione nie zawierają uproszczeń o Snowflake, na których łatwo się potknąć', () => {
    const banned = [/snowflake (has|have) no indexes/i, /snowflake nie ma indeksów\./i, /only not null is enforced/i, /snowflake (has|have) no constraints/i, /constraints are enforced in snowflake/i];
    for (const q of mine) {
      const spoken = [q.answer.pl, q.answer.en, q.senior?.pl ?? '', q.senior?.en ?? '', ...q.followUps.map(f => f.a)];
      for (const text of spoken) for (const pattern of banned) expect(pattern.test(text), `${q.id}: ${pattern}`).toBe(false);
    }
  });
  it('zapis wierszowy i kolumnowy: liczniki wynikają z modelu', () => {
    expect(storageCounts('point', 'row')).toEqual({ total: 30, need: 5, read: 5, blocks: 1 });
    expect(storageCounts('point', 'column')).toEqual({ total: 30, need: 5, read: 30, blocks: 5 });
    expect(storageCounts('agg', 'row')).toEqual({ total: 30, need: 12, read: 30, blocks: 6 });
    expect(storageCounts('agg', 'column')).toEqual({ total: 30, need: 12, read: 12, blocks: 2 });
    for (const r of l.storage.rows) expect(r.length).toBe(l.storage.columns.length);
    expect(l.storage.queries.some(q => q.id === l.storage.defaultQuery)).toBe(true);
  });
  it('normalizacja: każdy krok ma spójne tabele, a liczby denormalizacji wynikają z danych', () => {
    expect(l.normalization.steps.map(s => s.id)).toEqual(['raw', '1nf', '2nf', '3nf']);
    for (const s of l.normalization.steps) for (const t of s.tables) {
      for (const r of t.rows) expect(r.length, `${s.id}/${t.name}`).toBe(t.columns.length);
      for (const c of [...t.key, ...(t.flag ?? [])]) expect(t.columns, `${s.id}/${t.name}`).toContain(c);
      // Klucz główny jest unikalny w danych przykładu.
      const idx = t.key.map(k => t.columns.indexOf(k));
      expect(new Set(t.rows.map(r => idx.map(i => r[i]).join('|'))).size, `${s.id}/${t.name}`).toBe(t.rows.length);
    }
    const last = l.normalization.steps[3];
    expect(last.tables.every(t => !t.flag?.length)).toBe(true);
    const lines = last.tables.find(t => t.name === 'order_lines')!.rows;
    const orders = last.tables.find(t => t.name === 'orders')!.rows;
    const customers = last.tables.find(t => t.name === 'customers')!.rows;
    const [norm, wide] = l.denormalization.variants;
    expect(norm.cityCopies).toBe(customers.length);
    expect(wide.cityCopies).toBe(lines.length);
    // Anna (C7): tyle pozycji trzeba poprawić w szerokiej tabeli.
    const annaOrders = orders.filter(o => o[1] === 'C7').map(o => o[0]);
    expect(wide.rowsToUpdate).toBe(lines.filter(x => annaOrders.includes(x[0])).length);
    expect(norm.rowsToUpdate).toBe(1);
    expect((norm.sql.match(/JOIN/g) ?? []).length).toBe(norm.joins);
    expect((wide.sql.match(/JOIN/g) ?? []).length).toBe(wide.joins);
  });
  it('klucze: wynik dla każdego silnika zgadza się z dokumentacją', () => {
    const ok = (attempt: string, engine: string) => l.keys.attempts.find(a => a.id === attempt)!.outcome[engine].ok;
    for (const a of l.keys.attempts) expect(Object.keys(a.outcome).sort()).toEqual(l.keys.engines.map(e => e.id).sort());
    // Tabela standardowa Snowflake przyjmuje duplikat klucza i sierotę, odrzuca NULL w kolumnie NOT NULL.
    expect([ok('duplicate', 'standard'), ok('orphan', 'standard'), ok('null', 'standard')]).toEqual([true, true, false]);
    for (const e of ['postgres', 'hybrid']) expect(l.keys.attempts.map(a => ok(a.id, e))).toEqual([false, false, false]);
  });
  it('indeks: model stron jest spójny z opisem', () => {
    const c = (id: string) => l.index.cases.find(x => x.id === id)!;
    expect(c('equal').pages).toBe(l.index.treeHeight + 1);
    for (const x of l.index.cases) expect(x.pages, x.id).toBe(x.uses === 'scan' ? l.index.tablePages : x.pages);
    expect(l.index.cases.filter(x => x.uses === 'scan').map(x => x.id)).toEqual(['broad', 'suffix', 'function']);
    expect(c('range').pages).toBeLessThan(l.index.tablePages / 100);
    for (const r of l.index.snowRows) expect(r.length).toBe(l.index.snowColumns.length);
  });
  it('pruning: liczba czytanych mikropartycji wynika z zakresów', () => {
    const count = (layout: string, filter: string) => scannedParts(layout, filter).filter(Boolean).length;
    expect(count('byDate', 'march')).toBe(1);
    expect(count('byDate', 'customer')).toBe(8);
    expect(count('mixed', 'march')).toBe(7);
    expect(count('mixed', 'customer')).toBe(8);
    expect(count('byCustomer', 'march')).toBe(8);
    expect(count('byCustomer', 'customer')).toBe(1);
    for (const lay of l.pruning.layouts) expect(lay.parts.length, lay.id).toBe(8);
    for (const r of l.pruning.compareRows) expect(r.length).toBe(l.pruning.compareColumns.length);
  });
  it('izolacja: tabela anomalii zgadza się ze standardem SQL (PostgreSQL, tabela 13.1)', () => {
    expect(l.acid.levels.map(x => [x.dirty, x.nonRepeatable, x.phantom])).toEqual([
      [true, true, true], [false, true, true], [false, false, true], [false, false, false]
    ]);
    expect(l.acid.levels.some(x => x.id === l.acid.defaultLevel)).toBe(true);
    expect(l.acid.letters.map(x => x.letter).join('')).toBe('ACID');
  });
  it('architektura: ilustracje mają komplet danych', () => {
    expect(l.architectures.items.map(a => a.id)).toEqual(['warehouse', 'lake', 'lakehouse']);
    for (const a of l.architectures.items) {
      expect(a.layers.length, a.id).toBe(3);
      expect(a.facts.map(f => f[0]), a.id).toEqual(l.architectures.factLabels);
    }
    // ETL i ELT różnią się wyłącznie kolejnością kroków; transformacja jest wyróżniona w obu.
    for (const v of l.etl.variants) {
      expect(v.steps.map(s => s.name[0]).join(''), v.id).toBe(v.label);
      expect(v.steps.filter(s => s.hot).map(s => s.name), v.id).toEqual(['Transform']);
    }
    expect(l.separation.variants.map(v => v.compute.length)).toEqual([3, 3]);
    for (const r of l.plans.profileRows) expect(r.length).toBe(l.plans.profileColumns.length);
    expect(l.plans.lines.length).toBe(5);
  });
  it('scenariusze i sprawdzian mają poprawne odpowiedzi oraz wyjaśnienia', () => {
    expect(l.choose.cases.length).toBe(5);
    for (const c of l.choose.cases) {
      expect(c.correct, c.setup).toBeLessThan(c.options.length);
      expect(new Set(c.options).size, c.setup).toBe(c.options.length);
      for (const text of [c.setup, c.why, c.scope]) expect(words(text), c.setup).toBeGreaterThanOrEqual(8);
    }
    expect(l.quiz.length).toBe(10);
    for (const q of l.quiz) {
      expect(q.correct, q.q).toBeLessThan(q.options.length);
      expect(new Set(q.options).size, q.q).toBe(q.options.length);
      expect(words(q.why), q.q).toBeGreaterThanOrEqual(12);
    }
  });
});

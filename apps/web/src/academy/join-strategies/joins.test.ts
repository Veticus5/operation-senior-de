import { describe, expect, it } from 'vitest';
import { labById, lessons, questions } from '@content/index';
import { glossary } from '@content/glossary';
import * as j from '@content/spark/join-strategies/lesson';
import { parseRich, plainText, termIds } from '../../lib/richText';
import { bill, buildScene, formatSize, shufflePartition, whereIs } from './scene';

const words = (text: string) => plainText(text).split(/\s+/).filter(Boolean).length;
const STRATEGIES: j.StrategyId[] = ['bhj', 'smj', 'shj'];

/** Wszystkie fragmenty lekcji 04, które przechodzą przez komponent Html. */
const rich: string[] = [
  ...j.beats.flatMap(b => [b.html, b.after ?? '', ...(b.more?.html ?? []), ...(b.bridge ? [b.bridge.known, b.bridge.fresh, b.bridge.breaks] : [])]),
  j.sim.assumptions, ...j.sim.takeaway, ...j.sim.notes,
  j.sizes.assumptions, j.sizes.takeaway, ...j.sizes.limits, ...j.sizes.shjNotes,
  j.plans.scope, j.plans.data, j.plans.pick, j.plans.takeaway, j.plans.versionNote,
  ...j.plans.items.flatMap(p => [p.how, ...p.lines.map(l => l.text)]),
  j.choosing.intro, ...j.choosing.order, ...j.choosing.stats, ...j.choosing.types, ...j.choosing.databricks,
  ...j.choosing.experiments.flatMap(e => [e.ask, e.setup, e.scope, ...e.notes, ...(e.explainers ?? []).flatMap(x => x.lines.map(l => l.text))]),
  ...j.scenarios.cases.flatMap(s => [s.setup, s.why, s.scope]), j.scenarios.takeaway,
  ...j.quiz.flatMap(q => [q.q, q.why])
];

describe('lekcja 04: join strategies, treść', () => {
  it('jest zarejestrowana i ma w banku dwa pytania o tym samym topicId', () => {
    expect(lessons.some(l => l.id === j.meta.id)).toBe(true);
    expect(j.meta.minutes).toBeGreaterThanOrEqual(25);
    expect(j.meta.minutes).toBeLessThanOrEqual(30);
    expect(questions.filter(q => q.topicId === j.meta.topicId).map(q => q.id)).toEqual(['spark-broadcast-join', 'spark-join-strategies']);
  });
  it('nie dubluje banku: etap Interview nie ma własnych pytań ani odpowiedzi', () => {
    expect('questionPl' in j.interview).toBe(false);
    expect('followUps' in j.interview).toBe(false);
    for (const id of j.interview.related) expect(questions.some(q => q.id === id), id).toBe(true);
  });
  it('wszystkie fragmenty przechodzą przez parser, a użyte hasła są w słowniku', () => {
    for (const html of rich) {
      expect(() => parseRich(html), html.slice(0, 60)).not.toThrow();
      for (const id of termIds(html)) expect(glossary[id], `hasło "${id}" w: ${html.slice(0, 60)}`).toBeDefined();
    }
  });
  it('most mówi, gdzie analogia się kończy', () => {
    const bridges = j.beats.flatMap(b => (b.bridge ? [b.bridge] : []));
    expect(bridges.length).toBeGreaterThanOrEqual(1);
    for (const b of bridges) for (const part of [b.known, b.fresh, b.breaks]) expect(words(part), b.from).toBeGreaterThanOrEqual(8);
  });
  it('lab lekcji jest w rejestrze', () => {
    expect(labById(j.labId)).toBeDefined();
    expect(questions.find(q => q.id === 'spark-join-strategies')?.labIds).toEqual([j.labId]);
  });
  it('eksperymenty podają założenia, wydruk z labu i zakres wyniku', () => {
    expect(j.choosing.experiments.length).toBe(3);
    for (const e of j.choosing.experiments) {
      expect(e.correct, e.ask).toBeLessThan(e.choices.length);
      expect(words(e.setup), e.ask).toBeGreaterThanOrEqual(12);
      expect(words(e.scope), e.ask).toBeGreaterThanOrEqual(12);
      expect(e.output.length, e.ask).toBeGreaterThan(60);
    }
  });
  it('scenariusze i sprawdzian mają poprawne odpowiedzi oraz wyjaśnienia', () => {
    expect(j.scenarios.cases.length).toBe(4);
    for (const s of j.scenarios.cases) {
      expect(s.correct, s.setup).toBeLessThan(s.options.length);
      expect(new Set(s.options).size, s.setup).toBe(s.options.length);
      for (const text of [s.setup, s.why, s.scope]) expect(words(text), s.setup).toBeGreaterThanOrEqual(12);
    }
    expect(j.quiz.length).toBe(6);
    for (const q of j.quiz) {
      expect(q.correct, q.q).toBeLessThan(q.options.length);
      expect(new Set(q.options).size, q.q).toBe(q.options.length);
      expect(words(q.why), q.q).toBeGreaterThanOrEqual(12);
    }
    // Poprawna odpowiedź nie stoi zawsze na tym samym miejscu.
    expect(new Set(j.quiz.map(q => q.correct)).size).toBeGreaterThan(1);
  });
  it('plany: każda strategia ma swój plan, a jego kształt zgadza się z opisem „jak rozpoznać strategię"', () => {
    expect(j.plans.items.map(p => p.id)).toEqual(STRATEGIES);
    const count = (id: j.StrategyId, needle: string) => j.plans.items.find(p => p.id === id)!.lines.filter(l => l.code.includes(needle)).length;
    expect([count('bhj', 'BroadcastExchange'), count('bhj', 'Exchange hashpartitioning'), count('bhj', ' Sort ')]).toEqual([1, 0, 0]);
    expect([count('smj', 'BroadcastExchange'), count('smj', 'Exchange hashpartitioning'), count('smj', ' Sort ')]).toEqual([0, 2, 2]);
    expect([count('shj', 'BroadcastExchange'), count('shj', 'Exchange hashpartitioning'), count('shj', ' Sort ')]).toEqual([0, 2, 0]);
    for (const p of j.plans.items) for (const l of p.lines) expect(words(l.text), l.code).toBeGreaterThanOrEqual(8);
  });
});

describe('lekcja 04: symulacja krok po kroku', () => {
  it('każda strategia ma cztery kroki i opis licznika', () => {
    for (const s of STRATEGIES) {
      expect(j.sim.steps[s].length, s).toBe(4);
      expect(words(j.sim.counters.notes[s]), s).toBeGreaterThanOrEqual(8);
    }
    expect(j.sim.strategies.map(s => s.id)).toEqual(STRATEGIES);
  });
  it('żaden krok nie gubi ani nie dubluje wierszy', () => {
    for (const s of STRATEGIES) for (let step = 0; step < 4; step++) {
      const scene = buildScene(s, step);
      expect(scene.boxes.flatMap(b => b.tx.map(t => t.txn)).sort(), `${s}/${step}`).toEqual(j.sample.transactions.map(t => t.txn).sort());
      expect(scene.boxes.flatMap(b => b.cust.map(c => c.id)).sort(), `${s}/${step}`).toEqual(j.sample.customers.map(c => c.id).sort());
    }
  });
  it('broadcast nie przenosi transakcji, a kopia customers trafia do drivera i każdego executora', () => {
    for (let step = 0; step < 4; step++) {
      for (const box of buildScene('bhj', step).boxes) for (const t of box.tx) expect(j.sample.transactions.find(x => x.txn === t.txn)?.exec).toBe(box.index);
    }
    expect(buildScene('bhj', 1).driver?.length).toBe(j.sample.customers.length);
    expect(buildScene('bhj', 2).boxes.every(b => b.broadcast?.length === j.sample.customers.length)).toBe(true);
    expect(buildScene('bhj', 3).counters).toEqual([0, 0, 3]);
  });
  it('po shuffle\'u ten sam klucz z obu tabel leży w tej samej partycji', () => {
    for (const s of ['smj', 'shj'] as const) for (let step = 1; step < 4; step++) {
      for (const box of buildScene(s, step).boxes) {
        expect(box.kind).toBe('partition');
        for (const t of box.tx) expect(shufflePartition(t.customer)).toBe(box.index);
        for (const t of box.tx) expect(box.cust.some(c => c.id === t.customer), `${s}/${step}/${t.txn}`).toBe(true);
      }
    }
    expect(buildScene('smj', 3).counters).toEqual([10, 2, 0]);
    expect(buildScene('shj', 3).counters).toEqual([10, 0, 0]);
  });
  it('sort merge sortuje obie strony, shuffled hash żadnej', () => {
    for (const box of buildScene('smj', 2).boxes) {
      expect(box.tx.map(t => t.customer)).toEqual([...box.tx.map(t => t.customer)].sort((a, b) => a - b));
      expect(box.custState).toBe('sorted');
    }
    expect(buildScene('shj', 2).boxes.every(b => b.custState === 'hash' && !b.txSorted)).toBe(true);
  });
  it('w ostatnim kroku każda transakcja ma kraj swojego klienta', () => {
    for (const s of STRATEGIES) for (const box of buildScene(s, 3).boxes) for (const t of box.tx) {
      expect(t.country, `${s}/${t.txn}`).toBe(j.sample.customers.find(c => c.id === t.customer)?.country);
    }
  });
  it('ilustracja z etapu Intuicja: większość klientów ma wiersze na różnych executorach', () => {
    const split = j.sample.customers.filter(c => { const w = whereIs(c.id); return !(w.tx.length === 1 && w.tx[0] === w.cust); });
    expect(split.length).toBeGreaterThanOrEqual(3);
    expect(whereIs(101)).toEqual({ tx: [0, 1], cust: 1 });
  });
});

describe('lekcja 04: rachunek rozmiarów', () => {
  it('wartości domyślne są na listach, a każdy rozmiar customers ma werdykt', () => {
    expect(j.sizes.customersMb).toContain(j.sizes.defaultCustomersMb);
    expect(j.sizes.transactionsMb).toContain(j.sizes.defaultTransactionsMb);
    expect(j.sizes.bhj.verdicts.length).toBe(j.sizes.customersMb.length);
  });
  it('liczby wpisane w werdykty wynikają z założeń ilustracji', () => {
    const [small, medium, large, huge] = j.sizes.customersMb;
    // „8 MB to mniej niż domyślny próg 10 MB", „300 MB to więcej".
    expect(small).toBeLessThan(10);
    expect(medium).toBeGreaterThan(10);
    // „Po sieci jedzie 80 GB kopii".
    expect(formatSize(bill(large, j.sizes.transactionsMb[0]).broadcastNet)).toBe('80 GB');
    expect(j.sizes.bhj.verdicts[2].text).toContain('80 GB');
    expect(j.sizes.bhj.verdicts[2].text).toContain(`${j.sizes.executors} executorów`);
    // Limit 8 GB: tylko największy rozmiar go przekracza.
    expect(large).toBeLessThan(8 * 1024);
    expect(huge).toBeGreaterThanOrEqual(8 * 1024);
    expect(j.sizes.bhj.verdicts.map(v => v.state)).toEqual(['ok', 'risk', 'risk', 'no']);
  });
  it('porównanie sieci ma oba przypadki: broadcast wysyła raz mniej, raz więcej niż shuffle', () => {
    const outcomes = j.sizes.customersMb.flatMap(c => j.sizes.transactionsMb.map(t => { const b = bill(c, t); return b.broadcastNet > b.shuffleNet; }));
    expect(outcomes).toContain(true);
    expect(outcomes).toContain(false);
  });
  it('formatuje rozmiary czytelnie', () => {
    expect(formatSize(0.04)).toBe('41 kB');
    expect(formatSize(300)).toBe('300 MB');
    expect(formatSize(4096)).toBe('4 GB');
    expect(formatSize(256.04)).toBe('256 MB');
    expect(formatSize(2764.8)).toBe('2,7 GB');
    expect(formatSize(552960)).toBe('540 GB');
  });
});

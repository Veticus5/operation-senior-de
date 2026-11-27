import { describe, expect, it } from 'vitest';
import { labById, labs, lessons, questions } from '@content/index';
import { glossary } from '@content/glossary';
import type { Bridge } from '@content/types';
import { beats, experiments, interview, labId, mechanism, plans, pushdown, simNotes, tasks } from '@content/spark/lazy-evaluation/lesson';
import * as fundamentals from '@content/spark/fundamentals/lesson';
import * as execution from '@content/spark/execution-architecture/lesson';
import * as partitioning from '@content/spark/partitioning-shuffle/lesson';
import { LAB_SOURCES } from './lib/labSources';
import { parseRich, plainText, termIds } from './lib/richText';

const words = (text: string) => plainText(text).split(/\s+/).filter(Boolean).length;

/** Wszystkie fragmenty lekcji, które przechodzą przez komponent Html. */
/** Lekcja 00 (Spark Fundamentals): mosty i wszystkie fragmenty HTML. */
const f = fundamentals;
const fundamentalsBridges: Bridge[] = [...f.beats.flatMap(b => (b.bridge ? [b.bridge] : [])), f.cluster.bridge, f.dataframe.bridge, f.stack.bridge];
const fundamentalsRich: string[] = [
  ...f.beats.flatMap(b => [b.html, b.after ?? '', ...(b.more?.html ?? [])]),
  f.fit.assumptions,
  f.cluster.intro, f.cluster.assumptions, ...f.cluster.takeaway, ...f.cluster.simNotes, ...f.cluster.measured, ...f.cluster.failure, ...f.cluster.collect, ...f.cluster.where,
  f.dataframe.intro, f.dataframe.takeaway, ...f.dataframe.lines.map(l => l.text),
  ...f.stack.places.map(p => p.text), f.stack.takeaway, ...f.stack.python,
  f.choose.takeaway, ...f.choose.more.html,
  ...f.quiz.flatMap(q => [q.q, q.why])
];
/** Lekcja 02 (Spark Execution Architecture): mosty i wszystkie fragmenty HTML. */
const x = execution;
const executionScenarios = x.flow.queries.flatMap(q => [q.off, q.on]);
const executionBridges: Bridge[] = x.beats.flatMap(b => (b.bridge ? [b.bridge] : []));
const executionRich: string[] = [
  ...x.beats.flatMap(b => [b.html, b.after ?? '', ...(b.more?.html ?? [])]),
  x.chain.assumptions, ...x.session.lines.map(l => l.text),
  x.flow.intro, x.flow.assumptions, x.flow.idle, ...x.flow.takeaway, ...x.flow.simNotes, ...x.flow.boundary, ...x.flow.scheduling,
  ...Object.values(x.flow.roles).flatMap(r => [r.input, r.output]),
  ...executionScenarios.flatMap(s => [...s.steps.map(st => st.say), ...s.jobs.flatMap(j => [j.why, ...j.stages.flatMap(st => [st.tasksWhy, st.output ?? ''])])]),
  x.dag.takeaway, ...x.dag.more,
  x.plans.intro, x.plans.takeaway, ...x.plans.views.map(v => v.text), ...x.plans.physical.map(l => l.text), ...x.plans.star, ...x.plans.catalyst, ...x.plans.aqe,
  x.practice.scope, ...x.practice.ui,
  ...x.practice.experiments.flatMap(e => [e.setup, e.ask, e.scope, ...e.notes, ...(e.more?.html ?? [])]),
  ...x.quiz.flatMap(q => [q.q, q.why])
];
/** Lekcja 03 (Partitioning & Shuffle): mosty i wszystkie fragmenty HTML. */
const ps = partitioning;
const partitioningBridges: Bridge[] = [...ps.beats.flatMap(b => (b.bridge ? [b.bridge] : [])), ps.sizing.bridge];
const partitioningRich: string[] = [
  ...ps.beats.flatMap(b => [b.html, b.after ?? '', ...(b.more?.html ?? [])]),
  ps.sim.assumptions, ps.sim.counters.shuffle, ps.sim.counters.stages, ps.sim.counters.tasks, ...ps.sim.takeaway, ...ps.sim.notes, ...ps.sim.ways,
  ps.cost.takeaway, ...ps.cost.ui, ...ps.cost.partial, ...ps.cost.avoid,
  ps.plan.intro, ps.plan.takeaway, ...ps.plan.stage, ...ps.plan.lines.map(l => l.text),
  ps.sizing.intro, ...Object.values(ps.sizing.labels), ...ps.sizing.takeaway, ...ps.sizing.aqe,
  ps.choose.takeaway, ps.choose.filesNote, ...ps.choose.hints,
  ...ps.experiments.flatMap(e => [e.ask, e.setup, e.scope, ...e.notes, ...(e.more?.html ?? [])]),
  ...ps.quiz.flatMap(q => [q.q, q.setup ?? '', q.why, ...q.options])
];
const lessonBridges: Bridge[] = [...beats.flatMap(b => (b.bridge ? [b.bridge] : [])), ...experiments.flatMap(e => (e.bridge ? [e.bridge] : [])), pushdown.bridge, ...fundamentalsBridges, ...executionBridges, ...partitioningBridges];
const lessonRich: string[] = [
  ...beats.flatMap(b => [b.html, ...(b.more?.html ?? [])]),
  mechanism.takeaway,
  ...simNotes,
  ...pushdown.intro,
  pushdown.assumptions,
  ...pushdown.takeaway,
  ...pushdown.measured,
  ...pushdown.plan,
  ...experiments.flatMap(e => [e.ask, e.setup, e.scope, e.output ?? '', ...e.notes, ...(e.more?.html ?? []), ...(e.explainers ?? []).flatMap(x => x.lines.map(l => l.text))]),
  ...lessonBridges.flatMap(b => [b.known, b.fresh, b.breaks]),
  ...labs.map(l => l.scope),
  ...fundamentalsRich,
  ...executionRich,
  ...partitioningRich
];

describe('baza pytań', () => {
  it('ma unikalne identyfikatory', () => {
    const ids = questions.map(q => q.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
  it('nie zmieniła identyfikatorów, na których wisi zapisany postęp', () => {
    expect(questions.map(q => q.id)).toEqual([
      'spark-architecture-basics', 'spark-vs-pandas-warehouse',
      'spark-transformations-actions', 'spark-narrow-wide-shuffle', 'spark-job-stage-task', 'spark-session-vs-context', 'spark-query-plans', 'spark-slow-job', 'spark-data-skew', 'spark-aqe',
      'spark-salting', 'spark-broadcast-join', 'spark-join-strategies', 'spark-repartition-coalesce', 'delta-acid-log', 'delta-merge-idempotency', 'delta-optimize-vacuum',
      'delta-liquid-clustering', 'delta-change-data-feed', 'delta-medallion', 'databricks-bundles-cicd', 'databricks-unity-catalog', 'databricks-structured-streaming',
      'arch-oltp-olap', 'arch-normalization', 'arch-keys-integrity', 'arch-indexes', 'arch-partition-pruning', 'arch-query-optimization', 'arch-acid-isolation',
      'arch-warehouse-lake-lakehouse', 'arch-etl-elt', 'arch-storage-compute', 'arch-choose-architecture',
      'snowflake-architecture-layers', 'snowflake-micro-partitions-pruning', 'snowflake-clustering', 'snowflake-caching', 'snowflake-scaling',
      'snowflake-slow-query', 'snowflake-cost-control', 'snowflake-streams-tasks', 'snowflake-time-travel-cloning', 'snowflake-access-sharing'
    ]);
  });
  it('każde pytanie jest kompletne w obu językach', () => {
    for (const q of questions) {
      for (const text of [q.question.pl, q.question.en, q.answer.pl, q.answer.en]) expect(text.length, q.id).toBeGreaterThan(20);
      if (q.senior) for (const text of [q.senior.pl, q.senior.en]) expect(text.length, q.id).toBeGreaterThan(20);
      expect(q.keywords.length, q.id).toBeGreaterThan(0);
      expect(q.followUps.length, q.id).toBeGreaterThanOrEqual(3);
      expect(q.mistakes.length, q.id).toBeGreaterThanOrEqual(2);
      expect(q.topicId, q.id).toMatch(/^[a-z]+\.[a-z-]+$/);
    }
  });
  it('odpowiedź mieści się w 30–60 sekundach mówienia (ok. 55–140 słów)', () => {
    for (const q of questions) for (const text of [q.answer.pl, q.answer.en]) {
      const n = text.split(/\s+/).length;
      expect(n, q.id).toBeGreaterThanOrEqual(55);
      expect(n, q.id).toBeLessThanOrEqual(140);
    }
  });
  it('wersje PL i EN odpowiedzi są podobnej długości, czyli żadna nie zgubiła zastrzeżenia', () => {
    for (const q of questions) {
      const ratio = q.answer.pl.split(/\s+/).length / q.answer.en.split(/\s+/).length;
      expect(ratio, q.id).toBeGreaterThan(0.6);
      expect(ratio, q.id).toBeLessThan(1.15);
    }
  });
  it('każde pytanie ma lekkie wyjaśnienie mechanizmu: 2–5 akapitów, najwyżej 300 słów', () => {
    for (const q of questions) {
      expect(q.explain.length, q.id).toBeGreaterThanOrEqual(2);
      expect(q.explain.length, q.id).toBeLessThanOrEqual(5);
      const total = q.explain.reduce((n, p) => n + words(p), 0);
      expect(total, q.id).toBeGreaterThanOrEqual(90);
      expect(total, q.id).toBeLessThanOrEqual(300);
    }
  });
  it('odpowiedzi mówione nie zawierają uproszczeń poprawionych w review MVP (issue #1)', () => {
    // Pole `mistakes` celowo cytuje błędne zdania, więc nie jest sprawdzane.
    const banned = [
      /nothing is remembered between actions/i, /między akcjami nic nie jest pamiętane/i,
      /grows forever/i, /rośnie bez końca\.$/i,
      /force it with a hint/i, /wymusić hintem/i,
      /runs both automatically/i, /robi automatycznie predictive/i,
      /always be reprocessed/i, /raw data is never lost/i,
      /same idea under different names/i,
      /write intermediate results as shuffle files/i,
      /nothing runs until an action/i, /do akcji nic się nie wykonuje/i
    ];
    for (const q of questions) {
      const spoken = [q.answer.pl, q.answer.en, q.senior?.pl ?? '', q.senior?.en ?? '', ...q.followUps.map(f => f.a)];
      for (const text of spoken) for (const pattern of banned) expect(pattern.test(text), `${q.id}: ${pattern}`).toBe(false);
    }
  });
});

describe('słownik i treść z hasłami', () => {
  it('definicje są krótkie i nie odsyłają do innych haseł', () => {
    for (const [id, entry] of Object.entries(glossary)) {
      expect(id, id).toMatch(/^[a-z-]+$/);
      expect(entry.def.split(/\s+/).length, id).toBeLessThanOrEqual(45);
      expect(entry.def, id).not.toMatch(/</);
    }
  });
  it('cała treść przechodzi przez parser, a każde użyte hasło istnieje w słowniku', () => {
    const all = [...lessonRich, ...questions.flatMap(q => q.explain)];
    for (const html of all) {
      expect(() => parseRich(html), html.slice(0, 60)).not.toThrow();
      for (const id of termIds(html)) expect(glossary[id], `hasło "${id}" w: ${html.slice(0, 60)}`).toBeDefined();
    }
  });
  it('każdy most mówi, gdzie analogia się kończy', () => {
    expect(lessonBridges.length).toBeGreaterThanOrEqual(3);
    for (const b of lessonBridges) {
      expect(b.from.length, b.from).toBeGreaterThan(2);
      for (const part of [b.known, b.fresh, b.breaks]) expect(words(part), b.from).toBeGreaterThanOrEqual(8);
    }
  });
});

describe('lekcje', () => {
  it('mają unikalne id i topicId', () => {
    expect(new Set(lessons.map(l => l.id)).size).toBe(lessons.length);
    expect(new Set(lessons.map(l => l.topicId)).size).toBe(lessons.length);
  });
  it('każda lekcja ma co najmniej jedno powiązane pytanie', () => {
    for (const l of lessons) expect(questions.some(q => q.topicId === l.topicId), l.id).toBe(true);
  });
  it('kolejność nauki: Fundamentals, Lazy Evaluation, Execution Architecture, Partitioning & Shuffle, Join Strategies, Data Skew & AQE, Database & Data Architecture, Snowflake Architecture', () => {
    expect(lessons.map(l => l.id)).toEqual(['spark-fundamentals', 'spark-lazy-evaluation', 'spark-execution-architecture', 'spark-partitioning-shuffle', 'spark-join-strategies', 'spark-data-skew-aqe', 'database-architecture', 'snowflake-architecture-performance']);
  });
  it('partitioning & shuffle: dane symulacji są spójne z opisem i z liczbami z labu', () => {
    const { orders, sim, inputPartitions, rowsPerPartition } = ps;
    expect(orders.length).toBe(inputPartitions * rowsPerPartition);
    expect(orders.map(o => o.id)).toEqual(orders.map((_, i) => i + 1));
    const part = (i: number) => Math.floor(i / rowsPerPartition);
    const op = (id: string) => sim.ops.find(o => o.id === id)!;
    expect(sim.ops.map(o => o.id)).toContain(sim.defaultOp);
    for (const o of sim.ops) {
      expect(o.steps.length, o.id).toBeGreaterThanOrEqual(3);
      // Shuffle to granica stage'a: operacja wide ma dwa stage'e, narrow jeden i zero rekordów w shuffle'u.
      expect(o.lab.stages, o.id).toBe(o.kind === 'wide' ? 2 : 1);
      expect(o.lab.tasks.length, o.id).toBe(o.lab.stages);
      expect(o.lab.tasks[0], o.id).toBe(o.id === 'coalesce' ? o.outPartitions : inputPartitions);
      expect(o.lab.tasks[o.lab.tasks.length - 1], o.id).toBe(o.outPartitions);
      if (o.kind === 'narrow') expect(o.lab.shuffleRecords, o.id).toBe(0);
    }
    // groupBy: do shuffle'u trafia jedna suma częściowa na parę (partycja wejścia, kraj).
    const pairs = new Set(orders.map((o, i) => `${part(i)}|${o.country}`)).size;
    expect(op('groupBy').lab.shuffleRecords).toBe(pairs);
    expect(pairs).toBe(10);
    expect(op('repartitionKey').lab.shuffleRecords).toBe(orders.length);
    expect(op('repartition').lab.shuffleRecords).toBe(orders.length);
    // Hash: każdy kraj ma jedną partycję docelową w zakresie 0..3. Round-robin: każdy wiersz dokładnie raz, równo.
    for (const o of orders) expect(sim.hashTarget[o.country]).toBeLessThan(op('repartitionKey').outPartitions);
    expect(sim.roundRobin.flat().sort((a, b) => a - b)).toEqual(orders.map(o => o.id));
    expect(new Set(sim.roundRobin.map(ids => ids.length))).toEqual(new Set([3]));
    expect(sim.coalesceGroups.flat().sort()).toEqual([0, 1, 2]);
    expect(sim.coalesceGroups.length).toBe(op('coalesce').outPartitions);
    // Liczby w opisach: po filtrze 3, 3 i 2 wiersze; PL w trzech partycjach wejścia, sumy częściowe 160, 120 i 50.
    const kept = [0, 1, 2].map(p => orders.filter((o, i) => part(i) === p && o.amount >= sim.minAmount).length);
    expect(kept).toEqual([3, 3, 2]);
    const pl = [0, 1, 2].map(p => orders.filter((o, i) => part(i) === p && o.country === 'PL').reduce((n, o) => n + o.amount, 0));
    expect(pl).toEqual([160, 120, 50]);
    const sizes = [0, 1, 2, 3].map(t => orders.filter(o => sim.hashTarget[o.country] === t).length);
    expect(sizes).toEqual([2, 2, 5, 3]);
  });
  it('partitioning & shuffle: ilustracja liczby partycji, eksperymenty i sprawdzian są kompletne', () => {
    expect(ps.beats.length).toBe(3);
    expect(ps.peek.correct).toBeLessThan(ps.peek.options.length);
    expect(ps.cost.steps.length).toBe(4);
    expect(ps.sizing.verdicts.length).toBe(ps.sizing.options.length);
    expect(ps.sizing.options).toContain(ps.sizing.defaultOption);
    // Werdykty cytują rozmiary: 25 GB, 250 MB i 2,5 MB muszą wynikać z liczb ilustracji.
    expect(ps.sizing.options.map(n => (ps.sizing.totalGb * 1000) / n)).toEqual([25000, 250, 2.5]);
    expect(ps.plan.lines.length).toBe(5);
    expect(ps.experiments.length).toBe(5);
    for (const e of ps.experiments) {
      expect(e.correct, e.ask).toBeLessThan(e.choices.length);
      expect(words(e.setup), e.ask).toBeGreaterThanOrEqual(8);
      expect(words(e.scope), e.ask).toBeGreaterThanOrEqual(8);
      expect(e.output.length, e.ask).toBeGreaterThan(40);
    }
    expect(ps.quiz.length).toBe(6);
    for (const q of ps.quiz) {
      expect(q.correct, q.q).toBeLessThan(q.options.length);
      expect(new Set(q.options).size, q.q).toBe(q.options.length);
      expect(words(q.why), q.q).toBeGreaterThanOrEqual(12);
    }
  });
  it('partitioning & shuffle: etap Interview nie dubluje banku i bierze z niego dwa pytania', () => {
    expect('questionPl' in ps.interview).toBe(false);
    expect('followUps' in ps.interview).toBe(false);
    expect(questions.filter(q => q.topicId === ps.meta.topicId).map(q => q.id)).toEqual(['spark-narrow-wide-shuffle']);
    for (const id of ps.relatedQuestionIds) expect(questions.some(q => q.id === id), id).toBe(true);
  });
  it('spark fundamentals: ilustracje są spójne z opisem', () => {
    expect(f.beats.length).toBe(3);
    expect(f.fit.verdicts.length).toBe(f.fit.sizes.length);
    expect(f.fit.sizes).toContain(f.fit.defaultSize);
    // Werdykt „ponad 6 razy większy" musi wynikać z liczb ilustracji.
    expect(Math.max(...f.fit.sizes) / f.fit.ramGb).toBeGreaterThan(6);
    expect(f.cluster.executors).toContain(f.cluster.defaultExecutors);
    expect(f.cluster.partitions).toContain(f.cluster.defaultPartitions);
    expect(f.stack.places.some(p => p.id === f.stack.defaultPlace)).toBe(true);
  });
  it('spark fundamentals: scenariusze i sprawdzian mają poprawne odpowiedzi oraz wyjaśnienia', () => {
    expect(f.choose.cases.length).toBe(3);
    // Każde narzędzie jest dobrą odpowiedzią dokładnie raz, żeby ćwiczenie nie sugerowało rankingu.
    expect(f.choose.cases.map(c => c.correct).sort()).toEqual([0, 1, 2]);
    for (const c of f.choose.cases) for (const text of [c.setup, c.why, c.scope]) expect(words(text), c.setup).toBeGreaterThanOrEqual(8);
    expect(f.quiz.length).toBe(5);
    for (const q of f.quiz) {
      expect(q.correct, q.q).toBeLessThan(q.options.length);
      expect(new Set(q.options).size, q.q).toBe(q.options.length);
      expect(words(q.why), q.q).toBeGreaterThanOrEqual(12);
    }
  });
  it('spark fundamentals: etap Interview nie dubluje banku i ma dwa pytania z banku', () => {
    expect('questionPl' in f.interview).toBe(false);
    expect('followUps' in f.interview).toBe(false);
    expect(questions.filter(q => q.topicId === f.meta.topicId).map(q => q.id)).toEqual(['spark-architecture-basics', 'spark-vs-pandas-warehouse']);
  });
  it('execution architecture: liczby symulatora zgadzają się z labem (docs/verified-facts.md)', () => {
    const totals = (id: string, mode: 'off' | 'on') => {
      const jobs = x.flow.queries.find(q => q.id === id)![mode].jobs;
      const done = jobs.flatMap(j => j.stages).filter(s => !s.skipped);
      return [jobs.length, done.length, done.reduce((n, s) => n + s.tasks, 0)];
    };
    expect(totals('a', 'off')).toEqual([1, 1, 4]);
    expect(totals('a', 'on')).toEqual([1, 1, 4]);
    expect(totals('b', 'off')).toEqual([1, 2, 204]);
    expect(totals('b', 'on')).toEqual([2, 2, 5]);
    expect(totals('c', 'off')).toEqual([1, 4, 406]);
    expect(totals('c', 'on')).toEqual([4, 4, 8]);
    // Pierwszy krok lekcji cytuje wariant bez AQE i bez broadcastu oraz wariant z ustawieniami domyślnymi.
    expect(x.chain.rows.map(r => r.values)).toEqual([[1, ...totals('c', 'off')], [1, 3, 3, 7]]);
    expect(x.dag.nodes.map(n => n.tasks)).toEqual(x.flow.queries.find(q => q.id === 'c')!.off.jobs[0].stages.map(s => s.tasks));
  });
  it('execution architecture: każdy wariant symulatora jest spójny', () => {
    expect(x.flow.queries.some(q => q.id === x.flow.defaultQuery)).toBe(true);
    for (const s of executionScenarios) {
      const stages = s.jobs.flatMap(j => j.stages);
      expect(new Set(stages.map(st => st.id)).size).toBe(stages.length);
      for (const st of stages) expect(x.flow.roles[st.role], st.role).toBeDefined();
      // Każdy wykonany stage jest liczony w dokładnie jednym kroku, a pominięty w żadnym.
      const ran = s.steps.flatMap(step => step.run);
      expect([...ran].sort((a, b) => a - b)).toEqual(stages.filter(st => !st.skipped).map(st => st.id).sort((a, b) => a - b));
      expect(s.steps[s.steps.length - 1].run).toEqual([]);
    }
  });
  it('execution architecture: plany, eksperymenty i sprawdzian są kompletne', () => {
    expect(x.beats.length).toBe(3);
    expect(x.plans.views.map(v => v.id)).toEqual(['parsed', 'analyzed', 'optimized', 'physical']);
    expect(x.plans.views.some(v => v.id === x.plans.defaultView)).toBe(true);
    // Jeden Exchange w planie fizycznym, czyli dwa stage'e: to samo mówi wniosek i symulator.
    expect(x.plans.physical.filter(l => l.code.includes('Exchange hashpartitioning')).length).toBe(1);
    for (const e of x.practice.experiments) {
      expect(e.correct, e.ask).toBeLessThan(e.choices.length);
      expect(words(e.setup), e.ask).toBeGreaterThanOrEqual(8);
      expect(words(e.scope), e.ask).toBeGreaterThanOrEqual(8);
      expect(e.output.length, e.ask).toBeGreaterThan(20);
    }
    expect(x.quiz.length).toBe(7);
    for (const q of x.quiz) {
      expect(q.correct, q.q).toBeLessThan(q.options.length);
      expect(new Set(q.options).size, q.q).toBe(q.options.length);
      expect(words(q.why), q.q).toBeGreaterThanOrEqual(12);
    }
  });
  it('execution architecture: etap Interview nie dubluje banku i ma trzy pytania z banku', () => {
    expect('questionPl' in x.interview).toBe(false);
    expect('followUps' in x.interview).toBe(false);
    expect(questions.filter(q => q.topicId === x.meta.topicId).map(q => q.id)).toEqual(['spark-job-stage-task', 'spark-session-vs-context', 'spark-query-plans']);
  });
  it('lazy evaluation: treść jest kompletna', () => {
    expect(beats.length).toBe(5);
    expect(experiments.length).toBe(5);
    for (const e of experiments) expect(e.correct).toBeLessThan(e.choices.length);
    expect(tasks.clickLine.lines.length).toBe(tasks.clickLine.why.length);
    expect(tasks.findCause.lines.length).toBe(tasks.findCause.why.length);
    expect(tasks.predict.correct).toBeLessThan(tasks.predict.options.length);
  });
  it('lazy evaluation: każdy eksperyment podaje założenia przed pytaniem i zakres wyniku po nim', () => {
    for (const e of experiments) {
      expect(words(e.setup), e.ask).toBeGreaterThanOrEqual(8);
      expect(words(e.scope), e.ask).toBeGreaterThanOrEqual(8);
      expect(Boolean(e.output) || Boolean(e.explainers?.length), e.ask).toBe(true);
    }
  });
  it('lazy evaluation: ilustracja row groups zgadza się z opisem w issue (dwie z czterech grup pominięte dla amount > 1000)', () => {
    expect(pushdown.sorted.map(g => g.max)).toEqual([400, 850, 1800, 5000]);
    expect(pushdown.sorted.filter(g => g.max <= pushdown.defaultFilter).length).toBe(2);
    expect(pushdown.scattered.filter(g => g.max <= pushdown.defaultFilter).length).toBe(0);
  });
  it('lazy evaluation: etap Interview nie dubluje banku, a pełna wersja ma PL i EN', () => {
    expect('questionPl' in interview).toBe(false);
    expect('followUps' in interview).toBe(false);
    expect(interview.long.en.split(/\s+/).length).toBeGreaterThan(150);
    expect(interview.long.pl.split(/\s+/).length).toBeGreaterThan(130);
  });
  it('symulator ma plan dla każdej kombinacji operacji i akcji', () => {
    const seqs = ['', 'f', 's', 'g', 'f>s', 's>f', 'f>g', 's>g', 'f>s>g', 's>f>g'];
    for (const s of seqs) for (const a of ['show', 'count']) expect(plans[`${s}|${a}`], `${s}|${a}`).toBeDefined();
  });
});

describe('laby uruchamiane z interfejsu', () => {
  it('nie zmieniły identyfikatorów, którymi wiążą się lekcje i pytania', () => {
    expect(labs.map(l => l.id)).toEqual(['spark-lazy-evaluation-lab', 'spark-execution-architecture-lab', 'spark-partitioning-shuffle-lab', 'spark-join-strategies-lab', 'spark-data-skew-aqe-lab']);
  });
  it('każdy lab ma opis, zakres wyniku i kod do pokazania', () => {
    for (const l of labs) {
      expect(l.id, l.id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
      expect(l.script, l.id).toMatch(/^[a-z0-9_/]+\.py$/);
      expect(words(l.summary), l.id).toBeGreaterThanOrEqual(8);
      expect(words(l.scope), l.id).toBeGreaterThanOrEqual(12);
      expect(l.timeoutSec, l.id).toBeGreaterThan(0);
      expect(LAB_SOURCES[l.id]?.length ?? 0, l.id).toBeGreaterThan(100);
    }
    expect(Object.keys(LAB_SOURCES).sort()).toEqual(labs.map(l => l.id).sort());
  });
  it('lekcje i pytania wskazują tylko laby z rejestru', () => {
    expect(labById(labId)).toBeDefined();
    expect(labById(x.labId)).toBeDefined();
    expect(labById(ps.labId)).toBeDefined();
    for (const q of questions) for (const id of q.labIds ?? []) expect(labById(id), `${q.id}: ${id}`).toBeDefined();
    expect(questions.filter(q => q.labIds?.length).map(q => q.id)).toEqual(['spark-transformations-actions', 'spark-narrow-wide-shuffle', 'spark-job-stage-task', 'spark-session-vs-context', 'spark-query-plans', 'spark-join-strategies', 'spark-repartition-coalesce']);
  });
  it('pytanie i lekcja o lazy evaluation prowadzą do tego samego labu', () => {
    const q = questions.find(x => x.topicId === 'spark.lazy-evaluation');
    expect(q?.labIds).toEqual([labId]);
  });
});

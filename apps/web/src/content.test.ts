import { describe, expect, it } from 'vitest';
import { lessons, questions } from '@content/index';
import { glossary } from '@content/glossary';
import type { Bridge } from '@content/types';
import { beats, experiments, interview, mechanism, plans, pushdown, simNotes, tasks } from '@content/spark/lazy-evaluation/lesson';
import * as fundamentals from '@content/spark/fundamentals/lesson';
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
const lessonBridges: Bridge[] = [...beats.flatMap(b => (b.bridge ? [b.bridge] : [])), ...experiments.flatMap(e => (e.bridge ? [e.bridge] : [])), pushdown.bridge, ...fundamentalsBridges];
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
  ...fundamentalsRich
];

describe('baza pytań', () => {
  it('ma unikalne identyfikatory', () => {
    const ids = questions.map(q => q.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
  it('nie zmieniła identyfikatorów, na których wisi zapisany postęp', () => {
    expect(questions.map(q => q.id)).toEqual([
      'spark-architecture-basics', 'spark-vs-pandas-warehouse',
      'spark-transformations-actions', 'spark-narrow-wide-shuffle', 'spark-job-stage-task', 'spark-slow-job', 'spark-data-skew', 'spark-aqe',
      'spark-salting', 'spark-broadcast-join', 'spark-repartition-coalesce', 'delta-acid-log', 'delta-merge-idempotency', 'delta-optimize-vacuum',
      'delta-liquid-clustering', 'delta-change-data-feed', 'delta-medallion', 'databricks-bundles-cicd', 'databricks-unity-catalog', 'databricks-structured-streaming'
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
      /write intermediate results as shuffle files/i
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
  it('kolejność nauki: Spark Fundamentals jest przed Lazy Evaluation', () => {
    expect(lessons.map(l => l.id)).toEqual(['spark-fundamentals', 'spark-lazy-evaluation']);
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

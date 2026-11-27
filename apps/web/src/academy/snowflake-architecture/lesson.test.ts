import { describe, expect, it } from 'vitest';
import { lessons, questions } from '@content/index';
import { glossary } from '@content/glossary';
import type { Bridge } from '@content/types';
import * as l from '@content/snowflake/architecture/lesson';
import { parseRich, plainText, termIds } from '../../lib/richText';
import { credits, inherited, mustScan } from './Visuals';

const words = (text: string) => plainText(text).split(/\s+/).filter(Boolean).length;

const bridges: Bridge[] = [...l.beats.flatMap(b => (b.bridge ? [b.bridge] : [])), l.prune.bridge, l.clustering.bridge, l.stream.bridge];
/** Wszystkie fragmenty, które przechodzą przez komponent Html. */
const rich: string[] = [
  ...l.beats.flatMap(b => [b.html, b.after ?? '', ...(b.more?.html ?? [])]),
  ...l.prune.intro, l.prune.assumptions, ...l.prune.takeaway, ...l.prune.notes, ...l.prune.columnar, ...l.prune.dml,
  ...l.clustering.intro, l.clustering.takeaway, ...l.clustering.key, ...l.clustering.cost,
  ...l.cache.takeaway, ...l.cache.rules, ...l.cache.suspend,
  ...l.profiles.intro, l.profiles.takeaway, ...l.profiles.list, ...l.profiles.time, ...l.profiles.lines.map(x => x.text),
  l.scale.intro, ...l.scale.takeaway, ...l.scale.resize, ...l.scale.multi, ...l.scale.qas,
  ...l.caseStudy.intro, l.caseStudy.takeaway, ...l.caseStudy.steps.map(s => s.more),
  ...l.cost.intro, l.cost.takeaway, ...l.cost.monitor, ...l.cost.budget, ...l.cost.storage, ...l.cost.levers,
  ...l.stream.intro, ...l.stream.takeaway, ...l.stream.lines.map(x => x.text), ...l.stream.risks, ...l.stream.types, ...l.stream.dynamic,
  l.history.takeaway, ...l.history.detail, l.history.cloneTakeaway, ...l.history.cloneMore,
  ...l.access.intro, l.access.takeaway, ...l.access.admin, ...l.access.tenantNotes, ...l.access.share,
  ...l.quiz.flatMap(q => [q.q, q.why]),
  ...bridges.flatMap(b => [b.known, b.fresh, b.breaks])
];

const layout = (id: string) => l.prune.layouts.find(x => x.id === id) as l.PruneLayout;
const filter = (id: string) => l.prune.filters.find(x => x.id === id) as l.PruneFilter;
const scanned = (layoutId: string, filterId: string) => layout(layoutId).parts.filter(p => mustScan(p, filter(filterId))).length;

describe('lekcja Snowflake Architecture & Performance Engineering', () => {
  it('jest zarejestrowana i ma pytania w banku dla każdego ćwiczonego zagadnienia', () => {
    expect(lessons.some(x => x.id === l.meta.id)).toBe(true);
    expect(l.meta.minutes).toBe(60);
    expect(l.meta.area).toBe('snowflake');
    expect(l.interviewTopics[0]).toBe(l.meta.topicId);
    expect(l.interviewTopics.flatMap(t => questions.filter(q => q.topicId === t).map(q => q.id))).toEqual(questions.filter(q => q.area === 'snowflake').map(q => q.id));
    expect(questions.filter(q => q.area === 'snowflake').length).toBe(10);
  });
  it('etap Interview nie dubluje banku', () => {
    expect('questionPl' in l.interview).toBe(false);
    expect('followUps' in l.interview).toBe(false);
    expect(l.interview.compare.every(r => r.length === l.interview.compareColumns.length)).toBe(true);
    expect(l.interview.myths.length).toBeGreaterThanOrEqual(6);
  });
  it('szkielet własnej opowieści zostawia szczegóły do uzupełnienia, zamiast je zmyślać', () => {
    for (const text of [l.interview.storyEn, l.interview.storyPl]) {
      expect(text).toMatch(/96/);
      expect(text).toMatch(/128/);
      expect(text).toMatch(/30/);
      expect((text.match(/\[/g) ?? []).length).toBeGreaterThanOrEqual(6);
    }
    // Studium przypadku nie podaje konfiguracji ani oszczędności: żadnych rozmiarów warehouse'u i procentów.
    const study = [...l.caseStudy.intro, ...l.caseStudy.steps.flatMap(s => [s.text, s.more]), l.caseStudy.takeaway].join(' ');
    expect(study).not.toMatch(/X-Small|Small|Medium|Large|%/);
    expect(l.caseStudy.steps.length).toBe(6);
  });
  it('treść przechodzi przez parser, a każde hasło istnieje w słowniku', () => {
    for (const html of rich) {
      expect(() => parseRich(html), html.slice(0, 60)).not.toThrow();
      for (const id of termIds(html)) expect(glossary[id], `hasło "${id}" w: ${html.slice(0, 60)}`).toBeDefined();
    }
  });
  it('każdy most mówi, gdzie analogia się kończy', () => {
    expect(bridges.length).toBe(4);
    for (const b of bridges) for (const part of [b.known, b.fresh, b.breaks]) expect(words(part), b.from).toBeGreaterThanOrEqual(8);
  });
  it('architektura: każda operacja opisuje cloud services, a wynik z cache i operacja metadanowa nie używają warehouse\'u', () => {
    expect(l.layers.ops.some(o => o.id === l.layers.defaultOp)).toBe(true);
    for (const o of l.layers.ops) expect(words(o.services), o.id).toBeGreaterThanOrEqual(8);
    expect(l.layers.ops.filter(o => !o.compute).map(o => o.id)).toEqual(['repeat', 'meta']);
  });
  it('pruning: liczby mikropartycji wynikają z modelu', () => {
    expect(l.prune.layouts.some(x => x.id === l.prune.defaultLayout)).toBe(true);
    expect(l.prune.filters.some(x => x.id === l.prune.defaultFilter)).toBe(true);
    for (const x of l.prune.layouts) {
      expect(x.parts.length, x.id).toBe(8);
      for (const p of x.parts) for (const [lo, hi] of [p.date, p.cust]) expect(lo, x.id).toBeLessThanOrEqual(hi);
    }
    // Ładowanie chronologiczne: data przycina, klient nie. Klastrowanie po kliencie: odwrotnie.
    expect([scanned('load', 'day'), scanned('load', 'range'), scanned('load', 'cust')]).toEqual([1, 2, 8]);
    expect([scanned('clustered', 'day'), scanned('clustered', 'range'), scanned('clustered', 'cust')]).toEqual([8, 8, 1]);
    // Po backfillach 14 stycznia trafia w trzy mikropartycje: na tym stoi wyjaśnienie clustering depth.
    expect([scanned('churn', 'day'), scanned('churn', 'range'), scanned('churn', 'cust')]).toEqual([3, 4, 8]);
    // Predykat z podzapytaniem nie przycina w żadnym ułożeniu.
    for (const x of l.prune.layouts) expect(scanned(x.id, 'sub'), x.id).toBe(8);
  });
  it('skalowanie: kredyty i werdykty zgadzają się z modelem', () => {
    const outcome = (w: string, a: string) => l.scale.workloads.find(x => x.id === w)!.outcomes.find(o => o.action === a)!;
    for (const w of l.scale.workloads) {
      expect(w.outcomes.map(o => o.action), w.id).toEqual(l.scale.actions.map(a => a.id));
      for (const o of w.outcomes) expect(l.scale.sizes.find(s => s[0] === o.size)?.[1], `${w.id}/${o.action}`).toBe(o.rate);
    }
    // Ciężkie zapytanie: scale up szybciej i taniej, scale out bez zmian.
    expect(credits(outcome('heavy', 'none'))).toBeCloseTo(4, 6);
    expect(credits(outcome('heavy', 'up'))).toBeCloseTo(16 / 6, 6);
    expect(outcome('heavy', 'none').minutes / outcome('heavy', 'up').minutes).toBe(6);
    expect(credits(outcome('heavy', 'out'))).toBe(credits(outcome('heavy', 'none')));
    // Współbieżność: scale up cztery razy drożej bez zysku, scale out ten sam koszt i trzy razy szybciej.
    expect(credits(outcome('many', 'up')) / credits(outcome('many', 'none'))).toBeCloseTo(4, 6);
    expect(outcome('many', 'up').minutes).toBe(outcome('many', 'none').minutes);
    expect(credits(outcome('many', 'out'))).toBeCloseTo(credits(outcome('many', 'none')), 6);
    for (const a of ['none', 'up', 'out']) expect(outcome('many', a).waves.reduce((n, x) => n + x, 0), a).toBe(24);
    // Stawki podwajają się z każdym rozmiarem.
    l.scale.sizes.forEach(([, rate], i) => expect(rate).toBe(2 ** i));
  });
  it('koszty: resource monitor nie widzi serverless ani storage, budżet nie widzi storage', () => {
    expect(l.cost.items.some(x => x.id === l.cost.defaultItem)).toBe(true);
    expect(l.cost.items.filter(x => x.monitor).map(x => x.id)).toEqual(['runaway', 'services']);
    expect(l.cost.items.filter(x => !x.budget).map(x => x.id)).toEqual(['storage']);
    for (const x of l.cost.items) expect(words(x.why), x.id).toBeGreaterThanOrEqual(12);
  });
  it('retencja i klony: okresy z dokumentacji i spójny schemat mikropartycji', () => {
    expect(l.history.types.map(t => [t.travel, t.failsafe])).toEqual([[1, 7], [90, 7], [1, 0]]);
    expect(l.history.types.some(t => t.id === l.history.defaultType)).toBe(true);
    expect(l.history.steps.some(s => s.id === l.history.defaultStep)).toBe(true);
    const total = (id: string) => { const s = l.history.steps.find(x => x.id === id)!; return new Set([...s.source, ...s.clone]).size; };
    expect([total('clone'), total('cloneWrite'), total('sourceWrite')]).toEqual([4, 5, 6]);
  });
  it('role: dziedziczenie w przykładowej hierarchii', () => {
    expect(l.access.roles.some(r => r.id === l.access.defaultRole)).toBe(true);
    for (const r of l.access.roles) for (const id of r.inherits) expect(l.access.roles.some(x => x.id === id), `${r.id} -> ${id}`).toBe(true);
    expect(inherited('analyst').map(r => r.id)).toEqual(['sales_read']);
    expect(inherited('engineer').map(r => r.id)).toEqual(['sales_write', 'sales_read']);
    expect(inherited('sysadmin').map(r => r.id).sort()).toEqual(['analyst', 'engineer', 'sales_read', 'sales_write']);
    for (const r of l.access.tenants) expect(r.length).toBe(l.access.tenantColumns.length);
  });
  it('scenariusze i sprawdzian mają poprawne odpowiedzi oraz wyjaśnienia', () => {
    expect(l.clustering.cases.length).toBe(3);
    expect(l.profiles.cases.length).toBe(4);
    // Większy warehouse jest właściwym pierwszym krokiem dokładnie w jednym scenariuszu diagnozy.
    expect(l.profiles.cases.filter(c => /większy warehouse/i.test(c.options[c.correct])).map(c => c.id)).toEqual(['spill']);
    for (const c of [...l.clustering.cases, ...l.profiles.cases]) {
      expect(c.correct, c.setup).toBeLessThan(c.options.length);
      expect(new Set(c.options).size, c.setup).toBe(c.options.length);
      for (const text of [c.setup, c.why, c.scope]) expect(words(text), c.setup).toBeGreaterThanOrEqual(8);
    }
    for (const c of l.profiles.cases) expect(c.stats.length, c.id).toBe(4);
    expect(l.quiz.length).toBe(10);
    for (const q of l.quiz) {
      expect(q.correct, q.q).toBeLessThan(q.options.length);
      expect(new Set(q.options).size, q.q).toBe(q.options.length);
      expect(words(q.why), q.q).toBeGreaterThanOrEqual(12);
    }
  });
  it('sprawdzian: rachunek z pytania o Large i X-Large', () => {
    expect((8 * 40) / 60).toBeCloseTo((16 * 20) / 60, 6);
    expect((8 * 40) / 60).toBeCloseTo(5.33, 2);
  });
});

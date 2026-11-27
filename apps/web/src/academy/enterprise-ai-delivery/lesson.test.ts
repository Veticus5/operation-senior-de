import { describe, expect, it } from 'vitest';
import { AREA_LABEL, lessons, questions } from '@content/index';
import { glossary } from '@content/glossary';
import type { Bridge } from '@content/types';
import * as l from '@content/delivery/enterprise-ai-delivery/lesson';
import { parseRich, plainText, termIds } from '../../lib/richText';
import { model, pipelineStatus, reconcile } from './logic';

const words = (text: string) => plainText(text).split(/\s+/).filter(Boolean).length;

const bridges: Bridge[] = [...l.beats.flatMap(b => (b.bridge ? [b.bridge] : [])), l.environments.bridge, l.levels.bridge, l.boundaries.bridge];
const explained = [...l.requirements.criteriaLines, ...l.adr.lines, ...l.boundaries.lines, ...l.review.pythonLines];
/** Wszystkie fragmenty, które przechodzą przez komponent Html. */
const rich: string[] = [
  ...l.beats.flatMap(b => [b.html, b.after ?? '', ...(b.more?.html ?? [])]),
  l.requirements.intro, l.requirements.takeaway, ...l.requirements.more, l.requirements.criteriaIntro, l.requirements.criteriaTakeaway,
  l.environments.intro, l.environments.takeaway, ...l.environments.iac,
  l.adr.takeaway, ...l.adr.more,
  l.pipeline.intro, l.pipeline.takeaway, ...l.pipeline.more,
  l.release.takeaway, ...l.release.more,
  l.teamwork.takeaway, ...l.teamwork.debt, ...l.teamwork.agile,
  l.levels.takeaway,
  l.recon.intro, l.recon.takeaway, ...l.recon.more, ...l.recon.tools,
  l.incremental.intro, l.incremental.takeaway, ...l.incremental.more,
  l.verify.takeaway,
  l.flow.intro, l.flow.takeaway, ...l.flow.more,
  l.boundaries.takeaway, ...l.boundaries.more,
  l.review.takeaway, ...l.review.checklist,
  l.permissions.intro, l.permissions.takeaway, ...l.permissions.more,
  l.security.takeaway, ...l.security.more, ...l.security.cases.map(c => c.why),
  l.accountability.takeaway,
  ...explained.map(x => x.text),
  ...l.quiz.flatMap(q => [q.q, q.why]),
  ...bridges.flatMap(b => [b.known, b.fresh, b.breaks])
];
const mine = questions.filter(q => q.area === 'delivery');

describe('lekcja Enterprise SDLC & AI-Assisted Engineering', () => {
  it('jest zarejestrowana, ma własny obszar i pytanie w banku dla każdego ćwiczonego zagadnienia', () => {
    expect(lessons.some(x => x.id === l.meta.id)).toBe(true);
    expect(AREA_LABEL[l.meta.area]).toBe('Delivery & AI');
    expect(l.meta.minutes).toBe(45);
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
    expect(l.interview.story.length).toBe(5);
  });
  it('treść przechodzi przez parser, a każde hasło istnieje w słowniku', () => {
    for (const html of rich) {
      expect(() => parseRich(html), html.slice(0, 60)).not.toThrow();
      for (const id of termIds(html)) expect(glossary[id], `hasło "${id}" w: ${html.slice(0, 60)}`).toBeDefined();
    }
  });
  it('każdy most mówi, gdzie analogia się kończy', () => {
    expect(bridges.length).toBe(3);
    for (const b of bridges) for (const part of [b.known, b.fresh, b.breaks]) expect(words(part), b.from).toBeGreaterThanOrEqual(8);
  });
  it('treść i odpowiedzi nie zawierają szczegółów prywatnych ani zmyślonych metryk', () => {
    const all = JSON.stringify(l) + JSON.stringify(mine);
    for (const pattern of [/formula ?5/i, /ai champion/i, /cleeng/i]) expect(pattern.test(all), String(pattern)).toBe(false);
    // Odpowiedzi mówione: bez procentów przyspieszenia i bez „zmierzyłem".
    for (const q of mine) {
      const spoken = [q.answer.pl, q.answer.en, q.senior?.pl ?? '', q.senior?.en ?? '', ...q.followUps.map(f => f.a)];
      for (const text of spoken) for (const pattern of [/\d+ ?%/, /\d+x faster/i, /I measured/i, /zmierzyłem/i]) expect(pattern.test(text), `${q.id}: ${pattern}`).toBe(false);
    }
  });
  it('odpowiedzi mówione nie obiecują, że instrukcja albo zielone CI coś gwarantuje', () => {
    const banned = [/the agent (will )?always follows?/i, /agent zawsze przestrzega/i, /green ci (means|proves) (the code|it) is correct/i, /ai is accountable/i, /prompt injection is (solved|impossible)/i];
    for (const q of mine) {
      const spoken = [q.answer.pl, q.answer.en, q.senior?.pl ?? '', q.senior?.en ?? '', ...q.followUps.map(f => f.a)];
      for (const text of spoken) for (const pattern of banned) expect(pattern.test(text), `${q.id}: ${pattern}`).toBe(false);
    }
  });
  it('uzgodnienie: model przed zmianą wynika z danych przykładu', () => {
    for (const o of l.example.orders) expect(o.length).toBe(l.example.orderColumns.length);
    for (const p of l.example.promos) expect(p.length).toBe(l.example.promoColumns.length);
    // Zamówienie 104 ma dwa kody: to jedyne źródło fan-outu w przykładzie.
    const perOrder = new Map<number, number>();
    for (const [id] of l.example.promos) perOrder.set(id, (perOrder.get(id) ?? 0) + 1);
    expect([...perOrder].filter(([, n]) => n > 1)).toEqual([[104, 2]]);
    expect(model('before')).toEqual([
      { date: '03-01', orders: 2, revenue: 200, promoOrders: null },
      { date: '03-02', orders: 1, revenue: 300, promoOrders: null },
      { date: '03-03', orders: 2, revenue: 210, promoOrders: null }
    ]);
  });
  it('uzgodnienie: trzy wersje przechodzą testy automatyczne, a różnią się sumami', () => {
    expect(l.recon.variants.map(v => v.id)).toEqual(['fanout', 'inner', 'correct']);
    for (const v of ['fanout', 'inner', 'correct'] as const) {
      const r = reconcile(v);
      expect(r.testsPass, v).toBe(true);
      expect(r.rows, v).toEqual({ before: 3, after: 3 });
    }
    const fanout = reconcile('fanout');
    expect(fanout.orders).toEqual({ before: 5, after: 5 });
    expect(fanout.revenue).toEqual({ before: 710, after: 1010 });
    expect(fanout.diffs).toEqual([{ date: '03-02', column: 'revenue', before: 300, after: 600 }]);
    expect(model('fanout').map(d => d.promoOrders)).toEqual([1, 2, 1]);

    const inner = reconcile('inner');
    expect(inner.orders).toEqual({ before: 5, after: 3 });
    expect(inner.revenue).toEqual({ before: 710, after: 570 });
    expect(inner.diffs.map(d => `${d.date}.${d.column}`)).toEqual(['03-01.orders', '03-01.revenue', '03-03.orders', '03-03.revenue']);

    const correct = reconcile('correct');
    expect(correct.diffs).toEqual([]);
    expect(correct.revenue).toEqual({ before: 710, after: 710 });
    expect(model('correct').map(d => d.promoOrders)).toEqual([1, 1, 1]);
  });
  it('uzgodnienie: SQL każdej wersji odpowiada temu, co liczy logika', () => {
    const [fanout, inner, correct] = l.recon.variants;
    expect(fanout.sql).toMatch(/left join stg_order_promos/);
    expect(fanout.sql).not.toMatch(/group by order_id/);
    expect(inner.sql).toMatch(/\njoin promo/);
    expect(inner.sql).not.toMatch(/left join/);
    expect(correct.sql).toMatch(/left join promo/);
    for (const v of [inner, correct]) expect(v.sql, v.id).toMatch(/group by order_id/);
    for (const v of l.recon.variants) expect(v.sql, v.id).toMatch(/where o\.status = 'paid'/);
    // Tekst na początku lekcji mówi „urósł o 300" i „3 przed, 3 po".
    expect(l.beats[0].html).toMatch(/urósł o 300/);
    expect(l.green.checks.length).toBe(l.recon.checks.length);
  });
  it('potok CI/CD: każda zmiana zatrzymuje się na istniejącym etapie, a bramki człowieka są dwie', () => {
    const ids = l.pipeline.stages.map(s => s.id);
    expect(l.pipeline.stages.filter(s => s.kind === 'human').map(s => s.id)).toEqual(['review', 'approval']);
    for (const c of l.pipeline.changes) if (c.stopsAt !== null) expect(ids, c.id).toContain(c.stopsAt);
    expect(l.pipeline.changes.some(c => c.id === l.pipeline.defaultChange)).toBe(true);
    expect(pipelineStatus('typo')).toEqual(['stopped', ...Array(8).fill('skipped')]);
    expect(pipelineStatus('fanout').slice(0, 4)).toEqual(['passed', 'passed', 'passed', 'stopped']);
    expect(pipelineStatus('good')).toEqual(Array(9).fill('passed'));
    // Źle zrozumianego wymagania nie zatrzymuje żaden automat.
    const rule = l.pipeline.changes.find(c => c.id === 'rule')!;
    expect(l.pipeline.stages.find(s => s.id === rule.stopsAt)!.kind).toBe('human');
  });
  it('model przyrostowy: w każdym zdarzeniu przyrost różni się od pełnego przeliczenia w jednym dniu', () => {
    expect(l.incremental.cases.map(c => c.id)).toEqual(['late', 'rerun', 'logic']);
    for (const c of l.incremental.cases) {
      expect(c.full.map(r => r[0]), c.id).toEqual(c.incremental.map(r => r[0]));
      expect(c.full.filter((r, i) => r[1] !== c.incremental[i][1]).length, c.id).toBe(1);
    }
    const state = model('before').map(d => d.revenue);
    const value = (id: string, kind: 'full' | 'incremental', date: string) => l.incremental.cases.find(c => c.id === id)![kind].find(r => r[0] === date)![1];
    // Stan wyjściowy jest ten sam co w uzgodnieniu: 200, 300, 210.
    expect(['03-01', '03-02', '03-03'].map(d => value('rerun', 'full', d))).toEqual(state);
    expect(value('late', 'full', '03-02')).toBe(300 + 40);
    expect(value('rerun', 'incremental', '03-04')).toBe(2 * value('rerun', 'full', '03-04'));
    // Zwrot z zamówienia 103 (45) pomniejsza przychód z 2 marca.
    const refund = l.example.orders.find(o => o[2] === 'refunded')!;
    expect(value('logic', 'full', '03-02')).toBe(300 - refund[3]);
  });
  it('ćwiczenie z review: zaznaczalne linie mają werdykt i wyjaśnienie', () => {
    const selectable = l.review.lines.filter(x => x.verdict);
    expect(selectable.filter(x => x.verdict === 'problem').length).toBe(5);
    expect(selectable.filter(x => x.verdict === 'ok').length).toBe(2);
    for (const x of selectable) {
      expect(x.title, x.code).toBeTruthy();
      expect(words(x.why ?? ''), x.code).toBeGreaterThanOrEqual(12);
    }
    // Wyjaśnienie fan-outu odsyła do linii z joinem po jej faktycznym numerze.
    const joinLine = l.review.lines.findIndex(x => x.code.includes('left join')) + 1;
    expect(l.review.lines.find(x => x.code.includes('sum(o.amount)'))!.why).toContain(`linii ${joinLine}`);
    expect(l.review.lines.some(x => /safe_divide/.test(x.code))).toBe(true);
    expect(l.review.pythonLines.length).toBe(4);
  });
  it('przepływ z agentem: dziewięć kroków w ustalonej kolejności, decyzje zostają u człowieka', () => {
    expect(l.flow.steps.map(s => s.id)).toEqual(['requirements', 'investigation', 'implementation', 'tests', 'validation', 'review', 'approval', 'pr', 'deployment']);
    expect(l.flow.steps.filter(s => s.actor === 'agent').map(s => s.id)).toEqual(['investigation', 'implementation', 'tests', 'validation']);
    // Jedyny krok bez punktu kontrolnego to implementacja w granicach zatwierdzonego planu.
    expect(l.flow.steps.filter(s => !s.gate).map(s => s.id)).toEqual(['implementation']);
    expect(l.lifecycle.phases.length).toBe(7);
    expect(l.lifecycle.phases.some(p => p.id === l.lifecycle.defaultId)).toBe(true);
  });
  it('uprawnienia: produkcja, sekrety i wdrożenie są zablokowane', () => {
    const level = (needle: string) => l.permissions.rows.find(r => r.what.includes(needle))!.level;
    expect([level('produkcji'), level('.env'), level('Merge')]).toEqual(['deny', 'deny', 'deny']);
    expect(level('Commit')).toBe('ask');
    for (const lv of ['allow', 'ask', 'deny'] as const) expect(l.permissions.rows.filter(r => r.level === lv).length, lv).toBe(3);
  });
  it('tabele, ilustracje i ćwiczenie z wymaganiami mają komplet danych', () => {
    for (const t of [l.environments, l.teamwork, l.verify, l.accountability]) for (const r of t.rows) expect(r.length).toBe(t.columns.length);
    expect(l.requirements.items.filter(i => i.kind === 'F').length).toBe(2);
    expect(l.requirements.items.filter(i => i.kind === 'NF').length).toBe(4);
    expect(l.levels.items.map(x => x.id)).toEqual(['unit', 'integration', 'e2e', 'quality', 'regression']);
    expect(l.release.strategies.map(x => x.id)).toEqual(['inplace', 'bluegreen', 'parallel']);
    expect(l.adr.lines.map(x => x.label)).toEqual(['Tytuł', 'Status', 'Kontekst', 'Decyzja', 'Konsekwencje']);
  });
  it('scenariusze i sprawdzian mają poprawne odpowiedzi oraz wyjaśnienia', () => {
    expect(l.security.cases.length).toBe(5);
    for (const c of l.security.cases) {
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

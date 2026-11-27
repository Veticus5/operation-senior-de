import { describe, expect, it } from 'vitest';
import { lessons, questions } from '@content/index';
import { glossary } from '@content/glossary';
import type { Bridge } from '@content/types';
import * as l from '@content/data-modeling/dimensional-modeling/lesson';
import { parseRich, plainText, termIds } from '../../lib/richText';
import { countryReport, fanoutResult, fanoutRows, matchVersions, mrrByMonth, position, refundRates, rlsView, semanticCount, threeNumbers, totalRevenue } from './model';

const words = (text: string) => plainText(text).split(/\s+/).filter(Boolean).length;
const byCountry = (mode: 'pit' | 'current' | 'natural') => Object.fromEntries(countryReport(mode).rows.map(r => [r.country, r.revenue]));

const bridges: Bridge[] = [...l.beats.flatMap(b => (b.bridge ? [b.bridge] : [])), l.shapes.bridge, l.scd.bridge, l.cardinality.bridge];
const rich: string[] = [
  ...l.beats.flatMap(b => [b.html, b.after ?? '', ...(b.more?.html ?? [])]),
  l.star.assumptions, l.star.fact.role, ...l.star.dims.map(d => d.role),
  ...l.factTypes.takeaway, ...l.factTypes.notes,
  l.additivity.takeaway, ...l.additivity.more, ...l.additivity.measures.map(m => m.text),
  l.keys.intro, l.keys.legend, l.keys.takeaway, ...l.keys.reasons, ...l.keys.more,
  ...l.patterns.items.flatMap(p => [p.problem, p.result, p.takeaway]), ...l.patterns.more,
  l.shapes.takeaway, ...l.shapes.variants.map(v => v.text), ...l.shapes.conformed,
  ...l.scd.takeaway, ...l.scd.columns, ...l.scd.choice,
  l.pit.intro, l.pit.assumptions, ...l.pit.takeaway, ...l.pit.current, ...l.pit.asof,
  l.late.takeaway, ...l.late.corrections, ...l.late.cases.flatMap(c => [c.setup, c.takeaway, ...c.lines.map(x => x.text)]),
  l.semantic.assumptions, ...l.semantic.takeaway, ...l.semantic.tools,
  l.cardinality.intro, l.cardinality.takeaway, ...l.cardinality.points,
  l.rls.takeaway, ...l.rls.caveats,
  l.preagg.intro, l.preagg.takeaway, ...l.preagg.points,
  l.placement.takeaway, ...l.placement.cases.flatMap(c => [c.setup, c.why, c.scope]),
  ...l.tools.breaks, ...l.methods.items, l.methods.takeaway,
  ...l.design.cases.flatMap(c => [c.brief, c.summary, ...c.steps.map(s => s.why)]), ...l.design.mistakes,
  ...l.quiz.flatMap(q => [q.q, q.why]),
  ...bridges.flatMap(b => [b.known, b.fresh, b.breaks])
];

describe('lekcja Advanced Data Modeling', () => {
  it('jest zarejestrowana i ma pytania w banku dla każdego ćwiczonego zagadnienia', () => {
    expect(lessons.some(x => x.id === l.meta.id)).toBe(true);
    expect(l.meta.minutes).toBe(90);
    expect(l.interviewTopics[0]).toBe(l.meta.topicId);
    for (const topic of l.interviewTopics) expect(questions.some(q => q.topicId === topic), topic).toBe(true);
    expect(l.interviewTopics.flatMap(t => questions.filter(q => q.topicId === t).map(q => q.id))).toEqual([
      'modeling-star-schema-grain', 'modeling-fan-out-double-counting', 'modeling-fact-table-types', 'modeling-scd-types',
      'modeling-late-arriving-data', 'modeling-semantic-layer', 'modeling-kimball-inmon-data-vault'
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
    expect(bridges.length).toBe(4);
    for (const b of bridges) for (const part of [b.known, b.fresh, b.breaks]) expect(words(part), b.from).toBeGreaterThanOrEqual(8);
  });

  it('dane przykładu są spójne: klucze wskazują istniejące wiersze, a przedziały wersji się nie nakładają', () => {
    const { data } = l;
    for (const s of data.subscriptions) expect(data.products.some(p => p.id === s.product), s.id).toBe(true);
    for (const p of data.products) expect(data.publishers.some(x => x.id === p.publisher), p.id).toBe(true);
    for (const t of data.transactions) expect(data.subscriptions.some(s => s.id === t.sub), t.id).toBe(true);
    expect(new Set(data.customerVersions.map(v => v.key)).size).toBe(data.customerVersions.length);
    // Każda transakcja pasuje do dokładnie jednej wersji klienta: przedziały są rozłączne i bez dziur.
    for (const t of data.transactions) expect(matchVersions(t, 'pit').length, t.id).toBe(1);
    // Dokładnie jedna wersja bieżąca na klienta.
    for (const c of new Set(data.customerVersions.map(v => v.customer))) expect(data.customerVersions.filter(v => v.customer === c && v.current).length, c).toBe(1);
    // Migawka na koniec lutego to stan tabeli subskrypcji.
    expect(data.snapshot.filter(r => r.month === '2026-02-28').map(r => [r.sub, r.mrr])).toEqual(data.subscriptions.map(s => [s.id, s.mrr]));
  });

  it('trzy liczby z pierwszego kroku wynikają z danych: 28, 36 i 56', () => {
    expect(threeNumbers()).toEqual({ cash: 28, mrr: 36, fanned: 56 });
    expect(l.beats[0].html).toContain('<b>28</b>, <b>36</b> i <b>56 EUR</b>');
  });
  it('fan-out: złączenie powiela wiersze i zawyża MRR, a agregacja przed złączeniem nie', () => {
    expect(fanoutRows('wrong').length).toBe(6);
    expect(fanoutRows('right').length).toBe(l.data.subscriptions.length);
    expect(fanoutResult('wrong').byPublisher).toEqual([{ publisher: 'Aurora Sport', mrr: 48, revenue: 136 }, { publisher: 'Kino Nord', mrr: 8, revenue: 8 }]);
    expect(fanoutResult('right').byPublisher).toEqual([{ publisher: 'Aurora Sport', mrr: 28, revenue: 136 }, { publisher: 'Kino Nord', mrr: 8, revenue: 8 }]);
    // Przychód jest taki sam w obu wariantach: błąd dotyczy tylko miary ze strony „jeden".
    expect(fanoutResult('wrong').revenue).toBe(fanoutResult('right').revenue);
  });
  it('ziarno: każde pytanie ma odpowiedź, a żadne pojedyncze ziarno nie odpowiada na wszystkie trzy', () => {
    expect(l.grain.options.some(o => o.id === l.grain.defaultId)).toBe(true);
    for (const o of l.grain.options) {
      expect(o.answers.length, o.id).toBe(l.grain.questions.length);
      expect(o.answers.every(a => a.ok), o.id).toBe(false);
      for (const row of o.table.rows) expect(row.length, o.id).toBe(o.table.columns.length);
    }
    for (let q = 0; q < l.grain.questions.length; q++) expect(l.grain.options.some(o => o.answers[q].ok), l.grain.questions[q]).toBe(true);
  });
  it('gwiazda: każdy pokazany wiersz faktu wskazuje istniejący wiersz każdego wymiaru', () => {
    const dim = (id: string) => l.star.dims.find(d => d.id === id)!;
    for (const t of l.data.transactions.slice(0, l.star.factRows)) {
      expect(dim('date').rows.some(r => r[1] === t.date), t.id).toBe(true);
      const sub = l.data.subscriptions.find(s => s.id === t.sub)!;
      expect(dim('customer').rows.some(r => r[1] === sub.customer), t.id).toBe(true);
      expect(dim('product').rows.some(r => r[1] === sub.product), t.id).toBe(true);
    }
    for (const d of l.star.dims) for (const row of d.rows) expect(row.length, d.name).toBe(d.columns.length);
  });

  it('rodzaje tabel faktów: każdy miesiąc ma opis, a tylko narastająca migawka aktualizuje wiersze', () => {
    for (const t of l.factTypes.tables) {
      expect(t.behaviour.length, t.id).toBe(l.factTypes.months.length);
      for (const r of t.rows) expect(r.cells.length, t.id).toBe(t.columns.length);
    }
    expect(l.factTypes.tables.filter(t => 'updates' in t).map(t => t.id)).toEqual(['accumulating']);
    // W kwietniu nie ma żadnej transakcji, a migawka okresowa nadal ma wiersz.
    const rowsIn = (id: string, month: number) => l.factTypes.tables.find(t => t.id === id)!.rows.filter(r => r.month === month).length;
    expect([rowsIn('transaction', 3), rowsIn('periodic', 3)]).toEqual([0, 1]);
  });
  it('addytywność: liczby w opisach wynikają z danych', () => {
    expect(totalRevenue()).toBe(162);
    expect(mrrByMonth().map(m => m.mrr)).toEqual([28, 36, 26]);
    expect(mrrByMonth().reduce((n, m) => n + m.mrr, 0)).toBe(90);
    const rates = refundRates();
    expect(rates.perProduct.map(r => +r.rate.toFixed(3))).toEqual([0.167, 0, 0]);
    expect(+rates.overall.toFixed(3)).toBe(0.111);
    expect(+rates.averageOfRates.toFixed(3)).toBe(0.056);
    expect(l.additivity.measures.map(m => m.sum)).toEqual(['162', '90', '5,6%']);
  });
  it('SCD i złączenie punkt-w-czasie: raporty zgadzają się z opisem', () => {
    expect(byCountry('pit')).toEqual({ DE: 18, FR: 96, PL: 48 });
    expect(byCountry('current')).toEqual({ FR: 96, PL: 66 });
    expect(byCountry('natural')).toEqual({ DE: 36, FR: 96, PL: 66 });
    expect(countryReport('pit').total).toBe(162);
    expect(countryReport('current').total).toBe(162);
    expect(countryReport('natural').total).toBe(198);
    // Oś czasu: zmiana 10 lutego leży między styczniem a marcem.
    const change = position('2026-02-10', l.scd.timeline.start, l.scd.timeline.end);
    expect(change).toBeGreaterThan(40);
    expect(change).toBeLessThan(50);
  });
  it('warstwa semantyczna: trzy zespoły dostają trzy różne liczby', () => {
    expect(l.semantic.presets.map(p => semanticCount(l.semantic.subs, p).value)).toEqual([4, 5, 8]);
  });
  it('RLS: każdy wydawca widzi tylko swoje transakcje, a suma wycinków daje całość', () => {
    const [aurora, kino, platform] = l.rls.users.map(u => rlsView(u.publishers));
    expect([aurora.revenue, kino.revenue, platform.revenue]).toEqual([146, 16, 162]);
    expect(aurora.visible.some(id => kino.visible.includes(id))).toBe(false);
    expect(platform.visible.length).toBe(l.data.transactions.length);
  });

  it('ćwiczenia i sprawdzian mają poprawne odpowiedzi oraz wyjaśnienia', () => {
    expect(l.placement.cases.length).toBe(4);
    for (const c of l.placement.cases) {
      expect(c.correct, c.setup).toBeLessThan(l.placement.options.length);
      for (const text of [c.setup, c.why, c.scope]) expect(words(text), c.setup).toBeGreaterThanOrEqual(8);
    }
    // Każde miejsce jest dobrą odpowiedzią przynajmniej raz, żeby ćwiczenie nie uczyło „zawsze w hurtowni".
    expect(new Set(l.placement.cases.map(c => c.correct)).size).toBe(l.placement.options.length);
    expect(l.design.cases.length).toBe(3);
    for (const c of l.design.cases) {
      expect(c.steps.length, c.id).toBe(4);
      for (const s of c.steps) {
        expect(s.correct, s.ask).toBeLessThan(s.options.length);
        expect(new Set(s.options).size, s.ask).toBe(s.options.length);
        expect(words(s.why), s.ask).toBeGreaterThanOrEqual(12);
      }
    }
    expect(l.quiz.length).toBe(10);
    for (const q of l.quiz) {
      expect(q.correct, q.q).toBeLessThan(q.options.length);
      expect(new Set(q.options).size, q.q).toBe(q.options.length);
      expect(words(q.why), q.q).toBeGreaterThanOrEqual(12);
    }
  });
});

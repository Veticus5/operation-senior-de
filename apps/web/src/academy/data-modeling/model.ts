import { data, type CustomerVersion, type SemSub, type Txn } from '@content/data-modeling/dimensional-modeling/lesson';

/**
 * Czysta logika ilustracji lekcji o modelowaniu: wszystkie liczby na ekranie są liczone tutaj z danych
 * z /content. Te same wyniki odtwarza w SQL skrypt labs/data_modeling/modeling_sql_check.py.
 */

export type JoinMode = 'pit' | 'current' | 'natural';

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const subById = (id: string) => data.subscriptions.find(s => s.id === id)!;
const productById = (id: string) => data.products.find(p => p.id === id)!;

export const productOfTxn = (t: Txn) => productById(subById(t.sub).product);
export const publisherOfSub = (subId: string) => data.publishers.find(p => p.id === productById(subById(subId).product).publisher)!;
export const customerOfTxn = (t: Txn) => subById(t.sub).customer;

/** Kwota w zapisie polskim, bez zbędnych zer: 10, 16,7. */
export const fmt = (n: number, digits = 0) => n.toLocaleString('pl-PL', { minimumFractionDigits: digits, maximumFractionDigits: digits });
export const fill = (template: string, values: Record<string, string | number>) => template.replace(/\{(\w+)\}/g, (_, k: string) => String(values[k] ?? ''));

/** Transakcje do końca lutego: zakres etapu Intuicja. */
export const febTransactions = () => data.transactions.filter(t => t.date < data.febEnd);

/** Trzy liczby z pierwszego kroku: wpłaty w lutym, MRR na koniec lutego i MRR po błędnym złączeniu. */
export function threeNumbers() {
  const cash = sum(data.transactions.filter(t => t.date >= '2026-02-01' && t.date < data.febEnd).map(t => t.amount));
  const mrr = sum(data.subscriptions.map(s => s.mrr));
  const fanned = sum(fanoutRows('wrong').map(r => r.mrr));
  return { cash, mrr, fanned };
}

export interface FanoutRow { sub: string; publisher: string; mrr: number; txn: string; amount: number; duplicate: boolean }

/** Wiersze po złączeniu subskrypcji z transakcjami (wrong) albo z podsumą transakcji per subskrypcja (right). */
export function fanoutRows(mode: 'wrong' | 'right'): FanoutRow[] {
  const tx = febTransactions();
  return data.subscriptions.flatMap(s => {
    const own = tx.filter(t => t.sub === s.id);
    const publisher = publisherOfSub(s.id).name;
    if (mode === 'right') return [{ sub: s.id, publisher, mrr: s.mrr, txn: `${own.length} txn`, amount: sum(own.map(t => t.amount)), duplicate: false }];
    return own.map((t, i) => ({ sub: s.id, publisher, mrr: s.mrr, txn: t.id, amount: t.amount, duplicate: i > 0 }));
  });
}

export function fanoutResult(mode: 'wrong' | 'right') {
  const rows = fanoutRows(mode);
  const byPublisher = data.publishers.map(p => {
    const own = rows.filter(r => r.publisher === p.name);
    return { publisher: p.name, mrr: sum(own.map(r => r.mrr)), revenue: sum(own.map(r => r.amount)) };
  });
  return { byPublisher, mrr: sum(byPublisher.map(r => r.mrr)), revenue: sum(byPublisher.map(r => r.revenue)), rows: rows.length };
}

/** Wersje wymiaru klienta pasujące do transakcji przy danym sposobie złączenia. */
export function matchVersions(t: Txn, mode: JoinMode): CustomerVersion[] {
  const versions = data.customerVersions.filter(v => v.customer === customerOfTxn(t));
  if (mode === 'natural') return versions;
  if (mode === 'current') return versions.filter(v => v.current);
  // Przedział lewostronnie domknięty: [from, to).
  return versions.filter(v => t.date >= v.from && t.date < v.to);
}

/** Przychód per kraj dla wszystkich transakcji. `pit` to raport SCD typu 2, `current` to raport SCD typu 1. */
export function countryReport(mode: JoinMode) {
  const totals = new Map<string, number>();
  for (const t of data.transactions) for (const v of matchVersions(t, mode)) totals.set(v.country, (totals.get(v.country) ?? 0) + t.amount);
  const rows = [...totals.entries()].map(([country, revenue]) => ({ country, revenue })).sort((a, b) => a.country.localeCompare(b.country));
  return { rows, total: sum(rows.map(r => r.revenue)) };
}

export const totalRevenue = () => sum(data.transactions.map(t => t.amount));

/** MRR na koniec każdego miesiąca z okresowej migawki. */
export function mrrByMonth() {
  const months = [...new Set(data.snapshot.map(r => r.month))];
  return months.map(month => ({ month, mrr: sum(data.snapshot.filter(r => r.month === month).map(r => r.mrr)) }));
}

/** Odsetek zwrotów: zwroty / wpłaty, per produkt i łącznie. */
export function refundRates() {
  const rate = (tx: Txn[]) => tx.filter(t => t.type === 'refund').length / tx.filter(t => t.type === 'payment').length;
  const perProduct = data.products.map(p => ({ product: p.name, rate: rate(data.transactions.filter(t => productOfTxn(t).id === p.id)) }));
  return { perProduct, overall: rate(data.transactions), averageOfRates: sum(perProduct.map(r => r.rate)) / perProduct.length };
}

export interface SemanticDefinition { trial: boolean; pastDue: boolean; unit: 'subscriptions' | 'customers' }

/** Które subskrypcje wchodzą do miary i ile wynosi wynik przy danej definicji „aktywnego subskrybenta". */
export function semanticCount(subs: SemSub[], def: SemanticDefinition) {
  const counted = subs.filter(s => s.status === 'active' || (def.trial && s.status === 'trialing') || (def.pastDue && s.status === 'past_due'));
  const value = def.unit === 'subscriptions' ? counted.length : new Set(counted.map(s => s.customer)).size;
  return { counted: counted.map(s => s.sub), value };
}

/** Transakcje widoczne po filtrze RLS na wymiarze wydawcy. */
export function rlsView(publisherIds: string[]) {
  const visible = data.transactions.filter(t => publisherIds.includes(publisherOfSub(t.sub).id));
  return { visible: visible.map(t => t.id), revenue: sum(visible.map(t => t.amount)) };
}

/** Pozycja daty na osi czasu, 0..100. */
export function position(date: string, start: string, end: string) {
  const day = (d: string) => Date.parse(`${d}T00:00:00Z`) / 86_400_000;
  const clamped = Math.min(Math.max(day(date), day(start)), day(end) + 1);
  return ((clamped - day(start)) / (day(end) + 1 - day(start))) * 100;
}

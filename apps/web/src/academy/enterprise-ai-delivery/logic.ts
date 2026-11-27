import { example, pipeline } from '@content/delivery/enterprise-ai-delivery/lesson';

/**
 * Czysta logika ilustracji lekcji 07. Wersje modelu fct_daily_revenue są tu policzone z danych przykładu tak,
 * jak policzyłby je SQL pokazany w treści, więc liczby w interfejsie wynikają z danych, a nie są wpisane ręcznie.
 */
export interface DayRow { date: string; orders: number; revenue: number; promoOrders: number | null }
export type VariantId = 'before' | 'fanout' | 'inner' | 'correct';

interface Joined { orderId: number; date: string; amount: number; hasPromo: boolean }

const paid = () => example.orders.filter(o => o[2] === 'paid');

/** Wiersze po joinie zamówień opłaconych z kodami, w zależności od wersji. */
function joined(variant: VariantId): Joined[] {
  const row = (o: (typeof example.orders)[number], hasPromo: boolean): Joined => ({ orderId: o[0], date: o[1], amount: o[3], hasPromo });
  if (variant === 'before') return paid().map(o => row(o, false));
  if (variant === 'fanout') {
    // LEFT JOIN prosto do tabeli kodów: jeden wiersz na każdy kod, a gdy kodów nie ma, jeden wiersz z NULL.
    return paid().flatMap(o => {
      const codes = example.promos.filter(p => p[0] === o[0]);
      return codes.length ? codes.map(() => row(o, true)) : [row(o, false)];
    });
  }
  // Kody sprowadzone do ziarna zamówienia. INNER JOIN gubi zamówienia bez kodu, LEFT JOIN je zachowuje.
  const withPromo = new Set(example.promos.map(p => p[0]));
  const rows = paid().map(o => row(o, withPromo.has(o[0])));
  return variant === 'inner' ? rows.filter(r => r.hasPromo) : rows;
}

/** Wynik modelu: jeden wiersz na dzień. */
export function model(variant: VariantId): DayRow[] {
  const rows = joined(variant);
  const dates = [...new Set(rows.map(r => r.date))].sort();
  return dates.map(date => {
    const day = rows.filter(r => r.date === date);
    return {
      date,
      orders: new Set(day.map(r => r.orderId)).size,
      revenue: day.reduce((n, r) => n + r.amount, 0),
      promoOrders: variant === 'before' ? null : day.filter(r => r.hasPromo).length
    };
  });
}

export interface Reconciliation {
  rows: { before: number; after: number };
  orders: { before: number; after: number };
  revenue: { before: number; after: number };
  /** Dni, w których istniejące kolumny różnią się od wersji sprzed zmiany. */
  diffs: { date: string; column: 'orders' | 'revenue'; before: number; after: number }[];
  /** Testy automatyczne: unikalny i niepusty klucz, ta sama liczba wierszy. */
  testsPass: boolean;
}

const sum = (rows: DayRow[], key: 'orders' | 'revenue') => rows.reduce((n, r) => n + r[key], 0);

/** Uzgodnienie wersji po zmianie z wersją sprzed zmiany: liczby zbiorcze i różnice po kluczu. */
export function reconcile(variant: Exclude<VariantId, 'before'>): Reconciliation {
  const before = model('before');
  const after = model(variant);
  const diffs: Reconciliation['diffs'] = [];
  for (const b of before) {
    const a = after.find(x => x.date === b.date);
    for (const column of ['orders', 'revenue'] as const) {
      const value = a ? a[column] : 0;
      if (value !== b[column]) diffs.push({ date: b.date, column, before: b[column], after: value });
    }
  }
  const unique = new Set(after.map(r => r.date)).size === after.length;
  return {
    rows: { before: before.length, after: after.length },
    orders: { before: sum(before, 'orders'), after: sum(after, 'orders') },
    revenue: { before: sum(before, 'revenue'), after: sum(after, 'revenue') },
    diffs,
    testsPass: unique && after.every(r => r.date) && after.length === before.length
  };
}

export type StageStatus = 'passed' | 'stopped' | 'skipped';

/** Stan każdego etapu potoku dla wybranej zmiany: przeszedł, zatrzymał zmianę albo nie został osiągnięty. */
export function pipelineStatus(changeId: string): StageStatus[] {
  const change = pipeline.changes.find(c => c.id === changeId) ?? pipeline.changes[0];
  const stop = change.stopsAt === null ? -1 : pipeline.stages.findIndex(s => s.id === change.stopsAt);
  return pipeline.stages.map((_, i) => (stop === -1 || i < stop ? 'passed' : i === stop ? 'stopped' : 'skipped'));
}

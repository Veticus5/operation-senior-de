import { sample, sizes, type StrategyId } from '@content/spark/join-strategies/lesson';

/**
 * Czysta logika obu ilustracji z lekcji o joinach. To model dydaktyczny w JavaScripcie:
 * nie wybiera strategii i nie udaje optymalizatora Sparka. Strategię i rozmiary wskazuje uczący się.
 */
export interface TxChip { txn: string; customer: number; moved: boolean; country: string | null }
export interface CustChip { id: number; country: string; moved: boolean }
export interface Box {
  /** Po shuffle'u pudełko oznacza partycję, wcześniej executor. */
  kind: 'executor' | 'partition';
  index: number;
  tx: TxChip[];
  cust: CustChip[];
  /** Jak executor trzyma swoją stronę customers. */
  custState: 'rows' | 'unused' | 'sorted' | 'hash';
  txSorted: boolean;
  /** Pełna kopia customers rozesłana przez driver (tylko broadcast). */
  broadcast: CustChip[] | null;
}
export interface Scene { driver: CustChip[] | null; boxes: Box[]; counters: [number, number, number] }

/** Partycja po shuffle'u w tym modelu: klucze nieparzyste do A (0), parzyste do B (1). */
export const shufflePartition = (customerId: number): number => (customerId % 2 === 1 ? 0 : 1);

const countryOf = (id: number): string => sample.customers.find(c => c.id === id)?.country ?? '?';

export function buildScene(strategy: StrategyId, step: number): Scene {
  const shuffled = strategy !== 'bhj' && step >= 1;
  const joined = step >= 3;
  const all: CustChip[] = sample.customers.map(c => ({ id: c.id, country: c.country, moved: false }));
  const boxes: Box[] = [0, 1].map(index => {
    const place = (id: number, exec: number) => (shuffled ? shufflePartition(id) : exec);
    let tx: TxChip[] = sample.transactions
      .filter(t => place(t.customer, t.exec) === index)
      .map(t => ({ txn: t.txn, customer: t.customer, moved: shuffled && step === 1 && t.exec !== index, country: joined ? countryOf(t.customer) : null }));
    let cust: CustChip[] = sample.customers
      .filter(c => place(c.id, c.exec) === index)
      .map(c => ({ id: c.id, country: c.country, moved: shuffled && step === 1 && c.exec !== index }));
    const sorted = strategy === 'smj' && step >= 2;
    if (sorted) {
      tx = [...tx].sort((a, b) => a.customer - b.customer || a.txn.localeCompare(b.txn));
      cust = [...cust].sort((a, b) => a.id - b.id);
    }
    const custState: Box['custState'] =
      strategy === 'bhj' ? (step >= 1 ? 'unused' : 'rows') : sorted ? 'sorted' : strategy === 'shj' && step >= 2 ? 'hash' : 'rows';
    return { kind: shuffled ? 'partition' : 'executor', index, tx, cust, custState, txSorted: sorted, broadcast: strategy === 'bhj' && step >= 2 ? all : null };
  });
  const shuffleRows = shuffled ? sample.transactions.length + sample.customers.length : 0;
  const sortedSides = strategy === 'smj' && step >= 2 ? 2 : 0;
  const copies = strategy !== 'bhj' || step < 1 ? 0 : step === 1 ? 1 : 1 + boxes.length;
  return { driver: strategy === 'bhj' && step >= 1 ? all : null, boxes, counters: [shuffleRows, sortedSides, copies] };
}

/** Gdzie leżą wiersze jednego klienta przed joinem: numery executorów (od 0). */
export function whereIs(customerId: number): { tx: number[]; cust: number } {
  const tx = [...new Set(sample.transactions.filter(t => t.customer === customerId).map(t => t.exec))].sort();
  return { tx, cust: sample.customers.find(c => c.id === customerId)?.exec ?? 0 };
}

export interface Bill {
  /** Wszystko w MB. */
  broadcastNet: number;
  shuffleNet: number;
  partition: number;
  buildPartition: number;
  copies: number;
  places: number;
}

/** Rachunek z etapu Mechanizm: arytmetyka na założeniach z `sizes`, nic więcej. */
export function bill(customersMb: number, transactionsMb: number): Bill {
  return {
    broadcastNet: customersMb * sizes.executors,
    shuffleNet: customersMb + transactionsMb,
    partition: (customersMb + transactionsMb) / sizes.shufflePartitions,
    buildPartition: customersMb / sizes.shufflePartitions,
    copies: sizes.executors,
    places: sizes.executors + 1
  };
}

/** 0.04 -> „41 kB", 300 -> „300 MB", 4096 -> „4 GB", 552960 -> „540 GB". */
export function formatSize(mb: number): string {
  const num = (value: number) => (value >= 100 || Number.isInteger(value) ? String(Math.round(value)) : value.toFixed(1).replace('.', ','));
  if (mb < 1) return `${Math.round(mb * 1024)} kB`;
  if (mb < 1024) return `${num(mb)} MB`;
  if (mb < 1024 * 1024) return `${num(mb / 1024)} GB`;
  return `${num(mb / 1024 / 1024)} TB`;
}

export const fill = (text: string, values: Record<string, string | number>): string =>
  text.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? ''));

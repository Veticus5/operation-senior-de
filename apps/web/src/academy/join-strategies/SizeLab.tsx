import { useState } from 'react';
import { sizes } from '@content/spark/join-strategies/lesson';
import { Html } from '../../components/Html';
import { bill, fill, formatSize } from './scene';

type State = 'ok' | 'risk' | 'no';

function Card({ name, network, sort, memory, state, verdict }: { name: string; network: string; sort: string; memory: string; state: State; verdict: string }) {
  return (
    <div className={`js-card ${state}`}>
      <h3>{name}</h3>
      <dl>
        <dt>{sizes.rows.network}</dt>
        <dd>{network}</dd>
        <dt>{sizes.rows.sort}</dt>
        <dd>{sort}</dd>
        <dt>{sizes.rows.memory}</dt>
        <dd>{memory}</dd>
      </dl>
      <p className={`fit-verdict ${state}`}>{verdict}</p>
    </div>
  );
}

/**
 * Rachunek dla dużych tabel: co każda strategia musiałaby przesłać, posortować i zmieścić w pamięci.
 * To arytmetyka na jawnych założeniach, a nie pomiar ani optymalizator. Komponent niczego nie „wybiera".
 */
export function SizeLab() {
  const [customers, setCustomers] = useState(sizes.defaultCustomersMb);
  const [transactions, setTransactions] = useState(sizes.defaultTransactionsMb);
  const b = bill(customers, transactions);
  const values = {
    customers: formatSize(customers),
    broadcastNet: formatSize(b.broadcastNet),
    shuffleNet: formatSize(b.shuffleNet),
    partition: formatSize(b.partition),
    buildPartition: formatSize(b.buildPartition),
    copies: b.copies,
    places: b.places
  };
  const broadcast = sizes.bhj.verdicts[sizes.customersMb.indexOf(customers)];

  return (
    <div className="js">
      <span className="badge sim">Ilustracja kosztów · nie pomiar i nie optymalizator</span>
      <Html as="p" className="small viz-assume" html={sizes.assumptions} />
      <div className="js-controls">
        <span className="segc" role="group" aria-label="Rozmiar tabeli customers">
          {sizes.customersMb.map(mb => (
            <button key={mb} type="button" aria-pressed={customers === mb} onClick={() => setCustomers(mb)}>{sizes.customersLabel} {formatSize(mb)}</button>
          ))}
        </span>
        <span className="segc" role="group" aria-label="Rozmiar tabeli transactions">
          {sizes.transactionsMb.map(mb => (
            <button key={mb} type="button" aria-pressed={transactions === mb} onClick={() => setTransactions(mb)}>{sizes.transactionsLabel} {formatSize(mb)}</button>
          ))}
        </span>
      </div>

      <div className="js-cards" role="status" aria-live="polite">
        <Card name={sizes.bhj.name} network={fill(sizes.bhj.network, values)} sort={sizes.bhj.sort} memory={fill(sizes.bhj.memory, values)} state={broadcast.state} verdict={broadcast.text} />
        <Card name={sizes.smj.name} network={fill(sizes.smj.network, values)} sort={sizes.smj.sort} memory={fill(sizes.smj.memory, values)} state="ok" verdict={sizes.smj.verdict.text} />
        <Card name={sizes.shj.name} network={fill(sizes.shj.network, values)} sort={sizes.shj.sort} memory={fill(sizes.shj.memory, values)} state="risk" verdict={sizes.shj.verdict.text} />
      </div>
      <p className="js-say">{fill(b.broadcastNet > b.shuffleNet ? sizes.compare.more : sizes.compare.less, values)}</p>
    </div>
  );
}

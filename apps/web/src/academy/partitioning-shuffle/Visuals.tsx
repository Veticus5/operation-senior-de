import { useState } from 'react';
import { cost, inputPartitions, orders, peek, rowsPerPartition, sizing } from '@content/spark/partitioning-shuffle/lesson';
import { Html } from '../../components/Html';

/** Ilustracja z pierwszego kroku: trzy partycje z kafelkami i pytanie, kto sam policzy sumę dla PL. */
export function PartitionsPeek() {
  const [picked, setPicked] = useState<number | null>(null);
  return (
    <div className="psh psh-peek">
      <span className="badge sim">Ilustracja · nie pomiar</span>
      <p className="small viz-assume">{peek.note}</p>
      <ul className="psh-parts">
        {Array.from({ length: inputPartitions }, (_, p) => (
          <li key={p}>
            <span className="viz-k">partycja {p} · task {p}</span>
            <span className="psh-tiles">
              {orders.slice(p * rowsPerPartition, (p + 1) * rowsPerPartition).map(o => (
                <i key={o.id} className={`c-${o.country}`}>{o.country} <b>{o.amount}</b></i>
              ))}
            </span>
          </li>
        ))}
      </ul>
      <p className="ask psh-ask">{peek.ask}</p>
      <div className="choices">
        {peek.options.map((option, i) => (
          <button key={option} type="button" className={`choice${picked === null ? '' : i === peek.correct ? ' ok' : i === picked ? ' no' : ''}`} disabled={picked !== null} onClick={() => setPicked(i)}>
            {option}
          </button>
        ))}
      </div>
      {picked !== null && (
        <div className="reveal on">
          <p className={`verdict ${picked === peek.correct ? 'ok' : 'no'}`}>{picked === peek.correct ? peek.ok : peek.no}</p>
          <p>{peek.why}</p>
        </div>
      )}
    </div>
  );
}

/** Schemat: droga jednego rekordu przez shuffle. Cztery kroki, wszystkie widoczne od razu. */
export function ShuffleCost() {
  return (
    <div className="psh">
      <span className="badge sim">Ilustracja · nie pomiar</span>
      <p className="small viz-assume">{cost.note}</p>
      <ol className="psh-cost">
        {cost.steps.map((s, i) => (
          <li key={s.k}>
            <span className="psh-costn" aria-hidden="true">{i + 1}</span>
            <div>
              <p className="psh-costk">{s.k}<span>{s.where}</span></p>
              <p>{s.text}</p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

const size = (gb: number) => (gb >= 1 ? `${gb.toLocaleString('pl-PL')} GB` : `${(gb * 1000).toLocaleString('pl-PL')} MB`);

/** Ilustracja: ten sam zbiór po shuffle'u podzielony na różną liczbę partycji. Sama arytmetyka, bez pomiaru. */
export function PartitionSizer() {
  const [n, setN] = useState(sizing.defaultOption);
  const verdict = sizing.verdicts[sizing.options.indexOf(n)];
  const parallel = Math.min(n, sizing.cores);
  const rounds = Math.ceil(n / sizing.cores);
  return (
    <div className="psh">
      <span className="badge sim">Ilustracja · nie pomiar</span>
      <p className="small viz-assume">{sizing.assumptions}</p>
      <span className="segc" role="group" aria-label="Liczba partycji po shuffle'u">
        {sizing.options.map(o => (
          <button key={o} type="button" aria-pressed={n === o} onClick={() => setN(o)}>{o.toLocaleString('pl-PL')} partycji</button>
        ))}
      </span>
      <div className="psh-count psh-sizer" role="status" aria-live="polite" aria-atomic="true">
        <p><b>{size(sizing.totalGb / n)}</b><Html as="span" html={sizing.labels.size} /></p>
        <p><b>{parallel}</b><Html as="span" html={sizing.labels.parallel} /></p>
        <p><b>{rounds.toLocaleString('pl-PL')}</b><Html as="span" html={sizing.labels.rounds} /></p>
        <div className="psh-cores">
          <span className="viz-k">Rdzenie klastra · {sizing.cores}</span>
          <span className="psh-corerow" aria-hidden="true">
            {Array.from({ length: sizing.cores }, (_, c) => <i key={c} className={c < parallel ? 'busy' : ''} />)}
          </span>
          <span className="sr">Rdzenie z pracą: {parallel}, bez pracy: {sizing.cores - parallel}</span>
        </div>
        <p className={`psh-verdict fit-verdict ${verdict.state}`}><b>{verdict.head}.</b> {verdict.text}</p>
      </div>
    </div>
  );
}

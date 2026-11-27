import { useState } from 'react';
import { sample, scatter, sim, type StrategyId } from '@content/spark/join-strategies/lesson';
import { Html } from '../../components/Html';
import { buildScene, fill, whereIs, type Box, type CustChip } from './scene';

const CUST_LABEL: Record<Box['custState'], string> = {
  rows: 'customers',
  unused: 'customers · wysłane do drivera',
  sorted: 'customers · posortowane',
  hash: 'customers · tablica hashująca'
};

function CustList({ items, highlight }: { items: CustChip[]; highlight?: number }) {
  return (
    <ul className="js-rows">
      {items.map(c => (
        <li key={c.id} className={`js-chip${c.moved ? ' moved' : ''}${highlight === c.id ? ' hit' : ''}`}>
          <b>{c.id}</b> {c.country}
        </li>
      ))}
    </ul>
  );
}

/** Dwa pudełka (executory albo partycje po shuffle'u) z wierszami obu tabel. Wspólne dla obu ilustracji. */
function Boxes({ boxes, highlight }: { boxes: Box[]; highlight?: number }) {
  return (
    <div className="js-boxes">
      {boxes.map(box => (
        <div className="js-box" key={box.index}>
          <p className="viz-k">
            {box.kind === 'executor' ? `Executor ${box.index + 1}` : `Partycja ${box.index === 0 ? 'A · klucze nieparzyste' : 'B · klucze parzyste'}`}
          </p>
          <div className="js-cols">
            <div>
              <p className="js-colh">transactions{box.txSorted ? ' · posortowane' : ''}</p>
              <ul className="js-rows">
                {box.tx.map(t => (
                  <li key={t.txn} className={`js-chip${t.moved ? ' moved' : ''}${t.country ? ' joined' : ''}${highlight === t.customer ? ' hit' : ''}`}>
                    {t.txn} · <b>{t.customer}</b>
                    {t.country && <span> → {t.country}</span>}
                  </li>
                ))}
              </ul>
            </div>
            <div className={box.custState === 'unused' ? 'js-dim' : box.custState === 'hash' ? 'js-hash' : undefined}>
              <p className="js-colh">{CUST_LABEL[box.custState]}</p>
              <CustList items={box.cust} highlight={highlight} />
            </div>
          </div>
          {box.broadcast && (
            <div className="js-hash js-copy">
              <p className="js-colh">kopia całej tabeli customers · tablica hashująca</p>
              <CustList items={box.broadcast} />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

const execList = (indexes: number[]) => (indexes.length > 1 ? `executorach ${indexes.map(i => i + 1).join(' i ')}` : `executorze ${indexes[0] + 1}`);

/** Etap Intuicja: gdzie leżą wiersze jednego klienta, zanim cokolwiek zostanie połączone. */
export function Scatter() {
  const [id, setId] = useState(sample.customers[0].id);
  const where = whereIs(id);
  const together = where.tx.length === 1 && where.tx[0] === where.cust;
  return (
    <div className="js">
      <span className="badge sim">Ilustracja · nie Spark</span>
      <p className="small viz-assume">{scatter.assumptions}</p>
      <span className="segc" role="group" aria-label="Klient do podświetlenia">
        {sample.customers.map(c => (
          <button key={c.id} type="button" aria-pressed={id === c.id} onClick={() => setId(c.id)}>
            {scatter.pick} {c.id}
          </button>
        ))}
      </span>
      <div className="js-scene">
        <Boxes boxes={buildScene('smj', 0).boxes} highlight={id} />
      </div>
      <p className="js-say" role="status" aria-live="polite">
        {fill(together ? scatter.together : scatter.split, { id, tx: execList(where.tx), cust: execList([where.cust]) })}
      </p>
    </div>
  );
}

/**
 * Etap Mechanizm: ten sam join krok po kroku, trzema strategiami. To JavaScript, nie Spark.
 * Strategię wybiera uczący się. Każda strategia pamięta swój krok, żeby dało się je porównywać.
 */
export function JoinSim() {
  const [strategy, setStrategy] = useState<StrategyId>('bhj');
  const [steps, setSteps] = useState<Record<StrategyId, number>>({ bhj: 0, smj: 0, shj: 0 });
  const step = steps[strategy];
  const list = sim.steps[strategy];
  const last = list.length - 1;
  const scene = buildScene(strategy, step);
  const go = (to: number) => setSteps({ ...steps, [strategy]: Math.max(0, Math.min(last, to)) });

  return (
    <div className="js">
      <span className="badge sim">Symulacja w przeglądarce · nie Spark</span>
      <Html as="p" className="small viz-assume" html={sim.assumptions} />
      <span className="segc js-tabs" role="group" aria-label="Strategia joina">
        {sim.strategies.map(s => (
          <button key={s.id} type="button" aria-pressed={strategy === s.id} onClick={() => setStrategy(s.id)}>{s.label}</button>
        ))}
      </span>

      <div className="js-step" role="status" aria-live="polite" aria-atomic="true">
        <p className="viz-k">Krok {step} z {last} · {list[step].title}</p>
        <p className="js-say">{list[step].text}</p>
      </div>

      <div className="js-scene">
        {strategy === 'bhj' && (
          <div className={`js-driver${scene.driver ? ' on' : ''}`}>
            <p className="viz-k">Driver</p>
            {scene.driver ? (
              <div className="js-hash">
                <p className="js-colh">cała tabela customers · tablica hashująca</p>
                <CustList items={scene.driver} />
              </div>
            ) : (
              <p className="js-colh">nie trzyma jeszcze żadnych wierszy</p>
            )}
          </div>
        )}
        <Boxes boxes={scene.boxes} />
        <p className="js-legend" aria-hidden="true">
          <span className="moved">przeniesiony w tym kroku</span>
          <span className="hash">w pamięci jako tablica hashująca</span>
          <span className="joined">połączony</span>
        </p>
      </div>

      <div className="js-actions">
        <button type="button" className="op ghostb" disabled={step === 0} onClick={() => go(step - 1)}>← Wstecz</button>
        <button type="button" className="op act" disabled={step === last} onClick={() => go(step + 1)}>{step === 0 ? 'Zacznij' : 'Dalej'} →</button>
        {step > 0 && <button type="button" className="op ghostb" onClick={() => go(0)}>Od początku</button>}
      </div>

      <div className="js-count" aria-live="polite">
        {sim.counters.labels.map((label, i) => (
          <p key={label} className={scene.counters[i] === 0 ? 'zero' : undefined}>
            <b>{scene.counters[i]}</b>
            <span>{label}</span>
          </p>
        ))}
        {step === last && <p className="js-note">{sim.counters.notes[strategy]}</p>}
      </div>
    </div>
  );
}

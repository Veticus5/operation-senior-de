import { useState } from 'react';
import { pushdown, type RowGroup } from '@content/spark/lazy-evaluation/lesson';
import { ConceptBridge } from '../../components/ConceptBridge';
import { Html } from '../../components/Html';

const SCALE = 5000;

function Group({ n, g, limit }: { n: number; g: RowGroup; limit: number }) {
  const skipped = g.max <= limit;
  return (
    <li className={`rg${skipped ? ' skip' : ''}`}>
      <span className="rg-n">row group {n}</span>
      <span className="rg-bar" aria-hidden="true">
        <i style={{ left: `${(100 * g.min) / SCALE}%`, width: `${Math.max(2, (100 * (g.max - g.min)) / SCALE)}%` }} />
        <b style={{ left: `${(100 * limit) / SCALE}%` }} />
      </span>
      <span className="rg-range">min {g.min} · max {g.max}</span>
      <span className="rg-verdict">{skipped ? `można pominąć: max ${g.max} nie przekracza ${limit}` : `do rozważenia: max ${g.max} przekracza ${limit}`}</span>
    </li>
  );
}

/**
 * Ilustracja koncepcyjna pomijania row groups na podstawie min i max. To nie jest pomiar:
 * wartości są dobrane tak, żeby mechanizm było widać. Domyślna ścieżka to pytanie, grupy, licznik
 * i krótki wniosek. Pomiar, plan i analogia są zwinięte, każde osobno.
 */
export function RowGroups() {
  const [limit, setLimit] = useState(pushdown.defaultFilter);
  const [sorted, setSorted] = useState(true);
  const groups = sorted ? pushdown.sorted : pushdown.scattered;
  const read = groups.filter(g => g.max > limit).length;
  const skip = groups.length - read;
  return (
    <section className="zoom" aria-labelledby="zoom-title">
      <h2 id="zoom-title">{pushdown.title}</h2>
      {pushdown.intro.map((html, i) => <Html as="p" key={i} html={html} />)}

      <span className="badge sim">Symulacja koncepcyjna · nie pomiar</span>
      <Html as="p" className="small rg-assume" html={pushdown.assumptions} />
      <div className="rg-controls">
        <span className="segc" role="group" aria-label="Warunek filtra">
          {pushdown.filters.map(f => (
            <button key={f} type="button" aria-pressed={limit === f} onClick={() => setLimit(f)}>amount &gt; {f}</button>
          ))}
        </span>
        <span className="segc" role="group" aria-label="Ułożenie danych w pliku">
          <button type="button" aria-pressed={sorted} onClick={() => setSorted(true)}>dane posortowane</button>
          <button type="button" aria-pressed={!sorted} onClick={() => setSorted(false)}>dane rozsiane</button>
        </span>
      </div>
      <div className="rg-count" role="status" aria-live="polite" aria-atomic="true">
        <p>
          <b>{read}</b>
          <span>z {groups.length} grup<br />do rozważenia</span>
        </p>
        <p className="skip">
          <b>{skip}</b>
          <span>z {groups.length} grup<br />można pominąć</span>
        </p>
        {skip === 0 && <p className="rg-none">{pushdown.nothingToSkip}</p>}
      </div>
      <ul className="rgs">
        {groups.map((g, i) => <Group key={i} n={i + 1} g={g} limit={limit} />)}
      </ul>
      {pushdown.takeaway.map((html, i) => <Html as="p" key={i} className="takeaway" html={html} />)}

      <details className="deeper">
        <summary>{pushdown.measuredTitle}</summary>
        <div>
          <span className="badge">Rzeczywiste wykonanie · PySpark 4.0.1 · local[3]</span>
          {pushdown.measured.map((html, i) => <Html as="p" key={i} html={html} />)}
        </div>
      </details>
      <details className="deeper">
        <summary>{pushdown.planTitle}</summary>
        <div>
          {pushdown.plan.map((html, i) => <Html as="p" key={i} html={html} />)}
        </div>
      </details>
      <details className="deeper">
        <summary>{pushdown.bridgeTitle}</summary>
        <div>
          <ConceptBridge bridge={pushdown.bridge} here="W Parquet" />
        </div>
      </details>
    </section>
  );
}

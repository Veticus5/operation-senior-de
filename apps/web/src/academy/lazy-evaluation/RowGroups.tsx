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
      <span className="rg-verdict">{skipped ? `pominięta: max ${g.max} nie przekracza ${limit}` : `czytana: max ${g.max} przekracza ${limit}`}</span>
    </li>
  );
}

/**
 * Ilustracja koncepcyjna pomijania row groups na podstawie min i max. To nie jest pomiar:
 * wartości są dobrane tak, żeby mechanizm było widać. Pomiar na prawdziwym pliku jest pod spodem.
 */
export function RowGroups() {
  const [limit, setLimit] = useState(pushdown.defaultFilter);
  const [sorted, setSorted] = useState(true);
  const groups = sorted ? pushdown.sorted : pushdown.scattered;
  const read = groups.filter(g => g.max > limit).length;
  return (
    <section className="zoom" aria-labelledby="zoom-title">
      <h2 id="zoom-title">{pushdown.title}</h2>
      {pushdown.intro.map((html, i) => <Html as="p" key={i} html={html} />)}

      <span className="badge sim">Symulacja koncepcyjna · nie pomiar</span>
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
      <ul className="rgs">
        {groups.map((g, i) => <Group key={i} n={i + 1} g={g} limit={limit} />)}
      </ul>
      <p className="rg-sum" aria-live="polite">
        Filtr <code>amount &gt; {limit}</code>: czytnik musi przeczytać {read} z {groups.length} grup.
        {read === groups.length && ' Warunek został przekazany, ale nie ma czego pominąć.'}
      </p>
      <p className="small">{pushdown.afterSkip}</p>

      <h3>{pushdown.measuredTitle}</h3>
      <span className="badge">Rzeczywiste wykonanie · PySpark 4.0.1 · local[3]</span>
      {pushdown.measured.map((html, i) => <Html as="p" key={i} html={html} />)}
      <ConceptBridge bridge={pushdown.bridge} here="W Parquet" />
    </section>
  );
}

import { useState } from 'react';
import { keys, limits, metrics, moves } from '@content/spark/data-skew-aqe/lesson';
import { Html } from '../../components/Html';

const num = (n: number) => n.toLocaleString('pl-PL');

/** Ilustracja z etapu Intuicja: wynik GROUP BY po kluczu. Wartości wymyślone. */
export function KeyBars() {
  const max = Math.max(...keys.rows.map(r => r.count));
  return (
    <div className="sk-keys">
      <span className="badge sim">Ilustracja · nie pomiar</span>
      <pre className="code sk-query">{keys.query}</pre>
      <ul className="sk-keyrows">
        {keys.rows.map(r => (
          <li key={r.key} className={r.hot ? 'hot' : undefined}>
            <span className="sk-key">{r.key}</span>
            <span className="sk-keytrack" aria-hidden="true"><i style={{ width: `${Math.max(0.6, (100 * r.count) / max)}%` }} /></span>
            <span className="sk-keycount">{num(r.count)}</span>
          </li>
        ))}
      </ul>
      <p className="small viz-assume">{keys.caption}</p>
    </div>
  );
}

/** Dwa wymyślone podsumowania stage'a: ten sam objaw (wolny task), inna przyczyna. */
export function MetricsCases() {
  const [id, setId] = useState(metrics.cases[0].id);
  const current = metrics.cases.find(c => c.id === id) ?? metrics.cases[0];
  return (
    <div className="sk-metrics">
      <span className="badge sim">Ilustracja · nie pomiar</span>
      <p className="small viz-assume">{metrics.assumptions}</p>
      <span className="segc" role="group" aria-label="Stage">
        {metrics.cases.map(c => (
          <button key={c.id} type="button" aria-pressed={c.id === id} onClick={() => setId(c.id)}>{c.label}</button>
        ))}
      </span>
      <div role="status" aria-live="polite" aria-atomic="true">
        <table className="data sk-table">
          <thead><tr>{metrics.columns.map(c => <th key={c}>{c}</th>)}</tr></thead>
          <tbody>
            {current.rows.map(r => (
              <tr key={r.metric}>
                <td>{r.metric}</td>
                <td>{r.median}</td>
                <td className={r.flag ? 'sk-flag' : undefined}>{r.max}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="sk-verdict">{current.verdict}</p>
      </div>
    </div>
  );
}

function Parts({ values }: { values: number[] }) {
  const min = Math.min(...values);
  return (
    <span className="sk-parts" aria-hidden="true">
      {values.map((v, i) => <i key={i} className={v > min * 2 ? 'big' : undefined} style={{ flexGrow: v }} />)}
    </span>
  );
}

/** Trzy rzeczy, które AQE robi z planem po shuffle'u. Rysunek to ilustracja, zdanie „Pomiar" pochodzi z labu. */
export function AqeMoves() {
  const [id, setId] = useState(moves.items[0].id);
  const m = moves.items.find(x => x.id === id) ?? moves.items[0];
  const draw = (value: number[] | string) => (typeof value === 'string' ? <code className="sk-node">{value}</code> : <Parts values={value} />);
  return (
    <div className="sk-moves">
      <span className="badge sim">Ilustracja · pomiar podpisany osobno</span>
      <p className="small viz-assume">{moves.assumptions}</p>
      <p className="viz-k">Co AQE widzi po shuffle'u</p>
      <div className="sk-chips" role="group" aria-label="Co AQE widzi po shuffle'u">
        {moves.items.map(x => (
          <button key={x.id} type="button" className="sk-chip" aria-pressed={x.id === id} onClick={() => setId(x.id)}>{x.label}</button>
        ))}
      </div>
      <div className="sk-move" role="status" aria-live="polite" aria-atomic="true">
        <Html as="p" html={m.sees} />
        <div className="sk-ba">
          <p className="viz-k">{m.beforeLabel}</p>
          {draw(m.before)}
          <p className="viz-k">{m.afterLabel}</p>
          {draw(m.after)}
        </div>
        <Html as="p" html={`<b>Co robi AQE.</b> ${m.does}`} />
        <Html as="p" className="sk-measured" html={`<b>Pomiar · PySpark 4.0.1 · local[3].</b> ${m.measured}`} />
        <Html as="p" className="small" html={m.note} />
      </div>
    </div>
  );
}

/** Czy AQE podzieli skośną partycję: reguła progów z dokumentacji i ograniczenia operacji. */
export function AqeLimits() {
  const [mb, setMb] = useState(limits.defaultSize);
  const [opId, setOpId] = useState(limits.defaultOp);
  const op = limits.ops.find(o => o.id === opId) ?? limits.ops[0];
  const size = limits.sizes.find(s => s.mb === mb) ?? limits.sizes[0];
  const byFactor = mb > limits.factor * limits.medianMb;
  const byThreshold = mb > limits.thresholdMb;
  const sizeOk = byFactor && byThreshold;
  const verdict = sizeOk && op.ok ? limits.verdicts.yes : !sizeOk && !op.ok ? limits.verdicts.both : !sizeOk ? limits.verdicts.size : limits.verdicts.op;
  const mark = (ok: boolean) => <span className={ok ? 'ok' : 'no'}>{ok ? 'tak' : 'nie'}</span>;
  return (
    <div className="sk-limits">
      <span className="badge sim">Reguła z dokumentacji · rozmiary przykładowe</span>
      <p className="small viz-assume">{limits.assumptions}</p>
      <p className="viz-k">{limits.sizeLabel}</p>
      <span className="segc" role="group" aria-label={limits.sizeLabel}>
        {limits.sizes.map(s => (
          <button key={s.mb} type="button" aria-pressed={s.mb === mb} onClick={() => setMb(s.mb)}>{s.label}</button>
        ))}
      </span>
      <p className="viz-k sk-gap">{limits.opLabel}</p>
      <div className="sk-chips" role="group" aria-label={limits.opLabel}>
        {limits.ops.map(o => (
          <button key={o.id} type="button" className="sk-chip" aria-pressed={o.id === opId} onClick={() => setOpId(o.id)}>{o.label}</button>
        ))}
      </div>
      <div className="sk-checks" role="status" aria-live="polite" aria-atomic="true">
        <ul>
          <li>{size.label} &gt; {limits.factor} × {limits.medianMb} MB = {limits.factor * limits.medianMb} MB: {mark(byFactor)}</li>
          <li>{size.label} &gt; {limits.thresholdMb} MB: {mark(byThreshold)}</li>
          <li>Operacja pozwala dzielić tę stronę: {mark(op.ok)}</li>
        </ul>
        <p className={`sk-verdict ${sizeOk && op.ok ? 'ok' : 'no'}`}>{verdict}</p>
        <Html as="p" className="sk-cost" html={op.why} />
      </div>
    </div>
  );
}

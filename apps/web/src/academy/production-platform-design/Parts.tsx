import { useState, type ReactNode } from 'react';
import type { Compare, Scenario } from '@content/platform/production-platform-design/lesson';
import { Html } from '../../components/Html';

/** Zwinięta sekcja: treść zostaje pod nagłówkiem, a kilka sekcji może być otwartych naraz. */
export function Deeper({ title, html, children }: { title: string; html?: string[]; children?: ReactNode }) {
  return (
    <details className="deeper">
      <summary>{title}</summary>
      <div>
        {children}
        {html?.map((h, i) => <Html as="p" key={i} html={h} />)}
      </div>
    </details>
  );
}

/** Grupa przycisków wyboru jednej opcji. */
export function Chips<T extends string | number>({ label, options, value, onPick }: { label: string; options: { id: T; label: string }[]; value: T | null; onPick: (id: T) => void }) {
  return (
    <>
      <p className="viz-k pd-k">{label}</p>
      <div className="pd-chips" role="group" aria-label={label}>
        {options.map(o => (
          <button key={o.id} type="button" className="pd-chip" aria-pressed={o.id === value} onClick={() => onPick(o.id)}>{o.label}</button>
        ))}
      </div>
    </>
  );
}

/** Porównanie wariantów jednej decyzji: przełącznik, tabela „cecha → wartość", wniosek. */
export function CompareView({ data, badge = 'Porównanie · ilustracja, nie pomiar' }: { data: Compare; badge?: string }) {
  const [id, setId] = useState(data.defaultId);
  const current = data.options.find(o => o.id === id) ?? data.options[0];
  return (
    <div className="pd-box">
      <span className="badge sim">{badge}</span>
      <Html as="p" className="small viz-assume" html={data.assumptions} />
      <Chips label={data.label} options={data.options} value={id} onPick={setId} />
      <div className="pd-out" role="status" aria-live="polite" aria-atomic="true">
        <dl className="pd-dl">
          {current.rows.map(([k, v]) => (
            <div key={k}>
              <dt>{k}</dt>
              <dd><Html as="span" html={v} /></dd>
            </div>
          ))}
        </dl>
        <Html as="p" className="pd-verdict" html={current.verdict} />
      </div>
    </div>
  );
}

/** Sytuacja z wyborem: najpierw decyzja, potem uzasadnienie i jego zakres. */
export function ScenarioCard({ n, s, ask }: { n: number; s: Scenario; ask: string }) {
  const [picked, setPicked] = useState<number | null>(null);
  return (
    <div className="obs">
      <span className="num">SYTUACJA {n}</span>
      <p className="ask">{s.setup}</p>
      <p className="muted" style={{ marginBottom: 12 }}>{ask}</p>
      <div className="choices quiz-choices">
        {s.options.map((c, i) => (
          <button key={c} type="button" className={`choice${picked === null ? '' : i === s.correct ? ' ok' : i === picked ? ' no' : ''}`} disabled={picked !== null} onClick={() => setPicked(i)}>
            {c}
          </button>
        ))}
      </div>
      {picked !== null && (
        <div className="reveal on">
          <p className={`verdict ${picked === s.correct ? 'ok' : 'no'}`}>{picked === s.correct ? 'Tak, to dobry wybór.' : 'Jest lepszy wybór.'}</p>
          <p>{s.why}</p>
          <p className="scope">
            <b>Zakres.</b> <span>{s.scope}</span>
          </p>
        </div>
      )}
    </div>
  );
}

import { useId, useState } from 'react';
import type { ExplainedLine } from '@content/types';
import { Html } from './Html';

/** Przyciemnia wewnętrzne identyfikatory Sparka (#5, #9L), żeby nie zasłaniały nazw kolumn. */
function Code({ text }: { text: string }) {
  const parts = text.split(/(#\d+L?)/g);
  return <>{parts.map((part, i) => (/^#\d+L?$/.test(part) ? <span key={i} className="cx-id">{part}</span> : part))}</>;
}

/**
 * Kod albo plan zapytania, który da się przeczytać linia po linii. Kliknięcie linii pokazuje,
 * co ona znaczy. Numery pokazują kolejność czytania: plan Sparka czyta się od dołu (od źródła),
 * więc dla order="bottom-up" jedynka jest przy ostatniej linii.
 */
export function CodeExplainer({ title, lines, order = 'top-down' }: { title: string; lines: ExplainedLine[]; order?: 'top-down' | 'bottom-up' }) {
  const first = order === 'bottom-up' ? lines.length - 1 : 0;
  const [current, setCurrent] = useState(first);
  const panelId = useId();
  const step = (i: number) => (order === 'bottom-up' ? lines.length - i : i + 1);
  const line = lines[current];
  return (
    <div className="cx">
      <p className="cx-title">
        {title}
        <span>{order === 'bottom-up' ? 'czytaj od dołu, kliknij linię' : 'kliknij linię'}</span>
      </p>
      <div className="cx-lines">
        {lines.map((l, i) => (
          <button key={i} type="button" className="cx-line" aria-pressed={i === current} aria-controls={panelId} onClick={() => setCurrent(i)}>
            <i>{step(i)}</i>
            <span><Code text={l.code} /></span>
          </button>
        ))}
      </div>
      <div className="cx-panel" id={panelId} aria-live="polite">
        <p className="cx-label">
          <i>{step(current)}</i>
          {line.label}
        </p>
        <Html as="p" html={line.text} />
      </div>
    </div>
  );
}

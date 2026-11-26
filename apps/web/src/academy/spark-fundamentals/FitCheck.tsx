import { useState } from 'react';
import { fit } from '@content/spark/fundamentals/lesson';
import { Html } from '../../components/Html';

const MAX_SHOWN = 96;

/**
 * Ilustracja: ten sam zbiór raz jako całość w pamięci jednej maszyny, raz pocięty na kawałki.
 * To nie pomiar. Rozmiary i pamięć maszyny są wymyślone, żeby było widać, gdzie leży sufit.
 */
export function FitCheck() {
  const [gb, setGb] = useState(fit.defaultSize);
  const verdict = fit.verdicts[fit.sizes.indexOf(gb)];
  const chunks = Math.round((gb * 1024) / fit.chunkMb);
  const shown = Math.min(chunks, MAX_SHOWN);
  return (
    <div className="fit">
      <span className="badge sim">Ilustracja · nie pomiar</span>
      <Html as="p" className="small viz-assume" html={fit.assumptions} />
      <span className="segc" role="group" aria-label="Rozmiar zbioru danych">
        {fit.sizes.map(s => (
          <button key={s} type="button" aria-pressed={gb === s} onClick={() => setGb(s)}>{s} GB danych</button>
        ))}
      </span>

      <div className="fit-out" role="status" aria-live="polite" aria-atomic="true">
        <div className="fit-lane">
          <p className="viz-k">{fit.wholeLabel}</p>
          <div className="fit-track" aria-hidden="true">
            <i className={verdict.state} style={{ width: `${Math.min(100, (100 * gb) / fit.trackGb)}%` }} />
            <b style={{ left: `${(100 * fit.ramGb) / fit.trackGb}%` }} />
          </div>
          <p className="fit-scale" aria-hidden="true">
            <span>{gb} GB danych{gb > fit.trackGb ? ' (poza skalą)' : ''}</span>
            <span>pamięć maszyny: {fit.ramGb} GB</span>
          </p>
          <p className={`fit-verdict ${verdict.state}`}>{verdict.text}</p>
        </div>

        <div className="fit-lane">
          <p className="viz-k">{fit.chunksLabel}</p>
          <div className="fit-chunks" aria-hidden="true">
            {Array.from({ length: shown }, (_, i) => <i key={i} />)}
          </div>
          <p className="fit-scale">
            <span>
              {chunks} kawałków po ok. {fit.chunkMb} MB{chunks > shown ? ` (narysowano ${shown})` : ''}
            </span>
          </p>
          <p className="fit-verdict ok">{fit.chunksText}</p>
        </div>
      </div>
    </div>
  );
}

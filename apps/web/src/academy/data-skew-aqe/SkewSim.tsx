import { useEffect, useState } from 'react';
import { sim, type SimScenario } from '@content/spark/data-skew-aqe/lesson';
import { Html } from '../../components/Html';

const TICK_MS = 60;
/** Cała oś czasu (sim.scaleSeconds) przewija się w około 4 sekundy. */
const STEP = sim.scaleSeconds / (4000 / TICK_MS);

const seconds = (rows: number) => rows * sim.secondsPerMillion;
const fmt = (n: number) => n.toLocaleString('pl-PL', { maximumFractionDigits: 1 });
const median = (values: number[]) => {
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
};
const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/**
 * Centralna symulacja lekcji: jeden stage, każdy pasek to task, długość paska to czas pracy.
 * To JavaScript, nie Spark: czas taska jest w modelu proporcjonalny do liczby wierszy (założenia w `sim.assumptions`).
 *
 * Stan to wybrany scenariusz i `elapsed`: null przed uruchomieniem, potem sekundy modelu od startu stage'a.
 */
export function SkewSim() {
  const [id, setId] = useState(sim.defaultId);
  const [elapsed, setElapsed] = useState<number | null>(null);
  const scenario = sim.scenarios.find(s => s.id === id) as SimScenario;
  const times = scenario.tasks.map(t => seconds(t.rest + t.hot));
  const stage = Math.max(...times);
  const mid = median(times);
  const running = elapsed !== null && elapsed < stage;
  const finished = elapsed !== null && elapsed >= stage;
  const done = elapsed === null ? 0 : times.filter(t => t <= elapsed).length;

  useEffect(() => {
    if (!running) return;
    const timer = setTimeout(() => setElapsed(e => (e === null ? e : Math.min(stage, e + STEP))), TICK_MS);
    return () => clearTimeout(timer);
  }, [running, elapsed, stage]);

  const start = () => setElapsed(reducedMotion() ? stage : 0);
  const pick = (next: string) => {
    setId(next);
    // Zmiana scenariusza od razu uruchamia stage, żeby porównanie nie wymagało dwóch kliknięć.
    const s = sim.scenarios.find(x => x.id === next) as SimScenario;
    setElapsed(reducedMotion() ? Math.max(...s.tasks.map(t => seconds(t.rest + t.hot))) : 0);
  };
  const fixes = sim.scenarios.filter(s => s.skewed);

  return (
    <div className="sk">
      <span className="badge sim">Symulacja w przeglądarce · czasy ilustracyjne, nie pomiar</span>
      <Html as="p" className="small viz-assume" html={sim.assumptions} />

      <div className="sk-controls">
        <p className="viz-k">{sim.dataLabel}</p>
        <span className="segc" role="group" aria-label={sim.dataLabel}>
          <button type="button" aria-pressed={!scenario.skewed} onClick={() => pick('even')}>Równe</button>
          <button type="button" aria-pressed={scenario.skewed} onClick={() => pick(scenario.skewed ? id : 'skew')}>Skośne: jeden gorący klucz</button>
        </span>
        <div className="sk-fix" hidden={!scenario.skewed}>
          <p className="viz-k">{sim.fixLabel}</p>
          <div className="sk-chips" role="group" aria-label={sim.fixLabel}>
            {fixes.map(s => (
              <button key={s.id} type="button" className="sk-chip" aria-pressed={s.id === id} onClick={() => pick(s.id)}>
                {s.id === 'skew' ? 'Nic' : s.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="sk-count">
        <p><b>{scenario.tasks.length}</b><span>liczba<br />tasków</span></p>
        <p><b>{fmt(mid)} s</b><span>mediana<br />czasu taska</span></p>
        <p className={stage > mid * 2 ? 'hot' : undefined}><b>{fmt(stage)} s</b><span>najdłuższy task<br />= czas stage'a w tym modelu</span></p>
      </div>

      <div className="sk-scene">
        <p className="viz-k sk-clock">
          <span>Stage joina · oś czasu 0–{sim.scaleSeconds} s</span>
          <span>{elapsed === null ? 'przed uruchomieniem' : `czas: ${fmt(Math.min(elapsed, stage))} s · skończone ${done} z ${times.length}`}</span>
        </p>
        <ul className={`sk-tasks${times.length > 10 ? ' dense' : ''}`}>
          {scenario.tasks.map((t, i) => {
            const total = times[i];
            const progress = elapsed === null ? 0 : Math.min(1, elapsed / total);
            const state = progress >= 1 ? 'done' : elapsed === null ? 'wait' : 'run';
            const segments = (
              <>
                <i className="rest" style={{ flexGrow: t.rest }} />
                {t.hot > 0 && <i className="hot" style={{ flexGrow: t.hot }} />}
              </>
            );
            return (
              <li key={i} className={`sk-task ${state}`}>
                <span className="sk-n" aria-hidden="true">t{i + 1}</span>
                <span className="sk-track" aria-hidden="true">
                  <span className="sk-bar" style={{ width: `${(100 * total) / sim.scaleSeconds}%` }}>
                    <span className="sk-ghost">{segments}</span>
                    <span className="sk-fill" style={{ clipPath: `inset(0 ${100 - progress * 100}% 0 0)` }}>{segments}</span>
                  </span>
                </span>
                <span className="sk-t" aria-hidden="true">{fmt(total)} s{state === 'done' ? ' ✓' : ''}</span>
                <span className="sr">
                  task {i + 1}: {fmt(t.rest + t.hot)} mln wierszy{t.hot > 0 ? `, w tym ${fmt(t.hot)} mln gorącego klucza` : ''}, {fmt(total)} s
                </span>
              </li>
            );
          })}
        </ul>
        <p className="sk-legend" aria-hidden="true">
          <span className="rest">zwykłe klucze</span>
          <span className="hot">gorący klucz</span>
        </p>
      </div>

      <div className="sk-out" role="status" aria-live="polite" aria-atomic="true">
        {finished ? (
          <>
            <p className="sk-verdict">{scenario.verdict}</p>
            <p className="sk-cost"><b>{scenario.skewed && scenario.id !== 'skew' ? 'Koszt i warunki.' : 'Uwaga.'}</b> {scenario.cost}</p>
          </>
        ) : (
          <p className="sk-verdict muted">{running ? 'Stage trwa, dopóki pracuje choć jeden task.' : 'Uruchom stage i zobacz, kiedy skończy się ostatni task.'}</p>
        )}
      </div>

      <div className="sk-actions">
        <button type="button" className="op act" disabled={running} onClick={start}>
          {finished ? 'Uruchom jeszcze raz' : 'Uruchom stage'}
        </button>
      </div>
    </div>
  );
}

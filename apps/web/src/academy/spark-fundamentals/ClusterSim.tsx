import { useEffect, useState } from 'react';
import { cluster } from '@content/spark/fundamentals/lesson';
import { Html } from '../../components/Html';

const TICK_MS = 1100;

const fill = (text: string, values: Record<string, number>) => text.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? ''));

/**
 * Symulacja klastra: driver rozdaje taski (jeden na partycję) executorom, a każdy rdzeń liczy jeden task naraz.
 * To JavaScript, nie Spark. Założenia modelu są w `cluster.assumptions` i zawsze widać je nad sceną.
 *
 * Stan to jeden licznik `step`: 0 = przed uruchomieniem, 1..rounds = trwa dana tura, rounds + 1 = koniec.
 */
export function ClusterSim() {
  const [executors, setExecutors] = useState(cluster.defaultExecutors);
  const [partitions, setPartitions] = useState(cluster.defaultPartitions);
  const [step, setStep] = useState(0);

  const slots = executors * cluster.coresPerExecutor;
  const busy = Math.min(partitions, slots);
  const idle = slots - busy;
  const rounds = Math.ceil(partitions / slots);
  const running = step >= 1 && step <= rounds;
  const finished = step > rounds;
  const values = { tasks: partitions, busy, idle, slots, rounds, round: step };

  useEffect(() => {
    if (!running) return;
    const timer = setTimeout(() => setStep(s => s + 1), TICK_MS);
    return () => clearTimeout(timer);
  }, [running, step]);

  const change = (apply: () => void) => {
    apply();
    setStep(0);
  };

  /** Numer partycji liczonej teraz przez dany rdzeń albo null, gdy rdzeń stoi. */
  const partitionOn = (slot: number): number | null => {
    if (!running) return null;
    const p = (step - 1) * slots + slot;
    return p < partitions ? p + 1 : null;
  };
  const stateOf = (p: number): 'wait' | 'run' | 'done' => {
    if (finished) return 'done';
    if (!running) return 'wait';
    const first = (step - 1) * slots;
    return p < first ? 'done' : p < first + slots ? 'run' : 'wait';
  };

  const summary = idle > 0 ? cluster.messages.idle : rounds > 1 ? cluster.messages.waiting : cluster.messages.allAtOnce;
  const driverText = finished ? cluster.driver.done : running ? cluster.driver.running : cluster.driver.idle;

  return (
    <div className="cl">
      <span className="badge sim">Symulacja w przeglądarce · nie Spark</span>
      <Html as="p" className="small viz-assume" html={cluster.assumptions} />
      <div className="cl-controls">
        <span className="segc" role="group" aria-label="Liczba executorów">
          {cluster.executors.map(n => (
            <button key={n} type="button" aria-pressed={executors === n} onClick={() => change(() => setExecutors(n))}>
              {n} {n === 1 ? 'executor' : n < 5 ? 'executory' : 'executorów'}
            </button>
          ))}
        </span>
        <span className="segc" role="group" aria-label="Liczba partycji">
          {cluster.partitions.map(n => (
            <button key={n} type="button" aria-pressed={partitions === n} onClick={() => change(() => setPartitions(n))}>
              {n} {n < 5 ? 'partycje' : 'partycji'}
            </button>
          ))}
        </span>
      </div>

      <div className="cl-count" role="status" aria-live="polite" aria-atomic="true">
        <p><b>{partitions}</b><span>liczba<br />tasków</span></p>
        <p><b>{busy}</b><span>liczonych<br />jednocześnie</span></p>
        <p><b>{rounds}</b><span>liczba<br />tur</span></p>
        <p className="cl-sum">{fill(summary, values)}</p>
      </div>

      <div className="cl-scene">
        <div className={`cl-driver${running ? ' on' : ''}`}>
          <p className="viz-k">Driver · Twój program</p>
          <p className="cl-say" aria-live="polite">{fill(driverText, values)}</p>
        </div>
        <div className="cl-wire" aria-hidden="true" />
        <div className="cl-execs" data-n={executors}>
          {Array.from({ length: executors }, (_, e) => (
            <div className="cl-exec" key={e}>
              <p className="viz-k">Executor {e + 1}</p>
              <div className="cl-slots">
                {Array.from({ length: cluster.coresPerExecutor }, (_, c) => {
                  const p = partitionOn(e * cluster.coresPerExecutor + c);
                  return (
                    <span key={c} className={`cl-slot${p ? ' busy' : ''}`}>
                      {p ? `task · p${p}` : 'wolny rdzeń'}
                    </span>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        <div className="cl-data">
          <p className="viz-k">Dane · {partitions} {partitions < 5 ? 'partycje' : 'partycji'}</p>
          <ul className="cl-parts">
            {Array.from({ length: partitions }, (_, p) => {
              const state = stateOf(p);
              return (
                <li key={p} className={`cl-part ${state}`}>
                  <span aria-hidden="true">p{p + 1}</span>
                  <span className="sr">partycja {p + 1}: {state === 'done' ? 'policzona' : state === 'run' ? 'liczona' : 'czeka'}</span>
                </li>
              );
            })}
          </ul>
          <p className="cl-legend" aria-hidden="true">
            <span className="wait">czeka</span>
            <span className="run">liczona</span>
            <span className="done">policzona</span>
          </p>
        </div>
      </div>

      <div className="cl-actions">
        <button type="button" className="op act" disabled={running} onClick={() => setStep(1)}>
          {finished ? 'Uruchom jeszcze raz' : 'Uruchom zapytanie'}
        </button>
        {step > 0 && (
          <button type="button" className="op ghostb" onClick={() => setStep(0)}>Wyczyść</button>
        )}
      </div>
    </div>
  );
}

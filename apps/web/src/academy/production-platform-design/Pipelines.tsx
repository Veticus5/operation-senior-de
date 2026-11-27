import { useState } from 'react';
import { pipelines } from '@content/platform/production-platform-design/lesson';
import { Html } from '../../components/Html';
import { Chips } from './Parts';
import { dedupe, hwmRuns, retryCount, retryRows, retryTotal, type DedupKey, type RetryStrategy } from './model';

const { hwm, retry, dedup, backfill, dag } = pipelines;

const clock = (minutes: number) => `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
const zl = (n: number) => `${n.toLocaleString('pl-PL')} zł`;

const HWM_STATUS = { waiting: 'jeszcze nie pobrany', loaded: 'załadowany', duplicate: 'załadowany kilka razy', missed: 'zgubiony' } as const;

/** Oś czasu ładowania przyrostowego: kropka to updated_at, kreska to czas do zatwierdzenia, pionowe linie to ładowania. */
export function HwmSim() {
  const [windowId, setWindowId] = useState('strict');
  const [write, setWrite] = useState<'append' | 'merge'>('append');
  const [runs, setRuns] = useState(0);
  const lookback = windowId === 'lookback' ? hwm.lookbackMinutes : 0;
  const result = hwmRuns(hwm.versions, hwm.runs, lookback, write, runs);
  const [from, to] = hwm.axis;
  const pos = (t: number) => `${(100 * (t - from)) / (to - from)}%`;
  const done = runs >= hwm.runs.length;
  const lastRead = runs > 0 ? result.reads[runs - 1] : [];
  return (
    <div className="pd-box">
      <span className="badge sim">Symulacja w przeglądarce · dane i godziny wymyślone</span>
      <Html as="p" className="small viz-assume" html={hwm.assumptions} />
      <div className="pd-controls">
        <div><Chips label={hwm.windowLabel} options={hwm.windows} value={windowId} onPick={v => { setWindowId(v); setRuns(0); }} /></div>
        <div><Chips label={hwm.writeLabel} options={hwm.writes} value={write} onPick={v => { setWrite(v as 'append' | 'merge'); setRuns(0); }} /></div>
      </div>

      <div className="pd-timeline" aria-hidden="true">
        <div className="pd-tl-head">
          <span />
          <div className="pd-track">
            {hwm.runs.map((t, i) => <i key={t} className={`pd-runlabel${i < runs ? ' on' : ''}`} style={{ left: pos(t) }}>{clock(t)}</i>)}
          </div>
        </div>
        {hwm.versions.map(v => (
          <div key={v.id} className={`pd-tl-row ${result.status[v.id]}`}>
            <span className="pd-tl-key">{v.key}</span>
            <div className="pd-track">
              {hwm.runs.map((t, i) => <i key={t} className={`pd-run${i < runs ? ' on' : ''}`} style={{ left: pos(t) }} />)}
              {result.mark !== null && <i className="pd-mark" style={{ left: pos(result.mark) }} />}
              {v.visibleAt > v.updatedAt && <i className="pd-tail" style={{ left: pos(v.updatedAt), width: `calc(${pos(v.visibleAt)} - ${pos(v.updatedAt)})` }} />}
              <i className="pd-dot" style={{ left: pos(v.updatedAt) }} />
            </div>
          </div>
        ))}
        <p className="pd-legend">
          <span className="loaded">załadowany</span>
          <span className="duplicate">zdublowany</span>
          <span className="missed">zgubiony</span>
          <span className="mark">znacznik</span>
        </p>
      </div>
      <ul className="sr">
        {hwm.versions.map(v => (
          <li key={v.id}>{v.key}: updated_at {clock(v.updatedAt)}, widoczny od {clock(v.visibleAt)}, {HWM_STATUS[result.status[v.id]]}</li>
        ))}
      </ul>

      <div className="pd-count">
        <p><b>{result.mark === null ? '–' : clock(result.mark)}</b><span>znacznik po<br />ładowaniu</span></p>
        <p><b>{result.targetRows}</b><span>wierszy<br />w celu</span></p>
        <p className={result.missed ? 'hot' : undefined}><b>{result.missed}</b><span>zgubionych</span></p>
        <p className={result.duplicates ? 'hot' : undefined}><b>{result.duplicates}</b><span>duplikatów</span></p>
      </div>

      <div className="pd-out" role="status" aria-live="polite" aria-atomic="true">
        {runs === 0 ? (
          <p className="pd-verdict muted">{hwm.idle}</p>
        ) : done ? (
          <p className={`pd-verdict ${result.missed || result.duplicates ? 'no' : 'ok'}`}>{hwm.verdicts[`${windowId}|${write}`]}</p>
        ) : (
          <p className="pd-verdict muted">Ładowanie o {clock(hwm.runs[runs - 1])} przeczytało {lastRead.length} {lastRead.length === 1 ? 'wiersz' : lastRead.length < 5 ? 'wiersze' : 'wierszy'}. Znacznik: {result.mark === null ? 'brak' : clock(result.mark)}.</p>
        )}
      </div>
      <div className="pd-actions">
        <button type="button" className="op act" disabled={done} onClick={() => setRuns(runs + 1)}>
          {done ? 'Wszystkie ładowania wykonane' : `Uruchom ładowanie o ${clock(hwm.runs[runs])}`}
        </button>
        {runs > 0 && <button type="button" className="op" onClick={() => setRuns(0)}>Od początku</button>}
      </div>
    </div>
  );
}

/** Nieudane uruchomienie i ponowienia: stan tabeli docelowej po każdym kroku dla trzech sposobów zapisu. */
export function RetrySim() {
  const [strategyId, setStrategyId] = useState<RetryStrategy>('append');
  const [step, setStep] = useState(0);
  const strategy = retry.strategies.find(s => s.id === strategyId) ?? retry.strategies[0];
  const rows = retryRows(retry.batch, retry.chunk, retry.chunksBeforeCrash, strategyId, step);
  const expected = retry.batch.reduce((n, p) => n + p.amount, 0);
  const total = retryTotal(rows);
  const count = retryCount(rows);
  const last = retry.steps.length - 1;
  const good = total === expected && count === retry.batch.length;
  return (
    <div className="pd-box">
      <span className="badge sim">Symulacja w przeglądarce · dane wymyślone</span>
      <Html as="p" className="small viz-assume" html={retry.assumptions} />
      <Chips label={retry.strategyLabel} options={retry.strategies} value={strategyId} onPick={v => { setStrategyId(v as RetryStrategy); setStep(0); }} />
      <p className="small pd-how">{strategy.how}</p>

      <p className="viz-k pd-k">Tabela docelowa · {retry.steps[step]}</p>
      <ul className="pd-rows" aria-label="Wiersze w tabeli docelowej">
        {rows.map(r => (
          <li key={r.id} className={r.copies === 0 ? 'none' : r.copies > 1 ? 'dup' : 'one'}>
            <span>{r.id}</span>
            <b>{r.copies === 0 ? 'brak' : `× ${r.copies}`}</b>
          </li>
        ))}
      </ul>
      <div className="pd-count">
        <p className={step > 0 && count !== retry.batch.length ? 'hot' : undefined}><b>{count}</b><span>wierszy<br />(powinno być {retry.batch.length})</span></p>
        <p className={step > 0 && total !== expected ? 'hot' : undefined}><b>{zl(total)}</b><span>suma<br />(powinna być {zl(expected)})</span></p>
      </div>
      <div className="pd-out" role="status" aria-live="polite" aria-atomic="true">
        {step === 0
          ? <p className="pd-verdict muted">Uruchom job. Pierwsze uruchomienie straci połączenie po dwóch porcjach.</p>
          : <p className={`pd-verdict ${good ? 'ok' : 'no'}`}>{strategy.verdicts[step - 1]}</p>}
      </div>
      <div className="pd-actions">
        <button type="button" className="op act" disabled={step >= last} onClick={() => setStep(step + 1)}>
          {step === 0 ? 'Uruchom job' : step === 1 ? 'Ponów' : step === 2 ? 'Ponów jeszcze raz' : 'Koniec scenariusza'}
        </button>
        {step > 0 && <button type="button" className="op" onClick={() => setStep(0)}>Od początku</button>}
      </div>
    </div>
  );
}

/** Ćwiczenie: wybór klucza deduplikacji. Prawda o każdym zdarzeniu odsłania się po wyborze. */
export function DedupExercise() {
  const [key, setKey] = useState<DedupKey | null>(null);
  const kept = key === null ? null : new Set(dedupe(dedup.events, key));
  const total = kept === null ? null : dedup.events.filter(e => kept.has(e.n)).reduce((n, e) => n + e.amount, 0);
  const choice = dedup.keys.find(k => k.id === key);
  return (
    <div className="pd-box">
      <span className="badge sim">Ćwiczenie · dane wymyślone</span>
      <Html as="p" className="small viz-assume" html={dedup.assumptions} />
      <div className="pd-scroll">
        <table className="data pd-table pd-events">
          <thead>
            <tr><th>#</th><th>event_id</th><th>user_id</th><th>kwota</th><th>czas</th><th>{kept ? 'wynik' : ''}</th></tr>
          </thead>
          <tbody>
            {dedup.events.map(e => {
              const state = kept === null ? '' : kept.has(e.n) ? 'kept' : 'dropped';
              return (
                <tr key={e.n} className={state ? `pd-${state}` : undefined}>
                  <td>{e.n}</td><td>{e.eventId}</td><td>{e.userId}</td><td>{e.amount}</td><td>{e.at}</td>
                  <td className="pd-note">{kept === null ? '' : `${kept.has(e.n) ? 'policzone' : 'odrzucone'} · ${e.truth}`}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <Chips label={dedup.keyLabel} options={dedup.keys} value={key} onPick={v => setKey(v as DedupKey)} />
      <div className="pd-out" role="status" aria-live="polite" aria-atomic="true">
        {total === null || !choice ? (
          <p className="pd-verdict muted">Wybierz klucz. Zobaczysz, które zdarzenia zostały policzone i czym naprawdę były.</p>
        ) : (
          <>
            <div className="pd-count">
              <p className={total !== dedup.expectedTotal ? 'hot' : undefined}><b>{zl(total)}</b><span>policzony przychód<br />(prawdziwy: {zl(dedup.expectedTotal)})</span></p>
            </div>
            <p className={`pd-verdict ${total === dedup.expectedTotal ? 'ok' : 'no'}`}>{choice.verdict}</p>
          </>
        )}
      </div>
    </div>
  );
}

/** Scenariusz backfillu: cztery decyzje po kolei, pasek dni pokazuje stan po każdej. */
export function BackfillScenario() {
  const [picks, setPicks] = useState<number[]>([]);
  const answered = picks.length;
  const state = answered === 0 ? 'wrong' : backfill.steps[answered - 1].days;
  return (
    <div className="pd-box">
      <span className="badge sim">Scenariusz · dane wymyślone</span>
      <Html as="p" className="small viz-assume" html={backfill.assumptions} />
      <p className="viz-k pd-k">fct_revenue_daily · listopad</p>
      <ol className="pd-days" aria-label="Stan dni w tabeli">
        {backfill.dayLabels.map((d, i) => {
          const s = backfill.affected.includes(i) ? state : 'ok';
          return (
            <li key={d} className={s}>
              <b>{d}</b>
              <span>{backfill.legend[s]}</span>
            </li>
          );
        })}
      </ol>
      {backfill.steps.slice(0, Math.min(answered + 1, backfill.steps.length)).map((s, n) => {
        const picked = picks[n];
        const isAnswered = picked !== undefined;
        return (
          <div className="pd-step" key={n}>
            <p className="task-n">DECYZJA {n + 1} Z {backfill.steps.length}</p>
            <p className="ask">{s.ask}</p>
            <div className="choices quiz-choices">
              {s.options.map((o, i) => (
                <button key={o} type="button" className={`choice${!isAnswered ? '' : i === s.correct ? ' ok' : i === picked ? ' no' : ''}`} disabled={isAnswered} onClick={() => setPicks([...picks, i])}>
                  {o}
                </button>
              ))}
            </div>
            {isAnswered && (
              <div className={`fb on ${picked === s.correct ? 'ok' : 'no'}`}>
                <p>{s.why}</p>
              </div>
            )}
          </div>
        );
      })}
      {answered > 0 && (
        <div className="pd-actions">
          <button type="button" className="op" onClick={() => setPicks([])}>Od początku</button>
        </div>
      )}
    </div>
  );
}

const DAG_MARK = { ok: 'wykonane', fail: 'niepowodzenie', skip: 'pominięte' } as const;

/** Zależności nocnego przebiegu: co się uruchomiło, co padło, co zostało pominięte. */
export function DagGate() {
  const [id, setId] = useState(dag.defaultId);
  const current = dag.cases.find(c => c.id === id) ?? dag.cases[0];
  return (
    <div className="pd-box">
      <span className="badge sim">Ilustracja · nie pomiar</span>
      <Html as="p" className="small viz-assume" html={dag.assumptions} />
      <Chips label={dag.label} options={dag.cases} value={id} onPick={setId} />
      <div className="pd-out" role="status" aria-live="polite" aria-atomic="true">
        <ol className="pd-dag">
          {dag.tasks.map((t, i) => (
            <li key={t.id} className={current.status[i]}>
              <span>{t.label}</span>
              <b>{DAG_MARK[current.status[i]]}</b>
            </li>
          ))}
        </ol>
        <p className="pd-dash"><b>Co widzi odbiorca.</b> {current.dashboard}</p>
        <p className={`pd-verdict ${current.status.includes('fail') ? '' : 'ok'}`}>{current.verdict}</p>
      </div>
    </div>
  );
}

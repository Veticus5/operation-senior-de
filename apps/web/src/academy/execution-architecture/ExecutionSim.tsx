import { useState } from 'react';
import { flow, type SimJob, type SimStage } from '@content/spark/execution-architecture/lesson';
import { Html } from '../../components/Html';

type Mode = 'off' | 'on';
type Selection = { kind: 'job'; job: number } | { kind: 'stage'; id: number };
type State = 'wait' | 'run' | 'done' | 'skip';

const MAX_SQUARES = 200;
const STATE_LABEL: Record<State, string> = { wait: 'czeka', run: 'liczy się', done: 'gotowy', skip: 'pominięty' };

const plural = (n: number, one: string, few: string, many: string) => {
  const d = n % 10, h = n % 100;
  return n === 1 ? one : d >= 2 && d <= 4 && !(h >= 12 && h <= 14) ? few : many;
};
const stagesWord = (n: number) => plural(n, 'stage', `stage'e`, `stage'y`);
const tasksWord = (n: number) => plural(n, 'task', 'taski', 'tasków');
const doneWord = (n: number) => plural(n, 'wykonany', 'wykonane', 'wykonanych');
const skippedWord = (n: number) => plural(n, 'pominięty', 'pominięte', 'pominiętych');
const jobsWord = (n: number) => plural(n, 'job', 'joby', 'jobów');

const executed = (job: SimJob) => job.stages.filter(s => !s.skipped);
const taskCount = (stages: SimStage[]) => stages.reduce((n, s) => n + s.tasks, 0);

/**
 * Symulator: jak jedna akcja rozkłada się na joby, stage'e i taski. Struktura każdego wariantu
 * (liczba jobów, stage'y, tasków, rekordów w shuffle'u) pochodzi z labu i leży w treści lekcji.
 * Animacją jest tylko przejście krok po kroku. To JavaScript, nie Spark.
 *
 * Stan: wybrane zapytanie, tryb AQE, numer kroku (0 = przed akcją) i zaznaczony job albo stage.
 */
export function ExecutionSim() {
  const [queryId, setQueryId] = useState(flow.defaultQuery);
  const [mode, setMode] = useState<Mode>('off');
  const [step, setStep] = useState(0);
  const [selected, setSelected] = useState<Selection>({ kind: 'job', job: 0 });

  const query = flow.queries.find(q => q.id === queryId) ?? flow.queries[0];
  const scenario = query[mode];
  const steps = scenario.steps;
  const current = step > 0 ? steps[step - 1] : null;
  const finished = step === steps.length;

  const reset = (apply: () => void) => {
    apply();
    setStep(0);
    setSelected({ kind: 'job', job: 0 });
  };

  const stateOf = (s: SimStage): State => {
    if (s.skipped) return 'skip';
    if (current?.run.includes(s.id)) return 'run';
    return steps.slice(0, Math.max(0, step - 1)).some(x => x.run.includes(s.id)) ? 'done' : 'wait';
  };
  const jobState = (job: SimJob): State => {
    const states = executed(job).map(stateOf);
    return states.includes('run') ? 'run' : states.every(s => s === 'done') ? 'done' : 'wait';
  };
  /** Wiersze stage'y joba: najpierw pominięte, potem wykonane, pogrupowane według kroku, w którym ruszają. */
  const rowsOf = (job: SimJob): SimStage[][] => {
    const skipped = job.stages.filter(s => s.skipped);
    const byStep = new Map<number, SimStage[]>();
    for (const s of executed(job)) {
      const at = steps.findIndex(x => x.run.includes(s.id));
      byStep.set(at, [...(byStep.get(at) ?? []), s]);
    }
    const rows = [...byStep.entries()].sort((a, b) => a[0] - b[0]).map(([, row]) => row);
    return skipped.length ? [skipped, ...rows] : rows;
  };

  const allExecuted = scenario.jobs.flatMap(executed);
  const skippedCount = scenario.jobs.flatMap(j => j.stages).length - allExecuted.length;

  const selectedJob = selected.kind === 'job' ? scenario.jobs[selected.job] : undefined;
  const selectedStage = selected.kind === 'stage' ? scenario.jobs.flatMap(j => j.stages).find(s => s.id === selected.id) : undefined;
  const role = selectedStage ? flow.roles[selectedStage.role] : undefined;

  return (
    <div className="exs">
      <span className="badge sim">Symulacja w przeglądarce · struktura z prawdziwego Sparka</span>
      <Html as="p" className="small viz-assume" html={flow.assumptions} />

      <div className="exs-controls">
        <span className="segc" role="group" aria-label="Zapytanie">
          {flow.queries.map(q => (
            <button key={q.id} type="button" aria-pressed={q.id === query.id} onClick={() => reset(() => setQueryId(q.id))}>{q.label}</button>
          ))}
        </span>
        <span className="segc" role="group" aria-label="Adaptive Query Execution">
          {(['off', 'on'] as Mode[]).map(m => (
            <button key={m} type="button" aria-pressed={m === mode} onClick={() => reset(() => setMode(m))}>{flow.modes[m]}</button>
          ))}
        </span>
      </div>

      <div className="exs-grid">
        <div className="exs-left">
          <pre className="code exs-code">{query.code}</pre>
          <p className="small exs-note">{query.note}</p>

          <div className="exs-count" role="status" aria-live="polite" aria-atomic="true">
            <p><b>{scenario.jobs.length}</b><span>{jobsWord(scenario.jobs.length)}</span></p>
            <p><b>{allExecuted.length}</b><span>{stagesWord(allExecuted.length)}<br />{doneWord(allExecuted.length)}</span></p>
            <p><b>{taskCount(allExecuted)}</b><span>{tasksWord(taskCount(allExecuted))}<br />{doneWord(taskCount(allExecuted))}</span></p>
            {skippedCount > 0 && <p className="skip"><b>{skippedCount}</b><span>{stagesWord(skippedCount)}<br />{skippedWord(skippedCount)}</span></p>}
          </div>

          <div className="exs-scene">
            <div className={`exs-driver${current && !finished ? ' on' : ''}`}>
              <p className="viz-k">
                <span>Driver</span>
                <span>{step === 0 ? 'przed akcją' : `krok ${step} z ${steps.length}`}</span>
              </p>
              <Html as="p" className="exs-say" html={current ? current.say : flow.idle} />
            </div>

            <ol className="exs-jobs">
              {scenario.jobs.map((job, j) => {
                const state = step === 0 ? 'wait' : jobState(job);
                const done = executed(job);
                return (
                  <li key={j} className={`exs-job ${state}`}>
                    <button type="button" className="exs-jobhead" aria-pressed={selected.kind === 'job' && selected.job === j} onClick={() => setSelected({ kind: 'job', job: j })}>
                      <b>Job {j}</b>
                      <span>{done.length} {stagesWord(done.length)} · {taskCount(done)} {tasksWord(taskCount(done))}</span>
                    </button>
                    {rowsOf(job).map((row, r) => (
                      <div key={r} className="exs-rowwrap">
                        {r > 0 && <p className="exs-cut" aria-hidden="true"><span>{flow.shuffle}</span></p>}
                        <ol className={`exs-row${row[0].skipped ? ' skipped' : ''}`} data-n={row.length}>
                          {row.map(s => {
                            const st = stateOf(s);
                            const shown = Math.min(s.tasks, MAX_SQUARES);
                            return (
                              <li key={s.id}>
                                <button type="button" className={`exs-stage ${st}`} aria-pressed={selected.kind === 'stage' && selected.id === s.id} onClick={() => setSelected({ kind: 'stage', id: s.id })}>
                                  <span className="exs-stage-h">
                                    <b>Stage {s.id}</b>
                                    {!s.skipped && <em>{STATE_LABEL[st]}</em>}
                                  </span>
                                  {!s.skipped && <span className="exs-stage-t">{flow.roles[s.role].title}</span>}
                                  {!s.skipped && (
                                    <span className="exs-tasks" aria-hidden="true">
                                      {Array.from({ length: shown }, (_, i) => <i key={i} className={st === 'run' && i < flow.cores ? 'run' : undefined} />)}
                                    </span>
                                  )}
                                  <span className="exs-stage-n">{s.skipped ? 'pominięty' : `${s.tasks} ${tasksWord(s.tasks)}`}</span>
                                </button>
                              </li>
                            );
                          })}
                        </ol>
                      </div>
                    ))}
                  </li>
                );
              })}
            </ol>

            <p className="exs-legend" aria-hidden="true">
              <span className="wait">czeka</span>
              <span className="run">liczy się</span>
              <span className="done">gotowy</span>
              <span className="skip">pominięty</span>
              <span className="sq">kwadrat = 1 task</span>
            </p>
          </div>

          <div className="exs-actions">
            <button type="button" className="op act" disabled={finished} onClick={() => setStep(step + 1)}>
              {step === 0 ? 'Wywołaj akcję' : finished ? 'Koniec' : 'Następny krok'}
            </button>
            {step > 0 && <button type="button" className="op ghostb" onClick={() => setStep(0)}>Od początku</button>}
          </div>
        </div>

        <aside className="exs-inspect" aria-live="polite" aria-label="Szczegóły zaznaczonego elementu">
          {selectedJob && (
            <>
              <p className="viz-k">{flow.inspect.job}</p>
              <h3>Job {selected.kind === 'job' ? selected.job : 0}</h3>
              <Html as="p" html={selectedJob.why} />
              <dl>
                <dt>Zawartość</dt>
                <dd>
                  {executed(selectedJob).length} {stagesWord(executed(selectedJob).length)} do wykonania, razem {taskCount(executed(selectedJob))} {tasksWord(taskCount(executed(selectedJob)))}
                  {selectedJob.stages.some(s => s.skipped) ? `. Pominięte: ${selectedJob.stages.filter(s => s.skipped).length}.` : '.'}
                </dd>
              </dl>
              <p className="small">{flow.jobNote}</p>
            </>
          )}
          {selectedStage && role && (
            <>
              <p className="viz-k">{flow.inspect.stage} · {STATE_LABEL[stateOf(selectedStage)]}</p>
              <h3>Stage {selectedStage.id}: {role.title}</h3>
              <dl>
                <dt>{flow.inspect.does}</dt>
                <dd className="exs-ops">{role.ops.map((op, i) => <span key={i}>{op}</span>)}</dd>
                <dt>{flow.inspect.tasks}</dt>
                <dd><Html as="span" html={selectedStage.tasksWhy} /></dd>
                {!selectedStage.skipped && (
                  <>
                    <dt>{flow.inspect.input}</dt>
                    <dd><Html as="span" html={role.input} /></dd>
                    <dt>{flow.inspect.output}</dt>
                    <dd><Html as="span" html={selectedStage.output ?? role.output} /></dd>
                  </>
                )}
              </dl>
            </>
          )}
          <p className="small exs-hint">{flow.inspect.hint}</p>
        </aside>
      </div>
    </div>
  );
}

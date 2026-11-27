import { useState } from 'react';
import { cdf, clustering, compaction, conflict, crash, log, merge, schema, stack, timeTravel, versus, type Row } from '@content/databricks/platform-delta-lake/lesson';
import { commitFile, mergeRows, removedOn, snapshot, vacuumed, versionStatus, written, type MergeTag } from './engine';

const SIM_BADGE = 'Symulacja w przeglądarce · model, nie pomiar';
const ILLUSTRATION_BADGE = 'Ilustracja · nie pomiar';
const rowsLabel = (n: number) => (n === 1 ? '1 wiersz' : n < 5 ? `${n} wiersze` : `${n} wierszy`);

/** Etap Intuicja, krok 1: job padł po dwóch z czterech plików. Co widzi czytelnik? */
export function CrashDemo() {
  const [id, setId] = useState(crash.modes[0].id);
  const mode = crash.modes.find(m => m.id === id) ?? crash.modes[0];
  const delta = mode.id === 'delta';
  const oldRows = crash.oldFiles.reduce((n, f) => n + f.rows, 0);
  const orphanRows = crash.newFiles.filter(f => f.written).reduce((n, f) => n + f.rows, 0);
  const seen = delta ? oldRows : oldRows + orphanRows;
  return (
    <div className="dl">
      <span className="badge sim">{ILLUSTRATION_BADGE}</span>
      <p className="small viz-assume">{crash.caption}</p>
      <span className="segc" role="group" aria-label="Rodzaj tabeli">
        {crash.modes.map(m => (
          <button key={m.id} type="button" aria-pressed={m.id === id} onClick={() => setId(m.id)}>{m.label}</button>
        ))}
      </span>
      <div className="dl-scene" role="status" aria-live="polite" aria-atomic="true">
        <p className="viz-k">Katalog tabeli po awarii</p>
        <ul className="dl-files">
          {crash.oldFiles.map(f => (
            <li key={f.name} className="dl-file live"><b>{f.name}</b><span>{f.rows} wierszy · czytany</span></li>
          ))}
          {crash.newFiles.map(f => (
            <li key={f.name} className={`dl-file ${!f.written ? 'missing' : delta ? 'orphan' : 'live'}`}>
              <b>{f.name}</b>
              <span>{!f.written ? 'nie powstał' : delta ? `${f.rows} wierszy · poza logiem, pomijany` : `${f.rows} wierszy · czytany`}</span>
            </li>
          ))}
          {delta && <li className="dl-file log"><b>_delta_log/</b><span>ostatni commit wymienia tylko part-001 i part-002</span></li>}
        </ul>
        <p className="dl-big"><b>{seen}</b><span>zamówień<br />w raporcie</span></p>
        <p className="dl-cost"><b>Jak czyta.</b> {mode.how}</p>
        <p className={`dl-verdict ${delta ? 'ok' : 'no'}`}>{mode.verdict}</p>
      </div>
    </div>
  );
}

/** Etap Intuicja, krok 2: katalog Parquet kontra tabela Delta. */
export function VersusTable() {
  return (
    <div className="dl">
      <p className="small viz-assume">{versus.caption}</p>
      <table className="data dl-versus">
        <thead><tr>{versus.columns.map(c => <th key={c}>{c}</th>)}</tr></thead>
        <tbody>
          {versus.rows.map(r => (
            <tr key={r[0]}><th scope="row">{r[0]}</th><td className="off">{r[1]}</td><td>{r[2]}</td></tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Etap Intuicja, krok 3: warstwy platformy. Lista jest odwrócona, żeby dane były na dole. */
export function StackLayers() {
  return (
    <div className="dl">
      <p className="small viz-assume">{stack.caption}</p>
      <ol className="dl-stack" reversed>
        {[...stack.layers].reverse().map(l => (
          <li key={l.name}>
            <b>{l.name}</b>
            <span>{l.what}</span>
            <i>{l.where}</i>
          </li>
        ))}
      </ol>
    </div>
  );
}

function RowsTable({ rows }: { rows: Row[] }) {
  return (
    <table className="data dl-rows">
      <thead><tr><th>id</th><th>customer</th><th>status</th><th>amount</th></tr></thead>
      <tbody>
        {rows.map(r => <tr key={r.id}><td>{r.id}</td><td>{r.customer}</td><td>{r.status}</td><td>{r.amount}</td></tr>)}
        {rows.length === 0 && <tr><td colSpan={4} className="off">brak wierszy</td></tr>}
      </tbody>
    </table>
  );
}

/**
 * Centralna symulacja: log transakcyjny. Stan to liczba wykonanych commitów i wersja, którą oglądasz.
 * Kliknięcie wcześniejszego commitu pokazuje tabelę w tamtej wersji, czyli time travel.
 */
export function LogSim() {
  const commits = log.commits;
  const [applied, setApplied] = useState(1);
  const [view, setView] = useState(0);
  const head = applied - 1;
  const commit = commits[view];
  const snap = snapshot(commits, view);
  const livePaths = new Set(snap.files.map(f => f.path));
  const onDisk = written(commits, head);
  const next = commits[applied];
  const run = () => { setApplied(applied + 1); setView(applied); };
  const reset = () => { setApplied(1); setView(0); };

  return (
    <div className="dl">
      <span className="badge sim">{SIM_BADGE}</span>
      <p className="small viz-assume">{log.assumptions}</p>

      <div className="dl-count">
        <p><b>{view}</b><span>oglądana<br />wersja</span></p>
        <p><b>{snap.files.length}</b><span>pliki<br />w tej wersji</span></p>
        <p className={onDisk.length > snap.files.length ? 'hot' : undefined}><b>{onDisk.length}</b><span>pliki fizycznie<br />w katalogu</span></p>
        <p><b>{snap.rows.length}</b><span>wiersze<br />w SELECT *</span></p>
      </div>

      <div className="dl-acts top">
        {next ? (
          <button type="button" className="op act" onClick={run}>Wykonaj: {next.operation}</button>
        ) : (
          <button type="button" className="op" onClick={reset}>Zacznij od nowa</button>
        )}
      </div>
      <div className="dl-grid">
        <div className="dl-pane">
          <p className="viz-k">_delta_log · kliknij commit</p>
          <ul className="dl-log">
            {commits.slice(0, applied).map(c => (
              <li key={c.version}>
                <button type="button" aria-pressed={c.version === view} onClick={() => setView(c.version)}>
                  <code>{commitFile(c.version)}</code>
                  <span>{c.operation}</span>
                </button>
              </li>
            ))}
          </ul>
          <p className="viz-k dl-gap">Akcje w commicie {view}</p>
          <ul className="dl-actions" aria-live="polite">
            {commit.extra?.map(e => <li key={e}><i>{e.split(':')[0]}</i>{e.slice(e.indexOf(':') + 1)}</li>)}
            {commit.remove.map(p => <li key={p} className="rm"><i>remove</i>{p}</li>)}
            {commit.add.map(f => <li key={f.path} className="add"><i>add</i>{f.path} · {rowsLabel(f.rows.length)}</li>)}
          </ul>
        </div>

        <div className="dl-pane">
          <p className="viz-k">Pliki w katalogu tabeli</p>
          <ul className="dl-files">
            {onDisk.map(f => (
              <li key={f.path} className={`dl-file ${livePaths.has(f.path) ? 'live' : 'orphan'}`}>
                <b>{f.path}</b>
                <span>{rowsLabel(f.rows.length)} · {livePaths.has(f.path) ? `należy do wersji ${view}` : `nie należy do wersji ${view}`}</span>
              </li>
            ))}
          </ul>
          <p className="viz-k dl-gap">SELECT * FROM orders{view === head ? '' : ` VERSION AS OF ${view}`}</p>
          <RowsTable rows={snap.rows} />
        </div>
      </div>

      <div className="dl-out" role="status" aria-live="polite" aria-atomic="true">
        <pre className="code dl-sql">{commit.sql}</pre>
        <p className="dl-verdict">{commit.say}</p>
        {view !== head && <p className="dl-cost"><b>Oglądasz starszą wersję.</b> Bieżąca to {head}. Odczyt wersji {view} używa plików, które w bieżącej wersji są już oznaczone jako usunięte.</p>}
      </div>

    </div>
  );
}

/** Dwóch piszących: cztery wspólne kroki i piąty zależny od pary operacji. */
export function ConflictSim() {
  const [id, setId] = useState(conflict.cases[0].id);
  const [step, setStep] = useState(0);
  const c = conflict.cases.find(x => x.id === id) ?? conflict.cases[0];
  const last = conflict.steps.length;
  const done = step === last;
  const pick = (next: string) => { setId(next); setStep(0); };
  const stateA = step < 1 ? 'czyta wersję 4' : step < 2 ? 'zapisuje pliki' : 'commit 5 zapisany';
  const stateB = step < 1 ? 'czyta wersję 4' : step < 3 ? 'zapisuje pliki' : !done ? 'commit 5 zajęty, sprawdza' : c.ok ? 'commit 6 zapisany' : 'wyjątek konfliktu';
  return (
    <div className="dl">
      <span className="badge sim">{SIM_BADGE}</span>
      <p className="small viz-assume">{conflict.assumptions}</p>
      <p className="viz-k">Para operacji</p>
      <div className="dl-chips" role="group" aria-label="Para operacji">
        {conflict.cases.map(x => (
          <button key={x.id} type="button" className="dl-chip" aria-pressed={x.id === id} onClick={() => pick(x.id)}>{x.label}</button>
        ))}
      </div>
      <p className="dl-cost dl-gap">{c.setup}</p>

      <div className="dl-acts top">
        {!done ? (
          <button type="button" className="op act" onClick={() => setStep(step + 1)}>Następny krok</button>
        ) : (
          <button type="button" className="op" onClick={() => setStep(0)}>Od początku</button>
        )}
      </div>
      <div className="dl-scene" role="status" aria-live="polite" aria-atomic="true">
        <div className="dl-writers">
          <div className={`dl-writer${step >= 2 ? ' ok' : ''}`}>
            <p className="viz-k">Job A</p>
            <b>{c.a}</b>
            <span>{stateA}</span>
          </div>
          <div className={`dl-writer${done ? (c.ok ? ' ok' : ' no') : ''}`}>
            <p className="viz-k">Job B</p>
            <b>{c.b}</b>
            <span>{stateB}</span>
          </div>
        </div>
        <p className="viz-k dl-gap">Krok {Math.min(step + 1, last + 1)} z {last + 1}</p>
        {!done ? (
          <p className="dl-verdict muted">{conflict.steps[step]}</p>
        ) : (
          <>
            <p className="dl-cost"><b>Co sprawdza B.</b> {c.check}</p>
            <p className={`dl-verdict ${c.ok ? 'ok' : 'no'}`}>{c.verdict}</p>
          </>
        )}
      </div>
    </div>
  );
}

const MERGE_TAG: Record<MergeTag, string> = { same: 'bez zmian', updated: 'zmieniony', inserted: 'wstawiony', deleted: 'usunięty' };

/** MERGE na czterech wierszach celu i trzech wierszach źródła. Klauzule włącza się przełącznikami. */
export function MergeDemo() {
  const [on, setOn] = useState<Record<string, boolean>>(Object.fromEntries(merge.clauses.map(c => [c.id, c.on])));
  const [dup, setDup] = useState(false);
  const source = dup ? [...merge.source, merge.duplicate] : merge.source;
  const out = mergeRows(merge.target, source, { matched: on.matched, notMatched: on.notMatched, bySource: on.bySource });
  const count = (tag: MergeTag) => out.rows.filter(r => r.tag === tag).length;
  return (
    <div className="dl">
      <span className="badge sim">{SIM_BADGE}</span>
      <p className="small viz-assume">{merge.assumptions}</p>
      <div className="dl-toggles">
        {merge.clauses.map(c => (
          <label key={c.id}><input type="checkbox" checked={on[c.id]} onChange={e => setOn({ ...on, [c.id]: e.target.checked })} /><code>{c.label}</code></label>
        ))}
        <label><input type="checkbox" checked={dup} onChange={e => setDup(e.target.checked)} />{merge.duplicateLabel}</label>
      </div>

      <div className="dl-grid">
        <div className="dl-pane">
          <p className="viz-k">Cel: customers</p>
          <table className="data dl-rows">
            <thead><tr><th>id</th><th>name</th><th>tier</th></tr></thead>
            <tbody>{merge.target.map(r => <tr key={r.id}><td>{r.id}</td><td>{r.name}</td><td>{r.tier}</td></tr>)}</tbody>
          </table>
          <p className="viz-k dl-gap">Źródło: updates</p>
          <table className="data dl-rows">
            <thead><tr><th>id</th><th>name</th><th>tier</th></tr></thead>
            <tbody>{source.map((r, i) => <tr key={i} className={dup && r.id === merge.duplicate.id ? 'dl-dup' : undefined}><td>{r.id}</td><td>{r.name}</td><td>{r.tier}</td></tr>)}</tbody>
          </table>
        </div>
        <div className="dl-pane" role="status" aria-live="polite" aria-atomic="true">
          <p className="viz-k">Cel po MERGE</p>
          {out.error ? (
            <p className="dl-verdict no">{merge.error}</p>
          ) : (
            <>
              <table className="data dl-rows">
                <thead><tr><th>id</th><th>name</th><th>tier</th><th>los wiersza</th></tr></thead>
                <tbody>
                  {out.rows.map(r => (
                    <tr key={r.id} className={`dl-${r.tag}`}><td>{r.id}</td><td>{r.name}</td><td>{r.tier}</td><td>{MERGE_TAG[r.tag]}</td></tr>
                  ))}
                </tbody>
              </table>
              <p className="dl-cost">
                <b>Jeden commit.</b> Zmienione: {count('updated')}, wstawione: {count('inserted')}, usunięte: {count('deleted')}, bez zmian: {count('same')}.
              </p>
              {on.bySource && <p className="dl-verdict no">{merge.bySourceNote}</p>}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/** Schema enforcement kontra evolution: paczka razy tryb zapisu. */
export function SchemaDemo() {
  const [batch, setBatch] = useState(schema.batches[1].id);
  const [mode, setMode] = useState(schema.modes[0].id);
  const result = schema.results[`${batch}|${mode}`];
  const incoming = schema.batches.find(b => b.id === batch) ?? schema.batches[0];
  const cols = (list: string[], base: string[]) => (
    <span className="dl-cols">{list.map(c => <code key={c} className={base.includes(c) ? undefined : 'new'}>{c}</code>)}</span>
  );
  return (
    <div className="dl">
      <span className="badge sim">{SIM_BADGE}</span>
      <p className="small viz-assume">{schema.assumptions}</p>
      <div className="dl-controls">
        <div>
          <p className="viz-k">Paczka</p>
          <span className="segc" role="group" aria-label="Paczka">
            {schema.batches.map(b => <button key={b.id} type="button" aria-pressed={b.id === batch} onClick={() => setBatch(b.id)}>{b.label}</button>)}
          </span>
        </div>
        <div>
          <p className="viz-k">Tryb zapisu</p>
          <span className="segc" role="group" aria-label="Tryb zapisu">
            {schema.modes.map(m => <button key={m.id} type="button" aria-pressed={m.id === mode} onClick={() => setMode(m.id)}>{m.label}</button>)}
          </span>
        </div>
      </div>
      <div className="dl-scene" role="status" aria-live="polite" aria-atomic="true">
        <p className="viz-k">Kolumny paczki</p>
        {cols(incoming.columns, schema.tableColumns)}
        <p className="viz-k dl-gap">Schemat tabeli po próbie zapisu</p>
        {cols(result.columns, schema.tableColumns)}
        <p className={`dl-verdict dl-gap ${result.ok ? 'ok' : 'no'}`}>{result.text}</p>
      </div>
    </div>
  );
}

/** Time travel i VACUUM na commitach z symulacji logu: dzień dzisiejszy i to, czy ktoś uruchomił VACUUM. */
export function TimeVacuum() {
  const commits = log.commits;
  const [today, setToday] = useState(timeTravel.defaultDay);
  const [vacuum, setVacuum] = useState(false);
  const retention = { fileDays: timeTravel.fileRetentionDays, logDays: timeTravel.logRetentionDays };
  const latest = commits[commits.length - 1].version;
  const gone = new Set(vacuum ? vacuumed(commits, today, retention.fileDays) : []);
  const current = new Set(snapshot(commits, latest).files.map(f => f.path));
  const files = written(commits, latest);
  const [picked, setPicked] = useState(0);
  const statuses = commits.map(c => versionStatus(commits, c.version, today, vacuum, retention));
  const readable = statuses.filter(s => s === 'ok' || s === 'current').length;
  const status = statuses[picked];
  return (
    <div className="dl">
      <span className="badge sim">{SIM_BADGE}</span>
      <p className="small viz-assume">{timeTravel.assumptions}</p>
      <div className="dl-controls">
        <div>
          <p className="viz-k">Dziś jest</p>
          <span className="segc" role="group" aria-label="Dzisiejszy dzień">
            {timeTravel.days.map(d => <button key={d} type="button" aria-pressed={d === today} onClick={() => setToday(d)}>dzień {d}</button>)}
          </span>
        </div>
        <div>
          <p className="viz-k">VACUUM</p>
          <span className="segc" role="group" aria-label="VACUUM">
            <button type="button" aria-pressed={!vacuum} onClick={() => setVacuum(false)}>nie uruchomiony</button>
            <button type="button" aria-pressed={vacuum} onClick={() => setVacuum(true)}>uruchomiony dziś</button>
          </span>
        </div>
      </div>

      <div className="dl-count">
        <p><b>{readable}</b><span>wersje do<br />odczytu z {commits.length}</span></p>
        <p className={gone.size ? 'hot' : undefined}><b>{files.length - gone.size}</b><span>pliki fizycznie<br />w katalogu z {files.length}</span></p>
      </div>

      <div className="dl-grid">
        <div className="dl-pane">
          <p className="viz-k">Wersje · kliknij, żeby zobaczyć powód</p>
          <ul className="dl-log">
            {commits.map((c, i) => (
              <li key={c.version}>
                <button type="button" aria-pressed={c.version === picked} onClick={() => setPicked(c.version)}>
                  <code>v{c.version} · dzień {c.day}</code>
                  <span className={`dl-st ${statuses[i]}`}>{timeTravel.statuses[statuses[i]].label}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
        <div className="dl-pane">
          <p className="viz-k">Pliki danych</p>
          <ul className="dl-files">
            {files.map(f => {
              const day = removedOn(commits, f.path);
              const state = gone.has(f.path) ? 'missing' : current.has(f.path) ? 'live' : 'orphan';
              return (
                <li key={f.path} className={`dl-file ${state}`}>
                  <b>{f.path}</b>
                  <span>{state === 'missing' ? 'skasowany przez VACUUM' : state === 'live' ? 'bieżąca wersja' : `remove w dniu ${day} · ${today - (day ?? 0)} dni temu`}</span>
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      <div className="dl-out" role="status" aria-live="polite" aria-atomic="true">
        <pre className="code dl-sql">SELECT * FROM orders VERSION AS OF {picked}</pre>
        <p className={`dl-verdict ${status === 'ok' || status === 'current' ? 'ok' : 'no'}`}>
          <b>Wersja {picked}: {timeTravel.statuses[status].label}.</b> {timeTravel.statuses[status].text}
        </p>
      </div>
    </div>
  );
}

/** Małe pliki, OPTIMIZE i VACUUM: trzy stany tej samej tabeli. */
export function Compaction() {
  const [id, setId] = useState(compaction.states[0].id);
  const s = compaction.states.find(x => x.id === id) ?? compaction.states[0];
  const total = compaction.smallFiles * compaction.smallMb;
  const storedMb = s.id === 'optimized' ? total * 2 : total;
  return (
    <div className="dl">
      <span className="badge sim">{ILLUSTRATION_BADGE}</span>
      <p className="small viz-assume">{compaction.assumptions}</p>
      <span className="segc" role="group" aria-label="Stan tabeli">
        {compaction.states.map(x => <button key={x.id} type="button" aria-pressed={x.id === id} onClick={() => setId(x.id)}>{x.label}</button>)}
      </span>
      <div className="dl-count dl-gap">
        <p className={s.current > 1 ? 'hot' : undefined}><b>{s.current}</b><span>pliki otwierane<br />przez pełny skan</span></p>
        <p><b>{s.stored}</b><span>pliki fizycznie<br />w magazynie</span></p>
        <p className={storedMb > total ? 'hot' : undefined}><b>{storedMb} MB</b><span>zajęte<br />w magazynie</span></p>
      </div>
      <div className="dl-scene" role="status" aria-live="polite" aria-atomic="true">
        <p className="viz-k">Bieżąca wersja tabeli ({s.version})</p>
        <div className="dl-blocks" aria-hidden="true">
          {s.current > 1 ? Array.from({ length: s.current }, (_, i) => <i key={i} />) : <i className="big" />}
        </div>
        <p className="viz-k dl-gap">Stare pliki poza bieżącą wersją</p>
        <div className="dl-blocks old" aria-hidden="true">
          {Array.from({ length: s.stored - s.current }, (_, i) => <i key={i} />)}
          {s.stored === s.current && <span>brak</span>}
        </div>
        <p className="dl-verdict dl-gap">{s.text}</p>
      </div>
    </div>
  );
}

/** Liquid clustering: te same dane w dwóch układach, statystyki min i max na plik. */
export function ClusterDemo() {
  const [id, setId] = useState(clustering.layouts[0].id);
  const layout = clustering.layouts.find(l => l.id === id) ?? clustering.layouts[0];
  const hit = (min: number, max: number) => clustering.value >= min && clustering.value <= max;
  const skipped = layout.files.filter(f => !hit(f.min, f.max)).length;
  return (
    <div className="dl">
      <span className="badge sim">{ILLUSTRATION_BADGE}</span>
      <p className="small viz-assume">{clustering.assumptions}</p>
      <pre className="code dl-sql">{clustering.query}</pre>
      <span className="segc" role="group" aria-label="Układ danych">
        {clustering.layouts.map(l => <button key={l.id} type="button" aria-pressed={l.id === id} onClick={() => setId(l.id)}>{l.label}</button>)}
      </span>
      <div className="dl-scene" role="status" aria-live="polite" aria-atomic="true">
        <ul className="dl-files dl-ranges">
          {layout.files.map(f => (
            <li key={f.name} className={`dl-file ${hit(f.min, f.max) ? 'live' : 'orphan'}`}>
              <b>{f.name}</b>
              <span>customer_id od {f.min} do {f.max} · {hit(f.min, f.max) ? 'trzeba otworzyć' : 'pominięty'}</span>
            </li>
          ))}
        </ul>
        <p className="dl-big"><b>{skipped} z {layout.files.length}</b><span>plików<br />pominiętych</span></p>
        <p className="dl-verdict">{layout.text}</p>
      </div>
    </div>
  );
}

/** Change Data Feed: wynik table_changes dla commitów 2 i 3 z symulacji logu. */
export function CdfTable() {
  return (
    <div className="dl">
      <span className="badge sim">{ILLUSTRATION_BADGE}</span>
      <p className="small viz-assume">{cdf.assumptions}</p>
      <pre className="code dl-sql">{cdf.query}</pre>
      <table className="data dl-rows dl-cdf">
        <thead><tr>{cdf.columns.map(c => <th key={c}>{c}</th>)}</tr></thead>
        <tbody>
          {cdf.rows.map((r, i) => <tr key={i}>{r.map((v, j) => <td key={j} className={j === 4 ? 'dl-type' : undefined}>{v}</td>)}</tr>)}
        </tbody>
      </table>
    </div>
  );
}

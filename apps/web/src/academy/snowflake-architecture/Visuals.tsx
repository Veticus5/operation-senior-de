import { useState } from 'react';
import {
  access, cache, cost, history, layers, profiles, prune, scale, stream,
  type CacheAction, type MicroPartition, type ProfileCase, type PruneFilter, type Role, type StreamAction
} from '@content/snowflake/architecture/lesson';
import { Html } from '../../components/Html';

const fmt = (n: number) => n.toLocaleString('pl-PL', { maximumFractionDigits: 2 });

/** Grupa przycisków wyboru: jeden wciśnięty naraz. */
function Chips<T extends string>({ label, items, value, onPick }: { label: string; items: { id: T; label: string }[]; value: T; onPick: (id: T) => void }) {
  return (
    <>
      <p className="viz-k">{label}</p>
      <div className="sf-chips" role="group" aria-label={label}>
        {items.map(x => (
          <button key={x.id} type="button" className="sf-chip" aria-pressed={x.id === value} onClick={() => onPick(x.id)}>{x.label}</button>
        ))}
      </div>
    </>
  );
}

/** Etap Intuicja: która warstwa wykonuje który kawałek operacji. */
export function Layers() {
  const [id, setId] = useState(layers.defaultOp);
  const op = layers.ops.find(o => o.id === id) ?? layers.ops[0];
  const rows = [
    ['services', op.services],
    ['compute', op.compute],
    ['storage', op.storage]
  ] as const;
  return (
    <div className="sf sf-layers">
      <span className="badge sim">Ilustracja · uproszczony podział pracy</span>
      <Chips label="Operacja" items={layers.ops} value={id} onPick={setId} />
      <pre className="code sf-sql">{op.sql}</pre>
      <div role="status" aria-live="polite" aria-atomic="true">
        <ol className="sf-stack">
          {rows.map(([key, text]) => (
            <li key={key} className={text ? 'on' : 'off'}>
              <p className="viz-k"><span>{layers.names[key].name}</span><span>{layers.names[key].role}</span></p>
              <p>{text || layers.idle}</p>
            </li>
          ))}
        </ol>
        <p className="sf-verdict">{op.verdict}</p>
      </div>
      <p className="small viz-assume">{layers.caption}</p>
    </div>
  );
}

/** Czy mikropartycję trzeba przeczytać przy danym filtrze. Model: zakresy min–max się przecinają albo nie. */
export function mustScan(part: MicroPartition, filter: PruneFilter): boolean {
  if (filter.column === null) return true;
  const [lo, hi] = part[filter.column];
  return filter.range[0] <= hi && filter.range[1] >= lo;
}

const day = (d: number) => `${String(d).padStart(2, '0')}.01`;

/** Etap Mechanizm: symulacja pruningu na ośmiu mikropartycjach. */
export function PruneSim() {
  const [layoutId, setLayoutId] = useState(prune.defaultLayout);
  const [filterId, setFilterId] = useState(prune.defaultFilter);
  const layout = prune.layouts.find(l => l.id === layoutId) ?? prune.layouts[0];
  const filter = prune.filters.find(f => f.id === filterId) ?? prune.filters[0];
  const scan = layout.parts.map(p => mustScan(p, filter));
  const scanned = scan.filter(Boolean).length;
  const total = layout.parts.length;
  return (
    <div className="sf sf-prune">
      <span className="badge sim">Symulacja w przeglądarce · dane wymyślone</span>
      <Html as="p" className="small viz-assume" html={prune.assumptions} />
      <Chips label={prune.layoutLabel} items={prune.layouts} value={layoutId} onPick={setLayoutId} />
      <div className="sf-gap">
        <Chips label={prune.filterLabel} items={prune.filters} value={filterId} onPick={setFilterId} />
      </div>
      <pre className="code sf-sql">{`SELECT SUM(amount) FROM orders\n${filter.sql}`}</pre>
      <div role="status" aria-live="polite" aria-atomic="true">
        <div className="sf-count">
          <p className={scanned === total ? 'hot' : undefined}><b>{scanned} z {total}</b><span>mikropartycji<br />do przeczytania</span></p>
          <p><b>{total - scanned}</b><span>pominiętych<br />bez otwierania</span></p>
        </div>
        <ul className="sf-parts">
          {layout.parts.map((p, i) => (
            <li key={i} className={scan[i] ? 'scan' : 'skip'}>
              <span className="sf-pn">MP {i + 1}</span>
              <span className={filter.column === 'date' ? 'sf-range used' : 'sf-range'}><i>order_date</i>{day(p.date[0])} – {day(p.date[1])}</span>
              <span className={filter.column === 'cust' ? 'sf-range used' : 'sf-range'}><i>customer_id</i>{p.cust[0]} – {p.cust[1]}</span>
              <span className="sf-state">{scan[i] ? 'czytaj' : 'pomiń'}</span>
            </li>
          ))}
        </ul>
        <p className="sf-verdict">{layout.note}</p>
        <p className="sf-note">{filter.why}</p>
      </div>
    </div>
  );
}

interface CacheState { running: boolean; local: boolean; result: boolean; source: string; text: string; extra?: string }

function cacheStep(s: CacheState, action: CacheAction): CacheState {
  const o = cache.outcomes;
  if (action === 'suspend') return s.running ? { ...s, running: false, local: false, ...o.suspend, extra: undefined } : { ...s, ...o.suspendIdle, extra: undefined };
  if (action === 'insert') return { ...s, running: true, result: false, ...(s.running ? o.insert : o.insertCold), extra: undefined };
  if (action === 'run' && s.result) return { ...s, ...o.resultHit, extra: undefined };
  // Zapytanie trzeba wykonać: liczy się stan warehouse'u i jego lokalnego cache.
  const read = !s.running ? o.cold : s.local ? o.localHit : o.remote;
  const extra = action === 'runVariant' ? o.variantNote : undefined;
  return { running: true, local: true, result: action === 'run' ? true : s.result, ...read, extra };
}

/** Etap Mechanizm: skąd przychodzi odpowiedź. Maszyna stanów result cache + cache warehouse'u. */
export function CacheSim() {
  const initial: CacheState = { running: false, local: false, result: false, source: '', text: cache.start };
  const [state, setState] = useState(initial);
  const [log, setLog] = useState<string[]>([]);
  const act = (a: CacheAction, label: string) => {
    const next = cacheStep(state, a);
    setState(next);
    setLog([`${label} → ${next.source}`, ...log].slice(0, 5));
  };
  const cell = (labels: string[], on: boolean) => (
    <li className={on ? 'on' : 'off'}>
      <span className="viz-k">{labels[0]}</span>
      <b>{on ? labels[2] : labels[1]}</b>
    </li>
  );
  return (
    <div className="sf sf-cache">
      <span className="badge sim">Symulacja w przeglądarce · reguły z dokumentacji</span>
      <p className="small viz-assume">{cache.assumptions}</p>
      <pre className="code sf-sql">{`-- zapytanie A\n${cache.queryA}`}</pre>
      <div className="sf-actions">
        {cache.actions.map(a => (
          <button key={a.id} type="button" className="op" onClick={() => act(a.id, a.label)}>{a.label}</button>
        ))}
        <button type="button" className="op ghostb" onClick={() => { setState(initial); setLog([]); }}>Od nowa</button>
      </div>
      <ul className="sf-cells">
        {cell(cache.state.result, state.result)}
        {cell(cache.state.warehouse, state.running)}
        {cell(cache.state.local, state.local)}
      </ul>
      <div className="sf-out" role="status" aria-live="polite" aria-atomic="true">
        {state.source && <p className="viz-k">Skąd odpowiedź: <span className="sf-src">{state.source}</span></p>}
        <p className="sf-verdict">{state.text}</p>
        {state.extra && <p className="sf-note">{state.extra}</p>}
      </div>
      {log.length > 0 && (
        <ul className="sf-log" aria-label="Ostatnie kroki, od najnowszego">
          {log.map((l, i) => <li key={log.length - i}>{l}</li>)}
        </ul>
      )}
    </div>
  );
}

/** Etap Wydajność: jeden scenariusz diagnozy z wycinkiem statystyk profilu. */
export function ProfileCard({ c }: { c: ProfileCase }) {
  const [picked, setPicked] = useState<number | null>(null);
  return (
    <div className="obs">
      <span className="num">{c.label.toUpperCase()}</span>
      <p className="ask">{c.setup}</p>
      <table className="data sf-table">
        <thead><tr><th>Statystyka</th><th>Wartość</th></tr></thead>
        <tbody>
          {c.stats.map(s => (
            <tr key={s.name}><td>{s.name}</td><td className={s.flag ? 'sf-flag' : undefined}>{s.value}</td></tr>
          ))}
        </tbody>
      </table>
      <p className="muted" style={{ marginBottom: 12 }}>{profiles.ask}</p>
      <div className="choices quiz-choices">
        {c.options.map((o, i) => (
          <button key={o} type="button" className={`choice${picked === null ? '' : i === c.correct ? ' ok' : i === picked ? ' no' : ''}`} disabled={picked !== null} onClick={() => setPicked(i)}>{o}</button>
        ))}
      </div>
      {picked !== null && (
        <div className="reveal on">
          <p className={`verdict ${picked === c.correct ? 'ok' : 'no'}`}>{picked === c.correct ? 'Tak, od tego warto zacząć.' : 'Jest lepszy pierwszy krok.'}</p>
          <p>{c.why}</p>
          <p className="scope"><b>Zakres.</b> <span>{c.scope}</span></p>
        </div>
      )}
    </div>
  );
}

/** Kredyty w modelu: stawka godzinowa × liczba klastrów × czas. */
export const credits = (o: { rate: number; clusters: number; minutes: number }) => (o.rate * o.clusters * o.minutes) / 60;

/** Etap Wydajność: scale up kontra scale out dla dwóch obciążeń. */
export function ScaleSim() {
  const [wid, setWid] = useState(scale.defaultWorkload);
  const [action, setAction] = useState(scale.actions[0].id);
  const w = scale.workloads.find(x => x.id === wid) ?? scale.workloads[0];
  const o = w.outcomes.find(x => x.action === action) ?? w.outcomes[0];
  const base = w.outcomes[0];
  const maxMinutes = Math.max(...w.outcomes.map(x => x.minutes));
  const peak = Math.max(...o.waves);
  return (
    <div className="sf sf-scale">
      <span className="badge sim">Symulacja w przeglądarce · czasy ilustracyjne, nie pomiar</span>
      <p className="small viz-assume">{scale.assumptions}</p>
      <Chips label={scale.workloadLabel} items={scale.workloads} value={wid} onPick={setWid} />
      <p className="sf-note sf-gap">{w.setup}</p>
      <div className="sf-gap">
        <Chips label={scale.actionLabel} items={scale.actions} value={action} onPick={setAction} />
      </div>
      <div role="status" aria-live="polite" aria-atomic="true">
        <div className="sf-count">
          <p><b>{o.clusters} × {o.size}</b><span>klastry<br />i rozmiar</span></p>
          <p className={o.minutes < base.minutes ? 'good' : undefined}><b>{fmt(o.minutes)} min</b><span>do końca<br />całej pracy</span></p>
          <p className={credits(o) > credits(base) ? 'hot' : undefined}><b>{fmt(credits(o))}</b><span>kredytów<br />w tym modelu</span></p>
        </div>
        <div className="sf-lane" aria-hidden="true">
          <p className="viz-k">Oś czasu 0–{maxMinutes} min · wysokość: zapytania działające naraz</p>
          <div className="sf-waves" style={{ width: `${(100 * o.minutes) / maxMinutes}%` }}>
            {o.waves.map((n, i) => <i key={i} style={{ height: `${Math.max(18, (100 * n) / Math.max(peak, 8))}%` }}><span>{n}</span></i>)}
          </div>
        </div>
        <p className="sf-verdict">{o.verdict}</p>
      </div>
    </div>
  );
}

/** Etap Koszt i produkcja: co widzi resource monitor, a co budżet. */
export function Coverage() {
  const [id, setId] = useState(cost.defaultItem);
  const item = cost.items.find(x => x.id === id) ?? cost.items[0];
  const mark = (ok: boolean) => <b className={ok ? 'ok' : 'no'}>{ok ? 'widzi' : 'nie widzi'}</b>;
  return (
    <div className="sf sf-cover">
      <span className="badge">Zasięg według dokumentacji · przykłady wymyślone</span>
      <p className="small viz-assume">{cost.assumptions}</p>
      <Chips label={cost.coverageLabel} items={cost.items} value={id} onPick={setId} />
      <div role="status" aria-live="polite" aria-atomic="true">
        <ul className="sf-cells sf-two">
          <li className={item.monitor ? 'on' : 'off'}><span className="viz-k">{cost.columns.monitor}</span>{mark(item.monitor)}</li>
          <li className={item.budget ? 'on' : 'off'}><span className="viz-k">{cost.columns.budget}</span>{mark(item.budget)}</li>
        </ul>
        <p className="sf-verdict">{item.why}</p>
      </div>
    </div>
  );
}

interface StreamState { version: number; offset: number; inserts: number; updated: boolean; target: number; msg: string }

function streamStep(s: StreamState, a: StreamAction): StreamState {
  const m = stream.messages;
  const pending = s.inserts + (s.updated ? 2 : 0);
  if (a === 'insert') return { ...s, version: s.version + 1, inserts: s.inserts + 1, msg: m.insert };
  if (a === 'update') return { ...s, version: s.version + 1, updated: true, msg: s.updated ? m.updateAgain : m.update };
  if (a === 'select') return { ...s, msg: pending ? m.select : m.selectEmpty };
  if (!pending) return { ...s, msg: m.taskSkipped };
  return { version: s.version, offset: s.version, inserts: 0, updated: false, target: s.target + s.inserts + (s.updated ? 1 : 0), msg: m.task };
}

/** Etap Koszt i produkcja: cykl życia streamu i taska. */
export function StreamSim() {
  const initial: StreamState = { version: 1, offset: 1, inserts: 0, updated: false, target: 0, msg: stream.start };
  const [s, setS] = useState(initial);
  const records = [
    ...(s.updated ? [['DELETE', 'TRUE', 'wiersz 1, stara wersja'], ['INSERT', 'TRUE', 'wiersz 1, nowa wersja']] : []),
    ...Array.from({ length: s.inserts }, (_, i) => ['INSERT', 'FALSE', `nowy wiersz ${i + 1}`])
  ];
  return (
    <div className="sf sf-stream">
      <span className="badge sim">Symulacja w przeglądarce · reguły z dokumentacji</span>
      <p className="small viz-assume">{stream.assumptions}</p>
      <div className="sf-actions">
        {stream.actions.map(a => (
          <button key={a.id} type="button" className={`op${a.id === 'task' ? ' act' : ''}`} onClick={() => setS(streamStep(s, a.id))}>{a.label}</button>
        ))}
        <button type="button" className="op ghostb" onClick={() => setS(initial)}>Od nowa</button>
      </div>
      <div role="status" aria-live="polite" aria-atomic="true">
        <div className="sf-count">
          <p><b>v{s.version}</b><span>{stream.labels.version}</span></p>
          <p className={s.offset < s.version ? 'hot' : undefined}><b>v{s.offset}</b><span>{stream.labels.offset}</span></p>
          <p><b>{records.length}</b><span>{stream.labels.pending}</span></p>
          <p className="good"><b>{s.target}</b><span>{stream.labels.target}</span></p>
        </div>
        <div className="sf-track" aria-hidden="true">
          {Array.from({ length: s.version }, (_, i) => i + 1).map(v => (
            <i key={v} className={v <= s.offset ? 'done' : 'new'}>{v === s.offset ? `v${v} ← offset` : `v${v}`}</i>
          ))}
        </div>
        {records.length > 0 && (
          <table className="data sf-table">
            <thead><tr><th>METADATA$ACTION</th><th>METADATA$ISUPDATE</th><th>Wiersz</th></tr></thead>
            <tbody>{records.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j}>{c}</td>)}</tr>)}</tbody>
          </table>
        )}
        <p className="sf-verdict">{s.msg}</p>
      </div>
    </div>
  );
}

/** Etap Koszt i produkcja: oś Time Travel → Fail-safe → usunięte dla typu tabeli. */
export function Retention() {
  const [id, setId] = useState(history.defaultType);
  const t = history.types.find(x => x.id === id) ?? history.types[0];
  const days = (n: number) => (n === 1 ? '1 dzień' : `${n} dni`);
  return (
    <div className="sf sf-ret">
      <span className="badge">Okresy z dokumentacji · oś nie w skali</span>
      <Chips label={history.typeLabel} items={history.types} value={id} onPick={setId} />
      <div role="status" aria-live="polite" aria-atomic="true">
        <ol className="sf-phases">
          <li className="travel">
            <span className="viz-k">{history.phases.travel.name}</span>
            <b>{t.travel === 1 ? 'do 1 dnia' : `do ${t.travel} dni`}</b>
            <span>{history.phases.travel.who}</span>
          </li>
          {t.failsafe > 0 && (
            <li className="failsafe">
              <span className="viz-k">{history.phases.failsafe.name}</span>
              <b>{days(t.failsafe)}</b>
              <span>{history.phases.failsafe.who}</span>
            </li>
          )}
          <li className="gone">
            <span className="viz-k">{history.phases.gone.name}</span>
            <b>po {days(t.travel + t.failsafe)}</b>
            <span>{history.phases.gone.who}</span>
          </li>
        </ol>
        <p className="sf-verdict">{t.note}</p>
      </div>
    </div>
  );
}

/** Etap Koszt i produkcja: mikropartycje współdzielone przez źródło i klon. */
export function CloneSteps() {
  const [id, setId] = useState(history.defaultStep);
  const step = history.steps.find(x => x.id === id) ?? history.steps[0];
  const all = [...new Set([...step.source, ...step.clone])].sort();
  const owner = (p: string) => (step.source.includes(p) && step.clone.includes(p) ? 'both' : step.source.includes(p) ? 'source' : 'clone');
  const row = (label: string, parts: string[]) => (
    <li>
      <span className="viz-k">{label}</span>
      <span className="sf-refs">{parts.map(p => <i key={p} className={owner(p)}>{p}</i>)}</span>
    </li>
  );
  return (
    <div className="sf sf-clone">
      <span className="badge sim">Ilustracja · nie pomiar</span>
      <p className="small viz-assume">{history.cloneAssumptions}</p>
      <Chips label="Krok" items={history.steps} value={id} onPick={setId} />
      <div role="status" aria-live="polite" aria-atomic="true">
        <ul className="sf-clonerows">
          {row('Tabela źródłowa wskazuje na', step.source)}
          {row('Klon wskazuje na', step.clone)}
          {row(`W storage: ${all.length} mikropartycji`, all)}
        </ul>
        <p className="sf-legend" aria-hidden="true">
          <span className="both">współdzielona</span>
          <span className="source">tylko źródło</span>
          <span className="clone">tylko klon</span>
        </p>
        <p className="sf-verdict">{step.say}</p>
      </div>
    </div>
  );
}

/** Wszystkie role, z których dana rola dziedziczy (bez niej samej). */
export function inherited(id: string, roles: Role[] = access.roles): Role[] {
  const out: Role[] = [];
  const walk = (rid: string) => {
    for (const child of roles.find(r => r.id === rid)?.inherits ?? []) {
      const role = roles.find(r => r.id === child);
      if (role && !out.includes(role)) { out.push(role); walk(child); }
    }
  };
  walk(id);
  return out;
}

const KIND: Record<Role['kind'], string> = { system: 'rola systemowa', functional: 'rola funkcyjna', access: 'rola dostępu' };

/** Etap Koszt i produkcja: efektywne uprawnienia roli w przykładowej hierarchii. */
export function RoleTree() {
  const [id, setId] = useState(access.defaultRole);
  const role = access.roles.find(r => r.id === id) ?? access.roles[0];
  const below = inherited(id);
  return (
    <div className="sf sf-roles">
      <span className="badge sim">Ilustracja · przykładowa hierarchia</span>
      <p className="small viz-assume">{access.assumptions}</p>
      <Chips label={access.roleLabel} items={[...access.roles].reverse()} value={id} onPick={setId} />
      <div role="status" aria-live="polite" aria-atomic="true">
        <p className="viz-k sf-gap">{role.label} · {KIND[role.kind]}</p>
        <ul className="sf-grants">
          {role.grants.map(g => <li key={g}><b>własne</b>{g}</li>)}
          {below.flatMap(r => r.grants.map(g => <li key={r.id + g}><b>przez {r.label}</b>{g}</li>))}
        </ul>
        <p className="sf-verdict">{role.note}</p>
      </div>
    </div>
  );
}

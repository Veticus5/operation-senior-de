import { useState } from 'react';
import { acid, architectures, denormalization, design, etl, index, keys, normalization, pruning, separation, storage, workloads } from '@content/architecture/database-architecture/lesson';

const num = (n: number) => n.toLocaleString('pl-PL');

/** Przełącznik segmentowy: jedna z kilku opcji. */
function Seg<T extends string>({ label, options, value, onChange }: { label: string; options: { id: T; label: string }[]; value: T; onChange: (id: T) => void }) {
  return (
    <div className="db-ctl">
      <p className="viz-k">{label}</p>
      <div className="db-chips" role="group" aria-label={label}>
        {options.map(o => (
          <button key={o.id} type="button" className="db-chip" aria-pressed={o.id === value} onClick={() => onChange(o.id)}>{o.label}</button>
        ))}
      </div>
    </div>
  );
}

/** Intuicja 1: dwa pytania do tej samej tabeli. */
export function Workloads() {
  return (
    <div className="db-scroll">
      <table className="data db-table db-compare db-workloads">
        <thead><tr>{workloads.columns.map((c, i) => <th key={i}>{c}</th>)}</tr></thead>
        <tbody>
          {workloads.rows.map(r => (
            <tr key={r[0]}>
              <th scope="row">{r[0]}</th>
              <td>{r[0] === 'Zapytanie' ? <code>{r[1]}</code> : r[1]}</td>
              <td>{r[0] === 'Zapytanie' ? <code>{r[2]}</code> : r[2]}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Ile wartości czyta zapytanie w danym układzie. Blok (wiersz albo kolumna) jest czytany w całości. */
export function storageCounts(queryId: string, layout: string) {
  const q = storage.queries.find(x => x.id === queryId) ?? storage.queries[0];
  const total = storage.rows.length * storage.columns.length;
  const need = q.rows.length * q.cols.length;
  const read = layout === 'row' ? q.rows.length * storage.columns.length : q.cols.length * storage.rows.length;
  const blocks = layout === 'row' ? q.rows.length : q.cols.length;
  return { total, need, read, blocks };
}

/** Intuicja 2: zapis wierszowy i kolumnowy. Ilustracja. */
export function StorageSim() {
  const [queryId, setQueryId] = useState(storage.defaultQuery);
  const [layout, setLayout] = useState(storage.defaultLayout);
  const q = storage.queries.find(x => x.id === queryId) ?? storage.queries[0];
  const { total, need, read, blocks } = storageCounts(queryId, layout);
  const isRead = (r: number, c: number) => (layout === 'row' ? q.rows.includes(r) : q.cols.includes(c));
  const isNeed = (r: number, c: number) => q.rows.includes(r) && q.cols.includes(c);
  return (
    <div className="db-viz">
      <span className="badge sim">Ilustracja · nie pomiar</span>
      <p className="small viz-assume">{storage.assumptions}</p>
      <Seg label={storage.queryLabel} options={storage.queries} value={queryId} onChange={setQueryId} />
      <Seg label={storage.layoutLabel} options={storage.layouts} value={layout} onChange={setLayout} />
      <pre className="code db-sql">{q.sql}</pre>
      <div className={`db-grid db-grid-${layout}`} style={{ gridTemplateColumns: `repeat(${storage.columns.length}, minmax(0, 1fr))` }} aria-hidden="true">
        {storage.columns.map(c => <span key={c} className="db-h">{c}</span>)}
        {storage.rows.flatMap((row, r) => row.map((v, c) => (
          <span key={`${r}-${c}`} className={`db-cell${isRead(r, c) ? ' db-r' : ''}${isNeed(r, c) ? ' db-n' : ''}`}>{v}</span>
        )))}
      </div>
      <p className="db-legend"><span className="db-l-read">{storage.legend.read}</span><span className="db-l-need">{storage.legend.need}</span></p>
      <div role="status" aria-live="polite" aria-atomic="true">
        <div className="db-tiles">
          <p><b>{read}</b><span>wartości przeczytanych z {total}</span></p>
          <p><b>{need}</b><span>wartości potrzebnych do wyniku</span></p>
          <p><b>{blocks}</b><span>{layout === 'row' ? 'bloków-wierszy' : 'bloków-kolumn'}</span></p>
        </div>
        <p className={`db-verdict ${read === need ? 'ok' : 'no'}`}>{layout === 'row' ? q.verdict.row : q.verdict.column}</p>
      </div>
    </div>
  );
}

/** Model 1: projekt logiczny i fizyczny obok siebie. */
export function DesignColumns() {
  return (
    <div className="db-two">
      {design.columns.map(c => (
        <div key={c.label} className="db-card">
          <p className="viz-k">{c.note}</p>
          <h3>{c.label}</h3>
          <ul>{c.items.map(i => <li key={i}>{i}</li>)}</ul>
        </div>
      ))}
    </div>
  );
}

function MiniTable({ name, columns, rows, keyCols = [], flag = [] }: { name: string; columns: string[]; rows: string[][]; keyCols?: string[]; flag?: string[] }) {
  return (
    <div className="db-mini">
      <p className="db-mini-name">{name}</p>
      <div className="db-scroll">
        <table className="data db-table">
          <thead>
            <tr>{columns.map(c => <th key={c} className={`${keyCols.includes(c) ? 'db-key' : ''}${flag.includes(c) ? ' db-flag' : ''}`}>{c}</th>)}</tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>{r.map((v, j) => <td key={j} className={flag.includes(columns[j]) ? 'db-flag' : undefined}>{v}</td>)}</tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** Model 2: normalizacja krok po kroku. */
export function NormalizationSteps() {
  const [id, setId] = useState(normalization.defaultStep);
  const step = normalization.steps.find(s => s.id === id) ?? normalization.steps[0];
  return (
    <div className="db-viz">
      <span className="badge sim">Ilustracja · dane wymyślone</span>
      <p className="small viz-assume">{normalization.assumptions}</p>
      <Seg label="Krok" options={normalization.steps} value={id} onChange={setId} />
      <div role="status" aria-live="polite" aria-atomic="true">
        <p className="db-rule">{step.rule}</p>
        <div className="db-tables">
          {step.tables.map(t => <MiniTable key={t.name} name={t.name} columns={t.columns} rows={t.rows} keyCols={t.key} flag={t.flag} />)}
        </div>
        {step.id !== 'raw' && <p className="db-verdict ok"><b>Naprawione.</b> {step.fixed}</p>}
        <p className={`db-verdict ${step.id === '3nf' ? 'muted' : 'no'}`}><b>{step.id === '3nf' ? 'Cena.' : 'Co nadal boli.'}</b> {step.problem}</p>
      </div>
    </div>
  );
}

/** Model 3: ten sam zestaw danych znormalizowany i zdenormalizowany. */
export function DenormCompare() {
  const [id, setId] = useState(denormalization.defaultVariant);
  const v = denormalization.variants.find(x => x.id === id) ?? denormalization.variants[0];
  return (
    <div className="db-viz">
      <span className="badge sim">Ilustracja · te same trzy zamówienia</span>
      <Seg label="Układ" options={denormalization.variants} value={id} onChange={setId} />
      <div role="status" aria-live="polite" aria-atomic="true">
        <p className="db-rule">{denormalization.question}</p>
        <pre className="code db-sql db-sql-tall">{v.sql}</pre>
        <p className="db-rule">{denormalization.change}</p>
        <div className="db-tiles">
          <p><b>{v.joins}</b><span>{denormalization.tiles.joins}</span></p>
          <p><b>{v.cityCopies}</b><span>{denormalization.tiles.cityCopies}</span></p>
          <p><b>{v.rowsToUpdate}</b><span>{denormalization.tiles.rowsToUpdate}</span></p>
        </div>
        <p className="db-verdict">{v.verdict}</p>
      </div>
    </div>
  );
}

/** Model 4: trzy błędne zapisy w trzech silnikach. Zachowanie według dokumentacji. */
export function KeysCheck() {
  const [engine, setEngine] = useState(keys.defaultEngine);
  const [attemptId, setAttemptId] = useState(keys.defaultAttempt);
  const attempt = keys.attempts.find(a => a.id === attemptId) ?? keys.attempts[0];
  const out = attempt.outcome[engine];
  return (
    <div className="db-viz">
      <span className="badge">Zachowanie według dokumentacji · dane przykładowe</span>
      <p className="small viz-assume">{keys.assumptions}</p>
      <Seg label={keys.attemptLabel} options={keys.attempts} value={attemptId} onChange={setAttemptId} />
      <Seg label={keys.engineLabel} options={keys.engines} value={engine} onChange={setEngine} />
      <pre className="code db-sql db-sql-tall">{attempt.sql}</pre>
      <div role="status" aria-live="polite" aria-atomic="true" className="db-out">
        <p className={`db-verdict ${out.ok ? 'no' : 'ok'}`}>
          <b>{attempt.rule}: {out.ok ? 'zapis przyjęty' : 'zapis odrzucony'}.</b> {out.text}
        </p>
      </div>
    </div>
  );
}

/** Silnik 1: wyszukanie przez indeks B-tree albo pełny skan. Ilustracja. */
export function IndexSim() {
  const [id, setId] = useState(index.defaultCase);
  const c = index.cases.find(x => x.id === id) ?? index.cases[0];
  const usesIndex = c.uses !== 'scan';
  // Drzewo: 1 korzeń, 3 węzły pośrednie, 9 liści. Ścieżka do liścia nr 4; przy zakresie także sąsiedni liść.
  const leafOn = (i: number) => usesIndex && (i === 4 || (c.uses === 'range' && i === 5));
  const pageOn = (i: number) => (usesIndex ? i === 9 || (c.uses === 'range' && (i === 10 || i === 11)) : true);
  return (
    <div className="db-viz">
      <span className="badge sim">Ilustracja · nie pomiar</span>
      <p className="small viz-assume">{index.assumptions}</p>
      <Seg label={index.caseLabel} options={index.cases} value={id} onChange={setId} />
      <pre className="code db-sql">{c.sql}</pre>
      <div className="db-tree" aria-hidden="true">
        <p className="viz-k">Indeks B-tree</p>
        <div className="db-level"><i className={usesIndex ? 'on' : ''} /></div>
        <div className="db-level">{[0, 1, 2].map(i => <i key={i} className={usesIndex && i === 1 ? 'on' : ''} />)}</div>
        <div className="db-level db-leaves">{Array.from({ length: 9 }, (_, i) => <i key={i} className={leafOn(i) ? 'on' : ''} />)}</div>
        <p className="viz-k db-gap">Strony tabeli</p>
        <div className="db-pages">{Array.from({ length: 24 }, (_, i) => <i key={i} className={pageOn(i) ? 'on' : ''} />)}</div>
      </div>
      <div role="status" aria-live="polite" aria-atomic="true">
        <div className="db-tiles">
          <p><b>{num(c.pages)}</b><span>stron przeczytanych z {num(index.tablePages)} w tym modelu</span></p>
          <p><b>{usesIndex ? 'indeks' : 'skan'}</b><span>droga wybrana przez bazę</span></p>
        </div>
        <p className={`db-verdict ${usesIndex ? 'ok' : 'no'}`}><b>{c.verdict}</b> {c.why}</p>
      </div>
    </div>
  );
}

const overlaps = (a: [number, number], b: [number, number]) => a[0] <= b[1] && b[0] <= a[1];

/** Które mikropartycje trzeba przeczytać: te, których zakres min–max przecina filtr. */
export function scannedParts(layoutId: string, filterId: string): boolean[] {
  const layout = pruning.layouts.find(l => l.id === layoutId) ?? pruning.layouts[0];
  const filter = pruning.filters.find(f => f.id === filterId) ?? pruning.filters[0];
  return layout.parts.map(p => overlaps(p[filter.column], filter.range));
}

/** Silnik 2: pruning mikropartycji. Ilustracja. */
export function PruningSim() {
  const [layoutId, setLayoutId] = useState(pruning.defaultLayout);
  const [filterId, setFilterId] = useState(pruning.defaultFilter);
  const layout = pruning.layouts.find(l => l.id === layoutId) ?? pruning.layouts[0];
  const filter = pruning.filters.find(f => f.id === filterId) ?? pruning.filters[0];
  const scanned = scannedParts(layoutId, filterId);
  const count = scanned.filter(Boolean).length;
  const month = (n: number) => pruning.months[n - 1];
  return (
    <div className="db-viz">
      <span className="badge sim">Ilustracja · nie pomiar</span>
      <p className="small viz-assume">{pruning.assumptions}</p>
      <Seg label={pruning.layoutLabel} options={pruning.layouts} value={layoutId} onChange={setLayoutId} />
      <Seg label={pruning.filterLabel} options={pruning.filters} value={filterId} onChange={setFilterId} />
      <pre className="code db-sql">{filter.sql}</pre>
      <ul className="db-parts">
        {layout.parts.map((p, i) => (
          <li key={i} className={scanned[i] ? 'on' : 'off'}>
            <span className="db-part-n">MP {i + 1}</span>
            <span className={filter.column === 'date' ? 'db-part-hot' : undefined}>order_date: {p.date[0] === p.date[1] ? month(p.date[0]) : `${month(p.date[0])}–${month(p.date[1])}`}</span>
            <span className={filter.column === 'customer' ? 'db-part-hot' : undefined}>customer_id: {p.customer[0]}–{p.customer[1]}</span>
            <span className="db-part-s">{scanned[i] ? 'czytana' : 'pominięta'}</span>
          </li>
        ))}
      </ul>
      <div role="status" aria-live="polite" aria-atomic="true">
        <div className="db-tiles">
          <p><b>{count} z {layout.parts.length}</b><span>mikropartycji do przeczytania</span></p>
        </div>
        <p className={`db-verdict ${count <= 2 ? 'ok' : 'no'}`}>{layout.note} {count === layout.parts.length ? 'Zakres każdej mikropartycji obejmuje szukaną wartość, więc nie da się pominąć żadnej.' : `Zakres filtra przecina ${count === 1 ? 'jedną mikropartycję' : `${count} mikropartycje`}, reszta jest pomijana bez czytania.`}</p>
      </div>
    </div>
  );
}

/** Silnik 4: poziomy izolacji i anomalie dopuszczane przez standard SQL. */
export function IsolationLevels() {
  const [id, setId] = useState(acid.defaultLevel);
  const level = acid.levels.find(l => l.id === id) ?? acid.levels[0];
  return (
    <div className="db-viz">
      <span className="badge">Standard SQL · za dokumentacją PostgreSQL</span>
      <p className="small viz-assume">{acid.assumptions}</p>
      <Seg label={acid.levelLabel} options={acid.levels} value={id} onChange={setId} />
      <div role="status" aria-live="polite" aria-atomic="true">
        <ul className="db-anoms">
          {acid.anomalies.map(a => {
            const possible = level[a.id as 'dirty' | 'nonRepeatable' | 'phantom'];
            return (
              <li key={a.id} className={possible ? 'no' : 'ok'}>
                <b>{a.name}</b>
                <span className="db-anom-s">{possible ? 'możliwy' : 'wykluczony'}</span>
                <span className="db-anom-t">{a.text}</span>
              </li>
            );
          })}
        </ul>
        <p className="db-verdict">{level.note}</p>
      </div>
    </div>
  );
}

/** ACID: cztery litery na przykładzie przelewu. */
export function AcidLetters() {
  return (
    <ul className="db-acid">
      {acid.letters.map(l => (
        <li key={l.letter}>
          <b>{l.letter}</b>
          <span><strong>{l.name}.</strong> {l.text}</span>
        </li>
      ))}
    </ul>
  );
}

/** Architektura 1: hurtownia, data lake, lakehouse. */
export function ArchCompare() {
  const [id, setId] = useState(architectures.defaultId);
  const a = architectures.items.find(x => x.id === id) ?? architectures.items[0];
  return (
    <div className="db-viz">
      <span className="badge sim">Schemat poglądowy</span>
      <p className="small viz-assume">{architectures.assumptions}</p>
      <Seg label="Wzorzec" options={architectures.items} value={id} onChange={setId} />
      <div role="status" aria-live="polite" aria-atomic="true">
        <div className="db-layers">
          {a.layers.map((l, i) => (
            <div key={l.name} className={`db-layer${i === a.layers.length - 1 ? ' base' : ''}`}>
              <span>{l.name}</span>
              <p>{l.text}</p>
            </div>
          ))}
        </div>
        <dl className="db-facts">
          {a.facts.map(f => (
            <div key={f[0]}><dt>{f[0]}</dt><dd>{f[1]}</dd></div>
          ))}
        </dl>
        <p className="db-verdict no"><b>Na co uważać.</b> {a.risk}</p>
      </div>
    </div>
  );
}

/** Architektura 2: ETL i ELT. */
export function EtlFlow() {
  const [id, setId] = useState(etl.defaultId);
  const v = etl.variants.find(x => x.id === id) ?? etl.variants[0];
  return (
    <div className="db-viz">
      <span className="badge sim">Schemat poglądowy</span>
      <Seg label="Podejście" options={etl.variants} value={id} onChange={setId} />
      <div role="status" aria-live="polite" aria-atomic="true">
        <ol className="db-flow">
          {v.steps.map(s => (
            <li key={s.name} className={s.hot ? 'hot' : undefined}>
              <b>{s.name}</b>
              <span>{s.where}</span>
            </li>
          ))}
        </ol>
        <dl className="db-facts">
          <div><dt>Co leży w hurtowni</dt><dd>{v.inWarehouse}</dd></div>
          <div><dt>Zysk</dt><dd>{v.good}</dd></div>
          <div><dt>Koszt</dt><dd>{v.bad}</dd></div>
        </dl>
      </div>
    </div>
  );
}

/** Architektura 3: storage i compute sklejone albo rozdzielone. */
export function SeparationView() {
  const [id, setId] = useState(separation.defaultId);
  const v = separation.variants.find(x => x.id === id) ?? separation.variants[0];
  return (
    <div className="db-viz">
      <span className="badge sim">Schemat poglądowy</span>
      <Seg label="Układ" options={separation.variants} value={id} onChange={setId} />
      <div role="status" aria-live="polite" aria-atomic="true">
        <div className="db-nodes">
          {v.compute.map(c => (
            <div key={c.name} className="db-node">
              <b>{c.name}</b>
              <span>{c.note}</span>
            </div>
          ))}
        </div>
        {v.storage && <div className="db-layer base db-shared"><p>{v.storage}</p></div>}
        <ul className="deeper-list db-points">
          {v.points.map(p => <li key={p}>{p}</li>)}
        </ul>
      </div>
    </div>
  );
}

/** Tabela porównawcza z treści: pierwszy wiersz to nagłówki. */
export function CompareTable({ columns, rows }: { columns: string[]; rows: string[][] }) {
  return (
    <div className="db-scroll">
      <table className="data db-table db-compare">
        <thead><tr>{columns.map((c, i) => <th key={i}>{c}</th>)}</tr></thead>
        <tbody>
          {rows.map(r => (
            <tr key={r[0]}>{r.map((v, i) => (i === 0 ? <th key={i} scope="row">{v}</th> : <td key={i}>{v}</td>))}</tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

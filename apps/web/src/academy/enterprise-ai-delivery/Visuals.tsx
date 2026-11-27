import { useState } from 'react';
import { example, flow, green, incremental, levels, lifecycle, permissions, pipeline, recon, release, requirements, review } from '@content/delivery/enterprise-ai-delivery/lesson';
import { model, pipelineStatus, reconcile, type VariantId } from './logic';

/** Przełącznik segmentowy: jedna z kilku opcji. */
function Seg<T extends string>({ label, options, value, onChange }: { label: string; options: { id: T; label: string }[]; value: T; onChange: (id: T) => void }) {
  return (
    <div className="ed-ctl">
      <p className="viz-k">{label}</p>
      <div className="ed-chips" role="group" aria-label={label}>
        {options.map(o => (
          <button key={o.id} type="button" className="ed-chip" aria-pressed={o.id === value} onClick={() => onChange(o.id)}>{o.label}</button>
        ))}
      </div>
    </div>
  );
}

/** Lista „etykieta: treść". */
function Facts({ rows }: { rows: [string, string][] }) {
  return (
    <dl className="ed-facts">
      {rows.map(([k, v]) => (
        <div key={k}><dt>{k}</dt><dd>{v}</dd></div>
      ))}
    </dl>
  );
}

const delta = (before: number, after: number) => (after === before ? 'bez zmian' : `${after > before ? '+' : '−'}${Math.abs(after - before)}`);

/** Intuicja 1: zielone testy i suma, której nikt nie sprawdził. Liczby z wersji „fanout". */
export function GreenButWrong() {
  const r = reconcile('fanout');
  return (
    <div className="ed-viz">
      <span className="badge sim">Ilustracja · dane wymyślone</span>
      <div className="ed-two">
        <div>
          <p className="viz-k">{green.checksTitle}</p>
          <ul className="ed-checks">
            {green.checks.map(c => <li key={c} className="ok"><span aria-hidden="true">✓</span>{c}</li>)}
          </ul>
        </div>
        <div>
          <p className="viz-k">{green.totalTitle}</p>
          <p className="ed-big"><span>{r.revenue.before}</span><i aria-hidden="true">→</i><b>{r.revenue.after}</b></p>
          <p className="small">{green.totalLabel}: przed zmianą {r.revenue.before}, po zmianie {r.revenue.after}.</p>
        </div>
      </div>
      <p className="small ed-note">{green.note}</p>
    </div>
  );
}

/** Intuicja 2: etapy cyklu życia i podział ról między człowieka a AI. */
export function Lifecycle() {
  const [id, setId] = useState(lifecycle.defaultId);
  const i = Math.max(0, lifecycle.phases.findIndex(p => p.id === id));
  const p = lifecycle.phases[i];
  const L = lifecycle.labels;
  return (
    <div className="ed-viz">
      <span className="badge sim">Schemat poglądowy</span>
      <p className="small viz-assume">{lifecycle.assumptions}</p>
      <ol className="ed-track" aria-label="Etapy cyklu życia">
        {lifecycle.phases.map((x, n) => (
          <li key={x.id}>
            <button type="button" className="ed-node" aria-pressed={x.id === id} onClick={() => setId(x.id)}>
              <i>{n + 1}</i>{x.label}
            </button>
          </li>
        ))}
      </ol>
      <div role="status" aria-live="polite" aria-atomic="true" className="ed-out ed-out-life">
        <p className="ed-rule">{p.question}</p>
        <Facts rows={[[L.artifact, p.artifact], [L.decides, p.decides]]} />
        <p className="ed-verdict ok"><b>{L.ai}.</b> {p.ai}</p>
        <p className="ed-verdict no"><b>{L.notAi}.</b> {p.notAi}</p>
      </div>
    </div>
  );
}

/** Dostarczanie 1: klasyfikacja wymagań. Każde zdanie ma własną odpowiedź i wyjaśnienie. */
export function RequirementSort() {
  const [picks, setPicks] = useState<Record<number, 'F' | 'NF'>>({});
  const done = Object.keys(picks).length;
  const good = requirements.items.filter((it, i) => picks[i] === it.kind).length;
  return (
    <div className="ed-viz">
      <ul className="ed-reqs">
        {requirements.items.map((it, i) => {
          const picked = picks[i];
          return (
            <li key={it.text}>
              <p className="ed-req">{it.text}</p>
              <div className="ed-chips" role="group" aria-label="Rodzaj wymagania">
                {(['F', 'NF'] as const).map(k => (
                  <button key={k} type="button" disabled={picked !== undefined} aria-pressed={picked === k}
                    className={`ed-chip${picked === undefined ? '' : k === it.kind ? ' ok' : picked === k ? ' no' : ''}`}
                    onClick={() => setPicks(p => ({ ...p, [i]: k }))}>
                    {requirements.kinds[k]}
                  </button>
                ))}
              </div>
              {picked !== undefined && <p className={`ed-verdict ${picked === it.kind ? 'ok' : 'no'}`}>{it.why}</p>}
            </li>
          );
        })}
      </ul>
      <p className="small ed-note" role="status" aria-live="polite">
        {done === 0 ? 'Wybierz odpowiedź przy każdym zdaniu.' : `Trafione: ${good} z ${done}. Pozostało: ${requirements.items.length - done}.`}
      </p>
    </div>
  );
}

/** Tabela porównawcza z treści: pierwsza kolumna to nagłówki wierszy. */
export function CompareTable({ columns, rows }: { columns: string[]; rows: string[][] }) {
  return (
    <div className="ed-scroll">
      <table className="data ed-table ed-compare">
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

const STATUS_LABEL = { passed: 'przeszło', stopped: 'zatrzymane', skipped: 'nie doszło' } as const;

/** Dostarczanie 4: potok CI/CD i bramka, która zatrzymuje wybraną zmianę. */
export function PipelineSim() {
  const [id, setId] = useState(pipeline.defaultChange);
  const change = pipeline.changes.find(c => c.id === id) ?? pipeline.changes[0];
  const status = pipelineStatus(id);
  const stopped = pipeline.stages[status.indexOf('stopped')];
  return (
    <div className="ed-viz">
      <span className="badge sim">Schemat poglądowy</span>
      <p className="small viz-assume">{pipeline.assumptions}</p>
      <Seg label={pipeline.changeLabel} options={pipeline.changes} value={id} onChange={setId} />
      <div role="status" aria-live="polite" aria-atomic="true">
        <p className="ed-rule">{change.desc}</p>
        <ol className="ed-pipe">
          {pipeline.stages.map((s, i) => (
            <li key={s.id} className={`${status[i]}${s.kind === 'human' ? ' human' : ''}`}>
              <span className="ed-pipe-n">{s.kind === 'human' ? 'człowiek' : 'automat'}</span>
              <b>{s.label}</b>
              <span className="ed-pipe-s">{STATUS_LABEL[status[i]]}</span>
              <span className="ed-pipe-w">{s.what}</span>
            </li>
          ))}
        </ol>
        <p className={`ed-verdict ${stopped ? 'no' : 'ok'}`}>
          <b>{stopped ? `Zatrzymuje: ${stopped.label}.` : 'Przechodzi do końca.'}</b> {change.why}
        </p>
      </div>
    </div>
  );
}

/** Dostarczanie 5: strategie wdrożenia i sposób wycofania. */
export function ReleaseStrategies() {
  const [id, setId] = useState(release.defaultId);
  const s = release.strategies.find(x => x.id === id) ?? release.strategies[0];
  const L = release.labels;
  return (
    <div className="ed-viz">
      <span className="badge sim">Schemat poglądowy</span>
      <p className="small viz-assume">{release.assumptions}</p>
      <Seg label="Sposób wdrożenia" options={release.strategies} value={id} onChange={setId} />
      <div role="status" aria-live="polite" aria-atomic="true" className="ed-out ed-out-rel">
        <Facts rows={[[L.how, s.how], [L.gain, s.gain], [L.cost, s.cost]]} />
        <p className="ed-verdict"><b>{L.rollback}.</b> {s.rollback}</p>
      </div>
    </div>
  );
}

/** Testy 1: poziomy testów i to, na co każdy jest ślepy. */
export function TestLevels() {
  const [id, setId] = useState(levels.defaultId);
  const t = levels.items.find(x => x.id === id) ?? levels.items[0];
  const L = levels.labels;
  return (
    <div className="ed-viz">
      <span className="badge sim">Schemat poglądowy</span>
      <p className="small viz-assume">{levels.assumptions}</p>
      <Seg label="Poziom testu" options={levels.items} value={id} onChange={setId} />
      <div role="status" aria-live="polite" aria-atomic="true" className="ed-out ed-out-lvl">
        <p className="ed-rule">{t.question}</p>
        <Facts rows={[[L.example, t.example], [L.when, t.when]]} />
        <p className="ed-verdict ok"><b>{L.catches}.</b> {t.catches}</p>
        <p className="ed-verdict no"><b>{L.misses}.</b> {t.misses}</p>
      </div>
    </div>
  );
}

function SourceTable({ name, columns, rows, mark }: { name: string; columns: string[]; rows: (string | number)[][]; mark?: (row: (string | number)[]) => boolean }) {
  return (
    <div className="ed-mini">
      <p className="ed-mini-name">{name}</p>
      <div className="ed-scroll">
        <table className="data ed-table">
          <thead><tr>{columns.map(c => <th key={c}>{c}</th>)}</tr></thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className={mark?.(r) ? 'ed-hot' : undefined}>{r.map((v, j) => <td key={j}>{v}</td>)}</tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** Testy 2: uzgodnienie before/after dla trzech wersji zmiany. Liczby liczy logic.ts z danych przykładu. */
export function ReconSim() {
  const [id, setId] = useState(recon.defaultVariant);
  const v = recon.variants.find(x => x.id === id) ?? recon.variants[0];
  const r = reconcile(v.id as Exclude<VariantId, 'before'>);
  const before = model('before');
  const after = model(v.id as VariantId);
  const clean = r.diffs.length === 0;
  const isDiff = (date: string, column: string) => r.diffs.some(d => d.date === date && d.column === column);
  return (
    <div className="ed-viz">
      <span className="badge sim">Ilustracja · dane wymyślone</span>
      <p className="small viz-assume">{recon.assumptions}</p>
      <details className="ed-src">
        <summary>Dane wejściowe i model przed zmianą</summary>
        <div className="ed-tables">
          <SourceTable name="stg_orders" columns={example.orderColumns} rows={example.orders} />
          <SourceTable name="stg_order_promos" columns={example.promoColumns} rows={example.promos} mark={row => row[0] === 104} />
        </div>
        <pre className="code ed-sql">{recon.before}</pre>
      </details>
      <Seg label={recon.variantLabel} options={recon.variants} value={id} onChange={setId} />
      <pre className="code ed-sql ed-sql-tall">{v.sql}</pre>
      <div role="status" aria-live="polite" aria-atomic="true">
        <p className="viz-k">{recon.checksTitle}</p>
        <ul className="ed-checks ed-checks-row">
          {recon.checks.map(c => <li key={c} className={r.testsPass ? 'ok' : 'no'}><span aria-hidden="true">{r.testsPass ? '✓' : '✗'}</span>{c}</li>)}
        </ul>
        <p className="viz-k">{recon.totalsTitle}</p>
        <div className="ed-scroll">
          <table className="data ed-table ed-num">
            <thead><tr><th></th><th>przed</th><th>po</th><th>różnica</th></tr></thead>
            <tbody>
              {([['liczba wierszy', r.rows], ['sum(orders)', r.orders], ['sum(revenue)', r.revenue]] as const).map(([name, x]) => (
                <tr key={name} className={x.before === x.after ? undefined : 'ed-hot'}>
                  <th scope="row">{name}</th><td>{x.before}</td><td>{x.after}</td><td>{delta(x.before, x.after)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="viz-k">{recon.diffTitle}</p>
        <div className="ed-scroll">
          <table className="data ed-table ed-num">
            <thead><tr><th>order_date</th><th>orders przed</th><th>orders po</th><th>revenue przed</th><th>revenue po</th><th>promo_orders</th></tr></thead>
            <tbody>
              {before.map(b => {
                const a = after.find(x => x.date === b.date);
                return (
                  <tr key={b.date}>
                    <th scope="row">{b.date}</th>
                    <td>{b.orders}</td>
                    <td className={isDiff(b.date, 'orders') ? 'ed-bad' : undefined}>{a?.orders ?? 0}</td>
                    <td>{b.revenue}</td>
                    <td className={isDiff(b.date, 'revenue') ? 'ed-bad' : undefined}>{a?.revenue ?? 0}</td>
                    <td className="ed-new">{a?.promoOrders ?? 0}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className={`ed-verdict ${clean ? 'ok' : 'no'}`}>
          <b>{clean ? recon.noDiff : `Różnice w ${r.diffs.length} ${r.diffs.length === 1 ? 'komórce' : 'komórkach'}.`}</b> {v.verdict}
        </p>
      </div>
    </div>
  );
}

/** Testy 3: model przyrostowy kontra pełne przeliczenie w trzech zdarzeniach. */
export function IncrementalCases() {
  const [id, setId] = useState(incremental.defaultId);
  const c = incremental.cases.find(x => x.id === id) ?? incremental.cases[0];
  return (
    <div className="ed-viz">
      <span className="badge sim">Ilustracja · dane wymyślone</span>
      <p className="small viz-assume">{incremental.assumptions}</p>
      <Seg label="Zdarzenie" options={incremental.cases} value={id} onChange={setId} />
      <div role="status" aria-live="polite" aria-atomic="true" className="ed-out ed-out-inc">
        <p className="ed-rule">{c.event}</p>
        <div className="ed-scroll">
          <table className="data ed-table ed-num">
            <thead><tr>{incremental.columns.map(h => <th key={h}>{h}</th>)}</tr></thead>
            <tbody>
              {c.full.map(([date, value], i) => {
                const inc = c.incremental[i][1];
                return (
                  <tr key={date} className={inc === value ? undefined : 'ed-hot'}>
                    <th scope="row">{date}</th><td>{value}</td><td className={inc === value ? undefined : 'ed-bad'}>{inc}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="ed-verdict no"><b>Co się stało.</b> {c.why}</p>
        <p className="ed-verdict ok"><b>Jak to przetestować.</b> {c.test}</p>
      </div>
    </div>
  );
}

/** AI 1: przepływ od zgłoszenia do wdrożenia z punktami kontrolnymi człowieka. */
export function WorkflowGates() {
  const [id, setId] = useState(flow.steps[0].id);
  const i = Math.max(0, flow.steps.findIndex(s => s.id === id));
  const s = flow.steps[i];
  const L = flow.labels;
  return (
    <div className="ed-viz">
      <span className="badge sim">Przykład poglądowy</span>
      <p className="small viz-assume">{flow.assumptions}</p>
      <ol className="ed-track ed-track-flow" aria-label="Kroki przepływu">
        {flow.steps.map((x, n) => (
          <li key={x.id}>
            <button type="button" className={`ed-node ed-${x.actor}`} aria-pressed={x.id === id} onClick={() => setId(x.id)}>
              <i>{n + 1}</i>{x.label}{x.gate && <em aria-label="punkt kontrolny człowieka" title="punkt kontrolny człowieka">◆</em>}
            </button>
          </li>
        ))}
      </ol>
      <p className="ed-legend"><span className="ed-l-agent">krok agenta</span><span className="ed-l-gate">◆ punkt kontrolny człowieka</span></p>
      <div role="status" aria-live="polite" aria-atomic="true" className="ed-out ed-out-flow">
        <p className="viz-k">Krok {i + 1} z {flow.steps.length} · wykonuje: {flow.actors[s.actor]}</p>
        <Facts rows={[[L.does, s.does], [L.output, s.output]]} />
        {s.gate
          ? <p className="ed-verdict"><b>{L.gate}.</b> {s.gate}</p>
          : <p className="ed-verdict muted"><b>Bez punktu kontrolnego.</b> Agent pracuje sam w granicach zatwierdzonego planu. Wynik zostanie sprawdzony w następnych krokach.</p>}
      </div>
      <div className="ed-nav">
        <button type="button" className="more" disabled={i === 0} onClick={() => setId(flow.steps[i - 1].id)}>← Poprzedni</button>
        <button type="button" className="more" disabled={i === flow.steps.length - 1} onClick={() => setId(flow.steps[i + 1].id)}>Następny →</button>
      </div>
    </div>
  );
}

/** AI 3: ćwiczenie z review SQL-a od agenta. Zaznacz linie, potem sprawdź. */
export function SqlReview() {
  const [marked, setMarked] = useState<number[]>([]);
  const [checked, setChecked] = useState(false);
  const selectable = review.lines.map((l, i) => (l.verdict ? i : -1)).filter(i => i >= 0);
  const problems = selectable.filter(i => review.lines[i].verdict === 'problem');
  const found = problems.filter(i => marked.includes(i)).length;
  const falseAlarms = marked.filter(i => review.lines[i].verdict === 'ok').length;
  const toggle = (i: number) => setMarked(m => (m.includes(i) ? m.filter(x => x !== i) : [...m, i]));
  return (
    <div className="ed-viz">
      <span className="badge sim">Ćwiczenie · kod przykładowy</span>
      <p className="viz-k">{review.contextTitle}</p>
      <ul className="deeper-list ed-context">{review.context.map(c => <li key={c}>{c}</li>)}</ul>
      <p className="viz-k">{review.codeTitle}</p>
      <div className="ed-code" role="group" aria-label="Linie kodu do oceny">
        {review.lines.map((l, i) => {
          const on = marked.includes(i);
          const state = !checked || !l.verdict ? '' : l.verdict === 'problem' ? (on ? ' hit' : ' miss') : on ? ' alarm' : '';
          return l.verdict ? (
            <button key={i} type="button" className={`ed-line${state}`} aria-pressed={on} disabled={checked} onClick={() => toggle(i)}>
              <i>{i + 1}</i><span>{l.code}</span>
            </button>
          ) : (
            <p key={i} className="ed-line plain"><i>{i + 1}</i><span>{l.code}</span></p>
          );
        })}
      </div>
      {!checked ? (
        <div className="ed-nav">
          <span className="small">Zaznaczone linie: {marked.length}</span>
          <button type="button" className="cta" style={{ margin: 0 }} onClick={() => setChecked(true)}>Sprawdź review</button>
        </div>
      ) : (
        <div role="status" aria-live="polite">
          <p className="ed-rule">Znalezione problemy: {found} z {problems.length}. Fałszywe alarmy: {falseAlarms}.</p>
          <ul className="ed-findings">
            {selectable.map(i => {
              const l = review.lines[i];
              const on = marked.includes(i);
              const tag = l.verdict === 'problem' ? (on ? 'znalezione' : 'pominięte') : on ? 'fałszywy alarm' : 'słusznie pominięte';
              const cls = l.verdict === 'problem' ? (on ? 'ok' : 'no') : on ? 'no' : 'ok';
              return (
                <li key={i} className={cls}>
                  <p><b>Linia {i + 1} · {l.title}</b><span>{tag}</span></p>
                  <p>{l.why}</p>
                </li>
              );
            })}
          </ul>
          <div className="ed-nav">
            <span />
            <button type="button" className="more" onClick={() => { setMarked([]); setChecked(false); }}>Spróbuj jeszcze raz</button>
          </div>
        </div>
      )}
    </div>
  );
}

/** AI 4: przykładowa polityka uprawnień agenta w trzech poziomach. */
export function PermissionMatrix() {
  const order = ['allow', 'ask', 'deny'] as const;
  return (
    <div className="ed-viz">
      <span className="badge sim">Przykład poglądowy</span>
      <p className="small viz-assume">{permissions.assumptions}</p>
      <div className="ed-perms">
        {order.map(level => (
          <div key={level} className={`ed-perm ed-perm-${level}`}>
            <p className="viz-k">{permissions.levels[level]}</p>
            <ul>
              {permissions.rows.filter(r => r.level === level).map(r => (
                <li key={r.what}><b>{r.what}</b><span>{r.why}</span></li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

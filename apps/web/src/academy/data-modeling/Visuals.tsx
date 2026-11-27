import { useState } from 'react';
import { additivity, data, fanout, factTypes, grain, patterns, pit, rls, scd, semantic, star, type SampleTable } from '@content/data-modeling/dimensional-modeling/lesson';
import { Html } from '../../components/Html';
import { countryReport, customerOfTxn, fanoutResult, fanoutRows, fill, fmt, matchVersions, position, productOfTxn, publisherOfSub, rlsView, semanticCount, type JoinMode, type SemanticDefinition } from './model';

type Cell = string | number;

/** Mała tabela z przykładowymi wierszami. Szeroka tabela przewija się wewnątrz własnej ramki, nie cała strona. */
export function DataTable({ table, rowClass, cellClass, onRow, selected, wrap }: {
  table: SampleTable;
  /** Tabela opisowa: komórki mogą się zawijać. */
  wrap?: boolean;
  rowClass?: (row: number) => string;
  cellClass?: (row: number, col: number) => string;
  onRow?: (row: number) => void;
  selected?: number;
}) {
  return (
    <div className="dm-tablewrap">
      <table className={`dm-table${wrap ? ' wrap' : ''}`}>
        <caption>{table.name}</caption>
        <thead>
          <tr>{table.columns.map(c => <th key={c} scope="col">{c}</th>)}</tr>
        </thead>
        <tbody>
          {table.rows.map((row, r) => (
            <tr
              key={r}
              className={`${rowClass?.(r) ?? ''}${onRow ? ' pick' : ''}`}
              aria-selected={onRow ? selected === r : undefined}
              tabIndex={onRow ? 0 : undefined}
              onClick={onRow ? () => onRow(r) : undefined}
              onKeyDown={onRow ? e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onRow(r); } } : undefined}
            >
              {row.map((cell: Cell, c) => <td key={c} className={cellClass?.(r, c)}>{cell}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Seg<T extends string>({ label, items, value, onChange }: { label: string; items: { id: T; label: string }[]; value: T; onChange: (id: T) => void }) {
  return (
    <span className="segc" role="group" aria-label={label}>
      {items.map(i => <button key={i.id} type="button" aria-pressed={i.id === value} onClick={() => onChange(i.id)}>{i.label}</button>)}
    </span>
  );
}

/* ------------------------------------------------------------------ gwiazda */

const customerKey = (customerId: string) => star.dims.find(d => d.id === 'customer')!.rows.find(r => r[1] === customerId)![0] as number;
const dateKey = (date: string) => Number(date.replace(/-/g, ''));

export function StarSchema() {
  const [tableId, setTableId] = useState('fact');
  const [row, setRow] = useState(0);
  const tx = data.transactions.slice(0, star.factRows);
  const factTable: SampleTable = {
    name: star.fact.name,
    columns: star.fact.columns,
    rows: tx.map(t => [dateKey(t.date), customerKey(customerOfTxn(t)), productOfTxn(t).key, publisherOfSub(t.sub).key, t.id, t.amount.toFixed(2)])
  };
  const picked = tx[row];
  const customer = star.dims.find(d => d.id === 'customer')!.rows.find(r => r[1] === customerOfTxn(picked))!;
  const dim = star.dims.find(d => d.id === tableId);
  const node = (id: string, name: string, pos: string) => (
    <button key={id} type="button" className={`dm-node ${pos}`} aria-pressed={tableId === id} onClick={() => setTableId(id)}>{name}</button>
  );
  // Wiersz wymiaru wskazany przez wybrany wiersz faktu.
  const pointed = (id: string): number => {
    const rows = star.dims.find(d => d.id === id)!.rows;
    if (id === 'date') return rows.findIndex(r => r[0] === dateKey(picked.date));
    if (id === 'customer') return rows.findIndex(r => r[1] === customerOfTxn(picked));
    if (id === 'product') return rows.findIndex(r => r[0] === productOfTxn(picked).key);
    return rows.findIndex(r => r[0] === publisherOfSub(picked.sub).key);
  };

  return (
    <div className="dm">
      <span className="badge sim">Ilustracja · dane przykładowe</span>
      <Html as="p" className="small viz-assume" html={star.assumptions} />
      <div className="dm-star" role="group" aria-label="Tabele modelu">
        {star.dims.map(d => node(d.id, d.name, d.pos))}
        {node('fact', star.fact.name, 'center')}
      </div>
      <div className="dm-panel" role="status" aria-live="polite">
        <Html as="p" className="dm-role" html={dim ? dim.role : star.fact.role} />
        {dim ? (
          <DataTable table={{ name: dim.name, columns: dim.columns, rows: dim.rows }} rowClass={r => (r === pointed(dim.id) ? 'hit' : '')} />
        ) : (
          <>
            <DataTable table={factTable} onRow={setRow} selected={row} rowClass={r => (r === row ? 'hit' : '')} />
            <p className="small dm-hint">{star.pickHint}</p>
          </>
        )}
        <p className="dm-say">
          {fill(star.resolved, { txn: picked.id, date: picked.date, customer: String(customer[2]), country: String(customer[3]), product: productOfTxn(picked).name, publisher: publisherOfSub(picked.sub).name, amount: picked.amount.toFixed(2) })}
        </p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ ziarno */

export function GrainPicker() {
  const [id, setId] = useState(grain.defaultId);
  const option = grain.options.find(o => o.id === id)!;
  const good = option.answers.filter(a => a.ok).length;
  return (
    <div className="dm">
      <span className="badge sim">Ilustracja · dane przykładowe</span>
      <p className="small viz-assume">{grain.assumptions}</p>
      <p className="viz-k">Jeden wiersz to</p>
      <div className="dm-controls">
        <Seg label="Ziarno tabeli faktów" items={grain.options.map(o => ({ id: o.id, label: o.label }))} value={id} onChange={setId} />
      </div>
      <DataTable table={option.table} />
      <ul className="dm-checks" role="status" aria-live="polite">
        {grain.questions.map((q, i) => (
          <li key={q} className={option.answers[i].ok ? 'ok' : 'no'}>
            <b>{option.answers[i].ok ? 'Odpowiada' : 'Nie odpowiada'}</b>
            <span className="q">{q}</span>
            <span className="why">{option.answers[i].why}</span>
          </li>
        ))}
      </ul>
      <p className="dm-say">{good === 0 ? grain.verdictNone : fill(grain.verdictSome, { n: good })}</p>
    </div>
  );
}

/* ------------------------------------------------------------------ fan-out */

export function FanOut() {
  const [mode, setMode] = useState<'wrong' | 'right'>('wrong');
  const rows = fanoutRows(mode);
  const result = fanoutResult(mode);
  const expected = fanoutResult('right').mrr;
  return (
    <div className="dm">
      <span className="badge sim">Ilustracja · wynik liczony z wierszy poniżej</span>
      <p className="small viz-assume">{fanout.assumptions}</p>
      <div className="dm-controls">
        <Seg label="Zapytanie" items={fanout.modes} value={mode} onChange={setMode} />
      </div>
      <pre className="code dm-sql">{fanout.sql[mode]}</pre>
      <DataTable
        table={{ name: fanout.rowsTitle[mode], columns: ['subscription_id', 'publisher', 'mrr_eur', 'txn', 'amount_eur'], rows: rows.map(r => [r.sub, r.publisher, r.mrr, r.txn, r.amount]) }}
        cellClass={(r, c) => (c === 2 && rows[r].duplicate ? 'dup' : '')}
      />
      <div role="status" aria-live="polite">
        <DataTable
          table={{ name: fanout.resultTitle, columns: ['publisher_name', 'mrr', 'revenue'], rows: [...result.byPublisher.map(r => [r.publisher, r.mrr, r.revenue]), ['razem', result.mrr, result.revenue]] }}
          rowClass={r => (r === result.byPublisher.length ? 'total' : '')}
          cellClass={(r, c) => (c === 1 && result.byPublisher[r] && result.byPublisher[r].mrr !== fanoutResult('right').byPublisher[r].mrr ? 'dup' : c === 1 && r === result.byPublisher.length && result.mrr !== expected ? 'dup' : '')}
        />
        <p className={`fit-verdict ${mode === 'wrong' ? 'no' : ''}`}>{fill(fanout.note[mode], { mrr: result.mrr, expected, revenue: result.revenue })}</p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ rodzaje tabel faktów */

export function FactTypes() {
  const [month, setMonth] = useState(0);
  return (
    <div className="dm">
      <span className="badge sim">Ilustracja · dane przykładowe</span>
      <p className="small viz-assume">{factTypes.assumptions}</p>
      <p className="viz-k">Stan na koniec miesiąca</p>
      <div className="dm-controls">
        <Seg label="Miesiąc" items={factTypes.months.map((m, i) => ({ id: String(i), label: m }))} value={String(month)} onChange={v => setMonth(Number(v))} />
      </div>
      <div className="dm-cards" role="status" aria-live="polite">
        {factTypes.tables.map(t => {
          const visible = t.rows.filter(r => r.month <= month);
          const updates = 'updates' in t ? t.updates ?? [] : [];
          const rows = visible.map((r, i) => r.cells.map((cell, c) => updates.find(u => u.row === i && u.col === c && u.month <= month)?.value ?? cell));
          return (
            <section className="dm-card" key={t.id} aria-label={t.kind}>
              <h3>{t.kind}</h3>
              <p className="dm-grain">{t.grainText}</p>
              <DataTable
                table={{ name: t.name, columns: t.columns, rows }}
                rowClass={r => (visible[r].month === month ? 'new' : '')}
                cellClass={(r, c) => (updates.some(u => u.row === r && u.col === c && u.month === month) ? 'upd' : '')}
              />
              <p className="dm-behaviour">{t.behaviour[month]}</p>
              <p className="small dm-answers"><b>Odpowiada na:</b> {t.answers}</p>
            </section>
          );
        })}
      </div>
      <p className="dm-legend"><span className="new">nowy wiersz</span><span className="upd">zmieniona komórka</span></p>
    </div>
  );
}

/* ------------------------------------------------------------------ addytywność */

export function Additivity() {
  const [id, setId] = useState(additivity.measures[0].id);
  const m = additivity.measures.find(x => x.id === id)!;
  return (
    <div className="dm">
      <span className="badge sim">Ilustracja · dane przykładowe</span>
      <p className="small viz-assume">{additivity.assumptions}</p>
      <div className="dm-controls">
        <Seg label="Miara" items={additivity.measures.map(x => ({ id: x.id, label: x.label }))} value={id} onChange={setId} />
      </div>
      <div role="status" aria-live="polite">
        <p className="viz-k">{m.kind}</p>
        <DataTable table={{ name: m.label, columns: m.head, rows: [...m.rows, [m.sumLabel, m.sum]] }} rowClass={r => (r === m.rows.length ? `total ${m.sumOk ? 'good' : 'bad'}` : '')} />
        <Html as="p" className={`fit-verdict ${m.sumOk ? '' : 'no'}`} html={m.text} />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ trzy sytuacje */

export function Patterns() {
  const [id, setId] = useState(patterns.items[0].id);
  return (
    <>
      <div className="tiers" role="group" aria-label="Sytuacja">
        {patterns.items.map(p => <button key={p.id} type="button" className="tier" aria-pressed={p.id === id} onClick={() => setId(p.id)}>{p.label}</button>)}
      </div>
      {patterns.items.map(p => (
        <div key={p.id} hidden={p.id !== id} className="dm">
          <Html as="p" className="ask" html={p.problem} />
          {p.tables.map(t => <DataTable key={t.name} table={t} rowClass={r => (t.rows[r][0] === 'razem' ? 'total' : '')} />)}
          <Html as="p" html={p.result} />
          <Html as="p" className="takeaway" html={`<b>Wniosek.</b> ${p.takeaway}`} />
        </div>
      ))}
    </>
  );
}

/* ------------------------------------------------------------------ SCD: oś czasu */

const ben = () => data.customerVersions.filter(v => v.customer === 'C-102');
const benTransactions = () => data.transactions.filter(t => customerOfTxn(t) === 'C-102');
const shortDate = (d: string) => d.slice(5);

export function ScdTimeline() {
  const [type, setType] = useState<'scd1' | 'scd2'>('scd1');
  const { start, end } = scd.timeline;
  const versions = ben();
  const current = versions.find(v => v.current)!;
  const segments = type === 'scd2'
    ? versions.map(v => ({ key: v.key, country: v.country, from: v.from, to: v.to === current.to ? end : v.to, old: !v.current }))
    : [{ key: versions[0].key, country: current.country, from: versions[0].from, to: end, old: false }];
  const report = countryReport(type === 'scd1' ? 'current' : 'pit');
  const dim: SampleTable = type === 'scd1'
    ? { name: scd.dimTitle, columns: ['customer_key', 'customer_id', 'country'], rows: [[versions[0].key, 'C-102', current.country]] }
    : { name: scd.dimTitle, columns: ['customer_key', 'customer_id', 'country', 'valid_from', 'valid_to', 'is_current'], rows: versions.map(v => [v.key, v.customer, v.country, v.from, v.to, v.current ? 'true' : 'false']) };
  const change = position(current.from, start, end);

  return (
    <div className="dm">
      <span className="badge sim">Ilustracja · raport liczony z wierszy wymiaru</span>
      <p className="small viz-assume">{scd.assumptions}</p>
      <div className="dm-controls">
        <Seg label="Typ wymiaru" items={scd.types} value={type} onChange={setType} />
      </div>
      <div className="dm-time" aria-hidden="true">
        <div className="dm-track">
          {segments.map(s => {
            const left = position(s.from, start, end);
            const right = position(s.to, start, end);
            return (
              <span key={s.key} className={`dm-seg${s.old ? ' old' : ''}`} style={{ left: `${left}%`, width: `${(s.to === end ? 100 : right) - left}%` }}>
                {s.country} · klucz {s.key}
              </span>
            );
          })}
        </div>
        <div className="dm-dots">
          <span className="dm-change" style={{ left: `${change}%` }} />
          {benTransactions().map(t => <i key={t.id} className={t.amount < 0 ? 'neg' : ''} style={{ left: `${position(t.date, start, end)}%` }} title={`${t.id} ${t.date}`} />)}
        </div>
        <div className="dm-axis">{scd.timeline.ticks.map(t => <span key={t}>{t}</span>)}</div>
        <p className="dm-legend"><span className="dot">transakcja Bena</span><span className="chg">{scd.timeline.changeLabel}</span></p>
      </div>
      <div role="status" aria-live="polite">
        <DataTable table={dim} rowClass={r => (type === 'scd2' && r === 0 ? 'old' : '')} />
        <DataTable table={{ name: scd.reportTitle, columns: ['country', 'revenue_eur'], rows: [...report.rows.map(r => [r.country, r.revenue]), ['razem', report.total]] }} rowClass={r => (r === report.rows.length ? 'total' : '')} />
        <p className="fit-verdict risk">{scd.says[type]}</p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ złączenie punkt-w-czasie */

export function PitJoin() {
  const [mode, setMode] = useState<JoinMode>('pit');
  const tx = benTransactions();
  const [txnId, setTxnId] = useState(tx[2].id);
  const picked = tx.find(t => t.id === txnId)!;
  const matched = matchVersions(picked, mode);
  const versions = ben();
  const report = countryReport(mode);
  const ok = mode !== 'natural';
  return (
    <div className="dm">
      <span className="badge sim">Ilustracja · dopasowanie liczone z wierszy poniżej</span>
      <Html as="p" className="small viz-assume" html={pit.assumptions} />
      <div className="dm-controls">
        <Seg label="Sposób złączenia" items={pit.modes} value={mode} onChange={setMode} />
      </div>
      <pre className="code dm-sql">{pit.sql[mode]}</pre>
      <DataTable
        table={{ name: 'transakcje Bena (C-102)', columns: ['txn_id', 'paid_at', 'amount_eur'], rows: tx.map(t => [t.id, t.date, t.amount.toFixed(2)]) }}
        onRow={r => setTxnId(tx[r].id)}
        selected={tx.findIndex(t => t.id === txnId)}
        rowClass={r => (tx[r].id === txnId ? 'hit' : '')}
      />
      <div role="status" aria-live="polite">
        <DataTable
          table={{ name: 'dim_customer, wersje Bena', columns: ['customer_key', 'country', 'valid_from', 'valid_to', 'is_current'], rows: versions.map(v => [v.key, v.country, v.from, v.to, v.current ? 'true' : 'false']) }}
          rowClass={r => (matched.includes(versions[r]) ? (ok ? 'hit' : 'bad') : 'dim')}
        />
        <p className={`fit-verdict ${ok ? '' : 'no'}`}>
          {fill(pit.says[mode], { txn: picked.id, date: shortDate(picked.date), country: matched.map(v => v.country).join(' i '), key: matched.map(v => v.key).join(' i '), n: matched.length })}
        </p>
        <DataTable table={{ name: pit.reportTitle, columns: ['country', 'revenue_eur'], rows: [...report.rows.map(r => [r.country, r.revenue]), ['razem', report.total]] }} rowClass={r => (r === report.rows.length ? `total ${ok ? '' : 'bad'}` : '')} />
        <p className="small">{ok ? pit.totalNote.ok : fill(pit.totalNote.bad, { total: report.total })}</p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ warstwa semantyczna */

export function SemanticLab() {
  const [def, setDef] = useState<SemanticDefinition>({ trial: false, pastDue: false, unit: 'subscriptions' });
  const result = semanticCount(semantic.subs, def);
  const preset = semantic.presets.find(p => p.trial === def.trial && p.pastDue === def.pastDue && p.unit === def.unit);
  return (
    <div className="dm">
      <span className="badge sim">Ilustracja · wynik liczony z ośmiu wierszy</span>
      <Html as="p" className="small viz-assume" html={semantic.assumptions} />
      <div className="tiers" role="group" aria-label="Definicja zespołu">
        {semantic.presets.map(p => (
          <button key={p.id} type="button" className="tier" aria-pressed={preset?.id === p.id} onClick={() => setDef({ trial: p.trial, pastDue: p.pastDue, unit: p.unit })}>{p.label}</button>
        ))}
      </div>
      <div className="dm-controls">
        <span className="segc" role="group" aria-label="Które statusy liczyć">
          <button type="button" aria-pressed={def.trial} onClick={() => setDef({ ...def, trial: !def.trial })}>{semantic.toggles.trial}</button>
          <button type="button" aria-pressed={def.pastDue} onClick={() => setDef({ ...def, pastDue: !def.pastDue })}>{semantic.toggles.pastDue}</button>
        </span>
        <Seg label="Jednostka liczenia" items={semantic.units} value={def.unit} onChange={unit => setDef({ ...def, unit })} />
      </div>
      <div className="dm-count" role="status" aria-live="polite">
        <b>{result.value}</b>
        <p>{semantic.resultLabel}{preset ? `. Tak liczy ${preset.label}. ${preset.why}` : '.'}</p>
      </div>
      <DataTable
        table={{ name: 'subscriptions, stan na dziś', columns: ['subscription_id', 'customer_id', 'status'], rows: semantic.subs.map(s => [s.sub, s.customer, s.status]) }}
        rowClass={r => (result.counted.includes(semantic.subs[r].sub) ? 'hit' : 'dim')}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ RLS */

export function RlsLab() {
  const [userId, setUserId] = useState(rls.users[0].id);
  const user = rls.users.find(u => u.id === userId)!;
  const view = rlsView(user.publishers);
  return (
    <div className="dm">
      <span className="badge sim">Ilustracja · filtr liczony w przeglądarce</span>
      <p className="small viz-assume">{rls.assumptions}</p>
      <div className="tiers" role="group" aria-label="Użytkownik">
        {rls.users.map(u => <button key={u.id} type="button" className="tier" aria-pressed={u.id === userId} onClick={() => setUserId(u.id)}>{u.label}</button>)}
      </div>
      <div role="status" aria-live="polite">
        <DataTable table={{ name: rls.mapTitle, columns: ['email', 'publisher_id'], rows: user.publishers.map(p => [user.email, p]) }} />
        <DataTable
          table={{ name: rls.factTitle, columns: ['txn_id', 'paid_at', 'publisher', 'amount_eur'], rows: data.transactions.map(t => [t.id, t.date, publisherOfSub(t.sub).name, t.amount.toFixed(2)]) }}
          rowClass={r => (view.visible.includes(data.transactions[r].id) ? '' : 'cut')}
        />
        <p className="fit-verdict">{fill(rls.says, { rows: view.visible.length, revenue: fmt(view.revenue) })}</p>
      </div>
    </div>
  );
}

import { useState } from 'react';
import { scale, streaming, trust } from '@content/platform/production-platform-design/lesson';
import { Html } from '../../components/Html';
import { Chips } from './Parts';
import { deliver, windowCounts, type Delivery } from './model';

const { workload } = scale;
const { incidents, slo, access } = trust;
const { windows, semantics } = streaming;

const FIT = { good: 'ok', partial: '', bad: 'no' } as const;

/** Diagnoza wąskiego gardła: dwa przypadki, cztery możliwe zmiany, skutek każdej. Liczby ilustracyjne. */
export function WorkloadSim() {
  const [caseId, setCaseId] = useState(workload.defaultCase);
  const [fix, setFix] = useState(workload.defaultFix);
  const current = workload.cases.find(c => c.id === caseId) ?? workload.cases[0];
  const outcome = current.outcomes[fix];
  return (
    <div className="pd-box">
      <span className="badge sim">Symulacja w przeglądarce · czasy ilustracyjne, nie pomiar</span>
      <Html as="p" className="small viz-assume" html={workload.assumptions} />
      <Chips label={workload.caseLabel} options={workload.cases} value={caseId} onPick={v => { setCaseId(v); setFix(workload.defaultFix); }} />
      <p className="pd-story">{current.story}</p>
      <p className="viz-k pd-k">Objawy</p>
      <ul className="pd-symptoms">
        {current.symptoms.map(s => (
          <li key={s.label} className={s.hot ? 'hot' : undefined}><span>{s.label}</span><b>{s.value}</b></li>
        ))}
      </ul>
      <Chips label={workload.fixLabel} options={workload.fixes} value={fix} onPick={setFix} />
      <div className="pd-out" role="status" aria-live="polite" aria-atomic="true">
        <ul className="pd-symptoms pd-result">
          {outcome.metrics.map(([k, v]) => <li key={k}><span>{k}</span><b>{v}</b></li>)}
        </ul>
        <Html as="p" className={`pd-verdict ${FIT[outcome.fit]}`} html={outcome.verdict} />
      </div>
    </div>
  );
}

const CATCH = { yes: 'tak', maybe: 'może', no: 'nie' } as const;

/** Pięć incydentów, cztery mechanizmy: który by to wykrył. */
export function IncidentMatrix() {
  const [id, setId] = useState(incidents.defaultId);
  const item = incidents.items.find(i => i.id === id) ?? incidents.items[0];
  return (
    <div className="pd-box">
      <span className="badge sim">Ilustracja · incydenty wymyślone</span>
      <Html as="p" className="small viz-assume" html={incidents.assumptions} />
      <Chips label={incidents.label} options={incidents.items} value={id} onPick={setId} />
      <div className="pd-out" role="status" aria-live="polite" aria-atomic="true">
        <p className="pd-story">{item.story}</p>
        <p className="pd-dim"><span>Naruszony wymiar</span><b>{item.dimension}</b></p>
        <ul className="pd-catch">
          {incidents.mechanisms.map((m, i) => (
            <li key={m.id} className={item.catches[i].by}>
              <b>{CATCH[item.catches[i].by]}</b>
              <div>
                <p className="pd-mech">{m.label}</p>
                <Html as="p" html={item.catches[i].why} />
              </div>
            </li>
          ))}
        </ul>
        <Html as="p" className="pd-verdict" html={item.lesson} />
      </div>
    </div>
  );
}

/** Budżet błędów: ile spóźnień w kwartale dopuszcza wybrany cel. */
export function SloBudget() {
  const [pct, setPct] = useState(slo.defaultTarget);
  const target = slo.targets.find(t => t.pct === pct) ?? slo.targets[0];
  const allowed = Math.floor((slo.runsPerQuarter * (100 - pct)) / 100 + 1e-9);
  return (
    <div className="pd-box">
      <span className="badge sim">Rachunek · liczby przykładowe</span>
      <Html as="p" className="small viz-assume" html={slo.assumptions} />
      <Chips label={slo.label} options={slo.targets.map(t => ({ id: t.pct, label: `${String(t.pct).replace('.', ',')}%` }))} value={pct} onPick={setPct} />
      <div className="pd-out" role="status" aria-live="polite" aria-atomic="true">
        <div className="pd-count">
          <p><b>{slo.runsPerQuarter}</b><span>przebiegów<br />w kwartale</span></p>
          <p className={allowed === 0 ? 'hot' : undefined}><b>{allowed}</b><span>dozwolonych<br />spóźnień</span></p>
        </div>
        <p className="pd-verdict">{target.verdict}</p>
      </div>
    </div>
  );
}

/** Ta sama tabela widziana przez trzy role: maskowanie kolumny i filtr wierszy. */
export function RoleView() {
  const [id, setId] = useState(access.defaultId);
  const role = access.roles.find(r => r.id === id) ?? access.roles[0];
  return (
    <div className="pd-box">
      <span className="badge sim">Ilustracja · dane wymyślone</span>
      <Html as="p" className="small viz-assume" html={access.assumptions} />
      <pre className="code pd-query">{access.query}</pre>
      <Chips label={access.label} options={access.roles} value={id} onPick={setId} />
      <div className="pd-out" role="status" aria-live="polite" aria-atomic="true">
        <p className="pd-story">{role.need}</p>
        <div className="pd-scroll">
          <table className="data pd-table">
            <thead><tr>{access.columns.map(c => <th key={c}>{c}</th>)}</tr></thead>
            <tbody>
              {role.rows.map(r => (
                <tr key={r[0]}>{r.map((v, i) => <td key={i} className={v === '*****' ? 'off' : undefined}>{v}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="pd-verdict">{role.note}</p>
      </div>
    </div>
  );
}

const noon = (minutes: number) => `12:${String(minutes).padStart(2, '0')}`;

/** Czas zdarzenia kontra czas przetwarzania i dopuszczalne spóźnienie. */
export function WindowSim() {
  const [basis, setBasis] = useState<'event' | 'processing'>('event');
  const [lateness, setLateness] = useState(windows.lateness[0]);
  const size = windows.windowMinutes;
  const result = windowCounts(windows.events, basis, lateness, size);
  const starts = Object.keys(result.counts).map(Number).sort((a, b) => a - b);
  const verdict = basis === 'processing' ? windows.verdicts.processing : windows.verdicts[`event|${lateness}`];
  const firstCount = result.counts[0] ?? 0;
  return (
    <div className="pd-box">
      <span className="badge sim">Symulacja w przeglądarce · zdarzenia wymyślone</span>
      <Html as="p" className="small viz-assume" html={windows.assumptions} />
      <div className="pd-controls">
        <div><Chips label={windows.basisLabel} options={windows.bases} value={basis} onPick={v => setBasis(v as 'event' | 'processing')} /></div>
        <div className={basis === 'processing' ? 'pd-dim-off' : undefined}>
          <Chips label={windows.latenessLabel} options={windows.lateness.map(l => ({ id: l, label: l === 0 ? 'wcale' : `${l} min` }))} value={basis === 'processing' ? null : lateness} onPick={v => { setLateness(v); setBasis('event'); }} />
        </div>
      </div>
      <div className="pd-out" role="status" aria-live="polite" aria-atomic="true">
        <div className="pd-scroll">
          <table className="data pd-table">
            <thead><tr><th>zdarzenie</th><th>wydarzyło się</th><th>dotarło</th><th>policzone w oknie</th></tr></thead>
            <tbody>
              {windows.events.map(e => {
                const start = result.assigned[e.id];
                return (
                  <tr key={e.id} className={start === null ? 'pd-dropped' : start !== 0 ? 'pd-flag' : undefined}>
                    <td>{e.id}</td><td>{noon(e.eventAt)}</td><td>{noon(e.arrivedAt)}</td>
                    <td>{start === null ? 'odrzucone jako spóźnione' : `${noon(start)}–${noon(start + size)}`}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="pd-count">
          <p className={firstCount !== windows.events.length ? 'hot' : undefined}><b>{firstCount} z {windows.events.length}</b><span>w oknie<br />12:00–12:05</span></p>
          <p><b>{noon(result.readyAt)}</b><span>wynik okna<br />ostateczny</span></p>
          {basis === 'processing' && <p className="hot"><b>{starts.length}</b><span>okna z ruchem<br />(naprawdę: 1)</span></p>}
        </div>
        <p className={`pd-verdict ${basis === 'event' && firstCount === windows.events.length ? 'ok' : ''}`}>{verdict}</p>
      </div>
    </div>
  );
}

/** Awaria konsumenta w połowie paczki: co zostaje w tabeli przy każdej kolejności działań. */
export function SemanticsSim() {
  const [id, setId] = useState(semantics.defaultId);
  const option = semantics.options.find(o => o.id === id) ?? semantics.options[0];
  const sink = deliver(semantics.events, semantics.writtenBeforeCrash, id as Delivery);
  const seen = new Set<string>();
  const cells = sink.map(eventId => {
    const dup = seen.has(eventId);
    seen.add(eventId);
    return { eventId, dup };
  });
  const lost = semantics.events.filter(e => !seen.has(e.id));
  const amount = (eventId: string) => semantics.events.find(e => e.id === eventId)?.amount ?? 0;
  const total = sink.reduce((n, eventId) => n + amount(eventId), 0);
  const expected = semantics.events.reduce((n, e) => n + e.amount, 0);
  return (
    <div className="pd-box">
      <span className="badge sim">Symulacja w przeglądarce · zdarzenia wymyślone</span>
      <Html as="p" className="small viz-assume" html={semantics.assumptions} />
      <Chips label={semantics.label} options={semantics.options} value={id} onPick={setId} />
      <div className="pd-out" role="status" aria-live="polite" aria-atomic="true">
        <p className="small pd-how">{option.how}</p>
        <p className="viz-k pd-k">W kolejce</p>
        <ul className="pd-rows">
          {semantics.events.map(e => <li key={e.id} className="one"><span>{e.id}</span><b>{e.amount} zł</b></li>)}
        </ul>
        <p className="viz-k pd-k">W tabeli po awarii i restarcie</p>
        <ul className="pd-rows">
          {cells.map((c, i) => <li key={i} className={c.dup ? 'dup' : 'one'}><span>{c.eventId}</span><b>{c.dup ? 'duplikat' : `${amount(c.eventId)} zł`}</b></li>)}
          {lost.map(e => <li key={e.id} className="none"><span>{e.id}</span><b>zgubione</b></li>)}
        </ul>
        <div className="pd-count">
          <p className={total !== expected ? 'hot' : undefined}><b>{total} zł</b><span>suma w tabeli<br />(powinna być {expected} zł)</span></p>
        </div>
        <p className="pd-dim"><span>Ta gwarancja nazywa się</span><b>{option.name}</b></p>
        <p className={`pd-verdict ${total === expected ? 'ok' : 'no'}`}>{option.verdict}</p>
      </div>
    </div>
  );
}

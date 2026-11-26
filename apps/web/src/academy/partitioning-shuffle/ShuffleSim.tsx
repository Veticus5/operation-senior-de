import { useEffect, useState, useSyncExternalStore } from 'react';
import { inputPartitions, orders, rowsPerPartition, sim, type Country, type SimOp } from '@content/spark/partitioning-shuffle/lesson';
import { Html } from '../../components/Html';

const STEP_MS = 2100;
const COMPACT_QUERY = '(max-width: 640px)';

/** Wymiary sceny SVG. Dwa zestawy: szeroki i wąski ekran. Scena skaluje się przez viewBox. */
interface Geo { w: number; chipW: number; chipH: number; gap: number; pad: number; boxGap: number; labelH: number; bandH: number; inRows: number; outRows: number }
const WIDE: Geo = { w: 700, chipW: 62, chipH: 26, gap: 6, pad: 10, boxGap: 10, labelH: 24, bandH: 78, inRows: 2, outRows: 3 };
const COMPACT: Geo = { w: 360, chipW: 34, chipH: 32, gap: 4, pad: 5, boxGap: 6, labelH: 22, bandH: 70, inRows: 2, outRows: 3 };

const boxH = (g: Geo, rows: number) => g.labelH + 2 * g.pad + rows * g.chipH + (rows - 1) * g.gap;
const boxW = (g: Geo, n: number) => (g.w - (n - 1) * g.boxGap) / n;
const cols = (g: Geo, n: number) => Math.max(1, Math.floor((boxW(g, n) - 2 * g.pad + g.gap) / (g.chipW + g.gap)));

function slot(g: Geo, row: 'in' | 'out', n: number, box: number, index: number): { x: number; y: number } {
  const c = cols(g, n);
  const content = c * g.chipW + (c - 1) * g.gap;
  const x0 = box * (boxW(g, n) + g.boxGap) + (boxW(g, n) - content) / 2;
  const y0 = (row === 'in' ? 0 : boxH(g, g.inRows) + g.bandH) + g.labelH + g.pad;
  return { x: x0 + (index % c) * (g.chipW + g.gap), y: y0 + Math.floor(index / c) * (g.chipH + g.gap) };
}

/** Gdzie jest i jak wygląda jeden wiersz w danym kroku operacji. */
interface Place { row: 'in' | 'out'; n: number; box: number; index: number; hidden?: boolean; dim?: boolean; amount: number }

const inBox = (i: number) => Math.floor(i / rowsPerPartition);
const sum = (items: { amount: number }[]) => items.reduce((total, o) => total + o.amount, 0);

function place(op: SimOp, step: number, i: number): Place {
  const o = orders[i];
  const box = inBox(i);
  const start: Place = { row: 'in', n: inputPartitions, box, index: i % rowsPerPartition, amount: o.amount };
  if (step === 0) return start;
  const mates = orders.filter((_, j) => inBox(j) === box);

  switch (op.id) {
    case 'filter': {
      const keep = o.amount >= sim.minAmount;
      if (step === 1) return { ...start, dim: !keep };
      if (!keep) return { ...start, hidden: true };
      return { ...start, row: 'out', n: op.outPartitions, index: mates.filter(m => m.amount >= sim.minAmount && m.id < o.id).length };
    }
    case 'groupBy': {
      // Suma częściowa: jeden kafelek na kraj w partycji wejścia. Prowadzi pierwszy wiersz danego kraju.
      const group = mates.filter(m => m.country === o.country);
      const leader = group[0].id === o.id;
      const seen: Country[] = [];
      for (const m of mates) if (!seen.includes(m.country)) seen.push(m.country);
      if (step === 1) return { ...start, index: seen.indexOf(o.country), hidden: !leader, amount: sum(group) };
      const target = sim.hashTarget[o.country];
      const all = orders.filter(m => m.country === o.country);
      if (step === 2) {
        const earlier = new Set(all.filter(m => inBox(orders.indexOf(m)) < box).map(m => inBox(orders.indexOf(m)))).size;
        return { row: 'out', n: op.outPartitions, box: target, index: earlier, hidden: !leader, amount: sum(group) };
      }
      return { row: 'out', n: op.outPartitions, box: target, index: 0, hidden: all[0].id !== o.id, amount: sum(all) };
    }
    case 'repartitionKey':
      return { row: 'out', n: op.outPartitions, box: sim.hashTarget[o.country], index: orders.filter(m => m.country === o.country && m.id < o.id).length, amount: o.amount };
    case 'repartition': {
      const target = sim.roundRobin.findIndex(ids => ids.includes(o.id));
      return { row: 'out', n: op.outPartitions, box: target, index: sim.roundRobin[target].indexOf(o.id), amount: o.amount };
    }
    case 'coalesce': {
      const target = sim.coalesceGroups.findIndex(group => group.includes(box));
      const before = orders.filter((m, j) => sim.coalesceGroups[target].includes(inBox(j)) && m.id < o.id).length;
      return { row: 'out', n: op.outPartitions, box: target, index: before, amount: o.amount };
    }
  }
}

const tasksWord = (n: number) => (n === 1 ? 'task' : n < 5 ? 'taski' : 'tasków');

function useCompact(): boolean {
  return useSyncExternalStore(
    cb => {
      const mq = window.matchMedia(COMPACT_QUERY);
      mq.addEventListener('change', cb);
      return () => mq.removeEventListener('change', cb);
    },
    () => window.matchMedia(COMPACT_QUERY).matches
  );
}

/**
 * Symulacja: 12 zamówień w 3 partycjach i pięć operacji. Każdy kafelek to jeden wiersz, a po sumie częściowej
 * jeden rekord pośredni. To JavaScript, nie Spark: ruch jest ilustracją, a układ końcowy i liczniki są
 * przepisane z labu (labs/partitioning_shuffle/shuffle_lab.py) do treści lekcji.
 *
 * Stan to wybrana operacja i numer kroku. Pozycję każdego kafelka wylicza funkcja `place`,
 * a przejście między krokami animuje CSS (transform i opacity).
 */
export function ShuffleSim() {
  const [opId, setOpId] = useState(sim.defaultOp);
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const compact = useCompact();
  const g = compact ? COMPACT : WIDE;
  const op = sim.ops.find(o => o.id === opId) ?? sim.ops[0];
  const last = op.steps.length - 1;
  const finished = step === last;
  const wide = op.kind === 'wide';

  useEffect(() => {
    if (!playing) return;
    if (step >= last) {
      setPlaying(false);
      return;
    }
    const timer = setTimeout(() => setStep(s => s + 1), step === 0 ? 300 : STEP_MS);
    return () => clearTimeout(timer);
  }, [playing, step, last]);

  const choose = (id: string) => {
    setOpId(id);
    setStep(0);
    setPlaying(false);
  };

  const inH = boxH(g, g.inRows);
  const outH = boxH(g, g.outRows);
  const outY = inH + g.bandH;
  const height = outY + outH;
  const bandY = inH + g.bandH / 2;
  const started = step > 0;
  const label = (p: number) => (compact ? `p${p}` : `partycja ${p}`);
  const hashed = op.id === 'groupBy' || op.id === 'repartitionKey';

  return (
    <div className="psh">
      <span className="badge sim">Symulacja w przeglądarce · układ końcowy i liczniki z labu</span>
      <Html as="p" className="small viz-assume" html={sim.assumptions} />

      <div className="psh-ops" role="group" aria-label="Operacja">
        {sim.ops.map(o => (
          <button key={o.id} type="button" className="psh-op" aria-pressed={o.id === op.id} onClick={() => choose(o.id)}>
            {o.label}
          </button>
        ))}
      </div>
      <p className="psh-code">
        <code>{op.code}</code>
        <span>SQL: {op.sql}</span>
      </p>

      <div className="psh-actions">
        <button type="button" className="op act" disabled={playing} onClick={() => { setStep(0); setPlaying(true); }}>
          {finished ? 'Uruchom jeszcze raz' : started ? 'Uruchom od początku' : 'Uruchom'}
        </button>
        <button type="button" className="op ghostb" disabled={playing || finished} onClick={() => setStep(step + 1)}>Następny krok</button>
        {started && !playing && (
          <button type="button" className="op ghostb" onClick={() => setStep(0)}>Wyczyść</button>
        )}
      </div>

      <div className="psh-say" aria-live="polite" aria-atomic="true">
        <span className="psh-stepn">krok {step + 1} z {op.steps.length}</span>
        <p>{op.steps[step]}</p>
      </div>

      <div className="psh-scene">
        <p className="viz-k">Partycje wejścia · {inputPartitions}</p>
        <svg viewBox={`0 0 ${g.w} ${height}`} role="img" aria-label={`${op.code}. ${op.steps[step]}`}>
          {Array.from({ length: inputPartitions }, (_, b) => (
            <g key={`in-${b}`}>
              <rect className="psh-box" x={b * (boxW(g, inputPartitions) + g.boxGap)} y={0} width={boxW(g, inputPartitions)} height={inH} rx={10} />
              <text className="psh-boxl" x={b * (boxW(g, inputPartitions) + g.boxGap) + g.pad} y={16}>{label(b)}</text>
            </g>
          ))}
          {Array.from({ length: op.outPartitions }, (_, b) => (
            <g key={`out-${op.id}-${b}`}>
              <rect className={`psh-box out${started ? ' on' : ''}`} x={b * (boxW(g, op.outPartitions) + g.boxGap)} y={outY} width={boxW(g, op.outPartitions)} height={outH} rx={10} />
              <text className="psh-boxl" x={b * (boxW(g, op.outPartitions) + g.boxGap) + g.pad} y={outY + 16}>{label(b)}</text>
            </g>
          ))}

          {/* Pas między wejściem a wynikiem: przy shuffle'u granica stage'a, inaczej informacja, że jej nie ma. */}
          {started && wide && <line className="psh-cut" x1={0} x2={g.w} y1={bandY} y2={bandY} />}
          <text className={`psh-band${started ? (wide ? ' wide' : ' narrow') : ''}`} x={started && wide ? g.w : g.w / 2} y={started && wide ? bandY - 8 : bandY + 4} textAnchor={started && wide ? 'end' : 'middle'}>
            {started ? op.band : sim.bandIdle}
          </text>
          {started && wide && (
            <>
              <text className="psh-stagel" x={0} y={bandY - 8}>stage 1 · {op.lab.tasks[0]} {tasksWord(op.lab.tasks[0])}</text>
              <text className="psh-stagel" x={0} y={bandY + 18}>stage 2 · {op.lab.tasks[1]} {tasksWord(op.lab.tasks[1])}</text>
            </>
          )}

          {orders.map((o, i) => {
            const p = place(op, step, i);
            const { x, y } = slot(g, p.row, p.n, p.box, p.index);
            return (
              <g
                key={o.id}
                className={`psh-chip c-${o.country}${p.dim ? ' dim' : ''}`}
                style={{ transform: `translate(${x}px, ${y}px)`, opacity: p.hidden ? 0 : p.dim ? 0.32 : 1, transitionDelay: step === 0 ? '0ms' : `${i * 45}ms` }}
              >
                <rect width={g.chipW} height={g.chipH} rx={6} />
                {compact ? (
                  <>
                    <text x={g.chipW / 2} y={13} textAnchor="middle">{o.country}</text>
                    <text className="amt" x={g.chipW / 2} y={26} textAnchor="middle">{p.amount}</text>
                  </>
                ) : (
                  <text x={g.chipW / 2} y={17.5} textAnchor="middle">
                    {o.country} <tspan className="amt">{p.amount}</tspan>
                  </text>
                )}
              </g>
            );
          })}
        </svg>
        <p className="viz-k psh-outk">Partycje wyniku · {op.outPartitions}</p>
        <p className={`psh-hash${hashed ? '' : ' off'}`} aria-hidden={!hashed}>
          {sim.hashLegend}:{' '}
          {(Object.entries(sim.hashTarget) as [Country, number][]).sort((a, b) => a[1] - b[1]).map(([country, target]) => (
            <span key={country} className={`c-${country}`}>{country} → {target}</span>
          ))}
        </p>
      </div>

      <div className="psh-count" role="status" aria-live="polite" aria-atomic="true">
        <p><b>{finished ? op.lab.shuffleRecords : '?'}</b><Html as="span" html={sim.counters.shuffle} /></p>
        <p><b>{finished ? op.lab.stages : '?'}</b><Html as="span" html={sim.counters.stages} /></p>
        <p><b>{finished ? op.lab.tasks.join(' + ') : '?'}</b><Html as="span" html={sim.counters.tasks} /></p>
        <p className="psh-verdict">{finished ? op.verdict : 'Liczniki z labu pojawią się po ostatnim kroku. Najpierw zgadnij: ile rekordów przejdzie przez shuffle?'}</p>
      </div>
    </div>
  );
}

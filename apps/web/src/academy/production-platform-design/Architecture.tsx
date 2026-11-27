import { useState } from 'react';
import { architecture } from '@content/platform/production-platform-design/lesson';
import { Html } from '../../components/Html';

const { map, layers } = architecture;

/** Mapa od źródła do BI. Kliknięcie elementu pokazuje jego rolę, przykład, typową awarię i decyzję projektową. */
export function ArchMap() {
  const [id, setId] = useState(map.defaultId);
  const all = [...map.flow, ...map.cross];
  const node = all.find(n => n.id === id) ?? all[0];
  const button = (n: (typeof all)[number]) => (
    <button key={n.id} type="button" className="pd-node" aria-pressed={n.id === id} onClick={() => setId(n.id)}>
      <b>{n.label}</b>
      <span>{n.sub}</span>
    </button>
  );
  return (
    <div className="pd-box pd-map">
      <span className="badge sim">Ilustracja · przykładowa architektura</span>
      <Html as="p" className="small viz-assume" html={map.assumptions} />
      <p className="viz-k pd-k">{map.flowLabel}</p>
      <div className="pd-flow" role="group" aria-label={map.flowLabel}>{map.flow.map(button)}</div>
      <p className="viz-k pd-k">{map.crossLabel}</p>
      <div className="pd-cross" role="group" aria-label={map.crossLabel}>{map.cross.map(button)}</div>
      <div className="pd-out" role="status" aria-live="polite" aria-atomic="true">
        <h3>{node.label}</h3>
        <dl className="pd-dl">
          <div><dt>Za co odpowiada</dt><dd><Html as="span" html={node.role} /></dd></div>
          <div><dt>W tym przykładzie</dt><dd><Html as="span" html={node.example} /></dd></div>
          <div className="pd-bad"><dt>Jak się psuje</dt><dd><Html as="span" html={node.fails} /></dd></div>
          <div className="pd-key"><dt>Decyzja</dt><dd><Html as="span" html={node.decision} /></dd></div>
        </dl>
      </div>
    </div>
  );
}

/** Te same rekordy w trzech warstwach: co każda warstwa zrobiła i czego celowo nie zrobiła. */
export function LayerRecords() {
  const [id, setId] = useState(layers.defaultId);
  const layer = layers.items.find(l => l.id === id) ?? layers.items[0];
  const hasNotes = layer.rows.some(r => r.note);
  return (
    <div className="pd-box">
      <span className="badge sim">Ilustracja · dane wymyślone</span>
      <Html as="p" className="small viz-assume" html={layers.assumptions} />
      <span className="segc pd-seg" role="group" aria-label="Warstwa">
        {layers.items.map(l => (
          <button key={l.id} type="button" aria-pressed={l.id === id} onClick={() => setId(l.id)}>{l.label}</button>
        ))}
      </span>
      <div className="pd-out" role="status" aria-live="polite" aria-atomic="true">
        <p className="pd-tablename"><code>{layer.table}</code> · {layer.rows.length} {layer.rows.length === 1 ? 'wiersz' : layer.rows.length < 5 ? 'wiersze' : 'wierszy'}</p>
        <div className="pd-scroll">
          <table className={`data pd-table pd-${layer.id}`}>
            <thead>
              <tr>
                {layer.columns.map(c => <th key={c}>{c}</th>)}
                {hasNotes && <th>uwaga</th>}
              </tr>
            </thead>
            <tbody>
              {layer.rows.map((r, i) => (
                <tr key={i} className={r.flag ? 'pd-flag' : undefined}>
                  {r.cells.map((c, j) => <td key={j}>{c}</td>)}
                  {hasNotes && <td className="pd-note">{r.note ?? ''}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="viz-k pd-k">Co zrobiła ta warstwa</p>
        <ul className="deeper-list pd-list">
          {layer.did.map((d, i) => <li key={i}><Html as="span" html={d} /></li>)}
        </ul>
        <Html as="p" className="pd-verdict" html={`<b>Czego nie zrobiła.</b> ${layer.didNot}`} />
      </div>
    </div>
  );
}

import { useState } from 'react';
import { arch, compare, compute, deploy, microsoft, myths, uc } from '@content/databricks/platform-delta-lake/lesson';
import { Html } from '../../components/Html';
import { canRead } from './engine';

const MAP_BADGE = 'Schemat według dokumentacji · uproszczony';

/** Architektura: cztery części platformy na dwóch kontach. Kliknięcie pokazuje, co tam działa. */
export function ArchMap() {
  const [id, setId] = useState(arch.defaultBox);
  const box = arch.boxes.find(b => b.id === id) ?? arch.boxes[0];
  const side = (owner: 'databricks' | 'you') => (
    <div className={`dl-side ${owner}`}>
      <p className="viz-k">{arch.owners[owner]}</p>
      {arch.boxes.filter(b => b.owner === owner).map(b => (
        <button key={b.id} type="button" className="dl-box" aria-pressed={b.id === id} onClick={() => setId(b.id)}>
          <b>{b.name}</b>
          <span>{b.items.join(' · ')}</span>
        </button>
      ))}
    </div>
  );
  return (
    <div className="dl">
      <span className="badge sim">{MAP_BADGE}</span>
      <p className="small viz-assume">{arch.assumptions}</p>
      <div className="dl-arch">
        {side('databricks')}
        {side('you')}
      </div>
      <div className="dl-out" role="status" aria-live="polite" aria-atomic="true">
        <p className="dl-verdict"><b>{box.name} · {arch.owners[box.owner]}.</b> {box.text}</p>
      </div>
    </div>
  );
}

/** Compute: obciążenie i pasujący rodzaj compute. */
export function ComputePicker() {
  const [id, setId] = useState(compute.defaultCase);
  const c = compute.cases.find(x => x.id === id) ?? compute.cases[0];
  return (
    <div className="dl">
      <p className="small viz-assume">{compute.assumptions}</p>
      <p className="viz-k">Obciążenie</p>
      <div className="dl-chips" role="group" aria-label="Obciążenie">
        {compute.cases.map(x => (
          <button key={x.id} type="button" className="dl-chip" aria-pressed={x.id === id} onClick={() => setId(x.id)}>{x.label}</button>
        ))}
      </div>
      <dl className="dl-card" role="status" aria-live="polite" aria-atomic="true">
        <dt>{compute.labels.pick}</dt><dd className="lead">{c.pick}</dd>
        <dt>{compute.labels.why}</dt><dd>{c.why}</dd>
        <dt>{compute.labels.manage}</dt><dd>{c.manage}</dd>
        <dt>{compute.labels.catch}</dt><dd>{c.catch}</dd>
      </dl>
    </div>
  );
}

/** Unity Catalog: drzewo obiektów i dziedziczenie uprawnień. */
export function UcTree() {
  const [grant, setGrant] = useState(uc.defaultGrant);
  const [useCatalog, setUseCatalog] = useState(true);
  const [useSchema, setUseSchema] = useState(true);
  const readable = (id: string) => canRead(uc.objects.find(o => o.id === id)!, grant as 'catalog' | 'schema' | 'table', { catalog: useCatalog, salesSchema: useSchema });
  const count = uc.objects.filter(o => readable(o.id)).length;
  return (
    <div className="dl">
      <span className="badge sim">Symulacja reguły z dokumentacji</span>
      <p className="small viz-assume">{uc.assumptions}</p>
      <p className="viz-k">GRANT SELECT … TO analityk</p>
      <span className="segc dl-wrap" role="group" aria-label="Poziom nadania SELECT">
        {uc.grants.map(g => <button key={g.id} type="button" aria-pressed={g.id === grant} onClick={() => setGrant(g.id)}>{g.label}</button>)}
      </span>
      <div className="dl-toggles dl-gap">
        <label><input type="checkbox" checked={useCatalog} onChange={e => setUseCatalog(e.target.checked)} /><code>{uc.useCatalogLabel}</code></label>
        <label><input type="checkbox" checked={useSchema} onChange={e => setUseSchema(e.target.checked)} /><code>{uc.useSchemaLabel}</code></label>
      </div>
      <div className="dl-scene" role="status" aria-live="polite" aria-atomic="true">
        <ul className="dl-tree">
          <li>
            <span className="dl-node">metastore</span>
            <ul>
              <li>
                <span className={`dl-node${grant === 'catalog' ? ' granted' : ''}`}>katalog <b>{uc.catalog}</b></span>
                <ul>
                  {uc.schemas.map(s => (
                    <li key={s}>
                      <span className={`dl-node${grant === 'schema' && s === 'sales' ? ' granted' : ''}`}>schemat <b>{uc.catalog}.{s}</b></span>
                      <ul>
                        {uc.objects.filter(o => o.schema === s).map(o => (
                          <li key={o.id}>
                            <span className={`dl-node ${o.kind === 'volume' ? 'volume' : readable(o.id) ? 'yes' : 'no'}${grant === 'table' && o.id === 'orders' ? ' granted' : ''}`}>
                              {o.kind === 'table' ? 'tabela' : 'wolumen'} <b>{o.name}</b>
                              <i>{o.kind === 'volume' ? uc.volumeNote : readable(o.id) ? 'czyta' : 'nie czyta'}</i>
                            </span>
                          </li>
                        ))}
                      </ul>
                    </li>
                  ))}
                </ul>
              </li>
            </ul>
          </li>
        </ul>
        <p className={`dl-verdict ${count ? 'ok' : 'no'}`}>{count ? uc.verdicts.some : uc.verdicts.none}</p>
        {grant === 'catalog' && count > 0 && <p className="dl-cost">{uc.verdicts.finance}</p>}
      </div>
    </div>
  );
}

/** Przepływ wdrożenia: od pull requesta do produkcji. */
export function DeployFlow() {
  return (
    <div className="dl">
      <p className="viz-k">{deploy.flowTitle}</p>
      <ol className="dl-flow">
        {deploy.flow.map(f => (
          <li key={f.step}><b>{f.step}</b><Html as="span" html={f.text} /></li>
        ))}
      </ol>
    </div>
  );
}

/** Ekosystem Microsoft: łańcuch od źródeł do raportu i siedem pojęć do kliknięcia. */
export function MicrosoftMap() {
  const [id, setId] = useState(microsoft.defaultItem);
  const item = microsoft.items.find(x => x.id === id) ?? microsoft.items[0];
  return (
    <div className="dl">
      <span className="badge sim">{MAP_BADGE}</span>
      <p className="small viz-assume">{microsoft.assumptions}</p>
      <ol className="dl-chain" aria-label="Przepływ danych">
        {microsoft.chain.map(c => <li key={c}>{c}</li>)}
      </ol>
      <div className="dl-chips dl-gap" role="group" aria-label="Pojęcie">
        {microsoft.items.map(x => (
          <button key={x.id} type="button" className="dl-chip" aria-pressed={x.id === id} onClick={() => setId(x.id)}>{x.name}</button>
        ))}
      </div>
      <dl className="dl-card" role="status" aria-live="polite" aria-atomic="true">
        <dt>{microsoft.labels.what}</dt><dd className="lead">{item.what}</dd>
        <dt>{microsoft.labels.role}</dt><dd>{item.role}</dd>
        <dt>{microsoft.labels.catch}</dt><dd>{item.catch}</dd>
      </dl>
    </div>
  );
}

/** Snowflake, Databricks, Fabric: jeden wymiar naraz, trzy kolumny. */
export function CompareDims() {
  const [id, setId] = useState(compare.defaultDim);
  const dim = compare.dims.find(d => d.id === id) ?? compare.dims[0];
  const cells = [dim.snowflake, dim.databricks, dim.fabric];
  return (
    <div className="dl">
      <p className="small viz-assume">{compare.assumptions}</p>
      <p className="viz-k">Wymiar</p>
      <div className="dl-chips" role="group" aria-label="Wymiar porównania">
        {compare.dims.map(d => (
          <button key={d.id} type="button" className="dl-chip" aria-pressed={d.id === id} onClick={() => setId(d.id)}>{d.label}</button>
        ))}
      </div>
      <div className="dl-three" role="status" aria-live="polite" aria-atomic="true">
        {compare.platforms.map((p, i) => (
          <div key={p} className={p === 'Databricks' ? 'here' : undefined}>
            <p className="viz-k">{p}</p>
            <p>{cells[i]}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Typowe błędne przekonania: zdanie i jego korekta, rozwijane niezależnie. */
export function Myths() {
  return (
    <div className="dl-myths">
      {myths.items.map(m => (
        <details className="fu" key={m.myth}>
          <summary><span>{m.myth}</span></summary>
          <div className="a"><p>{m.fact}</p></div>
        </details>
      ))}
    </div>
  );
}

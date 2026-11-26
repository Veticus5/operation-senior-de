import { chain } from '@content/spark/execution-architecture/lesson';
import { Html } from '../../components/Html';

/** Te same cztery linijki, dwa zestawy liczb z labu: ile akcji, jobów, stage'y i tasków. */
export function Chain() {
  return (
    <div className="exc">
      <span className="badge">{chain.badge}</span>
      <Html as="p" className="small viz-assume" html={chain.assumptions} />
      {chain.rows.map(row => (
        <div className="exc-row" key={row.label}>
          <p className="viz-k">{row.label}</p>
          <dl className="exc-nums">
            {row.values.map((value, i) => (
              <div key={chain.levels[i]}>
                <dd>{value}</dd>
                <dt>{chain.levels[i]}</dt>
              </div>
            ))}
          </dl>
        </div>
      ))}
    </div>
  );
}

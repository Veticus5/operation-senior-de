import { dag } from '@content/spark/execution-architecture/lesson';

function Node({ id }: { id: number }) {
  const node = dag.nodes.find(n => n.id === id);
  if (!node) return null;
  return (
    <li className="exd-node">
      <b>{node.label}</b>
      <span>{node.sub}</span>
      <i>liczba tasków: {node.tasks}</i>
    </li>
  );
}

const Arrow = () => (
  <p className="exd-arrow" aria-hidden="true">
    <span>{dag.edge}</span>
  </p>
);

/**
 * Graf stage'y zapytania z joinem: dwa niezależne odczyty, potem join, potem suma. Układ z labu (AQE wyłączone).
 * Na wąskim ekranie graf obraca się z poziomego na pionowy, a tekst zachowuje rozmiar.
 */
export function StageDag() {
  return (
    <figure className="exd">
      <span className="badge">Struktura z labu · rysunek to ilustracja</span>
      <div className="exd-graph">
        <ol className="exd-col" aria-label="Stage'e, które nie zależą od siebie">
          <Node id={0} />
          <Node id={1} />
        </ol>
        <Arrow />
        <ol className="exd-col" aria-label="Potem">
          <Node id={2} />
        </ol>
        <Arrow />
        <ol className="exd-col" aria-label="Na końcu">
          <Node id={3} />
        </ol>
      </div>
      <figcaption className="small">{dag.caption}</figcaption>
    </figure>
  );
}

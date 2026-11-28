import type { KbFigure } from '@content/knowledge-base/index';
import { cellCounts, scannedParts } from './outline';

/**
 * Statyczne ilustracje Knowledge Base. Zwykły HTML i CSS, bez stanu i bez skryptów,
 * więc wyglądają tak samo na stronie i w PDF. Wszystkie napisy i liczby przychodzą z treści.
 */

type Of<K extends KbFigure['kind']> = Extract<KbFigure, { kind: K }>;

function Cells({ fig }: { fig: Of<'cells'> }) {
  return (
    <div className="kb-cells">
      {fig.panels.map(panel => {
        const counts = cellCounts(fig.rows.length, fig.columns.length, fig.need, panel.layout);
        return (
          <div key={panel.layout} className="kb-panel">
            <p className="kb-panel-h">
              <b>{panel.label}</b>
              <span>{panel.note}</span>
            </p>
            <div className={`kb-grid kb-grid-${panel.layout}`} style={{ gridTemplateColumns: `repeat(${fig.columns.length}, minmax(0, 1fr))` }}>
              {fig.columns.map(c => (
                <span key={c} className="kb-grid-h">
                  {c}
                </span>
              ))}
              {fig.rows.flatMap((row, r) =>
                row.map((value, c) => {
                  const needed = fig.need.includes(c);
                  const state = needed ? 'need' : panel.layout === 'row' ? 'read' : 'skip';
                  return (
                    <span key={`${r}-${c}`} className={`kb-cell kb-cell-${state}`}>
                      {value}
                    </span>
                  );
                })
              )}
            </div>
            <p className="kb-count">
              {fig.legend.count}: <b>{counts.read}</b> z {counts.total}
            </p>
          </div>
        );
      })}
      <p className="kb-legend">
        <span className="kb-key-need">{fig.legend.need}</span>
        <span className="kb-key-read">{fig.legend.read}</span>
        <span className="kb-key-skip">{fig.legend.skipped}</span>
      </p>
    </div>
  );
}

function Path({ fig }: { fig: Of<'path'> }) {
  return (
    <div className="kb-path">
      <ol>
        {fig.steps.map((step, i) => (
          <li key={step.name}>
            <span className="kb-path-n">{i + 1}</span>
            <div>
              <p className="kb-path-h">
                <b>{step.name}</b>
                <span>{step.note}</span>
              </p>
              <p className="kb-chips">
                {step.options.map((option, o) => (
                  <span key={option} className={o === step.pick ? 'kb-chip kb-chip-on' : 'kb-chip'}>
                    {option}
                  </span>
                ))}
              </p>
            </div>
          </li>
        ))}
      </ol>
      <p className="kb-count">{fig.total}</p>
    </div>
  );
}

function Partitions({ fig }: { fig: Of<'partitions'> }) {
  const name = (n: number) => fig.units[n - 1];
  return (
    <div className="kb-parts">
      <p className="kb-parts-filter">{fig.filter.label}</p>
      {fig.layouts.map(layout => {
        const read = scannedParts(layout.parts, fig.filter.range);
        return (
          <div key={layout.label} className="kb-panel">
            <p className="kb-panel-h">
              <b>{layout.label}</b>
              <span>{layout.note}</span>
            </p>
            <div className="kb-parts-row">
              {layout.parts.map(([min, max], i) => (
                <span key={i} className={read[i] ? 'kb-part kb-part-read' : 'kb-part'}>
                  <i>{i + 1}</i>
                  {min === max ? name(min) : `${name(min)}–${name(max)}`}
                </span>
              ))}
            </div>
            <p className="kb-count">
              {fig.legend.count}: <b>{read.filter(Boolean).length}</b> z {layout.parts.length}
            </p>
          </div>
        );
      })}
      <p className="kb-legend">
        <span className="kb-key-need">{fig.legend.read}</span>
        <span className="kb-key-skip">{fig.legend.skipped}</span>
      </p>
    </div>
  );
}

function Stacks({ fig }: { fig: Of<'stacks'> }) {
  return (
    <div className="kb-stacks">
      {fig.columns.map(column => (
        <div key={column.label} className="kb-stack">
          <p className="kb-stack-h">{column.label}</p>
          {column.layers.map(layer => (
            <p key={layer.name} className="kb-layer">
              <span>{layer.name}</span>
              {layer.text}
            </p>
          ))}
        </div>
      ))}
    </div>
  );
}

function Lanes({ fig }: { fig: Of<'lanes'> }) {
  return (
    <div className="kb-lanes">
      {fig.lanes.map(lane => (
        <div key={lane.label} className="kb-lane">
          <p className="kb-lane-h">{lane.label}</p>
          <ol>
            {lane.steps.map(step => (
              <li key={step.name} className={step.hot ? 'kb-step kb-step-hot' : 'kb-step'}>
                <b>{step.name}</b>
                <span>{step.where}</span>
              </li>
            ))}
          </ol>
        </div>
      ))}
    </div>
  );
}

function Clusters({ fig }: { fig: Of<'clusters'> }) {
  return (
    <div className="kb-clusters">
      {fig.panels.map(panel => (
        <div key={panel.label} className="kb-panel">
          <p className="kb-panel-h">
            <b>{panel.label}</b>
          </p>
          <div className="kb-nodes">
            {panel.nodes.map(node => (
              <p key={node.name} className="kb-node">
                <b>{node.name}</b>
                <span>{node.note}</span>
              </p>
            ))}
          </div>
          {panel.shared && <p className="kb-shared">{panel.shared}</p>}
        </div>
      ))}
    </div>
  );
}

export function Figure({ fig }: { fig: KbFigure }) {
  switch (fig.kind) {
    case 'cells':
      return <Cells fig={fig} />;
    case 'path':
      return <Path fig={fig} />;
    case 'partitions':
      return <Partitions fig={fig} />;
    case 'stacks':
      return <Stacks fig={fig} />;
    case 'lanes':
      return <Lanes fig={fig} />;
    case 'clusters':
      return <Clusters fig={fig} />;
  }
}

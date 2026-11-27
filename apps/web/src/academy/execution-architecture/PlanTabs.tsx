import { useState } from 'react';
import { plans } from '@content/spark/execution-architecture/lesson';
import { CodeExplainer } from '../../components/CodeExplainer';
import { Html } from '../../components/Html';

/**
 * Cztery plany jednego zapytania, w kolejności, w jakiej powstają. Wydruki pochodzą z labu.
 * Plan fizyczny idzie przez CodeExplainer, bo to z niego wynikają stage'e.
 */
export function PlanTabs() {
  const [viewId, setViewId] = useState(plans.defaultView);
  const view = plans.views.find(v => v.id === viewId) ?? plans.views[0];
  return (
    <div className="exp">
      <span className="badge">{plans.badge}</span>
      <span className="segc exp-tabs" role="group" aria-label="Wersja planu">
        {plans.views.map(v => (
          <button key={v.id} type="button" aria-pressed={v.id === view.id} onClick={() => setViewId(v.id)}>{v.label}</button>
        ))}
      </span>
      <div className="exp-view" role="status" aria-live="polite">
        <h3>{view.title}</h3>
        <Html as="p" html={view.text} />
      </div>
      {view.code
        ? <pre className="code exp-code">{view.code}</pre>
        : <CodeExplainer title={plans.physicalTitle} lines={plans.physical} order="bottom-up" />}
    </div>
  );
}

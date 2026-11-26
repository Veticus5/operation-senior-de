import { useState } from 'react';
import { stack } from '@content/spark/fundamentals/lesson';
import { Html } from '../../components/Html';

/**
 * Trzy warstwy: API (PySpark), silnik (Apache Spark) i miejsce uruchomienia. Przełącznik zmienia tylko
 * dolną warstwę, żeby było widać, co się przenosi między laptopem, własnym klastrem i Databricks.
 */
export function Stack() {
  const [placeId, setPlaceId] = useState(stack.defaultPlace);
  const place = stack.places.find(p => p.id === placeId) ?? stack.places[0];
  return (
    <div className="stk">
      <span className="segc" role="group" aria-label="Gdzie uruchamiasz kod">
        {stack.places.map(p => (
          <button key={p.id} type="button" aria-pressed={p.id === place.id} onClick={() => setPlaceId(p.id)}>{p.label}</button>
        ))}
      </span>
      <ol className="stk-layers">
        {[stack.api, stack.engine].map(layer => (
          <li className="stk-layer" key={layer.name}>
            <p className="viz-k">
              {layer.role}
              <span>{stack.same}</span>
            </p>
            <h3>{layer.name}</h3>
            <p>{layer.text}</p>
          </li>
        ))}
        <li className="stk-layer changed" role="status" aria-live="polite" aria-atomic="true">
          <p className="viz-k">
            {stack.placeRole}
            <span>{stack.changed}</span>
          </p>
          <h3>{place.name}</h3>
          <Html as="p" html={place.text} />
          <p className="stk-change">{place.change}</p>
        </li>
      </ol>
    </div>
  );
}

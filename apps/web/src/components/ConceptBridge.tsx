import type { Bridge } from '@content/types';
import { Html } from './Html';

/**
 * Most do tego, co uczeń już zna. Zawsze trzy części: co znasz, czemu to odpowiada tutaj
 * i gdzie analogia przestaje działać. Trzecia część jest obowiązkowa.
 */
export function ConceptBridge({ bridge, here = 'W Sparku' }: { bridge: Bridge; here?: string }) {
  return (
    <aside className="bridge" aria-label={`Analogia: ${bridge.from}`}>
      <p className="bridge-k">Most · {bridge.from}</p>
      <div className="bridge-cols">
        <div>
          <span>Znasz</span>
          <Html as="p" html={bridge.known} />
        </div>
        <div>
          <span>{here}</span>
          <Html as="p" html={bridge.fresh} />
        </div>
      </div>
      <div className="bridge-end">
        <span>Gdzie analogia się kończy</span>
        <Html as="p" html={bridge.breaks} />
      </div>
    </aside>
  );
}

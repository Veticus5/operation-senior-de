import type { Lab } from './types';
import registry from '../labs/registry.json';

/**
 * Laby, które da się uruchomić z interfejsu. Jedno źródło: labs/registry.json. Ten sam plik
 * jest allowlistą lokalnego runnera (apps/lab-runner), więc interfejs nie pokaże przycisku
 * dla skryptu, którego runner nie zna.
 */
export const labs: Lab[] = registry.labs;
export const labById = (id: string): Lab | undefined => labs.find(l => l.id === id);

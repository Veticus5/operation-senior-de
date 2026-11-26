import type { OptimizedPlan } from '@content/spark/lazy-evaluation/lesson';

export interface LazySimElements {
  scene: HTMLElement;
  sayEl: HTMLElement;
  factsEl: HTMLElement;
  dock: HTMLElement;
  ticks: HTMLElement;
  missionEl: HTMLElement;
}
export function createLazySim(els: LazySimElements, plans: Record<string, OptimizedPlan>): { destroy(): void };

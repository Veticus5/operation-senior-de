import { useSyncExternalStore } from 'react';
import { createProgressStore, type KeyValueStorage } from './progress';

function safeStorage(): KeyValueStorage | null {
  try {
    const s = window.localStorage;
    s.getItem('osde-probe');
    return s;
  } catch {
    return null;
  }
}

export const progress = createProgressStore(typeof window === 'undefined' ? null : safeStorage());

/** Hook: komponent odświeża się po każdej zmianie postępu. */
export function useProgress() {
  useSyncExternalStore(progress.subscribe, progress.getState);
  return progress;
}

import { useSyncExternalStore } from 'react';

/** Minimalny router po hashu (#/academy/...). Bez zależności, działa też z file:// i na GitHub Pages. */
const read = () => window.location.hash.replace(/^#\/?/, '');
const subscribe = (cb: () => void) => {
  window.addEventListener('hashchange', cb);
  return () => window.removeEventListener('hashchange', cb);
};

export const useRoute = (): string[] => useSyncExternalStore(subscribe, read).split('/').filter(Boolean);
export const href = (...parts: string[]): string => '#/' + parts.join('/');
export const navigate = (...parts: string[]): void => {
  window.location.hash = '/' + parts.join('/');
  window.scrollTo(0, 0);
};

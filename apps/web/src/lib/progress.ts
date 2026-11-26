/** Postęp nauki zapisywany lokalnie. Bez backendu: jedna przeglądarka, jeden klucz w localStorage. */

export type Mastery = 'new' | 'learning' | 'review' | 'mastered';
export const MASTERY: { id: Mastery; label: string }[] = [
  { id: 'new', label: 'Nowe' },
  { id: 'learning', label: 'Uczę się' },
  { id: 'review', label: 'Do powtórki' },
  { id: 'mastered', label: 'Opanowane' }
];

export interface ProgressState {
  v: 1;
  questions: Record<string, Mastery>;
  lessons: Record<string, { completed: boolean }>;
}
export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const empty = (): ProgressState => ({ v: 1, questions: {}, lessons: {} });

export function createProgressStore(storage: KeyValueStorage | null, key = 'osde-progress-v1') {
  const load = (): ProgressState => {
    try {
      const raw = storage?.getItem(key);
      if (!raw) return empty();
      const parsed = JSON.parse(raw) as Partial<ProgressState>;
      return parsed.v === 1 ? { ...empty(), ...parsed } : empty();
    } catch {
      return empty();
    }
  };
  let state = load();
  const listeners = new Set<() => void>();
  const commit = (next: ProgressState) => {
    state = next;
    try {
      storage?.setItem(key, JSON.stringify(state));
    } catch {
      /* brak miejsca albo zablokowany storage: postęp zostaje w pamięci do zamknięcia karty */
    }
    listeners.forEach(l => l());
  };
  return {
    getState: () => state,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
    mastery: (questionId: string): Mastery => state.questions[questionId] ?? 'new',
    setMastery(questionId: string, mastery: Mastery) {
      commit({ ...state, questions: { ...state.questions, [questionId]: mastery } });
    },
    lessonCompleted: (lessonId: string): boolean => state.lessons[lessonId]?.completed ?? false,
    setLessonCompleted(lessonId: string, completed: boolean) {
      commit({ ...state, lessons: { ...state.lessons, [lessonId]: { completed } } });
    }
  };
}
export type ProgressStore = ReturnType<typeof createProgressStore>;

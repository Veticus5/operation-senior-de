import { describe, expect, it } from 'vitest';
import { createProgressStore, type KeyValueStorage } from './progress';

const memory = (): KeyValueStorage & { data: Record<string, string> } => {
  const data: Record<string, string> = {};
  return { data, getItem: k => data[k] ?? null, setItem: (k, v) => void (data[k] = v) };
};

describe('progress store', () => {
  it('domyślnie każde pytanie jest nowe, a lekcja nieukończona', () => {
    const store = createProgressStore(memory());
    expect(store.mastery('x')).toBe('new');
    expect(store.lessonCompleted('l')).toBe(false);
  });
  it('zapisuje i odczytuje postęp między sesjami', () => {
    const storage = memory();
    const a = createProgressStore(storage);
    a.setMastery('q1', 'mastered');
    a.setLessonCompleted('l1', true);
    const b = createProgressStore(storage);
    expect(b.mastery('q1')).toBe('mastered');
    expect(b.lessonCompleted('l1')).toBe(true);
  });
  it('powiadamia subskrybentów', () => {
    const store = createProgressStore(memory());
    let calls = 0;
    const off = store.subscribe(() => calls++);
    store.setMastery('q1', 'review');
    off();
    store.setMastery('q1', 'learning');
    expect(calls).toBe(1);
  });
  it('działa bez storage i z uszkodzonym zapisem', () => {
    expect(createProgressStore(null).mastery('q')).toBe('new');
    const storage = memory();
    storage.data['osde-progress-v1'] = '{nie json';
    expect(createProgressStore(storage).mastery('q')).toBe('new');
  });
});

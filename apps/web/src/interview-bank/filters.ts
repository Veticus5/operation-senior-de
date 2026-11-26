import type { Area, Priority, Question } from '@content/index';
import type { Mastery } from '../lib/progress';

export interface Filters {
  query: string;
  areas: Area[];
  priorities: Priority[];
  mastery: Mastery | 'all';
}
export const NO_FILTERS: Filters = { query: '', areas: [], priorities: [], mastery: 'all' };

/** Filtrowanie i wyszukiwanie pytań. Czysta funkcja, testowana w filters.test.ts. */
export function filterQuestions(all: Question[], f: Filters, masteryOf: (id: string) => Mastery): Question[] {
  const words = f.query.toLowerCase().split(/\s+/).filter(Boolean);
  return all.filter(q => {
    if (f.areas.length && !f.areas.includes(q.area)) return false;
    if (f.priorities.length && !f.priorities.includes(q.priority)) return false;
    if (f.mastery !== 'all' && masteryOf(q.id) !== f.mastery) return false;
    if (!words.length) return true;
    const hay = [q.title, q.question.pl, q.question.en, q.keywords.join(' '), q.followUps.map(x => x.q).join(' ')].join(' ').toLowerCase();
    return words.every(w => hay.includes(w));
  });
}

import { describe, expect, it } from 'vitest';
import { questions } from '@content/index';
import { filterQuestions, NO_FILTERS } from './filters';

const fresh = () => 'new' as const;

describe('filterQuestions', () => {
  it('bez filtrów zwraca wszystko', () => {
    expect(filterQuestions(questions, NO_FILTERS, fresh)).toHaveLength(questions.length);
  });
  it('szuka po słowach kluczowych i follow-upach', () => {
    const hit = filterQuestions(questions, { ...NO_FILTERS, query: 'salting' }, fresh).map(q => q.id);
    expect(hit).toContain('spark-salting');
    expect(filterQuestions(questions, { ...NO_FILTERS, query: 'zzzz-nie-ma' }, fresh)).toHaveLength(0);
  });
  it('łączy obszar, priorytet i status', () => {
    const delta = filterQuestions(questions, { ...NO_FILTERS, areas: ['delta-lake'], priorities: ['P0'] }, fresh);
    expect(delta.length).toBeGreaterThan(0);
    expect(delta.every(q => q.area === 'delta-lake' && q.priority === 'P0')).toBe(true);
    const mastered = filterQuestions(questions, { ...NO_FILTERS, mastery: 'mastered' }, id => (id === 'spark-aqe' ? 'mastered' : 'new'));
    expect(mastered.map(q => q.id)).toEqual(['spark-aqe']);
  });
});

import { describe, expect, it } from 'vitest';
import { lessons, questions } from '@content/index';
import { experiments, beats, plans, tasks } from '@content/spark/lazy-evaluation/lesson';

describe('baza pytań', () => {
  it('ma unikalne identyfikatory', () => {
    const ids = questions.map(q => q.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
  it('każde pytanie jest kompletne w obu językach', () => {
    for (const q of questions) {
      for (const text of [q.question.pl, q.question.en, q.answer.pl, q.answer.en]) expect(text.length, q.id).toBeGreaterThan(20);
      expect(q.keywords.length, q.id).toBeGreaterThan(0);
      expect(q.followUps.length, q.id).toBeGreaterThanOrEqual(3);
      expect(q.mistakes.length, q.id).toBeGreaterThanOrEqual(2);
      expect(q.topicId, q.id).toMatch(/^[a-z]+\.[a-z-]+$/);
    }
  });
  it('odpowiedź mieści się w 30–60 sekundach mówienia (ok. 55–140 słów)', () => {
    for (const q of questions) for (const text of [q.answer.pl, q.answer.en]) {
      const words = text.split(/\s+/).length;
      expect(words, q.id).toBeGreaterThanOrEqual(55);
      expect(words, q.id).toBeLessThanOrEqual(140);
    }
  });
});

describe('lekcje', () => {
  it('mają unikalne id i topicId', () => {
    expect(new Set(lessons.map(l => l.id)).size).toBe(lessons.length);
    expect(new Set(lessons.map(l => l.topicId)).size).toBe(lessons.length);
  });
  it('każda lekcja ma co najmniej jedno powiązane pytanie', () => {
    for (const l of lessons) expect(questions.some(q => q.topicId === l.topicId), l.id).toBe(true);
  });
  it('lazy evaluation: treść jest kompletna', () => {
    expect(beats.length).toBe(5);
    expect(experiments.length).toBe(5);
    for (const e of experiments) expect(e.correct).toBeLessThan(e.choices.length);
    expect(tasks.clickLine.lines.length).toBe(tasks.clickLine.why.length);
    expect(tasks.findCause.lines.length).toBe(tasks.findCause.why.length);
  });
  it('symulator ma plan dla każdej kombinacji operacji i akcji', () => {
    const seqs = ['', 'f', 's', 'g', 'f>s', 's>f', 'f>g', 's>g', 'f>s>g', 's>f>g'];
    for (const s of seqs) for (const a of ['show', 'count']) expect(plans[`${s}|${a}`], `${s}|${a}`).toBeDefined();
  });
});

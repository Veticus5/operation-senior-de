import type { LessonMeta, Question } from './types';
import { sparkQuestions } from './spark/questions';
import { deltaQuestions } from './delta-lake/questions';
import { databricksQuestions } from './databricks/questions';
import { meta as fundamentals } from './spark/fundamentals/lesson';
import { meta as lazyEvaluation } from './spark/lazy-evaluation/lesson';

export * from './types';

/** Rejestr treści. Nowe pytania dopisujesz do pliku obszaru, nową lekcję rejestrujesz tutaj. Kolejność listy to kolejność nauki. */
export const questions: Question[] = [...sparkQuestions, ...deltaQuestions, ...databricksQuestions];
export const lessons: LessonMeta[] = [fundamentals, lazyEvaluation];

export const lessonByTopic = (topicId: string): LessonMeta | undefined => lessons.find(l => l.topicId === topicId);
export const questionsByTopic = (topicId: string): Question[] => questions.filter(q => q.topicId === topicId);

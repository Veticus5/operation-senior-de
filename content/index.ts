import type { LessonMeta, Question } from './types';
import { sparkQuestions } from './spark/questions';
import { deltaQuestions } from './delta-lake/questions';
import { databricksQuestions } from './databricks/questions';
import { platformQuestions } from './platform/questions';
import { meta as fundamentals } from './spark/fundamentals/lesson';
import { meta as lazyEvaluation } from './spark/lazy-evaluation/lesson';
import { meta as executionArchitecture } from './spark/execution-architecture/lesson';
import { meta as partitioningShuffle } from './spark/partitioning-shuffle/lesson';
import { meta as joinStrategies } from './spark/join-strategies/lesson';
import { meta as dataSkewAqe } from './spark/data-skew-aqe/lesson';
import { meta as platformDesign } from './platform/production-platform-design/lesson';

export * from './types';
export * from './labs';

/** Rejestr treści. Nowe pytania dopisujesz do pliku obszaru, nową lekcję rejestrujesz tutaj. Kolejność listy to kolejność nauki. */
export const questions: Question[] = [...sparkQuestions, ...deltaQuestions, ...databricksQuestions, ...platformQuestions];
export const lessons: LessonMeta[] = [fundamentals, lazyEvaluation, executionArchitecture, partitioningShuffle, joinStrategies, dataSkewAqe, platformDesign];

export const lessonByTopic = (topicId: string): LessonMeta | undefined => lessons.find(l => l.topicId === topicId);
export const questionsByTopic = (topicId: string): Question[] => questions.filter(q => q.topicId === topicId);

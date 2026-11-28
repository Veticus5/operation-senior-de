import type { KbChapter } from './types';
import { databaseArchitecture } from './database-architecture';
import { advancedDataModeling } from './advanced-data-modeling';
import { snowflakeArchitecturePerformance } from './snowflake-architecture-performance';

export * from './types';

/**
 * Rejestr rozdziałów Knowledge Base. Kolejność listy to kolejność w spisie i numeracja rozdziałów.
 * Nowy rozdział: plik obok, wpis tutaj i `npm run kb:pdf`, żeby powstał jego PDF.
 */
export const chapters: KbChapter[] = [databaseArchitecture, advancedDataModeling, snowflakeArchitecturePerformance];

export const chapterById = (id: string): KbChapter | undefined => chapters.find(c => c.id === id);

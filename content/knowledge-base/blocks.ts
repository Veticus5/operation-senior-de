import type { KbBlock, KbFigure, KbMiniTable } from './types';

/** Krótkie konstruktory bloków, żeby plik rozdziału czytało się jak tekst, a nie jak JSON. */
export const p = (html: string): KbBlock => ({ type: 'p', html });
export const h3 = (text: string): KbBlock => ({ type: 'h3', text });
export const list = (...items: string[]): KbBlock => ({ type: 'list', items });
export const steps = (...items: string[]): KbBlock => ({ type: 'list', items, ordered: true });
export const sql = (code: string, title?: string): KbBlock => ({ type: 'code', lang: 'sql', code, title });
export const yaml = (code: string, title?: string): KbBlock => ({ type: 'code', lang: 'yaml', code, title });
export const plan = (code: string, title?: string): KbBlock => ({ type: 'code', lang: 'plan', code, title });
export const table = (columns: string[], rows: string[][], caption?: string): KbBlock => ({ type: 'table', columns, rows, caption });
export const tables = (caption: string, ...items: KbMiniTable[]): KbBlock => ({ type: 'tables', tables: items, caption });
export const figure = (caption: string, fig: KbFigure): KbBlock => ({ type: 'figure', figure: fig, caption });
export const known = (title: string, ...html: string[]): KbBlock => ({ type: 'callout', tone: 'known', title, html });
export const warn = (title: string, ...html: string[]): KbBlock => ({ type: 'callout', tone: 'warn', title, html });
export const deeper = (title: string, ...html: string[]): KbBlock => ({ type: 'callout', tone: 'deeper', title, html });

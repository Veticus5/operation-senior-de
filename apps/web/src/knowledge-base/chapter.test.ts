import { describe, expect, it } from 'vitest';
import { lessons } from '@content/index';
import { glossary } from '@content/glossary';
import { chapters, chapterById, type KbBlock, type KbFigure } from '@content/knowledge-base/index';
import facts from '../../../../docs/verified-facts.md?raw';
import { parseRich, termIds } from '../lib/richText';
import * as modeling from '@content/data-modeling/dimensional-modeling/lesson';
import { countryReport, fanoutResult, fanoutRows, matchVersions, mrrByMonth, refundRates, rlsView, semanticCount, threeNumbers, totalRevenue } from '../academy/data-modeling/model';
import { END, cellCounts, chapterRich, contentHash, outline, pdfPath, readingMinutes, scannedParts, wordCount } from './outline';
import { renderPrintDocument } from './print';
import manifest from './pdf-manifest.json';

const pdfFiles = Object.keys(import.meta.glob('../../public/kb/*.pdf', { query: '?url' }));
const pdfs: Record<string, { contentHash: string; pages: number; bytes: number } | undefined> = manifest;
const blocks = (id: string): KbBlock[] => chapterById(id)!.sections.flatMap(s => s.blocks);
const figures = (id: string): KbFigure[] => blocks(id).flatMap(b => (b.type === 'figure' ? [b.figure] : []));
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
/** Najdłuższa linia kodu, która mieści się bez zawijania na stronie PDF i na ekranie 390 px. */
const CODE_WIDTH = 44;

describe('Knowledge Base: rejestr rozdziałów', () => {
  it('ma unikalne identyfikatory, które nadają się na adres i nazwę pliku', () => {
    const ids = chapters.map(c => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(SLUG);
  });
  it('nie zmienił identyfikatorów, bo są częścią adresów i nazw plików PDF', () => {
    expect(chapters.map(c => c.id)).toEqual(['database-architecture', 'advanced-data-modeling']);
    expect(chapterById('database-architecture')!.sections.map(s => s.id)).toEqual([
      'oltp-olap', 'wiersze-kolumny', 'projekt-logiczny-fizyczny', 'normalizacja', 'denormalizacja', 'klucze', 'indeksy',
      'pruning', 'plan-wykonania', 'transakcje', 'warehouse-lake-lakehouse', 'etl-elt', 'storage-compute', 'dobor-architektury'
    ]);
    expect(chapterById('advanced-data-modeling')!.sections.map(s => s.id)).toEqual([
      'fakty-i-wymiary', 'ziarno', 'fan-out', 'rodzaje-faktow-i-addytywnosc', 'klucze-zastepcze', 'nietypowe-fakty-i-wymiary', 'ksztalt-modelu',
      'scd', 'punkt-w-czasie', 'spoznione-dane', 'warstwa-semantyczna', 'kardynalnosc', 'rls', 'pre-agregacje', 'power-bi-looker', 'gdzie-logika',
      'metodyki', 'projektowanie'
    ]);
  });
});

describe.each(chapters)('Knowledge Base: rozdział $id', chapter => {
  it('ma komplet części: wstęp, treść, podsumowanie, słownik, błędne przekonania i źródła', () => {
    expect(chapter.lead.length).toBeGreaterThan(0);
    expect(chapter.sections.length).toBeGreaterThan(0);
    expect(chapter.keyPoints.length).toBeGreaterThanOrEqual(5);
    expect(chapter.glossary.length).toBeGreaterThanOrEqual(10);
    expect(chapter.misconceptions.length).toBeGreaterThanOrEqual(5);
    expect(chapter.sources.length).toBeGreaterThan(0);
    expect(chapter.checked).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(readingMinutes(chapter)).toBeGreaterThan(0);
    for (const section of chapter.sections) expect(section.blocks.length, section.id).toBeGreaterThan(0);
  });
  it('wskazuje na istniejącą lekcję, jeśli ją podaje', () => {
    if (chapter.lessonId) expect(lessons.some(l => l.id === chapter.lessonId)).toBe(true);
  });
  it('ma unikalne identyfikatory części, różne od sekcji zamykających', () => {
    const ids = outline(chapter).map(e => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(SLUG);
    expect(outline(chapter).slice(-4).map(e => e.id)).toEqual([END.keyPoints.id, END.glossary.id, END.misconceptions.id, END.sources.id]);
  });
  it('każdy fragment HTML się parsuje, a użyte hasła słownika platformy istnieją', () => {
    for (const html of chapterRich(chapter)) {
      expect(() => parseRich(html), html.slice(0, 60)).not.toThrow();
      for (const id of termIds(html)) expect(glossary[id], id).toBeDefined();
    }
  });
  it('tabele mają tyle komórek w wierszu, ile kolumn', () => {
    for (const block of chapter.sections.flatMap(s => s.blocks)) {
      if (block.type === 'table') for (const row of block.rows) expect(row.length, block.columns.join('|')).toBe(block.columns.length);
      if (block.type === 'tables') {
        for (const t of block.tables) {
          for (const key of t.key) expect(t.columns, t.name).toContain(key);
          for (const row of t.rows) expect(row.length, t.name).toBe(t.columns.length);
        }
      }
    }
  });
  it(`kod SQL i YAML mieści się w ${CODE_WIDTH} znakach na linię`, () => {
    for (const block of chapter.sections.flatMap(s => s.blocks)) {
      if (block.type !== 'code' || block.lang === 'plan') continue;
      for (const line of block.code.split('\n')) expect(line.length, line).toBeLessThanOrEqual(CODE_WIDTH);
    }
  });
  it('ilustracje mają spójne dane', () => {
    for (const block of chapter.sections.flatMap(s => s.blocks)) {
      if (block.type !== 'figure') continue;
      const f = block.figure;
      expect(block.caption, 'ilustracja jest podpisana jako ilustracja').toMatch(/^Ilustracja\./);
      if (f.kind === 'cells') {
        for (const row of f.rows) expect(row.length).toBe(f.columns.length);
        for (const c of f.need) expect(c).toBeLessThan(f.columns.length);
      }
      if (f.kind === 'path') for (const step of f.steps) expect(step.options[step.pick], step.name).toBeDefined();
      if (f.kind === 'partitions') {
        for (const layout of f.layouts) for (const [min, max] of layout.parts) expect(min >= 1 && min <= max && max <= f.units.length, layout.label).toBe(true);
      }
    }
  });
  it('słownik rozdziału jest alfabetyczny i bez powtórzeń', () => {
    const terms = chapter.glossary.map(g => g.term);
    expect(new Set(terms).size).toBe(terms.length);
    expect(terms).toEqual([...terms].sort((a, b) => a.localeCompare(b, 'pl')));
  });
  it('każde źródło jest spisane w docs/verified-facts.md', () => {
    const urls = chapter.sources.map(s => s.url);
    expect(new Set(urls).size).toBe(urls.length);
    for (const url of urls) {
      expect(url).toMatch(/^https:\/\//);
      expect(facts.includes(url), url).toBe(true);
    }
  });
  it('ma aktualny PDF: plik istnieje, a skrót treści w manifeście zgadza się z bieżącą treścią', () => {
    // Nie zgadza się? Treść zmieniła się po wygenerowaniu PDF. Uruchom: npm run kb:pdf
    expect(pdfFiles.some(f => f.endsWith(`/public/${pdfPath(chapter.id)}`)), pdfPath(chapter.id)).toBe(true);
    expect(pdfs[chapter.id]?.contentHash, 'uruchom npm run kb:pdf').toBe(contentHash(chapter));
    expect(pdfs[chapter.id]!.pages).toBeGreaterThan(1);
  });
  it('dokument do PDF zawiera każdą część dokładnie raz i każdy link ze spisu treści ma cel', () => {
    const html = renderPrintDocument([chapter], { css: '', fontCss: '' });
    for (const entry of outline(chapter)) {
      expect(html.split(`id="${entry.id}"`).length - 1, entry.id).toBe(1);
      expect(html.includes(`href="#${entry.id}"`), entry.id).toBe(true);
    }
    expect(html).toContain('<html lang="pl">');
  });
});

describe('Knowledge Base: skrót treści i podręcznik z wielu rozdziałów', () => {
  it('skrót zmienia się razem z treścią', () => {
    const chapter = chapters[0];
    expect(contentHash(chapter)).toBe(contentHash({ ...chapter }));
    expect(contentHash({ ...chapter, subtitle: `${chapter.subtitle}.` })).not.toBe(contentHash(chapter));
    expect(contentHash({ ...chapter, lead: [...chapter.lead].reverse() })).not.toBe(contentHash(chapter));
  });
  it('kilka rozdziałów w jednym dokumencie nie daje powtórzonych kotwic', () => {
    const second = { ...chapters[0], id: 'drugi-rozdzial' };
    const html = renderPrintDocument([chapters[0], second], { css: '', fontCss: '', title: 'Podręcznik' });
    const ids = [...html.matchAll(/ id="([^"]+)"/g)].map(m => m[1]);
    expect(ids.length).toBe(2 * outline(chapters[0]).length);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(html.includes(`href="#${id}"`), id).toBe(true);
  });
});

describe('Knowledge Base: liczby w tekście rozdziału Database & Data Architecture wynikają z danych ilustracji', () => {
  const id = 'database-architecture';
  it('zapis wierszowy czyta 30 wartości, żeby użyć 12, a kolumnowy czyta 12', () => {
    const f = figures(id).find(x => x.kind === 'cells')!;
    if (f.kind !== 'cells') throw new Error('brak ilustracji zapisu');
    expect(cellCounts(f.rows.length, f.columns.length, f.need, 'row')).toEqual({ read: 30, needed: 12, total: 30 });
    expect(cellCounts(f.rows.length, f.columns.length, f.need, 'column')).toEqual({ read: 12, needed: 12, total: 30 });
  });
  it('filtr po marcu czyta 1 z 8 mikropartycji przy danych ułożonych po dacie i 7 z 8 przy wymieszanych', () => {
    const f = figures(id).find(x => x.kind === 'partitions')!;
    if (f.kind !== 'partitions') throw new Error('brak ilustracji mikropartycji');
    expect(f.layouts.map(l => scannedParts(l.parts, f.filter.range).filter(Boolean).length)).toEqual([1, 7]);
    expect(f.layouts.every(l => l.parts.length === 8)).toBe(true);
  });
  it('droga przez indeks ma trzy poziomy drzewa i jedną stronę tabeli', () => {
    const f = figures(id).find(x => x.kind === 'path')!;
    if (f.kind !== 'path') throw new Error('brak ilustracji indeksu');
    expect(f.steps.length).toBe(4);
    expect(f.total).toContain('4 zamiast 10 000');
  });
  it('tabela denormalizacji i tabela izolacji zgadzają się z tekstem', () => {
    const tables = blocks(id).flatMap(b => (b.type === 'table' ? [b] : []));
    expect(tables.find(t => t.columns[1] === 'Znormalizowany (3NF)')!.rows.map(r => r.slice(1))).toEqual([['2', '0'], ['2', '4'], ['1', '3']]);
    expect(tables.find(t => t.columns[0] === 'Poziom izolacji')!.rows).toEqual([
      ['Read uncommitted', 'możliwy', 'możliwy', 'możliwy'],
      ['Read committed', 'wykluczony', 'możliwy', 'możliwy'],
      ['Repeatable read', 'wykluczony', 'wykluczony', 'możliwy'],
      ['Serializable', 'wykluczony', 'wykluczony', 'wykluczony']
    ]);
  });
});

describe('Knowledge Base: liczby w tekście rozdziału Advanced Data Modeling wynikają z danych lekcji', () => {
  const id = 'advanced-data-modeling';
  const chapter = chapterById(id)!;
  const section = (sectionId: string) => chapter.sections.find(s => s.id === sectionId)!.blocks;
  const text = (sectionId: string) => section(sectionId).flatMap(b => (b.type === 'p' ? [b.html] : b.type === 'list' ? b.items : b.type === 'callout' ? b.html : [])).join(' ');
  const tableBy = (sectionId: string, column: string) => {
    const found = section(sectionId).find(b => b.type === 'table' && b.columns.includes(column));
    if (found?.type !== 'table') throw new Error(`brak tabeli z kolumną ${column}`);
    return found.rows.map(r => r.map(c => c.replace(/<\/?b>/g, '')));
  };
  const minis = (sectionId: string) => section(sectionId).flatMap(b => (b.type === 'tables' ? b.tables : []));
  const code = (sectionId: string) => section(sectionId).flatMap(b => (b.type === 'code' ? [b] : []));
  /** Zapytanie bez komentarzy i z pojedynczymi odstępami: rozdział łamie linie inaczej niż lekcja. */
  const flat = (q: string) => q.replace(/--.*$/gm, '').replace(/\s+/g, ' ').trim();
  const report = (mode: 'pit' | 'current' | 'natural') => Object.fromEntries(countryReport(mode).rows.map(r => [r.country, String(r.revenue)]));

  it('trzy liczby z pierwszej części to wpłaty lutego, MRR i MRR po błędnym złączeniu', () => {
    expect(threeNumbers()).toEqual({ cash: 28, mrr: 36, fanned: 56 });
    expect(text('fakty-i-wymiary')).toContain('<b>28</b>, <b>36</b> i <b>56 EUR</b>');
    const [subscriptions, transactions] = minis('fakty-i-wymiary');
    expect(subscriptions.rows.length).toBe(4);
    expect(transactions.rows.length).toBe(10);
    // Wiersz T-4 rozpisany po kluczach wskazuje istniejące wiersze wymiarów.
    expect(tableBy('fakty-i-wymiary', 'Kolumna faktu').map(r => r[2])).toEqual(['20260201: 2026-02-01, weekend', '2: Ben, DE', '3: Kino Monthly', '2: Kino Nord', 'T-4', '8.00']);
  });
  it('ziarno: żadne z czterech ziaren nie odpowiada na wszystkie trzy pytania', () => {
    const rows = tableBy('ziarno', 'Jeden wiersz to');
    expect(rows.length).toBe(4);
    for (const row of rows) expect(row.slice(1).every(c => c === 'tak'), row[0]).toBe(false);
    for (const q of [1, 2, 3]) expect(rows.some(r => r[q] === 'tak')).toBe(true);
  });
  it('fan-out: 4 subskrypcje stają się 6 wierszami, MRR wychodzi 56 zamiast 36, a przychód się zgadza', () => {
    expect(tableBy('fan-out', 'Transakcja').length).toBe(fanoutRows('wrong').length);
    const [wrong, right] = [fanoutResult('wrong'), fanoutResult('right')];
    expect(tableBy('fan-out', 'Przychód')).toEqual([
      ...wrong.byPublisher.map((w, i) => [w.publisher, String(w.mrr), String(right.byPublisher[i].mrr), String(w.revenue)]),
      ['Razem', '56', '36', '144']
    ]);
    expect([wrong.mrr, right.mrr, right.revenue, right.rows]).toEqual([56, 36, 144, 4]);
    const lanes = figures(id).find(f => f.kind === 'lanes')!;
    if (lanes.kind !== 'lanes') throw new Error('brak ilustracji fan-outu');
    expect(lanes.lanes.map(l => l.steps.map(s => s.where))).toEqual([['4 wiersze', '6 wierszy', 'zamiast 36'], ['6 wierszy', '4 wiersze', '4 wiersze']]);
    for (const lane of lanes.lanes) expect(lane.steps.length).toBe(3);
  });
  it('zapytania SQL to te same zapytania co w lekcji, tylko inaczej połamane', () => {
    const [wrong, right] = code('fan-out');
    expect(flat(wrong.code)).toBe(flat(modeling.fanout.sql.wrong));
    expect(flat(right.code)).toBe(flat(modeling.fanout.sql.right));
    const pit = code('punkt-w-czasie');
    expect(pit.slice(0, 3).map(c => c.code)).toEqual([modeling.pit.sql.natural, modeling.pit.sql.current, modeling.pit.sql.pit]);
    expect(flat(pit[3].code)).toBe(flat(modeling.pit.asofCode));
  });
  it('rodzaje tabel faktów: 5, 6 i 2 wiersze na koniec kwietnia, a zmienia się tylko narastająca migawka', () => {
    expect(minis('rodzaje-faktow-i-addytywnosc').map(t => t.rows.length)).toEqual([5, 6, 2]);
    expect(minis('rodzaje-faktow-i-addytywnosc')[2].rows[0]).toContain('03-18');
    expect(tableBy('rodzaje-faktow-i-addytywnosc', 'Miesiąc')).toEqual([
      ['styczeń', '2 nowe wiersze', '2 nowe wiersze', '2 nowe wiersze'],
      ['luty', '1 nowy wiersz', '2 nowe wiersze', 'bez zmian'],
      ['marzec', '2 nowe wiersze', '1 nowy wiersz', 'zmiana w istniejącym wierszu'],
      ['kwiecień', 'nic nie przybywa', '1 nowy wiersz', 'bez zmian']
    ]);
  });
  it('addytywność: 162, 90 oraz 5,6% wobec 11,1%', () => {
    expect(totalRevenue()).toBe(162);
    expect(mrrByMonth().map(m => m.mrr)).toEqual([28, 36, 26]);
    expect(mrrByMonth().reduce((n, m) => n + m.mrr, 0) / 3).toBe(30);
    expect(+(refundRates().overall * 100).toFixed(1)).toBe(11.1);
    expect(+(refundRates().averageOfRates * 100).toFixed(1)).toBe(5.6);
    const sums = section('rodzaje-faktow-i-addytywnosc').flatMap(b => (b.type === 'table' && b.columns.length === 2 ? [b.rows[b.rows.length - 1][1]] : []));
    expect(sums).toEqual(['<b>162</b>', '<b>90</b> (wynik bez sensu)', '<b>5,6%</b> (wynik bez sensu)']);
    for (const n of ['162 EUR', '90 EUR', '(26)', '(30)', '5,6%', '11,1%']) expect(text('rodzaje-faktow-i-addytywnosc')).toContain(n);
  });
  it('tabela pomostowa: bez wag 308, z wagami 162', () => {
    const revenue = (key: number) => modeling.data.transactions.filter(t => modeling.data.products.find(x => x.id === modeling.data.subscriptions.find(s => s.id === t.sub)!.product)!.key === key).reduce((n, t) => n + t.amount, 0);
    const bridge = minis('nietypowe-fakty-i-wymiary').find(t => t.name === 'bridge_product_category')!;
    const total = (weighted: boolean) => bridge.rows.reduce((n, [key, , weight]) => n + revenue(+key) * (weighted ? +weight : 1), 0);
    expect([total(false), total(true)]).toEqual([308, 162]);
    expect(tableBy('nietypowe-fakty-i-wymiary', 'Kategoria').at(-1)).toEqual(['Razem', '308', '162']);
  });
  it('SCD i złączenie punkt-w-czasie: raporty per kraj zgadzają się z modelem lekcji', () => {
    const [current, pit, natural] = [report('current'), report('pit'), report('natural')];
    expect(tableBy('scd', 'Kraj')).toEqual([['DE', 'brak', pit.DE], ['FR', current.FR, pit.FR], ['PL', current.PL, pit.PL], ['Razem', '162', '162']]);
    expect(tableBy('scd', 'Kraj')).toEqual([['DE', 'brak', '18'], ['FR', '96', '96'], ['PL', '66', '48'], ['Razem', '162', '162']]);
    expect(tableBy('punkt-w-czasie', 'Kraj')).toEqual([
      ['DE', natural.DE, 'brak', pit.DE],
      ['FR', natural.FR, current.FR, pit.FR],
      ['PL', natural.PL, current.PL, pit.PL],
      ['Razem', String(countryReport('natural').total), '162', '162']
    ]);
    expect(countryReport('natural').total).toBe(198);
    expect(text('punkt-w-czasie')).toContain('ze 162 do 198 EUR');
    // Wymiar typu 2 pokazuje wszystkie wersje, a typ 1 tylko bieżący kraj Bena.
    const [type1, type2] = minis('scd');
    expect(type1.rows.find(r => r[1] === 'C-102')![3]).toBe('PL');
    expect(type2.rows.filter(r => r[1] === 'C-102').map(r => r[2])).toEqual(['DE', 'PL']);
  });
  it('spóźniony fakt z 8 lutego dostaje klucz 2, a nie bieżący klucz 4', () => {
    const late = { id: 'T-11', date: '2026-02-08', sub: 'S-2', type: 'payment' as const, amount: 10 };
    expect(matchVersions(late, 'pit').map(v => v.key)).toEqual([2]);
    expect(matchVersions(late, 'current').map(v => v.key)).toEqual([4]);
    const path = figures(id).find(f => f.kind === 'path')!;
    if (path.kind !== 'path') throw new Error('brak ilustracji spóźnionego faktu');
    expect(path.steps[1].options[path.steps[1].pick]).toBe('klucz 2: DE, od 01-08 do 02-10');
    expect(path.steps[2].options).toEqual(['customer_key = 2']);
    expect(path.total).toContain('klucz 2 (DE), a nie bieżący klucz 4 (PL)');
  });
  it('warstwa semantyczna: trzy zespoły dostają 4, 5 i 8', () => {
    expect(tableBy('warstwa-semantyczna', 'Zespół').map(r => r[3])).toEqual(modeling.semantic.presets.map(x => String(semanticCount(modeling.semantic.subs, x).value)));
    expect(tableBy('warstwa-semantyczna', 'Zespół').map(r => r[3])).toEqual(['4', '5', '8']);
  });
  it('RLS: 8 z 10 transakcji i 146 EUR, 2 z 10 i 16 EUR, 10 z 10 i 162 EUR', () => {
    const views = modeling.rls.users.map(u => rlsView(u.publishers));
    expect(tableBy('rls', 'Kto patrzy').map(r => r.slice(2))).toEqual(views.map(v => [`${v.visible.length} z 10`, `${v.revenue} EUR`]));
    expect(views.map(v => v.revenue)).toEqual([146, 16, 162]);
  });
  it('projekt raportu rezygnacji: MRR 28, 36, 26 wynika z nowej S-3 i utraconej S-2', () => {
    const at = (month: string) => modeling.data.snapshot.filter(r => r.month === month);
    const diff = (from: string, to: string) => ({
      gained: at(to).filter(r => !at(from).some(x => x.sub === r.sub)).map(r => [r.sub, r.mrr]),
      lost: at(from).filter(r => !at(to).some(x => x.sub === r.sub)).map(r => [r.sub, r.mrr])
    });
    expect(diff('2026-01-31', '2026-02-28')).toEqual({ gained: [['S-3', 8]], lost: [] });
    expect(diff('2026-02-28', '2026-03-31')).toEqual({ gained: [], lost: [['S-2', 10]] });
    expect(text('projektowanie')).toContain('przybywa S-3 (8 EUR), więc MRR rośnie z 28 do 36. W marcu ubywa S-2 (10 EUR), więc spada do 26');
  });
  it('miejsce logiki w czterech przypadkach jest takie jak w lekcji', () => {
    const places = section('gdzie-logika').flatMap(b => (b.type === 'p' ? [b.html.match(/^<b>Miejsce: ([^.]+)\.<\/b>/)?.[1]] : [])).filter(Boolean);
    expect(places).toEqual(modeling.placement.cases.map(c => ['hurtownia', 'warstwa semantyczna', 'raport'][c.correct]));
  });
  it('treść główna rozdziału jest krótsza od lekcji', () => {
    const main = wordCount({ ...chapter, keyPoints: [], glossary: [], misconceptions: [] });
    const strings: string[] = [];
    const walk = (v: unknown): void => {
      if (typeof v === 'string') strings.push(v);
      else if (Array.isArray(v)) v.forEach(walk);
      else if (v && typeof v === 'object') Object.values(v).forEach(walk);
    };
    walk({ ...modeling });
    const lessonWords = strings.join(' ').replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length;
    expect(main).toBeLessThan(lessonWords);
  });
});

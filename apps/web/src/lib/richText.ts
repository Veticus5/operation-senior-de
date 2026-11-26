/**
 * Mały parser fragmentów HTML z /content. Zamienia tekst na drzewo, które komponent Html renderuje
 * jako zwykłe elementy React. Dzięki temu w treści działa znacznik <term id="...">, czyli hasło słownika,
 * a nieznany albo niedomknięty znacznik jest błędem wykrywanym w testach, a nie cichą usterką na stronie.
 *
 * To celowo wąski podzbiór HTML: znaczniki z listy poniżej, atrybuty w cudzysłowach, bez komentarzy i skryptów.
 */
export type RichNode = string | RichElement;
export interface RichElement {
  tag: string;
  attrs: Record<string, string>;
  children: RichNode[];
}

export const ALLOWED_TAGS = ['p', 'h1', 'h2', 'h3', 'b', 'i', 'em', 'code', 'pre', 'span', 'div', 'ul', 'li', 'br', 'term'];
const ALLOWED_ATTRS = ['class', 'style', 'id', 'lang'];
const VOID = new Set(['br']);
const ENTITIES: Record<string, string> = { lt: '<', gt: '>', amp: '&', quot: '"', nbsp: ' ', '#39': "'" };

const decode = (text: string): string => text.replace(/&(lt|gt|amp|quot|nbsp|#39);/g, (_, name: string) => ENTITIES[name]);

export function parseRich(html: string): RichNode[] {
  const root: RichElement = { tag: '#root', attrs: {}, children: [] };
  const stack: RichElement[] = [root];
  const top = () => stack[stack.length - 1];
  const tagPattern = /<(\/?)([a-zA-Z][a-zA-Z0-9]*)((?:\s+[a-zA-Z-]+="[^"]*")*)\s*(\/?)>/g;
  let last = 0;
  for (let m = tagPattern.exec(html); m; m = tagPattern.exec(html)) {
    if (m.index > last) top().children.push(decode(html.slice(last, m.index)));
    last = tagPattern.lastIndex;
    const [, closing, rawTag, rawAttrs, selfClosing] = m;
    const tag = rawTag.toLowerCase();
    if (!ALLOWED_TAGS.includes(tag)) throw new Error(`Niedozwolony znacznik <${tag}> w treści`);
    if (closing) {
      if (top().tag !== tag) throw new Error(`Zamknięcie </${tag}> nie pasuje do otwartego <${top().tag}>`);
      stack.pop();
      continue;
    }
    const attrs: Record<string, string> = {};
    for (const a of rawAttrs.matchAll(/([a-zA-Z-]+)="([^"]*)"/g)) {
      if (!ALLOWED_ATTRS.includes(a[1])) throw new Error(`Niedozwolony atrybut ${a[1]} w <${tag}>`);
      attrs[a[1]] = decode(a[2]);
    }
    const element: RichElement = { tag, attrs, children: [] };
    top().children.push(element);
    if (!selfClosing && !VOID.has(tag)) stack.push(element);
  }
  if (last < html.length) top().children.push(decode(html.slice(last)));
  if (stack.length > 1) throw new Error(`Niedomknięty znacznik <${top().tag}>`);
  return root.children;
}

/** Identyfikatory haseł słownika użyte w fragmencie. */
export function termIds(html: string): string[] {
  const out: string[] = [];
  const walk = (nodes: RichNode[]) => {
    for (const n of nodes) {
      if (typeof n === 'string') continue;
      if (n.tag === 'term') out.push(n.attrs.id ?? '');
      walk(n.children);
    }
  };
  walk(parseRich(html));
  return out;
}

/** Sam tekst, bez znaczników. Do liczenia słów i wyszukiwania. */
export function plainText(html: string): string {
  const walk = (nodes: RichNode[]): string => nodes.map(n => (typeof n === 'string' ? n : walk(n.children))).join('');
  return walk(parseRich(html));
}

/** "a:b;--c:d" -> obiekt stylu dla Reacta. Własności CSS (--x) zostają bez zmian. */
export function styleObject(style: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of style.split(';')) {
    const i = part.indexOf(':');
    if (i < 0) continue;
    const name = part.slice(0, i).trim();
    const value = part.slice(i + 1).trim();
    if (!name) continue;
    out[name.startsWith('--') ? name : name.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase())] = value;
  }
  return out;
}

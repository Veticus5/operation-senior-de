import { createElement, type CSSProperties, type ReactNode } from 'react';
import { parseRich, styleObject, type RichNode } from '../lib/richText';
import { TermTooltip } from './TermTooltip';

function render(nodes: RichNode[]): ReactNode[] {
  return nodes.map((node, i) => {
    if (typeof node === 'string') return node;
    const children = node.children.length ? render(node.children) : undefined;
    if (node.tag === 'term') return <TermTooltip key={i} id={node.attrs.id ?? ''}>{children}</TermTooltip>;
    const { class: className, style, ...rest } = node.attrs;
    return createElement(node.tag, { key: i, className, style: style ? (styleObject(style) as CSSProperties) : undefined, ...rest }, children);
  });
}

/**
 * Renderuje fragment treści z /content. Treść jest nasza (repozytorium), nie od użytkownika.
 * Obsługuje mały podzbiór HTML (patrz lib/richText.ts) oraz <term id="...">, czyli hasło słownika z dymkiem.
 */
export function Html({ html, as: Tag = 'div', className }: { html: string; as?: 'div' | 'p' | 'pre' | 'span'; className?: string }) {
  return <Tag className={className}>{render(parseRich(html))}</Tag>;
}

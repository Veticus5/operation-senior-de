/** Renderuje fragment HTML z /content. Treść jest nasza (repozytorium), nie od użytkownika. */
export function Html({ html, as: Tag = 'div', className }: { html: string; as?: 'div' | 'p' | 'pre' | 'span'; className?: string }) {
  return <Tag className={className} dangerouslySetInnerHTML={{ __html: html }} />;
}

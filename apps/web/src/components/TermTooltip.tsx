import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { glossary } from '@content/glossary';

const MARGIN = 16;
const MAX_WIDTH = 340;

/**
 * Hasło słownika z definicją w dymku. Do pojęć pobocznych i jako przypomnienie: pojęcia kluczowe
 * tłumacz w tekście przy pierwszym użyciu.
 *
 * Dostępność: hasło jest przyciskiem, więc dostaje fokus z klawiatury. Dymek otwiera fokus, najechanie
 * albo dotknięcie, a zamyka Escape, utrata fokusu, zjechanie kursorem albo dotknięcie obok.
 * Definicja jest w DOM cały czas (aria-describedby), więc czytnik ekranu odczyta ją także bez otwierania.
 * Dymek jest dosuwany do krawędzi okna, żeby na wąskim ekranie nie wymuszał poziomego przewijania.
 */
export function TermTooltip({ id, children }: { id: string; children?: ReactNode }) {
  const entry = glossary[id];
  const [open, setOpen] = useState(false);
  const [box, setBox] = useState({ left: 0, width: MAX_WIDTH });
  const wrap = useRef<HTMLSpanElement>(null);
  const tipId = useId();

  useEffect(() => {
    if (!open) return;
    const place = () => {
      const rect = wrap.current?.getBoundingClientRect();
      if (!rect) return;
      const viewport = document.documentElement.clientWidth;
      const width = Math.min(MAX_WIDTH, viewport - 2 * MARGIN);
      const left = Math.min(Math.max(rect.left, MARGIN), viewport - MARGIN - width);
      setBox({ left: left - rect.left, width });
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    const onPointer = (e: PointerEvent) => !wrap.current?.contains(e.target as Node) && setOpen(false);
    place();
    window.addEventListener('resize', place);
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPointer);
    return () => {
      window.removeEventListener('resize', place);
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPointer);
    };
  }, [open]);

  if (!entry) return <>{children}</>;
  return (
    <span className="term-wrap" ref={wrap} onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <button type="button" className="term" aria-describedby={tipId} onFocus={() => setOpen(true)} onBlur={() => setOpen(false)} onClick={() => setOpen(true)}>
        {children ?? entry.term}
      </button>
      <span role="tooltip" id={tipId} className="term-tip" hidden={!open} style={{ left: box.left, width: box.width }}>
        <b>{entry.term}</b>
        {entry.def}
      </span>
    </span>
  );
}

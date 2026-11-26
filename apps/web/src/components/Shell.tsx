import type { ReactNode } from 'react';
import { href } from '../lib/router';

export function Shell({ section, children }: { section: 'home' | 'academy' | 'bank'; children: ReactNode }) {
  return (
    <>
      <header className="top">
        <div className="top-in">
          <a className="logo" href={href()}>
            <b>operation</b>-senior-de
          </a>
          <nav className="top-links" aria-label="Części platformy">
            <a href={href('academy')} aria-current={section === 'academy' ? 'page' : undefined}>
              Learning Academy
            </a>
            <a href={href('bank')} aria-current={section === 'bank' ? 'page' : undefined}>
              Interview Bank
            </a>
          </nav>
        </div>
      </header>
      {children}
    </>
  );
}

import type { ReactNode } from 'react';
import { href } from '../lib/router';

/** Na wąskim ekranie trzy zakładki nie mieszczą się obok pełnej nazwy, więc części z klasą top-long znikają (app.css). */
export function Shell({ section, children }: { section: 'home' | 'academy' | 'bank' | 'kb'; children: ReactNode }) {
  return (
    <>
      <header className="top">
        <div className="top-in">
          <a className="logo" href={href()}>
            <b>operation</b>
            <span className="top-long">-senior-de</span>
          </a>
          <nav className="top-links" aria-label="Części platformy">
            <a href={href('academy')} aria-current={section === 'academy' ? 'page' : undefined}>
              <span className="top-long">Learning </span>Academy
            </a>
            <a href={href('bank')} aria-current={section === 'bank' ? 'page' : undefined}>
              <span className="top-long">Interview </span>Bank
            </a>
            <a href={href('kb')} aria-current={section === 'kb' ? 'page' : undefined}>
              Knowledge<span className="top-long"> Base</span>
            </a>
          </nav>
        </div>
      </header>
      {children}
    </>
  );
}

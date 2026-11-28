import type { KbBlock, KbChapter } from '@content/knowledge-base/index';
import { Html } from '../components/Html';
import { Figure } from './Figures';
import { END } from './outline';

/**
 * Treść rozdziału: części, a po nich podsumowanie, słownik, błędne przekonania i źródła.
 * Ten sam komponent renderuje stronę i dokument do PDF, dlatego nie ma tu stanu, efektów ani nawigacji.
 */

const COMMENT: Record<string, RegExp | undefined> = { sql: /(--.*)$/, yaml: /(#.*)$/ };

function Code({ block }: { block: Extract<KbBlock, { type: 'code' }> }) {
  const comment = COMMENT[block.lang];
  return (
    <figure className={`kb-code kb-code-${block.lang}`}>
      {block.title && <figcaption>{block.title}</figcaption>}
      <pre>
        <code>
          {block.code.split('\n').map((line, i) => {
            const parts = comment ? line.split(comment) : [line];
            return (
              <span key={i} className="kb-line">
                {parts[0]}
                {parts[1] && <span className="kb-comment">{parts[1]}</span>}
                {'\n'}
              </span>
            );
          })}
        </code>
      </pre>
    </figure>
  );
}

function Block({ block }: { block: KbBlock }) {
  switch (block.type) {
    case 'p':
      return <Html as="p" html={block.html} />;
    case 'h3':
      return <h3>{block.text}</h3>;
    case 'list': {
      const List = block.ordered ? 'ol' : 'ul';
      return (
        <List className="kb-list">
          {block.items.map((item, i) => (
            <li key={i}>
              <Html as="span" html={item} />
            </li>
          ))}
        </List>
      );
    }
    case 'code':
      return <Code block={block} />;
    case 'table': {
      const rowHead = block.columns[0] === '';
      return (
        <figure className="kb-tablefig">
          <div className="kb-scroll">
            <table className={`kb-table kb-cols-${block.columns.length}`}>
              <thead>
                <tr>
                  {block.columns.map((c, i) => (
                    <th key={i} scope="col">
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {block.rows.map((row, r) => (
                  <tr key={r}>
                    {row.map((cell, c) =>
                      c === 0 && rowHead ? (
                        <th key={c} scope="row">
                          <Html as="span" html={cell} />
                        </th>
                      ) : (
                        <td key={c}>
                          <Html as="span" html={cell} />
                        </td>
                      )
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {block.caption && <figcaption>{block.caption}</figcaption>}
        </figure>
      );
    }
    case 'tables':
      return (
        <figure className="kb-minis">
          <div className="kb-minis-in">
            {block.tables.map(t => (
              <div key={t.name} className="kb-mini">
                <p className="kb-mini-h">{t.name}</p>
                <table>
                  <thead>
                    <tr>
                      {t.columns.map(c => (
                        <th key={c} scope="col" className={t.key.includes(c) ? 'kb-pk' : undefined}>
                          {c}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {t.rows.map((row, r) => (
                      <tr key={r}>
                        {row.map((cell, c) => (
                          <td key={c}>{cell}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
          <figcaption>
            <Html as="span" html={block.caption} />
          </figcaption>
        </figure>
      );
    case 'figure':
      return (
        <figure className="kb-figure">
          <Figure fig={block.figure} />
          <figcaption>
            <Html as="span" html={block.caption} />
          </figcaption>
        </figure>
      );
    case 'callout':
      return (
        <aside className={`kb-callout kb-callout-${block.tone}`}>
          <p className="kb-callout-h">{block.title}</p>
          {block.html.map((html, i) => (
            <Html key={i} as="p" html={html} />
          ))}
        </aside>
      );
  }
}

/** `anchor` zamienia id części na id elementu. Strona używa id wprost, podręcznik z wielu rozdziałów dodaje przedrostek. */
export function ChapterBody({ chapter, anchor = id => id }: { chapter: KbChapter; anchor?: (id: string) => string }) {
  return (
    <div className="kb-body">
      <div className="kb-lead">
        {chapter.lead.map((html, i) => (
          <Html key={i} as="p" html={html} />
        ))}
      </div>
      {chapter.sections.map((section, i) => (
        <section key={section.id} id={anchor(section.id)} className="kb-section">
          <h2>
            <span className="kb-num" aria-hidden="true">{String(i + 1).padStart(2, '0')}</span>
            {section.title}
          </h2>
          {section.blocks.map((block, b) => (
            <Block key={b} block={block} />
          ))}
        </section>
      ))}
      <section id={anchor(END.keyPoints.id)} className="kb-section kb-end">
        <h2>{END.keyPoints.title}</h2>
        <ol className="kb-list kb-keypoints">
          {chapter.keyPoints.map((html, i) => (
            <li key={i}>
              <Html as="span" html={html} />
            </li>
          ))}
        </ol>
      </section>
      <section id={anchor(END.glossary.id)} className="kb-section kb-end">
        <h2>{END.glossary.title}</h2>
        <dl className="kb-glossary">
          {chapter.glossary.map(entry => (
            <div key={entry.term}>
              <dt>{entry.term}</dt>
              <dd>
                <Html as="span" html={entry.def} />
              </dd>
            </div>
          ))}
        </dl>
      </section>
      <section id={anchor(END.misconceptions.id)} className="kb-section kb-end">
        <h2>{END.misconceptions.title}</h2>
        <div className="kb-myths">
          {chapter.misconceptions.map((m, i) => (
            <div key={i} className="kb-myth">
              <p className="kb-myth-q">
                <span>Mit</span>
                <Html as="span" html={`„${m.myth}”`} />
              </p>
              <p className="kb-myth-a">
                <span>Jak jest</span>
                <Html as="span" html={m.fact} />
              </p>
            </div>
          ))}
        </div>
      </section>
      <section id={anchor(END.sources.id)} className="kb-section kb-end">
        <h2>{END.sources.title}</h2>
        <p>{chapter.sourcesNote}</p>
        <ul className="kb-sources">
          {chapter.sources.map(source => (
            <li key={source.url}>
              <a href={source.url} target="_blank" rel="noreferrer">
                {source.label}
              </a>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

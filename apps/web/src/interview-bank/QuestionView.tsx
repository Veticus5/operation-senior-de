import { useEffect, useState } from 'react';
import { AREA_LABEL, lessonByTopic, questions } from '@content/index';
import { Html } from '../components/Html';
import { LabRunner } from '../components/LabRunner';
import { MASTERY } from '../lib/progress';
import { href } from '../lib/router';
import { useProgress } from '../lib/useProgress';

export function QuestionView({ id }: { id: string }) {
  const progress = useProgress();
  const index = questions.findIndex(q => q.id === id);
  const q = questions[index];
  const [revealed, setRevealed] = useState(false);
  const [lang, setLang] = useState<'pl' | 'en'>('en');
  useEffect(() => setRevealed(false), [id]);

  if (!q) {
    return (
      <main className="page"><div className="bank"><p className="empty">Nie ma takiego pytania. <a href={href('bank')}>Wróć do listy</a></p></div></main>
    );
  }
  const lesson = lessonByTopic(q.topicId);
  const prev = questions[index - 1];
  const next = questions[index + 1];
  const mastery = progress.mastery(q.id);
  return (
    <main className="page">
      <div className="bank qv">
        <p className="crumbs">
          <a href={href('bank')}>← Interview Bank</a>
          <span>{AREA_LABEL[q.area]}</span>
          <span>{q.priority}</span>
          <span>{index + 1} / {questions.length}</span>
        </p>
        <h1>{q.question.pl}</h1>
        <p className="en" lang="en">{q.question.en}</p>

        <div className="bar2">
          <span className="segc" role="group" aria-label="Status opanowania">
            {MASTERY.map(m => (
              <button key={m.id} type="button" aria-pressed={mastery === m.id} onClick={() => progress.setMastery(q.id, m.id)}>{m.label}</button>
            ))}
          </span>
          <span className="segc" role="group" aria-label="Język odpowiedzi">
            <button type="button" aria-pressed={lang === 'en'} onClick={() => setLang('en')}>English</button>
            <button type="button" aria-pressed={lang === 'pl'} onClick={() => setLang('pl')}>Polski</button>
          </span>
        </div>

        {!revealed ? (
          <div className="recall">
            <span>Active recall: powiedz odpowiedź na głos, zanim ją odsłonisz.</span>
            <button type="button" className="btn solid" onClick={() => setRevealed(true)}>Pokaż odpowiedź</button>
          </div>
        ) : (
          <>
            <p className="ans" lang={lang}>{q.answer[lang]}</p>
            {q.senior && (
              <div className="block">
                <h2>Gdy rozmówca drąży (poziom senior)</h2>
                <p className="ans" lang={lang} style={{ borderColor: 'var(--line-2)', fontSize: 17 }}>{q.senior[lang]}</p>
              </div>
            )}
            <details className="why">
              <summary>Jak to działa, krok po kroku</summary>
              <div>
                <p className="why-note">Do zrozumienia, nie do recytowania. Podkreślone pojęcia mają definicje.</p>
                {q.explain.map((html, i) => <Html as="p" key={i} html={html} />)}
              </div>
            </details>
            <div className="block">
              <h2>Słowa kluczowe</h2>
              <div className="kw">{q.keywords.map(k => <span key={k}>{k}</span>)}</div>
            </div>
            <div className="block">
              <h2>Pytania pogłębiające</h2>
              {q.followUps.map(fu => (
                <details className="fu" key={fu.q}>
                  <summary><span lang="en">{fu.q}</span></summary>
                  <div className="a">
                    <p lang="en">{fu.a}</p>
                    <p className="pl">{fu.pl}</p>
                  </div>
                </details>
              ))}
            </div>
            <div className="block">
              <h2>Typowe błędy kandydatów</h2>
              <ul className="mist">{q.mistakes.map(m => <li key={m}>{m}</li>)}</ul>
            </div>
          </>
        )}

        {lesson && (
          <div className="block">
            <h2>Lekcja do tego pytania</h2>
            <a className="lesson-link" href={href('academy', lesson.id)}>{lesson.title} · ok. {lesson.minutes} min →</a>
          </div>
        )}

        {q.labIds?.map(labId => (
          <div className="block" key={labId}>
            <h2>Sprawdź to sam</h2>
            <LabRunner labId={labId} />
          </div>
        ))}

        <div className="pn">
          {prev ? <a href={href('bank', 'q', prev.id)}>← {prev.title}</a> : <span />}
          {next ? <a href={href('bank', 'q', next.id)} style={{ textAlign: 'right' }}>{next.title} →</a> : <span />}
        </div>
      </div>
    </main>
  );
}

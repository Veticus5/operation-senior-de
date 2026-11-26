import { useEffect, useState } from 'react';
import { questions, type Question } from '@content/index';
import type { Mastery } from '../lib/progress';
import { href } from '../lib/router';
import { useProgress } from '../lib/useProgress';

type Scope = 'p0-open' | 'review' | 'p0' | 'all';
const SCOPES: { id: Scope; label: string }[] = [
  { id: 'p0-open', label: 'P0, których jeszcze nie opanowałem' },
  { id: 'review', label: 'Oznaczone do powtórki' },
  { id: 'p0', label: 'Wszystkie P0' },
  { id: 'all', label: 'Cała baza' }
];
const GRADES: { mastery: Mastery; label: string; hint: string }[] = [
  { mastery: 'mastered', label: 'Umiem', hint: 'klawisz 1' },
  { mastery: 'review', label: 'Do powtórki', hint: 'klawisz 2' },
  { mastery: 'learning', label: 'Jeszcze nie', hint: 'klawisz 3' }
];

/** Szybka powtórka przed rozmową: pytanie, odpowiedź na głos, odsłonięcie, samoocena. */
export function Review() {
  const progress = useProgress();
  const pick = (scope: Scope): Question[] =>
    questions.filter(q => {
      const m = progress.mastery(q.id);
      if (scope === 'p0-open') return q.priority === 'P0' && m !== 'mastered';
      if (scope === 'review') return m === 'review';
      if (scope === 'p0') return q.priority === 'P0';
      return true;
    });
  const [scope, setScope] = useState<Scope>('p0-open');
  const [lang, setLang] = useState<'pl' | 'en'>('en');
  const [queue, setQueue] = useState<Question[] | null>(null);
  const [i, setI] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [log, setLog] = useState<{ q: Question; mastery: Mastery }[]>([]);
  const current = queue?.[i];

  const grade = (mastery: Mastery) => {
    if (!current) return;
    progress.setMastery(current.id, mastery);
    setLog(l => [...l, { q: current, mastery }]);
    setRevealed(false);
    setI(i + 1);
  };
  useEffect(() => {
    if (!current) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === ' ' && !revealed) { e.preventDefault(); setRevealed(true); }
      const g = revealed ? GRADES[Number(e.key) - 1] : undefined;
      if (g) grade(g.mastery);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (!queue) {
    return (
      <main className="page">
        <div className="bank rv">
          <p className="crumbs"><a href={href('bank')}>← Interview Bank</a></p>
          <h1 style={{ fontSize: 'clamp(32px,4.4vw,44px)' }}>Szybka powtórka</h1>
          <p className="muted">Pytanie, Twoja odpowiedź na głos, odsłonięcie, samoocena. Około minuty na pytanie.</p>
          <div className="opts">
            {SCOPES.map(s => (
              <label key={s.id}>
                <input type="radio" name="scope" checked={scope === s.id} onChange={() => setScope(s.id)} />
                {s.label}
                <small>{pick(s.id).length} pytań</small>
              </label>
            ))}
          </div>
          <div className="bar2">
            <span className="segc" role="group" aria-label="Język odpowiedzi">
              <button type="button" aria-pressed={lang === 'en'} onClick={() => setLang('en')}>Odpowiedzi po angielsku</button>
              <button type="button" aria-pressed={lang === 'pl'} onClick={() => setLang('pl')}>Po polsku</button>
            </span>
          </div>
          <button type="button" className="btn solid" disabled={!pick(scope).length} onClick={() => { setQueue(pick(scope)); setI(0); setLog([]); }}>
            {pick(scope).length ? 'Zaczynam' : 'Brak pytań w tym zakresie'}
          </button>
        </div>
      </main>
    );
  }

  if (!current) {
    const again = log.filter(x => x.mastery !== 'mastered');
    return (
      <main className="page">
        <div className="bank rv">
          <p className="crumbs"><a href={href('bank')}>← Interview Bank</a></p>
          <p className="score" style={{ font: '600 72px/1 var(--display)', color: 'var(--accent)', margin: '0 0 14px' }}>
            {log.length - again.length} / {log.length}
          </p>
          <h1 style={{ fontSize: 34 }}>{again.length ? 'Te pytania wracają do powtórki' : 'Wszystko opanowane w tej rundzie'}</h1>
          {again.map(x => (
            <a key={x.q.id} className="qrow" style={{ gridTemplateColumns: '34px 1fr' }} href={href('bank', 'q', x.q.id)}>
              <span className={`p ${x.q.priority}`}>{x.q.priority}</span>
              <span className="t"><b>{x.q.question.pl}</b></span>
            </a>
          ))}
          <div className="pn">
            <button type="button" className="btn" onClick={() => setQueue(null)}>Nowa runda</button>
            <a className="btn" href={href('bank')}>Wróć do listy</a>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="page">
      <div className="bank rv">
        <p className="crumbs">
          <a href={href('bank')}>← Przerwij</a>
          <span>{i + 1} / {queue.length}</span>
          <span>{current.priority}</span>
        </p>
        <div className="rv-prog"><i style={{ width: `${(100 * i) / queue.length}%` }} /></div>
        <p className="rv-q" lang="en">{current.question.en}</p>
        <p className="muted" style={{ marginBottom: 26 }}>{current.question.pl}</p>
        {!revealed ? (
          <div className="recall">
            <span>Powiedz odpowiedź na głos.</span>
            <button type="button" className="btn solid" onClick={() => setRevealed(true)}>Pokaż odpowiedź (spacja)</button>
          </div>
        ) : (
          <>
            <p className="ans" lang={lang}>{current.answer[lang]}</p>
            <div className="block">
              <div className="kw">{current.keywords.map(k => <span key={k}>{k}</span>)}</div>
            </div>
            <div className="grade">
              {GRADES.map(g => (
                <button key={g.mastery} type="button" onClick={() => grade(g.mastery)}>
                  {g.label}
                  <small>{g.hint}</small>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </main>
  );
}

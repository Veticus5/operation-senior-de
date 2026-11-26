import { useEffect, useRef, useState } from 'react';
import { beats, experiments, interview, meta, type Experiment } from '@content/spark/lazy-evaluation/lesson';
import { questionsByTopic } from '@content/index';
import labCode from '../../../../../labs/lazy_evaluation/lazy_lab.py?raw';
import { CopyButton } from '../../components/CopyButton';
import { Html } from '../../components/Html';
import { href, navigate } from '../../lib/router';
import { useProgress } from '../../lib/useProgress';
import { LazySim } from './LazySim';
import { Tasks } from './Tasks';

const STAGES = [
  ['intuicja', 'Intuicja'],
  ['mechanizm', 'Mechanizm'],
  ['praktyka', 'Praktyka'],
  ['interview', 'Interview'],
  ['test', 'Sprawdź się']
] as const;
type StageId = (typeof STAGES)[number][0];

const DATA: [number, string, string, string][] = [
  [1, 'A', 'active', '9.99'], [2, 'B', 'active', '4.99'], [3, 'C', 'cancelled', '9.99'],
  [4, 'B', 'active', '9.99'], [5, 'C', 'active', '4.99'], [6, 'A', 'cancelled', '9.99'],
  [7, 'C', 'active', '9.99'], [8, 'A', 'active', '4.99'], [9, 'B', 'cancelled', '9.99']
];

function Intuition({ onNext }: { onNext: () => void }) {
  const [shown, setShown] = useState(1);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (shown === 1) return;
    const el = box.current?.children[shown - 1] as HTMLElement | undefined;
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    const cmp = el?.querySelector('.cmp');
    if (cmp) setTimeout(() => cmp.classList.add('play'), 500);
  }, [shown]);
  return (
    <div className="read" ref={box}>
      {beats.slice(0, shown).map((b, i) => (
        <div className="beat on" key={i}>
          {i === 0 && <p className="eyebrow">Etap 1 · Intuicja</p>}
          <Html html={b.html} />
          {i === shown - 1 && b.next && (
            <button type="button" className={i === beats.length - 1 ? 'cta' : 'more'} onClick={() => (i === beats.length - 1 ? onNext() : setShown(shown + 1))}>
              {b.next}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

function ExperimentCard({ n, e }: { n: number; e: Experiment }) {
  const [picked, setPicked] = useState<number | null>(null);
  return (
    <div className="obs">
      <span className="num">EKSPERYMENT {n}</span>
      <Html as="p" className="ask" html={e.ask} />
      <div className="choices">
        {e.choices.map((c, i) => (
          <button key={c} type="button" className={`choice${e.mono ? ' mono' : ''}${picked === null ? '' : i === e.correct ? ' ok' : i === picked ? ' no' : ''}`} disabled={picked !== null} onClick={() => setPicked(i)}>
            {c}
          </button>
        ))}
      </div>
      {picked !== null && (
        <div className="reveal on">
          <p className={`verdict ${picked === e.correct ? 'ok' : 'no'}`}>{picked === e.correct ? 'Dobrze przewidziane.' : 'Inaczej, niż się wydaje. Zobacz wynik.'}</p>
          <Html as="pre" className="code" html={e.output} />
          {e.notes.map((note, i) => (
            <Html as="p" key={i} html={note} />
          ))}
        </div>
      )}
    </div>
  );
}

function Interview() {
  const [cur, setCur] = useState(0);
  const [pl, setPl] = useState(false);
  const a = interview.answers[cur];
  const text = pl && a.pl ? a.pl : a.text;
  const bank = questionsByTopic(meta.topicId);
  return (
    <>
      <p className="eyebrow">Etap 4 · Interview</p>
      <p className="q-pl">{interview.questionPl}</p>
      <p className="q-en" lang="en">{interview.questionEn}</p>
      <div className="tiers" role="group" aria-label="Wersja odpowiedzi">
        {interview.answers.map((x, i) => (
          <button key={x.id} type="button" className="tier" aria-pressed={i === cur} onClick={() => { setCur(i); setPl(false); }}>
            {x.label}
          </button>
        ))}
      </div>
      <p className="ans-meta">
        <span>{a.time} · {text.split(/\s+/).length} słów</span>
        {a.pl && (
          <button type="button" className="linkbtn" onClick={() => setPl(!pl)}>
            {pl ? 'pokaż po angielsku' : 'pokaż po polsku'}
          </button>
        )}
      </p>
      <p className="answer" lang={pl && a.pl ? 'pl' : a.lang}>{text}</p>
      {a.note && <p className="small">{a.note}</p>}

      <div className="sect">
        <h3>Pytania pogłębiające</h3>
        <p className="muted">Odpowiedz na głos, dopiero potem rozwiń.</p>
        {interview.followUps.map(([q, ans, gist]) => (
          <details className="fu" key={q}>
            <summary><span lang="en">{q}</span></summary>
            <div className="a">
              <p lang="en">{ans}</p>
              <p className="pl">{gist}</p>
            </div>
          </details>
        ))}
      </div>

      <div className="sect">
        <h3>Twoje doświadczenie w tej odpowiedzi</h3>
        <p>Nie znasz Sparka z produkcji tak jak Snowflake i nie musisz udawać. Ten temat akurat świetnie przenosi się z tego, co robisz na co dzień, więc powiedz to wprost:</p>
        <p className="answer" lang="en" style={{ fontSize: 19 }}>{interview.bridgeEn}</p>
        <p className="small">{interview.bridgePl}</p>
      </div>

      {bank.length > 0 && (
        <div className="sect">
          <h3>To pytanie w Interview Banku</h3>
          <p className="muted">Krótka wersja do powtórek, bez przechodzenia lekcji od nowa.</p>
          {bank.map(q => (
            <a key={q.id} className="lesson-link" href={href('bank', 'q', q.id)}>
              {q.title} →
            </a>
          ))}
        </div>
      )}
    </>
  );
}

export function LazyLesson({ stage }: { stage?: string }) {
  const progress = useProgress();
  const cur: StageId = STAGES.some(s => s[0] === stage) ? (stage as StageId) : 'intuicja';
  const go = (s: string) => navigate('academy', meta.id, s);
  const hidden = (id: StageId) => cur !== id;

  return (
    <>
      <header className="nav">
        <div className="nav-in">
          <nav className="steps" aria-label="Etapy lekcji">
            {STAGES.map(([id, label], i) => (
              <button key={id} type="button" className="step" aria-current={id === cur ? 'step' : undefined} onClick={() => go(id)}>
                <i>{i + 1}</i>
                {label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      {/* Wszystkie etapy są zamontowane, żeby stan (symulator, odsłonięte fragmenty, odpowiedzi) przetrwał przełączanie. */}
      <section className="stage" hidden={hidden('intuicja')}>
        <Intuition onNext={() => go('mechanizm')} />
      </section>

      <section className="stage" hidden={hidden('mechanizm')}>
        <div className="wide">
          <p className="eyebrow">Etap 2 · Mechanizm</p>
          <LazySim />
          <details className="simnote">
            <summary>Co tu jest symulacją, a co pochodzi z prawdziwego Sparka</summary>
            <ul>
              <li>Ruch danych to animacja w JavaScripcie na 9 wierszach. Nie działa tu żaden Spark.</li>
              <li>Plan po optymalizacji, lista czytanych kolumn i przekazanie filtra do skanu pochodzą z prawdziwego <code>explain()</code> dla każdej kombinacji operacji i akcji (PySpark 4.0.1, źródło Parquet).</li>
              <li>Ponowne przetwarzanie wierszy przy drugiej akcji i jego brak po <code>cache()</code> zmierzyłem licznikiem w UDF. Wyniki są w etapie Praktyka.</li>
              <li>Uproszczenia: nie ma partycji, jobów ani stage'y, a <code>show()</code> pokazuje wszystko, choć naprawdę wyświetla do 20 wierszy.</li>
            </ul>
          </details>
          <div className="foot">
            <button type="button" className="back" onClick={() => go('intuicja')}>← Intuicja</button>
            <button type="button" className="cta" style={{ margin: 0 }} onClick={() => go('praktyka')}>Sprawdź to na prawdziwym Sparku</button>
          </div>
        </div>
      </section>

      <section className="stage" hidden={hidden('praktyka')}>
        <div className="read">
          <p className="eyebrow">Etap 3 · Praktyka</p>
          <h2>Ten sam mechanizm, tym razem naprawdę</h2>
          <p className="lede">Jeden skrypt, pięć małych eksperymentów. Wszystko poniżej to wynik jego uruchomienia, nie symulacja.</p>
          <span className="badge">Rzeczywiste wykonanie · PySpark 4.0.1 · local[3] · ustawienia domyślne</span>
          <h3 style={{ marginTop: 36 }}>Dane wejściowe</h3>
          <table className="data">
            <thead><tr><th>subscription_id</th><th>publisher_id</th><th>status</th><th>price</th></tr></thead>
            <tbody>
              {DATA.map(r => (
                <tr key={r[0]}>{r.map((v, i) => <td key={i} className={r[2] === 'cancelled' ? 'off' : undefined}>{v}</td>)}</tr>
              ))}
            </tbody>
          </table>
          <h3>Skrypt</h3>
          <p className="muted">W repozytorium: <code>labs/lazy_evaluation/lazy_lab.py</code>. Uruchomienie: <code>cd labs && uv run lazy_evaluation/lazy_lab.py</code> (wymaga Javy 17+).</p>
          <div className="codewrap">
            <CopyButton text={labCode} />
            <pre className="code">{labCode}</pre>
          </div>
          <p className="muted">Zanim przewiniesz dalej: przy każdym eksperymencie najpierw zgadnij wynik.</p>
          {experiments.map((e, i) => <ExperimentCard key={i} n={i + 1} e={e} />)}
          <div className="foot">
            <button type="button" className="back" onClick={() => go('mechanizm')}>← Mechanizm</button>
            <button type="button" className="cta" style={{ margin: 0 }} onClick={() => go('interview')}>Teraz ułóż z tego odpowiedź</button>
          </div>
        </div>
      </section>

      <section className="stage" hidden={hidden('interview')}>
        <div className="read">
          <Interview />
          <div className="foot">
            <button type="button" className="back" onClick={() => go('praktyka')}>← Praktyka</button>
            <button type="button" className="cta" style={{ margin: 0 }} onClick={() => go('test')}>Sprawdź, czy to siedzi</button>
          </div>
        </div>
      </section>

      <section className="stage" hidden={hidden('test')}>
        <div className="read">
          <p className="eyebrow">Etap 5 · Sprawdź się{progress.lessonCompleted(meta.id) ? ' · lekcja ukończona' : ''}</p>
          <Tasks onFinished={() => progress.setLessonCompleted(meta.id, true)} onGo={go} />
        </div>
      </section>
    </>
  );
}

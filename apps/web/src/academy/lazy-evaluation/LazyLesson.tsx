import { useEffect, useRef, useState } from 'react';
import { beats, experiments, interview, labHint, labId, mechanism, meta, simNotes, type Experiment } from '@content/spark/lazy-evaluation/lesson';
import { questionsByTopic } from '@content/index';
import { CodeExplainer } from '../../components/CodeExplainer';
import { ConceptBridge } from '../../components/ConceptBridge';
import { Html } from '../../components/Html';
import { LabRunner } from '../../components/LabRunner';
import { plainText } from '../../lib/richText';
import { href, navigate } from '../../lib/router';
import { useProgress } from '../../lib/useProgress';
import { LazySim } from './LazySim';
import { RowGroups } from './RowGroups';
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
          {b.more && (
            <details className="deeper">
              <summary>{b.more.title}</summary>
              <div>
                {b.more.html.map((h, j) => <Html as="p" key={j} html={h} />)}
              </div>
            </details>
          )}
          {b.bridge && <ConceptBridge bridge={b.bridge} />}
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
      <p className="setup">
        <b>Założenia.</b> <Html as="span" html={e.setup} />
      </p>
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
          {e.output && <Html as="pre" className="code" html={e.output} />}
          {e.notes.map((note, i) => (
            <Html as="p" key={i} html={note} />
          ))}
          {e.explainers?.map(x => <CodeExplainer key={x.title} title={x.title} lines={x.lines} order={x.order} />)}
          <p className="scope">
            <b>Zakres tego wyniku.</b> <Html as="span" html={e.scope} />
          </p>
          {e.bridge && <ConceptBridge bridge={e.bridge} />}
          {e.more && (
            <details className="deeper">
              <summary>{e.more.title}</summary>
              <div>
                {e.more.html.map((h, i) => <Html as="p" key={i} html={h} />)}
              </div>
            </details>
          )}
        </div>
      )}
    </div>
  );
}

function Interview() {
  const [long, setLong] = useState(false);
  const [lang, setLang] = useState<'en' | 'pl'>('en');
  // Pytanie, krótka odpowiedź i follow-upy mają jedno źródło: Interview Bank.
  const bank = questionsByTopic(meta.topicId);
  const q = bank[0];
  if (!q) return null;
  const text = long ? interview.long[lang] : q.answer[lang];
  const time = long ? interview.long.time[lang] : lang === 'en' ? '30 to 60 seconds' : '30–60 sekund';
  return (
    <>
      <p className="eyebrow">Etap 4 · Interview</p>
      <p className="q-pl">{q.question.pl}</p>
      <p className="q-en" lang="en">{q.question.en}</p>
      <div className="tiers" role="group" aria-label="Wersja odpowiedzi">
        <button type="button" className="tier" aria-pressed={!long} onClick={() => setLong(false)}>Odpowiedź na 30–60 sekund</button>
        <button type="button" className="tier" aria-pressed={long} onClick={() => setLong(true)}>{interview.long.label}</button>
      </div>
      <p className="ans-meta">
        <span>{time} · {plainText(text).split(/\s+/).length} słów</span>
        <button type="button" className="linkbtn" onClick={() => setLang(lang === 'en' ? 'pl' : 'en')}>
          {lang === 'en' ? 'pokaż po polsku' : 'pokaż po angielsku'}
        </button>
      </p>
      <p className="answer" lang={lang}>{text}</p>
      {long ? <p className="small">{interview.long.note}</p> : q.senior && <p className="small" lang={lang}>{lang === 'en' ? 'If they dig deeper: ' : 'Gdy rozmówca drąży: '}{q.senior[lang]}</p>}

      <div className="sect">
        <h3>Pytania pogłębiające</h3>
        <p className="muted">Odpowiedz na głos, dopiero potem rozwiń.</p>
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

      <div className="sect">
        <h3>Most do tego, co już znasz</h3>
        <p>{interview.bridgeIntro}</p>
        <p className="answer" lang="en" style={{ fontSize: 19 }}>{interview.bridgeEn}</p>
        <p className="small">{interview.bridgePl}</p>
      </div>

      <div className="sect">
        <h3>To pytanie w Interview Banku</h3>
        <p className="muted">Ta sama odpowiedź do powtórek, z wyjaśnieniem mechanizmu i typowymi błędami. Bez przechodzenia lekcji od nowa.</p>
        {bank.map(b => (
          <a key={b.id} className="lesson-link" href={href('bank', 'q', b.id)}>
            {b.title} →
          </a>
        ))}
      </div>
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
          <h2>{mechanism.question}</h2>
          <span className="badge sim">Symulacja w przeglądarce · plany z prawdziwego explain()</span>
          <LazySim />
          <Html as="p" className="takeaway" html={mechanism.takeaway} />
          <details className="simnote">
            <summary>Co tu jest symulacją, a co pochodzi z prawdziwego Sparka</summary>
            <ul>
              {simNotes.map((note, i) => <li key={i}><Html as="span" html={note} /></li>)}
            </ul>
          </details>
          <RowGroups />
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
          <p className="lede">Jeden skrypt, pięć małych eksperymentów. Każdy wydruk poniżej to wynik jego uruchomienia, nie symulacja.</p>
          <span className="badge">Rzeczywiste wykonanie · PySpark 4.0.1 · local[3] · ustawienia domyślne</span>
          <p className="small" style={{ maxWidth: '64ch' }}>
            <code>local[3]</code> to jeden proces z trzema wątkami na jednej maszynie, bez klastra. Wyniki pokazują mechanizm, ale są obserwacją z tej konfiguracji, a nie gwarancją Sparka. Przy każdym eksperymencie jest napisane, jak daleko wolno go uogólniać.
          </p>
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
          <LabRunner labId={labId} sourceOpen hint={labHint} />
          <p className="muted">
            Warunki i wyjątki, do których odwołują się rozwinięcia pod eksperymentami, sprawdza drugi skrypt: <code>labs/lazy_evaluation/lazy_conditions_lab.py</code>.
          </p>
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

import { useEffect, useRef, useState } from 'react';
import { beats, choosing, interview, labHint, labId, meta, plans, quiz, scenarios, sim, sizes, type Experiment, type Scenario } from '@content/spark/join-strategies/lesson';
import { lessons, questions, questionsByTopic, type Question } from '@content/index';
import { CodeExplainer } from '../../components/CodeExplainer';
import { ConceptBridge } from '../../components/ConceptBridge';
import { Html } from '../../components/Html';
import { LabRunner } from '../../components/LabRunner';
import { href, navigate } from '../../lib/router';
import { useProgress } from '../../lib/useProgress';
import { JoinSim, Scatter } from './JoinSim';
import { SizeLab } from './SizeLab';
import './joins.css';

const STAGES = [
  ['intuicja', 'Intuicja'],
  ['mechanizm', 'Mechanizm'],
  ['praktyka', 'Praktyka'],
  ['interview', 'Interview'],
  ['test', 'Sprawdź się']
] as const;
type StageId = (typeof STAGES)[number][0];

/** Zwinięta sekcja: treść zostaje pod nagłówkiem, a kilka sekcji może być otwartych naraz. */
function Deeper({ title, html, list, children }: { title: string; html?: string[]; list?: string[]; children?: React.ReactNode }) {
  return (
    <details className="deeper">
      <summary>{title}</summary>
      <div>
        {children}
        {html?.map((h, i) => <Html as="p" key={i} html={h} />)}
        {list && (
          <ul className="deeper-list">
            {list.map((item, i) => <li key={i}><Html as="span" html={item} /></li>)}
          </ul>
        )}
      </div>
    </details>
  );
}

function Intuition({ onNext }: { onNext: () => void }) {
  const [shown, setShown] = useState(1);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (shown === 1) return;
    const el = box.current?.children[shown - 1] as HTMLElement | undefined;
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [shown]);
  return (
    <div className="read" ref={box}>
      {beats.slice(0, shown).map((b, i) => (
        <div className="beat on" key={i}>
          {i === 0 && <p className="eyebrow">Etap 1 · Intuicja</p>}
          <Html html={b.html} />
          {b.visual === 'scatter' && <Scatter />}
          {b.after && <Html as="p" className="takeaway" html={b.after} />}
          {b.bridge && <ConceptBridge bridge={b.bridge} />}
          {b.more && <Deeper title={b.more.title} html={b.more.html} />}
          {i === shown - 1 && (
            <button type="button" className={i === beats.length - 1 ? 'cta' : 'more'} onClick={() => (i === beats.length - 1 ? onNext() : setShown(shown + 1))}>
              {b.next}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

/** Trzy prawdziwe plany tego samego joina. Wszystkie są zamontowane, żeby wybrana linia przetrwała przełączenie. */
function Plans() {
  const [current, setCurrent] = useState(plans.items[0].id);
  return (
    <>
      <div className="tiers" role="group" aria-label="Plan fizyczny">
        {plans.items.map(p => (
          <button key={p.id} type="button" className="tier" aria-pressed={p.id === current} onClick={() => setCurrent(p.id)}>{p.label}</button>
        ))}
      </div>
      {plans.items.map(p => (
        <div key={p.id} hidden={p.id !== current}>
          <Html as="p" className="setup" html={`<b>Jak uzyskany.</b> ${p.how}`} />
          <CodeExplainer title={`Plan fizyczny · ${p.label}`} lines={p.lines} order="bottom-up" />
          <p className="js-measure">{p.shuffle}</p>
        </div>
      ))}
    </>
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
          <pre className="code js-out">{e.output}</pre>
          {e.notes.map((note, i) => <Html as="p" key={i} html={note} />)}
          {e.explainers?.map(x => <CodeExplainer key={x.title} title={x.title} lines={x.lines} order={x.order} />)}
          <p className="scope">
            <b>Zakres tego wyniku.</b> <Html as="span" html={e.scope} />
          </p>
        </div>
      )}
    </div>
  );
}

function ScenarioCard({ n, s }: { n: number; s: Scenario }) {
  const [picked, setPicked] = useState<number | null>(null);
  return (
    <div className="obs">
      <span className="num">SYTUACJA {n}</span>
      <Html as="p" className="ask" html={s.setup} />
      <p className="muted" style={{ marginBottom: 12 }}>{s.ask}</p>
      <div className="choices quiz-choices">
        {s.options.map((c, i) => (
          <button key={c} type="button" className={`choice${picked === null ? '' : i === s.correct ? ' ok' : i === picked ? ' no' : ''}`} disabled={picked !== null} onClick={() => setPicked(i)}>
            {c}
          </button>
        ))}
      </div>
      {picked !== null && (
        <div className="reveal on">
          <p className={`verdict ${picked === s.correct ? 'ok' : 'no'}`}>{picked === s.correct ? 'Tak bym to uzasadnił.' : 'Jest lepszy pierwszy krok.'}</p>
          <Html as="p" html={s.why} />
          <p className="scope">
            <b>Granice tej odpowiedzi.</b> <Html as="span" html={s.scope} />
          </p>
        </div>
      )}
    </div>
  );
}

/** Jedno pytanie z Interview Banku: odpowiedź 30–60 s w dwóch językach, dopowiedzenie i follow-upy. */
function BankQuestion({ q }: { q: Question }) {
  const [lang, setLang] = useState<'en' | 'pl'>('en');
  const text = q.answer[lang];
  return (
    <>
      <p className="q-pl">{q.question.pl}</p>
      <p className="q-en" lang="en">{q.question.en}</p>
      <p className="ans-meta">
        <span>{lang === 'en' ? '30 to 60 seconds' : '30–60 sekund'} · {text.split(/\s+/).length} słów</span>
        <button type="button" className="linkbtn" onClick={() => setLang(lang === 'en' ? 'pl' : 'en')}>
          {lang === 'en' ? 'pokaż po polsku' : 'pokaż po angielsku'}
        </button>
      </p>
      <p className="answer" lang={lang}>{text}</p>
      {q.senior && <p className="small" lang={lang}>{lang === 'en' ? 'If they dig deeper: ' : 'Gdy rozmówca drąży: '}{q.senior[lang]}</p>}
      <div className="sect" style={{ marginTop: 48 }}>
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
    </>
  );
}

function Interview() {
  // Pytania, krótkie odpowiedzi i follow-upy mają jedno źródło: Interview Bank.
  const bank = questionsByTopic(meta.topicId);
  const related = interview.related.flatMap(id => questions.filter(q => q.id === id));
  const [current, setCurrent] = useState(0);
  if (!bank.length) return null;
  return (
    <>
      <p className="eyebrow">Etap 4 · Interview</p>
      <div className="tiers" role="group" aria-label="Pytanie">
        {bank.map((q, i) => (
          <button key={q.id} type="button" className="tier" aria-pressed={i === current} onClick={() => setCurrent(i)}>{q.title}</button>
        ))}
      </div>
      {bank.map((q, i) => (
        <div key={q.id} hidden={i !== current}>
          <BankQuestion q={q} />
        </div>
      ))}

      <div className="sect">
        <h3>Gdy nie masz tego z produkcji</h3>
        <p>{interview.bridgeIntro}</p>
        <p className="answer" lang="en" style={{ fontSize: 19 }}>{interview.bridgeEn}</p>
        <p className="small">{interview.bridgePl}</p>
      </div>

      <div className="sect">
        <h3>{interview.relatedTitle}</h3>
        <p className="muted">{interview.relatedIntro}</p>
        <p className="links">
          {[...bank, ...related].map(b => (
            <a key={b.id} className="lesson-link" href={href('bank', 'q', b.id)}>
              {b.title} →
            </a>
          ))}
        </p>
      </div>
    </>
  );
}

function Quiz({ onFinished, onGo }: { onFinished: () => void; onGo: (stage: string) => void }) {
  const [round, setRound] = useState(0);
  const [index, setIndex] = useState(0);
  const [picks, setPicks] = useState<number[]>([]);
  const good = picks.filter((p, i) => p === quiz[i].correct).length;
  const next = lessons[lessons.findIndex(l => l.id === meta.id) + 1];

  if (index >= quiz.length) {
    const perfect = good === quiz.length;
    return (
      <div className="task on done-box">
        <p className="score">{good} / {quiz.length}</p>
        <h2>{perfect ? 'Strategie siedzą.' : good >= 4 ? 'Większość siedzi.' : 'Warto wrócić do planów.'}</h2>
        <p className="lede">
          {perfect
            ? 'Powiedz teraz na głos obie odpowiedzi z etapu Interview, bez patrzenia. Potem uruchom lab i znajdź w wydruku trzy plany.'
            : 'Tam, gdzie się pomyliłeś, wróć do planów w etapie Praktyka i znajdź w nich Exchange i Sort. Zobaczenie tego działa lepiej niż ponowne czytanie.'}
        </p>
        <div className="foot" style={{ marginTop: 48 }}>
          <button type="button" className="back" onClick={() => { setRound(round + 1); setIndex(0); setPicks([]); }}>
            Rozwiąż jeszcze raz
          </button>
          {perfect && next ? (
            <a className="cta" style={{ margin: 0, textDecoration: 'none' }} href={href('academy', next.id)}>Następna lekcja: {next.title}</a>
          ) : (
            <button type="button" className="cta" style={{ margin: 0 }} onClick={() => onGo(perfect ? 'interview' : 'praktyka')}>
              {perfect ? 'Wróć do Interview' : 'Wróć do planów'}
            </button>
          )}
        </div>
      </div>
    );
  }

  const item = quiz[index];
  const picked = picks[index];
  const answered = picked !== undefined;
  return (
    <div className="task on" key={`${round}-${index}`}>
      <p className="task-n">PYTANIE {index + 1} Z {quiz.length}</p>
      <Html as="div" className="quiz-q" html={`<h2>${item.q}</h2>`} />
      {item.setup && <p className="muted">{item.setup}</p>}
      <div className="choices quiz-choices">
        {item.options.map((o, i) => (
          <button key={o} type="button" className={`choice${!answered ? '' : i === item.correct ? ' ok' : i === picked ? ' no' : ''}`} disabled={answered} onClick={() => setPicks([...picks.slice(0, index), i])}>
            {o}
          </button>
        ))}
      </div>
      {answered && (
        <div className={`fb on ${picked === item.correct ? 'ok' : 'no'}`}>
          <Html as="p" html={item.why} />
        </div>
      )}
      <div className="task-nav">
        <span />
        {answered && (
          <button type="button" className="cta" style={{ margin: 0 }} onClick={() => { if (index === quiz.length - 1) onFinished(); setIndex(index + 1); window.scrollTo(0, 0); }}>
            {index === quiz.length - 1 ? 'Podsumowanie' : 'Następne pytanie'}
          </button>
        )}
      </div>
    </div>
  );
}

export function JoinLesson({ stage }: { stage?: string }) {
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

      {/* Wszystkie etapy są zamontowane, żeby stan (symulacja, odsłonięte fragmenty, odpowiedzi) przetrwał przełączanie. */}
      <section className="stage" hidden={hidden('intuicja')}>
        <Intuition onNext={() => go('mechanizm')} />
      </section>

      <section className="stage" hidden={hidden('mechanizm')}>
        <div className="read">
          <p className="eyebrow">Etap 2 · Mechanizm</p>
          <h2>{sim.question}</h2>
          <p>{sim.intro}</p>
          <JoinSim />
          {sim.takeaway.map((html, i) => <Html as="p" key={i} className="takeaway" html={html} />)}
          <Deeper title={sim.notesTitle} list={sim.notes} />

          <section className="unit" aria-labelledby="js-sizes-title">
            <h2 id="js-sizes-title">{sizes.title}</h2>
            <p>{sizes.intro}</p>
            <SizeLab />
            <Html as="p" className="takeaway" html={sizes.takeaway} />
            <Deeper title={sizes.limitsTitle} list={sizes.limits} />
            <Deeper title={sizes.shjTitle} html={sizes.shjNotes} />
          </section>

          <div className="foot">
            <button type="button" className="back" onClick={() => go('intuicja')}>← Intuicja</button>
            <button type="button" className="cta" style={{ margin: 0 }} onClick={() => go('praktyka')}>Zobacz prawdziwe plany</button>
          </div>
        </div>
      </section>

      <section className="stage" hidden={hidden('praktyka')}>
        <div className="read">
          <p className="eyebrow">Etap 3 · Praktyka</p>
          <h2>{plans.title}</h2>
          <p className="lede">{plans.lede}</p>
          <span className="badge">{plans.badge}</span>
          <Html as="p" className="small" html={plans.scope} />
          <Html as="p" html={`<b>${plans.dataTitle}.</b> ${plans.data}`} />
          <pre className="code js-out">{plans.code}</pre>
          <Html as="p" html={plans.pick} />
          <Plans />
          <Html as="p" className="takeaway" html={plans.takeaway} />
          <Html as="p" className="small" html={plans.versionNote} />
          <h3 style={{ marginTop: 36 }}>Skrypt</h3>
          <LabRunner labId={labId} hint={labHint} />

          <section className="unit" aria-labelledby="js-choose-title">
            <h2 id="js-choose-title">{choosing.title}</h2>
            <Html as="p" html={choosing.intro} />
            {choosing.experiments.map((e, i) => <ExperimentCard key={i} n={i + 1} e={e} />)}
            <div className="unit-end">
              <Deeper title={choosing.orderTitle} list={choosing.order}>
                <p>{choosing.orderIntro}</p>
              </Deeper>
              <Deeper title={choosing.statsTitle} html={choosing.stats} />
              <Deeper title={choosing.typesTitle} html={choosing.types} />
              <Deeper title={choosing.databricksTitle} html={choosing.databricks} />
            </div>
          </section>

          <section className="unit" aria-labelledby="js-cases-title">
            <h2 id="js-cases-title">{scenarios.title}</h2>
            <p>{scenarios.intro}</p>
            {scenarios.cases.map((s, i) => <ScenarioCard key={i} n={i + 1} s={s} />)}
            <Html as="p" className="takeaway unit-end" html={scenarios.takeaway} />
          </section>

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
          <Quiz onFinished={() => progress.setLessonCompleted(meta.id, true)} onGo={go} />
        </div>
      </section>
    </>
  );
}

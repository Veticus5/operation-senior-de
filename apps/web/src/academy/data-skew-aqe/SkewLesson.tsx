import { useEffect, useRef, useState } from 'react';
import { beats, interview, interviewTopics, lab, labId, limits, meta, metrics, moves, quiz, salting, sim, troubleshoot, type Scenario } from '@content/spark/data-skew-aqe/lesson';
import { lessons, questions, type Question } from '@content/index';
import { CodeExplainer } from '../../components/CodeExplainer';
import { ConceptBridge } from '../../components/ConceptBridge';
import { Html } from '../../components/Html';
import { LabRunner } from '../../components/LabRunner';
import { href, navigate } from '../../lib/router';
import { useProgress } from '../../lib/useProgress';
import { SkewSim } from './SkewSim';
import { AqeLimits, AqeMoves, KeyBars, MetricsCases } from './Visuals';

const STAGES = [
  ['intuicja', 'Intuicja'],
  ['mechanizm', 'Mechanizm'],
  ['praktyka', 'Praktyka'],
  ['interview', 'Interview'],
  ['test', 'Sprawdź się']
] as const;
type StageId = (typeof STAGES)[number][0];

const MEASURED_BADGE = 'Rzeczywiste wykonanie · PySpark 4.0.1 · local[3]';

/** Zwinięta sekcja: treść zostaje pod nagłówkiem, a kilka sekcji może być otwartych naraz. */
function Deeper({ title, html, badge, children }: { title: string; html?: string[]; badge?: string; children?: React.ReactNode }) {
  return (
    <details className="deeper">
      <summary>{title}</summary>
      <div>
        {badge && <span className="badge">{badge}</span>}
        {children}
        {html?.map((h, i) => <Html as="p" key={i} html={h} />)}
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
          {b.visual === 'keys' && <KeyBars />}
          {b.after && <Html as="p" className="takeaway" html={b.after} />}
          {b.more && <Deeper title={b.more.title} html={b.more.html} />}
          {b.bridge && (
            <Deeper title={`Analogia: ${b.bridge.from}`}>
              <ConceptBridge bridge={b.bridge} />
            </Deeper>
          )}
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

function ScenarioCard({ n, s }: { n: number; s: Scenario }) {
  const [picked, setPicked] = useState<number | null>(null);
  return (
    <div className="obs">
      <span className="num">SYTUACJA {n}</span>
      <p className="ask">{s.setup}</p>
      <p className="muted" style={{ marginBottom: 12 }}>{troubleshoot.ask}</p>
      <div className="choices quiz-choices">
        {s.options.map((c, i) => (
          <button key={c} type="button" className={`choice${picked === null ? '' : i === s.correct ? ' ok' : i === picked ? ' no' : ''}`} disabled={picked !== null} onClick={() => setPicked(i)}>
            {c}
          </button>
        ))}
      </div>
      {picked !== null && (
        <div className="reveal on">
          <p className={`verdict ${picked === s.correct ? 'ok' : 'no'}`}>{picked === s.correct ? 'Tak, od tego warto zacząć.' : 'Jest lepszy pierwszy krok.'}</p>
          <p>{s.why}</p>
          <p className="scope">
            <b>Zakres.</b> <span>{s.scope}</span>
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
  const bank = interviewTopics.flatMap(topic => questions.filter(q => q.topicId === topic));
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
      {/* Wszystkie pytania są zamontowane, żeby wybrany język i rozwinięte follow-upy przetrwały przełączenie. */}
      {bank.map((q, i) => (
        <div key={q.id} hidden={i !== current}>
          <BankQuestion q={q} />
        </div>
      ))}

      <div className="sect">
        <h3>Gdy znasz to z labu, a nie z produkcji</h3>
        <p>{interview.honestIntro}</p>
        <p className="answer" lang="en" style={{ fontSize: 19 }}>{interview.honestEn}</p>
        <p className="small">{interview.honestPl}</p>
      </div>

      <div className="sect">
        <h3>Te pytania w Interview Banku</h3>
        <p className="muted">Te same odpowiedzi do powtórek, z wyjaśnieniem mechanizmu i typowymi błędami.</p>
        <p className="links">
          {bank.map(b => (
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
        <h2>{perfect ? 'Model siedzi.' : good >= 5 ? 'Większość siedzi.' : 'Warto wrócić do mechanizmu.'}</h2>
        <p className="lede">
          {perfect
            ? 'Powiedz teraz na głos odpowiedź na pytanie o data skew z etapu Interview, bez patrzenia.'
            : 'Tam, gdzie się pomyliłeś, wróć do symulacji i ustaw ten przypadek. Zobaczenie go działa lepiej niż ponowne czytanie.'}
        </p>
        <div className="foot" style={{ marginTop: 48 }}>
          <button type="button" className="back" onClick={() => { setRound(round + 1); setIndex(0); setPicks([]); }}>
            Rozwiąż jeszcze raz
          </button>
          {perfect && next ? (
            <a className="cta" style={{ margin: 0, textDecoration: 'none' }} href={href('academy', next.id)}>Następna lekcja: {next.title}</a>
          ) : (
            <button type="button" className="cta" style={{ margin: 0 }} onClick={() => onGo(perfect ? 'interview' : 'mechanizm')}>
              {perfect ? 'Wróć do Interview' : 'Wróć do symulacji'}
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

export function SkewLesson({ stage }: { stage?: string }) {
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
          <Html as="p" html={sim.intro} />
          <SkewSim />
          {sim.takeaway.map((html, i) => <Html as="p" key={i} className="takeaway" html={html} />)}
          <Deeper title={sim.simTitle}>
            <ul className="deeper-list">
              {sim.simNotes.map((note, i) => <li key={i}><Html as="span" html={note} /></li>)}
            </ul>
          </Deeper>
          <Deeper title={sim.measuredTitle} html={sim.measured} badge={MEASURED_BADGE} />

          <section className="unit" aria-labelledby="sk-metrics-title">
            <h2 id="sk-metrics-title">{metrics.title}</h2>
            <Html as="p" html={metrics.intro} />
            <MetricsCases />
            <Html as="p" className="takeaway" html={metrics.takeaway} />
            <CodeExplainer title={metrics.codeTitle} lines={metrics.lines} />
            <Deeper title={metrics.nullTitle} html={metrics.nulls} badge={MEASURED_BADGE} />
            <Deeper title={metrics.otherTitle} html={metrics.other} />
          </section>

          <div className="foot">
            <button type="button" className="back" onClick={() => go('intuicja')}>← Intuicja</button>
            <button type="button" className="cta" style={{ margin: 0 }} onClick={() => go('praktyka')}>Co z tym zrobić?</button>
          </div>
        </div>
      </section>

      <section className="stage" hidden={hidden('praktyka')}>
        <div className="read">
          <p className="eyebrow">Etap 3 · Praktyka</p>
          <h2>{moves.title}</h2>
          {moves.intro.map((html, i) => <Html as="p" key={i} html={html} />)}
          <AqeMoves />
          <Html as="p" className="takeaway" html={moves.takeaway} />
          <Deeper title={moves.planTitle} html={moves.plan} />
          <Deeper title={moves.bridgeTitle}>
            <ConceptBridge bridge={moves.bridge} />
          </Deeper>

          <section className="unit" aria-labelledby="sk-limits-title">
            <h2 id="sk-limits-title">{limits.title}</h2>
            <p>{limits.intro}</p>
            <AqeLimits />
            <Html as="p" className="takeaway" html={limits.takeaway} />
            <Deeper title={limits.measuredTitle} html={limits.measured} badge={MEASURED_BADGE} />
            <Deeper title={limits.tuneTitle} html={limits.tune} />
          </section>

          <section className="unit" aria-labelledby="sk-salt-title">
            <h2 id="sk-salt-title">{salting.title}</h2>
            <Html as="p" html={salting.intro} />
            <CodeExplainer title={salting.codeTitle} lines={salting.lines} />
            <Html as="p" className="takeaway" html={salting.takeaway} />
            <Deeper title={salting.measuredTitle} html={salting.measured} badge={MEASURED_BADGE} />
            <Deeper title={salting.moreTitle} html={salting.more} />
          </section>

          <section className="unit" aria-labelledby="sk-lab-title">
            <h2 id="sk-lab-title">{lab.title}</h2>
            <Html as="p" html={lab.intro} />
            <LabRunner labId={labId} hint={lab.hint} />
            <span className="badge">{MEASURED_BADGE} · uruchomienie autora</span>
            <p className="viz-k">{lab.tableTitle}</p>
            <table className="data sk-table">
              <thead><tr>{lab.columns.map(c => <th key={c}>{c}</th>)}</tr></thead>
              <tbody>
                {lab.rows.map(r => (
                  <tr key={r[0]}>{r.map((v, i) => <td key={i}>{v}</td>)}</tr>
                ))}
              </tbody>
            </table>
            <Html as="p" className="small" html={lab.note} />
          </section>

          <section className="unit" aria-labelledby="sk-trouble-title">
            <h2 id="sk-trouble-title">{troubleshoot.title}</h2>
            <p>{troubleshoot.intro}</p>
            {troubleshoot.cases.map((s, i) => <ScenarioCard key={i} n={i + 1} s={s} />)}
            <Html as="p" className="takeaway unit-end" html={troubleshoot.takeaway} />
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

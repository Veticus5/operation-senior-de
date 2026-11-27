import { useEffect, useRef, useState } from 'react';
import { beats, choose, cost, experiments, interview, labHint, labId, meta, orders, plan, quiz, relatedQuestionIds, rowsPerPartition, sim, sizing, type Experiment } from '@content/spark/partitioning-shuffle/lesson';
import { lessons, questions, questionsByTopic, type Question } from '@content/index';
import { CodeExplainer } from '../../components/CodeExplainer';
import { ConceptBridge } from '../../components/ConceptBridge';
import { Html } from '../../components/Html';
import { LabRunner } from '../../components/LabRunner';
import { href, navigate } from '../../lib/router';
import { useProgress } from '../../lib/useProgress';
import { ShuffleSim } from './ShuffleSim';
import { PartitionSizer, PartitionsPeek, ShuffleCost } from './Visuals';

const STAGES = [
  ['intuicja', 'Intuicja'],
  ['mechanizm', 'Mechanizm'],
  ['praktyka', 'Praktyka'],
  ['interview', 'Interview'],
  ['test', 'Sprawdź się']
] as const;
type StageId = (typeof STAGES)[number][0];

/** Zwinięta sekcja: treść zostaje pod nagłówkiem, a kilka sekcji może być otwartych naraz. */
function Deeper({ title, html, children }: { title: string; html?: string[]; children?: React.ReactNode }) {
  return (
    <details className="deeper">
      <summary>{title}</summary>
      <div>
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
          {b.visual === 'peek' && <PartitionsPeek />}
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
          <pre className="code psh-out">{e.output}</pre>
          {e.notes.map((note, i) => <Html as="p" key={i} html={note} />)}
          <p className="scope">
            <b>Zakres tego wyniku.</b> <Html as="span" html={e.scope} />
          </p>
          {e.more && <Deeper title={e.more.title} html={e.more.html} />}
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
  const bank = [...questionsByTopic(meta.topicId), ...questions.filter(q => relatedQuestionIds.includes(q.id))];
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
      {/* Oba pytania są zamontowane, żeby wybrany język i rozwinięte follow-upy przetrwały przełączenie. */}
      {bank.map((q, i) => (
        <div key={q.id} hidden={i !== current}>
          <BankQuestion q={q} />
        </div>
      ))}

      <div className="sect">
        <h3>Most do tego, co już znasz</h3>
        <p>{interview.bridgeIntro}</p>
        <p className="answer" lang="en" style={{ fontSize: 19 }}>{interview.bridgeEn}</p>
        <p className="small">{interview.bridgePl}</p>
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
        <h2>{perfect ? 'Model siedzi.' : good >= 4 ? 'Większość siedzi.' : 'Warto wrócić do mechanizmu.'}</h2>
        <p className="lede">
          {perfect
            ? 'Powiedz teraz na głos odpowiedź o narrow, wide i shuffle z etapu Interview, bez patrzenia.'
            : 'Tam, gdzie się pomyliłeś, wróć do symulacji i uruchom tę operację. Zobaczenie jej działa lepiej niż ponowne czytanie.'}
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
        {!perfect && next && (
          <p className="small" style={{ marginTop: 24 }}>
            Następna lekcja: <a href={href('academy', next.id)}>{next.title}</a>
          </p>
        )}
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
      {item.setup && <Html as="p" className="muted" html={item.setup} />}
      <div className="choices quiz-choices">
        {item.options.map((o, i) => (
          <button key={o} type="button" className={`choice${!answered ? '' : i === item.correct ? ' ok' : i === picked ? ' no' : ''}`} disabled={answered} onClick={() => setPicks([...picks.slice(0, index), i])}>
            <Html as="span" html={o} />
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

export function PartitioningLesson({ stage }: { stage?: string }) {
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
          <ShuffleSim />
          {sim.takeaway.map((html, i) => <Html as="p" key={i} className="takeaway" html={html} />)}
          <Deeper title={sim.notesTitle}>
            <ul className="deeper-list">
              {sim.notes.map((note, i) => <li key={i}><Html as="span" html={note} /></li>)}
            </ul>
          </Deeper>
          <Deeper title={sim.waysTitle} html={sim.ways}>
            <span className="badge">Rzeczywiste wykonanie · PySpark 4.0.1 · local[3]</span>
          </Deeper>

          <section className="unit" aria-labelledby="psh-cost-title">
            <h2 id="psh-cost-title">{cost.title}</h2>
            <p>{cost.intro}</p>
            <ShuffleCost />
            <Html as="p" className="takeaway" html={cost.takeaway} />
            <Deeper title={cost.uiTitle} html={cost.ui} />
            <Deeper title={cost.partialTitle} html={cost.partial}>
              <span className="badge">Rzeczywiste wykonanie · PySpark 4.0.1 · local[3]</span>
            </Deeper>
            <Deeper title={cost.avoidTitle} html={cost.avoid} />
          </section>

          <section className="unit" aria-labelledby="psh-plan-title">
            <h2 id="psh-plan-title">{plan.title}</h2>
            <Html as="p" html={plan.intro} />
            <span className="badge">{plan.badge}</span>
            <CodeExplainer title={plan.codeTitle} lines={plan.lines} order="bottom-up" />
            <Html as="p" className="takeaway" html={plan.takeaway} />
            <Deeper title={plan.stageTitle} html={plan.stage} />
          </section>

          <div className="foot">
            <button type="button" className="back" onClick={() => go('intuicja')}>← Intuicja</button>
            <button type="button" className="cta" style={{ margin: 0 }} onClick={() => go('praktyka')}>Ile partycji to dobrze?</button>
          </div>
        </div>
      </section>

      <section className="stage" hidden={hidden('praktyka')}>
        <div className="read">
          <p className="eyebrow">Etap 3 · Praktyka</p>
          <h2>{sizing.title}</h2>
          <Html as="p" html={sizing.intro} />
          <PartitionSizer />
          {sizing.takeaway.map((html, i) => <Html as="p" key={i} className="takeaway" html={html} />)}
          <Deeper title={sizing.aqeTitle} html={sizing.aqe} />
          <Deeper title={sizing.bridgeTitle}>
            <ConceptBridge bridge={sizing.bridge} />
          </Deeper>

          <section className="unit" aria-labelledby="psh-choose-title">
            <h2 id="psh-choose-title">{choose.title}</h2>
            <p>{choose.intro}</p>
            <table className="data psh-table">
              <thead><tr><th /><th>repartition</th><th>coalesce</th></tr></thead>
              <tbody>
                {choose.rows.map(r => (
                  <tr key={r.k}><th scope="row">{r.k}</th><td>{r.repartition}</td><td>{r.coalesce}</td></tr>
                ))}
              </tbody>
            </table>
            <Html as="p" className="takeaway" html={choose.takeaway} />
            <Html as="p" className="takeaway" html={choose.filesNote} />
            <Deeper title={choose.hintsTitle} html={choose.hints} />
          </section>

          <section className="unit" aria-labelledby="psh-lab-title">
            <h2 id="psh-lab-title">To samo na prawdziwym Sparku</h2>
            <p className="lede">Jeden skrypt, te same 12 zamówień. Każdy wydruk poniżej to wynik jego uruchomienia, nie symulacja.</p>
            <span className="badge">Rzeczywiste wykonanie · PySpark 4.0.1 · local[3]</span>
            <p className="small" style={{ maxWidth: '64ch' }}>
              <code>local[3]</code> to jeden proces z trzema wątkami na jednej maszynie. Nie ma sieci ani osobnych executorów, więc shuffle zapisuje pliki na lokalny dysk i ten sam proces je czyta. Liczby rekordów, stage&apos;y i tasków pokazują mechanizm. Kosztu sieci tu nie zobaczysz.
            </p>
            <h3 style={{ marginTop: 36 }}>Dane wejściowe</h3>
            <table className="data">
              <thead><tr><th>partycja</th><th>order_id</th><th>country</th><th>amount</th></tr></thead>
              <tbody>
                {orders.map((o, i) => (
                  <tr key={o.id}><td>{Math.floor(i / rowsPerPartition)}</td><td>{o.id}</td><td>{o.country}</td><td>{o.amount}</td></tr>
                ))}
              </tbody>
            </table>
            <h3>Skrypt</h3>
            <LabRunner labId={labId} hint={labHint} />
            <p className="muted">Zanim przewiniesz dalej: przy każdym eksperymencie najpierw zgadnij wynik.</p>
            {experiments.map((e, i) => <ExperimentCard key={i} n={i + 1} e={e} />)}
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

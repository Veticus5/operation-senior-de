import { useEffect, useRef, useState } from 'react';
import {
  DOCS_BADGE, access, beats, cache, caseStudy, clustering, cost, history, interview, interviewTopics, meta, profiles, prune, quiz, scale, stream,
  type Scenario
} from '@content/snowflake/architecture/lesson';
import { lessons, questions, type Bridge, type Question } from '@content/index';
import { CodeExplainer } from '../../components/CodeExplainer';
import { ConceptBridge } from '../../components/ConceptBridge';
import { Html } from '../../components/Html';
import { href, navigate } from '../../lib/router';
import { useProgress } from '../../lib/useProgress';
import { CacheSim, CloneSteps, Coverage, Layers, ProfileCard, PruneSim, Retention, RoleTree, ScaleSim, StreamSim } from './Visuals';
import './snowflake.css';

const STAGES = [
  ['intuicja', 'Intuicja'],
  ['mechanizm', 'Mechanizm'],
  ['wydajnosc', 'Wydajność'],
  ['produkcja', 'Koszt i produkcja'],
  ['interview', 'Interview'],
  ['test', 'Sprawdź się']
] as const;
type StageId = (typeof STAGES)[number][0];

const HERE = 'W Snowflake';

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

function BridgeBox({ title, bridge }: { title: string; bridge: Bridge }) {
  return (
    <Deeper title={title}>
      <ConceptBridge bridge={bridge} here={HERE} />
    </Deeper>
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
          {b.visual === 'layers' && <Layers />}
          {b.after && <Html as="p" className="takeaway" html={b.after} />}
          {b.more && <Deeper title={b.more.title} html={b.more.html} badge={DOCS_BADGE} />}
          {b.bridge && <BridgeBox title={`Analogia: ${b.bridge.from}`} bridge={b.bridge} />}
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

function ScenarioCard({ n, s, ask }: { n: number; s: Scenario; ask: string }) {
  const [picked, setPicked] = useState<number | null>(null);
  return (
    <div className="obs">
      <span className="num">SYTUACJA {n}</span>
      <p className="ask">{s.setup}</p>
      <p className="muted" style={{ marginBottom: 12 }}>{ask}</p>
      <div className="choices quiz-choices">
        {s.options.map((c, i) => (
          <button key={c} type="button" className={`choice${picked === null ? '' : i === s.correct ? ' ok' : i === picked ? ' no' : ''}`} disabled={picked !== null} onClick={() => setPicked(i)}>
            {c}
          </button>
        ))}
      </div>
      {picked !== null && (
        <div className="reveal on">
          <p className={`verdict ${picked === s.correct ? 'ok' : 'no'}`}>{picked === s.correct ? 'Zgadza się.' : 'Tu lepiej inaczej.'}</p>
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
      <p className="eyebrow">Etap 5 · Interview</p>
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
        <h3>{interview.storyTitle}</h3>
        <p>{interview.storyIntro}</p>
        <p className="answer" lang="en" style={{ fontSize: 19 }}>{interview.storyEn}</p>
        <p className="small">{interview.storyPl}</p>
        <ul className="deeper-list">
          {interview.storyTips.map(t => <li key={t}>{t}</li>)}
        </ul>
      </div>

      <div className="sect">
        <h3>{interview.mythsTitle}</h3>
        <ul className="sf-myths">
          {interview.myths.map(([myth, fix]) => (
            <li key={myth}><b>{myth}</b><span>{fix}</span></li>
          ))}
        </ul>
      </div>

      <div className="sect">
        <h3>{interview.compareTitle}</h3>
        <p>{interview.compareIntro}</p>
        <div className="sf-scroll">
          <table className="data sf-wide">
            <thead><tr>{interview.compareColumns.map(c => <th key={c}>{c}</th>)}</tr></thead>
            <tbody>
              {interview.compare.map(r => <tr key={r[0]}>{r.map((v, i) => <td key={i}>{v}</td>)}</tr>)}
            </tbody>
          </table>
        </div>
        <p className="small">{interview.compareNote}</p>
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
        <h2>{perfect ? 'Model siedzi.' : good >= 7 ? 'Większość siedzi.' : 'Warto wrócić do mechanizmu.'}</h2>
        <p className="lede">
          {perfect
            ? 'Powiedz teraz na głos odpowiedź na pytanie o architekturę z etapu Interview, bez patrzenia.'
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

export function SnowflakeLesson({ stage }: { stage?: string }) {
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

      {/* Wszystkie etapy są zamontowane, żeby stan (symulacje, odsłonięte fragmenty, odpowiedzi) przetrwał przełączanie. */}
      <section className="stage" hidden={hidden('intuicja')}>
        <Intuition onNext={() => go('mechanizm')} />
      </section>

      <section className="stage" hidden={hidden('mechanizm')}>
        <div className="read">
          <p className="eyebrow">Etap 2 · Mechanizm</p>
          <h2>{prune.question}</h2>
          {prune.intro.map((html, i) => <Html as="p" key={i} html={html} />)}
          <PruneSim />
          {prune.takeaway.map((html, i) => <Html as="p" key={i} className="takeaway" html={html} />)}
          <Deeper title={prune.notesTitle}>
            <ul className="deeper-list">
              {prune.notes.map((note, i) => <li key={i}><Html as="span" html={note} /></li>)}
            </ul>
          </Deeper>
          <Deeper title={prune.columnarTitle} html={prune.columnar} badge={DOCS_BADGE} />
          <Deeper title={prune.dmlTitle} html={prune.dml} />
          <BridgeBox title={prune.bridgeTitle} bridge={prune.bridge} />

          <section className="unit" aria-labelledby="sf-clustering-title">
            <h2 id="sf-clustering-title">{clustering.title}</h2>
            {clustering.intro.map((html, i) => <Html as="p" key={i} html={html} />)}
            {clustering.cases.map((s, i) => <ScenarioCard key={i} n={i + 1} s={s} ask={clustering.ask} />)}
            <Html as="p" className="takeaway unit-end" html={clustering.takeaway} />
            <Deeper title={clustering.keyTitle} html={clustering.key} badge={DOCS_BADGE} />
            <Deeper title={clustering.costTitle} html={clustering.cost} badge={DOCS_BADGE} />
            <BridgeBox title={clustering.bridgeTitle} bridge={clustering.bridge} />
          </section>

          <section className="unit" aria-labelledby="sf-cache-title">
            <h2 id="sf-cache-title">{cache.title}</h2>
            <p>{cache.intro}</p>
            <CacheSim />
            {cache.takeaway.map((html, i) => <Html as="p" key={i} className="takeaway" html={html} />)}
            <Deeper title={cache.rulesTitle} html={cache.rules} badge={DOCS_BADGE} />
            <Deeper title={cache.suspendTitle} html={cache.suspend} badge={DOCS_BADGE} />
          </section>

          <div className="foot">
            <button type="button" className="back" onClick={() => go('intuicja')}>← Intuicja</button>
            <button type="button" className="cta" style={{ margin: 0 }} onClick={() => go('wydajnosc')}>A gdy zapytanie jest wolne?</button>
          </div>
        </div>
      </section>

      <section className="stage" hidden={hidden('wydajnosc')}>
        <div className="read">
          <p className="eyebrow">Etap 3 · Wydajność</p>
          <h2>{profiles.title}</h2>
          {profiles.intro.map((html, i) => <Html as="p" key={i} html={html} />)}
          <span className="badge sim">Ilustracja · nie pomiar</span>
          <p className="small viz-assume">{profiles.assumptions}</p>
          {profiles.cases.map(c => <ProfileCard key={c.id} c={c} />)}
          <Html as="p" className="takeaway unit-end" html={profiles.takeaway} />
          <Deeper title={profiles.listTitle} html={profiles.list} badge={DOCS_BADGE} />
          <Deeper title={profiles.timeTitle} html={profiles.time} badge={DOCS_BADGE} />
          <CodeExplainer title={profiles.codeTitle} lines={profiles.lines} />

          <section className="unit" aria-labelledby="sf-scale-title">
            <h2 id="sf-scale-title">{scale.title}</h2>
            <Html as="p" html={scale.intro} />
            <ScaleSim />
            {scale.takeaway.map((html, i) => <Html as="p" key={i} className="takeaway" html={html} />)}
            <Deeper title={scale.notesTitle}>
              <ul className="deeper-list">
                {scale.notes.map((note, i) => <li key={i}>{note}</li>)}
              </ul>
            </Deeper>
            <Deeper title={scale.sizesTitle} badge={DOCS_BADGE}>
              <p className="sf-sizes">
                {scale.sizes.map(([name, rate]) => <span key={name}>{name}<b>{rate}</b></span>)}
              </p>
              <p>{scale.sizesNote}</p>
            </Deeper>
            <Deeper title={scale.resizeTitle} html={scale.resize} badge={DOCS_BADGE} />
            <Deeper title={scale.multiTitle} html={scale.multi} badge={DOCS_BADGE} />
            <Deeper title={scale.qasTitle} html={scale.qas} badge={DOCS_BADGE} />
          </section>

          <section className="unit" aria-labelledby="sf-case-title">
            <h2 id="sf-case-title">{caseStudy.title}</h2>
            {caseStudy.intro.map((html, i) => <Html as="p" key={i} html={html} />)}
            <span className="badge sim">{caseStudy.badge}</span>
            <ol className="sf-steps">
              {caseStudy.steps.map(s => (
                <li key={s.title}>
                  <h3>{s.title}</h3>
                  <p>{s.text}</p>
                  <Deeper title="Dlaczego tak" html={[s.more]} />
                </li>
              ))}
            </ol>
            <Html as="p" className="takeaway unit-end" html={caseStudy.takeaway} />
          </section>

          <div className="foot">
            <button type="button" className="back" onClick={() => go('mechanizm')}>← Mechanizm</button>
            <button type="button" className="cta" style={{ margin: 0 }} onClick={() => go('produkcja')}>Ile to kosztuje i jak tym zarządzać?</button>
          </div>
        </div>
      </section>

      <section className="stage" hidden={hidden('produkcja')}>
        <div className="read">
          <p className="eyebrow">Etap 4 · Koszt i produkcja</p>
          <h2>{cost.title}</h2>
          {cost.intro.map((html, i) => <Html as="p" key={i} html={html} />)}
          <Coverage />
          <Html as="p" className="takeaway" html={cost.takeaway} />
          <Deeper title={cost.monitorTitle} html={cost.monitor} badge={DOCS_BADGE} />
          <Deeper title={cost.budgetTitle} html={cost.budget} badge={DOCS_BADGE} />
          <Deeper title={cost.storageTitle} html={cost.storage} badge={DOCS_BADGE} />
          <Deeper title={cost.leversTitle} html={cost.levers} />

          <section className="unit" aria-labelledby="sf-stream-title">
            <h2 id="sf-stream-title">{stream.title}</h2>
            {stream.intro.map((html, i) => <Html as="p" key={i} html={html} />)}
            <StreamSim />
            {stream.takeaway.map((html, i) => <Html as="p" key={i} className="takeaway" html={html} />)}
            <CodeExplainer title={stream.codeTitle} lines={stream.lines} />
            <Deeper title={stream.riskTitle} html={stream.risks} badge={DOCS_BADGE} />
            <Deeper title={stream.typesTitle} html={stream.types} badge={DOCS_BADGE} />
            <Deeper title={stream.dynamicTitle} html={stream.dynamic} badge={DOCS_BADGE} />
            <BridgeBox title={stream.bridgeTitle} bridge={stream.bridge} />
          </section>

          <section className="unit" aria-labelledby="sf-history-title">
            <h2 id="sf-history-title">{history.title}</h2>
            {history.intro.map((html, i) => <p key={i}>{html}</p>)}
            <Retention />
            <Html as="p" className="takeaway" html={history.takeaway} />
            <Deeper title={history.detailTitle} html={history.detail} badge={DOCS_BADGE} />
            <h3 style={{ marginTop: 56 }}>{history.cloneTitle}</h3>
            <p>{history.cloneIntro}</p>
            <CloneSteps />
            <Html as="p" className="takeaway" html={history.cloneTakeaway} />
            <Deeper title={history.cloneMoreTitle} html={history.cloneMore} badge={DOCS_BADGE} />
          </section>

          <section className="unit" aria-labelledby="sf-access-title">
            <h2 id="sf-access-title">{access.title}</h2>
            {access.intro.map((html, i) => <Html as="p" key={i} html={html} />)}
            <RoleTree />
            <Html as="p" className="takeaway" html={access.takeaway} />
            <Deeper title={access.adminTitle} html={access.admin} badge={DOCS_BADGE} />
            <Deeper title={access.tenantTitle}>
              <p>{access.tenantIntro}</p>
              <div className="sf-scroll">
                <table className="data sf-wide">
                  <thead><tr>{access.tenantColumns.map(c => <th key={c}>{c}</th>)}</tr></thead>
                  <tbody>
                    {access.tenants.map(r => <tr key={r[0]}>{r.map((v, i) => <td key={i}>{v}</td>)}</tr>)}
                  </tbody>
                </table>
              </div>
              {access.tenantNotes.map((h, i) => <Html as="p" key={i} html={h} />)}
            </Deeper>
            <Deeper title={access.shareTitle} html={access.share} badge={DOCS_BADGE} />
          </section>

          <div className="foot">
            <button type="button" className="back" onClick={() => go('wydajnosc')}>← Wydajność</button>
            <button type="button" className="cta" style={{ margin: 0 }} onClick={() => go('interview')}>Teraz ułóż z tego odpowiedź</button>
          </div>
        </div>
      </section>

      <section className="stage" hidden={hidden('interview')}>
        <div className="read">
          <Interview />
          <div className="foot">
            <button type="button" className="back" onClick={() => go('produkcja')}>← Koszt i produkcja</button>
            <button type="button" className="cta" style={{ margin: 0 }} onClick={() => go('test')}>Sprawdź, czy to siedzi</button>
          </div>
        </div>
      </section>

      <section className="stage" hidden={hidden('test')}>
        <div className="read">
          <p className="eyebrow">Etap 6 · Sprawdź się{progress.lessonCompleted(meta.id) ? ' · lekcja ukończona' : ''}</p>
          <Quiz onFinished={() => progress.setLessonCompleted(meta.id, true)} onGo={go} />
        </div>
      </section>
    </>
  );
}

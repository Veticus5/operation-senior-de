import { useState } from 'react';
import { architecture, interviewTopics, meta, pipelines, practice, scale, streaming, trust, type More } from '@content/platform/production-platform-design/lesson';
import type { DesignStep } from '@content/platform/production-platform-design/practice';
import { lessons, questions, type Bridge, type Question } from '@content/index';
import { CodeExplainer } from '../../components/CodeExplainer';
import { ConceptBridge } from '../../components/ConceptBridge';
import { Html } from '../../components/Html';
import { href, navigate } from '../../lib/router';
import { useProgress } from '../../lib/useProgress';
import { ArchMap, LayerRecords } from './Architecture';
import { CompareView, Deeper, ScenarioCard } from './Parts';
import { BackfillScenario, DagGate, DedupExercise, HwmSim, RetrySim } from './Pipelines';
import { IncidentMatrix, RoleView, SemanticsSim, SloBudget, WindowSim, WorkloadSim } from './Visuals';
import './platform.css';

const STAGES = [
  ['architektura', 'Architektura'],
  ['ladowanie', 'Ładowanie'],
  ['skala', 'Skala'],
  ['zaufanie', 'Zaufanie'],
  ['streaming', 'Streaming'],
  ['interview', 'Interview'],
  ['test', 'Sprawdź się']
] as const;
type StageId = (typeof STAGES)[number][0];

const { quiz, failures, design, interview } = practice;

const MoreBox = ({ more }: { more: More }) => <Deeper title={more.title} html={more.html} />;
const BridgeBox = ({ bridge }: { bridge: Bridge }) => (
  <Deeper title={`Analogia: ${bridge.from}`}>
    <ConceptBridge bridge={bridge} here="Tutaj" />
  </Deeper>
);

/** Jedna jednostka lekcji: pytanie w nagłówku, potem treść. */
function Unit({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section className="unit" aria-labelledby={`pd-${id}`}>
      <h2 id={`pd-${id}`}>{title}</h2>
      {children}
    </section>
  );
}

function Foot({ back, next, onGo }: { back?: [StageId, string]; next: [StageId, string]; onGo: (s: string) => void }) {
  return (
    <div className="foot">
      {back ? <button type="button" className="back" onClick={() => onGo(back[0])}>← {back[1]}</button> : <span />}
      <button type="button" className="cta" style={{ margin: 0 }} onClick={() => onGo(next[0])}>{next[1]}</button>
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

/** Krok zadania projektowego. Rozwiązanie wzorcowe da się odsłonić dopiero po wpisaniu własnej odpowiedzi. */
function DesignStepCard({ step }: { step: DesignStep }) {
  const [text, setText] = useState('');
  const [open, setOpen] = useState(false);
  const ready = text.trim().length >= design.minChars;
  const id = `pd-design-${step.id}`;
  return (
    <div className="obs pd-design">
      <span className="num">{step.title.toUpperCase()}</span>
      <p className="ask" lang="en">{step.task}</p>
      <p className="muted">{step.hint}</p>
      <label className="sr" htmlFor={id}>{step.title}: Twoja odpowiedź</label>
      <textarea id={id} className="pd-answer" rows={7} value={text} placeholder={design.placeholder} onChange={e => setText(e.target.value)} />
      {!open && (
        <div className="pd-actions">
          <button type="button" className="op act" disabled={!ready} onClick={() => setOpen(true)}>{design.reveal}</button>
          {!ready && <span className="small" role="status">{design.locked} ({text.trim().length} / {design.minChars} znaków)</span>}
        </div>
      )}
      {open && (
        <div className="reveal on">
          <p className="viz-k">Rozwiązanie wzorcowe · porównaj ze swoim</p>
          <ul className="deeper-list pd-solution">
            {step.solution.map((s, i) => <li key={i}><Html as="span" html={s} /></li>)}
          </ul>
          <p className="scope"><b>Na co patrzy rekruter.</b> <span>{step.watch}</span></p>
        </div>
      )}
    </div>
  );
}

function Interview() {
  // Pytania, krótkie odpowiedzi i follow-upy mają jedno źródło: Interview Bank.
  const bank = interviewTopics.flatMap(topic => questions.filter(q => q.topicId === topic));
  const [current, setCurrent] = useState(0);
  if (!bank.length) return null;
  return (
    <>
      <p className="eyebrow">Etap 6 · Interview</p>
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
        <h3>{failures.title}</h3>
        <p className="muted">{failures.intro}</p>
        {failures.items.map(f => (
          <details className="fu" key={f.q}>
            <summary><span lang="en">{f.q}</span></summary>
            <div className="a">
              <p lang="en">{f.a}</p>
              <p className="pl">{f.pl}</p>
            </div>
          </details>
        ))}
      </div>

      <div className="sect">
        <h3>{design.title}</h3>
        <p>{design.intro}</p>
        <p className="answer pd-prompt" lang="en">{design.prompt}</p>
        <p className="small">{design.promptPl}</p>
        {design.steps.map(s => <DesignStepCard key={s.id} step={s} />)}
        <p className="takeaway unit-end">{design.closing}</p>
      </div>

      <div className="sect">
        <h3>Gdy części nie znasz z własnego wdrożenia</h3>
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
        <h2>{perfect ? 'Model siedzi.' : good >= 7 ? 'Większość siedzi.' : 'Warto wrócić do symulacji.'}</h2>
        <p className="lede">
          {perfect
            ? 'Wróć teraz do zadania projektowego w etapie Interview i powiedz swoje rozwiązanie na głos, po angielsku, w dwie minuty.'
            : 'Tam, gdzie się pomyliłeś, wróć do symulacji i ustaw ten przypadek. Zobaczenie go działa lepiej niż ponowne czytanie.'}
        </p>
        <div className="foot" style={{ marginTop: 48 }}>
          <button type="button" className="back" onClick={() => { setRound(round + 1); setIndex(0); setPicks([]); }}>
            Rozwiąż jeszcze raz
          </button>
          {perfect && next ? (
            <a className="cta" style={{ margin: 0, textDecoration: 'none' }} href={href('academy', next.id)}>Następna lekcja: {next.title}</a>
          ) : (
            <button type="button" className="cta" style={{ margin: 0 }} onClick={() => onGo(perfect ? 'interview' : 'ladowanie')}>
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

export function PlatformLesson({ stage }: { stage?: string }) {
  const progress = useProgress();
  const cur: StageId = STAGES.some(s => s[0] === stage) ? (stage as StageId) : 'architektura';
  const go = (s: string) => { navigate('academy', meta.id, s); window.scrollTo(0, 0); };
  const hidden = (id: StageId) => cur !== id;
  const a = architecture;
  const p = pipelines;

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

      {/* Wszystkie etapy są zamontowane, żeby stan (symulacje, odpowiedzi, wpisany tekst) przetrwał przełączanie. */}
      <section className="stage" hidden={hidden('architektura')}>
        <div className="read">
          <p className="eyebrow">Etap 1 · Architektura</p>
          <Html html={a.opening.html} />
          <h2>{a.map.question}</h2>
          <p>{a.map.intro}</p>
          <ArchMap />
          <Html as="p" className="takeaway" html={a.map.takeaway} />
          <MoreBox more={a.map.more} />

          <Unit id="layers" title={a.layers.title}>
            <Html as="p" html={a.layers.intro} />
            <LayerRecords />
            <Html as="p" className="takeaway" html={a.layers.takeaway} />
            <MoreBox more={a.layers.more} />
            <BridgeBox bridge={a.layers.bridge} />
          </Unit>

          <Unit id="schema" title={a.schema.title}>
            <p>{a.schema.intro}</p>
            <CompareView data={a.schema} badge="Ilustracja · zachowanie zaprojektowane dla przykładu" />
            <Html as="p" className="takeaway" html={a.schema.takeaway} />
            <MoreBox more={a.schema.more} />
          </Unit>

          <Unit id="fewer" title={a.fewer.title}>
            <p>{a.fewer.intro}</p>
            {a.fewer.cases.map((s, i) => <ScenarioCard key={i} n={i + 1} s={s} ask={a.fewer.ask} />)}
            <Html as="p" className="takeaway unit-end" html={a.fewer.takeaway} />
          </Unit>

          <Foot next={['ladowanie', 'Jak dane trafiają na platformę?']} onGo={go} />
        </div>
      </section>

      <section className="stage" hidden={hidden('ladowanie')}>
        <div className="read">
          <p className="eyebrow">Etap 2 · Ładowanie</p>
          <h2>{p.strategies.title}</h2>
          <Html as="p" html={p.strategies.intro} />
          <CompareView data={p.strategies} />
          <Html as="p" className="takeaway" html={p.strategies.takeaway} />

          <Unit id="hwm" title={p.hwm.title}>
            <Html as="p" html={p.hwm.intro} />
            <HwmSim />
            <Html as="p" className="takeaway" html={p.hwm.takeaway} />
            <MoreBox more={p.hwm.more} />
            <BridgeBox bridge={p.hwm.bridge} />
          </Unit>

          <Unit id="api" title={p.api.title}>
            <p>{p.api.intro}</p>
            <CodeExplainer title={p.api.codeTitle} lines={p.api.lines} />
            <Html as="p" className="takeaway" html={p.api.takeaway} />
            <MoreBox more={p.api.more} />
          </Unit>

          <Unit id="retry" title={p.retry.title}>
            <p>{p.retry.intro}</p>
            <RetrySim />
            <Html as="p" className="takeaway" html={p.retry.takeaway} />
            <MoreBox more={p.retry.more} />
          </Unit>

          <Unit id="dedup" title={p.dedup.title}>
            <Html as="p" html={p.dedup.intro} />
            <DedupExercise />
            <Html as="p" className="takeaway" html={p.dedup.takeaway} />
            <Deeper title={p.dedup.codeTitle}>
              <CodeExplainer title={p.dedup.codeTitle} lines={p.dedup.lines} />
            </Deeper>
          </Unit>

          <Unit id="backfill" title={p.backfill.title}>
            <Html as="p" html={p.backfill.intro} />
            <BackfillScenario />
            <Html as="p" className="takeaway" html={p.backfill.takeaway} />
            <MoreBox more={p.backfill.more} />
          </Unit>

          <Unit id="dag" title={p.dag.title}>
            <p>{p.dag.intro}</p>
            <DagGate />
            <Html as="p" className="takeaway" html={p.dag.takeaway} />
            <MoreBox more={p.dag.more} />
          </Unit>

          <Foot back={['architektura', 'Architektura']} next={['skala', 'A gdy danych i ludzi przybywa?']} onGo={go} />
        </div>
      </section>

      <section className="stage" hidden={hidden('skala')}>
        <div className="read">
          <p className="eyebrow">Etap 3 · Skala</p>
          <Html html={scale.opening.html} />
          <h2>{scale.workload.question}</h2>
          <p>{scale.workload.intro}</p>
          <WorkloadSim />
          <Html as="p" className="takeaway" html={scale.workload.takeaway} />
          <MoreBox more={scale.workload.more} />

          <Unit id="distributed" title={scale.distributed.title}>
            <Html as="p" html={scale.distributed.intro} />
            <ul className="deeper-list pd-points">
              {scale.distributed.points.map((x, i) => <li key={i}><Html as="span" html={x} /></li>)}
            </ul>
            <Html as="p" className="takeaway" html={scale.distributed.takeaway} />
            <MoreBox more={scale.distributed.more} />
          </Unit>

          <Unit id="capacity" title={scale.capacity.title}>
            <p>{scale.capacity.intro}</p>
            <div className="pd-box">
              <span className="badge sim">Rachunek · liczby przykładowe</span>
              <p className="small viz-assume">{scale.capacity.assumptions}</p>
              <div className="pd-scroll">
                <table className="data pd-table">
                  <thead><tr>{scale.capacity.columns.map(c => <th key={c}>{c}</th>)}</tr></thead>
                  <tbody>
                    {scale.capacity.rows.map(r => <tr key={r[0]}>{r.map((v, i) => <td key={i}>{v}</td>)}</tr>)}
                  </tbody>
                </table>
              </div>
            </div>
            <Html as="p" className="takeaway" html={scale.capacity.takeaway} />
          </Unit>

          <Unit id="tenants" title={scale.tenants.title}>
            <Html as="p" html={scale.tenants.intro} />
            <CompareView data={scale.tenants} />
            <Html as="p" className="takeaway" html={scale.tenants.takeaway} />
          </Unit>

          <Foot back={['ladowanie', 'Ładowanie']} next={['zaufanie', 'Skąd wiesz, że dane są dobre?']} onGo={go} />
        </div>
      </section>

      <section className="stage" hidden={hidden('zaufanie')}>
        <div className="read">
          <p className="eyebrow">Etap 4 · Zaufanie</p>
          <Html html={trust.opening.html} />
          <h2>{trust.incidents.question}</h2>
          <p>{trust.incidents.intro}</p>
          <IncidentMatrix />
          <Html as="p" className="takeaway" html={trust.incidents.takeaway} />
          <MoreBox more={trust.incidents.more} />
          <BridgeBox bridge={trust.incidents.bridge} />

          <Unit id="slo" title={trust.slo.title}>
            <Html as="p" html={trust.slo.intro} />
            <SloBudget />
            <Html as="p" className="takeaway" html={trust.slo.takeaway} />
            <MoreBox more={trust.slo.more} />
          </Unit>

          <Unit id="recovery" title={trust.recovery.title}>
            <Html as="p" html={trust.recovery.intro} />
            <CompareView data={trust.recovery} badge="Porównanie · czasy ilustracyjne" />
            <Html as="p" className="takeaway" html={trust.recovery.takeaway} />
            <MoreBox more={trust.recovery.more} />
          </Unit>

          <Unit id="access" title={trust.access.title}>
            <p>{trust.access.intro}</p>
            <RoleView />
            <Html as="p" className="takeaway" html={trust.access.takeaway} />
            <MoreBox more={trust.access.more} />
          </Unit>

          <Unit id="ownership" title={trust.ownership.title}>
            <ul className="deeper-list pd-points">
              {trust.ownership.points.map((x, i) => <li key={i}><Html as="span" html={x} /></li>)}
            </ul>
            <Html as="p" className="takeaway" html={trust.ownership.takeaway} />
          </Unit>

          <Foot back={['skala', 'Skala']} next={['streaming', 'A jeśli dane mają być od razu?']} onGo={go} />
        </div>
      </section>

      <section className="stage" hidden={hidden('streaming')}>
        <div className="read">
          <p className="eyebrow">Etap 5 · Batch i streaming</p>
          <Html html={streaming.opening.html} />
          <h2>{streaming.modes.title}</h2>
          <Html as="p" html={streaming.modes.intro} />
          <CompareView data={streaming.modes} />
          <Html as="p" className="takeaway" html={streaming.modes.takeaway} />

          <Unit id="needs" title={streaming.needs.title}>
            <p>{streaming.needs.intro}</p>
            {streaming.needs.cases.map((s, i) => <ScenarioCard key={i} n={i + 1} s={s} ask={streaming.needs.ask} />)}
            <Html as="p" className="takeaway unit-end" html={streaming.needs.takeaway} />
          </Unit>

          <Unit id="windows" title={streaming.windows.title}>
            <Html as="p" html={streaming.windows.intro} />
            <WindowSim />
            <Html as="p" className="takeaway" html={streaming.windows.takeaway} />
            <MoreBox more={streaming.windows.more} />
          </Unit>

          <Unit id="semantics" title={streaming.semantics.title}>
            <Html as="p" html={streaming.semantics.intro} />
            <SemanticsSim />
            <Html as="p" className="takeaway" html={streaming.semantics.takeaway} />
            <MoreBox more={streaming.semantics.more} />
            <BridgeBox bridge={streaming.semantics.bridge} />
          </Unit>

          <Foot back={['zaufanie', 'Zaufanie']} next={['interview', 'Teraz ułóż z tego odpowiedź']} onGo={go} />
        </div>
      </section>

      <section className="stage" hidden={hidden('interview')}>
        <div className="read">
          <Interview />
          <Foot back={['streaming', 'Streaming']} next={['test', 'Sprawdź, czy to siedzi']} onGo={go} />
        </div>
      </section>

      <section className="stage" hidden={hidden('test')}>
        <div className="read">
          <p className="eyebrow">Etap 7 · Sprawdź się{progress.lessonCompleted(meta.id) ? ' · lekcja ukończona' : ''}</p>
          <Quiz onFinished={() => progress.setLessonCompleted(meta.id, true)} onGo={go} />
        </div>
      </section>
    </>
  );
}

import { useEffect, useRef, useState } from 'react';
import { acid, architectures, beats, choose, denormalization, design, etl, index, interview, interviewTopics, keys, meta, normalization, plans, pruning, quiz, separation, type Scenario } from '@content/architecture/database-architecture/lesson';
import { lessons, questions, type Question } from '@content/index';
import { CodeExplainer } from '../../components/CodeExplainer';
import { ConceptBridge } from '../../components/ConceptBridge';
import { Html } from '../../components/Html';
import { href, navigate } from '../../lib/router';
import { useProgress } from '../../lib/useProgress';
import { AcidLetters, ArchCompare, CompareTable, DenormCompare, DesignColumns, EtlFlow, IndexSim, IsolationLevels, KeysCheck, NormalizationSteps, PruningSim, SeparationView, StorageSim, Workloads } from './Visuals';
import './database.css';

const STAGES = [
  ['intuicja', 'Intuicja'],
  ['model', 'Model'],
  ['silnik', 'Silnik'],
  ['architektura', 'Architektura'],
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

function BridgeBox({ bridge }: { bridge: Parameters<typeof ConceptBridge>[0]['bridge'] }) {
  return (
    <Deeper title={`Analogia: ${bridge.from}`}>
      <ConceptBridge bridge={bridge} here="W tej lekcji" />
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
          {b.visual === 'workloads' && <Workloads />}
          {b.visual === 'storage' && <StorageSim />}
          {b.after && <Html as="p" className="takeaway" html={b.after} />}
          {b.more && <Deeper title={b.more.title} html={b.more.html} />}
          {b.bridge && <BridgeBox bridge={b.bridge} />}
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
      <p className="muted" style={{ marginBottom: 12 }}>{choose.ask}</p>
      <div className="choices quiz-choices">
        {s.options.map((c, i) => (
          <button key={c} type="button" className={`choice${picked === null ? '' : i === s.correct ? ' ok' : i === picked ? ' no' : ''}`} disabled={picked !== null} onClick={() => setPicked(i)}>
            {c}
          </button>
        ))}
      </div>
      {picked !== null && (
        <div className="reveal on">
          <p className={`verdict ${picked === s.correct ? 'ok' : 'no'}`}>{picked === s.correct ? 'Tak, to dobry punkt wyjścia.' : 'Jest lepszy punkt wyjścia.'}</p>
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
      <div className="sect">
        <h3>Typowe błędy</h3>
        <ul className="deeper-list">{q.mistakes.map(m => <li key={m}>{m}</li>)}</ul>
      </div>
    </>
  );
}

function Interview() {
  // Pytania, krótkie odpowiedzi, follow-upy i typowe błędy mają jedno źródło: Interview Bank.
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
        <h3>{interview.recallTitle}</h3>
        <p className="muted">{interview.recallIntro}</p>
        {interview.recall.map(r => (
          <details className="fu" key={r.prompt}>
            <summary><span lang="en">{r.prompt}</span></summary>
            <div className="a">
              <ul className="deeper-list">{r.points.map(p => <li key={p}>{p}</li>)}</ul>
            </div>
          </details>
        ))}
      </div>

      <div className="sect">
        <h3>Gdy pytają o klasyczną bazę, a Ty pracujesz w hurtowni</h3>
        <p>{interview.honestIntro}</p>
        <p className="answer" lang="en" style={{ fontSize: 19 }}>{interview.honestEn}</p>
        <p className="small">{interview.honestPl}</p>
      </div>

      <div className="sect">
        <h3>Te pytania w Interview Banku</h3>
        <p className="muted">Te same odpowiedzi do powtórek, z wyjaśnieniem mechanizmu.</p>
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
  const [index_, setIndex] = useState(0);
  const [picks, setPicks] = useState<number[]>([]);
  const good = picks.filter((p, i) => p === quiz[i].correct).length;
  const next = lessons[lessons.findIndex(l => l.id === meta.id) + 1];

  if (index_ >= quiz.length) {
    const perfect = good === quiz.length;
    return (
      <div className="task on done-box">
        <p className="score">{good} / {quiz.length}</p>
        <h2>{perfect ? 'Model siedzi.' : good >= 7 ? 'Większość siedzi.' : 'Warto wrócić do ilustracji.'}</h2>
        <p className="lede">
          {perfect
            ? 'Wróć teraz do etapu Interview i odpowiedz na głos na trzy pytania, których najbardziej się obawiasz.'
            : 'Tam, gdzie się pomyliłeś, wróć do odpowiedniej ilustracji i ustaw ten przypadek. Zobaczenie go działa lepiej niż ponowne czytanie.'}
        </p>
        <div className="foot" style={{ marginTop: 48 }}>
          <button type="button" className="back" onClick={() => { setRound(round + 1); setIndex(0); setPicks([]); }}>
            Rozwiąż jeszcze raz
          </button>
          {perfect && next ? (
            <a className="cta" style={{ margin: 0, textDecoration: 'none' }} href={href('academy', next.id)}>Następna lekcja: {next.title}</a>
          ) : (
            <button type="button" className="cta" style={{ margin: 0 }} onClick={() => onGo(perfect ? 'interview' : 'model')}>
              {perfect ? 'Wróć do Interview' : 'Wróć do lekcji'}
            </button>
          )}
        </div>
      </div>
    );
  }

  const item = quiz[index_];
  const picked = picks[index_];
  const answered = picked !== undefined;
  return (
    <div className="task on" key={`${round}-${index_}`}>
      <p className="task-n">PYTANIE {index_ + 1} Z {quiz.length}</p>
      <Html as="div" className="quiz-q" html={`<h2>${item.q}</h2>`} />
      {item.setup && <p className="muted">{item.setup}</p>}
      <div className="choices quiz-choices">
        {item.options.map((o, i) => (
          <button key={o} type="button" className={`choice${!answered ? '' : i === item.correct ? ' ok' : i === picked ? ' no' : ''}`} disabled={answered} onClick={() => setPicks([...picks.slice(0, index_), i])}>
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
          <button type="button" className="cta" style={{ margin: 0 }} onClick={() => { if (index_ === quiz.length - 1) onFinished(); setIndex(index_ + 1); window.scrollTo(0, 0); }}>
            {index_ === quiz.length - 1 ? 'Podsumowanie' : 'Następne pytanie'}
          </button>
        )}
      </div>
    </div>
  );
}

function Unit({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section className="unit" aria-labelledby={id}>
      <h2 id={id}>{title}</h2>
      {children}
    </section>
  );
}

export function DatabaseLesson({ stage }: { stage?: string }) {
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

      {/* Wszystkie etapy są zamontowane, żeby stan (ilustracje, odsłonięte fragmenty, odpowiedzi) przetrwał przełączanie. */}
      <section className="stage" hidden={hidden('intuicja')}>
        <Intuition onNext={() => go('model')} />
      </section>

      <section className="stage" hidden={hidden('model')}>
        <div className="read">
          <p className="eyebrow">Etap 2 · Model danych</p>
          <h2>{design.title}</h2>
          <Html as="p" html={design.intro} />
          <DesignColumns />
          <Html as="p" className="takeaway" html={design.takeaway} />
          <Deeper title={design.moreTitle} html={design.more} />
          <BridgeBox bridge={design.bridge} />

          <Unit id="db-nf-title" title={normalization.title}>
            <p>{normalization.intro}</p>
            <NormalizationSteps />
            <Html as="p" className="takeaway" html={normalization.takeaway} />
            <Deeper title={normalization.moreTitle} html={normalization.more} />
          </Unit>

          <Unit id="db-denorm-title" title={denormalization.title}>
            <p>{denormalization.intro}</p>
            <DenormCompare />
            <Html as="p" className="takeaway" html={denormalization.takeaway} />
            <Deeper title={denormalization.moreTitle} html={denormalization.more} />
            <BridgeBox bridge={denormalization.bridge} />
          </Unit>

          <Unit id="db-keys-title" title={keys.title}>
            <Html as="p" html={keys.intro} />
            <KeysCheck />
            <Html as="p" className="takeaway" html={keys.takeaway} />
            <Deeper title={keys.testsTitle}>
              <Html as="p" html={keys.testsIntro} />
              <CodeExplainer title={keys.testsCodeTitle} lines={keys.testsLines} />
            </Deeper>
            <Deeper title={keys.moreTitle} html={keys.more} />
            <BridgeBox bridge={keys.bridge} />
          </Unit>

          <div className="foot">
            <button type="button" className="back" onClick={() => go('intuicja')}>← Intuicja</button>
            <button type="button" className="cta" style={{ margin: 0 }} onClick={() => go('silnik')}>Jak silnik to wykonuje?</button>
          </div>
        </div>
      </section>

      <section className="stage" hidden={hidden('silnik')}>
        <div className="read">
          <p className="eyebrow">Etap 3 · Silnik</p>
          <h2>{index.title}</h2>
          <Html as="p" html={index.intro} />
          <IndexSim />
          <Html as="p" className="takeaway" html={index.takeaway} />
          <Deeper title={index.moreTitle} html={index.more} />
          <h3 className="db-sub">{index.snowTitle}</h3>
          <p>{index.snowIntro}</p>
          <CompareTable columns={index.snowColumns} rows={index.snowRows} />
          <Html as="p" className="takeaway" html={index.snowTakeaway} />

          <Unit id="db-prune-title" title={pruning.title}>
            <Html as="p" html={pruning.intro} />
            <PruningSim />
            <Html as="p" className="takeaway" html={pruning.takeaway} />
            <Deeper title={pruning.compareTitle}>
              <CompareTable columns={pruning.compareColumns} rows={pruning.compareRows} />
            </Deeper>
            <Deeper title={pruning.moreTitle} html={pruning.more} />
            <BridgeBox bridge={pruning.bridge} />
          </Unit>

          <Unit id="db-plans-title" title={plans.title}>
            <Html as="p" html={plans.intro} />
            <CodeExplainer title={plans.codeTitle} lines={plans.lines} />
            <Html as="p" className="takeaway" html={plans.takeaway} />
            <h3 className="db-sub">{plans.profileTitle}</h3>
            <Html as="p" html={plans.profileIntro} />
            <CompareTable columns={plans.profileColumns} rows={plans.profileRows} />
            <Html as="p" className="takeaway" html={plans.profileTakeaway} />
            <Deeper title={plans.moreTitle} html={plans.more} />
          </Unit>

          <Unit id="db-acid-title" title={acid.title}>
            <Html as="p" html={acid.intro} />
            <pre className="code db-sql db-sql-tall">{acid.code}</pre>
            <AcidLetters />
            <h3 className="db-sub">{acid.isoTitle}</h3>
            <Html as="p" html={acid.isoIntro} />
            <IsolationLevels />
            <Html as="p" className="takeaway" html={acid.takeaway} />
            <Deeper title={acid.moreTitle} html={acid.more} />
          </Unit>

          <div className="foot">
            <button type="button" className="back" onClick={() => go('model')}>← Model</button>
            <button type="button" className="cta" style={{ margin: 0 }} onClick={() => go('architektura')}>Z czego zbudować platformę?</button>
          </div>
        </div>
      </section>

      <section className="stage" hidden={hidden('architektura')}>
        <div className="read">
          <p className="eyebrow">Etap 4 · Architektura</p>
          <h2>{architectures.title}</h2>
          <p>{architectures.intro}</p>
          <ArchCompare />
          <Html as="p" className="takeaway" html={architectures.takeaway} />
          <Deeper title={architectures.moreTitle} html={architectures.more} />

          <Unit id="db-etl-title" title={etl.title}>
            <p>{etl.intro}</p>
            <EtlFlow />
            <Html as="p" className="takeaway" html={etl.takeaway} />
            <BridgeBox bridge={etl.bridge} />
          </Unit>

          <Unit id="db-sep-title" title={separation.title}>
            <p>{separation.intro}</p>
            <SeparationView />
            <Html as="p" className="takeaway" html={separation.takeaway} />
            <Deeper title={separation.moreTitle} html={separation.more} />
          </Unit>

          <Unit id="db-choose-title" title={choose.title}>
            <p>{choose.intro}</p>
            {choose.cases.map((s, i) => <ScenarioCard key={i} n={i + 1} s={s} />)}
            <Html as="p" className="takeaway unit-end" html={choose.takeaway} />
          </Unit>

          <div className="foot">
            <button type="button" className="back" onClick={() => go('silnik')}>← Silnik</button>
            <button type="button" className="cta" style={{ margin: 0 }} onClick={() => go('interview')}>Teraz ułóż z tego odpowiedzi</button>
          </div>
        </div>
      </section>

      <section className="stage" hidden={hidden('interview')}>
        <div className="read">
          <Interview />
          <div className="foot">
            <button type="button" className="back" onClick={() => go('architektura')}>← Architektura</button>
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

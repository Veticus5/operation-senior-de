import { useEffect, useRef, useState } from 'react';
import { accountability, adr, beats, boundaries, environments, flow, incremental, interview, interviewTopics, levels, meta, permissions, pipeline, quiz, recon, release, requirements, review, security, teamwork, verify, type Scenario } from '@content/delivery/enterprise-ai-delivery/lesson';
import { lessons, questions, type Question } from '@content/index';
import { CodeExplainer } from '../../components/CodeExplainer';
import { ConceptBridge } from '../../components/ConceptBridge';
import { Html } from '../../components/Html';
import { href, navigate } from '../../lib/router';
import { useProgress } from '../../lib/useProgress';
import { CompareTable, GreenButWrong, IncrementalCases, Lifecycle, PermissionMatrix, PipelineSim, ReconSim, ReleaseStrategies, RequirementSort, SqlReview, TestLevels, WorkflowGates } from './Visuals';
import './delivery.css';

const STAGES = [
  ['intuicja', 'Intuicja'],
  ['dostarczanie', 'Dostarczanie'],
  ['testy', 'Testy'],
  ['ai', 'Praca z AI'],
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
        {list && <ul className="deeper-list">{list.map((h, i) => <li key={i}><Html as="span" html={h} /></li>)}</ul>}
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
          {b.visual === 'green' && <GreenButWrong />}
          {b.visual === 'lifecycle' && <Lifecycle />}
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
      <p className="muted" style={{ marginBottom: 12 }}>{security.ask}</p>
      <div className="choices quiz-choices">
        {s.options.map((c, i) => (
          <button key={c} type="button" className={`choice${picked === null ? '' : i === s.correct ? ' ok' : i === picked ? ' no' : ''}`} disabled={picked !== null} onClick={() => setPicked(i)}>
            {c}
          </button>
        ))}
      </div>
      {picked !== null && (
        <div className="reveal on">
          <p className={`verdict ${picked === s.correct ? 'ok' : 'no'}`}>{picked === s.correct ? 'Tak, to dobry pierwszy ruch.' : 'Jest lepszy pierwszy ruch.'}</p>
          <Html as="p" html={s.why} />
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
        <h3>{interview.storyTitle}</h3>
        <p>{interview.storyIntro}</p>
        <ul className="deeper-list">{interview.story.map(s => <li key={s}>{s}</li>)}</ul>
        <p className="answer" lang="en" style={{ fontSize: 19 }}>{interview.storyEn}</p>
      </div>

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
  const [index, setIndex] = useState(0);
  const [picks, setPicks] = useState<number[]>([]);
  const good = picks.filter((p, i) => p === quiz[i].correct).length;
  const next = lessons[lessons.findIndex(l => l.id === meta.id) + 1];

  if (index >= quiz.length) {
    const perfect = good === quiz.length;
    return (
      <div className="task on done-box">
        <p className="score">{good} / {quiz.length}</p>
        <h2>{perfect ? 'Metoda siedzi.' : good >= 7 ? 'Większość siedzi.' : 'Warto wrócić do ilustracji.'}</h2>
        <p className="lede">
          {perfect
            ? 'Wróć teraz do etapu Interview i opowiedz na głos własny przykład według szkieletu.'
            : 'Tam, gdzie się pomyliłeś, wróć do odpowiedniej ilustracji i ustaw ten przypadek. Zobaczenie go działa lepiej niż ponowne czytanie.'}
        </p>
        <div className="foot" style={{ marginTop: 48 }}>
          <button type="button" className="back" onClick={() => { setRound(round + 1); setIndex(0); setPicks([]); }}>
            Rozwiąż jeszcze raz
          </button>
          {perfect && next ? (
            <a className="cta" style={{ margin: 0, textDecoration: 'none' }} href={href('academy', next.id)}>Następna lekcja: {next.title}</a>
          ) : (
            <button type="button" className="cta" style={{ margin: 0 }} onClick={() => onGo(perfect ? 'interview' : 'testy')}>
              {perfect ? 'Wróć do Interview' : 'Wróć do lekcji'}
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

function Unit({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section className="unit" aria-labelledby={id}>
      <h2 id={id}>{title}</h2>
      {children}
    </section>
  );
}

export function DeliveryLesson({ stage }: { stage?: string }) {
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
        <Intuition onNext={() => go('dostarczanie')} />
      </section>

      <section className="stage" hidden={hidden('dostarczanie')}>
        <div className="read">
          <p className="eyebrow">Etap 2 · Dostarczanie</p>
          <h2>{requirements.title}</h2>
          <Html as="p" html={requirements.intro} />
          <RequirementSort />
          <Html as="p" className="takeaway" html={requirements.takeaway} />
          <Deeper title={requirements.moreTitle} list={requirements.more} />
          <h3 className="ed-sub">{requirements.criteriaTitle}</h3>
          <Html as="p" html={requirements.criteriaIntro} />
          <CodeExplainer title={requirements.criteriaCodeTitle} lines={requirements.criteriaLines} />
          <Html as="p" className="takeaway" html={requirements.criteriaTakeaway} />

          <Unit id="ed-env-title" title={environments.title}>
            <Html as="p" html={environments.intro} />
            <CompareTable columns={environments.columns} rows={environments.rows} />
            <Html as="p" className="takeaway" html={environments.takeaway} />
            <Deeper title={environments.iacTitle} html={environments.iac} />
            <BridgeBox bridge={environments.bridge} />
          </Unit>

          <Unit id="ed-adr-title" title={adr.title}>
            <p>{adr.intro}</p>
            <CodeExplainer title={adr.codeTitle} lines={adr.lines} />
            <Html as="p" className="takeaway" html={adr.takeaway} />
            <Deeper title={adr.moreTitle} list={adr.more} />
          </Unit>

          <Unit id="ed-pipe-title" title={pipeline.title}>
            <Html as="p" html={pipeline.intro} />
            <PipelineSim />
            <Html as="p" className="takeaway" html={pipeline.takeaway} />
            <Deeper title={pipeline.moreTitle} html={pipeline.more} />
          </Unit>

          <Unit id="ed-rel-title" title={release.title}>
            <p>{release.intro}</p>
            <ReleaseStrategies />
            <Html as="p" className="takeaway" html={release.takeaway} />
            <Deeper title={release.moreTitle} html={release.more} />
          </Unit>

          <Unit id="ed-team-title" title={teamwork.title}>
            <p>{teamwork.intro}</p>
            <CompareTable columns={teamwork.columns} rows={teamwork.rows} />
            <Html as="p" className="takeaway" html={teamwork.takeaway} />
            <Deeper title={teamwork.debtTitle} html={teamwork.debt} />
            <Deeper title={teamwork.agileTitle} html={teamwork.agile} />
          </Unit>

          <div className="foot">
            <button type="button" className="back" onClick={() => go('intuicja')}>← Intuicja</button>
            <button type="button" className="cta" style={{ margin: 0 }} onClick={() => go('testy')}>Jak to sprawdzić?</button>
          </div>
        </div>
      </section>

      <section className="stage" hidden={hidden('testy')}>
        <div className="read">
          <p className="eyebrow">Etap 3 · Testy i walidacja</p>
          <h2>{levels.title}</h2>
          <p>{levels.intro}</p>
          <TestLevels />
          <Html as="p" className="takeaway" html={levels.takeaway} />
          <BridgeBox bridge={levels.bridge} />

          <Unit id="ed-recon-title" title={recon.title}>
            <Html as="p" html={recon.intro} />
            <ReconSim />
            <Html as="p" className="takeaway" html={recon.takeaway} />
            <Deeper title={recon.moreTitle} html={recon.more} />
            <Deeper title={recon.toolsTitle} html={recon.tools} />
          </Unit>

          <Unit id="ed-inc-title" title={incremental.title}>
            <Html as="p" html={incremental.intro} />
            <IncrementalCases />
            <Html as="p" className="takeaway" html={incremental.takeaway} />
            <Deeper title={incremental.moreTitle} html={incremental.more} />
          </Unit>

          <Unit id="ed-verify-title" title={verify.title}>
            <p>{verify.intro}</p>
            <CompareTable columns={verify.columns} rows={verify.rows} />
            <Html as="p" className="takeaway" html={verify.takeaway} />
          </Unit>

          <div className="foot">
            <button type="button" className="back" onClick={() => go('dostarczanie')}>← Dostarczanie</button>
            <button type="button" className="cta" style={{ margin: 0 }} onClick={() => go('ai')}>Gdzie w tym jest agent AI?</button>
          </div>
        </div>
      </section>

      <section className="stage" hidden={hidden('ai')}>
        <div className="read">
          <p className="eyebrow">Etap 4 · Praca z AI</p>
          <h2>{flow.title}</h2>
          <Html as="p" html={flow.intro} />
          <WorkflowGates />
          <Html as="p" className="takeaway" html={flow.takeaway} />
          <Deeper title={flow.moreTitle} html={flow.more} />

          <Unit id="ed-bound-title" title={boundaries.title}>
            <p>{boundaries.intro}</p>
            <CodeExplainer title={boundaries.codeTitle} lines={boundaries.lines} />
            <Html as="p" className="takeaway" html={boundaries.takeaway} />
            <Deeper title={boundaries.moreTitle} list={boundaries.more} />
            <BridgeBox bridge={boundaries.bridge} />
          </Unit>

          <Unit id="ed-review-title" title={review.title}>
            <p>{review.intro}</p>
            <SqlReview />
            <Html as="p" className="takeaway" html={review.takeaway} />
            <Deeper title={review.checklistTitle} list={review.checklist} />
            <Deeper title={review.pythonTitle}>
              <p>{review.pythonIntro}</p>
              <CodeExplainer title={review.pythonCodeTitle} lines={review.pythonLines} />
            </Deeper>
          </Unit>

          <Unit id="ed-perm-title" title={permissions.title}>
            <Html as="p" html={permissions.intro} />
            <PermissionMatrix />
            <Html as="p" className="takeaway" html={permissions.takeaway} />
            <Deeper title={permissions.moreTitle} html={permissions.more} />
          </Unit>

          <Unit id="ed-sec-title" title={security.title}>
            <p>{security.intro}</p>
            {security.cases.map((s, i) => <ScenarioCard key={i} n={i + 1} s={s} />)}
            <Html as="p" className="takeaway unit-end" html={security.takeaway} />
            <Deeper title={security.moreTitle} list={security.more} />
          </Unit>

          <Unit id="ed-acc-title" title={accountability.title}>
            <p>{accountability.intro}</p>
            <CompareTable columns={accountability.columns} rows={accountability.rows} />
            <Html as="p" className="takeaway" html={accountability.takeaway} />
          </Unit>

          <div className="foot">
            <button type="button" className="back" onClick={() => go('testy')}>← Testy</button>
            <button type="button" className="cta" style={{ margin: 0 }} onClick={() => go('interview')}>Teraz ułóż z tego odpowiedzi</button>
          </div>
        </div>
      </section>

      <section className="stage" hidden={hidden('interview')}>
        <div className="read">
          <Interview />
          <div className="foot">
            <button type="button" className="back" onClick={() => go('ai')}>← Praca z AI</button>
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

import { useEffect, useRef, useState } from 'react';
import {
  arch, beats, cdf, choose, clustering, compaction, compare, compute, conflict, deploy, interview, interviewTopics,
  lakeflow, log, merge, meta, microsoft, myths, quiz, schema, timeTravel, uc, type More, type Scenario
} from '@content/databricks/platform-delta-lake/lesson';
import { lessons, questions, type Bridge, type Question } from '@content/index';
import { CodeExplainer } from '../../components/CodeExplainer';
import { ConceptBridge } from '../../components/ConceptBridge';
import { Html } from '../../components/Html';
import { href, navigate } from '../../lib/router';
import { useProgress } from '../../lib/useProgress';
import { CdfTable, ClusterDemo, Compaction, ConflictSim, CrashDemo, LogSim, MergeDemo, SchemaDemo, StackLayers, TimeVacuum, VersusTable } from './DeltaVisuals';
import { ArchMap, CompareDims, ComputePicker, DeployFlow, MicrosoftMap, Myths, UcTree } from './PlatformVisuals';
import './delta.css';

const STAGES = [
  ['intuicja', 'Intuicja'],
  ['delta', 'Delta Lake'],
  ['platforma', 'Platforma'],
  ['ekosystem', 'Ekosystem'],
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

const MoreList = ({ items }: { items: More[] }) => <>{items.map(m => <Deeper key={m.title} title={m.title} html={m.html} />)}</>;

const BridgeBox = ({ title, bridge }: { title: string; bridge: Bridge }) => (
  <Deeper title={title}>
    <ConceptBridge bridge={bridge} here="W Databricks" />
  </Deeper>
);

/** Jedna jednostka lekcji: pytanie, krótki wstęp, wizualizacja, wniosek, a pod spodem zwinięte pogłębienia. */
function Unit({ id, title, intro, first, children }: { id: string; title: string; intro: string[]; first?: boolean; children: React.ReactNode }) {
  const body = (
    <>
      <h2 id={id}>{title}</h2>
      {intro.map((html, i) => <Html as="p" key={i} html={html} />)}
      {children}
    </>
  );
  return first ? body : <section className="unit" aria-labelledby={id}>{body}</section>;
}

const Takeaways = ({ html }: { html: string | string[] }) => (
  <>{(Array.isArray(html) ? html : [html]).map((h, i) => <Html as="p" key={i} className="takeaway" html={h} />)}</>
);

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
          {b.visual === 'crash' && <CrashDemo />}
          {b.visual === 'versus' && <VersusTable />}
          {b.visual === 'stack' && <StackLayers />}
          {b.after && <Html as="p" className="takeaway" html={b.after} />}
          {b.more && <Deeper title={b.more.title} html={b.more.html} />}
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
          <p className={`verdict ${picked === s.correct ? 'ok' : 'no'}`}>{picked === s.correct ? 'To najłatwiej uzasadnić.' : 'Da się obronić coś lepiej dopasowanego.'}</p>
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
        <h3>{myths.title}</h3>
        <p>{myths.intro}</p>
        <Myths />
      </div>

      <div className="sect">
        <h3>Gdy znasz hurtownię, a Databricks dopiero poznajesz</h3>
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
        <h2>{perfect ? 'Model siedzi.' : good >= 9 ? 'Większość siedzi.' : 'Warto wrócić do logu.'}</h2>
        <p className="lede">
          {perfect
            ? 'Powiedz teraz na głos, po co istnieje Delta Lake i co Databricks dokłada do Sparka, bez patrzenia.'
            : 'Tam, gdzie się pomyliłeś, wróć do symulacji i ustaw ten przypadek. Zobaczenie go działa lepiej niż ponowne czytanie.'}
        </p>
        <div className="foot" style={{ marginTop: 48 }}>
          <button type="button" className="back" onClick={() => { setRound(round + 1); setIndex(0); setPicks([]); }}>
            Rozwiąż jeszcze raz
          </button>
          {perfect && next ? (
            <a className="cta" style={{ margin: 0, textDecoration: 'none' }} href={href('academy', next.id)}>Następna lekcja: {next.title}</a>
          ) : (
            <button type="button" className="cta" style={{ margin: 0 }} onClick={() => onGo(perfect ? 'interview' : 'delta')}>
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

export function DeltaLesson({ stage }: { stage?: string }) {
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
        <Intuition onNext={() => go('delta')} />
      </section>

      <section className="stage" hidden={hidden('delta')}>
        <div className="read">
          <p className="eyebrow">Etap 2 · Delta Lake od środka</p>
          <Unit id="dl-log" title={log.title} intro={log.intro} first>
            <LogSim />
            <Takeaways html={log.takeaway} />
            <MoreList items={log.more} />
          </Unit>

          <Unit id="dl-conflict" title={conflict.title} intro={conflict.intro}>
            <ConflictSim />
            <Takeaways html={conflict.takeaway} />
            <MoreList items={conflict.more} />
          </Unit>

          <Unit id="dl-merge" title={merge.title} intro={merge.intro}>
            <MergeDemo />
            <Takeaways html={merge.takeaway} />
            <CodeExplainer title={merge.codeTitle} lines={merge.lines} />
            <MoreList items={merge.more} />
          </Unit>

          <Unit id="dl-schema" title={schema.title} intro={schema.intro}>
            <SchemaDemo />
            <Takeaways html={schema.takeaway} />
            <MoreList items={schema.more} />
          </Unit>

          <Unit id="dl-time" title={timeTravel.title} intro={timeTravel.intro}>
            <TimeVacuum />
            <Takeaways html={timeTravel.takeaway} />
            <CodeExplainer title={timeTravel.codeTitle} lines={timeTravel.lines} />
            <BridgeBox title={timeTravel.bridgeTitle} bridge={timeTravel.bridge} />
            <MoreList items={timeTravel.more} />
          </Unit>

          <Unit id="dl-compaction" title={compaction.title} intro={compaction.intro}>
            <Compaction />
            <Takeaways html={compaction.takeaway} />
            <MoreList items={compaction.more} />
          </Unit>

          <Unit id="dl-clustering" title={clustering.title} intro={clustering.intro}>
            <ClusterDemo />
            <Takeaways html={clustering.takeaway} />
            <BridgeBox title={clustering.bridgeTitle} bridge={clustering.bridge} />
            <MoreList items={clustering.more} />
          </Unit>

          <Unit id="dl-cdf" title={cdf.title} intro={cdf.intro}>
            <CdfTable />
            <Takeaways html={cdf.takeaway} />
            <MoreList items={cdf.more} />
          </Unit>

          <div className="foot">
            <button type="button" className="back" onClick={() => go('intuicja')}>← Intuicja</button>
            <button type="button" className="cta" style={{ margin: 0 }} onClick={() => go('platforma')}>Co jest dookoła tabel?</button>
          </div>
        </div>
      </section>

      <section className="stage" hidden={hidden('platforma')}>
        <div className="read">
          <p className="eyebrow">Etap 3 · Platforma Databricks</p>
          <Unit id="dl-arch" title={arch.title} intro={arch.intro} first>
            <ArchMap />
            <Takeaways html={arch.takeaway} />
            <BridgeBox title={arch.bridgeTitle} bridge={arch.bridge} />
            <MoreList items={arch.more} />
          </Unit>

          <Unit id="dl-compute" title={compute.title} intro={compute.intro}>
            <ComputePicker />
            <Takeaways html={compute.takeaway} />
            <MoreList items={compute.more} />
          </Unit>

          <Unit id="dl-uc" title={uc.title} intro={uc.intro}>
            <UcTree />
            <Takeaways html={uc.takeaway} />
            <BridgeBox title={uc.bridgeTitle} bridge={uc.bridge} />
            <MoreList items={uc.more} />
          </Unit>

          <Unit id="dl-lakeflow" title={lakeflow.title} intro={lakeflow.intro}>
            <CodeExplainer title={lakeflow.codeTitle} lines={lakeflow.lines} />
            <Takeaways html={lakeflow.takeaway} />
            <BridgeBox title={lakeflow.bridgeTitle} bridge={lakeflow.bridge} />
            <MoreList items={lakeflow.more} />
          </Unit>

          <Unit id="dl-deploy" title={deploy.title} intro={deploy.intro}>
            <CodeExplainer title={deploy.codeTitle} lines={deploy.lines} />
            <DeployFlow />
            <Takeaways html={deploy.takeaway} />
            <MoreList items={deploy.more} />
          </Unit>

          <div className="foot">
            <button type="button" className="back" onClick={() => go('delta')}>← Delta Lake</button>
            <button type="button" className="cta" style={{ margin: 0 }} onClick={() => go('ekosystem')}>A Snowflake i Fabric?</button>
          </div>
        </div>
      </section>

      <section className="stage" hidden={hidden('ekosystem')}>
        <div className="read">
          <p className="eyebrow">Etap 4 · Ekosystem i wybór platformy</p>
          <Unit id="dl-ms" title={microsoft.title} intro={microsoft.intro} first>
            <MicrosoftMap />
            <Takeaways html={microsoft.takeaway} />
          </Unit>

          <Unit id="dl-compare" title={compare.title} intro={compare.intro}>
            <CompareDims />
            <Takeaways html={compare.takeaway} />
            <MoreList items={compare.more} />
          </Unit>

          <section className="unit" aria-labelledby="dl-choose">
            <h2 id="dl-choose">{choose.title}</h2>
            <p>{choose.intro}</p>
            {choose.cases.map((s, i) => <ScenarioCard key={i} n={i + 1} s={s} />)}
            <Html as="p" className="takeaway unit-end" html={choose.takeaway} />
          </section>

          <div className="foot">
            <button type="button" className="back" onClick={() => go('platforma')}>← Platforma</button>
            <button type="button" className="cta" style={{ margin: 0 }} onClick={() => go('interview')}>Teraz ułóż z tego odpowiedź</button>
          </div>
        </div>
      </section>

      <section className="stage" hidden={hidden('interview')}>
        <div className="read">
          <Interview />
          <div className="foot">
            <button type="button" className="back" onClick={() => go('ekosystem')}>← Ekosystem</button>
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

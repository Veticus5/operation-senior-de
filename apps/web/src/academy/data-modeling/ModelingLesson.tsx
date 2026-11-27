import { useEffect, useRef, useState } from 'react';
import {
  additivity, beats, cardinality, design, factTypes, interview, interviewTopics, keys, late, meta, methods, patterns, pit, placement, preagg, quiz, rls, scd, semantic, shapes, tools,
  type DesignCase, type PlacementCase
} from '@content/data-modeling/dimensional-modeling/lesson';
import { lessons, questionsByTopic, type Question } from '@content/index';
import { CodeExplainer } from '../../components/CodeExplainer';
import { ConceptBridge } from '../../components/ConceptBridge';
import { Html } from '../../components/Html';
import { href, navigate } from '../../lib/router';
import { useProgress } from '../../lib/useProgress';
import { Additivity, DataTable, FactTypes, FanOut, GrainPicker, Patterns, PitJoin, RlsLab, ScdTimeline, SemanticLab, StarSchema } from './Visuals';
import './modeling.css';

const STAGES = [
  ['intuicja', 'Intuicja'],
  ['fakty', 'Fakty i wymiary'],
  ['historia', 'Historia'],
  ['bi', 'Warstwa BI'],
  ['projekt', 'Projekt'],
  ['interview', 'Interview'],
  ['test', 'Sprawdź się']
] as const;
type StageId = (typeof STAGES)[number][0];
const HERE = 'W modelu wymiarowym';

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

function Points({ items }: { items: string[] }) {
  return (
    <ul className="deeper-list dm-points">
      {items.map((item, i) => <li key={i}><Html as="span" html={item} /></li>)}
    </ul>
  );
}

function Sketches({ items }: { items: { tool: string; code: string }[] }) {
  return (
    <>
      {items.map(s => (
        <div key={s.tool}>
          <p className="viz-k">{s.tool}</p>
          <pre className="code dm-sql">{s.code}</pre>
        </div>
      ))}
    </>
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
          {b.visual === 'star' && <StarSchema />}
          {b.visual === 'grain' && <GrainPicker />}
          {b.visual === 'fanout' && <FanOut />}
          {b.after && <Html as="p" className="takeaway" html={b.after} />}
          {b.bridge && <ConceptBridge bridge={b.bridge} here={HERE} />}
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

/** Dwie sytuacje ze spóźnionymi danymi. Obie zamontowane, żeby wybrana linia kodu przetrwała przełączenie. */
function LateCases() {
  const [id, setId] = useState(late.cases[0].id);
  return (
    <>
      <div className="tiers" role="group" aria-label="Sytuacja">
        {late.cases.map(c => <button key={c.id} type="button" className="tier" aria-pressed={c.id === id} onClick={() => setId(c.id)}>{c.label}</button>)}
      </div>
      {late.cases.map(c => (
        <div key={c.id} hidden={c.id !== id} className="dm-case">
          <Html as="p" className="ask" html={c.setup} />
          <CodeExplainer title={c.label} lines={c.lines} />
          <Html as="p" className="takeaway" html={`<b>Wniosek.</b> ${c.takeaway}`} />
        </div>
      ))}
    </>
  );
}

function PlacementCard({ n, c }: { n: number; c: PlacementCase }) {
  const [picked, setPicked] = useState<number | null>(null);
  return (
    <div className="obs">
      <span className="num">PRZYPADEK {n}</span>
      <Html as="p" className="ask" html={c.setup} />
      <p className="muted" style={{ marginBottom: 12 }}>{placement.ask}</p>
      <div className="choices quiz-choices">
        {placement.options.map((o, i) => (
          <button key={o} type="button" className={`choice${picked === null ? '' : i === c.correct ? ' ok' : i === picked ? ' no' : ''}`} disabled={picked !== null} onClick={() => setPicked(i)}>{o}</button>
        ))}
      </div>
      {picked !== null && (
        <div className="reveal on">
          <p className={`verdict ${picked === c.correct ? 'ok' : 'no'}`}>{picked === c.correct ? 'Tak bym to uzasadnił.' : 'Jest lepsze miejsce.'}</p>
          <Html as="p" html={c.why} />
          <p className="scope"><b>Granice tej odpowiedzi.</b> <Html as="span" html={c.scope} /></p>
        </div>
      )}
    </div>
  );
}

/** Jedno zlecenie projektowe: decyzje odsłaniają się po kolei, a na końcu pojawia się gotowy model. */
function DesignCard({ c }: { c: DesignCase }) {
  const [picks, setPicks] = useState<number[]>([]);
  const good = picks.filter((p, i) => p === c.steps[i].correct).length;
  return (
    <div>
      <Html as="p" className="ask" html={c.brief} />
      {c.steps.slice(0, picks.length + 1).map((s, i) => {
        const picked = picks[i];
        const answered = picked !== undefined;
        return (
          <div className="obs" key={s.ask}>
            <span className="num">DECYZJA {i + 1} Z {c.steps.length}</span>
            <p className="ask">{s.ask}</p>
            <div className="choices quiz-choices">
              {s.options.map((o, k) => (
                <button key={o} type="button" className={`choice${!answered ? '' : k === s.correct ? ' ok' : k === picked ? ' no' : ''}`} disabled={answered} onClick={() => setPicks([...picks, k])}>{o}</button>
              ))}
            </div>
            {answered && (
              <div className="reveal on">
                <p className={`verdict ${picked === s.correct ? 'ok' : 'no'}`}>{picked === s.correct ? 'Dobra decyzja.' : 'Ta decyzja się nie obroni.'}</p>
                <Html as="p" html={s.why} />
              </div>
            )}
          </div>
        );
      })}
      {picks.length === c.steps.length && (
        <div className="reveal on dm-summary">
          <p className="viz-k">Twoje decyzje: {good} z {c.steps.length} zgodne z modelem wzorcowym</p>
          <Html as="p" className="takeaway" html={c.summary} />
          <button type="button" className="back" onClick={() => setPicks([])}>Przejdź to zlecenie jeszcze raz</button>
        </div>
      )}
    </div>
  );
}

function DesignCases() {
  const [id, setId] = useState(design.cases[0].id);
  return (
    <>
      <div className="tiers" role="group" aria-label="Zlecenie">
        {design.cases.map(c => <button key={c.id} type="button" className="tier" aria-pressed={c.id === id} onClick={() => setId(c.id)}>{c.title}</button>)}
      </div>
      {design.cases.map(c => (
        <div key={c.id} hidden={c.id !== id}>
          <DesignCard c={c} />
        </div>
      ))}
    </>
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
      <div className="sect" style={{ marginTop: 48 }}>
        <h3>Typowe błędy w odpowiedzi</h3>
        <ul className="deeper-list">{q.mistakes.map(m => <li key={m}>{m}</li>)}</ul>
      </div>
    </>
  );
}

function Interview() {
  // Pytania, krótkie odpowiedzi, follow-upy i błędy mają jedno źródło: Interview Bank.
  const bank = interviewTopics.flatMap(topic => questionsByTopic(topic));
  const [current, setCurrent] = useState(0);
  if (!bank.length) return null;
  return (
    <>
      <p className="eyebrow">Etap 6 · Interview</p>
      <div className="sect" style={{ marginTop: 0, marginBottom: 56 }}>
        <h2>{interview.frameTitle}</h2>
        <p>{interview.frameIntro}</p>
        <p className="answer" lang="en" style={{ fontSize: 19 }}>{interview.frameEn}</p>
        <p className="small">{interview.framePl}</p>
      </div>
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
        <h3>{interview.relatedTitle}</h3>
        <p className="muted">{interview.relatedIntro}</p>
        <p className="links">
          {bank.map(b => <a key={b.id} className="lesson-link" href={href('bank', 'q', b.id)}>{b.title} →</a>)}
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
        <h2>{perfect ? 'Model się broni.' : good >= 7 ? 'Większość siedzi.' : 'Warto wrócić do ilustracji.'}</h2>
        <p className="lede">
          {perfect
            ? 'Powiedz teraz na głos odpowiedzi z etapu Interview, bez patrzenia. Potem weź jedno zlecenie z etapu Projekt i uzasadnij każdą decyzję jednym zdaniem.'
            : 'Tam, gdzie się pomyliłeś, wróć do ilustracji i zmień jedno ustawienie. Zobaczenie, jak zmienia się liczba, działa lepiej niż ponowne czytanie.'}
        </p>
        <div className="foot" style={{ marginTop: 48 }}>
          <button type="button" className="back" onClick={() => { setRound(round + 1); setIndex(0); setPicks([]); }}>Rozwiąż jeszcze raz</button>
          {perfect && next ? (
            <a className="cta" style={{ margin: 0, textDecoration: 'none' }} href={href('academy', next.id)}>Następna lekcja: {next.title}</a>
          ) : (
            <button type="button" className="cta" style={{ margin: 0 }} onClick={() => onGo(perfect ? 'interview' : 'intuicja')}>
              {perfect ? 'Wróć do Interview' : 'Wróć do ilustracji'}
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
          <button key={o} type="button" className={`choice${!answered ? '' : i === item.correct ? ' ok' : i === picked ? ' no' : ''}`} disabled={answered} onClick={() => setPicks([...picks.slice(0, index), i])}>{o}</button>
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

export function ModelingLesson({ stage }: { stage?: string }) {
  const progress = useProgress();
  const cur: StageId = STAGES.some(s => s[0] === stage) ? (stage as StageId) : 'intuicja';
  const go = (s: string) => navigate('academy', meta.id, s);
  const hidden = (id: StageId) => cur !== id;
  const Foot = ({ back, backLabel, next, nextLabel }: { back: StageId; backLabel: string; next: StageId; nextLabel: string }) => (
    <div className="foot">
      <button type="button" className="back" onClick={() => go(back)}>← {backLabel}</button>
      <button type="button" className="cta" style={{ margin: 0 }} onClick={() => go(next)}>{nextLabel}</button>
    </div>
  );

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

      {/* Wszystkie etapy są zamontowane, żeby stan ilustracji i odpowiedzi przetrwał przełączanie. */}
      <section className="stage" hidden={hidden('intuicja')}>
        <Intuition onNext={() => go('fakty')} />
      </section>

      <section className="stage" hidden={hidden('fakty')}>
        <div className="read">
          <p className="eyebrow">Etap 2 · Fakty i wymiary</p>
          <h2>{factTypes.question}</h2>
          <p>{factTypes.intro}</p>
          <FactTypes />
          {factTypes.takeaway.map((html, i) => <Html as="p" key={i} className="takeaway" html={html} />)}
          <Deeper title={factTypes.notesTitle} list={factTypes.notes} />

          <section className="unit" aria-labelledby="dm-add-title">
            <h2 id="dm-add-title">{additivity.title}</h2>
            <p>{additivity.intro}</p>
            <Additivity />
            <Html as="p" className="takeaway" html={additivity.takeaway} />
            <Deeper title={additivity.moreTitle} html={additivity.more} />
          </section>

          <section className="unit" aria-labelledby="dm-keys-title">
            <h2 id="dm-keys-title">{keys.title}</h2>
            <Html as="p" html={keys.intro} />
            <div className="dm"><DataTable table={keys.table} cellClass={(_, c) => (c === 0 ? 'key' : '')} /></div>
            <Html as="p" className="small" html={keys.legend} />
            <Points items={keys.reasons} />
            <Html as="p" className="takeaway" html={keys.takeaway} />
            <Deeper title={keys.moreTitle} html={keys.more} />
          </section>

          <section className="unit" aria-labelledby="dm-patterns-title">
            <h2 id="dm-patterns-title">{patterns.title}</h2>
            <p>{patterns.intro}</p>
            <Patterns />
            <Deeper title={patterns.moreTitle} html={patterns.more} />
          </section>

          <section className="unit" aria-labelledby="dm-shapes-title">
            <h2 id="dm-shapes-title">{shapes.title}</h2>
            <p>{shapes.intro}</p>
            <div className="dm-cards two">
              {shapes.variants.map(v => (
                <section className="dm-card" key={v.name}>
                  <h3>{v.name}</h3>
                  <Html as="p" html={v.text} />
                </section>
              ))}
            </div>
            <Html as="p" className="takeaway" html={shapes.takeaway} />
            <h3 style={{ marginTop: 36 }}>{shapes.conformedTitle}</h3>
            {shapes.conformed.map((html, i) => <Html as="p" key={i} html={html} />)}
            <ConceptBridge bridge={shapes.bridge} here={HERE} />
          </section>

          <Foot back="intuicja" backLabel="Intuicja" next="historia" nextLabel="A gdy dane się zmieniają?" />
        </div>
      </section>

      <section className="stage" hidden={hidden('historia')}>
        <div className="read">
          <p className="eyebrow">Etap 3 · Historia</p>
          <h2>{scd.question}</h2>
          <p>{scd.intro}</p>
          <ScdTimeline />
          {scd.takeaway.map((html, i) => <Html as="p" key={i} className="takeaway" html={html} />)}
          <Deeper title={scd.columnsTitle} list={scd.columns} />
          <Deeper title={scd.choiceTitle} html={scd.choice} />
          <ConceptBridge bridge={scd.bridge} here={HERE} />

          <section className="unit" aria-labelledby="dm-pit-title">
            <h2 id="dm-pit-title">{pit.title}</h2>
            <Html as="p" html={pit.intro} />
            <PitJoin />
            {pit.takeaway.map((html, i) => <Html as="p" key={i} className="takeaway" html={html} />)}
            <Deeper title={pit.currentTitle} html={pit.current} />
            <Deeper title={pit.asofTitle} html={pit.asof}>
              <pre className="code dm-sql">{pit.asofCode}</pre>
            </Deeper>
          </section>

          <section className="unit" aria-labelledby="dm-late-title">
            <h2 id="dm-late-title">{late.title}</h2>
            <p>{late.intro}</p>
            <LateCases />
            <Deeper title={late.correctionsTitle} list={late.corrections} />
            <Html as="p" className="takeaway unit-end" html={late.takeaway} />
          </section>

          <Foot back="fakty" backLabel="Fakty i wymiary" next="bi" nextLabel="Kto czyta ten model?" />
        </div>
      </section>

      <section className="stage" hidden={hidden('bi')}>
        <div className="read">
          <p className="eyebrow">Etap 4 · Warstwa BI</p>
          <h2>{semantic.question}</h2>
          <p>{semantic.intro}</p>
          <SemanticLab />
          {semantic.takeaway.map((html, i) => <Html as="p" key={i} className="takeaway" html={html} />)}
          <Deeper title={semantic.sketchTitle}>
            <p>{semantic.sketchIntro}</p>
            <Sketches items={semantic.sketches} />
          </Deeper>
          <Deeper title={semantic.toolsTitle} list={semantic.tools} />

          <section className="unit" aria-labelledby="dm-card-title">
            <h2 id="dm-card-title">{cardinality.title}</h2>
            <Html as="p" html={cardinality.intro} />
            <div className="dm"><DataTable table={cardinality.table} wrap /></div>
            <Html as="p" className="takeaway" html={cardinality.takeaway} />
            <Deeper title="Jak deklarują to Power BI i Looker" list={cardinality.points} />
            <ConceptBridge bridge={cardinality.bridge} here="W narzędziu BI" />
          </section>

          <section className="unit" aria-labelledby="dm-rls-title">
            <h2 id="dm-rls-title">{rls.title}</h2>
            <p>{rls.intro}</p>
            <RlsLab />
            <Html as="p" className="takeaway" html={rls.takeaway} />
            <Deeper title="Jak wygląda reguła w Power BI i w Looker">
              <Sketches items={rls.sketches} />
            </Deeper>
            <Deeper title={rls.caveatsTitle} list={rls.caveats} />
          </section>

          <section className="unit" aria-labelledby="dm-place-title">
            <h2 id="dm-place-title">{placement.title}</h2>
            <p>{placement.intro}</p>
            {placement.cases.map((c, i) => <PlacementCard key={i} n={i + 1} c={c} />)}
            <Html as="p" className="takeaway unit-end" html={placement.takeaway} />
          </section>

          <section className="unit" aria-labelledby="dm-preagg-title">
            <h2 id="dm-preagg-title">{preagg.title}</h2>
            <Html as="p" html={preagg.intro} />
            <div className="dm"><DataTable table={preagg.table} /></div>
            <Html as="p" className="takeaway" html={preagg.takeaway} />
            <Deeper title="Cztery rzeczy, które trzeba wiedzieć o agregatach" list={preagg.points} />
          </section>

          <section className="unit" aria-labelledby="dm-tools-title">
            <h2 id="dm-tools-title">{tools.title}</h2>
            <p>{tools.intro}</p>
            <div className="dm"><DataTable table={tools.table} wrap /></div>
            <Deeper title={tools.breaksTitle} list={tools.breaks} />
            <Deeper title={methods.title}>
              <p>{methods.intro}</p>
              <Points items={methods.items} />
              <Html as="p" className="takeaway" html={methods.takeaway} />
            </Deeper>
          </section>

          <Foot back="historia" backLabel="Historia" next="projekt" nextLabel="Zaprojektuj to sam" />
        </div>
      </section>

      <section className="stage" hidden={hidden('projekt')}>
        <div className="read">
          <p className="eyebrow">Etap 5 · Projekt</p>
          <h2>{design.title}</h2>
          <p className="lede">{design.intro}</p>
          <DesignCases />
          <section className="unit" aria-labelledby="dm-mistakes-title">
            <h2 id="dm-mistakes-title">{design.mistakesTitle}</h2>
            <Points items={design.mistakes} />
          </section>
          <Foot back="bi" backLabel="Warstwa BI" next="interview" nextLabel="Teraz ułóż z tego odpowiedź" />
        </div>
      </section>

      <section className="stage" hidden={hidden('interview')}>
        <div className="read">
          <Interview />
          <Foot back="projekt" backLabel="Projekt" next="test" nextLabel="Sprawdź, czy to siedzi" />
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

import { useState, type ReactNode } from 'react';
import { tasks } from '@content/spark/lazy-evaluation/lesson';

type Done = (ok: boolean) => void;

function Feedback({ ok, children }: { ok: boolean; children: ReactNode }) {
  return <div className={`fb on ${ok ? 'ok' : 'no'}`}>{children}</div>;
}

/** Zadanie: kliknij właściwą linijkę kodu. Można próbować do skutku; liczy się pierwsza próba. */
function Lines({ lines, why, correct, onDone }: { lines: string[]; why: string[]; correct: number; onDone: Done }) {
  const [tried, setTried] = useState<number[]>([]);
  const last = tried[tried.length - 1];
  const solved = last === correct;
  const pick = (i: number) => {
    const next = [...tried, i];
    setTried(next);
    if (i === correct) onDone(next.length === 1);
  };
  return (
    <>
      <div className="lines">
        {lines.map((text, i) => (
          <button key={i} type="button" className={`line${tried.includes(i) ? (i === correct ? ' ok' : ' no') : ''}`} disabled={solved || tried.includes(i)} onClick={() => pick(i)}>
            <i>{i + 1}</i>
            <span>{text}</span>
          </button>
        ))}
      </div>
      {last !== undefined && (
        <Feedback ok={solved}>
          <p>{why[last]}</p>
          {!solved && <p className="small">Spróbuj jeszcze raz.</p>}
        </Feedback>
      )}
    </>
  );
}

function Choice({ options, correct, onPick, picked }: { options: string[]; correct: number; picked: number | null; onPick: (i: number) => void }) {
  return (
    <div className="choices" style={{ marginTop: 18 }}>
      {options.map((o, i) => (
        <button key={o} type="button" className={`choice mono${picked === null ? '' : i === correct ? ' ok' : i === picked ? ' no' : ''}`} disabled={picked !== null} onClick={() => onPick(i)}>
          {o}
        </button>
      ))}
    </div>
  );
}

function PickActions({ onDone }: { onDone: Done }) {
  const ops = tasks.pickActions;
  const [on, setOn] = useState<boolean[]>(ops.map(() => false));
  const [checked, setChecked] = useState(false);
  const wrong = ops.flatMap(([name, isAction, why], i) =>
    on[i] && !isAction ? [`${name}: ${why}.`] : !on[i] && isAction ? [`${name} to akcja: zwraca wynik albo go zapisuje.`] : []
  );
  return (
    <>
      <h2>Zaznacz wszystkie akcje</h2>
      <p className="muted">Czyli operacje, które uruchamiają wykonanie planu.</p>
      <div className="chips">
        {ops.map(([name, isAction], i) => (
          <button
            key={name}
            type="button"
            className={`chipt${checked ? (on[i] && isAction ? ' ok' : on[i] ? ' no' : isAction ? ' miss' : '') : ''}`}
            aria-pressed={!checked && on[i]}
            disabled={checked}
            onClick={() => setOn(on.map((v, j) => (j === i ? !v : v)))}
          >
            {name}
          </button>
        ))}
      </div>
      {!checked && (
        <button type="button" className="more" style={{ marginTop: 0 }} onClick={() => { setChecked(true); onDone(wrong.length === 0); }}>
          Sprawdź
        </button>
      )}
      {checked && (
        <Feedback ok={wrong.length === 0}>
          {wrong.length === 0 ? (
            <p>Wszystkie sześć. Reguła: akcja zwraca wynik do Twojego programu albo zapisuje go na zewnątrz. Reszta tylko opisuje.</p>
          ) : (
            <>
              <p>Prawie. Do poprawy:</p>
              <ul>{wrong.map(w => <li key={w}>{w}</li>)}</ul>
              <p className="small">Przerywana ramka oznacza akcję, której nie zaznaczyłeś.</p>
            </>
          )}
        </Feedback>
      )}
    </>
  );
}

function Predict({ onDone }: { onDone: Done }) {
  const [a, setA] = useState<number | null>(null);
  const [b, setB] = useState<number | null>(null);
  return (
    <>
      <h2>Przewidź licznik</h2>
      <p className="muted">Plik ma 9 wierszy. Funkcja seen() zwiększa licznik za każdym razem, gdy przechodzi przez nią wiersz.</p>
      <pre className="code">{'df = (subs.filter(seen(col("status")) == "active")\n          .groupBy("publisher_id").count())\n\ndf.show()\ndf.count()\ndf.show()\nprint(counter.value)   # ?'}</pre>
      <Choice options={['9', '18', '27', '3']} correct={2} picked={a} onPick={setA} />
      {a !== null && (
        <Feedback ok={a === 2}>
          <p>{a === 2 ? 'Tak, 27. ' : 'To będzie 27. '}Trzy akcje to trzy pełne wykonania planu, a każde przepuszcza przez filter wszystkie 9 wierszy. W prawdziwym uruchomieniu licznik pokazał kolejno 9, 18 i 27.</p>
          <p>A gdyby po definicji dodać df.cache()?</p>
          <Choice options={['9', '18', '27']} correct={0} picked={b} onPick={i => { setB(i); onDone(a === 2 && i === 0); }} />
          {b !== null && (
            <Feedback ok={b === 0}>
              <p>Dziewięć. Pierwsza akcja liczy i wypełnia cache, dwie kolejne czytają już z pamięci. Tak było w eksperymencie 3: 9, 9, 9.</p>
            </Feedback>
          )}
        </Feedback>
      )}
    </>
  );
}

function Columns({ onDone }: { onDone: Done }) {
  const rows = tasks.columns;
  const [picked, setPicked] = useState<(number | null)[]>(rows.map(() => null));
  const pick = (r: number, n: number) => {
    const next = picked.map((v, i) => (i === r ? n : v));
    setPicked(next);
    if (next.every(v => v !== null)) onDone(next.every((v, i) => v === rows[i][1]));
  };
  return (
    <>
      <h2>Ile kolumn Spark przeczyta z pliku?</h2>
      <p className="muted">Plik Parquet ma 4 kolumny: subscription_id, publisher_id, status, price.</p>
      {rows.map(([code, correct, why], r) => (
        <div className="mini" key={code}>
          <code>{code}</code>
          <div className="choices">
            {[0, 1, 2, 3, 4].map(n => (
              <button key={n} type="button" className={`choice mono${picked[r] === null ? '' : n === correct ? ' ok' : n === picked[r] ? ' no' : ''}`} disabled={picked[r] !== null} onClick={() => pick(r, n)}>
                {n}
              </button>
            ))}
          </div>
          {picked[r] !== null && (
            <div style={{ gridColumn: '1 / -1' }}>
              <Feedback ok={picked[r] === correct}>
                <p>{why}</p>
              </Feedback>
            </div>
          )}
        </div>
      ))}
      {picked.every(v => v !== null) && <p className="small">Wszystkie trzy liczby pochodzą z ReadSchema w prawdziwym explain().</p>}
    </>
  );
}

const TASKS: ((done: Done) => ReactNode)[] = [
  done => (
    <>
      <h2>Która linijka pierwsza każe Sparkowi przetwarzać wiersze?</h2>
      <p className="muted">Kliknij ją.</p>
      <Lines {...tasks.clickLine} onDone={done} />
    </>
  ),
  done => <PickActions onDone={done} />,
  done => <Predict onDone={done} />,
  done => (
    <>
      <h2>Błąd wyskoczył w linijce 5. Gdzie jest przyczyna?</h2>
      <p className="muted">Linijka 4 wypisała „zdefiniowane" bez żadnego błędu. Kliknij winną linijkę.</p>
      <Lines {...tasks.findCause} onDone={done} />
    </>
  ),
  done => <Columns onDone={done} />
];

export function Tasks({ onFinished, onGo }: { onFinished: () => void; onGo: (stage: string) => void }) {
  const [round, setRound] = useState(0);
  const [index, setIndex] = useState(0);
  const [results, setResults] = useState<boolean[]>([]);
  const answered = results[index] !== undefined;
  const good = results.filter(Boolean).length;

  if (index >= TASKS.length) {
    const perfect = good === TASKS.length;
    return (
      <div className="task on done-box">
        <p className="score">{good} / {TASKS.length}</p>
        <h2>{perfect ? 'Mechanizm siedzi.' : good >= 3 ? 'Większość siedzi.' : 'Warto wrócić do mechanizmu.'}</h2>
        <p className="lede">
          {perfect
            ? 'Za pierwszym razem i bez pomyłek. Powiedz teraz na głos wersję seniorską z etapu Interview, bez patrzenia.'
            : 'Tam, gdzie się pomyliłeś, wróć do symulatora i odtwórz ten przypadek. Zobaczenie go w ruchu działa lepiej niż ponowne czytanie.'}
        </p>
        <div className="foot" style={{ marginTop: 48 }}>
          <button type="button" className="back" onClick={() => { setRound(round + 1); setIndex(0); setResults([]); }}>
            Rozwiąż jeszcze raz
          </button>
          <button type="button" className="cta" style={{ margin: 0 }} onClick={() => onGo(perfect ? 'interview' : 'mechanizm')}>
            {perfect ? 'Wróć do Interview' : 'Wróć do symulatora'}
          </button>
        </div>
      </div>
    );
  }
  return (
    <div className="task on" key={`${round}-${index}`}>
      <p className="task-n">ZADANIE {index + 1} Z {TASKS.length}</p>
      {TASKS[index](ok => setResults(r => { const next = [...r]; next[index] = ok; return next; }))}
      <div className="task-nav">
        <span />
        {answered && (
          <button
            type="button"
            className="cta"
            style={{ margin: 0 }}
            onClick={() => { if (index === TASKS.length - 1) onFinished(); setIndex(index + 1); window.scrollTo(0, 0); }}
          >
            {index === TASKS.length - 1 ? 'Podsumowanie' : 'Następne zadanie'}
          </button>
        )}
      </div>
    </div>
  );
}

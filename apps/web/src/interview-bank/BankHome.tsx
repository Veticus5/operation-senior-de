import { useState } from 'react';
import { AREA_LABEL, questions, type Area, type Priority } from '@content/index';
import { MASTERY, type Mastery } from '../lib/progress';
import { href } from '../lib/router';
import { useProgress } from '../lib/useProgress';
import { filterQuestions, NO_FILTERS, type Filters } from './filters';

const AREAS = Object.keys(AREA_LABEL) as Area[];
const PRIORITIES: Priority[] = ['P0', 'P1', 'P2'];
const toggle = <T,>(list: T[], item: T): T[] => (list.includes(item) ? list.filter(x => x !== item) : [...list, item]);

export function MasteryDot({ value }: { value: Mastery }) {
  return <span className={`mdot ${value}`} title={MASTERY.find(m => m.id === value)!.label} />;
}

export function BankHome() {
  const progress = useProgress();
  const [f, setF] = useState<Filters>(NO_FILTERS);
  const list = filterQuestions(questions, f, progress.mastery);
  const count = (m: Mastery) => questions.filter(q => progress.mastery(q.id) === m).length;
  return (
    <main className="page">
      <div className="bank">
        <div className="bank-head">
          <div>
            <p className="eyebrow" style={{ marginBottom: 10 }}>Interview Bank</p>
            <h1>Pytania i odpowiedzi</h1>
          </div>
          <a className="btn solid" href={href('bank', 'review')}>Szybka powtórka</a>
        </div>
        <p className="bank-head sum" style={{ marginBottom: 14 }}>
          <span className="sum">
            {questions.length} pytań · opanowane {count('mastered')} · do powtórki {count('review')} · uczę się {count('learning')} · nowe {count('new')}
          </span>
        </p>
        <div className="tools">
          <input type="search" id="bank-search" placeholder="Szukaj: pytanie, słowo kluczowe, follow-up" aria-label="Szukaj pytań" value={f.query} onChange={e => setF({ ...f, query: e.target.value })} />
          {AREAS.map(a => (
            <button key={a} type="button" className="fchip" aria-pressed={f.areas.includes(a)} onClick={() => setF({ ...f, areas: toggle(f.areas, a) })}>
              {AREA_LABEL[a]}
            </button>
          ))}
          <span className="sep" />
          {PRIORITIES.map(p => (
            <button key={p} type="button" className="fchip" aria-pressed={f.priorities.includes(p)} onClick={() => setF({ ...f, priorities: toggle(f.priorities, p) })}>
              {p}
            </button>
          ))}
          <select id="bank-mastery" aria-label="Status opanowania" value={f.mastery} onChange={e => setF({ ...f, mastery: e.target.value as Filters['mastery'] })}>
            <option value="all">Każdy status</option>
            {MASTERY.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
          </select>
        </div>
        {list.map(q => (
          <a key={q.id} className="qrow" href={href('bank', 'q', q.id)}>
            <span className={`p ${q.priority}`}>{q.priority}</span>
            <span className="t">
              <b>{q.question.pl}</b>
              <span lang="en">{q.question.en}</span>
            </span>
            <span className="ar">{AREA_LABEL[q.area]}</span>
            <MasteryDot value={progress.mastery(q.id)} />
          </a>
        ))}
        {!list.length && (
          <p className="empty">
            Nic nie pasuje do tych filtrów.{' '}
            <button type="button" className="linkbtn" onClick={() => setF(NO_FILTERS)}>Wyczyść filtry</button>
          </p>
        )}
      </div>
    </main>
  );
}

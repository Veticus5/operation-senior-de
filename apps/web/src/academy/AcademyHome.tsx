import { AREA_LABEL, lessons, questionsByTopic } from '@content/index';
import { href } from '../lib/router';
import { useProgress } from '../lib/useProgress';

export function AcademyHome() {
  const progress = useProgress();
  return (
    <main className="page">
      <div className="home">
        <p className="eyebrow">Learning Academy</p>
        <h1>Lekcje</h1>
        <p className="lede">Każda lekcja prowadzi od intuicji przez mechanizm i prawdziwy kod do odpowiedzi na rozmowie.</p>
        <div style={{ marginTop: 48 }}>
          {lessons.map(l => (
            <a key={l.id} className="lesson-row" href={href('academy', l.id)}>
              <h3>{l.title}</h3>
              <span className="m">
                {AREA_LABEL[l.area]} · ok. {l.minutes} min
                <br />
                {progress.lessonCompleted(l.id) ? <b>ukończona</b> : 'do zrobienia'} · pytania w banku: {questionsByTopic(l.topicId).length}
              </span>
              <p>{l.subtitle}</p>
            </a>
          ))}
        </div>
      </div>
    </main>
  );
}

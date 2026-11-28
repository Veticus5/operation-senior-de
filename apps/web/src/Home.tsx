import { lessons, questions } from '@content/index';
import { chapters } from '@content/knowledge-base/index';
import { href } from './lib/router';
import { useProgress } from './lib/useProgress';

export function Home() {
  const progress = useProgress();
  const doneLessons = lessons.filter(l => progress.lessonCompleted(l.id)).length;
  const mastered = questions.filter(q => progress.mastery(q.id) === 'mastered').length;
  const toReview = questions.filter(q => progress.mastery(q.id) === 'review').length;
  return (
    <main className="page">
      <div className="home">
        <p className="eyebrow">Operation Senior Data Engineer</p>
        <h1>Zrozum mechanizm. Potem powiedz to na rozmowie.</h1>
        <p className="lede">Trzy części, jeden cel: kontrakt Senior Data Engineer. Ucz się w Academy, ćwicz odpowiedzi w Banku, wracaj do podstaw w Knowledge Base.</p>
        <div className="doors">
          <a className="door" href={href('academy')}>
            <span className="k">Learning Academy</span>
            <h2>Naucz się</h2>
            <p>Lekcje z symulatorami, prawdziwym kodem i eksperymentami. Tu budujesz zrozumienie.</p>
            <span className="stat">
              lekcje ukończone: {doneLessons} / {lessons.length}
            </span>
          </a>
          <a className="door" href={href('bank')}>
            <span className="k">Interview Bank</span>
            <h2>Powtórz</h2>
            <p>Pytania i odpowiedzi PL/EN, follow-upy, typowe błędy i szybka powtórka przed rozmową.</p>
            <span className="stat">
              opanowane: {mastered} / {questions.length} · do powtórki: {toReview}
            </span>
          </a>
          <a className="door" href={href('kb')}>
            <span className="k">Knowledge Base</span>
            <h2>Utrwal</h2>
            <p>Podręcznik do czytania i powtórek: pojęcia i mechanizmy wyjaśnione od podstaw, także jako PDF.</p>
            <span className="stat">rozdziały: {chapters.length}</span>
          </a>
        </div>
      </div>
    </main>
  );
}

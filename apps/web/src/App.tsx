import { Shell } from './components/Shell';
import { useRoute } from './lib/router';
import { Home } from './Home';
import { AcademyHome } from './academy/AcademyHome';
import { LazyLesson } from './academy/lazy-evaluation/LazyLesson';
import { BankHome } from './interview-bank/BankHome';
import { QuestionView } from './interview-bank/QuestionView';
import { Review } from './interview-bank/Review';
import { meta as lazyMeta } from '@content/spark/lazy-evaluation/lesson';

/** Lekcje mają własne komponenty (symulatory są specyficzne dla tematu). Rejestr: id lekcji -> komponent. */
const LESSONS: Record<string, (props: { stage?: string }) => JSX.Element> = {
  [lazyMeta.id]: LazyLesson
};

export function App() {
  const [section, a, b] = useRoute();
  if (section === 'academy') {
    const Lesson = a ? LESSONS[a] : undefined;
    return <Shell section="academy">{Lesson ? <Lesson stage={b} /> : <AcademyHome />}</Shell>;
  }
  if (section === 'bank') {
    return (
      <Shell section="bank">
        {a === 'review' ? <Review /> : a === 'q' && b ? <QuestionView id={b} /> : <BankHome />}
      </Shell>
    );
  }
  return (
    <Shell section="home">
      <Home />
    </Shell>
  );
}

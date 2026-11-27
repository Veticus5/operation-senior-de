import { Shell } from './components/Shell';
import { useRoute } from './lib/router';
import { Home } from './Home';
import { AcademyHome } from './academy/AcademyHome';
import { LazyLesson } from './academy/lazy-evaluation/LazyLesson';
import { FundamentalsLesson } from './academy/spark-fundamentals/FundamentalsLesson';
import { ExecutionLesson } from './academy/execution-architecture/ExecutionLesson';
import { PartitioningLesson } from './academy/partitioning-shuffle/PartitioningLesson';
import { JoinLesson } from './academy/join-strategies/JoinLesson';
import { SkewLesson } from './academy/data-skew-aqe/SkewLesson';
import { DatabaseLesson } from './academy/database-architecture/DatabaseLesson';
import { SnowflakeLesson } from './academy/snowflake-architecture/SnowflakeLesson';
import { BankHome } from './interview-bank/BankHome';
import { QuestionView } from './interview-bank/QuestionView';
import { Review } from './interview-bank/Review';
import { meta as lazyMeta } from '@content/spark/lazy-evaluation/lesson';
import { meta as fundamentalsMeta } from '@content/spark/fundamentals/lesson';
import { meta as executionMeta } from '@content/spark/execution-architecture/lesson';
import { meta as partitioningMeta } from '@content/spark/partitioning-shuffle/lesson';
import { meta as joinMeta } from '@content/spark/join-strategies/lesson';
import { meta as skewMeta } from '@content/spark/data-skew-aqe/lesson';
import { meta as databaseMeta } from '@content/architecture/database-architecture/lesson';
import { meta as snowflakeMeta } from '@content/snowflake/architecture/lesson';

/** Lekcje mają własne komponenty (symulatory są specyficzne dla tematu). Rejestr: id lekcji -> komponent. */
const LESSONS: Record<string, (props: { stage?: string }) => JSX.Element> = {
  [fundamentalsMeta.id]: FundamentalsLesson,
  [lazyMeta.id]: LazyLesson,
  [executionMeta.id]: ExecutionLesson,
  [partitioningMeta.id]: PartitioningLesson,
  [joinMeta.id]: JoinLesson,
  [skewMeta.id]: SkewLesson,
  [databaseMeta.id]: DatabaseLesson,
  [snowflakeMeta.id]: SnowflakeLesson
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

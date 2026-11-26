import type { Question } from '../types';

/** Pytania: Apache Spark. Fakty liczbowe pochodzą z docs/verified-facts.md albo z dokumentacji. */
export const sparkQuestions: Question[] = [
  {
    id: 'spark-transformations-actions',
    topicId: 'spark.lazy-evaluation',
    area: 'spark',
    priority: 'P0',
    title: 'Transformacje, akcje i lazy evaluation',
    question: {
      pl: 'Czym różni się transformacja od akcji i po co Sparkowi lazy evaluation?',
      en: "What's the difference between a transformation and an action, and why is Spark lazy?"
    },
    answer: {
      pl: 'Transformacje, takie jak filter, select czy groupBy, niczego nie liczą. Dopisują krok do planu i zwracają nowy DataFrame. Akcja, czyli show, count albo zapis, żąda wyniku i dopiero ona uruchamia wykonanie. Spark jest leniwy celowo: widzi całe zapytanie przed wykonaniem, więc może je zoptymalizować jak silnik SQL, czyli czytać tylko potrzebne kolumny i spychać filtry do źródła. Praktyczny skutek jest taki, że między akcjami nic nie jest pamiętane. Jeśli wynik ma posłużyć kilku akcjom, cache\'uję go albo zapisuję.',
      en: "Transformations, like filter, select or groupBy, don't process any data. They add a step to the plan and return a new DataFrame. An action, like show, count or a write, asks for a result, and that is what triggers execution. Spark is lazy on purpose: it sees the whole query before running it, so it can optimize it the way a SQL engine does, reading only the columns it needs and pushing filters down to the source. The practical side is that nothing is remembered between actions. If a result feeds several actions, I cache it or write it out."
    },
    senior: {
      pl: 'Leniwość nie jest absolutna. Odczyt pliku uruchamia mały job po schemat, a jedna akcja to nie zawsze jeden job: to samo show() dało u mnie 2 joby z AQE i 5 bez. Błąd w nazwie kolumny wychodzi od razu, a błąd w danych, np. zły cast, dopiero przy akcji.',
      en: "Lazy isn't absolute. Reading a file already runs a small job to get the schema, and one action isn't always one job: the same show() gave me two jobs with AQE on and five with it off. A wrong column name fails immediately, while a data error such as a bad cast only shows up at the action."
    },
    keywords: ['lazy evaluation', 'plan', 'Catalyst', 'column pruning', 'predicate pushdown', 'cache'],
    followUps: [
      { q: 'Is cache() a transformation or an action?', a: "It's lazy. It only marks the DataFrame to be kept. The data is stored when the first action runs.", pl: 'Sam cache() niczego nie liczy.' },
      { q: 'You call show() and then count() on the same DataFrame. What happens?', a: 'Spark runs the plan twice, including the source read, unless the DataFrame is cached. The exception is when it can reuse shuffle output it still has.', pl: 'Dwie akcje to dwa wykonania planu.' },
      { q: 'Does one action always mean exactly one job?', a: 'No. An action triggers execution of the plan. How many jobs that takes depends on the plan and on settings such as adaptive query execution.', pl: 'Bezpiecznie: „akcja uruchamia wykonanie planu".' },
      { q: 'How do you check what Spark will actually run?', a: 'I call explain and compare the plan I wrote with the optimized one. In the scan node I check ReadSchema and PushedFilters.', pl: 'explain(True) pokazuje wszystkie etapy planu.' }
    ],
    mistakes: [
      'Mówienie, że transformacje „wykonują się w tle". Nie wykonują się wcale, dopóki nie ma akcji.',
      'Twierdzenie, że jedna akcja to zawsze jeden job.',
      'Traktowanie cache() jak akcji, która od razu coś liczy.'
    ]
  },
  {
    id: 'spark-narrow-wide-shuffle',
    topicId: 'spark.shuffle',
    area: 'spark',
    priority: 'P0',
    title: 'Narrow, wide i shuffle',
    question: {
      pl: 'Czym różnią się transformacje narrow i wide? Co wywołuje shuffle?',
      en: 'What is the difference between narrow and wide transformations? Which operations cause a shuffle?'
    },
    answer: {
      pl: 'Transformacja narrow, np. filter albo select, liczy każdą partycję niezależnie, więc dane nie przemieszczają się między executorami. Transformacja wide, np. groupBy, distinct, orderBy albo join dwóch dużych tabel, wymaga, żeby wiersze z tym samym kluczem trafiły do jednej partycji. Spark musi wtedy przegrupować dane i to jest shuffle. Jest kosztowny, bo oznacza serializację, zapis na dysk i transfer po sieci, a do tego wyznacza granicę stage\'a. Dlatego przy optymalizacji zaczynam od planu i sprawdzam, ile jest w nim shuffle\'i i czy każdy jest potrzebny.',
      en: 'A narrow transformation, like filter or select, computes each partition independently, so no data moves between executors. A wide transformation, like groupBy, distinct, orderBy or a join of two large tables, needs all rows with the same key in one partition. Spark has to redistribute the data, and that is a shuffle. It is expensive because it means serialization, disk writes and network transfer, and it also marks a stage boundary. So when I optimize, I start with the plan and check how many shuffles it has and whether each one is needed.'
    },
    senior: {
      pl: 'W planie shuffle to Exchange z rodzajem podziału, np. hashpartitioning. BroadcastExchange to nie shuffle. Operacja wide nie zawsze dodaje shuffle: jeśli dane są już podzielone po tym kluczu, Spark z tego korzysta. Agregacja częściowa przed shuffle\'em zmniejsza ilość przesyłanych danych.',
      en: "In the plan a shuffle is an Exchange with a partitioning, such as hashpartitioning. BroadcastExchange is not a shuffle. A wide operation doesn't always add one: if the data is already partitioned by that key, Spark reuses it. Partial aggregation before the shuffle reduces how much data is sent."
    },
    keywords: ['shuffle', 'Exchange', 'hashpartitioning', 'stage boundary', 'spark.sql.shuffle.partitions'],
    followUps: [
      { q: 'How do you identify a shuffle?', a: 'In explain it is an Exchange node with a partitioning. In the Spark UI it is the boundary between two stages, with shuffle read and write metrics.', pl: 'Exchange w planie, granica stage\'a w UI.' },
      { q: 'How can you reduce shuffling?', a: 'Filter and drop columns before the wide operation, broadcast small tables in joins, and remove distinct, orderBy or repartition calls that are not needed.', pl: 'Najpierw mniej danych, potem strojenie.' },
      { q: 'Does every join require a shuffle?', a: 'No. A broadcast join sends the small table to every executor, so the large side is not shuffled. Data already partitioned by the join key can skip it too.', pl: 'Broadcast ma własny koszt: mała tabela idzie przez driver i sieć.' },
      { q: 'How many partitions do you get after a shuffle?', a: 'spark.sql.shuffle.partitions, 200 by default. With adaptive query execution Spark can merge small ones afterwards.', pl: 'Domyślnie 200, AQE potrafi skleić.' }
    ],
    mistakes: [
      'Mówienie, że shuffle wywołują akcje. Wywołują go transformacje wide, akcja tylko uruchamia wykonanie.',
      'Twierdzenie, że każdy Exchange to shuffle albo że każda operacja wide go dodaje.',
      'Pomijanie kosztu: sama definicja bez „dlaczego to drogie" brzmi jak wyuczona.'
    ]
  },
  {
    id: 'spark-job-stage-task',
    topicId: 'spark.execution-model',
    area: 'spark',
    priority: 'P0',
    title: 'Job, stage, task',
    question: {
      pl: 'Co się dzieje, gdy uruchamiasz job w Sparku? Co to job, stage i task?',
      en: 'Walk me through what happens when you run a Spark job.'
    },
    answer: {
      pl: 'Driver to proces z moim kodem. Buduje i optymalizuje plan, a gdy wywołam akcję, tworzy job. Job dzieli na stage\'e w miejscach, gdzie potrzebny jest shuffle, a każdy stage na taski, po jednym na partycję. Taski wykonują executory: czytają dane, liczą i zapisują wyniki pośrednie jako pliki shuffle. Stąd bierze się znaczenie liczby partycji, bo to liczba tasków, czyli stopień równoległości. Za mało partycji daje duże taski, które nie mieszczą się w pamięci, za dużo daje narzut na planowanie i małe pliki.',
      en: 'The driver is the process that runs my code. It builds and optimizes the plan, and when I call an action it creates a job. It splits the job into stages wherever a shuffle is needed, and each stage into tasks, one per partition. Executors run the tasks: they read the data, compute, and write intermediate results as shuffle files. That is why the number of partitions matters, because it is the number of tasks, so the degree of parallelism. Too few partitions means large tasks that do not fit in memory, too many means scheduling overhead and small files.'
    },
    senior: {
      pl: 'Reguła „akcja to job, shuffle to stage, partycja to task" jest przybliżeniem. Z AQE jedna akcja bywa kilkoma jobami, a liczba tasków po shuffle\'u maleje, bo Spark skleja małe partycje. Stage może też zostać pominięty, gdy jego pliki shuffle już istnieją.',
      en: 'The rule "action is a job, shuffle is a stage, partition is a task" is an approximation. With AQE one action can be several jobs, and the task count after a shuffle drops because Spark merges small partitions. A stage can also be skipped when its shuffle files already exist.'
    },
    keywords: ['driver', 'executor', 'job', 'stage', 'task', 'Spark UI', 'local[N]'],
    followUps: [
      { q: 'What happens if an executor fails?', a: 'Its tasks are retried on another executor. If its shuffle files are lost, Spark recomputes the stage that produced them.', pl: 'Spark zna plan, więc umie odtworzyć brakujący fragment.' },
      { q: 'What runs on the driver?', a: 'Planning, scheduling and collecting results. It does not process the data, except for whatever I pull in with collect or toPandas.', pl: 'collect() na dużych danych zabija driver.' },
      { q: 'What does local[3] mean?', a: 'Spark runs in a single process with three worker threads. There are no separate executors.', pl: 'To wątki, nie executory.' },
      { q: 'Where do you look when a job is slow?', a: 'In the Spark UI: the slowest stage first, then the distribution of task durations and shuffle read sizes inside it.', pl: 'Job, stage, task: zawsze ta sama ścieżka w dół.' }
    ],
    mistakes: [
      'Twierdzenie, że driver przetwarza dane.',
      'Mylenie liczby executorów z liczbą tasków.',
      'Opisywanie local[N] jako N executorów.'
    ]
  },
  {
    id: 'spark-slow-job',
    topicId: 'spark.slow-job-diagnosis',
    area: 'spark',
    priority: 'P0',
    title: 'Diagnostyka wolnego joba',
    question: {
      pl: 'Job, który trwał 10 minut, nagle trwa godzinę. Jak szukasz przyczyny?',
      en: 'A job that used to take 10 minutes now takes an hour. How do you investigate?'
    },
    answer: {
      pl: 'Najpierw ustalam, co się zmieniło: wolumen danych, kod, konfiguracja albo kształt danych ze źródła. Porównuję dobry przebieg ze złym. Potem sprawdzam w Spark UI, gdzie ucieka czas: który stage dominuje i jak wygląda w nim rozkład czasu tasków. Jeden task dużo wolniejszy od mediany to sygnał do sprawdzenia skew, co potwierdzam rozmiarem shuffle read. Jeśli wolne są wszystkie taski, patrzę na spill, GC i rozmiar partycji. W planie sprawdzam, czy join nie zmienił strategii i czy filtry nadal trafiają do źródła. Większy klaster to ostatni krok, nie pierwszy.',
      en: 'First I find out what changed: data volume, code, configuration, or the shape of the upstream data. I compare a good run with a bad one. Then I use the Spark UI to see where the time goes: which stage dominates, and what the task time distribution looks like inside it. One task much slower than the median is a reason to check for skew, which I confirm with its shuffle read size. If all tasks are slow, I look at spill, GC and partition sizes. In the plan I check whether a join changed strategy and whether filters still reach the source. A bigger cluster is the last step, not the first.'
    },
    keywords: ['Spark UI', 'skew', 'spill', 'shuffle read', 'query profile', 'broadcast threshold'],
    followUps: [
      { q: 'What does spill mean?', a: 'A task ran out of execution memory and wrote intermediate data to disk. It works but it is slow. Smaller partitions usually fix it.', pl: 'Spill to objaw za dużych partycji.' },
      { q: 'A dimension table grew and the job got slow. Why?', a: 'It probably crossed the broadcast threshold, so Spark switched from a broadcast join to a sort-merge join with a shuffle.', pl: 'Cicha zmiana strategii joina.' },
      { q: 'How do you do this on serverless?', a: 'There is no Spark UI there, so I use the query profile, which shows time and rows per operator.', pl: 'Na serverless zostaje query profile.' }
    ],
    mistakes: [
      'Zaczynanie od „dałbym większy klaster".',
      'Uznanie jednego wolnego taska za dowód skew bez sprawdzenia rozmiaru danych.',
      'Brak pytania „co się zmieniło".'
    ]
  },
  {
    id: 'spark-data-skew',
    topicId: 'spark.data-skew',
    area: 'spark',
    priority: 'P0',
    title: 'Data skew',
    question: {
      pl: 'Co to jest data skew? Jak go wykrywasz i naprawiasz?',
      en: 'What is data skew? How do you detect it and how do you fix it?'
    },
    answer: {
      pl: 'Skew jest wtedy, gdy kilka kluczy ma nieproporcjonalnie dużo wierszy, np. null, domyślne ID albo jeden bardzo duży klient. Po shuffle\'u wszystkie wiersze z tym samym kluczem trafiają do jednej partycji, więc jeden task mieli wielokrotnie więcej danych niż reszta. Widać to w Spark UI: max czasu taska i shuffle read są daleko od mediany. Potwierdzam zwykłym count po kluczu. Naprawiam w tej kolejności: usuwam przyczynę, np. osobno obsługuję nulle, robię broadcast małej strony, zostawiam to AQE, a gdy to nie wystarcza, solę klucz albo liczę gorący klucz osobno.',
      en: 'Skew is when a few keys hold a disproportionate share of the rows, for example null, a default ID, or one very large customer. After a shuffle all rows with the same key land in one partition, so one task processes far more data than the rest. It shows in the Spark UI: max task time and shuffle read are far above the median. I confirm it with a count by key. I fix it in this order: remove the cause, such as handling nulls separately, broadcast the small side, let AQE handle it, and if that is not enough, salt the key or process the hot key separately.'
    },
    keywords: ['skew', 'hot key', 'shuffle read', 'AQE', 'salting', 'broadcast'],
    followUps: [
      { q: 'Why does adding executors not help?', a: 'One key still goes to one task. More executors only speed up the tasks that were already fast.', pl: 'Jeden klucz to zawsze jedna partycja.' },
      { q: 'Why does increasing shuffle partitions not help?', a: 'Hashing sends a single key to a single partition, no matter how many partitions there are.', pl: 'Więcej partycji nie rozbije jednego klucza.' },
      { q: 'Where does skew come from in real data?', a: 'Nulls in join keys, test or default accounts, and a handful of very large customers.', pl: 'W domenie subskrypcji: kilku dużych publisherów.' }
    ],
    mistakes: [
      'Proponowanie większej liczby partycji albo executorów jako rozwiązania.',
      'Skok od razu do saltingu, bez prostszych kroków.',
      'Brak sposobu potwierdzenia: sam wolny task to jeszcze nie skew.'
    ]
  },
  {
    id: 'spark-aqe',
    topicId: 'spark.aqe',
    area: 'spark',
    priority: 'P0',
    title: 'AQE i jego granice',
    question: {
      pl: 'Kiedy AQE samo poradzi sobie ze skew, a kiedy nie?',
      en: 'When does AQE handle skew for you, and when does it not?'
    },
    answer: {
      pl: 'Adaptive Query Execution poprawia plan w trakcie wykonania, bo po shuffle\'u zna prawdziwe rozmiary partycji. Przy skew dzieli za dużą partycję na mniejsze i powiela pasującą partycję po drugiej stronie joina. Ma jednak warunki. Domyślnie partycja musi być jednocześnie ponad pięć razy większa od mediany i większa niż 256 MB. Działa tylko dla joinów opartych na shuffle\'u, czyli sort-merge i shuffle hash, nie obsługuje żadnej strony full outer joina i nie działa w streamingu. Nie pomaga też na skew w groupBy ani w funkcji okna. Wtedy zostaje salting albo wydzielenie gorącego klucza.',
      en: 'Adaptive Query Execution re-optimizes the plan at runtime, because after a shuffle it knows the real partition sizes. For skew, it splits an oversized partition and replicates the matching partition on the other side of the join. But it has conditions. By default a partition has to be both more than five times the median and larger than 256 megabytes. It only works for shuffle-based joins, meaning sort-merge and shuffle hash, it does not handle either side of a full outer join, and it does not apply to streaming. It also does nothing for skew in a groupBy or a window function. In those cases I salt the key or isolate the hot key.'
    },
    keywords: ['AQE', 'skew join', 'skewedPartitionFactor', '256 MB', 'coalesce partitions', 'isFinalPlan'],
    followUps: [
      { q: 'What else does AQE do?', a: 'It merges small shuffle partitions and can switch a sort-merge join to a broadcast join when one side turns out to be small.', pl: 'Trzy rzeczy: sklejanie partycji, zmiana joina, skew.' },
      { q: 'How do you see that AQE changed the plan?', a: 'The plan has an AdaptiveSparkPlan node with isFinalPlan=true after execution, and a skew-optimized join shows isSkew=true.', pl: 'Porównaj plan początkowy z końcowym.' },
      { q: 'Is AQE on by default?', a: 'Yes, in current Spark and Databricks runtimes.', pl: 'Tak.' }
    ],
    mistakes: [
      '„AQE rozwiązuje skew" bez żadnych warunków.',
      'Nieznajomość progów (5× mediana i 256 MB).',
      'Mylenie AQE z optymalizatorem kosztowym działającym przed wykonaniem.'
    ]
  },
  {
    id: 'spark-salting',
    topicId: 'spark.salting',
    area: 'spark',
    priority: 'P0',
    title: 'Salting',
    question: { pl: 'Co to jest salting i ile kosztuje?', en: 'What is salting and what does it cost you?' },
    answer: {
      pl: 'Salting rozrzuca jeden gorący klucz na kilka partycji przez doklejenie losowego sufiksu. Po skośnej stronie dodaję kolumnę z losową liczbą od 0 do N-1 i łączę albo grupuję po kluczu razem z tą solą. Przy joinie drugą stronę trzeba powielić N razy, po jednym wierszu na każdą wartość soli. Przy agregacji robię dwa kroki: najpierw po kluczu i soli, potem po samym kluczu. Koszt to większa druga strona joina, dodatkowa agregacja i mniej czytelny kod. Dwustopniowa agregacja działa też tylko dla wyników, które da się złożyć, np. sum, a nie dokładnego count distinct.',
      en: 'Salting spreads one hot key over several partitions by adding a random suffix. On the skewed side I add a column with a random number from zero to N minus one, and I join or group on the key plus that salt. For a join the other side has to be replicated N times, one row per salt value. For an aggregation I do two steps: first by key and salt, then by key alone. The cost is a larger other side of the join, an extra aggregation, and code that is harder to read. Two-step aggregation also only works for results that can be combined, like sums, not an exact distinct count.'
    },
    keywords: ['salting', 'hot key', 'explode', 'two-phase aggregation'],
    followUps: [
      { q: 'How do you choose N?', a: 'Roughly the size of the hot partition divided by the partition size I want.', pl: 'Z danych, nie z sufitu.' },
      { q: 'When would you not salt?', a: 'When the other side is small enough to broadcast, or when AQE already handles the join.', pl: 'Salting to ostatni krok, nie pierwszy.' },
      { q: 'How do you salt only the hot keys?', a: 'I find them with a count, salt only those rows, and give the rest a salt of zero.', pl: 'Mniejszy koszt niż solenie wszystkiego.' }
    ],
    mistakes: [
      'Zapominanie o powieleniu drugiej strony joina.',
      'Przemilczenie kosztu.',
      'Proponowanie saltingu, gdy wystarczy broadcast.'
    ]
  },
  {
    id: 'spark-broadcast-join',
    topicId: 'spark.broadcast-join',
    area: 'spark',
    priority: 'P0',
    title: 'Broadcast join',
    question: {
      pl: 'Kiedy używasz broadcast joina i co może pójść nie tak?',
      en: 'When would you use a broadcast join? What can go wrong?'
    },
    answer: {
      pl: 'Gdy jedna strona joina jest na tyle mała, że mieści się w pamięci, Spark może wysłać jej kopię do każdego executora i łączyć przez wyszukiwanie w tablicy hashującej. Duża strona nie jest wtedy ani shuffle\'owana, ani sortowana, więc to zwykle najszybszy join. Spark wybiera go sam poniżej progu, domyślnie 10 MB, a AQE potrafi przełączyć się na niego w trakcie. Mogę go też wymusić hintem. Ryzyka: mała tabela przechodzi przez driver, więc jeśli jest większa, niż zakładałem, kończy się brakiem pamięci albo timeoutem. Nie działa też dla każdego typu joina, np. full outer z niego nie skorzysta.',
      en: 'When one side of a join is small enough to fit in memory, Spark can send a copy of it to every executor and join by hash lookup. The large side is then neither shuffled nor sorted, so it is usually the fastest join. Spark picks it automatically below a threshold, 10 megabytes by default, and AQE can switch to it at runtime. I can also force it with a hint. The risks: the small table goes through the driver, so if it is larger than I assumed, I get an out-of-memory error or a timeout. It also does not work for every join type, for example a full outer join cannot use it.'
    },
    keywords: ['broadcast hash join', 'autoBroadcastJoinThreshold', '10 MB', 'BroadcastExchange', 'hint'],
    followUps: [
      { q: 'Which setting controls it?', a: 'spark.sql.autoBroadcastJoinThreshold. Setting it to minus one turns automatic broadcast off.', pl: 'Na Databricks próg adaptacyjny to 30 MB.' },
      { q: 'What is the default join for two large tables?', a: 'Sort-merge join: both sides are shuffled by key and sorted.', pl: 'Dwa shuffle i sortowanie.' },
      { q: 'Which side can be broadcast in a left outer join?', a: 'Only the right side. The preserved side cannot be the broadcast one.', pl: 'Strona zachowywana nie może być broadcastowana.' }
    ],
    mistakes: [
      'Wymuszanie hintu bez znajomości rozmiaru tabeli.',
      'Twierdzenie, że broadcast „nie przesyła danych". Przesyła małą tabelę.',
      'Nieznajomość progu.'
    ]
  },
  {
    id: 'spark-repartition-coalesce',
    topicId: 'spark.repartition-coalesce',
    area: 'spark',
    priority: 'P1',
    title: 'Repartition i coalesce',
    question: {
      pl: 'Czym różni się repartition od coalesce?',
      en: 'What is the difference between repartition and coalesce?'
    },
    answer: {
      pl: 'Repartition robi pełny shuffle. Może zwiększyć albo zmniejszyć liczbę partycji i może dzielić po kolumnach. Bez kolumn rozkłada wiersze mniej więcej po równo, a po kluczu dzieli hashem, więc przy skośnym kluczu partycje nadal będą nierówne. Coalesce tylko zmniejsza liczbę partycji przez sklejanie istniejących, bez pełnego shuffle\'u. Jest tańszy, ale wynik bywa nierówny. Repartition biorę, gdy potrzebuję równego rozłożenia albo danych ułożonych po kluczu, coalesce, żeby na końcu zmniejszyć liczbę plików. Pułapka: coalesce(1) potrafi ściągnąć małą równoległość w górę planu.',
      en: 'Repartition does a full shuffle. It can increase or decrease the number of partitions and can partition by columns. Without columns it spreads rows roughly evenly, and by key it uses a hash, so with a skewed key the partitions will still be uneven. Coalesce only reduces the number of partitions by merging existing ones, without a full shuffle. It is cheaper, but the result can be uneven. I use repartition when I need an even spread or data laid out by key, and coalesce to reduce the number of output files at the end. One trap: coalesce(1) can pull the low parallelism upstream in the plan.'
    },
    keywords: ['repartition', 'coalesce', 'round-robin', 'small files', 'optimized writes'],
    followUps: [
      { q: 'How many partitions should a job have?', a: 'Enough that each is roughly 100 to 200 megabytes. With AQE I start high and let it merge.', pl: 'Rozmiar partycji, nie magiczna liczba.' },
      { q: 'What is the small files problem?', a: 'Many tiny files make listing and reads slow. It comes from too many output partitions or frequent small writes.', pl: 'Na Delcie pomaga OPTIMIZE i optimized writes.' },
      { q: 'Why can coalesce(1) be slow?', a: 'It does not create a stage boundary, so the upstream computation can end up running in a single task.', pl: 'repartition(1) zostawia wcześniejszą pracę równoległą.' }
    ],
    mistakes: [
      'Twierdzenie, że repartition gwarantuje równe partycje.',
      'Mówienie, że coalesce nigdy nie przenosi danych. Skleja partycje, więc dane mogą zmienić węzeł.',
      'Ręczne strojenie tam, gdzie wystarczy AQE.'
    ]
  }
];

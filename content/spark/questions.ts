import type { Question } from '../types';

/**
 * Pytania: Apache Spark.
 *
 * Źródła: dokumentacja i pomiary spisane w docs/verified-facts.md. Liczby opisane w polu `explain` jako
 * pomiar pochodzą z labs/interview_bank/spark_checks.py oraz labs/lazy_evaluation/*.py (PySpark 4.0.1
 * i 4.3.0, local[3]). To obserwacje z lokalnego uruchomienia, nie gwarancje Sparka.
 *
 * Odpowiedzi do powiedzenia na głos nie używają pierwszej osoby dla pomiarów („zmierzyłem"), dopóki
 * uczący się sam nie uruchomił labu. Zamiast tego: „w lokalnym teście".
 */
export const sparkQuestions: Question[] = [
  {
    id: 'spark-architecture-basics',
    topicId: 'spark.fundamentals',
    area: 'spark',
    priority: 'P0',
    title: 'Czym jest Spark: driver, executory, partycje',
    question: {
      pl: 'Czym jest Apache Spark i co się dzieje, gdy uruchamiasz aplikację? Opisz rolę drivera, executorów i partycji.',
      en: 'What is Apache Spark, and what happens when you run a Spark application? Walk me through the driver, the executors and partitions.'
    },
    answer: {
      pl: 'Spark to rozproszony silnik do przetwarzania danych, które są za duże albo za wolne dla jednej maszyny. Opisuję zapytanie w SQL albo na DataFrame\'ach, a Spark rozkłada pracę na klaster. Aplikacja ma jeden driver i zestaw executorów. Driver wykonuje mój program, buduje plan, dzieli go na taski i je rozdziela. Executory to procesy robocze, które faktycznie czytają i liczą dane. Same dane są pocięte na partycje, a w ramach stage\'a jeden task przetwarza jedną partycję, więc partycja jest jednostką równoległości. Naraz działa najwyżej tyle tasków, ile jest wolnych rdzeni na executorach, domyślnie jeden rdzeń na task, więc równoległość ograniczają i partycje, i rdzenie. Driver głównie koordynuje, dlatego nie ściągam do niego dużych wyników, tylko zapisuję je do storage.',
      en: "Spark is a distributed engine for processing data that's too big or too slow for one machine. I describe a query in SQL or with DataFrames, and Spark splits the work across a cluster. An application has one driver and a set of executors. The driver runs my program, builds the plan, breaks it into tasks and schedules them. Executors are worker processes that read and compute the data. The data is split into partitions, and within a stage one task processes one partition, so a partition is the unit of parallelism. At most as many tasks run at once as there are free executor cores, one core per task by default, so parallelism is capped by both partitions and cores. The driver mostly coordinates, so I write large results to storage instead of pulling them back."
    },
    senior: {
      pl: 'Kilka zastrzeżeń. Jeden task na partycję obowiązuje w ramach stage\'a: zapytanie z joinem albo agregacją ma często kilka stage\'y, z shuffle\'em tam, gdzie dane trzeba przegrupować. Broadcast join albo dane już podzielone po kluczu pozwalają go uniknąć. Driver to nie tylko koordynator, bo odbiera też zebrane wyniki i może zabraknąć mu pamięci. W trybie lokalnym nie ma osobnych executorów, są wątki w jednym procesie. Na Spark Connect, którego używa serverless w Databricks, mój kod jest cienkim klientem, a driver działa po stronie serwera. Awarie są obsługiwane na poziomie taska: nieudany task jest ponawiany, a utracone partycje są liczone od nowa z planu.',
      en: "A few qualifications. One task per partition holds within a stage: a query with a join or an aggregation often has several stages, with a shuffle wherever data has to be redistributed. A broadcast join or data already partitioned on the key can avoid it. The driver isn't only a coordinator, because it also receives collected results and can run out of memory. In local mode there are no separate executors, just threads in one process. With Spark Connect, which Databricks serverless uses, my code is a thin client and the driver lives on the server. And failures are handled per task: a failed task is retried, and lost partitions are recomputed from the plan."
    },
    explain: [
      'Jedna maszyna ma sufit: pamięć i czas. Spark obchodzi go, tnąc dane na <term id="partition">partycje</term> i licząc je równolegle na wielu maszynach. Żeby nie pisać tego ręcznie, opisujesz zapytanie na DataFrame, czyli tabeli z nazwanymi kolumnami, albo w SQL. Oba zapisy wykonuje ten sam silnik.',
      'Aplikacja to jeden <b>driver</b> i wiele <b>executorów</b>. Driver to proces z Twoim programem: układa plan, dzieli go na taski i wysyła je executorom. Executor to proces roboczy na maszynie klastra, który wykonuje taski i trzyma dane. Każda aplikacja ma własne executory. Domyślnie działają przez cały czas jej życia, a przy włączonej dynamicznej alokacji Spark dodaje je i usuwa w trakcie. Maszyny przydziela <term id="cluster-manager">menedżer klastra</term>.',
      'W ramach etapu jeden task liczy jedną partycję. Liczba partycji wyznacza więc liczbę tasków, a jednocześnie działa ich najwyżej tyle, ile jest wolnych rdzeni (domyślnie jeden rdzeń na task). Pomiar lokalny: 12 partycji przy <term id="local-mode">local[3]</term> dało 12 tasków, naraz najwyżej 3. Dokumentacja podaje jako punkt wyjścia 2–4 partycje na rdzeń.',
      'Driver zwykle nie przetwarza wierszy, ale <code>collect()</code> i <code>toPandas()</code> ściągają do niego cały wynik. Apache Spark przerywa job, gdy wyniki akcji przekroczą <code>spark.driver.maxResultSize</code>, domyślnie 1 GB.'
    ],
    keywords: ['driver', 'executor', 'partition', 'task', 'cluster manager', 'DataFrame'],
    followUps: [
      { q: 'What is the difference between Apache Spark, PySpark and Databricks?', a: "Spark is the open-source engine. PySpark is its Python API, so my Python code describes the query and the engine, which runs on the JVM, executes it. Databricks is a commercial platform built on Spark: it manages the clusters and adds its own pieces, such as notebooks, jobs and the Photon engine. Code is largely portable, but defaults and available features differ.", pl: 'Silnik, API w Pythonie, platforma. Kod się przenosi, wartości domyślne i funkcje niekoniecznie.' },
      { q: 'You have 100 executor cores and a DataFrame with 4 partitions. How many tasks run in parallel?', a: "Four at most for that stage, because there's one task per partition. The other cores sit idle. I'd look at how the input is split and repartition if the amount of work justifies it.", pl: 'Najwyżej 4. Partycji jest mniej niż rdzeni, więc reszta stoi.' },
      { q: 'What happens if an executor dies in the middle of a job?', a: "Its running tasks fail and Spark reschedules them on other executors, up to a retry limit per task. Data that lived only on that executor, such as cached partitions, is recomputed from the plan. So the job usually slows down rather than fails.", pl: 'Taski są ponawiane, a utracone partycje liczone od nowa. W Apache Spark job przerywa domyślnie czwarta z rzędu porażka tego samego taska.' },
      { q: 'Why is collect() dangerous on a large DataFrame?', a: "Because it brings every row from the executors into the driver, which is a single process with limited memory. The docs warn that it can throw an out-of-memory error. I use take or show to look at data, aggregate before collecting, and write large results to storage.", pl: 'Cały wynik trafia do jednego procesu. Do podglądu take albo show, duże wyniki do storage.' },
      { q: 'Does the driver ever process data?', a: "Yes, sometimes. It holds collected results, and in open-source Spark it builds the small side of a broadcast join. A very small query can even be answered on the driver without launching any tasks. So saying the driver never touches data is too strong.", pl: 'Tak: zebrane wyniki, mała strona broadcast joina, bardzo małe zapytania lokalne.' }
    ],
    mistakes: [
      'Mówienie, że liczba partycji to liczba tasków działających jednocześnie. Partycje wyznaczają liczbę tasków w etapie, a naraz działa ich najwyżej tyle, ile jest wolnych rdzeni.',
      'Twierdzenie, że driver nigdy nie przetwarza danych. Zebrane wyniki trafiają właśnie do niego.',
      'Nazywanie wątków w trybie local[N] executorami. To jeden proces z N wątkami roboczymi.',
      'Utożsamianie Sparka z Databricks albo traktowanie PySparka jak osobnego silnika napisanego w Pythonie.'
    ]
  },
  {
    id: 'spark-vs-pandas-warehouse',
    topicId: 'spark.fundamentals',
    area: 'spark',
    priority: 'P1',
    title: 'Spark, pandas czy hurtownia',
    question: {
      pl: 'Kiedy wybrałbyś Sparka, a kiedy pandas albo hurtownię danych taką jak Snowflake?',
      en: 'When would you choose Spark over pandas or a data warehouse like Snowflake?'
    },
    answer: {
      pl: 'Zaczynam od trzech pytań: ile jest danych, gdzie leżą i czy wystarczy SQL. Jeśli dane swobodnie mieszczą się w pamięci jednej maszyny, pandas jest najprostszy, a klaster to tylko narzut. Jeśli dane są już w hurtowni, a transformacje to SQL, zostawiam je tam. Hurtownia też jest rozproszona, a wyciąganie danych oznacza drugi system do utrzymania. Spark ma sens, gdy dane to pliki w object storage w skali większej niż jedna maszyna, gdy logika wychodzi poza SQL w stronę własnego kodu w Pythonie albo gdy te same dane mają zasilać batch, streaming i machine learning. Daje więcej kontroli, a ceną jest to, że partycje, rozmiar klastra i strojenie stają się moim problemem.',
      en: "I'd start from three questions: how much data, where it lives, and whether SQL is enough. If the data fits comfortably in memory on one machine, pandas is the simplest tool and a cluster only adds overhead. If the data is already in a warehouse and the transformations are SQL, I'd keep it there. A warehouse is distributed too, and moving the data out means a second system to run. Spark earns its place when the data is files in object storage at a scale beyond one machine, when the logic goes past SQL into custom Python, or when the same data has to feed batch, streaming and machine learning. It gives me more control, and the price is that partitions, cluster sizing and tuning become my problem."
    },
    senior: {
      pl: 'Granice się zacierają, więc argumentuję od obciążenia, a nie od marki. Spark ma pandas API wykonywane rozproszenie, Databricks oferuje SQL warehouses na Sparku, a Snowflake obsługuje tabele Iceberg przechowywane poza usługą. Biorę też pod uwagę kompetencje zespołu i utrzymanie: platforma zarządzana zdejmuje dużą część pracy przy klastrze, ale układ danych i koszty nadal są moje. Samo „big data" nie jest powodem, żeby sięgać po Sparka. Kilkaset gigabajtów ustrukturyzowanych danych i transformacje w SQL to zwykłe zadanie dla hurtowni.',
      en: "The lines are blurring, so I argue from the workload, not the brand. Spark has a pandas API that runs distributed, Databricks offers SQL warehouses on top of Spark, and Snowflake can work with Iceberg tables stored outside the service. I also weigh team skills and operations: a managed platform removes much of the cluster work, but data layout and cost are still mine. And big data alone isn't a reason to reach for Spark. A few hundred gigabytes of structured data with SQL transformations is a normal warehouse job."
    },
    explain: [
      'W zwykłym użyciu pandas wczytuje cały zbiór do pamięci jednego procesu. Jego dokumentacja mówi wprost, że zbiory większe niż pamięć są kłopotliwe, a nieporęczne robią się już te, które zajmują jej znaczną część, bo niektóre operacje tworzą kopie pośrednie. Czytanie porcjami pomaga przy prostych operacjach, ale np. <code>groupby</code> jest wtedy dużo trudniejsze. Dopóki danych jest mało, pandas to zaleta: zero infrastruktury i wynik od razu.',
      'Hurtownia taka jak Snowflake jest rozproszona, tylko tego nie widać. Virtual warehouse to klaster obliczeniowy, a usługa sama decyduje o zapisie i podziale danych. Jeśli dane już tam są i wystarcza SQL, dostajesz skalę bez zarządzania klastrem.',
      'Spark to sam silnik obliczeń. Czyta pliki z Twojego storage (Parquet, JSON, CSV i inne), pozwala mieszać SQL z kodem w Pythonie i tym samym silnikiem obsługuje batch, streaming i machine learning. W zamian widzisz i stroisz to, co hurtownia ukrywa: <term id="partition">partycje</term>, <term id="executor">executory</term> i pamięć <term id="driver">drivera</term>.',
      'Granice się zacierają. Spark ma pandas API on Spark, Databricks ma SQL warehouses napędzane Sparkiem, a Snowflake obsługuje tabele Iceberg w zewnętrznym storage. Dlatego dobra odpowiedź zaczyna się od obciążenia, a nie od nazwy narzędzia.'
    ],
    keywords: ['pandas', 'data warehouse', 'Snowflake', 'object storage', 'scale out', 'pandas API on Spark'],
    followUps: [
      { q: 'Your pandas job no longer fits in memory. What are your options before moving to Spark?', a: "First I'd reduce what I load: only the columns I need, more compact data types, and processing in chunks when the logic needs little coordination between chunks. A bigger machine is a legitimate short-term fix. If the data keeps growing or the job has to run reliably every day, I'd move it to an engine that scales out: the warehouse if the data belongs there, otherwise Spark.", pl: 'Najpierw mniej danych w pamięci (kolumny, typy, porcje), potem większa maszyna, na końcu silnik rozproszony.' },
      { q: 'The data is already in Snowflake. Someone suggests moving the pipeline to Spark because it is faster. What do you say?', a: "I'd ask what problem we're solving. A warehouse already runs queries on a distributed cluster, so Spark being faster isn't a given. Moving means exporting data, running a second platform and retraining the team. I'd want a concrete need the warehouse can't meet, like custom code, streaming, or an open table format shared with other engines.", pl: 'Najpierw pytanie o problem. Hurtownia też jest rozproszona, a migracja to drugi system i koszt.' },
      { q: 'What does Spark give you that a warehouse does not?', a: "Control and breadth. It works on open file formats in my own storage, it lets me mix SQL with arbitrary Python or Scala, and one engine covers batch, streaming and machine learning. The cost is operational: I have to think about partitions, executors and failures that a warehouse hides from me.", pl: 'Kontrola i zakres zastosowań w zamian za pracę operacyjną, którą hurtownia ukrywa.' },
      { q: 'What is the pandas API on Spark and when would you use it?', a: "It's a pandas-style API that executes on Spark, so pandas-like code can run distributed across a cluster. It's useful for scaling existing pandas code without a full rewrite. I wouldn't treat it as identical to pandas: the data lives on many machines, so the index and some operations behave differently and can be expensive.", pl: 'Składnia pandas na silniku Sparka. Przydatne przy migracji, ale to nie jest to samo co pandas.' }
    ],
    mistakes: [
      'Odpowiedź „Spark, bo big data" bez pytania o rozmiar danych, miejsce, w którym leżą, i rodzaj logiki.',
      'Twierdzenie, że hurtownia nie jest rozproszona albo że Spark jest z definicji szybszy.',
      'Pomijanie kosztu operacyjnego: drugi system, strojenie partycji i klastra, kompetencje zespołu.'
    ]
  },
  {
    id: 'spark-transformations-actions',
    topicId: 'spark.lazy-evaluation',
    labIds: ['spark-lazy-evaluation-lab'],
    area: 'spark',
    priority: 'P0',
    title: 'Transformacje, akcje i lazy evaluation',
    question: {
      pl: 'Czym różni się transformacja od akcji i po co Sparkowi lazy evaluation?',
      en: "What's the difference between a transformation and an action, and why is Spark lazy?"
    },
    answer: {
      pl: 'Transformacje, takie jak filter, select czy groupBy, nie przetwarzają wierszy. Dopisują krok do planu i zwracają nowy DataFrame. Akcja, czyli show, count albo zapis, żąda wyniku i dopiero ona uruchamia wykonanie. Spark jest leniwy celowo: widzi całe zapytanie przed wykonaniem, więc może je zoptymalizować jak silnik SQL, czyli czytać tylko potrzebne kolumny i spychać filtry do źródła. Praktyczny skutek jest taki, że Spark domyślnie nie przechowuje wyników między akcjami, więc kolejna akcja może policzyć część albo całość planu od nowa. Jeśli wynik ma posłużyć kilku akcjom, cache\'uję go, a jeśli ma przetrwać job, zapisuję go do tabeli.',
      en: "Transformations, like filter, select or groupBy, don't process rows. They add a step to a plan and return a new DataFrame. An action, like show, count or a write, asks for a result, and that is what triggers execution. Spark is lazy on purpose: it sees the whole query before running it, so it can optimize it the way a SQL engine does, reading only the columns it needs and pushing filters down to the source. The practical side is that Spark doesn't keep results between actions by default, so another action may recompute part or all of the plan. If a result feeds several actions, I cache it, and if it has to outlive the job, I write it to a table."
    },
    senior: {
      pl: 'Leniwość nie jest absolutna. Utworzenie DataFrame ze ścieżki Parquet potrafi odczytać metadane pliku, żeby ustalić schemat, choć wierszy nie przetwarza. Jedna akcja to nie zawsze jeden job: w lokalnym teście na Sparku 4 to samo show() dało 2 joby z AQE i 5 bez. W klasycznym Sparku zła nazwa kolumny wychodzi przy definicji, a błąd w danych, np. zły cast, dopiero gdy akcja faktycznie wyliczy to wyrażenie. Na Spark Connect także sprawdzenie nazw jest odłożone. Cache to nie tabela: wypełnia się leniwie, może zostać usunięty z pamięci i wtedy Spark liczy od nowa.',
      en: "Lazy isn't absolute. Creating a DataFrame from a Parquet path can read file metadata to resolve the schema, although no rows are processed. One action isn't always one job: in a local Spark 4 test the same show() was two jobs with AQE on and five with it off. In classic Spark a wrong column name fails at definition, while a data error such as a bad cast shows up only when an action actually evaluates that expression. On Spark Connect the name check is deferred too. And a cache is not a table: it fills lazily, it can be evicted, and then Spark recomputes."
    },
    explain: [
      'Python wykonuje kod linijka po linijce, więc Spark nie wie, czy po <code>filter</code> przyjdzie jeszcze <code>select</code>. Dlatego transformacja tylko dopisuje krok do planu, a liczenie rusza, gdy akcja zażąda wyniku. Wtedy <term id="optimizer">optymalizator</term> widzi całość: prosi źródło tylko o potrzebne kolumny (<term id="column-pruning">column pruning</term>) i przekazuje mu warunek filtra (<term id="predicate-pushdown">predicate pushdown</term>).',
      'Granice leniwości, pomiar lokalny: <code>read.parquet</code> ze ścieżki uruchomił 1 <term id="job">job</term> po <term id="schema">schemat</term>, wierszy nie czytał. Z podanym schematem albo z tabeli z katalogu było 0 jobów. <code>pivot</code> bez listy wartości policzył je od razu, przy definicji.',
      'Druga akcja: <code>show()</code>, potem <code>count()</code> przepuściły każdy wiersz przez filtr dwa razy. Wyjątek: dwa razy <code>collect()</code> na tym samym DataFrame z <term id="shuffle">shuffle\'em</term> w planie użyło ponownie zapisanych wyników shuffle\'u. Stąd ostrożne „may be recomputed" w dokumentacji.',
      '<code>cache()</code> to tymczasowa kopia na czas sesji. Wypełnia się przy pierwszej akcji i tylko tymi <term id="partition">partycjami</term>, które akcja policzyła (w labie <code>take(1)</code> zapamiętało 1 z 3). Spark może usunąć ją z pamięci, a wtedy liczy brakującą część od nowa. Trwały wynik daje dopiero zapis do tabeli.'
    ],
    keywords: ['lazy evaluation', 'plan', 'Catalyst', 'column pruning', 'predicate pushdown', 'cache'],
    followUps: [
      { q: 'Is cache() a transformation or an action?', a: "It doesn't trigger any work on its own. cache() is lazy: it only marks the DataFrame to be kept. The data is stored when an action computes it, partition by partition, and later actions read from there.", pl: 'W labie licznik po samym cache() pokazywał 0. Cache dostaje tylko te partycje, które akcja policzyła.' },
      { q: 'You call show() and then count() on the same DataFrame. What happens?', a: 'Without a cache Spark may recompute part or all of the plan. In a small local test it ran the whole plan twice, including the source read. Spark can skip work when it can reuse shuffle output it still has, which is why the docs say a result "may be recomputed".', pl: 'Bez cache: „może policzyć od nowa". Wyjątek: ponowne użycie wyników shuffle\'u.' },
      { q: 'Does one action always mean exactly one job?', a: 'No. An action triggers execution of the plan, and how many jobs that takes depends on the plan, the version and the configuration, for example adaptive query execution.', pl: 'Bezpieczne sformułowanie: akcja uruchamia wykonanie planu.' },
      { q: 'Is reading a file lazy as well?', a: "Mostly. spark.read doesn't load the rows, but Spark needs a schema. For a Parquet path it can read file metadata right away. For CSV with inferSchema it has to scan the data, so in production I pass an explicit schema or read a table from the catalog.", pl: 'Lab: read.parquet ze ścieżki 1 job, z podanym schematem 0, CSV z inferSchema dodatkowy przebieg po danych.' },
      { q: 'When do you find out about an error in a transformation?', a: 'It depends on the kind of error and on the mode. In classic Spark a wrong column name fails right away, because the plan is checked against the schema when I define it. A data problem, like a bad cast under ANSI mode, only shows up when an action evaluates that expression. On Spark Connect even the name check is deferred.', pl: 'Błąd planu od razu (tryb klasyczny), błąd danych przy akcji, o ile akcja używa tej kolumny.' },
      { q: 'What is the difference between cache(), persist() and writing to a table?', a: 'cache() is persist() with the default storage level, memory and disk for DataFrames. Both keep the plan, so if cached data is evicted or lost Spark recomputes it. Writing to a table gives me a durable result that other jobs can read and cuts the dependency on the upstream plan.', pl: 'Cache dla jednego joba i kilku akcji, tabela dla wszystkiego, co ma przetrwać.' },
      { q: 'How do you check what Spark will actually run?', a: "I call explain and compare the plan I wrote with the optimized one. In the scan node I check ReadSchema for column pruning and PushedFilters for pushdown. PushedFilters only tells me what was passed to the source, not how much data was skipped.", pl: 'explain(True) pokazuje wszystkie etapy planu. PushedFilters to „przekazano", nie „zaoszczędzono".' }
    ],
    mistakes: [
      'Mówienie, że transformacje „wykonują się w tle". Nie przetwarzają wierszy, dopóki nie ma akcji.',
      'Twierdzenie, że Spark przed akcją niczego nie czyta. Schemat potrafi odczytać z metadanych pliku od razu.',
      'Twierdzenie, że jedna akcja to zawsze jeden job albo że każda akcja zawsze liczy wszystko od nowa.',
      'Traktowanie cache() jak akcji, która od razu coś liczy, albo jak trwałej tabeli.'
    ]
  },
  {
    id: 'spark-narrow-wide-shuffle',
    topicId: 'spark.shuffle',
    labIds: ['spark-partitioning-shuffle-lab'],
    area: 'spark',
    priority: 'P0',
    title: 'Narrow, wide i shuffle',
    question: {
      pl: 'Czym różnią się transformacje narrow i wide? Co wywołuje shuffle?',
      en: 'What is the difference between narrow and wide transformations? Which operations cause a shuffle?'
    },
    answer: {
      pl: 'Transformacja narrow, np. filter albo select, buduje każdą partycję wyniku z jednej albo kilku całych partycji wejścia i żadnej partycji wejścia nie rozdziela między wiele partycji wyniku, więc niczego nie trzeba przegrupowywać. Coalesce bez shuffle\'u też jest narrow. Zależność wide oznacza, że rekordy z jednej partycji wejścia trzeba rozdać do wielu partycji wyniku, i to przegrupowanie to shuffle. groupBy, distinct, orderBy i join dużych tabel zwykle go wymagają, żeby pasujące klucze spotkały się w jednej partycji, ale decyduje plan fizyczny: dane już podzielone po kluczu albo broadcast join pozwalają go uniknąć. Shuffle jest kosztowny, bo oznacza serializację, zapis na dysk i transfer po sieci, a do tego wyznacza granicę stage\'a. Dlatego przy optymalizacji zaczynam od planu i sprawdzam, ile jest w nim shuffle\'i i czy każdy jest potrzebny.',
      en: 'A narrow transformation, like filter or select, builds each output partition from one or a few whole input partitions, and no input partition is split across many outputs, so nothing has to be redistributed. Coalesce without a shuffle is narrow too. A wide dependency means records from one input partition must be spread across many outputs, and that redistribution is a shuffle. groupBy, distinct, orderBy and joins of large tables usually need one, so that matching keys meet in the same partition, but the physical plan decides: data already partitioned by the key, or a broadcast join, can avoid it. A shuffle is expensive because it means serialization, disk writes and network transfer, and it also marks a stage boundary. So when I optimize, I start with the plan: how many shuffles it has and whether each one is needed.'
    },
    senior: {
      pl: 'W planie shuffle to Exchange z rodzajem podziału, np. hashpartitioning. BroadcastExchange to nie shuffle. Operacja wide nie zawsze dodaje shuffle: jeśli dane są już podzielone po tym kluczu, Spark z tego korzysta. To, co wędruje, też zależy od operacji: agregacja przesyła wyniki częściowe per klucz, a nie każdy wiersz, a repartition bez kolumn w ogóle nie patrzy na klucze.',
      en: "In the plan a shuffle is an Exchange with a partitioning, such as hashpartitioning. BroadcastExchange is not a shuffle. A wide operation doesn't always add one: if the data is already partitioned by that key, Spark reuses it. What moves also depends on the operation: an aggregation ships partial results per key rather than every row, and a repartition without columns ignores keys altogether."
    },
    explain: [
      'Dane w Sparku są pocięte na <term id="partition">partycje</term>, liczone równolegle. Dopóki każda partycja wyniku powstaje z jednej albo kilku całych partycji wejścia, jak przy <code>filter</code>, <code>select</code> czy <code>coalesce</code>, niczego nie trzeba rozdawać. To zależność narrow. Gdy rekordy z jednej partycji wejścia muszą trafić do wielu partycji wyniku, Spark musi je przetasować. To <term id="shuffle">shuffle</term>, a zależność nazywa się wide.',
      'Co dokładnie wędruje, zależy od operacji. Pomiar lokalny na 100 000 wierszy i 50 kluczach: sort-merge join zapisał do shuffle\'u wszystkie 100 000 wierszy dużej strony. <code>groupBy</code> z sumą zapisał 150 rekordów, bo Spark najpierw agreguje w każdej partycji wejścia (50 kluczy razy 3 partycje) i przesyła już wynik częściowy. W małym labie podpiętym do tego pytania to samo widać na 12 wierszach: do shuffle\'u trafia 10 rekordów.',
      'Sposób podziału też się różni. Hash po kluczu i podział zakresami (<code>repartitionByRange</code>, tak dzieli też <code>orderBy</code>) trzymały jeden klucz w jednej partycji. <code>repartition(8)</code> bez kolumn rozdaje wiersze po kolei: jeden klucz trafił do wszystkich 8 partycji.',
      'W planie shuffle to węzeł <code>Exchange</code>. Liczbę partycji po nim ustawia <code>spark.sql.shuffle.partitions</code>, w Apache Spark domyślnie 200. <term id="aqe">AQE</term> potrafi potem skleić małe.'
    ],
    keywords: ['shuffle', 'Exchange', 'hashpartitioning', 'stage boundary', 'spark.sql.shuffle.partitions'],
    followUps: [
      { q: 'How do you identify a shuffle?', a: 'In explain it is an Exchange node with a partitioning. In the Spark UI it is the boundary between two stages, with shuffle read and write metrics.', pl: 'Exchange w planie, granica stage\'a w UI.' },
      { q: 'How can you reduce shuffling?', a: 'Filter and drop columns before the wide operation, broadcast small tables in joins, and remove distinct, orderBy or repartition calls that are not needed.', pl: 'Najpierw mniej danych, potem strojenie.' },
      { q: 'Does every join require a shuffle?', a: 'No. A broadcast hash join sends the small table to every executor, so the large side is not shuffled. Data already partitioned by the join key can skip it too.', pl: 'Broadcast ma własny koszt: mała tabela jest rozsyłana do wszystkich executorów.' },
      { q: 'How many partitions do you get after a shuffle?', a: 'spark.sql.shuffle.partitions, 200 by default in Apache Spark. With adaptive query execution Spark can merge small ones afterwards.', pl: 'Domyślnie 200 w Apache Spark, AQE potrafi skleić.' },
      { q: 'Does a shuffle move every row?', a: 'Not necessarily. A sort-merge join shuffles the rows of both sides. An aggregation like sum or count first aggregates within each input partition and shuffles only the partial results.', pl: 'Lab: 100 000 wierszy, do shuffle\'u przy groupBy trafiło 150 rekordów.' }
    ],
    mistakes: [
      'Mówienie, że shuffle wywołują akcje. Wymagają go transformacje wide, akcja tylko uruchamia wykonanie.',
      'Twierdzenie, że każdy Exchange to shuffle albo że każda operacja wide go dodaje.',
      'Twierdzenie, że shuffle zawsze przenosi wszystkie wiersze. Agregacja przesyła wyniki częściowe.',
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
      pl: 'Driver to proces z moim kodem. Buduje i optymalizuje plan, a gdy wywołam akcję, tworzy job. Job dzieli na stage\'e w miejscach, gdzie potrzebny jest shuffle, a każdy stage na taski, po jednym na partycję. Taski wykonują executory. Stage\'e, które przygotowują dane do shuffle\'u, zapisują pliki shuffle, a ostatni stage zwraca wynik do drivera albo zapisuje go do celu. Liczba partycji to liczba tasków, ale to, ile z nich działa jednocześnie, ogranicza liczba dostępnych rdzeni na executorach. Za mało partycji daje duże taski, które zrzucają dane na dysk albo nie mieszczą się w pamięci, za dużo daje narzut na planowanie i małe pliki.',
      en: 'The driver is the process that runs my code. It builds and optimizes the plan, and when I call an action it creates a job. It splits the job into stages wherever a shuffle is needed, and each stage into tasks, one per partition. Executors run the tasks. Stages that feed a shuffle write shuffle files, and the final stage returns the result to the driver or writes it to the sink. The number of partitions is the number of tasks, but how many run at the same time is limited by the available executor cores. Too few partitions means large tasks that spill to disk or run out of memory, too many means scheduling overhead and small files.'
    },
    senior: {
      pl: 'Reguła „akcja to job, shuffle to stage, partycja to task" jest przybliżeniem. Z AQE jedna akcja bywa kilkoma jobami, a liczba tasków po shuffle\'u maleje, bo Spark skleja małe partycje. Stage może też zostać pominięty, gdy jego pliki shuffle już istnieją. Driver to nie tylko koordynator: trafia do niego wszystko, co ściągnę przez collect, w Apache Spark buduje on małą stronę broadcast joina, a zapytanie na danych lokalnych potrafi policzyć sam.',
      en: 'The rule "action is a job, shuffle is a stage, partition is a task" is an approximation. With AQE one action can be several jobs, and the task count after a shuffle drops because Spark merges small partitions. A stage can also be skipped when its shuffle files already exist. And the driver is not only a coordinator: everything I collect lands there, in Apache Spark it builds the small side of a broadcast join, and it can evaluate a query on local data by itself.'
    },
    explain: [
      'Trzy poziomy, od góry. <b>Job</b> powstaje, gdy akcja każe coś policzyć. Spark tnie go na <b>stage\'e</b> tam, gdzie potrzebny jest <term id="shuffle">shuffle</term>, bo dane trzeba najpierw zapisać, a potem odczytać w nowym układzie. Stage składa się z <b>tasków</b>: jeden task liczy jedną <term id="partition">partycję</term>.',
      'Pliki shuffle zapisują tylko te stage\'e, po których następuje shuffle. Ostatni stage joba oddaje wynik <term id="driver">driverowi</term> albo zapisuje go do tabeli.',
      'Liczba tasków to nie równoległość. Pomiar lokalny na <term id="local-mode">local[3]</term>: stage z 12 partycjami miał 12 tasków, ale jednocześnie działały najwyżej 3, tyle, ile było wątków. Na klastrze tę rolę pełnią rdzenie <term id="executor">executorów</term>.',
      'Driver planuje i koordynuje, ale nie jest wolny od danych. Odbiera wyniki <code>collect()</code> i <code>toPandas()</code>. W Apache Spark zbiera i buduje małą stronę broadcast joina. A zapytanie na danych lokalnych potrafi policzyć sam: w labie <code>SELECT … FROM VALUES … WHERE</code> wykonało się bez żadnego joba (plan <code>LocalTableScan</code>).'
    ],
    keywords: ['driver', 'executor', 'job', 'stage', 'task', 'Spark UI', 'local[N]'],
    followUps: [
      { q: 'What happens if an executor fails?', a: 'Its tasks are retried on another executor, up to a retry limit. If shuffle files it wrote are lost, Spark re-runs the stage that produced them.', pl: 'Spark zna plan, więc umie odtworzyć brakujący fragment.' },
      { q: 'What runs on the driver?', a: 'Planning, scheduling and coordination. The distributed work runs on executors, but the driver still handles data: it receives whatever I collect or convert with toPandas, and it can evaluate small local queries itself.', pl: 'collect() na dużych danych zabija driver.' },
      { q: 'Is the number of tasks the same as the parallelism?', a: 'No. A stage has one task per partition, but only as many run at once as there are free executor cores. Twelve partitions on three cores means twelve tasks, three at a time.', pl: 'Taski to kolejka pracy, rdzenie to okienka.' },
      { q: 'What does local[3] mean?', a: 'Spark runs in a single process with three worker threads. There are no separate executors.', pl: 'To wątki, nie executory.' },
      { q: 'Where do you look when a job is slow?', a: 'In the Spark UI: the slowest stage first, then the distribution of task durations and shuffle read sizes inside it.', pl: 'Job, stage, task: zawsze ta sama ścieżka w dół.' }
    ],
    mistakes: [
      'Twierdzenie, że driver przetwarza cały zbiór, albo odwrotnie, że nigdy nie dotyka danych. collect, toPandas i dane lokalne trafiają właśnie do niego.',
      'Mylenie liczby tasków z liczbą tasków działających naraz. To drugie ogranicza liczba rdzeni.',
      'Mówienie, że każdy stage zapisuje pliki shuffle. Ostatni zwraca wynik albo zapisuje go do celu.',
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
    explain: [
      'Kolejność ma znaczenie, bo każda przyczyna zostawia inny ślad. Zmiana w danych albo w kodzie wychodzi przy porównaniu dwóch przebiegów: liczby wierszy i planu.',
      'Skew, czyli kilka kluczy z ogromną liczbą wierszy: większość <term id="task">tasków</term> kończy szybko, a jeden lub kilka trwa wielokrotnie dłużej i czyta dużo więcej danych po <term id="shuffle">shuffle\'u</term>. Sam wolny task to poszlaka. Potwierdza ją rozkład: shuffle read tego taska na tle mediany i zwykły <code>count</code> po kluczu.',
      'Za duże <term id="partition">partycje</term>: wolne są wszystkie taski, a w metrykach pojawia się spill. To zrzucanie danych pośrednich z pamięci na dysk, gdy task się w niej nie mieści. Działa, ale wolno.',
      'Zmiana strategii joina: mała tabela urosła ponad próg i Spark po cichu zamienił broadcast hash join na sort-merge join z shuffle\'em. Widać to w planie.',
      'Na Databricks serverless nie ma <term id="spark-ui">Spark UI</term>. Te same pytania zadajesz w query profile, który pokazuje czas i liczbę wierszy na operator.'
    ],
    keywords: ['Spark UI', 'skew', 'spill', 'shuffle read', 'query profile', 'broadcast threshold'],
    followUps: [
      { q: 'What does spill mean?', a: 'A task ran out of execution memory and wrote intermediate data to disk. It works but it is slow. Smaller partitions usually fix it.', pl: 'Spill to zwykle objaw za dużych partycji.' },
      { q: 'A dimension table grew and the job got slow. Why?', a: 'It probably crossed the broadcast threshold, so Spark switched from a broadcast hash join to a sort-merge join with a shuffle. I would confirm that in the plan.', pl: 'Cicha zmiana strategii joina. Hipoteza do potwierdzenia w planie.' },
      { q: 'How do you do this on serverless?', a: 'On Databricks serverless the Spark UI is not available, so I use the query profile, which shows time and rows per operator.', pl: 'Na Databricks serverless zostaje query profile.' }
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
      pl: 'Skew jest wtedy, gdy kilka kluczy ma nieproporcjonalnie dużo wierszy, np. null, domyślne ID albo jeden bardzo duży klient. Shuffle dzieli dane hashem klucza, więc wszystkie wiersze z tym samym kluczem trafiają do jednej partycji i jeden task mieli wielokrotnie więcej danych niż reszta. Widać to w Spark UI: max czasu taska i shuffle read są daleko od mediany. Potwierdzam zwykłym count po kluczu. Naprawiam w tej kolejności: usuwam przyczynę, np. osobno obsługuję nulle, robię broadcast małej strony, zostawiam to AQE, a gdy to nie wystarcza, solę klucz albo liczę gorący klucz osobno.',
      en: 'Skew is when a few keys hold a disproportionate share of the rows, for example null, a default ID, or one very large customer. A shuffle partitions data by the hash of the key, so all rows with the same key land in one partition and one task processes far more data than the rest. It shows in the Spark UI: max task time and shuffle read are far above the median. I confirm it with a count by key. I fix it in this order: remove the cause, such as handling nulls separately, broadcast the small side, let AQE handle it, and if that is not enough, salt the key or process the hot key separately.'
    },
    explain: [
      'Przy joinie po kluczu Spark wyznacza <term id="partition">partycję</term> z hasha klucza. Wszystkie wiersze z tym samym kluczem lądują w jednej partycji, a jedną partycję liczy jeden <term id="task">task</term>. Jeśli jeden klucz ma 80% wierszy, jeden task dostaje 80% pracy, a reszta klastra na niego czeka.',
      'Pomiar lokalny: 100 000 wierszy, z czego 80% z jednym kluczem. Po <code>repartition(8, klucz)</code> niepuste partycje miały od 2 000 do 80 000 wierszy.',
      'Dlatego więcej <term id="executor">executorów</term> ani więcej partycji nie pomaga na jeden gorący klucz: hash nadal wysyła go w jedno miejsce. Więcej partycji pomaga tylko wtedy, gdy problemem jest kilka średnich kluczy, które przypadkiem trafiły razem.',
      'Przy agregacjach typu suma albo liczba skew boli mniej niż przy joinie, bo Spark najpierw agreguje w każdej partycji wejścia i przesyła wynik częściowy. Przy joinie przez <term id="shuffle">shuffle</term> idzie każdy wiersz.'
    ],
    keywords: ['skew', 'hot key', 'shuffle read', 'AQE', 'salting', 'broadcast'],
    followUps: [
      { q: 'Why does adding executors not help?', a: 'With hash partitioning one key still goes to one partition, so to one task. More executors only speed up the tasks that were already fast.', pl: 'Hash wysyła jeden klucz do jednej partycji.' },
      { q: 'Why does increasing shuffle partitions not help?', a: 'Hashing sends a single key to a single partition, no matter how many partitions there are. It only helps when several medium keys happened to collide in one partition.', pl: 'Więcej partycji nie rozbije jednego klucza.' },
      { q: 'Where does skew come from in real data?', a: 'Nulls in join keys, test or default accounts, and a handful of very large customers.', pl: 'Nulle, konta domyślne, kilku bardzo dużych klientów.' }
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
      pl: 'Adaptive Query Execution poprawia plan w trakcie wykonania, bo po shuffle\'u zna prawdziwe rozmiary partycji. Przy skew dzieli za dużą partycję na mniejsze i powiela pasującą partycję po drugiej stronie joina. Ma jednak warunki. Domyślnie partycja musi być jednocześnie ponad pięć razy większa od mediany i większa niż 256 MB. Działa tylko dla joinów opartych na shuffle\'u, czyli sort-merge i shuffle hash, nie obsługuje żadnej strony full outer joina i nie obejmuje zapytań streamingowych. Obsługa skew dotyczy wyłącznie joinów, więc nie pomaga na skew w groupBy ani w funkcji okna. Wtedy zostaje salting albo wydzielenie gorącego klucza.',
      en: 'Adaptive Query Execution re-optimizes the plan at runtime, because after a shuffle it knows the real partition sizes. For skew, it splits an oversized partition and replicates the matching partition on the other side of the join. But it has conditions. By default a partition has to be both more than five times the median and larger than 256 megabytes. It only works for shuffle-based joins, meaning sort-merge and shuffle hash, it does not handle either side of a full outer join, and it does not cover streaming queries. Its skew handling is for joins only, so it does not help with skew in a groupBy or a window function. In those cases I salt the key or isolate the hot key.'
    },
    explain: [
      'Zwykły <term id="optimizer">optymalizator</term> planuje przed wykonaniem i musi zgadywać rozmiary danych. <term id="aqe">AQE</term> korzysta z tego, że po każdym <term id="shuffle">shuffle\'u</term> Spark zna prawdziwe rozmiary <term id="partition">partycji</term>, i poprawia resztę planu w locie. Robi głównie trzy rzeczy: skleja małe partycje, zamienia sort-merge join na broadcast, gdy jedna strona okazała się mała, i dzieli skośne partycje w joinie.',
      'Przy skośnym joinie dzieli za dużą partycję jednej strony na kawałki i do każdego dokłada kopię pasującej partycji z drugiej strony. Stąd ograniczenia: działa tylko w joinach opartych na shuffle\'u, a to, którą stronę wolno dzielić, zależy od typu joina. Według dokumentacji Databricks: inner obie strony, left outer tylko lewa, right outer tylko prawa, full outer żadna.',
      'Progi są takie same w dokumentacji Apache Spark i Databricks: partycja jest skośna, gdy jest większa niż 5 razy mediana i jednocześnie większa niż 256 MB. Mała tabela ze skośnym kluczem po prostu nie spełni drugiego warunku.',
      'AQE jest domyślnie włączone w Apache Spark od wersji 3.2 i na Databricks. Zapytań streamingowych nie obejmuje.'
    ],
    keywords: ['AQE', 'skew join', 'skewedPartitionFactor', '256 MB', 'coalesce partitions', 'isFinalPlan'],
    followUps: [
      { q: 'What else does AQE do?', a: 'It merges small shuffle partitions and can switch a sort-merge join to a broadcast hash join when one side turns out to be small.', pl: 'Trzy rzeczy: sklejanie partycji, zmiana joina, skew.' },
      { q: 'How do you see that AQE changed the plan?', a: 'The plan has an AdaptiveSparkPlan node with isFinalPlan=true after execution, and a skew-optimized join shows isSkew=true.', pl: 'Porównaj plan początkowy z końcowym.' },
      { q: 'Is AQE on by default?', a: 'Yes, since Apache Spark 3.2, and on Databricks.', pl: 'Tak, od Spark 3.2.' }
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
    explain: [
      'Problem: hash wysyła gorący klucz do jednej <term id="partition">partycji</term>. Pomysł: zmienić klucz tak, żeby jeden gorący klucz stał się N różnymi kluczami. Do skośnej strony doklejasz losową liczbę od 0 do N-1, czyli sól. Wiersze klucza X rozchodzą się wtedy na X_0, X_1 i tak dalej, a każdy z nich trafia do innej partycji.',
      'W joinie druga strona musi mieć odpowiednik dla każdej wersji klucza, więc każdy jej wiersz powielasz N razy, po jednym na wartość soli. To jest główny koszt: druga strona rośnie N-krotnie.',
      'W agregacji robisz dwa kroki. Najpierw grupujesz po parze klucz i sól, co rozbija gorący klucz na N mniejszych grup. Potem grupujesz po samym kluczu i składasz wyniki częściowe. Działa to dla wyników, które da się złożyć z części: sumy, liczby, minimum, maksimum. Dokładnej liczby unikalnych wartości tak nie policzysz, bo ta sama wartość może wystąpić w kilku grupach.'
    ],
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
      pl: 'Gdy jedna strona joina jest na tyle mała, że mieści się w pamięci, Spark może wysłać jej kopię do każdego executora i łączyć przez wyszukiwanie w tablicy hashującej. To broadcast hash join. Duża strona nie jest wtedy ani shuffle\'owana, ani sortowana, więc to zwykle najszybszy join z warunkiem równości. Spark wybiera go sam, gdy szacowany rozmiar jest poniżej progu, w Apache Spark domyślnie 10 MB, a AQE potrafi przełączyć się na niego w trakcie. Mogę też o niego poprosić hintem, ale hint to prośba, nie gwarancja. Ryzyka: jeśli tabela jest większa, niż zakładałem, kończy się brakiem pamięci albo timeoutem przy jej budowaniu i rozsyłaniu. Broadcast hash join nie obsługuje też każdego typu joina, np. full outer z niego nie skorzysta.',
      en: 'When one side of a join is small enough to fit in memory, Spark can send a copy of it to every executor and join by hash lookup. That is a broadcast hash join. The large side is then neither shuffled nor sorted, so it is usually the fastest equi-join. Spark picks it automatically when the estimated size is below a threshold, 10 megabytes by default in Apache Spark, and AQE can switch to it at runtime. I can also ask for it with a hint, but a hint is a request, not a guarantee. The risks: if the table is larger than I assumed, I run out of memory or hit a timeout while it is being built and shipped. Broadcast hash join also does not support every join type, for example a full outer join cannot use it.'
    },
    senior: {
      pl: 'W Apache Spark mała strona jest najpierw zbierana i budowana na driverze, więc liczy się też jego pamięć. To, którą stronę da się rozesłać, zależy od typu joina: w left outer tylko prawą. Bez warunku równości Spark sięga po broadcast nested loop join, który obsłuży też full outer, ale jest dużo wolniejszy.',
      en: 'In Apache Spark the small side is first collected and built on the driver, so driver memory matters too. Which side can be broadcast depends on the join type: in a left outer join only the right one. Without an equality condition Spark falls back to a broadcast nested loop join, which also handles a full outer join but is much slower.'
    },
    explain: [
      'Zwykły join dwóch dużych tabel, czyli sort-merge, musi przetasować obie strony po kluczu (<term id="shuffle">shuffle</term>) i je posortować. Jeśli jedna strona jest mała, taniej jest rozesłać jej kopię do wszystkich <term id="executor">executorów</term>. Każdy trzyma ją w pamięci jako tablicę hashującą i dla każdego wiersza dużej strony robi szybkie wyszukanie. Duża strona zostaje na miejscu.',
      'Spark wybiera tę strategię sam, gdy szacowany rozmiar strony jest poniżej <code>spark.sql.autoBroadcastJoinThreshold</code>. W Apache Spark to domyślnie 10 MB (sprawdzone w dokumentacji i w labie). Na Databricks próg, przy którym <term id="aqe">AQE</term> zamienia join w trakcie wykonania, to domyślnie 30 MB.',
      'Hint to prośba, nie gwarancja. Dokumentacja Sparka mówi wprost, że strategia z hintu może nie zostać wybrana, bo nie każda obsługuje każdy typ joina. Pomiar lokalny z hintem broadcast: inner oraz left outer z małą stroną po prawej dały BroadcastHashJoin. Full outer, left outer z hintem na lewej stronie i right outer z hintem na prawej zostały przy SortMergeJoin.',
      'Powód: broadcast hash join nie może rozesłać strony, której wiersze trzeba zachować w wyniku. Bez warunku równości, np. <code>a.k &lt; b.k</code>, Spark użył BroadcastNestedLoopJoin, także dla full outer.'
    ],
    keywords: ['broadcast hash join', 'autoBroadcastJoinThreshold', '10 MB', 'BroadcastExchange', 'hint'],
    followUps: [
      { q: 'Which setting controls it?', a: 'spark.sql.autoBroadcastJoinThreshold. Setting it to minus one turns automatic broadcast off.', pl: 'Na Databricks próg zamiany joina przez AQE w trakcie wykonania to domyślnie 30 MB.' },
      { q: 'Does a broadcast hint guarantee a broadcast join?', a: "No. Spark's documentation says there is no guarantee that the hinted strategy is chosen, because a strategy may not support the join type. A full outer equi-join with a broadcast hint, for example, does not become a broadcast hash join.", pl: 'Hint ustawia priorytet, nie wymusza. Lab: full outer z hintem dał SortMergeJoin.' },
      { q: 'What is the default join for two large tables?', a: 'Sort-merge join: both sides are shuffled by key and sorted.', pl: 'Dwa shuffle i sortowanie.' },
      { q: 'Which side can be broadcast in a left outer join?', a: 'Only the right side. A broadcast hash join cannot broadcast the side whose rows must be preserved.', pl: 'Strona zachowywana nie może być rozsyłana.' }
    ],
    mistakes: [
      'Mówienie, że hint „wymusza" broadcast, albo ustawianie go bez znajomości rozmiaru tabeli.',
      'Twierdzenie, że broadcast „nie przesyła danych". Przesyła małą tabelę.',
      'Podawanie progu 10 MB bez zaznaczenia, że to wartość domyślna Apache Spark.'
    ]
  },
  {
    id: 'spark-repartition-coalesce',
    topicId: 'spark.repartition-coalesce',
    labIds: ['spark-partitioning-shuffle-lab'],
    area: 'spark',
    priority: 'P1',
    title: 'Repartition i coalesce',
    question: {
      pl: 'Czym różni się repartition od coalesce?',
      en: 'What is the difference between repartition and coalesce?'
    },
    answer: {
      pl: 'Repartition robi pełny shuffle. Może zwiększyć albo zmniejszyć liczbę partycji i może dzielić po kolumnach. Bez kolumn rozkłada wiersze mniej więcej po równo, a po kluczu dzieli hashem, więc przy skośnym kluczu partycje nadal będą nierówne. Coalesce tylko zmniejsza liczbę partycji przez sklejanie istniejących, bez pełnego shuffle\'u. Zwykle jest tańszy, ale wynik bywa nierówny. Repartition biorę, gdy potrzebuję równego rozłożenia albo danych ułożonych po kluczu, coalesce, żeby na końcu zmniejszyć liczbę plików. Pułapka: coalesce(1) potrafi ściągnąć małą równoległość w górę planu.',
      en: 'Repartition does a full shuffle. It can increase or decrease the number of partitions and can partition by columns. Without columns it spreads rows roughly evenly, and by key it uses a hash, so with a skewed key the partitions will still be uneven. Coalesce only reduces the number of partitions by merging existing ones, without a full shuffle. It is usually cheaper, but the result can be uneven. I use repartition when I need an even spread or data laid out by key, and coalesce to reduce the number of output files at the end. One trap: coalesce(1) can pull the low parallelism upstream in the plan.'
    },
    explain: [
      'Obie operacje zmieniają liczbę <term id="partition">partycji</term>, ale inaczej. <code>repartition(n)</code> tasuje wszystkie wiersze od nowa (<term id="shuffle">shuffle</term>). Bez kolumn rozdaje je po kolei, więc liczby wierszy wychodzą zbliżone: w labie 12 wierszy na 4 partycje dało po 3. To nie jest gwarancja równych rozmiarów w bajtach. Z kolumną dzieli hashem klucza: w tym samym labie wyszło 2, 2, 5 i 3 wiersze, bo jeden kraj miał 5 zamówień.',
      'Liczbę partycji podajesz wprost. <code>repartition</code> z samą kolumną, bez liczby, bierze <code>spark.sql.shuffle.partitions</code> (w Apache Spark domyślnie 200): w labie przy ustawieniu 7 dał 7 partycji.',
      '<code>coalesce(n)</code> nie tasuje: skleja całe partycje w większe. Zwykle jest tańszy, ale nie wyrówna rozmiarów i nie zwiększy liczby partycji: poproszony o 6 przy 3 zostawił 3. Pułapka opisana w dokumentacji: <code>coalesce</code> nie tworzy granicy <term id="stage">stage\'a</term>, więc po <code>coalesce(1)</code> wcześniejsze liczenie też idzie jednym taskiem. W labie filtr przed <code>coalesce(1)</code> liczył 1 task, a przed <code>repartition(1)</code> 3 taski.',
      '„100–200 MB na partycję" to reguła praktyczna, nie parametr Sparka. Dwie liczby z dokumentacji bywają z nią mylone. 64 MB to rozmiar doradczy <term id="aqe">AQE</term>, a nie gwarantowany rozmiar po sklejeniu: przy ustawieniach domyślnych Spark pomija go przy sklejaniu, żeby zachować równoległość. 128 MB to limit przy planowaniu odczytu plików, a nie rozmiar partycji w ogóle. Liczba partycji przy zapisie wpływa na liczbę plików, ale jej nie wyznacza.'
    ],
    keywords: ['repartition', 'coalesce', 'round-robin', 'small files', 'optimized writes'],
    followUps: [
      { q: 'How many partitions should a job have?', a: 'There is no magic number. A common rule of thumb is partitions on the order of 100 to 200 megabytes. With AQE I start high and let it merge the small ones.', pl: 'Rozmiar partycji, nie magiczna liczba. 100–200 MB to reguła praktyczna.' },
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

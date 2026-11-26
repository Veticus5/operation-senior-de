import type { Bridge, ExplainedLine, LessonMeta } from '../../types';

/**
 * Lekcja 05: Data Skew i Adaptive Query Execution. Prowadzi od objawu (jeden task trwa wielokrotnie dłużej
 * niż reszta) przez przyczynę (podział hashem klucza) do wyboru środka zaradczego: usunięcie przyczyny,
 * broadcast, AQE, salting. Osobno uczy granic AQE.
 *
 * Fragmenty narracyjne są w HTML (dozwolone znaczniki: lib/richText.ts) i mogą używać
 * <term id="...">, czyli haseł z content/glossary.ts.
 *
 * Skąd są fakty: dokumentacja Apache Spark 4.3.0 i Databricks oraz lab labs/data_skew/skew_aqe_lab.py
 * (PySpark 4.0.1 i 4.3.0, local[3]). Całość jest spisana w docs/verified-facts.md, sekcja „Lekcja 05".
 * Symulacje i ilustracje (sim, metrics, moves, limits) NIE są pomiarami: czasy i rozmiary są w nich dobrane
 * tak, żeby mechanizm było widać. Liczby opisane jako pomiar pochodzą wyłącznie z labu.
 * Pytania rekrutacyjne, krótkie odpowiedzi i follow-upy nie są tu powtórzone: lekcja bierze je z Interview Banku.
 */
export const meta: LessonMeta = {
  id: 'spark-data-skew-aqe',
  topicId: 'spark.data-skew',
  area: 'spark',
  title: 'Data Skew & Adaptive Query Execution',
  subtitle: 'Dlaczego jeden task potrafi trwać dłużej niż wszystkie pozostałe razem, jak to potwierdzić i co z tym zrobić. Oraz ile z tego załatwia AQE.',
  minutes: 30
};

/** Zagadnienia z Interview Banku ćwiczone w etapie Interview, w tej kolejności. */
export const interviewTopics = ['spark.data-skew', 'spark.aqe', 'spark.salting', 'spark.slow-job-diagnosis'];

/** Lab z labs/registry.json, który odtwarza wszystkie liczby opisane w tej lekcji jako pomiar. */
export const labId = 'spark-data-skew-aqe-lab';

/** Krok etapu Intuicja. `visual` wstawia ilustrację między `html` a `after`. */
export interface Beat {
  html: string;
  visual?: 'keys';
  /** Krótki wniosek pod ilustracją. */
  after?: string;
  next: string;
  bridge?: Bridge;
  /** Zwinięte pogłębienie, poza domyślną ścieżką. */
  more?: { title: string; html: string[] };
}

export const beats: Beat[] = [
  {
    html: '<h1>199 tasków skończyło w minutę. Jeden liczy od godziny.</h1>\n<p class="lede">Nocny job łączy zamówienia z klientami po <code>customer_id</code>. Wczoraj trwał 10 minut. Dziś pasek postępu stoi na 199 z 200.</p>\n<p>Klaster nie jest przeciążony: prawie wszystkie rdzenie stoją bezczynnie. Zanim cokolwiek zmienisz w konfiguracji, zadaj danym jedno pytanie, które znasz z SQL: <b>ile wierszy ma każdy klucz?</b></p>',
    visual: 'keys',
    after: '<b>Wniosek.</b> Jeden klucz ma tu 80% wierszy. Taki nierówny rozkład to <b>data skew</b>, a klucz, który go powoduje, nazywa się gorącym kluczem (hot key). Sam rozkład jeszcze niczego nie spowalnia. Problem zaczyna się, gdy Spark musi zebrać wiersze z tym samym kluczem w jednym miejscu.',
    more: {
      title: 'Skąd się biorą gorące klucze',
      html: [
        '<b>Wartość zastępcza.</b> <code>NULL</code>, <code>0</code>, <code>-1</code> albo <code>"unknown"</code> w kluczu obcym: zamówienia gości, zdarzenia bez przypisanego użytkownika.',
        '<b>Prawdziwy gigant.</b> Jeden klient, sklep albo kraj, który naprawdę odpowiada za większość ruchu. Dane są poprawne i nie da się ich „naprawić".',
        '<b>Zdarzenie.</b> Wyprzedaż, awaria albo bot, przez które jeden dzień lub jeden identyfikator nagle puchnie. Stąd job, który wczoraj działał dobrze, a dziś nie.'
      ]
    },
    next: 'Dlaczego to trafia do jednego taska?',
    bridge: {
      from: 'SQL i dbt',
      known: 'Rozkład klucza sprawdzasz zwykłym <code>GROUP BY</code> z <code>COUNT(*)</code>, a wartości <code>NULL</code> w kluczu obcym łapiesz testem <code>not_null</code> w dbt.',
      fresh: 'To samo zapytanie potwierdza skew. Jest pierwszym krokiem diagnozy, przed jakąkolwiek zmianą konfiguracji.',
      breaks: 'W hurtowni to kontrola jakości danych. W Sparku rozkład klucza decyduje też o tym, jak praca rozłoży się na taski, więc kłopot potrafią sprawić także dane w pełni poprawne, np. jeden bardzo duży klient.'
    }
  },
  {
    html: '<h2>Ten sam klucz zawsze trafia w to samo miejsce</h2>\n<p>Żeby połączyć zamówienie z klientem, oba wiersze muszą znaleźć się w tej samej <term id="partition">partycji</term>. Spark przegrupowuje więc dane po kluczu, czyli wykonuje <term id="shuffle">shuffle</term> danych między partycjami.</p>\n<p>Numer partycji docelowej wynika z klucza: <code>hash(customer_id) mod liczba_partycji</code>. Reguła jest deterministyczna, więc <b>wszystkie wiersze z tym samym kluczem lądują w jednej partycji</b>. Tak ma być, inaczej join by się nie udał.</p>\n<p>Jedną partycję liczy jeden <term id="task">task</term>. Jeśli jeden klucz ma 80% wierszy, jeden task dostaje co najmniej 80% pracy. Pozostałe kończą szybko i czekają. Taki task, który ciągnie się długo po reszcie, nazywa się <b>stragglerem</b>.</p>',
    more: {
      title: 'Czy każdy skew boli tak samo',
      html: [
        'Nie. Przy joinie przez shuffle przesyłany jest każdy wiersz, więc gorący klucz w całości obciąża jeden task.',
        'Przy agregacji typu suma albo liczba Spark zwykle najpierw agreguje w każdej partycji wejścia i przesyła wynik częściowy. W lokalnym teście z <code>labs/interview_bank/spark_checks.py</code> <code>groupBy</code> na 100 000 wierszy z 50 kluczami zapisał do shuffle\'u 150 rekordów, a join tej samej tabeli 100 000.',
        'Funkcja okna po kluczu nie ma takiego skrótu: wszystkie wiersze gorącego klucza muszą trafić do jednego taska i zostać w nim posortowane.'
      ]
    },
    next: 'Zobacz to na taskach'
  }
];

/** Ilustracja z pierwszego kroku: wynik GROUP BY po kluczu. Wartości wymyślone, w proporcjach z labu (80% w jednym kluczu). */
export const keys = {
  query: 'SELECT customer_id, COUNT(*) AS orders\nFROM orders\nGROUP BY customer_id\nORDER BY orders DESC',
  caption: 'Ilustracja: 10 mln zamówień, 1000 klientów. Pokazane cztery największe klucze i łączna reszta.',
  rows: [
    { key: '0 (zamówienia gości)', count: 8_000_000, hot: true },
    { key: '417', count: 2_050, hot: false },
    { key: '88', count: 2_040, hot: false },
    { key: '903', count: 2_030, hot: false },
    { key: 'pozostałe 996 kluczy razem', count: 1_993_880, hot: false }
  ]
};

export interface SimTask { rest: number; hot: number }
export interface SimScenario {
  id: string;
  label: string;
  /** Czy scenariusz dotyczy danych skośnych (wtedy jest środkiem zaradczym albo jego brakiem). */
  skewed: boolean;
  /** Wiersze na task w milionach: `rest` to zwykłe klucze, `hot` to gorący klucz. */
  tasks: SimTask[];
  verdict: string;
  /** Ile kosztuje to rozwiązanie albo kiedy nie zadziała. */
  cost: string;
}

const repeat = (n: number, task: SimTask): SimTask[] => Array.from({ length: n }, () => ({ ...task }));

/**
 * Etap Mechanizm, część 1: centralna symulacja. Jeden stage joina, 16 mln wierszy.
 * Czas taska jest w modelu proporcjonalny do liczby wierszy. To ilustracja, nie pomiar.
 */
export const sim = {
  question: 'Ile trwa stage, w którym jeden task dostał większość danych?',
  intro: 'Jeden <term id="stage">stage</term> joina po shuffle\'u: 16 mln zamówień podzielonych na partycje hashem <code>customer_id</code>. Każdy pasek to jeden task, a jego długość to czas pracy. Uruchom stage na równych danych, potem na skośnych, a potem wypróbuj kolejne środki zaradcze.',
  assumptions: 'Model uproszczony: czas taska rośnie liniowo z liczbą wierszy (10 s na milion), każdy task ma własny rdzeń, więc wszystkie startują jednocześnie. Gorący klucz ma 8,8 mln z 16 mln wierszy.',
  secondsPerMillion: 10,
  /** Skala osi czasu w sekundach: wspólna dla wszystkich scenariuszy, żeby paski dało się porównywać. */
  scaleSeconds: 100,
  dataLabel: 'Dane',
  fixLabel: 'Co robisz ze skośnymi danymi',
  defaultId: 'even',
  scenarios: [
    {
      id: 'even', label: 'Równe', skewed: false,
      tasks: repeat(8, { rest: 2, hot: 0 }),
      verdict: 'Każdy task dostał tyle samo, więc wszystkie kończą razem. Czas stage\'a to czas jednego taska.',
      cost: 'To punkt odniesienia: tyle trwałby stage, gdyby praca rozłożyła się idealnie.'
    },
    {
      id: 'skew', label: 'Skośne, nic nie robię', skewed: true,
      tasks: [...repeat(7, { rest: 0.9, hot: 0 }), { rest: 0.9, hot: 8.8 }],
      verdict: 'Siedem tasków kończy po 9 s i ich rdzenie stoją. Stage trwa tyle, ile najdłuższy task, czyli 97 s. Danych jest tyle samo co przedtem.',
      cost: 'Dokładanie executorów niczego tu nie zmieni: wolne rdzenie już są, tylko nie mają czego liczyć.'
    },
    {
      id: 'more', label: 'Więcej partycji', skewed: true,
      tasks: [...repeat(15, { rest: 0.45, hot: 0 }), { rest: 0.45, hot: 8.8 }],
      verdict: 'Zwykłe klucze rozłożyły się na 16 mniejszych partycji. Gorący klucz nadal jest w jednej, bo hash jednej wartości wskazuje jedno miejsce. Stage skrócił się z 97 s do 92,5 s.',
      cost: 'Repartycjonowanie po tym samym kluczu nie rozbije gorącego klucza przy żadnej liczbie partycji. Pomaga tylko wtedy, gdy kilka średnich kluczy przypadkiem trafiło do jednej partycji.'
    },
    {
      id: 'broadcast', label: 'Broadcast małej strony', skewed: true,
      tasks: repeat(8, { rest: 0.9, hot: 1.1 }),
      verdict: 'Mała tabela klientów trafia w całości do każdego executora. Zamówień nie trzeba przegrupowywać po kluczu, więc zostają w partycjach, w których zostały wczytane, a gorący klucz jest w nich rozproszony.',
      cost: 'Warunek: druga strona musi być na tyle mała, żeby zmieścić się w pamięci. Nie każdy typ joina na to pozwala, np. full outer z równością nie skorzysta z broadcast hash joina.'
    },
    {
      id: 'aqe', label: 'AQE: skew join', skewed: true,
      tasks: [...repeat(7, { rest: 0.9, hot: 0 }), ...repeat(5, { rest: 0.18, hot: 1.76 })],
      verdict: 'Po shuffle\'u Spark zna rozmiary partycji. Tę za dużą dzieli na 5 kawałków i każdemu daje osobny task. Pasująca partycja klientów jest czytana przez każdy z nich. Stage trwa 19,4 s.',
      cost: 'Działa samo, ale pod warunkami: tylko w joinie przez shuffle, tylko gdy partycja przekroczy progi i tylko po tej stronie, którą dany typ joina pozwala dzielić. Szczegóły w etapie Praktyka.'
    },
    {
      id: 'salt', label: 'Salting', skewed: true,
      tasks: repeat(8, { rest: 0.9, hot: 1.1 }),
      verdict: 'Do klucza doklejasz losową liczbę od 0 do 7. Jeden gorący klucz staje się ośmioma różnymi kluczami, a hash rozsyła je po partycjach. W tym idealnym modelu każdy trafił do innej.',
      cost: 'Druga strona joina musi mieć wiersz dla każdej wartości soli, więc rośnie 8 razy. Kod się komplikuje, a rozkład nie musi wyjść idealnie równy: hash może wysłać dwa posolone klucze do tej samej partycji.'
    }
  ] as SimScenario[],
  takeaway: [
    '<b>Wniosek.</b> Stage kończy się wtedy, gdy kończy się jego najdłuższy task. Przy skośnym kluczu o czasie decyduje więc jedna partycja, a nie ilość danych ani rozmiar klastra.',
    'Samo repartycjonowanie po kluczu tego nie naprawi, bo wiele wierszy z tym samym kluczem zawsze trafi razem. Skuteczne środki robią jedną z trzech rzeczy: omijają shuffle dużej strony (broadcast), dzielą gotową partycję po fakcie (AQE) albo zmieniają sam klucz (salting).'
  ],
  simTitle: 'Co tu jest uproszczeniem',
  simNotes: [
    'To animacja w JavaScripcie. Nie działa tu żaden Spark, a czasy są wymyślone.',
    'Prawdziwy task nie zwalnia liniowo. Bardzo duża partycja może nie zmieścić się w pamięci taska: wtedy Spark zrzuca dane pośrednie na dysk (spill) albo task kończy się błędem braku pamięci. Skew bywa więc przyczyną awarii, a nie tylko wolnej pracy.',
    'Rdzeni rzadko jest tyle co tasków. Gdy tasków jest więcej, czekają w kolejce, ale wniosek zostaje ten sam: gorąca partycja to jeden task, którego nie da się zrównoleglić.',
    'W scenariuszu z AQE liczba kawałków zależy od rozmiaru docelowego partycji, a nie od stałej liczby 5.',
    'Salting i broadcast wyglądają tu identycznie, bo model pokazuje tylko rozkład pracy. Różnią się kosztem, który jest opisany pod sceną.'
  ],
  measuredTitle: 'Pomiar: to samo na lokalnym Sparku',
  measured: [
    'Lab <code>labs/data_skew/skew_aqe_lab.py</code>: 2 000 000 zamówień, z których 80% ma jeden <code>customer_id</code>, i 8 partycji po shuffle\'u. Po <code>repartition(8, customer_id)</code> siedem partycji miało od 44 451 do 58 059 wierszy, a ósma 1 643 654.',
    'Przy 64 partycjach największa nadal miała 1 605 606 wierszy przy medianie 6 008. Gorący klucz został w jednym kawałku.',
    'W sort-merge joinie bez AQE najbardziej obciążony task przeczytał z shuffle\'u 1 643 764 rekordy przy medianie 52 583. Na kluczu równym było to najwyżej 290 145 przy medianie 242 121.',
    'To pomiar z jednej maszyny (<term id="local-mode">local[3]</term>, mało danych). Liczby rekordów powtarzają się przy każdym uruchomieniu, czasy nie: gorący task trwał około 200 ms, co pokazuje kierunek, ale nie skalę problemu na klastrze.'
  ]
};

export interface MetricsCase { id: string; label: string; rows: { metric: string; median: string; max: string; flag: boolean }[]; verdict: string }
/**
 * Etap Mechanizm, część 2: wolny task to poszlaka. Dwa wymyślone podsumowania stage'a,
 * które różnią się tylko tym, czy wolny task przeczytał więcej danych.
 */
export const metrics = {
  title: 'Jeden wolny task. Czy to już skew?',
  intro: '<term id="spark-ui">Spark UI</term> pokazuje dla każdego stage\'a podsumowanie metryk wszystkich tasków, m.in. czas trwania oraz <b>Shuffle Read Size / Records</b>, czyli ile danych task przeczytał po shuffle\'u. Poniżej dwa stage\'e z identycznym objawem. Porównaj w nich medianę z maksimum.',
  assumptions: 'Ilustracja: liczby są wymyślone. Stage ma 200 tasków, tabela pokazuje medianę i najgorszy task.',
  columns: ['Metryka', 'Mediana', 'Max'],
  cases: [
    {
      id: 'a', label: 'Stage A',
      rows: [
        { metric: 'Czas taska', median: '4 s', max: '38 min', flag: true },
        { metric: 'Shuffle read: rozmiar', median: '60 MB', max: '14 GB', flag: true },
        { metric: 'Shuffle read: rekordy', median: '0,4 mln', max: '96 mln', flag: true },
        { metric: 'Spill na dysk', median: '0', max: '9 GB', flag: false }
      ],
      verdict: 'Wolny task przeczytał ponad 200 razy więcej danych niż typowy. To mocna przesłanka za skew. Potwierdza ją rozkład klucza, czyli zapytanie poniżej.'
    },
    {
      id: 'b', label: 'Stage B',
      rows: [
        { metric: 'Czas taska', median: '4 s', max: '38 min', flag: true },
        { metric: 'Shuffle read: rozmiar', median: '60 MB', max: '63 MB', flag: false },
        { metric: 'Shuffle read: rekordy', median: '0,4 mln', max: '0,4 mln', flag: false },
        { metric: 'Spill na dysk', median: '0', max: '0', flag: false }
      ],
      verdict: 'Wolny task dostał tyle samo danych co pozostałe. To nie wygląda na skew rozmiaru partycji. Szukaj gdzie indziej: wolna maszyna, kosztowna funkcja dla części wierszy, długie pauzy odśmiecania pamięci, czekanie na zewnętrzny system.'
    }
  ] as MetricsCase[],
  takeaway: '<b>Wniosek.</b> Czas mówi, że coś jest nie tak. Rozmiar i liczba rekordów z shuffle\'u mówią, czy to nierówny podział danych. Dopiero rozkład klucza mówi, który klucz za to odpowiada i ile ma wierszy.',
  codeTitle: 'Potwierdzenie: rozkład klucza',
  lines: [
    {
      code: 'counts = orders.groupBy("customer_id").count()',
      label: 'GROUP BY customer_id, COUNT(*)',
      text: 'Liczba wierszy na klucz. To tania agregacja: Spark liczy częściowe wyniki w partycjach wejścia, więc sama nie cierpi na skew tak jak join.'
    },
    {
      code: 'counts.orderBy(F.desc("count")).show(10)',
      label: 'ORDER BY count DESC LIMIT 10',
      text: 'Dziesięć największych kluczy. Szukasz wartości o rzędy wielkości większej od reszty. W labie pierwszy klucz miał 1 600 000 wierszy, a kolejne po 402.'
    },
    {
      code: 'orders.filter(F.col("customer_id").isNull()).count()',
      label: 'WHERE customer_id IS NULL',
      text: 'Osobno policz <code>NULL</code>. W joinie z równością <code>NULL</code> nigdy do niczego nie pasuje, ale w left joinie te wiersze trzeba zachować, więc wszystkie trafiają do jednej partycji.'
    }
  ] as ExplainedLine[],
  nullTitle: 'Pomiar: NULL w kluczu joina',
  nulls: [
    'W labie 80% zamówień dostało <code>customer_id = NULL</code>. W left joinie najbardziej obciążony task przeczytał 1 650 981 rekordów przy medianie 50 173: wszystkie wiersze z <code>NULL</code> trafiły razem, choć żaden nie znajdzie pary.',
    'W inner joinie optymalizator sam dodał filtr <code>isnotnull</code> przed shuffle\'em i najbardziej obciążony task przeczytał 58 204 rekordy. Problem dotyczy więc joinów, które muszą zachować niedopasowane wiersze.',
    'Typowa naprawa w left joinie: wiersze z <code>NULL</code> w kluczu obsłużyć osobno, bez joina, i dołączyć do wyniku przez <code>unionByName</code>. To propozycja projektowa: lab jej nie mierzy.'
  ],
  otherTitle: 'Gdzie tego szukać poza Spark UI',
  other: [
    'Na Databricks serverless Spark UI nie jest dostępne. Zamiast niego jest query profile, który pokazuje czas i liczbę wierszy na operator.',
    'Te same metryki tasków udostępnia REST API Sparka. Tak czyta je lab w tej lekcji.'
  ]
};

export interface AqeMove {
  id: string;
  label: string;
  sees: string;
  does: string;
  beforeLabel: string;
  afterLabel: string;
  /** Rozmiary partycji do narysowania (umowne jednostki) albo nazwy węzłów planu. */
  before: number[] | string;
  after: number[] | string;
  measured: string;
  note: string;
}
/** Etap Praktyka, część 1: trzy rzeczy, które AQE robi z planem po shuffle'u. Rysunki są ilustracją, zdanie „Pomiar" pochodzi z labu. */
export const moves = {
  title: 'AQE: plan poprawiany w trakcie wykonania',
  intro: [
    '<term id="optimizer">Optymalizator</term> układa plan przed wykonaniem, więc rozmiary danych po filtrach i joinach musi szacować. <b>Adaptive Query Execution</b> (AQE) korzysta z tego, że shuffle dzieli zapytanie na etapy: gdy etap się skończy, Spark zna prawdziwy rozmiar każdej partycji i może poprawić resztę planu.',
    'W Apache Spark AQE jest domyślnie włączone od wersji 3.2.0. Wybierz, co AQE zobaczyło po shuffle\'u.'
  ],
  assumptions: 'Rysunki są ilustracją: rozmiary partycji są umowne. Zdanie „Pomiar" pod każdym z nich pochodzi z labu tej lekcji.',
  items: [
    {
      id: 'coalesce', label: 'Dużo małych partycji',
      sees: 'Po shuffle\'u jest 200 partycji (wartość domyślna <code>spark.sql.shuffle.partitions</code>), a większość ma po kilka kilobajtów.',
      does: 'Skleja sąsiednie partycje w większe, żeby nie uruchamiać setek prawie pustych tasków. Rozmiar docelowy to <code>spark.sql.adaptive.advisoryPartitionSizeInBytes</code>, domyślnie 64 MB.',
      beforeLabel: 'Plan: 24 małe partycje', afterLabel: 'Po AQE: 3 partycje',
      before: Array.from({ length: 24 }, () => 1), after: [8, 8, 8],
      measured: '<code>groupBy</code> przy 200 partycjach shuffle\'u: bez AQE 200 tasków, z AQE 1 task (w planie <code>AQEShuffleRead coalesced</code>).',
      note: 'W Apache Spark domyślnie włączone jest też <code>coalescePartitions.parallelismFirst</code>: przy sklejaniu Spark ignoruje wtedy 64 MB i pilnuje tylko rozmiaru minimalnego (1 MB), żeby nie stracić równoległości. Dokumentacja radzi wyłączyć to ustawienie na obciążonym klastrze.'
    },
    {
      id: 'join', label: 'Mała strona joina',
      sees: 'Zaplanowany był sort-merge join, czyli join, w którym obie strony są przegrupowywane po kluczu i sortowane. Po shuffle\'u okazuje się, że jedna strona po filtrze jest malutka.',
      does: 'Zmienia strategię na broadcast hash join: mała strona jest rozsyłana w całości do każdego executora. Dokumentacja zaznacza, że to gorsze niż zaplanowanie broadcastu od początku, bo shuffle już się odbył, ale lepsze niż sortowanie obu stron.',
      beforeLabel: 'Plan przed wykonaniem', afterLabel: 'Plan po wykonaniu',
      before: 'SortMergeJoin', after: 'BroadcastHashJoin',
      measured: 'Join z tabelą 3 000 000 wierszy, z której filtr zostawił 31: bez AQE <code>SortMergeJoin</code>, z AQE plan końcowy to <code>BroadcastHashJoin</code>.',
      note: 'Próg tej zamiany w Apache Spark to domyślnie ta sama wartość co <code>spark.sql.autoBroadcastJoinThreshold</code>, czyli 10 MB. Na Databricks osobne ustawienie ma domyślnie 30 MB.'
    },
    {
      id: 'skew', label: 'Jedna ogromna partycja',
      sees: 'W joinie przez shuffle jedna partycja jest wielokrotnie większa od mediany. To skew z poprzedniego etapu.',
      does: 'Dzieli tę partycję na kawałki o rozmiarze zbliżonym do docelowego i każdemu daje osobny task. Pasującą partycję drugiej strony czyta każdy z tych tasków.',
      beforeLabel: 'Plan: 1 gorąca partycja', afterLabel: 'Po AQE: gorąca podzielona',
      before: [2, 2, 2, 2, 2, 2, 2, 24], after: [2, 2, 2, 2, 2, 2, 2, 8, 8, 8],
      measured: 'Ten sam skośny join z progiem obniżonym do 1 MB: węzeł <code>SortMergeJoin(skew=true)</code>, 10 tasków zamiast 8, najbardziej obciążony przeczytał 547 996 rekordów zamiast 1 643 764.',
      note: 'Z progami domyślnymi AQE w tym labie niczego nie podzieliło: plan został przy zwykłym <code>SortMergeJoin</code>, bo gorąca partycja była dużo mniejsza niż 256 MB. Dlaczego, wyjaśnia następna część.'
    }
  ] as AqeMove[],
  takeaway: '<b>Wniosek.</b> AQE nie zgaduje lepiej, tylko czeka, aż będzie wiedzieć. Dlatego działa wyłącznie na granicach shuffle\'u i tylko dla tego, co zostało jeszcze do wykonania.',
  planTitle: 'Jak sprawdzić, co AQE zmieniło',
  plan: [
    'Plan zapytania z AQE ma na górze węzeł <code>AdaptiveSparkPlan</code> z flagą <code>isFinalPlan</code>. Przed wykonaniem i w jego trakcie flaga ma wartość <code>false</code>, po zakończeniu <code>true</code>. Porównujesz plan początkowy z końcowym.',
    'Sklejone partycje widać jako węzeł odczytu shuffle\'u z dopiskiem <code>coalesced</code>. W Apache Spark 4 ten węzeł nazywa się <code>AQEShuffleRead</code>, a dokumentacja Databricks opisuje go jako <code>CustomShuffleReader</code>.',
    'Join z obsłużonym skew jest oznaczony w samym węźle joina. W labie na Apache Spark 4.0.1 wydruk planu to <code>SortMergeJoin(skew=true)</code>, a dokumentacja Databricks mówi o polu <code>isSkew</code> ustawionym na <code>true</code>.',
    '<code>EXPLAIN</code> w SQL nie wykonuje zapytania, więc pokaże tylko plan początkowy.'
  ],
  bridgeTitle: 'Analogia: statystyki tabel w hurtowni',
  bridge: {
    from: 'Snowflake',
    known: 'Optymalizator hurtowni korzysta ze statystyk tabel, które usługa utrzymuje sama. Ty piszesz SQL i nie stroisz liczby partycji ani strategii joina.',
    fresh: 'AQE przybliża Sparka do tego doświadczenia: część decyzji, które kiedyś ustawiało się ręcznie, silnik podejmuje sam na podstawie rozmiarów zmierzonych w trakcie wykonania.',
    breaks: 'AQE poprawia tylko to, co da się zmienić po shuffle\'u: liczbę partycji, strategię joina i podział skośnej partycji w joinie. Nie zmienia kolejności joinów, a gorącego klucza w agregacji albo w funkcji okna nie rozbije. Kiedy przestaje wystarczać, wracasz do ręcznych technik.'
  } as Bridge
};

export interface LimitOp { id: string; label: string; ok: boolean; why: string }
/**
 * Etap Praktyka, część 2: kiedy AQE nie podzieli skośnej partycji. Reguła progów i tabela typów joina
 * pochodzą z dokumentacji (Apache Spark 4.3.0, Databricks). Rozmiary w przełączniku są przykładowe.
 */
export const limits = {
  title: 'Kiedy AQE nie rozbije skośnej partycji',
  intro: 'Obsługa skew w AQE ma dwa rodzaje warunków: partycja musi być wystarczająco duża i operacja musi być joinem, w którym tę stronę wolno dzielić. Ustaw oba i sprawdź werdykt.',
  assumptions: 'Reguła z dokumentacji przy ustawieniach domyślnych: partycja jest skośna, gdy jest większa niż 5 × mediana rozmiaru partycji i jednocześnie większa niż 256 MB. W tym przykładzie mediana to 40 MB.',
  medianMb: 40,
  factor: 5,
  thresholdMb: 256,
  sizeLabel: 'Rozmiar gorącej partycji',
  sizes: [
    { mb: 220, label: '220 MB' },
    { mb: 300, label: '300 MB' },
    { mb: 4096, label: '4 GB' }
  ],
  defaultSize: 220,
  opLabel: 'Operacja (gorący klucz jest w tabeli zamówień)',
  ops: [
    { id: 'inner', label: 'Inner join', ok: true, why: 'W inner joinie AQE może dzielić skośną partycję po obu stronach.' },
    { id: 'left', label: 'Zamówienia LEFT JOIN klienci', ok: true, why: 'W left outer joinie wolno dzielić lewą stronę, a tu skośna jest właśnie lewa.' },
    { id: 'right', label: 'Zamówienia RIGHT JOIN klienci', ok: false, why: 'W right outer joinie wolno dzielić tylko prawą stronę, a skośna jest lewa. Żeby podzielić lewą, trzeba by powielić partycję prawej, a jej niedopasowane wiersze pojawiłyby się wtedy w wyniku kilka razy.' },
    { id: 'full', label: 'Full outer join', ok: false, why: 'W full outer joinie nie wolno dzielić żadnej strony.' },
    { id: 'agg', label: 'groupBy albo funkcja okna', ok: false, why: 'Obsługa skew w AQE dotyczy joinów. Gorącego klucza w agregacji ani w funkcji okna nie rozbija.' },
    { id: 'broadcast', label: 'Broadcast hash join', ok: false, why: 'AQE obsługuje skew tylko w joinach przez shuffle. W broadcast joinie duża strona nie jest przegrupowywana po kluczu, więc skośnej partycji po shuffle\'u zwykle w ogóle nie ma.' },
    { id: 'stream', label: 'Zapytanie streamingowe', ok: false, why: 'Według dokumentacji Databricks AQE obejmuje tylko zapytania, które nie są streamingowe.' }
  ] as LimitOp[],
  defaultOp: 'inner',
  verdicts: {
    yes: 'AQE podzieli tę partycję.',
    size: 'AQE jej nie podzieli: partycja nie spełnia progów.',
    op: 'AQE jej nie podzieli: ta operacja nie pozwala.',
    both: 'AQE jej nie podzieli: ani progi, ani operacja na to nie pozwalają.'
  },
  takeaway: '<b>Wniosek.</b> „AQE rozwiązuje skew" jest prawdą tylko dla joinów przez shuffle, dla partycji powyżej obu progów i dla strony, którą dany typ joina pozwala dzielić. Partycja 220 MB przy medianie 40 MB jest pięć i pół raza większa od typowej, a mimo to AQE ją zostawi.',
  measuredTitle: 'Pomiar: typ joina i funkcja okna',
  measured: [
    'Lab, progi obniżone do 1 MB, skośna strona po lewej. Inner i left join: <code>SortMergeJoin(skew=true)</code>, najbardziej obciążony task 547 996 rekordów. Right i full join: zwykły <code>SortMergeJoin</code>, najbardziej obciążony task 1 643 764 rekordy, czyli tyle samo co bez AQE.',
    'Funkcja okna <code>row_number()</code> po <code>customer_id</code> przy tych samych ustawieniach: najbardziej obciążony task przeczytał 1 643 654 rekordy. AQE niczego nie podzieliło.',
    'Zakres: Apache Spark 4.0.1 i 4.3.0, <code>local[3]</code>. Wynik zgadza się z tabelą typów joina z dokumentacji Databricks.'
  ],
  tuneTitle: 'Co da się ustawić',
  tune: [
    '<code>spark.sql.adaptive.skewJoin.skewedPartitionFactor</code> (domyślnie 5) i <code>spark.sql.adaptive.skewJoin.skewedPartitionThresholdInBytes</code> (domyślnie 256 MB) to oba progi. Obniżenie drugiego sprawia, że AQE zajmie się też mniejszymi partycjami. Dokumentacja radzi trzymać go powyżej rozmiaru docelowego partycji.',
    '<code>spark.sql.adaptive.forceOptimizeSkewedJoin</code> (domyślnie <code>false</code>) wymusza obsługę skew nawet wtedy, gdy wymaga to dodatkowego shuffle\'u. Wniosek z opisu tego ustawienia: domyślnie AQE rezygnuje, jeśli podział miałby taki shuffle dołożyć.',
    'Zakres platformy: dokumentacja Apache Spark opisuje obsługę skew dla sort-merge joina. Dokumentacja Databricks wymienia sort-merge join i shuffle hash join, czyli join przez shuffle, który zamiast sortować buduje tablicę hashującą z jednej strony.'
  ]
};

/** Etap Praktyka, część 3: salting linia po linii. Kod jest taki sam jak w eksperymencie 7 labu, z N = 16. */
export const salting = {
  title: 'Salting: gdy klucz trzeba zmienić samemu',
  intro: 'Zostaje przypadek, w którym broadcast nie wchodzi w grę, a AQE nie pomoże. Hash wysyła jeden klucz w jedno miejsce, więc trzeba sprawić, żeby gorący klucz przestał być jednym kluczem. Do klucza doklejasz losową liczbę, czyli <b>sól</b>. Kliknij kolejne linie.',
  codeTitle: 'Join z solą w PySparku',
  lines: [
    {
      code: 'N = 16',
      label: 'Na ile części dzielisz gorący klucz',
      text: 'Liczba wartości soli. Im większa, tym drobniej rozbijesz gorący klucz i tym bardziej urośnie druga strona joina.'
    },
    {
      code: 'orders_s = orders.withColumn("salt", (F.rand(seed=7) * N).cast("int"))',
      label: 'Skośna strona: losowa sól 0..15',
      text: 'Każde zamówienie dostaje losową liczbę od 0 do 15. Wiersze gorącego klucza rozchodzą się na 16 kluczy złożonych: (0, 0), (0, 1) i tak dalej.'
    },
    {
      code: 'salts = F.array(*[F.lit(i) for i in range(N)])',
      label: 'Lista wszystkich wartości soli',
      text: 'Tablica liczb od 0 do 15. Posłuży do powielenia drugiej strony.'
    },
    {
      code: 'customers_s = customers.withColumn("salt", F.explode(salts))',
      label: 'Druga strona: każdy wiersz 16 razy',
      text: 'Zamówienie z solą 11 musi znaleźć klienta z solą 11, więc każdy klient musi istnieć w 16 kopiach. <code>explode</code> zamienia jeden wiersz z tablicą na 16 wierszy. To główny koszt saltingu: w labie 1000 klientów zamieniło się w 16 000.'
    },
    {
      code: 'joined = orders_s.join(customers_s, ["customer_id", "salt"])',
      label: 'JOIN ... USING (customer_id, salt)',
      text: 'Join po kluczu złożonym. Hash liczy się teraz z pary, więc części gorącego klucza trafiają do różnych partycji. Wynik jest ten sam co bez soli: w labie 2 000 000 wierszy i identyczna suma.'
    }
  ] as ExplainedLine[],
  takeaway: '<b>Wniosek.</b> Salting działa tam, gdzie AQE się poddaje, bo zmienia dane, a nie plan. Płacisz za to większą drugą stroną joina, dodatkowym kodem i koniecznością utrzymania go, gdy rozkład danych się zmieni. Dlatego jest ostatnim krokiem, nie pierwszym.',
  measuredTitle: 'Pomiar: ile dał salting w labie',
  measured: [
    'Bez soli najbardziej obciążony task przeczytał 1 643 764 rekordy. Z solą 0..15 i tymi samymi 8 partycjami: 450 939 przy medianie 251 270.',
    'Rozkład nie wyszedł idealnie równy. Szesnaście posolonych kluczy trafia hashem do ośmiu partycji i nic nie gwarantuje, że po dwa do każdej.',
    'To pomiar lokalny na małych danych. Pokazuje, jak zmienia się rozkład pracy, a nie ile czasu zyskasz na klastrze.'
  ],
  moreTitle: 'Salting w agregacji i solenie tylko gorących kluczy',
  more: [
    'W agregacji nie ma drugiej strony do powielenia. Robisz dwa kroki: najpierw <code>groupBy</code> po kluczu i soli, potem po samym kluczu. Działa to dla wyników, które da się złożyć z części, np. sumy, liczby, minimum i maksimum. Dokładnej liczby unikalnych wartości tak nie policzysz.',
    'Jeśli gorących kluczy jest kilka, sól można nadać tylko im, a reszcie wpisać 0. Druga strona rośnie wtedy tylko dla tych kilku kluczy. To propozycja projektowa: lab jej nie mierzy.'
  ]
};

/** Etap Praktyka, część 4: co zmierzył lab. Każdy wiersz to linia wydruku skryptu. */
export const lab = {
  title: 'To samo na prawdziwym Sparku',
  intro: 'Jeden skrypt, osiem eksperymentów na wymyślonych danych: 2 000 000 zamówień, z których 80% ma <code>customer_id = 0</code>, i 1000 klientów. Miarą jest liczba rekordów, którą każdy task przeczytał z shuffle\'u, bo ona nie zależy od sprzętu.',
  hint: 'Skrypt uruchamia lokalnego Sparka i kończy się zwykle w kilkanaście sekund. Porównaj kolumnę „max" w kolejnych eksperymentach.',
  tableTitle: 'Wynik uruchomienia: najbardziej obciążony task',
  columns: ['Eksperyment', 'Tasków', 'Mediana', 'Max'],
  rows: [
    ['Join, klucz równy, bez AQE', '8', '242 121', '290 145'],
    ['Join, klucz skośny, bez AQE', '8', '52 583', '1 643 764'],
    ['To samo, 64 partycje', '64', '6 023', '1 605 621'],
    ['AQE, progi domyślne', '8', '52 583', '1 643 764'],
    ['AQE, próg 1 MB', '10', '55 988', '547 996'],
    ['Salting, sól 0..15, bez AQE', '8', '251 270', '450 939']
  ],
  note: 'Rekordy przeczytane z shuffle\'u na task. W wierszach z AQE sklejanie małych partycji jest wyłączone, żeby było widać samą obsługę skew. Pełny wydruk, razem z typami joina, sklejaniem partycji, zmianą strategii joina i wartościami <code>NULL</code>, daje skrypt.'
};

export interface Scenario { setup: string; options: string[]; correct: number; why: string; scope: string }
/** Etap Praktyka, część 5: diagnoza. Najpierw wybór, potem uzasadnienie i jego zakres. Liczby w scenariuszach są wymyślone. */
export const troubleshoot = {
  title: 'Diagnoza: co robisz najpierw?',
  intro: 'Cztery sytuacje z wymyślonymi liczbami. W każdej wybierz pierwszy krok, zanim przeczytasz uzasadnienie.',
  ask: 'Twój pierwszy krok:',
  cases: [
    {
      setup: 'Stage joina ma 200 tasków. Mediana czasu to 4 s, najdłuższy task trwa 38 minut. Jego shuffle read to 14 GB przy medianie 60 MB.',
      options: ['Dodaję executory', 'Podnoszę spark.sql.shuffle.partitions do 2000', 'Liczę wiersze na klucz i szukam gorącego klucza'],
      correct: 2,
      why: 'Metryki mówią, że jeden task dostał ponad 200 razy więcej danych, więc najpierw trzeba ustalić, który klucz to powoduje i dlaczego. Od tego zależy naprawa: NULL obsługuje się inaczej niż jednego dużego klienta. Executory nie pomogą, bo wolne rdzenie już są. Więcej partycji nie rozbije jednego klucza.',
      scope: 'Jeśli rozkład klucza okaże się równy, wracasz do metryk: duży shuffle read jednego taska może też oznaczać kilka średnich kluczy w jednej partycji, a wtedy więcej partycji ma sens.'
    },
    {
      setup: 'Inny stage: mediana czasu taska to 10 s, jeden task trwa 12 minut. Shuffle read tego taska to 61 MB przy medianie 60 MB.',
      options: ['To skew, włączam salting', 'To nie wygląda na skew danych, sprawdzam ten task i jego executor', 'Obniżam próg skew w AQE'],
      correct: 1,
      why: 'Wolny task dostał tyle samo danych co pozostałe, więc nierówny podział tego nie tłumaczy. Trzeba sprawdzić, czym ten task różni się od reszty: executor, na którym działał, czas odśmiecania pamięci, kosztowna funkcja dla części wierszy albo czekanie na zewnętrzny system.',
      scope: 'Jeden wolny task to poszlaka, nie diagnoza. Skew potwierdza rozmiar danych, a nie sam czas.'
    },
    {
      setup: 'Sort-merge join, AQE włączone, ustawienia domyślne Apache Spark. Jedna partycja ma 180 MB przy medianie 10 MB i jej task trwa wielokrotnie dłużej. W planie końcowym nie ma znacznika skew.',
      options: ['AQE jest zepsute, wyłączam je', 'Partycja jest poniżej 256 MB, więc AQE jej nie uznało za skośną', 'AQE nie obsługuje sort-merge joina'],
      correct: 1,
      why: 'Partycja jest 18 razy większa od mediany, ale AQE wymaga obu warunków naraz: ponad 5 × mediana i ponad 256 MB. Drugi nie jest spełniony. Sort-merge join jest obsługiwany, więc można rozważyć obniżenie skewedPartitionThresholdInBytes albo broadcast, jeśli druga strona jest mała.',
      scope: 'Przy 180 MB warto najpierw zapytać, czy ten task w ogóle jest problemem. Próg 256 MB istnieje po to, żeby nie dzielić partycji, które i tak liczą się szybko.'
    },
    {
      setup: 'Zamówienia LEFT JOIN klienci. 40% zamówień ma customer_id = NULL. Jeden task czyta większość danych, a żaden z tych wierszy nie znajduje pary.',
      options: ['Zamieniam join na inner', 'Solę klucz po obu stronach', 'Wiersze z NULL obsługuję osobno, bez joina, i dołączam do wyniku'],
      correct: 2,
      why: 'Wiersze z NULL w kluczu nie pasują do niczego, więc join nic do nich nie wnosi poza pustymi kolumnami klienta. Można je odfiltrować przed joinem, dopisać im te puste kolumny i połączyć z wynikiem przez unionByName. Inner join zmieniłby wynik, bo te zamówienia by zniknęły. Salting zadziała, ale jest droższy i bardziej skomplikowany niż usunięcie przyczyny.',
      scope: 'Jeśli AQE spełnia swoje warunki (partycja ponad progi, skośna strona po lewej), podzieli tę partycję samo. Usunięcie przyczyny nie zależy od progów i działa też bez AQE.'
    }
  ] as Scenario[],
  takeaway: '<b>Wniosek.</b> Kolejność, którą warto umieć powiedzieć: potwierdź skew w danych, usuń przyczynę, jeśli się da, sprawdź broadcast, pozwól działać AQE i sprawdź, czy naprawdę zadziałało, a po salting sięgnij na końcu.'
};

/**
 * Etap Interview. Pytania, odpowiedzi 30–60 s (PL i EN) oraz follow-upy przychodzą z Interview Banku.
 * Tutaj jest tylko to, czego bank nie ma: jak uczciwie mówić o temacie znanym z labu, a nie z produkcji.
 */
export const interview = {
  honestIntro: 'Jeśli znasz skew z labu i z dokumentacji, a nie z własnego incydentu, nie udawaj. Powiedz, skąd wiesz i co byś sprawdził. Na przykład tak:',
  honestEn: '“I haven’t had to fix a skewed join in production yet, so I’ll tell you how I’d approach it. I’d start from the task metrics, not from a config change: if one task reads far more shuffle data than the median, I’d count rows per key to find the hot key. In a local test with eighty percent of rows on one key, adding partitions didn’t move the largest partition at all, and AQE only split it once the partition crossed its size threshold. So I’d check the final plan before assuming AQE handled it.”',
  honestPl: 'Po polsku: nie naprawiałem jeszcze skośnego joina na produkcji, więc powiem, jak bym do tego podszedł. Zacząłbym od metryk tasków, a nie od zmiany konfiguracji: jeśli jeden task czyta z shuffle\'u dużo więcej niż mediana, liczę wiersze na klucz i szukam gorącego klucza. W lokalnym teście z 80% wierszy w jednym kluczu dokładanie partycji w ogóle nie zmniejszyło największej, a AQE podzieliło ją dopiero wtedy, gdy przekroczyła próg rozmiaru. Dlatego sprawdziłbym plan końcowy, zanim założę, że AQE to załatwiło.'
};

export interface QuizItem { q: string; setup?: string; options: string[]; correct: number; why: string }
/** Etap Sprawdź się: siedem krótkich pytań. Każde podaje założenia, jeśli wynik od nich zależy. */
export const quiz: QuizItem[] = [
  {
    q: 'Join po <code>customer_id</code>, jeden klient ma 80% wierszy. Zwiększasz liczbę partycji shuffle\'u z 200 do 2000. Co się stanie z największą partycją?',
    setup: 'Założenia: join przez shuffle, podział hashem klucza, AQE nie dzieli partycji.',
    options: ['Zmaleje mniej więcej 10 razy', 'Nadal będzie zawierać wszystkie wiersze tego klienta', 'Zniknie, bo wiersze rozłożą się po równo'],
    correct: 1,
    why: 'Hash jednej wartości klucza wskazuje jedną partycję, bez względu na ich liczbę. Zmaleją tylko partycje ze zwykłymi kluczami. W lokalnym teście przy 8 partycjach największa miała 1 643 654 wiersze, a przy 64 nadal 1 605 606.'
  },
  {
    q: 'W stage\'u jeden task trwa 30 razy dłużej niż mediana. Co najlepiej potwierdza, że przyczyną jest skew?',
    options: ['Sam czas tego taska', 'Shuffle read tego taska wielokrotnie większy od mediany i rozkład wierszy na klucz', 'To, że pozostałe rdzenie stoją bezczynnie'],
    correct: 1,
    why: 'Czas jest objawem, który ma wiele przyczyn. Skew oznacza nierówny podział danych, więc potwierdza go to, ile danych task dostał, oraz liczba wierszy na klucz. Wolny task z typowym shuffle read to inny problem.'
  },
  {
    q: 'Sort-merge join, AQE z ustawieniami domyślnymi. Mediana partycji to 30 MB, jedna ma 200 MB. Czy AQE ją podzieli?',
    setup: 'Założenia: Apache Spark, progi domyślne (5 × mediana i 256 MB), inner join.',
    options: ['Tak, bo jest ponad 5 razy większa od mediany', 'Nie, bo jest mniejsza niż 256 MB', 'Nie, bo AQE dzieli tylko w full outer joinie'],
    correct: 1,
    why: 'Oba warunki muszą być spełnione jednocześnie. 200 MB to ponad 5 × 30 MB, ale mniej niż 256 MB, więc AQE nie uzna tej partycji za skośną. Full outer join to akurat przypadek, w którym AQE nie dzieli żadnej strony.'
  },
  {
    q: 'Gorący klucz spowalnia funkcję okna <code>row_number()</code> liczoną po <code>customer_id</code>. AQE jest włączone. Czego się spodziewasz?',
    options: ['AQE podzieli skośną partycję tak jak w joinie', 'AQE jej nie podzieli, bo jego obsługa skew dotyczy joinów', 'AQE zamieni okno na broadcast'],
    correct: 1,
    why: 'Obsługa skew w AQE jest opisana dla joinów przez shuffle. W lokalnym teście funkcja okna przy obniżonych progach dalej miała task z 1 643 654 rekordami. AQE może tu najwyżej skleić małe partycje.'
  },
  {
    q: 'Solisz skośną stronę joina liczbą od 0 do 9. Co musisz zrobić z drugą stroną?',
    options: ['Nic, join po samym kluczu nadal działa', 'Powielić każdy jej wiersz 10 razy, po jednym na wartość soli', 'Też dodać losową sól od 0 do 9'],
    correct: 1,
    why: 'Join jest teraz po parze klucz i sól. Wiersz z solą 7 znajdzie parę tylko wtedy, gdy druga strona ma ten klucz z solą 7. Losowa sól po drugiej stronie zgubiłaby większość dopasowań. Koszt: druga strona rośnie 10 razy.'
  },
  {
    q: 'Po wykonaniu zapytania plan pokazuje <code>BroadcastHashJoin</code>, chociaż przed wykonaniem był w nim <code>SortMergeJoin</code>. Co się stało?',
    options: ['Spark zignorował plan i policzył zapytanie dwa razy', 'AQE zobaczyło po shuffle\'u, że jedna strona jest mała, i zmieniło strategię joina', 'Zadziałała obsługa skew'],
    correct: 1,
    why: 'To druga z trzech rzeczy, które robi AQE: zmiana sort-merge joina na broadcast hash join na podstawie rozmiarów zmierzonych po shuffle\'u. Według dokumentacji jest to mniej wydajne niż zaplanowanie broadcastu od początku, ale lepsze niż sortowanie obu stron.'
  },
  {
    q: 'Zamówienia LEFT JOIN klienci, połowa zamówień ma <code>customer_id = NULL</code>. Dlaczego te wiersze obciążają jeden task?',
    options: ['Bo NULL pasuje do każdego klienta', 'Bo left join musi je zachować, a wszystkie mają ten sam klucz, więc trafiają do jednej partycji', 'Bo Spark nie umie hashować NULL i liczy je na driverze'],
    correct: 1,
    why: 'NULL nie pasuje do niczego, ale left join musi oddać te wiersze w wyniku. Wszystkie mają tę samą wartość klucza, więc lądują razem. W lokalnym teście inner join odfiltrował je przed shuffle\'em, a left join wysłał je do jednego taska.'
  }
];

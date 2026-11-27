import type { Bridge, ExplainedLine, LessonMeta } from '../../types';

/**
 * Lekcja 03: Partitioning & Shuffle. Jedno pytanie przewodnie: które operacje liczą każdą partycję osobno,
 * a które muszą przenieść rekordy między partycjami, ile to kosztuje i kto decyduje o liczbie partycji.
 *
 * Fragmenty narracyjne są w HTML (dozwolone znaczniki: lib/richText.ts) i mogą używać
 * <term id="...">, czyli haseł z content/glossary.ts.
 *
 * Skąd są fakty: lab labs/partitioning_shuffle/shuffle_lab.py (PySpark 4.0.1 i 4.3.0, local[3]),
 * istniejący lab labs/interview_bank/spark_checks.py oraz dokumentacja Apache Spark 4.3.0, Databricks
 * i Snowflake. Wszystko jest spisane w docs/verified-facts.md (sekcja „Lekcja 03").
 * Symulacja pokazuje ruch rekordów jako ilustrację: układ końcowy i liczniki pochodzą z labu,
 * a sama animacja nie jest zapisem pracy Sparka.
 * Pytania rekrutacyjne, krótkie odpowiedzi i follow-upy nie są tu powtórzone: lekcja bierze je
 * z Interview Banku.
 */
export const meta: LessonMeta = {
  id: 'spark-partitioning-shuffle',
  topicId: 'spark.shuffle',
  area: 'spark',
  title: 'Partitioning & Shuffle',
  subtitle: 'Które operacje liczą każdy kawałek danych osobno, a które muszą przenieść rekordy między partycjami. Ile to kosztuje i kto decyduje o liczbie partycji.',
  minutes: 30
};

/** Lab tej lekcji: id z labs/registry.json. */
export const labId = 'spark-partitioning-shuffle-lab';
export const labHint = 'Zanim uruchomisz: przy każdym eksperymencie poniżej najpierw zgadnij wynik, potem porównaj go z wydrukiem.';
const ENV = 'PySpark 4.0.1, <term id="local-mode">local[3]</term>, AQE wyłączone, żeby plan był ostateczny od razu';

/**
 * Pytanie z banku o innym topicId, które lekcja pokazuje w etapie Interview obok pytania o shuffle.
 * Treść nadal pochodzi z banku: tu jest tylko wskazanie po id.
 */
export const relatedQuestionIds = ['spark-repartition-coalesce'];

export type Country = 'PL' | 'DE' | 'FR' | 'IT';
export interface Order { id: number; country: Country; amount: number }

/**
 * Dane wspólne dla ilustracji, symulacji i labu: 12 zamówień w 3 partycjach po 4 wiersze, w kolejności listy.
 * Ta sama lista jest w labs/partitioning_shuffle/shuffle_lab.py (ORDERS).
 */
export const orders: Order[] = [
  { id: 1, country: 'PL', amount: 120 }, { id: 2, country: 'DE', amount: 80 }, { id: 3, country: 'PL', amount: 40 }, { id: 4, country: 'FR', amount: 200 },
  { id: 5, country: 'DE', amount: 60 }, { id: 6, country: 'PL', amount: 90 }, { id: 7, country: 'IT', amount: 150 }, { id: 8, country: 'PL', amount: 30 },
  { id: 9, country: 'FR', amount: 70 }, { id: 10, country: 'DE', amount: 110 }, { id: 11, country: 'PL', amount: 50 }, { id: 12, country: 'IT', amount: 20 }
];
export const inputPartitions = 3;
export const rowsPerPartition = 4;

/** Krok etapu Intuicja. `visual` wstawia ilustrację między `html` a `after`. */
export interface Beat {
  html: string;
  visual?: 'peek';
  after?: string;
  next: string;
  bridge?: Bridge;
  more?: { title: string; html: string[] };
}

/** Pytanie pod ilustracją w pierwszym kroku: kto potrafi sam policzyć sumę dla jednego kraju. */
export const peek = {
  note: 'Ilustracja: 12 zamówień, 3 partycje. Każdy kafelek to jeden wiersz: kraj i kwota.',
  ask: 'Który task potrafi sam podać sumę sprzedaży dla PL?',
  options: ['Task partycji 0', 'Każdy z trzech', 'Żaden'],
  correct: 2,
  ok: 'Żaden.',
  no: 'Żaden, choć łatwo się tu pomylić.',
  why: 'Wiersze z PL leżą we wszystkich trzech partycjach, a task widzi tylko swoją. Każdy zna więc kawałek odpowiedzi: 160, 120 i 50. Pełne 330 powstanie dopiero wtedy, gdy te kawałki spotkają się w jednym miejscu.'
};

export const beats: Beat[] = [
  {
    html: '<h1>Jeden klucz, trzy kawałki danych</h1>\n<p class="lede">Zamówienia leżą w trzech partycjach. Każdą liczy osobny task i żaden nie widzi pozostałych.</p>\n<p>Dopóki pytasz o coś, na co da się odpowiedzieć wiersz po wierszu, np. „zostaw zamówienia od 60 zł w górę", to nie przeszkadza: każdy task filtruje swój kawałek i nikt z nikim nie rozmawia. Teraz pytanie trudniejsze.</p>',
    visual: 'peek',
    after: '<b>Wniosek.</b> Filtr potrzebuje tylko wiersza, który ma przed sobą. Suma dla klucza potrzebuje wszystkich wierszy z tym kluczem, a te są rozrzucone po partycjach.',
    next: 'Jak je zebrać w jednym miejscu?'
  },
  {
    html: '<h2>Umówić się, dokąd jedzie każdy klucz</h2>\n<p>Najprościej byłoby ściągnąć wszystko do jednego procesu i tam policzyć. Przy dwunastu wierszach to działa. Przy miliardzie jeden proces tego nie pomieści i właśnie po to dane były dzielone.</p>\n<p>Spark robi inaczej. Ustala regułę, która każdemu kluczowi przypisuje jedną partycję docelową, np. „PL zawsze do partycji 2". Każdy task odsyła swoje rekordy tam, gdzie każe reguła. Po tej przeprowadzce wszystko, co dotyczy PL, leży w jednej partycji i jeden task może to dokończyć.</p>\n<p>Ta przeprowadzka nazywa się <b>shuffle</b>: przegrupowanie danych między partycjami. Gdy przeprowadzka nie jest potrzebna, zależność nazywa się <b>narrow</b> (wąska): każda partycja wyniku powstaje z jednej albo kilku całych partycji wejścia i żadnej partycji wejścia nie trzeba rozdzielać między wiele partycji wyniku. Gdy rekordy z jednej partycji wejścia muszą trafić do wielu partycji wyniku, zależność jest <b>wide</b> (szeroka) i wymaga shuffle\'u.</p>',
    next: 'Czy ja tego nie znam z SQL?'
  },
  {
    html: '<h2>W SQL robisz to codziennie, tylko nikt Ci tego nie pokazuje</h2>\n<p><code>GROUP BY</code>, <code>JOIN</code>, <code>DISTINCT</code>, <code>ORDER BY</code> i funkcje okna z <code>PARTITION BY</code> mają tę samą potrzebę: pasujące wiersze muszą się spotkać. Hurtownia, która liczy zapytanie na wielu maszynach, też musi je do siebie doprowadzić.</p>\n<p>Różnica polega na tym, co widzisz i za co odpowiadasz.</p>',
    bridge: {
      from: 'Snowflake',
      known: 'Piszesz <code>GROUP BY country</code> i dostajesz wynik. W Query Profile widzisz operator Aggregate, a w statystykach m.in. „Bytes sent over the network" i dane zrzucone na dysk (spilling).',
      fresh: 'To samo zapytanie ma w planie jawny krok przegrupowania: węzeł <code>Exchange</code>. Widać go w planie i w Spark UI, a liczbę partycji po nim ustawia konfiguracja, którą możesz zmienić.',
      breaks: 'Dokumentacja Query Profile nie wymienia osobnego operatora przegrupowania danych, więc nie wiesz, ile ich było ani na ile części podzielono dane. W Sparku wiesz i masz na to wpływ. Uwaga też na słowo „partycja": mikropartycja Snowflake to jednostka przechowywania tabeli (50–500 MB danych przed kompresją, tworzona automatycznie), a partycja Sparka to kawałek danych w trakcie obliczeń.'
    },
    next: 'Zobacz, jak rekordy się przenoszą'
  }
];

/** Operacja w symulacji. Liczby w `lab` pochodzą z labs/partitioning_shuffle/shuffle_lab.py. */
export interface SimOp {
  id: 'filter' | 'groupBy' | 'repartitionKey' | 'repartition' | 'coalesce';
  label: string;
  code: string;
  sql: string;
  /** narrow: bez shuffle'u. wide: z shuffle'em. */
  kind: 'narrow' | 'wide';
  outPartitions: number;
  /** Podpis pasa między partycjami wejścia a wyniku. */
  band: string;
  /** Opis kolejnych kroków animacji. Pierwszy to stan początkowy. */
  steps: string[];
  lab: { shuffleRecords: number; stages: number; tasks: number[] };
  verdict: string;
}

export const sim = {
  question: 'Które operacje ruszają rekordy z miejsca?',
  intro: 'Te same 12 zamówień w 3 partycjach. Wybierz operację i ją uruchom. Patrz na dwie rzeczy: czy kafelki jadą prosto w dół, czy krzyżują się między partycjami, oraz ile rekordów przechodzi przez pas na środku.',
  assumptions: 'Ruch kafelków to ilustracja w JavaScripcie. Układ końcowy i trzy liczniki pochodzą z uruchomienia labu <code>shuffle_lab.py</code> (PySpark 4.0.1, <term id="local-mode">local[3]</term>, AQE wyłączone, 4 partycje po shuffle\'u).',
  minAmount: 60,
  /** Partycja docelowa klucza przy 4 partycjach: pmod(hash(country), 4) z labu. */
  hashTarget: { FR: 0, IT: 1, PL: 2, DE: 3 } as Record<Country, number>,
  hashLegend: 'Reguła z labu: numer partycji = hash(country) mod 4',
  /** Układ po repartition(4) bez klucza, z labu: partycja -> id zamówień. */
  roundRobin: [[1, 8, 11], [3, 7, 10], [2, 5, 9], [4, 6, 12]],
  /** coalesce(2), z labu: partycje wejścia sklejone w partycje wyniku. */
  coalesceGroups: [[0], [1, 2]],
  defaultOp: 'filter',
  counters: { shuffle: 'rekordów<br />przez shuffle', stages: 'liczba<br />stage\'y', tasks: 'taski<br />w stage\'ach' },
  bandIdle: 'tu pojawi się granica, jeśli operacja jej wymaga',
  ops: [
    {
      id: 'filter',
      label: 'filter',
      code: 'orders.filter("amount >= 60")',
      sql: 'WHERE amount >= 60',
      kind: 'narrow',
      outPartitions: 3,
      band: 'bez shuffle\'u · jeden stage',
      steps: [
        'Każdy task dostaje swoją partycję.',
        'Task sprawdza warunek wiersz po wierszu. Wiersze poniżej 60 odpadają.',
        'Reszta zostaje w tej samej partycji, w której była. Żaden wiersz nie zmienił partycji.'
      ],
      lab: { shuffleRecords: 0, stages: 1, tasks: [3] },
      verdict: 'Zależność narrow, tutaj jeden do jednego: każda partycja wyniku powstaje z jednej partycji wejścia, więc nie ma czego przenosić. Partycje zrobiły się za to nierówne: 3, 3 i 2 wiersze.'
    },
    {
      id: 'groupBy',
      label: 'groupBy + sum',
      code: 'orders.groupBy("country").sum("amount")',
      sql: 'SELECT country, SUM(amount) … GROUP BY country',
      kind: 'wide',
      outPartitions: 4,
      band: 'SHUFFLE · granica stage\'a',
      steps: [
        'Każdy task dostaje swoją partycję.',
        'Najpierw każdy task sumuje to, co ma u siebie: jedna suma częściowa na kraj w partycji. Z 12 wierszy robi się 10 sum częściowych.',
        'Sumy częściowe jadą do partycji wskazanej przez hash kraju. To jest shuffle: przechodzi przez niego 10 rekordów, a nie 12 wierszy.',
        'Po drugiej stronie każdy task dodaje sumy częściowe swojego kraju. Każdy kraj leży w jednej partycji i ma jeden wynik.'
      ],
      lab: { shuffleRecords: 10, stages: 2, tasks: [3, 4] },
      verdict: 'Zależność wide. Jedna partycja wyniku potrzebuje danych z wielu partycji wejścia, więc Spark dodaje shuffle. Przesyła jednak sumy częściowe, a nie każdy wiersz.'
    },
    {
      id: 'repartitionKey',
      label: 'repartition(4, country)',
      code: 'orders.repartition(4, "country")',
      sql: 'SELECT /*+ REPARTITION(4, country) */ …',
      kind: 'wide',
      outPartitions: 4,
      band: 'SHUFFLE · granica stage\'a',
      steps: [
        'Każdy task dostaje swoją partycję.',
        'Każdy wiersz jedzie do partycji wskazanej przez hash kraju. Tu nic się nie sumuje, więc przez shuffle przechodzi wszystkie 12 wierszy.',
        'Każdy kraj leży w jednej partycji, ale partycje są nierówne: 2, 2, 5 i 3 wiersze. PL ma najwięcej zamówień, więc jego partycja jest największa.'
      ],
      lab: { shuffleRecords: 12, stages: 2, tasks: [3, 4] },
      verdict: 'Pełny shuffle po kluczu. Hash gwarantuje, że jeden klucz trafia do jednej partycji. Nie gwarantuje równych partycji: rozmiar zależy od tego, ile wierszy ma dany klucz.'
    },
    {
      id: 'repartition',
      label: 'repartition(4)',
      code: 'orders.repartition(4)',
      sql: 'SELECT /*+ REPARTITION(4) */ …',
      kind: 'wide',
      outPartitions: 4,
      band: 'SHUFFLE · granica stage\'a',
      steps: [
        'Każdy task dostaje swoją partycję.',
        'Bez klucza Spark rozdaje wiersze po kolei między partycje docelowe (round-robin). Przez shuffle znów przechodzi wszystkie 12 wierszy.',
        'W tym uruchomieniu wyszło po 3 wiersze w partycji. Za to kraje są rozrzucone: PL leży teraz w trzech partycjach.'
      ],
      lab: { shuffleRecords: 12, stages: 2, tasks: [3, 4] },
      verdict: 'Pełny shuffle bez klucza. Daje zbliżone liczby wierszy w partycjach, ale nie gwarantuje równych rozmiarów w bajtach i nie patrzy na klucze, więc nie przygotowuje danych pod grupowanie ani join.'
    },
    {
      id: 'coalesce',
      label: 'coalesce(2)',
      code: 'orders.coalesce(2)',
      sql: 'SELECT /*+ COALESCE(2) */ …',
      kind: 'narrow',
      outPartitions: 2,
      band: 'jeden stage · 2 taski czytają 3 partycje',
      steps: [
        'Trzy partycje wejścia. Tym razem tasków będzie tyle, ile partycji wyniku: dwa, a nie trzy.',
        'Spark skleja całe partycje. Pierwszy task czyta partycję 0, drugi czyta partycje 1 i 2, jedną po drugiej. Nikt nie rozdaje wierszy pojedynczo.',
        'Są 2 partycje zamiast 3, ale nierówne: 4 i 8 wierszy. Nie powstał żaden plik shuffle\'u ani nowy stage.'
      ],
      lab: { shuffleRecords: 0, stages: 1, tasks: [2] },
      verdict: 'Zależność narrow, choć nie jeden do jednego: partycja wyniku powstaje z kilku całych partycji wejścia, a żadna partycja wejścia nie jest dzielona. Liczbę partycji zmniejsza bez shuffle\'u, ale niczego nie wyrównuje, a pracę trzech tasków wykonują teraz dwa. Na klastrze sklejane partycje mogą leżeć na różnych maszynach, więc dane potrafią zmienić węzeł, ale bez mechanizmu shuffle\'u.'
    }
  ] as SimOp[],
  takeaway: [
    '<b>Wniosek.</b> Kafelki jadą prosto w dół, gdy partycja wyniku powstaje z jednej albo kilku całych partycji wejścia: to zależność narrow, bez shuffle\'u. Krzyżują się, gdy rekordy z jednej partycji wejścia trzeba rozdać do wielu partycji wyniku według reguły: hasha klucza albo rozdawania po kolei. To zależność wide i shuffle.',
    'W tych pięciu planach każdy shuffle dzieli pracę na dwa <term id="stage">stage\'e</term>: taski sprzed pasa zapisują dane dla shuffle\'u, taski zza pasa je odczytują. W planie fizycznym jeden węzeł shuffle\'u to jedna taka granica. Ile stage\'y i jobów zobaczysz w interfejsie, zależy też od AQE i od ponownego użycia wcześniejszych wyników.',
    '<code>groupBy</code> i <code>join</code> to operacje w Twoim kodzie. O tym, czy powstanie shuffle, decyduje plan fizyczny: gdy dane są już podzielone po kluczu albo mała tabela jest rozsyłana w całości (broadcast), shuffle\'u może nie być.'
  ],
  notesTitle: 'Co tu jest ilustracją, a co wynikiem ze Sparka',
  notes: [
    'Animacja to JavaScript. Nie działa tu żaden Spark i nic nie jest przesyłane.',
    'Z labu pochodzą: w której partycji ląduje każdy wiersz, liczba rekordów zapisanych do shuffle\'u, liczba stage\'y i tasków. Te same liczby zobaczysz, gdy uruchomisz lab w etapie Praktyka.',
    'Ilustracją jest wszystko, co dotyczy ruchu: kolejność, tempo i tor kafelków. Prawdziwy shuffle nie przesyła rekordów pojedynczo. Task zapisuje dane dla wszystkich partycji docelowych do pliku, a taski następnego stage\'a pobierają z niego swoje bloki.',
    'Lab działa lokalnie, w jednym procesie. Nie ma w nim sieci: pliki shuffle\'u trafiają na lokalny dysk i ten sam proces je czyta. Na klastrze doszedłby transfer między maszynami.',
    'Rozdawanie „po kolei" przy <code>repartition(4)</code> to uproszczenie. W planie ten podział nazywa się <code>RoundRobinPartitioning</code>, a układ w symulacji jest przepisany z labu, nie wyliczony w przeglądarce.',
    'Dwanaście wierszy to przykład. Przy takich danych shuffle jest czystą stratą czasu, a jego koszt widać dopiero przy dużych zbiorach.'
  ],
  waysTitle: 'Hash, round-robin, zakresy: trzy reguły podziału',
  ways: [
    '<b>Hash klucza.</b> Spark liczy hash z kolumn klucza i bierze resztę z dzielenia przez liczbę partycji. W labie numer partycji każdego kraju zgadzał się z <code>pmod(hash(country), 4)</code>. Ta sama wartość klucza zawsze daje ten sam numer, więc jeden klucz trafia do jednej partycji. Tak dzielą <code>groupBy</code>, join przez shuffle i <code>repartition</code> z kolumną.',
    '<b>Round-robin.</b> <code>repartition(n)</code> bez kolumn rozdaje wiersze po kolei. W istniejącym labie <code>spark_checks.py</code> 100 000 wierszy na 8 partycji dało rozmiary 12 498–12 501, a jeden klucz trafił w tym uruchomieniu do wszystkich 8 partycji. To zbliżone liczby wierszy, a nie gwarancja: reguła nie patrzy na rozmiar wierszy w bajtach ani na klucze.',
    '<b>Zakresy.</b> <code>repartitionByRange</code> i <code>orderBy</code> dzielą dane na przedziały wartości: małe wartości do pierwszej partycji, większe do kolejnych. W tym samym labie jeden klucz też leżał w jednej partycji.',
    'Żadna z reguł opartych na kluczu nie wyrównuje rozmiarów. Gdy 80% wierszy miało jeden klucz, niepuste partycje po <code>repartition(8, k)</code> miały od 2 000 do 80 000 wierszy.'
  ]
};

/** Mechanizm, część 2: z czego składa się koszt shuffle'u. Cztery kroki, wszystkie widoczne od razu. */
export const cost = {
  title: 'Dlaczego shuffle jest drogi?',
  intro: 'Filtr dotyka wiersza w pamięci i idzie dalej. Rekord, który przechodzi przez shuffle, ma dłuższą drogę. Dokumentacja Sparka nazywa shuffle operacją kosztowną, bo wymaga serializacji danych, zapisu i odczytu z dysku oraz transferu po sieci.',
  note: 'Schemat drogi jednego rekordu. To ilustracja mechanizmu, nie pomiar.',
  steps: [
    { k: 'Serializacja', where: 'task przed shuffle\'em', text: 'Obiekt w pamięci trzeba zamienić na ciąg bajtów, żeby dało się go zapisać i wysłać. Po drugiej stronie bajty są zamieniane z powrotem. To praca procesora przy każdym rekordzie.' },
    { k: 'Dysk', where: 'maszyna, która wysyła', text: 'Task zapisuje dane dla shuffle\'u do plików na lokalnym dysku swojej maszyny, ułożone według partycji docelowej. Pliki zostają, dopóki są potrzebne, żeby nie tworzyć ich ponownie.' },
    { k: 'Sieć', where: 'tylko bloki z innych maszyn', text: 'Taski następnego stage\'a pobierają swoje bloki. Blok zapisany na tej samej maszynie jest czytany lokalnie, a blok z innego executora idzie siecią. Czas czekania na zdalne dane widać w metrykach taska.' },
    { k: 'Pamięć', where: 'task po shuffle\'u', text: 'Żeby pogrupować albo posortować odebrane rekordy, task buduje struktury w pamięci. Gdy dane się nie mieszczą, Spark zrzuca je na dysk (spill): zapytanie zwykle się kończy, ale wolniej.' }
  ],
  takeaway: '<b>Wniosek.</b> Shuffle kosztuje cztery razy: procesor na serializację, dysk na pliki shuffle\'u, sieć na bloki pobierane z innych maszyn i pamięć na odbiór. Dlatego przy optymalizacji pierwsze pytania brzmią: ile jest shuffle\'i w planie, ile danych przez każdy przechodzi i czy każdy jest potrzebny.',
  uiTitle: 'Gdzie te koszty widać w Spark UI',
  ui: [
    'W widoku stage\'a <term id="spark-ui">Spark UI</term> są osobne metryki. <b>Shuffle Write</b>: bajty i rekordy zapisane na dysk dla przyszłego shuffle\'u. <b>Shuffle Read</b>: bajty i rekordy odczytane, lokalnie i z innych executorów.',
    '<b>Shuffle Read Fetch Wait Time</b> to czas, przez który taski czekały na dane shuffle\'u z innych maszyn. <b>Shuffle Remote Reads</b> to bajty pobrane z innych executorów.',
    '<b>Shuffle spill (memory)</b> i <b>Shuffle spill (disk)</b> pokazują zrzut na dysk: rozmiar danych w pamięci przed zrzutem i rozmiar po zapisaniu. <b>Peak execution memory</b> to szczytowa pamięć struktur budowanych przy shuffle\'ach, agregacjach i joinach.',
    'W lokalnym labie zobaczysz tylko część z tego. Zapis do shuffle\'u jest (w eksperymencie z <code>groupBy</code> było to 10 rekordów i 710 bajtów), ale odczytów z innych maszyn nie ma, bo jest jedna maszyna.'
  ],
  partialTitle: 'Shuffle nie zawsze niesie każdy wiersz',
  partial: [
    'W symulacji <code>groupBy</code> wysłał 10 rekordów, a <code>repartition</code> 12. Na 12 wierszach różnica jest symboliczna. W istniejącym labie <code>spark_checks.py</code>, na 100 000 wierszy z 50 kluczami w 3 partycjach, wygląda to tak: <code>groupBy</code> z sumą zapisał do shuffle\'u 150 rekordów (50 kluczy razy 3 partycje), a sort-merge join po tym samym kluczu zapisał wszystkie 100 000 wierszy dużej strony.',
    'Powód: sumę da się policzyć na raty. Najpierw w każdej partycji, potem z sum częściowych. Join musi mieć obok siebie same wiersze, więc częściowego wyniku nie ma z czego zrobić.',
    'To pomiary lokalne z jednego uruchomienia. Pokazują mechanizm, a nie stałą proporcję: przy bardzo wielu różnych kluczach sum częściowych jest prawie tyle, co wierszy, i zysk znika.'
  ],
  avoidTitle: 'Kiedy operacja wide obywa się bez shuffle\'u',
  avoid: [
    'Join z małą tabelą może pójść inną drogą: Spark rozsyła małą tabelę w całości do executorów (broadcast), a duża strona nie jest przegrupowywana. W planie widać wtedy <code>BroadcastExchange</code>. Mimo słowa „Exchange" to nie jest shuffle.',
    'Shuffle nie jest też potrzebny, gdy dane są już podzielone tak, jak wymaga operacja. W labie <code>repartition(4, "country")</code>, a po nim <code>groupBy("country")</code>, dało plan z jednym węzłem <code>Exchange</code>, a nie z dwoma: Spark nie przegrupowuje drugi raz danych, które już leżą po kluczu.',
    'Wynik shuffle\'u bywa też użyty ponownie. Pliki shuffle\'u zostają na dysku, więc gdy kolejna akcja potrzebuje tego samego przegrupowania, stage, który je zapisał, może zostać pominięty. Lekcja o lazy evaluation pokazywała to na liczniku wierszy.'
  ]
};

/** Mechanizm, część 3: shuffle w planie i granica stage'a. Plan z labu, czytany od dołu. */
export const plan = {
  title: 'Jak rozpoznać shuffle w planie?',
  intro: 'Nie musisz zgadywać, czy operacja wymaga shuffle\'u. <code>explain()</code> wypisuje plan fizyczny, czyli listę kroków, które Spark faktycznie wykona. Shuffle to w nim węzeł <code>Exchange</code>. Poniżej plan dla <code>groupBy("country").sum("amount")</code> z labu. Plan czyta się od dołu: tam jest źródło.',
  codeTitle: 'Plan fizyczny · groupBy(country).sum(amount)',
  badge: 'Wydruk z labu · PySpark 4.0.1 · local[3] · AQE wyłączone',
  lines: [
    {
      code: '*(2) HashAggregate(keys=[country#1], functions=[sum(amount#2)], output=[country#1, total#7L])',
      label: 'drugi stage: suma końcowa na kraj',
      text: 'Po shuffle\'u każdy kraj leży w jednej partycji. Ten krok dodaje sumy częściowe i daje jeden wiersz na kraj. W labie liczyły go 4 taski, bo tyle partycji miał wynik shuffle\'u.'
    },
    {
      code: '+- Exchange hashpartitioning(country#1, 4), ENSURE_REQUIREMENTS, [plan_id=85]',
      label: 'shuffle i granica stage\'a',
      text: 'To jest shuffle. <code>hashpartitioning(country, 4)</code> mówi, jak dzielone są dane: hashem kolumny <code>country</code> na 4 partycje. W labie przy <code>groupBy</code> dopisek brzmiał <code>ENSURE_REQUIREMENTS</code>, a przy <code>repartition</code>, o który prosi kod, <code>REPARTITION_BY_NUM</code>. Wszystko poniżej tej linii liczy jeden stage, wszystko powyżej drugi.'
    },
    {
      code: '   +- *(1) HashAggregate(keys=[country#1], functions=[partial_sum(amount#2)], output=[country#1, sum#13L])',
      label: 'pierwszy stage: suma częściowa w każdej partycji',
      text: 'Ten sam <code>GROUP BY</code>, ale liczony osobno w każdej partycji wejścia: <code>partial_sum</code>. Stąd 10 rekordów w shuffle\'u zamiast 12 wierszy. Tego kroku nie ma w Twoim kodzie, dopisał go Spark.'
    },
    {
      code: '      +- *(1) Project [country#1, amount#2]',
      label: 'SELECT country, amount',
      text: 'Wybór dwóch kolumn potrzebnych do sumy. <code>order_id</code> odpada już tutaj, więc nie jest serializowany ani przesyłany. Im mniej kolumn i wierszy dociera do shuffle\'u, tym jest on tańszy.'
    },
    {
      code: '         +- *(1) Scan ExistingRDD[order_id#0,country#1,amount#2]',
      label: 'FROM orders',
      text: 'Źródło: 12 wierszy w 3 partycjach, zbudowane w pamięci na potrzeby labu. Liczby po znaku <code>#</code> to wewnętrzne identyfikatory kolumn. Gwiazdka z numerem, np. <code>*(1)</code>, oznacza grupę operatorów skompilowanych razem. To nie jest numer stage\'a z interfejsu, choć w tym planie podział wypada w tym samym miejscu.'
    }
  ] as ExplainedLine[],
  takeaway: '<b>Wniosek.</b> <code>Exchange</code> z rodzajem podziału to shuffle. W tym planie wyznacza on granicę między dwoma stage\'ami. W labie plan dał 2 stage\'e: pierwszy miał 3 taski (po jednym na partycję wejścia) i zapisał 10 rekordów, drugi miał 4 taski i te 10 rekordów odczytał.',
  stageTitle: 'Dlaczego granica wypada akurat na shuffle\'u',
  stage: [
    'Stage to grupa tasków, które da się policzyć jednym ciągiem, bez czekania na inne partycje. Filtr, wybór kolumn i suma częściowa łączą się w jeden taki ciąg: task czyta partycję i robi wszystko po kolei.',
    'Shuffle ten ciąg przerywa. Task po drugiej stronie potrzebuje danych od wszystkich tasków sprzed shuffle\'u, więc musi poczekać, aż wszystkie skończą zapis. Dokumentacja nazywa taski piszące „map", a czytające „reduce". Te nazwy pochodzą z MapReduce i nie mają związku z funkcjami <code>map</code> i <code>reduce</code>.',
    'Reguła „jeden shuffle, jedna granica" opisuje plan. W interfejsie liczba jobów i stage\'y bywa inna: <term id="aqe">AQE</term> potrafi uruchomić część planu jako osobny job, a stage z gotowymi plikami shuffle\'u może zostać pominięty.'
  ]
};

/** Praktyka, część 1: liczba partycji a zasoby. Ilustracja z arytmetyką, bez pomiaru. */
export const sizing = {
  title: 'Ile partycji to dobrze?',
  intro: 'Po shuffle\'u ktoś musi zdecydować, na ile partycji podzielić dane. W Apache Spark robi to ustawienie <code>spark.sql.shuffle.partitions</code>, domyślnie 200, niezależnie od tego, czy danych jest 12 wierszy, czy 2 TB. Zobacz, co ta liczba znaczy dla jednego, stałego zbioru.',
  assumptions: 'Ilustracja, nie pomiar: 100 GB danych po shuffle\'u, klaster z 16 rdzeniami, równe partycje, jeden rdzeń liczy jeden task naraz. Liczby to zwykła arytmetyka, liczona dziesiętnie: 1 GB = 1000 MB.',
  totalGb: 100,
  cores: 16,
  options: [4, 400, 40000],
  defaultOption: 400,
  labels: { size: 'na jedną<br />partycję', parallel: 'tasków<br />jednocześnie', rounds: 'liczba<br />tur' },
  verdicts: [
    { state: 'no', head: 'Za mało partycji', text: 'Każdy task dostaje 25 GB. Musi je posortować albo pogrupować w pamięci, więc grozi zrzut na dysk albo brak pamięci. Do tego pracują 4 rdzenie z 16: reszta nie ma co robić, bo tasków jest tylko tyle, ile partycji.' },
    { state: 'ok', head: 'Partycje umiarkowanej wielkości', text: 'Partycja ma 250 MB i wszystkie rdzenie mają pracę. Liczba 400 jest tu dobrana pod rozmiar partycji, a nie pod liczbę rdzeni: 16 rdzeni przerobi ją w 25 turach. Zalecenie z dokumentacji, 2–3 taski na rdzeń, dałoby tu 32–48 partycji po 2–3 GB. To punkt wyjścia dla równoległości, a nie reguła rozmiaru. Czy 250 MB to dobry rozmiar, zależy od operacji i pamięci executora.' },
    { state: 'risk', head: 'Za dużo partycji', text: 'Partycja ma 2,5 MB. Każdy task trzeba zaplanować, uruchomić i rozliczyć, a tych jest 40 000, więc rośnie narzut na samą obsługę. Jeśli taki wynik zapiszesz, powstanie też mnóstwo małych plików.' }
  ] as { state: 'ok' | 'risk' | 'no'; head: string; text: string }[],
  takeaway: [
    '<b>Wniosek.</b> Liczba partycji ustala dwie rzeczy naraz: rozmiar pracy jednego taska i liczbę tasków. Za mało partycji daje duże taski i bezczynne rdzenie. Za dużo daje narzut na obsługę i małe pliki. Liczba rdzeni decyduje tylko o tym, ile tasków działa jednocześnie.',
    'Nie ma jednej dobrej liczby. Patrzy się na rozmiar partycji, a nie na ich liczbę, i sprawdza się go w Spark UI, zamiast zakładać.'
  ],
  aqeTitle: 'Kto dziś ustawia tę liczbę: AQE i wartości domyślne',
  aqe: [
    'W Apache Spark <term id="aqe">AQE</term> jest domyślnie włączone od wersji 3.2. Jedną z jego funkcji jest sklejanie małych partycji po shuffle\'u: Spark patrzy na faktyczne rozmiary i łączy sąsiednie partycje, żeby uniknąć zbyt wielu małych tasków. Dokumentacja mówi wprost, że nie trzeba wtedy dobierać liczby partycji do zbioru: wystarczy ustawić dostatecznie dużą liczbę początkową.',
    'W labie: <code>groupBy</code> na 12 wierszach przy 200 partycjach po shuffle\'u uruchomił bez AQE 200 tasków, z których 196 dostało puste partycje. Z AQE drugi stage miał 1 task.',
    'Sklejanie działa w jedną stronę: z wielu małych partycji robi mniej większych. Dlatego dokumentacja mówi o „dostatecznie dużej" liczbie początkowej. Za mała liczba partycji to nadal Twój problem. Osobnym mechanizmem jest dzielenie skośnych partycji w joinach, o którym jest pytanie w banku.',
    'Na Databricks zależy to od rodzaju compute. Dokumentacja AQE podaje dla <code>spark.sql.shuffle.partitions</code> wartość domyślną 200 i opcję <code>auto</code>, która dobiera liczbę na podstawie planu i rozmiaru danych. Na serverless wartością domyślną jest <code>auto</code>.'
  ],
  bridgeTitle: 'Analogia: rozmiar warehouse i spilling w Snowflake',
  bridge: {
    from: 'Snowflake',
    known: 'Gdy zapytanie nie mieści się w pamięci warehouse, dane są zrzucane na dysk lokalny, a potem do zdalnego storage. Widać to w Query Profile jako „Bytes spilled". Dokumentacja radzi większy warehouse albo przetwarzanie mniejszymi porcjami.',
    fresh: 'Ten sam objaw to „Shuffle spill" w Spark UI. Masz tu jednak dwie gałki zamiast jednej: więcej pamięci na executor albo więcej partycji, czyli mniejsza porcja danych na task.',
    breaks: 'W Snowflake nie ustawiasz liczby części, na które silnik dzieli pracę. Jedyna Twoja decyzja to rozmiar warehouse. W Sparku za mała liczba partycji potrafi wywołać zrzut na dysk nawet na dużym klastrze, bo o pamięci decyduje rozmiar jednego taska, a nie suma zasobów.'
  } as Bridge
};

/** Praktyka, część 2: repartition kontra coalesce jako decyzja. */
export const choose = {
  title: 'repartition czy coalesce?',
  intro: 'Obie operacje zmieniają liczbę partycji. Widziałeś już w symulacji, że robią to inaczej: jedna rozdaje wiersze od nowa, druga skleja całe partycje.',
  rows: [
    { k: 'Shuffle', repartition: 'tak, pełny', coalesce: 'nie' },
    { k: 'Kierunek', repartition: 'więcej albo mniej partycji', coalesce: 'tylko mniej' },
    { k: 'Liczba partycji', repartition: 'podana wprost; bez liczby bierze spark.sql.shuffle.partitions', coalesce: 'podana wprost, nie więcej niż było' },
    { k: 'Rozmiary', repartition: 'bez klucza zbliżona liczba wierszy, po kluczu zależnie od danych', coalesce: 'takie, jakie wyjdą ze sklejenia' },
    { k: 'Koszt', repartition: 'serializacja, dysk i sieć dla wszystkich wierszy', coalesce: 'bez shuffle\'u, ale wcześniejszą pracę liczy mniej tasków' },
    { k: 'Po kluczu', repartition: 'tak: jeden klucz w jednej partycji', coalesce: 'nie' },
    { k: 'Granica stage\'a', repartition: 'tak', coalesce: 'nie' }
  ],
  takeaway: '<b>Wniosek.</b> <code>repartition</code> bierzesz, gdy potrzebujesz innego układu danych: zbliżonych partycji albo podziału po kluczu. Płacisz za to pełnym shuffle\'em. <code>coalesce</code> bierzesz, gdy chcesz tylko mniej partycji i nierówne rozmiary Ci nie przeszkadzają. Zwykle jest tańszy, ale nie zawsze: po drastycznym <code>coalesce</code> wcześniejszą pracę liczy mniej tasków.',
  filesNote: 'Liczba partycji przy zapisie wpływa na liczbę plików, ale jej nie wyznacza. Zależy ona też od sposobu zapisu, np. od <code>partitionBy</code>, więc „<code>coalesce(1)</code> to jeden plik" jest prawdą tylko w najprostszym przypadku.',
  hintsTitle: 'To samo w SQL: hinty',
  hints: [
    'W Spark SQL te same operacje zapisuje się hintami w zapytaniu: <code>/*+ COALESCE(3) */</code>, <code>/*+ REPARTITION(3) */</code>, <code>/*+ REPARTITION_BY_RANGE(c) */</code> i <code>/*+ REBALANCE */</code>. Dokumentacja opisuje je jako sposób na strojenie wydajności i ograniczenie liczby plików wyjściowych.',
    'W Snowflake tej decyzji nie podejmujesz: podziałem pracy w trakcie zapytania zarządza usługa, a Ty wybierasz rozmiar warehouse.'
  ]
};

export interface Experiment {
  ask: string;
  setup: string;
  choices: string[];
  correct: number;
  mono: boolean;
  output: string;
  notes: string[];
  scope: string;
  more?: { title: string; html: string[] };
}

/** Praktyka, część 3: eksperymenty z labu. Wydruki są przepisane z uruchomienia shuffle_lab.py. */
export const experiments: Experiment[] = [
  {
    ask: '<code>filter("amount >= 60")</code> na 3 partycjach. Ile wierszy zmieni partycję?',
    setup: `12 zamówień w 3 partycjach, po 4 wiersze. ${ENV}.`,
    choices: ['0', '8', '12'],
    correct: 0,
    mono: true,
    output: "2. filter(amount >= 60)\n   partycja 0: wierszy 3  [1, 2, 4]\n   partycja 1: wierszy 3  [5, 6, 7]\n   partycja 2: wierszy 2  [9, 10]\n   wiersze, które zmieniły partycję: 0\n   stage'y: 1\n   stage 4: tasków 3, zapis do shuffle'u: 0 rekordów / 0 B, odczyt z shuffle'u: 0 rekordów\n   Exchange w planie: brak Exchange",
    notes: [
      'Osiem wierszy przeszło filtr i każdy został tam, gdzie był. Jeden stage, trzy taski, zero rekordów w shuffle\'u, brak <code>Exchange</code> w planie.',
      'Partycje nie są już równe: 3, 3 i 2 wiersze. Filtr nie przenosi danych, więc też ich nie wyrównuje. Po mocnym filtrze na dużym zbiorze zostaje wiele prawie pustych partycji i wtedy przydaje się <code>coalesce</code>.'
    ],
    scope: 'Numery stage\'y (tu 4) zależą od tego, co uruchomiono wcześniej w tej samej sesji. Liczą się liczba stage\'y i liczniki shuffle\'u.'
  },
  {
    ask: '<code>groupBy("country").sum("amount")</code> na 12 wierszach. Ile rekordów trafi do shuffle\'u?',
    setup: `Te same dane: 4 kraje, a PL występuje we wszystkich trzech partycjach. <code>spark.sql.shuffle.partitions</code> ustawione na 4. ${ENV}.`,
    choices: ['12', '10', '4'],
    correct: 1,
    mono: true,
    output: "3. groupBy(country).sum(amount), spark.sql.shuffle.partitions = 4\n   …\n   stage'y: 2\n   stage 5: tasków 3, zapis do shuffle'u: 10 rekordów / 710 B, odczyt z shuffle'u: 0 rekordów\n   stage 6: tasków 4, zapis do shuffle'u: 0 rekordów / 0 B, odczyt z shuffle'u: 10 rekordów\n   różnych par (partycja wejścia, kraj): 10  <- tyle sum częściowych, a nie 12 wierszy\n   wynik po shuffle'u (partycja -> kraje):\n     partycja 0: [('FR', 270)]\n     partycja 1: [('IT', 170)]\n     partycja 2: [('PL', 330)]\n     partycja 3: [('DE', 250)]",
    notes: [
      'Dziesięć, czyli tyle, ile jest różnych par „partycja wejścia, kraj". Każdy task najpierw zsumował swoje wiersze dla każdego kraju i wysłał sumy częściowe.',
      'Dwa stage\'e: pierwszy z 3 taskami zapisuje, drugi z 4 taskami czyta. Liczba tasków w drugim stage\'u to liczba partycji po shuffle\'u, a nie liczba partycji wejścia.',
      'Po shuffle\'u każdy kraj leży w jednej partycji. Przy 4 krajach i 4 partycjach każdy dostał własną, ale to przypadek tych danych: hash nie obiecuje, że dwa klucze nie trafią do tej samej partycji.'
    ],
    scope: 'Liczba 10 wynika z tych danych i z tego, że sumę da się liczyć częściowo. Liczba bajtów zależy od wersji i formatu zapisu.',
    more: {
      title: 'A gdyby to był join albo sortowanie',
      html: [
        'Join przez shuffle nie ma czego agregować z góry, więc przesyła wiersze. W labie <code>spark_checks.py</code> sort-merge join zapisał do shuffle\'u wszystkie 100 000 wierszy dużej strony, a <code>groupBy</code> na tych samych danych 150 rekordów.',
        '<code>orderBy</code> też wymaga shuffle\'u, ale dzieli zakresami wartości, a nie hashem: żeby wynik był posortowany globalnie, pierwsza partycja musi mieć najmniejsze wartości.'
      ]
    }
  },
  {
    ask: '<code>repartition(4, "country")</code>. Ile wierszy będzie miała największa partycja?',
    setup: `Te same 12 wierszy: PL ma 5 zamówień, DE 3, FR 2, IT 2. W tym labie hash wysyła każdy z czterech krajów do innej partycji (FR → 0, IT → 1, PL → 2, DE → 3). ${ENV}.`,
    choices: ['3', '5', '12'],
    correct: 1,
    mono: true,
    output: "4. repartition(4, country): podział hashem klucza\n   partycja 0: wierszy 2  [4, 9]\n   partycja 1: wierszy 2  [7, 12]\n   partycja 2: wierszy 5  [1, 3, 6, 8, 11]\n   partycja 3: wierszy 3  [2, 5, 10]\n   DE: partycja 3, pmod(hash(country), 4) = 3\n   FR: partycja 0, pmod(hash(country), 4) = 0\n   IT: partycja 1, pmod(hash(country), 4) = 1\n   PL: partycja 2, pmod(hash(country), 4) = 2\n   plan: Exchange hashpartitioning(country#1, 4), REPARTITION_BY_NUM, [plan_id=227]\n   …\n   liczba partycji przy spark.sql.shuffle.partitions = 7: repartition(4, country) -> 4, repartition(country) bez liczby -> 7\n   repartition(4): bez klucza\n   partycja 0: wierszy 3  [1, 8, 11]\n   partycja 1: wierszy 3  [3, 7, 10]\n   partycja 2: wierszy 3  [2, 5, 9]\n   partycja 3: wierszy 3  [4, 6, 12]\n   plan: Exchange RoundRobinPartitioning(4), REPARTITION_BY_NUM, [plan_id=367]\n   w ilu partycjach leży kraj: {'DE': 2, 'FR': 2, 'IT': 2, 'PL': 3}",
    notes: [
      'Pięć: wszystkie zamówienia z PL trafiły do jednej partycji, bo mają ten sam klucz. Podział hashem trzyma klucz razem i właśnie dlatego nie wyrównuje rozmiarów. Pięć to tutaj minimum: gdyby hash wysłał dwa kraje do tej samej partycji, największa byłaby jeszcze większa.',
      'Bez klucza wyszło po 3 wiersze w każdej partycji, ale PL leży w trzech z nich. W planie widać różnicę w jednym słowie: <code>hashpartitioning</code> kontra <code>RoundRobinPartitioning</code>.',
      'Linia o liczbie partycji: liczba podana wprost wygrywa. <code>repartition("country")</code> bez liczby wziął wartość <code>spark.sql.shuffle.partitions</code>, czyli tutaj 7.',
      'Gdy jeden klucz ma większość wierszy, jego partycja jest wielokrotnie większa od pozostałych. To data skew, osobny temat w banku pytań.'
    ],
    scope: 'Numer partycji danego kraju zależy od funkcji hash i od liczby partycji. Przy innej liczbie partycji te same kraje trafią gdzie indziej.'
  },
  {
    ask: '<code>filter(...).coalesce(1)</code>. Ile tasków policzy sam filtr?',
    setup: `3 partycje wejścia. Porównujemy <code>coalesce(1)</code> z <code>repartition(1)</code> po tym samym filtrze. ${ENV}.`,
    choices: ['3', '1'],
    correct: 1,
    mono: true,
    output: "   …\n   coalesce(6) na 3 partycjach daje partycji: 3\n   repartition(6) na 3 partycjach daje partycji: 6\n   filter + coalesce(1) kontra filter + repartition(1): ile tasków liczy filter\n   coalesce(1):    stage'y 1, taski w kolejnych stage'ach [1]\n   repartition(1): stage'y 2, taski w kolejnych stage'ach [3, 1]",
    notes: [
      'Jeden. <code>coalesce</code> nie tworzy granicy stage\'a, więc filtr i sklejanie lądują w tym samym stage\'u, a ten ma tyle tasków, ile partycji wyniku: jedną. Cała praca sprzed <code>coalesce(1)</code> idzie jednym taskiem.',
      '<code>repartition(1)</code> dodaje shuffle. Filtr liczą 3 taski równolegle, a dopiero wynik trafia do jednej partycji.',
      'Pierwsze dwie linie wydruku: <code>coalesce</code> nie zwiększa liczby partycji. Poproszony o 6 zostawił 3. <code>repartition(6)</code> dał 6.'
    ],
    scope: 'Dokumentacja opisuje to samo: drastyczne <code>coalesce</code> może przenieść obliczenia na mniej węzłów, niż byś chciał, a <code>repartition</code> dodaje shuffle, ale zostawia wcześniejsze partycje liczone równolegle.'
  },
  {
    ask: 'Ten sam <code>groupBy</code> na 12 wierszach, tym razem z domyślnym <code>spark.sql.shuffle.partitions</code>. Ile tasków ma drugi stage bez AQE?',
    setup: 'Te same dane, wartość domyślna Apache Spark: 200 partycji po shuffle\'u. PySpark 4.0.1, <term id="local-mode">local[3]</term>, najpierw z AQE wyłączonym, potem włączonym.',
    choices: ['4', '200', '3'],
    correct: 1,
    mono: true,
    output: "6. Ten sam groupBy, spark.sql.shuffle.partitions = 200 (wartość domyślna)\n   AQE wyłączone: taski w kolejnych stage'ach [3, 200]\n   niepustych partycji po shuffle'u: 4 z 200\n   AQE włączone:  taski w kolejnych stage'ach [3, 1]\n   spark.sql.adaptive.coalescePartitions.enabled = true",
    notes: [
      'Dwieście tasków dla czterech krajów. 196 z nich dostało puste partycje, ale każdy trzeba było zaplanować i uruchomić. To jest „za dużo partycji" w czystej postaci.',
      'Z AQE Spark po zapisaniu shuffle\'u zobaczył, że danych jest garstka, i skleił wszystko w jedną partycję: drugi stage miał 1 task.',
      'Ustawienie domyślne nie wie nic o Twoich danych. Dla 12 wierszy 200 to o wiele za dużo, a dla 2 TB może być za mało.'
    ],
    scope: 'Wynik „1 task" dotyczy tych danych i ustawień domyślnych. Sklejanie zależy od faktycznych rozmiarów partycji i od konfiguracji AQE.'
  }
];

/** Etap Interview: to, czego bank nie ma. Jak uczciwie powiedzieć, że przychodzisz ze świata hurtowni. */
export const interview = {
  bridgeIntro: 'Jeśli znasz hurtownie, a klastra Sparka nie stroiłeś, powiedz to wprost i pokaż, że masz model. Na przykład tak:',
  bridgeEn: '“In a warehouse I never see this step. I write GROUP BY and the engine brings matching rows together somewhere inside. Spark shows me that step as an Exchange in the plan, and it makes me responsible for it: how many shuffles the query has, how much data goes through each one, and how many partitions come out. So when I read a Spark plan, the first thing I look for is the Exchange nodes.”',
  bridgePl: 'Po polsku: w hurtowni nigdy nie widzę tego kroku. Piszę GROUP BY, a silnik gdzieś w środku doprowadza do siebie pasujące wiersze. Spark pokazuje mi ten krok jako Exchange w planie i robi mnie za niego odpowiedzialnym: ile shuffle\'i ma zapytanie, ile danych przez każdy przechodzi i ile partycji z niego wychodzi. Dlatego w planie Sparka najpierw szukam węzłów Exchange.'
};

export interface QuizItem { q: string; setup?: string; options: string[]; correct: number; why: string }
/** Etap Sprawdź się: sześć pytań. Każde podaje założenia, jeśli wynik od nich zależy. */
export const quiz: QuizItem[] = [
  {
    q: 'Która z tych operacji da się policzyć bez przenoszenia rekordów między partycjami?',
    options: ['<code>orderBy("amount")</code>', '<code>filter("amount >= 60")</code>', '<code>groupBy("country").count()</code>'],
    correct: 1,
    why: 'Filtr ocenia każdy wiersz osobno, więc partycja wyniku powstaje z jednej partycji wejścia: zależność narrow. Sortowanie i grupowanie potrzebują danych z wielu partycji wejścia, więc zwykle wymagają shuffle\'u.'
  },
  {
    q: 'Plan ma dwa węzły <code>Exchange hashpartitioning</code> i żadnego innego Exchange. Ile granic stage\'ów wyznacza?',
    setup: 'Założenia: Apache Spark, jeden plan fizyczny wykonany w całości, AQE wyłączone, bez ponownego użycia wcześniejszych wyników.',
    options: ['Jedną', 'Dwie', 'Nie da się powiedzieć bez liczby partycji'],
    correct: 1,
    why: 'W takim planie każdy shuffle to granica: taski przed nim zapisują dane, taski za nim je czytają. Dwa shuffle\'e dają dwie granice, czyli trzy grupy tasków. Liczba partycji zmienia liczbę tasków, a nie liczbę granic. Poza tymi założeniami interfejs może pokazać inną liczbę stage\'y i jobów.'
  },
  {
    q: '<code>repartition(8, "customer_id")</code>, a jeden klient ma 70% wszystkich wierszy. Jak będą wyglądać partycje?',
    options: ['Osiem równych partycji', 'Jedna partycja z co najmniej 70% wierszy, reszta dużo mniejsza', 'Wiersze tego klienta rozłożone równo na 8 partycji'],
    correct: 1,
    why: 'Hash wysyła ten sam klucz zawsze do tej samej partycji, więc wszystkie wiersze tego klienta trafią razem. Zbliżone liczby wierszy daje <code>repartition(8)</code> bez klucza, ale wtedy wiersze klienta są rozrzucone po partycjach.'
  },
  {
    q: 'Na końcu joba chcesz zapisać wynik w jednym pliku i dodajesz <code>coalesce(1)</code>. Job zwalnia kilkukrotnie. Co jest najbardziej prawdopodobną przyczyną?',
    setup: 'Założenia: przed <code>coalesce(1)</code> jest kosztowna transformacja narrow i nie ma shuffle\'u.',
    options: ['coalesce(1) dodał pełny shuffle', 'Cała praca sprzed coalesce(1) trafiła do jednego taska', 'Spark zapisuje jeden plik wolniej niż wiele'],
    correct: 1,
    why: '<code>coalesce</code> nie tworzy granicy stage\'a, więc wcześniejsze kroki liczą się w tym samym stage\'u, a ten ma jeden task. <code>repartition(1)</code> dodałby shuffle, ale zostawił wcześniejszą pracę równoległą. W labie: 1 task kontra 3 i 1.'
  },
  {
    q: 'Stage po shuffle\'u ma 200 tasków. Większość trwa kilka milisekund i czyta zero rekordów. Co z tego wynika?',
    setup: 'Założenia: Apache Spark, AQE wyłączone, <code>spark.sql.shuffle.partitions</code> bez zmian.',
    options: ['Partycji jest więcej, niż potrzeba dla tej ilości danych', 'Dane na pewno nie są skośne', 'Brakuje executorów'],
    correct: 0,
    why: 'Puste taski to partycje, do których hash niczego nie wysłał: 200 to wartość domyślna, niezależna od rozmiaru danych. Pomaga AQE, które skleja małe partycje, albo mniejsza liczba partycji. O skew puste taski nie mówią nic: puste i przeładowane partycje mogą wystąpić razem. Skew ocenia się po rozkładzie rozmiarów niepustych partycji.'
  },
  {
    q: 'Klaster ma 16 rdzeni, a po shuffle\'u jest 400 partycji. Ile tasków tego stage\'a działa jednocześnie?',
    setup: 'Założenia: jeden rdzeń liczy jeden task naraz, wszystkie rdzenie są wolne.',
    options: ['400', '16', '25'],
    correct: 1,
    why: 'Szesnaście. Partycji jest 400, więc tasków też 400, ale naraz liczy się najwyżej tyle, ile jest wolnych rdzeni. Pozostałe czekają w kolejce: przy równych taskach to 25 tur. Liczba partycji ustala rozmiar i liczbę tasków, a liczba rdzeni równoległość.'
  }
];

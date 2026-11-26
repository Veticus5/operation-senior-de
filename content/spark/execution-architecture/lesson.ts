import type { Bridge, ExplainedLine, LessonMeta } from '../../types';

/**
 * Lekcja 02: Spark Execution Architecture. Odpowiada na pytanie, co dzieje się między wywołaniem akcji
 * a pierwszym taskiem: SparkSession i SparkContext, cztery plany zapytania, DAG, joby, stage'e i taski,
 * kolejność wykonania i ponawianie po awarii.
 *
 * Buduje na lekcji 00 (driver, executory, partycje, taski a rdzenie) i lekcji 01 (transformacje, akcje,
 * plan po optymalizacji). Tych rzeczy nie tłumaczy od nowa.
 *
 * Skąd są fakty:
 *  - liczby jobów, stage'y, tasków i rekordów w shuffle'u, wydruki planów oraz wynik awarii taska:
 *    labs/execution_architecture/execution_lab.py (PySpark 4.0.1 i 4.3.0, local[3]),
 *  - definicje i wartości domyślne: dokumentacja Apache Spark 4.3.0 oraz komentarz klasy DAGScheduler
 *    w kodzie Sparka 4.0.1, spisane w docs/verified-facts.md (sekcja „Lekcja 02").
 * Przebieg „krok po kroku" w symulatorze to animacja, a nie Spark. Struktura, którą pokazuje, pochodzi z labu.
 * Pytania rekrutacyjne, krótkie odpowiedzi i follow-upy nie są tu powtórzone: lekcja bierze je
 * z Interview Banku (pytania o tym samym topicId).
 */
export const meta: LessonMeta = {
  id: 'spark-execution-architecture',
  topicId: 'spark.execution-model',
  area: 'spark',
  title: 'Spark Execution Architecture: From Query to Tasks',
  subtitle: `Jak kilka linijek kodu zamienia się w plany, joby, stage'e i taski, i jak to potem odczytać w Spark UI.`,
  minutes: 28
};

/** Lab uruchamiany z etapu Praktyka. Identyfikator z labs/registry.json. */
export const labId = 'spark-execution-architecture-lab';
export const labHint = 'Najpierw przewidź. Wydruk tego skryptu zawiera odpowiedzi do eksperymentów poniżej, więc zgadnij je, zanim klikniesz, a potem porównaj.';

/* ------------------------------------------------------------------ Intuicja */

/** Ilustracja z pierwszego kroku: te same cztery linijki, dwa zestawy liczb z labu. */
export const chain = {
  badge: 'Rzeczywiste wykonanie · PySpark 4.0.1 · local[3]',
  assumptions: `Liczby z labu tej lekcji: <code>orders</code> ma 1200 wierszy w 4 partycjach, <code>customers</code> 40 wierszy w 2. To dane testowe, więc liczy się mechanizm, a nie skala.`,
  levels: ['akcje', 'joby', `stage'e`, 'taski'],
  rows: [
    { label: 'AQE i broadcast join wyłączone', values: [1, 1, 4, 406] },
    { label: 'Ustawienia domyślne Apache Spark', values: [1, 3, 3, 7] }
  ]
};

export interface Beat {
  html: string;
  visual?: 'chain' | 'session';
  /** Krótki wniosek pod ilustracją. */
  after?: string;
  next: string;
  bridge?: Bridge;
  /** Zwinięte pogłębienie, poza domyślną ścieżką. */
  more?: { title: string; html: string[] };
}

export const beats: Beat[] = [
  {
    html: `<h1>Cztery linijki, 406 tasków.</h1>
<p class="lede">Wiesz już, kto pracuje: driver planuje, executory liczą partycje. Wiesz też, że nic nie rusza przed akcją. Brakuje środka: co dzieje się między wywołaniem akcji a pierwszym taskiem?</p>
<p>Liczysz przychód per region z dwóch tabel:</p>
<pre class="code">paid    = orders.filter(orders.status == <span class="k">"paid"</span>)
joined  = paid.join(customers, <span class="k">"customer_id"</span>)
revenue = joined.groupBy(<span class="k">"region"</span>).sum(<span class="k">"amount"</span>)
revenue.write.parquet(<span class="k">"revenue_by_region/"</span>)</pre>
<p>Uruchamiasz to i otwierasz <term id="spark-ui">Spark UI</term>. Zamiast jednego „zapytania” widzisz trzy poziomy liczb, których nigdzie nie wpisałeś. A po zmianie dwóch ustawień te same cztery linijki dają zupełnie inne liczby.</p>`,
    visual: 'chain',
    after: `<b>Wniosek.</b> Te liczby nie są cechą Twojego kodu. Są wynikiem tego, jak Spark go zaplanował. Żeby je czytać, a potem diagnozować wolne zapytania, trzeba wiedzieć, skąd bierze się każdy poziom: job, stage i task.`,
    next: 'Od czego zaczyna Spark?'
  },
  {
    html: `<h2>Wszystko wchodzi przez <code>spark</code></h2>
<p>W każdym dotychczasowym przykładzie pisałeś <code>spark.read</code> albo <code>spark.sql</code> i nie pytałeś, czym jest <code>spark</code>. To <b>SparkSession</b>: obiekt, przez który Twój kod rozmawia z silnikiem. Przez niego tworzysz DataFrame'y, wysyłasz SQL i ustawiasz konfigurację zapytań.</p>
<p>Pod sesją jest drugi, starszy obiekt: <b>SparkContext</b>. On reprezentuje połączenie z klastrem. To przez niego driver dostaje executory i wysyła im taski. Kliknij kolejne linie.</p>`,
    visual: 'session',
    after: `<b>Wniosek.</b> SparkSession to Twoje wejście do DataFrame'ów i SQL. SparkContext to połączenie aplikacji z klastrem. Kontekst jest jeden na aplikację, a sesji może być kilka i wszystkie go współdzielą.`,
    more: {
      title: 'Skąd dwa obiekty i gdzie SparkContext nie istnieje',
      html: [
        `W Sparku 1.x wejściem do danych tabelarycznych był osobny obiekt <code>SQLContext</code>. Dokumentacja PySparka mówi, że od wersji 2.0 zastępuje go <code>SparkSession</code>, a stara klasa została dla zgodności wstecznej. SparkContext nie zniknął: w klasycznym trybie nadal istnieje pod każdą sesją.`,
        `W <term id="spark-connect">Spark Connect</term> jest inaczej. Twój program jest klientem, który wysyła plan do serwera, i nie ma dostępu do SparkContext. Dokumentacja wymienia SparkContext i <term id="rdd">RDD</term> jako nieobsługiwane w tym trybie. Tak działa m.in. serverless w Databricks, więc kod, który woła <code>spark.sparkContext</code>, tam nie zadziała.`,
        `Gdzie działa driver, zależy od trybu uruchomienia. W trybie <code>client</code> driver startuje w procesie, który wysłał aplikację, poza klastrem. W trybie <code>cluster</code> jest uruchamiany wewnątrz klastra.`
      ]
    },
    next: 'Gdzie ja to już widziałem?'
  },
  {
    html: `<h2>W Snowflake też to widać, tylko płycej</h2>
<p>Po zapytaniu w Snowflake możesz otworzyć Query Profile: drzewo operatorów z czasem i liczbą wierszy na każdym kroku. To plan wykonania pokazany po fakcie.</p>
<p>Spark pokazuje podobne drzewo i dokłada poziomy, które hurtownia zostawia dla siebie: na jakie porcje pracy podzielił zapytanie i jak poszła każda z nich.</p>`,
    bridge: {
      from: 'Snowflake',
      known: 'Query Profile: jedno zapytanie i jedno drzewo operatorów (skan, filtr, join, agregacja) ze statystykami każdego kroku.',
      fresh: `Zakładka SQL w Spark UI pokazuje plan zapytania. Zakładki Jobs i Stages mówią, jak ten plan został pocięty na joby, stage'e i taski.`,
      breaks: `W Snowflake jednostką jest zapytanie, a podział pracy między maszyny jest sprawą usługi. W Sparku jedna akcja może dać kilka jobów, każdy stage ma własną liczbę tasków, a pojedynczy task może paść i zostać powtórzony. Te poziomy czytasz Ty, kiedy coś jest wolne.`
    },
    next: 'Rozłóż zapytanie na części'
  }
];

/** Etap Intuicja, krok 2: cztery linijki o sesji i kontekście. Wyniki z labu, sekcja 1. */
export const session = {
  title: 'SparkSession i SparkContext w czterech linijkach',
  lines: [
    {
      code: 'spark = SparkSession.builder.appName("revenue").getOrCreate()',
      label: 'Otwórz sesję',
      text: `Tworzy sesję albo zwraca już istniejącą. W labie drugie wywołanie <code>getOrCreate()</code> oddało ten sam obiekt. Przy pierwszym powstaje też SparkContext, czyli połączenie z klastrem.`
    },
    {
      code: 'sc = spark.sparkContext',
      label: 'Połączenie z klastrem',
      text: `Kontekst, na którym stoi sesja. Służy do rzeczy niskopoziomowych: starszego API <term id="rdd">RDD</term>, zmiennych broadcast i <term id="accumulator">akumulatorów</term>. W zwykłej pracy na DataFrame'ach rzadko po niego sięgasz.`
    },
    {
      code: 'other = spark.newSession()',
      label: 'Druga sesja, ten sam kontekst',
      text: `Nowa sesja ma własne ustawienia SQL i własne widoki tymczasowe, ale ten sam SparkContext i ten sam cache tabel. W labie widok utworzony w pierwszej sesji nie był widoczny w drugiej, a zmiana <code>spark.sql.shuffle.partitions</code> w drugiej nie zmieniła pierwszej.`
    },
    {
      code: 'spark.stop()',
      label: 'Koniec aplikacji',
      text: `Zatrzymuje SparkContext, a z nim całą aplikację. Według dokumentacji w jednej <term id="jvm">JVM</term> powinien działać tylko jeden aktywny SparkContext: żeby utworzyć nowy, trzeba najpierw zatrzymać stary.`
    }
  ] as ExplainedLine[]
};

/* ----------------------------------------------------------------- Mechanizm */

/** Co robi stage danego rodzaju. Wspólne dla wariantu z AQE i bez. */
export interface StageRole {
  title: string;
  /** Operatory planu fizycznego wykonywane w tym stage'u, w kolejności wykonania. */
  ops: string[];
  input: string;
  output: string;
}

export interface SimStage {
  id: number;
  role: string;
  tasks: number;
  /** Dlaczego tasków jest właśnie tyle. */
  tasksWhy: string;
  /** Stage pominięty (skipped): jego pliki shuffle już istnieją. */
  skipped?: boolean;
  /** Nadpisuje `output` roli, gdy liczba rekordów różni się między wariantami. */
  output?: string;
}
export interface SimJob { why: string; stages: SimStage[] }
export interface SimStep { say: string; /** Stage'e liczone w tym kroku. */ run: number[] }
export interface Scenario { jobs: SimJob[]; steps: SimStep[] }
export interface SimQuery { id: string; label: string; code: string; note: string; off: Scenario; on: Scenario }

const TASKS_INPUT_4 = '4 taski, bo wejście ma 4 partycje: po jednym tasku na partycję.';
const TASKS_200 = `200 tasków, bo tyle wynosi <code>spark.sql.shuffle.partitions</code>. To ustawienie, a nie rozmiar danych.`;
const TASKS_AQE = `1 task. AQE zobaczyło, że 200 partycji po shuffle'u jest malutkich, i skleiło je w jedną.`;
const SKIPPED = `Pominięty (skipped): jego pliki shuffle zapisał już wcześniejszy job, więc żaden task nie rusza. Spark UI pokazuje go mimo to, z planowaną liczbą tasków.`;

export const flow = {
  question: 'Jak zapytanie staje się pracą dla executorów?',
  intro: `Trzy poziomy, każdy odpowiada na inne pytanie. <b>Job</b> to porcja pracy, którą driver wysyła do wykonania, gdy akcja zażąda wyniku. <b>Stage</b> to część joba, którą da się policzyć bez przenoszenia danych między partycjami. <b>Task</b> już znasz: jeden stage wykonany na jednej partycji. Wybierz zapytanie, klikaj joby i stage'e, a potem przejdź wykonanie krok po kroku. Przełącznik <term id="aqe">AQE</term> zostaw na początku wyłączony: tak widać model podstawowy.`,
  assumptions: `Liczby jobów, stage'y, tasków i rekordów pochodzą z labu tej lekcji: PySpark 4.0.1, <term id="local-mode">local[3]</term>, <code>orders</code> w 4 partycjach, <code>customers</code> w 2, <code>spark.sql.shuffle.partitions</code> = 200 (wartość domyślna). W zapytaniu z joinem broadcast jest wyłączony. Przebieg krok po kroku to animacja z 3 rdzeniami.`,
  cores: 3,
  defaultQuery: 'b',
  modes: { off: 'AQE wyłączone', on: 'AQE włączone (domyślnie)' },
  roles: {
    'a-all': {
      title: 'Odczyt, filtr, zapis',
      ops: ['FileScan parquet', 'Filter', 'zapis plików'],
      input: '4 partycje wejścia, czyli 4 pliki Parquet',
      output: 'Pliki wynikowe. Każdy task zapisuje swoją część, a driver dostaje tylko potwierdzenia.'
    },
    'b-map': {
      title: 'Odczyt, filtr, agregacja częściowa',
      ops: ['FileScan parquet', 'Filter', 'HashAggregate (partial_sum)', `zapis do shuffle'u`],
      input: '4 partycje wejścia, czyli 4 pliki Parquet',
      output: `20 rekordów do shuffle'u: 5 dat × 4 partycje. Każdy task sumuje u siebie i wysyła sumy częściowe, a nie pojedyncze wiersze.`
    },
    'b-final': {
      title: 'Agregacja końcowa, zapis',
      ops: [`odczyt shuffle'u`, 'HashAggregate (sum)', 'zapis plików'],
      input: `Partycje po shuffle'u: sumy częściowe dla tej samej daty są w tej samej partycji. Razem 20 rekordów.`,
      output: 'Pliki wynikowe: 5 wierszy, po jednym na datę.'
    },
    'c-customers': {
      title: 'Odczyt klientów',
      ops: ['FileScan parquet (customers)', 'Filter (isnotnull)', `zapis do shuffle'u`],
      input: '2 partycje wejścia',
      output: `40 rekordów do shuffle'u: każdy klient, podzielony po <code>customer_id</code>.`
    },
    'c-orders': {
      title: 'Odczyt zamówień, filtr',
      ops: ['FileScan parquet (orders)', 'Filter', `zapis do shuffle'u`],
      input: '4 partycje wejścia',
      output: `800 rekordów do shuffle'u: każde opłacone zamówienie, podzielone po <code>customer_id</code>.`
    },
    'c-join': {
      title: 'Join, agregacja częściowa',
      ops: [`odczyt dwóch shuffle'i`, 'Sort', 'SortMergeJoin', 'HashAggregate (partial_sum)', `zapis do shuffle'u`],
      input: `Partycje po shuffle'u: ten sam <code>customer_id</code> z obu tabel trafia do partycji o tym samym numerze. Razem 840 rekordów.`,
      output: `40 rekordów do drugiego shuffle'u, tym razem po <code>region</code>.`
    },
    'c-final': {
      title: 'Agregacja końcowa, zapis',
      ops: [`odczyt shuffle'u`, 'HashAggregate (sum)', 'zapis plików'],
      input: `Partycje po drugim shuffle'u: sumy częściowe dla tego samego regionu są razem.`,
      output: 'Pliki wynikowe: 4 wiersze, po jednym na region.'
    }
  } as Record<string, StageRole>,
  queries: [
    {
      id: 'a',
      label: 'filter',
      code: `paid = orders.filter(orders.status == "paid")
paid.write.parquet("paid_orders/")`,
      note: 'Filtr liczy każdą partycję osobno. Nic nie trzeba przenosić.',
      off: {
        jobs: [{ why: 'Akcja <code>write</code> zażądała wyniku, więc driver utworzył job.', stages: [{ id: 0, role: 'a-all', tasks: 4, tasksWhy: TASKS_INPUT_4 }] }],
        steps: [
          { say: `Akcja <code>write</code>: driver zamienia plan na job 0. W planie nie ma shuffle'u, więc job ma jeden stage.`, run: [] },
          { say: 'Stage 0: 4 taski, po jednym na partycję. Rdzenie są 3, więc 3 taski liczą się od razu, a czwarty czeka na wolny rdzeń.', run: [0] },
          { say: 'Job 0 gotowy: 1 stage, 4 taski. Każdy task zapisał swoją część wyniku.', run: [] }
        ]
      },
      on: {
        jobs: [{ why: `Akcja <code>write</code> zażądała wyniku. AQE niczego tu nie zmienia: w planie nie ma shuffle'u, więc nie ma czego poprawiać w trakcie.`, stages: [{ id: 0, role: 'a-all', tasks: 4, tasksWhy: TASKS_INPUT_4 }] }],
        steps: [
          { say: `Akcja <code>write</code>: jeden job, jeden stage. AQE poprawia plan po shuffle'u, a tutaj shuffle'u nie ma.`, run: [] },
          { say: 'Stage 0: 4 taski, po jednym na partycję. Naraz liczą się 3.', run: [0] },
          { say: 'Job 0 gotowy: 1 stage, 4 taski. Dokładnie tak samo jak bez AQE.', run: [] }
        ]
      }
    },
    {
      id: 'b',
      label: 'filter + groupBy',
      code: `paid  = orders.filter(orders.status == "paid")
daily = paid.groupBy("order_date").sum("amount")
daily.write.parquet("daily_revenue/")`,
      note: 'Suma per data wymaga, żeby wiersze z tą samą datą spotkały się w jednej partycji.',
      off: {
        jobs: [{
          why: `Akcja <code>write</code> zażądała wyniku, więc driver utworzył job. W planie jest jeden shuffle, więc job ma 2 stage'e.`,
          stages: [
            { id: 0, role: 'b-map', tasks: 4, tasksWhy: TASKS_INPUT_4 },
            { id: 1, role: 'b-final', tasks: 200, tasksWhy: `${TASKS_200} Dat jest 5, więc co najmniej 195 tasków dostaje pustą partycję.` }
          ]
        }],
        steps: [
          { say: `Akcja <code>write</code>: driver tworzy job 0. W planie jest jeden shuffle, więc driver tnie job w tym miejscu na 2 stage'e.`, run: [] },
          { say: 'Stage 0: 4 taski czytają pliki, filtrują i sumują u siebie. Wyniki zapisują jako pliki shuffle. Stage 1 czeka, bo nie ma jeszcze czego czytać.', run: [0] },
          { say: `Stage 0 gotowy, więc rusza stage 1: 200 tasków, po jednym na partycję po shuffle'u. Naraz liczą się 3, reszta czeka w kolejce.`, run: [1] },
          { say: `Job 0 gotowy: 2 stage'e, 204 taski. Pliki wynikowe zapisał ostatni stage.`, run: [] }
        ]
      },
      on: {
        jobs: [
          { why: `AQE nie wysyła całego planu naraz. Najpierw uruchamia część przed shuffle'em, jako osobny job, żeby poznać prawdziwe rozmiary partycji.`, stages: [{ id: 0, role: 'b-map', tasks: 4, tasksWhy: TASKS_INPUT_4 }] },
          {
            why: `Reszta planu, zaplanowana dopiero po zakończeniu joba 0. To nadal ta sama akcja <code>write</code>.`,
            stages: [
              { id: 1, role: 'b-map', tasks: 4, tasksWhy: SKIPPED, skipped: true },
              { id: 2, role: 'b-final', tasks: 1, tasksWhy: TASKS_AQE }
            ]
          }
        ],
        steps: [
          { say: `Akcja <code>write</code>, ale AQE nie wysyła całego planu naraz. Najpierw uruchamia tylko część przed shuffle'em, jako job 0.`, run: [] },
          { say: 'Job 0, stage 0: 4 taski czytają, filtrują, sumują częściowo i zapisują pliki shuffle. Tak samo jak bez AQE.', run: [0] },
          { say: `Job 0 gotowy. Spark zna teraz prawdziwe rozmiary 200 partycji po shuffle'u: są malutkie. AQE skleja je w jedną i dopiero teraz planuje resztę jako job 1.`, run: [] },
          { say: 'Job 1: stage 1 jest pominięty, bo jego pliki shuffle już istnieją. Stage 2 liczy agregację końcową jednym taskiem zamiast 200.', run: [2] },
          { say: `Gotowe: jedna akcja, 2 joby, 2 wykonane stage'e, 5 tasków zamiast 204. Wynik jest ten sam.`, run: [] }
        ]
      }
    },
    {
      id: 'c',
      label: 'filter + join + groupBy',
      code: `paid    = orders.filter(orders.status == "paid")
joined  = paid.join(customers, "customer_id")
revenue = joined.groupBy("region").sum("amount")
revenue.write.parquet("revenue_by_region/")`,
      note: 'Join potrzebuje obu tabel ułożonych po customer_id, a suma per region kolejnego przegrupowania.',
      off: {
        jobs: [{
          why: `Akcja <code>write</code> zażądała wyniku, więc driver utworzył job. W planie są trzy shuffle'e: po jednym dla każdej strony joina i jeden przed sumą po regionie. Stąd 4 stage'e.`,
          stages: [
            { id: 0, role: 'c-customers', tasks: 2, tasksWhy: '2 taski, bo tabela klientów ma 2 partycje wejścia.' },
            { id: 1, role: 'c-orders', tasks: 4, tasksWhy: TASKS_INPUT_4 },
            { id: 2, role: 'c-join', tasks: 200, tasksWhy: TASKS_200 },
            { id: 3, role: 'c-final', tasks: 200, tasksWhy: `${TASKS_200} Regiony są 4, więc co najmniej 196 tasków dostaje pustą partycję.` }
          ]
        }],
        steps: [
          { say: `Akcja <code>write</code>: driver tworzy job 0. W planie są trzy shuffle'e, więc wychodzą 4 stage'e.`, run: [] },
          { say: 'Stage 0 i stage 1 nie zależą od siebie: jeden czyta klientów, drugi zamówienia. Ruszają jednocześnie i dzielą się 3 rdzeniami. Razem mają 6 tasków.', run: [0, 1] },
          { say: 'Oba gotowe, więc rusza stage 2: join. 200 tasków, a każdy łączy jedną partycję klientów z partycją zamówień o tym samym numerze i sumuje częściowo po regionie.', run: [2] },
          { say: 'Stage 3: suma końcowa po regionie i zapis. Znowu 200 tasków, bo to kolejny shuffle.', run: [3] },
          { say: `Job 0 gotowy: 4 stage'e, 406 tasków. Kolejność wyznaczyły zależności między stage'ami, a nie kolejność linijek w kodzie.`, run: [] }
        ]
      },
      on: {
        jobs: [
          { why: `AQE wysyła każdą część planu przed shuffle'em jako osobny job. Ten czyta klientów.`, stages: [{ id: 0, role: 'c-customers', tasks: 2, tasksWhy: '2 taski, bo tabela klientów ma 2 partycje wejścia.' }] },
          { why: `Druga część przed shuffle'em: zamówienia.`, stages: [{ id: 1, role: 'c-orders', tasks: 4, tasksWhy: TASKS_INPUT_4 }] },
          {
            why: 'Join, zaplanowany po tym, jak Spark poznał rozmiary obu stron.',
            stages: [
              { id: 2, role: 'c-orders', tasks: 4, tasksWhy: SKIPPED, skipped: true },
              { id: 3, role: 'c-customers', tasks: 2, tasksWhy: SKIPPED, skipped: true },
              { id: 4, role: 'c-join', tasks: 1, tasksWhy: TASKS_AQE, output: `4 rekordy do drugiego shuffle'u: po jednym na region, bo jeden task widzi wszystkie dane.` }
            ]
          },
          {
            why: 'Suma końcowa i zapis. Ostatni job tej samej akcji.',
            stages: [
              { id: 5, role: 'c-orders', tasks: 4, tasksWhy: SKIPPED, skipped: true },
              { id: 6, role: 'c-customers', tasks: 2, tasksWhy: SKIPPED, skipped: true },
              { id: 7, role: 'c-join', tasks: 1, tasksWhy: SKIPPED, skipped: true },
              { id: 8, role: 'c-final', tasks: 1, tasksWhy: TASKS_AQE }
            ]
          }
        ],
        steps: [
          { say: `Akcja <code>write</code> z AQE: każda część planu przed shuffle'em idzie jako osobny job.`, run: [] },
          { say: 'Job 0 czyta klientów (2 taski), job 1 zamówienia (4 taski). Oba zapisują pliki shuffle.', run: [0, 1] },
          { say: `Job 2: stage'e odczytu są pominięte, bo ich pliki shuffle istnieją. AQE skleiło partycje, więc join liczy 1 task zamiast 200.`, run: [4] },
          { say: `Job 3: trzy wcześniejsze stage'e pominięte, suma końcowa i zapis w 1 tasku.`, run: [8] },
          { say: `Gotowe: jedna akcja, 4 joby, 4 wykonane stage'e, 8 tasków zamiast 406. Praca jest ta sama, zmienił się jej podział.`, run: [] }
        ]
      }
    }
  ] as SimQuery[],
  jobNote: `Job nie jest przypisany do żadnego executora. To porcja pracy, którą driver rozkłada na stage'e, a te na taski.`,
  idle: 'Akcja jeszcze nie została wywołana. Istnieje tylko plan. Kliknij job albo stage, żeby zobaczyć, skąd się bierze.',
  inspect: {
    job: 'Job',
    stage: 'Stage',
    does: 'Co robi',
    tasks: 'Partycje i taski',
    input: 'Wejście',
    output: 'Wyjście',
    hint: 'Kliknij job albo stage.'
  },
  shuffle: 'shuffle · granica stage\'a',
  takeaway: [
    `<b>Wniosek.</b> Akcja uruchamia wykonanie planu. Driver tnie plan na stage'e w miejscach shuffle'u, a każdy stage na taski: po jednym na partycję. Liczbę tasków w stage'u, który czyta dane, wyznacza podział wejścia. Po shuffle'u wyznacza ją <code>spark.sql.shuffle.partitions</code> albo AQE.`,
    `„Jedna akcja to jeden job” jest przybliżeniem. Z włączonym AQE to samo zapytanie dało tu 2 albo 4 joby, a część stage'y została pominięta, bo ich wynik już istniał. Bezpieczne zdanie na rozmowę: akcja uruchamia jeden lub więcej jobów, a o ich liczbie decydują plan i konfiguracja.`
  ],
  simTitle: 'Co tu jest uproszczeniem',
  simNotes: [
    `Przebieg krok po kroku to animacja w JavaScripcie. Liczby jobów, stage'y, tasków i rekordów w shuffle'u pochodzą z labu.`,
    'To dane testowe: 1200 zamówień i 40 klientów. Na prawdziwych danych liczba partycji wejścia zależy od rozmiaru plików, a AQE rzadko sklei wszystko w jedną partycję.',
    `Lab działa w trybie <term id="local-mode">local[3]</term>: trzy wątki w jednym procesie, bez sieci i bez osobnych executorów. „3 rdzenie” w opisach kroków odpowiadają tym trzem wątkom.`,
    `Numery jobów i stage'y w Spark UI rosną przez całe życie aplikacji. Tutaj są liczone od zera dla każdej akcji.`,
    `W zapytaniu z joinem broadcast jest wyłączony (<code>spark.sql.autoBroadcastJoinThreshold = -1</code>), żeby obie strony przeszły przez shuffle. Z ustawieniami domyślnymi tak mała tabela klientów zostałaby rozesłana w całości. Ten wariant jest w etapie Praktyka.`,
    `Animacja nie pokazuje, czy joby 0 i 1 w wariancie z AQE działają jednocześnie. Lab tego nie mierzył.`
  ],
  boundaryTitle: `Dlaczego stage kończy się akurat na shuffle'u`,
  boundary: [
    `W ramach stage'a task bierze jedną partycję i przepuszcza ją przez kolejne operatory, na nikogo nie czekając. Dlatego filtr, wybór kolumn i agregacja częściowa mieszczą się w jednym stage'u.`,
    `Shuffle to zmienia. Partycja po shuffle'u zbiera dane od wszystkich tasków poprzedniego stage'a, więc trzeba poczekać, aż wszystkie skończą i zapiszą swoje pliki. Ta bariera jest granicą stage'a.`,
    `Stąd dwa rodzaje stage'y. Jeden kończy się zapisem plików shuffle (w kodzie Sparka: ShuffleMapStage). Drugi jest ostatni w jobie i wykonuje akcję (ResultStage). Plików shuffle ostatni stage nie zapisuje.`,
    `Nie każdy join oznacza shuffle obu stron. Mała tabela może zostać rozesłana do executorów w całości (<term id="broadcast-join">broadcast join</term>), a wtedy duża strona zostaje na miejscu.`
  ],
  schedulingTitle: 'Kto decyduje, który task trafi na który executor',
  scheduling: [
    `Driver. Przydziela taski wolnym rdzeniom executorów i stara się wysłać task tam, gdzie są jego dane, na przykład na executor, który trzyma tę partycję w cache albo ma potrzebne pliki shuffle.`,
    `Jeśli takie miejsce jest zajęte, driver chwilę czeka (<code>spark.locality.wait</code>, w Apache Spark domyślnie 3 s), a potem wysyła task w mniej korzystne miejsce.`,
    `Joby w jednej aplikacji są domyślnie obsługiwane w kolejności zgłoszenia (FIFO). Kilka jobów naraz pojawia się wtedy, gdy akcje są wywoływane z osobnych wątków. Zamiast FIFO da się skonfigurować tryb fair, który dzieli zasoby między joby.`,
    `Spekulacyjne wykonywanie tasków (<code>spark.speculation</code>) też jest w Apache Spark domyślnie wyłączone.`
  ]
};

/** Etap Mechanizm, część 2: DAG stage'y zapytania z joinem. Ilustracja struktury z labu (AQE wyłączone). */
export const dag = {
  title: 'Dlaczego to się nazywa DAG?',
  intro: `Kroki zapytania zależą od siebie: join potrzebuje obu odczytów, a suma potrzebuje joina. Taki układ zależności to graf. Poniżej stage'e zapytania z joinem, narysowane według tego, co na co czeka.`,
  caption: `Stage'e joba z zapytania filter + join + groupBy (AQE wyłączone). Strzałka znaczy: „najpierw to, potem tamto”.`,
  nodes: [
    { id: 0, label: 'Stage 0', sub: 'odczyt klientów', tasks: 2 },
    { id: 1, label: 'Stage 1', sub: 'odczyt zamówień', tasks: 4 },
    { id: 2, label: 'Stage 2', sub: 'join', tasks: 200 },
    { id: 3, label: 'Stage 3', sub: 'suma i zapis', tasks: 200 }
  ],
  edge: 'shuffle',
  takeaway: `<b>Wniosek.</b> DAG to directed acyclic graph: graf skierowany (zależność ma kierunek) i acykliczny (żaden krok nie zależy od samego siebie). Brak cykli gwarantuje, że istnieje kolejność, w której da się policzyć wszystko. Driver wyznacza ją sam: stage rusza, gdy gotowe są wszystkie stage'e, na które czeka.`,
  moreTitle: 'Dwa znaczenia słowa DAG i gdzie go zobaczyć',
  more: [
    `Na rozmowie „DAG” pada w dwóch znaczeniach. Pierwsze to graf operacji całego zapytania: odczyt, filtr, join, agregacja. Drugie to graf stage'y jednego joba, taki jak na rysunku. Drugi powstaje z pierwszego przez cięcie w miejscach shuffle'u.`,
    `W labie stage 0 i stage 1 faktycznie działały w tym samym czasie. Żaden nie czeka na drugi, więc driver wysłał oba od razu.`,
    `W Spark UI graf jest na stronie joba, w sekcji DAG Visualization. Dokumentacja opisuje go tak: wierzchołki to RDD albo DataFrame'y, krawędzie to operacje.`
  ]
};

/** Etap Mechanizm, część 3: cztery plany zapytania „filter + groupBy". Wydruki z labu, sekcja 2 (AQE wyłączone). */
export interface PlanView { id: string; label: string; title: string; text: string; code?: string }
export const plans = {
  title: 'Skąd driver wie, gdzie ciąć? Z planu fizycznego',
  intro: `Zanim powstanie job, zapytanie przechodzi przez cztery wersje planu. Trzy pierwsze mówią, <b>co</b> policzyć. Czwarta mówi, <b>jak</b>: którym algorytmem i gdzie przenieść dane. Wydruki pochodzą z <code>explain(extended=True)</code> dla zapytania filter + groupBy.`,
  badge: 'Rzeczywisty wydruk · PySpark 4.0.1 · AQE wyłączone',
  defaultView: 'physical',
  views: [
    {
      id: 'parsed',
      label: '1. Parsed',
      title: 'Parsed Logical Plan',
      text: `Zapis tego, co napisałeś, zanim Spark cokolwiek sprawdzi. Apostrof przed nazwą (<code>'order_date</code>) znaczy „jeszcze nierozwiązane”: nie wiadomo, czy taka kolumna istnieje i jaki ma typ.`,
      code: `'Aggregate ['order_date], ['order_date, 'sum('amount) AS revenue#32]
+- Filter (status#12 = paid)
   +- Relation [order_id#9L,customer_id#10L,order_date#11,status#12,amount#13] parquet`
    },
    {
      id: 'analyzed',
      label: '2. Analyzed',
      title: 'Analyzed Logical Plan',
      text: `Nazwy sprawdzone ze <term id="schema">schematem</term>. Każda kolumna ma typ i wewnętrzny numer, np. <code>order_date#11</code>, a pierwsza linia podaje schemat wyniku. Na tym etapie wychodzi literówka w nazwie kolumny.`,
      code: `order_date: date, revenue: double
Aggregate [order_date#11], [order_date#11, sum(amount#13) AS revenue#32]
+- Filter (status#12 = paid)
   +- Relation [order_id#9L,customer_id#10L,order_date#11,status#12,amount#13] parquet`
    },
    {
      id: 'optimized',
      label: '3. Optimized',
      title: 'Optimized Logical Plan',
      text: `Ten sam wynik, mniej pracy. <term id="optimizer">Optymalizator</term> dopisał <code>Project</code>, żeby dalej szły tylko dwie potrzebne kolumny, i warunek <code>isnotnull</code>. To znasz z lekcji o lazy evaluation. Nadal nie ma tu ani słowa o partycjach.`,
      code: `Aggregate [order_date#11], [order_date#11, sum(amount#13) AS revenue#32]
+- Project [order_date#11, amount#13]
   +- Filter (isnotnull(status#12) AND (status#12 = paid))
      +- Relation [order_id#9L,customer_id#10L,order_date#11,status#12,amount#13] parquet`
    },
    {
      id: 'physical',
      label: '4. Physical',
      title: 'Physical Plan',
      text: `Tu pierwszy raz pojawiają się konkretne algorytmy i ruch danych. Z tego planu driver robi job. Czytaj od dołu, od źródła.`
    }
  ] as PlanView[],
  physicalTitle: 'Physical Plan (linie skrócone)',
  physical: [
    {
      code: '*(2) HashAggregate(keys=[order_date#11], functions=[sum(amount#13)])',
      label: `GROUP BY, krok końcowy · drugi stage`,
      text: `Składa sumy częściowe w jeden wynik dla każdej daty. Działa po shuffle'u, więc należy do drugiego stage'a.`
    },
    {
      code: '+- Exchange hashpartitioning(order_date#11, 200)',
      label: `Shuffle · granica stage'a`,
      text: `Przenosi dane tak, żeby ta sama data trafiła do tej samej partycji. Liczba 200 to <code>spark.sql.shuffle.partitions</code>. W tym miejscu driver przetnie job na dwa stage'e. Uwaga: <code>BroadcastExchange</code> też ma „Exchange” w nazwie, ale shuffle'em nie jest.`
    },
    {
      code: '   +- *(1) HashAggregate(keys=[order_date#11], functions=[partial_sum(amount#13)])',
      label: 'GROUP BY, krok częściowy · pierwszy stage',
      text: `Każdy task sumuje w obrębie własnej partycji. Dzięki temu przez shuffle idą sumy częściowe (w labie 20 rekordów), a nie wszystkie 800 opłaconych zamówień.`
    },
    {
      code: '      +- *(1) Project [order_date#11, amount#13]',
      label: 'SELECT order_date, amount',
      text: 'Zostawia dwie kolumny potrzebne dalej.'
    },
    {
      code: '         +- *(1) Filter (isnotnull(status#12) AND (status#12 = paid))',
      label: `WHERE status = 'paid'`,
      text: 'Filtr wierszy. Liczy każdą partycję osobno, więc zostaje w tym samym stage\'u co odczyt.'
    },
    {
      code: '            +- *(1) ColumnarToRow',
      label: 'Zmiana formatu w pamięci',
      text: 'Krok techniczny między czytnikiem Parquet a kolejnymi operatorami. Nie wynika z Twojego zapytania i nie zmienia wyniku.'
    },
    {
      code: '               +- FileScan parquet [order_date#11,status#12,amount#13] … PushedFilters: [IsNotNull(status), EqualTo(status,paid)] …',
      label: 'FROM orders',
      text: `Odczyt plików: 3 kolumny z 5 i filtr przekazany do źródła. Liczba tasków pierwszego stage'a wynika z tego, na ile partycji Spark podzielił pliki.`
    }
  ] as ExplainedLine[],
  takeaway: `<b>Wniosek.</b> Plan logiczny mówi, co policzyć. Plan fizyczny mówi, jak. Liczbę stage'y przewidzisz z planu fizycznego: każdy <code>Exchange</code> z podziałem na partycje to shuffle i granica stage'a, więc jeden taki węzeł daje tu 2 stage'e. To przewidywanie dotyczy planu sprzed wykonania, bo AQE może go jeszcze zmienić.`,
  starTitle: 'Co znaczy *(1) i *(2) przed operatorem',
  star: [
    `Gwiazdka z numerem oznacza operatory, które Spark skleił w jeden wygenerowany fragment kodu (whole-stage code generation). Numer to identyfikator takiej grupy.`,
    `To nie jest numer stage'a ze Spark UI. W tym planie grupy pokrywają się ze stage'ami, ale nie musi tak być: UI numeruje stage'e od zera i przez całe życie aplikacji.`
  ],
  catalystTitle: 'Co dzieje się między kolejnymi planami',
  catalyst: [
    `<b>Analiza</b> zamienia nierozwiązane nazwy kolumn i tabel na konkretne obiekty z typami. W klasycznym Sparku dzieje się to od razu przy definicji DataFrame, dlatego literówka w nazwie kolumny wychodzi przed akcją.`,
    `<b>Optymalizacja logiczna</b> stosuje zestaw reguł: przesuwa filtry bliżej źródła, wycina niepotrzebne kolumny, upraszcza wyrażenia. Wynik jest równoważny, ale tańszy.`,
    `<b>Planowanie fizyczne</b> wybiera konkretne algorytmy, na przykład rodzaj joina, i dokłada <term id="exchange">Exchange</term> tam, gdzie operator potrzebuje danych ułożonych po kluczu.`
  ],
  aqeTitle: 'Z AQE plan fizyczny nie jest ostateczny',
  aqe: [
    `Z włączonym AQE wydruk planu fizycznego zaczyna się od <code>AdaptiveSparkPlan isFinalPlan=false</code>. To plan początkowy. Spark może go zmienić po każdym shuffle'u, gdy pozna prawdziwe rozmiary partycji.`,
    `W labie po wykonaniu <code>collect()</code> na tym samym DataFrame pierwsza linia zmieniła się na <code>isFinalPlan=true</code>. Dlatego przy diagnozie patrz na plan po wykonaniu, najlepiej w zakładce SQL w Spark UI.`
  ]
};

/* ------------------------------------------------------------------ Praktyka */

export interface Experiment {
  setup: string;
  ask: string;
  choices: string[];
  correct: number;
  /** Wydruk z labu. */
  output: string;
  notes: string[];
  scope: string;
  more?: { title: string; html: string[] };
}

export const practice = {
  title: 'Ten sam mechanizm, tym razem naprawdę',
  lede: `Jeden skrypt, cztery części: sesja i kontekst, cztery plany, joby i stage'e trzech zapytań oraz task, który pada. Każdy wydruk poniżej to wynik jego uruchomienia.`,
  badge: 'Rzeczywiste wykonanie · PySpark 4.0.1 · local[3]',
  scope: `<code>local[3]</code> to jeden proces z trzema wątkami na jednej maszynie, bez klastra. Wyniki pokazują mechanizm, ale są obserwacją z tej konfiguracji i z małych danych testowych, a nie gwarancją Sparka.`,
  before: 'Zanim przewiniesz dalej: przy każdym eksperymencie najpierw zgadnij wynik.',
  experiments: [
    {
      setup: `Zapytanie filter + join + groupBy z symulatora, AQE wyłączone. Jedyna zmiana: próg broadcast wraca do wartości domyślnej Apache Spark (10 MB). Tabela klientów ma 40 wierszy, więc mieści się w nim z ogromnym zapasem.`,
      ask: `W symulatorze był 1 job i 4 stage'e. Co da teraz jedna akcja <code>write</code>?`,
      choices: [`1 job, 4 stage'e`, `1 job, 3 stage'e`, `2 joby, 3 stage'e`],
      correct: 2,
      output: `razem: jobów 2, wykonanych stage'y 3, wykonanych tasków 206
job 0: stage'y 1 wykonane, 0 pominięte
   stage 0: wykonany  tasków   2   shuffle: zapisane    0, odczytane    0 rekordów
job 1: stage'y 2 wykonane, 0 pominięte
   stage 1: wykonany  tasków   4   shuffle: zapisane   16, odczytane    0 rekordów
   stage 2: wykonany  tasków 200   shuffle: zapisane    0, odczytane   16 rekordów`,
      notes: [
        `Mała tabela nie przechodzi już przez shuffle. Spark czyta ją osobnym jobem (2 taski), a potem rozsyła w całości do executorów. To <term id="broadcast-join">broadcast join</term>: w planie zamiast <code>SortMergeJoin</code> jest <code>BroadcastHashJoin</code>.`,
        `Duża strona też nie jest tasowana przed joinem. Join dzieje się od razu w stage'u, który czyta zamówienia. Został jeden shuffle, przed sumą po regionie: 16 rekordów, czyli 4 regiony × 4 partycje.`,
        `Jedna akcja, dwa joby, i to bez AQE. Liczba jobów zależy od planu.`
      ],
      scope: `Pomiar lokalny, tak samo na PySpark 4.0.1 i 4.3.0. Osobny job dla strony broadcast to obserwacja z tego planu, a nie reguła z dokumentacji. Z włączonym AQE ta sama akcja dała 3 joby i 7 tasków.`
    },
    {
      setup: `Stage z 4 taskami. Task dla partycji 1 rzuca wyjątek przy pierwszej próbie, a przy kolejnej już nie. Uruchomienie z <code>local[3,4]</code>: trzy wątki i limit 4 prób na task, czyli tyle, ile wynosi wartość domyślna <code>spark.task.maxFailures</code>.`,
      ask: 'Co zrobi Spark?',
      choices: ['Przerwie job', 'Powtórzy tylko ten jeden task', 'Powtórzy cały stage, wszystkie 4 taski'],
      correct: 1,
      output: `local[3,4]  maxFailures = 4: job zakończony
            (partycja, numer próby): (0, 0), (1, 1), (2, 0), (3, 0)
            stage: tasków 4, udanych 4, nieudanych prób 1, stan COMPLETE
local[3]    maxFailures = 1: job przerwany wyjątkiem
            stage: tasków 4, nieudanych prób 1, stan FAILED`,
      notes: [
        `Powtórzony został tylko task partycji 1: jego numer próby to 1, pozostałe trzy policzyły się raz. Jednostką ponawiania jest task, a nie stage ani job.`,
        `Limit dotyczy jednego taska. Job jest przerywany, gdy ten sam task zawiedzie tyle razy z rzędu, ile wynosi <code>spark.task.maxFailures</code>. Wartość domyślna 4 oznacza 3 ponowienia.`,
        `Zwykłe <code>local[3]</code> w tym teście nie ponowiło taska: pierwsza porażka przerwała job. Dlatego w trybie lokalnym nie zobaczysz ponowień, dopóki nie poprosisz o nie zapisem <code>local[K,F]</code>.`
      ],
      scope: `Pomiar lokalny na RDD z celowo psutym taskiem. Na klastrze ponowiony task może trafić na inny executor, czego tryb lokalny nie pokaże.`,
      more: {
        title: 'A gdy padnie cały executor albo driver?',
        html: [
          `Taski, które działały na utraconym executorze, są uruchamiane ponownie na innych.`,
          `Trudniej jest, gdy razem z executorem znikają pliki shuffle, które zapisał. Task następnego stage'a nie ma wtedy czego czytać. Według opisu w kodzie Sparka driver wysyła wtedy ponownie utracony stage, ale tylko dla brakujących tasków, a potem wraca do przerwanej pracy. Takie podejścia też mają limit: <code>spark.stage.maxConsecutiveAttempts</code>, domyślnie 4.`,
          `To działa, bo plan mówi, z czego powstała każda partycja. Skutek uboczny: ponowiony task wykonuje swój kod jeszcze raz, więc na przykład <term id="accumulator">akumulator</term> użyty w transformacji może zostać zwiększony dwukrotnie.`,
          `Driver jest jeden i to on trzyma plan oraz stan wykonania. Jego utraty ten mechanizm nie naprawi: w typowej konfiguracji aplikacja kończy się błędem i trzeba ją uruchomić ponownie.`
        ]
      }
    },
    {
      setup: `Zapytanie filter + groupBy, AQE włączone (ustawienie domyślne). Wypisujesz pierwszą linię planu fizycznego dwa razy: przed akcją i po <code>collect()</code> na tym samym DataFrame.`,
      ask: 'Co się zmieni w tej linii?',
      choices: ['Nic, plan jest ustalony przed wykonaniem', 'isFinalPlan zmieni się z false na true', `Zniknie węzeł AdaptiveSparkPlan`],
      correct: 1,
      output: `pierwsza linia planu fizycznego przed akcją:  AdaptiveSparkPlan isFinalPlan=false
...i po collect() na tym samym DataFrame:     AdaptiveSparkPlan isFinalPlan=true`,
      notes: [
        `Z AQE plan, który widzisz przed akcją, jest planem początkowym. Ostateczny powstaje w trakcie wykonania.`,
        `Stąd różnica w symulatorze: plan początkowy zakładał 200 partycji po shuffle'u, a wykonany stage miał 1 task.`
      ],
      scope: `Pomiar lokalny. Lab czyta plan przez wewnętrzne API JVM, więc to wygodny podgląd, a nie stabilny interfejs. W codziennej pracy plan końcowy pokazuje zakładka SQL w Spark UI.`
    }
  ] as Experiment[],
  uiTitle: 'Gdzie to zobaczyć w Spark UI',
  uiIntro: 'Ścieżka jest zawsze ta sama: zapytanie, job, stage, task.',
  ui: [
    `<b>Zakładka SQL.</b> Lista zapytań, w tym akcji na DataFrame'ach takich jak <code>count</code>, <code>show</code> i <code>write</code>. Strona zapytania pokazuje plan oraz powiązane z nim joby i stage'e. Tu zaczynaj.`,
    `<b>Zakładka Jobs.</b> Wszystkie joby aplikacji. Strona joba pokazuje liczbę stage'y według stanu, w tym pominięte (skipped), oraz DAG Visualization.`,
    `<b>Zakładka Stages.</b> Stage'e wszystkich jobów. Strona stage'a pokazuje jego taski z czasami i rozmiarem danych odczytanych i zapisanych w shuffle'u.`,
    `Na Databricks serverless Spark UI nie ma. Te same pytania zadajesz w query profile.`
  ]
};

/* ----------------------------------------------------------------- Interview */

/**
 * Etap Interview. Pytania, odpowiedzi 30–60 s (PL i EN) oraz follow-upy przychodzą z Interview Banku.
 * Tutaj jest tylko to, czego bank nie ma: jak powiedzieć o tym modelu, przychodząc ze świata hurtowni.
 */
export const interview = {
  bridgeIntro: 'Jeśli na co dzień czytasz profile zapytań w hurtowni, a nie Spark UI, powiedz to wprost i pokaż, że masz model. Na przykład tak:',
  bridgeEn: '“My background is warehouse-first, where the unit I look at is the query and its profile. In Spark I read one level further down. An action triggers one or more jobs, each job is cut into stages at shuffle boundaries, and each stage runs one task per partition. So when something is slow, I go from the query to its jobs, to the slowest stage, to the tasks in it, and I use the physical plan to see which shuffle created that stage.”',
  bridgePl: `Po polsku: przychodzę ze świata hurtowni, gdzie patrzę na zapytanie i jego profil. W Sparku czytam jeden poziom głębiej. Akcja uruchamia jeden lub więcej jobów, job jest cięty na stage'e w miejscach shuffle'u, a stage to jeden task na partycję. Gdy coś jest wolne, idę od zapytania przez joby do najwolniejszego stage'a i jego tasków, a w planie fizycznym sprawdzam, który shuffle ten stage utworzył.`
};

/* --------------------------------------------------------------- Sprawdź się */

export interface QuizItem { q: string; setup?: string; options: string[]; correct: number; why: string }
export const quiz: QuizItem[] = [
  {
    q: `Plan fizyczny ma dwa węzły <code>Exchange hashpartitioning</code> i żadnego broadcastu. Ile stage'y będzie miał job?`,
    setup: `Założenia: AQE wyłączone, jedna akcja, żaden wynik shuffle'u nie istnieje z wcześniejszych akcji.`,
    options: ['2', '3', '200'],
    correct: 1,
    why: `Trzy. Każdy shuffle dodaje granicę, więc 2 shuffle'e dają 3 stage'e. 200 to domyślna liczba partycji po shuffle'u, czyli liczba tasków w stage'u, a nie liczba stage'y.`
  },
  {
    q: `Stage po shuffle'u ma 200 tasków, choć wynik to 5 wierszy. Skąd 200?`,
    setup: 'Założenia: Apache Spark z ustawieniami domyślnymi, ale z wyłączonym AQE.',
    options: ['Dane wejściowe miały 200 plików', 'Tyle wynosi spark.sql.shuffle.partitions', 'Klaster ma 200 rdzeni'],
    correct: 1,
    why: `Liczbę partycji po shuffle'u, a więc i tasków w następnym stage'u, ustawia <code>spark.sql.shuffle.partitions</code>, domyślnie 200. To ustawienie, a nie rozmiar danych. Z włączonym AQE Spark skleiłby małe partycje: w labie zostawał 1 task.`
  },
  {
    q: 'Wywołujesz jedną akcję <code>write</code>. W Spark UI pojawiają się 3 joby. Co jest najbardziej prawdopodobne?',
    options: ['Akcja wykonała się trzy razy przez błąd', 'To normalne: AQE albo broadcast join wysłały części planu jako osobne joby', 'Każdy executor dostał własny job'],
    correct: 1,
    why: `Akcja uruchamia wykonanie planu, a liczba jobów zależy od planu i konfiguracji. W labie to samo zapytanie z joinem dało 1 job bez AQE i broadcastu, 2 joby z broadcastem i 3 z ustawieniami domyślnymi. Job nie jest przypisany do executora.`
  },
  {
    q: 'Czym różni się SparkSession od SparkContext?',
    options: ['To dwie nazwy tego samego obiektu', 'SparkSession to wejście do DataFrame i SQL, SparkContext to połączenie z klastrem, jedno na aplikację', 'SparkContext działa na executorach, a SparkSession na driverze'],
    correct: 1,
    why: `Oba obiekty żyją w driverze. Sesja jest wejściem do DataFrame'ów i SQL i może ich być kilka. Kontekst reprezentuje połączenie z klastrem i jest jeden: sesje utworzone przez <code>newSession()</code> go współdzielą. W Spark Connect klient nie ma dostępu do SparkContext.`
  },
  {
    q: 'Który plan mówi, jakim algorytmem zostanie wykonany join i gdzie będzie shuffle?',
    options: ['Parsed Logical Plan', 'Optimized Logical Plan', 'Physical Plan'],
    correct: 2,
    why: `Plany logiczne mówią, co policzyć. Rodzaj joina (np. <code>SortMergeJoin</code> albo <code>BroadcastHashJoin</code>) i węzły <code>Exchange</code> pojawiają się dopiero w planie fizycznym. Z AQE także on może się zmienić w trakcie wykonania.`
  },
  {
    q: 'Jeden task rzuca wyjątek. Co robi Spark?',
    setup: 'Założenia: klaster z ustawieniami domyślnymi Apache Spark.',
    options: ['Od razu przerywa job', 'Ponawia ten task, a job przerywa dopiero czwarta porażka z rzędu tego samego taska', `Uruchamia od nowa wszystkie stage'e joba`],
    correct: 1,
    why: `Jednostką ponawiania jest task. <code>spark.task.maxFailures</code> wynosi domyślnie 4, czyli 3 ponowienia. Pozostałe taski stage'a nie są powtarzane. Cały stage wraca dopiero wtedy, gdy przepadną pliki shuffle, których potrzebuje następny.`
  },
  {
    q: 'W jobie stage 0 czyta klientów, stage 1 czyta zamówienia, a stage 2 je łączy. Co wiadomo o kolejności?',
    options: ['Stage 1 zawsze czeka na koniec stage 0', 'Stage 0 i 1 mogą działać jednocześnie, a stage 2 czeka na oba', 'Kolejność jest taka jak kolejność linijek w kodzie'],
    correct: 1,
    why: `Kolejność wynika z zależności w DAG-u. Dwa odczyty nie zależą od siebie, więc driver może wysłać oba od razu, a w labie rzeczywiście działały w tym samym czasie. Join potrzebuje plików shuffle z obu, więc czeka.`
  }
];

import type { Bridge, ExplainedLine, LessonMeta } from '../../types';

/**
 * Lekcja 00: Apache Spark Fundamentals. Buduje model, na którym stoją kolejne lekcje:
 * po co Spark, kto w nim wykonuje pracę (driver, executory, partycje, taski), czym jest DataFrame,
 * jak mają się do siebie Apache Spark, PySpark i Databricks oraz kiedy wybrać Sparka, pandas albo hurtownię.
 *
 * Fragmenty narracyjne są w HTML (dozwolone znaczniki: lib/richText.ts) i mogą używać
 * <term id="...">, czyli haseł z content/glossary.ts.
 *
 * Skąd są fakty: dokumentacja Apache Spark 4.3.0, Databricks, pandas i Snowflake, spisana w
 * docs/verified-facts.md (sekcja „Lekcja 00"). Jedyny pomiar to istniejący wynik z
 * labs/interview_bank/spark_checks.py (12 partycji na local[3]). Wszystkie wizualizacje są ilustracjami:
 * liczby w nich są dobrane tak, żeby mechanizm było widać, i nie pochodzą z uruchomienia.
 * Pytania rekrutacyjne, krótkie odpowiedzi i follow-upy nie są tu powtórzone: lekcja bierze je
 * z Interview Banku (pytania o tym samym topicId).
 */
export const meta: LessonMeta = {
  id: 'spark-fundamentals',
  topicId: 'spark.fundamentals',
  area: 'spark',
  title: 'Apache Spark Fundamentals: Building a Mental Model',
  subtitle: 'Po co istnieje Spark, kto w nim wykonuje pracę i kiedy sięgnąć po niego zamiast po pandas albo hurtownię.',
  minutes: 15
};

/** Krok etapu Intuicja. `visual` wstawia ilustrację między `html` a `after`. */
export interface Beat {
  html: string;
  visual?: 'fit';
  /** Krótki wniosek pod ilustracją. */
  after?: string;
  next: string;
  bridge?: Bridge;
  /** Zwinięte pogłębienie, poza domyślną ścieżką. */
  more?: { title: string; html: string[] };
}

export const beats: Beat[] = [
  {
    html: '<h1>Dane urosły. Maszyna nie.</h1>\n<p class="lede">Masz skrypt w pandas, który liczy dzienny przychód z pliku zamówień. Działa od roku, a plik rośnie.</p>\n<p>Pytanie, od którego zaczyna się Spark: <b>co się stanie z tym skryptem, gdy danych będzie dziesięć, a potem sto razy więcej?</b> Wybierz rozmiar zbioru i porównaj dwa podejścia.</p>',
    visual: 'fit',
    after: '<b>Wniosek.</b> pandas trzyma cały zbiór w pamięci jednego procesu, więc jego sufitem jest jedna maszyna. Gdy dane pociąć na kawałki, rozmiar całości przestaje decydować o tym, czy się zmieszczą. Zostaje pytanie, kto te kawałki przeliczy i ile to potrwa.',
    next: 'A większa maszyna?'
  },
  {
    html: '<h2>Większa maszyna albo więcej maszyn</h2>\n<p>Możesz przenieść skrypt na maszynę z większą pamięcią. To działa, dopóki taka maszyna istnieje i dopóki wystarcza Ci, że całość liczy jeden komputer.</p>\n<p>Druga droga: wiele zwykłych maszyn, z których każda liczy swoje kawałki w tym samym czasie. To <b>przetwarzanie rozproszone</b>. Brzmi prosto, ale ktoś musi pociąć dane, rozdać pracę, zebrać wyniki i powtórzyć to, co przepadło, gdy jedna z maszyn padnie w połowie.</p>\n<p>Pisanie tego ręcznie przy każdym zapytaniu nie wchodzi w grę. Tę pracę ma wykonać silnik.</p>',
    next: 'Czy ja już czegoś takiego nie używam?'
  },
  {
    html: '<h2>Używasz tego od lat, tylko tego nie widać</h2>\n<p>Snowflake też jest rozproszony. Wysyłasz SQL, a virtual warehouse, czyli klaster maszyn, liczy go równolegle. Podziału danych i rozdziału pracy nigdy nie oglądasz.</p>\n<p><b>Apache Spark</b> to silnik open source, który robi to samo jawnie. Bierze zapytanie zapisane w SQL albo w Pythonie, dzieli pracę na kawałki, rozdaje je maszynom i składa wynik. Działa na klastrze, który widzisz, i na plikach, które leżą w Twoim storage. Nie kończy się też na SQL: ten sam silnik obsługuje streaming i machine learning.</p>',
    bridge: {
      from: 'Snowflake',
      known: 'Virtual warehouse: niezależny klaster obliczeniowy, który wykonuje Twój SQL. Wybierasz tylko jego rozmiar.',
      fresh: 'Klaster Sparka pełni tę samą rolę, ale jego części mają nazwy i da się je zobaczyć. Za chwilę poznasz je jako driver i executory.',
      breaks: 'Snowflake sam zarządza tym, jak dane są zapisane i podzielone, a Ty widzisz tylko tabele. Spark jest silnikiem obliczeń, a nie magazynem danych: czyta pliki z zewnętrznego storage i tam zapisuje wyniki. Za format tych plików i częściowo za ich podział na kawałki odpowiadasz Ty.'
    },
    more: {
      title: 'Skąd się wziął Spark',
      html: [
        'Spark powstał w 2009 roku jako projekt badawczy w AMPLab na UC Berkeley. Na początku 2010 roku został otwarty, a w 2013 trafił do Apache Software Foundation.',
        'Wcześniejszym standardem przetwarzania rozproszonego był MapReduce. Autorzy Sparka opisują swój cel jako model, który obsłuży znacznie szerszą klasę zastosowań niż MapReduce i zachowa jego automatyczną odporność na awarie. Chodziło zwłaszcza o algorytmy iteracyjne i interaktywną analizę, czyli przypadki, w których przez te same dane przechodzi się wiele razy.'
      ]
    },
    next: 'Zobacz, kto co robi'
  }
];

/** Ilustracja z pierwszego kroku: zbiór danych kontra pamięć jednej maszyny. Wartości są wymyślone. */
export const fit = {
  assumptions: 'Ilustracja: jedna maszyna z 64 GB pamięci. Kawałki mają ok. 128 MB, bo taki jest domyślny górny rozmiar partycji przy czytaniu plików w Apache Spark.',
  ramGb: 64,
  /** Szerokość toru w GB: tyle mieści się na pasku, reszta jest „poza skalą". */
  trackGb: 100,
  chunkMb: 128,
  sizes: [4, 40, 400],
  defaultSize: 4,
  wholeLabel: 'Cały zbiór w pamięci jednej maszyny (tak działa pandas)',
  chunksLabel: 'Ten sam zbiór pocięty na kawałki (tak działa Spark)',
  /** Werdykt dla podejścia „całość w pamięci", w kolejności `sizes`. */
  verdicts: [
    { state: 'ok', text: 'Mieści się z dużym zapasem. pandas wystarczy i jest tu najprostszym narzędziem.' },
    { state: 'risk', text: 'Formalnie się mieści, ale to już ryzyko. Część operacji pandas tworzy kopie pośrednie, więc potrzeba więcej pamięci, niż zajmuje sam zbiór.' },
    { state: 'no', text: 'Nie mieści się: zbiór jest ponad 6 razy większy niż pamięć tej maszyny. Zwykłe wczytanie całości nie ma szans się udać.' }
  ] as { state: 'ok' | 'risk' | 'no'; text: string }[],
  chunksText: 'Każdy kawałek mieści się w pamięci z zapasem, niezależnie od rozmiaru całości. Kawałki są od siebie niezależne, więc można je rozdać wielu maszynom.'
};

/**
 * Etap Mechanizm, część 1: kto wykonuje pracę. Domyślna ścieżka to pytanie, symulacja klastra,
 * liczniki i krótki wniosek. Reszta jest zwinięta, każda sekcja osobno.
 * W komunikatach {tasks}, {busy}, {idle} i {rounds} podstawia komponent.
 */
export const cluster = {
  question: 'Kto wykonuje pracę, kiedy uruchamiasz zapytanie?',
  intro: 'Cztery słowa, bez których nie da się rozmawiać o Sparku. <b>Driver</b> to proces z Twoim programem: układa plan i rozdziela pracę. <b>Executory</b> to procesy robocze na maszynach klastra: to one czytają i liczą dane. <b>Partycja</b> to kawałek danych, taki jak w poprzednim etapie. Przeliczenie jednej partycji to jeden <b>task</b>. Zmień liczbę executorów albo partycji i uruchom zapytanie.',
  assumptions: 'Model uproszczony: proste zapytanie (odczyt plików, filtr, zapis wyniku), równe partycje, każdy executor ma 2 rdzenie, a jeden rdzeń liczy jeden task naraz.',
  executors: [1, 2, 4],
  defaultExecutors: 2,
  partitions: [2, 8, 16],
  defaultPartitions: 8,
  coresPerExecutor: 2,
  messages: {
    allAtOnce: 'Każdy task ma własny rdzeń, więc wszystkie liczą się jednocześnie. Dokładanie executorów niczego tu już nie przyspieszy.',
    waiting: 'Naraz liczy się {busy} z {tasks} tasków. Pozostałe czekają na wolny rdzeń. Liczba tur: {rounds}.',
    idle: 'Tasków jest {tasks}, a rdzeni {slots}. Rdzenie bez pracy: {idle}. Nie ma więcej kawałków do rozdania, więc kolejne executory niczego nie przyspieszą.'
  },
  driver: {
    idle: 'Plan gotowy. Liczba tasków do rozdania: {tasks}.',
    running: 'Tura {round} z {rounds}: taski wysłane do executorów.',
    done: 'Wszystkie taski zakończone. Driver dostał ich statusy, a nie wiersze.'
  },
  takeaway: [
    '<b>Wniosek.</b> Liczba partycji wyznacza liczbę tasków. Liczba wolnych rdzeni na executorach wyznacza, ile z nich liczy się jednocześnie. To dwie różne liczby i trzeba pilnować obu.',
    'Driver w tym zapytaniu nie dotyka wierszy: rozdaje taski i odbiera informację, że się skończyły. Zmienia się to, gdy poprosisz o wynik u siebie, np. przez <code>collect()</code>. Wtedy wszystkie wiersze wracają do jednego procesu.'
  ],
  simTitle: 'Co tu jest uproszczeniem',
  simNotes: [
    'To animacja w JavaScripcie. Nie działa tu żaden Spark.',
    '„Tury" są uproszczeniem. Prawdziwe taski kończą się w różnym czasie, a zwolniony rdzeń od razu bierze następny task.',
    'Partycje rzadko są równe. Jedna wyraźnie większa od reszty potrafi zdominować czas całego zapytania.',
    'Zapytanie z grupowaniem albo joinem ma kilka etapów, a między nimi dane są przegrupowywane między partycjami (<term id="shuffle">shuffle</term>). Każdy etap ma własne taski, więc „jeden task na partycję" obowiązuje w ramach etapu.',
    'Liczbę rdzeni executora ustawia się w konfiguracji (<code>spark.executor.cores</code>). Dwa rdzenie to założenie tej ilustracji, a nie wartość domyślna.'
  ],
  measuredTitle: 'Pomiar: ta sama zasada w lokalnym Sparku',
  measured: [
    'Lab <code>labs/interview_bank/spark_checks.py</code>: 12 partycji przy <term id="local-mode">local[3]</term> dało 12 tasków, z których jednocześnie działały najwyżej 3.',
    'To pomiar z jednej maszyny. W trybie lokalnym nie ma osobnych executorów, są trzy wątki robocze w jednym procesie. Wynik pokazuje samą zasadę: tasków jest tyle, ile partycji, a naraz liczy się tyle, ile jest wolnych rdzeni.'
  ],
  failureTitle: 'Co, jeśli maszyna padnie w połowie',
  failure: [
    'Task, który się nie powiódł, Spark uruchamia ponownie. W Apache Spark job zostaje przerwany dopiero po czwartej z rzędu porażce tego samego taska (<code>spark.task.maxFailures</code>, domyślnie 4).',
    'Utraconą partycję da się odtworzyć, bo Spark wie, z jakich kroków powstała, i potrafi policzyć ją od nowa. Dlatego awaria jednego executora zwykle spowalnia zapytanie, zamiast je kończyć.'
  ],
  collectTitle: 'A wynik? Pamięć drivera też ma granice',
  collect: [
    '<code>collect()</code> i <code>toPandas()</code> ściągają wszystkie wiersze z executorów do drivera. Dokumentacja ostrzega, że przy zbyt dużym zbiorze kończy się to błędem braku pamięci.',
    'Apache Spark ma na to bezpiecznik: <code>spark.driver.maxResultSize</code>, domyślnie 1 GB. Gdy łączny rozmiar wyników akcji go przekroczy, job jest przerywany.',
    'Praktyczna reguła: duży wynik zapisuj do tabeli albo plików. Do drivera ściągaj tylko to, co małe, np. kilka wierszy przez <code>take(n)</code> albo wynik po agregacji.'
  ],
  whereTitle: 'Gdzie dokładnie działa mój kod w Pythonie',
  where: [
    'W klasycznym PySparku Twój proces Pythona działa razem z driverem i nim steruje. Sam driver i executory to procesy <term id="jvm">JVM</term>.',
    'W <term id="spark-connect">Spark Connect</term> Twój program jest osobnym klientem: wysyła plan zapytania do serwera, a driver działa po stronie serwera. Model ról zostaje ten sam: ktoś planuje, ktoś liczy partycje.'
  ],
  bridgeTitle: 'Analogia: rozmiar warehouse w Snowflake',
  bridge: {
    from: 'Snowflake',
    known: 'Rozmiar warehouse: każdy kolejny rozmiar to więcej zasobów obliczeniowych w klastrze i dwa razy więcej kredytów za godzinę.',
    fresh: 'Liczba i rozmiar executorów. Do tego dochodzi druga gałka, której w Snowflake nie dotykasz: liczba partycji.',
    breaks: 'W Snowflake podziałem danych zarządza usługa. W Sparku zbyt mało partycji zostawia rdzenie bez pracy, a dokumentacja podaje jako punkt wyjścia 2–4 partycje na każdy rdzeń klastra. Uwaga na słowo: partycja Sparka to kawałek danych w trakcie obliczeń, a nie partycja tabeli, po której hurtownia dzieli dane na dysku.'
  } as Bridge
};

/** Etap Mechanizm, część 2: DataFrame jako tabela opisana kodem. */
export const dataframe = {
  title: 'A gdzie w tym wszystkim tabela?',
  intro: 'Nie piszesz tasków i nie adresujesz partycji. Pracujesz na <b>DataFrame</b>: tabeli z nazwanymi kolumnami i typami, której wiersze leżą w partycjach na wielu maszynach. Ty widzisz jedną tabelę, Spark widzi kawałki. Kliknij kolejne linie i porównaj je z SQL.',
  codeTitle: 'Dzienny przychód w PySparku',
  lines: [
    {
      code: 'orders = spark.read.parquet("s3://shop/orders/")',
      label: 'FROM orders',
      text: 'Wskazujesz źródło: katalog plików <term id="parquet">Parquet</term>. <code>spark</code> to sesja, czyli Twoje połączenie z silnikiem. Wynik to DataFrame <code>orders</code>: opis tabeli, a nie dane wczytane do pamięci Twojego programu.'
    },
    {
      code: 'paid = orders.filter(orders.status == "paid")',
      label: "WHERE status = 'paid'",
      text: 'Nowy DataFrame z warunkiem. Poprzedniego nie zmieniasz: każda operacja zwraca kolejny DataFrame, podobnie jak kolejne CTE w zapytaniu.'
    },
    {
      code: 'daily = paid.groupBy("order_date").sum("amount")',
      label: 'SELECT order_date, SUM(amount) … GROUP BY order_date',
      text: 'Grupowanie i suma. Żeby wiersze z tą samą datą spotkały się w jednym miejscu, Spark musi przegrupować dane między partycjami. Zrobi to sam, Ty podajesz tylko klucz.'
    },
    {
      code: 'daily.write.parquet("s3://shop/daily_revenue/")',
      label: 'CREATE TABLE … AS',
      text: 'Zapis wyniku. Driver zamienia całość na plan i taski, a executory czytają partycje, liczą i zapisują pliki wynikowe. Dlaczego praca rusza dopiero w tej linijce, a nie wcześniej, wyjaśnia następna lekcja.'
    }
  ] as ExplainedLine[],
  takeaway: '<b>Wniosek.</b> DataFrame to tabela opisana kodem. To samo zapytanie możesz napisać w SQL przez <code>spark.sql("SELECT …")</code>. Według dokumentacji oba zapisy wykonuje ten sam silnik, więc wybór między nimi to kwestia wygody, a nie wydajności.',
  bridgeTitle: 'Analogia: DataFrame w pandas',
  bridge: {
    from: 'pandas',
    known: 'DataFrame w pandas: dane leżą w pamięci Twojego procesu, a operacja wykonuje się od razu, na jednej maszynie.',
    fresh: 'DataFrame w Sparku: ta sama idea tabeli z kolumnami, ale wiersze są rozłożone na partycje i liczą je executory.',
    breaks: 'Nazwa jest ta sama, obiekt inny. W Sparku nie sięgniesz po wiersz numer 5, bo dane nie leżą u Ciebie i nie mają indeksu jak w pandas. Żeby zobaczyć wiersze, musisz o nie poprosić, np. przez <code>show()</code> albo <code>take(5)</code>. Z kolei <code>toPandas()</code> ściąga wszystko do drivera.'
  } as Bridge
};

/** Etap Praktyka, część 1: trzy warstwy i to, która zmienia się wraz z miejscem uruchomienia. */
export const stack = {
  title: 'Spark, PySpark, Databricks: co jest czym?',
  intro: 'Te trzy nazwy padają zamiennie, a oznaczają trzy różne warstwy. Zmień miejsce uruchomienia i zobacz, która warstwa się zmienia.',
  api: { role: 'Tym piszesz', name: 'PySpark', text: 'API Sparka w Pythonie. Biblioteka, przez którą opisujesz DataFrame\'y i zapytania. Obok niej są API w SQL, Scali i Javie.' },
  engine: { role: 'To liczy', name: 'Apache Spark', text: 'Silnik open source. Planuje zapytanie i wykonuje je na driverze i executorach.' },
  placeRole: 'Tu to działa',
  places: [
    {
      id: 'laptop',
      label: 'Laptop',
      name: 'Tryb lokalny',
      text: 'Jeden proces na Twojej maszynie, wątki zamiast executorów. Do nauki, testów i małych danych.',
      change: 'Zmienia się skala: jest jedna maszyna, więc nic nie jest naprawdę rozproszone.'
    },
    {
      id: 'cluster',
      label: 'Własny klaster',
      name: 'Kubernetes, YARN albo Spark Standalone',
      text: '<term id="cluster-manager">Menedżer klastra</term> przydziela maszyny. Zespół sam je utrzymuje, dobiera wersję Sparka i konfigurację.',
      change: 'Zmienia się to, kto odpowiada za maszyny: Twój zespół.'
    },
    {
      id: 'databricks',
      label: 'Databricks',
      name: 'Databricks',
      text: 'Platforma zbudowana na Apache Spark. Uruchamia klastry za Ciebie i dokłada własne elementy, m.in. notebooki, joby i silnik Photon zgodny z API Sparka.',
      change: 'Zmienia się to, kto odpowiada za maszyny: platforma. To nie jest jednak czysty Apache Spark. Wartości domyślne i dostępne funkcje bywają inne, a serverless udostępnia tylko API Spark Connect.'
    }
  ],
  defaultPlace: 'laptop',
  same: 'Bez zmian',
  changed: 'Zmienia się',
  takeaway: '<b>Wniosek.</b> Apache Spark to silnik. PySpark to jego API w Pythonie. Databricks to platforma, która uruchamia Sparka za Ciebie i dokłada własne elementy. „Znam Databricks" i „znam Sparka" to dwa różne zdania, ale model z tej lekcji obowiązuje w obu przypadkach.',
  pythonTitle: 'Czy to Python liczy moje dane?',
  python: [
    'Zwykle nie. Operacje na DataFrame, takie jak <code>filter</code> czy <code>groupBy</code>, wykonuje silnik działający w <term id="jvm">JVM</term>. Python tylko je opisuje. W klasycznym trybie Twój proces Pythona rozmawia z driverem przez bibliotekę Py4J.',
    'Wyjątek to własne funkcje Pythona, np. <term id="udf">UDF</term>. Dla nich executory uruchamiają procesy Pythona i przekazują im dane. Według dokumentacji takie procesy startują dopiero wtedy, gdy są potrzebne.'
  ],
  bridgeTitle: 'Analogia: dbt i hurtownia',
  bridge: {
    from: 'dbt',
    known: 'dbt nie wykonuje zapytań. Kompiluje modele do SQL i wysyła je do hurtowni, a liczy hurtownia.',
    fresh: 'PySpark działa podobnie: Twój Python opisuje zapytanie, a liczy je silnik Sparka na executorach.',
    breaks: 'dbt nigdy nie dotyka wierszy. PySpark czasem tak: wynik <code>collect()</code> wraca do Twojego procesu, a własne funkcje Pythona naprawdę wykonują się w Pythonie, na executorach. Poza tym dbt potrzebuje cudzego silnika, a PySpark przychodzi z własnym i po instalacji uruchomisz go lokalnie.'
  } as Bridge
};

export interface Scenario { setup: string; correct: number; why: string; scope: string }
/** Etap Praktyka, część 2: trzy scenariusze wyboru narzędzia. Najpierw wybór, potem uzasadnienie i jego zakres. */
export const choose = {
  title: 'Spark, pandas czy hurtownia?',
  intro: 'To nie jest ranking. O wyborze decydują trzy pytania: ile jest danych, gdzie leżą i czy wystarczy SQL. Przy każdym scenariuszu najpierw wybierz sam.',
  ask: 'Po co sięgniesz najpierw?',
  options: ['pandas', 'Spark', 'Hurtownia'],
  cases: [
    {
      setup: 'Klient przysłał plik CSV, 300 MB. Masz jednorazowo sprawdzić jakość danych i policzyć kilka statystyk.',
      correct: 0,
      why: 'pandas. Plik mieści się w pamięci laptopa z dużym zapasem, a wynik masz po kilku linijkach. Spark też by to policzył, ale uruchamianie silnika rozproszonego dla jednego małego pliku niczego nie daje.',
      scope: 'Granica nie jest sztywna. Dokumentacja pandas ostrzega, że kłopoty zaczynają się już przy zbiorach, które zajmują znaczną część pamięci.'
    },
    {
      setup: 'Zamówienia i klienci są już w Snowflake, razem 200 GB. Potrzebny jest dzienny raport przychodu, a wszystkie transformacje dają się zapisać w SQL.',
      correct: 2,
      why: 'Hurtownia. Dane już tam są, SQL wystarcza, a hurtownia sama rozprasza obliczenia. Wyciąganie danych do Sparka oznaczałoby kopiowanie ich i drugi system do utrzymania, bez żadnej korzyści.',
      scope: 'Odpowiedź by się zmieniła, gdyby doszła logika, której nie da się rozsądnie wyrazić w SQL, albo gdyby te same dane miały zasilać streaming lub trenowanie modeli.'
    },
    {
      setup: 'Codziennie do S3 trafia 2 TB logów w JSON. Trzeba je sparsować własną logiką w Pythonie, oczyścić i zapisać jako tabele w otwartym formacie, z których skorzysta kilka narzędzi.',
      correct: 1,
      why: 'Spark. Dane są plikami w storage, jest ich więcej, niż pomieści jedna maszyna, a logika wychodzi poza SQL. Spark czyta pliki tam, gdzie leżą, i rozkłada pracę na executory.',
      scope: 'Hurtownia też potrafi ładować JSON. Spark wygrywa tu przez połączenie trzech rzeczy: skali, własnego kodu i tego, że wynik ma zostać w otwartym formacie w Twoim storage.'
    }
  ] as Scenario[],
  takeaway: '<b>Wniosek.</b> Mało danych i jedna maszyna: pandas. Dane w hurtowni i wystarcza SQL: hurtownia. Dużo plików w storage, własny kod albo streaming i ML na tych samych danych: Spark. Na rozmowie liczy się uzasadnienie, a nie nazwa narzędzia.',
  more: {
    title: 'Gdzie ten podział się zaciera',
    html: [
      'Spark ma <b>pandas API on Spark</b>: składnię pandas wykonywaną na klastrze. Zbiór żyje wtedy na wielu maszynach, więc nie wszystko zachowuje się tak jak w zwykłym pandas.',
      'W drugą stronę: Databricks ma SQL warehouses, czyli zasób obliczeniowy do odpytywania danych w SQL, też napędzany Sparkiem. Snowflake obsługuje z kolei tabele Iceberg, których pliki leżą w zewnętrznym storage.',
      'Dlatego pytanie coraz rzadziej brzmi „Spark czy hurtownia", a coraz częściej „który silnik do którego zadania".'
    ]
  }
};

/**
 * Etap Interview. Pytania, odpowiedzi 30–60 s (PL i EN) oraz follow-upy przychodzą z Interview Banku.
 * Tutaj jest tylko to, czego bank nie ma: jak uczciwie powiedzieć, że przychodzisz ze świata hurtowni.
 */
export const interview = {
  bridgeIntro: 'Jeśli na co dzień pracujesz z hurtownią i dbt, a nie z klastrem Sparka, powiedz to wprost i pokaż, że masz model. Na przykład tak:',
  bridgeEn: '“My background is warehouse-first, so I think of Spark as the same idea with the machinery exposed. In Snowflake I pick a warehouse size and the service decides how the data is split and scheduled. In Spark I can see that layer: a driver that plans, executors that run tasks, one task per partition. So the things I watch are the ones a warehouse hides from me: partition counts, executor sizing, and what I pull back to the driver.”',
  bridgePl: 'Po polsku: przychodzę ze świata hurtowni, więc myślę o Sparku jak o tej samej idei z odsłoniętą maszynerią. W Snowflake wybieram rozmiar warehouse, a usługa decyduje o podziale danych i kolejności pracy. W Sparku widzę tę warstwę: driver planuje, executory wykonują taski, jeden task na partycję. Pilnuję więc tego, co hurtownia przede mną ukrywa: liczby partycji, rozmiaru executorów i tego, co ściągam do drivera.'
};

export interface QuizItem { q: string; setup?: string; options: string[]; correct: number; why: string }
/** Etap Sprawdź się: pięć krótkich pytań. Każde podaje założenia, jeśli wynik od nich zależy. */
export const quiz: QuizItem[] = [
  {
    q: 'Klaster ma 8 executorów po 4 rdzenie. DataFrame ma 4 partycje. Ile tasków najwyżej liczy filtr jednocześnie?',
    setup: 'Założenia: jeden etap bez przegrupowania danych, jeden rdzeń liczy jeden task naraz.',
    options: ['4', '8', '32'],
    correct: 0,
    why: 'Cztery. Jeden task liczy jedną partycję, więc tasków jest 4, a 28 rdzeni nie ma nic do roboty. Liczba partycji wyznacza liczbę tasków, a liczba rdzeni to, ile z nich działa naraz.'
  },
  {
    q: 'Co robi driver w zapytaniu, które czyta pliki, filtruje je i zapisuje wynik?',
    options: ['Czyta i filtruje każdą partycję po kolei', 'Układa plan, dzieli go na taski i rozdziela je executorom', 'Przydziela maszyny wszystkim aplikacjom na klastrze'],
    correct: 1,
    why: 'Driver planuje i rozdziela pracę, a partycje liczą executory. Maszyny przydziela menedżer klastra, czyli osobna usługa. Driver zaczyna dotykać wierszy dopiero wtedy, gdy każesz mu zebrać wynik u siebie.'
  },
  {
    q: 'Wynik zapytania ma 300 GB. Wywołujesz <code>collect()</code>. Co jest głównym ryzykiem?',
    options: ['Executory policzą wszystko dwa razy', 'Wszystkie wiersze trafią do drivera, a to jeden proces z ograniczoną pamięcią', 'Spark zmniejszy liczbę partycji do jednej'],
    correct: 1,
    why: '<code>collect()</code> ściąga cały wynik do drivera. W Apache Spark job zostanie przerwany, gdy wyniki przekroczą <code>spark.driver.maxResultSize</code> (domyślnie 1 GB), a przy podniesionym limicie grozi brak pamięci. Tak duży wynik zapisuje się do storage.'
  },
  {
    q: 'Uruchamiasz PySpark na laptopie z ustawieniem <code>local[4]</code>. Ile osobnych procesów executorów działa?',
    options: ['4', '1', '0'],
    correct: 2,
    why: 'Zero. Tryb lokalny to jeden proces z czterema wątkami roboczymi. Zasada „jeden task na partycję" działa tak samo, ale nie ma sieci ani osobnych maszyn, więc części zachowań klastra tu nie zobaczysz.'
  },
  {
    q: 'Przenosisz job napisany w PySparku z własnego klastra na Databricks. Co się zmienia?',
    options: ['Trzeba go przepisać, bo Databricks ma własny język', 'Głównie to, kto uruchamia i utrzymuje klaster. API zostaje, ale wartości domyślne i dostępne funkcje mogą być inne', 'Nic, bo Databricks to inna nazwa Apache Spark'],
    correct: 1,
    why: 'Databricks to platforma zbudowana na Apache Spark. Kod PySpark w dużej mierze się przenosi, ale środowisko nie jest identyczne: ma własne wartości domyślne i silnik Photon, a serverless udostępnia tylko API Spark Connect.'
  }
];

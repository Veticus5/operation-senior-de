import type { Bridge, ExplainedLine, LessonMeta } from '../../types';

/**
 * Lekcja 10: Snowflake Architecture & Performance Engineering. Dla kogoś, kto używa Snowflake na co dzień,
 * a na rozmowie ma wytłumaczyć mechanizm: trzy warstwy, mikropartycje i pruning, cache, skalowanie,
 * koszty oraz funkcje produkcyjne (Streams & Tasks, Time Travel, klony, sharing, RBAC).
 *
 * Fragmenty narracyjne są w HTML (dozwolone znaczniki: lib/richText.ts) i mogą używać
 * <term id="...">, czyli haseł z content/glossary.ts.
 *
 * Skąd są fakty: oficjalna dokumentacja Snowflake, sprawdzona 2026-11-27 i spisana w docs/verified-facts.md,
 * sekcja „Lekcja 10". Repozytorium nie ma konta Snowflake, więc w tej lekcji NIE MA pomiarów ani labu.
 * Wszystkie symulacje i tabele z liczbami (layers, prune, cache, profiles, scale, coverage, stream, clone)
 * są ilustracjami: liczby są dobrane tak, żeby mechanizm było widać. Liczby z dokumentacji są podpisane.
 * Studium przypadku podaje tylko trzy liczby z prawdziwego projektu (96 godzin, 128 i 30 minut) i celowo
 * nie podaje konfiguracji ani oszczędności.
 * Pytania rekrutacyjne, krótkie odpowiedzi i follow-upy nie są tu powtórzone: lekcja bierze je z Interview Banku.
 */
export const meta: LessonMeta = {
  id: 'snowflake-architecture-performance',
  topicId: 'snowflake.architecture',
  area: 'snowflake',
  title: 'Snowflake Architecture & Performance Engineering',
  subtitle: 'Co dzieje się pod spodem, gdy uruchamiasz zapytanie: trzy warstwy, mikropartycje, cache i skalowanie. Oraz jak z tego wynikają koszty, diagnoza wolnych zapytań i funkcje produkcyjne.',
  minutes: 60
};

/** Zagadnienia z Interview Banku ćwiczone w etapie Interview, w tej kolejności. */
export const interviewTopics = [
  'snowflake.architecture', 'snowflake.pruning', 'snowflake.clustering', 'snowflake.caching', 'snowflake.scaling',
  'snowflake.query-profile', 'snowflake.cost', 'snowflake.streams-tasks', 'snowflake.time-travel', 'snowflake.access-control'
];

export const DOCS_BADGE = 'Dokumentacja Snowflake · sprawdzone 2026-11-27';

/** Krok etapu Intuicja. `visual` wstawia ilustrację między `html` a `after`. */
export interface Beat {
  html: string;
  visual?: 'layers';
  after?: string;
  next: string;
  bridge?: Bridge;
  more?: { title: string; html: string[] };
}

export const beats: Beat[] = [
  {
    html: '<h1>Jedno zapytanie trwa 3 sekundy. Prawie takie samo: 9 minut.</h1>\n<p class="lede">Ta sama tabela zamówień, ten sam warehouse, ten sam dzień. Pierwsze zapytanie filtruje po dacie, drugie po kliencie.</p>\n<p>Snowflake używasz od lat, więc wiesz, <i>że</i> tak bywa. Na rozmowie trzeba jeszcze powiedzieć, <i>dlaczego</i>. Zacznij od pytania, którego w codziennej pracy raczej się nie zadaje: <b>która część Snowflake wykonuje który kawałek zapytania?</b> Wybierz operację i zobacz.</p>',
    visual: 'layers',
    after: '<b>Wniosek.</b> Snowflake składa się z trzech warstw. <b>Cloud services</b> planuje zapytanie i pilnuje uprawnień. <b>Compute</b>, czyli warehouse, liczy. <b>Database storage</b> przechowuje dane. Nie każda operacja potrzebuje wszystkich trzech. O tym, ile pracy dostanie warehouse, decyduje wcześniej warstwa cloud services. Robi to na podstawie metadanych, czyli zapisanych informacji o danych.',
    more: {
      title: 'Co dokładnie jest w każdej warstwie',
      html: [
        '<b>Database storage.</b> Po załadowaniu Snowflake przepisuje dane na własny format: skompresowany i kolumnowy. Leżą w <term id="object-storage">object storage</term> dostawcy chmury. Dotyczy to zwykłych tabel Snowflake. Tabele Iceberg trzymają dane w storage zewnętrznym.',
        '<b>Compute.</b> Virtual warehouse to według dokumentacji niezależny klaster. Nie dzieli zasobów obliczeniowych z innymi warehouse\'ami, więc jeden nie wpływa na wydajność drugiego.',
        '<b>Cloud services.</b> Dokumentacja wymienia: bezpieczeństwo, uwierzytelnianie i kontrolę dostępu, Horizon Catalog, zarządzanie infrastrukturą, zarządzanie metadanymi, parsowanie i optymalizację zapytań oraz zgodność z regulacjami.',
        'Dokumentacja nazywa całość hybrydą dwóch architektur. Z <b>shared-disk</b> pochodzi jedno centralne miejsce na dane, dostępne dla wszystkich węzłów. Z <b>shared-nothing</b> pochodzi sposób liczenia: zapytanie wykonuje klaster, w którym każdy węzeł pracuje na swojej części danych.'
      ]
    },
    next: 'Co z tego wynika w praktyce?'
  },
  {
    html: '<h2>Storage i compute to dwa osobne zasoby</h2>\n<p>W klasycznej hurtowni <term id="mpp">MPP</term> dane leżą na dyskach tych samych węzłów, które liczą. Chcesz więcej mocy? Dokładasz węzły i przenosisz dane. Wyłączasz klaster? Dane są niedostępne.</p>\n<p>W Snowflake dane leżą raz, w warstwie storage. Warehouse\'ów może być dowolnie wiele i każdy czyta tę samą kopię. Stąd trzy rzeczy, które w pracy uważasz za oczywiste:</p>\n<ul><li><b>Zespoły nie przeszkadzają sobie nawzajem.</b> ELT, BI i analizy ad hoc na osobnych warehouse\'ach nie odbierają sobie zasobów. To <b>izolacja obciążeń</b> (workload isolation).</li><li><b>Moc zmieniasz bez ruszania danych.</b> Zmiana rozmiaru warehouse\'u niczego nie przenosi.</li><li><b>Płacisz osobno.</b> Wstrzymany warehouse nie zużywa <term id="snowflake-credit">kredytów</term>, a dane dalej są w storage.</li></ul>\n<p>Jest też cena. Warehouse nie ma danych u siebie. Musi je pobrać z <term id="object-storage">object storage</term>. Dlatego reszta lekcji krąży wokół dwóch pytań. <b>Jak przeczytać mniej?</b> I: <b>jak nie czytać drugi raz tego samego?</b></p>',
    more: {
      title: 'Rzeczy, które dzieją się bez Twojego warehouse\'u',
      html: [
        'Obok warehouse\'ów jest <b>compute serverless</b>: zasoby, którymi zarządza Snowflake. Korzystają z nich m.in. Snowpipe, automatic clustering, utrzymanie materialized views, search optimization, query acceleration i zadania serverless. Każda funkcja ma osobną pozycję na rachunku.',
        'Warstwa cloud services też zużywa kredyty. Jest doliczana tylko wtedy, gdy jej dzienne zużycie przekroczy 10% dziennego zużycia warehouse\'ów.',
        'Te dwie pozycje wrócą w części o kosztach: narzędzie, które pilnuje warehouse\'ów, nie widzi serverless.'
      ]
    },
    next: 'Zobacz, jak Snowflake czyta mniej',
    bridge: {
      from: 'klasyczna baza MPP',
      known: 'W architekturze shared-nothing każdy węzeł ma własny dysk i własny fragment danych. Moc i pojemność rosną razem. Zmiana rozmiaru klastra oznacza przenoszenie danych między węzłami.',
      fresh: 'Dane są w jednym miejscu, a klastry obliczeniowe można wymieniać. Tworzysz je, powiększasz i wstrzymujesz bez dotykania danych. Kilka klastrów czyta te same tabele jednocześnie.',
      breaks: 'W shared-nothing dane leżą fizycznie przy procesorze, więc odczyt jest lokalny. W Snowflake lokalny jest tylko cache warehouse\'u, który znika przy wstrzymaniu. Wydajność zależy więc od tego, ile danych trzeba pobrać z object storage.'
    }
  }
];

export interface LayerOp {
  id: string;
  label: string;
  sql: string;
  /** Co robi każda warstwa. Pusty tekst oznacza, że warstwa nie bierze udziału. */
  services: string;
  compute: string;
  storage: string;
  verdict: string;
}
/** Etap Intuicja: interaktywna architektura. Ilustracja uproszczona, role warstw według dokumentacji. */
export const layers = {
  caption: 'Ilustracja: uproszczony podział pracy między warstwy. Nazwy i role warstw pochodzą z dokumentacji.',
  names: {
    services: { name: 'Cloud services', role: 'planuje, sprawdza uprawnienia, trzyma metadane' },
    compute: { name: 'Compute · virtual warehouse', role: 'wykonuje zapytanie' },
    storage: { name: 'Database storage', role: 'przechowuje mikropartycje' }
  },
  idle: 'nie bierze udziału',
  defaultOp: 'date',
  ops: [
    {
      id: 'date', label: 'Filtr po dacie',
      sql: "SELECT SUM(amount) FROM orders\nWHERE order_date = '2026-01-14'",
      services: 'Sprawdza uprawnienia roli, kompiluje zapytanie i porównuje filtr z zakresami dat w metadanych. Wybiera kilka fragmentów tabeli, które mogą zawierać ten dzień.',
      compute: 'Czyta tylko wskazane fragmenty, i w nich tylko kolumny order_date oraz amount. Sumuje.',
      storage: 'Oddaje kilka plików z tysięcy.',
      verdict: 'Większość pracy wykonały metadane. Warehouse dostał mało do przeczytania. To zapytanie z 3 sekund.'
    },
    {
      id: 'cust', label: 'Filtr po kliencie',
      sql: 'SELECT SUM(amount) FROM orders\nWHERE customer_id = 4217',
      services: 'Kompiluje zapytanie i porównuje filtr z metadanymi. Zamówienia klienta 4217 są rozsiane po całej historii, więc żadnego fragmentu nie da się wykluczyć.',
      compute: 'Czyta wszystkie fragmenty tabeli (kolumny customer_id i amount), filtruje wiersz po wierszu, sumuje.',
      storage: 'Oddaje wszystkie pliki tabeli.',
      verdict: 'SQL wygląda prawie tak samo, ale metadane nie pomogły. To zapytanie z 9 minut. Dlaczego tak jest, pokazuje etap Mechanizm.'
    },
    {
      id: 'repeat', label: 'To samo zapytanie drugi raz',
      sql: "SELECT SUM(amount) FROM orders\nWHERE order_date = '2026-01-14'",
      services: 'Znajduje zapisany wynik identycznego zapytania. Dane się nie zmieniły, rola ma uprawnienia, więc oddaje wynik bez wykonywania zapytania.',
      compute: '',
      storage: '',
      verdict: 'Wynik przyszedł z result cache. To nie jest szybkie zapytanie, tylko zapytanie, którego nie wykonano.'
    },
    {
      id: 'meta', label: 'Usunięcie wszystkich wierszy',
      sql: 'DELETE FROM staging_orders',
      services: 'Oznacza wszystkie fragmenty tabeli jako nieaktualne. Dokumentacja podaje usunięcie wszystkich wierszy jako przykład operacji wykonywanej na samych metadanych.',
      compute: '',
      storage: 'Stare pliki zostają jeszcze przez okres Time Travel i Fail-safe.',
      verdict: 'Operacja na metadanych: nie trzeba czytać ani przepisywać danych.'
    },
    {
      id: 'join', label: 'Duży join z agregacją',
      sql: 'SELECT c.segment, SUM(o.amount)\nFROM orders o JOIN customers c USING (customer_id)\nGROUP BY c.segment',
      services: 'Kompiluje zapytanie i wybiera plan: kolejność i sposób łączenia tabel. Nie ma filtra, więc nie ma czego wykluczać.',
      compute: 'Czyta obie tabele, łączy i grupuje w pamięci. Jeśli pamięci zabraknie, zapisuje dane pośrednie na dysk.',
      storage: 'Oddaje wszystkie pliki obu tabel (tylko potrzebne kolumny).',
      verdict: 'Tu pracuje głównie warehouse. O czasie decyduje jego rozmiar i to, czy operacja mieści się w pamięci.'
    }
  ] as LayerOp[]
};

export interface MicroPartition { date: [number, number]; cust: [number, number] }
export interface PruneLayout { id: string; label: string; note: string; parts: MicroPartition[] }
export interface PruneFilter {
  id: string;
  label: string;
  sql: string;
  /** Kolumna i zakres filtra. `null` oznacza predykat, którego nie da się użyć do pruningu. */
  column: 'date' | 'cust' | null;
  range: [number, number];
  why: string;
}
const wideCust: [number, number][] = [[12, 9987], [5, 9990], [31, 9968], [8, 9993], [19, 9979], [3, 9995], [27, 9984], [14, 9991]];
const allDays: [number, number] = [1, 24];
/**
 * Etap Mechanizm, część 1: symulacja pruningu. Osiem mikropartycji tabeli zamówień ze stycznia 2026,
 * każda z zakresem dat (dzień miesiąca) i zakresem customer_id. Wszystko wymyślone.
 */
export const prune = {
  question: 'Których mikropartycji nie trzeba otwierać?',
  intro: [
    'Snowflake sam tnie każdą tabelę na <b>mikropartycje</b>. Mikropartycja to porcja wierszy zapisana jako jedna całość, w kolejności ładowania. Dokumentacja podaje rozmiar od 50 do 500 MB danych przed kompresją. Tabela na terabajty ma ich setki tysięcy.',
    'Dla każdej mikropartycji warstwa cloud services pamięta m.in. <b>najmniejszą i największą wartość każdej kolumny</b>. Poniżej osiem mikropartycji tabeli zamówień. Wybierz filtr i ułożenie danych. Potem sprawdź, w których mikropartycjach szukanych wierszy na pewno nie ma.'
  ],
  assumptions: 'Model uproszczony: 8 mikropartycji zamiast setek tysięcy, zamówienia z 1–24 stycznia 2026, klienci o numerach 1–10 000. Mikropartycję można pominąć, gdy zakres filtra nie ma części wspólnej z jej zakresem min–max.',
  layoutLabel: 'Ułożenie danych',
  filterLabel: 'Filtr',
  defaultLayout: 'load',
  defaultFilter: 'day',
  layouts: [
    {
      id: 'load', label: 'Ładowane dzień po dniu',
      note: 'Każda mikropartycja zawiera trzy kolejne dni, bo dane przychodziły chronologicznie. Klienci są w każdej z nich wymieszani.',
      parts: wideCust.map((cust, i) => ({ date: [i * 3 + 1, i * 3 + 3] as [number, number], cust }))
    },
    {
      id: 'churn', label: 'Po backfillach i poprawkach',
      note: 'Dogrywanie zaległych danych i poprawki zapisały nowe mikropartycje z dniami z różnych okresów. Zakresy dat zaczęły się nakładać.',
      parts: ([[1, 3], [2, 9], [4, 6], [5, 14], [10, 12], [13, 15], [12, 21], [19, 24]] as [number, number][]).map((date, i) => ({ date, cust: wideCust[i] }))
    },
    {
      id: 'clustered', label: 'Klastrowane po customer_id',
      note: 'Dane zostały uporządkowane po kliencie. Teraz to zakresy customer_id są rozłączne, a każda mikropartycja zawiera wszystkie dni.',
      parts: Array.from({ length: 8 }, (_, i) => ({ date: allDays, cust: [i * 1250 + 1, (i + 1) * 1250] as [number, number] }))
    }
  ] as PruneLayout[],
  filters: [
    { id: 'day', label: 'Jeden dzień', sql: "WHERE order_date = '2026-01-14'", column: 'date', range: [14, 14], why: 'Filtr po jednej wartości. Mikropartycja zostaje tylko wtedy, gdy 14 stycznia mieści się między jej min a max.' },
    { id: 'range', label: 'Sześć dni', sql: "WHERE order_date BETWEEN '2026-01-10' AND '2026-01-15'", column: 'date', range: [10, 15], why: 'Filtr po zakresie. Mikropartycja zostaje, gdy jej zakres dat ma choć jeden wspólny dzień z 10–15 stycznia.' },
    { id: 'cust', label: 'Jeden klient', sql: 'WHERE customer_id = 4217', column: 'cust', range: [4217, 4217], why: 'Liczy się zakres customer_id. Jeśli 4217 mieści się między min a max, mikropartycji nie da się wykluczyć, nawet gdy tego klienta w niej nie ma.' },
    { id: 'sub', label: 'Data z podzapytania', sql: 'WHERE order_date = (SELECT MAX(order_date) FROM orders)', column: null, range: [0, 0], why: 'Dokumentacja mówi wprost: Snowflake nie pomija mikropartycji na podstawie warunku z podzapytaniem, nawet gdy podzapytanie daje stałą. Wszystkie zostają do przeczytania.' }
  ] as PruneFilter[],
  takeaway: [
    '<b>Wniosek.</b> Snowflake pomija mikropartycje na podstawie metadanych, zanim warehouse cokolwiek przeczyta. To <b>partition pruning</b>. Sam filtr nie wystarczy. Liczy się to, jak wartości kolumny z filtra są rozłożone po mikropartycjach. Dlatego filtr po dacie trwał 3 sekundy, a filtr po kliencie 9 minut.',
    'W prawdziwym zapytaniu widać to w Query Profile jako <b>Partitions scanned</b> i <b>Partitions total</b>. Zakres min–max mówi tylko „tu może coś być". Przeczytana mikropartycja wcale nie musi zwrócić wierszy.'
  ],
  notesTitle: 'Co tu jest uproszczeniem',
  notes: [
    'To animacja w JavaScripcie, a nie Snowflake. Reguła „zakresy się przecinają albo nie" jest uproszczonym modelem pruningu po min–max.',
    'Snowflake przechowuje więcej metadanych niż min i max. Dokumentacja wymienia też liczbę różnych wartości i „dodatkowe własności" używane do optymalizacji. Lista jest podana jako niepełna.',
    'Nie każdy warunek w WHERE (predicate) pozwala pomijać mikropartycje. Dokumentacja mówi ogólnie, że nie wszystkie wyrażenia się do tego nadają, a wprost wymienia podzapytania. Jeśli filtr nic nie wycina, sprawdź to w Query Profile, zamiast zgadywać.',
    'Wzorzec z dokumentacji: filtr, który wybiera 10% wartości, powinien w idealnym przypadku skanować około 10% mikropartycji. To cel, nie gwarancja.'
  ],
  columnarTitle: 'Kolumnowy zapis i kompresja: druga oszczędność',
  columnar: [
    'W mikropartycji każda kolumna jest zapisana osobno. Zapytanie, które używa dwóch kolumn z pięćdziesięciu, czyta z przeskanowanych mikropartycji tylko te dwie. Oszczędności są więc dwie. Pruning zmniejsza liczbę czytanych mikropartycji. Zapis kolumnowy zmniejsza to, co czyta się w każdej z nich.',
    'Każda kolumna jest też kompresowana osobno. Snowflake sam dobiera algorytm dla każdej kolumny w każdej mikropartycji. Wartości jednej kolumny są do siebie podobne, więc kompresują się dobrze.',
    'Skutek uboczny: <code>SELECT *</code> na szerokiej tabeli czyta wszystkie kolumny, nawet jeśli potrzebujesz trzech. Koszt storage liczy się od danych po kompresji.'
  ],
  dmlTitle: 'Co się dzieje przy UPDATE i DELETE',
  dml: [
    'Snowflake nie poprawia mikropartycji w miejscu. Zmiana wiersza zapisuje nową mikropartycję z nową wersją danych. Stara przestaje należeć do bieżącej wersji tabeli. To wiedza ogólna o Snowflake. Dokumentacja opisuje to wprost przy reclusteringu: oryginalne mikropartycje są oznaczane jako usunięte, ale zostają na potrzeby Time Travel i Fail-safe.',
    'Dlatego częste zmiany w dużej tabeli mają dwa skutki. Rośnie storage ze starymi wersjami danych. Psuje się też naturalne uporządkowanie, dzięki któremu działał pruning. Ułożenie „Po backfillach i poprawkach" w symulacji pokazuje właśnie to.',
    'Z tego samego mechanizmu wynikają Time Travel i zero-copy cloning, do których lekcja dojdzie w etapie Koszt i produkcja.'
  ],
  bridgeTitle: 'Analogia: row groups w Parquet',
  bridge: {
    from: 'Spark i Parquet',
    known: 'Plik Parquet dzieli wiersze na row groups i może przechowywać min i max każdej kolumny dla każdej grupy. Czytnik pomija grupy, w których według statystyk szukanych wierszy nie ma.',
    fresh: 'Mikropartycja pełni podobną rolę. To porcja wierszy ze statystykami kolumn, którą można pominąć bez czytania. Zasada też jest ta sama: posortowane dane da się dobrze pomijać, rozrzuconych wcale.',
    breaks: 'W Sparku statystyki są w stopkach plików, a o formacie, rozmiarze plików i partycjonowaniu decydujesz sam. W Snowflake metadane są w warstwie cloud services i służą do pruningu już przy kompilacji zapytania. Mikropartycji nie definiujesz i nie widzisz ich w zapytaniu.'
  } as Bridge
};

/** Etap Mechanizm, część 2: clustering. Reguły z dokumentacji, przykłady wymyślone. */
export const clustering = {
  title: 'Clustering: gdy naturalne ułożenie nie wystarcza',
  intro: [
    'W symulacji ułożenie „Klastrowane po customer_id" naprawiło filtr po kliencie. Tak działa <b>clustering key</b>. Wskazujesz kolumny, po których Snowflake ma utrzymywać dane w porządku. Usługa <b>Automatic Clustering</b> przepisuje potem w tle mikropartycje tak, żeby ich zakresy przestały się nakładać.',
    'To, jak mocno zakresy się nakładają, opisuje <b>clustering depth</b>: średnia głębokość nakładających się mikropartycji dla wskazanych kolumn. Im mniejsza, tym lepiej. W symulacji po backfillach filtr na 14 stycznia trafiał w trzy mikropartycje zamiast w jedną. To właśnie większa głębokość.',
    'Usługa kosztuje. Pytanie nie brzmi więc „czy to pomaga", tylko „czy tu się opłaca". Poniżej trzy sytuacje. Zdecyduj, zanim przeczytasz uzasadnienie.'
  ],
  ask: 'Clustering key na tej tabeli:',
  cases: [
    {
      setup: 'Tabela zdarzeń, 4 TB, dopisywana raz na dobę, bez zmian wstecz. Prawie wszystkie zapytania filtrują po tenant_id i zakresie dat. Query Profile pokazuje, że zapytania o jednego tenanta skanują ponad 90% mikropartycji.',
      options: ['Opłaca się rozważyć', 'To strata kredytów'],
      correct: 0,
      why: 'Spełnione są kryteria z dokumentacji. Tabela ma bardzo dużo mikropartycji (zwykle oznacza to wiele terabajtów). Większość zapytań filtruje po tych samych kolumnach i wybiera mały ułamek wierszy. Tabela jest często czytana i rzadko zmieniana. Klucz po tenant_id i dacie powinien ograniczyć skan do mikropartycji jednego tenanta.',
      scope: 'To kandydat, nie pewnik. Po włączeniu porównaj Partitions scanned i czas zapytań oraz koszt usługi dla tej tabeli. Dokumentacja mówi, że najlepszym wskaźnikiem jest wydajność zapytań, a nie sama clustering depth.'
    },
    {
      setup: 'Tabela słownikowa produktów, 300 MB, aktualizowana kilka razy dziennie. Zapytania łączą ją z tabelą faktów po product_id.',
      options: ['Opłaca się rozważyć', 'To strata kredytów'],
      correct: 1,
      why: 'Przy 300 MB tabela ma kilka mikropartycji, więc nie ma czego pomijać. Przeczytanie całości jest tanie. Dokumentacja mówi, że clustering nie jest przeznaczony dla wszystkich tabel ze względu na koszty, i wskazuje tabele z dużą liczbą mikropartycji.',
      scope: 'Tu rozstrzyga rozmiar. Gdyby ta tabela miała terabajty, pytanie wróciłoby do tego, jak często jest zmieniana.'
    },
    {
      setup: 'Tabela stanów zamówień, 2 TB. Proces co 5 minut robi MERGE, który zmienia wiersze rozsiane po całej tabeli. Ktoś proponuje clustering key po order_id, bo „po nim się szuka".',
      options: ['Opłaca się rozważyć', 'To strata kredytów'],
      correct: 1,
      why: 'Dwa problemy naraz. Tabela zmienia się bez przerwy, więc usługa stale porządkuje dane, a przepisane mikropartycje zostają w Time Travel i Fail-safe. Dokumentacja mówi, że clustering opłaca się najbardziej na tabelach często czytanych i rzadko zmienianych. Do tego order_id ma bardzo wysoką kardynalność (cardinality), czyli bardzo wiele różnych wartości. Taka kolumna według dokumentacji zwykle nie jest dobrym kluczem wprost.',
      scope: 'Do wyszukiwania pojedynczych wierszy w dużej tabeli dokumentacja opisuje osobną usługę: search optimization (edycja Enterprise, własny koszt storage i compute). To inny mechanizm niż clustering i też trzeba policzyć, czy się opłaca.'
    }
  ] as Scenario[],
  takeaway: '<b>Wniosek.</b> Clustering to wymiana. Płacisz za utrzymywanie porządku w tle, żeby zapytania czytały mniej. Opłaca się na dużej tabeli, która jest często czytana i rzadko zmieniana, a zapytania filtrują ją po tych samych kolumnach i wybierają mały ułamek wierszy. Na małej albo ciągle przepisywanej tabeli kupujesz porządek, z którego nikt nie korzysta.',
  keyTitle: 'Jak wybrać klucz i jak sprawdzić stan',
  key: [
    'Dokumentacja zaleca dla większości tabel najwyżej 3–4 kolumny lub wyrażenia w kluczu. Kolejność: od najniższej do najwyższej kardynalności, czyli od kolumny z najmniejszą liczbą różnych wartości.',
    'Kolumna o bardzo niskiej kardynalności (np. flaga) daje minimalny pruning. Kolumna o bardzo wysokiej (np. znacznik czasu) zwykle nie nadaje się wprost. Dokumentacja proponuje wtedy wyrażenie, np. <code>to_date(c_timestamp)</code>.',
    'Stan uporządkowania pokazuje <code>SELECT SYSTEM$CLUSTERING_INFORMATION(\'orders\', \'(order_date)\')</code>. Zwraca m.in. liczbę mikropartycji, średnią liczbę nakładań i średnią głębokość.',
    'Clustering depth nie jest miarą absolutną. Dokumentacja mówi, że nie pokazuje precyzyjnie, czy tabela jest dobrze sklastrowana. Najlepiej ocenia to wydajność zapytań.'
  ],
  costTitle: 'Ile kosztuje Automatic Clustering',
  cost: [
    'Usługa działa w tle i nie używa Twojego warehouse\'u. Nie blokuje instrukcji zmieniających dane (DML). Można ją wstrzymać i wznowić: <code>ALTER TABLE t SUSPEND RECLUSTER</code> i <code>RESUME RECLUSTER</code>.',
    'Reclustering zużywa kredyty. Oryginalne mikropartycje są oznaczane jako usunięte, ale zostają na potrzeby Time Travel i Fail-safe. Według dokumentacji zwykle podnosi to koszt storage.',
    'Sposób rozliczania zależy od wersji usługi. Dokumentacja opisuje dwie. Clustering Classic jest rozliczany za compute serverless. Optima Clustering jest rozliczany od ilości załadowanych danych. Według dokumentacji tabele klastrowane od 1 września 2026 używają Optima, a wcześniejsze zostają na Classic. Przed decyzją sprawdź, która wersja dotyczy Twojej tabeli.',
    'Tańsza alternatywa dla tabel, do których głównie się dopisuje: sortowanie przy ładowaniu (<code>ORDER BY</code> w instrukcji ładującej). Daje dobre ułożenie na starcie, ale po późniejszych zmianach nikt go nie utrzyma. To praktyka, a nie cytat z dokumentacji.'
  ],
  bridgeTitle: 'Analogia: indeks w klasycznej bazie',
  bridge: {
    from: 'klasyczna baza danych',
    known: 'Indeks to osobna struktura, która prowadzi do konkretnych wierszy. Tworzysz go dla kolumn, po których szukasz. Płacisz wolniejszym zapisem i dodatkowym miejscem.',
    fresh: 'Clustering key też przyspiesza filtry po wybranych kolumnach i też kosztuje przy zapisie. Decyzję podejmujesz podobnie: patrzysz, po czym zapytania naprawdę filtrują.',
    breaks: 'Clustering nie tworzy struktury, która wskazuje wiersze. Zmienia fizyczne ułożenie danych, żeby całe mikropartycje dało się pominąć. Tabela ma jeden klucz, a nie wiele indeksów. Clustering nie pomoże też znaleźć pojedynczego wiersza po dowolnej kolumnie.'
  } as Bridge
};

export type CacheAction = 'run' | 'runOther' | 'runVariant' | 'insert' | 'suspend';
/**
 * Etap Mechanizm, część 3: dwa cache. Maszyna stanów w komponencie CacheSim, tu tylko teksty.
 * Reguły według dokumentacji (persisted query results, warehouse cache), czasy nie są pokazywane.
 */
export const cache = {
  title: 'Jak nie czytać drugi raz tego samego',
  intro: 'Zapytanie za drugim razem bywa szybsze z dwóch zupełnie różnych powodów. Wykonuj kolejne kroki i patrz, skąd przychodzi odpowiedź.',
  assumptions: 'Model uproszczony: jeden warehouse, jedna tabela, dwa zapytania. Symulacja pokazuje, skąd pochodzą dane, a nie ile to trwa.',
  queryA: "SELECT SUM(amount) FROM orders WHERE order_date = '2026-01-14'",
  actions: [
    { id: 'run', label: 'Uruchom zapytanie A' },
    { id: 'runVariant', label: 'A małymi literami' },
    { id: 'runOther', label: 'Inne zapytanie, te same dane' },
    { id: 'insert', label: 'INSERT do tabeli' },
    { id: 'suspend', label: 'Wstrzymaj warehouse' }
  ] as { id: CacheAction; label: string }[],
  state: {
    warehouse: ['Warehouse', 'wstrzymany', 'działa'],
    local: ['Cache warehouse\'u', 'pusty', 'dane tabeli na lokalnym dysku'],
    result: ['Result cache', 'brak wyniku A', 'wynik A zapisany']
  },
  start: 'Warehouse jest wstrzymany, oba cache są puste. Uruchom zapytanie A.',
  outcomes: {
    resultHit: { source: 'Result cache', text: 'Identyczny tekst zapytania, dane bez zmian, rola ma uprawnienia. Snowflake pomija wykonanie i oddaje zapisany wynik. Stan warehouse\'u nie ma tu znaczenia.' },
    cold: { source: 'Object storage', text: 'Warehouse startuje (rozliczenie: minimum 60 sekund) i nie ma nic w lokalnym cache. Pobiera mikropartycje z warstwy storage, liczy wynik i zostawia pobrane dane na lokalnym dysku.' },
    remote: { source: 'Object storage', text: 'Warehouse działa, ale tych danych nie ma jeszcze w lokalnym cache. Pobiera je z warstwy storage i zostawia na lokalnym dysku.' },
    localHit: { source: 'Cache warehouse\'u', text: 'Zapytanie trzeba wykonać, ale potrzebne dane tabeli leżą już na lokalnym dysku warehouse\'u. W Query Profile widać to jako „Percentage scanned from cache".' },
    variantNote: 'Tekst różni się wielkością liter, więc result cache nie pasuje. Dokumentacja wymienia wielkość liter i aliasy tabel jako różnice, które blokują ponowne użycie.',
    insert: { source: 'Zmiana danych', text: 'Dane tabeli się zmieniły, więc zapisany wynik A jest nieaktualny. Lokalny cache zostaje. Stare mikropartycje nadal są na dysku, a nowej tam jeszcze nie ma.' },
    insertCold: { source: 'Zmiana danych', text: 'Warehouse startuje, żeby wykonać INSERT (minimum 60 sekund). Zapisany wynik A jest nieaktualny, bo dane tabeli się zmieniły.' },
    suspend: { source: 'Wstrzymanie', text: 'Warehouse przestaje zużywać kredyty. Jego lokalny cache zostaje usunięty. Result cache zostaje, bo nie należy do warehouse\'u.' },
    suspendIdle: { source: 'Wstrzymanie', text: 'Warehouse już jest wstrzymany.' }
  },
  takeaway: [
    '<b>Wniosek.</b> <b>Result cache</b> należy do warstwy cloud services i przechowuje gotowe wyniki. Działa tylko dla identycznego zapytania na niezmienionych danych. <b>Cache warehouse\'u</b> należy do warstwy compute i przechowuje dane tabel. Pomaga także innym zapytaniom, ale znika przy wstrzymaniu.',
    'Dlatego auto-suspend to kompromis, a nie ustawienie „im krócej, tym lepiej". Krótki czas oszczędza kredyty za bezczynność. Ale każdy start to zimny, czyli pusty cache i co najmniej 60 sekund rozliczenia.'
  ],
  rulesTitle: 'Dokładne warunki result cache',
  rules: [
    'Wynik jest przechowywany 24 godziny. Każde ponowne użycie odnawia ten okres, najwyżej do 31 dni od pierwszego wykonania.',
    'Nowe zapytanie musi dokładnie odpowiadać poprzedniemu. Dane tabel nie mogły się zmienić, a mikropartycje też nie, np. przez reclustering.',
    'Zapytanie nie może zawierać funkcji, których wyniku nie da się ponownie użyć. Dokumentacja wymienia <code>UUID_STRING</code>, <code>RANDOM</code> i <code>RANDSTR</code>. Odpadają też funkcje zewnętrzne i zapytania do tabel hybrydowych.',
    'Rola musi mieć uprawnienia do wszystkich użytych tabel. Warunek dotyczy roli, a nie tego, czy to ten sam użytkownik.',
    'Spełnienie wszystkich warunków nie gwarantuje ponownego użycia wyniku. Tak mówi dokumentacja. Mechanizm wyłącza się parametrem sesji <code>USE_CACHED_RESULT = FALSE</code>. Przydaje się to przy mierzeniu wydajności.'
  ],
  suspendTitle: 'Jak ustawić auto-suspend',
  suspend: [
    'Auto-suspend i auto-resume są domyślnie włączone. Dokumentacja zaleca niską wartość auto-suspend, np. 5 albo 10 minut lub mniej, dopasowaną do przerw w obciążeniu.',
    'Dlaczego dopasowaną: każde wznowienie nalicza minimum 60 sekund. Warehouse, który zatrzymuje się i wznawia co chwilę, płaci to minimum za każdym razem i ciągle pracuje na zimnym cache.',
    'Cache jest tym większy, im większy warehouse. Przy zmniejszeniu rozmiaru znika cache zasobów, które zostały usunięte.',
    'Reguła robocza (praktyka, nie cytat): warehouse do zadań wsadowych może zatrzymywać się szybko, bo między przebiegami i tak nie ma ruchu. Warehouse pod dashboardy powinien przetrwać typową przerwę między kliknięciami.'
  ]
};

export interface ProfileStat { name: string; value: string; flag: boolean }
export interface ProfileCase {
  id: string;
  label: string;
  setup: string;
  stats: ProfileStat[];
  options: string[];
  correct: number;
  why: string;
  scope: string;
}
/**
 * Etap Wydajność, część 1: cztery scenariusze diagnozy. Nazwy statystyk i operatorów są z dokumentacji Query Profile,
 * wartości są wymyślone.
 */
export const profiles = {
  title: 'Query Profile: gdzie zniknął czas?',
  intro: [
    'Zapytanie trwa za długo. Zanim zmienisz rozmiar warehouse\'u, ustal, co naprawdę się wydarzyło. <b>Query Profile</b> pokazuje wykonane zapytanie jako drzewo operatorów, czyli kroków wykonania. Przykłady: TableScan (odczyt tabeli), Join, Aggregate (grupowanie) i Sort. Każdy ma swój czas i statystyki. Drzewo czyta się od dołu, od odczytu tabel, w górę do wyniku.',
    'Poniżej cztery zapytania z tym samym objawem. W każdym spójrz na wyróżnione statystyki i wybierz pierwszy krok. Jedno pojęcie na start: gdy operacja nie mieści się w pamięci, warehouse zapisuje dane pośrednie na dysk. To <b>spilling</b>.'
  ],
  assumptions: 'Ilustracja: wartości są wymyślone. Nazwy statystyk i operatorów są takie, jak w dokumentacji Query Profile.',
  ask: 'Twój pierwszy krok:',
  cases: [
    {
      id: 'scan', label: 'Zapytanie 1',
      setup: 'Raport dzienny dla jednego klienta trwa 9 minut. Najdroższy operator to TableScan na tabeli zamówień.',
      stats: [
        { name: 'Partitions scanned', value: '412 380', flag: true },
        { name: 'Partitions total', value: '412 902', flag: true },
        { name: 'Bytes scanned', value: '1,9 TB', flag: false },
        { name: 'Bytes spilled to local storage', value: '0', flag: false }
      ],
      options: ['Zwiększam warehouse o dwa rozmiary', 'Sprawdzam filtr i ułożenie danych względem kolumny z filtra', 'Dodaję LIMIT do zapytania'],
      correct: 1,
      why: 'Zapytanie szuka jednego klienta, a przeczytało prawie wszystkie mikropartycje. Pruning nie zadziałał. Dokumentacja nazywa to „inefficient pruning" i każe porównać Partitions scanned z Partitions total. Większy warehouse przeczyta całą tabelę szybciej, ale nadal całą.',
      scope: 'Dalszy ruch zależy od przyczyny. Warunek, który nie pozwala na pruning, da się przepisać. Jeśli dane nie są uporządkowane po kolumnie z filtra, to pytanie o clustering key i jego koszt.'
    },
    {
      id: 'join', label: 'Zapytanie 2',
      setup: 'Model łączy zamówienia z historią adresów klienta. Wczoraj 4 minuty, dziś ponad godzinę. Najdroższy operator to Join.',
      stats: [
        { name: 'Join: wiersze na wejściu (lewa)', value: '80 mln', flag: false },
        { name: 'Join: wiersze na wejściu (prawa)', value: '2 mln', flag: false },
        { name: 'Join: wiersze na wyjściu', value: '6,4 mld', flag: true },
        { name: 'Bytes spilled to remote storage', value: '310 GB', flag: true }
      ],
      options: ['Zwiększam warehouse, bo jest spilling', 'Sprawdzam warunek joina i duplikaty klucza', 'Dodaję clustering key po kluczu joina'],
      correct: 1,
      why: 'Join oddaje 80 razy więcej wierszy, niż dostał z większej strony. Dokumentacja nazywa to „exploding join": operator oddaje wielokrotnie więcej wierszy, niż dostaje. Spilling jest tu skutkiem, a nie przyczyną. Najczęściej klucz, który miał być unikalny, przestał taki być albo w warunku brakuje kolumny.',
      scope: 'Jeśli mnożenie wierszy jest zamierzone, spilling zostaje jako osobny problem: mniejsze porcje danych albo większy warehouse.'
    },
    {
      id: 'spill', label: 'Zapytanie 3',
      setup: 'Miesięczna agregacja po kilkunastu wymiarach na całej tabeli faktów. Pruning nie ma czego wyciąć, bo zapytanie potrzebuje wszystkich danych. Najdroższe operatory to Aggregate i Sort.',
      stats: [
        { name: 'Partitions scanned', value: '412 902 z 412 902', flag: false },
        { name: 'Aggregate: wiersze wejście → wyjście', value: '9 mld → 1,1 mld', flag: false },
        { name: 'Bytes spilled to local storage', value: '640 GB', flag: true },
        { name: 'Bytes spilled to remote storage', value: '280 GB', flag: true }
      ],
      options: ['Szukam błędu w joinie', 'Testuję większy warehouse albo dzielę pracę na mniejsze porcje', 'Włączam result cache'],
      correct: 1,
      why: 'Pełny skan jest tu uzasadniony, a agregacja nie mnoży wierszy. Problemem jest pamięć. Operacja nie zmieściła się w niej ani na lokalnym dysku, więc część danych pośrednich trafiła do zdalnego storage. Dokumentacja podaje dwie naprawy: większy warehouse albo przetwarzanie danych w mniejszych porcjach.',
      scope: 'To jedyny z czterech przypadków, w którym zmiana rozmiaru jest pierwszym krokiem. Warto ją zmierzyć. Jeśli zdalny spilling zniknie, czas może spaść bardziej niż dwukrotnie.'
    },
    {
      id: 'queue', label: 'Zapytanie 4',
      setup: 'Proste zapytanie pod dashboard: rano trwało 2 sekundy, o 9:00 trwa 3 minuty. Profil wygląda identycznie jak rano.',
      stats: [
        { name: 'Czas wykonania', value: '2 s', flag: false },
        { name: 'Czas w kolejce', value: '2 min 58 s', flag: true },
        { name: 'Partitions scanned', value: '14 z 9 300', flag: false },
        { name: 'Bytes spilled to local storage', value: '0', flag: false }
      ],
      options: ['Przepisuję zapytanie', 'Zwiększam rozmiar warehouse\'u', 'Sprawdzam obciążenie warehouse\'u: kolejka to problem współbieżności'],
      correct: 2,
      why: 'Samo zapytanie jest szybkie. Czekało, bo warehouse nie miał wolnych zasobów. Snowflake ustawia wtedy zapytania w kolejce, aż zasoby się zwolnią. Naprawy z dokumentacji: dodatkowe warehouse\'y i rozdzielenie zapytań albo multi-cluster warehouse. O zmianie rozmiaru dokumentacja mówi, że nie jest przeznaczona do problemów ze współbieżnością (concurrency), czyli z wieloma zapytaniami naraz.',
      scope: 'Czas w kolejce nie jest statystyką operatora w profilu. Widać go w historii zapytań i w obciążeniu warehouse\'u (queued load). Warto też sprawdzić, co o 9:00 zajmuje warehouse. Jedno ciężkie zapytanie ELT na warehouse\'ie BI to problem izolacji, nie skali.'
    }
  ] as ProfileCase[],
  takeaway: '<b>Wniosek.</b> Cztery różne przyczyny, ten sam objaw. Pytaj po kolei. Czy zapytanie czekało? Ile przeczytało? Czy któryś operator mnoży wiersze? Czy operacja zmieściła się w pamięci? Dopiero odpowiedź wskazuje naprawę. Większy warehouse jest właściwą odpowiedzią tylko na jedną z tych przyczyn.',
  listTitle: 'Cztery problemy, które wymienia dokumentacja',
  list: [
    '<b>Eksplodujący join.</b> Operator Join oddaje znacznie więcej wierszy, niż dostaje, często o rzędy wielkości.',
    '<b>UNION bez ALL.</b> W profilu widać operator UnionAll z dodatkowym Aggregate nad nim, który usuwa duplikaty. Jeśli duplikatów nie ma albo nie przeszkadzają, <code>UNION ALL</code> oszczędza tę pracę.',
    '<b>Zapytanie za duże na pamięć.</b> Widoczne jako spilling: najpierw na lokalny dysk, a gdy go zabraknie, do zdalnego storage.',
    '<b>Nieskuteczny pruning.</b> W operatorze TableScan Partitions scanned jest bliskie Partitions total. Dokumentacja dodaje, że pruning pomaga tylko wtedy, gdy filtr rzeczywiście odrzuca znaczną część danych.'
  ],
  timeTitle: 'Na co dzieli się czas w profilu',
  time: [
    '<b>Processing</b>: procesor pracuje nad danymi. <b>Local Disk IO</b>: przetwarzanie czeka na lokalny dysk. <b>Remote Disk IO</b>: przetwarzanie czeka na zdalny dysk. <b>Network Communication</b>: czekanie na przesłanie danych po sieci. <b>Synchronization</b>: koordynacja między procesami. <b>Initialization</b>: przygotowanie do przetwarzania zapytania.',
    'Dużo Remote Disk IO oznacza czytanie z object storage (zimny cache albo ogromny skan) albo zdalny spilling. Statystyka „Percentage scanned from cache" mówi, ile skanu obsłużył lokalny cache warehouse\'u.'
  ],
  codeTitle: 'Zapytania, które systematycznie zrzucają dane na dysk',
  lines: [
    {
      code: 'SELECT query_id, warehouse_size, total_elapsed_time,',
      label: 'Co pokazać',
      text: 'Identyfikator zapytania, rozmiar warehouse\'u i łączny czas. Po <code>query_id</code> otworzysz potem Query Profile konkretnego zapytania.'
    },
    {
      code: '       bytes_spilled_to_local_storage, bytes_spilled_to_remote_storage',
      label: 'Dwa poziomy spillingu',
      text: 'Te same wielkości, które profil pokazuje dla operatora, tutaj zsumowane dla całego zapytania. Zdalny spilling jest ważniejszym sygnałem niż lokalny.'
    },
    {
      code: 'FROM snowflake.account_usage.query_history',
      label: 'Historia zapytań konta',
      text: 'Widok w bazie <code>SNOWFLAKE</code>. Dostęp do niej ma domyślnie tylko rola ACCOUNTADMIN, więc zwykle trzeba go nadać roli do monitoringu.'
    },
    {
      code: 'WHERE bytes_spilled_to_remote_storage > 0',
      label: 'Tylko zapytania ze zdalnym spillingiem',
      text: 'Zaczynasz od najgorszego przypadku. Uwaga z dokumentacji: przy włączonej usłudze Query Acceleration niezerowa wartość tej kolumny może się pojawić także bez prawdziwego problemu z pamięcią.'
    },
    {
      code: 'ORDER BY bytes_spilled_to_remote_storage DESC LIMIT 20;',
      label: 'Najwięksi winowajcy',
      text: 'Dwadzieścia zapytań, od których warto zacząć. Przy każdym pytasz o to samo co w scenariuszach: czy operacja musi być tak duża, czy da się wcześniej ograniczyć dane.'
    }
  ] as ExplainedLine[]
};

export interface ScaleOutcome {
  /** Identyfikator akcji. */
  action: 'none' | 'up' | 'out';
  size: string;
  /** Kredyty na godzinę jednego klastra, według tabeli z dokumentacji (Gen1). */
  rate: number;
  clusters: number;
  /** Minuty do zakończenia całej pracy w modelu. */
  minutes: number;
  /** Paski: ile zapytań działa w kolejnych minutach (współbieżność) albo jeden pasek (ciężkie zapytanie). */
  waves: number[];
  verdict: string;
}
export interface ScaleWorkload { id: string; label: string; setup: string; outcomes: ScaleOutcome[] }
/**
 * Etap Wydajność, część 2: scale up kontra scale out. Model ilustracyjny, kredyty = stawka × klastry × czas.
 * Stawki z tabeli „Credits / hour (Gen1 warehouses)": Medium 4, X-Large 16.
 */
export const scale = {
  title: 'Większy warehouse czy więcej klastrów?',
  intro: 'Moc można dołożyć na dwa sposoby i każdy pasuje do innego problemu. <b>Scale up</b> to większy rozmiar warehouse\'u. <b>Scale out</b> to więcej klastrów tego samego rozmiaru w jednym warehouse\'ie, czyli multi-cluster warehouse. Wybierz obciążenie, a potem reakcję.',
  assumptions: 'Model uproszczony i ilustracyjny: czasy są wymyślone, kredyty to stawka godzinowa × liczba działających klastrów × czas. Pominięte jest minimum 60 sekund. Jeden klaster wykonuje w modelu 8 zapytań naraz (domyślna wartość MAX_CONCURRENCY_LEVEL, która w rzeczywistości nie jest sztywnym limitem).',
  workloadLabel: 'Obciążenie',
  actionLabel: 'Reakcja',
  actions: [
    { id: 'none', label: 'Nic nie zmieniam' },
    { id: 'up', label: 'Scale up: Medium → X-Large' },
    { id: 'out', label: 'Scale out: do 3 klastrów Medium' }
  ] as { id: ScaleOutcome['action']; label: string }[],
  defaultWorkload: 'heavy',
  workloads: [
    {
      id: 'heavy', label: 'Jedno ciężkie zapytanie',
      setup: 'Nocna agregacja całej tabeli faktów. Na warehouse\'ie Medium nie mieści się w pamięci i zrzuca dane do zdalnego storage.',
      outcomes: [
        { action: 'none', size: 'Medium', rate: 4, clusters: 1, minutes: 60, waves: [1], verdict: 'Zapytanie kończy się po godzinie. Dużą część tego czasu zajmuje zapis i odczyt danych pośrednich ze zdalnego storage.' },
        { action: 'up', size: 'X-Large', rate: 16, clusters: 1, minutes: 10, waves: [1], verdict: 'Cztery razy wyższa stawka, ale w tym modelu zapytanie mieści się w pamięci i kończy się sześć razy szybciej. Wyszło szybciej i taniej, bo zniknął zdalny spilling. Bez tego efektu czas spadłby mniej więcej czterokrotnie, a koszt zostałby ten sam.' },
        { action: 'out', size: 'Medium', rate: 4, clusters: 1, minutes: 60, waves: [1], verdict: 'Nic się nie zmienia. Jedno zapytanie działa na jednym klastrze, a w trybie auto-scale dodatkowe klastry nie startują, bo nic nie czeka w kolejce.' }
      ]
    },
    {
      id: 'many', label: '24 krótkie zapytania naraz',
      setup: 'Poniedziałek, 9:00: dashboardy wysyłają jednocześnie 24 zapytania. Każde z osobna trwa minutę na warehouse\'ie Medium.',
      outcomes: [
        { action: 'none', size: 'Medium', rate: 4, clusters: 1, minutes: 3, waves: [8, 8, 8], verdict: 'Osiem zapytań działa, szesnaście czeka. Ostatnia ósemka dostaje wynik po 3 minutach, choć samo zapytanie trwa minutę.' },
        { action: 'up', size: 'X-Large', rate: 16, clusters: 1, minutes: 3, waves: [8, 8, 8], verdict: 'W tym modelu krótkie zapytanie nie przyspiesza na większym warehouse\'ie, a naraz nadal działa osiem. Kolejka zostaje, koszt rośnie czterokrotnie. Dokumentacja mówi, że resize daje tylko ograniczoną poprawę współbieżności i nie do tego służy.' },
        { action: 'out', size: 'Medium', rate: 4, clusters: 3, minutes: 1, waves: [24], verdict: 'Startują dwa dodatkowe klastry i wszystkie 24 zapytania działają naraz. Wynik po minucie. Trzy klastry przez minutę kosztują tyle, co jeden przez trzy minuty.' }
      ]
    }
  ] as ScaleWorkload[],
  takeaway: [
    '<b>Wniosek.</b> Scale up pomaga jednemu dużemu zapytaniu, bo daje mu więcej pamięci i procesora. Scale out pomaga, gdy zapytań jest wiele naraz, bo likwiduje kolejkę. Użyte na odwrót nie robią nic albo tylko podnoszą rachunek.',
    'Rozliczenie jest sekundowe, więc liczy się stawka razy czas. Dwa razy większy warehouse, który kończy w połowę czasu, kosztuje tyle samo. Dlatego „większy = droższy" nie zawsze jest prawdą. Trzeba to zmierzyć na swoim obciążeniu.'
  ],
  notesTitle: 'Co tu jest uproszczeniem',
  notes: [
    'Czasy są wymyślone. Dokumentacja mówi, że zapytania skalują się liniowo z rozmiarem warehouse\'u „w większości", zwłaszcza duże i złożone. Mówi też, że większy warehouse niekoniecznie przyspieszy małe, proste zapytania.',
    'MAX_CONCURRENCY_LEVEL ma wartość domyślną 8, ale dokumentacja zastrzega, że są wyjątki: małe instrukcje liczą się jako ułamek. Prawdziwy warehouse nie tnie pracy na równe ósemki.',
    'Start dodatkowego klastra nie jest natychmiastowy i każdy start to minimum 60 sekund rozliczenia. Przy tak krótkim szczycie jak w modelu rachunek byłby wyższy.',
    'Efekt „szybciej i taniej” w pierwszym scenariuszu zależy od tego, czy większy rozmiar usuwa zdalny spilling. To trzeba sprawdzić w Query Profile po zmianie.'
  ],
  sizesTitle: 'Rozmiary i stawki z dokumentacji',
  sizesNote: 'Kredyty na godzinę dla warehouse\'ów pierwszej generacji (Gen1). Stawki Gen2 są w osobnej tabeli zużycia, a Gen2 nie jest domyślny przy tworzeniu standardowego warehouse\'u.',
  sizes: [['X-Small', 1], ['Small', 2], ['Medium', 4], ['Large', 8], ['X-Large', 16], ['2X-Large', 32], ['3X-Large', 64], ['4X-Large', 128]] as [string, number][],
  resizeTitle: 'Co dokładnie robi zmiana rozmiaru',
  resize: [
    'Zmiana rozmiaru działającego warehouse\'u nie wpływa na zapytania, które już trwają. Nowe zasoby obsługują zapytania z kolejki i nowe.',
    'Dodatkowe zasoby są rozliczane od chwili ich przydzielenia. Przy zmniejszeniu znika cache usuwanych zasobów.',
    'Wniosek praktyczny: resize w trakcie długiego zapytania nie przyspieszy tego zapytania. Trzeba je uruchomić ponownie.'
  ],
  multiTitle: 'Multi-cluster warehouse: tryby i polityki',
  multi: [
    'Wymaga edycji Enterprise. Ustawiasz minimalną i maksymalną liczbę klastrów. Gdy są równe (i większe niż 1), to tryb <b>Maximized</b>: wszystkie klastry działają zawsze. Gdy różne, to tryb <b>Auto-scale</b>: Snowflake dodaje i wyłącza klastry zależnie od obciążenia.',
    'W trybie Auto-scale działa polityka skalowania. <b>Standard</b> (domyślna) uruchamia dodatkowy klaster, żeby ograniczyć kolejkowanie. <b>Economy</b> uruchamia klaster tylko wtedy, gdy szacuje, że obciążenia wystarczy na co najmniej 6 minut jego pracy, więc część zapytań poczeka dłużej.',
    'Maksymalna liczba klastrów zależy od rozmiaru: według tabeli w dokumentacji od 300 dla rozmiarów do Medium po 10 dla największych. Interfejs Snowsight pozwala ustawić najwyżej 10.',
    'Alternatywa bez edycji Enterprise: kilka osobnych warehouse\'ów i rozdzielenie zapytań między nie. To zarazem izolacja obciążeń: ELT nie blokuje dashboardów.'
  ],
  qasTitle: 'Query Acceleration Service',
  qas: [
    'Trzecia opcja, dla pojedynczych zapytań z ogromnym skanem. Usługa przenosi część pracy zapytania, które się do tego kwalifikuje, na współdzielone zasoby serverless. Dokumentacja wymienia duże skany z agregacją albo z filtrem wybierającym mały ułamek wierszy oraz duże skany wstawiające wiele wierszy.',
    'Wymaga edycji Enterprise. Zużywa osobno rozliczane kredyty serverless, tylko gdy jest używana. Limit ustawia się mnożnikiem rozmiaru warehouse\'u (scale factor, domyślnie 8).',
    'To koszt serverless, więc resource monitor go nie zatrzyma. Patrz część o kosztach.'
  ]
};

/** Etap Wydajność, część 3: studium przypadku. Trzy liczby z prawdziwego projektu, reszta to metoda. */
export const caseStudy = {
  title: 'Studium przypadku: zaległość 96 godzin',
  intro: [
    'Pipeline przetwarzał dane w porcjach godzinowych i zatrzymał się na cztery doby. Do nadrobienia było <b>96 godzin danych</b>. Pierwsza wersja nadrabiania trwała <b>128 minut</b>. Po testach obciążeniowych i zmianie konfiguracji warehouse\'u: <b>30 minut</b>.',
    'To liczby z prawdziwego projektu. Lekcja celowo nie podaje, jaki rozmiar ustawiono ani ile to kosztowało. Bez Twoich danych byłyby to zmyślone szczegóły. Ważniejsze jest, <b>jak dojść do takiego wyniku krok po kroku</b>, bo o to zapyta rekruter.'
  ],
  badge: 'Trzy liczby z projektu · metoda poniżej jest ogólna',
  steps: [
    {
      title: '1. Zdefiniuj cel i pomiar',
      text: 'Co ma być szybsze i po co? Tu: czas nadrobienia całej zaległości, a nie jednego zapytania. Ustal, jak mierzysz (łączny czas od startu do końca, kredyty zużyte w tym oknie). Ustal też, co Cię ogranicza: termin, budżet, wpływ na innych użytkowników.',
      more: 'Bez celu nie wiadomo, kiedy przestać. „Szybciej" kosztuje, więc potrzebny jest próg typu „zaległość ma zniknąć przed porannym oknem raportów".'
    },
    {
      title: '2. Zbuduj powtarzalny test',
      text: 'Weź reprezentatywną porcję zaległości, którą da się uruchamiać wiele razy w tych samych warunkach. To znaczy: sklonowane tabele zamiast produkcyjnych, wyłączony result cache, zapisany rozmiar warehouse\'u i stan cache (zimny albo rozgrzany).',
      more: 'Zero-copy clone daje tu kopię danych wejściowych bez kosztu storage na starcie. Result cache trzeba wyłączyć (USE_CACHED_RESULT = FALSE), bo inaczej drugi przebieg testu niczego nie mierzy.'
    },
    {
      title: '3. Znajdź, gdzie jest czas',
      text: 'Zanim cokolwiek zmienisz, rozbij 128 minut na części. Ile to kolejka, a ile wykonanie? Które zapytania zajmują najwięcej czasu? W ich Query Profile sprawdź skan (pruning), join (mnożenie wierszy) oraz spilling lokalny i zdalny.',
      more: 'Nadrabianie zaległości różni się od zwykłego przebiegu skalą: 96 porcji naraz zamiast jednej. Operacja, która przy jednej godzinie mieści się w pamięci, przy 96 może zacząć zrzucać dane na dysk. To typowy powód, dla którego zaległość nadrabia się dużo dłużej, niż wynikałoby z samej ilości danych.'
    },
    {
      title: '4. Postaw hipotezę i zmieniaj jedną rzecz',
      text: 'Każdy objaw naprawia się czym innym. Spilling: większy warehouse albo mniejsze porcje. Kolejka: więcej klastrów albo osobny warehouse. Pełny skan: filtr i ułożenie danych. Zmieniasz jedną rzecz, powtarzasz test, zapisujesz czas i kredyty.',
      more: 'Po dwóch zmianach naraz nie wiesz, która z nich dała wynik. Warto też testować w obie strony. Jeśli większy rozmiar pomógł, sprawdź, czy jeszcze większy nadal pomaga, czy zysk już się wypłaszczył.'
    },
    {
      title: '5. Policz kompromis',
      text: 'Dla każdego wariantu policz czas i koszt (stawka × czas × liczba klastrów). Większy warehouse, który kończy proporcjonalnie szybciej, kosztuje podobnie. Wybierasz wariant, który spełnia cel z kroku 1 przy akceptowalnym koszcie, a nie najszybszy możliwy.',
      more: 'Do nadrabiania zaległości sensowny bywa osobny, większy warehouse używany tylko do tego. Nie zabiera zasobów bieżącej pracy i nie zmienia kosztu codziennych przebiegów.'
    },
    {
      title: '6. Zabezpiecz wynik',
      text: 'Wynik testu to nie koniec. Zapisz konfigurację i uzasadnienie. Dodaj limit czasu zapytań i monitor kosztu na warehouse\'ie do nadrabiania. W pipeline dodaj alert na rosnącą zaległość, żeby następnym razem było 6 godzin, a nie 96.',
      more: 'Senior różni się tu od osoby, która „podkręciła warehouse": umie powiedzieć, co zmierzył, dlaczego to zadziałało, ile kosztowało i co zrobił, żeby problem nie wrócił.'
    }
  ],
  takeaway: '<b>Wniosek.</b> Z 128 do 30 minut nie dochodzi się zgadywaniem rozmiaru. Kolejność: cel, powtarzalny test, rozbicie czasu, jedna zmiana naraz, rachunek kosztu, zabezpieczenie. Naucz się opowiadać tę kolejność własnymi słowami i uzupełnij ją własnymi liczbami.'
};

export interface CoverageItem { id: string; label: string; monitor: boolean; budget: boolean; why: string }
/** Etap Koszt i produkcja, część 1: z czego składa się rachunek i co widzą resource monitory, a co budżety. */
export const cost = {
  title: 'Z czego składa się rachunek',
  intro: [
    'Koszt Snowflake to według dokumentacji suma trzech rzeczy: compute, storage i transfer danych. Compute liczy się w kredytach. Ma kilka źródeł i każdym zarządza się inaczej.',
    '<b>Virtual warehouse\'y.</b> Zarządzasz nimi sam. Zużywają kredyty, gdy działają, niezależnie od tego, czy coś liczą. Rozliczenie jest co do sekundy, z minimum 60 sekund przy każdym starcie. <b>Serverless.</b> Zasoby, którymi zarządza Snowflake, z osobną pozycją dla każdej funkcji. <b>Cloud services.</b> Doliczane tylko powyżej 10% dziennego zużycia warehouse\'ów.',
    'Wydatków pilnują dwa narzędzia i każde widzi co innego. Wybierz źródło kosztu i sprawdź, które z nich je zobaczy.'
  ],
  coverageLabel: 'Źródło kosztu',
  assumptions: 'Zasięg obu narzędzi według dokumentacji Snowflake (resource monitors, budgets). Przykłady źródeł kosztu są wymyślone.',
  columns: { monitor: 'Resource monitor', budget: 'Budżet' },
  defaultItem: 'runaway',
  items: [
    { id: 'runaway', label: 'Zapytanie, które działa całą noc', monitor: true, budget: true, why: 'To zużycie warehouse\'u, więc monitor je liczy. Po przekroczeniu limitu może wstrzymać warehouse: po zakończeniu bieżących zapytań albo natychmiast, anulując je. Budżet też to widzi, ale domyślnie tylko powiadamia, i to z opóźnieniem.' },
    { id: 'pipe', label: 'Snowpipe ładujący miliony małych plików', monitor: false, budget: true, why: 'Snowpipe to funkcja serverless. Dokumentacja mówi wprost, że resource monitor nie śledzi wydatków na funkcje serverless i że do tego służy budżet.' },
    { id: 'recluster', label: 'Automatic clustering na ciągle zmienianej tabeli', monitor: false, budget: true, why: 'Usługa działa w tle, poza Twoimi warehouse\'ami. Monitor jej nie widzi, nawet ustawiony na poziomie konta. Dokumentacja zaznacza, że monitor konta nie kontroluje zasobów serverless.' },
    { id: 'task', label: 'Zadanie serverless uruchamiane co minutę', monitor: false, budget: true, why: 'Zadanie serverless używa compute zarządzanego przez Snowflake. To samo zadanie na własnym warehouse\'ie byłoby widoczne dla monitora tego warehouse\'u.' },
    { id: 'storage', label: 'Time Travel i Fail-safe na przepisywanej tabeli', monitor: false, budget: false, why: 'To koszt storage, a oba narzędzia dotyczą compute. Monitor liczy kredyty warehouse\'ów. Budżet jest zdefiniowany jako limit kosztów compute. Storage sprawdzasz w widokach użycia tabel. To wniosek z zakresu obu narzędzi, a nie cytat.' },
    { id: 'services', label: 'Cloud services obsługujące warehouse', monitor: true, budget: true, why: 'Monitor liczy warehouse razem z cloud services potrzebnymi do jego obsługi. Uwaga z dokumentacji: limit monitora nie uwzględnia dziennej korekty 10%, więc monitor może liczyć zużycie, za które ostatecznie nie zapłacisz.' }
  ] as CoverageItem[],
  takeaway: '<b>Wniosek.</b> <b>Resource monitor</b> to hamulec. Potrafi wstrzymać warehouse, ale widzi tylko warehouse\'y. <b>Budżet</b> daje szerszy obraz. Obejmuje też serverless, ale domyślnie tylko powiadamia. Zdanie „mamy monitory, więc koszt jest pod kontrolą" jest prawdziwe tylko dla części rachunku.',
  monitorTitle: 'Resource monitor: szczegóły, które wychodzą na rozmowie',
  monitor: [
    'Limit w kredytach na okres (domyślnie miesiąc kalendarzowy, możliwe też dzień, tydzień, rok albo bez resetu). Akcje: powiadom, powiadom i wstrzymaj, powiadom i wstrzymaj natychmiast.',
    'Jeden monitor można ustawić na poziomie konta, a warehouse może mieć dodatkowo najwyżej jeden własny. Tworzyć je może tylko ACCOUNTADMIN.',
    'To nie jest twardy limit. Dokumentacja mówi, że warehouse może zużywać kredyty po osiągnięciu limitu, zanim zostanie wstrzymany, także przy akcji natychmiastowej, i zaleca próg z zapasem, np. 90%.',
    'Dokumentacja zaznacza też, że monitor nie służy do ścisłej kontroli zużycia w skali godzin.'
  ],
  budgetTitle: 'Budżet: szczegóły',
  budget: [
    'Miesięczny limit wydatków na compute, wyrażony w kredytach. Budżet konta obejmuje całe zużycie kredytów konta. Budżet własny obejmuje wybraną grupę obiektów, np. warehouse\'y, bazy, schematy, tabele, zadania, pipe\'y, albo obiekty z danym tagiem.',
    'Powiadomienie jest wysyłane, gdy prognoza wskazuje przekroczenie limitu: e-mailem, do kolejki w chmurze albo przez webhook.',
    'Budżet może też wywołać procedurę składowaną po osiągnięciu progu (do 10 akcji na budżet) oraz na początku cyklu. Tak da się pośrednio wstrzymać warehouse, ale to logika, którą piszesz sam.',
    'Dane odświeżają się domyślnie co najwyżej co 6,5 godziny. Tryb z odświeżaniem co godzinę zwiększa koszt samego budżetu dwunastokrotnie.'
  ],
  storageTitle: 'Storage: co się w nim liczy',
  storage: [
    'Rozliczenie miesięczne od średniej dziennej liczby skompresowanych bajtów. Wchodzą w to pliki w stage\'ach, dane tabel razem z historią Time Travel oraz Fail-safe.',
    'Klon nie zajmuje storage, dopóki współdzieli mikropartycje ze źródłem. Liczą się mikropartycje, które należą już tylko do klonu, oraz dane usunięte ze źródła, do których klon nadal się odwołuje.',
    'Dla tabel krótko żyjących, np. roboczych w ETL, dokumentacja sugeruje typ transient: brak Fail-safe. Dla tabel długowiecznych, np. faktów, zaleca typ permanent.'
  ],
  leversTitle: 'Dźwignie kosztu, od najtańszej',
  levers: [
    '<b>Czytaj mniej.</b> Pruning, mniej kolumn, poprawione joiny. Mniej pracy to krótszy czas warehouse\'u przy tym samym rozmiarze.',
    '<b>Nie płać za bezczynność.</b> Auto-suspend dopasowany do przerw w obciążeniu, auto-resume włączony.',
    '<b>Dobierz rozmiar pomiarem.</b> Zwiększaj, dopóki czas spada proporcjonalnie. Potem płacisz już tylko za rozmiar.',
    '<b>Rozdziel obciążenia.</b> Osobne warehouse\'y pozwalają dobrać rozmiar i auto-suspend do rodzaju pracy oraz przypisać koszt do zespołu.',
    '<b>Postaw bezpieczniki.</b> <code>STATEMENT_TIMEOUT_IN_SECONDS</code> (domyślnie 172 800 sekund, czyli 2 dni), limit czasu w kolejce, uprawnienia do tworzenia i zmiany warehouse\'ów. Dokumentacja zaznacza, że te kontrolki nie dotyczą cloud services ani funkcji serverless.'
  ]
};

export type StreamAction = 'insert' | 'update' | 'select' | 'task';
/** Etap Koszt i produkcja, część 2: cykl życia Streams & Tasks. Maszyna stanów w komponencie StreamSim. */
export const stream = {
  title: 'Streams & Tasks: przetwarzaj tylko to, co się zmieniło',
  intro: [
    'Tabela źródłowa ma miliard wierszy. Od ostatniego przebiegu zmieniło się kilkanaście. Potrzebujesz dwóch rzeczy: odpowiedzi na pytanie „co się zmieniło od ostatniego razu" i czegoś, co uruchomi przetwarzanie.',
    '<b>Stream</b> działa jak zakładka na tabeli. Pamięta <b>offset</b>, czyli punkt w historii jej wersji. Gdy go odpytasz, zwraca różnicę między tym punktem a stanem bieżącym. <b>Task</b> to SQL uruchamiany według harmonogramu. Zmieniaj tabelę, zaglądaj do streamu i uruchamiaj task.'
  ],
  assumptions: 'Model uproszczony: tabela orders, jeden stream i jeden task, który robi MERGE do tabeli docelowej. Wersje tabeli są ponumerowane dla czytelności.',
  actions: [
    { id: 'insert', label: 'INSERT nowego wiersza' },
    { id: 'update', label: 'UPDATE wiersza 1' },
    { id: 'select', label: 'SELECT * FROM stream' },
    { id: 'task', label: 'Uruchom task (MERGE)' }
  ] as { id: StreamAction; label: string }[],
  labels: { version: 'Wersja tabeli', offset: 'Offset streamu', pending: 'Rekordy w streamie', target: 'Wiersze przetworzone do celu' },
  start: 'Stream utworzony przy wersji 1 tabeli. Zmień coś w tabeli.',
  messages: {
    insert: 'Tabela dostała nową wersję. Offset streamu stoi w miejscu, więc stream pokazuje nowy wiersz jako rekord INSERT.',
    update: 'Ten wiersz istniał już przed offsetem. Jego update stream pokazuje jako parę rekordów: DELETE starej wersji i INSERT nowej, oba z METADATA$ISUPDATE = TRUE.',
    updateAgain: 'Kolejny update tego samego wiersza nie dodaje rekordów. Stream zwraca zmianę netto, czyli różnicę między stanem z offsetu a stanem bieżącym, bez kroków pośrednich. To nadal jedna para.',
    select: 'Zwykły odczyt streamu pokazuje rekordy, ale nie przesuwa offsetu. Możesz czytać dowolną liczbę razy.',
    selectEmpty: 'Stream jest pusty: od offsetu nic się nie zmieniło.',
    task: 'Task wykonał MERGE czytający ze streamu i transakcja została zatwierdzona. Dopiero teraz offset przesunął się do bieżącej wersji. Stream jest pusty.',
    taskSkipped: 'Warunek WHEN SYSTEM$STREAM_HAS_DATA zwrócił fałsz, więc uruchomienie zostało pominięte. MERGE się nie wykonał.'
  },
  takeaway: [
    '<b>Wniosek.</b> Stream nie przechowuje danych, tylko offset. Offset przesuwa wyłącznie zatwierdzona transakcja, w której instrukcja zmieniająca dane (DML, np. MERGE) czyta ze streamu. Dzięki temu zapis do tabeli docelowej i „odhaczenie" zmian to jedna transakcja. Jeśli MERGE się nie powiedzie, zmiany czekają na następny przebieg.',
    'Z tej samej reguły wynika pułapka. Pierwszy odbiorca, który skonsumuje stream, przesuwa offset. Dlatego każdy odbiorca zmian potrzebuje własnego streamu.'
  ],
  codeTitle: 'Ten sam cykl w SQL',
  lines: [
    {
      code: 'CREATE STREAM orders_stream ON TABLE orders;',
      label: 'Zakładka na tabeli',
      text: 'Tworzy stream z offsetem ustawionym na bieżącą wersję tabeli. Przy pierwszym streamie Snowflake dodaje do tabeli kilka ukrytych kolumn śledzenia zmian, które zajmują niewiele miejsca.'
    },
    {
      code: 'CREATE TASK merge_orders WAREHOUSE = etl_wh SCHEDULE = \'5 MINUTE\'',
      label: 'Co 5 minut, na własnym warehouse\'ie',
      text: 'Task z harmonogramem i wskazanym warehouse\'em. Bez parametru WAREHOUSE byłby to task serverless: zasoby dobiera wtedy Snowflake i jest to osobna pozycja kosztu.'
    },
    {
      code: '  WHEN SYSTEM$STREAM_HAS_DATA(\'orders_stream\')',
      label: 'Tylko gdy jest co robić',
      text: 'Warunek sprawdzany przed uruchomieniem. Gdy stream jest pusty, przebieg jest pomijany. Dzięki temu warehouse nie budzi się co 5 minut po nic.'
    },
    {
      code: 'AS MERGE INTO orders_clean t USING orders_stream s ON t.order_id = s.order_id',
      label: 'DML czytający ze streamu',
      text: 'To ta instrukcja konsumuje stream: po zatwierdzeniu transakcji offset się przesuwa. MERGE po kluczu biznesowym sprawia, że ponowne zastosowanie tej samej zmiany nie tworzy duplikatu.'
    },
    {
      code: '  WHEN MATCHED AND s.METADATA$ACTION = \'DELETE\' AND NOT s.METADATA$ISUPDATE THEN DELETE',
      label: 'Prawdziwe usunięcie',
      text: 'Rekord DELETE bez flagi ISUPDATE oznacza usunięcie wiersza w źródle. DELETE z flagą to połowa pary opisującej update, więc tu jest pomijany.'
    },
    {
      code: '  WHEN MATCHED AND s.METADATA$ACTION = \'INSERT\' THEN UPDATE SET t.amount = s.amount',
      label: 'Nowa wersja istniejącego wiersza',
      text: 'Rekord INSERT dla klucza, który już jest w celu, niesie nową wersję wiersza.'
    },
    {
      code: '  WHEN NOT MATCHED AND s.METADATA$ACTION = \'INSERT\' THEN INSERT (order_id, amount) VALUES (s.order_id, s.amount);',
      label: 'Nowy wiersz',
      text: 'Klucza nie ma jeszcze w tabeli docelowej, więc wiersz jest wstawiany.'
    },
    {
      code: 'ALTER TASK merge_orders RESUME;',
      label: 'Task startuje wstrzymany',
      text: 'Nowo utworzony task jest wstrzymany. Dopóki go nie wznowisz, nic się nie uruchomi. To częsta przyczyna „pipeline\'u, który nie działa".'
    }
  ] as ExplainedLine[],
  riskTitle: 'Co może pójść źle',
  risks: [
    '<b>Nieaktualny stream.</b> Stream staje się nieaktualny (stale), gdy jego offset wypadnie poza okres retencji tabeli źródłowej, czyli poza czas, przez który tabela trzyma stare wersje danych. Dla streamu, którego nikt nie konsumuje, Snowflake wydłuża tę retencję domyślnie do 14 dni, niezależnie od edycji. Po tym czasie stream trzeba utworzyć od nowa. Termin pokazuje kolumna STALE_AFTER w <code>SHOW STREAMS</code>.',
    '<b>Przeciągnięty task.</b> Jeśli task jeszcze działa, gdy przychodzi pora następnego uruchomienia, to uruchomienie jest pomijane. Domyślnie jednocześnie działa tylko jedno uruchomienie grafu zadań.',
    '<b>Cicho wstrzymany task.</b> Graf zadań jest domyślnie wstrzymywany po 10 kolejnych nieudanych uruchomieniach. Nikt nie konsumuje wtedy streamu, a czas do jego nieaktualności płynie.',
    '<b>Odtworzenie tabeli.</b> <code>CREATE OR REPLACE TABLE</code> na źródle usuwa jego historię, więc streamy na nim stają się nieaktualne.',
    '<b>Uprawnienia.</b> Task działa z uprawnieniami roli, która jest jego właścicielem. Zmiana grantów tej roli potrafi zatrzymać pipeline.'
  ],
  typesTitle: 'Rodzaje streamów i klauzula CHANGES',
  types: [
    '<b>Standard</b> śledzi wstawienia, zmiany i usunięcia i zwraca zmianę netto. Wiersz wstawiony i usunięty między dwoma odczytami w ogóle się nie pojawi.',
    '<b>Append-only</b> śledzi tylko wstawienia. <b>Insert-only</b> jest dla tabel zewnętrznych i tabel Iceberg zarządzanych zewnętrznie.',
    'Zmiany można odczytać też bez streamu, klauzulą <code>CHANGES</code> w zapytaniu. Wymaga to włączonego śledzenia zmian na tabeli (albo istniejącego streamu) i jawnego punktu startu przez <code>AT</code> lub <code>BEFORE</code>. Nie ma wtedy offsetu, który ktoś za Ciebie przesuwa.'
  ],
  dynamicTitle: 'Kiedy zamiast tego dynamic tables',
  dynamic: [
    'Dynamic table opisujesz, zamiast programować. Podajesz zapytanie SELECT i docelowe opóźnienie (target lag). Snowflake sam śledzi zależności i odświeża wynik, przyrostowo tam, gdzie potrafi.',
    'Dokumentacja wskazuje to jako zalecane podejście dla nowych potoków SQL z wieloma tabelami. Streams i tasks zaleca wtedy, gdy potrzebujesz procedur składowanych, operacji MERGE albo wywołań funkcji zewnętrznych.',
    'Ograniczenia: dynamic table jest tylko do odczytu, minimalny target lag to 1 minuta, a rzeczywiste opóźnienie może przekroczyć docelowe, gdy odświeżanie trwa dłużej, niż przewidziano.'
  ],
  bridgeTitle: 'Analogia: model incremental w dbt',
  bridge: {
    from: 'dbt',
    known: 'Model incremental przetwarza tylko nowe wiersze. W bloku is_incremental() filtrujesz po znaczniku czasu większym niż maksimum z tabeli docelowej, a unique_key zamienia zapis na MERGE.',
    fresh: 'Stream robi to samo bez kolumny ze znacznikiem czasu. Silnik sam wie, co zmieniło się od ostatniej konsumpcji. Widzi też usunięcia, których filtr po dacie nie pokaże.',
    breaks: 'W dbt granicę wyznacza zawartość tabeli docelowej, więc model można przebudować w dowolnej chwili. Stream ma własny stan: offset. Można go stracić, gdy stream stanie się nieaktualny. Przesuwa go też każdy zatwierdzony DML czytający ze streamu, także uruchomiony przez pomyłkę.'
  } as Bridge
};

export interface RetentionType { id: string; label: string; travel: number; failsafe: number; note: string }
export interface CloneStep { id: string; label: string; source: string[]; clone: string[]; say: string }
/** Etap Koszt i produkcja, część 3: Time Travel, Fail-safe i klony. Okresy z dokumentacji, schemat mikropartycji wymyślony. */
export const history = {
  title: 'Time Travel, Fail-safe i klony: jedna własność, trzy funkcje',
  intro: [
    'W etapie Mechanizm było zdanie: zmiana w tabeli zapisuje nowe mikropartycje, a stare nie znikają od razu. Z tego jednego faktu wynikają trzy funkcje, które łatwo ze sobą pomylić.',
    'Najpierw czas. Wybierz typ tabeli i zobacz, co dzieje się ze starą wersją danych po zmianie albo usunięciu.'
  ],
  typeLabel: 'Typ tabeli',
  assumptions: 'Okresy według dokumentacji. Oś nie jest w skali.',
  defaultType: 'standard',
  types: [
    { id: 'standard', label: 'Permanent, 1 dzień', travel: 1, failsafe: 7, note: 'Ustawienie standardowe: 1 dzień Time Travel, potem 7 dni Fail-safe. Przez 8 dni płacisz za storage starej wersji.' },
    { id: 'enterprise', label: 'Permanent, 90 dni', travel: 90, failsafe: 7, note: 'Maksimum dla tabel stałych w edycji Enterprise. Wygodne, ale na często przepisywanej tabeli oznacza do 97 dni płatnego storage dla każdej starej wersji.' },
    { id: 'transient', label: 'Transient', travel: 1, failsafe: 0, note: 'Najwyżej 1 dzień Time Travel i brak Fail-safe. Tańsze, ale po upływie Time Travel danych nie da się odzyskać. Dla tabel, które umiesz odtworzyć ze źródła.' }
  ] as RetentionType[],
  phases: {
    travel: { name: 'Time Travel', who: 'Ty: AT / BEFORE, UNDROP, CLONE' },
    failsafe: { name: 'Fail-safe', who: 'tylko Snowflake, przez zgłoszenie do supportu' },
    gone: { name: 'Usunięte', who: 'nie do odzyskania' }
  },
  takeaway: '<b>Wniosek.</b> <b>Time Travel</b> to okres, w którym sam korzystasz ze starych wersji. <b>Fail-safe</b> to kolejne 7 dni. Nie da się go skonfigurować, a dane może z niego odzyskać tylko Snowflake. Za oba płacisz jak za zwykły storage. Fail-safe to ostatnia deska ratunku, a nie sposób na naprawianie pomyłek.',
  detailTitle: 'Szczegóły Time Travel i Fail-safe',
  detail: [
    'Time Travel: standardowo 1 dzień, włączony automatycznie. Więcej niż 1 dzień wymaga edycji Enterprise: do 90 dni dla obiektów stałych. Tabele transient i temporary: 0 albo 1 dzień. Parametr: <code>DATA_RETENTION_TIME_IN_DAYS</code>.',
    'Dostęp: klauzula <code>AT</code> albo <code>BEFORE</code> w SELECT i w CREATE ... CLONE (znacznik czasu, przesunięcie albo identyfikator instrukcji) oraz <code>UNDROP</code>.',
    'Fail-safe: 7 dni, bez możliwości konfiguracji, zaczyna się zaraz po Time Travel. Dokumentacja opisuje go jako usługę best effort, a odzyskanie danych może trwać od kilku godzin do kilku dni. Zamiast polegać na Fail-safe, zaleca funkcję backupów Snowflake.',
    'Koszt: storage jest naliczany tak samo dla danych aktywnych, w Time Travel i w Fail-safe. W tabelach, które często się zmieniają, danych historycznych bywa dużo więcej niż aktywnych.'
  ],
  cloneTitle: 'Zero-copy cloning: kopia, która nic nie kopiuje',
  cloneIntro: 'Tabela to lista wskazań na mikropartycje. Kopię można więc zrobić bez kopiowania danych: wystarczy druga lista, która wskazuje na te same mikropartycje. Przejdź przez trzy kroki.',
  cloneAssumptions: 'Ilustracja: tabela z czterema mikropartycjami. Litera z primem oznacza nową wersję mikropartycji.',
  defaultStep: 'clone',
  steps: [
    { id: 'clone', label: 'Po CLONE', source: ['A', 'B', 'C', 'D'], clone: ['A', 'B', 'C', 'D'], say: 'Klon wskazuje na te same cztery mikropartycje. Nic nie zostało skopiowane, więc klon powstaje szybko i nie zajmuje dodatkowego storage.' },
    { id: 'cloneWrite', label: 'Po UPDATE w klonie', source: ['A', 'B', 'C', 'D'], clone: ['A', 'B', 'C', "D'"], say: "Zmiana w klonie zapisała nową mikropartycję D', która należy tylko do klonu. Źródło nic o niej nie wie. Dodatkowy storage: jedna mikropartycja." },
    { id: 'sourceWrite', label: 'Po UPDATE w źródle', source: ["A'", 'B', 'C', 'D'], clone: ['A', 'B', 'C', "D'"], say: "Źródło zapisało A'. Stara A nie należy już do bieżącej wersji źródła, ale klon nadal na nią wskazuje, więc nie można jej usunąć. Tak klon utrzymuje przy życiu dane, które źródło dawno porzuciło." }
  ] as CloneStep[],
  cloneTakeaway: '<b>Wniosek.</b> Klon jest darmowy w chwili utworzenia i niezależny od źródła. Kosztuje dopiero to, czym klon i źródło zaczną się różnić: nowe mikropartycje po zmianach oraz stare, których nie da się usunąć, dopóki ktoś na nie wskazuje. Długo żyjący klon często zmienianej tabeli po cichu zbiera storage.',
  cloneMoreTitle: 'Co zaskakuje przy klonowaniu bazy albo schematu',
  cloneMore: [
    '<b>Uprawnienia.</b> Klon nie dziedziczy grantów nadanych na sam klonowany kontener, ale obiekty w środku zachowują swoje granty. Przy klonie pojedynczej tabeli granty kopiuje dopiero <code>COPY GRANTS</code>.',
    '<b>Taski</b> w klonie są domyślnie wstrzymane. <b>Automatic clustering</b> na sklonowanej tabeli też jest domyślnie wstrzymany.',
    '<b>Streamy.</b> Rekordy, których nie skonsumowano przed klonowaniem, są w sklonowanym streamie niedostępne.',
    '<b>Pipe\'y</b> odwołujące się do wewnętrznego stage\'a nie są klonowane. Wewnętrzne stage\'e nazwane są klonowane tylko z klauzulą <code>INCLUDE INTERNAL STAGES</code>.',
    'Klon można utworzyć ze stanu z przeszłości: <code>CREATE TABLE t_restore CLONE t AT (...)</code>. To podstawowy sposób naprawy po błędnym UPDATE: klonujesz stan sprzed pomyłki i porównujesz.'
  ]
};

export interface Role { id: string; label: string; kind: 'system' | 'functional' | 'access'; grants: string[]; inherits: string[]; note: string }
/** Etap Koszt i produkcja, część 4: RBAC, izolacja i sharing. Hierarchia przykładowa, zasady z dokumentacji. */
export const access = {
  title: 'Kto co widzi: role, izolacja i udostępnianie',
  intro: [
    'W Snowflake uprawnień nie nadaje się ludziom. Uprawnienie dostaje <b>rola</b>, a rolę dostaje użytkownik albo inna rola. Gdy rola dostaje inną rolę, powstaje <b>hierarchia</b>: rola wyżej dziedziczy wszystko, co mają role pod nią.',
    'Poniżej mała, przykładowa hierarchia. Wybierz rolę i sprawdź, co naprawdę może.'
  ],
  assumptions: 'Ilustracja: przykładowe role i uprawnienia. Zasada dziedziczenia i zalecenia są z dokumentacji.',
  roleLabel: 'Rola',
  defaultRole: 'analyst',
  roles: [
    { id: 'sales_read', label: 'SALES_READ', kind: 'access', grants: ['SELECT na tabelach schematu SALES'], inherits: [], note: 'Rola dostępu: wąskie uprawnienia do konkretnych obiektów. Nie nadaje się jej ludziom bezpośrednio.' },
    { id: 'sales_write', label: 'SALES_WRITE', kind: 'access', grants: ['INSERT, UPDATE, DELETE na tabelach schematu SALES'], inherits: ['sales_read'], note: 'Rola dostępu do zapisu. Dziedziczy odczyt, żeby nie powtarzać grantów.' },
    { id: 'analyst', label: 'ANALYST', kind: 'functional', grants: ['USAGE na warehouse BI_WH'], inherits: ['sales_read'], note: 'Rola funkcyjna: odpowiada pracy człowieka. Zbiera role dostępu i warehouse, na którym pracuje.' },
    { id: 'engineer', label: 'DATA_ENGINEER', kind: 'functional', grants: ['USAGE na warehouse ETL_WH'], inherits: ['sales_write'], note: 'Rola funkcyjna dla inżynierów i pipeline\'ów. Ma zapis przez SALES_WRITE i osobny warehouse.' },
    { id: 'sysadmin', label: 'SYSADMIN', kind: 'system', grants: ['tworzenie baz i warehouse\'ów'], inherits: ['analyst', 'engineer'], note: 'Rola systemowa. Dokumentacja zaleca podpinać pod nią najwyższe role własne, żeby administratorzy mogli zarządzać ich obiektami.' }
  ] as Role[],
  takeaway: '<b>Wniosek.</b> <b>Least privilege</b>, czyli „tylko tyle uprawnień, ile trzeba", to w Snowflake struktura ról, a nie pojedynczy grant. Na dole są wąskie role dostępu do obiektów. Z nich składasz role funkcyjne. Na górze są role systemowe. Zmiana uprawnień całego zespołu to wtedy jeden grant, a audyt to przejście po hierarchii.',
  adminTitle: 'Role systemowe i zalecenia',
  admin: [
    '<b>ACCOUNTADMIN</b> obejmuje SYSADMIN i SECURITYADMIN. Dokumentacja zaleca: nie używać jej do tworzenia obiektów, nie ustawiać jako roli domyślnej, nie używać w skryptach automatycznych, wymagać MFA i przypisać co najmniej dwóm użytkownikom.',
    '<b>SECURITYADMIN</b> zarządza grantami globalnie oraz użytkownikami i rolami. <b>USERADMIN</b> służy tylko do zarządzania użytkownikami i rolami. <b>SYSADMIN</b> tworzy warehouse\'y, bazy i inne obiekty. <b>PUBLIC</b> jest automatycznie nadana każdemu użytkownikowi i każdej roli.',
    'ACCOUNTADMIN nie jest superużytkownikiem: domyślnie nie może zmienić ani usunąć obiektów utworzonych przez rolę własną, która nie jest podpięta do hierarchii systemowej.',
    'Każdy obiekt ma jedną rolę będącą właścicielem, domyślnie tę, którą go utworzono. W schemacie typu managed access o grantach na obiektach decyduje właściciel schematu (albo rola z MANAGE GRANTS), a nie właściciele poszczególnych obiektów.',
    'Future grants definiują uprawnienia dla obiektów, które dopiero powstaną. Role drugorzędne (secondary roles) dają uprawnienia do zapytań i DML, ale prawo do tworzenia obiektów pochodzi tylko z roli głównej.'
  ],
  tenantTitle: 'Izolacja tenantów',
  tenantIntro: 'Na jednej platformie pracuje wielu klientów albo zespołów, czyli tenantów. Jak mocno ich rozdzielić? Nie ma jednej poprawnej odpowiedzi. To wybór na skali.',
  tenantColumns: ['Poziom', 'Co izoluje', 'Koszt'],
  tenants: [
    ['Osobne konto', 'Dane, compute, role, rozliczenie', 'Najwięcej pracy operacyjnej: każde konto trzeba utrzymać'],
    ['Osobna baza lub schemat', 'Dane i uprawnienia przez role na tenanta', 'Liczba obiektów i ról rośnie razem z liczbą tenantów'],
    ['Wspólne tabele + row access policy', 'Wiersze widoczne dla roli', 'Błąd w polityce to wyciek danych. Polityka kosztuje przy każdym zapytaniu'],
    ['Osobny warehouse', 'Compute: jeden tenant nie zagłodzi drugiego', 'Więcej warehouse\'ów do pilnowania. Bezczynne nie kosztują']
  ],
  tenantNotes: [
    'Row access policy decyduje, które wiersze zwrócić, i jest wyliczana w czasie zapytania. Wymaga edycji Enterprise. Dokumentacja zaleca funkcję <code>IS_ROLE_IN_SESSION</code>, która uwzględnia hierarchię ról.',
    'Koszt wydajnościowy z dokumentacji: polityki z prostymi wyrażeniami działają zwykle lepiej niż polityki, które sięgają do tabel mapujących. Snowflake musi też skanować kolumny związane z polityką, nawet gdy zapytanie ich nie używa. Pomaga klastrowanie po atrybutach używanych w polityce.',
    'Ograniczenie: row access policy nie blokuje wstawiania wierszy. Kontrola zapisu to nadal uprawnienia ról.',
    'Wybór poziomu to ocena ryzyka i skali, a nie reguła z dokumentacji. Im droższy byłby błąd izolacji, tym wyżej w tabeli.'
  ],
  shareTitle: 'Secure data sharing',
  share: [
    'Dostawca tworzy <b>share</b>, dodaje do niego obiekty i wskazuje konta odbiorców. Odbiorca tworzy z niego bazę. Dokumentacja: żadne dane nie są kopiowane ani przesyłane między kontami.',
    'Udostępnione obiekty są u odbiorcy tylko do odczytu i nie zajmują jego storage. Odbiorca płaci wyłącznie za compute, którym je odpytuje. Dostawca nadal płaci za storage.',
    'To działa dzięki architekturze z etapu Intuicja. Dane leżą raz, a dostęp to sprawa metadanych i uprawnień w warstwie cloud services.',
    'Bezpośredni share działa tylko między kontami w tym samym regionie. Dla innych regionów i chmur dokumentacja wskazuje listing z auto-fulfillment.',
    'Odbiorca bez konta Snowflake może dostać reader account: konto utworzone i opłacane przez dostawcę, które może czytać dane tylko od tego dostawcy.'
  ]
};

export interface Scenario { setup: string; options: string[]; correct: number; why: string; scope: string }

/**
 * Etap Interview. Pytania, odpowiedzi 30–60 s (PL i EN) oraz follow-upy przychodzą z Interview Banku.
 * Tutaj jest to, czego bank nie ma: porównanie z klasyczną bazą i Sparkiem, typowe błędne przekonania
 * i szkielet opowieści o własnym projekcie.
 */
export const interview = {
  compareTitle: 'Snowflake, klasyczna baza, Spark: czym to się różni',
  compareIntro: 'Rekruter często sprawdza, czy rozumiesz mechanizm, każąc porównać go z czymś innym. Trzy kolumny, sześć tematów.',
  compareColumns: ['Temat', 'Snowflake', 'Klasyczna baza / MPP', 'Spark na data lake'],
  compare: [
    ['Storage i compute', 'Rozdzielone: dane raz w object storage, wiele niezależnych warehouse\'ów', 'Zwykle razem: dane na dyskach węzłów', 'Rozdzielone: pliki w object storage, klastry do obliczeń'],
    ['Ograniczanie odczytu', 'Pruning mikropartycji po metadanych, zarządzany przez usługę', 'Indeksy i partycje zdefiniowane przez administratora', 'Partycje katalogowe i statystyki plików, układ danych wybierasz sam'],
    ['Strojenie', 'Mało dźwigni: SQL, ułożenie danych, rozmiar i liczba klastrów', 'Indeksy, statystyki, hinty, parametry pamięci', 'Dużo dźwigni: partycje shuffle\'u, strategie joina, pamięć executorów'],
    ['Współbieżność', 'Kolejne klastry (multi-cluster) albo osobne warehouse\'y', 'Jeden zestaw zasobów dzielony przez wszystkich', 'Osobne klastry albo aplikacje na zadanie'],
    ['Zmiany przyrostowe', 'Stream z offsetem, konsumowany transakcyjnie', 'Triggery, log transakcyjny, narzędzia CDC', 'Checkpointy w Structured Streaming, change data feed w Delta'],
    ['Stare wersje danych', 'Time Travel i Fail-safe wbudowane w storage', 'Backupy i odtwarzanie do punktu w czasie', 'Time travel w formacie tabeli, zależny od retencji plików']
  ],
  compareNote: 'Kolumny o klasycznej bazie i Sparku to uogólnienia z wiedzy ogólnej, nie opis konkretnego produktu. Na rozmowie odnoś je do systemu, o który pyta rekruter.',
  mythsTitle: 'Błędne przekonania, na których łapie rekruter',
  myths: [
    ['„Większy warehouse zawsze kosztuje więcej."', 'Rozliczenie jest sekundowe: liczy się stawka razy czas. Dwa razy większy warehouse, który kończy w połowę czasu, kosztuje tyle samo.'],
    ['„Zwiększę warehouse, to zniknie kolejka."', 'Kolejka to problem współbieżności. Dokumentacja mówi, że resize nie jest do tego przeznaczony: pomaga multi-cluster albo osobne warehouse\'y.'],
    ['„Snowflake cache\'uje dane, więc drugie zapytanie jest szybkie."', 'Są dwa mechanizmy: result cache (wyniki, w usłudze, 24 godziny) i cache warehouse\'u (dane, na dysku, znika przy wstrzymaniu).'],
    ['„Clustering key to taki indeks."', 'Nie wskazuje wierszy. Zmienia ułożenie danych, żeby pruning mógł pomijać mikropartycje, i kosztuje przy każdej zmianie tabeli.'],
    ['„Resource monitor pilnuje całego rachunku."', 'Tylko warehouse\'ów. Serverless (Snowpipe, automatic clustering, zadania serverless) widzi dopiero budżet.'],
    ['„Fail-safe to dłuższy Time Travel."', 'Z Fail-safe dane odzyskuje tylko Snowflake, na zasadzie best effort. Użytkownik nie ma do niego dostępu.'],
    ['„Stream trzyma kopię zmienionych wierszy."', 'Trzyma offset. Zmiany wylicza z historii wersji tabeli, dlatego zależy od jej retencji i może stać się nieaktualny.'],
    ['„Klon podwaja koszt storage."', 'W chwili utworzenia nie zajmuje nic. Koszt rośnie wraz z rozbieżnością między klonem a źródłem.']
  ],
  storyTitle: 'Twój własny case: szkielet odpowiedzi',
  storyIntro: 'Masz doświadczenie produkcyjne, więc na pytanie o wydajność odpowiadasz własnym projektem. Poniżej szkielet po angielsku. Nawiasy kwadratowe uzupełnij własnymi faktami: lekcja ich nie zna i nie będzie zgadywać.',
  storyEn: '“We had a pipeline that fell 96 hours behind, and the first catch-up run took 128 minutes, which didn’t fit [your constraint: the window, the SLA]. I didn’t start by resizing. I set up a repeatable load test on [what you tested on], and looked at where the time went: [what you found: queuing, spilling, a full scan]. That pointed to [the cause]. I changed [the warehouse configuration you changed] and re-ran the same test after each change. The catch-up went down to 30 minutes. I also checked what it did to cost: [what you measured]. And to keep it from coming back, we [the guardrail: alert, timeout, dedicated warehouse].”',
  storyPl: 'Po polsku: mieliśmy pipeline z zaległością 96 godzin, a pierwsze nadrabianie trwało 128 minut, co nie mieściło się w [Twoje ograniczenie]. Nie zacząłem od zmiany rozmiaru. Przygotowałem powtarzalny test obciążeniowy na [na czym testowałeś] i sprawdziłem, gdzie jest czas: [co znalazłeś]. To wskazało [przyczynę]. Zmieniłem [konfigurację warehouse\'u, którą zmieniłeś] i po każdej zmianie powtarzałem ten sam test. Nadrabianie spadło do 30 minut. Sprawdziłem też koszt: [co zmierzyłeś]. Żeby problem nie wrócił, [zabezpieczenie].',
  storyTips: [
    'Podawaj tylko liczby, które naprawdę pamiętasz albo masz w notatkach. „Nie pamiętam dokładnie, rząd wielkości był taki" brzmi lepiej niż zmyślona precyzja.',
    'Nazwij kompromis. Rekruter chce usłyszeć, co oddałeś za te 98 minut: koszt, złożoność, osobny warehouse do utrzymania.',
    'Przygotuj odpowiedź na „a co, gdyby to nie pomogło?". To pytanie o metodę, nie o wynik.'
  ]
};

export interface QuizItem { q: string; setup?: string; options: string[]; correct: number; why: string }
/** Etap Sprawdź się. Każde pytanie podaje założenia, jeśli wynik od nich zależy. */
export const quiz: QuizItem[] = [
  {
    q: 'Warehouse jest wstrzymany. Które zapytanie może dostać odpowiedź bez jego uruchamiania?',
    setup: 'Założenia: dane tabeli nie zmieniły się od godziny, rola ma uprawnienia do tabeli.',
    options: ['Dowolne zapytanie z filtrem po dacie', 'Zapytanie identyczne co do znaku z wykonanym godzinę temu', 'Zapytanie, które czyta tylko jedną kolumnę'],
    correct: 1,
    why: 'Identyczne zapytanie na niezmienionych danych może dostać zapisany wynik z result cache. Snowflake pomija wtedy wykonanie. Filtr po dacie i jedna kolumna zmniejszają ilość czytanych danych, ale zapytanie nadal trzeba wykonać na warehouse\'ie.'
  },
  {
    q: 'Tabela jest ładowana chronologicznie. Zapytanie <code>WHERE customer_id = 4217</code> skanuje wszystkie mikropartycje. Dlaczego?',
    options: ['Bo na customer_id nie ma indeksu', 'Bo zakres customer_id każdej mikropartycji obejmuje 4217', 'Bo pruning działa tylko dla dat'],
    correct: 1,
    why: 'Pruning porównuje filtr z zakresem min–max kolumny w każdej mikropartycji. Klienci są wymieszani we wszystkich mikropartycjach, więc każdy zakres obejmuje 4217 i żadnej nie da się wykluczyć. Pruning działa dla dowolnej kolumny, o ile jej wartości są skupione w niewielu mikropartycjach.'
  },
  {
    q: 'W Query Profile operator Join przyjmuje 50 mln i 1 mln wierszy, a oddaje 4 mld. Zapytanie zrzuca dane do zdalnego storage. Od czego zaczynasz?',
    options: ['Od większego warehouse\'u, bo jest spilling', 'Od warunku joina i unikalności klucza', 'Od clustering key na większej tabeli'],
    correct: 1,
    why: 'Join, który oddaje wielokrotnie więcej wierszy, niż dostał, to eksplodujący join. Spilling jest tu skutkiem mnożenia wierszy. Większy warehouse przetworzy 4 mld wierszy szybciej, ale nie naprawi warunku, który je produkuje.'
  },
  {
    q: 'O 9:00 proste zapytania pod dashboard czekają po 3 minuty, choć każde wykonuje się w 2 sekundy. Co pomoże?',
    setup: 'Założenia: warehouse jednoklastrowy, edycja Enterprise, zapytań jest kilkadziesiąt naraz.',
    options: ['Scale up o dwa rozmiary', 'Multi-cluster warehouse albo rozdzielenie zapytań na osobne warehouse\'y', 'Clustering key na tabelach dashboardu'],
    correct: 1,
    why: 'Zapytania są szybkie, tylko czekają w kolejce. To problem współbieżności: zapytań jest za dużo naraz. Dokumentacja wskazuje dodatkowe warehouse\'y albo multi-cluster i zaznacza, że zmiana rozmiaru nie jest przeznaczona do takich problemów.'
  },
  {
    q: 'Warehouse Large kończy job w 40 minut. X-Large kończy ten sam job w 20 minut. Który wariant zużyje więcej kredytów?',
    setup: 'Założenia: stawki Gen1 z dokumentacji (Large 8, X-Large 16 kredytów na godzinę), warehouse zatrzymuje się zaraz po jobie.',
    options: ['X-Large, bo ma dwa razy wyższą stawkę', 'Oba tyle samo', 'Large, bo działa dłużej'],
    correct: 1,
    why: 'Large: 8 kredytów na godzinę przez 40 minut to 5,33 kredytu. X-Large: 16 przez 20 minut to też 5,33. Przy liniowym skalowaniu większy rozmiar daje wynik szybciej za tę samą cenę. Gdy czas przestaje spadać proporcjonalnie, większy rozmiar zaczyna kosztować więcej.'
  },
  {
    q: 'Rachunek wzrósł, a żaden resource monitor nie zadziałał. Gdzie szukasz najpierw?',
    options: ['W zapytaniach na największym warehouse\'ie', 'W funkcjach serverless i w storage', 'W liczbie użytkowników'],
    correct: 1,
    why: 'Resource monitor liczy tylko warehouse\'y i wspierające je cloud services. Nie śledzi funkcji serverless, takich jak Snowpipe czy automatic clustering, i nie dotyczy storage. Skoro monitory milczą, wzrost jest najpewniej tam, gdzie nie patrzą.'
  },
  {
    q: 'Wykonujesz <code>SELECT * FROM orders_stream</code> trzy razy z rzędu. Co się dzieje z offsetem streamu?',
    options: ['Przesuwa się przy pierwszym odczycie', 'Nie przesuwa się wcale', 'Przesuwa się po trzecim odczycie'],
    correct: 1,
    why: 'Samo zapytanie do streamu nie przesuwa offsetu, nawet w jawnej transakcji. Offset przesuwa się tylko wtedy, gdy stream zostanie użyty w instrukcji DML i transakcja zostanie zatwierdzona.'
  },
  {
    q: 'Ktoś wykonał błędny UPDATE na tabeli permanent 10 dni temu. Retencja Time Travel to 1 dzień. Co możesz zrobić sam?',
    options: ['Zapytać o stan sprzed zmiany klauzulą AT', 'Nic: dane są w Fail-safe albo już usunięte, a z Fail-safe odzyskuje tylko Snowflake', 'Wykonać UNDROP TABLE'],
    correct: 1,
    why: 'Time Travel skończył się po 1 dniu. Przez kolejne 7 dni stara wersja była w Fail-safe, czyli do 8. dnia, i tam odzyskać ją mógł tylko Snowflake. Po 10 dniach nie ma jej już wcale. Dlatego retencję dobiera się do tego, jak szybko zauważysz błąd.'
  },
  {
    q: 'Klonujesz tabelę 1 TB, a potem aktualizujesz w klonie 1% wierszy. Ile dodatkowego storage zajmuje klon?',
    setup: 'Założenie: zmienione wiersze leżą w niewielkiej części mikropartycji.',
    options: ['Około 1 TB', 'Tyle, ile zajmują nowo zapisane mikropartycje', 'Nic, klon zawsze jest darmowy'],
    correct: 1,
    why: 'Klon współdzieli mikropartycje ze źródłem, więc w chwili utworzenia nie zajmuje nic. Zmiana zapisuje nowe mikropartycje, które należą tylko do klonu. Ile ich będzie, zależy od tego, w ilu mikropartycjach leżały zmieniane wiersze: mikropartycja jest przepisywana w całości.'
  },
  {
    q: 'Rola ANALYST ma nadaną rolę SALES_READ. Rola SYSADMIN ma nadaną rolę ANALYST. Kto może czytać tabele schematu SALES?',
    options: ['Tylko użytkownicy z rolą SALES_READ', 'Użytkownicy z rolą SALES_READ, ANALYST albo SYSADMIN', 'Tylko SYSADMIN'],
    correct: 1,
    why: 'Rola dziedziczy uprawnienia ról, które zostały jej nadane, i tak dalej w górę hierarchii. ANALYST ma więc uprawnienia SALES_READ, a SYSADMIN ma uprawnienia ANALYST razem z odziedziczonymi.'
  }
];

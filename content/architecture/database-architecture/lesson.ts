import type { Bridge, ExplainedLine, LessonMeta } from '../../types';

/**
 * Lekcja 06: Database & Data Architecture. Porządkuje teorię i słownictwo dla osoby, która zna Snowflake i dbt
 * z praktyki: od kształtu obciążenia (OLTP, OLAP) przez model danych i mechanizmy silnika do wyboru architektury.
 *
 * Fragmenty narracyjne są w HTML (dozwolone znaczniki: lib/richText.ts) i mogą używać <term id="...">.
 *
 * Skąd są fakty: dokumentacja Snowflake, PostgreSQL 19, dbt, Databricks i Microsoft, spisane w docs/verified-facts.md,
 * sekcja „Lekcja 06". „Klasyczna baza relacyjna" oznacza zachowanie opisane w dokumentacji PostgreSQL.
 * Wszystkie interakcje (storage, normalization, index, pruning i pozostałe) są ILUSTRACJAMI na wymyślonych danych:
 * liczby stron, wartości i partycji są dobrane tak, żeby mechanizm było widać. Lekcja nie ma labu i nie podaje pomiarów.
 * Pytania rekrutacyjne, krótkie odpowiedzi i follow-upy nie są tu powtórzone: lekcja bierze je z Interview Banku.
 */
export const meta: LessonMeta = {
  id: 'database-architecture',
  topicId: 'architecture.oltp-olap',
  area: 'architecture',
  title: 'Database & Data Architecture',
  subtitle: 'Teoria, którą znasz z praktyki, nazwana po imieniu: OLTP i OLAP, normalizacja, klucze, indeksy, pruning, ACID oraz wybór między hurtownią, data lake i lakehouse.',
  minutes: 60
};

/** Zagadnienia z Interview Banku ćwiczone w etapie Interview, w tej kolejności. */
export const interviewTopics = [
  'architecture.oltp-olap', 'architecture.normalization', 'architecture.keys-integrity', 'architecture.indexing',
  'architecture.partition-pruning', 'architecture.query-optimization', 'architecture.acid-isolation',
  'architecture.warehouse-lake-lakehouse', 'architecture.etl-elt', 'architecture.storage-compute', 'architecture.choosing-architecture'
];

/** Krok etapu Intuicja. `visual` wstawia ilustrację między `html` a `after`. */
export interface Beat {
  html: string;
  visual?: 'workloads' | 'storage';
  after?: string;
  next: string;
  bridge?: Bridge;
  more?: { title: string; html: string[] };
}

export const beats: Beat[] = [
  {
    html: '<h1>Jedna tabela zamówień, dwa zupełnie różne pytania.</h1>\n<p class="lede">Sklep internetowy trzyma zamówienia w bazie. Aplikacja pyta o jedno zamówienie tysiące razy na minutę. Analityk raz dziennie pyta o przychód z całego roku.</p>\n<p>Oba pytania dotyczą tych samych danych, ale stawiają bazie przeciwne wymagania. Zanim padną jakiekolwiek nazwy, porównaj je.</p>',
    visual: 'workloads',
    after: '<b>Wniosek.</b> Pierwszy kształt obciążenia nazywa się <b>OLTP</b> (Online Transaction Processing): dużo małych transakcji, które czytają i zmieniają pojedyncze wiersze. Drugi to <b>OLAP</b> (Online Analytical Processing): mało ciężkich zapytań, które czytają miliony wierszy i agregują kilka kolumn. To opis obciążenia, a nie nazwa produktu.',
    more: {
      title: 'Dlaczego nie robi się analityki na bazie aplikacji',
      html: [
        'Ciężki skan konkuruje z transakcjami o te same zasoby, więc raport potrafi spowolnić składanie zamówień.',
        'Model danych aplikacji jest ułożony pod bezpieczny zapis pojedynczych wierszy. Analityka potrzebuje historii, danych z wielu systemów naraz i modelu ułożonego pod odczyt.',
        'Dlatego dane kopiuje się z systemów OLTP do osobnego systemu analitycznego. Resztę lekcji można czytać jako odpowiedź na pytanie: jak zbudować oba systemy i czym się różnią.'
      ]
    },
    next: 'Co z tego wynika dla dysku?'
  },
  {
    html: '<h2>Czy trzeba przeczytać całą tabelę?</h2>\n<p>Dysk czyta dane blokami, a nie pojedynczymi wartościami. O tym, ile trzeba przeczytać, decyduje więc to, <b>co leży razem w jednym bloku</b>: cały wiersz czy cała kolumna. Wybierz pytanie i układ, a potem porównaj liczniki.</p>',
    visual: 'storage',
    after: '<b>Wniosek.</b> Zapis <b>wierszowy</b> (row-oriented) trzyma razem wszystkie kolumny jednego wiersza, więc jest dobry dla OLTP. Zapis <b>kolumnowy</b> (column-oriented) trzyma razem wartości jednej kolumny, więc agregacja czyta tylko potrzebne kolumny. Dlatego PostgreSQL jest wierszowy, a Snowflake kolumnowy.',
    more: {
      title: 'Kompresja i koszt zapisu w układzie kolumnowym',
      html: [
        'Wartości jednej kolumny mają ten sam typ i często się powtarzają (kraj, status), więc kompresują się dobrze. W Snowflake kolumny są zapisane i skompresowane osobno wewnątrz każdej mikropartycji.',
        'Cena: wstawienie albo zmiana jednego wiersza dotyka wszystkich kolumn. Silniki kolumnowe wolą ładowanie hurtowe niż pojedyncze inserty.',
        '<code>SELECT *</code> w hurtowni kolumnowej rezygnuje z głównej zalety: silnik musi przeczytać każdą kolumnę.'
      ]
    },
    bridge: {
      from: 'Snowflake',
      known: 'W Snowflake tabela standardowa jest kolumnowa: wybierasz trzy kolumny z trzydziestu i skan czyta dane tylko tych trzech.',
      fresh: 'To jest ta sama zasada co w ilustracji: w jednym kawałku na dysku leżą wartości jednej kolumny, więc niepotrzebne kolumny są pomijane.',
      breaks: 'Snowflake ma też tabele hybrydowe z zapisem wierszowym i indeksami, przeznaczone do obciążeń operacyjnych. Zdanie „Snowflake jest kolumnowy" dotyczy tabel standardowych, a nie całego produktu.'
    },
    next: 'Jak ułożyć dane w tabele?'
  }
];

/** Ilustracja z pierwszego kroku: dwa pytania do tej samej tabeli. */
export const workloads = {
  columns: ['', 'Aplikacja sklepu', 'Analityk'],
  rows: [
    ['Zapytanie', 'SELECT * FROM orders WHERE order_id = 48213', 'SELECT country, SUM(amount) FROM orders GROUP BY country'],
    ['Ile wierszy dotyka', 'jeden', 'wszystkie'],
    ['Ile kolumn potrzebuje', 'wszystkie', 'dwie'],
    ['Jak często', 'tysiące razy na minutę', 'kilka razy dziennie'],
    ['Co robi z danymi', 'czyta i zmienia', 'tylko czyta'],
    ['Czego wymaga', 'odpowiedzi w milisekundach, spójności przy równoległych zapisach', 'szybkiego skanu dużej ilości danych']
  ]
};

export interface StorageQuery { id: string; label: string; sql: string; rows: number[]; cols: number[]; verdict: { row: string; column: string } }
/**
 * Ilustracja zapisu wierszowego i kolumnowego. Model: blok to jeden wiersz (układ wierszowy) albo jedna kolumna
 * (układ kolumnowy) i jest czytany w całości. Liczniki wynikają z tych danych, patrz test lekcji.
 */
export const storage = {
  assumptions: 'Model uproszczony: 6 zamówień i 5 kolumn, czyli 30 wartości. Blok to jeden wiersz albo jedna kolumna i jest czytany w całości. Wyszukanie wiersza po kluczu w układzie wierszowym korzysta z indeksu, o którym będzie dalej.',
  columns: ['order_id', 'customer', 'country', 'status', 'amount'],
  rows: [
    ['101', 'Anna', 'PL', 'paid', '120'],
    ['102', 'Piotr', 'DE', 'paid', '80'],
    ['103', 'Anna', 'PL', 'new', '45'],
    ['104', 'Ewa', 'CZ', 'paid', '300'],
    ['105', 'Jan', 'DE', 'sent', '60'],
    ['106', 'Ewa', 'CZ', 'paid', '150']
  ],
  queryLabel: 'Pytanie',
  layoutLabel: 'Układ na dysku',
  layouts: [
    { id: 'row', label: 'Wierszowy' },
    { id: 'column', label: 'Kolumnowy' }
  ],
  defaultQuery: 'agg',
  defaultLayout: 'row',
  queries: [
    {
      id: 'point', label: 'Jedno zamówienie',
      sql: 'SELECT * FROM orders WHERE order_id = 104',
      rows: [3], cols: [0, 1, 2, 3, 4],
      verdict: {
        row: 'Cały wiersz leży w jednym bloku. Baza czyta dokładnie to, czego potrzebuje.',
        column: 'Wiersz jest rozłożony na pięć bloków, po jednym na kolumnę. Żeby go złożyć, trzeba sięgnąć do każdego z nich.'
      }
    },
    {
      id: 'agg', label: 'Przychód na kraj',
      sql: 'SELECT country, SUM(amount) FROM orders GROUP BY country',
      rows: [0, 1, 2, 3, 4, 5], cols: [2, 4],
      verdict: {
        row: 'Potrzebne są dwie kolumny, ale leżą w blokach razem z trzema pozostałymi. Baza czyta wszystko.',
        column: 'Baza czyta dwa bloki: country i amount. Trzech pozostałych kolumn nie dotyka.'
      }
    }
  ] as StorageQuery[],
  legend: { read: 'przeczytane', need: 'potrzebne do wyniku' }
};

/** Etap Model, część 1: projekt logiczny i fizyczny. */
export const design = {
  title: 'Co ustalasz o danych, a co o silniku?',
  intro: 'Te same zamówienia można opisać na dwa sposoby. Pierwszy odpowiada na pytanie, <b>co istnieje i jak się łączy</b>. Drugi na pytanie, <b>jak to zapisać w konkretnej bazie</b>, żeby działało szybko.',
  columns: [
    {
      label: 'Projekt logiczny',
      note: 'niezależny od silnika',
      items: ['Encje: klient, zamówienie, produkt', 'Atrybuty: nazwa, miasto, kwota', 'Klucze: co identyfikuje wiersz', 'Relacje: klient ma wiele zamówień', 'Poziom normalizacji']
    },
    {
      label: 'Projekt fizyczny',
      note: 'dla konkretnego silnika',
      items: ['Typy danych: NUMBER(10,2), VARCHAR', 'Indeksy albo klucz klastrowania', 'Partycjonowanie', 'Tabela, widok czy model przyrostowy', 'Świadoma denormalizacja pod odczyt']
    }
  ],
  takeaway: '<b>Wniosek.</b> <b>Projekt logiczny</b> opisuje znaczenie danych i nie zmienia się przy migracji na inny silnik. <b>Projekt fizyczny</b> to decyzje wydajnościowe dla wybranej platformy i zmienia się razem z nią. Jeden model logiczny może mieć kilka projektów fizycznych.',
  moreTitle: 'Trzy poziomy: koncepcyjny, logiczny, fizyczny',
  more: [
    'Część zespołów wyróżnia jeszcze poziom <b>koncepcyjny</b>: same pojęcia biznesowe i relacje między nimi, bez atrybutów i kluczy. Służy do rozmowy z biznesem.',
    'Na rozmowie wystarczy pokazać, że rozdzielasz dwa pytania: „co modelujemy" i „jak to zapisujemy". Reszta lekcji idzie w tej kolejności: najpierw model, potem silnik.'
  ],
  bridge: {
    from: 'dbt',
    known: 'W modelu dbt piszesz <code>SELECT</code>, który mówi, jakie kolumny ma tabela i z czego powstaje. Osobno, w konfiguracji, ustawiasz <code>materialized</code> i <code>cluster_by</code>.',
    fresh: 'SQL modelu jest bliżej projektu logicznego, a konfiguracja materializacji i klastrowania to projekt fizyczny. Zmiana tabeli na model przyrostowy nie zmienia znaczenia danych.',
    breaks: 'Podział nie jest czysty. Model dbt jest już napisany w dialekcie konkretnej hurtowni, a decyzja o denormalizacji w marcie zmienia same kolumny, nie tylko sposób zapisu.'
  } as Bridge
};

export interface NfTable { name: string; key: string[]; columns: string[]; rows: string[][]; flag?: string[] }
export interface NfStep { id: string; label: string; rule: string; tables: NfTable[]; fixed: string; problem: string }
/**
 * Etap Model, część 2: normalizacja krok po kroku na trzech zamówieniach. `key` to kolumny klucza głównego,
 * `flag` to kolumny, które łamią następną postać normalną.
 */
export const normalization = {
  title: 'Co się psuje, gdy jeden fakt jest zapisany w kilku miejscach?',
  intro: 'Trzy zamówienia zapisane tak, jak przyszły z formularza. Przechodź kolejne kroki: każdy usuwa jeden rodzaj powtórzenia. Kolumny zaznaczone kolorem to te, które łamią następną regułę.',
  assumptions: 'Dane wymyślone. Podkreślone kolumny tworzą klucz główny tabeli.',
  defaultStep: 'raw',
  steps: [
    {
      id: 'raw', label: 'Start', rule: 'Jedna szeroka tabela, w komórce bywa lista.',
      tables: [{
        name: 'orders_raw', key: ['order_id'], columns: ['order_id', 'customer', 'city', 'items'], flag: ['items'],
        rows: [['101', 'Anna', 'Gdańsk', 'kabel ×2, mysz ×1'], ['102', 'Anna', 'Gdańsk', 'mysz ×1'], ['103', 'Piotr', 'Kraków', 'kabel ×1']]
      }],
      fixed: 'Nic jeszcze nie naprawiono.',
      problem: 'Kolumna items trzyma listę. Nie da się policzyć sprzedanych kabli zwykłym SUM ani połączyć pozycji z tabelą produktów.'
    },
    {
      id: '1nf', label: '1NF', rule: 'Jedna wartość w komórce, bez powtarzających się grup, każdy wiersz ma klucz.',
      tables: [{
        name: 'order_lines', key: ['order_id', 'product_id'], columns: ['order_id', 'product_id', 'product', 'qty', 'customer', 'city'], flag: ['product', 'customer', 'city'],
        rows: [['101', 'P1', 'kabel', '2', 'Anna', 'Gdańsk'], ['101', 'P2', 'mysz', '1', 'Anna', 'Gdańsk'], ['102', 'P2', 'mysz', '1', 'Anna', 'Gdańsk'], ['103', 'P1', 'kabel', '1', 'Piotr', 'Kraków']]
      }],
      fixed: 'Lista została rozbita na wiersze: jedna pozycja zamówienia to jeden wiersz, a kluczem jest para (order_id, product_id).',
      problem: 'Nazwa produktu zależy tylko od product_id, a klient tylko od order_id. To zależności od części klucza. Zmiana nazwy produktu wymaga poprawienia wielu wierszy.'
    },
    {
      id: '2nf', label: '2NF', rule: 'Każda kolumna niekluczowa zależy od całego klucza, a nie od jego części.',
      tables: [
        { name: 'order_lines', key: ['order_id', 'product_id'], columns: ['order_id', 'product_id', 'qty'], rows: [['101', 'P1', '2'], ['101', 'P2', '1'], ['102', 'P2', '1'], ['103', 'P1', '1']] },
        { name: 'products', key: ['product_id'], columns: ['product_id', 'product'], rows: [['P1', 'kabel'], ['P2', 'mysz']] },
        { name: 'orders', key: ['order_id'], columns: ['order_id', 'customer_id', 'customer', 'city'], flag: ['customer', 'city'], rows: [['101', 'C7', 'Anna', 'Gdańsk'], ['102', 'C7', 'Anna', 'Gdańsk'], ['103', 'C9', 'Piotr', 'Kraków']] }
      ],
      fixed: 'Produkt ma własną tabelę, a dane zamówienia nie powtarzają się w każdej pozycji.',
      problem: 'Miasto zależy od klienta, a dopiero przez klienta od zamówienia. To zależność przechodnia. Anna i Gdańsk są zapisane dwa razy.'
    },
    {
      id: '3nf', label: '3NF', rule: 'Kolumny niekluczowe zależą tylko od klucza, a nie od innych kolumn niekluczowych.',
      tables: [
        { name: 'order_lines', key: ['order_id', 'product_id'], columns: ['order_id', 'product_id', 'qty'], rows: [['101', 'P1', '2'], ['101', 'P2', '1'], ['102', 'P2', '1'], ['103', 'P1', '1']] },
        { name: 'products', key: ['product_id'], columns: ['product_id', 'product'], rows: [['P1', 'kabel'], ['P2', 'mysz']] },
        { name: 'orders', key: ['order_id'], columns: ['order_id', 'customer_id'], rows: [['101', 'C7'], ['102', 'C7'], ['103', 'C9']] },
        { name: 'customers', key: ['customer_id'], columns: ['customer_id', 'customer', 'city'], rows: [['C7', 'Anna', 'Gdańsk'], ['C9', 'Piotr', 'Kraków']] }
      ],
      fixed: 'Każdy fakt jest zapisany raz. Przeprowadzka Anny to zmiana jednego wiersza w tabeli customers.',
      problem: 'Żadna reguła nie jest złamana. Nowy koszt: odpowiedź na pytanie „ile kabli kupiono w Gdańsku" wymaga połączenia czterech tabel.'
    }
  ] as NfStep[],
  takeaway: '<b>Wniosek.</b> <b>Normalizacja</b> to rozbijanie tabel tak, żeby każdy fakt był zapisany raz. Chroni przed <b>anomaliami</b>: niespójną zmianą, brakiem miejsca na nowy fakt i przypadkową utratą danych przy usuwaniu. Płacisz za to joinami przy odczycie. Dokumentacja Microsoft podaje, że trzecia postać normalna jest uznawana za wystarczającą w większości zastosowań.',
  moreTitle: 'Trzy anomalie, które warto umieć nazwać',
  more: [
    '<b>Anomalia aktualizacji.</b> Ten sam fakt leży w wielu wierszach, a zmiana trafia tylko do części z nich. Baza zawiera dwie wersje prawdy.',
    '<b>Anomalia wstawiania.</b> Nie da się zapisać faktu, dopóki nie istnieje inny. W tabeli startowej nie zapiszesz klienta, który jeszcze nic nie zamówił.',
    '<b>Anomalia usuwania.</b> Usunięcie jednego faktu kasuje przy okazji inny. Usunięcie zamówienia 103 usuwa jedyną informację o tym, że Piotr mieszka w Krakowie.'
  ]
};

/** Etap Model, część 3: ten sam zestaw danych w 3NF i jako jedna szeroka tabela. Liczby wynikają z danych normalizacji, patrz test. */
export const denormalization = {
  title: 'Dlaczego w hurtowni świadomie cofasz normalizację?',
  intro: 'Model w 3NF jest bezpieczny dla zapisu. Analityk zadaje jednak pytania przekrojowe. Porównaj oba układy dla tego samego pytania i tej samej zmiany.',
  question: 'Pytanie: ile sztuk sprzedano w każdym mieście?',
  change: 'Zmiana: Anna przeprowadza się z Gdańska do Sopotu.',
  defaultVariant: 'normalized',
  variants: [
    {
      id: 'normalized', label: 'Znormalizowany (3NF)',
      sql: 'SELECT c.city, SUM(l.qty)\nFROM order_lines l\nJOIN orders o ON o.order_id = l.order_id\nJOIN customers c ON c.customer_id = o.customer_id\nGROUP BY c.city',
      joins: 2, cityCopies: 2, rowsToUpdate: 1,
      verdict: 'Miasto każdego klienta jest zapisane raz, więc zmiana to jeden wiersz. Odczyt wymaga dwóch joinów i znajomości kluczy.'
    },
    {
      id: 'wide', label: 'Zdenormalizowany (szeroka tabela)',
      sql: 'SELECT city, SUM(qty)\nFROM order_lines_wide\nGROUP BY city',
      joins: 0, cityCopies: 4, rowsToUpdate: 3,
      verdict: 'Zapytanie nie ma joinów i zrozumie je każde narzędzie BI. Miasto jest skopiowane do każdej pozycji, więc zmiana oznacza poprawienie trzech wierszy albo przebudowę tabeli.'
    }
  ],
  tiles: { joins: 'joiny w zapytaniu', cityCopies: 'wiersze z zapisanym miastem', rowsToUpdate: 'wiersze do zmiany po przeprowadzce' },
  takeaway: '<b>Wniosek.</b> <b>Denormalizacja</b> to świadome powtórzenie danych, żeby odczyt był prostszy i tańszy. Kompromis: mniej joinów i prostszy SQL za redundancję i droższą zmianę. W hurtowni jest bezpieczniejsza niż w bazie aplikacji, bo tabela zdenormalizowana jest pochodną: nie poprawiasz jej ręcznie, tylko odbudowujesz ze źródła.',
  moreTitle: 'Kiedy denormalizacja się mści',
  more: [
    '<b>Ziarno.</b> Jeśli do szerokiej tabeli na poziomie pozycji dołączysz kwotę całego zamówienia, <code>SUM</code> policzy ją kilka razy. Każda tabela powinna mieć nazwane ziarno, czyli odpowiedź na pytanie, co oznacza jeden wiersz.',
    '<b>Historia.</b> Po przebudowie wszystkie stare zamówienia Anny pokażą Sopot. Jeśli raport ma pokazywać miasto z dnia zamówienia, trzeba przechowywać historię atrybutów. To osobny temat modelowania wymiarowego.',
    '<b>Koszt przebudowy.</b> Zmiana jednego atrybutu może oznaczać przepisanie dużej części tabeli. Przy dużych tabelach decyduje to o wyborze między pełną przebudową a modelem przyrostowym.'
  ],
  bridge: {
    from: 'dbt',
    known: 'W projekcie dbt modele staging są blisko źródła i zwykle zachowują jego znormalizowany kształt, a marty łączą je w tabele faktów i wymiarów albo w jedną szeroką tabelę dla BI.',
    fresh: 'To dokładnie ten kompromis: znormalizowane źródło prawdy i zdenormalizowane modele do odczytu, odbudowywane z niego przy każdym uruchomieniu.',
    breaks: 'Schemat gwiazdy nie jest pełną denormalizacją: tabela faktów trzyma klucze i miary, a spłaszczone są wymiary. I nie każdy staging jest w 3NF, bo źródła bywają już zdenormalizowane.'
  } as Bridge
};

export interface Engine { id: string; label: string }
export interface KeyAttempt { id: string; label: string; sql: string; rule: string; outcome: Record<string, { ok: boolean; text: string }> }
/**
 * Etap Model, część 4: klucze i integralność referencyjna. `enforced` to tabela z dokumentacji:
 * PostgreSQL (ddl-constraints) oraz Snowflake (constraints-overview, tables-hybrid).
 */
export const keys = {
  title: 'Kto pilnuje, że zamówienie ma klienta?',
  intro: '<b>Klucz główny</b> (primary key) to kolumna albo zestaw kolumn, który jednoznacznie identyfikuje wiersz: jest unikalny i niepusty. <b>Klucz obcy</b> (foreign key) to kolumna, której wartość musi istnieć jako klucz w innej tabeli. Reguła „nie ma zamówienia bez klienta" nazywa się <b>integralnością referencyjną</b>. Sprawdź, co zrobią trzy silniki z trzema błędnymi zapisami.',
  assumptions: 'W każdym przypadku tabela ma zadeklarowane: PRIMARY KEY na order_id, FOREIGN KEY z customer_id do customers oraz NOT NULL na amount. Zachowanie według dokumentacji PostgreSQL 19 i Snowflake.',
  engineLabel: 'Silnik',
  attemptLabel: 'Próba zapisu',
  engines: [
    { id: 'postgres', label: 'PostgreSQL' },
    { id: 'standard', label: 'Snowflake · tabela standardowa' },
    { id: 'hybrid', label: 'Snowflake · tabela hybrydowa' }
  ] as Engine[],
  defaultEngine: 'postgres',
  defaultAttempt: 'duplicate',
  attempts: [
    {
      id: 'duplicate', label: 'Drugi raz ten sam klucz',
      sql: "INSERT INTO orders (order_id, customer_id, amount)\nVALUES (101, 'C7', 50);   -- 101 już istnieje",
      rule: 'PRIMARY KEY',
      outcome: {
        postgres: { ok: false, text: 'Odrzucone. Klucz główny jest wymuszany, a do sprawdzania unikalności PostgreSQL sam tworzy unikalny indeks B-tree.' },
        standard: { ok: true, text: 'Przyjęte. Tabela ma teraz dwa wiersze z order_id = 101. PRIMARY KEY w tabeli standardowej jest deklaracją, której Snowflake nie wymusza.' },
        hybrid: { ok: false, text: 'Odrzucone. W tabeli hybrydowej klucz główny jest wymagany i wymuszany.' }
      }
    },
    {
      id: 'orphan', label: 'Zamówienie bez klienta',
      sql: "INSERT INTO orders (order_id, customer_id, amount)\nVALUES (104, 'C99', 50);  -- klienta C99 nie ma",
      rule: 'FOREIGN KEY',
      outcome: {
        postgres: { ok: false, text: 'Odrzucone. Wartość klucza obcego musi pasować do wiersza w tabeli, na którą wskazuje.' },
        standard: { ok: true, text: 'Przyjęte. Powstaje wiersz osierocony: inner join z customers go zgubi, a left join zwróci puste dane klienta.' },
        hybrid: { ok: false, text: 'Odrzucone. Tabele hybrydowe wymuszają integralność referencyjną.' }
      }
    },
    {
      id: 'null', label: 'Brak kwoty',
      sql: "INSERT INTO orders (order_id, customer_id, amount)\nVALUES (105, 'C7', NULL);  -- amount jest NOT NULL",
      rule: 'NOT NULL',
      outcome: {
        postgres: { ok: false, text: 'Odrzucone. NOT NULL jest wymuszane.' },
        standard: { ok: false, text: 'Odrzucone. NOT NULL (oraz CHECK) to ograniczenia, które Snowflake wymusza także w tabelach standardowych.' },
        hybrid: { ok: false, text: 'Odrzucone. NOT NULL jest wymuszane.' }
      }
    }
  ] as KeyAttempt[],
  takeaway: '<b>Wniosek.</b> W klasycznej bazie relacyjnej klucze są regułami, które silnik sprawdza przy każdym zapisie. W tabelach standardowych Snowflake <code>PRIMARY KEY</code>, <code>UNIQUE</code> i <code>FOREIGN KEY</code> są metadanymi: można je zadeklarować, ale nie chronią danych. Wymuszane są <code>NOT NULL</code> i <code>CHECK</code>. Integralność w hurtowni zapewnia więc potok, a nie silnik.',
  testsTitle: 'Jak pilnujesz kluczy w dbt',
  testsIntro: 'dbt ma cztery wbudowane testy generyczne: <code>unique</code>, <code>not_null</code>, <code>accepted_values</code> i <code>relationships</code>. Trzy z nich odpowiadają ograniczeniom, których Snowflake nie wymusza.',
  testsCodeTitle: 'models/schema.yml',
  testsLines: [
    { code: '- name: order_id', label: 'Kolumna klucza', text: 'Kolumna, która ma identyfikować wiersz modelu <code>orders</code>.' },
    { code: '  data_tests: [unique, not_null]', label: 'Odpowiednik PRIMARY KEY', text: 'Dwa testy razem sprawdzają to, co w klasycznej bazie wymusza klucz główny. Każdy test to zapytanie uruchamiane po zbudowaniu modelu, które szuka wierszy łamiących regułę.' },
    { code: '- name: customer_id', label: 'Kolumna klucza obcego', text: 'Kolumna, która ma wskazywać na istniejącego klienta.' },
    { code: '  data_tests:', label: 'Lista testów kolumny', text: 'Testy kolumny <code>customer_id</code>.' },
    { code: "    - relationships: {to: ref('customers'), field: customer_id}", label: 'Odpowiednik FOREIGN KEY', text: 'Sprawdza, że każda wartość <code>customer_id</code> w zamówieniach istnieje w modelu <code>customers</code>. Dokumentacja dbt nazywa to wprost integralnością referencyjną. Dokładna składnia argumentów zależy od wersji dbt.' }
  ] as ExplainedLine[],
  moreTitle: 'RELY, czyli po co deklarować klucze, których nikt nie wymusza',
  more: [
    'Według dokumentacji Snowflake niewymuszane ograniczenia nadal są przydatne jako metadane i dokumentacja, a narzędzia BI i modelowania odczytują z nich klucze i relacje.',
    'Właściwość <code>RELY</code> mówi optymalizatorowi, że może ograniczeniu zaufać, na przykład żeby usunąć z planu zbędny join. To obietnica, a nie kontrola: dokumentacja ostrzega, że przy <code>RELY</code> i złamanej integralności wyniki mogą być niepoprawne.',
    'dbt pozwala też deklarować ograniczenia w kontrakcie modelu, ale w Snowflake większość z nich pozostaje metadanymi. Strona dbt podaje, że sprawdzane jest tylko <code>not null</code>, a o <code>check</code> pisze, że nie jest obsługiwany. Dokumentacja Snowflake mówi dziś, że <code>CHECK</code> jest obsługiwany i wymuszany, więc w tym punkcie strony się różnią i przed użyciem warto to sprawdzić na swojej wersji.'
  ],
  bridge: {
    from: 'Snowflake i dbt',
    known: 'W dbt dodajesz do modelu testy <code>unique</code>, <code>not_null</code> i <code>relationships</code>, a w modelu deduplikujesz po kluczu, np. przez <code>QUALIFY ROW_NUMBER()</code>.',
    fresh: 'To jest Twoja wersja klucza głównego i obcego: ta sama reguła, którą klasyczna baza wymusza sama przy zapisie.',
    breaks: 'Ograniczenie w bazie zapobiega: błędny wiersz nie zostaje zapisany. Test dbt wykrywa: model jest już zbudowany, gdy test zgłasza błąd, więc bez dodatkowych kroków błędne dane mogą trafić do odbiorców.'
  } as Bridge
};

export interface IndexCase { id: string; label: string; sql: string; uses: 'index' | 'range' | 'scan'; pages: number; verdict: string; why: string }
/**
 * Etap Silnik, część 1: wyszukanie przez indeks B-tree i pełny skan. Model ilustracyjny: 1 000 000 wierszy
 * na 10 000 stron, drzewo o wysokości 3. Liczby stron nie są pomiarem.
 */
export const index = {
  title: 'Jak znaleźć jeden wiersz na milion bez czytania miliona?',
  intro: 'Tabela zamówień ma milion wierszy. Bez dodatkowej struktury baza musi przeczytać każdą stronę i sprawdzić każdy wiersz. To <b>full table scan</b>. Wybierz warunek i zobacz, którędy idzie baza, gdy ma indeks na kolumnie z warunku.',
  assumptions: 'Model uproszczony: 1 000 000 wierszy na 10 000 stronach, indeks B-tree o wysokości 3 (korzeń, poziom pośredni, liście). Każdy warunek ma indeks na swojej kolumnie. Liczby stron są ilustracją, nie pomiarem.',
  tablePages: 10000,
  treeHeight: 3,
  caseLabel: 'Warunek',
  defaultCase: 'equal',
  levels: ['korzeń', 'poziom pośredni', 'liście', 'tabela'],
  cases: [
    {
      id: 'equal', label: 'Równość po kluczu', sql: 'WHERE order_id = 48213', uses: 'index', pages: 4,
      verdict: 'Indeks: 3 strony drzewa i 1 strona tabeli.',
      why: 'Drzewo jest posortowane. Korzeń mówi, w której gałęzi leży 48213, gałąź wskazuje liść, a liść zawiera adres wiersza.'
    },
    {
      id: 'range', label: 'Wąski zakres', sql: "WHERE order_date BETWEEN '2025-03-01' AND '2025-03-02'", uses: 'range', pages: 60,
      verdict: 'Indeks: zejście do pierwszej wartości, potem sąsiednie liście.',
      why: 'Liście leżą w kolejności klucza, więc po znalezieniu początku zakresu baza czyta kolejne liście. Im szerszy zakres, tym więcej stron tabeli trzeba odwiedzić.'
    },
    {
      id: 'broad', label: 'Większość wierszy', sql: "WHERE status = 'paid'   -- 70% tabeli", uses: 'scan', pages: 10000,
      verdict: 'Pełny skan, mimo że indeks istnieje.',
      why: 'Warunek spełnia 700 000 wierszy. Skakanie po tabeli za każdym z nich jest droższe niż przeczytanie jej po kolei. O wyborze decyduje planer na podstawie statystyk.'
    },
    {
      id: 'suffix', label: 'Wzorzec bez początku', sql: "WHERE customer LIKE '%ski'", uses: 'scan', pages: 10000,
      verdict: 'Pełny skan: indeks B-tree nie obsługuje takiego wzorca.',
      why: "Posortowane drzewo pozwala szukać po początku wartości. Według dokumentacji PostgreSQL wzorzec LIKE 'Kow%' może użyć indeksu B-tree, a LIKE '%ski' nie."
    },
    {
      id: 'function', label: 'Funkcja na kolumnie', sql: "WHERE lower(email) = 'anna@example.com'", uses: 'scan', pages: 10000,
      verdict: 'Pełny skan przy zwykłym indeksie na email.',
      why: 'Indeks trzyma posortowane wartości email, a zapytanie pyta o wynik funkcji. Dokumentacja PostgreSQL mówi, że takie zapytanie może użyć indeksu zbudowanego na wyrażeniu lower(email).'
    }
  ] as IndexCase[],
  takeaway: '<b>Wniosek.</b> <b>Indeks B-tree</b> to osobna, posortowana struktura w kształcie zrównoważonego drzewa, która prowadzi od wartości klucza do adresu wiersza. Przyspiesza selektywne wyszukiwania, zakresy i sortowanie. Kosztuje przy każdym zapisie, bo trzeba go aktualizować, i zajmuje miejsce. Nie pomaga, gdy warunek spełnia duża część tabeli.',
  snowTitle: 'A w Snowflake?',
  snowIntro: 'W tabelach standardowych Snowflake nie tworzysz indeksów B-tree. Ten sam problem, czyli „nie czytaj wszystkiego", jest rozwiązany innymi mechanizmami.',
  snowColumns: ['Mechanizm', 'Co robi', 'Gdzie'],
  snowRows: [
    ['Indeks B-tree', 'Prowadzi do pojedynczych wierszy', 'Klasyczne bazy relacyjne, np. PostgreSQL'],
    ['Pruning mikropartycji', 'Pomija całe mikropartycje na podstawie zakresu wartości kolumn', 'Snowflake, automatycznie'],
    ['Klucz klastrowania', 'Porządkuje wiersze, żeby zakresy były wąskie i pruning pomijał więcej', 'Snowflake, duże tabele'],
    ['Search optimization service', 'Utrzymuje dodatkową strukturę dla selektywnych wyszukiwań punktowych', 'Snowflake, osobny koszt'],
    ['Indeksy tabel hybrydowych', 'Indeks klucza głównego i indeksy dodatkowe', 'Snowflake, tylko tabele hybrydowe']
  ],
  snowTakeaway: '<b>Wniosek.</b> Zdanie „Snowflake nie ma indeksów" jest uproszczeniem, na którym można się potknąć. Dokładniej: tabele standardowe nie mają indeksów B-tree tworzonych przez użytkownika i opierają się na pruningu, a tabele hybrydowe mają prawdziwe indeksy.',
  moreTitle: 'Indeks wielokolumnowy i kolejność kolumn',
  more: [
    'Indeks na <code>(country, order_date)</code> jest posortowany najpierw po kraju, potem po dacie w obrębie kraju. Według dokumentacji PostgreSQL taki indeks jest najbardziej efektywny, gdy zapytanie ma warunki na kolumnach wiodących, czyli tych z lewej.',
    'Zapytanie filtrujące tylko po <code>order_date</code> nie zawęzi tak samo przeszukiwanej części indeksu. Dlatego kolejność kolumn w indeksie dobiera się pod najczęstsze warunki.',
    'Dokumentacja radzi też usuwać indeksy rzadko używane: każdy indeks trzeba utrzymywać przy każdej zmianie danych.',
    'Deklaracja klucza obcego w PostgreSQL nie tworzy automatycznie indeksu na kolumnie odwołującej się. Dokumentacja zaleca rozważenie takiego indeksu, bo przyspiesza joiny i kontrolę przy usuwaniu.'
  ]
};

export interface PruneLayout { id: string; label: string; note: string; parts: { date: [number, number]; customer: [number, number] }[] }
export interface PruneFilter { id: string; label: string; sql: string; column: 'date' | 'customer'; range: [number, number] }
/**
 * Etap Silnik, część 2: pruning mikropartycji. 8 mikropartycji, dla każdej zakres miesięcy (1..8) i zakres
 * identyfikatorów klienta. Mikropartycja jest czytana, jeśli jej zakres przecina zakres filtra. Dane wymyślone.
 */
export const pruning = {
  title: 'Skąd baza wie, czego nie musi czytać?',
  intro: 'Tabela ma osiem miesięcy zamówień, a raport dotyczy marca. Snowflake dzieli tabelę na <b>mikropartycje</b> i dla każdej zapamiętuje najmniejszą i największą wartość każdej kolumny. Jeśli zakres mikropartycji nie przecina filtra, mikropartycji nie trzeba czytać. Zmień ułożenie danych i filtr.',
  assumptions: 'Ilustracja: 8 mikropartycji zamiast tysięcy, miesiące 2025 roku jako liczby 1–8, klienci o numerach 1–8000. Mikropartycja jest czytana, gdy jej zakres min–max przecina filtr.',
  layoutLabel: 'Ułożenie danych',
  filterLabel: 'Filtr',
  months: ['sty', 'lut', 'mar', 'kwi', 'maj', 'cze', 'lip', 'sie'],
  defaultLayout: 'byDate',
  defaultFilter: 'march',
  layouts: [
    {
      id: 'byDate', label: 'Uporządkowane po dacie', note: 'Dane ładowane chronologicznie albo klucz klastrowania na order_date.',
      parts: [
        { date: [1, 1], customer: [3, 7990] }, { date: [2, 2], customer: [1, 7950] }, { date: [3, 3], customer: [8, 8000] }, { date: [4, 4], customer: [2, 7900] },
        { date: [5, 5], customer: [5, 7980] }, { date: [6, 6], customer: [1, 7940] }, { date: [7, 7], customer: [4, 7999] }, { date: [8, 8], customer: [6, 7970] }
      ]
    },
    {
      id: 'mixed', label: 'Wymieszane', note: 'Wiersze z różnych miesięcy i od różnych klientów trafiają do tych samych mikropartycji.',
      parts: [
        { date: [1, 8], customer: [2, 7980] }, { date: [1, 7], customer: [5, 7990] }, { date: [2, 8], customer: [1, 7900] }, { date: [1, 8], customer: [9, 8000] },
        { date: [4, 8], customer: [3, 7960] }, { date: [1, 6], customer: [7, 7940] }, { date: [2, 8], customer: [4, 7999] }, { date: [1, 8], customer: [6, 7910] }
      ]
    },
    {
      id: 'byCustomer', label: 'Uporządkowane po kliencie', note: 'Klucz klastrowania na customer_id.',
      parts: [
        { date: [1, 8], customer: [1, 1000] }, { date: [1, 8], customer: [1001, 2000] }, { date: [1, 8], customer: [2001, 3000] }, { date: [1, 8], customer: [3001, 4000] },
        { date: [1, 8], customer: [4001, 5000] }, { date: [1, 8], customer: [5001, 6000] }, { date: [1, 8], customer: [6001, 7000] }, { date: [1, 8], customer: [7001, 8000] }
      ]
    }
  ] as PruneLayout[],
  filters: [
    { id: 'march', label: 'Marzec', sql: "WHERE order_date >= '2025-03-01' AND order_date < '2025-04-01'", column: 'date', range: [3, 3] },
    { id: 'customer', label: 'Jeden klient', sql: 'WHERE customer_id = 4711', column: 'customer', range: [4711, 4711] }
  ] as PruneFilter[],
  takeaway: '<b>Wniosek.</b> <b>Partition pruning</b> to pomijanie całych kawałków tabeli na podstawie metadanych, bez czytania danych. Działa tylko wtedy, gdy zakresy są wąskie, a to zależy od fizycznego uporządkowania wierszy, czyli od <b>klastrowania</b>. Tabela ma jeden porządek fizyczny: uporządkowanie po dacie nie pomaga filtrowi po kliencie i odwrotnie. Ten sam zakres przeczytany przez mikropartycję nie oznacza, że wszystkie jej wiersze pasują: reszta filtra jest stosowana po odczycie.',
  compareTitle: 'Partycjonowanie deklarowane a mikropartycje Snowflake',
  compareColumns: ['', 'Partycjonowanie deklarowane', 'Mikropartycje Snowflake'],
  compareRows: [
    ['Kto definiuje', 'Projektant: kolumna i granice (zakres, lista, hash)', 'Snowflake, automatycznie, w kolejności ładowania'],
    ['Rozmiar', 'Wynika z danych, np. jeden miesiąc', '50–500 MB danych przed kompresją'],
    ['Zakresy', 'Rozłączne z definicji', 'Mogą się pokrywać'],
    ['Jak poprawić pruning', 'Lepszy klucz partycjonowania', 'Kolejność ładowania albo klucz klastrowania'],
    ['Typowy koszt błędu', 'Za dużo partycji: wolniejsze planowanie, małe pliki', 'Słabe klastrowanie: skan prawie całej tabeli']
  ],
  moreTitle: 'Kiedy klucz klastrowania ma sens',
  more: [
    'Dokumentacja Snowflake zaleca klucze klastrowania dla dużych tabel, zwykle liczonych w wielu terabajtach, i tylko wtedy, gdy zapytania wyraźnie na tym zyskają. Utrzymanie porządku zużywa kredyty.',
    'Zalecenie dla większości tabel: najwyżej 3–4 kolumny lub wyrażenia w kluczu, uporządkowane od najniższej do najwyższej kardynalności.',
    'Zastrzeżenie z dokumentacji: Snowflake nie pomija mikropartycji na podstawie warunku z podzapytaniem, nawet jeśli podzapytanie zwraca stałą.',
    'W dbt-snowflake klucz klastrowania ustawia konfiguracja <code>cluster_by</code> na tabeli albo modelu przyrostowym. W PostgreSQL partycjonowanie deklaruje się w definicji tabeli (zakres, lista albo hash), a dokumentacja radzi partycjonować po kolumnach, które najczęściej występują w <code>WHERE</code>.'
  ],
  bridge: {
    from: 'Snowflake',
    known: 'W Query Profile przy skanie tabeli widzisz dwie liczby: <code>Partitions scanned</code> i <code>Partitions total</code>.',
    fresh: 'To jest licznik z tej ilustracji. Dokumentacja Snowflake mówi, że pruning jest skuteczny, gdy pierwsza liczba jest małym ułamkiem drugiej.',
    breaks: 'Ilustracja ma 8 mikropartycji i idealnie równe zakresy. W prawdziwej tabeli są ich tysiące, zakresy częściowo się pokrywają, a o wyniku decyduje też to, jak dane były dopisywane i zmieniane po pierwszym załadowaniu.'
  } as Bridge
};

/** Etap Silnik, część 3: plan wykonania. Wydruki EXPLAIN to przykłady skopiowane z dokumentacji PostgreSQL (using-explain). */
export const plans = {
  title: 'Jak sprawdzić, co baza naprawdę zrobiła?',
  intro: 'SQL mówi, <b>co</b> chcesz dostać, a nie <b>jak</b> to policzyć. O sposobie decyduje optymalizator, a jego decyzję zapisuje <b>plan wykonania</b>: drzewo operatorów, przez które wiersze płyną od tabel do wyniku. Poniżej trzy plany z dokumentacji PostgreSQL dla tabeli <code>tenk1</code> o 10 000 wierszy.',
  codeTitle: 'EXPLAIN · przykłady z dokumentacji PostgreSQL',
  lines: [
    { code: 'Seq Scan on tenk1  (cost=0.00..445.00 rows=10000 width=244)', label: 'SELECT * FROM tenk1', text: '<code>Seq Scan</code> to pełny skan tabeli. W nawiasie są szacunki planera: koszt do pierwszego wiersza i koszt całkowity (w umownych jednostkach), przewidywana liczba wierszy i średnia szerokość wiersza w bajtach.' },
    { code: 'Index Scan using tenk1_unique1 on tenk1  (cost=0.29..8.30 rows=1 width=244)', label: 'WHERE unique1 = 42', text: 'Ta sama tabela z selektywnym warunkiem. Planer wybrał indeks, a koszt całkowity spadł z 445 do 8,30. To szacunek planera, nie zmierzony czas.' },
    { code: '  Index Cond: (unique1 = 42)', label: 'Warunek użyty w indeksie', text: 'Linia wcięta pod operatorem opisuje jego szczegóły. <code>Index Cond</code> to warunek, po którym baza zeszła w drzewie indeksu.' },
    { code: 'Seq Scan on tenk1  (cost=0.00..470.00 rows=7000 width=244) (actual time=0.030..1.995 rows=7000.00 loops=1)', label: 'EXPLAIN ANALYZE ... WHERE ten < 7', text: '<code>EXPLAIN ANALYZE</code> wykonuje zapytanie i dopisuje wartości rzeczywiste. Tu szacunek (7000 wierszy) zgadza się z rzeczywistością. Warunek spełnia 70% tabeli, więc planer wybrał skan, a nie indeks.' },
    { code: '  Rows Removed by Filter: 3000', label: 'Wiersze przeczytane i odrzucone', text: 'Baza przeczytała 10 000 wierszy, żeby oddać 7000. Duża liczba w tym miejscu przy małym wyniku oznacza, że baza czyta dużo danych na próżno.' }
  ] as ExplainedLine[],
  takeaway: '<b>Wniosek.</b> Plan czytasz, szukając dwóch rzeczy: <b>najdroższego operatora</b> oraz miejsca, w którym <b>szacunek rozmija się z rzeczywistością</b>. Dokumentacja PostgreSQL podaje to jako najważniejszą rzecz do sprawdzenia: czy szacowane liczby wierszy są bliskie faktycznym. Zły szacunek prowadzi do złego wyboru planu.',
  profileTitle: 'To samo w Snowflake: Query Profile',
  profileIntro: 'W Snowflake <code>EXPLAIN</code> zwraca plan logiczny bez wykonania zapytania. Co się faktycznie stało, pokazuje Query Profile. Dokumentacja wymienia cztery typowe problemy, które tam widać.',
  profileColumns: ['Co widzisz w Query Profile', 'Co to znaczy', 'Od czego zacząć'],
  profileRows: [
    ['Partitions scanned bliskie Partitions total', 'Nieskuteczny pruning: filtr nie eliminuje mikropartycji', 'Filtr po kolumnie, po której dane są uporządkowane; ocena klastrowania'],
    ['Po joinie dużo więcej wierszy niż na wejściu', '„Eksplodujący" join: klucz nie jest unikalny albo brakuje warunku', 'Ziarno obu stron joina, unikalność klucza'],
    ['Bytes spilled to local / remote storage', 'Operacja nie mieści się w pamięci i zrzuca dane na dysk', 'Mniej danych w operacji (filtr, kolumny, wcześniejsza agregacja), potem większy warehouse'],
    ['UNION zamiast UNION ALL', 'Dodatkowe usuwanie duplikatów', 'UNION ALL, jeśli duplikaty nie mogą wystąpić albo nie szkodzą']
  ],
  profileTakeaway: '<b>Wniosek.</b> Kolejność, którą warto umieć powiedzieć: najpierw plan, potem przyczyna (za dużo czytanych danych, za dużo przetwarzanych wierszy, brak pamięci), a dopiero na końcu większy warehouse. Większy warehouse pomaga na brak pamięci, ale nie naprawi braku pruningu ani joina, który mnoży wiersze.',
  moreTitle: 'EXPLAIN w Snowflake: co zwraca i ile kosztuje',
  more: [
    'Według dokumentacji <code>EXPLAIN</code> kompiluje instrukcję, ale jej nie wykonuje, więc nie wymaga działającego warehouse. Kompilacja zużywa zasoby warstwy cloud services.',
    'Wynik zawiera m.in. kolumny <code>operation</code>, <code>partitionsTotal</code>, <code>partitionsAssigned</code> i <code>bytesAssigned</code>, więc pruning da się ocenić jeszcze przed uruchomieniem zapytania.',
    'Plan przed wykonaniem i profil po wykonaniu to dwie różne rzeczy: pierwszy mówi, co silnik zamierza, drugi, ile to faktycznie kosztowało.'
  ]
};

export interface IsoLevel { id: string; label: string; dirty: boolean; nonRepeatable: boolean; phantom: boolean; note: string }
/**
 * Etap Silnik, część 4: ACID i izolacja. Tabela anomalii według standardu SQL, za dokumentacją PostgreSQL
 * (transaction-iso, tabela 13.1). `true` oznacza, że standard dopuszcza anomalię na tym poziomie.
 */
export const acid = {
  title: 'Co się stanie, gdy system padnie w połowie przelewu?',
  intro: 'Przelew 100 zł to dwie instrukcje. Jeśli wykona się tylko pierwsza, pieniądze znikają. <b>Transakcja</b> spina kilka instrukcji w jedną operację typu wszystko albo nic.',
  code: 'BEGIN;\nUPDATE accounts SET balance = balance - 100 WHERE name = \'Alice\';\nUPDATE accounts SET balance = balance + 100 WHERE name = \'Bob\';\nCOMMIT;',
  letters: [
    { letter: 'A', name: 'Atomicity · atomowość', text: 'Obie instrukcje wchodzą w życie albo żadna. Awaria przed COMMIT cofa wszystko.' },
    { letter: 'C', name: 'Consistency · spójność', text: 'Transakcja zostawia bazę w stanie zgodnym z regułami, które baza zna i wymusza, np. z ograniczeniami.' },
    { letter: 'I', name: 'Isolation · izolacja', text: 'Inna transakcja nie zobaczy stanu „odjęto, ale jeszcze nie dodano".' },
    { letter: 'D', name: 'Durability · trwałość', text: 'Po COMMIT zmiana przetrwa awarię.' }
  ],
  isoTitle: 'Izolacja ma poziomy',
  isoIntro: 'Pełna izolacja ogranicza współbieżność, dlatego standard SQL definiuje cztery poziomy. Każdy kolejny wyklucza więcej <b>anomalii</b>, czyli sytuacji, w których równoległa transakcja zmienia to, co widzisz. Wybierz poziom.',
  assumptions: 'Tabela pokazuje, co dopuszcza standard SQL, za dokumentacją PostgreSQL. Konkretna baza może być bardziej restrykcyjna niż standard.',
  levelLabel: 'Poziom izolacji',
  defaultLevel: 'rc',
  anomalies: [
    { id: 'dirty', name: 'Dirty read', text: 'Widzisz zmianę, której inna transakcja jeszcze nie zatwierdziła i może wycofać.' },
    { id: 'nonRepeatable', name: 'Non-repeatable read', text: 'Czytasz ten sam wiersz dwa razy i dostajesz różne wartości, bo ktoś zatwierdził zmianę między odczytami.' },
    { id: 'phantom', name: 'Phantom read', text: 'Powtarzasz zapytanie z tym samym warunkiem i dostajesz inny zestaw wierszy, bo ktoś zatwierdził nowy wiersz.' }
  ],
  levels: [
    { id: 'ru', label: 'Read uncommitted', dirty: true, nonRepeatable: true, phantom: true, note: 'Najsłabszy poziom standardu. PostgreSQL traktuje go jak read committed, więc brudnych odczytów w nim nie ma.' },
    { id: 'rc', label: 'Read committed', dirty: false, nonRepeatable: true, phantom: true, note: 'Domyślny w PostgreSQL i jedyny poziom obsługiwany przez Snowflake dla tabel. Każda instrukcja widzi dane zatwierdzone przed jej rozpoczęciem.' },
    { id: 'rr', label: 'Repeatable read', dirty: false, nonRepeatable: false, phantom: true, note: 'Standard dopuszcza tu fantomy, PostgreSQL ich nie dopuszcza. Aplikacja musi być gotowa ponowić transakcję po błędzie serializacji.' },
    { id: 's', label: 'Serializable', dirty: false, nonRepeatable: false, phantom: false, note: 'Wynik jak przy wykonaniu transakcji jedna po drugiej. Najwięcej ponowień i najmniejsza współbieżność.' }
  ] as IsoLevel[],
  takeaway: '<b>Wniosek.</b> <b>ACID</b> to cztery gwarancje transakcji, a <b>poziom izolacji</b> to wybór, ile anomalii dopuszczasz w zamian za współbieżność. Read committed chroni przed brudnymi odczytami, ale dwie instrukcje w tej samej transakcji mogą zobaczyć różne dane.',
  moreTitle: 'MVCC i co read committed znaczy dla potoku w Snowflake',
  more: [
    '<b>MVCC</b> (multiversion concurrency control) to sposób realizacji izolacji przez przechowywanie wersji wierszy. Każda instrukcja czyta migawkę danych, więc według dokumentacji PostgreSQL odczyt nie blokuje zapisu, a zapis nie blokuje odczytu.',
    'Dokumentacja Snowflake mówi, że transakcje gwarantują własności ACID, a read committed jest jedynym poziomem izolacji obsługiwanym obecnie dla tabel.',
    'Skutek dla potoku z kilkoma instrukcjami: jeśli między pierwszą a drugą instrukcją ktoś załaduje nowe dane do źródła, druga instrukcja je zobaczy. Gdy to przeszkadza, czytaj źródło raz (do tabeli pośredniej) albo zrób całość jedną instrukcją, np. jednym <code>MERGE</code>.',
    'Spójność z ACID nie oznacza poprawności biznesowej. Baza pilnuje tylko reguł, które zna. Klucz zadeklarowany, ale niewymuszany, nie jest taką regułą.'
  ]
};

export interface ArchItem { id: string; label: string; layers: { name: string; text: string }[]; facts: string[][]; risk: string }
/** Etap Architektura, część 1: trzy wzorce platformy danych. Warstwy czyta się od dołu (storage) do góry (odbiorcy). */
export const architectures = {
  title: 'Gdzie leżą dane i kto pilnuje ich struktury?',
  intro: 'Trzy wzorce platformy analitycznej różnią się odpowiedzią na dwa pytania: w jakiej postaci leżą dane i kto pilnuje schematu oraz transakcji. Przełączaj wzorce i porównuj warstwy.',
  assumptions: 'Schemat uproszczony: prawdziwe platformy łączą te wzorce, a produkty takie jak Snowflake i Databricks obsługują dziś więcej niż jeden.',
  defaultId: 'warehouse',
  factLabels: ['Dane', 'Schemat', 'Transakcje', 'Typowi odbiorcy'],
  items: [
    {
      id: 'warehouse', label: 'Data warehouse',
      layers: [
        { name: 'Odbiorcy', text: 'BI, raporty, SQL ad hoc' },
        { name: 'Silnik', text: 'Jeden zarządzany silnik SQL' },
        { name: 'Storage', text: 'Tabele w formacie platformy' }
      ],
      facts: [['Dane', 'Ustrukturyzowane i zamodelowane'], ['Schemat', 'Przy zapisie (schema on write)'], ['Transakcje', 'Tak, w silniku'], ['Typowi odbiorcy', 'Analitycy, narzędzia BI']],
      risk: 'Dane muszą pasować do tabel, a format przechowywania należy do platformy.'
    },
    {
      id: 'lake', label: 'Data lake',
      layers: [
        { name: 'Odbiorcy', text: 'Data science, przetwarzanie wsadowe' },
        { name: 'Silnik', text: 'Dowolny silnik, który umie czytać pliki' },
        { name: 'Storage', text: 'Pliki w object storage: CSV, JSON, Parquet, obrazy' }
      ],
      facts: [['Dane', 'Dowolne, także surowe i nieustrukturyzowane'], ['Schemat', 'Przy odczycie (schema on read)'], ['Transakcje', 'Brak: to katalog plików'], ['Typowi odbiorcy', 'Inżynierowie danych, data science']],
      risk: 'Bez opisu, właściciela i kontroli jakości zamienia się w „bagno danych". Czytelnik może zobaczyć zapis w połowie.'
    },
    {
      id: 'lakehouse', label: 'Lakehouse',
      layers: [
        { name: 'Odbiorcy', text: 'BI, SQL, data science na tych samych tabelach' },
        { name: 'Silnik', text: 'Kilka silników nad tym samym formatem tabel' },
        { name: 'Storage', text: 'Pliki Parquet w object storage + log transakcyjny (Delta Lake, Iceberg)' }
      ],
      facts: [['Dane', 'Tabele oraz pliki surowe obok'], ['Schemat', 'Pilnowany przez format tabel'], ['Transakcje', 'Tak, przez log formatu tabel'], ['Typowi odbiorcy', 'Wszyscy powyżsi']],
      risk: 'Otwarty format nie utrzymuje się sam: ktoś odpowiada za kompakcję plików, retencję i katalog tabel.'
    }
  ] as ArchItem[],
  takeaway: '<b>Wniosek.</b> <b>Data warehouse</b> to zarządzany silnik z zamodelowanymi tabelami. <b>Data lake</b> to tani magazyn plików w dowolnym formacie, bez transakcji. <b>Lakehouse</b> dokłada do plików w lake\'u <b>format tabel</b> z logiem transakcyjnym, dzięki czemu pliki zachowują się jak tabele hurtowni i może je czytać kilka silników.',
  moreTitle: 'Dlaczego granice się zacierają',
  more: [
    'Dokumentacja Databricks definiuje lakehouse jako system zarządzania danymi, który łączy zalety data lake i hurtowni danych. Delta Lake opisuje jako rozszerzenie plików Parquet o plikowy log transakcyjny dający transakcje ACID.',
    'Snowflake obsługuje tabele Apache Iceberg w plikach Parquet. Pliki mogą leżeć w storage\'u zarządzanym przez Snowflake albo w zewnętrznym storage\'u klienta, a katalogiem może być Snowflake albo katalog zewnętrzny.',
    'Na rozmowie bezpieczniej mówić o wzorcach niż przypisywać produkt do jednej szufladki: „Snowflake to hurtownia, Databricks to lakehouse" jest dziś uproszczeniem.'
  ]
};

/** Etap Architektura, część 2: ETL i ELT. Krok `where` mówi, na czyjej mocy obliczeniowej działa transformacja. */
export const etl = {
  title: 'Gdzie działa transformacja?',
  intro: 'Dane trzeba wyciągnąć ze źródła (Extract), przekształcić (Transform) i załadować do systemu docelowego (Load). Dwa podejścia różnią się tylko kolejnością dwóch ostatnich kroków, ale ta różnica zmienia to, co leży w hurtowni.',
  defaultId: 'elt',
  variants: [
    {
      id: 'etl', label: 'ETL',
      steps: [
        { name: 'Extract', where: 'źródło', hot: false },
        { name: 'Transform', where: 'osobny silnik', hot: true },
        { name: 'Load', where: 'hurtownia', hot: false }
      ],
      inWarehouse: 'Tylko przekształcony wynik.',
      good: 'Dane wrażliwe można zamaskować, zanim gdziekolwiek trafią. System docelowy nie musi mieć dużej mocy.',
      bad: 'Zmiana reguły wymaga ponownego pobrania danych ze źródła, o ile źródło jeszcze je ma. Logika żyje w osobnym narzędziu.'
    },
    {
      id: 'elt', label: 'ELT',
      steps: [
        { name: 'Extract', where: 'źródło', hot: false },
        { name: 'Load', where: 'hurtownia · warstwa surowa', hot: false },
        { name: 'Transform', where: 'hurtownia · jej compute', hot: true }
      ],
      inWarehouse: 'Dane surowe i wszystkie warstwy przekształceń.',
      good: 'Surowe dane są pod ręką, więc modele można przeliczyć po zmianie reguły. Transformacje to SQL pod kontrolą wersji.',
      bad: 'Każda transformacja zużywa compute hurtowni. Dane wrażliwe leżą w warstwie surowej, więc ona też wymaga kontroli dostępu.'
    }
  ],
  takeaway: '<b>Wniosek.</b> <b>ETL</b> przekształca dane przed załadowaniem, w osobnym silniku. <b>ELT</b> ładuje dane surowe i przekształca je w systemie docelowym. Dokumentacja Microsoft ujmuje to jednym zdaniem: ELT różni się od ETL wyłącznie miejscem transformacji i działa dobrze tylko wtedy, gdy system docelowy ma dość mocy.',
  bridge: {
    from: 'dbt',
    known: 'dbt uruchamia Twoje modele jako zapytania SQL w hurtowni, w kolejności zależności. Dane do warstwy surowej ładuje inne narzędzie.',
    fresh: 'dbt jest literą T w ELT. Warstwy staging, intermediate i marts to kolejne kroki transformacji wykonywane w systemie docelowym.',
    breaks: 'dbt nie wyciąga i nie ładuje danych, więc sam nie jest potokiem ELT. A w wielu firmach lekkie przekształcenia, np. maskowanie, i tak dzieją się przed załadowaniem, więc podział nie jest zero-jedynkowy.'
  } as Bridge
};

/** Etap Architektura, część 3: separacja storage i compute. */
export const separation = {
  title: 'Co się zmienia, gdy dane i moc obliczeniowa są osobno?',
  intro: 'W klasycznej hurtowni na własnych serwerach każdy węzeł ma swoje dyski i procesory. Przełącz układ i zobacz, co się dzieje z trzema obciążeniami: ładowaniem, dbt i BI.',
  defaultId: 'coupled',
  variants: [
    {
      id: 'coupled', label: 'Sklejone',
      compute: [{ name: 'węzeł 1', note: 'CPU + dysk' }, { name: 'węzeł 2', note: 'CPU + dysk' }, { name: 'węzeł 3', note: 'CPU + dysk' }],
      storage: null,
      points: [
        'Brakuje miejsca: dokładasz węzeł, czyli także moc obliczeniową, której nie potrzebujesz.',
        'Ładowanie, dbt i BI konkurują o te same procesory.',
        'Klaster działa także wtedy, gdy nikt nie pyta.'
      ]
    },
    {
      id: 'separated', label: 'Rozdzielone',
      compute: [{ name: 'LOAD_WH', note: 'mały, włącza się na ładowanie' }, { name: 'DBT_WH', note: 'duży, tylko na czas transformacji' }, { name: 'BI_WH', note: 'średni, w godzinach pracy' }],
      storage: 'Wspólny storage: jedna kopia danych',
      points: [
        'Storage i compute skalujesz i opłacasz osobno.',
        'Każde obciążenie ma własny klaster i czyta te same dane, więc ciężka transformacja nie spowalnia dashboardów.',
        'Nieużywany compute można zawiesić.'
      ]
    }
  ],
  takeaway: '<b>Wniosek.</b> <b>Separacja storage i compute</b> oznacza jedno wspólne miejsce na dane i niezależne klastry obliczeniowe. Daje niezależne skalowanie i izolację obciążeń. W Snowflake te klastry to <b>virtual warehouses</b>, a dokumentacja mówi, że każdy z nich jest niezależnym klastrem, który nie dzieli zasobów obliczeniowych z innymi.',
  moreTitle: 'Trzy warstwy Snowflake i koszty rozdzielenia',
  more: [
    'Dokumentacja Snowflake wymienia trzy warstwy: <b>database storage</b>, <b>compute</b> i <b>cloud services</b>. Architekturę opisuje jako hybrydę podejść shared-disk (jedno wspólne repozytorium danych) i shared-nothing (niezależne klastry obliczeniowe).',
    'Skalowanie w górę (większy warehouse) daje więcej zasobów pojedynczemu zapytaniu. Skalowanie wszerz (więcej klastrów) obsługuje więcej zapytań naraz. To dwie różne dźwignie na dwa różne problemy.',
    'Koszty: dane nie leżą już przy procesorze, więc silnik polega na odczytach sieciowych i cache\'u, a łatwość uruchamiania compute wymaga pilnowania rachunku. To ocena ogólna, nie cytat z dokumentacji.'
  ]
};

export interface Scenario { setup: string; options: string[]; correct: number; why: string; scope: string }
/** Etap Architektura, część 4: wybór architektury dla wymagań. Scenariusze wymyślone. */
export const choose = {
  title: 'Dobór architektury: co proponujesz?',
  intro: 'Pięć wymyślonych sytuacji. W każdej wybierz punkt wyjścia, zanim przeczytasz uzasadnienie. Nie ma tu jednej słusznej architektury: liczy się, które wymaganie przesądza o wyborze.',
  ask: 'Twój punkt wyjścia:',
  cases: [
    {
      setup: 'Firma handlowa: dane z systemu sprzedaży i CRM, 40 analityków z narzędziem BI, raporty odświeżane co godzinę, zespół zna SQL.',
      options: ['Data lake z plikami Parquet i własnym klastrem Sparka', 'Chmurowa hurtownia danych z ELT i dbt', 'Baza OLTP z replikami do odczytu'],
      correct: 1,
      why: 'Dane są ustrukturyzowane, odbiorcami są ludzie z BI i SQL-em, a świeżość godzinowa nie wymaga streamingu. Hurtownia zarządzana z transformacjami w SQL to najprostszy projekt spełniający wymagania, a zespół już ma potrzebne umiejętności.',
      scope: 'Jeśli pojawią się duże wolumeny danych nieustrukturyzowanych albo drugi silnik, który ma czytać te same tabele, warto wrócić do tej decyzji.'
    },
    {
      setup: 'Aplikacja mobilna musi pokazać klientowi jego saldo punktów w kilkadziesiąt milisekund. Zapytań jest kilka tysięcy na sekundę, każde dotyczy jednego klienta.',
      options: ['Widok w hurtowni analitycznej na tabeli standardowej', 'Baza operacyjna (OLTP) z dostępem po kluczu', 'Szeroka tabela w data lake'],
      correct: 1,
      why: 'To obciążenie OLTP: bardzo dużo małych odczytów po kluczu z wymaganiem niskiego opóźnienia. Tabele analityczne są zbudowane pod skany, a nie pod tysiące równoczesnych odczytów pojedynczych wierszy.',
      scope: 'W ekosystemie Snowflake do takich obciążeń istnieją tabele hybrydowe z zapisem wierszowym i indeksami. Czy wystarczą, zależy od wymaganego opóźnienia i przepustowości, co trzeba zmierzyć.'
    },
    {
      setup: 'Firma zbiera terabajty logów w JSON, zdjęcia produktów i nagrania. Zespół data science trenuje modele w Pythonie, a analitycy chcą SQL na tych samych danych.',
      options: ['Lakehouse: pliki w object storage z formatem tabel', 'Hurtownia, do której ładuje się wyłącznie zagregowane tabele', 'Baza OLTP z kolumnami JSON'],
      correct: 0,
      why: 'Przesądzają trzy wymagania naraz: dane nieustrukturyzowane, bezpośredni dostęp do plików dla uczenia maszynowego i SQL na tych samych danych. Format tabel nad object storage daje transakcje i schemat bez kopiowania danych do drugiego systemu.',
      scope: 'Jeśli analitycy potrzebują tylko kilku zagregowanych tabel, sensowny jest też układ mieszany: surowe dane w lake\'u, modele dla BI w hurtowni.'
    },
    {
      setup: 'Bank musi usunąć numery PESEL z danych, zanim opuszczą sieć wewnętrzną. Hurtownia jest w chmurze publicznej.',
      options: ['ELT: ładujemy wszystko surowe, maskujemy w hurtowni', 'Transformacja (maskowanie) przed załadowaniem, czyli krok ETL', 'Rezygnujemy z hurtowni w chmurze'],
      correct: 1,
      why: 'Wymaganie mówi, że dane wrażliwe nie mogą trafić do systemu docelowego w postaci jawnej. W czystym ELT surowe dane lądują w hurtowni przed transformacją, więc maskowanie musi nastąpić wcześniej.',
      scope: 'Reszta potoku może pozostać ELT. Przed załadowaniem dzieje się tylko to, czego wymaga zgodność z przepisami, a logika biznesowa zostaje w hurtowni.'
    },
    {
      setup: 'Zarząd chce „dashboardu w czasie rzeczywistym" ze sprzedażą. Dziś dane są ładowane raz na dobę.',
      options: ['Od razu projektuję streaming zdarzeń dla całej platformy', 'Dopytuję, jaka decyzja zależy od świeżości i jaka świeżość wystarczy', 'Zwiększam warehouse, żeby nocne ładowanie było szybsze'],
      correct: 1,
      why: 'Świeżość jest najdroższym wymaganiem, bo zmienia cały potok. Sekundy, minuty i godzina to trzy różne projekty i trzy różne rachunki. Najpierw trzeba ustalić, kto i jaką decyzję podejmie szybciej.',
      scope: 'Często okazuje się, że wystarcza ładowanie co kilkanaście minut. Jeśli naprawdę potrzebne są sekundy, streaming obejmuje zwykle jeden przypadek użycia, a nie całą platformę.'
    }
  ] as Scenario[],
  takeaway: '<b>Wniosek.</b> Kolejność do powiedzenia na rozmowie: odbiorca i sposób użycia, świeżość, kształt danych, skala i współbieżność, ograniczenia (przepisy, budżet, umiejętności zespołu). Potem najprostszy projekt, który to spełnia, nazwane kompromisy i warunek, przy którym zmienisz decyzję.'
};

export interface Recall { prompt: string; points: string[] }
/**
 * Etap Interview. Pytania, odpowiedzi 30–60 s (PL i EN) oraz follow-upy przychodzą z Interview Banku.
 * Tutaj jest tylko to, czego bank nie ma: jak mówić o mechanizmach klasycznych baz, znając je głównie
 * od strony hurtowni, oraz krótkie ćwiczenia z przypominania.
 */
export const interview = {
  honestIntro: 'Jeśli pracujesz głównie w hurtowni, a pytanie dotyczy indeksów albo wymuszanych kluczy, nie udawaj administratora bazy transakcyjnej. Pokaż, że znasz mechanizm i wiesz, czym różni się to, czego używasz na co dzień. Na przykład tak:',
  honestEn: '“Most of my hands-on work is in Snowflake, so I’ll explain the mechanism and then how it differs there. A B-tree index is a sorted tree that takes the engine from a key value to the row in a few page reads, at the cost of extra work on every write. Snowflake standard tables don’t have indexes I create. Instead the engine prunes micro-partitions using min and max metadata, so my lever is how the data is ordered: load order or a clustering key. And because primary and foreign keys aren’t enforced there, I guarantee them in the pipeline, with deduplication and dbt tests.”',
  honestPl: 'Po polsku: na co dzień pracuję głównie w Snowflake, więc wyjaśnię mechanizm, a potem różnicę. Indeks B-tree to posortowane drzewo, które prowadzi silnik od wartości klucza do wiersza w kilku odczytach stron, kosztem dodatkowej pracy przy każdym zapisie. Tabele standardowe Snowflake nie mają indeksów tworzonych przeze mnie. Silnik pomija mikropartycje na podstawie metadanych min i max, więc moją dźwignią jest uporządkowanie danych: kolejność ładowania albo klucz klastrowania. A ponieważ klucze główne i obce nie są tam wymuszane, zapewniam je w potoku: deduplikacją i testami dbt.',
  recallTitle: 'Powiedz to na głos',
  recallIntro: 'Osiem krótkich poleceń. Odpowiedz na głos po angielsku w dwóch lub trzech zdaniach, dopiero potem rozwiń punkty kontrolne.',
  recall: [
    { prompt: 'Explain OLTP versus OLAP without naming any product.', points: ['kształt obciążenia: małe transakcje na pojedynczych wierszach kontra ciężkie skany i agregacje', 'współbieżność i opóźnienie kontra przepustowość skanu', 'model znormalizowany kontra model pod odczyt'] },
    { prompt: 'Why does a columnar engine read less data for an aggregate?', points: ['w bloku leżą wartości jednej kolumny', 'czytane są tylko kolumny z zapytania', 'podobne wartości lepiej się kompresują'] },
    { prompt: 'Walk through 1NF, 2NF and 3NF using an orders table.', points: ['1NF: jedna wartość w komórce, klucz', '2NF: brak zależności od części klucza złożonego', '3NF: brak zależności między kolumnami niekluczowymi', 'po co: anomalie aktualizacji, wstawiania i usuwania'] },
    { prompt: 'Are primary keys enforced in Snowflake?', points: ['tabele standardowe: PK, UNIQUE i FK nie są wymuszane', 'NOT NULL i CHECK są wymuszane', 'tabele hybrydowe wymuszają klucze', 'w praktyce: deduplikacja i testy dbt'] },
    { prompt: 'When does a B-tree index not help?', points: ['warunek spełnia dużą część tabeli', 'wzorzec LIKE bez początku', 'funkcja na kolumnie bez indeksu na wyrażeniu', 'koszt: każdy zapis utrzymuje indeks'] },
    { prompt: 'How do you check whether partition pruning works in Snowflake?', points: ['Query Profile: partitions scanned kontra partitions total', 'pruning zależy od uporządkowania danych względem filtra', 'dźwignie: kolejność ładowania, klucz klastrowania'] },
    { prompt: 'What does read committed allow that serializable does not?', points: ['odczyty niepowtarzalne i fantomy', 'każda instrukcja widzi dane zatwierdzone przed jej startem', 'jedyny poziom dla tabel w Snowflake, domyślny w PostgreSQL'] },
    { prompt: 'ETL or ELT, and where does dbt fit?', points: ['różnica: miejsce transformacji', 'ELT: dane surowe w hurtowni, transformacja jej mocą', 'dbt to krok T, nie ładuje danych', 'ETL nadal np. do maskowania przed załadowaniem'] }
  ] as Recall[]
};

export interface QuizItem { q: string; setup?: string; options: string[]; correct: number; why: string }
/** Etap Sprawdź się: dziesięć krótkich pytań. Każde podaje założenia, jeśli wynik od nich zależy. */
export const quiz: QuizItem[] = [
  {
    q: 'Zapytanie <code>SELECT country, SUM(amount) FROM orders GROUP BY country</code> działa na tabeli o 40 kolumnach. Dlaczego silnik kolumnowy czyta tu mniej danych niż wierszowy?',
    options: ['Bo ma indeks na każdej kolumnie', 'Bo wartości jednej kolumny leżą razem, więc czyta tylko dwie potrzebne kolumny', 'Bo trzyma całą tabelę w pamięci'],
    correct: 1,
    why: 'W zapisie kolumnowym każda kolumna jest zapisana osobno, więc 38 niepotrzebnych kolumn nie jest czytanych. W zapisie wierszowym leżą one w tych samych blokach co potrzebne wartości.'
  },
  {
    q: 'Tabela <code>order_lines</code> ma klucz (<code>order_id</code>, <code>product_id</code>) i kolumnę <code>product_name</code>. Którą postać normalną to łamie?',
    options: ['Pierwszą, bo nazwa produktu się powtarza', 'Drugą, bo nazwa produktu zależy tylko od części klucza', 'Trzecią, bo nazwa produktu zależy od innej kolumny niekluczowej'],
    correct: 1,
    why: 'Nazwa produktu zależy od <code>product_id</code>, czyli od części klucza złożonego. To zależność częściowa, którą usuwa druga postać normalna. Trzecia dotyczy zależności między kolumnami niekluczowymi.'
  },
  {
    q: 'W tabeli standardowej Snowflake zadeklarowano <code>PRIMARY KEY (order_id)</code>. Wstawiasz drugi wiersz z tym samym <code>order_id</code>. Co się stanie?',
    setup: 'Założenia: tabela standardowa (nie hybrydowa), według dokumentacji Snowflake.',
    options: ['Błąd naruszenia klucza głównego', 'Wiersz zostanie wstawiony, w tabeli będą duplikaty', 'Wiersz zastąpi poprzedni'],
    correct: 1,
    why: 'W tabelach standardowych Snowflake nie wymusza <code>PRIMARY KEY</code>, <code>UNIQUE</code> ani <code>FOREIGN KEY</code>. Wymuszane są <code>NOT NULL</code> i <code>CHECK</code>. Unikalność trzeba zapewnić w potoku i sprawdzić testem.'
  },
  {
    q: 'Na kolumnie <code>status</code> jest indeks B-tree, a warunek <code>status = \'paid\'</code> spełnia 70% wierszy. Czego się spodziewasz w planie?',
    setup: 'Założenia: klasyczna baza relacyjna z planerem kosztowym i aktualnymi statystykami.',
    options: ['Index Scan, bo indeks istnieje', 'Pełnego skanu, bo indeks przy tak małej selektywności jest droższy', 'Błędu, bo indeksu nie można użyć z równością'],
    correct: 1,
    why: 'Indeks opłaca się, gdy zawęża wynik do małej części tabeli. Przy 70% wierszy odwiedzanie stron tabeli przez indeks kosztuje więcej niż odczyt po kolei. W przykładzie z dokumentacji PostgreSQL warunek spełniany przez 7000 z 10 000 wierszy dał <code>Seq Scan</code>.'
  },
  {
    q: 'Czym klucz klastrowania w Snowflake różni się od indeksu?',
    options: ['Niczym, to dwie nazwy tej samej struktury', 'Indeks wskazuje pojedyncze wiersze, a klastrowanie porządkuje dane, żeby dało się pomijać mikropartycje', 'Klucz klastrowania wymusza unikalność'],
    correct: 1,
    why: 'Indeks to osobna struktura prowadząca do wierszy. Klucz klastrowania wpływa na to, które wiersze leżą razem w mikropartycjach, przez co zakresy min–max są wąskie i pruning pomija więcej. Niczego nie wymusza.'
  },
  {
    q: 'Tabela jest dobrze uporządkowana po <code>order_date</code>. Zapytanie filtruje tylko po <code>customer_id</code>. Co pokaże Query Profile?',
    setup: 'Założenia: tabela standardowa Snowflake, klienci rozłożeni równomiernie w czasie, bez search optimization service.',
    options: ['Partitions scanned dużo mniejsze niż partitions total', 'Partitions scanned bliskie partitions total', 'Zero partycji, bo wynik przyjdzie z metadanych'],
    correct: 1,
    why: 'Porządek po dacie daje wąskie zakresy dat, ale w każdej mikropartycji są klienci z całego zakresu identyfikatorów. Zakres <code>customer_id</code> każdej mikropartycji obejmuje szukaną wartość, więc nie da się nic pominąć.'
  },
  {
    q: 'Transakcja na poziomie read committed czyta saldo konta dwa razy. Między odczytami inna transakcja zatwierdza zmianę salda. Co zobaczy drugi odczyt?',
    options: ['Starą wartość, bo transakcja ma jedną migawkę', 'Nową wartość: to odczyt niepowtarzalny, dopuszczalny na tym poziomie', 'Błąd serializacji'],
    correct: 1,
    why: 'Na poziomie read committed każda instrukcja widzi dane zatwierdzone przed jej rozpoczęciem, więc druga instrukcja widzi nowe saldo. To non-repeatable read. Wyklucza go dopiero repeatable read.'
  },
  {
    q: 'Co lakehouse dodaje do zwykłego data lake?',
    options: ['Szybsze dyski', 'Format tabel z logiem transakcyjnym: transakcje, pilnowanie schematu, statystyki', 'Obowiązkową hurtownię obok'],
    correct: 1,
    why: 'Pliki danych nadal leżą w object storage. Format tabel, np. Delta Lake albo Iceberg, dokłada warstwę metadanych, która mówi, które pliki tworzą aktualną wersję tabeli. Stąd transakcje ACID i możliwość czytania tych samych tabel przez różne silniki.'
  },
  {
    q: 'Reguła biznesowa liczenia przychodu zmieniła się i trzeba przeliczyć dwa lata danych. W którym podejściu jest to prostsze i dlaczego?',
    options: ['W ETL, bo dane są już oczyszczone', 'W ELT, bo surowe dane leżą w hurtowni i modele można przebudować', 'Bez różnicy'],
    correct: 1,
    why: 'W ELT warstwa surowa zostaje w systemie docelowym, więc wystarczy zmienić model i uruchomić go ponownie. W ETL do hurtowni trafił tylko wynik starej reguły, więc trzeba wrócić do źródła, o ile nadal przechowuje te dane.'
  },
  {
    q: 'Dashboardy zwalniają za każdym razem, gdy działa ciężki model dbt. Oba obciążenia używają tego samego virtual warehouse. Co proponujesz najpierw?',
    options: ['Osobny warehouse dla dbt i osobny dla BI', 'Denormalizację wszystkich tabel', 'Klucz klastrowania na każdej tabeli'],
    correct: 0,
    why: 'To problem konkurencji o zasoby, a nie problem zapytań. Separacja storage i compute pozwala dać każdemu obciążeniu własny, niezależny klaster czytający te same dane. Według dokumentacji Snowflake virtual warehouses nie dzielą między sobą zasobów obliczeniowych.'
  }
];

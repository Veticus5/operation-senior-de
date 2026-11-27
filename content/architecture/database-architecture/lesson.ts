import type { Bridge, ExplainedLine, LessonMeta } from '../../types';

/**
 * Lekcja 06: Database & Data Architecture. Porządkuje teorię i słownictwo dla osoby, która zna Snowflake i dbt
 * z praktyki: od rodzaju pracy bazy (OLTP, OLAP) przez model danych i mechanizmy silnika do wyboru architektury.
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
    html: '<h1>Jedna tabela zamówień, dwa zupełnie różne pytania.</h1>\n<p class="lede">Sklep internetowy trzyma zamówienia w bazie. Aplikacja tysiące razy na minutę szuka jednego zamówienia. Analityk raz dziennie liczy przychód z całego roku.</p>\n<p>Dane są te same, ale praca dla bazy zupełnie inna. Porównaj oba pytania.</p>',
    visual: 'workloads',
    after: '<b>Wniosek.</b> To dwa rodzaje pracy bazy. Bardzo dużo małych operacji, z których każda czyta albo zmienia kilka wierszy, to <b>OLTP</b> (Online Transaction Processing). Mało ciężkich zapytań, które czytają miliony wierszy i liczą sumy z kilku kolumn, to <b>OLAP</b> (Online Analytical Processing). Te nazwy opisują rodzaj pracy, a nie produkt.',
    more: {
      title: 'Dlaczego nie robi się analityki na bazie aplikacji',
      html: [
        'Raport czyta całą tabelę i zajmuje procesor oraz dysk. W tym samym czasie klienci mogą dłużej czekać na złożenie zamówienia.',
        'Baza aplikacji jest ułożona pod szybki i bezpieczny zapis pojedynczych wierszy. Analityk potrzebuje czegoś innego: historii, danych z kilku systemów naraz i tabel wygodnych do czytania.',
        'Dlatego dane kopiuje się z bazy aplikacji do osobnego systemu analitycznego. Reszta lekcji odpowiada na pytanie, jak zbudować oba systemy i czym się różnią.'
      ]
    },
    next: 'Co z tego wynika dla dysku?'
  },
  {
    html: '<h2>Czy trzeba przeczytać całą tabelę?</h2>\n<p>Dysk nie podaje pojedynczych wartości. Podaje całe porcje danych, czyli <b>bloki</b>. Liczy się więc to, <b>co leży razem w jednym bloku</b>: cały wiersz czy cała kolumna. Wybierz pytanie i układ, a potem porównaj liczniki.</p>',
    visual: 'storage',
    after: '<b>Wniosek.</b> Zapis <b>wierszowy</b> (row-oriented) trzyma razem cały wiersz. Jedno zamówienie to jeden odczyt, więc pasuje do OLTP. Zapis <b>kolumnowy</b> (column-oriented) trzyma razem wartości jednej kolumny. Suma czyta tylko potrzebne kolumny, więc pasuje do OLAP. PostgreSQL zapisuje wierszami, a tabele standardowe Snowflake kolumnami.',
    more: {
      title: 'Kompresja i koszt zapisu w układzie kolumnowym',
      html: [
        'W jednej kolumnie wartości mają ten sam typ i często się powtarzają (kraj, status). Takie dane dobrze się kompresują. W Snowflake każda kolumna jest zapisana i skompresowana osobno wewnątrz mikropartycji, czyli porcji tabeli, o której będzie w etapie Silnik.',
        'Cena: żeby dopisać albo zmienić jeden wiersz, trzeba dotknąć każdej kolumny. Dlatego silniki kolumnowe wolą ładowanie dużych paczek niż pojedyncze inserty.',
        '<code>SELECT *</code> w hurtowni kolumnowej oddaje główną zaletę: silnik musi przeczytać wszystkie kolumny.'
      ]
    },
    bridge: {
      from: 'Snowflake',
      known: 'W Snowflake tabela standardowa jest kolumnowa. Wybierasz trzy kolumny z trzydziestu i skan czyta dane tylko tych trzech.',
      fresh: 'To ta sama zasada co w ilustracji. Wartości jednej kolumny leżą razem, więc niepotrzebne kolumny da się pominąć.',
      breaks: 'Snowflake ma też tabele hybrydowe z zapisem wierszowym i indeksami, do pracy typu OLTP. Zdanie „Snowflake jest kolumnowy" dotyczy tabel standardowych, a nie całego produktu.'
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
    ['Czego wymaga', 'odpowiedzi w milisekundach i poprawnych danych, gdy wielu klientów zapisuje naraz', 'szybkiego przeczytania dużej ilości danych']
  ]
};

export interface StorageQuery { id: string; label: string; sql: string; rows: number[]; cols: number[]; verdict: { row: string; column: string } }
/**
 * Ilustracja zapisu wierszowego i kolumnowego. Model: blok to jeden wiersz (układ wierszowy) albo jedna kolumna
 * (układ kolumnowy) i jest czytany w całości. Liczniki wynikają z tych danych, patrz test lekcji.
 */
export const storage = {
  assumptions: 'Ilustracja: 6 zamówień i 5 kolumn, czyli 30 wartości. Blok to jeden wiersz albo jedna kolumna i baza czyta go w całości. W układzie wierszowym baza trafia do właściwego wiersza dzięki indeksowi, o którym będzie dalej.',
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
        column: 'Wiersz jest rozłożony na pięć bloków, po jednym na kolumnę. Żeby go złożyć, baza sięga do każdego z nich.'
      }
    },
    {
      id: 'agg', label: 'Przychód na kraj',
      sql: 'SELECT country, SUM(amount) FROM orders GROUP BY country',
      rows: [0, 1, 2, 3, 4, 5], cols: [2, 4],
      verdict: {
        row: 'Potrzebne są dwie kolumny, ale w każdym bloku leżą razem z trzema pozostałymi. Baza czyta wszystko.',
        column: 'Baza czyta dwa bloki: country i amount. Trzech pozostałych kolumn nie dotyka.'
      }
    }
  ] as StorageQuery[],
  legend: { read: 'przeczytane', need: 'potrzebne do wyniku' }
};

/** Etap Model, część 1: projekt logiczny i fizyczny. */
export const design = {
  title: 'Co ustalasz o danych, a co o silniku?',
  intro: 'Te same zamówienia opisujesz dwa razy. Najpierw ustalasz, <b>co w ogóle zapisujemy</b>: jakie rzeczy, jakie informacje o nich i jak się ze sobą łączą. Potem decydujesz, <b>jak to zapisać w konkretnej bazie</b>, żeby działało szybko.',
  columns: [
    {
      label: 'Projekt logiczny',
      note: 'niezależny od silnika',
      items: ['Encje, czyli rzeczy, o których zapisujemy dane: klient, zamówienie, produkt', 'Atrybuty, czyli informacje o nich: nazwa, miasto, kwota', 'Klucze: po czym rozpoznać jeden wiersz', 'Relacje: klient ma wiele zamówień', 'Normalizacja: ile powtórzeń dopuszczamy']
    },
    {
      label: 'Projekt fizyczny',
      note: 'dla konkretnego silnika',
      items: ['Typy danych: NUMBER(10,2), VARCHAR', 'Indeksy albo klucz klastrowania', 'Partycjonowanie', 'Tabela, widok czy model przyrostowy', 'Celowe powtórzenie danych, żeby szybciej czytać (denormalizacja)']
    }
  ],
  takeaway: '<b>Wniosek.</b> <b>Projekt logiczny</b> mówi, co dane znaczą. Po przejściu na inną bazę zostaje taki sam. <b>Projekt fizyczny</b> to decyzje o szybkości na wybranej platformie, więc zmienia się razem z nią. Jeden projekt logiczny może mieć kilka fizycznych.',
  moreTitle: 'Trzy poziomy: koncepcyjny, logiczny, fizyczny',
  more: [
    'Część zespołów ma jeszcze poziom <b>koncepcyjny</b>: same pojęcia biznesowe i połączenia między nimi, bez atrybutów i kluczy. Służy do rozmowy z biznesem.',
    'Na rozmowie wystarczy pokazać, że rozdzielasz dwa pytania: „co zapisujemy" i „jak to zapisujemy". Reszta lekcji idzie w tej kolejności: najpierw model, potem silnik.'
  ],
  bridge: {
    from: 'dbt',
    known: 'W modelu dbt piszesz <code>SELECT</code>, który mówi, jakie kolumny ma tabela i z czego powstaje. Osobno, w konfiguracji, ustawiasz <code>materialized</code> i <code>cluster_by</code>.',
    fresh: 'SQL modelu jest bliżej projektu logicznego. Konfiguracja materializacji i klastrowania to projekt fizyczny. Zmiana tabeli na model przyrostowy nie zmienia znaczenia danych.',
    breaks: 'Podział nie jest czysty. Model dbt jest już napisany w dialekcie konkretnej hurtowni. A decyzja o szerokiej tabeli w marcie zmienia same kolumny, nie tylko sposób zapisu.'
  } as Bridge
};

export interface NfTable { name: string; key: string[]; columns: string[]; rows: string[][]; flag?: string[] }
export interface NfStep { id: string; label: string; rule: string; tables: NfTable[]; fixed: string; problem: string }
/**
 * Etap Model, część 2: normalizacja krok po kroku na trzech zamówieniach. `key` to kolumny klucza głównego,
 * `flag` to kolumny, które łamią następną postać normalną.
 */
export const normalization = {
  title: 'Co się psuje, gdy ta sama informacja jest zapisana w kilku miejscach?',
  intro: 'Trzy zamówienia zapisane tak, jak przyszły z formularza. Anna zamówiła dwa razy, więc jej dane się powtarzają. Przechodź kolejne kroki: każdy usuwa jeden rodzaj powtórzenia. Kolorem zaznaczone są kolumny, które sprawią kłopot w następnym kroku.',
  assumptions: 'Dane wymyślone. Podkreślone kolumny tworzą klucz główny, czyli to, po czym rozpoznajesz jeden wiersz. Założenia: produkt występuje w zamówieniu najwyżej raz (liczba sztuk jest w kolumnie qty), a city to bieżące miasto klienta, nie adres dostawy konkretnego zamówienia.',
  defaultStep: 'raw',
  steps: [
    {
      id: 'raw', label: 'Start', rule: 'Jedna szeroka tabela. W komórce items siedzi cała lista.',
      tables: [{
        name: 'orders_raw', key: ['order_id'], columns: ['order_id', 'customer', 'city', 'items'], flag: ['items'],
        rows: [['101', 'Anna', 'Gdańsk', 'kabel ×2, mysz ×1'], ['102', 'Anna', 'Gdańsk', 'mysz ×1'], ['103', 'Piotr', 'Kraków', 'kabel ×1']]
      }],
      fixed: 'Nic jeszcze nie naprawiono.',
      problem: 'W jednej komórce jest lista produktów. Zwykłym SUM nie policzysz, ile sprzedano kabli. Nie połączysz też pozycji z tabelą produktów.'
    },
    {
      id: '1nf', label: '1NF', rule: '1NF: w każdej komórce jedna wartość, bez list, a każdy wiersz da się rozpoznać po kluczu.',
      tables: [{
        name: 'order_lines', key: ['order_id', 'product_id'], columns: ['order_id', 'product_id', 'product', 'qty', 'customer', 'city'], flag: ['product', 'customer', 'city'],
        rows: [['101', 'P1', 'kabel', '2', 'Anna', 'Gdańsk'], ['101', 'P2', 'mysz', '1', 'Anna', 'Gdańsk'], ['102', 'P2', 'mysz', '1', 'Anna', 'Gdańsk'], ['103', 'P1', 'kabel', '1', 'Piotr', 'Kraków']]
      }],
      fixed: 'Lista jest rozbita na wiersze. Jeden wiersz to jeden produkt w jednym zamówieniu. Kluczem jest para (order_id, product_id).',
      problem: 'Liczba sztuk zależy od obu części klucza: od zamówienia i od produktu. Ale nazwa produktu zależy tylko od product_id, a klient tylko od order_id. Dlatego „mysz" i „Anna, Gdańsk" są wpisane po kilka razy, a zmiana nazwy produktu to poprawianie wielu wierszy. Taka zależność od kawałka klucza nazywa się zależnością częściową.'
    },
    {
      id: '2nf', label: '2NF', rule: '2NF: kolumna, która zależy tylko od części klucza, idzie do osobnej tabeli.',
      tables: [
        { name: 'order_lines', key: ['order_id', 'product_id'], columns: ['order_id', 'product_id', 'qty'], rows: [['101', 'P1', '2'], ['101', 'P2', '1'], ['102', 'P2', '1'], ['103', 'P1', '1']] },
        { name: 'products', key: ['product_id'], columns: ['product_id', 'product'], rows: [['P1', 'kabel'], ['P2', 'mysz']] },
        { name: 'orders', key: ['order_id'], columns: ['order_id', 'customer_id', 'customer', 'city'], flag: ['customer', 'city'], rows: [['101', 'C7', 'Anna', 'Gdańsk'], ['102', 'C7', 'Anna', 'Gdańsk'], ['103', 'C9', 'Piotr', 'Kraków']] }
      ],
      fixed: 'Nazwa produktu zależy tylko od produktu, więc jest w tabeli products. Klient zależy tylko od zamówienia, więc jest w tabeli orders. W pozycjach została liczba sztuk, bo zależy od obu.',
      problem: 'Miasto nie opisuje zamówienia. Opisuje klienta, a klient jest przypisany do zamówienia. Dlatego „Anna, Gdańsk" nadal jest w dwóch wierszach. Zależność przez inną kolumnę, która nie jest kluczem, nazywa się zależnością przechodnią.'
    },
    {
      id: '3nf', label: '3NF', rule: '3NF: kolumna niekluczowa nie może zależeć od klucza przez inną kolumnę niekluczową. Tu miasto zależy od zamówienia tylko przez klienta, więc idzie do tabeli klientów.',
      tables: [
        { name: 'order_lines', key: ['order_id', 'product_id'], columns: ['order_id', 'product_id', 'qty'], rows: [['101', 'P1', '2'], ['101', 'P2', '1'], ['102', 'P2', '1'], ['103', 'P1', '1']] },
        { name: 'products', key: ['product_id'], columns: ['product_id', 'product'], rows: [['P1', 'kabel'], ['P2', 'mysz']] },
        { name: 'orders', key: ['order_id'], columns: ['order_id', 'customer_id'], rows: [['101', 'C7'], ['102', 'C7'], ['103', 'C9']] },
        { name: 'customers', key: ['customer_id'], columns: ['customer_id', 'customer', 'city'], rows: [['C7', 'Anna', 'Gdańsk'], ['C9', 'Piotr', 'Kraków']] }
      ],
      fixed: 'Imię i miasto opisują klienta, więc są w tabeli customers. Każda informacja jest zapisana raz. Przeprowadzka Anny to zmiana jednego wiersza.',
      problem: 'Nic się już nie powtarza. Nowy koszt: pytanie „ile kabli kupiono w Gdańsku" wymaga połączenia czterech tabel.'
    }
  ] as NfStep[],
  takeaway: '<b>Wniosek.</b> <b>Normalizacja</b> to dzielenie tabel tak, żeby każda informacja była zapisana raz. Wtedy nie da się jej poprawić tylko w połowie miejsc. Błędy, przed którymi to chroni, nazywają się <b>anomaliami</b>. Ceną są joiny przy odczycie. Według dokumentacji Microsoft trzecia postać normalna jest uznawana za wystarczającą w większości zastosowań.',
  moreTitle: 'Trzy anomalie, które warto umieć nazwać',
  more: [
    '<b>Anomalia aktualizacji</b> (update anomaly). Anna się przeprowadza. Poprawiasz miasto w zamówieniu 101, ale nie w 102. Baza ma teraz dwie wersje prawdy.',
    '<b>Anomalia wstawiania</b> (insert anomaly). W tabeli startowej nie zapiszesz klienta, który jeszcze nic nie zamówił, bo każdy wiersz to zamówienie.',
    '<b>Anomalia usuwania</b> (delete anomaly). Usuwasz zamówienie 103 i razem z nim znika jedyna informacja o tym, że Piotr mieszka w Krakowie.'
  ]
};

/** Etap Model, część 3: ten sam zestaw danych w 3NF i jako jedna szeroka tabela. Liczby wynikają z danych normalizacji, patrz test. */
export const denormalization = {
  title: 'Dlaczego w hurtowni świadomie cofasz normalizację?',
  intro: 'Model w 3NF jest wygodny do zapisu. Analityk chce jednak pytać o wszystko naraz: produkty, klientów i miasta. Porównaj oba układy dla tego samego pytania i tej samej zmiany.',
  question: 'Pytanie: ile sztuk sprzedano w każdym mieście?',
  change: 'Zmiana: Anna przeprowadza się z Gdańska do Sopotu.',
  defaultVariant: 'normalized',
  variants: [
    {
      id: 'normalized', label: 'Znormalizowany (3NF)',
      sql: 'SELECT c.city, SUM(l.qty)\nFROM order_lines l\nJOIN orders o ON o.order_id = l.order_id\nJOIN customers c ON c.customer_id = o.customer_id\nGROUP BY c.city',
      joins: 2, cityCopies: 2, rowsToUpdate: 1,
      verdict: 'Miasto każdego klienta jest zapisane raz, więc zmiana to jeden wiersz. Żeby odczytać dane, trzeba dwóch joinów i znajomości kluczy.'
    },
    {
      id: 'wide', label: 'Zdenormalizowany (szeroka tabela)',
      sql: 'SELECT city, SUM(qty)\nFROM order_lines_wide\nGROUP BY city',
      joins: 0, cityCopies: 4, rowsToUpdate: 3,
      verdict: 'Zapytanie nie ma joinów, więc poradzi sobie z nim każde narzędzie BI. Miasto jest skopiowane do każdej pozycji. Zmiana to poprawienie trzech wierszy albo zbudowanie tabeli od nowa.'
    }
  ],
  tiles: { joins: 'joiny w zapytaniu', cityCopies: 'wiersze z zapisanym miastem', rowsToUpdate: 'wiersze do zmiany po przeprowadzce' },
  takeaway: '<b>Wniosek.</b> <b>Denormalizacja</b> to celowe powtórzenie danych, żeby łatwiej i taniej je czytać. Zyskujesz mniej joinów i prostszy SQL. Płacisz powtórzeniami i droższą zmianą. W hurtowni ryzyko jest mniejsze niż w bazie aplikacji, bo szerokiej tabeli nikt nie poprawia ręcznie. Buduje się ją od nowa ze źródła.',
  moreTitle: 'Kiedy denormalizacja się mści',
  more: [
    '<b>Ziarno</b> (grain) to odpowiedź na pytanie, co oznacza jeden wiersz tabeli. Tu jeden wiersz to jedna pozycja zamówienia. Jeśli dokleisz do niej kwotę całego zamówienia, <code>SUM</code> policzy tę kwotę tyle razy, ile zamówienie ma pozycji. Dlatego każda tabela powinna mieć nazwane ziarno.',
    '<b>Historia.</b> Po zbudowaniu tabeli od nowa wszystkie stare zamówienia Anny pokażą Sopot. Jeśli raport ma pokazywać miasto z dnia zamówienia, trzeba przechowywać historię zmian. To osobny temat: modelowanie wymiarowe.',
    '<b>Koszt przebudowy.</b> Zmiana jednej informacji może oznaczać przepisanie dużej części tabeli. Przy dużych tabelach od tego zależy wybór między pełną przebudową a modelem przyrostowym.'
  ],
  bridge: {
    from: 'dbt',
    known: 'W projekcie dbt modele staging są blisko źródła i zwykle zachowują jego podział na tabele. Marty łączą je w tabele faktów i wymiarów albo w jedną szeroką tabelę dla BI.',
    fresh: 'To ten sam kompromis. Znormalizowane dane są źródłem prawdy, a szerokie modele do czytania powstają z nich od nowa przy każdym uruchomieniu.',
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
  intro: 'Dwa pytania kontrolne. Czy ten wiersz ma własny identyfikator, którego nie ma żaden inny? Tego pilnuje <b>klucz główny</b> (primary key): wartość jest unikalna i nie może być pusta. Czy klient wskazany w zamówieniu istnieje? Tego pilnuje <b>klucz obcy</b> (foreign key): wartość musi występować jako klucz w innej tabeli. Zasada „nie ma zamówienia bez klienta" to <b>integralność referencyjna</b> (referential integrity). Sprawdź, co trzy silniki zrobią z trzema błędnymi zapisami.',
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
        postgres: { ok: false, text: 'Odrzucone. PostgreSQL sprawdza klucz główny przy każdym zapisie. Żeby robić to szybko, sam tworzy dla niego unikalny indeks B-tree (o indeksach w etapie Silnik).' },
        standard: { ok: true, text: 'Przyjęte. Tabela ma teraz dwa wiersze z order_id = 101. W tabeli standardowej PRIMARY KEY jest tylko opisem. Snowflake go nie sprawdza.' },
        hybrid: { ok: false, text: 'Odrzucone. W tabeli hybrydowej klucz główny jest obowiązkowy i sprawdzany.' }
      }
    },
    {
      id: 'orphan', label: 'Zamówienie bez klienta',
      sql: "INSERT INTO orders (order_id, customer_id, amount)\nVALUES (104, 'C99', 50);  -- klienta C99 nie ma",
      rule: 'FOREIGN KEY',
      outcome: {
        postgres: { ok: false, text: 'Odrzucone. Klienta C99 nie ma w tabeli customers, więc klucz obcy nie pozwala na zapis.' },
        standard: { ok: true, text: 'Przyjęte. Powstaje wiersz osierocony (orphan): inner join z customers go zgubi, a left join zwróci puste dane klienta.' },
        hybrid: { ok: false, text: 'Odrzucone. Tabele hybrydowe sprawdzają klucze obce.' }
      }
    },
    {
      id: 'null', label: 'Brak kwoty',
      sql: "INSERT INTO orders (order_id, customer_id, amount)\nVALUES (105, 'C7', NULL);  -- amount jest NOT NULL",
      rule: 'NOT NULL',
      outcome: {
        postgres: { ok: false, text: 'Odrzucone. PostgreSQL sprawdza NOT NULL.' },
        standard: { ok: false, text: 'Odrzucone. NOT NULL i CHECK to reguły, które Snowflake sprawdza także w tabelach standardowych.' },
        hybrid: { ok: false, text: 'Odrzucone. Tabela hybrydowa też sprawdza NOT NULL.' }
      }
    }
  ] as KeyAttempt[],
  takeaway: '<b>Wniosek.</b> W klasycznej bazie relacyjnej klucze to reguły sprawdzane przy zapisie. Błędny wiersz nie wchodzi. W tabelach standardowych Snowflake <code>PRIMARY KEY</code>, <code>UNIQUE</code> i <code>FOREIGN KEY</code> są tylko opisem: można je zadeklarować, ale Snowflake ich nie sprawdza (mówi się: nie są wymuszane, not enforced). Sprawdza <code>NOT NULL</code> i <code>CHECK</code>. O unikalność i powiązania musi więc zadbać potok danych.',
  testsTitle: 'Jak pilnujesz kluczy w dbt',
  testsIntro: 'dbt ma cztery wbudowane testy: <code>unique</code>, <code>not_null</code>, <code>accepted_values</code> i <code>relationships</code>. Pierwszym i ostatnim sprawdzisz to, czego Snowflake nie sprawdza sam: unikalność klucza i istnienie wskazanego wiersza. Ważne: test wykrywa błąd po zbudowaniu modelu. Nie blokuje zapisu.',
  testsCodeTitle: 'models/schema.yml',
  testsLines: [
    { code: '- name: order_id', label: 'Kolumna klucza', text: 'Kolumna, która ma identyfikować wiersz modelu <code>orders</code>.' },
    { code: '  data_tests: [unique, not_null]', label: 'Odpowiednik PRIMARY KEY', text: 'Dwa testy razem sprawdzają to samo, co klucz główny w klasycznej bazie. Każdy test to zapytanie, które po zbudowaniu modelu szuka wierszy łamiących regułę.' },
    { code: '- name: customer_id', label: 'Kolumna klucza obcego', text: 'Kolumna, która ma wskazywać na istniejącego klienta.' },
    { code: '  data_tests:', label: 'Lista testów kolumny', text: 'Testy kolumny <code>customer_id</code>.' },
    { code: "    - relationships: {to: ref('customers'), field: customer_id}", label: 'Odpowiednik FOREIGN KEY', text: 'Sprawdza, czy każdy <code>customer_id</code> z zamówień istnieje w modelu <code>customers</code>. Dokumentacja dbt nazywa to wprost integralnością referencyjną. Przykład jest poglądowy: dokładna składnia argumentów zależy od wersji dbt.' }
  ] as ExplainedLine[],
  moreTitle: 'Wyjątki: NULL, odroczone sprawdzanie i RELY',
  more: [
    '<b>NULL w kluczu obcym.</b> W PostgreSQL pusta wartość w kolumnie klucza obcego domyślnie przechodzi: wiersz z <code>customer_id = NULL</code> nie musi mieć pasującego klienta. Jeśli zamówienie zawsze ma mieć klienta, dodaj <code>NOT NULL</code>. Podobnie <code>UNIQUE</code> domyślnie dopuszcza wiele wierszy z NULL. Klucz główny NULL-a nie dopuszcza.',
    '<b>Odroczone sprawdzanie.</b> PostgreSQL pozwala oznaczyć klucz główny, unikalny albo obcy jako <code>DEFERRABLE</code>. Taką regułę można sprawdzić dopiero na końcu transakcji, a nie po każdej instrukcji. Przydaje się, gdy dwa wiersze wskazują na siebie nawzajem. <code>NOT NULL</code> i <code>CHECK</code> odroczyć się nie da.',
    '<b>Po co deklarować klucze w Snowflake.</b> Według dokumentacji niesprawdzane klucze nadal służą jako opis modelu. Narzędzia BI i narzędzia do modelowania odczytują z nich klucze i relacje.',
    '<b>RELY.</b> Ta właściwość mówi optymalizatorowi: „możesz założyć, że dane spełniają tę regułę". Dzięki temu może na przykład usunąć z planu zbędny join. To zaufanie, a nie sprawdzenie: Snowflake nadal niczego nie weryfikuje. Dokumentacja ostrzega, że jeśli dane łamią regułę oznaczoną <code>RELY</code>, wyniki mogą być niepoprawne.',
    '<b>Kontrakty dbt.</b> dbt pozwala deklarować reguły w kontrakcie modelu, ale w Snowflake większość z nich pozostaje opisem. Strona dbt podaje, że sprawdzane jest tylko <code>not null</code>, a o <code>check</code> pisze, że nie jest obsługiwany. Dokumentacja Snowflake mówi dziś, że <code>CHECK</code> jest obsługiwany i sprawdzany. Źródła się tu różnią, więc przed użyciem sprawdź to na swojej wersji.'
  ],
  bridge: {
    from: 'Snowflake i dbt',
    known: 'W dbt dodajesz do modelu testy <code>unique</code>, <code>not_null</code> i <code>relationships</code>, a w modelu deduplikujesz po kluczu, np. przez <code>QUALIFY ROW_NUMBER()</code>.',
    fresh: 'To jest Twoja wersja klucza głównego i obcego. Ta sama reguła, którą klasyczna baza sprawdza sama przy zapisie.',
    breaks: 'Reguła w bazie zapobiega: błędny wiersz nie zostaje zapisany. Test dbt tylko wykrywa: gdy zgłasza błąd, model jest już zbudowany. Bez dodatkowych kroków błędne dane mogą trafić do odbiorców.'
  } as Bridge
};

export interface IndexCase { id: string; label: string; sql: string; uses: 'index' | 'range' | 'scan'; pages: number; verdict: string; why: string }
/**
 * Etap Silnik, część 1: wyszukanie przez indeks B-tree i pełny skan. Model ilustracyjny: 1 000 000 wierszy
 * na 10 000 stron, drzewo o wysokości 3. Liczby stron nie są pomiarem.
 */
export const index = {
  title: 'Jak znaleźć jeden wiersz na milion bez czytania miliona?',
  intro: 'Baza czyta dane z dysku całymi porcjami. Taka porcja to <b>strona</b> (page). W tym przykładzie milion zamówień leży na 10 000 stron. Bez pomocy baza musi przeczytać wszystkie i sprawdzić każdy wiersz. To <b>full table scan</b>. Z indeksem na kolumnie z filtra wystarczą 4 strony. Wybierz warunek i zobacz, którędy idzie baza.',
  assumptions: 'Ilustracja: 1 000 000 wierszy na 10 000 stron, indeks B-tree o trzech poziomach (korzeń, poziom pośredni, liście). Każdy warunek ma indeks na swojej kolumnie. Liczby stron są dobrane do przykładu. To nie pomiar.',
  tablePages: 10000,
  treeHeight: 3,
  caseLabel: 'Warunek',
  defaultCase: 'equal',
  levels: ['korzeń', 'poziom pośredni', 'liście', 'tabela'],
  cases: [
    {
      id: 'equal', label: 'Równość po kluczu', sql: 'WHERE order_id = 48213', uses: 'index', pages: 4,
      verdict: 'Indeks: 3 strony drzewa i 1 strona tabeli.',
      why: 'Indeks jest posortowany jak skorowidz w książce. Pierwsza strona (korzeń) mówi, w której części szukać 48213. Druga zawęża. Trzecia (liść) podaje adres wiersza w tabeli.'
    },
    {
      id: 'range', label: 'Wąski zakres', sql: "WHERE order_date BETWEEN '2025-03-01' AND '2025-03-02'", uses: 'range', pages: 60,
      verdict: 'Indeks: zejście do pierwszej wartości, potem sąsiednie liście.',
      why: 'Liście są ułożone po kolei. Baza znajduje początek zakresu i czyta kolejne liście, aż zakres się skończy. Im szerszy zakres, tym więcej stron tabeli trzeba odwiedzić.'
    },
    {
      id: 'broad', label: 'Większość wierszy', sql: "WHERE status = 'paid'   -- 70% tabeli", uses: 'scan', pages: 10000,
      verdict: 'Pełny skan, mimo że indeks istnieje.',
      why: 'Filtr pasuje do 700 000 wierszy. Skakanie przez indeks po każdy z nich jest droższe niż przeczytanie tabeli po kolei. Wybiera planer, czyli część bazy, która decyduje o sposobie wykonania zapytania. Korzysta ze statystyk o danych.'
    },
    {
      id: 'suffix', label: 'Wzorzec bez początku', sql: "WHERE customer LIKE '%ski'", uses: 'scan', pages: 10000,
      verdict: 'Pełny skan: indeks B-tree nie obsługuje takiego wzorca.',
      why: "Posortowane wartości da się przeszukiwać od początku, jak nazwiska w książce telefonicznej. Znając tylko końcówkę, trzeba przejrzeć wszystko. Według dokumentacji PostgreSQL wzorzec LIKE 'Kow%' może użyć indeksu B-tree, a LIKE '%ski' nie."
    },
    {
      id: 'function', label: 'Funkcja na kolumnie', sql: "WHERE lower(email) = 'anna@example.com'", uses: 'scan', pages: 10000,
      verdict: 'Pełny skan przy zwykłym indeksie na email.',
      why: 'Indeks trzyma posortowane wartości email. Zapytanie pyta o wynik funkcji lower(email), a tego w zwykłym indeksie nie ma. Pomaga indeks zbudowany na wyrażeniu lower(email): dokumentacja PostgreSQL mówi, że takie zapytanie może go użyć.'
    }
  ] as IndexCase[],
  takeaway: '<b>Wniosek.</b> <b>Indeks B-tree</b> to osobna, posortowana struktura w kształcie zrównoważonego drzewa (balanced tree): do każdego liścia jest tyle samo kroków. Prowadzi od szukanej wartości do adresu wiersza w kilku krokach. Pomaga, gdy filtr pasuje do małej części tabeli (mówi się wtedy, że jest <b>selektywny</b>), przy zakresach i przy sortowaniu. Kosztuje miejsce i dodatkową pracę przy zapisie. Nie pomaga, gdy filtr pasuje do dużej części tabeli.',
  snowTitle: 'A w Snowflake?',
  snowIntro: 'W tabelach standardowych Snowflake nie tworzysz indeksów B-tree. Cel jest ten sam: nie czytać wszystkiego. Snowflake osiąga go inaczej.',
  snowColumns: ['Mechanizm', 'Co robi', 'Gdzie'],
  snowRows: [
    ['Indeks B-tree', 'Prowadzi do pojedynczych wierszy', 'Klasyczne bazy relacyjne, np. PostgreSQL'],
    ['Pruning mikropartycji', 'Pomija całe porcje tabeli (mikropartycje), gdy z zapisanych zakresów wartości wynika, że nie ma w nich szukanych danych', 'Snowflake, automatycznie'],
    ['Klucz klastrowania', 'Układa podobne wiersze obok siebie, żeby filtr mógł pominąć więcej mikropartycji', 'Snowflake, duże tabele'],
    ['Search optimization service', 'Utrzymuje dodatkową strukturę do szukania pojedynczych wartości w dużej tabeli', 'Snowflake, osobny koszt'],
    ['Indeksy tabel hybrydowych', 'Indeks klucza głównego i indeksy dodatkowe', 'Snowflake, tylko tabele hybrydowe']
  ],
  snowTakeaway: '<b>Wniosek.</b> Na zdaniu „Snowflake nie ma indeksów" można się potknąć. Dokładniej: w tabelach standardowych nie tworzysz indeksów B-tree, a Snowflake pomija dane dzięki pruningowi. Tabele hybrydowe mają prawdziwe indeksy. Jak działa pruning, zobaczysz w następnym kroku.',
  moreTitle: 'Indeks wielokolumnowy, kolejność kolumn i koszt zapisu',
  more: [
    'Indeks na <code>(country, order_date)</code> jest posortowany najpierw po kraju, a w obrębie kraju po dacie. Jak książka telefoniczna: najpierw nazwisko, potem imię. Według dokumentacji PostgreSQL taki indeks działa najlepiej, gdy zapytanie filtruje po kolumnach z lewej strony (leading columns).',
    'Filtr tylko po <code>order_date</code> to jak szukanie po samym imieniu: indeks zawęża dużo mniej. Dlatego kolejność kolumn dobiera się pod najczęstsze filtry.',
    'Nie każdy <code>UPDATE</code> rusza indeksy. W PostgreSQL zmiana, która nie dotyka żadnej zaindeksowanej kolumny i mieści się na tej samej stronie, nie wymaga nowych wpisów w zwykłych indeksach (HOT update). Insert i zmiana zaindeksowanej kolumny kosztują zawsze. Dokumentacja radzi usuwać indeksy rzadko używane.',
    'Klucz obcy w PostgreSQL nie tworzy sam indeksu na swojej kolumnie (tu: <code>orders.customer_id</code>). Dokumentacja radzi rozważyć taki indeks, bo przyspiesza joiny i sprawdzanie przy usuwaniu klienta.'
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
  intro: 'Tabela ma osiem miesięcy zamówień, a raport dotyczy marca. Snowflake sam dzieli tabelę na porcje, czyli <b>mikropartycje</b>. Dla każdej zapamiętuje najmniejszą i największą wartość każdej kolumny. Przykład: w tej mikropartycji są tylko zamówienia ze stycznia. Szukasz marca, więc Snowflake może ją pominąć bez czytania. Zmień ułożenie danych i filtr.',
  assumptions: 'Ilustracja: 8 mikropartycji zamiast tysięcy, miesiące 2025 roku jako liczby 1–8, klienci o numerach 1–8000. Mikropartycja jest czytana, gdy szukana wartość mieści się między jej minimum a maksimum.',
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
      id: 'mixed', label: 'Wymieszane', note: 'Wiersze z różnych miesięcy i od różnych klientów leżą w tych samych mikropartycjach.',
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
  takeaway: '<b>Wniosek.</b> <b>Partition pruning</b> to pomijanie całych porcji tabeli na podstawie zapisanych zakresów, bez czytania danych. Działa, gdy zakres mikropartycji wyklucza Twój filtr. O tym decyduje fizyczne ułożenie wierszy, czyli <b>klastrowanie</b> (clustering). Dane ułożone po dacie pomagają filtrowi po dacie. Filtrowi po kliencie pomogą tylko wtedy, gdy zakresy klientów też coś wykluczają. W tej ilustracji nie wykluczają. I jeszcze jedno: przeczytana mikropartycja nie musi zawierać samych pasujących wierszy. Filtr jest stosowany jeszcze raz po odczycie.',
  compareTitle: 'Partycjonowanie deklarowane a mikropartycje Snowflake',
  compareColumns: ['', 'Partycjonowanie deklarowane', 'Mikropartycje Snowflake'],
  compareRows: [
    ['Kto dzieli tabelę', 'Ty: wybierasz kolumnę i granice (zakres, lista, hash)', 'Snowflake, automatycznie, w kolejności ładowania'],
    ['Rozmiar', 'Wynika z danych, np. jeden miesiąc', '50–500 MB danych przed kompresją'],
    ['Zakresy', 'Nie nachodzą na siebie, bo tak je zdefiniowano', 'Mogą na siebie nachodzić'],
    ['Jak poprawić pruning', 'Lepsza kolumna partycjonowania', 'Kolejność ładowania albo klucz klastrowania'],
    ['Typowy koszt błędu', 'Za dużo partycji: wolniejsze planowanie, małe pliki', 'Słabe klastrowanie: skan prawie całej tabeli']
  ],
  moreTitle: 'Kiedy klucz klastrowania ma sens',
  more: [
    'Dokumentacja Snowflake zaleca klucze klastrowania dla dużych tabel, zwykle liczonych w wielu terabajtach, i tylko wtedy, gdy zapytania wyraźnie na tym zyskają. Utrzymywanie porządku zużywa kredyty.',
    '<b>Kardynalność</b> (cardinality) to liczba różnych wartości w kolumnie. Kraj ma niską, identyfikator zamówienia wysoką. Zalecenie dla większości tabel: najwyżej 3–4 kolumny lub wyrażenia w kluczu, ułożone od najniższej do najwyższej kardynalności.',
    'Zastrzeżenie z dokumentacji: Snowflake nie pomija mikropartycji, gdy wartość do filtra pochodzi z podzapytania, nawet jeśli podzapytanie zwraca stałą.',
    'W dbt-snowflake klucz klastrowania ustawia konfiguracja <code>cluster_by</code> na tabeli albo modelu przyrostowym. W PostgreSQL partycjonowanie deklaruje się w definicji tabeli (zakres, lista albo hash), a dokumentacja radzi partycjonować po kolumnach, które najczęściej występują w <code>WHERE</code>.'
  ],
  bridge: {
    from: 'Snowflake',
    known: 'W Query Profile przy skanie tabeli widzisz dwie liczby: <code>Partitions scanned</code> i <code>Partitions total</code>.',
    fresh: 'To jest licznik z tej ilustracji. Dokumentacja Snowflake mówi, że pruning jest skuteczny, gdy pierwsza liczba jest małym ułamkiem drugiej.',
    breaks: 'Ilustracja ma 8 mikropartycji i idealnie równe zakresy. W prawdziwej tabeli są ich tysiące, a zakresy częściowo na siebie nachodzą. Wynik zależy też od tego, jak dane były dopisywane i zmieniane po pierwszym załadowaniu.'
  } as Bridge
};

/** Etap Silnik, część 3: plan wykonania. Wydruki EXPLAIN to przykłady skopiowane z dokumentacji PostgreSQL (using-explain). */
export const plans = {
  title: 'Jak sprawdzić, co baza naprawdę zrobiła?',
  intro: 'W SQL piszesz, <b>co</b> chcesz dostać. Nie piszesz, <b>jak</b> to policzyć. Sposób wybiera część bazy zwana optymalizatorem (w PostgreSQL: planer). Jego decyzję pokazuje <b>plan wykonania</b> (execution plan): lista kroków, przez które wiersze przechodzą od tabel do wyniku. Poniżej trzy plany z dokumentacji PostgreSQL dla tabeli <code>tenk1</code> o 10 000 wierszy. Czytaj je od góry, linia po linii.',
  codeTitle: 'EXPLAIN · przykłady z dokumentacji PostgreSQL',
  lines: [
    { code: 'Seq Scan on tenk1  (cost=0.00..445.00 rows=10000 width=244)', label: 'SELECT * FROM tenk1', text: '<code>Seq Scan</code> to pełny skan tabeli. W nawiasie są przewidywania planera, jeszcze przed wykonaniem: koszt do pierwszego wiersza i koszt całkowity, liczba wierszy i średnia szerokość wiersza w bajtach. Koszt jest w umownych jednostkach. To nie są milisekundy.' },
    { code: 'Index Scan using tenk1_unique1 on tenk1  (cost=0.29..8.30 rows=1 width=244)', label: 'WHERE unique1 = 42', text: 'Ta sama tabela, ale filtr pasuje do jednego wiersza. Planer wybrał indeks, a przewidywany koszt spadł z 445 do 8,30. To nadal przewidywanie, a nie zmierzony czas.' },
    { code: '  Index Cond: (unique1 = 42)', label: 'Warunek użyty w indeksie', text: 'Linia wcięta pod operatorem opisuje jego szczegóły. <code>Index Cond</code> to warunek, po którym baza zeszła w drzewie indeksu.' },
    { code: 'Seq Scan on tenk1  (cost=0.00..470.00 rows=7000 width=244) (actual time=0.030..1.995 rows=7000.00 loops=1)', label: 'EXPLAIN ANALYZE ... WHERE ten < 7', text: '<code>EXPLAIN ANALYZE</code> naprawdę wykonuje zapytanie i dopisuje, co się faktycznie stało: czas w milisekundach i liczbę wierszy. Uwaga: <code>UPDATE</code> albo <code>DELETE</code> też się wykona. Tu przewidywanie (7000 wierszy) zgadza się z rzeczywistością. Filtr pasuje do 70% tabeli, więc planer wybrał skan, a nie indeks.' },
    { code: '  Rows Removed by Filter: 3000', label: 'Wiersze przeczytane i odrzucone', text: 'Baza przeczytała 10 000 wierszy, żeby oddać 7000. Jeśli tu jest duża liczba, a wynik jest mały, baza czyta dużo danych na próżno.' }
  ] as ExplainedLine[],
  takeaway: '<b>Wniosek.</b> W planie szukasz dwóch rzeczy: <b>najdroższego kroku</b> i miejsca, gdzie <b>przewidywanie rozjechało się z rzeczywistością</b>. Dokumentacja PostgreSQL uznaje to drugie za najważniejsze: czy przewidywane liczby wierszy są bliskie faktycznym. Gdy planer źle oszacuje liczbę wierszy, może wybrać zły sposób wykonania.',
  profileTitle: 'To samo w Snowflake: Query Profile',
  profileIntro: 'W Snowflake <code>EXPLAIN</code> pokazuje plan, ale zapytania nie wykonuje. Co się faktycznie stało, pokazuje Query Profile. Dokumentacja wymienia cztery typowe problemy, które tam widać.',
  profileColumns: ['Co widzisz w Query Profile', 'Co to znaczy', 'Od czego zacząć'],
  profileRows: [
    ['Partitions scanned bliskie Partitions total', 'Pruning nie działa: filtr nie pozwala pominąć mikropartycji', 'Filtr po kolumnie, po której dane są ułożone; ocena klastrowania'],
    ['Po joinie dużo więcej wierszy niż na wejściu', 'Join „eksploduje" (exploding join): klucz się powtarza albo brakuje warunku, więc wiersze się mnożą', 'Co oznacza jeden wiersz po każdej stronie joina i czy klucz jest unikalny'],
    ['Bytes spilled to local / remote storage', 'Spilling: operacja nie mieści się w pamięci, więc dane są odkładane na dysk, a to jest dużo wolniejsze', 'Mniej danych w operacji (filtr, mniej kolumn, wcześniejsza agregacja), potem większy warehouse'],
    ['UNION zamiast UNION ALL', 'Dodatkowa praca: usuwanie duplikatów', 'UNION ALL, jeśli duplikaty nie mogą wystąpić albo nie szkodzą']
  ],
  profileTakeaway: '<b>Wniosek.</b> Kolejność do powiedzenia na rozmowie: najpierw plan, potem przyczyna (za dużo czytanych danych, za dużo wierszy po joinie, za mało pamięci), a większy warehouse na końcu. Większy warehouse może pomóc, gdy brakuje pamięci. Nie naprawi filtra, który niczego nie pomija, ani joina, który mnoży wiersze.',
  moreTitle: 'EXPLAIN w Snowflake: co zwraca i ile kosztuje',
  more: [
    'Według dokumentacji <code>EXPLAIN</code> przygotowuje plan (kompiluje instrukcję), ale jej nie wykonuje. Nie potrzebuje więc działającego warehouse. Samo przygotowanie planu zużywa zasoby warstwy cloud services.',
    'Wynik zawiera m.in. kolumny <code>operation</code>, <code>partitionsTotal</code>, <code>partitionsAssigned</code> i <code>bytesAssigned</code>. Pruning da się więc ocenić jeszcze przed uruchomieniem zapytania.',
    'Plan przed wykonaniem i profil po wykonaniu to dwie różne rzeczy. Pierwszy mówi, co silnik zamierza zrobić. Drugi mówi, ile to faktycznie kosztowało.'
  ]
};

export interface IsoLevel { id: string; label: string; dirty: boolean; nonRepeatable: boolean; phantom: boolean; note: string }
/**
 * Etap Silnik, część 4: ACID i izolacja. Tabela anomalii według standardu SQL, za dokumentacją PostgreSQL
 * (transaction-iso, tabela 13.1). `true` oznacza, że standard dopuszcza anomalię na tym poziomie.
 */
export const acid = {
  title: 'Co się stanie, gdy system padnie w połowie przelewu?',
  intro: 'Przelew 100 zł to dwie instrukcje: odejmij z konta Alice, dodaj na konto Boba. Jeśli wykona się tylko pierwsza, pieniądze znikają. <b>Transakcja</b> łączy kilka instrukcji w jedną operację: wykonują się wszystkie albo żadna.',
  code: 'BEGIN;\nUPDATE accounts SET balance = balance - 100 WHERE name = \'Alice\';\nUPDATE accounts SET balance = balance + 100 WHERE name = \'Bob\';\nCOMMIT;',
  letters: [
    { letter: 'A', name: 'Atomicity · atomowość', text: 'Oba UPDATE-y wchodzą w życie albo żaden. Awaria przed COMMIT cofa wszystko.' },
    { letter: 'C', name: 'Consistency · spójność', text: 'Po transakcji dane nadal spełniają reguły, które baza zna i sprawdza. Przykład: saldo nie spadnie poniżej zera, jeśli pilnuje tego CHECK.' },
    { letter: 'I', name: 'Isolation · izolacja', text: 'Ktoś, kto w tej samej chwili liczy sumę sald, nie zobaczy stanu „odjęto Alice, jeszcze nie dodano Bobowi".' },
    { letter: 'D', name: 'Durability · trwałość', text: 'Po COMMIT przelew przetrwa awarię i restart bazy.' }
  ],
  isoTitle: 'Izolacja ma poziomy',
  isoIntro: 'Izolacja to reguły na sytuację, gdy dwie transakcje działają naraz. Im ściślejsze reguły, tym mniej transakcji może pracować równolegle. Dlatego standard SQL ma cztery poziomy. Każdy kolejny wyklucza więcej <b>anomalii</b>, czyli sytuacji, w których cudza transakcja zmienia to, co widzisz. Wybierz poziom.',
  assumptions: 'Tabela pokazuje, co dopuszcza standard SQL, za dokumentacją PostgreSQL. Konkretna baza może być ściślejsza niż standard. Przykłady: Ty czytasz dane, a Alice w tym samym czasie robi przelew.',
  levelLabel: 'Poziom izolacji',
  defaultLevel: 'rc',
  anomalies: [
    { id: 'dirty', name: 'Dirty read', text: 'Alice zaczęła przelew, ale go nie zatwierdziła. Ty już widzisz jej saldo pomniejszone o 100 zł. Jeśli przelew zostanie wycofany, zobaczyłeś coś, co nigdy nie istniało.' },
    { id: 'nonRepeatable', name: 'Non-repeatable read', text: 'W jednej transakcji czytasz saldo Alice dwa razy. Między odczytami jej przelew zostaje zatwierdzony. Ten sam wiersz, dwie różne wartości.' },
    { id: 'phantom', name: 'Phantom read', text: 'Dwa razy liczysz konta z saldem powyżej 1000 zł. Między zapytaniami ktoś zakłada i zatwierdza nowe takie konto. Ten sam warunek, inny zestaw wierszy.' }
  ],
  levels: [
    { id: 'ru', label: 'Read uncommitted', dirty: true, nonRepeatable: true, phantom: true, note: 'Najsłabszy poziom standardu. PostgreSQL traktuje go jak read committed, więc brudnych odczytów tam nie zobaczysz.' },
    { id: 'rc', label: 'Read committed', dirty: false, nonRepeatable: true, phantom: true, note: 'Domyślny w PostgreSQL i jedyny poziom obsługiwany przez Snowflake dla tabel. Każda instrukcja widzi dane zatwierdzone przed jej startem.' },
    { id: 'rr', label: 'Repeatable read', dirty: false, nonRepeatable: false, phantom: true, note: 'Standard dopuszcza tu fantomy, PostgreSQL ich nie dopuszcza. Baza może przerwać transakcję błędem serializacji, a aplikacja musi ją wtedy powtórzyć.' },
    { id: 's', label: 'Serializable', dirty: false, nonRepeatable: false, phantom: false, note: 'Wynik taki, jakby transakcje szły jedna po drugiej. Najwięcej powtórzeń i najmniej pracy równoległej.' }
  ] as IsoLevel[],
  takeaway: '<b>Wniosek.</b> <b>ACID</b> to cztery obietnice transakcji. <b>Poziom izolacji</b> (isolation level) to wybór: ile anomalii dopuszczasz, żeby więcej transakcji mogło działać naraz. Read committed chroni przed brudnymi odczytami. Ale dwie instrukcje w tej samej transakcji mogą zobaczyć różne dane.',
  moreTitle: 'MVCC, czwarta anomalia i read committed w potoku Snowflake',
  more: [
    '<b>MVCC</b> (multiversion concurrency control) to sposób na izolację bez blokowania: baza trzyma kilka wersji wiersza. Każda instrukcja czyta dane w stanie z jednej chwili, jak na zdjęciu (snapshot). Według dokumentacji PostgreSQL dzięki temu odczyt nie blokuje zapisu, a zapis nie blokuje odczytu.',
    '<b>Czwarta anomalia.</b> Tabela w dokumentacji PostgreSQL ma jeszcze kolumnę <b>serialization anomaly</b>: wynik zatwierdzonych transakcji nie pasuje do żadnej kolejności, w której wykonałyby się jedna po drugiej. Typowy przykład, nazywany potocznie write skew: dwóch lekarzy jednocześnie sprawdza, że na dyżurze jest ich dwóch, i każdy się wypisuje. Każda transakcja osobno jest poprawna, a razem zostawiają dyżur pusty. Wyklucza to dopiero serializable.',
    '<b>Standard a PostgreSQL.</b> Ilustracja pokazuje standard SQL. PostgreSQL jest ściślejszy w dwóch miejscach: nie ma brudnych odczytów na read uncommitted ani fantomów na repeatable read. Jego repeatable read to technika snapshot isolation, która nadal dopuszcza serialization anomaly.',
    '<b>Snowflake.</b> Dokumentacja mówi, że transakcje gwarantują własności ACID, a read committed jest jedynym poziomem izolacji obsługiwanym obecnie dla tabel. Skutek dla potoku z kilkoma instrukcjami: jeśli między pierwszą a drugą ktoś załaduje nowe dane do źródła, druga instrukcja je zobaczy. Gdy to przeszkadza, przeczytaj źródło raz (do tabeli pośredniej) albo zrób całość jedną instrukcją, np. jednym <code>MERGE</code>.',
    '<b>Spójność to nie poprawność biznesowa.</b> Baza pilnuje tylko reguł, które zna i sprawdza. Klucz zadeklarowany, ale niesprawdzany, taką regułą nie jest.'
  ]
};

export interface ArchItem { id: string; label: string; layers: { name: string; text: string }[]; facts: string[][]; risk: string }
/** Etap Architektura, część 1: trzy wzorce platformy danych. Warstwy czyta się od dołu (storage) do góry (odbiorcy). */
export const architectures = {
  title: 'Gdzie leżą dane i kto pilnuje ich struktury?',
  intro: 'Ten sam sklep ma zamówienia w tabelach, logi w JSON i zdjęcia produktów. Gdzie to wszystko położyć? Trzy wzorce różnią się dwiema rzeczami: w jakiej postaci leżą dane i kto pilnuje ich struktury oraz transakcji. Warstwy czytaj od dołu. Storage to miejsce, gdzie leżą dane. Silnik to compute, czyli to, co je przelicza.',
  assumptions: 'Schemat uproszczony. Prawdziwe platformy łączą te wzorce, a produkty takie jak Snowflake i Databricks obsługują dziś więcej niż jeden.',
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
      facts: [['Dane', 'Tabele o ustalonych kolumnach, przygotowane do analizy'], ['Schemat', 'Sprawdzany przy zapisie (schema on write)'], ['Transakcje', 'Tak, w silniku'], ['Typowi odbiorcy', 'Analitycy, narzędzia BI']],
      risk: 'Dane muszą pasować do tabel, a format, w którym leżą, należy do platformy.'
    },
    {
      id: 'lake', label: 'Data lake',
      layers: [
        { name: 'Odbiorcy', text: 'Data science, przetwarzanie wsadowe' },
        { name: 'Silnik', text: 'Dowolny silnik, który umie czytać pliki' },
        { name: 'Storage', text: 'Pliki w object storage: CSV, JSON, Parquet, obrazy' }
      ],
      facts: [['Dane', 'Dowolne pliki, także surowe: logi, obrazy, nagrania'], ['Schemat', 'Nadawany dopiero przy odczycie (schema on read)'], ['Transakcje', 'Same pliki ich nie dają'], ['Typowi odbiorcy', 'Inżynierowie danych, data science']],
      risk: 'Bez opisu, właściciela i kontroli jakości nikt nie wie, co w nim leży. To tak zwane bagno danych (data swamp). Kto czyta w trakcie zapisu, może zobaczyć tylko część plików.'
    },
    {
      id: 'lakehouse', label: 'Lakehouse',
      layers: [
        { name: 'Odbiorcy', text: 'BI, SQL, data science na tych samych tabelach' },
        { name: 'Silnik', text: 'Silniki, które obsługują dany format tabel' },
        { name: 'Storage', text: 'Pliki Parquet w object storage + metadane formatu tabel (Delta Lake, Iceberg)' }
      ],
      facts: [['Dane', 'Tabele oraz pliki surowe obok'], ['Schemat', 'Pilnowany przez format tabel'], ['Transakcje', 'Tak, przez metadane formatu tabel'], ['Typowi odbiorcy', 'Wszyscy powyżsi']],
      risk: 'Otwarty format nie utrzymuje się sam. Ktoś odpowiada za scalanie małych plików, usuwanie starych wersji i katalog tabel. I nie każdy silnik obsługuje każdy format oraz każdą jego funkcję.'
    }
  ] as ArchItem[],
  takeaway: '<b>Wniosek.</b> <b>Data warehouse</b> to zarządzany silnik z uporządkowanymi tabelami. <b>Data lake</b> to tani magazyn plików w dowolnym formacie. Same pliki nie dają transakcji na poziomie tabeli. <b>Lakehouse</b> dokłada do plików <b>format tabel</b> (table format), np. Delta Lake albo Iceberg. To metadane, które mówią, które pliki tworzą aktualną wersję tabeli. Dzięki nim pliki zachowują się jak tabele, a czytać je może każdy silnik, który ten format obsługuje.',
  moreTitle: 'Dlaczego granice się zacierają',
  more: [
    'Dokumentacja Databricks definiuje lakehouse jako system, który łączy zalety data lake i hurtowni danych. Delta Lake opisuje jako pliki Parquet uzupełnione o log transakcyjny, czyli dziennik zmian zapisany w plikach. To on daje transakcje ACID. Iceberg robi to samo własnymi plikami metadanych.',
    'Snowflake obsługuje tabele Apache Iceberg w plikach Parquet. Pliki mogą leżeć w storage\'u zarządzanym przez Snowflake albo w storage\'u klienta. Katalogiem, czyli spisem tabel, może być Snowflake albo katalog zewnętrzny.',
    'Na rozmowie bezpieczniej mówić o wzorcach niż wkładać produkt do jednej szufladki. „Snowflake to hurtownia, Databricks to lakehouse" jest dziś uproszczeniem.'
  ]
};

/** Etap Architektura, część 2: ETL i ELT. Krok `where` mówi, na czyjej mocy obliczeniowej działa transformacja. */
export const etl = {
  title: 'Gdzie działa transformacja?',
  intro: 'Dane trzeba pobrać ze źródła (Extract), przekształcić (Transform) i załadować do systemu docelowego (Load). Oba podejścia mają te same trzy kroki. Różnią się tym, kiedy i gdzie działa przekształcanie. Od tego zależy, co leży w hurtowni.',
  defaultId: 'elt',
  variants: [
    {
      id: 'etl', label: 'ETL',
      steps: [
        { name: 'Extract', where: 'źródło', hot: false },
        { name: 'Transform', where: 'osobny silnik', hot: true },
        { name: 'Load', where: 'hurtownia', hot: false }
      ],
      inWarehouse: 'Przekształcony wynik. Surowe dane tylko wtedy, gdy potok zachowa je osobno, np. w plikach.',
      good: 'Dane wrażliwe można zamaskować, zanim trafią do hurtowni. System docelowy nie musi mieć dużej mocy.',
      bad: 'Po zmianie reguły trzeba mieć skąd wziąć surowe dane: ze źródła, o ile jeszcze je ma, albo z własnej kopii. Logika żyje w osobnym narzędziu.'
    },
    {
      id: 'elt', label: 'ELT',
      steps: [
        { name: 'Extract', where: 'źródło', hot: false },
        { name: 'Load', where: 'hurtownia · warstwa surowa', hot: false },
        { name: 'Transform', where: 'hurtownia · jej compute', hot: true }
      ],
      inWarehouse: 'Dane surowe i wszystkie warstwy przekształceń, tak długo, jak je przechowujesz.',
      good: 'Dopóki przechowujesz surowe dane, możesz przeliczyć modele po zmianie reguły. Transformacje to SQL pod kontrolą wersji.',
      bad: 'Każda transformacja zużywa compute hurtowni. Dane wrażliwe leżą w warstwie surowej, więc ona też wymaga kontroli dostępu.'
    }
  ],
  takeaway: '<b>Wniosek.</b> <b>ETL</b> przekształca dane przed załadowaniem, w osobnym silniku. <b>ELT</b> ładuje dane surowe i przekształca je już w systemie docelowym. Dokumentacja Microsoft ujmuje to jednym zdaniem: ELT różni się od ETL wyłącznie miejscem transformacji i działa dobrze tylko wtedy, gdy system docelowy ma dość mocy. Samo ELT nie gwarantuje, że surowe dane zostaną na zawsze. O tym decyduje to, jak długo je przechowujesz.',
  bridge: {
    from: 'dbt',
    known: 'dbt uruchamia Twoje modele jako zapytania SQL w hurtowni, w kolejności zależności. Dane do warstwy surowej ładuje inne narzędzie.',
    fresh: 'dbt jest literą T w ELT. Warstwy staging, intermediate i marts to kolejne kroki transformacji wykonywane w systemie docelowym.',
    breaks: 'dbt nie pobiera i nie ładuje danych, więc sam nie jest całym potokiem ELT. A lekkie przekształcenia, np. maskowanie, często i tak dzieją się przed załadowaniem. Podział nie jest zero-jedynkowy.'
  } as Bridge
};

/** Etap Architektura, część 3: separacja storage i compute. */
export const separation = {
  title: 'Co się zmienia, gdy dane i moc obliczeniowa są osobno?',
  intro: 'Storage to miejsce, gdzie leżą dane. Compute to maszyny, które je przeliczają. W klasycznej hurtowni na własnych serwerach każdy serwer (węzeł) ma jedno i drugie: swoje dyski i swoje procesory. Przełącz układ i zobacz, co się dzieje z trzema rodzajami pracy: ładowaniem, dbt i BI.',
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
        'Miejsce na dane i moc obliczeniową dokładasz i opłacasz osobno.',
        'Każdy rodzaj pracy ma własny klaster i czyta te same dane. Ciężka transformacja nie zabiera mocy obliczeniowej dashboardom.',
        'Nieużywany compute można wyłączyć.'
      ]
    }
  ],
  takeaway: '<b>Wniosek.</b> <b>Separacja storage i compute</b> to jedno wspólne miejsce na dane i osobne klastry, które je przeliczają. Zyskujesz dwie rzeczy: każdą część powiększasz osobno, a różne rodzaje pracy nie zabierają sobie mocy (workload isolation). W Snowflake te klastry to <b>virtual warehouses</b>. Dokumentacja mówi, że każdy z nich jest niezależnym klastrem, który nie dzieli zasobów obliczeniowych z innymi.',
  moreTitle: 'Trzy warstwy Snowflake i koszty rozdzielenia',
  more: [
    'Dokumentacja Snowflake wymienia trzy warstwy: <b>database storage</b>, <b>compute</b> i <b>cloud services</b>. Architekturę opisuje jako połączenie dwóch podejść: shared-disk (jedno wspólne miejsce na dane) i shared-nothing (niezależne klastry obliczeniowe).',
    'Skalowanie w górę (scale up, większy warehouse) daje więcej mocy pojedynczemu zapytaniu. Skalowanie wszerz (scale out, więcej klastrów) obsługuje więcej zapytań naraz. To dwa różne narzędzia na dwa różne problemy.',
    'Izolacja dotyczy mocy obliczeniowej. Dashboard nadal może zwolnić z innych powodów, na przykład gdy jego własny warehouse jest za mały albo zapytania czekają w kolejce.',
    'Koszty: dane nie leżą już przy procesorze, więc silnik czyta je przez sieć i polega na cache\'u. A compute uruchamia się tak łatwo, że rachunek wymaga pilnowania. To ocena ogólna, nie cytat z dokumentacji.'
  ]
};

export interface Scenario { setup: string; options: string[]; correct: number; why: string; scope: string }
/** Etap Architektura, część 4: wybór architektury dla wymagań. Scenariusze wymyślone. */
export const choose = {
  title: 'Dobór architektury: co proponujesz?',
  intro: 'Pięć wymyślonych sytuacji. W każdej wybierz punkt wyjścia, zanim przeczytasz uzasadnienie. Nie ma jednej słusznej architektury. Liczy się to, które wymaganie przesądza o wyborze.',
  ask: 'Twój punkt wyjścia:',
  cases: [
    {
      setup: 'Firma handlowa: dane z systemu sprzedaży i CRM, 40 analityków z narzędziem BI, raporty odświeżane co godzinę, zespół zna SQL.',
      options: ['Data lake z plikami Parquet i własnym klastrem Sparka', 'Chmurowa hurtownia danych z ELT i dbt', 'Baza OLTP z replikami do odczytu'],
      correct: 1,
      why: 'Dane to zwykłe tabele. Korzystają z nich ludzie z BI i SQL-em. Odświeżanie co godzinę nie wymaga streamingu. Zarządzana hurtownia z transformacjami w SQL to najprostszy projekt, który spełnia wymagania, a zespół już umie z nią pracować.',
      scope: 'Jeśli pojawi się dużo plików, które nie są tabelami (logi, obrazy), albo drugi silnik ma czytać te same tabele, warto wrócić do tej decyzji.'
    },
    {
      setup: 'Aplikacja mobilna musi pokazać klientowi jego saldo punktów w kilkadziesiąt milisekund. Zapytań jest kilka tysięcy na sekundę, każde dotyczy jednego klienta.',
      options: ['Widok w hurtowni analitycznej na tabeli standardowej', 'Baza operacyjna (OLTP) z dostępem po kluczu', 'Szeroka tabela w data lake'],
      correct: 1,
      why: 'To praca typu OLTP: bardzo dużo małych odczytów po kluczu i odpowiedź w milisekundach. Tabele analityczne są zbudowane do czytania dużych porcji danych, a nie do tysięcy równoczesnych odczytów pojedynczych wierszy.',
      scope: 'Snowflake ma do takiej pracy tabele hybrydowe z zapisem wierszowym i indeksami. Czy wystarczą, zależy od wymaganego czasu odpowiedzi i liczby zapytań na sekundę. To trzeba zmierzyć.'
    },
    {
      setup: 'Firma zbiera terabajty logów w JSON, zdjęcia produktów i nagrania. Zespół data science trenuje modele w Pythonie, a analitycy chcą SQL na tych samych danych.',
      options: ['Lakehouse: pliki w object storage z formatem tabel', 'Hurtownia, do której ładuje się wyłącznie zagregowane tabele', 'Baza OLTP z kolumnami JSON'],
      correct: 0,
      why: 'Przesądzają trzy wymagania naraz: pliki, które nie są tabelami, bezpośredni dostęp do plików dla uczenia maszynowego i SQL na tych samych danych. Format tabel nad object storage daje transakcje i schemat bez kopiowania danych do drugiego systemu.',
      scope: 'Jeśli analitycy potrzebują tylko kilku zagregowanych tabel, sensowny jest też układ mieszany: surowe dane w lake\'u, modele dla BI w hurtowni.'
    },
    {
      setup: 'Bank musi usunąć numery PESEL z danych, zanim opuszczą sieć wewnętrzną. Hurtownia jest w chmurze publicznej.',
      options: ['ELT: ładujemy wszystko surowe, maskujemy w hurtowni', 'Transformacja (maskowanie) przed załadowaniem, czyli krok ETL', 'Rezygnujemy z hurtowni w chmurze'],
      correct: 1,
      why: 'Wymaganie mówi, że numery PESEL nie mogą trafić do hurtowni w jawnej postaci. W czystym ELT surowe dane lądują w hurtowni przed transformacją. Maskowanie musi więc nastąpić wcześniej.',
      scope: 'Reszta potoku może pozostać ELT. Przed załadowaniem dzieje się tylko to, czego wymagają przepisy, a logika biznesowa zostaje w hurtowni.'
    },
    {
      setup: 'Zarząd chce „dashboardu w czasie rzeczywistym" ze sprzedażą. Dziś dane są ładowane raz na dobę.',
      options: ['Od razu projektuję streaming zdarzeń dla całej platformy', 'Dopytuję, jaka decyzja zależy od świeżości i jaka świeżość wystarczy', 'Zwiększam warehouse, żeby nocne ładowanie było szybsze'],
      correct: 1,
      why: 'Świeżość danych bywa jednym z najdroższych wymagań, bo potrafi zmienić cały potok. Sekundy, minuty i godzina to trzy różne projekty i trzy różne rachunki. Najpierw trzeba ustalić, kto i jaką decyzję podejmie dzięki temu szybciej.',
      scope: 'Często okazuje się, że wystarcza ładowanie co kilkanaście minut. Jeśli naprawdę potrzebne są sekundy, streaming zwykle obejmuje jeden przypadek użycia, a nie całą platformę.'
    }
  ] as Scenario[],
  takeaway: '<b>Wniosek.</b> Kolejność do powiedzenia na rozmowie. Kto korzysta z danych i jak. Jak świeże muszą być. Jakie to dane: tabele czy także pliki. Ile ich jest i ilu użytkowników pyta naraz. Jakie są ograniczenia: przepisy, budżet, umiejętności zespołu. Potem najprostszy projekt, który to spełnia, nazwane kompromisy i warunek, przy którym zmienisz decyzję.'
};

export interface Recall { prompt: string; points: string[] }
/**
 * Etap Interview. Pytania, odpowiedzi 30–60 s (PL i EN) oraz follow-upy przychodzą z Interview Banku.
 * Tutaj jest tylko to, czego bank nie ma: jak mówić o mechanizmach klasycznych baz, znając je głównie
 * od strony hurtowni, oraz krótkie ćwiczenia z przypominania.
 */
export const interview = {
  honestIntro: 'Pracujesz głównie w hurtowni, a pytanie dotyczy indeksów albo kluczy sprawdzanych przez bazę? Nie udawaj administratora bazy transakcyjnej. Pokaż, że rozumiesz mechanizm i wiesz, czym różni się od tego, czego używasz na co dzień. Na przykład tak:',
  honestEn: '“Most of my hands-on work is in Snowflake. So let me explain the mechanism first, and then how Snowflake differs. A B-tree index is a sorted, balanced tree. It takes the database from a value to the row in a few page reads. The price is extra work on writes. In Snowflake standard tables I don’t create indexes. Snowflake skips micro-partitions using min and max values, so what I control is how the data is ordered: load order or a clustering key. Primary and foreign keys aren’t enforced there. So I handle them in the pipeline, with deduplication and dbt tests.”',
  honestPl: 'Po polsku: na co dzień pracuję głównie w Snowflake. Najpierw wyjaśnię mechanizm, potem różnicę. Indeks B-tree to posortowane, zrównoważone drzewo. Prowadzi bazę od wartości do wiersza w kilku odczytach stron. Ceną jest dodatkowa praca przy zapisie. W tabelach standardowych Snowflake nie tworzę indeksów. Snowflake pomija mikropartycje na podstawie wartości min i max, więc mam wpływ na ułożenie danych: kolejność ładowania albo klucz klastrowania. Klucze główne i obce nie są tam sprawdzane. Dbam o nie w potoku: deduplikacją i testami dbt.',
  recallTitle: 'Powiedz to na głos',
  recallIntro: 'Osiem krótkich poleceń. Odpowiedz na głos po angielsku w dwóch lub trzech zdaniach, dopiero potem rozwiń punkty kontrolne.',
  recall: [
    { prompt: 'Explain OLTP versus OLAP without naming any product.', points: ['rodzaj pracy: dużo małych operacji na pojedynczych wierszach kontra mało ciężkich zapytań po milionach wierszy', 'wielu użytkowników naraz i szybka odpowiedź kontra szybkie czytanie dużej ilości danych', 'model znormalizowany kontra model wygodny do czytania'] },
    { prompt: 'Why does a columnar engine read less data for an aggregate?', points: ['w bloku leżą wartości jednej kolumny', 'czytane są tylko kolumny z zapytania', 'podobne wartości lepiej się kompresują'] },
    { prompt: 'Walk through 1NF, 2NF and 3NF using an orders table.', points: ['1NF: jedna wartość w komórce, wiersz ma klucz', '2NF: nazwa produktu zależy tylko od product_id, więc idzie do products', '3NF: miasto zależy od zamówienia tylko przez klienta (zależność przechodnia), więc idzie do customers', 'po co: anomalie aktualizacji, wstawiania i usuwania'] },
    { prompt: 'Are primary keys enforced in Snowflake?', points: ['tabele standardowe: PK, UNIQUE i FK nie są wymuszane', 'NOT NULL i CHECK są wymuszane', 'tabele hybrydowe wymuszają klucze', 'w praktyce: deduplikacja i testy dbt'] },
    { prompt: 'When does a B-tree index not help?', points: ['filtr pasuje do dużej części tabeli', 'wzorzec LIKE bez początku', 'funkcja na kolumnie bez indeksu na wyrażeniu', 'koszt: dodatkowa praca przy zapisie i miejsce'] },
    { prompt: 'How do you check whether partition pruning works in Snowflake?', points: ['Query Profile: partitions scanned kontra partitions total', 'pruning zależy od tego, czy dane są ułożone po kolumnie z filtra', 'na co masz wpływ: kolejność ładowania, klucz klastrowania'] },
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
    why: 'W zapisie kolumnowym każda kolumna leży osobno, więc 38 niepotrzebnych kolumn silnik w ogóle nie czyta. W zapisie wierszowym leżą one w tych samych blokach co dwie potrzebne.'
  },
  {
    q: 'Tabela <code>order_lines</code> ma klucz (<code>order_id</code>, <code>product_id</code>) i kolumnę <code>product_name</code>. Którą postać normalną to łamie?',
    options: ['Pierwszą, bo nazwa produktu się powtarza', 'Drugą, bo nazwa produktu zależy tylko od części klucza', 'Trzecią, bo nazwa produktu zależy od innej kolumny niekluczowej'],
    correct: 1,
    why: 'Nazwa produktu zależy tylko od <code>product_id</code>, czyli od kawałka klucza. Nie ma znaczenia, w którym zamówieniu produkt się znalazł. To zależność częściowa, którą usuwa druga postać normalna. Trzecia dotyczy kolumn zależnych od innej kolumny, która nie jest kluczem.'
  },
  {
    q: 'W tabeli standardowej Snowflake zadeklarowano <code>PRIMARY KEY (order_id)</code>. Wstawiasz drugi wiersz z tym samym <code>order_id</code>. Co się stanie?',
    setup: 'Założenia: tabela standardowa (nie hybrydowa), według dokumentacji Snowflake.',
    options: ['Błąd naruszenia klucza głównego', 'Wiersz zostanie wstawiony, w tabeli będą duplikaty', 'Wiersz zastąpi poprzedni'],
    correct: 1,
    why: 'W tabelach standardowych Snowflake nie sprawdza <code>PRIMARY KEY</code>, <code>UNIQUE</code> ani <code>FOREIGN KEY</code>. Sprawdza <code>NOT NULL</code> i <code>CHECK</code>. O unikalność trzeba zadbać w potoku, a potem wykryć ewentualne duplikaty testem.'
  },
  {
    q: 'Na kolumnie <code>status</code> jest indeks B-tree, a warunek <code>status = \'paid\'</code> spełnia 70% wierszy. Czego się spodziewasz w planie?',
    setup: 'Założenia: klasyczna baza relacyjna z planerem kosztowym i aktualnymi statystykami.',
    options: ['Index Scan, bo indeks istnieje', 'Pełnego skanu, bo filtr pasuje do większości tabeli i droga przez indeks wyszłaby drożej', 'Błędu, bo indeksu nie można użyć z równością'],
    correct: 1,
    why: 'Indeks opłaca się, gdy filtr pasuje do małej części tabeli. Przy 70% wierszy skakanie przez indeks po każdy wiersz kosztuje więcej niż przeczytanie tabeli po kolei. W przykładzie z dokumentacji PostgreSQL filtr pasujący do 7000 z 10 000 wierszy dał <code>Seq Scan</code>.'
  },
  {
    q: 'Czym klucz klastrowania w Snowflake różni się od indeksu?',
    options: ['Niczym, to dwie nazwy tej samej struktury', 'Indeks wskazuje pojedyncze wiersze, a klastrowanie układa dane tak, żeby dało się pomijać mikropartycje', 'Klucz klastrowania wymusza unikalność'],
    correct: 1,
    why: 'Indeks to osobna struktura, która prowadzi do pojedynczych wierszy. Klucz klastrowania decyduje o tym, które wiersze leżą razem w mikropartycjach. Podobne wartości trafiają obok siebie, więc filtr może pominąć więcej mikropartycji. Niczego nie wymusza.'
  },
  {
    q: 'Tabela jest dobrze uporządkowana po <code>order_date</code>. Zapytanie filtruje tylko po <code>customer_id</code>. Co pokaże Query Profile?',
    setup: 'Założenia: tabela standardowa Snowflake, każdy klient zamawia przez cały okres, bez search optimization service.',
    options: ['Partitions scanned dużo mniejsze niż partitions total', 'Partitions scanned bliskie partitions total', 'Zero partycji, bo wynik przyjdzie z metadanych'],
    correct: 1,
    why: 'Ułożenie po dacie sprawia, że każda mikropartycja ma mało dat. Ale klienci są w każdej z nich z całego zakresu numerów. Szukany <code>customer_id</code> mieści się między minimum a maksimum każdej mikropartycji, więc żadnej nie da się pominąć.'
  },
  {
    q: 'Transakcja na poziomie read committed czyta saldo konta dwa razy. Między odczytami inna transakcja zatwierdza zmianę salda. Co zobaczy drugi odczyt?',
    options: ['Starą wartość, bo transakcja ma jedną migawkę', 'Nową wartość: to odczyt niepowtarzalny, dopuszczalny na tym poziomie', 'Błąd serializacji'],
    correct: 1,
    why: 'Na poziomie read committed każda instrukcja widzi dane zatwierdzone przed jej startem. Drugi odczyt zaczyna się po zatwierdzeniu zmiany, więc widzi nowe saldo. To non-repeatable read. Wyklucza go dopiero repeatable read.'
  },
  {
    q: 'Co lakehouse dodaje do zwykłego data lake?',
    options: ['Szybsze dyski', 'Format tabel, czyli metadane o plikach: transakcje, pilnowanie schematu, statystyki', 'Obowiązkową hurtownię obok'],
    correct: 1,
    why: 'Pliki danych nadal leżą w object storage. Format tabel, np. Delta Lake albo Iceberg, dokłada metadane, które mówią, które pliki tworzą aktualną wersję tabeli. Stąd transakcje ACID. Te same tabele może czytać każdy silnik, który dany format obsługuje.'
  },
  {
    q: 'Reguła biznesowa liczenia przychodu zmieniła się i trzeba przeliczyć dwa lata danych. W którym podejściu jest to prostsze i dlaczego?',
    options: ['W ETL, bo dane są już oczyszczone', 'W ELT, bo surowe dane leżą w hurtowni i modele można przebudować', 'Bez różnicy'],
    correct: 1,
    why: 'W ELT surowe dane leżą w systemie docelowym, więc wystarczy zmienić model i uruchomić go ponownie. Warunek: surowe dane z tych dwóch lat nadal są przechowywane. W ETL do hurtowni trafił tylko wynik starej reguły. Trzeba wrócić do źródła albo do własnej kopii surowych danych, o ile istnieje.'
  },
  {
    q: 'Dashboardy zwalniają za każdym razem, gdy działa ciężki model dbt. Oba obciążenia używają tego samego virtual warehouse. Co proponujesz najpierw?',
    options: ['Osobny warehouse dla dbt i osobny dla BI', 'Denormalizację wszystkich tabel', 'Klucz klastrowania na każdej tabeli'],
    correct: 0,
    why: 'Zapytania nie są tu złe. Po prostu dbt i dashboardy biją się o tę samą moc obliczeniową. Dzięki separacji storage i compute każdy rodzaj pracy może dostać własny klaster, który czyta te same dane. Według dokumentacji Snowflake virtual warehouses nie dzielą między sobą zasobów obliczeniowych.'
  }
];

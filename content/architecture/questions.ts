import type { Question } from '../types';

/**
 * Pytania: bazy danych i architektura danych. Zweryfikowane w dokumentacji Snowflake, PostgreSQL 19, dbt,
 * Databricks i Microsoft (linki i daty w docs/verified-facts.md, sekcja „Lekcja 06").
 * „Klasyczna baza relacyjna" oznacza tu zachowanie opisane w dokumentacji PostgreSQL. Zachowanie Snowflake
 * jest zawsze podpisane osobno, z rozróżnieniem tabel standardowych i hybrydowych.
 */
export const architectureQuestions: Question[] = [
  {
    id: 'arch-oltp-olap',
    topicId: 'architecture.oltp-olap',
    area: 'architecture',
    priority: 'P0',
    title: 'OLTP vs OLAP, wiersze vs kolumny',
    question: {
      pl: 'Czym różni się OLTP od OLAP i dlaczego jedne bazy przechowują dane wierszami, a inne kolumnami?',
      en: 'What is the difference between OLTP and OLAP, and why do some databases store data by row and others by column?'
    },
    answer: {
      pl: 'System OLTP obsługuje bieżące działanie firmy: bardzo dużo małych, równoległych transakcji, które czytają albo zmieniają kilka wierszy, na przykład złożenie zamówienia. Potrzebuje szybkiego dostępu po kluczu, ścisłej spójności i zwykle znormalizowanego schematu. System OLAP służy do analizy: zapytań jest mniej, ale są ciężkie, skanują miliony wierszy i agregują kilka kolumn, najczęściej na schemacie gwiazdy zasilanym ze źródeł OLTP. Z tego wynika sposób zapisu. Zapis wierszowy trzyma cały wiersz razem, co jest idealne do odczytu albo zapisu jednego zamówienia. Zapis kolumnowy trzyma razem wartości jednej kolumny, więc agregacja czyta tylko potrzebne kolumny, a dane dobrze się kompresują. Dlatego PostgreSQL jest wierszowy, a Snowflake kolumnowy.',
      en: 'OLTP systems run the business: lots of small, concurrent transactions that read or change a handful of rows, like placing an order. They need fast lookups by key, strict consistency and usually a normalized schema. OLAP systems analyse the business: fewer but much heavier queries that scan millions of rows and aggregate a few columns, typically on a star schema loaded from the OLTP sources. That difference drives storage. Row-oriented storage keeps a whole row together, which is ideal for reading or writing one order. Column-oriented storage keeps the values of one column together, so an aggregate reads only the columns it needs and the data compresses well. That is why PostgreSQL is row-based and Snowflake is columnar.'
    },
    senior: {
      pl: 'Granica się zaciera: Snowflake ma tabele hybrydowe z zapisem wierszowym i indeksami do obciążeń operacyjnych, a silniki wierszowe mają indeksy kolumnowe. Dlatego mówię o obciążeniu, a nie o produkcie: kształt zapytań, współbieżność i wymagana świeżość decydują o wyborze.',
      en: 'The line is blurring: Snowflake has hybrid tables with row storage and indexes for operational workloads, and row stores offer columnstore indexes. So I talk about the workload rather than the product: query shape, concurrency and required freshness drive the choice.'
    },
    explain: [
      'Weź tabelę zamówień i dwa pytania. Aplikacja pyta: pokaż zamówienie 48213. Analityk pyta: jaki był przychód na kraj w 2025 roku. Pierwsze pytanie dotyczy jednego wiersza i wszystkich jego kolumn. Drugie dotyczy wszystkich wierszy i dwóch kolumn.',
      'Dysk czyta dane blokami. Jeśli w bloku leżą całe wiersze, jedno zamówienie to jeden blok, ale suma kolumny <code>amount</code> wymaga przeczytania wszystkich bloków razem z kolumnami, których zapytanie nie potrzebuje. Jeśli w bloku leżą wartości jednej kolumny, suma czyta tylko bloki <code>amount</code>, za to złożenie jednego wiersza wymaga sięgnięcia do każdej kolumny osobno.',
      'Wartości jednej kolumny są do siebie podobne (ten sam typ, często powtarzające się wartości), więc kompresują się lepiej niż wiersze o mieszanych typach. To druga przyczyna, dla której hurtownie analityczne są kolumnowe.',
      'W Snowflake dane tabeli standardowej leżą w mikropartycjach, a wewnątrz każdej z nich kolumny są zapisane i skompresowane osobno. <b>OLTP</b> to skrót od Online Transaction Processing, <b>OLAP</b> od Online Analytical Processing.'
    ],
    keywords: ['OLTP', 'OLAP', 'row store', 'column store', 'kompresja', 'point lookup', 'agregacja'],
    followUps: [
      { q: 'Why not run analytics directly on the OLTP database?', a: 'Heavy scans compete with transactions for the same resources, and a normalized row store is the wrong shape for aggregates. You offload analytics to a system built for it, so reporting does not slow down the application.', pl: 'Ciężkie skany zabierają zasoby transakcjom, a model i zapis są pod inne pytania.' },
      { q: 'Why is columnar storage slow for single-row writes?', a: 'A row has to be split across every column, and columnar files are usually immutable and compressed, so changing one row can mean rewriting a whole block or file. Columnar engines prefer batch loads.', pl: 'Jeden wiersz dotyka wszystkich kolumn, a pliki kolumnowe są niezmienne.' },
      { q: 'What does SELECT * cost in a columnar warehouse?', a: 'It gives up column pruning: the engine has to read every column instead of only the ones the query needs. In a row store the difference is small, in a column store it can be most of the scan.', pl: 'Tracisz pomijanie kolumn, czyli główną zaletę zapisu kolumnowego.' },
      { q: 'Where would you use a Snowflake hybrid table?', a: 'For operational access inside Snowflake: low-latency lookups and single-row updates by key. Hybrid tables use row-oriented storage with indexes and enforce primary, unique and foreign keys. For large analytical scans I would keep standard tables.', pl: 'Do szybkiego dostępu po kluczu; do analityki zostają tabele standardowe.' }
    ],
    mistakes: [
      'Definiowanie OLTP i OLAP przez produkty („OLTP to Postgres") zamiast przez kształt obciążenia.',
      'Twierdzenie, że zapis kolumnowy jest „po prostu szybszy". Jest szybszy dla skanów kilku kolumn, wolniejszy dla zapisu i odczytu pojedynczych wierszy.',
      'Pominięcie kompresji i pomijania kolumn, czyli faktycznych powodów przewagi zapisu kolumnowego w analityce.'
    ]
  },
  {
    id: 'arch-normalization',
    topicId: 'architecture.normalization',
    area: 'architecture',
    priority: 'P0',
    title: 'Normalizacja (1NF, 2NF, 3NF) i denormalizacja',
    question: {
      pl: 'Wyjaśnij pierwszą, drugą i trzecią postać normalną. Kiedy świadomie denormalizujesz?',
      en: 'Explain first, second and third normal form. When would you deliberately denormalize?'
    },
    answer: {
      pl: 'Normalizacja usuwa redundancję, tak żeby każdy fakt był zapisany raz. Pierwsza postać normalna: każda kolumna trzyma jedną wartość, nie ma powtarzających się grup, a wiersz ma klucz. Druga: każda kolumna niekluczowa zależy od całego klucza, a nie od części klucza złożonego. Trzecia: kolumny niekluczowe zależą tylko od klucza, a nie od siebie nawzajem, więc miasto klienta nie leży w wierszu zamówienia. Zysk to brak anomalii przy wstawianiu, zmianie i usuwaniu, czego potrzebuje system OLTP. W analityce świadomie denormalizuję: schemat gwiazdy albo szeroka tabela powtarzają atrybuty, żeby ograniczyć joiny i uprościć zapytania narzędziom BI. Ceną jest redundancja, dlatego zostawiam znormalizowane źródło i odbudowuję z niego modele zdenormalizowane, na przykład w dbt.',
      en: 'Normalization removes redundancy so that each fact is stored once. First normal form: every column holds a single value, there are no repeating groups, and each row has a key. Second: every non-key column depends on the whole key, not on part of a composite key. Third: non-key columns depend only on the key, not on each other, so the customer city does not live on the order row. The benefit is no insert, update or delete anomalies, which is what an OLTP system needs. In analytics I deliberately denormalize: a star schema or a wide table repeats attributes to cut joins and make queries simpler for BI tools. The cost is redundancy, so I keep the normalized source and rebuild the denormalized models from it, for example with dbt.'
    },
    senior: {
      pl: 'Denormalizacja w hurtowni jest bezpieczna, bo model jest pochodną: nikt nie poprawia w nim wierszy ręcznie, tylko przelicza całość ze źródła. Ryzyko przenosi się na ziarno tabeli i na historię atrybutów, więc każdy model ma jasno nazwane ziarno i test unikalności klucza.',
      en: 'Denormalizing in a warehouse is safe because the model is derived: nobody patches rows by hand, you rebuild it from the source. The risk moves to the grain of the table and to attribute history, so every model has an explicitly named grain and a uniqueness test on its key.'
    },
    explain: [
      'Zacznij od jednej szerokiej tabeli zamówień, w której nazwa i miasto klienta są wpisane w każdym wierszu. Klient się przeprowadza i trzeba poprawić wiele wierszy. Jeśli poprawisz część, baza zawiera dwie wersje prawdy. To <b>anomalia aktualizacji</b>. Podobnie: nie zapiszesz klienta, dopóki nie ma zamówienia, a usuwając ostatnie zamówienie, tracisz dane klienta.',
      'Postacie normalne to kolejne kroki usuwania takich powtórzeń. <b>1NF</b>: jedna wartość w komórce, bez list typu „kabel, mysz". <b>2NF</b>: jeśli klucz jest złożony, np. (<code>order_id</code>, <code>product_id</code>), to nazwa produktu zależy tylko od <code>product_id</code>, więc przenosisz ją do tabeli produktów. <b>3NF</b>: miasto klienta zależy od klienta, a dopiero przez niego od zamówienia, więc trafia do tabeli klientów.',
      'Wynik to wiele wąskich tabel połączonych kluczami. Zmiana jest tania i bezpieczna, ale odczyt wymaga joinów. Denormalizacja odwraca ten kompromis: mniej joinów i prostszy SQL za cenę powtórzonych danych.',
      'Projekt logiczny mówi, jakie są encje, atrybuty i zależności. Projekt fizyczny mówi, jak to zapisać w konkretnym silniku: typy, indeksy, partycjonowanie, klastrowanie. Normalizacja jest decyzją logiczną, a denormalizacja zwykle fizyczną, podejmowaną dla wydajności odczytu.'
    ],
    keywords: ['1NF', '2NF', '3NF', 'anomalie', 'zależność częściowa', 'zależność przechodnia', 'schemat gwiazdy', 'ziarno'],
    followUps: [
      { q: 'What is the difference between a logical and a physical data model?', a: 'The logical model describes entities, attributes, keys and relationships independently of any engine. The physical model is how you implement it on a specific platform: data types, indexes or clustering, partitioning, materialization. One logical model can have several physical designs.', pl: 'Logiczny: co i jak się łączy. Fizyczny: jak to zapisać w konkretnym silniku.' },
      { q: 'What is a transitive dependency?', a: 'A non-key column that depends on another non-key column rather than directly on the key. Order determines customer, and customer determines city, so city on the order row is transitive. Third normal form removes it.', pl: 'Kolumna zależy od klucza przez inną kolumnę niekluczową.' },
      { q: 'Is a star schema normalized?', a: 'The fact table is fairly normalized: keys and measures. The dimensions are deliberately denormalized, flattening hierarchies into one table. A snowflake schema normalizes the dimensions again, at the cost of more joins.', pl: 'Fakty raczej tak, wymiary celowo nie.' },
      { q: 'What can go wrong with one big table?', a: 'Redundancy and grain. Repeated attributes must be rebuilt consistently, a change in a dimension means rewriting many rows, and joining at the wrong grain silently duplicates measures. It also couples every consumer to one very wide contract.', pl: 'Powtórzenia, koszt przebudowy i zdublowane miary przy złym ziarnie.' }
    ],
    mistakes: [
      'Recytowanie definicji bez przykładu anomalii. Rekruter chce usłyszeć, jaki problem rozwiązuje każda postać.',
      'Mylenie 2NF z 3NF: 2NF dotyczy zależności od części klucza złożonego, 3NF zależności między kolumnami niekluczowymi.',
      'Teza „denormalizacja jest zła" albo „normalizacja jest przestarzała". To kompromis zależny od obciążenia.'
    ]
  },
  {
    id: 'arch-keys-integrity',
    topicId: 'architecture.keys-integrity',
    area: 'architecture',
    priority: 'P0',
    title: 'Klucze i integralność referencyjna',
    question: {
      pl: 'Czym są klucz główny, klucz obcy i integralność referencyjna? Jak traktuje je Snowflake?',
      en: 'What are primary keys, foreign keys and referential integrity? How does Snowflake treat them?'
    },
    answer: {
      pl: 'Klucz główny jednoznacznie identyfikuje wiersz: jest unikalny i nie może być pusty. Klucz obcy mówi, że wartość w jednej tabeli musi istnieć jako klucz w drugiej, i tę regułę nazywamy integralnością referencyjną. W bazie transakcyjnej takiej jak PostgreSQL silnik wymusza jedno i drugie: duplikat klucza albo osierocony wiersz jest odrzucany przy zapisie. Snowflake działa inaczej. W tabelach standardowych można zadeklarować klucz główny, unikalny i obcy, ale nie są one wymuszane; wymuszane są tylko NOT NULL i CHECK. Nadal przydają się jako dokumentacja, dla narzędzi BI i dla optymalizatora, jeśli oznaczysz je RELY. W hurtowni integralność jest więc zadaniem potoku: deduplikuję po kluczu w modelu i dowodzę tego testami dbt, takimi jak unique, not_null i relationships.',
      en: 'A primary key uniquely identifies a row: it is unique and not null. A foreign key says that a value in one table must exist as a key in another, and that rule is referential integrity. In a transactional database like PostgreSQL the engine enforces both: a duplicate key or an orphan row is rejected at write time. Snowflake is different. On standard tables you can declare primary, unique and foreign keys, but they are not enforced; only NOT NULL and CHECK are. They are still useful as documentation, for BI tools, and for the optimizer if you mark them RELY. So in a warehouse integrity is the pipeline’s job: I deduplicate on the key in the model and prove it with dbt tests such as unique, not_null and relationships.'
    },
    senior: {
      pl: 'RELY to obietnica, nie kontrola: optymalizator może dzięki niej usunąć zbędny join, ale jeśli dane łamią ograniczenie, wynik może być błędny. Ustawiam RELY tylko tam, gdzie test dbt pilnuje klucza przy każdym uruchomieniu. Tabele hybrydowe Snowflake wymuszają klucze, ale to inny typ tabeli do innych obciążeń.',
      en: 'RELY is a promise, not a check: it lets the optimizer eliminate an unnecessary join, but if the data violates the constraint the result can be wrong. I set RELY only where a dbt test guards the key on every run. Snowflake hybrid tables do enforce keys, but that is a different table type for a different workload.'
    },
    explain: [
      'Tabela zamówień ma kolumnę <code>customer_id</code>. Co się stanie, jeśli ktoś wstawi zamówienie dla klienta 999, którego nie ma w tabeli klientów? Taki wiersz to <b>sierota</b>: join z klientami go zgubi albo zwróci puste kolumny. Klucz obcy jest regułą, która tego zabrania.',
      'W klasycznej bazie relacyjnej silnik sprawdza regułę przy każdym zapisie. Żeby sprawdzać unikalność szybko, PostgreSQL przy deklaracji klucza głównego sam tworzy unikalny indeks. Ta kontrola kosztuje przy każdym wstawieniu, co jest akceptowalne przy pojedynczych wierszach, a drogie przy ładowaniu milionów.',
      'Hurtownie analityczne ładują dane hurtowo, często równolegle i nie w kolejności zależności, więc Snowflake w tabelach standardowych nie wymusza <code>PRIMARY KEY</code>, <code>UNIQUE</code> ani <code>FOREIGN KEY</code>. Deklaracja zostaje w metadanych. Dwa wiersze z tym samym „kluczem głównym" wstawią się bez błędu.',
      'Dlatego kontrolę przenosi się do potoku. Test dbt to zapytanie, które po zbudowaniu modelu szuka wierszy łamiących regułę. Różnica wobec ograniczenia w bazie: test wykrywa problem po fakcie, a nie blokuje zapisu.'
    ],
    keywords: ['primary key', 'foreign key', 'referential integrity', 'NOT ENFORCED', 'RELY', 'dbt tests', 'hybrid tables'],
    followUps: [
      { q: 'If constraints are not enforced, why declare them in Snowflake?', a: 'They document the model, BI and modelling tools read them to discover keys and relationships, and with RELY the optimizer can use them, for example to eliminate a join. They just do not protect the data.', pl: 'Dokumentacja, narzędzia BI i optymalizator (RELY), ale nie ochrona danych.' },
      { q: 'How do dbt tests differ from database constraints?', a: 'An enforced constraint rejects bad data at write time. A dbt test is a query that runs after the model is built and reports rows that break the rule. So tests detect, constraints prevent. On Snowflake most dbt constraints are metadata only.', pl: 'Ograniczenie blokuje zapis, test wykrywa po zbudowaniu modelu.' },
      { q: 'What is the difference between a natural key and a surrogate key?', a: 'A natural key comes from the business, like an order number. A surrogate key is generated by us and carries no meaning. Surrogates isolate the model from source changes and are needed when you keep history, because one business key then has several rows.', pl: 'Naturalny pochodzi z biznesu, sztuczny generujemy sami.' },
      { q: 'How do you guarantee uniqueness in a Snowflake table?', a: 'By construction and by test. The model deduplicates on the key, for example with QUALIFY and ROW_NUMBER or a MERGE on that key, and a unique test fails the run if duplicates still appear.', pl: 'Deduplikacja w modelu plus test unique.' }
    ],
    mistakes: [
      '„Snowflake nie ma ograniczeń". Ma: NOT NULL i CHECK są wymuszane, a klucze można deklarować. Nie są wymuszane w tabelach standardowych.',
      'Założenie, że zadeklarowany klucz główny w Snowflake chroni przed duplikatami.',
      'Ustawienie RELY bez testu, który pilnuje, że dane faktycznie spełniają ograniczenie.'
    ]
  },
  {
    id: 'arch-indexes',
    topicId: 'architecture.indexing',
    area: 'architecture',
    priority: 'P0',
    title: 'Indeks B-tree i co zamiast niego w Snowflake',
    question: {
      pl: 'Jak działa indeks B-tree i kiedy nie pomaga? Co Snowflake stosuje zamiast indeksów?',
      en: 'How does a B-tree index work and when does it not help? What does Snowflake use instead of indexes?'
    },
    answer: {
      pl: 'Indeks B-tree to posortowane, zrównoważone drzewo wartości klucza ze wskaźnikami do wierszy. Zamiast skanować całą tabelę, silnik schodzi od korzenia do liścia w kilku krokach, więc wyszukanie po selektywnym warunku czyta garść stron. Ponieważ drzewo jest posortowane, obsługuje też zakresy, sortowanie i wyszukiwanie po prefiksie. Płaci się za to przy zapisie i miejscem: każdy insert i update musi utrzymać wszystkie indeksy. Indeks nie pomaga, gdy zapytanie zwraca dużą część tabeli albo gdy kolumna jest opakowana w funkcję. W tabelach standardowych Snowflake nie tworzy się indeksów B-tree. Snowflake pomija mikropartycje na podstawie metadanych min i max, w czym pomagają klucze klastrowania, a do wyszukiwań punktowych ma search optimization service. Prawdziwe indeksy mają tabele hybrydowe.',
      en: 'A B-tree index is a sorted, balanced tree of key values with pointers to the rows. Instead of scanning the whole table, the engine walks from the root to a leaf in a few steps, so a lookup on a selective predicate reads a handful of pages. Because the tree is sorted, it also serves ranges, ordering and prefix searches. You pay for it on writes and in storage: every insert and update has to maintain every index. An index does not help when the query returns a large share of the table, or when the column is wrapped in a function. On Snowflake standard tables you do not create B-tree indexes. Snowflake prunes micro-partitions using min and max metadata, helped by clustering keys, and has the search optimization service for point lookups. Hybrid tables do have real indexes.'
    },
    senior: {
      pl: 'W indeksie wielokolumnowym liczy się kolejność: najlepiej działa przy warunkach na kolumnach wiodących. O użyciu indeksu decyduje planer na podstawie statystyk, więc nieaktualne statystyki potrafią dać skan mimo dobrego indeksu. Indeksy nieużywane usuwam, bo spowalniają każdy zapis.',
      en: 'In a multicolumn index the order matters: it works best with conditions on the leading columns. The planner decides whether to use an index based on statistics, so stale statistics can produce a scan despite a good index. I drop unused indexes because they slow down every write.'
    },
    explain: [
      'Bez indeksu baza, szukając zamówienia 48213, musi przeczytać każdą stronę tabeli i sprawdzić każdy wiersz. To <b>full table scan</b>. Przy milionie wierszy to tysiące stron dla jednego wyniku.',
      'Indeks działa jak skorowidz na końcu książki. Wartości klucza są posortowane i ułożone w drzewo: korzeń mówi, w której gałęzi leży szukany zakres, gałąź wskazuje liść, a liść zawiera adres wiersza w tabeli. Drzewo jest zrównoważone, więc do każdego liścia jest tyle samo kroków, a wysokość rośnie bardzo wolno razem z liczbą wierszy.',
      'Kiedy indeks nie pomaga. Jeśli warunek spełnia większość wierszy, skakanie po tabeli wiersz po wierszu jest droższe niż przeczytanie jej po kolei, więc planer wybiera skan. Wzorzec <code>LIKE \'%ski\'</code> nie ma początku, po którym dałoby się zejść w posortowanym drzewie. Dla warunku <code>lower(email) = ...</code> potrzebny jest indeks zbudowany na wyrażeniu <code>lower(email)</code>.',
      'Snowflake rozwiązuje ten sam problem inaczej, bo jego typowe zapytanie czyta miliony wierszy, a nie jeden. Dla każdej mikropartycji przechowuje zakres wartości każdej kolumny i pomija te, które na pewno nie zawierają szukanych wartości. To pomijanie dużych kawałków, a nie adresowanie pojedynczych wierszy.'
    ],
    keywords: ['B-tree', 'full table scan', 'selektywność', 'indeks wielokolumnowy', 'koszt zapisu', 'pruning', 'search optimization service', 'hybrid tables'],
    followUps: [
      { q: 'Why not index every column?', a: 'Each index must be kept in sync on every insert, update and delete, and it takes storage. On a write-heavy table that overhead adds up quickly. You index for the queries you actually run and drop indexes that are never used.', pl: 'Każdy indeks spowalnia zapis i zajmuje miejsce.' },
      { q: 'You have an index on (country, order_date). Does it help a query filtering only on order_date?', a: 'Much less. A multicolumn B-tree is most efficient with conditions on the leading columns. Without a condition on country the engine cannot narrow the scan the same way, so I would expect a much larger index scan or a table scan, depending on the planner.', pl: 'Indeks wielokolumnowy działa najlepiej dla kolumn wiodących.' },
      { q: 'How would you speed up point lookups on a large Snowflake table?', a: 'First check pruning in the Query Profile. If lookups are on one main column, a clustering key on it can help. For selective lookups on other columns I would evaluate the search optimization service, weighing its storage and maintenance cost. For truly operational access, a hybrid table.', pl: 'Pruning, klucz klastrowania, search optimization, a dla obciążeń operacyjnych tabela hybrydowa.' },
      { q: 'Is a clustering key the same as an index?', a: 'No. An index is a separate structure that points to individual rows. A clustering key changes how rows are grouped into micro-partitions, so that min and max ranges become narrow and pruning can skip more. It locates partitions, not rows.', pl: 'Indeks wskazuje wiersze, klastrowanie porządkuje dane, żeby pomijać partycje.' }
    ],
    mistakes: [
      '„Snowflake ma indeksy jak każda baza" albo „Snowflake nie ma żadnych indeksów". Tabele standardowe nie mają tworzonych przez użytkownika indeksów B-tree, tabele hybrydowe mają indeksy, a search optimization service jest osobnym mechanizmem.',
      'Teza, że indeks zawsze przyspiesza. Przy małej selektywności planer i tak wybierze skan, a każdy indeks spowalnia zapis.',
      'Mylenie klucza klastrowania z indeksem.'
    ]
  },
  {
    id: 'arch-partition-pruning',
    topicId: 'architecture.partition-pruning',
    area: 'architecture',
    priority: 'P0',
    title: 'Partycjonowanie, klastrowanie, partition pruning',
    question: {
      pl: 'Co to jest partition pruning i czym różni się partycjonowanie od klastrowania?',
      en: 'What is partition pruning, and how do partitioning and clustering differ?'
    },
    answer: {
      pl: 'Partycjonowanie dzieli tabelę na części według kolumny, zwykle daty, dzięki czemu zapytanie z filtrem po tej kolumnie może pominąć całe części bez ich czytania. To pomijanie nazywa się partition pruning. W PostgreSQL albo w data lake z katalogami partycje deklaruje się samemu. Snowflake robi to automatycznie: dane trafiają do mikropartycji po 50 do 500 megabajtów przed kompresją i dla każdej zapisuje minimum i maksimum każdej kolumny. Pruning działa wtedy, gdy te zakresy są wąskie i mało się pokrywają, a to zależy od uporządkowania danych. Tym właśnie jest klastrowanie: trzymaniem wierszy o podobnych wartościach razem. Klucz klastrowania utrzymuje ten porządek w bardzo dużych tabelach i kosztuje kredyty. Sprawdzam to w Query Profile, porównując partitions scanned z partitions total.',
      en: 'Partitioning splits a table into parts by a column, usually a date, so a query with a filter on that column can skip whole parts without reading them. That skipping is partition pruning. In PostgreSQL or a directory-based data lake you declare partitions yourself. Snowflake does it automatically: data lands in micro-partitions of 50 to 500 megabytes before compression, and for each one it stores the minimum and maximum of every column. Pruning works when those ranges are narrow and overlap little, which depends on how the data is ordered. That is what clustering is: keeping rows with similar values together. A clustering key maintains that order on very large tables, and it costs credits. I check it in the Query Profile by comparing partitions scanned with partitions total.'
    },
    senior: {
      pl: 'Klucz klastrowania dobieram pod najczęstsze filtry i joiny, zwykle najwyżej trzy lub cztery kolumny, od najniższej kardynalności do najwyższej. Jedna tabela ma jeden porządek fizyczny, więc klastrowanie po dacie nie pomoże filtrowi po kliencie. Zanim je włączę, mierzę na reprezentatywnych zapytaniach, czy zysk z pruningu pokrywa koszt utrzymania.',
      en: 'I pick a clustering key for the most common filters and joins, usually three or four columns at most, ordered from lowest to highest cardinality. A table has one physical order, so clustering by date does not help a filter on customer. Before enabling it I measure on representative queries whether the pruning gain covers the maintenance cost.'
    },
    explain: [
      'Tabela ma pięć lat zamówień, a raport dotyczy marca 2025. Najtańsze dane to te, których silnik w ogóle nie przeczyta. Żeby coś pominąć, silnik musi wiedzieć z góry, że w danym kawałku na pewno nie ma marca.',
      'Klasyczne partycjonowanie daje tę wiedzę przez definicję: wiersze z marca trafiają do partycji marcowej, więc reszta jest poza zakresem. Granice są rozłączne i ustala je projektant.',
      'Snowflake nie każe deklarować partycji. Dzieli tabelę na mikropartycje w kolejności ładowania i zapisuje dla każdej zakres wartości każdej kolumny. Filtr <code>order_date</code> w marcu pomija mikropartycje, których zakres dat nie obejmuje marca. Jeśli dane były ładowane chronologicznie, zakresy są wąskie i pominięta zostaje większość. Jeśli daty są wymieszane, prawie każda mikropartycja obejmuje cały rok i nie da się pominąć niczego.',
      'Stąd <b>klastrowanie</b>: fizyczne uporządkowanie wierszy tak, żeby zakresy były wąskie. Dokumentacja Snowflake zaleca klucze klastrowania głównie dla tabel liczonych w terabajtach, bo utrzymanie porządku zużywa kredyty. Zastrzeżenie z dokumentacji: Snowflake nie pomija mikropartycji na podstawie warunku z podzapytaniem.'
    ],
    keywords: ['partition pruning', 'micro-partitions', 'min/max', 'clustering key', 'automatic clustering', 'partitions scanned', 'Query Profile'],
    followUps: [
      { q: 'How do you know whether pruning is working in Snowflake?', a: 'In the Query Profile, the table scan shows partitions scanned and partitions total. Pruning is efficient when scanned is a small fraction of total. If they are nearly equal with a selective filter, the data is not ordered for that filter.', pl: 'Partitions scanned ma być małym ułamkiem partitions total.' },
      { q: 'When would you not add a clustering key?', a: 'On small or medium tables, on tables whose natural load order already matches the filters, and on tables that change so often that reclustering would cost more than the queries save. Snowflake recommends it mainly for multi-terabyte tables.', pl: 'Małe tabele, dobry naturalny porządek, częste zmiany.' },
      { q: 'What goes wrong with too many partitions in a traditional system?', a: 'Planning gets slower and memory use grows, and in a data lake you end up with many small files. You partition by a column with moderate cardinality that appears in most filters, typically a date, not by a high-cardinality identifier.', pl: 'Wolniejsze planowanie i małe pliki; partycjonuj po kolumnie z filtrów o umiarkowanej kardynalności.' },
      { q: 'How do you set clustering from dbt?', a: 'With the cluster_by config on a table or incremental model in dbt-snowflake, which adds the clustering key to the target table. I would still verify the effect in the Query Profile rather than assume it.', pl: 'Konfiguracja cluster_by, a efekt sprawdzam w Query Profile.' }
    ],
    mistakes: [
      'Utożsamianie mikropartycji Snowflake z partycjami deklarowanymi przez użytkownika. Mikropartycje powstają automatycznie, a ich zakresy mogą się pokrywać.',
      '„Klucz klastrowania zawsze przyspiesza". Pomaga filtrom po kolumnach klucza, kosztuje kredyty i nie jest zalecany dla małych tabel.',
      'Ocena pruningu bez danych z Query Profile.'
    ]
  },
  {
    id: 'arch-query-optimization',
    topicId: 'architecture.query-optimization',
    area: 'architecture',
    priority: 'P0',
    title: 'Plan wykonania i optymalizacja zapytania',
    question: {
      pl: 'Zapytanie działa wolno. Jak do tego podchodzisz i jak czytasz plan wykonania?',
      en: 'A query is slow. How do you approach it, and how do you read the execution plan?'
    },
    answer: {
      pl: 'Zaczynam od planu, a nie od zgadywania. W Snowflake jest to Query Profile: szukam najdroższego operatora, a potem kilku znanych wzorców. Pierwszy to pruning: partitions scanned bliskie partitions total oznacza, że filtr nie eliminuje danych, często przez słabe uporządkowanie tabeli względem tego filtra. Drugi to eksplodujący join, w którym wynik ma dużo więcej wierszy niż wejścia, zwykle przez nieunikalny klucz. Trzeci to spilling na dysk lokalny albo zdalny, czyli operacja nie mieści się w pamięci. Potem usuwam przyczynę: filtruję wcześniej, wybieram mniej kolumn, poprawiam ziarno joina albo agreguję wcześniej. Dopiero potem rozważam większy warehouse. W bazie wierszowej czytałbym EXPLAIN ANALYZE tak samo i porównywał szacowaną liczbę wierszy z rzeczywistą.',
      en: 'I start from the plan, not from guesses. In Snowflake that is the Query Profile: I look for the most expensive operator and then for a few known patterns. The first is pruning: partitions scanned close to partitions total means the filter is not eliminating data, often because the table is poorly ordered for that filter. The second is an exploding join, where the output has far more rows than the inputs, usually because of a non-unique key. The third is spilling to local or remote storage, meaning the operation does not fit in memory. Then I remove the cause: filter earlier, select fewer columns, fix the join grain or aggregate earlier. Only then do I consider a larger warehouse. In a row store I would read EXPLAIN ANALYZE the same way and compare estimated with actual row counts.'
    },
    senior: {
      pl: 'Większy warehouse leczy objaw: pomaga przy spillingu, ale nie naprawi braku pruningu ani joina mnożącego wiersze. Najpierw ustalam, czy problemem jest ilość czytanych danych, ilość przetwarzanych wierszy, czy kolejka. Kolejkowanie to problem współbieżności, nie zapytania.',
      en: 'A larger warehouse treats the symptom: it helps with spilling, but it will not fix missing pruning or a join that multiplies rows. I first establish whether the problem is the amount of data read, the number of rows processed, or queueing. Queueing is a concurrency problem, not a query problem.'
    },
    explain: [
      'SQL mówi, <b>co</b> chcesz dostać, a nie <b>jak</b> to policzyć. O sposobie decyduje optymalizator: wybiera kolejność joinów, sposób dostępu do tabel i algorytmy. Wynik tej decyzji to <b>plan wykonania</b>, czyli drzewo operatorów, przez które płyną wiersze od tabel do wyniku.',
      'W PostgreSQL <code>EXPLAIN</code> pokazuje plan z szacunkami: koszt i liczbę wierszy dla każdego operatora. <code>EXPLAIN ANALYZE</code> dodatkowo wykonuje zapytanie i podaje liczby rzeczywiste. Dokumentacja radzi patrzeć przede wszystkim na to, czy szacunki są bliskie rzeczywistości, bo błędny szacunek prowadzi do złego wyboru planu.',
      'W Snowflake <code>EXPLAIN</code> zwraca plan logiczny bez wykonania zapytania, razem z liczbą partycji przypisanych do skanu. Query Profile pokazuje plan po wykonaniu: czas każdego operatora, liczby wierszy między operatorami, partycje przeczytane i wszystkie, bajty zrzucone na dysk.',
      'Dokumentacja Query Profile nazywa typowe problemy: eksplodujące joiny, <code>UNION</code> bez <code>ALL</code> (niepotrzebne usuwanie duplikatów), zapytania niemieszczące się w pamięci i nieskuteczny pruning. To gotowa lista kontrolna do powiedzenia na rozmowie.'
    ],
    keywords: ['execution plan', 'EXPLAIN', 'Query Profile', 'pruning', 'exploding join', 'spilling', 'estimated vs actual rows'],
    followUps: [
      { q: 'What is an exploding join and how do you find it?', a: 'A join that returns many more rows than it receives, because the join key is not unique on either side or a condition is missing. In the profile the row count jumps after the join. I check the grain of both inputs and the uniqueness of the key.', pl: 'Liczba wierszy skacze po joinie; sprawdzam ziarno i unikalność klucza.' },
      { q: 'When does a bigger warehouse actually help?', a: 'When the query is limited by memory or parallelism: spilling to disk, or large scans and joins that can be spread over more nodes. It does not help when the work itself is unnecessary, like scanning partitions a better filter would skip.', pl: 'Przy spillingu i pracy dającej się zrównoleglić, nie przy zbędnej pracy.' },
      { q: 'What is the difference between EXPLAIN and the Query Profile in Snowflake?', a: 'EXPLAIN compiles the statement and returns the logical plan without running it, so it needs no running warehouse. The Query Profile shows what actually happened during execution, with timings, row counts and spilling per operator.', pl: 'EXPLAIN to plan bez wykonania, Query Profile to faktyczne wykonanie.' },
      { q: 'Why can UNION be slower than UNION ALL?', a: 'UNION removes duplicates, which adds an extra deduplication step over the combined result. If the inputs cannot overlap, or duplicates are acceptable, UNION ALL just concatenates and avoids that work.', pl: 'UNION dodatkowo usuwa duplikaty.' }
    ],
    mistakes: [
      'Zaczynanie od „zwiększę warehouse" albo „dodam indeks" bez spojrzenia na plan.',
      'Mylenie planu szacowanego z rzeczywistym wykonaniem.',
      'Optymalizowanie operatora, który zajmuje ułamek czasu, zamiast najdroższego.'
    ]
  },
  {
    id: 'arch-acid-isolation',
    topicId: 'architecture.acid-isolation',
    area: 'architecture',
    priority: 'P1',
    title: 'ACID i poziomy izolacji',
    question: {
      pl: 'Co oznacza ACID i czym są poziomy izolacji transakcji?',
      en: 'What does ACID mean, and what are transaction isolation levels?'
    },
    answer: {
      pl: 'ACID opisuje gwarancje transakcji. Atomowość: wszystkie jej instrukcje wchodzą w życie albo żadna. Spójność: transakcja przeprowadza bazę z jednego poprawnego stanu w drugi, z zachowaniem ograniczeń. Izolacja: równoległe transakcje nie widzą swojej niedokończonej pracy. Trwałość: zatwierdzona zmiana przetrwa awarię. Izolacja jako jedyna ma poziomy, bo pełna izolacja ogranicza współbieżność. Standard SQL definiuje read uncommitted, read committed, repeatable read i serializable, a każdy kolejny wyklucza więcej anomalii: brudne odczyty, odczyty niepowtarzalne i fantomy. Read committed jest domyślny w PostgreSQL i jest jedynym poziomem, który Snowflake obsługuje dla tabel: każda instrukcja widzi dane zatwierdzone przed jej rozpoczęciem, więc dwie instrukcje w jednej transakcji mogą zobaczyć różne dane. Jeśli potrzebuję spójnego obrazu, projektuję to świadomie.',
      en: 'ACID describes what a transaction guarantees. Atomicity: all of its statements take effect or none do. Consistency: it moves the database from one valid state to another, respecting constraints. Isolation: concurrent transactions do not see each other’s unfinished work. Durability: a committed change survives a crash. Isolation is the one that has levels, because full isolation limits concurrency. The SQL standard defines read uncommitted, read committed, repeatable read and serializable, each ruling out more anomalies: dirty reads, non-repeatable reads and phantoms. Read committed is the default in PostgreSQL and the only level Snowflake supports for tables: each statement sees data committed before it started, so two statements in one transaction can see different data. If I need a consistent view, I design for it explicitly.'
    },
    senior: {
      pl: 'Wyższe poziomy mają cenę: przy repeatable read i serializable w PostgreSQL aplikacja musi być gotowa ponowić transakcję po błędzie serializacji. W potokach danych izolację zwykle osiągam inaczej: buduję tabelę obok i podmieniam ją atomowo albo robię jeden MERGE, zamiast wielu instrukcji zależnych od siebie.',
      en: 'Higher levels have a price: under repeatable read and serializable in PostgreSQL the application must be ready to retry a transaction after a serialization failure. In data pipelines I usually get isolation another way: build the table on the side and swap it atomically, or do a single MERGE instead of several interdependent statements.'
    },
    explain: [
      'Przelew 100 zł to dwa <code>UPDATE</code>: odejmij z konta A, dodaj do konta B. Jeśli system padnie między nimi, pieniądze znikają. <b>Transakcja</b> spina oba kroki w jedną operację typu wszystko albo nic. To atomowość.',
      'Teraz drugi użytkownik liczy w tym samym czasie sumę sald. Jeśli zobaczy stan po pierwszym <code>UPDATE</code>, a przed drugim, dostanie sumę o 100 zł za małą. Izolacja decyduje, co wolno mu zobaczyć.',
      'Trzy klasyczne anomalie. <b>Dirty read</b>: widzisz zmianę, której druga transakcja jeszcze nie zatwierdziła i może wycofać. <b>Non-repeatable read</b>: czytasz ten sam wiersz dwa razy w jednej transakcji i dostajesz dwie różne wartości, bo ktoś w międzyczasie zatwierdził zmianę. <b>Phantom read</b>: powtarzasz to samo zapytanie z warunkiem i dostajesz inny zestaw wierszy, bo ktoś wstawił nowy.',
      'Bazy takie jak PostgreSQL realizują izolację przez wersjonowanie wierszy (MVCC): każda instrukcja czyta migawkę danych, więc odczyt nie blokuje zapisu, a zapis nie blokuje odczytu. Na poziomie read committed migawka jest brana na początku każdej instrukcji, stąd możliwe odczyty niepowtarzalne.'
    ],
    keywords: ['atomicity', 'consistency', 'isolation', 'durability', 'read committed', 'dirty read', 'phantom read', 'MVCC'],
    followUps: [
      { q: 'What is the difference between a non-repeatable read and a phantom read?', a: 'A non-repeatable read is about an existing row: you read it twice and its value has changed. A phantom is about the set of rows: you rerun the same filtered query and new rows appear, or some disappear, because of another committed transaction.', pl: 'Pierwsza dotyczy wartości wiersza, druga zestawu wierszy.' },
      { q: 'What does read committed mean for a multi-statement dbt or ELT job in Snowflake?', a: 'Each statement sees the data committed before that statement started. Two statements reading the same source can see different states if the source is loaded in between. If that matters, I read the source once into a staging table or use a single statement.', pl: 'Każda instrukcja ma własny obraz danych; czytaj źródło raz.' },
      { q: 'What is MVCC?', a: 'Multiversion concurrency control. The database keeps several versions of a row, and each query reads a consistent snapshot. Readers do not block writers and writers do not block readers, at the cost of storing and cleaning up old versions.', pl: 'Wersje wierszy i migawki zamiast blokowania odczytów.' },
      { q: 'Does ACID consistency mean the data is correct?', a: 'No. It means the transaction respects the rules declared in the database, like constraints. If a rule is not declared or not enforced, as with keys on Snowflake standard tables, the database will not protect it for you.', pl: 'Tylko zgodność z regułami, które baza zna i wymusza.' }
    ],
    mistakes: [
      'Mylenie spójności z ACID ze spójnością w sensie „dane są poprawne biznesowo".',
      'Twierdzenie, że każda baza domyślnie jest serializable. Domyślny poziom PostgreSQL to read committed.',
      'Założenie, że kilka instrukcji w jednej transakcji Snowflake widzi ten sam obraz danych.'
    ]
  },
  {
    id: 'arch-warehouse-lake-lakehouse',
    topicId: 'architecture.warehouse-lake-lakehouse',
    area: 'architecture',
    priority: 'P0',
    title: 'Data Warehouse vs Data Lake vs Lakehouse',
    question: {
      pl: 'Porównaj data warehouse, data lake i lakehouse.',
      en: 'Compare a data warehouse, a data lake and a lakehouse.'
    },
    answer: {
      pl: 'Hurtownia danych przechowuje ustrukturyzowane, zamodelowane dane w zarządzanym silniku: schemat przy zapisie, SQL, mocny governance i szybkie BI. Data lake to tani object storage z plikami w dowolnym formacie, także surowymi i częściowo ustrukturyzowanymi. Jest elastyczny i dobry dla data science, ale sam z siebie nie ma transakcji i łatwo zamienia się w bagno danych. Lakehouse nakłada na pliki w lake\'u format tabel, taki jak Delta Lake albo Iceberg, który dodaje log transakcyjny, pilnowanie schematu i statystyki. Dostajesz tabele jak w hurtowni na otwartym storage\'u, który może czytać kilka silników. Granice się zacierają: Snowflake obsługuje tabele Iceberg, a Databricks ma SQL warehouses. Dlatego wybieram według obciążenia, umiejętności zespołu, governance i wagi otwartych formatów, a nie według etykiety.',
      en: 'A data warehouse stores structured, modelled data in a managed engine: schema on write, SQL, strong governance and fast BI. A data lake is cheap object storage holding files in any format, including raw and semi-structured data. It is flexible and good for data science, but on its own it has no transactions and easily turns into a data swamp. A lakehouse puts a table format such as Delta Lake or Iceberg on top of the files in the lake, adding a transaction log, schema enforcement and statistics. You get warehouse-style tables on open storage that several engines can read. The lines are blurring: Snowflake supports Iceberg tables, and Databricks has SQL warehouses. So I choose by workload, team skills, governance and how much open formats matter, not by the label.'
    },
    senior: {
      pl: 'Otwarty format nie znosi kosztów: ktoś musi pilnować kompakcji plików, retencji i katalogu, w którym tabele są zarejestrowane. W hurtowni zarządzanej robi to platforma. Pytam więc, kto w zespole będzie to utrzymywał i czy faktycznie drugi silnik będzie czytał te same tabele.',
      en: 'An open format does not remove cost: someone has to look after file compaction, retention and the catalog where tables are registered. In a managed warehouse the platform does that. So I ask who on the team will maintain it and whether a second engine will really read the same tables.'
    },
    explain: [
      'Hurtownia powstała dla raportów: dane są czyszczone i modelowane przed udostępnieniem, a silnik pilnuje schematu i transakcji. Ograniczenie: dane muszą pasować do tabel, a format przechowywania należy do dostawcy.',
      'Data lake powstał, gdy pojawiły się dane, których nie opłacało się od razu modelować: logi, JSON-y, obrazy. Zapisujesz pliki tanio i decydujesz o schemacie przy odczycie. Ograniczenie: katalog plików nie ma transakcji, więc czytelnik może zobaczyć zapis w połowie, a bez opisu i właściciela dane stają się bezużyteczne.',
      'Lakehouse łączy oba światy przez <b>format tabel</b>. Pliki danych to nadal np. <term id="parquet">Parquet</term> w object storage, ale obok leży log, który mówi, które pliki tworzą aktualną wersję tabeli. Stąd transakcje ACID, pilnowanie schematu i możliwość czytania tych samych tabel przez różne silniki. Dokumentacja Databricks definiuje lakehouse jako system łączący zalety data lake i hurtowni.',
      'W praktyce wiele firm ma oba: surowe dane w lake\'u, a modele dla BI w hurtowni. Snowflake może czytać i zapisywać tabele Iceberg, ze storage\'em zarządzanym przez Snowflake albo przez klienta, więc pytanie „hurtownia czy lakehouse" coraz częściej dotyczy tego, gdzie leżą pliki i kto zarządza katalogiem.'
    ],
    keywords: ['data warehouse', 'data lake', 'lakehouse', 'schema on write', 'schema on read', 'Delta Lake', 'Iceberg', 'open table format'],
    followUps: [
      { q: 'What does a table format like Delta or Iceberg add to Parquet files?', a: 'A transaction log or metadata layer that says which files make up the current table version. That gives atomic commits, schema enforcement and evolution, time travel and file-level statistics. Parquet alone is just a file format.', pl: 'Log i metadane: transakcje, schemat, wersje, statystyki.' },
      { q: 'What is schema on read versus schema on write?', a: 'Schema on write validates structure when data is loaded, so bad data is rejected early. Schema on read stores data as it arrives and applies structure when you query it, which is flexible but moves errors to query time.', pl: 'Kontrola struktury przy zapisie albo dopiero przy odczycie.' },
      { q: 'When would you still pick a plain warehouse?', a: 'When the data is mostly structured, the consumers are BI and SQL users, and the team wants the platform to handle storage, optimization and governance. It is the simplest thing that works for that workload.', pl: 'Dane ustrukturyzowane, BI i SQL, mały zespół.' },
      { q: 'Is Snowflake a data warehouse or a lakehouse?', a: 'It started as a cloud data warehouse with its own storage format. Today it also handles semi-structured data and Iceberg tables in open Parquet files, so it can play the lakehouse role. I would describe what it does for the workload rather than argue about the label.', pl: 'Hurtownia, która obsługuje też otwarte tabele Iceberg.' }
    ],
    mistakes: [
      'Opisanie lakehouse jako „data lake z SQL-em". Sednem jest format tabel z logiem transakcyjnym.',
      'Twierdzenie, że data lake jest „po prostu tańszą hurtownią". Bez formatu tabel nie daje transakcji ani pilnowania schematu.',
      'Traktowanie trzech pojęć jak wykluczających się produktów zamiast wzorców, które często współistnieją.'
    ]
  },
  {
    id: 'arch-etl-elt',
    topicId: 'architecture.etl-elt',
    area: 'architecture',
    priority: 'P0',
    title: 'ETL vs ELT',
    question: {
      pl: 'Czym różni się ETL od ELT i dlaczego ELT stało się standardem w chmurze?',
      en: 'What is the difference between ETL and ELT, and why did ELT become the default in the cloud?'
    },
    answer: {
      pl: 'Oba podejścia przenoszą dane ze źródeł do systemu analitycznego; różnią się miejscem transformacji. W ETL dane są przekształcane w osobnym silniku przed załadowaniem, więc do hurtowni trafia tylko oczyszczony wynik. Miało to sens, gdy moc hurtowni była ograniczona, i nadal się przydaje, gdy dane trzeba zamaskować, zanim gdziekolwiek trafią. W ELT najpierw ładujesz surowe dane, a potem przekształcasz je w systemie docelowym jego własną mocą obliczeniową. Chmurowe hurtownie to umożliwiły, bo storage jest tani, a compute skaluje się na żądanie. Zyskujesz surowe dane dostępne do ponownego przetworzenia oraz transformacje w SQL pod kontrolą wersji. Tym zajmuje się dbt: jest literą T w ELT. Ceną jest koszt hurtowni i konieczność zarządzania surowymi danymi, które leżą na platformie.',
      en: 'Both move data from sources into an analytical store; the difference is where the transformation runs. In ETL the data is transformed in a separate engine before loading, so only the cleaned result reaches the warehouse. That made sense when warehouse compute was limited, and it is still useful when data must be masked before it lands anywhere. In ELT you load the raw data first and then transform it inside the target system with its own compute. Cloud warehouses made that practical because storage is cheap and compute scales on demand. You get raw data that stays available for reprocessing, and transformations written in SQL under version control. That is what dbt does: it is the T in ELT. The price is warehouse cost and the need to govern raw data that now lives in the platform.'
    },
    senior: {
      pl: 'W praktyce to rzadko czysty wybór. Lekkie przekształcenia przed załadowaniem, takie jak maskowanie danych osobowych albo ujednolicenie formatu, często zostają, a logika biznesowa idzie do warstw w hurtowni. Ważniejsze od skrótu jest to, czy potok jest idempotentny i czy da się go odtworzyć z surowych danych.',
      en: 'In practice it is rarely a pure choice. Light transformations before loading, such as masking personal data or normalizing formats, often stay, while business logic goes into layers inside the warehouse. More important than the acronym is whether the pipeline is idempotent and can be replayed from raw data.'
    },
    explain: [
      'Dane sprzedażowe leżą w bazie aplikacji, a raport ma powstać w hurtowni. Po drodze trzeba je wyciągnąć (Extract), przekształcić (Transform) i załadować (Load). Pytanie brzmi: w jakiej kolejności i na czyich maszynach.',
      '<b>ETL</b>: osobne narzędzie pobiera dane, przekształca je na własnym serwerze i ładuje gotowy wynik. Hurtownia dostaje czyste tabele, ale surowych danych w niej nie ma. Gdy reguła biznesowa się zmieni, trzeba wrócić do źródła, o ile źródło jeszcze te dane trzyma.',
      '<b>ELT</b>: najpierw kopiujesz dane do hurtowni w postaci zbliżonej do źródła, potem przekształcasz je zapytaniami SQL w samej hurtowni. Dokumentacja Microsoft ujmuje to krótko: ELT różni się od ETL wyłącznie miejscem transformacji i działa dobrze tylko wtedy, gdy system docelowy ma dość mocy.',
      'dbt nie wyciąga ani nie ładuje danych. Kompiluje modele do SQL i uruchamia je w hurtowni, czyli realizuje krok T. Stąd warstwy: surowe źródła, staging, modele pośrednie, marty.'
    ],
    keywords: ['ETL', 'ELT', 'dbt', 'raw layer', 'reprocessing', 'transformacja w hurtowni', 'idempotencja'],
    followUps: [
      { q: 'When would you still choose ETL?', a: 'When data must be transformed before it is allowed to land, for example masking or dropping personal data for compliance, when the target has little compute, or when the transformation needs something SQL cannot do well.', pl: 'Zgodność z przepisami, słaby system docelowy, logika poza SQL.' },
      { q: 'Where does dbt fit?', a: 'In the transform step. It does not extract or load. It compiles models to SQL, runs them in the warehouse in dependency order, and adds tests, documentation and version control around them.', pl: 'Tylko krok T: SQL w hurtowni, testy i wersjonowanie.' },
      { q: 'What are the risks of ELT?', a: 'Cost and governance. Every transformation uses warehouse compute, so inefficient models show up on the bill. And raw data, including sensitive fields, now sits in the platform, so access control and retention have to cover the raw layer too.', pl: 'Koszt compute i dane wrażliwe w warstwie surowej.' },
      { q: 'How do you keep an ELT pipeline rerunnable?', a: 'Keep the raw layer immutable or append-only, make each model deterministic from its inputs, and make incremental loads idempotent, for example with a MERGE on a key. Then a rerun gives the same result instead of duplicates.', pl: 'Niezmienna warstwa surowa i idempotentne ładowanie przyrostowe.' }
    ],
    mistakes: [
      'Sprowadzenie różnicy do kolejności liter, bez powiedzenia, gdzie działa transformacja i czyja to moc obliczeniowa.',
      'Twierdzenie, że dbt jest narzędziem ETL albo że ładuje dane.',
      '„ETL jest przestarzałe". Transformacja przed załadowaniem nadal ma zastosowania, np. maskowanie danych.'
    ]
  },
  {
    id: 'arch-storage-compute',
    topicId: 'architecture.storage-compute',
    area: 'architecture',
    priority: 'P1',
    title: 'Separacja storage i compute',
    question: {
      pl: 'Co oznacza separacja storage i compute i dlaczego ma znaczenie?',
      en: 'What does separation of storage and compute mean, and why does it matter?'
    },
    answer: {
      pl: 'W tradycyjnej bazie albo hurtowni MPP na własnych serwerach każdy węzeł ma swoje dyski i procesory, więc żeby dodać miejsce, dokładasz też moc obliczeniową, a klaster działa cały czas. Separacja oznacza, że dane leżą we wspólnym object storage, a compute to niezależne klastry, które je czytają. W Snowflake są to virtual warehouses. Skutki są praktyczne. Mogę zwiększyć compute na czas ciężkiego ładowania i zawiesić go, gdy nic się nie dzieje, a za storage płacę osobno. Mogę odizolować obciążenia: ładowanie, dbt i BI dostają własne warehouse\'y i nie konkurują o zasoby, choć czytają te same dane. Ceną jest odległość compute od danych, którą łagodzi cache, oraz rachunek wymagający pilnowania, bo uruchomienie kolejnego compute jest bardzo łatwe.',
      en: 'In a traditional database or an on-premises MPP warehouse, each node owns its disks and its CPUs, so to add storage you also add compute, and the cluster runs all the time. Separation means the data sits in shared object storage and compute is a set of independent clusters that read it. In Snowflake those are virtual warehouses. The consequences are practical. I can scale compute up for a heavy load and suspend it when nothing is running, and I pay for storage separately. I can isolate workloads: loading, dbt and BI each get their own warehouse and do not compete for resources, although they read the same data. The price is the distance between compute and data, which caching mitigates, and a bill that needs watching, because starting more compute is very easy.'
    },
    senior: {
      pl: 'Snowflake opisuje swoją architekturę jako hybrydę shared-disk i shared-nothing: jedno wspólne repozytorium danych i niezależne klastry obliczeniowe. Trzecia warstwa, cloud services, obsługuje metadane, optymalizację i bezpieczeństwo. Skalowanie w górę przyspiesza pojedyncze ciężkie zapytanie, a skalowanie wszerz obsługuje więcej zapytań naraz. To dwie różne dźwignie.',
      en: 'Snowflake describes its architecture as a hybrid of shared-disk and shared-nothing: one central data repository and independent compute clusters. A third layer, cloud services, handles metadata, optimization and security. Scaling up speeds up a single heavy query, scaling out serves more queries at once. Those are two different levers.'
    },
    explain: [
      'Wyobraź sobie hurtownię na dziesięciu serwerach, z których każdy ma dyski i procesory. Danych przybywa, więc dokupujesz serwery, choć mocy obliczeniowej wcale nie brakowało. W nocy nikt nie pyta, a klaster i tak pracuje. Raport zarządu konkuruje o te same procesory z nocnym ładowaniem.',
      'Wszystkie trzy problemy mają jedną przyczynę: storage i compute są sklejone w jednym węźle. Rozwiązaniem jest ich rozdzielenie. Dane leżą w jednym miejscu, a silniki obliczeniowe są osobnymi klastrami, które można uruchamiać, zatrzymywać i skalować niezależnie.',
      'Snowflake ma trzy warstwy: database storage, compute i cloud services. Dokumentacja mówi, że każdy virtual warehouse jest niezależnym klastrem, który nie dzieli zasobów obliczeniowych z innymi. Dlatego ciężki model dbt na jednym warehouse nie spowalnia dashboardów działających na drugim.',
      'To samo rozdzielenie jest podstawą lakehouse: pliki w object storage, a nad nimi dowolny silnik. Różnica polega na tym, kto zarządza formatem i katalogiem.'
    ],
    keywords: ['storage', 'compute', 'virtual warehouse', 'object storage', 'workload isolation', 'auto-suspend', 'shared-disk', 'shared-nothing'],
    followUps: [
      { q: 'What is the difference between scaling up and scaling out?', a: 'Scaling up means a larger warehouse, more resources for each query, which helps heavy, complex queries. Scaling out means more clusters of the same size, which helps concurrency when many queries queue. They solve different problems.', pl: 'W górę: cięższe zapytania. Wszerz: więcej zapytań naraz.' },
      { q: 'How would you organize warehouses for loading, dbt and BI?', a: 'Separate warehouses per workload, each sized for its own pattern and with auto-suspend, so a heavy transformation cannot starve dashboards and each workload’s cost is visible on its own.', pl: 'Osobny warehouse na obciążenie, z własnym rozmiarem i auto-suspend.' },
      { q: 'What is the downside of separating storage and compute?', a: 'Data is no longer local to the CPU, so the engine depends on network reads and caching, and a suspended warehouse starts with a cold cache. And because compute is elastic, cost control becomes an engineering task.', pl: 'Dane dalej od procesora, zimny cache i koszt do pilnowania.' }
    ],
    mistakes: [
      'Ograniczenie odpowiedzi do „to jest tańsze". Sednem jest niezależne skalowanie i izolacja obciążeń.',
      'Mylenie skalowania w górę (rozmiar warehouse) ze skalowaniem wszerz (liczba klastrów).',
      'Pominięcie kosztów: zimny cache po wznowieniu i łatwość generowania wydatków.'
    ]
  },
  {
    id: 'arch-choose-architecture',
    topicId: 'architecture.choosing-architecture',
    area: 'architecture',
    priority: 'P0',
    title: 'Dobór architektury do wymagań',
    question: {
      pl: 'Jak dobrałbyś architekturę danych do nowego projektu?',
      en: 'How would you choose a data architecture for a new project?'
    },
    answer: {
      pl: 'Zaczynam od wymagań, a nie od narzędzi. Kto korzysta z danych i w jaki sposób: dashboardy, zapytania ad hoc, uczenie maszynowe, czy aplikacja, która potrzebuje odpowiedzi w milisekundach? Jak świeże muszą być dane: raz dziennie, co godzinę, w sekundach? Jak wyglądają dane: ustrukturyzowane tabele, czy także JSON, pliki i obrazy? Do tego wolumen, współbieżność, governance i zgodność z przepisami, umiejętności zespołu oraz budżet. Głównie ustrukturyzowane dane dla BI i zespół SQL wskazują na chmurową hurtownię z ELT i dbt. Duże wolumeny danych surowych albo nieustrukturyzowanych, uczenie maszynowe albo potrzeba otwartych formatów dla kilku silników wskazują na lakehouse. Odczyty operacyjne należą do bazy OLTP, a nie do hurtowni. Wybieram najprostszy projekt, który spełnia wymagania, i mówię wprost o kompromisach oraz o tym, co skłoniłoby mnie do zmiany.',
      en: 'I start from requirements, not from tools. Who consumes the data and how: dashboards, ad hoc SQL, machine learning, or an application that needs answers in milliseconds? How fresh must the data be: daily, hourly, within seconds? What does the data look like: structured tables, or also JSON, files and images? Then volume, concurrency, governance and compliance, team skills and budget. Mostly structured data for BI with a SQL team points to a cloud warehouse with ELT and dbt. Large volumes of raw or unstructured data, machine learning, or a need for open formats across engines points to a lakehouse. Operational lookups belong in an OLTP store, not in the warehouse. I pick the simplest design that meets the requirements, and I state the trade-offs and what would make me revisit it.'
    },
    senior: {
      pl: 'Wymaganie „real-time" zawsze doprecyzowuję: kto i jaką decyzję podejmie szybciej dzięki danym sprzed minuty zamiast sprzed godziny. Świeżość jest najdroższym wymaganiem, bo zmienia cały potok. Często wystarcza ładowanie co kilkanaście minut, a prawdziwy streaming dotyczy jednego przypadku użycia, a nie całej platformy.',
      en: 'I always pin down a “real-time” requirement: who makes which decision faster with data that is a minute old instead of an hour old. Freshness is the most expensive requirement, because it changes the whole pipeline. Loading every few minutes is often enough, and true streaming applies to one use case, not to the whole platform.'
    },
    explain: [
      'Na pytanie o architekturę nie ma jednej dobrej odpowiedzi, więc rekruter ocenia tok rozumowania. Najprostszy sposób, żeby go pokazać: najpierw pytania o wymagania, potem wybór, na końcu kompromisy.',
      'Pięć pytań porządkuje większość decyzji. <b>Odbiorca</b>: człowiek z dashboardem, analityk z SQL-em, model, aplikacja. <b>Świeżość</b>: dzień, godzina, sekundy. <b>Kształt danych</b>: tabele czy także pliki i dane częściowo ustrukturyzowane. <b>Skala</b>: wolumen i liczba równoczesnych użytkowników. <b>Ograniczenia</b>: przepisy, budżet, umiejętności zespołu.',
      'Odpowiedzi wskazują wzorzec. Aplikacja z odczytem po kluczu to OLTP. Raporty i SQL na danych ustrukturyzowanych to hurtownia. Dane surowe, uczenie maszynowe i kilka silników to lakehouse. Sekundowa świeżość to strumień zdarzeń przed hurtownią.',
      'Mocna odpowiedź kończy się kompromisem i warunkiem zmiany, np.: „zaczynam od hurtowni, bo zespół zna SQL i dbt; jeśli pojawi się potrzeba czytania tych samych danych przez drugi silnik, przechodzę na tabele w otwartym formacie".'
    ],
    keywords: ['wymagania', 'świeżość danych', 'współbieżność', 'governance', 'trade-offs', 'warehouse', 'lakehouse', 'OLTP'],
    followUps: [
      { q: 'The business asks for real-time dashboards. What do you ask first?', a: 'What decision depends on it and how fresh the data really needs to be. Seconds, minutes and an hour lead to very different designs and costs. Often near-real-time micro-batches meet the need at a fraction of the complexity.', pl: 'Jaka decyzja od tego zależy i jaka świeżość naprawdę wystarczy.' },
      { q: 'An application needs to look up a customer profile in a few milliseconds. Do you serve it from the warehouse?', a: 'Not from standard analytical tables, which are built for scans, not for many concurrent single-row lookups. I would serve it from an operational store, or evaluate Snowflake hybrid tables, and keep the warehouse for analytics.', pl: 'Nie z tabel analitycznych; baza operacyjna albo tabele hybrydowe.' },
      { q: 'What would make you move from a warehouse to a lakehouse?', a: 'A real need the warehouse does not meet: large unstructured or raw datasets, machine learning workloads that want direct file access, or several engines that must share the same tables in an open format. Not the trend by itself.', pl: 'Konkretna potrzeba: dane surowe, ML albo wiele silników.' },
      { q: 'How do you account for cost in the design?', a: 'By separating workloads so each one’s compute is visible, choosing incremental processing over full rebuilds where data volumes justify it, and setting freshness no higher than the business needs, because freshness drives compute.', pl: 'Izolacja obciążeń, przetwarzanie przyrostowe i rozsądna świeżość.' }
    ],
    mistakes: [
      'Zaczynanie od nazwy narzędzia zamiast od pytań o wymagania.',
      'Przyjęcie „real-time" bez doprecyzowania, czyli projektowanie najdroższego wariantu na zapas.',
      'Brak kompromisów w odpowiedzi. Architektura bez wad brzmi jak brak doświadczenia.'
    ]
  }
];

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
      pl: 'OLTP i OLAP to dwa rodzaje pracy bazy. OLTP to praca aplikacji: bardzo dużo małych operacji, które czytają albo zmieniają kilka wierszy, na przykład złożenie zamówienia. Liczy się szybki dostęp po kluczu i bezpieczny zapis, gdy wielu użytkowników działa naraz. OLAP to analityka: zapytań jest mniej, ale każde czyta miliony wierszy i sumuje kilka kolumn. Stąd różnica w zapisie. Baza wierszowa trzyma razem cały wiersz, więc jedno zamówienie to jeden odczyt. Baza kolumnowa trzyma razem wartości jednej kolumny, więc suma czyta tylko potrzebne kolumny, a dane dobrze się kompresują. PostgreSQL zapisuje wierszami, a tabele standardowe Snowflake kolumnami.',
      en: 'OLTP and OLAP are two kinds of work. OLTP is what an application does: lots of small operations that read or change a few rows, like placing an order. It needs fast lookups by key and safe writes when many users work at once. OLAP is analytics: fewer queries, but each one reads millions of rows and sums up a few columns. That explains the storage. A row store keeps a whole row together, so reading one order is one read. A column store keeps each column together, so a sum reads only the columns it needs, and the data compresses well. PostgreSQL stores rows. Snowflake standard tables store columns.'
    },
    senior: {
      pl: 'Granica się zaciera. Snowflake ma tabele hybrydowe z zapisem wierszowym i indeksami do pracy operacyjnej, a niektóre bazy wierszowe mają indeksy kolumnowe. Dlatego opisuję rodzaj pracy, a nie produkt: jak wyglądają zapytania, ile działa ich naraz i jak świeże muszą być dane.',
      en: 'The line is blurring. Snowflake has hybrid tables with row storage and indexes for operational work, and some row stores offer columnstore indexes. So I describe the workload, not the product: what the queries look like, how many run at once, and how fresh the data must be.'
    },
    explain: [
      'Weź tabelę zamówień i dwa pytania. Aplikacja pyta: pokaż zamówienie 48213. Analityk pyta: jaki był przychód na kraj w 2025 roku. Pierwsze pytanie dotyczy jednego wiersza i wszystkich jego kolumn. Drugie dotyczy wszystkich wierszy i dwóch kolumn.',
      'Dysk podaje dane całymi porcjami, czyli blokami. Jeśli w bloku leżą całe wiersze, jedno zamówienie to jeden blok, ale suma kolumny <code>amount</code> wymaga przeczytania wszystkich bloków razem z kolumnami, których zapytanie nie potrzebuje. Jeśli w bloku leżą wartości jednej kolumny, suma czyta tylko bloki <code>amount</code>, za to złożenie jednego wiersza wymaga sięgnięcia do każdej kolumny osobno.',
      'Wartości jednej kolumny są do siebie podobne (ten sam typ, często powtarzające się wartości), więc kompresują się lepiej niż wiersze o mieszanych typach. To druga przyczyna, dla której hurtownie analityczne są kolumnowe.',
      'W Snowflake dane tabeli standardowej leżą w mikropartycjach, a wewnątrz każdej z nich kolumny są zapisane i skompresowane osobno. <b>OLTP</b> to skrót od Online Transaction Processing, <b>OLAP</b> od Online Analytical Processing.'
    ],
    keywords: ['OLTP', 'OLAP', 'row store', 'column store', 'kompresja', 'point lookup', 'agregacja'],
    followUps: [
      { q: 'Why not run analytics directly on the OLTP database?', a: 'A heavy report reads the whole table and takes CPU and disk away from the transactions. And a normalized row store is built for writing single rows, not for sums over millions of rows. So you copy the data to a system built for analytics, and reports stop competing with the application.', pl: 'Ciężkie skany zabierają zasoby transakcjom, a model i zapis są pod inne pytania.' },
      { q: 'Why is columnar storage slow for single-row writes?', a: 'A row has to be split across every column, and columnar files are usually immutable and compressed, so changing one row can mean rewriting a whole block or file. Columnar engines prefer batch loads.', pl: 'Jeden wiersz dotyka wszystkich kolumn, a pliki kolumnowe są niezmienne.' },
      { q: 'What does SELECT * cost in a columnar warehouse?', a: 'You lose the main advantage. A column store is fast because it reads only the columns the query needs. SELECT * forces it to read all of them. In a row store the difference is small. In a column store it can be most of the scan.', pl: 'Tracisz pomijanie kolumn, czyli główną zaletę zapisu kolumnowego.' },
      { q: 'Where would you use a Snowflake hybrid table?', a: 'For operational access inside Snowflake: low-latency lookups and single-row updates by key. Hybrid tables use row-oriented storage with indexes and enforce primary, unique and foreign keys. For large analytical scans I would keep standard tables.', pl: 'Do szybkiego dostępu po kluczu; do analityki zostają tabele standardowe.' }
    ],
    mistakes: [
      'Definiowanie OLTP i OLAP przez produkty („OLTP to Postgres") zamiast przez rodzaj pracy bazy.',
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
      pl: 'Normalizacja oznacza, że każda informacja jest zapisana raz. Wyjaśnię to na tabeli pozycji zamówienia. Pierwsza postać normalna: jedna wartość w komórce, czyli żadnej listy produktów w jednej kolumnie. Druga: kluczem jest ID zamówienia i ID produktu. Liczba sztuk zależy od obu, ale nazwa produktu tylko od produktu, więc trafia do tabeli produktów. Trzecia: miasto klienta opisuje klienta, a nie zamówienie, więc trafia do tabeli klientów. Dzięki temu zmianę robię w jednym miejscu, a tego potrzebuje baza aplikacji. W analityce denormalizuję celowo: schemat gwiazdy albo szeroka tabela powtarzają dane, żeby uniknąć joinów. Zostawiam znormalizowane źródło i buduję z niego te modele od nowa, na przykład w dbt.',
      en: 'Normalization means each piece of information is stored once. Let me explain it with an order lines table. First normal form: one value per cell, so no list of products in one column. Second: the key is order ID plus product ID. Quantity depends on both, but the product name depends only on the product, so it moves to a products table. Third: the customer’s city describes the customer, not the order, so it moves to a customers table. Now a change happens in one place, which is what an application database needs. In analytics I denormalize on purpose: a star schema or a wide table repeats data to avoid joins. I keep the normalized source and rebuild those models from it, for example in dbt.'
    },
    senior: {
      pl: 'Formalnie druga postać usuwa zależności częściowe, czyli kolumny zależne od części klucza złożonego. Trzecia usuwa przechodnie, czyli kolumny zależne od innej kolumny, która nie jest kluczem. Denormalizacja w hurtowni jest dość bezpieczna, bo model jest pochodną: nikt nie poprawia w nim wierszy ręcznie, tylko buduje go od nowa. Ryzyko przenosi się na ziarno tabeli i historię zmian, dlatego każdy model ma nazwane ziarno i test unikalności klucza.',
      en: 'Formally, second normal form removes partial dependencies, where a column depends on part of a composite key. Third removes transitive ones, where a column depends on another non-key column. Denormalizing in a warehouse is fairly safe because the model is derived: nobody patches rows by hand, you rebuild it. The risk moves to the grain of the table and to attribute history, so each model has a named grain and a uniqueness test on its key.'
    },
    explain: [
      'Zacznij od jednej szerokiej tabeli zamówień, w której nazwa i miasto klienta są wpisane w każdym wierszu. Klient się przeprowadza i trzeba poprawić wiele wierszy. Jeśli poprawisz część, baza zawiera dwie wersje prawdy. To <b>anomalia aktualizacji</b>. Podobnie: nie zapiszesz klienta, dopóki nie ma zamówienia, a usuwając ostatnie zamówienie, tracisz dane klienta.',
      'Postacie normalne to kolejne kroki usuwania takich powtórzeń. <b>1NF</b>: jedna wartość w komórce, bez list typu „kabel, mysz". <b>2NF</b>: jeśli klucz jest złożony, np. (<code>order_id</code>, <code>product_id</code>), to nazwa produktu zależy tylko od <code>product_id</code>, więc przenosisz ją do tabeli produktów. <b>3NF</b>: miasto klienta zależy od klienta, a dopiero przez niego od zamówienia, więc trafia do tabeli klientów.',
      'Wynik to wiele wąskich tabel połączonych kluczami. Zmiana jest tania i bezpieczna, ale żeby coś odczytać, trzeba joinów. Denormalizacja odwraca ten kompromis: mniej joinów i prostszy SQL za cenę powtórzonych danych. Przy szerokiej tabeli pilnuj <b>ziarna</b>, czyli tego, co oznacza jeden wiersz.',
      'Projekt logiczny mówi, co zapisujemy: jakie rzeczy (encje), jakie informacje o nich (atrybuty) i jak się łączą. Projekt fizyczny mówi, jak to zapisać w konkretnej bazie: typy, indeksy, partycjonowanie, klastrowanie. Normalizacja to decyzja logiczna. Denormalizacja jest zwykle decyzją fizyczną, podejmowaną po to, żeby szybciej czytać.'
    ],
    keywords: ['1NF', '2NF', '3NF', 'anomalie', 'zależność częściowa', 'zależność przechodnia', 'schemat gwiazdy', 'ziarno'],
    followUps: [
      { q: 'What is the difference between a logical and a physical data model?', a: 'The logical model describes entities, attributes, keys and relationships independently of any engine. The physical model is how you implement it on a specific platform: data types, indexes or clustering, partitioning, materialization. One logical model can have several physical designs.', pl: 'Logiczny: co i jak się łączy. Fizyczny: jak to zapisać w konkretnym silniku.' },
      { q: 'What is a transitive dependency?', a: 'A column that depends on the key only through another column. The order tells you the customer, and the customer tells you the city. So city on the order row is a transitive dependency. Third normal form removes it by moving city to the customers table.', pl: 'Kolumna zależy od klucza przez inną kolumnę niekluczową.' },
      { q: 'Is a star schema normalized?', a: 'The fact table is fairly normalized: keys and measures. The dimensions are deliberately denormalized, flattening hierarchies into one table. A snowflake schema normalizes the dimensions again, at the cost of more joins.', pl: 'Fakty raczej tak, wymiary celowo nie.' },
      { q: 'What can go wrong with one big table?', a: 'Two things: repeated data and grain. Grain is what one row means. If I join an order total onto order lines, a SUM counts it once per line, and nobody gets an error. Also, one changed attribute means rewriting many rows, and every consumer depends on the same very wide table.', pl: 'Powtórzenia, koszt przebudowy i zdublowane miary przy złym ziarnie.' }
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
      pl: 'Klucz główny identyfikuje wiersz: jest unikalny i nigdy pusty. Klucz obcy łączy wiersz z inną tabelą, na przykład zamówienie z klientem. Zasada, że ten klient musi istnieć, to integralność referencyjna. W PostgreSQL baza pilnuje tych reguł: duplikat klucza albo zamówienie bez klienta jest odrzucane przy zapisie. Tabele standardowe Snowflake działają inaczej. Klucz główny, unikalny i obcy są tam tylko metadanymi. Snowflake sprawdza natomiast NOT NULL i CHECK. O unikalność i powiązania dbam więc w potoku. Deduplikuję po kluczu i dodaję testy dbt: unique, not_null i relationships. Ale test wykrywa problem po zbudowaniu modelu. Nie blokuje błędnego zapisu.',
      en: 'A primary key identifies a row: it is unique and never null. A foreign key links a row to another table, for example an order to its customer. The rule that this customer must exist is called referential integrity. In PostgreSQL these rules are enforced: a duplicate key or an order without a customer is rejected on write. Snowflake standard tables are different. Primary, unique and foreign keys are only metadata there. Snowflake does enforce NOT NULL and CHECK. So I handle uniqueness and relationships in the pipeline. I deduplicate on the key and add dbt tests like unique, not_null and relationships. But a test detects the problem after the model is built. It doesn’t block a bad write.'
    },
    senior: {
      pl: 'Dwa szczegóły. Nawet tam, gdzie klucze są sprawdzane, są wyjątki: w PostgreSQL pusta wartość klucza obcego nie jest sprawdzana, a kontrolę kluczy można odroczyć do końca transakcji. W Snowflake RELY mówi optymalizatorowi, że może zaufać regule, na przykład żeby usunąć zbędny join. Snowflake nadal jej nie weryfikuje, więc jeśli dane ją łamią, wynik może być błędny. Ustawiam RELY tylko tam, gdzie test dbt pilnuje klucza przy każdym uruchomieniu. Tabele hybrydowe sprawdzają klucze, ale to inny typ tabeli do innej pracy.',
      en: 'Two details. Even where keys are enforced there are exceptions: in PostgreSQL a null foreign key value is not checked, and key checks can be deferred to the end of the transaction. In Snowflake, RELY tells the optimizer it may trust a constraint, for example to remove an unnecessary join. Snowflake still doesn’t validate it, so if the data breaks the rule, results can be wrong. I set RELY only where a dbt test guards the key on every run. Hybrid tables do enforce keys, but that’s a different table type for a different workload.'
    },
    explain: [
      'Tabela zamówień ma kolumnę <code>customer_id</code>. Co się stanie, jeśli ktoś wstawi zamówienie dla klienta 999, którego nie ma w tabeli klientów? Taki wiersz to <b>sierota</b>: join z klientami go zgubi albo zwróci puste kolumny. Klucz obcy jest regułą, która tego zabrania.',
      'W klasycznej bazie relacyjnej silnik sprawdza regułę przy zapisie. Żeby sprawdzać unikalność szybko, PostgreSQL sam tworzy dla klucza głównego unikalny indeks. Ta kontrola kosztuje przy każdym wstawieniu. Przy pojedynczych wierszach to drobiazg, przy ładowaniu milionów już nie.',
      'Hurtownie ładują dane dużymi paczkami, często równolegle i nie zawsze w kolejności „najpierw klienci, potem zamówienia". Snowflake w tabelach standardowych nie sprawdza <code>PRIMARY KEY</code>, <code>UNIQUE</code> ani <code>FOREIGN KEY</code> (mówi się: nie są wymuszane). Deklaracja zostaje w metadanych. Dwa wiersze z tym samym „kluczem głównym" wstawią się bez błędu.',
      'Dlatego kontrolę przenosi się do potoku. Test dbt to zapytanie, które po zbudowaniu modelu szuka wierszy łamiących regułę. Różnica wobec ograniczenia w bazie: test wykrywa problem po fakcie, a nie blokuje zapisu.'
    ],
    keywords: ['primary key', 'foreign key', 'referential integrity', 'NOT ENFORCED', 'RELY', 'dbt tests', 'hybrid tables'],
    followUps: [
      { q: 'If constraints are not enforced, why declare them in Snowflake?', a: 'Three reasons. They document the model. BI and modelling tools read them to find keys and relationships. And with RELY the optimizer can use them, for example to remove a join. They just don’t protect the data.', pl: 'Dokumentacja, narzędzia BI i optymalizator (RELY), ale nie ochrona danych.' },
      { q: 'How do dbt tests differ from database constraints?', a: 'A constraint that the database enforces rejects bad data on write. A dbt test is a query that runs after the model is built and returns rows that break the rule. So constraints prevent, tests detect. If I need to stop bad data from reaching users, I have to add that step myself, for example by failing the run before publishing.', pl: 'Ograniczenie blokuje zapis, test wykrywa po zbudowaniu modelu.' },
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
      pl: 'Pomyśl o skorowidzu na końcu książki. Indeks B-tree to posortowane drzewo wartości, które wskazują wiersze. Bez niego baza czyta całą tabelę. Z nim schodzi od korzenia do liścia w kilku odczytach stron. Ceną jest miejsce i dodatkowa praca przy zapisie. Indeks nie pomaga, gdy filtr pasuje do dużej części tabeli. Nie pomoże też, gdy filtruję po funkcji na kolumnie, a nie ma indeksu na tym wyrażeniu. W tabelach standardowych Snowflake nie tworzę indeksów B-tree. Snowflake pomija całe mikropartycje na podstawie wartości min i max, a klastrowanie sprawia, że działa to lepiej. Do wyszukiwania pojedynczych wartości jest search optimization service. Prawdziwe indeksy mają tabele hybrydowe.',
      en: 'Think of the index at the back of a book. A B-tree index is a sorted tree of values that point to rows. Without it, the database reads the whole table. With it, it goes from the root to a leaf in a few page reads. The cost is storage and extra work on writes. An index doesn’t help when the filter matches a large part of the table. It also doesn’t help when I filter on a function of the column and there is no index on that expression. In Snowflake standard tables I don’t create B-tree indexes. Snowflake skips whole micro-partitions using min and max values, and clustering makes that work better. For point lookups there is the search optimization service. Hybrid tables have real indexes.'
    },
    senior: {
      pl: 'Kilka szczegółów. Posortowany indeks obsługuje też zakresy, sortowanie i wyszukiwanie po początku wartości. W indeksie wielokolumnowym liczy się kolejność: działa najlepiej przy filtrach po kolumnach z lewej strony. O użyciu indeksu decyduje planer na podstawie statystyk, więc nieaktualne statystyki mogą dać skan mimo dobrego indeksu. I nie każdy update rusza każdy indeks: w PostgreSQL zmiana, która nie dotyka zaindeksowanej kolumny, może ominąć aktualizację indeksów. Mimo to nieużywane indeksy usuwam.',
      en: 'A few details. A sorted index also serves ranges, ordering and prefix searches. In a multicolumn index the order matters: it works best with filters on the leading columns. The planner decides based on statistics, so stale statistics can give you a scan despite a good index. And not every update touches every index: in PostgreSQL an update that changes no indexed column can skip index maintenance. I still drop indexes nobody uses.'
    },
    explain: [
      'Baza czyta dane z dysku całymi porcjami, czyli <b>stronami</b>. Bez indeksu, szukając zamówienia 48213, musi przeczytać każdą stronę tabeli i sprawdzić każdy wiersz. To <b>full table scan</b>. Przy milionie wierszy to tysiące stron dla jednego wyniku.',
      'Indeks działa jak skorowidz na końcu książki. Wartości klucza są posortowane i ułożone w drzewo: korzeń mówi, w której gałęzi leży szukany zakres, gałąź wskazuje liść, a liść zawiera adres wiersza w tabeli. Drzewo jest zrównoważone, więc do każdego liścia jest tyle samo kroków, a wysokość rośnie bardzo wolno razem z liczbą wierszy.',
      'Kiedy indeks nie pomaga. Jeśli filtr pasuje do większości wierszy, skakanie po tabeli wiersz po wierszu jest droższe niż przeczytanie jej po kolei, więc planer wybiera skan. Wzorzec <code>LIKE \'%ski\'</code> nie ma początku, po którym dałoby się zejść w posortowanym drzewie. Dla warunku <code>lower(email) = ...</code> potrzebny jest indeks zbudowany na wyrażeniu <code>lower(email)</code>.',
      'Snowflake rozwiązuje ten sam problem inaczej, bo jego typowe zapytanie czyta miliony wierszy, a nie jeden. Dla każdej mikropartycji przechowuje zakres wartości każdej kolumny i pomija te, które na pewno nie zawierają szukanych wartości. To pomijanie dużych kawałków, a nie adresowanie pojedynczych wierszy.'
    ],
    keywords: ['B-tree', 'full table scan', 'selektywność', 'indeks wielokolumnowy', 'koszt zapisu', 'pruning', 'search optimization service', 'hybrid tables'],
    followUps: [
      { q: 'Why not index every column?', a: 'Every index takes storage and adds work on writes. Each insert, and each update that changes an indexed column, has to maintain it. On a table with a lot of writes that adds up quickly. So you index for the queries you really run, and drop indexes nobody uses.', pl: 'Każdy indeks spowalnia zapis i zajmuje miejsce.' },
      { q: 'You have an index on (country, order_date). Does it help a query filtering only on order_date?', a: 'Much less. A multicolumn B-tree is most efficient with conditions on the leading columns. Without a condition on country the engine cannot narrow the scan the same way, so I would expect a much larger index scan or a table scan, depending on the planner.', pl: 'Indeks wielokolumnowy działa najlepiej dla kolumn wiodących.' },
      { q: 'How would you speed up point lookups on a large Snowflake table?', a: 'First check pruning in the Query Profile. If lookups are on one main column, a clustering key on it can help. For selective lookups on other columns I would evaluate the search optimization service, weighing its storage and maintenance cost. For truly operational access, a hybrid table.', pl: 'Pruning, klucz klastrowania, search optimization, a dla obciążeń operacyjnych tabela hybrydowa.' },
      { q: 'Is a clustering key the same as an index?', a: 'No. An index is a separate structure that points to single rows. A clustering key changes how rows are grouped into micro-partitions. Similar values end up together, so a filter can skip more micro-partitions. It helps find partitions, not rows.', pl: 'Indeks wskazuje wiersze, klastrowanie porządkuje dane, żeby pomijać partycje.' }
    ],
    mistakes: [
      '„Snowflake ma indeksy jak każda baza" albo „Snowflake nie ma żadnych indeksów". Tabele standardowe nie mają tworzonych przez użytkownika indeksów B-tree, tabele hybrydowe mają indeksy, a search optimization service jest osobnym mechanizmem.',
      'Teza, że indeks zawsze przyspiesza. Gdy filtr pasuje do dużej części tabeli, planer i tak wybierze skan, a indeks dokłada pracy przy zapisie.',
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
      pl: 'Partition pruning to pomijanie części tabeli bez ich czytania. Powiedzmy, że tabela jest podzielona na miesiące, a ja pytam o marzec. Silnik może zignorować pozostałe miesiące. W PostgreSQL albo w data lake takie partycje definiuje się samemu. Snowflake robi to automatycznie. Dzieli tabelę na mikropartycje i dla każdej zapisuje minimum i maksimum każdej kolumny. Jeśli w mikropartycji są tylko zamówienia ze stycznia, a filtruję po marcu, Snowflake ją pomija. To działa tylko wtedy, gdy zakresy wykluczają mój filtr, a to zależy od ułożenia wierszy. To ułożenie nazywa się klastrowaniem. Klucz klastrowania utrzymuje je w bardzo dużych tabelach i kosztuje kredyty. Efekt sprawdzam w Query Profile: partitions scanned kontra partitions total.',
      en: 'Partition pruning means skipping parts of a table without reading them. Say the table is split by month and I ask for March. The engine can ignore every other month. In PostgreSQL or a data lake you define those partitions yourself. Snowflake does it automatically. It splits the table into micro-partitions and stores the minimum and maximum of every column for each one. If a micro-partition holds only January orders and I filter on March, Snowflake skips it. That only works when the ranges rule out my filter, and that depends on how the rows are ordered. That ordering is called clustering. A clustering key maintains it on very large tables, and it costs credits. I check the result in the Query Profile: partitions scanned versus partitions total.'
    },
    senior: {
      pl: 'Klucz klastrowania dobieram pod najczęstsze filtry i joiny. Zwykle to najwyżej trzy lub cztery kolumny, od tej z najmniejszą liczbą różnych wartości do tej z największą, czyli od niskiej do wysokiej kardynalności. Zakresy nie muszą być wąskie w ogóle. Mają wykluczać konkretny filtr. Dlatego klastrowanie po dacie zwykle nie pomaga filtrowi po kliencie. Zanim je włączę, sprawdzam na reprezentatywnych zapytaniach, czy zysk z pruningu pokrywa koszt utrzymania.',
      en: 'I pick a clustering key for the most common filters and joins. Usually three or four columns at most, ordered from the column with the fewest distinct values to the one with the most, so from low to high cardinality. The ranges don’t have to be narrow in general. They have to rule out a specific filter. That’s why clustering by date usually doesn’t help a filter on customer. Before I enable it, I check on representative queries whether the pruning gain covers the maintenance cost.'
    },
    explain: [
      'Tabela ma pięć lat zamówień, a raport dotyczy marca 2025. Najtańsze dane to te, których silnik w ogóle nie przeczyta. Żeby coś pominąć, silnik musi wiedzieć z góry, że w danym kawałku na pewno nie ma marca.',
      'Klasyczne partycjonowanie daje tę wiedzę przez definicję: wiersze z marca trafiają do partycji marcowej, więc reszta jest poza zakresem. Granice są rozłączne i ustala je projektant.',
      'Snowflake nie każe deklarować partycji. Dzieli tabelę na mikropartycje w kolejności ładowania i zapisuje dla każdej zakres wartości każdej kolumny. Filtr <code>order_date</code> w marcu pomija mikropartycje, których zakres dat nie obejmuje marca. Jeśli dane były ładowane chronologicznie, każda mikropartycja ma mało dat i większość da się pominąć. Jeśli daty są wymieszane, prawie każda mikropartycja obejmuje cały rok i nie da się pominąć niczego.',
      'Stąd <b>klastrowanie</b>: fizyczne ułożenie wierszy tak, żeby zakresy mikropartycji wykluczały typowe filtry. Dokumentacja Snowflake zaleca klucze klastrowania głównie dla tabel liczonych w terabajtach, bo utrzymywanie porządku zużywa kredyty. Zastrzeżenie z dokumentacji: Snowflake nie pomija mikropartycji, gdy wartość do filtra pochodzi z podzapytania.'
    ],
    keywords: ['partition pruning', 'micro-partitions', 'min/max', 'clustering key', 'automatic clustering', 'partitions scanned', 'Query Profile'],
    followUps: [
      { q: 'How do you know whether pruning is working in Snowflake?', a: 'In the Query Profile, the table scan shows partitions scanned and partitions total. Pruning works well when scanned is a small fraction of total. If the two numbers are close, even though my filter matches only a small part of the table, the data isn’t ordered for that filter.', pl: 'Partitions scanned ma być małym ułamkiem partitions total.' },
      { q: 'When would you not add a clustering key?', a: 'On small or medium tables, on tables whose natural load order already matches the filters, and on tables that change so often that reclustering would cost more than the queries save. Snowflake recommends it mainly for multi-terabyte tables.', pl: 'Małe tabele, dobry naturalny porządek, częste zmiany.' },
      { q: 'What goes wrong with too many partitions in a traditional system?', a: 'Planning gets slower and memory use grows. In a data lake you also end up with many small files. So you partition by a column that appears in most filters and has a moderate number of distinct values, typically a date. Not by an ID with millions of values.', pl: 'Wolniejsze planowanie i małe pliki. Partycjonuj po kolumnie z filtrów, która ma umiarkowaną liczbę różnych wartości.' },
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
      pl: 'Zaczynam od planu, a nie od zgadywania. W Snowflake to Query Profile. Najpierw szukam najdroższego kroku. Potem trzech typowych problemów. Pierwszy: partitions scanned jest bliskie partitions total, czyli filtr nie pomija danych. Drugi: join zwraca dużo więcej wierszy, niż dostał, zwykle dlatego, że klucz nie jest unikalny. Trzeci: spilling, czyli operacja nie mieści się w pamięci i zapisuje dane na dysk. Potem usuwam przyczynę: filtruję wcześniej, wybieram mniej kolumn, poprawiam join albo agreguję wcześniej. Większy warehouse jest na końcu. W PostgreSQL zrobiłbym to samo z EXPLAIN ANALYZE i porównał szacowaną liczbę wierszy z rzeczywistą.',
      en: 'I start with the plan, not with guesses. In Snowflake that’s the Query Profile. First I find the most expensive step. Then I look for three common problems. One: partitions scanned is close to partitions total, so the filter isn’t skipping data. Two: a join returns far more rows than it gets, usually because the key isn’t unique. Three: spilling, which means the operation doesn’t fit in memory and writes data to disk. Then I fix the cause: filter earlier, select fewer columns, fix the join, or aggregate earlier. A bigger warehouse comes last. In PostgreSQL I’d do the same with EXPLAIN ANALYZE and compare the estimated row count with the actual one.'
    },
    senior: {
      pl: 'Większy warehouse leczy objaw. Może pomóc przy spillingu, ale nie naprawi filtra, który niczego nie pomija, ani joina, który mnoży wiersze. Najpierw ustalam, czy problemem jest ilość czytanych danych, liczba przetwarzanych wierszy, czy kolejka. Kolejka to problem zbyt wielu zapytań naraz, a nie jednego zapytania. Dwie pułapki w PostgreSQL: koszt w planie to umowne jednostki planera, a nie czas, a EXPLAIN ANALYZE naprawdę wykonuje zapytanie, także UPDATE.',
      en: 'A bigger warehouse treats the symptom. It can help with spilling, but it won’t fix a filter that skips nothing or a join that multiplies rows. I first work out whether the problem is the amount of data read, the number of rows processed, or queueing. Queueing means too many queries at once, not one bad query. Two PostgreSQL traps: cost in a plan is in planner units, not time, and EXPLAIN ANALYZE really runs the query, including an UPDATE.'
    },
    explain: [
      'W SQL piszesz, <b>co</b> chcesz dostać, a nie <b>jak</b> to policzyć. Sposób wybiera część bazy zwana optymalizatorem: ustala kolejność joinów i to, czy czytać tabelę w całości, czy przez indeks. Jego decyzję pokazuje <b>plan wykonania</b>, czyli lista kroków, przez które wiersze przechodzą od tabel do wyniku.',
      'W PostgreSQL <code>EXPLAIN</code> pokazuje plan z przewidywaniami: koszt (w umownych jednostkach, nie w czasie) i liczbę wierszy dla każdego kroku. <code>EXPLAIN ANALYZE</code> naprawdę wykonuje zapytanie i podaje liczby rzeczywiste. Dokumentacja radzi patrzeć przede wszystkim na to, czy przewidywane liczby wierszy są bliskie rzeczywistym. Gdy się rozjeżdżają, planer mógł wybrać zły sposób wykonania.',
      'W Snowflake <code>EXPLAIN</code> pokazuje plan bez wykonania zapytania, razem z liczbą partycji przypisanych do skanu. Query Profile pokazuje, co się stało po wykonaniu: czas każdego kroku, liczby wierszy między krokami, partycje przeczytane i wszystkie oraz bajty odłożone na dysk, gdy zabrakło pamięci (spilling).',
      'Dokumentacja Query Profile nazywa typowe problemy: eksplodujące joiny, <code>UNION</code> bez <code>ALL</code> (niepotrzebne usuwanie duplikatów), zapytania niemieszczące się w pamięci i nieskuteczny pruning. To gotowa lista kontrolna do powiedzenia na rozmowie.'
    ],
    keywords: ['execution plan', 'EXPLAIN', 'Query Profile', 'pruning', 'exploding join', 'spilling', 'estimated vs actual rows'],
    followUps: [
      { q: 'What is an exploding join and how do you find it?', a: 'A join that returns many more rows than it receives. It happens when the join key repeats on both sides, or a join condition is missing. In the profile the row count jumps after the join. I check what one row means on each side and whether the key is unique.', pl: 'Liczba wierszy skacze po joinie; sprawdzam ziarno i unikalność klucza.' },
      { q: 'When does a bigger warehouse actually help?', a: 'When the query really needs more memory or more machines: it spills to disk, or it has large scans and joins that can be spread over more nodes. It doesn’t help when the work itself is unnecessary, like scanning partitions that a better filter would skip.', pl: 'Przy spillingu i pracy dającej się zrównoleglić, nie przy zbędnej pracy.' },
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
      pl: 'ACID to cztery gwarancje transakcji. Weźmy przelew, czyli dwa update’y. Atomowość: wykonują się oba albo żaden. Spójność: dane nadal spełniają reguły, których pilnuje baza. Izolacja: inne transakcje nie widzą przelewu w połowie. Trwałość: po zatwierdzeniu zmiana przetrwa awarię. Izolacja ma poziomy, bo im jest ściślejsza, tym mniej transakcji może działać naraz. Standard SQL ma cztery: read uncommitted, read committed, repeatable read i serializable. Każdy kolejny wyklucza więcej anomalii, takich jak brudne odczyty, odczyty niepowtarzalne i fantomy. Read committed jest domyślny w PostgreSQL i jest jedynym poziomem, który Snowflake obsługuje dla tabel. Każda instrukcja widzi tam dane zatwierdzone przed jej startem, więc dwie instrukcje w jednej transakcji mogą zobaczyć różne dane.',
      en: 'ACID is four guarantees of a transaction. Take a bank transfer, which is two updates. Atomicity: both happen or neither does. Consistency: the data still follows the rules the database enforces. Isolation: other transactions don’t see the transfer half done. Durability: once it’s committed, it survives a crash. Isolation has levels, because the stricter it is, the fewer transactions can run at the same time. The SQL standard has four: read uncommitted, read committed, repeatable read and serializable. Each one rules out more anomalies, like dirty reads, non-repeatable reads and phantoms. Read committed is the default in PostgreSQL and the only level Snowflake supports for tables. There, each statement sees data committed before it started, so two statements in one transaction can see different data.'
    },
    senior: {
      pl: 'Dwie rzeczy na głębsze pytanie. Tabela ze standardu to nie wszystko. Repeatable read w PostgreSQL to snapshot isolation: nie dopuszcza fantomów, ale nadal dopuszcza anomalie serializacji, na przykład write skew. Wyklucza je dopiero serializable, a aplikacja musi być gotowa powtórzyć transakcję po błędzie serializacji. W potokach danych izolację zwykle osiągam inaczej: buduję tabelę obok i podmieniam ją atomowo albo robię jeden MERGE zamiast kilku zależnych od siebie instrukcji.',
      en: 'Two things for a deeper question. The standard’s table isn’t the whole story. Repeatable read in PostgreSQL is snapshot isolation: it blocks phantoms but still allows serialization anomalies, for example write skew. Only serializable rules those out, and the application must be ready to retry a transaction after a serialization failure. In data pipelines I usually get isolation another way: I build the table on the side and swap it atomically, or I use a single MERGE instead of several statements that depend on each other.'
    },
    explain: [
      'Przelew 100 zł to dwa <code>UPDATE</code>: odejmij z konta A, dodaj do konta B. Jeśli system padnie między nimi, pieniądze znikają. <b>Transakcja</b> spina oba kroki w jedną operację typu wszystko albo nic. To atomowość.',
      'Teraz drugi użytkownik liczy w tym samym czasie sumę sald. Jeśli zobaczy stan po pierwszym <code>UPDATE</code>, a przed drugim, dostanie sumę o 100 zł za małą. Izolacja to reguły, które mówią, co wolno mu zobaczyć, gdy dwie transakcje działają naraz.',
      'Trzy klasyczne anomalie. <b>Dirty read</b>: widzisz zmianę, której druga transakcja jeszcze nie zatwierdziła i może wycofać. <b>Non-repeatable read</b>: czytasz ten sam wiersz dwa razy w jednej transakcji i dostajesz dwie różne wartości, bo ktoś w międzyczasie zatwierdził zmianę. <b>Phantom read</b>: powtarzasz to samo zapytanie z warunkiem i dostajesz inny zestaw wierszy, bo ktoś wstawił nowy.',
      'Bazy takie jak PostgreSQL trzymają kilka wersji wiersza (MVCC). Każda instrukcja czyta dane w stanie z jednej chwili, jak na zdjęciu (snapshot). Dzięki temu odczyt nie blokuje zapisu, a zapis nie blokuje odczytu. Na poziomie read committed takie zdjęcie jest robione na początku każdej instrukcji. Stąd możliwe odczyty niepowtarzalne.'
    ],
    keywords: ['atomicity', 'consistency', 'isolation', 'durability', 'read committed', 'dirty read', 'phantom read', 'MVCC'],
    followUps: [
      { q: 'What is the difference between a non-repeatable read and a phantom read?', a: 'A non-repeatable read is about an existing row: you read it twice and its value has changed. A phantom is about the set of rows: you rerun the same filtered query and new rows appear, or some disappear, because of another committed transaction.', pl: 'Pierwsza dotyczy wartości wiersza, druga zestawu wierszy.' },
      { q: 'What does read committed mean for a multi-statement dbt or ELT job in Snowflake?', a: 'Each statement sees the data committed before that statement started. Two statements reading the same source can see different states if the source is loaded in between. If that matters, I read the source once into a staging table or use a single statement.', pl: 'Każda instrukcja ma własny obraz danych; czytaj źródło raz.' },
      { q: 'What is MVCC?', a: 'Multiversion concurrency control. The database keeps several versions of a row, and each query reads a snapshot: the data as it was at one moment. So readers don’t block writers and writers don’t block readers. The cost is storing old versions and cleaning them up.', pl: 'Wersje wierszy i migawki zamiast blokowania odczytów.' },
      { q: 'What is write skew?', a: 'Two transactions each read the same data, each makes a decision that is fine on its own, and together they break a rule. The classic example: two doctors are on call, both check that two are on call, and both sign off. Now nobody is on call. Snapshot isolation allows that. Serializable prevents it, usually by failing one transaction so it can be retried.', pl: 'Dwie transakcje poprawne osobno razem łamią regułę; wyklucza to serializable.' },
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
      pl: 'Pytanie brzmi: gdzie leżą dane i kto pilnuje ich struktury. Hurtownia danych to zarządzany silnik z zamodelowanymi tabelami. Schemat jest sprawdzany przy zapisie, pytasz w SQL, a BI działa szybko. Data lake to tani object storage z plikami w dowolnym formacie. Jest elastyczny, ale same pliki nie dają transakcji na poziomie tabeli, a bez właściciela lake zamienia się w bagno danych. Lakehouse dokłada do tych plików format tabel, taki jak Delta Lake albo Iceberg. To metadane, które śledzą, które pliki tworzą aktualną wersję tabeli. Dostajesz transakcje i kontrolę schematu na otwartym storage’u, a czytać może każdy silnik, który ten format obsługuje. Produkty dziś na siebie nachodzą, więc wybieram według rodzaju pracy, umiejętności zespołu i governance, a nie według etykiety.',
      en: 'The question is where the data lives and who looks after its structure. A data warehouse is a managed engine with modelled tables. The schema is checked on write, you query with SQL, and BI is fast. A data lake is cheap object storage with files in any format. It’s flexible, but plain files give you no table-level transactions, and without an owner it turns into a data swamp. A lakehouse adds a table format, like Delta Lake or Iceberg, on top of those files. That’s metadata that tracks which files make up the current version of a table. So you get transactions and schema checks on open storage, and any engine that supports the format can read it. Products overlap today, so I choose by workload, team skills and governance, not by the label.'
    },
    senior: {
      pl: 'Otwarty format nie znosi kosztów. Ktoś musi pilnować scalania małych plików, usuwania starych wersji i katalogu, w którym tabele są zarejestrowane. W zarządzanej hurtowni robi to platforma. Format nie gwarantuje też, że każdy silnik obsłuży każdą jego funkcję. Pytam więc, kto w zespole będzie to utrzymywał i czy drugi silnik naprawdę będzie czytał te same tabele.',
      en: 'An open format doesn’t remove the cost. Someone has to look after compacting small files, removing old versions and the catalog where the tables are registered. In a managed warehouse the platform does that. And a format doesn’t guarantee that every engine supports every feature of it. So I ask who on the team will maintain it, and whether a second engine will really read the same tables.'
    },
    explain: [
      'Hurtownia powstała dla raportów. Dane są czyszczone i układane w tabele, zanim ktokolwiek je zobaczy, a silnik pilnuje schematu i transakcji. Ograniczenie: dane muszą pasować do tabel, a format, w którym leżą, należy do dostawcy.',
      'Data lake powstał, gdy pojawiły się dane, których nie opłacało się od razu układać w tabele: logi, JSON-y, obrazy. Zapisujesz pliki tanio, a strukturę nadajesz im dopiero przy odczycie. Ograniczenie: same pliki nie dają transakcji, więc kto czyta w trakcie zapisu, może zobaczyć tylko część plików. A bez opisu i właściciela nikt nie wie, co tam leży.',
      'Lakehouse łączy oba światy przez <b>format tabel</b>. Pliki danych to nadal np. <term id="parquet">Parquet</term> w object storage. Obok leżą metadane (w Delta Lake log transakcyjny, w Iceberg pliki metadanych), które mówią, które pliki tworzą aktualną wersję tabeli. Stąd transakcje ACID i pilnowanie schematu. Te same tabele może czytać każdy silnik, który dany format obsługuje. Dokumentacja Databricks definiuje lakehouse jako system łączący zalety data lake i hurtowni.',
      'W praktyce wiele firm ma oba: surowe dane w lake\'u, a modele dla BI w hurtowni. Snowflake może czytać i zapisywać tabele Iceberg, ze storage\'em zarządzanym przez Snowflake albo przez klienta, więc pytanie „hurtownia czy lakehouse" coraz częściej dotyczy tego, gdzie leżą pliki i kto zarządza katalogiem.'
    ],
    keywords: ['data warehouse', 'data lake', 'lakehouse', 'schema on write', 'schema on read', 'Delta Lake', 'Iceberg', 'open table format'],
    followUps: [
      { q: 'What does a table format like Delta or Iceberg add to Parquet files?', a: 'Metadata that says which files make up the current version of the table. In Delta Lake that’s a transaction log, in Iceberg it’s metadata files. That gives you atomic commits, schema checks, older versions of the table and statistics per file. Parquet alone is just a file format.', pl: 'Log i metadane: transakcje, schemat, wersje, statystyki.' },
      { q: 'What is schema on read versus schema on write?', a: 'Schema on write checks the structure when data is loaded, so bad data is rejected early. Schema on read stores data as it arrives and applies the structure when you query it. That’s flexible, but you find the errors later, at query time.', pl: 'Kontrola struktury przy zapisie albo dopiero przy odczycie.' },
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
      pl: 'Oba podejścia przenoszą dane ze źródeł do systemu analitycznego. Różnica polega na tym, gdzie działa transformacja. W ETL przekształcasz dane w osobnym silniku przed załadowaniem, więc do hurtowni trafia oczyszczony wynik. To nadal się przydaje, gdy dane trzeba zamaskować, zanim tam trafią. W ELT najpierw ładujesz surowe dane, a potem przekształcasz je w hurtowni, jej mocą obliczeniową. Chmurowe hurtownie to umożliwiły, bo storage jest tani, a compute skaluje się na żądanie. Zysk: dopóki przechowujesz surowe dane, możesz przebudować modele po zmianie reguły, a transformacje to SQL pod kontrolą wersji. Tu pasuje dbt: jest literą T w ELT. Ceną jest koszt hurtowni i surowe dane, które wymagają kontroli dostępu.',
      en: 'Both move data from sources into an analytics system. The difference is where the transformation runs. In ETL you transform the data in a separate engine before loading, so the warehouse gets the cleaned result. That’s still useful when data must be masked before it lands. In ELT you load the raw data first and then transform it inside the warehouse, using its compute. Cloud warehouses made that practical, because storage is cheap and compute scales on demand. The benefit: as long as you keep the raw data, you can rebuild models when a rule changes, and the transformations are SQL under version control. That’s where dbt fits: it’s the T in ELT. The price is warehouse cost, and raw data that needs access control.'
    },
    senior: {
      pl: 'W praktyce to rzadko czysty wybór. Lekkie przekształcenia przed załadowaniem, takie jak maskowanie danych osobowych, często zostają, a logika biznesowa idzie do warstw w hurtowni. Skrót niczego też nie gwarantuje: potok ETL może zachować surową kopię poza hurtownią, a ELT nie obiecuje, że surowe dane będą przechowywane bez końca. Ważniejsze jest to, czy potok jest idempotentny, czyli czy ponowne uruchomienie daje ten sam wynik, i czy da się go odtworzyć z surowych danych.',
      en: 'In practice it’s rarely a pure choice. Light transformations before loading, such as masking personal data, often stay, while business logic goes into layers inside the warehouse. The acronym doesn’t guarantee anything either: an ETL pipeline can keep a raw copy outside the warehouse, and ELT doesn’t promise the raw data is kept forever. What matters more is whether the pipeline is idempotent, meaning a rerun gives the same result, and whether it can be replayed from raw data.'
    },
    explain: [
      'Dane sprzedażowe leżą w bazie aplikacji, a raport ma powstać w hurtowni. Po drodze trzeba je pobrać (Extract), przekształcić (Transform) i załadować (Load). Pytanie brzmi: w jakiej kolejności i na czyich maszynach.',
      '<b>ETL</b>: osobne narzędzie pobiera dane, przekształca je na własnym serwerze i ładuje gotowy wynik. Hurtownia dostaje czyste tabele, ale surowych danych w niej nie ma. Gdy reguła biznesowa się zmieni, trzeba wrócić do źródła, o ile jeszcze te dane trzyma, albo do surowej kopii, jeśli potok ją zachował.',
      '<b>ELT</b>: najpierw kopiujesz dane do hurtowni w postaci zbliżonej do źródła, potem przekształcasz je zapytaniami SQL w samej hurtowni. Dokumentacja Microsoft ujmuje to krótko: ELT różni się od ETL wyłącznie miejscem transformacji i działa dobrze tylko wtedy, gdy system docelowy ma dość mocy.',
      'dbt nie wyciąga ani nie ładuje danych. Kompiluje modele do SQL i uruchamia je w hurtowni, czyli realizuje krok T. Stąd warstwy: surowe źródła, staging, modele pośrednie, marty.'
    ],
    keywords: ['ETL', 'ELT', 'dbt', 'raw layer', 'reprocessing', 'transformacja w hurtowni', 'idempotencja'],
    followUps: [
      { q: 'When would you still choose ETL?', a: 'When data must be transformed before it is allowed to land, for example masking or dropping personal data for compliance, when the target has little compute, or when the transformation needs something SQL cannot do well.', pl: 'Zgodność z przepisami, słaby system docelowy, logika poza SQL.' },
      { q: 'Where does dbt fit?', a: 'In the transform step. It does not extract or load. It compiles models to SQL, runs them in the warehouse in dependency order, and adds tests, documentation and version control around them.', pl: 'Tylko krok T: SQL w hurtowni, testy i wersjonowanie.' },
      { q: 'What are the risks of ELT?', a: 'Cost and governance. Every transformation uses warehouse compute, so inefficient models show up on the bill. And raw data, including sensitive fields, now sits in the platform, so access control and retention have to cover the raw layer too.', pl: 'Koszt compute i dane wrażliwe w warstwie surowej.' },
      { q: 'How do you keep an ELT pipeline rerunnable?', a: 'Three things. Keep the raw layer append-only, so nothing in it is overwritten. Make each model depend only on its inputs. And make incremental loads idempotent, for example with a MERGE on a key. Then a rerun gives the same result instead of duplicates.', pl: 'Niezmienna warstwa surowa i idempotentne ładowanie przyrostowe.' }
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
      pl: 'Storage to miejsce, gdzie leżą dane. Compute to to, co je przelicza. W tradycyjnej hurtowni na własnych serwerach każdy węzeł ma dyski i procesory. Żeby dodać miejsce, dokładasz też moc obliczeniową, a klaster działa cały czas. Separacja oznacza, że dane leżą we wspólnym storage’u, a compute to niezależne klastry, które je czytają. W Snowflake są to virtual warehouses. Dwie praktyczne korzyści. Każdą część skaluję i opłacam osobno, a compute mogę zawiesić, gdy nic się nie dzieje. Mogę też odizolować pracę: ładowanie, dbt i BI dostają własne warehouse’y, więc nie konkurują o moc obliczeniową, choć czytają te same dane. Wady: dane są dalej od procesora, więc liczy się cache, a rachunku trzeba pilnować.',
      en: 'Storage is where the data lives. Compute is what processes it. In a traditional on-premises warehouse every node has both disks and CPUs. To add storage you also add compute, and the cluster runs all the time. Separation means the data sits in shared storage, and compute is a set of independent clusters that read it. In Snowflake those are virtual warehouses. There are two practical gains. I scale and pay for each part separately, and I can suspend compute when nothing runs. And I can isolate workloads: loading, dbt and BI each get their own warehouse, so they don’t compete for compute while reading the same data. The downsides: data is further from the CPU, so caching matters, and the bill needs watching.'
    },
    senior: {
      pl: 'Snowflake opisuje swoją architekturę jako połączenie shared-disk i shared-nothing: jedno wspólne miejsce na dane i niezależne klastry obliczeniowe. Trzecia warstwa, cloud services, obsługuje metadane, optymalizację i bezpieczeństwo. Skalowanie w górę, czyli większy warehouse, przyspiesza pojedyncze ciężkie zapytanie. Skalowanie wszerz, czyli więcej klastrów, obsługuje więcej zapytań naraz. To dwa różne narzędzia. I jeszcze jedno: izolacja dotyczy mocy obliczeniowej, więc dashboard nadal może zwolnić, gdy jego własny warehouse jest za mały.',
      en: 'Snowflake describes its architecture as a mix of shared-disk and shared-nothing: one shared place for the data and independent compute clusters. A third layer, cloud services, handles metadata, optimization and security. Scaling up, so a larger warehouse, speeds up a single heavy query. Scaling out, so more clusters, serves more queries at once. Those are two different tools. One more thing: isolation is about compute, so a dashboard can still be slow if its own warehouse is too small.'
    },
    explain: [
      'Wyobraź sobie hurtownię na dziesięciu serwerach, z których każdy ma dyski i procesory. Danych przybywa, więc dokupujesz serwery, choć mocy obliczeniowej wcale nie brakowało. W nocy nikt nie pyta, a klaster i tak pracuje. Raport zarządu konkuruje o te same procesory z nocnym ładowaniem.',
      'Wszystkie trzy problemy mają jedną przyczynę: miejsce na dane (storage) i moc obliczeniowa (compute) są sklejone w jednym serwerze. Rozwiązaniem jest ich rozdzielenie. Dane leżą w jednym miejscu, a moc obliczeniowa to osobne klastry, które można włączać, wyłączać i powiększać niezależnie.',
      'Snowflake ma trzy warstwy: database storage, compute i cloud services. Dokumentacja mówi, że każdy virtual warehouse jest niezależnym klastrem, który nie dzieli zasobów obliczeniowych z innymi. Dlatego ciężki model dbt na jednym warehouse nie zabiera mocy obliczeniowej dashboardom działającym na drugim.',
      'To samo rozdzielenie jest podstawą lakehouse: pliki w object storage, a nad nimi dowolny silnik. Różnica polega na tym, kto zarządza formatem i katalogiem.'
    ],
    keywords: ['storage', 'compute', 'virtual warehouse', 'object storage', 'workload isolation', 'auto-suspend', 'shared-disk', 'shared-nothing'],
    followUps: [
      { q: 'What is the difference between scaling up and scaling out?', a: 'Scaling up means a larger warehouse, more resources for each query, which helps heavy, complex queries. Scaling out means more clusters of the same size, which helps concurrency when many queries queue. They solve different problems.', pl: 'W górę: cięższe zapytania. Wszerz: więcej zapytań naraz.' },
      { q: 'How would you organize warehouses for loading, dbt and BI?', a: 'One warehouse per workload. Each one is sized for its own job and has auto-suspend. That way a heavy transformation can’t take compute away from dashboards, and I can see the cost of each workload on its own.', pl: 'Osobny warehouse na obciążenie, z własnym rozmiarem i auto-suspend.' },
      { q: 'What is the downside of separating storage and compute?', a: 'The data is no longer next to the CPU, so the engine reads it over the network and relies on caching. A warehouse that was suspended starts with a cold cache. And because starting compute is so easy, someone has to watch the cost.', pl: 'Dane dalej od procesora, zimny cache i koszt do pilnowania.' }
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
      pl: 'Zaczynam od wymagań, a nie od narzędzi. Kto korzysta z danych i jak: dashboardy, zapytania ad hoc, uczenie maszynowe, czy aplikacja, która potrzebuje odpowiedzi w milisekundach? Jak świeże muszą być dane: raz dziennie, co godzinę, w sekundach? Jakie to dane: same tabele, czy także JSON, pliki i obrazy? Do tego wolumen, liczba użytkowników naraz, przepisy, umiejętności zespołu i budżet. Głównie tabele dla BI i zespół SQL wskazują na chmurową hurtownię z ELT i dbt. Dużo surowych plików, uczenie maszynowe albo kilka silników na tych samych tabelach wskazują na lakehouse. Odczyty pojedynczych wierszy dla aplikacji należą do bazy OLTP. Wybieram najprostszy projekt, który spełnia wymagania, nazywam kompromisy i mówię, co skłoniłoby mnie do zmiany.',
      en: 'I start with requirements, not tools. Who uses the data and how: dashboards, ad hoc SQL, machine learning, or an application that needs an answer in milliseconds? How fresh must it be: daily, hourly, seconds? What kind of data is it: tables only, or also JSON, files and images? Then volume, concurrency, compliance, team skills and budget. Mostly structured data for BI and a SQL team point to a cloud warehouse with ELT and dbt. Lots of raw files, machine learning, or several engines sharing the same tables point to a lakehouse. Single-row lookups for an application belong in an OLTP database. I pick the simplest design that meets the requirements, name the trade-offs, and say what would make me change it.'
    },
    senior: {
      pl: 'Wymaganie „real-time” zawsze doprecyzowuję: kto i jaką decyzję podejmie szybciej dzięki danym sprzed minuty zamiast sprzed godziny. Świeżość bywa jednym z najdroższych wymagań, bo potrafi zmienić cały potok. Często wystarcza ładowanie co kilkanaście minut, a prawdziwy streaming dotyczy jednego przypadku użycia, a nie całej platformy.',
      en: 'I always pin down a “real-time” requirement: who makes which decision faster with data that is a minute old instead of an hour old. Freshness is often one of the most expensive requirements, because it can change the whole pipeline. Loading every few minutes is often enough, and true streaming usually applies to one use case, not to the whole platform.'
    },
    explain: [
      'Na pytanie o architekturę nie ma jednej dobrej odpowiedzi, więc rekruter ocenia tok rozumowania. Najprostszy sposób, żeby go pokazać: najpierw pytania o wymagania, potem wybór, na końcu kompromisy.',
      'Pięć pytań porządkuje większość decyzji. <b>Odbiorca</b>: człowiek z dashboardem, analityk z SQL-em, model, aplikacja. <b>Świeżość</b>: dzień, godzina, sekundy. <b>Rodzaj danych</b>: same tabele czy także pliki i JSON-y. <b>Skala</b>: wolumen i liczba równoczesnych użytkowników. <b>Ograniczenia</b>: przepisy, budżet, umiejętności zespołu.',
      'Odpowiedzi wskazują wzorzec. Aplikacja z odczytem po kluczu to OLTP. Raporty i SQL na danych ustrukturyzowanych to hurtownia. Dane surowe, uczenie maszynowe i kilka silników to lakehouse. Sekundowa świeżość to strumień zdarzeń przed hurtownią.',
      'Mocna odpowiedź kończy się kompromisem i warunkiem zmiany, np.: „zaczynam od hurtowni, bo zespół zna SQL i dbt; jeśli pojawi się potrzeba czytania tych samych danych przez drugi silnik, przechodzę na tabele w otwartym formacie".'
    ],
    keywords: ['wymagania', 'świeżość danych', 'współbieżność', 'governance', 'trade-offs', 'warehouse', 'lakehouse', 'OLTP'],
    followUps: [
      { q: 'The business asks for real-time dashboards. What do you ask first?', a: 'What decision depends on it, and how fresh the data really needs to be. Seconds, minutes and an hour lead to very different designs and costs. Often loading small batches every few minutes is enough, and it’s much simpler than streaming.', pl: 'Jaka decyzja od tego zależy i jaka świeżość naprawdę wystarczy.' },
      { q: 'An application needs to look up a customer profile in a few milliseconds. Do you serve it from the warehouse?', a: 'Not from standard analytical tables, which are built for scans, not for many concurrent single-row lookups. I would serve it from an operational store, or evaluate Snowflake hybrid tables, and keep the warehouse for analytics.', pl: 'Nie z tabel analitycznych; baza operacyjna albo tabele hybrydowe.' },
      { q: 'What would make you move from a warehouse to a lakehouse?', a: 'A real need the warehouse does not meet: large unstructured or raw datasets, machine learning workloads that want direct file access, or several engines that must share the same tables in an open format. Not the trend by itself.', pl: 'Konkretna potrzeba: dane surowe, ML albo wiele silników.' },
      { q: 'How do you account for cost in the design?', a: 'Three ways. I separate workloads, so I can see what each one costs. I process data incrementally instead of rebuilding everything, where the volume justifies it. And I don’t make the data fresher than the business needs, because fresher data means more compute.', pl: 'Izolacja obciążeń, przetwarzanie przyrostowe i rozsądna świeżość.' }
    ],
    mistakes: [
      'Zaczynanie od nazwy narzędzia zamiast od pytań o wymagania.',
      'Przyjęcie „real-time" bez doprecyzowania, czyli projektowanie najdroższego wariantu na zapas.',
      'Brak kompromisów w odpowiedzi. Architektura bez wad brzmi jak brak doświadczenia.'
    ]
  }
];

import type { Question } from '../types';

/**
 * Pytania: Snowflake, architektura i performance engineering.
 *
 * Źródła: oficjalna dokumentacja Snowflake (docs.snowflake.com), sprawdzona 2026-11-27 i spisana
 * w docs/verified-facts.md, sekcja „Lekcja 10". Nie ma tu pomiarów: repozytorium nie ma konta Snowflake,
 * więc żadna liczba nie jest opisana jako wynik uruchomienia. Liczby pochodzą z dokumentacji
 * (np. 50–500 MB, 24 godziny, 60 sekund) i są tak opisane.
 *
 * Odpowiedzi mówione są pisane tak, żeby dało się je powiedzieć bez zmyślania własnych projektów.
 * Tam, gdzie pasuje własne doświadczenie, uczący się dopowiada je sam.
 */
export const snowflakeQuestions: Question[] = [
  {
    id: 'snowflake-architecture-layers',
    topicId: 'snowflake.architecture',
    area: 'snowflake',
    priority: 'P0',
    title: 'Trzy warstwy Snowflake i rozdzielenie storage od compute',
    question: {
      pl: 'Opisz architekturę Snowflake. Co daje rozdzielenie storage i compute, a co kosztuje?',
      en: 'Walk me through the Snowflake architecture. What does separating storage from compute give you, and what does it cost you?'
    },
    answer: {
      pl: 'Snowflake ma trzy warstwy. Storage trzyma dane tabel w object storage chmury, przepisane na skompresowane, kolumnowe mikropartycje. Compute to virtual warehouse\'y: niezależne klastry, które wykonują zapytania i nie dzielą zasobów między sobą. Cloud services to mózg: uwierzytelnianie i kontrola dostępu, metadane, parsowanie i optymalizacja zapytań, zarządzanie infrastrukturą. Dokumentacja nazywa to hybrydą shared-disk i shared-nothing: jedna centralna kopia danych, którą czyta każdy warehouse, ale każdy warehouse liczy zapytania na własnych węzłach. W praktyce storage i compute skalują się i są rozliczane osobno. Mogę odizolować ELT od BI na osobnych warehouse\'ach nad tymi samymi danymi, wstrzymać compute bez utraty danych i zmienić rozmiar bez ich przenoszenia. Ceną jest to, że dane nie leżą przy compute, więc wydajność zależy od pruningu i cache.',
      en: "Snowflake has three layers. Storage keeps table data in cloud object storage, rewritten into compressed, columnar micro-partitions. Compute is virtual warehouses: independent clusters that run queries and don't share resources with each other. Cloud services is the brain: authentication and access control, metadata, query parsing and optimization, infrastructure management. The docs call it a hybrid of shared-disk and shared-nothing: one central copy of the data that every warehouse can read, but each warehouse processes queries on its own nodes. In practice storage and compute scale and bill separately. I can isolate ELT from BI on separate warehouses over the same data, suspend compute without losing anything, and resize without moving data. The price is that data isn't local to compute, so performance depends on pruning and caching."
    },
    senior: {
      pl: 'Dopowiedzenie: warstwa cloud services też zużywa kredyty, ale jest doliczana tylko wtedy, gdy jej dzienne zużycie przekroczy 10% dziennego zużycia warehouse\'ów. Część operacji w ogóle nie potrzebuje warehouse\'u, bo odpowiadają na nie metadane, np. usunięcie wszystkich wierszy tabeli. Obok warehouse\'ów jest compute serverless, którym Snowflake zarządza sam: Snowpipe, automatic clustering, zadania serverless. Ma osobne pozycje na rachunku i nie obejmują go resource monitory.',
      en: "Worth adding: the cloud services layer also consumes credits, but it's only charged when its daily usage exceeds 10% of that day's warehouse usage. Some operations don't need a warehouse at all because metadata answers them, for example deleting all rows from a table. And next to warehouses there's serverless compute that Snowflake manages itself: Snowpipe, automatic clustering, serverless tasks. It has its own line items on the bill and resource monitors don't cover it."
    },
    explain: [
      'W klasycznej bazie MPP typu shared-nothing każdy węzeł ma własny dysk i własny kawałek danych. Dołożenie mocy oznacza dołożenie węzłów i przeniesienie części danych, a wyłączenie klastra oznacza brak dostępu do danych. Storage i compute są jednym zasobem.',
      'Snowflake rozcina to na trzy warstwy. <b>Database storage</b>: po załadowaniu dane są przepisywane na wewnętrzny format, skompresowany i kolumnowy, i leżą w object storage. <b>Compute</b>: virtual warehouse to niezależny klaster, który według dokumentacji nie dzieli zasobów z innymi warehouse\'ami, więc jeden nie wpływa na wydajność drugiego. <b>Cloud services</b>: bezpieczeństwo i kontrola dostępu, metadane, parsowanie i optymalizacja zapytań, zarządzanie infrastrukturą.',
      'Skutek praktyczny to izolacja obciążeń: ELT, BI i data science mogą mieć osobne warehouse\'y nad tą samą kopią danych, każdy w innym rozmiarze i z innym auto-suspend. Wstrzymany warehouse nie zużywa kredytów, a dane nadal są w storage.',
      'Druga strona medalu: warehouse nie ma danych u siebie. Musi je pobrać z object storage, dlatego tak ważne jest, żeby czytał jak najmniej (pruning mikropartycji) i żeby to, co już pobrał, zostało w jego lokalnym cache.'
    ],
    keywords: ['storage', 'compute', 'cloud services', 'virtual warehouse', 'shared-disk', 'shared-nothing', 'workload isolation'],
    followUps: [
      { q: 'How is this different from a traditional shared-nothing MPP warehouse?', a: "In a classic shared-nothing system each node owns a slice of the data on its own disks, so compute and storage scale together and resizing means redistributing data. In Snowflake the data sits once in object storage, and warehouses are stateless apart from a cache. So I can add, resize or suspend compute without touching data, and several clusters can read the same tables without competing for the same nodes.", pl: 'W shared-nothing dane są przypięte do węzłów. W Snowflake leżą raz w object storage, a warehouse ma tylko cache.' },
      { q: 'And how is it different from Spark on a data lake?', a: "Both separate storage from compute, but the division of labour is different. With Spark I choose the file format, partitioning and file sizes, and I tune shuffle partitions and join strategies. In Snowflake the storage format, micro-partitioning, statistics and most of the physical plan are managed for me. I get less control and far fewer knobs: my levers are warehouse size, clustering, and how I write SQL.", pl: 'W Sparku sam decydujesz o plikach i planie. W Snowflake większość jest zarządzana, a dźwigni jest mało.' },
      { q: 'Can a query run without a warehouse?', a: "Some can. If the result of an identical query is still in the result cache and the data hasn't changed, Snowflake skips execution and returns the persisted result. And some operations are metadata-only: the docs give deleting all rows from a table as an example. Anything that has to scan and process table data needs a running warehouse.", pl: 'Tak: ponowne użycie wyniku z result cache i operacje czysto metadanowe. Skan danych wymaga warehouse\'u.' },
      { q: 'What does the cloud services layer cost?', a: "It consumes credits, but it's only charged if the daily cloud services usage exceeds 10% of the daily warehouse usage, calculated per day in UTC. Serverless compute doesn't count toward that 10% base. Where it bites is workloads with lots of tiny queries or heavy metadata operations against very little warehouse time.", pl: 'Płatna dopiero powyżej 10% dziennego zużycia warehouse\'ów. Serverless nie wchodzi do tej podstawy.' }
    ],
    mistakes: [
      'Mówienie, że warehouse „przechowuje dane". Warehouse to compute z lokalnym cache, dane tabel są w warstwie storage.',
      'Twierdzenie, że rozdzielenie storage i compute jest darmowe. Dane trzeba pobrać z object storage, więc bez pruningu i cache zapytanie czyta dużo po sieci.',
      'Pomijanie compute serverless i cloud services. Na rachunku to osobne pozycje, a resource monitor ich nie zatrzyma.'
    ]
  },
  {
    id: 'snowflake-micro-partitions-pruning',
    topicId: 'snowflake.pruning',
    area: 'snowflake',
    priority: 'P0',
    title: 'Mikropartycje i partition pruning',
    question: {
      pl: 'Czym są mikropartycje i jak działa pruning? Dlaczego to samo zapytanie raz skanuje 1% tabeli, a raz całą?',
      en: 'What are micro-partitions, and how does pruning work? Why does one query scan 1% of a table and a similar one scan all of it?'
    },
    answer: {
      pl: 'Snowflake tnie każdą tabelę automatycznie na mikropartycje: ciągłe porcje wierszy, od 50 do 500 MB danych przed kompresją, zapisane kolumnowo, każda kolumna skompresowana osobno. Dla każdej mikropartycji trzyma metadane, m.in. zakres wartości każdej kolumny i liczbę wartości unikalnych. Przy kompilacji zapytania optymalizator porównuje filtr z tymi zakresami i pomija mikropartycje, które na pewno nie zawierają pasujących wierszy. To jest pruning. Jego skuteczność zależy od tego, jak wartości kolumny z filtra są rozłożone po mikropartycjach. Dane ładowane chronologicznie są naturalnie uporządkowane po dacie, więc filtr po dniu odcina prawie wszystko. Filtr po customer_id w tej samej tabeli trafia w zakres każdej mikropartycji, więc skanuje całość. Sprawdzam to w Query Profile: partitions scanned do partitions total.',
      en: "Snowflake automatically splits every table into micro-partitions: contiguous chunks of rows holding 50 to 500 MB of uncompressed data, stored by column, with each column compressed separately. For every micro-partition it keeps metadata, including the range of values for each column and the number of distinct values. When the query compiles, the optimizer compares the filter with those ranges and skips micro-partitions that can't contain matching rows. That's pruning. How well it works depends on how the filter column's values are spread across micro-partitions. Data loaded chronologically is naturally ordered by date, so a filter on one day cuts almost everything. A filter on customer_id in the same table hits the range of every micro-partition, so it scans the lot. I check it in Query Profile: partitions scanned against partitions total."
    },
    senior: {
      pl: 'Trzy zastrzeżenia. Zakres min–max mówi tylko, że mikropartycja może zawierać pasujące wiersze, więc przeskanowane partycje nadal mogą nie zwrócić nic. Nie każdy predykat nadaje się do pruningu: dokumentacja mówi wprost, że Snowflake nie przycina po predykacie z podzapytaniem, nawet gdy podzapytanie daje stałą. I kolumnowy zapis działa niezależnie od pruningu: w przeskanowanych mikropartycjach czytane są tylko kolumny użyte w zapytaniu.',
      en: "Three qualifications. A min–max range only says a micro-partition might contain matching rows, so the scanned partitions can still return nothing. Not every predicate can prune: the docs state that Snowflake doesn't prune on a predicate with a subquery, even if the subquery returns a constant. And columnar storage works independently of pruning: within the scanned micro-partitions only the columns the query references are read."
    },
    explain: [
      'Tabela w Snowflake to zbiór plików w object storage. Żeby nie czytać wszystkich, silnik musi z góry wiedzieć, w których plikach na pewno nie ma szukanych wierszy. Do tego służą mikropartycje i ich metadane.',
      '<b>Mikropartycja</b> to porcja wierszy zapisana jako jedna całość: według dokumentacji od 50 do 500 MB danych przed kompresją. Wiersze trafiają do niej w kolejności ładowania. W środku dane leżą kolumnami, a każda kolumna jest kompresowana osobno algorytmem, który Snowflake dobiera sam.',
      'Dla każdej mikropartycji warstwa cloud services przechowuje metadane: zakres wartości każdej kolumny, liczbę wartości unikalnych i dodatkowe własności. <b>Pruning</b> to porównanie filtra z tymi zakresami. Jeśli szukasz <code>order_date = \'2026-01-14\'</code>, a mikropartycja ma daty od 1 do 3 stycznia, można ją pominąć bez otwierania.',
      'Dlatego liczy się ułożenie danych. Gdy wartości kolumny są posortowane względem kolejności ładowania, zakresy mikropartycji są wąskie i rozłączne. Gdy są rozrzucone, każda mikropartycja ma zakres od prawie najmniejszej do prawie największej wartości i filtr niczego nie wyklucza. Dokumentacja podaje ideał: filtr wybierający 10% wartości powinien skanować około 10% mikropartycji.'
    ],
    keywords: ['micro-partition', 'pruning', 'metadata', 'min/max', 'columnar', 'partitions scanned', 'Query Profile'],
    followUps: [
      { q: 'Is a micro-partition the same thing as a partition in Hive or Spark?', a: "No. A Hive-style partition is a directory I define by a column, and I'm responsible for choosing the key and avoiding too many small partitions. Micro-partitions are created automatically from the order data arrives in, they're small and uniform in size, and I never name them in a query. The closest analogy is a Parquet row group with min and max statistics, except the statistics live in a central metadata store and are used before any file is opened.", pl: 'Nie. Partycję Hive definiujesz sam po kolumnie, mikropartycje powstają automatycznie. Bliżej im do row group z min/max.' },
      { q: 'What happens to micro-partitions on UPDATE or DELETE?', a: "Snowflake doesn't edit a micro-partition in place. A change writes new micro-partitions with the new version of the affected rows, and the old ones stay around for Time Travel and then Fail-safe. That's why heavy row-level churn on a big table increases storage, and why it gradually degrades the natural ordering that pruning relied on.", pl: 'Zmiana zapisuje nowe mikropartycje, stare zostają na potrzeby Time Travel i Fail-safe. Stąd koszt storage przy dużej rotacji.' },
      { q: 'A filter on a date column still scans every partition. What would you check?', a: "First whether the table is actually ordered by that date: backfills and late-arriving data make every micro-partition span a wide date range. Then the predicate itself: the docs say not all predicate expressions can prune, and a predicate with a subquery never does, so I'd compute the value first and pass it as a constant. Then I'd look at the clustering information for that column before deciding anything about a clustering key.", pl: 'Ułożenie danych (backfille), postać predykatu (podzapytanie nie przycina), a potem informacje o klastrowaniu.' },
      { q: 'Does pruning help a query that selects most of the table?', a: "Not much. Pruning removes micro-partitions the filter rules out, so if the filter keeps most rows there's nothing to skip. For that kind of query what matters is reading fewer columns, since storage is columnar, and having enough warehouse to process the volume without spilling.", pl: 'Prawie nie. Wtedy liczy się liczba czytanych kolumn i rozmiar warehouse\'u, nie pruning.' }
    ],
    mistakes: [
      'Mylenie mikropartycji z partycjami Hive albo z indeksem. Nie definiujesz ich i nie wskazują konkretnych wierszy, tylko zakresy wartości.',
      'Założenie, że filtr w WHERE zawsze ogranicza skan. Ogranicza tylko wtedy, gdy zakresy mikropartycji pozwalają coś wykluczyć.',
      'Zdanie „partitions scanned = partitions total, więc brakuje indeksu". W Snowflake pytanie brzmi, jak dane są ułożone i czy predykat w ogóle nadaje się do pruningu.'
    ]
  },
  {
    id: 'snowflake-clustering',
    topicId: 'snowflake.clustering',
    area: 'snowflake',
    priority: 'P1',
    title: 'Clustering key: kiedy pomaga, kiedy marnuje kredyty',
    question: {
      pl: 'Kiedy zdefiniowałbyś clustering key, a kiedy to strata pieniędzy? Jak to ocenisz?',
      en: 'When would you define a clustering key, and when is it a waste of money? How do you decide?'
    },
    answer: {
      pl: 'Clustering key mówi Snowflake, po których kolumnach utrzymywać uporządkowanie danych, żeby zakresy mikropartycji były wąskie i pruning działał. Utrzymuje to usługa Automatic Clustering w tle, bez mojego warehouse\'u, i to kosztuje. Dlatego nie jest dla każdej tabeli. Dokumentacja wskazuje tabele z dużą liczbą mikropartycji, zwykle wiele terabajtów, w których większość zapytań filtruje selektywnie albo sortuje po tych samych kolumnach. Najlepiej opłaca się tam, gdzie tabela jest często czytana, a rzadko zmieniana, bo każda zmiana wymaga ponownego porządkowania, a przepisane mikropartycje zostają w Time Travel i Fail-safe. Zanim to włączę, sprawdzam w Query Profile, czy problemem jest w ogóle pruning, i patrzę na clustering depth dla kolumn z filtrów. Po włączeniu porównuję koszt usługi z zyskiem na zapytaniach.',
      en: "A clustering key tells Snowflake which columns to keep the data ordered by, so micro-partition ranges stay narrow and pruning works. A background service, Automatic Clustering, maintains it without my warehouse, and that costs money. So it isn't for every table. The docs point to tables with a large number of micro-partitions, typically multiple terabytes, where most queries filter selectively or sort on the same columns. It pays off most when the table is queried often and changed rarely, because every change needs re-ordering, and the rewritten micro-partitions stay in Time Travel and Fail-safe. Before turning it on, I check in Query Profile whether pruning is the problem at all, and I look at the clustering depth for the filter columns. Afterwards I compare the cost of the service with what the queries gained."
    },
    senior: {
      pl: 'Szczegóły wyboru klucza: dokumentacja zaleca najwyżej 3–4 kolumny lub wyrażenia, ułożone od najniższej do najwyższej kardynalności. Kolumna o bardzo niskiej kardynalności daje minimalny pruning, a o bardzo wysokiej zwykle nie nadaje się wprost, więc zamiast znacznika czasu bierze się np. to_date(ts). Clustering depth nie jest miarą absolutną: dokumentacja mówi, że najlepszym wskaźnikiem jest wydajność zapytań. Model rozliczania zależy od wersji usługi, więc przed decyzją sprawdzam, która obowiązuje dla danej tabeli.',
      en: "On choosing the key: the docs recommend at most three or four columns or expressions, ordered from lowest to highest cardinality. A very low-cardinality column gives minimal pruning, and a very high-cardinality one usually isn't a good key directly, so instead of a timestamp you'd use something like to_date of it. Clustering depth isn't an absolute measure: the docs say query performance is the best indicator. And the billing model depends on the version of the service, so I check which one applies to that table before deciding."
    },
    explain: [
      'Pruning działa, gdy wartości kolumny z filtra są skupione w niewielu mikropartycjach. Dane ładowane dzień po dniu są tak ułożone po dacie same z siebie. Po innych kolumnach już nie: klient 4217 ma zamówienia rozsiane po całej historii.',
      '<b>Clustering key</b> to deklaracja: utrzymuj dane uporządkowane po tych kolumnach. Usługa <b>Automatic Clustering</b> przepisuje wtedy w tle mikropartycje tak, żeby ich zakresy się nie nakładały. Nie blokuje zapytań DML i nie używa Twojego warehouse\'u.',
      'Stan uporządkowania opisuje <b>clustering depth</b>: średnia liczba nakładających się mikropartycji dla wskazanych kolumn. Im mniejsza, tym lepiej, a pusta tabela ma głębokość 0. Odczytasz ją funkcją <code>SYSTEM$CLUSTERING_INFORMATION</code>.',
      'Koszt ma dwie części. Porządkowanie zużywa kredyty. Przepisane mikropartycje nie znikają od razu: stare wersje są oznaczane jako usunięte, ale zostają na potrzeby Time Travel i Fail-safe, co zwykle podnosi koszt storage. Im częściej tabela się zmienia, tym więcej pracy ma usługa. Stąd reguła z dokumentacji: clustering jest najbardziej opłacalny dla tabel często czytanych i rzadko zmienianych.'
    ],
    keywords: ['clustering key', 'automatic clustering', 'clustering depth', 'overlap', 'reclustering', 'cardinality', 'SYSTEM$CLUSTERING_INFORMATION'],
    followUps: [
      { q: 'How is a clustering key different from an index?', a: "An index is a separate structure that points to individual rows, so a lookup can jump straight to them. A clustering key creates no extra structure: it changes how rows are physically grouped, so that min and max ranges become selective and whole micro-partitions can be skipped. That makes it good for range and equality filters on a few columns, and not a tool for single-row lookups on arbitrary columns. For those, Snowflake has the search optimization service.", pl: 'Indeks wskazuje wiersze. Clustering zmienia fizyczne ułożenie, żeby zakresy min/max były selektywne.' },
      { q: 'Which columns would you pick, and in what order?', a: "The columns most queries filter or join on, at most three or four. The docs recommend ordering them from lowest to highest cardinality. I avoid a raw high-cardinality column like a timestamp or a UUID as the leading key and use an expression that reduces cardinality, such as the date. And I don't pick a boolean-like column, because it barely prunes.", pl: 'Kolumny z filtrów, maks. 3–4, od najniższej do najwyższej kardynalności. Zamiast timestampu wyrażenie, np. data.' },
      { q: 'How do you know the clustering key is actually paying for itself?', a: "I compare before and after on the queries it was meant for: partitions scanned against partitions total, and elapsed time. Then I look at what the service consumed for that table in the account usage views. If the table churns a lot and the service keeps working while the queries got only slightly faster, I drop or suspend the key.", pl: 'Porównuję skan i czas zapytań przed i po oraz zużycie usługi dla tabeli. Brak zysku: wyłączam.' },
      { q: 'Is there a cheaper way to get the same pruning?', a: "Often, yes. If the table is rebuilt or loaded in batches, I can sort on insert with an ORDER BY on the filter columns, which gives good natural clustering at the cost of the sort in my own warehouse. That works well for append-mostly tables. It doesn't maintain the order after later updates, which is exactly what the automatic service is for.", pl: 'ORDER BY przy ładowaniu daje naturalne uporządkowanie. Nie utrzyma go jednak po późniejszych zmianach.' }
    ],
    mistakes: [
      'Dodawanie clustering key do każdej dużej tabeli „na wszelki wypadek". Usługa kosztuje, a zysk jest tylko tam, gdzie zapytania filtrują po kluczu.',
      'Klucz po kolumnie o bardzo wysokiej kardynalności, np. surowym timestampie albo UUID.',
      'Ocenianie wyniku samą clustering depth. Dokumentacja mówi, że najlepszym wskaźnikiem jest wydajność zapytań.'
    ]
  },
  {
    id: 'snowflake-caching',
    topicId: 'snowflake.caching',
    area: 'snowflake',
    priority: 'P0',
    title: 'Result cache a cache warehouse\'u',
    question: {
      pl: 'Jakie cache ma Snowflake i czym się różnią? Dlaczego drugie uruchomienie zapytania jest szybsze?',
      en: 'What caches does Snowflake have, and how do they differ? Why is the second run of a query faster?'
    },
    answer: {
      pl: 'Są dwa mechanizmy, które łatwo pomylić. Result cache trzyma gotowy wynik zapytania przez 24 godziny. Jeśli przyjdzie identyczne zapytanie, dane tabel się nie zmieniły, a rola ma potrzebne uprawnienia, Snowflake pomija wykonanie i oddaje zapisany wynik. Każde użycie odnawia te 24 godziny, najwyżej do 31 dni. Drugi to cache warehouse\'u: działający warehouse trzyma na lokalnych dyskach dane tabel, które już pobrał z object storage. Pomaga innym zapytaniom na tych samych danych, ale znika, gdy warehouse zostanie wstrzymany. Stąd kompromis w auto-suspend: krótki czas oszczędza kredyty, ale każdy start zaczyna z zimnym cache. Kiedy mierzę wydajność, wyłączam USE_CACHED_RESULT, bo inaczej mierzę odczyt wyniku, a nie zapytanie.',
      en: "There are two mechanisms that are easy to mix up. The result cache keeps the finished result of a query for 24 hours. If an identical query comes in, the table data hasn't changed, and the role has the required privileges, Snowflake skips execution and returns the stored result. Each reuse renews those 24 hours, up to 31 days. The second is the warehouse cache: a running warehouse keeps table data it has already fetched from object storage on its local disks. That helps other queries over the same data, but it's dropped when the warehouse is suspended. Hence the auto-suspend trade-off: a short timeout saves credits, but every start begins with a cold cache. When I measure performance I turn USE_CACHED_RESULT off, otherwise I'm measuring a result fetch, not the query."
    },
    senior: {
      pl: 'Warunki result cache są ostrzejsze, niż się wydaje. Tekst musi być identyczny: dokumentacja wymienia wielkość liter i aliasy tabel. Odpadają zapytania z funkcjami niedeterministycznymi, jak UUID_STRING czy RANDOM, z funkcjami zewnętrznymi i z tabelami hybrydowymi. Wynik unieważnia też zmiana mikropartycji, np. reclustering, nawet gdy dane logicznie są te same. Sprawdzane są uprawnienia roli, nie tożsamość użytkownika. I spełnienie warunków nie gwarantuje użycia cache.',
      en: "The result cache conditions are stricter than they look. The text has to match exactly: the docs call out upper versus lower case and table aliases. Queries with non-deterministic functions like UUID_STRING or RANDOM, external functions, or hybrid tables don't qualify. A change to the micro-partitions, such as reclustering, also invalidates the result even if the data is logically the same. The check is on the role's privileges, not on the user's identity. And meeting all the conditions doesn't guarantee reuse."
    },
    explain: [
      'Gdy zapytanie za drugim razem działa szybciej, są dwa różne wyjaśnienia i warto je odróżniać, bo jedno z nich nie mówi nic o wydajności samego zapytania.',
      '<b>Result cache</b> (dokumentacja: persisted query results) należy do warstwy cloud services. Przechowuje wynik przez 24 godziny, a każde ponowne użycie odnawia ten okres, maksymalnie do 31 dni od pierwszego wykonania. Żeby wynik został użyty, nowe zapytanie musi być identyczne co do znaku, dane tabel i ich mikropartycje nie mogą się zmienić, zapytanie nie może zawierać funkcji, których wyniku nie da się powtórzyć, a rola musi mieć uprawnienia do użytych tabel. Snowflake pomija wtedy wykonanie.',
      '<b>Cache warehouse\'u</b> należy do warstwy compute. Warehouse zapisuje na lokalnych dyskach dane tabel pobrane z object storage. Kolejne zapytania, także inne niż pierwsze, czytają je lokalnie. W Query Profile widać to jako „Percentage scanned from cache". Ten cache jest tym większy, im większy warehouse, i jest usuwany przy wstrzymaniu warehouse\'u oraz dla zasobów usuniętych przy zmniejszeniu rozmiaru.',
      'Wniosek dla auto-suspend: bardzo krótki czas minimalizuje bezczynność, ale każde wznowienie zaczyna z pustym cache i nalicza co najmniej 60 sekund. Dokumentacja każe ważyć oszczędność kredytów względem utrzymania cache.'
    ],
    keywords: ['result cache', 'persisted query results', 'warehouse cache', 'local disk cache', 'USE_CACHED_RESULT', 'auto-suspend', '24 hours'],
    followUps: [
      { q: 'Two users run the same dashboard query. Does the second one hit the result cache?', a: "It can. The reuse check is about the role having the required privileges on the tables, not about being the same user. But the query text has to be identical, the data unchanged, and nothing non-deterministic in it. If the dashboard injects a timestamp or a random comment into the SQL, or secure policies make the result depend on the user's context, I wouldn't count on it.", pl: 'Może. Liczą się uprawnienia roli i identyczny tekst, nie użytkownik. Zmienny fragment SQL psuje dopasowanie.' },
      { q: 'How do you benchmark a query fairly in Snowflake?', a: "I set USE_CACHED_RESULT to false for the session so the result cache is out of the picture. Then I decide whether I'm measuring a cold or a warm warehouse cache and say which one: suspend and resume for cold, or run once to warm up and measure the following runs. And I compare using the same warehouse size, otherwise I'm measuring the warehouse.", pl: 'Wyłączam USE_CACHED_RESULT, ustalam zimny albo ciepły cache warehouse\'u i trzymam ten sam rozmiar.' },
      { q: 'What auto-suspend would you set?', a: "It depends on the gaps in the workload. The docs recommend a low value, five or ten minutes or less, and matching it to how the workload arrives, because every resume bills at least sixty seconds and starts with a cold cache. For a batch warehouse that runs one job and goes idle I'd go low. For a BI warehouse with steady traffic I'd keep it long enough not to throw the cache away between dashboard clicks.", pl: 'Niska wartość, dopasowana do przerw w obciążeniu. Batch: krótko. BI: tyle, żeby nie tracić cache między zapytaniami.' },
      { q: 'Does the result cache survive a warehouse suspend?', a: "Yes, because it doesn't live in the warehouse. The persisted result is held by the service for 24 hours regardless of what the warehouse does. What suspension drops is the warehouse's local data cache. That difference is exactly why the two shouldn't be described as one cache.", pl: 'Tak. Wynik trzyma usługa, nie warehouse. Wstrzymanie kasuje tylko lokalny cache danych.' }
    ],
    mistakes: [
      'Wrzucanie obu mechanizmów do jednego worka „Snowflake cache\'uje". Jeden trzyma wyniki w usłudze, drugi dane na dyskach warehouse\'u.',
      'Mierzenie optymalizacji przy włączonym result cache. Drugi pomiar trwa milisekundy i nic nie mówi o zapytaniu.',
      'Zdanie „result cache działa tylko dla tego samego użytkownika". Dokumentacja mówi o uprawnieniach roli.'
    ]
  },
  {
    id: 'snowflake-scaling',
    topicId: 'snowflake.scaling',
    area: 'snowflake',
    priority: 'P0',
    title: 'Scale up kontra scale out, multi-cluster warehouse',
    question: {
      pl: 'Kiedy zwiększasz rozmiar warehouse\'u, a kiedy dodajesz klastry? Jak działa multi-cluster warehouse?',
      en: 'When do you scale a warehouse up, and when do you scale it out? How does a multi-cluster warehouse work?'
    },
    answer: {
      pl: 'To odpowiedzi na dwa różne problemy. Scale up, czyli większy rozmiar, daje pojedynczemu zapytaniu więcej procesora, pamięci i lokalnego dysku. Pomaga dużym, złożonym zapytaniom, zwłaszcza takim, które zrzucają dane na dysk. Każdy rozmiar w górę podwaja kredyty na godzinę, więc opłaca się wtedy, gdy czas spada mniej więcej o połowę. Scale out, czyli multi-cluster warehouse, dodaje kolejne klastry tego samego rozmiaru. Pojedyncze zapytanie nie przyspieszy, ale więcej zapytań działa naraz, więc znika kolejka. Dokumentacja mówi wprost: zmiana rozmiaru nie jest przeznaczona do rozwiązywania problemów ze współbieżnością. Dlatego najpierw ustalam objaw: czy zapytania czekają w kolejce, czy pojedyncze zapytanie jest wolne. Trzecia opcja to izolacja: osobne warehouse\'y dla obciążeń o różnym profilu.',
      en: "They answer two different problems. Scaling up, a bigger size, gives a single query more CPU, memory and local disk. It helps large, complex queries, especially ones that spill to disk. Each size up doubles the credits per hour, so it pays off when the runtime drops by roughly half. Scaling out, a multi-cluster warehouse, adds more clusters of the same size. A single query doesn't get faster, but more queries run at once, so the queue goes away. The docs say it directly: resizing isn't intended for handling concurrency issues. So I first pin down the symptom: are queries waiting in a queue, or is one query slow. The third option is isolation: separate warehouses for workloads with different profiles."
    },
    senior: {
      pl: 'Multi-cluster wymaga edycji Enterprise. W trybie auto-scale ustawiam minimum i maksimum klastrów, a polityka decyduje, kiedy startuje kolejny: Standard dokłada klaster, żeby ograniczyć kolejkę, Economy tylko wtedy, gdy szacuje co najmniej 6 minut pracy dla nowego klastra. Zmiana rozmiaru działającego warehouse\'u nie wpływa na zapytania, które już trwają: nowe zasoby obsługują kolejkę i nowe zapytania. A skalowanie liniowe to według dokumentacji reguła „w większości", głównie dla dużych zapytań: małe proste zapytanie na większym warehouse\'ie nie musi być szybsze.',
      en: "Multi-cluster needs Enterprise Edition. In auto-scale mode I set a minimum and maximum cluster count, and the scaling policy decides when another one starts: Standard adds a cluster to limit queuing, Economy only when it estimates at least six minutes of work for the new cluster. Resizing a running warehouse doesn't affect queries already in flight: the new resources serve queued and new queries. And linear scaling is, per the docs, true for the most part and mainly for larger queries: a small simple query isn't necessarily faster on a bigger warehouse."
    },
    explain: [
      'Wolny warehouse ma dwa różne objawy. Pierwszy: jedno zapytanie trwa długo, choć nic innego nie działa. Drugi: każde zapytanie z osobna jest szybkie, ale wiele z nich czeka w kolejce na wolne zasoby.',
      '<b>Scale up</b> to zmiana rozmiaru, np. z Medium na Large. Według tabeli z dokumentacji kredyty na godzinę podwajają się z każdym rozmiarem: X-Small 1, Small 2, Medium 4, Large 8 i tak dalej (to wartości dla warehouse\'ów pierwszej generacji). Większy warehouse ma więcej pamięci i dysku, więc zapytanie rzadziej zrzuca dane na dysk. To lekarstwo na pierwszy objaw.',
      '<b>Scale out</b> to <b>multi-cluster warehouse</b>: jeden warehouse, kilka klastrów tego samego rozmiaru. Gdy brakuje zasobów i zapytania zaczynają czekać, Snowflake uruchamia kolejny klaster, a gdy ruch spada, wyłącza go. To lekarstwo na drugi objaw. Pojedyncze zapytanie nadal działa na jednym klastrze.',
      'Rozliczenie jest sekundowe z minimum 60 sekund przy każdym starcie. Dlatego dwa razy większy warehouse, który kończy pracę w połowę czasu, kosztuje tyle samo. Gdy przy okazji znika zrzucanie na zdalny dysk, bywa i szybszy, i tańszy. Gdy zapytanie się nie skraca, płacisz podwójnie za nic.'
    ],
    keywords: ['scale up', 'scale out', 'multi-cluster warehouse', 'concurrency', 'queuing', 'auto-scale', 'scaling policy'],
    followUps: [
      { q: 'How do you tell queuing from a slow query?', a: "From the query history and the warehouse load. Queuing shows up as time spent queued before execution starts and as queued load on the warehouse activity chart, while execution time itself looks normal. A slow query has the time inside execution, and the Query Profile shows where: a big scan, a join, or spilling. The fixes are different, so I don't resize until I know which one it is.", pl: 'Kolejka: czas oczekiwania przed wykonaniem i queued load. Wolne zapytanie: czas w wykonaniu, widoczny w Query Profile.' },
      { q: 'Standard or Economy scaling policy?', a: "Standard when users are waiting on the result, like BI: it starts clusters to keep queries from queuing. Economy when cost matters more than latency: it only starts a cluster if it estimates enough load to keep it busy for at least six minutes, so some queries wait longer. Both only apply in auto-scale mode, where minimum and maximum cluster counts differ.", pl: 'Standard dla interaktywnych, Economy gdy koszt ważniejszy niż opóźnienie. Obie tylko w auto-scale.' },
      { q: 'Does doubling the warehouse size halve the runtime?', a: "Roughly, for large and complex queries, and the docs phrase it as for the most part. It doesn't hold for small simple queries, and it doesn't hold when the bottleneck isn't the warehouse, like a single-threaded step or waiting on locks. On the other side, a query that was spilling to remote storage can improve by more than half once it fits in memory. So I test instead of assuming.", pl: 'W przybliżeniu dla dużych zapytań. Dla małych nie, a przy usunięciu spillingu zysk bywa większy niż 2×.' },
      { q: 'Why not just put everything on one big multi-cluster warehouse?', a: "Because different workloads want different things. A heavy ELT job wants size, dashboards want concurrency and a warm cache, and ad hoc queries want a guardrail. On one warehouse they compete, one bad query affects everyone, and I can't attribute cost or set sensible timeouts per workload. Separate warehouses over the same data cost nothing extra when idle, and that's the point of separating storage from compute.", pl: 'Różne obciążenia chcą różnych ustawień. Osobne warehouse\'y dają izolację, atrybucję kosztu i osobne limity.' }
    ],
    mistakes: [
      'Zwiększanie rozmiaru jako odpowiedź na kolejkę. Dokumentacja mówi, że resize nie służy do problemów ze współbieżnością.',
      'Oczekiwanie, że multi-cluster przyspieszy pojedyncze ciężkie zapytanie. Ono nadal działa na jednym klastrze.',
      'Zdanie „większy warehouse zawsze kosztuje więcej". Rozliczenie jest sekundowe, więc liczy się rozmiar razy czas.'
    ]
  },
  {
    id: 'snowflake-slow-query',
    topicId: 'snowflake.query-profile',
    area: 'snowflake',
    priority: 'P0',
    title: 'Diagnoza wolnego zapytania: Query Profile i spilling',
    question: {
      pl: 'Zapytanie w Snowflake działa wolno. Jak je diagnozujesz, krok po kroku?',
      en: 'A query in Snowflake is slow. How do you diagnose it, step by step?'
    },
    answer: {
      pl: 'Zaczynam od ustalenia, gdzie upłynął czas: w kolejce, w kompilacji czy w wykonaniu. Kolejka to problem warehouse\'u, nie zapytania. Jeśli czas jest w wykonaniu, otwieram Query Profile i szukam najdroższych operatorów. Patrzę na cztery rzeczy, które dokumentacja wymienia jako typowe problemy. Nieskuteczny pruning: w TableScan partitions scanned jest bliskie partitions total. Eksplodujący join: operator Join oddaje wielokrotnie więcej wierszy, niż dostał, zwykle przez zły albo brakujący warunek. UNION zamiast UNION ALL, czyli zbędna deduplikacja. I zapytanie za duże na pamięć: bytes spilled to local storage, a w gorszym wariancie to remote storage. Dopiero diagnoza wskazuje naprawę: zmiana filtra albo ułożenia danych, poprawka joina, mniejsze porcje danych albo większy warehouse.',
      en: "I start by finding where the time went: queued, compiling or executing. Queuing is a warehouse problem, not a query problem. If the time is in execution, I open the Query Profile and look for the most expensive operators. I check four things the docs list as common problems. Inefficient pruning: in the TableScan, partitions scanned is close to partitions total. An exploding join: the Join operator produces many times more rows than it consumed, usually from a wrong or missing condition. UNION where UNION ALL would do, which adds a needless deduplication. And a query too large for memory: bytes spilled to local storage, and in the worse case to remote storage. Only the diagnosis points to the fix: changing the filter or the data layout, fixing the join, smaller batches, or a bigger warehouse."
    },
    senior: {
      pl: 'Spilling ma dwa poziomy: najpierw lokalny dysk warehouse\'u, a gdy go zabraknie, zdalny storage, co boli najbardziej. Dokumentacja podaje dwie naprawy: większy warehouse albo przetwarzanie w mniejszych porcjach. Dodałbym trzecią, którą widać w profilu: ograniczyć dane przed drogim operatorem, czyli filtrować i przycinać kolumny wcześniej. Zapytania, które spillują systematycznie, znajduję w QUERY_HISTORY po kolumnach bytes_spilled_to_local_storage i bytes_spilled_to_remote_storage.',
      en: "Spilling has two levels: first the warehouse's local disk, and when that runs out, remote storage, which hurts the most. The docs give two fixes: a larger warehouse or processing in smaller batches. I'd add a third that you can see in the profile: reduce the data before the expensive operator, so filter and prune columns earlier. To find queries that spill systematically I use QUERY_HISTORY and its bytes_spilled_to_local_storage and bytes_spilled_to_remote_storage columns."
    },
    explain: [
      'Wolne zapytanie to objaw, a przyczyn jest kilka i każda ma inną naprawę. <b>Query Profile</b> to graficzny widok wykonanego zapytania: drzewo operatorów (np. TableScan, Filter, Join, Aggregate, Sort) z czasem i statystykami każdego z nich. Czyta się go od dołu, czyli od skanów tabel, w górę do wyniku.',
      'Pierwsze pytanie brzmi: ile danych w ogóle przeczytano. Odpowiada na nie operator TableScan i statystyki <b>Partitions scanned</b> oraz <b>Partitions total</b>. Jeśli pierwsza jest małym ułamkiem drugiej, pruning działa. Jeśli są prawie równe, zapytanie czyta całą tabelę.',
      'Drugie pytanie: czy któryś operator mnoży wiersze. <b>Eksplodujący join</b> to Join, który oddaje o rzędy wielkości więcej wierszy, niż przyjął. Wszystko nad nim w drzewie musi tę masę przetworzyć.',
      'Trzecie pytanie: czy operacja zmieściła się w pamięci. Gdy nie, warehouse zapisuje dane pośrednie na lokalny dysk, a gdy i tego zabraknie, do zdalnego storage. To <b>spilling</b>, widoczny jako „Bytes spilled to local storage" i „Bytes spilled to remote storage". Zrzut zdalny spowalnia zapytanie najmocniej.'
    ],
    keywords: ['Query Profile', 'TableScan', 'partitions scanned', 'exploding join', 'spilling', 'remote storage', 'QUERY_HISTORY'],
    followUps: [
      { q: 'You see bytes spilled to remote storage. What do you do?', a: "It means the operation didn't fit in memory or on the warehouse's local disk. The quick fix is a larger warehouse, which has more of both. The better fix, if possible, is to make the operation smaller: filter earlier, select fewer columns, fix a join that multiplies rows, or process the data in smaller batches. I'd check which operator spills first, because if it's an exploding join, a bigger warehouse just hides a bug.", pl: 'Większy warehouse albo mniejsza operacja: wcześniejszy filtr, mniej kolumn, poprawiony join, mniejsze porcje.' },
      { q: 'How do you spot an exploding join in the profile?', a: "By comparing the row counts on the edges going into the Join operator with the count coming out. If the output is orders of magnitude larger than the inputs, the join condition is too loose: a missing predicate, a many-to-many relationship, or a non-unique key I assumed was unique. I confirm it by counting duplicates on the join key on both sides.", pl: 'Porównuję liczbę wierszy na wejściu i wyjściu Joina. Potwierdzam duplikatami klucza po obu stronach.' },
      { q: 'How is this different from tuning a slow Spark job?', a: "The questions are similar: how much was read, where rows multiply, what didn't fit in memory. The levers are different. In Spark I'd look at stages and tasks, skewed partitions, shuffle partition counts and join strategies, and I can change them. In Snowflake the engine picks the plan and parallelism, so I work on what I control: the SQL, the data layout and clustering, and the warehouse size.", pl: 'Pytania podobne, dźwignie inne. W Snowflake: SQL, ułożenie danych i rozmiar warehouse\'u.' },
      { q: 'The profile looks fine but the query was still slow yesterday. Why?', a: "Then I'd look outside the query. It may have queued behind other work, waited on a lock, or run on a cold warehouse right after a resume, with nothing in the local cache. Or today's fast run was simply a result cache hit. The query history shows queued time and total elapsed time separately, and the warehouse load history shows what else was running.", pl: 'Kolejka, blokada, zimny warehouse po wznowieniu albo dzisiejszy wynik z result cache. Sprawdzam historię.' }
    ],
    mistakes: [
      'Zaczynanie od zwiększenia warehouse\'u. Bez diagnozy to płacenie za ukrycie błędu, np. eksplodującego joina.',
      'Czytanie tylko łącznego czasu. Query Profile pokazuje, który operator kosztuje i ile danych naprawdę przeczytano.',
      'Traktowanie spillingu lokalnego i zdalnego jednakowo. Zdalny jest dużo droższy i to on jest sygnałem alarmowym.'
    ]
  },
  {
    id: 'snowflake-cost-control',
    topicId: 'snowflake.cost',
    area: 'snowflake',
    priority: 'P1',
    title: 'Koszty: compute, storage, serverless, resource monitory i budżety',
    question: {
      pl: 'Z czego składa się rachunek za Snowflake i jak kontrolujesz koszty? Czym różni się resource monitor od budżetu?',
      en: 'What makes up a Snowflake bill, and how do you keep it under control? How is a resource monitor different from a budget?'
    },
    answer: {
      pl: 'Rachunek to compute, storage i transfer danych. Compute ma kilka rodzajów: virtual warehouse\'y, którymi zarządzam sam, compute serverless, którym zarządza Snowflake, np. Snowpipe i automatic clustering, oraz cloud services. Warehouse jest rozliczany co do sekundy, z minimum 60 sekund przy każdym starcie, więc główne dźwignie to rozmiar, auto-suspend i to, żeby zapytania czytały mniej. Storage to średnia dzienna ilość skompresowanych danych, razem z Time Travel i Fail-safe. Do pilnowania są dwa narzędzia o różnym zasięgu. Resource monitor obejmuje tylko warehouse\'y i potrafi je wstrzymać po przekroczeniu limitu kredytów. Serverless nie widzi wcale. Budżet obejmuje warehouse\'y i funkcje serverless, ale domyślnie tylko powiadamia. Dlatego używam obu: monitor jako hamulec, budżet jako obraz całości.',
      en: "The bill is compute, storage and data transfer. Compute comes in several kinds: virtual warehouses that I manage, serverless compute that Snowflake manages, such as Snowpipe and automatic clustering, and cloud services. A warehouse bills per second with a 60-second minimum on every start, so the main levers are size, auto-suspend, and making queries read less. Storage is the average daily amount of compressed data, including Time Travel and Fail-safe. For guarding it there are two tools with different coverage. A resource monitor only covers warehouses and can suspend them when a credit quota is reached. It doesn't see serverless at all. A budget covers warehouses and serverless features, but by default it only notifies. So I use both: the monitor as a brake, the budget as the full picture."
    },
    senior: {
      pl: 'Kilka szczegółów, na których łatwo się potknąć. Resource monitor nie jest twardym limitem: dokumentacja mówi, że warehouse może zużywać kredyty po osiągnięciu limitu, zanim się zatrzyma, i zaleca próg z zapasem. Monitor liczy też cloud services bez dziennej korekty 10%. Budżet działa na prognozie, odświeża się domyślnie co do 6,5 godziny i jest wyrażony w kredytach, nie w walucie. Może wywołać procedurę składowaną po przekroczeniu progu, więc da się nim pośrednio wstrzymać warehouse, ale trzeba to zbudować. Storage budżety nie obejmują.',
      en: "A few details that are easy to trip on. A resource monitor isn't a hard cap: the docs say a warehouse can keep consuming credits after the quota is reached before it suspends, and they recommend a threshold with a buffer. The monitor also counts cloud services without the daily 10% adjustment. A budget works on a projection, refreshes by default every 6.5 hours at most, and is expressed in credits, not currency. It can call a stored procedure when a threshold is reached, so it can suspend a warehouse indirectly, but you have to build that. Budgets don't cover storage."
    },
    explain: [
      'Koszt Snowflake to suma trzech rzeczy: compute, storage i transfer danych. Compute liczy się w kredytach. Zużywają je warehouse\'y (zarządzasz nimi sam), funkcje serverless (compute zarządzany przez Snowflake, osobna pozycja na rachunku dla każdej funkcji) i warstwa cloud services, doliczana tylko powyżej 10% dziennego zużycia warehouse\'ów.',
      'Warehouse zużywa kredyty, gdy działa, niezależnie od tego, czy coś liczy. Rozliczenie jest sekundowe, ale każdy start to minimum 60 sekund. Wstrzymany warehouse nie zużywa kredytów. Stąd znaczenie <b>auto-suspend</b> (wstrzymaj po okresie bezczynności) i <b>auto-resume</b> (wznów, gdy przyjdzie zapytanie).',
      'Storage jest rozliczany miesięcznie od średniej dziennej liczby skompresowanych bajtów. Liczą się pliki w stage\'ach, dane tabel razem z historią Time Travel oraz Fail-safe. Tabela o dużej rotacji może mieć więcej danych historycznych niż aktywnych.',
      '<b>Resource monitor</b> pilnuje limitu kredytów dla warehouse\'ów i wspierających je cloud services. Może powiadomić, wstrzymać warehouse po zakończeniu bieżących zapytań albo wstrzymać natychmiast. Dokumentacja mówi wprost, że nie śledzi funkcji serverless ani usług AI i że do tego służy <b>budżet</b>: miesięczny limit kredytów dla konta albo grupy obiektów, który obejmuje też serverless i wysyła powiadomienie, gdy prognoza przekracza limit.'
    ],
    keywords: ['credits', 'serverless', 'cloud services', 'resource monitor', 'budget', 'auto-suspend', 'Time Travel storage'],
    followUps: [
      { q: 'Your resource monitors are all green but the bill went up. Where do you look?', a: "At what monitors don't cover. First serverless: Snowpipe, automatic clustering, materialized view maintenance, search optimization, serverless tasks. Each has its own usage history. Then storage: Time Travel and Fail-safe on high-churn tables, and clones that keep old data alive. The metering views break credits down by service type, so I'd start there rather than guessing.", pl: 'W to, czego monitor nie widzi: serverless i storage (Time Travel, Fail-safe, klony). Zaczynam od widoków meteringu.' },
      { q: 'How do you size a warehouse for a new workload?', a: "I start small and measure with a representative query set, not one query. I go up a size while runtime keeps dropping by about half, because then the cost per run stays flat and I just get the result sooner. When the gain flattens, I've passed the useful size. I also watch for spilling: if a size removes remote spilling, that step is usually worth it.", pl: 'Od małego, na reprezentatywnym zestawie. W górę, dopóki czas spada o połowę. Zwracam uwagę na spilling.' },
      { q: 'What would you set besides monitors and budgets?', a: "Statement timeouts on warehouses, so a runaway query is cancelled instead of running for two days, which is the default limit. A queue timeout where waiting makes no sense. Access control on who can create or resize warehouses. And tags on warehouses and users so cost can be attributed to teams. The docs note these controls don't apply to serverless features.", pl: 'Timeouty zapytań i kolejki, uprawnienia do tworzenia i zmiany warehouse\'ów, tagi do atrybucji kosztu.' },
      { q: 'How do transient tables reduce cost?', a: "They have no Fail-safe period and at most one day of Time Travel, so rewritten data stops being billed much sooner. The docs suggest them for short-lived tables such as ETL work tables. The trade-off is recoverability: once Time Travel is over, the data is gone, so I wouldn't use them for anything I can't rebuild from source.", pl: 'Brak Fail-safe i najwyżej 1 dzień Time Travel. Dobre dla tabel roboczych, które da się odtworzyć.' }
    ],
    mistakes: [
      'Zdanie „mamy resource monitor, więc koszt jest pod kontrolą". Monitor nie widzi funkcji serverless ani storage.',
      'Traktowanie budżetu jak wyłącznika. Domyślnie tylko powiadamia, a dane odświeża z opóźnieniem.',
      'Pomijanie storage historycznego. Time Travel i Fail-safe dla często przepisywanej tabeli bywają większe niż dane aktywne.'
    ]
  },
  {
    id: 'snowflake-streams-tasks',
    topicId: 'snowflake.streams-tasks',
    area: 'snowflake',
    priority: 'P1',
    title: 'Streams & Tasks: przetwarzanie przyrostowe',
    question: {
      pl: 'Jak działają Streams i Tasks? Jak zbudujesz na nich przyrostowy pipeline i co może pójść źle?',
      en: 'How do Streams and Tasks work? How would you build an incremental pipeline on them, and what can go wrong?'
    },
    answer: {
      pl: 'Stream to zakładka na tabeli źródłowej. Nie przechowuje danych, tylko offset, czyli punkt w historii wersji tabeli. Zapytanie do streamu zwraca zmiany netto między offsetem a stanem bieżącym, z kolumnami METADATA$ACTION i METADATA$ISUPDATE. Sam SELECT niczego nie przesuwa. Offset przesuwa się dopiero wtedy, gdy stream zostanie użyty w transakcji DML i ta transakcja się zatwierdzi. To daje mi atomowość: MERGE do tabeli docelowej i przesunięcie offsetu to jedna transakcja, więc po błędzie zmiany nie giną. Task uruchamia ten MERGE według harmonogramu albo gdy stream ma dane. Ryzyka: stream staje się nieaktualny, jeśli długo go nie konsumuję, każdy konsument potrzebuje własnego streamu, a przeciągnięty task powoduje pominięcie kolejnego uruchomienia.',
      en: "A stream is a bookmark on a source table. It doesn't store data, only an offset: a point in the table's version history. Querying the stream returns the net changes between that offset and now, with METADATA$ACTION and METADATA$ISUPDATE columns. A plain SELECT doesn't move anything. The offset advances only when the stream is used in a DML transaction and that transaction commits. That gives me atomicity: the MERGE into the target and the offset move are one transaction, so after a failure the changes aren't lost. A task runs that MERGE on a schedule or when the stream has data. The risks: a stream goes stale if I don't consume it for too long, every consumer needs its own stream, and a task that overruns causes the next run to be skipped."
    },
    senior: {
      pl: 'Stream zwraca deltę netto: wiersz wstawiony i usunięty między dwoma odczytami w ogóle się nie pojawi, a update jest parą DELETE i INSERT z flagą ISUPDATE. Nieaktualność wynika z retencji: gdy offset wypadnie poza okres Time Travel źródła, stream trzeba utworzyć od nowa. Snowflake wydłuża retencję dla niekonsumowanego streamu domyślnie do 14 dni. Dla potoków, które są jednym SELECT-em, dokumentacja zaleca dziś dynamic tables. Streams i tasks zostają tam, gdzie potrzebuję procedur, MERGE albo wywołań zewnętrznych.',
      en: "A stream returns the net delta: a row inserted and deleted between two reads never shows up, and an update is a DELETE and INSERT pair flagged with ISUPDATE. Staleness comes from retention: once the offset falls outside the source's Time Travel period, the stream has to be recreated. Snowflake extends retention for an unconsumed stream to 14 days by default. For pipelines that are a single SELECT, the docs now recommend dynamic tables. Streams and tasks remain for cases where I need stored procedures, MERGE, or external calls."
    },
    explain: [
      'Problem: tabela źródłowa ma miliard wierszy, a od ostatniego przebiegu zmieniło się tysiąc. Przeliczanie całości za każdym razem jest drogie. Potrzebne są dwie rzeczy: sposób na pytanie „co się zmieniło od ostatniego razu" i coś, co uruchomi przetwarzanie.',
      '<b>Stream</b> odpowiada na pierwsze. To obiekt, który pamięta <b>offset</b>, czyli moment w historii tabeli, i na żądanie zwraca różnicę między tym momentem a stanem bieżącym. Korzysta z wersjonowania tabeli, więc sam nie zawiera danych. Przy pierwszym streamie Snowflake dodaje do tabeli kilka ukrytych kolumn śledzenia zmian.',
      'Kluczowa reguła: zapytanie do streamu nie przesuwa offsetu. Offset przesuwa się tylko wtedy, gdy stream został użyty w instrukcji DML (np. <code>MERGE</code> albo <code>INSERT ... SELECT</code>) i transakcja została zatwierdzona. Jeśli MERGE się nie uda, offset zostaje i następny przebieg zobaczy te same zmiany.',
      '<b>Task</b> odpowiada na drugie: uruchamia SQL albo procedurę według harmonogramu albo wtedy, gdy stream ma nowe dane. Nowy task jest wstrzymany i trzeba go wznowić. Tasks można łączyć w graf z jednym zadaniem głównym. Domyślnie jednocześnie działa tylko jedno uruchomienie grafu: gdy poprzednie jeszcze trwa, zaplanowane uruchomienie jest pomijane.'
    ],
    keywords: ['stream', 'offset', 'task', 'CDC', 'MERGE', 'METADATA$ACTION', 'stale stream', 'dynamic tables'],
    followUps: [
      { q: 'What makes a stream stale, and how do you prevent it?', a: "A stream goes stale when its offset falls outside the data retention period of the source table, because the versions it needs are gone. Snowflake extends retention for an unconsumed stream up to 14 days by default, but not forever. Prevention is operational: consume the stream regularly, monitor the stale-after timestamp, and alert on suspended or failing tasks, because a silently suspended task is how streams usually go stale. A stale stream has to be recreated and the target reloaded.", pl: 'Offset wypada poza retencję źródła. Konsumuj regularnie, monitoruj STALE_AFTER i wstrzymane taski.' },
      { q: 'Two downstream tables need the same changes. One stream or two?', a: "Two. Consuming a stream in a committed DML moves its offset, so the second consumer would see nothing. The docs recommend a separate stream per consumer, and streams are cheap because they only store an offset. Each consumer then progresses independently and can fail and retry without affecting the other.", pl: 'Dwa. Konsumpcja przesuwa offset, więc drugi odbiorca nic by nie zobaczył. Stream jest tani.' },
      { q: 'Is this exactly-once processing?', a: "Within Snowflake, the consuming DML and the offset advance commit together, so a change is neither lost nor applied twice by that statement. I'd still write the MERGE to be idempotent, keyed on a business key, because the guarantee covers that one transaction, not everything around it: a reload after a stale stream, a manual rerun, or side effects outside Snowflake.", pl: 'DML i offset zatwierdzają się razem. MERGE i tak piszę idempotentnie, bo gwarancja dotyczy jednej transakcji.' },
      { q: 'When would you choose dynamic tables instead?', a: "When the transformation can be written as a SELECT. I declare the query and a target lag, and Snowflake works out dependencies and refreshes, incrementally where it can. The docs recommend that for new multi-table SQL pipelines. I'd stay with streams and tasks when I need procedural logic, a MERGE with custom rules, or external calls. And target lag is a goal, not a guarantee.", pl: 'Gdy logika to SELECT: deklaruję zapytanie i target lag. Streams i tasks, gdy potrzebna procedura albo MERGE.' }
    ],
    mistakes: [
      'Zdanie „stream przechowuje zmienione wiersze". Przechowuje offset, a zmiany wylicza z historii wersji tabeli.',
      'Założenie, że SELECT ze streamu go konsumuje. Offset przesuwa dopiero zatwierdzona transakcja DML.',
      'Jeden stream dla kilku odbiorców. Pierwszy, który go skonsumuje, zabiera zmiany pozostałym.'
    ]
  },
  {
    id: 'snowflake-time-travel-cloning',
    topicId: 'snowflake.time-travel',
    area: 'snowflake',
    priority: 'P1',
    title: 'Time Travel, Fail-safe i zero-copy cloning',
    question: {
      pl: 'Czym różni się Time Travel od Fail-safe? Jak działa zero-copy cloning i ile kosztuje?',
      en: 'How is Time Travel different from Fail-safe? How does zero-copy cloning work, and what does it cost?'
    },
    answer: {
      pl: 'Wszystkie trzy wynikają z tego samego: Snowflake nie nadpisuje mikropartycji, tylko zapisuje nowe i przez pewien czas trzyma stare. Time Travel to okres, w którym sam mogę z tych starych wersji korzystać: zapytać o stan sprzed zmiany, sklonować go albo cofnąć DROP. Domyślnie to 1 dzień, w edycji Enterprise do 90 dni dla tabel stałych. Fail-safe to kolejne 7 dni po Time Travel, nie do skonfigurowania, i tylko Snowflake może z niego odzyskać dane, po zgłoszeniu do supportu. To ostatnia deska ratunku, nie backup, do którego sięgam sam. Klon to nowy obiekt, który wskazuje na te same mikropartycje, więc powstaje szybko i na początku nie zajmuje dodatkowego miejsca. Płacę dopiero za to, co się rozejdzie: zmiany w klonie i stare dane, które klon utrzymuje przy życiu.',
      en: "All three come from the same thing: Snowflake doesn't overwrite micro-partitions, it writes new ones and keeps the old ones for a while. Time Travel is the period when I can use those old versions myself: query the state before a change, clone it, or undo a DROP. It's one day by default, and up to 90 days for permanent tables on Enterprise Edition. Fail-safe is a further seven days after Time Travel, not configurable, and only Snowflake can recover data from it, through a support case. It's a last resort, not a backup I reach into myself. A clone is a new object that points at the same micro-partitions, so it's created quickly and takes no extra storage at first. I pay only for what diverges: changes in the clone, and old data the clone keeps alive."
    },
    senior: {
      pl: 'Koszt jest w szczegółach. Time Travel i Fail-safe są płatne jak zwykły storage, więc tabela często przepisywana może mieć więcej danych historycznych niż aktywnych. Tabele transient i temporary nie mają Fail-safe i mają najwyżej 1 dzień Time Travel. Przy klonie bazy uprawnienia do obiektów podrzędnych są zachowane, ale uprawnienia do samego kontenera już nie. Taski w klonie są wstrzymane, a niekonsumowane rekordy w sklonowanych streamach są niedostępne. Fail-safe działa według dokumentacji na zasadzie best effort i odzyskiwanie trwa od godzin do dni.',
      en: "The cost is in the details. Time Travel and Fail-safe are billed like regular storage, so a table that's rewritten often can hold more historical data than active data. Transient and temporary tables have no Fail-safe and at most one day of Time Travel. When cloning a database, grants on child objects are kept, but grants on the container itself are not. Tasks in the clone are suspended, and unconsumed records in cloned streams are inaccessible. Fail-safe is best-effort according to the docs, and recovery takes hours to days."
    },
    explain: [
      'Zmiana w tabeli Snowflake nie modyfikuje istniejących mikropartycji. Zapisuje nowe, a stare przestają należeć do bieżącej wersji tabeli, ale jeszcze nie znikają. Z tego jednego faktu wynikają trzy funkcje.',
      '<b>Time Travel</b>: przez okres retencji stare wersje są dostępne dla Ciebie. Możesz zapytać o stan z przeszłości klauzulą <code>AT</code> albo <code>BEFORE</code>, odtworzyć usunięty obiekt przez <code>UNDROP</code> albo sklonować stan z wybranego momentu. Standardowa retencja to 1 dzień. Więcej niż 1 dzień wymaga edycji Enterprise, maksymalnie 90 dni dla obiektów stałych.',
      '<b>Fail-safe</b>: po zakończeniu Time Travel dane tabel stałych przechodzą na 7 dni do stanu, z którego odzyskać je może tylko Snowflake. Okresu nie da się zmienić. Tabele transient i temporary go nie mają.',
      '<b>Zero-copy cloning</b>: <code>CREATE ... CLONE</code> tworzy nowy obiekt, którego metadane wskazują na istniejące mikropartycje źródła. Nic nie jest kopiowane, więc klon nie zajmuje dodatkowego storage. Od tej chwili obiekty są niezależne: zmiana w klonie zapisuje nowe mikropartycje należące tylko do klonu. Uwaga na drugą stronę: jeśli źródło usunie dane, a klon nadal na nie wskazuje, te mikropartycje dalej są przechowywane i płatne.'
    ],
    keywords: ['Time Travel', 'Fail-safe', 'zero-copy clone', 'retention', 'UNDROP', 'transient table', 'AT | BEFORE'],
    followUps: [
      { q: 'Someone ran a bad UPDATE on a production table an hour ago. What do you do?', a: "I'd use Time Travel. First I'd query the table as of just before the statement to confirm the old state is what I expect. Then, rather than overwrite in place, I'd clone the table at that point into a new table, compare it with the current one, and either swap them or merge back only the damaged rows, depending on what was written since. That works as long as I'm within the retention period.", pl: 'Time Travel: sprawdzam stan sprzed instrukcji, klonuję go, porównuję i podmieniam albo scalam uszkodzone wiersze.' },
      { q: 'Is Fail-safe your backup strategy?', a: "No. I can't query it or restore from it myself: recovery goes through Snowflake support, it's best-effort, and it can take hours to days. It's protection against a catastrophic loss, not a tool for operational mistakes. For those I rely on Time Travel with a retention that matches how quickly we'd notice a problem, and for longer-term recovery points the docs point to Snowflake's backups feature.", pl: 'Nie. Tylko Snowflake z niego odzyskuje, best effort, godziny do dni. Na błędy operacyjne jest Time Travel.' },
      { q: 'Is a clone really free?', a: "Creating it is: it shares the existing micro-partitions. It starts to cost as the two diverge. Changes in the clone write new micro-partitions owned by the clone. And if the source deletes or rewrites data the clone still references, that old data can't be dropped, so it's retained and billed. Long-lived clones of a high-churn table quietly accumulate storage.", pl: 'Utworzenie tak. Kosztuje rozejście się: zmiany w klonie i stare dane źródła, które klon trzyma przy życiu.' },
      { q: 'What surprises people when they clone a whole database for testing?', a: "A few documented behaviours. Tasks in the clone are suspended, so nothing runs until you resume them. Unconsumed records in cloned streams are inaccessible, so pipelines start from the clone point. Pipes that reference internal stages aren't cloned. And privileges: grants on the child objects come along, but grants on the database itself don't, so roles may not be able to use it until you grant usage.", pl: 'Taski wstrzymane, streamy bez zaległych rekordów, pipe\'y z wewnętrznych stage\'y pominięte, brak grantów na kontenerze.' }
    ],
    mistakes: [
      'Traktowanie Fail-safe jak dłuższego Time Travel. Użytkownik nie ma do niego dostępu.',
      'Zdanie „klon nic nie kosztuje". Nie kosztuje w chwili utworzenia, potem płacisz za rozbieżności i przetrzymane dane.',
      'Ustawianie 90 dni Time Travel na wszystkim. Dla tabel o dużej rotacji to wielokrotność danych aktywnych w storage.'
    ]
  },
  {
    id: 'snowflake-access-sharing',
    topicId: 'snowflake.access-control',
    area: 'snowflake',
    priority: 'P1',
    title: 'RBAC, least privilege, izolacja tenantów i secure data sharing',
    question: {
      pl: 'Jak zaprojektujesz kontrolę dostępu w Snowflake dla wielu zespołów albo klientów? Jak działa secure data sharing?',
      en: 'How would you design access control in Snowflake for many teams or tenants? And how does secure data sharing work?'
    },
    answer: {
      pl: 'Uprawnienia nadaje się rolom, a role użytkownikom albo innym rolom, więc powstaje hierarchia, w której rola wyżej dziedziczy uprawnienia ról pod nią. Buduję dwa poziomy. Role dostępu do obiektów mają konkretne uprawnienia, np. odczyt jednego schematu. Role funkcyjne odpowiadają pracy ludzi i dostają zestaw ról dostępu. Najwyższe role własne podpinam pod SYSADMIN, a ACCOUNTADMIN zostawiam do administracji kontem, nie do tworzenia obiektów. Least privilege oznacza też osobne role dla usług i schematy managed access, gdzie o grantach decyduje właściciel schematu. Tenantów izoluję tak mocno, jak wymaga ryzyko: osobne bazy albo konta, a przy wspólnych tabelach row access policy. Secure data sharing udostępnia obiekty innemu kontu bez kopiowania: odbiorca czyta je tylko do odczytu i płaci za własny compute.',
      en: "Privileges are granted to roles, and roles to users or to other roles, so you get a hierarchy where a role higher up inherits the privileges of the roles below it. I build two levels. Object access roles hold specific privileges, like read on one schema. Functional roles match what people do and are granted a set of access roles. I attach the top custom roles to SYSADMIN, and keep ACCOUNTADMIN for account administration, not for creating objects. Least privilege also means separate roles for services, and managed access schemas, where the schema owner decides on grants. I isolate tenants as strongly as the risk requires: separate databases or accounts, or row access policies on shared tables. Secure data sharing exposes objects to another account without copying: the consumer reads them read-only and pays for its own compute."
    },
    senior: {
      pl: 'Kilka rzeczy, o które rekruter dopyta. ACCOUNTADMIN nie jest superużytkownikiem: domyślnie nie zmodyfikuje obiektów roli, która nie jest podpięta do hierarchii systemowej, dlatego osierocone role własne to realny problem. Row access policy wymaga edycji Enterprise i ma koszt: dokumentacja mówi, że proste wyrażenia działają lepiej niż polityki sięgające do tabel mapujących, a Snowflake musi skanować kolumny związane z polityką, nawet gdy zapytanie ich nie używa. Bezpośredni share działa tylko w tym samym regionie. Dla innych regionów i chmur dokumentacja wskazuje listing z auto-fulfillment.',
      en: "A few things an interviewer will probe. ACCOUNTADMIN isn't a superuser: by default it can't modify objects owned by a role that isn't attached to the system hierarchy, which is why orphaned custom roles are a real problem. Row access policies need Enterprise Edition and have a cost: the docs say simple expressions perform better than policies that look up mapping tables, and Snowflake has to scan the columns the policy is bound to even when the query doesn't reference them. A direct share only works within the same region. For other regions and clouds the docs point to a listing with auto-fulfillment."
    },
    explain: [
      'W Snowflake nie nadaje się uprawnień bezpośrednio ludziom. Dokumentacja opisuje model łączący trzy podejścia, z których w praktyce najważniejsze jest <b>RBAC</b>: uprawnienie dostaje rola, a rolę dostaje użytkownik albo inna rola. Każdy obiekt ma jednego właściciela, którym jest rola.',
      'Nadanie roli innej roli tworzy <b>hierarchię</b>: rola wyżej dziedziczy wszystko, co mają role pod nią. Role systemowe to m.in. ACCOUNTADMIN, SECURITYADMIN, USERADMIN, SYSADMIN i PUBLIC. Zalecenie z dokumentacji: najwyższe role własne podpinać pod SYSADMIN, a ACCOUNTADMIN nie używać do tworzenia obiektów ani jako roli domyślnej.',
      '<b>Least privilege</b> w praktyce to dwa rodzaje ról. Rola dostępu ma wąskie uprawnienia do obiektów. Rola funkcyjna, np. analityk, zbiera potrzebne role dostępu. Technicznie to te same role, różni je tylko zastosowanie.',
      '<b>Secure data sharing</b>: dostawca tworzy share i dodaje do niego obiekty, a konto odbiorcy tworzy z niego bazę tylko do odczytu. Dane nie są kopiowane ani przesyłane, więc nie zajmują storage u odbiorcy. Odbiorca płaci tylko za compute, którym je odpytuje, a dostawca nadal płaci za storage.'
    ],
    keywords: ['RBAC', 'role hierarchy', 'least privilege', 'SYSADMIN', 'ACCOUNTADMIN', 'row access policy', 'secure data sharing', 'managed access'],
    followUps: [
      { q: 'How would you isolate tenants in a multi-tenant platform?', a: "It's a spectrum, and I'd pick by risk and number of tenants. Separate accounts give the strongest isolation, including billing and network policy, but cost the most to operate. A database or schema per tenant with its own roles is a middle ground. Shared tables with a tenant column and a row access policy scale to many tenants, but a policy mistake leaks data, and policies have a query cost. I'd also separate compute, with a warehouse per tenant or tier, so one tenant can't starve another.", pl: 'Spektrum: konto, baza lub schemat, wspólne tabele z row access policy. Osobno izoluję compute.' },
      { q: 'Why not just grant privileges directly to users?', a: "Because it doesn't scale and can't be audited. With roles, a new analyst gets one grant and has exactly what the role defines, and removing access is one revoke. Snowflake does have user-based grants now, but the docs recommend role-based access for production and governance, and direct user privileges only take effect when all secondary roles are active.", pl: 'Nie skaluje się i nie da się tego audytować. Dokumentacja zaleca RBAC dla produkcji.' },
      { q: 'What does the consumer of a share pay for, and what can they do?', a: "They pay for the compute they use to query it, nothing for storage, because no data is copied. The shared database is read-only for them. The provider keeps paying for storage and controls what's in the share, and can revoke it at any time. For a consumer without a Snowflake account, the provider can create a reader account, and then the provider pays for that compute too.", pl: 'Płaci za własny compute, ma tylko odczyt. Przy reader account compute opłaca dostawca.' },
      { q: 'What are managed access schemas and future grants for?', a: "They keep grants from drifting. In a regular schema the object owner can grant access to whatever they created, so privileges spread informally. In a managed access schema only the schema owner, or a role with MANAGE GRANTS, decides. Future grants define the privileges that new objects of a type will get automatically, so a table created by a pipeline tomorrow is readable by the right roles without anyone remembering to grant it.", pl: 'Managed access: o grantach decyduje właściciel schematu. Future grants: nowe obiekty dostają uprawnienia od razu.' }
    ],
    mistakes: [
      'Praca na ACCOUNTADMIN i tworzenie nią obiektów. Dokumentacja zaleca ograniczyć ją do administracji kontem.',
      'Role własne niepodpięte do SYSADMIN. Administratorzy nie zarządzają wtedy obiektami tych ról.',
      'Zdanie „data sharing kopiuje dane do odbiorcy". Nic nie jest kopiowane, odbiorca czyta dane dostawcy.'
    ]
  }
];

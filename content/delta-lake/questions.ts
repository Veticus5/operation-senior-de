import type { Question } from '../types';

/**
 * Pytania: Delta Lake. Zweryfikowane w dokumentacji Databricks (linki i daty w docs/verified-facts.md).
 * Zachowania opisane jako cechy Databricks (predictive optimization, liquid clustering, automatic CDF)
 * nie muszą dotyczyć Delta Lake uruchamianego poza Databricks.
 */
export const deltaQuestions: Question[] = [
  {
    id: 'delta-acid-log',
    topicId: 'delta.transaction-log',
    area: 'delta-lake',
    priority: 'P0',
    title: 'Log transakcyjny i ACID',
    question: {
      pl: 'Co to jest Delta Lake i skąd bierze ACID na object storage?',
      en: 'What is Delta Lake and how does it provide ACID guarantees on object storage?'
    },
    answer: {
      pl: 'Delta to pliki Parquet plus log transakcyjny w katalogu _delta_log. Każdy commit to wpis z listą plików dodanych i usuniętych oraz metadanymi. Czytelnik odtwarza stan tabeli z logu, więc nigdy nie widzi zapisu w połowie. To daje atomowość i snapshot isolation. Piszący korzystają z optimistic concurrency: zapisują nowe pliki i próbują dodać kolejny wpis, a przy konflikcie ponawiają albo dostają błąd. Pliki danych są niezmienne, update zapisuje nowe i oznacza stare jako usunięte. Z tego samego mechanizmu wynikają time travel, pilnowanie schematu i MERGE.',
      en: 'Delta is Parquet files plus a transaction log in the _delta_log directory. Each commit is an entry listing the files added and removed, plus metadata. A reader reconstructs the table state from the log, so it never sees a half-finished write. That gives atomicity and snapshot isolation. Writers use optimistic concurrency: they write new files and try to add the next log entry, and on a conflict they retry or fail. Data files are immutable, so an update writes new files and marks the old ones as removed. The same mechanism gives you time travel, schema enforcement and MERGE.'
    },
    explain: [
      'Object storage, np. S3, nie ma transakcji. Jeśli job zapisze 50 ze 100 plików i padnie, czytelnik zobaczy połowę danych. Delta rozwiązuje to listą. Tabela to pliki Parquet plus katalog <code>_delta_log</code>, w którym każdy commit jest osobnym, numerowanym plikiem z informacją: te pliki dodano, te usunięto.',
      'Czytelnik nie zgaduje po zawartości katalogu, tylko czyta log i bierze dokładnie te pliki, które log wymienia. Plik, którego nie ma w logu, dla niego nie istnieje. Commit to pojawienie się jednego pliku logu, więc albo jest cały, albo go nie ma. Stąd atomowość.',
      'Dwóch piszących: każdy próbuje zapisać commit o kolejnym numerze. Wygrywa pierwszy. Drugi sprawdza, czy zmiany się gryzą, i albo ponawia, albo zgłasza konflikt. To optimistic concurrency: zakładamy, że konfliktów jest mało, i sprawdzamy dopiero na końcu.',
      'Doprecyzowanie do „update zapisuje nowe pliki": pliki Parquet są niezmienne, ale przy włączonych deletion vectors zmiana lub usunięcie wiersza nie przepisuje całego pliku. Delta zapisuje obok znacznik, że ten wiersz już nie obowiązuje, a czytelnik uwzględnia go przy odczycie.'
    ],
    keywords: ['_delta_log', 'optimistic concurrency', 'snapshot isolation', 'time travel', 'schema enforcement'],
    followUps: [
      { q: 'What happens when two jobs write at the same time?', a: 'Two appends both succeed. If both rewrite the same files, the second commit detects the conflict and has to retry or fails.', pl: 'Konflikt wykrywany przy commicie.' },
      { q: 'How far back can you time travel?', a: 'As long as the old data files and log entries still exist. By default VACUUM keeps seven days of files and the log is kept for thirty days.', pl: 'Ogranicza to VACUUM i retencja logu.' },
      { q: 'How is Delta different from plain Parquet?', a: 'Parquet is only a file format. Delta adds transactions, version history and file-level statistics for data skipping.', pl: 'Parquet to format pliku, Delta to tabela.' },
      { q: 'Does an update always rewrite the whole file?', a: 'Not with deletion vectors. Without them, changing one row means rewriting the Parquet file that holds it. With them, Delta marks the row as removed in a separate file and applies that mark at read time.', pl: 'Pliki są niezmienne, ale deletion vectors oszczędzają przepisywania.' }
    ],
    mistakes: [
      'Opisanie Delty jako „formatu pliku". Format to Parquet, Delta to protokół nad plikami.',
      'Pominięcie logu: bez niego nie da się wyjaśnić ACID.',
      'Twierdzenie, że update modyfikuje pliki Parquet w miejscu.'
    ]
  },
  {
    id: 'delta-merge-idempotency',
    topicId: 'delta.merge',
    area: 'delta-lake',
    priority: 'P0',
    title: 'MERGE i idempotentne ładowanie',
    question: {
      pl: 'Jak działa MERGE i jak zrobić ładowanie przyrostowe idempotentne?',
      en: 'How does MERGE work and how do you make an incremental load idempotent?'
    },
    answer: {
      pl: 'MERGE łączy źródło z tabelą docelową po kluczu i w jednym atomowym commicie robi insert, update i delete. Żeby ładowanie było idempotentne, pilnuję trzech rzeczy. Deterministyczny klucz biznesowy w ON, żeby powtórka aktualizowała te same wiersze. Deduplikacja źródła w ramach paczki, bo MERGE kończy się błędem, gdy kilka wierszy źródła próbuje zmienić ten sam wiersz celu. I warunek, żeby starsze dane nie nadpisały nowszych: update tylko wtedy, gdy timestamp źródła jest nowszy. Wtedy ponowne uruchomienie paczki zostawia tabelę w tym samym stanie.',
      en: 'MERGE joins a source to a target table on a key and applies inserts, updates and deletes in one atomic commit. To make a load idempotent I take care of three things. A deterministic business key in the ON clause, so a re-run updates the same rows. Deduplicating the source within the batch, because MERGE fails when several source rows try to modify the same target row. And a condition so that older data never overwrites newer data: update only when the source timestamp is newer. With that, re-running a batch leaves the table in the same state.'
    },
    senior: {
      pl: 'Wydajnościowo MERGE to join, więc trzymam tabelę sklastrowaną po kluczu merge\'a. Dodatkowy warunek w ON, np. na datę, dokładam tylko wtedy, gdy ta kolumna jest niezmienną częścią klucza. Inaczej pasujący wiersz spoza zakresu nie zostanie dopasowany i MERGE wstawi duplikat.',
      en: 'Performance-wise MERGE is a join, so I keep the table clustered by the merge key. I add an extra predicate to ON, for example on a date, only when that column is an immutable part of the key. Otherwise a matching row outside the range is not matched and MERGE inserts a duplicate.'
    },
    explain: [
      'Idempotentne ładowanie to takie, które można bezpiecznie powtórzyć: druga próba tej samej paczki zostawia tabelę w tym samym stanie. To ważne, bo joby padają w połowie i są ponawiane.',
      'MERGE dopasowuje wiersze źródła do celu po warunku ON i dla każdej pary decyduje: update, delete albo insert. Idempotencję psują trzy rzeczy. Klucz, który nie jest stały: powtórka wstawi nowy wiersz zamiast zaktualizować stary. Duplikaty w źródle: gdy dwa wiersze źródła pasują do jednego wiersza celu i oba chcą go zmienić, Delta nie wie, który ma wygrać, i MERGE kończy się błędem. Brak warunku na kolejność: spóźniona, starsza wersja wiersza nadpisze nowszą.',
      'W dbt to samo robi model incremental ze strategią merge i <code>unique_key</code>. Analogia kończy się na tym, że dbt generuje MERGE za Ciebie, a deduplikację paczki i warunek kolejności i tak musisz napisać sam, w dbt czy poza nim.'
    ],
    keywords: ['MERGE', 'idempotency', 'business key', 'deduplication', 'late data', 'replaceWhere'],
    followUps: [
      { q: 'What other ways are there to get idempotency?', a: 'Overwriting a slice of the table with replaceWhere, or in streaming, foreachBatch with a MERGE inside. foreachBatch alone is at-least-once, so the MERGE is what makes a replayed batch harmless.', pl: 'Nadpisanie wycinka albo foreachBatch + MERGE.' },
      { q: 'How do you handle deletes?', a: 'With a WHEN MATCHED clause on a delete flag, or WHEN NOT MATCHED BY SOURCE when the source is a full snapshot.', pl: 'Flaga usunięcia albo NOT MATCHED BY SOURCE.' },
      { q: 'Why can MERGE be slow?', a: 'With a poor file layout it has to scan and rewrite a large part of the target table.', pl: 'Układ plików po kluczu merge\'a.' }
    ],
    mistakes: [
      'Zawężanie ON po dacie „dla wydajności" bez sprawdzenia, czy to nie zrobi duplikatów.',
      'Brak deduplikacji źródła.',
      'Mówienie o idempotencji bez podania klucza.'
    ]
  },
  {
    id: 'delta-optimize-vacuum',
    topicId: 'delta.optimize-vacuum',
    area: 'delta-lake',
    priority: 'P1',
    title: 'OPTIMIZE i VACUUM',
    question: {
      pl: 'Co robią OPTIMIZE i VACUUM? Jakie jest ryzyko VACUUM?',
      en: 'What do OPTIMIZE and VACUUM do? What is the risk of VACUUM?'
    },
    answer: {
      pl: 'OPTIMIZE skleja dużo małych plików w mniej dużych i przy okazji układa dane, jeśli tabela ma clustering. Nie zmienia danych, tylko układ, i tworzy nową wersję tabeli. VACUUM fizycznie kasuje pliki, do których aktualna wersja już się nie odwołuje i które są starsze niż próg retencji, domyślnie 7 dni. Dopiero to zwalnia miejsce. Ryzyko jest takie, że po VACUUM nie cofnę się dalej niż okno retencji, a przy zbyt krótkiej retencji mogę skasować pliki potrzebne długiemu zapytaniu. Na tabelach managed w Unity Catalog obie operacje może wykonywać predictive optimization, o ile jest włączona dla danego konta, katalogu lub schematu.',
      en: 'OPTIMIZE compacts many small files into fewer large ones and also applies the layout if the table uses clustering. It does not change the data, only the layout, and it creates a new table version. VACUUM physically deletes files that the current version no longer references and that are older than the retention threshold, seven days by default. That is what actually frees storage. The risk is that after VACUUM I cannot time travel beyond the retention window, and with a retention that is too short I can delete files a long-running query still needs. On Unity Catalog managed tables predictive optimization can run both for me, as long as it is enabled for that account, catalog or schema.'
    },
    explain: [
      'To dwa różne problemy. Pierwszy: częste małe zapisy zostawiają tysiące drobnych plików, a każdy plik to osobne otwarcie i odczyt. OPTIMIZE przepisuje je w mniej większych plików. Dane się nie zmieniają, ale powstaje nowa wersja tabeli, a stare pliki zostają na dysku.',
      'Drugi problem to właśnie te stare pliki. Delta ich nie kasuje, bo są potrzebne do time travel i trwającym zapytaniom. VACUUM usuwa fizycznie pliki, których aktualna wersja już nie używa i które są starsze niż retencja, domyślnie 7 dni. Po nim nie cofniesz się do wersji, której pliki zniknęły.',
      'Predictive optimization uruchamia te operacje sama, ale nie wszędzie. Według dokumentacji Databricks działa tylko na tabelach managed w Unity Catalog, jest domyślnie włączona, a konto, katalog albo schemat mogą ją wyłączyć. Wymaga też obsługiwanego regionu i odpowiedniego planu. Nie stosuje Z-order i nie obejmuje tabel external, więc tam dalej planujesz własne joby.',
      'W Snowflake nie ma odpowiednika tych poleceń, bo układem plików i retencją (Time Travel, Fail-safe) zarządza usługa. To dobre miejsce, żeby na rozmowie pokazać, że rozumiesz różnicę: w Delcie pliki są Twoje, więc i sprzątanie bywa Twoje.'
    ],
    keywords: ['OPTIMIZE', 'VACUUM', 'small files', 'retention', '7 days', 'predictive optimization'],
    followUps: [
      { q: 'Does OPTIMIZE block readers?', a: 'No. Readers use snapshot isolation, and the result before and after is the same.', pl: 'Czytający nie są blokowani.' },
      { q: 'Where do small files come from?', a: 'Frequent small writes, streaming and MERGE operations.', pl: 'Streaming i częste MERGE.' },
      { q: 'What does predictive optimization run?', a: 'OPTIMIZE, VACUUM and ANALYZE, on Unity Catalog managed tables where it is enabled. It does not apply Z-ordering and does not cover external tables.', pl: 'Tylko managed, tylko tam, gdzie włączona. Według dokumentacji domyślnie jest.' }
    ],
    mistakes: [
      'Mylenie ról: OPTIMIZE nie zwalnia miejsca, a VACUUM nie służy do przyspieszania zapytań.',
      'Zakładanie, że predictive optimization działa na każdej tabeli. Dotyczy tylko managed i da się ją wyłączyć.',
      'Skracanie retencji poniżej 7 dni bez świadomości skutków.',
      'Pominięcie wpływu VACUUM na time travel.'
    ]
  },
  {
    id: 'delta-liquid-clustering',
    topicId: 'delta.liquid-clustering',
    area: 'delta-lake',
    priority: 'P0',
    title: 'Liquid clustering',
    question: {
      pl: 'Co to jest liquid clustering i czym różni się od partycjonowania i Z-order?',
      en: 'What is liquid clustering and how does it differ from partitioning and Z-ordering?'
    },
    answer: {
      pl: 'Wszystkie trzy służą do data skipping, czyli trzymania podobnych wierszy w tych samych plikach, żeby zapytania czytały mniej. Partycjonowanie dzieli tabelę na katalogi. Sprawdza się przy małej liczbie wartości, ale przy dużej robi masę drobnych plików, a kolumny nie zmienię bez przepisania tabeli. Z-order układa dane po kilku kolumnach, ale tylko wtedy, gdy uruchomię OPTIMIZE ZORDER BY, a kolumny podaję w poleceniu, nie w definicji tabeli. Liquid clustering zastępuje jedno i drugie: deklaruję klucze przez CLUSTER BY, działa na kolumnach o dużej kardynalności, układa dane przyrostowo, a klucze mogę zmienić bez przepisywania istniejących danych. Databricks zaleca go dla nowych tabel.',
      en: 'All three are about data skipping: keeping similar rows in the same files so queries read less. Partitioning splits the table into directories. It works for a small number of values, but with many values it creates lots of tiny files, and I cannot change the column without rewriting the table. Z-ordering co-locates data by several columns, but only when I run OPTIMIZE ZORDER BY, and the columns live in that command, not in the table definition. Liquid clustering replaces both: I declare keys with CLUSTER BY, it works on high-cardinality columns, it clusters incrementally, and I can change the keys without rewriting existing data. Databricks recommends it for new tables.'
    },
    explain: [
      'Cel jest wspólny: żeby zapytanie z filtrem otwierało mało plików. Delta trzyma dla każdego pliku najmniejszą i największą wartość kolumn, więc może pominąć pliki, w których szukanej wartości na pewno nie ma. To data skipping. Działa tylko wtedy, gdy podobne wartości leżą razem, a nie są rozsiane po wszystkich plikach.',
      'Partycjonowanie układa dane w katalogi po wartości kolumny. Świetne dla daty, fatalne dla identyfikatora użytkownika: powstaje ogromna liczba katalogów z drobnymi plikami. Z-order układa dane wewnątrz plików po kilku kolumnach, przy poleceniu OPTIMIZE ZORDER BY. Liquid clustering to deklaracja CLUSTER BY na tabeli: klucze można zmienić, a układanie odbywa się przyrostowo przy OPTIMIZE.',
      'Uwaga na popularne uproszczenie „Z-order nie jest przyrostowy". Dokumentacja Databricks mówi, że Z-ordering nie jest idempotentny, ale ma działać przyrostowo. Bezpieczniej mówić o tym, co różni go naprawdę: klucze podawane w poleceniu, brak możliwości połączenia z liquid clustering i to, że dla nowych tabel Databricks zaleca liquid clustering.',
      'W Snowflake odpowiednikiem jest clustering key z automatycznym reclusteringiem i pruning mikropartycji. Różnica: tam układaniem zajmuje się usługa w tle. W Delcie wykonuje je OPTIMIZE, uruchamiany przez Twój job albo przez predictive optimization.'
    ],
    keywords: ['CLUSTER BY', 'data skipping', 'high cardinality', 'ZORDER', 'CLUSTER BY AUTO'],
    followUps: [
      { q: 'Can you combine it with partitioning or Z-order?', a: 'No. Liquid clustering is not compatible with either on the same table.', pl: 'Jedno albo drugie.' },
      { q: 'You changed the clustering keys. What happens to old data?', a: 'It keeps the old layout until I force a rewrite with OPTIMIZE FULL.', pl: 'Nowe klucze działają dla nowych zapisów.' },
      { q: 'How do you choose the keys?', a: 'From the columns most often used in filters and joins. For a table I MERGE into, the merge key.', pl: 'Filtry, joiny, klucz merge\'a.' }
    ],
    mistakes: [
      'Twierdzenie, że to „nowe partycjonowanie". Nie tworzy katalogów.',
      'Mówienie, że Z-order „nie jest przyrostowy". Dokumentacja opisuje go jako nieidempotentny, ale działający przyrostowo.',
      'Brak odpowiedzi, co dzieje się ze starymi danymi po zmianie kluczy.',
      'Nieumiejętność powiedzenia, kiedy partycjonowanie nadal ma sens.'
    ]
  },
  {
    id: 'delta-change-data-feed',
    topicId: 'delta.change-data-feed',
    area: 'delta-lake',
    priority: 'P0',
    title: 'Change Data Feed',
    question: {
      pl: 'Co to jest Change Data Feed i kiedy go używasz?',
      en: 'What is Change Data Feed and when would you use it?'
    },
    answer: {
      pl: 'Change Data Feed udostępnia zmiany w tabeli Delta na poziomie wiersza: inserty, delete\'y oraz stan przed i po update\'cie, razem z wersją i czasem commitu. W klasycznej wersji włączam go właściwością tabeli, a zmiany czytam funkcją table_changes albo opcją readChangeFeed, batchowo lub jako stream. Używam go do przyrostowego przenoszenia zmian między warstwami: job czyta tylko to, co zmieniło się od ostatnio przetworzonej wersji, i robi z tego MERGE. Trzeba pamiętać, że łapie zmiany dopiero od włączenia, a dane zmian podlegają retencji tabeli.',
      en: 'Change Data Feed exposes row-level changes in a Delta table: inserts, deletes, and the before and after image of updates, together with the commit version and timestamp. In the classic version I enable it with a table property and read changes with table_changes or the readChangeFeed option, in batch or as a stream. I use it to propagate changes between layers incrementally: the job reads only what changed since the last processed version and merges that. Two things to remember: it only captures changes made after it was enabled, and change data follows the table retention.'
    },
    senior: {
      pl: 'Databricks opisuje też automatic change data feed, liczony przy odczycie zamiast przy zapisie, bez konfiguracji per tabela. Według dokumentacji wymaga Databricks Runtime 19 lub nowszego i tabeli w Unity Catalog z row tracking. Najbliższy odpowiednik w Snowflake to Stream, z tą różnicą, że tu konsument sam pamięta ostatnią przetworzoną wersję.',
      en: 'Databricks also documents an automatic change data feed, computed at query time rather than at write time, with no per-table configuration. According to the docs it needs Databricks Runtime 19 or above and a Unity Catalog table with row tracking. The closest Snowflake counterpart is a Stream, except that here the consumer tracks the last processed version itself.'
    },
    explain: [
      'Tabela Delta pamięta wersje, ale wersja to cały stan tabeli. Żeby dowiedzieć się, które wiersze zmieniły się między wersją 10 a 12, trzeba by porównać dwa pełne stany. Change Data Feed podaje tę różnicę wprost: listę zmienionych wierszy z oznaczeniem insert, delete, update_preimage (stan przed zmianą) i update_postimage (stan po).',
      'Typowe użycie: job między warstwami czyta tylko zmiany od ostatnio przetworzonej wersji i robi z nich MERGE. Stan sprzed zmiany przydaje się do korekty agregatów: odejmujesz starą wartość, dodajesz nową.',
      'W Snowflake podobną rolę pełni Stream na tabeli. Różnica jest w tym, kto pamięta postęp. Stream sam przesuwa swój offset, gdy użyjesz go w transakcji DML. Przy CDF pamięta konsument: checkpoint streamu albo Twoja tabela kontrolna z numerem wersji.',
      'Zakres: klasyczny CDF włącza się właściwością tabeli i rejestruje zmiany dopiero od tego momentu. Pliki zmian podlegają retencji tabeli, więc VACUUM je usuwa. Nie przeczytasz też zmian z zakresu, w którym kolumnę przemianowano lub usunięto.'
    ],
    keywords: ['CDF', 'table_changes', 'readChangeFeed', '_change_type', 'update_preimage', 'incremental'],
    followUps: [
      { q: 'Which columns does it add?', a: '_change_type, with insert, update_preimage, update_postimage and delete, plus _commit_version and _commit_timestamp.', pl: 'Typ zmiany, wersja, czas.' },
      { q: 'Why would you need update_preimage?', a: 'To know what to subtract from an aggregate before adding the new value.', pl: 'Do poprawiania agregatów.' },
      { q: 'How is it different from time travel?', a: 'Time travel returns the whole table at a version. CDF returns only the changes between versions.', pl: 'Stan kontra różnica.' }
    ],
    mistakes: [
      'Mylenie CDF z CDC ze źródła. CDF to zmiany w samej tabeli Delta.',
      'Założenie, że historia zmian jest dostępna wstecz od zawsze.',
      'Pominięcie retencji.'
    ]
  },
  {
    id: 'delta-medallion',
    topicId: 'delta.medallion',
    area: 'delta-lake',
    priority: 'P0',
    title: 'Architektura medallion',
    question: {
      pl: 'Na czym polega architektura medallion? Co trafia do której warstwy?',
      en: 'Explain the medallion architecture. What belongs in each layer?'
    },
    answer: {
      pl: 'To konwencja warstw. Bronze trzyma surowe dane tak, jak przyszły, z metadanymi załadowania, żeby dało się przetworzyć je od nowa tak długo, jak są przechowywane. Silver to dane oczyszczone i ujednolicone: zdeduplikowane, z typami, zwalidowane, z kluczami biznesowymi. Gold to dane pod konsumpcję: agregaty, model wymiarowy, tabele cech. Wartość nie jest w trzech nazwach, tylko w kontrakcie: każda warstwa ma jasny poziom jakości, surowe dane są zachowane, a zmianę logiki da się przeliczyć od bronze w granicach jego retencji. Warstw nie musi być dokładnie trzy, a gold nadal powinien być porządnie zamodelowany.',
      en: 'It is a layering convention. Bronze holds raw data as it arrived, with ingestion metadata, so it can be reprocessed for as long as it is retained. Silver is cleaned and conformed data: deduplicated, typed, validated, with business keys. Gold is data shaped for consumption: aggregates, a dimensional model, feature tables. The value is not in the three names but in the contract: each layer has a clear quality level, raw data is kept, and a logic change can be recomputed from bronze within its retention. There do not have to be exactly three layers, and gold should still be properly modeled.'
    },
    explain: [
      'To odpowiedź na pytanie: co zrobić, żeby błąd w transformacji nie oznaczał utraty danych. Bronze trzyma dane tak, jak przyszły ze źródła, bez poprawiania. Silver to te same dane po sprzątaniu: typy, deduplikacja, walidacja. Gold to tabele pod konkretne użycie: agregaty, model wymiarowy.',
      'Możliwość przeliczenia od bronze nie jest dana raz na zawsze. Zależy od tego, jak długo trzymasz surowe dane: od retencji w źródle, od polityki kasowania starych danych w bronze i od VACUUM, jeśli chcesz wracać do starszych wersji tabeli. Jeśli bronze sięga 30 dni wstecz, to tyle da się przeliczyć.',
      'Most do dbt: źródła i staging leżą na granicy bronze i silver, modele intermediate to silver, marts to gold. To analogia, nie mapowanie jeden do jednego. Staging w dbt to zwykle lekki widok nad źródłem, który niczego nie przechowuje. Bronze to fizyczna, trwała kopia surowych danych. Podział w dbt opisuje też etapy transformacji, a medallion poziomy jakości danych.'
    ],
    keywords: ['bronze', 'silver', 'gold', 'replay', 'data quality', 'star schema'],
    followUps: [
      { q: 'Where do you run data quality checks?', a: 'On the way into silver. Bad records go to quarantine instead of disappearing.', pl: 'Na wejściu do silver.' },
      { q: 'How do you move changes between layers?', a: 'Incrementally: a stream from bronze, or Change Data Feed from silver plus a MERGE.', pl: 'Stream albo CDF + MERGE.' },
      { q: 'How does this map to a dbt project?', a: 'Roughly: sources and staging sit at the bronze-to-silver boundary, intermediate models are silver, and marts are gold. It is an analogy, not a one-to-one mapping. dbt staging is usually a thin view, while bronze is a physical copy of the raw data.', pl: 'Analogia, nie mapowanie jeden do jednego.' },
      { q: 'Can you always replay from bronze?', a: 'Only as far back as bronze goes. Replay depends on how long the raw data is retained, so retention is a design decision, not a default.', pl: 'Replay jest tak dobry, jak retencja bronze.' }
    ],
    mistakes: [
      'Recytowanie trzech nazw bez powiedzenia, po co są.',
      'Traktowanie gold jako zbioru szerokich tabel bez modelu.',
      'Kopiowanie danych między warstwami bez dodanej wartości.',
      'Obiecywanie, że z bronze „zawsze" da się wszystko odtworzyć, bez słowa o retencji.'
    ]
  },
  {
    id: 'delta-concurrent-writes',
    topicId: 'delta.concurrency',
    area: 'delta-lake',
    priority: 'P1',
    title: 'Równoległe zapisy i konflikty',
    question: {
      pl: 'Dwa joby piszą jednocześnie do tej samej tabeli Delta. Co się dzieje?',
      en: 'Two jobs write to the same Delta table at the same time. What happens?'
    },
    answer: {
      pl: 'Delta używa optimistic concurrency control. Każdy piszący czyta jakąś wersję tabeli, zapisuje swoje nowe pliki danych, a na końcu próbuje dodać kolejny wpis do logu. Dany plik commitu może utworzyć tylko jeden z nich, więc drugi musi sprawdzić, co zmienił pierwszy. Jeśli zmiany się nie nakładają, na przykład przy dwóch appendach, po prostu commituje się jako następna wersja. Jeśli pierwszy usunął albo przepisał pliki, które drugi przeczytał, drugi dostaje wyjątek konfliktu i musi ponowić operację. Nic nie zostaje zapisane w połowie, bo pliki bez commitu nie należą do tabeli. Czytający nie są blokowani, korzystają ze snapshot isolation. Żeby ograniczyć konflikty, pilnuję, by joby dotykały rozłącznych danych, a na Databricks row-level concurrency rozstrzyga zmiany różnych wierszy w tym samym pliku.',
      en: "Delta uses optimistic concurrency control. Each writer reads a table version, writes its new data files, and then tries to commit the next log entry. Only one writer can create a given commit file, so the second one has to check what the first changed. If the changes don't overlap, for example two appends, it simply commits as the following version. If the first writer removed or rewrote files the second one read, the second fails with a concurrent modification exception and has to retry. Nothing is half-written, because uncommitted files are never part of the table. Readers aren't blocked at all: they use snapshot isolation. To reduce conflicts I keep writers on disjoint data, and on Databricks row-level concurrency resolves updates to different rows in the same file."
    },
    senior: {
      pl: 'Domyślny poziom izolacji zapisu na Databricks to WriteSerializable, mocniejszy to Serializable. OPTIMIZE też jest piszącym: bez deletion vectors może wejść w konflikt z UPDATE i MERGE, więc nie puszczam kompaktowania w środku okna ładowania. Row-level concurrency wymaga deletion vectors i tabeli bez partycji.',
      en: 'The default write isolation level on Databricks is WriteSerializable, and Serializable is the stricter one. OPTIMIZE is a writer too: without deletion vectors it can conflict with UPDATE and MERGE, so I do not run compaction in the middle of a load window. Row-level concurrency needs deletion vectors and an unpartitioned table.'
    },
    explain: [
      'W hurtowni równoległe zapisy porządkuje serwer: blokadami albo kolejką transakcji. Tabela Delta to pliki w <term id="object-storage">object storage</term>, więc nie ma serwera, który mógłby trzymać blokadę. Zamiast tego każdy piszący pracuje tak, jakby był sam, a kolizję sprawdza się na końcu. To optimistic concurrency control: zakładamy, że konflikty są rzadkie.',
      'Dokumentacja Delta Lake opisuje trzy etapy. Odczyt: piszący czyta najnowszą wersję i zapamiętuje, które pliki przeczytał. Zapis: tworzy nowe pliki danych, których jeszcze nikt nie widzi. Walidacja i commit: sprawdza, czy to, co przeczytał, nie zostało w międzyczasie zmienione przez kogoś innego. Jeśli nie, zapisuje commit. Jeśli tak, kończy się wyjątkiem.',
      'Kluczowe jest pytanie „co przeczytałem”. Dwa appendy niczego nie czytają, więc nie mogą się pogryźć. Dwa UPDATE na tym samym pliku tak: drugi policzył wynik na pliku, którego już nie ma na liście. Na Databricks tabele z deletion vectors i bez partycji mają row-level concurrency (od Databricks Runtime 14.3 LTS): konflikt jest wtedy tylko przy zmianie tego samego wiersza.',
      'Przegrany dostaje błąd, a nie zepsutą tabelę. Jego pliki zostają w katalogu jako osierocone i kiedyś usunie je VACUUM. Ponowienie to zwykle po prostu ponowne uruchomienie operacji, która przeczyta już nową wersję.'
    ],
    keywords: ['optimistic concurrency control', 'WriteSerializable', 'snapshot isolation', 'ConcurrentAppendException', 'row-level concurrency', 'deletion vectors'],
    followUps: [
      { q: 'Can two appends conflict?', a: 'No. Appends only add files and do not depend on existing ones, so both commit, one after the other.', pl: 'INSERT + INSERT nie może wejść w konflikt.' },
      { q: 'How would you reduce conflicts between two jobs that update the same table?', a: 'Make them touch disjoint data and say so in the condition, for example an explicit predicate on the partition or clustering column. On Databricks I would also check whether the table qualifies for row-level concurrency.', pl: 'Rozłączne pliki i jawny warunek. Albo row-level concurrency.' },
      { q: 'Does a long-running reader block writers, or the other way round?', a: 'Neither. A reader works on the snapshot it started with. The one thing that can break it is VACUUM with a retention shorter than the query takes.', pl: 'Snapshot isolation. Ryzykiem jest tylko zbyt krótka retencja VACUUM.' },
      { q: 'What is the difference between WriteSerializable and Serializable?', a: 'WriteSerializable is the default and allows some interleavings, for example an insert committing while an update is in flight. Serializable is stricter: in that case the update fails and has to be retried.', pl: 'Domyślny jest słabszy. Przy Serializable przegrywa UPDATE, nie INSERT.' }
    ],
    mistakes: [
      'Twierdzenie, że Delta blokuje tabelę na czas zapisu. Nie ma blokad, jest walidacja przy commicie.',
      'Mówienie, że równoległe zapisy do jednej tabeli są niemożliwe albo zawsze kończą się konfliktem.',
      'Pominięcie tego, że OPTIMIZE też jest piszącym i może wywrócić trwający MERGE.',
      'Obiecywanie row-level concurrency na każdej tabeli. Wymaga deletion vectors i braku partycjonowania.'
    ]
  }
];

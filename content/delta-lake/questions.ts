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
      pl: 'Delta Lake to format tabel: pliki Parquet plus log transakcyjny w katalogu _delta_log. Object storage nie ma transakcji, więc daje je log. Każdy commit to jeden wpis w logu: lista plików dodanych i usuniętych oraz metadane. Czytelnik składa stan tabeli z logu, więc nigdy nie widzi zapisu w połowie. To daje atomowość i snapshot isolation. Piszący korzystają z optimistic concurrency. Zapisują nowe pliki, a potem próbują dodać kolejny wpis do logu. Przy konflikcie ponawiają albo dostają błąd. Pliki danych są niezmienne, więc update zapisuje nowe pliki i oznacza stare jako usunięte. Z tego samego mechanizmu wynikają time travel, pilnowanie schematu i MERGE.',
      en: 'Delta Lake is a table format: Parquet files plus a transaction log in the _delta_log directory. Object storage has no transactions, so the log provides them. Each commit is one log entry. It lists the files added and removed, plus metadata. A reader builds the table state from the log, so it never sees a half-finished write. That gives atomicity and snapshot isolation. Writers use optimistic concurrency. They write new files and then try to add the next log entry. On a conflict they retry or fail. Data files are immutable, so an update writes new files and marks the old ones as removed. The same mechanism gives you time travel, schema enforcement and MERGE.'
    },
    explain: [
      'Object storage, np. S3, nie ma transakcji. Jeśli job zapisze 50 ze 100 plików i padnie, czytelnik (zapytanie, które czyta tabelę) zobaczy połowę danych. Delta rozwiązuje to listą. Tabela to pliki Parquet plus katalog <code>_delta_log</code>. Każdy commit, czyli zatwierdzona zmiana, jest w nim osobnym, numerowanym plikiem z informacją: te pliki dodano, te usunięto.',
      'Czytelnik nie zgaduje po zawartości katalogu. Czyta log i bierze dokładnie te pliki, które log wymienia. Plik, którego nie ma w logu, dla niego nie istnieje. Commit to pojawienie się jednego pliku logu, więc albo jest cały, albo go nie ma. Stąd atomowość, czyli zapis „wszystko albo nic".',
      'A gdy piszących jest dwóch? Każdy próbuje zapisać commit o kolejnym numerze. Wygrywa pierwszy. Drugi sprawdza, czy zmiany sobie przeszkadzają, i albo ponawia, albo zgłasza konflikt. To optimistic concurrency: zakładamy, że konfliktów jest mało, i sprawdzamy dopiero na końcu.',
      'Doprecyzowanie do „update zapisuje nowe pliki": pliki Parquet są niezmienne, ale przy włączonych deletion vectors zmiana lub usunięcie wiersza nie przepisuje całego pliku. Delta zapisuje obok znacznik, że ten wiersz już nie obowiązuje, a czytelnik uwzględnia go przy odczycie.'
    ],
    keywords: ['_delta_log', 'optimistic concurrency', 'snapshot isolation', 'time travel', 'schema enforcement'],
    followUps: [
      { q: 'What happens when two jobs write at the same time?', a: 'It depends on what they touch. Two plain appends that don’t read the table both succeed. If both rewrite the same files, the second commit detects the conflict. It has to retry, or it fails.', pl: 'Konflikt wykrywany przy commicie.' },
      { q: 'How far back can you time travel?', a: 'Only as long as both the log entries and the data files of that version still exist. By default deleted files are kept for seven days and the log for thirty. Recent Databricks runtimes block queries older than the file retention.', pl: 'Ogranicza to VACUUM i retencja logu.' },
      { q: 'How is Delta different from plain Parquet?', a: 'Parquet is only a file format. Delta adds transactions, version history and file-level statistics for data skipping.', pl: 'Parquet to format pliku, Delta to tabela.' },
      { q: 'Does an update always rewrite the whole file?', a: 'Not with deletion vectors. Without them, changing one row means rewriting the whole Parquet file that holds it. With them, Delta marks the row as removed in a separate file, and readers apply that mark when they read.', pl: 'Pliki są niezmienne, ale deletion vectors oszczędzają przepisywania.' }
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
      pl: 'MERGE łączy źródło z tabelą docelową po kluczu. Potem w jednym atomowym commicie wstawia, zmienia i usuwa wiersze. Ładowanie jest idempotentne, gdy mogę je uruchomić dwa razy i dostać tę samą tabelę. Pilnuję do tego trzech rzeczy. Po pierwsze stały klucz biznesowy w ON, żeby powtórka zmieniała te same wiersze. Po drugie deduplikacja źródła w ramach paczki. MERGE kończy się błędem, gdy kilka wierszy źródła próbuje zmienić ten sam wiersz celu. A dwa wiersze z tym samym nowym kluczem wstawiłyby się oba. Po trzecie warunek, żeby starsze dane nie nadpisały nowszych: update tylko wtedy, gdy timestamp źródła jest nowszy. Wtedy ponowne uruchomienie paczki zostawia tabelę w tym samym stanie.',
      en: 'MERGE joins a source to a target table on a key. Then, in one atomic commit, it inserts, updates and deletes rows. A load is idempotent when I can run it twice and get the same table. For that I take care of three things. First, a stable business key in the ON clause, so a re-run updates the same rows. Second, I deduplicate the source within the batch. MERGE fails when several source rows try to change the same target row. And two source rows with the same new key would both be inserted. Third, a condition so that older data never overwrites newer data: update only when the source timestamp is newer. With that, re-running a batch leaves the table in the same state.'
    },
    senior: {
      pl: 'Pod spodem MERGE to join, więc trzymam tabelę sklastrowaną po kluczu merge\'a. Dodatkowy warunek w ON, np. na datę, dokładam tylko wtedy, gdy ta kolumna jest częścią klucza i nigdy się nie zmienia. Inaczej wiersz, który pasuje po kluczu, ale leży poza zakresem, nie zostanie dopasowany i MERGE wstawi duplikat.',
      en: 'Under the hood MERGE is a join, so I keep the table clustered by the merge key. I add an extra condition to ON, for example on a date, only when that column is part of the key and never changes. Otherwise a row that matches on the key but sits outside the range isn’t matched, and MERGE inserts a duplicate.'
    },
    explain: [
      'Joby padają w połowie i są ponawiane. Ta sama paczka może więc trafić do tabeli dwa razy. Ładowanie, które można bezpiecznie powtórzyć, nazywa się idempotentne: druga próba tej samej paczki zostawia tabelę w tym samym stanie.',
      'MERGE dopasowuje wiersze źródła do celu po warunku ON i dla każdej pary decyduje: update, delete albo insert. Idempotencję psują trzy rzeczy. Pierwsza to klucz, który nie jest stały: powtórka wstawi nowy wiersz, zamiast zaktualizować stary. Druga to duplikaty w źródle. Gdy dwa wiersze źródła pasują do jednego wiersza celu i oba chcą go zmienić, Delta nie wie, który ma wygrać, i MERGE kończy się błędem. Trzecia to brak warunku na kolejność: spóźniona, starsza wersja wiersza nadpisze nowszą.',
      'W dbt to samo robi model incremental ze strategią merge i <code>unique_key</code>. Analogia kończy się na tym, że dbt generuje MERGE za Ciebie, a deduplikację paczki i warunek kolejności i tak musisz napisać sam, w dbt czy poza nim.'
    ],
    keywords: ['MERGE', 'idempotency', 'business key', 'deduplication', 'late data', 'replaceWhere'],
    followUps: [
      { q: 'What other ways are there to get idempotency?', a: 'One way is to overwrite a slice of the table with replaceWhere. In streaming, it’s foreachBatch with a MERGE inside. foreachBatch alone is at-least-once, so the MERGE is what makes a replayed batch harmless.', pl: 'Nadpisanie wycinka albo foreachBatch + MERGE.' },
      { q: 'How do you handle deletes?', a: 'With a WHEN MATCHED clause on a delete flag. I use WHEN NOT MATCHED BY SOURCE only when the source is a complete, trusted snapshot, or with a condition that limits it to the slice the source fully covers. Never with an ordinary partial CDC batch: it would delete every row that simply did not change.', pl: 'Flaga usunięcia. NOT MATCHED BY SOURCE tylko przy pełnym obrazie albo zawężonym zakresie.' },
      { q: 'Why can MERGE be slow?', a: 'Because it’s a join plus a rewrite. With a poor file layout it has to scan and rewrite a large part of the target table.', pl: 'Układ plików po kluczu merge\'a.' }
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
      pl: 'To dwa różne problemy. OPTIMIZE bierze dużo małych plików i przepisuje je w mniej dużych. Jeśli tabela ma clustering, przy okazji układa dane. Dane się nie zmieniają, tylko układ, a tabela dostaje nową wersję. VACUUM fizycznie kasuje pliki, do których aktualna wersja już się nie odwołuje i które są starsze niż próg retencji, domyślnie 7 dni. Dopiero to zwalnia miejsce. Ryzyko jest takie, że po VACUUM nie cofnę się dalej niż okno retencji. A przy zbyt krótkiej retencji mogę skasować pliki, których potrzebuje jeszcze długie zapytanie. Na tabelach managed w Unity Catalog obie operacje może wykonywać predictive optimization, o ile jest włączona dla danego konta, katalogu lub schematu.',
      en: 'They solve two different problems. OPTIMIZE takes many small files and rewrites them into fewer large ones. If the table uses clustering, it also applies that layout. The data doesn’t change, only the layout, and the table gets a new version. VACUUM physically deletes files that the current version no longer references and that are older than the retention threshold, seven days by default. Only that frees storage. The risk is that after VACUUM I can’t time travel beyond the retention window. And with a retention that’s too short, I can delete files a long-running query still needs. On Unity Catalog managed tables, predictive optimization can run both for me, as long as it’s enabled for that account, catalog or schema.'
    },
    explain: [
      'To dwa różne problemy. Pierwszy: częste małe zapisy zostawiają tysiące drobnych plików, a każdy plik trzeba osobno otworzyć i przeczytać. OPTIMIZE przepisuje je w mniejszą liczbę większych plików. Dane się nie zmieniają, ale powstaje nowa wersja tabeli, a stare pliki zostają na dysku.',
      'Drugi problem to właśnie te stare pliki. Delta sama ich nie kasuje, bo są potrzebne do time travel (odczytu wcześniejszych wersji) i trwającym zapytaniom. VACUUM fizycznie usuwa pliki, których aktualna wersja już nie używa i które są starsze niż retencja, czyli czas przechowywania, domyślnie 7 dni. Po nim nie cofniesz się do wersji, której pliki zniknęły.',
      'Predictive optimization uruchamia te operacje sama, ale nie wszędzie. Według dokumentacji Databricks działa tylko na tabelach managed w Unity Catalog, jest domyślnie włączona, a konto, katalog albo schemat mogą ją wyłączyć. Wymaga też obsługiwanego regionu i odpowiedniego planu. Nie stosuje Z-order i nie obejmuje tabel external, więc tam dalej planujesz własne joby.',
      'W Snowflake nie ma odpowiednika tych poleceń, bo układem plików i retencją (Time Travel, Fail-safe) zarządza usługa. To dobre miejsce, żeby na rozmowie pokazać, że rozumiesz różnicę: w Delcie pliki są Twoje, więc i sprzątanie bywa Twoje.'
    ],
    keywords: ['OPTIMIZE', 'VACUUM', 'small files', 'retention', '7 days', 'predictive optimization'],
    followUps: [
      { q: 'Does OPTIMIZE block readers?', a: 'No. Readers use snapshot isolation, so each query keeps reading the version it started with. And the query result is the same before and after.', pl: 'Czytający nie są blokowani.' },
      { q: 'Where do small files come from?', a: 'From frequent small writes: streaming, and MERGE operations that run often.', pl: 'Streaming i częste MERGE.' },
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
      pl: 'Wszystkie trzy służą do data skipping: podobne wiersze mają leżeć w tych samych plikach, żeby zapytania czytały mniej. Partycjonowanie dzieli tabelę na katalogi. Sprawdza się przy kolumnie o małej liczbie wartości. Przy dużej robi masę drobnych plików, a kolumny nie zmienię bez przepisania tabeli. Z-order układa dane po kilku kolumnach, ale tylko wtedy, gdy uruchomię OPTIMIZE ZORDER BY. Kolumny podaję w tym poleceniu, a nie w definicji tabeli. Liquid clustering zastępuje jedno i drugie. Klucze deklaruję przez CLUSTER BY na tabeli. Działa na kolumnach o dużej kardynalności, czyli z wieloma różnymi wartościami. Układa dane przyrostowo, a klucze mogę zmienić bez przepisywania istniejących danych. Databricks zaleca go dla nowych tabel.',
      en: 'All three serve data skipping: keep similar rows in the same files, so queries read less. Partitioning splits the table into directories. It works for a column with few values. With many values it creates lots of tiny files, and I can’t change the column without rewriting the table. Z-ordering co-locates data by several columns, but only when I run OPTIMIZE ZORDER BY. The columns live in that command, not in the table definition. Liquid clustering replaces both. I declare the keys with CLUSTER BY on the table. It works on high-cardinality columns, meaning columns with many distinct values. It clusters incrementally, and I can change the keys without rewriting existing data. Databricks recommends it for new tables.'
    },
    explain: [
      'Cel jest wspólny: zapytanie z filtrem ma otwierać mało plików. Delta trzyma dla każdego pliku najmniejszą i największą wartość kolumn. Może więc pominąć pliki, w których szukanej wartości na pewno nie ma. To data skipping. Pomaga tylko wtedy, gdy podobne wartości leżą razem, a nie są rozsiane po wszystkich plikach.',
      'Partycjonowanie układa dane w katalogi po wartości kolumny. Świetne dla daty, fatalne dla identyfikatora użytkownika: powstaje ogromna liczba katalogów z drobnymi plikami. Z-order układa dane wewnątrz plików po kilku kolumnach, przy poleceniu OPTIMIZE ZORDER BY. Liquid clustering to deklaracja CLUSTER BY na tabeli: klucze można zmienić, a układanie odbywa się przyrostowo przy OPTIMIZE.',
      'Uwaga na popularne uproszczenie „Z-order nie jest przyrostowy". Dokumentacja Databricks mówi, że Z-ordering nie jest idempotentny, ale ma działać przyrostowo. Bezpieczniej mówić o tym, co różni go naprawdę: klucze podawane w poleceniu, brak możliwości połączenia z liquid clustering i to, że dla nowych tabel Databricks zaleca liquid clustering.',
      'W Snowflake odpowiednikiem jest clustering key z automatycznym reclusteringiem i pruning mikropartycji. Różnica: tam układaniem zajmuje się usługa w tle. W Delcie wykonuje je OPTIMIZE, uruchamiany przez Twój job albo przez predictive optimization.'
    ],
    keywords: ['CLUSTER BY', 'data skipping', 'high cardinality', 'ZORDER', 'CLUSTER BY AUTO'],
    followUps: [
      { q: 'Can you combine it with partitioning or Z-order?', a: 'No. Liquid clustering is not compatible with either on the same table.', pl: 'Jedno albo drugie.' },
      { q: 'You changed the clustering keys. What happens to old data?', a: 'Nothing right away. Old data keeps the old layout until I force a rewrite with OPTIMIZE FULL.', pl: 'Nowe klucze działają dla nowych zapisów.' },
      { q: 'How do you choose the keys?', a: 'I pick the columns most often used in filters and joins. For a table I MERGE into, I add the merge key.', pl: 'Filtry, joiny, klucz merge\'a.' }
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
      pl: 'Change Data Feed podaje zmiany w tabeli Delta na poziomie wiersza, a nie całą tabelę. Dostaję inserty, delete\'y, a dla update\'ów wiersz przed zmianą i po niej, razem z wersją i czasem commitu. W klasycznej wersji włączam go właściwością tabeli. Zmiany czytam funkcją table_changes albo opcją readChangeFeed, batchowo lub jako stream. Używam go do przyrostowego przenoszenia zmian między warstwami. Job czyta tylko to, co zmieniło się od ostatnio przetworzonej wersji, i robi z tego MERGE do swojej tabeli. Trzeba pamiętać o dwóch rzeczach. Łapie zmiany dopiero od włączenia. A dane zmian podlegają retencji tabeli.',
      en: 'Change Data Feed gives me the row-level changes in a Delta table, not the whole table. I get inserts, deletes, and for updates the row before and after the change, together with the commit version and timestamp. In the classic version I enable it with a table property. Then I read changes with table_changes or the readChangeFeed option, in batch or as a stream. I use it to move changes between layers incrementally. The job reads only what changed since the last version it processed, and merges that into its table. Two things to remember. It captures changes only from the moment it was enabled. And the change data follows the table retention.'
    },
    senior: {
      pl: 'Databricks opisuje też automatic change data feed. Jest liczony przy odczycie, a nie przy zapisie, i nie wymaga konfiguracji per tabela. Według dokumentacji potrzebuje Databricks Runtime 19 lub nowszego i tabeli w Unity Catalog z row tracking. Najbliższy odpowiednik w Snowflake to Stream. Różnica jest taka, że tu konsument sam pamięta ostatnią przetworzoną wersję.',
      en: 'Databricks also documents an automatic change data feed. It’s computed at read time, not at write time, and needs no per-table configuration. According to the docs it needs Databricks Runtime 19 or above and a Unity Catalog table with row tracking. The closest thing in Snowflake is a Stream. The difference is that here the consumer has to remember the last version it processed.'
    },
    explain: [
      'Tabela Delta pamięta wersje, ale wersja to cała tabela w danym momencie. Żeby dowiedzieć się, które wiersze zmieniły się między wersją 10 a 12, trzeba by porównać dwie pełne tabele. Change Data Feed podaje tę różnicę wprost: listę zmienionych wierszy z oznaczeniem insert, delete, update_preimage (stan przed zmianą) i update_postimage (stan po).',
      'Typowe użycie: job między warstwami czyta tylko zmiany od ostatnio przetworzonej wersji i robi z nich MERGE. Stan sprzed zmiany przydaje się do korekty agregatów: odejmujesz starą wartość, dodajesz nową.',
      'W Snowflake podobną rolę pełni Stream na tabeli. Różnica jest w tym, kto pamięta postęp. Stream sam przesuwa swój offset, gdy użyjesz go w transakcji DML. Przy CDF pamięta konsument: checkpoint streamu albo Twoja tabela kontrolna z numerem wersji.',
      'Zakres: klasyczny CDF włącza się właściwością tabeli i rejestruje zmiany dopiero od tego momentu. Pliki zmian podlegają retencji tabeli, więc VACUUM je usuwa. Nie przeczytasz też zmian z zakresu, w którym kolumnę przemianowano lub usunięto.'
    ],
    keywords: ['CDF', 'table_changes', 'readChangeFeed', '_change_type', 'update_preimage', 'incremental'],
    followUps: [
      { q: 'Which columns does it add?', a: '_change_type, with insert, update_preimage, update_postimage and delete, plus _commit_version and _commit_timestamp.', pl: 'Typ zmiany, wersja, czas.' },
      { q: 'Why would you need update_preimage?', a: 'To fix aggregates. It tells me the old value, so I know what to subtract before I add the new one.', pl: 'Do poprawiania agregatów.' },
      { q: 'How is it different from time travel?', a: 'Time travel returns the whole table as of one version. CDF returns only the rows that changed between versions.', pl: 'Stan kontra różnica.' }
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
      pl: 'To konwencja dzielenia danych na warstwy. Bronze trzyma surowe dane tak, jak przyszły, z metadanymi załadowania. Dzięki temu da się przetworzyć je od nowa tak długo, jak są przechowywane. Silver to te same dane oczyszczone i ujednolicone: zdeduplikowane, z typami, zwalidowane, z kluczami biznesowymi. Gold to dane przygotowane dla odbiorców: agregaty, model wymiarowy, tabele cech. Wartość nie leży w trzech nazwach, tylko w kontrakcie. Każda warstwa ma jasny poziom jakości, surowe dane są zachowane, a po zmianie logiki mogę przeliczyć wszystko od bronze, w granicach jego retencji. Warstw nie musi być dokładnie trzy. A gold nadal powinien być porządnie zamodelowany.',
      en: 'It’s a convention for splitting data into layers. Bronze holds raw data as it arrived, with ingestion metadata. That lets me reprocess it for as long as it’s retained. Silver is the same data cleaned and unified: deduplicated, typed, validated, with business keys. Gold is data shaped for its consumers: aggregates, a dimensional model, feature tables. The value isn’t in the three names. It’s in the contract. Each layer has a clear quality level, raw data is kept, and when the logic changes I can recompute from bronze, within its retention. There don’t have to be exactly three layers. And gold should still be properly modeled.'
    },
    explain: [
      'Zacznij od problemu: w transformacji był błąd i trzeba policzyć dane jeszcze raz. Da się to zrobić tylko wtedy, gdy surowe dane gdzieś zostały. Po to jest bronze: trzyma dane tak, jak przyszły ze źródła, bez poprawiania. Silver to te same dane po sprzątaniu: typy, deduplikacja, walidacja. Gold to tabele pod konkretne użycie: agregaty, model wymiarowy.',
      'Możliwość przeliczenia od bronze nie jest dana raz na zawsze. Zależy od tego, jak długo trzymasz surowe dane: od retencji w źródle, od polityki kasowania starych danych w bronze i od VACUUM, jeśli chcesz wracać do starszych wersji tabeli. Jeśli bronze sięga 30 dni wstecz, to tyle da się przeliczyć.',
      'Most do dbt: źródła i staging leżą na granicy bronze i silver, modele intermediate to silver, marts to gold. To analogia, nie mapowanie jeden do jednego. Staging w dbt to zwykle lekki widok nad źródłem, który niczego nie przechowuje. Bronze to fizyczna, trwała kopia surowych danych. Podział w dbt opisuje też etapy transformacji, a medallion poziomy jakości danych.'
    ],
    keywords: ['bronze', 'silver', 'gold', 'replay', 'data quality', 'star schema'],
    followUps: [
      { q: 'Where do you run data quality checks?', a: 'On the way into silver. Bad records go to a quarantine table, so they don’t just disappear.', pl: 'Na wejściu do silver.' },
      { q: 'How do you move changes between layers?', a: 'Incrementally: a stream from bronze, or Change Data Feed from silver plus a MERGE.', pl: 'Stream albo CDF + MERGE.' },
      { q: 'How does this map to a dbt project?', a: 'Roughly like this: sources and staging sit at the bronze-to-silver boundary, intermediate models are silver, and marts are gold. It’s an analogy, not a one-to-one mapping. dbt staging is usually a thin view, while bronze is a physical copy of the raw data.', pl: 'Analogia, nie mapowanie jeden do jednego.' },
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
      pl: 'To zależy od tego, czego dotykają. Delta nie zakłada blokad, tylko używa optimistic concurrency control. Każdy piszący czyta jakąś wersję tabeli, zapisuje swoje nowe pliki danych, a na końcu próbuje dodać kolejny wpis do logu. Dany plik commitu może utworzyć tylko jeden z nich, więc drugi musi sprawdzić, co zmienił pierwszy. Jeśli zmiany się nie nakładają, na przykład przy dwóch dopisaniach, które nie czytają tabeli, drugi commituje się jako następna wersja. Jeśli pierwszy usunął albo przepisał pliki, które drugi przeczytał, drugi dostaje wyjątek konfliktu i musi ponowić operację. Nic nie zostaje zapisane w połowie, bo pliki bez commitu nie należą do tabeli. Czytający nie są blokowani, korzystają ze snapshot isolation. Konfliktów jest mniej, gdy joby dotykają różnych danych.',
      en: 'It depends on what they touch. Delta doesn’t take locks. It uses optimistic concurrency control. Each writer reads a table version, writes its new data files, and then tries to add the next log entry. Only one writer can create a given commit file, so the second one has to check what the first changed. If the changes don’t overlap, for example two plain appends that don’t read the table, it commits as the next version. If the first writer removed or rewrote files the second one read, the second gets a conflict exception and has to retry. Nothing is half-written, because files without a commit aren’t part of the table. Readers aren’t blocked. They use snapshot isolation. I get fewer conflicts when the jobs touch separate data.'
    },
    senior: {
      pl: 'Domyślny poziom izolacji zapisu na Databricks to WriteSerializable, mocniejszy to Serializable. OPTIMIZE też jest piszącym. Bez deletion vectors może wejść w konflikt z UPDATE i MERGE, więc nie puszczam kompaktowania w środku okna ładowania. Row-level concurrency wymaga deletion vectors i tabeli bez partycji. Zmniejsza liczbę konfliktów, ale ich nie usuwa. Zmiana schematu albo właściwości tabeli w trakcie może wywrócić każdy równoległy zapis, także INSERT. A tabele z kolumnami identity nie obsługują równoległych transakcji.',
      en: 'The default write isolation level on Databricks is WriteSerializable, and Serializable is the stricter one. OPTIMIZE is a writer too. Without deletion vectors it can conflict with UPDATE and MERGE, so I don’t run compaction in the middle of a load window. Row-level concurrency needs deletion vectors and an unpartitioned table. It reduces conflicts, but it doesn’t remove them. A schema or table property change during the write can fail every concurrent write, including inserts. And tables with identity columns don’t support concurrent transactions.'
    },
    explain: [
      'W hurtowni równoległe zapisy porządkuje serwer: blokadami albo kolejką transakcji. Tabela Delta to pliki w <term id="object-storage">object storage</term>, więc nie ma serwera, który mógłby trzymać blokadę. Dlatego każdy piszący pracuje tak, jakby był sam, a kolizję sprawdza się dopiero na końcu. To optimistic concurrency control: zakładamy, że konflikty są rzadkie.',
      'Dokumentacja Delta Lake opisuje trzy etapy. Odczyt: piszący czyta najnowszą wersję i zapamiętuje, które pliki przeczytał. Zapis: tworzy nowe pliki danych, których jeszcze nikt nie widzi. Walidacja i commit: sprawdza, czy to, co przeczytał, nie zostało w międzyczasie zmienione przez kogoś innego. Jeśli nie, zapisuje commit. Jeśli tak, kończy się wyjątkiem.',
      'Kluczowe jest pytanie „co przeczytałem”. Dwa zwykłe dopisania (blind append) niczego nie czytają, więc nie wchodzą ze sobą w konflikt. INSERT z podzapytaniem do tej samej tabeli już czyta i podlega regułom MERGE. Dwa UPDATE na tym samym pliku wchodzą w konflikt: drugi policzył wynik na pliku, którego już nie ma na liście. Na Databricks tabele z deletion vectors i bez partycji mają row-level concurrency (od Databricks Runtime 14.3 LTS): konflikt zostaje wtedy przy zmianie tego samego wiersza, a przy złożonych warunkach wracają reguły na poziomie plików.',
      'Przegrany dostaje błąd, a nie zepsutą tabelę. Jego pliki zostają w katalogu, ale nie należą do tabeli, i kiedyś usunie je VACUUM. Ponowienie to zwykle po prostu ponowne uruchomienie operacji, która przeczyta już nową wersję.'
    ],
    keywords: ['optimistic concurrency control', 'WriteSerializable', 'snapshot isolation', 'ConcurrentAppendException', 'row-level concurrency', 'deletion vectors'],
    followUps: [
      { q: 'Can two appends conflict?', a: 'Plain appends that don’t read the table don’t conflict with each other. Both commit, one after the other. That changes if the insert reads the target table, if someone changes the schema or table properties at the same time, or if the table has an identity column.', pl: 'Blind append nie wchodzi w konflikt. Wyjątki: odczyt tabeli, zmiana metadanych, kolumna identity.' },
      { q: 'How would you reduce conflicts between two jobs that update the same table?', a: 'I’d make them touch separate data and say so in the condition, for example with an explicit filter on the partition or clustering column. On Databricks I’d also check whether the table qualifies for row-level concurrency.', pl: 'Rozłączne pliki i jawny warunek. Albo row-level concurrency.' },
      { q: 'Does a long-running reader block writers, or the other way round?', a: 'Neither. A reader works on the snapshot it started with. The one thing that can break it is VACUUM with a retention shorter than the query takes.', pl: 'Snapshot isolation. Ryzykiem jest tylko zbyt krótka retencja VACUUM.' },
      { q: 'What is the difference between WriteSerializable and Serializable?', a: 'WriteSerializable is the default. It lets some overlapping writes through, for example an insert that commits while an update is still running. Serializable is stricter: in that case the update fails and has to be retried.', pl: 'Domyślny jest słabszy. Przy Serializable przegrywa UPDATE, nie INSERT.' }
    ],
    mistakes: [
      'Twierdzenie, że Delta blokuje tabelę na czas zapisu. Nie ma blokad, jest walidacja przy commicie.',
      'Mówienie, że równoległe zapisy do jednej tabeli są niemożliwe albo zawsze kończą się konfliktem.',
      'Pominięcie tego, że OPTIMIZE też jest piszącym i może wywrócić trwający MERGE.',
      'Obiecywanie row-level concurrency na każdej tabeli. Wymaga deletion vectors i braku partycjonowania.',
      'Mówienie, że INSERT nigdy nie wchodzi w konflikt. Dotyczy to dopisań, które nie czytają tabeli, i nie obejmuje zmiany metadanych ani kolumn identity.'
    ]
  }
];

import type { Question } from '../types';

/** Pytania: Delta Lake. Zweryfikowane w dokumentacji Databricks (linki w docs/verified-facts.md). */
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
    keywords: ['_delta_log', 'optimistic concurrency', 'snapshot isolation', 'time travel', 'schema enforcement'],
    followUps: [
      { q: 'What happens when two jobs write at the same time?', a: 'Two appends both succeed. If both rewrite the same files, the second commit detects the conflict and has to retry or fails.', pl: 'Konflikt wykrywany przy commicie.' },
      { q: 'How far back can you time travel?', a: 'As long as the old data files and log entries still exist. By default VACUUM keeps seven days of files and the log is kept for thirty days.', pl: 'Ogranicza to VACUUM i retencja logu.' },
      { q: 'How is Delta different from plain Parquet?', a: 'Parquet is only a file format. Delta adds transactions, version history and file-level statistics for data skipping.', pl: 'Parquet to format pliku, Delta to tabela.' }
    ],
    mistakes: [
      'Opisanie Delty jako „formatu pliku". Format to Parquet, Delta to protokół nad plikami.',
      'Pominięcie logu: bez niego nie da się wyjaśnić ACID.',
      'Twierdzenie, że update modyfikuje pliki w miejscu.'
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
      pl: 'MERGE łączy źródło z tabelą docelową po kluczu i w jednym atomowym commicie robi insert, update i delete. Żeby ładowanie było idempotentne, pilnuję trzech rzeczy. Deterministyczny klucz biznesowy w ON, żeby powtórka aktualizowała te same wiersze. Deduplikacja źródła w ramach paczki, bo MERGE pada, gdy kilka wierszy źródła pasuje do jednego wiersza celu. I warunek, żeby starsze dane nie nadpisały nowszych: update tylko wtedy, gdy timestamp źródła jest nowszy. Wtedy ponowne uruchomienie paczki zostawia tabelę w tym samym stanie.',
      en: 'MERGE joins a source to a target table on a key and applies inserts, updates and deletes in one atomic commit. To make a load idempotent I take care of three things. A deterministic business key in the ON clause, so a re-run updates the same rows. Deduplicating the source within the batch, because MERGE fails when several source rows match one target row. And a condition so that older data never overwrites newer data: update only when the source timestamp is newer. With that, re-running a batch leaves the table in the same state.'
    },
    senior: {
      pl: 'Wydajnościowo MERGE to join, więc trzymam tabelę sklastrowaną po kluczu merge\'a. Dodatkowy warunek w ON, np. na datę, dokładam tylko wtedy, gdy ta kolumna jest niezmienną częścią klucza. Inaczej pasujący wiersz spoza zakresu nie zostanie dopasowany i MERGE wstawi duplikat.',
      en: 'Performance-wise MERGE is a join, so I keep the table clustered by the merge key. I add an extra predicate to ON, for example on a date, only when that column is an immutable part of the key. Otherwise a matching row outside the range is not matched and MERGE inserts a duplicate.'
    },
    keywords: ['MERGE', 'idempotency', 'business key', 'deduplication', 'late data', 'replaceWhere'],
    followUps: [
      { q: 'What other ways are there to get idempotency?', a: 'Overwriting a slice of the table with replaceWhere, or in streaming, foreachBatch with a MERGE inside.', pl: 'Nadpisanie wycinka albo foreachBatch + MERGE.' },
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
      pl: 'OPTIMIZE skleja dużo małych plików w mniej dużych i przy okazji układa dane, jeśli tabela ma clustering. Nie zmienia danych, tylko układ, i tworzy nową wersję tabeli. VACUUM fizycznie kasuje pliki, do których aktualna wersja już się nie odwołuje i które są starsze niż próg retencji, domyślnie 7 dni. Dopiero to zwalnia miejsce. Ryzyko jest takie, że po VACUUM nie cofnę się dalej niż okno retencji, a przy zbyt krótkiej retencji mogę skasować pliki potrzebne długiemu zapytaniu. Na tabelach managed w Unity Catalog obie operacje robi automatycznie predictive optimization.',
      en: 'OPTIMIZE compacts many small files into fewer large ones and also applies the layout if the table uses clustering. It does not change the data, only the layout, and it creates a new table version. VACUUM physically deletes files that the current version no longer references and that are older than the retention threshold, seven days by default. That is what actually frees storage. The risk is that after VACUUM I cannot time travel beyond the retention window, and with a retention that is too short I can delete files a long-running query still needs. On Unity Catalog managed tables predictive optimization runs both automatically.'
    },
    keywords: ['OPTIMIZE', 'VACUUM', 'small files', 'retention', '7 days', 'predictive optimization'],
    followUps: [
      { q: 'Does OPTIMIZE block readers?', a: 'No. Readers use snapshot isolation, and the result before and after is the same.', pl: 'Czytający nie są blokowani.' },
      { q: 'Where do small files come from?', a: 'Frequent small writes, streaming and MERGE operations.', pl: 'Streaming i częste MERGE.' },
      { q: 'What does predictive optimization run?', a: 'OPTIMIZE, VACUUM and ANALYZE on Unity Catalog managed tables.', pl: 'Trzy operacje, bez własnych jobów.' }
    ],
    mistakes: [
      'Mylenie ról: OPTIMIZE nie zwalnia miejsca, VACUUM nie przyspiesza zapytań.',
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
      pl: 'Wszystkie trzy służą do data skipping, czyli trzymania podobnych wierszy w tych samych plikach, żeby zapytania czytały mniej. Partycjonowanie dzieli tabelę na katalogi. Sprawdza się przy małej liczbie wartości, ale przy dużej robi masę drobnych plików, a kolumny nie zmienię bez przepisania tabeli. Z-order układa dane po kilku kolumnach, ale nie jest przyrostowy. Liquid clustering zastępuje jedno i drugie: deklaruję klucze przez CLUSTER BY, działa na kolumnach o dużej kardynalności, układa dane przyrostowo, a klucze mogę zmienić bez przepisywania istniejących danych. Databricks zaleca go dla nowych tabel.',
      en: 'All three are about data skipping: keeping similar rows in the same files so queries read less. Partitioning splits the table into directories. It works for a small number of values, but with many values it creates lots of tiny files, and I cannot change the column without rewriting the table. Z-ordering sorts data by several columns but is not incremental. Liquid clustering replaces both: I declare keys with CLUSTER BY, it works on high-cardinality columns, it clusters incrementally, and I can change the keys without rewriting existing data. Databricks recommends it for new tables.'
    },
    keywords: ['CLUSTER BY', 'data skipping', 'high cardinality', 'ZORDER', 'CLUSTER BY AUTO'],
    followUps: [
      { q: 'Can you combine it with partitioning or Z-order?', a: 'No. Liquid clustering is not compatible with either on the same table.', pl: 'Jedno albo drugie.' },
      { q: 'You changed the clustering keys. What happens to old data?', a: 'It keeps the old layout until I force a rewrite with OPTIMIZE FULL.', pl: 'Nowe klucze działają dla nowych zapisów.' },
      { q: 'How do you choose the keys?', a: 'From the columns most often used in filters and joins. For a table I MERGE into, the merge key.', pl: 'Filtry, joiny, klucz merge\'a.' }
    ],
    mistakes: [
      'Twierdzenie, że to „nowe partycjonowanie". Nie tworzy katalogów.',
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
      pl: 'W nowych runtime\'ach jest też automatic change data feed, liczony przy odczycie na tabelach z row tracking, bez konfiguracji per tabela. To odpowiednik Snowflake Streams, z tą różnicą, że tu konsument sam pamięta ostatnią wersję.',
      en: 'Newer runtimes also have automatic change data feed, computed at query time on tables with row tracking, without per-table configuration. It is the counterpart of Snowflake Streams, except that here the consumer tracks the last processed version itself.'
    },
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
      pl: 'To konwencja warstw. Bronze trzyma surowe dane tak, jak przyszły, z metadanymi załadowania, żeby zawsze dało się przetworzyć je od nowa. Silver to dane oczyszczone i ujednolicone: zdeduplikowane, z typami, zwalidowane, z kluczami biznesowymi. Gold to dane pod konsumpcję: agregaty, model wymiarowy, tabele cech. Wartość nie jest w trzech nazwach, tylko w kontrakcie: każda warstwa ma jasny poziom jakości, surowe dane nie giną, a zmianę logiki da się przeliczyć od bronze. Warstw nie musi być dokładnie trzy, a gold nadal powinien być porządnie zamodelowany.',
      en: 'It is a layering convention. Bronze holds raw data as it arrived, with ingestion metadata, so it can always be reprocessed. Silver is cleaned and conformed data: deduplicated, typed, validated, with business keys. Gold is data shaped for consumption: aggregates, a dimensional model, feature tables. The value is not in the three names but in the contract: each layer has a clear quality level, raw data is never lost, and a logic change can be recomputed from bronze. There do not have to be exactly three layers, and gold should still be properly modeled.'
    },
    keywords: ['bronze', 'silver', 'gold', 'replay', 'data quality', 'star schema'],
    followUps: [
      { q: 'Where do you run data quality checks?', a: 'On the way into silver. Bad records go to quarantine instead of disappearing.', pl: 'Na wejściu do silver.' },
      { q: 'How do you move changes between layers?', a: 'Incrementally: a stream from bronze, or Change Data Feed from silver plus a MERGE.', pl: 'Stream albo CDF + MERGE.' },
      { q: 'How does this map to a dbt project?', a: 'Staging, intermediate and marts are the same idea under different names.', pl: 'Most do Twojego doświadczenia z dbt.' }
    ],
    mistakes: [
      'Recytowanie trzech nazw bez powiedzenia, po co są.',
      'Traktowanie gold jako zbioru szerokich tabel bez modelu.',
      'Kopiowanie danych między warstwami bez dodanej wartości.'
    ]
  }
];

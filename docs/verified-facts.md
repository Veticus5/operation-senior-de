# Zweryfikowane fakty

Liczby i zachowania, na które powołują się lekcje i Interview Bank. Każdy wpis ma źródło:
pomiar z labu albo dokumentację. Zanim dodasz do treści nową liczbę, dopisz ją tutaj.

Trzy rodzaje wpisów i trzy różne poziomy pewności:

- **Pomiar lokalny** mówi, co Spark zrobił w jednym, małym uruchomieniu. To obserwacja, nie gwarancja. Wynik zależy od wersji, planu i konfiguracji, a `local[3]` to jeden proces z trzema wątkami, bez klastra.
- **Dokumentacja** mówi, co projekt obiecuje. Przy każdym wpisie jest wersja albo data strony.
- **Niezweryfikowane** to rzeczy podane z wiedzy ogólnej. Nie wolno ich przedstawiać w treści jako pewnych.

## Pomiary lokalne

Środowisko: `local[3]`, ustawienia domyślne (AQE włączone, ANSI włączone), klasyczny PySpark (nie Spark Connect), Java 21.
Wersje: **PySpark 4.0.1** (przypięta w `labs/pyproject.toml`) oraz **PySpark 4.3.0** (uruchomienie kontrolne z 2026-11-26).
Wszystkie liczby poniżej wyszły identycznie w obu wersjach. Różniły się tylko czasy.

### `labs/lazy_evaluation/lazy_lab.py` (lekcja, eksperymenty 1–5)

Źródło: jeden plik Parquet, 9 wierszy, 1 partycja.

| Fakt | Wynik |
| --- | --- |
| `spark.read.parquet(ścieżka)` uruchamia job | 1 job (schemat z metadanych pliku, wiersze nieczytane) |
| `read.csv` z `header` / z `header` i `inferSchema` | 1 job / 2 joby |
| Joby na akcję, plan filter + groupBy, AQE włączone | show 2, count 3, collect 2 |
| Joby na akcję, ten sam plan, AQE wyłączone | show 5, count 1, collect 1 |
| Wiersze przerobione przez filter: show, count, show bez cache | 9, 18, 27 |
| To samo z `cache()` | 0 po samym cache, potem 9, 9, 9 |
| `collect()` dwa razy na tym samym DataFrame z shuffle'em | 9, 9 (ponowne użycie wyników shuffle'u) |
| `collect()` dwa razy, plan bez shuffle'u | 9, 18 |
| Literówka w nazwie kolumny | `AnalysisException` od razu, przy definicji |
| `cast("int")` na wartości `"abc"` | brak błędu przy definicji, `CAST_INVALID_INPUT` przy akcji |
| filter + groupBy + sum(price): plan | `Project` dopisany przez optymalizator, `Filter` z dodanym `isnotnull` |
| Ten sam plan: skan | `FileScan parquet [publisher_id, status, price]`, `ReadSchema` 3 z 4 kolumn, `PushedFilters: [IsNotNull(status), EqualTo(status,active)]` |
| `count()` na surowym pliku: `ReadSchema` | puste (`struct<>`) |
| filter + `count()`: `ReadSchema` | tylko `status` |

Plany po optymalizacji dla 20 kombinacji operacji i akcji używane przez symulator:
`content/spark/lazy-evaluation/plans.json`.

### `labs/lazy_evaluation/lazy_conditions_lab.py` (warunki i wyjątki)

| Fakt | Wynik |
| --- | --- |
| Druga akcja, plan z shuffle'em: collect + collect na tym samym DataFrame | 9, 9. W Spark UI: 1 stage wykonany, 1 pominięty (skipped). Tak samo z AQE i bez |
| show + show, count + count, show + count, collect na DataFrame pochodnym | 9, 18 (liczone od nowa). Tak samo z AQE i bez |
| collect + collect, plan bez shuffle'u | 9, 18 |
| `cache()` na 3 partycjach, potem `take(1)` | licznik 3, w cache 1 z 3 partycji |
| potem `count()` | licznik 9, w cache 3 z 3 partycji. Drugi `count()`: licznik bez zmian |
| Poziom przechowywania po `df.cache()` | `MEMORY_AND_DISK_DESER` |
| DataFrame pochodny (filter + count) na zcache'owanym | licznik bez zmian (czyta z cache) |
| Identyczny plan zbudowany od zera w innej zmiennej | też trafia w cache (`InMemoryTableScan` w planie) |
| `unpersist()`, potem `count()` | licznik rośnie o 9 (liczone od nowa) |
| Zły rzut, akcja nie używa kolumny (`select("id").collect()`, `count()`) | brak błędu |
| Zły rzut przy `spark.sql.ansi.enabled=false` (DataFrame zbudowany po zmianie ustawienia) | brak błędu, wartość `NULL` |
| `try_cast` zamiast `cast`, ANSI włączone | brak błędu, wartość `NULL` |
| `read.schema(...).parquet(ścieżka)` | 0 jobów |
| `spark.table(...)` + filter (schemat z katalogu) | 0 jobów |
| `groupBy.pivot("status")` bez listy wartości | 4 joby już przy definicji |
| `groupBy.pivot("status", [wartości])` | 0 jobów przy definicji |
| `show()` bez AQE przy 1 / 5 / 21 / 200 partycjach po shuffle'u | 1 / 2 / 3 / 5 jobów (`spark.sql.limit.scaleUpFactor` = 4) |

Ostatni wiersz potwierdza wyjaśnienie „5 jobów dla `show()` bez AQE": `show()` bierze partycje porcjami 1, 4, 16, 64, reszta.
Mechanizm przewidział wszystkie cztery liczby, ale opisu w dokumentacji użytkownika nie znalazłem, więc w treści jest podany jako wniosek z eksperymentu.

### `labs/lazy_evaluation/pushdown_lab.py` (predicate pushdown)

400 000 wierszy, filtr `amount > 4500`, wynik 39 920 wierszy, plik z 31 row groups (rozmiar grupy ustawiony na 1 MB).

| Układ danych | `spark.sql.parquet.filterPushdown` | Wiersze oddane przez skan | `PushedFilters` w planie |
| --- | --- | --- | --- |
| posortowane po `amount` | true | 46 138 (dokładnie 4 grupy z 31, których max > 4500) | `[IsNotNull(amount), GreaterThan(amount,4500)]` |
| posortowane po `amount` | false | 400 000 | takie samo |
| nieposortowane (każda grupa 0..4999) | true | 400 000 | takie samo |
| nieposortowane | false | 400 000 | takie samo |

Wniosek użyty w lekcji: `PushedFilters` mówi, co przekazano źródłu, a nie ile danych pominięto.
Liczba wierszy pochodzi z metryki `numOutputRows` węzła skanu, a min i max grup ze stopki pliku.

### `labs/interview_bank/spark_checks.py` (Interview Bank)

| Fakt | Wynik |
| --- | --- |
| `spark.sql.autoBroadcastJoinThreshold` | 10485760 b (10 MB) |
| `spark.sql.shuffle.partitions` | 200 |
| `spark.sql.adaptive.enabled` | true |
| `skewedPartitionFactor` / `skewedPartitionThresholdInBytes` | 5.0 / 256 MB |
| `advisoryPartitionSizeInBytes` / `files.maxPartitionBytes` | 64 MB / 128 MB |
| Hint broadcast: inner; left outer z małą stroną po prawej | `BroadcastHashJoin` |
| Hint broadcast: left outer z hintem na lewej; right outer z hintem na prawej; full outer | `SortMergeJoin` (hint nie został spełniony) |
| Full outer bez warunku równości, hint broadcast | `BroadcastNestedLoopJoin` |
| `groupBy(k).sum` na 100 000 wierszy, 50 kluczy, 3 partycje wejścia | 150 rekordów zapisanych do shuffle'u (agregacja częściowa) |
| Sort-merge join po `k`, ta sama tabela | 100 000 rekordów zapisanych do shuffle'u |
| `repartition(8, k)` (hash) i `repartitionByRange(8, k)` | jeden klucz zawsze w 1 partycji |
| `repartition(8)` (round-robin) | jeden klucz w 8 partycjach, rozmiary 12 498–12 501 |
| `repartition(8, k)`, 80% wierszy z jednym kluczem | niepuste partycje od 2 000 do 80 000 wierszy |
| 12 partycji na `local[3]` | 12 tasków, jednocześnie najwyżej 3 |
| `SELECT … FROM VALUES … WHERE …` + `collect()` | 0 jobów, plan `LocalTableScan` (policzone przez driver) |

## Dokumentacja

Strony Apache Spark były w dniu sprawdzenia (2026-11-26) dokumentacją wersji **4.3.0** (`/docs/latest/`).
Przy stronach Databricks podana jest data „Last updated" ze strony.

| Fakt | Źródło |
| --- | --- |
| Transformacje są leniwe. Wynik „may be recomputed" przy każdej akcji. Cache jest odporny na utratę: brakującą partycję Spark liczy od nowa. Stare partycje są usuwane z cache w trybie LRU. Pliki shuffle są zachowywane, żeby nie tworzyć ich ponownie | [Spark: RDD Programming Guide](https://spark.apache.org/docs/latest/rdd-programming-guide.html) |
| Akumulator: w akcjach aktualizacja każdego taska liczy się raz, w transformacjach może się powtórzyć przy ponowieniu taska lub stage'a | tamże |
| `rdd.cache()` to `MEMORY_ONLY`. `DataFrame.cache()` to `MEMORY_AND_DISK_DESER` | tamże oraz docstring `DataFrame.cache` w PySpark 4.0.1 ([strona API](https://spark.apache.org/docs/latest/api/python/reference/pyspark.sql/api/pyspark.sql.DataFrame.cache.html)), potwierdzone pomiarem |
| UDF: wywołania mogą zostać wyeliminowane albo powtórzone przez optymalizator | docstring `pyspark.sql.functions.udf` w PySpark 4.0.1 |
| `coalesce`: zależność narrow, nie zwiększa liczby partycji, drastyczne `coalesce(1)` może przenieść obliczenia na jeden węzeł | docstring `DataFrame.coalesce` w PySpark 4.0.1 |
| `local[K]` to K wątków roboczych w jednym procesie | [Spark: Submitting Applications](https://spark.apache.org/docs/latest/submitting-applications.html) |
| `autoBroadcastJoinThreshold` domyślnie 10 MB. Hinty: BROADCAST ma priorytet przed MERGE, SHUFFLE_HASH i SHUFFLE_REPLICATE_NL, ale „there is no guarantee that Spark will choose the join strategy specified in the hint" | [Spark: Performance Tuning](https://spark.apache.org/docs/latest/sql-performance-tuning.html) |
| AQE domyślnie włączone od Apache Spark 3.2.0. `shuffle.partitions` 200, `advisoryPartitionSizeInBytes` 64 MB, `maxPartitionBytes` 128 MB, skew: factor 5.0 i próg 256 MB | tamże |
| Spark Classic analizuje plan od razu, Spark Connect odkłada analizę i rozwiązywanie nazw do wykonania (albo do odczytu schematu) | [Spark: Eager vs Lazy, Spark Connect vs Spark Classic](https://spark.apache.org/docs/latest/spark-connect-gotchas.html) |
| Watermark: dane w progu „guaranteed to be aggregated", dane późniejsze „not guaranteed to be dropped". Czyszczenie stanu agregacji wymaga trybu Append lub Update. Deduplikacja bez watermarku trzyma wszystkie rekordy. Join stream–stream bez ograniczeń rośnie bez końca | [Spark: Structured Streaming, APIs on DataFrames and Datasets](https://spark.apache.org/docs/latest/streaming/apis-on-dataframes-and-datasets.html) |
| Tabela ujść: plik exactly-once, Kafka at-least-once, foreach at-least-once, foreachBatch „depends on the implementation" | tamże |
| `foreachBatch` daje tylko at-least-once. `batchId` pozwala zdeduplikować zapis | [Databricks: Use foreachBatch](https://docs.databricks.com/aws/en/structured-streaming/foreach) |
| Mała strona broadcast joina jest budowana na driverze (komunikat błędu każe zwiększyć `spark.driver.memory`) | [apache/spark, PR #21899](https://github.com/apache/spark/pull/21899). Dotyczy Apache Spark |
| AQE na Databricks: tylko zapytania niestreamingowe. Skew w sort-merge i shuffle hash join, progi 5 i 256 MB. Strona dzielona zależy od typu joina: inner obie, left outer lewa, right outer prawa, full outer żadna. `spark.databricks.adaptive.autoBroadcastJoinThreshold` 30 MB | [Databricks: Adaptive query execution](https://docs.databricks.com/aws/en/optimizations/aqe) (2026-10-12) |
| Predictive optimization: OPTIMIZE, VACUUM, ANALYZE. Tylko tabele managed w Unity Catalog. „Enabled by default", konto, katalog i schemat mogą ją włączyć lub wyłączyć. Wymaga obsługiwanego regionu. Nie stosuje Z-order, nie obejmuje tabel external | [Databricks: Predictive optimization](https://docs.databricks.com/aws/en/optimizations/predictive-optimization) (2026-11-18) |
| Data skipping: statystyki per plik (min, max, liczba nulli). „Z-ordering is not idempotent but aims to be an incremental operation". Z-order nie łączy się z liquid clustering. Dla nowych tabel zalecany liquid clustering | [Databricks: Data skipping](https://docs.databricks.com/aws/en/delta/data-skipping) (2026-10-20) |
| Liquid clustering zastępuje partycjonowanie i ZORDER, zmiana kluczy bez przepisywania danych | [Databricks: Liquid clustering](https://docs.databricks.com/aws/en/delta/clustering) |
| Deletion vectors: bez nich zmiana jednego wiersza przepisuje cały plik Parquet, z nimi zmiana jest oznaczana w metadanych i stosowana przy odczycie | [Databricks: Deletion vectors](https://docs.databricks.com/aws/en/delta/deletion-vectors) |
| MERGE: może się nie udać, gdy kilka wierszy źródła próbuje zmienić ten sam wiersz celu | [Databricks: Upsert using merge](https://docs.databricks.com/aws/en/delta/merge) |
| CDF: właściwość `delta.enableChangeDataFeed`, zmiany dopiero od włączenia, `table_changes`, `_change_type`, pliki zmian podlegają retencji i VACUUM. Automatic change data feed: liczony przy odczycie, Databricks Runtime 19+, tabela w Unity Catalog z row tracking | [Databricks: Change data feed](https://docs.databricks.com/aws/en/delta/delta-change-data-feed) (2026-10-09) |
| VACUUM: domyślna retencja 7 dni, log 30 dni | [Databricks: VACUUM](https://docs.databricks.com/aws/en/sql/language-manual/delta-vacuum) |
| Tabela managed w Unity Catalog: po DROP dane oznaczone do usunięcia, UNDROP w okresie odzyskiwania (domyślnie 7 dni). External: dane zostają | [Databricks: Drop table](https://docs.databricks.com/aws/en/tables/operations/drop-table) (2026-10-19) |
| Databricks Asset Bundles to od 16 marca 2026 Declarative Automation Bundles. Zmiana nazwy nie wymaga zmian w CLI ani konfiguracji | [Databricks: Bundles release notes](https://docs.databricks.com/aws/en/release-notes/dev-tools/bundles), [FAQ](https://docs.databricks.com/aws/en/dev-tools/bundles/faqs) |
| Tryb development: prefiks zasobów i wstrzymane harmonogramy | [Databricks: Bundle deployment modes](https://docs.databricks.com/aws/en/dev-tools/bundles/deployment-modes) |
| Serverless: brak Spark UI (zamiast niego query profile). Triggery: `AvailableNow` (zalecany) i przestarzały `Once`, `ProcessingTime` i trigger domyślny nieobsługiwane. Tylko API Spark Connect, API RDD nieobsługiwane. ANSI włączone | [Databricks: Serverless limitations](https://docs.databricks.com/aws/en/compute/serverless/limitations) (2026-11-23) |
| Delta Live Tables to teraz Lakeflow Spark Declarative Pipelines | [Databricks: What happened to DLT](https://docs.databricks.com/aws/en/ldp/where-is-dlt) |

Wpisy bez daty (liquid clustering, VACUUM, deployment modes, DLT, Submitting Applications) pochodzą z pierwszej wersji tego pliku i nie były ponownie otwierane 2026-11-26.

## Niezweryfikowane

- Rozmiar partycji „100–200 MB" w pytaniu o repartition: reguła praktyczna, nie cytat z dokumentacji. W treści jest tak opisana.
- Fakty o Snowflake użyte w mostach (result cache, pruning mikropartycji, automatic clustering, offset w Streams, Time Travel i Fail-safe): podane z wiedzy ogólnej, bez otwierania dokumentacji Snowflake.
- Warianty, których laby nie uruchamiają: Spark Connect, Databricks serverless, Photon, prawdziwy klaster z wieloma executorami. Wszystko, co treść o nich mówi, pochodzi z dokumentacji, nie z pomiaru.
- Limit ponowień taska (follow-up o awarii executora): odpowiedź mówi tylko „up to a retry limit", bez liczby.
- „W samym Apache Spark nie ma result cache": wniosek z dokumentacji (wynik „may be recomputed"), a nie cytat.

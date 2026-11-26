# Zweryfikowane fakty

Liczby i zachowania, na które powołują się lekcje i Interview Bank. Każdy wpis ma źródło:
pomiar z labu albo dokumentację. Zanim dodasz do treści nową liczbę, dopisz ją tutaj.

## Pomiary własne

Środowisko: PySpark 4.0.1, `local[3]`, ustawienia domyślne (AQE włączone, ANSI włączone), źródło Parquet, 9 wierszy.
Skrypt: `labs/lazy_evaluation/lazy_lab.py`.

| Fakt | Wynik |
| --- | --- |
| `spark.read.parquet` uruchamia job | 1 job (schemat z metadanych pliku) |
| `read.csv` z `header` / z `header` i `inferSchema` | 1 job / 2 joby |
| Joby na akcję, plan filter + groupBy, AQE włączone | show 2, count 3, collect 2 |
| Joby na akcję, ten sam plan, AQE wyłączone | show 5, count 1, collect 1 |
| Wiersze przerobione przez filter: show, count, show bez cache | 9, 18, 27 |
| To samo z `cache()` | 0 po samym cache, potem 9, 9, 9 |
| `collect()` dwa razy na tym samym DataFrame z shuffle'em | 9, 9 (ponowne użycie wyników shuffle'u) |
| `collect()` dwa razy, plan bez shuffle'u | 9, 18 |
| Literówka w nazwie kolumny (tryb classic) | `AnalysisException` od razu, przy definicji |
| `cast("int")` na wartości `"abc"` | brak błędu przy definicji, `CAST_INVALID_INPUT` przy akcji |
| filter + groupBy + sum(price): `ReadSchema` | 3 z 4 kolumn, `PushedFilters` ustawione, `Project` dopisany przez optymalizator |
| `count()` na surowym pliku: `ReadSchema` | puste (`struct<>`) |
| filter + `count()`: `ReadSchema` | tylko `status` |

Plany po optymalizacji dla 20 kombinacji operacji i akcji używane przez symulator:
`content/spark/lazy-evaluation/plans.json`.

## Dokumentacja

| Fakt | Źródło |
| --- | --- |
| Transformacje są leniwe, wynik „may be recomputed" przy każdej akcji, `persist`/`cache` | [Spark: RDD Programming Guide](https://spark.apache.org/docs/latest/rdd-programming-guide.html) |
| `local[K]` to K wątków roboczych w jednym procesie | [Spark: Submitting Applications](https://spark.apache.org/docs/latest/submitting-applications.html) |
| `DataFrame.cache()` to `persist` z poziomem `MEMORY_AND_DISK_DESER` | [PySpark: DataFrame.cache](https://spark.apache.org/docs/latest/api/python/reference/pyspark.sql/api/pyspark.sql.DataFrame.cache.html) |
| AQE: skew gdy partycja > 5× mediana i > 256 MB, tylko joiny sort-merge i shuffle hash, nie streaming, nie full outer | [Databricks: Adaptive query execution](https://docs.databricks.com/aws/en/optimizations/aqe) |
| Liquid clustering zastępuje partycjonowanie i ZORDER, nie łączy się z nimi, zmiana kluczy bez przepisywania | [Databricks: Liquid clustering](https://docs.databricks.com/aws/en/delta/clustering) |
| CDF: `_change_type`, `table_changes`, retencja, automatic change data feed | [Databricks: Change data feed](https://docs.databricks.com/aws/en/delta/delta-change-data-feed) |
| VACUUM: domyślna retencja 7 dni, log 30 dni | [Databricks: VACUUM](https://docs.databricks.com/aws/en/sql/language-manual/delta-vacuum) |
| Predictive optimization uruchamia OPTIMIZE, VACUUM, ANALYZE na tabelach managed | [Databricks: Predictive optimization](https://docs.databricks.com/aws/en/optimizations/predictive-optimization) |
| Tabela managed: UNDROP domyślnie 7 dni, potem pliki są kasowane. External: pliki zostają | [Databricks: Drop table](https://docs.databricks.com/aws/en/tables/operations/drop-table) |
| Databricks Asset Bundles to od 16 marca 2026 Declarative Automation Bundles | [Databricks: Bundles release notes](https://docs.databricks.com/aws/en/release-notes/dev-tools/bundles) |
| Tryb development: prefiks zasobów i wstrzymane harmonogramy | [Databricks: Bundle deployment modes](https://docs.databricks.com/aws/en/dev-tools/bundles/deployment-modes) |
| Serverless: brak Spark UI, tylko `Trigger.AvailableNow`, Spark Connect odracza analizę | [Databricks: Serverless limitations](https://docs.databricks.com/aws/en/compute/serverless/limitations) |
| Delta Live Tables to teraz Lakeflow Spark Declarative Pipelines | [Databricks: What happened to DLT](https://docs.databricks.com/aws/en/ldp/where-is-dlt) |

## Niezweryfikowane, do sprawdzenia przez reviewera

- Próg `spark.sql.autoBroadcastJoinThreshold` 10 MB: podany z pamięci, bez otwarcia dokumentacji w tej sesji.
- Rozmiar partycji „100–200 MB" w pytaniu o repartition: reguła praktyczna, nie cytat z dokumentacji.
- Mechanizm 5 jobów dla `show()` bez AQE (pobieranie partycji porcjami): wynik zmierzony, wyjaśnienie niepotwierdzone w dokumentacji.

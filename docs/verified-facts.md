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

### `labs/execution_architecture/execution_lab.py` (lekcja 02 i pytania o modelu wykonania)

Uruchomienia z 2026-11-27: PySpark 4.0.1 i 4.3.0, `local[3]`, Java 21, ustawienia domyślne poza wymienionymi. Wszystkie liczby wyszły identycznie w obu wersjach.
Dane testowe: `orders` 1200 wierszy w 4 plikach Parquet (800 ze statusem `paid`, 5 dat), `customers` 40 wierszy w 2 plikach (4 regiony).
`spark.sql.files.maxPartitionBytes` = 4 MB, żeby każdy plik był osobną partycją: `orders` 4 partycje, `customers` 2. `spark.sql.shuffle.partitions` = 200 (wartość domyślna). Akcja w części 3 to zapis do Parquet.

| Fakt | Wynik |
| --- | --- |
| `SparkSession.builder.getOrCreate()` wywołane drugi raz | ten sam obiekt sesji |
| `spark.newSession()` | inna sesja, ten sam `SparkContext` i to samo `applicationId` |
| Widok tymczasowy utworzony w pierwszej sesji | widoczny w pierwszej, niewidoczny w drugiej |
| `spark.sql.shuffle.partitions` zmienione w drugiej sesji na 7 | pierwsza nadal 200 |
| `explain(extended=True)`, filter + groupBy + sum, AQE wyłączone | cztery sekcje: Parsed, Analyzed, Optimized Logical Plan, Physical Plan. Optymalizator dopisał `Project [order_date, amount]` i `isnotnull(status)`. Plan fizyczny: `FileScan parquet` (3 kolumny, `PushedFilters`), `ColumnarToRow`, `Filter`, `Project`, `HashAggregate` z `partial_sum`, `Exchange hashpartitioning(order_date, 200)`, `HashAggregate` z `sum` |
| Operatory planu fizycznego, filter + join + groupBy, broadcast wyłączony | 3 × `Exchange hashpartitioning`, `SortMergeJoin`, 2 × `Sort` |
| To samo z domyślnym progiem broadcast | `BroadcastHashJoin`, `BroadcastExchange`, 1 × `Exchange hashpartitioning` |
| Pierwsza linia planu fizycznego z AQE przed akcją / po `collect()` na tym samym DataFrame | `AdaptiveSparkPlan isFinalPlan=false` / `isFinalPlan=true` |

Joby, wykonane stage'e i wykonane taski jednej akcji `write`. W zapytaniu C broadcast jest wyłączony (`spark.sql.autoBroadcastJoinThreshold = -1`), o ile nie napisano inaczej.

| Zapytanie | AQE | Joby | Stage'e (taski) | Rekordy w shuffle'u |
| --- | --- | --- | --- | --- |
| A. filter | wyłączone i włączone | 1 | 1 stage (4) | brak |
| B. filter + groupBy | wyłączone | 1 | 2: (4), (200) | zapisane 20 = 5 dat × 4 partycje |
| B. filter + groupBy | włączone | 2 | job 0: (4). Job 1: 1 pominięty, potem (1) | 20 |
| C. filter + join + groupBy | wyłączone | 1 | 4: klienci (2), zamówienia (4), join (200), suma (200) | 40 i 800 przed joinem, join odczytał 840 i zapisał 40 |
| C. filter + join + groupBy | włączone | 4 | joby 0 i 1: (2) i (4). Job 2: 2 pominięte, join (1). Job 3: 3 pominięte, suma (1) | join zapisał 4 |
| C z domyślnym progiem broadcast | wyłączone | 2 | job 0: klienci (2). Job 1: (4), (200) | zapisane 16 = 4 regiony × 4 partycje |
| C z domyślnym progiem broadcast | włączone | 3 | (2), (4), 1 pominięty i (1) | 16 |

Razem wykonanych tasków: A 4; B 204 bez AQE i 5 z AQE; C 406 i 8; C z broadcastem 206 i 7.

| Fakt | Wynik |
| --- | --- |
| Zapytanie C bez AQE: stage 0 i stage 1 (dwa niezależne odczyty) | działały w tym samym czasie (porównanie `submissionTime` i `completionTime` z REST API) |
| Task partycji 1 pada przy pierwszej próbie, `local[3]` | job przerwany wyjątkiem, stage w stanie `FAILED`, 1 nieudana próba |
| To samo na `local[3,4]` | job zakończony. Numery prób: partycja 1 ma `attemptNumber` 1, pozostałe 0. Stage: 4 udane taski, 1 nieudana próba |
| Lab uruchomiony przez lokalny runner, przyciskiem w lekcji | kod wyjścia 0, 13,4 s, te same liczby |

Zakres: jedna maszyna, jeden proces, dane testowe. Osobny job dla strony broadcast i osobne joby AQE dla części planu przed shuffle'em to obserwacje z tych planów, nie reguły z dokumentacji. AQE skleiło tu 200 partycji w jedną, bo dane są malutkie. Wniosek „zwykłe `local[3]` nie ponawia tasków" opiera się na tym jednym teście i na opisie `local[K,F]` w dokumentacji. Lab nie sprawdza utraty executora ani plików shuffle.
### `labs/partitioning_shuffle/shuffle_lab.py` (lekcja Partitioning & Shuffle)

Uruchomienie z 2026-11-27: PySpark 4.0.1 i kontrolnie 4.3.0, `local[3]`, Java 21.0.13. Wydruki obu wersji różniły się tylko numerem wersji i wartościami `plan_id`.
Dane: 12 wierszy `(order_id, country, amount)` w 3 partycjach po 4 wiersze (`sc.parallelize(ORDERS, 3)`). Eksperymenty 1–5 z AQE wyłączonym, `spark.sql.shuffle.partitions` = 4, o ile nie napisano inaczej.

| Fakt | Wynik |
| --- | --- |
| `filter("amount >= 60")` | 8 wierszy, po 3, 3 i 2 w partycjach. 0 wierszy zmieniło partycję. 1 stage, 3 taski, 0 rekordów w shuffle'u, brak `Exchange` |
| `groupBy(country).sum(amount)`: plan | `HashAggregate(sum)` ← `Exchange hashpartitioning(country, 4), ENSURE_REQUIREMENTS` ← `HashAggregate(partial_sum)` ← `Project [country, amount]` ← `Scan ExistingRDD` |
| Ten sam `groupBy`: wykonanie | 2 stage'e: 3 taski, potem 4. Zapis do shuffle'u 10 rekordów (710 B), czyli tyle, ile różnych par (partycja wejścia, kraj). Wynik: FR w partycji 0, IT w 1, PL w 2, DE w 3 |
| `repartition(4, "country")` | partycje 2, 2, 5 i 3 wiersze. Numer partycji każdego kraju równy `pmod(hash(country), 4)`. Plan: `Exchange hashpartitioning(country, 4), REPARTITION_BY_NUM`. 2 stage'e (3 i 4 taski), 12 rekordów w shuffle'u (785 B) |
| `repartition(4, "country")`, potem `groupBy("country")` | 1 węzeł `Exchange` w planie (agregacja nie dodała drugiego) |
| `spark.sql.shuffle.partitions` = 7: `repartition(4, "country")` / `repartition("country")` bez liczby | 4 / 7 partycji (liczba podana wprost wygrywa, bez liczby obowiązuje ustawienie) |
| `repartition(4)` | po 3 wiersze w partycji: `[1, 8, 11]`, `[3, 7, 10]`, `[2, 5, 9]`, `[4, 6, 12]`. Plan: `Exchange RoundRobinPartitioning(4), REPARTITION_BY_NUM`. PL w 3 partycjach, pozostałe kraje w 2 |
| `coalesce(2)` na 3 partycjach | partycja 0 bez zmian (4 wiersze), partycje 1 i 2 sklejone (8 wierszy). Plan `Coalesce 2`, brak `Exchange`, 1 stage, 2 taski |
| `coalesce(6)` / `repartition(6)` na 3 partycjach | 3 / 6 partycji |
| `filter` + `coalesce(1)` / `filter` + `repartition(1)` | 1 stage z 1 taskiem / 2 stage'e z 3 i 1 taskiem |
| `groupBy` przy `spark.sql.shuffle.partitions` = 200, AQE wyłączone | taski w stage'ach: 3 i 200. Niepuste partycje po shuffle'u: 4 z 200 |
| To samo z AQE włączonym | taski w stage'ach: 3 i 1 (`spark.sql.adaptive.coalescePartitions.enabled` = true) |

Zakres: jedna maszyna, jeden proces, brak sieci i osobnych executorów. Shuffle zapisuje pliki na lokalny dysk, więc lab pokazuje liczbę rekordów, stage'y i tasków, a nie koszt transferu. Układ po `repartition(4)` i numery partycji krajów są obserwacją z tych danych i tej liczby partycji. Liczby bajtów zależą od wersji. Symulacja w lekcji przepisuje z tego labu układ końcowy i liczniki, a sam ruch kafelków jest ilustracją.

### `labs/join_strategies/join_strategies_lab.py` (lekcja 04: Spark Join Strategies)

Uruchomienia z 2026-11-27: PySpark 4.0.1 (przypięta) i 4.3.0 (kontrolne), `local[3]`, Java 21, klasyczny PySpark.
Dane wymyślone, zapisane jako Parquet: `customers` 2 000 wierszy (1 plik), `transactions` 200 000 wierszy (3 partycje wejścia), każda transakcja ma klienta.
Join: `transactions.join(customers, "customer_id")` z wyborem czterech kolumn. Plany czytane z `executedPlan`, AQE wyłączone, o ile wiersz nie mówi inaczej.

| Fakt | Wynik |
| --- | --- |
| Wartości domyślne: `autoBroadcastJoinThreshold`, `join.preferSortMergeJoin`, `shuffle.partitions`, `broadcastTimeout`, `adaptive.enabled`, `cbo.enabled` | 10485760b, true, 200, 300000ms, true, false |
| Szacunek rozmiaru (`optimizedPlan.stats.sizeInBytes`): cała tabela customers / tylko kolumny potrzebne w joinie / transactions | 4.0.1: 9 259 b / 5 952 b / 2 034 290 b. 4.3.0: 9 211 b / 5 921 b / 2 033 936 b |
| Ustawienia domyślne | `BroadcastHashJoin … Inner, BuildRight`, `BroadcastExchange` tylko po stronie customers, 0 rekordów zapisanych do shuffle'u |
| Próg = -1, bez hintu | `SortMergeJoin`, po obu stronach `Sort` nad `Exchange hashpartitioning(customer_id, 200)`; rekordy zapisane do shuffle'u: 200 000 i 2 000 |
| Próg = -1, hint `SHUFFLE_HASH` na customers | `ShuffledHashJoin … Inner, BuildRight`, `Exchange hashpartitioning` po obu stronach, bez `Sort`; rekordy zapisane do shuffle'u: 200 000 i 2 000 |
| Wynik każdej z trzech strategii | 200 000 wierszy |
| Próg ustawiony na szacunek całej tabeli, szacunek strony +1 b, równo szacunek strony, szacunek strony −1 b | BroadcastHashJoin, BroadcastHashJoin, BroadcastHashJoin, SortMergeJoin (tak samo w obu wersjach, mimo innych liczb bajtów) |
| Filtr `country = 'PL' AND segment = 'premium'` na customers | zostają 84 wiersze z 2 000; szacunek strony po filtrze bez zmian (5 952 b / 5 921 b) |
| Ten filtr, próg o 1 b poniżej szacunku: AQE wyłączone / AQE włączone przed wykonaniem / AQE włączone po `collect()` | SortMergeJoin / SortMergeJoin / BroadcastHashJoin (`AdaptiveSparkPlan isFinalPlan=true`, pod joinem `AQEShuffleRead local` nad `ShuffleQueryStage` oraz `BroadcastQueryStage`), 8 400 wierszy wyniku |
| Hint broadcast na customers, próg -1: inner; `transactions LEFT JOIN customers` | BroadcastHashJoin |
| Ten sam hint: `customers LEFT JOIN transactions`; `FULL OUTER JOIN` | SortMergeJoin (hint nie został spełniony) |
| `FULL OUTER JOIN` z hintem `SHUFFLE_HASH` na customers | ShuffledHashJoin |
| Inner, hint `MERGE`, próg domyślny (tabela poniżej progu) | SortMergeJoin |
| Inner, broadcast na customers i `SHUFFLE_HASH` na transactions | BroadcastHashJoin |

Zakres: jedna maszyna, tryb lokalny, tabele bez statystyk w katalogu, optymalizator kosztowy wyłączony (wartość domyślna). Lab pokazuje, co Spark zaplanował i ile rekordów zapisał do shuffle'u. Nie mierzy czasu ani pamięci, więc nie rozstrzyga, która strategia jest szybsza. Różnica między wersjami: w 4.3.0 węzeł `BroadcastHashJoin` wypisuje jedną flagę więcej, a szacunki w bajtach są inne. Plany w lekcji pochodzą z 4.0.1, a linie `FileScan` są w niej skrócone do listy kolumn.
### `labs/data_skew/skew_aqe_lab.py` (lekcja 05: Data Skew & AQE), uruchomienie z 2026-11-27

Dane wymyślone: 2 000 000 zamówień, z czego 80% (1 600 000) ma `customer_id = 0`, pozostałe klucze po około 400 wierszy; 1000 klientów, po jednym wierszu na klucz. 8 partycji po shuffle'u, `spark.sql.autoBroadcastJoinThreshold = -1` (żeby join szedł przez shuffle), o ile wiersz nie mówi inaczej. Metryki tasków z REST API Sparka (`taskList`). „Max" i „mediana" to rekordy przeczytane z shuffle'u przez jeden task.
Liczby rekordów wyszły identycznie w trzech uruchomieniach na PySpark 4.0.1 i w jednym na 4.3.0. Czasy tasków różniły się między uruchomieniami i nie są cytowane jako wynik (gorący task: ok. 170–260 ms przy medianie 2–50 ms).

| Fakt | Wynik |
| --- | --- |
| `repartition(8, customer_id)`, klucz równy (1000 kluczy po 2000 wierszy) | partycje od 220 000 do 290 000 wierszy |
| `repartition(8, customer_id)`, klucz skośny | siedem partycji 44 451–58 059 wierszy, ósma 1 643 654 |
| `repartition(64, customer_id)`, klucz skośny | największa partycja 1 605 606, mediana 6 008 |
| Sort-merge join, AQE wyłączone, klucz równy | 8 tasków, mediana 242 121, max 290 145 |
| To samo, klucz skośny | 8 tasków, mediana 52 583, max 1 643 764 |
| To samo, klucz skośny, 64 partycje shuffle'u | 64 taski, mediana 6 023, max 1 605 621 |
| AQE włączone (sklejanie partycji wyłączone), progi skew domyślne | `SortMergeJoin` bez znacznika skew, max 1 643 764 (gorąca partycja jest dużo mniejsza niż 256 MB) |
| AQE, `skewedPartitionThresholdInBytes = 1MB`, `advisoryPartitionSizeInBytes = 2MB` | `SortMergeJoin(skew=true)`, 10 tasków, max 547 996. Łącznie 2 001 220 rekordów z shuffle'u przy 2 001 000 na wejściu: partycja klientów (110 wierszy) przeczytana 3 razy |
| Te same progi, skośna strona lewa: inner / left / right / full | `skew=true`, max 547 996 / `skew=true`, max 547 996 / brak, max 1 643 764 / brak, max 1 643 764 |
| Te same progi, `row_number()` w oknie po `customer_id` | max 1 643 654 (bez podziału) |
| `groupBy` na kluczu równym, `shuffle.partitions = 200` | AQE wyłączone: 200 tasków. AQE włączone: 1 task, w planie `AQEShuffleRead coalesced` |
| Join z tabelą 3 000 000 wierszy, z której filtr zostawia 31; próg broadcastu domyślny (10 MB) | plan przed wykonaniem `SortMergeJoin` w obu przypadkach; plan po wykonaniu: bez AQE `SortMergeJoin`, z AQE `BroadcastHashJoin` |
| Salting, sól 0..15 (`rand(seed=7)`), AQE wyłączone, 8 partycji | mediana 251 270, max 450 939; strona klientów 16 000 wierszy zamiast 1000; liczba wierszy (2 000 000) i suma kwot zgodne z joinem bez soli (kontrola zgodności, nie porównanie wiersz po wierszu) |
| 80% zamówień z `customer_id = NULL`, left join, AQE wyłączone | max 1 650 981, mediana 50 173, w planie brak filtra `isnotnull` |
| To samo, inner join | filtr `isnotnull` w planie, max 58 204 |

Zakres: `local[3]`, kilka megabajtów danych, jedna maszyna. Wyniki pokazują, jak rozkłada się praca i kiedy AQE zmienia plan, ale nie mówią nic o czasie na klastrze ani o spillu i błędach pamięci, których przy tak małych danych nie ma. Progi AQE są w części eksperymentów obniżone celowo: przy domyślnych 256 MB obsługa skew na tych danych się nie włącza. Lab nie mierzy shuffle hash joina, Databricks ani Photona.
Obserwacja poza labem: w pierwszej wersji eksperymentu ze zmianą strategii joina wszystkie wiersze małej strony miały ten sam klucz (1 niepusta partycja z 8) i AQE nie zmieniło joina na broadcast. Pasuje to do opisu `spark.sql.adaptive.nonEmptyPartitionRatioForBroadcastJoin` w dokumentacji Databricks, ale skrypt tego nie odtwarza, więc lekcja o tym nie mówi.

### Lokalny runner labów (`apps/lab-runner`), uruchomienie kontrolne z 2026-11-27

Środowisko: Linux x64, uv 0.13.7, CPython 3.15.2, PySpark 4.0.1, Java 21.0.13 (Temurin JRE), `local[3]`.
Lab `lazy_evaluation/lazy_lab.py` uruchomiony przez runner, przyciskiem w lekcji i w pytaniu.

| Fakt | Wynik |
| --- | --- |
| Liczby labu uruchomionego przez runner | identyczne z tabelą `lazy_lab.py` wyżej (joby: 2/3/2 i 5/1/1; wiersze: 9, 18, 27; CSV: 1 i 2 joby) |
| Czas pierwszego uruchomienia (uv tworzy `.venv` i buduje PySpark z pamięci podręcznej uv) | 29,8 s |
| Czas kolejnych uruchomień | 10,8–11,3 s w dziewięciu uruchomieniach |
| Gniazda nasłuchujące JVM Sparka przy `SPARK_LOCAL_IP=127.0.0.1` | wszystkie na `127.0.0.1`, w tym interfejs WWW na porcie 4040 |
| Limit sterty JVM Sparka przy ustawieniach domyślnych | `-Xmx1g` |
| Rozłączenie klienta w trakcie pracy | po 1,5 s nie było już procesu Pythona ani JVM |

Zakres: jedna maszyna, jedna konfiguracja. Czasy są orientacyjne i zależą od sprzętu oraz stanu pamięci podręcznej uv (przy pustej dojdzie pobranie PySpark). Runner ustawia `SPARK_LOCAL_IP=127.0.0.1` zawsze, niezależnie od otoczenia. Bez tej zmiennej Spark wypisał ostrzeżenie z nazwą hosta i adresem w sieci lokalnej, a gdzie wtedy nasłuchuje, nie sprawdzałem. Windows nie był sprawdzany.

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

### Lekcja 00: Spark Fundamentals (sprawdzone 2026-11-26)

Strony Apache Spark i PySpark to dokumentacja wersji **4.3.0**. Lekcja nie ma własnego labu: jedyny pomiar, na który się powołuje, to wiersz „12 partycji na `local[3]`" z `labs/interview_bank/spark_checks.py` powyżej. Ilustracje w lekcji (zbiór kontra pamięć maszyny, symulacja klastra) nie są pomiarami i tak są podpisane.

| Fakt | Źródło |
| --- | --- |
| „Apache Spark is a unified analytics engine for large-scale data processing." API w Javie, Scali, Pythonie i R (R oznaczone jako deprecated). Narzędzia: Spark SQL, pandas API on Spark, MLlib, GraphX, Structured Streaming | [Spark: Overview](https://spark.apache.org/docs/latest/index.html) |
| Aplikacja to niezależny zestaw procesów koordynowany przez `SparkContext` w programie głównym (driver program). Executory to procesy, które „run computations and store data for your application". Każda aplikacja ma własne executory, które działają przez cały czas jej życia i wykonują taski w wielu wątkach | [Spark: Cluster Mode Overview](https://spark.apache.org/docs/latest/cluster-overview.html) |
| Menedżery klastra: Standalone, Hadoop YARN, Kubernetes (Mesos nie jest już wymieniony). Task: „A unit of work that will be sent to one executor". Cluster manager: „An external service for acquiring resources on the cluster" | tamże |
| „Spark will run one task for each partition of the cluster. Typically you want 2-4 partitions for each CPU in your cluster." | [Spark: RDD Programming Guide](https://spark.apache.org/docs/latest/rdd-programming-guide.html) |
| `collect()` „can cause the driver to run out of memory […] because `collect()` fetches the entire RDD to a single machine". „RDDs automatically recover from node failures"; utracona partycja jest liczona od nowa z transformacji, które ją utworzyły | tamże |
| `collect()` i `toPandas()` na DataFrame zbierają dane z executorów do drivera i mogą skończyć się błędem braku pamięci. DataFrame i Spark SQL „share the same execution engine" | [PySpark: Quickstart DataFrame](https://spark.apache.org/docs/latest/api/python/getting_started/quickstart_df.html) |
| `spark.driver.maxResultSize` domyślnie 1g: po przekroczeniu job jest przerywany. `spark.task.maxFailures` domyślnie 4 (kolejne porażki tego samego taska). `spark.task.cpus` domyślnie 1; jednocześnie na executorze działa `floor(executor cores / spark.task.cpus)` tasków. `spark.executor.cores`: 1 na YARN, wszystkie rdzenie workera w trybie standalone | [Spark: Configuration](https://spark.apache.org/docs/latest/configuration.html) |
| `spark.sql.files.maxPartitionBytes` domyślnie 134217728 (128 MB): „The maximum number of bytes to pack into a single partition when reading files", tylko dla źródeł plikowych (Parquet, JSON, ORC). To limit planowania odczytu, a nie ograniczenie rozmiaru partycji w ogóle ani zużycia pamięci | [Spark: Performance Tuning](https://spark.apache.org/docs/latest/sql-performance-tuning.html) |
| Dynamiczna alokacja: „disabled by default". Włączona, prosi o kolejne executory, gdy taski czekają na zaplanowanie, i usuwa executor bezczynny dłużej niż `spark.dynamicAllocation.executorIdleTimeout`. Zdanie z Cluster Mode Overview o executorach działających przez cały czas życia aplikacji opisuje więc zachowanie domyślne | [Spark: Job Scheduling](https://spark.apache.org/docs/latest/job-scheduling.html) |
| Storage Partition Join „makes use of the existing storage layout to avoid the shuffle phase" (zgodne źródła V2). Zdania „broadcast join nie wymaga shuffle'u" wprost w tej dokumentacji nie ma: treść opiera się tu na istniejącym wpisie o `BroadcastExchange` i na pomiarach z `spark_checks.py` | [Spark: Performance Tuning](https://spark.apache.org/docs/latest/sql-performance-tuning.html) |
| DataFrame: „a Dataset organized into named columns […] conceptually equivalent to a table in a relational database". „The same execution engine is used, independent of which API/language you are using" | [Spark: SQL Programming Guide](https://spark.apache.org/docs/latest/sql-programming-guide.html) |
| „PySpark is the Python API for Apache Spark." Pandas API on Spark uruchamia kod w stylu pandas „distributed across multiple nodes" | [PySpark: Overview](https://spark.apache.org/docs/latest/api/python/index.html) |
| Tryb klasyczny: PySpark po stronie drivera rozmawia z JVM przez Py4J. Procesy Pythona na executorach obsługują natywne funkcje Pythona i startują leniwie, dopiero gdy są potrzebne (np. pandas UDF) | [PySpark: Debugging PySpark](https://spark.apache.org/docs/latest/api/python/development/debugging.html) |
| Spark Connect: architektura klient–serwer, klient wysyła nierozwiązane plany logiczne do serwera (drivera) i nie używa Py4J | [Spark: Spark Connect Overview](https://spark.apache.org/docs/latest/spark-connect-overview.html) |
| Zbiór w pandas „lives in the single machine", w pandas API on Spark „across multiple machines". Po konwersji ze Spark DataFrame indeks nie jest zachowany i dokładany jest domyślny | [PySpark: pandas API on Spark, best practices](https://spark.apache.org/docs/latest/api/python/tutorial/pandas_on_spark/best_practices.html) |
| Źródła danych Spark SQL: Parquet, ORC, JSON, CSV, tekst, XML, Avro, Protobuf, tabele Hive, JDBC | [Spark: Data Sources](https://spark.apache.org/docs/latest/sql-data-sources.html) |
| Spark zaczął się w 2009 w UC Berkeley AMPLab, otwarty na początku 2010, w Apache Software Foundation od 2013 | [Apache Spark: History](https://spark.apache.org/history.html) |
| Cel autorów: model, który „supports a much wider class of applications than MapReduce, while maintaining its automatic fault tolerance"; zastosowania: algorytmy iteracyjne i interaktywna analiza. To opis prac badawczych z lat 2010–2016, a nie aktualny benchmark, więc lekcja nie podaje żadnych liczb przyspieszenia | [Apache Spark: Research](https://spark.apache.org/research.html) |
| „Databricks is built on top of Apache Spark". „Apache Spark is the technology powering compute clusters and SQL warehouses in Databricks." | [Databricks: PySpark](https://docs.databricks.com/aws/en/pyspark/), [Apache Spark overview](https://docs.databricks.com/aws/en/spark/) (2026-09-11) |
| Photon: natywny dla Databricks wektorowy silnik zapytań, „compatible with Apache Spark APIs, so it works with your existing code" | [Databricks: Photon](https://docs.databricks.com/aws/en/compute/photon) (2026-09-11) |
| SQL warehouse: „a compute resource that lets you query and explore data on Databricks" | [Databricks: SQL warehouses](https://docs.databricks.com/aws/en/compute/sql-warehouse/) (2026-10-09) |
| pandas: „data structures for in-memory analytics", zbiory większe niż pamięć są „somewhat tricky", a już te zajmujące znaczną część pamięci „become unwieldy, as some pandas operations need to make intermediate copies". Sekcje: Load less data, Use efficient datatypes, Use chunking, Use Other Libraries. Chunking: „As long as each chunk fits in memory, you can work with datasets that are much larger than memory"; działa dobrze przy „zero or minimal coordination between chunks", a „Some operations, like groupby, are much harder to do chunkwise" | [pandas 3.1.1: Scaling to large datasets](https://pandas.pydata.org/docs/user_guide/scale.html) |
| Snowflake: trzy warstwy (storage, compute, cloud services). Zapytania przetwarzają klastry MPP; „Each virtual warehouse is an independent compute cluster". Snowflake zarządza wszystkimi aspektami przechowywania danych (organizacja, rozmiar plików, kompresja, statystyki). Tabele Iceberg trzymają pliki w zewnętrznym storage | [Snowflake: Key concepts and architecture](https://docs.snowflake.com/en/user-guide/intro-key-concepts) |
| Rozmiar warehouse określa zasoby obliczeniowe klastra; każdy kolejny rozmiar podwaja zużycie kredytów na godzinę | [Snowflake: Overview of warehouses](https://docs.snowflake.com/en/user-guide/warehouses-overview) |

### Lekcja 02: Spark Execution Architecture (sprawdzone 2026-11-27)

Strony Apache Spark i PySpark to dokumentacja wersji **4.3.0**. Kod źródłowy: tag `v4.0.1`. Lekcja powołuje się też na wcześniejsze wpisy tego pliku (wartości domyślne AQE i shuffle'u, `spark.task.maxFailures`, `spark.task.cpus`, broadcast budowany na driverze, Spark Connect, serverless bez Spark UI, akumulatory).

| Fakt | Źródło |
| --- | --- |
| Job: „A parallel computation consisting of multiple tasks that gets spawned in response to a Spark action (e.g. `save`, `collect`)". Stage: „Each job gets divided into smaller sets of tasks called stages that depend on each other". Driver program: „The process running the main() function of the application and creating the SparkContext". „Because the driver schedules tasks on the cluster, it should be run close to the worker nodes" | [Spark: Cluster Mode Overview](https://spark.apache.org/docs/latest/cluster-overview.html) |
| Tryb `client`: „the submitter launches the driver outside of the cluster". Tryb `cluster`: „the framework launches the driver inside of the cluster". W trybie `client` driver działa w procesie `spark-submit` | tamże oraz [Spark: Submitting Applications](https://spark.apache.org/docs/latest/submitting-applications.html) |
| `local[K,F]`: „Run Spark locally with K worker threads and F maxFailures" | [Spark: Submitting Applications](https://spark.apache.org/docs/latest/submitting-applications.html) |
| „The entry point into all functionality in Spark is the SparkSession class." | [Spark: SQL Getting Started](https://spark.apache.org/docs/latest/sql-getting-started.html) |
| SparkSession: „The entry point to programming Spark with the Dataset and DataFrame API." `newSession()`: „separate SQLConf, registered temporary views and UDFs, but shared SparkContext and table cache". `sparkContext`: „Returns the underlying SparkContext." | [PySpark API: SparkSession](https://spark.apache.org/docs/latest/api/python/reference/pyspark.sql/api/pyspark.sql.SparkSession.html) i strony `newSession`, `sparkContext` |
| SparkContext: „Main entry point for Spark functionality. A SparkContext represents the connection to a Spark cluster, and can be used to create RDD and broadcast variables on that cluster." „Only one SparkContext should be active per JVM. You must stop() the active SparkContext before creating a new one." | [PySpark API: SparkContext](https://spark.apache.org/docs/latest/api/python/reference/api/pyspark.SparkContext.html) |
| SQLContext: wejście do danych strukturalnych „in Spark 1.x". „As of Spark 2.0, this is replaced by SparkSession. However, we are keeping the class here for backward compatibility." | docstring `pyspark.sql.SQLContext` w PySpark 4.0.1 |
| Spark Connect: „some APIs such as SparkContext and RDD are not supported"; „the client does not have access to the static Spark configuration or the SparkContext" | [Spark: Spark Connect Overview](https://spark.apache.org/docs/latest/spark-connect-overview.html) |
| Leniwe jest wykonanie zapytań (transformacje, `spark.sql("select …")`), a akcje i polecenia SQL (`spark.sql("insert …")`, `spark.sql("create …")`) wykonują się od razu, tak samo w Spark Classic i Spark Connect. Spark Classic analizuje plan od razu przy budowie. Spark Connect odkłada analizę: „Any operation that requires a resolved plan—such as accessing a schema, explaining the plan, persisting a DataFrame, or executing an action—causes the client to send the unresolved plans to the server over RPC." | [Spark: Eager vs Lazy, Spark Connect vs Spark Classic](https://spark.apache.org/docs/latest/spark-connect-gotchas.html) |
| `getOrCreate()`: zwraca istniejącą sesję albo tworzy nową; „In case an existing SparkSession is returned, the config options specified in this builder will be applied to the existing SparkSession" | docstring `SparkSession.Builder.getOrCreate` w PySpark 4.0.1 |
| AQE zamienia sort-merge join na broadcast hash join, gdy statystyki z wykonania pokazują, że strona joina jest poniżej progu adaptacyjnego | [Spark: Performance Tuning](https://spark.apache.org/docs/latest/sql-performance-tuning.html) |
| `EXPLAIN` domyślnie pokazuje tylko plan fizyczny. `EXTENDED`: „Generates parsed logical plan, analyzed logical plan, optimized logical plan and physical plan." Parsed to plan nierozwiązany, analyzed zamienia `unresolvedAttribute` i `unresolvedRelation` na obiekty z typami, optimized powstaje przez zestaw reguł optymalizacji. `FORMATTED`: zarys planu fizycznego i szczegóły węzłów | [Spark: EXPLAIN](https://spark.apache.org/docs/latest/sql-ref-syntax-qry-explain.html) |
| Zakładka SQL: wszystkie zapytania SQL i DataFrame, w tym akcje takie jak `count`, `show`, `write`; strona zapytania podaje powiązane joby i stage'e. Zakładka Jobs: liczba stage'y według stanu „(active, pending, completed, skipped, failed)" i DAG visualization: „vertices represent the RDDs or DataFrames and the edges represent an operation to be applied on RDD". Zakładka Stages: stan wszystkich stage'y wszystkich jobów | [Spark: Web UI](https://spark.apache.org/docs/latest/web-ui.html) |
| „By default, Spark's scheduler runs jobs in FIFO fashion." Fair sharing między jobami da się skonfigurować. „multiple parallel jobs can run simultaneously if they were submitted from separate threads" | [Spark: Job Scheduling](https://spark.apache.org/docs/latest/job-scheduling.html) |
| `spark.task.maxFailures` 4: „Number of continuous failures of any particular task before giving up on the job"; „Number of allowed retries = this value - 1". `spark.stage.maxConsecutiveAttempts` 4. `spark.speculation` false. `spark.locality.wait` 3s: „How long to wait to launch a data-local task before giving up and launching it on a less-local node" | [Spark: Configuration](https://spark.apache.org/docs/latest/configuration.html) |
| Shuffle: Spark tworzy zadania „map" porządkujące dane i „reduce" agregujące je. Pliki shuffle są zachowywane, żeby nie tworzyć ich od nowa przy ponownym liczeniu | [Spark: RDD Programming Guide](https://spark.apache.org/docs/latest/rdd-programming-guide.html) |
| AQE „makes use of the runtime statistics to choose the most efficient query execution plan"; skleja partycje po shuffle'u na podstawie statystyk wyjścia map. `spark.sql.shuffle.partitions` 200: liczba partycji przy shuffle'u dla joinów i agregacji. O osobnych jobach AQE ta strona nie mówi | [Spark: Performance Tuning](https://spark.apache.org/docs/latest/sql-performance-tuning.html) |
| Stage'e powstają przez cięcie grafu na granicach shuffle'u; operacje z zależnością narrow są łączone w jeden zestaw tasków. Granica to bariera: trzeba poczekać na poprzedni stage. Dwa rodzaje: `ShuffleMapStage` (zapisuje pliki wyjścia map) i `ResultStage` (ostatni, wykonuje akcję). Job może wymagać wielu stage'y. Scheduler pamięta, które stage'e już zapisały pliki shuffle, żeby ich nie powtarzać. Preferowane miejsce taska wynika z cache i położenia danych shuffle. Awarie wewnątrz stage'a obsługuje ponawianie tasków; po utracie pliku wyjścia map (`FetchFailed`, `ExecutorLost`) utracony stage jest wysyłany ponownie dla brakujących tasków | komentarz klasy [`DAGScheduler`](https://github.com/apache/spark/blob/v4.0.1/core/src/main/scala/org/apache/spark/scheduler/DAGScheduler.scala) i [`TaskSetManager`](https://github.com/apache/spark/blob/v4.0.1/core/src/main/scala/org/apache/spark/scheduler/TaskSetManager.scala), Apache Spark 4.0.1. To opis w kodzie, nie w dokumentacji użytkownika |
### Lekcja 03: Partitioning & Shuffle (sprawdzone 2026-11-27)

Strony Apache Spark to dokumentacja wersji **4.3.0**. Pomiary lekcji są wyżej (`shuffle_lab.py`), a część liczb pochodzi z istniejącego `spark_checks.py`.

| Fakt | Źródło |
| --- | --- |
| „The shuffle is Spark's mechanism for re-distributing data so that it's grouped differently across partitions. This typically involves copying data across executors and machines, making the shuffle a complex and costly operation." Shuffle mogą wywołać operacje repartition (`repartition`, `coalesce`), operacje 'ByKey (poza liczeniem) i joiny | [Spark: RDD Programming Guide, Shuffle operations](https://spark.apache.org/docs/latest/rdd-programming-guide.html#shuffle-operations) |
| „The Shuffle is an expensive operation since it involves disk I/O, data serialization, and network I/O." Taski „map" organizują dane, taski „reduce" je agregują; nazwy pochodzą z MapReduce. Wyniki tasków map są trzymane w pamięci, dopóki się mieszczą, potem sortowane według partycji docelowej i zapisywane do jednego pliku; taski reduce czytają odpowiednie bloki | tamże |
| Część operacji shuffle zużywa dużo pamięci na struktury budowane przed transferem albo po nim. Gdy dane się nie mieszczą, Spark zrzuca je na dysk (spill), kosztem dodatkowego I/O i garbage collection. Pliki pośrednie shuffle'u są zachowywane, żeby nie tworzyć ich ponownie | tamże |
| RDD `repartition(numPartitions)`: „Reshuffle the data in the RDD randomly to create either more or fewer partitions and balance it across them. This always shuffles all data over the network." RDD `coalesce`: „Decrease the number of partitions […] Useful for running operations more efficiently after filtering down a large dataset." | tamże, tabela transformacji |
| `NarrowDependency`: „Base class for dependencies where each partition of the child RDD depends on a small number of partitions of the parent RDD. Narrow dependencies allow for pipelined execution." Narrow nie znaczy więc „jedna partycja wejścia na jedną partycję wyniku": `coalesce` bez shuffle'u też jest narrow. `OneToOneDependency` i `RangeDependency` to jej szczególne przypadki | [Spark JavaDoc 4.3.0: NarrowDependency](https://spark.apache.org/docs/latest/api/java/org/apache/spark/NarrowDependency.html) |
| `spark.sql.adaptive.advisoryPartitionSizeInBytes` (64 MB) to rozmiar doradczy, używany przy sklejaniu małych i dzieleniu skośnych partycji. `spark.sql.files.maxPartitionBytes` (128 MB) działa tylko dla źródeł plikowych, przy odczycie | [Spark: Performance Tuning](https://spark.apache.org/docs/latest/sql-performance-tuning.html) |
| Shuffle read obejmuje dane czytane lokalnie i z innych executorów, więc sieć dotyczy tylko bloków zdalnych | [Spark: Web UI](https://spark.apache.org/docs/latest/web-ui.html) |
| Stage: „Each job gets divided into smaller sets of tasks called stages that depend on each other (similar to the map and reduce stages in MapReduce)". Zdania wprost „shuffle wyznacza granicę stage'a" w dokumentacji użytkownika nie znalazłem: lekcja opiera to na tej definicji i na pomiarze (operacje z `Exchange` dały 2 stage'e, bez niego 1) | [Spark: Cluster Mode Overview](https://spark.apache.org/docs/latest/cluster-overview.html) |
| `spark.sql.shuffle.partitions`, domyślnie 200: „Configures the number of partitions to use when shuffling data for joins or aggregations." | [Spark: Performance Tuning](https://spark.apache.org/docs/latest/sql-performance-tuning.html) |
| Sklejanie partycji po shuffle'u: działa, gdy `spark.sql.adaptive.enabled` i `spark.sql.adaptive.coalescePartitions.enabled` (domyślnie true) są włączone. „You do not need to set a proper shuffle partition number to fit your dataset. Spark can pick the proper shuffle partition number at runtime once you set a large enough initial number of shuffle partitions". Skleja sąsiednie partycje „to avoid too many small tasks" | tamże |
| `spark.sql.adaptive.coalescePartitions.parallelismFirst` domyślnie true: Spark ignoruje wtedy cel `advisoryPartitionSizeInBytes` (64 MB) przy sklejaniu i respektuje tylko `minPartitionSize` (1 MB), „to maximize the parallelism". Dlatego lekcja nie podaje 64 MB jako rozmiaru, do którego AQE skleja | tamże |
| Hinty: COALESCE (liczba partycji), REPARTITION (liczba, kolumny albo jedno i drugie), REPARTITION_BY_RANGE, REBALANCE. Służą do strojenia wydajności i ograniczania liczby plików wyjściowych | tamże, sekcja „Coalesce Hints" |
| „In general, we recommend 2-3 tasks per CPU core in your cluster." Za duży zbiór roboczy jednego taska może skończyć się `OutOfMemoryError`; najprostsza poprawka to zwiększenie równoległości, żeby wejście każdego taska było mniejsze. Spark sprawnie obsługuje taski trwające nawet 200 ms | [Spark: Tuning](https://spark.apache.org/docs/latest/tuning.html) |
| Metryki: Shuffle write (bajty i rekordy zapisane na dysk dla przyszłego shuffle'u), Shuffle Read Size / Records (lokalnie i z innych executorów), Shuffle Read Fetch Wait Time, Shuffle Remote Reads, Shuffle spill (memory) i (disk), Peak execution memory | [Spark: Web UI](https://spark.apache.org/docs/latest/web-ui.html) |
| `DataFrame.repartition` z kolumnami: „The resulting DataFrame is hash partitioned." | docstring `DataFrame.repartition` w PySpark 4.0.1 |
| `coalesce`: „If a larger number of partitions is requested, it will stay at the current number of partitions." Zależność narrow, bez shuffle'u; drastyczne `coalesce(1)` może przenieść obliczenia na jeden węzeł, a `repartition` dodaje shuffle, ale zostawia wcześniejsze partycje liczone równolegle | [Spark ScalaDoc 4.3.0: Dataset.coalesce](https://spark.apache.org/docs/latest/api/scala/org/apache/spark/sql/Dataset.html), potwierdzone pomiarem |
| Databricks: `spark.sql.shuffle.partitions` domyślnie 200; wartość `auto` włącza auto-optimized shuffle, który dobiera liczbę na podstawie planu i rozmiaru danych wejściowych | [Databricks: Adaptive query execution](https://docs.databricks.com/aws/en/optimizations/aqe) (2026-10-12) |
| Databricks serverless: `spark.sql.shuffle.partitions` jest jedną z nielicznych właściwości, które da się ustawić, z wartością domyślną `auto` | [Databricks: Set Spark configuration properties](https://docs.databricks.com/aws/en/spark/conf) (2026-09-11) |
| Snowflake: dane tabel są automatycznie dzielone na mikropartycje, każda zawiera 50–500 MB danych przed kompresją; użytkownik ich nie definiuje ani nie utrzymuje | [Snowflake: Micro-partitions & data clustering](https://docs.snowflake.com/en/user-guide/tables-clustering-micropartitions) |
| Snowflake: gdy warehouse'owi brakuje pamięci, dane są zrzucane na dysk lokalny, a potem do zdalnego storage, co mocno pogarsza wydajność. Zalecenia: większy warehouse albo przetwarzanie mniejszymi porcjami | [Snowflake: Queries too large to fit in memory](https://docs.snowflake.com/en/user-guide/performance-query-warehouse-memory) |
| Snowflake Query Profile: operatory m.in. Aggregate, Join, Sort; statystyki „Bytes sent over the network", „Bytes spilled to local storage", „Bytes spilled to remote storage". Na stronie nie ma operatora ani statystyki o nazwie Exchange, Repartition czy Shuffle | [Snowflake: Query Profile](https://docs.snowflake.com/en/user-guide/ui-query-profile) |

### Lekcja 04: Spark Join Strategies (sprawdzone 2026-11-27)

Strony Apache Spark to dokumentacja wersji **4.3.0** (`/docs/latest/`). Wiersze oznaczone „kod źródłowy" pochodzą z gałęzi `branch-4.0` repozytorium apache/spark, czyli z innej wersji niż dokumentacja: to stałe i komentarze w kodzie, a nie obietnice z dokumentacji użytkownika, i mogą się zmienić między wersjami.

| Fakt | Źródło |
| --- | --- |
| `spark.sql.autoBroadcastJoinThreshold`: domyślnie 10485760 (10 MB), „the maximum size in bytes for a table that will be broadcast to all worker nodes when performing a join. By setting this value to -1, broadcasting can be disabled." `spark.sql.broadcastTimeout`: domyślnie 300, „Timeout in seconds for the broadcast wait time in broadcast joins" | [Spark: Performance Tuning](https://spark.apache.org/docs/latest/sql-performance-tuning.html) |
| Hinty strategii: BROADCAST, MERGE, SHUFFLE_HASH, SHUFFLE_REPLICATE_NL. Priorytet w tej kolejności. Hint BROADCAST jest uwzględniany „even if the size of table […] suggested by the statistics is above the configuration spark.sql.autoBroadcastJoinThreshold". Gdy obie strony mają hint BROADCAST albo SHUFFLE_HASH, stronę build Spark dobiera z typu joina i rozmiarów | tamże oraz [Spark: Hints](https://spark.apache.org/docs/latest/sql-ref-syntax-qry-select-hints.html) |
| AQE zamienia sort merge na broadcast hash join, gdy statystyki z wykonania którejś strony są poniżej progu adaptacyjnego. „This is not as efficient as planning a broadcast hash join in the first place, but it’s better than continuing the sort-merge join". `spark.sql.adaptive.autoBroadcastJoinThreshold` domyślnie równy `spark.sql.autoBroadcastJoinThreshold`. Lokalny odczyt shuffle'u: `spark.sql.adaptive.localShuffleReader.enabled`, domyślnie true | [Spark: Performance Tuning](https://spark.apache.org/docs/latest/sql-performance-tuning.html) |
| AQE może też zamienić sort merge na shuffled hash join, gdy wszystkie partycje po shuffle'u są mniejsze niż `spark.sql.adaptive.maxShuffledHashJoinLocalMapThreshold` (domyślnie 0) | tamże |
| Trzy źródła statystyk: źródło danych (np. liczniki i min/max w metadanych Parquet), katalog (zbierane przez `ANALYZE TABLE`), wykonanie (`isRuntime=true` w planie). „Missing or inaccurate statistics will hinder Spark’s ability to select an optimal plan" | tamże, sekcja Leveraging Statistics; [Spark: ANALYZE TABLE](https://spark.apache.org/docs/latest/sql-ref-syntax-aux-analyze-table.html) |
| Broadcast hash join: tylko warunek równości, wszystkie typy joina poza full outer; „broadcasting tables is a network-intensive operation and it could cause OOM or perform badly in some cases, especially when the build/broadcast side is big". Shuffle hash join: warunek równości, wszystkie typy joina; „Building hash map from table is a memory-intensive operation and it could cause OOM when the build side is big". Sort merge join: warunek równości i klucze sortowalne, wszystkie typy joina | kod źródłowy: komentarz nad `JoinSelection` w [SparkStrategies.scala](https://github.com/apache/spark/blob/branch-4.0/sql/core/src/main/scala/org/apache/spark/sql/execution/SparkStrategies.scala) |
| Kolejność wyboru dla joina z warunkiem równości. Hinty: broadcast, sort merge, shuffle hash, shuffle replicate NL. Bez hintu: broadcast hash (strona mieści się w progu i typ joina obsługiwany), shuffle hash (tylko gdy `preferSortMergeJoin` jest false, strona jest dość mała na lokalną tablicę i dużo mniejsza od drugiej), sort merge (klucze sortowalne), iloczyn kartezjański (inner), broadcast nested loop join | tamże, komentarze w `JoinSelection.apply` |
| Strona build w broadcast hash join: lewa dla inner i right outer; prawa dla inner, left outer, left semi, left anti (oraz typów wewnętrznych LeftSingle i ExistenceJoin). Shuffled hash join: obie strony dla inner, left outer, right outer i full outer. Warunek rozmiaru broadcastu: `sizeInBytes <= autoBroadcastJoinThreshold`. Lokalna tablica hashująca: `sizeInBytes < autoBroadcastJoinThreshold * numShufflePartitions`; „dużo mniejsza": rozmiar razy `spark.sql.shuffledHashJoinFactor` (domyślnie 3) nie większy niż druga strona | kod źródłowy: `JoinSelectionHelper` w [joins.scala](https://github.com/apache/spark/blob/branch-4.0/sql/catalyst/src/main/scala/org/apache/spark/sql/catalyst/optimizer/joins.scala), [SQLConf.scala](https://github.com/apache/spark/blob/branch-4.0/sql/catalyst/src/main/scala/org/apache/spark/sql/internal/SQLConf.scala) |
| `spark.sql.join.preferSortMergeJoin`: ustawienie wewnętrzne, domyślnie true. „Sort merge join consumes less memory than shuffled hash join and it works efficiently when both join tables are large. On the other hand, shuffled hash join can improve performance (e.g., of full outer joins) when one of join tables is much smaller." `spark.sql.cbo.enabled`: domyślnie false | kod źródłowy: [SQLConf.scala](https://github.com/apache/spark/blob/branch-4.0/sql/catalyst/src/main/scala/org/apache/spark/sql/internal/SQLConf.scala); wartości potwierdzone labem |
| Limity broadcastu, liczone na zbudowanej relacji: `MAX_BROADCAST_TABLE_BYTES = 8L << 30` (8 GiB, błąd przy `dataSize >=`), wiersze: 512 000 000, a dla tablicy hashującej z kluczem innym niż pojedynczy long ok. 341 mln. Komunikat przy braku pamięci: „Not enough memory to build and broadcast the table to all worker nodes. As a workaround, you can either disable broadcast by setting [autoBroadcastJoinThreshold] to -1 or increase the spark driver memory" | kod źródłowy: [BroadcastExchangeExec.scala](https://github.com/apache/spark/blob/branch-4.0/sql/core/src/main/scala/org/apache/spark/sql/execution/exchange/BroadcastExchangeExec.scala) i `error-conditions.json`. Samego błędu lab nie wywołuje |
| Databricks: `spark.databricks.adaptive.autoBroadcastJoinThreshold` domyślnie 30MB. „A broadcast join that the optimizer plans before the query runs usually performs better than one that AQE plans at runtime." „AQE can't broadcast the left side of a LEFT OUTER JOIN." Hinty: ta sama kolejność priorytetów i brak gwarancji | [Databricks: Adaptive query execution](https://docs.databricks.com/aws/en/optimizations/aqe), [Databricks: Hints](https://docs.databricks.com/aws/en/sql/language-manual/sql-ref-syntax-qry-select-hints) (obie 2026-10-12) |

Obie wizualizacje lekcji 04 (krok po kroku i rachunek rozmiarów) są ilustracjami. Rachunek rozmiarów to arytmetyka na jawnych założeniach (20 executorów, 200 partycji, równy rozkład kluczy), a nie pomiar i nie model optymalizatora.
Liczby w wierszu „Do przeniesienia" to szacunek logicznej ilości danych, a nie bajty wysłane po sieci: faktyczny transfer zależy m.in. od kompresji, lokalnego odczytu shuffle'u, rozsyłania broadcastu blokami między executorami i reprezentacji tablicy hashującej. Licznik „kopii" w symulacji jest modelem dydaktycznym, nie stanem pamięci.
Limit 8 GB dotyczy rozmiaru zbudowanej relacji (`dataSize` w `BroadcastExchangeExec`, gałąź 4.0), a nie rozmiaru plików ani tabeli. Przykład 40 GB w ilustracji zakłada wprost, że tyle ma zbudowana relacja.
### Lekcja 05: Data Skew & AQE (sprawdzone 2026-11-27)

Strony Apache Spark to dokumentacja wersji **4.3.0**. Pomiary są w tabeli `labs/data_skew/skew_aqe_lab.py` wyżej. Symulacja stage'a, tabele metryk „Stage A / Stage B", rysunki trzech ruchów AQE i liczby w scenariuszach diagnozy są ilustracjami z wymyślonymi liczbami i tak są podpisane.

| Fakt | Źródło |
| --- | --- |
| AQE „makes use of the runtime statistics to choose the most efficient query execution plan, which is enabled by default since Apache Spark 3.2.0"; przełącznik `spark.sql.adaptive.enabled` | [Spark: Performance Tuning](https://spark.apache.org/docs/latest/sql-performance-tuning.html) |
| Sklejanie: „coalesce contiguous shuffle partitions according to the target size (`advisoryPartitionSizeInBytes`), to avoid too many small tasks". `coalescePartitions.parallelismFirst` domyślnie true: Spark ignoruje wtedy 64 MB i pilnuje tylko `minPartitionSize` (1 MB); „It's recommended to set this config to false on a busy cluster". `initialPartitionNum` domyślnie równe `spark.sql.shuffle.partitions` | tamże |
| Zmiana joina: „AQE converts sort-merge join to broadcast hash join when the runtime statistics of any join side are smaller than the adaptive broadcast hash join threshold. This is not as efficient as planning a broadcast hash join in the first place, but it's better than continuing the sort-merge join". `spark.sql.adaptive.autoBroadcastJoinThreshold`: domyślnie ta sama wartość co `spark.sql.autoBroadcastJoinThreshold` | tamże |
| Skew join: „dynamically handles skew in sort-merge join by splitting (and replicating if needed) skewed tasks into roughly evenly sized tasks". Partycja jest skośna, gdy jest większa niż `skewedPartitionFactor` (5.0) × mediana i jednocześnie większa niż `skewedPartitionThresholdInBytes` (256MB); próg „should be set larger than `advisoryPartitionSizeInBytes`". `forceOptimizeSkewedJoin` (false): wymusza regułę „even if it introduces extra shuffle" | tamże |
| Na tej stronie nie ma nic o AQE w Structured Streaming ani o skew w agregacjach i funkcjach okna. Opis reguły skew join dotyczy tylko sort-merge joina | tamże (brak wzmianki) |
| Osobna reguła poza joinami: `spark.sql.adaptive.optimizeSkewsInRebalancePartitions.enabled` (true): „optimize the skewed shuffle partitions in RebalancePartitions and split them to smaller ones according to the target size" | tamże |
| Databricks, streaming: „Databricks supports Adaptive Query Execution (AQE) and Auto Optimized Shuffle (AOS) for stateless streaming queries", Databricks Runtime 18.0+, przełącznik `spark.sql.adaptive.streaming.stateless.enabled` (domyślnie true). Strona nie wymienia obsługi skew ani innych pojedynczych funkcji AQE. Strona o AQE (2026-10-12) nadal podaje warunek „The query isn't a streaming query" i wyjątku nie wspomina: obie strony nie są spójne, więc lekcja podaje oba zdania ze źródłem | [Databricks: Stateless streaming](https://docs.databricks.com/aws/en/structured-streaming/stateless-streaming) (2026-09-11) |
| Databricks: cztery funkcje AQE (zmiana sort merge join na broadcast hash join, sklejanie partycji, skew w sort merge join i shuffle hash join, propagacja pustych relacji). AQE włączone domyślnie; warunki: zapytanie nie jest streamingowe i zawiera exchange albo podzapytanie | [Databricks: Adaptive query execution](https://docs.databricks.com/aws/en/optimizations/aqe) (2026-10-12) |
| Databricks, czytanie planu: węzeł `AdaptiveSparkPlan` z flagą `isFinalPlan` (false przed i w trakcie, true po zakończeniu); sklejanie jako `CustomShuffleReader` z własnością `Coalesced`; skew jako `SortMergeJoin` z polem `isSkew` ustawionym na true; `SQL EXPLAIN` nie wykonuje zapytania, więc AQE go nie zmienia | tamże |
| Databricks FAQ: skew tylko w joinach przez shuffle (sort merge i shuffle hash), nigdy w broadcast joinach. Strona dzielona: inner i cross obie, left outer / left semi / left anti lewa, right outer prawa, full outer żadna. „AQE doesn't reorder joins at runtime". Zaplanowany broadcast (hint) zwykle działa lepiej niż ten wybrany przez AQE w trakcie | tamże |
| Skew join hints na Databricks: strona wycofana; „Skew join hints are not required. Databricks handles skew by default by using adaptive query execution (AQE)" | [Databricks: Skew join optimization using skew hints](https://docs.databricks.com/aws/en/optimizations/skew-join) (2024-05-13, strona oznaczona jako wycofana) |
| Strona stage'a w Spark UI: „Summary metrics for all tasks are represented in a table and in a timeline", m.in. Duration, GC time, „Shuffle Read Size / Records", Shuffle spill (memory / disk). Te same metryki są w tabeli tasków | [Spark: Web UI](https://spark.apache.org/docs/latest/web-ui.html) (4.3.0) |

Wpisy bez daty (liquid clustering, VACUUM, deployment modes, DLT, Submitting Applications) pochodzą z pierwszej wersji tego pliku i nie były ponownie otwierane 2026-11-26.

### Lekcja: Production Data Platform Design (sprawdzone 2026-11-27)

Lekcja nie ma labu: wszystkie symulacje i liczby w ilustracjach są wymyślone i tak podpisane. Poniżej tylko twierdzenia o konkretnych produktach.
Strony otwierał agent pomocniczy przez narzędzie pobierające, które streszcza treść. Cytaty w cudzysłowach są więc przekazane przez to narzędzie: przed dosłownym użyciem w treści trzeba otworzyć stronę. Lekcja ich dosłownie nie cytuje.

| Fakt | Źródło |
| --- | --- |
| Snowpipe: dane „typically available for queries within minutes", obliczenia bezserwerowe zarządzane przez Snowflake (bez własnego warehouse'u), wyzwalanie powiadomieniem chmury (`AUTO_INGEST`) albo przez REST API. Strona nie używa słowa „micro-batch": to określenie z lekcji | [Snowflake: Snowpipe](https://docs.snowflake.com/en/user-guide/data-load-snowpipe-intro) |
| Snowpipe przechowuje historię ładowania 14 dni i rozpoznaje plik po ścieżce i nazwie: plik zmieniony i wgrany pod tą samą nazwą jest pomijany, nawet z innym ETag. `COPY INTO`: metadane ładowania wygasają po 64 dniach. COPY i Snowpipe mają osobne metadane | tamże oraz [Troubleshooting Snowpipe](https://docs.snowflake.com/en/user-guide/data-load-snowpipe-ts), [Load considerations](https://docs.snowflake.com/en/user-guide/data-load-considerations-load) |
| Snowpipe Streaming: wiersze trafiają do tabel bez plików pośrednich; kolejność i exactly-once dotyczą nazwanego kanału (offset tokens), kanały elastyczne dają at-least-once bez gwarancji kolejności. Lekcja mówi tylko, że gwarancje różnią się między narzędziami | [Snowflake: Snowpipe Streaming](https://docs.snowflake.com/en/user-guide/snowpipe-streaming/data-load-snowpipe-streaming-overview) |
| Streams: offset przesuwa się tylko wtedy, gdy stream jest użyty w transakcji DML; samo zapytanie go nie przesuwa. Stream staje się nieaktualny (stale), gdy offset wypadnie poza okres retencji tabeli źródłowej; Snowflake wydłuża retencję do 14 dni domyślnie (`MAX_DATA_EXTENSION_TIME_IN_DAYS`) | [Snowflake: Streams](https://docs.snowflake.com/en/user-guide/streams-intro) |
| Tasks: harmonogram (interwał albo cron) albo wyzwalanie, gdy stream ma dane (`SYSTEM$STREAM_HAS_DATA`); graf zadań ma zadanie główne i zadania zależne; domyślnie jedna instancja grafu naraz (`OVERLAP_POLICY = NO_OVERLAP`, zastępuje wycofany `ALLOW_OVERLAPPING_EXECUTION`); `TASK_AUTO_RETRY_ATTEMPTS` domyślnie 0; zawieszenie po 10 kolejnych niepowodzeniach | [CREATE TASK](https://docs.snowflake.com/en/sql-reference/sql/create-task), [Task graphs](https://docs.snowflake.com/en/user-guide/tasks-graphs) |
| Time Travel: standardowo 1 dzień; do 90 dni dla obiektów trwałych w edycji Enterprise lub wyższej; tabele transient i temporary 0 albo 1 dzień. Fail-safe: 7 dni, odzyskuje tylko Snowflake; tabele transient i temporary go nie mają | [Time Travel](https://docs.snowflake.com/en/user-guide/data-time-travel), [Fail-safe](https://docs.snowflake.com/en/user-guide/data-failsafe) |
| Warehouse: każdy rozmiar w górę podwaja zużycie kredytów (tabela „Gen1": XS 1, S 2, M 4, L 8 kredytów/h); rozliczenie sekundowe z minimum 60 s przy każdym starcie; zapytanie czeka w kolejce, gdy brakuje zasobów | [Warehouses overview](https://docs.snowflake.com/en/user-guide/warehouses-overview) |
| Multi-cluster warehouse: edycja Enterprise lub wyższa; służy równoczesności; dla wolnych zapytań i ładowania większą korzyść daje zmiana rozmiaru. Zmiana rozmiaru „generally improves query performance, particularly for larger, more complex queries" | [Multi-cluster warehouses](https://docs.snowflake.com/en/user-guide/warehouses-multicluster), [Warehouse considerations](https://docs.snowflake.com/en/user-guide/warehouses-considerations) |
| `QUERY_HISTORY`: kolumny `QUEUED_OVERLOAD_TIME`, `QUEUED_PROVISIONING_TIME`, `BYTES_SPILLED_TO_LOCAL_STORAGE`, `BYTES_SPILLED_TO_REMOTE_STORAGE`. Na spilling: większy warehouse albo mniejsze paczki danych | [QUERY_HISTORY](https://docs.snowflake.com/en/sql-reference/account-usage/query_history), [Queries too large to fit in memory](https://docs.snowflake.com/en/user-guide/performance-query-warehouse-memory) |
| Schema evolution: `ENABLE_SCHEMA_EVOLUTION = TRUE`, tylko `COPY INTO` z `MATCH_BY_COLUMN_NAME` i Snowpipe; dodaje kolumny (limit 100 kolumn albo jedna zmiana schematu na COPY). `VARIANT` przechowuje wartości dowolnego typu, w tym OBJECT i ARRAY | [Schema evolution](https://docs.snowflake.com/en/user-guide/data-load-schema-evolution), [Semi-structured types](https://docs.snowflake.com/en/sql-reference/data-types-semistructured) |
| Maskowanie kolumn i polityki dostępu do wierszy: edycja Enterprise lub wyższa; polityka maskowania stosowana w czasie zapytania wszędzie, gdzie występuje kolumna. Uprawnienia nadawane rolom, role użytkownikom | [Dynamic Data Masking](https://docs.snowflake.com/en/user-guide/security-column-ddm-intro), [Row access policies](https://docs.snowflake.com/en/user-guide/security-row-intro), [Access control](https://docs.snowflake.com/en/user-guide/security-access-control-overview) |
| Replikacja między regionami i chmurami; failover wymaga Business Critical lub wyższej; kopia opóźniona najwyżej o dwukrotność odstępu między odświeżeniami | [Replication](https://docs.snowflake.com/en/user-guide/replication-intro), [Account replication](https://docs.snowflake.com/en/user-guide/account-replication-intro) |
| `MERGE`: kilka wierszy źródła pasujących do jednego wiersza celu to domyślnie błąd (`ERROR_ON_NONDETERMINISTIC_MERGE = TRUE`) | [MERGE](https://docs.snowflake.com/en/sql-reference/sql/merge) |
| Resource monitor: powiadomienie albo wstrzymanie warehouse'u po wyczerpaniu puli kredytów | [Resource monitors](https://docs.snowflake.com/en/user-guide/resource-monitors) |
| dbt, modele przyrostowe: `unique_key` aktualizuje istniejące wiersze, bez niego większość adapterów tylko dopisuje. Strategie na Snowflake: `merge` (domyślna), `append`, `delete+insert`, `insert_overwrite` (zastępuje całą tabelę), `microbatch` | [Incremental models](https://docs.getdbt.com/docs/build/incremental-models), [Snowflake configs](https://docs.getdbt.com/reference/resource-configs/snowflake-configs) |
| dbt `microbatch` (od v1.9): `event_time`, `begin`, `batch_size`; `lookback` (domyślnie 1) przelicza poprzednie paczki dla spóźnionych rekordów; `--event-time-start` i `--event-time-end` do backfillu; każda paczka niezależna, `dbt retry` ponawia tylko nieudane | [Microbatch](https://docs.getdbt.com/docs/build/incremental-microbatch) |
| dbt: cztery wbudowane testy generyczne (`unique`, `not_null`, `accepted_values`, `relationships`); ważność `error` (domyślna) albo `warn`; `dbt build` idzie w kolejności zależności, a niepowodzenie testu pomija zasoby zależne. Uwaga: strona `build` opisuje sekcję o pomijaniu z adnotacją wersji, więc zachowanie warto potwierdzić na używanej wersji | [Data tests](https://docs.getdbt.com/docs/build/data-tests), [build](https://docs.getdbt.com/reference/commands/build), [severity](https://docs.getdbt.com/reference/resource-configs/severity) |
| dbt, świeżość źródeł: `loaded_at_field`, `warn_after`, `error_after`. Polecenie `dbt source freshness` jest opisane jako starsze (legacy); lekcja mówi ogólnie o „kontroli świeżości źródeł" | [freshness](https://docs.getdbt.com/reference/resource-properties/freshness) |
| dbt, kontrakt modelu: przed budową sprawdza nazwy i typy kolumn względem YAML. Na Snowflake egzekwowane jest tylko `not_null` | [Model contracts](https://docs.getdbt.com/docs/mesh/govern/model-contracts), [constraints](https://docs.getdbt.com/reference/resource-properties/constraints) |
| dbt, struktura projektu: staging, intermediate, marts; staging jeden do jednego ze źródłem, bez joinów i agregacji, zwykle widoki | [How we structure our dbt projects](https://docs.getdbt.com/best-practices/how-we-structure/1-guide-overview) |
| Monte Carlo: filary obserwowalności to freshness, quality, volume, schema, lineage. Monitory tabel wykrywają anomalie świeżości, wolumenu i schematu na podstawie metadanych, bez jawnych progów; wymagają wskazania zakresu tabel | [What is data observability](https://montecarlo.ai/blog-what-is-data-observability), [Table monitors](https://docs.getmontecarlo.com/docs/table) |
| S3: projektowany na trwałość 99,999999999% obiektów w roku; wersjonowanie zachowuje każdą wersję obiektu; powiadomienia o zdarzeniach dostarczane co najmniej raz, bez gwarancji kolejności | [S3 data durability](https://docs.aws.amazon.com/AmazonS3/latest/userguide/DataDurability.html), [S3 event notifications](https://docs.aws.amazon.com/AmazonS3/latest/userguide/EventNotifications.html) |
| AWS DMS: CDC czyta zmiany z dziennika transakcji silnika źródłowego (strona zastrzega, że to nie replikacja w czasie rzeczywistym) | [AWS DMS: CDC](https://docs.aws.amazon.com/dms/latest/userguide/CHAP_Task.CDC.html) |
| RTO: największe akceptowalne opóźnienie między przerwą a przywróceniem usługi. RPO: największy akceptowalny czas od ostatniego punktu odtwarzania. Cztery strategie: backup and restore, pilot light, warm standby, multi-site active/active | [AWS: Disaster recovery of workloads](https://docs.aws.amazon.com/whitepapers/latest/disaster-recovery-workloads-on-aws/disaster-recovery-options-in-the-cloud.html) |
| SLI: miara poziomu usługi; SLO: wartość docelowa dla SLI; SLA: umowa z konsekwencjami spełnienia albo niespełnienia SLO | [Google SRE Book: Service Level Objectives](https://sre.google/sre-book/service-level-objectives/) |
| Kafka: at-most-once (wiadomość może zginąć, nie jest dostarczana ponownie), at-least-once (nie ginie, może przyjść ponownie), exactly-once; idempotentny producent i transakcje; pozycja konsumenta w partycji to offset następnej wiadomości; kolejność w obrębie partycji | [Kafka: Design](https://kafka.apache.org/41/design/design/) |
| Spark Structured Streaming (4.3.0): domyślnie micro-batch; checkpoint i write-ahead log zapisują zakres offsetów każdej paczki; end-to-end exactly-once przy odtwarzalnym źródle i idempotentnym ujściu; watermark = największy widziany czas zdarzenia minus próg; dane starsze niż watermark „is not guaranteed to be dropped" | [Structured Streaming](https://spark.apache.org/docs/latest/streaming/index.html) |
| Databricks, medallion: bronze to dane surowe, silver zwalidowane i oczyszczone, gold „highly refined views"; wzorzec zalecany, nie wymagany | [Databricks: Medallion architecture](https://docs.databricks.com/aws/en/lakehouse/medallion) |

## Niezweryfikowane

- Lekcja Production Data Platform Design, rzeczy podane z wiedzy ogólnej albo jako rozumowanie, bez otwierania dokumentacji: scenariusz długiej transakcji, w której `updated_at` jest wcześniejsze niż chwila zatwierdzenia; paginacja kursorem kontra numerem strony; kod 429, nagłówek `Retry-After` i exponential backoff; Debezium jako narzędzie CDC, Airflow i Dagster jako orkiestratory; limit czasu funkcji Lambda; klauzula `QUALIFY` w Snowflake; lineage dbt budowany z `ref` i `source`; opis architektur Lambda i Kappa; cztery wymiary jakości danych; pojęcie budżetu błędów; trzy modele izolacji tenantów; opis podstaw przetwarzania rozproszonego; „zrzut na dysk jest wielokrotnie wolniejszy niż praca w pamięci".
- Lekcja Production Data Platform Design: lineage na poziomie pól i alertowanie w Monte Carlo znane tylko z wyników wyszukiwania, strony nie zostały otwarte. Słownik mówi ogólnie o „zależnościach między tabelami" i „alarmowaniu o odchyleniach".
- Lekcja Production Data Platform Design: wszystkie czasy, kolejki, koszty przebiegów, RPO i RTO w symulacjach i porównaniach są ilustracjami, nie pomiarami. Zdanie „większy warehouse wychodzi taniej" jest rachunkiem na wymyślonych czasach (30 min × 8 kredytów/h wobec 96 min × 4 kredyty/h), nie obserwacją.

- Lekcja 00, rzeczy podane z wiedzy ogólnej albo jako ocena, a nie cytat: dbt kompiluje modele do SQL i wysyła je do hurtowni; hurtownia potrafi ładować JSON; instalacja PySparka wystarcza do uruchomienia trybu lokalnego (tak działają laby w tym repozytorium, ale lekcja nie cytuje dokumentacji); „jedna dużo większa partycja potrafi zdominować czas zapytania". Wybór narzędzia w scenariuszach i zdanie „kilkaset GB i SQL to zwykłe zadanie dla hurtowni" to ocena inżynierska, nie fakt z dokumentacji.
- Lekcja 00, czego nie udało się potwierdzić i dlatego nie ma w treści: definicja Databricks Runtime jako zestawu komponentów oraz informacja o założycielach Databricks (na otwartych stronach dokumentacji ich nie było).
- Lekcja 02, rzeczy podane z wiedzy ogólnej: opis Query Profile w Snowflake (most w etapie Intuicja); znaczenie `*(1)` jako whole-stage code generation i `ColumnarToRow` jako kroku technicznego między czytnikiem Parquet a operatorami wierszowymi; zdanie, że utrata drivera kończy aplikację (w treści z zastrzeżeniem „w typowej konfiguracji"); że ponowiony task może trafić na inny executor; że zakładka Stages pokazuje czasy tasków i rozmiary shuffle read / write. Zdania „AQE uruchamia część planu przed shuffle'em jako osobny job" i „strona broadcast liczy się osobnym jobem" to obserwacje z labu, nie cytaty z dokumentacji.
- Lekcja 02, po review PR #13: w których dokładnie punktach AQE wolno zmienić plan (granice zmaterializowanych części planu, w tym strona broadcast) i jakie są inne niż utrata plików shuffle powody niepowodzenia stage'a. Dokumentacja użytkownika tego nie opisuje, więc treść mówi ostrożnie „najczęściej wynik shuffle'u" i „nie jest jedynym powodem". `isFinalPlan=true` lab sprawdził tylko dla `collect()` na tym samym DataFrame.
- Lekcja 02, czego lab nie sprawdza: utrata executora i plików shuffle (treść opiera się na komentarzu w kodzie `DAGScheduler`), lokalność danych i `spark.locality.wait`, spekulacja, tryb fair, tryby `client` i `cluster`, równoczesność jobów AQE.
- Lekcja 04, rzeczy podane z wiedzy ogólnej albo jako ocena: w Snowflake silnik sam dobiera algorytm joina (most w etapie Intuicja, bez otwierania dokumentacji Snowflake); `ColumnarToRow` zamienia paczki kolumn z czytnika Parquet na wiersze, a gwiazdka z numerem w planie grupuje operatory wykonywane razem; `false` w węźle `Sort` oznacza sortowanie wewnątrz partycji; „dla dwóch dużych tabel sort merge to typowy wybór" oraz zalecenia w czterech scenariuszach to ocena inżynierska oparta na opisach z kodu źródłowego, a nie pomiar. Lab nie mierzy czasu ani pamięci żadnej strategii.
- Lekcja 04, czego nie sprawdzono i dlatego jest w treści tylko jako zastrzeżenie: zachowanie na prawdziwym klastrze, na Databricks i w Photonie; faktyczne wywołanie błędu braku pamięci albo limitu 8 GB; wpływ statystyk kolumn i optymalizatora kosztowego na szacunek po filtrze.
- Lekcja 05, rzeczy podane z wiedzy ogólnej albo jako wniosek, a nie cytat: numer partycji jako `hash(klucz) mod liczba_partycji` (lab potwierdza tylko skutek: jeden klucz w jednej partycji); kolumny min / mediana / max w podsumowaniu stage'a w Spark UI (dokumentacja mówi tylko o tabeli i osi czasu, mediany i maksimum lab bierze z REST API); bardzo duża partycja kończąca się spillem albo błędem braku pamięci; lista innych przyczyn wolnego taska (wolna maszyna, GC, kosztowna funkcja, zewnętrzny system); wyjaśnienie, dlaczego w right outer joinie nie wolno dzielić lewej strony (powielenie prawej zdublowałoby jej niedopasowane wiersze); to, że broadcast join usuwa problem skew, bo duża strona nie jest przegrupowywana po kluczu; „domyślnie AQE rezygnuje z podziału, jeśli wymagałby dodatkowego shuffle'u" (wniosek z opisu `forceOptimizeSkewedJoin`); obsługa wierszy z `NULL` przez osobną gałąź i `unionByName` oraz solenie tylko gorących kluczy (propozycje projektowe, niemierzone); testy `not_null` w dbt i automatycznie utrzymywane statystyki w Snowflake (mosty).
- Lekcja 05, po review PR #11, z wiedzy ogólnej i rozumowania: spełnienie progów i warunku strony joina daje tylko kwalifikację do podziału, a faktyczny podział zależy m.in. od tego, jak dane zapisały taski poprzedniego etapu (bloki map output) i od rozmiaru docelowego; w prawdziwym Sparku czas stage'a jest co najmniej tak długi jak najdłuższy task, a nie mu równy; podobny shuffle read nie wyklucza nierównej pracy (fan-out joina, kosztowne wiersze); w outer joinie nie wolno powielać solą strony zachowywanej; dokładny count distinct przez deduplikację par klucz–wartość.
- Lekcja 05, różnica nazw: lab na Apache Spark 4.0.1 i 4.3.0 wypisuje `SortMergeJoin(skew=true)` i `AQEShuffleRead coalesced`, a dokumentacja Databricks mówi o polu `isSkew` i węźle `CustomShuffleReader`. Lekcja podaje oba zapisy ze wskazaniem źródła. Jak plan wygląda na aktualnym Databricks Runtime, nie sprawdzałem.
- Rozmiar partycji „100–200 MB" w pytaniu o repartition: reguła praktyczna, nie cytat z dokumentacji. W treści jest tak opisana.
- Lekcja 03, rzeczy podane z wiedzy ogólnej albo jako wniosek: „za dużo partycji to narzut na planowanie i małe pliki" (dokumentacja mówi tylko o unikaniu „too many small tasks"); opis serializacji jako pracy procesora przy każdym rekordzie; „w Snowflake nie ustawiasz liczby części, na które silnik dzieli pracę"; to, że `orderBy` dzieli zakresami (pomiar w `spark_checks.py` dotyczy `repartitionByRange`); znaczenie dopisków `ENSURE_REQUIREMENTS` i `REPARTITION_BY_NUM` oraz oznaczenia `*(1)` w planie (obserwacja z labu i wiedza o kodzie Sparka, bez cytatu z dokumentacji użytkownika); „AQE skleja, ale nie powiększa liczby partycji" jako wniosek z opisu funkcji.
- Lekcja 03: zdanie „hash klucza modulo liczba partycji" jest potwierdzone tylko pomiarem (`pmod(hash(country), 4)` zgadzało się z numerem partycji dla 4 kluczy), nie cytatem z dokumentacji.
- Lekcja 03 i pytanie o repartition: „liczba partycji przy zapisie wpływa na liczbę plików, ale jej nie wyznacza (np. `partitionBy`)" oraz „250 MB to umiarkowany rozmiar partycji" to wiedza ogólna, bez cytatu i bez pomiaru.
- Rozmiar partycji „100–200 MB" w pytaniu o repartition: reguła praktyczna, nie cytat z dokumentacji. W treści jest tak opisana. Pytanie odróżnia ją teraz od 64 MB (rozmiar doradczy AQE) i 128 MB (limit przy odczycie plików).
- Fakty o Snowflake użyte w mostach (result cache, pruning mikropartycji, automatic clustering, offset w Streams, Time Travel i Fail-safe): podane z wiedzy ogólnej, bez otwierania dokumentacji Snowflake.
- Warianty, których laby nie uruchamiają: Spark Connect, Databricks serverless, Photon, prawdziwy klaster z wieloma executorami. Wszystko, co treść o nich mówi, pochodzi z dokumentacji, nie z pomiaru.
- Limit ponowień taska w follow-upach o awarii executora: odpowiedzi mówią „up to a retry limit" bez liczby. Liczba (`spark.task.maxFailures` = 4) jest w tabeli wyżej.
- „W samym Apache Spark nie ma result cache": wniosek z dokumentacji (wynik „may be recomputed"), a nie cytat.

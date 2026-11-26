# Laby

Samodzielne skrypty PySpark. Wyniki cytowane w lekcjach pochodzą z ich uruchomienia.

Wymagania: [uv](https://docs.astral.sh/uv/) i Java 17 lub nowsza.

```bash
cd labs
uv run lazy_evaluation/lazy_lab.py
```

Lab z rejestru `registry.json` da się też uruchomić z interfejsu: `npm run dev:labs` w katalogu głównym, potem przycisk „Uruchom lab" w lekcji albo w pytaniu. Runner wykonuje dokładnie to samo polecenie co wyżej. W rejestrze są dwa laby: `lazy_evaluation/lazy_lab.py` i `join_strategies/join_strategies_lab.py`.

Inny skrypt uruchamiasz tak samo, podając jego ścieżkę. Żeby sprawdzić inną wersję Sparka bez zmiany projektu:

```bash
uv run --no-project --with pyspark==4.3.0 python lazy_evaluation/lazy_lab.py
```

| Lab | Gdzie użyty | Co mierzy |
| --- | --- | --- |
| `lazy_evaluation/lazy_lab.py` | lekcja Lazy Evaluation, eksperymenty 1–5 | czas definicji a akcji, plan po optymalizacji, ponowne wykonanie i cache, moment zgłoszenia błędu, liczba jobów na akcję |
| `lazy_evaluation/lazy_conditions_lab.py` | ta sama lekcja, rozwinięcia pod eksperymentami | kiedy druga akcja liczy od nowa, a kiedy używa ponownie wyników shuffle'u; częściowe wypełnianie cache; od czego zależy moment błędu (ANSI, użycie kolumny); kiedy sama definicja uruchamia joba; skąd liczba jobów w `show()` |
| `lazy_evaluation/pushdown_lab.py` | ta sama lekcja, zbliżenie w etapie Mechanizm | ile wierszy skan Parquet faktycznie oddaje przy danych posortowanych i nieposortowanych oraz czy `PushedFilters` o tym mówi |
| `interview_bank/spark_checks.py` | Interview Bank, pytania o Sparku | wartości domyślne, hint broadcast a typ joina, co wędruje przez shuffle, trzy sposoby podziału na partycje, taski a równoległość, praca wykonana przez driver |
| `join_strategies/join_strategies_lab.py` | lekcja Spark Join Strategies (plany w etapie Praktyka, eksperymenty 1–3) i pytanie „Strategie joina" | ten sam join jako broadcast hash, sort merge i shuffled hash: plany fizyczne i rekordy zapisane do shuffle'u; próg broadcastu kontra szacunek rozmiaru; zamiana joina przez AQE; hinty przy różnych typach joina |

Zasada: jeśli lekcja albo pytanie w banku podaje liczbę „z uruchomienia", musi istnieć lab, który ją odtwarza.

## Jak czytać wyniki

- To pomiary lokalne: `local[3]`, czyli jeden proces z trzema wątkami. Nie ma sieci, osobnych executorów ani ponawiania zadań, więc część zachowań klastra tu nie wystąpi.
- Wynik jest obserwacją z danej wersji i konfiguracji, nie gwarancją Sparka. Liczby w treści zostały sprawdzone na PySpark 4.0.1 (przypięta) i 4.3.0. Zakres każdego wyniku jest w `docs/verified-facts.md`.
- Liczniki w UDF są oparte na akumulatorach. Na klastrze ponowione zadanie może zwiększyć taki licznik więcej niż raz.
- `pushdown_lab.py` i `lazy_conditions_lab.py` czytają metryki skanu, stopkę Parquet i zajętość cache przez wewnętrzne API JVM. To wystarcza do labu, ale nie jest stabilnym interfejsem.
- Laby nie obejmują Spark Connect, Databricks serverless ani Photona.

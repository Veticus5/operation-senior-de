# Laby

Samodzielne skrypty PySpark. Wyniki cytowane w lekcjach pochodzą z ich uruchomienia.

Wymagania: [uv](https://docs.astral.sh/uv/) i Java 17 lub nowsza.

```bash
cd labs
uv run lazy_evaluation/lazy_lab.py
```

| Lab | Lekcja | Co mierzy |
| --- | --- | --- |
| `lazy_evaluation/lazy_lab.py` | Spark: Transformations, Actions & Lazy Evaluation | czas definicji a akcji, plan po optymalizacji, ponowne wykonanie i cache, moment zgłoszenia błędu, liczba jobów na akcję |

Zasada: jeśli lekcja albo pytanie w banku podaje liczbę „z uruchomienia", musi istnieć lab, który ją odtwarza.

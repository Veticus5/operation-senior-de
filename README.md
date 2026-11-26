# Operation Senior DE

Prywatna platforma do przygotowania się do rozmów na stanowisko Senior Data Engineer.
Dwie niezależne części pod jedną stroną główną:

- **Learning Academy**: lekcje do zrozumienia tematu od zera. Narracja, symulator, kod, zadania.
- **Interview Bank**: pytania rekrutacyjne z odpowiedziami PL/EN, follow-upami i trybem szybkiej powtórki. Działa bez przerabiania lekcji.

Aplikacja jest statyczna. Nie ma backendu, bazy ani logowania. Postęp zapisuje się w `localStorage` przeglądarki.

## Uruchomienie

Wymagania: Node.js 20.19 lub nowszy (CI używa 22).

```bash
npm install
npm run dev
```

Adres pojawi się w terminalu, domyślnie http://localhost:5173.

| Polecenie | Co robi |
| --- | --- |
| `npm run dev` | serwer deweloperski z odświeżaniem |
| `npm run typecheck` | TypeScript w trybie strict |
| `npm run test` | testy jednostkowe i testy spójności treści (vitest) |
| `npm run build` | build produkcyjny do `apps/web/dist` |
| `npm run preview` | podgląd buildu produkcyjnego |
| `npm run check` | typecheck, testy i build po kolei. To samo sprawdza CI |

Build używa ścieżek względnych, więc `apps/web/dist` można otworzyć z dowolnego serwera plików statycznych.

## Laby PySpark

Wymagania: [uv](https://docs.astral.sh/uv/) i Java 17 lub nowsza.

```bash
cd labs
uv run lazy_evaluation/lazy_lab.py
```

Szczegóły w [labs/README.md](labs/README.md).

## Struktura

```
apps/web/src/
  academy/            widoki Learning Academy, jeden podkatalog na lekcję
  interview-bank/     lista pytań, widok pytania, szybka powtórka, filtrowanie
  components/         elementy wspólne (powłoka, przycisk kopiowania)
  lib/                router na hashach, magazyn postępu
  content.test.ts     testy spójności treści (unikalne id, komplet PL/EN, długość odpowiedzi)
  styles/             base.css (tokeny i styl lekcji), app.css (powłoka, bank, poprawki)
content/
  types.ts            model treści: Question, LessonMeta
  index.ts            rejestr pytań i lekcji, powiązania po topicId
  spark/              pytania i treść lekcji Spark
  delta-lake/         pytania Delta Lake
  databricks/         pytania Databricks
labs/                 samodzielne skrypty PySpark (uv)
docs/verified-facts.md  liczby i źródła, na które powołuje się treść
AGENTS.md             zasady współpracy dla Claude i ChatGPT
```

Treść jest oddzielona od interfejsu. Dodanie pytania nie wymaga dotykania `apps/web`.

## Jak dodać pytanie do Interview Bank

1. Dopisz obiekt `Question` w `content/<obszar>/questions.ts`. Pola opisuje `content/types.ts`.
2. Nadaj stabilne `id` (np. `spark-data-skew`) i `topicId` (np. `spark.data-skew`). Jeśli istnieje lekcja o tym samym `topicId`, pytanie samo dostanie do niej link.
3. Uruchom `npm run test`. Testy pilnują unikalnych identyfikatorów, kompletu wersji PL i EN oraz długości odpowiedzi (55–140 słów, czyli około 30–60 sekund mówienia).

Nowy obszar (np. Snowflake): dodaj wartość do typu `Area` i `AREA_LABEL` w `content/types.ts`, utwórz `content/<obszar>/questions.ts` i dołącz go w `content/index.ts`.

## Jak dodać lekcję

1. Treść: `content/<obszar>/<lekcja>/lesson.ts` z eksportem `meta: LessonMeta`. Dołącz ją w `content/index.ts`.
2. Widok: `apps/web/src/academy/<lekcja>/` i wpis w rejestrze `LESSONS` w `apps/web/src/App.tsx`.
3. Lab: skrypt w `labs/`, który odtwarza każdą liczbę podaną w lekcji jako wynik uruchomienia.
4. Źródła: wpisy w `docs/verified-facts.md`.

Wzorcem jest lekcja `spark-lazy-evaluation`.

## Współpraca

Role, przepływ pracy przez gałęzie i pull requesty oraz standard treści opisuje [AGENTS.md](AGENTS.md).

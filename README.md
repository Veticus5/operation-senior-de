# Operation Senior DE

Platforma do przygotowania się do rozmów na stanowisko Senior Data Engineer.
Dwie niezależne części pod jedną stroną główną:

- **Learning Academy**: lekcje do zrozumienia tematu od zera. Narracja, symulator, kod, zadania.
- **Interview Bank**: pytania rekrutacyjne z odpowiedziami PL/EN, follow-upami i trybem szybkiej powtórki. Działa bez przerabiania lekcji.

Aplikacja jest statyczna. Nie ma bazy ani logowania. Postęp zapisuje się w `localStorage` przeglądarki.
Jedyny proces poza przeglądarką to opcjonalny [lokalny runner labów](#laby-pyspark): uruchamia skrypty z `labs/` na Twoim komputerze. Bez niego wszystko poza przyciskiem „Uruchom lab" działa tak samo.

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
| `npm run dev:labs` | to samo plus lokalny runner labów: laby uruchamiasz przyciskiem w lekcji i w pytaniu |
| `npm run runner` | sam runner labów, np. obok `npm run preview` |
| `npm run typecheck` | TypeScript w trybie strict |
| `npm run test` | testy jednostkowe i testy spójności treści (vitest) oraz testy runnera (`node --test`) |
| `npm run build` | build produkcyjny do `apps/web/dist` |
| `npm run preview` | podgląd buildu produkcyjnego |
| `npm run check` | typecheck, testy i build po kolei. To samo sprawdza CI |

Build używa ścieżek względnych, więc `apps/web/dist` można otworzyć z dowolnego serwera plików statycznych.

## Laby PySpark

Wymagania: [uv](https://docs.astral.sh/uv/) i Java 17 lub nowsza.

Z interfejsu, bez przechodzenia do terminala:

```bash
npm run dev:labs
```

Polecenie startuje aplikację (http://localhost:5173) i runner (http://127.0.0.1:8765). W etapie Praktyka lekcji Lazy Evaluation i w pytaniu „Transformacje, akcje i lazy evaluation" pojawia się przycisk „Uruchom lab". Wyjście na stronie to prawdziwe stdout i stderr procesu, przesyłane na żywo. Runner pokazuje też, czego brakuje w środowisku (uv, Java, jej wersja).

Albo w terminalu, jak dotąd:

```bash
cd labs
uv run lazy_evaluation/lazy_lab.py
```

Pozostałe laby i to, co mierzą, opisuje [labs/README.md](labs/README.md).

### Co runner może, a czego nie

- Nasłuchuje tylko na `127.0.0.1`. Adresu nie da się zmienić konfiguracją.
- Uruchamia wyłącznie skrypty z allowlisty `labs/registry.json`. Przeglądarka wysyła samo `id` labu. Polecenie (`uv run <skrypt>`) składa runner, bez powłoki i bez argumentów od klienta. Nie ma punktu wejścia do wykonania dowolnego kodu.
- Sprawdza nagłówki `Origin` i `Host`. Domyślnie wpuszcza `http://localhost:5173`, `http://127.0.0.1:5173` oraz te same adresy na porcie 4173 (`npm run preview`). Dodatkowe źródła: `LAB_RUNNER_ORIGINS=http://localhost:3000`.
- Limity: jedno uruchomienie naraz, limit czasu z rejestru (dla labu lazy evaluation 300 s), najwyżej 2 MB wyjścia. Po przekroczeniu, po kliknięciu „Przerwij" albo po zamknięciu strony runner zabija całą grupę procesów, razem z JVM Sparka. Pamięci nie ogranicza osobno: JVM Sparka startuje z domyślnym limitem sterty (w uruchomieniu kontrolnym `-Xmx1g`).
- Do labu przekazuje tylko kilka zmiennych środowiskowych (`PATH`, `HOME`, `JAVA_HOME`, ustawienia języka i katalogów uv).
- Ustawia labowi `SPARK_LOCAL_IP=127.0.0.1`, chyba że zmienna jest już ustawiona. Dzięki temu Spark i jego interfejs WWW (port 4040) słuchają tylko na pętli zwrotnej. To jedyna różnica względem uruchomienia w terminalu, poza `PYTHONUNBUFFERED=1`, które sprawia, że wydruki docierają na bieżąco.
- Zabijanie grupy procesów działa na Linuksie i macOS. Na Windows runner nie był sprawdzany.

Inny port: `LAB_RUNNER_PORT=9000 VITE_LAB_RUNNER_URL=http://127.0.0.1:9000 npm run dev:labs`.
Wyniki są pomiarami lokalnymi: pokazują mechanizm, ale nie są gwarancjami Sparka. Zakres każdego wyniku jest w [docs/verified-facts.md](docs/verified-facts.md).

## Struktura

```
apps/lab-runner/      lokalny runner labów: serwer HTTP na 127.0.0.1 bez zależności (server.mjs), start razem z Vite (dev.mjs)
apps/web/src/
  academy/            widoki Learning Academy, jeden podkatalog na lekcję
  interview-bank/     lista pytań, widok pytania, szybka powtórka, filtrowanie
  components/         elementy wspólne: powłoka, TermTooltip, CodeExplainer, ConceptBridge, Html, LabRunner
  lib/                router na hashach, magazyn postępu, parser fragmentów treści (richText), klient runnera (labRunner)
  content.test.ts     testy spójności treści (stałe id, komplet PL/EN, długość odpowiedzi, hasła słownika)
  styles/             base.css (tokeny i styl lekcji), app.css (powłoka, bank, poprawki)
content/
  types.ts            model treści: Question, LessonMeta, Bridge, ExplainedLine
  index.ts            rejestr pytań i lekcji, powiązania po topicId
  glossary.ts         słownik pojęć, jedno źródło definicji dla lekcji i banku
  labs.ts             laby uruchamiane z interfejsu (czyta labs/registry.json)
  spark/              pytania i treść lekcji Spark
  delta-lake/         pytania Delta Lake
  databricks/         pytania Databricks
labs/                 samodzielne skrypty PySpark (uv) i registry.json: allowlista runnera
docs/verified-facts.md  liczby i źródła, na które powołuje się treść
AGENTS.md             zasady współpracy dla Claude i ChatGPT
```

Treść jest oddzielona od interfejsu. Dodanie pytania nie wymaga dotykania `apps/web`.

## Jak dodać pytanie do Interview Bank

1. Dopisz obiekt `Question` w `content/<obszar>/questions.ts`. Pola opisuje `content/types.ts`.
2. Nadaj stabilne `id` (np. `spark-data-skew`) i `topicId` (np. `spark.data-skew`). Jeśli istnieje lekcja o tym samym `topicId`, pytanie samo dostanie do niej link.
3. Napisz `explain`: 2–5 akapitów po polsku, które tłumaczą mechanizm od podstaw. Pojęcia poboczne oznacz `<term id="...">` (hasła są w `content/glossary.ts`).
4. Uruchom `npm run test`. Testy pilnują stałych identyfikatorów, kompletu wersji PL i EN, długości odpowiedzi (55–140 słów, czyli około 30–60 sekund mówienia), długości wyjaśnienia i tego, że każde użyte hasło istnieje w słowniku.

Nowy obszar (np. Snowflake): dodaj wartość do typu `Area` i `AREA_LABEL` w `content/types.ts`, utwórz `content/<obszar>/questions.ts` i dołącz go w `content/index.ts`.

## Jak dodać lekcję

1. Treść: `content/<obszar>/<lekcja>/lesson.ts` z eksportem `meta: LessonMeta`. Dołącz ją w `content/index.ts`.
2. Widok: `apps/web/src/academy/<lekcja>/` i wpis w rejestrze `LESSONS` w `apps/web/src/App.tsx`.
3. Lab: skrypt w `labs/`, który odtwarza każdą liczbę podaną w lekcji jako wynik uruchomienia.
4. Źródła: wpisy w `docs/verified-facts.md`, z wersją i zakresem.
5. Etap Interview bierze pytanie, krótką odpowiedź i follow-upy z banku (pytanie o tym samym `topicId`). Nie pisz ich drugi raz w lekcji.

Kryteria dydaktyczne, które lekcja musi spełnić, są w [AGENTS.md](AGENTS.md).

## Jak udostępnić lab w interfejsie

1. Dopisz wpis do `labs/registry.json`: stabilne `id`, ścieżka skryptu względem `labs/`, tytuł, jedno zdanie o tym, co lab mierzy, zakres wyniku i limit czasu.
2. Dopisz kod skryptu do `apps/web/src/lib/labSources.ts`, żeby był widoczny także bez runnera.
3. Powiąż lab z treścią przez `id`: w pytaniu polem `labIds`, w lekcji komponentem `<LabRunner labId="..." />`.
4. `npm run test` sprawdzi, że identyfikatory istnieją i się nie zmieniły, a skrypt leży wewnątrz `labs/`.

Wzorcem jest lekcja `spark-lazy-evaluation`.

## Współpraca

Role, przepływ pracy przez gałęzie i pull requesty oraz standard treści opisuje [AGENTS.md](AGENTS.md).

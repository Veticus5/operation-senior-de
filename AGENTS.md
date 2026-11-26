# AGENTS.md

Wspólne zasady dla wszystkich agentów AI pracujących w tym repozytorium (Claude, ChatGPT) i dla właściciela.
Jeśli coś w tym pliku kłóci się z bieżącym poleceniem Macieja, wygrywa polecenie Macieja.

## Cel

Jeden: Maciej zdobywa kontrakt Senior Data Engineer. Platforma jest narzędziem, nie celem.
Każdą zmianę oceniaj pytaniem: czy po niej Maciej lepiej odpowie na pytanie rekruterowi albo szybciej zrozumie temat?
Jeśli nie, zmiana może poczekać.

Profil ucznia: mocny w Snowflake, dbt, SQL i Pythonie. Luki w Sparku, Databricks, Delta Lake i streamingu.
Tłumacz nowe przez znane, ale zaznaczaj, gdzie analogia się kończy.

## Role

| Kto | Rola | Odpowiada za |
| --- | --- | --- |
| Maciej | Product Owner | priorytety, akceptację zmian, decyzję o merge'u |
| Claude | Developer & Content Creator | kod, lekcje, pytania, laby, poprawki po review |
| ChatGPT | Technical Reviewer & Interview Mentor | review pull requestów: poprawność techniczna, jakość dydaktyczna, wartość rekrutacyjna |

## Przepływ pracy

1. `main` zawsze przechodzi `npm run check`.
2. Każda istotna zmiana powstaje na gałęzi i trafia do pull requesta. Nazwy gałęzi: `lesson/<temat>`, `bank/<temat>`, `fix/<opis>`, `chore/<opis>`.
3. Opis pull requesta mówi: co się zmieniło, jak to sprawdzić, skąd pochodzą nowe fakty (lab albo link do dokumentacji).
4. ChatGPT robi review. Claude nanosi poprawki na tej samej gałęzi.
5. **Merge do `main` wykonuje się dopiero po akceptacji Macieja.** Żaden agent nie merguje istotnej zmiany sam.

Istotna zmiana to nowa lub zmieniona treść merytoryczna, nowa funkcja, zmiana struktury albo zależności.
Literówka czy poprawka formatowania może iść bez review, ale nadal przez pull request.

## Standard treści

Obowiązuje autorów i reviewerów.

1. **Weryfikacja.** Każde twierdzenie techniczne ma źródło: oficjalną dokumentację albo wynik labu z tego repozytorium. Wpisz je do `docs/verified-facts.md`. Rzeczy podane z pamięci trafiają tam do sekcji „Niezweryfikowane".
2. **Symulacja kontra uruchomienie.** Symulator w przeglądarce to JavaScript, nie Spark. Podpisuj go jako symulację. Liczby opisane jako wynik uruchomienia muszą się odtwarzać skryptem z `labs/`, z podaną wersją i konfiguracją.
3. **Bez kategorycznych uproszczeń.** Rozróżniaj fakt, typowe zachowanie i wyjątek. Przykłady zdań, które nie przejdą review:
   - „Exchange zawsze oznacza shuffle" (BroadcastExchange nim nie jest),
   - „jedna akcja to jeden job" (zależy od akcji i AQE, patrz `docs/verified-facts.md`),
   - „repartition gwarantuje równe partycje" (round-robin wyrównuje, hash po kluczu nie),
   - „jeden wolny task oznacza skew" (to poszlaka, potwierdza ją rozkład rozmiarów partycji),
   - „`local[3]` to trzy executory" (to trzy wątki robocze w jednym procesie).
4. **Nie tłumacz nieznanego nieznanym.** Nowe pojęcie pojawia się po tym, jak czytelnik zobaczył problem, który ono rozwiązuje. Jedno nowe pojęcie na raz.
5. **Skuteczność na rozmowie.** Odpowiedź w banku da się powiedzieć w 30–60 sekund (55–140 słów, pilnuje tego test). Rozszerzenie „senior" jest osobno. Follow-upy to pytania, które rekruter naprawdę zada jako następne.
6. **Dwa języki.** Pytanie i odpowiedź zawsze po polsku i po angielsku. Angielski ma brzmieć jak mówiony, nie jak tłumaczenie.
7. **Doświadczenie Macieja.** Powiązania ze Snowflake i dbt tylko tam, gdzie są prawdziwe. Nie wymyślaj projektów, metryk ani incydentów z jego historii zawodowej.

## Zasady techniczne

- Stack: React, TypeScript (strict), Vite, zwykły CSS z tokenami w `apps/web/src/styles/base.css`. Bez backendu, bazy, logowania i chmury.
- Nowa zależność wymaga uzasadnienia w opisie pull requesta. Domyślna odpowiedź brzmi „nie".
- Treść mieszka w `content/`, interfejs w `apps/web/`. Komponent nie zawiera treści merytorycznej wpisanej na sztywno.
- Identyfikatory `id` pytań i lekcji oraz `topicId` są stabilne. Postęp użytkownika jest po nich zapisany, więc ich zmiana kasuje mu historię.
- Postęp: `localStorage`, klucz `osde-progress-v1`. Zmiana kształtu danych wymaga nowego klucza albo migracji.
- Kierunek wizualny jest ustalony: ciemne ciepłe tło, jeden pomarańczowy akcent, Bricolage Grotesque, Figtree, JetBrains Mono. Academy jest przestronne i narracyjne, Interview Bank zwarty. Nie przerabiaj tego na dashboard.
- Bez atrap: nie dodawaj przycisków, zakładek ani sekcji, które jeszcze nie działają, ani pustych katalogów „na przyszłość".
- Układ musi działać od 390 px szerokości bez poziomego przewijania.

## Zanim otworzysz pull request

```bash
npm run check
```

Dodatkowo, gdy zmiana dotyczy:

- treści: nowe fakty są w `docs/verified-facts.md`,
- lekcji: lab uruchamia się przez `uv run` i daje liczby zgodne z lekcją,
- interfejsu: przeklikane ręcznie na szerokim ekranie i na 390 px.

## Lista kontrolna review (ChatGPT)

1. Czy każde twierdzenie jest prawdziwe w aktualnych wersjach Sparka i Databricks? Wskaż zdanie i źródło.
2. Czy gdzieś jest uproszczenie, na którym rekruter złapie kandydata?
3. Czy ktoś, kto zna SQL, a nie zna Sparka, zrozumie to bez zaglądania gdzie indziej?
4. Czy odpowiedź brzmi jak wypowiedź seniora na rozmowie, czy jak definicja z dokumentacji?
5. Czy brakuje follow-upu, który na rozmowach pada często?
6. Czy liczby opisane jako zmierzone mają pokrycie w labie?

Uwagi zapisuj jako komentarze do konkretnych linii, z proponowanym brzmieniem. Oznaczaj wagę: `blocker` (błąd merytoryczny), `should` (wyraźnie poprawia), `nit` (drobiazg).

## Znany dług techniczny

- Silnik symulatora lazy evaluation (`apps/web/src/academy/lazy-evaluation/lazySim.js`) jest przeniesiony 1:1 z zaakceptowanego prototypu: imperatywny JavaScript na DOM, opakowany komponentem React. Zachowanie było ważniejsze niż czystość. Kolejne symulatory pisz jako komponenty React i SVG. Tego nie przepisuj bez osobnej decyzji.
- Fragmenty treści lekcji są w HTML jako stringi (`content/spark/lazy-evaluation/lesson.ts`). Przy drugiej lekcji warto zdecydować, czy przejść na MDX.

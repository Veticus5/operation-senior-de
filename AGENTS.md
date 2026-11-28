# AGENTS.md

Wspólne zasady dla wszystkich agentów AI pracujących w tym repozytorium (Claude, ChatGPT) i dla właściciela.
Jeśli coś w tym pliku kłóci się z bieżącym poleceniem Macieja, wygrywa polecenie Macieja.

## Cel

Jeden: Maciej zdobywa kontrakt Senior Data Engineer. Platforma jest narzędziem, nie celem.
Każdą zmianę oceniaj pytaniem: czy po niej Maciej lepiej odpowie na pytanie rekruterowi albo szybciej zrozumie temat?
Jeśli nie, zmiana może poczekać.

Profil ucznia: zna SQL, Pythona, hurtownie danych (Snowflake) i dbt. Spark, Databricks, Delta Lake i streaming są dla niego nowe.
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
   Pomiar lokalny to obserwacja, nie gwarancja: przy każdym wyniku napisz, jak daleko wolno go uogólniać (wersja, plan, konfiguracja, `local[N]` zamiast klastra).
   W odpowiedziach do powiedzenia na głos nie pisz „zmierzyłem", dopóki uczący się sam nie uruchomił labu. Pisz „w lokalnym teście".
3. **Bez kategorycznych uproszczeń.** Rozróżniaj fakt, typowe zachowanie i wyjątek. Przykłady zdań, które nie przejdą review:
   - „Exchange zawsze oznacza shuffle" (BroadcastExchange nim nie jest),
   - „jedna akcja to jeden job" (zależy od akcji i AQE, patrz `docs/verified-facts.md`),
   - „repartition gwarantuje równe partycje" (round-robin wyrównuje, hash po kluczu nie),
   - „jeden wolny task oznacza skew" (to poszlaka, potwierdza ją rozkład rozmiarów partycji),
   - „`local[3]` to trzy executory" (to trzy wątki robocze w jednym procesie),
   - „przed akcją Spark niczego nie czyta" (schemat potrafi odczytać z metadanych pliku od razu),
   - „każda akcja liczy wszystko od nowa" (bez cache może policzyć część albo całość, wyniki shuffle'u bywają użyte ponownie),
   - „hint wymusza broadcast join" (hint to prośba, strategia może nie obsługiwać typu joina),
   - „`PushedFilters` dowodzi, że Spark przeczytał mniej" (mówi, co przekazano źródłu, nie ile pominięto),
   - „bez watermarku stan rośnie bez końca" (zależy od operatora i trybu wyjścia),
   - „cache to tabela" (to tymczasowa kopia, wypełniana leniwie, może zostać usunięta z pamięci).
   Zakres platformy też się liczy: wartość domyślna Apache Spark, zachowanie Databricks i zachowanie serverless to trzy różne rzeczy. Pisz, o której mowa.
4. **Nie tłumacz nieznanego nieznanym.** Nowe pojęcie pojawia się po tym, jak czytelnik zobaczył problem, który ono rozwiązuje. Jedno nowe pojęcie na raz.
5. **Skuteczność na rozmowie.** Odpowiedź w banku da się powiedzieć w 30–60 sekund (55–140 słów, pilnuje tego test). Rozszerzenie „senior" jest osobno. Follow-upy to pytania, które rekruter naprawdę zada jako następne.
6. **Dwa języki.** Pytanie i odpowiedź zawsze po polsku i po angielsku. Angielski ma brzmieć jak mówiony, nie jak tłumaczenie.
7. **Doświadczenie ucznia.** Powiązania ze Snowflake i dbt tylko tam, gdzie są prawdziwe. Nie wymyślaj projektów, metryk ani incydentów z jego historii zawodowej.
8. **Prywatność.** Repozytorium może być publiczne. Nie zapisuj w nim szczegółów kariery, nazw pracodawców i klientów, danych firmowych ani ocen typu „nie znasz X z produkcji". Treść ma działać dla każdego, kto zna SQL i Pythona. Przykładowe dane są wymyślone.

## Kryteria dydaktyczne

Obowiązują każdą lekcję i każde pytanie w banku. Reviewer sprawdza je tak samo jak poprawność techniczną.

1. **Najpierw problem, potem nazwa.** Czytelnik najpierw widzi sytuację, w której czegoś brakuje, a dopiero potem dostaje pojęcie, które ten brak nazywa.
2. **Żadnego pojęcia bez wyjaśnienia.** Pojęcie kluczowe dla lekcji tłumacz w tekście, przy pierwszym użyciu, jednym zdaniem zrozumiałym dla kogoś, kto zna SQL i Pythona. Pojęcie poboczne oznacz hasłem `<term id="...">` ze słownika `content/glossary.ts`. Definicja w słowniku nie może wymagać znajomości innego hasła. Test sprawdza, że każde użyte hasło istnieje.
3. **Kod i plan się tłumaczy, a nie tylko pokazuje.** Wydruk `explain()` albo fragment kodu, który niesie treść, idzie przez `CodeExplainer`: linia, jej odpowiednik w znanym świecie (np. w SQL) i jedno zdanie, po co tam jest. Mów, w którą stronę czytać.
4. **Analogia ma koniec.** Most do SQL, Snowflake albo dbt idzie przez `ConceptBridge` i zawsze mówi, gdzie przestaje działać. Analogia bez tej części uczy błędnego modelu.
5. **Założenia przed pytaniem.** Quiz, którego odpowiedź zależy od konkretnego eksperymentu, podaje wcześniej plan, dane i konfigurację. Po odpowiedzi podaje zakres wyniku.
6. **Ilustracja to nie pomiar.** Wszystko, co nie pochodzi z uruchomienia, ma etykietę „symulacja" albo „ilustracja". Jeśli się da, obok stoi pomiar z labu.
7. **Stopniowe odsłanianie.** Najpierw to, co trzeba umieć powiedzieć. Warunki, wyjątki i mechanizm głębiej są zwinięte i opcjonalne. W szybkiej powtórce wyjaśnienia są domyślnie schowane.
8. **Bank: odpowiedź krótka, wyjaśnienie obok.** Odpowiedź mówiona zostaje w 30–60 sekundach. Pole `explain` tłumaczy mechanizm od podstaw, po polsku, w 2–5 akapitach, i nie jest do recytowania.
9. **Jedno źródło.** Lekcja nie powtarza pytania, krótkiej odpowiedzi ani follow-upów z banku. Bierze je z pytania o tym samym `topicId`.

10. **Visual-first w Academy.** Domyślna ścieżka: konkretne pytanie → mały przykład lub wizualizacja → widoczny skutek → krótki wniosek. Szczegóły planu, pomiar, rozbudowana analogia i pogłębienie techniczne są opcjonalne lub w istniejącym etapie Praktyka/Interview. Nie ukrywaj niezbędnych założeń i ograniczeń. Nie dodawaj interakcji na siłę ani nie buduj nowego frameworka. Przed tworzeniem lub zmianą materiałów przeczytaj [skill](.claude/skills/senior-de-lesson-author/SKILL.md) i jego [standard dydaktyczny](.claude/skills/senior-de-lesson-author/references/pedagogy.md); dotyczy wszystkich agentów, nie tylko Claude Code.

Sprawdzian końcowy: czy osoba, która zna SQL i Pythona, a Sparka nie, przejdzie lekcję bez szukania czegokolwiek w innym miejscu?

## Zasady techniczne

- Stack: React, TypeScript (strict), Vite, zwykły CSS z tokenami w `apps/web/src/styles/base.css`. Bez bazy, logowania i chmury. Aplikacja pozostaje statyczna i musi działać bez żadnego serwera.
- Jedyny wyjątek od „bez backendu" to lokalny runner labów (`apps/lab-runner`, decyzja Macieja): opcjonalny proces na `127.0.0.1`, który uruchamia wyłącznie skrypty z allowlisty `labs/registry.json`. Runner nie jest piaskownicą: skrypty z rejestru to zaufany kod z repozytorium, a limity (czas, wyjście, jedno uruchomienie) nie ograniczają procesora ani pamięci. Nie rozszerzaj go o wykonywanie kodu od użytkownika, parametry polecenia z przeglądarki ani nasłuch poza localhostem. Wyjście labu w interfejsie pochodzi tylko z procesu: nie wklejaj tam zapisanych ani zmyślonych wydruków.
- Nowa zależność wymaga uzasadnienia w opisie pull requesta. Domyślna odpowiedź brzmi „nie".
- Treść mieszka w `content/`, interfejs w `apps/web/`. Komponent nie zawiera treści merytorycznej wpisanej na sztywno.
- Identyfikatory `id` pytań i lekcji oraz `topicId` są stabilne. Postęp użytkownika jest po nich zapisany, więc ich zmiana kasuje mu historię.
- Postęp: `localStorage`, klucz `osde-progress-v1`. Zmiana kształtu danych wymaga nowego klucza albo migracji.
- Knowledge Base (`content/knowledge-base/`, `apps/web/src/knowledge-base/`) to podręcznik do czytania: tekst, kod, tabele i statyczne ilustracje. Obowiązuje go ten sam standard treści co lekcje (weryfikacja, bez kategorycznych uproszczeń, nie tłumacz nieznanego nieznanym), ale nie ma w nim quizów, symulatorów ani postępu. Strona i PDF powstają z jednego źródła. Po zmianie treści rozdziału uruchom `npm run kb:pdf`.
- Elementy wspólne dla lekcji i banku są w `apps/web/src/components/`: `TermTooltip` (hasło słownika), `CodeExplainer` (kod linia po linii), `ConceptBridge` (most do znanego), `Html` (render fragmentów treści), `LabRunner` (lab z `labs/registry.json`: kod i uruchomienie przez lokalny runner). Używaj ich zamiast pisać podobne od nowa.
- Fragmenty HTML w treści przechodzą przez parser `apps/web/src/lib/richText.ts`. Dozwolony jest mały zestaw znaczników. Nieznany albo niedomknięty znacznik wywala test.
- Kierunek wizualny jest ustalony: ciemne ciepłe tło, jeden pomarańczowy akcent, Bricolage Grotesque, Figtree, JetBrains Mono. Academy jest przestronne i narracyjne, Interview Bank zwarty. Nie przerabiaj tego na dashboard.
- Bez atrap: nie dodawaj przycisków, zakładek ani sekcji, które jeszcze nie działają, ani pustych katalogów „na przyszłość".
- Układ musi działać od 390 px szerokości bez poziomego przewijania.

## Zanim otworzysz pull request

```bash
npm run check
```

Dodatkowo, gdy zmiana dotyczy:

- treści: nowe fakty są w `docs/verified-facts.md`,
- lekcji albo pytań z liczbami: lab uruchamia się przez `uv run` i daje liczby zgodne z treścią. Wynik i ograniczenia wpisz do opisu pull requesta,
- interfejsu: przeklikane ręcznie na szerokim ekranie i na 390 px.

## Lista kontrolna review (ChatGPT)

1. Czy każde twierdzenie jest prawdziwe w aktualnych wersjach Sparka i Databricks? Wskaż zdanie i źródło.
2. Czy gdzieś jest uproszczenie, na którym rekruter złapie kandydata?
3. Czy ktoś, kto zna SQL, a nie zna Sparka, zrozumie to bez zaglądania gdzie indziej? Sprawdź punkty z sekcji „Kryteria dydaktyczne".
4. Czy odpowiedź brzmi jak wypowiedź seniora na rozmowie, czy jak definicja z dokumentacji?
5. Czy brakuje follow-upu, który na rozmowach pada często?
6. Czy liczby opisane jako zmierzone mają pokrycie w labie i podany zakres?
7. Czy w treści nie ma szczegółów prywatnych albo firmowych?

Uwagi zapisuj jako komentarze do konkretnych linii, z proponowanym brzmieniem. Oznaczaj wagę: `blocker` (błąd merytoryczny), `should` (wyraźnie poprawia), `nit` (drobiazg).

## Znany dług techniczny

- Silnik symulatora lazy evaluation (`apps/web/src/academy/lazy-evaluation/lazySim.js`) jest przeniesiony 1:1 z zaakceptowanego prototypu: imperatywny JavaScript na DOM, opakowany komponentem React. Zachowanie było ważniejsze niż czystość. Kolejne symulatory pisz jako komponenty React i SVG. Tego nie przepisuj bez osobnej decyzji.
- Fragmenty treści lekcji są w HTML jako stringi (`content/spark/lazy-evaluation/lesson.ts`). Parser w `lib/richText.ts` pilnuje ich poprawności i obsługuje hasła słownika, ale to nadal rozwiązanie przejściowe. Przy drugiej lekcji warto zdecydować, czy przejść na MDX.
- Część tekstów zadań w `Tasks.tsx` (nagłówki, komunikaty zwrotne) nadal siedzi w komponencie.
- Laby czytają metryki skanu i stopkę Parquet przez wewnętrzne API JVM (py4j). Działa na PySpark 4.0.1 i 4.3.0, ale nie jest to stabilne API.

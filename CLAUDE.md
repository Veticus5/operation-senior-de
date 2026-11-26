# CLAUDE.md

Najpierw przeczytaj [AGENTS.md](AGENTS.md). Tam są cel, role, przepływ pracy i standard treści. Ten plik dodaje tylko to, co dotyczy Claude jako developera.

## Polecenia

```bash
npm install          # raz
npm run dev          # serwer deweloperski
npm run check        # typecheck + testy + build, uruchom przed każdym commitem
cd labs && uv run lazy_evaluation/lazy_lab.py   # lab PySpark, wymaga Javy 17+
```

## Gdzie co jest

- Pytania: `content/<obszar>/questions.ts`. Model: `content/types.ts`. Rejestr: `content/index.ts`.
- Lekcja wzorcowa: treść w `content/spark/lazy-evaluation/`, widok w `apps/web/src/academy/lazy-evaluation/`.
- Routing: `apps/web/src/lib/router.ts` (hash, bez biblioteki). Trasy składa `apps/web/src/App.tsx`.
- Postęp: `apps/web/src/lib/progress.ts` (czysta logika, testowana) i `useProgress.ts` (hook).
- Style: `styles/base.css` to tokeny i styl lekcji przeniesione z zaakceptowanego prototypu. Zmiany i nowe rzeczy dopisuj w `styles/app.css`.

## Zasady pracy

- Rozmawiaj z Maciejem po polsku, krótko i konkretnie.
- Istotne zmiany: gałąź, pull request, bez merge'a do `main` przed akceptacją Macieja.
- Zanim napiszesz liczbę albo zachowanie Sparka do treści, uruchom to w labie albo otwórz dokumentację. Wynik wpisz do `docs/verified-facts.md`.
- Nie zmieniaj istniejących `id` ani `topicId`.
- Etapy lekcji pozostają zamontowane i są przełączane atrybutem `hidden`, żeby stan symulatora i odpowiedzi przetrwał przejście między etapami. Nie zamieniaj tego na renderowanie warunkowe.
- Symulator skaluje scenę 980×372 do szerokości kontenera (`LazySim.tsx`). Jeśli zmieniasz rozmiar sceny, zmień go w obu miejscach: w silniku i w komponencie.
- Po zmianie interfejsu sprawdź build produkcyjny w przeglądarce (Playwright albo ręcznie) na szerokim ekranie i na 390 px.

import type { Bridge } from '../../types';
import type { Compare, More, Scenario } from './shared';

/**
 * Etap 5: Batch i streaming. Celowo krótszy niż etapy o architekturze i ładowaniu: uczy podjąć decyzję
 * i nazwać jej koszt, bez wnętrza Kafki. Symulacje są ilustracjami na wymyślonych zdarzeniach.
 */
export const opening = {
  html: '<h1>„Chcemy danych w czasie rzeczywistym". Naprawdę?</h1>\n<p class="lede">To zdanie pada na prawie każdym spotkaniu o platformie. Dobra odpowiedź nie brzmi „tak" ani „nie", tylko: <b>jaką decyzję podejmujecie na podstawie tych danych i jak szybko?</b></p>\n<p>Raport finansowy czytany rano nie zyska nic na danych sprzed sekundy. Blokada podejrzanej płatności nie może czekać do rana. Między nimi jest cała skala, a każdy jej punkt ma inną cenę.</p>'
};

export const modes: Compare & { title: string; intro: string; takeaway: string } = {
  title: 'Trzy sposoby przetwarzania tych samych zdarzeń',
  intro: 'Zdarzenia płatności i odtworzeń z aplikacji. Różnica nie leży w danych, tylko w tym, <b>kiedy</b> są przetwarzane.',
  label: 'Tryb przetwarzania',
  assumptions: 'Porównanie jakościowe. Opóźnienia to rzędy wielkości, a nie gwarancje konkretnego narzędzia.',
  defaultId: 'batch',
  options: [
    {
      id: 'batch', label: 'Batch',
      rows: [
        ['Jak działa', 'O ustalonej porze przetwarza wszystko, co zebrało się od ostatniego razu'],
        ['Droga danych', 'aplikacja → pliki w S3 → nocne ładowanie → dbt → dashboard'],
        ['Opóźnienie', 'Godziny'],
        ['Koszt i utrzymanie', 'Najniższe. Zasoby pracują tylko w czasie przebiegu, a awarię naprawia ponowne uruchomienie'],
        ['Spóźnione zdarzenia', 'Zwykle zdążą przed przebiegiem albo złapie je okno wstecz']
      ],
      verdict: 'Domyślny wybór dla raportów i analityki. Prosty w obsłudze, łatwy do przeliczenia od nowa, tani.'
    },
    {
      id: 'micro', label: 'Micro-batch',
      rows: [
        ['Jak działa', 'To samo co batch, tylko co kilka minut albo sekund i na małych porcjach'],
        ['Droga danych', 'aplikacja → pliki lub kolejka → ładowanie ciągłe → przyrostowe przeliczenie → dashboard'],
        ['Opóźnienie', 'Sekundy do minut'],
        ['Koszt i utrzymanie', 'Średnie. Zasoby pracują często lub stale, ale model myślenia zostaje batchowy'],
        ['Spóźnione zdarzenia', 'Trzeba zdecydować, jak długo na nie czekać']
      ],
      verdict: 'Dobry kompromis dla dashboardów operacyjnych. W Snowflake tak działają Snowpipe oraz Streams z Tasks, a w Sparku Structured Streaming w trybie domyślnym.'
    },
    {
      id: 'stream', label: 'Streaming',
      rows: [
        ['Jak działa', 'Każde zdarzenie jest przetwarzane, gdy tylko nadejdzie'],
        ['Droga danych', 'aplikacja → kolejka zdarzeń → procesor strumieniowy → usługa lub baza odpowiadająca od razu'],
        ['Opóźnienie', 'Milisekundy do sekund'],
        ['Koszt i utrzymanie', 'Najwyższe. System działa bez przerwy, wymaga dyżurów, zarządzania stanem i innego sposobu testowania'],
        ['Spóźnione zdarzenia', 'Stały problem: wynik trzeba wydać, zanim wiadomo, czy przyszły wszystkie dane']
      ],
      verdict: 'Uzasadniony, gdy system ma zareagować sam i natychmiast: blokada oszustwa, rekomendacja w trakcie sesji, alert. Dla raportu czytanego przez człowieka to koszt bez korzyści.'
    }
  ],
  takeaway: '<b>Wniosek.</b> Niższe opóźnienie kupujesz kosztem i złożonością. Trzecia oś to przepustowość: przetwarzanie dużymi porcjami jest tańsze na rekord niż rekord po rekordzie. Dlatego pytanie nie brzmi „batch czy streaming", tylko „jakie opóźnienie jest warte swojej ceny dla tej konkretnej decyzji".'
};

/** Trzy potrzeby biznesowe, do każdej inny tryb. Każdy tryb jest dobrą odpowiedzią dokładnie raz. */
export const needs = {
  title: 'Dopasuj tryb do potrzeby',
  intro: 'Trzy prośby od biznesu. W każdej wybierz najtańszy tryb, który ją spełnia.',
  ask: 'Co proponujesz?',
  options: ['Batch raz na dobę', 'Micro-batch co kilka minut', 'Streaming zdarzenie po zdarzeniu'],
  cases: [
    {
      setup: 'Dyrektor finansowy czyta raport MRR codziennie o 9:00 i raz w miesiącu zamyka okres rozliczeniowy.',
      options: ['Batch raz na dobę', 'Micro-batch co kilka minut', 'Streaming zdarzenie po zdarzeniu'],
      correct: 0,
      why: 'Decyzja zapada raz dziennie, więc dane świeższe niż z nocy niczego nie zmienią. Batch daje tu coś ważniejszego niż szybkość: zamknięty, uzgodniony dzień, który nie zmieni się w trakcie czytania.',
      scope: 'Gdyby finanse chciały śledzić wyniki kampanii w ciągu dnia, to byłby osobny produkt z osobnym wymaganiem świeżości, a nie powód do przebudowy raportu MRR.'
    },
    {
      setup: 'Zespół wsparcia chce widzieć na dashboardzie nieudane płatności z ostatnich 10 minut, żeby szybko zauważyć awarię dostawcy płatności.',
      options: ['Batch raz na dobę', 'Micro-batch co kilka minut', 'Streaming zdarzenie po zdarzeniu'],
      correct: 1,
      why: 'Człowiek patrzy na dashboard i reaguje w ciągu minut. Opóźnienie rzędu minuty lub kilku jest niezauważalne, a micro-batch pozwala zostać przy SQL i narzędziach, które zespół już zna.',
      scope: 'Jeśli na tę samą sytuację ma reagować automat, np. przełączyć ruch na drugiego dostawcę, wymaganie zmienia się na sekundy i micro-batch może nie wystarczyć.'
    },
    {
      setup: 'System ma zablokować płatność, jeśli ta sama karta została użyta na pięciu kontach w ciągu minuty. Decyzja musi zapaść, zanim płatność zostanie zatwierdzona.',
      options: ['Batch raz na dobę', 'Micro-batch co kilka minut', 'Streaming zdarzenie po zdarzeniu'],
      correct: 2,
      why: 'Decyzję podejmuje system w trakcie operacji, więc każda sekunda opóźnienia to przepuszczone oszustwo. To jest przypadek, w którym koszt streamingu się zwraca.',
      scope: 'Taki system zwykle nie zastępuje platformy analitycznej, tylko działa obok niej: te same zdarzenia trafiają też do RAW i są analizowane batchowo.'
    }
  ] as Scenario[],
  takeaway: '<b>Wniosek.</b> O trybie decyduje to, kto i jak szybko działa na podstawie danych. Człowiek czytający raport: batch. Człowiek patrzący na monitor: micro-batch. System podejmujący decyzję w trakcie operacji: streaming.'
};

export interface WindowEvent {
  id: string;
  /** Czas zdarzenia w minutach po 12:00. */
  eventAt: number;
  /** Czas dotarcia do systemu w minutach po 12:00. */
  arrivedAt: number;
  note?: string;
}

/** Czas zdarzenia kontra czas przetwarzania i dopuszczalne spóźnienie. Logika: model.ts (windowCounts). */
export const windows = {
  title: 'Ile odtworzeń było między 12:00 a 12:05?',
  intro: 'Każde zdarzenie ma dwa czasy. <b>Czas zdarzenia</b> to chwila, w której użytkownik kliknął. <b>Czas przetwarzania</b> to chwila, w której zdarzenie dotarło do systemu. Zwykle różnią się o ułamek sekundy. Telefon w tunelu potrafi rozciągnąć tę różnicę do kwadransa.',
  assumptions: 'Model uproszczony: pięć zdarzeń, wszystkie wydarzyły się między 12:00 a 12:05. Liczymy w pięciominutowych oknach. Okno jest zamykane, gdy zegar systemu minie jego koniec powiększony o dopuszczalne spóźnienie. Prawdziwe silniki wyznaczają tę granicę z czasów zdarzeń, które już widziały.',
  windowMinutes: 5,
  events: [
    { id: 'a', eventAt: 1, arrivedAt: 1 },
    { id: 'b', eventAt: 2, arrivedAt: 2 },
    { id: 'c', eventAt: 4, arrivedAt: 4 },
    { id: 'd', eventAt: 3, arrivedAt: 7, note: 'telefon stracił zasięg na 4 minuty' },
    { id: 'e', eventAt: 4, arrivedAt: 21, note: 'telefon był offline 17 minut' }
  ] as WindowEvent[],
  basisLabel: 'Według którego czasu liczysz',
  bases: [
    { id: 'event', label: 'Czas zdarzenia' },
    { id: 'processing', label: 'Czas przetwarzania' }
  ],
  latenessLabel: 'Jak długo czekasz na spóźnione',
  lateness: [0, 5, 20],
  verdicts: {
    processing: 'Suma się zgadza, ale rozkład jest fałszywy: dwa odtworzenia z 12:03 i 12:04 zostały przypisane do okien, w których dotarły. Wykres „odtworzenia na minutę" pokaże ruch, którego nie było, a po każdej awarii sieci sztuczny szczyt.',
    'event|0': 'Okno 12:00–12:05 zostało zamknięte o 12:05 z wynikiem 3. Oba spóźnione zdarzenia odrzucono. Wynik jest natychmiast, ale zaniżony o 40%.',
    'event|5': 'Okno czekało do 12:10 i policzyło 4 z 5. Zdarzenie spóźnione o 17 minut przepadło. Wynik jest pełniejszy, ale dostępny 5 minut później.',
    'event|20': 'Okno czekało do 12:25 i policzyło wszystkie 5. Wynik jest kompletny, ale dostępny 20 minut po fakcie, a system przez cały ten czas musiał trzymać otwarte okno w pamięci.'
  } as Record<string, string>,
  takeaway: '<b>Wniosek.</b> Liczenie według czasu zdarzenia daje poprawny obraz tego, co się wydarzyło, ale wymaga decyzji: jak długo czekać na spóźnione dane. Tę granicę nazywa się <b>watermarkiem</b>. To pokrętło między kompletnością a opóźnieniem i zużyciem pamięci, a nie ustawienie techniczne do skopiowania z przykładu.',
  more: {
    title: 'Watermark w Sparku i odpowiednik w batchu',
    html: [
      'W Spark Structured Streaming watermark to największy czas zdarzenia, jaki silnik dotąd widział, pomniejszony o zadany próg. Dane starsze niż watermark mogą zostać odrzucone, ale dokumentacja zastrzega, że nie jest to gwarantowane: takie zdarzenie może zostać uwzględnione albo nie.',
      'W batchu ten sam problem rozwiązuje okno wstecz z etapu 2: nocny przebieg przelicza także kilka poprzednich dni, więc zdarzenie spóźnione o dobę trafia do właściwego dnia przy następnym przebiegu. Batch może poprawić wczorajszy wynik. Streaming, który już go wysłał dalej, ma trudniej.',
      'Dlatego w RAW warto mieć oba czasy: czas zdarzenia od źródła i czas załadowania nadany przez platformę. Pierwszy służy do analizy, drugi do ładowania przyrostowego i diagnozy opóźnień.'
    ]
  } as More
};

export interface StreamEvent {
  id: string;
  amount: number;
}

/** Semantyki dostarczenia na jednej awarii. Logika: model.ts (deliver). Wyniki w werdyktach wynikają z modelu. */
export const semantics = {
  title: 'Konsument padł w połowie paczki. Co jest w tabeli?',
  intro: 'Konsument czyta z kolejki trzy zdarzenia, zapisuje je do tabeli i potwierdza kolejce, dokąd doszedł. To potwierdzenie pozycji nazywa się commitem offsetu, a utrwalony stan, od którego można wznowić pracę, <b>checkpointem</b>. Awaria następuje po zapisaniu dwóch z trzech zdarzeń. Po restarcie konsument zaczyna od ostatniej potwierdzonej pozycji.',
  assumptions: 'Model uproszczony: jedna paczka trzech zdarzeń, jedna awaria po zapisaniu dwóch, potem restart bez kolejnych awarii.',
  events: [
    { id: 'e-1', amount: 49 },
    { id: 'e-2', amount: 99 },
    { id: 'e-3', amount: 29 }
  ] as StreamEvent[],
  /** Ile zdarzeń zdążyło się zapisać przed awarią. */
  writtenBeforeCrash: 2,
  label: 'Kolejność działań konsumenta',
  defaultId: 'least',
  options: [
    {
      id: 'most', label: 'Potwierdź, potem zapisz', name: 'at-most-once (najwyżej raz)',
      how: 'Konsument najpierw potwierdza całą paczkę, potem zapisuje.',
      verdict: 'Po restarcie kolejka uważa paczkę za obsłużoną, więc trzecie zdarzenie nigdy nie zostanie zapisane. Nic się nie dubluje, ale dane mogą zginąć. Do przyjęcia dla metryk technicznych, nie dla płatności.'
    },
    {
      id: 'least', label: 'Zapisz, potem potwierdź', name: 'at-least-once (co najmniej raz)',
      how: 'Konsument zapisuje, a potwierdza dopiero po zapisaniu całej paczki.',
      verdict: 'Awaria nastąpiła przed potwierdzeniem, więc po restarcie cała paczka jest czytana ponownie. Nic nie ginie, ale dwa zdarzenia są zapisane podwójnie. To najczęstsza gwarancja w praktyce i powód, dla którego deduplikacja z etapu 2 jest obowiązkowa.'
    },
    {
      id: 'exactly', label: 'Zapisz idempotentnie, potem potwierdź', name: 'efekt exactly-once (dokładnie raz)',
      how: 'Jak wyżej, ale zapis to MERGE po identyfikatorze zdarzenia.',
      verdict: 'Paczka jest czytana ponownie, ale zapis po kluczu nadpisuje te same dwa wiersze, zamiast je dublować. Dostawa nadal jest „co najmniej raz". Dokładnie raz jest dopiero skutek w tabeli.'
    }
  ],
  takeaway: '<b>Wniosek.</b> „Exactly-once" to nie cecha kolejki, którą się włącza, tylko własność całego łańcucha: źródło, które umie odtworzyć dane od zapamiętanej pozycji, plus zapis, który można powtarzać albo który jest zatwierdzany razem z pozycją w jednej transakcji. Na rozmowie mów „at-least-once z idempotentnym zapisem" i wyjaśnij, co daje każdy z dwóch elementów.',
  more: {
    title: 'Kafka i architektury Lambda oraz Kappa w pigułce',
    html: [
      '<b>Kafka</b> to trwały dziennik zdarzeń podzielony na partycje. Kolejność jest zachowana wewnątrz partycji, nie między nimi. Pozycja konsumenta w partycji to jedna liczba, offset, czyli numer następnego zdarzenia do przeczytania. Dokumentacja Kafki definiuje trzy gwarancje tak jak w symulacji: przy at-most-once wiadomość może zginąć, przy at-least-once może przyjść ponownie.',
      'Kafka ma idempotentnego producenta i transakcje, które pozwalają osiągnąć exactly-once wewnątrz Kafki. Gdy wynik trafia do zewnętrznego systemu, np. hurtowni, nadal potrzebna jest współpraca tego systemu: zapis idempotentny albo transakcyjny.',
      'Spark Structured Streaming zapisuje w checkpoincie zakres offsetów każdej paczki. Dokumentacja opisuje gwarancję end-to-end exactly-once przy odtwarzalnym źródle i idempotentnym ujściu.',
      '<b>Lambda</b> to dwie równoległe ścieżki dla tych samych danych: szybka, przybliżona (streaming) i wolna, dokładna (batch), której wynik zastępuje szybki. Wada: ta sama logika w dwóch miejscach. <b>Kappa</b> to jedna ścieżka strumieniowa, a przeliczenie historii polega na ponownym odtworzeniu dziennika zdarzeń. Wada: wymaga długiej retencji dziennika i silnika, który udźwignie przeliczenie.',
      'Na rozmowie wystarczy nazwać kompromis: Lambda płaci podwójną logiką, Kappa płaci retencją i trudniejszym przeliczaniem. Wiele platform kończy na batchu z jedną wąską ścieżką strumieniową dla przypadków, które naprawdę jej wymagają.'
    ]
  } as More,
  bridge: {
    from: 'Snowflake',
    known: 'Snowpipe ładuje nowe pliki ze stage\'a w ciągu minut po ich pojawieniu się. Stream z Taskiem przetwarza zmiany tabeli porcjami: Task uruchamia się, gdy stream ma dane, i zużywa je w jednej transakcji.',
    fresh: 'To jest micro-batch z checkpointem: pozycja streamu przesuwa się dopiero po zatwierdzeniu transakcji, która zużyła zmiany. Jeśli Task padnie, pozycja zostaje i następne uruchomienie dostaje te same zmiany.',
    breaks: 'Nie każda platforma ma ten sam mechanizm ani te same gwarancje. Snowpipe Streaming, Kafka i Spark inaczej definiują pozycję, kolejność i to, co znaczy „dokładnie raz". Zasada jest wspólna, szczegóły trzeba sprawdzić w dokumentacji konkretnego narzędzia.'
  } as Bridge
};

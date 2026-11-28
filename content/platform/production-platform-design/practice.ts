import type { QuizItem } from './shared';

/**
 * Etap Interview i sprawdzian. Pytania, odpowiedzi 30–60 s (PL i EN) oraz follow-upy przychodzą z Interview Banku.
 * Tutaj jest tylko to, czego bank nie ma: scenariusze awarii do powiedzenia na głos i jedno zadanie projektowe,
 * w którym rozwiązanie wzorcowe odsłania się dopiero po własnej próbie.
 */

export interface FailureScenario {
  /** Pytanie tak, jak padnie na rozmowie. */
  q: string;
  /** Wzorcowa odpowiedź do powiedzenia na głos. */
  a: string;
  /** Sedno po polsku. */
  pl: string;
}

export const failures = {
  title: 'Scenariusze awarii',
  intro: 'Rekruter rzadko pyta o definicję. Częściej opisuje awarię i słucha, w jakiej kolejności myślisz. Odpowiedz na głos po angielsku, dopiero potem rozwiń.',
  items: [
    {
      q: 'A scheduler glitch ran your nightly load twice. What happens to the data?',
      a: 'If the load is designed well, nothing happens. Each run replaces its own date range in one transaction, or it merges on a business key. So the second run produces the same rows as the first. If it’s a plain append, I now have duplicates. Then I’d rebuild the affected partition from the raw layer, and fix the job so the next double run is harmless. I’d also add a uniqueness test on the key, so this gets caught before the marts are rebuilt.',
      pl: 'Idempotentny zapis sprawia, że drugie uruchomienie nic nie zmienia. Jeśli nie był idempotentny: przelicz partycję z RAW, napraw job, dodaj test unikalności.'
    },
    {
      q: 'A source team renamed a column without telling you. Walk me through what happens.',
      a: 'The raw layer keeps loading, because it stores the payload as it arrives. The staging model still selects the old column name. So it either fails, or the column turns into nulls. That’s why I put a not-null test on critical fields. I want a loud failure in staging, not a silent zero in the revenue report. Downstream models are skipped, and the dashboard keeps yesterday’s data with a visible refresh date. Then I fix the mapping and replay from raw. And I talk to the source owner about a contract, because the real fix isn’t technical.',
      pl: 'RAW przyjmuje, STG zatrzymuje się głośno na teście, odbiorca widzi wczorajsze dane. Naprawa: mapowanie, replay z RAW i kontrakt ze źródłem.'
    },
    {
      q: 'Finance says yesterday\'s revenue is three percent lower than in the payment provider\'s report. How do you investigate?',
      a: 'I compare one number layer by layer, starting from the source. I take the row count and the amount sum for that day in the provider’s report, in raw, in staging and in the mart. The first layer where the number changes tells me where to look. If raw is short, it’s ingestion: a missed page, a late-arriving record, or a time zone boundary. If raw matches and staging doesn’t, it’s deduplication or a filter. If only the mart differs, it’s a business rule, such as refunds or test accounts. Then it may be a question about the definition, not a bug.',
      pl: 'Jedna liczba porównywana warstwa po warstwie od źródła. Pierwsza warstwa, w której się zmienia, wskazuje krok: ładowanie, deduplikacja albo reguła biznesowa.'
    },
    {
      q: 'You find a transformation bug that has been live for two weeks. What do you do?',
      a: 'First I stop the damage. I tell consumers which dates and tables are affected, and I ship the fix so new data is correct. Then I backfill exactly the affected range from raw. I use the same job with a date parameter, and it replaces whole partitions, so it’s safe to rerun. I check that raw retention covers those two weeks. After that I reconcile the corrected days against the source and tell consumers it’s fixed. Finally I ask why it took two weeks to notice. And I add the test or the reconciliation that would have caught it on day one.',
      pl: 'Zatrzymaj szkodę i poinformuj, wdróż poprawkę, przelicz dokładnie zakres błędu z RAW, uzgodnij ze źródłem, dodaj kontrolę, która złapałaby to pierwszego dnia.'
    },
    {
      q: 'The warehouse bill doubled this month. Where do you look?',
      a: 'Before I change anything, I’d break the cost down by warehouse and by workload. Typical causes are a warehouse that never suspends, a full refresh that should be incremental, a backfill someone left running, or a dashboard that refreshes every minute for nobody. Query history shows which queries take the most time, and whether they spill to disk or wait in a queue. If workloads share one warehouse, I can’t tell which one caused the cost, so separating them is often the first step. Then I set a spending limit with alerts. That way the next surprise comes as a notification, not as an invoice.',
      pl: 'Najpierw rozbij koszt na warehouse\'y i obciążenia. Typowe przyczyny: brak auto-wyłączania, pełne przeliczanie zamiast przyrostowego, zapomniany backfill. Potem limit z alertem.'
    }
  ] as FailureScenario[]
};

export interface DesignStep {
  id: string;
  title: string;
  /** Polecenie po angielsku, tak jak padłoby na rozmowie. */
  task: string;
  /** Podpowiedź po polsku, co ma się znaleźć w odpowiedzi, bez zdradzania rozwiązania. */
  hint: string;
  /** Rozwiązanie wzorcowe, odsłaniane po własnej próbie. Fragmenty HTML. */
  solution: string[];
  /** Na co zwróci uwagę rekruter. */
  watch: string;
}

/** Zadanie projektowe end-to-end. Rozwiązanie każdego kroku odsłania się dopiero po wpisaniu własnej odpowiedzi. */
export const design = {
  title: 'Zadanie projektowe: zaprojektuj tę platformę',
  intro: 'Jedno zadanie w trzech krokach, tak jak przebiega rozmowa system design: najpierw pytania, potem rozwiązanie, na końcu obrona kompromisów. Napisz swoją odpowiedź w każdym kroku. Rozwiązanie wzorcowe odsłoni się dopiero po Twojej próbie.',
  prompt: 'Design a data platform for a video subscription service. Data comes from a PostgreSQL billing database, a payment provider\'s REST API, and playback events from mobile and web apps. Finance needs a daily revenue and MRR report. Product wants engagement dashboards. Support wants to see failed payments quickly.',
  promptPl: 'Polecenie jest celowo niedoprecyzowane. To część zadania.',
  /** Minimalna długość własnej odpowiedzi, zanim da się odsłonić rozwiązanie. */
  minChars: 80,
  locked: 'Najpierw napisz własną odpowiedź. Kilka zdań wystarczy.',
  placeholder: 'Twoja odpowiedź (po angielsku albo po polsku)…',
  reveal: 'Pokaż rozwiązanie wzorcowe',
  steps: [
    {
      id: 'requirements', title: 'Krok 1 · Wymagania',
      task: 'Before you draw anything: what do you need to ask?',
      hint: 'Wypisz pytania, bez których nie da się wybrać architektury. Pomyśl o odbiorcach, świeżości, wolumenie, poprawności, awariach i danych osobowych.',
      solution: [
        '<b>Odbiorcy i decyzje.</b> Who uses each output and what decision do they make with it? How wrong can it be before it matters?',
        '<b>Świeżość dla każdego odbiorcy osobno.</b> By what time does finance need the report? What does "quickly" mean for support: seconds or minutes? Is it a human watching a dashboard or a system reacting?',
        '<b>Wolumen i wzrost.</b> How many subscribers, payments per day, events per day? What is the peak compared with the average? Expected growth over two years?',
        '<b>Poprawność.</b> What is the source of truth for revenue? Does it have to reconcile with the payment provider, and to what tolerance?',
        '<b>Źródła.</b> Can we read the database log, or only query tables? Are rows deleted? What are the API\'s rate limits and how far back does it serve data? Do events carry a unique ID and an event timestamp?',
        '<b>Awarie i odtwarzanie.</b> How much data can we afford to lose and how long can the platform be down? Is a late report acceptable, and how often?',
        '<b>Dane osobowe i dostęp.</b> Which fields are personal data? Who may see them? Are there deletion or data residency requirements?',
        '<b>Zespół i budżet.</b> How many engineers will run this, and what do they already know?',
        'Założenia przyjęte dalej: about two million subscribers, eighty million events a day, finance needs the report by 7:00 and it must reconcile with the provider, support accepts a delay of a few minutes, a small team that knows SQL, dbt and Python.'
      ],
      watch: 'Czy pytasz o świeżość osobno dla każdego odbiorcy i czy pytasz o źródło prawdy dla przychodu. Kandydat, który od razu rysuje Kafkę, traci punkty już tutaj.'
    },
    {
      id: 'solution', title: 'Krok 2 · Rozwiązanie',
      task: 'Describe the flow from sources to consumers. How is each source ingested, what are the layers, and what happens when a run fails?',
      hint: 'Przejdź drogę danych: każde źródło osobno, warstwy i ich odpowiedzialność, sposób zapisu, orkiestracja, kontrole jakości, dostęp.',
      solution: [
        '<b>Billing database.</b> Log-based CDC into the raw layer, because subscriptions are updated and deleted and finance needs the history of changes. A periodic full comparison catches drift.',
        '<b>Payment API.</b> A Python job with cursor pagination and backoff on rate limits. Each page is written unchanged to S3 before parsing, and progress is saved after each page. Incremental with a lookback window, merged on payment ID.',
        '<b>Playback events.</b> Apps send events to a queue or directly to object storage in small files, loaded continuously into raw. Each event has a unique ID and an event timestamp. Delivery is at-least-once, so staging deduplicates on event ID.',
        '<b>Layers.</b> Raw keeps everything as received with load metadata, retained long enough to replay, for example ninety days or more for payments. Staging does typing, renaming and deduplication, one model per source table. Marts hold the business definitions: revenue, MRR, active subscriber. One definition, one owner.',
        '<b>Writes.</b> Every load is idempotent: partition replacement for daily facts, merge on key for change streams, with each batch deduplicated by a fixed rule and late, older changes not allowed to overwrite newer ones. Backfill is the same job with a date range.',
        '<b>Orchestration.</b> Dependencies by completion, not by clock. Tests gate publication: if staging tests fail, marts are not rebuilt and the dashboard keeps the last good data with a visible refresh time. The gate only protects consumers if the tested version is published atomically, for example built aside and swapped in. Otherwise they can already read it.',
        '<b>Failed payments for support.</b> A separate micro-batch path: the same raw payment data refreshed every few minutes into a small table. No streaming engine needed.',
        '<b>Trust.</b> dbt tests for keys and critical fields, freshness and volume monitoring on raw tables, a daily reconciliation of revenue against the provider\'s report. An SLO for the finance report, for example ready by 7:00 on ninety-five percent of days.',
        '<b>Access and cost.</b> Roles by function, personal data masked outside the raw layer, service accounts for loading. Separate compute for loading, transformation and BI, each with auto-suspend.'
      ],
      watch: 'Czy każda decyzja ma powód wynikający z wymagań, a nie z mody. Czy mówisz, co się dzieje przy awarii i ponowieniu, zanim rekruter o to zapyta.'
    },
    {
      id: 'tradeoffs', title: 'Krok 3 · Kompromisy',
      task: 'Name three decisions where you chose the simpler or cheaper option. What would make you change each one?',
      hint: 'Dla każdej decyzji: co wybrałeś, z czego zrezygnowałeś i jaki sygnał kazałby Ci zmienić zdanie.',
      solution: [
        '<b>Batch for finance instead of streaming.</b> A closed, reconciled day is worth more to finance than fresh numbers. I would revisit this only if a decision had to be made intraday on revenue.',
        '<b>Micro-batch for support instead of a streaming engine.</b> A few minutes of delay is acceptable for a person watching a dashboard, and the team stays on SQL. I would move to streaming if a system had to react automatically within seconds.',
        '<b>CDC only for the billing database, not for everything.</b> CDC adds a system to operate. The payment API gets a watermark with a lookback window because it exposes a reliable cursor. I would change that if we started missing updates or needed deletes.',
        '<b>Raw retention.</b> Longer retention makes backfills possible but costs storage and complicates deletion of personal data. I chose a bounded period per source and would extend it if a bug ever outlived it.',
        '<b>History and replay instead of a second region.</b> Table history and raw files protect against human error, which is the likely failure. Cross-region replication would be justified if an hour of downtime cost more than running a second region.',
        '<b>Three layers, not five.</b> I would add intermediate models only when the same logic appears in two marts.',
        'Jak to zamknąć w jednym zdaniu: “I optimised for correctness and operability first, because the main consumer is finance and the team is small. The design leaves room to add a streaming path later without rebuilding the rest.”'
      ],
      watch: 'Czy potrafisz nazwać, co Twoje rozwiązanie robi gorzej. Senior nie broni projektu jako idealnego, tylko pokazuje, że zna cenę każdej decyzji.'
    }
  ] as DesignStep[],
  closing: 'Rozwiązanie wzorcowe to jedna z dobrych odpowiedzi, nie jedyna. Jeśli Twoje różni się wyborem narzędzia, ale każda decyzja wynika z wymagań i wiesz, co się stanie przy awarii, to jest dobra odpowiedź.'
};

/**
 * Jak mówić o projektowaniu platformy, gdy części elementów nie budowało się samodzielnie.
 * Tekst celowo warunkowy: nie przypisuje uczącemu się doświadczenia, którego mógł nie mieć.
 */
export const interview = {
  honestIntro: 'Nikt nie budował samodzielnie każdego elementu takiej platformy. Jeśli któryś znasz z dokumentacji, a nie z własnego wdrożenia, powiedz to i pokaż, jak byś do niego podszedł. Na przykład tak:',
  honestEn: '“I haven’t run log-based CDC in production myself, so let me tell you how I’d think about it. I’d use it where I need deletes or the full history of changes. Where the source has a reliable updated-at column, I’d keep a simple watermark with a lookback window. Either way, the write on my side has to be idempotent, because any of these mechanisms can deliver the same change twice. And I’d reconcile against the source regularly, because that tells me whether the mechanism really works.”',
  honestPl: 'Po polsku: nie prowadziłem CDC z dziennika na produkcji, więc powiem, jak bym o nim myślał. Użyłbym go tam, gdzie potrzebuję usunięć albo pełnej historii zmian, a prosty znacznik z oknem wstecz zostawił tam, gdzie źródło ma wiarygodną kolumnę updated-at. W obu przypadkach zapis po mojej stronie musi być idempotentny, bo każdy z tych mechanizmów może dostarczyć tę samą zmianę dwa razy. I regularnie uzgadniałbym dane ze źródłem, bo to mówi, czy mechanizm naprawdę działa.'
};

/** Etap Sprawdź się: dziesięć pytań. Każde podaje założenia, jeśli wynik od nich zależy. */
export const quiz: QuizItem[] = [
  {
    q: 'Po co warstwa RAW przechowuje dane dokładnie tak, jak przyszły, razem z duplikatami i błędnymi typami?',
    options: ['Żeby analitycy mieli dostęp do najświeższych danych', 'Żeby po znalezieniu błędu w transformacji dało się przeliczyć kolejne warstwy od nowa', 'Bo czyszczenie danych przy ładowaniu jest wolniejsze'],
    correct: 1,
    why: 'RAW jest punktem, do którego można wrócić. Jeśli ładowanie poprawia dane po drodze, błędna poprawka niszczy jedyną kopię tego, co przysłało źródło. Przeliczenie działa tak daleko wstecz, jak sięga retencja RAW.'
  },
  {
    q: 'Reguła „do przychodu nie liczymy kont testowych" powinna być zapisana w warstwie:',
    options: ['RAW, żeby złe dane w ogóle nie trafiły na platformę', 'STG, razem z rzutowaniem typów i deduplikacją', 'MRT, bo to definicja biznesowa, a nie sprzątanie techniczne'],
    correct: 2,
    why: 'STG odpowiada na pytanie, czym technicznie jest rekord. To, co liczy się jako przychód, jest decyzją biznesową i należy do MRT. Gdyby filtr był w STG, raport, który potrzebuje kont testowych, musiałby go obchodzić.'
  },
  {
    q: 'Ładowanie przyrostowe pobiera wiersze z <code>updated_at</code> nowszym niż zapamiętany znacznik. Który przypadek zgubi dane bez żadnego błędu?',
    setup: 'Założenia: znacznik to najnowszy <code>updated_at</code> wśród dotąd załadowanych wierszy, bez okna wstecz.',
    options: ['Wiersz zmieniony dwa razy między ładowaniami', 'Wiersz z wcześniejszym <code>updated_at</code>, zatwierdzony w źródle już po ładowaniu', 'Wiersz dodany minutę po ładowaniu'],
    correct: 1,
    why: 'Znacznik przesunął się dalej niż <code>updated_at</code> tego wiersza, więc żadne następne ładowanie o niego nie zapyta. Wiersz zmieniony dwa razy da ostatnią wersję, a wiersz dodany później zostanie pobrany następnym razem.'
  },
  {
    q: 'Dodajesz do ładowania okno wstecz 10 minut, a zapis zostawiasz jako zwykły <code>INSERT</code>. Co się stanie?',
    options: ['Nic złego, okno wstecz wystarcza', 'Wiersze z okna będą ładowane ponownie i pojawią się duplikaty', 'Ładowanie przestanie działać'],
    correct: 1,
    why: 'Okno wstecz celowo czyta ponownie to, co już było czytane. Bez zapisu, który można powtarzać, np. <code>MERGE</code> po kluczu, każde takie ponowne przeczytanie dopisuje wiersz drugi raz. Te dwa elementy działają tylko razem.'
  },
  {
    q: 'Który job jest idempotentny?',
    options: ['Dopisuje do tabeli wszystkie wiersze z dzisiejszego pliku', 'W jednej transakcji usuwa wiersze z danego dnia i wstawia komplet dla tego dnia', 'Sprawdza, czy już się dziś uruchomił, i jeśli tak, kończy pracę'],
    correct: 1,
    why: 'Zastąpienie zakresu daje ten sam wynik po jednym i po pięciu uruchomieniach. Dopisywanie dubluje. Sprawdzanie „czy już się uruchomiłem" nie pozwala naprawić przebiegu, który się uruchomił, ale załadował błędne albo niepełne dane.'
  },
  {
    q: 'Kolejka dostarcza zdarzenia co najmniej raz. Po czym najbezpieczniej rozpoznać duplikat?',
    options: ['Po identycznej treści wiersza', 'Po użytkowniku, kwocie i czasie', 'Po identyfikatorze zdarzenia nadanym przez producenta'],
    correct: 2,
    why: 'Dwa osobne zdarzenia mogą mieć identyczną treść, np. dwie takie same płatności w tej samej sekundzie. Tylko identyfikator nadany u źródła jest taki sam przy każdej dostawie tego samego zdarzenia i różny dla różnych zdarzeń.'
  },
  {
    q: 'Zapytania dashboardów czekają 4 minuty w kolejce, a wykonują się 6 sekund. Nic nie jest zrzucane na dysk. Co pomoże najbardziej?',
    setup: 'Założenia: jeden warehouse współdzielony z nocnym ładowaniem, tak jak w symulacji.',
    options: ['Większy rozmiar warehouse\'u', 'Rozdzielenie ładowania i dashboardów na osobne warehouse\'y albo skalowanie wszerz', 'Przepisanie zapytań dashboardów'],
    correct: 1,
    why: 'Długa kolejka przy krótkim wykonaniu znaczy, że za dużo zapytań chce działać naraz. Same zapytania są już szybkie, tylko nie mogą się zacząć. Większy rozmiar pomoże pośrednio i kosztuje podwójnie przez cały czas pracy.'
  },
  {
    q: 'Tabela płatności nie dostała dziś żadnych nowych wierszy, bo API zwróciło pustą odpowiedź. Job zakończył się sukcesem. Co to wykryje?',
    options: ['Test <code>unique</code> na kluczu', 'Test <code>not_null</code> na kwocie', 'Kontrola świeżości albo wolumenu'],
    correct: 2,
    why: 'Testy reguł sprawdzają wiersze, które są w tabeli, a wczorajsze wiersze nadal je spełniają. Braku nowych danych nie widać w samych danych. Wykrywa go porównanie z oczekiwaniem: kiedy tabela powinna się odświeżyć i ile wierszy zwykle przybywa.'
  },
  {
    q: 'Platforma replikuje dane do drugiego regionu. Ktoś uruchamia na produkcji <code>UPDATE</code> bez <code>WHERE</code>. Czy replikacja uratuje dane?',
    options: ['Tak, wystarczy przełączyć się na kopię', 'Nie, błędna zmiana zostanie zreplikowana. Potrzebna jest historia tabeli albo surowe pliki', 'Tak, o ile RTO jest krótsze niż RPO'],
    correct: 1,
    why: 'Replikacja wiernie kopiuje każdą zmianę, także pomyłkę. Chroni przed utratą regionu, nie przed błędem człowieka. Na błąd człowieka odpowiada powrót do wcześniejszego stanu tabeli w okresie retencji albo przeliczenie z RAW.'
  },
  {
    q: 'Konsument zapisuje zdarzenia do tabeli, a pozycję w kolejce potwierdza po zapisaniu paczki. Pada po zapisie, przed potwierdzeniem. Co będzie po restarcie?',
    setup: 'Założenia: zapis to zwykły <code>INSERT</code>, bez deduplikacji.',
    options: ['Zdarzenia z tej paczki zginą', 'Zdarzenia z tej paczki zostaną zapisane drugi raz', 'Nic, kolejka gwarantuje dostarczenie dokładnie raz'],
    correct: 1,
    why: 'Pozycja nie została potwierdzona, więc konsument przeczyta paczkę ponownie. To jest at-least-once: nic nie ginie, ale mogą powstać duplikaty. Efekt „dokładnie raz" w tabeli daje dopiero idempotentny zapis, np. <code>MERGE</code> po identyfikatorze zdarzenia.'
  }
];

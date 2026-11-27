import type { Question } from '../types';

/**
 * Pytania: projektowanie platformy danych. Zasady są niezależne od narzędzia. Tam, gdzie pada nazwa produktu
 * (Snowflake, dbt, Snowpipe, Kafka, Spark), zachowanie jest zweryfikowane w oficjalnej dokumentacji:
 * linki i daty w docs/verified-facts.md, sekcja „Lekcja: Production Data Platform Design".
 * Odpowiedzi są projektowe („I would…"), bez przypisywania mówiącemu doświadczenia, którego mógł nie mieć.
 */
export const platformQuestions: Question[] = [
  {
    id: 'platform-design-end-to-end',
    topicId: 'platform.production-design',
    area: 'platform',
    priority: 'P0',
    title: 'Projekt platformy end-to-end',
    question: {
      pl: 'Jak podchodzisz do zaprojektowania platformy danych od źródeł do raportów?',
      en: 'How do you approach designing a data platform end to end, from sources to reports?'
    },
    answer: {
      pl: 'Zaczynam od odbiorców, nie od narzędzi: kto podejmuje jaką decyzję, jak świeże muszą być dane i ile kosztuje błąd albo spóźnienie. Z tego wynikają wymagania dla każdego źródła. Potem warstwy: surowa kopia tego, co przyszło, warstwa oczyszczona technicznie i warstwa z definicjami biznesowymi. Każde ładowanie projektuję tak, żeby dało się je bezpiecznie powtórzyć, bo ponowienia i backfille są pewne. Zależności idą przez orkiestrator, a testy działają jak bramka przed publikacją. Do tego kontrola świeżości, uzgadnianie ze źródłem, role z minimalnymi uprawnieniami i osobne zasoby dla ładowania i raportów. Na końcu mówię, z czego zrezygnowałem i dlaczego.',
      en: 'I start from the consumers, not the tools: who makes which decision, how fresh the data has to be, and what a mistake or a delay costs. That gives me requirements per source. Then the layers: a raw copy of what arrived, a technically cleaned layer, and a layer holding business definitions. I design every load so it is safe to rerun, because retries and backfills are a certainty. Dependencies go through an orchestrator, and tests act as a gate before publication. On top of that I add freshness checks, reconciliation against the source, least-privilege roles, and separate compute for loading and for reporting. And I finish by saying what I gave up and why.'
    },
    senior: {
      pl: 'Dopowiedz, że świeżość ustalasz osobno dla każdego odbiorcy. Raport finansowy i monitor nieudanych płatności mogą korzystać z tych samych surowych danych, ale mieć różne ścieżki i różny koszt. Jedno wymaganie „real-time" dla wszystkich jest najdroższym błędem projektu.',
      en: 'Add that freshness is set per consumer. The finance report and a failed-payments monitor can share the same raw data but have different paths and different costs. A single "real-time" requirement for everyone is the most expensive design mistake.'
    },
    explain: [
      'Pytanie jest otwarte celowo. Rekruter nie sprawdza, czy znasz konkretne narzędzie, tylko w jakiej kolejności myślisz. Słaba odpowiedź zaczyna od nazw technologii. Dobra zaczyna od pytań: kto czyta dane, co z nimi robi i co się stanie, gdy będą złe albo spóźnione.',
      'Warstwy rozdzielają trzy pytania. Surowa: co przyszło ze źródła. Oczyszczona: czym to technicznie jest, czyli typy, nazwy i deduplikacja. Biznesowa: co to znaczy, czyli definicje metryk. Dzięki temu błąd w transformacji da się naprawić przez przeliczenie od surowych danych, o ile są jeszcze przechowywane.',
      'Druga oś odpowiedzi to awarie. Każdy krok kiedyś uruchomi się dwa razy albo padnie w połowie. Dlatego zapis ma być <b>idempotentny</b>: powtórzony daje ten sam wynik. Najprościej osiąga się to zastąpieniem całego zakresu, np. dnia, w jednej transakcji albo zapisem <code>MERGE</code> po kluczu.',
      'Trzecia oś to zaufanie: testy reguł znanych z góry, kontrola świeżości i liczby wierszy oraz porównanie sum z niezależnym źródłem. Zielony status joba nie mówi nic o poprawności danych.'
    ],
    keywords: ['requirements', 'layers', 'idempotency', 'orchestration', 'reconciliation', 'trade-offs'],
    followUps: [
      { q: 'What do you ask before you propose anything?', a: 'Who the consumers are and what decisions they make, the freshness each of them needs, volumes and growth, what the source of truth is, how much data loss and downtime is acceptable, and which fields are personal data.', pl: 'Odbiorcy, świeżość, wolumen, źródło prawdy, RPO i RTO, dane osobowe.' },
      { q: 'How do you know the platform is producing correct numbers?', a: 'Tests for rules I know in advance, freshness and volume checks for what I did not predict, and reconciliation of key totals against an independent source. A green job only tells me the code ran.', pl: 'Testy, monitory i uzgadnianie ze źródłem. Zielony job to nie dowód.' },
      { q: 'What would you deliberately leave out of a first version?', a: 'Streaming, a second region and extra modeling layers, unless a requirement forces them. I would rather have a simple batch platform that is correct and replayable, and add a faster path where a decision really needs it.', pl: 'Streaming, drugi region i dodatkowe warstwy, dopóki nie wymusi ich wymaganie.' },
      { q: 'Where does a design like this usually break first?', a: 'At the boundary with the sources: an unannounced schema change, a late-arriving record or a retry that duplicates data. That is why raw keeps everything and staging fails loudly.', pl: 'Na styku ze źródłami: zmiana schematu, spóźniony rekord, ponowienie z duplikatem.' }
    ],
    mistakes: [
      'Zaczynanie od listy narzędzi zamiast od odbiorców i wymagań.',
      'Jedno wymaganie świeżości dla całej platformy.',
      'Brak słowa o tym, co się dzieje przy awarii, ponowieniu i backfillu.',
      'Przedstawianie projektu jako bezkosztowego, bez nazwania kompromisów.'
    ]
  },
  {
    id: 'platform-layered-architecture',
    topicId: 'platform.layered-architecture',
    area: 'platform',
    priority: 'P0',
    title: 'Warstwy RAW, STG, MRT',
    question: {
      pl: 'Po co dzielić hurtownię na warstwy, np. RAW, STG i MRT? Co należy do której?',
      en: 'Why split a warehouse into layers such as raw, staging and marts? What belongs in each?'
    },
    answer: {
      pl: 'Każda warstwa odpowiada na inne pytanie. RAW: co przyszło ze źródła, bez poprawek, z informacją kiedy i skąd. STG: czym to technicznie jest, czyli typy, nazwy, deduplikacja i walidacja, ale jeszcze bez reguł biznesowych. MRT: co to znaczy dla biznesu, czyli fakty, wymiary i metryki z jedną definicją. Zysk jest praktyczny. Błąd w transformacji naprawiam przeliczeniem od RAW, tak daleko wstecz, jak sięga jego retencja. Zmiana schematu w źródle zatrzymuje się głośno w STG, zamiast po cichu zepsuć raport. A definicja przychodu jest w jednym miejscu. Liczba warstw nie jest święta: prosty przypadek obejdzie się dwiema.',
      en: 'Each layer answers a different question. Raw: what arrived from the source, unchanged, with when and where it came from. Staging: what it technically is, so types, names, deduplication and validation, but no business rules yet. Marts: what it means for the business, so facts, dimensions and metrics with one definition. The benefit is practical. I fix a transformation bug by recomputing from raw, as far back as its retention goes. A source schema change fails loudly in staging instead of silently breaking a report. And the definition of revenue lives in one place. The number of layers is not sacred: a simple case can do with two.'
    },
    senior: {
      pl: 'Bronze, Silver i Gold to podobny podział z architektury medallion, ale nie identyczny: staging w dbt to zwykle widok, a bronze to trwała kopia. Dopowiedz też koszt: każda warstwa to modele do utrzymania i opóźnienie, więc dodajesz ją, gdy rozwiązuje konkretny problem.',
      en: 'Bronze, silver and gold are a similar split from the medallion architecture, but not identical: dbt staging is usually a view, while bronze is a persistent copy. Also mention the cost: each layer means models to maintain and added latency, so you add one when it solves a specific problem.'
    },
    explain: [
      'Wyobraź sobie ładowanie, które od razu poprawia dane: rzutuje typy, usuwa duplikaty, odrzuca podejrzane wiersze. Jeśli reguła deduplikacji okaże się błędna, nie ma do czego wrócić, bo jedyna kopia danych jest już „poprawiona". Warstwa surowa istnieje po to, żeby ten powrót był możliwy.',
      'Warstwa oczyszczona robi porządek techniczny, który nie wymaga wiedzy o biznesie: kwota staje się liczbą, a dwa wiersze o tym samym identyfikatorze jednym. Reguły typu „do przychodu liczymy tylko udane płatności" tu nie pasują, bo inny raport może potrzebować także nieudanych.',
      'Warstwa biznesowa trzyma definicje. Jeśli dwa raporty liczą tę samą metrykę osobno, prędzej czy później pokażą różne liczby. Jedno miejsce z definicją i jeden właściciel rozwiązują ten problem lepiej niż jakiekolwiek narzędzie.',
      'Możliwość przeliczenia od surowych danych zależy od tego, jak długo są przechowywane. Retencja warstwy surowej jest więc decyzją o tym, jak stary błąd da się jeszcze naprawić.'
    ],
    keywords: ['raw', 'staging', 'marts', 'medallion', 'replay', 'schema enforcement', 'source fidelity'],
    followUps: [
      { q: 'Where do you put deduplication, and where a rule like "exclude test accounts"?', a: 'Deduplication is technical, so it goes in staging. Excluding test accounts is a business definition, so it goes in the marts. Otherwise a report that needs test accounts has to work around staging.', pl: 'Deduplikacja w STG, reguła biznesowa w MRT.' },
      { q: 'A source adds a column, or removes one. What should happen?', a: 'Raw should accept both, because it stores what arrived. A new column waits in raw until someone selects it. A removed column should fail a test in staging loudly, and the fix starts with the source owner.', pl: 'RAW przyjmuje, STG pilnuje. Usunięcie pola to rozmowa z właścicielem źródła.' },
      { q: 'When would you use fewer layers?', a: 'For a small, single-purpose dataset with no duplicates and no shared business rules. I would still keep a raw copy, but one model on top of it is enough. I add layers when the same logic starts appearing twice.', pl: 'Mały zbiór w jednym raporcie: surowa kopia i jeden model.' },
      { q: 'Can you always rebuild everything from raw?', a: 'Only as far back as raw is retained. Retention is a design decision that trades storage cost and data deletion obligations against how old a bug I can still repair.', pl: 'Tylko w granicach retencji RAW.' }
    ],
    mistakes: [
      'Recytowanie nazw warstw bez powiedzenia, jaki problem rozwiązuje każda z nich.',
      'Reguły biznesowe w warstwie staging.',
      'Ręczne poprawianie danych w warstwie surowej.',
      'Twierdzenie, że Bronze, Silver i Gold to dokładnie to samo co staging, intermediate i marts w dbt.'
    ]
  },
  {
    id: 'platform-incremental-loading',
    topicId: 'platform.incremental-loading',
    area: 'platform',
    priority: 'P0',
    title: 'Ładowanie przyrostowe i spóźnione dane',
    question: {
      pl: 'Kiedy wybierasz pełne ładowanie, a kiedy przyrostowe? Jak obsługujesz spóźnione rekordy?',
      en: 'When do you choose a full load and when an incremental one? How do you handle late-arriving records?'
    },
    answer: {
      pl: 'Pełne ładowanie jest najprostsze i samo się naprawia, więc dla małych tabel zostaję przy nim. Przyrostowe wybieram, gdy tabela jest za duża, żeby czytać ją całą. Najprostszy wariant to high-water mark: pamiętam najnowszy updated_at i pobieram tylko nowsze wiersze. Ma ciche awarie: nie widzi usunięć i potrafi zgubić wiersz zatwierdzony z opóźnieniem. Dlatego czytam z oknem wstecz, a zapisuję przez MERGE po kluczu, żeby ponownie przeczytany wiersz nadpisał sam siebie. Gdy potrzebuję usunięć albo pełnej historii zmian, sięgam po CDC z dziennika transakcji. Niezależnie od metody okresowo porównuję liczby ze źródłem.',
      en: 'A full load is the simplest and it heals itself, so for small tables I stay with it. I go incremental when the table is too big to read in full. The simplest variant is a high-water mark: I remember the latest updated-at and fetch only newer rows. It has silent failure modes: it does not see deletes, and it can miss a row that was committed late. So I read with a lookback window and write with a merge on the key, so a row read twice overwrites itself. When I need deletes or the full change history, I use log-based CDC. Whatever the method, I periodically reconcile counts against the source.'
    },
    senior: {
      pl: 'Okno wstecz musi być dłuższe niż najdłuższe realne opóźnienie w źródle, a to trzeba zmierzyć, nie zgadnąć. Dla zdarzeń z urządzeń rozróżnij czas zdarzenia i czas załadowania: znacznik opieraj na czasie załadowania, a dane przypisuj do dni według czasu zdarzenia.',
      en: 'The lookback window has to be longer than the longest real delay in the source, and that should be measured, not guessed. For device events, separate event time from load time: base the watermark on load time, and assign data to days by event time.'
    },
    explain: [
      'Kopię tabeli źródłowej można utrzymywać na trzy sposoby. Pełne ładowanie czyta wszystko za każdym razem. Jest proste i każde uruchomienie zastępuje poprzednie, więc wczorajszy błąd znika sam. Przestaje działać, gdy tabela jest zbyt duża.',
      'Ładowanie przyrostowe po znaczniku pyta: daj wiersze zmienione po chwili, którą zapamiętałem. Ta zapamiętana chwila to <b>high-water mark</b>. Zakłada to, że dane pojawiają się w źródle w kolejności <code>updated_at</code>. Jeśli transakcja ustawiła <code>updated_at</code> na 09:58, a zatwierdziła się o 10:03, ładowanie z 10:00 jej nie widziało, a następne zapyta już tylko o wiersze po 09:59.',
      'Okno wstecz, czyli ponowne czytanie ostatnich minut albo dni, łapie taki wiersz, ale czyta też ponownie wiersze już załadowane. Dlatego zapis musi je nadpisywać, a nie dopisywać. Jedno bez drugiego albo gubi dane, albo je dubluje.',
      '<b>CDC</b>, czyli change data capture, czyta dziennik transakcji bazy: każdą operację wstawienia, zmiany i usunięcia w kolejności zatwierdzenia. Widzi usunięcia i stany pośrednie, ale jest dodatkowym systemem do utrzymania.'
    ],
    keywords: ['full load', 'incremental', 'high-water mark', 'CDC', 'lookback window', 'late-arriving data', 'MERGE'],
    followUps: [
      { q: 'How does a high-water mark lose data without any error?', a: 'A row gets its updated-at inside a long transaction and becomes visible only after my load ran. By then the watermark has moved past its timestamp, so no later load asks for it.', pl: 'Późno zatwierdzona transakcja ze starszym updated_at.' },
      { q: 'How do you detect deleted rows?', a: 'A watermark on updated-at cannot see hard deletes. Options are log-based CDC, soft deletes in the source, or a periodic full comparison of keys.', pl: 'CDC, miękkie usuwanie w źródle albo okresowe pełne porównanie kluczy.' },
      { q: 'How would you ingest from a paginated, rate-limited API?', a: 'Cursor pagination rather than page numbers, so new records do not shift pages. Back off and retry on rate-limit responses. Store each raw page before parsing, and save progress after each page so a failure resumes instead of restarting.', pl: 'Kursor, backoff na limitach, surowa strona zapisana przed przetworzeniem, postęp po każdej stronie.' },
      { q: 'How is this expressed in dbt?', a: 'An incremental model with a unique key, so reprocessed rows are merged instead of appended. The microbatch strategy has a lookback setting that reprocesses previous batches to pick up late records.', pl: 'Model incremental z unique_key, w microbatch ustawienie lookback.' }
    ],
    mistakes: [
      'Traktowanie pełnego ładowania jako rozwiązania gorszego z definicji.',
      'Warunek „nowsze niż ostatnio" bez okna wstecz i bez zapisu, który można powtarzać.',
      'Pominięcie usunięć: znacznik po updated_at ich nie widzi.',
      'Mylenie czasu zdarzenia z czasem załadowania.'
    ]
  },
  {
    id: 'platform-idempotent-pipelines',
    topicId: 'platform.idempotency',
    area: 'platform',
    priority: 'P0',
    title: 'Idempotentne pipeline\'y, retry i backfill',
    question: {
      pl: 'Co to znaczy, że pipeline jest idempotentny? Jak to osiągasz i jak robisz backfill?',
      en: 'What does it mean for a pipeline to be idempotent? How do you achieve it, and how do you run a backfill?'
    },
    answer: {
      pl: 'Idempotentny pipeline uruchomiony wiele razy z tymi samymi danymi wejściowymi daje ten sam wynik co uruchomiony raz. To konieczne, bo ponowienia robi orkiestrator, sieć i ludzie. Osiągam to na dwa sposoby. Dla danych podzielonych na dni zastępuję cały zakres w jednej transakcji: usuń dzień, wstaw dzień. Dla pojedynczych zmian używam MERGE po kluczu biznesowym. Zwykły INSERT nie jest idempotentny. Dobrze zaprojektowany backfill to ten sam job z innym zakresem dat: przeliczam dokładnie okres błędu z surowych danych, zapisuję przez zastąpienie zakresu i na końcu uzgadniam wynik ze źródłem. Najpierw jednak informuję odbiorców, które dane są błędne.',
      en: 'An idempotent pipeline run many times with the same input gives the same result as running it once. That is necessary because retries come from the orchestrator, the network and people. I get there in two ways. For data split by day, I replace the whole range in one transaction: delete the day, insert the day. For individual changes, I merge on a business key. A plain insert is not idempotent. A well-designed backfill is the same job with a different date range: I recompute exactly the affected period from raw data, write by replacing the range, and reconcile the result with the source at the end. But first I tell consumers which data is wrong.'
    },
    senior: {
      pl: 'Idempotencja zapisu nie wystarcza, jeśli wejście się zmienia: backfill sprzed roku na dzisiejszym stanie wymiarów da inny wynik niż wtedy. Powiedz też o atomowości publikacji: odbiorca powinien widzieć stary albo nowy komplet, nigdy połowę.',
      en: 'An idempotent write is not enough if the input changes: a year-old backfill against today\'s dimension state gives a different result than it did then. Also mention atomic publication: a consumer should see the old set or the new set, never half.'
    },
    explain: [
      'Nocny job ładuje 6 płatności i traci połączenie po czwartej. Ktoś klika „ponów". Jeśli job dopisuje wiersze, w tabeli jest teraz 10 wierszy zamiast 6 i przychód jest zawyżony. Nikt nie popełnił błędu: ponowienie to normalna reakcja na awarię. Błąd jest w projekcie zapisu.',
      'Operacja <b>idempotentna</b> to taka, którą można powtarzać bez zmiany wyniku. Zastąpienie całego dnia w jednej transakcji spełnia ten warunek: po każdym uruchomieniu dzień zawiera dokładnie to, co wstawiono ostatnio. Daje też atomowość: jeśli transakcja się nie powiedzie, baza wycofa ją w całości.',
      'Zapis <code>MERGE</code> po kluczu działa podobnie dla pojedynczych wierszy: istniejący wiersz jest aktualizowany, nowy wstawiany. Wymaga wiarygodnego klucza. Deduplikacja po cechach podobieństwa, np. użytkownik i kwota, pomyli powtórkę z drugą, taką samą płatnością.',
      '<b>Backfill</b> to przeliczenie zakresu z przeszłości, zwykle po poprawieniu błędu. Jeśli codzienny job przyjmuje datę jako parametr i zapisuje idempotentnie, backfill jest tylko wywołaniem go dla innych dat. Działa tak daleko wstecz, jak sięgają surowe dane.'
    ],
    keywords: ['idempotency', 'retry', 'partition overwrite', 'MERGE', 'backfill', 'atomicity', 'deduplication'],
    followUps: [
      { q: 'Delete-and-insert or merge: how do you choose?', a: 'Replacing a range is simplest when data has a natural partition like a day and each batch holds the complete range. Merge fits scattered changes, such as CDC, and needs a reliable key with at most one source row per key.', pl: 'Zastąpienie zakresu dla kompletnych dni, MERGE dla rozrzuconych zmian.' },
      { q: 'How do you pick a deduplication key?', a: 'An identifier assigned by the producer when the event is created. Keys guessed from content, like user plus amount plus time, will merge two genuinely separate events.', pl: 'Identyfikator nadany u źródła, nie cechy podobieństwa.' },
      { q: 'What can go wrong with a large backfill?', a: 'It can starve the daily load of compute, trigger every downstream consumer, and reach past the retention of raw data. I would run it on separate compute, in batches, and check lineage for what gets rebuilt.', pl: 'Zasoby, odbiorcy w dół i retencja RAW.' },
      { q: 'A job failed halfway. What do readers see?', a: 'With a transactional replace, the previous complete state. With statement-by-statement appends, a partial day that looks valid. That is why publication should be the last, atomic step.', pl: 'Przy transakcji poprzedni komplet, przy dopisywaniu połowę dnia.' }
    ],
    mistakes: [
      'Mylenie idempotencji z „job uruchamia się tylko raz".',
      'Zabezpieczenie w stylu „sprawdź, czy już się uruchomiłem", które uniemożliwia naprawę błędnego przebiegu.',
      'Backfill jako osobny, ręcznie pisany skrypt zamiast tego samego joba z parametrem.',
      'Ręczny UPDATE w tabeli wynikowej zamiast przeliczenia z surowych danych.'
    ]
  },
  {
    id: 'platform-scalability-isolation',
    topicId: 'platform.scalability',
    area: 'platform',
    priority: 'P1',
    title: 'Skalowanie i izolacja obciążeń',
    question: {
      pl: 'Platforma zwalnia, gdy rośnie liczba użytkowników i danych. Jak diagnozujesz problem i jak skalujesz?',
      en: 'The platform slows down as users and data grow. How do you diagnose it and how do you scale?'
    },
    answer: {
      pl: 'Najpierw rozróżniam dwa objawy. Zapytanie czeka w kolejce, bo inni zajęli zasoby, albo samo liczy się długo, bo brakuje mu pamięci lub czyta za dużo danych. Kolejka przy krótkim wykonaniu to problem równoczesności: pomaga skalowanie wszerz, czyli więcej klastrów, albo rozdzielenie obciążeń na osobne zasoby, żeby ładowanie nie konkurowało z dashboardami. Długie wykonanie ze zrzutem na dysk to problem pojedynczego zapytania: pomaga większa maszyna albo mniej danych, na przykład przetwarzanie przyrostowe. Izolacja daje też kontrolę kosztu, bo widać, które obciążenie ile zużywa. Większy rozmiar bez diagnozy to płacenie więcej za ten sam problem.',
      en: 'First I separate two symptoms. A query waits in a queue because others hold the resources, or it runs long on its own because it lacks memory or reads too much data. A queue with short execution is a concurrency problem: scaling out with more clusters helps, or isolating workloads on separate compute so loading does not compete with dashboards. Long execution with spilling to disk is a single-query problem: a bigger machine helps, or less data, for example incremental processing. Isolation also gives cost control, because I can see what each workload consumes. A bigger size without a diagnosis is paying more for the same problem.'
    },
    senior: {
      pl: 'Skalowanie wszerz ma granice: krok, którego nie da się podzielić, przesyłanie danych przy joinach i nierówny rozkład kluczy. W platformie dla wielu klientów dochodzi wybór modelu izolacji: wspólne tabele z filtrem po kliencie, schemat na klienta albo osobne konto, zależnie od wymaganej izolacji i kosztu utrzymania.',
      en: 'Scaling out has limits: the step that cannot be split, data movement in joins, and uneven key distribution. In a multi-tenant platform there is also the isolation model: shared tables with a tenant filter, a schema per tenant, or a separate account, depending on the isolation required and the operating cost.'
    },
    explain: [
      'Skalowanie <b>w górę</b> to większa maszyna, a <b>wszerz</b> to więcej maszyn. Rozwiązują różne problemy. Większa maszyna ma więcej pamięci i procesorów dla jednego zapytania. Więcej maszyn obsłuży więcej zapytań naraz, ale pojedynczego, ciężkiego zapytania zwykle nie przyspieszy.',
      'Stąd diagnoza przed decyzją. Jeśli zapytanie czeka cztery minuty, a liczy się sześć sekund, to nie jest wolne, tylko nie może się zacząć. Jeśli liczy się półtorej godziny i zapisuje dane pośrednie na dysk, bo nie mieszczą się w pamięci, to brakuje mu zasobów. W Snowflake oba objawy są osobnymi kolumnami w historii zapytań.',
      '<b>Izolacja obciążeń</b> to danie każdemu rodzajowi pracy własnych zasobów: osobno ładowanie, osobno transformacje, osobno raporty. Ciężki job nie blokuje wtedy dashboardów, każdy zasób ma rozmiar dobrany do swojej pracy i wyłącza się, gdy nie jest używany.',
      'Przetwarzanie rozproszone dzieli dane na części liczone równolegle. Nie skaluje się bez końca: operacje, które muszą zebrać te same klucze w jednym miejscu, wymagają przesłania danych, a jeden bardzo duży klucz obciąża jedną maszynę niezależnie od ich liczby.'
    ],
    keywords: ['scale up', 'scale out', 'workload isolation', 'concurrency', 'queueing', 'spilling', 'multi-tenant'],
    followUps: [
      { q: 'When does a bigger warehouse end up cheaper?', a: 'When the query was spilling to disk. Twice the rate for a run that is more than twice as fast costs less in total. That has to be checked on the actual query, not assumed.', pl: 'Gdy znika zrzut na dysk i czas spada bardziej niż dwukrotnie. Do sprawdzenia, nie do założenia.' },
      { q: 'How would you isolate tenants on a shared platform?', a: 'It depends on the isolation the contract demands. Shared tables with an enforced row filter scale to many small tenants. Separate schemas or accounts give stronger isolation at a higher operating cost. Large tenants often get dedicated compute.', pl: 'Wspólne tabele z wymuszonym filtrem, schemat na klienta albo osobne konto.' },
      { q: 'How do you plan capacity for a new source?', a: 'A back-of-the-envelope estimate first: events per day times size gives daily and yearly volume, and peak rather than average traffic tells me what ingestion has to absorb. Then I check whether a full recompute still fits the batch window.', pl: 'Rachunek: wolumen dzienny i roczny, szczyt zamiast średniej, okno na przeliczenie.' },
      { q: 'How do you keep cost under control?', a: 'Auto-suspend on idle compute, incremental instead of full recomputation, spending limits with alerts, and separate compute per workload so cost can be attributed to an owner.', pl: 'Auto-wyłączanie, przetwarzanie przyrostowe, limity z alertami, koszt przypisany do właściciela.' }
    ],
    mistakes: [
      'Zwiększanie rozmiaru bez sprawdzenia, czy problemem jest kolejka czy samo zapytanie.',
      'Oczekiwanie, że więcej klastrów przyspieszy jedno ciężkie zapytanie.',
      'Jeden wspólny zasób obliczeniowy dla ładowania, transformacji i raportów.',
      'Pomijanie kosztu jako wymiaru decyzji o skalowaniu.'
    ]
  },
  {
    id: 'platform-data-reliability',
    topicId: 'platform.data-reliability',
    area: 'platform',
    priority: 'P0',
    title: 'Jakość, obserwowalność i poziomy usług',
    question: {
      pl: 'Czym różni się jakość danych od obserwowalności danych? Jak definiujesz niezawodność platformy?',
      en: 'What is the difference between data quality and data observability? How do you define reliability for a data platform?'
    },
    answer: {
      pl: 'Jakość danych to reguły, które znam z góry i sprawdzam testami: klucz jest unikalny, pole nie jest puste, wartość należy do listy. Obserwowalność wykrywa to, czego nie przewidziałem: tabela przestała się odświeżać, przyszło czterdzieści procent zwykłej liczby wierszy, zmienił się schemat. I pomaga ustalić przyczynę dzięki lineage. Potrzebne są obie, plus uzgadnianie ze źródłem dla liczb finansowych. Niezawodność definiuję z odbiorcą. SLI to miara, na przykład godzina, o której dane były gotowe. SLO to cel dla tej miary. SLA to umowa z konsekwencjami. Do tego RPO i RTO: ile danych mogę stracić i jak długo może trwać przywracanie.',
      en: 'Data quality is the rules I know in advance and check with tests: the key is unique, the field is not null, the value is in a list. Observability detects what I did not predict: a table stopped refreshing, forty percent of the usual rows arrived, the schema changed. And it helps find the cause through lineage. I need both, plus reconciliation against the source for financial numbers. I define reliability with the consumer. An SLI is the measure, for example the time the data was ready. An SLO is the target for that measure. An SLA is an agreement with consequences. Then RPO and RTO: how much data I can lose and how long recovery may take.'
    },
    senior: {
      pl: 'Dopowiedz, że replikacja to nie kopia zapasowa: błędny UPDATE też się zreplikuje. Błąd człowieka wymaga historii tabel albo surowych plików, awaria regionu drugiej lokalizacji. I że tabela bez właściciela nie ma poziomu usług, bo nikt nie zareaguje na alert.',
      en: 'Add that replication is not a backup: a bad update gets replicated too. Human error needs table history or raw files, a region outage needs a second location. And a table without an owner has no service level, because nobody will act on the alert.'
    },
    explain: [
      'Job może zakończyć się sukcesem i załadować zero wierszy. Test unikalności tego nie zauważy, bo wczorajsze wiersze nadal są unikalne. Testy sprawdzają dane, które są w tabeli, i tylko pod kątem reguł, które ktoś zapisał. To jest <b>jakość danych</b>.',
      '<b>Obserwowalność danych</b> patrzy na tabelę z zewnątrz: kiedy ostatnio się odświeżyła, ile wierszy przybyło, czy zmienił się schemat. Porównuje to z historią, więc nie wymaga napisania progu dla każdej tabeli. Wykrywa odchylenie, a <b>lineage</b>, czyli mapa zależności między tabelami, pomaga znaleźć przyczynę i odbiorców, których trzeba zawiadomić.',
      'Dane mogą być złe na cztery sposoby: spóźnione, niepełne, błędne albo sprzeczne między raportami. Tego ostatniego nie naprawi żadne narzędzie: wymaga jednej definicji metryki i jej właściciela.',
      'Poziomy usług porządkują rozmowę z odbiorcą. Miara, cel i umowa to trzy różne rzeczy. Cel „99% dni" przy jednym przebiegu dziennie nie dopuszcza w kwartale ani jednego spóźnienia, więc trzeba go zestawić z kosztem jego spełnienia.'
    ],
    keywords: ['data quality', 'observability', 'freshness', 'lineage', 'SLA', 'SLO', 'SLI', 'RPO', 'RTO'],
    followUps: [
      { q: 'Give me an example of an SLI, an SLO and an SLA for a report.', a: 'SLI: the time at which the report table had last night\'s data and passed its tests. SLO: before seven on ninety-five percent of days in a quarter. SLA: what we owe finance when that target is missed.', pl: 'SLI to miara, SLO to cel, SLA to umowa z konsekwencją.' },
      { q: 'What is the difference between RPO and RTO?', a: 'RPO is how much data I can afford to lose, measured as time back to the last recovery point. RTO is how long the restoration may take. The business sets both, and they usually differ per dataset.', pl: 'RPO: ile danych tracę. RTO: jak długo przywracam.' },
      { q: 'How do you protect personal data on the platform?', a: 'Least privilege: roles get only what their job needs. Personal fields are masked for roles that do not need them, row filters limit scope, raw is restricted to service accounts, and deletion requests have to reach every copy.', pl: 'Najmniejsze uprawnienia, maskowanie, filtr wierszy, ograniczony dostęp do RAW.' },
      { q: 'What is a data contract?', a: 'An agreement between a producer and a consumer about fields, types, freshness, ownership and how changes are announced. It only works if something enforces it, such as a test at the platform boundary or a check in the producer\'s deployment.', pl: 'Uzgodnienie pól, typów, świeżości i sposobu zmian, egzekwowane testem.' }
    ],
    mistakes: [
      'Traktowanie zielonego statusu joba jako dowodu poprawnych danych.',
      'Używanie SLA, SLO i SLI zamiennie.',
      'Twierdzenie, że replikacja zastępuje kopię zapasową.',
      'Obiecywanie 99,9% dla nocnego batcha zależnego od cudzego systemu.'
    ]
  },
  {
    id: 'platform-batch-vs-streaming',
    topicId: 'platform.batch-streaming',
    area: 'platform',
    priority: 'P1',
    title: 'Batch, micro-batch czy streaming',
    question: {
      pl: 'Kiedy wybierasz batch, a kiedy streaming? Co oznaczają gwarancje at-least-once i exactly-once?',
      en: 'When do you choose batch and when streaming? What do at-least-once and exactly-once guarantees mean?'
    },
    answer: {
      pl: 'Pytam, kto i jak szybko działa na podstawie danych. Człowiek czytający raport rano: batch, bo jest najtańszy i łatwo go przeliczyć. Człowiek patrzący na monitor: micro-batch co kilka minut. System, który ma zareagować w trakcie operacji, na przykład zablokować oszustwo: streaming. Niższe opóźnienie kosztuje więcej pieniędzy i więcej złożoności. Przy streamingu dochodzą dwa problemy. Spóźnione zdarzenia: liczę według czasu zdarzenia i watermarkiem ustalam, jak długo na nie czekam. I gwarancje dostarczenia: at-least-once oznacza, że nic nie ginie, ale zdarzenie może przyjść dwa razy. Efekt exactly-once uzyskuję, łącząc odtwarzalne źródło z idempotentnym zapisem.',
      en: 'I ask who acts on the data and how fast. A person reading a report in the morning: batch, because it is the cheapest and easy to recompute. A person watching a monitor: micro-batch every few minutes. A system that has to react during an operation, for example block fraud: streaming. Lower latency costs more money and more complexity. Streaming brings two extra problems. Late events: I compute by event time and use a watermark to decide how long to wait for them. And delivery guarantees: at-least-once means nothing is lost, but an event may arrive twice. I get an exactly-once effect by combining a replayable source with an idempotent write.'
    },
    senior: {
      pl: 'Exactly-once to własność całego łańcucha, nie przełącznik w kolejce. Checkpoint zapamiętuje pozycję w źródle, a zapis musi być idempotentny albo zatwierdzany razem z pozycją. Lambda utrzymuje ścieżkę batchową i strumieniową obok siebie, Kappa tylko strumieniową z odtwarzaniem dziennika.',
      en: 'Exactly-once is a property of the whole chain, not a switch on the queue. A checkpoint records the position in the source, and the write must be idempotent or committed together with that position. Lambda keeps a batch and a streaming path side by side, Kappa keeps only the streaming path and replays the log.'
    },
    explain: [
      'Batch przetwarza o ustalonej porze wszystko, co się zebrało. Streaming przetwarza każde zdarzenie, gdy nadejdzie. Micro-batch jest pośrodku: małe porcje co kilka sekund albo minut. Różnica nie leży w danych, tylko w tym, kiedy są przetwarzane i ile kosztuje utrzymanie systemu, który działa bez przerwy.',
      'Każde zdarzenie ma dwa czasy: kiedy się wydarzyło i kiedy dotarło do systemu. Telefon bez zasięgu wysyła zdarzenie z kwadransem opóźnienia. Jeśli liczysz według czasu dotarcia, przypiszesz je do złej minuty. Jeśli według czasu zdarzenia, musisz zdecydować, jak długo czekasz na spóźnione, zanim zamkniesz wynik. Tę granicę nazywa się <b>watermarkiem</b>.',
      'Konsument czyta zdarzenia, zapisuje je i potwierdza kolejce, dokąd doszedł. Zapamiętana pozycja to <b>checkpoint</b>. Jeśli padnie po zapisie, a przed potwierdzeniem, po restarcie przeczyta te same zdarzenia ponownie. To jest at-least-once: nic nie ginie, mogą być duplikaty.',
      'Żeby duplikaty nie trafiły do wyniku, zapis musi być idempotentny, np. <code>MERGE</code> po identyfikatorze zdarzenia. Dostawa nadal jest co najmniej raz, ale skutek w tabeli jest taki, jakby była dokładnie raz.'
    ],
    keywords: ['batch', 'micro-batch', 'streaming', 'event time', 'watermark', 'checkpoint', 'at-least-once', 'exactly-once'],
    followUps: [
      { q: 'What is the difference between event time and processing time?', a: 'Event time is when something happened, processing time is when the system received it. They diverge when devices are offline or queues back up. Analytics should group by event time, otherwise an outage shows up as a fake traffic spike.', pl: 'Kiedy się wydarzyło kontra kiedy dotarło. Analityka grupuje po czasie zdarzenia.' },
      { q: 'What does a watermark trade off?', a: 'Completeness against latency and state. A longer wait catches more late events but delays the result and keeps more windows open in memory. Events later than the watermark may be dropped.', pl: 'Kompletność kontra opóźnienie i pamięć.' },
      { q: 'What is at-most-once and when is it acceptable?', a: 'The position is committed before processing, so a crash loses data but never duplicates it. It is acceptable for metrics where a small loss does not matter, not for payments.', pl: 'Potwierdzenie przed przetworzeniem: może zgubić, nie zdubluje.' },
      { q: 'How does this map to Snowflake?', a: 'Snowpipe loads new files within minutes, which is micro-batch. A stream with a task processes table changes in small transactions, and the stream position only advances when the consuming transaction commits. That gives the same checkpoint idea.', pl: 'Snowpipe oraz Streams z Tasks to micro-batch z zapamiętaną pozycją.' }
    ],
    mistakes: [
      'Wybór streamingu, bo „real-time brzmi lepiej", bez pytania o decyzję, której służy.',
      'Twierdzenie, że kolejka sama gwarantuje exactly-once w tabeli docelowej.',
      'Liczenie okien według czasu dotarcia zdarzenia.',
      'Pominięcie kosztu utrzymania systemu działającego całą dobę.'
    ]
  }
];

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
      pl: 'Zaczynam od odbiorców, nie od narzędzi. Pytam, kto podejmuje jaką decyzję, jak świeże muszą być dane i ile kosztuje błąd albo spóźnienie. Potem dzielę platformę na warstwy: surowa kopia tego, co przyszło, dane oczyszczone technicznie i dane z definicjami biznesowymi. Każde ładowanie projektuję tak, żeby dało się je bezpiecznie powtórzyć, bo ponowienia i backfille na pewno się zdarzą. Kroki uruchamia orkiestrator, w kolejności zależności. Testy działają jak bramka, ale tylko gdy sprawdzona wersja jest publikowana atomowo, na przykład budowana obok i podmieniana. Do tego sprawdzam świeżość i porównuję sumy ze źródłem. Każda rola dostaje tylko potrzebne uprawnienia, a ładowanie i raporty mają osobne zasoby. Na końcu mówię, z czego zrezygnowałem i dlaczego.',
      en: 'I start with the consumers, not with the tools. I ask who makes which decision, how fresh the data has to be, and what a mistake or a delay costs. Then I split the platform into layers: a raw copy of what arrived, a technically cleaned layer, and a layer with business definitions. I design every load so it’s safe to run again, because retries and backfills will happen. An orchestrator runs the steps in dependency order. Tests work as a gate, but only if the tested version is published atomically, for example built aside and swapped in. I also check freshness and compare totals with the source. Each role gets only the access it needs, and loading and reporting run on separate compute. I finish by saying what I gave up and why.'
    },
    senior: {
      pl: 'Dopowiedz, że świeżość ustalasz osobno dla każdego odbiorcy. Raport finansowy i monitor nieudanych płatności mogą korzystać z tych samych surowych danych, ale mieć różne ścieżki i różny koszt. Jedno wymaganie „real-time" dla wszystkich jest najdroższym błędem projektu.',
      en: 'Add that you set freshness for each consumer separately. The finance report and a failed-payments monitor can share the same raw data, but they can have different paths and different costs. One "real-time" requirement for everyone is the most expensive design mistake.'
    },
    explain: [
      'Pytanie jest otwarte celowo. Rekruter nie sprawdza, czy znasz konkretne narzędzie, tylko w jakiej kolejności myślisz. Słaba odpowiedź zaczyna od nazw technologii. Dobra zaczyna od pytań: kto czyta dane, co z nimi robi i co się stanie, gdy będą złe albo spóźnione.',
      'Warstwy rozdzielają trzy pytania. Surowa: co przyszło ze źródła. Oczyszczona: czym to technicznie jest, czyli typy, nazwy i deduplikacja. Biznesowa: co to znaczy, czyli definicje metryk. Dzięki temu błąd w transformacji da się naprawić przez przeliczenie od surowych danych, o ile są jeszcze przechowywane.',
      'Druga część odpowiedzi to awarie. Każdy krok kiedyś uruchomi się dwa razy albo padnie w połowie. Dlatego zapis ma być <b>idempotentny</b>: powtórzony daje ten sam wynik. Najprościej zrobić to na dwa sposoby: zastąpić cały zakres, np. dzień, w jednej transakcji albo zapisywać przez <code>MERGE</code> po kluczu. Sam <code>MERGE</code> nie wystarczy: paczkę trzeba najpierw zdeduplikować według stałej reguły, a spóźniona, starsza zmiana nie może nadpisać nowszej.',
      'Trzecia część to zaufanie: testy reguł znanych z góry, kontrola świeżości i liczby wierszy oraz porównanie sum z niezależnym źródłem. Zielony status joba nie mówi nic o poprawności danych.'
    ],
    keywords: ['requirements', 'layers', 'idempotency', 'orchestration', 'reconciliation', 'trade-offs'],
    followUps: [
      { q: 'What do you ask before you propose anything?', a: 'Who uses the data and what decisions they make. How fresh the data has to be for each of them. How much data there is and how fast it grows. Which system is the source of truth. How much data we can lose and how long we can be down. And which fields are personal data.', pl: 'Odbiorcy, świeżość, wolumen, źródło prawdy, RPO i RTO, dane osobowe.' },
      { q: 'How do you know the platform is producing correct numbers?', a: 'Three things. Tests for the rules I know in advance. Freshness and volume checks for the things I didn’t predict. And a comparison of key totals with an independent source. A green job only tells me the code ran.', pl: 'Testy, monitory i uzgadnianie ze źródłem. Zielony job to nie dowód.' },
      { q: 'What would you deliberately leave out of a first version?', a: 'Streaming, a second region and extra modeling layers, unless a requirement forces them. I’d rather have a simple batch platform that’s correct and replayable. Then I add a faster path where a decision really needs it.', pl: 'Streaming, drugi region i dodatkowe warstwy, dopóki nie wymusi ich wymaganie.' },
      { q: 'Where does a design like this usually break first?', a: 'Where the platform meets the sources. A schema change nobody announced, a record that arrives late, or a retry that duplicates data. That’s why raw keeps what arrived, as long as retention and privacy rules allow, and staging fails loudly.', pl: 'Na styku ze źródłami: zmiana schematu, spóźniony rekord, ponowienie z duplikatem.' }
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
      pl: 'Każda warstwa odpowiada na inne pytanie. RAW mówi, co przyszło ze źródła. Niczego tam nie poprawiam, dopisuję tylko, kiedy i skąd dane przyszły. STG mówi, czym to technicznie jest: nadaję typy i nazwy, usuwam duplikaty, sprawdzam wartości. Jeszcze bez reguł biznesowych. MRT mówi, co to znaczy dla biznesu: fakty, wymiary i metryki, każda z jedną definicją. Zysk jest praktyczny. Błąd w transformacji naprawiam, przeliczając dane od RAW, tak daleko wstecz, jak sięga jego retencja. Zmiana schematu w źródle zatrzymuje się głośno na teście w STG, zamiast po cichu zepsuć raport. To zmniejsza ryzyko, ale go nie usuwa. A definicja przychodu jest w jednym miejscu. Trzy warstwy to nie dogmat: w prostym przypadku wystarczą dwie.',
      en: 'Each layer answers a different question. Raw tells me what arrived from the source. I don’t fix anything there. I only add when and where it came from. Staging tells me what the data technically is: I set types and names, remove duplicates and validate values. No business rules yet. Marts tell me what it means for the business: facts, dimensions and metrics, each with one definition. The benefit is practical. I fix a transformation bug by recomputing from raw, as far back as raw is kept. A schema change in the source fails loudly on a staging test, instead of silently breaking a report. That lowers the risk, but it doesn’t remove it. And the definition of revenue lives in one place. Three layers isn’t a rule. A simple case can do with two.'
    },
    senior: {
      pl: 'Bronze, Silver i Gold to podobny podział z architektury medallion, ale nie identyczny: staging w dbt to zwykle widok, a bronze to trwała kopia. Dopowiedz też koszt: każda warstwa to modele do utrzymania i opóźnienie, więc dodajesz ją, gdy rozwiązuje konkretny problem.',
      en: 'Bronze, silver and gold are a similar split from the medallion architecture, but not the same thing. dbt staging is usually a view, while bronze is a persistent copy. Also mention the cost: each layer means more models to maintain and more delay. So you add a layer when it solves a specific problem.'
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
      { q: 'When would you use fewer layers?', a: 'For a small dataset with one purpose, no duplicates and no shared business rules. I’d still keep a raw copy, within retention and privacy rules, but one model on top of it is enough. I add layers when the same logic starts to show up twice.', pl: 'Mały zbiór w jednym raporcie: surowa kopia i jeden model.' },
      { q: 'Can you always rebuild everything from raw?', a: 'Only as far back as raw is kept. Retention is a design decision. Longer retention costs storage and makes it harder to delete personal data when I have to. But it decides how old a bug I can still repair.', pl: 'Tylko w granicach retencji RAW.' }
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
      pl: 'Pełne ładowanie jest najprostsze i samo się naprawia, więc przy małych tabelach przy nim zostaję. Przyrostowe wybieram, gdy tabela jest za duża, żeby czytać ją całą. Najprostszy wariant to high-water mark: zapamiętuję najnowszy updated_at i pobieram tylko nowsze wiersze. Ten sposób potrafi zgubić dane bez żadnego błędu. Nie widzi usuniętych wierszy. Może też pominąć wiersz, którego transakcja została zatwierdzona z opóźnieniem. Dlatego czytam z oknem wstecz, czyli z zapasem ostatnich minut albo dni. A zapisuję przez MERGE po kluczu, żeby wiersz przeczytany drugi raz nadpisał sam siebie. Sam MERGE nie wystarczy: najpierw usuwam duplikaty w paczce według stałej reguły i pilnuję, żeby starsza zmiana nie nadpisała nowszej. Gdy potrzebuję usunięć albo pełnej historii zmian, wybieram CDC z dziennika transakcji. Przy każdej metodzie co jakiś czas porównuję liczby ze źródłem.',
      en: 'A full load is the simplest and it heals itself, so for small tables I stay with it. I go incremental when the table is too big to read in full. The simplest version is a high-water mark: I remember the latest updated-at and fetch only newer rows. It can lose data without any error: it doesn’t see deletes, and it can miss a row committed late. So I read with a lookback window and write with a merge on the key, so a row I read twice overwrites itself. The merge alone isn’t enough: I first deduplicate the batch with a fixed rule, and I make sure an older change can’t overwrite a newer one. For deletes or the full change history, I use log-based CDC. With any method, I regularly compare counts with the source.'
    },
    senior: {
      pl: 'Okno wstecz musi być dłuższe niż najdłuższe realne opóźnienie w źródle. To opóźnienie trzeba zmierzyć, nie zgadnąć. Dla zdarzeń z urządzeń rozróżnij czas zdarzenia i czas załadowania: znacznik opieraj na czasie załadowania, a dane przypisuj do dni według czasu zdarzenia.',
      en: 'The lookback window has to be longer than the longest real delay in the source. Measure that delay, don’t guess it. For device events, keep event time and load time apart: base the watermark on load time, and assign data to days by event time.'
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
      { q: 'How do you detect deleted rows?', a: 'A watermark on updated-at can’t see hard deletes. The options are log-based CDC, soft deletes in the source, or a full comparison of keys from time to time.', pl: 'CDC, miękkie usuwanie w źródle albo okresowe pełne porównanie kluczy.' },
      { q: 'How would you ingest from a paginated, rate-limited API?', a: 'I use cursor pagination, not page numbers, so new records don’t shift the pages. When the API says I hit the rate limit, I back off and retry. I store each raw page before I parse it. And I save progress after each page, so after a failure the job resumes instead of starting over.', pl: 'Kursor, backoff na limitach, surowa strona zapisana przed przetworzeniem, postęp po każdej stronie.' },
      { q: 'How is this expressed in dbt?', a: 'An incremental model with a unique key, so rows that get processed again are merged, not appended. The microbatch strategy has a lookback setting. It reprocesses previous batches to pick up late records.', pl: 'Model incremental z unique_key, w microbatch ustawienie lookback.' }
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
      pl: 'Pipeline jest idempotentny, gdy uruchomiony kilka razy na tych samych danych wejściowych daje ten sam wynik co uruchomiony raz. To konieczne, bo ponowienia są normalne: robi je orkiestrator, sieć i ludzie. Mam na to dwa sposoby. Gdy dane dzielą się na dni, zastępuję cały zakres w jednej transakcji: usuwam dzień i wstawiam dzień. Gdy przychodzą pojedyncze zmiany, robię MERGE po kluczu biznesowym. Sam MERGE nie wystarczy: źródło deduplikuję według stałej reguły i pilnuję, żeby spóźniona, starsza zmiana nie nadpisała nowszej. Zwykły INSERT nie jest idempotentny. Dobrze zaprojektowany backfill to ten sam job z innym zakresem dat. Przeliczam dokładnie okres błędu z surowych danych, zapisuję przez zastąpienie zakresu, a na końcu porównuję wynik ze źródłem. Ale najpierw mówię odbiorcom, które dane są błędne.',
      en: 'A pipeline is idempotent when running it several times with the same input gives the same result as running it once. I need that because retries are normal. They come from the orchestrator, the network and people. When data is split by day, I replace the whole range in one transaction: delete the day, insert the day. When single changes arrive, I merge on a business key. The merge alone isn’t enough: I deduplicate the source with a fixed rule, and I make sure a late, older change can’t overwrite a newer one. A plain insert isn’t idempotent. A good backfill is the same job with other dates. I recompute exactly the affected period from raw data, write by replacing the range, and compare the result with the source. But first I tell consumers which data is wrong.'
    },
    senior: {
      pl: 'Idempotentny zapis nie wystarczy, jeśli zmieniają się dane wejściowe. Backfill sprzed roku, liczony na dzisiejszym stanie wymiarów, da inny wynik niż wtedy. Powiedz też o publikacji atomowej, czyli w całości albo wcale: odbiorca powinien widzieć stary albo nowy komplet, nigdy połowę.',
      en: 'An idempotent write isn’t enough if the input changes. A year-old backfill, run against today’s dimension state, gives a different result than it did back then. Also mention atomic publication, which means all or nothing: a consumer should see the old set or the new set, never half.'
    },
    explain: [
      'Nocny job ładuje 6 płatności i traci połączenie po czwartej. Ktoś klika „ponów". Jeśli job dopisuje wiersze, w tabeli jest teraz 10 wierszy zamiast 6 i przychód jest zawyżony. Nikt nie popełnił błędu: ponowienie to normalna reakcja na awarię. Błąd jest w projekcie zapisu.',
      'Operacja <b>idempotentna</b> to taka, którą można powtarzać bez zmiany wyniku. Zastąpienie całego dnia w jednej transakcji spełnia ten warunek: po każdym uruchomieniu dzień zawiera dokładnie to, co wstawiono ostatnio. Daje też atomowość: jeśli transakcja się nie powiedzie, baza wycofa ją w całości.',
      'Zapis <code>MERGE</code> po kluczu działa podobnie dla pojedynczych wierszy: istniejący wiersz jest aktualizowany, nowy wstawiany. Wymaga wiarygodnego klucza i najwyżej jednego wiersza na klucz w paczce, wybranego według stałej reguły. Trzeba też pilnować, żeby spóźniona, starsza zmiana nie nadpisała nowszej. Deduplikacja po cechach podobieństwa, np. użytkownik i kwota, pomyli powtórkę z drugą, taką samą płatnością.',
      '<b>Backfill</b> to przeliczenie zakresu z przeszłości, zwykle po poprawieniu błędu. Jeśli codzienny job przyjmuje datę jako parametr i zapisuje idempotentnie, backfill jest tylko wywołaniem go dla innych dat. Działa tak daleko wstecz, jak sięgają surowe dane.'
    ],
    keywords: ['idempotency', 'retry', 'partition overwrite', 'MERGE', 'backfill', 'atomicity', 'deduplication'],
    followUps: [
      { q: 'Delete-and-insert or merge: how do you choose?', a: 'Replacing a range is the simplest when data has a natural partition, like a day, and each batch holds the complete range. Merge fits scattered changes, such as CDC. It needs a reliable key, at most one source row per key picked by a fixed rule, and a check that a late, older change doesn’t overwrite a newer one.', pl: 'Zastąpienie zakresu dla kompletnych dni, MERGE dla rozrzuconych zmian.' },
      { q: 'How do you pick a deduplication key?', a: 'An ID that the producer assigns when the event is created. A key guessed from the content, like user plus amount plus time, will merge two events that are really separate.', pl: 'Identyfikator nadany u źródła, nie cechy podobieństwa.' },
      { q: 'What can go wrong with a large backfill?', a: 'It can take compute away from the daily load. It can trigger every downstream consumer. And it can reach back further than raw data is kept. So I’d run it on separate compute, in batches, and check lineage to see what gets rebuilt.', pl: 'Zasoby, odbiorcy w dół i retencja RAW.' },
      { q: 'A job failed halfway. What do readers see?', a: 'With a transactional replace, they see the previous complete state. With appends committed one statement at a time, they see a partial day that looks valid. That’s why publication should be the last step, and it should be atomic.', pl: 'Przy transakcji poprzedni komplet, przy dopisywaniu połowę dnia.' }
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
      pl: 'Najpierw sprawdzam, który z dwóch objawów widzę. Zapytanie czeka w kolejce, bo inni zajęli zasoby. Albo samo liczy się długo, bo brakuje mu pamięci lub czyta za dużo danych. Długa kolejka przy krótkim wykonaniu to problem równoczesności: za dużo zapytań naraz. Wtedy pomaga skalowanie wszerz, czyli więcej klastrów. Pomaga też rozdzielenie obciążeń na osobne zasoby, żeby ładowanie nie konkurowało z dashboardami. Długie wykonanie ze zrzutem danych na dysk to problem jednego zapytania. Wtedy pomaga większa maszyna albo mniej danych do przeczytania, na przykład przetwarzanie przyrostowe. Osobne zasoby ułatwiają też kontrolę kosztu, bo widać, ile zużywa każde obciążenie. Większy rozmiar bez diagnozy to płacenie więcej za ten sam problem.',
      en: 'First I check which of two symptoms I see. Either the query waits in a queue, because others hold the resources. Or it runs long on its own, because it lacks memory or reads too much data. A long queue with short execution is a concurrency problem: too many queries at once. Scaling out with more clusters helps. So does putting workloads on separate compute, so loading doesn’t compete with dashboards. Long execution with spilling to disk is a single-query problem. A bigger machine helps, or less data to read, for example incremental processing. Separate compute also helps with cost control, because I can see what each workload uses. A bigger size without a diagnosis just means paying more for the same problem.'
    },
    senior: {
      pl: 'Skalowanie wszerz ma granice: krok, którego nie da się podzielić, przesyłanie danych przy joinach i nierówny rozkład kluczy. W platformie dla wielu klientów (multi-tenant) trzeba jeszcze wybrać, jak ich rozdzielić: wspólne tabele z filtrem po kliencie, schemat na klienta albo osobne konto. Zależy to od wymaganej izolacji i kosztu utrzymania.',
      en: 'Scaling out has limits: a step that can’t be split, moving data between machines for joins, and uneven key distribution. On a multi-tenant platform you also choose how to separate tenants: shared tables with a tenant filter, a schema per tenant, or a separate account. It depends on how much isolation is required and what it costs to operate.'
    },
    explain: [
      'Skalowanie <b>w górę</b> to większa maszyna, a <b>wszerz</b> to więcej maszyn. Rozwiązują różne problemy. Większa maszyna ma więcej pamięci i procesorów dla jednego zapytania. Więcej maszyn obsłuży więcej zapytań naraz, ale pojedynczego, ciężkiego zapytania zwykle nie przyspieszy.',
      'Stąd diagnoza przed decyzją. Jeśli zapytanie czeka cztery minuty, a liczy się sześć sekund, to nie jest wolne, tylko nie może się zacząć. Jeśli liczy się półtorej godziny i zapisuje dane pośrednie na dysk, bo nie mieszczą się w pamięci, to brakuje mu zasobów. W Snowflake oba objawy są osobnymi kolumnami w historii zapytań.',
      '<b>Izolacja obciążeń</b> to danie każdemu rodzajowi pracy własnych zasobów: osobno ładowanie, osobno transformacje, osobno raporty. Ciężki job nie blokuje wtedy dashboardów, każdy zasób ma rozmiar dobrany do swojej pracy i wyłącza się, gdy nie jest używany.',
      'Przetwarzanie rozproszone dzieli dane na części liczone równolegle. Nie skaluje się bez końca: operacje, które muszą zebrać te same klucze w jednym miejscu, wymagają przesłania danych, a jeden bardzo duży klucz obciąża jedną maszynę niezależnie od ich liczby.'
    ],
    keywords: ['scale up', 'scale out', 'workload isolation', 'concurrency', 'queueing', 'spilling', 'multi-tenant'],
    followUps: [
      { q: 'When does a bigger warehouse end up cheaper?', a: 'When the query was spilling to disk. If the rate doubles but the run gets more than twice as fast, the total cost goes down. I’d check that on the actual query, not assume it.', pl: 'Gdy znika zrzut na dysk i czas spada bardziej niż dwukrotnie. Do sprawdzenia, nie do założenia.' },
      { q: 'How would you isolate tenants on a shared platform?', a: 'It depends on how much isolation the contract requires. Shared tables with an enforced row filter scale to many small tenants. Separate schemas or accounts isolate better, but they cost more to operate. Large tenants often get dedicated compute.', pl: 'Wspólne tabele z wymuszonym filtrem, schemat na klienta albo osobne konto.' },
      { q: 'How do you plan capacity for a new source?', a: 'I start with a rough estimate. Events per day times event size gives me the daily and yearly volume. Peak traffic, not the average, tells me what ingestion has to handle. Then I check whether a full recompute still fits in the batch window.', pl: 'Rachunek: wolumen dzienny i roczny, szczyt zamiast średniej, okno na przeliczenie.' },
      { q: 'How do you keep cost under control?', a: 'Auto-suspend for idle compute. Incremental processing instead of full recomputation. Spending limits with alerts. And separate compute per workload, so each cost has an owner.', pl: 'Auto-wyłączanie, przetwarzanie przyrostowe, limity z alertami, koszt przypisany do właściciela.' }
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
      pl: 'Jakość danych to reguły, które znam z góry i sprawdzam testami: klucz jest unikalny, pole nie jest puste, wartość jest z dozwolonej listy. Obserwowalność wykrywa to, czego nie przewidziałem: tabela przestała się odświeżać, przyszło czterdzieści procent zwykłej liczby wierszy, zmienił się schemat. Pomaga też znaleźć przyczynę dzięki lineage, czyli mapie zależności między tabelami. Potrzebuję obu. Liczby finansowe dodatkowo porównuję ze źródłem. Niezawodność ustalam razem z odbiorcą. SLI to miara, na przykład godzina, o której dane były gotowe. SLO to cel dla tej miary. SLA to umowa, która mówi, co się dzieje, gdy cel nie jest spełniony. Do tego RPO i RTO: ile danych mogę stracić i jak długo może trwać przywracanie.',
      en: 'Data quality means rules I know in advance and check with tests: the key is unique, the field isn’t null, the value is in a list. Observability catches what I didn’t predict: a table stopped refreshing, only forty percent of the usual rows arrived, the schema changed. It also helps me find the cause through lineage, which is the map of dependencies between tables. I need both. For financial numbers, I also compare totals with the source. I define reliability together with the consumer. An SLI is the measure, for example the time the data was ready. An SLO is the target for that measure. An SLA is an agreement that says what happens when the target is missed. Then RPO and RTO: how much data I can lose, and how long recovery may take.'
    },
    senior: {
      pl: 'Dopowiedz, że replikacja to nie kopia zapasowa: błędny UPDATE też się zreplikuje. Na błąd człowieka potrzebna jest historia tabel albo surowe pliki. Na awarię regionu potrzebna jest druga lokalizacja. I że tabela bez właściciela nie ma poziomu usług, bo nikt nie zareaguje na alert.',
      en: 'Add that replication isn’t a backup: a bad update gets replicated too. Human error needs table history or raw files. A region outage needs a second location. And a table without an owner has no service level, because nobody will act on the alert.'
    },
    explain: [
      'Job może zakończyć się sukcesem i załadować zero wierszy. Test unikalności tego nie zauważy, bo wczorajsze wiersze nadal są unikalne. Testy sprawdzają dane, które są w tabeli, i tylko pod kątem reguł, które ktoś zapisał. To jest <b>jakość danych</b>.',
      '<b>Obserwowalność danych</b> patrzy na tabelę z zewnątrz: kiedy ostatnio się odświeżyła, ile wierszy przybyło, czy zmienił się schemat. Porównuje to z historią, więc nie wymaga napisania progu dla każdej tabeli. Wykrywa odchylenie, a <b>lineage</b>, czyli mapa zależności między tabelami, pomaga znaleźć przyczynę i odbiorców, których trzeba zawiadomić.',
      'Dane mogą być złe na cztery sposoby: spóźnione, niepełne, błędne albo sprzeczne między raportami. Tego ostatniego nie naprawi żadne narzędzie: wymaga jednej definicji metryki i jej właściciela.',
      'Poziomy usług porządkują rozmowę z odbiorcą. Miara, cel i umowa to trzy różne rzeczy. Cel „99% dni" przy jednym przebiegu dziennie nie dopuszcza w kwartale ani jednego spóźnienia, więc trzeba go zestawić z kosztem jego spełnienia.'
    ],
    keywords: ['data quality', 'observability', 'freshness', 'lineage', 'SLA', 'SLO', 'SLI', 'RPO', 'RTO'],
    followUps: [
      { q: 'Give me an example of an SLI, an SLO and an SLA for a report.', a: 'The SLI is the time when the report table had last night’s data and passed its tests. The SLO is: before seven, on ninety-five percent of days in a quarter. The SLA is what we owe finance when we miss that target.', pl: 'SLI to miara, SLO to cel, SLA to umowa z konsekwencją.' },
      { q: 'What is the difference between RPO and RTO?', a: 'RPO is how much data I can afford to lose. It’s measured in time: how far back the last recovery point is. RTO is how long the restore may take. The business sets both, and they usually differ per dataset.', pl: 'RPO: ile danych tracę. RTO: jak długo przywracam.' },
      { q: 'How do you protect personal data on the platform?', a: 'Least privilege: each role gets only what its job needs. Personal fields are masked for roles that don’t need them. Row filters limit which rows a role can see. Access to raw is restricted to service accounts. And a deletion request has to reach every copy.', pl: 'Najmniejsze uprawnienia, maskowanie, filtr wierszy, ograniczony dostęp do RAW.' },
      { q: 'What is a data contract?', a: 'An agreement between the team that produces the data and the team that uses it. It covers fields, types, freshness, ownership and how changes are announced. It only works if something enforces it, such as a test at the platform boundary or a check in the producer’s deployment.', pl: 'Uzgodnienie pól, typów, świeżości i sposobu zmian, egzekwowane testem.' }
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
      pl: 'Pytam, kto działa na podstawie danych i jak szybko. Człowiek, który rano czyta raport: batch, bo jest najtańszy i łatwo go przeliczyć od nowa. Człowiek, który patrzy na monitor: micro-batch co kilka minut. System, który musi zareagować w trakcie operacji, na przykład zablokować oszustwo: streaming. Mniejsze opóźnienie kosztuje więcej pieniędzy i daje bardziej złożony system. Streaming ma dwa dodatkowe problemy. Pierwszy to spóźnione zdarzenia. Liczę według czasu zdarzenia, a watermark ustala, jak długo na nie czekam. Drugi to gwarancje dostarczenia. At-least-once znaczy, że nic nie ginie, ale zdarzenie może przyjść dwa razy. Efekt exactly-once uzyskuję, łącząc źródło, które da się odtworzyć, z idempotentnym zapisem.',
      en: 'I ask who acts on the data and how fast. A person reading a report in the morning: batch, because it’s the cheapest and easy to recompute. A person watching a monitor: micro-batch every few minutes. A system that has to react during an operation, for example to block fraud: streaming. Lower latency costs more money and makes the system more complex. Streaming brings two extra problems. The first is late events. I compute by event time, and a watermark decides how long I wait for them. The second is delivery guarantees. At-least-once means nothing is lost, but an event may arrive twice. I get an exactly-once effect by combining a source I can replay with an idempotent write.'
    },
    senior: {
      pl: 'Exactly-once to cecha całego łańcucha, a nie przełącznik w kolejce. Checkpoint zapamiętuje pozycję w źródle. Zapis musi być idempotentny albo zatwierdzany razem z tą pozycją. Lambda utrzymuje obok siebie ścieżkę batchową i strumieniową. Kappa ma tylko strumieniową i odtwarza dziennik zdarzeń.',
      en: 'Exactly-once is a property of the whole chain, not a switch on the queue. A checkpoint records the position in the source. The write must be idempotent, or committed together with that position. Lambda keeps a batch path and a streaming path side by side. Kappa keeps only the streaming path and replays the log.'
    },
    explain: [
      'Batch przetwarza o ustalonej porze wszystko, co się zebrało. Streaming przetwarza każde zdarzenie, gdy nadejdzie. Micro-batch jest pośrodku: małe porcje co kilka sekund albo minut. Różnica nie leży w danych, tylko w tym, kiedy są przetwarzane i ile kosztuje utrzymanie systemu, który działa bez przerwy.',
      'Każde zdarzenie ma dwa czasy: kiedy się wydarzyło i kiedy dotarło do systemu. Telefon bez zasięgu wysyła zdarzenie z kwadransem opóźnienia. Jeśli liczysz według czasu dotarcia, przypiszesz je do złej minuty. Jeśli według czasu zdarzenia, musisz zdecydować, jak długo czekasz na spóźnione, zanim zamkniesz wynik. Tę granicę nazywa się <b>watermarkiem</b>.',
      'Konsument czyta zdarzenia, zapisuje je i potwierdza kolejce, dokąd doszedł. Zapamiętana pozycja to <b>checkpoint</b>. Jeśli padnie po zapisie, a przed potwierdzeniem, po restarcie przeczyta te same zdarzenia ponownie. To jest at-least-once: nic nie ginie, mogą być duplikaty.',
      'Żeby duplikaty nie trafiły do wyniku, zapis musi być idempotentny, np. <code>MERGE</code> po identyfikatorze zdarzenia. Dostawa nadal jest co najmniej raz, ale skutek w tabeli jest taki, jakby była dokładnie raz.'
    ],
    keywords: ['batch', 'micro-batch', 'streaming', 'event time', 'watermark', 'checkpoint', 'at-least-once', 'exactly-once'],
    followUps: [
      { q: 'What is the difference between event time and processing time?', a: 'Event time is when something happened. Processing time is when the system received it. They drift apart when devices are offline or queues back up. Analytics should group by event time. Otherwise an outage shows up as a fake traffic spike.', pl: 'Kiedy się wydarzyło kontra kiedy dotarło. Analityka grupuje po czasie zdarzenia.' },
      { q: 'What does a watermark trade off?', a: 'Completeness against latency and state. If I wait longer, I catch more late events, but the result comes later and more windows stay open in memory. Events later than the watermark may be dropped.', pl: 'Kompletność kontra opóźnienie i pamięć.' },
      { q: 'What is at-most-once and when is it acceptable?', a: 'The position is committed before processing. So a crash can lose data, but it never duplicates it. That’s acceptable for metrics where a small loss doesn’t matter. It’s not acceptable for payments.', pl: 'Potwierdzenie przed przetworzeniem: może zgubić, nie zdubluje.' },
      { q: 'How does this map to Snowflake?', a: 'Snowpipe loads new files within minutes, so that’s micro-batch. A stream with a task processes table changes in small transactions. The stream position moves forward only when the consuming transaction commits. That’s the same idea as a checkpoint.', pl: 'Snowpipe oraz Streams z Tasks to micro-batch z zapamiętaną pozycją.' }
    ],
    mistakes: [
      'Wybór streamingu, bo „real-time brzmi lepiej", bez pytania o decyzję, której służy.',
      'Twierdzenie, że kolejka sama gwarantuje exactly-once w tabeli docelowej.',
      'Liczenie okien według czasu dotarcia zdarzenia.',
      'Pominięcie kosztu utrzymania systemu działającego całą dobę.'
    ]
  }
];

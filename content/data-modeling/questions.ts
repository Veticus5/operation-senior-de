import type { Question } from '../types';

/**
 * Pytania: modelowanie danych, architektura wymiarowa i warstwa semantyczna.
 *
 * Źródła: docs/verified-facts.md, sekcja „Lekcja: Advanced Data Modeling". Liczby w polach `explain`
 * pochodzą z małego, wymyślonego zbioru z lekcji i odtwarza je labs/data_modeling/modeling_sql_check.py.
 * Odpowiedzi są projektowe („I would", „zrobiłbym"): nie przypisują mówiącemu doświadczeń produkcyjnych.
 */
export const modelingQuestions: Question[] = [
  {
    id: 'modeling-star-schema-grain',
    topicId: 'modeling.dimensional',
    area: 'data-modeling',
    priority: 'P0',
    title: 'Star schema i ziarno tabeli faktów',
    question: {
      pl: 'Jak projektujesz model wymiarowy dla nowego procesu biznesowego? Czym jest ziarno i dlaczego ustala się je najpierw?',
      en: 'How do you design a dimensional model for a new business process? What is the grain, and why do you declare it first?'
    },
    answer: {
      pl: 'Zaczynam od procesu biznesowego i pytań, na które model ma odpowiedzieć, a nie od kolumn w źródle. Potem ustalam ziarno, czyli jednym zdaniem mówię, co opisuje jeden wiersz tabeli faktów. Na przykład: jedna wpłata albo zwrot. Dopiero potem dobieram wymiary, czyli opisy, po których się filtruje i grupuje, oraz miary, czyli liczby do sumowania. Ziarno jest pierwsze, bo każdy wymiar i każda miara muszą do niego pasować. Domyślnie biorę ziarno najbardziej szczegółowe, czyli atomowe. Ze szczegółu zawsze policzę sumę, a z sumy szczegółu nie odtworzę. Dwóch ziaren nie mieszam w jednej tabeli: wpłaty i stan na koniec miesiąca to dwie tabele faktów.',
      en: "I start from the business process and the questions the model has to answer, not from the source columns. Then I declare the grain: I say in one sentence what one row of the fact table is. For example, one payment or one refund. Only then do I pick the dimensions, the descriptions people filter and group by, and the measures, the numbers we add up. The grain comes first because every dimension and every measure has to fit it. By default I go for the most detailed grain, the atomic one. I can always sum up detail, but I can’t get detail back from a sum. And I never mix two grains in one table: payments and month-end state are two fact tables."
    },
    senior: {
      pl: 'Gdy rozmówca drąży, dodaję cztery rzeczy. Po pierwsze sygnał złego ziarna: jeśli wymiar ma kilka wartości na jeden wiersz faktu, to albo ziarno jest złe, albo potrzebuję tabeli pomostowej. Po drugie test ziarna: zwykłe złączenie faktu z wymiarem ma być wiele do jednego, a klucze mają do siebie pasować. Sprawdzam unikalność i brakujące klucze oraz porównuję sumy, a nie tylko liczbę wierszy. Po trzecie wymiary wspólne: ten sam wymiar daty, produktu i wydawcy we wszystkich faktach. To one łączą tabele faktów o różnym ziarnie i pozwalają zestawiać wyniki. Po czwarte koszt: ziarno atomowe to więcej wierszy. Tabele zagregowane dokładam więc później, jako optymalizację, której użytkownik nie widzi.',
      en: "If they dig deeper, I add four things. First, a sign of a wrong grain: if a dimension has several values for one fact row, either the grain is wrong or I need a bridge table. Second, a test for the grain: ordinary joins from a fact to a dimension should be many-to-one, with matching keys. I check uniqueness and missing keys, and I reconcile totals, not just row counts. Third, conformed dimensions: the same date, product and publisher dimension across all facts. They link fact tables of different grain and let me put results side by side. Fourth, the cost: atomic grain means more rows. So I add aggregate tables later, as an optimisation users don’t have to know about."
    },
    explain: [
      'Model wymiarowy dzieli dane na dwa rodzaje tabel. <b>Tabela faktów</b> zapisuje to, co się mierzy: jeden wiersz to jedno zdarzenie albo jeden stan, z liczbami takimi jak kwota. <b>Wymiary</b> opisują kontekst: kto, co, kiedy, u kogo. Fakt wskazuje wymiary kluczami, a układ z faktem pośrodku nazywa się star schema.',
      '<b>Ziarno</b> to odpowiedź na pytanie „co opisuje jeden wiersz faktu”. Kimball Group opisuje projekt jako cztery decyzje: proces biznesowy, ziarno, wymiary, fakty, i zaznacza, że ziarno deklaruje się przed wyborem wymiarów i miar, bo muszą być z nim zgodne.',
      'Przykład z lekcji: pytania o dzienny przychód per produkt obsługuje ziarno „jedna transakcja”. Pytania o liczbę aktywnych subskrypcji na koniec miesiąca już nie, bo subskrypcja roczna nie ma transakcji w większości miesięcy. To drugie ziarno i druga tabela faktów.',
      'Ziarno atomowe, czyli najbardziej szczegółowe, jest zaleceniem, a nie nakazem. Daje najwięcej możliwości krojenia danych. Tabele o wyższym ziarnie, czyli z gotowymi sumami, buduje się z niego dla wydajności.'
    ],
    keywords: ['grain', 'ziarno', 'star schema', 'fact table', 'dimension', 'Kimball', 'atomic'],
    followUps: [
      { q: 'Star schema or snowflake schema: which do you choose and why?', a: "Star by default. Both hold the same information. But in a star each dimension is flattened and one join away from the fact, so it’s easier for business users to navigate. I’d normalise a dimension only for a concrete reason, for example a very large shared hierarchy that several dimensions reuse. Kimball advises against snowflaking, and Microsoft says a single dimension table is generally the better choice for Power BI models.", pl: 'Domyślnie gwiazda: te same informacje, mniej złączeń, prostsza nawigacja. Płatek śniegu tylko z konkretnego powodu.' },
      { q: 'How do you know the grain you declared is actually true in the data?', a: "I test it. The columns that define the grain must be unique together in the fact table, so I put a uniqueness test on them. And each dimension key must be unique in its dimension. Otherwise the join multiplies fact rows. I also check for missing dimension keys and reconcile the measures. Matching row counts alone can hide lost and duplicated rows.", pl: 'Test unikalności na kolumnach ziarna i na kluczach wymiarów. Sprawdzam także brakujące klucze i zgodność sum; sama liczba wierszy nie wystarcza.' },
      { q: 'A stakeholder asks for one wide table instead of a star. What do you say?', a: "It’s fine as a presentation layer for one use case, and I’d build it from the star, not instead of it. The star keeps one definition of customer or product for every report and gives me a place to handle history. A wide table built straight from sources tends to be redefined for each new report.", pl: 'Szeroka tabela może być warstwą prezentacji zbudowaną z gwiazdy, ale nie jej zamiennikiem.' },
      { q: 'What is a degenerate dimension?', a: "An identifier like an order or transaction number that has no attributes of its own. It stays as a column in the fact table without a dimension table, because that dimension would have one column and as many rows as the fact. People still filter and group by it.", pl: 'Identyfikator bez własnych atrybutów, na przykład numer transakcji. Zostaje w tabeli faktów.' }
    ],
    mistakes: [
      'Wymienianie kolumn tabeli faktów bez zdania, co opisuje jeden wiersz.',
      'Mieszanie dwóch ziaren w jednej tabeli, na przykład wierszy dziennych i wiersza z podsumowaniem miesiąca.',
      'Wybieranie ziarna zagregowanego „bo tyle potrzebuje raport”. Pierwsze nowe pytanie wymaga przebudowy.',
      'Mówienie, że star schema jest potrzebna dla wydajności. Jej główną zaletą jest jednoznaczność: jedno złączenie do każdego wymiaru i jedna definicja każdego opisu.'
    ]
  },
  {
    id: 'modeling-fan-out-double-counting',
    topicId: 'modeling.fan-out',
    area: 'data-modeling',
    priority: 'P0',
    title: 'Fan-out, podwójne liczenie i wiele do wielu',
    question: {
      pl: 'Liczba na dashboardzie jest wyższa niż w systemie źródłowym. Jak szukasz przyczyny i jak modelujesz relacje, żeby do tego nie dochodziło?',
      en: "A number on a dashboard is higher than in the source system. How do you find the cause, and how do you model relationships so it doesn’t happen?"
    },
    answer: {
      pl: 'Zawyżona suma to najczęściej fan-out. Jeden wiersz z liczbą pasuje do kilku wierszy po drugiej stronie złączenia, więc ta liczba liczy się kilka razy. Szukam go tak: porównuję liczbę wierszy przed każdym złączeniem i po nim oraz sprawdzam, czy klucze złączenia są unikalne. Typowe przyczyny to złączenie dwóch tabel faktów o różnym ziarnie, zduplikowany klucz w wymiarze albo wymiar z historią złączony bez warunku na daty. Naprawa: przed złączeniem sprowadzam obie strony do tego samego ziarna. Każdy fakt agreguję osobno do wspólnego wymiaru i dopiero zestawiam wyniki. Prawdziwą relację wiele do wielu modeluję tabelą pomostową i jawnie decyduję, czy wyniki mają się sumować do całości.',
      en: "An inflated total is usually fan-out. One row with a number matches several rows on the other side of a join, so that number gets counted several times. To find it, I compare row counts before and after each join and check that the join keys are unique. The usual causes are joining two fact tables with different grains, a duplicate key in a dimension, or a dimension with history joined without a date condition. The fix is to bring both sides to the same grain before the join. I aggregate each fact on its own, up to a shared dimension, and then put the results side by side. A real many-to-many relationship gets a bridge table, plus an explicit decision on whether results should add up to the total."
    },
    senior: {
      pl: 'Dodałbym, że DISTINCT niczego nie naprawia. Przy licznikach ukrywa problem. Sumy nadal są błędne albo gubią wartości, które naprawdę się powtarzają. Przy tabeli pomostowej jednym ze sposobów na wyniki, które sumują się do całości, są wagi podziału. Narzędzia BI mają własne zabezpieczenia, ale działają one pod warunkami. Looker poprawia sumy mechanizmem symmetric aggregates tylko wtedy, gdy widoki mają klucz główny, a relacja jest poprawnie zadeklarowana. Power BI oczekuje unikalnych wartości po stronie „jeden”. Dlatego unikalność kluczy testuję w hurtowni, zanim model trafi do BI.',
      en: "I’d add that DISTINCT isn’t a fix. For counts it hides the problem. Sums stay wrong, or they lose values that really do repeat. With a bridge table, allocation weights are one way to make results add up to the total. BI tools have their own safeguards, but they come with conditions. Looker corrects totals with symmetric aggregates only when the views have a primary key and the join relationship is declared correctly. Power BI expects unique values on the “one” side. So I test key uniqueness in the warehouse, before the model ever reaches the BI layer."
    },
    explain: [
      'Złączenie zwraca jeden wiersz na każdą pasującą parę. Jeśli subskrypcja ma dwie transakcje, po złączeniu subskrypcji z transakcjami jej wiersz występuje dwa razy. Kwoty transakcji nadal są poprawne, ale każda kolumna z tabeli subskrypcji, na przykład miesięczna opłata, jest powtórzona. Suma tej kolumny rośnie. To jest <b>fan-out</b>.',
      'W przykładzie z lekcji cztery subskrypcje mają razem 36 EUR miesięcznej opłaty. Po złączeniu z sześcioma transakcjami suma wychodzi 56. Jeden z wydawców wygląda poprawnie, bo ma jedną transakcję, więc błąd nie jest widoczny na pierwszy rzut oka.',
      'Bezpieczne złączenie idzie od faktu do wymiaru w relacji wiele do jednego: wiele wierszy faktu wskazuje jeden wiersz wymiaru, więc fakt się nie powiela. Dwie tabele faktów łączy się pośrednio: każdą agreguje się do tego samego poziomu i zestawia wyniki. Kimball nazywa to drill-across.',
      'Gdy relacja naprawdę jest wiele do wielu, na przykład produkt w kilku kategoriach, pośrodku staje <b>tabela pomostowa</b>. Nie usuwa ona powielenia: suma po kategoriach przekracza całość, dopóki nie doda się wag albo nie przyjmie, że wyniki się nie sumują.'
    ],
    keywords: ['fan-out', 'double counting', 'podwójne liczenie', 'bridge table', 'many-to-many', 'drill-across', 'symmetric aggregates', 'cardinality'],
    followUps: [
      { q: 'Why not just use COUNT(DISTINCT) or SELECT DISTINCT to fix it?', a: "Because it only works for counts of a unique key. For a sum, DISTINCT either leaves the duplicates in or collapses rows that are legitimately equal, like two subscriptions with the same price. It also hides the modelling problem, so the next measure someone adds is wrong again.", pl: 'DISTINCT ratuje liczniki po unikalnym kluczu, nie sumy. I maskuje błąd modelu.' },
      { q: 'You need revenue and month-end MRR in one report. How do you combine two fact tables?', a: "I don’t join them to each other. I aggregate each one to the level of the report, say publisher and month, using the same conformed dimensions, and then join those two small results. That’s drill-across. Each fact keeps its own grain and nothing is multiplied.", pl: 'Osobna agregacja każdego faktu do wspólnych wymiarów, potem zestawienie wyników. Faktów nie łączy się bezpośrednio.' },
      { q: 'How would you model a product that belongs to several categories?', a: "With a bridge table between product and category. Then I ask the business how totals should behave. Either each category shows the full revenue and the categories don’t add up to the grand total, or the bridge carries an allocation weight per row so they do. Both are valid; it has to be a stated decision.", pl: 'Tabela pomostowa plus decyzja biznesowa: pełne kwoty, które się nie sumują, albo wagi podziału.' },
      { q: 'What does Looker do about fan-out, and what are the limits?', a: "Looker has symmetric aggregates: when a join fans out, it generates SQL that still computes sums and counts correctly. According to the docs it depends on a unique primary key on each view and on the join relationship being specified correctly. If the declared relationship doesn’t match the data, the result can’t be trusted.", pl: 'Symmetric aggregates działają pod warunkiem klucza głównego i poprawnie zadeklarowanej relacji.' }
    ],
    mistakes: [
      'Naprawianie zawyżonej sumy przez DISTINCT zamiast przez ustalenie, które złączenie powiela wiersze.',
      'Łączenie dwóch tabel faktów bezpośrednio po wspólnym kluczu.',
      'Zakładanie, że narzędzie BI samo ochroni przed podwójnym liczeniem. Zabezpieczenia zależą od poprawnie zadeklarowanych kluczy i relacji.',
      'Traktowanie tabeli pomostowej jako rozwiązania podwójnego liczenia. Rozwiązuje strukturę relacji, a nie pytanie, jak sumować.'
    ]
  },
  {
    id: 'modeling-fact-table-types',
    topicId: 'modeling.fact-types',
    area: 'data-modeling',
    priority: 'P1',
    title: 'Rodzaje tabel faktów i addytywność miar',
    question: {
      pl: 'Jakie znasz rodzaje tabel faktów i kiedy wybierasz który? Jak to się łączy z tym, czy miarę wolno sumować?',
      en: 'What types of fact tables do you know, and when do you choose each? How does that relate to whether a measure can be summed?'
    },
    answer: {
      pl: 'Są trzy podstawowe rodzaje. Tabela transakcyjna ma wiersz na zdarzenie, na przykład wpłatę, i tylko wtedy, gdy coś się wydarzyło. Okresowa migawka ma wiersz na obiekt na okres, na przykład subskrypcję na koniec miesiąca, także gdy nic się nie działo. Dlatego odpowiada na pytania o stan. Narastająca migawka ma jeden wiersz na cały przebieg procesu o znanych etapach. Ten wiersz uzupełnia się przy kolejnych etapach, więc dobrze widać czas między nimi. Często potrzebne są dwa rodzaje obok siebie. Od rodzaju zależy też sumowanie. Kwoty zdarzeń sumują się po wszystkim, o ile waluta jest zgodna, a grupy na siebie nie zachodzą. Stany, takie jak MRR czy saldo, zwykle sumują się po takich grupach, ale nie po czasie. Odsetki nie sumują się wcale.',
      en: "There are three basic types. A transaction fact table has one row per event, like a payment, and only when something happened. A periodic snapshot has one row per entity per period, like a subscription at month end, even when nothing happened. So it answers questions about state. An accumulating snapshot has one row for a whole process with known milestones. That row gets updated at each milestone, so it’s good for the time between steps. You often need two types side by side. The type also decides what you can sum. Event amounts add up across everything, as long as currencies match and groups don’t overlap. States like MRR or a balance usually add up across those groups, but not across time. Ratios don’t add up at all."
    },
    senior: {
      pl: 'Pogłębiając, powiedziałbym, że wybór wynika z pytania biznesowego, a potem co on znaczy dla ładowania. Do tabeli transakcyjnej i do okresowej migawki wiersze często się tylko dopisuje, ale korekty i spóźnione dane mogą wymagać aktualizacji. Narastającą migawkę aktualizuje się przy kolejnych etapach. Migawki nie da się rzetelnie odtworzyć wstecz, jeśli źródło trzyma tylko stan bieżący. Warto więc zacząć ją zbierać wcześnie. W warstwie semantycznej miary póładdytywne i nieaddytywne udostępniam jako zdefiniowane miary. Surowe kolumny ukrywam, bo narzędzie BI domyślnie je zsumuje.',
      en: "Going deeper, I’d say the choice follows from the business question, and then what it means for loading. Transaction tables and periodic snapshots are often append-oriented, but corrections and late data may need updates. Accumulating snapshots are updated as milestones arrive. A snapshot can’t be reliably rebuilt for the past if the source only keeps the current state. So it’s worth starting to collect it early. In the semantic layer I expose semi-additive and non-additive measures as defined measures. I hide the raw columns, because a BI tool will sum them by default."
    },
    explain: [
      '<b>Tabela transakcyjna</b>: jeden wiersz to jedno zdarzenie w konkretnym momencie. Jeśli subskrypcja roczna zapłaciła w styczniu, w lutym nie ma jej wiersza. Tabela mówi, co się wydarzyło, ale nie mówi wprost, jaki jest stan.',
      '<b>Okresowa migawka</b> (periodic snapshot): jeden wiersz na obiekt na okres. Subskrypcja aktywna 28 lutego ma wiersz za luty niezależnie od tego, czy zapłaciła. Dlatego na pytanie „ile aktywnych na koniec miesiąca” odpowiada zwykłe zliczenie wierszy.',
      '<b>Narastająca migawka</b> (accumulating snapshot): jeden wiersz na przebieg procesu, z osobną datą każdego etapu, na przykład rejestracji, pierwszej wpłaty i rezygnacji. Wiersz powstaje na początku i jest uzupełniany. Kimball zaznacza, że to jedyny z trzech rodzajów, w którym wiersze się aktualizuje.',
      'Miara <b>addytywna</b> sumuje się po każdym wymiarze. <b>Póładdytywna</b> po niektórych: MRR z końców trzech miesięcy (28, 36, 26) nie daje 90 EUR przychodu kwartału. <b>Nieaddytywna</b>, na przykład odsetek zwrotów, wymaga przechowywania licznika i mianownika, a dzielenia na końcu.'
    ],
    keywords: ['transaction fact', 'periodic snapshot', 'accumulating snapshot', 'additive', 'semi-additive', 'non-additive', 'MRR', 'migawka'],
    followUps: [
      { q: 'Why keep a periodic snapshot if you can derive state from the events?', a: "In simple cases you can derive it, but it’s expensive and easy to get inconsistent: every query has to replay the history the same way. A snapshot stores the answer once, at a declared grain. And if the source only keeps current state, the snapshot is the only record of what the state was.", pl: 'Odtwarzanie stanu ze zdarzeń jest kosztowne i podatne na rozbieżności. Migawka zapisuje odpowiedź raz.' },
      { q: 'How do you report a semi-additive measure like MRR for a quarter?', a: "Not by summing months. I’d define it explicitly: either the value on the last day of the period, or the average across the periods, and name the measure accordingly. Within a single date it still sums fine across subscriptions, products and publishers.", pl: 'Stan z ostatniego dnia okresu albo średnia, nazwane wprost. Nigdy suma po czasie.' },
      { q: 'What is a factless fact table and when is it useful?', a: "A fact table with only dimension keys and no numeric measure. It records that something happened, like a customer attending an event, or that something was possible, like a product being on promotion on a day. Comparing coverage with actual sales answers what didn’t happen, which a sales table can’t tell you.", pl: 'Tabela samych kluczy: zdarzenie bez miary albo pokrycie. Pozwala zapytać o to, co się nie wydarzyło.' },
      { q: 'Where would you store a refund rate?', a: "I wouldn’t store the rate. I’d store the two additive components, refund count and payment count, and compute the ratio in the semantic layer for whatever slice the user picks. A ratio stored at one grain is wrong at every other grain.", pl: 'Przechowuje się licznik i mianownik, a iloraz liczy się na końcu, w kontekście filtra.' }
    ],
    mistakes: [
      'Sumowanie stanu po czasie, na przykład MRR albo salda z kolejnych miesięcy.',
      'Przechowywanie gotowego odsetka w tabeli faktów i uśrednianie go w raporcie.',
      'Traktowanie trzech rodzajów jako alternatyw. Zwykle tabela transakcyjna i migawka istnieją obok siebie.',
      'Pomijanie tego, że narastająca migawka wymaga aktualizacji wierszy, więc ładowanie musi obsługiwać MERGE albo UPDATE.'
    ]
  },
  {
    id: 'modeling-scd-types',
    topicId: 'modeling.scd',
    area: 'data-modeling',
    priority: 'P0',
    title: 'SCD typ 1 i typ 2, złączenie punkt-w-czasie',
    question: {
      pl: 'Czym różni się Slowly Changing Dimension typu 1 od typu 2? Jak wybierasz i jak łączysz fakty z wymiarem, który ma historię?',
      en: 'What is the difference between a Type 1 and a Type 2 Slowly Changing Dimension? How do you choose, and how do you join facts to a dimension that has history?'
    },
    answer: {
      pl: 'Typ 1 nadpisuje atrybut nową wartością. To proste, ale historia znika, a stare raporty zmieniają się wstecz. Typ 2 przy każdej zmianie dodaje nowy wiersz. Ma on nowy klucz zastępczy, daty początku i końca ważności oraz znacznik bieżącej wersji. Wybieram osobno dla każdego atrybutu. Pytam biznes: czy raport za zamknięty okres ma się zmienić, gdy ta wartość się zmieni? Poprawka literówki to typ 1. Zmiana kraju albo segmentu, która wpływa na czytanie przychodu, to typ 2. Fakt łączę z typem 2 kluczem zastępczym tej wersji, która obowiązywała w chwili zdarzenia. Szukam go raz, przy ładowaniu: data zdarzenia musi się mieścić w przedziale ważności wersji. Dzięki temu zapytania analityczne robią zwykłe złączenie po równości kluczy.',
      en: "Type 1 overwrites the attribute. It’s simple, but the history is gone and old reports change after the fact. Type 2 adds a new row for every change, with a new surrogate key, start and end dates, and a current-row flag. I choose per attribute, by asking the business: should a report for a closed period change when this value changes? Fixing a typo is Type 1. A change of country or segment that affects how you read revenue is Type 2. I join facts to a Type 2 dimension with the surrogate key of the version that was valid when the event happened. I look that key up once, at load time: the event date has to fall inside the version’s validity interval. After that, queries use a plain equality join on the key."
    },
    senior: {
      pl: 'Dopowiedziałbym o przedziałach ważności. Muszą być rozłączne i bez dziur, z jednym końcem otwartym. Inaczej zdarzenie z dnia zmiany pasuje do dwóch wersji albo do żadnej. Typ 2 często ma obsłużyć oba widoki: historyczny i bieżący. Wtedy każdą wersję łączę z bieżącym wierszem o tym samym kluczu naturalnym. Koszty typu 2 to rosnący wymiar, wykrywanie zmian przy ładowaniu i ryzyko fan-outu, gdy ktoś złączy po kluczu naturalnym bez dat.',
      en: "I’d add a point about validity intervals. They shouldn’t overlap, so I use half-open intervals. Gaps can be legitimate, so I define how to handle “unknown” instead of assigning an expired version. A Type 2 dimension often has to serve both views, historical and current. For the current view I link each version to the current row with the same natural key. The costs of Type 2 are a growing dimension, change detection in the load, and a fan-out risk if someone joins on the natural key without dates."
    },
    explain: [
      'Wymiar opisuje obiekt, a obiekty się zmieniają: klient zmienia kraj, wydawca plan cenowy. Pytanie brzmi, co ma pokazać raport o przeszłości. W przykładzie z lekcji klient przeprowadza się 10 lutego z Niemiec do Polski.',
      '<b>Typ 1</b> nadpisuje kraj. Wszystkie wpłaty klienta, także styczniowe, trafiają do Polski: w raporcie kwartału Polska ma 66 EUR, a Niemcy znikają. <b>Typ 2</b> zamyka stary wiersz datą i dodaje nowy z nowym kluczem: Niemcy 18, Polska 48. Suma w obu przypadkach to 162, różni się podział.',
      'Żeby fakt trafił do właściwej wersji, potrzebne jest <b>złączenie punkt-w-czasie</b>: klucz naturalny klienta plus warunek, że data zdarzenia mieści się w przedziale ważności wersji. Wykonuje je ładowanie i zapisuje w fakcie klucz zastępczy tej wersji.',
      'Bez warunku na daty każda wersja pasuje do każdego faktu klienta. W przykładzie suma rośnie ze 162 do 198 EUR. To ten sam mechanizm co przy podwójnym liczeniu po złym złączeniu.',
      'Kimball wymienia jako minimum trzy kolumny administracyjne typu 2: datę wejścia w życie, datę wygaśnięcia i znacznik bieżącego wiersza.'
    ],
    keywords: ['SCD', 'slowly changing dimension', 'type 1', 'type 2', 'valid_from', 'valid_to', 'point-in-time', 'surrogate key', 'dbt snapshot'],
    followUps: [
      { q: 'Why do you need a surrogate key for a Type 2 dimension?', a: "Because the natural key repeats: the same customer has one row per version. The surrogate key identifies one specific version, and that’s what the fact row stores. The natural key stays in the dimension as an attribute and is used to find the right version during the load.", pl: 'Klucz naturalny powtarza się w każdej wersji. Dopiero klucz zastępczy wskazuje jedną wersję.' },
      { q: 'How would you implement Type 2 with dbt?', a: "With snapshots. A dbt snapshot compares the source with what it captured before. It adds rows with valid-from and valid-to columns, and the current row has an empty valid-to by default. I’d build the dimension on top of that. The caveat: a snapshot only records what it sees when it runs. So it has to run on a schedule, and changes that happen between runs can’t be reconstructed from it.", pl: 'dbt snapshot dopisuje wersje z przedziałem ważności, ale widzi tylko stan z chwili uruchomienia.' },
      { q: 'The business wants revenue by the customer’s current country and by the country at the time of sale. One model or two?', a: "One. Facts point to the version valid at the time of the event, which gives the historical view. For the current view I go from that version to the current row of the same customer through the natural key. It’s the same fact table and the same dimension, exposed as two sets of attributes.", pl: 'Jeden model: wersja z chwili zdarzenia plus przejście do wiersza bieżącego po kluczu naturalnym.' },
      { q: 'When is Type 2 the wrong choice?', a: "When nobody asks historical questions about that attribute, or when it changes so often that the dimension explodes. A value that changes daily and is used in calculations is really a measure and belongs in a fact or a snapshot. And corrections of wrong data should overwrite, not create a version that was never true.", pl: 'Gdy nikt nie pyta o historię, gdy atrybut zmienia się bardzo często albo gdy zmiana jest poprawką błędu.' }
    ],
    mistakes: [
      'Mówienie, że typ 2 jest „lepszy”. To odpowiedź na inne pytanie biznesowe i ma swój koszt.',
      'Złączenie faktu z wymiarem typu 2 po kluczu naturalnym bez warunku na daty.',
      'Przedziały ważności domknięte z obu stron: zdarzenie z dnia zmiany pasuje do dwóch wersji.',
      'Ustalanie typu dla całej tabeli zamiast dla każdego atrybutu.'
    ]
  },
  {
    id: 'modeling-late-arriving-data',
    topicId: 'modeling.late-arriving',
    area: 'data-modeling',
    priority: 'P1',
    title: 'Spóźnione fakty i wymiary, korekty, backfill',
    question: {
      pl: 'Jak obsługujesz spóźnione fakty, spóźnione wymiary i poprawki historyczne w modelu wymiarowym?',
      en: 'How do you handle late-arriving facts, late-arriving dimensions and historical corrections in a dimensional model?'
    },
    answer: {
      pl: 'Rozdzielam dwa czasy: kiedy coś się wydarzyło i kiedy hurtownia się o tym dowiedziała. Spóźniony fakt dostaje klucz tej wersji wymiaru, która obowiązywała w chwili zdarzenia. Ładowanie szuka więc w historii wymiaru po dacie zdarzenia, a nie bierze wersji bieżącej. Gdy fakt przychodzi przed swoim wymiarem, nie odrzucam go. Tworzę w wymiarze wiersz zastępczy z kluczem naturalnym i nieznanymi atrybutami, a później go uzupełniam. Dzięki temu sumy są kompletne od początku. W audytowalnym rejestrze zdarzeń korekta może być osobnym wierszem z przeciwnym znakiem. Inne modele faktów mogą wymagać przeliczenia. Całe ładowanie musi być idempotentne, żeby backfill dawał ten sam wynik co praca na bieżąco.',
      en: "I separate two timelines: when something happened and when the warehouse learned about it. A late-arriving fact gets the key of the dimension version that was valid when the event happened. So the load searches the dimension history by event date instead of taking the current version. When a fact arrives before its dimension, I don’t reject it. I create a placeholder dimension row with the natural key and unknown attributes, and fill it in later. That keeps totals complete from the start. In an auditable event ledger, a correction can be a separate row with the opposite sign. Other fact models may need a restatement. The whole load has to be idempotent, so a backfill gives the same result as the regular run."
    },
    senior: {
      pl: 'Gdy rozmówca drąży, dodaję dwie rzeczy. Po pierwsze poprawka wymiaru wstecz: trzeba wstawić wersję do historii i przepisać klucze w faktach, których dotyczy. Po drugie skutki uboczne. Spóźnione dane unieważniają to, co policzono wcześniej: agregaty, okresowe migawki, a czasem raporty już wysłane do klienta. Trzeba więc ustalić z biznesem, jak długo okres jest jeszcze otwarty i jak pokazuje się korekty po jego zamknięciu. Technicznie pomaga przeliczanie przesuwnego okna ostatnich dni. Pomaga też zapis przez MERGE po kluczu biznesowym albo nadpisanie partycji.',
      en: "If they dig deeper, I add two things. First, a retroactive dimension change: it means inserting a version into the history and restating the keys on the affected facts. Second, side effects. Late data invalidates what was computed earlier: aggregates, periodic snapshots, sometimes reports already sent to a customer. So you need to agree with the business how long a period stays open, and how corrections are shown after it closes. On the technical side, it helps to reprocess a sliding window of recent days. It also helps to write with MERGE on the business key, or to overwrite a partition."
    },
    explain: [
      'Dopóki dane przychodzą na czas i w kolejności, ładowanie „weź bieżącą wersję klienta” daje poprawny wynik. Błąd ujawnia się dopiero przy opóźnieniu albo ponownym przeliczeniu historii.',
      '<b>Spóźniony fakt.</b> Transakcja z 8 lutego dociera 25 marca. Klient zmienił kraj 10 lutego. Kimball opisuje, że ładowanie musi przeszukać wymiar i znaleźć klucze obowiązujące w chwili zdarzenia. Tu: wersję sprzed przeprowadzki.',
      '<b>Spóźniony wymiar.</b> Wpłata klienta, którego hurtownia jeszcze nie zna. Tworzy się wiersz wymiaru z kluczem naturalnym i ogólnymi wartościami „nieznane”. Gdy opis dotrze, wiersz zostaje nadpisany, a klucz w fakcie się nie zmienia.',
      '<b>Poprawka wstecz.</b> Jeśli data zmiany atrybutu typu 2 okazała się błędna, trzeba wstawić albo poprawić wiersz w historii wymiaru i przepisać klucze w dotkniętych faktach. Kimball mówi o tym wprost.',
      '<b>Idempotencja</b> znaczy, że to samo ładowanie uruchomione dwa razy zostawia ten sam stan. Bez niej każdy backfill tworzy duplikaty.'
    ],
    keywords: ['late arriving fact', 'late arriving dimension', 'backfill', 'idempotent', 'inferred member', 'restatement', 'event time', 'korekta'],
    followUps: [
      { q: 'A payment arrives for a customer that is not in the dimension yet. What exactly do you load?', a: "I insert a placeholder row in the customer dimension with the natural key from the payment and generic unknown values for the descriptive columns, and the fact stores that row’s key. The payment counts in every total straight away and shows up under Unknown when sliced by country. When the customer record arrives I overwrite the placeholder.", pl: 'Wiersz zastępczy z kluczem naturalnym i atrybutami „nieznane”. Fakt nie czeka.' },
      { q: 'How do you make a fact load idempotent?', a: "The result must not depend on how many times the load runs. With MERGE, I use a stable key for the grain, I deduplicate source rows the same way every time, and I sort out the order of late events first. Or I overwrite a whole partition from complete, reproducible input. A plain INSERT of whatever arrived is the pattern that creates duplicates on a rerun.", pl: 'MERGE po stabilnym kluczu, deduplikacja źródła i kolejność zdarzeń; albo nadpisanie partycji z kompletnych danych.' },
      { q: 'Can you rebuild a periodic snapshot for last year?', a: "Only if the history exists somewhere: an event log, a change feed, or a Type 2 dimension I can replay. If the source keeps only current state, last year’s month-end state is simply not recorded. That’s the practical reason to start snapshotting before anyone asks for the report.", pl: 'Tylko gdy istnieje historia zdarzeń albo zmian. Ze stanu bieżącego przeszłości się nie odtworzy.' },
      { q: 'A refund comes in for a payment from two months ago. Do you update the original row?', a: "In an append-only payment ledger I add a new row with a negative amount, dated when the refund happened. The transaction table stays append-only and any period still sums correctly. Whether the refund should also reduce the original month in a specific report is a reporting rule I’d agree with finance, not a reason to rewrite the fact.", pl: 'Nowy wiersz z ujemną kwotą i datą zwrotu. Pierwotnej wpłaty się nie rusza.' }
    ],
    mistakes: [
      'Ładowanie, które zawsze bierze bieżącą wersję wymiaru. Działa tylko dla danych przychodzących na czas.',
      'Odrzucanie faktów, dla których nie ma jeszcze wiersza wymiaru, albo zapisywanie ich z pustym kluczem.',
      'Poprawianie przez kasowanie i nadpisywanie wierszy transakcji zamiast przez wiersz korygujący.',
      'Backfill oparty na zwykłym INSERT, który przy powtórzeniu tworzy duplikaty.'
    ]
  },
  {
    id: 'modeling-semantic-layer',
    topicId: 'modeling.semantic-layer',
    area: 'data-modeling',
    priority: 'P0',
    title: 'Warstwa semantyczna, spójne miary i RLS',
    question: {
      pl: 'Trzy dashboardy pokazują trzy różne wartości tej samej metryki. Jak to naprawiasz i gdzie powinna żyć logika biznesowa: w hurtowni czy w warstwie BI?',
      en: 'Three dashboards show three different values for the same metric. How do you fix that, and where should business logic live: in the warehouse or in the BI layer?'
    },
    answer: {
      pl: 'Najpierw sprawdzam, czy różni się definicja, czy dane. Zwykle definicja: każdy raport ma własny filtr i własną jednostkę liczenia. Naprawiam to tak, że miarę definiuję raz, w warstwie semantycznej między hurtownią a raportami: nazwa, wzór, filtr i sposób agregacji. Jeśli zespoły naprawdę potrzebują różnych znaczeń, dostają różne miary o różnych nazwach. Logikę dzielę tak. W hurtowni jest wszystko, co ma być prawdą dla każdego odbiorcy: czyszczenie, ziarno, klucze, historia i atrybuty wymiarów. W warstwie semantycznej są miary zależne od kontekstu zapytania, na przykład odsetki, oraz reguły dostępu do wierszy. W raporcie zostaje tylko prezentacja. Kryterium jest proste: kto jeszcze z tego skorzysta i gdzie da się to przetestować.',
      en: "First I check whether the definition differs or the data does. It’s usually the definition: each report has its own filter and its own unit of counting. I fix it by defining the measure once, in a semantic layer between the warehouse and the reports, with a name, a formula, a filter and an aggregation rule. If teams really need different meanings, they get different measures with different names. I split the logic like this. The warehouse holds everything that has to be true for every consumer: cleaning, grain, keys, history and dimension attributes. The semantic layer holds measures that depend on the query context, such as ratios, and row-level access rules. The report keeps only presentation. The test is simple: who else will use this, and where can it be tested?"
    },
    senior: {
      pl: 'Dodałbym bezpieczeństwo i wydajność. W modelu z wieloma najemcami regułę dostępu nakładam na wspólny wymiar najemcy. Relacje przenoszą ją wtedy na wszystkie fakty. Pamiętam, że RLS w narzędziu BI chroni tylko ten kanał, a w Power BI dotyczy tylko użytkowników z uprawnieniem Viewer. Pre-agregacje traktuję jako optymalizację schowaną za modelem: narzędzie samo wybiera tabelę. Miary, które się nie zwijają, na przykład liczbę unikalnych klientów, liczę z danych szczegółowych.',
      en: "I’d add security and performance. In a multi-tenant model I put the access rule on the shared tenant dimension, so relationships carry it to every fact. I keep in mind that row-level security in a BI tool only protects that channel, and in Power BI it applies only to users with Viewer permission. I treat pre-aggregations as an optimisation hidden behind the model: the tool picks the table. Measures that don’t roll up, such as distinct customer counts, are computed from the detail."
    },
    explain: [
      'Poprawna hurtownia nie gwarantuje spójnych liczb. W przykładzie z lekcji z tych samych ośmiu subskrypcji wychodzi 4, 5 albo 8 „aktywnych subskrybentów”, zależnie od tego, czy liczy się okres próbny i karencję oraz czy jednostką jest subskrypcja, czy klient.',
      '<b>Warstwa semantyczna</b> to opis modelu dla narzędzi i ludzi: tabele, relacje między nimi i nazwane miary. W Power BI jest nią model semantyczny z miarami w DAX. W Looker model w LookML, z którego narzędzie generuje SQL. W dbt definicje dla MetricFlow.',
      'Miara nieaddytywna, na przykład odsetek, musi być liczona w chwili zapytania, bo jej wynik zależy od wybranego wycinka. Dlatego hurtownia dostarcza składniki, a dzielenie odbywa się w warstwie semantycznej.',
      '<b>Row-level security</b> to reguła, która dla danego użytkownika odcina wiersze przed liczeniem. Nałożona na wymiar wydawcy przechodzi relacją na fakty. Microsoft pisze, że filtr na wymiarze jest często wydajniejszy niż na fakcie.',
      'Ograniczenie: reguła w narzędziu BI nie chroni danych przed kimś, kto ma dostęp bezpośrednio do hurtowni.'
    ],
    keywords: ['semantic layer', 'warstwa semantyczna', 'metric', 'DAX', 'LookML', 'row-level security', 'RLS', 'pre-aggregation', 'Power BI', 'Looker'],
    followUps: [
      { q: 'How does a Power BI semantic model compare to Looker’s LookML model?', a: "Conceptually they do the same job: tables or views, relationships or joins with a declared cardinality, and measures defined once. The big difference is execution. Power BI in import mode holds a copy of the data in its own engine and evaluates DAX there. Looker pushes SQL to the database on a cache miss; it can reuse cached results, and persistent derived tables reside in the database. That changes how you think about freshness, cost and where to optimise.", pl: 'Ta sama rola, inne wykonanie: Power BI może trzymać kopię danych, Looker wykonuje SQL w hurtowni przy braku trafienia w cache; PDT są w bazie.' },
      { q: 'How would you implement row-level security for a multi-tenant analytics product?', a: "I’d put the tenant key on every fact, through one conformed tenant dimension. I’d keep a table that maps users to tenants and filter the dimension by the signed-in user. The relationships have to be active and filter in the required direction, so the rule reaches the facts. Missing mappings deny access. In Power BI that’s a role with a DAX filter; in Looker, an access filter driven by a user attribute. And I’d enforce isolation in the warehouse as well, because BI-level rules don’t cover direct access.", pl: 'Klucz najemcy w każdym fakcie, tabela uprawnień, filtr na wymiarze. Plus izolacja w samej hurtowni.' },
      { q: 'When would you add pre-aggregated tables, and what can go wrong?', a: "When most queries hit a coarse grain and the detail table is too slow or too expensive. The risks are staleness and wrong roll-ups. An aggregate has its own grain, so it can’t answer questions about a dimension it doesn’t contain, and distinct counts don’t add up across days. I’d let the BI tool route queries to aggregates automatically rather than expose them to users.", pl: 'Gdy większość zapytań jest gruboziarnista. Ryzyka: nieświeżość i miary, które się nie zwijają.' },
      { q: 'Why is relationship cardinality in a BI model something a data engineer should care about?', a: "Because the tool computes results based on what the model declares, not on what the data actually looks like. If a key that’s declared unique has duplicates, you get a refresh failure in Power BI or inflated measures elsewhere. Guaranteeing unique dimension keys and a stable grain is the warehouse’s job, so it’s my job.", pl: 'Narzędzie liczy według deklaracji. Unikalność kluczy i stałe ziarno musi zagwarantować hurtownia.' }
    ],
    mistakes: [
      'Odpowiedź „cała logika do hurtowni”. Miary zależne od kontekstu, na przykład odsetki, policzone z góry są błędne w innym ziarnie.',
      'Wybieranie jednej „słusznej” definicji zamiast nazwania kilku miar po imieniu.',
      'Traktowanie filtra w raporcie jako zabezpieczenia.',
      'Zakładanie, że RLS w narzędziu BI chroni dane w hurtowni albo że dotyczy każdego użytkownika.'
    ]
  },
  {
    id: 'modeling-kimball-inmon-data-vault',
    topicId: 'modeling.methodologies',
    area: 'data-modeling',
    priority: 'P2',
    title: 'Kimball, Inmon i Data Vault',
    question: {
      pl: 'Czym różnią się podejścia Kimballa, Inmona i Data Vault? Kiedy które ma sens?',
      en: 'How do the Kimball, Inmon and Data Vault approaches differ? When does each make sense?'
    },
    answer: {
      pl: 'Różnią się głównie warstwą integracji, czyli miejscem, w którym łączy się dane z wielu źródeł. Mniej różnią się tym, co widzi raport. U Kimballa dane atomowe są od razu w modelu wymiarowym, a całość spinają wspólne wymiary używane przez wiele tabel faktów. U Inmona dane trafiają najpierw do znormalizowanej hurtowni korporacyjnej. Z niej zasila się wymiarowe marty dla działów. Data Vault dzieli warstwę integracji na trzy rodzaje tabel: huby z kluczami biznesowymi, linki z relacjami i satelity z atrybutami oraz ich historią. Ułatwia to audyt i dokładanie źródeł. Raporty zwykle i tak czytają z martów wymiarowych zbudowanych nad nią. Wybierałbym według problemu. Kilka źródeł i nacisk na szybkie raporty: Kimball. Wiele zmiennych źródeł i wymagania audytowe: Data Vault jako warstwa pośrednia.',
      en: "They differ mostly in the integration layer, where data from many sources comes together. They differ less in what a report sees. With Kimball, atomic data sits directly in a dimensional model, and conformed dimensions shared across fact tables hold it together. With Inmon, data first lands in a normalised enterprise warehouse. That warehouse then feeds dimensional marts for departments. Data Vault splits the integration layer into three kinds of tables: hubs with business keys, links with relationships, and satellites with attributes and their history. That helps with auditing and with adding sources. Reports usually still read from dimensional marts built on top of it. I’d choose by the problem. A few sources and pressure to deliver reports: Kimball. Many changing sources and audit requirements: a Data Vault as the middle layer."
    },
    senior: {
      pl: 'Uczciwie dodam, że te podejścia się łączą. W projekcie dbt warstwy stagingu i pośrednie przypominają warstwę integracji, a marty są wymiarowe. Koszt Data Vault to duża liczba tabel i złączeń. Bez automatycznego generowania modeli jest ciężki w utrzymaniu. Niezależnie od szkoły pytałbym o to samo: gdzie jest jedno miejsce prawdy dla klucza biznesowego, gdzie trzymana jest historia i z czego czyta narzędzie BI.',
      en: "To be fair, these approaches combine. In a dbt project, the staging and intermediate layers resemble an integration layer, and the marts are dimensional. The cost of Data Vault is a large number of tables and joins. Without automated model generation it’s heavy to maintain. Whatever the school, I’d ask the same questions: where is the single place of truth for a business key, where is history kept, and what does the BI tool read from?"
    },
    explain: [
      'Wszystkie trzy podejścia odpowiadają na to samo pytanie: jak z wielu systemów źródłowych zrobić spójne dane do analizy. Różnią się kolejnością i kształtem warstw.',
      '<b>Kimball</b>: buduje się proces po procesie, od razu jako tabele faktów i wymiarów z danymi atomowymi. Spójność między procesami zapewniają wymiary wspólne, czyli te same wymiary używane przez wiele faktów.',
      '<b>Inmon</b>: najpierw znormalizowana hurtownia całej organizacji, w której każda informacja jest raz. Dopiero z niej powstają marty wymiarowe. Opis w lekcji pochodzi z artykułu Kimball Group, czyli od jednej ze stron sporu.',
      '<b>Data Vault</b>: trzy rodzaje tabel. <b>Hub</b> trzyma klucz biznesowy, na przykład identyfikator klienta. <b>Link</b> trzyma relację między hubami. <b>Satellite</b> trzyma atrybuty opisowe i ich historię. Glosariusz Databricks umieszcza Data Vault w warstwie pośredniej i buduje nad nim marty wymiarowe do raportowania.',
      'Na rozmowie wystarczy pokazać, że znasz cel każdego podejścia i że niezależnie od wyboru na końcu potrzebny jest model, z którego narzędzie BI policzy poprawne sumy.'
    ],
    keywords: ['Kimball', 'Inmon', 'Data Vault', 'hub', 'link', 'satellite', 'conformed dimension', 'data mart', 'EDW'],
    followUps: [
      { q: 'Would you point a BI tool directly at a Data Vault?', a: "I wouldn’t by default. A vault is shaped for integration and history: many narrow tables and a lot of joins to answer one business question. I’d build dimensional marts on top and point the BI tool at those. That also gives one place to define grain and measures.", pl: 'Domyślnie nie. Nad Data Vault buduje się marty wymiarowe i to z nich czyta BI.' },
      { q: 'What is a conformed dimension and why does Kimball rely on it?', a: "It’s a dimension defined once and reused by several fact tables, with the same column names and the same values. It’s what lets you take results from two fact tables and put them in one report, because publisher or date means the same thing in both. Without it every mart has its own version of the customer.", pl: 'Wymiar zdefiniowany raz i używany przez wiele faktów. Bez niego wyników z dwóch faktów nie da się zestawić.' },
      { q: 'Where does the medallion architecture fit into this?', a: "It’s a layering convention, not a modelling method. Bronze, silver and gold say how refined the data is, and they don’t prescribe a table design. In practice gold is often dimensional, and a Data Vault or a normalised model can sit in silver. I’d treat the mapping as an analogy and check what each layer means in the specific project.", pl: 'Medalion mówi o warstwach, nie o kształcie tabel. Gold bywa wymiarowy, ale to konwencja projektu.' }
    ],
    mistakes: [
      'Przedstawianie tych podejść jako trzech konkurencyjnych kształtów tabel dla raportu.',
      'Twierdzenie, że Data Vault zastępuje model wymiarowy w warstwie raportowej.',
      'Opowiadanie się za jedną szkołą bez odniesienia do liczby źródeł, wymagań audytowych i kompetencji zespołu.'
    ]
  }
];

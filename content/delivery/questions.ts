import type { Question } from '../types';

/**
 * Pytania: dostarczanie rozwiązań (SDLC, testy, wdrożenia) i praca z agentami AI. Fakty o narzędziach zweryfikowane
 * w dokumentacji dbt, Snowflake, GitHub, Claude Code, specyfikacji MCP i OWASP Top 10 for LLM Applications 2025
 * (linki i daty w docs/verified-facts.md, sekcja „Lekcja 07").
 *
 * Odpowiedzi opisują metodę pracy w pierwszej osobie, bo tak się na te pytania odpowiada. Nie zawierają liczb,
 * nazw firm ani incydentów: przykład trzeba podmienić na własny (patrz etap Interview lekcji).
 */
export const deliveryQuestions: Question[] = [
  {
    id: 'delivery-requirements-to-production',
    topicId: 'delivery.requirements-to-production',
    area: 'delivery',
    priority: 'P0',
    title: 'Od wymagań do produkcji',
    question: {
      pl: 'Jak dostarczyłbyś platformę danych od pierwszych wymagań do produkcji?',
      en: 'How would you deliver a data platform from initial requirements to production?'
    },
    answer: {
      pl: 'Zaczynam od wymagań, nie od narzędzi. Ustalam, kto użyje danych i do jakich decyzji, a potem wymagania niefunkcjonalne: świeżość, skalę, bezpieczeństwo, koszt. To one wyznaczają architekturę. Wymagania zamieniam w kryteria akceptacji z przykładami. Większe decyzje zapisuję jako ADR-y, żeby było wiadomo, dlaczego coś wybraliśmy. Buduję przyrostowo: najpierw jeden cienki przekrój od źródła do raportu, na docelowej ścieżce wdrożenia, z osobnymi środowiskami i CI/CD od pierwszego dnia. Każda zmiana przechodzi testy, porównanie danych i review, a na produkcję wdraża potok, nie człowiek. Przed pierwszym wdrożeniem mam plan wycofania i monitoring. Po każdym przyroście pokazuję wynik odbiorcom, bo błąd w rozumieniu wymagania chcę złapać po tygodniu, a nie po kwartale.',
      en: 'I start from requirements, not tools. I find out who will use the data and for what decisions, then the non-functional requirements: freshness, scale, security, cost. Those are what drive the architecture. I turn requirements into acceptance criteria with examples, and I record the bigger decisions as ADRs so the reasoning survives. Then I build incrementally: first one thin slice from source to report, on the real deployment path, with separate environments and CI/CD from day one. Every change goes through tests, a data comparison and review, and production is deployed by the pipeline, not by a person. Before the first release I have a rollback plan and monitoring in place. And I demo each increment to the consumers, because I want to catch a misunderstood requirement after a week, not after a quarter.'
    },
    senior: {
      pl: 'Najczęstszy powód porażki to nie technologia, tylko niejasna definicja i brak właściciela po stronie biznesu. Dlatego pierwsze, co chcę mieć, to osoba, która rozstrzyga spory o definicje, i jeden przykład z liczbami, pod którym się podpisała.',
      en: 'Projects rarely fail on technology. They fail on vague definitions and no business owner. So the first things I want are a person who settles definition disputes and one worked example with numbers that they have signed off.'
    },
    explain: [
      'Pytanie sprawdza, czy widzisz całość, a nie tylko swój kawałek. Dobrą odpowiedź układa cykl życia oprogramowania (<b>SDLC</b>): wymagania, projekt, implementacja, testy, review, wdrożenie, utrzymanie. Nie musisz wymieniać etapów po kolei, ale każdy powinien się pojawić.',
      'Wymagania dzielą się na funkcjonalne (co system liczy: reguły, definicje, zawartość raportu) i niefunkcjonalne (jak dobrze działa: świeżość, wydajność, niezawodność, bezpieczeństwo, koszt). O funkcjonalne biznes upomni się sam. Niefunkcjonalne trzeba wydobyć pytaniami, bo to od nich zależy wybór między przebudową a przyrostem, wsadem a strumieniem, jednym a wieloma środowiskami.',
      '„Cienki przekrój" oznacza jeden mały przypadek doprowadzony do końca: jedno źródło, jeden model, jeden raport, ale przez prawdziwy potok CI/CD na prawdziwe środowisko. Dzięki temu problemy z uprawnieniami, wdrożeniem i monitoringiem wychodzą w pierwszym tygodniu, kiedy są tanie.',
      'ADR (Architecture Decision Record) to krótki plik w repozytorium z kontekstem, decyzją i konsekwencjami. Zostawia odpowiedź na pytanie „dlaczego", którego nie widać w kodzie.'
    ],
    keywords: ['SDLC', 'wymagania funkcjonalne', 'wymagania niefunkcjonalne', 'kryteria akceptacji', 'ADR', 'CI/CD', 'środowiska', 'rollback', 'przyrost'],
    followUps: [
      { q: 'What non-functional requirements do you ask about first?', a: 'Freshness, because it is the most expensive one: hourly and near-real-time are different architectures. Then volume and growth, who can see what, recovery expectations, and budget. I ask what happens to the business if the data is late or wrong, because that tells me how much reliability is actually worth paying for.', pl: 'Najpierw świeżość, bo zmienia architekturę; potem skala, dostęp, odtwarzanie i budżet.' },
      { q: 'The business cannot tell you exactly what they want. What do you do?', a: 'I stop asking abstract questions and show something concrete: a small prototype or a table with real example rows and two possible definitions. People who cannot write a specification can usually tell you immediately which of two numbers is wrong. Then I write the agreed definition down as an acceptance criterion.', pl: 'Pokazuję przykład z liczbami i dwie możliwe definicje; wybór zapisuję jako kryterium akceptacji.' },
      { q: 'What goes into an ADR and when do you write one?', a: 'Context, the decision, and the consequences, including what gets harder. I write one when a decision is expensive to reverse or likely to be questioned later: incremental versus full refresh, a modelling approach, a tool choice. It lives in the repository, and when we change our mind we mark it superseded rather than deleting it.', pl: 'Kontekst, decyzja, konsekwencje; piszę, gdy decyzję trudno cofnąć albo ktoś ją kiedyś podważy.' },
      { q: 'Why CI/CD from day one instead of once the platform is stable?', a: 'Because the deployment path is part of the product. If the first slice goes to production by hand, every later change inherits that habit, and the first automated deploy happens under deadline pressure. Setting it up on a tiny scope is cheap and it forces the environment and permission questions early.', pl: 'Ścieżka wdrożenia jest częścią produktu; na małym zakresie jest tania i wymusza wczesne decyzje o środowiskach.' }
    ],
    mistakes: [
      'Zaczynanie odpowiedzi od listy narzędzi („wziąłbym Snowflake, dbt i Airflow") zamiast od odbiorcy i wymagań.',
      'Pominięcie wymagań niefunkcjonalnych, przez co architektura wygląda na wybraną z przyzwyczajenia.',
      'Opis kończący się na „wdrażamy". Brak monitoringu, planu wycofania i właściciela po wdrożeniu.',
      'Plan „najpierw cała warstwa surowa, potem cała transformacja", w którym biznes widzi pierwszy wynik po miesiącach.'
    ]
  },
  {
    id: 'delivery-testing-data-pipelines',
    topicId: 'delivery.testing-data-pipelines',
    area: 'delivery',
    priority: 'P0',
    title: 'Testowanie potoku danych',
    question: {
      pl: 'Jak testujesz potok danych? Jakie rodzaje testów stosujesz i co każdy z nich łapie?',
      en: 'How do you test a data pipeline? What kinds of tests do you use and what does each one catch?'
    },
    answer: {
      pl: 'Rozdzielam testowanie kodu od testowania danych. Testy jednostkowe sprawdzają logikę modelu na małych, przygotowanych danych wejściowych, w tym na trudnych przypadkach: duplikatach, wartościach pustych, relacji jeden do wielu. Testy jakości danych działają na zbudowanych tabelach: unikalny i niepusty klucz, dozwolone wartości, integralność referencyjna, świeżość. Trzecia rzecz to regresja: dla zmienionego modelu porównuję wynik przed zmianą i po niej, czyli liczbę wierszy, sumy miar i różnice po kluczu. To łapie błędy, które przechodzą przez pozostałe testy, na przykład fan-out ukryty pod agregacją. Modele przyrostowe sprawdzam dodatkowo na ponowne uruchomienie, spóźnione dane i zgodność z pełnym przeliczeniem. Wszystko działa w CI, a testy danych także na produkcji po każdym uruchomieniu.',
      en: 'I separate testing the code from testing the data. Unit tests check a model’s logic on small, hand-built inputs, including the awkward cases: duplicates, nulls, one-to-many relationships. Data quality tests run against the built tables: unique and not-null keys, accepted values, referential integrity, freshness. The third piece is regression: for a changed model I compare the output before and after the change, meaning row counts, sums of the measures and differences by key. That catches errors the other tests let through, like a fan-out hidden under an aggregation. For incremental models I also test reruns, late-arriving data and parity with a full rebuild. All of it runs in CI, and the data tests also run in production after every build.'
    },
    senior: {
      pl: 'Każdy test jest ślepy na coś innego. Test jednostkowy nie zna prawdziwych danych, test jakości nie zna logiki, a porównanie mówi tylko, że jest inaczej, nie że źle. Dlatego nie pytam, ile mamy testów, tylko jaki błąd przeszedłby przez wszystkie.',
      en: 'Each test is blind to something. A unit test knows nothing about real data, a quality test knows nothing about the logic, and a comparison only tells you something changed, not that it is wrong. So I don’t ask how many tests we have. I ask which mistake would get through all of them.'
    },
    explain: [
      'W projekcie danych słowo „test" oznacza kilka różnych rzeczy. Test jednostkowy podstawia modelowi ręcznie przygotowane wiersze i porównuje wynik z oczekiwanym. Sprawdza kod, zanim model zostanie zbudowany. W dbt testy jednostkowe są dostępne od wersji 1.8 i tylko dla modeli SQL.',
      'Test danych (w dbt: <code>unique</code>, <code>not_null</code>, <code>accepted_values</code>, <code>relationships</code>) to zapytanie, które szuka wierszy łamiących regułę. Przechodzi, gdy nie znajdzie żadnego. Sprawdza zbudowane dane, a nie logikę: zawyżona suma nadal jest liczbą i żadnej z tych reguł nie łamie.',
      'Dlatego potrzebny jest trzeci rodzaj kontroli: uzgodnienie before/after. Jeśli model grupuje po dniu, a join powielił wiersze przed grupowaniem, wynik ma tyle samo wierszy co wcześniej i unikalny klucz. Różnicę widać dopiero w sumie miary porównanej z wersją sprzed zmiany.',
      'Poziomy integracyjny i end-to-end sprawdzają styki: czy modele zależne nadal się budują, czy cały przepływ od źródła do raportu działa na stagingu. Są wolniejsze, więc jest ich mniej.'
    ],
    keywords: ['unit test', 'data test', 'data quality', 'regresja', 'reconciliation', 'before/after', 'incremental', 'idempotencja', 'dbt'],
    followUps: [
      { q: 'How do you test an incremental model?', a: 'In both modes: the first build and a later incremental run. I check three things. Running it twice on the same data gives the same table. A late-arriving row for an old date still lands in the result. And the incremental result matches a full rebuild on the same data. In dbt unit tests you can override is_incremental to exercise both paths.', pl: 'Dwa tryby i trzy pytania: ponowne uruchomienie, spóźnione dane, zgodność z pełnym przeliczeniem.' },
      { q: 'Your before/after comparison shows a difference. Is that a bug?', a: 'Not necessarily. A comparison says different, not wrong. I check whether the requirement expected those numbers to change. If it did, I show that only the expected rows changed and by the expected amount, and the business owner accepts it. If existing numbers were supposed to stay the same, any difference is a defect, however small.', pl: 'Porównanie mówi „inaczej", nie „źle"; rozstrzyga wymaganie, a zamierzoną różnicę akceptuje biznes.' },
      { q: 'What do you test in production?', a: 'Data quality tests after every build, source freshness, and volume or runtime anomalies. I don’t run unit tests in production, they test code on fixed inputs and belong in development and CI. After a release I also repeat the reconciliation on full data, because production always has cases CI did not see.', pl: 'Testy jakości, świeżość i anomalie; testy jednostkowe zostają w developmencie i CI.' },
      { q: 'All the dbt tests pass. How confident are you?', a: 'Confident that the keys are unique and not null, and nothing more. Generic tests check properties of the output, not the transformation. A wrong join, a wrong filter or a wrong definition can pass every one of them. For logic I rely on unit tests with the awkward cases and on comparing sums against a trusted baseline.', pl: 'Tylko co do reguł, które testy sprawdzają; logikę sprawdzają testy jednostkowe i porównanie sum.' }
    ],
    mistakes: [
      'Zdanie „mamy testy dbt, więc model jest przetestowany". Testy generyczne nie sprawdzają logiki transformacji.',
      'Porównanie wyłącznie liczby wierszy. Agregacja ukrywa powielone wiersze, a liczba się zgadza.',
      'Testowanie modelu przyrostowego tylko pełnym odświeżeniem, przez co gałąź przyrostowa nigdy nie jest sprawdzana.',
      'Traktowanie każdej różnicy before/after jako błędu albo każdej jako oczekiwanej, bez odniesienia do wymagania.'
    ]
  },
  {
    id: 'delivery-release-rollback',
    topicId: 'delivery.release-rollback',
    area: 'delivery',
    priority: 'P1',
    title: 'Wdrożenie, weryfikacja i rollback',
    question: {
      pl: 'Jak wdrażasz zmianę w potoku danych na produkcję i co robisz, gdy trzeba ją wycofać?',
      en: 'How do you release a change to a production data pipeline, and what do you do when you have to roll it back?'
    },
    answer: {
      pl: 'Zmiana przechodzi tę samą drogę co każda inna: pull request, CI z testami i porównaniem danych, review, a potem potok wdraża ją na staging i po zatwierdzeniu na produkcję. Nikt nie zmienia produkcji ręcznie. Przed wdrożeniem ustalam plan wycofania, bo w danych ma on dwie części. Kod cofam do poprzedniej wersji. Dane, które błędna wersja już zapisała, trzeba naprawić osobno: przebudować model, przeliczyć okres albo odtworzyć tabelę sprzed zmiany. Dla ryzykownych zmian buduję nową wersję obok i zamieniam ją ze starą dopiero po sprawdzeniu, więc powrót to ponowna zamiana. Po wdrożeniu sprawdzam wynik na produkcji: testy, uzgodnienie na pełnych danych, czas wykonania. Dopiero wtedy uznaję zmianę za skończoną.',
      en: 'The change takes the same path as any other: a pull request, CI with tests and a data comparison, review, and then the pipeline deploys it to staging and, after approval, to production. Nobody changes production by hand. Before the release I agree a rollback plan, because for data it has two parts. The code goes back to the previous version. The data the bad version already wrote has to be repaired separately: rebuild the model, reprocess the period, or restore the table from before the change. For risky changes I build the new version alongside and swap it in only after checking it, so going back is just swapping again. After the release I verify the result in production: tests, the reconciliation on full data, the runtime. Only then do I call the change done.'
    },
    senior: {
      pl: 'Wycofanie nie zawsze jest najlepszym ruchem. Jeśli odbiorcy już przeczytali złe dane, szybsza i czystsza bywa poprawka w przód plus komunikat, co było błędne i w jakim okresie. O tym decyduje skala szkody, a decyzję podejmuje człowiek.',
      en: 'Rolling back is not always the best move. If consumers have already read the bad data, a forward fix plus a clear message about what was wrong and for which period is often faster and cleaner. The size of the damage drives that call, and a person makes it.'
    },
    explain: [
      'W aplikacji bez stanu wycofanie to powrót do poprzedniej wersji kodu. W potoku danych kod zostawia ślad: wiersze zapisane w tabelach. Jeśli model przyrostowy przez dwa dni dopisywał błędne wartości, cofnięcie kodu ich nie usunie.',
      'Dlatego plan wycofania odpowiada na dwa pytania. Jak wrócić do poprzedniego kodu (cofnięcie zmiany w repozytorium i ponowne wdrożenie)? Jak naprawić dane (pełne odświeżenie, ponowne przeliczenie zakresu dat, odtworzenie tabeli)? W Snowflake pomaga Time Travel, który pozwala odczytać albo sklonować tabelę sprzed zmiany w okresie retencji.',
      'Wdrożenie blue-green oznacza zbudowanie nowej wersji obok starej i przełączenie odbiorców dopiero po kontroli. W Snowflake <code>ALTER TABLE … SWAP WITH</code> zamienia nazwy dwóch tabel w jednej transakcji, więc przełączenie i powrót są natychmiastowe.',
      'Środowiska z wymaganym zatwierdzeniem, na przykład w GitHub Actions, wstrzymują zadanie wdrożenia do czasu akceptacji przez uprawnioną osobę. To techniczna postać punktu kontrolnego przed produkcją.'
    ],
    keywords: ['CI/CD', 'staging', 'rollback', 'blue-green', 'SWAP WITH', 'Time Travel', 'backfill', 'weryfikacja po wdrożeniu', 'forward fix'],
    followUps: [
      { q: 'Why is rolling back a data change harder than rolling back an application?', a: 'Because the application is usually stateless and the pipeline is not. Reverting the code doesn’t remove the rows the bad version wrote, and downstream models or reports may have consumed them already. So you need a data repair step, and sometimes a message to consumers, not just a redeploy.', pl: 'Potok ma stan: cofnięcie kodu nie usuwa zapisanych wierszy ani tego, co odczytali odbiorcy.' },
      { q: 'How do you verify a release beyond a green pipeline?', a: 'A green pipeline means the jobs finished. I check the output: data tests on production, the same before-and-after comparison on full data, row counts and runtime against the previous run, and that the consumer, a dashboard or an export, shows what was expected. I stay around for the first scheduled run.', pl: 'Zielony potok to zakończone zadania; sprawdzam wynik, czas wykonania i odbiorcę.' },
      { q: 'What is the role of a staging environment for data?', a: 'To run the same code version on data shaped like production before consumers see it. It only helps if it is close to production in versions, configuration and data shape. A staging environment with ten rows will not show a performance problem or a rare data case. In Snowflake a zero-copy clone is a cheap way to get realistic data, with masking for personal data.', pl: 'Ta sama wersja kodu na danych podobnych do produkcji; pusty staging niczego nie pokaże.' },
      { q: 'When would you fix forward instead of rolling back?', a: 'When the fix is small and well understood, when the rollback itself is risky, for example a schema change others already depend on, or when the bad data has been consumed and has to be corrected anyway. I still stop the bleeding first, usually by pausing the job, and I tell consumers which period is affected.', pl: 'Gdy poprawka jest mała, wycofanie ryzykowne albo dane i tak trzeba skorygować; najpierw zatrzymuję szkodę.' }
    ],
    mistakes: [
      'Utożsamianie wycofania z cofnięciem commita, bez słowa o danych już zapisanych przez błędną wersję.',
      'Wymyślanie planu wycofania w trakcie incydentu zamiast przed wdrożeniem.',
      'Uznanie wdrożenia za zakończone, gdy potok jest zielony, bez sprawdzenia wyniku na produkcji.',
      'Ręczne poprawki na produkcji „bo szybciej", które rozjeżdżają produkcję z repozytorium.'
    ]
  },
  {
    id: 'delivery-ai-daily-work',
    topicId: 'delivery.ai-daily-work',
    area: 'delivery',
    priority: 'P0',
    title: 'AI w codziennej pracy inżyniera',
    question: {
      pl: 'Jak używasz AI w codziennej pracy inżynierskiej?',
      en: 'How do you use AI in your daily engineering work?'
    },
    answer: {
      pl: 'Traktuję agenta AI jak szybkiego wykonawcę, a nie jak osobę, która podejmuje decyzje. Zaczynam od wymagań: sam ustalam kryteria akceptacji i ograniczenia. Potem agent robi rozpoznanie w repozytorium i proponuje plan, który czytam, zanim powstanie kod. Implementację i testy oddaję agentowi, w granicach zapisanych w instrukcjach repozytorium. Dalej jest weryfikacja: testy automatyczne i porównanie danych przed zmianą i po niej. Wynik czytam linia po linii, tak jak kod od kolegi, i dopiero wtedy otwieram pull request, który przechodzi zwykłe review. Agent nie ma dostępu do produkcji i niczego nie wdraża. Zysk jest w rozpoznaniu, pisaniu i testach. Definicje biznesowe, architektura i akceptacja zostają u mnie, bo to ja odpowiadam za wynik.',
      en: 'I treat an AI agent as a fast implementer, not as a decision-maker. I start with the requirements: I settle the acceptance criteria and the constraints myself. Then the agent investigates the repository and proposes a plan, which I read before any code is written. Implementation and tests I hand to the agent, within the boundaries written in the repository instructions. Then comes verification: automated tests and a before-and-after comparison of the data. I read the result line by line, the way I would read a colleague’s code, and only then open a pull request, which goes through normal review. The agent has no production access and deploys nothing. The gain is in investigation, writing and testing. Business definitions, architecture and sign-off stay with me, because I am the one accountable for the result.'
    },
    senior: {
      pl: 'Największa zmiana to nie szybkość pisania, tylko przesunięcie mojej pracy: mniej pisania, więcej specyfikowania i weryfikowania. Wąskim gardłem staje się review, więc dbam o małe zmiany i o dowody, które da się sprawdzić bez czytania wszystkiego od zera.',
      en: 'The biggest change is not typing speed, it is where my effort goes: less writing, more specifying and verifying. Review becomes the bottleneck, so I keep changes small and attach evidence a reviewer can check without rereading everything from scratch.'
    },
    explain: [
      'Agent AI to model językowy, który sam wykonuje kroki: czyta pliki, uruchamia polecenia, sprawdza wynik i poprawia. Różni się od podpowiadania kodu tym, że dostaje zadanie, a nie linię do dokończenia. Praca z nim przypomina delegowanie.',
      'Pytanie sprawdza, czy masz metodę, czy tylko narzędzie. Metoda ma stałą kolejność: wymagania, rozpoznanie, plan, implementacja, testy, porównanie danych, review, akceptacja, pull request, wdrożenie. W kilku miejscach decyduje człowiek: definicja wymagania, zatwierdzenie planu, ocena różnic w danych, akceptacja zmiany, wdrożenie.',
      'Plan przed kodem jest najtańszym punktem kontrolnym. Złe założenie w planie widać w jednym zdaniu. To samo założenie w gotowej zmianie trzeba dopiero znaleźć.',
      'Na rozmowie metoda brzmi wiarygodnie dopiero z własnym przykładem: jedno zadanie, to, co dałeś agentowi, to, co sprawdziłeś, i miejsce, w którym coś poprawiłeś. Nie podawaj procentów przyspieszenia, jeśli ich nie zmierzyłeś.'
    ],
    keywords: ['agent AI', 'plan', 'human in the loop', 'kryteria akceptacji', 'review', 'before/after', 'accountability', 'Claude Code'],
    followUps: [
      { q: 'Where does AI not help, or even get in the way?', a: 'Where the hard part is deciding, not writing: an ambiguous business definition, an architecture trade-off, a production incident with incomplete information. It also struggles when the knowledge is not written down, like why a model has an odd grain. There it produces confident, plausible answers, which is worse than no answer.', pl: 'Tam, gdzie trudna jest decyzja albo wiedza nie jest zapisana; wtedy dostajesz pewną siebie, wiarygodnie brzmiącą pomyłkę.' },
      { q: 'How do you decide what to delegate to the agent?', a: 'By how easily I can verify the result. Well-specified, checkable work goes to the agent: a model change with acceptance criteria, tests, a refactor with a before-and-after comparison. If I can’t say how I would check the output, I’m not ready to delegate it, to an agent or to a person.', pl: 'Według tego, jak łatwo sprawdzić wynik; jeśli nie umiem powiedzieć, jak to sprawdzę, nie deleguję.' },
      { q: 'Does AI actually make you faster?', a: 'On implementation, clearly. End to end, less than people expect, because verification and review don’t shrink the same way. The honest gain is that I spend more of my time on requirements and checking, and less on typing. I would not quote a percentage unless I had measured it.', pl: 'W implementacji tak; od początku do końca mniej, bo weryfikacja i review nie kurczą się tak samo.' },
      { q: 'How do you keep your own skills sharp when the agent writes the code?', a: 'I read everything it writes and I don’t approve what I can’t explain. If the agent uses something I don’t know, I look it up before accepting it. Reviewing carefully is still engineering work, and it is where I catch the cases the agent got subtly wrong.', pl: 'Czytam wszystko i nie zatwierdzam tego, czego nie umiem wyjaśnić.' }
    ],
    mistakes: [
      'Odpowiedź marketingowa: „AI zwiększa moją produktywność", bez opisu procesu i weryfikacji.',
      'Lista narzędzi zamiast metody. Rekruter pyta o osąd inżynierski, nie o to, co masz zainstalowane.',
      'Podawanie wymyślonych procentów przyspieszenia.',
      'Pominięcie tego, czego AI nie robi: decyzji architektonicznych, definicji biznesowych, akceptacji.'
    ]
  },
  {
    id: 'delivery-agent-boundaries',
    topicId: 'delivery.agent-boundaries',
    area: 'delivery',
    priority: 'P0',
    title: 'Granice architektury dla agenta',
    question: {
      pl: 'Jak definiujesz granice architektury dla agentów piszących kod?',
      en: 'How do you define architecture boundaries for coding agents?'
    },
    answer: {
      pl: 'Na trzech poziomach. Pierwszy to instrukcje w repozytorium: plik, który agent wczytuje na starcie, z regułami architektury. Zapisuję tam warstwy i dozwolone zależności, zakaz zmiany ziarna istniejących modeli, nakaz sprawdzenia, czy coś już istnieje, oraz definicję „gotowe", czyli jakie testy i jakie porównanie danych ma pokazać. Drugi poziom to zadanie: kryteria akceptacji, zakres plików i wprost to, czego nie wolno ruszać. Trzeci to wymuszanie, bo instrukcja jest tylko kontekstem i model może ją pominąć. To, co ma być niemożliwe, blokuję technicznie: uprawnienia narzędzi, brak poświadczeń do produkcji, ochrona gałęzi, kontrole w CI. Decyzje architektoniczne podejmuję sam i zapisuję jako ADR-y, które agent czyta jak resztę repozytorium.',
      en: 'On three levels. The first is repository instructions: a file the agent loads at the start, with the architecture rules. I write down the layers and the allowed dependencies, that the grain of an existing model must not change, that it should check whether something already exists before adding it, and the definition of done, meaning which tests and which data comparison it has to show. The second level is the task: acceptance criteria, the files in scope, and explicitly what must not be touched. The third is enforcement, because an instruction is only context and the model can ignore it. Anything that must be impossible I block technically: tool permissions, no production credentials, branch protection, checks in CI. Architecture decisions I make myself and record as ADRs, which the agent reads like the rest of the repository.'
    },
    senior: {
      pl: 'Granica, której nie da się sprawdzić automatycznie, jest tylko prośbą. Dlatego najważniejsze reguły zamieniam w kontrole: test zależności między warstwami, kontrakt modelu, obowiązkowe porównanie sum. Wtedy obowiązują tak samo człowieka i agenta.',
      en: 'A boundary you can’t check automatically is only a request. So I turn the important rules into checks: a test for dependencies between layers, a model contract, a mandatory comparison of sums. Then they apply equally to a human and to an agent.'
    },
    explain: [
      'Agent nie zna architektury projektu. Bez instrukcji wybierze rozwiązanie najczęstsze w danych, na których model się uczył: sięgnie w marcie do surowej tabeli, dopisze makro, które już istnieje, zmieni ziarno, bo tak jest prościej.',
      'Plik instrukcji w repozytorium (w Claude Code nazywa się <code>CLAUDE.md</code>) jest wczytywany na początku sesji. Dokumentacja mówi wprost, że taki plik jest traktowany jako kontekst, a nie wymuszana konfiguracja. Zwiększa szansę na dobre zachowanie, ale niczego nie gwarantuje.',
      'Stąd trzeci poziom. W Claude Code reguły uprawnień mają listy allow, ask i deny, przy czym deny wygrywa. Hook uruchamiany przed wywołaniem narzędzia może je zablokować. Poza narzędziem działają zwykłe zabezpieczenia zespołu: ochrona gałęzi, wymagane review, CI.',
      'Dobra reguła jest konkretna i sprawdzalna. „Pisz czysty kod" nic nie zmienia. „Mart nie czyta źródeł bezpośrednio" da się sprawdzić w review i testem.'
    ],
    keywords: ['CLAUDE.md', 'instrukcje repozytorium', 'kontekst', 'uprawnienia', 'least privilege', 'ADR', 'ziarno', 'branch protection', 'definition of done'],
    followUps: [
      { q: 'What do you put in the repository instruction file and what do you leave out?', a: 'In: things the agent can’t infer and that hurt when broken. Layering rules, grain, naming that carries meaning, how to run tests, what evidence a change needs, and where to stop and ask. Out: formatting, which a linter handles, and anything vague. I keep it short, because a long file gets diluted, and I change it through pull requests like code.', pl: 'To, czego agent nie odgadnie i co boli po złamaniu; styl zostawiam linterowi, plik jest krótki.' },
      { q: 'The agent ignored a rule from the instructions. What do you do?', a: 'First I fix the output. Then I ask why it happened: was the rule vague, buried in a long file, or contradicted by existing code the agent imitated? I sharpen the rule, and if it matters enough I turn it into a check in CI or a permission. Repeating the rule louder is not a fix.', pl: 'Poprawiam wynik, potem przyczynę: doprecyzowuję regułę albo zamieniam ją w kontrolę.' },
      { q: 'How do you keep an agent from changing more than the task needs?', a: 'A narrow task with explicit scope, a plan I approve before implementation, and small pull requests. In review I look at the diff for anything outside the ticket. Unrequested refactors get reverted or moved to their own change, exactly as I would ask of a colleague.', pl: 'Wąskie zadanie, zatwierdzony plan, małe pull requesty; zmiany spoza zgłoszenia cofam.' },
      { q: 'How do you manage context on a large task?', a: 'I split it into steps that can be verified on their own, and I give each step what it needs: acceptance criteria, the relevant files, decisions made so far. What is not in the context does not exist for the agent, so decisions from a meeting have to be written down. Long sessions drift, so I restart with a written summary.', pl: 'Dzielę na sprawdzalne kroki; czego nie ma w kontekście, tego agent nie wie.' }
    ],
    mistakes: [
      'Przekonanie, że zapis w pliku instrukcji jest zabezpieczeniem. To kontekst, model może go pominąć.',
      'Długi plik pełen ogólników, których nie da się sprawdzić.',
      'Oddanie agentowi decyzji architektonicznej („niech zaproponuje, jak to zbudować") bez własnej oceny wariantów.',
      'Brak definicji „gotowe", przez co agent kończy, gdy kod się kompiluje.'
    ]
  },
  {
    id: 'delivery-validate-ai-code',
    topicId: 'delivery.validating-ai-code',
    area: 'delivery',
    priority: 'P0',
    title: 'Walidacja kodu wygenerowanego przez AI',
    question: {
      pl: 'Jak walidujesz kod wygenerowany przez AI?',
      en: 'How do you validate AI-generated code?'
    },
    answer: {
      pl: 'Zakładam, że kod wygląda poprawnie, więc sprawdzam to, czego wygląd nie pokazuje. W SQL-u zaczynam od ziarna: co oznacza jeden wiersz każdej tabeli w joinie i czy join go nie zmienia. To łapie fan-out, czyli powielone wiersze i zawyżone sumy. Potem porównuję filtry i definicje miar z kryteriami akceptacji, bo wiarygodnie wyglądający warunek często jest inną regułą biznesową. Sprawdzam też, czy funkcje i parametry istnieją na tej platformie, bo modele potrafią je zmyślić. Do tego dowody: testy jednostkowe z trudnymi przypadkami, testy danych i porównanie wyniku przed zmianą i po niej na poziomie sum oraz kluczy. Jeśli istniejące liczby miały się nie zmienić, każda różnica wymaga wyjaśnienia. Na końcu czytam całą zmianę i nie zatwierdzam niczego, czego nie umiem wyjaśnić.',
      en: 'I assume the code looks correct, so I check what looks can’t show. In SQL I start with grain: what one row means in each table of a join, and whether the join changes it. That catches fan-out, meaning duplicated rows and inflated sums. Then I compare the filters and measure definitions against the acceptance criteria, because a plausible-looking condition is often a different business rule. I also check that the functions and parameters exist on this platform, because models do invent them. Then evidence: unit tests with the awkward cases, data tests, and a before-and-after comparison of the output at the level of sums and keys. If existing numbers were supposed to stay the same, every difference needs an explanation. Finally I read the whole change, and I don’t approve anything I can’t explain.'
    },
    senior: {
      pl: 'Najgroźniejsze są błędy, które przechodzą testy. Wymyślona funkcja wypadnie przy kompilacji, a zły filtr albo fan-out pod agregacją dadzą zielone CI. Dlatego nie ufam zielonemu CI bardziej przy kodzie od AI, tylko mniej: testy też mógł napisać agent.',
      en: 'The dangerous errors are the ones that pass the tests. An invented function fails at compile time, but a wrong filter or a fan-out under an aggregation gives you a green CI. So with AI-generated code I trust a green CI less, not more: the agent may have written the tests too.'
    },
    explain: [
      'Kod od modelu językowego ma szczególną cechę: jest płynny. Ma dobre nazwy, wcięcia i komentarze, więc wygląda jak kod doświadczonej osoby. Czytelnik odruchowo ufa temu, co wygląda zawodowo. Dlatego review zaczyna się od pytań, a nie od czytania składni.',
      '<b>Ziarno</b> tabeli to odpowiedź na pytanie, co oznacza jeden wiersz. Jeśli tabela zamówień ma jeden wiersz na zamówienie, a tabela kodów jeden wiersz na użyty kod, to join powieli zamówienia z dwoma kodami. <code>SUM(amount)</code> policzy ich kwotę dwa razy. Gdy model grupuje po dniu, liczba wierszy wyniku się nie zmieni i testy klucza przejdą.',
      'Drugi rodzaj błędu to inna reguła biznesowa: warunek <code>status &lt;&gt; \'cancelled\'</code> zamiast „tylko opłacone". Oba są poprawnym SQL-em. Który jest właściwy, wynika z wymagania, a nie z kodu.',
      'Trzeci to halucynacje: funkcja z innej hurtowni albo parametr, którego biblioteka nie ma. Na przykład <code>SAFE_DIVIDE</code> istnieje w BigQuery, a w Snowflake odpowiednikiem jest <code>DIV0</code>. Te błędy są tanie, bo wypadają przy uruchomieniu, ale sygnalizują, że resztę też trzeba czytać uważnie.'
    ],
    keywords: ['fan-out', 'ziarno', 'reguła biznesowa', 'halucynacja', 'before/after', 'reconciliation', 'unit test', 'review', 'SAFE_DIVIDE', 'DIV0'],
    followUps: [
      { q: 'Give an example of AI-generated SQL that looks right but is wrong.', a: 'A daily revenue model joined to a table with several rows per order, then grouped by day. The row count is unchanged, the key is unique, the order count is right because it uses count distinct, and revenue is inflated because the sum runs over duplicated rows. Only a comparison of the sum against the previous version shows it.', pl: 'Join do tabeli o drobniejszym ziarnie pod agregacją: wiersze i klucz się zgadzają, suma jest zawyżona.' },
      { q: 'How do you catch a hallucinated function or API?', a: 'Running the code catches most of them, which is one reason the agent should execute what it writes rather than only generate it. For anything unfamiliar I check the official documentation for the platform and version we use. If the agent cites an option I have never seen, I verify it before I trust anything built on top of it.', pl: 'Uruchomienie łapie większość; nieznane rzeczy sprawdzam w dokumentacji naszej platformy i wersji.' },
      { q: 'The agent wrote both the code and the tests. Is that a problem?', a: 'It can be, because the tests may encode the same wrong assumption as the code. So I review the tests first: do they contain the case that separates a correct implementation from a wrong one? And I rely on a check the agent did not design, the before-and-after comparison against production output.', pl: 'Testy mogą powtarzać to samo błędne założenie; czytam je pierwsze i mam niezależne porównanie z produkcją.' },
      { q: 'How is reviewing AI code different from reviewing a colleague’s code?', a: 'The standard is the same, the failure modes differ. A colleague usually knows the business context and makes typos. An agent writes clean code and misses context. So I spend less time on style and more on grain, business rules, scope creep and whether things actually exist. And there is no author to ask why, so the pull request has to carry the reasoning.', pl: 'Ten sam standard, inne błędy: mniej stylu, więcej ziarna, reguł, zakresu i halucynacji.' }
    ],
    mistakes: [
      'Odpowiedź „uruchamiam testy". Testy sprawdzają to, co ktoś kazał im sprawdzić, i mógł je napisać ten sam agent.',
      'Sprawdzanie tylko liczby wierszy po zmianie.',
      'Zatwierdzanie kodu, którego się nie rozumie, bo „wygląda dobrze i działa".',
      'Brak odniesienia do wymagania: poprawność reguły biznesowej nie wynika z samego kodu.'
    ]
  },
  {
    id: 'delivery-ai-tech-debt',
    topicId: 'delivery.ai-technical-debt',
    area: 'delivery',
    priority: 'P1',
    title: 'AI a dług techniczny',
    question: {
      pl: 'Jak zapobiegasz temu, żeby AI wprowadzało dług techniczny?',
      en: 'How do you prevent AI from introducing technical debt?'
    },
    answer: {
      pl: 'Agent pisze kod szybciej, niż zespół jest w stanie go przeczytać, więc dług powstaje głównie z nadmiaru: duplikatów istniejącej logiki, zbędnych abstrakcji i zmian większych niż zadanie. Bronię się na kilka sposobów. Zadania są małe i mają jasny zakres, więc pull request da się naprawdę przeczytać. W instrukcjach repozytorium jest nakaz sprawdzenia, czy model albo makro już istnieje, oraz zakaz dodawania zależności bez pytania. Kod od agenta spełnia tę samą definicję „gotowe" co każdy inny: testy, opis, ziarno, porównanie danych. W review odrzucam to, czego nie rozumiem, i wszystko spoza zakresu zgłoszenia. Świadome skróty zapisuję razem z terminem spłaty. Największym ryzykiem nie jest zły kod, tylko kod, którego nikt w zespole nie rozumie.',
      en: 'An agent writes code faster than a team can read it, so the debt mostly comes from excess: duplicates of existing logic, unnecessary abstractions, and changes bigger than the task. I defend against that in a few ways. Tasks are small and clearly scoped, so the pull request can actually be read. The repository instructions say to check whether a model or macro already exists, and not to add dependencies without asking. Agent-written code meets the same definition of done as any other: tests, description, grain, a data comparison. In review I reject what I don’t understand and anything outside the ticket. Deliberate shortcuts get written down with a date to pay them back. The biggest risk is not bad code, it is code that nobody on the team understands.'
    },
    senior: {
      pl: 'Agent potrafi też dług spłacać: dopisać brakujące testy, opisy modeli, ujednolicić powtórzoną regułę. Warunek jest ten sam co zawsze: refaktoryzacja ma dowód, że wynik się nie zmienił, czyli porównanie before/after.',
      en: 'An agent can also pay debt down: add missing tests and model descriptions, consolidate a rule that was copied around. The condition is the same as always: a refactor comes with proof that the output did not change, which is a before-and-after comparison.'
    },
    explain: [
      '<b>Dług techniczny</b> to koszt przyszłych zmian, który zaciągasz dzisiejszym skrótem. Świadomy skrót z planem spłaty jest normalnym narzędziem. Problemem jest dług nieświadomy: nikt nie wie, że istnieje, dopóki zmiana, która miała zająć dzień, nie zajmie tygodnia.',
      'W projekcie danych dług ma typowe postacie: ta sama reguła biznesowa w kilku modelach, modele bez testów i bez opisanego ziarna, jednorazowe skrypty w harmonogramie, martwe modele.',
      'Agent zmienia ekonomię. Napisanie nowego modelu jest prawie darmowe, więc łatwiej dopisać nowy, niż znaleźć i rozszerzyć istniejący. Agent nie zna też powodów wcześniejszych decyzji, jeśli nie są zapisane, więc może „uprościć" coś, co było celowe. Stąd waga zapisów decyzji architektonicznych i opisów modeli.',
      'Koszt, który nie maleje, to zrozumienie. Każdą linię, która trafia do repozytorium, ktoś będzie kiedyś czytał podczas incydentu. Dlatego miarą nie jest liczba dostarczonych linii, tylko to, czy zespół umie wyjaśnić i zmienić to, co ma.'
    ],
    keywords: ['dług techniczny', 'maintainability', 'duplikacja', 'małe pull requesty', 'definition of done', 'review', 'refaktoryzacja', 'ADR'],
    followUps: [
      { q: 'What does AI-specific technical debt look like in a dbt project?', a: 'A new model that recomputes something an existing model already provides. The same business rule pasted into three places with small differences. A macro added for a one-off case. Tests that assert whatever the code currently returns. And big changes nobody fully read. Each one works today and makes the next change slower.', pl: 'Duplikaty modeli i reguł, jednorazowe makra, testy zapisujące bieżący wynik, zmiany, których nikt nie przeczytał.' },
      { q: 'How do you keep pull requests reviewable when the agent can produce a lot of code?', a: 'I control the size at the task level: one ticket, one concern, and a plan agreed before implementation. If the agent produces a large diff, I split it rather than ask a reviewer to skim it. A change that is too big to review is too big to approve, regardless of who wrote it.', pl: 'Pilnuję rozmiaru na poziomie zadania; za duży diff dzielę, a nie proszę o przejrzenie.' },
      { q: 'Would you let an agent refactor legacy code?', a: 'Yes, with a safety net. First establish what the current output is and pin it with a comparison or characterization tests. Then refactor in small steps, each showing the output is unchanged. Without that baseline a refactor is just a rewrite with unknown behaviour, and that is true for people as well.', pl: 'Tak, ale najpierw punkt odniesienia; każdy krok pokazuje, że wynik się nie zmienił.' },
      { q: 'How do you know whether debt is growing?', a: 'I watch for symptoms rather than a single number: similar changes taking longer, the same bug class recurring, models nobody can explain, rising build time. In review I ask whether the change made the next change easier or harder. I would be careful quoting a metric here, most of them are easy to game.', pl: 'Po objawach: zmiany trwają dłużej, błędy wracają, nikt nie umie wyjaśnić modelu.' }
    ],
    mistakes: [
      'Twierdzenie, że AI nie tworzy długu, jeśli „dobrze się je promptuje".',
      'Mierzenie wartości liczbą wygenerowanych linii albo zamkniętych zgłoszeń.',
      'Akceptowanie dużych zmian bez pełnego przeczytania, bo CI jest zielone.',
      'Pominięcie zrozumienia przez zespół jako kosztu utrzymania.'
    ]
  },
  {
    id: 'delivery-ai-regulated',
    topicId: 'delivery.ai-regulated-environments',
    area: 'delivery',
    priority: 'P0',
    title: 'AI w środowiskach regulowanych',
    question: {
      pl: 'Jak bezpiecznie używać AI w regulowanych środowiskach klientów?',
      en: 'How do you safely use AI in regulated client environments?'
    },
    answer: {
      pl: 'Zaczynam od ustalenia, co wolno: które narzędzia zatwierdził klient, dokąd trafiają dane i jakie klasy danych mogą opuścić jego środowisko. Jeśli tego nie wiem, pytam, a nie zakładam. Potem stosuję minimalizację: agent pracuje na kodzie, schematach i danych syntetycznych albo zamaskowanych, a nie na danych osobowych. Uprawnienia są minimalne. Agent nie ma poświadczeń do produkcji ani dostępu do sekretów, a działania widoczne na zewnątrz wymagają mojej zgody. Zakładam też, że treść czytana przez agenta, na przykład zgłoszenie albo strona, może zawierać złośliwe instrukcje, więc ograniczam to, co agent może zrobić, a nie liczę na jego czujność. Każda zmiana przechodzi zwykły proces z review i zatwierdzeniem, więc zostaje ślad, kto co zaakceptował.',
      en: 'I start by finding out what is allowed: which tools the client has approved, where the data goes, and which classes of data may leave their environment. If I don’t know, I ask rather than assume. Then I apply minimisation: the agent works with code, schemas and synthetic or masked data, not with personal data. Permissions are minimal. The agent has no production credentials and no access to secrets, and anything visible to others needs my approval. I also assume that content the agent reads, such as a ticket or a web page, may contain malicious instructions, so I limit what the agent is able to do rather than rely on it noticing. Every change goes through the normal process with review and approval, so there is a record of who accepted what.'
    },
    senior: {
      pl: 'W środowisku regulowanym pytanie audytora brzmi: kto zatwierdził tę zmianę i na jakiej podstawie. Proces z punktami kontrolnymi człowieka odpowiada na nie przy okazji. Użycie AI nie zmienia odpowiedzialności, zmienia tylko to, jak starannie trzeba pilnować przepływu danych.',
      en: 'In a regulated environment the auditor’s question is: who approved this change and on what basis. A process with human checkpoints answers that as a by-product. Using AI does not change who is accountable. It changes how carefully you have to control where data flows.'
    },
    explain: [
      'Ryzyka są trzy i warto je rozdzielić. Pierwsze to <b>wyciek danych</b>: wszystko, co trafia do promptu, opuszcza miejsce, w którym miało być. Dotyczy to wklejonych wierszy, wyników zapytań i plików z sekretami, które agent przeczytał.',
      'Drugie to <b>nadmierna sprawczość</b>: agent z szerokimi uprawnieniami może zrobić szkodę przez pomyłkę. OWASP wymienia trzy źródła tego ryzyka: za dużo funkcji, za szerokie uprawnienia i za dużo autonomii. Odpowiedzią jest zasada najmniejszych uprawnień i zgoda człowieka na działania o dużym skutku.',
      'Trzecie to <b>prompt injection</b>: instrukcja ukryta w treści, którą agent czyta jako dane. W wersji pośredniej atakujący nie rozmawia z agentem, tylko umieszcza tekst w zgłoszeniu, pliku albo na stronie. Model nie odróżnia niezawodnie danych od poleceń, więc obrona polega na ograniczeniu tego, co atak może osiągnąć.',
      'Agent łączy się z zewnętrznymi systemami zwykle przez MCP (Model Context Protocol), w którym serwer udostępnia mu narzędzia i dane. Każdy podłączony serwer to nowe uprawnienie i nowe źródło treści, której nie kontrolujesz. Specyfikacja zaleca, żeby człowiek zawsze mógł odmówić wywołania narzędzia.'
    ],
    keywords: ['PII', 'poufność', 'least privilege', 'prompt injection', 'MCP', 'maskowanie', 'audyt', 'OWASP', 'human approval'],
    followUps: [
      { q: 'What is prompt injection and why does it matter for tool-connected agents?', a: 'It is text that makes the model follow instructions the user never gave. With a tool-connected agent the indirect form matters most: the instruction sits in content the agent reads, like a ticket, a document or a web page. A chatbot would just say something wrong. An agent with tools can act on it, so the impact depends on its permissions.', pl: 'Instrukcja w treści czytanej przez agenta; przy narzędziach skutek zależy od uprawnień.' },
      { q: 'How do you debug a production data issue with an agent without exposing data?', a: 'I separate the diagnosis from the access. I run the diagnostic queries myself, under my own permissions, and share aggregates or the shape of the problem. To reproduce a logic bug I build a few synthetic rows with the same issue. The agent needs to understand the pattern, not to see the customers.', pl: 'Zapytania uruchamiam sam i przekazuję agregaty albo syntetyczne wiersze z tym samym błędem.' },
      { q: 'What does least privilege mean for an MCP integration?', a: 'Each server gets only what the task needs: read-only where reading is enough, a development database rather than production, a service account with a narrow role. Write actions that other people will see need approval. And I only connect servers I trust, because their tool descriptions and returned content end up in the agent’s context.', pl: 'Tylko odczyt, dev zamiast produkcji, wąska rola; działania zapisujące po zgodzie, serwery zaufane.' },
      { q: 'The client bans AI tools entirely. What do you do?', a: 'I follow the rule. It is their data and their risk decision. I would not work around it with a personal tool. If I think the rule costs them more than it protects, I say so through the right channel, with a concrete proposal: which tool, which data classes, which controls. Until that is agreed, the answer is no.', pl: 'Stosuję się; nie obchodzę zakazu prywatnym narzędziem, mogę zaproponować zmianę właściwą drogą.' }
    ],
    mistakes: [
      'Zapewnienie „nasze narzędzie jest bezpieczne" bez wiedzy, dokąd trafiają dane i co mówi umowa.',
      'Poleganie na instrukcji „nie ujawniaj danych" zamiast na braku dostępu.',
      'Wklejanie prawdziwych danych „tylko na chwilę" do debugowania.',
      'Pominięcie prompt injection przy agentach podłączonych do zgłoszeń, dokumentów albo stron.'
    ]
  },
  {
    id: 'delivery-ai-accountability',
    topicId: 'delivery.ai-accountability',
    area: 'delivery',
    priority: 'P0',
    title: 'Odpowiedzialność za kod od AI',
    question: {
      pl: 'Kto odpowiada, gdy kod wygenerowany przez AI spowoduje incydent na produkcji?',
      en: 'Who is accountable when AI-generated code causes a production incident?'
    },
    answer: {
      pl: 'Inżynier, który zmianę zgłosił, i osoba, która ją zatwierdziła. Dokładnie tak samo jak przy kodzie napisanym ręcznie. Narzędzie nie ponosi odpowiedzialności, a „agent tak napisał" nie jest wyjaśnieniem. Jeśli otwieram pull request, to znaczy, że rozumiem zmianę i ją sprawdziłem. Po incydencie postępuję jak zawsze: najpierw zatrzymuję szkodę i naprawiam dane, potem informuję odbiorców, co było błędne i w jakim okresie. Analizę robię bez szukania winnych, ale z konkretnym pytaniem: która bramka powinna była to zatrzymać i dlaczego nie zatrzymała. Wynikiem ma być zmiana w procesie, na przykład obowiązkowe porównanie sum dla zmienionych modeli albo brakujący przypadek testowy. Zakaz używania AI rzadko jest właściwym wnioskiem, bo ten sam błąd mógł popełnić człowiek.',
      en: 'The engineer who submitted the change and the person who approved it. Exactly as with hand-written code. A tool can’t be accountable, and “the agent wrote it” is not an explanation. If I open a pull request, it means I understand the change and I have checked it. After an incident I do what I always do: first stop the damage and repair the data, then tell consumers what was wrong and for which period. The review is blameless, but it asks a specific question: which gate should have stopped this, and why didn’t it. The outcome should be a change to the process, for example a mandatory comparison of sums for changed models, or a missing test case. Banning AI is rarely the right conclusion, because a person could have made the same mistake.'
    },
    senior: {
      pl: 'Odpowiedzialność oznacza też prawo do odmowy. Jeśli nie mam czasu albo wiedzy, żeby zmianę zweryfikować, to jej nie zatwierdzam, niezależnie od tego, jak szybko powstała. Tempo generowania nie może wyznaczać tempa akceptacji.',
      en: 'Being accountable also means being entitled to say no. If I don’t have the time or the knowledge to verify a change, I don’t approve it, however quickly it was produced. The speed of generation must not set the speed of approval.'
    },
    explain: [
      'Pytanie sprawdza dojrzałość, a nie wiedzę. Zła odpowiedź przerzuca winę na narzędzie albo na dostawcę modelu. Dobra pokazuje, że rozumiesz, na czym polega akceptacja: to moment, w którym człowiek bierze na siebie odpowiedzialność za wynik.',
      'Warto rozróżnić dwie rzeczy. <b>Odpowiedzialność indywidualna</b>: autor odpowiada za zmianę, którą zgłosił, reviewer za to, co zatwierdził. <b>Odpowiedzialność zespołu</b>: proces ma bramki, które łapią określone rodzaje błędów. Jeśli błąd przeszedł, to albo bramki nie było, albo nie zadziałała.',
      'Analiza bez szukania winnych (po angielsku blameless post-mortem) nie oznacza braku odpowiedzialności. Oznacza, że zamiast pytać „kto zawinił", pytasz „co w procesie pozwoliło, żeby to przeszło". Wynikiem jest konkretna zmiana: nowa kontrola, test albo reguła w instrukcjach repozytorium.',
      'Punkty kontrolne mają sens tylko wtedy, gdy człowiek naprawdę ma w nich co ocenić. Zatwierdzenie pięciuset linii bez czytania jest formalnością, która przenosi odpowiedzialność, ale nie zmniejsza ryzyka.'
    ],
    keywords: ['accountability', 'odpowiedzialność', 'review', 'incydent', 'post-mortem', 'human approval', 'bramka', 'proces'],
    followUps: [
      { q: 'What do you change after such an incident?', a: 'Something specific in the process, tied to the cause. If a fan-out got through, a required comparison of sums for changed models. If a requirement was misread, a worked example in the acceptance criteria. If review was a rubber stamp, smaller pull requests. I also add the failing case as a test, so this exact error can’t come back.', pl: 'Konkretną bramkę związaną z przyczyną i test, który odtwarza ten błąd.' },
      { q: 'Is the reviewer accountable too?', a: 'Yes. Approving means you understood the change and checked it against the requirement, not that you saw a green pipeline. That is why the author owes the reviewer evidence, a clear description and a small enough change. A reviewer who can’t understand a change should say so instead of approving.', pl: 'Tak; zatwierdzenie znaczy „rozumiem i sprawdziłem", a autor jest winien reviewerowi dowody.' },
      { q: 'Would you tell the client the code was written by AI?', a: 'I would follow the agreement with the client. If they ask, or if their policy requires disclosure, I am transparent about it. What I would never do is present it as a reason: the quality bar and my accountability are the same either way. What the client needs to hear is what happened, what the impact was and what we changed.', pl: 'Zgodnie z umową i przejrzyście, ale nigdy jako usprawiedliwienie.' },
      { q: 'How do you avoid human approval becoming a rubber stamp?', a: 'By making the checkpoint cheap to do properly. Small changes, a description that states what changed and why, and evidence attached: test results and the before-and-after comparison. And by limiting the number of approvals. If a person is asked to approve fifty things a day, they will stop reading.', pl: 'Małe zmiany, dowody w opisie i mało akceptacji; kto zatwierdza pięćdziesiąt rzeczy dziennie, przestaje czytać.' }
    ],
    mistakes: [
      'Odpowiedź „to wina narzędzia" albo „dostawcy modelu".',
      'Odpowiedź „zakazałbym AI" bez analizy, która bramka zawiodła.',
      'Pominięcie reviewera i procesu: odpowiedzialność tylko indywidualna albo tylko zespołowa.',
      'Brak kolejności działań po incydencie: zatrzymanie szkody, naprawa danych, komunikat, analiza.'
    ]
  }
];

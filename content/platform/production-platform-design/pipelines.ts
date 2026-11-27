import type { Bridge, ExplainedLine } from '../../types';
import type { Compare, More } from './shared';

/**
 * Etap 2: Ładowanie. Niezawodny pipeline to taki, który daje poprawny wynik także wtedy, gdy uruchomi się
 * dwa razy, padnie w połowie albo dostanie spóźniony rekord. Wszystkie symulacje są ilustracjami:
 * dane, godziny i kwoty są wymyślone i dobrane tak, żeby mechanizm było widać.
 */

/** Pełne ładowanie, przyrostowe po znaczniku, CDC z dziennika. */
export const strategies: Compare & { title: string; intro: string; takeaway: string } = {
  title: 'Ile danych trzeba przeczytać, żeby mieć aktualną kopię?',
  intro: 'Tabela <code>subscriptions</code> w bazie billingowej ma 4 mln wierszy, a dziennie zmienia się około 20 tys. Trzy sposoby utrzymania jej kopii na platformie:',
  label: 'Sposób ładowania',
  assumptions: 'Liczby wymyślone. „Widzi" oznacza: bez dodatkowej pracy po stronie źródła.',
  defaultId: 'full',
  options: [
    {
      id: 'full', label: 'Pełne (full load)',
      rows: [
        ['Co czyta przy każdym uruchomieniu', 'Całą tabelę: 4 mln wierszy'],
        ['Czy widzi usunięte wiersze', 'Tak. Czego nie ma w źródle, tego nie ma w nowej kopii'],
        ['Czy widzi stany pośrednie', 'Nie. Widzi stan z chwili odczytu, a nie to, co działo się między odczytami'],
        ['Czego wymaga od źródła', 'Niczego poza prawem odczytu'],
        ['Kiedy przestaje działać', 'Gdy tabela rośnie tak, że odczyt nie mieści się w oknie czasu albo zbyt obciąża bazę źródłową']
      ],
      verdict: 'Najprostsze i samonaprawiające się: każde uruchomienie zastępuje poprzednie, więc błąd z wczoraj znika. Dla małych tabel i słowników to często najlepszy wybór, a nie brak ambicji.'
    },
    {
      id: 'hwm', label: 'Przyrostowe po znaczniku',
      rows: [
        ['Co czyta przy każdym uruchomieniu', 'Wiersze z <code>updated_at</code> nowszym niż zapamiętany znacznik: około 20 tys.'],
        ['Czy widzi usunięte wiersze', 'Nie. Usuniętego wiersza zapytanie po <code>updated_at</code> nie zwróci'],
        ['Czy widzi stany pośrednie', 'Nie. Jeśli wiersz zmienił się trzy razy między odczytami, widzi ostatnią wersję'],
        ['Czego wymaga od źródła', 'Wiarygodnej kolumny <code>updated_at</code>, ustawianej przy każdej zmianie, najlepiej z indeksem'],
        ['Kiedy przestaje działać', 'Gdy źródło usuwa wiersze fizycznie, zmienia je z pominięciem <code>updated_at</code> albo zatwierdza zmiany z opóźnieniem']
      ],
      verdict: 'Znacznik, do którego doszło ostatnie ładowanie, nazywa się <b>high-water mark</b>. Tanie i wystarczające w wielu przypadkach, ale ma ciche tryby awarii. Jeden z nich zobaczysz za chwilę.'
    },
    {
      id: 'cdc', label: 'CDC z dziennika',
      rows: [
        ['Co czyta przy każdym uruchomieniu', 'Dziennik transakcji bazy: każdą operację INSERT, UPDATE i DELETE w kolejności zatwierdzenia'],
        ['Czy widzi usunięte wiersze', 'Tak, jako zdarzenie DELETE'],
        ['Czy widzi stany pośrednie', 'Tak, każdą zatwierdzoną zmianę'],
        ['Czego wymaga od źródła', 'Dostępu do dziennika transakcji i narzędzia, które go czyta, np. AWS DMS albo Debezium'],
        ['Kiedy przestaje działać', 'Gdy narzędzie stoi dłużej, niż baza przechowuje dziennik. Wtedy potrzebne jest ponowne pełne ładowanie']
      ],
      verdict: '<b>CDC</b> (change data capture) daje najpełniejszy obraz, ale to dodatkowy system do utrzymania i strumień zmian, który trzeba jeszcze złożyć w aktualny stan tabeli. Wybierasz je, gdy potrzebujesz usunięć, historii zmian albo niskiego opóźnienia.'
    }
  ],
  takeaway: '<b>Wniosek.</b> To nie jest ranking. Pytania, które rozstrzygają wybór: jak duża jest tabela, czy źródło usuwa wiersze, czy potrzebujesz historii zmian i ile pracy możesz zlecić zespołowi źródła.'
};

export interface SourceVersion {
  /** Identyfikator wersji wiersza, unikalny w symulacji. */
  id: string;
  /** Klucz wiersza w tabeli źródłowej. */
  key: string;
  /** Wartość kolumny updated_at, w minutach od północy. */
  updatedAt: number;
  /** Kiedy transakcja została zatwierdzona i wiersz stał się widoczny dla odczytu, w minutach od północy. */
  visibleAt: number;
  note?: string;
}

/**
 * Symulacja high-water mark ze spóźnionym rekordem. Logika jest w apps/web/.../model.ts (funkcja hwmRuns),
 * tu są tylko dane. Liczby w opisach (ile wierszy zgubionych, ile zdublowanych) wynikają z modelu i pilnuje ich test.
 */
export const hwm = {
  title: 'Czy „weź wszystko nowsze niż ostatnio" może zgubić rekord?',
  intro: 'Ładowanie przyrostowe co godzinę. Każde uruchomienie pyta źródło o wiersze z <code>updated_at</code> nowszym niż najnowszy, jaki już widziało. Uruchom trzy ładowania i policz, co trafiło do celu.',
  assumptions: 'Model uproszczony: 7 wersji wierszy w źródle, ładowania o 10:00, 11:00 i 12:00. Kropka to wartość <code>updated_at</code>. Kreska za kropką to czas do zatwierdzenia transakcji: wcześniej wiersz nie jest widoczny dla odczytu.',
  runs: [600, 660, 720],
  /** Zakres osi czasu w minutach od północy. */
  axis: [570, 725] as [number, number],
  lookbackMinutes: 10,
  versions: [
    { id: 's1', key: 'sub-1', updatedAt: 580, visibleAt: 580 },
    { id: 's2', key: 'sub-2', updatedAt: 592, visibleAt: 592 },
    { id: 's3', key: 'sub-3', updatedAt: 599, visibleAt: 599 },
    { id: 's4', key: 'sub-4', updatedAt: 598, visibleAt: 603, note: 'długa transakcja: zatwierdzona 5 minut po ustawieniu updated_at' },
    { id: 's5', key: 'sub-5', updatedAt: 630, visibleAt: 630 },
    { id: 's2b', key: 'sub-2', updatedAt: 645, visibleAt: 645, note: 'druga zmiana tej samej subskrypcji' },
    { id: 's6', key: 'sub-6', updatedAt: 680, visibleAt: 680 }
  ] as SourceVersion[],
  windowLabel: 'Warunek odczytu',
  windows: [
    { id: 'strict', label: 'updated_at > znacznik' },
    { id: 'lookback', label: 'updated_at > znacznik − 10 min' }
  ],
  writeLabel: 'Zapis do celu',
  writes: [
    { id: 'append', label: 'INSERT (dopisz)' },
    { id: 'merge', label: 'MERGE po kluczu' }
  ],
  verdicts: {
    'strict|append': 'Wiersz sub-4 zniknął na zawsze. Miał updated_at 09:58, ale został zatwierdzony o 10:03. Ładowanie z 10:00 go nie widziało, a znacznik przesunął się na 09:59, więc żadne następne już o niego nie zapyta. Nie było błędu ani alertu.',
    'strict|merge': 'MERGE niczego tu nie zmienia: sub-4 nadal brakuje, bo problem jest w odczycie, a nie w zapisie. Nie da się scalić wiersza, którego nikt nie pobrał.',
    'lookback|append': 'Okno wstecz złapało sub-4, ale każde ładowanie czyta ponownie 10 minut, które już widziało. Zwykły INSERT dopisuje te wiersze drugi raz: w celu są 3 duplikaty.',
    'lookback|merge': 'Komplet i bez duplikatów. Okno wstecz łapie spóźnione zatwierdzenie, a MERGE po kluczu sprawia, że ponownie przeczytany wiersz nadpisuje sam siebie. Koszt: każde ładowanie czyta trochę więcej, niż musi.'
  } as Record<string, string>,
  idle: 'Uruchom pierwsze ładowanie i obserwuj znacznik.',
  takeaway: '<b>Wniosek.</b> Znacznik zakłada, że dane pojawiają się w źródle w kolejności <code>updated_at</code>. To założenie bywa fałszywe: długie transakcje, zegary kilku serwerów, zdarzenia z urządzeń bez zasięgu. Bezpieczny wzorzec to <b>okno wstecz plus zapis, który można powtarzać</b>. Jedno bez drugiego albo gubi dane, albo je dubluje.',
  more: {
    title: 'Jak dobrać okno wstecz i czego ono nie załatwi',
    html: [
      'Okno musi być dłuższe niż największe realne opóźnienie między ustawieniem <code>updated_at</code> a widocznością wiersza. To zgadywanie poparte obserwacją: zbyt krótkie gubi dane, zbyt długie podnosi koszt każdego ładowania.',
      'Okno nie pomoże na wiersze usunięte w źródle ani na zmiany wykonane z pominięciem <code>updated_at</code>. Na to odpowiada CDC z dziennika transakcji albo okresowe pełne porównanie ze źródłem.',
      'W dbt ten sam pomysł ma nazwę <code>lookback</code> w strategii przyrostowej <code>microbatch</code>: model przelicza także kilka poprzednich paczek czasu, żeby złapać spóźnione rekordy.',
      'Spóźnione zdarzenia z aplikacji to osobny przypadek. Jeśli znacznik opiera się na czasie załadowania, a nie na czasie zdarzenia, rekord nie zginie, ale trafi do „złego" dnia. Wraca to w etapie o streamingu.'
    ]
  } as More,
  bridge: {
    from: 'Snowflake',
    known: 'Stream w Snowflake pamięta pozycję w historii zmian tabeli i przesuwa ją dopiero wtedy, gdy zmiany zostaną zużyte w zatwierdzonej transakcji.',
    fresh: 'High-water mark to ten sam pomysł zrobiony ręcznie: zapamiętana pozycja, od której zaczyna następne ładowanie.',
    breaks: 'Stream działa na tabeli, która już jest w Snowflake, i opiera się na wersjach tabeli, więc nie ma problemu spóźnionego zatwierdzenia. Znacznik po <code>updated_at</code> opiera się na kolumnie wypełnianej przez obcą aplikację i dziedziczy wszystkie jej błędy.'
  } as Bridge
};

/** Pobieranie z API: paginacja, limity zapytań, zapis surowej strony przed przetworzeniem. */
export const api = {
  title: 'Jak pobrać 200 tys. płatności z API, które oddaje 100 naraz?',
  intro: 'API dostawcy płatności zwraca dane stronami i odrzuca zbyt częste zapytania kodem 429. Poniżej szkielet pobierania w Pythonie. Kliknij linie: każda odpowiada na jedno „a co, jeśli".',
  codeTitle: 'Pobieranie przyrostowe z API',
  lines: [
    { code: 'cursor = state.load("payments_cursor")', label: 'punkt wznowienia', text: 'Pobieranie zaczyna od miejsca, w którym skończyło poprzednie. Kursor to nieprzezroczysty znacznik pozycji zwracany przez API. Jest tym samym co high-water mark, tylko wydaje go źródło.' },
    { code: 'while True:', label: 'strona po stronie', text: 'Każda strona to osobne zapytanie. Awaria może przerwać pętlę po dowolnej stronie, więc kolejne linie muszą to wytrzymać.' },
    { code: '    resp = get("/payments", after=cursor, limit=100)', label: 'paginacja kursorem', text: 'Prosisz o 100 rekordów po kursorze. Paginacja numerem strony (<code>page=7</code>) jest groźniejsza: gdy w trakcie pobierania dojdzie nowy rekord, strony się przesuwają i jeden rekord dostajesz dwa razy albo wcale.' },
    { code: '    if resp.status == 429:', label: 'limit zapytań', text: 'Kod 429 znaczy: za dużo zapytań. To nie jest błąd danych, tylko prośba, żeby zwolnić.' },
    { code: '        sleep(retry_after(resp)); continue', label: 'czekaj i ponów', text: 'Czekasz tyle, ile API podało w nagłówku <code>Retry-After</code>, a gdy go nie ma, coraz dłużej przy każdej próbie (exponential backoff), z limitem prób. Ponawianie bez czekania tylko przedłuża blokadę.' },
    { code: '    s3.put(f"raw/payments/{run_id}/{cursor}.json", resp.body)', label: 'najpierw zapisz surowe', text: 'Strona trafia do S3 w niezmienionej postaci, zanim ktokolwiek ją zinterpretuje. Nazwa pliku wynika z kursora, więc ponowne pobranie tej samej strony nadpisuje ten sam plik, zamiast tworzyć drugi.' },
    { code: '    cursor = resp.next_cursor', label: 'następna strona', text: 'Kursor przesuwa się dopiero po udanym zapisie strony. Odwrotna kolejność zgubiłaby stronę przy awarii między tymi dwiema liniami.' },
    { code: '    state.save("payments_cursor", cursor)', label: 'utrwal postęp', text: 'Postęp jest zapisany po każdej stronie. Po awarii pobieranie wznawia od ostatniej zapisanej strony, a nie od początku.' },
    { code: '    if not resp.has_more: break', label: 'koniec', text: 'API mówi, że nie ma więcej stron. Zakończenie pętli nie dowodzi kompletności: to sprawdza dopiero porównanie liczby rekordów ze źródłem.' }
  ] as ExplainedLine[],
  takeaway: '<b>Wniosek.</b> Trzy nawyki, które widać w tym szkielecie: surowa odpowiedź jest zapisywana przed przetworzeniem, postęp jest utrwalany po każdym kroku, a ponowienie tego samego kroku nadpisuje, a nie dopisuje.',
  more: {
    title: 'Gdzie ten kod działa i jak dane trafiają dalej',
    html: [
      'Taki skrypt uruchamia się zwykle jako zadanie orkiestratora albo kontener na AWS. Krótkie pobrania mieszczą się w funkcji Lambda, długie potrzebują zadania bez twardego limitu czasu.',
      'Pliki w S3 może ładować Snowpipe: powiadomienie o nowym pliku uruchamia ładowanie bez własnego <term id="virtual-warehouse">warehouse\'u</term>. Snowpipe przez 14 dni pamięta załadowane pliki po ścieżce i nazwie, więc ten sam plik nie trafi do tabeli drugi raz. Uwaga na odwrotną stronę: plik poprawiony i wgrany pod tą samą nazwą też zostanie pominięty.',
      'Powiadomienia S3 o nowych plikach są dostarczane co najmniej raz, więc sporadycznie mogą przyjść podwójnie. To kolejny powód, żeby każdy krok dawał się bezpiecznie powtórzyć.'
    ]
  } as More
};

export interface Payment {
  id: string;
  amount: number;
}

/**
 * Symulacja nieudanego uruchomienia i ponowienia. Logika: model.ts (retryRows). Paczka to 6 płatności
 * zapisywanych po 2 naraz; pierwsze uruchomienie pada po dwóch porcjach, czyli po 4 wierszach.
 */
export const retry = {
  title: 'Job padł w połowie. Co się stanie, gdy klikniesz „ponów"?',
  intro: 'Nocne ładowanie płatności za 20 listopada: 6 wierszy, razem 374 zł. Job zapisuje po 2 wiersze naraz i traci połączenie po drugiej porcji. Potem ktoś go ponawia. A potem, dla pewności, jeszcze raz.',
  assumptions: 'Model uproszczony: tabela docelowa na początku nie ma wierszy z tego dnia. Każda porcja to osobna instrukcja SQL, chyba że strategia mówi inaczej.',
  batch: [
    { id: 'p-201', amount: 49 },
    { id: 'p-202', amount: 49 },
    { id: 'p-203', amount: 99 },
    { id: 'p-204', amount: 49 },
    { id: 'p-205', amount: 99 },
    { id: 'p-206', amount: 29 }
  ] as Payment[],
  chunk: 2,
  /** Ile porcji zdążyło się zapisać przed awarią w pierwszym uruchomieniu. */
  chunksBeforeCrash: 2,
  strategyLabel: 'Jak job zapisuje dane',
  strategies: [
    {
      id: 'append', label: 'INSERT, porcja po porcji',
      how: 'Każda porcja jest dopisywana i od razu zatwierdzana.',
      verdicts: [
        'W tabeli zostały 4 z 6 wierszy. Dashboard, który teraz odczyta dane, pokaże niepełny dzień i nic nie będzie o tym świadczyć.',
        'Ponowienie zaczęło od początku i dopisało wszystkie 6 wierszy do 4, które już były. Cztery płatności są policzone podwójnie: 620 zł zamiast 374 zł.',
        'Każde kolejne uruchomienie dokłada następne 6 wierszy. Wynik zależy od tego, ile razy ktoś kliknął. Taki job nie jest idempotentny.'
      ]
    },
    {
      id: 'overwrite', label: 'DELETE + INSERT w jednej transakcji',
      how: 'Jedna transakcja: usuń wiersze z 20 listopada, wstaw wszystkie 6, zatwierdź na końcu.',
      verdicts: [
        'Transakcja nie została zatwierdzona, więc baza wycofała obie porcje. Tabela wygląda tak, jakby job w ogóle nie ruszył: czytelnik widzi stan poprzedni, nigdy połowę.',
        'Ponowienie usunęło dzień (nie było czego) i wstawiło komplet. 6 wierszy, 374 zł.',
        'Trzecie uruchomienie usunęło 6 wierszy i wstawiło te same 6. Wynik jest taki sam po każdym uruchomieniu.'
      ]
    },
    {
      id: 'merge', label: 'MERGE po payment_id',
      how: 'Każda porcja jest scalana po kluczu: istniejący wiersz zostaje zaktualizowany, nowy wstawiony.',
      verdicts: [
        'Po awarii w tabeli są 4 wiersze, tak jak przy INSERT. Dzień jest przez chwilę niepełny, bo porcje były zatwierdzane osobno.',
        'Ponowienie zaktualizowało 4 istniejące wiersze i dodało 2 brakujące. 6 wierszy, 374 zł, bez duplikatów.',
        'Trzecie uruchomienie zaktualizowało 6 wierszy tymi samymi wartościami. Wynik się nie zmienił.'
      ]
    }
  ],
  steps: ['Przed uruchomieniem', 'Uruchomienie 1: awaria po 4 wierszach', 'Uruchomienie 2: ponowienie', 'Uruchomienie 3: ktoś kliknął jeszcze raz'],
  takeaway: '<b>Wniosek.</b> Operacja jest <b>idempotentna</b>, gdy wykonana wiele razy daje ten sam wynik co wykonana raz. Ponowienia są nieuniknione: robi je orkiestrator, sieć i człowiek o trzeciej w nocy. Dlatego bezpieczny job nie pyta „czy już się uruchomiłem", tylko zapisuje tak, żeby odpowiedź nie miała znaczenia.',
  more: {
    title: 'Która z dwóch bezpiecznych strategii i kiedy',
    html: [
      '<b>Nadpisanie zakresu</b> (usuń i wstaw dzień albo partycję w jednej transakcji) jest najprostsze, gdy dane mają naturalny podział na dni, a paczka zawiera komplet danego dnia. Daje też atomowość: czytelnik widzi stary albo nowy dzień, nigdy połowę.',
      '<b>MERGE po kluczu</b> pasuje, gdy przychodzą pojedyncze zmiany rozrzucone po wielu dniach, np. z CDC. Wymaga wiarygodnego klucza i tego, żeby w paczce źródłowej był najwyżej jeden wiersz na klucz. W Snowflake kilka wierszy źródła pasujących do jednego wiersza celu to domyślnie błąd niedeterministycznego MERGE.',
      'W dbt odpowiadają temu strategie modeli przyrostowych: <code>delete+insert</code>, <code>merge</code> i <code>microbatch</code>. Model przyrostowy bez <code>unique_key</code> tylko dopisuje wiersze, czyli zachowuje się jak pierwsza, niebezpieczna opcja w symulacji.',
      'Częściowa awaria dotyczy też wielu tabel naraz: fakty załadowane, wymiar nie. Dlatego publikację dla odbiorców robi się jako ostatni krok, po testach, a nie w trakcie.'
    ]
  } as More
};

export interface DeliveredEvent {
  /** Kolejność dostarczenia. */
  n: number;
  eventId: string;
  userId: string;
  amount: number;
  /** Czas zdarzenia jako tekst do pokazania. */
  at: string;
  /** Prawda o zdarzeniu, niewidoczna dla pipeline'u: powtórna dostawa czy osobna płatność. */
  truth: string;
}

/** Ćwiczenie: wybierz klucz deduplikacji. Logika: model.ts (dedupe). Kwoty w werdyktach wynikają z danych. */
export const dedup = {
  title: 'Które z tych zdarzeń są duplikatami?',
  intro: 'Kolejka dostarczyła 7 zdarzeń płatności. System kolejkowy gwarantuje, że każde zdarzenie dotrze <b>co najmniej raz</b>, więc po awarii konsumenta część przychodzi ponownie. Wybierz, po czym rozpoznasz duplikat.',
  assumptions: 'Dane wymyślone. Prawdziwy przychód to 275 zł z 5 płatności: tyle zaksięgował system płatności.',
  expectedTotal: 275,
  events: [
    { n: 1, eventId: 'e-101', userId: 'u-1', amount: 49, at: '12:00:01', truth: 'płatność' },
    { n: 2, eventId: 'e-102', userId: 'u-2', amount: 99, at: '12:00:05', truth: 'płatność' },
    { n: 3, eventId: 'e-102', userId: 'u-2', amount: 99, at: '12:00:05', truth: 'powtórna dostawa e-102' },
    { n: 4, eventId: 'e-103', userId: 'u-3', amount: 49, at: '12:00:09', truth: 'płatność' },
    { n: 5, eventId: 'e-104', userId: 'u-3', amount: 49, at: '12:00:09', truth: 'druga, osobna płatność: subskrypcja na prezent' },
    { n: 6, eventId: 'e-105', userId: 'u-4', amount: 29, at: '12:00:14', truth: 'płatność' },
    { n: 7, eventId: 'e-101', userId: 'u-1', amount: 49, at: '12:00:01', truth: 'powtórna dostawa e-101 po restarcie konsumenta' }
  ] as DeliveredEvent[],
  keyLabel: 'Klucz deduplikacji',
  keys: [
    { id: 'none', label: 'Żaden, liczę wszystko', verdict: 'Dwie powtórne dostawy zostały policzone jako płatności. Przychód jest zawyżony o 148 zł i rośnie z każdą awarią konsumenta.' },
    { id: 'natural', label: 'user_id + kwota + czas', verdict: 'Zniknęły obie powtórki, ale razem z nimi prawdziwa płatność e-104: ten sam użytkownik, ta sama kwota, ta sama sekunda. Przychód jest zaniżony o 49 zł. Podobieństwo to nie tożsamość.' },
    { id: 'event', label: 'event_id', verdict: 'Zostało 5 płatności i 275 zł. Identyfikator nadany przez producenta w chwili powstania zdarzenia jest taki sam przy każdej dostawie i różny dla dwóch osobnych płatności.' }
  ],
  takeaway: '<b>Wniosek.</b> Deduplikacja jest tak dobra jak klucz. Klucz zgadywany z treści (użytkownik, kwota, czas) myli powtórną dostawę z drugim, takim samym zdarzeniem. Dlatego w kontrakcie ze źródłem jedno z pierwszych pytań brzmi: <b>czy każde zdarzenie ma stabilny, unikalny identyfikator nadany u źródła?</b>',
  codeTitle: 'Deduplikacja w modelu STG (Snowflake SQL)',
  lines: [
    { code: 'select *', label: 'wszystkie kolumny', text: 'Model STG oddaje te same kolumny co RAW, tylko bez powtórek.' },
    { code: 'from raw.events.payments', label: 'surowe zdarzenia', text: 'RAW zawiera wszystko, co dostarczyła kolejka, razem z powtórkami. Tak ma być: RAW niczego nie odrzuca.' },
    { code: 'qualify row_number() over (', label: 'ponumeruj w grupie', text: '<code>QUALIFY</code> filtruje po wyniku funkcji okna, tak jak <code>HAVING</code> filtruje po agregacji. Tu numerujesz wiersze w każdej grupie.' },
    { code: '  partition by event_id', label: 'klucz duplikatu', text: 'Grupą są wiersze z tym samym <code>event_id</code>. To jest decyzja z ćwiczenia powyżej, zapisana w jednym miejscu.' },
    { code: '  order by _loaded_at desc', label: 'który zostaje', text: 'Zostaje wiersz załadowany najpóźniej. Jeśli powtórki mogą się różnić treścią, kolejność ma znaczenie i trzeba ją świadomie wybrać.' },
    { code: ') = 1', label: 'jeden na klucz', text: 'Z każdej grupy przechodzi dokładnie jeden wiersz. Test <code>unique</code> na <code>event_id</code> w dbt potwierdza to po każdym uruchomieniu.' }
  ] as ExplainedLine[]
};

export interface BackfillStep {
  ask: string;
  options: string[];
  correct: number;
  why: string;
  /** Stan dni 18, 19 i 20 listopada po poprawnej decyzji w tym kroku. */
  days: 'wrong' | 'flagged' | 'fixed' | 'verified';
}

/** Scenariusz backfillu: cztery decyzje po kolei. Pasek dni pokazuje stan po każdej. */
export const backfill = {
  title: 'Błąd w logice działał trzy dni. Jak to naprawić?',
  intro: 'W piątek 21 listopada odkrywasz, że zmiana wdrożona 18 listopada liczy zwroty jako przychód. Dni 18, 19 i 20 w <code>fct_revenue_daily</code> są zawyżone. Dane w RAW są poprawne i sięgają 90 dni wstecz. Tabela ma trzy lata historii.',
  assumptions: 'Scenariusz wymyślony. Przeliczenie historycznego zakresu po poprawce albo po awarii nazywa się backfill.',
  dayLabels: ['15', '16', '17', '18', '19', '20', '21'],
  /** Indeksy dni z błędnymi danymi. */
  affected: [3, 4, 5],
  legend: { ok: 'poprawne', wrong: 'błędne', flagged: 'błędne, oznaczone', fixed: 'przeliczone', verified: 'przeliczone i uzgodnione' },
  steps: [
    {
      ask: 'Co robisz najpierw?',
      options: ['Ręcznie poprawiam trzy wiersze w tabeli MRT instrukcją UPDATE', 'Informuję odbiorców, które dni są błędne, i wdrażam poprawkę logiki', 'Od razu uruchamiam pełne przeliczenie całej tabeli'],
      correct: 1,
      why: 'Najpierw zatrzymujesz szkodę: odbiorcy muszą wiedzieć, których liczb nie używać, a nowy dzień nie może policzyć się starym błędem. Ręczny UPDATE w MRT zostawia logikę zepsutą i tworzy dane, których nie da się odtworzyć z kodu. Pełne przeliczenie przed poprawką powtórzy błąd.',
      days: 'flagged'
    },
    {
      ask: 'Poprawka jest wdrożona. Jaki zakres przeliczasz?',
      options: ['Tylko dzisiejszy dzień, reszta sama się wyrówna', 'Wszystkie trzy lata, dla pewności', 'Dni 18–20, od RAW przez STG do MRT'],
      correct: 2,
      why: 'Zakres backfillu to zakres błędu: od dnia wdrożenia zmiany do dnia poprawki. Dni sprzed 18 listopada liczyła stara, poprawna logika. Przeliczanie trzech lat kosztuje i niesie ryzyko: jeśli RAW sięga 90 dni wstecz, pełne przeliczenie zastąpiłoby starszą historię pustką albo wynikiem z niepełnych danych.',
      days: 'flagged'
    },
    {
      ask: 'Jak zapisujesz przeliczone dni?',
      options: ['Dopisuję poprawne wiersze obok starych', 'Zastępuję każdy dzień w jednej transakcji: usuń dzień, wstaw dzień', 'Usuwam całą tabelę i buduję ją od nowa z tych trzech dni'],
      correct: 1,
      why: 'Backfill to to samo ładowanie co codziennie, tylko z innym zakresem dat. Jeśli codzienny job zastępuje dzień atomowo, backfill jest jego trzykrotnym uruchomieniem z parametrem. Dopisywanie zdublowałoby dni. Budowa tabeli od nowa z trzech dni skasowałaby resztę historii.',
      days: 'fixed'
    },
    {
      ask: 'Skąd wiesz, że naprawione?',
      options: ['Job zakończył się sukcesem', 'Porównuję sumy i liczby wierszy dla dni 18–20 z systemem płatności i przekazuję wynik odbiorcom', 'Wykres na dashboardzie wygląda normalnie'],
      correct: 1,
      why: 'Sukces joba mówi, że kod się wykonał. Poprawność potwierdza dopiero uzgodnienie z niezależnym źródłem: liczba płatności i suma kwot za każdy dzień powinny zgadzać się z systemem płatności, z uwzględnieniem znanych różnic. Dopiero potem zdejmujesz oznaczenie błędu i zamykasz incydent.',
      days: 'verified'
    }
  ] as BackfillStep[],
  takeaway: '<b>Wniosek.</b> Backfill jest tani i bezpieczny wtedy, gdy trzy rzeczy zaprojektowano wcześniej: RAW przechowuje surowe dane wystarczająco długo, job przyjmuje zakres dat jako parametr, a zapis można powtarzać. Jeśli którejś brakuje, backfill staje się ręczną operacją na produkcji.',
  more: {
    title: 'Na co uważać przy dużym backfillu',
    html: [
      '<b>Zasoby.</b> Przeliczenie roku danych uruchomione na tym samym warehousie co codzienne ładowanie potrafi je zablokować. Osobny warehouse albo przeliczanie w mniejszych paczkach rozwiązuje to kosztem czasu.',
      '<b>Odbiorcy w dół.</b> Przeliczona tabela to nowe dane dla wszystkiego, co z niej czyta: modeli zależnych, eksportów, powiadomień. Trzeba wiedzieć, co się uruchomi, a do tego służy lineage, o którym będzie w etapie 4.',
      '<b>Dane, których już nie ma w RAW.</b> Jeśli błąd sięga dalej niż retencja RAW, zostaje prośba do źródła o ponowne wysłanie albo pogodzenie się z korektą tylko części historii. To wraca do decyzji o retencji z etapu 1.',
      'W dbt strategia <code>microbatch</code> pozwala przeliczyć wskazany zakres czasu opcjami <code>--event-time-start</code> i <code>--event-time-end</code>, a każda paczka czasu jest osobną, ponawialną jednostką.'
    ]
  } as More
};

export interface DagTask {
  id: string;
  label: string;
}
export interface DagCase {
  id: string;
  label: string;
  /** Status każdego zadania w kolejności `tasks`. */
  status: ('ok' | 'fail' | 'skip')[];
  dashboard: string;
  verdict: string;
}

/** Orkiestracja: gdzie padło i co przez to się nie uruchomiło. */
export const dag = {
  title: 'Co powinno się stać z resztą, gdy jeden krok zawiedzie?',
  intro: 'Nocny przebieg to sześć kroków, z których każdy zależy od poprzedniego. Wybierz, co poszło źle, i zobacz, co orkiestrator zrobił z resztą.',
  assumptions: 'Ilustracja zależności, bez czasów. Zadanie pominięte to takie, którego orkiestrator nie uruchomił, bo krok przed nim się nie powiódł.',
  label: 'Co się wydarzyło tej nocy',
  defaultId: 'ok',
  tasks: [
    { id: 'ingest', label: 'Pobranie z API i ładowanie do RAW' },
    { id: 'stg', label: 'Modele STG' },
    { id: 'stg-test', label: 'Testy STG' },
    { id: 'mrt', label: 'Modele MRT' },
    { id: 'mrt-test', label: 'Testy MRT' },
    { id: 'publish', label: 'Publikacja dla dashboardu' }
  ] as DagTask[],
  cases: [
    {
      id: 'ok', label: 'Nic, wszystko przeszło',
      status: ['ok', 'ok', 'ok', 'ok', 'ok', 'ok'],
      dashboard: 'Dane z dzisiejszej nocy.',
      verdict: 'Każdy krok ruszył po zakończeniu poprzedniego, a nie o stałej godzinie. Publikacja jest ostatnia, więc odbiorca nigdy nie widzi danych sprzed testów.'
    },
    {
      id: 'api', label: 'API płatności nie odpowiada',
      status: ['fail', 'skip', 'skip', 'skip', 'skip', 'skip'],
      dashboard: 'Dane z wczoraj, z widoczną datą ostatniego odświeżenia.',
      verdict: 'Orkiestrator ponowił pobranie kilka razy z rosnącą przerwą, a potem zatrzymał wszystko, co od niego zależy. Dashboard jest nieaktualny, ale poprawny, i mówi o tym wprost. Alert trafia do właściciela pipeline\'u.'
    },
    {
      id: 'test', label: 'Test STG wykrył duplikaty',
      status: ['ok', 'ok', 'fail', 'skip', 'skip', 'skip'],
      dashboard: 'Dane z wczoraj, z widoczną datą ostatniego odświeżenia.',
      verdict: 'Dane dotarły, ale nie spełniają reguły. Test działa jak bramka: MRT nie zostało przeliczone na podejrzanych danych. Stare, poprawne dane są lepsze niż świeże i błędne, o ile odbiorca wie, że są stare.'
    }
  ] as DagCase[],
  takeaway: '<b>Wniosek.</b> Orkiestracja to nie harmonogram, tylko zależności: krok startuje, gdy poprzedni się powiódł. Awaria powinna zatrzymać to, co od niej zależy, i zostawić odbiorcy ostatni poprawny stan.',
  more: {
    title: 'Jak to wygląda w dbt i Snowflake oraz czym jest uzgadnianie',
    html: [
      '<code>dbt build</code> uruchamia modele i testy w kolejności zależności, a gdy test modelu się nie powiedzie, pomija modele, które od niego zależą. To jest bramka z ilustracji. Test z ważnością <code>warn</code> tylko ostrzega i niczego nie zatrzymuje.',
      'W Snowflake zależności między instrukcjami SQL można zapisać jako graf <term id="streams-tasks">Tasks</term>: zadanie główne ma harmonogram, a zadania zależne startują po zakończeniu poprzedników. Wystarcza to dla prostych przepływów wewnątrz hurtowni. Zależności między systemami, np. „najpierw API, potem dbt", lepiej wyrazić w zewnętrznym orkiestratorze.',
      '<b>Uzgadnianie</b> (reconciliation) to porównanie platformy z niezależnym źródłem prawdy: liczba wierszy i suma kwot za dzień w RAW kontra to, co raportuje system płatności. Testy sprawdzają, czy dane są wewnętrznie spójne. Uzgadnianie sprawdza, czy są kompletne względem świata zewnętrznego.',
      'Różnica w uzgodnieniu nie zawsze jest błędem: strefy czasowe, płatności w toku i zwroty zaksięgowane później tworzą znane, wyjaśnialne rozbieżności. Próg alertu ustawia się powyżej nich.'
    ]
  } as More
};

import type { Bridge } from '../../types';
import type { Compare, More, Scenario } from './shared';

/**
 * Etap 1: Architektura. Od objawu (zły wynik na dashboardzie przy zielonych pipeline'ach) przez mapę całej
 * platformy do warstw RAW / STG / MRT na przykładowych rekordach. Wszystkie rekordy i kwoty są wymyślone.
 */
export const opening = {
  html: '<h1>Dashboard pokazuje o 31% większy przychód. Wszystkie pipeline\'y są zielone.</h1>\n<p class="lede">Poniedziałek, 8:05. Serwis wideo z subskrypcjami. Dyrektor finansowy pyta, skąd skok MRR, czyli miesięcznego przychodu z aktywnych subskrypcji. Nikt nie podnosił cen.</p>\n<p>Żeby znaleźć błąd, musisz najpierw wiedzieć, <b>którędy liczba dotarła na dashboard</b> i gdzie po drodze mogła się zepsuć. Od tego pytania zaczyna się każda rozmowa o projektowaniu platformy danych.</p>'
};

export interface MapNode {
  id: string;
  label: string;
  sub: string;
  /** Za co ten element odpowiada. */
  role: string;
  /** Czym jest w przykładzie. Nazwy narzędzi to punkty odniesienia. */
  example: string;
  /** Typowa awaria w tym miejscu. */
  fails: string;
  /** Decyzja projektowa, którą trzeba umieć uzasadnić. */
  decision: string;
}

/** Mapa od źródła do BI. `flow` to droga danych, `cross` to funkcje przekrojowe, które dotyczą każdego kroku. */
export const map = {
  question: 'Którędy dane płyną od źródła do dashboardu?',
  intro: 'Kliknij każdy element. Przy każdym są cztery rzeczy, o które zapyta rekruter: za co odpowiada, czym jest w tym przykładzie, jak się psuje i jaką decyzję trzeba przy nim podjąć.',
  assumptions: 'To jedna z rozsądnych architektur dla tego przykładu, nie jedyna poprawna. Snowflake, dbt, Python i AWS są tu przykładami narzędzi. Te same role znajdziesz na każdej platformie.',
  flowLabel: 'Droga danych',
  crossLabel: 'Dotyczy każdego kroku',
  defaultId: 'sources',
  flow: [
    {
      id: 'sources', label: 'Źródła', sub: 'baza · API · zdarzenia',
      role: 'Systemy, w których dane powstają. Nie należą do zespołu danych i zmieniają się bez pytania.',
      example: 'Baza billingowa PostgreSQL (klienci, subskrypcje), API dostawcy płatności (płatności, zwroty) i zdarzenia z aplikacji (odtworzenia, logowania).',
      fails: 'Zespół produktu zmienia typ kolumny albo usuwa pole. API zwraca błąd 429 po przekroczeniu limitu zapytań. Telefon bez zasięgu wysyła zdarzenia z trzygodzinnym opóźnieniem.',
      decision: 'Dla każdej liczby: który system mówi prawdę (source of truth) i kto po stronie źródła odpowiada za zmiany. Bez tej osoby nie masz z kim ustalić, co źródło gwarantuje.'
    },
    {
      id: 'ingest', label: 'Ingestion', sub: 'Python · Snowpipe · CDC',
      role: 'Przenosi dane ze źródła na platformę w niezmienionej postaci. Niczego nie poprawia i nie interpretuje.',
      example: 'Skrypt w Pythonie pobiera strony z API płatności i zapisuje je jako pliki w <term id="object-storage">S3</term>. <term id="snowpipe">Snowpipe</term> ładuje nowe pliki do Snowflake. Zmiany z bazy billingowej przenosi narzędzie <b>CDC</b> (change data capture). Czyta ono dziennik transakcji, czyli zapis wszystkich zmian, który baza sama prowadzi.',
      fails: 'Job pada w połowie i po ponowieniu ładuje część danych drugi raz. Ładowanie przyrostowe, czyli pobieranie tylko nowych danych, gubi rekord, który pojawił się z opóźnieniem. To dwa najczęstsze źródła błędnych liczb i temat etapu 2.',
      decision: 'Ładować wszystko czy tylko nowe dane, jak często i co się stanie przy ponowieniu. Każdy job ma dać ten sam wynik po jednym i po trzech uruchomieniach.'
    },
    {
      id: 'raw', label: 'RAW', sub: 'Bronze',
      role: 'Wierna kopia tego, co przyszło ze źródła, razem z informacją, kiedy i skąd. Nikt jej nie poprawia.',
      example: 'Schemat <code>RAW</code> w Snowflake. Każdy rekord z API to jeden wiersz z kolumną typu <term id="variant">VARIANT</term> oraz kolumnami <code>_file</code> i <code>_loaded_at</code>.',
      fails: 'Ktoś „naprawia" dane ręcznym <code>UPDATE</code> w RAW i znika jedyna kopia tego, co naprawdę przysłało źródło. Albo surowe dane są kasowane za szybko (za krótka retencja) i nie ma z czego przeliczyć historii.',
      decision: 'Jak długo trzymasz surowe dane. Od tego zależy, jak daleko wstecz da się naprawić błąd w logice bez proszenia źródła o ponowne wysłanie.'
    },
    {
      id: 'stg', label: 'STG', sub: 'Silver',
      role: 'Te same dane po technicznym sprzątaniu: poprawne typy, spójne nazwy, usunięte duplikaty (deduplikacja), sprawdzone wartości. Jeszcze bez reguł biznesowych.',
      example: 'Modele dbt <code>stg_billing__payments</code> i <code>stg_billing__subscriptions</code>, a przy nich <term id="dbt-test">testy dbt</term> <code>unique</code> i <code>not_null</code> na kluczach.',
      fails: 'Deduplikacja po złym kluczu usuwa prawdziwe płatności. Reguła biznesowa wpisana tutaj („bez kont testowych") jest potem powielana inaczej w trzech raportach.',
      decision: 'Co jest kluczem rekordu i co robisz z wierszem, który nie przechodzi walidacji: zatrzymujesz pipeline, odkładasz wiersz na bok czy puszczasz dalej z ostrzeżeniem.'
    },
    {
      id: 'mrt', label: 'MRT', sub: 'Gold',
      role: 'Dane ułożone tak, jak czyta je biznes: tabele faktów i wymiarów oraz metryki, z których każda ma jedną, uzgodnioną definicję.',
      example: 'Modele dbt <code>fct_revenue_daily</code> i <code>dim_customers</code>. Tu jest zapisane, że do przychodu liczy się tylko płatność udana i nie z konta testowego.',
      fails: 'Dwa marty liczą „aktywnego klienta" inaczej i dwa dashboardy pokazują różne liczby. Technicznie wszystko działa, a zaufanie do danych spada.',
      decision: 'Kto odpowiada za definicję każdej metryki. To decyzja organizacyjna, nie techniczna. Bez niej warstwa gold jest zbiorem tabel, a nie źródłem prawdy.'
    },
    {
      id: 'bi', label: 'BI', sub: 'dashboard MRR',
      role: 'Miejsce, w którym dane spotykają użytkownika. Tu widać każdy błąd z wcześniejszych kroków.',
      example: 'Dashboard MRR dla finansów, odświeżany co rano. Zapytania analityków i dashboardy korzystają z własnego <term id="virtual-warehouse">warehouse\'u</term>, oddzielnego od ładowania.',
      fails: 'Dashboard czyta dane w trakcie przeliczania i pokazuje pół dnia. Albo pokazuje dane wczorajsze i nikt o tym nie wie, bo nie ma na nim daty ostatniego odświeżenia.',
      decision: 'Jak świeże dane są naprawdę potrzebne. „Na 7:00 rano" i „co 5 minut" to dwie różne architektury i dwa różne rachunki.'
    }
  ] as MapNode[],
  cross: [
    {
      id: 'orch', label: 'Orkiestracja', sub: 'kolejność i ponowienia',
      role: 'Uruchamia kroki we właściwej kolejności, ponawia nieudane i zatrzymuje to, co zależy od kroku, który się nie powiódł.',
      example: '<term id="orchestrator">Orkiestrator</term>, np. Airflow, albo <term id="streams-tasks">Tasks</term> w Snowflake dla prostszych zależności. <code>dbt build</code> pilnuje kolejności modeli i testów wewnątrz dbt.',
      fails: 'Transformacja startuje o stałej godzinie, zanim ładowanie się skończyło, i liczy na niepełnych danych. Zależność „na zegarek" zamiast „po zakończeniu" to klasyczny błąd.',
      decision: 'Co ma się stać, gdy krok zawiedzie: opublikować dane wczorajsze z wyraźną informacją czy nie publikować nic.'
    },
    {
      id: 'obs', label: 'Jakość i obserwowalność', sub: 'testy · monitory',
      role: 'Mówi, czy danym można ufać: czy przyszły na czas, czy są kompletne i czy spełniają reguły.',
      example: 'Testy dbt dla reguł, które znasz z góry. Narzędzie obserwowalności, np. <term id="monte-carlo">Monte Carlo</term>, dla anomalii, których nikt nie przewidział: nagły spadek liczby wierszy albo tabela, która przestała się odświeżać.',
      fails: 'Zielony pipeline uznany za dowód poprawnych danych. Job, który załadował zero wierszy, też kończy się sukcesem.',
      decision: 'Dla których tabel coś obiecujesz odbiorcom, np. „dane gotowe przed 7:00", i kto dostaje alert. Jeśli wszystko monitorujesz tak samo, alertów jest za dużo i ludzie przestają je czytać.'
    },
    {
      id: 'gov', label: 'Dostęp i własność', sub: 'role · PII · właściciele',
      role: 'Ustala, kto może widzieć które dane i kto odpowiada za każdą tabelę.',
      example: 'Role w Snowflake z uprawnieniami nadawanymi rolom, nie osobom. Maskowanie adresów e-mail i danych płatniczych dla ról, które nie muszą ich widzieć.',
      fails: 'Surowe dane osobowe trafiają do warstwy, do której ma dostęp każdy analityk. Albo tabela nie ma właściciela i po awarii nikt nie czuje się odpowiedzialny.',
      decision: 'Zasada najmniejszych uprawnień: każda rola dostaje tylko to, czego potrzebuje do swojej pracy. Łatwiej dodać dostęp niż go odebrać.'
    }
  ] as MapNode[],
  takeaway: '<b>Wniosek.</b> Platforma to łańcuch kroków. Zielony status mówi tylko, że krok się zakończył. Nie mówi, że wynik jest poprawny. Dlatego przy każdym kroku pytasz: <b>co się stanie, gdy uruchomi się dwa razy, nie uruchomi się wcale albo dostanie inne dane niż wczoraj?</b>',
  more: {
    title: 'Jak odpowiedzieć na pytanie z nagłówka',
    html: [
      'Idź od dashboardu w stronę źródła. W każdej warstwie sprawdzaj tę samą liczbę: sumę płatności za piątek w MRT, w STG, w RAW i na końcu w systemie źródłowym.',
      'Warstwa, w której liczba pierwszy raz przestaje się zgadzać, wskazuje krok do sprawdzenia. Jeśli RAW ma więcej wierszy niż źródło, zawiniło ładowanie. Jeśli RAW się zgadza, a STG nie, zawiniła transformacja.',
      'To działa tylko wtedy, gdy warstwy istnieją i wiadomo, co każda z nich robi. Dlatego następny krok lekcji jest o warstwach.'
    ]
  } as More
};

export interface LayerRow {
  cells: string[];
  /** Krótka adnotacja przy wierszu, np. „duplikat". */
  note?: string;
  /** Wiersz, który w tej warstwie jest problemem albo został odłożony na bok. */
  flag?: boolean;
}
export interface Layer {
  id: 'raw' | 'stg' | 'mrt';
  label: string;
  table: string;
  columns: string[];
  rows: LayerRow[];
  /** Co ta warstwa zrobiła z danymi względem poprzedniej. */
  did: string[];
  /** Czego celowo nie zrobiła. */
  didNot: string;
}

/**
 * Sześć wymyślonych rekordów płatności w trzech warstwach. Liczby w opisach wynikają z danych:
 * RAW 6 wierszy, STG 4 wiersze i 1 w kwarantannie, MRT 148 zł z 2 płatności (pilnuje tego test lekcji).
 */
export const layers = {
  title: 'Co robi każda warstwa z tymi samymi sześcioma rekordami?',
  intro: 'Sześć płatności z 20 listopada, tak jak przyszły z API. Przełączaj warstwy i patrz, co znika, co się zmienia i <b>w której warstwie zapada która decyzja</b>.',
  assumptions: 'Dane wymyślone. Nazwy warstw: RAW / STG / MRT to konwencja spotykana w Snowflake z dbt, Bronze / Silver / Gold to nazwy z architektury medallion.',
  defaultId: 'raw',
  items: [
    {
      id: 'raw', label: 'RAW · Bronze', table: 'raw.billing.payments',
      columns: ['payload (VARIANT)', '_file', '_loaded_at'],
      rows: [
        { cells: ['{"id":"p-101","customer":"c-1","amount":"49.00","currency":"pln","status":"succeeded"}', 'page_001.json', '06:02'] },
        { cells: ['{"id":"p-102","customer":"c-2","amount":"99.00","currency":"PLN","status":"succeeded"}', 'page_001.json', '06:02'] },
        { cells: ['{"id":"p-102","customer":"c-2","amount":"99.00","currency":"PLN","status":"succeeded"}', 'page_002.json', '06:03'], note: 'ten sam rekord drugi raz', flag: true },
        { cells: ['{"id":"p-103","customer":"c-3","amount":"49.00","currency":"PLN","status":"failed"}', 'page_002.json', '06:03'] },
        { cells: ['{"id":"p-104","customer":"c-test","amount":"1.00","currency":"PLN","status":"succeeded"}', 'page_002.json', '06:03'] },
        { cells: ['{"id":"p-105","customer":null,"amount":"29.00","currency":"PLN","status":"succeeded"}', 'page_003.json', '06:03'], note: 'brak klienta', flag: true }
      ],
      did: [
        'Zapisała każdy rekord dokładnie tak, jak przyszedł: kwota jako tekst, waluta raz małymi literami, duplikat, brakujący klient.',
        'Dodała dwie kolumny techniczne: z którego pliku pochodzi wiersz i kiedy został załadowany.'
      ],
      didNot: 'Niczego nie poprawiła i niczego nie odrzuciła. Dzięki temu po znalezieniu błędu w logice jest z czego policzyć dane od nowa.'
    },
    {
      id: 'stg', label: 'STG · Silver', table: 'stg_billing__payments',
      columns: ['payment_id', 'customer_id', 'amount_pln', 'status', '_loaded_at'],
      rows: [
        { cells: ['p-101', 'c-1', '49.00', 'succeeded', '06:02'] },
        { cells: ['p-102', 'c-2', '99.00', 'succeeded', '06:03'] },
        { cells: ['p-103', 'c-3', '49.00', 'failed', '06:03'] },
        { cells: ['p-104', 'c-test', '1.00', 'succeeded', '06:03'] },
        { cells: ['p-105', 'NULL', '29.00', 'succeeded', '06:03'], note: 'kwarantanna: nie przeszedł not_null', flag: true }
      ],
      did: [
        'Wyciągnęła pola z JSON-a do kolumn i nadała im typy: kwota jest liczbą, waluta ma jeden zapis.',
        'Usunęła duplikat: z dwóch wierszy o tym samym <code>payment_id</code> został nowszy.',
        'Odłożyła na bok rekord bez klienta, zamiast go zgubić albo przepuścić dalej.'
      ],
      didNot: 'Nie zdecydowała, co jest przychodem. Płatność nieudana i konto testowe nadal tu są. Odrzucenie ich to reguła biznesowa, a nie techniczne sprzątanie.'
    },
    {
      id: 'mrt', label: 'MRT · Gold', table: 'fct_revenue_daily',
      columns: ['revenue_date', 'payments', 'revenue_pln'],
      rows: [{ cells: ['2026-11-20', '2', '148.00'] }],
      did: [
        'Zastosowała definicję przychodu: tylko płatności udane i nie z kont testowych. Zostały p-101 i p-102.',
        'Zsumowała płatności do postaci, którą czyta dashboard: jeden wiersz na dzień.'
      ],
      didNot: 'Nie sprząta danych technicznie. Jeśli tu trzeba rzutować typy albo usuwać duplikaty, to STG nie zrobiło swojej pracy.'
    }
  ] as Layer[],
  takeaway: '<b>Wniosek.</b> Warstwy rozdzielają trzy pytania. RAW: <b>co przyszło?</b> STG: <b>co to technicznie jest?</b> MRT: <b>co to znaczy dla biznesu?</b> Gdyby RAW zawierało już poprawione dane, błędnej deduplikacji nie dałoby się cofnąć. Gdyby reguła „bez kont testowych" siedziała w STG, każdy raport potrzebujący kont testowych musiałby ją obchodzić.',
  bridge: {
    from: 'dbt',
    known: 'W projekcie dbt masz źródła (<code>sources</code>), modele staging, intermediate i marts. Staging jest jeden do jednego ze źródłem i robi tylko lekkie porządki.',
    fresh: 'Bronze, Silver i Gold opisują podobny podział: surowe, oczyszczone, gotowe dla biznesu. STG odpowiada z grubsza warstwie silver, marts warstwie gold.',
    breaks: 'To analogia, nie mapowanie jeden do jednego. Staging w dbt to zwykle widok, który niczego nie przechowuje, a bronze to trwała, fizyczna kopia surowych danych. dbt opisuje etapy transformacji, medallion poziomy jakości danych.'
  } as Bridge,
  more: {
    title: 'Wierność źródłu i możliwość przeliczenia od nowa',
    html: [
      '<b>Wierność źródłu</b> (source fidelity) znaczy, że RAW przechowuje to, co źródło przysłało, a nie to, co powinno było przysłać. Dlatego kwota zostaje tekstem, a duplikat duplikatem.',
      '<b>Replay</b> to przeliczenie warstw STG i MRT od nowa z RAW, np. po poprawieniu błędu w transformacji. Działa tak daleko wstecz, jak daleko sięga RAW. Jeśli surowe pliki są kasowane po 30 dniach, to 30 dni jest granicą naprawy.',
      'Retencja RAW, czyli to, jak długo trzymasz surowe dane, decyduje więc o tym, jak stary błąd da się jeszcze naprawić. Dłuższa retencja ma swoją cenę: koszt przechowywania i trudniejsze usuwanie danych osobowych, bo surowa kopia też zawiera dane klientów.'
    ]
  } as More
};

/** Zmiana schematu w źródle: jedna zmiana naraz, reakcja każdej warstwy. */
export const schema: Compare & { title: string; intro: string; takeaway: string; more: More } = {
  title: 'Źródło zmieniło schemat. Co powinno się stać?',
  intro: 'Zespół produktu wdraża zmianę w API płatności i nikogo nie uprzedza. Wybierz zmianę i zobacz, jak reaguje każda warstwa.',
  label: 'Co zmieniło źródło',
  assumptions: 'Tak zaprojektowano ten przykład: RAW przyjmuje JSON w kolumnie VARIANT, a STG wybiera kolumny po nazwie i ma testy. Inna konfiguracja zachowa się inaczej.',
  defaultId: 'add',
  options: [
    {
      id: 'add', label: 'Doszło nowe pole',
      rows: [
        ['RAW', 'Przyjmuje. Nowe pole <code>coupon_code</code> jest po prostu w JSON-ie.'],
        ['STG', 'Działa jak wczoraj. Wybiera kolumny po nazwie, więc nowego pola nie widzi, dopóki ktoś go nie doda.'],
        ['MRT i dashboard', 'Bez zmian.'],
        ['Co robisz', 'Nic pilnego. Pole czeka w RAW z pełną historią od dnia, w którym się pojawiło.']
      ],
      verdict: 'Dodanie pola jest bezpieczne, jeśli RAW przyjmuje je automatycznie, a STG wybiera kolumny po nazwie. To jest <b>schema evolution</b>: schemat rośnie, a praca się nie zatrzymuje.'
    },
    {
      id: 'type', label: 'Zmienił się typ',
      rows: [
        ['RAW', 'Przyjmuje. Kwota <code>"49,00"</code> z przecinkiem to nadal poprawny tekst w JSON-ie.'],
        ['STG', 'Zatrzymuje się. Zamiana tekstu na liczbę kończy się błędem albo test wykrywa wartości poza zakresem.'],
        ['MRT i dashboard', 'Nie są przeliczane. Dashboard pokazuje dane z wczoraj, z widoczną datą odświeżenia.'],
        ['Co robisz', 'Poprawiasz parsowanie w STG i przeliczasz od RAW. Nic nie zginęło.']
      ],
      verdict: 'To jest <b>schema enforcement</b>: STG pilnuje typów i zatrzymuje się głośno, zamiast przepuścić zepsute dane. Głośna awaria w STG jest tańsza niż cichy błąd w raporcie finansowym.'
    },
    {
      id: 'drop', label: 'Pole zniknęło',
      rows: [
        ['RAW', 'Przyjmuje. W JSON-ie nie ma już pola <code>status</code>.'],
        ['STG', 'Bez testu: kolumna <code>status</code> wypełnia się wartościami NULL i model kończy się sukcesem. Z testem <code>not_null</code>: zatrzymuje się.'],
        ['MRT i dashboard', 'Bez testu w STG: filtr „tylko udane" odrzuca wszystko i przychód spada do zera. Z testem: zostają dane z wczoraj.'],
        ['Co robisz', 'Rozmawiasz z właścicielem źródła. Tego nie da się naprawić po stronie platformy, bo informacji już nie ma.']
      ],
      verdict: 'Usunięcie pola psuje wszystko, co z niego korzystało. Test na wejściu do STG wykrywa taką zmianę. Zapobiega jej dopiero <b>kontrakt danych</b>: uzgodnienie z właścicielem źródła, które pola i typy są gwarantowane.'
    }
  ],
  takeaway: '<b>Wniosek.</b> RAW przyjmuje wszystko (evolution). STG pilnuje kształtu (enforcement). Ten podział zmniejsza ryzyko, że zmiana w źródle zgubi dane albo po cichu przejdzie do raportu. Nie daje gwarancji: w przypadku „Pole zniknęło" bez testu w STG zero trafia do raportu, a RAW pomaga tylko tak długo, jak przechowuje dane.',
  more: {
    title: 'Jak to wygląda w Snowflake i dbt',
    html: [
      'Kolumna <code>VARIANT</code> przechowuje JSON bez schematu podanego z góry, więc nowe pole nie wymaga zmiany tabeli. Dla tabel ze zwykłymi kolumnami Snowflake ma opcję <code>ENABLE_SCHEMA_EVOLUTION</code>: gdy ładowanie dopasowuje kolumny po nazwie, Snowflake potrafi sam dodać nowe kolumny.',
      'W dbt kształtu modelu pilnuje <b>kontrakt modelu</b> (<code>contract: enforced: true</code>). Zanim dbt zbuduje model, sprawdza, czy nazwy i typy kolumn zgadzają się z tym, co zapisano w YAML. Jeśli nie, przerywa. Testy danych sprawdzają zawartość dopiero po zbudowaniu.',
      'Kontrakt modelu w dbt i kontrakt danych ze źródłem to dwie różne rzeczy. Pierwszy to mechanizm w narzędziu. Drugi to umowa między zespołami: kto, co i z jakim wyprzedzeniem może zmienić.'
    ]
  }
};

/** Kiedy trzy warstwy to za dużo albo za mało. */
export const fewer = {
  title: 'Czy zawsze potrzebujesz trzech warstw?',
  intro: 'Warstwa ma sens, gdy odpowiada na pytanie, na które poprzednia nie odpowiada. Dwie sytuacje: w każdej wybierz, zanim przeczytasz uzasadnienie.',
  ask: 'Co proponujesz?',
  cases: [
    {
      setup: 'Dział sprzedaży raz w miesiącu wgrywa plik CSV z celami sprzedażowymi: 12 wierszy, 3 kolumny, bez duplikatów. Plik jest używany w jednym raporcie.',
      options: ['Pełne RAW, STG, intermediate i MRT, żeby było spójnie', 'Tabela z surowym plikiem i jeden model, który nadaje typy i od razu służy raportowi', 'Wkleić wartości na sztywno do zapytania raportu'],
      correct: 1,
      why: 'Surową kopię warto zachować tak długo, jak pozwalają zasady retencji i ochrony danych osobowych, bo jest tania i pozwala sprawdzić, co wgrano. Osobne STG i MRT nie wnoszą tu jednak nic: nie ma duplikatów, kilku źródeł ani reguł biznesowych do rozdzielenia. Każda dodatkowa warstwa to model do utrzymania, testy i opóźnienie.',
      scope: 'Gdy plik zacznie zasilać kilka raportów albo dojdzie drugie źródło celów, rozdzielenie na STG i MRT zacznie się opłacać. Warstwy dodaje się, gdy pojawia się problem, który rozwiązują.'
    },
    {
      setup: 'Płatności przychodzą z dwóch dostawców w różnych formatach. Trzy zespoły budują z nich własne raporty i każdy sam łączy oba formaty w swoim zapytaniu.',
      options: ['Zostawić, każdy zespół zna swoje potrzeby', 'Dodać wspólną warstwę, która raz ujednolica płatności z obu źródeł', 'Kazać dostawcom ujednolicić format'],
      correct: 1,
      why: 'Ta sama logika techniczna jest napisana w trzech miejscach. Przy pierwszej zmianie formatu każdy zespół poprawi ją po swojemu i wyniki się rozjadą. Brakuje warstwy, która raz, dla wszystkich, odpowiada na pytanie „czym technicznie jest płatność". To rola STG, a gdy logiki jest więcej, także modeli pośrednich (intermediate).',
      scope: 'Wspólna warstwa ujednolica kształt danych, a nie definicje biznesowe. To, czy zwrot pomniejsza przychód, nadal rozstrzyga MRT i właściciel metryki.'
    }
  ] as Scenario[],
  takeaway: '<b>Wniosek.</b> Trzy warstwy to punkt wyjścia, nie przepis. Na rozmowie lepiej brzmi „każda warstwa odpowiada na inne pytanie, a tu wystarczą dwie" niż recytowanie nazw.'
};

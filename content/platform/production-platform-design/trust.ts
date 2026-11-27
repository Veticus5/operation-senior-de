import type { Bridge } from '../../types';
import type { Compare, More } from './shared';

/**
 * Etap 4: Zaufanie. Jakość danych i obserwowalność, poziomy usług, odtwarzanie po awarii, dane osobowe
 * i własność. Incydenty, liczby i role są wymyślone.
 */
export const opening = {
  html: '<h1>Pipeline jest zielony. Skąd wiesz, że dane są dobre?</h1>\n<p class="lede">Job, który załadował zero wierszy, kończy się sukcesem. Job, który policzył zwroty jako przychód, też. Status mówi, że kod się wykonał. O danych nie mówi nic.</p>\n<p>Dane mogą być złe na cztery sposoby: <b>spóźnione</b> (świeżość), <b>niepełne</b> (kompletność), <b>błędne</b> (dokładność) albo <b>sprzeczne między sobą</b> (spójność). Każdy z nich łapie się czym innym.</p>'
};

export type Catch = 'yes' | 'maybe' | 'no';
export interface Incident {
  id: string;
  label: string;
  story: string;
  /** Który wymiar jakości jest naruszony. */
  dimension: string;
  /** Odpowiedź każdego mechanizmu, w kolejności `mechanisms`. */
  catches: { by: Catch; why: string }[];
  lesson: string;
}

/** Pięć incydentów i cztery mechanizmy. Żaden mechanizm nie łapie wszystkiego: na tym stoi wniosek. */
export const incidents = {
  question: 'Kto to złapie, zanim zobaczy to dyrektor finansowy?',
  intro: 'Pięć incydentów z życia platformy. Wybierz incydent i sprawdź, który mechanizm by go wykrył.',
  assumptions: 'Ilustracja. „Może" oznacza: zależy od konfiguracji i od tego, jak duże jest odchylenie.',
  label: 'Incydent',
  defaultId: 'null',
  mechanisms: [
    { id: 'test', label: 'Test dbt napisany z góry', what: 'Reguła, którą ktoś przewidział: klucz jest unikalny, pole nie jest puste, wartość należy do listy.' },
    { id: 'monitor', label: 'Monitor świeżości i wolumenu', what: 'Automatyczne porównanie z tym, jak tabela zachowywała się dotąd: kiedy się odświeża i ile wierszy przybywa.' },
    { id: 'recon', label: 'Uzgodnienie ze źródłem', what: 'Porównanie liczby wierszy i sum z niezależnym systemem, np. z systemem płatności.' },
    { id: 'owner', label: 'Jedna definicja i właściciel', what: 'Metryka ma jedno miejsce w kodzie i osobę, która odpowiada za jej znaczenie.' }
  ],
  items: [
    {
      id: 'null', label: 'Puste customer_id',
      story: 'Po zmianie w API 2% płatności przychodzi bez identyfikatora klienta.',
      dimension: 'Kompletność (pole)',
      catches: [
        { by: 'yes', why: 'Test <code>not_null</code> na kluczu obcym pada przy pierwszym takim wierszu.' },
        { by: 'no', why: 'Tabela odświeża się o czasie i ma zwykłą liczbę wierszy.' },
        { by: 'no', why: 'Liczba płatności i suma kwot zgadzają się ze źródłem.' },
        { by: 'no', why: 'Definicje nie mają tu nic do rzeczy.' }
      ],
      lesson: 'Znany rodzaj błędu łapie tani, jawny test. Do tego służy <b>jakość danych</b>: sprawdzanie reguł, które umiesz zapisać.'
    },
    {
      id: 'stale', label: 'Tabela stoi od wczoraj',
      story: 'Job pobierający płatności kończy się sukcesem, ale API zwróciło pustą listę. Nic nie przybyło.',
      dimension: 'Świeżość',
      catches: [
        { by: 'no', why: 'Wczorajsze wiersze nadal są unikalne i niepuste. Testy przechodzą na starych danych.' },
        { by: 'yes', why: 'Tabela zwykle odświeża się co noc, a dziś nie. To pierwsza rzecz, jaką wykrywa monitor świeżości.' },
        { by: 'yes', why: 'Źródło ma płatności z dzisiejszej nocy, platforma nie.' },
        { by: 'no', why: 'Definicje nie mają tu nic do rzeczy.' }
      ],
      lesson: 'Test sprawdza dane, które są. Nie zauważy danych, których nie ma. Do tego potrzebna jest kontrola świeżości.'
    },
    {
      id: 'volume', label: 'Przyszło 40% wierszy',
      story: 'Jeden region aplikacji przestał wysyłać zdarzenia. Reszta działa, wiersze są poprawne.',
      dimension: 'Kompletność (wiersze)',
      catches: [
        { by: 'no', why: 'Każdy wiersz, który przyszedł, spełnia wszystkie reguły.' },
        { by: 'yes', why: 'Liczba nowych wierszy wyraźnie odbiega od tego, co tabela dostaje zwykle.' },
        { by: 'maybe', why: 'Tak, jeśli istnieje niezależne źródło liczby zdarzeń. Dla zdarzeń z aplikacji często go nie ma.' },
        { by: 'no', why: 'Definicje nie mają tu nic do rzeczy.' }
      ],
      lesson: 'Nikt nie napisał testu „dziś ma przyjść co najmniej 70 mln wierszy". Monitor nie potrzebuje reguły: uczy się normy z historii. Do tego służy <b>obserwowalność danych</b>.'
    },
    {
      id: 'logic', label: 'Zwroty liczone jako przychód',
      story: 'Zmiana w kodzie modelu sprawia, że zwroty są dodawane zamiast odejmowane.',
      dimension: 'Dokładność',
      catches: [
        { by: 'maybe', why: 'Tylko jeśli ktoś wcześniej napisał test tej reguły. Testy kluczy i pustych pól przechodzą.' },
        { by: 'maybe', why: 'Wiersze przychodzą o czasie i w zwykłej liczbie. Monitor rozkładu wartości mógłby zauważyć skok, jeśli jest dość duży.' },
        { by: 'yes', why: 'Suma przychodu za dzień nie zgadza się z systemem płatności.' },
        { by: 'no', why: 'Definicja jest jedna, tylko źle zapisana.' }
      ],
      lesson: 'Błąd logiki daje dane poprawne technicznie i błędne merytorycznie. Najpewniej łapie go porównanie z niezależnym źródłem i przegląd kodu przed wdrożeniem.'
    },
    {
      id: 'mismatch', label: 'Dwa dashboardy, dwa MRR',
      story: 'Dashboard finansów i dashboard sprzedaży pokazują różny MRR za ten sam miesiąc. Oba są „poprawne".',
      dimension: 'Spójność',
      catches: [
        { by: 'no', why: 'Oba modele przechodzą własne testy.' },
        { by: 'no', why: 'Obie tabele odświeżają się normalnie.' },
        { by: 'maybe', why: 'Uzgodnienie pokaże, który wynik zgadza się z systemem płatności, ale nie rozstrzygnie, która definicja jest właściwa.' },
        { by: 'yes', why: 'Gdyby MRR miał jedno miejsce w kodzie i jednego właściciela, drugi dashboard nie liczyłby go po swojemu.' }
      ],
      lesson: 'To nie jest awaria techniczna, tylko brak decyzji. Żadne narzędzie nie naprawi metryki, która ma dwie definicje.'
    }
  ] as Incident[],
  takeaway: '<b>Wniosek.</b> <b>Jakość danych</b> to reguły znane z góry, sprawdzane testami. <b>Obserwowalność danych</b> to wykrywanie odchyleń, których nikt nie przewidział, i szybkie ustalenie, skąd się wzięły. Potrzebujesz obu, a do tego uzgodnienia ze źródłem dla liczb, na których ktoś podejmuje decyzje finansowe.',
  bridge: {
    from: 'dbt',
    known: 'W dbt znasz testy <code>unique</code>, <code>not_null</code>, <code>accepted_values</code> i <code>relationships</code> oraz kontrolę świeżości źródeł z progami <code>warn_after</code> i <code>error_after</code>.',
    fresh: 'Narzędzie obserwowalności, np. Monte Carlo, robi podobne kontrole świeżości, wolumenu i zmian schematu, ale bez pisania progu dla każdej tabeli: normę wyznacza z historii metadanych.',
    breaks: 'Test dbt działa w trakcie przebiegu i może go zatrzymać, zanim złe dane pójdą dalej. Monitor działa obok pipeline\'u i alarmuje po fakcie. Jedno nie zastępuje drugiego, a szczegóły konfiguracji zależą od narzędzia.'
  } as Bridge,
  more: {
    title: 'Lineage i kontrakty danych',
    html: [
      '<b>Lineage</b> to mapa zależności: z których tabel i kolumn powstaje dana tabela i co z niej korzysta dalej. Odpowiada na dwa pytania podczas incydentu: skąd wziął się błąd (w górę) i kogo trzeba zawiadomić (w dół). dbt buduje lineage modeli z odwołań <code>ref</code> i <code>source</code>.',
      '<b>Kontrakt danych</b> to uzgodnienie między tym, kto dane wytwarza, a tym, kto je czyta: jakie pola i typy są gwarantowane, jaka świeżość, kto odpowiada i jak zapowiada się zmiany. Zamienia awarię o 3:00 w rozmowę przed wdrożeniem.',
      'Kontrakt bez egzekwowania jest dokumentem. Egzekwuje go test na wejściu platformy, a po stronie źródła najlepiej sprawdzenie w procesie wdrożeniowym, które nie przepuści zmiany łamiącej kontrakt.'
    ]
  } as More
};

/** SLI, SLO, SLA na jednym przykładzie i budżet błędów dla 90 nocnych przebiegów w kwartale. */
export const slo = {
  title: '„Dane mają być na 7:00". Zawsze?',
  intro: 'Finanse chcą dashboardu MRR codziennie o 7:00. Trzy pojęcia porządkują tę rozmowę. <b>SLI</b> to to, co mierzysz: godzina, o której dane były gotowe. <b>SLO</b> to cel dla tej miary: gotowe przed 7:00 w ustalonym odsetku dni. <b>SLA</b> to umowa z odbiorcą, która mówi, co się dzieje, gdy cel nie jest spełniony.',
  runsPerQuarter: 90,
  label: 'Cel (SLO): gotowe przed 7:00 w … dni',
  assumptions: 'Rachunek dla 90 nocnych przebiegów w kwartale. Dozwolone spóźnienia to część całkowita z 90 × (100% − cel).',
  defaultTarget: 95,
  targets: [
    { pct: 90, verdict: 'Dziewięć spóźnień na kwartał. Taki cel wytrzyma pojedynczy pipeline bez dyżurów, z ponowieniami i alertem rano.' },
    { pct: 95, verdict: 'Cztery spóźnienia na kwartał. Wymaga automatycznych ponowień, alertów w nocy i szybkiej naprawy, ale nie nadmiarowej infrastruktury.' },
    { pct: 99, verdict: 'Zero dozwolonych spóźnień w kwartale, bo 90 × 1% to mniej niż jedno. Każda awaria źródła łamie cel, więc potrzebny jest zapas czasu, dyżur i zapasowa ścieżka danych.' },
    { pct: 99.9, verdict: 'Mniej niż jedno spóźnienie na dziesięć kwartałów. Dla nocnego batcha zależnego od cudzego API to obietnica bez pokrycia, niezależnie od budżetu.' }
  ],
  takeaway: '<b>Wniosek.</b> Każda kolejna dziewiątka kosztuje wielokrotnie więcej niż poprzednia. Cel uzgadnia się z odbiorcą, pytając, ile kosztuje go spóźnienie, a nie zgadując „jak najwięcej". To, ile spóźnień cel dopuszcza, nazywa się budżetem błędów: dopóki jest, można wdrażać zmiany, a gdy się kończy, priorytetem staje się stabilność.',
  more: {
    title: 'Jak wybrać dobry SLI dla danych',
    html: [
      'Dobry SLI mierzy to, co widzi odbiorca, a nie to, co łatwo zmierzyć. „Job zakończył się przed 6:30" to miara pipeline\'u. „Dane w tabeli dashboardu są z dzisiejszej nocy i przeszły testy o 7:00" to miara usługi.',
      'Typowe SLI dla platformy danych: świeżość (wiek najnowszych danych), kompletność (odsetek oczekiwanych wierszy), poprawność (odsetek przebiegów, w których przeszły testy krytyczne).',
      'Definicje SLI, SLO i SLA pochodzą z praktyki niezawodności usług opisanej przez Google. Dla danych stosuje się je tak samo, tylko „usługą" jest tabela albo dashboard.'
    ]
  } as More
};

/** RPO i RTO oraz trzy poziomy zabezpieczenia. Czasy są ilustracyjne, fakty o Snowflake z dokumentacji. */
export const recovery: Compare & { title: string; intro: string; takeaway: string; more: More } = {
  title: 'Ktoś uruchomił UPDATE bez WHERE na produkcji. Ile tracisz?',
  intro: 'Dwie liczby opisują każdą katastrofę. <b>RPO</b> (recovery point objective) to ile danych możesz stracić, liczone w czasie: jak stary jest ostatni punkt, do którego umiesz wrócić. <b>RTO</b> (recovery time objective) to jak długo może trwać przywracanie. Obie ustala biznes, a architektura ma je spełnić.',
  label: 'Zabezpieczenie',
  assumptions: 'Czasy są ilustracyjne i zależą od rozmiaru danych. Okresy retencji i wymagane edycje pochodzą z dokumentacji Snowflake.',
  defaultId: 'reload',
  options: [
    {
      id: 'reload', label: 'Tylko ponowne ładowanie ze źródeł',
      rows: [
        ['Błąd człowieka w tabeli', 'Odtwarzasz to, co źródła nadal mają. API płatności oddaje np. tylko ostatnie 90 dni'],
        ['Awaria regionu chmury', 'Czekasz na przywrócenie regionu'],
        ['RPO', 'Nieznane: zależy od retencji w cudzych systemach'],
        ['RTO', 'Dni: pełne ładowanie wszystkich źródeł i przeliczenie wszystkich warstw'],
        ['Koszt', 'Zerowy, dopóki nic się nie stanie']
      ],
      verdict: 'To brak planu, a nie plan. Historia starsza niż retencja źródeł jest nie do odzyskania.'
    },
    {
      id: 'history', label: 'Historia tabel i surowe pliki',
      rows: [
        ['Błąd człowieka w tabeli', 'Cofasz tabelę do stanu sprzed błędu funkcją <term id="time-travel">Time Travel</term> albo przeliczasz ją z plików w S3'],
        ['Awaria regionu chmury', 'Czekasz na przywrócenie regionu. Dane są bezpieczne, ale niedostępne'],
        ['RPO', 'Bliskie zeru dla błędów wykrytych w okresie retencji'],
        ['RTO', 'Minuty do godzin dla pojedynczej tabeli'],
        ['Koszt', 'Przechowywanie historii: rośnie z okresem retencji i częstością zmian']
      ],
      verdict: 'Chroni przed najczęstszą katastrofą, czyli błędem człowieka albo wdrożenia. Warunek: błąd trzeba zauważyć, zanim minie retencja. Domyślnie to 1 dzień.'
    },
    {
      id: 'replica', label: 'Replikacja do drugiego regionu',
      rows: [
        ['Błąd człowieka w tabeli', 'Nie chroni sama z siebie: błędny UPDATE zostanie zreplikowany. Nadal potrzebujesz historii tabel'],
        ['Awaria regionu chmury', 'Przełączasz się na kopię w drugim regionie'],
        ['RPO', 'Do dwukrotności odstępu między odświeżeniami kopii'],
        ['RTO', 'Minuty do godzin, jeśli przełączenie jest przećwiczone'],
        ['Koszt', 'Drugie przechowywanie, transfer między regionami i wyższa edycja usługi']
      ],
      verdict: 'Odpowiada na inną katastrofę niż historia tabel. Uzasadniona, gdy godzina niedostępności platformy kosztuje więcej niż utrzymanie drugiego regionu.'
    }
  ],
  takeaway: '<b>Wniosek.</b> Replikacja to nie kopia zapasowa: wiernie kopiuje także pomyłki. Błąd człowieka i awaria regionu to dwa różne ryzyka i dwa różne zabezpieczenia. Na rozmowie zacznij od pytania, jakie RPO i RTO są wymagane dla których danych, bo dashboard marketingu i raport dla regulatora rzadko mają te same.',
  more: {
    title: 'Fakty o Snowflake i AWS, które warto znać',
    html: [
      '<b>Time Travel</b>: standardowa retencja to 1 dzień. Dla tabel trwałych można ją wydłużyć do 90 dni w edycji Enterprise lub wyższej. Tabele przejściowe (transient) i tymczasowe mają najwyżej 1 dzień.',
      '<b>Fail-safe</b>: 7 dni po zakończeniu Time Travel dla tabel trwałych. Dane może z niego odzyskać tylko Snowflake, więc nie jest to narzędzie do codziennego cofania zmian. Tabele przejściowe go nie mają.',
      '<b>Replikacja</b> baz działa między regionami i chmurami. Przełączenie awaryjne (failover) wymaga edycji Business Critical lub wyższej. Kopia jest opóźniona najwyżej o dwukrotność odstępu między zaplanowanymi odświeżeniami.',
      '<b>S3</b> jest projektowany na trwałość 99,999999999% obiektów w roku, a wersjonowanie zachowuje poprzednie wersje nadpisanych i usuniętych plików. Trwałość nie chroni przed skasowaniem danych przez uprawnionego użytkownika, wersjonowanie tak.',
      'AWS wymienia cztery strategie odtwarzania, od najtańszej do najszybszej: backup and restore, pilot light, warm standby i multi-site active/active.'
    ]
  }
};

export interface RoleView {
  id: string;
  label: string;
  /** Do czego ta rola potrzebuje danych. */
  need: string;
  rows: string[][];
  note: string;
}

/** Te same trzy wiersze widziane przez trzy role. Dane wymyślone. */
export const access = {
  title: 'Czy analityk musi widzieć adres e-mail klienta?',
  intro: 'Tabela klientów zawiera dane osobowe (PII, personally identifiable information): dane, które pozwalają wskazać konkretną osobę. Ta sama tabela, to samo zapytanie, trzy role. Przełącz rolę.',
  assumptions: 'Ilustracja zachowania polityk maskowania kolumn i filtrowania wierszy. Dane wymyślone.',
  label: 'Kto pyta',
  query: 'select customer_id, email, country, plan, mrr_pln\nfrom mrt.dim_customers',
  columns: ['customer_id', 'email', 'country', 'plan', 'mrr_pln'],
  defaultId: 'analyst',
  roles: [
    {
      id: 'analyst', label: 'Analityk produktu',
      need: 'Liczy konwersję i churn według planu i kraju. Nie kontaktuje się z klientami.',
      rows: [['c-1', '*****', 'PL', 'premium', '49.00'], ['c-2', '*****', 'DE', 'family', '99.00'], ['c-3', '*****', 'PL', 'basic', '29.00']],
      note: 'Widzi wszystkie wiersze, ale adres e-mail jest zamaskowany. Do analizy wystarczy identyfikator.'
    },
    {
      id: 'support', label: 'Obsługa klienta (PL)',
      need: 'Odpowiada na zgłoszenia klientów z Polski. Musi znaleźć klienta po adresie e-mail.',
      rows: [['c-1', 'anna@example.com', 'PL', 'premium', '49.00'], ['c-3', 'jan@example.com', 'PL', 'basic', '29.00']],
      note: 'Widzi adres e-mail, ale tylko klientów ze swojego kraju. Wiersz z Niemiec dla tej roli nie istnieje.'
    },
    {
      id: 'loader', label: 'Konto techniczne dbt',
      need: 'Buduje modele. Czyta RAW i STG, zapisuje do MRT.',
      rows: [['c-1', 'anna@example.com', 'PL', 'premium', '49.00'], ['c-2', 'karl@example.com', 'DE', 'family', '99.00'], ['c-3', 'jan@example.com', 'PL', 'basic', '29.00']],
      note: 'Widzi wszystko, bo musi to przetworzyć. Dlatego nie loguje się na nie żaden człowiek, a jego uprawnienia są ograniczone do schematów, które buduje.'
    }
  ] as RoleView[],
  takeaway: '<b>Wniosek.</b> <b>Zasada najmniejszych uprawnień</b>: każda rola dostaje dokładnie tyle, ile wymaga jej praca. Ochrona działa na poziomie platformy, a nie zapytania: autor raportu nie musi pamiętać o ukryciu adresu e-mail, bo jego rola nigdy go nie dostaje.',
  more: {
    title: 'Jak to się robi w Snowflake i gdzie leży PII w warstwach',
    html: [
      'Uprawnienia nadaje się rolom, a role użytkownikom. Polityka maskowania jest przypięta do kolumny i stosowana w chwili zapytania wszędzie, gdzie kolumna się pojawia. Polityka dostępu do wierszy filtruje wiersze według roli. Obie funkcje wymagają edycji Enterprise lub wyższej.',
      'Warstwy pomagają także tutaj. RAW zawiera dane osobowe w pełnej postaci, więc dostęp do niego mają tylko konta techniczne i wąska grupa inżynierów. MRT udostępniany analitykom zawiera dane zamaskowane albo zagregowane.',
      'Prawo do usunięcia danych osoby dotyczy każdej kopii, także RAW, plików w S3 i historii tabel. Długa retencja RAW, która ułatwia backfill, utrudnia usuwanie. To jest konflikt, który trzeba rozstrzygnąć świadomie, np. oddzielając dane osobowe od zdarzeń i łącząc je kluczem.'
    ]
  } as More
};

/** Własność danych: krótka sekcja tekstowa, bez interakcji. */
export const ownership = {
  title: 'Kto odbiera telefon, gdy tabela jest zła?',
  points: [
    '<b>Właściciel źródła</b> odpowiada za to, co system wysyła, i za zapowiadanie zmian. Zwykle to zespół produktowy, nie zespół danych.',
    '<b>Właściciel pipeline\'u</b> odpowiada za to, że dane docierają na czas i w całości. Dostaje alerty o świeżości i wolumenie.',
    '<b>Właściciel metryki</b> odpowiada za definicję: co to jest aktywny klient, czy zwrot pomniejsza przychód. To osoba z biznesu, nie inżynier.'
  ],
  takeaway: '<b>Wniosek.</b> Tabela bez właściciela to tabela, której awarii nikt nie naprawi. W projekcie platformy własność jest elementem architektury: zapisuje się ją przy tabeli i kieruje nią alerty.'
};

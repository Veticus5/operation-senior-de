import type { Bridge, ExplainedLine, LessonMeta } from '../../types';

/**
 * Lekcja: Advanced Data Modeling & Dimensional Architecture.
 *
 * Jeden przykład od początku do końca: platforma subskrypcyjna, na której wydawcy (publishers) sprzedają
 * klientom dostęp do produktów. Dane są wymyślone i bardzo małe, żeby każdą liczbę dało się policzyć w głowie.
 *
 * Skąd są fakty (docs/verified-facts.md, sekcja „Lekcja: Advanced Data Modeling"):
 * - techniki modelowania wymiarowego: strony „Dimensional Modeling Techniques" Kimball Group,
 * - Power BI: Microsoft Learn (star schema, relacje, RLS, agregacje),
 * - Looker: dokumentacja Google Cloud (symmetric aggregates, relationship, access_filter, aggregate awareness),
 * - dbt snapshots i MetricFlow, Snowflake ASOF JOIN, glosariusz Databricks (Data Vault),
 * - liczby przykładu: labs/data_modeling/modeling_sql_check.py (SQLite) oraz test lesson.test.ts.
 *
 * Wszystkie interaktywne ilustracje liczą wynik w przeglądarce z danych poniżej. To ilustracje, nie pomiary.
 * Pytania rekrutacyjne, krótkie odpowiedzi i follow-upy przychodzą z Interview Banku (interviewTopics).
 */
export const meta: LessonMeta = {
  id: 'data-modeling-dimensional',
  topicId: 'modeling.dimensional',
  area: 'data-modeling',
  title: 'Advanced Data Modeling & Dimensional Architecture',
  subtitle: 'Ziarno, fakty i wymiary, historia zmian oraz warstwa semantyczna na jednym przykładzie subskrypcji. Tak, żeby umieć obronić każdą decyzję.',
  minutes: 90
};

/** Zagadnienia ćwiczone w etapie Interview. Pierwsze musi być zagadnieniem lekcji. */
export const interviewTopics = [
  'modeling.dimensional',
  'modeling.fan-out',
  'modeling.fact-types',
  'modeling.scd',
  'modeling.late-arriving',
  'modeling.semantic-layer',
  'modeling.methodologies'
];

/** Prosta tabela do pokazania: nagłówki i wiersze. */
export interface SampleTable {
  name: string;
  columns: string[];
  rows: (string | number)[][];
}

/* ------------------------------------------------------------------ dane przykładu */

export interface Txn { id: string; date: string; sub: string; type: 'payment' | 'refund'; amount: number }
export interface Sub { id: string; customer: string; product: string; mrr: number }
export interface CustomerVersion { key: number; customer: string; name: string; country: string; from: string; to: string; current: boolean }

/** Koniec otwartego przedziału ważności. */
export const OPEN_END = '9999-12-31';

export const data = {
  currency: 'EUR',
  publishers: [
    { key: 1, id: 'PUB-AUR', name: 'Aurora Sport', tier: 'enterprise' },
    { key: 2, id: 'PUB-KIN', name: 'Kino Nord', tier: 'growth' }
  ],
  products: [
    { key: 1, id: 'SPORT-M', name: 'Sport Monthly', period: 'monthly', price: 10, publisher: 'PUB-AUR' },
    { key: 2, id: 'SPORT-Y', name: 'Sport Annual', period: 'annual', price: 96, publisher: 'PUB-AUR' },
    { key: 3, id: 'KINO-M', name: 'Kino Monthly', period: 'monthly', price: 8, publisher: 'PUB-KIN' }
  ],
  /** Stan na koniec lutego 2026: cztery aktywne subskrypcje. MRR to miesięczny przychód powtarzalny (roczna za 96 daje 8). */
  subscriptions: [
    { id: 'S-1', customer: 'C-101', product: 'SPORT-M', mrr: 10 },
    { id: 'S-2', customer: 'C-102', product: 'SPORT-M', mrr: 10 },
    { id: 'S-3', customer: 'C-102', product: 'KINO-M', mrr: 8 },
    { id: 'S-4', customer: 'C-103', product: 'SPORT-Y', mrr: 8 }
  ] as Sub[],
  transactions: [
    { id: 'T-1', date: '2026-01-05', sub: 'S-1', type: 'payment', amount: 10 },
    { id: 'T-2', date: '2026-01-15', sub: 'S-2', type: 'payment', amount: 10 },
    { id: 'T-3', date: '2026-01-20', sub: 'S-4', type: 'payment', amount: 96 },
    { id: 'T-4', date: '2026-02-01', sub: 'S-3', type: 'payment', amount: 8 },
    { id: 'T-5', date: '2026-02-05', sub: 'S-1', type: 'payment', amount: 10 },
    { id: 'T-6', date: '2026-02-15', sub: 'S-2', type: 'payment', amount: 10 },
    { id: 'T-7', date: '2026-03-01', sub: 'S-3', type: 'payment', amount: 8 },
    { id: 'T-8', date: '2026-03-05', sub: 'S-1', type: 'payment', amount: 10 },
    { id: 'T-9', date: '2026-03-15', sub: 'S-2', type: 'payment', amount: 10 },
    { id: 'T-10', date: '2026-03-18', sub: 'S-2', type: 'refund', amount: -10 }
  ] as Txn[],
  /** Wymiar klienta z historią. Ben (C-102) przeprowadza się z Niemiec do Polski 10 lutego 2026. Przedziały: [from, to). */
  customerVersions: [
    { key: 1, customer: 'C-101', name: 'Anna', country: 'PL', from: '2026-01-05', to: OPEN_END, current: true },
    { key: 2, customer: 'C-102', name: 'Ben', country: 'DE', from: '2026-01-08', to: '2026-02-10', current: false },
    { key: 3, customer: 'C-103', name: 'Chloé', country: 'FR', from: '2026-01-20', to: OPEN_END, current: true },
    { key: 4, customer: 'C-102', name: 'Ben', country: 'PL', from: '2026-02-10', to: OPEN_END, current: true }
  ] as CustomerVersion[],
  /** Stan na koniec miesiąca: jeden wiersz na subskrypcję aktywną w tym dniu. */
  snapshot: [
    { month: '2026-01-31', sub: 'S-1', mrr: 10 }, { month: '2026-01-31', sub: 'S-2', mrr: 10 }, { month: '2026-01-31', sub: 'S-4', mrr: 8 },
    { month: '2026-02-28', sub: 'S-1', mrr: 10 }, { month: '2026-02-28', sub: 'S-2', mrr: 10 }, { month: '2026-02-28', sub: 'S-3', mrr: 8 }, { month: '2026-02-28', sub: 'S-4', mrr: 8 },
    { month: '2026-03-31', sub: 'S-1', mrr: 10 }, { month: '2026-03-31', sub: 'S-3', mrr: 8 }, { month: '2026-03-31', sub: 'S-4', mrr: 8 }
  ],
  /** Koniec lutego: granica, do której liczy pierwszy etap. */
  febEnd: '2026-03-01'
};

/* ------------------------------------------------------------------ etap 1: Intuicja */

export interface Beat {
  html: string;
  visual?: 'star' | 'grain' | 'fanout';
  after?: string;
  next: string;
  bridge?: Bridge;
  more?: { title: string; html: string[] };
}

export const beats: Beat[] = [
  {
    html: '<h1>Jedno pytanie, trzy liczby</h1>\n<p class="lede">Platforma subskrypcyjna: wydawcy sprzedają klientom dostęp do swoich produktów. Na spotkaniu pada pytanie „ile mamy z subskrypcji w lutym?”. Trzy osoby przynoszą trzy liczby: <b>28</b>, <b>36</b> i <b>56 EUR</b>.</p>\n<p>Nikt nie pomylił się w rachunkach. 28 to wpłaty, które przyszły w lutym. 36 to suma miesięcznych opłat aktywnych subskrypcji na koniec lutego. 56 to zapytanie z błędem, który znajdziesz za chwilę. Zanim powstanie jakakolwiek tabela, trzeba ustalić, <b>co dokładnie opisuje jeden jej wiersz</b>.</p>\n<p>Poniżej jest model, który na te pytania odpowiada. Kliknij tabelę, żeby zobaczyć jej wiersze. W tabeli pośrodku kliknij wiersz, żeby zobaczyć, co mówią o nim tabele dookoła.</p>',
    visual: 'star',
    after: '<b>Wniosek.</b> Tabela pośrodku to <b>tabela faktów</b> (fact table). Jeden jej wiersz to jedno zdarzenie, które da się zmierzyć. Tutaj to wpłata albo zwrot. Tabele dookoła to <b>wymiary</b> (dimensions). Opisują, kto, co, kiedy i u kogo. Fakty się sumuje. Po wymiarach się filtruje i grupuje. Taki układ nazywa się <b>star schema</b>, czyli schemat gwiazdy.',
    bridge: {
      from: 'dbt',
      known: 'W projekcie dbt masz warstwę marts z modelami <code>fct_</code> i <code>dim_</code>. Często powstają z tego, co akurat było potrzebne do raportu.',
      fresh: 'To te same tabele, ale z jasnymi zasadami. Wiadomo, co opisuje jeden wiersz faktu. Wymiar ma jeden wiersz na klienta albo produkt, a gdy zapisuje historię, jeden wiersz na każdą jego wersję. Każdy klucz obcy w fakcie wskazuje dokładnie jeden wiersz wymiaru.',
      breaks: 'Sam prefiks <code>fct_</code> niczego nie gwarantuje. Model dbt może mieszać dwa poziomy szczegółowości albo mieć zduplikowane klucze i nadal się zbuduje. Te zasady trzeba zapisać i sprawdzać, na przykład testem unikalności klucza.'
    },
    more: {
      title: 'Dlaczego gwiazda, a nie jedna szeroka tabela albo model znormalizowany',
      html: [
        'Model znormalizowany, taki jak w systemie źródłowym, trzyma każdą informację w jednym miejscu. To dobre do zapisu. Do analizy jest niewygodne: jedno pytanie wymaga wielu złączeń i łatwo o takie, które powiela wiersze.',
        'Jedna szeroka tabela jest wygodna dla jednego raportu. Kłopot zaczyna się przy pięciu raportach, w których ten sam klient albo produkt ma być opisany tak samo. Drugi kłopot: opis się zmienia i trzeba zdecydować, czy przepisać historię.',
        'Gwiazda jest kompromisem. Liczby, które się analizuje, są w jednym miejscu, a opisy w osobnych, małych tabelach. Każde złączenie idzie od faktu do wymiaru: wiele wierszy faktu wskazuje jeden wiersz wymiaru. To relacja wiele do jednego, więc złączenie nie powiela wierszy faktu.'
      ]
    },
    next: 'Skąd wiadomo, co ma opisywać jeden wiersz?'
  },
  {
    html: '<h2>Ziarno: co opisuje jeden wiersz</h2>\n<p>Biznes ma trzy pytania. Wybierz, co ma opisywać jeden wiersz tabeli faktów, i sprawdź, na które pytania taka tabela odpowie.</p>',
    visual: 'grain',
    after: '<b>Wniosek.</b> To, co opisuje jeden wiersz tabeli faktów, nazywa się <b>ziarnem</b> (grain). Ziarno ustala się najpierw, przed wymiarami i przed miarami, czyli liczbami, które się analizuje. Nie każdą miarę wolno sumować (odsetek, stan z migawki): o tym w etapie Fakty i wymiary. Każdy wymiar i każda miara muszą do niego pasować. Żadne z czterech ziaren nie odpowiedziało na wszystkie trzy pytania. Zdarzenia i stan na koniec miesiąca to dwa różne ziarna, więc potrzebne są <b>dwie tabele faktów</b>. Dwóch ziaren nie miesza się w jednej tabeli.',
    more: {
      title: 'Cztery kroki projektowania według Kimballa',
      html: [
        'Kimball Group opisuje projekt modelu jako cztery decyzje: <b>1.</b> wybierz proces biznesowy (tu: płatności za subskrypcje), <b>2.</b> zadeklaruj ziarno, <b>3.</b> wskaż wymiary, <b>4.</b> wskaż fakty, czyli miary.',
        'Zalecenie: zacznij od najbardziej szczegółowego poziomu, jaki rejestruje proces. To <b>ziarno atomowe</b> (atomic grain). Ze szczegółu zawsze policzysz sumę. Z sumy szczegółu nie odtworzysz. Tabele z gotowymi sumami są dodatkiem dla wydajności, a nie punktem wyjścia.',
        'Na rozmowie zdanie „jeden wiersz to jedna wpłata albo zwrot” powiedz jako pierwsze. To sygnał, że projektujesz od pytania biznesowego, a nie od tego, jakie kolumny były w źródle.'
      ]
    },
    next: 'A skąd wzięło się 56?'
  },
  {
    html: '<h2>Skąd wzięło się 56</h2>\n<p>Ktoś chciał jednym zapytaniem policzyć dwie rzeczy: przychód i MRR (monthly recurring revenue), czyli sumę miesięcznych opłat aktywnych subskrypcji. Złączył tabelę subskrypcji z transakcjami. Porównaj oba zapytania i zobacz, co dzieje się z wierszami.</p>',
    visual: 'fanout',
    after: '<b>Wniosek.</b> Subskrypcja S-1 ma dwie transakcje. Po złączeniu jej wiersz występuje więc dwa razy i jej MRR liczy się podwójnie. To jest <b>fan-out</b>: jeden wiersz pasuje do wielu wierszy po drugiej stronie złączenia, więc zostaje powielony, a suma powielonej miary może wyjść zawyżona. Kino Nord wygląda poprawnie, bo ma jedną transakcję. Błąd nie rozkłada się równo i dlatego trudno go zauważyć na oko. Lekarstwo: najpierw sprowadź obie strony do tego samego ziarna, potem łącz.',
    more: {
      title: 'Jak rozpoznać fan-out, zanim trafi na dashboard',
      html: [
        'Zapytaj o każde złączenie: ile wierszy po prawej stronie może pasować do jednego wiersza po lewej? Jeśli więcej niż jeden, każda liczba sumowana z lewej strony może się policzyć kilka razy.',
        'Sprawdź liczbę wierszy przed złączeniem i po nim. Jeśli fakt miał 4 wiersze, a po złączeniu z wymiarem ma 6, klucz wymiaru nie jest unikalny.',
        '<code>SELECT DISTINCT</code> albo <code>COUNT(DISTINCT ...)</code> ukrywa problem przy zliczaniu, ale nie naprawia sum. Dwie różne subskrypcje o tym samym MRR zlałyby się w jedną.',
        'Dwie tabele faktów o różnym ziarnie łączy się przez wspólne wymiary, a nie bezpośrednio. Każdą sumuje się osobno do tego samego poziomu, na przykład wydawcy. Dopiero te wyniki zestawia się obok siebie. Kimball nazywa to <b>drill-across</b>.'
      ]
    },
    next: 'Jakie są rodzaje tabel faktów?'
  }
];

/** Ilustracja z pierwszego kroku: gwiazda z przykładowymi wierszami. Układ rysuje komponent StarSchema. */
export const star = {
  assumptions: 'Ilustracja: sześć transakcji ze stycznia i lutego 2026. Dane są wymyślone. Klucze z końcówką <code>_key</code> to numery nadane w hurtowni.',
  fact: {
    name: 'fact_transaction',
    role: 'Tabela faktów. Jeden wiersz to jedna wpłata albo zwrot. Zawiera klucze do wymiarów i miarę <code>amount_eur</code>.',
    columns: ['date_key', 'customer_key', 'product_key', 'publisher_key', 'txn_id', 'amount_eur']
  },
  dims: [
    {
      id: 'date', name: 'dim_date', pos: 'top',
      role: 'Wymiar daty. Jeden wiersz na dzień, z gotowymi atrybutami kalendarza, żeby nikt nie liczył kwartału po swojemu.',
      columns: ['date_key', 'date', 'month', 'quarter', 'is_weekend'],
      rows: [[20260105, '2026-01-05', '2026-01', 'Q1', 'nie'], [20260115, '2026-01-15', '2026-01', 'Q1', 'nie'], [20260120, '2026-01-20', '2026-01', 'Q1', 'nie'], [20260201, '2026-02-01', '2026-02', 'Q1', 'tak'], [20260205, '2026-02-05', '2026-02', 'Q1', 'nie'], [20260215, '2026-02-15', '2026-02', 'Q1', 'tak']]
    },
    {
      id: 'customer', name: 'dim_customer', pos: 'left',
      role: 'Wymiar klienta. Na razie jeden wiersz na klienta. W etapie Historia zobaczysz, co się dzieje, gdy klient zmienia kraj.',
      columns: ['customer_key', 'customer_id', 'name', 'country'],
      rows: [[1, 'C-101', 'Anna', 'PL'], [2, 'C-102', 'Ben', 'DE'], [3, 'C-103', 'Chloé', 'FR']]
    },
    {
      id: 'product', name: 'dim_product', pos: 'right',
      role: 'Wymiar produktu. Opisuje ofertę: nazwę, okres rozliczeniowy i cenę z cennika.',
      columns: ['product_key', 'product_id', 'name', 'billing_period', 'list_price'],
      rows: [[1, 'SPORT-M', 'Sport Monthly', 'monthly', '10.00'], [2, 'SPORT-Y', 'Sport Annual', 'annual', '96.00'], [3, 'KINO-M', 'Kino Monthly', 'monthly', '8.00']]
    },
    {
      id: 'publisher', name: 'dim_publisher', pos: 'bottom',
      role: 'Wymiar wydawcy. Wydawca jest tu najemcą platformy (tenant): jednym z wielu klientów, którzy korzystają z tej samej platformy. Po tym wymiarze później odetniemy dane, których dany wydawca nie może widzieć.',
      columns: ['publisher_key', 'publisher_id', 'name', 'plan_tier'],
      rows: [[1, 'PUB-AUR', 'Aurora Sport', 'enterprise'], [2, 'PUB-KIN', 'Kino Nord', 'growth']]
    }
  ],
  /** Ile pierwszych transakcji pokazuje ilustracja. */
  factRows: 6,
  pickHint: 'Kliknij wiersz, żeby przejść po kluczach do wymiarów.',
  resolved: '{txn}: {date} · {customer} ({country}) · {product} · {publisher} · {amount} EUR'
};

export interface GrainOption {
  id: string;
  label: string;
  table: SampleTable;
  /** Dla każdego z pytań biznesowych: czy to ziarno odpowiada i dlaczego. */
  answers: { ok: boolean; why: string }[];
}

export const grain = {
  assumptions: 'Ilustracja: te same dane, cztery sposoby cięcia. Dane są wymyślone.',
  questions: [
    'Ile wpłynęło każdego dnia, per produkt i wydawca?',
    'Jaki odsetek wpłat kończy się zwrotem, per produkt?',
    'Ile aktywnych subskrypcji i jaki MRR mamy na koniec każdego miesiąca?'
  ],
  defaultId: 'customer-month',
  options: [
    {
      id: 'customer-month',
      label: 'klient × miesiąc',
      table: { name: 'jeden wiersz na klienta na miesiąc', columns: ['month', 'customer_id', 'paid_eur'], rows: [['2026-01', 'C-101', '10.00'], ['2026-01', 'C-102', '10.00'], ['2026-01', 'C-103', '96.00'], ['2026-02', 'C-101', '10.00'], ['2026-02', 'C-102', '18.00']] },
      answers: [
        { ok: false, why: 'Dzień i produkt zniknęły. Luty klienta C-102 to 18 EUR za dwa różne produkty dwóch wydawców, ale tego już nie widać.' },
        { ok: false, why: 'Wpłaty i zwroty są zsumowane w jedną kwotę. Nie da się policzyć, ile było jednych i drugich.' },
        { ok: false, why: 'C-103 zapłaciła raz w styczniu za cały rok. W lutym nie ma wiersza, choć subskrypcja jest aktywna.' }
      ]
    },
    {
      id: 'transaction',
      label: 'jedna transakcja',
      table: { name: 'jeden wiersz na wpłatę albo zwrot', columns: ['paid_at', 'txn_id', 'subscription_id', 'txn_type', 'amount_eur'], rows: [['2026-01-05', 'T-1', 'S-1', 'payment', '10.00'], ['2026-01-15', 'T-2', 'S-2', 'payment', '10.00'], ['2026-01-20', 'T-3', 'S-4', 'payment', '96.00'], ['2026-02-01', 'T-4', 'S-3', 'payment', '8.00'], ['...', '...', '...', '...', '...']] },
      answers: [
        { ok: true, why: 'Każda wpłata ma dzień, a przez subskrypcję produkt i wydawcę. Wystarczy pogrupować.' },
        { ok: true, why: 'Typ transakcji jest na każdym wierszu, więc da się policzyć zwroty i wpłaty osobno.' },
        { ok: false, why: 'Z samych wpłat nie odtworzysz stanu. Subskrypcja roczna S-4 nie ma żadnej transakcji w lutym ani w marcu, a jest aktywna.' }
      ]
    },
    {
      id: 'subscription-month',
      label: 'subskrypcja × koniec miesiąca',
      table: { name: 'jeden wiersz na aktywną subskrypcję na koniec miesiąca', columns: ['month_end', 'subscription_id', 'status', 'mrr_eur'], rows: [['2026-01-31', 'S-1', 'active', '10.00'], ['2026-01-31', 'S-2', 'active', '10.00'], ['2026-01-31', 'S-4', 'active', '8.00'], ['2026-02-28', 'S-3', 'active', '8.00'], ['...', '...', '...', '...']] },
      answers: [
        { ok: false, why: 'Nie ma tu wpłat ani dni, tylko stan na koniec miesiąca.' },
        { ok: false, why: 'Zwrot jest zdarzeniem. W stanie na koniec miesiąca widać najwyżej, że subskrypcji już nie ma.' },
        { ok: true, why: 'Dokładnie to opisuje wiersz: subskrypcja aktywna w ostatnim dniu miesiąca i jej MRR.' }
      ]
    },
    {
      id: 'publisher-day',
      label: 'wydawca × dzień',
      table: { name: 'jeden wiersz na wydawcę na dzień', columns: ['date', 'publisher', 'revenue_eur'], rows: [['2026-01-05', 'Aurora Sport', '10.00'], ['2026-01-15', 'Aurora Sport', '10.00'], ['2026-01-20', 'Aurora Sport', '96.00'], ['2026-02-01', 'Kino Nord', '8.00'], ['...', '...', '...']] },
      answers: [
        { ok: false, why: 'Dzień i wydawca są, ale produkt został zsumowany. Sport Monthly i Sport Annual są nie do rozdzielenia.' },
        { ok: false, why: 'Zwroty odjęły się od wpłat w jednej kwocie, a produktu nie ma.' },
        { ok: false, why: 'To nadal zdarzenia, tylko zagregowane. Stanu subskrypcji tu nie ma.' }
      ]
    }
  ] as GrainOption[],
  verdictNone: 'To ziarno nie odpowiada na żadne z trzech pytań. Szczegółu, który zniknął przy sumowaniu, nie da się odzyskać.',
  verdictSome: 'Odpowiada na {n} z 3 pytań.'
};

export const fanout = {
  assumptions: 'Ilustracja: cztery subskrypcje aktywne na koniec lutego i sześć transakcji ze stycznia i lutego. Wynik liczy przeglądarka z tych wierszy.',
  modes: [
    { id: 'wrong', label: 'Join, potem suma' },
    { id: 'right', label: 'Najpierw agregacja' }
  ] as { id: 'wrong' | 'right'; label: string }[],
  sql: {
    wrong: `SELECT p.publisher_name,
       SUM(s.mrr_eur)    AS mrr,
       SUM(t.amount_eur) AS revenue
FROM subscriptions s
JOIN transactions t ON t.subscription_id = s.subscription_id
JOIN products pr    ON pr.product_id = s.product_id
JOIN publishers p   ON p.publisher_id = pr.publisher_id
WHERE t.paid_at < '2026-03-01'
GROUP BY p.publisher_name`,
    right: `WITH revenue AS (          -- transakcje sprowadzone do ziarna subskrypcji
  SELECT subscription_id, SUM(amount_eur) AS revenue
  FROM transactions
  WHERE paid_at < '2026-03-01'
  GROUP BY subscription_id
)
SELECT p.publisher_name,
       SUM(s.mrr_eur) AS mrr,
       SUM(r.revenue) AS revenue
FROM subscriptions s
LEFT JOIN revenue r ON r.subscription_id = s.subscription_id
JOIN products pr    ON pr.product_id = s.product_id
JOIN publishers p   ON p.publisher_id = pr.publisher_id
GROUP BY p.publisher_name`
  },
  rowsTitle: { wrong: 'Wiersze po złączeniu, przed GROUP BY', right: 'Wiersze po złączeniu z podsumą, przed GROUP BY' },
  resultTitle: 'Wynik',
  note: {
    wrong: 'Złączenie zrobiło z 4 subskrypcji 6 wierszy. MRR subskrypcji S-1 i S-2 jest na dwóch wierszach, więc suma daje {mrr} zamiast {expected}. Przychód {revenue} jest poprawny, bo kwota transakcji występuje raz na wiersz.',
    right: 'Transakcje są najpierw zsumowane do jednego wiersza na subskrypcję. Złączenie jest wtedy jeden do jednego: 4 wiersze zostają 4 wierszami. MRR wynosi {mrr}, przychód {revenue}.'
  }
};

/* ------------------------------------------------------------------ etap 2: Fakty i wymiary */

export interface FactTypeRow { month: number; cells: string[]; changed?: number[] }

/**
 * Te same dwie subskrypcje (S-2 miesięczna z okresem próbnym, S-4 roczna) w trzech rodzajach tabel faktów.
 * `month` to indeks miesiąca, w którym wiersz powstał. W tabeli narastającej `updates` nadpisuje komórki od danego miesiąca.
 */
export const factTypes = {
  question: 'Jedna subskrypcja, trzy sposoby zapisu. Który odpowiada na które pytanie?',
  intro: 'Subskrypcja S-2: rejestracja z okresem próbnym 8 stycznia, pierwsza wpłata 15 stycznia, kolejne w lutym i marcu, rezygnacja ze zwrotem 18 marca. Subskrypcja S-4: płatność za cały rok 20 stycznia. Przesuwaj czas i patrz, w której tabeli przybywa wierszy, a w której zmieniają się istniejące.',
  assumptions: 'Ilustracja: stan trzech tabel na koniec wybranego miesiąca. Nowe wiersze i zmienione komórki są wyróżnione.',
  months: ['styczeń', 'luty', 'marzec', 'kwiecień'],
  tables: [
    {
      id: 'transaction', name: 'fact_transaction', kind: 'Transakcyjna',
      grainText: 'Ziarno: jedna wpłata albo zwrot.',
      columns: ['paid_at', 'sub', 'type', 'amount_eur'],
      rows: [
        { month: 0, cells: ['01-15', 'S-2', 'payment', '10.00'] },
        { month: 0, cells: ['01-20', 'S-4', 'payment', '96.00'] },
        { month: 1, cells: ['02-15', 'S-2', 'payment', '10.00'] },
        { month: 2, cells: ['03-15', 'S-2', 'payment', '10.00'] },
        { month: 2, cells: ['03-18', 'S-2', 'refund', '-10.00'] }
      ] as FactTypeRow[],
      behaviour: ['Dwa nowe wiersze: dwie wpłaty.', 'Jeden nowy wiersz. S-4 nie zapłaciła nic, więc nie ma wiersza.', 'Dwa nowe wiersze: wpłata i zwrot.', 'Nic się nie wydarzyło, więc nic nie przybyło.'],
      answers: 'Ile wpłynęło, kiedy, za co. Nie mówi wprost, ile subskrypcji jest aktywnych.'
    },
    {
      id: 'periodic', name: 'fact_subscription_monthly', kind: 'Okresowa migawka',
      grainText: 'Ziarno: jedna aktywna subskrypcja na koniec miesiąca.',
      columns: ['month_end', 'sub', 'status', 'mrr_eur'],
      rows: [
        { month: 0, cells: ['01-31', 'S-2', 'active', '10.00'] },
        { month: 0, cells: ['01-31', 'S-4', 'active', '8.00'] },
        { month: 1, cells: ['02-28', 'S-2', 'active', '10.00'] },
        { month: 1, cells: ['02-28', 'S-4', 'active', '8.00'] },
        { month: 2, cells: ['03-31', 'S-4', 'active', '8.00'] },
        { month: 3, cells: ['04-30', 'S-4', 'active', '8.00'] }
      ] as FactTypeRow[],
      behaviour: ['Dwa wiersze: obie subskrypcje są aktywne 31 stycznia.', 'Znowu dwa wiersze, choć S-4 nie miała żadnej transakcji.', 'Jeden wiersz. S-2 zrezygnowała 18 marca, więc 31 marca jej nie ma.', 'Jeden wiersz, mimo że w kwietniu nic się nie wydarzyło.'],
      answers: 'Ile subskrypcji i jaki MRR na koniec miesiąca, jak to się zmienia. Nie widać pojedynczych zdarzeń wewnątrz miesiąca.'
    },
    {
      id: 'accumulating', name: 'fact_subscription_lifecycle', kind: 'Narastająca migawka',
      grainText: 'Ziarno: jedna subskrypcja przez całe życie.',
      columns: ['sub', 'signup', 'first_paid', 'canceled', 'days_to_paid'],
      rows: [
        { month: 0, cells: ['S-2', '01-08', '01-15', '—', '7'] },
        { month: 0, cells: ['S-4', '01-20', '01-20', '—', '0'] }
      ] as FactTypeRow[],
      /** Aktualizacje istniejących wierszy: od miesiąca `month` komórka `col` wiersza `row` ma wartość `value`. */
      updates: [{ month: 2, row: 0, col: 3, value: '03-18' }],
      behaviour: ['Dwa wiersze, po jednym na subskrypcję. Data rezygnacji jest pusta.', 'Bez zmian: żaden etap nie został osiągnięty.', 'Żadnego nowego wiersza. W wierszu S-2 uzupełniono datę rezygnacji.', 'Bez zmian.'],
      answers: 'Ile trwa przejście między etapami: od rejestracji do pierwszej wpłaty, od wpłaty do rezygnacji. Wiersz jest aktualizowany, więc ładowanie musi umieć robić UPDATE albo MERGE.'
    }
  ],
  takeaway: [
    '<b>Wniosek.</b> <b>Tabela transakcyjna</b> (transaction fact table) dostaje wiersz tylko wtedy, gdy coś się wydarzyło. <b>Okresowa migawka</b> (periodic snapshot) dostaje wiersz na każdy okres, także gdy nic się nie działo. Dlatego odpowiada na pytania o stan. <b>Narastająca migawka</b> (accumulating snapshot) ma jeden wiersz na cały przebieg procesu, który ma znany początek i koniec. Ten wiersz jest uzupełniany, gdy proces dochodzi do kolejnego etapu.',
    'To nie są trzy warianty do wyboru. To trzy odpowiedzi na trzy rodzaje pytań. Dojrzały model subskrypcji zwykle ma tabelę transakcyjną i okresową migawkę obok siebie. Łączą je wspólne wymiary.'
  ],
  notesTitle: 'Zastrzeżenia do tej ilustracji',
  notes: [
    'Czy anulowana subskrypcja ma mieć w migawce wiersz ze statusem „canceled” i MRR równym zero? To decyzja projektowa. Tu migawka zawiera tylko subskrypcje aktywne w ostatnim dniu miesiąca. Ważne, żeby ta reguła była zapisana razem z ziarnem.',
    'W prostych przypadkach migawkę da się odtworzyć z historii zdarzeń. Trzyma się ją osobno z dwóch powodów. Pytanie o stan pada często, a liczenie stanu z milionów zdarzeń przy każdym zapytaniu jest kosztowne. Łatwo też policzyć go w dwóch miejscach na dwa różne sposoby.',
    'Kimball zaznacza, że narastająca migawka jest jedynym z trzech rodzajów, w którym wiersze są aktualizowane.'
  ]
};

export const additivity = {
  title: 'Czy tę miarę wolno zsumować?',
  intro: 'Trzy miary z tego samego modelu. Każda zachowuje się inaczej, gdy próbujesz ją zsumować po dniach, produktach albo miesiącach. Wybierz miarę.',
  assumptions: 'Ilustracja: liczby z pełnego zbioru, styczeń–marzec 2026.',
  measures: [
    {
      id: 'amount', label: 'amount_eur', kind: 'Addytywna',
      rows: [['styczeń', '116'], ['luty', '28'], ['marzec', '18']],
      head: ['miesiąc', 'wpłaty netto'],
      sumLabel: 'Suma po miesiącach', sum: '162', sumOk: true,
      text: 'Kwotę transakcji wolno sumować po każdym wymiarze: po dniach, klientach, produktach i wydawcach. 162 EUR to rzeczywisty przychód kwartału.'
    },
    {
      id: 'mrr', label: 'mrr_eur', kind: 'Póładdytywna',
      rows: [['31 stycznia', '28'], ['28 lutego', '36'], ['31 marca', '26']],
      head: ['koniec miesiąca', 'MRR'],
      sumLabel: 'Suma po miesiącach', sum: '90', sumOk: false,
      text: 'MRR wolno sumować po subskrypcjach, produktach i wydawcach w ramach jednego dnia. Po czasie nie: 90 EUR nic nie znaczy. Dla kwartału bierze się wartość z ostatniego dnia (26) albo średnią (30).'
    },
    {
      id: 'refund-rate', label: 'refund_rate', kind: 'Nieaddytywna',
      rows: [['Sport Monthly', '1 / 6 = 16,7%'], ['Sport Annual', '0 / 1 = 0%'], ['Kino Monthly', '0 / 2 = 0%']],
      head: ['produkt', 'zwroty / wpłaty'],
      sumLabel: 'Średnia z trzech odsetków', sum: '5,6%', sumOk: false,
      text: 'Odsetka nie wolno ani sumować, ani uśredniać. Poprawny wynik dla całości to 1 zwrot na 9 wpłat, czyli 11,1%. Dlatego w tabeli faktów trzyma się składniki (liczbę zwrotów i liczbę wpłat), a iloraz liczy się na końcu.'
    }
  ],
  takeaway: '<b>Wniosek.</b> Miarę <b>addytywną</b> (additive) wolno sumować po każdym wymiarze. <b>Póładdytywną</b> (semi-additive) tylko po niektórych, typowo po wszystkich oprócz czasu. Tak zachowują się salda i stany. <b>Nieaddytywnej</b> (non-additive), na przykład odsetka, nie sumuje się wcale. Miary w migawkach są często póładdytywne, ale decyduje definicja miary. Zastrzeżenie do każdej sumy: kwoty muszą być w zgodnej walucie, a grupy nie mogą na siebie zachodzić.',
  moreTitle: 'Co z tego wynika dla warstwy BI',
  more: [
    'Narzędzie BI domyślnie sumuje kolumnę liczbową. Jeśli użytkownik przeciągnie <code>mrr_eur</code> na wykres kwartalny, dostanie 90. Dlatego kolumny póładdytywne i nieaddytywne się ukrywa. Zamiast nich użytkownik dostaje gotową miarę, w której zapisano, jak ją liczyć.',
    'Kimball opisuje trzymanie składników odsetka, czyli licznika i mianownika, jako praktykę stosowaną „tam, gdzie to możliwe”. Końcowe dzielenie często robi warstwa BI. To zalecenie, a nie reguła bez wyjątków.'
  ]
};

export const keys = {
  title: 'Którym kluczem fakt wskazuje wymiar?',
  intro: 'System źródłowy zna klienta jako <code>C-102</code>. To <b>klucz naturalny</b> (natural key): nadał go system, w którym klient powstał, i biznes go rozpoznaje. W hurtowni wymiar dostaje dodatkowo <b>klucz zastępczy</b> (surrogate key): liczbę bez znaczenia, nadaną przy ładowaniu. Po co drugi klucz? Trzy powody są pod tabelą.',
  table: { name: 'dim_customer', columns: ['customer_key', 'customer_id', 'name', 'country'], rows: [[1, 'C-101', 'Anna', 'PL'], [2, 'C-102', 'Ben', 'DE'], [3, 'C-103', 'Chloé', 'FR']] } as SampleTable,
  legend: '<code>customer_key</code> to klucz zastępczy i klucz główny wymiaru. <code>customer_id</code> to klucz naturalny: zostaje w wymiarze jako zwykła kolumna.',
  reasons: [
    '<b>Historia.</b> Gdy zaczniesz zapisywać zmiany, ten sam klient będzie miał kilka wierszy. Klucz naturalny przestaje być unikalny, więc nie może być kluczem głównym.',
    '<b>Wiele źródeł.</b> Dwa systemy mogą znać tego samego klienta pod różnymi identyfikatorami. Mogą też używać tego samego identyfikatora dla różnych klientów.',
    '<b>Niezależność.</b> Źródło nie zawsze dba o swoje klucze i potrafi je zmienić. Własny klucz chroni hurtownię przed takimi zmianami.'
  ],
  takeaway: '<b>Wniosek.</b> Tabela faktów przechowuje klucz zastępczy wymiaru. Klucz naturalny służy do tego, żeby przy ładowaniu znaleźć właściwy wiersz wymiaru. Wyjątkiem jest wymiar daty: jego klucz może być czytelny, na przykład <code>20260215</code>.',
  moreTitle: 'Liczba z sekwencji czy hash',
  more: [
    'Kimball opisuje klucz zastępczy jako kolejne liczby całkowite. W projektach dbt na hurtowniach chmurowych często spotkasz zamiast tego hash z klucza naturalnego i daty początku wersji. Hash da się policzyć niezależnie w wielu modelach i przy ponownym ładowaniu wychodzi taki sam, ale jest szerszy niż liczba. To obserwacja praktyki, a nie cytat z dokumentacji.',
    'Niezależnie od techniki cel jest ten sam: jeden wiersz wymiaru ma jeden klucz, a klucz nie niesie znaczenia biznesowego.'
  ]
};

export const patterns = {
  title: 'Trzy sytuacje, w których gwiazda wygląda inaczej',
  intro: 'Każda z nich pada na rozmowach jako pytanie „a co zrobisz, gdy...”. Wybierz sytuację.',
  items: [
    {
      id: 'degenerate', label: 'Numer transakcji',
      problem: 'W tabeli faktów jest <code>txn_id</code>. Analitycy filtrują po nim przy reklamacjach. Czy potrzebuje własnego wymiaru?',
      tables: [{ name: 'fact_transaction', columns: ['date_key', 'customer_key', 'txn_id', 'amount_eur'], rows: [[20260315, 4, 'T-9', '10.00'], [20260318, 4, 'T-10', '-10.00']] }] as SampleTable[],
      result: 'Wymiar <code>dim_transaction</code> miałby jedną kolumnę i tyle wierszy, ile fakt. Niczego by nie opisywał.',
      takeaway: 'Identyfikator, o którym nie ma nic więcej do powiedzenia, zostaje w tabeli faktów jako zwykła kolumna. To <b>wymiar zdegenerowany</b> (degenerate dimension). Typowe przykłady: numer zamówienia, faktury, transakcji.'
    },
    {
      id: 'factless', label: 'Zdarzenie bez miary',
      problem: 'Wydawca chce wiedzieć, które produkty były objęte promocją w dane dni, a mimo to nic nie sprzedały. Samo objęcie promocją nie ma żadnej kwoty.',
      tables: [{ name: 'fact_promo_coverage', columns: ['date_key', 'product_key', 'promo_key'], rows: [[20260201, 1, 7], [20260201, 3, 7], [20260202, 1, 7]] }] as SampleTable[],
      result: 'Tabela ma same klucze. Zamiast sumować kwoty, liczy się wiersze: <code>COUNT(*)</code> mówi, ile par produkt–dzień było w promocji. Gdy od tego pokrycia odejmiesz pary, które mają sprzedaż, zostaje to, co się nie wydarzyło.',
      takeaway: 'Tabela faktów bez miar to <b>factless fact table</b>. Zapisuje, że coś zaszło albo że coś było możliwe. Bez niej pytanie „co się nie sprzedało” nie ma odpowiedzi, bo w tabeli sprzedaży brak sprzedaży nie zostawia wiersza.'
    },
    {
      id: 'bridge', label: 'Wiele do wielu',
      problem: 'Produkty sportowe należą do dwóch kategorii treści: Football i Tennis. Ktoś chce przychodu per kategoria. Jeden produkt, dwie kategorie: fakt nie wskazuje już jednego wiersza wymiaru.',
      tables: [
        { name: 'bridge_product_category', columns: ['product_key', 'category', 'weight'], rows: [[1, 'Football', '0.5'], [1, 'Tennis', '0.5'], [2, 'Football', '0.5'], [2, 'Tennis', '0.5'], [3, 'Film', '1.0']] },
        { name: 'przychód per kategoria, Q1', columns: ['category', 'bez wag', 'z wagami'], rows: [['Football', '146', '73'], ['Tennis', '146', '73'], ['Film', '16', '16'], ['razem', '308', '162']] }
      ] as SampleTable[],
      result: 'Rzeczywisty przychód to 162 EUR. Złączenie przez tabelę pośrednią bez wag daje w sumie 308, bo każda transakcja produktu sportowego liczy się w obu kategoriach.',
      takeaway: 'Gdy jeden wiersz faktu pasuje do kilku wierszy wymiaru (relacja wiele do wielu), między nimi staje <b>tabela pomostowa</b> (bridge table). Sama nie usuwa podwójnego liczenia. Trzeba wybrać. Albo każda kategoria pokazuje pełną kwotę i kategorie nie sumują się do całości. Albo most dostaje wagi, które dzielą kwotę między kategorie. Wagi to decyzja biznesowa, a nie techniczna.'
    }
  ],
  moreTitle: 'Zastrzeżenia',
  more: [
    'Strona Kimballa o wymiarach wielowartościowych opisuje most z kluczem grupy i przykład pacjenta z wieloma diagnozami. Wagi podziału są praktyką opisywaną w literaturze Kimballa, ale na tej stronie ich nie ma, więc traktuj je jako jedną z możliwości.',
    'Jeśli relacja wiele do wielu zmienia się w czasie (klient dołącza do gospodarstwa domowego, produkt zmienia kategorię), most potrzebuje dat ważności, a zapytanie musi wskazać moment, dla którego liczy.'
  ]
};

export const shapes = {
  title: 'Gwiazda, płatek śniegu i wymiary wspólne',
  intro: 'Produkt należy do wydawcy. Można to zapisać na dwa sposoby.',
  variants: [
    { name: 'Star schema', text: 'Dane wydawcy są w wymiarze, do którego fakt sięga bezpośrednio. Albo w osobnym <code>dim_publisher</code> z własnym kluczem w fakcie, albo jako dodatkowe kolumny w <code>dim_product</code>. Każdy wymiar jest o jedno złączenie od faktu.' },
    { name: 'Snowflake schema', text: '<code>dim_product</code> wskazuje <code>dim_publisher</code> kluczem obcym, a fakt zna tylko produkt. Powtórzeń jest mniej. Ale do nazwy wydawcy prowadzą dwa złączenia, a użytkownik BI widzi łańcuch tabel. Nazwa znaczy „płatek śniegu” i opisuje kształt modelu, a nie hurtownię Snowflake.' }
  ],
  takeaway: '<b>Wniosek.</b> Oba zapisy zawierają tę samą informację. Kimball odradza płatek śniegu: użytkownikom biznesowym trudniej się w nim poruszać, a zapytania mogą działać wolniej. Microsoft dla modeli Power BI pisze ostrożniej. Jedna tabela wymiaru na ogół się opłaca, ale decyzja może zależeć od ilości danych i wymagań użytkowych.',
  conformedTitle: 'Wymiar wspólny (conformed dimension)',
  conformed: [
    'Masz już dwie tabele faktów: <code>fact_transaction</code> i <code>fact_subscription_monthly</code>. Raport „przychód i MRR per wydawca” wymaga, żeby „wydawca” znaczył w obu to samo: te same nazwy kolumn, te same wartości, te same definicje.',
    'Wymiar zdefiniowany raz i używany przez wiele tabel faktów to <b>wymiar wspólny</b> (conformed dimension). Dzięki niemu każdy fakt sumujesz osobno do poziomu wydawcy, a wyniki zestawiasz obok siebie. Bez niego każdy zespół ma własną listę wydawców i liczby się rozjeżdżają.',
    'Na platformie z wieloma najemcami (multi-tenant) wymiar wydawcy jest wspólny z definicji. Po nim filtrują raporty, po nim rozlicza się wydawców i po nim odcina się dostęp do danych.'
  ],
  bridge: {
    from: 'Snowflake',
    known: 'Hurtownia kolumnowa dobrze znosi szerokie tabele i złączenia, więc technicznie zadziała i gwiazda, i płatek śniegu, i jedna wielka tabela.',
    fresh: 'Kształt modelu wybierasz więc ze względu na czytelność i spójność. Ile tabel widzi użytkownik? Ile złączeń musi zrobić narzędzie BI? W ilu miejscach zapisano, kim jest wydawca?',
    breaks: 'Wydajność silnika nie zwalnia z projektowania. Szybka hurtownia policzy błędną liczbę równie szybko jak poprawną, a fan-out kosztuje tym więcej, im większe tabele.'
  } as Bridge
};

/* ------------------------------------------------------------------ etap 3: Historia */

export const scd = {
  question: 'Ben się przeprowadził. Do którego kraju należą jego styczniowe wpłaty?',
  intro: 'Ben (C-102) mieszkał w Niemczech. 10 lutego 2026 zmienia kraj na Polskę. Raport „przychód per kraj” ma dwie możliwe odpowiedzi i obie bywają poprawne. Wybierz, jak wymiar zapisuje zmianę.',
  assumptions: 'Ilustracja: wszystkie dziesięć transakcji z pierwszego kwartału. Raport liczy przeglądarka z wierszy wymiaru poniżej.',
  types: [
    { id: 'scd1', label: 'Typ 1: nadpisz' },
    { id: 'scd2', label: 'Typ 2: dodaj wersję' }
  ] as { id: 'scd1' | 'scd2'; label: string }[],
  timeline: { start: '2026-01-01', end: '2026-03-31', ticks: ['sty', 'lut', 'mar'], changeLabel: '10 lutego: zmiana kraju' },
  dimTitle: 'dim_customer, wiersze Bena',
  reportTitle: 'Przychód per kraj, Q1 2026',
  says: {
    scd1: 'Wiersz Bena został nadpisany. Hurtownia nie wie już, że mieszkał w Niemczech, więc wszystkie jego wpłaty, także styczniowe, są przypisane do Polski. Niemcy zniknęły z raportu.',
    scd2: 'Stary wiersz dostał datę końca. Nowy wiersz dostał nowy klucz. Wpłaty sprzed 10 lutego wskazują starą wersję, późniejsze nową. Raport pokazuje kraj z chwili wpłaty.'
  },
  takeaway: [
    '<b>Wniosek.</b> Opis klienta zmienia się rzadko i nieregularnie. Wymiar z takimi atrybutami to <b>slowly changing dimension</b> (SCD), a sposób zapisu zmiany nazywa się typem. <b>Typ 1</b> nadpisuje wartość. To proste, ale historia znika, a raporty za zamknięte okresy zmieniają się wstecz. <b>Typ 2</b> dodaje nowy wiersz z nowym kluczem zastępczym, a stary zamyka datą.',
    'Suma w obu raportach to 162 EUR. Typ wymiaru nie zmienia tego, ile zarobiono, tylko komu to przypisano. Wybór zależy od pytania: „gdzie dziś mieszkają klienci, którzy nam zapłacili” (typ 1) czy „ile zarobiliśmy w każdym kraju” (typ 2).'
  ],
  columnsTitle: 'Kolumny, które musi mieć wymiar typu 2',
  columns: [
    '<code>valid_from</code> i <code>valid_to</code>: początek i koniec ważności wersji. Kimball wymienia je jako datę wejścia w życie i datę wygaśnięcia wiersza.',
    '<code>is_current</code>: znacznik bieżącej wersji. Ułatwia zapytania o stan obecny.',
    'Nowy klucz zastępczy dla każdej wersji. To on trafia do tabeli faktów.',
    'Kimball podaje te trzy kolumny administracyjne jako minimum. Microsoft opisuje znacznik bieżącego wiersza jako opcjonalny, a koniec bieżącej wersji jako pustą datę albo <code>9999-12-31</code>.'
  ],
  choiceTitle: 'Typ ustala się dla atrybutu, nie dla tabeli',
  choice: [
    'Literówka w nazwisku to poprawka: typ 1. Zmiana kraju, segmentu albo planu cenowego wydawcy zmienia to, jak czytasz przychód: typ 2.',
    'W jednym wymiarze zwykle są oba rodzaje atrybutów. Decyzję podejmuje się z biznesem, kolumna po kolumnie, pytaniem: „czy stare raporty mają się zmienić, gdy ta wartość się zmieni?”.',
    'Typ 2 ma koszt: wymiar rośnie, ładowanie musi wykrywać zmiany, a każde złączenie po kluczu naturalnym wymaga warunku na daty.'
  ],
  bridge: {
    from: 'dbt',
    known: 'Polecenie <code>dbt snapshot</code> porównuje źródło z poprzednim stanem i dopisuje wiersze z kolumnami <code>dbt_valid_from</code> i <code>dbt_valid_to</code>. U bieżącej wersji <code>dbt_valid_to</code> jest domyślnie puste.',
    fresh: 'To jest mechanizm typu 2: każda zmiana to nowy wiersz z przedziałem ważności. Na takim snapshocie buduje się wymiar z kluczem zastępczym.',
    breaks: 'Snapshot rejestruje to, co zobaczył w chwili uruchomienia. Dokumentacja dbt podkreśla, że trzeba go uruchamiać regularnie, bo inaczej zmiany nie zostaną zapisane. Jeśli wartość zmieni się dwa razy między uruchomieniami, pośredniego stanu w snapshocie nie będzie. Pełną historię daje tylko źródło, które samo ją prowadzi, na przykład log zmian.'
  } as Bridge
};

export const pit = {
  title: 'Którą wersję klienta dostaje transakcja?',
  intro: 'Wymiar ma teraz dwa wiersze Bena. Transakcja zna tylko <code>customer_id</code> i datę. Kliknij transakcję Bena i wybierz sposób złączenia.',
  assumptions: 'Ilustracja: sześć transakcji Bena i jego dwie wersje w wymiarze. Przedział ważności to [valid_from, valid_to): dzień valid_from należy do wersji, a dzień valid_to już do następnej.',
  modes: [
    { id: 'pit', label: 'Po dacie zdarzenia' },
    { id: 'current', label: 'Tylko bieżący wiersz' },
    { id: 'natural', label: 'Sam klucz naturalny' }
  ] as { id: 'pit' | 'current' | 'natural'; label: string }[],
  sql: {
    pit: `JOIN dim_customer d
  ON  d.customer_id = t.customer_id
  AND t.paid_at >= d.valid_from
  AND t.paid_at <  d.valid_to`,
    current: `JOIN dim_customer d
  ON  d.customer_id = t.customer_id
  AND d.is_current`,
    natural: `JOIN dim_customer d
  ON  d.customer_id = t.customer_id`
  },
  says: {
    pit: 'Transakcja {txn} z dnia {date} pasuje do jednej wersji: {country}, klucz {key}. Warunek na daty wybiera wersję, która obowiązywała w chwili wpłaty.',
    current: 'Transakcja {txn} dostaje wersję bieżącą: {country}, klucz {key}, niezależnie od daty wpłaty. To wynik taki jak w typie 1, choć historia leży w tabeli.',
    natural: 'Transakcja {txn} pasuje do {n} wersji naraz. Każdy wiersz faktu się powiela, a kwota liczy się {n} razy. To ten sam fan-out co w etapie Intuicja.'
  },
  reportTitle: 'Przychód per kraj, wszystkie transakcje Q1',
  totalNote: { ok: 'Razem 162 EUR. Zgadza się z sumą transakcji.', bad: 'Razem {total} EUR zamiast 162. Wpłaty Bena policzone podwójnie.' },
  takeaway: [
    '<b>Wniosek.</b> Wpłata ma dostać tę wersję klienta, która obowiązywała w dniu wpłaty. Takie dobieranie wersji po dacie to <b>złączenie punkt-w-czasie</b> (point-in-time join). Przedziały ważności jednego klucza biznesowego nie mogą na siebie zachodzić, dlatego jeden koniec jest otwarty. Inaczej wpłata z dnia zmiany pasuje do dwóch wersji. Luki bywają uzasadnione. Fakt, który nie trafia w żadną wersję, dostaje jawny wiersz „nieznany”, a nigdy wersję, która już wygasła.',
    'W modelu wymiarowym to złączenie robi się <b>raz, przy ładowaniu faktu</b>. Ładowanie znajduje klucz zastępczy właściwej wersji i zapisuje go w wierszu faktu. Zapytania analityczne łączą potem fakt z wymiarem zwykłym warunkiem równości po <code>customer_key</code>, bez dat.'
  ],
  currentTitle: 'Stan bieżący i stan historyczny z jednego modelu',
  current: [
    'Często biznes chce obu widoków: przychodu według kraju z chwili wpłaty i według kraju obecnego. Wymiar typu 2 obsłuży oba, jeśli w każdej wersji jest też klucz naturalny albo inny trwały klucz klienta.',
    'Widok historyczny: fakt łączy się z wymiarem po kluczu zastępczym. Widok bieżący: robisz to samo, a potem przechodzisz do bieżącego wiersza tego samego klienta (<code>is_current</code>). Tabela faktów jest w obu przypadkach ta sama.',
    'Model, który trzyma wyłącznie stan bieżący, jest prostszy i wystarcza, gdy nikt nie pyta o przeszłość. Błędem jest dopiero udawanie, że odpowiada na pytania historyczne.'
  ],
  asofTitle: 'Gdy wymiar ma tylko datę początku wersji',
  asof: [
    'Log zmian często ma jedynie <code>changed_at</code>, bez daty końca. Datę końca można wyliczyć funkcją okna <code>LEAD</code> albo użyć złączenia, które samo szuka najbliższego wcześniejszego wiersza.',
    'W Snowflake służy do tego <code>ASOF JOIN</code> z klauzulą <code>MATCH_CONDITION</code>. Dla każdego wiersza z lewej strony zwraca jeden wiersz z prawej: najbliższy w czasie według podanego operatora. Dozwolone są tylko operatory nierówności. Wiersz z lewej strony bez dopasowania zostaje z wartościami NULL, podobnie jak w złączeniu lewostronnym. Gdy dwa wiersze są równie blisko, dokumentacja nie gwarantuje, który zostanie zwrócony. ASOF nie sprawdza valid_to. Jeśli historia ma luki, trzeba samemu sprawdzić koniec ważności i obsłużyć brak dopasowania.'
  ],
  asofCode: `SELECT t.txn_id, t.paid_at, c.country
FROM transactions t
ASOF JOIN customer_changes c
  MATCH_CONDITION (t.paid_at >= c.changed_at)
  ON t.customer_id = c.customer_id`
};

export const late = {
  title: 'Dane, które przychodzą nie w porę',
  intro: 'Dotąd każda transakcja docierała do hurtowni od razu i w kolejności. W praktyce tak nie jest. Dwie sytuacje, dwa różne problemy.',
  cases: [
    {
      id: 'fact', label: 'Spóźniony fakt',
      setup: '25 marca dociera transakcja T-11 Bena z datą wpłaty <b>8 lutego</b>. Operator płatności przesłał ją z opóźnieniem. Bieżąca wersja Bena to Polska, klucz 4.',
      lines: [
        { code: 'SELECT d.customer_key', label: 'szukany klucz', text: 'Ładowanie ma zapisać w fakcie klucz zastępczy wersji klienta. Pytanie: której.' },
        { code: 'FROM dim_customer d', label: 'cała historia', text: 'Przeszukuje się wszystkie wersje, nie tylko bieżącą. Wymiar ograniczony do <code>is_current</code> dałby klucz 4.' },
        { code: "WHERE d.customer_id = 'C-102'", label: 'klucz naturalny', text: 'Po kluczu naturalnym znajdujemy obie wersje Bena.' },
        { code: "  AND DATE '2026-02-08' >= d.valid_from", label: 'data zdarzenia', text: 'Liczy się data wpłaty, a nie data załadowania. 8 lutego Ben mieszkał jeszcze w Niemczech.' },
        { code: "  AND DATE '2026-02-08' <  d.valid_to", label: 'koniec przedziału', text: 'Warunek wybiera dokładnie jedną wersję: klucz 2, Niemcy.' }
      ] as ExplainedLine[],
      takeaway: 'Spóźniony fakt (late-arriving fact) dostaje klucz tej wersji wymiaru, która obowiązywała <b>w chwili zdarzenia</b>. Ładowanie, które zawsze bierze wersję bieżącą, działa poprawnie tylko wtedy, gdy dane przychodzą na czas. Błąd wychodzi dopiero przy opóźnieniu albo ponownym przeliczeniu.'
    },
    {
      id: 'dimension', label: 'Spóźniony wymiar',
      setup: 'Dociera wpłata klienta <b>C-107</b>, ale system klientów jeszcze go nie przesłał. W <code>dim_customer</code> nie ma takiego wiersza.',
      lines: [
        { code: "INSERT INTO dim_customer (customer_id, name, country)", label: 'wiersz zastępczy', text: 'Zamiast odrzucać fakt albo zapisywać pusty klucz, ładowanie tworzy wiersz wymiaru dla nieznanego jeszcze klienta.' },
        { code: "VALUES ('C-107', 'Unknown', 'Unknown')", label: 'znany tylko klucz', text: 'Klucz naturalny jest znany z transakcji. Atrybuty opisowe dostają ogólną wartość „nieznane”.' },
        { code: '-- fakt zapisuje klucz tego wiersza', label: 'fakt nie czeka', text: 'Wpłata trafia do tabeli faktów od razu i liczy się w sumach. W podziale na kraje widać ją jako „Unknown”.' },
        { code: "UPDATE dim_customer SET name = 'Greta', country = 'SE'", label: 'uzupełnienie', text: 'Gdy dane klienta dotrą, wiersz zastępczy zostaje nadpisany, czyli zmiana typu 1. Klucz w fakcie się nie zmienia.' }
      ] as ExplainedLine[],
      takeaway: 'Gdy fakt przychodzi przed swoim wymiarem (late-arriving dimension), tworzy się <b>wiersz zastępczy</b>: z kluczem naturalnym i nieznanymi atrybutami. Później się go uzupełnia. Dzięki temu suma przychodu jest kompletna od pierwszego dnia. Brak opisu widać w raporcie, zamiast chować go w odrzuconych wierszach.'
    }
  ],
  correctionsTitle: 'Poprawki wstecz i ponowne przeliczenie',
  corrections: [
    '<b>Poprawka faktu.</b> Zwrot T-10 nie kasuje wpłaty T-9. Jest osobnym wierszem z ujemną kwotą. W tym projekcie do tabeli transakcyjnej wiersze są wtedy tylko dopisywane (append-only). Suma za dowolny okres pozostaje prawdziwa: marzec pokazuje i wpłatę, i zwrot.',
    '<b>Poprawka wymiaru wstecz.</b> Okazuje się, że Ben przeprowadził się 1 lutego, a nie 10. Kimball opisuje to wprost: trzeba wstawić albo poprawić wiersz w historii wymiaru, a potem przepisać klucze w wierszach faktów, których to dotyczy. Tu: transakcja T-4 z 1 lutego przechodzi z wersji niemieckiej na polską.',
    '<b>Backfill</b>, czyli ponowne przeliczenie historii. Musi dać ten sam wynik co ładowanie na bieżąco. To wymaga dwóch rzeczy. Po pierwsze ładowanie dobiera wersję wymiaru po dacie zdarzenia. Po drugie zapis jest <b>idempotentny</b>: uruchomiony drugi raz zostawia ten sam stan. Przy <code>MERGE</code> potrzeba do tego stabilnego klucza, usuwania duplikatów ze źródła zawsze w ten sam sposób, ustalonej kolejności spóźnionych zmian i wartości, które przy każdym uruchomieniu wychodzą takie same. Przy nadpisaniu partycji potrzebny jest kompletny zbiór wejściowy.',
    '<b>Migawki.</b> Okresowej migawki nie da się uczciwie odtworzyć, jeśli źródło trzyma tylko stan bieżący. Stan z 31 stycznia trzeba było zapisać 31 stycznia. To argument za tym, żeby migawkę zacząć zbierać, zanim ktoś o nią zapyta.'
  ],
  takeaway: '<b>Wniosek.</b> Model z historią ma dwa czasy: kiedy coś się wydarzyło i kiedy hurtownia się o tym dowiedziała. Dopóki dane przychodzą na czas, oba są takie same i błędu w ładowaniu nie widać. Dobre pytanie kontrolne do każdego projektu: „co się stanie, gdy ten wiersz przyjdzie tydzień później?”.'
};

/* ------------------------------------------------------------------ etap 4: Warstwa BI */

export interface SemSub { sub: string; customer: string; status: 'active' | 'trialing' | 'past_due' }

export const semantic = {
  question: 'Ilu mamy aktywnych subskrybentów?',
  intro: 'Model w hurtowni jest poprawny, a na trzech dashboardach są trzy liczby. Każdy zespół napisał własne zapytanie i każdy inaczej rozumie słowo „aktywny”. Ustaw definicję albo wybierz zespół.',
  assumptions: 'Ilustracja: osiem subskrypcji z jednego dnia. <code>trialing</code> to okres próbny bez opłaty, <code>past_due</code> to nieudana płatność w okresie karencji.',
  subs: [
    { sub: 'S-1', customer: 'C-101', status: 'active' },
    { sub: 'S-2', customer: 'C-102', status: 'active' },
    { sub: 'S-3', customer: 'C-102', status: 'active' },
    { sub: 'S-4', customer: 'C-103', status: 'active' },
    { sub: 'S-5', customer: 'C-104', status: 'trialing' },
    { sub: 'S-6', customer: 'C-105', status: 'trialing' },
    { sub: 'S-7', customer: 'C-106', status: 'past_due' },
    { sub: 'S-8', customer: 'C-101', status: 'past_due' }
  ] as SemSub[],
  toggles: { trial: 'licz okres próbny', pastDue: 'licz karencję' },
  units: [{ id: 'subscriptions', label: 'subskrypcje' }, { id: 'customers', label: 'klienci' }] as { id: 'subscriptions' | 'customers'; label: string }[],
  presets: [
    { id: 'finance', label: 'Finanse', trial: false, pastDue: false, unit: 'subscriptions', why: 'Liczą to, za co ktoś płaci: opłacone subskrypcje.' },
    { id: 'marketing', label: 'Marketing', trial: true, pastDue: false, unit: 'customers', why: 'Liczą ludzi, do których dotarli, razem z okresem próbnym.' },
    { id: 'product', label: 'Produkt', trial: true, pastDue: true, unit: 'subscriptions', why: 'Liczą każdego, kto ma dostęp do treści.' }
  ] as { id: string; label: string; trial: boolean; pastDue: boolean; unit: 'subscriptions' | 'customers'; why: string }[],
  resultLabel: 'aktywnych subskrybentów według tej definicji',
  takeaway: [
    '<b>Wniosek.</b> Żadna z trzech liczb nie jest błędna, ale razem są bezużyteczne, bo nazywają się tak samo. <b>Warstwa semantyczna</b> (semantic layer) to miejsce między hurtownią a raportami, w którym miarę definiuje się raz: nazwa, wzór, filtr, sposób agregacji. Raport nie pisze własnego SQL-a. Prosi o miarę po nazwie.',
    'Rozwiązaniem nie jest wybranie jednej definicji. Lepsze są trzy miary o trzech różnych nazwach: opłacone subskrypcje, klienci z okresem próbnym, subskrypcje z dostępem. Która z nich jest „tą właściwą”, to spór biznesowy. Model go nie rozstrzygnie.'
  ],
  sketchTitle: 'Jak wygląda definicja zapisana raz',
  sketchIntro: 'Ta sama miara w dwóch narzędziach. To szkice pokazujące kształt definicji, nie kod uruchomiony w ramach tej lekcji.',
  sketches: [
    { tool: 'Power BI (DAX)', code: `Paid Subscriptions =
CALCULATE (
    COUNTROWS ( fact_subscription_daily ),
    dim_status[status] = "active"
)` },
    { tool: 'Looker (LookML)', code: `measure: paid_subscriptions {
  type: count
  filters: [status: "active"]
}` }
  ],
  toolsTitle: 'Gdzie żyje definicja miary',
  tools: [
    '<b>Power BI.</b> Model semantyczny zawiera tabele, relacje i miary zapisane w języku DAX. Miara jest liczona w chwili zapytania, dla filtrów ustawionych akurat w raporcie.',
    '<b>Looker.</b> Wymiary i miary opisuje się w języku LookML, a Looker generuje z nich SQL. Dokumentacja podkreśla zasadę pisania wyrażenia raz, w jednym miejscu.',
    '<b>dbt.</b> MetricFlow, silnik warstwy semantycznej dbt, przyjmuje definicje w YAML i sam buduje SQL ze złączeniami. Dokumentacja deklaruje, że na podstawie typów kluczy unika złączeń powielających wiersze.'
  ]
};

export const cardinality = {
  title: 'Kardynalność: obietnica, którą składasz narzędziu',
  intro: 'Fan-out z etapu Intuicja wraca w warstwie BI. Narzędzie nie zna Twoich danych. O złączeniu wie tyle, ile mu zadeklarujesz: ile wierszy po jednej stronie pasuje do jednego wiersza po drugiej. Na przykład jeden klient ma wiele transakcji. Ta informacja to <b>kardynalność relacji</b> (cardinality).',
  table: {
    name: 'relacje w modelu subskrypcji',
    columns: ['relacja', 'kardynalność', 'co z niej wynika'],
    rows: [
      ['dim_customer → fact_transaction', 'jeden do wielu', 'bezpieczna: filtr idzie z wymiaru do faktu, fakt się nie powiela'],
      ['subscriptions → transactions', 'jeden do wielu', 'miary ze strony „jeden” powielą się po złączeniu'],
      ['product ↔ category', 'wiele do wielu', 'potrzebna tabela pomostowa i decyzja, jak liczyć sumy'],
      ['fact_transaction ↔ fact_subscription_monthly', 'brak relacji', 'dwa fakty łączy się tylko przez wspólne wymiary']
    ]
  } as SampleTable,
  points: [
    '<b>Power BI.</b> Relacja łączy jedną kolumnę jednej tabeli z jedną kolumną drugiej. Strona „jeden” musi mieć unikalne wartości. Jeśli odświeżenie załaduje duplikat, kończy się błędem. Filtr zawsze przechodzi ze strony „jeden” na stronę „wiele”, a opcjonalnie w obie strony.',
    '<b>Filtrowanie w obie strony.</b> Microsoft zaleca ograniczać je do minimum: pogarsza wydajność i tworzy niejednoznaczne ścieżki filtrów. Wyjątkiem jest tabela pomostowa między dwoma wymiarami, gdzie jedna relacja dwukierunkowa jest potrzebna, żeby filtr dotarł do faktu.',
    '<b>Looker.</b> Złączenie ma parametr <code>relationship</code> z wartościami <code>many_to_one</code> (domyślna), <code>one_to_one</code>, <code>one_to_many</code> i <code>many_to_many</code>. Mechanizm symmetric aggregates chroni sumy i liczniki przed fan-outem. Działa pod dwoma warunkami: każdy widok ma unikalny klucz główny, a relacja jest podana poprawnie.'
  ],
  takeaway: '<b>Wniosek.</b> Kardynalność w narzędziu BI to Twoja deklaracja. Narzędzie jej ufa i według niej liczy. Zabezpieczenia przed podwójnym liczeniem działają tylko wtedy, gdy deklaracja zgadza się z danymi, a klucze naprawdę są unikalne. Dlatego unikalność klucza wymiaru testuje się w hurtowni, zanim model trafi do BI.',
  bridge: {
    from: 'dbt',
    known: 'Testy <code>unique</code> i <code>not_null</code> na kluczu głównym oraz <code>relationships</code> między modelami sprawdzają dane przy każdym uruchomieniu.',
    fresh: 'Relacja w modelu semantycznym opisuje to samo założenie, ale po stronie narzędzia BI: która strona jest „jeden”, a która „wiele”.',
    breaks: 'Test w dbt sprawdza dane, a deklaracja w BI zwykle niczego nie sprawdza albo sprawdza dopiero przy odświeżeniu. Oba opisy mogą się rozjechać, jeśli ktoś zmieni ziarno modelu i nie poprawi relacji.'
  } as Bridge
};

export const rls = {
  title: 'Jeden model, wielu najemców',
  intro: 'Wszyscy wydawcy korzystają z tego samego modelu i tych samych raportów. Analityk Aurora Sport nie może zobaczyć przychodu Kino Nord. Wybierz, kto patrzy na raport.',
  assumptions: 'Ilustracja: dziesięć transakcji z pierwszego kwartału. Filtr jest nałożony na wymiar wydawcy i przechodzi relacją do faktu.',
  users: [
    { id: 'aurora', label: 'analityk Aurora Sport', email: 'ola@aurora.example', publishers: ['PUB-AUR'] },
    { id: 'kino', label: 'analityk Kino Nord', email: 'jan@kino.example', publishers: ['PUB-KIN'] },
    { id: 'platform', label: 'finanse platformy', email: 'fin@platform.example', publishers: ['PUB-AUR', 'PUB-KIN'] }
  ],
  mapTitle: 'user_publisher (tabela uprawnień)',
  factTitle: 'fact_transaction widziany przez tę osobę',
  says: 'Widzi {rows} z 10 transakcji, przychód {revenue} EUR. Reguła nie jest wpisana w raport: ten sam raport pokazuje każdemu jego wycinek.',
  takeaway: '<b>Wniosek.</b> <b>Row-level security</b> (RLS) to reguła, która danemu użytkownikowi odcina wiersze, zanim cokolwiek się policzy. W tym modelu regułę nakłada się na wymiar wydawcy. Na fakty przenoszą ją relacje, o ile są aktywne i mają właściwy kierunek filtra. Użytkownik bez przypisanego wydawcy nie ma dostępu. Dlatego klucz wydawcy musi być w każdym fakcie i musi to być ten sam, wspólny wymiar.',
  sketches: [
    { tool: 'Power BI: filtr roli na tabeli uprawnień (DAX)', code: '[email] = USERPRINCIPALNAME()' },
    { tool: 'Looker: filtr na eksploracji (LookML)', code: `access_filter: {
  field: publisher.publisher_id
  user_attribute: publisher_id
}` }
  ],
  caveatsTitle: 'Zastrzeżenia, o które pyta architekt',
  caveats: [
    '<b>Power BI: kogo dotyczy.</b> Według dokumentacji RLS ogranicza dane tylko użytkownikom z uprawnieniem Viewer. Nie dotyczy ról Admin, Member i Contributor w obszarze roboczym. Kto może edytować model, widzi wszystko.',
    '<b>Power BI: gdzie filtrować.</b> Microsoft pisze, że często wydajniej jest nakładać filtr na tabele wymiarów i pozwolić relacjom przenieść go na fakty. Filtry RLS są doklejane do każdego zapytania i mogą je spowolnić.',
    '<b>Looker: domyślnie otwarte.</b> <code>access_filter</code> trzeba dodać do każdej eksploracji, która ma być ograniczona. Eksploracja bez niego pokazuje wszystko. Każdy użytkownik, także administrator, musi mieć ustawioną wartość atrybutu.',
    '<b>Agregaty.</b> Reguła musi obejmować także tabele zagregowane. W Power BI filtr tylko na tabeli szczegółowej sprawia, że agregaty przestają być używane, a filtr tylko na tabeli agregatów jest niedozwolony.',
    '<b>Warstwy.</b> RLS w narzędziu BI chroni tylko ten kanał. Kto ma dostęp do hurtowni, omija go. Przy danych wielu najemców izolację projektuje się też w hurtowni, na przykład politykami dostępu do wierszy.'
  ]
};

export const preagg = {
  title: 'Gotowe agregaty: szybciej, ale nie za darmo',
  intro: 'Tabela transakcji ma miliardy wierszy, a 90% zapytań pyta o przychód per dzień i wydawca. Można policzyć tę odpowiedź raz i trzymać ją w małej tabeli. To <b>pre-agregacja</b>.',
  table: { name: 'agg_revenue_daily_publisher', columns: ['date_key', 'publisher_key', 'revenue_eur', 'txn_count'], rows: [[20260105, 1, '10.00', 1], [20260115, 1, '10.00', 1], [20260120, 1, '96.00', 1], [20260201, 2, '8.00', 1]] } as SampleTable,
  points: [
    '<b>Agregat ma własne ziarno.</b> Tu: dzień × wydawca. Odpowie na pytanie o miesiąc i wydawcę. Na pytanie o produkt nie odpowie, bo produktu w nim nie ma.',
    '<b>Narzędzie powinno wybierać samo.</b> W Power BI agregacje zdefiniowane przez użytkownika przekierowują zapytanie do tabeli agregatów. Gdy ta nie wystarcza, zapytanie wraca do tabeli szczegółowej. Tabela szczegółowa musi być w trybie DirectQuery. To tryb Power BI, w którym raport pyta źródło w chwili wyświetlenia, zamiast korzystać z zaimportowanych danych. W Looker aggregate awareness wybiera najmniejszą tabelę, która odpowie poprawnie. Gdy takiej nie ma, używa tabeli bazowej.',
    '<b>Nie każda miara się zwija.</b> Sumy dzienne dodasz do sumy miesięcznej. Liczby unikalnych klientów nie dodasz: klient aktywny w dwóch dniach zostałby policzony dwa razy. Dokumentacja Looker wymienia jako obsługiwane sumę, licznik, minimum, maksimum i średnią. Licznik unikalnych wartości obsługuje tylko przy dokładnym dopasowaniu tabeli albo w wersji przybliżonej.',
    '<b>Agregat musi być świeży i spójny.</b> Spóźniony fakt albo poprawka wymiaru wstecz wymagają przeliczenia agregatu. Kimball ostrzega przed tym przy typie 1: po nadpisaniu atrybutu trzeba zadbać o przeliczenie tabel zagregowanych, których dotyczy zmiana.'
  ],
  takeaway: '<b>Wniosek.</b> Pre-agregacja to optymalizacja dołożona do modelu atomowego, a nie jego zamiennik. Jeśli użytkownik musi wiedzieć, której tabeli użyć, prędzej czy później ktoś zsumuje agregat, który się nie sumuje.'
};

export interface PlacementCase { setup: string; options: string[]; correct: number; why: string; scope: string }

export const placement = {
  title: 'Hurtownia czy warstwa BI: gdzie umieścić logikę',
  intro: 'Nie ma jednej odpowiedzi „zawsze w hurtowni”. Jest zasada: logikę umieszczasz tam, gdzie skorzystają z niej wszyscy odbiorcy i gdzie da się ją przetestować. Zdecyduj dla czterech przypadków.',
  ask: 'Gdzie to umieścisz?',
  options: ['W hurtowni (model dbt)', 'W warstwie semantycznej (miara)', 'W pojedynczym raporcie'],
  cases: [
    {
      setup: 'Reguła: transakcja testowa ma <code>is_test = true</code> i nie może trafić do żadnej liczby. Z danych korzystają dashboardy, eksport do finansów i model prognozujący rezygnacje.',
      options: [], correct: 0,
      why: 'Odbiorców jest kilku i tylko część przechodzi przez narzędzie BI. Reguła czyszcząca dane musi zadziałać, zanim ktokolwiek je przeczyta, więc należy do hurtowni. Tam też da się ją pokryć testem.',
      scope: 'Jeśli surowe wiersze testowe są komuś potrzebne, zostają w warstwie źródłowej. Tabela faktów ich nie zawiera.'
    },
    {
      setup: 'Odsetek zwrotów: liczba zwrotów podzielona przez liczbę wpłat, dla dowolnego wycinka wybranego przez użytkownika.',
      options: [], correct: 1,
      why: 'Odsetek jest nieaddytywny, czyli nie wolno go sumować ani uśredniać. Policzony w hurtowni dla jednego ziarna będzie błędny w każdym innym. Hurtownia dostarcza oba liczniki, a warstwa semantyczna dzieli je dla wycinka, który akurat wybrał użytkownik.',
      scope: 'Gdy odbiorcą jest tylko jeden raport o stałym ziarnie, wynik w hurtowni też jest poprawny. Problem zaczyna się przy dowolnym krojeniu.'
    },
    {
      setup: 'Przypisanie kraju do regionu sprzedaży (DACH, CEE, Nordics). Regiony zmieniają się raz na rok i używa ich każdy raport.',
      options: [], correct: 0,
      why: 'To atrybut wymiaru: opis, po którym się grupuje. Powinien być kolumną w <code>dim_customer</code> albo osobnym wymiarem, z decyzją o typie historii. Ten sam <code>CASE WHEN</code> skopiowany do dziesięciu raportów rozjedzie się przy pierwszej zmianie.',
      scope: 'Jeśli region ma być raportowany tak, jak obowiązywał w chwili sprzedaży, staje się atrybutem typu 2.'
    },
    {
      setup: 'Na jednym dashboardzie kierownik chce widzieć wydawców posortowanych malejąco i tylko pierwszych dziesięciu.',
      options: [], correct: 2,
      why: 'To sposób prezentacji jednej strony, a nie definicja biznesowa. Nikt inny z niego nie skorzysta. Wciąganie tego do modelu tylko go zaśmieca.',
      scope: 'Gdy „top 10 wydawców” zacznie być używane w rozliczeniach albo pojawi się w kilku raportach, przestaje być prezentacją i wraca do modelu.'
    }
  ] as PlacementCase[],
  takeaway: '<b>Wniosek.</b> W hurtowni: czyszczenie, ziarno, klucze, historia i atrybuty wymiarów, czyli wszystko, co ma być prawdą dla każdego odbiorcy. W warstwie semantycznej: miary, które zależą od kontekstu zapytania, ich nazwy i reguły dostępu. W raporcie: tylko prezentacja. Na rozmowie powiedz, kto jest odbiorcą, a potem dopiero gdzie umieszczasz logikę.'
};

export const tools = {
  title: 'Power BI i Looker: te same pojęcia, inne nazwy',
  intro: 'Jeśli znasz jedno z tych narzędzi, drugie opiszesz przez analogię. Tabela mówi, czemu co odpowiada, a pod nią jest lista miejsc, w których analogia zawodzi.',
  table: {
    name: 'odpowiedniki',
    columns: ['pojęcie', 'Power BI', 'Looker'],
    rows: [
      ['model', 'semantic model: tabele, relacje, miary', 'model LookML: widoki i eksploracje'],
      ['miara', 'miara w DAX', 'measure w LookML'],
      ['złączenie', 'relacja z kardynalnością i kierunkiem filtra', 'join z parametrem relationship'],
      ['ochrona przed fan-outem', 'gwiazda i relacje jeden do wielu', 'symmetric aggregates'],
      ['bezpieczeństwo wierszy', 'role RLS z filtrem DAX', 'access_filter z atrybutem użytkownika'],
      ['pre-agregacja', 'agregacje zdefiniowane przez użytkownika', 'aggregate awareness']
    ]
  } as SampleTable,
  breaksTitle: 'Gdzie analogia się kończy',
  breaks: [
    'Power BI w trybie importu trzyma kopię danych we własnym silniku i na niej liczy miary. Looker wykonuje SQL w hurtowni, gdy nie znajdzie wyniku w cache. Zapisany wynik może użyć ponownie. Tabele PDT (persistent derived tables) przechowuje w bazie. Od tego zależy rozmowa o świeżości danych, koszcie zapytań i miejscu optymalizacji.',
    'W Power BI relacje są częścią modelu i działają stale. W Looker złączenia są zdefiniowane w eksploracji i trafiają do zapytania wtedy, gdy są potrzebne.',
    'Wymiar typu 2 w obu przypadkach przygotowuje się wcześniej. Microsoft pisze wprost, że Power Query nie wykona wyszukania wersji po dacie, a model semantyczny może jedynie załadować gotową tabelę typu 2.'
  ]
};

export const methods = {
  title: 'Kimball, Inmon i Data Vault w trzech akapitach',
  intro: 'Te nazwy padają na rozmowach z architektami. Wystarczy wiedzieć, na jakie pytanie każda odpowiada i gdzie w niej jest model wymiarowy.',
  items: [
    '<b>Kimball.</b> Warstwa, z której czytają raporty, jest wymiarowa i zawiera dane atomowe, czyli najbardziej szczegółowe. Całość spinają wspólne wymiary używane przez wiele tabel faktów. Model buduje się proces po procesie.',
    '<b>Inmon.</b> Dane atomowe trafiają najpierw do znormalizowanej hurtowni całej firmy (enterprise data warehouse). Z niej zasila się wymiarowe data marty dla działów. Ten opis pochodzi z artykułu Kimball Group, czyli od tej strony sporu, która woli własne podejście.',
    '<b>Data Vault.</b> Trzy rodzaje tabel: <b>hub</b> z kluczem biznesowym, <b>link</b> z relacją między hubami i <b>satellite</b> z atrybutami opisowymi i ich historią. Glosariusz Databricks podkreśla śledzenie historii i audytowalność. Umieszcza Data Vault w warstwie pośredniej, a marty wymiarowe do raportowania buduje nad nią.'
  ],
  takeaway: '<b>Wniosek.</b> To nie są trzy konkurencyjne kształty tabel dla raportu. Różnią się tym, jak wygląda warstwa integracji, czyli miejsce, w którym dane z wielu źródeł łączy się w całość. Na końcu, tam gdzie czyta narzędzie BI, w każdym z tych podejść zwykle stoi model wymiarowy. Dobra odpowiedź na rozmowie mówi, jaki problem integracji rozwiązujesz, a nie która szkoła jest lepsza.'
};

/* ------------------------------------------------------------------ etap 5: Projekt */

export interface DesignStep { ask: string; options: string[]; correct: number; why: string }
export interface DesignCase { id: string; title: string; brief: string; steps: DesignStep[]; summary: string }

export const design = {
  title: 'Zaprojektuj to sam',
  intro: 'Trzy zlecenia w formie, w jakiej padają na rozmowie. Przy każdym podejmij decyzje po kolei: proces i rodzaj tabeli faktów, ziarno, wymiary, historia. Zanim klikniesz, powiedz na głos swoje uzasadnienie.',
  cases: [
    {
      id: 'churn', title: 'Raport rezygnacji i MRR',
      brief: 'Zarząd chce co miesiąc widzieć: MRR na koniec miesiąca, liczbę aktywnych subskrypcji oraz ile MRR przybyło z nowych subskrypcji, a ile ubyło przez rezygnacje. W podziale na wydawcę i produkt.',
      steps: [
        {
          ask: 'Jaki rodzaj tabeli faktów jest podstawą?',
          options: ['Transakcyjna: jedna wpłata', 'Okresowa migawka: stan subskrypcji na koniec miesiąca', 'Narastająca migawka: jedna subskrypcja przez całe życie'],
          correct: 1,
          why: 'Pytania dotyczą stanu na koniec okresu i jego zmiany między okresami. Tabela wpłat nie pokaże subskrypcji rocznej w miesiącach bez płatności, a tabela cyklu życia nie ma wiersza na miesiąc.'
        },
        {
          ask: 'Jakie ziarno deklarujesz?',
          options: ['Jeden wiersz na wydawcę na miesiąc', 'Jeden wiersz na klienta na miesiąc', 'Jeden wiersz na subskrypcję na koniec miesiąca'],
          correct: 2,
          why: 'Subskrypcja jest najniższym poziomem, na którym istnieje MRR. Klient może mieć dwie subskrypcje u dwóch wydawców, więc ziarno klienta zgubiłoby wydawcę i produkt. Ziarno wydawcy da się zawsze policzyć z ziarna subskrypcji, w drugą stronę nie.'
        },
        {
          ask: 'Jak policzysz „przybyło” i „ubyło”?',
          options: ['Porównując wiersze tej samej subskrypcji z dwóch kolejnych miesięcy', 'Sumując MRR ze wszystkich miesięcy', 'Licząc wpłaty i zwroty w tabeli transakcji'],
          correct: 0,
          why: 'Subskrypcja obecna w lutym, a nieobecna w styczniu, to nowy MRR. Obecna w styczniu, a nieobecna w lutym, to utracony MRR. Suma MRR po miesiącach nic nie znaczy, bo MRR jest póładdytywny. Wpłaty mówią o gotówce, nie o stanie.'
        },
        {
          ask: 'Produkt zmienił cenę w marcu. Jak ma się zachować raport za luty?',
          options: ['Pokazać nową cenę: wymiar produktu typu 1', 'Nie zmienić się: MRR jest zapisany w migawce jako miara', 'Nie da się tego zapewnić'],
          correct: 1,
          why: 'Wartość, która zmienia się w czasie i wchodzi do obliczeń, zapisuje się w tabeli faktów jako miarę z danego dnia. Lutowa migawka ma lutowy MRR niezależnie od tego, co stanie się z cennikiem. Cena w wymiarze opisuje ofertę, nie to, ile ktoś zapłacił.'
        }
      ],
      summary: 'Model: <code>fact_subscription_monthly</code> o ziarnie subskrypcja × koniec miesiąca, z miarą <code>mrr_eur</code>, obok istniejącej <code>fact_transaction</code>. Wspólne wymiary daty, produktu, wydawcy i klienta. MRR oznaczony jako póładdytywny.'
    },
    {
      id: 'funnel', title: 'Od okresu próbnego do płatności',
      brief: 'Zespół produktu pyta: ile dni mija od rejestracji do pierwszej wpłaty, jaki odsetek okresów próbnych kończy się płatnością i ile subskrypcji utknęło między etapami. Etapy są znane: rejestracja, pierwsza wpłata, rezygnacja.',
      steps: [
        {
          ask: 'Jaki rodzaj tabeli faktów pasuje?',
          options: ['Transakcyjna: jedno zdarzenie', 'Okresowa migawka: stan na koniec miesiąca', 'Narastająca migawka: jedna subskrypcja z datami etapów'],
          correct: 2,
          why: 'Proces ma zdefiniowany początek, etapy pośrednie i koniec, a pytania dotyczą czasu między etapami. Jeden wiersz z datą każdego etapu daje te odpowiedzi odejmowaniem dwóch kolumn. Z tabeli zdarzeń trzeba by za każdym razem łączyć zdarzenia tej samej subskrypcji ze sobą.'
        },
        {
          ask: 'Co ta decyzja oznacza dla ładowania?',
          options: ['Tabela jest tylko dopisywana', 'Wiersze są aktualizowane, gdy subskrypcja osiąga kolejny etap', 'Tabelę trzeba kasować i budować od zera codziennie'],
          correct: 1,
          why: 'Narastająca migawka jest jedynym z trzech rodzajów, w którym wiersz się zmienia. Potrzebny jest MERGE albo UPDATE po kluczu subskrypcji. Pełna przebudowa bywa akceptowalna przy małej tabeli, ale to wybór kosztowy, a nie konieczność.'
        },
        {
          ask: 'Subskrypcja jeszcze nie zapłaciła. Co wpisujesz w kolumnę daty pierwszej wpłaty?',
          options: ['Datę rejestracji', 'Datę dzisiejszą', 'Wartość pustą albo klucz wiersza „jeszcze nie nastąpiło” w wymiarze daty'],
          correct: 2,
          why: 'Etap, którego jeszcze nie było, musi się dać odróżnić od etapu, który już był. Data rejestracji albo dzisiejsza dałyby zero dni do płatności i stuprocentową konwersję. Po pustej wartości albo specjalnym wierszu wymiaru daty widać dokładnie, ile subskrypcji utknęło.'
        },
        {
          ask: 'Zespół chce też widzieć konwersję według kraju klienta z dnia rejestracji. Co robisz?',
          options: ['Wymiar klienta typu 2, klucz wersji z dnia rejestracji zapisany w wierszu', 'Wymiar klienta typu 1', 'Kolumna z krajem dopisana w raporcie'],
          correct: 0,
          why: 'Pytanie mówi „z dnia rejestracji”, czyli wymaga stanu historycznego. Wiersz narastającej migawki zapisuje klucz zastępczy tej wersji klienta, która obowiązywała przy rejestracji. Typ 1 pokazałby kraj obecny.'
        }
      ],
      summary: 'Model: <code>fact_subscription_lifecycle</code>, jeden wiersz na subskrypcję, daty etapów jako klucze do wymiaru daty, miary czasu między etapami. Ładowanie przez MERGE. Klient jako wymiar typu 2.'
    },
    {
      id: 'tenant', title: 'Raporty dla wydawców',
      brief: 'Każdy wydawca ma dostać dostęp do tych samych dashboardów przychodu, ale wyłącznie ze swoimi danymi. Wydawcy mają plan cenowy na platformie (growth, enterprise), który się zmienia. Platforma chce raportować przychód według planu, jaki wydawca miał w chwili transakcji.',
      steps: [
        {
          ask: 'Gdzie umieszczasz klucz wydawcy?',
          options: ['Tylko w wymiarze produktu', 'W każdej tabeli faktów, jako klucz do wspólnego wymiaru wydawcy', 'W osobnym modelu dla każdego wydawcy'],
          correct: 1,
          why: 'Reguła dostępu jest nakładana na wymiar wydawcy i przechodzi relacją do faktów. Żeby objęła każdy fakt, każdy fakt musi mieć klucz tego samego wymiaru. Osobny model na wydawcę mnoży utrzymanie i uniemożliwia raporty platformy.'
        },
        {
          ask: 'Jak modelujesz plan cenowy wydawcy?',
          options: ['Atrybut typu 1 w dim_publisher', 'Atrybut typu 2 w dim_publisher', 'Kolumna w tabeli faktów aktualizowana przy zmianie planu'],
          correct: 1,
          why: 'Wymaganie „według planu z chwili transakcji” to wprost stan historyczny. Typ 1 po zmianie planu przepisałby stary przychód na nowy plan. Aktualizowanie faktów wstecz niszczy to, co miało zostać zachowane.'
        },
        {
          ask: 'Gdzie egzekwujesz regułę „wydawca widzi tylko swoje”?',
          options: ['W każdym raporcie filtrem na stronie', 'W warstwie semantycznej jako RLS na wymiarze wydawcy i dodatkowo w hurtowni', 'Tylko w hurtowni, przez osobne schematy'],
          correct: 1,
          why: 'Filtr w raporcie da się zdjąć albo pominąć w nowym raporcie. RLS w modelu semantycznym obejmuje wszystkie raporty zbudowane na tym modelu. Kto ma dostęp bezpośrednio do hurtowni, omija narzędzie BI, więc izolacja musi istnieć także tam.'
        },
        {
          ask: 'Wymiar wydawcy jest teraz typu 2. Na którą kolumnę nakładasz filtr RLS?',
          options: ['Na klucz zastępczy wersji', 'Na klucz naturalny wydawcy', 'Na nazwę wydawcy'],
          correct: 1,
          why: 'Klucz zastępczy zmienia się przy każdej nowej wersji, więc uprawnienie przypięte do niego przestałoby działać po zmianie planu. Nazwa może się zmienić. Klucz naturalny jest ten sam we wszystkich wersjach i wskazuje wydawcę, a nie jego wersję.'
        }
      ],
      summary: 'Model: <code>dim_publisher</code> jako wspólny wymiar typu 2 z kluczem w każdym fakcie. Tabela uprawnień użytkownik–wydawca po kluczu naturalnym. RLS na wymiarze w warstwie semantycznej oraz polityka dostępu w hurtowni.'
    }
  ] as DesignCase[],
  mistakesTitle: 'Błędy, po których rozmówca przestaje ufać projektowi',
  mistakes: [
    '<b>Wymiary przed ziarnem.</b> Lista kolumn bez zdania „jeden wiersz to...”. Każdą dalszą decyzję trzeba wtedy zgadywać.',
    '<b>Dwa ziarna w jednej tabeli.</b> Wiersze nagłówka zamówienia i pozycji razem, albo wiersze dzienne i wiersz „razem za miesiąc”. Każda suma liczy coś dwa razy.',
    '<b>Złączenie faktu z faktem.</b> Dwie tabele faktów połączone bezpośrednio po kluczu, zamiast osobnej agregacji do wspólnego wymiaru.',
    '<b>Sumowanie stanu po czasie.</b> MRR albo saldo dodane po miesiącach.',
    '<b>Odsetek zapisany w fakcie.</b> Gotowy procent zamiast licznika i mianownika.',
    '<b>Typ 1 tam, gdzie pytają o historię.</b> Raport za zamknięty kwartał zmienia się po aktualizacji wymiaru.',
    '<b>Typ 2 złączony po kluczu naturalnym bez dat.</b> Każda wersja pasuje do każdego faktu.',
    '<b>Przedziały ważności domknięte z obu stron.</b> Zdarzenie z dnia zmiany pasuje do dwóch wersji.',
    '<b>Ta sama miara zdefiniowana w trzech raportach.</b> Trzy liczby pod jedną nazwą.',
    '<b>Bezpieczeństwo tylko w raporcie.</b> Filtr na stronie zamiast reguły w modelu.'
  ]
};

/* ------------------------------------------------------------------ etap 6: Interview */

/** Pytanie, krótka odpowiedź i follow-upy przychodzą z Interview Banku. Tu jest tylko to, czego bank nie zawiera. */
export const interview = {
  frameTitle: 'Jak bronić decyzji projektowej',
  frameIntro: 'Rozmówca od BI i architektury rzadko pyta o definicję. Pyta „dlaczego tak”. Odpowiedź, która się broni, ma cztery części: pytanie biznesowe, decyzja, alternatywa, koszt.',
  frameEn: 'The business needs month-end MRR by publisher. So the grain is one row per subscription per month-end. I considered deriving it from payments. But an annual plan has no payment in most months, so the state would be wrong. The trade-off is one more table to load, and a measure that must not be summed across time. I’d enforce that in the semantic layer.',
  framePl: 'Biznes potrzebuje MRR na koniec miesiąca per wydawca. Dlatego ziarno to jedna subskrypcja na koniec miesiąca. Rozważałem liczenie tego z wpłat. Ale plan roczny w większości miesięcy nie ma wpłaty, więc stan byłby błędny. Koszt to dodatkowa tabela do ładowania i miara, której nie wolno sumować po czasie. Tego ostatniego pilnowałbym w warstwie semantycznej.',
  relatedTitle: 'Te same pytania w Interview Banku',
  relatedIntro: 'W banku każde z nich ma też wyjaśnienie mechanizmu i listę typowych błędów.'
};

/* ------------------------------------------------------------------ etap 7: Sprawdź się */

export interface QuizItem { q: string; setup?: string; options: string[]; correct: number; why: string }

export const quiz: QuizItem[] = [
  {
    q: 'Od czego zaczynasz projekt tabeli faktów?',
    options: ['Od listy kolumn dostępnych w źródle', 'Od wyboru procesu biznesowego i zadeklarowania ziarna', 'Od wyboru wymiarów', 'Od ustalenia, które miary są addytywne'],
    correct: 1,
    why: 'Ziarno deklaruje się przed wymiarami i miarami, bo każdy wymiar i każda miara muszą być z nim zgodne. Lista kolumn ze źródła mówi, co jest dostępne, a nie co ma opisywać jeden wiersz.'
  },
  {
    q: 'Tabela subskrypcji (4 wiersze, kolumna <code>mrr</code>) jest złączona z tabelą transakcji (6 wierszy) po <code>subscription_id</code>. Co się stanie z <code>SUM(mrr)</code>?',
    setup: 'Założenie: dwie subskrypcje mają po dwie transakcje, dwie po jednej.',
    options: ['Nic, suma liczy każdą subskrypcję raz', 'Będzie zawyżona, bo wiersze subskrypcji z dwiema transakcjami się powielą', 'Będzie zaniżona, bo część subskrypcji wypadnie', 'Zapytanie zwróci błąd'],
    correct: 1,
    why: 'Złączenie w stronę „wiele” powiela wiersz strony „jeden” tyle razy, ile ma dopasowań. MRR dwóch subskrypcji policzy się podwójnie. Baza nie zgłosi błędu, bo zapytanie jest poprawne składniowo.'
  },
  {
    q: 'Pytanie biznesowe: „ile aktywnych subskrypcji mieliśmy na koniec każdego miesiąca?”. Która tabela faktów odpowiada na nie bezpośrednio?',
    options: ['Transakcyjna z wpłatami', 'Okresowa migawka', 'Narastająca migawka', 'Tabela faktów bez miar'],
    correct: 1,
    why: 'Okresowa migawka ma wiersz na każdy okres, także wtedy, gdy nic się nie wydarzyło. Tabela wpłat nie ma wiersza dla subskrypcji rocznej w miesiącu bez płatności, więc stan trzeba by z niej odtwarzać.'
  },
  {
    q: 'MRR na koniec stycznia, lutego i marca to 28, 36 i 26. Jaki jest MRR pierwszego kwartału?',
    options: ['90, suma trzech miesięcy', '26 jako stan na koniec kwartału albo 30 jako średnia', '36, wartość najwyższa', 'Nie da się tego określić'],
    correct: 1,
    why: 'MRR to miara póładdytywna: sumuje się po subskrypcjach i wydawcach w ramach jednego dnia, ale nie po czasie. Dla okresu podaje się stan z ostatniego dnia albo średnią, a wybór trzeba nazwać w definicji miary.'
  },
  {
    q: 'Dlaczego fakt wskazuje wymiar typu 2 kluczem zastępczym, a nie naturalnym?',
    options: ['Bo liczby całkowite zajmują mniej miejsca', 'Bo klucz naturalny powtarza się w każdej wersji wiersza, więc nie wskazuje jednej wersji', 'Bo klucze naturalne są zakazane w hurtowni', 'Bo narzędzia BI nie obsługują tekstu w relacjach'],
    correct: 1,
    why: 'W typie 2 jeden klient ma kilka wierszy z tym samym kluczem naturalnym. Tylko klucz zastępczy wskazuje konkretną wersję. Klucz naturalny zostaje w wymiarze jako kolumna i służy do wyszukania wersji przy ładowaniu.'
  },
  {
    q: 'Klient zmienił kraj 10 lutego. Wymiar jest typu 1. Co pokaże raport „przychód per kraj” za styczeń, uruchomiony w marcu?',
    options: ['Styczniowe wpłaty klienta w starym kraju', 'Styczniowe wpłaty klienta w nowym kraju', 'Styczniowe wpłaty klienta w obu krajach', 'Raport pominie tego klienta'],
    correct: 1,
    why: 'Typ 1 nadpisuje atrybut, więc hurtownia zna tylko nowy kraj i przypisuje do niego całą historię. Suma się nie zmienia, zmienia się podział. Raport za zamknięty okres daje dziś inny wynik niż dawał w styczniu.'
  },
  {
    q: 'Wymiar typu 2 ma przedziały <code>valid_from</code>–<code>valid_to</code>. Fakt złączono z nim tylko po <code>customer_id</code>. Jaki będzie skutek?',
    options: ['Fakt dostanie wersję bieżącą', 'Fakt dostanie najstarszą wersję', 'Każdy fakt klienta z dwiema wersjami pojawi się dwa razy', 'Baza zwróci błąd niejednoznaczności'],
    correct: 2,
    why: 'Bez warunku na daty każda wersja klienta pasuje do każdego jego faktu. To fan-out: kwoty liczą się tyle razy, ile klient ma wersji. Potrzebny jest warunek na datę zdarzenia albo złączenie po kluczu zastępczym.'
  },
  {
    q: '25 marca dociera transakcja z datą wpłaty 8 lutego. Klient zmienił kraj 10 lutego. Który klucz wymiaru zapisze poprawne ładowanie?',
    options: ['Klucz wersji bieżącej, bo ładowanie odbywa się w marcu', 'Klucz wersji obowiązującej 8 lutego', 'Klucz wiersza „nieznany”', 'Żaden, spóźnione transakcje się odrzuca'],
    correct: 1,
    why: 'Liczy się moment zdarzenia, a nie moment załadowania. Ładowanie przeszukuje historię wymiaru i wybiera wersję, w której przedziale ważności mieści się 8 lutego. Wiersz „nieznany” jest na sytuację, w której klienta w wymiarze w ogóle nie ma.'
  },
  {
    q: 'Trzy dashboardy pokazują trzy różne liczby „aktywnych subskrybentów” z tej samej, poprawnej hurtowni. Co jest przyczyną?',
    options: ['Błąd w ładowaniu danych', 'Miara jest zdefiniowana osobno w każdym raporcie', 'Zbyt niskie ziarno tabeli faktów', 'Brak kluczy zastępczych'],
    correct: 1,
    why: 'Każdy raport ma własny filtr statusów i własną jednostkę liczenia. Dane są te same, różni się definicja. Miarę definiuje się raz w warstwie semantycznej, a różne znaczenia dostają różne nazwy.'
  },
  {
    q: 'W Power BI nałożono RLS na wymiar wydawcy. Kto zobaczy dane wszystkich wydawców?',
    options: ['Nikt, RLS obowiązuje każdego', 'Użytkownicy z rolą Viewer', 'Użytkownicy z rolą Admin, Member albo Contributor w obszarze roboczym', 'Tylko autor raportu'],
    correct: 2,
    why: 'Według dokumentacji Microsoft RLS ogranicza dane wyłącznie użytkownikom z uprawnieniem Viewer. Role, które mogą edytować zawartość obszaru roboczego, nie są objęte regułą. Dlatego wydawcom nadaje się wyłącznie Viewer.'
  }
];

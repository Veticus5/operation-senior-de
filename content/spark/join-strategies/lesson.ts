import type { Bridge, ExplainedLine, LessonMeta } from '../../types';

/**
 * Lekcja 04: Spark Join Strategies. Trzy strategie joina z warunkiem równości (broadcast hash,
 * sort merge, shuffled hash), to, jak Apache Spark między nimi wybiera, i dlaczego broadcast
 * nie zawsze jest najlepszy.
 *
 * Skąd są fakty (docs/verified-facts.md, sekcja „Lekcja 04"):
 * - plany fizyczne, szacunki rozmiaru i liczniki shuffle'u: labs/join_strategies/join_strategies_lab.py,
 *   PySpark 4.0.1 i 4.3.0, local[3],
 * - reguły wyboru, progi i limity: dokumentacja Apache Spark 4.3.0 oraz komentarze i stałe w kodzie
 *   źródłowym Apache Spark (gałąź branch-4.0), dokumentacja Databricks.
 *
 * Obie wizualizacje (krok po kroku i rachunek rozmiarów) są ilustracjami w JavaScripcie. Żadna z nich
 * nie jest optymalizatorem Sparka i żadna nie mówi, co Spark „wybierze": pokazują mechanizm i koszty.
 * Pytania rekrutacyjne, krótkie odpowiedzi i follow-upy przychodzą z Interview Banku (ten sam topicId).
 */
export const meta: LessonMeta = {
  id: 'spark-join-strategies',
  topicId: 'spark.broadcast-join',
  area: 'spark',
  title: 'Spark Join Strategies: Broadcast, Sort Merge, Shuffled Hash',
  subtitle: 'Jak Spark zbiera pasujące wiersze w jednym miejscu, na jakiej podstawie wybiera strategię i kiedy broadcast szkodzi.',
  minutes: 28
};

export const labId = 'spark-join-strategies-lab';
export const labHint = 'Wydruk zawiera odpowiedzi do trzech eksperymentów niżej. Najpierw je przewidź, potem uruchom i porównaj.';

export type StrategyId = 'bhj' | 'smj' | 'shj';

/** Próbka danych wspólna dla obu wizualizacji. Dane są wymyślone. `exec` to executor, na którym wiersz leży na starcie. */
export const sample = {
  customers: [
    { id: 101, country: 'PL', exec: 1 },
    { id: 102, country: 'DE', exec: 0 },
    { id: 103, country: 'FR', exec: 0 },
    { id: 104, country: 'PL', exec: 1 }
  ],
  transactions: [
    { txn: 't1', customer: 103, amount: '120.00', exec: 0 },
    { txn: 't2', customer: 101, amount: '35.50', exec: 0 },
    { txn: 't3', customer: 104, amount: '9.99', exec: 0 },
    { txn: 't4', customer: 102, amount: '410.00', exec: 1 },
    { txn: 't5', customer: 101, amount: '18.20', exec: 1 },
    { txn: 't6', customer: 104, amount: '77.00', exec: 1 }
  ]
};

/** Krok etapu Intuicja. `visual` wstawia ilustrację między `html` a `after`. */
export interface Beat {
  html: string;
  visual?: 'scatter';
  after?: string;
  next: string;
  bridge?: Bridge;
  more?: { title: string; html: string[] };
}

export const beats: Beat[] = [
  {
    html: '<h1>Jedna linijka SQL. Wiele maszyn.</h1>\n<p class="lede">Chcesz do każdej transakcji dopisać kraj klienta. W SQL to jeden JOIN i więcej o nim nie myślisz.</p>\n<pre class="code">SELECT t.txn_id, t.amount, c.country\nFROM transactions t\nJOIN customers c ON t.customer_id = c.customer_id</pre>\n<p>W Sparku żadna z tych tabel nie leży w jednym miejscu. Każda jest pocięta na kawałki, czyli <term id="partition">partycje</term>. Partycje leżą na różnych <term id="executor">executorach</term>, czyli w różnych procesach roboczych. <b>Gdzie w takim razie leżą wiersze, które mają się połączyć?</b> Wybierz klienta.</p>',
    visual: 'scatter',
    after: '<b>Wniosek.</b> Executor połączy tylko te wiersze, które ma u siebie. Dlatego Spark najpierw musi zebrać pasujące wiersze w jednym miejscu. Ma na to dwa sposoby. Pierwszy: przenieść wiersze obu tabel tak, żeby ten sam klucz zawsze trafiał w to samo miejsce. Drugi: dać każdemu executorowi pełną kopię mniejszej tabeli.',
    more: {
      title: 'Co ta ilustracja upraszcza',
      html: [
        'Sześć transakcji i czterech klientów to próbka. W prawdziwej tabeli jedna partycja ma zwykle dziesiątki albo setki megabajtów.',
        'Czasem pasujące wiersze już leżą razem, na przykład gdy obie tabele zostały wcześniej podzielone po tym samym kluczu. Wtedy przenoszenie może nie być potrzebne. Ta lekcja pokazuje przypadek typowy, w którym trzeba je dopiero zebrać.'
      ]
    },
    next: 'Jakie ma na to sposoby?'
  },
  {
    html: '<h2>Trzy strategie, ten sam wynik</h2>\n<p>Spark składa je z dwóch klocków. Pierwszy już znasz: przenoszenie wierszy tak, żeby ten sam klucz trafił do tej samej partycji, to <term id="shuffle">shuffle</term> z poprzednich lekcji. Drugi to <b>tablica hashująca</b> (hash table). To słownik w pamięci: podajesz klucz i od razu dostajesz wiersz, tak jak w <code>dict</code> w Pythonie.</p>\n<ul>\n<li><b>Broadcast hash join.</b> Mała tabela trafia w całości do każdego executora jako tablica hashująca. Duża tabela zostaje na miejscu.</li>\n<li><b>Sort merge join.</b> Najpierw shuffle obu tabel po kluczu. Potem sortowanie i przejście przez dwa posortowane ciągi naraz.</li>\n<li><b>Shuffled hash join.</b> Też shuffle obu tabel po kluczu. Ale zamiast sortować, Spark w każdej partycji buduje tablicę hashującą z jednej tabeli, zwykle mniejszej.</li>\n</ul>\n<p>Wynik jest za każdym razem ten sam. Różni się koszt: ile danych jedzie po sieci, czy trzeba sortować i ile musi zmieścić się w pamięci.</p>',
    bridge: {
      from: 'Snowflake',
      known: 'Piszesz JOIN, a hurtownia sama decyduje, jak połączyć tabele i jak rozłożyć dane. Zwykle w ogóle o tym nie myślisz.',
      fresh: 'Spark też wybiera sam, ale jego wybór widać w planie zapytania. Węzeł joina nazywa się <code>BroadcastHashJoin</code>, <code>SortMergeJoin</code> albo <code>ShuffledHashJoin</code>. Możesz na ten wybór wpłynąć: progiem rozmiaru, wskazówką w kodzie (hint) i statystykami. O tym jest etap Praktyka.',
      breaks: 'W Sparku skutki złego wyboru spadają na Ciebie. Spark wybiera na podstawie szacunku rozmiaru, a ten bywa błędny. Rozesłanie zbyt dużej tabeli może skończyć się brakiem pamięci. Dlatego musisz umieć przeczytać plan i ocenić, czy wybór ma sens.'
    },
    next: 'Zobacz je krok po kroku'
  }
];

/** Ilustracja z pierwszego kroku: gdzie leżą wiersze jednego klienta. W komunikacie {id}, {tx} i {cust} podstawia komponent. */
export const scatter = {
  assumptions: 'Ilustracja: 6 transakcji i 4 klientów rozłożone na 2 executory. Dane są wymyślone.',
  pick: 'Klient',
  split: 'Klient {id}: transakcje leżą na {tx}, a jego wiersz z tabeli customers na {cust}. Żaden executor nie ma u siebie kompletu.',
  together: 'Klient {id}: transakcje leżą na {tx}, a jego wiersz z tabeli customers na {cust}. Tu akurat jeden executor ma komplet, ale to przypadek, na którym Spark nie może polegać.'
};

export interface SimStep { title: string; text: string }
/**
 * Etap Mechanizm, część 1: ta sama próbka, trzy strategie, krok po kroku.
 * Krok 0 to stan początkowy. Układ sceny dla każdego kroku liczy komponent JoinSim.
 */
export const sim = {
  question: 'Jak każda strategia zbiera pasujące wiersze w jednym miejscu?',
  intro: 'Te same dwie tabele i ten sam join, trzy strategie. Wybierz strategię i przechodź krok po kroku. Patrz na trzy rzeczy: które wiersze zmieniają miejsce, czy coś jest sortowane i co musi leżeć w pamięci.',
  assumptions: 'Model uproszczony: join wewnętrzny po <code>customer_id</code>, 2 executory, a po shuffle\'u 2 partycje. „Hash" to tutaj parzystość klucza: klucze nieparzyste trafiają do partycji A, parzyste do B.',
  strategies: [
    { id: 'bhj', label: 'Broadcast hash' },
    { id: 'smj', label: 'Sort merge' },
    { id: 'shj', label: 'Shuffled hash' }
  ] as { id: StrategyId; label: string }[],
  steps: {
    bhj: [
      { title: 'Start', text: 'Każdy executor ma swoją partycję transakcji i swoją partycję klientów. Pasujące wiersze są rozrzucone.' },
      { title: 'Driver zbiera małą tabelę', text: 'Wszystkie wiersze customers trafiają do drivera, czyli procesu, który kieruje pracą executorów. Driver buduje z nich tablicę hashującą. Cała mała tabela leży teraz w pamięci jednego procesu.' },
      { title: 'Kopia do każdego executora', text: 'Driver rozsyła tablicę. Każdy executor trzyma w pamięci pełną kopię customers. Transakcje nie ruszyły się z miejsca.' },
      { title: 'Łączenie na miejscu', text: 'Każdy executor czyta swoje transakcje i dla każdej wyszukuje klienta w tablicy. Nie było shuffle\'u ani sortowania dużej tabeli.' }
    ],
    smj: [
      { title: 'Start', text: 'Każdy executor ma swoją partycję transakcji i swoją partycję klientów. Pasujące wiersze są rozrzucone.' },
      { title: 'Shuffle obu tabel', text: 'Każdy wiersz obu tabel jest zapisywany do shuffle\'u. O tym, do której partycji trafi, decyduje hash klucza. Dlatego ten sam customer_id z obu tabel ląduje w tej samej partycji.' },
      { title: 'Sortowanie w partycjach', text: 'W każdej partycji obie strony są sortowane po customer_id. Tego kosztu pozostałe dwie strategie nie mają.' },
      { title: 'Merge', text: 'Spark idzie równocześnie przez oba posortowane ciągi i łączy wiersze o równym kluczu. Nie musi trzymać w pamięci żadnej strony w całości.' }
    ],
    shj: [
      { title: 'Start', text: 'Każdy executor ma swoją partycję transakcji i swoją partycję klientów. Pasujące wiersze są rozrzucone.' },
      { title: 'Shuffle obu tabel', text: 'Tak samo jak w sort merge. Każdy wiersz obu tabel trafia do partycji, którą wyznacza hash klucza.' },
      { title: 'Tablica hashująca w każdej partycji', text: 'Zamiast sortować, każdy task buduje tablicę hashującą ze swojego kawałka jednej strony, tutaj customers. Ten kawałek musi zmieścić się w pamięci taska.' },
      { title: 'Łączenie przez wyszukiwanie', text: 'Task czyta swoje transakcje i dla każdej wyszukuje klienta w tablicy swojej partycji. Shuffle był, sortowania nie było.' }
    ]
  } as Record<StrategyId, SimStep[]>,
  /** Liczniki pod sceną. Wartości dla bieżącego kroku liczy komponent z próbki. */
  counters: {
    labels: ['wierszy zapisanych do shuffle\'u', 'stron sortowanych', 'kopii całej tabeli customers w tym modelu'],
    notes: {
      bhj: 'W tym modelu trzy kopie: jedna na driverze i po jednej na każdym executorze. Licznik pokazuje, w ilu miejscach tabela musi się zmieścić. Nie jest dokładnym stanem pamięci w jednej chwili.',
      smj: 'Do shuffle\'u trafia każdy wiersz obu tabel: 6 transakcji i 4 klientów.',
      shj: 'W pamięci nie ma całej tabeli. Ale każdy task trzyma jako tablicę hashującą swoją partycję tej strony, z której ją buduje, tutaj customers.'
    } as Record<StrategyId, string>
  },
  takeaway: [
    '<b>Wniosek.</b> Każda strategia płaci czym innym. <b>Broadcast hash join</b> nie rusza dużej tabeli. Za to mała musi w całości zmieścić się w pamięci: na driverze i na każdym executorze. <b>Sort merge join</b> przenosi i sortuje obie strony. Za to żadnej z nich nie potrzebuje w pamięci w całości. <b>Shuffled hash join</b> przenosi obie strony i nie sortuje. Ale każdy task trzyma w pamięci swój kawałek tej strony, z której buduje tablicę.',
    'Ta strona, z której powstaje tablica hashująca, ma w planach Sparka nazwę <b>build side</b>. Zobaczysz ją jako <code>BuildRight</code> albo <code>BuildLeft</code>. Spark wybiera ją spośród stron, na które pozwala typ joina. Zwykle jest to strona mniejsza, ale nie zawsze. Czasem to strona wskazana hintem, a czasem jedyna dozwolona.'
  ],
  notesTitle: 'Co tu jest uproszczeniem',
  notes: [
    'To animacja w JavaScripcie. Nie działa tu żaden Spark i nic nie jest tu wybierane: strategię wskazujesz Ty.',
    'Prawdziwy hash to nie parzystość. Partycji po shuffle\'u jest w Apache Spark domyślnie 200 (<code>spark.sql.shuffle.partitions</code>). <term id="aqe">AQE</term> może je potem skleić w mniejszą liczbę.',
    '„Zapisane do shuffle\'u" nie znaczy „wysłane na inną maszynę". Wiersz trafia do plików shuffle\'u także wtedy, gdy jego partycję policzy potem ten sam executor. W labie sort merge join zapisał do shuffle\'u wszystkie 200 000 transakcji i wszystkich 2 000 klientów.',
    'Shuffle i sortowanie pojawiają się wtedy, gdy są potrzebne. Jeśli dane są już podzielone albo posortowane po kluczu w zgodny sposób, Spark może pominąć shuffle (w planie <code>Exchange</code>) albo sortowanie (<code>Sort</code>). Model pokazuje przypadek typowy, w którym nie są.',
    'Licznik kopii to uproszczenie. Liczy miejsca, w których cała mała tabela musi się zmieścić. Nie jest dokładnym opisem pamięci w jednej chwili. Tabela jest rozsyłana blokami, executory mogą pobierać bloki także od siebie nawzajem, a tablica hashująca zajmuje inną ilość pamięci niż dane w pliku.',
    'Model pokazuje join wewnętrzny z warunkiem równości. Przy innych typach joina część strategii odpada. O tym jest etap Praktyka.',
    'To, że mała tabela przechodzi przez driver, dotyczy Apache Spark. Widać to nawet w komunikacie błędu: gdy przy broadcaście zabraknie pamięci, Spark radzi zwiększyć pamięć drivera albo wyłączyć broadcast.'
  ]
};

/**
 * Etap Mechanizm, część 2: rachunek dla dużych tabel. Arytmetyka na jawnych założeniach, nie pomiar
 * i nie model optymalizatora. W tekstach {…} podstawia komponent SizeLab.
 */
export const sizes = {
  title: 'A gdy tabele urosną?',
  intro: 'Mechanizm jest ten sam dla 4 klientów i dla 40 GB. Zmienia się koszt. Ustaw rozmiary obu tabel i porównaj, co każda strategia musiałaby zrobić.',
  assumptions: 'Ilustracja, nie pomiar i nie optymalizator Sparka. Założenia: 20 executorów, 200 partycji po shuffle\'u (wartość domyślna Apache Spark), klucze rozłożone równo. Rozmiar oznacza tu dane potrzebne w joinie w takiej postaci, w jakiej trzyma je Spark, a nie rozmiar plików. Liczby mówią, ile danych logicznie trzeba przenieść. Nie są to bajty faktycznie wysłane po sieci: na nie wpływają m.in. kompresja, lokalny odczyt shuffle\'u i sposób rozsyłania broadcastu.',
  executors: 20,
  shufflePartitions: 200,
  /** Rozmiary w MB. */
  customersMb: [8, 300, 4096, 40960],
  defaultCustomersMb: 8,
  transactionsMb: [51200, 512000],
  defaultTransactionsMb: 51200,
  customersLabel: 'customers',
  transactionsLabel: 'transactions',
  rows: { network: 'Do przeniesienia', sort: 'Sortowanie', memory: 'W pamięci naraz' },
  bhj: {
    name: 'Broadcast hash join',
    network: 'kopia customers dla każdego z {copies} executorów: łącznie ok. {broadcastNet}',
    sort: 'brak',
    memory: 'cała tabela customers, {customers}, na driverze i na każdym executorze',
    /** Werdykt dla kolejnych rozmiarów customers. */
    verdicts: [
      { state: 'ok', text: 'Apache Spark ma próg rozmiaru, poniżej którego sam sięga po broadcast: domyślnie 10 MB. 8 MB to mniej. Jeśli szacunek Sparka zgadza się z rzeczywistością i typ joina na to pozwala, Apache Spark wybierze tę strategię sam. Duża tabela zostaje na miejscu.' },
      { state: 'risk', text: '300 MB to więcej niż domyślny próg 10 MB, więc Spark sam tej strategii nie zaplanuje. Trzeba by go o nią poprosić wskazówką w kodzie (hint) albo podnieść próg. Zadziała, jeśli driver i każdy executor mają na tę tabelę zapas pamięci.' },
      { state: 'risk', text: 'Do rozesłania jest łącznie ok. 80 GB kopii. Do tego ok. 4 GB musi zmieścić się w pamięci drivera i każdego z 20 executorów. Jeśli pomylisz się w ocenie rozmiaru, grozi brak pamięci, a nie tylko wolniejsze zapytanie.' },
      { state: 'no', text: 'Tabelę przygotowaną do rozesłania kod Sparka nazywa relacją. Zakładamy, że ma ona tu 40 GB. W sprawdzonej implementacji Apache Spark 4.0 relacja, która po zbudowaniu ma 8 GB albo więcej, kończy zapytanie błędem, także z hintem. Limit dotyczy zbudowanej relacji, a nie rozmiaru plików ani tabeli na dysku.' }
    ] as { state: 'ok' | 'risk' | 'no'; text: string }[]
  },
  smj: {
    name: 'Sort merge join',
    network: 'shuffle obu tabel: łącznie ok. {shuffleNet}',
    sort: 'obie strony, w każdej partycji',
    memory: 'żadna strona w całości; średnia partycja po shuffle\'u to {partition}',
    verdict: { state: 'ok', text: 'Nie potrzebuje całej strony w pamięci, więc sam rozmiar tabel go nie wyklucza. Płacisz za to shuffle\'em obu tabel i sortowaniem. Dlatego to typowy wybór dla dwóch dużych tabel. O tym, czy się uda, decydują rozmiary partycji i rozkład kluczy, a nie rozmiar całości.' }
  },
  shj: {
    name: 'Shuffled hash join',
    network: 'shuffle obu tabel: łącznie ok. {shuffleNet}',
    sort: 'brak',
    memory: 'jedna partycja strony build (customers) na task: średnio {buildPartition}',
    verdict: { state: 'risk', text: 'Nie sortuje, ale każdy task musi zmieścić w pamięci swoją partycję strony build. Średnia niczego nie gwarantuje: wszystkie wiersze jednego klucza trafiają do jednej partycji, nawet gdy jest ich ogromnie dużo. Apache Spark domyślnie woli sort merge, więc tę strategię zobaczysz zwykle po hincie.' }
  },
  compare: {
    more: 'W tym szacunku broadcast ma do przeniesienia więcej danych (ok. {broadcastNet}) niż shuffle obu tabel (ok. {shuffleNet}).',
    less: 'W tym szacunku broadcast ma do przeniesienia mniej danych (ok. {broadcastNet}) niż shuffle obu tabel (ok. {shuffleNet}). Ceną jest pamięć: ok. {customers} w każdym z {places} procesów.'
  },
  takeaway: '<b>Wniosek.</b> Broadcast wygrywa, gdy mała strona jest naprawdę mała. Jego koszt rośnie i z rozmiarem tabeli, i z liczbą executorów, bo każdy dostaje własną kopię. Pamięci musi wystarczyć we wszystkich tych miejscach naraz. Dla dwóch dużych tabel zwykle bezpieczniejszy jest sort merge join. „Broadcast jest najszybszy" to prawda pod warunkiem, a nie reguła.',
  limitsTitle: 'Twarde granice broadcastu w Apache Spark',
  limits: [
    'Rozmiar: relacja, czyli tabela zbudowana do rozesłania, która ma 8 GB albo więcej, kończy zapytanie błędem. To stała w sprawdzonym kodzie Apache Spark 4.0, a nie ustawienie. Dotyczy zbudowanej relacji, a nie rozmiaru plików ani tabeli na dysku. Dlatego plik dużo mniejszy niż 8 GB też może ten limit przekroczyć.',
    'Liczba wierszy: 512 milionów, a dla typowej tablicy hashującej z kluczem innym niż pojedyncza liczba całkowita ok. 341 milionów. To też stałe z kodu źródłowego 4.0.',
    'Czas: na zbudowanie i rozesłanie tabeli Spark czeka domyślnie 300 sekund (<code>spark.sql.broadcastTimeout</code>).',
    'Pamięć: gdy przy broadcaście zabraknie pamięci, komunikat błędu radzi wyłączyć automatyczny broadcast (próg <code>-1</code>) albo zwiększyć pamięć drivera. To wskazówka, gdzie tabela jest budowana.',
    'Te liczby dotyczą Apache Spark. Databricks i silnik Photon mogą mieć własne ograniczenia, których ta lekcja nie sprawdzała.'
  ],
  shjTitle: 'Dlaczego nie zawsze shuffled hash, skoro nie sortuje',
  shjNotes: [
    'W Apache Spark jest ustawienie <code>spark.sql.join.preferSortMergeJoin</code>, domyślnie włączone. Jego opis w kodzie mówi dwie rzeczy. Sort merge join zużywa mniej pamięci i działa wydajnie, gdy obie tabele są duże. Shuffled hash join może być szybszy, gdy jedna z tabel jest dużo mniejsza.',
    'Gdy je wyłączysz, Spark i tak stawia dwa warunki. Szacowany rozmiar strony musi być mniejszy niż próg broadcastu razy liczba partycji shuffle\'u (domyślnie 10 MB × 200, czyli ok. 2 GB). Strona musi też być co najmniej 3 razy mniejsza od drugiej (<code>spark.sql.shuffledHashJoinFactor</code>).',
    'Komentarz w kodzie mówi wprost: budowanie tablicy hashującej zużywa dużo pamięci i przy dużej stronie może skończyć się jej brakiem.'
  ]
};

/** Etap Praktyka, część 1: ten sam join, trzy prawdziwe plany. Linie FileScan są skrócone do listy kolumn. */
const SCAN_TX = 'FileScan parquet [txn_id#11L,customer_id#12L,amount#13]';
const SCAN_CUST = 'FileScan parquet [customer_id#8L,country#9]';
const scanTx = (indent: string): ExplainedLine => ({
  code: `${indent}+- ${SCAN_TX}`,
  label: 'FROM transactions',
  text: 'Odczyt dużej tabeli. Spark czyta tylko trzy kolumny potrzebne w zapytaniu. Pełna linia w labie zawiera jeszcze m.in. <code>PushedFilters</code> i <code>ReadSchema</code>.'
});
const scanCust = (indent: string): ExplainedLine => ({
  code: `${indent}+- ${SCAN_CUST}`,
  label: 'FROM customers',
  text: 'Odczyt małej tabeli. Z trzech kolumn Spark czyta dwie: klucz i <code>country</code>. To ważne dla wyboru strategii, bo Spark szacuje rozmiar tylko tego, co faktycznie idzie do joina.'
});
const filterLine = (indent: string, stage: number, id: string): ExplainedLine => ({
  code: `${indent}+- *(${stage}) Filter isnotnull(customer_id#${id})`,
  label: 'WHERE customer_id IS NOT NULL',
  text: 'Tego filtra nie pisałeś. Dodał go optymalizator. W joinie wewnętrznym wiersz z pustym kluczem i tak do niczego nie pasuje, więc lepiej odrzucić go przed joinem.'
});
const c2r = (indent: string, stage: number): ExplainedLine => ({
  code: `${indent}+- *(${stage}) ColumnarToRow`,
  label: 'szczegół techniczny',
  text: 'Czytnik Parquet oddaje dane paczkami kolumn, a ten węzeł zamienia je na wiersze. Na wybór strategii joina nie wpływa. Gwiazdka z numerem przy operatorach oznacza grupę operatorów wykonywanych razem.'
});
const project: (stage: number) => ExplainedLine = stage => ({
  code: `*(${stage}) Project [txn_id#11L, customer_id#12L, amount#13, country#9]`,
  label: 'SELECT txn_id, customer_id, amount, country',
  text: 'Lista kolumn wyniku. Ten węzeł jest na górze, bo plan czyta się od dołu: od odczytu plików do wyniku.'
});

export interface Plan { id: StrategyId; label: string; how: string; shuffle: string; lines: ExplainedLine[] }
export const plans = {
  title: 'Jak to wygląda w prawdziwym planie',
  lede: 'Ten sam join na 200 000 transakcji i 2 000 klientów, policzony trzema strategiami. Plany poniżej to wydruk labu, a nie symulacja.',
  badge: 'Rzeczywiste wykonanie · PySpark 4.0.1 i 4.3.0 · local[3]',
  scope: '<code>local[3]</code> to jeden proces z trzema wątkami, bez klastra i bez sieci. Plany pokazują, co Spark zaplanował i ile rekordów zapisał do shuffle\'u. Nie mówią nic o tym, która strategia jest szybsza na klastrze: lab nie porównuje czasów.',
  codeTitle: 'Zapytanie w PySparku',
  code: 'transactions.join(customers, "customer_id").select("txn_id", "customer_id", "amount", "country")',
  dataTitle: 'Dane',
  data: 'Dwie tabele Parquet z wymyślonymi danymi: <code>customers</code> (2 000 wierszy: <code>customer_id</code>, <code>country</code>, <code>segment</code>) i <code>transactions</code> (200 000 wierszy: <code>txn_id</code>, <code>customer_id</code>, <code>amount</code>, 3 partycje wejścia). Każda transakcja ma klienta, więc wynik ma 200 000 wierszy.',
  pick: 'Wybierz plan. W każdym szukaj trzech rzeczy: nazwy węzła joina, węzłów <code>Exchange</code> (przenoszenie danych) i węzłów <code>Sort</code> (sortowanie).',
  items: [
    {
      id: 'bhj',
      label: 'Broadcast hash',
      how: 'Ustawienia domyślne. Spark wybrał tę strategię sam, bo szacowany rozmiar strony customers jest poniżej progu.',
      shuffle: 'Rekordy zapisane do shuffle\'u: brak.',
      lines: [
        project(2),
        {
          code: '+- *(2) BroadcastHashJoin [customer_id#12L], [customer_id#8L], Inner, BuildRight, false',
          label: 'JOIN … ON t.customer_id = c.customer_id',
          text: 'Węzeł joina. Dwie listy w nawiasach to klucze lewej i prawej strony, <code>Inner</code> to typ joina, a <code>BuildRight</code> mówi, że tablica hashująca powstaje z prawej strony, czyli z customers. Końcowe <code>false</code> to flaga wewnętrzna, którą możesz pominąć.'
        },
        filterLine('   :- ', 2, '12L'),
        c2r('   :  ', 2),
        scanTx('   :     '),
        {
          code: '   +- BroadcastExchange HashedRelationBroadcastMode(List(input[0, bigint, false]),false)',
          label: 'rozesłanie małej tabeli',
          text: 'Tu mała strona jest zbierana, zamieniana na tablicę hashującą i rozsyłana do executorów. To <code>Exchange</code>, ale nie shuffle. Zwróć uwagę, że po stronie transactions nie ma żadnego <code>Exchange</code>: duża tabela zostaje na miejscu.'
        },
        filterLine('      ', 1, '8L'),
        c2r('         ', 1),
        scanCust('            ')
      ]
    },
    {
      id: 'smj',
      label: 'Sort merge',
      how: 'Próg broadcastu ustawiony na -1, czyli automatyczny broadcast wyłączony. Bez hintów.',
      shuffle: 'Rekordy zapisane do shuffle\'u: 200 000 (transactions) i 2 000 (customers), czyli każdy wiersz obu stron.',
      lines: [
        project(5),
        {
          code: '+- *(5) SortMergeJoin [customer_id#12L], [customer_id#8L], Inner',
          label: 'JOIN … ON t.customer_id = c.customer_id',
          text: 'Węzeł joina. Nie ma tu <code>BuildRight</code> ani <code>BuildLeft</code>, bo sort merge nie buduje tablicy hashującej. Obie gałęzie pod spodem wyglądają tak samo: odczyt, shuffle, sortowanie.'
        },
        {
          code: '   :- *(2) Sort [customer_id#12L ASC NULLS FIRST], false, 0',
          label: 'ORDER BY customer_id, w każdej partycji',
          text: 'Sortowanie dużej strony po kluczu. <code>false</code> oznacza, że to sortowanie wewnątrz partycji, a nie globalne.'
        },
        {
          code: '   :  +- Exchange hashpartitioning(customer_id#12L, 200), ENSURE_REQUIREMENTS',
          label: 'shuffle po kluczu',
          text: 'Shuffle dużej strony. Każdy wiersz trafia do jednej z 200 partycji, a o tym, do której, decyduje hash klucza. <code>ENSURE_REQUIREMENTS</code> znaczy, że Spark dodał ten shuffle sam, bo wymaga go join.'
        },
        filterLine('   :     ', 1, '12L'),
        c2r('   :        ', 1),
        scanTx('   :           '),
        {
          code: '   +- *(4) Sort [customer_id#8L ASC NULLS FIRST], false, 0',
          label: 'ORDER BY customer_id, w każdej partycji',
          text: 'To samo po stronie customers. Sort merge sortuje obie strony, także tę małą.'
        },
        {
          code: '      +- Exchange hashpartitioning(customer_id#8L, 200), ENSURE_REQUIREMENTS',
          label: 'shuffle po kluczu',
          text: 'Shuffle małej strony: ta sama funkcja hashująca i ta sama liczba partycji. Dzięki temu ten sam <code>customer_id</code> z obu tabel trafia do partycji o tym samym numerze.'
        },
        filterLine('         ', 3, '8L'),
        c2r('            ', 3),
        scanCust('               ')
      ]
    },
    {
      id: 'shj',
      label: 'Shuffled hash',
      how: 'Próg broadcastu -1 i hint <code>SHUFFLE_HASH</code> na customers. Bez hintu Spark został przy sort merge.',
      shuffle: 'Rekordy zapisane do shuffle\'u: 200 000 i 2 000, tak samo jak w sort merge.',
      lines: [
        project(3),
        {
          code: '+- *(3) ShuffledHashJoin [customer_id#12L], [customer_id#8L], Inner, BuildRight',
          label: 'JOIN … ON t.customer_id = c.customer_id',
          text: 'Węzeł joina. Znowu jest <code>BuildRight</code>: tablica hashująca powstaje z customers, ale osobno w każdej partycji, a nie raz dla całej tabeli.'
        },
        {
          code: '   :- Exchange hashpartitioning(customer_id#12L, 200), ENSURE_REQUIREMENTS',
          label: 'shuffle po kluczu',
          text: 'Shuffle dużej strony, identyczny jak w sort merge. Różnica jest nad nim: nie ma węzła <code>Sort</code>.'
        },
        filterLine('   :  ', 1, '12L'),
        c2r('   :     ', 1),
        scanTx('   :        '),
        {
          code: '   +- Exchange hashpartitioning(customer_id#8L, 200), ENSURE_REQUIREMENTS',
          label: 'shuffle po kluczu',
          text: 'Shuffle małej strony. Po nim każdy task ma swoją partycję customers i buduje z niej tablicę hashującą.'
        },
        filterLine('      ', 2, '8L'),
        c2r('         ', 2),
        scanCust('            ')
      ]
    }
  ] as Plan[],
  takeaway: '<b>Jak rozpoznać strategię w planie.</b> Dowodem jest nazwa węzła joina: <code>BroadcastHashJoin</code>, <code>SortMergeJoin</code> albo <code>ShuffledHashJoin</code>. To, co leży pod nim, pomaga zrozumieć koszt. W tych trzech planach wyglądało to tak. Broadcast hash: <code>BroadcastExchange</code> po jednej stronie. Sort merge: <code>Exchange hashpartitioning</code> i <code>Sort</code> po obu stronach. Shuffled hash: <code>Exchange hashpartitioning</code> po obu stronach, bez <code>Sort</code>. Same węzły pod spodem niczego nie przesądzają. <code>BroadcastExchange</code> ma też broadcast nested loop join. A <code>Exchange</code> albo <code>Sort</code> mogą zniknąć, gdy dane są już odpowiednio podzielone lub posortowane.',
  versionNote: 'Plany pochodzą z PySpark 4.0.1. W 4.3.0 różnią się jednym szczegółem: węzeł <code>BroadcastHashJoin</code> ma na końcu dodatkową flagę.'
};

export interface Explainer { title: string; order: 'top-down' | 'bottom-up'; lines: ExplainedLine[] }
export interface Experiment {
  ask: string;
  setup: string;
  choices: string[];
  correct: number;
  mono: boolean;
  output: string;
  notes: string[];
  explainers?: Explainer[];
  scope: string;
}

const ENV = 'PySpark 4.0.1, <term id="local-mode">local[3]</term>';

/** Etap Praktyka, część 2: skąd Spark wie, którą strategię wybrać. Wydruki pochodzą z labu. */
export const choosing = {
  title: 'Skąd Spark wie, którą strategię wybrać?',
  intro: 'Spark wybiera strategię podczas planowania, czyli zanim wykona zapytanie. Nie zna wtedy prawdziwych rozmiarów. Ma trzy rzeczy: <b>szacunek</b> rozmiaru, typ joina i hinty, czyli wskazówki wpisane w Twoim kodzie. Trzy eksperymenty pokazują, co z tego wynika. Przy każdym najpierw przewidź wynik.',
  experiments: [
    {
      setup: `${ENV}, AQE wyłączone. Strona customers, która idzie do joina (dwie kolumny), ma szacowany rozmiar 5 952 bajty. Ustawienie <code>spark.sql.autoBroadcastJoinThreshold</code> to próg rozmiaru dla automatycznego broadcastu. Ustawiamy go na 5 951 bajtów, czyli o jeden bajt mniej niż szacunek.`,
      ask: 'Jaką strategię pokaże plan?',
      choices: ['BroadcastHashJoin', 'SortMergeJoin', 'ShuffledHashJoin'],
      correct: 1,
      mono: true,
      output: 'customers: 2000 wierszy, szacunek całej tabeli 9259 b\ncustomers, tylko kolumny potrzebne w joinie (customer_id, country): szacunek 5952 b\n\npróg = 9259 b (szacunek strony +3307 b): BroadcastHashJoin\npróg = 5953 b (szacunek strony +1 b): BroadcastHashJoin\npróg = 5952 b (szacunek strony +0 b): BroadcastHashJoin\npróg = 5951 b (szacunek strony -1 b): SortMergeJoin',
      notes: [
        'Jeden bajt zmienił strategię. Spark porównuje próg z <b>szacunkiem rozmiaru strony joina</b>. Gdy szacunek jest nie większy niż próg, wybiera broadcast. W Apache Spark próg ma domyślnie 10 MB, a wartość <code>-1</code> wyłącza automatyczny broadcast.',
        'Szacunek dotyczy tego, co idzie do joina, a nie całej tabeli. Cała tabela customers to 9 259 b. Join potrzebuje jednak dwóch kolumn z trzech, więc liczy się 5 952 b. Dlatego wybranie tylko potrzebnych kolumn przed joinem realnie pomaga zmieścić się pod progiem.',
        'Dlaczego nie shuffled hash? W Apache Spark ustawienie <code>spark.sql.join.preferSortMergeJoin</code> jest domyślnie włączone. Dlatego w tym przypadku, gdy broadcast odpadł, Spark sięgnął po sort merge.'
      ],
      scope: 'Liczby bajtów zależą od wersji i zapisanego pliku. W PySpark 4.3.0 te same dane dały 9 211 b i 5 921 b, a granica wypadła dokładnie tak samo, na szacunku. W tym labie szacunek pochodzi z rozmiaru plików Parquet, bo tabele nie mają statystyk w katalogu.'
    },
    {
      setup: `${ENV}. Z customers zostawiamy filtrem <code>country = 'PL' AND segment = 'premium'</code> tylko 84 wiersze z 2 000. Próg broadcastu jest o jeden bajt poniżej szacunku strony. Najpierw AQE wyłączone.`,
      ask: 'Czy filtr wystarczy, żeby Spark zaplanował broadcast?',
      choices: ['Tak, 84 wiersze to mało', 'Nie, plan pokaże SortMergeJoin'],
      correct: 1,
      mono: false,
      output: 'wierszy po filtrze: 84 z 2000; szacunek strony po filtrze: 5952 b; próg ustawiony na 5951 b\nAQE wyłączone, strategia w planie:    SortMergeJoin\nAQE włączone, plan przed wykonaniem:  SortMergeJoin\nAQE włączone, plan po wykonaniu:      BroadcastHashJoin (wierszy wyniku: 8400)',
      notes: [
        'Szacunek po filtrze się nie zmienił: nadal 5 952 b. Przed wykonaniem Spark nie wiedział, ile wierszy przejdzie przez filtr, więc zaplanował sort merge. To typowy powód „dziwnej" strategii. Decyduje szacunek, a nie prawdziwy rozmiar.',
        'Z włączonym <term id="aqe">AQE</term> plan początkowy jest ten sam. Ale po wykonaniu shuffle\'u Spark zna już prawdziwy rozmiar strony i zamienia join na broadcast. Widać to w planie końcowym:'
      ],
      explainers: [
        {
          title: 'Plan końcowy z AQE (fragment, od góry)',
          order: 'top-down',
          lines: [
            {
              code: 'AdaptiveSparkPlan isFinalPlan=true',
              label: 'plan po wykonaniu',
              text: '<code>isFinalPlan=true</code> znaczy, że patrzysz na plan, który naprawdę się wykonał. Przed akcją ten sam DataFrame pokazywał <code>isFinalPlan=false</code> i <code>SortMergeJoin</code>.'
            },
            {
              code: '      +- *(3) BroadcastHashJoin [customer_id#12L], [customer_id#8L], Inner, BuildRight, false',
              label: 'JOIN zamieniony w trakcie',
              text: 'Strategia po zamianie. Węzłów <code>Sort</code> już nie ma, czyli sortowania udało się uniknąć.'
            },
            {
              code: '         :- AQEShuffleRead local',
              label: 'odczyt wyniku shuffle\'u',
              text: 'Wynik shuffle\'u dużej strony jest czytany lokalnie, bez układania go na nowo po kluczu. Broadcast tego nie potrzebuje.'
            },
            {
              code: '         :  +- ShuffleQueryStage 0',
              label: 'shuffle, który już się wykonał',
              text: 'Ale sam shuffle dużej strony już się odbył: 200 000 wierszy zostało zapisanych, zanim Spark zmienił zdanie. Dlatego według dokumentacji Sparka taka zamiana jest mniej wydajna niż broadcast zaplanowany od początku. Nadal jest lepsza niż dokończenie sort merge.'
            },
            {
              code: '         +- BroadcastQueryStage 2',
              label: 'rozesłanie małej strony',
              text: 'Mała strona, już po filtrze i z prawdziwym rozmiarem, zostaje rozesłana do executorów.'
            }
          ]
        }
      ],
      scope: 'Jedno uruchomienie, ustawienia domyślne poza progiem, tabele bez statystyk w katalogu. Z aktualnymi statystykami kolumn i włączonym optymalizatorem kosztowym szacunek po filtrze mógłby być inny: tego lab nie sprawdza. Próg, przy którym AQE zamienia join, to w Apache Spark domyślnie ten sam próg co zwykle, a na Databricks 30 MB.'
    },
    {
      setup: `${ENV}, AQE wyłączone, automatyczny broadcast wyłączony (próg -1). Na customers jest hint <code>broadcast</code>. Trzy zapytania: (a) <code>transactions LEFT JOIN customers</code>, (b) <code>customers LEFT JOIN transactions</code>, (c) <code>transactions FULL OUTER JOIN customers</code>.`,
      ask: 'W których zapytaniach plan pokaże BroadcastHashJoin?',
      choices: ['We wszystkich trzech', 'Tylko w (a)', 'W (a) i (b)'],
      correct: 1,
      mono: false,
      output: 'inner, broadcast(customers):                                 BroadcastHashJoin\ntransactions LEFT JOIN broadcast(customers):                 BroadcastHashJoin\nbroadcast(customers) LEFT JOIN transactions:                 SortMergeJoin\ntransactions FULL OUTER JOIN broadcast(customers):           SortMergeJoin\ntransactions FULL OUTER JOIN customers z hintem SHUFFLE_HASH: ShuffledHashJoin\ninner, hint MERGE przy progu domyślnym:                      SortMergeJoin\ninner, broadcast(customers) i SHUFFLE_HASH na transactions:  BroadcastHashJoin',
      notes: [
        '<term id="join-hint">Hint</term> to prośba. Dokumentacja Sparka mówi wprost, że nie ma gwarancji wyboru strategii z hintu. Powód: strategia może nie obsługiwać danego typu joina.',
        'Broadcast hash join nie może rozesłać strony, której wszystkie wiersze muszą trafić do wyniku. Left join zachowuje wszystkie wiersze lewej tabeli, także te bez pary. W (b) lewą stroną jest customers, więc rozesłać można by tylko transactions. Full outer zachowuje obie strony, więc broadcast hash join odpada całkiem.',
        'Shuffled hash join obsługuje wszystkie typy joina: hint <code>SHUFFLE_HASH</code> zadziałał także dla full outer. Gdy hinty są ze sobą sprzeczne, decyduje kolejność z dokumentacji: najpierw BROADCAST, potem MERGE, potem SHUFFLE_HASH.',
        'Hint działa też w drugą stronę: <code>MERGE</code> dał sort merge, choć tabela była poniżej progu. A <code>BROADCAST</code> Spark uwzględnia nawet wtedy, gdy szacunek przekracza próg. Dlatego hint na tabeli, która rośnie, to dług techniczny. Tabela przestanie być mała, a hint zostanie w kodzie i dalej będzie działał.'
      ],
      scope: 'Wynik dla joinów z warunkiem równości w PySpark 4.0.1 i 4.3.0. Bez warunku równości Spark sięga po inne strategie, np. broadcast nested loop join, których ta lekcja nie omawia.'
    }
  ] as Experiment[],
  orderTitle: 'Kolejność decyzji w Apache Spark',
  orderIntro: 'To streszczenie komentarza w kodzie źródłowym Apache Spark 4.0, dla joina z warunkiem równości. Nie jest to pełny opis optymalizatora: AQE dokłada decyzje w trakcie wykonania, a Databricks ma własne wartości domyślne.',
  order: [
    '<b>Najpierw hinty</b>, w kolejności: broadcast (jeśli typ joina na to pozwala), sort merge, shuffle hash, shuffle-and-replicate nested loop.',
    '<b>Bez hintu albo gdy hint nie pasuje:</b> broadcast hash join, jeśli szacunek jednej strony mieści się w progu i typ joina na to pozwala.',
    'Potem shuffled hash join, ale tylko gdy <code>preferSortMergeJoin</code> jest wyłączone, a jedna strona jest dość mała i dużo mniejsza od drugiej.',
    'Potem sort merge join, jeśli klucze da się sortować.',
    'Na końcu strategie bez warunku równości: iloczyn kartezjański albo broadcast nested loop join.'
  ],
  statsTitle: 'Skąd Spark bierze szacunek rozmiaru',
  stats: [
    'Dokumentacja Apache Spark wymienia trzy źródła statystyk: źródło danych (np. liczniki i wartości min/max w metadanych plików Parquet), katalog (statystyki zbierane poleceniem <code>ANALYZE TABLE</code>) i wykonanie (statystyki liczone w trakcie zapytania, z których korzysta AQE).',
    'Ta sama strona ostrzega, że brakujące albo niedokładne statystyki utrudniają wybór dobrego planu. W praktyce nieaktualna statystyka może sprawić, że Spark roześle tabelę, która dawno urosła, albo nie roześle takiej, która jest mała.',
    'W planie statystyki z wykonania są oznaczone jako <code>isRuntime=true</code>.'
  ],
  typesTitle: 'Typ joina a strona, którą można rozesłać',
  types: [
    'Według kodu Apache Spark 4.0 broadcast hash join może zbudować tablicę z <b>prawej</b> strony dla joinów: inner, left outer, left semi i left anti. Z <b>lewej</b> strony dla: inner i right outer. Full outer nie jest obsługiwany z żadnej strony.',
    'Shuffled hash join i sort merge join obsługują wszystkie typy joina. Sort merge wymaga dodatkowo, żeby klucze dało się sortować.',
    'Wszystkie trzy strategie wymagają warunku równości na kluczu.'
  ],
  databricksTitle: 'Co jest inne na Databricks',
  databricks: [
    'Próg, przy którym AQE zamienia sort merge na broadcast w trakcie wykonania, to na Databricks domyślnie 30 MB (<code>spark.databricks.adaptive.autoBroadcastJoinThreshold</code>).',
    'Dokumentacja Databricks podaje tę samą kolejność hintów i to samo zastrzeżenie o braku gwarancji. Dodaje dwie rzeczy. Broadcast zaplanowany przed uruchomieniem zwykle działa lepiej niż ten, który AQE planuje w trakcie. AQE nie roześle też lewej strony left outer joina.',
    'Laby w tym repozytorium działają na Apache Spark w trybie lokalnym. Nie obejmują Databricks, Photona ani serverless.'
  ]
};

export interface Scenario { setup: string; ask: string; options: string[]; correct: number; why: string; scope: string }
/** Etap Praktyka, część 3: sytuacje, o które pyta się na rozmowach. Najpierw wybór, potem uzasadnienie i jego granice. */
export const scenarios = {
  title: 'Cztery sytuacje z rozmowy',
  intro: 'Rekruter rzadko pyta o definicję. Częściej opisuje sytuację i patrzy, jak rozumujesz. Przy każdej najpierw wybierz sam.',
  cases: [
    {
      setup: 'Job działał bez problemu od roku, a od tygodnia kończy się błędem braku pamięci na driverze. W kodzie jest <code>broadcast(dim_customers)</code>. Tabela klientów urosła w tym czasie z 50 MB do 6 GB.',
      ask: 'Co robisz najpierw?',
      options: ['Zdejmuję hint i sprawdzam plan bez niego', 'Zwiększam pamięć drivera', 'Zwiększam liczbę partycji shuffle\'u'],
      correct: 0,
      why: 'Spark uwzględnia hint broadcast nawet wtedy, gdy szacunek przekracza próg. Dlatego dalej zbiera 6 GB i rozsyła kopię do każdego executora. Bez hintu wybierze strategię na podstawie szacunku, przy tym rozmiarze sort merge. Liczba partycji shuffle\'u nie ma tu znaczenia, bo broadcast nie robi shuffle\'u.',
      scope: 'Większa pamięć drivera usuwa objaw tylko do następnego wzrostu tabeli. Poza tym w sprawdzonym kodzie Apache Spark 4.0 zbudowana relacja od 8 GB wzwyż i tak kończy zapytanie błędem. Jeśli join potrzebuje z tej tabeli dwóch kolumn i części wierszy, wybierz je przed joinem. Może się okazać, że to, co naprawdę trzeba rozesłać, znowu jest małe.'
    },
    {
      setup: 'Łączysz dwie tabele faktów po <code>order_id</code>: 400 GB zamówień i 300 GB zdarzeń wysyłki. Kolega proponuje podnieść <code>autoBroadcastJoinThreshold</code> do 500 GB, bo „broadcast jest najszybszy".',
      ask: 'Co odpowiadasz?',
      options: ['Zgoda, broadcast eliminuje shuffle', 'Zostaję przy sort merge i patrzę na rozkład kluczy oraz rozmiar partycji', 'Wymuszam shuffled hash join hintem'],
      correct: 1,
      why: 'Przy typowych rozmiarach pamięci żadna ze stron nie zmieści się w driverze ani w executorze. Poza tym w sprawdzonym kodzie Apache Spark 4.0 zbudowana relacja od 8 GB wzwyż kończy zapytanie błędem. Dla dwóch dużych tabel typowym wyborem jest sort merge, bo nie potrzebuje całej strony w pamięci. Prawdziwe ryzyko leży gdzie indziej: w nierównym rozkładzie kluczy i zbyt dużych partycjach.',
      scope: 'Shuffled hash join bywa szybszy, gdy jedna strona jest dużo mniejsza, ale 300 GB i 400 GB to nie ten przypadek. Jeśli ten join jest liczony stale, warto rozważyć takie ułożenie danych, które ogranicza shuffle. To temat na osobną lekcję.'
    },
    {
      setup: 'Raport robi <code>FULL OUTER JOIN</code> między 200 GB transakcji a słownikiem walut, który ma 5 MB. Mimo hintu broadcast plan pokazuje <code>SortMergeJoin</code>.',
      ask: 'Jak to tłumaczysz?',
      options: ['To błąd Sparka, hint powinien zadziałać', 'Próg 10 MB jest za niski', 'Broadcast hash join nie obsługuje full outer, więc hint nie mógł zostać spełniony'],
      correct: 2,
      why: 'W full outer joinie do wyniku muszą trafić wszystkie wiersze obu stron. Broadcast hash join nie może rozesłać strony, której wszystkie wiersze trzeba zachować. Próg nie ma tu nic do rzeczy: 5 MB jest pod progiem, a strategia i tak odpada z powodu typu joina.',
      scope: 'W labie hint <code>SHUFFLE_HASH</code> na takim joinie dał <code>ShuffledHashJoin</code>, który oszczędza sortowanie 200 GB. Czy będzie szybszy, trzeba sprawdzić na prawdziwych danych. Warto też zapytać, czy raport naprawdę potrzebuje full outer.'
    },
    {
      setup: 'Join z tabelą klientów, 80 GB, po filtrze, który zostawia kilkaset wierszy. <code>explain()</code> przed uruchomieniem pokazuje <code>SortMergeJoin</code>. AQE jest włączone.',
      ask: 'Co sprawdzasz, zanim cokolwiek zmienisz?',
      options: ['Nic, od razu dodaję hint broadcast', 'Plan końcowy po wykonaniu: AQE mogło zamienić join', 'Wyłączam AQE, żeby plan był stabilny'],
      correct: 1,
      why: 'Plan sprzed wykonania powstał z szacunku, a szacunek mógł nie uwzględnić filtra. Z AQE Spark po shuffle\'u zna prawdziwy rozmiar i może zamienić join na broadcast. Dopiero plan końcowy, z <code>isFinalPlan=true</code>, mówi, co się naprawdę wykonało.',
      scope: 'Zamiana w trakcie ma swoją cenę: shuffle dużej strony już się odbył. Jeśli masz pewność co do rozmiaru po filtrze, hint albo aktualne statystyki mogą dać broadcast zaplanowany od początku. Gwarancji nie ma: hint wymaga obsługiwanego typu joina, a statystyki tylko poprawiają szacunek. Pamiętaj też, że hint zostaje w kodzie, więc ta pewność musi być prawdziwa także za rok.'
    }
  ] as Scenario[],
  takeaway: '<b>Wzór odpowiedzi.</b> Najpierw plan: jaką strategię Spark wybrał i na podstawie jakiego szacunku. Potem pytanie, czy ten szacunek jest prawdziwy. Hint dopiero na końcu i tylko wtedy, gdy wiesz, jak duża jest tabela i jak szybko rośnie.'
};

/**
 * Etap Interview. Pytania, odpowiedzi 30–60 s i follow-upy przychodzą z Interview Banku.
 * Tutaj jest tylko to, czego bank nie ma: powiązane pytania i uczciwe zdanie o doświadczeniu.
 */
export const interview = {
  relatedTitle: 'Pytania, które często padają zaraz potem',
  relatedIntro: 'Rozmowa o joinach zwykle skręca w stronę nierównego rozkładu kluczy i AQE. Te odpowiedzi są w banku:',
  related: ['spark-data-skew', 'spark-aqe', 'spark-narrow-wide-shuffle'],
  bridgeIntro: 'Jeśli nie stroiłeś jeszcze joinów w Sparku na dużych danych, nie udawaj. Pokaż sposób rozumowania, na przykład tak:',
  bridgeEn: '“I’d start from the physical plan rather than from a hint. First I check which join strategy Spark picked and what size estimate that choice was based on. If the estimate is wrong, I fix the cause: stale statistics, or columns and rows I can drop before the join. I only add a broadcast hint when I know how big that table is and how fast it grows, because the hint keeps applying after the table stops being small.”',
  bridgePl: 'Po polsku: zaczynam od planu fizycznego, nie od hintu. Sprawdzam, którą strategię Spark wybrał i na jakim szacunku rozmiaru ją oparł. Jeśli szacunek jest błędny, naprawiam przyczynę: nieaktualne statystyki albo kolumny i wiersze, które mogę odrzucić przed joinem. Hint broadcast dodaję dopiero wtedy, gdy wiem, jak duża jest tabela i jak szybko rośnie, bo hint działa dalej, kiedy tabela przestaje być mała.'
};

export interface QuizItem { q: string; setup?: string; options: string[]; correct: number; why: string }
/** Etap Sprawdź się. Każde pytanie podaje założenia, jeśli wynik od nich zależy. */
export const quiz: QuizItem[] = [
  {
    q: 'W planie pod węzłem joina widzisz <code>Exchange hashpartitioning</code> po obu stronach i ani jednego węzła <code>Sort</code>. Na którą strategię to wskazuje?',
    options: ['Broadcast hash join', 'Sort merge join', 'Shuffled hash join'],
    correct: 2,
    why: 'Shuffle obu stron bez sortowania: tak w planach z tej lekcji wyglądał shuffled hash join. Sort merge miał nad każdym <code>Exchange</code> węzeł <code>Sort</code>, a broadcast hash miał <code>BroadcastExchange</code> po jednej stronie. Pewność daje dopiero nazwa węzła joina.'
  },
  {
    q: 'Tabela wymiarów ma 6 GB, a klaster 50 executorów. Co jest głównym kosztem broadcast hash joina?',
    options: ['Sortowanie dużej tabeli', 'Cała tabela wymiarów w pamięci drivera i każdego executora', 'Shuffle obu tabel'],
    correct: 1,
    why: 'Broadcast nie sortuje i nie robi shuffle\'u dużej tabeli. Płaci za to pamięcią. W Apache Spark małą stronę zbiera driver, a kopia trafia do każdego executora. Przy 6 GB i 50 executorach to już duże ryzyko braku pamięci. Do tego zbudowana relacja zbliża się do limitu 8 GB z kodu Apache Spark 4.0.'
  },
  {
    q: 'Z czym Spark porównuje <code>autoBroadcastJoinThreshold</code>, gdy planuje join przed wykonaniem?',
    setup: 'Założenia: Apache Spark, join z warunkiem równości, bez hintów.',
    options: ['Z własnym szacunkiem rozmiaru strony joina', 'Z rzeczywistym rozmiarem tabeli po filtrach', 'Z rozmiarem największej partycji'],
    correct: 0,
    why: 'Z szacunkiem. W labie zmiana progu o jeden bajt wokół szacunku zmieniła strategię, a filtr, który zostawił 84 wiersze z 2 000, szacunku nie zmienił. Prawdziwe rozmiary Spark poznaje dopiero w trakcie wykonania i wtedy może z nich skorzystać AQE.'
  },
  {
    q: 'Zapytanie <code>customers LEFT JOIN transactions</code> ma hint broadcast na customers. Co pokazał plan?',
    setup: 'Założenia: lab z tej lekcji, PySpark 4.0.1, AQE wyłączone, automatyczny broadcast wyłączony.',
    options: ['BroadcastHashJoin', 'SortMergeJoin', 'ShuffledHashJoin'],
    correct: 1,
    why: 'SortMergeJoin. Customers jest tu lewą stroną left joina, a left join zachowuje wszystkie jej wiersze. Broadcast hash join nie może rozesłać strony, której wszystkie wiersze muszą trafić do wyniku. Hint to prośba: gdy strategia nie obsługuje typu joina, Spark wybiera inną.'
  },
  {
    q: 'Dlaczego Apache Spark bez hintów zwykle łączy dwie duże tabele przez sort merge, a nie przez shuffled hash?',
    options: ['Bo sort merge nie wymaga shuffle\'u', 'Bo shuffled hash join nie obsługuje joina wewnętrznego', 'Bo preferSortMergeJoin jest domyślnie włączone, a sort merge zużywa mniej pamięci'],
    correct: 2,
    why: 'Obie strategie zwykle wymagają shuffle\'u obu stron. Różnica jest w pamięci. Shuffled hash trzyma w każdej partycji tablicę hashującą z jednej strony. Sort merge nie potrzebuje całej strony w pamięci. Domyślne ustawienie <code>spark.sql.join.preferSortMergeJoin</code> wybiera bezpieczniejszą opcję.'
  },
  {
    q: 'Przed wykonaniem plan pokazywał <code>SortMergeJoin</code>. Po wykonaniu widzisz <code>AdaptiveSparkPlan isFinalPlan=true</code> i <code>BroadcastHashJoin</code>. Co się stało?',
    options: ['Hint zadziałał z opóźnieniem', 'AQE poznało prawdziwy rozmiar strony i zamieniło strategię w trakcie', 'Spark policzył join dwa razy, dwiema strategiami'],
    correct: 1,
    why: 'Po wykonaniu shuffle\'u AQE zna prawdziwe rozmiary i może zamienić sort merge na broadcast. Shuffle już się wtedy odbył, więc oszczędza się głównie sortowanie. Dlatego broadcast zaplanowany od początku jest zwykle lepszy niż ten z zamiany.'
  }
];

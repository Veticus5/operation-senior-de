import type { Bridge, ExplainedLine, LessonMeta } from '../../types';

/**
 * Lekcja 07: Databricks Platform Architecture & Delta Lake. Prowadzi od problemu (zapis do katalogu plików
 * nie jest transakcją) przez log transakcyjny Delta Lake i jego konsekwencje (wersje, konflikty, MERGE,
 * time travel, VACUUM, OPTIMIZE) do platformy Databricks jako całości (compute, Unity Catalog, Lakeflow,
 * bundles) i krótkiej mapy ekosystemu Microsoft.
 *
 * Lekcja nie powtarza lekcji o Sparku (plan, shuffle, joiny, skew, AQE): zakłada je i buduje na nich.
 *
 * Fragmenty narracyjne są w HTML (dozwolone znaczniki: lib/richText.ts) i mogą używać
 * <term id="...">, czyli haseł z content/glossary.ts.
 *
 * Skąd są fakty: protokół Delta (PROTOCOL.md), dokumentacja Databricks, Microsoft Learn i Snowflake,
 * otwierane 2026-11-27. Całość jest spisana w docs/verified-facts.md, sekcja „Lekcja 07".
 * Lekcja NIE MA labu: repozytorium nie ma zależności delta-spark, a jej dodanie wymaga osobnej decyzji.
 * Wszystkie wizualizacje są więc modelami w przeglądarce i tak są podpisane. Żadna liczba w tej lekcji
 * nie jest pomiarem.
 * Pytania rekrutacyjne, krótkie odpowiedzi i follow-upy nie są tu powtórzone: lekcja bierze je z Interview Banku.
 */
export const meta: LessonMeta = {
  id: 'databricks-platform-delta-lake',
  topicId: 'databricks.platform',
  area: 'databricks',
  title: 'Databricks Platform & Delta Lake',
  subtitle: 'Skąd tabela z plików Parquet bierze transakcje, wersje i MERGE. I co Databricks dokłada do Sparka: compute, Unity Catalog, Lakeflow, wdrożenia. Na koniec mapa: Snowflake, Databricks, Fabric.',
  minutes: 60
};

/** Zagadnienia z Interview Banku ćwiczone w etapie Interview, w tej kolejności. */
export const interviewTopics = [
  'databricks.platform', 'delta.transaction-log', 'delta.concurrency', 'delta.merge',
  'delta.optimize-vacuum', 'databricks.unity-catalog', 'databricks.platform-choice'
];

/** Zwinięte pogłębienie, poza domyślną ścieżką. */
export interface More { title: string; html: string[] }

/* ------------------------------------------------------------------ */
/* Etap 1: Intuicja                                                    */
/* ------------------------------------------------------------------ */

export interface Beat {
  html: string;
  visual?: 'crash' | 'versus' | 'stack';
  after?: string;
  next: string;
  bridge?: Bridge;
  more?: More;
}

export const beats: Beat[] = [
  {
    html: '<h1>Job padł w połowie zapisu. Co zobaczy dashboard?</h1>\n<p class="lede">Nocny job dopisuje do tabeli zamówień cztery pliki <term id="parquet">Parquet</term>. Po dwóch plikach klaster traci maszynę i job kończy się błędem. O 8:00 ktoś otwiera raport sprzedaży.</p>\n<p>W hurtowni to pytanie nie istnieje: transakcja albo się udała, albo nie. Tutaj dane leżą jako zwykłe pliki w <term id="object-storage">object storage</term>. Sprawdź, co widzi czytelnik w obu wariantach.</p>',
    visual: 'crash',
    after: '<b>Wniosek.</b> Parquet to format pliku. Katalog plików Parquet nie wie, które pliki razem tworzą poprawny stan tabeli, więc czytelnik bierze to, co akurat leży w katalogu. <b>Delta Lake</b> dokłada brakujący element: osobną listę plików, które należą do tabeli. Plik, którego nie ma na liście, dla czytelnika nie istnieje.',
    more: {
      title: 'Czy Spark naprawdę zostawia połowę plików',
      html: [
        'Nie zawsze, i warto to umieć doprecyzować. Spark przy zapisie do katalogu używa protokołu zatwierdzania: taski piszą do lokalizacji tymczasowej, a na końcu pliki są przenoszone na miejsce. To zmniejsza okno, w którym widać niepełny wynik.',
        'Dokumentacja Apache Spark zastrzega jednak, że object storage to nie system plików: zmiana nazwy bywa wolna i po awarii może zostawić magazyn w nieznanym stanie, a zatwierdzanie przez zmianę nazwy opisuje jako potencjalnie wolne i zawodne. Zależy to od magazynu: dla S3 zmiana nazwy katalogu jest tam oznaczona jako niebezpieczna, dla Azure (sterownik ABFS) jako bezpieczna.',
        'Niezależnie od tego katalog Parquet nie ma odpowiedzi na trzy inne pytania: co, gdy dwa joby piszą naraz, jak zmienić jeden wiersz i jak wrócić do stanu sprzed zapisu. Ilustracja wyżej pokazuje najprostszy przypadek, a nie jedyne możliwe zachowanie.'
      ]
    },
    next: 'Jak wygląda ta lista?',
    bridge: {
      from: 'Snowflake',
      known: 'W Snowflake plików nie widzisz. <code>INSERT</code> albo się zatwierdza, albo nie, a o spójność dba usługa, która jako jedyna ma dostęp do magazynu danych.',
      fresh: 'Delta Lake daje tę samą obietnicę dla jednej tabeli (zapis jest widoczny w całości albo wcale), ale na plikach, które leżą w Twoim magazynie i w otwartym formacie.',
      breaks: 'Nie ma tu usługi, która pilnuje każdego dostępu. Gwarancja działa, dopóki wszyscy piszący trzymają się protokołu Delta. Kto ma uprawnienia do magazynu, może skasować plik z pominięciem logu i zepsuć tabelę. Stąd rola warstwy uprawnień, o której jest etap Platforma.'
    }
  },
  {
    html: '<h2>Tabela to lista plików, a każda zmiana listy to nowa wersja</h2>\n<p>Tabela Delta to katalog z plikami Parquet oraz podkatalog <code>_delta_log</code>. Każda zatwierdzona zmiana, czyli <b>commit</b>, to jeden mały plik JSON w tym podkatalogu. Zapisane są w nim akcje: „dodaj ten plik do tabeli”, „usuń tamten”.</p>\n<p>Pliki logu mają kolejne numery: <code>00000000000000000000.json</code>, potem <code>…001.json</code> i tak dalej. Numer commitu to <b>wersja tabeli</b>. Czytelnik odtwarza stan tabeli, przechodząc po logu od początku, i czyta wyłącznie te pliki Parquet, które po tym przejściu zostały na liście.</p>\n<p>Zapis czterech plików danych niczego więc nie zmienia, dopóki nie pojawi się plik commitu. A pojedynczy plik commitu albo jest, albo go nie ma. Stąd bierze się zapis „wszystko albo nic”.</p>',
    visual: 'versus',
    after: '<b>Wniosek.</b> Jeden mechanizm, czyli uporządkowany log zmian listy plików, daje kilka rzeczy naraz: zapis widoczny w całości albo wcale, historię wersji, wykrywanie konfliktów między piszącymi oraz możliwość zmiany i usuwania wierszy. Każdą z nich zobaczysz osobno w następnym etapie.',
    more: {
      title: 'Jak to się ma do liter ACID',
      html: [
        '<b>Atomicity.</b> Commit to pojawienie się jednego pliku logu. Nie ma stanu „w połowie”.',
        '<b>Consistency.</b> Przed zapisem Delta sprawdza m.in. zgodność danych ze schematem tabeli i ograniczenia. Zapis, który ich nie spełnia, nie tworzy commitu.',
        '<b>Isolation.</b> Czytelnik pracuje na jednej wersji tabeli, czyli na <term id="snapshot-isolation">migawce</term>, i nie widzi commitów, które pojawiły się w trakcie jego zapytania. Piszący są sprawdzani pod kątem konfliktów przy commicie.',
        '<b>Durability.</b> Commit i pliki danych leżą w object storage, więc ich trwałość jest trwałością tego magazynu.',
        'Zakres: klasycznie to gwarancje dla <b>jednej tabeli</b>, bo każda tabela ma własny log. Transakcje obejmujące kilka tabel Databricks opisuje osobno, z dodatkowymi wymaganiami. Wrócimy do tego w porównaniu platform.'
      ]
    },
    next: 'A gdzie w tym wszystkim Databricks?'
  },
  {
    html: '<h2>Databricks to nie „miejsce do uruchamiania PySparka”</h2>\n<p>Z lekcji o Sparku znasz silnik: plan, stage, shuffle. Sam silnik nie odpowiada jednak na pytania, które w hurtowni rozwiązuje usługa: gdzie trwale leżą tabele, kto może je czytać, co uruchamia job o 2:00, jak kod trafia z repozytorium na produkcję.</p>\n<p>Databricks składa odpowiedzi na te pytania w jedną platformę. Dokumentacja nazywa ten model <b>lakehouse</b>: system zarządzania danymi, który łączy zalety data lake (tanie pliki w otwartym formacie) i hurtowni (transakcje, schemat, SQL).</p>',
    visual: 'stack',
    after: '<b>Wniosek.</b> Spark to jedna z warstw. Na rozmowie pytanie „co Databricks daje ponad Sparka” ma konkretną odpowiedź: format tabel z transakcjami, zarządzany compute, wspólny katalog z uprawnieniami, orkiestrację i sposób wdrażania. Najpierw fundament, czyli Delta Lake od środka.',
    next: 'Zajrzyj do logu'
  }
];

/** Ilustracja z pierwszego kroku: job zapisał 2 z 4 plików i padł. Liczby wymyślone. */
export const crash = {
  caption: 'Ilustracja, nie pomiar. Tabela miała 1000 zamówień w dwóch plikach. Job miał dopisać 400 zamówień w czterech plikach po 100 wierszy i padł po dwóch.',
  oldFiles: [
    { name: 'part-001.parquet', rows: 500 },
    { name: 'part-002.parquet', rows: 500 }
  ],
  newFiles: [
    { name: 'part-003.parquet', rows: 100, written: true },
    { name: 'part-004.parquet', rows: 100, written: true },
    { name: 'part-005.parquet', rows: 100, written: false },
    { name: 'part-006.parquet', rows: 100, written: false }
  ],
  modes: [
    {
      id: 'parquet', label: 'Katalog Parquet',
      how: 'Czytelnik listuje katalog i czyta każdy plik, który w nim znajdzie.',
      verdict: 'Raport pokazuje 1200 zamówień. To liczba, która nigdy nie była prawdziwa: ani stan sprzed joba (1000), ani po nim (1400). Nikt nie dostał błędu.'
    },
    {
      id: 'delta', label: 'Tabela Delta',
      how: 'Czytelnik czyta log i bierze tylko pliki, które log wymienia. Job nie zdążył zapisać commitu.',
      verdict: 'Raport pokazuje 1000 zamówień, czyli ostatni zatwierdzony stan. Dwa osierocone pliki leżą w katalogu, ale nie należą do tabeli. Ponowione zadanie zapisze komplet i dopiero wtedy doda commit.'
    }
  ]
};

/** Porównanie z drugiego kroku. Wiersze to pytania, na które odpowiada log. */
export const versus = {
  caption: 'Porównanie: sam katalog plików Parquet a tabela Delta. Kolumna Delta opisuje protokół, a nie konkretną wersję Databricks.',
  columns: ['Pytanie', 'Katalog Parquet', 'Tabela Delta'],
  rows: [
    ['Które pliki tworzą tabelę?', 'Wszystkie, które leżą w katalogu', 'Te, które wymienia log'],
    ['Zapis przerwany w połowie', 'Może zostawić część plików', 'Bez commitu nie zmienia tabeli'],
    ['Zmiana jednego wiersza', 'Ręczne przepisanie plików', 'UPDATE, DELETE, MERGE jako commit'],
    ['Dwa joby piszą naraz', 'Brak kontroli', 'Konflikt wykrywany przy commicie'],
    ['Stan sprzed tygodnia', 'Brak, chyba że masz kopię', 'Wcześniejsza wersja, dopóki są pliki i log'],
    ['Niezgodne kolumny w zapisie', 'Plik po prostu się zapisze', 'Zapis odrzucony (schema enforcement)']
  ]
};

/** Trzeci krok: z czego składa się platforma. Kolejność od dołu (dane) do góry (ludzie i procesy). */
export const stack = {
  caption: 'Warstwy platformy, od danych do wdrożeń. Nazwy produktów według dokumentacji Databricks z listopada 2026.',
  layers: [
    { name: 'Dane', what: 'Tabele Delta (lub Iceberg) jako pliki w object storage', where: 'etap Delta Lake' },
    { name: 'Compute', what: 'Spark i Photon: serverless, klastry klasyczne, SQL warehouses', where: 'etap Platforma' },
    { name: 'Governance', what: 'Unity Catalog: katalogi, uprawnienia, lineage, audyt', where: 'etap Platforma' },
    { name: 'Przetwarzanie i orkiestracja', what: 'Lakeflow: Connect, pipelines, Jobs', where: 'etap Platforma' },
    { name: 'Praca i wdrożenia', what: 'Notebooki, Git folders, bundles, CI/CD, monitoring', where: 'etap Platforma' }
  ]
};

/* ------------------------------------------------------------------ */
/* Etap 2: Delta Lake od środka                                        */
/* ------------------------------------------------------------------ */

export interface Row { id: number; customer: string; status: string; amount: number }
export interface DataFile { path: string; rows: Row[] }
export interface Commit {
  version: number;
  /** Dzień commitu w modelu (dzień 0 to utworzenie tabeli). Używa go symulacja time travel i VACUUM. */
  day: number;
  operation: string;
  sql: string;
  /** Akcje poza add i remove, np. protocol i metaData w pierwszym commicie. */
  extra?: string[];
  add: DataFile[];
  /** Ścieżki plików oznaczonych w tym commicie jako usunięte. Plik fizycznie zostaje w katalogu. */
  remove: string[];
  say: string;
}

const ala: Row = { id: 1, customer: 'Ala', status: 'new', amount: 120 };
const borys: Row = { id: 2, customer: 'Borys', status: 'new', amount: 80 };
const celina: Row = { id: 3, customer: 'Celina', status: 'paid', amount: 200 };
const daria: Row = { id: 4, customer: 'Daria', status: 'new', amount: 50 };
const emil: Row = { id: 5, customer: 'Emil', status: 'new', amount: 310 };
const borysPaid: Row = { ...borys, status: 'paid' };

/**
 * Centralna symulacja: pięć commitów na małej tabeli orders. Te same dane napędzają symulację logu
 * oraz symulację time travel i VACUUM. To model protokołu, a nie zapis z prawdziwej tabeli.
 */
export const log = {
  title: 'Co dokładnie zapisuje commit?',
  intro: [
    'Mała tabela <code>orders</code> i pięć operacji. Wykonuj je po kolei i patrz na trzy rzeczy naraz: co przybyło w logu, które pliki leżą w katalogu i co zwraca <code>SELECT *</code>.',
    'Potem kliknij wcześniejszy commit w logu. Zobaczysz tabelę w tamtej wersji.'
  ],
  assumptions: 'Model uproszczony: bez deletion vectors (każda zmiana wiersza przepisuje cały plik), nazwy plików skrócone, z akcji pokazane tylko najważniejsze pola. Prawdziwy commit zawiera też statystyki plików i szczegóły operacji.',
  commits: [
    {
      version: 0, day: 0, operation: 'CREATE TABLE AS SELECT',
      sql: 'CREATE TABLE orders AS SELECT … -- 3 zamówienia',
      extra: ['protocol: wymagana wersja czytnika i pisarza', 'metaData: schemat (id, customer, status, amount)'],
      add: [{ path: 'part-a.parquet', rows: [ala, borys, celina] }],
      remove: [],
      say: 'Pierwszy commit zapisuje wymagania protokołu, schemat tabeli i pierwszy plik danych. Od teraz tabela ma wersję 0.'
    },
    {
      version: 1, day: 1, operation: 'WRITE (append)',
      sql: "INSERT INTO orders VALUES (4, 'Daria', 'new', 50), (5, 'Emil', 'new', 310)",
      add: [{ path: 'part-b.parquet', rows: [daria, emil] }],
      remove: [],
      say: 'Dopisanie wierszy to nowy plik i jedna akcja add. Istniejących plików nikt nie rusza.'
    },
    {
      version: 2, day: 2, operation: 'UPDATE',
      sql: "UPDATE orders SET status = 'paid' WHERE id = 2",
      add: [{ path: 'part-c.parquet', rows: [ala, borysPaid, celina] }],
      remove: ['part-a.parquet'],
      say: 'Pliku Parquet nie da się zmienić w miejscu. Delta zapisuje nowy plik part-c z trzema wierszami (jeden zmieniony) i oznacza w logu part-a jako usunięty. Sam part-a nadal leży w katalogu: potrzebują go wcześniejsze wersje.'
    },
    {
      version: 3, day: 3, operation: 'DELETE',
      sql: 'DELETE FROM orders WHERE id = 5',
      add: [{ path: 'part-d.parquet', rows: [daria] }],
      remove: ['part-b.parquet'],
      say: 'Usunięcie wiersza działa tak samo: nowy plik bez tego wiersza i akcja remove dla starego. Wiersz Emila nadal jest w part-b, tylko że part-b nie należy już do bieżącej wersji.'
    },
    {
      version: 4, day: 4, operation: 'OPTIMIZE',
      sql: 'OPTIMIZE orders',
      add: [{ path: 'part-e.parquet', rows: [ala, borysPaid, celina, daria] }],
      remove: ['part-c.parquet', 'part-d.parquet'],
      say: 'OPTIMIZE skleja małe pliki w jeden. Wynik zapytania jest identyczny jak przed chwilą, zmienił się tylko układ plików. To też commit, więc tabela ma nową wersję.'
    }
  ] as Commit[],
  takeaway: [
    '<b>Wniosek.</b> Commit nie przechowuje danych, tylko zmianę listy plików: <code>add</code> i <code>remove</code>. Stan tabeli w wersji N to wynik odtworzenia commitów od 0 do N. Dlatego każda wcześniejsza wersja jest dostępna tak długo, jak długo istnieją jej pliki i jej wpisy w logu.',
    'Akcja <code>remove</code> niczego nie kasuje z dysku. Po pięciu operacjach tabela ma 4 wiersze w jednym pliku, a w katalogu leży pięć plików. Kto i kiedy je sprząta, zobaczysz przy VACUUM.'
  ],
  more: [
    {
      title: 'Checkpoint: czy czytelnik naprawdę czyta tysiące plików JSON',
      html: [
        'Nie. Co jakiś czas pisarz zapisuje w <code>_delta_log</code> <b>checkpoint</b>: plik (klasycznie Parquet) z kompletnym, już odtworzonym stanem tabeli na daną wersję. Czytelnik bierze najnowszy checkpoint i doczytuje tylko commity, które powstały po nim. Plik <code>_last_checkpoint</code> wskazuje, gdzie szukać.',
        'Jak często? Protokół mówi wprost, że czytelnik nie powinien niczego zakładać o częstotliwości checkpointów. Dokumentacja Databricks podaje, że platforma sama dobiera ją do rozmiaru danych i obciążenia, i że może się to zmienić bez zapowiedzi. Liczby typu „co 10 commitów” lepiej na rozmowie nie podawać jako reguły.',
        'Checkpoint ma drugą rolę: po jego zapisaniu Delta może usunąć wpisy logu starsze niż okres retencji logu (domyślnie 30 dni). To ogranicza time travel niezależnie od VACUUM.'
      ]
    },
    {
      title: 'Co jeszcze jest w commicie',
      html: [
        'Protokół definiuje m.in. akcje <code>add</code>, <code>remove</code>, <code>metaData</code> (schemat i właściwości tabeli), <code>protocol</code> (jakich funkcji musi używać czytnik i pisarz), <code>commitInfo</code> (kto i jaką operacją) oraz <code>txn</code> (identyfikator postępu aplikacji, używany np. przez streaming).',
        'Akcja <code>add</code> niesie też statystyki pliku: liczbę rekordów oraz najmniejszą i największą wartość i liczbę wartości NULL w kolumnach. Dzięki nim silnik potrafi pominąć plik bez otwierania go. To samo, co znasz z lekcji o predicate pushdown, tylko poziom wyżej: całe pliki zamiast grup wierszy.',
        'Pole <code>dataChange</code> mówi, czy commit zmienił dane, czy tylko ich układ. Protokół nazywa akcję <code>remove</code>, która czeka na wygaśnięcie, tombstone.'
      ]
    },
    {
      title: 'Deletion vectors: UPDATE bez przepisywania pliku',
      html: [
        'Model wyżej przepisuje cały plik przy zmianie jednego wiersza. Dokumentacja Databricks mówi to samo o tabelach bez deletion vectors. Dla pliku 1 GB i jednego wiersza to dużo pracy.',
        'Z włączonymi <term id="deletion-vectors">deletion vectors</term> zmiana albo usunięcie wiersza zapisuje obok pliku znacznik „ten wiersz nie obowiązuje”, a czytelnik uwzględnia go przy odczycie. Fizyczne przepisanie następuje później, np. przy OPTIMIZE.',
        'Zakres: dla tabel Delta deletion vectors trzeba włączyć jawnie, chyba że ustawienie workspace robi to dla nowych tabel. Dokumentacja zaznacza, że ustawienia domyślne różnią się między regionami. Nie zakładaj, że są wszędzie.'
      ]
    }
  ] as More[]
};

export interface ConflictCase {
  id: string;
  label: string;
  a: string;
  b: string;
  setup: string;
  ok: boolean;
  check: string;
  verdict: string;
}
/**
 * Dwóch piszących naraz. Kroki 1–4 są wspólne, piąty zależy od pary operacji.
 * Tabela konfliktów pochodzi z dokumentacji Databricks (poziom WriteSerializable, czyli domyślny).
 */
export const conflict = {
  title: 'Dwa joby piszą naraz. Kto wygrywa?',
  intro: [
    'W hurtowni silnik zakłada blokady albo kolejkuje transakcje. Tu nie ma serwera, który mógłby trzymać blokadę: są tylko pliki. Delta stosuje więc <b>optimistic concurrency control</b>: każdy pisze swoje pliki bez pytania, a konflikt sprawdza się dopiero w chwili commitu.',
    'Wybierz parę operacji i przejdź po krokach.'
  ],
  assumptions: 'Model według dokumentacji Databricks: domyślny poziom izolacji zapisu WriteSerializable. Oba joby startują, gdy tabela ma wersję 4. Tabela nie ma kolumn identity i nikt w tym czasie nie zmienia jej schematu ani właściwości. Reguły zależą od wersji Databricks Runtime i funkcji włączonych na tabeli.',
  steps: [
    'Oba joby czytają tabelę w wersji 4. Każdy zapamiętuje, które pliki przeczytał.',
    'Oba zapisują nowe pliki Parquet do katalogu tabeli. Dopóki nie ma commitu, nikt ich nie widzi.',
    'Job A jako pierwszy zapisuje commit numer 5. Tabela ma wersję 5.',
    'Job B też chce zapisać commit numer 5, ale ten plik już istnieje. Protokół zabrania nadpisania wpisu w logu, więc B musi sprawdzić, co zrobił A.'
  ],
  cases: [
    {
      id: 'append', label: 'INSERT + INSERT (blind append)',
      a: 'INSERT nowych zamówień', b: 'INSERT innych zamówień',
      setup: 'Dwa joby dopisują nowe wiersze zwykłym INSERT albo zapisem w trybie append. Żaden nie czyta tabeli docelowej: nie ma podzapytania ani warunku, który się do niej odwołuje. Takie dopisanie nazywa się blind append.',
      ok: true,
      check: 'A dodał tylko nowe pliki. B niczego z nich nie potrzebował.',
      verdict: 'Brak konfliktu przy tych założeniach. B zapisuje swój commit jako wersję 6 bez powtarzania pracy. To nie jest reguła dla każdego INSERT: gdy zapis czyta tabelę docelową, gdy ktoś w trakcie zmienia metadane tabeli albo gdy tabela ma kolumnę identity, wynik może być inny. Szczegóły są w rozwinięciu niżej.'
    },
    {
      id: 'same-file', label: 'UPDATE + UPDATE, ten sam plik',
      a: 'UPDATE zamówień z PL', b: 'UPDATE zamówień z DE',
      setup: 'Zamówienia z PL i z DE leżą w tych samych plikach. Tabela nie ma row-level concurrency.',
      ok: false,
      check: 'A usunął z listy plik, który B przeczytał i też chciał przepisać. Wynik B powstał na nieaktualnych danych.',
      verdict: 'Konflikt. Commit B kończy się wyjątkiem z rodziny Concurrent…Exception i operację trzeba ponowić od odczytu. Nic nie zostało zapisane w połowie: pliki B po prostu nie trafiły na listę.'
    },
    {
      id: 'row-level', label: 'UPDATE + UPDATE, różne wiersze, row-level concurrency',
      a: 'UPDATE zamówień z PL', b: 'UPDATE zamówień z DE',
      setup: 'Te same dwa UPDATE, ale tabela spełnia warunki row-level concurrency: Databricks Runtime 14.3 LTS lub nowszy, włączone deletion vectors, brak partycjonowania.',
      ok: true,
      check: 'A i B zmieniły ten sam plik, ale różne wiersze. Konflikt jest sprawdzany na poziomie wierszy.',
      verdict: 'Brak konfliktu w tym przypadku: Databricks wykrywa zmiany na poziomie wierszy i sam rozstrzyga zapisy do różnych wierszy tego samego pliku. Row-level concurrency zmniejsza liczbę konfliktów, ale ich nie usuwa. Konflikt zostaje przy tym samym wierszu, a przy złożonych warunkach, np. z podzapytaniem, wracają zwykłe reguły na poziomie plików.'
    },
    {
      id: 'insert-update', label: 'INSERT + UPDATE',
      a: 'INSERT nowych zamówień', b: 'UPDATE starych zamówień',
      setup: 'Job A dopisuje nowe wiersze i nie czyta tabeli (blind append), job B zmienia istniejące.',
      ok: true,
      check: 'A tylko dodał pliki. Przy domyślnym WriteSerializable to nie unieważnia UPDATE.',
      verdict: 'Brak konfliktu na poziomie domyślnym. Na poziomie Serializable ta para może się pogryźć i wtedy przegrywa UPDATE, nie INSERT.'
    }
  ] as ConflictCase[],
  takeaway: '<b>Wniosek.</b> Równoległe zapisy do jednej tabeli są normalne i często przechodzą bez konfliktu. Konflikt powstaje wtedy, gdy drugi piszący oparł się na czymś, co pierwszy właśnie zmienił: na plikach albo na metadanych tabeli. Przegrany dostaje błąd, a nie uszkodzoną tabelę. Liczbę konfliktów zmniejsza się tak, żeby joby dotykały rozłącznych plików albo, z row-level concurrency, rozłącznych wierszy. Dokładne reguły zależą od wersji Databricks Runtime i funkcji tabeli.',
  more: [
    {
      title: 'Poziomy izolacji i co widzi czytelnik',
      html: [
        'Odczyt zawsze używa snapshot isolation: zapytanie widzi jedną wersję tabeli od początku do końca. OPTIMIZE ani równoległy zapis nie blokują czytających.',
        'Zapis ma dwa poziomy. <b>WriteSerializable</b> jest domyślny i słabszy. <b>Serializable</b> jest najmocniejszy: przy konflikcie późniejsza operacja kończy się błędem i trzeba ją ponowić. Poziom ustawia się właściwością tabeli <code>delta.isolationLevel</code>.',
        'OPTIMIZE to też piszący. Według dokumentacji Databricks może wejść w konflikt z UPDATE, DELETE i MERGE, chyba że tabela ma deletion vectors i OPTIMIZE nie używa ZORDER BY. Dlatego kompaktowanie w środku okna ładowania potrafi wywrócić job.'
      ]
    },
    {
      title: 'Kiedy INSERT jednak wchodzi w konflikt',
      html: [
        'W tabeli konfliktów z dokumentacji Databricks „INSERT” oznacza dopisanie, które nie czyta tabeli docelowej: zwykły INSERT albo tryb append, bez podzapytań i warunków odwołujących się do tej tabeli. INSERT z podzapytaniem do tej samej tabeli podlega tym samym ograniczeniom co MERGE.',
        'Poziom izolacji ma znaczenie. Przy domyślnym WriteSerializable blind append nie wchodzi w konflikt. Przy Serializable może wejść w konflikt z równoległym UPDATE, DELETE albo MERGE.',
        'Zmiana metadanych w trakcie zapisu, np. <code>ALTER TABLE</code>, zmiana właściwości tabeli albo zapis, który zmienia schemat, może wywrócić wszystkie równoległe zapisy, także INSERT. To samo dotyczy aktualizacji protokołu tabeli.',
        'Tabele z kolumnami identity nie obsługują równoległych transakcji. Dokumentacja mówi to wprost.',
        'Row-level concurrency działa tylko na tabelach, które spełniają warunki: Databricks Runtime 14.3 LTS lub nowszy, deletion vectors, brak partycjonowania. Przy warunkach na typach złożonych, wyrażeniach niedeterministycznych i podzapytaniach wracają reguły na poziomie plików. Wykrywanie na poziomie wierszy wydłuża też zapis.'
      ]
    },
    {
      title: 'Jak czytać wyjątki konfliktu',
      html: [
        '<code>ConcurrentAppendException</code>: ktoś dodał pliki tam, skąd Twoja operacja czytała. <code>ConcurrentDeleteReadException</code>: ktoś usunął plik, który przeczytałeś. <code>ConcurrentDeleteDeleteException</code>: ktoś usunął plik, który Ty też usuwasz, np. dwie kompaktacje naraz.',
        '<code>MetadataChangedException</code>: w trakcie zmienił się schemat albo właściwości tabeli. Może dotknąć każdego równoległego zapisu, także INSERT. <code>ProtocolChangedException</code>: tabela została zaktualizowana do nowszego protokołu albo kilka jobów tworzy ją jednocześnie.',
        '<code>ConcurrentTransactionException</code>: dwa zapytania streamingowe używają tego samego checkpointu. To błąd konfiguracji, nie pech.',
        'Dokumentacja Delta Lake radzi rozdzielać zbiory plików, np. partycjonowaniem i jawnym warunkiem na kolumnę partycji. Databricks dodaje, że partycjonowanie po kolumnie o wielu wartościach szkodzi wydajności, i dla tabel bez partycji daje row-level concurrency.'
      ]
    }
  ] as More[]
};

export interface MergeRow { id: number; name: string; tier: string }
/** MERGE na przykładzie: cel, źródło i klauzule do włączenia. Wynik liczy czysta funkcja w aplikacji. */
export const merge = {
  title: 'MERGE: jedno polecenie, trzy możliwe losy wiersza',
  intro: [
    'Codzienna paczka zmian z systemu źródłowego zawiera klientów zmienionych i nowych. <code>MERGE</code> dopasowuje wiersze źródła do tabeli docelowej po warunku <code>ON</code> i dla każdego decyduje, co zrobić. Całość ląduje w jednym commicie.',
    'Włączaj i wyłączaj klauzule. Potem dodaj do źródła duplikat klucza.'
  ],
  assumptions: 'Model w przeglądarce: pokazuje semantykę klauzul, nie wykonuje SQL. Warunek dopasowania: target.id = source.id.',
  target: [
    { id: 1, name: 'Ala', tier: 'silver' },
    { id: 2, name: 'Borys', tier: 'gold' },
    { id: 3, name: 'Celina', tier: 'silver' },
    { id: 4, name: 'Daria', tier: 'bronze' }
  ] as MergeRow[],
  source: [
    { id: 2, name: 'Borys', tier: 'platinum' },
    { id: 4, name: 'Daria', tier: 'silver' },
    { id: 5, name: 'Emil', tier: 'bronze' }
  ] as MergeRow[],
  duplicate: { id: 2, name: 'Borys', tier: 'gold' } as MergeRow,
  clauses: [
    { id: 'matched', label: 'WHEN MATCHED THEN UPDATE', on: true },
    { id: 'notMatched', label: 'WHEN NOT MATCHED THEN INSERT', on: true },
    { id: 'bySource', label: 'WHEN NOT MATCHED BY SOURCE THEN DELETE', on: false }
  ],
  duplicateLabel: 'Źródło ma dwa wiersze dla id = 2',
  error: 'MERGE kończy się błędem: dwa wiersze źródła pasują do tego samego wiersza celu i oba chcą go zmienić. Delta nie zgaduje, który ma wygrać. Tabela zostaje w poprzedniej wersji.',
  bySourceNote: 'Uwaga na tę klauzulę: usuwa z celu wszystko, czego nie ma w źródle. Ma sens tylko wtedy, gdy źródło jest pełnym, wiarygodnym obrazem danych albo gdy dodatkowy warunek zawęża usuwanie do zakresu, który paczka pokrywa w całości, np. jednego dnia. Dla zwykłej paczki CDC z samymi zmianami skasowałaby klientów, którzy się po prostu nie zmienili.',
  takeaway: '<b>Wniosek.</b> MERGE to join źródła z celem plus reguły dla trzech grup wierszy: dopasowanych, obecnych tylko w źródle i obecnych tylko w celu. Jest atomowy, bo kończy się jednym commitem. Wymaga jednoznacznego źródła: najwyżej jeden wiersz źródła na klucz. Duplikat klucza, który pasuje do wiersza celu i go zmienia, kończy się błędem. Duplikat nowego klucza wstawia dwa wiersze bez błędu. Dlatego paczkę deduplikuje się przed MERGE.',
  codeTitle: 'To samo w SQL',
  lines: [
    {
      code: 'MERGE INTO customers AS t',
      label: 'Cel',
      text: 'Tabela Delta, która zostanie zmieniona. Tylko dla niej powstanie commit.'
    },
    {
      code: 'USING updates AS s',
      label: 'Źródło',
      text: 'Paczka zmian: tabela, widok albo podzapytanie. Tu wstawia się deduplikację, np. podzapytanie, które zostawia najnowszy wiersz na klucz.'
    },
    {
      code: 'ON t.id = s.id',
      label: 'Warunek dopasowania',
      text: 'Klucz biznesowy. Od niego zależy, czy ponowne uruchomienie tej samej paczki trafi w te same wiersze. To jest join, więc kosztuje jak join: układ plików celu po kluczu decyduje, ile z niego trzeba przeczytać i przepisać.'
    },
    {
      code: 'WHEN MATCHED AND s.updated_at > t.updated_at THEN UPDATE SET *',
      label: 'Wiersz jest w obu',
      text: 'Dodatkowy warunek po <code>AND</code> chroni przed nadpisaniem nowszych danych starszymi, gdy paczki przyjdą nie po kolei. <code>SET *</code> przepisuje wszystkie kolumny o tych samych nazwach.'
    },
    {
      code: 'WHEN NOT MATCHED THEN INSERT *',
      label: 'Wiersz jest tylko w źródle',
      text: 'Nowy klient. Pełna nazwa klauzuli to <code>WHEN NOT MATCHED BY TARGET</code>.'
    },
    {
      code: 'WHEN NOT MATCHED BY SOURCE THEN DELETE',
      label: 'Wiersz jest tylko w celu',
      text: 'Dostępne w Databricks SQL i Databricks Runtime 12.2 LTS lub nowszym. Bezpieczne tylko przy źródle będącym pełnym, wiarygodnym obrazem albo z dodatkowym warunkiem po <code>AND</code>, który zawęża usuwanie do zakresu pokrytego przez źródło. Nigdy dla zwykłej paczki zmian.'
    }
  ] as ExplainedLine[],
  more: [
    {
      title: 'Duplikaty w źródle: trzy różne przypadki',
      html: [
        'Kilka wierszy źródła pasuje do jednego wiersza celu, a klauzula go zmienia: wynik byłby niejednoznaczny, więc MERGE kończy się błędem. To pokazuje przełącznik w symulacji.',
        'Wyjątek: bezwarunkowy <code>DELETE</code>. Dokumentacja Databricks dopuszcza wtedy wiele dopasowań, bo usunięcie wiersza daje ten sam wynik niezależnie od tego, który wiersz źródła je wywołał.',
        'Dwa wiersze źródła mają ten sam nowy klucz, którego nie ma w celu: żaden nie jest dopasowany, więc <code>WHEN NOT MATCHED</code> wstawi oba. Powstaje duplikat i nie ma błędu. To wniosek z definicji klauzuli (wstawia wiersz dla każdego niedopasowanego wiersza źródła), nie wynik z labu.',
        'Deduplikacja paczki do jednego wiersza na klucz zamyka oba problemy naraz.'
      ]
    },
    {
      title: 'UPDATE i DELETE to ten sam mechanizm',
      html: [
        '<code>UPDATE</code> i <code>DELETE</code> widziałeś już w logu: znajdź pliki z pasującymi wierszami, zapisz nowe pliki, dodaj commit z <code>add</code> i <code>remove</code>. MERGE robi to samo, tylko pasujące wiersze wskazuje join ze źródłem.',
        'Stąd koszt: operacja, która zmienia 10 wierszy rozsianych po 500 plikach, bez deletion vectors przepisuje 500 plików. Dlatego układ danych po kluczu MERGE ma znaczenie, a małe, częste zmiany są droższe, niż sugeruje liczba wierszy.',
        'Od Databricks Runtime 16.0 przy wykrywaniu wielokrotnych dopasowań MERGE bierze pod uwagę także warunki z klauzul <code>WHEN MATCHED</code>, a nie tylko <code>ON</code>. To szczegół wersji, nie zasada ogólna.'
      ]
    }
  ] as More[]
};

/** Schema enforcement kontra schema evolution: dwie paczki, dwa tryby, cztery wyniki. */
export const schema = {
  title: 'Paczka ma kolumnę, której tabela nie zna',
  intro: [
    'System źródłowy zaczął wysyłać nową kolumnę <code>channel</code>. Job ładujący nic o tym nie wie. Wybierz paczkę i tryb zapisu.'
  ],
  assumptions: 'Model według dokumentacji Databricks dla INSERT i zapisu z DataFrame. Tabela orders ma kolumny id, customer, status, amount.',
  tableColumns: ['id', 'customer', 'status', 'amount'],
  batches: [
    { id: 'same', label: 'Paczka zgodna', columns: ['id', 'customer', 'status', 'amount'] },
    { id: 'extra', label: 'Paczka z kolumną channel', columns: ['id', 'customer', 'status', 'amount', 'channel'] }
  ],
  modes: [
    { id: 'enforce', label: 'Domyślnie' },
    { id: 'evolve', label: 'Z ewolucją schematu' }
  ],
  results: {
    'same|enforce': { ok: true, columns: ['id', 'customer', 'status', 'amount'], text: 'Zapis przechodzi. Schemat tabeli bez zmian.' },
    'same|evolve': { ok: true, columns: ['id', 'customer', 'status', 'amount'], text: 'Zapis przechodzi. Ewolucja nie ma nic do zrobienia, więc schemat zostaje bez zmian.' },
    'extra|enforce': { ok: false, columns: ['id', 'customer', 'status', 'amount'], text: 'Zapis odrzucony w całości: każda wstawiana kolumna musi istnieć w tabeli docelowej. Nie powstaje commit, tabela się nie zmienia. To jest schema enforcement.' },
    'extra|evolve': { ok: true, columns: ['id', 'customer', 'status', 'amount', 'channel'], text: 'Zapis przechodzi, a commit zawiera też zmianę schematu: kolumna channel trafia na koniec. Starsze wiersze mają w niej NULL. To jest schema evolution.' }
  } as Record<string, { ok: boolean; columns: string[]; text: string }>,
  takeaway: '<b>Wniosek.</b> <b>Schema enforcement</b> to zachowanie domyślne: tabela odrzuca zapis, który do niej nie pasuje, zamiast po cichu przyjąć śmieci. <b>Schema evolution</b> to świadoma zgoda na zmianę schematu razem z zapisem. Pierwsze chroni odbiorców danych, drugie oszczędza ręcznego <code>ALTER TABLE</code>. Które wybrać, zależy od warstwy: w surowej zwykle ewolucja, w tabelach, na których stoją raporty, zwykle kontrola.',
  more: [
    {
      title: 'Jak włącza się ewolucję',
      html: [
        'Przy zapisie z DataFrame: opcja <code>mergeSchema</code> ustawiona na <code>true</code>, w batchu i w streamingu.',
        'W SQL: <code>MERGE WITH SCHEMA EVOLUTION</code> (dokumentacja podaje w dwóch miejscach różne wersje minimalne, 15.2 i 15.4 LTS, więc sprawdź swoją) oraz <code>INSERT … WITH SCHEMA EVOLUTION</code> od Databricks Runtime 18.1.',
        'Ustawienie sesji <code>spark.databricks.delta.schema.autoMerge.enabled</code> nadal działa, ale dokumentacja oznacza je jako starsze i nie zaleca na produkcji: włącza ewolucję wszędzie, także tam, gdzie jej nie chciałeś.'
      ]
    },
    {
      title: 'Czego automatyczna ewolucja nie robi',
      html: [
        'Automatycznie dodaje tylko nowe kolumny (także pola zagnieżdżone). Nie zmieni typu kolumny: bez funkcji type widening dane są rzutowane w dół do typu tabeli.',
        '<b>Type widening</b> (Databricks Runtime 15.4 LTS lub nowszy) pozwala poszerzyć typ, np. INT do BIGINT albo FLOAT do DOUBLE, bez przepisywania danych. Włącza się go właściwością tabeli.',
        'Zmiana nazwy i usunięcie kolumny bez przepisywania danych wymagają włączonego mapowania kolumn (column mapping). Całkowite zastąpienie schematu przy nadpisaniu tabeli to opcja <code>overwriteSchema</code>.',
        'W MERGE jest subtelność: enforcement ignoruje kolumny źródła, których nie ma w celu, zamiast odrzucać zapis. Błąd dostaniesz dopiero wtedy, gdy przypiszesz wartość do nieistniejącej kolumny wprost.'
      ]
    }
  ] as More[]
};

/** Time travel i VACUUM. Model używa commitów z `log` i trzech przykładowych dni. */
export const timeTravel = {
  title: 'Jak daleko wstecz da się cofnąć?',
  intro: [
    'Skoro stare pliki zostają w katalogu, tabela pamięta swoje wcześniejsze wersje. To <b>time travel</b>. Pliki zajmują jednak miejsce, więc ktoś musi je kiedyś usunąć. Robi to <code>VACUUM</code>.',
    'Tabela z poprzedniej symulacji: pięć commitów w dniach od 0 do 4. Ustaw dzisiejszy dzień i zdecyduj, czy ktoś uruchomił VACUUM.'
  ],
  assumptions: 'Model uproszczony na wartościach domyślnych: retencja usuniętych plików 7 dni, retencja logu 30 dni. Wiek wersji liczę od dnia jej commitu. Wpisy logu starsze niż 30 dni model usuwa od razu. W rzeczywistości log jest sprzątany automatycznie po zapisie checkpointu, więc wpis nie znika dokładnie 30. dnia.',
  fileRetentionDays: 7,
  logRetentionDays: 30,
  days: [5, 9, 40],
  defaultDay: 5,
  statuses: {
    ok: { label: 'dostępna', text: 'Wpis w logu i wszystkie pliki tej wersji istnieją.' },
    current: { label: 'bieżąca', text: 'Aktualny stan tabeli. VACUUM nigdy nie usuwa plików bieżącej wersji.' },
    outside: { label: 'poza oknem', text: 'Pliki jeszcze leżą, ale wersja jest starsza niż retencja usuniętych plików (7 dni). Databricks blokuje takie zapytanie od Databricks Runtime 18.0, a dla tabel managed w Unity Catalog już od 12.2 LTS. Tam, gdzie blokady nie ma, odczyt może zadziałać do pierwszego VACUUM, więc nie wolno na tym polegać.' },
    files: { label: 'pliki usunięte', text: 'VACUUM skasował co najmniej jeden plik tej wersji. Wpis w logu jest, ale nie ma czego czytać.' },
    log: { label: 'log usunięty', text: 'Wpis logu przekroczył retencję 30 dni i model uznaje go za uprzątnięty. Naprawdę dzieje się to po zapisie checkpointu, a nie dokładnie 30. dnia. Po sprzątnięciu tej wersji nie da się już odtworzyć, nawet bez VACUUM.' }
  } as Record<string, { label: string; text: string }>,
  takeaway: [
    '<b>Wniosek.</b> Żeby odczytać starszą wersję, muszą istnieć oba składniki: jej wpis w logu i jej pliki danych. VACUUM usuwa pliki, których bieżąca wersja już nie używa i które zostały oznaczone jako usunięte dawniej niż próg retencji, domyślnie 7 dni. Dopiero VACUUM zwalnia miejsce.',
    'Time travel jest więc narzędziem do naprawy świeżej pomyłki i do audytu ostatnich dni, a nie kopią zapasową. Dokumentacja Databricks mówi to wprost: nie używaj historii tabeli jako długoterminowego backupu.'
  ],
  codeTitle: 'Polecenia, które warto znać',
  lines: [
    {
      code: 'DESCRIBE HISTORY orders',
      label: 'Lista wersji',
      text: 'Kto, kiedy i jaką operacją utworzył każdą wersję. Pierwsze miejsce, w które zaglądasz po pytaniu „kto to zepsuł”.'
    },
    {
      code: 'SELECT * FROM orders VERSION AS OF 2',
      label: 'Odczyt wersji',
      text: 'Tabela w stanie z commitu 2. Jest też <code>TIMESTAMP AS OF</code> z datą oraz skrót <code>orders@v2</code>.'
    },
    {
      code: 'RESTORE TABLE orders TO VERSION AS OF 2',
      label: 'Cofnięcie tabeli',
      text: 'Przywraca stan z wersji 2 jako nowy commit. Historia nie znika: pomyłka i jej cofnięcie zostają w logu. Wymaga uprawnienia do modyfikacji tabeli.'
    },
    {
      code: 'VACUUM orders',
      label: 'Fizyczne sprzątanie',
      text: 'Usuwa pliki nieużywane przez bieżącą wersję i starsze niż retencja. Wiek liczy się od chwili logicznego usunięcia pliku, a nie od daty jego utworzenia. Plików logu VACUUM nie rusza.'
    },
    {
      code: 'VACUUM orders RETAIN 0 HOURS',
      label: 'Tego nie rób bez powodu',
      text: 'Retencja krótsza niż 7 dni wymaga wyłączenia zabezpieczenia. Ryzyko: VACUUM skasuje pliki, których potrzebuje długo działający odczyt, albo niezatwierdzone jeszcze pliki trwającego zapisu.'
    }
  ] as ExplainedLine[],
  bridgeTitle: 'Analogia: Time Travel i Fail-safe w Snowflake',
  bridge: {
    from: 'Snowflake',
    known: 'Time Travel w Snowflake ma domyślnie 1 dzień retencji, a w edycji Enterprise do 90 dni dla trwałych tabel. Po nim działa Fail-safe: 7 dni, w których dane może odzyskać tylko Snowflake.',
    fresh: 'W Delcie tę samą rolę pełnią stare pliki i log: <code>VERSION AS OF</code>, <code>RESTORE</code>, a dla skasowanej tabeli managed <code>UNDROP</code>.',
    breaks: 'W Snowflake ustawiasz jedną liczbę, a resztę robi usługa. W Delcie są dwie retencje (plików i logu) oraz polecenie VACUUM, które ktoś musi uruchomić: Ty albo predictive optimization na tabelach managed. I nie ma odpowiednika Fail-safe: po VACUUM pliki znikają naprawdę.'
  } as Bridge,
  more: [
    {
      title: 'Jak wydłużyć okno i ile to kosztuje',
      html: [
        'Dwie właściwości tabeli: <code>delta.deletedFileRetentionDuration</code> (domyślnie 7 dni) i <code>delta.logRetentionDuration</code> (domyślnie 30 dni). Żeby cofać się o 30 dni, obie muszą na to pozwalać: potrzebny jest i log, z którego da się odtworzyć wersję, i jej pliki. Od Databricks Runtime 18.0 retencja logu nie może być krótsza niż retencja plików.',
        'Log jest sprzątany automatycznie po zapisie checkpointu. Dokumentacja nie obiecuje, że wpis zniknie dokładnie w dniu przekroczenia retencji, więc nie planuj niczego na ten dzień.',
        'Koszt: każdy przepisany plik leży w magazynie przez cały okres retencji. Tabela, która codziennie przepisuje większość danych, przy 30 dniach trzyma ich wielokrotność.',
        'VACUUM ma tryby FULL (domyślny) i LITE. LITE korzysta z logu zamiast listować cały katalog. Dokumentacja Databricks podaje dla niego dwie różne wersje minimalne (16.1 i 16.4 LTS), więc sprawdź swoją.',
        'VACUUM usuwa też z katalogu tabeli pliki, którymi Delta nie zarządza. Trzymanie tam własnych plików to proszenie się o kłopot.'
      ]
    }
  ] as More[]
};

/** Małe pliki i OPTIMIZE: trzy stany tej samej tabeli. Rozmiary są ilustracją. */
export const compaction = {
  title: 'Tysiąc małych plików zamiast kilku dużych',
  intro: [
    'Job streamingowy dopisuje do tabeli małą porcję co kilka minut. Każda porcja to osobny commit i osobny, mały plik. Dane się zgadzają, ale każde zapytanie musi teraz otworzyć setki plików: pobrać listę, wczytać stopki, zaplanować taski.',
    'Przejdź przez trzy stany tej samej tabeli.'
  ],
  assumptions: 'Ilustracja, nie pomiar: 24 pliki po 5 MB. Prawdziwe tabele mają tysiące plików, a rozmiar docelowy pliku dobiera platforma.',
  smallFiles: 24,
  smallMb: 5,
  states: [
    {
      id: 'before', label: 'Po dniu zapisów',
      current: 24, stored: 24, version: 24,
      text: 'Pełny skan otwiera 24 pliki po 5 MB. Każdy plik to osobne żądanie do magazynu i zwykle osobny task, więc większość czasu idzie na obsługę, a nie na czytanie danych.'
    },
    {
      id: 'optimized', label: 'Po OPTIMIZE',
      current: 1, stored: 25, version: 25,
      text: 'OPTIMIZE przepisał 24 pliki w jeden o rozmiarze 120 MB i dodał commit: 1 add, 24 remove. Zapytanie otwiera jeden plik. W magazynie przybyło danych: stare pliki nadal leżą, bo potrzebują ich wcześniejsze wersje.'
    },
    {
      id: 'vacuumed', label: 'Po VACUUM (po 7 dniach)',
      current: 1, stored: 1, version: 25,
      text: 'VACUUM usunął 24 stare pliki, bo minął próg retencji. Dopiero teraz magazyn się zmniejszył. Wersji sprzed OPTIMIZE nie da się już odczytać.'
    }
  ],
  takeaway: '<b>Wniosek.</b> OPTIMIZE i VACUUM rozwiązują dwa różne problemy. OPTIMIZE przyspiesza odczyt i nie zwalnia miejsca, a wręcz chwilowo je zajmuje. VACUUM zwalnia miejsce i nie przyspiesza zapytań. Na tabelach managed w Unity Catalog obie operacje może wykonywać za Ciebie predictive optimization.',
  more: [
    {
      title: 'Skąd się biorą małe pliki',
      html: [
        'Częste małe zapisy: streaming, MERGE uruchamiany co kilka minut, ładowanie plik po pliku.',
        'Za dużo partycji przy zapisie: z lekcji o partycjonowaniu wiesz, że każdy task zapisuje własny plik. 200 partycji shuffle\'u przy małej paczce to 200 drobnych plików.',
        'Partycjonowanie tabeli po kolumnie o wielu wartościach: każda wartość to osobny katalog z własnymi plikami.'
      ]
    },
    {
      title: 'Co Databricks robi sam',
      html: [
        '<b>Optimized writes</b> układają dane przed zapisem tak, żeby powstało mniej, większych plików. <b>Auto compaction</b> skleja małe pliki zaraz po udanym zapisie, na tym samym klastrze. Według dokumentacji oba mechanizmy są zawsze włączone dla MERGE, UPDATE i DELETE.',
        '<b>Predictive optimization</b> uruchamia OPTIMIZE, VACUUM i ANALYZE na tabelach managed w Unity Catalog. Jest domyślnie włączona, ale konto, katalog albo schemat mogą ją wyłączyć. Tabel external nie obejmuje.',
        'Rozmiar docelowy pliku nie jest jedną stałą. Dokumentacja opisuje automatyczne dostrajanie: 256 MB dla tabel poniżej 2,56 TB, rosnąco do 1 GB dla tabel powyżej 10 TB. Kompaktowanie jest idempotentne: drugi OPTIMIZE na tych samych danych nie ma nic do zrobienia.',
        'Zakres: to zachowanie Databricks. Delta Lake uruchamiany poza Databricks ma OPTIMIZE, ale tych automatów nie należy zakładać.'
      ]
    }
  ] as More[]
};

export interface ClusterFile { name: string; min: number; max: number }
/** Liquid clustering: te same dane w dwóch układach. Zakresy wymyślone. */
export const clustering = {
  title: 'Liquid clustering: żeby filtr otwierał mało plików',
  intro: [
    'Duże pliki to połowa sukcesu. Druga połowa to to, co w nich leży. Delta zapisuje w logu najmniejszą i największą wartość kolumn dla każdego pliku. Jeśli szukanej wartości nie ma między nimi, plik można pominąć bez otwierania. To <term id="data-skipping">data skipping</term>.',
    'Zapytanie szuka jednego klienta. Porównaj dwa układy tych samych danych.'
  ],
  assumptions: 'Ilustracja: 4 pliki, kolumna customer_id o wartościach od 1 do 1000. Zakresy są wymyślone.',
  query: 'SELECT * FROM orders WHERE customer_id = 417',
  value: 417,
  layouts: [
    {
      id: 'none', label: 'Bez układu',
      files: [
        { name: 'plik 1', min: 3, max: 998 },
        { name: 'plik 2', min: 1, max: 1000 },
        { name: 'plik 3', min: 7, max: 991 },
        { name: 'plik 4', min: 2, max: 996 }
      ] as ClusterFile[],
      text: 'Każdy plik zawiera klientów z całego zakresu, więc statystyki niczego nie wykluczają. Silnik musi otworzyć wszystkie cztery pliki, żeby znaleźć kilka wierszy.'
    },
    {
      id: 'clustered', label: 'CLUSTER BY (customer_id)',
      files: [
        { name: 'plik 1', min: 1, max: 250 },
        { name: 'plik 2', min: 251, max: 500 },
        { name: 'plik 3', min: 501, max: 750 },
        { name: 'plik 4', min: 751, max: 1000 }
      ] as ClusterFile[],
      text: 'Podobne wartości leżą razem, więc zakresy plików się nie nakładają. Trzy pliki odpadają na podstawie samych statystyk z logu. Pozostały plik nadal trzeba przeczytać i przefiltrować.'
    }
  ],
  takeaway: '<b>Wniosek.</b> Data skipping działa tylko wtedy, gdy podobne wartości leżą w tych samych plikach. <b>Liquid clustering</b> to deklaracja na tabeli (<code>CLUSTER BY</code>), po których kolumnach dane mają być układane. Układanie wykonuje OPTIMIZE, przyrostowo. Według dokumentacji Databricks zastępuje partycjonowanie i ZORDER i jest zalecany dla wszystkich nowych tabel.',
  bridgeTitle: 'Analogia: clustering key w Snowflake',
  bridge: {
    from: 'Snowflake',
    known: 'Snowflake dzieli tabelę na mikropartycje, trzyma dla nich statystyki i pomija te, które nie mogą zawierać wyniku. Kluczem klastrowania mówisz, po czym układać dane, a reszta dzieje się w tle.',
    fresh: 'W Delcie mikropartycją jest plik Parquet, statystyki siedzą w logu, a <code>CLUSTER BY</code> pełni rolę klucza klastrowania.',
    breaks: 'W Snowflake układanie jest usługą. W Delcie wykonuje je OPTIMIZE: uruchamiany przez Twój job albo przez predictive optimization, jeśli tabela jest managed. Na tabeli external bez własnego harmonogramu deklaracja <code>CLUSTER BY</code> niewiele zmieni dla danych, które zostały już zapisane.'
  } as Bridge,
  more: [
    {
      title: 'Zasady, o które pytają na rozmowie',
      html: [
        'Najwyżej cztery klucze. Wybiera się kolumny najczęściej używane w filtrach i joinach, a dla tabeli zasilanej przez MERGE także klucz MERGE.',
        'Nie łączy się z partycjonowaniem ani z ZORDER na tej samej tabeli.',
        'Klucze można zmienić bez przepisywania istniejących danych. Stare dane zachowują stary układ, dopóki nie wymusisz przepisania przez <code>OPTIMIZE FULL</code> (Databricks Runtime 16.0 lub nowszy).',
        '<code>CLUSTER BY AUTO</code> oddaje wybór kluczy platformie. Wymaga predictive optimization, czyli tabeli managed w Unity Catalog, i Databricks Runtime 15.4 LTS lub nowszego.',
        'Zakres: liquid clustering jest ogólnie dostępny dla tabel Delta od Databricks Runtime 15.4 LTS. Dostępności w Delta Lake poza Databricks w tej lekcji nie sprawdzałem.'
      ]
    },
    {
      title: 'A partycjonowanie?',
      html: [
        'Partycjonowanie tabeli dzieli pliki na katalogi według wartości kolumny, np. <code>date=2026-11-27</code>. Dla kolumny o niewielu wartościach daje proste i skuteczne pomijanie całych katalogów.',
        'Problemy: kolumny o wielu wartościach produkują masę drobnych plików, a zmiana kolumny partycjonującej oznacza przepisanie tabeli. Partycjonowana tabela nie skorzysta też z row-level concurrency.',
        'To nie jest ta sama partycja co w Sparku. Partycja Sparka to porcja danych dla jednego taska w trakcie obliczeń. Partycja tabeli to katalog na dysku.'
      ]
    }
  ] as More[]
};

/** Change Data Feed: zmiany na poziomie wiersza dla commitów 2 i 3 z symulacji logu. */
export const cdf = {
  title: 'Change Data Feed: co się zmieniło, a nie jak jest teraz',
  intro: [
    'Job zasilający kolejną warstwę nie chce czytać całej tabeli <code>orders</code> co godzinę. Chce tylko wierszy zmienionych od ostatniego razu. Time travel tego nie da: zwraca cały stan w danej wersji, więc różnicę trzeba by liczyć samemu.',
    '<b>Change Data Feed</b> (CDF) podaje tę różnicę wprost. Poniżej zmiany z commitów 2 (UPDATE) i 3 (DELETE) z symulacji logu.'
  ],
  assumptions: 'Ilustracja: tak wyglądałby wynik zapytania o zmiany dla tabeli z symulacji, gdyby CDF był włączony przed commitem 2. Kolumna _commit_timestamp pominięta.',
  query: "SELECT * FROM table_changes('orders', 2, 3)",
  columns: ['id', 'customer', 'status', 'amount', '_change_type', '_commit_version'],
  rows: [
    ['2', 'Borys', 'new', '80', 'update_preimage', '2'],
    ['2', 'Borys', 'paid', '80', 'update_postimage', '2'],
    ['5', 'Emil', 'new', '310', 'delete', '3']
  ],
  takeaway: '<b>Wniosek.</b> CDF zwraca zmiany na poziomie wiersza z oznaczeniem typu: <code>insert</code>, <code>delete</code> oraz para <code>update_preimage</code> i <code>update_postimage</code>, czyli wiersz przed zmianą i po niej. Odbiorca czyta zmiany od ostatnio przetworzonej wersji i zwykle robi z nich MERGE do swojej tabeli.',
  more: [
    {
      title: 'Włączanie, odczyt i ograniczenia',
      html: [
        'Klasycznie CDF włącza się właściwością tabeli <code>delta.enableChangeDataFeed = true</code>. Rejestruje zmiany dopiero od tego momentu. Zakres wersji w <code>table_changes</code> jest obustronnie domknięty.',
        'Z DataFrame: opcja <code>readChangeFeed</code> z <code>startingVersion</code>, w batchu albo jako stream. W streamie postęp pamięta checkpoint zapytania.',
        'Pliki zmian podlegają retencji tabeli, więc VACUUM je usuwa. Odbiorca, który zaśpi dłużej niż retencja, musi przeładować całość.',
        'Dokumentacja Databricks zaleca dziś migrację do <b>automatic change data feed</b>, liczonego przy odczycie i bez ustawień na tabeli. Wymaga Databricks Runtime 19 lub nowszego oraz m.in. tabeli z row tracking. Starszego i nowego CDF nie da się używać razem na jednej tabeli.',
        'CDF to nie CDC ze źródła. CDC przenosi zmiany z bazy operacyjnej do lakehouse. CDF opisuje zmiany w samej tabeli Delta, już po załadowaniu.'
      ]
    }
  ] as More[]
};

/* ------------------------------------------------------------------ */
/* Etap 3: Platforma                                                   */
/* ------------------------------------------------------------------ */

export interface ArchBox { id: string; name: string; owner: 'databricks' | 'you'; items: string[]; text: string }
/** Architektura: control plane, dwa rodzaje compute plane i storage. Według strony High-level architecture. */
export const arch = {
  title: 'Gdzie co działa: control plane, compute plane, storage',
  intro: [
    'Pierwsze pytanie działu bezpieczeństwa brzmi: gdzie są nasze dane i kto je przetwarza? Databricks dzieli platformę na części, które leżą na różnych kontach chmurowych. Kliknij każdą z nich.'
  ],
  assumptions: 'Schemat według dokumentacji Databricks (AWS; na Azure i GCP podział jest analogiczny). To uproszczona mapa, nie diagram sieci.',
  owners: { databricks: 'konto Databricks', you: 'Twoje konto chmurowe' },
  boxes: [
    {
      id: 'control', name: 'Control plane', owner: 'databricks',
      items: ['aplikacja webowa i API', 'Unity Catalog', 'Lakeflow Jobs', 'notebooki i zapytania'],
      text: 'Usługi, którymi zarządza Databricks na własnym koncie: interfejs workspace, harmonogram jobów, katalog z uprawnieniami, przechowywanie kodu notebooków. Zapytań na Twoich tabelach nie liczy control plane, tylko compute plane. Stąd wychodzą polecenia do compute.'
    },
    {
      id: 'serverless', name: 'Serverless compute plane', owner: 'databricks',
      items: ['serverless SQL warehouses', 'serverless dla notebooków i jobów', 'serverless pipelines'],
      text: 'Maszyny, które liczą zapytania, działają na koncie Databricks. Nie tworzysz ich w swojej chmurze i nie konfigurujesz. Dane nadal czytane są z magazynu, w którym leżą.'
    },
    {
      id: 'classic', name: 'Classic compute plane', owner: 'you',
      items: ['klastry all-purpose i job clusters', 'SQL warehouses typu pro i classic'],
      text: 'Maszyny działają na Twoim koncie chmurowym i w Twojej sieci. Databricks je uruchamia i wyłącza, ale to Ty wybierasz typy maszyn, płacisz dostawcy chmury za instancje i odpowiadasz za konfigurację sieci.'
    },
    {
      id: 'storage', name: 'Storage', owner: 'you',
      items: ['pliki tabel Delta i Iceberg', 'wolumeny z plikami', 'workspace storage'],
      text: 'Dane tabel leżą w object storage jako pliki w otwartym formacie. W klasycznym workspace jego magazyn jest na Twoim koncie. Wyjątek, o którym warto wiedzieć: workspace typu serverless korzysta z domyślnego magazynu zarządzanego w całości przez Databricks.'
    }
  ] as ArchBox[],
  defaultBox: 'control',
  takeaway: '<b>Wniosek.</b> „Serverless” mówi, gdzie działa compute, a nie gdzie leżą dane. W tej architekturze control plane działa na koncie Databricks. Compute działa albo u Databricks (serverless), albo na Twoim koncie chmurowym (classic). Pliki tabel leżą w object storage i w klasycznym workspace jest to magazyn na Twoim koncie. Szczegóły, np. sieć i nazwy zasobów, zależą od chmury.',
  bridgeTitle: 'Analogia: trzy warstwy Snowflake',
  bridge: {
    from: 'Snowflake',
    known: 'Snowflake ma trzy warstwy: storage, compute (virtual warehouses) i cloud services. Wszystkie działają po stronie usługi, a Ty widzisz tylko SQL.',
    fresh: 'Control plane odpowiada warstwie cloud services, a SQL warehouse to odpowiednik virtual warehouse. Serverless jest najbliżej doświadczenia ze Snowflake: bierzesz compute i nie widzisz maszyn.',
    breaks: 'Storage nie jest częścią usługi w tym samym sensie: pliki leżą w magazynie w otwartym formacie i inne silniki mogą je czytać, o ile obsługują funkcje użyte w tabeli i mają do niej uprawnienia. Compute bywa na Twoim koncie, z Twoją siecią i Twoim rachunkiem od dostawcy chmury. I compute to nie tylko SQL: ten sam katalog obsługuje joby w Pythonie, streaming i modele.'
  } as Bridge,
  more: [
    {
      title: 'Konto, workspace, metastore',
      html: [
        '<b>Konto</b> Databricks to poziom najwyższy: rozliczenia, użytkownicy, lista workspace\'ów. <b>Workspace</b> to środowisko pracy: notebooki, joby, compute. Konto może mieć wiele workspace\'ów, np. osobne dla dev i prod.',
        '<b>Metastore</b> Unity Catalog jest obiektem na poziomie konta i może być podpięty do wielu workspace\'ów w tym samym regionie. Dzięki temu tabela i jej uprawnienia są wspólne dla workspace\'ów podpiętych do tego samego metastore, a nie przypisane do jednego. Workspace z innym metastore, np. w innym regionie, ich nie widzi.'
      ]
    }
  ] as More[]
};

export interface ComputeCase { id: string; label: string; pick: string; why: string; manage: string; catch: string }
/** Compute: cztery typowe obciążenia i właściwy rodzaj compute. */
export const compute = {
  title: 'Który compute do czego?',
  intro: [
    'W Snowflake wybierasz rozmiar warehouse i tyle. Databricks ma kilka rodzajów compute, bo obsługuje więcej niż SQL. Wybierz obciążenie.'
  ],
  assumptions: 'Zalecenia według dokumentacji Databricks z listopada 2026. Dostępność serverless zależy od regionu i konfiguracji workspace.',
  cases: [
    {
      id: 'bi', label: 'Dashboardy i SQL analityków',
      pick: 'SQL warehouse, najlepiej serverless',
      why: 'SQL warehouse to compute do zapytań SQL: edytor SQL, dashboardy, narzędzia BI, dbt. Są trzy typy: serverless, pro i classic. Databricks zaleca serverless tam, gdzie jest dostępny. Dokumentacja podaje dla niego start zwykle w 2–6 sekund, a dla typu pro około 4 minut.',
      manage: 'Rozmiar i liczbę klastrów do obsługi współbieżności. Resztą zajmuje się platforma.',
      catch: 'To nie jest compute ogólnego przeznaczenia. Notebook podpięty do SQL warehouse wykona tylko komórki SQL i Markdown: komórka w Pythonie kończy się błędem.'
    },
    {
      id: 'job', label: 'Nocny job ETL w PySparku',
      pick: 'Lakeflow Jobs na serverless albo na job cluster',
      why: 'Job uruchamia się na compute tworzonym dla tego przebiegu. W wariancie klasycznym to job cluster: powstaje na start joba i znika po nim. W wariancie serverless nie konfigurujesz maszyn wcale.',
      manage: 'Classic: wersję Databricks Runtime, typy i liczbę maszyn, autoskalowanie. Serverless: prawie nic.',
      catch: 'Serverless ma ograniczenia, które znasz z poprzednich lekcji: brak Spark UI (jest query profile), tylko API Spark Connect, niewiele ustawień Sparka do zmiany.'
    },
    {
      id: 'dev', label: 'Praca interaktywna w notebooku',
      pick: 'Serverless dla notebooków albo klaster all-purpose',
      why: 'Do eksploracji i pisania kodu potrzebujesz compute, który odpowiada od razu i obsługuje Pythona, SQL, Scalę i R. W workspace z Unity Catalog nowe notebooki domyślnie korzystają z serverless.',
      manage: 'Classic: klaster, który ktoś musi włączyć, wyłączyć i opłacić także wtedy, gdy stoi bezczynnie.',
      catch: 'Klaster all-purpose współdzielony przez zespół to wygoda, ale produkcyjne joby na nim to zły pomysł: konkurują o zasoby z ludźmi i zależą od ręcznie zmienianego klastra.'
    },
    {
      id: 'pipeline', label: 'Przyrostowy pipeline bronze → silver → gold',
      pick: 'Lakeflow pipelines (Spark Declarative Pipelines)',
      why: 'Deklarujesz tabele i zapytania, które je wypełniają, a platforma ustala kolejność, przetwarza przyrostowo, ponawia po błędach i sama zarządza compute. Dalej w tym etapie zobaczysz, jak to wygląda w kodzie.',
      manage: 'Definicje tabel i reguły jakości. Nie piszesz orkiestracji ani obsługi checkpointów.',
      catch: 'To osobny model pracy, nie zwykły job z notebookiem. Nie każdą logikę da się wygodnie wyrazić deklaratywnie.'
    }
  ] as ComputeCase[],
  defaultCase: 'bi',
  labels: { pick: 'Wybór', why: 'Dlaczego', manage: 'Czym zarządzasz', catch: 'Haczyk' },
  takeaway: '<b>Wniosek.</b> Rodzaj compute wynika z obciążenia: SQL warehouse do SQL i BI, compute jobów do zaplanowanego przetwarzania, compute notebooków do pracy interaktywnej, pipelines do deklaratywnego przetwarzania przyrostowego. Wszystkie czytają te same tabele z tego samego katalogu.',
  more: [
    {
      title: 'Photon i nazwy, które zmieniają się częściej niż architektura',
      html: [
        '<b>Photon</b> to wektorowy silnik zapytań wbudowany w Databricks, zgodny z API Sparka. Działa we wszystkich typach SQL warehouse. Twojego kodu nie zmienia, zmienia sposób wykonania.',
        'W dokumentacji spotkasz dwa zestawy nazw compute klasycznego: starsze „all-purpose cluster” i „job cluster” oraz nowsze tryby dostępu „standard” (współdzielony) i „dedicated” (dla jednego użytkownika lub grupy). Na rozmowie padną raczej te pierwsze.',
        'SQL warehouse do 2023 roku nazywał się SQL endpoint. Git folders to dawne Repos. Bundles to dawne Databricks Asset Bundles. Warto znać obie nazwy, bo ogłoszenia o pracę są starsze niż dokumentacja.'
      ]
    }
  ] as More[]
};

export interface UcObject { id: string; name: string; kind: 'table' | 'volume'; schema: string }
/** Unity Catalog: hierarchia i dziedziczenie uprawnień. Reguła dostępu według Privileges reference. */
export const uc = {
  title: 'Unity Catalog: jeden katalog i jedne uprawnienia',
  intro: [
    'Tabela to pliki w magazynie. Kto może je czytać? Gdyby decydowały o tym uprawnienia do magazynu, każdy silnik i każdy workspace pilnowałby dostępu po swojemu. <b>Unity Catalog</b> to warstwa governance wbudowana w Databricks: jeden rejestr obiektów i jedno miejsce nadawania uprawnień.',
    'Obiekty mają trzyczłonowe nazwy: <code>katalog.schemat.obiekt</code>. Analityk ma dostać dostęp do danych sprzedaży. Wybierz, na jakim poziomie nadajesz <code>SELECT</code>, i włącz uprawnienia <code>USE</code>.'
  ],
  assumptions: 'Model reguły z dokumentacji: tabelę da się odczytać, gdy masz SELECT (nadane na niej albo wyżej) oraz USE CATALOG i USE SCHEMA na obiektach nadrzędnych. Nazwy obiektów są wymyślone.',
  catalog: 'prod',
  schemas: ['sales', 'finance'],
  objects: [
    { id: 'orders', name: 'orders', kind: 'table', schema: 'sales' },
    { id: 'customers', name: 'customers', kind: 'table', schema: 'sales' },
    { id: 'raw_files', name: 'raw_files', kind: 'volume', schema: 'sales' },
    { id: 'invoices', name: 'invoices', kind: 'table', schema: 'finance' }
  ] as UcObject[],
  grants: [
    { id: 'catalog', label: 'ON CATALOG prod' },
    { id: 'schema', label: 'ON SCHEMA prod.sales' },
    { id: 'table', label: 'ON TABLE prod.sales.orders' }
  ],
  defaultGrant: 'schema',
  useCatalogLabel: 'USE CATALOG ON CATALOG prod',
  useSchemaLabel: 'USE SCHEMA ON SCHEMA prod.sales',
  volumeNote: 'wolumen: pliki, osobne uprawnienie READ VOLUME',
  verdicts: {
    none: 'Analityk nie przeczyta żadnej tabeli. SELECT jest nadany, ale bez uprawnień USE na katalogu i schemacie nie da się nawet dojść do obiektu.',
    some: 'Analityk przeczyta tabele zaznaczone na zielono.',
    finance: 'Zwróć uwagę na prod.finance.invoices: SELECT nadany na katalogu ją obejmuje, ale analityk nie ma USE SCHEMA na prod.finance, więc jej nie przeczyta.'
  },
  takeaway: '<b>Wniosek.</b> Uprawnienia dziedziczą się w dół: nadane na katalogu albo schemacie obejmują obecne i przyszłe obiekty w środku. Do odczytu tabeli potrzeba kompletu: <code>SELECT</code> oraz <code>USE CATALOG</code> i <code>USE SCHEMA</code> na drodze do niej. Same uprawnienia <code>USE</code> nie dają dostępu do danych.',
  bridgeTitle: 'Analogia: role i USAGE w Snowflake',
  bridge: {
    from: 'Snowflake',
    known: 'W Snowflake nadajesz roli <code>USAGE</code> na bazie i schemacie oraz <code>SELECT</code> na tabeli. Adres obiektu to baza, schemat, tabela.',
    fresh: 'Unity Catalog działa tak samo: <code>USE CATALOG</code>, <code>USE SCHEMA</code>, <code>SELECT</code>, a adres to katalog, schemat, tabela. Katalog jest odpowiednikiem bazy.',
    breaks: 'W Snowflake dane i uprawnienia siedzą w jednej usłudze, więc nie da się ich obejść. Tu pliki leżą w magazynie chmurowym: kto dostanie bezpośredni dostęp do magazynu, ominie Unity Catalog. Dlatego dostęp do magazynu dostaje katalog, a nie ludzie. Katalog obejmuje też rzeczy, których hurtownia nie ma: wolumeny z plikami i modele.'
  } as Bridge,
  more: [
    {
      title: 'Tabela managed i tabela external',
      html: [
        '<b>Managed</b>: Unity Catalog zarządza odczytem, zapisem, lokalizacją plików i optymalizacją. Po <code>DROP TABLE</code> pliki są usuwane po okresie odzyskiwania (domyślnie 7 dni), a do tego czasu działa <code>UNDROP TABLE</code>. Formaty: Delta Lake i Apache Iceberg.',
        '<b>External</b>: Ty wskazujesz lokalizację, a Unity Catalog pilnuje tylko metadanych i dostępu. Po <code>DROP TABLE</code> pliki zostają w magazynie. Nie zarządza cyklem życia, układem ani optymalizacją danych.',
        'Databricks w większości przypadków zaleca managed. Część funkcji działa wyłącznie tam: predictive optimization, automatyczny liquid clustering, transakcje na wielu instrukcjach. External wybiera się wtedy, gdy pliki muszą leżeć w konkretnym miejscu albo zapisuje je system spoza Databricks.'
      ]
    },
    {
      title: 'Co jeszcze należy do governance',
      html: [
        '<b>Wiersze i kolumny.</b> Filtry wierszy i maski kolumn ograniczają to, co użytkownik widzi w tabeli. Są też polityki oparte na atrybutach (ABAC).',
        '<b>Lineage.</b> Unity Catalog automatycznie zapisuje, z czego powstała tabela i kolumna. Dane są dostępne w tabelach systemowych <code>system.access.table_lineage</code> i <code>system.access.column_lineage</code>.',
        '<b>Audyt.</b> Kto i co zrobił: <code>system.access.audit</code>.',
        '<b>Pozostałe obiekty.</b> Wolumeny (pliki, które nie są tabelami), funkcje, modele. Bezpośrednio pod metastore leżą m.in. storage credentials i external locations, czyli opis tego, jak katalog dostaje się do magazynu.',
        'Uprawnienie <code>BROWSE</code> pozwala zobaczyć, że obiekt istnieje, i poprosić o dostęp, bez prawa do czytania danych.'
      ]
    }
  ] as More[]
};

/** Lakeflow: Jobs i pipelines. Składnia SQL według dokumentacji pipelines. */
export const lakeflow = {
  title: 'Lakeflow: co uruchamia kod i w jakiej kolejności',
  intro: [
    'Notebook, który działa, gdy go klikniesz, to nie pipeline. Ktoś musi go uruchomić o 2:00, poczekać na dane, ponowić po błędzie i powiadomić zespół. Databricks zbiera te funkcje pod nazwą <b>Lakeflow</b>: Lakeflow Connect do pobierania danych ze źródeł, Lakeflow pipelines do transformacji i Lakeflow Jobs do orkiestracji.',
    '<b>Lakeflow Jobs</b> to harmonogram i orkiestrator. Job składa się z tasków, które tworzą graf zależności. Taskiem może być notebook, skrypt Pythona, zapytanie SQL, pipeline, projekt dbt albo inny job. Job startuje według harmonogramu albo po zdarzeniu, np. gdy w magazynie pojawią się nowe dane.',
    '<b>Lakeflow pipelines</b> idą krok dalej: zamiast pisać kroki, deklarujesz tabele. Kliknij linie.'
  ],
  codeTitle: 'Pipeline deklaratywny w SQL',
  lines: [
    {
      code: 'CREATE OR REFRESH STREAMING TABLE orders_silver (',
      label: 'Tabela przyrostowa',
      text: 'Streaming table przetwarza każdy rekord źródła raz, przy założeniu, że źródło tylko rośnie. Nie piszesz obsługi checkpointu ani logiki „co już wczytałem”: pilnuje tego pipeline.'
    },
    {
      code: '  CONSTRAINT valid_amount EXPECT (amount > 0) ON VIOLATION DROP ROW',
      label: 'Reguła jakości',
      text: 'To <b>expectation</b>. Są trzy reakcje na naruszenie: samo <code>EXPECT</code> zapisuje wiersz i liczy naruszenia, <code>ON VIOLATION DROP ROW</code> odrzuca wiersz, a <code>ON VIOLATION FAIL UPDATE</code> zatrzymuje aktualizację.'
    },
    {
      code: ') AS SELECT * FROM STREAM orders_bronze;',
      label: 'Skąd dane',
      text: 'Zwykłe zapytanie. <code>STREAM</code> mówi, że źródło ma być czytane przyrostowo. Pipeline sam wykrywa, że ta tabela zależy od <code>orders_bronze</code>, i ustawia kolejność.'
    },
    {
      code: 'CREATE OR REFRESH MATERIALIZED VIEW revenue_daily',
      label: 'Wynik utrzymywany przez platformę',
      text: 'Materialized view przechowuje wynik zapytania i jest przeliczany w miarę potrzeby, tak żeby odpowiadał bieżącemu stanowi danych. Nie musi liczyć wszystkiego od zera.'
    },
    {
      code: 'AS SELECT order_date, SUM(amount) AS revenue FROM orders_silver GROUP BY order_date;',
      label: 'Agregat',
      text: 'Definicja jak w zwykłym widoku. Różnica względem <code>CREATE VIEW</code>: wynik jest zapisany, więc odczyt nie liczy agregacji za każdym razem.'
    }
  ] as ExplainedLine[],
  takeaway: '<b>Wniosek.</b> Jobs odpowiada na pytanie „kiedy i w jakiej kolejności”. Pipelines odpowiadają na pytanie „jakie tabele mają istnieć i z czego powstają”, a kolejność, przyrostowość i ponawianie biorą na siebie. W praktyce łączy się oba: pipeline jest jednym z tasków joba.',
  bridgeTitle: 'Analogia: projekt dbt',
  bridge: {
    from: 'dbt',
    known: 'W dbt deklarujesz modele jako zapytania <code>SELECT</code>, dbt wyprowadza z nich graf zależności, a testy sprawdzają dane po zbudowaniu modelu.',
    fresh: 'Pipeline deklaratywny robi to samo po stronie Databricks: tabela to zapytanie, graf wynika z odwołań, a expectations pełnią rolę testów.',
    breaks: 'dbt generuje SQL i wysyła go do silnika, a orkiestrację i przyrostowość ustawiasz sam (modele incremental, harmonogram na zewnątrz). Pipeline sam jest środowiskiem wykonania: zarządza compute, stanem streamingu i ponawianiem. Expectation działa w trakcie zapisu i potrafi odrzucić wiersz, a test dbt sprawdza tabelę już po fakcie. Jedno nie wyklucza drugiego: dbt jest też typem taska w Lakeflow Jobs.'
  } as Bridge,
  more: [
    {
      title: 'Nazwy: DLT, Lakeflow pipelines, Spark Declarative Pipelines',
      html: [
        'Ten produkt nazywał się Delta Live Tables (DLT). Dokumentacja Databricks z listopada 2026 mówi: produkt znany wcześniej jako DLT to teraz <b>Lakeflow pipelines</b>, a strona główna nosi tytuł „Spark Declarative Pipelines on Lakeflow”.',
        'Lakeflow pipelines są zbudowane na otwartym Apache Spark Declarative Pipelines i z nim zgodne, ale dokładają własne funkcje. Przykład z dokumentacji: AUTO CDC, czyli gotowa obsługa zdarzeń CDC z wariantami SCD typu 1 i 2, nie jest dostępne w otwartej wersji.',
        'W ogłoszeniach i na rozmowach usłyszysz też „DLT” oraz „Lakeflow Spark Declarative Pipelines” lub „Lakeflow Declarative Pipelines”. To ten sam produkt na różnych etapach nazewnictwa. Powiedz, że znasz obie nazwy, i przejdź do mechanizmu.'
      ]
    },
    {
      title: 'Notebooki i praca z kodem',
      html: [
        '<b>Notebook</b> to dokument z komórkami kodu w Pythonie, SQL, Scali i R. Dobry do eksploracji i jako task joba.',
        '<b>Git folders</b> (dawniej Repos) podpinają repozytorium Git do workspace: gałęzie, commity i pull requesty zamiast kopiowania notebooków.',
        '<b>Databricks Connect</b> to biblioteka kliencka, która łączy Twoje IDE z compute Databricks. Piszesz i debugujesz lokalnie, a kod wykonuje się na platformie.',
        'Dojrzały sposób pracy: logika w zwykłych funkcjach i modułach Pythona, testowanych lokalnie, a notebook albo task tylko je wywołuje.'
      ]
    }
  ] as More[]
};

/** Bundles i CI/CD: plik databricks.yml linia po linii oraz przepływ wdrożenia. */
export const deploy = {
  title: 'Z repozytorium na produkcję: bundles i CI/CD',
  intro: [
    'Job wyklikany w interfejsie istnieje w jednym workspace, nikt go nie zrecenzował i nie da się go odtworzyć. <b>Declarative Automation Bundles</b> (dawniej Databricks Asset Bundles) zamieniają definicję jobów i pipeline\'ów w pliki w repozytorium. Kliknij linie pliku konfiguracyjnego.'
  ],
  codeTitle: 'databricks.yml',
  lines: [
    {
      code: 'bundle:\n  name: orders_etl',
      label: 'Projekt',
      text: 'Bundle to katalog w repozytorium z tym plikiem i kodem obok. Nazwa identyfikuje wdrożenie.'
    },
    {
      code: 'resources:\n  jobs:\n    nightly_orders:',
      label: 'Zasoby',
      text: 'Co ma powstać w workspace: joby, pipeline\'y i inne zasoby. To ta sama definicja, którą widać w interfejsie, tylko zapisana jako kod i recenzowana w pull requeście.'
    },
    {
      code: '      tasks:\n        - task_key: load\n          notebook_task:\n            notebook_path: ./src/load.py',
      label: 'Taski joba',
      text: 'Ścieżki wskazują pliki z repozytorium. Wdrożenie przenosi kod i definicję razem, więc job zawsze uruchamia tę wersję kodu, która została wdrożona.'
    },
    {
      code: 'targets:\n  dev:\n    mode: development\n    default: true',
      label: 'Środowisko dev',
      text: 'Target to środowisko. W trybie development zasoby dostają prefiks z nazwą użytkownika, a harmonogramy są wstrzymane, więc dwie osoby nie wchodzą sobie w drogę.'
    },
    {
      code: '  prod:\n    mode: production\n    run_as:\n      service_principal_name: …',
      label: 'Środowisko prod',
      text: 'Ten sam job, inny workspace i inna tożsamość. Na produkcję wdraża i uruchamia <term id="service-principal">service principal</term>, a nie konto osoby. Dokumentacja zaleca to wprost.'
    }
  ] as ExplainedLine[],
  flowTitle: 'Typowy przepływ',
  flow: [
    { step: 'Pull request', text: 'testy jednostkowe i <code>databricks bundle validate</code>' },
    { step: 'Dev albo staging', text: '<code>databricks bundle deploy -t dev</code> i próbny przebieg przez <code>bundle run</code>' },
    { step: 'Merge do main', text: 'pipeline CI wdraża <code>-t prod</code> jako service principal' },
    { step: 'Produkcja', text: 'job działa według harmonogramu, a zmiana wraca tą samą drogą' }
  ],
  takeaway: '<b>Wniosek.</b> Bundle to dla zasobów platformy to samo, czym projekt dbt jest dla modeli: definicja w Gicie, te same pliki dla każdego środowiska, wdrożenie jednym poleceniem z CI. Dokumentacja Databricks nazywa bundles zalecanym podejściem do CI/CD.',
  more: [
    {
      title: 'Monitoring: gdzie patrzeć, gdy coś nie działa',
      html: [
        '<b>Joby.</b> Historia przebiegów w interfejsie Lakeflow Jobs oraz powiadomienia e-mailem albo webhookiem, gdy job padnie lub trwa za długo. Do analizy zbiorczej tabela systemowa <code>system.lakeflow.job_run_timeline</code>.',
        '<b>Zapytania.</b> Historia zapytań i query profile: plan z metrykami operatorów, m.in. ilość danych zrzuconych na dysk. To odpowiednik Query Profile ze Snowflake.',
        '<b>Pipelines.</b> Dziennik zdarzeń pipeline\'u, w tym wyniki expectations.',
        '<b>Koszty.</b> Tabela systemowa <code>system.billing.usage</code>.',
        '<b>Jakość danych.</b> Funkcja data quality monitoring: wykrywanie anomalii i profilowanie danych. Profilowanie nazywało się wcześniej Lakehouse Monitoring.',
        'Tabele systemowe to zwykłe tabele w katalogu <code>system</code>. Pytasz o nie SQL-em tak jak o dane biznesowe.'
      ]
    },
    {
      title: 'Bundles a Terraform i uwierzytelnianie w CI',
      html: [
        'Podział, który dobrze brzmi na rozmowie: Terraform do infrastruktury (workspace\'y, sieć, magazyny, konfiguracja Unity Catalog), bundles do zasobów projektu (joby, pipeline\'y). To ocena praktyczna, a nie reguła z dokumentacji.',
        'Do uwierzytelniania w CI dokumentacja zaleca workload identity federation: pipeline CI dostaje krótkotrwałą tożsamość i nie przechowuje sekretów Databricks.',
        'Zmiana nazwy na Declarative Automation Bundles (marzec 2026) nie zmieniła polecenia CLI ani formatu konfiguracji.'
      ]
    }
  ] as More[]
};

/* ------------------------------------------------------------------ */
/* Etap 4: Ekosystem                                                   */
/* ------------------------------------------------------------------ */

export interface MsItem { id: string; name: string; what: string; role: string; catch: string }
/** Ekosystem Microsoft: siedem pojęć, każde w trzech zdaniach. Według Microsoft Learn. */
export const microsoft = {
  title: 'Microsoft: siedem nazw, które padną na rozmowie',
  intro: [
    'Wiele projektów na Databricks działa w Azure, a obok coraz częściej stoi Microsoft Fabric. Nie musisz tych usług obsługiwać, ale musisz wiedzieć, która co robi i jak się mają do siebie. Kliknij każdą.'
  ],
  assumptions: 'Orientacja architektoniczna według Microsoft Learn (stan na listopad 2026), nie instrukcja obsługi.',
  chain: ['Źródła', 'Data Factory', 'ADLS / OneLake', 'Databricks albo Fabric', 'Semantic model', 'Raport Power BI'],
  items: [
    {
      id: 'adls', name: 'ADLS Gen2',
      what: 'Azure Data Lake Storage. Według dokumentacji to nie osobna usługa, tylko zestaw możliwości zbudowanych na Azure Blob Storage, przeznaczonych do analityki.',
      role: 'Magazyn, w którym leżą pliki tabel Delta. Kluczowa cecha to hierarchiczna przestrzeń nazw: prawdziwe katalogi, a zmiana nazwy lub usunięcie katalogu to jedna atomowa operacja na metadanych.',
      catch: 'To tylko storage: nie ma silnika zapytań ani transakcji na poziomie tabeli. Te dokłada Delta Lake i silnik, który ją czyta.'
    },
    {
      id: 'adf', name: 'Azure Data Factory',
      what: 'Chmurowa usługa integracji danych, która orkiestruje i automatyzuje przenoszenie i transformację danych.',
      role: 'Pipeline z aktywnościami: skopiuj dane ze źródła, a potem uruchom przetwarzanie gdzie indziej. Ma aktywności dla Azure Databricks, które uruchamiają notebook albo job.',
      catch: 'ADF zwykle nie liczy sam: zleca pracę innym usługom. W projektach spotkasz spór „ADF czy Lakeflow Jobs jako orkiestrator”. Microsoft opisuje Data Factory w Fabric jako następną generację ADF.'
    },
    {
      id: 'azdb', name: 'Azure Databricks',
      what: 'Ta sama platforma, o której jest ta lekcja, dostępna jako usługa w Azure.',
      role: 'Przetwarzanie, SQL warehouses, Unity Catalog. W wariancie klasycznym compute działa w Twojej subskrypcji Azure, a magazyn workspace też w niej leży.',
      catch: 'Nazwy z etapu Platforma są identyczne. Różnice dotyczą integracji z Azure: tożsamości, sieci, rozliczeń. W portalu Azure klasyczny workspace nazywa się workspace hybrydowym.'
    },
    {
      id: 'fabric', name: 'Microsoft Fabric',
      what: 'Platforma analityczna dostarczana jako SaaS, obsługująca cały przepływ danych: od pobrania po raport.',
      role: 'Jeden produkt z wieloma obciążeniami: Data Factory, Data Engineering (Spark), Data Warehouse, Real-Time Intelligence, Data Science, Power BI. Wszystkie pracują na wspólnym magazynie.',
      catch: 'Rozliczenie przez wspólną pojemność (capacity, jednostki F), a nie osobno za każdy silnik. Mniej do konfigurowania niż w Databricks, ale i mniej kontroli nad compute.'
    },
    {
      id: 'onelake', name: 'OneLake',
      what: 'Jeden data lake dla całej organizacji. Każdy tenant Fabric ma dokładnie jeden, tworzony automatycznie. Zbudowany na ADLS Gen2.',
      role: 'Wspólny magazyn wszystkich obciążeń Fabric. Tabele są zapisane w formacie Delta Parquet albo Iceberg. Skróty (shortcuts) to odwołania do danych leżących gdzie indziej, np. w ADLS albo S3, bez kopiowania.',
      catch: 'To, że Fabric i Databricks zapisują tabele w formacie Delta, jest punktem styku obu platform: dane z Unity Catalog można udostępnić w Fabric bez przenoszenia (mirrored catalog oparty na skrótach).'
    },
    {
      id: 'lhwh', name: 'Fabric Lakehouse i Warehouse',
      what: 'Dwa sposoby pracy na tych samych danych. Oba przechowują dane w formacie Delta w OneLake.',
      role: 'Lakehouse: piszesz Sparkiem, dane strukturalne i niestrukturalne, a do odczytu dostajesz SQL analytics endpoint tylko do odczytu. Warehouse: pełny T-SQL z zapisem i transakcjami ACID na wielu tabelach.',
      catch: 'Wybór zależy od tego, kto pisze i czym: inżynierowie w Sparku wybierają Lakehouse, zespół SQL wybiera Warehouse. To nie są dwie kopie danych w różnych formatach.'
    },
    {
      id: 'semantic', name: 'Power BI semantic model',
      what: 'Źródło danych gotowe do raportowania i wizualizacji: tabele, relacje i miary, na których stoją raporty.',
      role: 'Warstwa między tabelami gold a raportem. Tryby: Import (kopia w pamięci), DirectQuery (zapytania do źródła na żywo) oraz Direct Lake, który ładuje dane do pamięci prosto z tabel Delta w OneLake.',
      catch: 'Odpowiednika w Databricks ani Snowflake nie szukaj w tabelach: to model nad nimi. Direct Lake wymaga pojemności Fabric.'
    }
  ] as MsItem[],
  defaultItem: 'adls',
  labels: { what: 'Co to jest', role: 'Rola w architekturze', catch: 'Co warto dopowiedzieć' },
  takeaway: '<b>Wniosek.</b> ADLS to magazyn, Data Factory przenosi i zleca, Databricks i Fabric przetwarzają, semantic model podaje dane raportom. Wspólnym językiem obu platform jest tabela Delta w object storage, i to jest powód, dla którego Databricks i Fabric częściej się uzupełniają, niż wykluczają.'
};

export interface CompareDim { id: string; label: string; snowflake: string; databricks: string; fabric: string }
/** Porównanie trzech platform. Wiersz „Mocna strona" to ocena inżynierska, nie cytat. */
export const compare = {
  title: 'Snowflake, Databricks, Fabric: te same klocki, inaczej podzielone',
  intro: [
    'Wszystkie trzy platformy rozdzielają storage od compute i wszystkie obsługują dziś otwarte formaty tabel, każda w innym zakresie. Różnią się tym, ile oddajesz usłudze i co jest dla nich punktem wyjścia. Wybierz wymiar.'
  ],
  assumptions: 'Zestawienie według dokumentacji trzech dostawców (listopad 2026). Wiersz „Mocna strona” to ocena inżynierska autora, nie cytat. Platformy szybko się do siebie zbliżają.',
  platforms: ['Snowflake', 'Databricks', 'Fabric'],
  dims: [
    {
      id: 'storage', label: 'Dane i format',
      snowflake: 'Domyślnie magazyn zarządzany przez Snowflake, dane w mikropartycjach, których nie widzisz. Alternatywa: tabele Apache Iceberg w Twoim magazynie.',
      databricks: 'Pliki w object storage w otwartym formacie: Delta Lake jako domyślny, Iceberg jako opcja. Inne silniki mogą je czytać, jeśli obsługują funkcje użyte w tabeli i mają do niej dostęp.',
      fabric: 'OneLake: jeden magazyn na tenant, tabele w Delta Parquet albo Iceberg. Skróty do danych poza OneLake.'
    },
    {
      id: 'compute', label: 'Compute',
      snowflake: 'Virtual warehouses: niezależne klastry do SQL, rozmiar wybierasz Ty, resztą zarządza usługa.',
      databricks: 'Kilka rodzajów do różnych obciążeń: SQL warehouses, compute jobów i notebooków, pipelines. Serverless albo na Twoim koncie chmurowym.',
      fabric: 'Wspólna pojemność (capacity) dzielona między silniki: Spark, Warehouse z T-SQL, Power BI.'
    },
    {
      id: 'tx', label: 'Transakcje',
      snowflake: 'Transakcje na wielu instrukcjach (BEGIN, COMMIT, ROLLBACK). Jedyny poziom izolacji dla tabel to READ COMMITTED.',
      databricks: 'Każdy commit Delta jest atomowy dla jednej tabeli, odczyt ma snapshot isolation. Transakcje na wielu instrukcjach i tabelach istnieją, ale wymagają tabel managed z catalog commits.',
      fabric: 'Warehouse: pełne transakcje ACID na wielu tabelach. Lakehouse: bez transakcji na wielu tabelach.'
    },
    {
      id: 'ops', label: 'Utrzymanie tabel',
      snowflake: 'Po stronie usługi: mikropartycji nie definiujesz ani nie utrzymujesz. Time Travel ustawiasz jedną liczbą.',
      databricks: 'OPTIMIZE i VACUUM uruchamiasz sam albo robi to predictive optimization na tabelach managed. Retencję plików i logu ustawiasz osobno.',
      fabric: 'Warehouse jest zarządzany przez usługę. Tabele Lakehouse to tabele Delta, więc dotyczą ich te same pojęcia co w tej lekcji (szczegółów utrzymania w Fabric tu nie sprawdzałem).'
    },
    {
      id: 'strength', label: 'Mocna strona (ocena)',
      snowflake: 'Hurtownia SQL z minimalną obsługą. Dobra, gdy zespół pracuje głównie w SQL i dbt, a dane są strukturalne.',
      databricks: 'Inżynieria danych w kodzie, streaming i ML na tych samych danych, pełna kontrola nad formatem i compute.',
      fabric: 'Jeden SaaS od pobrania danych do raportu, ścisła integracja z Power BI i ekosystemem Microsoft.'
    }
  ] as CompareDim[],
  defaultDim: 'storage',
  takeaway: '<b>Wniosek.</b> Pytanie „która platforma jest lepsza” nie ma odpowiedzi. Dobra odpowiedź zaczyna się od obciążenia, zespołu i tego, co firma już ma. Czasem odpowiedzią są dwie platformy na wspólnym otwartym formacie tabel. To jednak dodatkowy koszt, który musi uzasadnić potrzeba biznesowa, a nie wybór domyślny.',
  more: [
    {
      title: 'Otwarte formaty: dlaczego wybór nie musi być ostateczny',
      html: [
        'Snowflake dokumentuje tabele Apache Iceberg z plikami w Twoim magazynie oraz odczyt tabel zapisanych przez silniki Delta Lake (tabele Iceberg tworzone z plików Delta).',
        'Databricks dokumentuje odczyt tabel Delta przez klientów Iceberg: funkcja UniForm dopisuje metadane Iceberg do tabeli Delta. Dostęp klientów Iceberg jest tylko do odczytu. Tabele managed mogą być też w formacie Iceberg.',
        'OneLake przechowuje tabele w Delta albo Iceberg i potrafi wystawić dane z Unity Catalog przez skróty, bez kopiowania.',
        'Sam format niczego nie gwarantuje. Żeby drugi silnik przeczytał tabelę, musi obsługiwać funkcje, których ona używa (np. deletion vectors albo column mapping) i jej wersję protokołu, katalog musi tę tabelę wystawić, a tożsamość musi mieć uprawnienia.',
        'Praktyczny wniosek: dane można trzymać raz, a silnik dobierać do obciążenia. Koszt to złożoność: dwa katalogi, dwa modele uprawnień i ograniczenia zgodności, które trzeba sprawdzić dla konkretnych wersji.'
      ]
    }
  ] as More[]
};

export interface Scenario { setup: string; options: string[]; correct: number; why: string; scope: string }
/** Scenariusze wyboru architektury. Odpowiedzi to ocena inżynierska: uzasadnienie liczy się bardziej niż nazwa. */
export const choose = {
  title: 'Którą platformę byś zaproponował?',
  intro: 'Cztery wymyślone sytuacje. Na rozmowie nie ma tu jednej poprawnej odpowiedzi: liczy się to, czy uzasadnienie wynika z wymagań. Wybierz, zanim przeczytasz uzasadnienie.',
  ask: 'Twoja rekomendacja:',
  cases: [
    {
      setup: 'Firma ma pięciu analityków i dwóch inżynierów. Dane są strukturalne, przychodzą z systemów transakcyjnych raz na dobę. Cała logika jest w SQL i dbt. Nie ma planów na ML ani streaming.',
      options: ['Snowflake', 'Databricks z klastrami klasycznymi i PySparkiem', 'Własny Spark na Kubernetes'],
      correct: 0,
      why: 'Obciążenie to klasyczna hurtownia: SQL, dane strukturalne, mały zespół. Platforma, która zdejmuje z zespołu utrzymanie plików i compute, daje tu najwięcej. Przepisywanie działającego SQL na PySparka niczego by nie poprawiło.',
      scope: 'Databricks SQL z serverless SQL warehouse i dbt też obsłuży ten przypadek. Rozstrzygają koszty, istniejące umowy i umiejętności zespołu, a nie lista funkcji.'
    },
    {
      setup: 'Platforma zbiera zdarzenia z aplikacji w czasie zbliżonym do rzeczywistego, zespół data science trenuje modele w Pythonie na surowych danych, a część danych to pliki JSON i obrazy. Firma chce, żeby dane leżały w otwartym formacie na jej koncie chmurowym.',
      options: ['Snowflake', 'Databricks', 'Sam Power BI z trybem Import'],
      correct: 1,
      why: 'Streaming, kod w Pythonie, dane niestrukturalne i wymóg otwartego formatu na własnym koncie to dokładnie to, pod co zbudowany jest lakehouse: jeden katalog i jedne dane dla inżynierii, SQL i ML.',
      scope: 'Ceną jest więcej decyzji po stronie zespołu: rodzaje compute, układ tabel, retencja. Bez inżynierów, którzy to udźwigną, przewaga zamienia się w koszt.'
    },
    {
      setup: 'Średnia firma pracuje w Microsoft 365, raportuje w Power BI i ma jednego inżyniera danych. Chce jednego rozwiązania od pobrania danych do raportu, bez składania go z kilku usług.',
      options: ['Databricks i osobno Power BI', 'Microsoft Fabric', 'Snowflake i osobno Azure Data Factory'],
      correct: 1,
      why: 'Wymaganiem jest prostota i integracja z tym, co firma już ma. Fabric dostarcza pobieranie, przetwarzanie, hurtownię i Power BI jako jeden SaaS na wspólnym magazynie, a Direct Lake czyta tabele Delta bez osobnego kopiowania do modelu.',
      scope: 'Gdy pojawią się ciężkie obciążenia inżynierskie albo ML, można rozważyć dołożenie Databricks. Tabele Delta w OneLake to ułatwiają, ale zgodność funkcji tabel i uprawnienia trzeba sprawdzić dla konkretnego przypadku.'
    },
    {
      setup: 'Firma od lat używa Snowflake do raportowania i jest z niego zadowolona. Nowy zespół chce trenować modele i przetwarzać duże logi w Sparku. Zarząd pyta, czy trzeba wszystko migrować na jedną platformę.',
      options: ['Tak, wszystko na Databricks', 'Tak, wszystko zostaje w Snowflake, bez Sparka', 'Nie migrować: najpierw sprawdzić opcje ML w Snowflake, a drugi silnik dołożyć tylko przy realnej potrzebie'],
      correct: 2,
      why: 'Migracja działającej hurtowni to duży koszt bez korzyści dla raportowania. Druga platforma też kosztuje, więc nie jest odpowiedzią domyślną. Najpierw pytam, czego dokładnie potrzebuje nowy zespół i czy obsłuży to obecna platforma: Snowflake ma własne narzędzia do Pythona i ML (Snowpark, Snowflake ML). Jeśli potrzeba biznesowa uzasadnia Sparka, drugi silnik i dane współdzielone w otwartym formacie tabel są rozsądniejsze niż migracja.',
      scope: 'Dwie platformy to dwa modele uprawnień i dwa rachunki. Trzeba ustalić, który katalog jest właścicielem której tabeli. Odczyt tej samej tabeli z dwóch silników nie wynika z samego formatu: zależy od funkcji tabeli i wersji protokołu, od integracji katalogów i od uprawnień.'
    }
  ] as Scenario[],
  takeaway: '<b>Wniosek.</b> Schemat odpowiedzi na pytanie o wybór platformy: jakie obciążenia (SQL, kod, streaming, ML), kto będzie tym pracował, co już jest w firmie, ile kontroli jest potrzebne, a ile obsługi zespół udźwignie. Nazwa platformy pada na końcu.'
};

export interface Myth { myth: string; fact: string }
/** Typowe błędne przekonania. Każde ma krótką korektę do powiedzenia na głos. */
export const myths = {
  title: 'Dziewięć zdań, na których łatwo się potknąć',
  intro: 'Każde z nich brzmi rozsądnie i każde jest błędne albo za proste. Najpierw powiedz, co jest nie tak, potem rozwiń.',
  items: [
    { myth: '„Delta to format pliku.”', fact: 'Formatem pliku jest Parquet. Delta to protokół nad plikami: log transakcyjny, który mówi, które pliki tworzą tabelę w danej wersji.' },
    { myth: '„UPDATE zmienia wiersz w pliku.”', fact: 'Pliki Parquet są niezmienne. UPDATE zapisuje nowe pliki i oznacza stare jako usunięte albo, z deletion vectors, zapisuje znacznik obok pliku.' },
    { myth: '„OPTIMIZE zwalnia miejsce.”', fact: 'OPTIMIZE dopisuje nowe, większe pliki, a stare zostawia. Miejsce zwalnia dopiero VACUUM, po okresie retencji.' },
    { myth: '„Time travel to nasz backup.”', fact: 'Starsze wersje istnieją tylko do VACUUM i do wygaśnięcia logu. Dokumentacja Databricks odradza traktowanie historii tabeli jako długoterminowej kopii zapasowej.' },
    { myth: '„Dwa joby nie mogą pisać do jednej tabeli naraz.”', fact: 'Mogą. Dopisania, które nie czytają tabeli (blind append), nie wchodzą ze sobą w konflikt. Konflikt powstaje, gdy operacje oparły się na tych samych plikach albo, z row-level concurrency, na tych samych wierszach, oraz gdy ktoś w trakcie zmienił metadane tabeli.' },
    { myth: '„Databricks to hostowany Spark.”', fact: 'Spark to warstwa wykonania. Platforma dokłada format tabel z transakcjami, zarządzany compute, Unity Catalog, orkiestrację i sposób wdrażania.' },
    { myth: '„Serverless znaczy, że nasze dane leżą u Databricks.”', fact: 'Serverless mówi, gdzie działa compute. Pliki tabel leżą w object storage, w typowej konfiguracji na koncie klienta.' },
    { myth: '„Unity Catalog to nowa nazwa Hive metastore.”', fact: 'Hive metastore to rejestr tabel jednego workspace. Unity Catalog jest wspólny dla workspace\'ów podpiętych do tego samego metastore i obejmuje uprawnienia, lineage, audyt oraz obiekty inne niż tabele.' },
    { myth: '„Lakehouse i Warehouse w Fabric to dwie kopie danych.”', fact: 'Oba przechowują dane w formacie Delta w OneLake. Różnią się silnikiem i sposobem zapisu: Spark kontra T-SQL.' }
  ] as Myth[]
};

/* ------------------------------------------------------------------ */
/* Etap 5: Interview                                                   */
/* ------------------------------------------------------------------ */

/**
 * Pytania, odpowiedzi 30–60 s (PL i EN) oraz follow-upy przychodzą z Interview Banku.
 * Tutaj jest tylko to, czego bank nie ma: jak uczciwie mówić o platformie, gdy doświadczenie jest z hurtowni.
 */
export const interview = {
  honestIntro: 'Jeśli Twoje doświadczenie produkcyjne jest z hurtowni, a Delta Lake i Databricks znasz z nauki, powiedz to i pokaż, że rozumiesz mechanizm. Na przykład tak:',
  honestEn: '“Most of my production work has been on a cloud data warehouse, so let me map it for you. What the warehouse does for me as a service, Delta Lake does with a transaction log next to Parquet files: atomic commits, versions, conflict detection between writers. The practical difference is that the files are mine, so layout and retention are design decisions. I’d default to Unity Catalog managed tables with predictive optimization, and I’d think about clustering keys and VACUUM retention up front rather than after the first slow query.”',
  honestPl: 'Po polsku: większość mojej pracy produkcyjnej to hurtownia w chmurze, więc pokażę, jak to mapuję. To, co hurtownia robi dla mnie jako usługa, Delta Lake robi logiem transakcyjnym obok plików Parquet: atomowe commity, wersje, wykrywanie konfliktów między piszącymi. Praktyczna różnica jest taka, że pliki są moje, więc układ danych i retencja to decyzje projektowe. Domyślnie wybrałbym tabele managed w Unity Catalog z predictive optimization, a o kluczach klastrowania i retencji VACUUM pomyślałbym na początku, a nie po pierwszym wolnym zapytaniu.'
};

/* ------------------------------------------------------------------ */
/* Etap 6: Sprawdź się                                                 */
/* ------------------------------------------------------------------ */

export interface QuizItem { q: string; setup?: string; options: string[]; correct: number; why: string }
export const quiz: QuizItem[] = [
  {
    q: 'Job zapisał do katalogu tabeli Delta trzy nowe pliki Parquet i padł przed zapisaniem commitu. Co zobaczy zapytanie uruchomione chwilę później?',
    options: ['Dokładnie stan z ostatniego commitu', 'Stare dane i trzy nowe pliki', 'Błąd, bo tabela jest uszkodzona'],
    correct: 0,
    why: 'Czytelnik bierze tylko pliki wymienione w logu. Bez commitu nowe pliki nie należą do tabeli, choć fizycznie leżą w katalogu. Uprzątnie je kiedyś VACUUM.'
  },
  {
    q: 'Tabela ma jeden plik z milionem wierszy. Wykonujesz <code>UPDATE</code> jednego wiersza. Co trafi do logu?',
    setup: 'Założenia: tabela bez deletion vectors.',
    options: ['Akcja update ze zmienionym wierszem', 'Akcja remove starego pliku i akcja add nowego pliku z milionem wierszy', 'Nic, plik jest zmieniany w miejscu'],
    correct: 1,
    why: 'Pliki Parquet są niezmienne, a protokół nie ma akcji „zmień wiersz”. Bez deletion vectors zmiana jednego wiersza przepisuje cały plik: nowy plik dostaje add, stary remove. Stary plik zostaje w magazynie do VACUUM.'
  },
  {
    q: 'Dwa joby jednocześnie dopisują nowe wiersze do tej samej tabeli Delta. Czego się spodziewasz?',
    setup: 'Założenia: zwykły INSERT bez podzapytań do tej tabeli, tabela bez kolumn identity, nikt w tym czasie nie zmienia jej schematu.',
    options: ['Drugi job dostanie wyjątek konfliktu', 'Wiersze drugiego joba nadpiszą wiersze pierwszego', 'Oba commity się udadzą, jeden po drugim'],
    correct: 2,
    why: 'Według dokumentacji Databricks dopisania, które nie czytają tabeli, nie wchodzą ze sobą w konflikt. Drugi job zauważy, że numer commitu jest zajęty, sprawdzi, że pierwszy tylko dodał pliki, i zapisze swój commit pod kolejnym numerem. Przy innych założeniach (INSERT czytający tabelę, zmiana metadanych w trakcie, kolumna identity) wynik może być inny.'
  },
  {
    q: 'Paczka dla <code>MERGE</code> zawiera dwa wiersze z tym samym kluczem, oba pasują do jednego wiersza tabeli docelowej i klauzula <code>WHEN MATCHED</code> robi UPDATE. Co się stanie?',
    options: ['Wygra ostatni wiersz paczki', 'MERGE zakończy się błędem', 'Powstaną dwa wiersze w celu'],
    correct: 1,
    why: 'Operacja może się nie udać, gdy kilka wierszy źródła pasuje do tego samego wiersza celu i próbuje go zmienić, bo wynik byłby niejednoznaczny. Dlatego źródło deduplikuje się przed MERGE, zostawiając jeden wiersz na klucz. Wyjątkiem jest bezwarunkowy DELETE, który dopuszcza wiele dopasowań.'
  },
  {
    q: 'Zapis do tabeli zawiera kolumnę, której tabela nie ma. Nie włączono ewolucji schematu. Co zrobi Delta?',
    setup: 'Założenia: zwykły INSERT albo append z DataFrame na Databricks.',
    options: ['Odrzuci cały zapis', 'Zapisze wiersze bez tej kolumny i ostrzeże', 'Doda kolumnę automatycznie'],
    correct: 0,
    why: 'To schema enforcement: każda wstawiana kolumna musi istnieć w tabeli docelowej. Zapis jest odrzucany w całości i nie powstaje commit. Dodanie kolumny wymaga jawnej zgody, np. opcji mergeSchema.'
  },
  {
    q: 'Uruchomiłeś <code>OPTIMIZE</code> na tabeli z tysiącem małych plików. Jak zmieniła się ilość danych w magazynie zaraz po nim?',
    options: ['Zmalała, bo plików jest mniej', 'Wzrosła, bo stare pliki nadal leżą obok nowych', 'Nie zmieniła się'],
    correct: 1,
    why: 'OPTIMIZE zapisuje nowe, większe pliki i oznacza stare jako usunięte w logu. Fizycznie stare pliki zostają, bo potrzebują ich wcześniejsze wersje tabeli. Miejsce zwolni dopiero VACUUM po okresie retencji.'
  },
  {
    q: 'Dziesięć dni temu ktoś błędnie nadpisał dane. Tabela ma ustawienia domyślne, a VACUUM działa codziennie. Czy <code>RESTORE</code> do wersji sprzed pomyłki zadziała?',
    setup: 'Założenia: retencja usuniętych plików 7 dni, retencja logu 30 dni.',
    options: ['Tak, bo log sięga 30 dni wstecz', 'Tak, VACUUM nie rusza plików potrzebnych do RESTORE', 'Nie, bo pliki tamtej wersji zostały już usunięte'],
    correct: 2,
    why: 'Do odczytu starej wersji potrzeba i wpisu w logu, i plików danych. Log jeszcze jest, ale pliki zastąpione dziesięć dni temu przekroczyły próg 7 dni i VACUUM je skasował. Dlatego historia tabeli nie zastępuje kopii zapasowej.'
  },
  {
    q: 'Zespół przechodzi na serverless SQL warehouse. Co się zmienia w tym, gdzie leżą pliki tabel?',
    setup: 'Założenia: klasyczny workspace z tabelami w magazynie na koncie klienta.',
    options: ['Pliki są przenoszone na konto Databricks', 'Nic: zmienia się tylko miejsce, w którym działa compute', 'Tabele trzeba przekonwertować na inny format'],
    correct: 1,
    why: 'Serverless oznacza, że maszyny liczące zapytania działają w serverless compute plane na koncie Databricks. Tabele pozostają plikami w tym samym object storage. Compute i storage są rozdzielone.'
  },
  {
    q: 'Analityk dostał <code>SELECT</code> na tabeli <code>prod.sales.orders</code> i nic więcej. Czy ją przeczyta?',
    options: ['Nie, potrzebuje jeszcze USE CATALOG na prod i USE SCHEMA na prod.sales', 'Tak, SELECT wystarcza', 'Tak, ale tylko przez SQL warehouse'],
    correct: 0,
    why: 'Uprawnienia USE są wymagane, żeby w ogóle pracować z obiektami wewnątrz katalogu i schematu, choć same nie dają dostępu do danych. Do odczytu potrzebny jest komplet: USE CATALOG, USE SCHEMA i SELECT.'
  },
  {
    q: 'Wykonujesz <code>DROP TABLE</code> na tabeli external w Unity Catalog. Co dzieje się z plikami danych?',
    options: ['Są usuwane po 7 dniach', 'Zostają w magazynie: znika tylko wpis w katalogu', 'Są usuwane natychmiast'],
    correct: 1,
    why: 'Dla tabeli external Unity Catalog nie zarządza cyklem życia danych i nie usuwa plików przy DROP. Usuwanie po okresie odzyskiwania, domyślnie 7 dni, dotyczy tabel managed.'
  },
  {
    q: 'W Fabric masz Lakehouse i Warehouse. Zespół chce zapisywać dane instrukcjami T-SQL w transakcji obejmującej kilka tabel. Co wybierasz?',
    options: ['Lakehouse, przez SQL analytics endpoint', 'Obojętnie, oba to obsługują', 'Warehouse'],
    correct: 2,
    why: 'SQL analytics endpoint w Lakehouse jest tylko do odczytu, a Lakehouse nie ma transakcji na wielu tabelach. Warehouse daje pełny T-SQL z zapisem i transakcjami ACID na wielu tabelach. Oba przechowują dane jako Delta w OneLake.'
  },
  {
    q: 'Rekruter pyta: „Po co Delta Lake, skoro Parquet działa?”. Która odpowiedź trafia w sedno?',
    options: ['Parquet opisuje pojedynczy plik, a Delta dokłada log, który z wielu plików robi tabelę z transakcjami i wersjami', 'Delta kompresuje dane lepiej', 'Delta jest szybszym formatem kolumnowym niż Parquet'],
    correct: 0,
    why: 'Dane w tabeli Delta nadal są plikami Parquet. Delta dokłada log transakcyjny: atomowe commity, historię wersji, wykrywanie konfliktów oraz możliwość UPDATE, DELETE i MERGE. Szybkość wynika pośrednio ze statystyk plików i układu danych.'
  }
];

import type { Bridge, ExplainedLine, LessonMeta } from '../../types';
import plansJson from './plans.json';

/**
 * Lekcja: Spark, transformations, actions i lazy evaluation.
 *
 * Fragmenty narracyjne są w HTML (dozwolone znaczniki: lib/richText.ts) i mogą używać
 * <term id="...">, czyli haseł z content/glossary.ts.
 *
 * Skąd są liczby:
 *  - eksperymenty 1–5: labs/lazy_evaluation/lazy_lab.py,
 *  - warunki i wyjątki (pola `more`, `scope`): labs/lazy_evaluation/lazy_conditions_lab.py,
 *  - pomiar pushdownu: labs/lazy_evaluation/pushdown_lab.py.
 * Wszystko to pomiary lokalne (PySpark 4.0.1, local[3]), powtórzone na 4.3.0 z tym samym wynikiem.
 * Pytanie rekrutacyjne, krótka odpowiedź i follow-upy nie są tu powtórzone: lekcja bierze je
 * z Interview Banku (pytanie o tym samym topicId), żeby nie było dwóch rozjeżdżających się wersji.
 */
export const meta: LessonMeta = {
  id: 'spark-lazy-evaluation',
  topicId: 'spark.lazy-evaluation',
  area: 'spark',
  title: 'Transformations, Actions & Lazy Evaluation',
  subtitle: 'Dlaczego Spark odkłada pracę, dopóki nie poprosisz o wynik, i co z tego wynika w praktyce.',
  minutes: 40
};

/** Lab uruchamiany z etapu Praktyka. Identyfikator z labs/registry.json. */
export const labId = 'spark-lazy-evaluation-lab';
/** Wskazówka nad przyciskiem uruchomienia: lab wypisuje odpowiedzi do eksperymentów poniżej. */
export const labHint = 'Najpierw przewidź. Wydruk tego skryptu zawiera odpowiedzi do pięciu eksperymentów poniżej, więc zgadnij je, zanim klikniesz, a potem porównaj.';

export interface Beat { html: string; next: string | null; bridge?: Bridge; /** Zwinięte pogłębienie, poza domyślną ścieżką. */ more?: { title: string; html: string[] } }
export const beats: Beat[] = [
  {
    html: '<h1>Cztery linijki, dwa miliardy wierszy.</h1>\n<p class="lede">W S3 leży tabela zdarzeń: 2 mld wierszy, 80 kolumn. Chcesz policzyć przychód z aktywnych subskrypcji per publisher. Piszesz to tak:</p>\n<pre class="code">events  = spark.read.parquet(<span class="k">"s3://.../events"</span>)\nactive  = events.filter(col(<span class="k">"status"</span>) == <span class="k">"active"</span>)\nslim    = active.select(<span class="k">"publisher_id"</span>, <span class="k">"price"</span>)\nrevenue = slim.groupBy(<span class="k">"publisher_id"</span>).sum(<span class="k">"price"</span>)</pre>\n<p>Pytanie, od którego zaczyna się cały Spark: <b>co ma się stać po każdej z tych linijek?</b></p>',
    next: 'Pomyślałem. Dalej'
  },
  {
    html: '<h2>Gdyby Spark działał jak pandas</h2>\n<p>Każda linijka wykonałaby się od razu. <code>filter</code> przemieliłby 2 mld wierszy i wszystkie 80 kolumn, a wynik zostałby w pamięci. Dopiero potem <code>select</code> wyrzuciłby 78 kolumn, które przed chwilą niepotrzebnie przeczytałeś.</p>\n<p>Nikt nie napisałby tak zapytania w SQL. Ale w Pythonie tak właśnie wygląda wykonanie linijka po linijce.</p>',
    next: 'A jak robi to Snowflake?'
  },
  {
    html: '<h2>Snowflake dostaje całe zapytanie naraz</h2>\n<p>Kiedy wysyłasz SQL, optymalizator widzi wszystko: że potrzebujesz 3 kolumn z 80 i tylko aktywnych wierszy. Czyta więc tyle, ile musi. To luksus języka deklaratywnego. Ty mówisz <b>co</b>, silnik decyduje <b>jak</b>.</p>\n<p>Spark chce dać Ci ten sam luksus w Pythonie. Tyle że Python podaje mu zapytanie po kawałku i Spark nigdy nie wie, czy to już koniec.</p>',
    next: 'Więc co robi?'
  },
  {
    html: '<h2>Zapisuje plan i czeka.</h2>\n<p>Każda z tych czterech linijek tylko dopisuje krok do planu. Żaden wiersz nie jest przetwarzany. Dopiero gdy poprosisz o wynik, np. <code>revenue.show()</code>, Spark ma w ręku całe zapytanie. Upraszcza je tak, jak zrobiłby to Snowflake, i wykonuje.</p>\n<div class="cmp" id="cmp">\n  <div class="cmp-lane"><div class="lab">Linijka po linijce</div><div class="cmp-bars">\n    <div class="bar" style="--w:100%;--d:0s"><i></i><span>filter: wszystkie wiersze, 80 kolumn</span></div>\n    <div class="bar" style="--w:62%;--d:1s"><i></i><span>select: wynik pośredni, 80 kolumn</span></div>\n    <div class="bar" style="--w:9%;--d:2s"><i></i><span>groupBy</span></div>\n  </div></div>\n  <div class="cmp-lane"><div class="lab">Najpierw cały plan</div><div class="cmp-bars">\n    <div class="bar acc" style="--w:9%;--d:3s"><i></i><span>jedno przejście, 3 kolumny z 80</span></div>\n  </div></div>\n</div>\n<p class="small">Ilustracja proporcji, nie pomiar.</p>\n<p>Stąd trzy słowa, które usłyszysz na każdej rozmowie. Operacje, które tylko dopisują krok, to <b>transformacje</b>. Te, które żądają wyniku, to <b>akcje</b>. A cała strategia czekania nazywa się <b>lazy evaluation</b>.</p>\n<p>Jedno zastrzeżenie, żeby „nic nie czyta" nie stało się mitem. Spark musi wiedzieć, czy kolumna <code>status</code> w ogóle istnieje, więc potrzebuje <b>schematu</b>: listy kolumn i ich typów. Czytając plik <term id="parquet">Parquet</term> ze ścieżki, zagląda po niego do opisu na końcu pliku już w pierwszej linijce. To odczyt opisu danych, nie wierszy.</p>',
    more: {
      title: 'Skąd „3 kolumny z 80"?',
      html: ['Dane leżą w plikach <b>Parquet</b>. To format kolumnowy: wartości każdej kolumny są zapisane osobno, więc da się przeczytać trzy kolumny i nie ruszyć pozostałych. Snowflake przechowuje dane na tej samej zasadzie.']
    },
    next: 'Gdzie ja to już widziałem?'
  },
  {
    html: '<h2>W dbt, codziennie</h2>\n<p>Model dbt to SELECT, który sam niczego nie liczy. CTE też nie. Pracę uruchamia dopiero <code>dbt run</code> albo zapytanie do widoku. DataFrame w Sparku to taki łańcuch CTE, tylko budowany w Pythonie.</p>\n<p>Co się z tej analogii przenosi, a gdzie się kończy, masz w ramce. Skutki zobaczysz za chwilę w symulatorze.</p>',
    bridge: {
      from: 'dbt i Snowflake',
      known: 'Model zmaterializowany jako <code>view</code>: definicja, którą silnik wykonuje dopiero przy zapytaniu.',
      fresh: 'DataFrame: plan, który Spark wykonuje dopiero przy akcji. Kolejna akcja domyślnie nie dostaje wyniku poprzedniej.',
      breaks: 'Widok żyje w bazie i każdy może go odpytać. DataFrame istnieje tylko w Twojej sesji. <code>cache()</code> nie jest też odpowiednikiem <code>materialized=\'table\'</code>: to tymczasowa kopia na czas sesji, którą Spark może usunąć z pamięci, a wtedy po cichu liczy brakującą część od nowa. Trwały odpowiednik tabeli to zapis, np. <code>saveAsTable</code>. I w drugą stronę: Snowflake ma result cache, który potrafi oddać wynik identycznego zapytania bez liczenia. W samym Apache Spark takiego mechanizmu nie ma.'
    },
    next: 'Zobacz to na żywo'
  }
];

/** Etap Mechanizm: pytanie nad symulatorem i krótki wniosek pod nim. Szczegóły są w simNotes. */
export const mechanism = {
  question: 'Co dzieje się z wierszami, kiedy dopisujesz operacje?',
  takeaway: '<b>Wniosek.</b> Transformacja tylko wydłuża plan. Wiersze płyną dopiero przy akcji, po uproszczeniu całego planu. Bez <code>cache()</code> kolejna akcja może policzyć część albo całość planu od nowa.'
};

/** Co w etapie Mechanizm jest symulacją, a co pochodzi z uruchomienia Sparka. */
export const simNotes: string[] = [
  'Ruch danych to animacja w JavaScripcie na 9 wierszach. Nie działa tu żaden Spark.',
  'Plan po optymalizacji, lista czytanych kolumn i przekazanie filtra do skanu pochodzą z prawdziwego <code>explain()</code> dla każdej kombinacji operacji i akcji (PySpark 4.0.1, źródło Parquet).',
  'Symulator zaczyna od DataFrame, który już istnieje. Schemat, czyli nazwy i typy kolumn, Spark poznał wcześniej z opisu pliku. Kropki pod źródłem liczą odczyty wierszy, nie odczyty opisu.',
  'Powtórne liczenie przy kolejnym <code>show()</code> albo <code>count()</code> i jego brak po <code>cache()</code> są zmierzone licznikiem w labie (etap Praktyka). To zachowanie tych dwóch akcji w tym układzie. Wyjątek, czyli ponowne użycie wyników <term id="shuffle">shuffle\'u</term>, też jest w Praktyce.',
  'Uproszczenia: nie ma <term id="partition">partycji</term>, <term id="job">jobów</term> ani <term id="stage">stage\'y</term>, cache wypełnia się od razu w całości, a <code>show()</code> pokazuje wszystko, choć naprawdę wyświetla do 20 wierszy.'
];

/**
 * Zbliżenie na predicate pushdown. Domyślna ścieżka: pytanie, cztery row groups, licznik, krótki wniosek.
 * Cztery row groups to ilustracja koncepcyjna (wartości wymyślone, żeby mechanizm było widać na pierwszy
 * rzut oka). Pomiar z labu, interpretacja planu i most do Snowflake są w `details`, zwinięte i niezależne.
 */
export interface RowGroup { min: number; max: number }
export const pushdown = {
  title: 'Czy musimy przeczytać cały plik?',
  intro: [
    'Symulator pokazał napis „filtr przekazany do czytnika". Co czytnik może z nim zrobić? Plik <term id="parquet">Parquet</term> jest podzielony na <b>row groups</b>, czyli grupy wierszy zapisane jedna za drugą. Dla każdej grupy może przechowywać najmniejszą i największą wartość kolumny. Zmień filtr albo ułożenie danych i patrz na licznik.'
  ],
  /** Założenia uproszczonego modelu. Zawsze widoczne obok etykiety symulacji. */
  assumptions: 'Model uproszczony: cztery grupy z wymyślonymi wartościami, plik ma statystyki min i max dla <code>amount</code>, a filtr jest takim, który czytnik potrafi z nimi porównać.',
  /** Dane ułożone po amount: zakresy grup prawie się nie nakładają. */
  sorted: [{ min: 10, max: 400 }, { min: 410, max: 850 }, { min: 900, max: 1800 }, { min: 1900, max: 5000 }] as RowGroup[],
  /** Te same wartości rozsiane po całym pliku: każda grupa ma pełny zakres. */
  scattered: [{ min: 10, max: 5000 }, { min: 15, max: 4990 }, { min: 12, max: 4960 }, { min: 20, max: 4985 }] as RowGroup[],
  filters: [300, 1000, 2000],
  defaultFilter: 1000,
  nothingToSkip: 'Warunek został przekazany, ale nie ma czego pominąć: każda grupa może zawierać pasujący wiersz.',
  takeaway: [
    'Przekazanie warunku do źródła nazywa się <b>predicate pushdown</b>. Jeśli największa wartość w grupie nie przekracza progu, żaden jej wiersz nie spełni warunku, więc czytnik może ją pominąć bez zaglądania do środka.',
    'Grupa „do rozważenia" jest czytana w całości i nadal może zawierać wiersze, które warunku nie spełniają. Te Spark odrzuca potem sam, w węźle Filter. Dlatego przekazanie filtra to jeszcze nie oszczędność: ile grup odpadnie, zależy od statystyk i ułożenia danych.'
  ],
  measuredTitle: 'Pomiar: to samo na prawdziwym pliku',
  measured: [
    'Lab <code>labs/lazy_evaluation/pushdown_lab.py</code>: 400 000 wierszy w 31 row groups, filtr <code>amount &gt; 4500</code>, wynik 39 920 wierszy.',
    'Dane posortowane po <code>amount</code>: skan oddał Sparkowi 46 138 wierszy, dokładnie tyle, ile mają 4 grupy, których max przekracza 4500. Dane nieposortowane: 400 000, bo każda grupa miała zakres 0..4999.'
  ],
  planTitle: 'W planie: czego dowodzi linia PushedFilters',
  plan: [
    'W planie fizycznym przekazany warunek widać w linii <code>PushedFilters</code>. W labie <code>pushdown_lab.py</code> była identyczna dla danych posortowanych i nieposortowanych, choć skan oddał odpowiednio 46 138 i 400 000 wierszy.',
    'Była taka sama nawet po wyłączeniu pushdownu w konfiguracji (<code>spark.sql.parquet.filterPushdown=false</code>), kiedy skan oddał wszystkie 400 000 wierszy. Wniosek: <code>PushedFilters</code> mówi, co Spark przekazał źródłu. Nie mówi, ile dzięki temu pominięto.',
    'Cały plan, linia po linii, przeczytasz w eksperymencie 2 w etapie Praktyka.'
  ],
  bridgeTitle: 'Analogia: pruning mikropartycji w Snowflake',
  bridge: {
    from: 'Snowflake',
    known: 'Pruning mikropartycji: Snowflake trzyma dla każdej mikropartycji zakres wartości kolumn i pomija te, które nie mogą pasować do filtra.',
    fresh: 'To samo robi czytnik Parquet z row groups, na podstawie min i max zapisanych w pliku.',
    breaks: 'W Snowflake te metadane prowadzi usługa, zawsze i dla każdej tabeli. W Parquet statystyki są opcjonalne i siedzą w każdym pliku osobno, więc żeby z nich skorzystać, trzeba najpierw otworzyć opis pliku. W obu systemach skuteczność zależy od ułożenia danych: gdy wartości są rozsiane po wszystkich kawałkach, nie ma czego pomijać.'
  } as Bridge
};

export interface Explainer { title: string; order: 'top-down' | 'bottom-up'; lines: ExplainedLine[] }
export interface Experiment {
  ask: string;
  /** Założenia: co dokładnie uruchamiamy i w jakiej konfiguracji. Pokazywane przed pytaniem. */
  setup: string;
  choices: string[];
  correct: number;
  mono: boolean;
  /** Surowy wydruk z labu. */
  output?: string;
  /** Wydruk do czytania linia po linii (zamiast albo obok `output`). */
  explainers?: Explainer[];
  notes: string[];
  /** Jak daleko wolno uogólniać ten wynik. */
  scope: string;
  /** Rozwinięcie dla chętnych: warunki i wyjątki zmierzone w lazy_conditions_lab.py. */
  more?: { title: string; html: string[] };
  bridge?: Bridge;
}

const ENV = 'PySpark 4.0.1, <term id="local-mode">local[3]</term>, ustawienia domyślne';

export const experiments: Experiment[] = [
  {
    ask: 'Zdefiniowanie <code>filter</code> i <code>groupBy</code> kontra jedno <code>show()</code>. Co potrwa dłużej?',
    setup: `Jeden plik Parquet z 9 wierszami z tabeli powyżej. ${ENV}.`,
    choices: ['Podobnie', 'show() wyraźnie dłużej', 'Definicja dłużej'],
    correct: 1,
    mono: false,
    output: '1. read.parquet uruchomił jobów: 1\n   definicja: 0.24 s   show(): 1.32 s   joby w show(): 2\n   joby w count(): 3',
    notes: [
      'Definicja to tylko zbudowanie i sprawdzenie planu. Praca dzieje się w <code>show()</code>. Na 9 wierszach różnica jest kilkukrotna, na dużych danych urośnie, bo czas definicji nie zależy od liczby wierszy.',
      'W wydruku pojawia się słowo <b>job</b>. To porcja pracy, którą Spark faktycznie wysyła do wykonania. Każdy job widać potem w <term id="spark-ui">Spark UI</term>, więc licząc joby, liczymy momenty, w których Spark naprawdę coś robił.',
      'Pierwsza linijka wydruku: samo <code>read.parquet</code> uruchomiło jeden job. Spark zajrzał do opisu na końcu pliku po <term id="schema">schemat</term>. Wierszy nie czytał.'
    ],
    scope: 'Czasy zależą od maszyny. Job przy odczycie to zachowanie tego konkretnego wywołania: czytanie Parquet ze ścieżki bez podanego schematu.',
    more: {
      title: 'Kiedy samo zdefiniowanie DataFrame uruchamia joba',
      html: [
        'Zmierzone w <code>lazy_conditions_lab.py</code>: <code>read.parquet(ścieżka)</code> uruchomił 1 job. Ten sam odczyt z podanym schematem (<code>read.schema(...)</code>) uruchomił 0. Odczyt tabeli z katalogu (<code>spark.table</code>) też 0, bo schemat jest zapisany w katalogu.',
        'Z dodatku do <code>lazy_lab.py</code>: CSV z nagłówkiem to 1 job, a z <code>inferSchema</code> 2, bo żeby zgadnąć typy, Spark musi przeczytać dane. Stąd praktyka podawania schematu jawnie.',
        'Są też transformacje, które liczą od razu. <code>groupBy(...).pivot("status")</code> bez listy wartości uruchomił 4 joby już przy definicji, bo Spark musi wiedzieć, jakie kolumny powstaną. Z podaną listą wartości: 0.'
      ]
    }
  },
  {
    ask: 'Plik ma 4 kolumny. O ile z nich Spark poprosi plik dla <code>filter(status) → groupBy(publisher_id) → sum(price)</code>?',
    setup: `Ten sam plik. W kodzie nie ma żadnego <code>select</code>. Patrzymy na plan, który Spark ułożył sam. ${ENV}.`,
    choices: ['4', '3', '2'],
    correct: 1,
    mono: true,
    explainers: [
      {
        title: 'Plan logiczny po optymalizacji',
        order: 'bottom-up',
        lines: [
          { code: 'Aggregate [publisher_id#5], [publisher_id#5, count(1) AS subs#9L, sum(price#7) AS mrr#10]', label: 'GROUP BY publisher_id',
            text: 'Pierwszy nawias to klucze grupowania, drugi to kolumny wyniku: klucz, liczba wierszy i suma. <code>count(*)</code> zostało zapisane jako <code>count(1)</code>, co znaczy to samo. Litera <code>L</code> w <code>#9L</code> oznacza typ long.' },
          { code: '+- Project [publisher_id#5, price#7]', label: 'SELECT publisher_id, price',
            text: 'Tej linii nie ma w Twoim kodzie. Po filtrze kolumna <code>status</code> nie jest już do niczego potrzebna, więc optymalizator dopisał wybór dwóch kolumn, żeby dalej nie nieść zbędnej. Wycinanie niepotrzebnych kolumn nazywa się <b>column pruning</b>.' },
          { code: '   +- Filter (isnotnull(status#6) AND (status#6 = active))', label: "WHERE status = 'active'",
            text: 'Twój warunek oraz <code>isnotnull</code>, którego nie pisałeś. Optymalizator dodał go sam: NULL nigdy nie jest równy <code>active</code>, więc takie wiersze można odrzucić od razu.' },
          { code: '      +- Relation [subscription_id#4,publisher_id#5,status#6,price#7] parquet', label: 'FROM subs',
            text: 'Zacznij tutaj. Źródło to plik Parquet i wszystkie cztery kolumny, które w nim są. Plan logiczny mówi tylko, skąd pochodzą dane. Które kolumny zostaną przeczytane, pokazuje skan poniżej. Dopiski <code>#4</code>, <code>#5</code> to wewnętrzne identyfikatory kolumn. Spark nadaje je, żeby odróżnić kolumny o tej samej nazwie, np. po joinie. Numery zmieniają się między uruchomieniami i nie niosą znaczenia.' }
        ]
      },
      {
        title: 'Skan pliku w planie fizycznym',
        order: 'top-down',
        lines: [
          { code: 'FileScan parquet [publisher_id#5,status#6,price#7]', label: 'odczyt pliku',
            text: 'Plan logiczny mówi, co policzyć. Plan fizyczny mówi, jakimi operacjami. To jego pierwszy węzeł: odczyt pliku. W nawiasie są kolumny, które skan odda dalej. Są trzy, bo <code>status</code> jest jeszcze potrzebny do filtra.' },
          { code: 'PushedFilters: [IsNotNull(status), EqualTo(status,active)]', label: 'warunki przekazane czytnikowi',
            text: 'Warunki, które Spark przekazał czytnikowi Parquet. To <b>predicate pushdown</b>. Uwaga na interpretację: ta linia mówi „przekazano", a nie „zaoszczędzono". Czy czytnik cokolwiek pominie, zależy od statystyk w pliku i ułożenia danych (zbliżenie w etapie Mechanizm). Spark i tak sprawdza warunek jeszcze raz w węźle Filter.' },
          { code: 'ReadSchema: struct<publisher_id:string,status:string,price:double>', label: 'kolumny czytane z pliku',
            text: 'Kolumny, o które Spark poprosił plik: trzy z czterech. <code>subscription_id</code> nie jest czytany, choć nigdzie nie napisałeś <code>select</code>. To najprostszy sposób, żeby sprawdzić, czy wycinanie kolumn zadziałało.' }
        ]
      }
    ],
    notes: [
      'Trzy. Kliknij linie planu, żeby zobaczyć, skąd to wiadomo. Plan czyta się od dołu: źródło jest na samym końcu, a wynik na górze.'
    ],
    scope: 'Plan pochodzi z tego uruchomienia. Wycinanie kolumn działa tu, bo Parquet jest formatem kolumnowym. Dla CSV Spark i tak musi przeczytać całe linie.',
    bridge: {
      from: 'Snowflake',
      known: 'Query Profile: po wykonaniu zapytania widzisz operatory (TableScan, Filter, Aggregate) i ile mikropartycji przeskanowano.',
      fresh: '<code>df.explain()</code> pokazuje plan jeszcze przed wykonaniem. Po wykonaniu ten sam plan z liczbami wierszy jest w zakładce SQL w Spark UI.',
      breaks: 'W Snowflake nie sterujesz fizycznym wykonaniem. W Sparku część decyzji jest Twoja: liczba partycji, sposób łączenia tabel, cache. Dlatego czytanie planu jest tu codzienną umiejętnością, a nie ciekawostką.'
    }
  },
  {
    ask: 'Wywołujesz <code>show()</code>, a potem <code>count()</code> na tym samym DataFrame. Ile razy łącznie licznik zobaczy wiersz?',
    setup: `Plik ma 9 wierszy w jednej <term id="partition">partycji</term>. Plan: filter, groupBy, agregacja. Filter przechodzi przez <term id="udf">UDF</term>, czyli własną funkcję Pythona wywoływaną dla każdego wiersza. Tutaj nie robi nic poza zwiększaniem licznika. Bez cache. ${ENV}.`,
    choices: ['9', '18', '27'],
    correct: 1,
    mono: true,
    output: '3. Wiersze, które przeszły przez filter (źródło ma 9)\n   bez cache:  po show() 9, po count() <span class="k">18</span>\n   z cache():  po cache() 0, po show() 9, po count() <span class="k">9</span>, po drugim show() <span class="k">9</span>\n   wyjątek:    collect() dwa razy na tym samym DataFrame: 9, potem 9',
    notes: [
      'Osiemnaście. Spark nie przechował wyniku pierwszej akcji, więc przy drugiej wykonał plan od źródła jeszcze raz. Po <code>cache()</code> licznik staje na 9 i już się nie rusza. Samo wywołanie <code>cache()</code> niczego nie policzyło (licznik 0).',
      'Trzecia linijka to wyjątek, o który lubią pytać. Dwa razy <code>collect()</code> na tym samym obiekcie nie powtórzyło pracy. <code>groupBy</code> wymaga <b>shuffle\'u</b>, czyli przetasowania wierszy tak, żeby te same klucze spotkały się w jednym miejscu, a jego wynik ląduje w plikach na dysku. Przy drugim <code>collect()</code> Spark użył tych plików ponownie i pominął etap, który je wytworzył.',
      'Dlatego dokumentacja mówi ostrożnie, że wynik „may be recomputed" przy każdej akcji. Bezpieczne zdanie na rozmowę: bez cache kolejna akcja może policzyć część albo całość planu od nowa.'
    ],
    scope: 'Licznik w UDF to narzędzie dydaktyczne. Na klastrze ponowione zadania mogą go zawyżyć, a liczba wywołań UDF nie jest przez Sparka gwarantowana.',
    more: {
      title: 'Kiedy dokładnie Spark liczy od nowa, a kiedy nie',
      html: [
        'Zmierzone w <code>lazy_conditions_lab.py</code>, z AQE włączonym i wyłączonym, wynik ten sam. Ponowne użycie zadziałało tylko dla powtórzonego <code>collect()</code> na tym samym obiekcie DataFrame, w planie z shuffle\'em (9, potem 9; w Spark UI jeden stage wykonany, jeden pominięty).',
        'Od nowa liczyły (9, potem 18): <code>show()</code> dwa razy, <code>count()</code> dwa razy, <code>show()</code> i <code>count()</code>, DataFrame pochodny zbudowany na tym samym planie oraz każdy plan bez shuffle\'u. <code>show()</code> i <code>count()</code> budują pod spodem nowe zapytanie, więc nie mają czego użyć ponownie.',
        '<b>cache() wypełnia się kawałkami.</b> Na pliku w 3 partycjach <code>take(1)</code> policzyło i zapamiętało 1 partycję z 3 (licznik 3). Dopiero <code>count()</code> dopełniło resztę (licznik 9, 3 z 3). W cache trafia to, co akcja faktycznie policzyła.',
        '<b>cache() nie jest trwały.</b> Domyślny poziom dla DataFrame to pamięć z przelewaniem na dysk (<code>MEMORY_AND_DISK_DESER</code>). Według dokumentacji Spark sam usuwa najdawniej używane partycje, gdy brakuje miejsca, a utraconą partycję liczy od nowa z planu. Po <code>unpersist()</code> licznik w labie znów urósł o 9.',
        'Cache jest dopasowywany po planie, nie po zmiennej. DataFrame pochodny czytał z cache (licznik bez zmian), a identyczny plan zbudowany od zera w innej zmiennej też w niego trafił.'
      ]
    }
  },
  {
    ask: 'W danych jest wartość <code>"abc"</code>, a Ty robisz <code>cast("int")</code> w linijce z <code>withColumn</code>. Kiedy zobaczysz błąd?',
    setup: `Trzy wiersze, w jednym wartość <code>"abc"</code>. Akcja to <code>show()</code> na DataFrame, który używa nowej kolumny. Klasyczny PySpark (nie Spark Connect). ${ENV}.`,
    choices: ['Od razu, w tej linijce', 'Dopiero w show()'],
    correct: 1,
    mono: false,
    output: '4. Błędy\n   literówka w kolumnie: błąd od razu -> [UNRESOLVED_COLUMN.WITH_SUGGESTION]\n   zły rzut typu: definicja przeszła bez błędu\n   zły rzut typu: błąd dopiero w show() -> [CAST_INVALID_INPUT]',
    notes: [
      'Są dwa rodzaje błędów. Literówkę w nazwie kolumny Spark złapał od razu, bo sprawdza plan względem schematu już przy definicji. Błąd w samych danych może wyjść dopiero wtedy, gdy dane faktycznie popłyną, czyli przy akcji.',
      'Praktyczny skutek: komunikat pojawia się daleko od linijki, która zawiniła. W zadaniach na końcu lekcji poszukasz takiej linijki sam.'
    ],
    scope: 'Ten wynik ma trzy warunki: tryb ANSI, klasyczny Spark i akcję, która naprawdę wylicza wadliwą kolumnę. Każdy z nich zmienia odpowiedź.',
    more: {
      title: 'Trzy warunki, od których zależy ten wynik',
      html: [
        '<b>Tryb ANSI.</b> To ustawienie, przy którym Spark trzyma się ścisłych reguł SQL: nieudany rzut kończy się błędem. W Sparku 4 jest domyślnie włączone. W labie z wyłączonym ANSI ten sam kod nie zgłosił błędu i zwrócił <code>NULL</code>. To samo daje <code>try_cast</code>.',
        '<b>Wyrażenie musi zostać wyliczone.</b> <code>select("id").collect()</code> i <code>count()</code> na tym samym DataFrame przeszły bez błędu. Akcja nie potrzebowała kolumny z rzutem, więc optymalizator ją wyciął i wartość <code>"abc"</code> nigdy nie została dotknięta. Błąd w danych może więc siedzieć w planie niezauważony.',
        '<b>Spark Connect.</b> To sposób łączenia się ze Sparkiem, w którym Twój program jest klientem i wysyła plan do serwera. Według dokumentacji sprawdzenie planu jest tam odłożone: zła nazwa kolumny wychodzi dopiero przy akcji albo przy pytaniu o schemat. Tak działa m.in. serverless w Databricks. Tego wariantu lab nie uruchamia.'
      ]
    }
  },
  {
    ask: 'Jedno <code>show()</code>. Ile jobów zobaczysz w Spark UI?',
    setup: `Plan: odczyt Parquet, filter, groupBy, suma. Porównanie z włączonym i wyłączonym <b>AQE</b> (Adaptive Query Execution). To mechanizm, który poprawia plan w trakcie wykonania, kiedy Spark zna już prawdziwe rozmiary danych. ${ENV}.`,
    choices: ['Zawsze jeden', 'To zależy'],
    correct: 1,
    mono: false,
    output: '5. Joby na akcję (ten sam plan: filter + groupBy)\n   AQE=true   show(): 2   count(): 3   collect(): 2\n   AQE=false  show(): 5   count(): 1   collect(): 1',
    notes: [
      'Od jednego do pięciu, na tym samym planie. Z AQE Spark wykonuje plan kawałkami, żeby między nimi poprawić resztę, i każdy kawałek bywa osobnym jobem.',
      'Wniosek na rozmowę: akcja uruchamia wykonanie planu. Ile to jobów, zależy od planu, wersji i konfiguracji.'
    ],
    scope: 'Konkretne liczby są z tego uruchomienia i nie są regułą. Na innej wersji albo innym planie wyjdą inne.',
    more: {
      title: 'Skąd pięć jobów bez AQE',
      html: [
        '<code>show()</code> potrzebuje 21 wierszy, więc nie liczy wszystkiego naraz. Najpierw sprawdza jedną partycję wyniku, a gdy wierszy jest za mało, sięga po kolejne, za każdym razem cztery razy więcej (<code>spark.sql.limit.scaleUpFactor = 4</code>). Każda próba to osobny job.',
        'Po shuffle\'u było 200 partycji, a wynik miał tylko 3 wiersze, więc Spark musiał przejść wszystkie: 1, 4, 16, 64 i reszta. Pięć prób, pięć jobów.',
        'To wyjaśnienie przewiduje konkretne liczby i lab je potwierdza: przy 1 partycji po shuffle\'u wyszedł 1 job, przy 5 dwa, przy 21 trzy, przy 200 pięć. W dokumentacji użytkownika nie znalazłem opisu tego mechanizmu, więc traktuj go jako wniosek z eksperymentu.'
      ]
    }
  }
];

/**
 * Etap Interview. Pytanie, odpowiedź 30–60 s (PL i EN) oraz follow-upy przychodzą z Interview Banku.
 * Tutaj jest tylko to, czego bank nie ma: pełna wypowiedź na 90 sekund i most do własnego doświadczenia.
 */
export const interview = {
  long: {
    label: 'Pełna wersja seniorska',
    time: { en: 'about 90 seconds', pl: 'ok. 90 sekund' },
    en: 'I think of a DataFrame as a query plan, not as data. Transformations add to the plan, and an action hands it to the engine. That\'s what makes the DataFrame API optimizable at all. Python runs line by line, so the only way Spark can see my whole query, the way a SQL engine sees a statement, is to not execute anything until I ask for a result. Then the optimizer prunes columns, pushes filters into the scan and reorders operations. A few consequences matter day to day. First, re-execution. Spark doesn\'t keep results between actions, so another action can recompute part or all of the plan. In a small local test, show followed by count pushed every row through my filter twice. If a result feeds several actions I cache it, knowing the cache is temporary and can be evicted. If it has to survive the job, I write it to a table. Second, errors. In classic Spark a wrong column name fails immediately, but a bad cast only fails when an action actually evaluates it, far from the line that caused it. On Spark Connect even the name check is deferred. Third, lazy isn\'t absolute. Reading a Parquet path can already run a small job to get the schema from file metadata, and one action isn\'t always one job. With adaptive execution a single show can be several.',
    pl: 'Myślę o DataFrame jak o planie zapytania, a nie o danych. Transformacje dopisują do planu, a akcja przekazuje go silnikowi. To dzięki temu API DataFrame w ogóle da się optymalizować. Python wykonuje się linijka po linijce, więc jedyny sposób, żeby Spark zobaczył całe moje zapytanie tak, jak silnik SQL widzi instrukcję, to nie wykonywać niczego, dopóki nie poproszę o wynik. Wtedy optymalizator wycina kolumny, spycha filtry do skanu i przestawia operacje. Na co dzień liczą się trzy konsekwencje. Po pierwsze, ponowne wykonanie. Spark nie przechowuje wyników między akcjami, więc kolejna akcja może policzyć część albo całość planu od nowa. W małym lokalnym teście show, a potem count przepuściły każdy wiersz przez mój filtr dwa razy. Jeśli wynik zasila kilka akcji, cache\'uję go, pamiętając, że cache jest tymczasowy i może zostać usunięty z pamięci. Jeśli ma przetrwać job, zapisuję go do tabeli. Po drugie, błędy. W klasycznym Sparku zła nazwa kolumny wywala się od razu, ale zły rzut typu dopiero wtedy, gdy akcja faktycznie go wyliczy, daleko od linijki, która go spowodowała. Na Spark Connect także sprawdzenie nazw jest odłożone. Po trzecie, leniwość nie jest absolutna. Odczyt Parquet ze ścieżki potrafi uruchomić mały job po schemat z metadanych pliku, a jedna akcja to nie zawsze jeden job. Z adaptive execution jedno show bywa kilkoma.',
    note: 'Zdanie o „małym lokalnym teście" mów dopiero wtedy, gdy sam uruchomisz skrypt z etapu Praktyka. To pięć minut, a na pytanie „jak to sprawdziłeś?" będziesz mieć prawdziwą odpowiedź.'
  },
  bridgeIntro: 'Jeśli na co dzień pracujesz w SQL i dbt, a nie w Sparku, ten temat przenosi się prawie wprost. Możesz to powiedzieć otwarcie:',
  bridgeEn: '“It\'s the same model I use in dbt. A dbt model is just a definition, and nothing runs until something materializes it. A view is recomputed when it\'s queried, and a DataFrame behaves like that view. If I need the equivalent of a table, I write the result out. Cache is only a temporary copy for the current session.”',
  bridgePl: 'Po polsku: model dbt to definicja i nic się nie dzieje, dopóki coś go nie zmaterializuje. Widok liczy się przy zapytaniu i DataFrame zachowuje się jak ten widok. Odpowiednikiem tabeli jest zapis wyniku. Cache to tylko tymczasowa kopia na czas sesji.'
};

export const tasks = {
  clickLine: {
    lines: ['subs = spark.read.parquet(path)', 'active = subs.filter(col("status") == "active")', 'slim = active.select("publisher_id", "price")', 'slim.cache()', 'total = slim.groupBy("publisher_id").sum("price")', 'total.show()'],
    why: [
      'Dobra intuicja, ale nie. W labie read.parquet uruchomił jeden mały job, tylko że po schemat z opisu pliku. Żadnego wiersza nie przetworzył.',
      'filter to transformacja. Dopisuje krok do planu.',
      'select też tylko dopisuje krok.',
      'cache() jest leniwy. Zaznacza, co zapamiętać, ale niczego nie uruchamia.',
      'groupBy z sum brzmi jak liczenie, ale to nadal transformacja.',
      'Tak. show() to akcja. Dopiero tu Spark optymalizuje cały plan i czyta wiersze. Przy okazji wypełnia też cache z linijki 4.'
    ],
    correct: 5
  },
  /** [nazwa operacji, czy akcja (1/0), wyjaśnienie dla nie-akcji] */
  pickActions: [['filter', 0, 'transformacja'], ['show', 1], ['withColumn', 0, 'transformacja'], ['collect', 1], ['groupBy', 0, 'transformacja'], ['write.saveAsTable', 1], ['cache', 0, 'leniwy znacznik, wypełnia się przy pierwszej akcji'], ['count', 1], ['orderBy', 0, 'transformacja, choć kosztowna w wykonaniu'], ['toPandas', 1], ['join', 0, 'transformacja'], ['take', 1]] as [string, number, string?][],
  predict: {
    setup: 'Założenia jak w eksperymencie 3: plik ma 9 wierszy w jednej partycji, bez cache. Funkcja seen() zwiększa licznik za każdym razem, gdy przechodzi przez nią wiersz.',
    code: 'df = (subs.filter(seen(col("status")) == "active")\n          .groupBy("publisher_id").count())\n\ndf.show()\ndf.count()\ndf.show()\nprint(counter.value)   # ?',
    options: ['9', '18', '27', '3'],
    correct: 2,
    why: 'W tym układzie każda z trzech akcji zbudowała własne zapytanie i wykonała plan od źródła, a każde wykonanie przepuściło przez filter wszystkie 9 wierszy. W labie licznik pokazał kolejno 9, 18 i 27.',
    cacheAsk: 'A gdyby po definicji dodać df.cache()?',
    cacheOptions: ['9', '18', '27'],
    cacheCorrect: 0,
    cacheWhy: 'Dziewięć. Pierwsza akcja liczy i wypełnia cache, dwie kolejne czytają już z niego. Tak było w eksperymencie 3: 9, 9, 9. Działa to tak gładko, bo plik ma jedną partycję i pierwsze show() policzyło ją w całości.'
  },
  findCause: {
    lines: ['raw = spark.createDataFrame([("1","10"), ("2","abc"), ("3","30")], "id string, amount_str string")', 'typed = raw.withColumn("amount", col("amount_str").cast("int"))', 'big = typed.filter(col("amount") > 5)', 'print("zdefiniowane")', 'big.show()      # CAST_INVALID_INPUT: \'abc\' cannot be cast to "INT"'],
    why: [
      'Tu powstają dane z wartością "abc", ale sama wartość jest poprawnym stringiem. Problem zaczyna się, gdy ktoś próbuje zrobić z niej liczbę.',
      'Tak. Rzut na int jest tutaj, ale linijka przeszła bez błędu, bo tylko dopisała krok do planu. Spark dotknął wartości "abc" dopiero w show(). W Sparku 4 komunikat błędu wskazuje zresztą miejsce wywołania cast.',
      'filter korzysta z kolumny amount, ale jej nie tworzy. Wadliwy rzut jest linijkę wyżej.',
      'print niczego nie liczy. Pokazuje tylko, że definicje przeszły.',
      'Tu błąd się ujawnił, ale nie tu powstał. show() tylko uruchomiło plan, w którym od dawna siedział wadliwy rzut.'
    ],
    correct: 1
  },
  /** [kod, poprawna liczba kolumn, wyjaśnienie] */
  columns: [
    ['subs.count()', 0, 'Zero. Do policzenia wierszy Spark nie potrzebuje żadnej kolumny (ReadSchema: struct<>).'],
    ['subs.filter(col("status") == "active").count()', 1, 'Jedną: status. Jest potrzebna do filtra i do niczego więcej.'],
    ['subs.filter(col("status") == "active")\n    .groupBy("publisher_id").agg(sum("price")).show()', 3, 'Trzy: publisher_id, status i price. Bez żadnego select w kodzie.']
  ] as [string, number, string][],
  columnsSource: 'Wszystkie trzy liczby pochodzą z ReadSchema w prawdziwym explain() (PySpark 4.0.1, plik Parquet).'
};

export interface PlanNode { t: 'filter' | 'project' | 'agg' | 'keys' | 'count'; cols?: string[] }
export interface OptimizedPlan { n: PlanNode[]; read: string[]; pushed: boolean }
/** Plan po optymalizacji dla każdej kombinacji operacji i akcji, z prawdziwego explain() (PySpark 4.0.1, Parquet). */
export const plans = plansJson as unknown as Record<string, OptimizedPlan>;

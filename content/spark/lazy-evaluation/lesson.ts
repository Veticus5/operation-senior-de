import type { LessonMeta } from '../../types';
import plansJson from './plans.json';

/**
 * Lekcja: Spark, transformations, actions i lazy evaluation.
 * Treść przeniesiona 1:1 z zaakceptowanego artefaktu. Fragmenty narracyjne są w HTML
 * (dozwolone znaczniki: p, h1, h2, b, code, pre, span, div). Wyniki w sekcji eksperymentów
 * pochodzą z uruchomienia labs/lazy_evaluation/lazy_lab.py na PySpark 4.0.1.
 */
export const meta: LessonMeta = {
  id: 'spark-lazy-evaluation',
  topicId: 'spark.lazy-evaluation',
  area: 'spark',
  title: 'Transformations, Actions & Lazy Evaluation',
  subtitle: 'Dlaczego Spark nic nie robi, dopóki nie poprosisz o wynik, i co z tego wynika w praktyce.',
  minutes: 35
};

export interface Beat { html: string; next: string | null }
export const beats: Beat[] = [
  {
    "html": "<h1>Cztery linijki, dwa miliardy wierszy.</h1>\n<p class=\"lede\">W S3 leży tabela zdarzeń: 2 mld wierszy, 80 kolumn. Chcesz policzyć przychód z aktywnych subskrypcji per publisher. Piszesz to tak:</p>\n<pre class=\"code\">events  = spark.read.parquet(<span class=\"k\">\"s3://.../events\"</span>)\nactive  = events.filter(col(<span class=\"k\">\"status\"</span>) == <span class=\"k\">\"active\"</span>)\nslim    = active.select(<span class=\"k\">\"publisher_id\"</span>, <span class=\"k\">\"price\"</span>)\nrevenue = slim.groupBy(<span class=\"k\">\"publisher_id\"</span>).sum(<span class=\"k\">\"price\"</span>)</pre>\n<p>Pytanie, od którego zaczyna się cały Spark: <b>co ma się stać po każdej z tych linijek?</b></p>",
    "next": "Pomyślałem. Dalej"
  },
  {
    "html": "<h2>Gdyby Spark działał jak pandas</h2>\n<p>Każda linijka wykonałaby się od razu. <code>filter</code> przemieliłby 2 mld wierszy i wszystkie 80 kolumn, a wynik zostałby w pamięci. Dopiero potem <code>select</code> wyrzuciłby 78 kolumn, które przed chwilą niepotrzebnie przeczytałeś.</p>\n<p>Nikt nie napisałby tak zapytania w SQL. Ale w Pythonie tak właśnie wygląda wykonanie linijka po linijce.</p>",
    "next": "A jak robi to Snowflake?"
  },
  {
    "html": "<h2>Snowflake dostaje całe zapytanie naraz</h2>\n<p>Kiedy wysyłasz SQL, optymalizator widzi wszystko: że potrzebujesz 3 kolumn z 80 i tylko aktywnych wierszy. Czyta więc tyle, ile musi. To luksus języka deklaratywnego. Ty mówisz <b>co</b>, silnik decyduje <b>jak</b>.</p>\n<p>Spark chce dać Ci ten sam luksus w Pythonie. Tyle że Python podaje mu zapytanie po kawałku i Spark nigdy nie wie, czy to już koniec.</p>",
    "next": "Więc co robi?"
  },
  {
    "html": "<h2>Nic. Zapisuje i czeka.</h2>\n<p>Każda z tych czterech linijek dopisuje tylko krok do planu. Żaden bajt z S3 nie jest czytany. Dopiero gdy poprosisz o wynik, np. <code>revenue.show()</code>, Spark ma w ręku całe zapytanie. Upraszcza je tak, jak zrobiłby to Snowflake, i wykonuje.</p>\n<div class=\"cmp\" id=\"cmp\">\n  <div class=\"cmp-lane\"><div class=\"lab\">Linijka po linijce</div><div class=\"cmp-bars\">\n    <div class=\"bar\" style=\"--w:100%;--d:0s\"><i></i><span>filter: wszystkie wiersze, 80 kolumn</span></div>\n    <div class=\"bar\" style=\"--w:62%;--d:1s\"><i></i><span>select: wynik pośredni, 80 kolumn</span></div>\n    <div class=\"bar\" style=\"--w:9%;--d:2s\"><i></i><span>groupBy</span></div>\n  </div></div>\n  <div class=\"cmp-lane\"><div class=\"lab\">Najpierw cały plan</div><div class=\"cmp-bars\">\n    <div class=\"bar acc\" style=\"--w:9%;--d:3s\"><i></i><span>jedno przejście, 3 kolumny z 80</span></div>\n  </div></div>\n</div>\n<p class=\"small\">Ilustracja proporcji, nie pomiar.</p>\n<p>Stąd trzy słowa, które usłyszysz na każdej rozmowie. Operacje, które tylko dopisują krok, to <b>transformacje</b>. Te, które żądają wyniku, to <b>akcje</b>. A cała strategia czekania nazywa się <b>lazy evaluation</b>.</p>",
    "next": "Gdzie ja to już widziałem?"
  },
  {
    "html": "<h2>W dbt, codziennie</h2>\n<p>Model dbt to SELECT, który sam niczego nie liczy. CTE też nie. Pracę uruchamia dopiero <code>dbt run</code> albo zapytanie do widoku. DataFrame w Sparku to taki łańcuch CTE, tylko budowany w Pythonie.</p>\n<p>I jedna rzecz, która przenosi się razem z analogią: widok w Snowflake liczy się od nowa przy każdym zapytaniu. DataFrame też. Zaraz zobaczysz, co to znaczy w praktyce.</p>",
    "next": "Zobacz to na żywo"
  }
];

export interface Experiment { ask: string; choices: string[]; correct: number; mono: boolean; output: string; notes: string[] }
export const experiments: Experiment[] = [
  {
    "ask": "Zdefiniowanie <code>filter</code> i <code>groupBy</code> kontra jedno <code>show()</code>. Co potrwa dłużej?",
    "choices": [
      "Podobnie",
      "show() wyraźnie dłużej",
      "Definicja dłużej"
    ],
    "correct": 1,
    "mono": false,
    "output": "1. read.parquet uruchomił jobów: 1\n   definicja: 0.24 s   show(): 1.32 s   joby w show(): 2\n   joby w count(): 3",
    "notes": [
      "Definicja to tylko zbudowanie i sprawdzenie planu. Praca dzieje się w <code>show()</code>. Na 9 wierszach różnica jest kilkukrotna, na prawdziwych danych to sekundy kontra minuty. Konkretne czasy zależą od maszyny.",
      "Zwróć uwagę na pierwszą linijkę. Samo <code>read.parquet</code> uruchomiło mały job, żeby poznać schemat pliku. Wierszy nie czytało."
    ]
  },
  {
    "ask": "Plik ma 4 kolumny. Ile z nich Spark przeczyta dla <code>filter(status) → groupBy(publisher_id) → sum(price)</code>?",
    "choices": [
      "4",
      "3",
      "2"
    ],
    "correct": 1,
    "mono": true,
    "output": "Aggregate [publisher_id], [publisher_id, count(1) AS subs, sum(price) AS mrr]\n+- <span class=\"k\">Project [publisher_id, price]</span>\n   +- Filter (isnotnull(status) AND (status = active))\n      +- Relation [subscription_id, publisher_id, status, price] parquet\n\n   <span class=\"k\">PushedFilters: [IsNotNull(status), EqualTo(status,active)]</span>\n   <span class=\"k\">ReadSchema: struct&lt;publisher_id:string,status:string,price:double&gt;</span>",
    "notes": [
      "Trzy. <code>subscription_id</code> nigdy nie opuszcza pliku, choć nigdzie nie napisałeś <code>select</code>. <code>status</code> jest potrzebny tylko do filtra, więc zaraz po nim Spark sam dopisał <code>Project</code> i dalej niesie już dwie kolumny.",
      "<code>PushedFilters</code> znaczy, że warunek trafił do czytnika Parquet, który może dzięki temu pomijać całe bloki pliku. Identyfikatory typu <code>#5</code> usunąłem z wydruku dla czytelności."
    ]
  },
  {
    "ask": "Źródło ma 9 wierszy. Wywołujesz <code>show()</code>, a potem <code>count()</code> na tym samym DataFrame. Ile wierszy łącznie przejdzie przez filter?",
    "choices": [
      "9",
      "18",
      "27"
    ],
    "correct": 1,
    "mono": true,
    "output": "3. Wiersze, które przeszły przez filter (źródło ma 9)\n   bez cache:  po show() 9, po count() <span class=\"k\">18</span>\n   z cache():  po cache() 0, po show() 9, po count() <span class=\"k\">9</span>, po drugim show() <span class=\"k\">9</span>\n   wyjątek:    collect() dwa razy na tym samym DataFrame: 9, potem 9",
    "notes": [
      "Osiemnaście. Spark niczego nie zapamiętał między akcjami i przerobił wszystkie wiersze drugi raz. Po <code>cache()</code> licznik staje na 9 i już się nie rusza. Samo wywołanie <code>cache()</code> niczego nie policzyło (licznik 0).",
      "Trzecia linijka to dobry haczyk na rozmowę. Dwa razy <code>collect()</code> na tym samym obiekcie nie powtórzyło pracy, bo plan miał shuffle, a Spark użył ponownie jego zapisanych wyników. Dlatego dokumentacja mówi ostrożnie, że wynik „may be recomputed\". Bez shuffle'u w planie ten sam test dał u mnie 9 i 18."
    ]
  },
  {
    "ask": "W danych jest wartość <code>\"abc\"</code>, a Ty robisz <code>cast(\"int\")</code> w linijce z <code>withColumn</code>. Kiedy zobaczysz błąd?",
    "choices": [
      "Od razu, w tej linijce",
      "Dopiero w show()"
    ],
    "correct": 1,
    "mono": false,
    "output": "4. Błędy\n   literówka w kolumnie: błąd od razu -> [UNRESOLVED_COLUMN.WITH_SUGGESTION]\n   zły rzut typu: definicja przeszła bez błędu\n   zły rzut typu: błąd dopiero w show() -> [CAST_INVALID_INPUT]",
    "notes": [
      "Są dwa rodzaje błędów. Literówkę w nazwie kolumny Spark łapie od razu, bo sprawdza plan względem schematu już przy definicji. Błąd w samych danych może wyjść dopiero wtedy, gdy dane faktycznie popłyną, czyli przy akcji.",
      "Dwa zastrzeżenia. W Sparku 4 tryb ANSI jest domyślnie włączony, dlatego zły rzut kończy się błędem, a nie cichym nullem. A na Spark Connect, czyli m.in. na serverless w Databricks, także sprawdzanie nazw kolumn jest odłożone do wykonania."
    ]
  },
  {
    "ask": "Jedno <code>show()</code>. Ile jobów zobaczysz w Spark UI?",
    "choices": [
      "Zawsze jeden",
      "To zależy"
    ],
    "correct": 1,
    "mono": false,
    "output": "5. Joby na akcję (ten sam plan: filter + groupBy)\n   AQE=true   show(): 2   count(): 3   collect(): 2\n   AQE=false  show(): 5   count(): 1   collect(): 1",
    "notes": [
      "Od jednego do pięciu, na tym samym planie. Z AQE Spark dzieli wykonanie na etapy i każdy bywa osobnym jobem. Bez AQE <code>show()</code> dało 5 jobów, bo pobiera pierwsze wiersze porcjami partycji, a po shuffle'u było ich domyślnie 200.",
      "Wniosek na rozmowę: akcja uruchamia wykonanie planu. Ile to jobów, zależy od planu i konfiguracji."
    ]
  }
];

export interface Answer { id: string; label: string; lang: 'pl' | 'en'; time: string; text: string; pl?: string; note?: string }
export const interview = {
  questionPl: 'Czym różni się transformacja od akcji i po co Sparkowi lazy evaluation?',
  questionEn: "What's the difference between a transformation and an action, and why is Spark lazy?",
  answers: [
    { id: 'short', label: 'Krótko, po polsku', lang: 'pl', time: 'ok. 20 sekund',
      text: 'Transformacje, takie jak filter czy groupBy, niczego nie liczą. Dopisują krok do planu i zwracają nowy DataFrame. Dopiero akcja, czyli show, count albo zapis, każe Sparkowi ten plan wykonać. Dzięki temu Spark widzi całe zapytanie naraz i może je zoptymalizować tak, jak robi to silnik SQL.' },
    { id: 'en', label: 'Minuta po angielsku', lang: 'en', time: 'about one minute',
      text: 'Sure. In Spark, transformations are things like filter, select or groupBy. They don\'t actually process any data. They just describe a step and give you back a new DataFrame. Actions are things like show, count, or writing to a table. An action asks for a result, and that\'s the moment Spark really runs something. The reason it works this way is optimization. Because Spark waits, it sees the whole query before it executes, so it can do what a SQL engine does: read only the columns it needs, push filters down to the source, choose a join strategy. If it ran every line right away, it couldn\'t. The practical side is that nothing is remembered between actions. If I call show and then count, Spark does the work twice, unless I cache the DataFrame or write it out.' },
    { id: 'senior', label: 'Wersja seniorska', lang: 'en', time: 'about 90 seconds',
      text: 'I think of a DataFrame as a query plan, not as data. Transformations add to the plan, and an action hands it to the engine. That\'s what makes the DataFrame API optimizable at all. Python runs line by line, so the only way Spark can see my whole query, the way a SQL engine sees a statement, is to not execute anything until I ask for a result. Then the optimizer prunes columns, pushes filters into the scan and reorders operations. A few consequences matter day to day. First, re-execution. Each action runs the plan again. I\'ve measured it: show followed by count pushed every row through my filter twice. So if a result feeds several actions, I cache it or, more often, write it to a table. Second, errors. A wrong column name fails immediately, but a bad cast only blows up at the action, far from the line that caused it. Third, lazy isn\'t absolute. Reading a file already runs a small job to get the schema, and one action isn\'t always one job. With adaptive execution a single show can be several.',
      pl: 'Myślę o DataFrame jak o planie zapytania, a nie o danych. Transformacje dopisują do planu, a akcja przekazuje go silnikowi. To dzięki temu API DataFrame w ogóle da się optymalizować. Python wykonuje się linijka po linijce, więc jedyny sposób, żeby Spark zobaczył całe moje zapytanie tak, jak silnik SQL widzi instrukcję, to nie wykonywać niczego, dopóki nie poproszę o wynik. Wtedy optymalizator wycina kolumny, spycha filtry do skanu i przestawia operacje. Na co dzień liczą się trzy konsekwencje. Po pierwsze, ponowne wykonanie. Każda akcja uruchamia plan od nowa. Zmierzyłem to: show, a potem count przepuściły każdy wiersz przez filtr dwa razy. Jeśli więc wynik zasila kilka akcji, cache\'uję go albo, częściej, zapisuję do tabeli. Po drugie, błędy. Zła nazwa kolumny wywala się od razu, ale zły rzut typu wybucha dopiero przy akcji, daleko od linijki, która go spowodowała. Po trzecie, leniwość nie jest absolutna. Samo czytanie pliku uruchamia mały job po schemat, a jedna akcja to nie zawsze jeden job. Z adaptive execution jedno show bywa kilkoma.',
      note: 'Zdanie „I\'ve measured it" jest prawdziwe dopiero wtedy, gdy sam uruchomisz skrypt z etapu Praktyka. To pięć minut.' }
  ] as Answer[],
  /** [pytanie EN, odpowiedź EN, sedno PL] */
  followUps: [
    ['Is cache() a transformation or an action?', 'Neither triggers work on its own. cache() is lazy: it only marks the DataFrame to be kept. The data is actually stored when the first action runs, and later actions read from it.', 'W eksperymencie 3 licznik po samym cache() pokazywał 0.'],
    ['You call show() and then count() on the same DataFrame. What happens?', 'Spark runs the plan twice, including reading the source. In my test every row went through the filter twice. The exception is when Spark can reuse shuffle output it still has, which is why the docs say a result "may be recomputed".', 'Dwie akcje to dwa wykonania. Wyjątek: ponowne użycie wyników shuffle\'u.'],
    ['Does one action always mean exactly one job?', 'No. An action triggers execution of the plan, and how many jobs that takes depends on the plan and the configuration. On the same query I got two jobs for show with adaptive execution on and five with it off.', 'Bezpieczne sformułowanie: akcja uruchamia wykonanie planu.'],
    ['Is reading a file lazy as well?', 'Mostly. spark.read doesn\'t load the rows, but it does need a schema. For Parquet that meant one small job that reads file metadata. For CSV with inferSchema Spark has to scan the data, so I pass an explicit schema in production.', 'read.parquet: 1 job po schemat. CSV z inferSchema: dodatkowy przebieg po danych.'],
    ['When do you find out about an error in a transformation?', 'It depends on the kind of error. A wrong column name fails right away, because Spark checks the plan against the schema when I define it. A data problem, like a bad cast, only shows up when an action actually processes the rows. On Spark Connect even the name check is deferred.', 'Błąd planu od razu, błąd danych przy akcji.'],
    ['What is the difference between cache(), persist() and writing to a table?', 'cache() is persist() with the default storage level, memory and disk for DataFrames. Both keep the plan, so if cached data is lost Spark can recompute it. Writing to a table gives me a durable result that other jobs can read and cuts the dependency on the upstream plan, which is what I prefer for anything reused across jobs.', 'cache dla jednego joba i kilku akcji, tabela dla wszystkiego, co ma przetrwać.'],
    ['How do you check what Spark is actually going to run?', 'I call explain on the DataFrame, usually in extended or formatted mode, and compare the plan I wrote with the optimized one. In the scan node I look at ReadSchema and PushedFilters to confirm pruning and pushdown really happened.', 'Dokładnie to robi eksperyment 2.']
  ] as [string, string, string][],
  bridgeEn: '“It\'s the model I work with every day in dbt on Snowflake. A dbt model is just a definition, and nothing runs until something materializes it. A view gets recomputed on every query, a table doesn\'t. A DataFrame behaves like the view, and cache or a write is my way of turning it into the table.”',
  bridgePl: 'Po polsku: model dbt to definicja i nic się nie dzieje, dopóki coś go nie zmaterializuje. Widok liczy się przy każdym zapytaniu, tabela nie. DataFrame zachowuje się jak widok, a cache albo zapis robi z niego tabelę.'
};

export const tasks = {
  clickLine: { lines: ['subs = spark.read.parquet(path)', 'active = subs.filter(col("status") == "active")', 'slim = active.select("publisher_id", "price")', 'slim.cache()', 'total = slim.groupBy("publisher_id").sum("price")', 'total.show()'], why: ['Dobra intuicja, ale nie. read.parquet uruchomił u mnie jeden mały job, tylko że po schemat z metadanych pliku. Żadnego wiersza nie przeczytał.',
        'filter to transformacja. Dopisuje krok do planu.', 'select też tylko dopisuje krok.',
        'cache() jest leniwy. Zaznacza, co zapamiętać, ale niczego nie uruchamia.', 'groupBy z sum brzmi jak liczenie, ale to nadal transformacja.',
        'Tak. show() to akcja. Dopiero tu Spark optymalizuje cały plan i czyta dane. Przy okazji wypełnia też cache z linijki 4.'], correct: 5 },
  /** [nazwa operacji, czy akcja (1/0), wyjaśnienie dla nie-akcji] */
  pickActions: [['filter', 0, 'transformacja'], ['show', 1], ['withColumn', 0, 'transformacja'], ['collect', 1], ['groupBy', 0, 'transformacja'], ['write.saveAsTable', 1], ['cache', 0, 'leniwy znacznik, wypełnia się przy pierwszej akcji'], ['count', 1], ['orderBy', 0, 'transformacja, choć kosztowna w wykonaniu'], ['toPandas', 1], ['join', 0, 'transformacja'], ['take', 1]] as [string, number, string?][],
  findCause: { lines: ['raw = spark.createDataFrame([("1","10"), ("2","abc"), ("3","30")], "id string, amount_str string")', 'typed = raw.withColumn("amount", col("amount_str").cast("int"))', 'big = typed.filter(col("amount") > 5)', 'print("zdefiniowane")', 'big.show()      # CAST_INVALID_INPUT: \'abc\' cannot be cast to "INT"'], why: ['Tu powstają dane z wartością "abc", ale sama wartość jest poprawnym stringiem. Problem zaczyna się, gdy ktoś próbuje zrobić z niej liczbę.',
        'Tak. Rzut na int jest tutaj, ale linijka przeszła bez błędu, bo tylko dopisała krok do planu. Spark dotknął wartości "abc" dopiero w show(). W Sparku 4 komunikat błędu wskazuje zresztą miejsce wywołania cast.',
        'filter korzysta z kolumny amount, ale jej nie tworzy. Wadliwy rzut jest linijkę wyżej.', 'print niczego nie liczy. Pokazuje tylko, że definicje przeszły.',
        'Tu błąd się ujawnił, ale nie tu powstał. show() tylko uruchomiło plan, w którym od dawna siedział wadliwy rzut.'], correct: 1 },
  /** [kod, poprawna liczba kolumn, wyjaśnienie] */
  columns: [['subs.count()', 0, 'Zero. Do policzenia wierszy Spark nie potrzebuje żadnej kolumny (ReadSchema: struct<>).'],
        ['subs.filter(col("status") == "active").count()', 1, 'Jedną: status. Jest potrzebna do filtra i do niczego więcej.'],
        ['subs.filter(col("status") == "active")\n    .groupBy("publisher_id").agg(sum("price")).show()', 3, 'Trzy: publisher_id, status i price. Bez żadnego select w kodzie.']] as [string, number, string][]
};

export interface PlanNode { t: 'filter' | 'project' | 'agg' | 'keys' | 'count'; cols?: string[] }
export interface OptimizedPlan { n: PlanNode[]; read: string[]; pushed: boolean }
/** Plan po optymalizacji dla każdej kombinacji operacji i akcji, z prawdziwego explain() (PySpark 4.0.1, Parquet). */
export const plans = plansJson as unknown as Record<string, OptimizedPlan>;

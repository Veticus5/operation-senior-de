import type { GlossaryEntry } from './types';

/**
 * Słownik pojęć. Jedno źródło definicji dla lekcji i Interview Banku.
 * W treści hasło oznacza się znacznikiem <term id="klucz">tekst</term>, a komponent TermTooltip pokazuje definicję.
 *
 * Zasady: definicja nie może wymagać znajomości innego hasła, ma 1–3 zdania i mówi, po co pojęcie istnieje.
 * Pojęcia kluczowe dla lekcji tłumacz dodatkowo w tekście, przy pierwszym użyciu. Dymek jest dla pojęć pobocznych
 * i jako przypomnienie.
 */
export const glossary: Record<string, GlossaryEntry> = {
  parquet: {
    term: 'Parquet',
    def: 'Format pliku, w którym dane leżą kolumnami, a nie wierszami. Dzięki temu da się przeczytać wybrane kolumny bez ruszania pozostałych. Na końcu pliku jest stopka z opisem zawartości.'
  },
  schema: {
    term: 'Schemat',
    def: 'Lista kolumn i ich typów. Spark potrzebuje jej, żeby sprawdzić, czy zapytanie ma sens, zanim dotknie danych.'
  },
  metadata: {
    term: 'Metadane pliku',
    def: 'Opis zawartości zapisany w stopce pliku Parquet: kolumny i typy, liczba wierszy, podział na grupy wierszy i ich statystyki. Odczyt metadanych to nie jest odczyt wierszy.'
  },
  'row-group': {
    term: 'Row group',
    def: 'Grupa wierszy: kawałek pliku Parquet zapisany jako całość. Dla każdej grupy plik może przechowywać najmniejszą i największą wartość każdej kolumny, więc czytnik potrafi pominąć całą grupę, jeśli filtr na pewno nic w niej nie znajdzie.'
  },
  partition: {
    term: 'Partycja',
    def: 'Kawałek danych, który Spark przetwarza jako jedno zadanie. Duży zbiór to wiele partycji liczonych równolegle. To nie to samo co partycja tabeli w hurtowni.'
  },
  task: {
    term: 'Task',
    def: 'Najmniejsza jednostka pracy w Sparku: jedno zadanie liczy jedną partycję.'
  },
  stage: {
    term: 'Stage',
    def: 'Etap wykonania: grupa zadań, które da się policzyć bez przenoszenia danych między partycjami. Nowy stage zaczyna się tam, gdzie dane trzeba przetasować.'
  },
  job: {
    term: 'Job',
    def: 'Porcja pracy, którą Spark faktycznie wysyła do wykonania, zwykle w odpowiedzi na akcję. Każdy job widać w Spark UI.'
  },
  shuffle: {
    term: 'Shuffle',
    def: 'Przetasowanie danych między partycjami, np. po to, żeby wiersze z tym samym kluczem spotkały się w jednym miejscu. Potrzebują go m.in. groupBy i join dużych tabel. Kosztuje: zapis na dysk i transfer po sieci.'
  },
  aqe: {
    term: 'AQE (Adaptive Query Execution)',
    def: 'Mechanizm, który poprawia plan w trakcie wykonania, kiedy Spark zna już prawdziwe rozmiary danych. Na przykład skleja małe partycje albo zmienia sposób łączenia tabel. W Apache Spark domyślnie włączony od wersji 3.2.'
  },
  udf: {
    term: 'UDF',
    def: 'Własna funkcja, tutaj napisana w Pythonie, którą Spark wywołuje dla każdego wiersza. Optymalizator nie widzi, co jest w środku.'
  },
  ansi: {
    term: 'Tryb ANSI',
    def: 'Ustawienie, przy którym Spark trzyma się ścisłych reguł SQL: nieudany rzut typu albo przepełnienie liczby kończy się błędem zamiast cichego NULL. W Sparku 4 domyślnie włączony.'
  },
  'spark-connect': {
    term: 'Spark Connect',
    def: 'Sposób łączenia się ze Sparkiem, w którym Twój program jest klientem, a plan zapytania wysyła do serwera. Serwer sprawdza plan dopiero wtedy, gdy go dostanie, czyli przy akcji albo gdy pytasz o schemat. Tak działa m.in. serverless w Databricks.'
  },
  'column-pruning': {
    term: 'Column pruning',
    def: 'Przycinanie kolumn. Optymalizator ustala, których kolumn zapytanie naprawdę potrzebuje, i tylko o nie prosi źródło danych.'
  },
  'predicate-pushdown': {
    term: 'Predicate pushdown',
    def: 'Przekazanie warunku filtra do źródła danych, żeby mogło odrzucić część danych, zanim trafią do Sparka. Czy cokolwiek zostanie pominięte, zależy od źródła i od ułożenia danych.'
  },
  'spark-ui': {
    term: 'Spark UI',
    def: 'Strona diagnostyczna działającej aplikacji Sparka. Pokazuje uruchomione joby, ich etapy i zadania, plany zapytań oraz to, co leży w cache.'
  },
  driver: {
    term: 'Driver',
    def: 'Proces, w którym działa Twój kod. Buduje plan, rozdziela pracę i odbiera wyniki.'
  },
  executor: {
    term: 'Executor',
    def: 'Proces roboczy na klastrze. Wykonuje zadania zlecone przez driver i przechowuje dane w cache.'
  },
  optimizer: {
    term: 'Optymalizator (Catalyst)',
    def: 'Część Sparka, która przepisuje plan zapytania na równoważny, ale tańszy: wycina niepotrzebne kolumny, przesuwa filtry bliżej źródła, wybiera sposób łączenia tabel.'
  },
  'local-mode': {
    term: 'local[3]',
    def: 'Tryb, w którym cały Spark działa w jednym procesie na Twojej maszynie, z trzema wątkami roboczymi. Nie ma osobnych executorów ani sieci, więc część zachowań klastra tu nie wystąpi.'
  },
  'cluster-manager': {
    term: 'Menedżer klastra',
    def: 'Usługa, która przydziela aplikacjom maszyny i zasoby na klastrze. Spark działa z własnym trybem Standalone, z Hadoop YARN i z Kubernetes.'
  },
  jvm: {
    term: 'JVM',
    def: 'Maszyna wirtualna Javy: środowisko, w którym działają procesy silnika Sparka. Kod w Pythonie steruje nimi z zewnątrz.'
  },
  rdd: {
    term: 'RDD',
    def: 'Starsze, niskopoziomowe API Sparka: rozproszona kolekcja obiektów bez nazwanych kolumn i bez optymalizatora zapytań. DataFrame dokłada do tej idei schemat i optymalizację.'
  },
  dag: {
    term: 'DAG',
    def: 'Directed acyclic graph: graf zależności między krokami obliczeń. Skierowany, bo zależność ma kierunek. Acykliczny, bo żaden krok nie zależy od samego siebie, więc zawsze da się ustalić kolejność wykonania.'
  },
  exchange: {
    term: 'Exchange',
    def: 'Węzeł planu fizycznego, który przenosi dane. Z podziałem na partycje, np. hashpartitioning, oznacza przetasowanie danych i początek nowego etapu wykonania. BroadcastExchange to inny rodzaj: rozsyła małą tabelę i przetasowaniem nie jest.'
  },
  'broadcast-join': {
    term: 'Broadcast join',
    def: 'Sposób łączenia tabel, w którym mała tabela jest rozsyłana w całości do wszystkich procesów roboczych. Duża tabela zostaje na miejscu i nie trzeba jej tasować.'
  },
  accumulator: {
    term: 'Akumulator',
    def: 'Licznik, do którego zadania mogą tylko dodawać, a wynik odczytuje driver. Dobry do diagnostyki. Gdy Spark ponawia zadanie, licznik użyty w transformacji może zostać zwiększony więcej niż raz.'
  },
  'join-hint': {
    term: 'Hint (wskazówka joina)',
    def: 'Dopisek w zapytaniu albo w kodzie, którym prosisz Sparka o konkretny sposób łączenia tabel, np. broadcast. Spark go uwzględnia, jeśli ten sposób obsługuje dany typ joina. To prośba, nie gwarancja.'
  }
};

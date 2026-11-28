import type { Compare, More } from './shared';

/**
 * Etap 3: Skala. Najpierw diagnoza wąskiego gardła, potem wybór między większą maszyną, większą liczbą maszyn
 * i rozdzieleniem obciążeń. Wszystkie czasy i koszty to ilustracje: liczby są wymyślone, a stawki kredytów
 * pochodzą z dokumentacji Snowflake dla standardowych warehouse'ów (S = 2, M = 4, L = 8 kredytów na godzinę).
 */
export const opening = {
  html: '<h1>O 8:00 dashboardy ładują się cztery minuty. Kupić większy warehouse?</h1>\n<p class="lede">Platforma działa, ale rośnie: więcej danych, więcej modeli, więcej ludzi. Pierwszy odruch to „dołóżmy mocy". Na rozmowie pierwsze pytanie brzmi inaczej: <b>czego dokładnie brakuje?</b></p>\n<p>Zapytanie może być wolne z dwóch zupełnie różnych powodów. Albo <b>czeka w kolejce</b>, bo inni zajęli zasoby, albo <b>samo liczy się długo</b>, bo brakuje mu pamięci lub ma za dużo danych. Te dwa przypadki leczy się inaczej.</p>'
};

export interface WorkloadMetric {
  label: string;
  value: string;
  /** Wartość, która wskazuje na problem. */
  hot?: boolean;
}
export interface WorkloadOutcome {
  metrics: [string, string][];
  verdict: string;
  /** Czy to dobry wybór w tym przypadku. */
  fit: 'good' | 'partial' | 'bad';
}
export interface WorkloadCase {
  id: string;
  label: string;
  story: string;
  /** Objawy do odczytania przed wyborem. */
  symptoms: WorkloadMetric[];
  outcomes: Record<string, WorkloadOutcome>;
}

/** Stawki i czasy przypadku „ciężki model", z których wynika zdanie o koszcie w werdykcie. Pilnuje ich test. */
export const heavy = { baseMinutes: 96, biggerMinutes: 30, mediumRate: 4, largeRate: 8 };

export const workload = {
  question: 'Kolejka czy brak pamięci?',
  intro: 'Dwa poranki na tym samym warehousie średniego rozmiaru (M). Najpierw przeczytaj objawy, potem wybierz zmianę i zobacz skutek.',
  assumptions: 'Symulacja: czasy i kolejki są wymyślone i dobrane tak, żeby różnicę było widać. Kredyty na godzinę to stawki standardowych warehouse\'ów Snowflake. Rzeczywisty zysk zależy od zapytań i danych.',
  caseLabel: 'Sytuacja',
  fixLabel: 'Co zmieniasz',
  defaultCase: 'queue',
  defaultFix: 'none',
  fixes: [
    { id: 'none', label: 'Nic' },
    { id: 'up', label: 'Większy warehouse (L)' },
    { id: 'out', label: 'Więcej klastrów (multi-cluster)' },
    { id: 'split', label: 'Osobne warehouse\'y' }
  ],
  cases: [
    {
      id: 'queue', label: 'Dashboardy czekają',
      story: 'Między 7:00 a 9:00 na jednym warehousie działa nocne ładowanie dbt i 30 dashboardów otwieranych przez finanse.',
      symptoms: [
        { label: 'Czas w kolejce (dashboard)', value: '4 min', hot: true },
        { label: 'Czas wykonania (dashboard)', value: '6 s' },
        { label: 'Dane zrzucone na dysk', value: '0 GB' }
      ],
      outcomes: {
        none: { fit: 'bad', metrics: [['Dashboard czeka', '4 min'], ['Ładowanie dbt', '40 min'], ['Koszt w szczycie', '4 kredyty/h']], verdict: 'Zapytania dashboardów są szybkie, tylko nie mogą się zacząć. To nie jest problem wydajności zapytań, tylko rywalizacji o te same zasoby.' },
        up: { fit: 'partial', metrics: [['Dashboard czeka', '1,5 min'], ['Ładowanie dbt', '22 min'], ['Koszt w szczycie', '8 kredytów/h']], verdict: 'Pomaga pośrednio: wszystko liczy się szybciej, więc kolejka krócej stoi. Ale ładowanie i dashboardy nadal rywalizują, a podwójną stawkę płacisz za każdą godzinę pracy, nie tylko za szczyt.' },
        out: { fit: 'partial', metrics: [['Dashboard czeka', 'kilka sekund'], ['Ładowanie dbt', '40 min'], ['Koszt w szczycie', 'do 12 kredytów/h']], verdict: 'Skalowanie wszerz (scale out) jest zrobione właśnie na wiele zapytań naraz: gdy rośnie kolejka, startuje kolejny klaster tego samego rozmiaru. Kolejka znika. Ładowanie nie przyspiesza, a ładowanie i dashboardy nadal mają jeden rachunek i jedną konfigurację.' },
        split: { fit: 'good', metrics: [['Dashboard czeka', 'kilka sekund'], ['Ładowanie dbt', '36 min'], ['Koszt w szczycie', '4 + 2 kredyty/h']], verdict: 'Ładowanie dostaje własny warehouse M, dashboardy własny S. Przestają sobie przeszkadzać, każdy ma rozmiar dobrany do swojej pracy, wyłącza się niezależnie i widać, kto ile kosztuje. To jest <b>izolacja obciążeń</b> (workload isolation): każdy rodzaj pracy ma własne zasoby.' }
      }
    },
    {
      id: 'memory', label: 'Jeden model liczy się 96 minut',
      story: 'Model łączący trzy lata zdarzeń z subskrypcjami działa w nocy sam, bez konkurencji, na warehousie M.',
      symptoms: [
        { label: 'Czas w kolejce', value: '0 s' },
        { label: 'Czas wykonania', value: '96 min', hot: true },
        { label: 'Dane zrzucone na dysk zdalny', value: '80 GB', hot: true }
      ],
      outcomes: {
        none: { fit: 'bad', metrics: [['Czas modelu', '96 min'], ['Zrzut na dysk', '80 GB'], ['Koszt przebiegu', '6,4 kredytu']], verdict: 'Kolejki nie ma, więc nikt nie przeszkadza. Zapytaniu brakuje pamięci: dane pośrednie nie mieszczą się i są zrzucane na dysk (spilling), co jest wielokrotnie wolniejsze niż praca w pamięci.' },
        up: { fit: 'good', metrics: [['Czas modelu', '30 min'], ['Zrzut na dysk', '0 GB'], ['Koszt przebiegu', '4 kredyty']], verdict: 'Większy warehouse ma więcej pamięci, więc zrzut na dysk znika. Stawka jest dwa razy wyższa, ale przebieg ponad trzy razy krótszy: 30 min × 8 kredytów/h to mniej niż 96 min × 4 kredyty/h. To jest <b>skalowanie w górę</b> (scale up) tam, gdzie pasuje.' },
        out: { fit: 'bad', metrics: [['Czas modelu', '96 min'], ['Zrzut na dysk', '80 GB'], ['Koszt przebiegu', '6,4 kredytu']], verdict: 'Dodatkowe klastry obsługują dodatkowe zapytania, a nie przyspieszają jednego. To zapytanie nadal działa na jednym klastrze rozmiaru M i nadal brakuje mu pamięci.' },
        split: { fit: 'partial', metrics: [['Czas modelu', '96 min'], ['Zrzut na dysk', '80 GB'], ['Koszt przebiegu', '6,4 kredytu']], verdict: 'Osobny warehouse chroni innych przed tym modelem, ale jego samego nie przyspiesza. Dobry ruch to połączenie: własny, większy warehouse tylko na czas tego modelu. Lepszy to najpierw sprawdzić, czy model musi czytać trzy lata za każdym razem.' }
      }
    }
  ] as WorkloadCase[],
  takeaway: '<b>Wniosek.</b> Najpierw objaw, potem lekarstwo. Długa kolejka przy krótkim wykonaniu znaczy, że za dużo zapytań chce działać naraz (problem równoczesności, concurrency). Pomaga skalowanie wszerz albo rozdzielenie obciążeń. Długie wykonanie ze zrzutem na dysk to problem jednego zapytania. Pomaga większa maszyna albo mniej danych do przeczytania. Większy rozmiar bez diagnozy to płacenie więcej za ten sam problem.',
  more: {
    title: 'Gdzie te objawy widać w Snowflake',
    html: [
      'Widok <code>QUERY_HISTORY</code> ma osobne kolumny na czas w kolejce z powodu przeciążenia (<code>QUEUED_OVERLOAD_TIME</code>) i na dane zrzucone na dysk lokalny i zdalny (<code>BYTES_SPILLED_TO_LOCAL_STORAGE</code>, <code>BYTES_SPILLED_TO_REMOTE_STORAGE</code>). Te dwie liczby rozróżniają oba przypadki z symulacji.',
      'Dokumentacja Snowflake mówi wprost: zmiana rozmiaru służy głównie przyspieszaniu zapytań, zwłaszcza dużych i złożonych, a warehouse wieloklastrowy obsłudze równoczesności. Na zrzut na dysk zaleca większy warehouse albo przetwarzanie danych w mniejszych paczkach.',
      'Warehouse wieloklastrowy wymaga edycji Enterprise. Każdy rozmiar w górę podwaja zasoby i stawkę. Rozliczenie jest sekundowe, z minimum 60 sekund po każdym starcie, więc automatyczne wyłączanie po bezczynności jest najprostszą kontrolą kosztu.',
      'Limit wydatków ustawia się monitorem zasobów, który po wyczerpaniu puli kredytów wysyła powiadomienie albo wstrzymuje warehouse.'
    ]
  } as More
};

/** Skalowanie pionowe i poziome oraz podstawy przetwarzania rozproszonego, bez szczegółów silnika. */
export const distributed = {
  title: 'Dlaczego dołożenie maszyn nie zawsze pomaga?',
  intro: 'Skalowanie <b>w górę</b> (pionowe, scale up) to większa maszyna. Proste, ale kończy się na największej dostępnej. Skalowanie <b>wszerz</b> (poziome, scale out) to więcej maszyn. Nie ma twardej granicy, ale pomaga tylko wtedy, gdy pracę da się podzielić.',
  points: [
    '<b>Podział pracy.</b> Dane dzieli się na części, każdą liczy osobna maszyna, a koordynator składa wynik. Filtr albo proste przekształcenie skaluje się niemal liniowo, bo części nie muszą nic o sobie wiedzieć.',
    '<b>Przegrupowanie.</b> Join i <code>GROUP BY</code> wymagają, żeby wiersze z tym samym kluczem spotkały się w jednym miejscu, więc dane trzeba przesłać między maszynami. To zwykle najdroższy krok i rośnie razem z danymi.',
    '<b>Nierówny podział.</b> Jeśli jeden klient ma połowę zdarzeń, jedna część jest ogromna i jedna maszyna pracuje za wszystkie. Dziesięć kolejnych maszyn nic nie zmieni.',
    '<b>Część, której nie da się podzielić.</b> Koordynacja, końcowe sortowanie, zapis do jednego miejsca. Im więcej maszyn, tym większą część czasu zajmuje to, czego nie da się robić równolegle.'
  ],
  takeaway: '<b>Wniosek.</b> Skalowanie wszerz przesuwa granicę, ale jej nie usuwa: wąskim gardłem staje się przesyłanie danych, nierówny podział albo krok, który musi być jeden. W Snowflake większość tego jest schowana przed użytkownikiem, w Sparku jest widoczna i sterowalna.',
  more: {
    title: 'Powiązanie z lekcjami o Sparku',
    html: [
      'To są te same zjawiska, które lekcje o Sparku pokazują na konkretnym silniku: podział na partycje, shuffle jako przegrupowanie po kluczu i data skew jako nierówny podział.',
      'Na rozmowie o projektowaniu platformy wystarczy poziom z tej sekcji: nazwać trzy powody, dla których dodanie maszyn nie daje liniowego przyspieszenia, i powiedzieć, jak sprawdzić, który z nich działa.'
    ]
  } as More
};

/** Planowanie pojemności: prosty rachunek na liczbach przykładu. Każdy wiersz wynika z poprzednich (pilnuje tego test). */
export const capacity = {
  title: 'Ile tego będzie za rok?',
  intro: 'Planowanie pojemności (capacity planning) to prosty rachunek na kartce, który robisz przed wyborem narzędzi. Na rozmowie pokazuje, że najpierw pytasz o ilość danych, a dopiero potem rysujesz architekturę.',
  inputs: { users: 2_000_000, eventsPerUser: 40, bytesPerEvent: 500, peakFactor: 3 },
  columns: ['Krok', 'Rachunek', 'Wynik'],
  rows: [
    ['Zdarzenia dziennie', '2 mln użytkowników × 40 zdarzeń', '80 mln'],
    ['Surowe dane dziennie', '80 mln × 0,5 KB', '40 GB'],
    ['Surowe dane rocznie', '40 GB × 365', '14,6 TB przed kompresją'],
    ['Średnio na sekundę', '80 mln ÷ 86 400 s', 'ok. 930 zdarzeń/s'],
    ['Wieczorny szczyt', '930 × 3', 'ok. 2 800 zdarzeń/s']
  ],
  assumptions: 'Liczby wymyślone dla przykładu. Współczynnik szczytu 3 to założenie: serwis wideo ma wieczorem wielokrotnie większy ruch niż średnio.',
  takeaway: '<b>Wniosek.</b> Z tego rachunku wynikają trzy decyzje. Rozmiar danych mówi, czy pełne przeliczanie jest w ogóle możliwe. Szczyt, a nie średnia, mówi, ile musi wytrzymać przyjmowanie zdarzeń. Tempo wzrostu mówi, kiedy dzisiejsze rozwiązanie przestanie wystarczać.'
};

/** Trzy modele izolacji klientów (tenantów) na jednej platformie. */
export const tenants: Compare & { title: string; intro: string; takeaway: string } = {
  title: 'Jedna platforma, wielu klientów. Jak ich rozdzielić?',
  intro: 'Załóżmy, że platforma zaczyna obsługiwać nie jeden serwis wideo, lecz 200 wydawców, a każdy ma widzieć tylko swoje dane. Każdy taki klient to <b>tenant</b>. Trzy sposoby rozdzielenia:',
  label: 'Model izolacji',
  assumptions: 'Porównanie ogólne, bez pomiarów. Nazwy obiektów ze Snowflake są tu przykładami.',
  defaultId: 'shared',
  options: [
    {
      id: 'shared', label: 'Wspólne tabele',
      rows: [
        ['Jak wygląda', 'Jedna tabela dla wszystkich, kolumna <code>tenant_id</code> i polityka, która filtruje wiersze według roli'],
        ['Izolacja danych', 'Tylko logiczna: dane leżą razem, a rozdziela je filtr. Błąd w polityce albo zapytanie, które omija filtr, pokazuje cudze dane'],
        ['Głośny sąsiad', 'Duży klient spowalnia wszystkich, jeśli dzielą zasoby obliczeniowe'],
        ['Koszt utrzymania', 'Najniższy: jeden schemat, jedno wdrożenie, jedna migracja'],
        ['Koszt na klienta', 'Trudny do wyliczenia bez dodatkowego tagowania zapytań']
      ],
      verdict: 'Skaluje się do tysięcy małych klientów. Wymaga dyscypliny: filtr po kliencie musi być wymuszony przez platformę, a nie pamiętany przez autorów zapytań.'
    },
    {
      id: 'schema', label: 'Schemat lub baza na klienta',
      rows: [
        ['Jak wygląda', 'Te same tabele powielone w osobnym schemacie albo bazie dla każdego klienta, opcjonalnie z osobnym warehouse\'em'],
        ['Izolacja danych', 'Mocniejsza: uprawnienia nadawane na cały schemat, trudniej o przeciek przez błąd w zapytaniu'],
        ['Głośny sąsiad', 'Do opanowania, jeśli duzi klienci dostają własny warehouse'],
        ['Koszt utrzymania', 'Rośnie z liczbą klientów: każda zmiana schematu to 200 wdrożeń, które trzeba zautomatyzować'],
        ['Koszt na klienta', 'Łatwy do wyliczenia przy osobnych warehouse\'ach']
      ],
      verdict: 'Rozsądny środek dla dziesiątek lub setek klientów o różnej wielkości. Bez automatyzacji wdrożeń zamienia się w ręczne utrzymywanie 200 kopii.'
    },
    {
      id: 'account', label: 'Osobne konto na klienta',
      rows: [
        ['Jak wygląda', 'Każdy klient ma własne konto albo własną instalację platformy'],
        ['Izolacja danych', 'Najmocniejsza, także administracyjnie i co do regionu przechowywania'],
        ['Głośny sąsiad', 'Nie występuje'],
        ['Koszt utrzymania', 'Najwyższy: osobne wdrożenia, monitoring i uprawnienia dla każdego konta'],
        ['Koszt na klienta', 'Osobna faktura z definicji']
      ],
      verdict: 'Uzasadnione, gdy wymaga tego umowa albo regulacja, np. dane muszą zostać w konkretnym kraju. Dla 200 małych klientów to koszt bez korzyści.'
    }
  ],
  takeaway: '<b>Wniosek.</b> Wybór zależy od trzech pytań: jak mocnej izolacji wymaga umowa, jak bardzo klienci różnią się wielkością i ile kopii platformy zespół jest w stanie utrzymać. Często kończy się hybrydą: mali klienci we wspólnych tabelach, kilku największych osobno.'
};

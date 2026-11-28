import * as lesson from '../snowflake/architecture/lesson';
import { deeper, figure, h3, known, list, p, sql, steps, table, warn } from './blocks';
import type { KbChapter } from './types';

/**
 * Knowledge Base, rozdział: Snowflake Architecture & Performance Engineering.
 *
 * Zakres jest ten sam co w lekcji 10, ale to osobny tekst: podręcznik do czytania i powtórek, bez interakcji.
 * Dane przykładów (operacje i warstwy, osiem mikropartycji, statystyki Query Profile, model skalowania, zasięg
 * monitorów i budżetów, okresy retencji, kroki klonowania, hierarchia ról, tabele porównawcze, zapytania SQL)
 * są importowane z lekcji, żeby oba materiały pokazywały te same liczby. Proza jest napisana od nowa.
 *
 * Skąd są fakty: docs/verified-facts.md, sekcja „Lekcja 10". Rozdział nie wprowadza nowych faktów.
 * Repozytorium nie ma konta Snowflake, więc rozdział NIE PODAJE pomiarów. Liczby w ilustracjach i tabelach są
 * dobrane do przykładu i tak są podpisane. Liczby z dokumentacji są podpisane jako liczby z dokumentacji.
 * Z prawdziwego projektu pochodzą tylko trzy liczby w części o metodzie: 96 godzin, 128 i 30 minut.
 * Liczby wyliczane poniżej z danych lekcji sprawdza test chapter.test.ts.
 *
 * Kod SQL ma linie do 44 znaków, żeby w PDF na telefon nie trzeba było go zawijać (pilnuje tego test).
 */

const op = (id: string) => lesson.layers.ops.find(o => o.id === id)!;
/** Tekst warstwy w ilustracji: własny opis, ale o tym, czy warstwa w ogóle pracuje, decyduje model lekcji. */
const layer = (fromLesson: string, text: string) => (fromLesson ? text : lesson.layers.idle);
const layout = (id: string) => lesson.prune.layouts.find(l => l.id === id)!;
const filter = (id: string) => lesson.prune.filters.find(f => f.id === id)!;
const overlaps = ([min, max]: [number, number], [from, to]: [number, number]) => min <= to && max >= from;
const thousands = (n: number) => String(n).replace(/\B(?=(\d{3})+$)/g, ' ');
const num = (n: number) => String(Math.round(n * 100) / 100).replace('.', ',');
const days = (n: number) => (n === 1 ? '1 dzień' : `${n} dni`);
/** Strzałek nie ma w czcionkach osadzanych w PDF (weszłaby czcionka zastępcza), więc etykiety z lekcji dostają słowa. */
const noArrow = (text: string, word: string) => text.replace(/ → /g, ` ${word} `);

/* ---- pruning: te same osiem mikropartycji co w lekcji ---- */

const dayUnits = Array.from({ length: 24 }, (_, i) => String(i + 1));
const dateLayouts = ['load', 'churn', 'clustered'].map(layout);
const dateNotes = ['zakresy dat się nie nakładają', 'zakresy dat nachodzą na siebie', 'każda mikropartycja ma wszystkie dni'];
const customer = filter('cust').range;
const custRange = (id: string, i: number) => {
  const range = layout(id).parts[i].cust;
  const text = `${thousands(range[0])} – ${thousands(range[1])}`;
  return overlaps(range, customer) ? `<b>${text}</b>` : text;
};
const custScanned = (id: string) => layout(id).parts.filter(part => overlaps(part.cust, customer)).length;
const dateScanned = (id: string, filterId: string) => layout(id).parts.filter(part => overlaps(part.date, filter(filterId).range)).length;

/* ---- Query Profile: statystyki czterech scenariuszy lekcji ---- */

const profile = (id: string) => lesson.profiles.cases.find(c => c.id === id)!;
const stats = (id: string) =>
  table(
    ['Statystyka', 'Wartość'],
    profile(id).stats.map(s => [noArrow(s.name, 'i'), noArrow(s.value, 'i')]).map((row, i) => (profile(id).stats[i].flag ? row.map(cell => `<b>${cell}</b>`) : row)),
    'Ilustracja: wartości wymyślone.'
  );

/* ---- skalowanie: kredyty = stawka × liczba klastrów × czas ---- */

const workload = (id: string) => lesson.scale.workloads.find(w => w.id === id)!;
const credits = (o: lesson.ScaleOutcome) => (o.rate * o.clusters * o.minutes) / 60;
const actionLabel = (id: lesson.ScaleOutcome['action']) => noArrow(lesson.scale.actions.find(a => a.id === id)!.label, 'na');
const scaleRows = (id: string) => workload(id).outcomes.map(o => [actionLabel(o.action), `${o.clusters} × ${o.size}`, `${o.minutes} min`, num(credits(o))]);
const run = (n: number) => `${n} ${n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14) ? 'działają' : 'działa'}`;
const waveSteps = (o: lesson.ScaleOutcome) => {
  const total = o.waves.reduce((a, b) => a + b, 0);
  let done = 0;
  return o.waves.map((n, i) => {
    done += n;
    const waiting = total - done;
    return { name: `Minuta ${i + 1}`, where: waiting ? `${run(n)}, ${waiting} czeka` : `${run(n)}, nikt nie czeka`, hot: waiting > 0 };
  });
};
const many = workload('many').outcomes;
const rates = lesson.scale.sizes.map(([size, rate]) => `${size} ${rate}`).join(', ');
const rate = (size: string) => lesson.scale.sizes.find(s => s[0] === size)![1];

/* ---- koszty: co widzi resource monitor, a co budżet ---- */

const sees = (yes: boolean) => (yes ? 'widzi' : '<b>nie widzi</b>');

/* ---- stream: ten sam cykl co w symulacji lekcji, rozpisany krok po kroku ---- */

interface StreamState { version: number; offset: number; inserts: number; updated: boolean }
const pending = (s: StreamState) => s.inserts + (s.updated ? 2 : 0);
const streamStep = (s: StreamState, action: lesson.StreamAction): StreamState => {
  if (action === 'insert') return { ...s, version: s.version + 1, inserts: s.inserts + 1 };
  if (action === 'update') return { ...s, version: s.version + 1, updated: true };
  if (action === 'select' || !pending(s)) return s;
  return { version: s.version, offset: s.version, inserts: 0, updated: false };
};
const streamWalk: { action: lesson.StreamAction; what: string }[] = [
  { action: 'insert', what: 'INSERT nowego wiersza' },
  { action: 'update', what: 'UPDATE wiersza, który już był w tabeli' },
  { action: 'update', what: 'Drugi UPDATE tego samego wiersza' },
  { action: 'select', what: '<code>SELECT * FROM orders_stream</code>' },
  { action: 'task', what: 'Task wykonuje MERGE i zatwierdza transakcję' },
  { action: 'task', what: 'Następne uruchomienie taska' }
];
const streamRows = (() => {
  let state: StreamState = { version: 1, offset: 1, inserts: 0, updated: false };
  return streamWalk.map(({ action, what }) => {
    const skipped = action === 'task' && !pending(state);
    state = streamStep(state, action);
    return [what, `v${state.version}`, `v${state.offset}`, skipped ? '0, uruchomienie pominięte' : String(pending(state))];
  });
})();

/* ---- Time Travel, Fail-safe i klony ---- */

const retention = lesson.history.types;
const paidDays = (t: lesson.RetentionType) => t.travel + t.failsafe;
const retentionSteps = (t: lesson.RetentionType) => [
  { name: lesson.history.phases.travel.name, where: `${t.travel === 1 && !t.failsafe ? 'najwyżej ' : ''}${days(t.travel)} · odzyskujesz sam`, hot: true },
  ...(t.failsafe ? [{ name: lesson.history.phases.failsafe.name, where: `${days(t.failsafe)} · tylko Snowflake`, hot: false }] : []),
  { name: lesson.history.phases.gone.name, where: lesson.history.phases.gone.who, hot: false }
];
const cloneStored = (s: lesson.CloneStep) => new Set([...s.source, ...s.clone]).size;

/* ---- role: dwie gałęzie przykładowej hierarchii ---- */

const role = (id: string) => lesson.access.roles.find(r => r.id === id)!;
/** Znak o zerowej szerokości po podkreślniku pozwala złamać długą nazwę roli w wąskiej kolumnie ilustracji. */
const breakable = (name: string) => name.replace(/_/g, '_\u200b');
const branch = (label: string, ids: string[]) => ({ label, layers: ids.map(id => ({ name: breakable(role(id).label), text: role(id).grants.join(', ') })) });

export const snowflakeArchitecturePerformance: KbChapter = {
  id: 'snowflake-architecture-performance',
  area: 'snowflake',
  title: 'Snowflake Architecture & Performance Engineering',
  subtitle: 'Co dzieje się pod spodem, gdy uruchamiasz zapytanie: trzy warstwy, mikropartycje, cache i skalowanie. Oraz co z tego wynika dla kosztów, diagnozy wolnych zapytań i funkcji produkcyjnych.',
  lessonId: lesson.meta.id,
  checked: '2026-11-27',
  lead: [
    `Snowflake da się używać latami bez wiedzy o tym, co jest w środku. Ten rozdział jest dla kogoś, kto chce umieć wytłumaczyć mechanizm: dlaczego jedno zapytanie jest szybkie, a prawie takie samo wolne, za co naprawdę płacisz i skąd biorą się Time Travel, klony czy streamy.`,
    `Kolejność: architektura, dwa pytania o wydajność (jak przeczytać mniej i jak nie czytać drugi raz tego samego), diagnoza wolnego zapytania i skalowanie, a na końcu koszty i funkcje produkcyjne.`,
    `Fakty pochodzą z dokumentacji Snowflake, a nieliczne rzeczy podane z praktyki są tak oznaczone. Rozdział nie zawiera pomiarów: liczby w ilustracjach i przykładach są dobrane tak, żeby mechanizm było widać. Liczby z dokumentacji są tak podpisane.`
  ],
  sections: [
    {
      id: 'trzy-warstwy',
      title: 'Trzy warstwy: kto wykonuje który kawałek zapytania',
      blocks: [
        p(`Tabela <code>orders</code> trzyma zamówienia z kilku lat. Na tym samym warehouse, tego samego dnia, ktoś uruchamia dwa zapytania. Pierwsze filtruje po dacie:`),
        sql(`${op('date').sql};`),
        p(`Drugie po kliencie:`),
        sql(`${op('cust').sql};`),
        p(`Przyjmijmy, że pierwsze wraca po 3 sekundach, a drugie po 9 minutach. To scenariusz, a nie pomiar. SQL jest prawie identyczny. Żeby wyjaśnić różnicę, trzeba wiedzieć, która część Snowflake wykonuje który kawałek zapytania.`),
        p(`Snowflake składa się z trzech warstw. Każda robi co innego.`),
        list(
          `<b>Database storage</b> przechowuje dane. Po załadowaniu Snowflake przepisuje je na własny format: skompresowany i kolumnowy, czyli taki, w którym każda kolumna jest zapisana osobno. Dane leżą w <b>object storage</b> dostawcy chmury, czyli w chmurowym magazynie plików.`,
          `<b>Compute</b> wykonuje zapytania. Robi to <b>virtual warehouse</b>, w skrócie warehouse: klaster maszyn, który czyta dane i liczy wynik. Według dokumentacji każdy warehouse jest niezależnym klastrem i nie dzieli zasobów obliczeniowych z innymi.`,
          `<b>Cloud services</b> to warstwa, która wszystkim kieruje. Sprawdza, kim jesteś i co Ci wolno. Parsuje zapytanie i układa plan jego wykonania. Trzyma też <b>metadane</b>, czyli zapisane informacje o danych: jakie są tabele, z jakich fragmentów się składają i jakie wartości są w każdym fragmencie.`
        ),
        p(`Zobaczmy, jak te warstwy dzielą się pracą przy trzech zapytaniach: dwóch z początku i pierwszym uruchomionym jeszcze raz.`),
        figure(`Ilustracja. Uproszczony podział pracy między warstwy dla trzech zapytań. Nazwy i role warstw pochodzą z dokumentacji, reszta jest dobrana do przykładu.`, {
          kind: 'stacks',
          columns: [
            {
              label: op('date').label,
              layers: [
                { name: 'Cloud services', text: layer(op('date').services, 'Sprawdza uprawnienia, układa plan i na podstawie metadanych wskazuje kilka fragmentów tabeli.') },
                { name: 'Compute', text: layer(op('date').compute, 'Czyta tylko wskazane fragmenty, a w nich tylko dwie kolumny. Sumuje.') },
                { name: 'Storage', text: layer(op('date').storage, 'Oddaje kilka plików z tysięcy.') }
              ]
            },
            {
              label: op('cust').label,
              layers: [
                { name: 'Cloud services', text: layer(op('cust').services, 'Robi to samo, ale żadnego fragmentu nie da się wykluczyć.') },
                { name: 'Compute', text: layer(op('cust').compute, 'Czyta wszystkie fragmenty tabeli, filtruje wiersz po wierszu, sumuje.') },
                { name: 'Storage', text: layer(op('cust').storage, 'Oddaje wszystkie pliki tabeli.') }
              ]
            },
            {
              label: op('repeat').label,
              layers: [
                { name: 'Cloud services', text: layer(op('repeat').services, 'Znajduje zapisany wynik identycznego zapytania. Dane się nie zmieniły, więc oddaje go bez wykonywania zapytania.') },
                { name: 'Compute', text: layer(op('repeat').compute, '') },
                { name: 'Storage', text: layer(op('repeat').storage, '') }
              ]
            }
          ]
        }),
        p(`Pierwsze dwie kolumny wyjaśniają zagadkę. Warehouse jest ten sam, różni się ilość pracy, którą dostał. Przy filtrze po dacie metadane pozwoliły wskazać kilka fragmentów tabeli. Przy filtrze po kliencie nie pomogły, bo zamówienia jednego klienta są rozsiane po całej historii, więc warehouse przeczytał wszystko. Dokładny mechanizm opisuje część o mikropartycjach.`),
        p(`Trzecia kolumna pokazuje coś innego: wynik przyszedł bez pracy warehouse. To nie jest szybkie zapytanie, tylko zapytanie, którego nie wykonano. Ten mechanizm ma własną część, o cache.`),
        p(`Są też skrajności. Instrukcja <code>${op('meta').sql}</code>, czyli usunięcie wszystkich wierszy tabeli, to według dokumentacji operacja na samych metadanych: niczego nie trzeba czytać ani przepisywać. Na drugim końcu jest duży join z grupowaniem, bez filtra. Metadane nie mają tu czego wykluczyć, więc prawie całą pracę wykonuje warehouse, a o czasie decyduje jego rozmiar i to, czy operacja mieści się w pamięci.`),
        p(`Wniosek jest jeden: nie każda operacja potrzebuje wszystkich trzech warstw, a o tym, ile pracy dostanie warehouse, decyduje wcześniej cloud services na podstawie metadanych.`),
        deeper(
          'Co dokładnie mówi dokumentacja',
          `Lista zadań cloud services z dokumentacji jest dłuższa: bezpieczeństwo, uwierzytelnianie i kontrola dostępu, Horizon Catalog, zarządzanie infrastrukturą, zarządzanie metadanymi, parsowanie i optymalizacja zapytań oraz zgodność z regulacjami.`,
          `Całą architekturę dokumentacja nazywa hybrydą dwóch klasycznych podejść. Z <b>shared-disk</b> pochodzi jedno centralne miejsce na dane, dostępne dla wszystkich klastrów. Z <b>shared-nothing</b> pochodzi sposób liczenia: zapytanie wykonuje klaster, w którym każdy węzeł pracuje na swojej części danych.`,
          `Opis storage dotyczy zwykłych tabel Snowflake. Tabele Iceberg trzymają dane w storage zewnętrznym.`
        )
      ]
    },
    {
      id: 'rozdzielenie-storage-compute',
      title: 'Storage i compute to dwa osobne zasoby',
      blocks: [
        p(`W klasycznej hurtowni na własnych serwerach dane leżą na dyskach tych samych maszyn, które liczą. Chcesz więcej mocy? Dokładasz maszyny i przenosisz na nie część danych. Wyłączasz klaster na noc? Dane są niedostępne. Miejsce na dane i moc obliczeniowa są jednym zasobem.`),
        p(`W Snowflake dane leżą raz, w warstwie storage. Warehouse'ów może być dowolnie wiele i każdy czyta tę samą kopię. Wynikają z tego trzy rzeczy, które w codziennej pracy wydają się oczywiste.`),
        list(
          `<b>Zespoły nie przeszkadzają sobie nawzajem.</b> Ładowanie danych, dashboardy i analizy ad hoc mogą mieć osobne warehouse'y i nie odbierają sobie mocy. To <b>izolacja obciążeń</b> (workload isolation).`,
          `<b>Moc zmieniasz bez ruszania danych.</b> Zmiana rozmiaru warehouse'u niczego nie przenosi.`,
          `<b>Płacisz osobno.</b> Snowflake rozlicza moc obliczeniową w <b>kredytach</b>. Wstrzymany warehouse ich nie zużywa, a dane dalej są w storage.`
        ),
        p(`Jest też cena. Warehouse nie ma danych u siebie. Każdą porcję, której potrzebuje, musi pobrać z object storage. Lokalnie ma tylko cache, czyli podręczną kopię tego, co już pobrał, a ten cache znika przy wstrzymaniu. Wydajność zależy więc od tego, ile danych trzeba ściągnąć.`),
        p(`Dlatego reszta rozdziału krąży wokół dwóch pytań. <b>Jak przeczytać mniej?</b> I: <b>jak nie czytać drugi raz tego samego?</b>`),
        h3('Compute, którego nie tworzysz sam'),
        p(`Nie cała moc obliczeniowa to Twoje warehouse'y. Obok nich jest <b>compute serverless</b>: zasoby, którymi zarządza Snowflake. Korzystają z nich między innymi Snowpipe (ciągłe ładowanie plików), automatic clustering, utrzymanie materialized views, search optimization, query acceleration i zadania serverless. Każda z tych funkcji ma osobną pozycję na rachunku.`),
        p(`Warstwa cloud services też zużywa kredyty. Jest jednak doliczana tylko wtedy, gdy jej dzienne zużycie przekroczy 10% dziennego zużycia warehouse'ów. To liczba z dokumentacji.`),
        p(`Obie pozycje wrócą w części o kosztach, bo narzędzie, które pilnuje warehouse'ów, nie widzi serverless.`),
        known(
          'Jeśli znasz klasyczną hurtownię MPP',
          `MPP (massively parallel processing) to hurtownia z wielu serwerów, z których każdy ma własny dysk i liczy własny fragment danych. Snowflake zachowuje z tego równoległe liczenie, ale dane wynosi do jednego wspólnego miejsca. Klastry obliczeniowe stają się wymienne: tworzysz je, powiększasz i wstrzymujesz bez dotykania danych.`,
          `Gdzie porównanie się kończy: w MPP dane leżą fizycznie przy procesorze, więc odczyt jest lokalny. W Snowflake lokalny jest tylko cache warehouse'u.`
        )
      ]
    },
    {
      id: 'mikropartycje-pruning',
      title: 'Mikropartycje i pruning: jak przeczytać mniej',
      blocks: [
        p(`Najtańsze dane to te, których warehouse w ogóle nie pobierze. Żeby coś pominąć, silnik musi z góry wiedzieć, że w danym kawałku tabeli szukanych wierszy na pewno nie ma.`),
        p(`Snowflake sam tnie każdą tabelę na kawałki. Taki kawałek to <b>mikropartycja</b>: porcja wierszy zapisana jako jedna całość, w kolejności ładowania. Według dokumentacji mieści od 50 do 500 MB danych przed kompresją. Niczego nie deklarujesz i mikropartycji nie widać w zapytaniu. Tabela na terabajty ma ich setki tysięcy.`),
        p(`Dla każdej mikropartycji warstwa cloud services pamięta między innymi <b>najmniejszą i największą wartość każdej kolumny</b>. To wystarcza, żeby pomijać dane. Jeśli w mikropartycji są zamówienia z 1–3 stycznia, a szukasz 14 stycznia, nie trzeba jej otwierać.`),
        p(`Weźmy osiem mikropartycji tabeli zamówień z 1–24 stycznia 2026 i filtr z początku rozdziału: <code>order_date = '2026-01-14'</code>. Te same dane mogą być ułożone na trzy sposoby.`),
        figure(`Ilustracja. Osiem mikropartycji zamiast setek tysięcy, z zakresem dni stycznia 2026. To model, nie pomiar.`, {
          kind: 'partitions',
          units: dayUnits,
          filter: { label: `Filtr: order_date = 14 stycznia`, range: filter('day').range },
          layouts: dateLayouts.map((l, i) => ({ label: l.label, note: dateNotes[i], parts: l.parts.map(part => part.date) })),
          legend: { read: 'czytana', skipped: 'pominięta', count: 'czytane mikropartycje' }
        }),
        p(`Mikropartycja jest czytana, gdy 14 stycznia mieści się między jej minimum a maksimum. Filtr we wszystkich trzech wierszach jest ten sam. Różni się tylko fizyczne ułożenie danych.`),
        list(
          `<b>Dane ładowane dzień po dniu.</b> Każda mikropartycja zawiera trzy kolejne dni, więc zakresy się nie nakładają. Czytana jest ${dateScanned('load', 'day')} z 8.`,
          `<b>Po backfillach i poprawkach.</b> Dogrywanie zaległych danych zapisało nowe mikropartycje z dniami z różnych okresów. Zakresy zaczęły się nakładać i 14 stycznia mieści się już w ${dateScanned('churn', 'day')} z 8.`,
          `<b>Dane uporządkowane po kliencie.</b> Każda mikropartycja zawiera zamówienia ze wszystkich dni, więc filtr po dacie niczego nie wyklucza: ${dateScanned('clustered', 'day')} z 8.`
        ),
        p(`To pomijanie mikropartycji na podstawie metadanych, zanim warehouse cokolwiek przeczyta, nazywa się <b>partition pruning</b>. Dla filtra po zakresie zasada jest ta sama: mikropartycja zostaje, gdy jej zakres ma choć jeden wspólny dzień z zakresem filtra. Dla sześciu dni, 10–15 stycznia, w pierwszym ułożeniu czytane są ${dateScanned('load', 'range')} mikropartycje, w drugim ${dateScanned('churn', 'range')}.`),
        h3('Dlaczego filtr po kliencie czyta wszystko'),
        p(`Teraz drugie zapytanie z początku: <code>customer_id = ${customer[0]}</code>. O pruningu decyduje tu zakres <code>customer_id</code> w każdej mikropartycji. Klienci mają numery od 1 do 10 000.`),
        table(
          ['Mikropartycja', layout('load').label, layout('clustered').label],
          [
            ...layout('load').parts.map((_, i) => [String(i + 1), custRange('load', i), custRange('clustered', i)]),
            ['Do przeczytania', `<b>${custScanned('load')} z 8</b>`, `<b>${custScanned('clustered')} z 8</b>`]
          ],
          `Ilustracja: zakres customer_id w każdej z ośmiu mikropartycji. Pogrubione zakresy obejmują ${customer[0]}, więc tych mikropartycji nie da się pominąć. Dane wymyślone.`
        ),
        p(`Gdy dane przychodziły dzień po dniu, w każdej mikropartycji są klienci z prawie całego zakresu numerów. Numer ${customer[0]} mieści się między minimum a maksimum każdej z nich, więc żadnej nie da się wykluczyć. I to nawet wtedy, gdy tego klienta w danej mikropartycji wcale nie ma. Zakres mówi tylko „może tu być”, a filtr jest stosowany jeszcze raz po odczycie.`),
        p(`Gdy te same dane są uporządkowane po kliencie, zakresy <code>customer_id</code> są rozłączne i wystarczy jedna mikropartycja. Ale wtedy, jak widać na ilustracji wyżej, przestaje działać pruning po dacie.`),
        p(`To jest odpowiedź na zagadkę 3 sekund i 9 minut. Sam filtr w <code>WHERE</code> nie wystarczy. Liczy się to, jak wartości kolumny z filtra są rozłożone po mikropartycjach.`),
        h3('Trzy zastrzeżenia'),
        list(
          `<b>Nie każdy warunek pozwala pomijać.</b> Dokumentacja mówi ogólnie, że nie wszystkie wyrażenia w <code>WHERE</code> nadają się do pruningu. Wprost wymienia jedno: Snowflake nie pomija mikropartycji na podstawie warunku z podzapytaniem, nawet gdy podzapytanie zwraca stałą. Filtr <code>order_date = (SELECT MAX(order_date) FROM orders)</code> przeczyta więc wszystko.`,
          `<b>Ideał to nie gwarancja.</b> Dokumentacja podaje wzorzec: filtr, który wybiera 10% wartości, powinien w idealnym przypadku skanować około 10% mikropartycji.`,
          `<b>Metadanych jest więcej niż minimum i maksimum.</b> Dokumentacja wymienia też liczbę różnych wartości i dodatkowe własności używane do optymalizacji. Lista jest podana jako niepełna, a ilustracja pokazuje tylko najprostszą regułę: zakresy się przecinają albo nie.`
        ),
        known(
          'Jak to sprawdzić na prawdziwym zapytaniu',
          `Po wykonaniu zapytania Snowflake pokazuje jego przebieg w widoku Query Profile. Przy odczycie tabeli są tam dwie liczby: <code>Partitions scanned</code> i <code>Partitions total</code>. To jest licznik z ilustracji. Jeśli filtr powinien wybierać mały kawałek tabeli, a obie liczby są prawie równe, pruning nie działa.`
        ),
        h3('Zapis kolumnowy i kompresja: druga oszczędność'),
        p(`W mikropartycji każda kolumna jest zapisana osobno. Zapytanie, które używa dwóch kolumn z pięćdziesięciu, czyta z każdej mikropartycji tylko te dwie. Oszczędności są więc dwie: pruning zmniejsza liczbę czytanych mikropartycji, a zapis kolumnowy zmniejsza to, co czyta się w każdej z nich.`),
        p(`Każda kolumna jest też osobno kompresowana. Algorytm Snowflake dobiera sam, dla każdej kolumny w każdej mikropartycji. Wartości jednej kolumny są do siebie podobne, więc kompresują się dobrze. Koszt storage liczy się od danych po kompresji.`),
        p(`Skutek uboczny: <code>SELECT *</code> na szerokiej tabeli czyta wszystkie kolumny, nawet jeśli potrzebujesz trzech.`),
        h3('Co się dzieje przy UPDATE i DELETE'),
        p(`Snowflake nie poprawia mikropartycji w miejscu. Zmiana wiersza zapisuje nową mikropartycję z nową wersją danych, a stara przestaje należeć do bieżącej wersji tabeli. Stara nie znika od razu: zostaje jeszcze przez pewien czas, o którym będzie część o Time Travel. To wiedza ogólna o Snowflake. Dokumentacja opisuje to wprost tylko przy porządkowaniu danych w tle: oryginalne mikropartycje są oznaczane jako usunięte, ale zostają w systemie.`),
        p(`Częste zmiany w dużej tabeli mają więc dwa skutki. Rośnie storage ze starymi wersjami danych. Psuje się też naturalne uporządkowanie, dzięki któremu działał pruning. Drugi wiersz ilustracji, „Po backfillach i poprawkach”, pokazuje właśnie to.`),
        p(`Ten sam mechanizm wróci przy streamach, Time Travel i klonach.`),
        known(
          'Jeśli znasz Parquet',
          `Plik Parquet dzieli wiersze na grupy (row groups) i może trzymać minimum i maksimum każdej kolumny dla każdej grupy. Czytnik pomija grupy, w których według statystyk szukanych wierszy nie ma. Mikropartycja pełni podobną rolę i zasada jest ta sama: posortowane dane da się dobrze pomijać, rozrzuconych wcale.`,
          `Gdzie porównanie się kończy: w Sparku statystyki są w stopkach plików, a o formacie, rozmiarze plików i partycjonowaniu decydujesz sam. W Snowflake metadane trzyma warstwa cloud services i używa ich jeszcze przed wykonaniem zapytania, a mikropartycji nie definiujesz.`
        )
      ]
    },
    {
      id: 'clustering',
      title: 'Clustering key: gdy naturalne ułożenie nie wystarcza',
      blocks: [
        p(`Dane ładowane dzień po dniu same układają się po dacie. Po innych kolumnach już nie. Jeśli prawie wszystkie zapytania filtrują po kliencie albo po tenancie, naturalne ułożenie niczego im nie daje.`),
        p(`Można to zmienić. <b>Clustering key</b> to wskazanie kolumn, po których Snowflake ma utrzymywać dane w porządku. Usługa <b>Automatic Clustering</b> przepisuje potem w tle mikropartycje tak, żeby ich zakresy dla tych kolumn przestały się nakładać. W poprzedniej części było to ułożenie „${layout('clustered').label}”: filtr po kliencie zszedł z ${custScanned('load')} mikropartycji do ${custScanned('clustered')}.`),
        p(`To, jak mocno zakresy się nakładają, opisuje <b>clustering depth</b>: średnia głębokość nakładających się mikropartycji dla wskazanych kolumn. Im mniejsza, tym lepiej. Po backfillach 14 stycznia trafiał w ${dateScanned('churn', 'day')} mikropartycje zamiast w ${dateScanned('load', 'day')}. To właśnie większa głębokość.`),
        h3('Usługa kosztuje, więc pytanie brzmi: czy tu się opłaca'),
        p(`Porządkowanie danych zużywa kredyty. Do tego przepisane mikropartycje nie znikają od razu: stare są oznaczane jako usunięte, ale zostają na potrzeby Time Travel i Fail-safe. Według dokumentacji zwykle podnosi to koszt storage. Im częściej tabela się zmienia, tym więcej pracy ma usługa.`),
        p(`Dokumentacja mówi wprost, że clustering nie jest przeznaczony dla wszystkich tabel, i podaje, kiedy ma sens.`),
        list(
          `Tabela ma bardzo dużo mikropartycji. Zwykle oznacza to wiele terabajtów.`,
          `Większość zapytań filtruje albo sortuje po tych samych kolumnach, a filtr wybiera mały ułamek wierszy.`,
          `Tabela jest często czytana i rzadko zmieniana.`
        ),
        p(`Trzy wymyślone tabele pokazują, jak te kryteria działają razem.`),
        ...lesson.clustering.cases.flatMap((c, i) => [
          h3(['Duża tabela zdarzeń, filtr po tenancie', 'Mały słownik produktów', 'Tabela stanów przepisywana co 5 minut'][i]),
          p(c.setup),
          p(
            `<b>Decyzja: ${c.options[c.correct].charAt(0).toLowerCase()}${c.options[c.correct].slice(1)}.</b> ${
              [
                `Wszystkie trzy kryteria są spełnione. Klucz po <code>tenant_id</code> i dacie powinien ograniczyć skan do mikropartycji jednego tenanta. To kandydat, nie pewnik: wynik trzeba sprawdzić po włączeniu.`,
                `Taka tabela ma kilka mikropartycji, więc nie ma czego pomijać, a przeczytanie całości jest tanie. Rozstrzyga rozmiar. Gdyby miała terabajty, pytanie wróciłoby do tego, jak często jest zmieniana.`,
                `Są dwa problemy naraz. Tabela zmienia się bez przerwy, więc usługa stale porządkuje dane, a przepisane mikropartycje zostają w Time Travel i Fail-safe. Do tego <code>order_id</code> ma bardzo wiele różnych wartości, a taka kolumna według dokumentacji zwykle nie jest dobrym kluczem wprost.`
              ][i]
            }`
          )
        ]),
        p(`Do wyszukiwania pojedynczych wierszy w dużej tabeli, jak w trzecim przypadku, dokumentacja opisuje osobną usługę: <b>search optimization</b>. Wymaga edycji Enterprise i ma własny koszt storage i compute.`),
        h3('Jak wybrać klucz'),
        p(`Potrzebne jest tu jedno pojęcie. <b>Kardynalność</b> (cardinality) to liczba różnych wartości w kolumnie. Flaga ma bardzo niską, znacznik czasu albo identyfikator zamówienia bardzo wysoką.`),
        list(
          `Dla większości tabel dokumentacja zaleca najwyżej 3–4 kolumny lub wyrażenia w kluczu.`,
          `Kolejność: od najniższej do najwyższej kardynalności.`,
          `Kolumna o bardzo niskiej kardynalności daje minimalny pruning. Kolumna o bardzo wysokiej zwykle nie nadaje się wprost. Dokumentacja proponuje wtedy wyrażenie, na przykład <code>to_date(c_timestamp)</code> zamiast samego znacznika czasu.`
        ),
        p(`W dbt-snowflake klucz ustawia konfiguracja <code>cluster_by</code> na tabeli albo modelu przyrostowym.`),
        h3('Jak sprawdzić stan i efekt'),
        sql(`SELECT SYSTEM$CLUSTERING_INFORMATION(\n  'orders', '(order_date)');`),
        p(`Funkcja zwraca między innymi liczbę mikropartycji, średnią liczbę nakładań i średnią głębokość dla podanych kolumn.`),
        warn(
          'Clustering depth to wskazówka, nie wynik',
          `Dokumentacja zastrzega, że clustering depth nie jest miarą absolutną i nie pokazuje precyzyjnie, czy tabela jest dobrze sklastrowana. Najlepszym wskaźnikiem jest wydajność zapytań. Efekt ocenia się więc po Partitions scanned i czasie zapytań, a obok tego liczy koszt usługi.`
        ),
        h3('Jak działa i jak jest rozliczana usługa'),
        list(
          `Automatic Clustering działa w tle i nie używa Twojego warehouse'u. Nie blokuje instrukcji zmieniających dane (DML).`,
          `Można ją wstrzymać i wznowić: <code>ALTER TABLE t SUSPEND RECLUSTER</code> i <code>RESUME RECLUSTER</code>.`,
          `Sposób rozliczania zależy od wersji usługi. Dokumentacja opisuje dwie. Clustering Classic jest rozliczany za compute serverless. Optima Clustering jest rozliczany od ilości załadowanych danych. Według dokumentacji tabele klastrowane od 1 września 2026 używają Optima, a wcześniejsze zostają na Classic. Przed decyzją sprawdź, która wersja dotyczy Twojej tabeli.`
        ),
        p(`Dla tabel, do których głównie się dopisuje, jest tańsza alternatywa: sortowanie przy ładowaniu, czyli <code>ORDER BY</code> w instrukcji ładującej. Daje dobre ułożenie na starcie, ale po późniejszych zmianach nikt go nie utrzyma. To praktyka inżynierska, a nie zalecenie z dokumentacji.`),
        known(
          'Jeśli znasz indeksy z klasycznej bazy',
          `Indeks to osobna struktura, która prowadzi do konkretnych wierszy. Tworzysz go dla kolumn, po których szukasz, i płacisz wolniejszym zapisem. Decyzję o clustering key podejmuje się podobnie: patrzysz, po czym zapytania naprawdę filtrują, i liczysz koszt przy zapisie.`,
          `Gdzie porównanie się kończy: clustering nie tworzy struktury wskazującej wiersze. Zmienia fizyczne ułożenie danych, żeby dało się pominąć całe mikropartycje. Tabela ma jeden klucz, a nie wiele indeksów. I clustering nie pomoże znaleźć pojedynczego wiersza po dowolnej kolumnie.`
        )
      ]
    },
    {
      id: 'cache',
      title: 'Dwa cache: jak nie czytać drugi raz tego samego',
      blocks: [
        p(`Zapytanie uruchomione drugi raz często wraca szybciej. Stoją za tym dwa różne mechanizmy, a jeden z nich nic nie mówi o wydajności samego zapytania.`),
        p(`Prześledźmy jedną sekwencję. Zapytanie A to znane już <code>SELECT SUM(amount) FROM orders WHERE order_date = '2026-01-14'</code>. Na początku warehouse jest wstrzymany i niczego nie pamięta.`),
        table(
          ['Krok', 'Skąd odpowiedź', 'Co się stało'],
          [
            ['1. Uruchamiasz A', lesson.cache.outcomes.cold.source, 'Warehouse startuje. Pobiera mikropartycje z warstwy storage, liczy wynik i zostawia pobrane dane na swoim lokalnym dysku. Wynik zostaje zapisany.'],
            ['2. Uruchamiasz A jeszcze raz', `<b>${lesson.cache.outcomes.resultHit.source}</b>`, 'Tekst zapytania jest identyczny, a dane się nie zmieniły. Snowflake pomija wykonanie i oddaje zapisany wynik.'],
            ['3. Uruchamiasz A małymi literami', `<b>${lesson.cache.outcomes.localHit.source}</b>`, 'Tekst się różni, więc zapisany wynik nie pasuje. Zapytanie trzeba wykonać, ale potrzebne dane leżą już na lokalnym dysku.'],
            ['4. Wstrzymujesz warehouse', '–', 'Lokalny cache znika. Zapisany wynik A zostaje, bo nie należy do warehouse\'u.'],
            ['5. Uruchamiasz A', `<b>${lesson.cache.outcomes.resultHit.source}</b>`, 'Stan warehouse\'u nie ma tu znaczenia. Wynik wraca tak samo jak w kroku 2.'],
            ['6. Ktoś robi INSERT do tabeli', '–', 'Warehouse startuje, żeby wykonać INSERT. Dane tabeli się zmieniły, więc zapisany wynik A jest nieaktualny.'],
            ['7. Uruchamiasz A', lesson.cache.outcomes.remote.source, 'Zapytanie trzeba wykonać. Warehouse działa, ale jego lokalny cache jest pusty po wstrzymaniu, więc dane znów idą z warstwy storage.']
          ],
          'Ilustracja: model z jednym warehouse i jedną tabelą. Pokazuje, skąd pochodzą dane, a nie ile to trwa. Reguły pochodzą z dokumentacji.'
        ),
        p(`W krokach 2 i 5 pracowała tylko warstwa cloud services. To <b>result cache</b> (dokumentacja: persisted query results): zapisane gotowe wyniki zapytań. W kroku 3 pracował warehouse, ale nie musiał niczego pobierać. To <b>cache warehouse'u</b>: dane tabel na jego lokalnym dysku. W Query Profile widać go jako statystykę „Percentage scanned from cache”.`),
        table(
          ['', 'Result cache', 'Cache warehouse\'u'],
          [
            ['Do której warstwy należy', 'Cloud services', 'Compute'],
            ['Co przechowuje', 'Gotowy wynik zapytania', 'Dane tabel pobrane z object storage'],
            ['Komu pomaga', 'Tylko identycznemu zapytaniu na niezmienionych danych', 'Każdemu zapytaniu, które czyta te same dane, także innemu niż pierwsze'],
            ['Czy zapytanie się wykonuje', 'Nie, Snowflake pomija wykonanie', 'Tak, tylko czyta lokalnie'],
            ['Kiedy przepada', 'Po zmianie danych albo po upływie czasu przechowywania', 'Przy wstrzymaniu warehouse\'u']
          ]
        ),
        h3('Dokładne warunki result cache'),
        p(`Warunki są ostrzejsze, niż się wydaje. Wszystkie pochodzą z dokumentacji.`),
        list(
          `Wynik jest przechowywany 24 godziny. Każde ponowne użycie odnawia ten okres, najwyżej do 31 dni od pierwszego wykonania.`,
          `Nowe zapytanie musi dokładnie odpowiadać poprzedniemu. Dokumentacja wymienia wielkość liter i aliasy tabel jako różnice, które blokują ponowne użycie.`,
          `Dane tabel nie mogły się zmienić. Mikropartycje też nie, na przykład przez porządkowanie w tle, choć logicznie dane są wtedy te same.`,
          `Zapytanie nie może zawierać funkcji, których wyniku nie da się użyć ponownie. Dokumentacja wymienia <code>UUID_STRING</code>, <code>RANDOM</code> i <code>RANDSTR</code>. Odpadają też funkcje zewnętrzne i zapytania do tabel hybrydowych.`,
          `Rola musi mieć uprawnienia do wszystkich użytych tabel. Warunek dotyczy roli, a nie tego, czy to ten sam użytkownik.`,
          `Spełnienie wszystkich warunków nie gwarantuje ponownego użycia wyniku. Tak mówi dokumentacja.`
        ),
        warn(
          'Pomiar z włączonym result cache niczego nie mierzy',
          `Poprawiasz zapytanie, uruchamiasz je drugi raz i wraca w ułamku sekundy. To może być zapisany wynik, a nie efekt poprawki. Na czas pomiarów wyłącz mechanizm parametrem sesji <code>USE_CACHED_RESULT = FALSE</code>. Zapisz też, czy warehouse startował z pustym lokalnym cache.`
        ),
        h3('Auto-suspend to kompromis'),
        p(`Warehouse zużywa kredyty, gdy działa, nawet jeśli nic nie liczy. <b>Auto-suspend</b> wstrzymuje go po okresie bezczynności, a <b>auto-resume</b> wznawia, gdy przyjdzie zapytanie. Oba są domyślnie włączone.`),
        p(`Odruch podpowiada: im krótszy auto-suspend, tym taniej. Ale każde wstrzymanie kasuje lokalny cache, a każdy start to co najmniej 60 sekund rozliczenia. Warehouse, który zatrzymuje się i wznawia co chwilę, płaci to minimum za każdym razem i ciągle pracuje na pustym cache.`),
        list(
          `Dokumentacja zaleca niską wartość auto-suspend, na przykład 5 albo 10 minut lub mniej, dopasowaną do przerw w obciążeniu.`,
          `Cache jest tym większy, im większy warehouse. Przy zmniejszeniu rozmiaru znika cache zasobów, które zostały usunięte.`,
          `Reguła robocza, z praktyki, a nie z dokumentacji: warehouse do zadań wsadowych może zatrzymywać się szybko, bo między przebiegami i tak nie ma ruchu. Warehouse pod dashboardy powinien przetrwać typową przerwę między kliknięciami.`
        )
      ]
    },
    {
      id: 'query-profile',
      title: 'Query Profile: gdzie zniknął czas',
      blocks: [
        p(`Zapytanie trwa za długo. Zanim sięgniesz po większy warehouse, ustal, co się wydarzyło. „Wolne zapytanie” to objaw, a każdą z jego przyczyn naprawia się czym innym.`),
        p(`<b>Query Profile</b> pokazuje wykonane zapytanie jako drzewo <b>operatorów</b>, czyli kroków wykonania. Przykłady: TableScan to odczyt tabeli, Join to łączenie, Aggregate to grupowanie, Sort to sortowanie. Każdy operator ma swój czas i statystyki. Drzewo czyta się od dołu, od odczytu tabel, w górę do wyniku.`),
        p(`Jedno pojęcie na start. Gdy operacja nie mieści się w pamięci, warehouse odkłada dane pośrednie na dysk. To <b>spilling</b>. Najpierw używa lokalnego dysku. Gdy i tego zabraknie, zapisuje do zdalnego storage, a to spowalnia zapytanie najmocniej.`),
        p(`Poniżej cztery zapytania z tym samym objawem i czterema różnymi przyczynami. Wartości w tabelach są wymyślone, nazwy statystyk pochodzą z dokumentacji, a pogrubione są te, które wskazują przyczynę.`),
        h3('1. Zapytanie czyta prawie całą tabelę'),
        p(`Raport dzienny dla jednego klienta trwa 9 minut. Najdroższy operator to TableScan na tabeli zamówień.`),
        stats('scan'),
        p(`Zapytanie szuka jednego klienta, a przeczytało prawie wszystkie mikropartycje. Pruning nie zadziałał. Dokumentacja nazywa to nieskutecznym pruningiem i każe porównać właśnie te dwie liczby. Większy warehouse przeczyta całą tabelę szybciej, ale nadal całą.`),
        p(`Pierwszy krok: sprawdzić filtr i ułożenie danych względem kolumny z filtra. Jeśli warunek nie pozwala na pruning, da się go przepisać. Jeśli dane nie są uporządkowane po tej kolumnie, wraca pytanie o clustering key i jego koszt.`),
        h3('2. Join mnoży wiersze'),
        p(`Model łączy zamówienia z historią adresów klienta. Wczoraj trwał 4 minuty, dziś ponad godzinę. Najdroższy operator to Join.`),
        stats('join'),
        p(`Join oddaje 80 razy więcej wierszy, niż dostał z większej strony. Dokumentacja nazywa to <b>eksplodującym joinem</b> (exploding join): operator oddaje wielokrotnie więcej wierszy, niż dostaje, często o rzędy wielkości. Wszystko, co jest w drzewie nad nim, musi potem te wiersze przetworzyć. Spilling jest tu skutkiem, a nie przyczyną.`),
        p(`Pierwszy krok: sprawdzić warunek joina i duplikaty klucza. Najczęściej klucz, który miał być unikalny, przestał taki być albo w warunku brakuje kolumny. Większy warehouse tylko ukryłby błąd. Jeśli mnożenie wierszy jest zamierzone, spilling zostaje jako osobny problem.`),
        h3('3. Operacja nie mieści się w pamięci'),
        p(`Miesięczna agregacja po kilkunastu wymiarach na całej tabeli faktów. Najdroższe operatory to Aggregate i Sort.`),
        stats('spill'),
        p(`Pełny skan jest tu uzasadniony, bo zapytanie potrzebuje wszystkich danych. Agregacja zmniejsza liczbę wierszy, a nie mnoży. Problemem jest pamięć: operacja nie zmieściła się ani w niej, ani na lokalnym dysku, więc część danych pośrednich trafiła do zdalnego storage.`),
        p(`Pierwszy krok: przetestować większy warehouse albo podzielić pracę na mniejsze porcje. To dwie naprawy z dokumentacji. Trzecia wynika z samego profilu: zmniejszyć dane przed drogim operatorem, czyli filtrować wcześniej i brać mniej kolumn. To jedyny z czterech przypadków, w którym zmiana rozmiaru jest rozsądnym pierwszym ruchem.`),
        h3('4. Zapytanie czeka w kolejce'),
        p(`Proste zapytanie pod dashboard rano trwało 2 sekundy. O 9:00 trwa 3 minuty, a jego profil wygląda identycznie jak rano.`),
        stats('queue'),
        p(`Samo zapytanie jest szybkie. Czekało, bo warehouse nie miał wolnych zasobów. Snowflake ustawia wtedy zapytania w kolejce, aż zasoby się zwolnią. To problem <b>współbieżności</b> (concurrency), czyli wielu zapytań naraz, a nie wydajności jednego.`),
        p(`Pierwszy krok: sprawdzić obciążenie warehouse'u. Naprawy z dokumentacji to dodatkowe warehouse'y i rozdzielenie zapytań albo multi-cluster warehouse, o którym jest następna część. O zmianie rozmiaru dokumentacja mówi wprost, że nie jest przeznaczona do problemów ze współbieżnością. Warto też sprawdzić, co o 9:00 zajmuje warehouse. Jedno ciężkie zapytanie ładujące dane na warehouse'ie od dashboardów to problem izolacji, nie skali.`),
        p(`Czas w kolejce nie jest statystyką operatora w profilu. Widać go w historii zapytań i w obciążeniu warehouse'u.`),
        h3('Kolejność pytań'),
        table(
          ['Pytanie', 'Na co patrzeć', 'Co naprawia'],
          [
            ['Czy zapytanie czekało?', 'Czas w kolejce wobec czasu wykonania', 'Osobne warehouse\'y albo więcej klastrów'],
            ['Ile przeczytało?', 'Partitions scanned wobec Partitions total w TableScan', 'Filtr, ułożenie danych, ewentualnie clustering key'],
            ['Czy któryś operator mnoży wiersze?', 'Wiersze na wejściu i wyjściu operatora Join', 'Warunek joina, duplikaty klucza'],
            ['Czy operacja zmieściła się w pamięci?', 'Bytes spilled to local storage i to remote storage', 'Mniej danych przed operatorem, mniejsze porcje albo większy warehouse']
          ]
        ),
        p(`Większy warehouse jest właściwą odpowiedzią tylko na jedną z tych przyczyn. Dokumentacja wymienia jeszcze czwarty typowy problem: <code>UNION</code> bez <code>ALL</code>. W profilu widać wtedy operator UnionAll z dodatkowym Aggregate nad nim, który usuwa duplikaty. Jeśli duplikatów nie ma albo nie przeszkadzają, <code>UNION ALL</code> oszczędza tę pracę.`),
        h3('Na co dzieli się czas operatora'),
        p(`Profil rozbija czas na kategorie. <b>Processing</b>: procesor pracuje nad danymi. <b>Local Disk IO</b> i <b>Remote Disk IO</b>: przetwarzanie czeka na dysk lokalny albo zdalny. <b>Network Communication</b>: czekanie na przesłanie danych po sieci. <b>Synchronization</b>: koordynacja między procesami. <b>Initialization</b>: przygotowanie do przetwarzania.`),
        p(`Dużo Remote Disk IO oznacza czytanie z object storage, czyli pusty lokalny cache albo ogromny skan, albo zdalny spilling. Statystyka „Percentage scanned from cache” mówi, jaką część skanu obsłużył lokalny cache warehouse'u.`),
        h3('Jak znaleźć zapytania, które regularnie zrzucają dane na dysk'),
        sql(`SELECT query_id, warehouse_size,\n  total_elapsed_time,\n  bytes_spilled_to_local_storage,\n  bytes_spilled_to_remote_storage\nFROM snowflake.account_usage.query_history\nWHERE bytes_spilled_to_remote_storage > 0\nORDER BY\n  bytes_spilled_to_remote_storage DESC\nLIMIT 20;`),
        p(`Widok <code>query_history</code> jest w bazie <code>SNOWFLAKE</code>. Wielkości, które profil pokazuje dla operatora, są tu zsumowane dla całego zapytania, a po <code>query_id</code> otworzysz jego profil.`),
        list(
          `Dostęp do bazy <code>SNOWFLAKE</code> ma domyślnie tylko rola ACCOUNTADMIN. Zwykle trzeba go nadać roli do monitoringu.`,
          `Przy włączonej usłudze Query Acceleration niezerowa wartość <code>bytes_spilled_to_remote_storage</code> jest według dokumentacji spodziewana i nie musi oznaczać problemu z pamięcią.`
        )
      ]
    },
    {
      id: 'skalowanie',
      title: 'Większy warehouse czy więcej klastrów',
      blocks: [
        p(`Moc można dołożyć na dwa sposoby i każdy pasuje do innego problemu. <b>Scale up</b> to większy rozmiar warehouse'u. <b>Scale out</b> to więcej klastrów tego samego rozmiaru w jednym warehouse'ie, czyli <b>multi-cluster warehouse</b>.`),
        p(`Najpierw rachunek. Warehouse jest rozliczany co do sekundy, z minimum 60 sekund przy każdym starcie. Stawka zależy od rozmiaru. Według tabeli z dokumentacji, dla warehouse'ów pierwszej generacji (Gen1), kredyty na godzinę wynoszą: ${rates}. Każdy kolejny rozmiar podwaja stawkę. Warehouse'y Gen2 mają osobne stawki i nie są domyślne przy tworzeniu standardowego warehouse'u.`),
        p(`Koszt pracy to stawka razy czas razy liczba działających klastrów. Na tym wzorze opierają się oba przykłady poniżej. Czasy są w nich wymyślone.`),
        h3('Jedno ciężkie zapytanie'),
        p(`Nocna agregacja całej tabeli faktów. Na warehouse'ie Medium nie mieści się w pamięci i zrzuca dane do zdalnego storage.`),
        table(['Reakcja', 'Klastry i rozmiar', 'Czas', 'Kredyty'], scaleRows('heavy'), 'Ilustracja: czasy są wymyślone, kredyty wynikają ze wzoru. Minimum 60 sekund jest pominięte.'),
        p(`Scale up daje cztery razy wyższą stawkę, ale w tym modelu zapytanie mieści się już w pamięci i kończy się sześć razy szybciej. Wychodzi szybciej i taniej, bo zniknął zdalny spilling. Bez tego efektu czas spadłby mniej więcej czterokrotnie, a koszt zostałby ten sam.`),
        p(`Scale out nie zmienia niczego. Jedno zapytanie działa na jednym klastrze, a dodatkowe klastry nie startują, bo nic nie czeka w kolejce.`),
        h3('Wiele krótkich zapytań naraz'),
        p(`Poniedziałek, 9:00. Dashboardy wysyłają jednocześnie 24 zapytania. Każde z osobna trwa minutę na warehouse'ie Medium. W modelu jeden klaster wykonuje 8 zapytań naraz.`),
        figure(`Ilustracja. Te same 24 zapytania na jednym klastrze i na trzech. Wyróżnione są minuty, w których ktoś jeszcze czeka. Model uproszczony: prawdziwy warehouse nie tnie pracy na równe ósemki.`, {
          kind: 'lanes',
          lanes: [
            { label: `1 klaster ${many[0].size}: bez zmian`, steps: waveSteps(many[0]) },
            { label: `${many[2].clusters} klastry ${many[2].size}: scale out`, steps: waveSteps(many[2]) }
          ]
        }),
        table(['Reakcja', 'Klastry i rozmiar', 'Czas', 'Kredyty'], scaleRows('many'), 'Ilustracja: ten sam wzór. Start dodatkowych klastrów jest w modelu natychmiastowy.'),
        p(`Bez zmian ostatnia ósemka dostaje wynik po 3 minutach, choć samo zapytanie trwa minutę. Po scale up krótkie zapytanie w tym modelu nie przyspiesza, a naraz nadal działa osiem: kolejka zostaje, koszt rośnie czterokrotnie. Po scale out startują dwa dodatkowe klastry i nikt nie czeka. Trzy klastry przez minutę kosztują tyle, co jeden przez trzy minuty.`),
        p(`Reguła: scale up pomaga jednemu dużemu zapytaniu, bo daje mu więcej pamięci i procesora. Scale out pomaga, gdy zapytań jest wiele naraz, bo likwiduje kolejkę. Użyte na odwrót nie robią nic albo tylko podnoszą rachunek.`),
        warn(
          'Co w tych przykładach jest uproszczeniem',
          `Osiem zapytań naraz to domyślna wartość parametru <code>MAX_CONCURRENCY_LEVEL</code>. Dokumentacja zastrzega, że są wyjątki: małe instrukcje liczą się jako ułamek. To nie jest sztywny limit.`,
          `Start dodatkowego klastra nie jest natychmiastowy i każdy start to minimum 60 sekund rozliczenia. Przy tak krótkim szczycie rachunek byłby wyższy niż w tabeli.`,
          `Efekt „szybciej i taniej” zależy od tego, czy większy rozmiar usuwa zdalny spilling. To trzeba sprawdzić w Query Profile po zmianie.`
        ),
        h3('Czy większy znaczy droższy'),
        p(`Niekoniecznie. Weźmy job, który na warehouse'ie Large trwa 40 minut, a na X-Large 20. Large to ${rate('Large')} kredytów na godzinę przez 40 minut, czyli ${num((rate('Large') * 40) / 60)} kredytu. X-Large to ${rate('X-Large')} przez 20 minut, czyli też ${num((rate('X-Large') * 20) / 60)}. Dwa razy większy warehouse, który kończy w połowę czasu, kosztuje tyle samo.`),
        p(`Dokumentacja mówi, że zapytania skalują się liniowo z rozmiarem „w większości”, zwłaszcza duże i złożone. Mówi też, że większy warehouse niekoniecznie przyspieszy małe, proste zapytania. Gdy czas przestaje spadać proporcjonalnie, płacisz już tylko za rozmiar.`),
        h3('Co dokładnie robi zmiana rozmiaru'),
        list(
          `Zmiana rozmiaru działającego warehouse'u nie wpływa na zapytania, które już trwają. Nowe zasoby obsługują zapytania z kolejki i nowe.`,
          `Dodatkowe zasoby są rozliczane od chwili przydzielenia. Przy zmniejszeniu znika cache usuwanych zasobów.`,
          `Wniosek praktyczny: zmiana rozmiaru w trakcie długiego zapytania go nie przyspieszy. Trzeba je uruchomić ponownie.`
        ),
        h3('Multi-cluster warehouse: tryby i polityki'),
        list(
          `Wymaga edycji Enterprise. Ustawiasz minimalną i maksymalną liczbę klastrów.`,
          `Gdy obie liczby są równe i większe niż 1, to tryb <b>Maximized</b>: wszystkie klastry działają zawsze. Gdy są różne, to tryb <b>Auto-scale</b>: Snowflake dodaje i wyłącza klastry zależnie od obciążenia.`,
          `W trybie Auto-scale działa polityka skalowania. <b>Standard</b> (domyślna) uruchamia dodatkowy klaster, żeby ograniczyć kolejkowanie. <b>Economy</b> uruchamia klaster tylko wtedy, gdy szacuje, że obciążenia wystarczy na co najmniej 6 minut jego pracy. Część zapytań poczeka wtedy dłużej.`,
          `Maksymalna liczba klastrów zależy od rozmiaru: według tabeli w dokumentacji od 300 dla rozmiarów do Medium po 10 dla największych. Interfejs Snowsight pozwala ustawić najwyżej 10.`,
          `Pojedyncze zapytanie nadal działa na jednym klastrze. Multi-cluster nie przyspieszy ciężkiego zapytania.`
        ),
        p(`Bez edycji Enterprise zostaje kilka osobnych warehouse'ów i rozdzielenie zapytań między nie. To zarazem izolacja obciążeń: ładowanie danych nie blokuje dashboardów.`),
        h3('Query Acceleration Service'),
        p(`Jest jeszcze trzecia opcja, dla pojedynczych zapytań z ogromnym skanem. Usługa przenosi część pracy zapytania, które się do tego kwalifikuje, na współdzielone zasoby serverless. Dokumentacja wymienia duże skany z agregacją albo z filtrem wybierającym mały ułamek wierszy oraz duże skany wstawiające wiele wierszy.`),
        p(`Wymaga edycji Enterprise. Zużywa osobno rozliczane kredyty serverless, tylko gdy jest używana. Limit ustawia się mnożnikiem rozmiaru warehouse'u (scale factor, domyślnie 8). To koszt serverless, więc narzędzie pilnujące warehouse'ów go nie zatrzyma.`)
      ]
    },
    {
      id: 'metoda-strojenia',
      title: 'Metoda: z 128 do 30 minut',
      blocks: [
        p(`Pipeline przetwarzał dane w porcjach godzinowych i zatrzymał się na cztery doby. Do nadrobienia było <b>96 godzin danych</b>. Pierwsza wersja nadrabiania trwała <b>128 minut</b>. Po testach obciążeniowych i zmianie konfiguracji warehouse'u: <b>30 minut</b>.`),
        p(`To trzy liczby z prawdziwego projektu. Rozdział celowo nie podaje, jaki rozmiar ustawiono ani ile to kosztowało, bo tych danych nie zna. Ważniejsza jest droga do takiego wyniku: sześć kroków, z których każdy korzysta z wcześniejszych części rozdziału.`),
        steps(
          `<b>Zdefiniuj cel i pomiar.</b> Co ma być szybsze i po co? Tu: czas nadrobienia całej zaległości, a nie jednego zapytania. Ustal, co mierzysz (łączny czas od startu do końca, kredyty zużyte w tym oknie) i co Cię ogranicza: termin, budżet, wpływ na innych. Bez progu typu „zaległość ma zniknąć przed porannymi raportami” nie wiadomo, kiedy przestać.`,
          `<b>Zbuduj powtarzalny test.</b> Reprezentatywna porcja zaległości, którą da się uruchamiać wiele razy w tych samych warunkach. W praktyce: sklonowane tabele zamiast produkcyjnych, wyłączony result cache, zapisany rozmiar warehouse'u i stan lokalnego cache.`,
          `<b>Znajdź, gdzie jest czas.</b> Zanim cokolwiek zmienisz, rozbij 128 minut na części. Ile to kolejka, a ile wykonanie? Które zapytania zajmują najwięcej? W ich Query Profile sprawdź skan, join i spilling.`,
          `<b>Postaw hipotezę i zmieniaj jedną rzecz.</b> Spilling: większy warehouse albo mniejsze porcje. Kolejka: więcej klastrów albo osobny warehouse. Pełny skan: filtr i ułożenie danych. Po każdej zmianie ten sam test i zapisany czas oraz kredyty. Po dwóch zmianach naraz nie wiesz, która zadziałała.`,
          `<b>Policz kompromis.</b> Dla każdego wariantu czas i koszt: stawka razy czas razy liczba klastrów. Wybierasz wariant, który spełnia cel z kroku 1 przy akceptowalnym koszcie, a nie najszybszy możliwy.`,
          `<b>Zabezpiecz wynik.</b> Zapisz konfigurację i uzasadnienie. Dodaj limit czasu zapytań i kontrolę kosztu na warehouse'ie do nadrabiania. W pipeline dodaj alert na rosnącą zaległość, żeby następnym razem było 6 godzin, a nie 96.`
        ),
        p(`Dwie obserwacje, które łatwo przeoczyć. Nadrabianie zaległości różni się od zwykłego przebiegu skalą: 96 porcji naraz zamiast jednej. Operacja, która przy jednej godzinie mieści się w pamięci, przy 96 może zacząć zrzucać dane na dysk. To typowy powód, dla którego zaległość nadrabia się dużo dłużej, niż wynikałoby z samej ilości danych.`),
        p(`Druga: warto testować w obie strony. Jeśli większy rozmiar pomógł, sprawdź, czy jeszcze większy nadal pomaga, czy zysk już się wypłaszczył. Do nadrabiania sensowny bywa osobny, większy warehouse używany tylko do tego. Nie zabiera zasobów bieżącej pracy i nie zmienia kosztu codziennych przebiegów.`),
        p(`Sześć kroków to metoda pracy, a nie fakt z dokumentacji. Na końcu umiesz powiedzieć, co zmierzono, dlaczego zmiana zadziałała, ile kosztowała i co zrobiono, żeby problem nie wrócił.`)
      ]
    },
    {
      id: 'koszty',
      title: 'Z czego składa się rachunek',
      blocks: [
        p(`Koszt Snowflake to według dokumentacji suma trzech rzeczy: compute, storage i transferu danych. Compute liczy się w kredytach i ma trzy źródła. Każdym zarządza się inaczej.`),
        list(
          `<b>Virtual warehouse'y.</b> Zarządzasz nimi sam. Zużywają kredyty, gdy działają, niezależnie od tego, czy coś liczą. Rozliczenie jest co do sekundy, z minimum 60 sekund przy każdym starcie.`,
          `<b>Serverless.</b> Zasoby, którymi zarządza Snowflake, z osobną pozycją na rachunku dla każdej funkcji.`,
          `<b>Cloud services.</b> Doliczane tylko powyżej 10% dziennego zużycia warehouse'ów. Serverless nie wchodzi do podstawy tych 10%.`
        ),
        h3('Dwa narzędzia, które widzą co innego'),
        p(`Wydatków pilnują dwa narzędzia. <b>Resource monitor</b> to limit kredytów dla warehouse'ów: po jego przekroczeniu potrafi warehouse wstrzymać. <b>Budżet</b> (budget) to miesięczny limit kredytów dla konta albo grupy obiektów: gdy prognoza wskazuje przekroczenie, wysyła powiadomienie. Poniżej sześć źródeł kosztu i to, które narzędzie je zobaczy.`),
        table(
          [lesson.cost.coverageLabel, lesson.cost.columns.monitor, lesson.cost.columns.budget],
          lesson.cost.items.map(item => [item.label, sees(item.monitor), sees(item.budget)]),
          'Zasięg obu narzędzi według dokumentacji Snowflake. Przykłady źródeł kosztu są wymyślone.'
        ),
        list(
          `<b>Zapytanie, które działa całą noc</b>, to zużycie warehouse'u, więc monitor je liczy i może warehouse wstrzymać. Budżet też to widzi, ale domyślnie tylko powiadamia, i to z opóźnieniem.`,
          `<b>Snowpipe, automatic clustering i zadania serverless</b> to funkcje serverless. Dokumentacja mówi wprost, że resource monitor nie śledzi wydatków na funkcje serverless i że do tego służy budżet. Dotyczy to także monitora ustawionego na poziomie konta.`,
          `<b>Time Travel i Fail-safe</b> to koszt storage, a oba narzędzia dotyczą compute. Storage sprawdza się w widokach użycia tabel. To wniosek z zakresu obu narzędzi, a nie cytat z dokumentacji.`,
          `<b>Cloud services obsługujące warehouse</b> monitor liczy razem z warehouse'em. Jego limit nie uwzględnia jednak dziennej korekty 10%, więc monitor może liczyć zużycie, za które ostatecznie nie zapłacisz.`
        ),
        p(`Monitor jest więc hamulcem, ale tylko dla warehouse'ów. Budżet widzi więcej, ale domyślnie tylko informuje.`),
        h3('Resource monitor: szczegóły'),
        list(
          `Limit w kredytach na okres: domyślnie miesiąc kalendarzowy, możliwe też dzień, tydzień, rok albo bez resetu.`,
          `Trzy akcje: powiadom, powiadom i wstrzymaj po zakończeniu bieżących zapytań, powiadom i wstrzymaj natychmiast, anulując zapytania.`,
          `Jeden monitor można ustawić na poziomie konta, a warehouse może mieć dodatkowo najwyżej jeden własny. Tworzyć je może tylko ACCOUNTADMIN.`,
          `To nie jest twardy limit. Dokumentacja mówi, że warehouse może zużywać kredyty po osiągnięciu limitu, zanim zostanie wstrzymany, także przy akcji natychmiastowej. Zaleca próg z zapasem, na przykład 90%.`,
          `Dokumentacja zaznacza też, że monitor nie służy do ścisłej kontroli zużycia w skali godzin.`
        ),
        h3('Budżet: szczegóły'),
        list(
          `Miesięczny limit wydatków na compute, wyrażony w kredytach, nie w walucie. Budżet konta obejmuje całe zużycie kredytów konta. Budżet własny obejmuje wybraną grupę obiektów, na przykład warehouse'y, bazy, schematy, tabele, zadania i pipe'y, albo obiekty z danym tagiem.`,
          `Powiadomienie jest wysyłane, gdy prognoza wskazuje przekroczenie limitu: e-mailem, do kolejki w chmurze albo przez webhook.`,
          `Budżet może wywołać procedurę składowaną po osiągnięciu progu (do 10 akcji na budżet) oraz na początku cyklu. Tak da się pośrednio wstrzymać warehouse, ale to logika, którą piszesz sam.`,
          `Domyślnie budżet jest odświeżany w odstępie do 6,5 godziny. Jest też opcjonalny tryb z odświeżaniem co godzinę, który zwiększa koszt samego budżetu dwunastokrotnie. W obu trybach budżet widzi zużycie z opóźnieniem, więc nie jest twardym limitem działającym w czasie rzeczywistym.`
        ),
        h3('Storage: co się w nim liczy'),
        list(
          `Rozliczenie jest miesięczne, od średniej dziennej liczby skompresowanych bajtów. Wchodzą w to pliki w stage'ach, czyli w miejscach, z których ładuje się dane, dane tabel razem z historią Time Travel oraz Fail-safe.`,
          `Dla tabel krótko żyjących, na przykład roboczych w potoku, dokumentacja sugeruje typ transient, bez Fail-safe. Dla długowiecznych zaleca typ permanent. Oba opisuje część o Time Travel.`
        ),
        h3('Dźwignie kosztu, od najtańszej'),
        steps(
          `<b>Czytaj mniej.</b> Pruning, mniej kolumn, poprawione joiny. Mniej pracy to krótszy czas warehouse'u.`,
          `<b>Nie płać za bezczynność.</b> Auto-suspend dopasowany do przerw w obciążeniu, auto-resume włączony.`,
          `<b>Dobierz rozmiar pomiarem.</b> Zwiększaj, dopóki czas spada proporcjonalnie. Potem płacisz już tylko za rozmiar.`,
          `<b>Rozdziel obciążenia.</b> Osobny warehouse ma rozmiar i auto-suspend dobrane do rodzaju pracy, a jego koszt da się przypisać do zespołu.`,
          `<b>Postaw bezpieczniki.</b> Limit czasu zapytania <code>STATEMENT_TIMEOUT_IN_SECONDS</code> (domyślnie 172 800 sekund, czyli 2 dni), limit czasu w kolejce, uprawnienia do tworzenia i zmiany warehouse'ów.`
        ),
        warn(
          'Bezpieczniki warehouse\'ów nie obejmują wszystkiego',
          `Dokumentacja zaznacza, że limity czasu, uprawnienia, auto-suspend i resource monitory nie dotyczą cloud services ani funkcji serverless. Gdy rachunek rośnie, a żaden monitor nie zadziałał, szukaj tam, gdzie monitory nie patrzą: w serverless i w storage.`
        )
      ]
    },
    {
      id: 'streams-tasks',
      title: 'Streams & Tasks: przetwarzaj tylko to, co się zmieniło',
      blocks: [
        p(`Tabela źródłowa ma miliard wierszy. Od ostatniego przebiegu zmieniło się kilkanaście. Potrzebne są dwie rzeczy: odpowiedź na pytanie „co się zmieniło od ostatniego razu” i coś, co uruchomi przetwarzanie.`),
        p(`Pierwszą daje <b>stream</b>. Działa jak zakładka na tabeli. Pamięta <b>offset</b>, czyli punkt w historii wersji tabeli. Gdy go odpytasz, zwraca różnicę między tym punktem a stanem bieżącym. Drugą daje <b>task</b>: SQL uruchamiany według harmonogramu albo po pojawieniu się danych w streamie.`),
        p(`Prześledźmy jeden cykl. Stream powstał, gdy tabela <code>orders</code> była w wersji 1. Task robi <code>MERGE</code> do tabeli docelowej.`),
        table(
          ['Co się dzieje', lesson.stream.labels.version, lesson.stream.labels.offset, lesson.stream.labels.pending],
          streamRows,
          'Ilustracja: wersje tabeli są ponumerowane dla czytelności. Reguły pochodzą z dokumentacji.'
        ),
        p(`Każdy wiersz tej tabeli pokazuje jedną regułę.`),
        list(
          `<b>INSERT.</b> Tabela dostała nową wersję, a offset stoi w miejscu. Stream pokazuje nowy wiersz jako rekord z <code>METADATA$ACTION = 'INSERT'</code>.`,
          `<b>UPDATE.</b> Zmianę wiersza, który istniał przed offsetem, stream pokazuje jako parę rekordów: DELETE starej wersji i INSERT nowej, oba z <code>METADATA$ISUPDATE = TRUE</code>. Stąd trzy rekordy.`,
          `<b>Drugi UPDATE.</b> Rekordów nie przybywa. Stream zwraca <b>zmianę netto</b>: różnicę między stanem z offsetu a stanem bieżącym, bez kroków pośrednich. Z tego samego powodu wiersz wstawiony i usunięty między dwoma odczytami w ogóle się nie pojawi.`,
          `<b>SELECT.</b> Zwykły odczyt streamu pokazuje rekordy, ale nie przesuwa offsetu. Możesz czytać dowolną liczbę razy.`,
          `<b>Task.</b> Dopiero zatwierdzona transakcja, w której instrukcja zmieniająca dane czyta ze streamu, przesuwa offset do bieżącej wersji. Stream jest pusty.`,
          `<b>Kolejne uruchomienie.</b> Warunek taska sprawdza, czy stream ma dane. Nie ma, więc uruchomienie jest pomijane.`
        ),
        p(`Najważniejsze zdanie tej części: <b>stream nie przechowuje danych, tylko offset</b>, a przesuwa go wyłącznie zatwierdzona transakcja z instrukcją DML (na przykład <code>MERGE</code> albo <code>INSERT ... SELECT</code>) czytającą ze streamu. Dzięki temu zapis do tabeli docelowej i „odhaczenie” zmian to jedna transakcja. Jeśli MERGE się nie powiedzie, offset zostaje i zmiany czekają na następny przebieg.`),
        warn(
          'Jeden stream, jeden odbiorca',
          `Z tej samej reguły wynika pułapka. Pierwszy odbiorca, który skonsumuje stream, przesuwa offset i zabiera zmiany pozostałym. Dlatego każdy odbiorca zmian potrzebuje własnego streamu. To samo zrobi instrukcja DML uruchomiona na streamie przez pomyłkę.`
        ),
        h3('Ten sam cykl w SQL'),
        sql(`CREATE STREAM orders_stream\n  ON TABLE orders;`),
        p(`Stream powstaje z offsetem ustawionym na bieżącą wersję tabeli. Przy pierwszym streamie Snowflake dodaje do tabeli kilka ukrytych kolumn śledzenia zmian.`),
        sql(
          `CREATE TASK merge_orders\n  WAREHOUSE = etl_wh\n  SCHEDULE = '5 MINUTE'\nWHEN SYSTEM$STREAM_HAS_DATA('orders_stream')\nAS\nMERGE INTO orders_clean t\nUSING orders_stream s\n  ON t.order_id = s.order_id\nWHEN MATCHED\n  AND s.METADATA$ACTION = 'DELETE'\n  AND NOT s.METADATA$ISUPDATE\n  THEN DELETE\nWHEN MATCHED\n  AND s.METADATA$ACTION = 'INSERT'\n  THEN UPDATE SET t.amount = s.amount\nWHEN NOT MATCHED\n  AND s.METADATA$ACTION = 'INSERT'\n  THEN INSERT (order_id, amount)\n    VALUES (s.order_id, s.amount);`
        ),
        list(
          `<code>WAREHOUSE</code> wskazuje, na czym task działa. Bez tego parametru byłby to task serverless: zasoby dobiera wtedy Snowflake i jest to osobna pozycja kosztu.`,
          `<code>WHEN SYSTEM$STREAM_HAS_DATA</code> to warunek sprawdzany przed uruchomieniem. Gdy stream jest pusty, przebieg jest pomijany i warehouse nie budzi się co 5 minut po nic.`,
          `<code>MERGE</code> to instrukcja, która konsumuje stream. Łączy po kluczu biznesowym, więc ponowne zastosowanie tej samej zmiany nie tworzy duplikatu.`,
          `Pierwsza gałąź obsługuje prawdziwe usunięcie: rekord DELETE bez flagi ISUPDATE. DELETE z flagą to połowa pary opisującej update, więc jest pomijany.`,
          `Druga gałąź: rekord INSERT dla klucza, który już jest w celu, niesie nową wersję wiersza. Trzecia: klucza jeszcze nie ma, więc wiersz jest wstawiany.`
        ),
        sql(`ALTER TASK merge_orders RESUME;`),
        p(`Nowo utworzony task jest wstrzymany. Dopóki go nie wznowisz, nic się nie uruchomi. Cały przykład pokazuje kształt rozwiązania i nie był uruchamiany na koncie Snowflake.`),
        h3('Co może pójść źle'),
        list(
          `<b>Nieaktualny stream.</b> Stream wylicza zmiany z historii wersji tabeli, więc zależy od tego, jak długo tabela trzyma stare wersje. Ten czas to <b>retencja</b>. Gdy offset wypadnie poza retencję tabeli źródłowej, stream staje się nieaktualny (stale) i trzeba go utworzyć od nowa. Dla streamu, którego nikt nie konsumuje, Snowflake wydłuża retencję domyślnie do 14 dni, niezależnie od edycji. Termin pokazuje kolumna STALE_AFTER w <code>SHOW STREAMS</code>.`,
          `<b>Przeciągnięty task.</b> Jeśli task jeszcze działa, gdy przychodzi pora następnego uruchomienia, to uruchomienie jest pomijane. Domyślnie jednocześnie działa tylko jedno uruchomienie grafu zadań, czyli tasków połączonych zależnościami.`,
          `<b>Cicho wstrzymany task.</b> Graf zadań jest domyślnie wstrzymywany po 10 kolejnych nieudanych uruchomieniach. Nikt nie konsumuje wtedy streamu, a czas do jego nieaktualności płynie.`,
          `<b>Odtworzenie tabeli.</b> <code>CREATE OR REPLACE TABLE</code> na źródle usuwa jego historię, więc streamy na nim stają się nieaktualne.`,
          `<b>Uprawnienia.</b> Task działa z uprawnieniami roli, która jest jego właścicielem. Zmiana uprawnień tej roli potrafi zatrzymać pipeline.`
        ),
        h3('Rodzaje streamów i klauzula CHANGES'),
        list(
          `<b>Standard</b> śledzi wstawienia, zmiany i usunięcia i zwraca zmianę netto.`,
          `<b>Append-only</b> śledzi tylko wstawienia. <b>Insert-only</b> jest dla tabel zewnętrznych i tabel Iceberg zarządzanych zewnętrznie.`,
          `Zmiany można odczytać też bez streamu, klauzulą <code>CHANGES</code> w zapytaniu. Wymaga to włączonego śledzenia zmian na tabeli (albo istniejącego streamu) i jawnego punktu startu przez <code>AT</code> lub <code>BEFORE</code>. Nie ma wtedy offsetu, który ktoś za Ciebie przesuwa.`
        ),
        h3('Kiedy zamiast tego dynamic tables'),
        p(`<b>Dynamic table</b> opisujesz, zamiast programować. Podajesz zapytanie <code>SELECT</code> i docelowe opóźnienie (target lag). Snowflake sam śledzi zależności i odświeża wynik.`),
        list(
          `Dokumentacja wskazuje dynamic tables jako zalecane podejście dla nowych potoków SQL z wieloma tabelami. Streams i tasks zaleca wtedy, gdy potrzebujesz procedur składowanych, operacji MERGE albo wywołań funkcji zewnętrznych.`,
          `Ograniczenia: dynamic table jest tylko do odczytu, minimalny target lag to 1 minuta, a rzeczywiste opóźnienie może przekroczyć docelowe, gdy odświeżanie trwa dłużej, niż przewidziano.`
        ),
        known(
          'W dbt',
          `Model incremental też przetwarza tylko nowe wiersze. W bloku <code>is_incremental()</code> filtrujesz po znaczniku czasu większym niż maksimum z tabeli docelowej, a <code>unique_key</code> zamienia zapis na MERGE. Stream robi to samo bez kolumny ze znacznikiem czasu: silnik sam wie, co zmieniło się od ostatniej konsumpcji. Widzi też usunięcia, których filtr po dacie nie pokaże.`,
          `Gdzie porównanie się kończy: w dbt granicę wyznacza zawartość tabeli docelowej, więc model można przebudować w dowolnej chwili. Stream ma własny stan, offset, i można go stracić, gdy stream stanie się nieaktualny.`
        )
      ]
    },
    {
      id: 'time-travel-fail-safe',
      title: 'Time Travel i Fail-safe',
      blocks: [
        p(`W części o mikropartycjach było zdanie: zmiana w tabeli zapisuje nowe mikropartycje, a stare nie znikają od razu. Jak długo zostają i kto ma do nich dostęp? Są dwie fazy.`),
        figure(`Ilustracja. Co dzieje się ze starą wersją danych po zmianie albo usunięciu, dla trzech ustawień tabeli. Okresy pochodzą z dokumentacji. Oś nie jest w skali.`, {
          kind: 'lanes',
          lanes: retention.map(t => ({ label: t.label, steps: retentionSteps(t) }))
        }),
        p(`<b>Time Travel</b> to okres, w którym sam korzystasz ze starych wersji. Możesz zapytać o stan z przeszłości klauzulą <code>AT</code> albo <code>BEFORE</code>, odtworzyć usunięty obiekt przez <code>UNDROP</code> albo sklonować stan z wybranego momentu.`),
        p(`<b>Fail-safe</b> to kolejne 7 dni po zakończeniu Time Travel. Nie da się go skonfigurować, a dane może z niego odzyskać tylko Snowflake, przez zgłoszenie do supportu. To ostatnia deska ratunku, a nie sposób na naprawianie pomyłek.`),
        table(
          ['Typ tabeli', 'Time Travel', 'Fail-safe', 'Płatny storage starej wersji'],
          retention.map(t => [t.label, t.travel === 1 && !t.failsafe ? 'najwyżej 1 dzień' : days(t.travel), t.failsafe ? days(t.failsafe) : 'brak', `${t.travel > 1 || !t.failsafe ? 'najwyżej ' : ''}${days(paidDays(t))}`]),
          'Okresy według dokumentacji Snowflake.'
        ),
        p(`Za obie fazy płacisz jak za zwykły storage. Dokumentacja mówi, że storage jest naliczany tak samo dla danych aktywnych, w Time Travel i w Fail-safe. Stąd ostatnia kolumna: przy ustawieniu standardowym stara wersja kosztuje przez ${paidDays(retention[0])} dni, a przy 90 dniach Time Travel przez ${paidDays(retention[1])}. Na często przepisywanej tabeli oznacza to wielokrotność danych aktywnych.`),
        h3('Szczegóły Time Travel'),
        list(
          `Standardowo 1 dzień, włączony automatycznie. Więcej niż 1 dzień wymaga edycji Enterprise: do 90 dni dla obiektów stałych (permanent).`,
          `Tabele transient i temporary mają 0 albo 1 dzień i nie mają Fail-safe. Są tańsze, ale po upływie Time Travel danych nie da się odzyskać. Nadają się dla tabel, które umiesz odtworzyć ze źródła.`,
          `Okres ustawia parametr <code>DATA_RETENTION_TIME_IN_DAYS</code>.`,
          `Punkt w przeszłości podajesz jako znacznik czasu, przesunięcie względem teraz albo identyfikator instrukcji.`
        ),
        h3('Szczegóły Fail-safe'),
        list(
          `7 dni, bez możliwości zmiany. Zaczyna się zaraz po Time Travel.`,
          `Dokumentacja opisuje go jako usługę best effort, czyli bez gwarancji wyniku. Odzyskanie danych może trwać od kilku godzin do kilku dni.`,
          `Zamiast polegać na Fail-safe, dokumentacja zaleca funkcję backupów Snowflake.`
        ),
        h3('Przykład: błąd zauważony po 10 dniach'),
        p(`Ktoś wykonał błędny <code>UPDATE</code> na tabeli permanent z retencją 1 dnia. Zauważono to po 10 dniach. Time Travel skończył się po pierwszym dniu. Przez kolejne 7 dni, czyli do ósmego dnia, stara wersja była w Fail-safe i odzyskać ją mógł tylko Snowflake. Po 10 dniach nie ma jej już wcale.`),
        p(`Wniosek praktyczny: retencję dobiera się do tego, jak szybko zauważysz błąd, i do tego, ile kosztuje storage starych wersji tej konkretnej tabeli. Dlatego 90 dni na wszystkich tabelach to zły odruch: na często przepisywanej tabeli oznacza w storage wielokrotność danych aktywnych.`)
      ]
    },
    {
      id: 'klony',
      title: 'Zero-copy cloning: kopia, która nic nie kopiuje',
      blocks: [
        p(`Potrzebujesz kopii tabeli o rozmiarze terabajta, żeby przetestować zmianę. Kopiowanie danych trwałoby długo i podwoiło storage. W Snowflake nie trzeba niczego kopiować.`),
        p(`Tabela to w gruncie rzeczy lista wskazań na mikropartycje. Kopię można więc zrobić, tworząc drugą listę, która wskazuje na te same mikropartycje. Tak działa <code>CREATE ... CLONE</code>, czyli <b>zero-copy cloning</b>. Zobaczmy to na tabeli z czterema mikropartycjami: A, B, C i D.`),
        table(
          ['Krok', 'Źródło wskazuje na', 'Klon wskazuje na', 'Mikropartycje w storage'],
          lesson.history.steps.map(s => [s.label, s.source.join(', '), s.clone.join(', '), String(cloneStored(s))]),
          'Ilustracja: litera z primem oznacza nową wersję mikropartycji.'
        ),
        list(
          `<b>Po CLONE.</b> Klon wskazuje na te same cztery mikropartycje. Nic nie zostało skopiowane, więc klon powstaje szybko i nie zajmuje dodatkowego storage.`,
          `<b>Po UPDATE w klonie.</b> Zmiana zapisała nową mikropartycję D', która należy tylko do klonu. Źródło nic o niej nie wie. Od tej chwili oba obiekty są niezależne.`,
          `<b>Po UPDATE w źródle.</b> Źródło zapisało A'. Stara A nie należy już do bieżącej wersji źródła, ale klon nadal na nią wskazuje, więc nie można jej usunąć.`
        ),
        p(`Klon jest więc darmowy w chwili utworzenia. Kosztuje dopiero to, czym klon i źródło zaczną się różnić: nowe mikropartycje po zmianach oraz stare, których nie da się usunąć, dopóki ktoś na nie wskazuje. Długo żyjący klon często zmienianej tabeli po cichu zbiera storage.`),
        p(`Ile dokładnie kosztuje zmiana w klonie? Załóżmy klon tabeli 1 TB i aktualizację 1% wierszy. Dodatkowy storage to tyle, ile zajmują nowo zapisane mikropartycje. Ile ich będzie, zależy od tego, w ilu mikropartycjach leżały zmieniane wiersze, bo mikropartycja jest przepisywana w całości. Jeden procent wierszy rozsiany po całej tabeli może przepisać dużą jej część.`),
        h3('Do czego się to przydaje'),
        list(
          `<b>Naprawa po błędzie.</b> Klon można utworzyć ze stanu z przeszłości: <code>CREATE TABLE t_restore CLONE t AT (...)</code>. Klonujesz stan sprzed pomyłki i porównujesz z bieżącym. Działa to tylko w okresie Time Travel.`,
          `<b>Testy na danych produkcyjnych.</b> Klon daje kopię danych wejściowych bez kosztu storage na starcie. Na tym opierał się powtarzalny test w części o metodzie.`
        ),
        h3('Co zaskakuje przy klonowaniu bazy albo schematu'),
        list(
          `<b>Uprawnienia.</b> Klon nie dziedziczy uprawnień nadanych na sam klonowany kontener, ale obiekty w środku zachowują swoje. Przy klonie pojedynczej tabeli uprawnienia kopiuje dopiero <code>COPY GRANTS</code>.`,
          `<b>Taski</b> w klonie są domyślnie wstrzymane. <b>Automatic clustering</b> na sklonowanej tabeli też.`,
          `<b>Streamy.</b> Rekordy, których nie skonsumowano przed klonowaniem, są w sklonowanym streamie niedostępne.`,
          `<b>Pipe'y</b> odwołujące się do wewnętrznego stage'a nie są klonowane. Wewnętrzne stage'e nazwane są klonowane tylko z klauzulą <code>INCLUDE INTERNAL STAGES</code>.`
        )
      ]
    },
    {
      id: 'role',
      title: 'Kto co widzi: role i hierarchia',
      blocks: [
        p(`Zespół ma pięćdziesiąt osób i kilkaset tabel. Gdyby uprawnienia nadawać ludziom do tabel, każda zmiana w zespole oznaczałaby dziesiątki poprawek, a nikt nie umiałby odpowiedzieć, kto co widzi.`),
        p(`W Snowflake uprawnień nie nadaje się ludziom. Uprawnienie dostaje <b>rola</b>, a rolę dostaje użytkownik albo inna rola. To drugie jest kluczowe: gdy rola dostaje inną rolę, powstaje <b>hierarchia</b>, a rola wyżej dziedziczy wszystko, co mają role pod nią. Ten model nazywa się <b>RBAC</b> (role-based access control). Dokumentacja opisuje kontrolę dostępu Snowflake jako połączenie kilku podejść i dla środowisk produkcyjnych zaleca właśnie RBAC.`),
        figure(`Ilustracja. Dwie gałęzie tej samej przykładowej hierarchii. Rola wyżej dziedziczy wszystko, co mają role pod nią. Przy każdej roli są tylko uprawnienia nadane jej wprost. Role i uprawnienia wymyślone.`, {
          kind: 'stacks',
          columns: [branch('Gałąź odczytu', ['sysadmin', 'analyst', 'sales_read']), branch('Gałąź zapisu', ['sysadmin', 'engineer', 'sales_write', 'sales_read'])]
        }),
        p(`Czytaj każdą kolumnę od dołu. <code>SALES_READ</code> ma tylko odczyt tabel jednego schematu. <code>ANALYST</code> ma nadaną rolę <code>SALES_READ</code> i prawo do używania warehouse'u BI, więc analityk może czytać tabele sprzedaży i ma na czym uruchomić zapytanie. <code>DATA_ENGINEER</code> dostaje zapis przez <code>SALES_WRITE</code>, a ta dziedziczy odczyt, żeby nie powtarzać uprawnień. <code>SYSADMIN</code> ma nadane obie role funkcyjne, więc może wszystko, co one.`),
        p(`Kto zatem może czytać tabele schematu SALES? Każdy, kto ma <code>SALES_READ</code> albo dowolną rolę nad nią: <code>ANALYST</code>, <code>SALES_WRITE</code>, <code>DATA_ENGINEER</code> albo <code>SYSADMIN</code>.`),
        h3('Least privilege to struktura, nie pojedynczy grant'),
        p(`<b>Least privilege</b> znaczy „tylko tyle uprawnień, ile trzeba”. W Snowflake realizuje się to układem ról. Na dole są wąskie <b>role dostępu</b> do konkretnych obiektów. Nie nadaje się ich ludziom bezpośrednio. Z nich składa się <b>role funkcyjne</b>, które odpowiadają pracy człowieka albo usługi i zbierają potrzebne role dostępu oraz warehouse. Na górze są role systemowe.`),
        p(`Technicznie to takie same role. Dokumentacja mówi, że między rolą dostępu a funkcyjną nie ma różnicy technicznej, różni je tylko zastosowanie. Zysk jest organizacyjny: zmiana uprawnień całego zespołu to jeden grant, a audyt to przejście po hierarchii.`),
        h3('Role systemowe'),
        list(
          `<b>ACCOUNTADMIN</b> obejmuje SYSADMIN i SECURITYADMIN. Zalecenia z dokumentacji: nie używać jej do tworzenia obiektów, nie ustawiać jako roli domyślnej, nie używać w skryptach automatycznych, wymagać MFA i przypisać co najmniej dwóm użytkownikom.`,
          `<b>SECURITYADMIN</b> zarządza uprawnieniami globalnie oraz użytkownikami i rolami. <b>USERADMIN</b> służy tylko do zarządzania użytkownikami i rolami.`,
          `<b>SYSADMIN</b> tworzy warehouse'y, bazy i inne obiekty. Dokumentacja zaleca podpinać pod nią najwyższe role własne, żeby administratorzy mogli zarządzać ich obiektami.`,
          `<b>PUBLIC</b> jest automatycznie nadana każdemu użytkownikowi i każdej roli.`
        ),
        warn(
          'ACCOUNTADMIN nie jest superużytkownikiem',
          `Domyślnie nie może zmienić ani usunąć obiektów utworzonych przez rolę własną, która nie jest podpięta do hierarchii systemowej. Dlatego role własne „wiszące w powietrzu” to realny problem: ich obiektami nie zarządza nikt poza nimi.`
        ),
        h3('Cztery pojęcia, które warto znać'),
        list(
          `<b>Właściciel.</b> Każdy obiekt ma jedną rolę będącą właścicielem, domyślnie tę, którą go utworzono.`,
          `<b>Managed access schema.</b> W takim schemacie o uprawnieniach do obiektów decyduje właściciel schematu albo rola z uprawnieniem MANAGE GRANTS, a nie właściciele poszczególnych obiektów.`,
          `<b>Future grants.</b> Definiują uprawnienia dla obiektów, które dopiero powstaną. Bez nich każda nowa tabela wymaga osobnego nadania.`,
          `<b>Role drugorzędne</b> (secondary roles). Dają uprawnienia do zapytań i DML, ale prawo do tworzenia obiektów pochodzi tylko z roli głównej.`
        )
      ]
    },
    {
      id: 'izolacja-sharing',
      title: 'Izolacja tenantów i secure data sharing',
      blocks: [
        p(`Na jednej platformie pracuje wielu klientów albo zespołów. Każdy taki odbiorca to <b>tenant</b>. Jak mocno ich od siebie oddzielić? Nie ma jednej poprawnej odpowiedzi. To wybór na skali, od najmocniejszej izolacji do najtańszej.`),
        table(lesson.access.tenantColumns, lesson.access.tenants),
        p(`Trzy pierwsze wiersze dotyczą danych, czwarty mocy obliczeniowej, więc można je łączyć. Wybór poziomu to ocena ryzyka i skali, a nie reguła z dokumentacji. Im droższy byłby błąd izolacji, tym wyżej w tabeli.`),
        h3('Row access policy'),
        p(`Trzeci wiersz wymaga wyjaśnienia. <b>Row access policy</b> to reguła przypięta do tabeli, która decyduje, które wiersze zwrócić danemu zapytaniu. Jest wyliczana w czasie zapytania. Wszyscy tenanci siedzą we wspólnych tabelach, a każdy widzi tylko swoje wiersze.`),
        list(
          `Wymaga edycji Enterprise.`,
          `Dokumentacja zaleca w politykach funkcję <code>IS_ROLE_IN_SESSION</code>, która uwzględnia hierarchię ról.`,
          `Polityka kosztuje przy każdym zapytaniu. Według dokumentacji polityki z prostymi wyrażeniami działają zwykle lepiej niż te, które sięgają do tabel mapujących. Snowflake musi też skanować kolumny związane z polityką, nawet gdy zapytanie ich nie używa. Pomaga klastrowanie po atrybutach używanych w polityce.`,
          `Polityka nie blokuje wstawiania wierszy. Kontrola zapisu to nadal uprawnienia ról.`
        ),
        h3('Secure data sharing'),
        p(`Czasem dane trzeba pokazać komuś spoza konta: partnerowi albo klientowi. Klasyczne rozwiązanie to eksport plików, czyli kopia, która od razu zaczyna się starzeć.`),
        p(`W Snowflake dostawca tworzy <b>share</b>, dodaje do niego obiekty i wskazuje konta odbiorców. Odbiorca tworzy z niego bazę. Dokumentacja mówi, że żadne dane nie są przy tym kopiowane ani przesyłane między kontami.`),
        list(
          `Udostępnione obiekty są u odbiorcy tylko do odczytu i nie zajmują jego storage.`,
          `Odbiorca płaci wyłącznie za compute, którym je odpytuje. Dostawca nadal płaci za storage.`,
          `Bezpośredni share działa tylko między kontami w tym samym regionie. Dla innych regionów i chmur dokumentacja wskazuje listing z auto-fulfillment.`,
          `Odbiorca bez konta Snowflake może dostać <b>reader account</b>: konto utworzone i opłacane przez dostawcę.`
        ),
        p(`To działa dzięki architekturze z początku rozdziału. Dane leżą raz, a dostęp do nich to sprawa metadanych i uprawnień w warstwie cloud services. Ten sam pomysł stoi za klonami: nowy obiekt to nowe wskazania, a nie nowe dane.`)
      ]
    },
    {
      id: 'porownanie',
      title: 'Snowflake, klasyczna baza, Spark: czym to się różni',
      blocks: [
        p(`Mechanizm najłatwiej sprawdzić, porównując go z czymś innym. Poniżej sześć tematów z tego rozdziału w trzech światach.`),
        table(lesson.interview.compareColumns, lesson.interview.compare, 'Kolumny o klasycznej bazie i Sparku to uogólnienia z wiedzy ogólnej, a nie opis konkretnego produktu.'),
        p(`Wspólny wątek: w Snowflake format plików, podział na mikropartycje, statystyki i większość planu są zarządzane za Ciebie. Zostaje mało dźwigni: SQL, ułożenie danych oraz rozmiar i liczba klastrów. Gdy rozmowa dotyczy konkretnego systemu, odnoś porównanie do niego, a nie do całej kategorii.`)
      ]
    }
  ],
  keyPoints: [
    `<b>Trzy warstwy.</b> Storage przechowuje dane, compute (warehouse) wykonuje zapytania, cloud services planuje, pilnuje uprawnień i trzyma metadane. O tym, ile pracy dostanie warehouse, decydują wcześniej metadane.`,
    `<b>Storage i compute są rozdzielone.</b> Daje to izolację obciążeń, zmianę mocy bez ruszania danych i osobne rozliczenie. Ceną jest to, że warehouse musi dane pobrać, więc liczą się pruning i cache.`,
    `<b>Pruning zależy od ułożenia danych, nie od samego filtra.</b> Snowflake zna minimum i maksimum każdej kolumny w każdej mikropartycji i pomija te, w których szukanej wartości być nie może. Sprawdzasz to przez Partitions scanned i Partitions total.`,
    `<b>Mikropartycji się nie poprawia, tylko zapisuje nowe.</b> Stare zostają na jakiś czas. Z tego wynikają streamy, Time Travel, Fail-safe i klony, a także koszt storage przy częstych zmianach.`,
    `<b>Clustering key to wymiana.</b> Płacisz za utrzymywanie porządku w tle, żeby zapytania czytały mniej. Opłaca się na dużej tabeli, często czytanej i rzadko zmienianej, filtrowanej po tych samych kolumnach.`,
    `<b>Są dwa cache.</b> Result cache trzyma gotowe wyniki w cloud services i działa tylko dla identycznego zapytania na niezmienionych danych. Cache warehouse'u trzyma dane tabel na lokalnym dysku i znika przy wstrzymaniu.`,
    `<b>Auto-suspend to kompromis</b> między płaceniem za bezczynność a pustym cache i minimum 60 sekund przy każdym starcie.`,
    `<b>Najpierw diagnoza, potem rozmiar.</b> Cztery pytania: czy zapytanie czekało, ile przeczytało, czy któryś operator mnoży wiersze, czy operacja zmieściła się w pamięci. Większy warehouse odpowiada tylko na ostatnie.`,
    `<b>Scale up pomaga jednemu ciężkiemu zapytaniu, scale out wielu zapytaniom naraz.</b> Rozliczenie jest sekundowe, więc koszt to stawka razy czas razy liczba klastrów. Większy warehouse nie musi kosztować więcej.`,
    `<b>Strojenie to metoda:</b> cel, powtarzalny test, rozbicie czasu, jedna zmiana naraz, rachunek kosztu, zabezpieczenie wyniku.`,
    `<b>Resource monitor widzi tylko warehouse'y</b> i potrafi je wstrzymać. Budżet obejmuje też serverless, ale domyślnie tylko powiadamia i widzi zużycie z opóźnieniem. Żadne z nich nie pilnuje storage.`,
    `<b>Stream przechowuje offset, nie dane.</b> Przesuwa go tylko zatwierdzona transakcja DML czytająca ze streamu. Każdy odbiorca potrzebuje własnego streamu, a stream może stać się nieaktualny.`,
    `<b>Time Travel jest dla Ciebie, Fail-safe tylko dla Snowflake.</b> Za oba płacisz jak za zwykły storage. Retencję dobiera się do tego, jak szybko zauważysz błąd.`,
    `<b>Klon jest darmowy w chwili utworzenia.</b> Kosztuje to, czym klon i źródło zaczną się różnić, oraz stare mikropartycje, których nie da się usunąć, dopóki klon na nie wskazuje.`,
    `<b>Uprawnienia dostaje rola, nie człowiek.</b> Rola wyżej w hierarchii dziedziczy role pod nią. Least privilege to układ: role dostępu na dole, funkcyjne nad nimi, systemowe na górze.`,
    `<b>Secure data sharing niczego nie kopiuje.</b> Odbiorca czyta dane dostawcy i płaci tylko za swój compute.`
  ],
  glossary: [
    { term: 'Auto-suspend i auto-resume', def: 'Ustawienia warehouse\'u. Pierwsze wstrzymuje go po okresie bezczynności, drugie wznawia, gdy przyjdzie zapytanie. Oba są domyślnie włączone.' },
    { term: 'Automatic Clustering', def: 'Usługa Snowflake, która w tle przepisuje mikropartycje tabeli z clustering key tak, żeby ich zakresy przestały się nakładać. Zużywa kredyty.' },
    { term: 'Budżet (budget)', def: 'Miesięczny limit kredytów dla konta albo grupy obiektów. Obejmuje też funkcje serverless. Domyślnie powiadamia, gdy prognoza wskazuje przekroczenie.' },
    { term: 'Cache warehouse\'u', def: 'Dane tabel pobrane z object storage i zostawione na lokalnym dysku warehouse\'u. Pomaga kolejnym zapytaniom, znika przy wstrzymaniu.' },
    { term: 'Cloud services', def: 'Warstwa Snowflake, która sprawdza uprawnienia, planuje zapytania i trzyma metadane.' },
    { term: 'Clustering depth', def: 'Średnia głębokość nakładających się mikropartycji dla wskazanych kolumn. Im mniejsza, tym lepiej. Wskazówka, nie miara absolutna.' },
    { term: 'Clustering key', def: 'Kolumny albo wyrażenia, po których Snowflake ma utrzymywać dane w porządku, żeby pruning mógł pomijać mikropartycje.' },
    { term: 'Compute serverless', def: 'Moc obliczeniowa, którą zarządza Snowflake, a nie Ty. Korzystają z niej m.in. Snowpipe, automatic clustering i zadania serverless. Osobna pozycja na rachunku.' },
    { term: 'Dynamic table', def: 'Tabela opisana zapytaniem SELECT i docelowym opóźnieniem. Snowflake sam ją odświeża. Tylko do odczytu.' },
    { term: 'Eksplodujący join (exploding join)', def: 'Join, który oddaje wielokrotnie więcej wierszy, niż dostaje. Zwykle skutek nieunikalnego klucza albo brakującej kolumny w warunku.' },
    { term: 'Fail-safe', def: '7 dni po zakończeniu Time Travel, w których dane tabel permanent może odzyskać tylko Snowflake. Nie da się go skonfigurować.' },
    { term: 'Future grants', def: 'Uprawnienia zdefiniowane z góry dla obiektów, które dopiero powstaną.' },
    { term: 'Izolacja obciążeń (workload isolation)', def: 'Różne rodzaje pracy mają osobne warehouse\'y, więc nie zabierają sobie mocy.' },
    { term: 'Kardynalność', def: 'Liczba różnych wartości w kolumnie. Flaga ma niską, znacznik czasu wysoką.' },
    { term: 'Kredyt', def: 'Jednostka, w której Snowflake rozlicza moc obliczeniową.' },
    { term: 'Least privilege', def: 'Zasada: tylko tyle uprawnień, ile trzeba. W Snowflake realizowana układem ról.' },
    { term: 'Managed access schema', def: 'Schemat, w którym o uprawnieniach do obiektów decyduje właściciel schematu, a nie właściciele poszczególnych obiektów.' },
    { term: 'Metadane', def: 'Zapisane informacje o danych, na przykład zakres wartości każdej kolumny w każdej mikropartycji. Trzyma je warstwa cloud services.' },
    { term: 'Mikropartycja', def: 'Porcja wierszy tabeli zapisana jako jedna całość, tworzona automatycznie w kolejności ładowania: 50–500 MB danych przed kompresją.' },
    { term: 'Multi-cluster warehouse', def: 'Jeden warehouse z kilkoma klastrami tego samego rozmiaru. Obsługuje więcej zapytań naraz. Wymaga edycji Enterprise.' },
    { term: 'Object storage', def: 'Chmurowy magazyn plików. Tam leżą dane tabel Snowflake.' },
    { term: 'Offset', def: 'Punkt w historii wersji tabeli, który pamięta stream. Od niego liczona jest różnica do stanu bieżącego.' },
    { term: 'Operator', def: 'Krok wykonania zapytania w Query Profile, na przykład TableScan, Join, Aggregate albo Sort.' },
    { term: 'Partition pruning', def: 'Pomijanie mikropartycji na podstawie metadanych, zanim warehouse cokolwiek przeczyta.' },
    { term: 'Query Acceleration Service', def: 'Usługa, która przenosi część pracy kwalifikującego się zapytania z dużym skanem na zasoby serverless. Wymaga edycji Enterprise.' },
    { term: 'Query Profile', def: 'Widok wykonanego zapytania jako drzewa operatorów, z czasem i statystykami każdego z nich.' },
    { term: 'RBAC', def: 'Role-based access control. Uprawnienie dostaje rola, a rolę dostaje użytkownik albo inna rola.' },
    { term: 'Reader account', def: 'Konto utworzone i opłacane przez dostawcę danych dla odbiorcy, który nie ma własnego konta Snowflake.' },
    { term: 'Resource monitor', def: 'Limit kredytów dla warehouse\'ów. Po jego przekroczeniu może powiadomić albo wstrzymać warehouse. Nie widzi funkcji serverless.' },
    { term: 'Result cache', def: 'Zapisane gotowe wyniki zapytań w warstwie cloud services. Działa dla identycznego zapytania na niezmienionych danych.' },
    { term: 'Retencja', def: 'Czas, przez który tabela trzyma stare wersje danych.' },
    { term: 'Rola dostępu i rola funkcyjna', def: 'Rola dostępu ma wąskie uprawnienia do obiektów. Rola funkcyjna odpowiada pracy człowieka albo usługi i zbiera role dostępu. Technicznie to takie same role.' },
    { term: 'Row access policy', def: 'Reguła przypięta do tabeli, która decyduje, które wiersze zwrócić danemu zapytaniu. Wymaga edycji Enterprise.' },
    { term: 'Scale out', def: 'Więcej klastrów tego samego rozmiaru. Pomaga, gdy zapytań jest wiele naraz.' },
    { term: 'Scale up', def: 'Większy rozmiar warehouse\'u. Pomaga pojedynczemu ciężkiemu zapytaniu.' },
    { term: 'Search optimization', def: 'Osobna usługa do wyszukiwania pojedynczych wierszy w dużej tabeli. Wymaga edycji Enterprise i ma własny koszt.' },
    { term: 'Secure data sharing', def: 'Udostępnianie obiektów innemu kontu bez kopiowania danych. U odbiorcy są tylko do odczytu.' },
    { term: 'Spilling', def: 'Operacja nie mieści się w pamięci, więc warehouse odkłada dane pośrednie na lokalny dysk, a gdy go zabraknie, do zdalnego storage.' },
    { term: 'Stream', def: 'Obiekt, który pamięta offset na tabeli i zwraca zmiany od tego punktu. Sam nie przechowuje danych.' },
    { term: 'Tabela transient', def: 'Typ tabeli z najwyżej 1 dniem Time Travel i bez Fail-safe. Dla danych, które umiesz odtworzyć.' },
    { term: 'Task', def: 'SQL albo procedura uruchamiana według harmonogramu albo po pojawieniu się danych w streamie. Nowy task jest wstrzymany.' },
    { term: 'Tenant', def: 'Klient albo zespół, który korzysta ze wspólnej platformy i ma widzieć tylko swoje dane.' },
    { term: 'Time Travel', def: 'Okres, w którym sam możesz odczytać, sklonować albo odtworzyć starą wersję danych.' },
    { term: 'Virtual warehouse', def: 'Klaster obliczeniowy w Snowflake. Wykonuje zapytania. Każdy jest niezależny i nie dzieli zasobów obliczeniowych z innymi.' },
    { term: 'Współbieżność (concurrency)', def: 'Wiele zapytań naraz. Gdy brakuje zasobów, zapytania czekają w kolejce.' },
    { term: 'Zero-copy cloning', def: 'Kopia obiektu, która wskazuje na te same mikropartycje co źródło. W chwili utworzenia nie zajmuje dodatkowego storage.' },
    { term: 'Zmiana netto', def: 'Różnica między stanem z offsetu a stanem bieżącym, bez kroków pośrednich. To zwraca stream typu standard.' }
  ],
  misconceptions: [
    { myth: 'Warehouse przechowuje dane.', fact: 'Warehouse to moc obliczeniowa z lokalnym cache. Dane tabel leżą w warstwie storage i przetrwają wstrzymanie albo usunięcie warehouse\'u.' },
    { myth: 'Filtr w WHERE zawsze ogranicza skan.', fact: 'Ogranicza tylko wtedy, gdy zakresy wartości w mikropartycjach pozwalają coś wykluczyć i gdy warunek w ogóle nadaje się do pruningu.' },
    { myth: 'Partitions scanned równe Partitions total oznacza, że brakuje indeksu.', fact: 'W Snowflake pytanie brzmi inaczej: jak dane są ułożone względem kolumny z filtra i czy warunek pozwala pomijać mikropartycje.' },
    { myth: 'Clustering key warto dodać do każdej dużej tabeli.', fact: 'Usługa kosztuje przy każdej zmianie tabeli. Zysk jest tylko tam, gdzie zapytania filtrują po kluczu, a tabela zmienia się rzadko.' },
    { myth: 'Dobra clustering depth oznacza, że clustering działa.', fact: 'Dokumentacja mówi, że to nie jest miara absolutna. O wyniku świadczy wydajność zapytań.' },
    { myth: 'Snowflake cache\'uje dane, więc drugie zapytanie jest szybkie.', fact: 'To dwa mechanizmy. Jeden oddaje gotowy wynik bez wykonania zapytania, drugi oszczędza tylko pobieranie danych i znika przy wstrzymaniu warehouse\'u.' },
    { myth: 'Result cache działa tylko dla tego samego użytkownika.', fact: 'Warunek dotyczy uprawnień roli do użytych tabel, a nie tożsamości użytkownika.' },
    { myth: 'Im krótszy auto-suspend, tym taniej.', fact: 'Każdy start to minimum 60 sekund rozliczenia i pusty lokalny cache. Wartość dobiera się do przerw w obciążeniu.' },
    { myth: 'Zwiększę warehouse, to zniknie kolejka.', fact: 'Kolejka to problem współbieżności. Dokumentacja mówi, że zmiana rozmiaru nie jest do tego przeznaczona. Pomagają osobne warehouse\'y albo multi-cluster.' },
    { myth: 'Multi-cluster przyspieszy ciężkie zapytanie.', fact: 'Pojedyncze zapytanie nadal działa na jednym klastrze. Dodatkowe klastry obsługują inne zapytania.' },
    { myth: 'Większy warehouse zawsze kosztuje więcej.', fact: 'Liczy się stawka razy czas. Gdy zapytanie skraca się proporcjonalnie, koszt jest ten sam, a gdy znika zdalny spilling, bywa niższy.' },
    { myth: 'Zmiana rozmiaru przyspieszy zapytanie, które już trwa.', fact: 'Nowe zasoby obsługują tylko zapytania z kolejki i nowe. Trwające zapytanie trzeba uruchomić ponownie.' },
    { myth: 'Spilling na lokalny dysk i do zdalnego storage to to samo.', fact: 'Zdalny jest dużo wolniejszy i to on jest sygnałem alarmowym.' },
    { myth: 'Resource monitor to twardy limit całego rachunku.', fact: 'Widzi tylko warehouse\'y i wspierające je cloud services, a warehouse może jeszcze zużywać kredyty po osiągnięciu limitu.' },
    { myth: 'Budżet wyłączy to, co przekroczy limit.', fact: 'Domyślnie tylko powiadamia i widzi zużycie z opóźnieniem. Wstrzymanie czegokolwiek to procedura, którą trzeba napisać samemu.' },
    { myth: 'SELECT ze streamu go konsumuje.', fact: 'Offset przesuwa dopiero zatwierdzona transakcja DML czytająca ze streamu. Sam odczyt można powtarzać dowolnie.' },
    { myth: 'Stream trzyma kopię zmienionych wierszy.', fact: 'Trzyma offset. Zmiany wylicza z historii wersji tabeli, dlatego zależy od jej retencji.' },
    { myth: 'Fail-safe to dłuższy Time Travel.', fact: 'Z Fail-safe dane odzyskuje tylko Snowflake, bez gwarancji wyniku i nie od ręki. Użytkownik nie ma do niego dostępu.' },
    { myth: 'Klon nic nie kosztuje.', fact: 'Nie kosztuje w chwili utworzenia. Potem płacisz za rozbieżności i za stare mikropartycje, które klon utrzymuje przy życiu.' },
    { myth: 'Row access policy chroni też przed zapisem cudzych wierszy.', fact: 'Polityka decyduje tylko o tym, które wiersze zwrócić. Wstawiania nie blokuje: zapis kontrolują uprawnienia ról.' },
    { myth: 'Data sharing kopiuje dane do odbiorcy.', fact: 'Nic nie jest kopiowane ani przesyłane. Odbiorca czyta dane dostawcy i płaci za własny compute.' }
  ],
  sourcesNote:
    'Fakty pochodzą z oficjalnej dokumentacji Snowflake i są spisane w docs/verified-facts.md, w sekcji „Lekcja 10”. Strony nie mają numeru wersji, więc obowiązuje data sprawdzenia. Jedno zdanie o dbt pochodzi z sekcji „Lekcja 06”. Rozdział nie zawiera pomiarów: repozytorium nie ma konta Snowflake. Kilka rzeczy jest podanych z wiedzy ogólnej albo jako wniosek, a nie cytat: mikropartycje nie są poprawiane w miejscu, pruning odbywa się w warstwie cloud services przed wykonaniem zapytania, wynik z result cache nie wymaga działającego warehouse\'u, sortowanie przy ładowaniu, reguły robocze dla auto-suspend, czas w kolejce widoczny w historii zapytań, budżet nie obejmuje storage, kolumny o klasycznej bazie i Sparku w porównaniu, metoda sześciu kroków.',
  sources: [
    { label: 'Snowflake: Key concepts and architecture', url: 'https://docs.snowflake.com/en/user-guide/intro-key-concepts' },
    { label: 'Snowflake: Micro-partitions & Data Clustering', url: 'https://docs.snowflake.com/en/user-guide/tables-clustering-micropartitions' },
    { label: 'Snowflake: Clustering Keys & Clustered Tables', url: 'https://docs.snowflake.com/en/user-guide/tables-clustering-keys' },
    { label: 'Snowflake: Automatic Clustering', url: 'https://docs.snowflake.com/en/user-guide/tables-auto-reclustering' },
    { label: 'Snowflake: Search optimization service', url: 'https://docs.snowflake.com/en/user-guide/search-optimization-service' },
    { label: 'Snowflake: Query Profile', url: 'https://docs.snowflake.com/en/user-guide/ui-query-profile' },
    { label: 'Snowflake: Queries too large to fit in memory', url: 'https://docs.snowflake.com/en/user-guide/performance-query-warehouse-memory' },
    { label: 'Snowflake: Using Persisted Query Results', url: 'https://docs.snowflake.com/en/user-guide/querying-persisted-results' },
    { label: 'Snowflake: Warehouse considerations', url: 'https://docs.snowflake.com/en/user-guide/warehouses-considerations' },
    { label: 'Snowflake: Overview of warehouses', url: 'https://docs.snowflake.com/en/user-guide/warehouses-overview' },
    { label: 'Snowflake: Multi-cluster warehouses', url: 'https://docs.snowflake.com/en/user-guide/warehouses-multicluster' },
    { label: 'Snowflake: Reducing queues', url: 'https://docs.snowflake.com/en/user-guide/performance-query-warehouse-queue' },
    { label: 'Snowflake: Parameters', url: 'https://docs.snowflake.com/en/sql-reference/parameters' },
    { label: 'Snowflake: Query Acceleration Service', url: 'https://docs.snowflake.com/en/user-guide/query-acceleration-service' },
    { label: 'Snowflake: Understanding compute cost', url: 'https://docs.snowflake.com/en/user-guide/cost-understanding-compute' },
    { label: 'Snowflake: Understanding overall cost', url: 'https://docs.snowflake.com/en/user-guide/cost-understanding-overall' },
    { label: 'Snowflake: Understanding storage cost', url: 'https://docs.snowflake.com/en/user-guide/cost-understanding-data-storage' },
    { label: 'Snowflake: Working with resource monitors', url: 'https://docs.snowflake.com/en/user-guide/resource-monitors' },
    { label: 'Snowflake: Monitor credit usage with budgets', url: 'https://docs.snowflake.com/en/user-guide/budgets' },
    { label: 'Snowflake: Budgets, custom actions', url: 'https://docs.snowflake.com/en/user-guide/budgets/custom-actions' },
    { label: 'Snowflake: Budget, GET_REFRESH_TIER', url: 'https://docs.snowflake.com/en/sql-reference/classes/budget/methods/get_refresh_tier' },
    { label: 'Snowflake: Controlling cost', url: 'https://docs.snowflake.com/en/user-guide/cost-controlling-controls' },
    { label: 'Snowflake: Introduction to Streams', url: 'https://docs.snowflake.com/en/user-guide/streams-intro' },
    { label: 'Snowflake: Introduction to tasks', url: 'https://docs.snowflake.com/en/user-guide/tasks-intro' },
    { label: 'Snowflake: Task graphs', url: 'https://docs.snowflake.com/en/user-guide/tasks-graphs' },
    { label: 'Snowflake: Triggered tasks', url: 'https://docs.snowflake.com/en/user-guide/tasks-triggered' },
    { label: 'Snowflake: Dynamic tables', url: 'https://docs.snowflake.com/en/user-guide/dynamic-tables-about' },
    { label: 'Snowflake: Dynamic tables, decision guide', url: 'https://docs.snowflake.com/en/user-guide/dynamic-tables/decision-guide' },
    { label: 'Snowflake: Understanding & using Time Travel', url: 'https://docs.snowflake.com/en/user-guide/data-time-travel' },
    { label: 'Snowflake: Understanding and viewing Fail-safe', url: 'https://docs.snowflake.com/en/user-guide/data-failsafe' },
    { label: 'Snowflake: Storage considerations', url: 'https://docs.snowflake.com/en/user-guide/tables-storage-considerations' },
    { label: 'Snowflake: Cloning considerations', url: 'https://docs.snowflake.com/en/user-guide/object-clone' },
    { label: 'Snowflake: About Secure Data Sharing', url: 'https://docs.snowflake.com/en/user-guide/data-sharing-intro' },
    { label: 'Snowflake: Overview of Access Control', url: 'https://docs.snowflake.com/en/user-guide/security-access-control-overview' },
    { label: 'Snowflake: Access control considerations', url: 'https://docs.snowflake.com/en/user-guide/security-access-control-considerations' },
    { label: 'Snowflake: Understanding row access policies', url: 'https://docs.snowflake.com/en/user-guide/security-row-intro' },
    { label: 'dbt: Snowflake configurations', url: 'https://docs.getdbt.com/reference/resource-configs/snowflake-configs' }
  ]
};

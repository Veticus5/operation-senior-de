import * as lesson from '../databricks/platform-delta-lake/lesson';
import { deeper, figure, h3, known, list, p, sql, steps, table, tables, warn, yaml } from './blocks';
import type { KbChapter } from './types';

/**
 * Knowledge Base, rozdział: Databricks Platform & Delta Lake.
 *
 * Zakres jest ten sam co w lekcji 08, ale to osobny tekst: podręcznik do czytania i powtórek, bez interakcji.
 * Dane przykładów (przerwany job, pięć commitów tabeli orders, pary równoległych zapisów, cel i źródło MERGE,
 * paczki i tryby zapisu, retencje, stany kompaktowania, układy plików, wynik CDF, części architektury,
 * rodzaje compute, obiekty Unity Catalog, kod pipeline'u i bundle'a, wymiary porównania platform, scenariusze)
 * są importowane z lekcji, żeby oba materiały pokazywały te same liczby. Proza jest napisana od nowa.
 *
 * Skąd są fakty: docs/verified-facts.md, sekcja „Lekcja 08" oraz wpisy o predictive optimization i Z-order
 * z sekcji „Dokumentacja". Rozdział nie wprowadza nowych faktów.
 * Lekcja NIE MA labu (repozytorium nie ma zależności delta-spark), więc rozdział NIE PODAJE pomiarów.
 * Liczby w ilustracjach i tabelach są dobrane do przykładu i tak są podpisane. Liczby z dokumentacji
 * są podpisane jako liczby z dokumentacji. Liczby wyliczane poniżej z danych lekcji sprawdza test chapter.test.ts.
 *
 * Kod SQL i YAML ma linie do 44 znaków, żeby w PDF na telefon nie trzeba było go zawijać (pilnuje tego test).
 * W tekście nie ma strzałek: nie ma ich w czcionkach osadzanych w PDF.
 */

/* ---- przerwany job: te same pliki co w lekcji ---- */

const rowsIn = (files: { rows: number }[]) => files.reduce((n, f) => n + f.rows, 0);
const crashBefore = rowsIn(lesson.crash.oldFiles);
const crashWritten = lesson.crash.newFiles.filter(f => f.written);
const crashSeen = crashBefore + rowsIn(crashWritten);
const crashPlanned = crashBefore + rowsIn(lesson.crash.newFiles);

/* ---- log: odtworzenie listy plików z akcji add i remove, jak w protokole ---- */

const commits = lesson.log.commits;
const short = (path: string) => path.replace('.parquet', '');
/** Pliki, które po odtworzeniu commitów od 0 do `version` zostały na liście. */
const filesAt = (version: number) => {
  const live = new Map<string, lesson.DataFile>();
  for (const c of commits.filter(x => x.version <= version)) {
    for (const path of c.remove) live.delete(path);
    for (const file of c.add) live.set(file.path, file);
  }
  return [...live.values()];
};
const rowsAt = (version: number) => filesAt(version).flatMap(f => f.rows).sort((a, b) => a.id - b.id);
const ordersAt = (version: number) => ({
  name: `orders, wersja ${version}`,
  key: ['id'],
  columns: ['id', 'customer', 'status', 'amount'],
  rows: rowsAt(version).map(r => [String(r.id), r.customer, r.status, String(r.amount)])
});
const commitRows = commits.map(c => [
  `<b>${c.version}</b>: ${c.operation}`,
  [...c.add.map(f => `add ${short(f.path)}`), ...c.remove.map(path => `remove ${short(path)}`)].join(', '),
  filesAt(c.version).map(f => short(f.path)).join(', '),
  String(rowsAt(c.version).length)
]);
const last = commits[commits.length - 1].version;
const filesWritten = commits.flatMap(c => c.add).length;

/* ---- równoległe zapisy: co drugi job przeczytał, a pierwszy zmienił ---- */

const conflictWhy: Record<string, [string, string]> = {
  append: ['Nic. Oba tylko dopisują i żaden nie czyta tabeli', 'Bez konfliktu: B dostaje wersję 6'],
  'same-file': ['Plik, który B przeczytał i chciał przepisać. A zdjął go z listy', '<b>Konflikt</b>: B dostaje błąd'],
  'row-level': ['Ten sam plik, ale inne wiersze. Tabela ma row-level concurrency', 'Bez konfliktu'],
  'insert-update': ['Nic. A tylko dodał nowe pliki', 'Bez konfliktu na poziomie domyślnym']
};

/* ---- MERGE: cel, źródło i wynik dwóch klauzul ---- */

const mergeTable = (name: string, rows: lesson.MergeRow[]) => ({ name, key: ['id'], columns: ['id', 'name', 'tier'], rows: rows.map(r => [String(r.id), r.name, r.tier]) });
const mergeResult = [
  ...lesson.merge.target.map(t => {
    const s = lesson.merge.source.find(x => x.id === t.id);
    return s ? [String(s.id), s.name, `<b>${s.tier}</b>`, `zmieniony, było: ${t.tier}`] : [String(t.id), t.name, t.tier, 'bez zmian'];
  }),
  ...lesson.merge.source.filter(s => !lesson.merge.target.some(t => t.id === s.id)).map(s => [String(s.id), s.name, `<b>${s.tier}</b>`, 'wstawiony'])
];
const onlyInTarget = lesson.merge.target.filter(t => !lesson.merge.source.some(s => s.id === t.id)).map(t => t.name);

/* ---- schemat: dwie paczki, dwa tryby ---- */

const schemaRows = lesson.schema.batches.flatMap(batch =>
  lesson.schema.modes.map(mode => {
    const r = lesson.schema.results[`${batch.id}|${mode.id}`];
    return [batch.label, mode.label, r.ok ? 'Zapis przechodzi' : '<b>Zapis odrzucony</b>', String(r.columns.length)];
  })
);

/* ---- time travel: status wersji w trzech sytuacjach (sprawdzany testem z modelem lekcji) ---- */

const tt = lesson.timeTravel;
const status = (id: string) => tt.statuses[id].label;
const travelRows = [
  ['outside', 'files', 'log'],
  ['outside', 'files', 'log'],
  ['ok', 'ok', 'log'],
  ['ok', 'ok', 'log'],
  ['current', 'current', 'current']
].map((row, version) => [`${version} (dzień ${commits[version].day})`, ...row.map(status)]);

/* ---- kompaktowanie: megabajty wynikają z liczby plików ---- */

const smallMb = lesson.compaction.smallMb;
const bigMb = lesson.compaction.smallFiles * smallMb;
const storedMb = (s: { current: number; stored: number }) => (s.stored - s.current) * smallMb + (s.current === 1 ? bigMb : s.current * smallMb);
const compactionRows = lesson.compaction.states.map(s => [s.label, String(s.current), String(s.stored), `${storedMb(s)} MB`]);

/* ---- liquid clustering: cztery pliki, zakresy customer_id ---- */

const customerIds = Array.from({ length: 1000 }, (_, i) => String(i + 1));
const layoutNotes = ['zakresy plików się pokrywają', 'zakresy plików się nie nakładają'];

/* ---- platforma ---- */

const box = (id: string) => lesson.arch.boxes.find(b => b.id === id)!;
const node = (id: string) => ({ name: box(id).name, note: box(id).items.join(', ') });
const salesObjects = lesson.uc.objects.filter(o => o.schema === 'sales').map(o => (o.kind === 'volume' ? `${o.name} (wolumen)` : o.name));
/** Strzałek nie ma w czcionkach osadzanych w PDF, więc etykieta z lekcji dostaje przecinki. */
const noArrow = (text: string) => text.replace(/ → /g, ', ');
/** Numery części, które opisują kolejne warstwy platformy. Test pilnuje, że zgadzają się z kolejnością części. */
const layerParts = ['części 1–9', 'części 11 i 12', 'część 13', 'część 14', 'części 14 i 15'];
/** Tekst porównania pochodzi z lekcji i mówi o sobie „lekcja”. W rozdziale to „rozdział”. */
const asChapter = (text: string) => text.replace('co w tej lekcji', 'co w tym rozdziale').replace('w Fabric tu nie sprawdzałem', 'w Fabric nie sprawdzano');
const chainNotes = ['systemy, w których powstają dane', 'przenosi dane i zleca pracę', 'magazyn plików', 'przetwarzanie', 'tabele, relacje i miary', 'to, co widzi odbiorca'];
const scenario = (i: number) => lesson.choose.cases[i].options[lesson.choose.cases[i].correct];

export const databricksPlatformDeltaLake: KbChapter = {
  id: 'databricks-platform-delta-lake',
  area: 'databricks',
  title: 'Databricks Platform & Delta Lake',
  subtitle: 'Skąd katalog z plikami Parquet bierze transakcje, wersje i MERGE. I co Databricks dokłada do Sparka, żeby z silnika powstała platforma: compute, Unity Catalog, Lakeflow i wdrożenia.',
  lessonId: lesson.meta.id,
  checked: '2026-11-27',
  lead: [
    `Ten rozdział ma dwie połowy. Pierwsza tłumaczy Delta Lake: skąd tabela złożona z plików bierze transakcje, wersje, MERGE i cofanie zmian. Druga pokazuje, co Databricks dokłada do Sparka: compute, Unity Catalog, Lakeflow i wdrożenia. Na końcu jest mapa ekosystemu Microsoft i porównanie ze Snowflake i Fabric.`,
    `Rozdział zakłada, że wiesz, co robi Spark jako silnik (plan, shuffle, partycje), i tego nie powtarza. Tam, gdzie zachowanie wynika z protokołu Delta, tekst mówi o Delcie. Tam, gdzie opisuje Databricks, mówi o Databricks i podaje wersję Databricks Runtime, jeśli podaje ją dokumentacja. Delta Lake uruchamiany poza Databricks może nie mieć opisanych tu automatów.`,
    `Temat nie ma labu w repozytorium. Liczby w tabelach i ilustracjach (pliki, wiersze, dni, megabajty) są dobrane do przykładu. To nie są pomiary. Liczby z dokumentacji są podpisane jako liczby z dokumentacji.`
  ],
  sections: [
    {
      id: 'katalog-plikow',
      title: 'Dlaczego katalog plików to jeszcze nie tabela',
      blocks: [
        p(`Nocny job dopisuje do tabeli zamówień cztery pliki Parquet. Po dwóch plikach klaster traci maszynę i job kończy się błędem. O 8:00 ktoś otwiera raport sprzedaży. Co zobaczy?`),
        p(`W hurtowni takiego pytania nie ma. Zapis jest transakcją: udał się w całości albo nie udał się wcale. Tutaj dane leżą jako zwykłe pliki w <b>object storage</b>, czyli w chmurowym magazynie plików. Zapytanie, które czyta tabelę (dalej: <b>czytelnik</b>), musi skądś wiedzieć, które pliki do niej należą.`),
        p(`Przykład: tabela miała ${crashBefore} zamówień w dwóch plikach. Job miał dopisać ${crashPlanned - crashBefore} zamówień w czterech plikach po 100 wierszy i padł po dwóch.`),
        figure(`Ilustracja. Ten sam katalog po przerwanym jobie, czytany na dwa sposoby. Liczby wymyślone. To najprostszy przypadek, a nie pomiar.`, {
          kind: 'stacks',
          columns: lesson.crash.modes.map(mode => ({
            label: `${mode.label}: raport pokazuje ${mode.id === 'parquet' ? crashSeen : crashBefore}`,
            layers: [
              ...lesson.crash.oldFiles.map(f => ({ name: f.name, text: `${f.rows} wierszy, czytany` })),
              ...crashWritten.map(f => ({ name: f.name, text: mode.id === 'parquet' ? `${f.rows} wierszy, czytany` : `${f.rows} wierszy, nie ma go na liście` }))
            ]
          }))
        }),
        p(`Jeśli czytelnik po prostu listuje katalog i czyta każdy plik, który w nim znajdzie, raport pokaże ${crashSeen} zamówień. Ta liczba nigdy nie była prawdziwa: przed jobem było ${crashBefore}, po nim miało być ${crashPlanned}. I nikt nie dostał błędu.`),
        p(`Parquet to format jednego pliku. Dobrze opisuje, co jest w środku pliku. Katalog z wieloma plikami nie wie jednak, które z nich razem dają poprawną tabelę.`),
        p(`<b>Delta Lake</b> dokłada to, czego brakuje: osobną listę plików, które należą do tabeli. Plik, którego nie ma na liście, dla czytelnika nie istnieje. Przerwany job nie zdążył zmienić listy, więc raport pokazuje ${crashBefore} zamówień, czyli ostatni zatwierdzony stan. Dwa pliki po nim leżą w katalogu, ale do tabeli nie należą. Ponowiony job zapisze komplet i dopiero wtedy zmieni listę.`),
        p(`Lista rozwiązuje więcej niż ten jeden problem. Sam katalog Parquet nie odpowiada też na trzy inne pytania: co, gdy dwa joby piszą naraz, jak zmienić jeden wiersz i jak wrócić do stanu sprzed zapisu.`),
        table(lesson.versus.columns, lesson.versus.rows, 'Kolumna „Tabela Delta” opisuje protokół Delta, a nie konkretną wersję Databricks.'),
        deeper(
          'Czy Spark naprawdę zostawia połowę plików',
          `Nie zawsze. W uproszczeniu: Apache Spark przy zapisie do katalogu nie pisze od razu na miejsce. Taski zapisują pliki w lokalizacji tymczasowej, a na końcu pliki są przenoszone przez zmianę nazwy. Dzięki temu niepełny wynik widać krócej.`,
          `Dokumentacja Apache Spark zastrzega jednak, że object storage to nie system plików. Zmiana nazwy bywa tam wolna, a po awarii może zostawić magazyn w nieznanym stanie. Zależy to od magazynu: dla S3 dokumentacja oznacza zmianę nazwy katalogu jako niebezpieczną, dla Azure (sterownik ABFS) jako bezpieczną. Ilustracja pokazuje więc najprostszy przypadek, a nie jedyne możliwe zachowanie.`
        ),
        known(
          'W Snowflake',
          `W Snowflake plików nie widzisz. <code>INSERT</code> zapisuje się w całości albo wcale. Pilnuje tego usługa, bo tylko ona ma dostęp do magazynu danych. Delta Lake daje tę samą obietnicę dla jednej tabeli, ale na plikach w otwartym formacie, które leżą w Twoim magazynie.`,
          `Analogia kończy się na tym, kto pilnuje. Tu nie ma usługi, która stoi przed każdym dostępem. Gwarancja działa, dopóki wszyscy piszący trzymają się protokołu Delta. Kto ma uprawnienia do magazynu, może skasować plik z pominięciem listy i zepsuć tabelę. Dlatego potrzebna jest warstwa uprawnień, o której jest część o Unity Catalog.`
        )
      ]
    },
    {
      id: 'log-transakcyjny',
      title: 'Log transakcyjny: tabela to lista plików',
      blocks: [
        p(`Jak wygląda ta lista? Tabela Delta to katalog z plikami Parquet oraz podkatalog <code>_delta_log</code>. Każda zatwierdzona zmiana tabeli nazywa się <b>commit</b> i jest jednym małym plikiem JSON w tym podkatalogu. W środku są <b>akcje</b>: „dodaj ten plik do tabeli” (<code>add</code>) i „usuń tamten” (<code>remove</code>).`),
        p(`Pliki logu mają kolejne numery, dopełnione zerami do 20 cyfr: <code>00000000000000000000.json</code>, potem <code>…001.json</code> i tak dalej. Numer commitu to <b>wersja tabeli</b>. Czytelnik przechodzi po logu od początku i składa z akcji listę plików. Czyta tylko te pliki Parquet, które na końcu zostały na liście.`),
        p(`Stąd bierze się zapis „wszystko albo nic”. Cztery nowe pliki danych niczego nie zmieniają, dopóki nie pojawi się plik commitu. A jeden plik commitu albo jest, albo go nie ma.`),
        h3('Pięć commitów na małej tabeli'),
        p(`Zobaczmy to na tabeli <code>orders</code>. Pierwszy commit tworzy ją z trzema zamówieniami, drugi dopisuje dwa kolejne. Po nich tabela wygląda tak:`),
        tables(`Tabela orders po dwóch commitach. Trzy pierwsze wiersze leżą w pliku part-a, dwa ostatnie w pliku part-b. Dane wymyślone.`, ordersAt(1)),
        p(`Potem przychodzą trzy operacje: zmiana statusu zamówienia 2, usunięcie zamówienia 5 i <code>OPTIMIZE</code>, czyli sklejenie małych plików w jeden.`),
        sql(`UPDATE orders SET status = 'paid'\nWHERE id = 2;\n\nDELETE FROM orders WHERE id = 5;\n\nOPTIMIZE orders;`),
        table(
          ['Wersja i operacja', 'Akcje w commicie', 'Pliki tabeli', 'Wiersze'],
          commitRows,
          'Ilustracja: model protokołu, nie zapis z prawdziwej tabeli. Bez deletion vectors, nazwy plików skrócone, z akcji pokazane tylko add i remove. „Pliki tabeli” to lista po odtworzeniu logu do tej wersji.'
        ),
        p(`W tej tabeli widać trzy rzeczy.`),
        list(
          `<b>Dopisanie to nowy plik.</b> INSERT dodaje <code>part-b</code> jedną akcją <code>add</code>. Istniejących plików nikt nie rusza.`,
          `<b>Zmiana wiersza to też nowy plik.</b> Pliku Parquet nie da się zmienić w miejscu. UPDATE zapisuje nowy plik <code>part-c</code> z trzema wierszami, z których jeden jest zmieniony, i oznacza <code>part-a</code> jako usunięty. DELETE działa tak samo: nowy plik bez skasowanego wiersza i <code>remove</code> dla starego.`,
          `<b>OPTIMIZE to commit jak każdy inny.</b> Skleja <code>part-c</code> i <code>part-d</code> w <code>part-e</code>. Zapytanie zwraca te same ${rowsAt(last).length} wiersze co przed chwilą. Zmienił się tylko układ plików, a tabela ma nową wersję.`
        ),
        p(`Najważniejszy wniosek: commit nie przechowuje danych. Zapisuje tylko zmianę listy plików. Żeby poznać tabelę w wersji N, czytelnik odtwarza commity od 0 do N. Dlatego wcześniejszą wersję da się odczytać tak długo, jak długo istnieją jej pliki i jej wpisy w logu.`),
        p(`Drugi wniosek: akcja <code>remove</code> niczego nie kasuje z dysku. Po pięciu commitach tabela ma ${rowsAt(last).length} wiersze w jednym pliku, a w katalogu leży ${filesWritten} plików. Wiersz Emila nadal jest w <code>part-b</code>, tylko że ten plik nie należy już do bieżącej wersji. Kto i kiedy sprząta stare pliki, opisuje część o VACUUM.`),
        h3('Co jeszcze jest w commicie'),
        p(`Pierwszy commit zawiera dwie akcje, które nie dotyczą plików danych. <code>protocol</code> mówi, jakie funkcje musi obsługiwać program, który czyta albo pisze tabelę. <code>metaData</code> zawiera schemat i właściwości tabeli. Protokół definiuje też <code>commitInfo</code> (kto i jaką operacją) oraz <code>txn</code>, czyli identyfikator postępu aplikacji, używany na przykład przez streaming.`),
        p(`Akcja <code>add</code> niesie statystyki pliku: liczbę rekordów, a dla kolumn najmniejszą i największą wartość oraz liczbę wartości NULL. Dzięki nim silnik potrafi pominąć plik bez otwierania go. Wrócimy do tego w części o data skippingu. Pole <code>dataChange</code> mówi, czy commit zmienił dane, czy tylko ich układ. Akcję <code>remove</code>, która czeka na wygaśnięcie, protokół nazywa tombstone.`),
        h3('Checkpoint: czytelnik nie czyta tysięcy plików JSON'),
        p(`Tabela po roku pracy ma tysiące commitów. Odtwarzanie wszystkich przy każdym zapytaniu byłoby wolne. Dlatego co jakiś czas piszący zapisuje w <code>_delta_log</code> <b>checkpoint</b>: plik (klasycznie Parquet) z kompletnym, już odtworzonym stanem tabeli w danej wersji. Czytelnik bierze najnowszy checkpoint i doczytuje tylko commity, które powstały po nim. Gdzie szukać checkpointu, mówi plik <code>_last_checkpoint</code>.`),
        p(`Jak często powstaje checkpoint? Protokół mówi wprost, że czytelnik nie powinien niczego zakładać o ich częstotliwości. Dokumentacja Databricks podaje, że platforma dobiera ją do rozmiaru danych i obciążenia i może ją zmienić bez zapowiedzi. Liczba typu „co 10 commitów” nie jest więc regułą, na którą warto się powoływać.`),
        p(`Checkpoint ma drugą rolę. Po jego zapisaniu Delta może usunąć wpisy logu starsze niż <b>retencja</b> logu, czyli czas ich przechowywania (domyślnie 30 dni). To ogranicza cofanie się do starych wersji niezależnie od VACUUM.`),
        h3('Deletion vectors: zmiana wiersza bez przepisywania pliku'),
        p(`W modelu wyżej zmiana jednego wiersza przepisuje cały plik. Dokumentacja Databricks mówi to samo o tabelach bez deletion vectors. Gdy plik ma 1 GB, a zmienia się jeden wiersz, to dużo pracy.`),
        p(`Z włączonymi <b>deletion vectors</b> zmiana albo usunięcie wiersza zapisuje obok pliku znacznik „ten wiersz nie obowiązuje”. Czytelnik uwzględnia go przy odczycie. Plik jest fizycznie przepisywany później, na przykład przy OPTIMIZE.`),
        p(`Zakres: dla tabel Delta deletion vectors trzeba włączyć jawnie, chyba że ustawienie workspace robi to dla nowych tabel. Dokumentacja zaznacza, że ustawienia domyślne różnią się między regionami. Nie zakładaj więc, że są włączone wszędzie.`),
        deeper(
          'Jak to się ma do liter ACID',
          `<b>Atomicity</b>, czyli wszystko albo nic. Commit to pojawienie się jednego pliku logu. Nie ma stanu „w połowie”.`,
          `<b>Consistency</b>, czyli dane zgodne z regułami tabeli. Przed zapisem Delta sprawdza między innymi, czy dane pasują do schematu i spełniają ograniczenia tabeli. Zapis, który ich nie spełnia, nie tworzy commitu.`,
          `<b>Isolation</b>, czyli równoległe operacje sobie nie przeszkadzają. Czytelnik pracuje na jednej wersji tabeli, czyli na migawce (snapshot). Nie widzi commitów, które pojawiły się w trakcie jego zapytania. Piszących Delta sprawdza pod kątem konfliktów w chwili commitu.`,
          `<b>Durability</b>, czyli to, co zatwierdzone, nie znika. Commit i pliki danych leżą w object storage, więc są tak trwałe jak ten magazyn.`,
          `To przełożenie liter na mechanizmy jest uproszczeniem, a nie cytatem z dokumentacji. Zakres: klasycznie są to gwarancje dla <b>jednej tabeli</b>, bo każda tabela ma własny log. Transakcje na kilku tabelach Databricks opisuje osobno, z dodatkowymi wymaganiami. Wraca do nich ostatnia część.`
        )
      ]
    },
    {
      id: 'rownolegle-zapisy',
      title: 'Dwóch piszących naraz: optimistic concurrency',
      blocks: [
        p(`W hurtowni równoległe zapisy porządkuje silnik: zakłada blokady albo ustawia transakcje w kolejce. Tabela Delta to pliki. Nie ma serwera, który mógłby trzymać blokadę.`),
        p(`Delta robi więc inaczej. Każdy piszący pracuje tak, jakby był sam: czyta tabelę i zapisuje swoje pliki, nie pytając nikogo o zgodę. Czy wszedł komuś w drogę, sprawdza się dopiero w chwili commitu. To <b>optimistic concurrency control</b>: zakładamy, że konflikty są rzadkie, i sprawdzamy dopiero na końcu.`),
        p(`Dwa joby startują, gdy tabela ma wersję ${last}.`),
        figure(`Ilustracja. Dwa joby piszą do tej samej tabeli. Do chwili commitu żaden nie wie o drugim. Wyróżniony krok to próba zajęcia tego samego numeru commitu: A zdążył pierwszy.`, {
          kind: 'lanes',
          lanes: [
            {
              label: 'Job A',
              steps: [
                { name: 'Odczyt', where: `wersja ${last}`, hot: false },
                { name: 'Zapis plików', where: 'nikt ich nie widzi', hot: false },
                { name: 'Commit', where: `zapisuje numer ${last + 1}`, hot: true }
              ]
            },
            {
              label: 'Job B',
              steps: [
                { name: 'Odczyt', where: `wersja ${last}`, hot: false },
                { name: 'Zapis plików', where: 'nikt ich nie widzi', hot: false },
                { name: 'Commit', where: `numer ${last + 1} jest zajęty`, hot: true }
              ]
            }
          ]
        }),
        steps(
          `Oba joby czytają tabelę w wersji ${last}. Każdy zapamiętuje, które pliki przeczytał.`,
          `Oba zapisują nowe pliki Parquet do katalogu tabeli. Bez commitu nikt ich nie widzi.`,
          `Job A pierwszy zapisuje commit numer ${last + 1}.`,
          `Job B też próbuje zapisać commit numer ${last + 1}, ale taki plik już istnieje. Protokół zabrania nadpisania wpisu w logu, więc B musi sprawdzić, co zrobił A.`
        ),
        p(`Wynik zależy od jednego pytania: czy B oparł się na czymś, co A właśnie zmienił? Cztery typowe pary operacji:`),
        table(
          ['Job A i job B', 'Co B przeczytał, a A zmienił', 'Wynik'],
          lesson.conflict.cases.map(c => [c.label, ...conflictWhy[c.id]]),
          'Według tabeli konfliktów z dokumentacji Databricks, domyślny poziom izolacji zapisu (WriteSerializable). Założenia: tabela bez kolumn identity i nikt w tym czasie nie zmienia jej schematu ani właściwości.'
        ),
        p(`Dopisanie, które nie czyta tabeli docelowej, nazywa się <b>blind append</b>. To zwykły INSERT albo zapis w trybie append, bez podzapytania i bez warunku, który odwołuje się do tej tabeli. Dwa takie dopisania nie wchodzą sobie w drogę. B widzi, że A tylko dodał pliki, i zapisuje swój commit pod kolejnym numerem, bez powtarzania pracy.`),
        p(`Dwa UPDATE na tym samym pliku to inna sytuacja. B policzył wynik na pliku, którego już nie ma na liście. Jego commit kończy się wyjątkiem z rodziny <code>Concurrent…Exception</code> i operację trzeba ponowić od odczytu. Ważne jest to, co się nie stało: nic nie zapisało się w połowie. Pliki B po prostu nie trafiły na listę. Przegrany dostaje błąd, a nie uszkodzoną tabelę.`),
        h3('Row-level concurrency'),
        p(`Sprawdzanie na poziomie plików bywa zbyt ostrożne. Dwa joby zmieniają różne wiersze, które akurat leżą w jednym pliku, i jeden z nich przegrywa. Na Databricks tabela może mieć <b>row-level concurrency</b>: konflikt jest wtedy sprawdzany na poziomie wierszy, a platforma sama rozstrzyga zapisy do różnych wierszy tego samego pliku.`),
        list(
          `Warunki: Databricks Runtime 14.3 LTS lub nowszy, włączone deletion vectors i tabela bez partycjonowania.`,
          `Konfliktów jest mniej, ale nie znikają. Zmiana tego samego wiersza nadal jest konfliktem.`,
          `Przy warunkach na typach złożonych, wyrażeniach niedeterministycznych i podzapytaniach wracają reguły na poziomie plików.`,
          `Wykrywanie na poziomie wierszy wydłuża zapis.`
        ),
        h3('Poziomy izolacji'),
        p(`Odczyt zawsze działa na migawce (snapshot isolation): zapytanie od początku do końca widzi jedną wersję tabeli. Równoległy zapis ani OPTIMIZE nie blokują czytających.`),
        p(`Zapis ma na Databricks dwa poziomy, ustawiane właściwością tabeli <code>delta.isolationLevel</code>. <b>WriteSerializable</b> jest domyślny i słabszy. <b>Serializable</b> jest najmocniejszy. Różnicę widać na ostatnim wierszu tabeli: na poziomie Serializable para INSERT i UPDATE może wejść w konflikt i wtedy przegrywa UPDATE, a nie INSERT.`),
        warn(
          '„INSERT nigdy nie wchodzi w konflikt” to za duży skrót',
          `W tabeli konfliktów „INSERT” oznacza blind append. INSERT z podzapytaniem do tej samej tabeli czyta ją, więc podlega tym samym ograniczeniom co MERGE.`,
          `Na poziomie Serializable blind append może wejść w konflikt z równoległym UPDATE, DELETE albo MERGE.`,
          `Zmiana metadanych w trakcie zapisu może wywrócić wszystkie równoległe zapisy, także INSERT. Chodzi o <code>ALTER TABLE</code>, zmianę właściwości tabeli, zapis, który zmienia schemat, i aktualizację protokołu tabeli.`,
          `Tabele z kolumnami identity nie obsługują równoległych transakcji. Dokumentacja mówi to wprost.`
        ),
        h3('OPTIMIZE też jest piszącym'),
        p(`Według dokumentacji Databricks OPTIMIZE może wejść w konflikt z UPDATE, DELETE i MERGE, chyba że tabela ma deletion vectors, a OPTIMIZE nie używa <code>ZORDER BY</code>. Dlatego OPTIMIZE uruchomiony w trakcie ładowania danych potrafi wywrócić job.`),
        h3('Jak czytać wyjątki konfliktu'),
        list(
          `<code>ConcurrentAppendException</code>: ktoś dodał pliki tam, skąd Twoja operacja czytała.`,
          `<code>ConcurrentDeleteReadException</code>: ktoś usunął plik, który przeczytałeś.`,
          `<code>ConcurrentDeleteDeleteException</code>: ktoś usunął plik, który Ty też usuwasz. Przykład: dwie kompaktacje naraz.`,
          `<code>MetadataChangedException</code>: w trakcie zmienił się schemat albo właściwości tabeli.`,
          `<code>ProtocolChangedException</code>: tabela przeszła na nowszy protokół albo kilka jobów tworzy ją jednocześnie.`,
          `<code>ConcurrentTransactionException</code>: dwa zapytania streamingowe używają tego samego checkpointu. To błąd konfiguracji, nie pech.`
        ),
        p(`Jak zmniejszyć liczbę konfliktów? Ustawić joby tak, żeby pracowały na różnych plikach. Dokumentacja Delta Lake radzi do tego partycjonowanie i jawny warunek na kolumnę partycji. Databricks dodaje, że partycjonowanie po kolumnie o wielu wartościach szkodzi wydajności, i dla tabel bez partycji daje row-level concurrency. Dokładne reguły zależą od wersji Databricks Runtime i funkcji włączonych na tabeli.`)
      ]
    },
    {
      id: 'merge',
      title: 'MERGE: zmień, wstaw albo usuń jednym poleceniem',
      blocks: [
        p(`Codziennie z systemu źródłowego przychodzi paczka zmian: klienci zmienieni i nowi. Zmienionych trzeba zaktualizować, nowych dopisać. Dwa osobne polecenia to dwa commity i chwila, w której tabela jest zaktualizowana tylko w połowie.`),
        p(`<code>MERGE</code> robi to jednym poleceniem i jednym commitem. Dopasowuje wiersze źródła, czyli paczki, do tabeli docelowej po warunku <code>ON</code> i dla każdego wiersza decyduje, co zrobić.`),
        tables(`Cel i źródło. Paczka zmienia dwóch klientów (2 i 4) i przynosi jednego nowego (5). Dane wymyślone.`, mergeTable('customers (cel)', lesson.merge.target), mergeTable('updates (źródło)', lesson.merge.source)),
        sql(`MERGE INTO customers AS t\nUSING updates AS s\nON t.id = s.id\nWHEN MATCHED\n  AND s.updated_at > t.updated_at\n  THEN UPDATE SET *\nWHEN NOT MATCHED\n  THEN INSERT *`, 'MERGE po kluczu id'),
        p(`Wiersze rozpadają się na trzy grupy.`),
        list(
          `<b>Są w obu tabelach</b> (<code>WHEN MATCHED</code>): Borys i Daria. Dostają nowe wartości. <code>SET *</code> przepisuje wszystkie kolumny o tych samych nazwach.`,
          `<b>Są tylko w źródle</b> (<code>WHEN NOT MATCHED</code>, pełna nazwa: <code>WHEN NOT MATCHED BY TARGET</code>): Emil. Zostaje wstawiony.`,
          `<b>Są tylko w celu</b>: ${onlyInTarget.join(' i ')}. To polecenie ich nie rusza.`
        ),
        table(['id', 'name', 'tier', 'Co się stało'], mergeResult, 'Ilustracja: wynik wyliczony z reguł klauzul, bez wykonywania SQL. Dla uproszczenia przyjęto, że paczka jest nowsza niż dane w celu.'),
        p(`Dodatkowy warunek po <code>AND</code> pilnuje kolejności. Paczki mogą przyjść nie po kolei i wtedy starsza wersja wiersza nadpisałaby nowszą. Warunek <code>s.updated_at &gt; t.updated_at</code> na to nie pozwala.`),
        h3('Ta sama paczka drugi raz'),
        p(`Joby padają i są ponawiane, więc ta sama paczka może trafić do tabeli dwa razy. Ładowanie, które można bezpiecznie powtórzyć, nazywa się <b>idempotentnym</b>: druga próba zostawia tabelę w tym samym stanie. MERGE to daje, o ile klucz w <code>ON</code> jest stały. Powtórka trafia wtedy w te same wiersze. Gdy klucz się zmienia, powtórka wstawi nowy wiersz, zamiast zaktualizować stary.`),
        h3('Duplikaty w źródle'),
        p(`Źródło musi być jednoznaczne: najwyżej jeden wiersz na klucz. Gdy nie jest, możliwe są trzy przypadki i każdy kończy się inaczej.`),
        list(
          `<b>Dwa wiersze źródła pasują do jednego wiersza celu, a klauzula go zmienia.</b> Dodajmy do paczki drugi wiersz dla <code>id = ${lesson.merge.duplicate.id}</code>. Nie wiadomo, który ma wygrać, a Delta nie zgaduje. MERGE kończy się błędem i tabela zostaje w poprzedniej wersji.`,
          `<b>Wyjątek: bezwarunkowy DELETE.</b> Dokumentacja Databricks dopuszcza wtedy wiele dopasowań. Usunięcie wiersza daje ten sam wynik bez względu na to, który wiersz źródła je wywołał.`,
          `<b>Dwa wiersze źródła mają ten sam nowy klucz.</b> Żaden nie jest dopasowany, więc <code>WHEN NOT MATCHED</code> wstawi oba. Powstaje duplikat i nie ma błędu. To wniosek z definicji klauzuli (wstawia wiersz dla każdego niedopasowanego wiersza źródła), a nie wynik uruchomienia.`
        ),
        p(`Dlatego paczkę deduplikuje się przed MERGE do jednego wiersza na klucz, na przykład podzapytaniem w <code>USING</code>, które zostawia najnowszy wiersz. Usuwa to oba problemy naraz: błąd i cichy duplikat.`),
        h3('Usuwanie tego, czego nie ma w źródle'),
        sql(`WHEN NOT MATCHED BY SOURCE\n  THEN DELETE`, 'Trzecia klauzula'),
        p(`Ta klauzula jest dostępna w Databricks SQL i Databricks Runtime 12.2 LTS lub nowszym. Dotyczy trzeciej grupy, czyli wierszy, które są tylko w celu. W przykładzie skasowałaby klientów: ${onlyInTarget.join(' i ')}.`),
        warn(
          'Nigdy dla zwykłej paczki zmian',
          `Klauzula usuwa z celu wszystko, czego nie ma w źródle. Paczka z samymi zmianami nie zawiera klientów, którzy się nie zmienili, więc wszyscy zostaliby skasowani.`,
          `Ma sens w dwóch sytuacjach. Pierwsza: źródło jest pełnym, wiarygodnym obrazem danych. Druga: dodatkowy warunek po <code>AND</code> zawęża usuwanie do zakresu, który paczka pokrywa w całości, na przykład do jednego dnia.`
        ),
        h3('Ile kosztuje MERGE'),
        p(`MERGE to join źródła z celem, więc kosztuje jak join. Potem dzieje się to samo co przy UPDATE i DELETE: Delta znajduje pliki z pasującymi wierszami, zapisuje nowe pliki i dodaje commit z akcjami <code>add</code> i <code>remove</code>.`),
        p(`Stąd koszt, który potrafi zaskoczyć. Przykład: operacja zmienia 10 wierszy, ale są rozsiane po 500 plikach. Bez deletion vectors przepisze 500 plików. Dlatego dane warto układać po kluczu MERGE, o czym jest część o liquid clusteringu. I dlatego małe, częste zmiany są droższe, niż sugeruje liczba wierszy.`),
        p(`Szczegół wersji: od Databricks Runtime 16.0 przy wykrywaniu wielokrotnych dopasowań MERGE bierze pod uwagę także warunki z klauzul <code>WHEN MATCHED</code>, a nie tylko <code>ON</code>.`),
        known(
          'W dbt',
          `Model incremental ze strategią merge i <code>unique_key</code> robi to samo: dbt generuje MERGE za Ciebie.`,
          `Analogia kończy się na tym, co zostaje po Twojej stronie. Deduplikację paczki i warunek kolejności i tak musisz napisać sam, w dbt czy poza nim.`
        )
      ]
    },
    {
      id: 'schemat',
      title: 'Schema enforcement i schema evolution',
      blocks: [
        p(`System źródłowy zaczął wysyłać nową kolumnę <code>channel</code>. Job ładujący nic o tym nie wie. Tabela <code>orders</code> ma ${lesson.schema.tableColumns.length} kolumny: ${lesson.schema.tableColumns.map(c => `<code>${c}</code>`).join(', ')}. Co się stanie z paczką, która ma ich pięć?`),
        table(['Paczka', 'Tryb zapisu', 'Wynik', 'Kolumny tabeli po zapisie'], schemaRows, 'Model według dokumentacji Databricks dla INSERT i zapisu z DataFrame.'),
        p(`Domyślnie tabela odrzuca zapis, który do niej nie pasuje: każda wstawiana kolumna musi istnieć w tabeli docelowej. Zapis jest odrzucany w całości, nie powstaje commit i tabela się nie zmienia. To <b>schema enforcement</b>. Chroni odbiorców danych przed tym, że tabela po cichu przyjmie coś, czego nikt nie planował.`),
        p(`Możesz też świadomie pozwolić, żeby zapis zmienił schemat. To <b>schema evolution</b>. Commit zawiera wtedy także zmianę schematu: kolumna <code>channel</code> trafia na koniec, a starsze wiersze mają w niej NULL. Oszczędza to ręcznego <code>ALTER TABLE</code>.`),
        p(`Wybór zależy od warstwy. W surowej zwykle włącza się ewolucję, żeby nowa kolumna w źródle nie zatrzymywała ładowania. W tabelach, na których stoją raporty, zwykle zostaje kontrola.`),
        h3('Jak włącza się ewolucję'),
        list(
          `Przy zapisie z DataFrame: opcja <code>mergeSchema</code> ustawiona na <code>true</code>, w batchu i w streamingu.`,
          `W SQL: <code>MERGE WITH SCHEMA EVOLUTION</code> oraz <code>INSERT … WITH SCHEMA EVOLUTION</code>, ten drugi od Databricks Runtime 18.1. Dla MERGE dokumentacja podaje w dwóch miejscach różne wersje minimalne (15.2 i 15.4 LTS), więc sprawdź swoją.`,
          `Ustawienie sesji <code>spark.databricks.delta.schema.autoMerge.enabled</code> nadal działa. Dokumentacja oznacza je jednak jako starsze i nie zaleca go na produkcji, bo włącza ewolucję wszędzie, także tam, gdzie jej nie chciałeś.`
        ),
        h3('Czego automatyczna ewolucja nie robi'),
        list(
          `Dodaje tylko nowe kolumny, także pola zagnieżdżone. Typu kolumny nie zmieni: bez funkcji type widening dane są rzutowane do typu tabeli.`,
          `<b>Type widening</b> (Databricks Runtime 15.4 LTS lub nowszy) pozwala poszerzyć typ, na przykład INT do BIGINT albo FLOAT do DOUBLE, bez przepisywania danych. Włącza się go właściwością tabeli.`,
          `Zmiana nazwy i usunięcie kolumny bez przepisywania danych wymagają mapowania kolumn (column mapping). Całkowite zastąpienie schematu przy nadpisaniu tabeli to opcja <code>overwriteSchema</code>.`
        ),
        warn(
          'W MERGE reguła jest inna',
          `W MERGE kolumny źródła, których nie ma w celu, są pomijane, a zapis nie jest odrzucany. Błąd dostaniesz dopiero wtedy, gdy wprost przypiszesz wartość do nieistniejącej kolumny. Nowa kolumna ze źródła może więc po cichu nie trafić do tabeli.`
        )
      ]
    },
    {
      id: 'time-travel-vacuum',
      title: 'Time travel, RESTORE i VACUUM',
      blocks: [
        p(`Ktoś błędnie nadpisał dane w tabeli. Stare pliki nadal leżą w katalogu, a log pamięta, które z nich tworzyły każdą wersję. Wcześniejszą wersję da się więc odczytać. To <b>time travel</b>.`),
        sql(tt.lines.slice(0, 3).map(l => `${l.code};`).join('\n')),
        list(
          `<code>DESCRIBE HISTORY</code> pokazuje, kto, kiedy i jaką operacją utworzył każdą wersję. To pierwsze miejsce, w które zaglądasz po pytaniu „kto to zepsuł”.`,
          `<code>VERSION AS OF</code> czyta tabelę w stanie z wybranego commitu. Jest też <code>TIMESTAMP AS OF</code> z datą oraz skrót <code>orders@v2</code>.`,
          `<code>RESTORE</code> przywraca stan wybranej wersji i zapisuje to jako nowy commit. Historia nie znika: pomyłka i jej cofnięcie zostają w logu. Wymaga uprawnienia do modyfikacji tabeli.`
        ),
        h3('VACUUM i dwie retencje'),
        p(`Stare pliki zajmują miejsce, więc ktoś musi je kiedyś usunąć. Robi to <code>VACUUM</code>. Kasuje pliki, których bieżąca wersja już nie używa i które dostały w logu akcję <code>remove</code> dawniej niż próg retencji. Wiek liczy się od tej akcji, a nie od daty utworzenia pliku. Plików logu VACUUM nie rusza.`),
        p(`Żeby odczytać starszą wersję, potrzebne są więc dwie rzeczy naraz: jej wpis w logu i jej pliki danych. Każda ma własną retencję.`),
        list(
          `<b>Usunięte pliki danych</b>: właściwość <code>delta.deletedFileRetentionDuration</code>, domyślnie ${tt.fileRetentionDays} dni. Sprząta VACUUM, gdy ktoś go uruchomi.`,
          `<b>Wpisy logu</b>: właściwość <code>delta.logRetentionDuration</code>, domyślnie ${tt.logRetentionDays} dni. Sprząta Delta, automatycznie po zapisie checkpointu.`
        ),
        p(`Weźmy tabelę <code>orders</code> z części o logu. Jej pięć commitów powstało w dniach od 0 do 4. Które wersje da się odczytać później?`),
        table(
          ['Wersja', 'Dzień 9, bez VACUUM', 'Dzień 9, po VACUUM', 'Dzień 40'],
          travelRows,
          'Ilustracja na wartościach domyślnych. Uproszczenia: wiek wersji liczony od dnia jej commitu, a wpisy logu starsze niż 30 dni znikają od razu. Dnia 5 wszystkie wersje są jeszcze dostępne.'
        ),
        list(
          `<b>Poza oknem.</b> Pliki jeszcze leżą, ale wersja jest starsza niż retencja usuniętych plików. Databricks blokuje takie zapytanie od Databricks Runtime 18.0, a dla tabel managed w Unity Catalog już od 12.2 LTS. Tam, gdzie blokady nie ma, odczyt może zadziałać do pierwszego VACUUM, więc nie wolno na nim polegać.`,
          `<b>Pliki usunięte.</b> VACUUM skasował plik <code>part-a</code>, którego potrzebują wersje 0 i 1. Wpis w logu jest, ale nie ma czego czytać.`,
          `<b>Log usunięty.</b> Wpis przekroczył retencję logu. Tej wersji nie da się odtworzyć nawet wtedy, gdy nikt nie uruchomił VACUUM. W rzeczywistości log jest sprzątany po zapisie checkpointu, więc wpis nie znika dokładnie 30. dnia. Nie warto niczego planować na ten dzień.`,
          `<b>Bieżąca.</b> VACUUM nigdy nie usuwa plików bieżącej wersji.`
        ),
        p(`Time travel służy więc do naprawy świeżej pomyłki i do audytu ostatnich dni. Nie jest kopią zapasową. Dokumentacja Databricks mówi to wprost: nie używaj historii tabeli jako długoterminowego backupu.`),
        h3('Dłuższe okno i jego koszt'),
        p(`Żeby cofać się o 30 dni, obie retencje muszą na to pozwalać. Od Databricks Runtime 18.0 retencja logu nie może być krótsza niż retencja plików.`),
        p(`Koszt: każdy przepisany plik leży w magazynie przez cały okres retencji. Jeśli tabela codziennie przepisuje większość danych, przy 30 dniach trzyma ich wielokrotność.`),
        p(`VACUUM ma dwa tryby: FULL (domyślny) i LITE. LITE korzysta z logu, zamiast listować cały katalog. Dokumentacja Databricks podaje dla niego dwie różne wersje minimalne (16.1 i 16.4 LTS), więc sprawdź swoją.`),
        warn(
          'Retencja krótsza niż 7 dni',
          `Polecenie <code>${tt.lines[4].code}</code> wymaga wyłączenia zabezpieczenia. Ryzyko jest konkretne: VACUUM skasuje pliki, których potrzebuje długo działający odczyt, albo niezatwierdzone jeszcze pliki trwającego zapisu.`,
          `VACUUM usuwa też z katalogu tabeli pliki, którymi Delta nie zarządza. Nie trzymaj tam własnych plików.`
        ),
        known(
          'W Snowflake',
          `Time Travel w Snowflake ma domyślnie 1 dzień retencji, a w edycji Enterprise do 90 dni dla trwałych tabel. Po nim działa Fail-safe: 7 dni, w których dane może odzyskać tylko Snowflake. W Delcie tę samą rolę pełnią stare pliki i log: <code>VERSION AS OF</code>, <code>RESTORE</code>, a dla skasowanej tabeli managed <code>UNDROP</code>.`,
          `Analogia kończy się w trzech miejscach. W Snowflake ustawiasz jedną liczbę, a tu są dwie retencje. Tam sprząta usługa, a tu VACUUM musi ktoś uruchomić: Ty albo predictive optimization na tabelach managed. I nie ma odpowiednika Fail-safe: po VACUUM pliki znikają naprawdę.`
        )
      ]
    },
    {
      id: 'male-pliki-optimize',
      title: 'Małe pliki i OPTIMIZE',
      blocks: [
        p(`Job streamingowy dopisuje do tabeli małą porcję co kilka minut. Każda porcja to osobny commit i osobny, mały plik. Dane się zgadzają, ale każde zapytanie musi teraz otworzyć setki plików. Dla każdego trzeba pobrać wpis z listy, wczytać stopkę (metadane na końcu pliku Parquet) i zaplanować task. Większość czasu idzie na obsługę plików, a nie na czytanie danych.`),
        p(`<code>OPTIMIZE</code> przepisuje małe pliki w mniejszą liczbę większych. Przykład: po dniu zapisów tabela ma ${lesson.compaction.smallFiles} pliki po ${smallMb} MB.`),
        table(['Stan tabeli', 'Pliki bieżącej wersji', 'Pliki w magazynie', 'Dane w magazynie'], compactionRows, 'Ilustracja, nie pomiar. Prawdziwe tabele mają tysiące plików, a rozmiar docelowy pliku dobiera platforma.'),
        p(`Po OPTIMIZE zapytanie otwiera jeden plik zamiast ${lesson.compaction.smallFiles}. Commit ma jedną akcję <code>add</code> i ${lesson.compaction.smallFiles} akcje <code>remove</code>. Ale danych w magazynie przybyło: stare pliki nadal leżą, bo potrzebują ich wcześniejsze wersje. Dopiero VACUUM po okresie retencji usuwa stare pliki i magazyn się zmniejsza. Od tej chwili wersji sprzed OPTIMIZE nie da się już odczytać.`),
        p(`To dwa narzędzia na dwa różne problemy. OPTIMIZE przyspiesza odczyt i miejsca nie zwalnia. VACUUM zwalnia miejsce i zapytań nie przyspiesza.`),
        h3('Skąd się biorą małe pliki'),
        list(
          `<b>Częste małe zapisy</b>: streaming, MERGE uruchamiany co kilka minut, ładowanie plik po pliku.`,
          `<b>Za dużo partycji Sparka przy zapisie.</b> Każdy task zapisuje własny plik. 200 partycji po shuffle'u przy małej paczce to 200 drobnych plików.`,
          `<b>Partycjonowanie tabeli po kolumnie o wielu wartościach.</b> Każda wartość to osobny katalog z własnymi plikami.`
        ),
        h3('Co Databricks robi sam'),
        list(
          `<b>Optimized writes</b> układają dane przed zapisem tak, żeby powstało mniej, większych plików.`,
          `<b>Auto compaction</b> skleja małe pliki zaraz po udanym zapisie, na tym samym klastrze. Według dokumentacji oba mechanizmy są zawsze włączone dla MERGE, UPDATE i DELETE.`,
          `<b>Predictive optimization</b> uruchamia OPTIMIZE, VACUUM i ANALYZE na tabelach managed w Unity Catalog, czyli takich, których plikami zarządza katalog. Jest domyślnie włączona, ale konto, katalog albo schemat mogą ją wyłączyć. Wymaga obsługiwanego regionu. Tabel external nie obejmuje, więc tam nadal planujesz własne joby.`
        ),
        p(`Rozmiar docelowy pliku nie jest jedną stałą. Dokumentacja opisuje automatyczne dostrajanie: 256 MB dla tabel poniżej 2,56 TB, rosnąco do 1 GB dla tabel powyżej 10 TB. Kompaktowanie jest idempotentne: drugi OPTIMIZE na tych samych danych nie ma nic do zrobienia.`),
        p(`Zakres: to zachowanie Databricks. Delta Lake uruchamiany poza Databricks ma OPTIMIZE, ale tych automatów nie należy zakładać.`)
      ]
    },
    {
      id: 'data-skipping-clustering',
      title: 'Data skipping, liquid clustering i partycjonowanie',
      blocks: [
        p(`Duże pliki to połowa sukcesu. Druga połowa to to, co w nich leży. Zapytanie szuka zamówień jednego klienta:`),
        sql(`SELECT *\nFROM orders\nWHERE customer_id = ${lesson.clustering.value};`),
        p(`Delta zapisuje w logu najmniejszą i największą wartość kolumn dla każdego pliku. Jeśli szukana wartość nie mieści się między nimi, plik można pominąć bez otwierania. To <b>data skipping</b>. Według dokumentacji Databricks statystyki są domyślnie zbierane dla pierwszych 32 kolumn tabeli.`),
        figure(`Ilustracja. Cztery pliki tej samej tabeli w dwóch układach. Pod każdym plikiem jest zakres <code>customer_id</code>. Zakresy wymyślone.`, {
          kind: 'partitions',
          units: customerIds,
          filter: { label: `Filtr: customer_id = ${lesson.clustering.value}`, range: [lesson.clustering.value, lesson.clustering.value] },
          layouts: lesson.clustering.layouts.map((l, i) => ({ label: l.label, note: layoutNotes[i], parts: l.files.map(f => [f.min, f.max] as [number, number]) })),
          legend: { read: 'otwierany', skipped: 'pominięty', count: 'otwierane pliki' }
        }),
        p(`W pierwszym układzie w każdym pliku są klienci z całego zakresu. Numer ${lesson.clustering.value} mieści się między minimum a maksimum każdego pliku, więc statystyki nie pozwalają pominąć żadnego. W drugim podobne wartości leżą razem i zakresy się nie nakładają. Trzy pliki odpadają na podstawie samych statystyk z logu. Czwarty nadal trzeba przeczytać i przefiltrować.`),
        p(`Data skipping pomaga więc tylko wtedy, gdy podobne wartości leżą w tych samych plikach. Dba o to <b>liquid clustering</b>. W definicji tabeli, klauzulą <code>CLUSTER BY</code>, mówisz, po których kolumnach układać dane. Samo układanie wykonuje OPTIMIZE, przyrostowo. Według dokumentacji Databricks liquid clustering zastępuje partycjonowanie i ZORDER i jest zalecany dla wszystkich nowych tabel.`),
        h3('Zasady liquid clusteringu'),
        list(
          `Najwyżej cztery klucze. Wybiera się kolumny najczęściej używane w filtrach i joinach, a dla tabeli zasilanej przez MERGE także klucz MERGE.`,
          `Nie łączy się z partycjonowaniem ani z ZORDER na tej samej tabeli.`,
          `Klucze można zmienić bez przepisywania istniejących danych. Stare dane zachowują stary układ, dopóki nie wymusisz przepisania przez <code>OPTIMIZE FULL</code> (Databricks Runtime 16.0 lub nowszy).`,
          `<code>CLUSTER BY AUTO</code> oddaje wybór kluczy platformie. Wymaga predictive optimization, czyli tabeli managed w Unity Catalog, i Databricks Runtime 15.4 LTS lub nowszego.`,
          `Zakres: liquid clustering jest ogólnie dostępny dla tabel Delta od Databricks Runtime 15.4 LTS. Dostępność w Delta Lake poza Databricks nie była sprawdzana.`
        ),
        h3('Partycjonowanie i ZORDER'),
        p(`<b>Partycjonowanie tabeli</b> dzieli pliki na katalogi według wartości kolumny, na przykład <code>date=2026-11-27</code>. Dla kolumny o niewielu wartościach, takiej jak data, daje proste i skuteczne pomijanie całych katalogów.`),
        p(`Problemy są dwa. Kolumna o wielu wartościach, na przykład identyfikator użytkownika, daje ogromną liczbę katalogów z drobnymi plikami. A zmiana kolumny partycjonującej oznacza przepisanie tabeli. Partycjonowana tabela nie skorzysta też z row-level concurrency.`),
        p(`<b>ZORDER</b> to starszy sposób układania danych wewnątrz plików. Kolumny podaje się w poleceniu <code>OPTIMIZE … ZORDER BY</code>, a nie w definicji tabeli. Dokumentacja Databricks opisuje Z-ordering jako operację, która nie jest idempotentna, ale ma działać przyrostowo. Zdanie „ZORDER nie jest przyrostowy” jest więc za proste.`),
        warn('Partycja tabeli to nie partycja Sparka', `Partycja Sparka to porcja danych dla jednego taska w trakcie obliczeń. Partycja tabeli to katalog na dysku. Jedno słowo, dwie różne rzeczy.`),
        known(
          'W Snowflake',
          `Snowflake dzieli tabelę na mikropartycje, trzyma dla nich statystyki i pomija te, które nie mogą zawierać wyniku. Kluczem klastrowania mówisz, po czym układać dane. W Delcie mikropartycją jest plik Parquet, statystyki siedzą w logu, a <code>CLUSTER BY</code> pełni rolę klucza klastrowania.`,
          `Analogia kończy się na tym, kto układa. W Snowflake robi to usługa w tle. W Delcie układa OPTIMIZE, uruchamiany przez Twój job albo przez predictive optimization, jeśli tabela jest managed. Na tabeli external bez własnego harmonogramu deklaracja <code>CLUSTER BY</code> niewiele zmieni dla danych, które zostały już zapisane.`
        )
      ]
    },
    {
      id: 'change-data-feed',
      title: 'Change Data Feed: co się zmieniło',
      blocks: [
        p(`Job zasilający kolejną warstwę nie chce co godzinę czytać całej tabeli <code>orders</code>. Chce tylko wierszy zmienionych od ostatniego razu. Time travel tego nie da. Zwraca całą tabelę w danej wersji, więc różnicę między wersjami trzeba by liczyć samemu.`),
        p(`<b>Change Data Feed</b> (CDF) podaje tę różnicę wprost. Zapytanie o zmiany z commitów 2 (UPDATE) i 3 (DELETE) z części o logu:`),
        sql(`${lesson.cdf.query};`),
        table(
          ['Wiersz', '_change_type', '_commit_version'],
          lesson.cdf.rows.map(r => [r.slice(0, 4).join(', '), `<code>${r[4]}</code>`, r[5]]),
          'Ilustracja: tak wyglądałby wynik, gdyby CDF był włączony przed commitem 2. Kolumna _commit_timestamp pominięta.'
        ),
        p(`Każda zmiana ma typ: <code>insert</code>, <code>delete</code> albo para <code>update_preimage</code> i <code>update_postimage</code>, czyli wiersz przed zmianą i po niej. Odbiorca czyta zmiany od ostatnio przetworzonej wersji i zwykle robi z nich MERGE do swojej tabeli. Stan sprzed zmiany przydaje się do korekty agregatów: odejmujesz starą wartość i dodajesz nową.`),
        h3('Włączanie, odczyt i ograniczenia'),
        list(
          `Klasycznie CDF włącza się właściwością tabeli <code>delta.enableChangeDataFeed = true</code>. Rejestruje zmiany dopiero od tego momentu, więc historii wstecz nie ma. Zakres wersji w <code>table_changes</code> jest obustronnie domknięty.`,
          `Z DataFrame: opcja <code>readChangeFeed</code> z <code>startingVersion</code>, w batchu albo jako stream. W streamie postęp pamięta checkpoint zapytania.`,
          `Pliki zmian podlegają retencji tabeli, więc VACUUM je usuwa. Odbiorca, który nie czytał zmian dłużej niż retencja, musi przeładować całość.`,
          `Dokumentacja Databricks zaleca dziś migrację do <b>automatic change data feed</b>, liczonego przy odczycie i bez ustawień na tabeli. Wymaga Databricks Runtime 19 lub nowszego oraz między innymi tabeli z row tracking. Starszego i nowego CDF nie da się używać razem na jednej tabeli.`
        ),
        warn('CDF to nie CDC ze źródła', `CDC (change data capture) przenosi zmiany z bazy operacyjnej do lakehouse. CDF opisuje zmiany w samej tabeli Delta, już po załadowaniu.`),
        known(
          'W Snowflake',
          `Podobną rolę pełni Stream na tabeli: też podaje zmienione wiersze zamiast całej tabeli.`,
          `Różnica jest w tym, kto pamięta postęp. Stream sam przesuwa swój offset, gdy użyjesz go w transakcji DML. Przy CDF pamięta odbiorca: checkpoint zapytania streamingowego albo własna tabela kontrolna z numerem wersji.`
        )
      ]
    },
    {
      id: 'platforma',
      title: 'Co Databricks dokłada do Sparka',
      blocks: [
        p(`Do tej pory była mowa o formacie tabel. Teraz o platformie. Spark jako silnik umie policzyć zapytanie na wielu maszynach. Nie odpowiada jednak na pytania, które w hurtowni załatwia za Ciebie usługa. Gdzie trwale leżą tabele i co pilnuje ich spójności? Kto może je czytać? Co uruchamia job o 2:00 i ponawia go po błędzie? Jak kod trafia z repozytorium na produkcję?`),
        p(`Databricks składa odpowiedzi na te pytania w jedną platformę. Dokumentacja nazywa ten model <b>lakehouse</b>: system zarządzania danymi, który łączy zalety data lake (tanie pliki w otwartym formacie) i hurtowni (transakcje, schemat, SQL).`),
        table(
          ['Warstwa', 'Co w niej jest', 'Gdzie w rozdziale'],
          lesson.stack.layers.map((l, i) => [`<b>${l.name}</b>`, l.what, layerParts[i]]),
          'Warstwy platformy, od danych do wdrożeń. Nazwy produktów według dokumentacji Databricks z listopada 2026.'
        ),
        p(`Spark jest jedną z tych warstw. Pytanie „co Databricks daje ponad Sparka” ma więc konkretną odpowiedź: format tabel z transakcjami, zarządzany <b>compute</b> (maszyny, które liczą), wspólny katalog z uprawnieniami, orkiestrację i sposób wdrażania. Fundament, czyli Delta Lake, opisały poprzednie części. Kolejne idą przez pozostałe warstwy.`),
        p(`Dwa skróty, których warto unikać. „Databricks to hostowany Spark” pomija format tabel, governance i orkiestrację. „Databricks to to samo co Snowflake” pomija to, że storage jest otwarty, a compute to nie tylko SQL.`)
      ]
    },
    {
      id: 'control-compute-storage',
      title: 'Control plane, compute plane i storage',
      blocks: [
        p(`Pierwsze pytanie działu bezpieczeństwa brzmi: gdzie są nasze dane i kto je przetwarza? Databricks dzieli platformę na części, które leżą na różnych kontach chmurowych.`),
        figure(`Ilustracja. Uproszczona mapa według dokumentacji Databricks dla AWS. Na Azure i GCP podział jest analogiczny. To nie jest diagram sieci.`, {
          kind: 'clusters',
          panels: [
            { label: `Na koncie Databricks`, nodes: [node('control'), node('serverless')] },
            { label: `Na Twoim koncie chmurowym`, nodes: [node('classic')], shared: `Storage: ${box('storage').items.join(', ')}` }
          ]
        }),
        list(
          `<b>Control plane</b> to usługi, którymi Databricks zarządza na własnym koncie: interfejs workspace, harmonogram jobów, katalog z uprawnieniami, przechowywanie kodu notebooków. Zapytań na Twoich tabelach nie liczy. Wysyła polecenia do compute plane i to tam odbywa się liczenie.`,
          `<b>Serverless compute plane.</b> Maszyny, które liczą, działają na koncie Databricks. Nie tworzysz ich w swojej chmurze i nie konfigurujesz. Dane nadal są czytane z magazynu, w którym leżą.`,
          `<b>Classic compute plane.</b> Maszyny działają na Twoim koncie chmurowym i w Twojej sieci. Databricks je uruchamia i wyłącza. Ty wybierasz typy maszyn, płacisz dostawcy chmury za instancje i odpowiadasz za konfigurację sieci.`,
          `<b>Storage.</b> Dane tabel leżą w object storage jako pliki w otwartym formacie. W klasycznym workspace jego magazyn jest na Twoim koncie.`
        ),
        warn(
          'Serverless mówi, gdzie działa compute, a nie gdzie leżą dane',
          `Przejście na serverless SQL warehouse nie przenosi plików tabel. Zmienia się tylko miejsce, w którym działają maszyny liczące zapytania.`,
          `Wyjątek, o którym warto wiedzieć: workspace typu serverless korzysta z domyślnego magazynu zarządzanego w całości przez Databricks. Szczegóły, na przykład sieć i nazwy zasobów, zależą od chmury.`
        ),
        h3('Konto, workspace, metastore'),
        p(`<b>Konto</b> Databricks to poziom najwyższy: rozliczenia, użytkownicy, lista workspace'ów. <b>Workspace</b> to środowisko pracy: notebooki, joby, compute. Konto może mieć wiele workspace'ów, na przykład osobne dla dev i prod.`),
        p(`<b>Metastore</b> Unity Catalog to rejestr tabel i uprawnień na poziomie konta. Można go podpiąć do wielu workspace'ów w tym samym regionie. Dzięki temu tabela i jej uprawnienia nie należą do jednego workspace'u. Są wspólne dla wszystkich podpiętych do tego samego metastore. Workspace z innym metastore, na przykład w innym regionie, ich nie widzi.`),
        known(
          'W Snowflake',
          `Snowflake ma trzy warstwy: storage, compute (virtual warehouses) i cloud services. Control plane odpowiada warstwie cloud services, a SQL warehouse to odpowiednik virtual warehouse. Serverless jest najbliżej doświadczenia ze Snowflake: bierzesz compute i nie widzisz maszyn.`,
          `Analogia kończy się w trzech miejscach. Storage nie jest częścią usługi w tym samym sensie: pliki leżą w otwartym formacie i inne silniki mogą je czytać, o ile obsługują funkcje użyte w tabeli i mają do niej uprawnienia. Compute bywa na Twoim koncie, z Twoją siecią i Twoim rachunkiem od dostawcy chmury. I compute to nie tylko SQL: ten sam katalog obsługuje joby w Pythonie, streaming i modele.`
        )
      ]
    },
    {
      id: 'compute',
      title: 'Rodzaje compute',
      blocks: [
        p(`W Snowflake wybierasz rozmiar warehouse i na tym koniec. Databricks ma kilka rodzajów compute, bo obsługuje więcej niż SQL. Rodzaj compute dobiera się do rodzaju pracy.`),
        table(['Rodzaj pracy', 'Compute'], lesson.compute.cases.map(c => [noArrow(c.label), c.pick]), 'Zalecenia według dokumentacji Databricks z listopada 2026. Dostępność serverless zależy od regionu i konfiguracji workspace.'),
        h3('SQL warehouse'),
        p(`To compute do zapytań SQL: edytor SQL, dashboardy, narzędzia BI, dbt. Są trzy typy: serverless, pro i classic. Databricks zaleca serverless tam, gdzie jest dostępny. Dokumentacja podaje dla niego start zwykle w 2–6 sekund, a dla typu pro około 4 minut. Zarządzasz rozmiarem i liczbą klastrów, czyli tym, ile zapytań warehouse obsłuży naraz.`),
        p(`To nie jest compute ogólnego przeznaczenia. Notebook podpięty do SQL warehouse wykona tylko komórki SQL i Markdown. Komórki w Pythonie nie uruchomi.`),
        h3('Compute jobów'),
        p(`Zaplanowany job, na przykład nocny ETL w PySparku, uruchamia się na compute tworzonym dla tego przebiegu. W wariancie klasycznym to <b>job cluster</b>: powstaje na start joba i znika po nim. Wybierasz wtedy wersję Databricks Runtime, typy i liczbę maszyn oraz autoskalowanie. W wariancie serverless maszyn nie konfigurujesz wcale.`),
        p(`Serverless ma swoje ograniczenia: nie ma Spark UI (jest query profile), działa tylko API Spark Connect, a ustawień Sparka do zmiany jest niewiele.`),
        h3('Compute do pracy interaktywnej'),
        p(`Do eksploracji i pisania kodu potrzebny jest compute, który odpowiada od razu i obsługuje Pythona, SQL, Scalę i R. W workspace z Unity Catalog nowe notebooki domyślnie korzystają z serverless. Wariant klasyczny to <b>klaster all-purpose</b>: ktoś musi go włączyć, wyłączyć i opłacić także wtedy, gdy stoi bezczynnie.`),
        p(`Klaster all-purpose współdzielony przez zespół jest wygodny, ale produkcyjne joby na nim to zły pomysł. Konkurują o zasoby z ludźmi i zależą od klastra, który ktoś zmienia ręcznie. To rada praktyczna, a nie reguła z dokumentacji.`),
        h3('Pipelines'),
        p(`Przetwarzanie przyrostowe między warstwami można oddać Lakeflow pipelines: deklarujesz tabele, a platforma sama zarządza compute. Ten model opisuje część o Lakeflow.`),
        p(`Wszystkie rodzaje compute czytają te same tabele z tego samego katalogu.`),
        deeper(
          'Photon i nazwy, które zmieniają się częściej niż architektura',
          `<b>Photon</b> to wektorowy silnik zapytań wbudowany w Databricks, zgodny z API Sparka. Działa we wszystkich typach SQL warehouse. Nie zmienia Twojego kodu, tylko sposób, w jaki jest wykonywany.`,
          `Compute klasyczny ma w dokumentacji dwa zestawy nazw: starsze „all-purpose cluster” i „job cluster” oraz nowsze tryby dostępu „standard” (współdzielony) i „dedicated” (dla jednego użytkownika lub grupy). W rozmowach częściej padają te pierwsze.`,
          `SQL warehouse do 2023 roku nazywał się SQL endpoint. Git folders to dawne Repos. Bundles to dawne Databricks Asset Bundles. Warto znać obie nazwy, bo ogłoszenia o pracę są starsze niż dokumentacja.`
        )
      ]
    },
    {
      id: 'unity-catalog',
      title: 'Unity Catalog: jeden katalog i jedne uprawnienia',
      blocks: [
        p(`Tabela to pliki w magazynie. Kto może je czytać? Gdyby decydowały o tym uprawnienia do magazynu, każdy silnik i każdy workspace pilnowałby dostępu po swojemu.`),
        p(`<b>Unity Catalog</b> rozwiązuje to jednym rejestrem obiektów i jednym miejscem nadawania uprawnień. To warstwa <b>governance</b> wbudowana w Databricks, czyli nadzór nad danymi: kto ma do nich dostęp i co się z nimi dzieje.`),
        p(`Obiekty mają trzyczłonowe nazwy: <code>katalog.schemat.obiekt</code>. Analityk ma czytać tabelę <code>${lesson.uc.catalog}.sales.orders</code>. Musi mieć uprawnienie na każdym kroku drogi do niej.`),
        figure(`Ilustracja. Droga do tabeli <code>${lesson.uc.catalog}.sales.orders</code> i uprawnienie potrzebne na każdym poziomie. Nazwy obiektów wymyślone.`, {
          kind: 'path',
          steps: [
            { name: 'Katalog', note: 'Wymaga USE CATALOG.', options: [lesson.uc.catalog], pick: 0 },
            { name: 'Schemat', note: 'Wymaga USE SCHEMA.', options: lesson.uc.schemas, pick: 0 },
            { name: 'Tabela', note: 'Wymaga SELECT, nadanego na tabeli albo wyżej.', options: salesObjects, pick: 0 }
          ],
          total: 'Komplet do odczytu: USE CATALOG, USE SCHEMA i SELECT.'
        }),
        p(`Uprawnienia <b>dziedziczą się w dół</b>. <code>SELECT</code> nadany na katalogu albo schemacie obejmuje obiekty w środku, obecne i przyszłe. Uprawnienia <code>USE</code> same nie dają dostępu do danych, ale bez nich nie da się w ogóle dojść do obiektu.`),
        table(
          ['SELECT nadany na', 'USE CATALOG i USE SCHEMA na sales', 'Analityk przeczyta'],
          [
            ['katalogu prod', 'tak', 'orders, customers'],
            ['schemacie prod.sales', 'tak', 'orders, customers'],
            ['tabeli prod.sales.orders', 'tak', 'orders'],
            ['katalogu prod', 'nie', 'nic']
          ],
          'Model reguły z dokumentacji. Katalog prod ma jeszcze schemat finance z tabelą invoices.'
        ),
        p(`Pierwszy wiersz zaskakuje najczęściej. <code>SELECT</code> na katalogu obejmuje też tabelę <code>prod.finance.invoices</code>. Analityk nie ma jednak <code>USE SCHEMA</code> na <code>prod.finance</code>, więc jej nie przeczyta. Wolumen <code>raw_files</code> to pliki, a nie tabela, i ma osobne uprawnienie <code>READ VOLUME</code>.`),
        h3('Tabela managed i tabela external'),
        p(`Kto odpowiada za pliki tabeli? Są dwa warianty.`),
        table(
          ['', 'Managed', 'External'],
          [
            ['Lokalizacja plików', 'Wybiera Unity Catalog', 'Wskazujesz Ty'],
            ['Czym zarządza katalog', 'Odczytem, zapisem, lokalizacją i optymalizacją', 'Tylko metadanymi i dostępem'],
            ['Po <code>DROP TABLE</code>', 'Pliki są usuwane po okresie odzyskiwania (domyślnie 7 dni). Do tego czasu działa <code>UNDROP TABLE</code>', 'Pliki zostają w magazynie']
          ]
        ),
        p(`Databricks w większości przypadków zaleca tabele managed. Część funkcji działa wyłącznie na nich: predictive optimization, automatyczny liquid clustering, transakcje na wielu instrukcjach. Tabele managed mogą być w formacie Delta Lake albo Apache Iceberg. External wybiera się wtedy, gdy pliki muszą leżeć w konkretnym miejscu albo zapisuje je system spoza Databricks.`),
        h3('Co jeszcze należy do governance'),
        list(
          `<b>Wiersze i kolumny.</b> Filtry wierszy i maski kolumn ograniczają to, co użytkownik widzi w tabeli. Są też polityki oparte na atrybutach (ABAC).`,
          `<b>Lineage</b>, czyli pochodzenie danych. Unity Catalog automatycznie zapisuje, z czego powstała tabela i kolumna. Dane są w tabelach systemowych <code>system.access.table_lineage</code> i <code>system.access.column_lineage</code>.`,
          `<b>Audyt</b>, czyli kto i co zrobił: <code>system.access.audit</code>.`,
          `<b>Pozostałe obiekty.</b> Wolumeny (pliki, które nie są tabelami), funkcje, modele. Bezpośrednio pod metastore leżą między innymi storage credentials i external locations, czyli opis tego, jak katalog dostaje się do magazynu.`,
          `Uprawnienie <code>BROWSE</code> pozwala zobaczyć, że obiekt istnieje, i poprosić o dostęp, bez prawa do czytania danych.`
        ),
        known(
          'W Snowflake',
          `W Snowflake nadajesz roli <code>USAGE</code> na bazie i schemacie oraz <code>SELECT</code> na tabeli. Unity Catalog działa tak samo: <code>USE CATALOG</code>, <code>USE SCHEMA</code>, <code>SELECT</code>. Katalog jest odpowiednikiem bazy.`,
          `Analogia kończy się na magazynie. W Snowflake dane i uprawnienia siedzą w jednej usłudze, więc uprawnień nie da się obejść. Tu pliki leżą w magazynie chmurowym. Kto dostanie bezpośredni dostęp do magazynu, ominie Unity Catalog. Dlatego dostęp do magazynu dostaje katalog, a nie ludzie. Katalog obejmuje też rzeczy, których hurtownia nie ma: wolumeny z plikami i modele.`
        )
      ]
    },
    {
      id: 'lakeflow',
      title: 'Lakeflow: Jobs i pipelines',
      blocks: [
        p(`Notebook, który działa, gdy go klikniesz, to jeszcze nie pipeline. Ktoś musi go uruchomić o 2:00, poczekać na dane, ponowić po błędzie i powiadomić zespół. Databricks zbiera te funkcje pod nazwą <b>Lakeflow</b>: Lakeflow Connect pobiera dane ze źródeł, Lakeflow pipelines je przekształcają, a Lakeflow Jobs wszystko uruchamia.`),
        h3('Lakeflow Jobs: kiedy i w jakiej kolejności'),
        p(`Lakeflow Jobs to harmonogram i orkiestrator. Job składa się z <b>tasków</b>, czyli kroków. Zależności między nimi tworzą graf: ten krok dopiero po tamtym. Taskiem może być notebook, skrypt Pythona, zapytanie SQL, pipeline, projekt dbt albo inny job. Job startuje według harmonogramu albo po zdarzeniu, na przykład gdy w magazynie pojawią się nowe pliki.`),
        h3('Lakeflow pipelines: jakie tabele mają istnieć'),
        p(`Pipelines idą krok dalej. Nie piszesz kroków. Deklarujesz, jakie tabele mają powstać i z jakiego zapytania.`),
        sql(
          `CREATE OR REFRESH STREAMING TABLE\n  orders_silver (\n  CONSTRAINT valid_amount\n    EXPECT (amount > 0)\n    ON VIOLATION DROP ROW\n) AS SELECT * FROM STREAM orders_bronze;\n\nCREATE OR REFRESH MATERIALIZED VIEW\n  revenue_daily\nAS SELECT order_date,\n  SUM(amount) AS revenue\nFROM orders_silver\nGROUP BY order_date;`,
          'Pipeline deklaratywny w SQL'
        ),
        list(
          `<b>Streaming table</b> to tabela przyrostowa. Przetwarza każdy rekord źródła raz, przy założeniu, że źródło tylko rośnie. Nie piszesz obsługi checkpointu ani logiki „co już wczytałem”: pilnuje tego pipeline. Słowo <code>STREAM</code> mówi, że źródło ma być czytane przyrostowo.`,
          `<b>Expectation</b> to reguła jakości zapisana w definicji tabeli. Tutaj wiersz, w którym kwota nie jest większa od zera, zostaje odrzucony.`,
          `<b>Materialized view</b> przechowuje wynik zapytania. Platforma przelicza go w miarę potrzeby, tak żeby odpowiadał bieżącym danym, i nie musi liczyć wszystkiego od zera. Od zwykłego widoku różni się tym, że wynik jest zapisany, więc odczyt nie liczy agregacji za każdym razem.`,
          `<b>Kolejność wynika z odwołań.</b> Pipeline sam wykrywa, że <code>orders_silver</code> zależy od <code>orders_bronze</code>, a <code>revenue_daily</code> od <code>orders_silver</code>.`
        ),
        table(
          ['Zapis reguły', 'Wiersz, który ją łamie'],
          [
            ['<code>EXPECT (…)</code>', 'Zostaje zapisany, a naruszenie jest liczone'],
            ['<code>… ON VIOLATION DROP ROW</code>', 'Zostaje odrzucony'],
            ['<code>… ON VIOLATION FAIL UPDATE</code>', 'Zatrzymuje całą aktualizację']
          ],
          'Trzy reakcje expectation na naruszenie, według dokumentacji Databricks.'
        ),
        p(`Podział ról jest prosty. Jobs odpowiada na pytanie „kiedy i w jakiej kolejności”. Pipelines odpowiadają na pytanie „jakie tabele mają istnieć i z czego powstają”, a kolejnością, przetwarzaniem przyrostowym i ponawianiem zajmują się same. W praktyce łączy się oba: pipeline jest jednym z tasków joba.`),
        p(`Cena: to osobny model pracy, a nie zwykły job z notebookiem. Nie każdą logikę da się wygodnie wyrazić deklaratywnie.`),
        known(
          'W dbt',
          `W dbt deklarujesz modele jako zapytania <code>SELECT</code>, dbt wyprowadza z nich graf zależności, a testy sprawdzają dane. Pipeline deklaratywny robi to samo po stronie Databricks: tabela to zapytanie, graf wynika z odwołań, a expectations pełnią rolę testów.`,
          `Analogia kończy się na wykonaniu. dbt generuje SQL i wysyła go do silnika, a orkiestrację i przyrostowość ustawiasz sam. Pipeline sam wykonuje kod: zarządza compute, stanem streamingu i ponawianiem. Expectation działa w trakcie zapisu i potrafi odrzucić wiersz, a test dbt sprawdza tabelę po fakcie. Jedno nie wyklucza drugiego: dbt jest też typem taska w Lakeflow Jobs.`
        ),
        deeper(
          'Nazwy: DLT, Lakeflow pipelines, Spark Declarative Pipelines',
          `Ten produkt nazywał się Delta Live Tables (DLT). Dokumentacja Databricks z listopada 2026 mówi, że to teraz Lakeflow pipelines, a jej strona główna nosi tytuł „Spark Declarative Pipelines on Lakeflow”. W ogłoszeniach spotkasz też „Lakeflow Declarative Pipelines”. To ten sam produkt na różnych etapach nazewnictwa.`,
          `Lakeflow pipelines są zbudowane na otwartym Apache Spark Declarative Pipelines i z nim zgodne, ale dokładają własne funkcje. Przykład z dokumentacji: AUTO CDC, czyli gotowa obsługa zdarzeń CDC z wariantami SCD typu 1 i 2, nie jest dostępne w otwartej wersji.`
        ),
        h3('Notebooki i praca z kodem'),
        list(
          `<b>Notebook</b> to dokument z komórkami kodu w Pythonie, SQL, Scali i R. Dobry do eksploracji i jako task joba.`,
          `<b>Git folders</b> (dawniej Repos) podpinają repozytorium Git do workspace: gałęzie, commity i pull requesty zamiast kopiowania notebooków.`,
          `<b>Databricks Connect</b> to biblioteka kliencka, która łączy Twoje IDE z compute Databricks. Piszesz i debugujesz lokalnie, a kod wykonuje się na platformie.`,
          `Dojrzały sposób pracy: logika siedzi w zwykłych funkcjach i modułach Pythona, które testujesz lokalnie. Notebook albo task tylko je wywołuje. To rada praktyczna, a nie reguła z dokumentacji.`
        )
      ]
    },
    {
      id: 'bundles-cicd',
      title: 'Bundles, CI/CD i monitoring',
      blocks: [
        p(`Job wyklikany w interfejsie istnieje w jednym workspace. Nikt go nie zrecenzował i nie da się go odtworzyć. <b>Declarative Automation Bundles</b> (dawniej Databricks Asset Bundles, w skrócie DABs) zamieniają definicje jobów i pipeline'ów w pliki w repozytorium.`),
        yaml(lesson.deploy.lines.map(l => l.code).join('\n'), lesson.deploy.codeTitle),
        list(
          `<code>bundle</code>: bundle to katalog w repozytorium z tym plikiem i kodem obok. Nazwa identyfikuje wdrożenie.`,
          `<code>resources</code>: co ma powstać w workspace. To ta sama definicja joba, którą widać w interfejsie, tylko zapisana jako kod i recenzowana w pull requeście. Ścieżki wskazują pliki z repozytorium, więc wdrożenie przenosi kod i definicję razem.`,
          `<code>targets</code>: środowiska. W trybie <code>development</code> zasoby dostają prefiks z nazwą użytkownika, a harmonogramy są wstrzymane, więc dwie osoby nie wchodzą sobie w drogę.`,
          `<code>run_as</code>: na produkcję wdraża i uruchamia <b>service principal</b>, czyli tożsamość techniczna, a nie konto osoby. Dokumentacja zaleca to wprost.`
        ),
        h3('Typowy przepływ'),
        steps(...lesson.deploy.flow.map(f => `<b>${f.step}:</b> ${f.text}.`)),
        p(`Bundle jest dla zasobów platformy tym, czym projekt dbt dla modeli: definicja w Gicie, te same pliki dla każdego środowiska, wdrożenie jednym poleceniem z CI. Różnica: dbt wdraża modele SQL do hurtowni, a bundle wdraża zasoby platformy, które dopiero będą coś uruchamiać. Dokumentacja Databricks nazywa bundles zalecanym podejściem do CI/CD.`),
        list(
          `<b>Bundles a Terraform.</b> Praktyczny podział: Terraform do infrastruktury (workspace'y, sieć, magazyny, konfiguracja Unity Catalog), bundles do zasobów projektu (joby, pipeline'y). To ocena praktyczna, a nie reguła z dokumentacji.`,
          `<b>Logowanie z CI.</b> Pipeline CI musi się zalogować do Databricks. Dokumentacja zaleca workload identity federation: pipeline dostaje krótkotrwałą tożsamość i nie przechowuje sekretów Databricks.`,
          `<b>Nazwa.</b> Zmiana na Declarative Automation Bundles (marzec 2026) nie zmieniła polecenia CLI ani formatu konfiguracji.`
        ),
        h3('Monitoring: gdzie patrzeć, gdy coś nie działa'),
        list(
          `<b>Joby.</b> Historia przebiegów w interfejsie Lakeflow Jobs oraz powiadomienia e-mailem albo webhookiem, gdy job padnie lub trwa za długo. Do analizy zbiorczej służy tabela systemowa <code>system.lakeflow.job_run_timeline</code>.`,
          `<b>Zapytania.</b> Historia zapytań i query profile: plan z metrykami operatorów, między innymi ilością danych zrzuconych na dysk. To odpowiednik Query Profile ze Snowflake.`,
          `<b>Pipelines.</b> Dziennik zdarzeń pipeline'u, w tym wyniki expectations.`,
          `<b>Koszty.</b> Tabela systemowa <code>system.billing.usage</code>.`,
          `<b>Jakość danych.</b> Funkcja data quality monitoring: wykrywanie anomalii i profilowanie danych. Profilowanie nazywało się wcześniej Lakehouse Monitoring.`
        ),
        p(`Tabele systemowe to zwykłe tabele w katalogu <code>system</code>. Pytasz o nie SQL-em tak samo jak o dane biznesowe.`)
      ]
    },
    {
      id: 'microsoft',
      title: 'Ekosystem Microsoft: siedem nazw',
      blocks: [
        p(`Wiele projektów na Databricks działa w Azure, a obok coraz częściej stoi Microsoft Fabric. Nie trzeba umieć ich obsługiwać. Trzeba wiedzieć, która usługa co robi i jak się ze sobą łączą.`),
        figure(`Ilustracja. Typowa droga danych w projekcie na Azure. Orientacja architektoniczna według Microsoft Learn (stan na listopad 2026), nie instrukcja obsługi.`, {
          kind: 'lanes',
          lanes: [{ label: 'Od źródła do raportu', steps: lesson.microsoft.chain.map((name, i) => ({ name, where: chainNotes[i], hot: i === 2 })) }]
        }),
        p(`<b>ADLS Gen2</b> (Azure Data Lake Storage) to magazyn, w którym leżą pliki tabel Delta. Według dokumentacji nie jest osobną usługą, tylko zestawem możliwości zbudowanych na Azure Blob Storage z myślą o analityce. Najważniejsza z nich to hierarchiczna przestrzeń nazw, czyli prawdziwe katalogi: zmiana nazwy albo usunięcie katalogu to jedna atomowa operacja na metadanych. To tylko storage. Nie ma silnika zapytań ani transakcji na poziomie tabeli. Te dokłada Delta Lake i silnik, który ją czyta.`),
        p(`<b>Azure Data Factory</b> (ADF) to chmurowa usługa integracji danych: orkiestruje i automatyzuje przenoszenie i transformację danych. Jej pipeline składa się z aktywności: skopiuj dane ze źródła, a potem uruchom przetwarzanie gdzie indziej. Ma aktywności dla Azure Databricks, które uruchamiają notebook albo job. ADF zwykle nie liczy sam, tylko zleca pracę innym usługom. Stąd spór spotykany w projektach: ADF czy Lakeflow Jobs jako orkiestrator. Microsoft opisuje Data Factory w Fabric jako następną generację ADF.`),
        p(`<b>Azure Databricks</b> to ta sama platforma, którą opisuje ten rozdział, dostępna jako usługa w Azure. W wariancie klasycznym compute działa w Twojej subskrypcji Azure i tam też leży magazyn workspace. Nazwy produktów są identyczne. Różnice dotyczą integracji z Azure: tożsamości, sieci, rozliczeń. W portalu Azure klasyczny workspace nazywa się workspace hybrydowym.`),
        p(`<b>Microsoft Fabric</b> to platforma analityczna dostarczana jako SaaS, która obsługuje cały przepływ danych, od pobrania po raport. To jeden produkt z wieloma obciążeniami: Data Factory, Data Engineering (Spark), Data Warehouse, Real-Time Intelligence, Data Science, Power BI. Wszystkie pracują na wspólnym magazynie. Rozliczenie idzie przez wspólną pojemność (capacity, jednostki F), a nie osobno za każdy silnik. Jest mniej do konfigurowania niż w Databricks, ale i mniej kontroli nad compute.`),
        p(`<b>OneLake</b> to jeden data lake dla całej organizacji, zbudowany na ADLS Gen2. Każdy tenant Fabric ma dokładnie jeden, tworzony automatycznie. Tabele są zapisane w formacie Delta Parquet albo Iceberg. Skróty (shortcuts) to odwołania do danych, które leżą gdzie indziej, na przykład w ADLS albo S3, bez kopiowania. Tu obie platformy się stykają: dane z Unity Catalog można udostępnić w Fabric bez przenoszenia, przez mirrored catalog oparty na skrótach.`),
        p(`<b>Fabric Lakehouse i Warehouse</b> to dwa sposoby pracy na tych samych danych. Oba przechowują dane w formacie Delta w OneLake. W Lakehouse piszesz Sparkiem, trzymasz dane strukturalne i niestrukturalne, a do zapytań SQL dostajesz SQL analytics endpoint tylko do odczytu. Warehouse daje pełny T-SQL z zapisem i transakcjami ACID na wielu tabelach. Wybór zależy od tego, kto pisze i czym: inżynierowie w Sparku biorą Lakehouse, zespół SQL bierze Warehouse.`),
        p(`<b>Power BI semantic model</b> to warstwa między tabelami a raportem: tabele, relacje i miary, na których stoją raporty. To nie jest tabela, tylko model zbudowany nad tabelami. Dlatego w Databricks ani w Snowflake nie ma go wśród tabel. Tryby: Import (kopia w pamięci), DirectQuery (zapytania do źródła na żywo) oraz Direct Lake, który ładuje dane do pamięci prosto z tabel Delta w OneLake i wymaga pojemności Fabric.`),
        p(`W skrócie: ADLS to magazyn. Data Factory przenosi dane i zleca pracę. Databricks i Fabric przetwarzają. Semantic model podaje dane raportom. Obie platformy łączy tabela Delta w object storage, dlatego częściej się uzupełniają, niż wykluczają.`)
      ]
    },
    {
      id: 'wybor-platformy',
      title: 'Snowflake, Databricks, Fabric: porównanie i wybór',
      blocks: [
        p(`Wszystkie trzy platformy rozdzielają storage od compute. Wszystkie obsługują dziś otwarte formaty tabel, każda w innym zakresie. Różnią się tym, od czego zaczynały, i tym, ile pracy oddajesz usłudze. Snowflake zaczyna od hurtowni: widzisz SQL, a dane domyślnie leżą w magazynie usługi. Databricks zaczyna od plików w otwartym formacie i silnika ogólnego przeznaczenia. Fabric zaczyna od Power BI i jednego magazynu OneLake.`),
        ...lesson.compare.dims.flatMap(d => [h3(d.label), list(`<b>Snowflake.</b> ${d.snowflake}`, `<b>Databricks.</b> ${d.databricks}`, `<b>Fabric.</b> ${asChapter(d.fabric)}`)]),
        p(`Zestawienie opiera się na dokumentacji trzech dostawców z listopada 2026. Punkt „Mocna strona” to ocena inżynierska, a nie cytat. Platformy szybko się do siebie zbliżają, więc szczegóły warto sprawdzać na bieżąco.`),
        h3('Otwarte formaty: wybór nie musi być ostateczny'),
        list(
          `Snowflake dokumentuje tabele Apache Iceberg z plikami w Twoim magazynie oraz odczyt tabel zapisanych przez silniki Delta Lake (tabele Iceberg tworzone z plików Delta).`,
          `Databricks dokumentuje odczyt tabel Delta przez klientów Iceberg: funkcja UniForm dopisuje metadane Iceberg do tabeli Delta. Ten dostęp jest tylko do odczytu.`,
          `OneLake przechowuje tabele w Delta albo Iceberg i potrafi wystawić dane z Unity Catalog przez skróty, bez kopiowania.`
        ),
        p(`Sam format niczego jednak nie gwarantuje. Żeby drugi silnik przeczytał tabelę, muszą być spełnione trzy warunki. Silnik obsługuje funkcje, których tabela używa (na przykład deletion vectors albo column mapping), i jej wersję protokołu. Katalog tę tabelę wystawia. Tożsamość, która czyta, ma uprawnienia. To wniosek z protokołu Delta i dokumentacji, a nie cytat.`),
        p(`Dane można więc trzymać raz, a silnik dobierać do rodzaju pracy. Ceną jest złożoność: dwa katalogi, dwa modele uprawnień i ograniczenia zgodności, które trzeba sprawdzić dla konkretnych wersji.`),
        h3('Cztery sytuacje'),
        p(`Poniższe przykłady są wymyślone, a rekomendacje to ocena inżynierska. Liczy się to, czy uzasadnienie wynika z wymagań.`),
        p(`<b>Mały zespół SQL.</b> Pięciu analityków i dwóch inżynierów. Dane są strukturalne i przychodzą z systemów transakcyjnych raz na dobę. Cała logika jest w SQL i dbt, a ML i streamingu nikt nie planuje.`),
        p(`<b>Rekomendacja: ${scenario(0)}.</b> To praca dla klasycznej hurtowni. Najwięcej daje platforma, która zdejmuje z małego zespołu utrzymanie plików i compute. Przepisywanie działającego SQL na PySparka niczego nie poprawi. Zastrzeżenie: Databricks SQL z serverless SQL warehouse i dbt też obsłuży ten przypadek. Rozstrzygają koszty, istniejące umowy i umiejętności zespołu, a nie lista funkcji.`),
        p(`<b>Streaming, ML i pliki.</b> Platforma zbiera zdarzenia z aplikacji w czasie zbliżonym do rzeczywistego. Zespół data science trenuje modele w Pythonie na surowych danych, a część danych to pliki JSON i obrazy. Firma chce otwartego formatu na własnym koncie chmurowym.`),
        p(`<b>Rekomendacja: ${scenario(1)}.</b> Streaming, kod w Pythonie, dane niestrukturalne i otwarty format na własnym koncie: do takich wymagań zbudowano lakehouse. Ceną jest więcej decyzji po stronie zespołu: rodzaje compute, układ tabel, retencja. Bez inżynierów, którzy to udźwigną, przewaga zamienia się w koszt.`),
        p(`<b>Firma w ekosystemie Microsoft.</b> Średnia firma pracuje w Microsoft 365, raportuje w Power BI i ma jednego inżyniera danych. Chce jednego rozwiązania od pobrania danych do raportu, bez składania go z kilku usług.`),
        p(`<b>Rekomendacja: ${scenario(2)}.</b> Wymaganiem jest prostota i integracja z tym, co firma już ma. Fabric daje pobieranie, przetwarzanie, hurtownię i Power BI jako jeden SaaS na wspólnym magazynie, a Direct Lake czyta tabele Delta bez kopiowania do modelu. Gdy pojawią się ciężkie obciążenia inżynierskie albo ML, można rozważyć dołożenie Databricks. Zgodność funkcji tabel i uprawnienia trzeba wtedy sprawdzić dla konkretnego przypadku.`),
        p(`<b>Działająca hurtownia i nowy zespół.</b> Firma od lat raportuje w Snowflake i jest zadowolona. Nowy zespół chce trenować modele i przetwarzać duże logi w Sparku. Zarząd pyta, czy trzeba wszystko migrować na jedną platformę.`),
        p(`<b>Rekomendacja: ${scenario(3)}.</b> Migracja działającej hurtowni to duży koszt bez korzyści dla raportowania. Druga platforma też kosztuje, więc nie jest odpowiedzią domyślną. Najpierw trzeba ustalić, czego dokładnie potrzebuje nowy zespół i czy obsłuży to obecna platforma: Snowflake ma własne narzędzia do Pythona i ML (Snowpark, Snowflake ML). Jeśli potrzeba biznesowa uzasadnia Sparka, drugi silnik i dane współdzielone w otwartym formacie są rozsądniejsze niż migracja. Dwie platformy to dwa modele uprawnień i dwa rachunki. Trzeba też ustalić, który katalog jest właścicielem której tabeli.`),
        h3('Kolejność pytań'),
        steps(
          `Jaka to praca: SQL, kod, streaming, ML?`,
          `Kto będzie tym pracował: analitycy, inżynierowie, obie grupy?`,
          `Co firma już ma i za co płaci?`,
          `Ile kontroli potrzeba nad compute i formatem, a ile obsługi zespół udźwignie?`
        ),
        p(`Nazwa platformy pada na końcu. Pytanie „która platforma jest lepsza” nie ma odpowiedzi bez tych czterech.`),
        deeper(
          'Gdy doświadczenie jest z hurtowni',
          `Kto na produkcji pracował z hurtownią, a Delta Lake zna z nauki, może to powiedzieć wprost i pokazać, że rozumie mechanizm. Hurtownia daje transakcje jako usługę. Delta Lake robi to samo logiem transakcyjnym obok plików Parquet: atomowe commity, wersje, wykrywanie konfliktów między piszącymi.`,
          `Praktyczna różnica: pliki są Twoje, więc układ danych i retencja to decyzje projektowe. Rozsądny punkt wyjścia to tabele managed w Unity Catalog z predictive optimization, a o kluczach klastrowania i retencji VACUUM warto pomyśleć na początku, a nie po pierwszym wolnym zapytaniu.`
        )
      ]
    }
  ],
  keyPoints: [
    `Parquet to format jednego pliku. Tabelę robi z plików dopiero lista w logu Delta. Plik, którego nie ma na liście, dla czytelnika nie istnieje.`,
    `Commit to jeden plik JSON w <code>_delta_log</code> z akcjami <code>add</code> i <code>remove</code>. Numer commitu to wersja tabeli. Plik commitu jest albo go nie ma, stąd zapis „wszystko albo nic”.`,
    `Plików Parquet się nie zmienia. UPDATE, DELETE i MERGE zapisują nowe pliki i oznaczają stare jako usunięte. Z deletion vectors zapisują znacznik obok pliku.`,
    `Akcja <code>remove</code> nie kasuje pliku z dysku. Stare pliki są potrzebne wcześniejszym wersjom i znikają dopiero po VACUUM.`,
    `Równoległe zapisy porządkuje optimistic concurrency: konflikt sprawdza się przy commicie. Przegrany dostaje błąd, a nie uszkodzoną tabelę. Dopisania, które nie czytają tabeli, zwykle sobie nie przeszkadzają.`,
    `MERGE kończy się jednym commitem i wymaga jednoznacznego źródła. Paczkę deduplikuje się do jednego wiersza na klucz, klucz w <code>ON</code> ma być stały, a warunek na kolejność chroni przed nadpisaniem nowszych danych starszymi.`,
    `Schema enforcement domyślnie odrzuca zapis z nieznaną kolumną. Schema evolution to świadoma zgoda na zmianę schematu: dodaje kolumny, ale nie zmienia typów.`,
    `Do odczytu starej wersji potrzebne są jej pliki i jej wpis w logu. Domyślne retencje to 7 dni dla plików i 30 dni dla logu. Time travel nie jest kopią zapasową.`,
    `OPTIMIZE przyspiesza odczyt i nie zwalnia miejsca. VACUUM zwalnia miejsce i nie przyspiesza zapytań. Na tabelach managed obie operacje może uruchamiać predictive optimization.`,
    `Data skipping działa wtedy, gdy podobne wartości leżą w tych samych plikach. Liquid clustering (<code>CLUSTER BY</code>) mówi, po czym układać dane, a samo układanie wykonuje OPTIMIZE.`,
    `Change Data Feed podaje zmienione wiersze zamiast całej tabeli. Trzeba go włączyć, działa od momentu włączenia i podlega retencji tabeli.`,
    `Databricks dokłada do Sparka format tabel z transakcjami, zarządzany compute, Unity Catalog, orkiestrację (Lakeflow) i sposób wdrażania (bundles).`,
    `Control plane działa na koncie Databricks. Compute działa u Databricks (serverless) albo na Twoim koncie (classic). Pliki tabel leżą w object storage. Słowo „serverless” dotyczy compute, a nie danych.`,
    `W Unity Catalog uprawnienia dziedziczą się w dół. Do odczytu tabeli potrzebny jest komplet: <code>USE CATALOG</code>, <code>USE SCHEMA</code> i <code>SELECT</code>. Managed albo external to pytanie, kto odpowiada za pliki.`,
    `Lakeflow Jobs mówi, kiedy i w jakiej kolejności. Lakeflow pipelines mówią, jakie tabele mają istnieć. Bundles trzymają definicje w repozytorium, a na produkcję wdraża service principal.`,
    `Wybór platformy zaczyna się od rodzaju pracy, zespołu i tego, co firma już ma. Nazwa pada na końcu. Druga platforma wymaga uzasadnienia biznesowego.`
  ],
  glossary: [
    { term: 'ADLS Gen2', def: 'Azure Data Lake Storage. Możliwości zbudowane na Azure Blob Storage z myślą o analityce, między innymi prawdziwe katalogi. Sam storage, bez silnika zapytań.' },
    { term: 'Akcja', def: 'Pojedynczy wpis w commicie. Najważniejsze to add (plik wchodzi do tabeli) i remove (plik z niej wypada).' },
    { term: 'Auto compaction', def: 'Mechanizm Databricks, który skleja małe pliki zaraz po udanym zapisie, na tym samym klastrze.' },
    { term: 'Blind append', def: 'Dopisanie wierszy, które nie czyta tabeli docelowej: zwykły INSERT albo tryb append bez podzapytań do tej tabeli.' },
    { term: 'Bundle', def: 'Declarative Automation Bundles, dawniej Databricks Asset Bundles. Definicje jobów i pipeline\'ów jako pliki w repozytorium, wdrażane poleceniem z CI.' },
    { term: 'Change Data Feed (CDF)', def: 'Funkcja tabeli Delta, która podaje zmiany na poziomie wiersza między wersjami: insert, delete oraz wiersz przed zmianą i po niej.' },
    { term: 'Checkpoint', def: 'Plik w _delta_log z kompletnym, odtworzonym stanem tabeli w danej wersji. Czytelnik doczytuje tylko commity po nim.' },
    { term: 'Classic compute plane', def: 'Maszyny liczące, które działają na koncie chmurowym klienta i w jego sieci. Databricks je uruchamia i wyłącza.' },
    { term: 'Commit', def: 'Zatwierdzona zmiana tabeli Delta: jeden plik JSON w _delta_log. Jego numer to wersja tabeli.' },
    { term: 'Compute', def: 'Maszyny, które liczą zapytania i joby.' },
    { term: 'Control plane', def: 'Usługi, którymi Databricks zarządza na własnym koncie: interfejs, API, harmonogram jobów, Unity Catalog. Nie liczy zapytań na tabelach.' },
    { term: 'Czytelnik', def: 'Zapytanie albo program, który czyta tabelę.' },
    { term: 'Data skipping', def: 'Pomijanie całych plików na podstawie statystyk z logu, bez otwierania ich: najmniejszej i największej wartości kolumn.' },
    { term: 'Deletion vectors', def: 'Znaczniki zapisane obok pliku danych, które mówią, że wiersz nie obowiązuje. Zmiana wiersza nie wymaga wtedy przepisania całego pliku.' },
    { term: 'Direct Lake', def: 'Tryb semantic modelu w Fabric, który ładuje dane do pamięci prosto z tabel Delta w OneLake.' },
    { term: 'Expectation', def: 'Reguła jakości w definicji tabeli pipeline\'u. Wiersz, który ją łamie, może zostać policzony, odrzucony albo zatrzymać aktualizację.' },
    { term: 'Governance', def: 'Nadzór nad danymi: kto ma do nich dostęp i co się z nimi dzieje.' },
    { term: 'Idempotentny', def: 'Taki, którego powtórzenie niczego nie zmienia. Druga próba tej samej operacji zostawia tabelę w tym samym stanie.' },
    { term: 'Job cluster', def: 'Klaster klasyczny tworzony na start joba i usuwany po jego zakończeniu.' },
    { term: 'Klaster all-purpose', def: 'Klaster klasyczny do pracy interaktywnej. Ktoś go włącza i wyłącza, a kosztuje także wtedy, gdy stoi bezczynnie.' },
    { term: 'Lakeflow Jobs', def: 'Harmonogram i orkiestrator Databricks. Job składa się z tasków, a zależności między nimi tworzą graf.' },
    { term: 'Lakeflow pipelines', def: 'Deklaratywne przetwarzanie w Databricks, dawniej Delta Live Tables. Deklarujesz tabele, a platforma ustala kolejność, przyrostowość i ponawianie.' },
    { term: 'Lakehouse', def: 'System zarządzania danymi, który łączy zalety data lake (tanie pliki w otwartym formacie) i hurtowni (transakcje, schemat, SQL).' },
    { term: 'Lineage', def: 'Pochodzenie danych: z czego powstała tabela albo kolumna.' },
    { term: 'Liquid clustering', def: 'Układanie podobnych wartości w tych samych plikach według kluczy z klauzuli CLUSTER BY. Wykonuje je OPTIMIZE.' },
    { term: 'Log transakcyjny', def: 'Podkatalog _delta_log z ponumerowanymi commitami. Mówi, które pliki tworzą tabelę w każdej wersji.' },
    { term: 'Materialized view', def: 'Zapisany wynik zapytania, który platforma przelicza w miarę potrzeby, żeby odpowiadał bieżącym danym.' },
    { term: 'MERGE', def: 'Polecenie, które dopasowuje wiersze źródła do tabeli docelowej i w jednym commicie zmienia, wstawia albo usuwa wiersze.' },
    { term: 'Metastore', def: 'Rejestr obiektów i uprawnień Unity Catalog na poziomie konta. Może być podpięty do wielu workspace\'ów w tym samym regionie.' },
    { term: 'Object storage', def: 'Chmurowy magazyn plików, na przykład S3 albo ADLS. Sam z siebie nie ma transakcji ani pojęcia tabeli.' },
    { term: 'OneLake', def: 'Jeden data lake na tenant Fabric, zbudowany na ADLS Gen2. Tabele w formacie Delta Parquet albo Iceberg.' },
    { term: 'Optimistic concurrency control', def: 'Sposób obsługi równoległych zapisów bez blokad. Każdy pisze swoje pliki, a konflikt sprawdza się dopiero przy commicie.' },
    { term: 'OPTIMIZE', def: 'Polecenie, które przepisuje małe pliki w mniejszą liczbę większych i układa dane według kluczy klastrowania. Nie zwalnia miejsca.' },
    { term: 'Partycjonowanie tabeli', def: 'Podział plików tabeli na katalogi według wartości kolumny. To nie to samo co partycja Sparka.' },
    { term: 'Photon', def: 'Wektorowy silnik zapytań wbudowany w Databricks, zgodny z API Sparka.' },
    { term: 'Predictive optimization', def: 'Funkcja Databricks, która sama uruchamia OPTIMIZE, VACUUM i ANALYZE na tabelach managed w Unity Catalog.' },
    { term: 'RESTORE', def: 'Polecenie, które przywraca tabelę do stanu z wybranej wersji i zapisuje to jako nowy commit.' },
    { term: 'Retencja', def: 'Czas przechowywania. Tabela Delta ma osobną retencję usuniętych plików (domyślnie 7 dni) i logu (domyślnie 30 dni).' },
    { term: 'Row-level concurrency', def: 'Funkcja Databricks, która sprawdza konflikty zapisów na poziomie wierszy, a nie plików. Wymaga deletion vectors i tabeli bez partycji.' },
    { term: 'Schema enforcement', def: 'Odrzucanie zapisu, który nie pasuje do schematu tabeli. Zachowanie domyślne.' },
    { term: 'Schema evolution', def: 'Świadoma zgoda na to, żeby zapis zmienił schemat tabeli, na przykład dodał kolumnę.' },
    { term: 'Semantic model', def: 'Model Power BI zbudowany nad tabelami: tabele, relacje i miary, na których stoją raporty.' },
    { term: 'Serverless compute plane', def: 'Maszyny liczące, które działają na koncie Databricks. Klient ich nie tworzy i nie konfiguruje.' },
    { term: 'Service principal', def: 'Tożsamość techniczna, na której działa automat, na przykład wdrożenie z CI albo job produkcyjny. Nie jest kontem osoby.' },
    { term: 'Snapshot isolation', def: 'Odczyt na migawce: zapytanie od początku do końca widzi jedną wersję tabeli.' },
    { term: 'SQL warehouse', def: 'Compute Databricks do zapytań SQL: edytor, dashboardy, BI, dbt. Typy: serverless, pro i classic.' },
    { term: 'Streaming table', def: 'Tabela pipeline\'u, która przetwarza każdy rekord źródła raz, przy założeniu, że źródło tylko rośnie.' },
    { term: 'Tabela external', def: 'Tabela, której lokalizację wskazujesz sam. Unity Catalog pilnuje metadanych i dostępu, a po DROP pliki zostają.' },
    { term: 'Tabela managed', def: 'Tabela, której plikami zarządza Unity Catalog: lokalizacją, optymalizacją i usuwaniem po DROP.' },
    { term: 'Time travel', def: 'Odczyt wcześniejszej wersji tabeli. Działa, dopóki istnieją jej pliki i jej wpis w logu.' },
    { term: 'Unity Catalog', def: 'Warstwa governance Databricks: jeden rejestr obiektów, uprawnienia, lineage i audyt, wspólne dla workspace\'ów podpiętych do tego samego metastore.' },
    { term: 'VACUUM', def: 'Polecenie, które fizycznie usuwa pliki nieużywane przez bieżącą wersję i starsze niż próg retencji. Dopiero ono zwalnia miejsce.' },
    { term: 'Wersja tabeli', def: 'Numer commitu. Stan tabeli w wersji N powstaje przez odtworzenie commitów od 0 do N.' },
    { term: 'Workspace', def: 'Środowisko pracy w Databricks: notebooki, joby, compute. Konto może mieć ich wiele.' },
    { term: 'ZORDER', def: 'Starszy sposób układania danych w plikach, podawany w poleceniu OPTIMIZE. Nie łączy się z liquid clusteringiem.' }
  ],
  misconceptions: [
    { myth: 'Delta to format pliku.', fact: 'Formatem pliku jest Parquet. Delta to protokół nad plikami: log transakcyjny, który mówi, które pliki tworzą tabelę w danej wersji.' },
    { myth: 'UPDATE zmienia wiersz w pliku.', fact: 'Pliki Parquet są niezmienne. UPDATE zapisuje nowe pliki i oznacza stare jako usunięte albo, z deletion vectors, zapisuje znacznik obok pliku.' },
    { myth: 'Delta blokuje tabelę na czas zapisu.', fact: 'Blokad nie ma. Każdy piszący zapisuje swoje pliki, a konflikt wykrywa sprawdzenie przy commicie.' },
    { myth: 'Dwa joby nie mogą pisać do jednej tabeli naraz.', fact: 'Mogą i często kończą się bez konfliktu. Konflikt powstaje, gdy drugi piszący oparł się na plikach, wierszach albo metadanych, które pierwszy właśnie zmienił.' },
    { myth: 'Row-level concurrency działa na każdej tabeli.', fact: 'Wymaga Databricks Runtime 14.3 LTS lub nowszego, deletion vectors i tabeli bez partycjonowania. Zmiana tego samego wiersza nadal jest konfliktem.' },
    { myth: 'MERGE sam poradzi sobie z duplikatami w paczce.', fact: 'Dwa wiersze źródła, które zmieniają ten sam wiersz celu, kończą się błędem. Dwa wiersze z tym samym nowym kluczem dają cichy duplikat. Paczkę trzeba zdeduplikować wcześniej.' },
    { myth: 'Schema evolution obsłuży każdą zmianę schematu.', fact: 'Automatycznie dodaje tylko nowe kolumny. Poszerzenie typu wymaga type widening, a zmiana nazwy i usunięcie kolumny wymagają column mapping.' },
    { myth: 'OPTIMIZE zwalnia miejsce.', fact: 'OPTIMIZE dopisuje nowe, większe pliki, a stare zostawia. Miejsce zwalnia dopiero VACUUM, po okresie retencji.' },
    { myth: 'Time travel to nasz backup.', fact: 'Starsze wersje istnieją tylko do VACUUM i do wygaśnięcia logu. Dokumentacja Databricks odradza traktowanie historii tabeli jako długoterminowej kopii zapasowej.' },
    { myth: 'Log sięga 30 dni wstecz, więc RESTORE sprzed 10 dni zadziała.', fact: 'Potrzebne są też pliki danych. Przy domyślnej retencji 7 dni i codziennym VACUUM pliki tamtej wersji są już skasowane.' },
    { myth: 'Predictive optimization dba o każdą tabelę.', fact: 'Działa tylko na tabelach managed w Unity Catalog, a konto, katalog albo schemat mogą ją wyłączyć. Na tabelach external nadal planujesz własne joby.' },
    { myth: 'Liquid clustering to nowe partycjonowanie.', fact: 'Nie tworzy katalogów. Układa podobne wartości w tych samych plikach, a klucze można zmienić bez przepisywania tabeli.' },
    { myth: 'Po zmianie kluczy klastrowania stare dane same się przeukładają.', fact: 'Stare dane zachowują stary układ, dopóki nie wymusisz przepisania przez OPTIMIZE FULL.' },
    { myth: 'Change Data Feed pokaże zmiany od początku istnienia tabeli.', fact: 'Klasyczny CDF rejestruje zmiany dopiero od włączenia, a pliki zmian podlegają retencji i znikają po VACUUM.' },
    { myth: 'Databricks to hostowany Spark.', fact: 'Spark to silnik, który liczy. Platforma dokłada format tabel z transakcjami, zarządzany compute, Unity Catalog, orkiestrację i sposób wdrażania.' },
    { myth: 'SQL warehouse to zwykły klaster, tylko pod inną nazwą.', fact: 'To compute do zapytań SQL. Notebook podpięty do SQL warehouse wykona tylko komórki SQL i Markdown.' },
    { myth: 'Unity Catalog to nowa nazwa Hive metastore.', fact: 'Hive metastore to rejestr tabel jednego workspace. Unity Catalog jest wspólny dla workspace\'ów podpiętych do tego samego metastore i obejmuje uprawnienia, lineage, audyt oraz obiekty inne niż tabele.' },
    { myth: 'SELECT na tabeli wystarczy, żeby ją przeczytać.', fact: 'Potrzebne są jeszcze USE CATALOG i USE SCHEMA na obiektach nadrzędnych. Same uprawnienia USE nie dają z kolei dostępu do danych.' },
    { myth: 'DROP TABLE zawsze usuwa dane.', fact: 'Po DROP tabeli external pliki zostają w magazynie. Pliki tabeli managed są usuwane po okresie odzyskiwania, domyślnie 7 dni, a do tego czasu działa UNDROP.' },
    { myth: 'Lakehouse i Warehouse w Fabric to dwie kopie danych.', fact: 'Oba przechowują dane w formacie Delta w OneLake. Różnią się silnikiem i sposobem zapisu: Spark kontra T-SQL.' },
    { myth: 'Otwarty format oznacza, że każdy silnik przeczyta każdą tabelę.', fact: 'Silnik musi obsługiwać funkcje i wersję protokołu tabeli, katalog musi ją wystawiać, a czytający musi mieć uprawnienia.' },
    { myth: 'Snowflake jest zamknięty, a Databricks jest tylko dla Sparka.', fact: 'Snowflake dokumentuje tabele Apache Iceberg w magazynie klienta. Databricks ma SQL warehouses do zwykłej pracy w SQL i dbt.' }
  ],
  sourcesNote: 'Fakty pochodzą z protokołu Delta i oficjalnej dokumentacji Databricks, Apache Spark, Microsoft i Snowflake. Są spisane w docs/verified-facts.md, w sekcji „Lekcja 08”, a wpisy o predictive optimization, Z-orderingu, ograniczeniach serverless i strumieniach Snowflake we wcześniejszych sekcjach tego pliku. Strony Databricks były czytane w wersji dla AWS. Dokumentacja Apache Spark dotyczy wersji 4.3.0. Pozostałe strony nie mają numeru wersji, więc obowiązuje data sprawdzenia. Temat nie ma labu: żadna liczba w rozdziale nie jest pomiarem.',
  sources: [
    { label: 'Delta Lake: PROTOCOL.md', url: 'https://github.com/delta-io/delta/blob/master/PROTOCOL.md' },
    { label: 'Delta Lake: Table properties', url: 'https://docs.delta.io/latest/table-properties.html' },
    { label: 'Delta Lake: Concurrency control', url: 'https://docs.delta.io/latest/concurrency-control.html' },
    { label: 'Apache Spark: Integration with Cloud Infrastructures', url: 'https://spark.apache.org/docs/latest/cloud-integration.html' },
    { label: 'Databricks: What is Delta Lake?', url: 'https://docs.databricks.com/aws/en/delta/' },
    { label: 'Databricks: Table history', url: 'https://docs.databricks.com/aws/en/delta/history' },
    { label: 'Databricks: Isolation levels and write conflicts', url: 'https://docs.databricks.com/aws/en/optimizations/isolation' },
    { label: 'Databricks: Isolation levels', url: 'https://docs.databricks.com/aws/en/optimizations/isolation/isolation-levels' },
    { label: 'Databricks: Row-level concurrency', url: 'https://docs.databricks.com/aws/en/optimizations/isolation/row-level-concurrency' },
    { label: 'Databricks: Upsert using merge', url: 'https://docs.databricks.com/aws/en/delta/merge' },
    { label: 'Databricks: MERGE INTO', url: 'https://docs.databricks.com/aws/en/sql/language-manual/delta-merge-into' },
    { label: 'Databricks: Deletion vectors', url: 'https://docs.databricks.com/aws/en/tables/features/deletion-vectors' },
    { label: 'Databricks: Schema enforcement', url: 'https://docs.databricks.com/aws/en/tables/schema-enforcement' },
    { label: 'Databricks: Update table schema', url: 'https://docs.databricks.com/aws/en/tables/update-schema' },
    { label: 'Databricks: Type widening', url: 'https://docs.databricks.com/aws/en/tables/features/type-widening' },
    { label: 'Databricks: VACUUM', url: 'https://docs.databricks.com/aws/en/delta/vacuum' },
    { label: 'Databricks: OPTIMIZE', url: 'https://docs.databricks.com/aws/en/tables/operations/optimize' },
    { label: 'Databricks: Tune file size', url: 'https://docs.databricks.com/aws/en/delta/tune-file-size' },
    { label: 'Databricks: Predictive optimization', url: 'https://docs.databricks.com/aws/en/optimizations/predictive-optimization' },
    { label: 'Databricks: Liquid clustering', url: 'https://docs.databricks.com/aws/en/tables/clustering' },
    { label: 'Databricks: Data skipping', url: 'https://docs.databricks.com/aws/en/tables/data-skipping' },
    { label: 'Databricks: Data skipping (Z-ordering)', url: 'https://docs.databricks.com/aws/en/delta/data-skipping' },
    { label: 'Databricks: Change data feed', url: 'https://docs.databricks.com/aws/en/tables/features/change-data-feed' },
    { label: 'Databricks: Lakehouse', url: 'https://docs.databricks.com/aws/en/lakehouse/' },
    { label: 'Databricks: High-level architecture', url: 'https://docs.databricks.com/aws/en/getting-started/high-level-architecture' },
    { label: 'Databricks: Compute', url: 'https://docs.databricks.com/aws/en/compute/' },
    { label: 'Databricks: SQL warehouse types', url: 'https://docs.databricks.com/aws/en/compute/sql-warehouse/warehouse-types' },
    { label: 'Databricks: Notebook compute', url: 'https://docs.databricks.com/aws/en/notebooks/notebook-compute' },
    { label: 'Databricks: Serverless limitations', url: 'https://docs.databricks.com/aws/en/compute/serverless/limitations' },
    { label: 'Databricks: Unity Catalog', url: 'https://docs.databricks.com/aws/en/data-governance/unity-catalog/' },
    { label: 'Databricks: Privileges reference', url: 'https://docs.databricks.com/aws/en/data-governance/unity-catalog/manage-privileges/privileges' },
    { label: 'Databricks: Managed tables', url: 'https://docs.databricks.com/aws/en/tables/managed' },
    { label: 'Databricks: External tables', url: 'https://docs.databricks.com/aws/en/tables/external' },
    { label: 'Databricks: System tables', url: 'https://docs.databricks.com/aws/en/admin/system-tables/' },
    { label: 'Databricks: Data engineering (Lakeflow)', url: 'https://docs.databricks.com/aws/en/data-engineering/' },
    { label: 'Databricks: Lakeflow Jobs', url: 'https://docs.databricks.com/aws/en/jobs/' },
    { label: 'Databricks: Job triggers', url: 'https://docs.databricks.com/aws/en/jobs/triggers' },
    { label: 'Databricks: Where is DLT?', url: 'https://docs.databricks.com/aws/en/ldp/where-is-dlt' },
    { label: 'Databricks: Pipelines', url: 'https://docs.databricks.com/aws/en/ldp/' },
    { label: 'Databricks: Pipeline concepts', url: 'https://docs.databricks.com/aws/en/ldp/concepts' },
    { label: 'Databricks: Expectations', url: 'https://docs.databricks.com/aws/en/ldp/expectations' },
    { label: 'Databricks: Pipeline SQL', url: 'https://docs.databricks.com/aws/en/ldp/developer/sql-dev' },
    { label: 'Databricks: AUTO CDC', url: 'https://docs.databricks.com/aws/en/ldp/cdc' },
    { label: 'Databricks: Git folders', url: 'https://docs.databricks.com/aws/en/repos/' },
    { label: 'Databricks: Notebooks', url: 'https://docs.databricks.com/aws/en/notebooks/' },
    { label: 'Databricks: Databricks Connect', url: 'https://docs.databricks.com/aws/en/dev-tools/databricks-connect/' },
    { label: 'Databricks: Bundle settings', url: 'https://docs.databricks.com/aws/en/dev-tools/bundles/settings' },
    { label: 'Databricks: bundle commands', url: 'https://docs.databricks.com/aws/en/dev-tools/cli/bundle-commands' },
    { label: 'Databricks: Bundle deployment modes', url: 'https://docs.databricks.com/aws/en/dev-tools/bundles/deployment-modes' },
    { label: 'Databricks: CI/CD', url: 'https://docs.databricks.com/aws/en/dev-tools/ci-cd/' },
    { label: 'Databricks: Data quality monitoring', url: 'https://docs.databricks.com/aws/en/data-quality-monitoring/' },
    { label: 'Databricks: Transactions', url: 'https://docs.databricks.com/aws/en/transactions/' },
    { label: 'Databricks: Iceberg reads (UniForm)', url: 'https://docs.databricks.com/aws/en/delta/iceberg-reads' },
    { label: 'Microsoft: Azure Data Lake Storage', url: 'https://learn.microsoft.com/en-us/azure/storage/blobs/data-lake-storage-introduction' },
    { label: 'Microsoft: Azure Data Factory', url: 'https://learn.microsoft.com/en-us/azure/data-factory/introduction' },
    { label: 'Microsoft: Databricks Job activity', url: 'https://learn.microsoft.com/en-us/azure/data-factory/transform-data-databricks-job' },
    { label: 'Microsoft: Data Factory in Fabric', url: 'https://learn.microsoft.com/en-us/fabric/data-factory/data-factory-overview' },
    { label: 'Microsoft: Azure Databricks architecture', url: 'https://learn.microsoft.com/en-us/azure/databricks/getting-started/high-level-architecture' },
    { label: 'Microsoft: Fabric overview', url: 'https://learn.microsoft.com/en-us/fabric/fundamentals/microsoft-fabric-overview' },
    { label: 'Microsoft: OneLake', url: 'https://learn.microsoft.com/en-us/fabric/onelake/onelake-overview' },
    { label: 'Microsoft: Lakehouse or Warehouse', url: 'https://learn.microsoft.com/en-us/fabric/fundamentals/decision-guide-lakehouse-warehouse' },
    { label: 'Microsoft: Power BI semantic models', url: 'https://learn.microsoft.com/en-us/power-bi/connect-data/service-datasets-understand' },
    { label: 'Microsoft: Direct Lake', url: 'https://learn.microsoft.com/en-us/fabric/fundamentals/direct-lake-overview' },
    { label: 'Microsoft: Mirrored Azure Databricks catalog', url: 'https://learn.microsoft.com/en-us/fabric/mirroring/azure-databricks' },
    { label: 'Snowflake: Time Travel', url: 'https://docs.snowflake.com/en/user-guide/data-time-travel' },
    { label: 'Snowflake: Fail-safe', url: 'https://docs.snowflake.com/en/user-guide/data-failsafe' },
    { label: 'Snowflake: Transactions', url: 'https://docs.snowflake.com/en/sql-reference/transactions' },
    { label: 'Snowflake: Streams', url: 'https://docs.snowflake.com/en/user-guide/streams-intro' },
    { label: 'Snowflake: Apache Iceberg tables', url: 'https://docs.snowflake.com/en/user-guide/tables-iceberg' },
    { label: 'Snowflake: Snowflake ML', url: 'https://docs.snowflake.com/en/developer-guide/snowflake-ml/overview' },
    { label: 'Snowflake: Snowpark', url: 'https://docs.snowflake.com/en/developer-guide/snowpark/index' }
  ]
};

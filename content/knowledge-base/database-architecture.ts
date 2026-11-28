import * as lesson from '../architecture/database-architecture/lesson';
import { deeper, figure, h3, known, list, p, plan, sql, steps, table, tables, warn, yaml } from './blocks';
import type { KbChapter } from './types';

/**
 * Knowledge Base, rozdział wzorcowy: Database & Data Architecture.
 *
 * Zakres jest ten sam co w lekcji 06, ale to osobny tekst: podręcznik do czytania i powtórek, bez interakcji.
 * Przykładowe dane (zamówienia, kroki normalizacji, mikropartycje, warstwy architektur, tabele porównawcze)
 * są importowane z lekcji, żeby oba materiały pokazywały te same liczby. Proza jest napisana od nowa.
 *
 * Skąd są fakty: docs/verified-facts.md, sekcja „Lekcja 06". Rozdział nie wprowadza nowych faktów.
 * „Klasyczna baza relacyjna" oznacza zachowanie opisane w dokumentacji PostgreSQL 19.
 * Wszystkie liczby w ilustracjach są dobrane do przykładu. Rozdział nie podaje pomiarów.
 *
 * Kod SQL i YAML ma linie do 48 znaków, żeby w PDF na telefon nie trzeba było go zawijać (pilnuje tego test).
 */

const nf = (id: string) => lesson.normalization.steps.find(s => s.id === id)!.tables;
const arch = lesson.architectures.items;
const [coupled, separated] = lesson.separation.variants;
const [normalized, wide] = lesson.denormalization.variants;
const thousands = (n: number) => String(n).replace(/\B(?=(\d{3})+$)/g, ' ');
const level = (id: string) => lesson.acid.levels.find(l => l.id === id)!;
const allowed = (yes: boolean) => (yes ? 'możliwy' : 'wykluczony');

export const databaseArchitecture: KbChapter = {
  id: 'database-architecture',
  area: 'architecture',
  title: 'Database & Data Architecture',
  subtitle: 'Od jednego zapytania do całej platformy: jak baza układa dane, czego pilnuje, jak unika czytania wszystkiego i jak z tych klocków wybiera się architekturę.',
  lessonId: lesson.meta.id,
  checked: '2026-11-27',
  lead: [
    `Ten rozdział porządkuje podstawy, na których stoi każda platforma danych. Zaczyna od pytania, jaką pracę wykonuje baza. Potem przechodzi przez model danych i mechanizmy silnika. Kończy na wyborze architektury.`,
    `Prawie wszystkie przykłady dotyczą jednego wymyślonego sklepu internetowego i jego zamówień. Tam, gdzie zachowanie zależy od produktu, tekst mówi, o którym mowa. „Klasyczna baza relacyjna” oznacza tu zachowanie opisane w dokumentacji PostgreSQL. Przy Snowflake zawsze jest napisane, czy chodzi o tabele standardowe, czy hybrydowe.`,
    `Liczby w ilustracjach (strony, wiersze, mikropartycje) są dobrane tak, żeby mechanizm było widać. To nie są pomiary.`
  ],
  sections: [
    {
      id: 'oltp-olap',
      title: 'Dwa rodzaje pracy bazy: OLTP i OLAP',
      blocks: [
        p(`Sklep internetowy trzyma zamówienia w bazie. Z tej samej tabeli korzystają dwie strony i każda zadaje jej zupełnie inne pytanie.`),
        p(`Aplikacja sklepu tysiące razy na minutę szuka jednego zamówienia, żeby pokazać je klientowi albo zmienić jego status:`),
        sql(`SELECT *\nFROM orders\nWHERE order_id = 48213;`),
        p(`Analityk kilka razy dziennie liczy przychód z całego roku:`),
        sql(`SELECT country, SUM(amount)\nFROM orders\nGROUP BY country;`),
        p(`Dane są te same, ale praca dla bazy jest zupełnie inna.`),
        table(lesson.workloads.columns, lesson.workloads.rows.slice(1)),
        p(`To dwa rodzaje pracy bazy i każdy ma swoją nazwę. Bardzo dużo małych operacji, z których każda czyta albo zmienia kilka wierszy, to <b>OLTP</b> (Online Transaction Processing). Mało ciężkich zapytań, które czytają miliony wierszy i liczą sumy z kilku kolumn, to <b>OLAP</b> (Online Analytical Processing).`),
        p(`Te nazwy opisują rodzaj pracy, a nie produkt. Zamiast mówić „OLTP to PostgreSQL”, lepiej powiedzieć, czego dana praca wymaga. OLTP potrzebuje odpowiedzi w milisekundach i poprawnych danych, gdy wielu klientów zapisuje naraz. OLAP potrzebuje szybkiego przeczytania dużej ilości danych.`),
        h3('Dlaczego nie robi się analityki na bazie aplikacji'),
        p(`Skoro dane są te same, można by uruchamiać raporty wprost na bazie sklepu. Zwykle się tego nie robi, z dwóch powodów.`),
        list(
          `<b>Raport zabiera zasoby.</b> Czyta całą tabelę i zajmuje procesor oraz dysk. W tym samym czasie klienci mogą dłużej czekać na złożenie zamówienia.`,
          `<b>Baza aplikacji jest ułożona pod coś innego.</b> Jej zadanie to szybki i bezpieczny zapis pojedynczych wierszy. Analityk potrzebuje historii, danych z kilku systemów naraz i tabel wygodnych do czytania.`
        ),
        p(`Dlatego dane kopiuje się z bazy aplikacji do osobnego systemu analitycznego. Dalsze części opisują, jak zbudowany jest każdy z tych systemów i skąd biorą się różnice między nimi.`)
      ]
    },
    {
      id: 'wiersze-kolumny',
      title: 'Zapis wierszowy i kolumnowy',
      blocks: [
        p(`Pierwsza różnica leży bardzo nisko: w tym, jak dane są ułożone na dysku.`),
        p(`Dysk nie podaje pojedynczych wartości. Podaje całe porcje danych, czyli <b>bloki</b>. Baza, która potrzebuje jednej liczby z bloku, i tak czyta cały blok. Liczy się więc to, co leży razem w jednym bloku: cały wiersz czy cała kolumna.`),
        p(`Weźmy sześć zamówień i pięć kolumn, czyli 30 wartości. Analityk pyta o przychód na kraj. Do wyniku potrzebne są dwie kolumny: <code>country</code> i <code>amount</code>.`),
        figure(`Ilustracja. Zapytanie o przychód na kraj w dwóch układach tej samej tabeli. Uproszczenie: blok to jeden wiersz albo jedna kolumna i baza czyta go w całości.`, {
          kind: 'cells',
          columns: lesson.storage.columns,
          rows: lesson.storage.rows,
          need: lesson.storage.queries.find(q => q.id === 'agg')!.cols,
          panels: [
            { layout: 'row', label: 'Zapis wierszowy', note: 'blok = jeden wiersz' },
            { layout: 'column', label: 'Zapis kolumnowy', note: 'blok = jedna kolumna' }
          ],
          legend: { read: 'przeczytane, ale niepotrzebne', need: 'przeczytane i potrzebne', skipped: 'pominięte', count: 'przeczytane wartości' }
        }),
        p(`W <b>zapisie wierszowym</b> (row-oriented) blok trzyma cały wiersz. Dwie potrzebne kolumny leżą w każdym bloku razem z trzema pozostałymi. Baza czyta wszystkie 30 wartości, żeby użyć 12.`),
        p(`W <b>zapisie kolumnowym</b> (column-oriented) blok trzyma wartości jednej kolumny. Baza czyta dwa bloki, <code>country</code> i <code>amount</code>. Trzech pozostałych kolumn nie dotyka.`),
        p(`Teraz odwróćmy pytanie. Aplikacja chce jedno zamówienie ze wszystkimi kolumnami. W zapisie wierszowym cały wiersz leży w jednym bloku, więc baza czyta dokładnie to, czego potrzebuje. Do właściwego wiersza trafia dzięki indeksowi, o którym będzie dalej. W zapisie kolumnowym ten sam wiersz jest rozłożony na pięć bloków, po jednym na kolumnę. Żeby go złożyć, baza sięga do każdego z nich.`),
        p(`Stąd podział: zapis wierszowy pasuje do OLTP, a kolumnowy do OLAP. PostgreSQL zapisuje wierszami. Tabele standardowe Snowflake są kolumnowe.`),
        h3('Kompresja i cena zapisu kolumnowego'),
        p(`Zapis kolumnowy ma drugą zaletę. W jednej kolumnie wartości mają ten sam typ i często się powtarzają, na przykład kraj albo status. Takie dane kompresują się lepiej niż wiersze, w których obok siebie leżą liczby, daty i teksty.`),
        p(`Jest też cena. Żeby dopisać albo zmienić jeden wiersz, trzeba dotknąć każdej kolumny. Dlatego silniki kolumnowe wolą ładowanie dużych paczek niż pojedyncze inserty. Zapis kolumnowy nie jest więc „po prostu szybszy”. Jest szybszy dla skanów kilku kolumn, a wolniejszy dla zapisu i odczytu pojedynczych wierszy.`),
        known(
          'W Snowflake',
          `W tabeli standardowej wybierasz trzy kolumny z trzydziestu i skan czyta dane tylko tych trzech. To ta sama zasada co na ilustracji. Dlatego <code>SELECT *</code> w hurtowni kolumnowej oddaje jej główną zaletę: silnik musi przeczytać wszystkie kolumny.`,
          `Uwaga na skrót „Snowflake jest kolumnowy”. Dotyczy tabel standardowych, a nie całego produktu. Snowflake ma też tabele hybrydowe z zapisem wierszowym i indeksami, przeznaczone do pracy typu OLTP.`
        )
      ]
    },
    {
      id: 'projekt-logiczny-fizyczny',
      title: 'Projekt logiczny i fizyczny',
      blocks: [
        p(`Zanim powstanie pierwsza tabela, te same zamówienia opisuje się dwa razy. Najpierw ustalasz, <b>co w ogóle zapisujemy</b>: jakie rzeczy, jakie informacje o nich i jak się ze sobą łączą. Potem decydujesz, <b>jak to zapisać w konkretnej bazie</b>, żeby działało szybko.`),
        table(
          ['Projekt logiczny: co zapisujemy', 'Projekt fizyczny: jak to zapisać'],
          [
            ['Encje, czyli rzeczy, o których zapisujemy dane: klient, zamówienie, produkt', 'Typy danych: <code>NUMBER(10,2)</code>, <code>VARCHAR</code>'],
            ['Atrybuty, czyli informacje o nich: nazwa, miasto, kwota', 'Indeksy albo klucz klastrowania'],
            ['Klucze: po czym rozpoznać jeden wiersz', 'Partycjonowanie'],
            ['Relacje: klient ma wiele zamówień', 'Tabela, widok czy model przyrostowy, czyli przeliczany tylko dla nowych danych'],
            ['Normalizacja: ile powtórzeń dopuszczamy', 'Celowe powtórzenie danych, żeby szybciej czytać (denormalizacja)']
          ]
        ),
        p(`<b>Projekt logiczny</b> mówi, co dane znaczą. Nie zależy od silnika, więc po przejściu na inną bazę zostaje taki sam. <b>Projekt fizyczny</b> to decyzje o szybkości na wybranej platformie, więc zmienia się razem z nią. Jeden projekt logiczny może mieć kilka fizycznych.`),
        p(`Część zespołów ma jeszcze trzeci poziom, <b>koncepcyjny</b>: same pojęcia biznesowe i połączenia między nimi, bez atrybutów i kluczy. Służy do rozmowy z biznesem.`),
        p(`Kilka słów z prawej kolumny (indeks, klucz klastrowania, partycjonowanie) pojawia się tu po raz pierwszy. Każde ma dalej własną część. Rozdział idzie w tej samej kolejności co projektowanie: najpierw model, potem silnik.`),
        known(
          'W dbt',
          `W modelu dbt piszesz <code>SELECT</code>, który mówi, jakie kolumny ma tabela i z czego powstaje. Osobno, w konfiguracji, ustawiasz <code>materialized</code> i <code>cluster_by</code>. SQL modelu jest bliżej projektu logicznego, a konfiguracja to projekt fizyczny. Zmiana tabeli na model przyrostowy nie zmienia znaczenia danych.`,
          `Podział nie jest czysty. Model dbt jest już napisany w dialekcie konkretnej hurtowni. A decyzja o szerokiej tabeli zmienia same kolumny, nie tylko sposób zapisu.`
        )
      ]
    },
    {
      id: 'normalizacja',
      title: 'Normalizacja: 1NF, 2NF, 3NF',
      blocks: [
        p(`Projekt logiczny zaczyna się od pytania: co się psuje, gdy ta sama informacja jest zapisana w kilku miejscach?`),
        p(`Oto trzy zamówienia zapisane tak, jak przyszły z formularza. Anna zamówiła dwa razy, więc jej dane się powtarzają. W kolumnie <code>items</code> siedzi cała lista produktów.`),
        tables(`Punkt wyjścia: jedna szeroka tabela. Podkreślona kolumna to klucz główny, czyli to, po czym rozpoznajesz jeden wiersz. Dane wymyślone.`, ...nf('raw')),
        p(`Sam układ tej tabeli pozwala na trzy rodzaje błędów. Nazywają się <b>anomaliami</b>.`),
        list(
          `<b>Anomalia aktualizacji</b> (update anomaly). Anna się przeprowadza. Poprawiasz miasto w zamówieniu 101, ale nie w 102. Baza ma teraz dwie wersje prawdy.`,
          `<b>Anomalia wstawiania</b> (insert anomaly). Nie zapiszesz klienta, który jeszcze nic nie zamówił, bo każdy wiersz to zamówienie.`,
          `<b>Anomalia usuwania</b> (delete anomaly). Usuwasz zamówienie 103 i razem z nim znika jedyna informacja o tym, że Piotr mieszka w Krakowie.`
        ),
        p(`<b>Normalizacja</b> to dzielenie tabel tak, żeby każda informacja była zapisana raz. Wtedy nie da się jej poprawić tylko w połowie miejsc. Robi się to krokami. Każdy krok nazywa się postacią normalną (normal form) i usuwa jeden rodzaj powtórzenia.`),
        p(`Dwa założenia do przykładu: produkt występuje w zamówieniu najwyżej raz (liczba sztuk jest w kolumnie <code>qty</code>), a <code>city</code> to bieżące miasto klienta, nie adres dostawy konkretnego zamówienia.`),
        h3('Pierwsza postać normalna (1NF)'),
        p(`Problem: w jednej komórce jest lista produktów. Zwykłym <code>SUM</code> nie policzysz, ile sprzedano kabli. Nie połączysz też pozycji z tabelą produktów.`),
        p(`Reguła 1NF: w każdej komórce jedna wartość, bez list, a każdy wiersz da się rozpoznać po kluczu. Rozbijamy więc listę na wiersze. Jeden wiersz to teraz jeden produkt w jednym zamówieniu. Kluczem jest para (<code>order_id</code>, <code>product_id</code>).`),
        tables(`Po 1NF: lista rozbita na wiersze, klucz złożony z dwóch kolumn.`, ...nf('1nf')),
        h3('Druga postać normalna (2NF)'),
        p(`Spójrz, od czego zależy każda kolumna. Liczba sztuk zależy od obu części klucza: od zamówienia i od produktu. Ale nazwa produktu zależy tylko od <code>product_id</code>, a klient tylko od <code>order_id</code>. Dlatego „mysz” i „Anna, Gdańsk” są wpisane po kilka razy, a zmiana nazwy produktu to poprawianie wielu wierszy. Taka zależność od kawałka klucza nazywa się <b>zależnością częściową</b>.`),
        p(`Reguła 2NF: kolumna, która zależy tylko od części klucza, idzie do osobnej tabeli. Nazwa produktu trafia do <code>products</code>, klient do <code>orders</code>. W pozycjach zostaje liczba sztuk, bo zależy od obu części klucza.`),
        tables(`Po 2NF: produkt i zamówienie mają własne tabele.`, ...nf('2nf')),
        h3('Trzecia postać normalna (3NF)'),
        p(`Został jeszcze jeden kłopot. Miasto nie opisuje zamówienia. Opisuje klienta, a klient jest przypisany do zamówienia. Dlatego „Anna, Gdańsk” nadal jest w dwóch wierszach tabeli <code>orders</code>. Zależność przez inną kolumnę, która nie jest kluczem, nazywa się <b>zależnością przechodnią</b>.`),
        p(`Reguła 3NF: kolumna niekluczowa nie może zależeć od klucza przez inną kolumnę niekluczową. Imię i miasto opisują klienta, więc idą do tabeli <code>customers</code>.`),
        tables(`Po 3NF: każda informacja jest zapisana raz.`, ...nf('3nf')),
        p(`Przeprowadzka Anny to teraz zmiana jednego wiersza. Klienta można zapisać, zanim cokolwiek zamówi. Usunięcie zamówienia nie kasuje danych klienta.`),
        p(`Jak nie pomylić 2NF z 3NF: druga postać dotyczy zależności od <b>części klucza złożonego</b>. Trzecia dotyczy zależności między <b>kolumnami, które nie są kluczem</b>.`),
        p(`Nowy koszt widać od razu. Pytanie „ile kabli kupiono w Gdańsku” wymaga połączenia czterech tabel. Normalizacja chroni zapis, a ceną są joiny przy odczycie. Według dokumentacji Microsoft trzecia postać normalna jest uznawana za wystarczającą w większości zastosowań.`)
      ]
    },
    {
      id: 'denormalizacja',
      title: 'Denormalizacja i ziarno tabeli',
      blocks: [
        p(`Model w 3NF jest wygodny do zapisu. Analityk chce jednak pytać o wszystko naraz: produkty, klientów i miasta. Dlatego w hurtowni normalizację często świadomie się cofa.`),
        p(`Porównajmy dwa układy tych samych danych. Pytanie brzmi: ile sztuk sprzedano w każdym mieście? W modelu znormalizowanym wygląda to tak:`),
        sql(`SELECT c.city, SUM(l.qty)\nFROM order_lines l\nJOIN orders o\n  ON o.order_id = l.order_id\nJOIN customers c\n  ON c.customer_id = o.customer_id\nGROUP BY c.city;`, 'Model znormalizowany (3NF)'),
        p(`A tak w jednej szerokiej tabeli, w której miasto klienta jest skopiowane do każdej pozycji zamówienia:`),
        sql(`SELECT city, SUM(qty)\nFROM order_lines_wide\nGROUP BY city;`, 'Jedna szeroka tabela'),
        table(
          ['', 'Znormalizowany (3NF)', 'Szeroka tabela'],
          [
            ['Joiny w zapytaniu', String(normalized.joins), String(wide.joins)],
            ['Wiersze z zapisanym miastem', String(normalized.cityCopies), String(wide.cityCopies)],
            ['Wiersze do zmiany, gdy Anna przeprowadza się do Sopotu', String(normalized.rowsToUpdate), String(wide.rowsToUpdate)]
          ],
          'Liczby wynikają z czterech pozycji zamówień z poprzedniej części.'
        ),
        p(`<b>Denormalizacja</b> to celowe powtórzenie danych, żeby łatwiej i taniej je czytać. Zyskujesz mniej joinów i prostszy SQL, z którym poradzi sobie każde narzędzie BI. Płacisz powtórzeniami i droższą zmianą.`),
        p(`W hurtowni ryzyko jest mniejsze niż w bazie aplikacji, bo szerokiej tabeli nikt nie poprawia ręcznie. Buduje się ją od nowa ze źródła. Znormalizowane dane zostają źródłem prawdy, a szerokie tabele do czytania powstają z nich przy każdym uruchomieniu potoku.`),
        h3('Trzy miejsca, w których denormalizacja się mści'),
        list(
          `<b>Ziarno</b> (grain) to odpowiedź na pytanie, co oznacza jeden wiersz tabeli. W szerokiej tabeli z przykładu jeden wiersz to jedna pozycja zamówienia. Jeśli dokleisz do niej kwotę całego zamówienia, <code>SUM</code> policzy tę kwotę tyle razy, ile zamówienie ma pozycji. Dlatego każda tabela powinna mieć nazwane ziarno.`,
          `<b>Historia.</b> Po zbudowaniu tabeli od nowa wszystkie stare zamówienia Anny pokażą Sopot. Jeśli raport ma pokazywać miasto z dnia zamówienia, trzeba przechowywać historię zmian. To osobny temat: modelowanie wymiarowe.`,
          `<b>Koszt przebudowy.</b> Zmiana jednej informacji może oznaczać przepisanie dużej części tabeli. Przy dużych tabelach od tego zależy wybór między pełną przebudową a modelem przyrostowym.`
        ),
        known(
          'W dbt',
          `Modele staging są blisko źródła i zwykle zachowują jego podział na tabele. Marty łączą je w tabele wygodne do czytania. Często jest to schemat gwiazdy (star schema): w środku tabela faktów, czyli zdarzenia z liczbami, na przykład pozycje zamówień, a wokół niej tabele wymiarów, czyli opisy: klient, produkt, data. To ten sam kompromis co wyżej.`,
          `Dwa zastrzeżenia. Schemat gwiazdy nie jest pełną denormalizacją: tabela faktów trzyma klucze i liczby, a spłaszczone są tylko wymiary. I nie każdy staging jest w 3NF, bo źródła bywają już zdenormalizowane.`
        )
      ]
    },
    {
      id: 'klucze',
      title: 'Klucze i integralność referencyjna',
      blocks: [
        p(`Po normalizacji dane leżą w kilku tabelach, które wskazują na siebie nawzajem. Pojawiają się dwa pytania kontrolne.`),
        list(
          `Czy ten wiersz ma własny identyfikator, którego nie ma żaden inny? Tego pilnuje <b>klucz główny</b> (primary key): wartość jest unikalna i nie może być pusta.`,
          `Czy klient wskazany w zamówieniu istnieje? Tego pilnuje <b>klucz obcy</b> (foreign key): wartość musi występować jako klucz w innej tabeli.`
        ),
        p(`Zasada „nie ma zamówienia bez klienta” to <b>integralność referencyjna</b> (referential integrity). Zamówienie, które wskazuje na nieistniejącego klienta, nazywa się wierszem osieroconym (orphan). Szkodzi po cichu: inner join z tabelą klientów go zgubi, a left join zwróci puste dane klienta.`),
        p(`Kto tego pilnuje? To zależy od silnika. Załóżmy, że tabela <code>orders</code> ma zadeklarowane trzy reguły: <code>PRIMARY KEY</code> na <code>order_id</code>, <code>FOREIGN KEY</code> z <code>customer_id</code> do tabeli <code>customers</code> oraz <code>NOT NULL</code> na <code>amount</code>. Próbujemy zapisać trzy błędne wiersze.`),
        sql(
          `-- 1. Drugi raz ten sam klucz: 101 już jest\nINSERT INTO orders\n  (order_id, customer_id, amount)\nVALUES (101, 'C7', 50);\n\n-- 2. Zamówienie bez klienta: C99 nie ma\nINSERT INTO orders\n  (order_id, customer_id, amount)\nVALUES (104, 'C99', 50);\n\n-- 3. Brak kwoty: amount jest NOT NULL\nINSERT INTO orders\n  (order_id, customer_id, amount)\nVALUES (105, 'C7', NULL);`
        ),
        table(
          ['Próba zapisu', 'PostgreSQL', 'Snowflake, tabela standardowa', 'Snowflake, tabela hybrydowa'],
          [
            ['1. Powtórzony klucz główny', 'Odrzucone', '<b>Przyjęte.</b> Są dwa wiersze z <code>order_id = 101</code>', 'Odrzucone'],
            ['2. Klient, którego nie ma', 'Odrzucone', '<b>Przyjęte.</b> Powstaje wiersz osierocony', 'Odrzucone'],
            ['3. Pusta kwota', 'Odrzucone', 'Odrzucone', 'Odrzucone']
          ],
          'Zachowanie według dokumentacji PostgreSQL 19 i Snowflake.'
        ),
        p(`W klasycznej bazie relacyjnej klucze to reguły sprawdzane przy zapisie. Błędny wiersz nie wchodzi. PostgreSQL sprawdza klucz główny przy każdym zapisie, a żeby robić to szybko, sam tworzy dla niego unikalny indeks.`),
        p(`W tabelach standardowych Snowflake <code>PRIMARY KEY</code>, <code>UNIQUE</code> i <code>FOREIGN KEY</code> są tylko opisem. Można je zadeklarować, ale Snowflake ich nie sprawdza. Mówi się, że nie są wymuszane (not enforced). Sprawdzane są <code>NOT NULL</code> i <code>CHECK</code>. W tabelach hybrydowych jest inaczej: klucz główny jest obowiązkowy i sprawdzany, tak samo jak klucze unikalne i obce.`),
        p(`Skąd ta różnica? Kontrola kosztuje przy każdym wstawieniu. Przy pojedynczych wierszach to drobiazg, przy ładowaniu milionów już nie. Hurtownie ładują dane dużymi paczkami, często równolegle i nie zawsze w kolejności „najpierw klienci, potem zamówienia”.`),
        p(`Wniosek praktyczny: w hurtowni o unikalność i powiązania musi zadbać potok danych.`),
        h3('Jak pilnuje się kluczy w dbt'),
        p(`dbt ma cztery wbudowane testy: <code>unique</code>, <code>not_null</code>, <code>accepted_values</code> i <code>relationships</code>. Pierwszym i ostatnim sprawdzisz to, czego Snowflake nie sprawdza sam: unikalność klucza i istnienie wskazanego wiersza. Każdy test to zapytanie, które po zbudowaniu modelu szuka wierszy łamiących regułę.`),
        yaml(`- name: order_id\n  data_tests: [unique, not_null]\n- name: customer_id\n  data_tests:\n    - relationships:\n        to: ref('customers')\n        field: customer_id`, 'models/schema.yml (kolumny modelu orders)'),
        p(`Dwa testy na <code>order_id</code> razem sprawdzają to samo, co klucz główny w klasycznej bazie. Test <code>relationships</code> sprawdza, czy każdy <code>customer_id</code> z zamówień istnieje w modelu <code>customers</code>. Dokumentacja dbt nazywa to wprost integralnością referencyjną. Przykład jest poglądowy: dokładna składnia argumentów zależy od wersji dbt.`),
        warn(
          'Reguła zapobiega, test tylko wykrywa',
          `Reguła w bazie zapobiega: błędny wiersz nie zostaje zapisany. Test dbt wykrywa po fakcie: gdy zgłasza błąd, model jest już zbudowany. Bez dodatkowych kroków błędne dane mogą trafić do odbiorców.`,
          `Dlatego oprócz testów usuwa się duplikaty już w samym modelu, na przykład przez <code>QUALIFY ROW_NUMBER()</code> po kluczu.`
        ),
        h3('Wyjątki, o które pytają dociekliwi'),
        list(
          `<b>NULL w kluczu obcym.</b> W PostgreSQL pusta wartość w kolumnie klucza obcego domyślnie przechodzi: wiersz z <code>customer_id = NULL</code> nie musi mieć pasującego klienta. Jeśli zamówienie zawsze ma mieć klienta, dodaj <code>NOT NULL</code>. Podobnie <code>UNIQUE</code> domyślnie dopuszcza wiele wierszy z NULL. Klucz główny NULL-a nie dopuszcza.`,
          `<b>Odroczone sprawdzanie.</b> PostgreSQL pozwala oznaczyć klucz główny, unikalny albo obcy jako <code>DEFERRABLE</code>. Taką regułę można sprawdzić dopiero na końcu transakcji, a nie po każdej instrukcji. Przydaje się, gdy dwa wiersze wskazują na siebie nawzajem. <code>NOT NULL</code> i <code>CHECK</code> odroczyć się nie da.`,
          `<b>Po co deklarować klucze w Snowflake.</b> Według dokumentacji niesprawdzane klucze nadal służą jako opis modelu. Narzędzia BI i narzędzia do modelowania odczytują z nich klucze i relacje.`,
          `<b>RELY.</b> Ta właściwość mówi optymalizatorowi: „możesz założyć, że dane spełniają tę regułę”. Dzięki temu może on na przykład usunąć z planu zbędny join. To zaufanie, a nie sprawdzenie: Snowflake nadal niczego nie weryfikuje. Dokumentacja ostrzega, że jeśli dane łamią regułę oznaczoną <code>RELY</code>, wyniki mogą być niepoprawne. Dlatego <code>RELY</code> ustawia się razem z testem, który tej reguły pilnuje.`,
          `<b>Kontrakty dbt.</b> dbt pozwala deklarować reguły w kontrakcie modelu, ale w Snowflake większość z nich pozostaje opisem. Strona dbt podaje, że sprawdzane jest tylko <code>not null</code>, a o <code>check</code> pisze, że nie jest obsługiwany. Dokumentacja Snowflake mówi dziś, że <code>CHECK</code> jest obsługiwany i sprawdzany. Źródła się tu różnią, więc przed użyciem sprawdź to na swojej wersji.`
        )
      ]
    },
    {
      id: 'indeksy',
      title: 'Indeks B-tree',
      blocks: [
        p(`Wróćmy do aplikacji, która szuka jednego zamówienia. Jak znaleźć jeden wiersz na milion bez czytania miliona?`),
        p(`Baza czyta dane z dysku całymi porcjami. W klasycznej bazie taka porcja nazywa się <b>stroną</b> (page). Przyjmijmy, że milion zamówień leży na 10 000 stron. Bez pomocy baza musi przeczytać wszystkie strony i sprawdzić każdy wiersz. To <b>full table scan</b>, czyli pełny skan tabeli: 10 000 stron dla jednego wyniku.`),
        p(`<b>Indeks</b> działa jak skorowidz na końcu książki. To osobna struktura, w której wartości wybranej kolumny są posortowane, a przy każdej stoi adres wiersza w tabeli. Najczęstszy rodzaj to <b>B-tree</b>: posortowane wartości ułożone w drzewo. Baza zaczyna od góry i na każdym poziomie wybiera gałąź, w której mieści się szukana wartość.`),
        figure(`Ilustracja. Szukanie <code>order_id = 48213</code> przez indeks B-tree o trzech poziomach. Zakresy są dobrane do przykładu. To nie pomiar.`, {
          kind: 'path',
          steps: [
            { name: 'Korzeń', note: 'Pierwsza strona indeksu. Mówi, w której części drzewa szukać.', options: ['1 – 400 000', '400 001 – 700 000', '700 001 – 1 000 000'], pick: 0 },
            { name: 'Poziom pośredni', note: 'Druga strona zawęża zakres.', options: ['1 – 40 000', '40 001 – 80 000', '80 001 – 120 000'], pick: 1 },
            { name: 'Liść', note: 'Trzecia strona podaje adres wiersza w tabeli.', options: ['48 212', '48 213', '48 214'], pick: 1 },
            { name: 'Tabela', note: 'Baza czyta jedną stronę tabeli i znajduje wiersz.', options: ['strona z zamówieniem 48213'], pick: 0 }
          ],
          total: `Razem: ${lesson.index.treeHeight} strony indeksu i 1 strona tabeli, czyli ${lesson.index.treeHeight + 1} zamiast ${thousands(lesson.index.tablePages)}.`
        }),
        p(`Drzewo jest <b>zrównoważone</b> (balanced): do każdego liścia jest tyle samo kroków. Jego wysokość rośnie bardzo wolno razem z liczbą wierszy, więc także w dużej tabeli droga od wartości do wiersza to kilka odczytów stron.`),
        p(`Liście są ułożone po kolei, dlatego indeks pomaga też przy zakresach. Dla warunku <code>order_date BETWEEN '2025-03-01' AND '2025-03-02'</code> baza schodzi do pierwszej wartości i czyta kolejne liście, aż zakres się skończy. Im szerszy zakres, tym więcej stron tabeli trzeba odwiedzić. Z tego samego powodu indeks pomaga przy sortowaniu.`),
        h3('Kiedy indeks nie pomaga'),
        p(`Bywa, że indeks istnieje, a baza i tak czyta całą tabelę. Są trzy typowe powody.`),
        list(
          `<b>Filtr pasuje do dużej części tabeli.</b> Warunek <code>status = 'paid'</code> spełnia 70% wierszy. Skakanie przez indeks po każdy z 700 000 wierszy jest droższe niż przeczytanie tabeli po kolei. Wybiera <b>planer</b>, czyli część bazy, która decyduje o sposobie wykonania zapytania. Korzysta przy tym ze statystyk o danych. Filtr, który pasuje do małej części tabeli, nazywa się <b>selektywnym</b>. Indeks opłaca się właśnie wtedy.`,
          `<b>Wzorzec bez początku.</b> Posortowane wartości da się przeszukiwać od początku, jak nazwiska w książce telefonicznej. Znając tylko końcówkę, trzeba przejrzeć wszystko. Według dokumentacji PostgreSQL wzorzec <code>LIKE 'Kow%'</code> może użyć indeksu B-tree, a <code>LIKE '%ski'</code> nie.`,
          `<b>Funkcja na kolumnie.</b> Warunek <code>lower(email) = 'anna@example.com'</code> pyta o wynik funkcji, a zwykły indeks trzyma posortowane wartości samego <code>email</code>. Pomaga indeks zbudowany na wyrażeniu <code>lower(email)</code>.`
        ),
        h3('Dlaczego nie indeksuje się wszystkiego'),
        p(`Każdy indeks zajmuje miejsce i dokłada pracy przy zapisie. Wstawienie wiersza to nowy wpis w indeksach tabeli. Zmiana zaindeksowanej kolumny też. Na tabeli z dużą liczbą zapisów szybko się to sumuje, dlatego indeksy tworzy się pod zapytania, które naprawdę działają. Dokumentacja PostgreSQL radzi usuwać indeksy rzadko używane.`),
        p(`Trzy szczegóły, które warto znać.`),
        list(
          `<b>Kolejność kolumn.</b> Indeks na <code>(country, order_date)</code> jest posortowany najpierw po kraju, a w obrębie kraju po dacie. Jak książka telefoniczna: najpierw nazwisko, potem imię. Taki indeks działa najlepiej, gdy zapytanie filtruje po kolumnach z lewej strony (leading columns). Filtr tylko po <code>order_date</code> to jak szukanie po samym imieniu: indeks zawęża dużo mniej. Kolejność kolumn dobiera się więc pod najczęstsze filtry.`,
          `<b>Nie każdy UPDATE rusza indeksy.</b> W PostgreSQL zmiana, która nie dotyka żadnej zaindeksowanej kolumny i mieści się na tej samej stronie, nie wymaga nowych wpisów w zwykłych indeksach. Nazywa się to HOT update.`,
          `<b>Klucz obcy nie tworzy indeksu.</b> W PostgreSQL klucz obcy nie zakłada sam indeksu na swojej kolumnie, tutaj na <code>orders.customer_id</code>. Dokumentacja radzi rozważyć taki indeks, bo przyspiesza joiny i sprawdzanie przy usuwaniu klienta.`
        ),
        h3('A w Snowflake?'),
        p(`W tabelach standardowych Snowflake nie tworzysz indeksów B-tree. Cel jest ten sam, czyli nie czytać wszystkiego, ale droga inna. Typowe zapytanie w hurtowni czyta miliony wierszy, a nie jeden. Dlatego zamiast prowadzić do pojedynczych wierszy, Snowflake pomija duże kawałki tabeli.`),
        table(lesson.index.snowColumns, lesson.index.snowRows),
        warn(
          'Zdanie, na którym łatwo się potknąć',
          `„Snowflake nie ma indeksów” to za duży skrót. Dokładniej: w tabelach standardowych nie tworzysz indeksów B-tree, a Snowflake pomija dane dzięki pruningowi, o którym jest następna część. Tabele hybrydowe mają prawdziwe indeksy. Search optimization service to jeszcze inny mechanizm, z osobnym kosztem.`
        )
      ]
    },
    {
      id: 'pruning',
      title: 'Partycjonowanie, mikropartycje i pruning',
      blocks: [
        p(`Najtańsze dane to te, których silnik w ogóle nie przeczyta. Tabela ma osiem miesięcy zamówień, a raport dotyczy marca. Żeby pominąć resztę, silnik musi wiedzieć z góry, że w danym kawałku tabeli na pewno nie ma marca.`),
        h3('Partycjonowanie deklarowane'),
        p(`Klasyczny sposób to <b>partycjonowanie</b>: dzielisz tabelę na części według wybranej kolumny. W PostgreSQL deklarujesz to w definicji tabeli, przez zakres, listę wartości albo hash. Wiersze z marca trafiają do partycji marcowej, więc przy filtrze po marcu reszta jest poza zakresem. Granice się nie nakładają, bo sam je ustalasz.`),
        p(`Dokumentacja PostgreSQL radzi partycjonować po kolumnach, które najczęściej występują w <code>WHERE</code>. Ostrzega też, że zbyt wiele partycji wydłuża planowanie zapytań i zwiększa zużycie pamięci.`),
        h3('Mikropartycje Snowflake'),
        p(`Snowflake nie każe niczego deklarować. Sam dzieli tabelę na porcje, czyli <b>mikropartycje</b>, w kolejności ładowania danych. Każda zawiera od 50 do 500 MB danych przed kompresją, a kolumny są w niej zapisane i skompresowane osobno. Dla każdej mikropartycji Snowflake zapamiętuje między innymi najmniejszą i największą wartość każdej kolumny.`),
        p(`To wystarcza, żeby pomijać dane. Jeśli w mikropartycji są tylko zamówienia ze stycznia, a szukasz marca, Snowflake może ją pominąć bez czytania. Takie pomijanie całych porcji tabeli na podstawie zapisanych zakresów nazywa się <b>partition pruning</b>.`),
        figure(`Ilustracja. Osiem mikropartycji zamiast tysięcy i filtr po marcu. Pod każdą mikropartycją jest zakres miesięcy, które zawiera. Mikropartycja jest czytana, gdy marzec mieści się między jej minimum a maksimum.`, {
          kind: 'partitions',
          units: lesson.pruning.months,
          filter: { label: `Filtr: ${lesson.pruning.months[2]}`, range: lesson.pruning.filters.find(f => f.id === 'march')!.range },
          layouts: lesson.pruning.layouts.filter(l => l.id !== 'byCustomer').map(l => ({ label: l.label, note: l.note, parts: l.parts.map(part => part.date) })),
          legend: { read: 'czytana', skipped: 'pominięta', count: 'czytane mikropartycje' }
        }),
        p(`Filtr w obu wierszach ilustracji jest ten sam. Różni się tylko fizyczne ułożenie danych. Gdy dane są ułożone po dacie, każda mikropartycja zawiera jeden miesiąc i siedem z ośmiu da się pominąć. Gdy daty są wymieszane, zakres prawie każdej mikropartycji obejmuje marzec i pominąć da się tylko jedną.`),
        p(`To fizyczne ułożenie wierszy nazywa się <b>klastrowaniem</b> (clustering). Masz na nie wpływ na dwa sposoby: kolejnością ładowania danych albo <b>kluczem klastrowania</b> (clustering key), czyli wskazaniem kolumn, po których Snowflake ma układać podobne wiersze obok siebie. Klucz klastrowania to nie indeks. Nie prowadzi do pojedynczych wierszy i niczego nie wymusza. Decyduje tylko o tym, które wiersze leżą razem.`),
        p(`Dwa zastrzeżenia, o których łatwo zapomnieć.`),
        list(
          `<b>Ułożenie pomaga tylko pasującemu filtrowi.</b> Dane ułożone po dacie pomagają filtrowi po dacie. Zapytanie <code>WHERE customer_id = 4711</code> na tej samej tabeli nie pominie niczego, jeśli w każdej mikropartycji są klienci z całego zakresu numerów. Szukany numer mieści się wtedy między minimum a maksimum każdej z nich.`,
          `<b>Przeczytana mikropartycja nie zawiera samych pasujących wierszy.</b> Zakres mówi tylko, że szukana wartość może tam być. Filtr jest stosowany jeszcze raz po odczycie.`
        ),
        table(lesson.pruning.compareColumns, lesson.pruning.compareRows),
        h3('Kiedy klucz klastrowania ma sens'),
        list(
          `Dokumentacja Snowflake zaleca klucze klastrowania dla dużych tabel, zwykle liczonych w wielu terabajtach, i tylko wtedy, gdy zapytania wyraźnie na tym zyskają. Utrzymywanie porządku zużywa kredyty, czyli jednostki, w których Snowflake rozlicza moc obliczeniową.`,
          `<b>Kardynalność</b> (cardinality) to liczba różnych wartości w kolumnie. Kraj ma niską, identyfikator zamówienia wysoką. Zalecenie dla większości tabel: najwyżej 3–4 kolumny lub wyrażenia w kluczu, ułożone od najniższej do najwyższej kardynalności.`,
          `Snowflake nie pomija mikropartycji, gdy wartość do filtra pochodzi z podzapytania, nawet jeśli podzapytanie zwraca stałą.`,
          `W dbt-snowflake klucz klastrowania ustawia konfiguracja <code>cluster_by</code> na tabeli albo modelu przyrostowym.`
        ),
        known(
          'W Snowflake: jak to sprawdzić',
          `W Query Profile przy skanie tabeli widzisz dwie liczby: <code>Partitions scanned</code> i <code>Partitions total</code>. To jest licznik z ilustracji. Dokumentacja mówi, że pruning jest skuteczny, gdy pierwsza liczba jest małym ułamkiem drugiej. Bez tych liczb ocena pruningu jest zgadywaniem.`,
          `Ilustracja ma idealnie równe zakresy. W prawdziwej tabeli mikropartycji są tysiące, a ich zakresy częściowo na siebie nachodzą. Wynik zależy też od tego, jak dane były dopisywane i zmieniane po pierwszym załadowaniu.`
        )
      ]
    },
    {
      id: 'plan-wykonania',
      title: 'Plan wykonania: co baza naprawdę zrobiła',
      blocks: [
        p(`W SQL piszesz, <b>co</b> chcesz dostać. Nie piszesz, <b>jak</b> to policzyć. Sposób wybiera część bazy zwana <b>optymalizatorem</b> (w PostgreSQL: planer). Ustala na przykład kolejność joinów i to, czy czytać tabelę w całości, czy przez indeks. Jego decyzję pokazuje <b>plan wykonania</b> (execution plan): lista kroków, przez które wiersze przechodzą od tabel do wyniku.`),
        h3('Jak czytać EXPLAIN w PostgreSQL'),
        p(`Poniżej trzy plany z dokumentacji PostgreSQL dla tabeli <code>tenk1</code> o 10 000 wierszy. Czyta się je od góry. Pierwszy to zwykłe <code>SELECT * FROM tenk1</code>.`),
        plan(lesson.plans.lines[0].code),
        p(`<code>Seq Scan</code> to pełny skan tabeli. W nawiasie są przewidywania planera, jeszcze przed wykonaniem: koszt do pierwszego wiersza i koszt całkowity, liczba wierszy i średnia szerokość wiersza w bajtach. Koszt jest w umownych jednostkach. To nie są milisekundy.`),
        p(`Drugi plan to ta sama tabela z warunkiem <code>WHERE unique1 = 42</code>.`),
        plan(`${lesson.plans.lines[1].code}\n${lesson.plans.lines[2].code}`),
        p(`Filtr pasuje do jednego wiersza, więc planer wybrał indeks, a przewidywany koszt spadł z 445 do 8,30. To nadal przewidywanie, a nie zmierzony czas. Linia wcięta pod operatorem opisuje jego szczegóły: <code>Index Cond</code> to warunek, po którym baza zeszła w drzewie indeksu.`),
        p(`Trzeci plan pochodzi z <code>EXPLAIN ANALYZE</code> dla warunku <code>WHERE ten &lt; 7</code>.`),
        plan(`${lesson.plans.lines[3].code}\n${lesson.plans.lines[4].code}`),
        p(`<code>EXPLAIN ANALYZE</code> naprawdę wykonuje zapytanie i dopisuje, co się faktycznie stało: czas w milisekundach i liczbę wierszy. Tu przewidywanie (7000 wierszy) zgadza się z rzeczywistością. Filtr pasuje do 70% tabeli, więc planer wybrał skan, a nie indeks. Ostatnia linia mówi, że baza przeczytała 10 000 wierszy, żeby oddać 7000. Jeśli ta liczba jest duża, a wynik mały, baza czyta dużo danych na próżno.`),
        warn(
          'EXPLAIN ANALYZE wykonuje zapytanie',
          `Dotyczy to także <code>UPDATE</code> i <code>DELETE</code>: dane naprawdę się zmienią. Instrukcję zmieniającą dane można objąć <code>BEGIN</code> i <code>ROLLBACK</code>, czyli wykonać w transakcji, którą potem się wycofuje. O transakcjach jest następna część.`
        ),
        p(`W planie szukasz dwóch rzeczy: <b>najdroższego kroku</b> i miejsca, gdzie <b>przewidywanie rozjechało się z rzeczywistością</b>. Dokumentacja PostgreSQL uznaje to drugie za najważniejsze. Gdy planer źle oszacuje liczbę wierszy, może wybrać zły sposób wykonania.`),
        h3('To samo w Snowflake'),
        p(`W Snowflake <code>EXPLAIN</code> pokazuje plan, ale zapytania nie wykonuje. Nie potrzebuje więc działającego warehouse, czyli klastra obliczeniowego, choć samo przygotowanie planu zużywa zasoby warstwy cloud services. Wynik zawiera między innymi kolumny <code>partitionsTotal</code> i <code>partitionsAssigned</code>, więc pruning da się ocenić jeszcze przed uruchomieniem zapytania.`),
        p(`Co się faktycznie stało, pokazuje <b>Query Profile</b>. Plan przed wykonaniem mówi, co silnik zamierza zrobić. Profil po wykonaniu mówi, ile to faktycznie kosztowało. Dokumentacja wymienia cztery typowe problemy, które widać w profilu.`),
        table(lesson.plans.profileColumns, lesson.plans.profileRows),
        p(`Kolejność pracy jest zawsze ta sama: najpierw plan, potem przyczyna (za dużo czytanych danych, za dużo wierszy po joinie, za mało pamięci), a większy warehouse na końcu. Większy warehouse może pomóc, gdy brakuje pamięci. Nie naprawi filtra, który niczego nie pomija, ani joina, który mnoży wiersze.`)
      ]
    },
    {
      id: 'transakcje',
      title: 'Transakcje, ACID i poziomy izolacji',
      blocks: [
        p(`Przelew 100 zł to dwie instrukcje: odejmij z konta Alice, dodaj na konto Boba. Jeśli wykona się tylko pierwsza, pieniądze znikają. <b>Transakcja</b> łączy kilka instrukcji w jedną operację: wykonują się wszystkie albo żadna.`),
        sql(`BEGIN;\nUPDATE accounts\n  SET balance = balance - 100\n  WHERE name = 'Alice';\nUPDATE accounts\n  SET balance = balance + 100\n  WHERE name = 'Bob';\nCOMMIT;`),
        p(`<code>COMMIT</code> zatwierdza transakcję. Od transakcji oczekuje się czterech rzeczy. Ich pierwsze litery dają skrót <b>ACID</b>.`),
        table(['', 'Obietnica', 'Na przykładzie przelewu'], lesson.acid.letters.map(l => [`<b>${l.letter}</b>`, l.name.replace(' · ', ', czyli '), l.text])),
        warn('Spójność to nie poprawność biznesowa', `Baza pilnuje tylko reguł, które zna i sprawdza. Klucz zadeklarowany, ale niesprawdzany, taką regułą nie jest.`),
        h3('Izolacja ma poziomy'),
        p(`Izolacja to reguły na sytuację, gdy dwie transakcje działają naraz. Im ściślejsze reguły, tym mniej transakcji może pracować równolegle. Dlatego izolacja nie jest przełącznikiem, tylko skalą.`),
        p(`Najpierw trzy sytuacje, przed którymi izolacja może chronić. Nazywa się je anomaliami. W każdym przykładzie Ty czytasz dane, a Alice w tym samym czasie robi przelew.`),
        list(...lesson.acid.anomalies.map(a => `<b>${a.name}.</b> ${a.text}`)),
        p(`Dwie ostatnie łatwo pomylić. Non-repeatable read dotyczy <b>wartości istniejącego wiersza</b>. Phantom read dotyczy <b>zestawu wierszy</b>, które spełniają warunek.`),
        p(`Standard SQL ma cztery poziomy izolacji. Każdy kolejny wyklucza więcej anomalii.`),
        table(
          ['Poziom izolacji', 'Dirty read', 'Non-repeatable read', 'Phantom read'],
          ['ru', 'rc', 'rr', 's'].map(id => [level(id).label, allowed(level(id).dirty), allowed(level(id).nonRepeatable), allowed(level(id).phantom)]),
          'Co dopuszcza standard SQL, za dokumentacją PostgreSQL. Konkretna baza może być ściślejsza niż standard.'
        ),
        list(...['ru', 'rc', 'rr', 's'].map(id => `<b>${level(id).label}.</b> ${level(id).note}`)),
        p(`Najważniejszy w praktyce jest read committed. Chroni przed brudnymi odczytami, ale dwie instrukcje w tej samej transakcji mogą zobaczyć różne dane.`),
        h3('MVCC: izolacja bez blokowania'),
        p(`Jak baza pokazuje każdemu spójny obraz danych, skoro inni ciągle zapisują? Popularny sposób to <b>MVCC</b> (multiversion concurrency control): baza trzyma kilka wersji wiersza. Każda instrukcja czyta dane w stanie z jednej chwili, jak na zdjęciu (snapshot). Według dokumentacji PostgreSQL dzięki temu odczyt nie blokuje zapisu, a zapis nie blokuje odczytu.`),
        p(`Na poziomie read committed takie zdjęcie jest robione na początku każdej instrukcji. Stąd biorą się odczyty niepowtarzalne: druga instrukcja ma już nowsze zdjęcie.`),
        h3('Czwarta anomalia i różnice między standardem a PostgreSQL'),
        p(`Tabela w dokumentacji PostgreSQL ma jeszcze jedną kolumnę: <b>serialization anomaly</b>. To sytuacja, w której wynik zatwierdzonych transakcji nie pasuje do żadnej kolejności, w jakiej wykonałyby się jedna po drugiej. Typowy przykład, nazywany potocznie write skew: dwóch lekarzy jednocześnie sprawdza, że na dyżurze jest ich dwóch, i każdy się wypisuje. Każda transakcja osobno jest poprawna, a razem zostawiają dyżur pusty. Wyklucza to dopiero serializable.`),
        p(`PostgreSQL jest ściślejszy niż standard w dwóch miejscach: nie ma brudnych odczytów na read uncommitted ani fantomów na repeatable read. Jego repeatable read to technika snapshot isolation, która nadal dopuszcza serialization anomaly.`),
        known(
          'W Snowflake',
          `Dokumentacja mówi, że transakcje gwarantują własności ACID, a read committed jest jedynym poziomem izolacji obsługiwanym obecnie dla tabel.`,
          `Skutek dla potoku z kilkoma instrukcjami: jeśli między pierwszą a drugą ktoś załaduje nowe dane do źródła, druga instrukcja je zobaczy. Gdy to przeszkadza, przeczytaj źródło raz, do tabeli pośredniej, albo zrób całość jedną instrukcją, na przykład jednym <code>MERGE</code>.`
        )
      ]
    },
    {
      id: 'warehouse-lake-lakehouse',
      title: 'Data warehouse, data lake, lakehouse',
      blocks: [
        p(`Do tej pory była mowa o tym, co dzieje się wewnątrz jednej bazy. Teraz krok wyżej: gdzie w ogóle położyć dane firmy. Ten sam sklep ma zamówienia w tabelach, logi w plikach JSON i zdjęcia produktów.`),
        p(`Trzy najczęstsze wzorce różnią się dwiema rzeczami: w jakiej postaci leżą dane i kto pilnuje ich struktury oraz transakcji. W opisach wracają dwa słowa. <b>Storage</b> to miejsce, gdzie leżą dane. <b>Compute</b> to silnik, czyli maszyny, które je przeliczają.`),
        figure(`Ilustracja. Trzy wzorce jako warstwy: na dole miejsce na dane, wyżej silnik, na górze odbiorcy. Schemat uproszczony.`, { kind: 'stacks', columns: arch.map(a => ({ label: a.label, layers: a.layers })) }),
        h3('Data warehouse'),
        p(`<b>Data warehouse</b>, czyli hurtownia danych, powstała dla raportów. Dane są czyszczone i układane w tabele o ustalonych kolumnach, zanim ktokolwiek je zobaczy. Jeden zarządzany silnik SQL pilnuje schematu i transakcji. Schemat jest sprawdzany przy zapisie (schema on write). Typowi odbiorcy to analitycy i narzędzia BI.`),
        p(`Ograniczenie: dane muszą pasować do tabel, a format, w którym leżą, należy do platformy.`),
        h3('Data lake'),
        p(`<b>Data lake</b> powstał, gdy pojawiły się dane, których nie opłacało się od razu układać w tabele: logi, JSON-y, obrazy, nagrania. To tani magazyn plików w dowolnym formacie. Pliki leżą zwykle w <b>object storage</b>, czyli chmurowym magazynie plików. Strukturę nadaje się im dopiero przy odczycie (schema on read). Czytać może każdy silnik, który rozumie dany format pliku.`),
        p(`Ograniczenia są dwa. Same pliki nie dają transakcji: kto czyta w trakcie zapisu, może zobaczyć tylko część plików. A bez opisu, właściciela i kontroli jakości nikt nie wie, co tam leży. Taki magazyn nazywa się potocznie bagnem danych (data swamp).`),
        h3('Lakehouse'),
        p(`<b>Lakehouse</b> łączy oba światy. Pliki danych nadal leżą w object storage, zwykle w formacie Parquet, w którym dane są zapisane kolumnami. Obok nich leżą metadane, które mówią, które pliki tworzą aktualną wersję tabeli. Te metadane to <b>format tabel</b> (table format). Dwa znane formaty to Delta Lake i Apache Iceberg.`),
        p(`Dzięki formatowi tabel pliki zachowują się jak tabele: mają transakcje ACID i pilnowany schemat. Delta Lake robi to przez log transakcyjny, czyli dziennik zmian zapisany w plikach. Iceberg robi to samo własnymi plikami metadanych. Te same tabele może czytać każdy silnik, który dany format obsługuje, więc BI, SQL i data science pracują na jednej kopii danych. Sam Parquet to tylko format pliku. Transakcje daje dopiero format tabel.`),
        p(`Ograniczenie: otwarty format nie utrzymuje się sam. Ktoś odpowiada za scalanie małych plików, usuwanie starych wersji i katalog, czyli spis tabel. I nie każdy silnik obsługuje każdy format oraz każdą jego funkcję.`),
        table(['', ...arch.map(a => a.label)], lesson.architectures.factLabels.map((label, i) => [label, ...arch.map(a => a.facts[i][1])])),
        deeper(
          'Granice się zacierają',
          `Snowflake obsługuje tabele Apache Iceberg w plikach Parquet. Pliki mogą leżeć w storage'u zarządzanym przez Snowflake albo w storage'u klienta, a katalogiem może być Snowflake albo katalog zewnętrzny.`,
          `Dlatego bezpieczniej mówić o wzorcach niż wkładać produkt do jednej szufladki. „Snowflake to hurtownia, Databricks to lakehouse” jest dziś uproszczeniem. W praktyce wiele firm ma oba wzorce naraz: surowe dane w lake'u, a modele dla BI w hurtowni.`
        )
      ]
    },
    {
      id: 'etl-elt',
      title: 'ETL i ELT',
      blocks: [
        p(`Dane trzeba jeszcze przenieść ze źródeł do systemu analitycznego. Po drodze dzieją się trzy rzeczy: pobranie ze źródła (Extract), przekształcenie (Transform) i załadowanie do systemu docelowego (Load). Oba podejścia mają te same trzy kroki. Różnią się tym, kiedy i na czyich maszynach działa przekształcanie.`),
        figure(`Ilustracja. Kolejność kroków w ETL i ELT. Pod nazwą kroku jest miejsce, w którym on działa. Wyróżniony krok to transformacja.`, {
          kind: 'lanes',
          lanes: lesson.etl.variants.map(v => ({ label: v.label, steps: v.steps }))
        }),
        p(`<b>ETL</b> przekształca dane przed załadowaniem, w osobnym silniku. Do hurtowni trafia gotowy wynik. <b>ELT</b> ładuje dane surowe i przekształca je już w systemie docelowym, jego mocą obliczeniową.`),
        table(
          ['', ...lesson.etl.variants.map(v => v.label)],
          [
            ['Co leży w hurtowni', ...lesson.etl.variants.map(v => v.inWarehouse)],
            ['Mocna strona', ...lesson.etl.variants.map(v => v.good)],
            ['Słaba strona', ...lesson.etl.variants.map(v => v.bad)]
          ]
        ),
        p(`Dokumentacja Microsoft ujmuje różnicę jednym zdaniem: ELT różni się od ETL wyłącznie miejscem transformacji i działa dobrze tylko wtedy, gdy system docelowy ma dość mocy.`),
        p(`Dwa uproszczenia, których warto unikać. Samo ELT nie gwarantuje, że surowe dane zostaną na zawsze: o tym decyduje to, jak długo je przechowujesz. A ETL nie jest przestarzałe: transformacja przed załadowaniem jest potrzebna na przykład wtedy, gdy dane wrażliwe trzeba zamaskować, zanim trafią do hurtowni.`),
        known(
          'W dbt',
          `dbt uruchamia modele jako zapytania SQL w hurtowni, w kolejności zależności. Jest literą T w ELT. Warstwy staging, intermediate i marts to kolejne kroki transformacji wykonywane w systemie docelowym.`,
          `dbt nie pobiera i nie ładuje danych, więc sam nie jest całym potokiem ELT. Dane do warstwy surowej ładuje inne narzędzie. A lekkie przekształcenia, na przykład maskowanie, często i tak dzieją się przed załadowaniem. Podział nie jest zero-jedynkowy.`
        )
      ]
    },
    {
      id: 'storage-compute',
      title: 'Separacja storage i compute',
      blocks: [
        p(`Wyobraź sobie klasyczną hurtownię na własnych serwerach. Każdy serwer (węzeł) ma swoje dyski i swoje procesory, czyli storage i compute naraz. Na takim klastrze działają trzy rodzaje pracy: ładowanie danych, transformacje dbt i dashboardy BI. Ten układ ma trzy kłopoty.`),
        list(...coupled.points),
        p(`Wszystkie trzy mają jedną przyczynę: miejsce na dane i moc obliczeniowa są sklejone w jednym serwerze. Rozwiązaniem jest ich rozdzielenie.`),
        figure(`Ilustracja. Po lewej każdy węzeł ma własne dyski i procesory. Po prawej trzy osobne klastry czytają jedną wspólną kopię danych.`, {
          kind: 'clusters',
          panels: [
            { label: coupled.label, nodes: coupled.compute },
            { label: separated.label, nodes: separated.compute, shared: separated.storage ?? undefined }
          ]
        }),
        p(`<b>Separacja storage i compute</b> to jedno wspólne miejsce na dane i osobne klastry, które je przeliczają. Zmieniają się trzy rzeczy.`),
        list(...separated.points),
        p(`Druga z nich ma własną nazwę: izolacja obciążeń (workload isolation). Różne rodzaje pracy nie zabierają sobie mocy.`),
        p(`W Snowflake te klastry to <b>virtual warehouses</b>. Dokumentacja mówi, że każdy z nich jest niezależnym klastrem, który nie dzieli zasobów obliczeniowych z innymi. Cały Snowflake ma trzy warstwy: <b>database storage</b>, <b>compute</b> i <b>cloud services</b>. Dokumentacja opisuje tę architekturę jako połączenie dwóch podejść: shared-disk (jedno wspólne miejsce na dane) i shared-nothing (niezależne klastry obliczeniowe).`),
        h3('Skalowanie w górę i wszerz'),
        p(`Rozdzielony compute można powiększać na dwa sposoby. To dwa różne narzędzia na dwa różne problemy. Skalowanie w górę (scale up) to większy warehouse: więcej mocy dla pojedynczego zapytania. Skalowanie wszerz (scale out) to więcej klastrów: obsługa większej liczby zapytań naraz.`),
        h3('Czego separacja nie załatwia'),
        list(
          `Izolacja dotyczy mocy obliczeniowej. Dashboard nadal może zwolnić z innych powodów, na przykład gdy jego własny warehouse jest za mały albo zapytania czekają w kolejce.`,
          `Dane nie leżą już przy procesorze, więc silnik czyta je przez sieć i polega na cache'u, czyli podręcznej kopii danych.`,
          `Compute uruchamia się tak łatwo, że rachunek wymaga pilnowania.`
        ),
        p(`Dwa ostatnie punkty to ocena ogólna, a nie cytat z dokumentacji.`),
        p(`To samo rozdzielenie jest podstawą lakehouse: pliki w object storage, a nad nimi dowolny silnik. Różnica polega na tym, kto zarządza formatem i katalogiem.`)
      ]
    },
    {
      id: 'dobor-architektury',
      title: 'Jak dobrać architekturę do wymagań',
      blocks: [
        p(`Na pytanie „jaką architekturę wybrać” nie ma jednej dobrej odpowiedzi. Jest za to dobra kolejność myślenia: najpierw wymagania, potem wybór, na końcu kompromisy. Pięć pytań porządkuje większość decyzji.`),
        steps(
          `<b>Odbiorca.</b> Kto korzysta z danych i jak: człowiek z dashboardem, analityk z SQL-em, model, aplikacja.`,
          `<b>Świeżość.</b> Jak aktualne muszą być dane: dzień, godzina, sekundy. Przy sekundach w grę wchodzi streaming, czyli przetwarzanie zdarzeń na bieżąco, jedno po drugim, zamiast ładowania paczek co jakiś czas.`,
          `<b>Rodzaj danych.</b> Same tabele czy także pliki i JSON-y.`,
          `<b>Skala.</b> Ile jest danych i ilu użytkowników pyta naraz.`,
          `<b>Ograniczenia.</b> Przepisy, budżet, umiejętności zespołu.`
        ),
        p(`Potem najprostszy projekt, który to spełnia, nazwane kompromisy i warunek, przy którym zmienisz decyzję. Pięć wymyślonych sytuacji pokazuje, które wymaganie przesądza o wyborze.`),
        ...lesson.choose.cases.flatMap((c, i) => [
          h3(['Raporty dla analityków', 'Saldo punktów w aplikacji', 'Logi, zdjęcia i uczenie maszynowe', 'Dane wrażliwe przed chmurą', 'Dashboard „w czasie rzeczywistym”'][i]),
          p(c.setup),
          p(`<b>Punkt wyjścia: ${c.options[c.correct].charAt(0).toLowerCase()}${c.options[c.correct].slice(1)}.</b> ${c.why}`),
          p(`<b>Kiedy wrócić do decyzji.</b> ${c.scope}`)
        ])
      ]
    }
  ],
  keyPoints: [
    `<b>OLTP i OLAP to rodzaje pracy, nie produkty.</b> OLTP: bardzo dużo małych operacji na pojedynczych wierszach. OLAP: mało ciężkich zapytań po milionach wierszy.`,
    `<b>Liczy się to, co leży razem na dysku.</b> Zapis wierszowy trzyma razem wiersz i pasuje do OLTP. Zapis kolumnowy trzyma razem kolumnę, czyta tylko potrzebne kolumny i lepiej się kompresuje, więc pasuje do OLAP.`,
    `<b>Projekt logiczny mówi, co dane znaczą. Projekt fizyczny mówi, jak je zapisać</b> w konkretnym silniku, żeby działało szybko.`,
    `<b>Normalizacja: każda informacja zapisana raz.</b> 1NF: jedna wartość w komórce. 2NF: nic nie zależy od części klucza. 3NF: nic nie zależy od klucza przez inną kolumnę niekluczową. Chroni przed anomaliami aktualizacji, wstawiania i usuwania. Ceną są joiny.`,
    `<b>Denormalizacja to celowe powtórzenie danych dla łatwiejszego odczytu.</b> W hurtowni jest bezpieczna, gdy tabelę buduje się od nowa ze źródła i gdy znane jest jej ziarno.`,
    `<b>Klucze: klasyczna baza zapobiega, hurtownia zwykle nie.</b> PostgreSQL sprawdza klucze przy zapisie. Tabele standardowe Snowflake nie wymuszają PRIMARY KEY, UNIQUE ani FOREIGN KEY, wymuszają NOT NULL i CHECK. Tabele hybrydowe klucze wymuszają. Test dbt wykrywa błąd po fakcie.`,
    `<b>Indeks B-tree prowadzi od wartości do wiersza w kilku odczytach stron.</b> Pomaga filtrom selektywnym, zakresom i sortowaniu. Kosztuje miejsce i pracę przy zapisie. Nie pomaga, gdy filtr pasuje do dużej części tabeli, przy wzorcu bez początku i przy funkcji na kolumnie.`,
    `<b>Snowflake pomija dane zamiast je indeksować.</b> Dla każdej mikropartycji zna minimum i maksimum każdej kolumny. Pruning działa, gdy dane są ułożone po kolumnie z filtra. Sprawdzasz to w Query Profile: partitions scanned do partitions total.`,
    `<b>Najpierw plan, potem sprzęt.</b> W planie szukasz najdroższego kroku i miejsca, gdzie przewidywana liczba wierszy rozjechała się z faktyczną. Większy warehouse nie naprawi filtra, który niczego nie pomija, ani joina, który mnoży wiersze.`,
    `<b>ACID to cztery obietnice transakcji.</b> Poziom izolacji to wybór, ile anomalii dopuszczasz. Read committed jest domyślny w PostgreSQL i jedyny dla tabel w Snowflake: każda instrukcja widzi dane zatwierdzone przed jej startem.`,
    `<b>Warehouse, lake i lakehouse to wzorce.</b> Hurtownia: zarządzany silnik i uporządkowane tabele. Lake: tanie pliki bez transakcji. Lakehouse: pliki plus format tabel (Delta Lake, Iceberg), który daje transakcje i schemat.`,
    `<b>ETL i ELT różnią się miejscem transformacji.</b> ELT przekształca w systemie docelowym, a dbt jest jego krokiem T. ETL nadal ma sens, na przykład do maskowania danych przed załadowaniem.`,
    `<b>Separacja storage i compute</b> daje osobne skalowanie i izolację obciążeń. Scale up pomaga pojedynczemu ciężkiemu zapytaniu, scale out większej liczbie zapytań naraz.`,
    `<b>Architekturę wybiera się od wymagań:</b> odbiorca, świeżość, rodzaj danych, skala, ograniczenia. Potem najprostszy projekt, nazwane kompromisy i warunek zmiany decyzji.`
  ],
  glossary: [
    { term: 'ACID', def: 'Cztery obietnice transakcji: atomowość (wszystko albo nic), spójność (reguły bazy są zachowane), izolacja (równoległe transakcje sobie nie przeszkadzają) i trwałość (zatwierdzone zmiany przetrwają awarię).' },
    { term: 'Anomalia (w modelu danych)', def: 'Błąd, na który pozwala układ tabeli z powtórzonymi danymi: aktualizacji, wstawiania albo usuwania.' },
    { term: 'B-tree', def: 'Najczęstszy rodzaj indeksu: posortowane wartości ułożone w zrównoważone drzewo, w którym do każdego liścia jest tyle samo kroków.' },
    { term: 'Blok, strona', def: 'Porcja danych, którą baza czyta z dysku w całości. W klasycznych bazach mówi się o stronach (pages).' },
    { term: 'Compute', def: 'Moc obliczeniowa: maszyny, które wykonują zapytania.' },
    { term: 'Data lake', def: 'Magazyn plików w dowolnym formacie. Strukturę nadaje się danym dopiero przy odczycie. Same pliki nie dają transakcji.' },
    { term: 'Data warehouse', def: 'Hurtownia danych: zarządzany silnik SQL z uporządkowanymi tabelami, przygotowanymi do analizy.' },
    { term: 'Denormalizacja', def: 'Celowe powtórzenie danych, żeby łatwiej i taniej je czytać. Mniej joinów za cenę powtórzeń i droższej zmiany.' },
    { term: 'Dirty read', def: 'Odczyt zmiany, której inna transakcja jeszcze nie zatwierdziła i może wycofać.' },
    { term: 'ELT', def: 'Extract, Load, Transform. Dane surowe trafiają do systemu docelowego i tam są przekształcane, jego mocą obliczeniową.' },
    { term: 'ETL', def: 'Extract, Transform, Load. Dane są przekształcane w osobnym silniku, zanim trafią do systemu docelowego.' },
    { term: 'Format tabel (table format)', def: 'Metadane obok plików danych, które mówią, które pliki tworzą aktualną wersję tabeli. Dają transakcje i pilnowanie schematu. Przykłady: Delta Lake, Apache Iceberg.' },
    { term: 'Full table scan', def: 'Pełny skan: baza czyta całą tabelę i sprawdza każdy wiersz.' },
    { term: 'Integralność referencyjna', def: 'Zasada, że wiersz wskazujący na inną tabelę wskazuje na wiersz, który istnieje. Przykład: nie ma zamówienia bez klienta.' },
    { term: 'Izolacja obciążeń (workload isolation)', def: 'Różne rodzaje pracy mają osobne klastry obliczeniowe, więc nie zabierają sobie mocy.' },
    { term: 'Kardynalność', def: 'Liczba różnych wartości w kolumnie. Kraj ma niską, identyfikator zamówienia wysoką.' },
    { term: 'Klastrowanie (clustering)', def: 'Fizyczne ułożenie wierszy w tabeli. Od niego zależy, ile mikropartycji da się pominąć dla danego filtra.' },
    { term: 'Klucz główny (primary key)', def: 'Kolumna albo kilka kolumn, po których rozpoznajesz jeden wiersz. Wartość jest unikalna i nie może być pusta.' },
    { term: 'Klucz klastrowania (clustering key)', def: 'Kolumny, po których Snowflake ma układać podobne wiersze obok siebie. To nie indeks i niczego nie wymusza.' },
    { term: 'Klucz obcy (foreign key)', def: 'Kolumna, której wartość musi występować jako klucz w innej tabeli.' },
    { term: 'Lakehouse', def: 'Wzorzec łączący data lake i hurtownię: pliki w object storage plus format tabel, który daje transakcje i schemat.' },
    { term: 'Mikropartycja', def: 'Porcja tabeli w Snowflake, tworzona automatycznie w kolejności ładowania: 50–500 MB danych przed kompresją. Snowflake zna zakres wartości każdej kolumny w każdej mikropartycji.' },
    { term: 'MVCC', def: 'Multiversion concurrency control. Baza trzyma kilka wersji wiersza, więc odczyt nie blokuje zapisu, a zapis odczytu.' },
    { term: 'Non-repeatable read', def: 'Ten sam wiersz czytany dwa razy w jednej transakcji ma dwie różne wartości, bo ktoś w międzyczasie zatwierdził zmianę.' },
    { term: 'Normalizacja', def: 'Dzielenie tabel tak, żeby każda informacja była zapisana raz. Kolejne kroki to postacie normalne: 1NF, 2NF, 3NF.' },
    { term: 'Object storage', def: 'Chmurowy magazyn plików. Tani, ale sam z siebie nie ma transakcji ani pojęcia tabeli.' },
    { term: 'OLAP', def: 'Online Analytical Processing. Mało ciężkich zapytań, które czytają miliony wierszy i liczą sumy z kilku kolumn.' },
    { term: 'OLTP', def: 'Online Transaction Processing. Bardzo dużo małych operacji, z których każda czyta albo zmienia kilka wierszy.' },
    { term: 'Partition pruning', def: 'Pomijanie całych porcji tabeli na podstawie zapisanych zakresów wartości, bez czytania danych.' },
    { term: 'Partycjonowanie', def: 'Podział tabeli na części według wybranej kolumny, zadeklarowany przez projektanta: po zakresie, liście wartości albo hashu.' },
    { term: 'Phantom read', def: 'To samo zapytanie z warunkiem zwraca w jednej transakcji inny zestaw wierszy, bo ktoś w międzyczasie zatwierdził nowy wiersz.' },
    { term: 'Plan wykonania', def: 'Lista kroków wybranych przez optymalizator, przez które wiersze przechodzą od tabel do wyniku.' },
    { term: 'Poziom izolacji', def: 'Ustawienie, które mówi, ile anomalii dopuszczasz między równoległymi transakcjami. Standard SQL ma cztery poziomy.' },
    { term: 'Projekt fizyczny', def: 'Decyzje o tym, jak zapisać dane w konkretnym silniku: typy, indeksy, partycjonowanie, klastrowanie.' },
    { term: 'Projekt logiczny', def: 'Opis tego, co zapisujemy: encje, atrybuty, klucze i relacje. Nie zależy od silnika.' },
    { term: 'Query Profile', def: 'Widok w Snowflake, który pokazuje, co faktycznie stało się podczas wykonania zapytania: czas kroków, liczby wierszy, przeczytane mikropartycje.' },
    { term: 'RELY', def: 'Właściwość ograniczenia w Snowflake. Pozwala optymalizatorowi założyć, że dane spełniają regułę. Niczego nie sprawdza.' },
    { term: 'Schema on read', def: 'Struktura jest nadawana danym dopiero przy odczycie. Typowe dla data lake.' },
    { term: 'Schema on write', def: 'Struktura jest sprawdzana przy zapisie. Typowe dla hurtowni.' },
    { term: 'Selektywny filtr', def: 'Filtr, który pasuje do małej części tabeli. Wtedy indeks się opłaca.' },
    { term: 'Spilling', def: 'Operacja nie mieści się w pamięci, więc dane są odkładane na dysk. To dużo wolniejsze.' },
    { term: 'Storage', def: 'Miejsce, w którym leżą dane.' },
    { term: 'Transakcja', def: 'Kilka instrukcji połączonych w jedną operację: wykonują się wszystkie albo żadna.' },
    { term: 'Virtual warehouse', def: 'Klaster obliczeniowy w Snowflake. Każdy jest niezależny i nie dzieli zasobów obliczeniowych z innymi.' },
    { term: 'Wiersz osierocony (orphan)', def: 'Wiersz, który wskazuje na nieistniejący wiersz w innej tabeli, na przykład zamówienie bez klienta.' },
    { term: 'Zależność częściowa', def: 'Kolumna zależy tylko od części klucza złożonego. Usuwa ją 2NF.' },
    { term: 'Zależność przechodnia', def: 'Kolumna niekluczowa zależy od klucza przez inną kolumnę niekluczową. Usuwa ją 3NF.' },
    { term: 'Ziarno (grain)', def: 'Odpowiedź na pytanie, co oznacza jeden wiersz tabeli.' }
  ],
  misconceptions: [
    { myth: 'OLTP to PostgreSQL, a OLAP to Snowflake.', fact: 'To rodzaje pracy bazy, nie produkty. Snowflake ma tabele hybrydowe do pracy typu OLTP, a klasyczna baza potrafi policzyć raport.' },
    { myth: 'Zapis kolumnowy jest po prostu szybszy.', fact: 'Jest szybszy dla skanów kilku kolumn. Dla zapisu i odczytu pojedynczych wierszy jest wolniejszy.' },
    { myth: 'Normalizacja jest przestarzała. Albo odwrotnie: denormalizacja jest zła.', fact: 'To kompromis zależny od rodzaju pracy. Zapis chce modelu znormalizowanego, odczyt chce szerokiego.' },
    { myth: '2NF i 3NF to w praktyce to samo.', fact: '2NF dotyczy zależności od części klucza złożonego. 3NF dotyczy zależności między kolumnami, które nie są kluczem.' },
    { myth: 'Zadeklarowany klucz główny w Snowflake chroni przed duplikatami.', fact: 'W tabelach standardowych PRIMARY KEY, UNIQUE i FOREIGN KEY nie są wymuszane. Drugi wiersz z tym samym kluczem wstawi się bez błędu.' },
    { myth: 'Snowflake nie ma ograniczeń.', fact: 'Ma. NOT NULL i CHECK są wymuszane, a klucze można deklarować. W tabelach hybrydowych klucze są wymuszane.' },
    { myth: 'Test dbt chroni dane tak jak klucz w bazie.', fact: 'Klucz w bazie zapobiega zapisowi. Test wykrywa błąd po zbudowaniu modelu.' },
    { myth: 'RELY sprawia, że Snowflake sprawdza klucz.', fact: 'RELY to deklaracja zaufania dla optymalizatora. Jeśli dane łamią regułę, wyniki mogą być niepoprawne.' },
    { myth: 'Indeks zawsze przyspiesza.', fact: 'Gdy filtr pasuje do dużej części tabeli, planer i tak wybierze skan, a indeks dokłada pracy przy każdym zapisie.' },
    { myth: 'Snowflake nie ma żadnych indeksów. Albo: ma indeksy jak każda baza.', fact: 'W tabelach standardowych nie tworzysz indeksów B-tree, dane pomija pruning. Tabele hybrydowe mają indeksy. Search optimization service to osobny mechanizm.' },
    { myth: 'Klucz klastrowania to indeks i zawsze przyspiesza.', fact: 'Układa wiersze tak, żeby dało się pomijać mikropartycje. Pomaga filtrom po kolumnach klucza, kosztuje kredyty i jest zalecany dla dużych tabel.' },
    { myth: 'Mikropartycje to to samo co partycje.', fact: 'Partycje deklaruje projektant i ich granice się nie nakładają. Mikropartycje powstają automatycznie, a ich zakresy mogą na siebie nachodzić.' },
    { myth: 'Koszt w planie zapytania to czas.', fact: 'W PostgreSQL koszt jest w umownych jednostkach i jest przewidywaniem. Faktyczny czas pokazuje dopiero EXPLAIN ANALYZE, który zapytanie naprawdę wykonuje.' },
    { myth: 'Wolne zapytanie? Trzeba zwiększyć warehouse.', fact: 'Najpierw plan. Większy warehouse może pomóc, gdy brakuje pamięci. Nie naprawi słabego pruningu ani joina, który mnoży wiersze.' },
    { myth: 'Każda baza domyślnie jest serializable.', fact: 'Domyślny poziom izolacji w PostgreSQL to read committed. W Snowflake to jedyny poziom dla tabel.' },
    { myth: 'Kilka instrukcji w jednej transakcji Snowflake widzi ten sam obraz danych.', fact: 'Na poziomie read committed każda instrukcja widzi dane zatwierdzone przed jej własnym startem, więc druga może zobaczyć więcej niż pierwsza.' },
    { myth: 'Spójność w ACID oznacza, że dane są poprawne biznesowo.', fact: 'Baza pilnuje tylko reguł, które zna i sprawdza.' },
    { myth: 'Lakehouse to data lake z SQL-em.', fact: 'Sednem jest format tabel z metadanymi, które dają transakcje i pilnowanie schematu. Sam Parquet to tylko format pliku.' },
    { myth: 'ETL jest przestarzałe, a dbt to narzędzie ETL.', fact: 'Transformacja przed załadowaniem nadal ma zastosowania, na przykład maskowanie danych. dbt wykonuje tylko krok T i niczego nie ładuje.' },
    { myth: 'Separacja storage i compute jest po to, żeby było taniej.', fact: 'Sednem jest osobne skalowanie i izolacja obciążeń. Rachunek wymaga pilnowania, bo compute uruchamia się bardzo łatwo.' },
    { myth: 'Dashboard w czasie rzeczywistym oznacza streaming.', fact: 'Najpierw trzeba ustalić, jaka świeżość wystarczy. Sekundy, minuty i godzina to trzy różne projekty i trzy różne rachunki.' }
  ],
  sourcesNote: 'Fakty pochodzą z oficjalnej dokumentacji i są spisane w docs/verified-facts.md, w sekcji „Lekcja 06”. Strony PostgreSQL były w dniu sprawdzenia dokumentacją wersji 19. Strony Snowflake, dbt, Databricks i Microsoft nie mają numeru wersji, więc obowiązuje data sprawdzenia.',
  sources: [
    { label: 'Snowflake: Micro-partitions & Data Clustering', url: 'https://docs.snowflake.com/en/user-guide/tables-clustering-micropartitions' },
    { label: 'Snowflake: Clustering Keys & Clustered Tables', url: 'https://docs.snowflake.com/en/user-guide/tables-clustering-keys' },
    { label: 'Snowflake: Key Concepts & Architecture', url: 'https://docs.snowflake.com/en/user-guide/intro-key-concepts' },
    { label: 'Snowflake: Search Optimization Service', url: 'https://docs.snowflake.com/en/user-guide/search-optimization-service' },
    { label: 'Snowflake: Query Profile', url: 'https://docs.snowflake.com/en/user-guide/ui-snowsight-activity' },
    { label: 'Snowflake: Constraints overview', url: 'https://docs.snowflake.com/en/sql-reference/constraints-overview' },
    { label: 'Snowflake: Hybrid tables', url: 'https://docs.snowflake.com/en/user-guide/tables-hybrid' },
    { label: 'Snowflake: Transactions', url: 'https://docs.snowflake.com/en/sql-reference/transactions' },
    { label: 'Snowflake: EXPLAIN', url: 'https://docs.snowflake.com/en/sql-reference/sql/explain' },
    { label: 'Snowflake: Apache Iceberg tables', url: 'https://docs.snowflake.com/en/user-guide/tables-iceberg' },
    { label: 'PostgreSQL: Index Types', url: 'https://www.postgresql.org/docs/current/indexes-types.html' },
    { label: 'PostgreSQL: Multicolumn Indexes', url: 'https://www.postgresql.org/docs/current/indexes-multicolumn.html' },
    { label: 'PostgreSQL: Indexes on Expressions', url: 'https://www.postgresql.org/docs/current/indexes-expressional.html' },
    { label: 'PostgreSQL: Heap-Only Tuples (HOT)', url: 'https://www.postgresql.org/docs/current/storage-hot.html' },
    { label: 'PostgreSQL: Constraints', url: 'https://www.postgresql.org/docs/current/ddl-constraints.html' },
    { label: 'PostgreSQL: Table Partitioning', url: 'https://www.postgresql.org/docs/current/ddl-partitioning.html' },
    { label: 'PostgreSQL: Using EXPLAIN', url: 'https://www.postgresql.org/docs/current/using-explain.html' },
    { label: 'PostgreSQL: Transaction Isolation', url: 'https://www.postgresql.org/docs/current/transaction-iso.html' },
    { label: 'PostgreSQL: MVCC Introduction', url: 'https://www.postgresql.org/docs/current/mvcc-intro.html' },
    { label: 'dbt: Add data tests', url: 'https://docs.getdbt.com/docs/build/data-tests' },
    { label: 'dbt: constraints', url: 'https://docs.getdbt.com/reference/resource-properties/constraints' },
    { label: 'dbt: Snowflake configurations', url: 'https://docs.getdbt.com/reference/resource-configs/snowflake-configs' },
    { label: 'Databricks: What is a data lakehouse?', url: 'https://docs.databricks.com/aws/en/lakehouse/' },
    { label: 'Databricks: What is Delta Lake?', url: 'https://docs.databricks.com/aws/en/delta/' },
    { label: 'Microsoft: Database normalization basics', url: 'https://learn.microsoft.com/en-us/troubleshoot/microsoft-365-apps/access/database-normalization-description' },
    { label: 'Microsoft: Extract, transform, load (ETL)', url: 'https://learn.microsoft.com/en-us/azure/architecture/data-guide/relational-data/etl' },
    { label: 'Microsoft: OLTP', url: 'https://learn.microsoft.com/en-us/azure/architecture/data-guide/relational-data/online-transaction-processing' },
    { label: 'Microsoft: OLAP', url: 'https://learn.microsoft.com/en-us/azure/architecture/data-guide/relational-data/online-analytical-processing' }
  ]
};

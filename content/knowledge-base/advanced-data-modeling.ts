import * as lesson from '../data-modeling/dimensional-modeling/lesson';
import { deeper, figure, h3, known, list, p, sql, steps, table, tables, warn, yaml } from './blocks';
import type { KbChapter, KbMiniTable } from './types';

/**
 * Knowledge Base, rozdział: Advanced Data Modeling.
 *
 * Zakres jest ten sam co w lekcji „Advanced Data Modeling & Dimensional Architecture", ale to osobny tekst:
 * podręcznik do czytania i powtórek, bez interakcji. Dane przykładu (wydawcy, produkty, subskrypcje, transakcje,
 * wersje klienta, migawka, tabele poglądowe) są importowane z lekcji, żeby oba materiały pokazywały te same liczby.
 * Proza jest napisana od nowa. Z lekcji pochodzą wprost tylko dane: tabele, zlecenia projektowe, szkice kodu
 * i przykład odpowiedzi w części o projektowaniu.
 *
 * Skąd są fakty: docs/verified-facts.md, sekcja „Lekcja: Advanced Data Modeling & Dimensional Architecture".
 * Poza trzema objaśnieniami pojęć (widok i eksploracja w Looker, Power Query) rozdział nie wprowadza nowych faktów. Liczby w tabelach są liczone poniżej z danych lekcji, a test
 * chapter.test.ts porównuje je z modelem lekcji (apps/web/src/academy/data-modeling/model.ts).
 * To ilustracje, nie pomiary: lekcja nie ma labu Sparka.
 *
 * Kod ma linie do 44 znaków (pilnuje tego test). Bloki DAX i LookML to szkice z lekcji. Model treści nie ma
 * dla nich osobnego języka, więc DAX idzie przez blok `sql`, a LookML przez blok `yaml`.
 */

const { data } = lesson;
type Row = (string | number)[];
type JoinMode = 'pit' | 'current' | 'natural';

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const eur = (n: number) => n.toFixed(2);
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const subOf = (id: string) => data.subscriptions.find(s => s.id === id)!;
const productOf = (subId: string) => data.products.find(x => x.id === subOf(subId).product)!;
const publisherOf = (subId: string) => data.publishers.find(x => x.id === productOf(subId).publisher)!;

/** Mała tabela z tabeli przykładowej lekcji. `keep` wybiera kolumny, gdy wszystkie nie mieszczą się na stronie PDF. */
const mini = (t: { name: string; columns: string[]; rows: Row[] }, key: string[], keep: string[] = t.columns, name = t.name): KbMiniTable => {
  const at = keep.map(c => t.columns.indexOf(c));
  return { name, key, columns: keep, rows: t.rows.map(row => at.map(i => String(row[i]))) };
};
const dim = (id: string) => lesson.star.dims.find(d => d.id === id)!;
const dimRow = (id: string, natural: string) => dim(id).rows.find(r => r[1] === natural)!;

/* ---- dane źródłowe i gwiazda ---- */

const offer = (publisherId: string) =>
  data.products
    .filter(x => x.publisher === publisherId)
    .map(x => `${x.name} (${x.id}, ${x.price} EUR ${x.period === 'monthly' ? 'miesięcznie' : 'rocznie'})`)
    .join(' i ');

const subscriptionsTable: KbMiniTable = {
  name: 'subscriptions (koniec lutego)',
  key: ['subscription_id'],
  columns: ['subscription_id', 'customer_id', 'product_id', 'mrr_eur'],
  rows: data.subscriptions.map(s => [s.id, s.customer, s.product, eur(s.mrr)])
};
const transactionsTable: KbMiniTable = {
  name: 'transactions (pierwszy kwartał)',
  key: ['txn_id'],
  columns: ['txn_id', 'paid_at', 'amount_eur', 'txn_type', 'subscription_id'],
  rows: data.transactions.map(t => [t.id, t.date, eur(t.amount), t.type, t.sub])
};

/** Jedna wpłata rozpisana po kluczach: T-4, Kino Monthly, 1 lutego. */
const sample = data.transactions[3];
const sampleDate = dimRow('date', sample.date);
const sampleCustomer = dimRow('customer', subOf(sample.sub).customer);
const sampleProduct = dimRow('product', productOf(sample.sub).id);
const samplePublisher = dimRow('publisher', publisherOf(sample.sub).id);

/* ---- fan-out ---- */

const febTransactions = data.transactions.filter(t => t.date < data.febEnd);
/** Wiersze po złączeniu subskrypcji z transakcjami do końca lutego. Powtórzony MRR jest wyróżniony. */
const joinedRows = data.subscriptions.flatMap(s =>
  febTransactions.filter(t => t.sub === s.id).map((t, i) => [s.id, publisherOf(s.id).name, i === 0 ? String(s.mrr) : `<b>${s.mrr}</b> (drugi raz)`, t.id, String(t.amount)])
);
const fanout = data.publishers.map(pub => {
  const subs = data.subscriptions.filter(s => publisherOf(s.id).id === pub.id);
  const own = febTransactions.filter(t => publisherOf(t.sub).id === pub.id);
  return { name: pub.name, wrong: sum(own.map(t => subOf(t.sub).mrr)), right: sum(subs.map(s => s.mrr)), revenue: sum(own.map(t => t.amount)) };
});

/* ---- rodzaje tabel faktów ---- */

const factType = (id: string) => lesson.factTypes.tables.find(x => x.id === id)!;
/** Aktualizacje istniejących wierszy ma tylko narastająca migawka. */
const updatesOf = (id: string) => factType(id).updates ?? [];
const factTable = (id: string): KbMiniTable => {
  const t = factType(id);
  const rows = t.rows.map(r => [...r.cells]);
  for (const u of updatesOf(id)) rows[u.row][u.col] = u.value;
  return { name: t.name, key: [], columns: t.columns, rows };
};
const added = (id: string, month: number) => {
  const n = factType(id).rows.filter(r => r.month === month).length;
  return n === 0 ? 'nic nie przybywa' : `${n} ${n === 1 ? 'nowy wiersz' : 'nowe wiersze'}`;
};
const accumulatingChange = (month: number) => {
  if (factType('accumulating').rows.some(r => r.month === month)) return added('accumulating', month);
  return updatesOf('accumulating').some(u => u.month === month) ? 'zmiana w istniejącym wierszu' : 'bez zmian';
};

/* ---- historia: raport per kraj przy trzech sposobach złączenia ---- */

const versionsFor = (t: lesson.Txn, mode: JoinMode) => {
  const all = data.customerVersions.filter(v => v.customer === subOf(t.sub).customer);
  if (mode === 'natural') return all;
  if (mode === 'current') return all.filter(v => v.current);
  // Przedział lewostronnie domknięty: [from, to).
  return all.filter(v => t.date >= v.from && t.date < v.to);
};
const byCountry = (mode: JoinMode) => {
  const totals: Record<string, number> = {};
  for (const t of data.transactions) for (const v of versionsFor(t, mode)) totals[v.country] = (totals[v.country] ?? 0) + t.amount;
  return totals;
};
const countries = [...new Set(data.customerVersions.map(v => v.country))].sort();
const countryRows = (modes: JoinMode[]) => [
  ...countries.map(c => [c, ...modes.map(m => (byCountry(m)[c] === undefined ? 'brak' : String(byCountry(m)[c])))]),
  ['<b>Razem</b>', ...modes.map(m => `<b>${sum(Object.values(byCountry(m)))}</b>`)]
];

const ben = data.customerVersions.filter(v => v.customer === 'C-102');
const versionLabel = (v: lesson.CustomerVersion) => `klucz ${v.key}: ${v.country}, ${v.to === lesson.OPEN_END ? `od ${v.from.slice(5)}` : `od ${v.from.slice(5)} do ${v.to.slice(5)}`}`;
/** Spóźniona transakcja z części o spóźnionych danych: wpłata Bena z 8 lutego, załadowana 25 marca. */
const lateDate = '2026-02-08';
const latePick = ben.findIndex(v => lateDate >= v.from && lateDate < v.to);

const customerType1 = mini(lesson.keys.table, ['customer_key'], lesson.keys.table.columns, 'dim_customer, typ 1 (po zmianie)');
customerType1.rows = customerType1.rows.map(r => (r[1] === 'C-102' ? [r[0], r[1], r[2], ben.find(v => v.current)!.country] : r));
const customerType2: KbMiniTable = {
  name: 'dim_customer, typ 2',
  key: ['customer_key'],
  columns: ['customer_key', 'customer_id', 'country', 'valid_from', 'valid_to'],
  rows: data.customerVersions.map(v => [String(v.key), v.customer, v.country, v.from, v.to])
};

/* ---- warstwa BI ---- */

const counted = (x: (typeof lesson.semantic.presets)[number]) => {
  const subs = lesson.semantic.subs.filter(s => s.status === 'active' || (x.trial && s.status === 'trialing') || (x.pastDue && s.status === 'past_due'));
  return x.unit === 'subscriptions' ? subs.length : new Set(subs.map(s => s.customer)).size;
};
const scopeOf = (x: (typeof lesson.semantic.presets)[number]) => ['opłacone', ...(x.trial ? ['okres próbny'] : []), ...(x.pastDue ? ['karencja'] : [])].join(', ');
const unitOf = (id: string) => lesson.semantic.units.find(u => u.id === id)!.label;

const visibleTo = (publishers: string[]) => data.transactions.filter(t => publishers.includes(publisherOf(t.sub).id));

const [dax, lookml] = lesson.semantic.sketches;
const [rlsDax, rlsLookml] = lesson.rls.sketches;

export const advancedDataModeling: KbChapter = {
  id: 'advanced-data-modeling',
  area: 'data-modeling',
  title: 'Advanced Data Modeling',
  subtitle: 'Od jednego wiersza do warstwy BI: ziarno, fakty i wymiary, historia zmian i jedna definicja miary. Tak, żeby każdą decyzję dało się obronić.',
  lessonId: lesson.meta.id,
  checked: '2026-11-27',
  lead: [
    `Ten rozdział jest o tym, jak ułożyć dane w hurtowni, żeby raporty pokazywały poprawne liczby, a każdą decyzję projektową dało się uzasadnić. Idzie od pojedynczego wiersza do warstwy, z której czyta narzędzie BI: ziarno, fakty i wymiary, historia zmian, warstwa semantyczna.`,
    `Cały rozdział trzyma się jednego wymyślonego przykładu. To platforma subskrypcyjna, na której wydawcy (publishers) sprzedają klientom dostęp do swoich produktów. Danych jest bardzo mało: dwóch wydawców, trzy produkty, trzech klientów, cztery subskrypcje i dziesięć transakcji z pierwszego kwartału 2026. Dzięki temu każdą liczbę da się policzyć w głowie. Kwoty są w EUR.`,
    `Liczby w tabelach i ilustracjach wynikają z tego zbioru. To ilustracje, a nie pomiary: pokazują, czy wynik zapytania jest poprawny, a nie jak szybko działa hurtownia. Fragmenty w DAX i LookML, czyli w językach definicji Power BI i Looker, oraz zapytanie z <code>ASOF JOIN</code> to szkice. Pokazują kształt zapisu i nie były uruchamiane w Power BI, Looker ani Snowflake.`
  ],
  sections: [
    {
      id: 'fakty-i-wymiary',
      title: 'Jedno pytanie, trzy liczby',
      blocks: [
        p(`Na spotkaniu pada pytanie: „ile mamy z subskrypcji w lutym?”. Trzy osoby przynoszą trzy liczby: <b>28</b>, <b>36</b> i <b>56 EUR</b>. Nikt nie pomylił się w rachunkach.`),
        p(`Żeby zobaczyć, skąd wzięły się te liczby, potrzebne są dane. ${data.publishers[0].name} sprzedaje ${offer(data.publishers[0].id)}. ${data.publishers[1].name} sprzedaje ${offer(data.publishers[1].id)}. Poniżej są wszystkie subskrypcje aktywne na koniec lutego i wszystkie transakcje z pierwszego kwartału.`),
        tables(`Dane źródłowe przykładu. Podkreślona kolumna to klucz główny, czyli to, po czym rozpoznajesz jeden wiersz. Dane wymyślone.`, subscriptionsTable, transactionsTable),
        p(`Kolumna <code>mrr_eur</code> to miesięczna opłata subskrypcji. Roczna subskrypcja S-4 kosztuje 96 EUR za rok, czyli 8 EUR na miesiąc. Suma tych opłat ze wszystkich aktywnych subskrypcji nazywa się <b>MRR</b> (monthly recurring revenue): miesięczny przychód powtarzalny.`),
        list(
          `<b>28 EUR</b> to wpłaty, które przyszły w lutym: T-4, T-5 i T-6.`,
          `<b>36 EUR</b> to MRR na koniec lutego: 10 + 10 + 8 + 8.`,
          `<b>56 EUR</b> to wynik zapytania z błędem. Rozbiera go część o fan-oucie.`
        ),
        p(`Dwie pierwsze liczby są poprawne, ale odpowiadają na dwa różne pytania: o zdarzenia („ile wpłynęło”) i o stan w wybranym dniu („ile wynosi powtarzalny przychód”). Zanim powstanie jakakolwiek tabela w hurtowni, trzeba więc ustalić, <b>co dokładnie opisuje jeden jej wiersz</b>.`),
        h3('Tabela faktów i wymiary'),
        p(`Zacznijmy od pytania o wpłaty. Potrzebna jest tabela, w której jeden wiersz to jedna wpłata albo zwrot. Sama kwota nie wystarczy, bo analityk chce ją kroić: po dniach, klientach, produktach i wydawcach. Te opisy trafiają do osobnych, małych tabel, a wiersz z kwotą wskazuje je kluczami.`),
        tables(
          `Cztery tabele z opisami. Kolumny z końcówką <code>_key</code> to numery nadane w hurtowni. Tabela dni pokazuje tylko trzy z nich. Dane wymyślone.`,
          mini({ ...dim('date'), rows: dim('date').rows.slice(3) }, ['date_key']),
          mini(dim('customer'), ['customer_key']),
          mini(dim('product'), ['product_key'], ['product_key', 'product_id', 'name', 'list_price']),
          mini(dim('publisher'), ['publisher_key'])
        ),
        table(
          ['Kolumna faktu', 'Co zawiera', `Wiersz ${sample.id}`],
          [
            ['<code>date_key</code>', 'klucz do <code>dim_date</code>', `${sampleDate[0]}: ${sampleDate[1]}, weekend`],
            ['<code>customer_key</code>', 'klucz do <code>dim_customer</code>', `${sampleCustomer[0]}: ${sampleCustomer[2]}, ${sampleCustomer[3]}`],
            ['<code>product_key</code>', 'klucz do <code>dim_product</code>', `${sampleProduct[0]}: ${sampleProduct[2]}`],
            ['<code>publisher_key</code>', 'klucz do <code>dim_publisher</code>', `${samplePublisher[0]}: ${samplePublisher[2]}`],
            ['<code>txn_id</code>', 'numer transakcji ze źródła', sample.id],
            ['<code>amount_eur</code>', 'kwota wpłaty albo zwrotu', eur(sample.amount)]
          ],
          'Jeden wiersz tabeli fact_transaction rozpisany po kluczach.'
        ),
        p(`Tabela z kwotami to <b>tabela faktów</b> (fact table). Jeden jej wiersz to jedno zdarzenie, które da się zmierzyć. Liczba, którą się analizuje, tutaj <code>amount_eur</code>, to <b>miara</b> (measure). Tabele z opisami to <b>wymiary</b> (dimensions). Mówią, kto, co, kiedy i u kogo. Fakty się sumuje, a po wymiarach się filtruje i grupuje. Układ z tabelą faktów pośrodku i wymiarami dookoła nazywa się <b>star schema</b>, czyli schemat gwiazdy.`),
        p(`Dwa wymiary warto zauważyć od razu. <code>dim_date</code> ma jeden wiersz na dzień i gotowe atrybuty kalendarza, żeby nikt nie liczył kwartału po swojemu. <code>dim_publisher</code> opisuje wydawcę, który jest <b>najemcą</b> platformy (tenant): jednym z wielu klientów korzystających z tej samej platformy. Po tym wymiarze będzie później odcinany dostęp do danych.`),
        h3('Dlaczego gwiazda, a nie model źródłowy albo jedna szeroka tabela'),
        p(`Model znormalizowany, taki jak w systemie źródłowym, trzyma każdą informację w jednym miejscu. To dobre do zapisu, ale jedno pytanie analityczne wymaga wielu złączeń i łatwo o takie, które powiela wiersze. Jedna szeroka tabela jest wygodna dla jednego raportu. Przy pięciu raportach ten sam klient albo produkt musi być wszędzie opisany tak samo, a każda zmiana opisu stawia pytanie, czy przepisać historię.`),
        p(`Gwiazda jest kompromisem. Liczby są w jednym miejscu, a każdy opis jest zdefiniowany raz, w osobnej tabeli. Każde złączenie idzie od faktu do wymiaru: wiele wierszy faktu wskazuje jeden wiersz wymiaru. To relacja wiele do jednego, więc złączenie nie powiela wierszy faktu. Dlaczego to takie ważne, pokaże część o fan-oucie.`),
        known(
          'W dbt',
          `W projekcie dbt masz warstwę marts z modelami <code>fct_</code> i <code>dim_</code>. To te same dwa rodzaje tabel. Model wymiarowy dokłada do nich zasady: wiadomo, co opisuje jeden wiersz faktu, wymiar ma jeden wiersz na obiekt (albo na każdą jego wersję, gdy zapisuje historię), a każdy klucz obcy w fakcie wskazuje dokładnie jeden wiersz wymiaru.`,
          `Tu podobieństwo się kończy: sam prefiks niczego nie gwarantuje. Model dbt może mieszać dwa poziomy szczegółowości albo mieć zduplikowane klucze i nadal się zbuduje. Zasady trzeba zapisać i sprawdzać, na przykład testem unikalności klucza.`
        )
      ]
    },
    {
      id: 'ziarno',
      title: 'Ziarno: co opisuje jeden wiersz',
      blocks: [
        p(`Biznes ma trzy pytania.`),
        steps(...lesson.grain.questions),
        p(`Spróbujmy pociąć te same dane na cztery sposoby. Pierwszy wygląda rozsądnie: jeden wiersz na klienta na miesiąc.`),
        tables(`Jeden wiersz na klienta na miesiąc, styczeń i luty. Dane wymyślone.`, mini(lesson.grain.options.find(o => o.id === 'customer-month')!.table, [], undefined, 'klient × miesiąc')),
        p(`Ta tabela nie odpowiada na żadne z trzech pytań. Luty klienta C-102 to 18 EUR, ale nie widać już, że to dwa produkty dwóch wydawców. Wpłaty i zwroty zlały się w jedną kwotę. A klientka C-103 zapłaciła w styczniu za cały rok, więc w lutym nie ma jej wiersza, choć subskrypcja jest aktywna. Szczegółu, który zniknął przy sumowaniu, nie da się odzyskać.`),
        table(
          ['Jeden wiersz to', 'Dzienny przychód per produkt i wydawca', 'Odsetek zwrotów per produkt', 'Stan i MRR na koniec miesiąca'],
          lesson.grain.options.map(o => [o.label, ...o.answers.map(a => (a.ok ? '<b>tak</b>' : 'nie'))]),
          'Na które pytanie odpowie tabela o danym ziarnie.'
        ),
        p(`Żaden wiersz tego zestawienia nie ma trzech odpowiedzi „tak”. Tabela pojedynczych transakcji obsługuje dwa pierwsze pytania: każda wpłata ma dzień i typ, a przez subskrypcję także produkt i wydawcę. Stanu jednak nie pokaże, bo roczna subskrypcja S-4 nie ma w lutym ani w marcu żadnej transakcji, a jest aktywna. Stan pokazuje dopiero tabela, w której jeden wiersz to subskrypcja aktywna w ostatnim dniu miesiąca. W niej z kolei nie ma wpłat ani zwrotów.`),
        p(`To, co opisuje jeden wiersz tabeli faktów, nazywa się <b>ziarnem</b> (grain). Ziarno ustala się najpierw, przed wymiarami i przed miarami, bo każdy wymiar i każda miara muszą do niego pasować. Zdarzenia i stan na koniec miesiąca to dwa różne ziarna, więc potrzebne są <b>dwie tabele faktów</b>. Dwóch ziaren nie miesza się w jednej tabeli.`),
        h3('Cztery decyzje według Kimballa'),
        p(`Kimball Group, czyli autorzy tej szkoły modelowania, opisują projekt modelu jako cztery decyzje.`),
        steps(
          `Wybierz proces biznesowy. Tutaj: płatności za subskrypcje.`,
          `Zadeklaruj ziarno.`,
          `Wskaż wymiary.`,
          `Wskaż fakty, czyli miary.`
        ),
        p(`Zalecenie brzmi: zacznij od najbardziej szczegółowego poziomu, jaki rejestruje proces. To <b>ziarno atomowe</b> (atomic grain). Ze szczegółu zawsze policzysz sumę, a z sumy szczegółu nie odtworzysz. Kosztem jest większa liczba wierszy. Tabele z gotowymi sumami dokłada się później, dla wydajności, i buduje z danych atomowych.`),
        p(`Ziarno da się sprawdzić. Jeśli wymiar ma kilka wartości na jeden wiersz faktu, to albo ziarno jest złe, albo relacja naprawdę jest wiele do wielu (o niej jest część o tabeli pomostowej). Zwykłe złączenie faktu z wymiarem ma być wiele do jednego, więc testuje się unikalność kluczy wymiaru, brakujące klucze i sumy przed złączeniem oraz po nim.`),
        p(`Na rozmowie zdanie „jeden wiersz to jedna wpłata albo zwrot” warto powiedzieć jako pierwsze. Pokazuje, że projekt zaczyna się od pytania biznesowego, a nie od kolumn ze źródła.`)
      ]
    },
    {
      id: 'fan-out',
      title: 'Fan-out: skąd wzięło się 56',
      blocks: [
        p(`Wróćmy do trzeciej liczby. Ktoś chciał jednym zapytaniem policzyć dwie rzeczy naraz: przychód i MRR per wydawca. Złączył więc tabelę subskrypcji z transakcjami do końca lutego.`),
        sql(
          `SELECT p.publisher_name,\n       SUM(s.mrr_eur)    AS mrr,\n       SUM(t.amount_eur) AS revenue\nFROM subscriptions s\nJOIN transactions t\n  ON t.subscription_id = s.subscription_id\nJOIN products pr\n  ON pr.product_id = s.product_id\nJOIN publishers p\n  ON p.publisher_id = pr.publisher_id\nWHERE t.paid_at < '2026-03-01'\nGROUP BY p.publisher_name`,
          'Join, potem suma'
        ),
        p(`Zobacz, co złączenie robi z wierszami, zanim zadziała <code>GROUP BY</code>.`),
        table(['Subskrypcja', 'Wydawca', 'mrr_eur', 'Transakcja', 'amount_eur'], joinedRows, 'Wiersze po złączeniu subskrypcji z transakcjami, przed GROUP BY.'),
        p(`Były 4 subskrypcje, a po złączeniu jest 6 wierszy. Subskrypcje S-1 i S-2 mają po dwie transakcje, więc ich wiersze występują dwa razy i ich <code>mrr_eur</code> liczy się podwójnie. Suma MRR wychodzi 56 zamiast 36.`),
        figure(`Ilustracja. Liczba wierszy na kolejnych krokach obu zapytań. Wyróżniony krok decyduje o wyniku. Liczby wynikają z danych przykładu.`, {
          kind: 'lanes',
          lanes: [
            {
              label: 'Join, potem suma',
              steps: [
                { name: 'Subskrypcje', where: `${data.subscriptions.length} wiersze`, hot: false },
                { name: 'JOIN z transakcjami', where: `${joinedRows.length} wierszy`, hot: true },
                { name: `SUM(mrr) = ${sum(fanout.map(f => f.wrong))}`, where: `zamiast ${sum(fanout.map(f => f.right))}`, hot: false }
              ]
            },
            {
              label: 'Najpierw agregacja',
              steps: [
                { name: 'Transakcje', where: `${febTransactions.length} wierszy`, hot: false },
                { name: 'GROUP BY subskrypcja', where: `${new Set(febTransactions.map(t => t.sub)).size} wiersze`, hot: true },
                { name: `JOIN i SUM(mrr) = ${sum(fanout.map(f => f.right))}`, where: `${data.subscriptions.length} wiersze`, hot: false }
              ]
            }
          ]
        }),
        table(
          ['Wydawca', 'MRR: join, potem suma', 'MRR: najpierw agregacja', 'Przychód'],
          [
            ...fanout.map(f => [f.name, String(f.wrong), String(f.right), String(f.revenue)]),
            ['<b>Razem</b>', `<b>${sum(fanout.map(f => f.wrong))}</b>`, `<b>${sum(fanout.map(f => f.right))}</b>`, `<b>${sum(fanout.map(f => f.revenue))}</b>`]
          ],
          'Wynik obu zapytań, transakcje do końca lutego.'
        ),
        p(`To jest <b>fan-out</b>: jeden wiersz pasuje do wielu wierszy po drugiej stronie złączenia, więc zostaje powielony, a suma powielonej miary może wyjść zawyżona. Błąd trudno zauważyć. Przychód jest poprawny, bo kwota transakcji występuje raz na wiersz. Kino Nord wygląda dobrze, bo ma jedną transakcję. A baza niczego nie zgłasza, bo zapytanie jest poprawne składniowo.`),
        p(`Lekarstwo: najpierw sprowadź obie strony do tego samego ziarna, potem łącz. Tutaj transakcje sumuje się do jednego wiersza na subskrypcję i dopiero ten wynik łączy z subskrypcjami.`),
        sql(
          `WITH revenue AS (\n  -- transakcje w ziarnie subskrypcji\n  SELECT subscription_id,\n         SUM(amount_eur) AS revenue\n  FROM transactions\n  WHERE paid_at < '2026-03-01'\n  GROUP BY subscription_id\n)\nSELECT p.publisher_name,\n       SUM(s.mrr_eur) AS mrr,\n       SUM(r.revenue) AS revenue\nFROM subscriptions s\nLEFT JOIN revenue r\n  ON r.subscription_id = s.subscription_id\nJOIN products pr\n  ON pr.product_id = s.product_id\nJOIN publishers p\n  ON p.publisher_id = pr.publisher_id\nGROUP BY p.publisher_name`,
          'Najpierw agregacja'
        ),
        p(`Złączenie jest teraz jeden do jednego: 4 wiersze zostają 4 wierszami. MRR wynosi 36, a przychód 144.`),
        h3('Jak rozpoznać fan-out, zanim trafi na dashboard'),
        list(
          `<b>Zapytaj o każde złączenie:</b> ile wierszy po prawej stronie może pasować do jednego wiersza po lewej? Jeśli więcej niż jeden, każda miara z lewej strony może policzyć się kilka razy.`,
          `<b>Porównaj liczbę wierszy</b> przed złączeniem i po nim. Fakt miał 4 wiersze, a po złączeniu z wymiarem ma 6? Klucz wymiaru nie jest unikalny.`,
          `<b>Nie ufaj DISTINCT.</b> Ukrywa problem przy zliczaniu, ale sum nie naprawia. Dwie różne subskrypcje o tym samym MRR zlałyby się w jedną.`,
          `<b>Nie łącz dwóch tabel faktów bezpośrednio.</b> Każdą sumuje się osobno do tego samego poziomu, na przykład wydawcy, i dopiero te wyniki zestawia obok siebie. Kimball nazywa to <b>drill-across</b>.`
        )
      ]
    },
    {
      id: 'rodzaje-faktow-i-addytywnosc',
      title: 'Rodzaje tabel faktów i addytywność miar',
      blocks: [
        p(`Wiadomo już, że zdarzenia i stan to dwa ziarna. Jest jeszcze trzecie pytanie, które nie pasuje do żadnego z nich: ile trwa droga od rejestracji do pierwszej wpłaty? Prześledźmy dwie subskrypcje przez cztery miesiące i zapiszmy je na trzy sposoby.`),
        list(
          `<b>S-2</b>, miesięczna: rejestracja z okresem próbnym 8 stycznia, pierwsza wpłata 15 stycznia, kolejne w lutym i marcu, rezygnacja ze zwrotem 18 marca.`,
          `<b>S-4</b>, roczna: rejestracja i płatność za cały rok 20 stycznia.`
        ),
        tables(`Stan trzech tabel na koniec kwietnia. Te same dwie subskrypcje, trzy różne ziarna. Dane wymyślone.`, factTable('transaction'), factTable('periodic'), factTable('accumulating')),
        table(
          ['Miesiąc', 'fact_transaction', 'fact_subscription_monthly', 'fact_subscription_lifecycle'],
          lesson.factTypes.months.map((m, i) => [m, added('transaction', i), added('periodic', i), accumulatingChange(i)]),
          'Co dzieje się w każdej tabeli w kolejnych miesiącach.'
        ),
        p(`Całą różnicę widać w marcu i kwietniu. Tabela wpłat dostaje wiersz tylko wtedy, gdy coś się wydarzyło. Tabela stanu dostaje wiersz S-4 także w kwietniu, choć nic się nie działo. A w trzeciej tabeli w marcu nie przybył żaden wiersz: w istniejącym wierszu S-2 uzupełniono datę rezygnacji.`),
        list(
          `<b>Tabela transakcyjna</b> (transaction fact table). Ziarno: jedno zdarzenie. Mówi, ile wpłynęło, kiedy i za co. Nie mówi wprost, ile subskrypcji jest aktywnych.`,
          `<b>Okresowa migawka</b> (periodic snapshot). Ziarno: jeden obiekt na okres, tutaj aktywna subskrypcja na koniec miesiąca. Mówi, ile jest subskrypcji i jaki jest MRR oraz jak to się zmienia. Nie widać w niej pojedynczych zdarzeń wewnątrz miesiąca.`,
          `<b>Narastająca migawka</b> (accumulating snapshot). Ziarno: jeden przebieg procesu, który ma znany początek, etapy i koniec. Wiersz ma osobną datę każdego etapu i jest uzupełniany, gdy proces do niego dochodzi. Mówi, ile trwa przejście między etapami: wystarczy odjąć dwie kolumny.`
        ),
        p(`Dojrzały model subskrypcji zwykle ma tabelę transakcyjną i okresową migawkę obok siebie, a łączą je wspólne wymiary.`),
        h3('Co wybór oznacza dla ładowania'),
        p(`Do tabeli transakcyjnej i do okresowej migawki wiersze zwykle się tylko dopisuje. Wiersze narastającej migawki się zmienia, więc ładowanie musi umieć zrobić <code>UPDATE</code> albo <code>MERGE</code> po kluczu subskrypcji. Kimball wymienia to jako cechę, która wyróżnia ją spośród trzech rodzajów. Korekty i spóźnione dane potrafią wymusić zmiany także w dwóch pierwszych (część o spóźnionych danych).`),
        h3('Trzy zastrzeżenia'),
        list(
          `<b>Reguła migawki jest decyzją projektową.</b> Czy anulowana subskrypcja ma mieć wiersz ze statusem „canceled” i MRR równym zero? Tu migawka zawiera tylko subskrypcje aktywne w ostatnim dniu miesiąca. Tę regułę zapisuje się razem z ziarnem.`,
          `<b>Migawkę często da się policzyć ze zdarzeń, a mimo to trzyma się ją osobno.</b> Liczenie stanu z milionów zdarzeń przy każdym zapytaniu jest kosztowne i łatwo zrobić to w dwóch miejscach na dwa sposoby.`,
          `<b>Migawki nie odtworzysz, jeśli źródło trzyma tylko stan bieżący.</b> Stan z 31 stycznia trzeba było zapisać 31 stycznia. Warto więc zbierać migawkę, zanim ktoś o nią zapyta.`
        ),
        h3('Addytywność: czy tę miarę wolno zsumować'),
        p(`Rodzaj tabeli faktów decyduje też o tym, co wolno zrobić z jej liczbami. Trzy miary z tego samego modelu zachowują się zupełnie inaczej, gdy próbujesz je zsumować. Zacznijmy od kwoty transakcji.`),
        ...lesson.additivity.measures.flatMap((m, i) => [
          table(m.head.map(cap), [...m.rows, [`<b>${m.sumLabel}</b>`, `<b>${m.sum}</b>${m.sumOk ? '' : ' (wynik bez sensu)'}`]], `Miara ${m.label}, pierwszy kwartał 2026.`),
          p(
            [
              `Kwotę wolno sumować po każdym wymiarze: po dniach, klientach, produktach i wydawcach. 162 EUR to rzeczywisty przychód kwartału. Teraz MRR z okresowej migawki.`,
              `MRR wolno sumować po subskrypcjach, produktach i wydawcach, ale tylko w ramach jednego dnia. Po czasie nie: 90 EUR nic nie znaczy, bo te same subskrypcje policzyły się trzy razy. Dla kwartału są dwie różne miary: MRR na koniec kwartału (26) i średni miesięczny MRR (30). Jedna nie zastępuje drugiej, więc każda dostaje własną nazwę. Trzeci przypadek to odsetek zwrotów.`,
              `Odsetka nie wolno ani sumować, ani uśredniać. Średnia z trzech odsetków daje 5,6%, a poprawny wynik dla całości to 1 zwrot na 9 wpłat, czyli 11,1%. Dlatego w tabeli faktów trzyma się składniki, czyli liczbę zwrotów i liczbę wpłat, a dzieli się na końcu. Kimball opisuje to jako praktykę stosowaną „tam, gdzie to możliwe”, a dzielenie często zostawia warstwie BI.`
            ][i]
          )
        ]),
        p(`Te trzy zachowania mają nazwy. Miarę <b>addytywną</b> (additive) wolno sumować po każdym wymiarze. <b>Póładdytywną</b> (semi-additive) tylko po niektórych, typowo po wszystkich oprócz czasu. Tak zachowują się salda i stany. <b>Nieaddytywnej</b> (non-additive), na przykład odsetka, nie sumuje się wcale.`),
        p(`Miary w migawkach są często póładdytywne, ale decyduje definicja miary. Każda suma wymaga też kwot w zgodnej walucie i grup, które na siebie nie zachodzą.`),
        h3('Addytywność w warstwie BI'),
        p(`Narzędzie BI domyślnie sumuje kolumnę liczbową. Jeśli użytkownik przeciągnie <code>mrr_eur</code> na wykres kwartalny, dostanie 90. Dlatego surowe kolumny póładdytywne i nieaddytywne się ukrywa, a użytkownik dostaje gotową miarę, w której zapisano, jak ją liczyć.`)
      ]
    },
    {
      id: 'klucze-zastepcze',
      title: 'Klucz naturalny i klucz zastępczy',
      blocks: [
        p(`Którym kluczem fakt ma wskazywać wymiar? System źródłowy zna klienta jako <code>C-102</code>. Najprościej byłoby użyć tego identyfikatora. W hurtowni wymiar dostaje jednak drugi klucz.`),
        tables(`Wymiar klienta z dwoma kluczami. Podkreślony jest klucz główny wymiaru.`, mini(lesson.keys.table, ['customer_key'])),
        p(`<code>customer_id</code> to <b>klucz naturalny</b> (natural key): nadał go system, w którym klient powstał, i biznes go rozpoznaje. <code>customer_key</code> to <b>klucz zastępczy</b> (surrogate key): liczba bez znaczenia, nadana przy ładowaniu do hurtowni. Drugi klucz ma trzy uzasadnienia.`),
        list(
          `<b>Historia.</b> Gdy wymiar zacznie zapisywać zmiany, ten sam klient będzie miał kilka wierszy. Klucz naturalny przestanie być unikalny, więc nie może być kluczem głównym.`,
          `<b>Wiele źródeł.</b> Dwa systemy mogą znać tego samego klienta pod różnymi identyfikatorami. Mogą też używać tego samego identyfikatora dla różnych klientów.`,
          `<b>Niezależność.</b> Źródło nie zawsze dba o swoje klucze i potrafi je zmienić. Własny klucz chroni hurtownię przed takimi zmianami.`
        ),
        p(`Tabela faktów przechowuje klucz zastępczy. Klucz naturalny zostaje w wymiarze jako zwykła kolumna i służy do tego, żeby przy ładowaniu znaleźć właściwy wiersz wymiaru. Wyjątkiem jest wymiar daty: jego klucz może być czytelny, na przykład <code>20260215</code>.`),
        deeper(
          'Liczba z sekwencji czy hash',
          `Kimball opisuje klucz zastępczy jako kolejne liczby całkowite. W projektach dbt na hurtowniach chmurowych często spotkasz zamiast tego hash z klucza naturalnego i daty początku wersji. Hash da się policzyć niezależnie w wielu modelach i przy ponownym ładowaniu wychodzi taki sam, ale jest szerszy niż liczba. To obserwacja praktyki, a nie cytat z dokumentacji.`,
          `Cel jest ten sam: jeden wiersz wymiaru ma jeden klucz bez znaczenia biznesowego.`
        )
      ]
    },
    {
      id: 'nietypowe-fakty-i-wymiary',
      title: 'Trzy sytuacje, w których gwiazda wygląda inaczej',
      blocks: [
        p(`Nie wszystko mieści się w schemacie „miara w fakcie, opis w wymiarze”. Trzy przypadki wracają na rozmowach jako pytanie „a co zrobisz, gdy...”.`),
        h3('Identyfikator bez opisu: wymiar zdegenerowany'),
        p(`W tabeli faktów jest <code>txn_id</code>. Analitycy filtrują po nim przy reklamacjach. Czy potrzebuje własnego wymiaru?`),
        tables(`Numer transakcji jako zwykła kolumna tabeli faktów. Dane wymyślone.`, mini(lesson.patterns.items[0].tables[0], [])),
        p(`Wymiar <code>dim_transaction</code> miałby jedną kolumnę i tyle wierszy, ile fakt. Niczego by nie opisywał. Identyfikator, o którym nie ma nic więcej do powiedzenia, zostaje więc w tabeli faktów. Nazywa się to <b>wymiarem zdegenerowanym</b> (degenerate dimension). Typowe przykłady to numer zamówienia, faktury albo transakcji.`),
        h3('Zdarzenie bez liczby: tabela faktów bez miar'),
        p(`Wydawca chce wiedzieć, które produkty były objęte promocją w dane dni, a mimo to nic nie sprzedały. Samo objęcie promocją nie ma żadnej kwoty. W tabeli sprzedaży tego nie widać, bo brak sprzedaży nie zostawia wiersza.`),
        tables(`Tabela z samymi kluczami: która para produkt i dzień była w promocji. Dane wymyślone.`, mini(lesson.patterns.items[1].tables[0], [])),
        p(`Tabela faktów, która ma same klucze, to <b>factless fact table</b>. Zapisuje, że coś zaszło albo że coś było możliwe. Zamiast sumować kwoty, liczy się w niej wiersze: <code>COUNT(*)</code> mówi, ile par produkt i dzień było w promocji. Gdy od tego pokrycia odejmiesz pary, które mają sprzedaż, zostaje to, co się nie wydarzyło.`),
        h3('Wiele do wielu: tabela pomostowa'),
        p(`Produkty sportowe należą do dwóch kategorii treści, Football i Tennis. Ktoś chce przychodu per kategoria. Jeden produkt ma dwie kategorie, więc wiersz faktu nie wskazuje już jednego wiersza wymiaru. Między fakt a kategorię wchodzi tabela pośrednia.`),
        tables(`Tabela pośrednia między produktem a kategorią, z wagami podziału. Dane wymyślone.`, mini(lesson.patterns.items[2].tables[0], [])),
        table(
          ['Kategoria', 'Przychód bez wag', 'Przychód z wagami'],
          lesson.patterns.items[2].tables[1].rows.map(r => r.map((c, i) => (r[0] === 'razem' ? `<b>${i === 0 ? 'Razem' : c}</b>` : String(c)))),
          'Przychód per kategoria, pierwszy kwartał 2026.'
        ),
        p(`Rzeczywisty przychód kwartału to 162 EUR. Złączenie przez tabelę pośrednią bez wag daje w sumie 308, bo każda transakcja produktu sportowego liczy się w obu kategoriach. To ten sam fan-out co wcześniej, ale tym razem wynika z samych danych, a nie z pomyłki w zapytaniu.`),
        p(`Tabela pośrednia przy relacji wiele do wielu to <b>tabela pomostowa</b> (bridge table). Porządkuje strukturę relacji, ale podwójnego liczenia sama nie usuwa. Trzeba wybrać: albo każda kategoria pokazuje pełną kwotę i kategorie nie sumują się do całości, albo most dostaje wagi, które dzielą kwotę między kategorie. Jak podzielić, to decyzja biznesowa, a nie techniczna.`),
        deeper(
          'Zastrzeżenia do tabeli pomostowej',
          `Strona Kimballa o wymiarach wielowartościowych opisuje most z kluczem grupy i przykład pacjenta z wieloma diagnozami. Wag podziału na tej stronie nie ma. Są praktyką opisywaną w literaturze, więc traktuj je jako jedną z możliwości.`,
          `Jeśli relacja zmienia się w czasie, na przykład produkt zmienia kategorię, most potrzebuje dat ważności, a zapytanie musi wskazać moment, dla którego liczy.`
        )
      ]
    },
    {
      id: 'ksztalt-modelu',
      title: 'Gwiazda, płatek śniegu i wymiary wspólne',
      blocks: [
        p(`Produkt należy do wydawcy. Tę zależność da się zapisać na dwa sposoby.`),
        table(
          ['', 'Star schema', 'Snowflake schema'],
          [
            ['Gdzie są dane wydawcy', 'W wymiarze, do którego fakt sięga bezpośrednio: w osobnym <code>dim_publisher</code> z własnym kluczem w fakcie albo jako dodatkowe kolumny w <code>dim_product</code>', 'W <code>dim_publisher</code>, na który wskazuje <code>dim_product</code>. Fakt zna tylko produkt'],
            ['Złączenia od faktu do nazwy wydawcy', 'Jedno', 'Dwa'],
            ['Powtórzenia danych', 'Więcej', 'Mniej'],
            ['Co widzi użytkownik BI', 'Fakt i wymiary dookoła', 'Łańcuch tabel']
          ]
        ),
        p(`Oba zapisy zawierają tę samą informację. Drugi nazywa się <b>snowflake schema</b>, czyli płatek śniegu. Nazwa opisuje kształt modelu, a nie hurtownię Snowflake.`),
        p(`Kimball odradza płatek śniegu: użytkownikom biznesowym trudniej się w nim poruszać, a zapytania mogą działać wolniej. Microsoft dla modeli Power BI pisze ostrożniej. Jedna tabela wymiaru na ogół się opłaca, ale decyzja może zależeć od ilości danych i wymagań użytkowych.`),
        h3('Wymiar wspólny'),
        p(`Model ma już dwie tabele faktów: <code>fact_transaction</code> i <code>fact_subscription_monthly</code>. Raport „przychód i MRR per wydawca” wymaga, żeby „wydawca” znaczył w obu to samo: te same nazwy kolumn, te same wartości, te same definicje.`),
        p(`Wymiar zdefiniowany raz i używany przez wiele tabel faktów to <b>wymiar wspólny</b> (conformed dimension). Dzięki niemu każdy fakt sumujesz osobno do poziomu wydawcy, a wyniki zestawiasz obok siebie. To jest drill-across z części o fan-oucie. Bez wspólnego wymiaru każdy zespół ma własną listę wydawców i liczby się rozjeżdżają.`),
        p(`Na platformie z wieloma najemcami (multi-tenant) wymiar wydawcy jest wspólny z definicji. Po nim filtrują raporty, po nim rozlicza się wydawców i po nim odcina się dostęp do danych.`),
        known(
          'W Snowflake',
          `Hurtownia kolumnowa dobrze znosi szerokie tabele i złączenia. Technicznie zadziała więc i gwiazda, i płatek śniegu, i jedna wielka tabela. Kształt modelu wybierasz ze względu na czytelność i spójność. Ile tabel widzi użytkownik? Ile złączeń musi zrobić narzędzie BI? W ilu miejscach zapisano, kim jest wydawca?`,
          `Wydajność silnika nie zwalnia z projektowania. Szybka hurtownia policzy błędną liczbę równie szybko jak poprawną, a fan-out kosztuje tym więcej, im większe są tabele.`
        )
      ]
    },
    {
      id: 'scd',
      title: 'Historia zmian: SCD typ 1 i typ 2',
      blocks: [
        p(`Ben (C-102) mieszkał w Niemczech. 10 lutego 2026 zmienia kraj na Polskę. Do którego kraju należą jego styczniowe wpłaty? Raport „przychód per kraj” ma dwie możliwe odpowiedzi i obie bywają poprawne. Zależą od tego, jak wymiar zapisał zmianę.`),
        h3('Typ 1: nadpisz'),
        p(`Najprostszy sposób: wpisać nowy kraj w miejsce starego.`),
        tables(`Wymiar klienta po nadpisaniu kraju Bena. Dane wymyślone.`, customerType1),
        p(`Hurtownia nie wie już, że Ben mieszkał w Niemczech. Wszystkie jego wpłaty, także styczniowe, są przypisane do Polski. Niemcy znikają z raportu.`),
        h3('Typ 2: dodaj wersję'),
        p(`Drugi sposób: stary wiersz zostaje i dostaje datę końca, a nowy kraj trafia do nowego wiersza z nowym kluczem zastępczym.`),
        tables(`Wymiar klienta z historią. Ben ma dwa wiersze o tym samym kluczu naturalnym i dwóch kluczach zastępczych. Dane wymyślone.`, customerType2),
        p(`Wpłaty sprzed 10 lutego wskazują klucz 2, późniejsze klucz 4. Raport pokazuje kraj z chwili wpłaty.`),
        table(['Kraj', 'Typ 1: nadpisz', 'Typ 2: dodaj wersję'], countryRows(['current', 'pit']), 'Przychód per kraj, pierwszy kwartał 2026, w EUR.'),
        p(`Suma w obu raportach to 162 EUR. Sposób zapisu nie zmienia tego, ile zarobiono, tylko komu to przypisano. Wybór zależy od pytania. „Gdzie dziś mieszkają klienci, którzy nam zapłacili” to typ 1. „Ile zarobiliśmy w każdym kraju” to typ 2.`),
        p(`Opis klienta zmienia się rzadko i nieregularnie. Wymiar z takimi atrybutami nazywa się <b>slowly changing dimension</b> (SCD), a sposób zapisu zmiany to jego typ. <b>Typ 1</b> jest prosty, ale historia znika, a raporty za zamknięte okresy zmieniają się wstecz. <b>Typ 2</b> zachowuje historię za cenę dodatkowych wierszy i kolumn.`),
        h3('Kolumny wymiaru typu 2'),
        list(
          `<code>valid_from</code> i <code>valid_to</code>: początek i koniec ważności wersji. Koniec bieżącej wersji zapisuje się jako pustą datę albo odległą datę, tutaj <code>9999-12-31</code>.`,
          `<code>is_current</code>: znacznik bieżącej wersji. Ułatwia zapytania o stan obecny. W tabeli wyżej pominięty dla czytelności.`,
          `Nowy klucz zastępczy dla każdej wersji. To on trafia do tabeli faktów.`
        ),
        p(`Kimball podaje daty i znacznik jako minimum. Microsoft opisuje znacznik jako opcjonalny.`),
        h3('Typ ustala się dla atrybutu, nie dla tabeli'),
        p(`Literówka w nazwisku to poprawka, czyli typ 1. Zmiana kraju, segmentu albo planu cenowego wydawcy zmienia to, jak czytasz przychód, czyli typ 2. W jednym wymiarze zwykle są oba rodzaje atrybutów. Decyzję podejmuje się z biznesem, kolumna po kolumnie, pytaniem: „czy stare raporty mają się zmienić, gdy ta wartość się zmieni?”.`),
        p(`Typ 2 nie jest „lepszy”. Ma koszt: wymiar rośnie, ładowanie musi wykrywać zmiany, a każde złączenie po kluczu naturalnym wymaga warunku na daty. O tym warunku jest następna część.`),
        known(
          'W dbt',
          `Polecenie <code>dbt snapshot</code> porównuje źródło z poprzednim stanem i dopisuje wiersze z kolumnami <code>dbt_valid_from</code> i <code>dbt_valid_to</code>. U bieżącej wersji <code>dbt_valid_to</code> jest domyślnie puste. To mechanizm typu 2: każda zmiana to nowy wiersz z przedziałem ważności. Na takim snapshocie buduje się wymiar z kluczem zastępczym.`,
          `Snapshot rejestruje tylko to, co zobaczył w chwili uruchomienia. Dokumentacja dbt podkreśla, że trzeba go uruchamiać regularnie, bo inaczej zmiany nie zostaną zapisane. Jeśli wartość zmieni się dwa razy między uruchomieniami, stanu pośredniego w snapshocie nie będzie. Pełną historię daje tylko źródło, które samo ją prowadzi, na przykład log zmian.`
        )
      ]
    },
    {
      id: 'punkt-w-czasie',
      title: 'Złączenie punkt-w-czasie',
      blocks: [
        p(`Wymiar ma teraz dwa wiersze Bena. Wiersz, który ładujemy do tabeli faktów, zna tylko klucz naturalny klienta (<code>customer_id</code>, wzięty z subskrypcji) i datę wpłaty. Którą wersję ma dostać? Porównajmy trzy sposoby złączenia.`),
        sql(lesson.pit.sql.natural, 'Sam klucz naturalny'),
        sql(lesson.pit.sql.current, 'Tylko bieżący wiersz'),
        sql(lesson.pit.sql.pit, 'Po dacie zdarzenia'),
        table(['Kraj', 'Sam klucz naturalny', 'Tylko bieżący wiersz', 'Po dacie zdarzenia'], countryRows(['natural', 'current', 'pit']), 'Przychód per kraj, wszystkie transakcje pierwszego kwartału, w EUR.'),
        list(
          `<b>Sam klucz naturalny.</b> Każda wpłata Bena pasuje do obu jego wersji naraz. Suma rośnie ze 162 do 198 EUR. To fan-out, tym razem na wymiarze.`,
          `<b>Tylko bieżący wiersz.</b> Suma się zgadza, ale każda wpłata dostaje wersję bieżącą. Wynik jest taki jak w typie 1, choć historia leży w tabeli.`,
          `<b>Po dacie zdarzenia.</b> Każda wpłata pasuje do dokładnie jednej wersji: tej, która obowiązywała w dniu wpłaty.`
        ),
        p(`Dobieranie wersji po dacie zdarzenia to <b>złączenie punkt-w-czasie</b> (point-in-time join). Warunek ma postać „data zdarzenia jest w przedziale ważności wersji”, a sam przedział ma jeden koniec otwarty: dzień <code>valid_from</code> należy do wersji, a dzień <code>valid_to</code> już do następnej.`),
        warn(
          'Przedziały ważności jednego klienta nie mogą na siebie zachodzić',
          `Dla jednego klucza naturalnego każdy dzień należy do najwyżej jednej wersji. Gdyby przedział był domknięty z obu stron, wpłata z 10 lutego pasowałaby do obu wersji Bena i znów policzyłaby się dwa razy. Stąd warunek <code>&gt;= valid_from</code> i <code>&lt; valid_to</code>.`,
          `Luki w historii bywają uzasadnione. Fakt, który nie trafia w żadną wersję, dostaje wtedy jawny wiersz „nieznany”, a nigdy wersję, która już wygasła.`
        ),
        p(`W modelu wymiarowym to złączenie robi się <b>raz, przy ładowaniu faktu</b>. Ładowanie znajduje klucz zastępczy właściwej wersji i zapisuje go w wierszu faktu. Zapytania analityczne łączą potem fakt z wymiarem zwykłym warunkiem równości po <code>customer_key</code>, bez dat.`),
        h3('Stan bieżący i historyczny z jednego modelu'),
        p(`Biznes często chce obu widoków: przychodu według kraju z chwili wpłaty i według kraju obecnego. Wymiar typu 2 obsłuży oba, o ile każda wersja ma też klucz naturalny albo inny trwały klucz klienta. Widok historyczny to złączenie faktu z wymiarem po kluczu zastępczym. Widok bieżący robi to samo, a potem przechodzi do bieżącego wiersza tego samego klienta (<code>is_current</code>). Tabela faktów jest w obu przypadkach ta sama.`),
        p(`Model, który trzyma wyłącznie stan bieżący, jest prostszy i wystarcza, gdy nikt nie pyta o przeszłość. Błędem jest dopiero udawanie, że odpowiada na pytania historyczne.`),
        h3('Gdy jest tylko data początku wersji'),
        p(`Log zmian często ma jedynie <code>changed_at</code>, bez daty końca. Datę końca można wyliczyć funkcją okna <code>LEAD</code>. Można też użyć złączenia, które samo szuka najbliższego wcześniejszego wiersza. W Snowflake służy do tego <code>ASOF JOIN</code> z klauzulą <code>MATCH_CONDITION</code>.`),
        sql(`SELECT t.txn_id, t.paid_at, c.country\nFROM transactions t\nASOF JOIN customer_changes c\n  MATCH_CONDITION\n    (t.paid_at >= c.changed_at)\n  ON t.customer_id = c.customer_id`, 'Snowflake, szkic'),
        p(`Dla każdego wiersza z lewej strony <code>ASOF JOIN</code> zwraca jeden wiersz z prawej: najbliższy w czasie według podanego operatora. Według dokumentacji Snowflake dozwolone są tylko operatory nierówności. Wiersz z lewej strony bez dopasowania zostaje z wartościami NULL, podobnie jak w złączeniu lewostronnym. Gdy dwa wiersze są równie blisko, nie ma gwarancji, który zostanie zwrócony.`),
        p(`<code>ASOF JOIN</code> nie sprawdza daty końca. Jeśli historia ma luki, trzeba samemu sprawdzić koniec ważności i obsłużyć brak dopasowania.`)
      ]
    },
    {
      id: 'spoznione-dane',
      title: 'Spóźnione dane, korekty i backfill',
      blocks: [
        p(`Dotąd każda transakcja docierała do hurtowni od razu i w kolejności. W praktyce tak nie jest. Model z historią ma dwa czasy: kiedy coś się wydarzyło i kiedy hurtownia się o tym dowiedziała. Dopóki wymiar nie zmienia się między zdarzeniem a ładowaniem, błędu w ładowaniu nie widać.`),
        h3('Spóźniony fakt'),
        p(`25 marca dociera transakcja T-11 Bena z datą wpłaty <b>8 lutego</b>. Operator płatności przesłał ją z opóźnieniem. Bieżąca wersja Bena to Polska, klucz 4. Ładowanie, które bierze „aktualnego klienta”, zapisałoby właśnie ten klucz.`),
        p(`Poprawne ładowanie szuka klucza w całej historii klienta, po dacie wpłaty.`),
        sql(`SELECT d.customer_key\nFROM dim_customer d\nWHERE d.customer_id = 'C-102'\n  AND DATE '2026-02-08' >= d.valid_from\n  AND DATE '2026-02-08' <  d.valid_to`, 'Wyszukanie klucza dla T-11'),
        figure(`Ilustracja. Jak ładowanie dobiera klucz zastępczy dla spóźnionej wpłaty T-11. Wyróżniona jest wersja, w której przedziale mieści się 8 lutego.`, {
          kind: 'path',
          steps: [
            { name: 'Spóźniona wpłata', note: 'Załadowana 25 marca. Zna klucz naturalny klienta i datę wpłaty.', options: [`T-11: C-102, wpłata ${lateDate.slice(5)}`], pick: 0 },
            { name: 'Cała historia klienta', note: 'Ładowanie szuka po kluczu naturalnym we wszystkich wersjach, nie tylko w bieżącej.', options: ben.map(versionLabel), pick: latePick },
            { name: 'Wiersz faktu', note: 'Do tabeli faktów trafia klucz zastępczy wybranej wersji.', options: [`customer_key = ${ben[latePick].key}`], pick: 0 }
          ],
          total: `Liczy się data wpłaty, a nie data załadowania: klucz ${ben[latePick].key} (${ben[latePick].country}), a nie bieżący klucz ${ben.find(v => v.current)!.key} (${ben.find(v => v.current)!.country}).`
        }),
        p(`<b>Spóźniony fakt</b> (late-arriving fact) dostaje klucz tej wersji wymiaru, która obowiązywała w chwili zdarzenia. Ładowanie, które zawsze bierze wersję bieżącą, daje poprawny klucz tylko wtedy, gdy ta wersja obowiązywała już w chwili zdarzenia. Samo ładowanie na czas tego nie gwarantuje: wystarczy, że klient zmieni kraj między wpłatą a ładowaniem. Przy opóźnieniu i ponownym przeliczeniu błąd jest po prostu częstszy.`),
        h3('Spóźniony wymiar'),
        p(`Sytuacja odwrotna: dociera wpłata klienta <b>C-107</b>, ale system klientów jeszcze go nie przesłał. W <code>dim_customer</code> nie ma takiego wiersza. Odrzucenie wpłaty albo zapisanie jej z pustym kluczem zaniżyłoby przychód albo schowało problem.`),
        sql(`-- 1. Jest wpłata, nie ma jeszcze klienta\nINSERT INTO dim_customer\n  (customer_id, name, country)\nVALUES ('C-107', 'Unknown', 'Unknown');\n\n-- 2. Dane klienta dotarły: typ 1\nUPDATE dim_customer\nSET name = 'Greta', country = 'SE'\nWHERE customer_id = 'C-107';`),
        p(`Gdy fakt przychodzi przed swoim wymiarem (late-arriving dimension), ładowanie tworzy <b>wiersz zastępczy</b>: z kluczem naturalnym znanym z transakcji i wartościami „nieznane”. Fakt zapisuje klucz tego wiersza, więc wpłata od razu liczy się w sumach, a w podziale na kraje widać ją jako „Unknown”. Gdy dane klienta dotrą, wiersz zostaje nadpisany, a klucz w fakcie się nie zmienia.`),
        h3('Poprawki wstecz'),
        list(
          `<b>Poprawka faktu.</b> Zwrot T-10 nie kasuje wpłaty T-9. Jest osobnym wierszem z ujemną kwotą. W tym projekcie do tabeli transakcyjnej wiersze są tylko dopisywane (append-only), więc suma za dowolny okres pozostaje prawdziwa: marzec pokazuje i wpłatę, i zwrot.`,
          `<b>Poprawka wymiaru.</b> Okazuje się, że Ben przeprowadził się 1 lutego, a nie 10. Kimball opisuje to wprost: trzeba wstawić albo poprawić wiersz w historii wymiaru, a potem przepisać klucze w wierszach faktów, których to dotyczy. Tutaj transakcja T-4 z 1 lutego przechodzi z wersji niemieckiej na polską.`
        ),
        h3('Backfill i idempotencja'),
        p(`<b>Backfill</b> to ponowne przeliczenie historii. Przy tych samych danych wejściowych i regułach musi dać ten sam wynik co ładowanie na bieżąco. Wymaga to dwóch rzeczy. Po pierwsze ładowanie dobiera wersję wymiaru po dacie zdarzenia. Po drugie zapis jest <b>idempotentny</b>: uruchomiony drugi raz zostawia ten sam stan. Zwykły <code>INSERT</code> przy powtórzeniu tworzy duplikaty. Inaczej jest, gdy backfill ma poprawić historię, bo zmieniły się dane albo reguła: wtedy wynik celowo różni się od wcześniej opublikowanego.`),
        list(
          `Przy <code>MERGE</code> potrzeba stabilnego klucza, usuwania duplikatów ze źródła zawsze w ten sam sposób, ustalonej kolejności spóźnionych zmian i wartości, które przy każdym uruchomieniu wychodzą takie same.`,
          `Przy nadpisaniu partycji potrzebny jest kompletny zbiór wejściowy.`
        ),
        p(`Spóźnione dane unieważniają też to, co policzono wcześniej: tabele zagregowane, okresowe migawki, a czasem raporty już wysłane do klienta. Dlatego ustala się z biznesem, jak długo okres jest otwarty i jak pokazuje się korekty po jego zamknięciu. Dobre pytanie kontrolne do każdego projektu: „co się stanie, gdy ten wiersz przyjdzie tydzień później?”.`)
      ]
    },
    {
      id: 'warstwa-semantyczna',
      title: 'Warstwa semantyczna: jedna definicja miary',
      blocks: [
        p(`Model w hurtowni jest poprawny, a na trzech dashboardach są trzy różne liczby „aktywnych subskrybentów”. Każdy zespół napisał własne zapytanie i każdy inaczej rozumie słowo „aktywny”. Oto osiem subskrypcji z jednego dnia.`),
        tables(
          `Osiem subskrypcji z jednego dnia. <code>trialing</code> to okres próbny bez opłaty, <code>past_due</code> to nieudana płatność w okresie karencji. Dane wymyślone.`,
          { name: 'subscriptions', key: ['subscription_id'], columns: ['subscription_id', 'customer_id', 'status'], rows: lesson.semantic.subs.map(s => [s.sub, s.customer, s.status]) }
        ),
        table(
          ['Zespół', 'Które statusy liczy', 'Jednostka', 'Wynik'],
          lesson.semantic.presets.map(x => [x.label, scopeOf(x), unitOf(x.unit), `<b>${counted(x)}</b>`]),
          'Ta sama nazwa, trzy definicje, trzy liczby.'
        ),
        p(`Finanse liczą to, za co ktoś płaci. Marketing liczy ludzi, do których dotarł, razem z okresem próbnym, a klient C-102 z dwiema subskrypcjami jest dla niego jedną osobą. Zespół produktu liczy każdego, kto ma dostęp do treści. Żadna z trzech liczb nie jest błędna, ale razem są bezużyteczne, bo nazywają się tak samo.`),
        p(`<b>Warstwa semantyczna</b> (semantic layer) to miejsce między hurtownią a raportami, w którym miarę definiuje się raz: nazwa, wzór, filtr, sposób agregacji. Opisuje też tabele i relacje między nimi. Raport nie pisze własnego SQL-a, tylko prosi o miarę po nazwie.`),
        p(`Rozwiązaniem nie jest wybranie jednej „słusznej” definicji. Lepsze są trzy miary o trzech różnych nazwach: opłacone subskrypcje, klienci z okresem próbnym, subskrypcje z dostępem. Która z nich jest najważniejsza, to spór biznesowy. Model go nie rozstrzygnie.`),
        h3('Jak wygląda definicja zapisana raz'),
        p(`Ta sama miara w dwóch narzędziach BI. W Power BI miary zapisuje się w języku formuł DAX, a w Looker w języku LookML. To szkice, które pokazują kształt definicji. Nazwy tabel są przykładowe.`),
        sql(dax.code, `${dax.tool}, szkic`),
        yaml(lookml.code, `${lookml.tool}, szkic`),
        h3('Gdzie żyje definicja miary'),
        list(
          `<b>Power BI.</b> Model semantyczny zawiera tabele, relacje i miary zapisane w DAX. Miara jest liczona w chwili zapytania, dla filtrów ustawionych akurat w raporcie.`,
          `<b>Looker.</b> Wymiary i miary opisuje się w LookML, a Looker generuje z nich SQL. Dokumentacja podkreśla zasadę pisania wyrażenia raz, w jednym miejscu.`,
          `<b>dbt.</b> MetricFlow, silnik warstwy semantycznej dbt, przyjmuje definicje w YAML i sam buduje SQL ze złączeniami. Dokumentacja deklaruje, że na podstawie typów kluczy unika złączeń powielających wiersze.`
        )
      ]
    },
    {
      id: 'kardynalnosc',
      title: 'Kardynalność: obietnica składana narzędziu',
      blocks: [
        p(`Fan-out wraca w warstwie BI. Narzędzie nie zna Twoich danych. O złączeniu wie tyle, ile mu zadeklarujesz: ile wierszy po jednej stronie pasuje do jednego wiersza po drugiej. Na przykład jeden klient ma wiele transakcji. Ta informacja to <b>kardynalność relacji</b> (cardinality).`),
        // Strzałki z tabeli lekcji nie są w zakresach czcionek osadzanych w PDF, więc tabele łączy tu spójnik.
        table(lesson.cardinality.table.columns.map(cap), lesson.cardinality.table.rows.map(r => r.map((c, i) => (i === 0 ? String(c).replace(/ [→↔] /, ' i ') : String(c)))), 'Relacje w modelu subskrypcji.'),
        h3('Power BI'),
        p(`Relacja łączy jedną kolumnę jednej tabeli z jedną kolumną drugiej. Strona „jeden” musi mieć unikalne wartości. Jeśli odświeżenie załaduje duplikat, kończy się błędem. Filtr zawsze przechodzi ze strony „jeden” na stronę „wiele”, a opcjonalnie w obie strony.`),
        p(`Filtrowanie w obie strony Microsoft zaleca ograniczać do minimum: pogarsza wydajność i tworzy niejednoznaczne ścieżki filtrów. Wyjątkiem jest tabela pomostowa między dwoma wymiarami. Tam jedna relacja dwukierunkowa jest potrzebna, żeby filtr dotarł do faktu.`),
        h3('Looker'),
        p(`Złączenie ma parametr <code>relationship</code> z wartościami <code>many_to_one</code> (domyślna), <code>one_to_one</code>, <code>one_to_many</code> i <code>many_to_many</code>. Mechanizm <b>symmetric aggregates</b> chroni sumy i liczniki przed fan-outem. Działa pod dwoma warunkami: każdy widok (view), czyli opis jednej tabeli z jej wymiarami i miarami, ma unikalny klucz główny, a relacja jest podana poprawnie.`),
        p(`Wniosek jest wspólny dla obu narzędzi. Kardynalność to Twoja deklaracja, a narzędzie jej ufa i według niej liczy. Zabezpieczenia przed podwójnym liczeniem działają tylko wtedy, gdy deklaracja zgadza się z danymi, a klucze naprawdę są unikalne. Dlatego unikalność klucza wymiaru testuje się w hurtowni, zanim model trafi do BI.`),
        known(
          'W dbt',
          `Testy <code>unique</code> i <code>not_null</code> na kluczu głównym oraz <code>relationships</code> między modelami sprawdzają dane przy każdym uruchomieniu. Relacja w modelu semantycznym opisuje to samo założenie po stronie narzędzia BI: która strona jest „jeden”, a która „wiele”.`,
          `Różnica: test w dbt sprawdza dane, a deklaracja w BI zwykle niczego nie sprawdza albo sprawdza dopiero przy odświeżeniu. Oba opisy mogą się rozjechać, jeśli ktoś zmieni ziarno modelu i nie poprawi relacji.`
        )
      ]
    },
    {
      id: 'rls',
      title: 'Row-level security: jeden model, wielu najemców',
      blocks: [
        p(`Wszyscy wydawcy korzystają z tego samego modelu i tych samych raportów. Analityk Aurora Sport nie może jednak zobaczyć przychodu Kino Nord. Filtr na stronie raportu nie wystarczy: da się go zdjąć albo pominąć w nowym raporcie.`),
        p(`Rozwiązaniem jest tabela uprawnień, która mówi, kto widzi którego wydawcę, i reguła nałożona na wymiar wydawcy.`),
        table(
          ['Kto patrzy', 'Przypisani wydawcy', 'Widziane transakcje', 'Przychód'],
          lesson.rls.users.map(u => [cap(u.label), u.publishers.join(', '), `${visibleTo(u.publishers).length} z ${data.transactions.length}`, `${sum(visibleTo(u.publishers).map(t => t.amount))} EUR`]),
          'Ten sam raport przychodu za pierwszy kwartał, trzech użytkowników.'
        ),
        p(`<b>Row-level security</b> (RLS) to reguła, która danemu użytkownikowi odcina wiersze, zanim cokolwiek się policzy. Nie jest wpisana w raport: ten sam raport pokazuje każdemu jego wycinek. W tym modelu regułę nakłada się na wymiar wydawcy, a na fakty przenoszą ją relacje, o ile są aktywne i mają właściwy kierunek filtra. Użytkownik bez przypisanego wydawcy nie widzi nic.`),
        p(`Stąd dwa wymagania wobec modelu. Klucz wydawcy musi być w każdej tabeli faktów. I musi to być ten sam, wspólny wymiar.`),
        p(`W Power BI regułę zapisuje się jako filtr roli. W Looker jako filtr na eksploracji (Explore). Eksploracja to punkt startowy zapytania: widok, który użytkownik może odpytywać, razem ze złączeniami do innych widoków.`),
        sql(rlsDax.code, `${rlsDax.tool}, szkic`),
        yaml(rlsLookml.code, `${rlsLookml.tool}, szkic`),
        h3('Zastrzeżenia, o które pyta architekt'),
        list(
          `<b>Power BI: gdzie filtrować.</b> Microsoft pisze, że często wydajniej jest nakładać filtr na tabele wymiarów i pozwolić relacjom przenieść go na fakty. Filtry RLS są doklejane do każdego zapytania i mogą je spowolnić.`,
          `<b>Looker: domyślnie otwarte.</b> <code>access_filter</code> trzeba dodać do każdej eksploracji, która ma być ograniczona. W eksploracji bez niego ten filtr niczego nie ogranicza. Inne ustawienia dostępu, jeśli są, działają dalej. Każdy użytkownik, także administrator, musi mieć ustawioną wartość atrybutu.`,
          `<b>Agregaty.</b> Reguła musi obejmować także tabele zagregowane. W Power BI filtr tylko na tabeli szczegółowej sprawia, że agregaty przestają być używane, a filtr tylko na tabeli agregatów jest niedozwolony.`,
          `<b>Warstwy.</b> RLS w narzędziu BI chroni tylko ten kanał. Kto ma bezpośredni dostęp do hurtowni, omija go. Zabezpieczenia dobiera się więc do ścieżek dostępu: jeśli dane wielu najemców da się czytać także z hurtowni, izolację projektuje się i tam, na przykład politykami dostępu do wierszy.`
        ),
        warn(
          'Power BI: RLS nie dotyczy każdego',
          `Według dokumentacji Microsoft w obszarze roboczym RLS ogranicza dane tylko użytkownikom z rolą Viewer. Nie dotyczy ról Admin, Member i Contributor, bo mają one prawo edycji modelu.`,
          `Raport można też oglądać w aplikacji, bez roli w obszarze roboczym. Wtedy decyduje uprawnienie do modelu: RLS działa, gdy odbiorca ma do niego wyłącznie prawo odczytu (Read). Dlatego wydawcy nie dostają żadnej roli ani uprawnienia z prawem edycji.`
        )
      ]
    },
    {
      id: 'pre-agregacje',
      title: 'Pre-agregacje: szybciej, ale nie za darmo',
      blocks: [
        p(`Tabela transakcji ma miliardy wierszy, a 90% zapytań pyta o przychód per dzień i wydawca. Można policzyć tę odpowiedź raz i trzymać ją w małej tabeli. To <b>pre-agregacja</b>. Liczby w tym akapicie są scenariuszem, a nie pomiarem.`),
        tables(`Gotowy agregat: jeden wiersz na dzień i wydawcę. Dane wymyślone.`, mini(lesson.preagg.table, [])),
        list(
          `<b>Agregat ma własne ziarno.</b> Tu: dzień i wydawca. Odpowie na pytanie o miesiąc i wydawcę. Na pytanie o produkt nie odpowie, bo produktu w nim nie ma.`,
          `<b>Nie każda miara się zwija.</b> Sumy dzienne dodasz do sumy miesięcznej. Liczby unikalnych klientów nie dodasz: klient aktywny w dwóch dniach zostałby policzony dwa razy.`,
          `<b>Agregat musi być świeży i spójny.</b> Spóźniony fakt albo poprawka wymiaru wstecz wymagają przeliczenia agregatu. Kimball ostrzega przed tym przy typie 1: po nadpisaniu atrybutu trzeba zadbać o przeliczenie tabel zagregowanych, których dotyczy zmiana.`
        ),
        h3('Narzędzie powinno wybierać tabelę samo'),
        p(`W Power BI agregacje zdefiniowane przez użytkownika przekierowują zapytanie do tabeli agregatów. Gdy ta nie wystarcza, zapytanie wraca do tabeli szczegółowej. Tabela szczegółowa musi być w trybie DirectQuery. To tryb, w którym raport pyta źródło w chwili wyświetlenia, zamiast korzystać z zaimportowanych danych.`),
        p(`W Looker podobną rolę pełni aggregate awareness: wybiera najmniejszą tabelę, która odpowie poprawnie, a gdy takiej nie ma, używa tabeli bazowej. Dokumentacja wymienia jako obsługiwane sumę, licznik, minimum, maksimum i średnią. Licznik unikalnych wartości obsługuje tylko przy dokładnym dopasowaniu tabeli albo w wersji przybliżonej.`),
        p(`Pre-agregacja to optymalizacja dołożona do modelu atomowego, a nie jego zamiennik. Jeśli użytkownik musi wiedzieć, której tabeli użyć, prędzej czy później ktoś zsumuje agregat, który się nie sumuje.`)
      ]
    },
    {
      id: 'power-bi-looker',
      title: 'Power BI i Looker: te same pojęcia, inne nazwy',
      blocks: [
        p(`Cztery poprzednie części mówiły o tych samych mechanizmach w dwóch narzędziach. Jeśli znasz jedno z nich, drugie opiszesz przez odpowiedniki.`),
        table(lesson.tools.table.columns.map(cap), lesson.tools.table.rows.map(r => r.map(String))),
        h3('Gdzie odpowiedniki przestają działać'),
        list(
          `<b>Gdzie liczy się wynik.</b> Power BI w trybie importu trzyma kopię danych we własnym silniku i na niej liczy miary. Looker wykonuje SQL w hurtowni, gdy nie znajdzie wyniku w cache, czyli wśród zapamiętanych wyników. Tabele PDT (persistent derived tables) przechowuje w bazie. Od tego zależy rozmowa o świeżości danych, koszcie zapytań i miejscu optymalizacji.`,
          `<b>Kiedy działa złączenie.</b> W Power BI relacje są częścią modelu i działają stale. W Looker złączenia są zdefiniowane w eksploracji i trafiają do zapytania wtedy, gdy są potrzebne.`,
          `<b>Wymiar typu 2.</b> W obu przypadkach przygotowuje się go wcześniej. Microsoft pisze wprost, że Power Query, czyli silnik przygotowania i transformacji danych, nie wykona wyszukania wersji po dacie. Model semantyczny może jedynie załadować gotową tabelę typu 2.`
        ),
        p(`Pierwszy punkt opisuje ogólny sposób działania obu narzędzi i nie jest cytatem z dokumentacji trybów przechowywania.`)
      ]
    },
    {
      id: 'gdzie-logika',
      title: 'Gdzie umieścić logikę: hurtownia, miara czy raport',
      blocks: [
        p(`Na pytanie „gdzie to policzyć” nie ma odpowiedzi „zawsze w hurtowni”. Jest zasada: logikę umieszczasz tam, gdzie skorzystają z niej wszyscy odbiorcy i gdzie da się ją przetestować. Dlatego na rozmowie najpierw mówisz, kto jest odbiorcą, a dopiero potem, gdzie umieszczasz logikę. Cztery wymyślone przypadki pokazują, co przesądza o wyborze.`),
        h3('Transakcje testowe'),
        p(`Transakcja testowa ma <code>is_test = true</code> i nie może trafić do żadnej liczby. Z danych korzystają dashboardy, eksport do finansów i model prognozujący rezygnacje.`),
        p(`<b>Miejsce: hurtownia.</b> Odbiorców jest kilku i tylko część przechodzi przez narzędzie BI. Reguła czyszcząca musi zadziałać, zanim ktokolwiek przeczyta dane, i tam da się ją pokryć testem. Jeśli surowe wiersze testowe są komuś potrzebne, zostają w warstwie źródłowej.`),
        h3('Odsetek zwrotów'),
        p(`Użytkownik chce odsetka zwrotów dla dowolnego wycinka, który sam wybierze.`),
        p(`<b>Miejsce: warstwa semantyczna.</b> Odsetek jest nieaddytywny, więc policzony w hurtowni dla jednego ziarna będzie błędny w każdym innym. Hurtownia dostarcza liczbę zwrotów i liczbę wpłat, a miara dzieli je dla wybranego wycinka. Wyjątek: jeden raport o stałym ziarnie. Wtedy gotowy wynik w hurtowni też jest poprawny.`),
        h3('Region sprzedaży'),
        p(`Kraj trzeba przypisać do regionu sprzedaży (DACH, CEE, Nordics). Regiony zmieniają się raz na rok i używa ich każdy raport.`),
        p(`<b>Miejsce: hurtownia.</b> To atrybut wymiaru: opis, po którym się grupuje. Powinien być kolumną w <code>dim_customer</code> albo osobnym wymiarem. Ten sam <code>CASE WHEN</code> skopiowany do dziesięciu raportów rozjedzie się przy pierwszej zmianie. Jeśli region ma być raportowany tak, jak obowiązywał w chwili sprzedaży, staje się atrybutem typu 2.`),
        h3('Pierwszych dziesięciu wydawców'),
        p(`Na jednym dashboardzie kierownik chce widzieć wydawców posortowanych malejąco i tylko pierwszych dziesięciu.`),
        p(`<b>Miejsce: raport.</b> To sposób prezentacji jednej strony, a nie definicja biznesowa. Gdy „top 10 wydawców” zacznie być używane w rozliczeniach albo pojawi się w kilku raportach, wraca do modelu.`),
        h3('Podział w trzech zdaniach'),
        table(
          ['Miejsce', 'Co tam trafia'],
          [
            ['Hurtownia', 'Czyszczenie, ziarno, klucze, historia i atrybuty wymiarów, czyli wszystko, co ma być prawdą dla każdego odbiorcy'],
            ['Warstwa semantyczna', 'Miary, które zależą od kontekstu zapytania, ich nazwy i reguły dostępu'],
            ['Raport', 'Tylko prezentacja']
          ]
        )
      ]
    },
    {
      id: 'metodyki',
      title: 'Kimball, Inmon i Data Vault',
      blocks: [
        p(`Te trzy nazwy padają w rozmowach z architektami. Wszystkie odpowiadają na to samo pytanie: jak z wielu systemów źródłowych zrobić spójne dane do analizy. Różnią się <b>warstwą integracji</b>, czyli miejscem, w którym dane z wielu źródeł łączy się w całość.`),
        figure(`Ilustracja. Trzy podejścia jako warstwy, czytane od dołu. Schemat uproszczony.`, {
          kind: 'stacks',
          columns: [
            {
              label: 'Kimball',
              layers: [
                { name: 'Czyta BI', text: 'Fakty i wymiary z danymi atomowymi' },
                { name: 'Integracja', text: 'W tej samej warstwie: wspólne wymiary, proces po procesie' },
                { name: 'Źródła', text: 'Systemy źródłowe' }
              ]
            },
            {
              label: 'Inmon',
              layers: [
                { name: 'Czyta BI', text: 'Wymiarowe data marty dla działów' },
                { name: 'Integracja', text: 'Znormalizowana hurtownia całej firmy z danymi atomowymi' },
                { name: 'Źródła', text: 'Systemy źródłowe' }
              ]
            },
            {
              label: 'Data Vault',
              layers: [
                { name: 'Czyta BI', text: 'Marty wymiarowe do raportowania' },
                { name: 'Integracja', text: 'Huby, linki i satelity z historią' },
                { name: 'Źródła', text: 'Systemy źródłowe' }
              ]
            }
          ]
        }),
        list(
          `<b>Kimball.</b> Model buduje się proces po procesie, od razu jako fakty i wymiary z danymi atomowymi. Całość spinają wspólne wymiary.`,
          `<b>Inmon.</b> Dane atomowe trafiają najpierw do znormalizowanej hurtowni całej firmy (enterprise data warehouse). Z niej zasila się wymiarowe data marty, czyli mniejsze zbiory tabel dla działów. Ten opis pochodzi z artykułu Kimball Group, a więc od tej strony sporu, która woli własne podejście.`,
          `<b>Data Vault.</b> Trzy rodzaje tabel. <b>Hub</b> trzyma klucz biznesowy, na przykład identyfikator klienta. <b>Link</b> trzyma relację między hubami. <b>Satellite</b> trzyma atrybuty opisowe i ich historię. Glosariusz Databricks podkreśla śledzenie historii i audytowalność. Umieszcza Data Vault w warstwie pośredniej, a marty wymiarowe do raportowania buduje nad nią.`
        ),
        p(`To nie są trzy konkurencyjne kształty tabel dla raportu. Na końcu, tam gdzie czyta narzędzie BI, w każdym z tych podejść zwykle stoi model wymiarowy. Dobra odpowiedź na rozmowie mówi więc, jaki problem integracji rozwiązujesz, a nie która szkoła jest lepsza. Liczą się liczba źródeł, wymagania audytowe i umiejętności zespołu.`),
        p(`Dwie uwagi praktyczne, które są oceną, a nie cytatem ze źródeł. Podejścia się łączą: w projekcie dbt warstwy staging i pośrednie przypominają warstwę integracji, a marty są wymiarowe. A kosztem Data Vault jest duża liczba tabel i złączeń, więc bez automatycznego generowania modeli bywa ciężki w utrzymaniu.`)
      ]
    },
    {
      id: 'projektowanie',
      title: 'Od zlecenia do modelu: trzy projekty',
      blocks: [
        p(`Na rozmowie model projektuje się na głos. Kolejność decyzji jest zawsze ta sama: proces i rodzaj tabeli faktów, ziarno, wymiary, historia. Trzy zlecenia pokazują, jak z tej kolejności wynika gotowy projekt.`),
        ...lesson.design.cases.flatMap((c, i) => [
          h3(c.title),
          p(c.brief),
          list(
            ...[
              [
                `<b>Rodzaj tabeli: okresowa migawka.</b> Pytania dotyczą stanu na koniec okresu i jego zmiany. Tabela wpłat nie pokaże rocznej subskrypcji w miesiącach bez płatności.`,
                `<b>Ziarno: jedna subskrypcja na koniec miesiąca.</b> To najniższy poziom, na którym istnieje MRR. Ziarno klienta zgubiłoby wydawcę i produkt, bo klient może mieć subskrypcje u dwóch wydawców.`,
                `<b>„Przybyło” i „ubyło”: porównanie dwóch kolejnych miesięcy.</b> W danych przykładu w lutym przybywa S-3 (8 EUR), więc MRR rośnie z 28 do 36. W marcu ubywa S-2 (10 EUR), więc spada do 26.`,
                `<b>Zmiana ceny w marcu nie zmienia raportu za luty.</b> MRR jest zapisany w migawce jako miara z danego dnia. Cena w wymiarze produktu opisuje ofertę, a nie to, ile ktoś zapłacił.`
              ],
              [
                `<b>Rodzaj tabeli: narastająca migawka.</b> Proces ma znany początek, etapy i koniec, a pytania dotyczą czasu między etapami. Odpowiedź to różnica dwóch kolumn z datami.`,
                `<b>Ładowanie: MERGE albo UPDATE po kluczu subskrypcji,</b> bo wiersz zmienia się przy każdym kolejnym etapie.`,
                `<b>Etap, którego jeszcze nie było: wartość pusta albo klucz specjalnego wiersza w wymiarze daty.</b> Data rejestracji albo dzisiejsza dałyby zero dni do płatności i stuprocentową konwersję.`,
                `<b>Kraj z dnia rejestracji: wymiar klienta typu 2.</b> Wiersz zapisuje klucz zastępczy wersji, która obowiązywała przy rejestracji.`
              ],
              [
                `<b>Klucz wydawcy: w każdej tabeli faktów, do wspólnego wymiaru.</b> Tylko wtedy reguła dostępu nałożona na wymiar obejmie każdy fakt. Osobny model na wydawcę uniemożliwia raporty całej platformy.`,
                `<b>Plan cenowy wydawcy: atrybut typu 2.</b> „Według planu z chwili transakcji” to wprost stan historyczny. Typ 1 przepisałby stary przychód na nowy plan.`,
                `<b>Egzekwowanie: RLS na wymiarze wydawcy w warstwie semantycznej i izolacja w hurtowni.</b> Kto ma dostęp bezpośrednio do hurtowni, omija narzędzie BI.`,
                `<b>Filtr RLS: na kluczu naturalnym wydawcy.</b> Klucz zastępczy zmienia się z każdą wersją, więc uprawnienie przypięte do niego przestałoby działać po zmianie planu.`
              ]
            ][i]
          ),
          p(`<b>Wynik.</b> ${c.summary}`)
        ]),
        h3('Jak bronić decyzji projektowej'),
        p(`Rozmówca od BI i architektury rzadko pyta o definicję. Pyta „dlaczego tak”. Odpowiedź, która się broni, ma cztery części: pytanie biznesowe, decyzja, alternatywa, koszt.`),
        deeper('Przykład takiej odpowiedzi', `„${lesson.interview.framePl}”`)
      ]
    }
  ],
  keyPoints: [
    `<b>Najpierw ziarno.</b> Zanim wymienisz kolumny, powiedz, co opisuje jeden wiersz tabeli faktów. Wymiary i miary muszą do tego pasować. Dwóch ziaren nie miesza się w jednej tabeli.`,
    `<b>Fakty się sumuje, po wymiarach się filtruje i grupuje.</b> W star schema każde złączenie idzie od faktu do wymiaru, w relacji wiele do jednego, więc nie powiela wierszy faktu.`,
    `<b>Fan-out to powielenie wiersza przez złączenie.</b> Suma powielonej miary rośnie, a baza nie zgłasza błędu. Lekarstwo: sprowadzić obie strony do tego samego ziarna i dopiero wtedy łączyć. DISTINCT sum nie naprawia.`,
    `<b>Trzy rodzaje tabel faktów to trzy rodzaje pytań.</b> Transakcyjna: co się wydarzyło. Okresowa migawka: jaki był stan na koniec okresu. Narastająca migawka: ile trwa przejście między etapami procesu. Tylko w tej ostatniej wiersze zmienia się w zwykłym trybie.`,
    `<b>Nie każdą miarę wolno sumować.</b> Addytywną po każdym wymiarze. Póładdytywną, na przykład MRR, nie po czasie. Nieaddytywnej, na przykład odsetka, wcale: fakt trzyma licznik i mianownik.`,
    `<b>Fakt wskazuje wymiar kluczem zastępczym.</b> Klucz naturalny zostaje w wymiarze i służy do znalezienia właściwego wiersza przy ładowaniu.`,
    `<b>Trzy wzorce poza zwykłą gwiazdą.</b> Wymiar zdegenerowany: identyfikator w fakcie. Tabela faktów bez miar: zdarzenie albo pokrycie bez liczby. Tabela pomostowa: relacja wiele do wielu, w której trzeba jeszcze zdecydować, jak sumować.`,
    `<b>Wymiar wspólny łączy tabele faktów.</b> Ten sam wymiar daty, produktu i wydawcy we wszystkich faktach pozwala zestawiać ich wyniki obok siebie.`,
    `<b>Typ 1 nadpisuje, typ 2 dodaje wersję.</b> Suma jest ta sama, zmienia się podział. Typ ustala się dla atrybutu pytaniem: czy stare raporty mają się zmienić?`,
    `<b>Fakt dostaje wersję wymiaru z chwili zdarzenia.</b> Złączenie punkt-w-czasie robi się raz, przy ładowaniu. Przedział ważności ma jeden koniec otwarty.`,
    `<b>Model z historią ma dwa czasy:</b> kiedy coś się wydarzyło i kiedy hurtownia się dowiedziała. Spóźniony fakt szuka wersji po dacie zdarzenia. Spóźniony wymiar dostaje wiersz zastępczy. Backfill wymaga zapisu idempotentnego.`,
    `<b>Miarę definiuje się raz, w warstwie semantycznej.</b> Różne znaczenia dostają różne nazwy. Poprawna hurtownia nie gwarantuje spójnych liczb na dashboardach.`,
    `<b>Kardynalność w narzędziu BI to deklaracja.</b> Zabezpieczenia przed podwójnym liczeniem działają tylko przy unikalnych kluczach i poprawnie podanej relacji, więc unikalność testuje się w hurtowni.`,
    `<b>RLS nakłada się na wspólny wymiar najemcy</b> i chroni tylko kanał BI. W Power BI nie obejmuje nikogo, kto ma prawo edycji modelu. Izolacja musi istnieć na każdej ścieżce dostępu, także w hurtowni.`,
    `<b>Pre-agregacja jest optymalizacją schowaną za modelem.</b> Ma własne ziarno, nie każda miara się w niej zwija i trzeba ją przeliczać po spóźnionych danych.`,
    `<b>Logika idzie tam, gdzie skorzystają z niej wszyscy odbiorcy.</b> Hurtownia: to, co ma być prawdą dla każdego. Warstwa semantyczna: miary zależne od kontekstu i reguły dostępu. Raport: prezentacja.`,
    `<b>Kimball, Inmon i Data Vault różnią się warstwą integracji.</b> Tam, gdzie czyta narzędzie BI, zwykle i tak stoi model wymiarowy.`
  ],
  glossary: [
    { term: 'Aggregate awareness', def: 'Mechanizm Looker, który dla zapytania wybiera najmniejszą tabelę zagregowaną dającą poprawny wynik, a gdy takiej nie ma, używa tabeli bazowej.' },
    { term: 'ASOF JOIN', def: 'Złączenie w Snowflake, które dla każdego wiersza z lewej strony zwraca jeden wiersz z prawej: najbliższy w czasie według warunku z MATCH_CONDITION.' },
    { term: 'Backfill', def: 'Ponowne przeliczenie historii. Przy tych samych danych i regułach daje ten sam wynik co ładowanie na bieżąco. Gdy poprawia historię, wynik celowo się zmienia.' },
    { term: 'Data mart', def: 'Zbiór tabel przygotowany dla jednego działu albo obszaru raportowania.' },
    { term: 'Data Vault', def: 'Podejście do warstwy integracji z trzema rodzajami tabel: hub (klucz biznesowy), link (relacja między hubami) i satellite (atrybuty opisowe i ich historia).' },
    { term: 'DAX', def: 'Język formuł Power BI. Zapisuje się w nim miary i filtry ról.' },
    { term: 'DirectQuery', def: 'Tryb Power BI, w którym raport pyta źródło w chwili wyświetlenia, zamiast korzystać z zaimportowanych danych.' },
    { term: 'Drill-across', def: 'Zestawienie wyników z kilku tabel faktów: każdą sumuje się osobno do tego samego poziomu wspólnego wymiaru i dopiero te wyniki łączy.' },
    { term: 'Eksploracja (Explore)', def: 'W Looker: punkt startowy zapytania. Widok, który użytkownik może odpytywać, razem ze złączeniami do innych widoków.' },
    { term: 'Fan-out', def: 'Powielenie wiersza przez złączenie, gdy pasuje do niego kilka wierszy po drugiej stronie. Suma miary z powielonego wiersza wychodzi zawyżona.' },
    { term: 'Idempotentny zapis', def: 'Zapis, który uruchomiony drugi raz zostawia ten sam stan, bez duplikatów.' },
    { term: 'Kardynalność relacji', def: 'Informacja, ile wierszy po jednej stronie złączenia pasuje do jednego wiersza po drugiej: jeden do wielu, jeden do jednego, wiele do wielu.' },
    { term: 'Klucz naturalny (natural key)', def: 'Identyfikator nadany przez system źródłowy, rozpoznawany przez biznes, na przykład C-102.' },
    { term: 'Klucz zastępczy (surrogate key)', def: 'Liczba bez znaczenia biznesowego, nadana wierszowi wymiaru przy ładowaniu do hurtowni. To ją przechowuje tabela faktów.' },
    { term: 'LookML', def: 'Język, w którym w Looker opisuje się widoki, wymiary, miary i złączenia. Looker generuje z tego opisu SQL.' },
    { term: 'Miara (measure)', def: 'Liczba, którą się analizuje, na przykład kwota transakcji. W warstwie semantycznej: nazwana definicja z wzorem, filtrem i sposobem agregacji.' },
    { term: 'Miara addytywna', def: 'Miara, którą wolno sumować po każdym wymiarze, o ile kwoty są w zgodnej walucie, a grupy na siebie nie zachodzą. Przykład: kwota transakcji.' },
    { term: 'Miara nieaddytywna', def: 'Miara, której nie wolno sumować po żadnym wymiarze, na przykład odsetek. Trzyma się jej składniki i dzieli na końcu.' },
    { term: 'Miara póładdytywna', def: 'Miara, którą wolno sumować tylko po niektórych wymiarach, typowo po wszystkich oprócz czasu. Przykłady: MRR, saldo.' },
    { term: 'MRR', def: 'Monthly recurring revenue. Suma miesięcznych opłat aktywnych subskrypcji. Subskrypcja roczna za 96 EUR wnosi 8 EUR.' },
    { term: 'Najemca (tenant)', def: 'Jeden z wielu klientów korzystających z tej samej platformy. W przykładzie najemcą jest wydawca.' },
    { term: 'Narastająca migawka (accumulating snapshot)', def: 'Tabela faktów z jednym wierszem na przebieg procesu. Wiersz ma datę każdego etapu i jest uzupełniany, gdy proces do niego dochodzi.' },
    { term: 'Okresowa migawka (periodic snapshot)', def: 'Tabela faktów z jednym wierszem na obiekt na okres, także wtedy, gdy nic się nie wydarzyło. Odpowiada na pytania o stan.' },
    { term: 'Pre-agregacja', def: 'Tabela z wynikiem policzonym z góry dla często zadawanego pytania, na przykład przychód per dzień i wydawca.' },
    { term: 'Przedział ważności', def: 'Okres, w którym obowiązuje wersja wiersza wymiaru: od valid_from włącznie do valid_to bez tego dnia. Przedziały jednego klucza naturalnego nie zachodzą na siebie, luki są dopuszczalne.' },
    { term: 'Row-level security (RLS)', def: 'Reguła, która danemu użytkownikowi odcina wiersze, zanim cokolwiek się policzy.' },
    { term: 'SCD (slowly changing dimension)', def: 'Wymiar, którego atrybuty zmieniają się rzadko i nieregularnie. Typ SCD to sposób zapisu takiej zmiany.' },
    { term: 'Snowflake schema', def: 'Model, w którym wymiar wskazuje kolejny wymiar, na przykład produkt wskazuje wydawcę. Nazwa opisuje kształt, nie hurtownię Snowflake.' },
    { term: 'Spóźniony fakt (late-arriving fact)', def: 'Zdarzenie, które dociera do hurtowni długo po tym, jak zaszło. Dostaje klucz wersji wymiaru z chwili zdarzenia.' },
    { term: 'Spóźniony wymiar (late-arriving dimension)', def: 'Sytuacja, w której fakt przychodzi wcześniej niż opis obiektu, którego dotyczy.' },
    { term: 'Star schema', def: 'Układ z tabelą faktów pośrodku i wymiarami dookoła. Każdy wymiar jest o jedno złączenie od faktu.' },
    { term: 'Symmetric aggregates', def: 'Mechanizm Looker, który chroni sumy i liczniki przed fan-outem. Wymaga unikalnego klucza głównego w każdym widoku i poprawnie podanej relacji.' },
    { term: 'Tabela faktów (fact table)', def: 'Tabela, w której jeden wiersz to jedno mierzalne zdarzenie albo jeden stan. Zawiera klucze do wymiarów i miary.' },
    { term: 'Tabela faktów bez miar (factless fact table)', def: 'Tabela faktów z samymi kluczami. Zapisuje, że coś zaszło albo było możliwe. Liczy się w niej wiersze.' },
    { term: 'Tabela pomostowa (bridge table)', def: 'Tabela pośrednia przy relacji wiele do wielu, na przykład między produktem a kategorią. Sama nie usuwa podwójnego liczenia.' },
    { term: 'Tabela transakcyjna (transaction fact table)', def: 'Tabela faktów z jednym wierszem na zdarzenie. Wiersz powstaje tylko wtedy, gdy coś się wydarzyło.' },
    { term: 'Typ 1', def: 'Zapis zmiany przez nadpisanie wartości. Historia znika, a raporty za zamknięte okresy zmieniają się wstecz.' },
    { term: 'Typ 2', def: 'Zapis zmiany przez dodanie nowego wiersza z nowym kluczem zastępczym i zamknięcie starego datą.' },
    { term: 'Warstwa integracji', def: 'Miejsce, w którym dane z wielu systemów źródłowych łączy się w spójną całość, zanim trafią do raportów.' },
    { term: 'Warstwa semantyczna (semantic layer)', def: 'Opis modelu dla narzędzi i ludzi, między hurtownią a raportami: tabele, relacje i miary zdefiniowane raz.' },
    { term: 'Wiersz zastępczy', def: 'Wiersz wymiaru utworzony dla obiektu, którego opis jeszcze nie dotarł: ze znanym kluczem naturalnym i wartościami „nieznane”.' },
    { term: 'Wymiar (dimension)', def: 'Tabela z opisem: kto, co, kiedy, u kogo. Po wymiarach się filtruje i grupuje.' },
    { term: 'Wymiar wspólny (conformed dimension)', def: 'Wymiar zdefiniowany raz i używany przez wiele tabel faktów, z tymi samymi kolumnami i wartościami.' },
    { term: 'Wymiar zdegenerowany (degenerate dimension)', def: 'Identyfikator bez żadnego opisu, na przykład numer transakcji. Zostaje w tabeli faktów jako zwykła kolumna.' },
    { term: 'Ziarno (grain)', def: 'Odpowiedź na pytanie, co opisuje jeden wiersz tabeli faktów.' },
    { term: 'Ziarno atomowe', def: 'Najbardziej szczegółowy poziom, jaki rejestruje proces, na przykład pojedyncza transakcja.' },
    { term: 'Złączenie punkt-w-czasie (point-in-time join)', def: 'Dobranie do zdarzenia tej wersji wymiaru, która obowiązywała w chwili zdarzenia: klucz naturalny i warunek na daty ważności.' }
  ],
  misconceptions: [
    { myth: 'Star schema wybiera się dla wydajności.', fact: 'Jej główną zaletą jest jednoznaczność: jedno złączenie do każdego wymiaru i jedna definicja każdego opisu. Hurtownia kolumnowa technicznie obsłuży też inne kształty.' },
    { myth: 'Ziarno dobiera się do raportu, który akurat jest potrzebny.', fact: 'Ziarno zagregowane odpowiada na jedno pytanie, a pierwsze nowe wymaga przebudowy. Zaleca się zaczynać od ziarna atomowego, a sumy dokładać dla wydajności.' },
    { myth: 'Zawyżoną sumę naprawia DISTINCT.', fact: 'DISTINCT ukrywa problem przy licznikach. Sumy zostają błędne albo gubią wartości, które naprawdę się powtarzają. Trzeba ustalić, które złączenie powiela wiersze.' },
    { myth: 'Dwie tabele faktów łączy się po wspólnym kluczu.', fact: 'Łączy się je przez wspólne wymiary: każdą agreguje się osobno do tego samego poziomu i zestawia wyniki.' },
    { myth: 'Tabela pomostowa rozwiązuje podwójne liczenie.', fact: 'Rozwiązuje strukturę relacji wiele do wielu. Suma po kategoriach nadal przekracza całość, dopóki nie dodasz wag albo nie przyjmiesz, że wyniki się nie sumują.' },
    { myth: 'Tabela transakcyjna, okresowa migawka i narastająca migawka to trzy warianty do wyboru.', fact: 'Każda odpowiada na inny rodzaj pytania. Tabela transakcyjna i migawka zwykle istnieją obok siebie.' },
    { myth: 'MRR kwartału to suma MRR z trzech miesięcy.', fact: 'MRR jest miarą póładdytywną. Dla kwartału podaje się MRR na koniec kwartału albo średni miesięczny MRR. To dwie różne miary, każda z własną nazwą.' },
    { myth: 'Odsetek dla całości to średnia odsetków z grup.', fact: 'W przykładzie średnia z trzech produktów daje 5,6%, a poprawny wynik to 11,1%. Odsetek liczy się na końcu, z licznika i mianownika.' },
    { myth: 'Typ 2 jest lepszy niż typ 1.', fact: 'To odpowiedź na inne pytanie biznesowe. Ma koszt: większy wymiar, wykrywanie zmian przy ładowaniu i ryzyko fan-outu przy złączeniu bez dat.' },
    { myth: 'Typ SCD wybiera się dla całej tabeli wymiaru.', fact: 'Ustala się go dla atrybutu. W jednym wymiarze literówka w nazwisku może być typem 1, a kraj typem 2.' },
    { myth: 'Skoro wymiar ma historię, raport sam pokaże stan historyczny.', fact: 'Zależy od złączenia. Po samym kluczu naturalnym wiersze się powielają, a z filtrem na bieżący wiersz wychodzi wynik jak w typie 1.' },
    { myth: 'Fakt dostaje wersję wymiaru aktualną w chwili ładowania.', fact: 'Dostaje wersję z chwili zdarzenia. Różnicę widać, gdy wymiar zmieni się między zdarzeniem a ładowaniem, najczęściej przy spóźnionych danych i ponownym przeliczeniu historii.' },
    { myth: 'Fakt bez wiersza w wymiarze trzeba odrzucić albo zapisać z pustym kluczem.', fact: 'Tworzy się wiersz zastępczy z kluczem naturalnym i wartościami „nieznane”, a później się go uzupełnia. Suma jest kompletna od pierwszego dnia.' },
    { myth: 'Błędną transakcję poprawia się przez jej skasowanie albo nadpisanie.', fact: 'W tabeli, do której wiersze się tylko dopisuje, poprawka jest osobnym wierszem korygującym, na przykład zwrotem z ujemną kwotą.' },
    { myth: 'Snapshot dbt zapisuje pełną historię zmian.', fact: 'Zapisuje stan widziany przy każdym uruchomieniu. Zmiany między uruchomieniami przepadają, jeśli źródło samo nie prowadzi historii.' },
    { myth: 'Poprawna hurtownia gwarantuje spójne liczby na dashboardach.', fact: 'Liczby rozjeżdżają się na definicjach miar. Miarę definiuje się raz w warstwie semantycznej, a różne znaczenia dostają różne nazwy.' },
    { myth: 'Całą logikę trzeba trzymać w hurtowni.', fact: 'Miara zależna od kontekstu, na przykład odsetek, policzona z góry dla jednego ziarna jest błędna w każdym innym. Hurtownia dostarcza składniki, a dzieli warstwa semantyczna.' },
    { myth: 'Narzędzie BI samo ochroni przed podwójnym liczeniem.', fact: 'Zabezpieczenia zależą od unikalnych kluczy i poprawnie zadeklarowanych relacji. Narzędzie ufa deklaracji.' },
    { myth: 'RLS w narzędziu BI zabezpiecza dane.', fact: 'Chroni tylko ten kanał. Kto ma dostęp do hurtowni, omija regułę, więc izolację projektuje się także tam.' },
    { myth: 'Pre-agregacja może zastąpić tabelę szczegółową.', fact: 'To optymalizacja dołożona do modelu atomowego. Odpowiada tylko na pytania w swoim ziarnie, a miary takie jak liczba unikalnych klientów się w niej nie zwijają.' },
    { myth: 'Kimball, Inmon i Data Vault to trzy konkurencyjne kształty tabel dla raportu.', fact: 'Różnią się warstwą integracji. Data Vault nie zastępuje modelu wymiarowego w warstwie raportowej.' }
  ],
  sourcesNote:
    'Zasady modelowania pochodzą ze stron Kimball Group, a zachowanie narzędzi z oficjalnej dokumentacji Microsoft, Google Cloud (Looker), dbt, Snowflake i Databricks. Wszystko jest spisane w docs/verified-facts.md, w sekcji „Lekcja: Advanced Data Modeling & Dimensional Architecture”. Strony nie mają numeru wersji, więc obowiązuje data sprawdzenia. Trzy objaśnienia pojęć dopisane w rozdziale (widok i eksploracja w Looker, Power Query) sprawdzono 2026-11-28. Liczby przykładu odtwarza skrypt labs/data_modeling/modeling_sql_check.py (SQLite): sprawdza poprawność wyników SQL na 10 transakcjach, a nie wydajność ani zachowanie konkretnej hurtowni.',
  sources: [
    { label: 'Kimball: Four-Step Design Process', url: 'https://www.kimballgroup.com/data-warehouse-business-intelligence-resources/kimball-techniques/dimensional-modeling-techniques/four-4-step-design-process/' },
    { label: 'Kimball: Grain', url: 'https://www.kimballgroup.com/data-warehouse-business-intelligence-resources/kimball-techniques/dimensional-modeling-techniques/grain/' },
    { label: 'Kimball: Transaction Fact Tables', url: 'https://www.kimballgroup.com/data-warehouse-business-intelligence-resources/kimball-techniques/dimensional-modeling-techniques/transaction-fact-table/' },
    { label: 'Kimball: Periodic Snapshot Fact Tables', url: 'https://www.kimballgroup.com/data-warehouse-business-intelligence-resources/kimball-techniques/dimensional-modeling-techniques/periodic-snapshot-fact-table/' },
    { label: 'Kimball: Accumulating Snapshot Fact Tables', url: 'https://www.kimballgroup.com/data-warehouse-business-intelligence-resources/kimball-techniques/dimensional-modeling-techniques/accumulating-snapshot-fact-table/' },
    { label: 'Kimball: Additive, Semi-Additive, Non-Additive Facts', url: 'https://www.kimballgroup.com/data-warehouse-business-intelligence-resources/kimball-techniques/dimensional-modeling-techniques/additive-semi-additive-non-additive-fact/' },
    { label: 'Kimball: Degenerate Dimensions', url: 'https://www.kimballgroup.com/data-warehouse-business-intelligence-resources/kimball-techniques/dimensional-modeling-techniques/degenerate-dimension/' },
    { label: 'Kimball: Factless Fact Tables', url: 'https://www.kimballgroup.com/data-warehouse-business-intelligence-resources/kimball-techniques/dimensional-modeling-techniques/factless-fact-table/' },
    { label: 'Kimball: Dimension Surrogate Keys', url: 'https://www.kimballgroup.com/data-warehouse-business-intelligence-resources/kimball-techniques/dimensional-modeling-techniques/dimension-surrogate-key/' },
    { label: 'Kimball: Conformed Dimensions', url: 'https://www.kimballgroup.com/data-warehouse-business-intelligence-resources/kimball-techniques/dimensional-modeling-techniques/conformed-dimension/' },
    { label: 'Kimball: Type 1', url: 'https://www.kimballgroup.com/data-warehouse-business-intelligence-resources/kimball-techniques/dimensional-modeling-techniques/type-1/' },
    { label: 'Kimball: Type 2', url: 'https://www.kimballgroup.com/data-warehouse-business-intelligence-resources/kimball-techniques/dimensional-modeling-techniques/type-2/' },
    { label: 'Kimball: Multivalued Dimensions and Bridge Tables', url: 'https://www.kimballgroup.com/data-warehouse-business-intelligence-resources/kimball-techniques/dimensional-modeling-techniques/multivalued-dimension-bridge-table/' },
    { label: 'Kimball: Late Arriving Facts', url: 'https://www.kimballgroup.com/data-warehouse-business-intelligence-resources/kimball-techniques/dimensional-modeling-techniques/late-arriving-fact/' },
    { label: 'Kimball: Late Arriving Dimensions', url: 'https://www.kimballgroup.com/data-warehouse-business-intelligence-resources/kimball-techniques/dimensional-modeling-techniques/late-arriving-dimension/' },
    { label: 'Kimball: Snowflaked Dimensions', url: 'https://www.kimballgroup.com/data-warehouse-business-intelligence-resources/kimball-techniques/dimensional-modeling-techniques/snowflake-dimension/' },
    { label: 'Kimball Group: Differences of Opinion (2004)', url: 'https://www.kimballgroup.com/2004/03/differences-of-opinion/' },
    { label: 'Microsoft Learn: Star schema guidance', url: 'https://learn.microsoft.com/en-us/power-bi/guidance/star-schema' },
    { label: 'Microsoft Learn: Model relationships', url: 'https://learn.microsoft.com/en-us/power-bi/transform-model/desktop-relationships-understand' },
    { label: 'Microsoft Learn: Many-to-many guidance', url: 'https://learn.microsoft.com/en-us/power-bi/guidance/relationships-many-to-many' },
    { label: 'Microsoft Learn: Bi-directional guidance', url: 'https://learn.microsoft.com/en-us/power-bi/guidance/relationships-bidirectional-filtering' },
    { label: 'Microsoft Learn: Row-level security', url: 'https://learn.microsoft.com/en-us/fabric/security/service-admin-row-level-security' },
    { label: 'Microsoft Learn: RLS guidance', url: 'https://learn.microsoft.com/en-us/power-bi/guidance/rls-guidance' },
    { label: 'Microsoft Learn: User-defined aggregations', url: 'https://learn.microsoft.com/en-us/power-bi/transform-model/aggregations-advanced' },
    { label: 'Microsoft Learn: What is Power Query?', url: 'https://learn.microsoft.com/en-us/power-query/power-query-what-is-power-query' },
    { label: 'Looker: Understanding symmetric aggregates', url: 'https://cloud.google.com/looker/docs/best-practices/understanding-symmetric-aggregates' },
    { label: 'Looker: relationship', url: 'https://cloud.google.com/looker/docs/reference/param-explore-join-relationship' },
    { label: 'Looker: access_filter', url: 'https://cloud.google.com/looker/docs/reference/param-explore-access-filter' },
    { label: 'Looker: Aggregate awareness', url: 'https://cloud.google.com/looker/docs/aggregate_awareness' },
    { label: 'Looker: What is LookML', url: 'https://cloud.google.com/looker/docs/what-is-lookml' },
    { label: 'Looker: LookML terms and concepts', url: 'https://cloud.google.com/looker/docs/lookml-terms-and-concepts' },
    { label: 'dbt: Snapshots', url: 'https://docs.getdbt.com/docs/build/snapshots' },
    { label: 'dbt: About MetricFlow', url: 'https://docs.getdbt.com/docs/build/about-metricflow' },
    { label: 'Snowflake: ASOF JOIN', url: 'https://docs.snowflake.com/en/sql-reference/constructs/asof-join' },
    { label: 'Databricks Glossary: Data Vault', url: 'https://www.databricks.com/glossary/data-vault' }
  ]
};

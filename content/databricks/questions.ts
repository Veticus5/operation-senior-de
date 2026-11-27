import type { Question } from '../types';

/**
 * Pytania: platforma Databricks. Zweryfikowane w dokumentacji Databricks i Apache Spark
 * (linki i daty w docs/verified-facts.md). Ograniczenia serverless i nazwy produktów zmieniają się często:
 * przed rozmową warto zajrzeć do podlinkowanych stron.
 */
export const databricksQuestions: Question[] = [
  {
    id: 'databricks-bundles-cicd',
    topicId: 'databricks.bundles',
    area: 'databricks',
    priority: 'P0',
    title: 'Bundles i CI/CD',
    question: {
      pl: 'Jak wdrażasz joby na dev, test i prod?',
      en: 'How do you deploy Databricks jobs across dev, test and prod?'
    },
    answer: {
      pl: 'Definicje jobów trzymam w Gicie i wdrażam je przez bundles. Dziś nazywają się Declarative Automation Bundles, a do marca 2026 Databricks Asset Bundles. Bundle to projekt z plikiem databricks.yml. Plik opisuje zasoby, czyli joby i pipeline\'y, obok kodu. Opisuje też targety, na przykład dev i prod, każdy ze swoim workspace\'em i zmiennymi. Databricks CLI sprawdza bundle i go wdraża. W CI/CD pull request odpala testy i bundle validate. Merge do main wdraża na prod przez service principala, a nie z konta osobistego. Sens jest prosty: joby przechodzą code review i da się je odtworzyć, zamiast być wyklikane w UI.',
      en: 'I keep job definitions in Git and deploy them with bundles. Today they’re called Declarative Automation Bundles. Until March 2026 the name was Databricks Asset Bundles. A bundle is a project with a databricks.yml file. The file describes resources, meaning jobs and pipelines, next to the code. It also describes targets such as dev and prod, each with its own workspace and variables. The Databricks CLI validates the bundle and deploys it. In CI/CD, a pull request runs the tests and bundle validate. A merge to main deploys to prod with a service principal, not a personal account. The point is simple: jobs go through code review and can be recreated, instead of being clicked together in the UI.'
    },
    explain: [
      'Problem: job wyklikany w UI istnieje tylko w jednym workspace, nikt go nie zrecenzował i nie da się go odtworzyć. Bundle zamienia definicję joba w plik w repozytorium. W <code>databricks.yml</code> opisujesz zasoby, czyli joby i pipeline\'y, oraz targety, czyli środowiska: ten sam job, inne parametry dla dev i prod.',
      '<code>databricks bundle validate</code> sprawdza konfigurację, a <code>bundle deploy</code> tworzy lub aktualizuje zasoby w wybranym targecie. W trybie development zasoby dostają prefiks z nazwą użytkownika, a harmonogramy są wstrzymane, więc dwie osoby nie wchodzą sobie w drogę.',
      'Most do dbt: to ten sam pomysł co projekt dbt z targetami w <code>profiles.yml</code> i <code>dbt build</code> uruchamianym w CI. Różnica: dbt wdraża modele SQL do hurtowni, a bundle wdraża zasoby platformy, które dopiero będą coś uruchamiać.',
      'Nazwa: od 16 marca 2026 to Declarative Automation Bundles, wcześniej Databricks Asset Bundles. Według dokumentacji zmiana niczego nie psuje: polecenie CLI i istniejąca konfiguracja zostają bez zmian. Na rozmowie padnie raczej stara nazwa albo skrót DABs.'
    ],
    keywords: ['bundles', 'databricks.yml', 'targets', 'bundle validate', 'service principal', 'development mode'],
    followUps: [
      { q: 'Bundles or Terraform?', a: 'Terraform for infrastructure: workspaces, Unity Catalog, networking. Bundles for project resources such as jobs and pipelines.', pl: 'Infrastruktura kontra zasoby projektu.' },
      { q: 'What does development mode do?', a: 'It adds the user name as a prefix to resources and pauses schedules. So developers don’t get in each other’s way.', pl: 'Prefiks i wstrzymane harmonogramy.' },
      { q: 'How do you test before deploying?', a: 'Transformations are plain functions, tested with pytest on local Spark. After that comes bundle validate and a run on dev.', pl: 'pytest lokalnie, potem dev.' }
    ],
    mistakes: [
      'Używanie tylko starej nazwy, bez wiedzy, że się zmieniła.',
      'Wdrażanie na prod z konta osobistego.',
      'Mylenie bundles z Terraformem.'
    ]
  },
  {
    id: 'databricks-unity-catalog',
    topicId: 'databricks.unity-catalog',
    area: 'databricks',
    priority: 'P1',
    title: 'Unity Catalog',
    question: {
      pl: 'Co to jest Unity Catalog? Czym różni się tabela managed od external?',
      en: 'What is Unity Catalog? Managed versus external tables?'
    },
    answer: {
      pl: 'Unity Catalog to warstwa governance w Databricks: jedno miejsce na nazwy tabel, uprawnienia, lineage i audyt. Jest wspólny dla workspace\'ów podpiętych do tego samego metastore. Każdy obiekt ma trzyczłonową nazwę: catalog, schema, table. Dostęp nadaję SQL-owym GRANT-em, a uprawnienia dziedziczą się w dół. Managed i external różnią się tym, kto opiekuje się plikami. W tabeli managed Unity Catalog zarządza metadanymi i plikami. Po DROP dane są oznaczane do usunięcia, a przez okres odzyskiwania, domyślnie 7 dni, działa jeszcze UNDROP. W tabeli external pilnuje tylko metadanych i dostępu, więc pliki po DROP zostają. Domyślnie wybieram managed. External biorę wtedy, gdy inne systemy muszą sięgać do plików bezpośrednio.',
      en: 'Unity Catalog is the governance layer in Databricks: one place for table names, permissions, lineage and auditing. It’s shared by the workspaces attached to the same metastore. Every object has a three-level name: catalog, schema, table. I grant access with SQL GRANT statements, and privileges are inherited downwards. Managed and external differ in who looks after the files. For a managed table, Unity Catalog manages both the metadata and the files. After a DROP the data is marked for deletion, and UNDROP still works during the recovery window, seven days by default. For an external table it manages only metadata and access, so the files stay after a DROP. I default to managed tables. I use external ones when other systems need direct access to the files.'
    },
    explain: [
      'Bez wspólnego katalogu każdy workspace ma własną listę tabel i własne uprawnienia. Unity Catalog to jedno miejsce wspólne dla workspace\'ów podpiętych do tego samego metastore. W katalogach są schematy, a w schematach tabele, stąd adres <code>catalog.schema.table</code>. W tym samym miejscu są uprawnienia, lineage (z czego powstała tabela) i audyt (kto co zrobił).',
      'Uprawnienia dziedziczą się w dół: GRANT SELECT na schemacie daje dostęp do jego tabel. Żeby przeczytać tabelę, potrzebujesz USE CATALOG, USE SCHEMA i SELECT. W Snowflake odpowiada to USAGE na bazie i schemacie plus SELECT na tabeli. Różnica w nazwach poziomów: catalog w Unity Catalog to mniej więcej database w Snowflake.',
      'Managed kontra external to pytanie, kto odpowiada za pliki. Managed: Unity Catalog wybiera lokalizację i sprząta po DROP. External: Ty wskazujesz ścieżkę, a DROP usuwa tylko wpis w katalogu. Pliki zostają. Część automatów, np. predictive optimization, działa tylko na tabelach managed.'
    ],
    keywords: ['three-level namespace', 'GRANT', 'managed', 'external', 'UNDROP', 'lineage'],
    followUps: [
      { q: 'What do you need to read a table?', a: 'Three privileges: USE CATALOG, USE SCHEMA and SELECT on the table. The two USE privileges alone don’t let me read any data.', pl: 'Jak USAGE + SELECT w Snowflake.' },
      { q: 'How do you restrict rows or columns?', a: 'With row filters and column masks, or dynamic views.', pl: 'Odpowiednik row access i masking policies.' },
      { q: 'What is a volume?', a: 'A Unity Catalog object for files that aren’t tables, such as raw CSV or JSON. The same permission model covers them.', pl: 'Pliki pod governance.' }
    ],
    mistakes: [
      'Mylenie Unity Catalog z Hive metastore.',
      'Brak odpowiedzi, co dzieje się z plikami po DROP.',
      'Pominięcie dziedziczenia uprawnień.'
    ]
  },
  {
    id: 'databricks-structured-streaming',
    topicId: 'databricks.structured-streaming',
    area: 'databricks',
    priority: 'P1',
    title: 'Structured Streaming: checkpoint i watermark',
    question: {
      pl: 'Jak Structured Streaming radzi sobie z awariami? Co to checkpoint i watermark?',
      en: 'How does Structured Streaming achieve fault tolerance? What are checkpoints and watermarks?'
    },
    answer: {
      pl: 'Structured Streaming traktuje stream jak tabelę, która ciągle rośnie. Domyślnie przetwarza ją małymi porcjami, czyli w mikro-batchach. Odporność na awarie daje checkpoint. Zapytanie zapisuje w nim, które offsety źródła objął każdy batch, oraz stan operatorów stanowych. Po awarii startuje z checkpointu i powtarza niedokończony batch. Dlatego wynik końcowy jest exactly-once tylko wtedy, gdy źródło da się odczytać ponownie, a zapis jest transakcyjny albo idempotentny, jak przy tabeli Delta. Watermark to limit spóźnienia liczony w czasie zdarzeń. Zdarzenia w limicie na pewno zostaną przetworzone, późniejsze mogą zostać odrzucone. Watermark pozwala też Sparkowi zamykać okna i czyścić stary stan. To, czy bez niego stan rośnie, zależy od operatora i trybu wyjścia.',
      en: 'Structured Streaming treats a stream as a table that keeps growing. By default it processes it in small batches, called micro-batches. Fault tolerance comes from the checkpoint. There the query records which source offsets each batch covered, plus the state of stateful operators. After a failure it restarts from the checkpoint and runs the unfinished batch again. So the end result is exactly-once only when the source can be read again and the sink is transactional or idempotent, like a Delta table. A watermark is a limit on lateness, measured in event time. Events within the limit are guaranteed to be processed. Later ones may be dropped. The watermark also lets Spark close windows and clean up old state. Whether state keeps growing without one depends on the operator and the output mode.'
    },
    senior: {
      pl: 'Najbliższy odpowiednik w Snowflake to Snowpipe plus Streams i Tasks, czyli też mikro-batch. Offset streamu odpowiada offsetom w checkpoincie. Analogia jest częściowa z dwóch powodów. Checkpoint Sparka trzyma też stan operatorów. A gwarancja dla spóźnionych danych działa tylko w jedną stronę. Zdarzenia w progu watermarku na pewno wejdą do wyniku. O późniejszych dokumentacja mówi tylko, że mogą zostać odrzucone.',
      en: 'The closest thing in Snowflake is Snowpipe plus Streams and Tasks, which is micro-batch as well. A stream offset corresponds to the offsets in a checkpoint. The analogy is partial, for two reasons. A Spark checkpoint also holds operator state. And the late-data guarantee works in one direction only. Events within the watermark are guaranteed to be included. For later ones the docs only say they may be dropped.'
    },
    explain: [
      'Stream to zapytanie, które się nie kończy, więc trzeba umieć je wznowić po awarii. Służy do tego checkpoint. To katalog, w którym zapytanie zapisuje dwie rzeczy. Pierwsza: dokąd doczytało źródło, czyli offsety każdego mikro-batcha. Druga: stan operatorów, np. liczniki okien, które jeszcze się nie zamknęły. Po awarii zapytanie startuje od ostatniego zapisanego punktu i powtarza niedokończony batch.',
      'Stąd biorą się gwarancje. Powtórzony batch zapisze dane drugi raz, chyba że cel sobie z tym poradzi. Exactly-once (każdy rekord w wyniku dokładnie raz) jest więc cechą całego łańcucha: źródło pozwala czytać ponownie od offsetu, a zapis jest transakcyjny albo idempotentny, czyli powtórka niczego nie zmienia. <code>foreachBatch</code> daje według dokumentacji tylko at-least-once. Dopiero MERGE po stałym kluczu albo deduplikacja po <code>batchId</code> sprawia, że powtórka nie szkodzi.',
      'Watermark to próg spóźnienia liczony od najpóźniejszego czasu zdarzenia, jaki Spark do tej pory widział. Gwarancja działa w jedną stronę. Zdarzenia spóźnione mniej niż próg na pewno wejdą do wyniku. Bardziej spóźnione mogą wejść albo zostać odrzucone. Watermark pozwala też usuwać stary stan, ale tylko w trybie wyjścia append albo update. W trybie complete Spark musi trzymać wszystkie agregaty.',
      'Czy stan rośnie bez watermarku, zależy od operatora. Zapytanie bez stanu, np. sam filter i select, nie trzyma nic. Agregacja trzyma jeden wpis na grupę, więc rośnie tak, jak liczba grup. Deduplikacja i join dwóch streamów bez watermarku muszą pamiętać całą historię, więc tam stan rośnie bez końca.'
    ],
    keywords: ['checkpoint', 'offsets', 'watermark', 'exactly-once', 'Auto Loader', 'availableNow', 'foreachBatch'],
    followUps: [
      { q: 'Which triggers do you know?', a: 'processingTime for a fixed interval, and availableNow to process everything that is waiting and then stop.', pl: 'Databricks serverless: availableNow (Once działa, ale jest przestarzałe). Interwał czasowy i trigger domyślny nie są obsługiwane.' },
      { q: 'What is Auto Loader?', a: 'It’s the cloudFiles source. It finds new files in storage incrementally, so each run picks up only what arrived. It also handles schema inference and schema evolution.', pl: 'Przyrostowe wczytywanie plików.' },
      { q: 'How do you upsert from a stream?', a: 'With foreachBatch and a MERGE inside. On its own foreachBatch gives only at-least-once, so a batch can run twice. That’s why the MERGE has to be idempotent: a stable key and deduplication within the batch.', pl: 'foreachBatch + MERGE. Sam foreachBatch to at-least-once.' },
      { q: 'What happens to late data?', a: "Events that are late by less than the watermark delay are guaranteed to be included. Later ones are not guaranteed to be dropped: they may or may not make it into the result, so I don't rely on either outcome.", pl: 'Gwarancja jest jednostronna.' },
      { q: 'Does state always grow without a watermark?', a: 'It depends on the operator. A stateless query keeps nothing. An aggregation keeps one entry per group, so it grows with the number of groups. Deduplication and stream-stream joins without a watermark have to keep all past input.', pl: 'Zależy od operatora i trybu wyjścia. W trybie complete watermark i tak nie czyści stanu.' }
    ],
    mistakes: [
      'Obiecywanie exactly-once bez warunków po stronie źródła i zapisu.',
      'Mylenie checkpointu streamu z checkpoint() na DataFrame.',
      'Twierdzenie, że bez watermarku stan zawsze rośnie bez końca. To zależy od operatora i trybu wyjścia.',
      'Mówienie, że spóźnione dane „są odrzucane". Dokumentacja gwarantuje tylko przyjęcie danych w progu.',
      'Przedstawianie mikro-batcha w hurtowni jako doświadczenia ze streamingiem na Kafce.'
    ]
  },
  {
    id: 'databricks-beyond-spark',
    topicId: 'databricks.platform',
    area: 'databricks',
    priority: 'P0',
    title: 'Databricks ponad Sparka',
    question: {
      pl: 'Co Databricks daje ponad samego Apache Sparka?',
      en: 'What does Databricks give you beyond Apache Spark itself?'
    },
    answer: {
      pl: 'Spark to silnik, który liczy. Databricks to platforma dookoła niego. Wymieniłbym pięć rzeczy. Po pierwsze Delta Lake jako domyślny format tabel. Daje plikom w object storage transakcje, wersje i MERGE. Po drugie zarządzany compute: serverless albo klasyczne klastry dla jobów i notebooków oraz SQL warehouses dla BI, z silnikiem Photon. Po trzecie Unity Catalog: jedno miejsce na katalogi, uprawnienia, lineage i audyt, wspólne dla workspace\'ów na tym samym metastore. Po czwarte Lakeflow, czyli pobieranie danych, deklaratywne pipeline\'y i orkiestracja jobów. Po piąte sposób wdrażania: bundles, Git folders i CI/CD. W porównaniu z własnym Sparkiem dostaję więc tabele z transakcjami, governance i operacje jako jeden produkt. W porównaniu z hurtownią taką jak Snowflake dane zostają w otwartym formacie w moim magazynie. Mam więcej kontroli i więcej odpowiedzialności.',
      en: 'Spark is the engine that does the computing. Databricks is the platform around it. I’d name five things. First, Delta Lake as the default table format. It gives files in object storage transactions, versions and MERGE. Second, managed compute: serverless or classic clusters for jobs and notebooks, and SQL warehouses for BI, with the Photon engine. Third, Unity Catalog: one place for catalogs, permissions, lineage and auditing, shared by workspaces on the same metastore. Fourth, Lakeflow for ingestion, declarative pipelines and job orchestration. Fifth, a way to deploy: bundles, Git folders and CI/CD. So compared to running Spark myself, I get transactional tables, governance and operations as one product. Compared to a warehouse like Snowflake, the data stays in an open format in my own storage. I get more control and more responsibility.'
    },
    senior: {
      pl: 'W architekturze rozdzieliłbym dwie części. Control plane to usługi, którymi Databricks zarządza na swoim koncie. Compute plane to maszyny, które liczą: serverless działa na koncie Databricks, klasyczny na moim koncie chmurowym. W klasycznym workspace pliki tabel leżą w moim object storage niezależnie od tego wyboru. Szczegóły zależą od chmury, więc sprawdziłbym je dla tej, której używamy. To zwykle pierwsze pytanie zespołu bezpieczeństwa.',
      en: 'In the architecture I’d separate two parts. The control plane is the set of services Databricks runs in its own account. The compute plane is the machines that process data: serverless runs in the Databricks account, classic runs in my cloud account. In a classic workspace the table files sit in my object storage regardless of that choice. Details differ by cloud, so I’d check them for the one we use. That’s usually the first question a security team asks.'
    },
    explain: [
      'Sam Spark odpowiada na pytanie „jak policzyć zapytanie na wielu maszynach”. Nie odpowiada na pytania, które w hurtowni załatwia za Ciebie usługa. Gdzie trwale leżą tabele i co pilnuje, żeby były spójne? Kto może je czytać? Co uruchamia job w nocy i ponawia go po błędzie? Jak kod trafia z repozytorium na produkcję?',
      'Databricks składa te odpowiedzi w jedną platformę. Tabele to pliki w otwartym formacie Delta Lake w object storage, z logiem transakcyjnym. Compute, czyli maszyny, które liczą, to Spark i Photon podawane na kilka sposobów: SQL warehouse do SQL i BI, compute jobów i notebooków do kodu, pipeline\'y do przetwarzania deklaratywnego. Unity Catalog trzyma nazwy obiektów i uprawnienia w jednym miejscu dla workspace\'ów podpiętych do tego samego metastore.',
      'Dokumentacja nazywa ten model lakehouse: system zarządzania danymi, który łączy zalety data lake i hurtowni. Praktyczny skutek dla kogoś, kto zna Snowflake: SQL warehouse zachowuje się jak virtual warehouse, ale pod spodem pliki są Twoje. Możesz je czytać innym silnikiem, ale też odpowiadasz za układ danych i retencję, chyba że oddasz to platformie przez tabele managed.',
      'Na rozmowie warto unikać dwóch skrajności: „Databricks to hostowany Spark” (pomija governance, format tabel i orkiestrację) oraz „Databricks to to samo co Snowflake” (pomija to, że storage jest otwarty, a compute to nie tylko SQL).'
    ],
    keywords: ['lakehouse', 'Delta Lake', 'Unity Catalog', 'SQL warehouse', 'serverless', 'Lakeflow', 'Photon', 'control plane'],
    followUps: [
      { q: 'What is the difference between the control plane and the compute plane?', a: 'The control plane is the set of services Databricks runs in its own account: the web application, the job scheduler, Unity Catalog. The compute plane is where data is processed. Serverless compute runs in the Databricks account, classic compute runs in my cloud account.', pl: 'Control plane na koncie Databricks. Compute: serverless u Databricks, classic na Twoim koncie.' },
      { q: 'When would you use a SQL warehouse instead of a cluster?', a: 'For SQL work: BI dashboards, ad hoc queries, dbt. A serverless one starts fast, and it scales out when many queries run at once. For Python jobs or notebooks I need jobs or notebook compute, because a SQL warehouse only runs SQL.', pl: 'SQL warehouse tylko do SQL. Kod w Pythonie wymaga compute jobów albo notebooków.' },
      { q: 'What does serverless change for you as an engineer?', a: 'I stop choosing instance types and runtime versions, and startup is fast. The price is less control: no Spark UI, only Spark Connect APIs, and very few Spark settings I can change.', pl: 'Mniej konfiguracji, mniej kontroli. Dane leżą tam, gdzie leżały.' },
      { q: 'Is the data locked into Databricks?', a: 'The format is open: the tables are Parquet files with a Delta log in object storage. But whether another engine can read a given table depends on the table features it uses, the catalog integration and permissions. So I’d check that instead of assuming it. And access should go through Unity Catalog, not directly to the bucket.', pl: 'Format jest otwarty, ale odczyt innym silnikiem zależy od funkcji tabeli, katalogu i uprawnień.' }
    ],
    mistakes: [
      'Sprowadzanie Databricks do „notebooków ze Sparkiem”.',
      'Twierdzenie, że serverless oznacza przechowywanie danych przez Databricks. Serverless dotyczy compute.',
      'Mylenie SQL warehouse z klastrem ogólnego przeznaczenia.',
      'Wymienianie produktów bez powiedzenia, jaki problem każdy rozwiązuje.'
    ]
  },
  {
    id: 'databricks-snowflake-fabric-choice',
    topicId: 'databricks.platform-choice',
    area: 'databricks',
    priority: 'P1',
    title: 'Snowflake, Databricks czy Fabric',
    question: {
      pl: 'Kiedy wybrałbyś Snowflake, kiedy Databricks, a kiedy Microsoft Fabric?',
      en: 'When would you choose Snowflake, Databricks or Microsoft Fabric?'
    },
    answer: {
      pl: 'Zaczynam od rodzaju pracy i zespołu, a nie od produktu. Snowflake pasuje najlepiej, gdy praca to głównie SQL na danych strukturalnych i chcę hurtowni, w której prawie nie ma czego utrzymywać. Databricks pasuje, gdy potrzebuję inżynierii w kodzie, streamingu albo uczenia maszynowego na tych samych danych i chcę je mieć w otwartym formacie we własnym magazynie. Ceną jest więcej decyzji o compute i układzie tabel. Fabric pasuje firmie zbudowanej wokół Microsoftu i Power BI, która chce jednego SaaS od pobrania danych do raportu. Wszystkie trzy obsługują w jakimś zakresie otwarte formaty tabel, więc da się je łączyć. Drugą platformę dokładam jednak tylko wtedy, gdy uzasadnia to potrzeba biznesowa. Przed rekomendacją sprawdziłbym też istniejące umowy, umiejętności zespołu i koszty.',
      en: 'I start from the workload and the team, not from the product. Snowflake fits best when the work is mostly SQL on structured data and I want a warehouse with very little to operate. Databricks fits when I need engineering in code, streaming or machine learning on the same data, and I want that data in an open format in my own storage. The price is more decisions about compute and table layout. Fabric fits a company built around Microsoft and Power BI that wants one SaaS from ingestion to reports. All three support open table formats to some degree, so I can combine them. But I add a second platform only when there’s a clear business need. Before recommending anything, I’d also check existing contracts, team skills and cost.'
    },
    explain: [
      'To pytanie sprawdza sposób myślenia, a nie znajomość cenników. Wszystkie trzy platformy rozdzielają storage od compute i wszystkie obsłużą typowy pipeline analityczny. Różnią się tym, od czego zaczynały, i tym, ile pracy oddajesz usłudze.',
      'Snowflake zaczyna od hurtowni: dane domyślnie leżą w magazynie zarządzanym przez usługę, a Ty widzisz SQL. Databricks zaczyna od plików w otwartym formacie i silnika ogólnego przeznaczenia, do którego dołożono SQL warehouses i governance. Fabric zaczyna od Power BI i jednego magazynu OneLake, wokół którego stoją silniki: Spark, Warehouse z T-SQL i narzędzia do integracji.',
      'Dobra odpowiedź przechodzi przez kilka pytań. Jaka to praca: sam SQL, kod, streaming, ML? Kto będzie tym pracował: analitycy, inżynierowie, obie grupy? Co firma już ma i za co płaci? Ile kontroli potrzeba nad compute i formatem, a ile obsługi zespół udźwignie? Dopiero z tego wynika nazwa.',
      'Wybór nie musi być ostateczny. Snowflake dokumentuje tabele Apache Iceberg i odczyt plików Delta, Databricks potrafi wystawić tabelę Delta klientom Iceberg, a OneLake przechowuje tabele w Delta albo Iceberg. Dane można trzymać raz i czytać dwoma silnikami. Czy drugi silnik przeczyta konkretną tabelę, zależy od funkcji tabeli, integracji katalogów i uprawnień. Ceną jest większa złożoność: dwa katalogi i dwa modele uprawnień.'
    ],
    keywords: ['workload', 'open table format', 'Iceberg', 'OneLake', 'Direct Lake', 'serverless', 'total cost'],
    followUps: [
      { q: 'A company already runs Snowflake and wants to add machine learning. Do they have to migrate?', a: 'No. And I wouldn’t add a second platform by default either. First I’d ask what the team really needs, and whether the Python and ML tools Snowflake already has cover it. If there’s a real need for Spark, I’d add a second engine and share data through an open table format, instead of moving a working warehouse. The cost is two permission models and two bills.', pl: 'Nie migrować. Najpierw opcje ML w Snowflake, drugi silnik tylko przy realnej potrzebie.' },
      { q: 'What is the main architectural difference between Snowflake and Databricks?', a: 'Who owns the storage layer. In Snowflake the service manages the files and I only see SQL. In Databricks, tables are open-format files in object storage. Other engines can read them if they support the table features and have access. And layout and retention become my decisions, unless I use managed tables.', pl: 'Kto zarządza plikami: usługa czy Ty.' },
      { q: 'How do Fabric and Databricks fit together?', a: 'Both store tables as Delta in object storage, so they connect at the data level. Fabric can expose Unity Catalog tables through shortcuts without copying, and Power BI can read Delta tables directly with Direct Lake.', pl: 'Punkt styku to tabela Delta. Częściej się uzupełniają, niż wykluczają.' },
      { q: 'What is the difference between a Fabric Lakehouse and a Fabric Warehouse?', a: 'Both keep data as Delta in OneLake. A Lakehouse is written with Spark and exposes a read-only SQL endpoint. A Warehouse is full T-SQL with writes and multi-table transactions.', pl: 'Te same dane i format, inny silnik zapisu.' }
    ],
    mistakes: [
      'Wskazanie jednej platformy jako „najlepszej” bez pytania o rodzaj pracy i zespół.',
      'Opisywanie Snowflake jako zamkniętego bez wzmianki o tabelach Iceberg, a Databricks jako „tylko dla Sparka” bez SQL warehouses.',
      'Traktowanie wyboru jako „albo jedna, albo druga”, gdy otwarte formaty pozwalają łączyć silniki.',
      'Mylenie Fabric z samym Power BI albo z Azure Databricks.',
      'Proponowanie drugiej platformy „dla ML” bez sprawdzenia, co potrafi obecna i czy jest potrzeba biznesowa.'
    ]
  }
];

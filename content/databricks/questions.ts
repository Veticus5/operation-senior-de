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
      pl: 'Używam Declarative Automation Bundles, które do marca 2026 nazywały się Databricks Asset Bundles. Bundle to projekt w Gicie z plikiem databricks.yml. Plik deklaruje zasoby, czyli joby i pipeline\'y, obok kodu, oraz targety takie jak dev i prod, każdy ze swoim workspace\'em i zmiennymi. Databricks CLI waliduje bundle i go wdraża. W CI/CD pull request odpala testy i bundle validate, a merge do main wdraża na prod przez service principala, nie z konta osobistego. Sedno jest takie, że joby przechodzą code review i są powtarzalne, zamiast być wyklikane w UI.',
      en: 'I use Declarative Automation Bundles, which were called Databricks Asset Bundles until March 2026. A bundle is a project in Git with a databricks.yml file. It declares resources, meaning jobs and pipelines, next to the code, and targets such as dev and prod, each with its own workspace and variables. The Databricks CLI validates and deploys the bundle. In CI/CD a pull request runs tests and bundle validate, and a merge to main deploys to prod with a service principal, not a personal account. The point is that jobs go through code review and are reproducible instead of being clicked together in the UI.'
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
      { q: 'What does development mode do?', a: 'It prefixes resources with the user name and pauses schedules, so developers do not collide.', pl: 'Prefiks i wstrzymane harmonogramy.' },
      { q: 'How do you test before deploying?', a: 'Transformations are plain functions tested with pytest on local Spark, then bundle validate and a run on dev.', pl: 'pytest lokalnie, potem dev.' }
    ],
    mistakes: [
      'Używanie wyłącznie starej nazwy bez świadomości zmiany.',
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
      pl: 'Unity Catalog to warstwa governance wspólna dla wielu workspace\'ów. Daje trójpoziomowy namespace, czyli catalog, schema, table, oraz centralne uprawnienia, lineage i audyt. Dostęp nadaję SQL-owym GRANT-em, a uprawnienia dziedziczą się w dół. W tabeli managed Unity Catalog zarządza metadanymi i plikami: po DROP dane są oznaczane do usunięcia, a przez okres odzyskiwania, domyślnie 7 dni, działa jeszcze UNDROP. W tabeli external pilnuje tylko metadanych i dostępu, a pliki po DROP zostają. Domyślnie wybieram managed, a external wtedy, gdy inne systemy muszą sięgać do plików bezpośrednio.',
      en: 'Unity Catalog is the governance layer shared across workspaces. It gives a three-level namespace, catalog, schema, table, and central permissions, lineage and auditing. I grant access with SQL GRANT statements, and privileges are inherited downwards. For a managed table Unity Catalog manages both metadata and files: after a DROP the data is marked for deletion, and UNDROP still works during the recovery window, seven days by default. For an external table it manages only metadata and access, and the files stay after a DROP. I default to managed tables and use external ones when other systems need direct access to the files.'
    },
    explain: [
      'Bez wspólnego katalogu każdy workspace ma własną listę tabel i własne uprawnienia. Unity Catalog to jedno miejsce ponad workspace\'ami: katalogi, w nich schematy, w nich tabele, czyli adres <code>catalog.schema.table</code>. Do tego uprawnienia, lineage i audyt w jednym miejscu.',
      'Uprawnienia dziedziczą się w dół: GRANT SELECT na schemacie daje dostęp do jego tabel. Żeby przeczytać tabelę, potrzebujesz USE CATALOG, USE SCHEMA i SELECT. W Snowflake odpowiada to USAGE na bazie i schemacie plus SELECT na tabeli. Różnica w nazwach poziomów: catalog w Unity Catalog to mniej więcej database w Snowflake.',
      'Managed kontra external to pytanie, kto odpowiada za pliki. Managed: Unity Catalog wybiera lokalizację i sprząta po DROP. External: Ty wskazujesz ścieżkę, a DROP usuwa tylko wpis w katalogu, pliki zostają. Część automatyki, np. predictive optimization, działa tylko na tabelach managed.'
    ],
    keywords: ['three-level namespace', 'GRANT', 'managed', 'external', 'UNDROP', 'lineage'],
    followUps: [
      { q: 'What do you need to read a table?', a: 'USE CATALOG, USE SCHEMA and SELECT on the table.', pl: 'Jak USAGE + SELECT w Snowflake.' },
      { q: 'How do you restrict rows or columns?', a: 'With row filters and column masks, or dynamic views.', pl: 'Odpowiednik row access i masking policies.' },
      { q: 'What is a volume?', a: 'A Unity Catalog object for files that are not tables, such as raw CSV or JSON.', pl: 'Pliki pod governance.' }
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
      pl: 'Structured Streaming traktuje stream jak tabelę, która ciągle rośnie, i domyślnie przetwarza ją w mikro-batchach. Odporność na awarie daje checkpoint: zapytanie zapisuje w nim, jakie offsety źródła objął każdy batch, oraz stan operatorów stanowych. Po awarii startuje z checkpointu i powtarza niedokończony batch. Dlatego wynik końcowy jest exactly-once tylko wtedy, gdy źródło da się odczytać ponownie, a zapis jest transakcyjny albo idempotentny, jak przy tabeli Delta. Watermark to próg spóźnienia liczony w czasie zdarzeń: zdarzenia mieszczące się w progu na pewno zostaną przetworzone, późniejsze mogą zostać odrzucone. Pozwala też Sparkowi zamykać okna i czyścić stary stan. To, czy bez niego stan rośnie, zależy od operatora i trybu wyjścia.',
      en: 'Structured Streaming treats a stream as a table that keeps growing and, by default, processes it in micro-batches. Fault tolerance comes from the checkpoint: the query records which source offsets each batch covered, and the state of stateful operators. After a failure it restarts from the checkpoint and re-runs the unfinished batch. So the end result is exactly-once only when the source can be replayed and the sink is transactional or idempotent, as with a Delta table. A watermark is a lateness threshold in event time: events within it are guaranteed to be processed, later ones may be dropped. It also lets Spark finalize windows and clean up old state. Whether state keeps growing without one depends on the operator and the output mode.'
    },
    senior: {
      pl: 'Najbliższy odpowiednik w Snowflake to Snowpipe plus Streams i Tasks, czyli też mikro-batch. Offset streamu odpowiada offsetom w checkpoincie. Analogia jest częściowa: checkpoint Sparka trzyma też stan operatorów, a gwarancja dla spóźnionych danych jest jednostronna. Zdarzenia w progu watermarku na pewno wejdą do wyniku, a o późniejszych dokumentacja mówi tylko, że mogą zostać odrzucone.',
      en: 'The closest Snowflake counterpart is Snowpipe plus Streams and Tasks, which is micro-batch as well. A stream offset corresponds to the offsets in a checkpoint. The analogy is partial: a Spark checkpoint also holds operator state, and the late-data guarantee is one-sided. Events within the watermark are guaranteed to be included, while for later ones the docs only say they may be dropped.'
    },
    explain: [
      'Stream to zapytanie, które się nie kończy, więc trzeba umieć je wznowić. Checkpoint to katalog, w którym zapytanie zapisuje dwie rzeczy: dokąd doczytało źródło (offsety każdego mikro-batcha) i stan operatorów, np. liczniki okien, które jeszcze się nie zamknęły. Po awarii startuje od ostatniego zapisanego punktu i powtarza niedokończony batch.',
      'Stąd biorą się gwarancje. Powtórzony batch zapisze dane drugi raz, chyba że cel to wytrzyma. Exactly-once jest więc cechą całego łańcucha: źródło pozwala czytać ponownie od offsetu, a zapis jest transakcyjny albo idempotentny. <code>foreachBatch</code> daje według dokumentacji tylko at-least-once. Dopiero MERGE po stałym kluczu albo deduplikacja po <code>batchId</code> sprawia, że powtórka nie szkodzi.',
      'Watermark to próg spóźnienia liczony od najpóźniejszego czasu zdarzenia, jaki Spark do tej pory widział. Gwarancja jest jednostronna: zdarzenia spóźnione mniej niż próg na pewno wejdą do wyniku, a bardziej spóźnione mogą wejść albo zostać odrzucone. Watermark pozwala też usuwać stary stan, ale tylko w trybie wyjścia append albo update. W trybie complete Spark musi trzymać wszystkie agregaty.',
      'Czy stan rośnie bez watermarku, zależy od operatora. Zapytanie bez stanu, np. sam filter i select, nie trzyma nic. Agregacja trzyma jeden wpis na grupę, więc rośnie tak, jak liczba grup. Deduplikacja i join dwóch streamów bez watermarku muszą pamiętać całą historię, więc tam stan rośnie bez końca.'
    ],
    keywords: ['checkpoint', 'offsets', 'watermark', 'exactly-once', 'Auto Loader', 'availableNow', 'foreachBatch'],
    followUps: [
      { q: 'Which triggers do you know?', a: 'processingTime for a fixed interval, and availableNow to process everything that is waiting and then stop.', pl: 'Databricks serverless: availableNow (Once działa, ale jest przestarzałe). Interwał czasowy i trigger domyślny nie są obsługiwane.' },
      { q: 'What is Auto Loader?', a: 'The cloudFiles source. It incrementally discovers new files in storage and handles schema inference and evolution.', pl: 'Przyrostowe wczytywanie plików.' },
      { q: 'How do you upsert from a stream?', a: 'With foreachBatch and a MERGE inside. foreachBatch gives only at-least-once on its own, so the MERGE has to be idempotent: a stable key and deduplication within the batch.', pl: 'foreachBatch + MERGE. Sam foreachBatch to at-least-once.' },
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
      pl: 'Spark to silnik wykonania, a Databricks to platforma dookoła niego. Wymieniłbym pięć rzeczy. Po pierwsze Delta Lake jako domyślny format tabel, który daje plikom w object storage transakcje, wersje i MERGE. Po drugie zarządzany compute: serverless albo klasyczne klastry dla jobów i notebooków oraz SQL warehouses dla BI, z silnikiem Photon. Po trzecie Unity Catalog: jedno miejsce na katalogi, uprawnienia, lineage i audyt ponad workspace\'ami. Po czwarte Lakeflow, czyli pobieranie danych, deklaratywne pipeline\'y i orkiestracja jobów. Po piąte sposób wdrażania: bundles, Git folders i CI/CD. W porównaniu z własnym Sparkiem dostaję więc semantykę tabel, governance i operacje jako jeden produkt. W porównaniu z hurtownią taką jak Snowflake dane zostają w otwartym formacie w moim magazynie, a ja mam więcej kontroli i więcej odpowiedzialności.',
      en: 'Spark is the execution engine; Databricks is the platform around it. I would name five things. First, Delta Lake as the default table format, which gives files in object storage transactions, versions and MERGE. Second, managed compute: serverless or classic clusters for jobs and notebooks, and SQL warehouses for BI, with the Photon engine. Third, Unity Catalog: one place for catalogs, permissions, lineage and auditing across workspaces. Fourth, Lakeflow for ingestion, declarative pipelines and job orchestration. Fifth, a deployment story: bundles, Git folders and CI/CD. So compared to running Spark myself, I get table semantics, governance and operations as one product. Compared to a warehouse like Snowflake, the data stays in an open format in my own storage, and I keep more control and more responsibility.'
    },
    senior: {
      pl: 'Architektonicznie rozdzieliłbym control plane, który zawsze jest po stronie Databricks, od compute plane: serverless działa na koncie Databricks, klasyczny na moim koncie chmurowym. Pliki tabel leżą w object storage niezależnie od tego wyboru. To zwykle pierwsze pytanie zespołu bezpieczeństwa.',
      en: 'Architecturally I would separate the control plane, which is always on the Databricks side, from the compute plane: serverless runs in the Databricks account, classic runs in my cloud account. Table files sit in object storage regardless of that choice. That is usually the first question a security team asks.'
    },
    explain: [
      'Sam Spark odpowiada na pytanie „jak policzyć zapytanie na wielu maszynach”. Nie odpowiada na pytania, które w hurtowni rozwiązuje usługa: gdzie trwale leżą tabele i co gwarantuje ich spójność, kto może je czytać, co uruchamia job w nocy i ponawia go po błędzie, jak kod trafia z repozytorium na produkcję.',
      'Databricks składa te odpowiedzi w jedną platformę. Tabele to pliki w otwartym formacie Delta Lake w object storage, z logiem transakcyjnym. Compute to Spark i Photon podawane na kilka sposobów: SQL warehouse do SQL i BI, compute jobów i notebooków do kodu, pipeline\'y do przetwarzania deklaratywnego. Unity Catalog trzyma nazwy obiektów i uprawnienia w jednym miejscu dla wszystkich workspace\'ów.',
      'Dokumentacja nazywa ten model lakehouse: system zarządzania danymi, który łączy zalety data lake i hurtowni. Praktyczny skutek dla kogoś, kto zna Snowflake: SQL warehouse zachowuje się jak virtual warehouse, ale pod spodem pliki są Twoje. Możesz je czytać innym silnikiem, ale też odpowiadasz za układ danych i retencję, chyba że oddasz to platformie przez tabele managed.',
      'Na rozmowie warto unikać dwóch skrajności: „Databricks to hostowany Spark” (pomija governance, format tabel i orkiestrację) oraz „Databricks to to samo co Snowflake” (pomija to, że storage jest otwarty, a compute to nie tylko SQL).'
    ],
    keywords: ['lakehouse', 'Delta Lake', 'Unity Catalog', 'SQL warehouse', 'serverless', 'Lakeflow', 'Photon', 'control plane'],
    followUps: [
      { q: 'What is the difference between the control plane and the compute plane?', a: 'The control plane is the set of services Databricks runs in its own account: the web application, the job scheduler, Unity Catalog. The compute plane is where data is processed. Serverless compute runs in the Databricks account, classic compute runs in my cloud account.', pl: 'Control plane zawsze u Databricks. Compute: serverless u Databricks, classic u Ciebie.' },
      { q: 'When would you use a SQL warehouse instead of a cluster?', a: 'For SQL workloads: BI dashboards, ad hoc queries, dbt. It starts fast when serverless and scales for concurrency. For Python jobs or notebooks I need jobs or notebook compute, because a SQL warehouse only runs SQL.', pl: 'SQL warehouse tylko do SQL. Kod w Pythonie wymaga compute jobów albo notebooków.' },
      { q: 'What does serverless change for you as an engineer?', a: 'I stop choosing instance types and runtime versions, and startup is fast. The trade-off is less control: no Spark UI, only Spark Connect APIs and very few Spark settings I can change.', pl: 'Mniej konfiguracji, mniej kontroli. Dane leżą tam, gdzie leżały.' },
      { q: 'Is the data locked into Databricks?', a: 'The tables are Parquet files with a Delta log in object storage, which is an open format other engines can read. What I would check is governance: access should go through Unity Catalog, not directly to the bucket.', pl: 'Format jest otwarty. Pilnować trzeba dostępu do magazynu.' }
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
      pl: 'Zaczynam od obciążenia i zespołu, a nie od produktu. Snowflake pasuje najlepiej, gdy praca to głównie SQL na danych strukturalnych i chcę hurtowni, w której prawie nie ma czego utrzymywać. Databricks pasuje, gdy potrzebuję inżynierii w kodzie, streamingu albo uczenia maszynowego na tych samych danych i chcę mieć dane w otwartym formacie we własnym magazynie, godząc się na więcej decyzji o compute i układzie tabel. Fabric pasuje organizacji zbudowanej wokół Microsoftu i Power BI, która chce jednego SaaS od pobrania danych do raportu. W praktyce te platformy się nakładają i wszystkie trzy czytają dziś otwarte formaty tabel, więc odpowiedzią często jest połączenie: na przykład Databricks do inżynierii, a hurtownia albo Power BI do serwowania. Przed rekomendacją sprawdziłbym też istniejące umowy, umiejętności zespołu i koszty.',
      en: 'I start from the workload and the team, not from the product. Snowflake fits best when the work is mostly SQL on structured data and I want a warehouse with very little to operate. Databricks fits when I need code-first engineering, streaming or machine learning on the same data, and I want the data in an open format in my own storage, accepting more decisions about compute and table layout. Fabric fits an organization built around Microsoft and Power BI that wants one SaaS from ingestion to reports. In practice these platforms overlap, and all three read open table formats today, so the answer is often a combination: for example Databricks for engineering and a warehouse or Power BI for serving. Before recommending anything I would also check existing contracts, team skills and cost.'
    },
    explain: [
      'To pytanie sprawdza sposób myślenia, a nie znajomość cenników. Wszystkie trzy platformy rozdzielają storage od compute i wszystkie obsłużą typowy pipeline analityczny. Różnią się punktem wyjścia i tym, ile oddajesz usłudze.',
      'Snowflake zaczyna od hurtowni: dane domyślnie leżą w magazynie zarządzanym przez usługę, a Ty widzisz SQL. Databricks zaczyna od plików w otwartym formacie i silnika ogólnego przeznaczenia, do którego dołożono SQL warehouses i governance. Fabric zaczyna od Power BI i jednego magazynu OneLake, wokół którego stoją silniki: Spark, Warehouse z T-SQL i narzędzia do integracji.',
      'Dobra odpowiedź przechodzi przez kilka pytań. Jakie obciążenia: sam SQL, kod, streaming, ML? Kto będzie tym pracował: analitycy, inżynierowie, obie grupy? Co firma już ma i za co płaci? Ile kontroli potrzeba nad compute i formatem, a ile obsługi zespół udźwignie? Dopiero z tego wynika nazwa.',
      'Wybór nie musi być ostateczny. Snowflake dokumentuje tabele Apache Iceberg i odczyt plików Delta, Databricks potrafi wystawić tabelę Delta klientom Iceberg, a OneLake przechowuje tabele w Delta albo Iceberg. Dane można trzymać raz i czytać dwoma silnikami. Ceną jest złożoność: dwa katalogi i dwa modele uprawnień.'
    ],
    keywords: ['workload', 'open table format', 'Iceberg', 'OneLake', 'Direct Lake', 'serverless', 'total cost'],
    followUps: [
      { q: 'A company already runs Snowflake and wants to add machine learning. Do they have to migrate?', a: 'No. I would add a second engine for the new workload and share data through an open table format rather than move a working warehouse. The cost is running two platforms: two permission models and two bills.', pl: 'Dołożyć silnik, nie migrować działającej hurtowni.' },
      { q: 'What is the main architectural difference between Snowflake and Databricks?', a: 'Who owns the storage layer. In Snowflake the service manages the files and I only see SQL. In Databricks tables are open-format files in object storage, so other engines can read them, and layout and retention become my decisions unless I use managed tables.', pl: 'Kto zarządza plikami: usługa czy Ty.' },
      { q: 'How do Fabric and Databricks fit together?', a: 'Both store tables as Delta in object storage, so they connect at the data level. Fabric can expose Unity Catalog tables through shortcuts without copying, and Power BI can read Delta tables directly with Direct Lake.', pl: 'Punkt styku to tabela Delta. Częściej się uzupełniają, niż wykluczają.' },
      { q: 'What is the difference between a Fabric Lakehouse and a Fabric Warehouse?', a: 'Both keep data as Delta in OneLake. A Lakehouse is written with Spark and exposes a read-only SQL endpoint. A Warehouse is full T-SQL with writes and multi-table transactions.', pl: 'Te same dane i format, inny silnik zapisu.' }
    ],
    mistakes: [
      'Wskazanie jednej platformy jako „najlepszej” bez pytania o obciążenie i zespół.',
      'Opisywanie Snowflake jako zamkniętego bez wzmianki o tabelach Iceberg, a Databricks jako „tylko dla Sparka” bez SQL warehouses.',
      'Traktowanie wyboru jako zero-jedynkowego, gdy otwarte formaty pozwalają łączyć silniki.',
      'Mylenie Fabric z samym Power BI albo z Azure Databricks.'
    ]
  }
];

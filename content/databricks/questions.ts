import type { Question } from '../types';

/** Pytania: platforma Databricks. Zweryfikowane w dokumentacji Databricks (linki w docs/verified-facts.md). */
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
      pl: 'Unity Catalog to warstwa governance wspólna dla wielu workspace\'ów. Daje trójpoziomowy namespace, czyli catalog, schema, table, oraz centralne uprawnienia, lineage i audyt. Dostęp nadaję SQL-owym GRANT-em, a uprawnienia dziedziczą się w dół. W tabeli managed Unity Catalog zarządza metadanymi i plikami: po DROP pliki są kasowane po okresie, w którym działa jeszcze UNDROP, domyślnie 7 dni. W tabeli external pilnuje tylko metadanych i dostępu, a pliki po DROP zostają. Domyślnie wybieram managed, a external wtedy, gdy inne systemy muszą sięgać do plików bezpośrednio.',
      en: 'Unity Catalog is the governance layer shared across workspaces. It gives a three-level namespace, catalog, schema, table, and central permissions, lineage and auditing. I grant access with SQL GRANT statements, and privileges are inherited downwards. For a managed table Unity Catalog manages both metadata and files: after a DROP the files are deleted once the UNDROP window, seven days by default, has passed. For an external table it manages only metadata and access, and the files stay after a DROP. I default to managed tables and use external ones when other systems need direct access to the files.'
    },
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
      pl: 'Structured Streaming traktuje stream jak tabelę, która ciągle rośnie, i przetwarza ją w mikro-batchach. Odporność na awarie daje checkpoint: zapytanie zapisuje w nim, jakie offsety źródła objął każdy batch, oraz stan operatorów stanowych. Po awarii startuje z checkpointu i powtarza ostatni niedokończony batch. Jeśli źródło da się odczytać ponownie, a zapis jest idempotentny lub transakcyjny, jak Delta, wynik końcowy jest exactly-once. Watermark mówi, jak długo czekam na spóźnione zdarzenia. Dzięki niemu Spark może zamykać okna i czyścić stary stan. Bez watermarku stan rośnie bez końca.',
      en: 'Structured Streaming treats a stream as a table that keeps growing and processes it in micro-batches. Fault tolerance comes from the checkpoint: the query records which source offsets each batch covered, and the state of stateful operators. After a failure it restarts from the checkpoint and re-runs the last unfinished batch. If the source is replayable and the sink is idempotent or transactional, like Delta, the end result is exactly-once. A watermark says how long I wait for late events. It lets Spark finalize windows and drop old state. Without a watermark the state grows forever.'
    },
    senior: {
      pl: 'Moje produkcyjne doświadczenie to mikro-batch w Snowflake: Snowpipe plus Streams & Tasks. Offset streamu odpowiada offsetom w checkpoincie, ale analogia jest częściowa, bo checkpoint Sparka trzyma też stan operatorów.',
      en: 'My production experience is micro-batch in Snowflake: Snowpipe plus Streams and Tasks. A stream offset corresponds to the offsets in a checkpoint, but the analogy is partial, because a Spark checkpoint also holds operator state.'
    },
    keywords: ['checkpoint', 'offsets', 'watermark', 'exactly-once', 'Auto Loader', 'availableNow', 'foreachBatch'],
    followUps: [
      { q: 'Which triggers do you know?', a: 'processingTime for a fixed interval, and availableNow to process everything that is waiting and stop.', pl: 'Na serverless działa tylko availableNow.' },
      { q: 'What is Auto Loader?', a: 'The cloudFiles source. It incrementally discovers new files in storage and handles schema inference and evolution.', pl: 'Przyrostowe wczytywanie plików.' },
      { q: 'How do you upsert from a stream?', a: 'With foreachBatch and a MERGE inside.', pl: 'foreachBatch + MERGE.' }
    ],
    mistakes: [
      'Obiecywanie exactly-once bez warunków po stronie źródła i zapisu.',
      'Mylenie checkpointu streamu z checkpoint() na DataFrame.',
      'Przedstawianie doświadczenia z mikro-batchem w Snowflake jako streamingu na Kafce.'
    ]
  }
];

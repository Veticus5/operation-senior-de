"""
Interview Bank: pomiary, na które powołują się odpowiedzi o Sparku.

  1. wartości domyślne konfiguracji cytowane w odpowiedziach,
  2. broadcast join: hint to prośba, nie gwarancja,
  3. co naprawdę wędruje przez shuffle (join kontra agregacja),
  4. podział hashem, zakresami i round-robin,
  5. liczba tasków a liczba tasków wykonywanych naraz,
  6. zapytanie policzone przez driver bez żadnego joba.

Pomiar lokalny (jeden proces, trzy wątki). To obserwacje z tego uruchomienia, nie gwarancje Sparka.

Uruchomienie (wymaga Javy 17 lub nowszej):
    cd labs && uv run interview_bank/spark_checks.py
"""
import json, time, urllib.request
from pyspark.sql import SparkSession, functions as F

spark = (SparkSession.builder.master("local[3]").appName("bank-spark-checks")
         .config("spark.ui.showConsoleProgress", "false").getOrCreate())
sc = spark.sparkContext
sc.setLogLevel("OFF")
print(f"Spark {spark.version}, local[3]\n")

def api(what):
    return json.load(urllib.request.urlopen(f"{sc.uiWebUrl}/api/v1/applications/{sc.applicationId}/{what}"))

def new_stages(run):
    """Uruchamia akcję i zwraca stage'e, które przez nią powstały, w kolejności id."""
    before = {s["stageId"] for s in api("stages")}
    run()
    return sorted((s for s in api("stages") if s["stageId"] not in before), key=lambda s: s["stageId"])

# --- 1. Wartości domyślne -----------------------------------------------------
print("1. Wartości domyślne w tej wersji Apache Spark")
for key in ("spark.sql.autoBroadcastJoinThreshold", "spark.sql.shuffle.partitions", "spark.sql.adaptive.enabled",
            "spark.sql.adaptive.skewJoin.skewedPartitionFactor",
            "spark.sql.adaptive.skewJoin.skewedPartitionThresholdInBytes",
            "spark.sql.adaptive.advisoryPartitionSizeInBytes", "spark.sql.files.maxPartitionBytes",
            "spark.sql.ansi.enabled"):
    print(f"   {key} = {spark.conf.get(key)}")
print()

# --- 2. Broadcast: hint to prośba --------------------------------------------
print("2. Strategia joina wybrana przez Spark (AQE wyłączone, żeby plan był ostateczny od razu)")
spark.conf.set("spark.sql.adaptive.enabled", "false")
big = spark.range(0, 200_000).withColumn("k", F.col("id") % 1000)
small = spark.range(0, 1000).withColumnRenamed("id", "k").withColumn("name", F.concat(F.lit("n"), F.col("k")))

def strategy(df):
    plan = df._jdf.queryExecution().executedPlan().toString()
    return next(s for s in ("BroadcastHashJoin", "BroadcastNestedLoopJoin", "SortMergeJoin", "ShuffledHashJoin") if s in plan)

print("   inner, bez hintu, mała strona poniżej progu:      ", strategy(big.join(small, "k")))
spark.conf.set("spark.sql.autoBroadcastJoinThreshold", "-1")          # wyłącza automatyczny broadcast
print("   inner, próg = -1, bez hintu:                      ", strategy(big.join(small, "k")))
print("   inner, próg = -1, broadcast(mała):                ", strategy(big.join(F.broadcast(small), "k")))
print("   left outer, broadcast(prawa = mała):              ", strategy(big.join(F.broadcast(small), "k", "left")))
print("   left outer, broadcast(lewa = zachowywana):        ", strategy(F.broadcast(small).join(big, "k", "left")))
print("   right outer, broadcast(prawa = zachowywana):      ", strategy(big.join(F.broadcast(small), "k", "right")))
print("   full outer, broadcast(mała):                      ", strategy(big.join(F.broadcast(small), "k", "full_outer")))
print("   full outer bez równości (a.k < b.k), broadcast:   ", strategy(big.join(F.broadcast(small), big.k < small.k, "full_outer")))
print()

# --- 3. Co wędruje przez shuffle ----------------------------------------------
print("3. Rekordy zapisane do shuffle'u (100 000 wierszy, 50 kluczy, 3 partycje wejścia)")
data = spark.range(0, 100_000).withColumn("k", F.col("id") % 50)
stages = new_stages(lambda: data.groupBy("k").agg(F.sum("id")).collect())
print(f"   groupBy(k).sum: {stages[0]['shuffleWriteRecords']} rekordów  (agregacja częściowa przed shuffle'em)")
other = spark.range(0, 500).withColumn("k", F.col("id") % 50).withColumnRenamed("id", "id2")
stages = new_stages(lambda: data.join(other, "k").agg(F.count("*")).collect())
written = sorted(s["shuffleWriteRecords"] for s in stages if s["shuffleWriteRecords"] > 1000)
print(f"   sort-merge join po k: duża strona zapisała {written[-1]} rekordów  (każdy wiersz)")
spark.conf.unset("spark.sql.autoBroadcastJoinThreshold")
print()

# --- 4. Trzy sposoby podziału -------------------------------------------------
print("4. W ilu partycjach ląduje jeden klucz (100 000 wierszy, 50 kluczy, 8 partycji)")
def spread(df):
    with_pid = df.withColumn("pid", F.spark_partition_id())
    return with_pid.groupBy("k").agg(F.countDistinct("pid").alias("n")).agg(F.max("n")).first()[0]

def sizes(df):
    return sorted(r["count"] for r in df.withColumn("pid", F.spark_partition_id()).groupBy("pid").count().collect())

print("   repartition(8, k)         hash po kluczu:   maks.", spread(data.repartition(8, "k")), "partycja na klucz")
print("   repartitionByRange(8, k)  zakresy wartości: maks.", spread(data.repartitionByRange(8, "k")), "partycja na klucz")
print("   repartition(8)            round-robin:      maks.", spread(data.repartition(8)), "partycji na klucz")
print("   rozmiary partycji po repartition(8):", sizes(data.repartition(8)))
skewed = spark.range(0, 100_000).withColumn("k", F.when(F.col("id") % 10 < 8, F.lit(0)).otherwise(F.col("id") % 50))
print("   rozmiary niepustych partycji po repartition(8, k), gdy 80% wierszy ma jeden klucz:", sizes(skewed.repartition(8, "k")))
print()

# --- 5. Taski a równoległość --------------------------------------------------
print("5. 12 partycji na local[3]")
def timed(_):
    start = time.time()
    time.sleep(0.3)
    yield (start, time.time())                       # czas zmierzony wewnątrz taska

spans = []
stage = new_stages(lambda: spans.extend(sc.parallelize(range(12), 12).mapPartitions(timed).collect()))[-1]
events = sorted([(start, 1) for start, _ in spans] + [(end, -1) for _, end in spans])
running = peak = 0
for _, delta in events:
    running += delta
    peak = max(peak, running)
print(f"   tasków w stage'u: {stage['numTasks']}, najwięcej działających jednocześnie: {peak}, defaultParallelism: {sc.defaultParallelism}")
print()

# --- 6. Praca wykonana przez driver -------------------------------------------
print("6. Zapytanie na danych lokalnych")
spark.conf.set("spark.sql.adaptive.enabled", "true")
before = len(api("jobs"))
local = spark.sql("SELECT * FROM VALUES (1, 'a'), (2, 'b'), (3, 'c') AS t(id, s) WHERE id > 1")
rows = local.collect()
print(f"   SELECT ... FROM VALUES ... WHERE: wierszy {len(rows)}, jobów {len(api('jobs')) - before}")
print(f"   plan fizyczny: {local._jdf.queryExecution().executedPlan().toString().strip()}")

spark.stop()

"""
Lekcja 05: Data Skew i Adaptive Query Execution. Osiem małych eksperymentów:

  1. rozmiary partycji po podziale hashem: klucz równy i klucz skośny, 8 i 64 partycje,
  2. join przez shuffle bez AQE: ile rekordów czyta każdy task,
  3. ten sam join z AQE: progi domyślne i progi obniżone,
  4. granice obsługi skew w AQE: typ joina, funkcja okna,
  5. AQE skleja małe partycje po shuffle'u,
  6. AQE zmienia sort-merge join na broadcast hash join w trakcie wykonania,
  7. salting: ten sam join z solą, bez AQE,
  8. NULL w kluczu joina.

Dane są wymyślone: 2 000 000 zamówień, z czego 80% ma customer_id = 0, oraz 1000 klientów.
Pomiar lokalny (jeden proces, trzy wątki). Liczby rekordów są powtarzalne, czasy nie.
To obserwacje z tego uruchomienia, nie gwarancje Sparka.

Uruchomienie (wymaga Javy 17 lub nowszej):
    cd labs && uv run data_skew/skew_aqe_lab.py
"""
import json, re, statistics, urllib.request
from pyspark.sql import SparkSession, Window, functions as F

spark = (SparkSession.builder.master("local[3]").appName("skew-aqe-lab")
         .config("spark.ui.showConsoleProgress", "false").getOrCreate())
sc = spark.sparkContext
sc.setLogLevel("OFF")

ROWS, CUSTOMERS, PARTS = 2_000_000, 1000, 8
DEFAULTS = {
    "spark.sql.adaptive.enabled": "false",
    "spark.sql.shuffle.partitions": str(PARTS),
    "spark.sql.autoBroadcastJoinThreshold": "-1",      # wyłącza automatyczny broadcast: chcemy joina przez shuffle
    "spark.sql.adaptive.skewJoin.skewedPartitionThresholdInBytes": "256MB",
    "spark.sql.adaptive.advisoryPartitionSizeInBytes": "64MB",
    "spark.sql.adaptive.coalescePartitions.enabled": "true",
}
# Eksperymenty 3 i 4 wyłączają sklejanie małych partycji, żeby było widać samą obsługę skew.
NO_MERGE = {"spark.sql.adaptive.enabled": "true", "spark.sql.adaptive.coalescePartitions.enabled": "false"}
LOW = {"spark.sql.adaptive.skewJoin.skewedPartitionThresholdInBytes": "1MB",
       "spark.sql.adaptive.advisoryPartitionSizeInBytes": "2MB"}

def conf(**extra):
    """Ustawia konfigurację eksperymentu: wartości bazowe labu plus podane zmiany."""
    for key, value in {**DEFAULTS, **extra}.items():
        spark.conf.set(key, value)

def num(n):
    return f"{n:,}".replace(",", " ")

def api(what):
    return json.load(urllib.request.urlopen(f"{sc.uiWebUrl}/api/v1/applications/{sc.applicationId}/{what}"))

def run(df):
    """Wykonuje zapytanie i zwraca (stage, który przeczytał z shuffle'u najwięcej rekordów; jego taski; plan końcowy)."""
    before = {s["stageId"] for s in api("stages")}
    df.collect()
    new = [s for s in api("stages") if s["stageId"] not in before and s["status"] == "COMPLETE"]
    stage = max(new, key=lambda s: s["shuffleReadRecords"])
    tasks = api(f"stages/{stage['stageId']}/{stage['attemptId']}/taskList?length=5000")
    return stage, tasks, df._jdf.queryExecution().executedPlan().toString()

def describe(tasks):
    records = sorted(t["taskMetrics"]["shuffleReadMetrics"]["recordsRead"] for t in tasks)
    millis = sorted(t["taskMetrics"]["executorRunTime"] for t in tasks)
    return (f"tasków {len(tasks):3d}, rekordy z shuffle'u na task: min {num(records[0]):>9}, mediana {num(int(statistics.median(records))):>9}, "
            f"max {num(records[-1]):>9}; czas taska: mediana {int(statistics.median(millis))} ms, max {millis[-1]} ms")

def join_node(plan):
    """Pierwszy węzeł joina w planie, np. 'SortMergeJoin(skew=true)'."""
    found = re.search(r"(SortMergeJoin|ShuffledHashJoin|BroadcastHashJoin|BroadcastNestedLoopJoin)(\(skew=true\))?", plan)
    return found.group(0) if found else "brak joina"

def sizes(df):
    return sorted(r["count"] for r in df.withColumn("pid", F.spark_partition_id()).groupBy("pid").count().collect())

base = spark.range(0, ROWS).withColumnRenamed("id", "order_id").withColumn("amount", (F.col("order_id") % 97 + 1).cast("long"))
# Klucz równy: każdy z 1000 klientów ma 2000 zamówień. Klucz skośny: klient 0 ma 80% zamówień.
even = base.withColumn("customer_id", F.col("order_id") % CUSTOMERS)
skewed = base.withColumn("customer_id", F.when(F.col("order_id") % 10 < 8, F.lit(0)).otherwise(1 + F.col("order_id") % (CUSTOMERS - 1)))
customers = spark.range(0, CUSTOMERS).withColumnRenamed("id", "customer_id").withColumn("segment", F.col("customer_id") % 5)
total = lambda df: df.agg(F.count("*").alias("n"), F.sum("amount").alias("s"))

conf()
print(f"Spark {spark.version}, local[3]. Zamówień: {num(ROWS)}, klientów: {CUSTOMERS}, partycji po shuffle'u: {PARTS}")
top = skewed.groupBy("customer_id").count().orderBy(F.desc("count"), "customer_id").limit(3).collect()
print("Najczęstsze klucze w danych skośnych (customer_id, liczba zamówień):", [(r[0], r[1]) for r in top])
print()

# --- 1. Rozmiary partycji -----------------------------------------------------
print("1. Liczba wierszy w partycjach po repartition(n, customer_id), posortowana")
print("   klucz równy,  n = 8: ", sizes(even.repartition(8, "customer_id")))
print("   klucz skośny, n = 8: ", sizes(skewed.repartition(8, "customer_id")))
big = sizes(skewed.repartition(64, "customer_id"))
print(f"   klucz skośny, n = 64: największa partycja {big[-1]}, mediana {int(statistics.median(big))}, niepustych partycji {len(big)}")
print()

# --- 2. Join bez AQE ----------------------------------------------------------
print("2. Sort-merge join zamówień z klientami, AQE wyłączone")
for label, orders in (("klucz równy ", even), ("klucz skośny", skewed)):
    _, tasks, plan = run(total(orders.join(customers, "customer_id")))
    print(f"   {label}: {join_node(plan)}; {describe(tasks)}")
conf(**{"spark.sql.shuffle.partitions": "64"})
_, tasks, plan = run(total(skewed.join(customers, "customer_id")))
print(f"   klucz skośny, 64 partycje: {describe(tasks)}")
print()

# --- 3. Ten sam join z AQE ----------------------------------------------------
print("3. Ten sam join, klucz skośny, AQE włączone (sklejanie małych partycji wyłączone)")
conf(**NO_MERGE)
_, tasks, plan = run(total(skewed.join(customers, "customer_id")))
print(f"   progi domyślne (5 x mediana i 256 MB):   {join_node(plan)}; {describe(tasks)}")
conf(**NO_MERGE, **LOW)
stage, tasks, plan = run(total(skewed.join(customers, "customer_id")))
print(f"   próg 1 MB, rozmiar docelowy 2 MB:        {join_node(plan)}; {describe(tasks)}")
print(f"   rekordy przeczytane z shuffle'u w tym stage'u łącznie: {num(stage['shuffleReadRecords'])} (zamówień {num(ROWS)}, klientów {CUSTOMERS})")
print()

# --- 4. Granice AQE -----------------------------------------------------------
print("4. Czy AQE podzieliło skośną partycję? Te same obniżone progi, skośna strona to zamówienia (lewa)")
for how in ("inner", "left", "right", "full"):
    _, tasks, plan = run(total(skewed.join(customers, "customer_id", how)))
    print(f"   {how:5s} join: {join_node(plan):26s} {describe(tasks)}")
ranked = skewed.withColumn("rn", F.row_number().over(Window.partitionBy("customer_id").orderBy("order_id")))
_, tasks, plan = run(ranked.agg(F.max("rn")))
print(f"   funkcja okna po customer_id (bez joina): {describe(tasks)}")
print()

# --- 5. Sklejanie małych partycji ---------------------------------------------
print("5. groupBy(customer_id) na kluczu równym przy spark.sql.shuffle.partitions = 200")
for aqe in ("false", "true"):
    conf(**{"spark.sql.adaptive.enabled": aqe, "spark.sql.shuffle.partitions": "200"})
    _, tasks, plan = run(even.groupBy("customer_id").agg(F.sum("amount").alias("s")).agg(F.count("*")))
    reader = "AQEShuffleRead coalesced" if "AQEShuffleRead coalesced" in plan else "bez AQEShuffleRead"
    print(f"   AQE={aqe:5s}: tasków czytających shuffle {len(tasks):3d}  ({reader})")
print()

# --- 6. Zmiana strategii joina ------------------------------------------------
print("6. Join z tabelą, która po filtrze okazuje się mała (próg broadcastu domyślny, 10 MB)")
few = spark.range(0, 3_000_000).withColumn("customer_id", F.col("id") % CUSTOMERS).filter(F.col("id") % 99_991 == 0).select("customer_id")
for aqe in ("false", "true"):
    conf(**{"spark.sql.adaptive.enabled": aqe, "spark.sql.autoBroadcastJoinThreshold": "10MB"})
    query = total(even.join(few, "customer_id"))
    planned = join_node(query._jdf.queryExecution().executedPlan().toString())
    _, _, plan = run(query)
    print(f"   AQE={aqe:5s}: plan przed wykonaniem {planned}, plan po wykonaniu {join_node(plan)}")
print(f"   wierszy po filtrze: {few.count()} z 3 000 000")
print()

# --- 7. Salting ---------------------------------------------------------------
N = 16
print(f"7. Salting, AQE wyłączone, sól od 0 do {N - 1}")
conf()
salted_orders = skewed.withColumn("salt", (F.rand(seed=7) * N).cast("int"))
salted_customers = customers.withColumn("salt", F.explode(F.array(*[F.lit(i) for i in range(N)])))
plain_n, plain_s = total(skewed.join(customers, "customer_id")).first()
stage, tasks, plan = run(total(salted_orders.join(salted_customers, ["customer_id", "salt"])))
salt_n, salt_s = total(salted_orders.join(salted_customers, ["customer_id", "salt"])).first()
print(f"   join po (customer_id, salt): {describe(tasks)}")
print(f"   strona klientów po powieleniu: {salted_customers.count()} wierszy zamiast {CUSTOMERS}")
print(f"   wynik bez soli: {plain_n} wierszy, suma {plain_s}; z solą: {salt_n} wierszy, suma {salt_s}; identyczny: {(plain_n, plain_s) == (salt_n, salt_s)}")
print()

# --- 8. NULL w kluczu ---------------------------------------------------------
print("8. 80% zamówień ma customer_id = NULL, AQE wyłączone")
nulls = base.withColumn("customer_id", F.when(F.col("order_id") % 10 < 8, F.lit(None).cast("long")).otherwise(1 + F.col("order_id") % (CUSTOMERS - 1)))
for how in ("left", "inner"):
    query = total(nulls.join(customers, "customer_id", how))
    _, tasks, plan = run(query)
    pushed = "tak" if "isnotnull" in plan else "nie"
    print(f"   {how:5s} join: filtr isnotnull na kluczu w planie: {pushed}; {describe(tasks)}")

spark.stop()

"""
Lekcja Partitioning & Shuffle: sześć małych eksperymentów na 12 wierszach.

  1. partycja to kawałek danych: gdzie leży każdy wiersz,
  2. filter (narrow): czy jakikolwiek wiersz zmienia partycję i ile jest stage'y,
  3. groupBy (wide): plan, stage'e i to, co naprawdę trafia do shuffle'u,
  4. repartition po kluczu (hash) i bez klucza: gdzie lądują wiersze,
  5. coalesce: sklejanie bez shuffle'u oraz coalesce(1) kontra repartition(1),
  6. liczba partycji po shuffle'u a liczba tasków, z AQE i bez.

Pomiar lokalny (jeden proces, trzy wątki). Nie ma tu sieci ani osobnych executorów:
shuffle zapisuje pliki na lokalnym dysku i czyta je ten sam proces.
To obserwacje z tego uruchomienia, nie gwarancje Sparka.

Uruchomienie (wymaga Javy 17 lub nowszej):
    cd labs && uv run partitioning_shuffle/shuffle_lab.py
"""
import json, urllib.request
from pyspark.sql import SparkSession, functions as F

spark = (SparkSession.builder.master("local[3]").appName("partitioning-shuffle-lab")
         .config("spark.ui.showConsoleProgress", "false").getOrCreate())
sc = spark.sparkContext
sc.setLogLevel("OFF")
print(f"Spark {spark.version}, local[3]\n")

def api(what):
    return json.load(urllib.request.urlopen(f"{sc.uiWebUrl}/api/v1/applications/{sc.applicationId}/{what}"))

def new_stages(run):
    """Uruchamia akcję i zwraca stage'e, które przez nią powstały i zostały wykonane, w kolejności id."""
    before = {s["stageId"] for s in api("stages")}
    run()
    fresh = [s for s in api("stages") if s["stageId"] not in before and s["status"] == "COMPLETE"]
    return sorted(fresh, key=lambda s: s["stageId"])

def layout(df):
    """Słownik: numer partycji -> lista id zamówień, które w niej leżą."""
    rows = df.withColumn("pid", F.spark_partition_id()).select("pid", "order_id").collect()
    out = {}
    for r in rows:
        out.setdefault(r["pid"], []).append(r["order_id"])
    return {pid: sorted(ids) for pid, ids in sorted(out.items())}

def show_layout(df, indent="   "):
    by_pid = layout(df)
    for pid in range(df.rdd.getNumPartitions()):
        ids = by_pid.get(pid, [])
        print(f"{indent}partycja {pid}: wierszy {len(ids)}  {ids}")

def exchange_line(df):
    """Linia planu fizycznego z węzłem Exchange albo informacja, że go nie ma."""
    plan = df._jdf.queryExecution().executedPlan().toString()
    return next((line.strip(" +-") for line in plan.splitlines() if "Exchange" in line), "brak Exchange")

def stage_line(s):
    return (f"stage {s['stageId']}: tasków {s['numTasks']}, "
            f"zapis do shuffle'u: {s['shuffleWriteRecords']} rekordów / {s['shuffleWriteBytes']} B, "
            f"odczyt z shuffle'u: {s['shuffleReadRecords']} rekordów")

# Zamówienia: (order_id, country, amount). Trzy partycje wejścia po 4 wiersze, w kolejności listy.
ORDERS = [
    (1, "PL", 120), (2, "DE", 80), (3, "PL", 40), (4, "FR", 200),
    (5, "DE", 60), (6, "PL", 90), (7, "IT", 150), (8, "PL", 30),
    (9, "FR", 70), (10, "DE", 110), (11, "PL", 50), (12, "IT", 20),
]
orders = spark.createDataFrame(sc.parallelize(ORDERS, 3), "order_id int, country string, amount int")
spark.conf.set("spark.sql.adaptive.enabled", "false")   # eksperymenty 1-5: plan ostateczny od razu, bez AQE

# --- 1. Partycja to kawałek danych ---------------------------------------------
print("1. 12 zamówień w 3 partycjach")
print(f"   liczba partycji: {orders.rdd.getNumPartitions()}")
show_layout(orders)
print()

# --- 2. filter: zależność narrow -----------------------------------------------
print("2. filter(amount >= 60)")
paid = orders.filter("amount >= 60")
show_layout(paid)
before = layout(orders)
moved = sum(1 for pid, ids in layout(paid).items() for i in ids if i not in before[pid])
print(f"   wiersze, które zmieniły partycję: {moved}")
stages = new_stages(lambda: paid.collect())
print(f"   stage'y: {len(stages)}")
for s in stages:
    print("   " + stage_line(s))
print("   Exchange w planie:", exchange_line(paid))
print()

# --- 3. groupBy: zależność wide --------------------------------------------------
print("3. groupBy(country).sum(amount), spark.sql.shuffle.partitions = 4")
spark.conf.set("spark.sql.shuffle.partitions", "4")
per_country = orders.groupBy("country").agg(F.sum("amount").alias("total"))
print("   plan fizyczny:")
for line in per_country._jdf.queryExecution().executedPlan().toString().strip().splitlines():
    print("     " + line)
stages = new_stages(lambda: per_country.collect())
print(f"   stage'y: {len(stages)}")
for s in stages:
    print("   " + stage_line(s))
pairs = orders.withColumn("pid", F.spark_partition_id()).select("pid", "country").distinct().count()
print(f"   różnych par (partycja wejścia, kraj): {pairs}  <- tyle sum częściowych, a nie 12 wierszy")
print("   wynik po shuffle'u (partycja -> kraje):")
after = per_country.withColumn("pid", F.spark_partition_id()).collect()
for pid in range(4):
    print(f"     partycja {pid}: {sorted((r['country'], r['total']) for r in after if r['pid'] == pid)}")
print()

# --- 4. repartition: hash po kluczu i bez klucza -------------------------------
print("4. repartition(4, country): podział hashem klucza")
by_key = orders.repartition(4, "country")
show_layout(by_key)
target = {r["country"]: (r["pid"], r["h"]) for r in by_key
          .select("country", F.spark_partition_id().alias("pid"), F.expr("pmod(hash(country), 4)").alias("h")).distinct().collect()}
for country in sorted(target):
    pid, h = target[country]
    print(f"   {country}: partycja {pid}, pmod(hash(country), 4) = {h}")
print("   plan:", exchange_line(by_key))
stages = new_stages(lambda: by_key.collect())
for s in stages:
    print("   " + stage_line(s))
then_group = by_key.groupBy("country").agg(F.sum("amount"))
n_exchange = then_group._jdf.queryExecution().executedPlan().toString().count("Exchange")
print(f"   repartition(4, country), potem groupBy(country): węzłów Exchange w planie: {n_exchange}")
print("   repartition(4): bez klucza")
no_key = orders.repartition(4)
show_layout(no_key)
print("   plan:", exchange_line(no_key))
spread = no_key.withColumn("pid", F.spark_partition_id()).groupBy("country").agg(F.countDistinct("pid").alias("n")).collect()
print("   w ilu partycjach leży kraj:", {r["country"]: r["n"] for r in sorted(spread, key=lambda r: r["country"])})
print()

# --- 5. coalesce ---------------------------------------------------------------
print("5. coalesce(2) na 3 partycjach")
merged = orders.coalesce(2)
show_layout(merged)
print("   Exchange w planie:", exchange_line(merged))
print("   plan:", merged._jdf.queryExecution().executedPlan().toString().strip().splitlines()[0])
stages = new_stages(lambda: merged.collect())
print(f"   stage'y: {len(stages)}")
for s in stages:
    print("   " + stage_line(s))
print(f"   coalesce(6) na 3 partycjach daje partycji: {orders.coalesce(6).rdd.getNumPartitions()}")
print(f"   repartition(6) na 3 partycjach daje partycji: {orders.repartition(6).rdd.getNumPartitions()}")
print("   filter + coalesce(1) kontra filter + repartition(1): ile tasków liczy filter")
stages = new_stages(lambda: orders.filter("amount >= 60").coalesce(1).collect())
print(f"   coalesce(1):    stage'y {len(stages)}, taski w kolejnych stage'ach {[s['numTasks'] for s in stages]}")
stages = new_stages(lambda: orders.filter("amount >= 60").repartition(1).collect())
print(f"   repartition(1): stage'y {len(stages)}, taski w kolejnych stage'ach {[s['numTasks'] for s in stages]}")
print()

# --- 6. Liczba partycji po shuffle'u a liczba tasków ----------------------------
print("6. Ten sam groupBy, spark.sql.shuffle.partitions = 200 (wartość domyślna)")
spark.conf.set("spark.sql.shuffle.partitions", "200")
stages = new_stages(lambda: orders.groupBy("country").agg(F.sum("amount")).collect())
print(f"   AQE wyłączone: taski w kolejnych stage'ach {[s['numTasks'] for s in stages]}")
empty = orders.groupBy("country").agg(F.sum("amount")).withColumn("pid", F.spark_partition_id()).select("pid").distinct().count()
print(f"   niepustych partycji po shuffle'u: {empty} z 200")
spark.conf.set("spark.sql.adaptive.enabled", "true")
stages = new_stages(lambda: orders.groupBy("country").agg(F.sum("amount")).collect())
print(f"   AQE włączone:  taski w kolejnych stage'ach {[s['numTasks'] for s in stages]}")
print(f"   spark.sql.adaptive.coalescePartitions.enabled = {spark.conf.get('spark.sql.adaptive.coalescePartitions.enabled')}")

spark.stop()

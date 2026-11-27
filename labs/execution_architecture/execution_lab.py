"""
Lekcja 02: Spark Execution Architecture. Pomiary, na które powołuje się lekcja.

  1. SparkSession a SparkContext: ile jest którego,
  2. cztery plany tego samego zapytania (explain w trybie extended),
  3. joby, stage'e i taski dla trzech zapytań, z AQE i bez,
  4. nieudany task: bez ponowień i z ponowieniami.

Pomiar lokalny (jeden proces, trzy wątki). To obserwacje z tego uruchomienia, nie gwarancje Sparka.

Uruchomienie (wymaga Javy 17 lub nowszej):
    cd labs && uv run execution_architecture/execution_lab.py
"""
import json, shutil, tempfile, urllib.request
from pyspark import TaskContext
from pyspark.sql import SparkSession, functions as F

FOUR_MB = str(4 * 1024 * 1024)


def start(master):
    # maxPartitionBytes = 4 MB: przy tak małych plikach każdy z 4 plików wejścia staje się osobną partycją.
    session = (SparkSession.builder.master(master).appName("execution-architecture-lab")
               .config("spark.ui.showConsoleProgress", "false")
               .config("spark.sql.files.maxPartitionBytes", FOUR_MB).getOrCreate())
    session.sparkContext.setLogLevel("OFF")
    return session


spark = start("local[3]")
sc = spark.sparkContext
print(f"Spark {spark.version}, local[3], spark.sql.shuffle.partitions = {spark.conf.get('spark.sql.shuffle.partitions')}\n")


def api(what):
    return json.load(urllib.request.urlopen(f"{sc.uiWebUrl}/api/v1/applications/{sc.applicationId}/{what}"))


# --- dane: 4 pliki Parquet z zamówieniami, mała tabela klientów -----------------
tmp = tempfile.mkdtemp(prefix="execution-lab-")
(spark.range(0, 1200, numPartitions=4)
 .select(F.col("id").alias("order_id"), (F.col("id") % 40).alias("customer_id"),
         F.date_add(F.lit("2026-01-01").cast("date"), (F.col("id") % 5).cast("int")).alias("order_date"),
         F.when(F.col("id") % 3 == 0, "cancelled").otherwise("paid").alias("status"),
         (F.col("id") % 90 + 10).cast("double").alias("amount"))
 .write.mode("overwrite").parquet(f"{tmp}/orders"))
(spark.range(0, 40, numPartitions=2)
 .select(F.col("id").alias("customer_id"), F.concat(F.lit("PL-"), F.col("id") % 4).alias("region"))
 .write.mode("overwrite").parquet(f"{tmp}/customers"))

orders = spark.read.parquet(f"{tmp}/orders")
customers = spark.read.parquet(f"{tmp}/customers")
print(f"Dane: orders = {orders.count()} wierszy w {orders.rdd.getNumPartitions()} partycjach, "
      f"customers = {customers.count()} wierszy w {customers.rdd.getNumPartitions()} partycjach\n")

# --- 1. SparkSession a SparkContext ---------------------------------------------
print("1. SparkSession a SparkContext")
again = SparkSession.builder.getOrCreate()
other = spark.newSession()
orders.createOrReplaceTempView("orders_view")
print(f"   builder.getOrCreate() drugi raz zwraca tę samą sesję:    {again is spark}")
print(f"   newSession() to inna sesja:                              {other is not spark}")
print(f"   ...ale z tym samym SparkContextem:                       {other.sparkContext is sc}")
print(f"   widok tymczasowy 'orders_view' widać w pierwszej sesji:  {spark.catalog.tableExists('orders_view')}")
print(f"   ...a w drugiej:                                          {other.catalog.tableExists('orders_view')}")
other.conf.set("spark.sql.shuffle.partitions", "7")
print(f"   shuffle.partitions po zmianie w drugiej sesji:           pierwsza {spark.conf.get('spark.sql.shuffle.partitions')}, druga {other.conf.get('spark.sql.shuffle.partitions')}")
print(f"   applicationId (jedna aplikacja, jeden driver):           {'ten sam' if other.sparkContext.applicationId == sc.applicationId else 'różne'}")
print()

# --- zapytania z lekcji -----------------------------------------------------------
paid = orders.filter(F.col("status") == "paid")
QUERIES = {
    "A. filter":                    lambda: paid,
    "B. filter + groupBy":          lambda: paid.groupBy("order_date").agg(F.sum("amount").alias("revenue")),
    "C. filter + join + groupBy":   lambda: (paid.join(customers, "customer_id")
                                             .groupBy("region").agg(F.sum("amount").alias("revenue"))),
}

# --- 2. Cztery plany --------------------------------------------------------------
print("2. Plany zapytania B (AQE wyłączone, żeby plan fizyczny był ostateczny od razu)")
spark.conf.set("spark.sql.adaptive.enabled", "false")
QUERIES["B. filter + groupBy"]().explain(extended=True)


def physical(df):
    return df._jdf.queryExecution().executedPlan().toString().strip().splitlines()


def operators(df):
    """Nazwy operatorów planu fizycznego, od góry planu, bez argumentów."""
    return [line.lstrip(" +-:*()0123456789").split("(")[0].split(" [")[0].strip() for line in physical(df)]


spark.conf.set("spark.sql.autoBroadcastJoinThreshold", "-1")
print("   Operatory planu fizycznego zapytania C, broadcast wyłączony (od góry planu):")
print("   " + " <- ".join(operators(QUERIES["C. filter + join + groupBy"]())))
spark.conf.unset("spark.sql.autoBroadcastJoinThreshold")
print("   To samo z domyślnym progiem broadcast:")
print("   " + " <- ".join(operators(QUERIES["C. filter + join + groupBy"]())))
spark.conf.set("spark.sql.adaptive.enabled", "true")
adaptive = QUERIES["B. filter + groupBy"]()
print("   Zapytanie B z AQE, pierwsza linia planu fizycznego przed akcją: ", physical(adaptive)[0])
adaptive.collect()
print("   ...i po collect() na tym samym DataFrame:                       ", physical(adaptive)[0])
print()

# --- 3. Joby, stage'e, taski ------------------------------------------------------
def run(df):
    """Zapisuje wynik do Parquet i zwraca joby tej akcji razem z ich stage'ami."""
    jobs_before = {j["jobId"] for j in api("jobs")}
    df.write.mode("overwrite").parquet(f"{tmp}/out")
    stages = {s["stageId"]: s for s in api("stages")}
    return [(j, [stages[i] for i in sorted(j["stageIds"])])
            for j in sorted(api("jobs"), key=lambda j: j["jobId"]) if j["jobId"] not in jobs_before]


def report(jobs):
    first_job = jobs[0][0]["jobId"]
    first_stage = min(s["stageId"] for _, stages in jobs for s in stages)
    total_stages = sum(1 for _, stages in jobs for s in stages if s["status"] == "COMPLETE")
    total_tasks = sum(s["numCompleteTasks"] for _, stages in jobs for s in stages if s["status"] == "COMPLETE")
    print(f"      razem: jobów {len(jobs)}, wykonanych stage'y {total_stages}, wykonanych tasków {total_tasks}")
    for job, stages in jobs:
        print(f"      job {job['jobId'] - first_job}: stage'y {job['numCompletedStages']} wykonane, {job['numSkippedStages']} pominięte")
        for s in stages:
            state = "wykonany " if s["status"] == "COMPLETE" else "pominięty"
            print(f"         stage {s['stageId'] - first_stage}: {state} tasków {s['numTasks']:>3}"
                  f"   shuffle: zapisane {s['shuffleWriteRecords']:>4}, odczytane {s['shuffleReadRecords']:>4} rekordów")


print("3. Joby, stage'e i taski jednej akcji (zapis do Parquet). Broadcast wyłączony, żeby join wymagał shuffle'u.")
spark.conf.set("spark.sql.autoBroadcastJoinThreshold", "-1")
for aqe in ("false", "true"):
    spark.conf.set("spark.sql.adaptive.enabled", aqe)
    print(f"   AQE {'włączone (domyślnie)' if aqe == 'true' else 'wyłączone'}")
    for name, build in QUERIES.items():
        print(f"   {name}")
        jobs = run(build())
        report(jobs)
        if aqe == "false" and name.startswith("C"):
            scan_a, scan_b = jobs[0][1][0], jobs[0][1][1]
            together = scan_b["submissionTime"] < scan_a["completionTime"] and scan_a["submissionTime"] < scan_b["completionTime"]
            print(f"      stage'e 0 i 1 (dwa niezależne odczyty) działały w tym samym czasie: {together}")
print()
print("   To samo zapytanie C z domyślnym progiem broadcast (mała tabela klientów mieści się w 10 MB)")
spark.conf.unset("spark.sql.autoBroadcastJoinThreshold")
for aqe in ("false", "true"):
    spark.conf.set("spark.sql.adaptive.enabled", aqe)
    print(f"   AQE {'włączone (domyślnie)' if aqe == 'true' else 'wyłączone'}")
    report(run(QUERIES["C. filter + join + groupBy"]()))
print()
spark.stop()

# --- 4. Nieudany task -------------------------------------------------------------
def flaky(index, rows):
    # Task dla partycji 1 pada przy pierwszej próbie. Przy ponowieniu attemptNumber() jest większy od zera.
    if index == 1 and TaskContext.get().attemptNumber() == 0:
        raise RuntimeError("celowa awaria taska")
    yield index, TaskContext.get().attemptNumber(), sum(1 for _ in rows)


print("4. Task dla partycji 1 pada przy pierwszej próbie (4 partycje)")
for master in ("local[3]", "local[3,4]"):
    spark = start(master)
    sc = spark.sparkContext
    rdd = sc.parallelize(range(400), 4).mapPartitionsWithIndex(flaky)
    try:
        result = sorted(rdd.collect())
        outcome = "job zakończony\n" + " " * 15 + "(partycja, numer próby): " + ", ".join(f"({p}, {a})" for p, a, _ in result)
    except Exception:
        outcome = "job przerwany wyjątkiem"
    stage = max(api("stages"), key=lambda s: s["stageId"])
    print(f"   {master:<11} maxFailures = {'4' if ',' in master else '1'}: {outcome}")
    done = f"udanych {stage['numCompleteTasks']}, " if stage["status"] == "COMPLETE" else ""
    print(f"   {'':<11} stage: tasków {stage['numTasks']}, {done}nieudanych prób {stage['numFailedTasks']}, stan {stage['status']}")
    spark.stop()

shutil.rmtree(tmp, ignore_errors=True)

"""
Lekcja 04: Spark Join Strategies. Ten sam join policzony trzema strategiami.

  1. dane i to, jak Spark szacuje ich rozmiar,
  2. trzy strategie dla tego samego joina: plan fizyczny i liczba rekordów zapisanych do shuffle'u,
  3. próg broadcastu porównywany z szacunkiem rozmiaru,
  4. filtr, którego szacunek nie widzi: plan przed wykonaniem i plan poprawiony przez AQE,
  5. hint a typ joina.

Dane są wymyślone: 2 000 klientów i 200 000 transakcji zapisane jako Parquet w katalogu tymczasowym.
Pomiar lokalny (jeden proces, trzy wątki). To obserwacje z tego uruchomienia, nie gwarancje Sparka.

Uruchomienie (wymaga Javy 17 lub nowszej):
    cd labs && uv run join_strategies/join_strategies_lab.py
"""
import json, re, shutil, tempfile, urllib.request
from pyspark.sql import SparkSession, functions as F

spark = (SparkSession.builder.master("local[3]").appName("join-strategies-lab")
         .config("spark.ui.showConsoleProgress", "false").getOrCreate())
sc = spark.sparkContext
sc.setLogLevel("OFF")
print(f"Spark {spark.version}, local[3]\n")

def api(what):
    return json.load(urllib.request.urlopen(f"{sc.uiWebUrl}/api/v1/applications/{sc.applicationId}/{what}"))

def shuffle_records(df):
    """Wykonuje plan bez zbierania wyniku (format noop) i zwraca rekordy zapisane do shuffle'u przez nowe stage'e."""
    before = {s["stageId"] for s in api("stages")}
    df.write.format("noop").mode("overwrite").save()
    return sorted(s["shuffleWriteRecords"] for s in api("stages") if s["stageId"] not in before and s["shuffleWriteRecords"] > 0)

JOINS = ("BroadcastHashJoin", "BroadcastNestedLoopJoin", "SortMergeJoin", "ShuffledHashJoin")

def executed(df):
    return df._jdf.queryExecution().executedPlan().toString()

def strategy(df):
    plan = executed(df)
    return next(s for s in JOINS if s in plan)

def show_plan(df):
    """Plan fizyczny bez identyfikatorów planu i bez ścieżki katalogu tymczasowego, żeby wydruk był powtarzalny."""
    text = executed(df).strip()
    text = re.sub(r", \[plan_id=\d+\]", "", text)
    text = re.sub(r"Location: InMemoryFileIndex\(1 paths\)\[[^\]]*\]", "Location: InMemoryFileIndex(1 paths)[...]", text)
    for line in text.splitlines():
        print("   " + line)

def estimate(df):
    """Szacowany rozmiar w bajtach, którego planista używa przy wyborze strategii."""
    return int(str(df._jdf.queryExecution().optimizedPlan().stats().sizeInBytes()))

# --- 1. Dane -----------------------------------------------------------------
tmp = tempfile.mkdtemp(prefix="osde-joins-")
countries = F.array(*[F.lit(c) for c in ("PL", "DE", "FR", "ES", "IT", "NL", "SE", "CZ")])
segments = F.array(*[F.lit(s) for s in ("consumer", "business", "premium")])
(spark.range(1, 2001).withColumnRenamed("id", "customer_id")
 .withColumn("country", F.element_at(countries, (F.col("customer_id") % 8 + 1).cast("int")))
 .withColumn("segment", F.element_at(segments, (F.col("customer_id") % 3 + 1).cast("int")))
 .coalesce(1).write.mode("overwrite").parquet(f"{tmp}/customers"))
(spark.range(1, 200_001).withColumnRenamed("id", "txn_id")
 .withColumn("customer_id", F.col("txn_id") % 2000 + 1)
 .withColumn("amount", ((F.col("txn_id") * 37) % 50_000 / 100).cast("decimal(10,2)"))
 .repartition(3).write.mode("overwrite").parquet(f"{tmp}/transactions"))

customers = spark.read.parquet(f"{tmp}/customers")
transactions = spark.read.parquet(f"{tmp}/transactions")
# Join potrzebuje z customers tylko dwóch kolumn, więc planista szacuje rozmiar po przycięciu kolumn.
side = customers.select("customer_id", "country")
est_full, est_side, est_transactions = estimate(customers), estimate(side), estimate(transactions)

print("1. Dane i szacunki rozmiaru")
print(f"   customers:    {customers.count()} wierszy, szacunek całej tabeli {est_full} b")
print(f"   customers, tylko kolumny potrzebne w joinie (customer_id, country): szacunek {est_side} b")
print(f"   transactions: {transactions.count()} wierszy, szacunek {est_transactions} b, partycji wejścia: {transactions.rdd.getNumPartitions()}")
for key in ("spark.sql.autoBroadcastJoinThreshold", "spark.sql.join.preferSortMergeJoin", "spark.sql.shuffle.partitions",
            "spark.sql.broadcastTimeout", "spark.sql.adaptive.enabled", "spark.sql.cbo.enabled"):
    print(f"   {key} = {spark.conf.get(key)}")
print()

# --- 2. Ten sam join, trzy strategie -------------------------------------------
print("2. Ten sam join, trzy strategie (AQE wyłączone, żeby plan był ostateczny od razu)")
spark.conf.set("spark.sql.adaptive.enabled", "false")
join = lambda t, c, how="inner": t.join(c, "customer_id", how).select("txn_id", "customer_id", "amount", "country")

print("\n   a) ustawienia domyślne")
show_plan(join(transactions, customers))
print("   rekordy zapisane do shuffle'u:", shuffle_records(join(transactions, customers)) or "brak")

spark.conf.set("spark.sql.autoBroadcastJoinThreshold", "-1")          # wyłącza automatyczny broadcast
print("\n   b) próg = -1")
show_plan(join(transactions, customers))
print("   rekordy zapisane do shuffle'u:", shuffle_records(join(transactions, customers)))

print("\n   c) próg = -1, hint SHUFFLE_HASH na customers")
show_plan(join(transactions, customers.hint("shuffle_hash")))
print("   rekordy zapisane do shuffle'u:", shuffle_records(join(transactions, customers.hint("shuffle_hash"))))

rows = {name: df.count() for name, df in (("broadcast", join(transactions, F.broadcast(customers))),
                                          ("sort-merge", join(transactions, customers)),
                                          ("shuffled hash", join(transactions, customers.hint("shuffle_hash"))))}
print("\n   wiersze wyniku:", rows)
print()

# --- 3. Próg kontra szacunek ---------------------------------------------------
print("3. Próg broadcastu jest porównywany z szacunkiem rozmiaru strony customers po przycięciu kolumn")
for value in (est_full, est_side + 1, est_side, est_side - 1):
    spark.conf.set("spark.sql.autoBroadcastJoinThreshold", str(value))
    print(f"   próg = {value} b (szacunek strony {value - est_side:+d} b): {strategy(join(transactions, customers))}")
spark.conf.unset("spark.sql.autoBroadcastJoinThreshold")
print()

# --- 4. Filtr, którego szacunek nie widzi ----------------------------------------
print("4. Filtr zostawia z customers garść wierszy, ale szacunek tego nie widzi")
few = customers.filter((F.col("country") == "PL") & (F.col("segment") == "premium"))
est_few = estimate(few.select("customer_id", "country"))
spark.conf.set("spark.sql.autoBroadcastJoinThreshold", str(est_few - 1))
print(f"   wierszy po filtrze: {few.count()} z {customers.count()}; szacunek strony po filtrze: {est_few} b; próg ustawiony na {est_few - 1} b")
print("   AQE wyłączone, strategia w planie:   ", strategy(join(transactions, few)))
spark.conf.set("spark.sql.adaptive.enabled", "true")
adaptive = join(transactions, few)
print("   AQE włączone, plan przed wykonaniem: ", strategy(adaptive))
result = adaptive.collect()                                           # wykonanie: AQE poznaje prawdziwe rozmiary
final = executed(adaptive).split("+- == Initial Plan ==")[0]
print("   AQE włączone, plan po wykonaniu:     ", next(s for s in JOINS if s in final), f"(wierszy wyniku: {len(result)})")
print("   plan końcowy:")
final = re.sub(r", \[plan_id=\d+\]", "", final).strip()
for line in re.sub(r"Location: InMemoryFileIndex\(1 paths\)\[[^\]]*\]", "Location: InMemoryFileIndex(1 paths)[...]", final).splitlines():
    print("   " + line)
spark.conf.set("spark.sql.adaptive.enabled", "false")
spark.conf.unset("spark.sql.autoBroadcastJoinThreshold")
print()

# --- 5. Hint a typ joina -------------------------------------------------------
print("5. Hint a typ joina (próg = -1, AQE wyłączone)")
spark.conf.set("spark.sql.autoBroadcastJoinThreshold", "-1")
b, sh = F.broadcast(customers), customers.hint("shuffle_hash")
print("   inner, broadcast(customers):                               ", strategy(join(transactions, b)))
print("   transactions LEFT JOIN broadcast(customers):               ", strategy(join(transactions, b, "left")))
print("   broadcast(customers) LEFT JOIN transactions:               ", strategy(join(b, transactions, "left")))
print("   transactions FULL OUTER JOIN broadcast(customers):         ", strategy(join(transactions, b, "full_outer")))
print("   transactions FULL OUTER JOIN customers z hintem SHUFFLE_HASH:", strategy(join(transactions, sh, "full_outer")))
print("   inner, hint MERGE przy progu domyślnym:                    ", end=" ")
spark.conf.unset("spark.sql.autoBroadcastJoinThreshold")
print(strategy(join(transactions, customers.hint("merge"))))
print("   inner, broadcast(customers) i SHUFFLE_HASH na transactions:", strategy(join(transactions.hint("shuffle_hash"), b)))

spark.stop()
shutil.rmtree(tmp, ignore_errors=True)

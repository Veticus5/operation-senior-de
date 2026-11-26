"""
Lazy evaluation w praktyce: pięć małych eksperymentów i dodatek z liczbami użytymi w zadaniach.

Uruchomienie (wymaga Javy 17 lub nowszej):
    cd labs && uv run lazy_evaluation/lazy_lab.py
albo bez uv:
    pip install pyspark==4.0.1 && python lazy_lab.py
"""
import json, logging, shutil, tempfile, time, urllib.request
from pyspark.sql import SparkSession, functions as F
from pyspark.sql.types import StringType

spark = (SparkSession.builder.master("local[3]").appName("lazy-lab")
         .config("spark.ui.showConsoleProgress", "false").getOrCreate())
sc = spark.sparkContext
sc.setLogLevel("OFF")
# PySpark 4 loguje każdy złapany błąd jako JSON ze stack trace. W labie błędy są zamierzone.
logging.getLogger("DataFrameQueryContextLogger").disabled = True
print(f"Spark {spark.version}, AQE={spark.conf.get('spark.sql.adaptive.enabled')}, "
      f"ANSI={spark.conf.get('spark.sql.ansi.enabled')}\n")

def jobs():
    """Liczba jobów uruchomionych do tej pory (z API Spark UI)."""
    url = f"{sc.uiWebUrl}/api/v1/applications/{sc.applicationId}/jobs"
    return len(json.load(urllib.request.urlopen(url)))

# --- dane: 9 subskrypcji zapisanych jako Parquet -----------------------------
rows = [(1, "A", "active", 9.99), (2, "B", "active", 4.99), (3, "C", "cancelled", 9.99),
        (4, "B", "active", 9.99), (5, "C", "active", 4.99), (6, "A", "cancelled", 9.99),
        (7, "C", "active", 9.99), (8, "A", "active", 4.99), (9, "B", "cancelled", 9.99)]
path = tempfile.mkdtemp() + "/subs.parquet"
(spark.createDataFrame(rows, "subscription_id int, publisher_id string, status string, price double")
      .coalesce(1).write.parquet(path))

# --- 1. Definicja kontra akcja ------------------------------------------------
before = jobs()
subs = spark.read.parquet(path)
print("1. read.parquet uruchomił jobów:", jobs() - before)

t = time.time()
active = subs.filter(F.col("status") == "active")
per_pub = active.groupBy("publisher_id").agg(F.count("*").alias("subs"), F.sum("price").alias("mrr"))
t_def = time.time() - t

before = jobs(); t = time.time()
per_pub.show()
print(f"   definicja: {t_def:.2f} s   show(): {time.time() - t:.2f} s   joby w show(): {jobs() - before}")
before = jobs(); per_pub.count()
print(f"   joby w count(): {jobs() - before}\n")

# --- 2. Co Spark zrobił z planem ---------------------------------------------
print("2. Plan po optymalizacji i skan pliku")
qe = per_pub._jdf.queryExecution()
print(qe.optimizedPlan().toString())
scan = [l.strip() for l in qe.executedPlan().toString().split("\n") if "FileScan" in l][0]
print("  ", scan[scan.index("PushedFilters"):], "\n")

# --- 3. Ile razy Spark przerabia wiersze -------------------------------------
def tracked_plan():
    """Ten sam plan co wyżej, ale filter przechodzi przez UDF, który liczy wiersze."""
    counter = sc.accumulator(0)
    def seen(status):
        counter.add(1)
        return status
    seen_udf = F.udf(seen, StringType())
    df = (subs.filter(seen_udf("status") == "active")
              .groupBy("publisher_id").agg(F.count("*").alias("subs"), F.sum("price").alias("mrr")))
    return df, counter

print("3. Wiersze, które przeszły przez filter (źródło ma 9)")
df, c = tracked_plan()
df._jdf.showString(20, 20, False); a = c.value          # show() bez drukowania tabeli
df.count();                        b = c.value
print(f"   bez cache:  po show() {a}, po count() {b}")

df, c = tracked_plan(); df.cache()
z = c.value
df._jdf.showString(20, 20, False); a = c.value
df.count();                        b = c.value
df._jdf.showString(20, 20, False); d = c.value
print(f"   z cache():  po cache() {z}, po show() {a}, po count() {b}, po drugim show() {d}")
df.unpersist()

df, c = tracked_plan()
df.collect(); a = c.value
df.collect(); b = c.value
print(f"   wyjątek:    collect() dwa razy na tym samym DataFrame: {a}, potem {b}\n")

# --- 4. Kiedy wychodzą błędy -------------------------------------------------
print("4. Błędy")
try:
    subs.filter(F.col("statu") == "active")
    print("   literówka w kolumnie: brak błędu przy definicji")
except Exception as e:
    print("   literówka w kolumnie: błąd od razu ->", str(e).split("]")[0] + "]")

raw = spark.createDataFrame([("1", "10"), ("2", "abc"), ("3", "30")], "id string, amount_str string")
typed = raw.withColumn("amount", F.col("amount_str").cast("int"))
big = typed.filter(F.col("amount") > 5)
print("   zły rzut typu: definicja przeszła bez błędu")
try:
    big.show()
except Exception as e:
    print("   zły rzut typu: błąd dopiero w show() ->", str(e).split("]")[0] + "]")

# --- 5. Jedna akcja, ile jobów? ----------------------------------------------
print("\n5. Joby na akcję (ten sam plan: filter + groupBy)")
for aqe in ("true", "false"):
    spark.conf.set("spark.sql.adaptive.enabled", aqe)
    df = (spark.read.parquet(path).filter(F.col("status") == "active")
               .groupBy("publisher_id").agg(F.sum("price")))
    b0 = jobs(); df._jdf.showString(20, 20, False); s = jobs() - b0
    b0 = jobs(); df.count();                        n = jobs() - b0
    b0 = jobs(); df.collect();                      k = jobs() - b0
    print(f"   AQE={aqe:5s}  show(): {s}   count(): {n}   collect(): {k}")

# --- Dodatek: pozostałe liczby, na które powołuje się lekcja ------------------
spark.conf.set("spark.sql.adaptive.enabled", "true")
print("\nDodatek")

def read_schema(df):
    plan = df._jdf.queryExecution().executedPlan().toString()
    line = [l for l in plan.split("\n") if "FileScan" in l][0]
    return line[line.index("ReadSchema"):].strip()

print("   count() na surowym pliku:  ", read_schema(subs.groupBy().count()))
print("   filter + count():          ", read_schema(subs.filter(F.col("status") == "active").groupBy().count()))

df, c = tracked_plan()
df._jdf.showString(20, 20, False); a = c.value
df.count();                        b = c.value
df._jdf.showString(20, 20, False); d = c.value
print(f"   show, count, show bez cache: {a}, {b}, {d}")

counter = sc.accumulator(0)
def seen(status):
    counter.add(1)
    return status
flat = subs.filter(F.udf(seen, StringType())("status") == "active")   # plan bez shuffle'u
flat.collect(); a = counter.value
flat.collect(); b = counter.value
print(f"   collect() dwa razy, plan bez shuffle'u: {a}, potem {b}")

csv_path = path.replace("subs.parquet", "subs.csv")
subs.coalesce(1).write.option("header", True).csv(csv_path)
b0 = jobs(); spark.read.option("header", True).csv(csv_path); h = jobs() - b0
b0 = jobs(); spark.read.option("header", True).option("inferSchema", True).csv(csv_path); i = jobs() - b0
print(f"   read.csv: z header {h} job, z header i inferSchema {i} joby")

spark.stop()
shutil.rmtree(path.rsplit("/", 1)[0], ignore_errors=True)

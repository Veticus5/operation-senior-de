"""
Lazy evaluation: warunki i wyjątki. Uzupełnienie lazy_lab.py.

lazy_lab.py pokazuje regułę. Ten skrypt sprawdza, kiedy reguła się kończy:
  A. kiedy druga akcja liczy wszystko od nowa, a kiedy Spark używa ponownie wyników shuffle'u,
  B. jak naprawdę wypełnia się cache(),
  C. od czego zależy moment zgłoszenia błędu,
  D. kiedy samo zdefiniowanie DataFrame uruchamia joba,
  E. skąd bierze się liczba jobów w show().

Wszystkie liczby to pomiar lokalny (jeden proces, trzy wątki). To obserwacje z tego
uruchomienia, nie gwarancje Sparka: zależą od wersji, planu i konfiguracji.

Uruchomienie (wymaga Javy 17 lub nowszej):
    cd labs && uv run lazy_evaluation/lazy_conditions_lab.py
"""
import json, logging, shutil, tempfile, urllib.request
from pyspark.sql import SparkSession, functions as F
from pyspark.sql.types import StringType
from pyspark.storagelevel import StorageLevel

tmp = tempfile.mkdtemp()
spark = (SparkSession.builder.master("local[3]").appName("lazy-conditions-lab")
         .config("spark.ui.showConsoleProgress", "false")
         .config("spark.sql.warehouse.dir", tmp + "/warehouse").getOrCreate())
sc = spark.sparkContext
sc.setLogLevel("OFF")
logging.getLogger("DataFrameQueryContextLogger").disabled = True
print(f"Spark {spark.version}, local[3], AQE={spark.conf.get('spark.sql.adaptive.enabled')}, "
      f"ANSI={spark.conf.get('spark.sql.ansi.enabled')}\n")

def api(what):
    return json.load(urllib.request.urlopen(f"{sc.uiWebUrl}/api/v1/applications/{sc.applicationId}/{what}"))

def jobs():
    """Liczba jobów uruchomionych do tej pory (z API Spark UI)."""
    return len(api("jobs"))

SCHEMA = "subscription_id int, publisher_id string, status string, price double"
rows = [(1, "A", "active", 9.99), (2, "B", "active", 4.99), (3, "C", "cancelled", 9.99),
        (4, "B", "active", 9.99), (5, "C", "active", 4.99), (6, "A", "cancelled", 9.99),
        (7, "C", "active", 9.99), (8, "A", "active", 4.99), (9, "B", "cancelled", 9.99)]
path = tmp + "/subs.parquet"
spark.createDataFrame(rows, SCHEMA).coalesce(1).write.parquet(path)
subs = spark.read.parquet(path)                      # 1 plik, 1 partycja

def tracked(src, shuffle=True):
    """filter przez UDF, który liczy wiersze. Z shuffle=True dochodzi groupBy (czyli shuffle)."""
    counter = sc.accumulator(0)
    def seen(status):
        counter.add(1)
        return status
    df = src.filter(F.udf(seen, StringType())("status") == "active")
    if shuffle:
        df = df.groupBy("publisher_id").agg(F.count("*").alias("subs"), F.sum("price").alias("mrr"))
    return df, counter

show = lambda d: d._jdf.showString(20, 20, False)    # show() bez drukowania tabeli

# --- A. Druga akcja: od nowa czy z ponownym użyciem? --------------------------
print("A. Licznik po pierwszej i po drugiej akcji (źródło ma 9 wierszy)")
CASES = [("collect(), collect()   ten sam DataFrame, plan z shuffle'em", True, lambda d: d.collect(), lambda d: d.collect()),
         ("show(), show()         ten sam DataFrame, plan z shuffle'em", True, show, show),
         ("count(), count()       ten sam DataFrame, plan z shuffle'em", True, lambda d: d.count(), lambda d: d.count()),
         ("show(), count()        ten sam DataFrame, plan z shuffle'em", True, show, lambda d: d.count()),
         ("collect(), potem collect() na DataFrame pochodnym (filter)  ", True, lambda d: d.collect(), lambda d: d.filter("subs > 0").collect()),
         ("collect(), collect()   ten sam DataFrame, plan bez shuffle'u", False, lambda d: d.collect(), lambda d: d.collect())]
for aqe in ("true", "false"):
    spark.conf.set("spark.sql.adaptive.enabled", aqe)
    for label, shuffle, first, second in CASES:
        df, c = tracked(subs, shuffle)
        first(df); a = c.value
        second(df); b = c.value
        print(f"   AQE={aqe:5s}  {label}: {a}, {b}   {'ponowne użycie' if b == a else 'liczone od nowa'}")
spark.conf.set("spark.sql.adaptive.enabled", "true")

df, c = tracked(subs)
df.collect(); df.collect()
last = api("jobs")[0]
print(f"   drugi collect() w Spark UI: stage'e wykonane {last['numCompletedStages']}, pominięte (skipped) {last['numSkippedStages']}\n")

# --- B. Jak wypełnia się cache() ----------------------------------------------
print("B. cache() na pliku w 3 partycjach (plan bez shuffle'u)")
path3 = tmp + "/subs3.parquet"
for i in range(3):                                   # 3 pliki po 3 wiersze
    spark.createDataFrame(rows[i * 3:(i + 1) * 3], SCHEMA).coalesce(1).write.mode("append").parquet(path3)
subs3 = spark.read.parquet(path3)

def cached():
    """(partycje w cache, wszystkie partycje) z zakładki Storage."""
    info = [(i.numCachedPartitions(), i.numPartitions()) for i in sc._jsc.sc().getRDDStorageInfo()]
    return f"{info[0][0]} z {info[0][1]} partycji w cache" if info else "cache pusty"

df, c = tracked(subs3, shuffle=False)
print(f"   partycji w źródle: {subs3.rdd.getNumPartitions()}")
df.cache();   print(f"   po cache():        licznik {c.value}, {cached()}")
df.take(1);   print(f"   po take(1):        licznik {c.value}, {cached()}")
df.count();   print(f"   po count():        licznik {c.value}, {cached()}")
df.count();   print(f"   po drugim count(): licznik {c.value}, {cached()}")
print(f"   poziom przechowywania: {df.storageLevel}"
      f"{'  (= MEMORY_AND_DISK_DESER)' if df.storageLevel == StorageLevel.MEMORY_AND_DISK_DESER else ''}")
before = c.value
df.filter(F.col("publisher_id") == "A").count()
print(f"   DataFrame pochodny (filter + count): licznik wzrósł o {c.value - before}  (czyta z cache)")
df.unpersist(); df.count()
print(f"   po unpersist() i count(): licznik {c.value}  (cache zniknął, plan liczony od nowa)")

base = subs.filter(F.col("status") == "active"); base.cache(); base.count()
again = subs.filter(F.col("status") == "active")     # ten sam plan zbudowany drugi raz, inna zmienna
hit = "InMemoryTableScan" in again._jdf.queryExecution().executedPlan().toString()
print(f"   identyczny plan zbudowany od zera też trafia w cache: {hit}\n")
base.unpersist()

# --- C. Od czego zależy moment błędu ------------------------------------------
print("C. Zły rzut typu ('abc' -> int): czy i kiedy będzie błąd")
def outcome(action):
    try:
        return f"bez błędu, wynik {action()}"
    except Exception as e:
        return "błąd " + str(e).split("]")[0] + "]"

raw = spark.createDataFrame([("1", "10"), ("2", "abc"), ("3", "30")], "id string, amount_str string")
typed = raw.withColumn("amount", F.col("amount_str").cast("int"))
print("   ANSI włączone, akcja używa kolumny amount (collect):  ", outcome(lambda: [r.amount for r in typed.collect()]))
print("   ANSI włączone, akcja nie używa amount (select id):    ", outcome(lambda: [r.id for r in typed.select("id").collect()]))
print("   ANSI włączone, count() na całym DataFrame:            ", outcome(lambda: typed.count()))
print("   ANSI włączone, try_cast zamiast cast:                 ",
      outcome(lambda: [r.amount for r in raw.withColumn("amount", F.expr("try_cast(amount_str as int)")).collect()]))
spark.conf.set("spark.sql.ansi.enabled", "false")
typed_legacy = raw.withColumn("amount", F.col("amount_str").cast("int"))   # zbudowany po zmianie ustawienia
print("   ANSI wyłączone, akcja używa kolumny amount (collect): ", outcome(lambda: [r.amount for r in typed_legacy.collect()]))
spark.conf.set("spark.sql.ansi.enabled", "true")
print()

# --- D. Kiedy sama definicja uruchamia joba -----------------------------------
print("D. Joby uruchomione przez samą definicję DataFrame")
b0 = jobs(); spark.read.parquet(path);                 print("   read.parquet(ścieżka), schemat z pliku:        ", jobs() - b0)
b0 = jobs(); spark.read.schema(SCHEMA).parquet(path);  print("   read.schema(...).parquet(ścieżka):             ", jobs() - b0)
subs.write.saveAsTable("subs_tbl")
b0 = jobs(); spark.table("subs_tbl").filter("status = 'active'"); print("   spark.table(...) + filter, schemat z katalogu: ", jobs() - b0)
b0 = jobs(); subs.groupBy("publisher_id").pivot("status").count()
print("   groupBy.pivot('status') bez listy wartości:    ", jobs() - b0, " (Spark musi poznać wartości od razu)")
b0 = jobs(); subs.groupBy("publisher_id").pivot("status", ["active", "cancelled"]).count()
print("   groupBy.pivot('status', [lista wartości]):     ", jobs() - b0, "\n")

# --- E. Skąd liczba jobów w show() bez AQE ------------------------------------
print("E. show() bez AQE: liczba jobów a liczba partycji po shuffle'u")
print(f"   spark.sql.limit.scaleUpFactor = {spark.conf.get('spark.sql.limit.scaleUpFactor')}")
spark.conf.set("spark.sql.adaptive.enabled", "false")
for n in (1, 5, 21, 200):
    spark.conf.set("spark.sql.shuffle.partitions", n)
    df = subs.filter(F.col("status") == "active").groupBy("publisher_id").agg(F.sum("price"))
    b0 = jobs(); show(df)
    print(f"   shuffle.partitions={n:<4d} joby w show(): {jobs() - b0}")
spark.conf.set("spark.sql.shuffle.partitions", 200)
spark.conf.set("spark.sql.adaptive.enabled", "true")

spark.stop()
shutil.rmtree(tmp, ignore_errors=True)

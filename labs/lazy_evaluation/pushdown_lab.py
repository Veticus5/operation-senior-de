"""
Predicate pushdown na Parquet: co naprawdę oznacza PushedFilters.

Plik Parquet jest podzielony na row groups (grupy wierszy). W stopce pliku każda grupa może mieć
zapisane min i max dla każdej kolumny. Czytnik, który dostał warunek filtra, może pominąć grupę,
jeśli z min i max wynika, że żaden wiersz w niej warunku nie spełni.

Skrypt zapisuje te same 400 000 wierszy dwa razy: posortowane po kolumnie filtra i nieposortowane.
Potem liczy, ile wierszy skan faktycznie oddał Sparkowi (metryka numOutputRows węzła FileScan).

Wniosek z pomiaru: PushedFilters mówi, jaki warunek Spark przekazał do źródła. Nie mówi,
ile danych dzięki temu pominięto. To zależy od statystyk w pliku i ułożenia danych.

Uruchomienie (wymaga Javy 17 lub nowszej):
    cd labs && uv run lazy_evaluation/pushdown_lab.py
"""
import glob, shutil, tempfile
from pyspark.sql import SparkSession, functions as F

spark = (SparkSession.builder.master("local[3]").appName("pushdown-lab")
         .config("spark.ui.showConsoleProgress", "false").getOrCreate())
sc = spark.sparkContext
sc.setLogLevel("OFF")
print(f"Spark {spark.version}, local[3]\n")

N, LIMIT = 400_000, 4500
tmp = tempfile.mkdtemp()
base = (spark.range(0, N)
        .withColumn("amount", (F.col("id") % 5000).cast("int"))            # wartości 0..4999
        .withColumn("pad", F.sha2(F.col("id").cast("string"), 256)))       # wypełniacz, żeby plik miał wiele row groups

def write(df, name):
    path = f"{tmp}/{name}"
    # parquet.block.size to docelowy rozmiar row group. 1 MB zamiast domyślnych 128 MB, żeby grup było kilkadziesiąt.
    df.coalesce(1).write.option("parquet.block.size", 1024 * 1024).parquet(path)
    return path

def row_groups(path):
    """Min i max kolumny amount oraz liczba wierszy każdej row group, prosto ze stopki pliku."""
    jvm = sc._jvm
    file = glob.glob(path + "/*.parquet")[0]
    source = jvm.org.apache.parquet.hadoop.util.HadoopInputFile.fromPath(
        jvm.org.apache.hadoop.fs.Path(file), sc._jsc.hadoopConfiguration())
    reader = jvm.org.apache.parquet.hadoop.ParquetFileReader.open(source)
    out = []
    for block in reader.getFooter().getBlocks():
        for col in block.getColumns():
            if col.getPath().toDotString() == "amount":
                stats = col.getStatistics()
                out.append((stats.genericGetMin(), stats.genericGetMax(), block.getRowCount()))
    reader.close()
    return out

def scan(path, pushdown):
    """Wykonuje filtr i zwraca (wiersze wyniku, wiersze oddane przez skan, PushedFilters z planu)."""
    spark.conf.set("spark.sql.parquet.filterPushdown", pushdown)
    df = spark.read.parquet(path).filter(F.col("amount") > LIMIT).select("id", "amount")
    result = len(df.collect())
    plan = df._jdf.queryExecution().executedPlan()
    scanned = plan.collectLeaves().apply(0).metrics().apply("numOutputRows").value()
    line = [l for l in plan.toString().split("\n") if "FileScan" in l][0]
    pushed = line[line.index("PushedFilters"):line.index(", ReadSchema")]
    return result, scanned, pushed

print(f"Filtr: amount > {LIMIT}. Wierszy w pliku: {N}.\n")
for name, df in (("posortowane po amount", base.orderBy("amount")), ("nieposortowane", base)):
    path = write(df, name.split()[0])
    groups = row_groups(path)
    may_match = [g for g in groups if g[1] > LIMIT]          # grupy, których max dopuszcza trafienie
    print(f"{name}: {len(groups)} row groups")
    print(f"   min..max amount w pierwszych trzech grupach: {', '.join(f'{g[0]}..{g[1]}' for g in groups[:3])}")
    print(f"   grup, w których max > {LIMIT}: {len(may_match)} z {len(groups)}, mają razem {sum(g[2] for g in may_match)} wierszy")
    for pushdown in ("true", "false"):
        result, scanned, pushed = scan(path, pushdown)
        print(f"   filterPushdown={pushdown:5s}  skan oddał {scanned:>6d} wierszy, wynik {result}   {pushed}")
    print()

spark.conf.set("spark.sql.parquet.filterPushdown", "true")
spark.stop()
shutil.rmtree(tmp, ignore_errors=True)

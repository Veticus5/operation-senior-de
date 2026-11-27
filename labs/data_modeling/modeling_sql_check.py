"""Sprawdzenie liczb z lekcji „Advanced Data Modeling & Dimensional Architecture".

Lekcja pokazuje wyniki liczone w przeglądarce z małego, wymyślonego zbioru danych. Ten skrypt ładuje
ten sam zbiór do SQLite (w pamięci) i wykonuje zapytania SQL z lekcji, żeby liczby dało się odtworzyć
poza interfejsem. To nie jest pomiar wydajności ani lab Sparka: sprawdza wyłącznie poprawność wyników.

Uruchomienie (sama biblioteka standardowa, bez zależności):

    python3 labs/data_modeling/modeling_sql_check.py

Zakres: SQLite z biblioteki standardowej Pythona. Składnia jest zwykłym SQL-em, ale złączenie
punkt-w-czasie jest tu zapisane jako warunek zakresu, a nie jako ASOF JOIN ze Snowflake.
"""

import sqlite3

db = sqlite3.connect(":memory:")
db.executescript(
    """
    CREATE TABLE publishers (publisher_id TEXT, publisher_name TEXT);
    INSERT INTO publishers VALUES ('PUB-AUR', 'Aurora Sport'), ('PUB-KIN', 'Kino Nord');

    CREATE TABLE products (product_id TEXT, product_name TEXT, publisher_id TEXT);
    INSERT INTO products VALUES
      ('SPORT-M', 'Sport Monthly', 'PUB-AUR'),
      ('SPORT-Y', 'Sport Annual', 'PUB-AUR'),
      ('KINO-M', 'Kino Monthly', 'PUB-KIN');

    -- Stan subskrypcji na koniec lutego 2026.
    CREATE TABLE subscriptions (subscription_id TEXT, customer_id TEXT, product_id TEXT, mrr_eur REAL);
    INSERT INTO subscriptions VALUES
      ('S-1', 'C-101', 'SPORT-M', 10), ('S-2', 'C-102', 'SPORT-M', 10),
      ('S-3', 'C-102', 'KINO-M', 8), ('S-4', 'C-103', 'SPORT-Y', 8);

    CREATE TABLE transactions (txn_id TEXT, paid_at TEXT, subscription_id TEXT, txn_type TEXT, amount_eur REAL);
    INSERT INTO transactions VALUES
      ('T-1', '2026-01-05', 'S-1', 'payment', 10), ('T-2', '2026-01-15', 'S-2', 'payment', 10),
      ('T-3', '2026-01-20', 'S-4', 'payment', 96), ('T-4', '2026-02-01', 'S-3', 'payment', 8),
      ('T-5', '2026-02-05', 'S-1', 'payment', 10), ('T-6', '2026-02-15', 'S-2', 'payment', 10),
      ('T-7', '2026-03-01', 'S-3', 'payment', 8), ('T-8', '2026-03-05', 'S-1', 'payment', 10),
      ('T-9', '2026-03-15', 'S-2', 'payment', 10), ('T-10', '2026-03-18', 'S-2', 'refund', -10);

    -- Wymiar klienta z historią (SCD typu 2). Przedziały są lewostronnie domknięte: [valid_from, valid_to).
    CREATE TABLE dim_customer (customer_key INT, customer_id TEXT, country TEXT, valid_from TEXT, valid_to TEXT, is_current INT);
    INSERT INTO dim_customer VALUES
      (1, 'C-101', 'PL', '2026-01-05', '9999-12-31', 1),
      (2, 'C-102', 'DE', '2026-01-08', '2026-02-10', 0),
      (3, 'C-103', 'FR', '2026-01-20', '9999-12-31', 1),
      (4, 'C-102', 'PL', '2026-02-10', '9999-12-31', 1);

    -- Stan na koniec miesiąca: jeden wiersz na aktywną subskrypcję.
    CREATE TABLE snapshot (month_end TEXT, subscription_id TEXT, mrr_eur REAL);
    INSERT INTO snapshot VALUES
      ('2026-01-31', 'S-1', 10), ('2026-01-31', 'S-2', 10), ('2026-01-31', 'S-4', 8),
      ('2026-02-28', 'S-1', 10), ('2026-02-28', 'S-2', 10), ('2026-02-28', 'S-3', 8), ('2026-02-28', 'S-4', 8),
      ('2026-03-31', 'S-1', 10), ('2026-03-31', 'S-3', 8), ('2026-03-31', 'S-4', 8);

    CREATE TABLE bridge_product_category (product_id TEXT, category TEXT, weight REAL);
    INSERT INTO bridge_product_category VALUES
      ('SPORT-M', 'Football', 0.5), ('SPORT-M', 'Tennis', 0.5),
      ('SPORT-Y', 'Football', 0.5), ('SPORT-Y', 'Tennis', 0.5), ('KINO-M', 'Film', 1.0);
    """
)


def show(title: str, sql: str) -> None:
    print(f"\n== {title}")
    for row in db.execute(sql):
        print("  ", " | ".join(str(v) for v in row))


show("Wpłaty w lutym (oczekiwane: 28)", "SELECT SUM(amount_eur) FROM transactions WHERE paid_at >= '2026-02-01' AND paid_at < '2026-03-01'")
show("MRR na koniec lutego (oczekiwane: 36)", "SELECT SUM(mrr_eur) FROM subscriptions")
show(
    "Fan-out: MRR po joinie z transakcjami do końca lutego (oczekiwane: Aurora 48 | 136, Kino 8 | 8, razem MRR 56)",
    """
    SELECT p.publisher_name, SUM(s.mrr_eur) AS mrr, SUM(t.amount_eur) AS revenue
    FROM subscriptions s
    JOIN transactions t ON t.subscription_id = s.subscription_id
    JOIN products pr ON pr.product_id = s.product_id
    JOIN publishers p ON p.publisher_id = pr.publisher_id
    WHERE t.paid_at < '2026-03-01'
    GROUP BY p.publisher_name ORDER BY 1
    """,
)
show(
    "Najpierw agregacja do ziarna subskrypcji (oczekiwane: Aurora 28 | 136, Kino 8 | 8)",
    """
    WITH revenue AS (
      SELECT subscription_id, SUM(amount_eur) AS revenue
      FROM transactions WHERE paid_at < '2026-03-01' GROUP BY subscription_id
    )
    SELECT p.publisher_name, SUM(s.mrr_eur) AS mrr, SUM(r.revenue) AS revenue
    FROM subscriptions s
    LEFT JOIN revenue r ON r.subscription_id = s.subscription_id
    JOIN products pr ON pr.product_id = s.product_id
    JOIN publishers p ON p.publisher_id = pr.publisher_id
    GROUP BY p.publisher_name ORDER BY 1
    """,
)
show("MRR na koniec miesiąca (oczekiwane: 28, 36, 26; suma po miesiącach 90 nie ma sensu)", "SELECT month_end, SUM(mrr_eur) FROM snapshot GROUP BY month_end ORDER BY 1")
show(
    "Odsetek zwrotów per produkt (oczekiwane: KINO-M 0.0, SPORT-M 0.167, SPORT-Y 0.0)",
    """
    SELECT s.product_id,
           ROUND(1.0 * SUM(t.txn_type = 'refund') / SUM(t.txn_type = 'payment'), 3)
    FROM transactions t JOIN subscriptions s ON s.subscription_id = t.subscription_id
    GROUP BY s.product_id ORDER BY 1
    """,
)
show("Odsetek zwrotów łącznie (oczekiwane: 0.111, a średnia z trzech odsetków to 0.056)", "SELECT ROUND(1.0 * SUM(txn_type = 'refund') / SUM(txn_type = 'payment'), 3) FROM transactions")

PIT = """
    SELECT d.country, SUM(t.amount_eur)
    FROM transactions t
    JOIN subscriptions s ON s.subscription_id = t.subscription_id
    JOIN dim_customer d ON d.customer_id = s.customer_id {extra}
    GROUP BY d.country ORDER BY 1
"""
show("Przychód per kraj, złączenie punkt-w-czasie = raport SCD2 (oczekiwane: DE 18, FR 96, PL 48)", PIT.format(extra="AND t.paid_at >= d.valid_from AND t.paid_at < d.valid_to"))
show("Przychód per kraj, tylko wiersz bieżący = raport SCD1 (oczekiwane: FR 96, PL 66)", PIT.format(extra="AND d.is_current = 1"))
show("Przychód per kraj, join po samym kluczu naturalnym (oczekiwane: DE 36, FR 96, PL 66, razem 198 zamiast 162)", PIT.format(extra=""))

BRIDGE = """
    SELECT b.category, SUM(t.amount_eur{w})
    FROM transactions t
    JOIN subscriptions s ON s.subscription_id = t.subscription_id
    JOIN bridge_product_category b ON b.product_id = s.product_id
    GROUP BY b.category ORDER BY 1
"""
show("Most bez wag (oczekiwane: Film 16, Football 146, Tennis 146, razem 308)", BRIDGE.format(w=""))
show("Most z wagami (oczekiwane: Film 16, Football 73, Tennis 73, razem 162)", BRIDGE.format(w=" * b.weight"))
show(
    "Przychód per wydawca, czyli to, co widzi rola po filtrze RLS (oczekiwane: Aurora 146, Kino 16)",
    """
    SELECT p.publisher_name, SUM(t.amount_eur)
    FROM transactions t
    JOIN subscriptions s ON s.subscription_id = t.subscription_id
    JOIN products pr ON pr.product_id = s.product_id
    JOIN publishers p ON p.publisher_id = pr.publisher_id
    GROUP BY p.publisher_name ORDER BY 1
    """,
)

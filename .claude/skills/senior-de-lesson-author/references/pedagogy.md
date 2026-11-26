# Pedagogical standard

Audience: an experienced SQL/Python/data warehouse engineer learning Spark and Databricks. Do not reteach programming basics unnecessarily, but do not assume familiarity with Spark internals.

## Explain in dependency order
Problem -> familiar example -> intuition -> new technical term -> mechanism -> consequence -> verification.
Define a required term before using it as an explanation. For supporting terms, a short expandable definition may suffice. Keep main text focused on the current learning objective.

Bad: "PushedFilters means the condition reaches the Parquet reader, which skips blocks."
Better: "Suppose a file stores transactions in groups of rows. A Parquet file can contain min/max statistics for each group. If a query needs amount > 1000, and a group's maximum is 850, that group cannot contain a match. Spark can pass a supported filter to the reader to help skip such groups. This is predicate pushdown. PushedFilters in the scan plan shows the filter was passed, not that any particular group was skipped."

Explain plan nodes one at a time, from source toward result; distinguish logical plan nodes from physical scan information. Connect Filter to WHERE, Project to SELECT, Aggregate to GROUP BY. Explain internal IDs only if they appear in the example.

## Visual and practical learning
Use small, realistic datasets; show before/after, data flow and cause/effect. Every interaction should answer a learning question. Label illustrative simulation separately from measured output. Provide code, assumptions, expected behavior, and explanation of surprising results. For optional detail, use progressive disclosure rather than a wall of text.

## Interview Bank
Quick answer: clear, natural PL/EN, usually 30–60 seconds; lead with the actual answer, then why and one practical implication. Separate senior depth and optional mechanism explanation. At least three follow-ups should exercise understanding, not just definitions. No unsupported first-person experience claims. Maintain links to lessons when available; bank remains independently usable.

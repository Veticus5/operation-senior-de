# Pedagogical standard

Audience: an experienced SQL/Python/data warehouse engineer learning Spark and Databricks. Do not reteach programming basics unnecessarily, but do not assume familiarity with Spark internals.

## Explain in dependency order
Problem -> familiar example -> intuition -> new technical term -> mechanism -> consequence -> verification.
Define a required term before using it as an explanation. For supporting terms, a short expandable definition may suffice. Keep main text focused on the current learning objective.

Bad: "PushedFilters means the condition reaches the Parquet reader, which skips blocks."
Better: "Suppose a file stores transactions in groups of rows. A Parquet file can contain min/max statistics for each group. If a query needs amount > 1000, and a group's maximum is 850, that group cannot contain a match. Spark can pass a supported filter to the reader to help skip such groups. This is predicate pushdown. PushedFilters in the scan plan shows the filter was passed, not that any particular group was skipped."

Explain plan nodes one at a time, from source toward result; distinguish logical plan nodes from physical scan information. Connect Filter to WHERE, Project to SELECT, Aggregate to GROUP BY. Explain internal IDs only if they appear in the example.

## Visual and practical learning
### Visual-first is the default for Academy lessons

The primary path teaches a mechanism, not a documentation page. Each small learning unit should have one question, one main visual or concrete example, one observable result, and one short takeaway. Sequence:

1. Ask a concrete question and supply only the prerequisites necessary to try it (usually 1–3 short sentences).
2. Show the data, plan, flow or state. Let the learner predict or manipulate one relevant variable when interaction adds value.
3. Make the consequence immediately visible: changed records, a counter, a highlighted path, or a before/after.
4. Name the concept and explain why it happened in a short takeaway. Include any qualification required to avoid a false mental model.
5. Put implementation detail, full plan, benchmark, optional analogy and interview depth behind independently expandable sections or in the existing Practice/Interview stages. Keep essential context visible.

Do not lead with multiple paragraphs of theory and then repeat them below a simulation. Avoid consecutive walls of text, decorative cards, repetitive badges, and controls that merely reveal prose. These are editorial guidelines, not rigid word-count limits: use longer explanations when a mechanism genuinely needs them, split them into coherent steps, and keep the default view focused. Do not force animation or a simulator onto a topic better taught with a compact SQL example, diagram or code exercise.

### Concrete patterns (reuse existing components; no new framework)

- Predicate pushdown: ask "Czy musimy przeczytać cały plik?" Show four illustrative Parquet row groups with min/max statistics, a filter control and sorted/scattered toggle. For amount > 1000 and maxima 400, 850, 1800, 5000, distinguish the two groups that can be skipped from the two that must be considered in this simplified model. Show "2 z 4 grup" and explain that supported pushdown plus suitable statistics can eliminate groups; the remaining groups may still contain nonmatching rows. Keep measured results, scan-plan interpretation and Snowflake comparison collapsed or in Practice. PushedFilters is not evidence that I/O was saved.
- Lazy evaluation: add filter/select/groupBy steps, show the growing plan and unchanged rows, then trigger an action and show the result. State that metadata discovery and some operations can execute eagerly; do not imply that all operations before an action do zero work.
- Shuffle: show input partitions with colored keys, then redistribute the records (or explicitly labeled partial aggregates) by key; highlight where data moves and why. Do not imply that every original row always travels over the network.
- Data skew: show unequal partition/task workloads and their completion times, then compare with a better distribution. Label timings as illustrative; unequal workloads are one possible explanation of stragglers, not proof.
- Delta time travel: show a sequence of table versions; select a version and display its snapshot. Explain that historical reads depend on retained data and log availability.

Bad default layout: theory paragraphs → simulator → another explanation → full benchmark → full analogy, all expanded.
Better default layout: question → meaningful visual → visible result → concise takeaway → optional detail on demand.

Use small realistic datasets, meaningful accessible controls and clear labels. Simulations are not measured execution. Keep verified labs, assumptions, expected output and surprising results available without forcing the learner to read all of them at once. Do not remove technical depth just to shorten the default path.

## Interview Bank
Quick answer: clear, natural PL/EN, usually 30–60 seconds; lead with the actual answer, then why and one practical implication. Separate senior depth and optional mechanism explanation. At least three follow-ups should exercise understanding, not just definitions. No unsupported first-person experience claims. Maintain links to lessons when available; bank remains independently usable.

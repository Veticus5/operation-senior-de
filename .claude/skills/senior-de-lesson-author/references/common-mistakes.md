# Recurring review findings

Initial rules derived from MVP review, issue #1. Verify technical details against the relevant official documentation and version before publishing. These are review checks, not a replacement for sources.

| Avoid | Prefer |
| --- | --- |
| "Nothing is read until an action." | Distinguish row processing from schema discovery, metadata and plan analysis. |
| "Nothing is remembered between actions." | Another action may recompute some or all of the plan; reuse, caching and eviction matter. |
| "One action always means one job." | An action triggers execution; job count depends on plan and configuration. |
| "Every task writes shuffle files." | Shuffle-producing stages write shuffle output; final tasks need not. |
| "Partition count is simultaneous parallelism." | Task count and available execution slots are different. |
| "Driver never processes data." | Driver coordinates execution and can perform local work, including handling collected results. |
| "Every wide operation moves all rows with the same key." | Explain dependencies and redistribution; account for partial aggregation, range partitioning and existing distribution. |
| "Narrow means one input partition per output partition." | A narrow dependency reads one or a few whole parent partitions and never splits a parent across many children; coalesce without shuffle is narrow. Logical groupBy/join need not add a physical shuffle. |
| "Empty tasks mean the data is not skewed" (or any quiz implying two symptoms exclude each other). | Empty and overloaded partitions can coexist; judge skew by the size distribution of non-empty partitions. |
| "round-robin gives equal partitions" / "AQE coalesces to 64 MB". | Round-robin gives similar row counts, not equal bytes. 64 MB is advisory (ignored by default with parallelismFirst), 128 MB is a file-scan planning limit. |
| "Exchange always means shuffle." | BroadcastExchange is a distinct exchange type. |
| "A broadcast hint forces the strategy." | A hint requests/prioritizes a strategy; applicability and constraints matter. |
| "PushedFilters proves data was skipped." | It shows filter pushdown; actual skipping depends on source, metadata and data. |
| "Without watermark all state grows forever." | State cleanup depends on the stateful operator, output mode and configuration. |
| "Transactional sink automatically gives exactly-once." | Check replay, checkpoint, sink semantics and idempotency; foreachBatch needs special care. |
| "Predictive optimization always runs maintenance." | Qualify by enablement, eligibility and product/version. |
| "Bronze/Silver/Gold equals dbt staging/intermediate/marts." | A useful analogy, not a one-to-one mapping. Replay depends on retention. |
| "I measured X" in an interview answer before the learner ran a lab. | Attribute the result to the supplied lab; use first person only after actual execution. |
| "The lab ran in X seconds, therefore production runs in Y." | Report measured environment and result; don't extrapolate without evidence. |

When addressing review, record a new generalized rule only if it is useful for future content and grounded in evidence. Include a short bad/better example if possible. Avoid accumulating long historical transcripts.

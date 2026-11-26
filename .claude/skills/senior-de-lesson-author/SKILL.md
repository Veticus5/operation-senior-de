---
name: senior-de-lesson-author
description: Create, revise, or review Senior Data Engineer learning lessons, interview questions, Spark and Databricks visualizations, and labs in operation-senior-de. Use when asked to teach a topic, add interview questions, address educational feedback, or prepare a content PR.
---

# Senior DE lesson author

The outcome is interview readiness and real understanding, not a larger platform.

## Workflow
1. Read the repository's AGENTS.md, existing content model and relevant lesson/question files. Use the existing design and components. Inspect only relevant files, not the whole repository by default.
2. Identify the learner's known concepts (SQL, Python, Snowflake, dbt) and the minimum prerequisites for this topic. Define a concrete problem and one learning outcome before writing.
3. Read [pedagogical standard](references/pedagogy.md) and [recurring mistakes](references/common-mistakes.md). For new content, consult [acceptance checklist](references/lesson-checklist.md) before publishing.
4. Verify material technical claims against official documentation for the relevant product/version; use reproducible labs for measured claims. Update docs/verified-facts.md. Label uncertainties, assumptions, and simulations.
5. For a lesson, build intuition, explain the mechanism, add a meaningful interaction or code experiment if useful, then interview practice and a short knowledge check. Teach one new concept at a time. For Interview Bank, use concise PL/EN spoken answers, optional depth, at least three useful follow-ups, common mistakes and optional explanations of unfamiliar terms. Reuse shared content and stable IDs where practical.
6. Run the checklist before a PR. Fix material defects rather than simply reporting them. Run npm run check and relevant lab/UI checks where available; report real results and limitations. Open a dedicated branch/PR for substantial changes; never merge without the owner's approval.

## Core rules
- Never explain an unfamiliar term using another unexplained term. Explain essential terms inline at first use and peripheral terms through accessible expandable definitions; avoid unnecessary jargon.
- Prefer a concrete example to a definition alone. Explain what happens, why, and how to verify it. Use familiar SQL/Snowflake/dbt analogies only within their limits.
- Do not invent production experience or claim a learner has run a lab before they have. Use conditional, design-oriented answers when appropriate.
- Do not create a new simulator, dependency, abstraction or full lesson merely because a small text change would work.
- Keep this skill focused; when a confirmed review finding generalizes, add a compact rule and example to common-mistakes.md in the relevant PR. Do not copy entire review threads or speculative findings.

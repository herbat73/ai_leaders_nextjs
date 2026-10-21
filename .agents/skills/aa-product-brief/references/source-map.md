# Source categories — what to take from each

Classify concept docs by content. One file may cover several categories (e.g. "users and needs" often includes legal context and a permission matrix).

| Category | Recognise by | Extract | Feeds brief section |
|---|---|---|---|
| **Users** | personas, roles, segments, needs, pains, permission matrix | role, situation, need, current workaround, permissions | Target group and stakeholders; Problems; Glossary |
| **Use cases / flows** | `UC-xx`, actors, main/alternative/exception flows, status model, sequence/state diagrams | id, actor, goal, trigger, outcome, statuses, rules referenced | Key flows; Scope; Business rules |
| **Screen map** | screen inventory, ids (`K-01`…), routes, navigation, apps/shells | screen id, app/shell, access role, route, navigation edges | Concept surface; Traceability |
| **Screen specs** | per-screen purpose, components, states, validations, API calls | validations and states that encode rules; empty/error/loading states | Business rules; Traceability |
| **Targets / goals** | KPIs, metrics, success criteria, SLAs, business goals, numbers with units | metric, baseline (if measured), target, owner, date | Goals and success criteria; Kill criteria |
| **Rules / legal** | regulations, deadlines (e.g. 14-day return, 2-year warranty), policies, thresholds | rule wording, threshold, source (law/policy), who applies it | Business rules; Riskiest assumptions |
| **API / data model** | endpoints, entities, webhooks, error codes | main entities and their lifecycle only | Domain glossary; Open questions (integrations) |
| **Benchmark** | named reference products, "inspired by", comparisons | what pattern was taken, from whom | Product and how it stands out |
| **Limitations** | "mockup limits", "out of scope", "not in v1" | what is excluded or faked | Non-goals; Concept surface |

## Gaps

If a category has no source, write it in the brief as a short deferral and, if it matters for the next decision, an Open question. Common gaps in concept packages:

- **Targets** — no KPIs or baselines. Do not invent numbers; ask who owns the goal.
- **Evidence for users' problems** — needs are described but no research is cited. Problems stay `[ASSUMPTION]`.
- **Non-goals** — rarely explicit; propose candidates from "Limitations" as `proposal` rows.

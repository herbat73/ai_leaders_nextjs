# Evidence tags

Same tags as `om-discover` (see `.agents/skills/om-discover/references/evidence-tiers.md` for the full rules), applied to concept material:

| Tag | Use for | Concept example |
|---|---|---|
| `[DOCUMENT]` | what the concept docs specify or decide; law/policy cited by them | "UC-02 lets a guest start a return by order number" |
| `[PRODUCT]` | what the mockup or repo code implements | "auto-approval rule R1 implemented in `mockup/src/logic.ts:120`" |
| `[BENCHMARK]` | a reference product **checked** at a link on a date | only if the docs give link + date, or you checked it with the user's consent |
| `[INTERVIEW]` / `[DATA]` | only when the concept cites real interviews, tickets, analytics | rare in concept packages — never assume |
| `[ASSUMPTION]` | any claim about real users, frequency, value, demand, or a target without baseline | "customers prefer self-service returns" |
| `[SYNTHETIC]` | persona walkthroughs — only in *Hypotheses to test* | — |

## Rules of thumb for concept packages

- "Users need X" written in a concept doc = `[DOCUMENT]` that X is specified **and** `[ASSUMPTION]` that users need it. Write them as two lines.
- "Inspired by <product>" without a checked link = `[DOCUMENT]` design choice, not `[BENCHMARK]`.
- A law quoted by the docs is `[DOCUMENT]`; its interpretation for this product is a rule (`R..`) with status `proposal` until a human confirms it.
- Coverage counting follows the `om-discover` rule: count tagged body lines once; exclude header, Decision summary, Hypotheses to test, Concept surface, Traceability, Definition of Ready addendum and Collection plan. `scripts/count-coverage.mjs` implements exactly this rule.

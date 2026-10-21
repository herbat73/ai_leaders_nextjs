# Reading the mockup

The mockup is evidence of **what was designed**, read statically. Never run its build, package scripts or tests.

## Order

1. `mockup/README*` and the concept `README.md` — how to open it, demo data, click-through paths, stated limitations.
2. Entry point — `index.html` (and `package.json` only to learn the stack; don't install).
3. Routes — the router / route table (`router.ts`, `routes.*`, `App.*`, framework pages dir). List every route with the screen it renders.
4. Screens — the screens/pages folder. Map each to a screen id from the screen map. Many mockups put ids in comments, titles or a "screen map" demo panel; search for the id pattern (e.g. `K-\d+`, `B-\d+`).
5. Domain — types/model files: entities, enums, statuses. Compare statuses with the docs' status model.
6. Logic — eligibility, validation, rule engines, calculations, recommendation heuristics. Extract thresholds and conditions (e.g. "auto-approve when value ≤ 60") and compare with doc rules.
7. Simulation — fake API, latency/error scenarios, local storage, fake SSO/CAPTCHA/QR/PDF/AI. List them under *Concept surface → simulated*.

## Recording

- Point to `path:line` for each fact taken from code.
- A route without a screen id, or an id without a route, is a traceability gap.
- Code values beat nothing but don't beat docs: when they differ, record both and raise a Q.
- Compiled bundles (`dist/`, minified files) are not read unless source is absent.

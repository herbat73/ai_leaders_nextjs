# Getting started

Back to the [README](./README.md).

Requirements: Node.js 20.19+ (Next.js needs 20.9+, but the test runner's Vite needs 20.19+) and, for the local database, either PostgreSQL binaries (Linux, macOS or WSL) or Docker with the compose plugin (any OS, including native Windows).

```bash
npm run setup      # installs dependencies, starts local PostgreSQL, runs migrations, seeds dev data
npm run dev        # starts @easyrms/app
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

`npm run setup` is idempotent: re-running it skips every step that is already done (dependencies up to date, database reachable, no pending migrations) and prints which ones were skipped. It starts only the default local database: with `scripts/db.sh` when PostgreSQL binaries are found, otherwise with `docker compose up -d --wait postgres` (`docker-compose.yml`, same credentials and port 5432); if you set `EASYRMS_DATABASE_URL` to another PostgreSQL, start that yourself and setup only runs the migrations (and does not seed it).

**Dev seed data.** On a fresh local database setup also runs `npm run seed:dev`, which creates two suppliers (`First Supplier`, `firstsupplier@example.com`; `Another Supplier`, `anothersupplier@example.com`) and one administrator with the `MANAGE_RULES` permission: **`admin@example.com` / `123412341234`**. Sign in at `/admin/login` and the supplier-claim flow works at once. The password is public (it is in the repository), so this is for local development only: the seeder refuses to run when `NODE_ENV=production`, and setup never seeds a database selected through `EASYRMS_DATABASE_URL`. `npm run seed:dev` is safe to rerun: an existing supplier (same name) and an `active` or `disabled` agent with that e-mail are left as they are, so it never resets a password you changed or re-enables an account (an agent left `invited` by an interrupted seed is completed). It seeds whatever database `EASYRMS_DATABASE_URL` points at, so check that value before running it by hand. To get a different first agent, use `npm run agent:create` (see the README).

**Reset the dev database.** To get back to the seeded state, use the "Resetuj bazę" button at the top left of the admin header (after the confirmation "Czy chcesz zresetować bazę do pierwotnego stanu developerskiego?"). It deletes **all** data (returns, claims, photos, suppliers, agents, rate-limit counters), keeps the schema, and runs the same seed as `npm run seed:dev`, so you end up with the two dev suppliers and `admin@example.com` and are sent to the login page. It exists only when `NODE_ENV` is `development` (`npm run dev`) **and** the database host is `localhost`, `127.0.0.1` or `::1`; with any other environment or database the button is not shown and `POST /api/dev/reset` answers 404. Only an agent with `MANAGE_RULES` can use it. If the wipe works and the seed fails, run `npm run seed:dev`.

### Manual setup

The same steps by hand, if you prefer or if `npm run setup` fails:

```bash
npm install
npm run db:start    # local PostgreSQL on localhost:5432 (needs PostgreSQL binaries; set PGBIN if not found)
# or: docker compose up -d --wait postgres
npm run db:migrate
npm run seed:dev     # optional: dev suppliers and the admin@example.com agent (local development only)
npm run dev
```

Other commands:

```bash
npm run lint
npm run typecheck  # all workspaces
npm test           # unit tests (Vitest, @easyrms/core)
npm run test:db    # database tests (Vitest, @easyrms/db): migration and repository against the local Postgres
npm run test:integration  # all agent-browser QA scenarios from .ai/qa/ (see IntegrationTests.md)
npm run storybook  # component catalog on http://localhost:6006
npm run storybook:build  # static Storybook in packages/app/storybook-static (part of the validation gate)
NODE_ENV=production npm run build
```

Further reading: [Database tests](./DatabaseTests.md), [Integration tests](./IntegrationTests.md), [Storybook](./Storybook.md), [Configuration](./Configuration.md).

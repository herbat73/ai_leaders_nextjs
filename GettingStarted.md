# Getting started

Back to the [README](./README.md).

Requirements: Node.js 20.19+ (Next.js needs 20.9+, but the test runner's Vite needs 20.19+) and, for the local database, either PostgreSQL binaries (Linux, macOS or WSL) or Docker with the compose plugin (any OS, including native Windows).

```bash
npm run setup      # installs dependencies, starts local PostgreSQL, runs migrations
npm run dev        # starts @easyrms/app
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

`npm run setup` is idempotent: re-running it skips every step that is already done (dependencies up to date, database reachable, no pending migrations) and prints which ones were skipped. It starts only the default local database: with `scripts/db.sh` when PostgreSQL binaries are found, otherwise with `docker compose up -d --wait postgres` (`docker-compose.yml`, same credentials and port 5433); if you set `EASYRMS_DATABASE_URL` to another PostgreSQL, start that yourself and setup only runs the migrations.

### Manual setup

The same steps by hand, if you prefer or if `npm run setup` fails:

```bash
npm install
npm run db:start    # local PostgreSQL on localhost:5433 (needs PostgreSQL binaries; set PGBIN if not found)
# or: docker compose up -d --wait postgres
npm run db:migrate
npm run dev
```

Other commands:

```bash
npm run lint
npm run typecheck  # all workspaces
npm test           # unit tests (Vitest, @easyrms/core)
npm run test:db    # database tests (Vitest, @easyrms/db): migration and repository against the local Postgres
npm run test:integration  # all agent-browser QA scenarios from .ai/qa/ (see [Integration tests](./README.md#integration-tests))
npm run storybook  # component catalog on http://localhost:6006
npm run storybook:build  # static Storybook in packages/app/storybook-static (part of the validation gate)
NODE_ENV=production npm run build
```

Further reading in the README: [Database tests](./README.md#database-tests), [Integration tests](./README.md#integration-tests), [Storybook](./Storybook.md), [Configuration](./Configuration.md).

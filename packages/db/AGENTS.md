# `@easyrms/db`

Owns all persistence: MikroORM config, entities, migrations, repositories, seeders, connection pool.

- Entities in `src/entities/<concept>/<name>.entity.ts`, repositories in `src/repositories/<concept>/`.
- Every schema change is a MikroORM migration in `src/migrations` (`npm run db:migration:create`); never edit the schema
  by hand or rely on `schema:update` outside local experiments.
- One shared connection pool (`src/orm.ts`); never open ad-hoc connections. Fork the `EntityManager` per request.
- May import `core` for shared types only.
- Tests: `npm run test:db` (script is named `test:db`, never `test`, so the gate skips it) needs `npm run db:start`; each
  test file runs on a throwaway schema. Record its result in `.ai/runs/` for each PR that touches this package.

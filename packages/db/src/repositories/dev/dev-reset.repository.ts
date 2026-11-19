import type { EntityManager } from "@mikro-orm/postgresql";

/** The table MikroORM's migrator keeps its own history in; wiping it would make the next `db:migrate` rerun everything. */
const MIGRATIONS_TABLE = "mikro_orm_migrations";

/** Arbitrary constant key of the transaction-level advisory lock that serializes two resets. */
const RESET_LOCK_KEY = 1_740_001;

/**
 * Persistence of the development reset (issue #174): removes every row of every data table in one transaction.
 * Raw SQL stays here (MikroORM has no "truncate everything" API). The table list is read from the catalog instead of
 * being written down, so a table added later is wiped without touching this file. Nothing here knows whether the
 * environment is allowed to be reset: that decision is the caller's (`packages/app/src/server/dev-reset.ts`).
 */
export class MikroOrmDevResetRepository {
  private readonly em: EntityManager;

  constructor(deps: { em: EntityManager }) {
    this.em = deps.em;
  }

  /**
   * Empties all data tables and returns their names. Identity columns are deliberately NOT restarted: a reseeded admin
   * then gets a new id, so a session cookie signed for the old admin (id and epoch) never matches the new account.
   * With `restart identity` the new admin would be id 1 again and the old cookie would still open the back office.
   */
  async truncateAll(): Promise<string[]> {
    return this.em.transactional(async (tx) => {
      await tx.execute(`select pg_advisory_xact_lock(?)`, [RESET_LOCK_KEY]);
      const rows = await tx.execute<{ table_name: string }[]>(
        `select table_name from information_schema.tables
         where table_schema = current_schema() and table_type = 'BASE TABLE' and table_name <> ?
         order by table_name`,
        [MIGRATIONS_TABLE],
      );
      const tables = rows.map((row) => row.table_name);
      if (tables.length > 0) {
        // Names come from the catalog, never from input; each is quoted as an identifier.
        const list = tables.map((name) => `"${name.replaceAll('"', '""')}"`).join(", ");
        await tx.execute(`truncate table ${list} cascade`);
      }
      return tables;
    });
  }
}

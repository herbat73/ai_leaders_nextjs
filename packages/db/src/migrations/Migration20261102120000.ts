import { Migration } from '@mikro-orm/migrations';

/**
 * Shared throttle store (threat T-04): one fixed window per key, so login and customer budgets survive a restart and
 * are shared by every instance. Expand-only and self-contained (frozen SQL). Rows are disposable counters; `down`
 * drops the table, which only resets the budgets.
 */
export class Migration20261102120000 extends Migration {

  override name = 'Migration20261102120000';

  override async up(): Promise<void> {
    await this.execute(`create table "rate_limit_windows" ("key" varchar(320) not null primary key, "count" int not null, "ends_at" timestamptz not null);`);
    await this.execute(`create index "rate_limit_windows_ends_at_index" on "rate_limit_windows" ("ends_at");`);
  }

  override async down(): Promise<void> {
    await this.execute(`drop table "rate_limit_windows";`);
  }

}

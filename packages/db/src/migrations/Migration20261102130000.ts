import { Migration } from '@mikro-orm/migrations';

/**
 * Records when an agent invite was accepted (threat T-08), so a manager can see it. Expand-only and self-contained
 * (frozen SQL): one nullable column, no backfill (accounts that predate it show no time). `down` drops the column.
 */
export class Migration20261102130000 extends Migration {

  override name = 'Migration20261102130000';

  override async up(): Promise<void> {
    await this.execute(`alter table "agents" add column "accepted_at" timestamptz null;`);
  }

  override async down(): Promise<void> {
    await this.execute(`alter table "agents" drop column "accepted_at";`);
  }

}

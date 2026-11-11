import { Migration } from '@mikro-orm/migrations';

/**
 * Retention and erasure (threat T-21): a request whose personal text was erased carries the time of the erasure.
 * Expand-only and self-contained (frozen SQL): one nullable column.
 *
 * `down` drops the column; it refuses while any request is anonymized, because the column is the only record that the
 * text is gone on purpose, and dropping it would make erased requests look like requests that never had any text.
 */
export class Migration20261111180000 extends Migration {

  override name = 'Migration20261111180000';

  override async up(): Promise<void> {
    await this.execute(`alter table "return_requests" add "anonymized_at" timestamptz null;`);
  }

  override async down(): Promise<void> {
    // Checked first so a refusal changes nothing.
    const [rows] = await this.execute(`select count(*)::int as "count" from "return_requests" where "anonymized_at" is not null;`);
    if (Number(rows.count) > 0) {
      throw new Error('Refusing to roll back: anonymized requests exist, and the column is the only record that their text was erased on purpose. Nothing was changed.');
    }
    await this.execute(`alter table "return_requests" drop column "anonymized_at";`);
  }

}

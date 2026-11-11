import { Migration } from '@mikro-orm/migrations';

/**
 * Transport damage and missing items (spec 2026-11-10): whether the parcel was accepted with a courier note, asked of
 * transport reports only and optional (Q11). Expand-only and self-contained (frozen SQL): one nullable column, no
 * backfill. The new kinds reuse `kind`, `resolution` (`resend_part` fits `varchar(16)`), `defect_description`,
 * `defect_discovered_on` and a null `return_method`, so nothing else changes.
 *
 * `down` drops the column; it refuses while a transport or missing request exists, because a rollback would leave rows
 * of a kind the application no longer knows and lose the courier note.
 */
export class Migration20261111090000 extends Migration {

  override name = 'Migration20261111090000';

  override async up(): Promise<void> {
    await this.execute(`alter table "return_requests" add column "courier_note" boolean null;`);
  }

  override async down(): Promise<void> {
    const [rows] = await this.execute(`select count(*)::int as "count" from "return_requests" where "kind" in ('transport', 'missing');`);
    if (Number(rows.count) > 0) {
      throw new Error('Refusing to roll back: transport damage or missing item requests exist, and the older application does not know these kinds. Nothing was changed.');
    }
    await this.execute(`alter table "return_requests" drop column "courier_note";`);
  }

}

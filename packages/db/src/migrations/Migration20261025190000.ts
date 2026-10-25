import { Migration } from '@mikro-orm/migrations';

/**
 * Suppliers: the vendors that receive claims for defective products. Expand-only and self-contained (frozen SQL, no
 * imports from app code). The name is unique case-insensitively.
 *
 * `down` drops the table; it refuses while any supplier exists, because dropping it would lose the vendor list and
 * (once supplier claims reference it) what was claimed from whom.
 */
export class Migration20261025190000 extends Migration {

  override name = 'Migration20261025190000';

  override async up(): Promise<void> {
    await this.execute(`create table "suppliers" ("id" serial primary key, "name" varchar(120) not null, "email" varchar(254) not null, "guidelines" text null, "active" boolean not null default true, "created_at" timestamptz not null, "updated_at" timestamptz not null);`);
    await this.execute(`create unique index "suppliers_name_lower_unique" on "suppliers" (lower("name"));`);
  }

  override async down(): Promise<void> {
    // Checked first so a refusal changes nothing.
    const [suppliers] = await this.execute(`select count(*)::int as "count" from "suppliers";`);
    if (Number(suppliers.count) > 0) {
      throw new Error('Refusing to roll back: suppliers exist, and dropping "suppliers" would lose the vendor list. Nothing was changed.');
    }
    await this.execute(`drop table "suppliers";`);
  }

}

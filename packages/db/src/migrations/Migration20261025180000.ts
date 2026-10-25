import { Migration } from '@mikro-orm/migrations';

/**
 * Complaints: defect fields on `return_requests` and a serial number on `return_request_items`. Expand-only and
 * self-contained (frozen SQL, no imports from app code). Existing rows keep `null` in every new column.
 *
 * `down` drops the columns; it refuses once a complaint exists, because dropping them would lose what the customer
 * reported and what the agent found.
 */
export class Migration20261025180000 extends Migration {

  override name = 'Migration20261025180000';

  override async up(): Promise<void> {
    await this.execute(`alter table "return_requests" add "defect_description" text null, add "defect_discovered_on" date null, add "defect_confirmed" boolean null;`);
    await this.execute(`alter table "return_request_items" add "serial_number" varchar(100) null;`);
  }

  override async down(): Promise<void> {
    // Checked first so a refusal changes nothing (the statements below also run in one transaction).
    const [complaints] = await this.execute(`select count(*)::int as "count" from "return_requests" where "kind" = 'complaint';`);
    if (Number(complaints.count) > 0) {
      throw new Error('Refusing to roll back: complaints exist, and dropping the defect columns would lose what customers reported and what agents found. Nothing was changed.');
    }

    await this.execute(`alter table "return_request_items" drop column "serial_number";`);
    await this.execute(`alter table "return_requests" drop column "defect_description", drop column "defect_discovered_on", drop column "defect_confirmed";`);
  }

}

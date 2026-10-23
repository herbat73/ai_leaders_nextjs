import { Migration } from '@mikro-orm/migrations';

/**
 * Customer portal: items table, resolution and idempotency columns, `reason` relaxed to nullable. Expand-only and
 * self-contained (frozen SQL, no imports from app code).
 *
 * `down` drops the new table and columns; it restores `reason not null` only while no row has a null reason.
 */
export class Migration20261023202921 extends Migration {

  override name = 'Migration20261023202921';

  override async up(): Promise<void> {
    await this.execute(`create table "return_request_items" ("id" serial primary key, "return_request_id" int not null, "line_ref" varchar(100) not null, "sku" varchar(100) not null, "name" varchar(255) not null, "quantity" int not null, "unit_price" numeric(12,2) not null, "reason_code" varchar(32) not null, "comment" text null);`);
    await this.execute(`create index "return_request_items_line_ref_index" on "return_request_items" ("line_ref");`);
    await this.execute(`alter table "return_request_items" add constraint "return_request_items_return_request_id_line_ref_unique" unique ("return_request_id", "line_ref");`);

    await this.execute(`alter table "return_requests" add "resolution" varchar(16) null, add "resolution_amount" numeric(12,2) null, add "currency" char(3) not null default 'PLN', add "exchange_note" text null, add "return_method" varchar(24) null, add "idempotency_key" uuid null;`);
    await this.execute(`alter table "return_requests" alter column "reason" drop not null;`);
    await this.execute(`alter table "return_requests" add constraint "return_requests_idempotency_key_unique" unique ("idempotency_key");`);
    await this.execute(`create index "return_requests_order_number_index" on "return_requests" ("order_number");`);

    await this.execute(`alter table "return_request_items" add constraint "return_request_items_return_request_id_foreign" foreign key ("return_request_id") references "return_requests" ("id") on delete restrict;`);
  }

  override async down(): Promise<void> {
    // Checked first so a refusal changes nothing (the statements below also run in one transaction).
    const [nulls] = await await this.execute(`select count(*)::int as "count" from "return_requests" where "reason" is null;`);
    if (Number(nulls.count) > 0) {
      throw new Error('Refusing to roll back: some return requests have no reason (customer portal submissions), so "reason" cannot be made not null again. Nothing was changed.');
    }

    await this.execute(`drop table "return_request_items";`);

    await this.execute(`alter table "return_requests" drop constraint "return_requests_idempotency_key_unique";`);
    await this.execute(`drop index "return_requests_order_number_index";`);
    await this.execute(`alter table "return_requests" drop column "resolution", drop column "resolution_amount", drop column "currency", drop column "exchange_note", drop column "return_method", drop column "idempotency_key";`);
    await this.execute(`alter table "return_requests" alter column "reason" set not null;`);
  }

}

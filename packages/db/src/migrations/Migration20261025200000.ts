import { Migration } from '@mikro-orm/migrations';

/**
 * Supplier claims: one claim per complaint with its events, and the `SC-YYYY-NNNNN` sequence. Expand-only and
 * self-contained (frozen SQL, no imports from app code). The claim table references the complaint, the supplier and
 * the creating agent; `return_request_id` is unique, so a complaint can be claimed from one vendor only once.
 *
 * `down` drops both tables and the sequence; it refuses while any claim exists, because dropping them would lose what
 * was claimed, when, and what the vendor answered.
 */
export class Migration20261025200000 extends Migration {

  override name = 'Migration20261025200000';

  override async up(): Promise<void> {
    await this.execute(`create sequence "supplier_claim_seq" as bigint start with 1 increment by 1 minvalue 1;`);

    await this.execute(`create table "supplier_claims" ("id" serial primary key, "ref" varchar(32) not null, "return_request_id" int not null, "supplier_id" int not null, "status" varchar(16) not null default 'draft', "subject" text not null, "body" text not null, "created_by_agent_id" int not null, "sent_at" timestamptz null, "answered_at" timestamptz null, "credit_amount" numeric(12,2) null, "currency" char(3) not null default 'PLN', "answer_note" text null, "credited_at" timestamptz null, "created_at" timestamptz not null, "updated_at" timestamptz not null);`);
    await this.execute(`alter table "supplier_claims" add constraint "supplier_claims_ref_unique" unique ("ref");`);
    await this.execute(`alter table "supplier_claims" add constraint "supplier_claims_return_request_id_unique" unique ("return_request_id");`);
    await this.execute(`create index "supplier_claims_supplier_id_index" on "supplier_claims" ("supplier_id");`);
    await this.execute(`alter table "supplier_claims" add constraint "supplier_claims_return_request_id_foreign" foreign key ("return_request_id") references "return_requests" ("id") on delete restrict;`);
    await this.execute(`alter table "supplier_claims" add constraint "supplier_claims_supplier_id_foreign" foreign key ("supplier_id") references "suppliers" ("id") on delete restrict;`);
    await this.execute(`alter table "supplier_claims" add constraint "supplier_claims_created_by_agent_id_foreign" foreign key ("created_by_agent_id") references "agents" ("id") on delete restrict;`);

    await this.execute(`create table "supplier_claim_events" ("id" serial primary key, "supplier_claim_id" int not null, "type" varchar(32) not null, "from_status" varchar(16) null, "to_status" varchar(16) not null, "note" text null, "agent_id" int null, "created_at" timestamptz not null);`);
    await this.execute(`alter table "supplier_claim_events" add constraint "supplier_claim_events_supplier_claim_id_foreign" foreign key ("supplier_claim_id") references "supplier_claims" ("id") on delete restrict;`);
    await this.execute(`alter table "supplier_claim_events" add constraint "supplier_claim_events_agent_id_foreign" foreign key ("agent_id") references "agents" ("id") on delete restrict;`);
  }

  override async down(): Promise<void> {
    // Checked first so a refusal changes nothing (the statements below also run in one transaction).
    const [claims] = await this.execute(`select count(*)::int as "count" from "supplier_claims";`);
    if (Number(claims.count) > 0) {
      throw new Error('Refusing to roll back: supplier claims exist, and dropping them would lose what was claimed and what each vendor answered. Nothing was changed.');
    }

    await this.execute(`drop table "supplier_claim_events";`);
    await this.execute(`drop table "supplier_claims";`);
    await this.execute(`drop sequence "supplier_claim_seq";`);
  }

}

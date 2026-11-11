import { Migration } from '@mikro-orm/migrations';

/**
 * Audit trail of evidence photos (threat T-23): who added a file, who took a staged one back, which agent opened one.
 * Expand-only and self-contained (frozen SQL): one new table, nothing existing changes. `evidence_file_id` has no foreign
 * key on purpose, so a record outlives a deleted file; `return_request_id` is set when the file is attached and has no
 * foreign key either, for the same reason. The agent column keeps the usual restrict rule.
 *
 * `down` drops the table; it refuses while any row exists, because dropping it would destroy the record of who looked at
 * customer photos.
 */
export class Migration20261111120000 extends Migration {

  override name = 'Migration20261111120000';

  override async up(): Promise<void> {
    await this.execute(`create table "evidence_audit_events" ("id" serial primary key, "evidence_file_id" uuid not null, "order_number" varchar(100) not null, "return_request_id" int null, "action" varchar(16) not null, "actor" varchar(16) not null, "agent_id" int null, "created_at" timestamptz not null);`);
    await this.execute(`create index "evidence_audit_events_evidence_file_id_index" on "evidence_audit_events" ("evidence_file_id");`);
    await this.execute(`create index "evidence_audit_events_return_request_id_index" on "evidence_audit_events" ("return_request_id");`);
    await this.execute(`alter table "evidence_audit_events" add constraint "evidence_audit_events_agent_id_foreign" foreign key ("agent_id") references "agents" ("id") on delete restrict;`);
  }

  override async down(): Promise<void> {
    // Checked first so a refusal changes nothing.
    const [rows] = await this.execute(`select count(*)::int as "count" from "evidence_audit_events";`);
    if (Number(rows.count) > 0) {
      throw new Error('Refusing to roll back: audit events exist, and dropping the table would destroy the record of who looked at customer photos. Nothing was changed.');
    }
    await this.execute(`drop table "evidence_audit_events";`);
  }

}

import { Migration } from '@mikro-orm/migrations';

/**
 * Rules recommendations (E04-S01): one row per approve/reject decision recording what the rules engine recommended and
 * whether the agent followed it. Expand-only and self-contained (frozen SQL): a new table, no backfill. It is not a
 * timeline event on purpose: `return_request_events` has no payload column and the customer tracker shows every event.
 * `down` drops the table; it refuses once rows exist, because that would lose the A04 evidence.
 */
export class Migration20261108200000 extends Migration {

  override name = 'Migration20261108200000';

  override async up(): Promise<void> {
    await this.execute(`create table "return_rule_comparisons" ("id" serial primary key, "return_request_id" int not null, "agent_id" int not null, "recommended" varchar(16) not null, "rule_ids" text not null default '', "actual_status" varchar(32) not null, "followed" boolean null, "created_at" timestamptz not null);`);
    await this.execute(`alter table "return_rule_comparisons" add constraint "return_rule_comparisons_return_request_id_foreign" foreign key ("return_request_id") references "return_requests" ("id") on delete restrict;`);
    await this.execute(`alter table "return_rule_comparisons" add constraint "return_rule_comparisons_agent_id_foreign" foreign key ("agent_id") references "agents" ("id") on delete restrict;`);
    await this.execute(`create index "return_rule_comparisons_return_request_id_index" on "return_rule_comparisons" ("return_request_id");`);
  }

  override async down(): Promise<void> {
    const [rows] = await this.execute(`select count(*)::int as "count" from "return_rule_comparisons";`);
    if (Number(rows.count) > 0) {
      throw new Error('Refusing to roll back: "return_rule_comparisons" holds recorded decisions and dropping it would lose the evidence. Nothing was changed.');
    }
    await this.execute(`drop table "return_rule_comparisons";`);
  }

}

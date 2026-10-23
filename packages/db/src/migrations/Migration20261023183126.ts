import { Migration } from '@mikro-orm/migrations';

/**
 * Agent decision workflow: nine statuses, RMA numbers and a per-request timeline.
 *
 * Self-contained on purpose: it carries a frozen copy of the RMA formatter and imports nothing from `core`, so editing
 * app code later cannot change what this migration does. A test checks that every backfilled RMA equals
 * `formatRma(seq, created_at)`.
 *
 * `down` is forward-only after first agent use: it refuses to run once any move was recorded, because it would lose
 * the timeline and decision notes.
 */
function formatRmaFrozen(sequence: number, year: number): string {
  return `RMA-${year}-${String(sequence).padStart(5, '0')}`;
}

export class Migration20261023183126 extends Migration {

  override name = 'Migration20261023183126';

  override async up(): Promise<void> {
    await this.execute(`create sequence "return_rma_seq" as bigint start with 1 increment by 1 minvalue 1;`);

    await this.execute(`create table "return_request_events" ("id" serial primary key, "return_request_id" int not null, "type" varchar(32) not null, "from_status" varchar(32) null, "to_status" varchar(32) not null, "note" text null, "actor" varchar(16) not null, "created_at" timestamptz not null);`);
    await this.execute(`alter table "return_request_events" add constraint "return_request_events_return_request_id_foreign" foreign key ("return_request_id") references "return_requests" ("id") on delete restrict;`);

    await this.execute(`alter table "return_requests" add "rma" varchar(32) null, add "kind" varchar(16) not null default 'return', add "decision_note" text null;`);
    await this.execute(`alter table "return_requests" alter column "status" set default 'submitted';`);

    // One nextval per row, in creation order (ties by id), so the sequence continues after the last backfilled value.
    const rows = await this.execute(`select "id", extract(year from "created_at" at time zone 'Europe/Warsaw')::int as "year" from "return_requests" order by "created_at", "id";`);
    for (const row of rows) {
      const [next] = await this.execute(`select nextval('return_rma_seq') as "seq";`);
      await this.execute(`update "return_requests" set "rma" = ? where "id" = ?;`, [formatRmaFrozen(Number(next.seq), Number(row.year)), row.id]);
    }

    await this.execute(`update "return_requests" set "status" = 'submitted' where "status" = 'requested';`);
    await this.execute(`update "return_requests" set "status" = 'resolved' where "status" = 'refunded';`);

    await this.execute(`insert into "return_request_events" ("return_request_id", "type", "from_status", "to_status", "note", "actor", "created_at") select "id", 'submitted', null, 'submitted', null, 'system', "created_at" from "return_requests" order by "id";`);

    await this.execute(`alter table "return_requests" alter column "rma" set not null;`);
    await this.execute(`alter table "return_requests" add constraint "return_requests_rma_unique" unique ("rma");`);
  }

  override async down(): Promise<void> {
    const [moves] = await this.execute(`select count(*)::int as "count" from "return_request_events" where "type" <> 'submitted';`);
    const [later] = await this.execute(`select count(*)::int as "count" from "return_requests" where "status" in ('awaiting_customer', 'in_transit', 'in_service', 'cancelled');`);
    if (Number(moves.count) > 0 || Number(later.count) > 0) {
      throw new Error('Refusing to roll back: agents have already moved requests, and rolling back would lose that history. This migration is forward-only after first use.');
    }

    await this.execute(`drop table "return_request_events";`);
    await this.execute(`alter table "return_requests" drop constraint "return_requests_rma_unique";`);
    await this.execute(`alter table "return_requests" drop column "rma", drop column "kind", drop column "decision_note";`);
    await this.execute(`update "return_requests" set "status" = 'requested' where "status" = 'submitted';`);
    await this.execute(`update "return_requests" set "status" = 'refunded' where "status" = 'resolved';`);
    await this.execute(`alter table "return_requests" alter column "status" set default 'requested';`);
    await this.execute(`drop sequence "return_rma_seq";`);
  }

}

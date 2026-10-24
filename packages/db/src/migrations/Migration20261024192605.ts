import { Migration } from '@mikro-orm/migrations';

/**
 * Agent login: `agents` table and the nullable `return_request_events.agent_id`. Expand-only and self-contained
 * (frozen SQL, no imports from app code).
 *
 * `down` drops `agent_id` and `agents`; it refuses once any event records an agent, because that would lose who made
 * each decision.
 */
export class Migration20261024192605 extends Migration {

  override name = 'Migration20261024192605';

  override async up(): Promise<void> {
    await this.execute(`create table "agents" ("id" serial primary key, "email" varchar(255) not null, "display_name" varchar(100) not null, "password_hash" text null, "permissions" text[] not null default '{}', "status" varchar(16) not null default 'invited', "session_epoch" int not null default 0, "invite_token_hash" char(64) null, "invite_expires_at" timestamptz null, "created_at" timestamptz not null, "updated_at" timestamptz not null);`);
    await this.execute(`alter table "agents" add constraint "agents_email_unique" unique ("email");`);
    await this.execute(`alter table "agents" add constraint "agents_invite_token_hash_unique" unique ("invite_token_hash");`);

    await this.execute(`alter table "return_request_events" add "agent_id" int null;`);
    await this.execute(`alter table "return_request_events" add constraint "return_request_events_agent_id_foreign" foreign key ("agent_id") references "agents" ("id") on delete restrict;`);
  }

  override async down(): Promise<void> {
    // Checked first so a refusal changes nothing (the statements below also run in one transaction).
    const [decided] = await this.execute(`select count(*)::int as "count" from "return_request_events" where "agent_id" is not null;`);
    if (Number(decided.count) > 0) {
      throw new Error('Refusing to roll back: some timeline events record which agent made the decision, and dropping "agent_id" would lose it. Nothing was changed.');
    }

    await this.execute(`alter table "return_request_events" drop constraint "return_request_events_agent_id_foreign";`);
    await this.execute(`alter table "return_request_events" drop column "agent_id";`);
    await this.execute(`drop table "agents";`);
  }

}

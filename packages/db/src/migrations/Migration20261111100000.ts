import { Migration } from '@mikro-orm/migrations';

/**
 * Evidence images for transport damage and missing items (spec 2026-11-10, Phase 2). Expand-only and self-contained
 * (frozen SQL, no imports from app code): one new table, nothing existing changes. `id` is a random UUID, `data` the
 * re-encoded image, `return_request_id` is null while a file is staged and set once at attach. The restrict rule keeps
 * a request from being deleted under its files; the erasure path deletes the files first.
 *
 * `down` drops the table; it refuses while any file exists, because dropping it would destroy customer evidence.
 */
export class Migration20261111100000 extends Migration {

  override name = 'Migration20261111100000';

  override async up(): Promise<void> {
    await this.execute(`create table "evidence_files" ("id" uuid not null, "order_number" varchar(100) not null, "return_request_id" int null, "content_type" varchar(16) not null, "byte_size" int not null, "sha256" char(64) not null, "label" varchar(120) not null, "data" bytea not null, "created_at" timestamptz not null, constraint "evidence_files_pkey" primary key ("id"));`);
    await this.execute(`create index "evidence_files_order_number_index" on "evidence_files" ("order_number");`);
    await this.execute(`create index "evidence_files_return_request_id_index" on "evidence_files" ("return_request_id");`);
    await this.execute(`alter table "evidence_files" add constraint "evidence_files_return_request_id_foreign" foreign key ("return_request_id") references "return_requests" ("id") on delete restrict;`);
  }

  override async down(): Promise<void> {
    // Checked first so a refusal changes nothing.
    const [files] = await this.execute(`select count(*)::int as "count" from "evidence_files";`);
    if (Number(files.count) > 0) {
      throw new Error('Refusing to roll back: evidence files exist, and dropping the table would destroy customer evidence. Nothing was changed.');
    }
    await this.execute(`drop table "evidence_files";`);
  }

}

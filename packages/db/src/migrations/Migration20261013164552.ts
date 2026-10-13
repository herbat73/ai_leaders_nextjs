import { Migration } from '@mikro-orm/migrations';

export class Migration20261013164552 extends Migration {

  override name = 'Migration20261013164552';

  override up(): void | Promise<void> {
    this.addSql(`create table "return_requests" ("id" serial primary key, "order_number" varchar(100) not null, "customer_email" varchar(320) not null, "reason" text not null, "status" varchar(32) not null default 'requested', "created_at" timestamptz not null, "updated_at" timestamptz not null);`);
  }

}

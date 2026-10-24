import { apiHandler, ServiceUnavailableError } from "@easyrms/core";
import { getOrm } from "@easyrms/db";

import { httpOptions } from "@/server/http-options";

export const GET = apiHandler(async () => {
  try {
    const orm = await getOrm();
    await orm.em.fork().getConnection().execute("select 1");
  } catch {
    throw new ServiceUnavailableError("Database unreachable");
  }
  return { status: "ok" };
}, httpOptions);

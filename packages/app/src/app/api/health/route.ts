import { getOrm } from "@easyrms/db";

export async function GET(): Promise<Response> {
  try {
    const orm = await getOrm();
    await orm.em.fork().getConnection().execute("select 1");
    return Response.json({ status: "ok" });
  } catch {
    return Response.json({ status: "error" }, { status: 503 });
  }
}

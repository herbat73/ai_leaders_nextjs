import type { ZodType } from "zod";

import { ValidationError } from "../errors";

/** Validates `value` with `schema`, throwing a `ValidationError` carrying one message per field path. */
export function parseWith<T>(schema: ZodType<T>, value: unknown, message = "Invalid input"): T {
  const result = schema.safeParse(value);
  if (result.success) return result.data;
  const fields: Record<string, string> = {};
  for (const issue of result.error.issues) {
    const path = issue.path.join(".") || "form";
    fields[path] ??= issue.message;
  }
  throw new ValidationError(message, fields);
}

export async function parseJsonBody<T>(request: Request, schema: ZodType<T>): Promise<T> {
  const body: unknown = await request.json().catch(() => undefined);
  if (typeof body !== "object" || body === null) throw new ValidationError("Invalid JSON body");
  return parseWith(schema, body);
}

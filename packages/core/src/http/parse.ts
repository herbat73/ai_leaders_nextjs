import type { ZodType } from "zod";

import { ValidationError } from "../errors";

/** Runs `schema` and returns the parsed value, or one message per field path (`form` for root issues). */
export function validateWith<T>(
  schema: ZodType<T>,
  value: unknown,
): { success: true; data: T } | { success: false; fieldErrors: Record<string, string> } {
  const result = schema.safeParse(value);
  if (result.success) return { success: true, data: result.data };
  const fieldErrors: Record<string, string> = {};
  for (const issue of result.error.issues) {
    fieldErrors[issue.path.join(".") || "form"] ??= issue.message;
  }
  return { success: false, fieldErrors };
}

/** Validates `value` with `schema`, throwing a `ValidationError` carrying one message per field path. */
export function parseWith<T>(schema: ZodType<T>, value: unknown, message = "Invalid input"): T {
  const result = validateWith(schema, value);
  if (result.success) return result.data;
  throw new ValidationError(message, result.fieldErrors);
}

export async function parseJsonBody<T>(request: Request, schema: ZodType<T>): Promise<T> {
  const body: unknown = await request.json().catch(() => undefined);
  if (typeof body !== "object" || body === null) throw new ValidationError("Invalid JSON body");
  return parseWith(schema, body);
}

import type { ZodType } from "zod";

import { PayloadTooLargeError, ValidationError } from "../errors";

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

export interface ParseJsonBodyOptions {
  /** Cap on the raw body in bytes, checked from `Content-Length` and while streaming, before `JSON.parse`. */
  maxBytes?: number;
  /** Message of the 413 raised when the cap is exceeded. */
  tooLargeMessage?: string;
}

/** Reads the body as text, throwing `PayloadTooLargeError` as soon as `maxBytes` is exceeded. */
async function readCappedText(request: Request, maxBytes: number, message: string | undefined): Promise<string> {
  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) throw new PayloadTooLargeError(message);
  if (!request.body) return "";
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.byteLength;
    if (received > maxBytes) {
      await reader.cancel().catch(() => undefined);
      throw new PayloadTooLargeError(message);
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

export async function parseJsonBody<T>(
  request: Request,
  schema: ZodType<T>,
  { maxBytes, tooLargeMessage }: ParseJsonBodyOptions = {},
): Promise<T> {
  let body: unknown;
  if (maxBytes === undefined) body = await request.json().catch(() => undefined);
  else {
    body = await readCappedText(request, maxBytes, tooLargeMessage)
      .then((text) => JSON.parse(text) as unknown)
      .catch((error: unknown) => {
        if (error instanceof PayloadTooLargeError) throw error;
        return undefined;
      });
  }
  if (typeof body !== "object" || body === null) throw new ValidationError("Invalid JSON body");
  return parseWith(schema, body);
}

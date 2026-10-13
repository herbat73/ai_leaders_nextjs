export interface ApiLogger {
  error(message: string, context?: Record<string, unknown>): void;
}

export interface ApiErrorBody {
  code: string;
  message: string;
  fieldErrors?: Record<string, string>;
}

/** JSON envelope returned by every API route. */
export type ApiEnvelope<T> = { ok: true; data: T } | { ok: false; error: ApiErrorBody };

/** Minimal shape of the Next.js route context, kept structural so `core` stays framework-agnostic. */
export interface RouteContext {
  params: Promise<Record<string, string>>;
}

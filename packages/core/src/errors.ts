/**
 * Brand shared by every copy of this module. Next.js can bundle `@easyrms/core` more than once per process (route
 * bundles and the container built by the first of them), and `instanceof AppError` is false across copies; a
 * registered symbol is the same everywhere, so `isAppError` still recognises the error.
 */
export const APP_ERROR_BRAND = Symbol.for("easyrms.app-error");

/** Base class for errors that map to an HTTP status. Services throw these; they never build responses. */
export class AppError extends Error {
  readonly [APP_ERROR_BRAND] = true;

  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
    readonly fieldErrors?: Record<string, string>,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

/** True for an `AppError` of any copy of this module (see `APP_ERROR_BRAND`); driver errors with a `code` never match. */
export function isAppError(error: unknown): error is AppError {
  return (
    error instanceof Error &&
    (error as unknown as Record<symbol, unknown>)[APP_ERROR_BRAND] === true &&
    typeof (error as { status?: unknown }).status === "number" &&
    typeof (error as { code?: unknown }).code === "string"
  );
}

export class ValidationError extends AppError {
  constructor(message: string, readonly fields: Record<string, string> = {}) {
    super(message, 400, "validation_error", fields);
  }
}

export class NotFoundError extends AppError {
  constructor(message: string) {
    super(message, 404, "not_found");
  }
}

export class ConflictError extends AppError {
  constructor(message: string, readonly fields?: Record<string, string>) {
    super(message, 409, "conflict", fields);
  }
}

export class ServiceUnavailableError extends AppError {
  constructor(message: string) {
    super(message, 503, "service_unavailable");
  }
}

export class PayloadTooLargeError extends AppError {
  constructor(message = "Payload too large") {
    super(message, 413, "payload_too_large");
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Unauthorized") {
    super(message, 401, "unauthorized");
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Forbidden", code = "csrf_rejected") {
    super(message, 403, code);
  }
}

export class TooManyRequestsError extends AppError {
  constructor(message = "Too many requests") {
    super(message, 429, "rate_limited");
  }
}

/**
 * Missing or invalid server configuration. Deliberately not an `AppError`: `apiHandler` logs it and returns an opaque
 * 500, so the client never learns which setting is wrong.
 */
export class ConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigurationError";
  }
}

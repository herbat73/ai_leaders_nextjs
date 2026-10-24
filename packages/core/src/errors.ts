/** Base class for errors that map to an HTTP status. Services throw these; they never build responses. */
export class AppError extends Error {
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

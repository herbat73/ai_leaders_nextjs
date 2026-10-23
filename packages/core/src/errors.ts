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

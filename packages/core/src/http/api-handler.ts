import { AppError } from "../errors";
import type { ApiEnvelope, ApiLogger, RouteContext } from "./types";

export interface ApiHandlerOptions {
  /** Status for a successful response. */
  status?: number;
  logger?: ApiLogger;
}

const consoleLogger: ApiLogger = {
  error: (message, context) => console.error(message, context),
};

const REQUEST_ID_PATTERN = /^[A-Za-z0-9._-]{1,64}$/;

function requestIdOf(request: Request): string {
  const supplied = request.headers.get("x-request-id");
  return supplied !== null && REQUEST_ID_PATTERN.test(supplied) ? supplied : crypto.randomUUID();
}

function routeOf(request: Request): string {
  return URL.canParse(request.url) ? new URL(request.url).pathname : "unknown";
}

function stringProperty(error: unknown, key: string): string | undefined {
  if (typeof error !== "object" || error === null) return undefined;
  const value = (error as Record<string, unknown>)[key];
  return typeof value === "string" ? value : undefined;
}

/**
 * Diagnostics for an unexpected failure, without values: driver errors embed bound SQL values (customer text) in
 * `message` and stack, so only the error name, the driver `code`/`constraint`, the route (no query string) and a
 * request id are logged.
 */
function failureContext(error: unknown, request: Request): Record<string, unknown> {
  return {
    name: error instanceof Error ? error.name : typeof error,
    code: stringProperty(error, "code"),
    constraint: stringProperty(error, "constraint"),
    route: routeOf(request),
    requestId: requestIdOf(request),
  };
}

function envelope<T>(body: ApiEnvelope<T>, status: number): Response {
  return Response.json(body, { status });
}

/**
 * Wraps a route function: the return value becomes `{ ok: true, data }`, a thrown `AppError` becomes
 * `{ ok: false, error }` with its status, and anything else is logged and returned as an opaque 500.
 */
export function apiHandler<TContext extends RouteContext = RouteContext>(
  handler: (request: Request, context: TContext) => Promise<unknown>,
  { status = 200, logger = consoleLogger }: ApiHandlerOptions = {},
): (request: Request, context: TContext) => Promise<Response> {
  return async (request, context) => {
    try {
      return envelope({ ok: true, data: await handler(request, context) }, status);
    } catch (error) {
      if (error instanceof AppError) {
        return envelope(
          { ok: false, error: { code: error.code, message: error.message, fieldErrors: error.fieldErrors } },
          error.status,
        );
      }
      logger.error("Unhandled API error", failureContext(error, request));
      return envelope({ ok: false, error: { code: "internal_error", message: "Internal server error" } }, 500);
    }
  };
}

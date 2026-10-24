import { AppError } from "../errors";
import { assertSameOrigin, isMutatingMethod } from "./csrf";
import type { ApiEnvelope, ApiLogger, RouteContext } from "./types";

export interface ApiHandlerOptions {
  /** Status for a successful response. */
  status?: number;
  logger?: ApiLogger;
  /**
   * Whether `x-forwarded-host` may be used as the request host in the CSRF check. The function form is evaluated per
   * mutating request, never at route creation, so a configuration error surfaces on first use and not during build.
   */
  trustProxy?: boolean | (() => boolean);
  allowedOrigins?: readonly string[] | (() => readonly string[]);
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

/** The standard success envelope with optional extra init (status, headers such as `set-cookie`). */
export function okResponse<T>(data: T, init?: ResponseInit): Response {
  return Response.json({ ok: true, data } satisfies ApiEnvelope<T>, init);
}

/**
 * Wraps a route function: mutating requests (POST/PUT/PATCH/DELETE) first pass the CSRF check (403 `csrf_rejected`),
 * a returned `Response` is passed through unchanged, any other return value becomes `{ ok: true, data }`, a thrown `AppError` becomes
 * `{ ok: false, error }` with its status, and anything else is logged and returned as an opaque 500.
 */
export function apiHandler<TContext extends RouteContext = RouteContext>(
  handler: (request: Request, context: TContext) => Promise<unknown>,
  { status = 200, logger = consoleLogger, trustProxy = false, allowedOrigins = [] }: ApiHandlerOptions = {},
): (request: Request, context: TContext) => Promise<Response> {
  return async (request, context) => {
    try {
      if (isMutatingMethod(request.method)) {
        assertSameOrigin(request, {
          trustProxy: typeof trustProxy === "function" ? trustProxy() : trustProxy,
          allowedOrigins: typeof allowedOrigins === "function" ? allowedOrigins() : allowedOrigins,
        });
      }
      const result = await handler(request, context);
      if (result instanceof Response) return result;
      return envelope({ ok: true, data: result }, status);
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

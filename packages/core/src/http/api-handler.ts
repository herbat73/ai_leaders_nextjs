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
      logger.error("Unhandled API error", { error });
      return envelope({ ok: false, error: { code: "internal_error", message: "Internal server error" } }, 500);
    }
  };
}

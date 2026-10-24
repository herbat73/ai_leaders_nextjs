import { z, type ZodType } from "zod";

import { apiHandler } from "./api-handler";
import { ValidationError } from "../errors";
import { parseJsonBody, validateWith } from "./parse";
import type { ApiHandlerOptions } from "./api-handler";
import type { ApiLogger, RouteContext } from "./types";

type Handler = (request: Request, context: RouteContext) => Promise<Response>;

type BodyOperation<TService, TArgs extends unknown[], S extends ZodType, TPrincipal> = {
  schema: S;
  handler: (service: TService, ...args: [...TArgs, z.output<S>, TPrincipal]) => Promise<unknown>;
};

export interface CrudRouteConfig<
  TService,
  TId,
  TCreate extends ZodType,
  TUpdate extends ZodType,
  TPatch extends ZodType,
  TPrincipal = undefined,
> {
  /** Resolves the request-scoped service; supplied by `app` so `core` never touches the container. */
  resolve: () => Promise<TService>;
  logger?: ApiLogger;
  /** Forwarded to `apiHandler` (CSRF host check); the function form is evaluated per request. */
  trustProxy?: ApiHandlerOptions["trustProxy"];
  allowedOrigins?: ApiHandlerOptions["allowedOrigins"];
  /** Forwarded to `apiHandler`: runs after CSRF and before the body is parsed; its result is the last handler argument. */
  authenticate?: (request: Request) => Promise<TPrincipal>;
  /** Parses the `[id]` route param for item operations. Defaults to a positive integer. */
  idSchema?: ZodType<TId>;
  list?: (service: TService, principal: TPrincipal) => Promise<unknown>;
  create?: BodyOperation<TService, [], TCreate, TPrincipal>;
  update?: BodyOperation<TService, [TId], TUpdate, TPrincipal>;
  patch?: BodyOperation<TService, [TId], TPatch, TPrincipal>;
  remove?: { handler: (service: TService, id: TId, principal: TPrincipal) => Promise<unknown> };
}

type VerbByOperation = {
  list: "GET";
  create: "POST";
  update: "PUT";
  patch: "PATCH";
  remove: "DELETE";
};

/** The verbs for exactly the operations present in the config (`K` is the config's key set). */
export type CrudHandlers<K extends string> = {
  [P in Extract<K, keyof VerbByOperation> as VerbByOperation[P]]: Handler;
};

const defaultIdSchema = z.coerce.number().int().positive();

/**
 * Builds route handlers from configuration. Only the configured operations are returned, so a resource
 * exposes exactly the verbs it supports (list/create go in a collection `route.ts`, update/patch/remove in
 * the `[id]` one). Workflow endpoints that don't fit use `apiHandler` directly.
 */
export function makeCrudRoute<
  TService,
  TId = number,
  TCreate extends ZodType = ZodType,
  TUpdate extends ZodType = ZodType,
  TPatch extends ZodType = ZodType,
  TPrincipal = undefined,
  K extends string = never,
>(
  config: CrudRouteConfig<TService, TId, TCreate, TUpdate, TPatch, TPrincipal> & { [P in K]: unknown },
): CrudHandlers<K> {
  const options: ApiHandlerOptions<TPrincipal> = {
    logger: config.logger,
    trustProxy: config.trustProxy,
    allowedOrigins: config.allowedOrigins,
    authenticate: config.authenticate,
  };
  const idSchema = (config.idSchema ?? defaultIdSchema) as ZodType<TId>;
  const readId = async (context: RouteContext): Promise<TId> => {
    const result = validateWith(idSchema, (await context.params).id);
    if (result.success) return result.data;
    throw new ValidationError("Invalid id", { id: "Must be a positive integer" });
  };

  const handlers: Partial<Record<"GET" | "POST" | "PUT" | "PATCH" | "DELETE", Handler>> = {};
  const { list, create, update, patch, remove } = config;

  if (list) {
    handlers.GET = apiHandler(async (_request, _context, principal) => list(await config.resolve(), principal), options);
  }
  if (create) {
    handlers.POST = apiHandler(
      async (request, _context, principal) => {
        const input = await parseJsonBody(request, create.schema);
        return create.handler(await config.resolve(), input as z.output<TCreate>, principal);
      },
      { ...options, status: 201 },
    );
  }
  for (const [verb, operation] of [["PUT", update], ["PATCH", patch]] as const) {
    if (!operation) continue;
    handlers[verb] = apiHandler(async (request, context, principal) => {
      const id = await readId(context);
      const input = await parseJsonBody(request, operation.schema);
      return (operation.handler as (...args: unknown[]) => Promise<unknown>)(await config.resolve(), id, input, principal);
    }, options);
  }
  if (remove) {
    handlers.DELETE = apiHandler(async (_request, context, principal) => {
      const id = await readId(context);
      return remove.handler(await config.resolve(), id, principal);
    }, options);
  }
  return handlers as CrudHandlers<K>;
}

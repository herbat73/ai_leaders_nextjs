import { z, type ZodType } from "zod";

import { apiHandler } from "./api-handler";
import { parseJsonBody, parseWith } from "./parse";
import type { ApiLogger, RouteContext } from "./types";

type Handler = (request: Request, context: RouteContext) => Promise<Response>;

type BodyOperation<TService, TArgs extends unknown[], S extends ZodType> = {
  schema: S;
  handler: (service: TService, ...args: [...TArgs, z.output<S>]) => Promise<unknown>;
};

export interface CrudRouteConfig<
  TService,
  TId,
  TCreate extends ZodType,
  TUpdate extends ZodType,
  TPatch extends ZodType,
> {
  /** Resolves the request-scoped service; supplied by `app` so `core` never touches the container. */
  resolve: () => Promise<TService>;
  logger?: ApiLogger;
  /** Parses the `[id]` route param for item operations. Defaults to a positive integer. */
  idSchema?: ZodType<TId>;
  list?: (service: TService) => Promise<unknown>;
  create?: BodyOperation<TService, [], TCreate>;
  update?: BodyOperation<TService, [TId], TUpdate>;
  patch?: BodyOperation<TService, [TId], TPatch>;
  remove?: { handler: (service: TService, id: TId) => Promise<unknown> };
}

const VERB_BY_OPERATION = {
  list: "GET",
  create: "POST",
  update: "PUT",
  patch: "PATCH",
  remove: "DELETE",
} as const;

/** The verbs for exactly the operations present in the config (`K` is the config's key set). */
export type CrudHandlers<K extends string> = {
  [P in Extract<K, keyof typeof VERB_BY_OPERATION> as (typeof VERB_BY_OPERATION)[P]]: Handler;
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
  K extends string = never,
>(
  config: CrudRouteConfig<TService, TId, TCreate, TUpdate, TPatch> & { [P in K]: unknown },
): CrudHandlers<K> {
  const options = { logger: config.logger };
  const idSchema = (config.idSchema ?? defaultIdSchema) as ZodType<TId>;
  const readId = async (context: RouteContext): Promise<TId> =>
    parseWith(idSchema, (await context.params).id, "Invalid id");

  const handlers: Partial<Record<"GET" | "POST" | "PUT" | "PATCH" | "DELETE", Handler>> = {};
  const { list, create, update, patch, remove } = config;

  if (list) {
    handlers.GET = apiHandler(async () => list(await config.resolve()), options);
  }
  if (create) {
    handlers.POST = apiHandler(
      async (request) => {
        const input = await parseJsonBody(request, create.schema);
        return create.handler(await config.resolve(), input as z.output<TCreate>);
      },
      { ...options, status: 201 },
    );
  }
  for (const [verb, operation] of [["PUT", update], ["PATCH", patch]] as const) {
    if (!operation) continue;
    handlers[verb] = apiHandler(async (request, context) => {
      const id = await readId(context);
      const input = await parseJsonBody(request, operation.schema);
      return operation.handler(await config.resolve(), id, input as never);
    }, options);
  }
  if (remove) {
    handlers.DELETE = apiHandler(async (_request, context) => {
      const id = await readId(context);
      return remove.handler(await config.resolve(), id);
    }, options);
  }
  return handlers as CrudHandlers<K>;
}

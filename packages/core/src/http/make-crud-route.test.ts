import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { UnauthorizedError } from "../errors";
import { makeCrudRoute } from "./make-crud-route";

const headers = { "x-requested-with": "test", "content-type": "application/json" };
const json = (body: unknown, method = "PATCH") =>
  new Request("http://localhost/api/items/5", { method, headers, body: JSON.stringify(body) });
const idContext = { params: Promise.resolve({ id: "5" }) };

interface Principal {
  agentId: number;
}

describe("makeCrudRoute authenticate", () => {
  it("passes the principal as the last argument of every operation", async () => {
    const calls: unknown[][] = [];
    const record = (name: string) => async (...args: unknown[]) => {
      calls.push([name, ...args]);
      return {};
    };
    const handlers = makeCrudRoute({
      resolve: async () => "service",
      authenticate: async (): Promise<Principal> => ({ agentId: 9 }),
      list: record("list"),
      create: { schema: z.object({ a: z.number() }), handler: record("create") },
      patch: { schema: z.object({ b: z.number() }), handler: record("patch") },
      remove: { handler: record("remove") },
    });

    await handlers.GET(new Request("http://localhost/api/items"), { params: Promise.resolve({}) });
    await handlers.POST(json({ a: 1 }, "POST"), { params: Promise.resolve({}) });
    await handlers.PATCH(json({ b: 2 }), idContext);
    await handlers.DELETE(new Request("http://localhost/api/items/5", { method: "DELETE", headers }), idContext);

    expect(calls).toEqual([
      ["list", "service", { agentId: 9 }],
      ["create", "service", { a: 1 }, { agentId: 9 }],
      ["patch", "service", 5, { b: 2 }, { agentId: 9 }],
      ["remove", "service", 5, { agentId: 9 }],
    ]);
  });

  it("rejects before resolving the service or parsing the body", async () => {
    const resolve = vi.fn(async () => "service");
    const handler = vi.fn(async () => ({}));
    const handlers = makeCrudRoute({
      resolve,
      authenticate: async () => {
        throw new UnauthorizedError();
      },
      patch: { schema: z.object({ b: z.number() }), handler },
    });

    // An invalid body would be a 400 if parsing came first.
    const response = await handlers.PATCH(json({ nope: true }), idContext);

    expect(response.status).toBe(401);
    expect(resolve).not.toHaveBeenCalled();
    expect(handler).not.toHaveBeenCalled();
  });

  it("behaves as before without the option", async () => {
    const handler = vi.fn(async () => ({ done: true }));
    const handlers = makeCrudRoute({ resolve: async () => "service", patch: { schema: z.object({ b: z.number() }), handler } });

    const response = await handlers.PATCH(json({ b: 3 }), idContext);

    expect(response.status).toBe(200);
    expect(handler).toHaveBeenCalledWith("service", 5, { b: 3 }, undefined);
  });
});

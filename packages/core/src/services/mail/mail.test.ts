import { describe, expect, it, vi } from "vitest";

import { createLogMailPort } from "../../adapters/mail/log-mail-port";
import { maskEmail } from "./mail.port";

describe("maskEmail", () => {
  it.each([
    ["jane@example.com", "j***@example.com"],
    ["a@b.pl", "a***@b.pl"],
    ["first.last+tag@sub.example.com", "f***@sub.example.com"],
    ["a@b@example.com", "a***@example.com"],
    ["", "***"],
    ["no-at-sign", "***"],
    ["@example.com", "***"],
    ["jane@", "***"],
  ])("masks %j as %j", (input, expected) => {
    expect(maskEmail(input)).toBe(expected);
  });
});

describe("createLogMailPort", () => {
  it("logs only the template and the masked recipient", async () => {
    const logger = { info: vi.fn(), error: vi.fn() };
    const port = createLogMailPort({ logger });
    await port.send({
      template: "return_submitted",
      to: "jane@example.com",
      data: { rma: "RMA-2026-00042", token: "secret-token" },
    });
    expect(logger.info).toHaveBeenCalledTimes(1);
    expect(logger.info).toHaveBeenCalledWith("mail not sent (mock adapter)", {
      template: "return_submitted",
      to: "j***@example.com",
    });
    const logged = JSON.stringify([...logger.info.mock.calls, ...logger.error.mock.calls]);
    for (const secret of ["jane@example.com", "RMA-2026-00042", "secret-token"]) {
      expect(logged).not.toContain(secret);
    }
  });
});

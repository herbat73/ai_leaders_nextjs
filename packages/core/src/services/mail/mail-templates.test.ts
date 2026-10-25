import { describe, expect, it } from "vitest";

import { renderMail } from "./mail-templates";
import { selectMailTransport } from "./mail-source";

describe("renderMail", () => {
  it("names the RMA and the kind in the submitted mail", () => {
    const complaint = renderMail({ template: "return_submitted", data: { rma: "RMA-2026-00001", kind: "complaint" } });
    expect(complaint.subject).toBe("Reklamacja przyjęta – RMA-2026-00001");
    expect(complaint.text).toContain("RMA-2026-00001");
    expect(renderMail({ template: "return_submitted", data: { rma: "RMA-2026-00002", kind: "return" } }).subject).toBe("Zwrot przyjęta – RMA-2026-00002");
  });

  it("translates the status and never includes a note", () => {
    const mail = renderMail({ template: "return_status_changed", data: { rma: "RMA-2026-00001", status: "approved", decisionNote: "secret" } });
    expect(mail.text).toContain("zatwierdzone");
    expect(mail.text).not.toContain("secret");
  });

  it("puts the invite link in the invite and degrades without one", () => {
    expect(renderMail({ template: "agent_invite", data: { displayName: "Ala", inviteUrl: "https://h/admin/invite/t", expiresAt: "x" } }).text).toContain("https://h/admin/invite/t");
    expect(renderMail({ template: "agent_invite", data: { displayName: "Ala", inviteUrl: null, expiresAt: "x" } }).text).toContain("Skontaktuj się");
  });

  it("renders the supplier claim as composed", () => {
    expect(renderMail({ template: "supplier_claim", data: { subject: "S", body: "B" } })).toEqual({ subject: "S", text: "B" });
  });

  it("does not throw on missing variables", () => {
    expect(() => renderMail({ template: "return_status_changed", data: {} })).not.toThrow();
    expect(renderMail({ template: "supplier_claim", data: {} })).toEqual({ subject: "", text: "" });
  });
});

describe("selectMailTransport", () => {
  it("defaults to the log transport", () => {
    expect(selectMailTransport({ transport: undefined, smtpUrl: undefined, from: undefined })).toEqual({ kind: "log" });
    expect(selectMailTransport({ transport: " LOG ", smtpUrl: undefined, from: undefined })).toEqual({ kind: "log" });
  });

  it("accepts a complete smtp configuration", () => {
    expect(selectMailTransport({ transport: "smtp", smtpUrl: "smtp://u:p@h:587", from: "zwroty@example.pl" })).toEqual({
      kind: "smtp",
      url: "smtp://u:p@h:587",
      from: "zwroty@example.pl",
    });
  });

  it.each([
    ["an unknown transport", { transport: "sendgrid", smtpUrl: undefined, from: undefined }],
    ["smtp without a url", { transport: "smtp", smtpUrl: " ", from: "a@b.pl" }],
    ["smtp without a sender", { transport: "smtp", smtpUrl: "smtp://h", from: undefined }],
    ["smtp with a malformed sender", { transport: "smtp", smtpUrl: "smtp://h", from: "not an address" }],
  ])("rejects %s", (_name, input) => {
    expect(() => selectMailTransport(input)).toThrow(/EASYRMS_/);
  });
});

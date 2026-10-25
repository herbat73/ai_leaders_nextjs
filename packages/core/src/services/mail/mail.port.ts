export type MailTemplate = "return_submitted" | "return_status_changed" | "agent_invite" | "supplier_claim";

export interface MailMessage {
  template: MailTemplate;
  to: string;
  /** Where replies go (the sending agent for a supplier claim); the sender stays the configured shared address. */
  replyTo?: string;
  /** Template variables (RMA, status, ...). Never logged by adapters that do not deliver the mail. */
  data: Record<string, unknown>;
}

/** Outbound e-mail. A failure may throw or reject; callers must not let it fail the request. */
export interface MailPort {
  send(message: MailMessage): Promise<void> | void;
  /**
   * True for an adapter that really hands mail to a mail server. The log adapter leaves it unset: code that must not
   * pretend a mail was sent (the supplier claim) refuses to run on a port that does not deliver.
   */
  readonly delivers?: boolean;
}

/** Minimal logger for mail code: only template ids and masked recipients may be passed as context. */
export interface MailLogger {
  info(message: string, context?: Record<string, unknown>): void;
  error(message: string, context?: Record<string, unknown>): void;
}

/** `jane@example.com` becomes `j***@example.com`; input without a usable local part and domain becomes `***`. */
export function maskEmail(email: string): string {
  const at = email.lastIndexOf("@");
  if (at < 1 || at === email.length - 1) return "***";
  return `${email.slice(0, 1)}***${email.slice(at)}`;
}

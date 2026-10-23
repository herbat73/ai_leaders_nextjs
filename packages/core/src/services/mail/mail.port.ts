export type MailTemplate = "return_submitted" | "return_status_changed";

export interface MailMessage {
  template: MailTemplate;
  to: string;
  /** Template variables (RMA, status, ...). Never logged by adapters that do not deliver the mail. */
  data: Record<string, unknown>;
}

/** Outbound e-mail. A failure may throw or reject; callers must not let it fail the request. */
export interface MailPort {
  send(message: MailMessage): Promise<void> | void;
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

import { ConfigurationError } from "../../errors";

export type MailTransport = { kind: "log" } | { kind: "smtp"; url: string; from: string };

const ADDRESS = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;

/**
 * Chooses the mail transport from `EASYRMS_MAIL_TRANSPORT`, `EASYRMS_SMTP_URL` and `EASYRMS_MAIL_FROM` (read by the
 * caller; `core` never reads the environment). The default is `log`, which delivers nothing (customer mail has always
 * been logged only; the supplier claim refuses to send on it). `smtp` needs a URL and a sender address and is the only
 * transport that delivers. An unknown value or a half-configured `smtp` is a configuration error, in every environment.
 */
export function selectMailTransport(input: {
  transport: string | undefined;
  smtpUrl: string | undefined;
  from: string | undefined;
}): MailTransport {
  const transport = input.transport?.trim().toLowerCase();
  if (!transport || transport === "log") return { kind: "log" };
  if (transport !== "smtp") throw new ConfigurationError(`Unknown EASYRMS_MAIL_TRANSPORT '${input.transport}'`);
  const url = input.smtpUrl?.trim();
  if (!url) throw new ConfigurationError("EASYRMS_SMTP_URL must be set when EASYRMS_MAIL_TRANSPORT=smtp");
  const from = input.from?.trim();
  if (!from || !ADDRESS.test(from)) throw new ConfigurationError("EASYRMS_MAIL_FROM must be a valid address when EASYRMS_MAIL_TRANSPORT=smtp");
  return { kind: "smtp", url, from };
}

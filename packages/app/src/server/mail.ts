import "server-only";

import { createLogMailPort, maskEmail, renderMail, selectMailTransport, type MailLogger, type MailPort } from "@easyrms/core";
import nodemailer from "nodemailer";

/**
 * Delivers through SMTP. The sender is always the configured shared address; `replyTo` (an agent's address for a
 * supplier claim) only steers replies. A failure rejects, as the `MailPort` contract allows: callers decide whether it
 * may fail their request. Only the template id and the masked recipient are logged, never the body.
 */
export function createSmtpMailPort({ url, from, logger }: { url: string; from: string; logger: MailLogger }): MailPort {
  const transporter = nodemailer.createTransport(url);
  return {
    delivers: true,
    async send(message) {
      const { subject, text } = renderMail(message);
      await transporter.sendMail({
        from,
        to: message.to,
        ...(message.replyTo ? { replyTo: message.replyTo } : {}),
        subject,
        text,
      });
      logger.info("mail sent", { template: message.template, to: maskEmail(message.to) });
    },
  };
}

/**
 * The mail adapter, chosen on first resolve and never at import (like the order source): `log` by default, `smtp` when
 * `EASYRMS_MAIL_TRANSPORT=smtp` with `EASYRMS_SMTP_URL` and `EASYRMS_MAIL_FROM`. A half-configured `smtp` is a
 * configuration error on first use.
 */
export function createMailPort({ logger }: { logger: MailLogger }): MailPort {
  const transport = selectMailTransport({
    transport: process.env.EASYRMS_MAIL_TRANSPORT,
    smtpUrl: process.env.EASYRMS_SMTP_URL,
    from: process.env.EASYRMS_MAIL_FROM,
  });
  return transport.kind === "smtp" ? createSmtpMailPort({ url: transport.url, from: transport.from, logger }) : createLogMailPort({ logger });
}

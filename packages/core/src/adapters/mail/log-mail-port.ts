import { maskEmail, type MailLogger, type MailPort } from "../../services/mail/mail.port";

/** Mock adapter: sends nothing and logs only the template id and the masked recipient (never body, data or address). */
export function createLogMailPort({ logger }: { logger: MailLogger }): MailPort {
  return {
    delivers: false,
    send({ template, to }) {
      logger.info("mail not sent (mock adapter)", { template, to: maskEmail(to) });
    },
  };
}

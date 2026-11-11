# Erasure runbook (customer data, T-21)

Who: the operator with access to the production environment. Why: a customer asks us to delete their data, or the
retention period (R16, one year after a request is closed) has passed.

## Automatic retention

1. Apply the database migrations first (`npm run db:migrate`): the script needs the `anonymized_at` column and fails without it.
2. Schedule `npm run retention:run` once a day with the operator's cron or job runner. The environment must carry the
   same `EASYRMS_DATABASE_URL` as the app and, if the default is not wanted, `EASYRMS_RETENTION_DAYS` (30 to 3650,
   default 365). Nothing is deleted until the script runs.
3. Before the first real run, try `npm run retention:run -- --dry-run`: it lists the RMA numbers that would be erased and
   changes nothing.
4. Exit code 0 is a clean run, 1 means one or more requests failed (their RMA numbers are printed; fix the cause and run
   again, the job is safe to repeat), 2 is a bad argument or setting.

## A customer's erasure request

1. Verify the person: the request must come from the e-mail address on the request or from a channel you can tie to the
   order. Do not erase on an unverified message.
2. Find the RMA number(s) of the order in the back office.
3. Run `npm run retention:erase -- --rma <RMA>` for each. A request that is still open is refused (exit 3); if the
   customer insists, check with legal and add `--force`.
4. Answer the customer with the date. Keep no copy of their data in the reply.

## What is erased

Photos and their audit rows; the customer e-mail (replaced by `erased-<RMA>@anonymized.invalid`); free text (reason,
defect description, exchange note, decision note, item comments, timeline notes); the subject, body and answer note of the
linked supplier claim (a draft claim whose text was erased can no longer be sent: 409 `claim_erased`). Photos that were uploaded but never attached to a request are deleted once they are older than the retention period.

## What is kept

Order number, SKUs, quantities, amounts, statuses and timestamps, so that reports and accounting stay whole.
Legal to confirm that keeping the order number is acceptable.

## What is not reached

- Database backups: they age out under the operator's backup rules (T-24).
- A supplier claim mail already sent: it cannot be recalled (T-22).
- The order platform, which holds its own copy.
- A customer who still holds a guest session of the order sees the request's status without text or photos.

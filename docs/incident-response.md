# Tipsyverse incident-response runbook

## Roles and first actions

The first responder becomes incident commander until ownership is transferred.
Assign an operations lead, communications lead, and note taker. Open an incident
record and capture timestamps, release SHA, request IDs, affected environments,
customer impact, and every action taken.

Priorities:

1. Protect people, accounts, funds, and evidence.
2. Stop additional harm using the smallest reversible action.
3. Restore a known-good service.
4. Communicate confirmed facts and next update time.
5. Preserve evidence and complete a blameless review.

Do not paste secrets, tokens, payment data, or personal data into chat or the
incident record.

## Database outage

1. Confirm `/live` is healthy and `/ready` is failing.
2. Check provider status, connection saturation, networking, and recent changes.
3. Pause job-enabled instances if retries could amplify database load.
4. Do not point production at staging or run destructive repair commands.
5. Fail over using the database provider's reviewed process, or restore the last
   verified backup into a new production target.
6. Verify indexes and representative user/event/payment relationships before
   reopening writes.

## Compromised credential

1. Identify the credential and affected systems without recording its value.
2. Revoke/rotate it at the provider, starting with the highest privilege.
3. Rotate dependent application secrets and redeploy immutable releases.
4. For access/refresh secret compromise, revoke all active `AuthSession` records
   and require login again.
5. Review provider audit logs, application request IDs, admin activity, payments,
   exports, and unusual account changes.
6. Engage counsel/security expertise for notification obligations.

## Payment or webhook failure

1. Preserve Stripe event IDs, PaymentIntent IDs, request IDs, and timestamps.
2. Stop manual retries that could duplicate charges or refunds.
3. Compare signed Stripe events with local payment and payment-request records.
4. Replay events through Stripe's supported tooling only after idempotency is
   confirmed.
5. Restrict payment actions if reconciliation cannot be trusted.
6. Record every customer-affecting correction and obtain finance approval.

## Bad deployment and rollback

1. Stop traffic shifting and identify the last healthy release.
2. Roll frontend and backend artifacts back to the recorded immutable versions.
3. Do not reverse a database migration until its reviewed rollback is confirmed.
4. Verify `/ready`, login/refresh, booking, payment display, Socket.IO, and jobs.
5. Preserve failed release logs and provider events before cleanup.

## Communications

State what is affected, what users should do, what the team is doing, and when
the next update will arrive. Avoid speculation and sensitive implementation
details. Customer, contractor, payment-provider, regulator, and public
notifications require the designated communications/legal owner.

## Closure

Document impact, timeline, detection gap, contributing conditions, recovery,
customer remediation, and assigned prevention work. Verify alerts and runbooks
with a follow-up exercise rather than closing solely on code changes.

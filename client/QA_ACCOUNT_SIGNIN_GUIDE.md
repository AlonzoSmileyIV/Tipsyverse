# Tipsyverse QA account and sign-in guide

For executable URLs, click-by-click procedures, expected results, test data,
and cleanup instructions, use [MANUAL_QA_RUNBOOK.md](./MANUAL_QA_RUNBOOK.md).
This file remains the compact account-to-scenario reference.

## Account legend

| Label | Email | Full name | Intended use |
|---|---|---|---|
| Admin A | `admin@tipsyverse.com` | Admin Tipsyverse | Primary admin actions |
| Admin B | `alonzo.smiley@tipsyverse.com` | Alonzo Smiley | Second-admin and concurrent-admin tests |
| Manager | `alonzo.smiley+manager@tipsyverse.com` | Maya Manager | Manager and hierarchy tests |
| Employee | `alonzo.smiley+employee@tipsyverse.com` | Evan Employee | Ordinary staff actions |
| Customer A | `alonzo.smiley+customer1@tipsyverse.com` | Chloe Customer | Primary customer |
| Customer B | `alonzo.smiley+customer2@tipsyverse.com` | Cameron Customer | Cross-account authorization |
| Suspended | `alonzo.smiley+suspended@tipsyverse.com` | Sasha Suspended | Suspended-account tests |
| Deactivated | `alonzo.smiley+deactivated@tipsyverse.com` | Diana Deactivated | Deactivated-account tests |
| Bartender A | `alonzo.smiley+bartender1@tipsyverse.com` | Bianca Bartender | Primary eligible bartender |
| Bartender B | `alonzo.smiley+bartender2@tipsyverse.com` | Brandon Bartender | Competing bids and cross-account tests |
| Expired bartender | `alonzo.smiley+bartender-expired@tipsyverse.com` | Elliot Expired | Expired-license tests |
| New customer | `alonzo.smiley+newcustomer@tipsyverse.com` | Enter manually during registration | Registration and activation only; not seeded |

All QA users except the two administrators use `QA_SEED_PASSWORD`. The New
customer uses the password entered manually during Scenario 1.

## Browser session setup

Keep these sessions separate so account switching does not invalidate the wrong
test:

1. **Browser A / normal window:** customer or bartender under test.
2. **Browser B / incognito window:** employee, manager, or administrator.
3. **Browser C / second browser or second incognito profile:** second customer,
   second bartender, or concurrent administrator.

Always verify the displayed user name before performing a destructive action.
Log out before reusing a browser window for a different identity.

## Authentication and accounts

### Scenario 1 — Register a new customer

- Start logged out in Browser A.
- At the valid-registration step, use New customer.
- Sign in as New customer only after activation.

### Scenario 2 — Attempt duplicate registration

- Start logged out.
- Use Customer A's existing email or username in the registration form.
- Do not alter Customer A.

### Scenario 3 — Invalid or expired activation link

- Start logged out.
- Use activation tokens generated for New customer.
- If Scenario 1 already consumed the token, register a temporary plus-address
  such as `alonzo.smiley+activation-test@tipsyverse.com`.

### Scenario 4 — Normal login and logout

- Start logged out.
- Sign in as Customer A.
- Log Customer A out during the specified logout step.

### Scenario 5 — Forgotten password

- Start logged out.
- Reset Customer A's password.
- Record the new password in the private QA run notes.
- Reseed afterward if later scenarios should use `QA_SEED_PASSWORD`.

### Scenario 6 — Session refresh and expiration

- Sign in as Customer A in Browser A.
- Keep that same session for all refresh and expiration checks.
- Reseed or sign in again before later customer scenarios if the session is
  intentionally invalidated.

### Scenario 7 — Suspended, deactivated, or terminated account

- Suspended check: attempt sign-in as Suspended.
- Deactivated check: attempt sign-in as Deactivated.
- Dynamic suspension check: Customer A in Browser A and Admin A in Browser B;
  Admin A suspends Customer A, then Browser A performs another action.
- Restore Customer A with Admin A before continuing.
- Termination is an employee-state test: Admin A terminates Employee, verifies
  Employee is blocked, then rerun the seed before scenarios that need Employee.

### Scenario 8 — Unauthorized route access

- Steps 1–5: logged out.
- Steps 6–8: Customer A.
- Steps 9–11: Bartender A.
- Use Admin A only to verify that the same admin route succeeds for an
  authorized identity.

## Public website

### Scenario 9 — Public navigation

- Remain logged out.

### Scenario 10 — Mobile navigation

- Remain logged out.

### Scenario 11 — Contact form

- Run once logged out using Customer A's email.
- Run once signed in as Customer A if the form supports authenticated users.
- Use Employee in Browser B to verify staff receipt or ticket visibility.

## Booking

### Scenario 12 — Book without logging in

- Remain logged out in Browser A.
- Use Customer A's email as the booking contact so the message reaches the
  Alonzo inbox.
- Use Employee in Browser B to verify the event appears internally.

### Scenario 13 — Book while logged in

- Sign in as Customer A.

### Scenario 14 — Booking validation boundaries

- Sign in as Customer A.
- Use Admin A only if price overrides or internal-only controls are part of the
  boundary test.

### Scenario 15 — Booking with optional information

- Create and edit as Customer A.
- Switch to Employee in Browser B to confirm staff visibility.

### Scenario 16 — Duplicate and interrupted booking

- Sign in as Customer A.
- Keep Employee available in Browser B to confirm the number of records created.

## Customer event management

### Scenario 17 — Customer views events

- Steps 1–8: Customer A in Browser A.
- Copy Customer A's event URL.
- Steps 9–11: Customer B in Browser C opens the copied URL.

### Scenario 18 — Customer updates an event

- Sign in as Customer A and use an event owned by Customer A.
- Use Employee in Browser B to confirm notifications and activity history.

### Scenario 19 — Customer cancels an event

- Sign in as Customer A.
- Use Employee in Browser B to confirm staff notification and status.

## Manual payments and finance

### Scenario 20 — Record a manual payment

- Employee records each manual payment in Browser B.
- Customer A views the result in Browser A.
- Admin A checks the activity log when needed.

### Scenario 21 — Partial payment

- Employee records payments.
- Customer A verifies totals and status.

### Scenario 22 — Overpayment

- Employee attempts the overpayment.
- Customer A verifies the resulting customer-facing balance.
- Admin A verifies the audit entry if a correction is made.

### Scenario 23 — Void a manual payment

- Employee records and voids the payment.
- Customer A verifies the recalculated history.
- Admin A verifies the audit record.

### Scenario 24 — Record a manual refund

- Employee records and refunds the payment.
- Customer A verifies the refund status.
- Admin A verifies the audit record.

### Scenario 25 — Edit a payment

- Employee performs the permitted edit.
- Customer A or Bartender A attempts the unauthorized edit through a direct
  request.
- Admin A verifies before/after audit values.

### Scenario 26 — Delete a finance record

- Use the same test record and attempt deletion in this order:
  Customer A, Bartender A, Employee, then Admin A.
- Use separate browser sessions and record each authorization result.

### Scenario 27 — Manual payment request

- Employee creates and sends the request.
- Send it to Customer A.
- Customer A opens the email and external link.
- Employee records the resulting manual payment.

### Scenario 28 — Finance reports

- Employee creates the underlying manual records.
- Admin A reviews reports, totals, filters, and exports.

## Stripe-disabled behavior

### Scenario 29 — Stripe remains disabled

- Customer A checks the saved-card and old payment-link experience.
- Employee attempts to select or record Stripe.
- Admin A or an API client performs direct endpoint checks.

## Bartender workflows

### Scenario 30 — Bartender onboarding/profile

- Use Bartender B for destructive onboarding/profile changes.
- Employee reviews the license in Browser B.
- Customer B performs the unauthorized-document access check.
- Rerun the seed afterward to restore Bartender B's standard profile.

### Scenario 31 — Missing or expired license

- Use Expired bartender for the initial restricted-action checks.
- Employee reviews the problem in Browser B.
- If testing pending status, temporarily change Expired bartender's license to
  pending, run the check, and reseed afterward.

### Scenario 32 — Bartender views and bids

- Sign in as Bartender A.
- Use Employee in Browser B to close bidding when testing late actions.

### Scenario 33 — Staff accepts or rejects a bid

- Bartender A submits one bid in Browser A.
- Bartender B submits another bid in Browser C.
- Employee reviews and accepts/rejects in Browser B.
- For the concurrency step, use Employee and Admin A in separate browsers.

### Scenario 34 — Bartender assignment lifecycle

- Employee assigns, removes, replaces, and cancels.
- Bartender A verifies the bartender-facing state.
- Use Bartender B when testing replacement.

### Scenario 35 — Attendance and live location

- Bartender A performs check-in, location, reconnect, and checkout actions.
- Employee verifies attendance and location visibility.
- Customer A attempts the unauthorized location-access check.

### Scenario 36 — Bartender payout tracking

- Employee creates or updates the payout.
- Bartender A verifies their own payout.
- Bartender B attempts to access Bartender A's payout.
- Admin A verifies the audit record.

## Drinks and social features

### Scenario 37 — Browse and search drinks

- Remain logged out.

### Scenario 38 — Drink likes and bookmarks

- Start logged out for the authentication check.
- Sign in as Customer A for likes and bookmarks.
- Switch to Customer B for cross-user manipulation checks.

### Scenario 39 — Comments and replies

- Customer A creates the original comment.
- Customer B replies and attempts to edit Customer A's comment.
- Return to Customer A to edit and delete their own content.

### Scenario 40 — Report and moderate comments

- Customer B creates the comment being reported.
- Customer A reports it.
- Employee moderates it.
- Bartender A or Customer B attempts unauthorized moderation.

### Scenario 41 — Social sharing

- Customer A creates or copies the share link.
- Open the link logged out in another browser.

## Learning courses

### Scenario 42 — Browse courses

- Start logged out.
- Sign in as Bartender A for eligible course access.
- Use Employee to verify unpublished-course restrictions if necessary.

### Scenario 43 — Course progress

- Sign in as Bartender A.
- Use Bartender B for the unauthorized progress-record request.

### Scenario 44 — Admin manages courses

- Admin A creates, edits, publishes, and archives the course.
- Bartender A verifies learner visibility and progress behavior.

## Administration

### Scenario 45 — Admin user management

- Admin A performs normal user-management actions.
- Use Admin B as the target for peer/critical-admin protection tests.
- Admin A performs the self-deletion test against their own account.

### Scenario 46 — Manager hierarchy restrictions

- Sign in as Manager.
- Employee is Manager's direct report.
- Admin A is a superior target.
- A true manager-peer account is not currently seeded. Create a temporary
  second manager or add one to the fixtures before claiming the peer test passed.

### Scenario 47 — Admin event management

- Admin A performs the event-management actions.
- Customer A verifies customer-visible changes.
- Bartender A verifies assignment-visible changes.

### Scenario 48 — Admin drink management

- Admin A manages the drink.
- Customer A verifies public visibility.
- Customer A or Bartender A performs the unauthorized mutation check.

### Scenario 49 — Promotions and pricing

- Admin A creates and configures promotions.
- Customer A applies the promotion.
- Customer B tests audience or per-user restrictions.

### Scenario 50 — Activity logs

- Generate actions with Customer A, Bartender A, Employee, Manager, and Admin A.
- Admin A reviews the logs.
- Customer A performs the unauthorized-access check.

### Scenario 51 — Notifications

- Customer A is the notification recipient.
- Employee or Admin A triggers staff-driven notifications.
- Customer B performs the cross-account notification-access check.

### Scenario 52 — Support tickets

- Customer A creates the ticket.
- Employee manages and replies to it.
- Customer B performs the unauthorized ticket-access check.

## Security and reliability

### Scenario 53 — Cross-account authorization

- Customer-owned resources: Customer A owns; Customer B attacks.
- Bartender resources: Bartender A owns; Bartender B attacks.
- Employee resources: Employee owns or creates; Customer A attacks.
- Manager hierarchy: Employee is the direct report; Manager is the actor;
  Admin A is the superior target.
- Admin A verifies logs after the attempts.

### Scenario 54 — Input and upload security

- Use Customer A for public/customer inputs.
- Use Bartender A for license uploads.
- Use Admin A for administrative forms.
- Use fake files and non-sensitive test strings only.

### Scenario 55 — Rate limiting and duplicates

- Stay logged out for repeated login, reset, contact, and anonymous booking tests.
- Use Customer A for authenticated booking actions.
- Use Employee for payment-request and finance-action tests.
- Reset rate-limit state or wait for the documented window before continuing
  unrelated scenarios.

### Scenario 56 — Network and API failures

- Use Customer A for customer saves and booking.
- Use Bartender A for bids and attendance.
- Use Employee for finance and staff mutations.

### Scenario 57 — Browser storage and private data

- Sign in as Customer A and inspect storage.
- Log out completely.
- Sign in as Customer B in the same browser and verify no Customer A data remains.

## Email

### Scenario 58 — Email delivery

- Activation: New customer.
- Password reset: Customer A.
- Booking confirmation/update/cancellation: Customer A, triggered by Customer A
  or Employee as appropriate.
- Assignment: Bartender A, triggered by Employee.
- Payment request/manual receipt/refund: Customer A, triggered by Employee.
- Support communication: Customer A, replied to by Employee.
- All plus-address messages should arrive in the Alonzo inbox; verify the exact
  `To` address for each message.

## Accessibility, compatibility, and performance

### Scenario 59 — Keyboard and screen-reader use

- Use Customer A for login, booking, and customer event flows.
- Use Employee for finance and admin-style dialogs.
- Also test public navigation while logged out.

### Scenario 60 — Browser compatibility

- Registration: New customer or a temporary new plus-address.
- Booking and event detail: Customer A.
- Manual finance: Employee.
- Upload and location: Bartender A.
- Notifications: Customer A, triggered by Employee.

### Scenario 61 — Performance

- Test public routes logged out.
- Use Customer A for event-history performance.
- Use Admin A for large administrative tables and exports.

## Production deployment

### Scenario 62 — Production configuration

- No application sign-in is required.
- Use deployment-platform and provider consoles.
- Do not seed QA accounts into production.

### Scenario 63 — Health and monitoring

- Health endpoint checks require no application account.
- Use Admin A only for authenticated UI smoke checks and deliberate captured
  errors.

### Scenario 64 — Backup and restore

- No account is needed for backup/restore commands.
- After restoration, sign in as Admin A, Customer A, Employee, and Bartender A
  to verify restored roles and records.

### Scenario 65 — Deployment rollback

- Infrastructure steps require no application account.
- After rollback, smoke-test with Customer A, Employee, Bartender A, and Admin A.

## Final launch tests

### Scenario 66 — Complete customer-to-event lifecycle

Use separate browser sessions and switch at these exact steps:

1. Steps 1–5: register, activate, and book as New customer in Browser A.
2. Steps 6–7: sign in as Employee in Browser B and review/open staffing.
3. Step 8: sign in as Bartender A in Browser C and submit the bid.
4. Steps 9–10: return to Employee and accept/assign.
5. Verify the assignment as Bartender A and the event state as New customer.
6. Steps 11–14: Employee records the deposit and balance; New customer verifies.
7. Step 15: Bartender A checks in and out.
8. Steps 16–17: Employee completes the event and records the payout.
9. Step 18: New customer submits the review.
10. Steps 19–20: Admin A verifies finance reports, logs, and absence of Stripe
    traffic.

### Scenario 67 — Launch-day failure recovery

- Use Admin A for operational verification.
- Keep Customer A signed in for customer-facing continuity checks.
- Keep Employee signed in for booking/finance record verification.
- Keep Bartender A signed in for Socket.IO reconnection checks.

## Accounts that require restoration after testing

Rerun the seed, or deliberately restore the fixture through Admin A, after:

- Scenario 5 changes Customer A's password.
- Scenario 7 suspends Customer A or terminates Employee.
- Scenario 30 changes Bartender B's onboarding/profile.
- Scenario 31 changes the Expired bartender's license state.
- Scenario 45 changes administrator status, role, or hierarchy.

Never run the seed against production.

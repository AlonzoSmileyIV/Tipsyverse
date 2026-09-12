# Tipsyverse manual QA runbook

This is the self-contained manual test guide for the local development
environment. It tells the tester which browser, account, URL, controls, and
test data to use, plus the expected result.

Do not run the seed or use QA accounts against production.

## 1. Test environment

### Local URLs

| Area | URL |
|---|---|
| Website | `http://localhost:3000` |
| Backend API | `http://localhost:3001/api/v1` |
| Backend health | `http://localhost:3001/api/v1/health` |
| Login | `http://localhost:3000/login` |
| Registration | `http://localhost:3000/register` |
| Book an event | `http://localhost:3000/book` |
| My Events | `http://localhost:3000/my-events` |
| Bartender area | `http://localhost:3000/bartend` |
| Learning | `http://localhost:3000/learn` |
| Admin overview | `http://localhost:3000/admin` |

If the client is running on a different port, replace `3000` in every website
link. The expected local API base URL is
`http://localhost:3001/api/v1`.

### Start and seed the application

From `backend`:

```bash
npm install
NODE_ENV=development node scripts/libs/seedFromDocs.script.js
NODE_ENV=development node scripts/libs/seedInitialData.script.js
npm run dev
```

From `client`, in a second terminal:

```bash
npm install
npm run dev
```

Expected backend startup:

```text
✅ Connected to development database...
🚀 Server running on port 3001...
✅ Scheduled job leadership acquired...
```

Before seeding, confirm these private values exist in `backend/.env`:

- `ADMIN_SEED_PASSWORD`
- `ADMIN2_SEED_PASSWORD`
- `QA_SEED_PASSWORD`

Do not copy real passwords into this runbook or a QA screenshot. All QA users
except Admin A and Admin B use the value of `QA_SEED_PASSWORD`.

### Browser setup

Keep three independent sessions open:

| Browser | Suggested mode | Primary identity |
|---|---|---|
| Browser A | Normal window | Customer A or Bartender A |
| Browser B | Incognito/private window | Employee, Manager, or Admin A |
| Browser C | Different browser/profile | Customer B, Bartender B, or Admin B |

Before every test:

1. Look at the name in the upper-right header.
2. Confirm it matches the account specified by the test.
3. Do not switch identities in a window without logging out first.
4. Keep DevTools open on **Console** and **Network** when testing failures.

## 2. Test accounts

The login form accepts either the email or username.

| Label | Username | Email | Password source | Use |
|---|---|---|---|---|
| Admin A | `admin` | `admin@tipsyverse.com` | `ADMIN_SEED_PASSWORD` | Primary owner/admin |
| Admin B | `alonzo.smiley` | `alonzo.smiley@tipsyverse.com` | `ADMIN2_SEED_PASSWORD` | Second owner/concurrency |
| Manager | `qa.manager` | `alonzo.smiley+manager@tipsyverse.com` | `QA_SEED_PASSWORD` | Manager hierarchy |
| Employee | `qa.employee` | `alonzo.smiley+employee@tipsyverse.com` | `QA_SEED_PASSWORD` | Daily staff workflows |
| Customer A | `qa.customer1` | `alonzo.smiley+customer1@tipsyverse.com` | `QA_SEED_PASSWORD` | Primary customer |
| Customer B | `qa.customer2` | `alonzo.smiley+customer2@tipsyverse.com` | `QA_SEED_PASSWORD` | Cross-account checks |
| Suspended | `qa.suspended` | `alonzo.smiley+suspended@tipsyverse.com` | `QA_SEED_PASSWORD` | Suspended-login denial |
| Deactivated | `qa.deactivated` | `alonzo.smiley+deactivated@tipsyverse.com` | `QA_SEED_PASSWORD` | Reactivation behavior |
| Bartender A | `qa.bartender1` | `alonzo.smiley+bartender1@tipsyverse.com` | `QA_SEED_PASSWORD` | Eligible bartender |
| Bartender B | `qa.bartender2` | `alonzo.smiley+bartender2@tipsyverse.com` | `QA_SEED_PASSWORD` | Competing bids |
| Expired bartender | `qa.bartender-expired` | `alonzo.smiley+bartender-expired@tipsyverse.com` | `QA_SEED_PASSWORD` | Expired permit denial |

### Login procedure

1. Open `http://localhost:3000/login`.
2. In **Email or Username**, enter the username or email from the table.
3. In **Password**, enter the correct private environment value.
4. Click **Login**.
5. Confirm the expected name appears in the header.
6. In DevTools, confirm login returns `200`.
7. Reload the page.
8. Confirm authentication is restored before protected data loads:
   `POST /users/refresh-token` should return `200`, followed by
   `GET /users/me` returning `200`. Normal startup should not use failed
   protected requests to trigger restoration.

## 3. Registration and activation

Use a new plus-address for every run. Recommended first run:

| Field | Value |
|---|---|
| Name | `Nora Newcustomer` |
| Email | `alonzo.smiley+newcustomer@tipsyverse.com` |
| Username | `qa.newcustomer` |
| Date of Birth | `07/02/1998` |
| Password | A unique QA-only password satisfying every displayed requirement |

If that email or username already exists, increment both:

- Email: `alonzo.smiley+newcustomer2@tipsyverse.com`
- Username: `qa.newcustomer2`

### Register successfully

1. Log out in Browser A.
2. Open `http://localhost:3000/register`.
3. Enter the values above.
4. Confirm each password-requirement indicator becomes valid.
5. Check **I agree to the Terms and Privacy Policy**.
6. Click **Register**.
7. Expect a success alert and automatic redirect to Login.
8. Open the activation email sent to the exact plus-address.
9. Click the activation link.
10. Expect an activation-success message.
11. Return to Login and sign in using the new email and QA-only password.
12. Confirm the header displays `Nora Newcustomer`.

Record:

- Registration response status
- Whether the activation email arrived
- Delivery time
- Activation-link result
- Whether login was blocked before activation

### Registration validation

Repeat while logged out:

1. Submit an empty form. Expect required-field messages.
2. Enter an invalid email. Expect email validation.
3. Enter an invalid date such as `99/99/2020`. Expect date validation.
4. Enter a weak password. Expect the unmet criteria to remain visible.
5. Leave the agreement unchecked. Expect submission to be blocked.
6. Use Customer A's email. Expect a generic duplicate-account error.
7. Use an existing username with a new email. Expect username suggestions.
8. Click one suggested username. Confirm it fills the Username field.
9. Reopen an already-consumed activation link. Expect a safe invalid/expired
   result and no server error.

## 4. Authentication and account-state tests

### Login, reload, and logout

1. Sign in as Customer A in Browser A.
2. Open `http://localhost:3000/my-events`.
3. Reload the page.
4. Confirm no login-page flash and no initial `/users/me` or `/events` `401`.
5. Leave the page open for more than 15 minutes and then navigate.
6. Expect silent access-token refresh while the session remains active.
7. Open the account menu and click **Logout**.
8. Open `http://localhost:3000/my-events`.
9. Expect redirect to Login.
10. Confirm the refresh cookie and in-memory access token can no longer restore
    the logged-out session.

### Forgot password

1. Log out.
2. Open Login and click **Forgot Password?**
3. Enter Customer A's email.
4. Submit.
5. Expect a generic success response that does not reveal whether an arbitrary
   email exists.
6. Open the reset email and click the reset link.
7. Enter a new QA-only password and submit.
8. Confirm the old password fails and the new password works.
9. Rerun the seed before tests that expect `QA_SEED_PASSWORD`.

### Suspended account

1. Log out in Browser A.
2. Attempt login as Suspended.
3. Expect access to be denied with a suspension message.
4. Confirm no authenticated screen briefly renders.

### Deactivated account

1. Attempt login as Deactivated.
2. Verify the displayed reactivation behavior matches the product copy.
3. If login reactivates the account, confirm the state changes to Active.
4. Rerun the seed afterward to restore the deactivated fixture.

### Unauthorized routes

While logged out, open:

- `http://localhost:3000/settings`
- `http://localhost:3000/admin`
- `http://localhost:3000/pay/not-a-real-request`

Expect protected routes to redirect to Login.

Sign in as Customer A and open `http://localhost:3000/admin`. Expect
**Access Denied**, not admin content.

Sign in as Bartender A and repeat. Expect **Access Denied**.

## 5. Public website

Remain logged out:

1. Open `/`, `/drinks`, `/about`, `/contact`, `/faq`, `/privacy`, and
   `/terms-conditions`.
2. Verify each page loads without authentication.
3. Use the header links and browser Back/Forward buttons.
4. Open one drink from `/drinks`.
5. Confirm the detail URL uses `/drinks/{slug}`.
6. Search and filter drinks.
7. Open the same drink in a private window.
8. Confirm public content is visible without private user data.
9. Open `/does-not-exist`. Expect the Not Found screen.

### Mobile navigation

In Chrome DevTools:

1. Enable device emulation.
2. Test widths `375`, `599`, `796`, `800`, and `801` pixels.
3. Open and close the mobile navigation.
4. Confirm no horizontal page scrolling.
5. At `800px` and below, inspect each table:
   - exactly two columns should be visible;
   - if the grid has an **Actions** column, the visible columns should be its
     primary column and **Actions**;
   - action buttons must remain clickable.
6. At `801px`, confirm the normal responsive column configuration returns.

## 6. Customer workflow

### Sign in

Use Customer A in Browser A.

### Browse and interact with drinks

1. Open `http://localhost:3000/drinks`.
2. Search for a seeded drink.
3. Open the drink.
4. Click Like. Confirm the state and count update.
5. Click Save/Bookmark. Confirm the saved state updates.
6. Reload. Confirm both states persist.
7. Add a harmless QA comment such as `QA comment - {today's date}`.
8. Edit the comment.
9. Add a reply.
10. Delete the reply, then delete the comment.
11. Log out and verify Like, Save, and Comment actions require authentication.

### Book an event

1. Sign in again as Customer A.
2. Open `http://localhost:3000/book`.
3. On the details step, enter:
   - Event Type: `Birthday`
   - Event Description: `QA birthday booking - do not fulfill`
   - Primary Contact Name: `Chloe Customer`
   - Primary Contact Email:
     `alonzo.smiley+customer1@tipsyverse.com`
   - Primary Contact Phone: a non-real reserved QA number
   - Preferred Method of Contact: `Email`
4. Enter an event date at least two weeks in the future.
5. Enter an arrival and leave time with the leave time after arrival.
6. Enter a valid QA location and optional instructions:
   `QA TEST ONLY - no real service required`.
7. Click **Next**.
8. Review Type, When, Where, Instructions, Description, and Contact.
9. Open/read the booking terms.
10. Complete every required policy acknowledgment.
11. Select the media preference.
12. Check **I have read and agree to the Tipsyverse booking terms, service
    policies, and agreement.**
13. Click **Submit Request** once.
14. Expect a success confirmation and one new event—not duplicates.
15. Save the event code and event-detail URL in the QA run notes.

### Booking validation

Repeat without submitting a second valid event:

1. Leave required fields empty. Confirm inline validation.
2. Put the end time before the start time. Confirm rejection.
3. Leave the policy agreement incomplete. Confirm Submit is disabled or blocked.
4. Double-click Submit during a throttled connection. Confirm only one event is
   created.
5. Set DevTools Network to Offline immediately before submission. Confirm a
   recoverable error and no false success message.

### Booking change and customer-request scenarios

Use disposable events for this section. Do not reuse the primary event needed
for bidding, assignment, attendance, payment, and review tests. Prefix every
description and staff note with `QA SCENARIO - DO NOT FULFILL`, record the event
code, and never contact a real person.

For each scenario:

1. Book the event as Customer A and record its original values.
2. As Employee, log the customer's request as a contact attempt or event note.
3. Make the change only through the controls available to that role. If the
   product intentionally requires staff assistance, confirm the customer sees
   clear instructions rather than an editable control.
4. Review any pricing-change or cancellation confirmation before accepting it.
5. Reload the page and compare the customer event, admin event, Finance,
   payment history, staffing, notifications, email, and activity log wherever
   applicable.
6. Confirm the mutation and customer notification occur exactly once, internal
   notes remain private, and no unrelated event changes.

#### Point-of-contact changes

Test each request independently:

- Change only the primary contact's name.
- Change the contact email to another QA-controlled address.
- Change the contact phone to another reserved QA number.
- Change the preferred contact method from email to phone and back.
- Replace the point of contact with a different person while keeping Customer A
  as the event owner.
- Add a secondary/on-site contact if supported.
- Make the billing contact different from the on-site contact if supported.
- Correct capitalization, punctuation, or a typo without changing ownership.
- Remove an optional contact value and confirm required values cannot be
  removed.
- Enter leading/trailing spaces and confirm saved values are normalized.
- Enter international characters, apostrophes, and hyphens in the contact name.
- Attempt invalid email and phone formats and confirm they are rejected.
- As Customer B, attempt to change Customer A's contact data by URL or request
  replay. Confirm denial and no private data in the response.

Changing a point of contact must not transfer event ownership, expose Customer
A's account, silently change the login email, or redirect payment requests to an
unapproved recipient.

#### Staffing changes

Test these before bidding, while bids exist, after one assignment, and after a
deposit when the workflow permits:

- Customer asks to add one bartender.
- Customer asks to add several bartenders.
- Customer asks to reduce the bartender count.
- Customer asks to remove all bartenders.
- Guest count increases enough to change the recommended staffing count.
- Guest count decreases enough to change the recommendation.
- Employee overrides the recommendation with a different approved count.
- Approved staffing is increased above the current assigned count.
- Approved staffing is reduced to exactly the assigned count.
- Attempt to reduce approved staffing below the assigned count. Expect a clear
  resolution flow; assigned bartenders must not disappear silently.
- Increase staffing after the event is Ready To Assign and confirm the new open
  slots appear to eligible bartenders.
- Reduce staffing while bids are pending and confirm excess bids remain safely
  handled without becoming assignments.
- Increase staffing after assignment and confirm existing assignments remain.
- Remove one assigned bartender with a reason, then assign a replacement.
- Attempt to assign the same bartender twice.
- Attempt to assign more bartenders than the approved count.
- Attempt to assign an unavailable, conflicting, expired, rejected, or pending-
  license bartender.
- Have two employees assign the last open slot concurrently. Confirm the final
  assigned count cannot exceed the approved count.

For every staffing change, verify recommended, approved, assigned, and still-
needed counts remain distinct and correct. Confirm labor, gratuity, tax, total,
balance, bartender schedules, notifications, and activity history update only
when the business rules say they should.

#### Gratuity, tip jars, and service-model changes

Test these as separate pricing revisions:

- Customer initially allows tip jars, then asks for no tip jars. Increase the
  contractual gratuity to the required amount and confirm the old and new
  gratuity are shown in the pricing-change review.
- Customer initially declines tip jars, then permits them. Confirm any gratuity
  reduction follows policy and is not applied silently.
- Toggle tip-jar permission twice before saving. Confirm only the final state is
  stored and only one activity entry is created.
- Change gratuity from a percentage to a fixed amount, if supported.
- Change gratuity from a fixed amount to a percentage, if supported.
- Enter zero gratuity where tip jars are prohibited. Expect policy validation.
- Enter the minimum and maximum allowed gratuity values.
- Attempt a negative, excessive, malformed, or over-precision gratuity value.
- Change gratuity before payment, after a deposit, and after paid in full.
- Increase gratuity after payment and confirm the new amount becomes balance
  due rather than altering prior payment records.
- Decrease gratuity while keeping total above paid and confirm balance falls.
- Decrease gratuity below the paid amount and confirm a credit/overpayment or
  staff-review state appears; no automatic refund may occur.
- Add, remove, or change a service charge, travel fee, setup fee, or other
  supported line item and verify gratuity and tax are recalculated according to
  policy without double counting.
- Confirm customer-facing copy clearly distinguishes gratuity, tip-jar policy,
  tax, fees, paid amount, and remaining balance.

#### Cancellation and reinstatement

Use a new event for each materially different cancellation state:

- Point of contact cancels immediately after submitting the request.
- Cancel after staff contact but before pricing.
- Cancel after pricing but before Ready To Assign.
- Cancel while bartender bids are pending.
- Cancel after one or more bartenders are assigned.
- Cancel after a deposit.
- Cancel after paid in full.
- Cancel on the event date or inside any configured cancellation-fee window.
- Attempt cancellation after completion.
- Cancel with each available reason and with optional customer-safe notes.
- Attempt cancellation without a required reason.
- Start cancellation and back out at the confirmation dialog.
- Double-click Confirm or replay the cancellation request.
- Have two staff members cancel the same event concurrently.
- Attempt to edit, bid on, assign, check in to, pay, or complete a canceled
  event.
- Attempt to cancel an already canceled event.
- Reinstate/reopen a canceled event if supported; otherwise confirm the UI
  clearly requires a new booking.

Verify the final status, reason, cancellation fee, credit/refund-review state,
staffing release, opportunity removal, schedules, payment requests,
notifications, email, and activity log. Cancellation must never automatically
refund money unless an explicitly authorized refund workflow is completed.

#### Date and time changes

- Move the event to a later date.
- Move it to an earlier date that still satisfies minimum lead time.
- Attempt to move it inside the minimum lead-time window.
- Move arrival time earlier or later.
- Move leave time earlier or later.
- Extend and shorten event duration.
- Attempt equal start/end times or an end before the start.
- Test an event crossing midnight.
- Test daylight-saving-time boundaries and the Indiana event timezone.
- Reschedule before bidding, with bids pending, after assignment, after a
  deposit, and after paid in full.
- Reschedule into and out of an assigned bartender's conflicting event.
- Have two staff members reschedule concurrently; stale data must not overwrite
  the accepted change without warning.

Confirm availability and conflicts are recalculated, affected bartenders and
the customer are notified, price changes are reviewed, and all screens and
emails show the same local event time.

#### Venue and location changes

- Correct a typo in the same address.
- Move to another address in the same city.
- Move to another city or service zone.
- Move from an indoor to outdoor venue and vice versa.
- Add or change suite, unit, gate, parking, loading, or entry instructions.
- Change to a location that geocodes to different coordinates.
- Use a valid address for which coordinates are unavailable.
- Clear an optional address component.
- Attempt an incomplete, malformed, out-of-service-area, or obviously unsafe
  location.
- Change venue after bidding and after assignment.
- Change venue so an assigned bartender now has a travel or timing conflict.
- Change venue after travel fees or mileage have been priced.

Confirm coordinates, service-area validation, travel fees, tax jurisdiction,
directions, opportunities, assignments, customer details, and notifications
refresh together. The old private address must not remain exposed in stale
notifications or unauthorized responses.

#### Event size, type, and service scope

- Increase and decrease guest count by one.
- Change guest count across every staffing/pricing threshold.
- Test minimum, maximum, zero, negative, decimal, nonnumeric, and extremely
  large guest counts.
- Change the event type, title, description, and special instructions.
- Add or remove bar setup, cleanup, cocktail service, beer/wine-only service,
  mocktails, champagne toast, or other supported service options.
- Change who supplies alcohol, mixers, ice, cups, garnishes, tools, and bar
  equipment where those options exist.
- Add or remove an additional bar or service area.
- Add accessibility, parking, loading, dress-code, venue-rule, or security
  instructions.
- Add a dry-event or no-alcohol requirement.
- Add a last-minute restriction such as no glass, no open flame, or no tip jars.
- Enter a long description, line breaks, Unicode/emoji, and harmless HTML text;
  confirm layout is stable and scripts never execute.
- Clear optional instructions and confirm required operational information is
  retained.

Confirm changes that affect labor, staffing, supplies, fees, gratuity, or tax
produce a transparent repricing review and changes that do not affect price
leave financial totals untouched.

#### Pricing, discounts, tax, and payment timing

- Quote and save the initial price, then make one price-affecting change at a
  time.
- Add, edit, and remove an allowed discount or promotion.
- Attempt an expired, ineligible, excessive, duplicate, or malformed discount.
- Enter zero-dollar, minimum, maximum, decimal, and over-precision line items.
- Attempt negative values where credits are not supported.
- Change a taxable item and a nontaxable item separately.
- Change location across a tax boundary and verify tax treatment.
- Save a no-op edit and confirm no false pricing mutation is recorded.
- Abandon the pricing-change dialog and confirm no partial values persist.
- Submit the same pricing revision twice and confirm it is idempotent.
- Reprice with no payment, a partial deposit, paid in full, an overpayment, a
  voided payment, and a pending payment request.
- Open an old payment-request link after the total changes and confirm the user
  cannot overpay or pay a stale unauthorized amount.
- Have payment and repricing submitted concurrently. Confirm payment history is
  immutable and total, paid, credit, and balance settle consistently.

#### Customer decisions and communication

- Customer accepts a revised quote.
- Customer declines a revised quote but does not cancel.
- Customer requests more information before deciding.
- Customer becomes unreachable after one or multiple contact attempts.
- Customer asks to pause/hold the booking if supported.
- Customer later resumes a held booking.
- Customer requests a copy of the agreement or invoice.
- Customer disputes a detail shown in the confirmation.
- Customer changes communication preference after notifications already exist.
- Point of contact asks that a secondary person receive operational updates.
- Customer requests deletion of an internal note; confirm internal audit data
  is not exposed or improperly destroyed.

Confirm customer-visible status language is unambiguous, staff-only notes never
appear to customers or bartenders, and every email/link uses the staging host
and opens the exact event or decision requested.

#### Workflow boundaries and recovery

- Refresh, navigate Back, close the tab, and sign out with an unsaved booking.
- Save or submit on slow, offline, timed-out, and recovered connections.
- Retry after a `400`, `401`, `403`, `409`, `422`, and `500` response when each
  can be safely simulated.
- Let the session expire while reviewing, submitting, repricing, or canceling.
- Open the same event in two tabs and save conflicting edits.
- Have Customer A and Employee view the event while Employee changes it.
- Have Employee and Admin A edit different fields concurrently.
- Repeat a request using browser reload or Network request replay.
- Use browser Back after successful submission and attempt resubmission.
- Open a stale notification, email, event URL, and payment URL after the event
  changes status.
- Verify changes survive application and browser reloads.
- Verify direct API requests enforce the same ownership, role, state, and value
  rules as the UI.

No scenario may create duplicate events, payments, assignments, notifications,
emails, or activity entries. Errors must preserve the last confirmed state and
provide a recoverable message without leaking stack traces, tokens, internal
notes, or another customer's data.

### View and protect customer events

1. Open `http://localhost:3000/my-events`.
2. Locate the saved event code.
3. Open its details.
4. Verify contact, date/time, location, status, price, payments, and staffing
   data match the booking.
5. Copy the event URL.
6. In Browser C, sign in as Customer B.
7. Paste Customer A's event URL.
8. Expect denial or a safe not-found result; Customer A's private event details
   must not display.

### Customer settings

1. Return to Customer A.
2. Open `http://localhost:3000/settings`.
3. Review each available settings tab.
4. Change one harmless preference and save.
5. Reload and confirm persistence.
6. Cancel a second edit and confirm the original value remains.
7. Do not delete the seeded account unless this is the final test before reseed.

### Prepare the event for bartender bidding

Before testing bartender opportunities, sign in as Employee in Browser B:

1. Open `http://localhost:3000/admin/events`.
2. Search for the event code saved during the customer booking test.
3. Open the event and review the submitted details.
4. Open **Log Contact Attempt** and record a harmless QA attempt with notes such
   as `QA contact attempt - {today's date}`. Do not contact a real person.
5. Save, reload the event, and confirm the method, outcome, notes, timestamp,
   and employee attribution persist exactly once.
6. Complete any required pricing and staffing fields, including bar type,
   payment total, and number of bartenders needed.
7. Continue through the event workflow and click **Continue to Assign**.
8. Expect the event status to change to **Ready To Assign**
   (`ready_to_assign`).
9. Confirm the event now appears as an available opportunity for eligible
   bartenders. Do not manually assign a bartender yet; bidding is tested next.

## 7. Bartender workflow

### Eligible bartender

Sign in as Bartender A in Browser A:

1. Open `http://localhost:3000/bartend`.
2. Review the profile, license, opportunities, assignments, attendance, payout,
   and How To areas exposed by the UI.
3. Confirm the seeded permit is active and expires in `2030`.
4. Confirm required course progress is visible.
5. Open an available event and submit a QA bid.
6. Reload and confirm the bid persists.
7. Attempt a duplicate bid. Expect prevention or update behavior—not two bids.

### Competing bid

1. Keep Bartender A in Browser A.
2. Sign in as Bartender B in Browser C.
3. Open the same opportunity.
4. Submit a different QA bid.
5. Confirm neither bartender can see or mutate the other's private bid data.

### Expired permit

1. Log out in Browser C.
2. Sign in as Expired bartender.
3. Open `/bartend`.
4. Attempt to bid or perform a permit-gated action.
5. Expect a clear expired-license message and no mutation.

### Learning

As Bartender A:

1. Open `http://localhost:3000/learn`.
2. Open **Tipsyverse Bartending Foundations**.
3. Open the next available module.
4. Complete a safe progress step.
5. Reload and confirm progress persists.
6. Confirm locked/unpublished content is not exposed.

### Assignment and attendance

After Employee assigns Bartender A to the QA event:

1. Return to Bartender A.
2. Open the assignment.
3. Verify event time, location, instructions, and assignment status.
4. Test Check In only when using a controlled QA date/state.
5. Verify duplicate Check In is blocked.
6. Test live-location enable/disable with browser permission controls.
7. Deny location permission and confirm a useful error.
8. Test Check Out and confirm attendance updates.

## 8. Employee and manager workflow

### Employee event processing

Sign in as Employee in Browser B:

1. Open `http://localhost:3000/admin/events`.
2. Search for the saved event code.
3. Open **Actions** for the event.
4. Confirm the event is still **Ready To Assign** and that its pricing and
   staffing details match the earlier review.
5. Open the assignment area.
6. Review Bartender A and Bartender B's bids.
7. Accept/select Bartender A and reject or leave Bartender B unselected.
8. Save.
9. Confirm the event and bartender records both show the assignment.
10. In Browser A, confirm Bartender A sees the assignment.
11. As Customer A, confirm only customer-safe assignment information appears.

### Manual payment

As Employee:

1. Open the QA event from Admin → Events.
2. Open its finance/payment area.
3. Choose the manual/offline payment provider.
4. Enter:
   - Amount Received: a small valid amount within the balance
   - Payment Method: an allowed test method
   - Reference: `QA-MANUAL-{date}`
   - Date Received: today
   - Notes: `QA TEST PAYMENT`
5. Save once.
6. Confirm paid and remaining balances recalculate.
7. As Customer A, verify the payment appears in event history.
8. Return as Employee and test the permitted void/refund flow.
9. Confirm balances and statuses recalculate after each operation.

Never use a real card, bank account, payment link, or real-money provider during
development QA.

### Event cancellation

Do not cancel the primary QA event used for bidding, assignment, payment,
attendance, and review tests. Use a second disposable QA event:

1. As Customer A, submit a second future booking clearly labeled
   `QA cancellation test - do not fulfill` and record its event code.
2. As Employee, find and open that event in Admin → Events.
3. Click **Cancel Event**, select a valid QA reason, and confirm cancellation.
4. Reload and confirm the event remains **Canceled**, the reason is retained,
   and no duplicate cancellation history is created.
5. As Customer A, confirm the canceled status is visible without exposing
   internal employee-only notes.
6. Attempt to cancel it again and expect the action to be disabled or safely
   rejected without creating a second cancellation.

### Manager restrictions

Sign in as Manager:

1. Open Admin → Users → Our Team.
2. Open Employee, who is Manager's seeded direct report.
3. Confirm permitted direct-report edits are available.
4. Open Admin A or Admin B.
5. Attempt to edit a superior.
6. Expect denial.
7. Attempt to delete or change the Manager's own protected status.
8. Expect denial.

## 9. Administrator workflow

Sign in as Admin A in Browser B.

### Overview

1. Open `http://localhost:3000/admin`.
2. Confirm summary/attention cards load.
3. Click each card and verify it opens the corresponding records.

### Events

1. Click **Events** or open `/admin/events`.
2. Search by event code, contact name, status, type, and location.
3. Test filters and pagination.
4. Open an event through **Actions**.
5. Verify edits are reflected for Customer A and assigned Bartender A.

### Finance

1. Click **Finance** or open `/admin/finance`.
2. Test date filters and status filters.
3. Verify totals equal the visible QA event records.
4. Open the payment/refund actions.
5. Download an available report.
6. Confirm the file opens and contains no credentials or secret tokens.

### Users

1. Click **Users** or open `/admin/users`.
2. Click each summary card:
   - Customers
   - Bartenders
   - Bartender Licenses
   - Our Team
3. Search each table.
4. Open a row through **Actions**.
5. Test **Need Review** under Bartender Licenses.
6. Download each Excel export and validate headings and row counts.
7. Suspend Customer A with a clear QA reason.
8. In Browser A, perform another protected action.
9. Expect immediate forced logout/suspension notice.
10. Restore Customer A before continuing.

Do not delete, demote, suspend, or terminate both administrator accounts.

### Operations

1. Click **Operations** or open `/admin/operations`.
2. Test **Incidents & Support**:
   - search/filter records;
   - open a record with Actions;
   - update status;
   - add a harmless QA reply/note;
   - verify unauthorized customers cannot access staff controls.
3. Click **Promo Codes**:
   - create a uniquely named QA promo such as `QA10-{date}`;
   - set a safe test discount and valid date range;
   - save and verify it appears;
   - test it on a QA event;
   - deactivate/delete it after verification.
4. Click **Courses**:
   - select **Tipsyverse Bartending Foundations**;
   - verify Module Title and Actions remain visible at `800px`;
   - add a temporary module named `QA Module - {date}`;
   - edit it;
   - save modules;
   - remove the temporary module and save again.

### Drinks

1. Click **Drinks** or open `/admin/drinks`.
2. Under **Library**, search/filter and open a drink through **Actions**.
3. Edit one reversible text field and save.
4. Verify the public drink page updates.
5. Revert the edit.
6. Open **Create Drink** and validate required fields without saving junk data.
7. Open **Analytics** and validate totals/filters.
8. Test the Excel download.

### Catalog Setup

1. Click **Catalog Setup** or open `/admin/categories`.
2. Review each available catalog group.
3. Search and open records through **Actions**.
4. Add a uniquely named temporary QA item.
5. Edit it.
6. Confirm dependent forms can select it.
7. Delete/deactivate the temporary item.

### How To

1. Click **How To**.
2. Search or expand each guide section.
3. Confirm links and instructions match the current UI.

### Concurrent administrator safety

1. Keep Admin A signed in in Browser B.
2. Sign in as Admin B in Browser C.
3. Open the same QA event or temporary record in both.
4. Make different edits without saving.
5. Save Admin A's edit, then save Admin B's stale edit.
6. Record whether the system detects the conflict or applies last-write-wins.
7. Verify the final value and activity log.

## 10. Notifications, support, and email

### Notifications

1. Keep Customer A signed in.
2. Trigger an event update as Employee.
3. Confirm the notification bell updates without a reload.
4. Open the notification.
5. Confirm it links to the correct resource.
6. Mark it read and reload.
7. Confirm read state persists.
8. Sign in as Customer B and verify Customer A's notification is inaccessible.

### Support

1. As Customer A, open Contact or the customer support entry point.
2. Submit:
   - Subject: `QA support test - {date}`
   - Message: `Automated/manual QA only. No response required outside test.`
3. As Employee, open Admin → Operations → Incidents & Support.
4. Locate the ticket.
5. Open it through **Actions** and add a QA reply.
6. Return to Customer A and verify visibility.
7. Confirm Customer B cannot access the ticket.

### Email matrix

Verify the exact recipient, subject, and safe link for:

| Email | Recipient |
|---|---|
| Account activation | New customer plus-address |
| Password reset | Customer A |
| Booking confirmation/update/cancellation | Customer A |
| Assignment | Bartender A |
| Payment request/receipt/refund | Customer A |
| Support reply | Customer A |

Never include access tokens, refresh tokens, password hashes, internal stack
traces, or unrelated customer data in email.

## 11. Security and privacy checks

1. As Customer B, try Customer A's copied event URL.
2. As Bartender B, try Bartender A's assignment/resource URL.
3. As Customer A, open admin URLs.
4. Log out and repeat protected API requests from DevTools.
5. Confirm responses are `401` for unauthenticated and `403` for authenticated
   but unauthorized access, where applicable.
6. Confirm error bodies do not expose stack traces, database queries, secrets,
   or account-existence details.
7. Inspect Local Storage:
   - `loggedInUser` may contain safe session/user metadata;
   - it must not contain the access token or refresh token.
8. Inspect cookies:
   - refresh token must be HTTP-only;
   - JavaScript must not be able to read it.
9. Log out Customer A and log in as Customer B in the same browser.
10. Confirm no Customer A data remains in screens, Redux state, storage, or
    cached requests.
11. Test upload controls with a harmless wrong file type and oversized dummy
    file. Confirm safe rejection.
12. Enter harmless HTML/script-like QA strings into text fields. Confirm they
    render as text or are sanitized.

## 12. Network and reliability checks

Use DevTools Network throttling:

1. Set **Slow 3G** and reload an authenticated screen.
2. Confirm one authentication restoration occurs before protected components
   fetch.
3. Confirm loading indicators appear and buttons cannot submit twice.
4. Set **Offline**, attempt a safe save, and confirm:
   - no false success;
   - entered data remains recoverable where practical;
   - returning online permits a retry.
5. Restore **No throttling**.
6. Reload and confirm Socket.IO/notifications reconnect.
7. Check the backend console for uncaught errors or repeated refresh loops.

## 13. Full customer-to-event lifecycle

Run this last because it intentionally changes many records.

1. Browser A: register and activate a fresh New customer.
2. Browser A: sign in as New customer.
3. Browser A: book a future QA event and record its event code.
4. Browser B: sign in as Employee.
5. Browser B: Admin → Events → search the event code → open Actions.
6. Browser B: complete required review, pricing, and staffing fields.
7. Browser B: move the event into bidding/assignment readiness.
8. Browser C: sign in as Bartender A and submit a bid.
9. Browser B: refresh the event, accept the bid, and assign Bartender A.
10. Browser C: confirm assignment details as Bartender A.
11. Browser A: confirm customer-visible event status.
12. Browser B: record a manual deposit.
13. Browser A: verify deposit and remaining balance.
14. Browser B: record the remaining valid balance.
15. Browser A: verify paid status.
16. Browser C: perform controlled Check In and Check Out.
17. Browser B: mark the event complete using the supported workflow.
18. Browser B: record/verify bartender payout tracking.
19. Browser A: submit a QA review if the UI permits reviews for completed events.
20. Browser B or Admin A: verify Finance totals and Activity Logs.
21. Confirm no Stripe request occurred while
    `REACT_APP_STRIPE_ENABLED=false`.

Pass only if the same event code remains consistent across customer, employee,
bartender, finance, notification, and activity-log views.

## 14. Post-test restoration

Rerun the seed after any test that changes fixture credentials or critical
account state:

```bash
NODE_ENV=development node scripts/libs/seedInitialData.script.js
```

Reseed after:

- changing Customer A's password;
- reactivating Deactivated;
- suspending Customer A;
- terminating or restructuring Employee;
- changing Bartender B's onboarding/profile;
- changing Expired bartender's permit;
- changing administrator role, status, or hierarchy.

Also remove:

- temporary QA courses/modules;
- temporary promos;
- temporary catalog records;
- disposable comments/support tickets when deletion is supported;
- exported files containing test customer data.

Never wipe or reseed production.

## 15. QA result template

Copy this for every defect:

```text
Test:
Date/time:
Environment:
Browser and viewport:
Account:
URL:
Preconditions:
Steps:
1.
2.
3.

Expected:
Actual:
HTTP status/request ID:
Console error:
Screenshot/video:
Reproducibility: Always / Sometimes / Once
Severity: Blocker / High / Medium / Low
Cleanup performed:
```

### Final release gate

A QA run is not complete until:

- public pages work logged out;
- registration, activation, login, refresh, and logout work;
- customer booking and event access work;
- cross-account requests are denied;
- bartender bidding, assignment, learning, and permit gates work;
- employee event and manual-finance workflows work;
- all admin tabs load and Actions remain usable on mobile;
- notifications and required emails reach only the intended account;
- no access/refresh tokens appear in Local Storage;
- no uncaught backend errors or refresh loops remain;
- the full customer-to-event lifecycle passes;
- critical fixtures and temporary records are restored.

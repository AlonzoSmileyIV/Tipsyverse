# Tipsyverse Deployment Checklist

Use this checklist before pushing to GitHub, staging, or production.

## Source Control

- Confirm `.env`, `node_modules`, `client/build`, logs, and OS files are ignored.
- Commit from the root project directory.
- Review staged files with `git status --short` and `git diff --cached --stat`.
- Avoid committing generated exports unless they are intentional seed/import assets.

## Environment Variables

Backend:

- `NODE_ENV`
- `PORT`
- `API_URL`
- `FRONTEND_URL`
- `PUBLIC_APP_URL`
- `ADMIN_PORTAL_URL`
- `CORS_ORIGINS`
- `MONGO_PROD_URI`
- `ACCESS_TOKEN_SECRET`
- `REFRESH_TOKEN_SECRET`
- `SALT_ROUNDS`
- `RESEND_EMAIL_KEY`
- `FROM_EMAIL`
- `SUPPORT_EMAIL`
- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`
- Payment provider keys if payment processing is enabled

Client:

- `REACT_APP_BASE_URL`
- `REACT_APP_SOCKET_URL`
- `REACT_APP_PUBLIC_SITE_URL`
- `REACT_APP_SHARE_BASE_URL`
- `REACT_APP_GOOGLE_MAPS_API_KEY`

## Smoke Tests

- Book event as a customer.
- Confirm event/admin details.
- Send invoice/payment request.
- View customer payment summary.
- Record payment and confirm finance totals update.
- Assign bartender.
- Bartender expresses interest, accepts assignment, clocks in, and clocks out.
- Submit support ticket with notes and photos.
- Submit incident report and confirm acknowledgement email.
- Claim reward and review claim details in admin.
- Mark onboarding documents sent/received.
- Restrict booking access and verify Book Event explains the reason.
- Suspend a signed-in user and verify the logout countdown appears.

## Backend Jobs And Emails

- 24-hour customer reminders.
- 24-hour bartender reminders.
- Clock-in reminders.
- Clock-out reminders.
- Incident report confirmation.
- Confirmed event change email to assigned bartenders.
- Invoice/payment emails.
- License expiration reminders.
- Completed event checks.

## UX Review

- No raw enum values in tables or emails.
- Disabled buttons explain why when practical.
- Empty states are clear and helpful.
- Mobile admin tables keep identifier, status, and actions visible.
- Sensitive actions require confirmation.
- Customer-facing payment wording uses `Total`, `Paid`, and `Balance Due`.

## Production Safety

- Rate limits are enabled for auth, password reset, public booking, support, and booking eligibility endpoints.
- CORS origins are explicitly configured for production.
- Health/config endpoint returns expected service readiness.
- Scheduled jobs are only initialized in one backend process.
- Payment, invoice, and sensitive email actions avoid duplicate sends where possible.

# Tipsyverse release checklist

Record each release in a ticket or release note with the commit SHA, operator,
timestamps, evidence links, and rollback image. An unchecked item is a launch
blocker unless the release owner explicitly documents why it does not apply.

## 1. Release candidate

- [ ] Working tree reviewed; no secret, local environment, export, or production
      data is included.
- [ ] Release candidate is an intentional commit, not an uncommitted workspace.
- [ ] GitHub `Release gates` workflow passes for the exact commit.
- [ ] Previous successful frontend deployment and backend image tag are known.
- [ ] Database migrations are backward-compatible or have a tested restore plan.

## 2. Environment isolation

- [ ] Staging and production use different MongoDB databases and credentials.
- [ ] Stripe keys and webhook endpoints are environment-specific.
- [ ] Cloudinary folders/accounts and API keys are environment-specific.
- [ ] Transactional email domains or provider streams are environment-specific.
- [ ] Sentry environments and `APP_RELEASE`/`REACT_APP_RELEASE` are distinct.
- [ ] Access/refresh secrets differ between environments and from each other.
- [ ] Production CORS contains only exact HTTPS frontend origins.
- [ ] `TRUST_PROXY` matches the actual number of trusted proxy hops.

Run:

```sh
cd backend
STAGING_API_URL=https://... \
STAGING_FRONTEND_URL=https://... \
npm run verify:staging
```

## 3. Data recovery

- [ ] `mongodump` and `mongorestore` versions are recorded.
- [ ] A staging backup completes and its manifest checksum verifies.
- [ ] The archive restores into the staging drill database.
- [ ] Post-restore smoke tests confirm users, events, payments, assignments,
      indexes, and representative relationships.
- [ ] Recovery point objective and recovery time are recorded.
- [ ] Backup encryption, off-host replication, retention, and restore access are
      confirmed.

Commands:

```sh
DATABASE_BACKUP_DIR=/absolute/secure/path npm run db:backup
DATABASE_BACKUP_ARCHIVE=/absolute/secure/path/file.archive.gz npm run db:backup:verify
DATABASE_RESTORE_SOURCE=/absolute/secure/path/file.archive.gz \
CONFIRM_RESTORE=true npm run db:restore-drill
```

## 4. Staging flows

- [ ] Registration, activation, login, refresh, logout, password reset.
- [ ] Customer booking, pricing, invoice, payment success/failure, and refund.
- [ ] Duplicate Stripe event and duplicate mutation do not duplicate effects.
- [ ] Bartender interest, assignment, clock-in/out, license, and payout links.
- [ ] Admin authorization and record-level ownership for every role.
- [ ] Upload type/size rejection and temporary-file cleanup.
- [ ] Socket authentication, reconnect, and account suspension.
- [ ] Email provider failure enters the outbox and later retries successfully.
- [ ] Scheduled-job leader hands off after the current leader stops.

## 5. Quality and capacity

- [ ] Playwright desktop Chromium, Android Chrome, and mobile Safari projects pass.
- [ ] Keyboard smoke tests and axe serious/critical checks pass.
- [ ] Lighthouse accessibility and SEO gates pass on the deployed frontend.
- [ ] Slow-network/offline and expired-session behavior is acceptable.
- [ ] k6 staging test passes its 1% error and p95 latency thresholds.
- [ ] Expected peak Socket.IO concurrency has been tested.

Load test:

```sh
cd backend
LOAD_API_URL=https://staging-api.example.com k6 run load/k6-smoke.js
```

Never load-test production without an approved window and owners monitoring it.

## 6. Providers, monitoring, and ownership

- [ ] DNS and HTTPS expiry monitoring are active.
- [ ] SPF, DKIM, and DMARC pass for the transactional sending domain.
- [ ] Stripe webhook failures and unreconciled payments have an alert and owner.
- [ ] Sentry receives frontend/backend staged failures with the release SHA.
- [ ] `/live` and `/ready` are monitored from outside the hosting provider.
- [ ] 5xx rate, readiness, email backlog, and job-leadership alerts reach on-call.
- [ ] Database and application secrets have rotation owners and dates.
- [ ] Customer-support and incident-commander roles are assigned.

## 7. Policy and launch

- [ ] Counsel/qualified reviewer approves privacy, terms, refunds/cancellations,
      contractor/employment language, and data deletion for served jurisdictions.
- [ ] Support can execute account access/export/deletion requests.
- [ ] Incident runbook has been reviewed in a tabletop exercise.
- [ ] Soft-launch audience, duration, success thresholds, and stop conditions are
      recorded.

## 8. Deployment and observation

- [ ] Production backup finishes immediately before deployment.
- [ ] Backend image and frontend artifact match the reviewed commit SHA.
- [ ] Readiness passes before traffic is shifted.
- [ ] Authenticated production smoke test uses a designated test account.
- [ ] Stripe, email, Socket.IO, Sentry, and scheduled jobs are observed.
- [ ] Metrics remain healthy through the soft-launch observation window.
- [ ] Release note and all evidence are stored in the release record.

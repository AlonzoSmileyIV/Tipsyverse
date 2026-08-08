# Backend Operations

Developers should read `ARCHITECTURE.md` and `../client/DEVELOPMENT.md` before
changing request boundaries, authentication, payments, or scheduled jobs.
The container runtime and release process are defined in `DEPLOYMENT.md`.

## Environment

Copy `.env.example` to the environment-specific secret store and provide the
required MongoDB, authentication, email, Cloudinary, and application URL
values.

- `TRUST_PROXY` should be set only when the service runs behind a trusted
  reverse proxy. Use `true` for one proxy hop or an Express-compatible value.
- `JOBS_ENABLED=false` disables cron leadership attempts for API-only
  processes. When enabled, MongoDB lease coordination ensures one instance
  schedules jobs at a time.

## Health checks

- `GET /api/v1/live` verifies that the process is responding.
- `GET /api/v1/ready` returns `200` only while MongoDB is connected.
- `GET /api/v1/health` reports dependency configuration and process uptime.

## Development data

Seed the development database:

```sh
npm run seed
```

Wiping is destructive and is restricted to `NODE_ENV=development`. It also
requires explicit confirmation:

```sh
CONFIRM_WIPE=true npm run wipe:collections
```

Review the selected MongoDB URI before running either command.

## Migrations

Migration utilities live in `scripts/libs/`. Run a migration directly with the
appropriate `NODE_ENV` only after reviewing its scope and taking a database
backup. Migrations are intentionally not invoked during application startup.

## Backups and restore drills

Install MongoDB Database Tools on the operations host. Set
`DATABASE_BACKUP_DIR` to an explicit absolute path and run `npm run db:backup`.
The command writes a compressed archive and a SHA-256 manifest. Verify it with
`DATABASE_BACKUP_ARCHIVE=/absolute/archive npm run db:backup:verify`. Encrypt
and replicate both files outside the application host.

Restore drills are intentionally restricted to staging:

```sh
DATABASE_RESTORE_SOURCE=/absolute/path/to/dump CONFIRM_RESTORE=true npm run db:restore-drill
```

Run a staging smoke test after every restore drill and record the result in the
release log.

## Validation

```sh
npm test
npm run check
```

## Production release gate

Before shifting public traffic:

- run a staging backup and restore drill and record its result;
- when Stripe is enabled, configure its webhook endpoint, replay a signed test
  event, and verify payment and refund reconciliation;
- restrict Cloudinary transformations and Google Maps browser keys in their
  provider consoles;
- set Sentry DSNs and `APP_RELEASE`, then verify a staged frontend and backend
  error arrives with its request/release metadata;
- deploy at least two job-enabled instances and verify lease handoff after
  stopping the current leader;
- test queued email delivery by temporarily causing the provider to reject a
  staging send, then restoring it;
- run authenticated staging smoke tests for every user role;
- deploy a reviewed commit SHA and keep the previous SHA available for rollback.

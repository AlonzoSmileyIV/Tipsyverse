# Backend deployment

The backend ships as a provider-neutral OCI image defined by `Dockerfile`.
Deploy an immutable image built from a reviewed commit SHA; do not copy a local
working tree to a server.

## Runtime contract

- Node.js: 22
- Process: `npm start`
- Default port: `3001` (override with `PORT`)
- Liveness: `GET ${API_URL}/live`
- Readiness: `GET ${API_URL}/ready`
- Shutdown signals: `SIGTERM` and `SIGINT`
- Persistent application filesystem: none
- Required dependency: MongoDB
- Optional providers used by enabled features: Stripe, Resend, Cloudinary,
  Sentry, and Prerender

Uploads are temporary. Do not rely on the container filesystem for durable user
assets or database backups.

## Build and local image verification

From the repository root:

```sh
docker build --tag tipsyverse-backend:local ./backend
docker run --rm --env-file ./backend/.env -p 3001:3001 tipsyverse-backend:local
```

Use development-only credentials for local verification. Never pass a
production `.env` file to a developer workstation.

## Production topology

Run at least two API instances behind an HTTPS load balancer. Sticky sessions
are not required for authenticated HTTP requests, but Socket.IO deployments
using long-polling need provider-supported affinity or a shared adapter. Prefer
WebSocket transport where the hosting platform supports it.

Choose one of these job configurations:

- Enable `JOBS_ENABLED=true` on multiple instances and rely on the MongoDB
  leadership lease; or
- create a dedicated job-enabled service and set `JOBS_ENABLED=false` on API
  instances.

The first option provides automatic leader failover. Alert when no lease renewal
has been observed for longer than the configured lease interval.

## Required production configuration

Populate every value from `.env.example` in the deployment platform's encrypted
secret store. Production additionally requires:

- `NODE_ENV=production`
- HTTPS values for `PUBLIC_APP_URL` and every `CORS_ORIGINS` entry
- the production MongoDB URI in `MONGO_PROD_URI`
- distinct access and refresh secrets of at least 32 characters
- `STRIPE_ENABLED=false` when card processing is disabled; when enabled,
  production Stripe secret and webhook signing keys
- `GOOGLE_MAPS_API_KEY` using a server-restricted Google Maps Platform key with
  the Time Zone API enabled; keep it separate from the browser Places key
- `TRUST_PROXY=1` when exactly one trusted platform proxy terminates HTTPS
- a unique `APP_RELEASE`, normally the deployed Git SHA

Do not reuse MongoDB databases, Stripe keys, Cloudinary folders, email sending
domains, Sentry environments, or token secrets between staging and production.

## Deployment sequence

1. CI passes for the exact commit SHA.
2. Back up the production database and verify the backup command completed.
3. Build and publish the image tagged with the commit SHA.
4. Deploy to staging and run the staging verification suite.
5. Run any reviewed migration as a separate one-off command.
6. Deploy production instances with zero-downtime replacement.
7. Wait for readiness and run authenticated smoke tests.
8. Confirm Socket.IO, enabled payment-provider integrations, email outbox,
   Sentry, and job leadership.
9. Record the release SHA, operator, verification result, and rollback image.

## Rollback

Keep the previous successful image tag. If application checks fail, route
traffic to that image. Database migrations must have a separately reviewed
backward-compatible or restore strategy; rolling back application code does not
automatically reverse data changes.

Do not destroy the failed deployment until logs, request IDs, provider events,
and database state needed for incident analysis are preserved.

# Backend architecture

The backend is an Express 5 API, Socket.IO server, scheduled-job host, and
MongoDB application. Start with `../client/DEVELOPMENT.md` for the full-stack
map and use `OPERATIONS.md` for deployment and recovery procedures.

## Layer responsibilities

```text
server.js
  → routers/libs
  → middleware/libs
  → controllers/libs
  → models/libs and external providers
```

- `server.js` owns process startup, global middleware, route mounting,
  Socket.IO creation, readiness endpoints, and graceful shutdown.
- Routers declare the public HTTP contract and the middleware required by each
  endpoint. They should contain little or no business logic.
- Middleware owns cross-cutting request policies such as authentication,
  authorization, uploads, rate limiting, activity context, and idempotency.
- Controllers coordinate a use case and translate its result into HTTP. Keep
  reusable pure rules and provider-specific details in focused utility/service
  modules.
- Models own persistence structure, schema validation, indexes, and safe query
  defaults.
- Jobs find due work and invoke normal domain operations. Every job initializer
  must return a stop function.

The `index.js` files in controllers, routers, middleware, models, and utilities
are import barrels. Do not place business logic in a barrel.

## Security boundaries

Frontend route guards are not authorization. Protected routers must apply the
appropriate backend middleware:

- `auth` for any authenticated account;
- `authBartender` for bartender-only operations;
- `authEmployee` for employee/admin operations;
- `authManager` for hierarchy-aware management operations.

Controllers must still enforce resource ownership and record-level rules when
roles alone are insufficient.

Access and refresh token secrets are distinct. Refresh identifiers are rotated
and stored only as hashes in `AuthSession`. Never log tokens, passwords,
authorization headers, reset links, provider secrets, or full payment payloads.

## Payments

Server-side calculations are authoritative. Payment completion is reconciled
only from a Stripe event whose signature was verified by the raw-body webhook
route. Stripe and HTTP retries are normal, so payment, refund, and other
side-effecting operations must remain idempotent.

## Background work

`jobs/index.js` is the registry for recurring work. `jobLeadership.js` uses a
MongoDB lease so only one job-enabled process schedules recurring tasks.
API-only instances should set `JOBS_ENABLED=false`.

A job should:

1. query a bounded set of due records;
2. atomically claim or mark work when duplicate processing is harmful;
3. tolerate retry after partial failure;
4. emit useful counts and failures without sensitive data;
5. return a cleanup function from its initializer.

Durable email is written to the email outbox and retried by its scheduled job.

## Error handling and monitoring

Unexpected errors should reach the global error handler with `next(error)`.
The handler hides internal messages in production, attaches the request ID, and
reports server failures to Sentry. Expected domain errors should carry an
appropriate HTTP status and a safe user-facing message.

`/live` answers whether the process is running. `/ready` answers whether it can
serve database-backed traffic. Deployment health checks should use `/ready`.

## Large legacy controllers

`user.ctrl.js`, `event.ctrl.js`, and `drink.ctrl.js` predate the current module
boundaries. Refactor them by use case as they are changed, keeping their router
contract stable. Useful extraction boundaries include:

- authentication, account activation, profile, license, and employee
  administration from the user controller;
- booking, assignment, attendance, lifecycle, and event communication from the
  event controller;
- catalog management, engagement, recommendation, and sharing from the drink
  controller.

Extract pure policy first and add characterization tests before moving database
or provider side effects. Avoid a whole-controller rewrite in a feature pull
request.

## Adding an endpoint

1. Define the endpoint and middleware chain in its domain router.
2. Add or reuse authorization and input validation.
3. Implement one focused controller use case.
4. Add schema/index changes only when required.
5. Define retry and idempotency behavior for mutations.
6. Add success, validation, authentication, authorization, and ownership tests.
7. Update operations documentation for new environment variables or external
   dependencies.

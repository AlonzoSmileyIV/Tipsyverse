# Tipsyverse developer guide

This document is the starting point for developers working on the Tipsyverse
frontend and backend. Read it together with `ARCHITECTURE.md` and
`../backend/OPERATIONS.md`.

## Repository layout

Tipsyverse is split into two sibling Node.js applications:

```text
Tipsyverse/
├── client/                 React/Vite single-page application
│   ├── src/app/            Composition, routing, and global overlays
│   ├── src/features/       Domain state and feature-level orchestration
│   ├── src/screens/        Route entry points
│   ├── src/components/     Reusable UI
│   ├── src/services/       HTTP and Socket.IO clients
│   └── src/utils/          Small stateless helpers
└── backend/                Express/MongoDB API and Socket.IO server
    ├── routers/libs/       Endpoint definitions and middleware chains
    ├── controllers/libs/   Request orchestration and use-case logic
    ├── models/libs/        Mongoose schemas and persistence rules
    ├── middleware/libs/    Cross-cutting request policies
    ├── jobs/libs/          Scheduled background work
    ├── utils/libs/         Shared backend services and helpers
    ├── scripts/libs/       Explicit operational and migration scripts
    └── tests/              Node test-runner suites
```

The `index.js` files under backend layers are import barrels only. Business
logic should remain in the corresponding `libs/` module.

## Request flow

```text
React screen/component
  → Redux async thunk or src/services/api.js
  → Express router
  → authentication/authorization middleware
  → controller
  → Mongoose model / external provider
  → JSON response
  → Redux state and UI
```

Socket.IO uses the same short-lived access token as HTTP. The frontend socket is
created disconnected and is connected only by feature-level lifecycle code.

## Where new code belongs

- Add a route page under `src/screens`; keep reusable behavior out of screens.
- Add domain state, thunks, and hooks under `src/features/<domain>`.
- Add a component under `src/components` only when it is reusable or has no
  clear feature owner.
- Put pure formatting and conversion helpers under `src/utils`.
- Add API endpoints to the domain router, then its controller and model/service.
- Put authentication, authorization, rate limiting, uploads, or idempotency in
  middleware rather than duplicating those checks in controllers.
- Never start migrations or destructive cleanup automatically during server
  startup. Operational scripts require an explicit command and environment.

Large legacy files should become smaller incrementally. When changing one,
extract and test pure business rules first; avoid mixing a broad file move with
new behavior in the same pull request.

## Authentication model

- The access token is short-lived and currently persisted with the logged-in
  user so HTTP and Socket.IO can attach it.
- The refresh token is an `HttpOnly` cookie and is rotated by the backend.
- The backend `AuthSession` record stores a hash of the current refresh-token
  identifier and enforces an absolute session lifetime.
- `src/services/api.js` owns refresh/retry coordination. Feature components
  should not implement their own token refresh.
- Frontend route guards improve navigation, but backend middleware is the
  security boundary. Every protected operation must be authorized server-side.

## Payments and other side effects

- The backend calculates authoritative amounts.
- A verified Stripe webhook is the source of truth for payment completion.
- Retried mutations must use the existing idempotency facilities where
  duplicate work could charge, refund, email, or create multiple records.
- Email delivery that must survive provider outages should go through the
  email-outbox workflow.
- Scheduled jobs run only on the instance holding the MongoDB leadership lease.

## Local setup

Create local environment files from each `.env.example`. Do not commit secrets.

```sh
cd client
npm install
npm start
```

```sh
cd backend
npm install
npm run dev
```

The default frontend and backend ports are `3000` and `3001`. The frontend API
and Socket.IO URLs must match the backend CORS allowlist.

## Required checks

Run these before opening a pull request:

```sh
cd client
npm test
npm run build
```

```sh
cd backend
npm test
npm run check
```

Add or update tests whenever changing authorization, session rules, pricing,
payments, scheduled jobs, HTML rendering, or date/time calculations.

## Commenting conventions

Comments should explain constraints, ownership, security assumptions, or a
surprising decision. Do not narrate syntax. Prefer:

```js
// Stripe may retry this webhook, so reconciliation must remain idempotent.
```

over:

```js
// Call the reconciliation function.
```

Use `TODO(owner/context)` only for concrete follow-up work. Include enough
context that a developer can determine when the TODO is complete.

## Pull-request checklist

- The change has one clear purpose.
- No secret, local `.env`, build artifact, or production data is committed.
- Browser authorization is backed by server-side authorization.
- New mutations define retry/idempotency behavior.
- New queries have appropriate indexes and bounded result sizes.
- User-visible loading, empty, and error states are handled.
- Relevant tests and both application validation commands pass.
- Deployment, migration, rollback, and monitoring impacts are documented.

# Tipsyverse Web Client

React 19 application built with Vite.

New contributors should begin with [DEVELOPMENT.md](./DEVELOPMENT.md), which
maps both applications, explains request and authentication flows, and records
the conventions used when adding code.

## Local development

Copy `.env.example` to `.env.local`, provide development values, then run:

```sh
npm install
npm start
```

The API and Socket.IO origins must match the backend CORS allowlist.

## Validation

```sh
npm test
npm run build
```

Production artifacts are written to `dist/`. `vercel.json` supplies the SPA
fallback and baseline browser security headers for Vercel deployments. Configure
equivalent rewrites and headers when using a different host.

## Production configuration

Set the values documented in `.env.example` in the deployment platform's secret
store. Never commit live keys. The Stripe value is a publishable key; all secret
Stripe operations and amount calculations remain on the backend.

Before launch:

- serve the site and API only over HTTPS;
- restrict the Google Maps browser key by production hostname and API in Google
  Cloud Console;
- when Stripe is enabled, register its production webhook URL and signing secret;
- configure the Sentry DSN and release identifier;
- verify the CSP against the exact API, Socket.IO, Stripe, Maps, and Cloudinary
  production origins;
- test the SPA fallback by directly loading a nested route;
- run login, refresh, logout, booking, card payment, refund, upload, and role
  authorization smoke tests in staging.

## Session model

The access token is short-lived and is used for API and Socket.IO
authentication. The refresh token is never exposed to JavaScript: it is rotated
by the backend in an `HttpOnly`, `Secure` production cookie. Suspended,
terminated, deactivated, and expired sessions are rejected by the backend.

# Frontend architecture

For the full-stack repository map, local setup, authentication flow, and
pull-request checklist, see `DEVELOPMENT.md`.

## Module boundaries

- `src/app`: application composition, routing, and global overlays.
- `src/features`: domain-owned state, hooks, API coordination, and feature UI.
- `src/components`: reusable presentation components with no feature ownership.
- `src/screens`: route entry points. Screens compose features and should not contain
  reusable business logic.
- `src/services`: infrastructure clients such as HTTP and WebSocket transports.
- `src/utils`: small, stateless, domain-neutral helpers.

New domain behavior belongs under its owning `src/features/<feature>` directory.
Shared components must not import screens. Services must not import React
components or Redux slices.

## Application infrastructure

`App.js` is the composition root only. Route definitions live in
`app/routing/AppRoutes.js`, global overlays in `app/AppOverlays.js`, session
orchestration in `features/auth/session`, and realtime notification orchestration
in `features/notifications`.

## Refactoring rules

1. Preserve observable behavior before changing business rules.
2. Extract pure domain logic before extracting UI.
3. Add focused tests for extracted policies.
4. Keep route-level code split with dynamic imports.
5. Avoid adding a second library for an existing concern.

## Known extraction boundaries

Some legacy UI modules are intentionally larger than these conventions allow.
Do not perform a mechanical file split without tests. Extract along these
boundaries as each area is changed:

- `DetailedEventForm`: pricing policy, form state, validation, and individual
  form sections;
- `BartenderScreen`: route/tab composition and domain panels;
- admin modules: table/query state, dialogs, and feature-specific forms;
- event details: payments, attendance, assignments, and reviews.

Pure pricing, authorization, formatting, and date logic should be extracted
before JSX because those policies are easiest to test without rendering a
large screen.

# Tipsyverse

Tipsyverse is a full-stack bartending and cocktail platform with customer event booking, bartender scheduling, admin operations, support tickets, drink catalog management, payments, payouts, rewards, and internal workflow tooling.

## Project Structure

```text
Tipsyverse/
  backend/   Express, MongoDB, Socket.IO, scheduled jobs, email, uploads
  client/    React app for customers, bartenders, and admins
  docs/      Seed/import spreadsheets and image assets
```

## Local Setup

Install dependencies separately for the backend and client.

```bash
cd backend
npm install

cd ../client
npm install
```

Create local environment files from the examples:

```bash
cp backend/.env.example backend/.env
cp client/.env.example client/.env
```

Fill in MongoDB, JWT, Cloudinary, email, and app URL values before starting the app.

## Run Locally

Start the backend:

```bash
cd backend
npm run dev
```

Start the client:

```bash
cd client
npm start
```

Default local URLs:

- Client: `http://localhost:3000`
- Backend API: `http://localhost:3001/api/v1`

## Data Setup

Seed initial development data:

```bash
cd backend
npm run seed
```

Wipe local collections only when intentional:

```bash
cd backend
CONFIRM_WIPE=true npm run wipe:collections
```

## Production Checks

Before deploying, review [docs/deployment-checklist.md](docs/deployment-checklist.md).

Minimum checks:

- Client build passes with `npm run build`.
- Backend syntax checks pass for touched files.
- `.env` files are not committed.
- Production MongoDB, email, Cloudinary, JWT, frontend URL, socket URL, and payment provider settings are configured.
- Scheduled jobs are enabled only once in the production runtime.
- Core flows have been smoke tested.

## Git Notes

The root repository tracks the full app. Generated files and secrets are ignored by `.gitignore`, including `.env`, `node_modules`, and `client/build`.

# Option Routes

Option Routes is a daily NFL puzzle game built with Next.js, React, TypeScript, and Postgres.

Players build a 5-player lineup around:

- a daily time period
- slot-specific player constraints
- a daily link bonus rule

The app calculates fantasy points for the chosen time window, applies the active link multiplier, compares the result to an optimized lineup, and saves submissions to a puzzle-specific leaderboard.

## Stack

- Next.js 16 App Router
- React 19
- TypeScript
- PostgreSQL
- `pg` for database access
- Python ETL scripts for nflverse / `nflreadpy` data loading

## Local Setup

1. Install dependencies:

```powershell
npm.cmd install
```

2. Create a local env file from the example:

```powershell
Copy-Item .env.example .env.local
```

3. Fill in your Postgres connection values in `.env.local`.

4. Start the app:

```powershell
npm.cmd run dev
```

5. Open `http://localhost:3000`.

## Environment Variables

The Next.js app and the ETL scripts support either a single `DATABASE_URL` or split variables:

- `DATABASE_URL`

Or:

- `DB_HOST`
- `DB_PORT`
- `DB_USER`
- `DB_PASSWORD`
- `DB_NAME`

Optional SSL-related values for hosted Postgres:

- `DB_SSL`
- `DB_SSL_REJECT_UNAUTHORIZED`
- `DB_SSL_MODE`
- `DB_CHANNEL_BINDING`

Auth-related values for optional Google profiles:

- `AUTH_SECRET`
- `AUTH_GOOGLE_ID`
- `AUTH_GOOGLE_SECRET`
- `CRON_SECRET`

## Google Sign-In Setup

To enable Google sign-in for tracked profiles:

1. Create an OAuth client in Google Cloud Console.
2. Choose `Web application` as the client type.
3. Add these Authorized JavaScript origins:
   - `http://localhost:3000`
   - your production origin, for example `https://your-app-domain.com`
4. Add these Authorized redirect URIs:
   - `http://localhost:3000/api/auth/callback/google`
   - your production callback, for example `https://your-app-domain.com/api/auth/callback/google`
5. Copy the Google client ID and client secret into `.env.local`:

```powershell
AUTH_GOOGLE_ID=your-google-client-id
AUTH_GOOGLE_SECRET=your-google-client-secret
```

Google requires the redirect URI to match exactly, including scheme, host, path, and trailing slash behavior.

Do not commit real secrets. `.env.local` is already ignored by `.gitignore`.

## Automatic Leaderboard Awards

Top-10 leaderboard badges can be awarded automatically through:

- `/api/cron/award-leaderboard`

The included [vercel.json](./vercel.json) schedules that endpoint daily at `06:05 UTC`, which is safely after midnight in `America/Chicago` year-round and awards the previous Chicago puzzle date.

Set `CRON_SECRET` in Vercel so the cron route only accepts authorized requests.

You can still manually award a finished day with:

```powershell
npm.cmd run award:leaderboard -- --date 2026-03-16
```

## Database / ETL

To create the schema only:

```powershell
py scripts/load_nflverse_to_postgres.py --schema-only
```

To load NFL data:

```powershell
py scripts/load_nflverse_to_postgres.py --start-season 2000 --end-season 2025 --full-refresh
```

To seed puzzle configuration:

```powershell
py scripts/seed_puzzle_config.py
```

To generate sample puzzles:

```powershell
py scripts/generate_sample_puzzles.py
```

More ETL notes live in [NFLREADPY_MIGRATION.md](./NFLREADPY_MIGRATION.md).

## Hosting For Desktop And Mobile

If you want to open the game on your phone or from anywhere outside your laptop, the app and database both need to be reachable off your machine.

Recommended setup:

- app hosting: Vercel
- database hosting: Neon, Supabase Postgres, or Railway Postgres

### Recommended Deployment Flow

1. Push this project to GitHub.
2. Create a hosted Postgres database.
3. Run the schema + data load against that hosted database.
4. Create a Vercel project connected to your GitHub repo.
5. Add the database env vars in Vercel.
6. Deploy.

After that, Vercel gives you a public URL that will work on desktop and mobile browsers.

### Important Secret Hygiene

- Keep real credentials only in `.env.local` or your hosting provider's env var UI.
- Never store the database password in README files, notes, or tracked docs.
- If a password was ever written into a project document before, change that password before going live.

## Notes On Production Builds

This project uses Google fonts through `next/font/google`. A local build can fail in a restricted environment if font downloads are blocked, but normal hosted builds usually work fine as long as the deployment environment has network access during build.

## Commands

```powershell
npm.cmd run dev
npm.cmd run build
npm.cmd run start
npm.cmd run lint
```

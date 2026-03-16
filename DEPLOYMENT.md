# Deployment Guide

This project is ready to deploy as a Next.js app backed by PostgreSQL.

## 1. Rotate Any Old Database Password

If your database password was ever written into a local note, screenshot, or tracked file at any point, change it before going live.

## 2. Push The Code To GitHub

This folder is now initialized as a local Git repository, but it still needs:

- a GitHub repo
- your Git username/email configured locally
- a remote added
- a push

If you already have GitHub Desktop installed, this is the easiest route:

1. Open GitHub Desktop.
2. Add the local repository folder.
3. Publish it to GitHub.

If you prefer command line, use:

```powershell
git config user.name "Your Name"
git config user.email "you@example.com"
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git push -u origin main
```

## 3. Create A Hosted Postgres Database

Recommended providers:

- Neon
- Supabase
- Railway

Create a new Postgres database and note:

- host
- port
- database name
- username
- password

## 4. Load Your Schema And Data Into The Hosted Database

Create a local `.env.local` or temporary shell session that points to the hosted DB, then run:

```powershell
py scripts/load_nflverse_to_postgres.py --schema-only
py scripts/load_nflverse_to_postgres.py --start-season 2000 --end-season 2025 --full-refresh
py scripts/seed_puzzle_config.py
py scripts/generate_sample_puzzles.py
py scripts/backfill_player_headshots.py
```

If you want to preserve any current production puzzle set instead of regenerating sample puzzles, skip the sample generator and create only the puzzle rows you want.

## 5. Deploy To Vercel

1. Go to Vercel.
2. Import the GitHub repo.
3. Add this environment variable:

- `DATABASE_URL`

If you prefer split values instead, you can still use:

- `DB_HOST`
- `DB_PORT`
- `DB_USER`
- `DB_PASSWORD`
- `DB_NAME`

4. Deploy.

## 6. Open The App On Desktop Or Mobile

After deployment, Vercel will give you a public URL. That URL will work on:

- your laptop
- your phone
- any other browser

## Troubleshooting

### Build fails while fetching fonts

This app uses `next/font/google`. In restricted local environments, builds can fail if Google fonts cannot be fetched during build. Hosted builds on Vercel usually work normally.

### App loads but APIs fail

Check:

- Vercel env vars are present
- the hosted DB allows connections
- the schema/data import finished successfully

### Phone can't access localhost

That is expected. `localhost` only works on the machine running the app. To use the game from your phone outside a local development session, deploy the app and host the database remotely.

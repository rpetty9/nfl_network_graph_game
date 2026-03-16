# NFLreadpy Migration Notes

This project can use `nflreadpy` as the raw NFL data source while still keeping Postgres as the app-ready serving layer.

## What This ETL Covers

The new loader is designed to populate the core tables your current API routes already use:

- `season_dim`
- `team_dim`
- `player_dim`
- `player_team_history`
- `player_season_stats`
- `player_pair_relationships`
- `filter_definition`
- `multiplier_definition`
- `stat_definition`
- `daily_puzzle`
- `daily_puzzle_stat_pool`

That means the app can keep querying Postgres the same way it does today, but the football data can be refreshed from nflverse-backed data instead of being entered manually.

## What Still Stays Custom

These parts are still product logic and should stay in your own database:

- future `relationship_rule` / puzzle-of-the-day configuration

## What Is Derived

The ETL currently derives:

- player career start / end seasons
- player-team-season history
- season stat totals for passing / rushing / receiving / receptions
- pair flags for:
  - same franchise
  - same college
  - same draft class

Your API already computes `were_teammates_flag` dynamically from `player_team_history`, so that part is still supported by the imported data.

## Install

```powershell
py -m pip install -r requirements-etl.txt
```

## Run The Schema Only

```powershell
py scripts/load_nflverse_to_postgres.py --schema-only
```

## Run The Import For 2000-2025

```powershell
py scripts/load_nflverse_to_postgres.py --start-season 2000 --end-season 2025
```

## Seed Puzzle Config

This inserts reusable themes, eligibility filters, multipliers, and stat definitions:

```powershell
py scripts/seed_puzzle_config.py
```

## Create A Daily Puzzle

Example for a published puzzle using your current data model:

```powershell
py scripts/create_daily_puzzle.py `
  --puzzle-date 2026-03-15 `
  --title "Career Legends" `
  --theme all_career_seasons `
  --eligibility played_for_4_plus_teams `
  --multiplier teammates_bonus_5 `
  --stats fantasy_points_ppr passing_yards rushing_yards receiving_yards `
  --unpublish-others
```

After that, your existing `/api/puzzle` and `/api/players` routes should have everything they need.

## Optional Flags

Skip the pair rebuild if you only want the raw/core tables refreshed first:

```powershell
py scripts/load_nflverse_to_postgres.py --start-season 2000 --end-season 2025 --skip-pairs
```

Replace the sample football-data tables entirely before reloading:

```powershell
py scripts/load_nflverse_to_postgres.py --start-season 2000 --end-season 2025 --full-refresh
```

`--full-refresh` only resets the imported NFL data tables:

- `season_dim`
- `team_dim`
- `player_dim`
- `player_team_history`
- `player_season_stats`
- `player_pair_relationships`

It does not clear your puzzle/config tables.

## Environment Variables

The script uses the same database variables as the Next app:

- `DB_HOST`
- `DB_PORT`
- `DB_USER`
- `DB_PASSWORD`
- `DB_NAME`

It will also read `.env.local` if those values are defined there.

## Important Notes

- This is a first-pass ETL. The exact field names returned by `nflreadpy` may vary a bit by version, so you may need a small follow-up adjustment after the first real run.
- The loader creates both the football-data tables and the puzzle tables, but the daily puzzle content itself is still chosen by your seed/create scripts.
- Historical franchise aliases like `OAK`, `SD`, `STL`, and `WSH` are mapped back to modern franchise groupings when rebuilding `same_franchise_flag`.

ALTER TABLE daily_puzzle
  ADD COLUMN IF NOT EXISTS qb_exclusion_enabled BOOLEAN NOT NULL DEFAULT false;

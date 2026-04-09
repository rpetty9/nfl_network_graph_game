ALTER TABLE daily_puzzle
  ADD COLUMN IF NOT EXISTS rb_exclusion_enabled BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE daily_puzzle
  ADD COLUMN IF NOT EXISTS wr_exclusion_enabled BOOLEAN NOT NULL DEFAULT false;

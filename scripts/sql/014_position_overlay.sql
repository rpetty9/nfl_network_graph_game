ALTER TABLE daily_puzzle
  ADD COLUMN IF NOT EXISTS position_overlay_enabled BOOLEAN NOT NULL DEFAULT false;

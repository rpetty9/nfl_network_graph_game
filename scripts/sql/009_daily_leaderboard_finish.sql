CREATE TABLE IF NOT EXISTS daily_leaderboard_finish (
  puzzle_id BIGINT NOT NULL REFERENCES daily_puzzle(puzzle_id) ON DELETE CASCADE,
  user_id BIGINT NOT NULL REFERENCES app_user(user_id) ON DELETE CASCADE,
  placement INTEGER NOT NULL,
  awarded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (puzzle_id, user_id),
  CHECK (placement BETWEEN 1 AND 10)
);

CREATE INDEX IF NOT EXISTS idx_daily_leaderboard_finish_user
  ON daily_leaderboard_finish (user_id, awarded_at DESC);

CREATE TABLE IF NOT EXISTS player_college_history (
  player_college_history_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  player_id BIGINT NOT NULL REFERENCES player_dim(player_id) ON DELETE CASCADE,
  college_name TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 1,
  UNIQUE (player_id, college_name),
  UNIQUE (player_id, display_order)
);

CREATE INDEX IF NOT EXISTS idx_player_college_history_player
  ON player_college_history (player_id, display_order);

CREATE INDEX IF NOT EXISTS idx_player_college_history_college
  ON player_college_history (college_name);

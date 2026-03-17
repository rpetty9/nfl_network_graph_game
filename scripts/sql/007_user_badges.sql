CREATE TABLE IF NOT EXISTS user_badge (
  user_id BIGINT NOT NULL REFERENCES app_user(user_id) ON DELETE CASCADE,
  badge_key TEXT NOT NULL,
  awarded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  awarded_by_user_id BIGINT REFERENCES app_user(user_id) ON DELETE SET NULL,
  award_note TEXT,
  PRIMARY KEY (user_id, badge_key)
);

CREATE INDEX IF NOT EXISTS idx_user_badge_awarded_at
  ON user_badge (awarded_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_badge_badge_key
  ON user_badge (badge_key);

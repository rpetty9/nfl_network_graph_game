CREATE TABLE IF NOT EXISTS app_user (
  user_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  google_subject TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL,
  email_normalized TEXT NOT NULL,
  username TEXT,
  username_normalized TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (status IN ('active', 'flagged', 'banned'))
);

ALTER TABLE puzzle_submission
  ADD COLUMN IF NOT EXISTS user_id BIGINT REFERENCES app_user(user_id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_app_user_email_normalized
  ON app_user (email_normalized);

CREATE UNIQUE INDEX IF NOT EXISTS idx_app_user_username_normalized
  ON app_user (username_normalized)
  WHERE username_normalized IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_puzzle_submission_puzzle_user
  ON puzzle_submission (puzzle_id, user_id)
  WHERE user_id IS NOT NULL;

ALTER TABLE puzzle_submission
  ADD COLUMN IF NOT EXISTS client_token TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_puzzle_submission_puzzle_client
  ON puzzle_submission (puzzle_id, client_token)
  WHERE client_token IS NOT NULL;

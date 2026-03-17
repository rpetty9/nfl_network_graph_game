CREATE TABLE IF NOT EXISTS user_friend_request (
  request_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  requester_user_id BIGINT NOT NULL REFERENCES app_user(user_id) ON DELETE CASCADE,
  addressee_user_id BIGINT NOT NULL REFERENCES app_user(user_id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  responded_at TIMESTAMPTZ,
  CHECK (requester_user_id <> addressee_user_id),
  CHECK (status IN ('pending', 'accepted', 'declined')),
  UNIQUE (requester_user_id, addressee_user_id)
);

CREATE INDEX IF NOT EXISTS idx_user_friend_request_addressee_status
  ON user_friend_request (addressee_user_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_friend_request_requester_status
  ON user_friend_request (requester_user_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS filter_definition (
  filter_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  filter_name TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  filter_category TEXT NOT NULL,
  rule_logic_key TEXT NOT NULL UNIQUE,
  active_flag BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS multiplier_definition (
  multiplier_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  multiplier_name TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  multiplier_type TEXT,
  rule_logic_key TEXT,
  base_value NUMERIC(10,4) NOT NULL DEFAULT 1.0,
  increment_value NUMERIC(10,4) NOT NULL DEFAULT 0.0,
  bonus_pct NUMERIC(6,2) GENERATED ALWAYS AS (increment_value * 100.0) STORED,
  active_flag BOOLEAN NOT NULL DEFAULT true
);

ALTER TABLE multiplier_definition
  ADD COLUMN IF NOT EXISTS multiplier_type TEXT;

ALTER TABLE multiplier_definition
  ADD COLUMN IF NOT EXISTS rule_logic_key TEXT;

ALTER TABLE multiplier_definition
  ADD COLUMN IF NOT EXISTS base_value NUMERIC(10,4) NOT NULL DEFAULT 1.0;

ALTER TABLE multiplier_definition
  ADD COLUMN IF NOT EXISTS increment_value NUMERIC(10,4) NOT NULL DEFAULT 0.0;

ALTER TABLE multiplier_definition
  ADD COLUMN IF NOT EXISTS active_flag BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS relationship_rule_definition (
  relationship_rule_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  relationship_name TEXT NOT NULL UNIQUE,
  relationship_type TEXT NOT NULL UNIQUE,
  display_text TEXT NOT NULL,
  bonus_pct NUMERIC(6,2) NOT NULL DEFAULT 0,
  active_flag BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS slot_rule_definition (
  slot_rule_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  rule_name TEXT NOT NULL UNIQUE,
  parameter_type TEXT NOT NULL,
  parameter_value TEXT,
  display_text TEXT NOT NULL,
  active_flag BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS stat_definition (
  stat_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  stat_name TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  stat_category TEXT,
  source_column TEXT,
  allowed_position_group TEXT,
  higher_is_better_flag BOOLEAN NOT NULL DEFAULT true,
  decimal_places INTEGER NOT NULL DEFAULT 0,
  active_flag BOOLEAN NOT NULL DEFAULT true
);

ALTER TABLE stat_definition
  ADD COLUMN IF NOT EXISTS allowed_position_group TEXT;

ALTER TABLE stat_definition
  ADD COLUMN IF NOT EXISTS higher_is_better_flag BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE stat_definition
  ADD COLUMN IF NOT EXISTS decimal_places INTEGER NOT NULL DEFAULT 0;

ALTER TABLE stat_definition
  ADD COLUMN IF NOT EXISTS active_flag BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS daily_puzzle (
  puzzle_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  puzzle_date DATE NOT NULL,
  sport TEXT NOT NULL DEFAULT 'nfl',
  title TEXT NOT NULL,
  filter_id BIGINT REFERENCES filter_definition(filter_id),
  theme_filter_id BIGINT NOT NULL REFERENCES filter_definition(filter_id),
  eligibility_filter_id BIGINT NOT NULL REFERENCES filter_definition(filter_id),
  relationship_rule_id BIGINT REFERENCES relationship_rule_definition(relationship_rule_id),
  multiplier_id BIGINT NOT NULL REFERENCES multiplier_definition(multiplier_id),
  stat_pool_size INTEGER NOT NULL DEFAULT 4,
  selection_count INTEGER NOT NULL DEFAULT 5,
  published_flag BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (puzzle_date, sport)
);

ALTER TABLE daily_puzzle
  ADD COLUMN IF NOT EXISTS sport TEXT NOT NULL DEFAULT 'nfl';

ALTER TABLE daily_puzzle
  ADD COLUMN IF NOT EXISTS filter_id BIGINT;

ALTER TABLE daily_puzzle
  ADD COLUMN IF NOT EXISTS stat_pool_size INTEGER NOT NULL DEFAULT 4;

ALTER TABLE daily_puzzle
  ADD COLUMN IF NOT EXISTS selection_count INTEGER NOT NULL DEFAULT 5;

DO $$
BEGIN
  ALTER TABLE daily_puzzle
    ADD CONSTRAINT fk_daily_puzzle_filter
    FOREIGN KEY (filter_id)
    REFERENCES filter_definition(filter_id);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS daily_puzzle_stat_pool (
  puzzle_stat_pool_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  puzzle_id BIGINT NOT NULL REFERENCES daily_puzzle(puzzle_id) ON DELETE CASCADE,
  stat_id BIGINT NOT NULL REFERENCES stat_definition(stat_id),
  display_order INTEGER NOT NULL,
  UNIQUE (puzzle_id, stat_id),
  UNIQUE (puzzle_id, display_order)
);

CREATE TABLE IF NOT EXISTS daily_puzzle_slot_rule (
  puzzle_slot_rule_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  puzzle_id BIGINT NOT NULL REFERENCES daily_puzzle(puzzle_id) ON DELETE CASCADE,
  slot_number INTEGER NOT NULL,
  slot_rule_id BIGINT NOT NULL REFERENCES slot_rule_definition(slot_rule_id),
  UNIQUE (puzzle_id, slot_number),
  CHECK (slot_number BETWEEN 1 AND 5)
);

CREATE TABLE IF NOT EXISTS app_user (
  user_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  google_subject TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL,
  email_normalized TEXT NOT NULL,
  username TEXT,
  username_normalized TEXT,
  avatar_style TEXT NOT NULL DEFAULT 'helmet',
  avatar_bg TEXT NOT NULL DEFAULT 'sky',
  avatar_accent TEXT NOT NULL DEFAULT 'amber',
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (status IN ('active', 'flagged', 'banned')),
  CHECK (avatar_style IN ('helmet', 'star', 'bolt', 'crest', 'crown', 'diamond', 'comet', 'target')),
  CHECK (avatar_bg IN ('sky', 'emerald', 'amber', 'rose', 'slate', 'violet')),
  CHECK (avatar_accent IN ('sky', 'emerald', 'amber', 'rose', 'slate', 'violet'))
);

ALTER TABLE app_user
  ADD COLUMN IF NOT EXISTS avatar_style TEXT NOT NULL DEFAULT 'helmet';

ALTER TABLE app_user
  ADD COLUMN IF NOT EXISTS avatar_bg TEXT NOT NULL DEFAULT 'sky';

ALTER TABLE app_user
  ADD COLUMN IF NOT EXISTS avatar_accent TEXT NOT NULL DEFAULT 'amber';

ALTER TABLE app_user
  ADD COLUMN IF NOT EXISTS featured_badges TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

CREATE TABLE IF NOT EXISTS user_badge (
  user_id BIGINT NOT NULL REFERENCES app_user(user_id) ON DELETE CASCADE,
  badge_key TEXT NOT NULL,
  awarded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  awarded_by_user_id BIGINT REFERENCES app_user(user_id) ON DELETE SET NULL,
  award_note TEXT,
  PRIMARY KEY (user_id, badge_key)
);

CREATE TABLE IF NOT EXISTS daily_leaderboard_finish (
  puzzle_id BIGINT NOT NULL REFERENCES daily_puzzle(puzzle_id) ON DELETE CASCADE,
  user_id BIGINT NOT NULL REFERENCES app_user(user_id) ON DELETE CASCADE,
  placement INTEGER NOT NULL,
  awarded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (puzzle_id, user_id),
  CHECK (placement BETWEEN 1 AND 10)
);

CREATE TABLE IF NOT EXISTS puzzle_submission (
  submission_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  puzzle_id BIGINT NOT NULL REFERENCES daily_puzzle(puzzle_id) ON DELETE CASCADE,
  user_id BIGINT REFERENCES app_user(user_id) ON DELETE SET NULL,
  client_token TEXT,
  display_name TEXT NOT NULL,
  base_score NUMERIC(12,2) NOT NULL,
  active_links INTEGER NOT NULL,
  multiplier NUMERIC(8,4) NOT NULL,
  final_score NUMERIC(12,2) NOT NULL,
  optimal_final_score NUMERIC(12,2),
  percent_of_optimal NUMERIC(8,2),
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE puzzle_submission
  ADD COLUMN IF NOT EXISTS user_id BIGINT REFERENCES app_user(user_id) ON DELETE SET NULL;

ALTER TABLE puzzle_submission
  ADD COLUMN IF NOT EXISTS client_token TEXT;

CREATE TABLE IF NOT EXISTS puzzle_submission_player (
  submission_player_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  submission_id BIGINT NOT NULL REFERENCES puzzle_submission(submission_id) ON DELETE CASCADE,
  slot_number INTEGER NOT NULL,
  player_id BIGINT NOT NULL REFERENCES player_dim(player_id),
  fantasy_points NUMERIC(12,2) NOT NULL,
  UNIQUE (submission_id, slot_number),
  CHECK (slot_number BETWEEN 1 AND 5)
);

CREATE TABLE IF NOT EXISTS optimal_lineup_cache (
  puzzle_id BIGINT PRIMARY KEY REFERENCES daily_puzzle(puzzle_id) ON DELETE CASCADE,
  config_signature TEXT NOT NULL,
  payload JSONB NOT NULL,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_filter_definition_category
  ON filter_definition (filter_category);

CREATE UNIQUE INDEX IF NOT EXISTS idx_daily_puzzle_date_sport
  ON daily_puzzle (puzzle_date, sport);

CREATE INDEX IF NOT EXISTS idx_daily_puzzle_published_date
  ON daily_puzzle (published_flag, puzzle_date DESC);

CREATE INDEX IF NOT EXISTS idx_daily_puzzle_stat_pool_puzzle
  ON daily_puzzle_stat_pool (puzzle_id, display_order);

CREATE INDEX IF NOT EXISTS idx_slot_rule_definition_type
  ON slot_rule_definition (parameter_type, parameter_value);

CREATE INDEX IF NOT EXISTS idx_daily_puzzle_slot_rule_puzzle
  ON daily_puzzle_slot_rule (puzzle_id, slot_number);

CREATE INDEX IF NOT EXISTS idx_puzzle_submission_puzzle_score
  ON puzzle_submission (puzzle_id, final_score DESC, submitted_at ASC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_app_user_email_normalized
  ON app_user (email_normalized);

CREATE UNIQUE INDEX IF NOT EXISTS idx_app_user_username_normalized
  ON app_user (username_normalized)
  WHERE username_normalized IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_puzzle_submission_puzzle_client
  ON puzzle_submission (puzzle_id, client_token)
  WHERE client_token IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_puzzle_submission_puzzle_user
  ON puzzle_submission (puzzle_id, user_id)
  WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_user_badge_awarded_at
  ON user_badge (awarded_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_badge_badge_key
  ON user_badge (badge_key);

CREATE INDEX IF NOT EXISTS idx_daily_leaderboard_finish_user
  ON daily_leaderboard_finish (user_id, awarded_at DESC);

CREATE INDEX IF NOT EXISTS idx_puzzle_submission_player_submission
  ON puzzle_submission_player (submission_id, slot_number);

CREATE INDEX IF NOT EXISTS idx_optimal_lineup_cache_signature
  ON optimal_lineup_cache (config_signature);

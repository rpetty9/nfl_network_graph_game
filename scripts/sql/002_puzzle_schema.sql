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
  bonus_pct NUMERIC(6,2) NOT NULL DEFAULT 0
);

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
  source_column TEXT
);

CREATE TABLE IF NOT EXISTS daily_puzzle (
  puzzle_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  puzzle_date DATE NOT NULL UNIQUE,
  title TEXT NOT NULL,
  theme_filter_id BIGINT NOT NULL REFERENCES filter_definition(filter_id),
  eligibility_filter_id BIGINT NOT NULL REFERENCES filter_definition(filter_id),
  relationship_rule_id BIGINT REFERENCES relationship_rule_definition(relationship_rule_id),
  multiplier_id BIGINT NOT NULL REFERENCES multiplier_definition(multiplier_id),
  published_flag BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE daily_puzzle
  ADD COLUMN IF NOT EXISTS relationship_rule_id BIGINT;

DO $$
BEGIN
  ALTER TABLE daily_puzzle
    ADD CONSTRAINT fk_daily_puzzle_relationship_rule
    FOREIGN KEY (relationship_rule_id)
    REFERENCES relationship_rule_definition(relationship_rule_id);
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

CREATE TABLE IF NOT EXISTS puzzle_submission (
  submission_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  puzzle_id BIGINT NOT NULL REFERENCES daily_puzzle(puzzle_id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  base_score NUMERIC(12,2) NOT NULL,
  active_links INTEGER NOT NULL,
  multiplier NUMERIC(8,4) NOT NULL,
  final_score NUMERIC(12,2) NOT NULL,
  optimal_final_score NUMERIC(12,2),
  percent_of_optimal NUMERIC(8,2),
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS puzzle_submission_player (
  submission_player_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  submission_id BIGINT NOT NULL REFERENCES puzzle_submission(submission_id) ON DELETE CASCADE,
  slot_number INTEGER NOT NULL,
  player_id BIGINT NOT NULL REFERENCES player_dim(player_id),
  fantasy_points NUMERIC(12,2) NOT NULL,
  UNIQUE (submission_id, slot_number),
  CHECK (slot_number BETWEEN 1 AND 5)
);

CREATE INDEX IF NOT EXISTS idx_filter_definition_category
  ON filter_definition (filter_category);

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

CREATE INDEX IF NOT EXISTS idx_puzzle_submission_player_submission
  ON puzzle_submission_player (submission_id, slot_number);

CREATE TABLE IF NOT EXISTS season_dim (
  season INTEGER PRIMARY KEY,
  season_label TEXT NOT NULL
);

ALTER TABLE season_dim
  ADD COLUMN IF NOT EXISTS season_label TEXT;

CREATE TABLE IF NOT EXISTS team_dim (
  team_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  external_team_id TEXT,
  team_abbr TEXT NOT NULL UNIQUE,
  team_name TEXT,
  nickname TEXT,
  city TEXT,
  conference TEXT,
  division TEXT
);

ALTER TABLE team_dim
  ADD COLUMN IF NOT EXISTS external_team_id TEXT;

CREATE TABLE IF NOT EXISTS player_dim (
  player_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  external_player_id TEXT UNIQUE,
  player_name TEXT NOT NULL,
  primary_position TEXT,
  college_name TEXT,
  draft_round INTEGER,
  draft_year INTEGER,
  birth_date DATE,
  career_start_season INTEGER,
  career_end_season INTEGER
);

ALTER TABLE player_dim
  ADD COLUMN IF NOT EXISTS external_player_id TEXT;

ALTER TABLE player_dim
  ADD COLUMN IF NOT EXISTS college_name TEXT;

CREATE TABLE IF NOT EXISTS player_team_history (
  player_team_history_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  player_id BIGINT NOT NULL REFERENCES player_dim(player_id) ON DELETE CASCADE,
  season INTEGER NOT NULL REFERENCES season_dim(season) ON DELETE CASCADE,
  team_id BIGINT NOT NULL REFERENCES team_dim(team_id) ON DELETE CASCADE,
  franchise_id BIGINT REFERENCES team_dim(team_id) ON DELETE SET NULL,
  position TEXT,
  jersey_number TEXT,
  age_that_season NUMERIC(5,2),
  UNIQUE (player_id, season, team_id)
);

CREATE TABLE IF NOT EXISTS player_season_stats (
  player_season_stats_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  player_id BIGINT NOT NULL REFERENCES player_dim(player_id) ON DELETE CASCADE,
  season INTEGER NOT NULL REFERENCES season_dim(season) ON DELETE CASCADE,
  team_id BIGINT REFERENCES team_dim(team_id) ON DELETE SET NULL,
  games INTEGER,
  passing_yards NUMERIC(12,2),
  passing_td NUMERIC(12,2),
  rushing_yards NUMERIC(12,2),
  rushing_td NUMERIC(12,2),
  receiving_yards NUMERIC(12,2),
  receiving_td NUMERIC(12,2),
  receptions NUMERIC(12,2),
  fantasy_points_ppr NUMERIC(12,2),
  UNIQUE (player_id, season, team_id)
);

ALTER TABLE player_season_stats
  ADD COLUMN IF NOT EXISTS fantasy_points_ppr NUMERIC(12,2);

CREATE TABLE IF NOT EXISTS player_pair_relationships (
  relationship_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  player_id_1 BIGINT NOT NULL REFERENCES player_dim(player_id) ON DELETE CASCADE,
  player_id_2 BIGINT NOT NULL REFERENCES player_dim(player_id) ON DELETE CASCADE,
  same_franchise_flag BOOLEAN NOT NULL DEFAULT false,
  same_college_flag BOOLEAN NOT NULL DEFAULT false,
  same_draft_class_flag BOOLEAN NOT NULL DEFAULT false,
  UNIQUE (player_id_1, player_id_2),
  CHECK (player_id_1 < player_id_2)
);

CREATE INDEX IF NOT EXISTS idx_player_dim_name
  ON player_dim (player_name);

CREATE UNIQUE INDEX IF NOT EXISTS idx_player_dim_external_player_id
  ON player_dim (external_player_id)
  WHERE external_player_id IS NOT NULL;

DO $$
BEGIN
  ALTER TABLE player_dim
    ADD CONSTRAINT uq_player_dim_external_player_id UNIQUE (external_player_id);
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN duplicate_table THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_player_team_history_player_season
  ON player_team_history (player_id, season);

CREATE INDEX IF NOT EXISTS idx_player_team_history_team_season
  ON player_team_history (team_id, season);

CREATE INDEX IF NOT EXISTS idx_player_season_stats_player_season
  ON player_season_stats (player_id, season);

CREATE INDEX IF NOT EXISTS idx_player_pair_relationships_p1
  ON player_pair_relationships (player_id_1);

CREATE INDEX IF NOT EXISTS idx_player_pair_relationships_p2
  ON player_pair_relationships (player_id_2);

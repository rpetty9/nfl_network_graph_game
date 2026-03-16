CREATE TABLE IF NOT EXISTS season_dim (
  season INTEGER PRIMARY KEY,
  season_start_date DATE,
  era_label TEXT,
  season_label TEXT NOT NULL
);

ALTER TABLE season_dim
  ADD COLUMN IF NOT EXISTS season_start_date DATE;

ALTER TABLE season_dim
  ADD COLUMN IF NOT EXISTS era_label TEXT;

ALTER TABLE season_dim
  ADD COLUMN IF NOT EXISTS season_label TEXT;

CREATE TABLE IF NOT EXISTS franchise_dim (
  franchise_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  current_team_name TEXT NOT NULL UNIQUE,
  current_team_abbr TEXT,
  conference TEXT,
  division TEXT
);

CREATE TABLE IF NOT EXISTS team_dim (
  team_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  franchise_id BIGINT REFERENCES franchise_dim(franchise_id) ON DELETE SET NULL,
  external_team_id TEXT,
  team_abbr TEXT NOT NULL UNIQUE,
  team_name TEXT,
  nickname TEXT,
  city TEXT,
  conference TEXT,
  division TEXT
);

ALTER TABLE team_dim
  ADD COLUMN IF NOT EXISTS franchise_id BIGINT;

ALTER TABLE team_dim
  ADD COLUMN IF NOT EXISTS external_team_id TEXT;

DO $$
BEGIN
  ALTER TABLE team_dim
    ADD CONSTRAINT fk_team_dim_franchise
    FOREIGN KEY (franchise_id)
    REFERENCES franchise_dim(franchise_id)
    ON DELETE SET NULL;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS player_dim (
  player_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  external_player_id TEXT UNIQUE,
  player_name TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  primary_position TEXT,
  college_name TEXT,
  draft_round INTEGER,
  draft_year INTEGER,
  birth_date DATE,
  birth_year INTEGER,
  career_start_season INTEGER,
  career_end_season INTEGER,
  undrafted_flag BOOLEAN NOT NULL DEFAULT false,
  headshot_url TEXT
);

ALTER TABLE player_dim
  ADD COLUMN IF NOT EXISTS external_player_id TEXT;

ALTER TABLE player_dim
  ADD COLUMN IF NOT EXISTS first_name TEXT;

ALTER TABLE player_dim
  ADD COLUMN IF NOT EXISTS last_name TEXT;

ALTER TABLE player_dim
  ADD COLUMN IF NOT EXISTS college_name TEXT;

ALTER TABLE player_dim
  ADD COLUMN IF NOT EXISTS birth_year INTEGER;

ALTER TABLE player_dim
  ADD COLUMN IF NOT EXISTS undrafted_flag BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE player_dim
  ADD COLUMN IF NOT EXISTS headshot_url TEXT;

CREATE TABLE IF NOT EXISTS player_team_history (
  player_team_history_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  player_id BIGINT NOT NULL REFERENCES player_dim(player_id) ON DELETE CASCADE,
  season INTEGER NOT NULL REFERENCES season_dim(season) ON DELETE CASCADE,
  team_id BIGINT NOT NULL REFERENCES team_dim(team_id) ON DELETE CASCADE,
  franchise_id BIGINT REFERENCES franchise_dim(franchise_id) ON DELETE SET NULL,
  position TEXT,
  raw_position TEXT,
  normalized_position TEXT,
  position_group TEXT,
  jersey_number TEXT,
  games_played INTEGER,
  games_started INTEGER,
  active_roster_flag BOOLEAN NOT NULL DEFAULT false,
  playoff_roster_flag BOOLEAN NOT NULL DEFAULT false,
  rookie_season_flag BOOLEAN NOT NULL DEFAULT false,
  years_in_league INTEGER,
  age_that_season NUMERIC(5,2),
  UNIQUE (player_id, season, team_id)
);

ALTER TABLE player_team_history
  ADD COLUMN IF NOT EXISTS raw_position TEXT;

ALTER TABLE player_team_history
  ADD COLUMN IF NOT EXISTS normalized_position TEXT;

ALTER TABLE player_team_history
  ADD COLUMN IF NOT EXISTS position_group TEXT;

ALTER TABLE player_team_history
  ADD COLUMN IF NOT EXISTS games_played INTEGER;

ALTER TABLE player_team_history
  ADD COLUMN IF NOT EXISTS games_started INTEGER;

ALTER TABLE player_team_history
  ADD COLUMN IF NOT EXISTS active_roster_flag BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE player_team_history
  ADD COLUMN IF NOT EXISTS playoff_roster_flag BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE player_team_history
  ADD COLUMN IF NOT EXISTS rookie_season_flag BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE player_team_history
  ADD COLUMN IF NOT EXISTS years_in_league INTEGER;

CREATE TABLE IF NOT EXISTS player_season_stats (
  player_season_stats_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  player_id BIGINT NOT NULL REFERENCES player_dim(player_id) ON DELETE CASCADE,
  season INTEGER NOT NULL REFERENCES season_dim(season) ON DELETE CASCADE,
  team_id BIGINT REFERENCES team_dim(team_id) ON DELETE SET NULL,
  stat_scope TEXT NOT NULL DEFAULT 'REGULAR',
  games INTEGER,
  games_played INTEGER,
  passing_yards NUMERIC(12,2),
  passing_td NUMERIC(12,2),
  rushing_yards NUMERIC(12,2),
  rushing_td NUMERIC(12,2),
  receiving_yards NUMERIC(12,2),
  receiving_td NUMERIC(12,2),
  receptions NUMERIC(12,2),
  fantasy_points_ppr NUMERIC(12,2),
  UNIQUE (player_id, season, team_id, stat_scope)
);

ALTER TABLE player_season_stats
  ADD COLUMN IF NOT EXISTS stat_scope TEXT NOT NULL DEFAULT 'REGULAR';

ALTER TABLE player_season_stats
  ADD COLUMN IF NOT EXISTS games_played INTEGER;

ALTER TABLE player_season_stats
  ADD COLUMN IF NOT EXISTS fantasy_points_ppr NUMERIC(12,2);

CREATE TABLE IF NOT EXISTS player_pair_relationships (
  relationship_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  player_id_1 BIGINT NOT NULL REFERENCES player_dim(player_id) ON DELETE CASCADE,
  player_id_2 BIGINT NOT NULL REFERENCES player_dim(player_id) ON DELETE CASCADE,
  were_teammates_flag BOOLEAN NOT NULL DEFAULT false,
  teammate_seasons_count INTEGER NOT NULL DEFAULT 0,
  same_franchise_flag BOOLEAN NOT NULL DEFAULT false,
  shared_team_count INTEGER NOT NULL DEFAULT 0,
  same_college_flag BOOLEAN NOT NULL DEFAULT false,
  same_draft_class_flag BOOLEAN NOT NULL DEFAULT false,
  UNIQUE (player_id_1, player_id_2),
  CHECK (player_id_1 < player_id_2)
);

ALTER TABLE player_pair_relationships
  ADD COLUMN IF NOT EXISTS were_teammates_flag BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE player_pair_relationships
  ADD COLUMN IF NOT EXISTS teammate_seasons_count INTEGER NOT NULL DEFAULT 0;

ALTER TABLE player_pair_relationships
  ADD COLUMN IF NOT EXISTS shared_team_count INTEGER NOT NULL DEFAULT 0;

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

CREATE INDEX IF NOT EXISTS idx_team_dim_team_abbr
  ON team_dim (team_abbr);

CREATE INDEX IF NOT EXISTS idx_player_team_history_player_season
  ON player_team_history (player_id, season);

CREATE INDEX IF NOT EXISTS idx_player_team_history_team_season
  ON player_team_history (team_id, season);

CREATE INDEX IF NOT EXISTS idx_player_team_history_franchise
  ON player_team_history (franchise_id, season);

CREATE INDEX IF NOT EXISTS idx_player_season_stats_player_season
  ON player_season_stats (player_id, season);

CREATE INDEX IF NOT EXISTS idx_player_pair_relationships_p1
  ON player_pair_relationships (player_id_1);

CREATE INDEX IF NOT EXISTS idx_player_pair_relationships_p2
  ON player_pair_relationships (player_id_2);

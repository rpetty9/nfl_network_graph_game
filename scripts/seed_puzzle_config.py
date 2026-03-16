from __future__ import annotations

import os
from pathlib import Path

import psycopg


ROOT = Path(__file__).resolve().parents[1]
ENV_FILE = ROOT / ".env.local"

FILTERS = [
    {
        "filter_name": "seasons_2000_2005",
        "display_name": "2000-2005 Seasons",
        "filter_category": "theme",
        "rule_logic_key": "season_range:2000-2005",
    },
    {
        "filter_name": "seasons_2005_2010",
        "display_name": "2005-2010 Seasons",
        "filter_category": "theme",
        "rule_logic_key": "season_range:2005-2010",
    },
    {
        "filter_name": "seasons_2010_2015",
        "display_name": "2010-2015 Seasons",
        "filter_category": "theme",
        "rule_logic_key": "seasons_2010_2015",
    },
    {
        "filter_name": "seasons_2015_2020",
        "display_name": "2015-2020 Seasons",
        "filter_category": "theme",
        "rule_logic_key": "season_range:2015-2020",
    },
    {
        "filter_name": "seasons_2015_2025",
        "display_name": "2015-2025 Seasons",
        "filter_category": "theme",
        "rule_logic_key": "season_range:2015-2025",
    },
    {
        "filter_name": "seasons_2020_2025",
        "display_name": "2020-2025 Seasons",
        "filter_category": "theme",
        "rule_logic_key": "seasons_2020_2025",
    },
    {
        "filter_name": "seasons_2010s",
        "display_name": "2010s Seasons",
        "filter_category": "theme",
        "rule_logic_key": "seasons_2010s",
    },
    {
        "filter_name": "seasons_2000s",
        "display_name": "2000s Seasons",
        "filter_category": "theme",
        "rule_logic_key": "seasons_2000s",
    },
    {
        "filter_name": "season_2012",
        "display_name": "2012 Season",
        "filter_category": "theme",
        "rule_logic_key": "season_2012",
    },
    {
        "filter_name": "season_2016",
        "display_name": "2016 Season",
        "filter_category": "theme",
        "rule_logic_key": "season:2016",
    },
    {
        "filter_name": "season_2021",
        "display_name": "2021 Season",
        "filter_category": "theme",
        "rule_logic_key": "season:2021",
    },
    {
        "filter_name": "seasons_2006_2015",
        "display_name": "2006-2015 Seasons",
        "filter_category": "theme",
        "rule_logic_key": "season_range:2006-2015",
    },
    {
        "filter_name": "seasons_2011_2020",
        "display_name": "2011-2020 Seasons",
        "filter_category": "theme",
        "rule_logic_key": "season_range:2011-2020",
    },
    {
        "filter_name": "seasons_2000s",
        "display_name": "2000s Seasons",
        "filter_category": "theme",
        "rule_logic_key": "seasons_2000s",
    },
    {
        "filter_name": "seasons_2010s",
        "display_name": "2010s Seasons",
        "filter_category": "theme",
        "rule_logic_key": "seasons_2010s",
    },
    {
        "filter_name": "seasons_2000_2009",
        "display_name": "2000-2009 Seasons",
        "filter_category": "theme",
        "rule_logic_key": "season_range:2000-2009",
    },
    {
        "filter_name": "seasons_2010_2019",
        "display_name": "2010-2019 Seasons",
        "filter_category": "theme",
        "rule_logic_key": "season_range:2010-2019",
    },
    {
        "filter_name": "played_for_4_plus_teams",
        "display_name": "Played For 4+ Teams",
        "filter_category": "eligibility",
        "rule_logic_key": "played_for_4_plus_teams",
    },
    {
        "filter_name": "played_for_3_plus_teams",
        "display_name": "Played For 3+ Teams",
        "filter_category": "eligibility",
        "rule_logic_key": "played_for_3_plus_teams",
    },
    {
        "filter_name": "played_for_2_plus_teams",
        "display_name": "Played For 2+ Teams",
        "filter_category": "eligibility",
        "rule_logic_key": "played_for_2_plus_teams",
    },
    {
        "filter_name": "played_2_plus_seasons",
        "display_name": "Played 2+ Seasons",
        "filter_category": "eligibility",
        "rule_logic_key": "played_2_plus_seasons",
    },
    {
        "filter_name": "played_5_plus_seasons",
        "display_name": "Played 5+ Seasons",
        "filter_category": "eligibility",
        "rule_logic_key": "played_5_plus_seasons",
    },
    {
        "filter_name": "played_8_plus_seasons",
        "display_name": "Played 8+ Seasons",
        "filter_category": "eligibility",
        "rule_logic_key": "played_8_plus_seasons",
    },
    {
        "filter_name": "active_players",
        "display_name": "Active Players",
        "filter_category": "eligibility",
        "rule_logic_key": "active_players",
    },
    {
        "filter_name": "retired_players",
        "display_name": "Retired Players",
        "filter_category": "eligibility",
        "rule_logic_key": "retired_players",
    },
    {
        "filter_name": "undrafted_players",
        "display_name": "Undrafted Players",
        "filter_category": "eligibility",
        "rule_logic_key": "undrafted_players",
    },
    {
        "filter_name": "first_round_players",
        "display_name": "First-Round Players",
        "filter_category": "eligibility",
        "rule_logic_key": "first_round_players",
    },
    {
        "filter_name": "all_players",
        "display_name": "All Players",
        "filter_category": "eligibility",
        "rule_logic_key": "all_players",
    },
]

MULTIPLIERS = [
    {
        "multiplier_name": "teammates_bonus_5",
        "display_name": "Teammates +5%",
        "multiplier_type": "relationship_bonus",
        "rule_logic_key": "teammates_bonus_5",
        "base_value": 1.0,
        "increment_value": 0.05,
    },
    {
        "multiplier_name": "teammates_bonus_10",
        "display_name": "Teammates +10%",
        "multiplier_type": "relationship_bonus",
        "rule_logic_key": "teammates_bonus_10",
        "base_value": 1.0,
        "increment_value": 0.10,
    },
]

RELATIONSHIP_RULES = [
    {
        "relationship_name": "teammates_bonus_5",
        "relationship_type": "teammates",
        "display_text": "Teammates",
        "bonus_pct": 5,
    },
    {
        "relationship_name": "same_franchise_bonus_5",
        "relationship_type": "same_franchise",
        "display_text": "Same Franchise",
        "bonus_pct": 5,
    },
    {
        "relationship_name": "same_college_bonus_5",
        "relationship_type": "same_college",
        "display_text": "Same College",
        "bonus_pct": 5,
    },
    {
        "relationship_name": "same_draft_class_bonus_5",
        "relationship_type": "same_draft_class",
        "display_text": "Same Draft Class",
        "bonus_pct": 5,
    },
    {
        "relationship_name": "same_draft_round_bonus_5",
        "relationship_type": "same_draft_round",
        "display_text": "Same Draft Round",
        "bonus_pct": 5,
    },
    {
        "relationship_name": "both_undrafted_bonus_5",
        "relationship_type": "both_undrafted",
        "display_text": "Both Undrafted",
        "bonus_pct": 5,
    },
    {
        "relationship_name": "same_position_bonus_5",
        "relationship_type": "same_position",
        "display_text": "Same Position",
        "bonus_pct": 5,
    },
]

BASE_SLOT_RULES = [
    {
        "rule_name": "any_player",
        "parameter_type": "any",
        "parameter_value": "ANY",
        "display_text": "Any",
    },
    {
        "rule_name": "flex_player",
        "parameter_type": "any",
        "parameter_value": "ANY",
        "display_text": "Flex",
    },
    {
        "rule_name": "position_qb",
        "parameter_type": "position",
        "parameter_value": "QB",
        "display_text": "QB",
    },
    {
        "rule_name": "position_rb",
        "parameter_type": "position",
        "parameter_value": "RB",
        "display_text": "RB",
    },
    {
        "rule_name": "position_wr",
        "parameter_type": "position",
        "parameter_value": "WR",
        "display_text": "WR",
    },
    {
        "rule_name": "position_te",
        "parameter_type": "position",
        "parameter_value": "TE",
        "display_text": "TE",
    },
    {
        "rule_name": "conference_afc",
        "parameter_type": "conference",
        "parameter_value": "AFC",
        "display_text": "AFC",
    },
    {
        "rule_name": "conference_nfc",
        "parameter_type": "conference",
        "parameter_value": "NFC",
        "display_text": "NFC",
    },
    {
        "rule_name": "division_afc_east",
        "parameter_type": "division",
        "parameter_value": "AFC East",
        "display_text": "AFC East",
    },
    {
        "rule_name": "division_afc_north",
        "parameter_type": "division",
        "parameter_value": "AFC North",
        "display_text": "AFC North",
    },
    {
        "rule_name": "division_afc_south",
        "parameter_type": "division",
        "parameter_value": "AFC South",
        "display_text": "AFC South",
    },
    {
        "rule_name": "division_afc_west",
        "parameter_type": "division",
        "parameter_value": "AFC West",
        "display_text": "AFC West",
    },
    {
        "rule_name": "division_nfc_east",
        "parameter_type": "division",
        "parameter_value": "NFC East",
        "display_text": "NFC East",
    },
    {
        "rule_name": "division_nfc_north",
        "parameter_type": "division",
        "parameter_value": "NFC North",
        "display_text": "NFC North",
    },
    {
        "rule_name": "division_nfc_south",
        "parameter_type": "division",
        "parameter_value": "NFC South",
        "display_text": "NFC South",
    },
    {
        "rule_name": "division_nfc_west",
        "parameter_type": "division",
        "parameter_value": "NFC West",
        "display_text": "NFC West",
    },
]

STATS = [
    {
        "stat_name": "fantasy_points_ppr",
        "display_name": "Fantasy Points",
        "stat_category": "scoring",
        "source_column": "fantasy_points_ppr",
        "allowed_position_group": None,
        "higher_is_better_flag": True,
        "decimal_places": 2,
    },
    {
        "stat_name": "passing_yards",
        "display_name": "Passing Yards",
        "stat_category": "passing",
        "source_column": "passing_yards",
        "allowed_position_group": "QB",
        "higher_is_better_flag": True,
        "decimal_places": 0,
    },
    {
        "stat_name": "passing_td",
        "display_name": "Passing TDs",
        "stat_category": "passing",
        "source_column": "passing_td",
        "allowed_position_group": "QB",
        "higher_is_better_flag": True,
        "decimal_places": 0,
    },
    {
        "stat_name": "rushing_yards",
        "display_name": "Rushing Yards",
        "stat_category": "rushing",
        "source_column": "rushing_yards",
        "allowed_position_group": None,
        "higher_is_better_flag": True,
        "decimal_places": 0,
    },
    {
        "stat_name": "rushing_td",
        "display_name": "Rushing TDs",
        "stat_category": "rushing",
        "source_column": "rushing_td",
        "allowed_position_group": None,
        "higher_is_better_flag": True,
        "decimal_places": 0,
    },
    {
        "stat_name": "receiving_yards",
        "display_name": "Receiving Yards",
        "stat_category": "receiving",
        "source_column": "receiving_yards",
        "allowed_position_group": None,
        "higher_is_better_flag": True,
        "decimal_places": 0,
    },
    {
        "stat_name": "receiving_td",
        "display_name": "Receiving TDs",
        "stat_category": "receiving",
        "source_column": "receiving_td",
        "allowed_position_group": None,
        "higher_is_better_flag": True,
        "decimal_places": 0,
    },
    {
        "stat_name": "receptions",
        "display_name": "Receptions",
        "stat_category": "receiving",
        "source_column": "receptions",
        "allowed_position_group": None,
        "higher_is_better_flag": True,
        "decimal_places": 0,
    },
]


def load_env_file(path: Path) -> None:
    if not path.exists():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#") or "=" not in stripped:
            continue
        key, value = stripped.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


def db_dsn() -> str:
    load_env_file(ENV_FILE)
    database_url = os.environ.get("DATABASE_URL")
    if database_url:
        return database_url
    host = os.environ.get("DB_HOST")
    port = os.environ.get("DB_PORT", "5432")
    user = os.environ.get("DB_USER")
    password = os.environ.get("DB_PASSWORD")
    dbname = os.environ.get("DB_NAME")
    sslmode = os.environ.get("DB_SSL_MODE")
    channel_binding = os.environ.get("DB_CHANNEL_BINDING")
    if not all([host, user, password, dbname]):
        raise SystemExit(
            "Missing DATABASE_URL or DB_HOST / DB_PORT / DB_USER / DB_PASSWORD / DB_NAME environment variables."
        )
    dsn = f"host={host} port={port} user={user} password={password} dbname={dbname}"
    if sslmode:
        dsn += f" sslmode={sslmode}"
    if channel_binding:
        dsn += f" channel_binding={channel_binding}"
    return dsn


def main() -> None:
    with psycopg.connect(db_dsn()) as conn:
        with conn.cursor() as cur:
            cur.executemany(
                """
                INSERT INTO filter_definition (
                  filter_name,
                  display_name,
                  filter_category,
                  rule_logic_key
                )
                VALUES (
                  %(filter_name)s,
                  %(display_name)s,
                  %(filter_category)s,
                  %(rule_logic_key)s
                )
                ON CONFLICT (filter_name)
                DO UPDATE SET
                  display_name = EXCLUDED.display_name,
                  rule_logic_key = EXCLUDED.rule_logic_key,
                  filter_category = EXCLUDED.filter_category,
                  active_flag = true
                """,
                FILTERS,
            )

            cur.executemany(
                """
                INSERT INTO multiplier_definition (
                  multiplier_name,
                  display_name,
                  multiplier_type,
                  rule_logic_key,
                  base_value,
                  increment_value
                )
                VALUES (
                  %(multiplier_name)s,
                  %(display_name)s,
                  %(multiplier_type)s,
                  %(rule_logic_key)s,
                  %(base_value)s,
                  %(increment_value)s
                )
                ON CONFLICT (multiplier_name)
                DO UPDATE SET
                  display_name = EXCLUDED.display_name,
                  multiplier_type = EXCLUDED.multiplier_type,
                  rule_logic_key = EXCLUDED.rule_logic_key,
                  base_value = EXCLUDED.base_value,
                  increment_value = EXCLUDED.increment_value,
                  active_flag = true
                """,
                MULTIPLIERS,
            )

            cur.executemany(
                """
                INSERT INTO stat_definition (
                  stat_name,
                  display_name,
                  stat_category,
                  source_column,
                  allowed_position_group,
                  higher_is_better_flag,
                  decimal_places
                )
                VALUES (
                  %(stat_name)s,
                  %(display_name)s,
                  %(stat_category)s,
                  %(source_column)s,
                  %(allowed_position_group)s,
                  %(higher_is_better_flag)s,
                  %(decimal_places)s
                )
                ON CONFLICT (stat_name)
                DO UPDATE SET
                  display_name = EXCLUDED.display_name,
                  stat_category = EXCLUDED.stat_category,
                  source_column = EXCLUDED.source_column,
                  allowed_position_group = EXCLUDED.allowed_position_group,
                  higher_is_better_flag = EXCLUDED.higher_is_better_flag,
                  decimal_places = EXCLUDED.decimal_places,
                  active_flag = true
                """,
                STATS,
            )

            cur.executemany(
                """
                INSERT INTO relationship_rule_definition (
                  relationship_name,
                  relationship_type,
                  display_text,
                  bonus_pct
                )
                VALUES (
                  %(relationship_name)s,
                  %(relationship_type)s,
                  %(display_text)s,
                  %(bonus_pct)s
                )
                ON CONFLICT (relationship_name)
                DO UPDATE SET
                  relationship_type = EXCLUDED.relationship_type,
                  display_text = EXCLUDED.display_text,
                  bonus_pct = EXCLUDED.bonus_pct,
                  active_flag = true
                """,
                RELATIONSHIP_RULES,
            )

            slot_rules = list(BASE_SLOT_RULES)

            cur.execute(
                """
                SELECT DISTINCT team_abbr, COALESCE(NULLIF(nickname, ''), team_abbr) AS display_text
                FROM team_dim
                WHERE team_abbr IS NOT NULL
                ORDER BY team_abbr
                """
            )
            for team_abbr, display_text in cur.fetchall():
                normalized_abbr = str(team_abbr).strip().upper()
                slot_rules.append(
                    {
                        "rule_name": f"team_{normalized_abbr.lower()}",
                        "parameter_type": "team",
                        "parameter_value": normalized_abbr,
                        "display_text": str(display_text).strip() or normalized_abbr,
                    }
                )

            cur.executemany(
                """
                INSERT INTO slot_rule_definition (
                  rule_name,
                  parameter_type,
                  parameter_value,
                  display_text
                )
                VALUES (
                  %(rule_name)s,
                  %(parameter_type)s,
                  %(parameter_value)s,
                  %(display_text)s
                )
                ON CONFLICT (rule_name)
                DO UPDATE SET
                  parameter_type = EXCLUDED.parameter_type,
                  parameter_value = EXCLUDED.parameter_value,
                  display_text = EXCLUDED.display_text,
                  active_flag = true
                """,
                slot_rules,
            )

        conn.commit()

    print(
        "Seeded filter_definition, multiplier_definition, stat_definition, "
        "relationship_rule_definition, and slot_rule_definition."
    )


if __name__ == "__main__":
    main()

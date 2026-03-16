from __future__ import annotations

import os
from datetime import date, timedelta
from pathlib import Path

import psycopg


ROOT = Path(__file__).resolve().parents[1]
ENV_FILE = ROOT / ".env.local"

THEMES = [
    ("season_range:2000-2005", "2000-2005 Breakouts"),
    ("season_range:2005-2010", "2005-2010 Standouts"),
    ("season_range:2006-2015", "2006-2015 Prime Years"),
    ("seasons_2000s", "2000s Icons"),
    ("seasons_2020_2025", "2020-2025 Stars"),
    ("seasons_2010s", "2010s Stars"),
    ("seasons_2010_2015", "2010-2015 Peak Years"),
    ("season_range:2011-2020", "2011-2020 Stars"),
    ("season_range:2015-2020", "2015-2020 Playmakers"),
    ("season_2012", "2012 Snapshot"),
    ("season:2016", "2016 Snapshot"),
    ("season:2021", "2021 Snapshot"),
]

ELIGIBILITIES = [
    "played_2_plus_seasons",
    "played_5_plus_seasons",
    "played_8_plus_seasons",
    "played_for_2_plus_teams",
    "played_for_3_plus_teams",
    "active_players",
    "retired_players",
    "undrafted_players",
    "first_round_players",
    "all_players",
    "played_for_4_plus_teams",
]

LINKS = [
    "teammates",
    "same_franchise",
    "same_college",
    "same_draft_class",
    "same_draft_round",
    "both_undrafted",
    "same_position",
]

STATS = [
    "fantasy_points_ppr",
    "passing_yards",
    "rushing_yards",
    "receiving_yards",
]

SLOT_LAYOUTS = [
    [
        "position_qb",
        "position_rb",
        "position_wr",
        "position_te",
        "flex_player",
    ],
    [
        "conference_afc",
        "conference_nfc",
        "position_qb",
        "position_wr",
        "any_player",
    ],
    [
        "division_afc_west",
        "division_nfc_east",
        "position_rb",
        "position_te",
        "flex_player",
    ],
    [
        "team_ten",
        "team_dal",
        "team_gb",
        "team_sf",
        "any_player",
    ],
    [
        "position_wr",
        "position_wr",
        "position_rb",
        "position_te",
        "position_qb",
    ],
    [
        "conference_afc",
        "team_kc",
        "position_qb",
        "division_nfc_west",
        "flex_player",
    ],
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


def fetch_id(cur: psycopg.Cursor, table: str, key_column: str, value: str, id_column: str) -> int:
    cur.execute(
        f"SELECT {id_column} FROM {table} WHERE {key_column} = %s",
        (value,),
    )
    row = cur.fetchone()
    if not row:
        raise SystemExit(f"Could not find {table}.{key_column} = {value!r}")
    return int(row[0])


def main() -> None:
    start_date = date(2026, 3, 15)
    combinations: list[tuple[str, str, str, str]] = []

    for index in range(25):
        theme_key, title = THEMES[index % len(THEMES)]
        eligibility = ELIGIBILITIES[index % len(ELIGIBILITIES)]
        link = LINKS[index % len(LINKS)]
        combinations.append((theme_key, title, eligibility, link))

    with psycopg.connect(db_dsn()) as conn:
        with conn.cursor() as cur:
            stat_ids = [
                fetch_id(cur, "stat_definition", "stat_name", stat_name, "stat_id")
                for stat_name in STATS
            ]

            for index, (theme_key, title, eligibility_key, link_key) in enumerate(combinations):
                puzzle_date = start_date + timedelta(days=index)
                slot_layout = SLOT_LAYOUTS[index % len(SLOT_LAYOUTS)]
                theme_filter_id = fetch_id(
                    cur, "filter_definition", "rule_logic_key", theme_key, "filter_id"
                )
                eligibility_filter_id = fetch_id(
                    cur,
                    "filter_definition",
                    "rule_logic_key",
                    eligibility_key,
                    "filter_id",
                )
                relationship_rule_id = fetch_id(
                    cur,
                    "relationship_rule_definition",
                    "relationship_type",
                    link_key,
                    "relationship_rule_id",
                )
                multiplier_id = fetch_id(
                    cur,
                    "multiplier_definition",
                    "multiplier_name",
                    "teammates_bonus_5",
                    "multiplier_id",
                )
                slot_rule_ids = [
                    fetch_id(
                        cur,
                        "slot_rule_definition",
                        "rule_name",
                        slot_rule_name,
                        "slot_rule_id",
                    )
                    for slot_rule_name in slot_layout
                ]

                cur.execute(
                    """
                    INSERT INTO daily_puzzle (
                      puzzle_date,
                      sport,
                      title,
                      filter_id,
                      theme_filter_id,
                      eligibility_filter_id,
                      relationship_rule_id,
                      multiplier_id,
                      stat_pool_size,
                      selection_count,
                      published_flag
                    )
                    VALUES (%s, 'nfl', %s, %s, %s, %s, %s, %s, %s, 5, true)
                    ON CONFLICT (puzzle_date, sport)
                    DO UPDATE SET
                      title = EXCLUDED.title,
                      filter_id = EXCLUDED.filter_id,
                      theme_filter_id = EXCLUDED.theme_filter_id,
                      eligibility_filter_id = EXCLUDED.eligibility_filter_id,
                      relationship_rule_id = EXCLUDED.relationship_rule_id,
                      multiplier_id = EXCLUDED.multiplier_id,
                      stat_pool_size = EXCLUDED.stat_pool_size,
                      selection_count = EXCLUDED.selection_count,
                      published_flag = EXCLUDED.published_flag
                    RETURNING puzzle_id
                    """,
                    (
                        puzzle_date,
                        title,
                        theme_filter_id,
                        theme_filter_id,
                        eligibility_filter_id,
                        relationship_rule_id,
                        multiplier_id,
                        len(stat_ids),
                    ),
                )
                puzzle_id = int(cur.fetchone()[0])

                cur.execute(
                    "DELETE FROM daily_puzzle_stat_pool WHERE puzzle_id = %s",
                    (puzzle_id,),
                )
                cur.executemany(
                    """
                    INSERT INTO daily_puzzle_stat_pool (
                      puzzle_id,
                      stat_id,
                      display_order
                    )
                    VALUES (%s, %s, %s)
                    """,
                    [
                        (puzzle_id, stat_id, display_order)
                        for display_order, stat_id in enumerate(stat_ids, start=1)
                    ],
                )
                cur.execute(
                    "DELETE FROM daily_puzzle_slot_rule WHERE puzzle_id = %s",
                    (puzzle_id,),
                )
                cur.executemany(
                    """
                    INSERT INTO daily_puzzle_slot_rule (
                      puzzle_id,
                      slot_number,
                      slot_rule_id
                    )
                    VALUES (%s, %s, %s)
                    """,
                    [
                        (puzzle_id, slot_number, slot_rule_id)
                        for slot_number, slot_rule_id in enumerate(
                            slot_rule_ids, start=1
                        )
                    ],
                )

        conn.commit()

    print(f"Generated {len(combinations)} daily puzzles starting on {start_date.isoformat()}.")


if __name__ == "__main__":
    main()

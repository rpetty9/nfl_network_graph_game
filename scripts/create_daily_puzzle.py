from __future__ import annotations

import argparse
import os
from datetime import date
from pathlib import Path

import psycopg


ROOT = Path(__file__).resolve().parents[1]
ENV_FILE = ROOT / ".env.local"


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
    host = os.environ.get("DB_HOST")
    port = os.environ.get("DB_PORT", "5432")
    user = os.environ.get("DB_USER")
    password = os.environ.get("DB_PASSWORD")
    dbname = os.environ.get("DB_NAME")
    if not all([host, user, password, dbname]):
        raise SystemExit(
            "Missing DB_HOST / DB_PORT / DB_USER / DB_PASSWORD / DB_NAME environment variables."
        )
    return f"host={host} port={port} user={user} password={password} dbname={dbname}"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Create or replace a daily puzzle row.")
    parser.add_argument("--puzzle-date", default=str(date.today()))
    parser.add_argument("--sport", default="nfl")
    parser.add_argument("--title", default="NFL Link Game")
    parser.add_argument("--theme", default="seasons_2020_2025")
    parser.add_argument("--eligibility", default="played_for_4_plus_teams")
    parser.add_argument("--link", default="teammates")
    parser.add_argument("--multiplier", default="teammates_bonus_5")
    parser.add_argument(
        "--stats",
        nargs="+",
        default=["fantasy_points_ppr", "passing_yards", "rushing_yards", "receiving_yards"],
    )
    parser.add_argument(
        "--publish",
        action=argparse.BooleanOptionalAction,
        default=True,
    )
    parser.add_argument(
        "--slots",
        nargs="+",
        default=[
            "position_qb",
            "position_rb",
            "position_wr",
            "position_te",
            "flex_player",
        ],
        help="Five slot rule names, in slot order.",
    )
    parser.add_argument("--unpublish-others", action="store_true")
    return parser.parse_args()


def fetch_id(cur: psycopg.Cursor, table: str, key_column: str, value: str, id_column: str) -> int:
    cur.execute(
        f"SELECT {id_column} FROM {table} WHERE {key_column} = %s",
        (value,),
    )
    row = cur.fetchone()
    if not row:
        raise SystemExit(f"Could not find {table}.{key_column} = {value!r}. Seed config first.")
    return int(row[0])


def main() -> None:
    args = parse_args()
    if len(args.slots) != 5:
        raise SystemExit("--slots must contain exactly 5 slot rule names.")

    with psycopg.connect(db_dsn()) as conn:
        with conn.cursor() as cur:
            theme_filter_id = fetch_id(
                cur, "filter_definition", "rule_logic_key", args.theme, "filter_id"
            )
            eligibility_filter_id = fetch_id(
                cur,
                "filter_definition",
                "rule_logic_key",
                args.eligibility,
                "filter_id",
            )
            relationship_rule_id = fetch_id(
                cur,
                "relationship_rule_definition",
                "relationship_type",
                args.link,
                "relationship_rule_id",
            )
            multiplier_id = fetch_id(
                cur,
                "multiplier_definition",
                "multiplier_name",
                args.multiplier,
                "multiplier_id",
            )

            stat_ids: list[int] = []
            for stat_name in args.stats:
                stat_ids.append(
                    fetch_id(cur, "stat_definition", "stat_name", stat_name, "stat_id")
                )
            slot_rule_ids = [
                fetch_id(cur, "slot_rule_definition", "rule_name", rule_name, "slot_rule_id")
                for rule_name in args.slots
            ]

            if args.unpublish_others:
                cur.execute(
                    """
                    UPDATE daily_puzzle
                    SET published_flag = false
                    WHERE sport = %s
                      AND puzzle_date <> %s
                    """,
                    (args.sport, args.puzzle_date),
                )

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
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
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
                    args.puzzle_date,
                    args.sport,
                    args.title,
                    theme_filter_id,
                    theme_filter_id,
                    eligibility_filter_id,
                    relationship_rule_id,
                    multiplier_id,
                    len(stat_ids),
                    5,
                    args.publish,
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
                    for slot_number, slot_rule_id in enumerate(slot_rule_ids, start=1)
                ],
            )

        conn.commit()

    print(
        f"Created puzzle for {args.puzzle_date} with theme={args.theme}, "
        f"eligibility={args.eligibility}, link={args.link}, multiplier={args.multiplier}."
    )


if __name__ == "__main__":
    main()

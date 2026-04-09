from __future__ import annotations

import os
from pathlib import Path
from typing import Any

import psycopg

try:
    import nflreadpy as nfl
except ImportError as exc:  # pragma: no cover
    raise SystemExit(
        "nflreadpy is not installed. Run `py -m pip install -r requirements-etl.txt` first."
    ) from exc

from load_nflverse_to_postgres import (
    load_env_file,
    pick,
    safe_height_inches,
    safe_int,
    clean_str,
    refresh_multi_college_flags,
    refresh_super_bowl_wins,
    sync_player_college_history,
)


ROOT = Path(__file__).resolve().parents[1]
ENV_FILE = ROOT / ".env.local"
MIGRATION_FILE = ROOT / "scripts" / "sql" / "013_player_profile_attributes.sql"


def db_dsn() -> str:
    load_env_file(ENV_FILE)
    database_url = os.environ.get("DATABASE_URL")
    if not database_url:
        raise SystemExit("DATABASE_URL is required.")
    return database_url


def main() -> None:
    players = nfl.load_players()
    if hasattr(players, "to_dicts"):
        records = players.to_dicts()
    elif hasattr(players, "to_dict"):
        records = players.to_dict(orient="records")
    else:
        records = list(players)

    staged_rows: list[
        tuple[
            str | None,
            str,
            int | None,
            str | None,
            str | None,
            int | None,
            int | None,
            int | None,
            str | None,
            int | None,
            int | None,
            str | None,
        ]
    ] = []
    updated_rows = 0

    with psycopg.connect(db_dsn()) as conn:
        if MIGRATION_FILE.exists():
            conn.execute(MIGRATION_FILE.read_text(encoding="utf-8"))
        with conn.cursor() as cur:
            for record in records:
                external_player_id = clean_str(
                    pick(record, "gsis_id", "player_id", "player_gsis_id", "nflverse_id")
                )
                player_name = clean_str(
                    pick(record, "display_name", "player_name", "full_name", "name")
                )
                birth_date = clean_str(pick(record, "birth_date", "dob"))
                birth_year = safe_int(birth_date[:4]) if birth_date else None
                draft_round = safe_int(pick(record, "draft_round", "round"))
                draft_year = safe_int(pick(record, "draft_year"))
                draft_pick = safe_int(
                    pick(record, "draft_pick", "pick", "pick_overall", "overall_pick")
                )
                height_inches = safe_height_inches(
                    pick(record, "height", "height_inches")
                )
                weight_lbs = safe_int(pick(record, "weight", "weight_lbs"))
                headshot_url = clean_str(pick(record, "headshot", "headshot_url"))
                college_name = clean_str(pick(record, "college_name", "college"))
                primary_position = clean_str(
                    pick(record, "position", "pos", "primary_position")
                )

                if not player_name:
                    continue

                staged_rows.append(
                    (
                        external_player_id,
                        player_name,
                        birth_year,
                        primary_position,
                        college_name,
                        draft_round,
                        draft_year,
                        draft_pick,
                        birth_date,
                        height_inches,
                        weight_lbs,
                        headshot_url,
                    )
                )

            cur.execute(
                """
                CREATE TEMP TABLE tmp_player_profile_attrs (
                  external_player_id TEXT,
                  player_name TEXT NOT NULL,
                  birth_year INTEGER,
                  primary_position TEXT,
                  college_name TEXT,
                  draft_round INTEGER,
                  draft_year INTEGER,
                  draft_pick INTEGER,
                  birth_date DATE,
                  height_inches INTEGER,
                  weight_lbs INTEGER,
                  headshot_url TEXT
                ) ON COMMIT DROP
                """
            )

            cur.executemany(
                """
                INSERT INTO tmp_player_profile_attrs (
                  external_player_id,
                  player_name,
                  birth_year,
                  primary_position,
                  college_name,
                  draft_round,
                  draft_year,
                  draft_pick,
                  birth_date,
                  height_inches,
                  weight_lbs,
                  headshot_url
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """,
                staged_rows,
            )

            cur.execute(
                """
                UPDATE player_dim p
                SET
                  external_player_id = COALESCE(t.external_player_id, p.external_player_id),
                  primary_position = COALESCE(t.primary_position, p.primary_position),
                  college_name = COALESCE(t.college_name, p.college_name),
                  draft_round = COALESCE(t.draft_round, p.draft_round),
                  draft_year = COALESCE(t.draft_year, p.draft_year),
                  draft_pick = COALESCE(t.draft_pick, p.draft_pick),
                  birth_date = COALESCE(t.birth_date, p.birth_date),
                  birth_year = COALESCE(t.birth_year, p.birth_year),
                  height_inches = COALESCE(t.height_inches, p.height_inches),
                  weight_lbs = COALESCE(t.weight_lbs, p.weight_lbs),
                  headshot_url = COALESCE(t.headshot_url, p.headshot_url),
                  undrafted_flag = CASE
                    WHEN COALESCE(t.draft_round, p.draft_round) IS NOT NULL THEN false
                    WHEN COALESCE(t.draft_year, p.draft_year) IS NOT NULL THEN true
                    ELSE p.undrafted_flag
                  END
                FROM tmp_player_profile_attrs t
                WHERE
                  (t.external_player_id IS NOT NULL AND p.external_player_id = t.external_player_id)
                  OR (
                    t.external_player_id IS NULL
                    AND p.player_name = t.player_name
                    AND p.birth_year IS NOT DISTINCT FROM t.birth_year
                  )
                """
            )
            updated_rows = cur.rowcount

        sync_player_college_history(conn)
        refresh_multi_college_flags(conn)
        refresh_super_bowl_wins(conn)
        conn.commit()

    print(
        f"Backfilled player profile attributes for {updated_rows} rows "
        f"and refreshed colleges/achievement flags."
    )


if __name__ == "__main__":
    main()

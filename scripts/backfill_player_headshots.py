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


def clean_str(value: Any) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def dataframe_to_records(frame: Any) -> list[dict[str, Any]]:
    if hasattr(frame, "to_dicts"):
        return list(frame.to_dicts())
    if hasattr(frame, "to_dict"):
        rows = frame.to_dict(orient="records")
        if isinstance(rows, list):
            return rows
    raise SystemExit("Unsupported dataframe object returned from nflreadpy.load_players().")


def pick(record: dict[str, Any], *keys: str) -> Any:
    for key in keys:
        if key in record and record[key] is not None:
            return record[key]
    return None


def main() -> None:
    players_frame = nfl.load_players()
    records = dataframe_to_records(players_frame)

    updates: dict[str, str] = {}
    for record in records:
        external_player_id = clean_str(
            pick(record, "player_id", "gsis_id", "player_gsis_id", "nflverse_id")
        )
        headshot_url = clean_str(pick(record, "headshot_url", "headshot", "headshot"))
        if not external_player_id or not headshot_url:
            continue
        updates[external_player_id] = headshot_url

    if not updates:
        raise SystemExit("No headshot URLs were found in nflreadpy.load_players().")

    with psycopg.connect(db_dsn()) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT column_name
                FROM information_schema.columns
                WHERE table_name = 'player_dim'
                  AND column_name = 'headshot_url'
                """
            )
            if not cur.fetchone():
                raise SystemExit("player_dim.headshot_url does not exist in the database.")

            cur.executemany(
                """
                UPDATE player_dim
                SET headshot_url = %s
                WHERE external_player_id = %s
                """,
                [(url, external_id) for external_id, url in updates.items()],
            )
            updated_rows = cur.rowcount

        conn.commit()

    print(f"Loaded {len(updates)} headshot URLs from nflreadpy.")
    print(f"Updated {updated_rows} player_dim rows with headshot_url values.")


if __name__ == "__main__":
    main()

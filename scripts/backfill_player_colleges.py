from __future__ import annotations

import os
import re
from pathlib import Path

import psycopg


ROOT = Path(__file__).resolve().parents[1]
ENV_FILE = ROOT / ".env.local"
COLLEGE_SPLIT_RE = re.compile(r"\s*;\s*")


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


def split_colleges(raw_value: str | None) -> list[str]:
    if not raw_value:
        return []

    colleges: list[str] = []
    seen: set[str] = set()
    for piece in COLLEGE_SPLIT_RE.split(raw_value):
        cleaned = piece.strip()
        if not cleaned:
            continue
        normalized = cleaned.casefold()
        if normalized in seen:
            continue
        seen.add(normalized)
        colleges.append(cleaned)
    return colleges


def main() -> None:
    with psycopg.connect(db_dsn()) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT player_id, college_name
                FROM player_dim
                WHERE college_name IS NOT NULL
                  AND BTRIM(college_name) <> ''
                ORDER BY player_id
                """
            )
            players = cur.fetchall()

            cur.execute("DELETE FROM player_college_history")

            rows_to_insert: list[tuple[int, str, int]] = []
            for player_id, college_name in players:
                colleges = split_colleges(str(college_name))
                for display_order, college in enumerate(colleges, start=1):
                    rows_to_insert.append((int(player_id), college, display_order))

            cur.executemany(
                """
                INSERT INTO player_college_history (
                  player_id,
                  college_name,
                  display_order
                )
                VALUES (%s, %s, %s)
                """,
                rows_to_insert,
            )

        conn.commit()

    print(f"Backfilled {len(rows_to_insert)} player_college_history rows.")


if __name__ == "__main__":
    main()

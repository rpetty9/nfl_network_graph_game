from __future__ import annotations

import argparse
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
    database_url = os.environ.get("DATABASE_URL")
    if not database_url:
        raise SystemExit("DATABASE_URL is required.")
    return database_url


def season_kwargs(start_season: int, end_season: int) -> list[dict[str, Any]]:
    if start_season == end_season:
      return [{"season": start_season}, {"year": start_season}]
    return [
        {"seasons": list(range(start_season, end_season + 1))},
        {"season": list(range(start_season, end_season + 1))},
        {"years": list(range(start_season, end_season + 1))},
        {"year": list(range(start_season, end_season + 1))},
    ]


def call_first_available(function_names: list[str], kwargs_options: list[dict[str, Any]]):
    last_error: Exception | None = None
    for function_name in function_names:
        loader = getattr(nfl, function_name, None)
        if loader is None:
            continue
        for kwargs in kwargs_options:
            try:
                return loader(**kwargs)
            except TypeError as exc:
                last_error = exc
                continue
    if last_error is not None:
        raise last_error
    raise RuntimeError("No compatible draft loader found in nflreadpy.")


def pick(record: dict[str, Any], *keys: str) -> Any:
    for key in keys:
        if key in record and record[key] not in (None, ""):
            return record[key]
    return None


def safe_int(value: Any) -> int | None:
    if value in (None, ""):
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def clean_str(value: Any) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def main() -> None:
    parser = argparse.ArgumentParser(description="Backfill player_dim draft_round and draft_year from nflverse draft data.")
    parser.add_argument("--start-season", type=int, default=2000)
    parser.add_argument("--end-season", type=int, default=2025)
    args = parser.parse_args()

    draft_rows = call_first_available(
        ["load_draft_picks", "load_draft"],
        season_kwargs(args.start_season, args.end_season) + [{}],
    )
    if hasattr(draft_rows, "to_dicts"):
        records = draft_rows.to_dicts()
    elif hasattr(draft_rows, "to_dict"):
        records = draft_rows.to_dict(orient="records")
    else:
        records = list(draft_rows)

    draft_map: dict[str, tuple[int | None, int | None]] = {}
    for record in records:
        external_player_id = clean_str(
            pick(record, "player_id", "gsis_id", "player_gsis_id", "nflverse_id")
        )
        if not external_player_id:
            continue
        draft_round = safe_int(pick(record, "draft_round", "round"))
        draft_year = safe_int(pick(record, "draft_year", "season", "year"))
        current_round, current_year = draft_map.get(external_player_id, (None, None))
        draft_map[external_player_id] = (
            draft_round if draft_round is not None else current_round,
            draft_year if draft_year is not None else current_year,
        )

    updated_rows = 0
    with psycopg.connect(db_dsn()) as conn:
        with conn.cursor() as cur:
            for external_player_id, (draft_round, draft_year) in draft_map.items():
                if draft_round is None and draft_year is None:
                    continue
                cur.execute(
                    """
                    UPDATE player_dim
                    SET
                      draft_round = COALESCE(%s, draft_round),
                      draft_year = COALESCE(%s, draft_year),
                      undrafted_flag = CASE
                        WHEN %s IS NOT NULL THEN false
                        WHEN COALESCE(%s, draft_year) IS NOT NULL THEN true
                        ELSE undrafted_flag
                      END
                    WHERE external_player_id = %s
                    """,
                    (draft_round, draft_year, draft_round, draft_year, external_player_id),
                )
                updated_rows += cur.rowcount
        conn.commit()

    print(f"Updated {updated_rows} player_dim rows with draft metadata.")


if __name__ == "__main__":
    main()

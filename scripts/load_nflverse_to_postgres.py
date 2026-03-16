from __future__ import annotations

import argparse
import os
from collections import defaultdict
from dataclasses import dataclass
from itertools import combinations
from pathlib import Path
import re
from typing import Any

import psycopg

try:
    import nflreadpy as nfl
except ImportError as exc:  # pragma: no cover
    raise SystemExit(
        "nflreadpy is not installed. Run `py -m pip install -r requirements-etl.txt` first."
    ) from exc


ROOT = Path(__file__).resolve().parents[1]
SCHEMA_DIR = ROOT / "scripts" / "sql"
ENV_FILE = ROOT / ".env.local"
COLLEGE_SPLIT_RE = re.compile(r"\s*;\s*")

TEAM_METADATA: dict[str, dict[str, str | None]] = {
    "ARI": {"team_name": "Arizona Cardinals", "nickname": "Cardinals", "city": "Arizona", "conference": "NFC", "division": "West"},
    "ATL": {"team_name": "Atlanta Falcons", "nickname": "Falcons", "city": "Atlanta", "conference": "NFC", "division": "South"},
    "BAL": {"team_name": "Baltimore Ravens", "nickname": "Ravens", "city": "Baltimore", "conference": "AFC", "division": "North"},
    "BUF": {"team_name": "Buffalo Bills", "nickname": "Bills", "city": "Buffalo", "conference": "AFC", "division": "East"},
    "CAR": {"team_name": "Carolina Panthers", "nickname": "Panthers", "city": "Carolina", "conference": "NFC", "division": "South"},
    "CHI": {"team_name": "Chicago Bears", "nickname": "Bears", "city": "Chicago", "conference": "NFC", "division": "North"},
    "CIN": {"team_name": "Cincinnati Bengals", "nickname": "Bengals", "city": "Cincinnati", "conference": "AFC", "division": "North"},
    "CLE": {"team_name": "Cleveland Browns", "nickname": "Browns", "city": "Cleveland", "conference": "AFC", "division": "North"},
    "DAL": {"team_name": "Dallas Cowboys", "nickname": "Cowboys", "city": "Dallas", "conference": "NFC", "division": "East"},
    "DEN": {"team_name": "Denver Broncos", "nickname": "Broncos", "city": "Denver", "conference": "AFC", "division": "West"},
    "DET": {"team_name": "Detroit Lions", "nickname": "Lions", "city": "Detroit", "conference": "NFC", "division": "North"},
    "GB": {"team_name": "Green Bay Packers", "nickname": "Packers", "city": "Green Bay", "conference": "NFC", "division": "North"},
    "HOU": {"team_name": "Houston Texans", "nickname": "Texans", "city": "Houston", "conference": "AFC", "division": "South"},
    "IND": {"team_name": "Indianapolis Colts", "nickname": "Colts", "city": "Indianapolis", "conference": "AFC", "division": "South"},
    "JAX": {"team_name": "Jacksonville Jaguars", "nickname": "Jaguars", "city": "Jacksonville", "conference": "AFC", "division": "South"},
    "KC": {"team_name": "Kansas City Chiefs", "nickname": "Chiefs", "city": "Kansas City", "conference": "AFC", "division": "West"},
    "LV": {"team_name": "Las Vegas Raiders", "nickname": "Raiders", "city": "Las Vegas", "conference": "AFC", "division": "West"},
    "LAC": {"team_name": "Los Angeles Chargers", "nickname": "Chargers", "city": "Los Angeles", "conference": "AFC", "division": "West"},
    "LAR": {"team_name": "Los Angeles Rams", "nickname": "Rams", "city": "Los Angeles", "conference": "NFC", "division": "West"},
    "MIA": {"team_name": "Miami Dolphins", "nickname": "Dolphins", "city": "Miami", "conference": "AFC", "division": "East"},
    "MIN": {"team_name": "Minnesota Vikings", "nickname": "Vikings", "city": "Minnesota", "conference": "NFC", "division": "North"},
    "NE": {"team_name": "New England Patriots", "nickname": "Patriots", "city": "New England", "conference": "AFC", "division": "East"},
    "NO": {"team_name": "New Orleans Saints", "nickname": "Saints", "city": "New Orleans", "conference": "NFC", "division": "South"},
    "NYG": {"team_name": "New York Giants", "nickname": "Giants", "city": "New York", "conference": "NFC", "division": "East"},
    "NYJ": {"team_name": "New York Jets", "nickname": "Jets", "city": "New York", "conference": "AFC", "division": "East"},
    "PHI": {"team_name": "Philadelphia Eagles", "nickname": "Eagles", "city": "Philadelphia", "conference": "NFC", "division": "East"},
    "PIT": {"team_name": "Pittsburgh Steelers", "nickname": "Steelers", "city": "Pittsburgh", "conference": "AFC", "division": "North"},
    "SEA": {"team_name": "Seattle Seahawks", "nickname": "Seahawks", "city": "Seattle", "conference": "NFC", "division": "West"},
    "SF": {"team_name": "San Francisco 49ers", "nickname": "49ers", "city": "San Francisco", "conference": "NFC", "division": "West"},
    "TB": {"team_name": "Tampa Bay Buccaneers", "nickname": "Buccaneers", "city": "Tampa Bay", "conference": "NFC", "division": "South"},
    "TEN": {"team_name": "Tennessee Titans", "nickname": "Titans", "city": "Tennessee", "conference": "AFC", "division": "South"},
    "WAS": {"team_name": "Washington Commanders", "nickname": "Commanders", "city": "Washington", "conference": "NFC", "division": "East"},
    "OAK": {"team_name": "Oakland Raiders", "nickname": "Raiders", "city": "Oakland", "conference": "AFC", "division": "West"},
    "SD": {"team_name": "San Diego Chargers", "nickname": "Chargers", "city": "San Diego", "conference": "AFC", "division": "West"},
    "STL": {"team_name": "St. Louis Rams", "nickname": "Rams", "city": "St. Louis", "conference": "NFC", "division": "West"},
}

FRANCHISE_ALIASES = {
    "ARI": "ARI",
    "ARZ": "ARI",
    "ATL": "ATL",
    "BAL": "BAL",
    "BLT": "BAL",
    "BUF": "BUF",
    "CAR": "CAR",
    "CHI": "CHI",
    "CIN": "CIN",
    "CLE": "CLE",
    "CLV": "CLE",
    "DAL": "DAL",
    "DEN": "DEN",
    "DET": "DET",
    "GB": "GB",
    "GNB": "GB",
    "HOU": "HOU",
    "HST": "HOU",
    "IND": "IND",
    "JAC": "JAX",
    "JAX": "JAX",
    "KC": "KC",
    "KAN": "KC",
    "LA": "LAR",
    "LAR": "LAR",
    "LV": "LV",
    "LVR": "LV",
    "OAK": "LV",
    "LAC": "LAC",
    "SD": "LAC",
    "MIA": "MIA",
    "MIN": "MIN",
    "NE": "NE",
    "NWE": "NE",
    "NO": "NO",
    "NOR": "NO",
    "NYG": "NYG",
    "NYJ": "NYJ",
    "PHI": "PHI",
    "PIT": "PIT",
    "SEA": "SEA",
    "SF": "SF",
    "SFO": "SF",
    "SL": "LAR",
    "STL": "LAR",
    "TB": "TB",
    "TAM": "TB",
    "TEN": "TEN",
    "WAS": "WAS",
    "WSH": "WAS",
    "WFT": "WAS",
}

POSITION_GROUPS = {
    "QB": "QB",
    "RB": "RB",
    "FB": "RB",
    "WR": "WR",
    "TE": "TE",
    "K": "ST",
    "P": "ST",
    "LS": "ST",
    "C": "OL",
    "G": "OL",
    "T": "OL",
    "OT": "OL",
    "OG": "OL",
    "OL": "OL",
    "DE": "DL",
    "DT": "DL",
    "DL": "DL",
    "NT": "DL",
    "EDGE": "DL",
    "LB": "LB",
    "ILB": "LB",
    "OLB": "LB",
    "MLB": "LB",
    "CB": "DB",
    "S": "DB",
    "SS": "DB",
    "FS": "DB",
    "DB": "DB",
}


@dataclass
class LoadResult:
    name: str
    records: list[dict[str, Any]]


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


def to_records(data: Any) -> list[dict[str, Any]]:
    if data is None:
        return []
    if isinstance(data, list):
        return [dict(row) for row in data]
    if hasattr(data, "to_dicts"):
        return [dict(row) for row in data.to_dicts()]
    if hasattr(data, "to_dict"):
        maybe = data.to_dict(orient="records")
        return [dict(row) for row in maybe]
    if hasattr(data, "to_pandas"):
        pandas_df = data.to_pandas()
        return pandas_df.to_dict(orient="records")
    raise TypeError(f"Unsupported dataset type: {type(data)!r}")


def clean_str(value: Any) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text or None


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


def safe_int(value: Any) -> int | None:
    if value in (None, "", "NA"):
        return None
    try:
        return int(float(value))
    except (TypeError, ValueError):
        return None


def safe_float(value: Any) -> float | None:
    if value in (None, "", "NA"):
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def pick(record: dict[str, Any], *keys: str) -> Any:
    for key in keys:
        if key in record and record[key] not in (None, ""):
            return record[key]
    return None


def season_kwargs(start_season: int, end_season: int) -> list[dict[str, Any]]:
    seasons = list(range(start_season, end_season + 1))
    return [
        {"seasons": seasons, "summary_level": "season"},
        {"seasons": seasons},
        {"years": seasons, "summary_level": "season"},
        {"years": seasons},
        {"season": seasons},
        {"start_season": start_season, "end_season": end_season},
    ]


def call_first_available(
    function_names: list[str], kwargs_candidates: list[dict[str, Any]], optional: bool = False
) -> LoadResult | None:
    for function_name in function_names:
        func = getattr(nfl, function_name, None)
        if func is None:
            continue
        for kwargs in kwargs_candidates:
            try:
                print(f"Loading {function_name} with {kwargs}...")
                return LoadResult(function_name, to_records(func(**kwargs)))
            except (TypeError, ValueError):
                continue
    if optional:
        return None
    raise SystemExit(
        f"Could not call any of {function_names}. Check your installed nflreadpy version."
    )


def canonical_team_abbr(value: Any) -> str | None:
    team = clean_str(value)
    if not team:
        return None
    return team.upper()


def canonical_franchise_abbr(team_abbr: str | None) -> str | None:
    if not team_abbr:
        return None
    return FRANCHISE_ALIASES.get(team_abbr.upper(), team_abbr.upper())


def position_group(position: str | None) -> str | None:
    if not position:
        return None
    return POSITION_GROUPS.get(position.upper(), position.upper())


def build_seasons(start_season: int, end_season: int) -> list[tuple[int, None, str, str]]:
    return [
        (
            season,
            None,
            f"{season}s" if season % 10 == 0 else f"{season} Season",
            f"{season} Season",
        )
        for season in range(start_season, end_season + 1)
    ]


def build_franchise_rows() -> list[tuple[str, str | None, str | None, str | None]]:
    seen: set[str] = set()
    rows: list[tuple[str, str | None, str | None, str | None]] = []
    for team_abbr, meta in TEAM_METADATA.items():
        canonical = canonical_franchise_abbr(team_abbr) or team_abbr
        if canonical in seen:
            continue
        seen.add(canonical)
        current_meta = TEAM_METADATA.get(canonical, meta)
        rows.append(
            (
                str(current_meta.get("team_name") or canonical),
                canonical,
                current_meta.get("conference"),
                current_meta.get("division"),
            )
        )
    return sorted(rows, key=lambda row: row[0])


def franchise_current_name_for_abbr(team_abbr: str) -> str:
    canonical = canonical_franchise_abbr(team_abbr) or team_abbr
    meta = TEAM_METADATA.get(canonical, {})
    return meta.get("team_name") or canonical


def fetch_franchise_map(conn: psycopg.Connection[Any]) -> dict[str, int]:
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT franchise_id, current_team_name
            FROM franchise_dim
            """
        )
        return {
            str(current_team_name): int(franchise_id)
            for franchise_id, current_team_name in cur.fetchall()
            if current_team_name
        }


def upsert_franchises(
    conn: psycopg.Connection[Any],
    rows: list[tuple[str, str | None, str | None, str | None]],
) -> None:
    with conn.cursor() as cur:
        cur.executemany(
            """
            INSERT INTO franchise_dim (
              current_team_name,
              current_team_abbr,
              conference,
              division
            )
            VALUES (%s, %s, %s, %s)
            ON CONFLICT (current_team_name)
            DO UPDATE SET
              current_team_abbr = EXCLUDED.current_team_abbr,
              conference = EXCLUDED.conference,
              division = EXCLUDED.division
            """,
            rows,
        )


def build_team_rows(
    roster_records: list[dict[str, Any]],
    stat_records: list[dict[str, Any]],
    franchise_id_map: dict[str, int],
) -> list[tuple[int, str, str | None, str | None, str | None, str | None, str | None, str | None]]:
    team_abbrs: set[str] = set()
    for record in roster_records + stat_records:
        team_abbr = canonical_team_abbr(pick(record, "team", "recent_team", "team_abbr", "posteam"))
        if team_abbr:
            team_abbrs.add(team_abbr)
    rows = []
    for team_abbr in sorted(team_abbrs):
        meta = TEAM_METADATA.get(team_abbr, {})
        if not meta:
            canonical = canonical_franchise_abbr(team_abbr)
            meta = TEAM_METADATA.get(canonical or "", {})
        franchise_name = franchise_current_name_for_abbr(team_abbr)
        franchise_id = franchise_id_map.get(franchise_name)
        if franchise_id is None:
            raise SystemExit(f"Missing franchise_dim row for current_team_name={franchise_name!r}")
        rows.append(
            (
                franchise_id,
                team_abbr,
                team_abbr,
                meta.get("team_name"),
                meta.get("nickname"),
                meta.get("city"),
                meta.get("conference"),
                meta.get("division"),
            )
        )
    return rows


def build_player_rows(
    stat_records: list[dict[str, Any]],
    roster_records: list[dict[str, Any]],
    draft_records: list[dict[str, Any]],
) -> list[
    tuple[
        str,
        str,
        str | None,
        str | None,
        str | None,
        int | None,
        str | None,
        str | None,
        int | None,
        int | None,
        bool,
    ]
]:
    players: dict[str, dict[str, Any]] = {}

    def touch_player(record: dict[str, Any]) -> None:
        external_player_id = clean_str(
            pick(record, "player_id", "gsis_id", "player_gsis_id", "nflverse_id")
        )
        player_name = clean_str(
            pick(record, "player_name", "display_name", "full_name", "name")
        )
        if not external_player_id or not player_name:
            return
        current = players.setdefault(
            external_player_id,
            {
                "external_player_id": external_player_id,
                "player_name": player_name,
                "primary_position": None,
                "college_name": None,
                "draft_round": None,
                "draft_year": None,
                "birth_date": None,
            },
        )
        current["player_name"] = player_name or current["player_name"]
        current["primary_position"] = clean_str(
            pick(record, "position", "pos", "primary_position")
        ) or current["primary_position"]
        current["college_name"] = clean_str(
            pick(record, "college_name", "college")
        ) or current["college_name"]
        current["draft_round"] = safe_int(
            pick(record, "draft_round", "round")
        ) or current["draft_round"]
        current["draft_year"] = safe_int(
            pick(record, "draft_year", "season", "year")
        ) or current["draft_year"]
        current["birth_date"] = clean_str(
            pick(record, "birth_date", "dob")
        ) or current["birth_date"]

    for record in stat_records:
        touch_player(record)
    for record in roster_records:
        touch_player(record)
    for record in draft_records:
        touch_player(record)

    deduped: dict[tuple[str, int | None], tuple[str, str, str | None, str | None, str | None, int | None, str | None, str | None, int | None, int | None, bool]] = {}
    for player in players.values():
        player_name = player["player_name"]
        birth_year = safe_int(player["birth_date"][:4]) if player["birth_date"] else None
        dedupe_key = (player_name, birth_year)
        deduped[dedupe_key] = (
            player["external_player_id"],
            player_name,
            clean_str(player_name.split(" ", 1)[0]) if player_name else None,
            clean_str(player_name.split(" ", 1)[1]) if player_name and " " in player_name else None,
            player["birth_date"],
            birth_year,
            player["primary_position"],
            player["college_name"],
            player["draft_round"],
            player["draft_year"],
            player["draft_round"] is None,
        )
    return list(deduped.values())


def build_history_rows(
    roster_records: list[dict[str, Any]],
    player_id_map: dict[str, int],
    team_id_map: dict[str, int],
    franchise_id_map: dict[str, int],
) -> list[
    tuple[
        int,
        int,
        int,
        int,
        str | None,
        str | None,
        str | None,
        int | None,
        int | None,
        bool,
        bool,
        bool,
        int | None,
        int | None,
    ]
]:
    rows: list[
        tuple[
            int,
            int,
            int,
            int,
            str | None,
            str | None,
            str | None,
            int | None,
            int | None,
            bool,
            bool,
            bool,
            int | None,
            int | None,
        ]
    ] = []
    seen: set[tuple[int, int, int]] = set()

    for record in roster_records:
        external_player_id = clean_str(
            pick(record, "player_id", "gsis_id", "player_gsis_id", "nflverse_id")
        )
        season = safe_int(pick(record, "season", "year"))
        team_abbr = canonical_team_abbr(pick(record, "team", "team_abbr", "recent_team"))
        if not external_player_id or season is None or not team_abbr:
            continue
        player_id = player_id_map.get(external_player_id)
        team_id = team_id_map.get(team_abbr)
        franchise_name = franchise_current_name_for_abbr(team_abbr)
        franchise_id = franchise_id_map.get(franchise_name)
        if not player_id or not team_id:
            continue
        if not franchise_id:
            continue
        dedupe_key = (player_id, season, team_id)
        if dedupe_key in seen:
            continue
        seen.add(dedupe_key)
        raw_position = clean_str(pick(record, "position", "pos"))
        years_in_league = safe_int(pick(record, "years_exp", "years_in_league"))
        rows.append(
            (
                player_id,
                season,
                team_id,
                franchise_id,
                raw_position,
                raw_position,
                position_group(raw_position),
                safe_int(pick(record, "games", "games_played")),
                safe_int(pick(record, "games_started", "gs")),
                True,
                False,
                years_in_league == 0 if years_in_league is not None else False,
                years_in_league,
                safe_int(pick(record, "age", "player_age")),
            )
        )
    return rows


def build_stat_rows(
    stat_records: list[dict[str, Any]],
    player_id_map: dict[str, int],
    team_id_map: dict[str, int],
) -> list[tuple[int, int, int | None, int | None, float | None, float | None, float | None, float | None, float | None, float | None, float | None, float | None]]:
    aggregates: dict[tuple[int, int, int | None], dict[str, Any]] = defaultdict(
        lambda: {
            "games": 0,
            "passing_yards": 0.0,
            "passing_td": 0.0,
            "rushing_yards": 0.0,
            "rushing_td": 0.0,
            "receiving_yards": 0.0,
            "receiving_td": 0.0,
            "receptions": 0.0,
            "fantasy_points_ppr": 0.0,
        }
    )

    for record in stat_records:
        external_player_id = clean_str(
            pick(record, "player_id", "gsis_id", "player_gsis_id", "nflverse_id")
        )
        season = safe_int(pick(record, "season", "year"))
        if not external_player_id or season is None:
            continue
        player_id = player_id_map.get(external_player_id)
        team_abbr = canonical_team_abbr(pick(record, "team", "recent_team", "team_abbr", "posteam"))
        team_id = team_id_map.get(team_abbr) if team_abbr else None
        if not player_id:
            continue
        bucket = aggregates[(player_id, season, team_id)]
        bucket["games"] += safe_int(pick(record, "games", "g")) or 0
        bucket["passing_yards"] += safe_float(pick(record, "passing_yards", "pass_yds")) or 0.0
        bucket["passing_td"] += safe_float(pick(record, "passing_tds", "passing_td", "pass_tds")) or 0.0
        bucket["rushing_yards"] += safe_float(pick(record, "rushing_yards", "rush_yds")) or 0.0
        bucket["rushing_td"] += safe_float(pick(record, "rushing_tds", "rushing_td", "rush_tds")) or 0.0
        bucket["receiving_yards"] += safe_float(pick(record, "receiving_yards", "rec_yds")) or 0.0
        bucket["receiving_td"] += safe_float(pick(record, "receiving_tds", "receiving_td", "rec_tds")) or 0.0
        bucket["receptions"] += safe_float(pick(record, "receptions", "rec")) or 0.0
        bucket["fantasy_points_ppr"] += safe_float(
            pick(record, "fantasy_points_ppr", "fantasy_points")
        ) or 0.0

    return [
        (
            player_id,
            season,
            team_id,
            values["games"] or None,
            values["passing_yards"] or None,
            values["passing_td"] or None,
            values["rushing_yards"] or None,
            values["rushing_td"] or None,
            values["receiving_yards"] or None,
            values["receiving_td"] or None,
            values["receptions"] or None,
            values["fantasy_points_ppr"] or None,
        )
        for (player_id, season, team_id), values in aggregates.items()
    ]


def execute_schema(conn: psycopg.Connection[Any]) -> None:
    for sql_file in sorted(SCHEMA_DIR.glob("*.sql")):
        print(f"Applying schema file: {sql_file.name}")
        conn.execute(sql_file.read_text(encoding="utf-8"))


def upsert_seasons(conn: psycopg.Connection[Any], rows: list[tuple[int, None, str, str]]) -> None:
    with conn.cursor() as cur:
        cur.executemany(
            """
            INSERT INTO season_dim (season, season_start_date, era_label, season_label)
            VALUES (%s, %s, %s, %s)
            ON CONFLICT (season)
            DO UPDATE SET
              season_start_date = COALESCE(EXCLUDED.season_start_date, season_dim.season_start_date),
              era_label = COALESCE(EXCLUDED.era_label, season_dim.era_label),
              season_label = COALESCE(EXCLUDED.season_label, season_dim.season_label)
            """,
            rows,
        )


def upsert_teams(
    conn: psycopg.Connection[Any],
    rows: list[tuple[int, str, str | None, str | None, str | None, str | None, str | None, str | None]],
) -> None:
    with conn.cursor() as cur:
        cur.executemany(
            """
            INSERT INTO team_dim (
              franchise_id,
              team_abbr,
              external_team_id,
              team_name,
              nickname,
              city,
              conference,
              division
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (team_abbr)
            DO UPDATE SET
              franchise_id = EXCLUDED.franchise_id,
              external_team_id = EXCLUDED.external_team_id,
              team_name = EXCLUDED.team_name,
              nickname = EXCLUDED.nickname,
              city = EXCLUDED.city,
              conference = EXCLUDED.conference,
              division = EXCLUDED.division
            """,
            rows,
        )


def upsert_players(
    conn: psycopg.Connection[Any],
    rows: list[
        tuple[
            str,
            str,
            str | None,
            str | None,
            str | None,
            int | None,
            str | None,
            str | None,
            int | None,
            int | None,
            bool,
        ]
    ],
) -> None:
    with conn.cursor() as cur:
        for row in rows:
            (
                external_player_id,
                player_name,
                first_name,
                last_name,
                birth_date,
                birth_year,
                primary_position,
                college_name,
                draft_round,
                draft_year,
                undrafted_flag,
            ) = row

            cur.execute(
                """
                UPDATE player_dim
                SET
                  external_player_id = COALESCE(%s, external_player_id),
                  player_name = %s,
                  first_name = COALESCE(%s, first_name),
                  last_name = COALESCE(%s, last_name),
                  birth_date = COALESCE(%s, birth_date),
                  birth_year = COALESCE(%s, birth_year),
                  primary_position = COALESCE(%s, primary_position),
                  college_name = COALESCE(%s, college_name),
                  draft_round = COALESCE(%s, draft_round),
                  draft_year = COALESCE(%s, draft_year),
                  undrafted_flag = %s
                WHERE
                  (external_player_id IS NOT NULL AND external_player_id = %s)
                  OR (player_name = %s AND birth_year IS NOT DISTINCT FROM %s)
                """,
                (
                    external_player_id,
                    player_name,
                    first_name,
                    last_name,
                    birth_date,
                    birth_year,
                    primary_position,
                    college_name,
                    draft_round,
                    draft_year,
                    undrafted_flag,
                    external_player_id,
                    player_name,
                    birth_year,
                ),
            )

            if cur.rowcount == 0:
                cur.execute(
                    """
                    INSERT INTO player_dim (
                      external_player_id,
                      player_name,
                      first_name,
                      last_name,
                      birth_date,
                      birth_year,
                      primary_position,
                      college_name,
                      draft_round,
                      draft_year,
                      undrafted_flag
                    )
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    """,
                    row,
                )


def fetch_lookup_map(conn: psycopg.Connection[Any], table: str, key_column: str, value_column: str) -> dict[str, int]:
    query = f"SELECT {key_column}, {value_column} FROM {table} WHERE {key_column} IS NOT NULL"
    with conn.cursor() as cur:
        cur.execute(query)
        return {str(key): int(value) for key, value in cur.fetchall()}


def replace_history_rows(
    conn: psycopg.Connection[Any],
    start_season: int,
    end_season: int,
    rows: list[
        tuple[
            int,
            int,
            int,
            int,
            str | None,
            str | None,
            str | None,
            int | None,
            int | None,
            bool,
            bool,
            bool,
            int | None,
            int | None,
        ]
    ],
) -> None:
    with conn.cursor() as cur:
        cur.execute(
            """
            DELETE FROM player_team_history
            WHERE season BETWEEN %s AND %s
            """,
            (start_season, end_season),
        )
        cur.executemany(
            """
            INSERT INTO player_team_history (
              player_id,
              season,
              team_id,
              franchise_id,
              raw_position,
              normalized_position,
              position_group,
              games_played,
              games_started,
              active_roster_flag,
              playoff_roster_flag,
              rookie_season_flag,
              years_in_league,
              age_that_season
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (player_id, season, team_id)
            DO UPDATE SET
              franchise_id = EXCLUDED.franchise_id,
              raw_position = EXCLUDED.raw_position,
              normalized_position = EXCLUDED.normalized_position,
              position_group = EXCLUDED.position_group,
              games_played = EXCLUDED.games_played,
              games_started = EXCLUDED.games_started,
              active_roster_flag = EXCLUDED.active_roster_flag,
              playoff_roster_flag = EXCLUDED.playoff_roster_flag,
              rookie_season_flag = EXCLUDED.rookie_season_flag,
              years_in_league = EXCLUDED.years_in_league,
              age_that_season = EXCLUDED.age_that_season
            """,
            rows,
        )


def replace_stat_rows(
    conn: psycopg.Connection[Any],
    start_season: int,
    end_season: int,
    rows: list[tuple[int, int, int | None, int | None, float | None, float | None, float | None, float | None, float | None, float | None, float | None, float | None]],
) -> None:
    with conn.cursor() as cur:
        cur.execute(
            """
            DELETE FROM player_season_stats
            WHERE season BETWEEN %s AND %s
            """,
            (start_season, end_season),
        )
        cur.executemany(
            """
            INSERT INTO player_season_stats (
              player_id,
              season,
              team_id,
              stat_scope,
              games_played,
              passing_yards,
              passing_td,
              rushing_yards,
              rushing_td,
              receiving_yards,
              receiving_td,
              receptions,
              fantasy_points_ppr
            )
            VALUES (%s, %s, %s, 'REGULAR', %s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (player_id, season, team_id)
            DO UPDATE SET
              stat_scope = EXCLUDED.stat_scope,
              games_played = EXCLUDED.games_played,
              passing_yards = EXCLUDED.passing_yards,
              passing_td = EXCLUDED.passing_td,
              rushing_yards = EXCLUDED.rushing_yards,
              rushing_td = EXCLUDED.rushing_td,
              receiving_yards = EXCLUDED.receiving_yards,
              receiving_td = EXCLUDED.receiving_td,
              receptions = EXCLUDED.receptions,
              fantasy_points_ppr = EXCLUDED.fantasy_points_ppr
            """,
            rows,
        )


def sync_player_college_history(conn: psycopg.Connection[Any]) -> None:
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

        if rows_to_insert:
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


def full_refresh_core_tables(conn: psycopg.Connection[Any]) -> None:
    conn.execute(
        """
        TRUNCATE TABLE
          player_pair_relationships,
          player_season_stats,
          player_team_history,
          player_dim,
          team_dim,
          franchise_dim,
          season_dim
        RESTART IDENTITY CASCADE
        """
    )


def refresh_career_bounds(conn: psycopg.Connection[Any]) -> None:
    conn.execute(
        """
        WITH bounds AS (
          SELECT
            player_id,
            MIN(season) AS min_season,
            MAX(season) AS max_season
          FROM player_season_stats
          GROUP BY player_id
        )
        UPDATE player_dim p
        SET
          career_start_season = b.min_season,
          career_end_season = b.max_season
        FROM bounds b
        WHERE p.player_id = b.player_id
        """
    )


def chunked(values: list[tuple[int, int, bool, int, bool, int, bool, bool]], size: int) -> list[list[tuple[int, int, bool, int, bool, int, bool, bool]]]:
    return [values[index : index + size] for index in range(0, len(values), size)]


def rebuild_pair_relationships(conn: psycopg.Connection[Any]) -> None:
    pair_map: dict[tuple[int, int], dict[str, int | bool]] = {}

    def ensure_pair(player_a: int, player_b: int) -> dict[str, int | bool]:
        player_id_1, player_id_2 = sorted((player_a, player_b))
        return pair_map.setdefault(
            (player_id_1, player_id_2),
            {
                "were_teammates_flag": False,
                "teammate_seasons_count": 0,
                "same_franchise_flag": False,
                "shared_team_count": 0,
                "same_college_flag": False,
                "same_draft_class_flag": False,
            },
        )

    with conn.cursor() as cur:
        cur.execute("TRUNCATE TABLE player_pair_relationships")

        cur.execute(
            """
            SELECT season, team_id, ARRAY_AGG(player_id ORDER BY player_id)
            FROM player_team_history
            GROUP BY season, team_id
            HAVING COUNT(*) > 1
            """
        )
        for _season, _team_id, player_ids in cur.fetchall():
            unique_ids = sorted(set(player_ids))
            for player_a, player_b in combinations(unique_ids, 2):
                pair = ensure_pair(int(player_a), int(player_b))
                pair["were_teammates_flag"] = True
                pair["teammate_seasons_count"] = int(pair["teammate_seasons_count"]) + 1

        cur.execute(
            """
            SELECT team_id, ARRAY_AGG(player_id ORDER BY player_id)
            FROM (
              SELECT DISTINCT team_id, player_id
              FROM player_team_history
            ) history
            GROUP BY team_id
            HAVING COUNT(*) > 1
            """
        )
        for _team_id, player_ids in cur.fetchall():
            unique_ids = sorted(set(player_ids))
            for player_a, player_b in combinations(unique_ids, 2):
                pair = ensure_pair(int(player_a), int(player_b))
                pair["shared_team_count"] = int(pair["shared_team_count"]) + 1

        cur.execute(
            """
            SELECT franchise_id, ARRAY_AGG(player_id ORDER BY player_id)
            FROM (
              SELECT DISTINCT franchise_id, player_id
              FROM player_team_history
              WHERE franchise_id IS NOT NULL
            ) history
            GROUP BY franchise_id
            HAVING COUNT(*) > 1
            """
        )
        for _franchise_id, player_ids in cur.fetchall():
            unique_ids = sorted(set(player_ids))
            for player_a, player_b in combinations(unique_ids, 2):
                pair = ensure_pair(int(player_a), int(player_b))
                pair["same_franchise_flag"] = True

        cur.execute(
            """
            SELECT college_name, ARRAY_AGG(player_id ORDER BY player_id)
            FROM player_dim
            WHERE college_name IS NOT NULL
            GROUP BY college_name
            HAVING COUNT(*) > 1
            """
        )
        for _college_name, player_ids in cur.fetchall():
            unique_ids = sorted(set(player_ids))
            for player_a, player_b in combinations(unique_ids, 2):
                pair = ensure_pair(int(player_a), int(player_b))
                pair["same_college_flag"] = True

        cur.execute(
            """
            SELECT draft_year, ARRAY_AGG(player_id ORDER BY player_id)
            FROM player_dim
            WHERE draft_year IS NOT NULL
            GROUP BY draft_year
            HAVING COUNT(*) > 1
            """
        )
        for _draft_year, player_ids in cur.fetchall():
            unique_ids = sorted(set(player_ids))
            for player_a, player_b in combinations(unique_ids, 2):
                pair = ensure_pair(int(player_a), int(player_b))
                pair["same_draft_class_flag"] = True

        rows = [
            (
                player_id_1,
                player_id_2,
                bool(values["were_teammates_flag"]),
                int(values["teammate_seasons_count"]),
                bool(values["same_franchise_flag"]),
                int(values["shared_team_count"]),
                bool(values["same_college_flag"]),
                bool(values["same_draft_class_flag"]),
            )
            for (player_id_1, player_id_2), values in pair_map.items()
        ]

        for batch in chunked(rows, 5000):
            cur.executemany(
                """
                INSERT INTO player_pair_relationships (
                  player_id_1,
                  player_id_2,
                  were_teammates_flag,
                  teammate_seasons_count,
                  same_franchise_flag,
                  shared_team_count,
                  same_college_flag,
                  same_draft_class_flag
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                """,
                batch,
            )


def main() -> None:
    parser = argparse.ArgumentParser(description="Load nflreadpy data into the app Postgres tables.")
    parser.add_argument("--start-season", type=int, default=2000)
    parser.add_argument("--end-season", type=int, default=2025)
    parser.add_argument("--schema-only", action="store_true")
    parser.add_argument("--skip-pairs", action="store_true")
    parser.add_argument("--full-refresh", action="store_true")
    parser.add_argument("--pairs-only", action="store_true")
    args = parser.parse_args()

    if args.start_season > args.end_season:
        raise SystemExit("--start-season must be less than or equal to --end-season")

    stats: LoadResult | None = None
    rosters: LoadResult | None = None
    draft_records: list[dict[str, Any]] = []

    needs_source_data = not args.schema_only and not args.pairs_only

    if needs_source_data:
        stats = call_first_available(
            ["load_seasonal_player_stats", "load_seasonal_stats", "load_player_stats"],
            season_kwargs(args.start_season, args.end_season),
        )
        rosters = call_first_available(
            ["load_rosters", "load_seasonal_rosters", "load_roster"],
            season_kwargs(args.start_season, args.end_season),
        )
        draft = call_first_available(
            ["load_draft_picks", "load_draft"],
            season_kwargs(args.start_season, args.end_season) + [{}],
            optional=True,
        )

        draft_records = draft.records if draft else []

    with psycopg.connect(db_dsn()) as conn:
        execute_schema(conn)
        if args.schema_only:
            conn.commit()
            print("Schema created.")
            return

        if args.full_refresh:
            print("Performing full refresh of core NFL data tables...")
            full_refresh_core_tables(conn)

        player_id_map: dict[str, int] = {}
        history_rows: list[Any] = []
        stat_rows: list[Any] = []

        if needs_source_data:
            assert stats is not None
            assert rosters is not None

            upsert_seasons(conn, build_seasons(args.start_season, args.end_season))
            upsert_franchises(conn, build_franchise_rows())
            franchise_id_map = fetch_franchise_map(conn)
            upsert_teams(conn, build_team_rows(rosters.records, stats.records, franchise_id_map))
            upsert_players(conn, build_player_rows(stats.records, rosters.records, draft_records))
            sync_player_college_history(conn)

            player_id_map = fetch_lookup_map(conn, "player_dim", "external_player_id", "player_id")
            team_id_map = fetch_lookup_map(conn, "team_dim", "team_abbr", "team_id")

            history_rows = build_history_rows(rosters.records, player_id_map, team_id_map, franchise_id_map)
            stat_rows = build_stat_rows(stats.records, player_id_map, team_id_map)

            replace_history_rows(conn, args.start_season, args.end_season, history_rows)
            replace_stat_rows(conn, args.start_season, args.end_season, stat_rows)
            refresh_career_bounds(conn)

        if not args.skip_pairs:
            rebuild_pair_relationships(conn)

        conn.commit()

    if args.pairs_only:
        print("Rebuilt player_pair_relationships from existing database tables.")
    else:
        print(
            f"Loaded seasons {args.start_season}-{args.end_season}: "
            f"{len(player_id_map)} players, {len(history_rows)} roster rows, {len(stat_rows)} stat rows."
        )


if __name__ == "__main__":
    main()

import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { requireTestingAdmin } from "@/lib/testing";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    let testingMode = false;
    try {
      testingMode = await requireTestingAdmin(request);
    } catch {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const requestedDate = request.nextUrl.searchParams.get("date");
    const puzzleResult = requestedDate
      ? await pool.query(
          `
          SELECT puzzle_id, theme_filter_id, eligibility_filter_id
          FROM daily_puzzle
          WHERE puzzle_date = $1
            AND sport = 'nfl'
            ${
              testingMode
                ? ""
                : "AND puzzle_date <= ((NOW() AT TIME ZONE 'America/Chicago')::date)"
            }
          LIMIT 1
          `,
          [requestedDate]
        )
      : await pool.query(`
          SELECT puzzle_id, theme_filter_id, eligibility_filter_id
          FROM daily_puzzle
          WHERE published_flag = true
            AND sport = 'nfl'
            AND puzzle_date <= ((NOW() AT TIME ZONE 'America/Chicago')::date)
          ORDER BY puzzle_date DESC
          LIMIT 1
        `);

    const puzzle = puzzleResult.rows[0];

    if (!puzzle) {
      return NextResponse.json(
        { error: "No published puzzle found" },
        { status: 404 }
      );
    }

    const themeResult = await pool.query(
      `
      SELECT filter_id, filter_name, display_name, filter_category, rule_logic_key
      FROM filter_definition
      WHERE filter_id = $1
      `,
      [puzzle.theme_filter_id]
    );

    const theme = themeResult.rows[0] ?? null;

    const result = await pool.query(
      `
      WITH themed_seasons AS (
        SELECT s.season
        FROM season_dim s
        WHERE
          CASE
            WHEN $1 ~ '^decade:\\d{4}s$'
              THEN s.season BETWEEN
                   SUBSTRING($1 FROM '(\\d{4})')::int
                   AND SUBSTRING($1 FROM '(\\d{4})')::int + 9
            WHEN $1 ~ '^season_range:\\d{4}-\\d{4}$'
              THEN s.season BETWEEN
                   SUBSTRING($1 FROM '(\\d{4})')::int
                   AND SUBSTRING($1 FROM '-(\\d{4})$')::int
            WHEN $1 ~ '^season:\\d{4}$'
              THEN s.season = SUBSTRING($1 FROM '(\\d{4})')::int
            WHEN $1 = 'seasons_2010s' THEN s.season BETWEEN 2010 AND 2019
            WHEN $1 = 'seasons_2000s' THEN s.season BETWEEN 2000 AND 2009
            WHEN $1 = 'seasons_2010_2015' THEN s.season BETWEEN 2010 AND 2015
            WHEN $1 = 'seasons_2020_2025' THEN s.season BETWEEN 2020 AND 2025
            WHEN $1 = 'season_2012' THEN s.season = 2012
            ELSE true
          END
      ),
      eligible_players AS (
        SELECT
          p.player_id
        FROM player_dim p
        LEFT JOIN player_team_history pth
          ON p.player_id = pth.player_id
        WHERE p.primary_position IN ('QB', 'RB', 'WR', 'TE')
        GROUP BY
          p.player_id,
          p.career_start_season,
          p.career_end_season
        HAVING
          CASE
            WHEN $2 = 'played_for_4_plus_teams'
              THEN COUNT(DISTINCT COALESCE(pth.franchise_id, pth.team_id)) >= 4
            WHEN $2 = 'played_for_3_plus_teams'
              THEN COUNT(DISTINCT COALESCE(pth.franchise_id, pth.team_id)) >= 3
            WHEN $2 = 'played_for_2_plus_teams'
              THEN COUNT(DISTINCT COALESCE(pth.franchise_id, pth.team_id)) >= 2
            WHEN $2 = 'played_2_plus_seasons'
              THEN COALESCE(p.career_end_season, p.career_start_season)
                   - COALESCE(p.career_start_season, p.career_end_season)
                   + 1 >= 2
            WHEN $2 = 'played_5_plus_seasons'
              THEN COALESCE(p.career_end_season, p.career_start_season)
                   - COALESCE(p.career_start_season, p.career_end_season)
                   + 1 >= 5
            WHEN $2 = 'played_8_plus_seasons'
              THEN COALESCE(p.career_end_season, p.career_start_season)
                   - COALESCE(p.career_start_season, p.career_end_season)
                   + 1 >= 8
            WHEN $2 = 'active_players'
              THEN COALESCE(p.career_end_season, 0) >= 2025
            WHEN $2 = 'retired_players'
              THEN COALESCE(p.career_end_season, 9999) < 2025
            WHEN $2 = 'undrafted_players'
              THEN COALESCE(p.undrafted_flag, false) = true
            WHEN $2 = 'first_round_players'
              THEN p.draft_round = 1
            ELSE true
          END
      ),
      player_theme_stats AS (
        SELECT
          ps.player_id,
          MIN(ps.season) AS theme_start_season,
          MAX(ps.season) AS theme_end_season,
          COUNT(DISTINCT ps.season) AS eligible_season_count,
          SUM(
            COALESCE(ps.passing_yards, 0) / 25.0 +
            COALESCE(ps.passing_td, 0) * 4.0 +
            COALESCE(ps.rushing_yards, 0) / 10.0 +
            COALESCE(ps.rushing_td, 0) * 6.0 +
            COALESCE(ps.receiving_yards, 0) / 10.0 +
            COALESCE(ps.receiving_td, 0) * 6.0 +
            COALESCE(ps.receptions, 0) * 1.0
          )::numeric(12,2) AS fantasy_points
        FROM player_season_stats ps
        JOIN themed_seasons ts
          ON ps.season = ts.season
        JOIN eligible_players ep
          ON ps.player_id = ep.player_id
        GROUP BY ps.player_id
      ),
      player_flags AS (
        SELECT
          p.player_id,
          MAX(
            CASE
              WHEN t.conference = 'AFC' AND t.division = 'West' THEN 1
              ELSE 0
            END
          ) AS played_afc_west_flag,
          MAX(
            CASE
              WHEN t.team_abbr = 'TEN'
                OR t.team_name ILIKE '%Titans%'
                OR t.nickname ILIKE '%Titans%'
              THEN 1
              ELSE 0
            END
          ) AS played_titans_flag,
          MAX(
            CASE
              WHEN pth.age_that_season >= 33 THEN 1
              ELSE 0
            END
          ) AS played_until_33_flag
        FROM player_dim p
        JOIN eligible_players ep
          ON p.player_id = ep.player_id
        LEFT JOIN player_team_history pth
          ON p.player_id = pth.player_id
        LEFT JOIN team_dim t
          ON pth.team_id = t.team_id
        GROUP BY p.player_id
      ),
      player_slot_traits AS (
        SELECT
          p.player_id,
          ARRAY_REMOVE(
            ARRAY_AGG(DISTINCT t.team_abbr)
              FILTER (WHERE t.team_abbr IS NOT NULL),
            NULL
          ) AS theme_team_abbrs,
          ARRAY_REMOVE(
            ARRAY_AGG(DISTINCT t.conference)
              FILTER (WHERE t.conference IS NOT NULL),
            NULL
          ) AS theme_conferences,
          ARRAY_REMOVE(
            ARRAY_AGG(DISTINCT CONCAT_WS(' ', t.conference, t.division))
              FILTER (
                WHERE t.conference IS NOT NULL
                  AND t.division IS NOT NULL
              ),
            NULL
          ) AS theme_divisions
        FROM player_dim p
        JOIN eligible_players ep
          ON p.player_id = ep.player_id
        LEFT JOIN player_team_history pth
          ON p.player_id = pth.player_id
        LEFT JOIN team_dim t
          ON pth.team_id = t.team_id
        GROUP BY p.player_id
      ),
      player_college_traits AS (
        SELECT
          pch.player_id,
          ARRAY_REMOVE(
            ARRAY_AGG(DISTINCT pch.college_name),
            NULL
          ) AS player_colleges
        FROM player_college_history pch
        GROUP BY pch.player_id
      )
      SELECT
        p.player_id,
        p.player_name,
        p.primary_position,
        p.draft_round,
        p.draft_pick,
        p.height_inches,
        p.weight_lbs,
        p.multi_college_flag,
        p.super_bowl_win_count,
        p.super_bowl_winner_flag,
        p.career_start_season,
        p.career_end_season,
        pts.theme_start_season,
        pts.theme_end_season,
        pts.eligible_season_count,
        pts.fantasy_points,
        p.headshot_url,
        COALESCE(pct.player_colleges, ARRAY[]::text[]) AS player_colleges,
        COALESCE(pst.theme_team_abbrs, ARRAY[]::text[]) AS theme_team_abbrs,
        COALESCE(pst.theme_conferences, ARRAY[]::text[]) AS theme_conferences,
        COALESCE(pst.theme_divisions, ARRAY[]::text[]) AS theme_divisions,
        COALESCE(pf.played_afc_west_flag, 0) AS played_afc_west_flag,
        COALESCE(pf.played_titans_flag, 0) AS played_titans_flag,
        COALESCE(pf.played_until_33_flag, 0) AS played_until_33_flag
      FROM player_theme_stats pts
      JOIN player_dim p
        ON pts.player_id = p.player_id
      LEFT JOIN player_flags pf
        ON p.player_id = pf.player_id
      LEFT JOIN player_slot_traits pst
        ON p.player_id = pst.player_id
      LEFT JOIN player_college_traits pct
        ON p.player_id = pct.player_id
      ORDER BY pts.fantasy_points DESC, p.player_name
      `,
      [
        theme?.rule_logic_key ?? "seasons_2020_2025",
        "",
      ]
    );

    return NextResponse.json({
      theme,
      eligibility_filter: null,
      players: result.rows,
    });
  } catch (error) {
    console.error("Player route failed:", error);

    return NextResponse.json(
      { error: "Failed to load players" },
      { status: 500 }
    );
  }
}

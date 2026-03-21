import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { ensureTestingSubmissionTables, requireTestingAdmin } from "@/lib/testing";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type SlotRule = {
  slot_number: number;
  display_text: string;
};

function getThemeSeasonSql() {
  return `
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
  `;
}

export async function GET(request: NextRequest) {
  try {
    let testingMode = false;
    try {
      testingMode = await requireTestingAdmin(request);
    } catch {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (testingMode) {
      await ensureTestingSubmissionTables(pool);
    }

    const requestedDate = request.nextUrl.searchParams.get("date");
    const puzzleResult = requestedDate
      ? await pool.query(
          `
          SELECT puzzle_id, puzzle_date, theme_filter_id
          FROM daily_puzzle
          WHERE puzzle_date = $1
            AND sport = 'nfl'
            ${testingMode ? "" : "AND puzzle_date <= ((NOW() AT TIME ZONE 'America/Chicago')::date)"}
          LIMIT 1
          `,
          [requestedDate]
        )
      : await pool.query(`
          SELECT puzzle_id, puzzle_date, theme_filter_id
          FROM daily_puzzle
          WHERE published_flag = true
            AND sport = 'nfl'
            AND puzzle_date <= ((NOW() AT TIME ZONE 'America/Chicago')::date)
          ORDER BY puzzle_date DESC
          LIMIT 1
        `);

    const puzzle = puzzleResult.rows[0];
    if (!puzzle) {
      return NextResponse.json({ error: "No puzzle found" }, { status: 404 });
    }

    const [themeResult, slotRulesResult, leaderResult] = await Promise.all([
      pool.query(
        `
        SELECT rule_logic_key
        FROM filter_definition
        WHERE filter_id = $1
        `,
        [puzzle.theme_filter_id]
      ),
      pool.query<SlotRule>(
        `
        SELECT dpsr.slot_number, srd.display_text
        FROM daily_puzzle_slot_rule dpsr
        JOIN slot_rule_definition srd
          ON dpsr.slot_rule_id = srd.slot_rule_id
        WHERE dpsr.puzzle_id = $1
        ORDER BY dpsr.slot_number
        `,
        [puzzle.puzzle_id]
      ),
      pool.query(
        `
        SELECT
          ${testingMode ? "ps.testing_submission_id" : "ps.submission_id"} AS submission_id,
          COALESCE(au.username, ps.display_name) AS display_name,
          ps.base_score,
          ps.active_links,
          ps.multiplier,
          ps.final_score,
          ps.submitted_at
        FROM ${testingMode ? "testing_submission" : "puzzle_submission"} ps
        LEFT JOIN app_user au
          ON ps.user_id = au.user_id
        WHERE ps.puzzle_id = $1
          ${testingMode ? "" : "AND (ps.submitted_at AT TIME ZONE 'America/Chicago')::date = $2::date"}
        ORDER BY ps.final_score DESC, ps.submitted_at ASC
        LIMIT 1
        `,
        testingMode ? [puzzle.puzzle_id] : [puzzle.puzzle_id, puzzle.puzzle_date]
      ),
    ]);

    const leader = leaderResult.rows[0];
    if (!leader) {
      return NextResponse.json({ error: "No leaderboard entries yet." }, { status: 404 });
    }

    const lineupRows = await pool.query<{ slot_number: number; player_id: string }>(
      `
      SELECT slot_number, player_id::text
      FROM ${testingMode ? "testing_submission_player" : "puzzle_submission_player"}
      WHERE ${testingMode ? "testing_submission_id" : "submission_id"} = $1
      ORDER BY slot_number
      `,
      [Number(leader.submission_id)]
    );

    const playerIds = lineupRows.rows.map((row) => Number(row.player_id)).filter((id) => id > 0);
    if (playerIds.length === 0) {
      return NextResponse.json({ error: "Leader lineup unavailable." }, { status: 404 });
    }

    const themeRule = themeResult.rows[0]?.rule_logic_key ?? "seasons_2020_2025";
    const playerResult = await pool.query(
      `
      WITH themed_seasons AS (
        SELECT s.season
        FROM season_dim s
        WHERE ${getThemeSeasonSql()}
      ),
      player_theme_stats AS (
        SELECT
          ps.player_id,
          MIN(ps.season) AS theme_start_season,
          MAX(ps.season) AS theme_end_season,
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
        WHERE ps.player_id = ANY($2::bigint[])
        GROUP BY ps.player_id
      )
      SELECT
        p.player_id::text,
        p.player_name,
        p.primary_position,
        p.career_start_season,
        p.career_end_season,
        pts.theme_start_season,
        pts.theme_end_season,
        pts.fantasy_points::float8 AS fantasy_points,
        p.headshot_url
      FROM player_dim p
      LEFT JOIN player_theme_stats pts
        ON p.player_id = pts.player_id
      WHERE p.player_id = ANY($2::bigint[])
      `,
      [themeRule, playerIds]
    );

    const playerMap = new Map(
      playerResult.rows.map((row) => [String(row.player_id), row])
    );
    const slotRuleMap = new Map(
      slotRulesResult.rows.map((row) => [Number(row.slot_number), row])
    );

    return NextResponse.json({
      puzzle_date: String(puzzle.puzzle_date).slice(0, 10),
      leader: {
        submission_id: Number(leader.submission_id),
        display_name: String(leader.display_name),
        base_score: Number(leader.base_score),
        active_links: Number(leader.active_links),
        multiplier: Number(leader.multiplier),
        final_score: Number(leader.final_score),
        submitted_at: leader.submitted_at,
      },
      lineup: lineupRows.rows
        .map((row) => {
          const player = playerMap.get(String(row.player_id));
          const slotRule = slotRuleMap.get(Number(row.slot_number));
          if (!player || !slotRule) {
            return null;
          }

          return {
            slot_number: Number(row.slot_number),
            slot_rule: slotRule,
            player,
          };
        })
        .filter(Boolean),
    });
  } catch (error) {
    console.error("Current leader lineup route failed:", error);
    return NextResponse.json(
      { error: "Failed to load current leader lineup." },
      { status: 500 }
    );
  }
}

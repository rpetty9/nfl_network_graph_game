import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    const requestedDate = request.nextUrl.searchParams.get("date");
    const ids = request.nextUrl.searchParams
      .getAll("playerId")
      .map((value) => Number(value))
      .filter((value) => Number.isInteger(value) && value > 0);

    const playerIds = Array.from(new Set(ids));

    if (playerIds.length < 2) {
      return NextResponse.json({ pair_relationships: [] });
    }

    const puzzleResult = requestedDate
      ? await pool.query(
          `
          SELECT theme_filter_id
          FROM daily_puzzle
          WHERE puzzle_date = $1
            AND sport = 'nfl'
          LIMIT 1
          `,
          [requestedDate]
        )
      : await pool.query(`
          SELECT theme_filter_id
          FROM daily_puzzle
          WHERE published_flag = true
            AND sport = 'nfl'
          ORDER BY puzzle_date DESC
          LIMIT 1
        `);

    const puzzle = puzzleResult.rows[0];
    const themeResult =
      puzzle?.theme_filter_id != null
        ? await pool.query(
            `
            SELECT rule_logic_key
            FROM filter_definition
            WHERE filter_id = $1
            `,
            [puzzle.theme_filter_id]
          )
        : { rows: [] };

    const themeRule = themeResult.rows[0]?.rule_logic_key ?? "seasons_2020_2025";

    const pairResult = await pool.query(
      `
      WITH themed_seasons AS (
        SELECT s.season
        FROM season_dim s
        WHERE
          CASE
            WHEN $2 ~ '^decade:\\d{4}s$'
              THEN s.season BETWEEN
                   SUBSTRING($2 FROM '(\\d{4})')::int
                   AND SUBSTRING($2 FROM '(\\d{4})')::int + 9
            WHEN $2 ~ '^season_range:\\d{4}-\\d{4}$'
              THEN s.season BETWEEN
                   SUBSTRING($2 FROM '(\\d{4})')::int
                   AND SUBSTRING($2 FROM '-(\\d{4})$')::int
            WHEN $2 ~ '^season:\\d{4}$'
              THEN s.season = SUBSTRING($2 FROM '(\\d{4})')::int
            WHEN $2 = 'seasons_2010s' THEN s.season BETWEEN 2010 AND 2019
            WHEN $2 = 'seasons_2000s' THEN s.season BETWEEN 2000 AND 2009
            WHEN $2 = 'seasons_2010_2015' THEN s.season BETWEEN 2010 AND 2015
            WHEN $2 = 'seasons_2020_2025' THEN s.season BETWEEN 2020 AND 2025
            WHEN $2 = 'season_2012' THEN s.season = 2012
            ELSE true
          END
      ),
      pair_base AS (
        SELECT
          p1.player_id AS player_id_1,
          p2.player_id AS player_id_2
        FROM unnest($1::bigint[]) p1(player_id)
        JOIN unnest($1::bigint[]) p2(player_id)
          ON p1.player_id < p2.player_id
      ),
      teammate_flags AS (
        SELECT
          pb.player_id_1,
          pb.player_id_2,
          CASE
            WHEN EXISTS (
              SELECT 1
              FROM player_team_history a
              JOIN player_team_history b
                ON a.season = b.season
               AND a.team_id = b.team_id
              JOIN themed_seasons ts
                ON a.season = ts.season
              WHERE a.player_id = pb.player_id_1
                AND b.player_id = pb.player_id_2
            )
            THEN true
            ELSE false
          END AS were_teammates_flag
        FROM pair_base pb
      )
      SELECT
        pb.player_id_1,
        pb.player_id_2,
        tf.were_teammates_flag,
        CASE
          WHEN EXISTS (
            SELECT 1
            FROM player_team_history a
            JOIN player_team_history b
              ON COALESCE(a.franchise_id, -1) = COALESCE(b.franchise_id, -2)
            WHERE a.player_id = pb.player_id_1
              AND b.player_id = pb.player_id_2
              AND a.franchise_id IS NOT NULL
          )
          THEN true
          ELSE false
        END AS same_franchise_flag,
        CASE
          WHEN p1.college_name IS NOT NULL
           AND p1.college_name = p2.college_name
          THEN true
          ELSE false
        END AS same_college_flag,
        CASE
          WHEN p1.draft_year IS NOT NULL
           AND p1.draft_year = p2.draft_year
          THEN true
          ELSE false
        END AS same_draft_class_flag,
        CASE
          WHEN p1.draft_round IS NOT NULL
           AND p1.draft_round = p2.draft_round
          THEN true
          ELSE false
        END AS same_draft_round_flag,
        CASE
          WHEN COALESCE(p1.undrafted_flag, false) = true
           AND COALESCE(p2.undrafted_flag, false) = true
          THEN true
          ELSE false
        END AS both_undrafted_flag,
        CASE
          WHEN p1.primary_position IS NOT NULL
           AND p1.primary_position = p2.primary_position
          THEN true
          ELSE false
        END AS same_position_flag
      FROM pair_base pb
      LEFT JOIN teammate_flags tf
        ON pb.player_id_1 = tf.player_id_1
       AND pb.player_id_2 = tf.player_id_2
      JOIN player_dim p1
        ON p1.player_id = pb.player_id_1
      JOIN player_dim p2
        ON p2.player_id = pb.player_id_2
      `,
      [playerIds, themeRule]
    );

    return NextResponse.json({ pair_relationships: pairResult.rows });
  } catch (error) {
    console.error("Relationships route failed:", error);
    return NextResponse.json(
      { error: "Failed to load relationships" },
      { status: 500 }
    );
  }
}

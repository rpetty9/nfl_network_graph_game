import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    const scope = request.nextUrl.searchParams.get("scope");
    const requestedDate = request.nextUrl.searchParams.get("date");
    const limit = Math.min(
      Math.max(Number(request.nextUrl.searchParams.get("limit") ?? 10), 1),
      25
    );

    if (scope === "all-time") {
      const allTimeResult = await pool.query(
        `
        SELECT
          au.user_id,
          au.username AS display_name,
          COUNT(*)::int AS top_10_finishes,
          MIN(dlf.placement)::int AS best_finish,
          MAX(dlf.awarded_at) AS latest_finish_at,
          COALESCE(au.featured_badges, ARRAY[]::text[]) AS featured_badges
        FROM daily_leaderboard_finish dlf
        JOIN app_user au
          ON dlf.user_id = au.user_id
        GROUP BY au.user_id, au.username, au.featured_badges
        ORDER BY COUNT(*) DESC, MIN(dlf.placement) ASC, MAX(dlf.awarded_at) DESC, au.username ASC
        LIMIT $1
        `,
        [limit]
      );

      return NextResponse.json({
        leaderboard: allTimeResult.rows,
        scope: "all-time",
      });
    }

    const puzzleResult = requestedDate
      ? await pool.query(
          `
          SELECT puzzle_id, puzzle_date
          FROM daily_puzzle
          WHERE puzzle_date = $1
            AND sport = 'nfl'
            AND puzzle_date <= ((NOW() AT TIME ZONE 'America/Chicago')::date)
          LIMIT 1
          `,
          [requestedDate]
        )
      : await pool.query(`
          SELECT puzzle_id, puzzle_date
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

    const submissionsResult = await pool.query(
      `
      SELECT
        ps.submission_id,
        ps.display_name,
        ps.base_score,
        ps.active_links,
        ps.multiplier,
        ps.final_score,
        ps.optimal_final_score,
        ps.percent_of_optimal,
        ps.submitted_at,
        COALESCE(au.featured_badges, ARRAY[]::text[]) AS featured_badges
      FROM puzzle_submission ps
      JOIN app_user au
        ON ps.user_id = au.user_id
      WHERE ps.puzzle_id = $1
        AND ps.user_id IS NOT NULL
      ORDER BY ps.final_score DESC, ps.submitted_at ASC
      LIMIT $2
      `,
      [puzzle.puzzle_id, limit]
    );

    return NextResponse.json({
      puzzle_date: String(puzzle.puzzle_date).slice(0, 10),
      leaderboard: submissionsResult.rows,
      scope: "daily",
    });
  } catch (error) {
    console.error("Leaderboard route failed:", error);
    return NextResponse.json(
      { error: "Failed to load leaderboard" },
      { status: 500 }
    );
  }
}

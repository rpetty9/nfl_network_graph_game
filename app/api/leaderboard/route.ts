import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    const requestedDate = request.nextUrl.searchParams.get("date");
    const limit = Math.min(
      Math.max(Number(request.nextUrl.searchParams.get("limit") ?? 10), 1),
      25
    );

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
        submission_id,
        display_name,
        base_score,
        active_links,
        multiplier,
        final_score,
        optimal_final_score,
        percent_of_optimal,
        submitted_at
      FROM puzzle_submission
      WHERE puzzle_id = $1
      ORDER BY final_score DESC, submitted_at ASC
      LIMIT $2
      `,
      [puzzle.puzzle_id, limit]
    );

    return NextResponse.json({
      puzzle_date: String(puzzle.puzzle_date).slice(0, 10),
      leaderboard: submissionsResult.rows,
    });
  } catch (error) {
    console.error("Leaderboard route failed:", error);
    return NextResponse.json(
      { error: "Failed to load leaderboard" },
      { status: 500 }
    );
  }
}

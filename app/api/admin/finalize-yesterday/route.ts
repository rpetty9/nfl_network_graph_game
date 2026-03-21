import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { isAdminSession } from "@/lib/admin";
import { pool } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function getPreviousChicagoDateIso(reference = new Date()) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const [year, month, day] = formatter
    .format(reference)
    .split("-")
    .map(Number);

  return new Date(Date.UTC(year, month - 1, day - 1))
    .toISOString()
    .slice(0, 10);
}

async function awardPuzzle(puzzleId: number) {
  const leaderboardResult = await pool.query<{
    user_id: string;
    placement: number;
  }>(
    `
    WITH ranked AS (
      SELECT
        ps.user_id,
        RANK() OVER (
          ORDER BY ps.final_score DESC, ps.submitted_at ASC
        ) AS placement
      FROM puzzle_submission ps
      JOIN daily_puzzle dp
        ON dp.puzzle_id = ps.puzzle_id
      WHERE ps.puzzle_id = $1
        AND ps.user_id IS NOT NULL
        AND (ps.submitted_at AT TIME ZONE 'America/Chicago')::date = dp.puzzle_date
    )
    SELECT user_id::text, placement
    FROM ranked
    WHERE placement <= 10
    ORDER BY placement ASC
    `,
    [puzzleId]
  );

  if (leaderboardResult.rows.length === 0) {
    return {
      placementsRecorded: 0,
      firstPlaceBadgesAwarded: 0,
      topTenBadgesAwarded: 0,
      topTenFiveBadgesAwarded: 0,
      leaderboard: [],
    };
  }

  for (const row of leaderboardResult.rows) {
    await pool.query(
      `
      INSERT INTO daily_leaderboard_finish (puzzle_id, user_id, placement)
      VALUES ($1, $2, $3)
      ON CONFLICT (puzzle_id, user_id)
      DO UPDATE SET placement = EXCLUDED.placement
      `,
      [puzzleId, Number(row.user_id), Number(row.placement)]
    );
  }

  const firstPlaceBadgeResult = await pool.query(
    `
    INSERT INTO user_badge (user_id, badge_key)
    SELECT DISTINCT user_id, 'first_place_finish'
    FROM daily_leaderboard_finish
    WHERE puzzle_id = $1
      AND placement = 1
    ON CONFLICT (user_id, badge_key)
    DO NOTHING
    `,
    [puzzleId]
  );

  const topTenBadgeResult = await pool.query(
    `
    INSERT INTO user_badge (user_id, badge_key)
    SELECT DISTINCT user_id, 'top_10_finish'
    FROM daily_leaderboard_finish
    WHERE puzzle_id = $1
    ON CONFLICT (user_id, badge_key)
    DO NOTHING
    `,
    [puzzleId]
  );

  const topTenFiveBadgeResult = await pool.query(
    `
    INSERT INTO user_badge (user_id, badge_key)
    SELECT user_id, 'top_10_finish_5'
    FROM daily_leaderboard_finish
    GROUP BY user_id
    HAVING COUNT(*) >= 5
    ON CONFLICT (user_id, badge_key)
    DO NOTHING
    `
  );

  return {
    placementsRecorded: leaderboardResult.rows.length,
    firstPlaceBadgesAwarded: firstPlaceBadgeResult.rowCount ?? 0,
    topTenBadgesAwarded: topTenBadgeResult.rowCount ?? 0,
    topTenFiveBadgesAwarded: topTenFiveBadgeResult.rowCount ?? 0,
    leaderboard: leaderboardResult.rows,
  };
}

export async function POST() {
  try {
    const session = await auth();
    if (!isAdminSession(session)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const targetDate = getPreviousChicagoDateIso();
    const puzzleResult = await pool.query<{ puzzle_id: string }>(
      `
      SELECT puzzle_id::text
      FROM daily_puzzle
      WHERE sport = 'nfl'
        AND puzzle_date = $1
      LIMIT 1
      `,
      [targetDate]
    );

    const puzzleId = puzzleResult.rows[0]?.puzzle_id;
    if (!puzzleId) {
      return NextResponse.json(
        { error: `No puzzle found for ${targetDate}.` },
        { status: 404 }
      );
    }

    const summary = await awardPuzzle(Number(puzzleId));

    return NextResponse.json({
      target_date: targetDate,
      placements_recorded: summary.placementsRecorded,
      first_place_badges_awarded: summary.firstPlaceBadgesAwarded,
      top_10_badges_awarded: summary.topTenBadgesAwarded,
      top_10_x5_badges_awarded: summary.topTenFiveBadgesAwarded,
      leaderboard: summary.leaderboard,
      message:
        summary.placementsRecorded > 0
          ? `Finalized yesterday's leaderboard for ${targetDate}.`
          : `No registered submissions found to finalize for ${targetDate}.`,
    });
  } catch (error) {
    console.error("Finalize yesterday route failed:", error);
    return NextResponse.json(
      { error: "Failed to finalize yesterday's leaderboard." },
      { status: 500 }
    );
  }
}

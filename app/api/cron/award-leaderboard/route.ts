import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function getChicagoDateIso(daysOffset = 0) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const [year, month, day] = formatter
    .format(new Date())
    .split("-")
    .map(Number);

  return new Date(Date.UTC(year, month - 1, day + daysOffset))
    .toISOString()
    .slice(0, 10);
}

function resolveRequestedDate(request: NextRequest) {
  const requestedDate = request.nextUrl.searchParams.get("date");
  if (!requestedDate) {
    return getChicagoDateIso(-1);
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(requestedDate)) {
    throw new Error("Invalid date. Use YYYY-MM-DD.");
  }

  return requestedDate;
}

function isAuthorized(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return process.env.NODE_ENV !== "production";
  }

  return request.headers.get("authorization") === `Bearer ${cronSecret}`;
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let targetDate: string;

  try {
    targetDate = resolveRequestedDate(request);
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 400 }
    );
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const puzzleResult = await client.query<{ puzzle_id: string }>(
      `
      SELECT puzzle_id::text
      FROM daily_puzzle
      WHERE sport = 'nfl'
        AND puzzle_date = $1
      LIMIT 1
      `,
      [targetDate]
    );

    const puzzle = puzzleResult.rows[0];
    if (!puzzle) {
      await client.query("ROLLBACK");
      return NextResponse.json(
        { error: `No puzzle found for ${targetDate}.` },
        { status: 404 }
      );
    }

    const leaderboardResult = await client.query<{
      user_id: string;
      placement: number;
    }>(
      `
      WITH ranked AS (
        SELECT
          user_id,
          RANK() OVER (
            ORDER BY final_score DESC, submitted_at ASC
          ) AS placement
        FROM puzzle_submission
        WHERE puzzle_id = $1
          AND user_id IS NOT NULL
      )
      SELECT user_id::text, placement
      FROM ranked
      WHERE placement <= 10
      ORDER BY placement ASC
      `,
      [Number(puzzle.puzzle_id)]
    );

    if (leaderboardResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return NextResponse.json({
        target_date: targetDate,
        message: "No registered leaderboard entries to award.",
        placements_recorded: 0,
        top_10_badges_awarded: 0,
        top_10_x5_badges_awarded: 0,
      });
    }

    for (const row of leaderboardResult.rows) {
      await client.query(
        `
        INSERT INTO daily_leaderboard_finish (puzzle_id, user_id, placement)
        VALUES ($1, $2, $3)
        ON CONFLICT (puzzle_id, user_id)
        DO UPDATE SET placement = EXCLUDED.placement
        `,
        [Number(puzzle.puzzle_id), Number(row.user_id), Number(row.placement)]
      );
    }

    const topTenBadgeResult = await client.query(
      `
      INSERT INTO user_badge (user_id, badge_key)
      SELECT DISTINCT user_id, 'top_10_finish'
      FROM daily_leaderboard_finish
      WHERE puzzle_id = $1
      ON CONFLICT (user_id, badge_key)
      DO NOTHING
      `,
      [Number(puzzle.puzzle_id)]
    );

    const topTenFiveBadgeResult = await client.query(
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

    await client.query("COMMIT");

    return NextResponse.json({
      target_date: targetDate,
      placements_recorded: leaderboardResult.rows.length,
      top_10_badges_awarded: topTenBadgeResult.rowCount,
      top_10_x5_badges_awarded: topTenFiveBadgeResult.rowCount,
      leaderboard: leaderboardResult.rows,
    });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("Cron leaderboard award failed:", error);
    return NextResponse.json(
      {
        error:
          (error as Error).message || "Failed to award leaderboard badges.",
      },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}

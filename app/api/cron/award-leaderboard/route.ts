import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type ChicagoClock = {
  dateIso: string;
  hour: number;
  minute: number;
};

type PuzzleTarget = {
  puzzle_id: string;
  puzzle_date: string;
};

function getChicagoClock(reference = new Date()): ChicagoClock {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const parts = formatter.formatToParts(reference);
  const lookup = new Map(parts.map((part) => [part.type, part.value]));

  return {
    dateIso: `${lookup.get("year")}-${lookup.get("month")}-${lookup.get("day")}`,
    hour: Number(lookup.get("hour") ?? "0"),
    minute: Number(lookup.get("minute") ?? "0"),
  };
}

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

function resolveRequestedDate(request: NextRequest) {
  const requestedDate = request.nextUrl.searchParams.get("date");
  if (!requestedDate) {
    return null;
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

async function loadAutomaticTargets(clientDate: string) {
  const result = await pool.query<PuzzleTarget>(
    `
    SELECT
      dp.puzzle_id::text,
      dp.puzzle_date::text
    FROM daily_puzzle dp
    WHERE dp.sport = 'nfl'
      AND dp.puzzle_date < $1::date
      AND EXISTS (
        SELECT 1
        FROM puzzle_submission ps
        WHERE ps.puzzle_id = dp.puzzle_id
          AND ps.user_id IS NOT NULL
      )
      AND NOT EXISTS (
        SELECT 1
        FROM daily_leaderboard_finish dlf
        WHERE dlf.puzzle_id = dp.puzzle_id
      )
    ORDER BY dp.puzzle_date ASC
    `,
    [clientDate]
  );

  return result.rows;
}

async function loadExplicitTarget(requestedDate: string) {
  const result = await pool.query<PuzzleTarget>(
    `
    SELECT puzzle_id::text, puzzle_date::text
    FROM daily_puzzle
    WHERE sport = 'nfl'
      AND puzzle_date = $1
    LIMIT 1
    `,
    [requestedDate]
  );

  return result.rows[0] ?? null;
}

async function awardPuzzle(puzzleId: number) {
  const leaderboardResult = await pool.query<{
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
    [puzzleId]
  );

  if (leaderboardResult.rows.length === 0) {
    return {
      placementsRecorded: 0,
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
    topTenBadgesAwarded: topTenBadgeResult.rowCount ?? 0,
    topTenFiveBadgesAwarded: topTenFiveBadgeResult.rowCount ?? 0,
    leaderboard: leaderboardResult.rows,
  };
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let requestedDate: string | null;

  try {
    requestedDate = resolveRequestedDate(request);
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 400 }
    );
  }

  const chicagoClock = getChicagoClock();
  const automaticRunWindow =
    chicagoClock.hour === 0 && chicagoClock.minute >= 1 && chicagoClock.minute <= 10;

  if (!requestedDate && !automaticRunWindow) {
    return NextResponse.json({
      skipped: true,
      reason:
        "Automatic awards only run during the 12:01-12:10 AM America/Chicago window unless a date is specified.",
      chicago_now: `${chicagoClock.dateIso} ${String(chicagoClock.hour).padStart(2, "0")}:${String(
        chicagoClock.minute
      ).padStart(2, "0")}`,
    });
  }

  try {
    const targets = requestedDate
      ? (() => {
          const explicit = loadExplicitTarget(requestedDate);
          return explicit.then((puzzle) => (puzzle ? [puzzle] : []));
        })()
      : loadAutomaticTargets(chicagoClock.dateIso);

    const resolvedTargets = await targets;

    if (requestedDate && resolvedTargets.length === 0) {
      return NextResponse.json(
        { error: `No puzzle found for ${requestedDate}.` },
        { status: 404 }
      );
    }

    if (resolvedTargets.length === 0) {
      return NextResponse.json({
        target_date: requestedDate ?? getPreviousChicagoDateIso(),
        message: "No missing leaderboard awards found.",
        processed_dates: [],
        placements_recorded: 0,
        top_10_badges_awarded: 0,
        top_10_x5_badges_awarded: 0,
      });
    }

    const summaries = [];
    let placementsRecorded = 0;
    let topTenBadgesAwarded = 0;
    let topTenFiveBadgesAwarded = 0;

    for (const target of resolvedTargets) {
      const summary = await awardPuzzle(Number(target.puzzle_id));
      summaries.push({
        target_date: target.puzzle_date,
        placements_recorded: summary.placementsRecorded,
        leaderboard: summary.leaderboard,
      });
      placementsRecorded += summary.placementsRecorded;
      topTenBadgesAwarded += summary.topTenBadgesAwarded;
      topTenFiveBadgesAwarded += summary.topTenFiveBadgesAwarded;
    }

    return NextResponse.json({
      target_date:
        requestedDate ??
        resolvedTargets[resolvedTargets.length - 1]?.puzzle_date ??
        getPreviousChicagoDateIso(),
      processed_dates: summaries.map((summary) => summary.target_date),
      placements_recorded: placementsRecorded,
      top_10_badges_awarded: topTenBadgesAwarded,
      top_10_x5_badges_awarded: topTenFiveBadgesAwarded,
      runs: summaries,
    });
  } catch (error) {
    console.error("Cron leaderboard award failed:", error);
    return NextResponse.json(
      {
        error:
          (error as Error).message || "Failed to award leaderboard badges.",
      },
      { status: 500 }
    );
  }
}

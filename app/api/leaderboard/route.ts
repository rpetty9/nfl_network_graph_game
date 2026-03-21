import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { pool } from "@/lib/db";
import { getAcceptedFriendUserIds } from "@/lib/users";
import { ensureTestingSubmissionTables, requireTestingAdmin } from "@/lib/testing";

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

    if (testingMode) {
      await ensureTestingSubmissionTables(pool);
    }

    const scope = request.nextUrl.searchParams.get("scope");
    const view = request.nextUrl.searchParams.get("view");
    const requestedDate = request.nextUrl.searchParams.get("date");
    const limit = Math.min(
      Math.max(Number(request.nextUrl.searchParams.get("limit") ?? 10), 1),
      25
    );

    if (scope === "all-time" || (scope === "friends" && view === "all-time")) {
      if (testingMode) {
        return NextResponse.json({
          leaderboard: [],
          scope: scope === "friends" ? "friends" : "all-time",
        });
      }

      let friendUserIds: string[] = [];

      if (scope === "friends") {
        const session = await auth();
        const userId = session?.user?.id;

        if (!userId) {
          return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        friendUserIds = [userId, ...(await getAcceptedFriendUserIds(userId))];
      }

      const allTimeResult = await pool.query(
        scope === "friends"
          ? `
            SELECT
              au.user_id::text AS user_id,
              au.username AS display_name,
              COUNT(*)::int AS top_10_finishes,
              MIN(dlf.placement)::int AS best_finish,
              MAX(dlf.awarded_at) AS latest_finish_at,
              COALESCE(au.featured_badges, ARRAY[]::text[]) AS featured_badges
            FROM daily_leaderboard_finish dlf
            JOIN app_user au
              ON dlf.user_id = au.user_id
            WHERE dlf.user_id = ANY($1::bigint[])
            GROUP BY au.user_id, au.username, au.featured_badges
            ORDER BY COUNT(*) DESC, MIN(dlf.placement) ASC, MAX(dlf.awarded_at) DESC, au.username ASC
            LIMIT $2
            `
          : `
            SELECT
              au.user_id::text AS user_id,
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
        scope === "friends" ? [friendUserIds.map(Number), limit] : [limit]
      );

      return NextResponse.json({
        leaderboard: allTimeResult.rows,
        scope: scope === "friends" ? "friends" : "all-time",
      });
    }

    let friendUserIds: string[] = [];
    if (scope === "friends") {
      const session = await auth();
      const userId = session?.user?.id;

      if (!userId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      friendUserIds = [userId, ...(await getAcceptedFriendUserIds(userId))];
    }

    const puzzleResult = requestedDate
      ? await pool.query(
          `
          SELECT puzzle_id, puzzle_date
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

    const submissionsResult =
      scope === "friends"
        ? await pool.query(
            `
            SELECT *
            FROM (
              SELECT
                ps.user_id::text AS user_id,
                ${testingMode ? "ps.testing_submission_id" : "ps.submission_id"} AS submission_id,
                ps.display_name,
                ps.base_score,
                ps.active_links,
                ps.multiplier,
                ps.final_score,
                ps.optimal_final_score,
                ps.percent_of_optimal,
                ps.submitted_at,
                COALESCE(au.featured_badges, ARRAY[]::text[]) AS featured_badges,
                ROW_NUMBER() OVER (
                  ORDER BY ps.final_score DESC, ps.submitted_at ASC
                )::int AS placement
              FROM ${testingMode ? "testing_submission" : "puzzle_submission"} ps
              JOIN app_user au
                ON ps.user_id = au.user_id
              WHERE ps.puzzle_id = $1
                AND ps.user_id IS NOT NULL
                AND ps.user_id = ANY($2::bigint[])
                ${testingMode ? "" : "AND (ps.submitted_at AT TIME ZONE 'America/Chicago')::date = $4::date"}
            ) ranked
            ORDER BY placement ASC
            LIMIT $3
            `,
            testingMode
              ? [puzzle.puzzle_id, friendUserIds.map(Number), limit]
              : [puzzle.puzzle_id, friendUserIds.map(Number), limit, puzzle.puzzle_date]
          )
        : await pool.query(
            `
            SELECT *
            FROM (
              SELECT
                ps.user_id::text AS user_id,
                ${testingMode ? "ps.testing_submission_id" : "ps.submission_id"} AS submission_id,
                COALESCE(au.username, ps.display_name) AS display_name,
                ps.base_score,
                ps.active_links,
                ps.multiplier,
                ps.final_score,
                ps.optimal_final_score,
                ps.percent_of_optimal,
                ps.submitted_at,
                COALESCE(au.featured_badges, ARRAY[]::text[]) AS featured_badges,
                ROW_NUMBER() OVER (
                  ORDER BY ps.final_score DESC, ps.submitted_at ASC
                )::int AS placement
              FROM ${testingMode ? "testing_submission" : "puzzle_submission"} ps
              LEFT JOIN app_user au
                ON ps.user_id = au.user_id
              WHERE ps.puzzle_id = $1
                ${testingMode ? "" : "AND (ps.submitted_at AT TIME ZONE 'America/Chicago')::date = $3::date"}
            ) ranked
            ORDER BY placement ASC
            LIMIT $2
            `,
            testingMode
              ? [puzzle.puzzle_id, limit]
              : [puzzle.puzzle_id, limit, puzzle.puzzle_date]
          );

    return NextResponse.json({
      puzzle_date: String(puzzle.puzzle_date).slice(0, 10),
      leaderboard: submissionsResult.rows,
      scope: scope === "friends" ? "friends" : "daily",
    });
  } catch (error) {
    console.error("Leaderboard route failed:", error);
    return NextResponse.json(
      { error: "Failed to load leaderboard" },
      { status: 500 }
    );
  }
}

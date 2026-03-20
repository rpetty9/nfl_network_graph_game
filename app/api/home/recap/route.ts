import { NextResponse } from "next/server";
import { pool } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type HomeRecapRow = {
  user_id: string;
  display_name: string;
  placement: string;
  final_score: string;
  featured_badges: string[] | null;
  puzzle_date: string;
};

export async function GET() {
  try {
    const yesterdayResult = await pool.query<{ puzzle_date: string }>(
      `
      SELECT (((NOW() AT TIME ZONE 'America/Chicago')::date) - INTERVAL '1 day')::date::text AS puzzle_date
      `
    );

    const yesterdayDate = yesterdayResult.rows[0]?.puzzle_date;
    if (!yesterdayDate) {
      return NextResponse.json({ recap: null });
    }

    const recapResult = await pool.query<HomeRecapRow>(
      `
      SELECT
        au.user_id::text,
        au.username AS display_name,
        dlf.placement::text,
        ps.final_score::text,
        COALESCE(au.featured_badges, ARRAY[]::text[]) AS featured_badges,
        dp.puzzle_date::text
      FROM daily_leaderboard_finish dlf
      JOIN daily_puzzle dp
        ON dp.puzzle_id = dlf.puzzle_id
      JOIN app_user au
        ON au.user_id = dlf.user_id
      JOIN puzzle_submission ps
        ON ps.puzzle_id = dlf.puzzle_id
        AND ps.user_id = dlf.user_id
      WHERE dp.puzzle_date = $1
      ORDER BY dlf.placement ASC, ps.final_score DESC, ps.submitted_at ASC
      LIMIT 10
      `,
      [yesterdayDate]
    );

    const rows =
      recapResult.rows.length > 0
        ? recapResult.rows
        : (
            await pool.query<HomeRecapRow>(
              `
              SELECT
                au.user_id::text,
                au.username AS display_name,
                ROW_NUMBER() OVER (
                  ORDER BY ps.final_score DESC, ps.submitted_at ASC
                )::text AS placement,
                ps.final_score::text,
                COALESCE(au.featured_badges, ARRAY[]::text[]) AS featured_badges,
                dp.puzzle_date::text
              FROM puzzle_submission ps
              JOIN daily_puzzle dp
                ON dp.puzzle_id = ps.puzzle_id
              JOIN app_user au
                ON au.user_id = ps.user_id
              WHERE dp.puzzle_date = $1
                AND ps.user_id IS NOT NULL
                AND (ps.submitted_at AT TIME ZONE 'America/Chicago')::date = dp.puzzle_date
              ORDER BY ps.final_score DESC, ps.submitted_at ASC
              LIMIT 10
              `,
              [yesterdayDate]
            )
          ).rows;

    return NextResponse.json({
      recap:
        rows.length > 0
          ? {
              puzzle_date: yesterdayDate,
              winners: rows.map((row) => ({
                user_id: row.user_id,
                display_name: row.display_name,
                placement: Number(row.placement),
                final_score: Number(row.final_score),
                featured_badges: Array.isArray(row.featured_badges)
                  ? row.featured_badges.filter(
                      (badge): badge is string => typeof badge === "string"
                    )
                  : [],
              })),
            }
          : {
              puzzle_date: yesterdayDate,
              winners: [],
            },
    });
  } catch (error) {
    console.error("Home recap route failed:", error);
    return NextResponse.json(
      { error: "Unable to load recap." },
      { status: 500 }
    );
  }
}

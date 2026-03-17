import process from "node:process";
import { Client } from "pg";

function readArg(name) {
  const direct = process.argv.find((arg) => arg.startsWith(`--${name}=`));
  if (direct) return direct.slice(name.length + 3);

  const index = process.argv.indexOf(`--${name}`);
  if (index >= 0) return process.argv[index + 1] ?? null;

  return null;
}

const requestedDate = readArg("date");

if (!requestedDate || !/^\d{4}-\d{2}-\d{2}$/.test(requestedDate)) {
  console.log(
    "Usage: node scripts/award_daily_leaderboard_badges.mjs --date 2026-03-16"
  );
  process.exit(1);
}

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is required.");
  process.exit(1);
}

const client = new Client({
  connectionString: process.env.DATABASE_URL,
});

try {
  await client.connect();
  await client.query("BEGIN");

  const puzzleResult = await client.query(
    `
    SELECT puzzle_id
    FROM daily_puzzle
    WHERE sport = 'nfl'
      AND puzzle_date = $1
    LIMIT 1
    `,
    [requestedDate]
  );

  const puzzle = puzzleResult.rows[0];
  if (!puzzle) {
    throw new Error(`No puzzle found for ${requestedDate}.`);
  }

  const leaderboardResult = await client.query(
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
    [puzzle.puzzle_id]
  );

  if (leaderboardResult.rows.length === 0) {
    await client.query("ROLLBACK");
    console.log(`No registered leaderboard entries for ${requestedDate}.`);
    process.exit(0);
  }

  for (const row of leaderboardResult.rows) {
    await client.query(
      `
      INSERT INTO daily_leaderboard_finish (puzzle_id, user_id, placement)
      VALUES ($1, $2, $3)
      ON CONFLICT (puzzle_id, user_id)
      DO UPDATE SET placement = EXCLUDED.placement
      `,
      [puzzle.puzzle_id, Number(row.user_id), Number(row.placement)]
    );
  }

  await client.query(
    `
    INSERT INTO user_badge (user_id, badge_key)
    SELECT DISTINCT user_id, 'top_10_finish'
    FROM daily_leaderboard_finish
    WHERE puzzle_id = $1
    ON CONFLICT (user_id, badge_key)
    DO NOTHING
    `,
    [puzzle.puzzle_id]
  );

  await client.query(
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
  console.log(
    `Awarded leaderboard badges for ${requestedDate} to ${leaderboardResult.rows.length} users.`
  );
} catch (error) {
  await client.query("ROLLBACK").catch(() => {});
  console.error(error);
  process.exit(1);
} finally {
  await client.end();
}

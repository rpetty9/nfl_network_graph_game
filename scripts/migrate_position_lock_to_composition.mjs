import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    if (!line || line.trim().startsWith("#")) continue;
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;
    const [, key, rawValue] = match;
    const value = rawValue.replace(/^['"]|['"]$/g, "");
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

loadEnvFile(path.join(repoRoot, ".env.local"));
loadEnvFile(path.join(repoRoot, ".env"));

const { pool } = await import("../lib/db.ts");

const client = await pool.connect();

try {
  await client.query("BEGIN");

  await client.query(`
    ALTER TABLE daily_puzzle
      ADD COLUMN IF NOT EXISTS qb_exclusion_enabled BOOLEAN NOT NULL DEFAULT false
  `);

  const todayResult = await client.query(`
    SELECT ((NOW() AT TIME ZONE 'America/Chicago')::date)::text AS today
  `);
  const today = String(todayResult.rows[0]?.today ?? "");

  const removedResult = await client.query(
    `
    DELETE FROM daily_puzzle
    WHERE puzzle_id IN (
      SELECT puzzle_id
      FROM daily_puzzle
      WHERE sport = 'nfl'
        AND puzzle_date > $1::date
        AND position_overlay_enabled = true
    )
    RETURNING puzzle_id::text, puzzle_date::text, title
    `,
    [today]
  );

  const futureResult = await client.query(
    `
    SELECT puzzle_id::text, puzzle_date::text
    FROM daily_puzzle
    WHERE sport = 'nfl'
      AND puzzle_date > $1::date
    ORDER BY puzzle_date ASC, puzzle_id ASC
    `,
    [today]
  );

  const shifted = [];
  for (const [index, row] of futureResult.rows.entries()) {
    const nextDateResult = await client.query(
      `SELECT ($1::date + ($2::int || ' day')::interval)::date::text AS next_date`,
      [today, index + 1]
    );
    const nextDate = String(nextDateResult.rows[0]?.next_date ?? row.puzzle_date);
    if (nextDate !== String(row.puzzle_date)) {
      await client.query(
        `
        UPDATE daily_puzzle
        SET puzzle_date = $2::date
        WHERE puzzle_id = $1::bigint
        `,
        [Number(row.puzzle_id), nextDate]
      );
      shifted.push({
        puzzle_id: String(row.puzzle_id),
        from: String(row.puzzle_date),
        to: nextDate,
      });
    }
  }

  await client.query("COMMIT");

  console.log(
    JSON.stringify(
      {
        today,
        removed_future_position_lock_puzzles: removedResult.rows.map((row) => ({
          puzzle_id: String(row.puzzle_id),
          puzzle_date: String(row.puzzle_date),
          title: String(row.title ?? ""),
        })),
        shifted_future_puzzles: shifted,
      },
      null,
      2
    )
  );
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  client.release();
  await pool.end();
}

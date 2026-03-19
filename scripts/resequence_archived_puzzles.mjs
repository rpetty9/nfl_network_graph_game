import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { Client } from "pg";

function loadEnvLocal() {
  if (process.env.DATABASE_URL) {
    return;
  }

  const envPath = path.resolve(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) {
    return;
  }

  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const equalsIndex = trimmed.indexOf("=");
    if (equalsIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, equalsIndex).trim();
    const value = trimmed.slice(equalsIndex + 1).trim();
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

function addDaysIso(dateIso, daysToAdd) {
  const [year, month, day] = dateIso.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + daysToAdd))
    .toISOString()
    .slice(0, 10);
}

async function main() {
  loadEnvLocal();

  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required.");
  }

  const lockStart = "2026-03-15";
  const lockEnd = "2026-03-18";

  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  try {
    await client.query("BEGIN");

    const archivedResult = await client.query(
      `
      SELECT puzzle_id::text, puzzle_date::text, title
      FROM daily_puzzle
      WHERE sport = 'nfl'
        AND puzzle_date < $1::date
      ORDER BY puzzle_date ASC, puzzle_id ASC
      `,
      [lockStart]
    );

    const archivedPuzzles = archivedResult.rows;
    if (archivedPuzzles.length === 0) {
      console.log("No puzzles before 2026-03-15 were found.");
      await client.query("ROLLBACK");
      return;
    }

    const occupiedResult = await client.query(
      `
      SELECT puzzle_date::text
      FROM daily_puzzle
      WHERE sport = 'nfl'
        AND puzzle_date >= $1::date
      ORDER BY puzzle_date ASC
      `,
      [lockEnd]
    );

    const occupiedDates = new Set(
      occupiedResult.rows
        .map((row) => row.puzzle_date)
        .filter((dateValue) => typeof dateValue === "string")
    );

    const targetDates = [];
    let cursor = addDaysIso(lockEnd, 1);

    while (targetDates.length < archivedPuzzles.length) {
      if (!occupiedDates.has(cursor)) {
        targetDates.push(cursor);
      }
      cursor = addDaysIso(cursor, 1);
    }

    const plan = archivedPuzzles.map((puzzle, index) => ({
      puzzle_id: puzzle.puzzle_id,
      title: puzzle.title,
      from: puzzle.puzzle_date,
      to: targetDates[index],
    }));

    for (const move of plan) {
      await client.query(
        `
        UPDATE daily_puzzle
        SET puzzle_date = $1::date
        WHERE puzzle_id = $2::bigint
        `,
        [move.to, Number(move.puzzle_id)]
      );
    }

    await client.query("COMMIT");
    console.log(JSON.stringify({ protected_dates: [lockStart, lockEnd], moves: plan }, null, 2));
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

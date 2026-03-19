import type { NextRequest } from "next/server";
import type { Pool, PoolClient } from "pg";
import { auth } from "@/auth";
import { isAdminSession } from "@/lib/admin";

type DbClient = Pool | PoolClient;

export function isTestingRequest(request: NextRequest) {
  return request.nextUrl.searchParams.get("testing") === "1";
}

export async function requireTestingAdmin(request: NextRequest) {
  if (!isTestingRequest(request)) {
    return false;
  }

  const session = await auth();
  if (!isAdminSession(session)) {
    throw new Error("Unauthorized");
  }

  return true;
}

export async function ensureTestingSubmissionTables(db: DbClient) {
  await db.query(`
    CREATE TABLE IF NOT EXISTS testing_submission (
      testing_submission_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      puzzle_id BIGINT NOT NULL REFERENCES daily_puzzle(puzzle_id) ON DELETE CASCADE,
      user_id BIGINT REFERENCES app_user(user_id) ON DELETE SET NULL,
      client_token TEXT,
      display_name TEXT NOT NULL,
      base_score NUMERIC(12,2) NOT NULL,
      active_links INTEGER NOT NULL,
      multiplier NUMERIC(8,4) NOT NULL,
      final_score NUMERIC(12,2) NOT NULL,
      optimal_final_score NUMERIC(12,2),
      percent_of_optimal NUMERIC(8,2),
      submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS testing_submission_player (
      testing_submission_player_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      testing_submission_id BIGINT NOT NULL REFERENCES testing_submission(testing_submission_id) ON DELETE CASCADE,
      slot_number INTEGER NOT NULL,
      player_id BIGINT NOT NULL REFERENCES player_dim(player_id) ON DELETE CASCADE,
      fantasy_points NUMERIC(12,2) NOT NULL
    )
  `);
}

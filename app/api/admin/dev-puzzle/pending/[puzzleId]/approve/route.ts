import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { isAdminSession } from "@/lib/admin";
import { pool } from "@/lib/db";
import { appendDevOptimizerLog, approvePendingPuzzle } from "@/lib/dev-puzzle";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(
  _request: Request,
  context: { params: Promise<{ puzzleId: string }> }
) {
  const session = await auth();
  if (!isAdminSession(session)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const client = await pool.connect();

  try {
    const { puzzleId } = await context.params;
    await client.query("BEGIN");
    const approved = await approvePendingPuzzle(client, puzzleId);
    await appendDevOptimizerLog(client, {
      kind: "success",
      title: "Puzzle Approved",
      detail: `Approved pending puzzle ${approved.puzzle_date}.`,
      metadata: approved,
    });
    await client.query("COMMIT");
    return NextResponse.json({ ok: true, approved });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Approve pending puzzle failed:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to approve pending puzzle.",
      },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}

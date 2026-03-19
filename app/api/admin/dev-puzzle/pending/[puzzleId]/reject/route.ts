import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { isAdminSession } from "@/lib/admin";
import { pool } from "@/lib/db";
import { appendDevOptimizerLog, rejectPendingPuzzle } from "@/lib/dev-puzzle";

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
    const rejected = await rejectPendingPuzzle(client, puzzleId);
    await appendDevOptimizerLog(client, {
      kind: "success",
      title: "Puzzle Rejected",
      detail: `Rejected pending puzzle on ${rejected.removedDate} and shifted ${rejected.shiftedCount} later puzzle(s).`,
      metadata: rejected,
    });
    await client.query("COMMIT");
    return NextResponse.json({ ok: true, rejected });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Reject pending puzzle failed:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to reject pending puzzle.",
      },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}

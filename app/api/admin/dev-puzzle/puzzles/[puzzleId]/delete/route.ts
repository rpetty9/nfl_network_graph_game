import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { isAdminSession } from "@/lib/admin";
import { pool } from "@/lib/db";
import { deleteFuturePuzzleAndShift } from "@/lib/dev-puzzle";

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
    const deleted = await deleteFuturePuzzleAndShift(client, puzzleId);
    await client.query("COMMIT");

    return NextResponse.json({ ok: true, ...deleted });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Delete future puzzle failed:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to delete future puzzle.",
      },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}

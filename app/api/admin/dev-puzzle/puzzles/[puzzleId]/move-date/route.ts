import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { isAdminSession } from "@/lib/admin";
import { pool } from "@/lib/db";
import { moveFuturePuzzleByDate } from "@/lib/dev-puzzle";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(
  request: Request,
  context: { params: Promise<{ puzzleId: string }> }
) {
  const session = await auth();
  if (!isAdminSession(session)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const client = await pool.connect();

  try {
    const { puzzleId } = await context.params;
    const body = (await request.json()) as {
      direction?: "earlier" | "later";
    };
    if (body.direction !== "earlier" && body.direction !== "later") {
      return NextResponse.json(
        { error: "Direction must be 'earlier' or 'later'." },
        { status: 400 }
      );
    }

    await client.query("BEGIN");
    await moveFuturePuzzleByDate(client, puzzleId, body.direction);
    await client.query("COMMIT");
    return NextResponse.json({ ok: true });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Move future puzzle date failed:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to reorder future puzzle.",
      },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}

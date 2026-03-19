import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { isAdminSession } from "@/lib/admin";
import { pool } from "@/lib/db";
import { swapFuturePuzzleSlots } from "@/lib/dev-puzzle";

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
      slotA?: number;
      slotB?: number;
    };
    await client.query("BEGIN");
    await swapFuturePuzzleSlots(
      client,
      puzzleId,
      Number(body.slotA ?? 0),
      Number(body.slotB ?? 0)
    );
    await client.query("COMMIT");
    return NextResponse.json({ ok: true });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Swap future puzzle slots failed:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to swap future puzzle slots.",
      },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}

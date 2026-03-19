import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { isAdminSession } from "@/lib/admin";
import { pool } from "@/lib/db";
import { getDevPuzzleDetail } from "@/lib/dev-puzzle";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ puzzleId: string }> }
) {
  try {
    const session = await auth();
    if (!isAdminSession(session)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { puzzleId } = await params;
    const detail = await getDevPuzzleDetail(pool, puzzleId);
    if (!detail) {
      return NextResponse.json({ error: "Puzzle not found." }, { status: 404 });
    }

    return NextResponse.json(detail);
  } catch (error) {
    console.error("Dev puzzle detail route failed:", error);
    return NextResponse.json(
      { error: "Failed to load puzzle detail." },
      { status: 500 }
    );
  }
}

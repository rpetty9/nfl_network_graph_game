import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { isAdminSession } from "@/lib/admin";
import { pool } from "@/lib/db";
import { getDevPuzzleList } from "@/lib/dev-puzzle";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const session = await auth();
    if (!isAdminSession(session)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const puzzles = await getDevPuzzleList(pool);
    return NextResponse.json({ puzzles });
  } catch (error) {
    console.error("Dev puzzle list route failed:", error);
    return NextResponse.json(
      { error: "Failed to load dev puzzles." },
      { status: 500 }
    );
  }
}

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { isAdminSession } from "@/lib/admin";
import { pool } from "@/lib/db";
import { getDevDashboardStats } from "@/lib/dev-puzzle";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!isAdminSession(session)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const requestedDays = Number(searchParams.get("days") ?? "14");
    const stats = await getDevDashboardStats(pool, requestedDays);
    return NextResponse.json(stats);
  } catch (error) {
    console.error("Dev puzzle stats route failed:", error);
    return NextResponse.json(
      { error: "Failed to load dev dashboard stats." },
      { status: 500 }
    );
  }
}

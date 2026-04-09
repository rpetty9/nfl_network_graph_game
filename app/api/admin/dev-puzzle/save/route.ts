import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { isAdminSession } from "@/lib/admin";
import { pool } from "@/lib/db";
import { savePuzzleFromConfig, type DevPuzzleConfig } from "@/lib/dev-puzzle";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!isAdminSession(session)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const client = await pool.connect();

  try {
    const body = (await request.json()) as Partial<DevPuzzleConfig>;
    const config: DevPuzzleConfig = {
      title: typeof body.title === "string" ? body.title : "",
      startSeason:
        typeof body.startSeason === "number" ? body.startSeason : Number(body.startSeason ?? 0),
      endSeason:
        typeof body.endSeason === "number" ? body.endSeason : Number(body.endSeason ?? 0),
      relationshipRuleId:
        typeof body.relationshipRuleId === "string" ||
        typeof body.relationshipRuleId === "number"
          ? body.relationshipRuleId
          : "",
      slotRuleIds: Array.isArray(body.slotRuleIds) ? body.slotRuleIds : [],
      positionOverlayEnabled: Boolean(body.positionOverlayEnabled),
      qbExclusionEnabled: Boolean(body.qbExclusionEnabled),
      rbExclusionEnabled: Boolean((body as { rbExclusionEnabled?: unknown }).rbExclusionEnabled),
      wrExclusionEnabled: Boolean((body as { wrExclusionEnabled?: unknown }).wrExclusionEnabled),
    };
    const publishedFlag =
      typeof (body as { publishedFlag?: unknown }).publishedFlag === "boolean"
        ? Boolean((body as { publishedFlag?: unknown }).publishedFlag)
        : true;

    await client.query("BEGIN");
    const saved = await savePuzzleFromConfig(client, config, { publishedFlag });
    await client.query("COMMIT");

    return NextResponse.json({
      ok: true,
      puzzle_date: saved.puzzleDate,
      puzzle_id: saved.puzzleId,
      preview: saved.preview,
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Dev puzzle save route failed:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to save dev puzzle.",
      },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}

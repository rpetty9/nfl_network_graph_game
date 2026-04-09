import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { isAdminSession } from "@/lib/admin";
import { pool } from "@/lib/db";
import {
  computePreviewPayload,
  sanitizeGeneratorSettings,
  type DevPuzzleConfig,
  type DevGeneratorSettings,
} from "@/lib/dev-puzzle";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!isAdminSession(session)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json()) as Partial<DevPuzzleConfig> & {
      generatorSettings?: Partial<DevGeneratorSettings> | null;
    };
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

    const preview = await computePreviewPayload(pool, config, {
      generatorSettings: body.generatorSettings
        ? sanitizeGeneratorSettings(body.generatorSettings)
        : null,
    });
    return NextResponse.json(preview);
  } catch (error) {
    console.error("Dev puzzle preview route failed:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to preview dev puzzle.",
      },
      { status: 500 }
    );
  }
}

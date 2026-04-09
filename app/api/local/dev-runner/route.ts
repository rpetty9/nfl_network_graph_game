import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getDevApprovalQueue, getDevPuzzleMeta, sanitizeGeneratorSettings } from "@/lib/dev-puzzle";
import {
  getLocalRunnerSnapshot,
  startLocalRunner,
  stopLocalRunner,
} from "@/lib/local-dev-runner";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function assertLocalOnly() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("This route is only available in local development.");
  }
}

export async function GET() {
  try {
    assertLocalOnly();
    const [meta, queue, runner] = await Promise.all([
      getDevPuzzleMeta(pool),
      getDevApprovalQueue(pool),
      getLocalRunnerSnapshot(),
    ]);

    return NextResponse.json({
      runner,
      meta,
      queue,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to load local runner status.",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    assertLocalOnly();
    const body = (await request.json()) as Record<string, unknown>;

    if (body.action === "stop") {
      const snapshot = await stopLocalRunner();
      const queue = await getDevApprovalQueue(pool);
      return NextResponse.json({ runner: snapshot, queue });
    }

    if (body.action !== "start") {
      return NextResponse.json({ error: "Invalid action." }, { status: 400 });
    }

    const snapshot = await startLocalRunner(
      sanitizeGeneratorSettings({
        targetPendingCount: body.targetPendingCount as number | undefined,
        minActiveLinks: body.minActiveLinks as number | undefined,
        usageThresholdTotal: body.usageThresholdTotal as number | undefined,
        maxQbs: body.maxQbs as number | undefined,
        minFantasyPointsPerSeason: body.minFantasyPointsPerSeason as number | undefined,
        maxAttemptsPerPuzzle: body.maxAttemptsPerPuzzle as number | undefined,
        forcePositionLock: body.forcePositionLock as boolean | undefined,
        forceNoQbs: body.forceNoQbs as boolean | undefined,
        forceNoRbs: body.forceNoRbs as boolean | undefined,
        forceNoWrs: body.forceNoWrs as boolean | undefined,
        useAnchorSearch: body.useAnchorSearch as boolean | undefined,
        useSkeletonScoring: body.useSkeletonScoring as boolean | undefined,
        useThresholdMemory: body.useThresholdMemory as boolean | undefined,
        anchorCount: body.anchorCount as number | undefined,
        stageWidth: body.stageWidth as number | undefined,
        beamWidth: body.beamWidth as number | undefined,
        lockedStartSeason: body.lockedStartSeason as number | undefined,
        lockedEndSeason: body.lockedEndSeason as number | undefined,
        lockedRelationshipRuleId: body.lockedRelationshipRuleId as string | undefined,
        lockedSlotRuleIds: body.lockedSlotRuleIds as string[] | undefined,
      })
    );
    const queue = await getDevApprovalQueue(pool);

    return NextResponse.json({ runner: snapshot, queue });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to update local runner.",
      },
      { status: 500 }
    );
  }
}

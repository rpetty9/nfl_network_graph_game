import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { isAdminSession } from "@/lib/admin";
import { pool } from "@/lib/db";
import {
  getDevApprovalQueue,
  processDevGeneratorJobs,
  upsertDevGeneratorJob,
} from "@/lib/dev-puzzle";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const session = await auth();
    if (!isAdminSession(session)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const queue = await getDevApprovalQueue(pool);
    return NextResponse.json(queue);
  } catch (error) {
    console.error("Dev puzzle queue route failed:", error);
    return NextResponse.json(
      { error: "Failed to load dev approval queue." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!isAdminSession(session)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const client = await pool.connect();

  try {
    const body = (await request.json()) as {
      action?: "start" | "stop" | "run_now" | "save_settings";
      targetPendingCount?: number;
      minActiveLinks?: number;
      usageThresholdTotal?: number;
      maxQbs?: number;
      minFantasyPointsPerSeason?: number;
      maxAttemptsPerPuzzle?: number;
      forcePositionLock?: boolean;
      forceNoQbs?: boolean;
      useAnchorSearch?: boolean;
      useSkeletonScoring?: boolean;
      useThresholdMemory?: boolean;
      anchorCount?: number;
      stageWidth?: number;
      beamWidth?: number;
    };

    await client.query("BEGIN");

    if (body.action === "run_now") {
      await upsertDevGeneratorJob(client, {
        targetPendingCount: body.targetPendingCount,
        minActiveLinks: body.minActiveLinks,
        usageThresholdTotal: body.usageThresholdTotal,
        maxQbs: body.maxQbs,
        minFantasyPointsPerSeason: body.minFantasyPointsPerSeason,
        maxAttemptsPerPuzzle: body.maxAttemptsPerPuzzle,
        forcePositionLock: body.forcePositionLock,
        forceNoQbs: body.forceNoQbs,
        useAnchorSearch: body.useAnchorSearch,
        useSkeletonScoring: body.useSkeletonScoring,
        useThresholdMemory: body.useThresholdMemory,
        anchorCount: body.anchorCount,
        stageWidth: body.stageWidth,
        beamWidth: body.beamWidth,
      });
      const runResult = await processDevGeneratorJobs(client, {
        force: true,
        maxGenerate: 1,
      });
      const queue = await getDevApprovalQueue(client);
      await client.query("COMMIT");
      return NextResponse.json({ ok: true, runResult, ...queue });
    }

    const activeFlag =
      body.action === "start" ? true : body.action === "stop" ? false : undefined;

    await upsertDevGeneratorJob(client, {
      active_flag: activeFlag,
      targetPendingCount: body.targetPendingCount,
      minActiveLinks: body.minActiveLinks,
      usageThresholdTotal: body.usageThresholdTotal,
      maxQbs: body.maxQbs,
      minFantasyPointsPerSeason: body.minFantasyPointsPerSeason,
      maxAttemptsPerPuzzle: body.maxAttemptsPerPuzzle,
      forcePositionLock: body.forcePositionLock,
      forceNoQbs: body.forceNoQbs,
      useAnchorSearch: body.useAnchorSearch,
      useSkeletonScoring: body.useSkeletonScoring,
      useThresholdMemory: body.useThresholdMemory,
      anchorCount: body.anchorCount,
      stageWidth: body.stageWidth,
      beamWidth: body.beamWidth,
    });

    const queue = await getDevApprovalQueue(client);
    await client.query("COMMIT");
    return NextResponse.json({ ok: true, ...queue });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Dev puzzle queue update failed:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to update puzzle queue.",
      },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}

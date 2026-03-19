import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { isAdminSession } from "@/lib/admin";
import { pool } from "@/lib/db";
import { appendDevOptimizerLog, listDevOptimizerLog } from "@/lib/dev-puzzle";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const session = await auth();
    if (!isAdminSession(session)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const entries = await listDevOptimizerLog(pool);
    return NextResponse.json({ entries });
  } catch (error) {
    console.error("Optimizer log route failed:", error);
    return NextResponse.json(
      { error: "Failed to load optimizer log." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!isAdminSession(session)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json()) as {
      logKey?: string | null;
      kind?: string;
      title?: string;
      detail?: string;
      metadata?: Record<string, unknown> | null;
      occurredAt?: string | null;
    };

    if (!body.kind || !body.title || !body.detail) {
      return NextResponse.json(
        { error: "kind, title, and detail are required." },
        { status: 400 }
      );
    }

    const entry = await appendDevOptimizerLog(pool, {
      logKey: body.logKey ?? null,
      kind: body.kind,
      title: body.title,
      detail: body.detail,
      metadata: body.metadata ?? null,
      occurredAt: body.occurredAt ?? null,
    });

    return NextResponse.json({ ok: true, entry });
  } catch (error) {
    console.error("Optimizer log write failed:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to write optimizer log.",
      },
      { status: 500 }
    );
  }
}

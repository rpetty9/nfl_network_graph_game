import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { processDevGeneratorJobs } from "@/lib/dev-puzzle";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function isAuthorized(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return process.env.NODE_ENV !== "production";
  }
  return request.headers.get("authorization") === `Bearer ${cronSecret}`;
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const result = await processDevGeneratorJobs(client);
    await client.query("COMMIT");
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Dev puzzle queue cron failed:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to process dev puzzle queue.",
      },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}

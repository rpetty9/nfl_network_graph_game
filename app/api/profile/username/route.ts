import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { setUsernameForUser } from "@/lib/users";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    const userId = session?.user?.id;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => null);
    const username = typeof body?.username === "string" ? body.username : "";
    const result = await setUsernameForUser(userId, username);

    if (!result.ok) {
      return NextResponse.json(
        { error: "That username is not available." },
        { status: 400 }
      );
    }

    return NextResponse.json({
      username: result.user.username,
    });
  } catch (error) {
    if ((error as { code?: string }).code === "23505") {
      return NextResponse.json(
        { error: "That username is not available." },
        { status: 400 }
      );
    }

    console.error("Username route failed:", error);
    return NextResponse.json(
      { error: "Unable to save username." },
      { status: 500 }
    );
  }
}

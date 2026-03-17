import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { updateAvatarForUser } from "@/lib/users";

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
    const avatarStyle =
      typeof body?.avatar_style === "string" ? body.avatar_style : "";
    const avatarBg = typeof body?.avatar_bg === "string" ? body.avatar_bg : "";
    const avatarAccent =
      typeof body?.avatar_accent === "string" ? body.avatar_accent : "";

    const result = await updateAvatarForUser({
      userId,
      avatarStyle,
      avatarBg,
      avatarAccent,
    });

    if (!result.ok) {
      return NextResponse.json(
        { error: "That avatar selection is not valid." },
        { status: 400 }
      );
    }

    return NextResponse.json({
      avatar_style: result.user.avatar_style,
      avatar_bg: result.user.avatar_bg,
      avatar_accent: result.user.avatar_accent,
    });
  } catch (error) {
    console.error("Avatar route failed:", error);
    return NextResponse.json(
      { error: "Unable to save avatar." },
      { status: 500 }
    );
  }
}

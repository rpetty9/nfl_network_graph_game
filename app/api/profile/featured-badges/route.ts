import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { updateFeaturedBadgesForUser } from "@/lib/users";

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
    const featuredBadges = Array.isArray(body?.featured_badges)
      ? body.featured_badges
      : [];

    const result = await updateFeaturedBadgesForUser({
      userId,
      featuredBadges,
    });

    if (!result.ok) {
      return NextResponse.json(
        { error: "Unable to save featured badges." },
        { status: 400 }
      );
    }

    return NextResponse.json({
      featured_badges: result.user.featured_badges,
    });
  } catch (error) {
    console.error("Featured badges route failed:", error);
    return NextResponse.json(
      { error: "Unable to save featured badges." },
      { status: 500 }
    );
  }
}

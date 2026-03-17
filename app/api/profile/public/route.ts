import { NextRequest, NextResponse } from "next/server";
import { getPublicUserProfileById } from "@/lib/users";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    const userId = request.nextUrl.searchParams.get("userId");
    if (!userId) {
      return NextResponse.json({ error: "Missing user id." }, { status: 400 });
    }

    const profile = await getPublicUserProfileById(userId);
    if (!profile) {
      return NextResponse.json({ error: "Profile not found." }, { status: 404 });
    }

    return NextResponse.json({ profile });
  } catch (error) {
    console.error("Public profile route failed:", error);
    return NextResponse.json(
      { error: "Unable to load profile." },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  findUserByExactUsername,
  getFriendOverviewForUser,
  respondToFriendRequest,
  sendFriendRequest,
} from "@/lib/users";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    const userId = session?.user?.id;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const username = request.nextUrl.searchParams.get("username");
    if (username) {
      const match = await findUserByExactUsername(username, userId);
      return NextResponse.json({ match });
    }

    const overview = await getFriendOverviewForUser(userId);
    return NextResponse.json({ overview });
  } catch (error) {
    console.error("Friends route failed:", error);
    return NextResponse.json(
      { error: "Unable to load friends." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    const userId = session?.user?.id;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const body = await request.json().catch(() => null);
    const action = typeof body?.action === "string" ? body.action : "";
    const targetUserId =
      typeof body?.target_user_id === "string" ? body.target_user_id : "";

    if (!targetUserId) {
      return NextResponse.json({ error: "Target user is required." }, { status: 400 });
    }

    if (action === "send") {
      const result = await sendFriendRequest(userId, targetUserId);
      if (!result.ok) {
        const message =
          result.reason === "self"
            ? "You cannot add yourself."
            : result.reason === "already_friends"
              ? "You are already friends."
              : result.reason === "already_pending"
                ? "Friend request already pending."
                : "User not found.";
        return NextResponse.json({ error: message }, { status: 400 });
      }

      return NextResponse.json(result);
    }

    if (
      action === "accept" ||
      action === "decline" ||
      action === "cancel" ||
      action === "remove"
    ) {
      const result = await respondToFriendRequest({
        userId,
        targetUserId,
        action,
      });

      if (!result.ok) {
        return NextResponse.json({ error: "Unable to update friend request." }, { status: 400 });
      }

      return NextResponse.json(result);
    }

    return NextResponse.json({ error: "Invalid action." }, { status: 400 });
  } catch (error) {
    console.error("Friends action route failed:", error);
    return NextResponse.json(
      { error: "Unable to update friends." },
      { status: 500 }
    );
  }
}

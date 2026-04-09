import { pool } from "@/lib/db";
import {
  AVATAR_COLORS,
  AVATAR_STYLES,
  DEFAULT_AVATAR,
  type AvatarColor,
  type AvatarStyle,
} from "@/lib/avatar";
import {
  BADGE_ORDER,
  FRIEND_COUNT_BADGES,
  FRIEND_WIN_BADGES,
  LINK_COUNT_BADGES,
  STREAK_BADGES,
  SUBMISSION_COUNT_BADGES,
  getBadgeDefinition,
  hydrateBadge,
  isBadgeKey,
  type BadgeKey,
  type UserBadge,
} from "@/lib/badges";

export type AppUser = {
  user_id: string;
  google_subject: string;
  email: string;
  email_normalized: string;
  created_at: string;
  username: string | null;
  username_normalized: string | null;
  avatar_style: AvatarStyle;
  avatar_bg: AvatarColor;
  avatar_accent: AvatarColor;
  avatar_border: AvatarColor;
  featured_badges: BadgeKey[];
  status: string;
  badges: UserBadge[];
  stats: {
    puzzles_submitted: number;
    leaderboard_finishes: number;
    links_created: number;
    longest_submission_streak: number;
    friends_count: number;
    friend_daily_wins: number;
  };
  recent_submissions: RecentSubmission[];
};

export type PublicUserProfile = {
  user_id: string;
  created_at: string;
  username: string | null;
  avatar_style: AvatarStyle;
  avatar_bg: AvatarColor;
  avatar_accent: AvatarColor;
  avatar_border: AvatarColor;
  featured_badges: BadgeKey[];
  badges: UserBadge[];
  stats: {
    puzzles_submitted: number;
    leaderboard_finishes: number;
    links_created: number;
    longest_submission_streak: number;
    friends_count: number;
    friend_daily_wins: number;
  };
  recent_submissions: RecentSubmission[];
};

export type RecentSubmission = {
  submission_id: number;
  puzzle_date: string;
  final_score: number;
  base_score: number;
  active_links: number;
  multiplier: number;
  percent_of_optimal: number | null;
  placement: number | null;
};

export type FriendProfileSummary = {
  user_id: string;
  username: string;
  avatar_style: AvatarStyle;
  avatar_bg: AvatarColor;
  avatar_accent: AvatarColor;
  avatar_border: AvatarColor;
  created_at: string;
};

export type FriendRequestSummary = FriendProfileSummary & {
  request_id: string;
  direction: "incoming" | "outgoing";
  status: "pending";
  requested_at: string;
};

export type FriendOverview = {
  friends: FriendProfileSummary[];
  incoming_requests: FriendRequestSummary[];
  outgoing_requests: FriendRequestSummary[];
};

export type FriendSearchResult = FriendProfileSummary & {
  relationship_status: "self" | "friend" | "incoming" | "outgoing" | "none";
};

type AppUserRow = Omit<AppUser, "badges" | "stats">;

type UserBadgeRow = {
  badge_key: string;
  awarded_at: string;
  awarded_by_user_id: string | null;
  award_note: string | null;
};

type RecentSubmissionRow = {
  submission_id: string;
  puzzle_date: string;
  final_score: string;
  base_score: string;
  active_links: string;
  multiplier: string;
  percent_of_optimal: string | null;
  placement: string | null;
};

type FriendSummaryRow = {
  user_id: string;
  username: string;
  avatar_style: AvatarStyle;
  avatar_bg: AvatarColor;
  avatar_accent: AvatarColor;
  avatar_border: AvatarColor;
  created_at: string;
};

type FriendRequestRow = FriendSummaryRow & {
  request_id: string;
  requested_at: string;
};

type FriendRelationshipRow = {
  requester_user_id: string;
  addressee_user_id: string;
  status: "pending" | "accepted" | "declined";
};

type UsernameValidationResult =
  | { ok: true; username: string; usernameNormalized: string }
  | { ok: false; reason: "invalid" | "blocked" };

const USERNAME_REGEX = /^[A-Za-z][A-Za-z0-9_]{2,15}$/;

const RESERVED_USERNAMES = new Set(
  [
    "admin",
    "administrator",
    "auth",
    "google",
    "guest",
    "help",
    "mod",
    "moderator",
    "nfl",
    "official",
    "owner",
    "route",
    "routes",
    "score",
    "scores",
    "signin",
    "signout",
    "support",
    "system",
    "fivewide",
    "five_wide",
  ].map((value) => value.toLowerCase())
);

const BLOCKED_USERNAME_PARTS = [
  "1488",
  "admin",
  "anal",
  "arse",
  "asshole",
  "bastard",
  "bitch",
  "boner",
  "bullshit",
  "chink",
  "clit",
  "coon",
  "cuck",
  "cunt",
  "dick",
  "dyke",
  "fag",
  "faggot",
  "fuck",
  "heil",
  "hitler",
  "isis",
  "jizz",
  "kike",
  "kkk",
  "nazi",
  "nig",
  "penis",
  "porn",
  "pussy",
  "rape",
  "rapist",
  "sex",
  "shit",
  "slut",
  "spic",
  "tard",
  "twat",
  "vagina",
  "whore",
];

function foldUsername(value: string) {
  return value
    .toLowerCase()
    .replace(/[_\W]+/g, "")
    .replace(/0/g, "o")
    .replace(/1/g, "i")
    .replace(/3/g, "e")
    .replace(/4/g, "a")
    .replace(/5/g, "s")
    .replace(/7/g, "t")
    .replace(/8/g, "b");
}

export function validateUsername(rawValue: string): UsernameValidationResult {
  const username = rawValue.trim();
  if (!USERNAME_REGEX.test(username)) {
    return { ok: false, reason: "invalid" };
  }

  const usernameNormalized = username.toLowerCase();
  const folded = foldUsername(usernameNormalized);

  if (RESERVED_USERNAMES.has(usernameNormalized) || RESERVED_USERNAMES.has(folded)) {
    return { ok: false, reason: "blocked" };
  }

  const blocked = BLOCKED_USERNAME_PARTS.some((value) => {
    return usernameNormalized.includes(value) || folded.includes(value);
  });

  if (blocked) {
    return { ok: false, reason: "blocked" };
  }

  return {
    ok: true,
    username,
    usernameNormalized,
  };
}

const USER_SELECT_COLUMNS = `
  user_id::text,
  google_subject,
  email,
  email_normalized,
  created_at::text,
  username,
  username_normalized,
  avatar_style,
  avatar_bg,
  avatar_accent,
  avatar_border,
  COALESCE(featured_badges, ARRAY[]::text[]) AS featured_badges,
  status
`;

function sanitizeFeaturedBadges(value: unknown): BadgeKey[] {
  if (!Array.isArray(value)) return [];

  const unique = [...new Set(value.filter((entry) => typeof entry === "string"))];
  return unique.filter((entry): entry is BadgeKey => isBadgeKey(entry)).slice(0, 3);
}

function mapFriendSummary(row: FriendSummaryRow): FriendProfileSummary {
  return {
    user_id: row.user_id,
    username: row.username,
    avatar_style: row.avatar_style,
    avatar_bg: row.avatar_bg,
    avatar_accent: row.avatar_accent,
    avatar_border: row.avatar_border,
    created_at: row.created_at,
  };
}

async function loadBadgesForUser(userId: string) {
  const result = await pool.query<UserBadgeRow>(
    `
    SELECT
      badge_key,
      awarded_at::text,
      awarded_by_user_id::text,
      award_note
    FROM user_badge
    WHERE user_id = $1
    ORDER BY awarded_at DESC
    `,
    [userId]
  );

  const badges = result.rows
    .map((row) =>
      hydrateBadge({
        badgeKey: row.badge_key,
        awardedAt: row.awarded_at,
        awardedByUserId: row.awarded_by_user_id,
        awardNote: row.award_note,
      })
    )
    .filter((badge): badge is UserBadge => badge !== null);

  badges.sort((a, b) => {
    const orderA = BADGE_ORDER.indexOf(a.badgeKey);
    const orderB = BADGE_ORDER.indexOf(b.badgeKey);
    if (orderA !== orderB) return orderA - orderB;
    return b.awardedAt.localeCompare(a.awardedAt);
  });

  return badges;
}

async function loadStatsForUser(userId: string) {
  const [
    submissionStatsResult,
    leaderboardStatsResult,
    streakStatsResult,
    friendsStatsResult,
    friendWinsResult,
  ] = await Promise.all([
    pool.query<{
      puzzles_submitted: string;
      links_created: string;
    }>(
      `
      SELECT
        COUNT(*)::text AS puzzles_submitted,
        COALESCE(SUM(active_links), 0)::text AS links_created
      FROM puzzle_submission
      WHERE user_id = $1
      `,
      [Number(userId)]
    ),
    pool.query<{ leaderboard_finishes: string }>(
      `
      SELECT COUNT(*)::text AS leaderboard_finishes
      FROM daily_leaderboard_finish
      WHERE user_id = $1
      `,
      [Number(userId)]
    ),
    pool.query<{ longest_submission_streak: string }>(
      `
      WITH distinct_dates AS (
        SELECT DISTINCT dp.puzzle_date::date AS puzzle_date
        FROM puzzle_submission ps
        JOIN daily_puzzle dp
          ON dp.puzzle_id = ps.puzzle_id
        WHERE ps.user_id = $1
      ),
      grouped_dates AS (
        SELECT
          puzzle_date,
          puzzle_date - (ROW_NUMBER() OVER (ORDER BY puzzle_date))::int AS streak_group
        FROM distinct_dates
      ),
      streak_lengths AS (
        SELECT COUNT(*)::int AS streak_length
        FROM grouped_dates
        GROUP BY streak_group
      )
      SELECT COALESCE(MAX(streak_length), 0)::text AS longest_submission_streak
      FROM streak_lengths
      `,
      [Number(userId)]
    ),
    pool.query<{ friends_count: string }>(
      `
      SELECT COUNT(DISTINCT
        CASE
          WHEN requester_user_id = $1 THEN addressee_user_id
          ELSE requester_user_id
        END
      )::text AS friends_count
      FROM user_friend_request
      WHERE status = 'accepted'
        AND ($1 IN (requester_user_id, addressee_user_id))
      `,
      [Number(userId)]
    ),
    pool.query<{ friend_daily_wins: string }>(
      `
      WITH accepted_friends AS (
        SELECT DISTINCT
          CASE
            WHEN requester_user_id = $1 THEN addressee_user_id
            ELSE requester_user_id
          END AS friend_user_id
        FROM user_friend_request
        WHERE status = 'accepted'
          AND ($1 IN (requester_user_id, addressee_user_id))
      ),
      friend_wins AS (
        SELECT DISTINCT ps.puzzle_id
        FROM puzzle_submission ps
        JOIN accepted_friends af
          ON TRUE
        JOIN puzzle_submission fps
          ON fps.puzzle_id = ps.puzzle_id
         AND fps.user_id = af.friend_user_id
        WHERE ps.user_id = $1
          AND ps.user_id IS NOT NULL
          AND fps.final_score < ps.final_score
      )
      SELECT COUNT(*)::text AS friend_daily_wins
      FROM friend_wins
      `,
      [Number(userId)]
    ),
  ]);

  return {
    puzzles_submitted: Number(
      submissionStatsResult.rows[0]?.puzzles_submitted ?? "0"
    ),
    leaderboard_finishes: Number(
      leaderboardStatsResult.rows[0]?.leaderboard_finishes ?? "0"
    ),
    links_created: Number(submissionStatsResult.rows[0]?.links_created ?? "0"),
    longest_submission_streak: Number(
      streakStatsResult.rows[0]?.longest_submission_streak ?? "0"
    ),
    friends_count: Number(friendsStatsResult.rows[0]?.friends_count ?? "0"),
    friend_daily_wins: Number(friendWinsResult.rows[0]?.friend_daily_wins ?? "0"),
  };
}

async function loadRecentSubmissionsForUser(userId: string, limit = 6) {
  const result = await pool.query<RecentSubmissionRow>(
    `
    SELECT
      ps.submission_id::text,
      dp.puzzle_date::text,
      ps.final_score::text,
      ps.base_score::text,
      ps.active_links::text,
      ps.multiplier::text,
      ps.percent_of_optimal::text,
      dlf.placement::text
    FROM puzzle_submission ps
    JOIN daily_puzzle dp
      ON dp.puzzle_id = ps.puzzle_id
    LEFT JOIN daily_leaderboard_finish dlf
      ON dlf.puzzle_id = ps.puzzle_id
      AND dlf.user_id = ps.user_id
    WHERE ps.user_id = $1
    ORDER BY dp.puzzle_date DESC, ps.submitted_at DESC
    LIMIT $2
    `,
    [Number(userId), limit]
  );

  return result.rows.map((row) => ({
    submission_id: Number(row.submission_id),
    puzzle_date: row.puzzle_date,
    final_score: Number(row.final_score ?? "0"),
    base_score: Number(row.base_score ?? "0"),
    active_links: Number(row.active_links ?? "0"),
    multiplier: Number(row.multiplier ?? "1"),
    percent_of_optimal:
      row.percent_of_optimal == null ? null : Number(row.percent_of_optimal),
    placement: row.placement == null ? null : Number(row.placement),
  }));
}

export async function getAcceptedFriendUserIds(userId: string) {
  const result = await pool.query<{ user_id: string }>(
    `
    SELECT DISTINCT
      CASE
        WHEN requester_user_id = $1 THEN addressee_user_id::text
        ELSE requester_user_id::text
      END AS user_id
    FROM user_friend_request
    WHERE status = 'accepted'
      AND ($1 IN (requester_user_id, addressee_user_id))
    `,
    [Number(userId)]
  );

  return result.rows.map((row) => row.user_id);
}

async function awardFriendshipBadgesForUsers(userIds: string[]) {
  const uniqueUserIds = [...new Set(userIds.filter(Boolean))];

  await Promise.all(
    uniqueUserIds.map(async (userId) => {
      const stats = await loadStatsForUser(userId);
      const badgeKeys = FRIEND_COUNT_BADGES.filter(({ count }) => stats.friends_count >= count).map(
        ({ key }) => key
      );

      if (badgeKeys.length > 0) {
        await grantBadgesToUser({
          userId,
          badgeKeys,
        });
      }
    })
  );
}

function collectStatBasedBadgeKeys(stats: {
  puzzles_submitted: number;
  leaderboard_finishes: number;
  links_created: number;
  longest_submission_streak: number;
  friends_count: number;
  friend_daily_wins: number;
}) {
  const badgeKeys = new Set<BadgeKey>();

  SUBMISSION_COUNT_BADGES.forEach(({ count, key }) => {
    if (stats.puzzles_submitted >= count) {
      badgeKeys.add(key);
    }
  });

  LINK_COUNT_BADGES.forEach(({ count, key }) => {
    if (stats.links_created >= count) {
      badgeKeys.add(key);
    }
  });

  STREAK_BADGES.forEach(({ count, key }) => {
    if (stats.longest_submission_streak >= count) {
      badgeKeys.add(key);
    }
  });

  FRIEND_COUNT_BADGES.forEach(({ count, key }) => {
    if (stats.friends_count >= count) {
      badgeKeys.add(key);
    }
  });

  FRIEND_WIN_BADGES.forEach(({ count, key }) => {
    if (stats.friend_daily_wins >= count) {
      badgeKeys.add(key);
    }
  });

  return [...badgeKeys];
}

export async function getFriendOverviewForUser(userId: string): Promise<FriendOverview> {
  const [friendsResult, incomingResult, outgoingResult] = await Promise.all([
    pool.query<FriendSummaryRow>(
      `
      SELECT
        au.user_id::text,
        au.username,
        au.avatar_style,
        au.avatar_bg,
        au.avatar_accent,
        au.avatar_border,
        au.created_at::text
      FROM user_friend_request fr
      JOIN app_user au
        ON au.user_id = CASE
          WHEN fr.requester_user_id = $1 THEN fr.addressee_user_id
          ELSE fr.requester_user_id
        END
      WHERE fr.status = 'accepted'
        AND ($1 IN (fr.requester_user_id, fr.addressee_user_id))
        AND au.status = 'active'
        AND au.username IS NOT NULL
      ORDER BY LOWER(au.username) ASC
      `,
      [Number(userId)]
    ),
    pool.query<FriendRequestRow>(
      `
      SELECT
        fr.request_id::text,
        fr.created_at::text AS requested_at,
        au.user_id::text,
        au.username,
        au.avatar_style,
        au.avatar_bg,
        au.avatar_accent,
        au.avatar_border,
        au.created_at::text
      FROM user_friend_request fr
      JOIN app_user au
        ON au.user_id = fr.requester_user_id
      WHERE fr.addressee_user_id = $1
        AND fr.status = 'pending'
        AND au.status = 'active'
        AND au.username IS NOT NULL
      ORDER BY fr.created_at DESC
      `,
      [Number(userId)]
    ),
    pool.query<FriendRequestRow>(
      `
      SELECT
        fr.request_id::text,
        fr.created_at::text AS requested_at,
        au.user_id::text,
        au.username,
        au.avatar_style,
        au.avatar_bg,
        au.avatar_accent,
        au.avatar_border,
        au.created_at::text
      FROM user_friend_request fr
      JOIN app_user au
        ON au.user_id = fr.addressee_user_id
      WHERE fr.requester_user_id = $1
        AND fr.status = 'pending'
        AND au.status = 'active'
        AND au.username IS NOT NULL
      ORDER BY fr.created_at DESC
      `,
      [Number(userId)]
    ),
  ]);

  return {
    friends: friendsResult.rows.map(mapFriendSummary),
    incoming_requests: incomingResult.rows.map((row) => ({
      ...mapFriendSummary(row),
      request_id: row.request_id,
      direction: "incoming",
      status: "pending",
      requested_at: row.requested_at,
    })),
    outgoing_requests: outgoingResult.rows.map((row) => ({
      ...mapFriendSummary(row),
      request_id: row.request_id,
      direction: "outgoing",
      status: "pending",
      requested_at: row.requested_at,
    })),
  };
}

async function getFriendRelationshipStatus(userId: string, targetUserId: string) {
  const relationshipResult = await pool.query<FriendRelationshipRow>(
    `
    SELECT
      requester_user_id::text,
      addressee_user_id::text,
      status
    FROM user_friend_request
    WHERE (requester_user_id = $1 AND addressee_user_id = $2)
       OR (requester_user_id = $2 AND addressee_user_id = $1)
    ORDER BY
      CASE status
        WHEN 'accepted' THEN 0
        WHEN 'pending' THEN 1
        ELSE 2
      END,
      created_at DESC
    LIMIT 1
    `,
    [Number(userId), Number(targetUserId)]
  );

  const relationship = relationshipResult.rows[0];
  if (!relationship) return "none" as const;
  if (relationship.status === "accepted") return "friend" as const;
  if (relationship.requester_user_id === String(userId)) return "outgoing" as const;
  return "incoming" as const;
}

export async function findUserByExactUsername(
  rawUsername: string,
  currentUserId?: string | null
): Promise<FriendSearchResult | null> {
  const usernameNormalized = rawUsername.trim().toLowerCase();
  if (!usernameNormalized) return null;

  const result = await pool.query<FriendSummaryRow>(
    `
    SELECT
      user_id::text,
      username,
      avatar_style,
      avatar_bg,
      avatar_accent,
      avatar_border,
      created_at::text
    FROM app_user
    WHERE username_normalized = $1
      AND status = 'active'
      AND username IS NOT NULL
    LIMIT 1
    `,
    [usernameNormalized]
  );

  const user = result.rows[0];
  if (!user) return null;

  if (currentUserId && String(currentUserId) === user.user_id) {
    return {
      ...mapFriendSummary(user),
      relationship_status: "self",
    };
  }

  const relationshipStatus = currentUserId
    ? await getFriendRelationshipStatus(String(currentUserId), user.user_id)
    : "none";

  return {
    ...mapFriendSummary(user),
    relationship_status: relationshipStatus,
  };
}

export async function sendFriendRequest(userId: string, targetUserId: string) {
  if (String(userId) === String(targetUserId)) {
    return { ok: false as const, reason: "self" as const };
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const targetResult = await client.query<{ user_id: string }>(
      `
      SELECT user_id::text
      FROM app_user
      WHERE user_id = $1
        AND status = 'active'
        AND username IS NOT NULL
      LIMIT 1
      `,
      [Number(targetUserId)]
    );

    if (targetResult.rowCount === 0) {
      await client.query("ROLLBACK");
      return { ok: false as const, reason: "not_found" as const };
    }

    const relationshipResult = await client.query<FriendRelationshipRow>(
      `
      SELECT
        requester_user_id::text,
        addressee_user_id::text,
        status
      FROM user_friend_request
      WHERE (requester_user_id = $1 AND addressee_user_id = $2)
         OR (requester_user_id = $2 AND addressee_user_id = $1)
      ORDER BY created_at DESC
      `,
      [Number(userId), Number(targetUserId)]
    );

    const accepted = relationshipResult.rows.find((row) => row.status === "accepted");
    if (accepted) {
      await client.query("ROLLBACK");
      return { ok: false as const, reason: "already_friends" as const };
    }

    const incomingPending = relationshipResult.rows.find(
      (row) =>
        row.status === "pending" &&
        row.requester_user_id === String(targetUserId) &&
        row.addressee_user_id === String(userId)
    );

    if (incomingPending) {
      await client.query(
        `
        UPDATE user_friend_request
        SET status = 'accepted',
            responded_at = NOW()
        WHERE requester_user_id = $1
          AND addressee_user_id = $2
          AND status = 'pending'
        `,
        [Number(targetUserId), Number(userId)]
      );
      await client.query("COMMIT");
      await awardFriendshipBadgesForUsers([userId, targetUserId]);
      return { ok: true as const, relationship_status: "friend" as const };
    }

    const outgoingPending = relationshipResult.rows.find(
      (row) =>
        row.status === "pending" &&
        row.requester_user_id === String(userId) &&
        row.addressee_user_id === String(targetUserId)
    );

    if (outgoingPending) {
      await client.query("ROLLBACK");
      return { ok: false as const, reason: "already_pending" as const };
    }

    const existingSameDirection = relationshipResult.rows.find(
      (row) =>
        row.requester_user_id === String(userId) &&
        row.addressee_user_id === String(targetUserId)
    );

    if (existingSameDirection) {
      await client.query(
        `
        UPDATE user_friend_request
        SET status = 'pending',
            created_at = NOW(),
            responded_at = NULL
        WHERE requester_user_id = $1
          AND addressee_user_id = $2
        `,
        [Number(userId), Number(targetUserId)]
      );
    } else {
      await client.query(
        `
        INSERT INTO user_friend_request (
          requester_user_id,
          addressee_user_id,
          status
        )
        VALUES ($1, $2, 'pending')
        `,
        [Number(userId), Number(targetUserId)]
      );
    }

    await client.query("COMMIT");
    return { ok: true as const, relationship_status: "outgoing" as const };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function respondToFriendRequest(input: {
  userId: string;
  targetUserId: string;
  action: "accept" | "decline" | "cancel" | "remove";
}) {
  const requesterId =
    input.action === "accept" || input.action === "decline"
      ? Number(input.targetUserId)
      : Number(input.userId);
  const addresseeId =
    input.action === "accept" || input.action === "decline"
      ? Number(input.userId)
      : Number(input.targetUserId);

  if (input.action === "accept") {
    const result = await pool.query(
      `
      UPDATE user_friend_request
      SET status = 'accepted',
          responded_at = NOW()
      WHERE requester_user_id = $1
        AND addressee_user_id = $2
        AND status = 'pending'
      `,
      [requesterId, addresseeId]
    );

    if ((result.rowCount ?? 0) > 0) {
      await awardFriendshipBadgesForUsers([String(input.userId), String(input.targetUserId)]);
    }

    return { ok: (result.rowCount ?? 0) > 0, relationship_status: "friend" as const };
  }

  if (input.action === "decline") {
    const result = await pool.query(
      `
      UPDATE user_friend_request
      SET status = 'declined',
          responded_at = NOW()
      WHERE requester_user_id = $1
        AND addressee_user_id = $2
        AND status = 'pending'
      `,
      [requesterId, addresseeId]
    );

    return { ok: (result.rowCount ?? 0) > 0, relationship_status: "none" as const };
  }

  if (input.action === "cancel") {
    const result = await pool.query(
      `
      DELETE FROM user_friend_request
      WHERE requester_user_id = $1
        AND addressee_user_id = $2
        AND status = 'pending'
      `,
      [Number(input.userId), Number(input.targetUserId)]
    );

    return { ok: (result.rowCount ?? 0) > 0, relationship_status: "none" as const };
  }

  const result = await pool.query(
    `
    DELETE FROM user_friend_request
    WHERE status = 'accepted'
      AND (
        (requester_user_id = $1 AND addressee_user_id = $2)
        OR (requester_user_id = $2 AND addressee_user_id = $1)
      )
    `,
    [Number(input.userId), Number(input.targetUserId)]
  );

  return { ok: (result.rowCount ?? 0) > 0, relationship_status: "none" as const };
}

async function withUserBadges(user: AppUserRow | null): Promise<AppUser | null> {
  if (!user) return null;

  const derivedBadgeKeys: BadgeKey[] = ["account_created", "alpha_tester"];
  const hasCustomizedAvatar =
    user.avatar_style !== DEFAULT_AVATAR.style ||
    user.avatar_bg !== DEFAULT_AVATAR.bg ||
    user.avatar_accent !== DEFAULT_AVATAR.accent ||
    user.avatar_border !== DEFAULT_AVATAR.border;

  if (hasCustomizedAvatar) {
    derivedBadgeKeys.push("avatar_customized");
  }

  await grantBadgesToUser({
    userId: user.user_id,
    badgeKeys: derivedBadgeKeys,
  });

  const stats = await loadStatsForUser(user.user_id);

  await grantBadgesToUser({
    userId: user.user_id,
    badgeKeys: collectStatBasedBadgeKeys(stats),
  });

  const [badges, recentSubmissions] = await Promise.all([
    loadBadgesForUser(user.user_id),
    loadRecentSubmissionsForUser(user.user_id),
  ]);

  return {
    ...user,
    featured_badges: sanitizeFeaturedBadges(user.featured_badges),
    badges,
    stats,
    recent_submissions: recentSubmissions,
  };
}

export async function getUserByGoogleSubject(googleSubject: string) {
  const result = await pool.query<AppUserRow>(
    `
    SELECT
      ${USER_SELECT_COLUMNS}
    FROM app_user
    WHERE google_subject = $1
    LIMIT 1
    `,
    [googleSubject]
  );

  return withUserBadges(result.rows[0] ?? null);
}

export async function getUserById(userId: string) {
  const result = await pool.query<AppUserRow>(
    `
    SELECT
      ${USER_SELECT_COLUMNS}
    FROM app_user
    WHERE user_id = $1
    LIMIT 1
    `,
    [userId]
  );

  return withUserBadges(result.rows[0] ?? null);
}

export async function getPublicUserProfileById(userId: string): Promise<PublicUserProfile | null> {
  const result = await pool.query<AppUserRow>(
    `
    SELECT
      ${USER_SELECT_COLUMNS}
    FROM app_user
    WHERE user_id = $1
      AND status = 'active'
      AND username IS NOT NULL
    LIMIT 1
    `,
    [userId]
  );

  const user = await withUserBadges(result.rows[0] ?? null);
  if (!user) return null;

  return {
    user_id: user.user_id,
    created_at: user.created_at,
    username: user.username,
    avatar_style: user.avatar_style,
    avatar_bg: user.avatar_bg,
    avatar_accent: user.avatar_accent,
    avatar_border: user.avatar_border,
    featured_badges: user.featured_badges,
    badges: user.badges,
    stats: user.stats,
    recent_submissions: user.recent_submissions,
  };
}

export async function upsertGoogleUser(input: {
  googleSubject: string;
  email: string;
}) {
  const emailNormalized = input.email.trim().toLowerCase();

  const result = await pool.query<AppUserRow>(
    `
    INSERT INTO app_user (
      google_subject,
      email,
      email_normalized,
      avatar_style,
      avatar_bg,
      avatar_accent,
      avatar_border
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    ON CONFLICT (google_subject)
    DO UPDATE SET
      email = EXCLUDED.email,
      email_normalized = EXCLUDED.email_normalized
    RETURNING
      ${USER_SELECT_COLUMNS}
    `,
    [
      input.googleSubject,
      input.email.trim(),
      emailNormalized,
      DEFAULT_AVATAR.style,
      DEFAULT_AVATAR.bg,
      DEFAULT_AVATAR.accent,
      DEFAULT_AVATAR.border,
    ]
  );

  const user = result.rows[0];
  if (!user) return null;

  await grantBadgesToUser({
    userId: user.user_id,
    badgeKeys: ["account_created", "alpha_tester"],
  });

  return getUserById(user.user_id);
}

export async function setUsernameForUser(userId: string, rawUsername: string) {
  const validation = validateUsername(rawUsername);
  if (!validation.ok) {
    return validation;
  }

  const result = await pool.query<AppUserRow>(
    `
    UPDATE app_user
    SET
      username = $2,
      username_normalized = $3
    WHERE user_id = $1
      AND status = 'active'
    RETURNING
      ${USER_SELECT_COLUMNS}
    `,
    [userId, validation.username, validation.usernameNormalized]
  );

  if (result.rowCount === 0) {
    return { ok: false as const, reason: "blocked" as const };
  }

  return {
    ok: true as const,
    user: (await withUserBadges(result.rows[0])) as AppUser,
  };
}

export function isAvatarStyle(value: string): value is AvatarStyle {
  return AVATAR_STYLES.includes(value as AvatarStyle);
}

export function isAvatarColor(value: string): value is AvatarColor {
  return AVATAR_COLORS.includes(value as AvatarColor);
}

export async function updateAvatarForUser(input: {
  userId: string;
  avatarStyle: string;
  avatarBg: string;
  avatarAccent: string;
  avatarBorder: string;
}) {
  if (
    !isAvatarStyle(input.avatarStyle) ||
    !isAvatarColor(input.avatarBg) ||
    !isAvatarColor(input.avatarAccent) ||
    !isAvatarColor(input.avatarBorder)
  ) {
    return { ok: false as const, reason: "invalid" as const };
  }

  const result = await pool.query<AppUserRow>(
    `
    UPDATE app_user
    SET
      avatar_style = $2,
      avatar_bg = $3,
      avatar_accent = $4,
      avatar_border = $5
    WHERE user_id = $1
      AND status = 'active'
    RETURNING
      ${USER_SELECT_COLUMNS}
    `,
    [
      input.userId,
      input.avatarStyle,
      input.avatarBg,
      input.avatarAccent,
      input.avatarBorder,
    ]
  );

  if (result.rowCount === 0) {
    return { ok: false as const, reason: "invalid" as const };
  }

  await grantBadgesToUser({
    userId: input.userId,
    badgeKeys: ["avatar_customized"],
  });

  return {
    ok: true as const,
    user: (await getUserById(input.userId)) as AppUser,
  };
}

export async function updateFeaturedBadgesForUser(input: {
  userId: string;
  featuredBadges: string[];
}) {
  const nextBadges = sanitizeFeaturedBadges(input.featuredBadges);

  const earnedResult = await pool.query<{ badge_key: string }>(
    `
    SELECT badge_key
    FROM user_badge
    WHERE user_id = $1
    `,
    [Number(input.userId)]
  );

  const earnedBadgeKeys = new Set(
    earnedResult.rows
      .map((row) => row.badge_key)
      .filter((badgeKey): badgeKey is BadgeKey => isBadgeKey(badgeKey))
  );

  const allowedFeaturedBadges = nextBadges.filter((badgeKey) =>
    earnedBadgeKeys.has(badgeKey)
  );

  const result = await pool.query<AppUserRow>(
    `
    UPDATE app_user
    SET featured_badges = $2::text[]
    WHERE user_id = $1
      AND status = 'active'
    RETURNING
      ${USER_SELECT_COLUMNS}
    `,
    [Number(input.userId), allowedFeaturedBadges]
  );

  if (result.rowCount === 0) {
    return { ok: false as const, reason: "invalid" as const };
  }

  return {
    ok: true as const,
    user: (await withUserBadges(result.rows[0])) as AppUser,
  };
}

export async function grantBadgesToUser(input: {
  userId: string;
  badgeKeys: BadgeKey[];
  awardedByUserId?: string | null;
  awardNote?: string | null;
}) {
  const uniqueBadgeKeys = [...new Set(input.badgeKeys)].filter((badgeKey) =>
    isBadgeKey(badgeKey)
  );

  if (uniqueBadgeKeys.length === 0) {
    return [] as UserBadge[];
  }

  const result = await pool.query<UserBadgeRow>(
    `
    INSERT INTO user_badge (
      user_id,
      badge_key,
      awarded_by_user_id,
      award_note
    )
    SELECT
      $1::bigint,
      badge_key,
      $3::bigint,
      $4
    FROM unnest($2::text[]) AS badge_key
    ON CONFLICT (user_id, badge_key)
    DO NOTHING
    RETURNING
      badge_key,
      awarded_at::text,
      awarded_by_user_id::text,
      award_note
    `,
    [
      Number(input.userId),
      uniqueBadgeKeys,
      input.awardedByUserId ? Number(input.awardedByUserId) : null,
      input.awardNote ?? null,
    ]
  );

  return result.rows
    .map((row) =>
      hydrateBadge({
        badgeKey: row.badge_key,
        awardedAt: row.awarded_at,
        awardedByUserId: row.awarded_by_user_id,
        awardNote: row.award_note,
      })
    )
    .filter((badge): badge is UserBadge => badge !== null)
    .sort(
      (a, b) => BADGE_ORDER.indexOf(a.badgeKey) - BADGE_ORDER.indexOf(b.badgeKey)
    );
}

export async function awardBadgesForSubmission(input: {
  userId: string;
  activeLinks: number;
  finalScore?: number | null;
  optimalFinalScore?: number | null;
}) {
  const stats = await loadStatsForUser(input.userId);
  const badgeKeys = new Set<BadgeKey>(collectStatBasedBadgeKeys(stats));

  if (input.activeLinks >= 10) {
    badgeKeys.add("ten_links_submission");
  }

  if (
    input.finalScore != null &&
    input.optimalFinalScore != null &&
    Math.abs(Number(input.finalScore) - Number(input.optimalFinalScore)) < 0.005
  ) {
    badgeKeys.add("optimal_lineup_submission");
  }

  return grantBadgesToUser({
    userId: input.userId,
    badgeKeys: [...badgeKeys],
  });
}

export function getManualBadgeKeys() {
  return BADGE_ORDER.filter((badgeKey) => getBadgeDefinition(badgeKey)?.manualOnly);
}

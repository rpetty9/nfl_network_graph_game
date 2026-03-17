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
  username: string | null;
  username_normalized: string | null;
  avatar_style: AvatarStyle;
  avatar_bg: AvatarColor;
  avatar_accent: AvatarColor;
  status: string;
  badges: UserBadge[];
};

type AppUserRow = Omit<AppUser, "badges">;

type UserBadgeRow = {
  badge_key: string;
  awarded_at: string;
  awarded_by_user_id: string | null;
  award_note: string | null;
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
  username,
  username_normalized,
  avatar_style,
  avatar_bg,
  avatar_accent,
  status
`;

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

async function withUserBadges(user: AppUserRow | null): Promise<AppUser | null> {
  if (!user) return null;

  return {
    ...user,
    badges: await loadBadgesForUser(user.user_id),
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
      avatar_accent
    )
    VALUES ($1, $2, $3, $4, $5, $6)
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
    ]
  );

  return withUserBadges(result.rows[0]);
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
}) {
  if (
    !isAvatarStyle(input.avatarStyle) ||
    !isAvatarColor(input.avatarBg) ||
    !isAvatarColor(input.avatarAccent)
  ) {
    return { ok: false as const, reason: "invalid" as const };
  }

  const result = await pool.query<AppUserRow>(
    `
    UPDATE app_user
    SET
      avatar_style = $2,
      avatar_bg = $3,
      avatar_accent = $4
    WHERE user_id = $1
      AND status = 'active'
    RETURNING
      ${USER_SELECT_COLUMNS}
    `,
    [input.userId, input.avatarStyle, input.avatarBg, input.avatarAccent]
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
  puzzleId: number;
  submissionId: number;
  activeLinks: number;
}) {
  const badgeKeys = new Set<BadgeKey>();

  const submissionCountResult = await pool.query<{ submission_count: string }>(
    `
    SELECT COUNT(*)::text AS submission_count
    FROM puzzle_submission
    WHERE user_id = $1
    `,
    [Number(input.userId)]
  );
  const submissionCount = Number(
    submissionCountResult.rows[0]?.submission_count ?? "0"
  );

  SUBMISSION_COUNT_BADGES.forEach(({ count, key }) => {
    if (submissionCount >= count) {
      badgeKeys.add(key);
    }
  });

  if (input.activeLinks >= 10) {
    badgeKeys.add("ten_links_submission");
  }

  const placementResult = await pool.query<{ placement: string }>(
    `
    WITH ranked AS (
      SELECT
        submission_id,
        ROW_NUMBER() OVER (
          PARTITION BY puzzle_id
          ORDER BY final_score DESC, submitted_at ASC
        ) AS placement
      FROM puzzle_submission
      WHERE puzzle_id = $1
    )
    SELECT placement::text
    FROM ranked
    WHERE submission_id = $2
    LIMIT 1
    `,
    [input.puzzleId, input.submissionId]
  );
  const placement = Number(placementResult.rows[0]?.placement ?? "9999");

  if (placement <= 10) {
    badgeKeys.add("top_10_finish");
  }

  const topTenCountResult = await pool.query<{ top_ten_count: string }>(
    `
    WITH ranked AS (
      SELECT
        puzzle_id,
        user_id,
        ROW_NUMBER() OVER (
          PARTITION BY puzzle_id
          ORDER BY final_score DESC, submitted_at ASC
        ) AS placement
      FROM puzzle_submission
    )
    SELECT COUNT(*)::text AS top_ten_count
    FROM ranked
    WHERE user_id = $1
      AND placement <= 10
    `,
    [Number(input.userId)]
  );
  const topTenCount = Number(topTenCountResult.rows[0]?.top_ten_count ?? "0");

  if (topTenCount >= 5) {
    badgeKeys.add("top_10_finish_5");
  }

  return grantBadgesToUser({
    userId: input.userId,
    badgeKeys: [...badgeKeys],
  });
}

export function getManualBadgeKeys() {
  return BADGE_ORDER.filter((badgeKey) => getBadgeDefinition(badgeKey)?.manualOnly);
}

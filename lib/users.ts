import { pool } from "@/lib/db";

export type AppUser = {
  user_id: string;
  google_subject: string;
  email: string;
  email_normalized: string;
  username: string | null;
  username_normalized: string | null;
  status: string;
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

export async function getUserByGoogleSubject(googleSubject: string) {
  const result = await pool.query<AppUser>(
    `
    SELECT
      user_id::text,
      google_subject,
      email,
      email_normalized,
      username,
      username_normalized,
      status
    FROM app_user
    WHERE google_subject = $1
    LIMIT 1
    `,
    [googleSubject]
  );

  return result.rows[0] ?? null;
}

export async function getUserById(userId: string) {
  const result = await pool.query<AppUser>(
    `
    SELECT
      user_id::text,
      google_subject,
      email,
      email_normalized,
      username,
      username_normalized,
      status
    FROM app_user
    WHERE user_id = $1
    LIMIT 1
    `,
    [userId]
  );

  return result.rows[0] ?? null;
}

export async function upsertGoogleUser(input: {
  googleSubject: string;
  email: string;
}) {
  const emailNormalized = input.email.trim().toLowerCase();

  const result = await pool.query<AppUser>(
    `
    INSERT INTO app_user (
      google_subject,
      email,
      email_normalized
    )
    VALUES ($1, $2, $3)
    ON CONFLICT (google_subject)
    DO UPDATE SET
      email = EXCLUDED.email,
      email_normalized = EXCLUDED.email_normalized
    RETURNING
      user_id::text,
      google_subject,
      email,
      email_normalized,
      username,
      username_normalized,
      status
    `,
    [input.googleSubject, input.email.trim(), emailNormalized]
  );

  return result.rows[0];
}

export async function setUsernameForUser(userId: string, rawUsername: string) {
  const validation = validateUsername(rawUsername);
  if (!validation.ok) {
    return validation;
  }

  const result = await pool.query<AppUser>(
    `
    UPDATE app_user
    SET
      username = $2,
      username_normalized = $3
    WHERE user_id = $1
      AND status = 'active'
    RETURNING
      user_id::text,
      google_subject,
      email,
      email_normalized,
      username,
      username_normalized,
      status
    `,
    [userId, validation.username, validation.usernameNormalized]
  );

  if (result.rowCount === 0) {
    return { ok: false as const, reason: "blocked" as const };
  }

  return {
    ok: true as const,
    user: result.rows[0],
  };
}

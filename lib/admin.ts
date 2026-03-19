import type { Session } from "next-auth";

function normalizeList(value: string | undefined, fallback: string) {
  return (value ?? fallback)
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
}

const ADMIN_USERNAMES = new Set(
  normalizeList(process.env.ADMIN_USERNAMES, "rickytickybomb")
);

const ADMIN_EMAILS = new Set(
  normalizeList(process.env.ADMIN_EMAILS, "")
);

export function isAdminUser(input: {
  username?: string | null;
  email?: string | null;
}) {
  const username = input.username?.trim().toLowerCase() ?? "";
  const email = input.email?.trim().toLowerCase() ?? "";

  return (
    (username.length > 0 && ADMIN_USERNAMES.has(username)) ||
    (email.length > 0 && ADMIN_EMAILS.has(email))
  );
}

export function isAdminSession(session: Session | null) {
  return isAdminUser({
    username: session?.user?.username ?? null,
    email: session?.user?.email ?? null,
  });
}

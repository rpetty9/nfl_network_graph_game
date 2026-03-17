import process from "node:process";
import { Client } from "pg";

const VALID_BADGES = new Set(["creator", "founder"]);

function readArg(name) {
  const direct = process.argv.find((arg) => arg.startsWith(`--${name}=`));
  if (direct) return direct.slice(name.length + 3);

  const index = process.argv.indexOf(`--${name}`);
  if (index >= 0) return process.argv[index + 1] ?? null;

  return null;
}

function printUsage() {
  console.log(
    "Usage: node scripts/grant_badge.mjs --badge founder --username your_name"
  );
  console.log(
    "   or: node scripts/grant_badge.mjs --badge creator --email you@example.com"
  );
}

const badgeKey = readArg("badge");
const username = readArg("username");
const email = readArg("email");
const note = readArg("note");

if (!badgeKey || !VALID_BADGES.has(badgeKey) || (!username && !email)) {
  printUsage();
  process.exit(1);
}

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is required.");
  process.exit(1);
}

const client = new Client({
  connectionString: process.env.DATABASE_URL,
});

try {
  await client.connect();

  const identifierResult = username
    ? await client.query(
        `
        SELECT user_id::text, username
        FROM app_user
        WHERE username_normalized = $1
        LIMIT 1
        `,
        [username.trim().toLowerCase()]
      )
    : await client.query(
        `
        SELECT user_id::text, username
        FROM app_user
        WHERE email_normalized = $1
        LIMIT 1
        `,
        [email.trim().toLowerCase()]
      );

  const user = identifierResult.rows[0];

  if (!user) {
    console.error("No matching user found.");
    process.exit(1);
  }

  const insertResult = await client.query(
    `
    INSERT INTO user_badge (user_id, badge_key, award_note)
    VALUES ($1, $2, $3)
    ON CONFLICT (user_id, badge_key)
    DO NOTHING
    RETURNING badge_key, awarded_at::text
    `,
    [Number(user.user_id), badgeKey, note ?? null]
  );

  if (insertResult.rowCount === 0) {
    console.log(`${user.username ?? "User"} already has the ${badgeKey} badge.`);
  } else {
    console.log(`Granted ${badgeKey} to ${user.username ?? "user"}.`);
  }
} finally {
  await client.end();
}

export type BadgeTone =
  | "sky"
  | "emerald"
  | "amber"
  | "violet"
  | "rose"
  | "slate";

export type BadgeIcon =
  | "spark"
  | "stack"
  | "trophy"
  | "link"
  | "shield"
  | "flag"
  | "crown";

export type BadgeKey =
  | "account_created"
  | "avatar_customized"
  | "first_friend"
  | "friends_10"
  | "beat_friend_daily"
  | "beat_friend_daily_10"
  | "first_submission"
  | "submissions_10"
  | "submissions_25"
  | "submissions_50"
  | "submissions_100"
  | "links_25"
  | "links_100"
  | "streak_3"
  | "streak_7"
  | "top_10_finish"
  | "top_10_finish_5"
  | "ten_links_submission"
  | "creator"
  | "founder"
  | "bestestest";

export type BadgeDefinition = {
  key: BadgeKey;
  title: string;
  description: string;
  unlockHint: string;
  tone: BadgeTone;
  icon: BadgeIcon;
  manualOnly?: boolean;
};

export type UserBadge = {
  badgeKey: BadgeKey;
  title: string;
  description: string;
  tone: BadgeTone;
  icon: BadgeIcon;
  awardedAt: string;
  awardedByUserId: string | null;
  awardNote: string | null;
  manualOnly: boolean;
};

export const BADGE_DEFINITIONS: Record<BadgeKey, BadgeDefinition> = {
  account_created: {
    key: "account_created",
    title: "Signed Up",
    description: "Created a Five Wide account.",
    unlockHint: "Create an account.",
    tone: "sky",
    icon: "shield",
  },
  avatar_customized: {
    key: "avatar_customized",
    title: "Fresh Paint",
    description: "Customized your avatar for the first time.",
    unlockHint: "Update your avatar.",
    tone: "rose",
    icon: "spark",
  },
  first_friend: {
    key: "first_friend",
    title: "First Friend",
    description: "Added your first friend on Five Wide.",
    unlockHint: "Add your first friend.",
    tone: "sky",
    icon: "shield",
  },
  friends_10: {
    key: "friends_10",
    title: "Inner Circle",
    description: "Built a friends list of 10 players.",
    unlockHint: "Reach 10 accepted friends.",
    tone: "emerald",
    icon: "shield",
  },
  beat_friend_daily: {
    key: "beat_friend_daily",
    title: "Friendly Fire",
    description: "Beat at least one friend on a daily puzzle.",
    unlockHint: "Finish above a friend on any daily puzzle.",
    tone: "amber",
    icon: "trophy",
  },
  beat_friend_daily_10: {
    key: "beat_friend_daily_10",
    title: "Rivalry Run",
    description: "Beat a friend on 10 different daily puzzles.",
    unlockHint: "Beat friends on 10 different puzzle dates.",
    tone: "violet",
    icon: "trophy",
  },
  first_submission: {
    key: "first_submission",
    title: "First Snap",
    description: "Submitted your first Five Wide puzzle.",
    unlockHint: "Submit your first puzzle.",
    tone: "sky",
    icon: "spark",
  },
  submissions_10: {
    key: "submissions_10",
    title: "Ten Deep",
    description: "Submitted 10 puzzles.",
    unlockHint: "Submit 10 different daily puzzles.",
    tone: "sky",
    icon: "stack",
  },
  submissions_25: {
    key: "submissions_25",
    title: "Quarter Century",
    description: "Submitted 25 puzzles.",
    unlockHint: "Submit 25 different daily puzzles.",
    tone: "emerald",
    icon: "stack",
  },
  submissions_50: {
    key: "submissions_50",
    title: "Fifty Club",
    description: "Submitted 50 puzzles.",
    unlockHint: "Submit 50 different daily puzzles.",
    tone: "amber",
    icon: "stack",
  },
  submissions_100: {
    key: "submissions_100",
    title: "Century Drive",
    description: "Submitted 100 puzzles.",
    unlockHint: "Submit 100 different daily puzzles.",
    tone: "violet",
    icon: "stack",
  },
  links_25: {
    key: "links_25",
    title: "Link Builder",
    description: "Created 25 active links across your submissions.",
    unlockHint: "Create 25 total active links.",
    tone: "emerald",
    icon: "link",
  },
  links_100: {
    key: "links_100",
    title: "Chain Reaction",
    description: "Created 100 active links across your submissions.",
    unlockHint: "Create 100 total active links.",
    tone: "amber",
    icon: "link",
  },
  streak_3: {
    key: "streak_3",
    title: "Three-Peat",
    description: "Submitted puzzles on 3 consecutive days.",
    unlockHint: "Build a 3-day submission streak.",
    tone: "violet",
    icon: "flag",
  },
  streak_7: {
    key: "streak_7",
    title: "Weeklong Run",
    description: "Submitted puzzles on 7 consecutive days.",
    unlockHint: "Build a 7-day submission streak.",
    tone: "rose",
    icon: "flag",
  },
  top_10_finish: {
    key: "top_10_finish",
    title: "Top Ten",
    description: "Finished in the daily top 10 leaderboard.",
    unlockHint: "Finish in the top 10 on any daily leaderboard.",
    tone: "amber",
    icon: "trophy",
  },
  top_10_finish_5: {
    key: "top_10_finish_5",
    title: "Top Ten x5",
    description: "Finished in the daily top 10 five different times.",
    unlockHint: "Finish in the top 10 on five different puzzles.",
    tone: "violet",
    icon: "trophy",
  },
  ten_links_submission: {
    key: "ten_links_submission",
    title: "Perfect Web",
    description: "Submitted a lineup with all 10 active links.",
    unlockHint: "Submit a lineup with all 10 active links.",
    tone: "emerald",
    icon: "link",
  },
  creator: {
    key: "creator",
    title: "Creator",
    description: "Built Five Wide from the ground up.",
    unlockHint: "Awarded manually by the app creator.",
    tone: "amber",
    icon: "crown",
    manualOnly: true,
  },
  founder: {
    key: "founder",
    title: "Founder",
    description: "Early supporter recognized by the creator.",
    unlockHint: "Awarded manually by the app creator.",
    tone: "slate",
    icon: "flag",
    manualOnly: true,
  },
  bestestest: {
    key: "bestestest",
    title: "The Bestestest",
    description: "",
    unlockHint: "Awarded manually by the app creator.",
    tone: "amber",
    icon: "crown",
    manualOnly: true,
  },
};

export const BADGE_ORDER: BadgeKey[] = [
  "creator",
  "bestestest",
  "founder",
  "beat_friend_daily_10",
  "beat_friend_daily",
  "friends_10",
  "first_friend",
  "streak_7",
  "streak_3",
  "top_10_finish_5",
  "top_10_finish",
  "ten_links_submission",
  "links_100",
  "links_25",
  "submissions_100",
  "submissions_50",
  "submissions_25",
  "submissions_10",
  "first_submission",
  "avatar_customized",
  "account_created",
];

export const BADGE_KEYS = Object.keys(BADGE_DEFINITIONS) as BadgeKey[];

export const SUBMISSION_COUNT_BADGES: Array<{ count: number; key: BadgeKey }> = [
  { count: 1, key: "first_submission" },
  { count: 10, key: "submissions_10" },
  { count: 25, key: "submissions_25" },
  { count: 50, key: "submissions_50" },
  { count: 100, key: "submissions_100" },
];

export const LINK_COUNT_BADGES: Array<{ count: number; key: BadgeKey }> = [
  { count: 25, key: "links_25" },
  { count: 100, key: "links_100" },
];

export const STREAK_BADGES: Array<{ count: number; key: BadgeKey }> = [
  { count: 3, key: "streak_3" },
  { count: 7, key: "streak_7" },
];

export const FRIEND_COUNT_BADGES: Array<{ count: number; key: BadgeKey }> = [
  { count: 1, key: "first_friend" },
  { count: 10, key: "friends_10" },
];

export const FRIEND_WIN_BADGES: Array<{ count: number; key: BadgeKey }> = [
  { count: 1, key: "beat_friend_daily" },
  { count: 10, key: "beat_friend_daily_10" },
];

export function isBadgeKey(value: string): value is BadgeKey {
  return BADGE_KEYS.includes(value as BadgeKey);
}

export function getBadgeDefinition(value: string): BadgeDefinition | null {
  return isBadgeKey(value) ? BADGE_DEFINITIONS[value] : null;
}

export function hydrateBadge(input: {
  badgeKey: string;
  awardedAt: string;
  awardedByUserId?: string | null;
  awardNote?: string | null;
}): UserBadge | null {
  const definition = getBadgeDefinition(input.badgeKey);
  if (!definition) return null;

  return {
    badgeKey: definition.key,
    title: definition.title,
    description: definition.description,
    tone: definition.tone,
    icon: definition.icon,
    awardedAt: input.awardedAt,
    awardedByUserId: input.awardedByUserId ?? null,
    awardNote: input.awardNote ?? null,
    manualOnly: Boolean(definition.manualOnly),
  };
}

export function getPublicBadgeDefinitions() {
  return BADGE_ORDER.map((badgeKey) => BADGE_DEFINITIONS[badgeKey]).filter(
    (badge) => !badge.manualOnly
  );
}

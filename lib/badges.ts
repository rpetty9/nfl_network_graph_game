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
  | "flag";

export type BadgeKey =
  | "first_submission"
  | "submissions_10"
  | "submissions_25"
  | "submissions_50"
  | "submissions_100"
  | "top_10_finish"
  | "top_10_finish_5"
  | "ten_links_submission"
  | "creator"
  | "founder";

export type BadgeDefinition = {
  key: BadgeKey;
  title: string;
  description: string;
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
  first_submission: {
    key: "first_submission",
    title: "First Snap",
    description: "Submitted your first Five Wide puzzle.",
    tone: "sky",
    icon: "spark",
  },
  submissions_10: {
    key: "submissions_10",
    title: "Ten Deep",
    description: "Submitted 10 puzzles.",
    tone: "sky",
    icon: "stack",
  },
  submissions_25: {
    key: "submissions_25",
    title: "Quarter Century",
    description: "Submitted 25 puzzles.",
    tone: "emerald",
    icon: "stack",
  },
  submissions_50: {
    key: "submissions_50",
    title: "Fifty Club",
    description: "Submitted 50 puzzles.",
    tone: "amber",
    icon: "stack",
  },
  submissions_100: {
    key: "submissions_100",
    title: "Century Drive",
    description: "Submitted 100 puzzles.",
    tone: "violet",
    icon: "stack",
  },
  top_10_finish: {
    key: "top_10_finish",
    title: "Top Ten",
    description: "Finished in the daily top 10 leaderboard.",
    tone: "amber",
    icon: "trophy",
  },
  top_10_finish_5: {
    key: "top_10_finish_5",
    title: "Top Ten x5",
    description: "Finished in the daily top 10 five different times.",
    tone: "violet",
    icon: "trophy",
  },
  ten_links_submission: {
    key: "ten_links_submission",
    title: "Perfect Web",
    description: "Submitted a lineup with all 10 active links.",
    tone: "emerald",
    icon: "link",
  },
  creator: {
    key: "creator",
    title: "Creator",
    description: "Built Five Wide from the ground up.",
    tone: "rose",
    icon: "shield",
    manualOnly: true,
  },
  founder: {
    key: "founder",
    title: "Founder",
    description: "Early supporter recognized by the creator.",
    tone: "slate",
    icon: "flag",
    manualOnly: true,
  },
};

export const BADGE_ORDER: BadgeKey[] = [
  "creator",
  "founder",
  "top_10_finish_5",
  "top_10_finish",
  "ten_links_submission",
  "submissions_100",
  "submissions_50",
  "submissions_25",
  "submissions_10",
  "first_submission",
];

export const BADGE_KEYS = Object.keys(BADGE_DEFINITIONS) as BadgeKey[];

export const SUBMISSION_COUNT_BADGES: Array<{ count: number; key: BadgeKey }> = [
  { count: 1, key: "first_submission" },
  { count: 10, key: "submissions_10" },
  { count: 25, key: "submissions_25" },
  { count: 50, key: "submissions_50" },
  { count: 100, key: "submissions_100" },
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

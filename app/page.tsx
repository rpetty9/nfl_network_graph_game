"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { signIn, signOut, useSession } from "next-auth/react";
import {
  getBadgeDefinition,
  getPublicBadgeDefinitions,
  type BadgeDefinition,
  type BadgeIcon,
  type BadgeKey,
  type BadgeTone,
  type UserBadge,
} from "@/lib/badges";
import {
  AVATAR_COLORS,
  AVATAR_COLOR_CLASSES,
  AVATAR_STYLES,
  DEFAULT_AVATAR,
  type AvatarColor,
  type AvatarStyle,
} from "@/lib/avatar";
import { playerAllowedByPuzzleRules } from "@/lib/puzzle-rules";
import { getLinkBonusPct, getLinkMultiplier } from "@/lib/scoring";
import { teamAbbrMatches } from "@/lib/team-abbr";

type PuzzleResponse = {
  puzzle: {
    puzzle_id: string;
    puzzle_date: string;
    sport: string;
    title: string;
    selection_count: number;
    stat_pool_size: number;
    seed_value: string;
    published_flag: boolean;
    position_overlay_enabled?: boolean;
    qb_exclusion_enabled?: boolean;
  };
  theme: {
    filter_id: string | number;
    filter_name: string;
    display_name: string;
    filter_category?: string | null;
    rule_logic_key?: string | null;
  } | null;
  eligibility_filter: {
    filter_id: string | number;
    filter_name: string;
    display_name: string;
    filter_category?: string | null;
    rule_logic_key?: string | null;
  } | null;
  multiplier: {
    multiplier_name: string;
    display_name: string;
  } | null;
  relationship_rule?: {
    relationship_type: string;
    display_text: string;
    bonus_pct: number;
  } | null;
  slot_rules?: SlotRule[];
  viewer_has_submitted?: boolean;
  leaderboard_finalized?: boolean;
  available_dates?: string[];
};

type SlotRule = {
  slot_number: number;
  slot_rule_id: string | number;
  rule_name: string;
  parameter_type: string;
  parameter_value: string | null;
  display_text: string;
};

type PlayerOption = {
  player_id: string;
  player_name: string;
  primary_position: string | null;
  draft_round: number | null;
  super_bowl_win_count?: number | null;
  career_start_season: number | null;
  career_end_season: number | null;
  theme_start_season: number | null;
  theme_end_season: number | null;
  eligible_season_count: number;
  fantasy_points: number;
  played_afc_west_flag: number | boolean;
  played_titans_flag: number | boolean;
  played_until_33_flag: number | boolean;
  headshot_url?: string | null;
  player_colleges?: string[];
  theme_team_abbrs?: string[];
  theme_conferences?: string[];
  theme_divisions?: string[];
};

type PairRelationship = {
  player_id_1: string;
  player_id_2: string;
  were_teammates_flag: boolean;
  same_franchise_flag: boolean;
  same_college_flag: boolean;
  same_draft_class_flag: boolean;
  same_draft_round_flag?: boolean;
  both_undrafted_flag?: boolean;
  both_non_first_round_pick_flag?: boolean;
  both_day_3_pick_flag?: boolean;
  both_super_bowl_winner_flag?: boolean;
  both_non_super_bowl_winner_flag?: boolean;
  both_played_packers_flag?: boolean;
  same_position_flag?: boolean;
};

type PlayersResponse = {
  theme: {
    filter_id: string | number;
    filter_name: string;
    display_name: string;
    filter_category?: string | null;
    rule_logic_key?: string | null;
  } | null;
  eligibility_filter: {
    filter_id: string | number;
    filter_name: string;
    display_name: string;
    filter_category?: string | null;
    rule_logic_key?: string | null;
  } | null;
  players: PlayerOption[];
};

type OptimalLineupResponse = {
  puzzle_date: string;
  optimal_lineup: Array<{
    slot_number: number;
    slot_rule: SlotRule;
    player: PlayerOption;
  }>;
  optimal_base_score: number;
  optimal_active_links: number;
  optimal_multiplier: number;
  optimal_final_score: number;
};

type CurrentLeaderLineupResponse = {
  puzzle_date: string;
  leader: {
    submission_id: number;
    display_name: string;
    base_score: number;
    active_links: number;
    multiplier: number;
    final_score: number;
    submitted_at: string;
  };
  lineup: Array<{
    slot_number: number;
    slot_rule: Pick<SlotRule, "slot_number" | "display_text">;
    player: PlayerOption;
  }>;
};

type SubmissionResponse = {
  submission_id: number;
  display_name: string;
  base_score?: number;
  active_links?: number;
  multiplier?: number;
  final_score: number;
  optimal_final_score?: number | null;
  percent_of_optimal: number | null;
  submitted_at?: string;
  lineup?: Array<{
    slot_number: number;
    player_id: string;
  }>;
  awarded_badges?: UserBadge[];
};

type LeaderboardEntry = {
  user_id: string | null;
  submission_id: number;
  display_name: string;
  base_score: number;
  active_links: number;
  multiplier: number;
  final_score: number;
  optimal_final_score: number | null;
  percent_of_optimal: number | null;
  submitted_at: string;
  featured_badges?: BadgeKey[];
};

type AllTimeLeaderboardEntry = {
  user_id: string;
  display_name: string;
  top_10_finishes: number;
  best_finish: number;
  latest_finish_at: string;
  featured_badges?: BadgeKey[];
};

function compareLeaderboardEntries(a: LeaderboardEntry, b: LeaderboardEntry) {
  if (b.final_score !== a.final_score) {
    return b.final_score - a.final_score;
  }

  return new Date(a.submitted_at).getTime() - new Date(b.submitted_at).getTime();
}

type PublicProfileResponse = {
  profile: {
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
    recent_submissions: Array<{
      submission_id: number;
      puzzle_date: string;
      final_score: number;
      base_score: number;
      active_links: number;
      multiplier: number;
      percent_of_optimal: number | null;
      placement: number | null;
    }>;
  };
};

type SelfProfileResponse = PublicProfileResponse;

type FriendProfileSummary = {
  user_id: string;
  username: string;
  avatar_style: AvatarStyle;
  avatar_bg: AvatarColor;
  avatar_accent: AvatarColor;
  avatar_border: AvatarColor;
  created_at: string;
};

type FriendRequestSummary = FriendProfileSummary & {
  request_id: string;
  direction: "incoming" | "outgoing";
  status: "pending";
  requested_at: string;
};

type FriendOverviewResponse = {
  overview: {
    friends: FriendProfileSummary[];
    incoming_requests: FriendRequestSummary[];
    outgoing_requests: FriendRequestSummary[];
  };
};

type FriendSearchResponse = {
  match: (FriendProfileSummary & {
    relationship_status: "self" | "friend" | "incoming" | "outgoing" | "none";
  }) | null;
};

type HomeRecapResponse = {
  recap: {
    puzzle_date: string;
    winners: Array<{
      user_id: string;
      display_name: string;
      placement: number;
      final_score: number;
      featured_badges?: BadgeKey[];
    }>;
  } | null;
};

type ActiveLinkDetail = {
  pairKey: string;
  playerA: PlayerOption;
  playerB: PlayerOption;
};

function formatBadgeAwardDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatProfileCreatedDate(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatHistoryDateLabel(value: string) {
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getRelationshipTooltip(relationshipType: string, relationshipLabel: string) {
  switch (relationshipType) {
    case "teammates":
      return "A link activates if those two players were ever teammates at any point in their careers. It is not limited to the puzzle's featured time period.";
    case "same_franchise":
      return "A link activates if both players played for the same franchise at any point in their careers, even if they were not there at the same time.";
    case "same_college":
      return "A link activates if both players attended the same college at any point before entering the NFL.";
    case "same_draft_class":
      return "A link activates only if both players were actually drafted in the same NFL draft year. Undrafted players do not count for this link, even if they entered the league in the same season.";
    case "same_draft_round":
      return "A link activates if both players were selected in the same draft round.";
    case "both_undrafted":
      return "A link activates if both players entered the league as undrafted free agents.";
    case "non_first_round_pick":
      return "A link activates if both players were drafted after the first round.";
    case "day_3_pick":
      return "A link activates if both players were drafted on Day 3, meaning rounds 4 through 7.";
    case "both_super_bowl_winner":
      return "A link activates if both players won at least one Super Bowl in their careers.";
    case "both_non_super_bowl_winner":
      return "A link activates if neither player ever won a Super Bowl.";
    case "both_played_packers":
      return "A link activates if both players played for the Packers at some point in their careers.";
    case "same_position":
      return "A link activates if both players share the same primary listed position.";
    default:
      return `${relationshipLabel} is the active link rule for this puzzle. A link turns on whenever a pair of selected players satisfies that rule.`;
  }
}

function formatCompactScore(value: number) {
  return Number(value).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatRefreshLabel(value: string | null) {
  if (!value) return null;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return `Updated ${date.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  })}`;
}

type BadgeProgressStats = {
  puzzles_submitted: number;
  leaderboard_finishes: number;
  links_created: number;
  longest_submission_streak: number;
  friends_count: number;
  friend_daily_wins: number;
};

type BadgeGalleryTab = "milestones" | "links" | "leaderboard" | "social" | "profile";

type NextBadgeGoal = {
  badge: BadgeDefinition;
  progressLabel: string;
  progressRatio: number;
  note: string;
};

function getNextBadgeGoals(input: {
  stats: BadgeProgressStats;
  earnedBadgeKeys: Set<BadgeKey>;
  currentSubmissionLinks: number;
}) {
  const { stats, earnedBadgeKeys, currentSubmissionLinks } = input;
  const goals: NextBadgeGoal[] = [];

  const pushGoal = (
    badgeKey: BadgeKey,
    progress: number,
    target: number,
    note: string,
    progressLabel = `${Math.min(progress, target)}/${target}`
  ) => {
    if (earnedBadgeKeys.has(badgeKey)) return;
    const badge = getBadgeDefinition(badgeKey);
    if (!badge) return;
    goals.push({
      badge,
      progressLabel,
      progressRatio: target > 0 ? Math.min(progress / target, 1) : 0,
      note,
    });
  };

  pushGoal(
    "first_friend",
    stats.friends_count,
    1,
    "Add your first exact-username friend."
  );
  pushGoal(
    "friends_10",
    stats.friends_count,
    10,
    "A bigger circle unlocks this social milestone."
  );
  pushGoal(
    "beat_friend_daily",
    stats.friend_daily_wins,
    1,
    "Finish above at least one accepted friend on a puzzle day."
  );
  pushGoal(
    "beat_friend_daily_10",
    stats.friend_daily_wins,
    10,
    "Keep stacking friend wins across different daily puzzles."
  );

  pushGoal(
    "submissions_10",
    stats.puzzles_submitted,
    10,
    "Keep locking in daily lineups."
  );
  pushGoal(
    "submissions_25",
    stats.puzzles_submitted,
    25,
    "Volume milestones stack up fast."
  );
  pushGoal(
    "links_25",
    stats.links_created,
    25,
    "Every active player-to-player connection counts."
  );
  pushGoal(
    "first_place_finish",
    stats.leaderboard_finishes,
    1,
    "Finish first when the nightly leaderboard snapshot locks in."
  );
  pushGoal(
    "top_10_finish",
    stats.leaderboard_finishes,
    1,
    "Finalized top-10 badges award after the nightly snapshot."
  );
  pushGoal(
    "top_10_finish_5",
    stats.leaderboard_finishes,
    5,
    "Rack up multiple nightly top-10 finishes."
  );
  pushGoal(
    "streak_3",
    stats.longest_submission_streak,
    3,
    "Submit on consecutive puzzle dates to build your streak."
  );
  pushGoal(
    "streak_7",
    stats.longest_submission_streak,
    7,
    "A full week in a row unlocks this one."
  );

  if (!earnedBadgeKeys.has("ten_links_submission")) {
    const badge = getBadgeDefinition("ten_links_submission");
    if (badge) {
        goals.push({
        badge,
        progressLabel: `${Math.min(currentSubmissionLinks, 10)}/10`,
        progressRatio: Math.min(currentSubmissionLinks / 10, 1),
        note: "Each active link adds +10%, and a fully connected lineup reaches 2.00x.",
      });
    }
  }

  return goals
    .sort((a, b) => b.progressRatio - a.progressRatio)
    .slice(0, 3);
}

function getBadgeProgressLabel(
  badge: BadgeDefinition,
  stats: {
    puzzles_submitted: number;
    leaderboard_finishes: number;
    links_created: number;
    longest_submission_streak: number;
    friends_count: number;
    friend_daily_wins: number;
  }
) {
  switch (badge.key) {
    case "account_created":
      return "1/1";
    case "avatar_customized":
      return "Update avatar";
    case "first_friend":
      return `${Math.min(stats.friends_count, 1)}/1`;
    case "friends_10":
      return `${Math.min(stats.friends_count, 10)}/10`;
    case "beat_friend_daily":
      return `${Math.min(stats.friend_daily_wins, 1)}/1`;
    case "beat_friend_daily_10":
      return `${Math.min(stats.friend_daily_wins, 10)}/10`;
    case "first_submission":
      return `${Math.min(stats.puzzles_submitted, 1)}/1`;
    case "submissions_10":
      return `${Math.min(stats.puzzles_submitted, 10)}/10`;
    case "submissions_25":
      return `${Math.min(stats.puzzles_submitted, 25)}/25`;
    case "submissions_50":
      return `${Math.min(stats.puzzles_submitted, 50)}/50`;
    case "submissions_100":
      return `${Math.min(stats.puzzles_submitted, 100)}/100`;
    case "first_place_finish":
      return `${Math.min(stats.leaderboard_finishes, 1)}/1`;
    case "top_10_finish":
      return `${Math.min(stats.leaderboard_finishes, 1)}/1`;
    case "top_10_finish_5":
      return `${Math.min(stats.leaderboard_finishes, 5)}/5`;
    case "links_25":
      return `${Math.min(stats.links_created, 25)}/25`;
    case "links_100":
      return `${Math.min(stats.links_created, 100)}/100`;
    case "streak_3":
      return `${Math.min(stats.longest_submission_streak, 3)}/3`;
    case "streak_7":
      return `${Math.min(stats.longest_submission_streak, 7)}/7`;
    default:
      return badge.unlockHint;
  }
}

function getBadgeGalleryTab(badgeKey: BadgeKey): BadgeGalleryTab {
  switch (badgeKey) {
    case "first_friend":
    case "friends_10":
    case "beat_friend_daily":
    case "beat_friend_daily_10":
      return "social";
    case "first_place_finish":
    case "top_10_finish":
    case "top_10_finish_5":
      return "leaderboard";
    case "links_25":
    case "links_100":
    case "ten_links_submission":
      return "links";
    case "account_created":
    case "avatar_customized":
    case "creator":
    case "founder":
    case "bestestest":
      return "profile";
    default:
      return "milestones";
  }
}

function clampPageIndex(pageIndex: number, totalItems: number, pageSize: number) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  return Math.min(Math.max(pageIndex, 0), totalPages - 1);
}

function formatAvatarOptionLabel(value: string) {
  const explicitLabels: Record<string, string> = {
    shieldstar: "Shield Star",
  };

  if (explicitLabels[value]) {
    return explicitLabels[value];
  }

  return value.replace(/_/g, " ").replace(/\b\w/g, (match) => match.toUpperCase());
}

function FeaturedBadgeSlot({
  badge,
  active,
  onToggle,
  onRemove,
}: {
  badge: Pick<
    UserBadge,
    "badgeKey" | "title" | "description" | "tone" | "icon" | "awardedAt"
  > | null;
  active: boolean;
  onToggle: () => void;
  onRemove?: (() => void) | null;
}) {
  if (!badge) {
    return (
      <div className="rounded-[18px] border-[3px] border-dashed border-sky-200 bg-sky-50/60 px-4 py-3 text-left">
        <p className="text-[10px] font-black uppercase tracking-[0.08em] text-sky-600">
          Empty Slot
        </p>
        <p className="mt-1 text-sm font-semibold text-slate-500">
          Feature a badge from the gallery below.
        </p>
      </div>
    );
  }

  const tone = getBadgeToneClasses(badge.tone);
  const isCreatorBadge = badge.badgeKey === "creator";
  const isBestestestBadge = badge.badgeKey === "bestestest";
  const isDailyCrownBadge = badge.badgeKey === "first_place_finish";
  const isLegendaryManualBadge = isCreatorBadge || isBestestestBadge;
  const isSignatureBadge = isLegendaryManualBadge || isDailyCrownBadge;

  return (
    <div className="group relative">
      <button
        type="button"
        onClick={onToggle}
        className={`relative flex w-full items-center gap-3 overflow-hidden rounded-[20px] border px-4 py-3.5 text-center transition hover:-translate-y-0.5 ${
          isSignatureBadge
            ? isBestestestBadge
              ? "border-pink-300 bg-[radial-gradient(circle_at_top,rgba(255,244,250,0.98)_0%,rgba(244,114,182,0.3)_24%,rgba(168,85,247,0.34)_46%,rgba(91,33,182,0.5)_68%,rgba(17,24,39,0.92)_100%)] text-amber-50 shadow-[0_0_0_1px_rgba(244,114,182,0.45),0_0_30px_rgba(168,85,247,0.34),0_20px_48px_rgba(91,33,182,0.34)]"
              : isDailyCrownBadge
                ? "border-cyan-200 bg-[radial-gradient(circle_at_top,rgba(250,254,255,0.99)_0%,rgba(254,240,138,0.38)_18%,rgba(103,232,249,0.28)_40%,rgba(14,116,144,0.32)_64%,rgba(8,47,73,0.94)_100%)] text-amber-50 shadow-[0_0_0_1px_rgba(103,232,249,0.42),0_0_30px_rgba(34,211,238,0.24),0_20px_48px_rgba(8,145,178,0.26)]"
                : "border-amber-300 bg-[radial-gradient(circle_at_top,rgba(255,252,235,0.99)_0%,rgba(253,224,71,0.42)_22%,rgba(251,191,36,0.34)_42%,rgba(249,115,22,0.28)_64%,rgba(251,146,60,0.3)_100%)] text-amber-950 shadow-[0_0_0_1px_rgba(251,191,36,0.48),0_0_28px_rgba(249,115,22,0.22),0_20px_48px_rgba(251,146,60,0.2)]"
            : tone.shell
        } ${
          isSignatureBadge
            ? isBestestestBadge
              ? "before:absolute before:inset-0 before:bg-[radial-gradient(circle_at_18%_18%,rgba(255,255,255,0.5),transparent_22%),radial-gradient(circle_at_80%_18%,rgba(244,114,182,0.28),transparent_22%),repeating-linear-gradient(135deg,rgba(236,72,153,0.14)_0,rgba(236,72,153,0.14)_7px,transparent_7px,transparent_15px)] before:content-[''] after:absolute after:-inset-6 after:-z-10 after:rounded-[28px] after:bg-[radial-gradient(circle,rgba(236,72,153,0.24),transparent_62%)] after:blur-xl after:content-['']"
              : isDailyCrownBadge
                ? "before:absolute before:inset-0 before:bg-[radial-gradient(circle_at_20%_16%,rgba(255,255,255,0.48),transparent_24%),radial-gradient(circle_at_82%_20%,rgba(103,232,249,0.22),transparent_22%),repeating-linear-gradient(135deg,rgba(103,232,249,0.09)_0,rgba(103,232,249,0.09)_7px,transparent_7px,transparent_15px)] before:content-[''] after:absolute after:-inset-6 after:-z-10 after:rounded-[28px] after:bg-[radial-gradient(circle,rgba(34,211,238,0.2),transparent_62%)] after:blur-xl after:content-['']"
                : "before:absolute before:inset-0 before:bg-[radial-gradient(circle_at_20%_16%,rgba(255,255,255,0.52),transparent_24%),radial-gradient(circle_at_82%_20%,rgba(251,191,36,0.2),transparent_22%),repeating-linear-gradient(135deg,rgba(249,115,22,0.1)_0,rgba(249,115,22,0.1)_7px,transparent_7px,transparent_15px)] before:content-[''] after:absolute after:-inset-6 after:-z-10 after:rounded-[28px] after:bg-[radial-gradient(circle,rgba(251,146,60,0.22),transparent_62%)] after:blur-xl after:content-['']"
            : "shadow-[0_16px_30px_rgba(15,23,42,0.11)]"
        }`}
      >
        <span className="pointer-events-none absolute inset-x-4 top-0 h-px bg-white/70" />
        <span className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.26),transparent_52%)]" />
        <div
          className={`relative inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[15px] border border-white/50 ${
            isSignatureBadge
              ? isBestestestBadge
                ? "bg-[linear-gradient(145deg,#fff1f2_0%,#f9a8d4_18%,#f472b6_42%,#a855f7_72%,#581c87_100%)] text-amber-50 shadow-[0_0_22px_rgba(244,114,182,0.42)]"
                : isDailyCrownBadge
                  ? "bg-[linear-gradient(145deg,#fefce8_0%,#fde68a_18%,#a5f3fc_48%,#06b6d4_74%,#164e63_100%)] text-cyan-950 shadow-[0_0_22px_rgba(34,211,238,0.3)]"
                  : "bg-[linear-gradient(145deg,#fff7cc_0%,#fde68a_18%,#7dd3fc_48%,#2563eb_74%,#1e3a8a_100%)] text-sky-950 shadow-[0_0_22px_rgba(56,189,248,0.38)]"
              : tone.icon
          }`}
        >
          <span className="absolute inset-[1px] rounded-[12px] bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.4),transparent_58%)]" />
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className="relative h-5 w-5 drop-shadow-[0_1px_1px_rgba(255,255,255,0.22)]"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <BadgeGlyph icon={badge.icon} />
          </svg>
        </div>
        <div className="min-w-0 flex-1">
          <p className={`text-center text-sm font-black uppercase tracking-[0.1em] ${isSignatureBadge ? isBestestestBadge ? "text-pink-50 drop-shadow-[0_1px_0_rgba(91,33,182,0.65)]" : isDailyCrownBadge ? "mx-auto inline-flex items-center rounded-[12px] border border-cyan-100/80 bg-[linear-gradient(135deg,rgba(254,252,232,0.98)_0%,rgba(253,224,71,0.9)_18%,rgba(165,243,252,0.96)_48%,rgba(34,211,238,0.88)_72%,rgba(8,47,73,0.86)_100%)] px-3.5 py-1.5 text-[13px] tracking-[0.14em] text-cyan-950 shadow-[0_0_0_1px_rgba(103,232,249,0.26),0_10px_24px_rgba(34,211,238,0.18),inset_0_1px_0_rgba(255,255,255,0.22)]" : "mx-auto inline-flex items-center rounded-[12px] border border-amber-200/90 bg-[linear-gradient(135deg,rgba(255,251,235,0.96)_0%,rgba(253,230,138,0.98)_22%,rgba(251,191,36,0.94)_58%,rgba(249,115,22,0.9)_100%)] px-3.5 py-1.5 text-[13px] tracking-[0.14em] text-amber-950 shadow-[0_0_0_1px_rgba(251,191,36,0.32),0_10px_24px_rgba(249,115,22,0.16),inset_0_1px_0_rgba(255,255,255,0.22)]" : "text-slate-950 drop-shadow-[0_1px_0_rgba(255,255,255,0.45)]"}`}>
            {badge.title}
          </p>
        </div>
      </button>
      {onRemove ? (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${badge.title} from featured badges`}
          className="absolute right-2 top-2 z-20 inline-flex h-6 w-6 items-center justify-center rounded-full border border-white/80 bg-white/90 text-xs font-black text-slate-700 shadow-[0_8px_18px_rgba(15,23,42,0.12)] transition hover:scale-105 hover:bg-white"
        >
          x
        </button>
      ) : null}
      <div
        className={`pointer-events-none absolute left-0 right-0 top-[calc(100%+0.45rem)] z-20 rounded-[18px] border border-slate-200 bg-white/98 px-4 py-3 text-left shadow-[0_18px_40px_rgba(15,23,42,0.18)] transition md:opacity-0 md:translate-y-1 md:group-hover:pointer-events-auto md:group-hover:translate-y-0 md:group-hover:opacity-100 ${
          active ? "pointer-events-auto opacity-100 translate-y-0" : "opacity-0 translate-y-1 md:block hidden"
        }`}
      >
        <p className="text-center text-xs font-black uppercase tracking-[0.08em] text-slate-900">
          {badge.title}
        </p>
        {badge.description ? (
          <p className="mt-1 text-center text-sm font-semibold leading-5 text-slate-600">
            {badge.description}
          </p>
        ) : null}
        <p className={`mt-2 text-center text-[10px] font-black uppercase tracking-[0.08em] ${isDailyCrownBadge ? "text-cyan-700" : "text-sky-700"}`}>
          Earned {formatBadgeAwardDate(badge.awardedAt)}
        </p>
      </div>
    </div>
  );
}

type NodeState = {
  node_id: number;
  player_id: string;
};

type LinkTone = "pending" | "active" | "failed";

type SearchablePlayerSelectProps = {
  value: string;
  players: PlayerOption[];
  disabled: boolean;
  placeholder: string;
  onChange: (playerId: string) => void;
  getPlayerLabel: (player: PlayerOption) => string;
  onActivate?: () => void;
  registerFocus?: ((focusFn: (() => void) | null) => void) | null;
  onPlayerSelected?: () => void;
};

function SearchablePlayerSelect({
  value,
  players,
  disabled,
  placeholder,
  onChange,
  getPlayerLabel,
  onActivate,
  registerFocus,
  onPlayerSelected,
}: SearchablePlayerSelectProps) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const selectedPlayer = useMemo(
    () => players.find((p) => String(p.player_id) === String(value)) ?? null,
    [players, value]
  );
  const selectedPlayerLabel = selectedPlayer ? getPlayerLabel(selectedPlayer) : "";

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (!wrapperRef.current) return;
      if (!wrapperRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!registerFocus) return;

    registerFocus(() => {
      if (disabled) return;
      setQuery(selectedPlayerLabel);
      inputRef.current?.focus();
      setOpen(true);
    });

    return () => registerFocus(null);
  }, [disabled, registerFocus, selectedPlayerLabel]);

  const filteredPlayers = useMemo(() => {
    const trimmed = query.trim().toLowerCase();

    if (!trimmed) {
      return [];
    }

    return players
      .filter((player) => {
        return player.player_name.toLowerCase().includes(trimmed);
      })
      .sort((a, b) => a.player_name.localeCompare(b.player_name))
      .slice(0, 50);
  }, [players, query]);

  const inputValue = open ? query : selectedPlayerLabel || query;

  return (
    <div ref={wrapperRef} className="relative">
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          disabled={disabled}
          placeholder={placeholder}
          onFocus={() => {
            if (!disabled) {
              setQuery(selectedPlayerLabel || query);
              onActivate?.();
              setOpen(true);
            }
          }}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            onActivate?.();
            if (value) onChange("");
          }}
          className="w-full rounded-2xl border-[3px] border-sky-300 bg-white px-4 py-3 pr-12 text-base font-semibold text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-sky-400 focus:bg-white disabled:cursor-not-allowed disabled:opacity-60 sm:text-sm"
        />
        <button
          type="button"
          disabled={disabled}
          onClick={() => setOpen((prev) => !prev)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-sky-600 disabled:cursor-not-allowed"
        >
          ▼
        </button>
      </div>

      {open && !disabled && (
        <div className="absolute z-40 mt-2 max-h-72 w-full overflow-y-auto rounded-2xl border-[3px] border-sky-300 bg-white shadow-[0_18px_50px_rgba(56,189,248,0.14)]">
          {filteredPlayers.length === 0 ? (
            <div className="px-4 py-3 text-[11px] text-slate-500">
              {query.trim() ? "No players found." : "Start typing a player name."}
            </div>
          ) : (
            filteredPlayers.map((player) => (
              <button
                key={player.player_id}
                type="button"
                onPointerDown={(event) => {
                  event.preventDefault();
                  inputRef.current?.blur();
                }}
                onClick={() => {
                  onChange(String(player.player_id));
                  setQuery(getPlayerLabel(player));
                  setOpen(false);
                  onPlayerSelected?.();
                }}
                className="block w-full border-b border-sky-100 px-4 py-2 text-left text-[11px] text-slate-800 transition hover:bg-sky-50 last:border-b-0"
              >
                <div className="font-semibold leading-tight">
                  {player.player_name}
                </div>
                <div className="mt-0.5 text-[9px] uppercase tracking-[0.05em] text-slate-500">
                  {player.primary_position ?? "N/A"} • Career{" "}
                  {player.career_start_season ?? "N/A"}–
                  {player.career_end_season ?? "N/A"}
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function normalizeUrlDateParam(rawDate: string): string | null {
  if (!rawDate) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(rawDate)) {
    return rawDate;
  }
  return null;
}

function isPlayablePuzzleDate(dateValue: string, maxDate: string): boolean {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(dateValue) &&
    dateValue <= maxDate
  );
}

function getDateFromLocation(location: Location): string | null {
  const pathMatch = location.pathname.match(/^\/p\/(\d{4}-\d{2}-\d{2})\/?$/);
  const pathDate = normalizeUrlDateParam(pathMatch?.[1] ?? "");
  if (pathDate) {
    return pathDate;
  }

  const params = new URLSearchParams(location.search);
  return normalizeUrlDateParam(params.get("date") ?? "");
}

function buildPuzzleUrl(dateValue: string) {
  return `/p/${dateValue}`;
}

const CLIENT_TOKEN_STORAGE_KEY = "five-wide-client-token";
const SUBMITTED_DATES_STORAGE_KEY = "five-wide-submitted-dates";

function getCurrentChicagoDateIso() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function buildNavigationUrl(
  dateValue: string,
  todayIso: string,
  isTestingMode = false
) {
  if (isTestingMode) {
    return `/testing?date=${encodeURIComponent(dateValue)}`;
  }

  return dateValue === todayIso ? "/" : buildPuzzleUrl(dateValue);
}

function generateClientToken() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `browser-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`;
}

function getOrCreateClientToken() {
  if (typeof window === "undefined") return "";

  const existing = window.localStorage.getItem(CLIENT_TOKEN_STORAGE_KEY);
  if (existing) return existing;

  const created = generateClientToken();
  window.localStorage.setItem(CLIENT_TOKEN_STORAGE_KEY, created);
  return created;
}

function readSubmittedDates(): string[] {
  if (typeof window === "undefined") return [];

  const raw = window.localStorage.getItem(SUBMITTED_DATES_STORAGE_KEY);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((value): value is string => typeof value === "string")
      : [];
  } catch {
    return [];
  }
}

function hasBrowserSubmittedForDate(dateValue: string) {
  return readSubmittedDates().includes(dateValue);
}

function markBrowserSubmittedForDate(dateValue: string) {
  if (typeof window === "undefined") return;

  const nextDates = Array.from(new Set([...readSubmittedDates(), dateValue])).sort();
  window.localStorage.setItem(
    SUBMITTED_DATES_STORAGE_KEY,
    JSON.stringify(nextDates)
  );
}

function renderAvatarGlyph(style: AvatarStyle) {
  switch (style) {
    case "crown":
      return (
        <>
          <path d="M4.5 17.5h15l-1.3-7.8-4 3-2.2-5.4-2.2 5.4-4-3-1.3 7.8Z" />
          <path d="M6.8 17.5h10.4" />
          <circle cx="7.6" cy="8.8" r="0.95" />
          <circle cx="12" cy="6.6" r="1" />
          <circle cx="16.4" cy="8.8" r="0.95" />
        </>
      );
    case "diamond":
      return (
        <>
          <path d="M12 3.5 4.8 10.4 12 20.5l7.2-10.1L12 3.5Z" />
          <path d="M8.2 6.9h7.6" />
          <path d="M4.8 10.4h14.4" />
          <path d="M12 3.5v17" />
        </>
      );
    case "comet":
      return (
        <>
          <path d="M8.2 13.8a4.9 4.9 0 1 0 9.8 0 4.9 4.9 0 0 0-9.8 0Z" />
          <path d="M8.6 11.5 3.1 8.6" />
          <path d="M10 8.8 4 5.7" />
          <path d="M7.4 14.3 2.7 14" />
        </>
      );
    case "target":
      return (
        <>
          <circle cx="10.5" cy="13.5" r="6.5" />
          <circle cx="10.5" cy="13.5" r="3.2" />
          <circle cx="10.5" cy="13.5" r="1" />
          <path d="M14.8 9.2 21 3" />
          <path d="M16.3 3H21v4.7" />
        </>
      );
    case "orbit":
      return (
        <>
          <circle cx="12" cy="12" r="2.2" />
          <path d="M4.5 12c1.8-4.7 4.7-7.2 7.5-7.2s5.7 2.5 7.5 7.2c-1.8 4.7-4.7 7.2-7.5 7.2s-5.7-2.5-7.5-7.2Z" />
          <path d="M8 6.7c3.8-.8 7.4.6 9 3.4 1.5 2.7.9 6.4-1.2 9.1" />
          <circle cx="17.3" cy="8.8" r="1" />
        </>
      );
    case "flame":
      return (
        <>
          <path d="M12.5 3.4c2.4 2.9 4.1 5.2 4.1 8a4.5 4.5 0 0 1-4.6 4.5 4.8 4.8 0 0 1-4.9-4.9c0-2 .9-4 2.8-6.3.1 1.8 1 3.2 2.4 4.2.5-2.1.4-4-.1-5.5Z" />
          <path d="M11.8 13.2c1.5 1 2.3 2.2 2.3 3.6a3.1 3.1 0 0 1-6.2 0c0-1.2.7-2.3 1.8-3.6.5 1 1.2 1.6 2.1 2.1Z" />
        </>
      );
    case "moon":
      return (
        <>
          <path d="M15.9 4.4a7.8 7.8 0 1 0 4 14.2 7.1 7.1 0 0 1-5 1.3 7.8 7.8 0 0 1 1-15.5Z" />
          <path d="M8.5 6.5h.01" />
          <path d="M6 9.1h.01" />
          <path d="M7.5 11.7h.01" />
        </>
      );
    case "prism":
      return (
        <>
          <path d="M12 3.5 5 7.8v8.4l7 4.3 7-4.3V7.8l-7-4.3Z" />
          <path d="M5 7.8 12 12l7-4.2" />
          <path d="M12 12v8.5" />
          <path d="M8.5 5.6 15.5 9.8" />
        </>
      );
    case "phoenix":
      return (
        <>
          <path d="M12 5.2c1.7 2 2.8 4 2.8 5.8a2.8 2.8 0 0 1-5.6 0c0-1.9 1-3.9 2.8-5.8Z" />
          <path d="M12 10.6c-1.8 2.3-4.7 3.8-7.5 3.9 1.1-2.4 3-4.4 5.6-5.7" />
          <path d="M12 10.6c1.8 2.3 4.7 3.8 7.5 3.9-1.1-2.4-3-4.4-5.6-5.7" />
          <path d="M8.3 15.4c.8 2.2 2.1 3.9 3.7 5 1.7-1.1 3-2.8 3.8-5" />
        </>
      );
    case "nova":
      return (
        <>
          <circle cx="12" cy="12" r="2.2" />
          <path d="M12 4.2v3.1" />
          <path d="M12 16.7v3.1" />
          <path d="M4.2 12h3.1" />
          <path d="M16.7 12h3.1" />
          <path d="m6.6 6.6 2.2 2.2" />
          <path d="m15.2 15.2 2.2 2.2" />
          <path d="m17.4 6.6-2.2 2.2" />
          <path d="m8.8 15.2-2.2 2.2" />
        </>
      );
    case "rocket":
      return (
        <>
          <path d="M13.1 4.2c3.1 1.2 5.1 4.3 5.6 8.6l-4.9 1.4-4.2-4.2 1.4-4.9c.7-.3 1.4-.6 2.1-.9Z" />
          <path d="m9.6 10.1-3.8 1 2.8 2.8 1-3.8Z" />
          <path d="m13.9 14.4-1 3.8 2.8-2.8-3.8-1Z" />
          <circle cx="14.7" cy="9.4" r="1.1" />
        </>
      );
    case "shieldstar":
      return (
        <>
          <path d="M12 3.4 18.8 6v4.9c0 4.1-2.4 7.6-6.8 9.6-4.4-2-6.8-5.5-6.8-9.6V6l6.8-2.6Z" />
          <path d="m12 7.4 1.1 2.3 2.5.3-1.8 1.7.5 2.5-2.3-1.3-2.3 1.3.5-2.5-1.8-1.7 2.5-.3Z" />
        </>
      );
    case "star":
      return (
        <>
          <path d="m12 3.1 2.4 5.1 5.6.6-4.2 3.8 1.1 5.6L12 15.4l-4.9 2.8 1.1-5.6L4 8.8l5.6-.6Z" />
          <path d="m12 6.8 1 2.2 2.4.3-1.8 1.6.5 2.4-2.1-1.2-2.1 1.2.5-2.4-1.8-1.6 2.4-.3Z" />
        </>
      );
    case "bolt":
      return (
        <>
          <path d="M13.8 2.5 6.4 13.1h4.5L10 21.5l7.6-10.4h-4.5l.7-8.6Z" />
          <path d="M11.2 12.9h2.5" />
        </>
      );
    case "crest":
      return (
        <>
          <path d="M12 3.3 6 5.6v5.6c0 4.1 2.3 7.3 6 9.5 3.7-2.2 6-5.4 6-9.5V5.6L12 3.3Z" />
          <path d="M12 7.2v9.7" />
          <path d="M8.5 10.2h7" />
        </>
      );
    case "helmet":
    default:
      return (
        <>
          <path d="M6.8 12.7A5.4 5.4 0 0 1 12.2 7h1.5A4.5 4.5 0 0 1 18.2 11.5V15H9.4a2.6 2.6 0 0 1-2.6-2.3Z" />
          <path d="M18.2 12.8h2v2.2h-2" />
          <path d="M10.1 15v2" />
          <path d="M9.6 10.1h4.3" />
        </>
      );
  }
}

function ProfileAvatar({
  style,
  bg,
  accent,
  border,
  size = "md",
}: {
  style: AvatarStyle;
  bg: AvatarColor;
  accent: AvatarColor;
  border: AvatarColor;
  size?: "sm" | "md" | "lg";
}) {
  const bgPalette = AVATAR_COLOR_CLASSES[bg];
  const accentPalette = AVATAR_COLOR_CLASSES[accent];
  const borderPalette = AVATAR_COLOR_CLASSES[border];
  const sizeClass =
    size === "sm"
      ? "h-9 w-9"
      : size === "lg"
        ? "h-20 w-20"
        : "h-12 w-12";
  const svgClass =
    size === "sm" ? "h-4 w-4" : size === "lg" ? "h-10 w-10" : "h-6 w-6";
  const paddingClass =
    size === "sm" ? "p-[3px]" : size === "lg" ? "p-[5px]" : "p-1";

  return (
    <div
      className={`relative inline-flex ${sizeClass} ${paddingClass} items-center justify-center rounded-full shadow-[0_10px_24px_rgba(15,23,42,0.16)]`}
      style={{
        background: `linear-gradient(145deg, ${borderPalette.borderSoft}, ${borderPalette.borderHex})`,
        boxShadow: `0 10px 24px rgba(15,23,42,0.16), 0 0 0 1px ${borderPalette.borderSoft}`,
      }}
    >
      <span
        className="pointer-events-none absolute inset-[2px] rounded-full opacity-80"
        style={{
          background:
            "radial-gradient(circle at 30% 22%, rgba(255,255,255,0.42), transparent 34%), radial-gradient(circle at 72% 78%, rgba(255,255,255,0.12), transparent 28%)",
        }}
      />
      <div
        className={`relative flex h-full w-full items-center justify-center overflow-hidden rounded-full bg-gradient-to-br ${bgPalette.bg}`}
      >
        <span className="pointer-events-none absolute inset-[9%] rounded-full border border-white/18" />
        <span className="pointer-events-none absolute inset-x-[18%] top-[14%] h-[26%] rounded-full bg-white/18 blur-[2px]" />
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className={`${svgClass} drop-shadow-[0_1px_1px_rgba(255,255,255,0.18)]`}
          fill={accentPalette.iconHex}
          stroke={accentPalette.iconHex}
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {renderAvatarGlyph(style)}
        </svg>
      </div>
    </div>
  );
}

function GuestProfileButton({
  onClick,
  ariaLabel,
}: {
  onClick: () => void;
  ariaLabel: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-10 w-10 items-center justify-center rounded-full border-[2px] border-white/65 bg-white/20 text-white shadow-[0_8px_18px_rgba(15,23,42,0.18)] backdrop-blur-sm transition hover:scale-[1.02] hover:bg-white/28"
      aria-label={ariaLabel}
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="h-4 w-4"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Z" />
        <path d="M5 20a7 7 0 0 1 14 0" />
      </svg>
    </button>
  );
}

function getBadgeToneClasses(tone: BadgeTone) {
  switch (tone) {
    case "emerald":
      return {
        shell:
          "border-emerald-300 bg-[radial-gradient(circle_at_top,rgba(236,253,245,0.98)_0%,rgba(110,231,183,0.28)_36%,rgba(5,150,105,0.15)_72%,rgba(2,44,34,0.16)_100%)] text-emerald-950 shadow-[0_0_0_1px_rgba(16,185,129,0.14),0_18px_34px_rgba(5,150,105,0.12),inset_0_1px_0_rgba(255,255,255,0.72)]",
        icon: "bg-[linear-gradient(145deg,#d1fae5_0%,#6ee7b7_32%,#10b981_72%,#065f46_100%)] text-emerald-950 shadow-[0_0_18px_rgba(16,185,129,0.24)]",
        meta: "text-emerald-800",
      };
    case "amber":
      return {
        shell:
          "border-amber-300 bg-[radial-gradient(circle_at_top,rgba(255,251,235,0.98)_0%,rgba(253,230,138,0.32)_30%,rgba(245,158,11,0.18)_68%,rgba(120,53,15,0.16)_100%)] text-amber-950 shadow-[0_0_0_1px_rgba(245,158,11,0.16),0_18px_34px_rgba(245,158,11,0.12),inset_0_1px_0_rgba(255,255,255,0.72)]",
        icon: "bg-[linear-gradient(145deg,#fff7cc_0%,#fde68a_28%,#f59e0b_70%,#b45309_100%)] text-amber-950 shadow-[0_0_18px_rgba(245,158,11,0.26)]",
        meta: "text-amber-800",
      };
    case "violet":
      return {
        shell:
          "border-violet-300 bg-[radial-gradient(circle_at_top,rgba(245,243,255,0.98)_0%,rgba(196,181,253,0.3)_34%,rgba(139,92,246,0.16)_70%,rgba(59,7,100,0.16)_100%)] text-violet-950 shadow-[0_0_0_1px_rgba(139,92,246,0.14),0_18px_34px_rgba(109,40,217,0.12),inset_0_1px_0_rgba(255,255,255,0.72)]",
        icon: "bg-[linear-gradient(145deg,#ede9fe_0%,#c4b5fd_32%,#8b5cf6_72%,#5b21b6_100%)] text-violet-950 shadow-[0_0_18px_rgba(139,92,246,0.24)]",
        meta: "text-violet-800",
      };
    case "rose":
      return {
        shell:
          "border-rose-300 bg-[radial-gradient(circle_at_top,rgba(255,241,242,0.98)_0%,rgba(253,164,175,0.3)_32%,rgba(244,63,94,0.16)_68%,rgba(136,19,55,0.14)_100%)] text-rose-950 shadow-[0_0_0_1px_rgba(244,63,94,0.12),0_18px_34px_rgba(244,63,94,0.1),inset_0_1px_0_rgba(255,255,255,0.72)]",
        icon: "bg-[linear-gradient(145deg,#ffe4e6_0%,#fda4af_34%,#f43f5e_74%,#9f1239_100%)] text-rose-950 shadow-[0_0_18px_rgba(244,63,94,0.22)]",
        meta: "text-rose-800",
      };
    case "slate":
      return {
        shell:
          "border-slate-300 bg-[radial-gradient(circle_at_top,rgba(248,250,252,0.98)_0%,rgba(203,213,225,0.28)_34%,rgba(100,116,139,0.18)_70%,rgba(15,23,42,0.18)_100%)] text-slate-950 shadow-[0_0_0_1px_rgba(71,85,105,0.12),0_18px_34px_rgba(51,65,85,0.12),inset_0_1px_0_rgba(255,255,255,0.7)]",
        icon: "bg-[linear-gradient(145deg,#f8fafc_0%,#cbd5e1_26%,#64748b_74%,#1e293b_100%)] text-slate-950 shadow-[0_0_18px_rgba(51,65,85,0.22)]",
        meta: "text-slate-700",
      };
    case "sky":
    default:
      return {
        shell:
          "border-sky-300 bg-[radial-gradient(circle_at_top,rgba(240,249,255,0.98)_0%,rgba(125,211,252,0.3)_34%,rgba(14,165,233,0.16)_70%,rgba(8,47,73,0.15)_100%)] text-sky-950 shadow-[0_0_0_1px_rgba(14,165,233,0.12),0_18px_34px_rgba(14,165,233,0.11),inset_0_1px_0_rgba(255,255,255,0.72)]",
        icon: "bg-[linear-gradient(145deg,#e0f2fe_0%,#7dd3fc_30%,#0ea5e9_70%,#075985_100%)] text-sky-950 shadow-[0_0_18px_rgba(14,165,233,0.22)]",
        meta: "text-sky-800",
      };
  }
}

function BadgeGlyph({ icon }: { icon: BadgeIcon }) {
  switch (icon) {
    case "stack":
      return (
        <>
          <rect x="5" y="5.5" width="14" height="3.3" rx="1.2" />
          <rect x="4.5" y="10.1" width="15" height="3.3" rx="1.2" />
          <rect x="5" y="14.7" width="14" height="3.3" rx="1.2" />
          <path d="M7.5 7.1h1.8" />
          <path d="M7 11.7h2.5" />
          <path d="M7.5 16.3h1.8" />
        </>
      );
    case "trophy":
      return (
        <>
          <path d="M8 4.5h8v2.8a4 4 0 0 1-8 0V4.5Z" />
          <path d="M12 11.1v3.9" />
          <path d="M9 19h6" />
          <path d="M16 6h2a2 2 0 0 1-2.1 2.2" />
          <path d="M8 6H6A2 2 0 0 0 8.1 8.2" />
          <path d="M9.3 15.3h5.4" />
        </>
      );
    case "link":
      return (
        <>
          <path d="M9.1 8.1H7.2a4.1 4.1 0 0 0 0 8.2h1.9" />
          <path d="M14.9 8.1h1.9a4.1 4.1 0 1 1 0 8.2h-1.9" />
          <path d="M8.4 12h7.2" />
          <path d="M10.2 9.8 8.4 12l1.8 2.2" />
          <path d="M13.8 9.8 15.6 12l-1.8 2.2" />
        </>
      );
    case "shield":
      return (
        <>
          <path d="M12 3.4 19 6.3v4.9c0 4.2-2.4 7.9-7 10-4.6-2.1-7-5.8-7-10V6.3l7-2.9Z" />
          <path d="M12 6.6v9.6" />
          <path d="M8.8 10.2h6.4" />
          <path d="M9.4 13.1 11.2 15l3.7-4.1" />
        </>
      );
    case "flag":
      return (
        <>
          <path d="M7 20V4" />
          <path d="M7 5h8.4l-1.9 2.6L15.8 10H7" />
          <path d="M7 5.1 15.2 10" />
          <path d="M10.2 20h4.5" />
        </>
      );
    case "crown":
      return (
        <>
          <path d="M5 17.4h14l-1.2-7.9-3.8 2.9-2-5-2 5-3.8-2.9L5 17.4Z" />
          <path d="M7 20h10" />
          <path d="M8 17.4h8" />
          <circle cx="7.7" cy="9" r="0.75" />
          <circle cx="12" cy="7" r="0.75" />
          <circle cx="16.3" cy="9" r="0.75" />
        </>
      );
    case "spark":
    default:
      return (
        <>
          <path d="m12 3 1.9 4.9L19 10l-5.1 2L12 17l-1.9-5L5 10l5.1-2Z" />
          <path d="m18.4 4.8.7 1.7 1.7.7-1.7.6-.7 1.8-.7-1.8-1.7-.6 1.7-.7.7-1.7Z" />
          <path d="m6.4 14.9.5 1.1 1.1.5-1.1.4-.5 1.2-.5-1.2-1.1-.4 1.1-.5.5-1.1Z" />
        </>
      );
  }
}

function ProfileBadgeCard({
  badge,
  compact = false,
  locked = false,
  helperText,
  actionLabel,
  onAction,
  actionDisabled = false,
}: {
  badge: Pick<
    UserBadge,
    "badgeKey" | "title" | "description" | "tone" | "icon" | "awardedAt"
  >;
  compact?: boolean;
  locked?: boolean;
  helperText?: string;
  actionLabel?: string;
  onAction?: (() => void) | null;
  actionDisabled?: boolean;
}) {
  const isCreatorBadge = badge.badgeKey === "creator";
  const isBestestestBadge = badge.badgeKey === "bestestest";
  const isDailyCrownBadge = badge.badgeKey === "first_place_finish";
  const isLegendaryManualBadge = isCreatorBadge || isBestestestBadge;
  const isSignatureBadge = isLegendaryManualBadge || isDailyCrownBadge;
  const isPinned = actionLabel === "Featured";
  const tone = locked
    ? {
        shell:
          "border-slate-200 bg-[linear-gradient(145deg,rgba(241,245,249,0.96),rgba(226,232,240,0.95))] text-slate-600 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]",
        icon: "bg-[linear-gradient(145deg,#94a3b8,#64748b)] text-white",
        meta: "text-slate-500",
        aura: "",
      }
    : isSignatureBadge
      ? {
          shell:
            isBestestestBadge
              ? "border-pink-300 bg-[radial-gradient(circle_at_top,rgba(255,244,250,0.99)_0%,rgba(244,114,182,0.36)_20%,rgba(168,85,247,0.34)_44%,rgba(91,33,182,0.46)_68%,rgba(17,24,39,0.96)_100%)] text-amber-50 shadow-[0_0_0_1px_rgba(244,114,182,0.42),0_0_34px_rgba(168,85,247,0.24),0_24px_52px_rgba(91,33,182,0.38),inset_0_1px_0_rgba(255,255,255,0.24)]"
              : isDailyCrownBadge
                ? "border-cyan-200 bg-[radial-gradient(circle_at_top,rgba(250,254,255,0.99)_0%,rgba(254,240,138,0.42)_18%,rgba(165,243,252,0.32)_40%,rgba(8,145,178,0.34)_64%,rgba(8,47,73,0.92)_100%)] text-amber-50 shadow-[0_0_0_1px_rgba(103,232,249,0.42),0_0_34px_rgba(34,211,238,0.22),0_24px_52px_rgba(8,145,178,0.32),inset_0_1px_0_rgba(255,255,255,0.28)]"
                : "border-sky-300 bg-[radial-gradient(circle_at_top,rgba(255,248,220,0.99)_0%,rgba(250,204,21,0.4)_18%,rgba(125,211,252,0.32)_38%,rgba(37,99,235,0.34)_62%,rgba(8,47,73,0.9)_100%)] text-amber-50 shadow-[0_0_0_1px_rgba(125,211,252,0.42),0_0_34px_rgba(56,189,248,0.24),0_24px_52px_rgba(30,64,175,0.34),inset_0_1px_0_rgba(255,255,255,0.28)]",
          icon: isBestestestBadge
            ? "bg-[linear-gradient(145deg,#fff1f2_0%,#f9a8d4_18%,#f472b6_42%,#a855f7_72%,#581c87_100%)] text-amber-50 shadow-[0_0_24px_rgba(244,114,182,0.46)]"
            : isDailyCrownBadge
              ? "bg-[linear-gradient(145deg,#fefce8_0%,#fde68a_18%,#a5f3fc_48%,#06b6d4_74%,#164e63_100%)] text-cyan-950 shadow-[0_0_24px_rgba(34,211,238,0.34)]"
              : "bg-[linear-gradient(145deg,#fff7cc_0%,#fde68a_18%,#7dd3fc_48%,#2563eb_74%,#1e3a8a_100%)] text-sky-950 shadow-[0_0_24px_rgba(56,189,248,0.42)]",
          meta: isBestestestBadge ? "text-amber-100" : isDailyCrownBadge ? "text-cyan-100/90" : "text-sky-950/90",
          aura: isBestestestBadge
            ? "before:absolute before:inset-0 before:bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.28),transparent_48%),radial-gradient(circle_at_78%_18%,rgba(244,114,182,0.2),transparent_22%),repeating-linear-gradient(135deg,rgba(244,114,182,0.1)_0,rgba(244,114,182,0.1)_8px,transparent_8px,transparent_16px)] before:content-[''] after:absolute after:-inset-8 after:-z-10 after:rounded-[30px] after:bg-[radial-gradient(circle,rgba(168,85,247,0.24),transparent_60%)] after:blur-xl after:content-['']"
            : isDailyCrownBadge
              ? "before:absolute before:inset-0 before:bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.3),transparent_48%),radial-gradient(circle_at_78%_18%,rgba(103,232,249,0.18),transparent_22%),repeating-linear-gradient(135deg,rgba(103,232,249,0.08)_0,rgba(103,232,249,0.08)_8px,transparent_8px,transparent_16px)] before:content-[''] after:absolute after:-inset-8 after:-z-10 after:rounded-[30px] after:bg-[radial-gradient(circle,rgba(34,211,238,0.22),transparent_60%)] after:blur-xl after:content-['']"
              : "before:absolute before:inset-0 before:bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.32),transparent_48%),radial-gradient(circle_at_78%_18%,rgba(125,211,252,0.22),transparent_22%),repeating-linear-gradient(135deg,rgba(56,189,248,0.08)_0,rgba(56,189,248,0.08)_8px,transparent_8px,transparent_16px)] before:content-[''] after:absolute after:-inset-8 after:-z-10 after:rounded-[30px] after:bg-[radial-gradient(circle,rgba(56,189,248,0.24),transparent_60%)] after:blur-xl after:content-['']",
        }
      : {
          ...getBadgeToneClasses(badge.tone),
          aura: "",
        };

  return (
    <div
      className={`group relative overflow-hidden rounded-[24px] border px-3.5 py-3.5 ${tone.shell} ${tone.aura} ${
        compact ? "min-w-[158px]" : ""
      }`}
    >
      <div className="absolute inset-x-5 top-0 h-px bg-white/70" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.26),transparent_52%)]" />
      <div className="pointer-events-none absolute -right-10 top-4 h-24 w-24 rounded-full bg-white/10 blur-2xl" />
      {onAction ? (
        <button
          type="button"
          onClick={onAction}
          disabled={actionDisabled}
          aria-label={isPinned ? `Unfeature ${badge.title}` : `Feature ${badge.title}`}
          className={`absolute bottom-3 right-3 z-10 inline-flex h-6 w-6 items-center justify-center text-slate-950 transition ${
            isPinned
              ? "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100"
              : "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 hover:-translate-y-0.5"
          } disabled:cursor-not-allowed disabled:opacity-30`}
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M8 3h8v8l-4-2.5L8 11V3Z" />
            <path d="M12 10.5V21" />
          </svg>
        </button>
      ) : null}
      <div className="relative flex items-start gap-3">
        <div
          className={`relative inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-[17px] border border-white/45 shadow-[0_14px_22px_rgba(15,23,42,0.14)] ${tone.icon}`}
        >
          <span className="absolute inset-[1px] rounded-[14px] bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.42),transparent_58%)]" />
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className="relative h-5 w-5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <BadgeGlyph icon={badge.icon} />
          </svg>
        </div>
        <div className="min-w-0">
          <p
            className={`text-xs font-black uppercase tracking-[0.13em] ${
              isCreatorBadge
                ? "text-sky-950 drop-shadow-[0_1px_0_rgba(255,248,220,0.55)]"
                : "drop-shadow-[0_1px_0_rgba(255,255,255,0.45)]"
            }`}
          >
            {badge.title}
          </p>
          <p
            className={`mt-1.5 text-xs font-semibold leading-5 ${
              locked
                ? "text-slate-600"
                : isCreatorBadge
                  ? "text-sky-950/90"
                  : isSignatureBadge
                    ? "text-amber-50/90"
                    : "text-slate-700"
            }`}
          >
            {badge.description}
          </p>
          <p className={`mt-2.5 text-[10px] font-black uppercase tracking-[0.1em] ${tone.meta}`}>
            {locked
              ? helperText ?? "Locked"
              : `Earned ${formatBadgeAwardDate(badge.awardedAt)}`}
          </p>
          {onAction ? (
            <p className="mt-3 text-[10px] font-black uppercase tracking-[0.08em] text-slate-500">
              {isPinned ? "Pinned to profile" : "Tap pin to feature"}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function LeaderboardBadgeIcons({ badgeKeys }: { badgeKeys?: BadgeKey[] }) {
  const badges = (badgeKeys ?? [])
    .map((badgeKey) => getBadgeDefinition(badgeKey))
    .filter((badge): badge is NonNullable<ReturnType<typeof getBadgeDefinition>> => Boolean(badge))
    .slice(0, 3);

  if (badges.length === 0) {
    return null;
  }

  return (
    <div className="mt-1 flex items-center gap-1.5">
      {badges.map((badge) => {
        const tone = getBadgeToneClasses(badge.tone);
        const isCreatorBadge = badge.key === "creator";
        const isBestestestBadge = badge.key === "bestestest";
        const isDailyCrownBadge = badge.key === "first_place_finish";
        const isLegendaryManualBadge = isCreatorBadge || isBestestestBadge;
        const isSignatureBadge = isLegendaryManualBadge || isDailyCrownBadge;
        return (
          <span
            key={badge.key}
            className={`relative inline-flex h-6 w-6 items-center justify-center overflow-hidden rounded-full border border-white/75 shadow-[0_8px_16px_rgba(15,23,42,0.12)] ${
              isSignatureBadge
                ? isBestestestBadge
                  ? "bg-[radial-gradient(circle_at_30%_28%,#fff1f2_0%,#f9a8d4_16%,#f472b6_38%,#a855f7_60%,#581c87_82%,#111827_100%)] text-amber-50 shadow-[0_0_0_1px_rgba(244,114,182,0.58),0_0_16px_rgba(168,85,247,0.52),0_12px_24px_rgba(91,33,182,0.38)] before:absolute before:-inset-1.5 before:-z-10 before:rounded-full before:bg-[radial-gradient(circle,rgba(244,114,182,0.52),transparent_66%)] before:blur-[7px] before:content-[''] after:absolute after:inset-0 after:rounded-full after:bg-[conic-gradient(from_180deg_at_50%_50%,rgba(255,255,255,0.18),transparent_20%,rgba(255,255,255,0.08)_36%,transparent_56%,rgba(255,255,255,0.18))] after:content-['']"
                  : isDailyCrownBadge
                    ? "bg-[radial-gradient(circle_at_30%_28%,#fefce8_0%,#fde68a_18%,#a5f3fc_42%,#06b6d4_66%,#164e63_86%,#082f49_100%)] text-cyan-950 shadow-[0_0_0_1px_rgba(103,232,249,0.58),0_0_16px_rgba(34,211,238,0.48),0_12px_24px_rgba(8,145,178,0.32)] before:absolute before:-inset-1.5 before:-z-10 before:rounded-full before:bg-[radial-gradient(circle,rgba(34,211,238,0.48),transparent_66%)] before:blur-[7px] before:content-[''] after:absolute after:inset-0 after:rounded-full after:bg-[conic-gradient(from_180deg_at_50%_50%,rgba(255,255,255,0.18),transparent_20%,rgba(255,255,255,0.08)_36%,transparent_56%,rgba(255,255,255,0.18))] after:content-['']"
                    : "bg-[radial-gradient(circle_at_30%_28%,#fff8cc_0%,#fde68a_18%,#7dd3fc_42%,#2563eb_64%,#1e3a8a_84%,#082f49_100%)] text-sky-950 shadow-[0_0_0_1px_rgba(125,211,252,0.58),0_0_16px_rgba(56,189,248,0.54),0_12px_24px_rgba(30,64,175,0.34)] before:absolute before:-inset-1.5 before:-z-10 before:rounded-full before:bg-[radial-gradient(circle,rgba(56,189,248,0.54),transparent_66%)] before:blur-[7px] before:content-[''] after:absolute after:inset-0 after:rounded-full after:bg-[conic-gradient(from_180deg_at_50%_50%,rgba(255,255,255,0.18),transparent_20%,rgba(255,255,255,0.08)_36%,transparent_56%,rgba(255,255,255,0.18))] after:content-['']"
                : tone.icon
            }`}
            title={badge.title}
          >
            <span className="absolute inset-[1px] rounded-full bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.38),transparent_58%)]" />
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              className="relative h-3.5 w-3.5 drop-shadow-[0_1px_1px_rgba(255,255,255,0.22)]"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.9"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <BadgeGlyph icon={badge.icon} />
            </svg>
          </span>
        );
      })}
    </div>
  );
}

function DataStateBadge({
  finalized,
  compact = false,
}: {
  finalized: boolean;
  compact?: boolean;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 font-black uppercase tracking-[0.1em] ${
        finalized
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : "border-amber-200 bg-amber-50 text-amber-700"
      } ${compact ? "text-[9px]" : "text-[10px]"}`}
    >
      <span
        className={`h-2 w-2 rounded-full ${
          finalized ? "bg-emerald-500" : "bg-amber-500"
        }`}
      />
      {finalized ? "Finalized" : "Live"}
    </span>
  );
}

function RecentSubmissionList({
  submissions,
  emptyMessage,
}: {
  submissions: PublicProfileResponse["profile"]["recent_submissions"];
  emptyMessage: string;
}) {
  if (submissions.length === 0) {
    return (
      <div className="rounded-[18px] border-[3px] border-sky-100 bg-white/85 px-4 py-6 text-center text-sm font-semibold text-slate-600">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {submissions.map((submission) => (
        <div
          key={submission.submission_id}
          className="rounded-[18px] border-[3px] border-sky-100 bg-white/90 px-4 py-3 shadow-[0_10px_22px_rgba(125,211,252,0.08)]"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[0.08em] text-sky-700">
                {formatHistoryDateLabel(submission.puzzle_date)}
              </p>
              <p className="mt-1 text-sm font-black text-slate-900">
                {submission.placement != null
                  ? `Finalized #${submission.placement}`
                  : "Lineup locked"}
              </p>
              <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.06em] text-sky-700/80">
                {submission.active_links} links • {submission.multiplier.toFixed(2)}x •{" "}
                {submission.percent_of_optimal != null
                  ? `${Number(submission.percent_of_optimal).toFixed(1)}% optimal`
                  : "Optimal pending"}
              </p>
            </div>
            <div className="text-left sm:text-right">
              <p className="text-[10px] font-black uppercase tracking-[0.08em] text-slate-500">
                Final Score
              </p>
              <p className="mt-1 text-lg font-black text-sky-800">
                {formatCompactScore(submission.final_score)}
              </p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function HomePage() {
  const pathname = usePathname();
  const isTestingMode = pathname === "/testing";
  const todayIso = getCurrentChicagoDateIso();
  const loadRequestRef = useRef(0);
  const relationshipRequestRef = useRef(0);
  const submissionRequestKeyRef = useRef<string | null>(null);
  const nodeFocusMapRef = useRef(new Map<number, () => void>());
  const [isMobileBoard, setIsMobileBoard] = useState(false);
  const [puzzleData, setPuzzleData] = useState<PuzzleResponse | null>(null);
  const [playersData, setPlayersData] = useState<PlayersResponse | null>(null);
  const [pairRelationships, setPairRelationships] = useState<PairRelationship[]>(
    []
  );
  const [selectedDate, setSelectedDate] = useState(() => {
    if (typeof window === "undefined") return todayIso;
    const normalized = getDateFromLocation(window.location);
    return normalized && (isTestingMode || isPlayablePuzzleDate(normalized, todayIso))
      ? normalized
      : todayIso;
  });
  const [nodes, setNodes] = useState<NodeState[]>([]);
  const [activeNodeId, setActiveNodeId] = useState(1);
  const [mobileNavigatorOpen, setMobileNavigatorOpen] = useState(true);
  const [submitted, setSubmitted] = useState(false);
  const [browserClientToken, setBrowserClientToken] = useState("");
  const [hasSubmittedForSelectedDate, setHasSubmittedForSelectedDate] =
    useState(false);
  const [accountHasSubmittedForSelectedDate, setAccountHasSubmittedForSelectedDate] =
    useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [leaderboardOpen, setLeaderboardOpen] = useState(false);
  const [accountChoiceOpen, setAccountChoiceOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [usernameDraft, setUsernameDraft] = useState("");
  const [usernameSaving, setUsernameSaving] = useState(false);
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [avatarStyleDraft, setAvatarStyleDraft] = useState<AvatarStyle>(
    DEFAULT_AVATAR.style
  );
  const [avatarBgDraft, setAvatarBgDraft] = useState<AvatarColor>(
    DEFAULT_AVATAR.bg
  );
  const [avatarAccentDraft, setAvatarAccentDraft] = useState<AvatarColor>(
    DEFAULT_AVATAR.accent
  );
  const [avatarBorderDraft, setAvatarBorderDraft] = useState<AvatarColor>(
    DEFAULT_AVATAR.border
  );
  const [avatarEditorTab, setAvatarEditorTab] = useState<
    "style" | "background" | "icon" | "border"
  >("style");
  const [avatarOptionPage, setAvatarOptionPage] = useState(0);
  const [featuredBadgeDraft, setFeaturedBadgeDraft] = useState<BadgeKey[]>([]);
  const [avatarSaving, setAvatarSaving] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [badgeSaving, setBadgeSaving] = useState(false);
  const [badgeError, setBadgeError] = useState<string | null>(null);
  const [activeFeaturedBadgeKey, setActiveFeaturedBadgeKey] = useState<string | null>(
    null
  );
  const [badgeGalleryTab, setBadgeGalleryTab] =
    useState<BadgeGalleryTab>("milestones");
  const [galleryPage, setGalleryPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showFullLinkConfetti, setShowFullLinkConfetti] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [optimalLineup, setOptimalLineup] = useState<OptimalLineupResponse | null>(
    null
  );
  const [optimalLoading, setOptimalLoading] = useState(false);
  const [optimalError, setOptimalError] = useState<string | null>(null);
  const [currentLeaderLineup, setCurrentLeaderLineup] =
    useState<CurrentLeaderLineupResponse | null>(null);
  const [currentLeaderLoading, setCurrentLeaderLoading] = useState(false);
  const [currentLeaderError, setCurrentLeaderError] = useState<string | null>(null);
  const [submissionResult, setSubmissionResult] = useState<SubmissionResponse | null>(
    null
  );
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);
  const [leaderboardError, setLeaderboardError] = useState<string | null>(null);
  const [leaderboardLastUpdatedAt, setLeaderboardLastUpdatedAt] = useState<string | null>(null);
  const [leaderboardScope, setLeaderboardScope] = useState<"all" | "friends">("all");
  const [leaderboardView, setLeaderboardView] = useState<
    "today" | "yesterday" | "all-time"
  >("today");
  const [allTimeLeaderboard, setAllTimeLeaderboard] = useState<AllTimeLeaderboardEntry[]>(
    []
  );
  const [allTimeLeaderboardLoading, setAllTimeLeaderboardLoading] = useState(false);
  const [allTimeLeaderboardError, setAllTimeLeaderboardError] = useState<string | null>(
    null
  );
  const [allTimeLeaderboardLastUpdatedAt, setAllTimeLeaderboardLastUpdatedAt] =
    useState<string | null>(null);
  const [comparisonLastUpdatedAt, setComparisonLastUpdatedAt] = useState<string | null>(
    null
  );
  const [homeRecapLastUpdatedAt, setHomeRecapLastUpdatedAt] = useState<string | null>(null);
  const [publicProfileOpen, setPublicProfileOpen] = useState(false);
  const [publicProfileLoading, setPublicProfileLoading] = useState(false);
  const [publicProfileError, setPublicProfileError] = useState<string | null>(null);
  const [publicProfile, setPublicProfile] = useState<PublicProfileResponse["profile"] | null>(
    null
  );
  const [selfProfile, setSelfProfile] = useState<SelfProfileResponse["profile"] | null>(null);
  const [selfProfileLoading, setSelfProfileLoading] = useState(false);
  const [selfProfileError, setSelfProfileError] = useState<string | null>(null);
  const [friendOverview, setFriendOverview] = useState<FriendOverviewResponse["overview"] | null>(
    null
  );
  const [friendOverviewLoading, setFriendOverviewLoading] = useState(false);
  const [friendOverviewError, setFriendOverviewError] = useState<string | null>(null);
  const [friendSearchDraft, setFriendSearchDraft] = useState("");
  const [friendSearchResult, setFriendSearchResult] =
    useState<FriendSearchResponse["match"]>(null);
  const [friendSearchLoading, setFriendSearchLoading] = useState(false);
  const [friendSearchMessage, setFriendSearchMessage] = useState<string | null>(null);
  const [friendActionLoadingId, setFriendActionLoadingId] = useState<string | null>(null);
  const [friendActionError, setFriendActionError] = useState<string | null>(null);
  const [friendTab, setFriendTab] = useState<"friends" | "pending" | "requests">(
    "friends"
  );
  const [profileSectionTab, setProfileSectionTab] = useState<"profile" | "social">(
    "profile"
  );
  const [activePublicFeaturedBadgeKey, setActivePublicFeaturedBadgeKey] = useState<string | null>(
    null
  );
  const [homeRecap, setHomeRecap] = useState<HomeRecapResponse["recap"]>(null);
  const [homeRecapLoading, setHomeRecapLoading] = useState(true);
  const [savedSubmissionLoading, setSavedSubmissionLoading] = useState(false);
  const [relationshipTooltipOpen, setRelationshipTooltipOpen] = useState(false);
  const { data: session, status: sessionStatus, update: updateSession } =
    useSession();
  const signedInUsername = session?.user?.username ?? null;
  const isAdmin = Boolean(session?.user?.isAdmin);
  const isTrackedAccountUser = Boolean(session?.user?.id && signedInUsername);
  const withModeParam = useCallback(
    (url: string) =>
      isTestingMode ? `${url}${url.includes("?") ? "&" : "?"}testing=1` : url,
    [isTestingMode]
  );
  const [submissionViewMode, setSubmissionViewMode] = useState<
    "new" | "existing" | null
  >(null);
  const needsUsername = Boolean(session?.user?.id && session.user.needsUsername);
  const sessionAvatarStyle = (session?.user?.avatarStyle ?? DEFAULT_AVATAR.style) as AvatarStyle;
  const sessionAvatarBg = (session?.user?.avatarBg ?? DEFAULT_AVATAR.bg) as AvatarColor;
  const sessionAvatarAccent = (session?.user?.avatarAccent ??
    DEFAULT_AVATAR.accent) as AvatarColor;
  const sessionAvatarBorder = (session?.user?.avatarBorder ??
    DEFAULT_AVATAR.border) as AvatarColor;
  const profileCreatedAt = session?.user?.createdAt ?? null;
  const userBadges = useMemo(
    () => (session?.user?.badges ?? []) as UserBadge[],
    [session?.user?.badges]
  );
  const userStats = useMemo(
    () =>
      session?.user?.stats ?? {
        puzzles_submitted: 0,
        leaderboard_finishes: 0,
        links_created: 0,
        longest_submission_streak: 0,
        friends_count: 0,
        friend_daily_wins: 0,
      },
    [session?.user?.stats]
  );
  const selfRecentSubmissions = selfProfile?.recent_submissions ?? [];
  const friendLeaderboardUserIds = useMemo(() => {
    if (!session?.user?.id) {
      return new Set<string>();
    }

    return new Set([
      session.user.id,
      ...((friendOverview?.friends ?? []).map((friend) => friend.user_id)),
    ]);
  }, [friendOverview?.friends, session?.user?.id]);
  const filteredYesterdayWinners = useMemo(() => {
    const winners = homeRecap?.winners ?? [];

    if (leaderboardScope !== "friends") {
      return winners;
    }

    if (friendLeaderboardUserIds.size === 0) {
      return [];
    }

    return winners.filter((entry) => friendLeaderboardUserIds.has(entry.user_id));
  }, [friendLeaderboardUserIds, homeRecap?.winners, leaderboardScope]);
  const featuredBadgeKeys = useMemo(
    () =>
      ((session?.user?.featuredBadges ?? []) as string[])
        .filter((badgeKey): badgeKey is BadgeKey => typeof badgeKey === "string")
        .slice(0, 3),
    [session?.user?.featuredBadges]
  );
  const earnedBadgeMap = useMemo(
    () => new Map(userBadges.map((badge) => [badge.badgeKey, badge])),
    [userBadges]
  );
  const publicBadgeDefinitions = useMemo(() => {
    const visibleDefinitions = [...getPublicBadgeDefinitions()];
    const visibleKeys = new Set(visibleDefinitions.map((badge) => badge.key));

    userBadges.forEach((badge) => {
      if (!badge.manualOnly || visibleKeys.has(badge.badgeKey)) {
        return;
      }

      const definition = getBadgeDefinition(badge.badgeKey);
      if (definition) {
        visibleDefinitions.unshift(definition);
        visibleKeys.add(definition.key);
      }
    });

    return visibleDefinitions.sort((a, b) => {
      const aEarned = earnedBadgeMap.has(a.key);
      const bEarned = earnedBadgeMap.has(b.key);
      if (aEarned !== bEarned) {
        return aEarned ? -1 : 1;
      }

      return 0;
    });
  }, [earnedBadgeMap, userBadges]);
  const filteredGalleryBadges = useMemo(
    () =>
      publicBadgeDefinitions.filter(
        (badgeDefinition) => getBadgeGalleryTab(badgeDefinition.key) === badgeGalleryTab
      ),
    [badgeGalleryTab, publicBadgeDefinitions]
  );
  const galleryPageSize = 4;
  const pagedGalleryBadges = filteredGalleryBadges.slice(
    galleryPage * galleryPageSize,
    (galleryPage + 1) * galleryPageSize
  );
  const galleryPageCount = Math.max(
    1,
    Math.ceil(filteredGalleryBadges.length / galleryPageSize)
  );
  const featuredBadges = featuredBadgeDraft
    .map((badgeKey) => earnedBadgeMap.get(badgeKey))
    .filter((badge): badge is UserBadge => Boolean(badge));
  const featuredBadgeSlots = [0, 1, 2].map((index) => featuredBadges[index] ?? null);
  const publicFeaturedBadges = (publicProfile?.featured_badges ?? [])
    .map((badgeKey) =>
      publicProfile?.badges.find((badge) => badge.badgeKey === badgeKey) ?? null
    )
    .filter((badge): badge is UserBadge => Boolean(badge));
  const publicFeaturedBadgeSlots = [0, 1, 2].map(
    (index) => publicFeaturedBadges[index] ?? null
  );
  const avatarEditorConfig = useMemo(() => {
    switch (avatarEditorTab) {
      case "background":
        return {
          title: "Background Color",
          options: AVATAR_COLORS,
          selected: avatarBgDraft,
          pageSize: 6,
        };
      case "icon":
        return {
          title: "Color",
          options: AVATAR_COLORS,
          selected: avatarAccentDraft,
          pageSize: 6,
        };
      case "border":
        return {
          title: "Border Color",
          options: AVATAR_COLORS,
          selected: avatarBorderDraft,
          pageSize: 6,
        };
      case "style":
      default:
        return {
          title: "Icon",
          options: AVATAR_STYLES,
          selected: avatarStyleDraft,
          pageSize: 6,
        };
    }
  }, [
    avatarAccentDraft,
    avatarBgDraft,
    avatarBorderDraft,
    avatarEditorTab,
    avatarStyleDraft,
  ]);
  const avatarOptionPageCount = Math.max(
    1,
    Math.ceil(avatarEditorConfig.options.length / avatarEditorConfig.pageSize)
  );
  const pagedAvatarOptions = avatarEditorConfig.options.slice(
    avatarOptionPage * avatarEditorConfig.pageSize,
    (avatarOptionPage + 1) * avatarEditorConfig.pageSize
  );

  useEffect(() => {
    if (typeof window === "undefined") return;

    const updateIsMobileBoard = () => {
      setIsMobileBoard(window.innerWidth < 640);
    };

    updateIsMobileBoard();
    window.addEventListener("resize", updateIsMobileBoard);
    return () => window.removeEventListener("resize", updateIsMobileBoard);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const urlDate = getDateFromLocation(window.location);
    const basePath = isTestingMode ? "/testing" : "/";

    if (
      !isTestingMode &&
      (!urlDate || !isPlayablePuzzleDate(urlDate, todayIso)) &&
      window.location.pathname !== basePath
    ) {
      window.history.replaceState({}, "", basePath);
      return;
    }

    if (!isTestingMode && urlDate === todayIso && window.location.pathname !== basePath) {
      window.history.replaceState({}, "", basePath);
    }
  }, [isTestingMode, todayIso]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setBrowserClientToken(getOrCreateClientToken());
  }, []);

  useEffect(() => {
    setHasSubmittedForSelectedDate(
      isTrackedAccountUser ? false : hasBrowserSubmittedForDate(selectedDate)
    );
    setAccountHasSubmittedForSelectedDate(false);
    setSubmissionError(null);
  }, [isTrackedAccountUser, selectedDate]);

  useEffect(() => {
    if (!session?.user?.id) {
      setProfileOpen(false);
      return;
    }

    setAvatarStyleDraft(sessionAvatarStyle);
    setAvatarBgDraft(sessionAvatarBg);
    setAvatarAccentDraft(sessionAvatarAccent);
    setAvatarBorderDraft(sessionAvatarBorder);
    setFeaturedBadgeDraft(featuredBadgeKeys);
    setAvatarEditorTab("style");
    setAvatarOptionPage(0);
    setAvatarError(null);
    setBadgeError(null);
  }, [
    session?.user?.id,
    sessionAvatarStyle,
    sessionAvatarBg,
    sessionAvatarAccent,
    sessionAvatarBorder,
    featuredBadgeKeys,
  ]);

  useEffect(() => {
    if (signedInUsername || needsUsername) {
      setAccountChoiceOpen(false);
    }
  }, [needsUsername, signedInUsername]);

  useEffect(() => {
    setActiveFeaturedBadgeKey(null);
  }, [featuredBadgeDraft, profileOpen]);

  useEffect(() => {
    if (!profileOpen) {
      setFriendSearchDraft("");
      setFriendSearchResult(null);
      setFriendSearchMessage(null);
      setFriendActionError(null);
    }
  }, [profileOpen]);

  useEffect(() => {
    setGalleryPage((current) =>
      clampPageIndex(current, filteredGalleryBadges.length, galleryPageSize)
    );
  }, [filteredGalleryBadges.length, galleryPageSize]);

  useEffect(() => {
    setGalleryPage(0);
  }, [badgeGalleryTab]);

  useEffect(() => {
    setAvatarOptionPage((current) =>
      clampPageIndex(
        current,
        avatarEditorConfig.options.length,
        avatarEditorConfig.pageSize
      )
    );
  }, [avatarEditorConfig.options.length, avatarEditorConfig.pageSize]);

  useEffect(() => {
    if (isTestingMode || isPlayablePuzzleDate(selectedDate, todayIso)) return;
    setSelectedDate(todayIso);

    if (typeof window !== "undefined") {
      window.history.replaceState({}, "", isTestingMode ? "/testing" : "/");
    }
  }, [isTestingMode, selectedDate, todayIso]);

  useEffect(() => {
    const controller = new AbortController();
    const requestId = ++loadRequestRef.current;

    async function loadData() {
      try {
        setLoading(true);
        setLoadError(null);
        setSubmissionError(null);
        setPairRelationships([]);
        const params = selectedDate ? `?date=${encodeURIComponent(selectedDate)}` : "";
        const submissionParams = new URLSearchParams();
        submissionParams.set("date", selectedDate);
        if (!isTrackedAccountUser && browserClientToken) {
          submissionParams.set("client_token", browserClientToken);
        }

        const shouldTryLoadSavedSubmission =
          !isTestingMode && Boolean(isTrackedAccountUser || browserClientToken);

        const [puzzleRes, playersRes, savedSubmissionRes] = await Promise.all([
          fetch(withModeParam(`/api/puzzle${params}`), {
            cache: "no-store",
            signal: controller.signal,
          }),
          fetch(withModeParam(`/api/players${params}`), {
            cache: "no-store",
            signal: controller.signal,
          }),
          shouldTryLoadSavedSubmission
            ? fetch(withModeParam(`/api/submissions?${submissionParams.toString()}`), {
                cache: "no-store",
                signal: controller.signal,
              })
            : Promise.resolve(null),
        ]);

        if (
          !puzzleRes.ok ||
          !playersRes.ok ||
          (savedSubmissionRes &&
            !savedSubmissionRes.ok &&
            savedSubmissionRes.status !== 404)
        ) {
          const [puzzleBody, playersBody, submissionBody] = await Promise.all([
            puzzleRes.text(),
            playersRes.text(),
            savedSubmissionRes ? savedSubmissionRes.text() : Promise.resolve(""),
          ]);
          throw new Error(
            `puzzle ${puzzleRes.status}: ${puzzleBody || "no body"} | players ${playersRes.status}: ${playersBody || "no body"} | submission ${savedSubmissionRes?.status ?? "skipped"}: ${submissionBody || "no body"}`
          );
        }

        const puzzleJson: PuzzleResponse = await puzzleRes.json();
        const playersJson: PlayersResponse = await playersRes.json();
        const savedSubmissionJson: SubmissionResponse | null =
          savedSubmissionRes && savedSubmissionRes.ok
            ? await savedSubmissionRes.json()
            : null;

        if (controller.signal.aborted || requestId !== loadRequestRef.current) {
          return;
        }

        setPuzzleData(puzzleJson);
        setPlayersData(playersJson);
        setAccountHasSubmittedForSelectedDate(
          isTestingMode
            ? false
            : Boolean(
                isTrackedAccountUser &&
                  (puzzleJson.viewer_has_submitted || savedSubmissionJson)
              )
        );
        if (!isTrackedAccountUser && !isTestingMode) {
          if (savedSubmissionJson) {
            markBrowserSubmittedForDate(selectedDate);
          }
          setHasSubmittedForSelectedDate(
            Boolean(savedSubmissionJson) || hasBrowserSubmittedForDate(selectedDate)
          );
        }
        setOptimalLineup(null);
        setOptimalError(null);
        setOptimalLoading(false);
        setCurrentLeaderLineup(null);
        setCurrentLeaderError(null);
        setCurrentLeaderLoading(false);
        setSubmissionResult(null);
        setSubmissionViewMode(null);
        setLeaderboard([]);
        setLeaderboardLoading(false);
        setLeaderboardError(null);
        const initial =
          savedSubmissionJson?.lineup && savedSubmissionJson.lineup.length === 5
            ? savedSubmissionJson.lineup.map((entry) => ({
                node_id: Number(entry.slot_number),
                player_id: String(entry.player_id),
              }))
            : [1, 2, 3, 4, 5].map((nodeId) => ({
                node_id: nodeId,
                player_id: "",
              }));

        setNodes(initial);
        setActiveNodeId(1);
        setMobileNavigatorOpen(true);
        setSubmitted(false);
      } catch (error) {
        if (
          (error as Error).name === "AbortError" ||
          requestId !== loadRequestRef.current
        ) {
          return;
        }
        console.error(error);
        setLoadError((error as Error).message);
      } finally {
        if (
          !controller.signal.aborted &&
          requestId === loadRequestRef.current
        ) {
          setLoading(false);
        }
      }
    }

    loadData();

    return () => controller.abort();
  }, [
    selectedDate,
    session?.user?.id,
    signedInUsername,
    isTrackedAccountUser,
    browserClientToken,
    isTestingMode,
    withModeParam,
  ]);

  useEffect(() => {
    if (typeof window === "undefined" || !selectedDate) return;
    const nextPath = buildNavigationUrl(selectedDate, todayIso, isTestingMode);
    const currentPath = `${window.location.pathname}${window.location.search}`;
    if (currentPath === nextPath) return;
    window.history.replaceState({}, "", nextPath);
  }, [isTestingMode, selectedDate, todayIso]);

  useEffect(() => {
    const handlePopState = () => {
      const urlDate = getDateFromLocation(window.location);
      const nextDate =
        urlDate && (isTestingMode || isPlayablePuzzleDate(urlDate, todayIso))
          ? urlDate
          : todayIso;
      if (nextDate !== selectedDate) {
        setSelectedDate(nextDate);
      }
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [isTestingMode, selectedDate, todayIso]);

  useEffect(() => {
    if (!selectedDate && puzzleData?.puzzle?.puzzle_date) {
      setSelectedDate(String(puzzleData.puzzle.puzzle_date).slice(0, 10));
    }
  }, [puzzleData, selectedDate]);

  useEffect(() => {
    const selectedIds = Array.from(
      new Set(nodes.map((node) => node.player_id).filter(Boolean))
    );

    if (selectedIds.length < 2) {
      setPairRelationships([]);
      return;
    }

    const params = new URLSearchParams();
    selectedIds.forEach((playerId) => params.append("playerId", playerId));
    if (selectedDate) {
      params.set("date", selectedDate);
    }
    const controller = new AbortController();
    const requestId = ++relationshipRequestRef.current;

    async function loadRelationships() {
      try {
        const response = await fetch(withModeParam(`/api/relationships?${params.toString()}`), {
          cache: "no-store",
          signal: controller.signal,
        });

        if (!response.ok) throw new Error("Failed to load relationships");

        const json: { pair_relationships: PairRelationship[] } =
          await response.json();
        if (
          controller.signal.aborted ||
          requestId !== relationshipRequestRef.current
        ) {
          return;
        }
        setPairRelationships(json.pair_relationships ?? []);
      } catch (error) {
        if (
          (error as Error).name === "AbortError" ||
          requestId !== relationshipRequestRef.current
        ) {
          return;
        }
        console.error(error);
        setPairRelationships([]);
      }
    }

    loadRelationships();

    return () => controller.abort();
  }, [nodes, selectedDate, withModeParam]);

  const players = playersData?.players ?? [];

  const playerMap = useMemo(() => {
    return new Map(players.map((player) => [String(player.player_id), player]));
  }, [players]);

  const pairMap = useMemo(() => {
    const map = new Map<string, PairRelationship>();

    pairRelationships.forEach((pair) => {
      const a = String(pair.player_id_1);
      const b = String(pair.player_id_2);
      const key = [a, b].sort().join("|");
      map.set(key, pair);
    });

    return map;
  }, [pairRelationships]);

  const relationshipType =
    puzzleData?.relationship_rule?.relationship_type ?? "teammates";
  const relationshipLabel =
    puzzleData?.relationship_rule?.display_text ?? "Teammates";
  const relationshipTeamAbbr = getRelationshipTeamAbbr(relationshipType);
  const relationshipTeamLogoUrl = relationshipTeamAbbr
    ? `https://a.espncdn.com/i/teamlogos/nfl/500/${getTeamLogoCode(
        relationshipTeamAbbr
      )}.png`
    : null;
  const relationshipTooltipText = getRelationshipTooltip(
    relationshipType,
    relationshipLabel
  );
  const bonusPct = puzzleData?.relationship_rule?.bonus_pct ?? 10;
  const formattedPuzzleDate = puzzleData?.puzzle?.puzzle_date
    ? new Date(puzzleData.puzzle.puzzle_date).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "Daily Puzzle";
  const activePuzzleDate = String(
    puzzleData?.puzzle?.puzzle_date ?? selectedDate
  ).slice(0, 10);
  function formatPuzzleDateLabel(dateValue: string) {
    const [year, month, day] = dateValue.split("-").map(Number);
    if (!year || !month || !day) return dateValue;

    return new Date(year, month - 1, day).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }
  const leaderboardHeading =
    leaderboardView === "all-time"
      ? leaderboardScope === "friends"
        ? "Friends All-Time Standings"
        : "All-Time Standings"
      : leaderboardView === "yesterday" && homeRecap?.puzzle_date
        ? leaderboardScope === "friends"
          ? `${formatPuzzleDateLabel(homeRecap.puzzle_date)} Friends`
          : `${formatPuzzleDateLabel(homeRecap.puzzle_date)} Leaderboard`
      : leaderboardScope === "friends"
          ? `${formatPuzzleDateLabel(todayIso)} Friends`
          : `${formatPuzzleDateLabel(todayIso)} Leaderboard`;
  const showFriendsLeaderboardScope = Boolean(signedInUsername);
  const currentLeaderboardEmptyMessage =
    leaderboardScope === "friends"
      ? leaderboardView === "today"
        ? "No friend scores yet for today's puzzle. Add exact usernames in your profile to build your friends board."
        : leaderboardView === "yesterday"
          ? "None of your friends finished in yesterday's top 10."
          : "No all-time friend finishes yet."
      : leaderboardView === "today"
        ? "No leaderboard entries yet for this puzzle."
        : leaderboardView === "yesterday"
          ? "No finalized top 10 is available yet."
          : "No all-time leaderboard data yet.";
  const leaderboardFinalized = Boolean(puzzleData?.leaderboard_finalized);
  const comparisonRefreshLabel = formatRefreshLabel(comparisonLastUpdatedAt);
  const leaderboardRefreshLabel =
    leaderboardView === "all-time"
      ? formatRefreshLabel(allTimeLeaderboardLastUpdatedAt)
      : leaderboardView === "yesterday"
        ? formatRefreshLabel(homeRecapLastUpdatedAt)
        : formatRefreshLabel(leaderboardLastUpdatedAt);
  const availableDates = puzzleData?.available_dates ?? [];
  const sortedAvailableDates = [...availableDates].sort();
  const minPuzzleDate = sortedAvailableDates[0] ?? "2026-03-15";
  const maxPuzzleDate = todayIso;
  const dateOptions = availableDates
    .filter(
      (dateValue) =>
        (isTestingMode || isPlayablePuzzleDate(dateValue, maxPuzzleDate)) &&
        dateValue >= minPuzzleDate
    )
    .sort();
  const renderedDateOptions =
    selectedDate &&
    (isTestingMode || isPlayablePuzzleDate(selectedDate, maxPuzzleDate)) &&
    !dateOptions.includes(selectedDate)
      ? [selectedDate, ...dateOptions]
      : dateOptions;
  const slotRules = useMemo(() => {
    const defaultRules: SlotRule[] = [1, 2, 3, 4, 5].map((slotNumber) => ({
      slot_number: slotNumber,
      slot_rule_id: `default-${slotNumber}`,
      rule_name: slotNumber === 5 ? "flex_player" : "any_player",
      parameter_type: slotNumber === 5 ? "position" : "any",
      parameter_value: slotNumber === 5 ? "FLEX" : "ANY",
      display_text: slotNumber === 5 ? "Flex" : "Any",
    }));
    const incomingRules = puzzleData?.slot_rules ?? [];

    if (incomingRules.length === 0) {
      return defaultRules;
    }

    return defaultRules.map((defaultRule) => {
      return (
        incomingRules.find(
          (rule) => Number(rule.slot_number) === Number(defaultRule.slot_number)
        ) ?? defaultRule
      );
    });
  }, [puzzleData]);
  const slotRuleMap = useMemo(() => {
    return new Map(slotRules.map((rule) => [Number(rule.slot_number), rule]));
  }, [slotRules]);
  const positionOverlayEnabled = Boolean(puzzleData?.puzzle.position_overlay_enabled);
  const qbExclusionEnabled = Boolean(puzzleData?.puzzle.qb_exclusion_enabled);
  function getPairKey(playerId1: string, playerId2: string) {
    return [String(playerId1), String(playerId2)].sort().join("|");
  }

  function playerMatchesPuzzleLineupRules(player: PlayerOption) {
    return playerAllowedByPuzzleRules(player.primary_position, {
      positionLockEnabled: positionOverlayEnabled,
      qbExclusionEnabled,
    });
  }

  function getPlayerLabel(player: PlayerOption) {
    return `${player.player_name} • ${player.primary_position ?? "N/A"}`;
  }

  function getSlotRule(nodeId: number) {
    return (
      slotRuleMap.get(nodeId) ?? {
        slot_number: nodeId,
        slot_rule_id: `fallback-${nodeId}`,
        rule_name: "any_player",
        parameter_type: "any",
        parameter_value: "ANY",
        display_text: "Any",
      }
    );
  }

  function getSlotPlaceholder(rule: SlotRule) {
    if (qbExclusionEnabled) {
      return `Choose a non-QB ${rule.display_text} player...`;
    }
    if (positionOverlayEnabled && rule.parameter_type !== "position") {
      return `Choose a ${rule.display_text} player for the one-of-each lineup...`;
    }
    switch (rule.parameter_type) {
      case "position":
        return `Choose a ${rule.display_text}...`;
      case "team":
      case "conference":
      case "division":
      case "college":
        return `Choose a ${rule.display_text} player...`;
      default:
        return "Choose a player...";
    }
  }

  function playerMatchesSlotRule(player: PlayerOption, rule: SlotRule) {
    const ruleValue = String(rule.parameter_value ?? "").toUpperCase();

    switch (rule.parameter_type) {
      case "position":
        return (
          !ruleValue ||
          ruleValue === "ANY" ||
          (ruleValue === "FLEX" &&
            ["RB", "WR", "TE"].includes(
              String(player.primary_position ?? "").toUpperCase()
            )) ||
          String(player.primary_position ?? "").toUpperCase() === ruleValue
        );
      case "team":
        return (player.theme_team_abbrs ?? []).some(
          (teamAbbr) => teamAbbrMatches(String(teamAbbr), ruleValue)
        );
      case "conference":
        return (player.theme_conferences ?? []).some(
          (conference) => String(conference).toUpperCase() === ruleValue
        );
      case "division":
        return (player.theme_divisions ?? []).some(
          (division) => String(division).toUpperCase() === ruleValue
        );
      case "college":
        return (player.player_colleges ?? []).some(
          (college) => String(college).toUpperCase() === ruleValue
        );
      case "any":
      default:
        return true;
    }
  }

  function getTeamLogoCode(teamAbbr: string) {
    const normalized = teamAbbr.toLowerCase();
    const aliasMap: Record<string, string> = {
      ari: "ari",
      atl: "atl",
      bal: "bal",
      buf: "buf",
      car: "car",
      chi: "chi",
      cin: "cin",
      cle: "cle",
      dal: "dal",
      den: "den",
      det: "det",
      gb: "gb",
      hou: "hou",
      ind: "ind",
      jax: "jax",
      jac: "jax",
      kc: "kc",
      lv: "lv",
      oak: "lv",
      lac: "lac",
      sd: "lac",
      lar: "lar",
      la: "lar",
      stl: "lar",
      mia: "mia",
      min: "min",
      ne: "ne",
      no: "no",
      nyg: "nyg",
      nyj: "nyj",
      phi: "phi",
      pit: "pit",
      sea: "sea",
      sf: "sf",
      tb: "tb",
      ten: "ten",
      houoilers: "ten",
      wsh: "wsh",
      was: "wsh",
    };

    return aliasMap[normalized] ?? normalized;
  }

  function getCollegeLogoSlug(collegeName: string) {
    const normalized = collegeName.trim().toLowerCase();
    const aliasMap: Record<string, string> = {
      alabama: "alabama",
      "ohio state": "ohio-st",
      "ohio st.": "ohio-st",
      oklahoma: "oklahoma",
      lsu: "lsu",
      "louisiana state": "lsu",
      "southern california": "usc",
      usc: "usc",
      clemson: "clemson",
      georgia: "georgia",
      florida: "florida",
      fsu: "florida-state",
      "florida state": "florida-state",
      auburn: "auburn",
      "ole miss": "mississippi",
      miami: "miami-fl",
      "miami (fl)": "miami-fl",
      "miami fl": "miami-fl",
      "miami (fla.)": "miami-fl",
      "miami (oh)": "miami-oh",
      "miami oh": "miami-oh",
      michigan: "michigan",
      "michigan state": "michigan-state",
      penn: "penn",
      "penn state": "penn-state",
      texas: "texas",
      "texas a&m": "texas-am",
      tcu: "tcu",
      oregon: "oregon",
      "oregon state": "oregon-state",
      washington: "washington",
      "washington state": "washington-state",
      notre: "notre-dame",
      "notre dame": "notre-dame",
      wisconsin: "wisconsin",
      iowa: "iowa",
      "iowa state": "iowa-state",
      tennessee: "tennessee",
      arkansas: "arkansas",
      kentucky: "kentucky",
      mississippi: "mississippi",
      "mississippi state": "mississippi-state",
      ucla: "ucla",
      stanford: "stanford",
      california: "california",
      cal: "california",
      syracuse: "syracuse",
      pitt: "pittsburgh",
      pittsburgh: "pittsburgh",
      "north carolina": "north-carolina",
      unc: "north-carolina",
      "nc state": "nc-state",
      "north carolina state": "nc-state",
      "south carolina": "south-carolina",
      duke: "duke",
      vanderbilt: "vanderbilt",
      byu: "byu",
      "utah state": "utah-state",
      utah: "utah",
      boise: "boise-state",
      "boise state": "boise-state",
      nebraska: "nebraska",
      minnesota: "minnesota",
      purdue: "purdue",
      illinois: "illinois",
      indiana: "indiana",
      maryland: "maryland",
      rutgers: "rutgers",
      "south florida": "south-florida",
      ucf: "ucf",
      cincinnati: "cincinnati",
      houston: "houston",
      smu: "smu",
      memphis: "memphis",
      tulane: "tulane",
      baylor: "baylor",
      texastech: "texas-tech",
      "texas tech": "texas-tech",
      "oklahoma state": "oklahoma-state",
      kansas: "kansas",
      "kansas state": "kansas-state",
      colorado: "colorado",
      missouri: "missouri",
      louisville: "louisville",
      virginia: "virginia",
      "virginia tech": "virginia-tech",
      "west virginia": "west-virginia",
    };

    if (aliasMap[normalized]) {
      return aliasMap[normalized];
    }

    return normalized
      .replace(/&/g, "and")
      .replace(/[.'"]/g, "")
      .replace(/[()]/g, "")
      .replace(/\//g, " ")
      .replace(/\s+/g, "-");
  }

  function getCollegeLogoUrl(collegeName: string) {
    const normalized = collegeName.trim().toLowerCase();
    const explicitLogoMap: Record<string, string> = {
      usc: "https://commons.wikimedia.org/wiki/Special:FilePath/USC%20Trojans%20logo.svg",
      "southern california":
        "https://commons.wikimedia.org/wiki/Special:FilePath/USC%20Trojans%20logo.svg",
      "penn state":
        "https://commons.wikimedia.org/wiki/Special:FilePath/Penn%20State%20Athletics%20wordmark.svg",
      "penn state university":
        "https://commons.wikimedia.org/wiki/Special:FilePath/Penn%20State%20Athletics%20wordmark.svg",
    };

    if (explicitLogoMap[normalized]) {
      return explicitLogoMap[normalized];
    }

    const logoSlug = getCollegeLogoSlug(collegeName);
    return `https://ncaa-api.henrygd.me/logo/${logoSlug}.svg`;
  }

  function getPositionBadge(ruleValue: string) {
    const normalized = ruleValue.toUpperCase();
    const badgeMap: Record<string, string> = {
      QB: "/qb-badge.svg",
      RB: "/rb-badge.svg",
      WR: "/wr-badge.svg",
      TE: "/te-badge.svg",
      FLEX: "/flex-badge.svg",
    };

    return badgeMap[normalized] ?? "";
  }

  function getRelationshipTeamAbbr(relationshipType: string) {
    const teamLinkMap: Record<string, string> = {
      played_for_packers: "GB",
    };

    return teamLinkMap[relationshipType] ?? null;
  }

  function parseDivisionLabel(label: string) {
    const parts = label.trim().split(/\s+/);
    if (parts.length < 2) {
      return {
        conference: label.toUpperCase(),
        direction: "",
      };
    }

    return {
      conference: parts[0].toUpperCase(),
      direction: parts.slice(1).join(" ").toUpperCase(),
    };
  }

  function renderSlotRuleTitle(rule: SlotRule) {
    if (!rule.parameter_value) {
      return (
        <p className="font-[family-name:var(--font-display)] text-[15px] uppercase tracking-[0.08em] text-white sm:text-[10px] sm:tracking-[0.12em]">
          {rule.display_text}
        </p>
      );
    }

    if (rule.parameter_type === "conference") {
      const conference = String(rule.parameter_value).toUpperCase();
      const logoUrl = conference === "AFC" ? "/afc-badge.svg" : "/nfc-badge.svg";

      return (
        <div className="flex items-center justify-center gap-2">
          <img
            src={logoUrl}
            alt={rule.display_text}
            className="h-10 w-10 object-contain drop-shadow-[0_2px_4px_rgba(15,23,42,0.3)] sm:h-8 sm:w-8"
          />
          <p className="font-[family-name:var(--font-display)] text-[15px] uppercase tracking-[0.08em] text-white sm:text-[10px] sm:tracking-[0.12em]">
            {conference}
          </p>
        </div>
      );
    }

    if (rule.parameter_type === "position" && rule.parameter_value) {
      const badgeUrl = getPositionBadge(String(rule.parameter_value));
      const positionLabel = String(rule.display_text).toUpperCase();

      if (badgeUrl) {
        return (
          <div className="flex items-center justify-center gap-2">
            <img
              src={badgeUrl}
              alt={rule.display_text}
              className="h-10 w-10 object-contain drop-shadow-[0_2px_4px_rgba(15,23,42,0.3)] sm:h-8 sm:w-8"
            />
            <p className="font-[family-name:var(--font-display)] text-[15px] uppercase tracking-[0.08em] text-white sm:text-[10px] sm:tracking-[0.12em]">
              {positionLabel}
            </p>
          </div>
        );
      }

      return (
        <div className="flex items-center justify-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-white/70 bg-white/25 text-[13px] font-black uppercase text-white shadow-[0_2px_4px_rgba(15,23,42,0.3)] sm:h-8 sm:w-8 sm:text-[10px]">
            {positionLabel}
          </div>
          <p className="font-[family-name:var(--font-display)] text-[15px] uppercase tracking-[0.08em] text-white sm:text-[10px] sm:tracking-[0.12em]">
            {positionLabel}
          </p>
        </div>
      );
    }

    if (rule.parameter_type === "college") {
      const collegeLabel = String(rule.display_text);
      const logoUrl = getCollegeLogoUrl(collegeLabel);
      const initials = collegeLabel
        .split(/\s+/)
        .filter(Boolean)
        .map((part) => part[0])
        .slice(0, 3)
        .join("")
        .toUpperCase();

      return (
        <div className="flex items-center justify-center gap-2">
          <div className="relative flex h-10 w-10 items-center justify-center rounded-full border-2 border-white/70 bg-white/25 shadow-[0_2px_4px_rgba(15,23,42,0.3)] sm:h-8 sm:w-8">
            <img
              src={logoUrl}
              alt={collegeLabel}
              className="h-7 w-7 object-contain sm:h-6 sm:w-6"
              onError={(event) => {
                event.currentTarget.style.display = "none";
                const fallback = event.currentTarget.nextElementSibling as HTMLElement | null;
                if (fallback) fallback.style.display = "flex";
              }}
            />
            <div className="hidden h-full w-full items-center justify-center text-[13px] font-black uppercase text-white sm:text-[10px]">
              {initials}
            </div>
          </div>
          <p className="font-[family-name:var(--font-display)] text-[15px] uppercase tracking-[0.08em] text-white sm:text-[10px] sm:tracking-[0.12em]">
            {collegeLabel}
          </p>
        </div>
      );
    }

    if (rule.parameter_type === "division") {
      const divisionLabel = String(rule.display_text);
      const { conference, direction } = parseDivisionLabel(divisionLabel);

      return (
        <div className="flex items-center justify-center gap-2">
          <div className="inline-flex items-center rounded-full border-2 border-white/70 bg-white/28 px-2.5 py-1 shadow-[0_2px_4px_rgba(15,23,42,0.18)]">
            <p className="font-[family-name:var(--font-display)] text-[13px] uppercase tracking-[0.08em] text-white sm:text-[10px] sm:tracking-[0.12em]">
              {conference}
            </p>
          </div>
          <div className="inline-flex items-center rounded-full border-2 border-white/70 bg-white/20 px-2.5 py-1 shadow-[0_2px_4px_rgba(15,23,42,0.18)]">
            <p className="font-[family-name:var(--font-display)] text-[13px] uppercase tracking-[0.08em] text-white sm:text-[10px] sm:tracking-[0.12em]">
              {direction || divisionLabel.toUpperCase()}
            </p>
          </div>
        </div>
      );
    }

    if (rule.parameter_type !== "team") {
      return (
        <p className="font-[family-name:var(--font-display)] text-[15px] uppercase tracking-[0.08em] text-white sm:text-[10px] sm:tracking-[0.12em]">
          {rule.display_text}
        </p>
      );
    }

    const teamAbbr = String(rule.parameter_value).toUpperCase();
    const logoCode = getTeamLogoCode(teamAbbr);
    const logoUrl = `https://a.espncdn.com/i/teamlogos/nfl/500/${logoCode}.png`;

    return (
      <div className="flex items-center justify-center gap-2">
        <img
          src={logoUrl}
          alt={rule.display_text}
          className="h-10 w-10 object-contain drop-shadow-[0_2px_4px_rgba(15,23,42,0.3)] sm:h-8 sm:w-8"
          onError={(event) => {
            event.currentTarget.style.display = "none";
          }}
        />
        <p className="font-[family-name:var(--font-display)] text-[15px] uppercase tracking-[0.08em] text-white sm:text-[10px] sm:tracking-[0.12em]">
          {teamAbbr}
        </p>
      </div>
    );
  }

  function updateNode(nodeId: number, playerId: string) {
    if (submitted) return;

    setNodes((prev) =>
      prev.map((node) =>
        node.node_id === nodeId ? { ...node, player_id: playerId } : node
      )
    );
  }

  function registerNodeFocus(nodeId: number, focusFn: (() => void) | null) {
    if (focusFn) {
      nodeFocusMapRef.current.set(nodeId, focusFn);
      return;
    }

    nodeFocusMapRef.current.delete(nodeId);
  }

  function focusNode(nodeId: number, immediate = false) {
    setActiveNodeId(nodeId);

    if (!isMobileBoard || submitted) return;

    const runFocus = () => {
      nodeFocusMapRef.current.get(nodeId)?.();
    };

    if (immediate) {
      runFocus();
      return;
    }

    window.setTimeout(runFocus, 60);
  }

  function focusRelativeNode(direction: -1 | 1) {
    const nodeIds = slotRules.map((rule) => Number(rule.slot_number));
    const currentIndex = nodeIds.indexOf(activeNodeId);
    const fallbackIndex = currentIndex >= 0 ? currentIndex : 0;
    const nextIndex =
      (fallbackIndex + direction + nodeIds.length) % nodeIds.length;

      focusNode(nodeIds[nextIndex] ?? 1);
  }

  function handleMobileNodeAdvance(nodeId: number) {
    setActiveNodeId(nodeId);

    if (!isMobileBoard || submitted) return;

    const nodeIds = slotRules.map((rule) => Number(rule.slot_number));
    const currentIndex = nodeIds.indexOf(nodeId);
    const nextNodeId = nodeIds[currentIndex + 1];

    if (nextNodeId) {
      focusNode(nextNodeId);
    }
  }

  function relationshipPasses(
    ruleType: string,
    playerIdA: string,
    playerIdB: string
  ): boolean {
    const pair = pairMap.get(getPairKey(playerIdA, playerIdB));
    if (!pair) return false;

    switch (ruleType) {
      case "teammates":
        return pair.were_teammates_flag === true;
      case "same_franchise":
        return pair.same_franchise_flag === true;
      case "same_college":
        return pair.same_college_flag === true;
      case "same_draft_class":
        return pair.same_draft_class_flag === true;
      case "same_draft_round":
        return pair.same_draft_round_flag === true;
      case "both_undrafted":
        return pair.both_undrafted_flag === true;
      case "non_first_round_pick":
        return pair.both_non_first_round_pick_flag === true;
      case "day_3_pick":
        return pair.both_day_3_pick_flag === true;
      case "super_bowl_winner":
        return pair.both_super_bowl_winner_flag === true;
      case "non_super_bowl_winner":
        return pair.both_non_super_bowl_winner_flag === true;
      case "played_for_packers":
        return pair.both_played_packers_flag === true;
      case "same_position":
        return pair.same_position_flag === true;
      default:
        return false;
    }
  }

    const nodePositions = [
      {
        nodeId: 1,
        x: 700,
        y: 130,
        mobileOffsetX: 0,
        mobileOffsetY: 136,
      },
      {
        nodeId: 2,
        x: 300,
        y: 347,
        mobileOffsetX: 92,
        mobileOffsetY: 180,
      },
      {
        nodeId: 3,
        x: 335,
        y: 757,
        mobileOffsetX: 120,
        mobileOffsetY: 150,
      },
      {
        nodeId: 4,
        x: 1065,
        y: 757,
        mobileOffsetX: -120,
        mobileOffsetY: 150,
      },
      {
        nodeId: 5,
        x: 1100,
        y: 347,
        mobileOffsetX: -92,
        mobileOffsetY: 180,
      },
  ];

  const nodePairs = [
    [1, 2],
    [1, 3],
    [1, 4],
    [1, 5],
    [2, 3],
    [2, 4],
    [2, 5],
    [3, 4],
    [3, 5],
    [4, 5],
  ] as const;

  const center = {
    x: 700,
    y: 467,
    mobileOffsetX: 0,
    mobileOffsetY: 118,
  };

  function getNodeById(nodeId: number) {
    return nodes.find((node) => node.node_id === nodeId);
  }

  function getPositionById(nodeId: number) {
    const position = nodePositions.find((node) => node.nodeId === nodeId)!;
    if (!isMobileBoard) return position;

    return {
      ...position,
      x: position.x + position.mobileOffsetX,
      y: position.y + position.mobileOffsetY,
    };
  }

  const renderedNodePositions = useMemo(() => {
    return nodePositions.map((position) =>
      isMobileBoard
        ? {
            ...position,
            x: position.x + position.mobileOffsetX,
            y: position.y + position.mobileOffsetY,
          }
        : position
    );
  }, [isMobileBoard]);

  const renderedCenter = useMemo(() => {
    if (!isMobileBoard) return center;
    return {
      ...center,
      x: center.x + center.mobileOffsetX,
      y: center.y + center.mobileOffsetY,
    };
  }, [isMobileBoard]);

  function getLinkTone(nodeA: number, nodeB: number): LinkTone {
    const a = getNodeById(nodeA);
    const b = getNodeById(nodeB);

    if (!a?.player_id || !b?.player_id) {
      return "pending";
    }

    if (a.player_id === b.player_id) {
      return "failed";
    }

    return relationshipPasses(relationshipType, a.player_id, b.player_id)
      ? "active"
      : "failed";
  }

  function getLineColor(tone: LinkTone) {
    switch (tone) {
      case "active":
        return "#4ade80";
      case "failed":
        return "#7f8ca6";
      case "pending":
        return "#7f8ca6";
      default:
        return "#7f8ca6";
    }
  }

  function getLineDash(tone: LinkTone) {
    return tone === "active" ? "0" : "8 8";
  }

  const selectedPlayers = useMemo(() => {
    return nodes
      .map((node) => playerMap.get(node.player_id))
      .filter((player): player is PlayerOption => Boolean(player));
  }, [nodes, playerMap]);

  const selectedPlayersByFantasyPoints = useMemo(() => {
    return [...selectedPlayers].sort(
      (a, b) => Number(b.fantasy_points) - Number(a.fantasy_points)
    );
  }, [selectedPlayers]);

  const duplicatePlayersExist = useMemo(() => {
    const ids = nodes.map((n) => n.player_id).filter(Boolean);
    return new Set(ids).size !== ids.length;
  }, [nodes]);

  const allFilled = nodes.every((node) => Boolean(node.player_id));
  const activeLinkCount = nodePairs.filter(
    ([a, b]) => getLinkTone(a, b) === "active"
  ).length;
  const activeLinkDetails = useMemo(() => {
    const details: ActiveLinkDetail[] = [];
    const nodeById = new Map(nodes.map((node) => [node.node_id, node]));

    nodePairs.forEach(([a, b]) => {
      const nodeA = nodeById.get(a);
      const nodeB = nodeById.get(b);
      if (!nodeA?.player_id || !nodeB?.player_id) {
        return;
      }

      if (!relationshipPasses(relationshipType, nodeA.player_id, nodeB.player_id)) {
        return;
      }

      const playerA = playerMap.get(nodeA.player_id);
      const playerB = playerMap.get(nodeB.player_id);
      if (!playerA || !playerB) {
        return;
      }

      details.push({
        pairKey: getPairKey(playerA.player_id, playerB.player_id),
        playerA,
        playerB,
      });
    });

    return details;
  }, [nodes, pairMap, playerMap, relationshipType]);
  const selectedLineupEntriesBySlot = useMemo(() => {
    return [...nodes]
      .sort((a, b) => a.node_id - b.node_id)
      .map((node) => {
        const player = playerMap.get(node.player_id);
        if (!player) {
          return null;
        }

        return {
          nodeId: node.node_id,
          player,
          slotLabel: getSlotRule(node.node_id).display_text,
        };
      })
      .filter(
        (
          entry
        ): entry is {
          nodeId: number;
          player: PlayerOption;
          slotLabel: string;
        } => Boolean(entry)
      );
  }, [nodes, playerMap, slotRuleMap]);
  const activeSlotRule = getSlotRule(activeNodeId);
  const currentSubmissionRank = useMemo(() => {
    if (!submissionResult) return null;
    const index = leaderboard.findIndex(
      (entry) => entry.submission_id === submissionResult.submission_id
    );
    return index >= 0 ? index + 1 : null;
  }, [leaderboard, submissionResult]);
  const rankAccent: "sky" | "emerald" | "indigo" | "amber" =
    currentSubmissionRank === 1
      ? "emerald"
      : currentSubmissionRank != null && currentSubmissionRank <= 10
        ? "amber"
        : "sky";
  const inlineRuleHints = useMemo(() => {
    const hints = [
      {
        title: "Link Rule",
        body:
          relationshipType === "same_franchise"
            ? `${relationshipLabel} counts franchise history, even across relocations or different eras.`
            : relationshipType === "same_college"
              ? `${relationshipLabel} checks pre-NFL college history for every pair in your lineup.`
              : relationshipType === "same_draft_class"
                ? `${relationshipLabel} only counts players actually drafted in the same year. Undrafted players do not qualify.`
                : relationshipType === "non_super_bowl_winner"
                  ? `${relationshipLabel} only activates when neither player has a Super Bowl win on record.`
                  : `${relationshipLabel} is checked across all 10 player pairings in your lineup.`,
      },
    ];

    if (positionOverlayEnabled) {
      hints.push({
        title: "Lineup Constraint",
        body: "This puzzle enforces one of each fantasy position across the full lineup, so some valid slot fits may still conflict globally.",
      });
    } else if (qbExclusionEnabled) {
      hints.push({
        title: "Lineup Constraint",
        body: "Quarterbacks are excluded from the entire lineup for this puzzle, even if a slot rule would normally allow one.",
      });
    } else {
      hints.push({
        title: "Slot Matching",
        body: "Each slot is checked independently, so a player must satisfy that slot’s rule and the overall lineup rules at the same time.",
      });
    }

    hints.push({
      title: "Leaderboard State",
      body: leaderboardFinalized
        ? "This puzzle date is finalized, so rankings, badges, and the optimal lineup are now locked."
        : "This puzzle date is still live. Rankings can move, and the true optimal lineup stays hidden until finalization.",
    });

    return hints;
  }, [
    leaderboardFinalized,
    positionOverlayEnabled,
    qbExclusionEnabled,
    relationshipLabel,
    relationshipType,
  ]);

  const totalPossibleLinks = nodePairs.length;
  const linkProgressPct = activeLinkCount / totalPossibleLinks;
  const isFullyConnected = activeLinkCount === totalPossibleLinks;
  const confettiPieces = useMemo(
    () =>
      Array.from({ length: 20 }, (_, index) => ({
        id: index,
        left: 50 + Math.cos((index / 20) * Math.PI * 2) * (28 + (index % 4) * 7),
        top: 50 + Math.sin((index / 20) * Math.PI * 2) * (28 + (index % 3) * 9),
        x: Math.cos((index / 20) * Math.PI * 2) * (60 + (index % 5) * 14),
        y: -55 - (index % 4) * 18,
        rotate: (index % 2 === 0 ? 1 : -1) * (110 + index * 9),
        delay: index * 0.04,
        color: ["#22c55e", "#86efac", "#fde047", "#38bdf8"][index % 4],
      })),
    []
  );

  const centerRingSize = 320;
  const centerRingMid = centerRingSize / 2;
  const meterRadius = 136;
  const meterCircumference = 2 * Math.PI * meterRadius;
  const meterOffset = isFullyConnected
    ? 0
    : meterCircumference * (1 - linkProgressPct);

  const baseFantasyPoints = selectedPlayers.reduce(
    (sum, player) => sum + Number(player.fantasy_points),
    0
  );

  const linkBonusPct = getLinkBonusPct(activeLinkCount, bonusPct);
  const multiplier = getLinkMultiplier(activeLinkCount, bonusPct);
  const finalScore = baseFantasyPoints * multiplier;
  const displayedBaseFantasyPoints = Number(
    submissionResult?.base_score ?? baseFantasyPoints
  );
  const displayedActiveLinkCount = Number(
    submissionResult?.active_links ?? activeLinkCount
  );
  const displayedMultiplier = Number(submissionResult?.multiplier ?? multiplier);
  const displayedFinalScore = Number(submissionResult?.final_score ?? finalScore);
  const projectedPostSubmitStats = useMemo(() => {
    if (!isTrackedAccountUser || !submitted || submissionViewMode !== "new") {
      return userStats;
    }

    return {
      ...userStats,
      puzzles_submitted: userStats.puzzles_submitted + 1,
      links_created:
        userStats.links_created +
        Number(submissionResult?.active_links ?? activeLinkCount ?? 0),
    };
  }, [
    activeLinkCount,
    isTrackedAccountUser,
    submissionResult?.active_links,
    submissionViewMode,
    submitted,
    userStats,
  ]);
  const nextBadgeGoals = useMemo(
    () =>
      getNextBadgeGoals({
        stats: projectedPostSubmitStats,
        earnedBadgeKeys: new Set(userBadges.map((badge) => badge.badgeKey)),
        currentSubmissionLinks: Number(submissionResult?.active_links ?? activeLinkCount ?? 0),
      }),
    [activeLinkCount, projectedPostSubmitStats, submissionResult?.active_links, userBadges]
  );
  const liveEnergy = isFullyConnected ? 1 : linkProgressPct;
  const ringGlowStrength = 0.22 + liveEnergy * 0.5;
  const shellGlowStrength = 0.12 + liveEnergy * 0.34;
  const pulseDuration = Math.max(1.15, 2.4 - liveEnergy * 1.1);
  const formattedFinalScore = displayedFinalScore.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const optimalPercent = submissionResult?.percent_of_optimal != null
    ? Number(submissionResult.percent_of_optimal)
    : optimalLineup?.optimal_final_score
      ? (displayedFinalScore / Number(optimalLineup.optimal_final_score)) * 100
    : null;
  const isLockedForSelectedDate = isTestingMode
    ? false
    : isTrackedAccountUser
      ? accountHasSubmittedForSelectedDate
      : hasSubmittedForSelectedDate;
  const isBoardLocked = submitted || isLockedForSelectedDate;
  const canSubmit =
    allFilled &&
    !duplicatePlayersExist &&
    !submitted &&
    !isLockedForSelectedDate;

  useEffect(() => {
    if (!isFullyConnected) {
      setShowFullLinkConfetti(false);
      return;
    }

    setShowFullLinkConfetti(true);
    const timeout = window.setTimeout(() => {
      setShowFullLinkConfetti(false);
    }, 5000);

    return () => window.clearTimeout(timeout);
  }, [isFullyConnected]);

  useEffect(() => {
    if (!submitted) {
      setOptimalLineup(null);
      setOptimalError(null);
      setOptimalLoading(false);
      setCurrentLeaderLineup(null);
      setCurrentLeaderError(null);
      setCurrentLeaderLoading(false);
      setSubmissionResult(null);
      setSubmissionViewMode(null);
      setLeaderboard([]);
      setLeaderboardLoading(false);
      setLeaderboardError(null);
      return;
    }

    const controller = new AbortController();

    async function loadComparisonLineup() {
      try {
        const params = selectedDate
          ? `?date=${encodeURIComponent(selectedDate)}`
          : "";
        const leaderboardFinalized = Boolean(puzzleData?.leaderboard_finalized);

        if (leaderboardFinalized) {
          setCurrentLeaderLineup(null);
          setCurrentLeaderError(null);
          setCurrentLeaderLoading(false);
          setOptimalLoading(true);
          setOptimalError(null);
          const response = await fetch(withModeParam(`/api/optimal-lineup${params}`), {
            cache: "no-store",
            signal: controller.signal,
          });

          if (!response.ok) {
            const body = await response.text();
            throw new Error(body || "Failed to load optimal lineup");
          }

          const json: OptimalLineupResponse = await response.json();
          setOptimalLineup(json);
          return;
        }

        setOptimalLineup(null);
        setOptimalError(null);
        setOptimalLoading(false);
        setCurrentLeaderLoading(true);
        setCurrentLeaderError(null);
        const response = await fetch(
          withModeParam(`/api/current-leader-lineup${params}`),
          {
            cache: "no-store",
            signal: controller.signal,
          }
        );

        if (!response.ok) {
          const body = await response.text();
          throw new Error(body || "Failed to load current leader lineup");
        }

        const json: CurrentLeaderLineupResponse = await response.json();
        setCurrentLeaderLineup(json);
      } catch (error) {
        if ((error as Error).name === "AbortError") return;
        console.error(error);
        if (puzzleData?.leaderboard_finalized) {
          setOptimalLineup(null);
          setOptimalError((error as Error).message);
        } else {
          setCurrentLeaderLineup(null);
          setCurrentLeaderError((error as Error).message);
        }
      } finally {
        if (!controller.signal.aborted) {
          setOptimalLoading(false);
          setCurrentLeaderLoading(false);
          setComparisonLastUpdatedAt(new Date().toISOString());
        }
      }
    }

    void loadComparisonLineup();
    return () => controller.abort();
  }, [
    submitted,
    selectedDate,
    puzzleData?.leaderboard_finalized,
    submissionResult?.submission_id,
    withModeParam,
  ]);

  useEffect(() => {
    const controller = new AbortController();

    async function loadHomeRecap() {
      try {
        setHomeRecapLoading(true);
        const response = await fetch("/api/home/recap", {
          cache: "no-store",
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error("Failed to load home recap");
        }

        const json = (await response.json()) as HomeRecapResponse;
        if (!controller.signal.aborted) {
          setHomeRecap(json.recap ?? null);
          setHomeRecapLastUpdatedAt(new Date().toISOString());
        }
      } catch (error) {
        if ((error as Error).name !== "AbortError" && !controller.signal.aborted) {
          setHomeRecap(null);
        }
      } finally {
        if (!controller.signal.aborted) {
          setHomeRecapLoading(false);
        }
      }
    }

    void loadHomeRecap();
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!profileOpen || !signedInUsername) return;

    const controller = new AbortController();

    async function loadProfileData() {
      try {
        setSelfProfileLoading(true);
        setSelfProfileError(null);
        setFriendOverviewLoading(true);
        setFriendOverviewError(null);
        const [profileResponse, friendsResponse] = await Promise.all([
          fetch("/api/profile", {
            cache: "no-store",
            signal: controller.signal,
          }),
          fetch("/api/profile/friends", {
            cache: "no-store",
            signal: controller.signal,
          }),
        ]);

        if (!profileResponse.ok || !friendsResponse.ok) {
          const [profileBody, friendsBody] = await Promise.all([
            profileResponse.text(),
            friendsResponse.text(),
          ]);
          throw new Error(
            profileBody || friendsBody || "Failed to load profile."
          );
        }

        const [profileJson, friendsJson] = (await Promise.all([
          profileResponse.json(),
          friendsResponse.json(),
        ])) as [SelfProfileResponse, FriendOverviewResponse];
        if (!controller.signal.aborted) {
          setSelfProfile(profileJson.profile);
          setFriendOverview(friendsJson.overview);
        }
      } catch (error) {
        if ((error as Error).name === "AbortError") return;
        setSelfProfileError((error as Error).message);
        setFriendOverviewError((error as Error).message);
      } finally {
        if (!controller.signal.aborted) {
          setSelfProfileLoading(false);
          setFriendOverviewLoading(false);
        }
      }
    }

    void loadProfileData();
    return () => controller.abort();
  }, [profileOpen, signedInUsername]);

  useEffect(() => {
    if (!submitted) return;

    const controller = new AbortController();
    const submissionDate = selectedDate;
    const submissionRequestKey =
      submissionViewMode === "new"
        ? JSON.stringify({
            date: submissionDate,
            lineup: nodes.map((node) => ({
              slot_number: node.node_id,
              player_id: String(node.player_id),
            })),
          })
        : `existing:${submissionDate}`;

    async function loadLeaderboardForSubmission(savedSubmission?: SubmissionResponse | null) {
      const leaderboardResponse = await fetch(
        withModeParam(
          `/api/leaderboard?date=${encodeURIComponent(submissionDate)}&limit=10`
        ),
        {
          cache: "no-store",
          signal: controller.signal,
        }
      );

      if (!leaderboardResponse.ok) {
        const body = await leaderboardResponse.text();
        throw new Error(body || "Failed to load leaderboard");
      }

      const leaderboardJson: { leaderboard: LeaderboardEntry[] } =
        await leaderboardResponse.json();
      if (controller.signal.aborted) return;

      const fetchedLeaderboard = leaderboardJson.leaderboard ?? [];

      if (!savedSubmission) {
        setLeaderboard(fetchedLeaderboard);
        setLeaderboardLastUpdatedAt(new Date().toISOString());
        return;
      }

      const savedEntry: LeaderboardEntry = {
        user_id: session?.user?.id ?? null,
        submission_id: savedSubmission.submission_id,
        display_name: savedSubmission.display_name,
        base_score: Number(savedSubmission.base_score ?? 0),
        active_links: Number(savedSubmission.active_links ?? 0),
        multiplier: Number(savedSubmission.multiplier ?? 1),
        final_score: Number(savedSubmission.final_score),
        optimal_final_score:
          savedSubmission.optimal_final_score != null
            ? Number(savedSubmission.optimal_final_score)
            : null,
        percent_of_optimal:
          savedSubmission.percent_of_optimal != null
            ? Number(savedSubmission.percent_of_optimal)
            : null,
        submitted_at: savedSubmission.submitted_at ?? new Date().toISOString(),
        featured_badges: [],
      };

      const mergedLeaderboard = [
        savedEntry,
        ...fetchedLeaderboard.filter(
          (entry) => entry.submission_id !== savedSubmission.submission_id
        ),
      ]
        .sort(compareLeaderboardEntries)
        .slice(0, 10);

      setLeaderboard(mergedLeaderboard);
      setLeaderboardLastUpdatedAt(new Date().toISOString());
    }

    async function saveSubmissionAndLoadLeaderboard() {
      try {
        setLeaderboardLoading(true);
        setLeaderboardError(null);
        setSubmissionError(null);

        if (submissionViewMode === "existing") {
          await loadLeaderboardForSubmission();
          return;
        }

        if (submissionRequestKeyRef.current === submissionRequestKey) {
          return;
        }
        submissionRequestKeyRef.current = submissionRequestKey;

        if (!isTrackedAccountUser && !browserClientToken) {
          throw new Error("Unable to verify this browser for submission.");
        }

        const saveResponse = await fetch(withModeParam("/api/submissions"), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            date: selectedDate,
            client_token: isTrackedAccountUser ? undefined : browserClientToken,
            lineup: nodes.map((node) => ({
              slot_number: node.node_id,
              player_id: Number(node.player_id),
            })),
            optimal_final_score:
              optimalLineup?.optimal_final_score != null
                ? Number(optimalLineup.optimal_final_score)
                : undefined,
          }),
          signal: controller.signal,
        });

        if (!saveResponse.ok) {
          const body = await saveResponse.json().catch(() => null);
          const message =
            body && typeof body.error === "string"
              ? body.error
              : "Failed to save submission";

          if (!isTestingMode && saveResponse.status === 409) {
            if (isTrackedAccountUser) {
              setAccountHasSubmittedForSelectedDate(true);
            } else {
              markBrowserSubmittedForDate(selectedDate);
              setHasSubmittedForSelectedDate(true);
            }
          }

          throw new Error(message);
        }

        const saved: SubmissionResponse = await saveResponse.json();
        if (controller.signal.aborted) return;
        setSubmissionResult(saved);
        if (!isTestingMode) {
          if (isTrackedAccountUser) {
            setAccountHasSubmittedForSelectedDate(true);
          } else {
            markBrowserSubmittedForDate(selectedDate);
            setHasSubmittedForSelectedDate(true);
          }
        }
        if (session?.user?.id) {
          await updateSession();
          if (controller.signal.aborted) return;
        }

        await loadLeaderboardForSubmission(saved);
      } catch (error) {
        if ((error as Error).name === "AbortError") return;
        console.error(error);
        submissionRequestKeyRef.current = null;
        setSubmitted(false);
        setSubmissionError((error as Error).message);
      } finally {
        if (!controller.signal.aborted) {
          setLeaderboardLoading(false);
        }
      }
    }

    saveSubmissionAndLoadLeaderboard();
    return () => controller.abort();
  }, [
    submitted,
    selectedDate,
    nodes,
    browserClientToken,
    isTrackedAccountUser,
    isTestingMode,
    submissionViewMode,
    session?.user?.id,
    updateSession,
    optimalLineup?.optimal_final_score,
    withModeParam,
  ]);

  useEffect(() => {
    if (!leaderboardOpen || leaderboardView !== "all-time") return;
    if (leaderboardScope === "friends" && !signedInUsername) return;

    const controller = new AbortController();

    async function loadAllTimeLeaderboard() {
      try {
        setAllTimeLeaderboardLoading(true);
        setAllTimeLeaderboardError(null);

        const leaderboardResponse = await fetch(
          withModeParam(
            leaderboardScope === "friends"
              ? `/api/leaderboard?scope=friends&view=all-time&limit=25`
              : `/api/leaderboard?scope=all-time&limit=25`
          ),
          {
            cache: "no-store",
            signal: controller.signal,
          }
        );

        if (!leaderboardResponse.ok) {
          const body = await leaderboardResponse.text();
          throw new Error(body || "Failed to load all-time leaderboard");
        }

        const leaderboardJson: { leaderboard: AllTimeLeaderboardEntry[] } =
          await leaderboardResponse.json();
        if (controller.signal.aborted) return;
        setAllTimeLeaderboard(leaderboardJson.leaderboard ?? []);
        setAllTimeLeaderboardLastUpdatedAt(new Date().toISOString());
      } catch (error) {
        if ((error as Error).name === "AbortError") return;
        console.error(error);
        setAllTimeLeaderboardError((error as Error).message);
      } finally {
        if (!controller.signal.aborted) {
          setAllTimeLeaderboardLoading(false);
        }
      }
    }

    void loadAllTimeLeaderboard();
    return () => controller.abort();
  }, [
    isTestingMode,
    leaderboardOpen,
    leaderboardScope,
    leaderboardView,
    signedInUsername,
    withModeParam,
  ]);

  useEffect(() => {
    if (!leaderboardOpen || leaderboardView !== "today") return;
    if (leaderboardScope === "friends" && !signedInUsername) return;

    const controller = new AbortController();

    async function loadLeaderboardForScope() {
      try {
        setLeaderboardLoading(true);
        setLeaderboardError(null);

        const response = await fetch(
          withModeParam(
            `/api/leaderboard?${
              leaderboardScope === "friends" ? "scope=friends&" : ""
            }date=${encodeURIComponent(todayIso)}&limit=25`
          ),
          {
            cache: "no-store",
            signal: controller.signal,
          }
        );

        if (!response.ok) {
          const body = await response.text();
          throw new Error(body || "Failed to load friends leaderboard");
        }

        const json: { leaderboard: LeaderboardEntry[] } = await response.json();
        if (!controller.signal.aborted) {
          setLeaderboard(json.leaderboard ?? []);
          setLeaderboardLastUpdatedAt(new Date().toISOString());
        }
      } catch (error) {
        if ((error as Error).name === "AbortError") return;
        console.error(error);
        setLeaderboardError((error as Error).message);
      } finally {
        if (!controller.signal.aborted) {
          setLeaderboardLoading(false);
        }
      }
    }

    void loadLeaderboardForScope();
    return () => controller.abort();
  }, [
    isTestingMode,
    leaderboardOpen,
    leaderboardScope,
    leaderboardView,
    signedInUsername,
    todayIso,
    withModeParam,
  ]);

  useEffect(() => {
    if (!signedInUsername && leaderboardScope === "friends") {
      setLeaderboardScope("all");
    }
  }, [leaderboardScope, signedInUsername]);

  function handleSubmit() {
    if (!canSubmit) return;
    setSubmissionError(null);
    submissionRequestKeyRef.current = null;
    setSubmissionViewMode("new");
    setSubmitted(true);
  }

  async function handleShowSubmission() {
    try {
      setSavedSubmissionLoading(true);
      setSubmissionError(null);

      const params = new URLSearchParams();
      params.set("date", selectedDate);
      if (!isTrackedAccountUser && browserClientToken) {
        params.set("client_token", browserClientToken);
      }

      const response = await fetch(withModeParam(`/api/submissions?${params.toString()}`), {
        cache: "no-store",
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(
          body && typeof body.error === "string"
            ? body.error
            : "Unable to load your saved submission."
        );
      }

      const saved: SubmissionResponse = await response.json();
      const savedNodes =
        saved.lineup?.map((entry) => ({
          node_id: Number(entry.slot_number),
          player_id: String(entry.player_id),
        })) ?? [];

      if (savedNodes.length !== 5) {
        throw new Error("Saved submission is incomplete.");
      }

      setNodes(savedNodes);
      setSubmissionResult(saved);
      setSubmissionViewMode("existing");
      setSubmitted(true);
    } catch (error) {
      setSubmissionError((error as Error).message);
    } finally {
      setSavedSubmissionLoading(false);
    }
  }

  async function handleSaveUsername() {
    const trimmed = usernameDraft.trim();
    if (!trimmed) {
      setUsernameError("Choose a username to finish your profile.");
      return;
    }

    try {
      setUsernameSaving(true);
      setUsernameError(null);

      const response = await fetch("/api/profile/username", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: trimmed,
        }),
      });

      if (!response.ok) {
        throw new Error("That username is not available.");
      }

      setUsernameDraft("");
      setSubmissionError(null);
      await updateSession();
    } catch (error) {
      setUsernameError((error as Error).message);
    } finally {
      setUsernameSaving(false);
    }
  }

  async function handleSaveProfile() {
    try {
      setAvatarSaving(true);
      setBadgeSaving(true);
      setAvatarError(null);
      setBadgeError(null);

      const [avatarResponse, featuredBadgesResponse] = await Promise.all([
        fetch("/api/profile/avatar", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            avatar_style: avatarStyleDraft,
            avatar_bg: avatarBgDraft,
            avatar_accent: avatarAccentDraft,
            avatar_border: avatarBorderDraft,
          }),
        }),
        fetch("/api/profile/featured-badges", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            featured_badges: featuredBadgeDraft,
          }),
        }),
      ]);

      if (!avatarResponse.ok || !featuredBadgesResponse.ok) {
        throw new Error("Unable to save profile.");
      }

      await updateSession();
      setProfileOpen(false);
    } catch (error) {
      setAvatarError((error as Error).message);
    } finally {
      setAvatarSaving(false);
      setBadgeSaving(false);
    }
  }

  async function openPublicProfile(userId: string | null) {
    if (!userId) {
      return;
    }

    try {
      setPublicProfileOpen(true);
      setPublicProfileLoading(true);
      setPublicProfileError(null);
      setPublicProfile(null);
      setActivePublicFeaturedBadgeKey(null);

      const response = await fetch(
        `/api/profile/public?userId=${encodeURIComponent(userId)}`,
        { cache: "no-store" }
      );

      if (!response.ok) {
        const body = await response.text();
        throw new Error(body || "Unable to load profile.");
      }

      const json = (await response.json()) as PublicProfileResponse;
      setPublicProfile(json.profile);
    } catch (error) {
      setPublicProfileError((error as Error).message);
    } finally {
      setPublicProfileLoading(false);
    }
  }

  async function refreshFriendOverview() {
    const response = await fetch("/api/profile/friends", {
      cache: "no-store",
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(body || "Unable to load friends.");
    }

    const json = (await response.json()) as FriendOverviewResponse;
    setFriendOverview(json.overview);
  }

  async function handleFriendSearch() {
    const trimmed = friendSearchDraft.trim();
    if (!trimmed) {
      setFriendSearchResult(null);
      setFriendSearchMessage("Enter an exact username.");
      return;
    }

    try {
      setFriendSearchLoading(true);
      setFriendSearchMessage(null);
      setFriendActionError(null);

      const response = await fetch(
        `/api/profile/friends?username=${encodeURIComponent(trimmed)}`,
        { cache: "no-store" }
      );

      if (!response.ok) {
        const body = await response.text();
        throw new Error(body || "Unable to search usernames.");
      }

      const json = (await response.json()) as FriendSearchResponse;
      setFriendSearchResult(json.match);
      if (!json.match) {
        setFriendSearchMessage("No exact username match found.");
      }
    } catch (error) {
      setFriendSearchResult(null);
      setFriendSearchMessage((error as Error).message);
    } finally {
      setFriendSearchLoading(false);
    }
  }

  async function handleFriendAction(
    action: "send" | "accept" | "decline" | "cancel" | "remove",
    targetUserId: string
  ) {
    try {
      setFriendActionLoadingId(`${action}:${targetUserId}`);
      setFriendActionError(null);

      const response = await fetch("/api/profile/friends", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action,
          target_user_id: targetUserId,
        }),
      });

      if (!response.ok) {
        const body = await response.text();
        throw new Error(body || "Unable to update friends.");
      }

      await refreshFriendOverview();

      if (friendSearchResult?.user_id === targetUserId) {
        await handleFriendSearch();
      }

      if (leaderboardScope === "friends") {
        setLeaderboard([]);
        setAllTimeLeaderboard([]);
      }
    } catch (error) {
      setFriendActionError((error as Error).message);
    } finally {
      setFriendActionLoadingId(null);
    }
  }

  function handleToggleFeaturedBadge(badgeKey: BadgeKey) {
    setBadgeError(null);
    setFeaturedBadgeDraft((current) => {
      if (current.includes(badgeKey)) {
        return current.filter((entry) => entry !== badgeKey);
      }

      if (current.length >= 3) {
        setBadgeError("You can feature up to 3 badges.");
        return current;
      }

      if (!earnedBadgeMap.has(badgeKey)) {
        return current;
      }

      return [...current, badgeKey];
    });
  }

  function handleCloseSubmittedView() {
    setSubmitted(false);
    setSubmissionError(null);
    submissionRequestKeyRef.current = null;
    setMobileNavigatorOpen(true);
  }

  function renderHeadshot(
    player?: PlayerOption,
    sizeClass = "h-10 w-10 rounded-[14px] sm:h-20 sm:w-20 sm:rounded-[22px]"
  ) {
    if (player?.headshot_url) {
      return (
        <img
          src={player.headshot_url}
          alt={player.player_name}
          className={`${sizeClass} object-cover ring-2 ring-white/70`}
        />
      );
    }

    const initials = player?.player_name
      ? player.player_name
          .split(" ")
          .map((part) => part[0])
          .slice(0, 2)
          .join("")
          .toUpperCase()
      : "—";

    return (
      <div
        className={`flex ${sizeClass} items-center justify-center bg-[linear-gradient(135deg,#dbeafe_0%,#bfdbfe_45%,#93c5fd_100%)] text-sm font-bold text-slate-800 ring-2 ring-white/70 sm:text-lg`}
      >
        {initials}
      </div>
    );
  }

  function renderLineupEntry(
    player: PlayerOption,
    accentClasses: {
      border: string;
      label: string;
      value: string;
    },
    slotLabel?: string
  ) {
    return (
      <div
        key={`${slotLabel ?? "player"}-${player.player_id}`}
        className={`grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-[22px] border-[3px] bg-white/92 px-3 py-3 shadow-[0_10px_22px_rgba(15,23,42,0.05)] sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:gap-4 sm:px-4 ${accentClasses.border}`}
      >
        <div className="hidden sm:flex sm:w-[82px] sm:flex-col sm:items-start sm:justify-center">
          {slotLabel ? (
            <span className={`inline-flex rounded-full border border-current/10 bg-white px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.12em] ${accentClasses.label}`}>
              {slotLabel}
            </span>
          ) : null}
          <span className={`mt-2 text-[10px] font-bold uppercase tracking-[0.08em] ${accentClasses.label}`}>
            {player.primary_position ?? "N/A"}
          </span>
        </div>
        <div className="flex min-w-0 items-center gap-3">
          <div className="shrink-0 rounded-[16px] bg-[radial-gradient(circle_at_top,#ffffff_0%,#eff6ff_100%)] p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
            {renderHeadshot(player)}
          </div>
          <div className="min-w-0">
            {slotLabel ? (
              <p className={`text-[10px] font-black uppercase tracking-[0.08em] sm:hidden ${accentClasses.label}`}>
                {slotLabel}
              </p>
            ) : null}
            <p className="truncate text-sm font-bold text-slate-900 sm:text-[15px]">
              {player.player_name}
            </p>
            <p className={`mt-1 text-[10px] font-semibold uppercase tracking-[0.06em] ${accentClasses.label}`}>
              {player.primary_position ?? "N/A"} •{" "}
              {player.theme_start_season ?? player.career_start_season ?? "N/A"}–
              {player.theme_end_season ?? player.career_end_season ?? "N/A"}
            </p>
            <div className="hidden">
              <p className="text-[10px] font-black uppercase tracking-[0.08em] text-slate-500">
                Fantasy Pts
              </p>
              <p className={`text-sm font-black ${accentClasses.value}`}>
                {Number(player.fantasy_points).toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </p>
            </div>
          </div>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-[9px] font-black uppercase tracking-[0.1em] text-slate-500 sm:text-[10px]">
            Fantasy Pts
          </p>
          <p className={`mt-1 text-base font-black sm:text-[28px] sm:leading-none ${accentClasses.value}`}>
            {Number(player.fantasy_points).toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </p>
        </div>
      </div>
    );
  }

  function renderSubmissionMiniStat(
    label: string,
    value: string,
    accent: "sky" | "emerald" | "indigo" | "amber" = "sky"
  ) {
    const classes =
      accent === "emerald"
        ? "border-emerald-200 bg-emerald-50/90 text-emerald-900 shadow-[0_10px_20px_rgba(16,185,129,0.1)]"
        : accent === "amber"
          ? "border-amber-200 bg-amber-50/90 text-amber-900 shadow-[0_10px_20px_rgba(245,158,11,0.1)]"
        : accent === "indigo"
          ? "border-indigo-200 bg-indigo-50/90 text-indigo-900 shadow-[0_10px_20px_rgba(99,102,241,0.1)]"
          : "border-sky-100 bg-white/90 text-slate-900 shadow-[0_10px_20px_rgba(125,211,252,0.08)]";

    return (
      <div className={`rounded-[18px] border-[3px] px-4 py-3 ${classes}`}>
        <p className="text-[10px] font-black uppercase tracking-[0.08em] text-slate-500">
          {label}
        </p>
        <p className="mt-1 text-lg font-black">{value}</p>
      </div>
    );
  }

  function renderNode(nodeId: number) {
    const node = getNodeById(nodeId);
    const player = node ? playerMap.get(node.player_id) : undefined;
    const slotRule = getSlotRule(nodeId);
    const isActiveNode = !submitted && activeNodeId === nodeId;
    const availablePlayers = players.filter((candidate) => {
      if (String(candidate.player_id) === String(node?.player_id ?? "")) {
        return true;
      }

      return (
        playerMatchesSlotRule(candidate, slotRule) &&
        playerMatchesPuzzleLineupRules(candidate) &&
        !nodes.some(
          (selectedNode) =>
            selectedNode.node_id !== nodeId &&
            String(selectedNode.player_id) === String(candidate.player_id)
        )
      );
    });
    const slotPlaceholder = getSlotPlaceholder(slotRule);

    return (
      <div
        className="w-[235px] -translate-x-1/2 -translate-y-1/2 sm:w-[245px] md:w-[270px]"
        onClick={() => {
          if (isBoardLocked) return;
          setActiveNodeId(nodeId);
        }}
      >
        <div
          className={`overflow-hidden rounded-[28px] border-[3px] bg-[linear-gradient(180deg,#ffffff_0%,#eefbff_74%,#f0f9ff_100%)] backdrop-blur-sm ${
            isActiveNode
              ? "border-amber-300 shadow-[0_18px_0_rgba(250,204,21,0.14),0_0_28px_rgba(250,204,21,0.22)]"
              : "border-sky-300 shadow-[0_18px_0_rgba(14,165,233,0.12),0_24px_42px_rgba(14,165,233,0.14)]"
          }`}
        >
          <div
            className={`border-b-[3px] px-5 py-3 text-center ${
              isActiveNode
                ? "border-amber-200 bg-[linear-gradient(90deg,#facc15_0%,#f59e0b_52%,#fde68a_100%)]"
                : "border-sky-200 bg-[linear-gradient(90deg,#38bdf8_0%,#818cf8_48%,#7dd3fc_100%)]"
            }`}
            >
              {renderSlotRuleTitle(slotRule)}
          </div>

          <div className="p-4">
            <SearchablePlayerSelect
              value={node?.player_id ?? ""}
              players={availablePlayers}
              disabled={isBoardLocked}
              placeholder={slotPlaceholder}
              onChange={(playerId) => updateNode(nodeId, playerId)}
              getPlayerLabel={getPlayerLabel}
              onActivate={() => setActiveNodeId(nodeId)}
              registerFocus={(focusFn) => registerNodeFocus(nodeId, focusFn)}
              onPlayerSelected={() => handleMobileNodeAdvance(nodeId)}
            />

            <div className="mt-3 rounded-[18px] border-[3px] border-sky-100 bg-[linear-gradient(180deg,#ffffff_0%,#f0f9ff_100%)] p-2.5 sm:p-3">
              {player ? (
                <div className="grid grid-cols-[1fr_56px] items-center gap-2 sm:grid-cols-[1fr_80px] sm:gap-3">
                  <div className="min-w-0">
                    <p className="font-[family-name:var(--font-display)] line-clamp-2 text-[12px] leading-[1.35] text-slate-900 sm:text-[13px] sm:leading-[1.45]">
                      {player.player_name}
                    </p>

                    <p className="mt-1 text-[9px] font-semibold uppercase tracking-[0.06em] text-sky-700/80 sm:mt-2 sm:text-[11px] sm:tracking-[0.08em]">
                      {player.primary_position ?? "N/A"} •{" "}
                      {player.career_start_season ?? "N/A"}–
                      {player.career_end_season ?? "N/A"}
                    </p>
                  </div>

                  <div className="flex justify-end">
                    {renderHeadshot(
                      player,
                      "h-14 w-14 rounded-[16px] sm:h-20 sm:w-20 sm:rounded-[22px]"
                    )}
                  </div>
                  </div>
              ) : (
                <div className="flex min-h-[84px] items-center justify-center rounded-[16px] border border-dashed border-slate-300 bg-slate-50/90 text-center">
                  <div className="px-4">
                    <p className="font-[family-name:var(--font-display)] text-[12px] leading-[1.5] text-sky-800">
                      {slotRule.display_text}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[linear-gradient(180deg,#fffdf8_0%,#f8f4ea_100%)] px-8 py-12 text-slate-900">
        <div className="mx-auto max-w-7xl">
          <p className="text-lg font-semibold">Loading puzzle...</p>
        </div>
      </main>
    );
  }

  if (!puzzleData || !playersData) {
    return (
      <main className="min-h-screen bg-[linear-gradient(180deg,#fffdf8_0%,#f8f4ea_100%)] px-8 py-12 text-slate-900">
        <div className="mx-auto max-w-7xl">
          <p className="text-lg font-semibold">Failed to load puzzle.</p>
          {loadError && (
            <div className="mt-4 max-w-3xl rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
              <p className="font-bold">Load error</p>
              <p className="mt-1 break-words">{loadError}</p>
              <p className="mt-2 text-xs">
                selected date: {selectedDate || "none"}
              </p>
            </div>
          )}
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen overflow-x-hidden bg-[linear-gradient(180deg,#fffdf8_0%,#f0f9ff_48%,#e0f2fe_100%)] px-4 py-6 pb-28 text-slate-900 md:px-8 md:pb-6">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(120deg,rgba(56,189,248,0.14)_0%,transparent_28%,rgba(125,211,252,0.1)_56%,rgba(14,165,233,0.12)_84%,transparent_100%)]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[420px] bg-[radial-gradient(circle_at_top,rgba(125,211,252,0.3)_0%,rgba(191,219,254,0.16)_26%,transparent_68%)]" />
      <div className="relative mx-auto max-w-[1380px]">
        <div className="mx-auto max-w-[1080px] overflow-hidden rounded-[38px] border-[4px] border-sky-300 bg-white/84 shadow-[0_10px_0_rgba(56,189,248,0.08),0_14px_36px_rgba(125,211,252,0.12)] backdrop-blur-sm">
          <div className="relative overflow-hidden border-b-[4px] border-sky-300 bg-[linear-gradient(135deg,#38bdf8_0%,#818cf8_42%,#7dd3fc_100%)] px-3 py-2.5 text-center md:px-8 md:pb-1.5 md:pt-7">
            <div className="absolute inset-0 bg-[repeating-linear-gradient(135deg,rgba(255,255,255,0.18)_0,rgba(255,255,255,0.18)_14px,transparent_14px,transparent_30px)]" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.36)_0%,transparent_34%)]" />
            <div className="absolute left-5 top-5 z-20 hidden md:block">
              {sessionStatus === "loading" ? (
                <div className="inline-flex h-10 items-center rounded-full border-[2px] border-white/55 bg-white/15 px-3 text-[10px] font-black uppercase tracking-[0.08em] text-white/90 backdrop-blur-sm">
                  Loading
                </div>
              ) : signedInUsername ? (
                <>
                  <button
                    type="button"
                    onClick={() => setProfileOpen(true)}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-full border-[2px] border-white/60 bg-white/18 backdrop-blur-sm transition hover:bg-white/26 md:hidden"
                    aria-label="Open profile"
                  >
                    <ProfileAvatar
                      style={sessionAvatarStyle}
                      bg={sessionAvatarBg}
                      accent={sessionAvatarAccent}
                      border={sessionAvatarBorder}
                      size="sm"
                    />
                  </button>
                  <button
                    type="button"
                    onClick={() => setProfileOpen(true)}
                    className="group relative hidden h-10 w-10 items-center justify-center rounded-full border-[2px] border-white/60 bg-white/18 text-[10px] font-black uppercase tracking-[0.08em] text-white backdrop-blur-sm transition hover:bg-white/26 md:inline-flex"
                    aria-label={`Open profile for ${signedInUsername}`}
                  >
                    <ProfileAvatar
                      style={sessionAvatarStyle}
                      bg={sessionAvatarBg}
                      accent={sessionAvatarAccent}
                      border={sessionAvatarBorder}
                      size="sm"
                    />
                    <span className="pointer-events-none absolute left-full top-1/2 ml-2 -translate-y-1/2 whitespace-nowrap rounded-full border-[2px] border-white/60 bg-white/22 px-3 py-2 text-[10px] font-black uppercase tracking-[0.08em] text-white opacity-0 shadow-[0_8px_18px_rgba(15,23,42,0.18)] backdrop-blur-sm transition duration-150 group-hover:opacity-100">
                      {signedInUsername}
                    </span>
                  </button>
                </>
              ) : needsUsername ? (
                <>
                  <button
                    type="button"
                    onClick={() => setProfileOpen(true)}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-full border-[2px] border-white/65 bg-white/20 text-white backdrop-blur-sm md:hidden"
                    aria-label="Finish profile"
                  >
                    <ProfileAvatar
                      style={sessionAvatarStyle}
                      bg={sessionAvatarBg}
                      accent={sessionAvatarAccent}
                      border={sessionAvatarBorder}
                      size="sm"
                    />
                  </button>
                  <div className="hidden h-10 items-center rounded-full border-[2px] border-white/65 bg-white/20 px-3 text-[10px] font-black uppercase tracking-[0.08em] text-white backdrop-blur-sm md:inline-flex">
                    Finish Profile
                  </div>
                </>
              ) : (
                <>
                  <div className="md:hidden">
                    <GuestProfileButton
                      onClick={() => setAccountChoiceOpen(true)}
                      ariaLabel="Open account options"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => setAccountChoiceOpen(true)}
                    className="hidden h-10 items-center rounded-full border-[2px] border-white/65 bg-white/20 px-3 text-[10px] font-black uppercase tracking-[0.08em] text-white shadow-[0_8px_18px_rgba(15,23,42,0.18)] backdrop-blur-sm transition hover:scale-[1.02] hover:bg-white/28 md:inline-flex"
                  >
                    Sign In
                  </button>
                </>
              )}
            </div>
            <button
              type="button"
              onClick={() => setLeaderboardOpen(true)}
              className="absolute right-5 top-5 z-20 hidden h-11 w-11 items-center justify-center rounded-full border-[2px] border-white/65 bg-white/20 text-white shadow-[0_8px_18px_rgba(15,23,42,0.18)] backdrop-blur-sm transition hover:scale-105 hover:bg-white/28 md:inline-flex"
              aria-label={`Open leaderboard for ${formatPuzzleDateLabel(todayIso)}`}
            >
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                className="h-4 w-4 md:h-5 md:w-5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M8 21h8" />
                <path d="M12 17v4" />
                <path d="M7 4h10v4a5 5 0 0 1-10 0V4Z" />
                <path d="M17 6h2a2 2 0 0 1-2 2" />
                <path d="M7 6H5a2 2 0 0 0 2 2" />
              </svg>
            </button>
            <div className="relative z-10">
              <div className="md:hidden">
                <div className="absolute left-1.5 top-1.5 z-20">
                  {sessionStatus === "loading" ? (
                    <div className="inline-flex h-10 w-10 items-center justify-center rounded-full border-[2px] border-white/55 bg-white/15 text-[10px] font-black uppercase tracking-[0.08em] text-white/90 backdrop-blur-sm">
                      ...
                    </div>
                  ) : signedInUsername ? (
                    <button
                      type="button"
                      onClick={() => setProfileOpen(true)}
                      className="inline-flex h-10 w-10 items-center justify-center rounded-full border-[2px] border-white/60 bg-white/18 backdrop-blur-sm transition hover:bg-white/26"
                      aria-label="Open profile"
                    >
                      <ProfileAvatar
                        style={sessionAvatarStyle}
                        bg={sessionAvatarBg}
                        accent={sessionAvatarAccent}
                        border={sessionAvatarBorder}
                        size="sm"
                      />
                    </button>
                  ) : needsUsername ? (
                    <button
                      type="button"
                      onClick={() => setProfileOpen(true)}
                      className="inline-flex h-10 w-10 items-center justify-center rounded-full border-[2px] border-white/65 bg-white/20 text-white backdrop-blur-sm"
                      aria-label="Finish profile"
                    >
                      <ProfileAvatar
                        style={sessionAvatarStyle}
                        bg={sessionAvatarBg}
                        accent={sessionAvatarAccent}
                        border={sessionAvatarBorder}
                        size="sm"
                      />
                    </button>
                  ) : (
                    <GuestProfileButton
                      onClick={() => setAccountChoiceOpen(true)}
                      ariaLabel="Open account options"
                    />
                  )}
                </div>
                <div className="mx-auto flex max-w-[320px] flex-col items-center pt-4 text-center">
                  <h1 className="text-2xl font-black tracking-[0.06em] text-white drop-shadow-[0_4px_0_rgba(30,41,59,0.18)]">
                    Five Wide
                  </h1>
                  <span className="mt-1.5 inline-flex items-center gap-1 rounded-full border-[2px] border-white/70 bg-white/20 px-2 py-0.5 text-[8px] font-black uppercase tracking-[0.1em] text-white shadow-[0_6px_14px_rgba(15,23,42,0.14)] backdrop-blur-sm">
                    <span className="h-2 w-2 rounded-full bg-pink-400 shadow-[0_0_0_2px_rgba(244,114,182,0.18)]" />
                    Alpha
                  </span>
                </div>
                <div className="absolute right-1.5 top-1.5 z-20">
                  <button
                    type="button"
                    onClick={() => setLeaderboardOpen(true)}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-full border-[2px] border-white/65 bg-white/20 text-white shadow-[0_8px_18px_rgba(15,23,42,0.18)] backdrop-blur-sm transition hover:scale-105 hover:bg-white/28"
                    aria-label={`Open leaderboard for ${formatPuzzleDateLabel(todayIso)}`}
                  >
                    <svg
                      aria-hidden="true"
                      viewBox="0 0 24 24"
                      className="h-4 w-4"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M8 21h8" />
                      <path d="M12 17v4" />
                      <path d="M7 4h10v4a5 5 0 0 1-10 0V4Z" />
                      <path d="M17 6h2a2 2 0 0 1-2 2" />
                      <path d="M7 6H5a2 2 0 0 0 2 2" />
                    </svg>
                  </button>
                </div>
              </div>
              <div className="hidden items-center justify-center gap-3 md:mt-3 md:flex">
                <h1 className="text-5xl font-black tracking-[0.08em] text-white drop-shadow-[0_4px_0_rgba(30,41,59,0.18)]">
                  Five Wide
                </h1>
                <span className="inline-flex items-center gap-1 rounded-full border-[2px] border-white/70 bg-white/20 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.1em] text-white shadow-[0_6px_14px_rgba(15,23,42,0.14)] backdrop-blur-sm">
                  <span className="h-2 w-2 rounded-full bg-pink-400 shadow-[0_0_0_2px_rgba(244,114,182,0.18)]" />
                  Alpha
                </span>
              </div>
              <p className="mx-auto mt-3 max-w-3xl text-[12px] font-semibold leading-[1.4] text-white/90 md:mt-4 md:max-w-4xl md:text-base">
                An NFL fantasy trivia game where you build the strongest 5-player lineup for the daily era, satisfy every slot rule, and chase the best score by combining raw fantasy production with as many valid player-to-player links as possible.
              </p>
            </div>
          </div>
        </div>

        {submitted ? (
          <div className="relative mx-auto mt-8 max-w-[1120px] overflow-hidden rounded-[38px] border-[4px] border-emerald-200 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.98)_0%,rgba(240,253,250,0.98)_34%,rgba(236,253,245,0.98)_68%,rgba(219,252,231,0.96)_100%)] p-6 text-center shadow-[0_10px_0_rgba(52,211,153,0.08),0_18px_48px_rgba(16,185,129,0.12)] backdrop-blur-sm md:p-10">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(125,211,252,0.16),transparent_38%),radial-gradient(circle_at_bottom_right,rgba(52,211,153,0.12),transparent_28%)]" />
            <button
              type="button"
              onClick={handleCloseSubmittedView}
              aria-label="Close submitted lineup view"
              className="absolute right-4 top-4 inline-flex h-10 w-10 items-center justify-center rounded-full border-[3px] border-emerald-200 bg-white/90 text-xl font-black text-emerald-700 shadow-[0_8px_18px_rgba(16,185,129,0.12)] transition hover:-translate-y-0.5 hover:bg-emerald-50"
            >
              ×
            </button>
            <div className="relative mx-auto flex flex-wrap items-center justify-center gap-2">
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white/85 px-4 py-2 shadow-[0_8px_22px_rgba(16,185,129,0.1)]">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 shadow-[0_0_0_4px_rgba(16,185,129,0.12)]" />
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-emerald-700">
                  Lineup Submitted
                </p>
              </div>
              <DataStateBadge finalized={leaderboardFinalized} />
              {comparisonRefreshLabel ? (
                <span className="inline-flex items-center rounded-full border border-slate-200 bg-white/85 px-3 py-1 text-[10px] font-black uppercase tracking-[0.08em] text-slate-500">
                  {comparisonRefreshLabel}
                </span>
              ) : null}
            </div>
            <h2 className="relative mt-6 text-3xl font-black text-slate-900 md:text-6xl">
              Final Score
            </h2>
            <p className="relative mt-4 bg-[linear-gradient(135deg,#2563eb_0%,#0f766e_100%)] bg-clip-text text-6xl font-black text-transparent md:text-8xl">
              {formattedFinalScore}
            </p>
            <p className="relative mx-auto mt-3 max-w-2xl text-sm font-semibold leading-6 text-slate-600">
              Your lineup is locked in. Compare it against the live leader now, then come back after finalization to see the true optimal build.
            </p>

            <div className="mx-auto mt-8 grid max-w-5xl gap-3 sm:grid-cols-2 xl:grid-cols-6">
              {renderSubmissionMiniStat(
                leaderboardFinalized ? "Final Rank" : "Live Rank",
                currentSubmissionRank != null ? `#${currentSubmissionRank}` : "Pending",
                rankAccent
              )}
              {renderSubmissionMiniStat(
                "Base Fantasy Points",
                displayedBaseFantasyPoints.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })
              )}
              {renderSubmissionMiniStat(
                "Active Links",
                displayedActiveLinkCount.toLocaleString()
              )}
              {renderSubmissionMiniStat(
                "Multiplier",
                `${displayedMultiplier.toFixed(2)}x`,
                "emerald"
              )}
              {renderSubmissionMiniStat(
                "Optimal Score",
                puzzleData?.leaderboard_finalized && optimalLineup
                  ? Number(optimalLineup.optimal_final_score).toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })
                  : puzzleData?.leaderboard_finalized && optimalLoading
                    ? "Calculating..."
                    : "Locked Until Finalized",
                "indigo"
              )}
              {renderSubmissionMiniStat(
                "Score vs Optimal",
                optimalPercent != null
                  ? `${optimalPercent.toFixed(1)}%`
                  : puzzleData?.leaderboard_finalized && optimalLoading
                    ? "Calculating..."
                    : "Pending",
                "indigo"
              )}
            </div>

            {optimalError && (
              <div className="mx-auto mt-6 max-w-3xl rounded-[20px] border border-rose-200 bg-rose-50 px-4 py-3 text-left text-sm text-rose-900">
                <p className="font-bold">Optimal lineup error</p>
                <p className="mt-1 break-words">{optimalError}</p>
              </div>
            )}

            <div className="mx-auto mt-8 grid max-w-6xl items-stretch gap-6 xl:grid-cols-2">
              <div className="flex h-full flex-col rounded-[30px] border-[4px] border-sky-200 bg-[linear-gradient(180deg,#ffffff_0%,#f0f9ff_100%)] p-5 text-left shadow-[0_12px_28px_rgba(125,211,252,0.12)] md:p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.12em] text-sky-700">
                      Your Lineup
                    </p>
                    <h3 className="mt-2 text-2xl font-black text-slate-900">
                      Locked Submission
                    </h3>
                  </div>
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <DataStateBadge finalized={leaderboardFinalized} compact />
                    <div className="rounded-full border border-sky-200 bg-white px-3 py-1 text-[10px] font-black uppercase tracking-[0.1em] text-sky-700">
                      {selectedLineupEntriesBySlot.length} Players
                    </div>
                  </div>
                </div>
                <p className="mt-3 text-sm font-semibold leading-6 text-slate-600">
                  A cleaner snapshot of the five players you locked for this puzzle. This side reflects your saved entry exactly as scored.
                </p>
                <div className="mt-4 space-y-3">
                  {selectedLineupEntriesBySlot.map((entry) =>
                    renderLineupEntry(
                      entry.player,
                      {
                        border: "border-sky-100",
                        label: "text-sky-700/80",
                        value: "text-sky-700",
                      },
                      entry.slotLabel
                    )
                  )}
                </div>
                <div className="mt-5 grid grid-cols-2 gap-3">
                  {renderSubmissionMiniStat(
                    "Base",
                    displayedBaseFantasyPoints.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })
                  )}
                  {renderSubmissionMiniStat(
                    "Active Links",
                    displayedActiveLinkCount.toLocaleString()
                  )}
                  {renderSubmissionMiniStat(
                    "Multiplier",
                    `${displayedMultiplier.toFixed(2)}x`
                  )}
                  {renderSubmissionMiniStat(
                    "Total",
                    displayedFinalScore.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    }),
                    "emerald"
                  )}
                </div>
              </div>

              <div className="flex h-full flex-col rounded-[30px] border-[4px] border-indigo-200 bg-[linear-gradient(180deg,#ffffff_0%,#eef2ff_100%)] p-5 text-left shadow-[0_12px_28px_rgba(129,140,248,0.12)] md:p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.12em] text-indigo-700">
                      {puzzleData?.leaderboard_finalized ? "Optimal Lineup" : "Current Leader"}
                    </p>
                    <h3 className="mt-2 text-2xl font-black text-slate-900">
                      {puzzleData?.leaderboard_finalized
                        ? "Best Possible Build"
                        : `Current Leader - ${currentLeaderLineup?.leader.display_name ?? "Live First Place"}`}
                    </h3>
                  </div>
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <DataStateBadge finalized={leaderboardFinalized} compact />
                    {comparisonRefreshLabel ? (
                      <span className="inline-flex items-center rounded-full border border-indigo-100 bg-white px-3 py-1 text-[10px] font-black uppercase tracking-[0.08em] text-indigo-500">
                        {comparisonRefreshLabel}
                      </span>
                    ) : null}
                  </div>
                </div>
                {puzzleData?.leaderboard_finalized ? (
                  optimalLineup ? (
                    <>
                      <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">
                        The leaderboard is finalized, so this optimal lineup is now locked and safe to reveal.
                      </p>
                      <div className="mt-4 space-y-3">
                        {optimalLineup.optimal_lineup.map((entry) =>
                          renderLineupEntry(
                            entry.player,
                            {
                              border: "border-indigo-100",
                              label: "text-indigo-700/80",
                              value: "text-indigo-700",
                            },
                            entry.slot_rule.display_text
                          )
                        )}
                      </div>
                      <div className="mt-5 grid grid-cols-2 gap-3">
                        {renderSubmissionMiniStat(
                          "Base",
                          Number(optimalLineup.optimal_base_score).toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          }),
                          "indigo"
                        )}
                        {renderSubmissionMiniStat(
                          "Active Links",
                          optimalLineup.optimal_active_links.toLocaleString(),
                          "indigo"
                        )}
                        {renderSubmissionMiniStat(
                          "Multiplier",
                          `${Number(optimalLineup.optimal_multiplier).toFixed(2)}x`,
                          "indigo"
                        )}
                        {renderSubmissionMiniStat(
                          "Total",
                          Number(optimalLineup.optimal_final_score).toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          }),
                          "indigo"
                        )}
                      </div>
                    </>
                  ) : (
                    <div className="mt-4 rounded-[18px] border-[3px] border-indigo-100 bg-white/85 px-4 py-6 text-center text-sm font-semibold text-slate-600">
                      {optimalLoading
                        ? "Calculating optimal lineup..."
                        : optimalError ??
                          "Optimal lineup becomes available after leaderboard finalization."}
                    </div>
                  )
                ) : currentLeaderLineup ? (
                  <>
                    <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">
                      This shows the live first-place lineup right now. Ranks can still move, and the true optimal lineup stays hidden until finalization.
                    </p>
                    <div className="mt-4 space-y-3">
                      {currentLeaderLineup.lineup.map((entry) =>
                        renderLineupEntry(
                          entry.player,
                          {
                            border: "border-indigo-100",
                            label: "text-indigo-700/80",
                            value: "text-indigo-700",
                          },
                          entry.slot_rule.display_text
                        )
                      )}
                    </div>
                    <div className="mt-5 grid grid-cols-2 gap-3">
                      {renderSubmissionMiniStat(
                        "Base",
                        Number(currentLeaderLineup.leader.base_score).toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        }),
                        "indigo"
                      )}
                      {renderSubmissionMiniStat(
                        "Active Links",
                        currentLeaderLineup.leader.active_links.toLocaleString(),
                        "indigo"
                      )}
                      {renderSubmissionMiniStat(
                        "Multiplier",
                        `${Number(currentLeaderLineup.leader.multiplier).toFixed(2)}x`,
                        "indigo"
                      )}
                      {renderSubmissionMiniStat(
                        "Total",
                        Number(currentLeaderLineup.leader.final_score).toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        }),
                        "indigo"
                      )}
                    </div>
                  </>
                ) : (
                  <div className="mt-4 rounded-[18px] border-[3px] border-indigo-100 bg-white/85 px-4 py-6 text-center text-sm font-semibold text-slate-600">
                    {currentLeaderLoading
                      ? "Loading current leader lineup..."
                      : currentLeaderError ?? "Current leader lineup unavailable"}
                  </div>
                )}
              </div>
            </div>

            {submissionResult?.awarded_badges &&
            submissionResult.awarded_badges.length > 0 ? (
              <div className="badge-celebration-shell mx-auto mt-8 max-w-4xl rounded-[26px] border-[4px] border-emerald-200 bg-[linear-gradient(180deg,#ffffff_0%,#ecfdf5_100%)] p-6 text-left shadow-[0_8px_22px_rgba(16,185,129,0.1)]">
                <p className="text-[10px] font-black uppercase tracking-[0.12em] text-emerald-700">
                  New Badges
                </p>
                <h3 className="mt-2 text-2xl font-black text-emerald-900">
                  You earned {submissionResult.awarded_badges.length} new badge
                  {submissionResult.awarded_badges.length === 1 ? "" : "s"}
                </h3>
                <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">
                  Badges lock when official results lock. Big finishes and milestones now show up with a little more ceremony.
                </p>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  {submissionResult.awarded_badges.map((badge, index) => (
                    <div
                      key={badge.badgeKey}
                      className="badge-reveal-card"
                      style={{ animationDelay: `${index * 120}ms` }}
                    >
                      <ProfileBadgeCard badge={badge} compact />
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {isTrackedAccountUser ? (
              <div className="mx-auto mt-8 max-w-4xl rounded-[26px] border-[4px] border-sky-200 bg-[linear-gradient(180deg,#ffffff_0%,#f0f9ff_100%)] p-6 text-left shadow-[0_8px_22px_rgba(56,189,248,0.1)]">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.12em] text-sky-700">
                      Next Goals
                    </p>
                    <h3 className="mt-2 text-2xl font-black text-sky-900">
                      Keep the streak going
                    </h3>
                    <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-slate-600">
                      Account stats are tracked across days, and daily leaderboard badges lock from the nightly finalized snapshot.
                    </p>
                  </div>
                  <div className="rounded-[18px] border-[3px] border-sky-100 bg-white/90 px-4 py-3 text-center">
                    <p className="text-[10px] font-black uppercase tracking-[0.08em] text-sky-700">
                      Projected Totals
                    </p>
                    <p className="mt-1 text-sm font-black text-slate-900">
                      {projectedPostSubmitStats.puzzles_submitted} puzzles •{" "}
                      {projectedPostSubmitStats.links_created} links
                    </p>
                  </div>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  {nextBadgeGoals.map((goal) => (
                    <div
                      key={`goal-${goal.badge.key}`}
                      className="rounded-[20px] border-[3px] border-sky-100 bg-white/90 p-4 shadow-[0_10px_24px_rgba(56,189,248,0.08)]"
                    >
                      <div className="flex items-center gap-3">
                        <div className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[16px] border border-white/60 bg-[linear-gradient(145deg,#e0f2fe,#7dd3fc)] text-sky-900 shadow-[0_10px_18px_rgba(56,189,248,0.18)]">
                          <svg
                            aria-hidden="true"
                            viewBox="0 0 24 24"
                            className="h-5 w-5"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.8"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <BadgeGlyph icon={goal.badge.icon} />
                          </svg>
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-black uppercase tracking-[0.08em] text-sky-800">
                            {goal.badge.title}
                          </p>
                          <p className="mt-1 text-[10px] font-black uppercase tracking-[0.08em] text-slate-500">
                            {goal.progressLabel}
                          </p>
                        </div>
                      </div>
                      <div className="mt-3 h-2 overflow-hidden rounded-full bg-sky-100">
                        <div
                          className="h-full rounded-full bg-[linear-gradient(90deg,#38bdf8_0%,#818cf8_100%)]"
                          style={{
                            width: `${
                              goal.progressRatio <= 0
                                ? 0
                                : Math.max(8, goal.progressRatio * 100)
                            }%`,
                          }}
                        />
                      </div>
                      <p className="mt-3 text-sm font-semibold leading-5 text-slate-600">
                        {goal.note}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="mx-auto mt-8 max-w-4xl rounded-[26px] border-[4px] border-amber-200 bg-[linear-gradient(180deg,#ffffff_0%,#fffbeb_100%)] p-6 text-left shadow-[0_8px_22px_rgba(251,191,36,0.1)]">
              <p className="text-[10px] font-black uppercase tracking-[0.12em] text-amber-700">
                {formatPuzzleDateLabel(activePuzzleDate)} Leaderboard
              </p>
              {leaderboardError ? (
                <div className="mt-4 rounded-[18px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
                  {leaderboardError}
                </div>
              ) : leaderboardLoading && leaderboard.length === 0 ? (
                <div className="mt-4 rounded-[18px] border-[3px] border-amber-100 bg-white/85 px-4 py-6 text-center text-sm font-semibold text-slate-600">
                  Loading leaderboard...
                </div>
              ) : leaderboard.length > 0 ? (
                <div className="mt-3 space-y-2">
                  {leaderboard.map((entry, index) => (
                    <button
                      type="button"
                      key={entry.submission_id}
                      onClick={() => void openPublicProfile(entry.user_id)}
                      className={`flex w-full flex-col items-start gap-1.5 rounded-[14px] border-[2px] bg-white/90 px-2.5 py-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:px-3 sm:py-2.5 ${
                        submissionResult?.submission_id === entry.submission_id
                          ? "border-emerald-200 shadow-[0_0_20px_rgba(52,211,153,0.12)]"
                          : "border-amber-100"
                      } text-left transition hover:-translate-y-0.5 hover:border-amber-200 hover:shadow-[0_10px_22px_rgba(245,158,11,0.1)]`}
                    >
                      <div className="min-w-0 w-full sm:w-auto">
                        <p className="text-[9px] font-black uppercase tracking-[0.08em] text-amber-700">
                          #{index + 1}
                        </p>
                        <p className="mt-0.5 truncate text-[13px] font-bold text-slate-900 sm:text-sm">
                          {entry.display_name}
                        </p>
                        <LeaderboardBadgeIcons badgeKeys={entry.featured_badges} />
                        <p className="mt-0.5 text-[9px] font-semibold uppercase tracking-[0.05em] text-amber-700/80">
                          {Number(entry.percent_of_optimal ?? 0).toFixed(1)}% of optimal •{" "}
                          {entry.active_links} links
                        </p>
                      </div>
                      <div className="w-full shrink-0 text-left sm:w-auto sm:text-right">
                        <p className="text-[9px] font-black uppercase tracking-[0.08em] text-slate-500">
                          Final Score
                        </p>
                        <p className="mt-0.5 text-sm font-black text-amber-700 sm:text-base">
                          {Number(entry.final_score).toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="mt-4 rounded-[18px] border-[3px] border-amber-100 bg-white/85 px-4 py-6 text-center text-sm font-semibold text-slate-600">
                  No leaderboard entries yet for this puzzle.
                </div>
              )}
            </div>

            {optimalLineup && (
              <div className="hidden mx-auto mt-8 max-w-3xl rounded-[26px] border-[4px] border-indigo-200 bg-[linear-gradient(180deg,#ffffff_0%,#eef2ff_100%)] p-6 text-left shadow-[0_8px_22px_rgba(129,140,248,0.1)]">
                <p className="text-[10px] font-black uppercase tracking-[0.12em] text-indigo-700">
                  Optimal Lineup
                </p>
                <div className="mt-4 space-y-3">
                  {optimalLineup.optimal_lineup.map((entry) => (
                    <div
                      key={`${entry.slot_number}-${entry.player.player_id}`}
                      className="flex items-center justify-between gap-4 rounded-[18px] border-[3px] border-indigo-100 bg-white/90 px-4 py-3"
                    >
                      <div className="min-w-0">
                        <p className="text-[10px] font-black uppercase tracking-[0.08em] text-indigo-600">
                          {entry.slot_rule.display_text}
                        </p>
                        <p className="mt-1 truncate text-sm font-bold text-slate-900">
                          {entry.player.player_name}
                        </p>
                        <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.06em] text-indigo-700/80">
                          {entry.player.primary_position ?? "N/A"} •{" "}
                          {entry.player.theme_start_season ??
                            entry.player.career_start_season ??
                            "N/A"}
                          –
                          {entry.player.theme_end_season ??
                            entry.player.career_end_season ??
                            "N/A"}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-[10px] font-black uppercase tracking-[0.08em] text-slate-500">
                          Fantasy Pts
                        </p>
                        <p className="mt-1 text-lg font-black text-indigo-700">
                          {Number(entry.player.fantasy_points).toLocaleString(
                            undefined,
                            {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            }
                          )}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-5 grid gap-3 md:grid-cols-3">
                  <div className="rounded-[18px] border-[3px] border-indigo-100 bg-white/85 px-4 py-3">
                    <p className="text-[10px] font-black uppercase tracking-[0.08em] text-indigo-600">
                      Base
                    </p>
                    <p className="mt-1 text-lg font-black text-slate-900">
                      {Number(optimalLineup.optimal_base_score).toLocaleString(
                        undefined,
                        {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        }
                      )}
                    </p>
                  </div>
                  <div className="rounded-[18px] border-[3px] border-indigo-100 bg-white/85 px-4 py-3">
                    <p className="text-[10px] font-black uppercase tracking-[0.08em] text-indigo-600">
                      Active Links
                    </p>
                    <p className="mt-1 text-lg font-black text-slate-900">
                      {optimalLineup.optimal_active_links}
                    </p>
                  </div>
                  <div className="rounded-[18px] border-[3px] border-indigo-100 bg-white/85 px-4 py-3">
                    <p className="text-[10px] font-black uppercase tracking-[0.08em] text-indigo-600">
                      Multiplier
                    </p>
                    <p className="mt-1 text-lg font-black text-slate-900">
                      {Number(optimalLineup.optimal_multiplier).toFixed(2)}x
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="hidden mx-auto mt-8 max-w-3xl rounded-[26px] border-[4px] border-sky-200 bg-[linear-gradient(180deg,#ffffff_0%,#f0f9ff_100%)] p-6 text-left shadow-[0_8px_22px_rgba(125,211,252,0.1)]">
              <p className="text-[10px] font-black uppercase tracking-[0.12em] text-sky-700">
                Player Breakdown
              </p>
              <div className="mt-4 space-y-3">
                {selectedPlayersByFantasyPoints.map((player) => (
                  <div
                    key={player.player_id}
                    className="flex items-center justify-between gap-4 rounded-[18px] border-[3px] border-sky-100 bg-white/90 px-4 py-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-slate-900">
                        {player.player_name}
                      </p>
                      <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.06em] text-sky-700/80">
                        {player.primary_position ?? "N/A"} â€¢{" "}
                        {player.theme_start_season ?? player.career_start_season ?? "N/A"}â€“
                        {player.theme_end_season ?? player.career_end_season ?? "N/A"}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-[10px] font-black uppercase tracking-[0.08em] text-slate-500">
                        Fantasy Pts
                      </p>
                      <p className="mt-1 text-lg font-black text-sky-700">
                        {Number(player.fantasy_points).toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <>
          <div className="relative mt-4 mx-auto h-[500px] max-w-[1080px] overflow-hidden rounded-[36px] border-[4px] border-sky-200 bg-[radial-gradient(circle_at_top,#ffffff_0%,#f0f9ff_46%,#f8f4ea_100%)] px-1.5 pb-1 pt-3 shadow-[0_10px_0_rgba(125,211,252,0.08),0_16px_38px_rgba(125,211,252,0.12)] backdrop-blur-sm sm:h-[700px] md:h-[760px] md:max-w-[1080px] md:px-2 md:pb-2 md:pt-4">
              <div className="absolute left-3 top-3 z-40 sm:hidden">
                <div className="inline-flex min-w-0 items-center justify-center gap-2 rounded-full border-[2px] border-sky-200 bg-white/90 px-2 py-1 shadow-[0_6px_16px_rgba(125,211,252,0.14)]">
                  <span className="h-3 w-3 shrink-0 rounded-full bg-lime-400 shadow-[0_0_14px_rgba(74,222,128,0.9)]" />
                  <select
                    value={selectedDate}
                    onChange={(e) => {
                      const nextDate = e.target.value;
                      setSelectedDate(nextDate);
                      if (typeof window !== "undefined") {
                        window.history.replaceState(
                          {},
                          "",
                          buildNavigationUrl(nextDate, todayIso)
                        );
                      }
                    }}
                    className="min-w-0 bg-transparent text-center text-[8px] font-black uppercase tracking-[0.05em] text-sky-700 outline-none"
                    aria-label={`Puzzle date, currently ${formattedPuzzleDate}`}
                  >
                    {renderedDateOptions.map((dateValue) => (
                      <option key={dateValue} value={dateValue}>
                        {formatPuzzleDateLabel(dateValue)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="absolute right-3 top-3 z-40 flex w-[24%] min-w-[110px] max-w-[132px] flex-col gap-2 sm:hidden">
                <div className="group relative inline-flex min-w-0 flex-col items-center justify-center gap-1 rounded-[18px] border-[2px] border-sky-300 bg-[linear-gradient(180deg,#ffffff_0%,#ecfeff_100%)] px-2 py-1.5 text-center shadow-[0_6px_18px_rgba(56,189,248,0.16)]">
                  <span className="rounded-full bg-sky-100 px-1.5 py-1 text-[7px] font-black uppercase tracking-[0.08em] text-sky-700">
                    Time Period
                  </span>
                  <span className="min-w-0 text-[8px] font-black uppercase leading-[1.2] tracking-[0.02em] text-sky-800">
                    {puzzleData.theme?.display_name ?? "Daily Time Period"}
                  </span>
                </div>
                <div className="inline-flex min-w-0 flex-col items-center justify-center gap-1 rounded-[18px] border-[2px] border-slate-200 bg-white/92 px-2 py-1.5 text-center shadow-[0_6px_16px_rgba(148,163,184,0.12)]">
                  <span className="rounded-full bg-slate-100 px-1.5 py-1 text-[7px] font-black uppercase tracking-[0.08em] text-slate-600">
                    Players
                  </span>
                  <span className="min-w-0 text-[8px] font-black uppercase tracking-[0.04em] text-slate-700">
                    {players.length} Available
                  </span>
                </div>
                {qbExclusionEnabled ? (
                  <div className="inline-flex min-w-0 items-center justify-center gap-1 rounded-[18px] border-[2px] border-rose-300 bg-[linear-gradient(180deg,#fff1f2_0%,#ffe4e6_100%)] px-2 py-1.5 text-center shadow-[0_6px_16px_rgba(244,63,94,0.14)]">
                    <span className="rounded-full bg-rose-100 px-1.5 py-1 text-[7px] font-black uppercase tracking-[0.08em] text-rose-700">
                      Filter
                    </span>
                    <span className="relative min-w-0 text-[8px] font-black uppercase tracking-[0.04em] text-rose-800">
                      No QBs
                      <span className="absolute left-0 top-1/2 h-[1.5px] w-full -translate-y-1/2 rotate-[-12deg] bg-rose-700" />
                    </span>
                  </div>
                ) : null}
              </div>

              <div className="absolute inset-x-4 top-4 z-40 hidden items-start justify-between gap-3 sm:flex">
                <div className="inline-flex min-w-0 items-center justify-center gap-2 rounded-full border-[2px] border-sky-200 bg-white/90 px-4 py-1.5 shadow-[0_6px_16px_rgba(125,211,252,0.14)]">
                  <span className="h-3 w-3 shrink-0 rounded-full bg-lime-400 shadow-[0_0_14px_rgba(74,222,128,0.9)]" />
                  <select
                    value={selectedDate}
                    onChange={(e) => {
                      const nextDate = e.target.value;
                      setSelectedDate(nextDate);
                      if (typeof window !== "undefined") {
                        window.history.replaceState(
                          {},
                          "",
                          buildNavigationUrl(nextDate, todayIso)
                        );
                      }
                    }}
                    className="min-w-0 bg-transparent text-center text-[10px] font-black uppercase tracking-[0.08em] text-sky-700 outline-none"
                    aria-label={`Puzzle date, currently ${formattedPuzzleDate}`}
                  >
                    {renderedDateOptions.map((dateValue) => (
                      <option key={dateValue} value={dateValue}>
                        {formatPuzzleDateLabel(dateValue)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex min-w-0 flex-col items-end gap-2">
                  <div className="group relative inline-flex min-w-0 items-center justify-center gap-1.5 self-end rounded-full border-[2px] border-sky-300 bg-[linear-gradient(180deg,#ffffff_0%,#ecfeff_100%)] px-2 py-1 text-center shadow-[0_6px_18px_rgba(56,189,248,0.16)] sm:gap-2 sm:px-5 sm:py-1.5">
                    <span className="rounded-full bg-sky-100 px-1.5 py-1 text-[7px] font-black uppercase tracking-[0.08em] text-sky-700 sm:px-2 sm:text-[8px] sm:tracking-[0.1em]">
                      Time Period
                    </span>
                    <span className="min-w-0 text-[8px] font-black uppercase tracking-[0.03em] text-sky-800 sm:text-[11px] sm:tracking-[0.07em]">
                      {puzzleData.theme?.display_name ?? "Daily Time Period"}
                    </span>
                    <div className="pointer-events-none absolute left-1/2 top-full z-50 hidden w-[240px] -translate-x-1/2 pt-2 opacity-0 transition duration-200 group-hover:opacity-100 sm:block">
                      <div className="rounded-[18px] border-[2px] border-sky-200 bg-white/96 px-3 py-2 text-left shadow-[0_12px_30px_rgba(56,189,248,0.18)] backdrop-blur-sm">
                        <p className="text-[9px] font-black uppercase tracking-[0.08em] text-sky-700">
                          Time Period Info
                        </p>
                        <p className="mt-1 text-[11px] font-semibold leading-[1.35] text-slate-700">
                          Only stats from this season window count toward each player&apos;s score.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="inline-flex min-w-0 items-center justify-center gap-1.5 self-end rounded-full border-[2px] border-slate-200 bg-white/92 px-2 py-1 text-center shadow-[0_6px_16px_rgba(148,163,184,0.12)] sm:gap-2 sm:px-4 sm:py-1.5">
                    <span className="rounded-full bg-slate-100 px-1.5 py-1 text-[7px] font-black uppercase tracking-[0.08em] text-slate-600 sm:px-2 sm:text-[8px] sm:tracking-[0.1em]">
                      Players
                    </span>
                    <span className="min-w-0 text-[8px] font-black uppercase tracking-[0.04em] text-slate-700 sm:text-[10px] sm:tracking-[0.06em]">
                      {players.length} Available
                    </span>
                  </div>
                  {qbExclusionEnabled ? (
                    <div className="inline-flex min-w-0 items-center justify-center gap-1.5 self-end rounded-full border-[2px] border-rose-300 bg-[linear-gradient(180deg,#fff1f2_0%,#ffe4e6_100%)] px-2 py-1 text-center shadow-[0_6px_16px_rgba(244,63,94,0.14)] sm:gap-2 sm:px-4 sm:py-1.5">
                      <span className="rounded-full bg-rose-100 px-1.5 py-1 text-[7px] font-black uppercase tracking-[0.08em] text-rose-700 sm:px-2 sm:text-[8px] sm:tracking-[0.1em]">
                        Filter
                      </span>
                      <span className="relative min-w-0 text-[8px] font-black uppercase tracking-[0.04em] text-rose-800 sm:text-[10px] sm:tracking-[0.06em]">
                        No QBs
                        <span className="absolute left-0 top-1/2 h-[1.5px] w-full -translate-y-1/2 rotate-[-12deg] bg-rose-700" />
                      </span>
                    </div>
                  ) : null}
                </div>
              </div>

              {loadError && (
                <div className="absolute bottom-16 left-3 z-40 max-w-[420px] rounded-xl border border-rose-200 bg-white/95 px-3 py-2 text-[10px] font-semibold text-rose-900 shadow-[0_8px_18px_rgba(244,63,94,0.12)]">
                  error: {loadError}
                </div>
              )}

                <div className="absolute left-1/2 top-[40%] h-[980px] w-[1400px] -translate-x-1/2 -translate-y-1/2 scale-[0.42] sm:top-1/2 sm:h-[850px] sm:scale-[0.58] md:scale-[0.7] lg:scale-[0.76]">
                  <div className="absolute inset-0 overflow-hidden rounded-[30px]">
                    <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.25)_0%,rgba(255,255,255,0.02)_18%,rgba(255,255,255,0.00)_100%)]" />
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(125,211,252,0.14)_0%,transparent_44%)]" />
                  </div>

                  <svg className="absolute inset-0 h-full w-full">
                    {nodePairs.map(([a, b], idx) => {
                      const posA = getPositionById(a);
                      const posB = getPositionById(b);
                      const tone = getLinkTone(a, b);
                      const color = getLineColor(tone);
                      const dash = getLineDash(tone);

                      return (
                        <line
                          key={`${a}-${b}-${idx}`}
                          x1={posA.x}
                          y1={posA.y}
                          x2={posB.x}
                          y2={posB.y}
                          stroke={color}
                          strokeWidth={tone === "active" ? 5.5 : 2.5}
                          strokeDasharray={dash}
                          strokeLinecap="round"
                          opacity={tone === "active" ? 1 : 0.45}
                        />
                      );
                    })}
                  </svg>

                  <div
                    className="absolute z-20"
                    style={{
                      left: renderedCenter.x,
                      top: renderedCenter.y,
                      transform: "translate(-50%, -50%)",
                    }}
                  >
                    <div className="relative h-[294px] w-[294px] sm:h-[320px] sm:w-[320px]">
                      {activeLinkCount > 0 && !isFullyConnected && (
                        <div
                          className="pointer-events-none absolute inset-[18px] rounded-full animate-pulse"
                          style={{
                            background: `radial-gradient(circle, rgba(74,222,128,${0.12 + liveEnergy * 0.16}) 0%, rgba(56,189,248,${0.1 + liveEnergy * 0.08}) 42%, transparent 72%)`,
                            filter: `blur(${16 + liveEnergy * 10}px)`,
                            animationDuration: `${pulseDuration}s`,
                          }}
                        />
                      )}
                      {isFullyConnected && showFullLinkConfetti && (
                        <div className="pointer-events-none absolute inset-[-34px] z-10">
                          {confettiPieces.map((piece) => (
                            <span
                              key={piece.id}
                              className="absolute h-3 w-2 rounded-[2px] opacity-0 full-link-confetti"
                              style={{
                                left: `${piece.left}%`,
                                top: `${piece.top}%`,
                                backgroundColor: piece.color,
                                animationDelay: `${piece.delay}s`,
                                ["--burst-x" as string]: `${piece.x}px`,
                                ["--burst-y" as string]: `${piece.y}px`,
                                ["--burst-rotate" as string]: `${piece.rotate}deg`,
                              }}
                            />
                          ))}
                        </div>
                      )}
                      <svg
                        className="absolute inset-0 h-full w-full -rotate-90"
                        viewBox={`0 0 ${centerRingSize} ${centerRingSize}`}
                      >
                        <circle
                          cx={centerRingMid}
                          cy={centerRingMid}
                          r={meterRadius}
                          fill="none"
                          stroke="rgba(14,165,233,0.18)"
                          strokeWidth="16"
                        />
                        {isFullyConnected ? (
                          <circle
                            cx={centerRingMid}
                            cy={centerRingMid}
                            r={meterRadius}
                            fill="none"
                            stroke="url(#fullConnectionGradient)"
                            strokeWidth="18"
                            className="drop-shadow-[0_0_16px_rgba(34,197,94,0.55)]"
                          />
                        ) : (
                          <circle
                            cx={centerRingMid}
                            cy={centerRingMid}
                            r={meterRadius}
                            fill="none"
                            stroke={activeLinkCount > 0 ? "#22c55e" : "#cbd5e1"}
                            strokeWidth="18"
                            strokeLinecap="round"
                            strokeDasharray={meterCircumference}
                            strokeDashoffset={meterOffset}
                            className="transition-all duration-500 ease-out"
                            style={{
                              filter: `drop-shadow(0 0 ${14 + liveEnergy * 14}px rgba(34,197,94,${ringGlowStrength}))`,
                            }}
                          />
                        )}
                        <defs>
                          <linearGradient
                            id="fullConnectionGradient"
                            x1="0%"
                            y1="0%"
                            x2="100%"
                            y2="100%"
                          >
                            <stop offset="0%" stopColor="#86efac" />
                            <stop offset="45%" stopColor="#22c55e" />
                            <stop offset="100%" stopColor="#16a34a" />
                          </linearGradient>
                        </defs>
                      </svg>

                      <div
                        className={`absolute inset-[16px] flex items-center justify-center rounded-full border-[8px] px-7 text-center shadow-[0_12px_0_rgba(14,165,233,0.08),0_22px_50px_rgba(125,211,252,0.24)] sm:inset-[18px] sm:border-[9px] sm:px-9 ${
                          isFullyConnected
                            ? "border-emerald-200 bg-[radial-gradient(circle_at_top,#f7fee7_0%,#dcfce7_40%,#bbf7d0_100%)]"
                            : "border-sky-100 bg-[radial-gradient(circle_at_top,#ffffff_0%,#e0f2fe_54%,#dbeafe_100%)]"
                        }`}
                        style={
                          isFullyConnected
                            ? undefined
                            : {
                                boxShadow: `0 12px 0 rgba(14,165,233,0.08), 0 22px 50px rgba(125,211,252,${0.24 + liveEnergy * 0.16}), 0 0 ${18 + liveEnergy * 20}px rgba(34,197,94,${shellGlowStrength})`,
                              }
                        }
                      >
                        <div
                          className={`absolute inset-[12px] rounded-full border ${
                            isFullyConnected
                              ? "border-emerald-300/80"
                              : "border-sky-200/70"
                          }`}
                          style={
                            isFullyConnected
                              ? undefined
                              : {
                                  boxShadow: `inset 0 0 ${10 + liveEnergy * 10}px rgba(255,255,255,0.6), 0 0 ${8 + liveEnergy * 14}px rgba(34,197,94,${0.12 + liveEnergy * 0.18})`,
                                }
                          }
                        />
                        {isFullyConnected && (
                          <div className="absolute inset-[4px] rounded-full border-2 border-emerald-300/70 shadow-[0_0_32px_rgba(34,197,94,0.45)]" />
                        )}

                        <div className="relative z-10">
                          {!isFullyConnected && relationshipTeamLogoUrl && (
                            <div className="mb-2 flex justify-center sm:mb-3">
                              <img
                                src={relationshipTeamLogoUrl}
                                alt={relationshipLabel}
                                className="h-10 w-10 object-contain drop-shadow-[0_2px_6px_rgba(15,23,42,0.22)] sm:h-9 sm:w-9"
                                onError={(event) => {
                                  event.currentTarget.style.display = "none";
                                }}
                              />
                            </div>
                          )}
                          <p
                            className={`text-[10px] font-black uppercase tracking-[0.08em] sm:text-[8px] sm:tracking-[0.04em] ${
                              isFullyConnected ? "text-emerald-700" : "text-sky-700"
                            }`}
                          >
                            {isFullyConnected ? "Full Connection" : "Live Link Bonus"}
                          </p>

                          <p
                            className={`mt-2 text-[1.3rem] font-black leading-[1.08] tracking-[0.01em] sm:mt-3 sm:text-[1.35rem] sm:leading-[1.35] ${
                              isFullyConnected ? "text-emerald-900" : "text-sky-900"
                            }`}
                          >
                            {isFullyConnected ? (
                              "Fully Linked"
                            ) : (
                              <span
                                className="relative inline-flex items-center justify-center"
                                onMouseEnter={() => setRelationshipTooltipOpen(true)}
                                onMouseLeave={() => setRelationshipTooltipOpen(false)}
                              >
                                <button
                                  type="button"
                                  onClick={() =>
                                    setRelationshipTooltipOpen((current) => !current)
                                  }
                                  className="rounded-full px-1.5 py-0.5 text-inherit transition hover:bg-white/35 sm:px-2 sm:py-1"
                                  aria-label={`How ${relationshipLabel} links work`}
                                >
                                  {relationshipLabel}
                                </button>
                                {relationshipTooltipOpen ? (
                                  <span className="absolute left-1/2 top-full z-20 mt-3 w-72 -translate-x-1/2 rounded-[20px] border-[3px] border-sky-200 bg-white px-4 py-4 text-left text-[13px] font-semibold normal-case leading-6 tracking-normal text-slate-700 shadow-[0_18px_34px_rgba(14,165,233,0.16)] sm:w-80 sm:text-sm">
                                    {relationshipTooltipText}
                                  </span>
                                ) : null}
                              </span>
                            )}
                          </p>

                          <p
                            className={`mt-2 text-[14px] font-bold uppercase tracking-[0.05em] sm:mt-3 sm:text-[12px] sm:tracking-[0.08em] ${
                              isFullyConnected ? "text-emerald-700" : "text-sky-700"
                            }`}
                          >
                            {`${multiplier.toFixed(2)}x multiplier`}
                          </p>

                          <div
                            className={`mt-3 inline-flex items-center rounded-full border-[3px] bg-white/90 px-4 py-2 sm:mt-5 sm:px-4 sm:py-1.5 ${
                              isFullyConnected
                                ? "border-emerald-300 shadow-[0_0_20px_rgba(34,197,94,0.18)]"
                                : "border-emerald-200"
                            }`}
                          >
                            <span
                              className={`text-[11px] font-black uppercase tracking-[0.05em] sm:font-[family-name:var(--font-display)] sm:text-[8px] sm:tracking-[0.04em] ${
                                isFullyConnected ? "text-emerald-800" : "text-emerald-700"
                              }`}
                            >
                              {activeLinkCount} / {totalPossibleLinks} Links Active
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {renderedNodePositions.map((position) => (
                    <div
                      key={position.nodeId}
                      className="absolute z-30"
                      style={{
                        left: position.x,
                        top: position.y,
                      }}
                    >
                      {renderNode(position.nodeId)}
                    </div>
                  ))}
                </div>
            </div>

              <div className="mx-auto mt-6 max-w-[1080px] rounded-[30px] border-[4px] border-sky-200 bg-[linear-gradient(180deg,#f0f9ff_0%,#eff6ff_100%)] p-6 shadow-[0_8px_0_rgba(125,211,252,0.07),0_12px_28px_rgba(125,211,252,0.1)] backdrop-blur-sm">
                {submissionError && !isLockedForSelectedDate && (
                  <div
                    className="mb-4 rounded-[18px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-900"
                  >
                    {submissionError}
                  </div>
                )}
                <div className="mb-4 grid gap-3 md:grid-cols-3">
                  {inlineRuleHints.map((hint) => (
                    <div
                      key={hint.title}
                      className="rounded-[20px] border-[3px] border-sky-100 bg-white/90 px-4 py-3 text-left shadow-[0_10px_20px_rgba(125,211,252,0.08)]"
                    >
                      <p className="text-[10px] font-black uppercase tracking-[0.08em] text-sky-700">
                        {hint.title}
                      </p>
                      <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">
                        {hint.body}
                      </p>
                    </div>
                  ))}
                </div>
                <div className="mb-4 flex flex-wrap items-center justify-center gap-2">
                  <DataStateBadge finalized={leaderboardFinalized} />
                  {leaderboardRefreshLabel ? (
                    <span className="inline-flex items-center rounded-full border border-slate-200 bg-white/90 px-3 py-1 text-[10px] font-black uppercase tracking-[0.08em] text-slate-500">
                      {leaderboardRefreshLabel}
                    </span>
                  ) : null}
                  <span className="inline-flex items-center rounded-full border border-sky-100 bg-white/90 px-3 py-1 text-[10px] font-black uppercase tracking-[0.08em] text-sky-700">
                    {leaderboardFinalized
                      ? "Badges Locked"
                      : "Badges Award After Finalization"}
                  </span>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={isLockedForSelectedDate ? () => void handleShowSubmission() : handleSubmit}
                    disabled={isLockedForSelectedDate ? savedSubmissionLoading : !canSubmit}
                    className={`sm:order-2 rounded-2xl px-6 py-4 text-sm font-bold transition ${
                      isLockedForSelectedDate || canSubmit
                        ? "border-[3px] border-sky-300 bg-[linear-gradient(180deg,#7dd3fc_0%,#38bdf8_52%,#0ea5e9_100%)] text-white shadow-[0_10px_0_rgba(56,189,248,0.18),0_14px_28px_rgba(56,189,248,0.24)] hover:-translate-y-0.5 hover:brightness-105"
                        : "cursor-not-allowed border border-white/10 bg-white/10 text-slate-400 shadow-none"
                    }`}
                  >
                    {isLockedForSelectedDate
                      ? savedSubmissionLoading
                        ? "Loading Submission..."
                        : "Show Submission"
                      : "Submit Score"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setRulesOpen(true)}
                    className="sm:order-1 rounded-2xl border-[3px] border-sky-200 bg-white/90 px-6 py-4 text-sm font-bold text-sky-700 shadow-[0_8px_18px_rgba(125,211,252,0.14)] transition hover:-translate-y-0.5 hover:bg-sky-50"
                  >
                    Rules &amp; Info
                  </button>
                </div>
                {isLockedForSelectedDate && (
                  <p className="mt-3 text-center text-[11px] font-semibold leading-5 text-sky-800/80 sm:text-sm">
                    {isTrackedAccountUser
                      ? `Locked lineup loaded for ${formatPuzzleDateLabel(selectedDate)}. You can still review that saved entry, but each user only gets one official score per day.`
                      : `Locked lineup loaded for ${formatPuzzleDateLabel(selectedDate)} on this browser. You can still review that saved entry, but each guest only gets one official score per day.`}
                  </p>
                )}
              </div>
          </>
        )}

        <div className="mx-auto mt-6 max-w-[1080px] px-2 text-center">
          <p className="text-[11px] font-semibold leading-5 text-slate-500 md:text-xs">
            NFL player and stats data for this project is loaded via{" "}
            <a
              href="https://nflreadpy.nflverse.com/"
              target="_blank"
              rel="noreferrer"
              className="font-black text-sky-700 underline decoration-sky-300 underline-offset-2"
            >
              nflreadpy
            </a>{" "}
            from the{" "}
            <a
              href="https://github.com/nflverse/nflverse-data"
              target="_blank"
              rel="noreferrer"
              className="font-black text-sky-700 underline decoration-sky-300 underline-offset-2"
            >
              nflverse data
            </a>{" "}
            project.
          </p>
        </div>

        {accountChoiceOpen && !signedInUsername && !needsUsername && (
          <div className="fixed inset-0 z-[108] overflow-y-auto bg-slate-950/45 px-4 py-6">
            <div className="flex min-h-full items-center justify-center">
              <div className="w-full max-w-md rounded-[30px] border-[4px] border-sky-200 bg-[linear-gradient(180deg,#ffffff_0%,#f0f9ff_100%)] p-5 shadow-[0_14px_34px_rgba(15,23,42,0.16)] md:p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.12em] text-sky-700">
                      Save Your Profile
                    </p>
                    <h2 className="mt-2 text-2xl font-black text-sky-900">
                      Play Guest Or Sign In
                    </h2>
                    <p className="mt-3 text-sm font-semibold leading-6 text-slate-600">
                      Keep playing as a guest, or sign in with Google to save your username, avatar, and tracked scores.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAccountChoiceOpen(false)}
                    className="rounded-full border-[3px] border-sky-200 bg-white px-3 py-1 text-xs font-black uppercase tracking-[0.08em] text-sky-700"
                  >
                    Close
                  </button>
                </div>
                <div className="mt-6 grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => setAccountChoiceOpen(false)}
                    className="rounded-2xl border-[3px] border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
                  >
                    Continue As Guest
                  </button>
                  <button
                    type="button"
                    onClick={() => void signIn("google")}
                    className="rounded-2xl border-[3px] border-sky-300 bg-[linear-gradient(180deg,#7dd3fc_0%,#38bdf8_52%,#0ea5e9_100%)] px-4 py-3 text-sm font-bold text-white shadow-[0_10px_0_rgba(56,189,248,0.18),0_14px_28px_rgba(56,189,248,0.24)] transition hover:-translate-y-0.5 hover:brightness-105"
                  >
                    Continue With Google
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {needsUsername && (
          <div className="fixed inset-0 z-[110] overflow-y-auto bg-slate-950/45 px-4 py-6">
            <div className="flex min-h-full items-center justify-center">
              <div className="w-full max-w-md rounded-[30px] border-[4px] border-sky-200 bg-[linear-gradient(180deg,#ffffff_0%,#f0f9ff_100%)] p-5 shadow-[0_14px_34px_rgba(15,23,42,0.16)] md:p-6">
                <p className="text-[10px] font-black uppercase tracking-[0.12em] text-sky-700">
                  Finish Profile
                </p>
                <h2 className="mt-2 text-2xl font-black text-sky-900">
                  Choose Your Username
                </h2>
                <p className="mt-3 text-sm font-semibold leading-6 text-slate-600">
                  Pick a unique, moderated username so your scores can be tracked across devices.
                </p>
                <div className="mt-5">
                  <label
                    htmlFor="username"
                    className="text-[10px] font-black uppercase tracking-[0.08em] text-sky-700"
                  >
                    Username
                  </label>
                  <input
                    id="username"
                    type="text"
                    value={usernameDraft}
                    onChange={(e) => setUsernameDraft(e.target.value)}
                    placeholder="3-16 letters, numbers, underscore"
                    className="mt-2 w-full rounded-2xl border-[3px] border-sky-200 bg-white px-4 py-3 text-sm font-bold text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-sky-400"
                    maxLength={16}
                    autoFocus
                  />
                </div>
                {usernameError && (
                  <div className="mt-4 rounded-[18px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-900">
                    {usernameError}
                  </div>
                )}
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => void signOut({ redirect: false })}
                    className="rounded-2xl border-[3px] border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
                  >
                    Continue As Guest
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleSaveUsername()}
                    disabled={usernameSaving}
                    className="rounded-2xl border-[3px] border-sky-300 bg-[linear-gradient(180deg,#7dd3fc_0%,#38bdf8_52%,#0ea5e9_100%)] px-4 py-3 text-sm font-bold text-white shadow-[0_10px_0_rgba(56,189,248,0.18),0_14px_28px_rgba(56,189,248,0.24)] transition hover:-translate-y-0.5 hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {usernameSaving ? "Saving..." : "Save Username"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {profileOpen && signedInUsername && (
          <div className="fixed inset-0 z-[105] overflow-y-auto bg-slate-950/40 px-4 py-6">
            <div className="flex min-h-full items-center justify-center">
              <div className="w-full max-w-3xl rounded-[30px] border-[4px] border-sky-200 bg-[linear-gradient(180deg,#ffffff_0%,#f0f9ff_100%)] p-5 shadow-[0_14px_34px_rgba(15,23,42,0.16)] md:p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.12em] text-sky-700">
                      Profile
                    </p>
                    <p className="mt-2 text-sm font-semibold text-slate-600">
                      {signedInUsername}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setProfileOpen(false)}
                    className="rounded-full border-[3px] border-sky-200 bg-white px-3 py-1 text-xs font-black uppercase tracking-[0.08em] text-sky-700"
                  >
                    Close
                  </button>
                </div>

                <div className="mt-6 space-y-6">
                  <div className="rounded-[28px] border-[3px] border-sky-100 bg-white/90 p-5">
                    <div className="grid gap-5 md:grid-cols-[240px_1fr]">
                      <div className="flex items-center gap-4">
                        <ProfileAvatar
                          style={avatarStyleDraft}
                          bg={avatarBgDraft}
                          accent={avatarAccentDraft}
                          border={avatarBorderDraft}
                          size="lg"
                        />
                        <div>
                          <p className="text-xl font-black text-slate-900">
                            {signedInUsername}
                          </p>
                          <p className="mt-2 text-[10px] font-black uppercase tracking-[0.08em] text-sky-700">
                            Joined {formatProfileCreatedDate(profileCreatedAt)}
                          </p>
                        </div>
                      </div>
                      <div className="space-y-3">
                        {featuredBadgeSlots.map((badge, index) => (
                          <FeaturedBadgeSlot
                            key={badge?.badgeKey ?? `empty-${index}`}
                            badge={badge}
                            active={activeFeaturedBadgeKey === badge?.badgeKey}
                            onToggle={() =>
                              setActiveFeaturedBadgeKey((current) =>
                                current === badge?.badgeKey ? null : (badge?.badgeKey ?? null)
                              )
                            }
                            onRemove={
                              badge
                                ? () => handleToggleFeaturedBadge(badge.badgeKey)
                                : null
                            }
                          />
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-center">
                    <div className="inline-flex items-center gap-2 rounded-full border-[3px] border-sky-200 bg-sky-50/80 p-1">
                      <button
                        type="button"
                        onClick={() => setProfileSectionTab("profile")}
                        className={`rounded-full px-4 py-2 text-[10px] font-black uppercase tracking-[0.08em] transition ${
                          profileSectionTab === "profile"
                            ? "border-[3px] border-sky-300 bg-white text-sky-700 shadow-[0_8px_16px_rgba(56,189,248,0.16)]"
                            : "border-[3px] border-transparent bg-transparent text-slate-500 hover:bg-white/70"
                        }`}
                      >
                        Profile
                      </button>
                      <button
                        type="button"
                        onClick={() => setProfileSectionTab("social")}
                        className={`rounded-full px-4 py-2 text-[10px] font-black uppercase tracking-[0.08em] transition ${
                          profileSectionTab === "social"
                            ? "border-[3px] border-sky-300 bg-white text-sky-700 shadow-[0_8px_16px_rgba(56,189,248,0.16)]"
                            : "border-[3px] border-transparent bg-transparent text-slate-500 hover:bg-white/70"
                        }`}
                      >
                        Social
                      </button>
                    </div>
                  </div>

                  <div
                    className={`grid gap-6 ${
                      profileSectionTab === "social"
                        ? "md:grid-cols-1"
                        : "md:grid-cols-[240px_1fr]"
                    }`}
                  >
                    <div className={profileSectionTab === "social" ? "hidden" : "space-y-4"}>
                      <div className="rounded-[26px] border-[3px] border-sky-100 bg-white/90 p-4">
                        <p className="text-[10px] font-black uppercase tracking-[0.1em] text-sky-700">
                          Stats
                        </p>
                        <div className="mt-4 grid gap-2">
                          <div className="rounded-[16px] border border-sky-100 bg-sky-50/70 px-3 py-2.5 text-center">
                            <p className="text-[9px] font-black uppercase leading-tight tracking-[0.05em] text-sky-700">
                              Puzzles Submitted
                            </p>
                            <p className="mt-1 text-xl font-black text-slate-900">
                              {userStats.puzzles_submitted}
                            </p>
                          </div>
                          <div className="rounded-[16px] border border-sky-100 bg-sky-50/70 px-3 py-2.5 text-center">
                            <p className="text-[9px] font-black uppercase leading-tight tracking-[0.05em] text-sky-700">
                              Leaderboards Made
                            </p>
                            <p className="mt-1 text-xl font-black text-slate-900">
                              {userStats.leaderboard_finishes}
                            </p>
                          </div>
                          <div className="rounded-[16px] border border-sky-100 bg-sky-50/70 px-3 py-2.5 text-center">
                            <p className="text-[9px] font-black uppercase leading-tight tracking-[0.05em] text-sky-700">
                              Links Created
                            </p>
                            <p className="mt-1 text-xl font-black text-slate-900">
                              {userStats.links_created}
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="rounded-[26px] border-[3px] border-sky-100 bg-white/90 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-[10px] font-black uppercase tracking-[0.1em] text-sky-700">
                              Recent Runs
                            </p>
                            <p className="mt-1 text-sm font-semibold text-slate-600">
                              Your latest locked lineups and finalized finishes.
                            </p>
                          </div>
                          <span className="rounded-full bg-sky-100 px-2 py-1 text-[10px] font-black uppercase tracking-[0.08em] text-sky-700">
                            {selfRecentSubmissions.length}
                          </span>
                        </div>
                        <div className="mt-4">
                          {selfProfileError ? (
                            <div className="rounded-[18px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-900">
                              {selfProfileError}
                            </div>
                          ) : selfProfileLoading && selfRecentSubmissions.length === 0 ? (
                            <div className="rounded-[18px] border-[3px] border-sky-100 bg-white/85 px-4 py-6 text-center text-sm font-semibold text-slate-600">
                              Loading recent history...
                            </div>
                          ) : (
                            <RecentSubmissionList
                              submissions={selfRecentSubmissions}
                              emptyMessage="No saved puzzle history yet."
                            />
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-5">
                    <div
                      className={
                        profileSectionTab === "social"
                          ? "rounded-[26px] border-[3px] border-sky-100 bg-white/90 p-4"
                          : "hidden"
                      }
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-[0.1em] text-sky-700">
                            Friends
                          </p>
                          <p className="mt-1 text-sm font-semibold text-slate-600">
                            Add exact usernames and build a private rivalry list.
                          </p>
                        </div>
                        <span className="rounded-full bg-sky-100 px-2 py-1 text-[10px] font-black uppercase tracking-[0.08em] text-sky-700">
                          {friendOverview?.friends.length ?? 0}
                        </span>
                      </div>
                      <div className="mt-4 flex gap-2">
                        <input
                          type="text"
                          value={friendSearchDraft}
                          onChange={(e) => setFriendSearchDraft(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              void handleFriendSearch();
                            }
                          }}
                          placeholder="Exact username"
                          className="min-w-0 flex-1 rounded-[16px] border-[3px] border-sky-100 bg-white px-3 py-2 text-sm font-bold text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-sky-300"
                        />
                        <button
                          type="button"
                          onClick={() => void handleFriendSearch()}
                          disabled={friendSearchLoading}
                          className="rounded-[16px] border-[3px] border-sky-200 bg-sky-50 px-3 py-2 text-[10px] font-black uppercase tracking-[0.08em] text-sky-700 transition hover:bg-sky-100 disabled:opacity-60"
                        >
                          {friendSearchLoading ? "..." : "Find"}
                        </button>
                      </div>
                      {friendSearchResult ? (
                        <div className="mt-3 rounded-[18px] border-[3px] border-sky-100 bg-sky-50/70 p-3">
                          <div className="flex items-center gap-3">
                            <ProfileAvatar
                              style={friendSearchResult.avatar_style}
                              bg={friendSearchResult.avatar_bg}
                              accent={friendSearchResult.avatar_accent}
                              border={friendSearchResult.avatar_border}
                              size="sm"
                            />
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-black text-slate-900">
                                {friendSearchResult.username}
                              </p>
                              <p className="mt-1 text-[10px] font-black uppercase tracking-[0.08em] text-sky-700">
                                Joined {formatProfileCreatedDate(friendSearchResult.created_at)}
                              </p>
                            </div>
                          </div>
                          <div className="mt-3 flex flex-wrap gap-2">
                            {friendSearchResult.relationship_status === "none" ? (
                              <button
                                type="button"
                                onClick={() =>
                                  void handleFriendAction("send", friendSearchResult.user_id)
                                }
                                disabled={
                                  friendActionLoadingId === `send:${friendSearchResult.user_id}`
                                }
                                className="rounded-full border-[3px] border-sky-300 bg-[linear-gradient(180deg,#7dd3fc_0%,#38bdf8_52%,#0ea5e9_100%)] px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.08em] text-white"
                              >
                                Add Friend
                              </button>
                            ) : friendSearchResult.relationship_status === "incoming" ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() =>
                                    void handleFriendAction("accept", friendSearchResult.user_id)
                                  }
                                  disabled={
                                    friendActionLoadingId ===
                                    `accept:${friendSearchResult.user_id}`
                                  }
                                  className="rounded-full border-[3px] border-emerald-300 bg-emerald-50 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.08em] text-emerald-700"
                                >
                                  Accept
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    void handleFriendAction("decline", friendSearchResult.user_id)
                                  }
                                  disabled={
                                    friendActionLoadingId ===
                                    `decline:${friendSearchResult.user_id}`
                                  }
                                  className="rounded-full border-[3px] border-slate-200 bg-white px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.08em] text-slate-600"
                                >
                                  Decline
                                </button>
                              </>
                            ) : friendSearchResult.relationship_status === "outgoing" ? (
                              <button
                                type="button"
                                onClick={() =>
                                  void handleFriendAction("cancel", friendSearchResult.user_id)
                                }
                                disabled={
                                  friendActionLoadingId === `cancel:${friendSearchResult.user_id}`
                                }
                                className="rounded-full border-[3px] border-slate-200 bg-white px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.08em] text-slate-600"
                              >
                                Pending
                              </button>
                            ) : friendSearchResult.relationship_status === "friend" ? (
                              <button
                                type="button"
                                onClick={() =>
                                  void handleFriendAction("remove", friendSearchResult.user_id)
                                }
                                disabled={
                                  friendActionLoadingId === `remove:${friendSearchResult.user_id}`
                                }
                                className="rounded-full border-[3px] border-amber-200 bg-amber-50 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.08em] text-amber-700"
                              >
                                Friends
                              </button>
                            ) : (
                              <span className="rounded-full border-[3px] border-sky-200 bg-white px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.08em] text-sky-700">
                                That&apos;s you
                              </span>
                            )}
                          </div>
                        </div>
                      ) : null}
                      {friendSearchMessage ? (
                        <p className="mt-3 text-xs font-semibold text-slate-600">
                          {friendSearchMessage}
                        </p>
                      ) : null}
                      {friendActionError || friendOverviewError ? (
                        <div className="mt-3 rounded-[16px] border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-900">
                          {friendActionError ?? friendOverviewError}
                        </div>
                      ) : null}
                      <div className="mt-4 rounded-[18px] border-[3px] border-sky-100 bg-sky-50/60 p-2">
                        <div className="grid grid-cols-3 gap-2">
                          <button
                            type="button"
                            onClick={() => setFriendTab("friends")}
                            className={`inline-flex min-w-0 items-center justify-center rounded-[14px] px-1.5 py-2 text-center text-[9px] font-black uppercase leading-tight tracking-[0.04em] whitespace-normal break-words transition sm:px-2 sm:text-[10px] sm:tracking-[0.08em] ${
                              friendTab === "friends"
                                ? "border-[3px] border-sky-300 bg-white text-sky-700 shadow-[0_6px_14px_rgba(125,211,252,0.18)]"
                                : "border-[3px] border-transparent bg-transparent text-slate-500 hover:bg-white/80"
                            }`}
                          >
                            Friends
                          </button>
                          <button
                            type="button"
                            onClick={() => setFriendTab("pending")}
                            className={`inline-flex min-w-0 items-center justify-center rounded-[14px] px-1.5 py-2 text-center text-[9px] font-black uppercase leading-tight tracking-[0.04em] whitespace-normal break-words transition sm:px-2 sm:text-[10px] sm:tracking-[0.08em] ${
                              friendTab === "pending"
                                ? "border-[3px] border-sky-300 bg-white text-sky-700 shadow-[0_6px_14px_rgba(125,211,252,0.18)]"
                                : "border-[3px] border-transparent bg-transparent text-slate-500 hover:bg-white/80"
                            }`}
                          >
                            Pending
                          </button>
                          <button
                            type="button"
                            onClick={() => setFriendTab("requests")}
                            className={`inline-flex min-w-0 items-center justify-center rounded-[14px] px-1.5 py-2 text-center text-[9px] font-black uppercase leading-tight tracking-[0.04em] whitespace-normal break-words transition sm:px-2 sm:text-[10px] sm:tracking-[0.08em] ${
                              friendTab === "requests"
                                ? "border-[3px] border-sky-300 bg-white text-sky-700 shadow-[0_6px_14px_rgba(125,211,252,0.18)]"
                                : "border-[3px] border-transparent bg-transparent text-slate-500 hover:bg-white/80"
                            }`}
                          >
                            Requests
                          </button>
                        </div>
                      </div>
                      <div className="mt-4 space-y-3">
                        {friendOverviewLoading && !friendOverview ? (
                          <div className="rounded-[16px] border-[3px] border-sky-100 bg-white/85 px-3 py-4 text-center text-xs font-semibold text-slate-600">
                            Loading friends...
                          </div>
                        ) : friendTab === "friends" ? (
                          <div>
                          <p className="text-[10px] font-black uppercase tracking-[0.08em] text-sky-700">
                            Your Friends
                          </p>
                          <div className="mt-2 space-y-2">
                            {friendOverview?.friends.length ? (
                              friendOverview.friends.map((friend) => (
                                <div
                                  key={`friend-${friend.user_id}`}
                                  className="flex items-center gap-3 rounded-[16px] border-[3px] border-sky-100 bg-white/85 px-3 py-2"
                                >
                                  <ProfileAvatar
                                    style={friend.avatar_style}
                                    bg={friend.avatar_bg}
                                    accent={friend.avatar_accent}
                                    border={friend.avatar_border}
                                    size="sm"
                                  />
                                  <div className="min-w-0 flex-1">
                                    <p className="truncate text-sm font-black text-slate-900">
                                      {friend.username}
                                    </p>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => void handleFriendAction("remove", friend.user_id)}
                                    disabled={friendActionLoadingId === `remove:${friend.user_id}`}
                                    className="rounded-full border-[2px] border-slate-200 bg-white px-2 py-1 text-[9px] font-black uppercase tracking-[0.08em] text-slate-600"
                                  >
                                    Remove
                                  </button>
                                </div>
                              ))
                            ) : (
                              <div className="rounded-[16px] border-[3px] border-dashed border-sky-200 bg-sky-50/60 px-3 py-4 text-center text-xs font-semibold text-slate-500">
                                No friends added yet.
                              </div>
                            )}
                          </div>
                        </div>
                        ) : friendTab === "requests" ? (
                          <div>
                            <p className="text-[10px] font-black uppercase tracking-[0.08em] text-sky-700">
                              Incoming Requests
                            </p>
                            <div className="mt-2 space-y-2">
                              {friendOverview?.incoming_requests.length ? (
                                friendOverview.incoming_requests.map((friend) => (
                                  <div
                                    key={`incoming-${friend.request_id}`}
                                    className="rounded-[16px] border-[3px] border-emerald-100 bg-emerald-50/70 px-3 py-2"
                                  >
                                    <div className="flex items-center gap-3">
                                      <ProfileAvatar
                                        style={friend.avatar_style}
                                        bg={friend.avatar_bg}
                                        accent={friend.avatar_accent}
                                        border={friend.avatar_border}
                                        size="sm"
                                      />
                                      <div className="min-w-0 flex-1">
                                        <p className="truncate text-sm font-black text-slate-900">
                                          {friend.username}
                                        </p>
                                      </div>
                                    </div>
                                    <div className="mt-2 flex gap-2">
                                      <button
                                        type="button"
                                        onClick={() => void handleFriendAction("accept", friend.user_id)}
                                        disabled={friendActionLoadingId === `accept:${friend.user_id}`}
                                        className="rounded-full border-[2px] border-emerald-300 bg-white px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.08em] text-emerald-700"
                                      >
                                        Accept
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => void handleFriendAction("decline", friend.user_id)}
                                        disabled={friendActionLoadingId === `decline:${friend.user_id}`}
                                        className="rounded-full border-[2px] border-slate-200 bg-white px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.08em] text-slate-600"
                                      >
                                        Decline
                                      </button>
                                    </div>
                                  </div>
                                ))
                              ) : (
                                <div className="rounded-[16px] border-[3px] border-dashed border-emerald-200 bg-emerald-50/50 px-3 py-4 text-center text-xs font-semibold text-slate-500">
                                  No incoming requests right now.
                                </div>
                              )}
                            </div>
                          </div>
                        ) : (
                          <div>
                            <p className="text-[10px] font-black uppercase tracking-[0.08em] text-sky-700">
                              Sent Requests
                            </p>
                            <div className="mt-2 space-y-2">
                              {friendOverview?.outgoing_requests.length ? (
                                friendOverview.outgoing_requests.map((friend) => (
                                  <div
                                    key={`outgoing-${friend.request_id}`}
                                    className="flex items-center gap-3 rounded-[16px] border-[3px] border-slate-100 bg-slate-50/70 px-3 py-2"
                                  >
                                    <ProfileAvatar
                                      style={friend.avatar_style}
                                      bg={friend.avatar_bg}
                                      accent={friend.avatar_accent}
                                      border={friend.avatar_border}
                                      size="sm"
                                    />
                                    <div className="min-w-0 flex-1">
                                      <p className="truncate text-sm font-black text-slate-900">
                                        {friend.username}
                                      </p>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => void handleFriendAction("cancel", friend.user_id)}
                                      disabled={friendActionLoadingId === `cancel:${friend.user_id}`}
                                      className="rounded-full border-[2px] border-slate-200 bg-white px-2 py-1 text-[9px] font-black uppercase tracking-[0.08em] text-slate-600"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                ))
                              ) : (
                                <div className="rounded-[16px] border-[3px] border-dashed border-slate-200 bg-slate-50/70 px-3 py-4 text-center text-xs font-semibold text-slate-500">
                                  No pending friend requests sent.
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                    <div
                      className={
                        profileSectionTab === "profile"
                          ? "rounded-[26px] border-[3px] border-sky-100 bg-white/90 p-4"
                          : "hidden"
                      }
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-[0.1em] text-sky-700">
                            Badge Gallery
                          </p>
                          <p className="mt-1 text-sm font-semibold text-slate-600">
                            Public badges unlock through play. Locked badges stay grey until you earn them.
                          </p>
                        </div>
                        <span className="rounded-full bg-sky-100 px-2 py-1 text-[10px] font-black uppercase tracking-[0.08em] text-sky-700">
                          {
                            filteredGalleryBadges.filter((badgeDefinition) =>
                              earnedBadgeMap.has(badgeDefinition.key)
                            ).length
                          }
                          /
                          {filteredGalleryBadges.length}
                        </span>
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2">
                        {[
                          ["milestones", "Milestones"],
                          ["links", "Links"],
                          ["leaderboard", "Leaderboard"],
                          ["social", "Social"],
                          ["profile", "Profile"],
                        ].map(([tabKey, label]) => (
                          <button
                            key={tabKey}
                            type="button"
                            onClick={() => setBadgeGalleryTab(tabKey as BadgeGalleryTab)}
                            className={`rounded-full border px-3 py-2 text-[10px] font-black uppercase tracking-[0.08em] transition ${
                              badgeGalleryTab === tabKey
                                ? "border-sky-300 bg-sky-100 text-sky-800"
                                : "border-slate-200 bg-white text-slate-600 hover:border-sky-200 hover:bg-sky-50"
                            }`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                      <div className="mt-4 grid gap-3 md:grid-cols-2">
                        {pagedGalleryBadges.length ? pagedGalleryBadges.map((badgeDefinition) => {
                          const earnedBadge = earnedBadgeMap.get(badgeDefinition.key);
                          const isFeatured = featuredBadgeDraft.includes(badgeDefinition.key);

                          return earnedBadge ? (
                            <ProfileBadgeCard
                              key={`gallery-${badgeDefinition.key}`}
                              badge={earnedBadge}
                              actionLabel={isFeatured ? "Featured" : "Feature"}
                              onAction={() => handleToggleFeaturedBadge(badgeDefinition.key)}
                              actionDisabled={!isFeatured && featuredBadgeDraft.length >= 3}
                            />
                          ) : (
                            <ProfileBadgeCard
                              key={`gallery-${badgeDefinition.key}`}
                              badge={{
                                badgeKey: badgeDefinition.key,
                                title: badgeDefinition.title,
                                description: badgeDefinition.description,
                                tone: badgeDefinition.tone,
                                icon: badgeDefinition.icon,
                                awardedAt: "",
                              }}
                              locked
                              helperText={getBadgeProgressLabel(
                                badgeDefinition,
                                userStats
                              )}
                            />
                          );
                        }) : (
                          <div className="md:col-span-2 rounded-[18px] border-[3px] border-dashed border-sky-200 bg-sky-50/60 px-4 py-6 text-center text-sm font-semibold text-slate-500">
                            No badges in this category yet.
                          </div>
                        )}
                      </div>
                      {filteredGalleryBadges.length > galleryPageSize ? (
                        <div className="mt-4 flex justify-center">
                          <div className="inline-flex items-center gap-1 rounded-full border border-sky-200 bg-sky-50 px-1 py-1">
                            <button
                              type="button"
                              onClick={() => setGalleryPage((current) => Math.max(0, current - 1))}
                              disabled={galleryPage === 0}
                              className="rounded-full px-2 py-1 text-[10px] font-black uppercase tracking-[0.08em] text-sky-700 disabled:opacity-35"
                            >
                              Prev
                            </button>
                            <span className="text-[10px] font-black uppercase tracking-[0.08em] text-sky-700">
                              {galleryPage + 1}/{galleryPageCount}
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                setGalleryPage((current) =>
                                  Math.min(galleryPageCount - 1, current + 1)
                                )
                              }
                              disabled={galleryPage >= galleryPageCount - 1}
                              className="rounded-full px-2 py-1 text-[10px] font-black uppercase tracking-[0.08em] text-sky-700 disabled:opacity-35"
                            >
                              Next
                            </button>
                          </div>
                        </div>
                      ) : null}
                    </div>

                    <div
                      className={
                        profileSectionTab === "profile"
                          ? "rounded-[26px] border-[3px] border-sky-100 bg-white/90 p-4"
                          : "hidden"
                      }
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="text-[10px] font-black uppercase tracking-[0.1em] text-sky-700">
                            Avatar Studio
                          </p>
                          <p className="mt-1 text-sm font-semibold text-slate-600">
                            Mix styles, background, icon, and border colors to build your look.
                          </p>
                        </div>
                        <div className="rounded-[18px] border-[3px] border-sky-100 bg-[linear-gradient(180deg,#f8fdff_0%,#e0f2fe_100%)] px-3 py-2 text-center shadow-[0_10px_24px_rgba(56,189,248,0.12)]">
                          <ProfileAvatar
                            style={avatarStyleDraft}
                            bg={avatarBgDraft}
                            accent={avatarAccentDraft}
                            border={avatarBorderDraft}
                            size="md"
                          />
                          <p className="mt-1.5 text-[9px] font-black uppercase tracking-[0.08em] text-sky-700">
                            Live Preview
                          </p>
                        </div>
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2">
                        {[
                          ["style", "Icon"],
                          ["background", "Background"],
                          ["icon", "Color"],
                          ["border", "Border"],
                        ].map(([tabKey, label]) => (
                          <button
                            key={tabKey}
                            type="button"
                            onClick={() => {
                              setAvatarEditorTab(
                                tabKey as "style" | "background" | "icon" | "border"
                              );
                              setAvatarOptionPage(0);
                            }}
                            className={`rounded-full border px-3 py-2 text-xs font-black uppercase tracking-[0.08em] transition ${
                              avatarEditorTab === tabKey
                                ? "border-sky-300 bg-sky-100 text-sky-800"
                                : "border-slate-200 bg-white text-slate-600 hover:border-sky-200 hover:bg-sky-50"
                            }`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>

                      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 xl:grid-cols-4">
                        {pagedAvatarOptions.map((option) => {
                          const optionKey = String(option);
                          const isSelected = avatarEditorConfig.selected === option;

                          if (avatarEditorTab === "style") {
                            const styleOption = option as AvatarStyle;
                            return (
                              <button
                                key={optionKey}
                                type="button"
                                onClick={() => setAvatarStyleDraft(styleOption)}
                                className={`rounded-[18px] border-[3px] px-2 py-3 text-center transition sm:rounded-[22px] sm:px-4 sm:py-4 ${
                                  isSelected
                                    ? "border-sky-300 bg-sky-50 shadow-[0_12px_28px_rgba(56,189,248,0.16)]"
                                    : "border-slate-200 bg-white hover:border-sky-200 hover:bg-sky-50/60"
                                }`}
                              >
                                <div className="flex justify-center">
                                  <ProfileAvatar
                                    style={styleOption}
                                    bg={avatarBgDraft}
                                    accent={avatarAccentDraft}
                                    border={avatarBorderDraft}
                                    size="sm"
                                  />
                                </div>
                                <p className="mt-2 min-h-[1.75rem] px-1 text-[8px] font-semibold uppercase leading-[1.05] tracking-[0.02em] text-slate-800 sm:mt-3 sm:min-h-[2rem] sm:text-[10px] sm:font-bold">
                                  {formatAvatarOptionLabel(optionKey)}
                                </p>
                              </button>
                            );
                          }

                          const colorOption = option as AvatarColor;
                          const palette = AVATAR_COLOR_CLASSES[colorOption];

                          return (
                            <button
                              key={optionKey}
                              type="button"
                              onClick={() => {
                                if (avatarEditorTab === "background") {
                                  setAvatarBgDraft(colorOption);
                                } else if (avatarEditorTab === "icon") {
                                  setAvatarAccentDraft(colorOption);
                                } else {
                                  setAvatarBorderDraft(colorOption);
                                }
                              }}
                              className={`rounded-[18px] border-[3px] px-2 py-3 text-center transition sm:rounded-[22px] sm:px-4 sm:py-4 ${
                                isSelected
                                  ? `${palette.chip} shadow-[0_12px_28px_rgba(56,189,248,0.16)]`
                                  : "border-slate-200 bg-white hover:border-sky-200 hover:bg-sky-50/60"
                              }`}
                            >
                              <div className="flex justify-center">
                                <span
                                  className="inline-flex h-10 w-10 rounded-full border-[4px] shadow-[0_8px_18px_rgba(15,23,42,0.12)] sm:h-12 sm:w-12"
                                  style={{
                                    background:
                                      avatarEditorTab === "background"
                                        ? `linear-gradient(145deg, ${palette.borderSoft}, ${palette.borderHex})`
                                        : avatarEditorTab === "icon"
                                          ? `linear-gradient(145deg, ${palette.borderSoft}, #ffffff)`
                                          : `linear-gradient(145deg, ${palette.borderSoft}, ${palette.borderHex})`,
                                    borderColor:
                                      avatarEditorTab === "border"
                                        ? palette.borderHex
                                        : palette.borderSoft,
                                  }}
                                >
                                  <span
                                    className={`m-auto inline-flex h-6 w-6 rounded-full sm:h-7 sm:w-7 ${
                                      avatarEditorTab === "background"
                                        ? `bg-gradient-to-br ${palette.bg}`
                                        : `bg-gradient-to-br ${AVATAR_COLOR_CLASSES[avatarBgDraft].bg}`
                                    }`}
                                  >
                                    <span
                                      className="m-auto h-2.5 w-2.5 rounded-full sm:h-3 sm:w-3"
                                      style={{
                                        backgroundColor:
                                          avatarEditorTab === "icon"
                                            ? palette.iconHex
                                            : AVATAR_COLOR_CLASSES[avatarAccentDraft].iconHex,
                                      }}
                                    />
                                  </span>
                                </span>
                              </div>
                              <p className="mt-2 min-h-[1.75rem] px-1 text-[8px] font-semibold uppercase leading-[1.05] tracking-[0.02em] text-slate-800 sm:mt-3 sm:min-h-[2rem] sm:text-[10px] sm:font-bold">
                                {formatAvatarOptionLabel(optionKey)}
                              </p>
                            </button>
                          );
                        })}
                      </div>

                      {avatarOptionPageCount > 1 ? (
                        <div className="mt-4 flex justify-center">
                          <div className="inline-flex items-center gap-1 rounded-full border border-sky-200 bg-sky-50 px-1 py-1">
                            <button
                              type="button"
                              onClick={() => setAvatarOptionPage((current) => Math.max(0, current - 1))}
                              disabled={avatarOptionPage === 0}
                              className="rounded-full px-2 py-1 text-[10px] font-black uppercase tracking-[0.08em] text-sky-700 disabled:opacity-35"
                            >
                              Prev
                            </button>
                            <span className="text-[10px] font-black uppercase tracking-[0.08em] text-sky-700">
                              {avatarOptionPage + 1}/{avatarOptionPageCount}
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                setAvatarOptionPage((current) =>
                                  Math.min(avatarOptionPageCount - 1, current + 1)
                                )
                              }
                              disabled={avatarOptionPage >= avatarOptionPageCount - 1}
                              className="rounded-full px-2 py-1 text-[10px] font-black uppercase tracking-[0.08em] text-sky-700 disabled:opacity-35"
                            >
                              Next
                            </button>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
                </div>

                {(avatarError || badgeError) && (
                  <div className="mt-5 rounded-[18px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-900">
                    {avatarError ?? badgeError}
                  </div>
                )}

                <div className="mt-6 flex flex-col items-start gap-3">
                  <button
                    type="button"
                    onClick={() => void handleSaveProfile()}
                    disabled={avatarSaving || badgeSaving}
                    className="rounded-2xl border-[3px] border-sky-300 bg-[linear-gradient(180deg,#7dd3fc_0%,#38bdf8_52%,#0ea5e9_100%)] px-5 py-3 text-sm font-bold text-white shadow-[0_10px_0_rgba(56,189,248,0.18),0_14px_28px_rgba(56,189,248,0.24)] transition hover:-translate-y-0.5 hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {avatarSaving || badgeSaving ? "Saving..." : "Save Profile"}
                  </button>
                  <button
                    type="button"
                    onClick={() => void signOut({ redirect: false })}
                    className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.08em] text-slate-500 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-700"
                  >
                    Sign Out
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {publicProfileOpen && (
          <div className="fixed inset-0 z-[106] overflow-y-auto bg-slate-950/40 px-4 py-6">
            <div className="flex min-h-full items-center justify-center">
              <div className="w-full max-w-3xl rounded-[30px] border-[4px] border-sky-200 bg-[linear-gradient(180deg,#ffffff_0%,#f0f9ff_100%)] p-5 shadow-[0_14px_34px_rgba(15,23,42,0.16)] md:p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.12em] text-sky-700">
                      Player Profile
                    </p>
                    <p className="mt-2 text-sm font-semibold text-slate-600">
                      Public avatar, badges, and stats
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPublicProfileOpen(false)}
                    className="rounded-full border-[3px] border-sky-200 bg-white px-3 py-1 text-xs font-black uppercase tracking-[0.08em] text-sky-700"
                  >
                    Close
                  </button>
                </div>

                {publicProfileError ? (
                  <div className="mt-5 rounded-[18px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-900">
                    {publicProfileError}
                  </div>
                ) : publicProfileLoading || !publicProfile ? (
                  <div className="mt-5 rounded-[20px] border-[3px] border-sky-100 bg-white/90 px-4 py-8 text-center text-sm font-semibold text-slate-600">
                    Loading profile...
                  </div>
                ) : (
                  <div className="mt-6 space-y-6">
                    <div className="rounded-[28px] border-[3px] border-sky-100 bg-white/90 p-5">
                      <div className="grid gap-5 md:grid-cols-[240px_1fr]">
                        <div className="flex items-center gap-4">
                          <ProfileAvatar
                            style={publicProfile.avatar_style}
                            bg={publicProfile.avatar_bg}
                            accent={publicProfile.avatar_accent}
                            border={publicProfile.avatar_border}
                            size="lg"
                          />
                          <div>
                            <p className="text-xl font-black text-slate-900">
                              {publicProfile.username}
                            </p>
                            <p className="mt-2 text-[10px] font-black uppercase tracking-[0.08em] text-sky-700">
                              Joined {formatProfileCreatedDate(publicProfile.created_at)}
                            </p>
                          </div>
                        </div>
                        <div className="space-y-3">
                          {publicFeaturedBadgeSlots.some(Boolean) ? (
                            publicFeaturedBadgeSlots.map((badge, index) => (
                              <FeaturedBadgeSlot
                                key={badge?.badgeKey ?? `public-empty-${index}`}
                                badge={badge}
                                active={activePublicFeaturedBadgeKey === badge?.badgeKey}
                                onToggle={() =>
                                  setActivePublicFeaturedBadgeKey((current) =>
                                    current === badge?.badgeKey ? null : (badge?.badgeKey ?? null)
                                  )
                                }
                              />
                            ))
                          ) : (
                            <div className="rounded-[18px] border-[3px] border-dashed border-sky-200 bg-sky-50/60 px-4 py-4 text-left">
                              <p className="text-[10px] font-black uppercase tracking-[0.08em] text-sky-600">
                                No Featured Badges
                              </p>
                              <p className="mt-1 text-sm font-semibold text-slate-500">
                                This player has not featured any badges yet.
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="grid gap-6 md:grid-cols-[240px_1fr]">
                      <div className="space-y-4">
                        <div className="rounded-[26px] border-[3px] border-sky-100 bg-white/90 p-4">
                          <p className="text-[10px] font-black uppercase tracking-[0.1em] text-sky-700">
                            Stats
                          </p>
                          <div className="mt-4 grid gap-2">
                            <div className="rounded-[16px] border border-sky-100 bg-sky-50/70 px-3 py-2.5 text-center">
                              <p className="text-[9px] font-black uppercase leading-tight tracking-[0.05em] text-sky-700">
                                Puzzles Submitted
                              </p>
                              <p className="mt-1 text-xl font-black text-slate-900">
                                {publicProfile.stats.puzzles_submitted}
                              </p>
                            </div>
                            <div className="rounded-[16px] border border-sky-100 bg-sky-50/70 px-3 py-2.5 text-center">
                              <p className="text-[9px] font-black uppercase leading-tight tracking-[0.05em] text-sky-700">
                                Leaderboards Made
                              </p>
                              <p className="mt-1 text-xl font-black text-slate-900">
                                {publicProfile.stats.leaderboard_finishes}
                              </p>
                            </div>
                            <div className="rounded-[16px] border border-sky-100 bg-sky-50/70 px-3 py-2.5 text-center">
                              <p className="text-[9px] font-black uppercase leading-tight tracking-[0.05em] text-sky-700">
                                Links Created
                              </p>
                              <p className="mt-1 text-xl font-black text-slate-900">
                                {publicProfile.stats.links_created}
                              </p>
                            </div>
                          </div>
                        </div>
                        <div className="rounded-[26px] border-[3px] border-sky-100 bg-white/90 p-4">
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <p className="text-[10px] font-black uppercase tracking-[0.1em] text-sky-700">
                                Recent Runs
                              </p>
                              <p className="mt-1 text-sm font-semibold text-slate-600">
                                Latest locked lineups from this profile.
                              </p>
                            </div>
                            <span className="rounded-full bg-sky-100 px-2 py-1 text-[10px] font-black uppercase tracking-[0.08em] text-sky-700">
                              {publicProfile.recent_submissions.length}
                            </span>
                          </div>
                          <div className="mt-4">
                            <RecentSubmissionList
                              submissions={publicProfile.recent_submissions}
                              emptyMessage="No saved puzzle history yet."
                            />
                          </div>
                        </div>
                      </div>

                      <div className="space-y-5">
                        <div className="rounded-[26px] border-[3px] border-sky-100 bg-white/90 p-4">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                              <p className="text-[10px] font-black uppercase tracking-[0.1em] text-sky-700">
                                Earned Badges
                              </p>
                              <p className="mt-1 text-sm font-semibold text-slate-600">
                                Public profile achievements earned through play.
                              </p>
                            </div>
                            <span className="rounded-full bg-sky-100 px-2 py-1 text-[10px] font-black uppercase tracking-[0.08em] text-sky-700">
                              {publicProfile.badges.length}
                            </span>
                          </div>
                          <div className="mt-4 grid gap-3 md:grid-cols-2">
                            {publicProfile.badges.length > 0 ? (
                              publicProfile.badges.map((badge) => (
                                <ProfileBadgeCard key={`public-${badge.badgeKey}`} badge={badge} />
                              ))
                            ) : (
                              <div className="rounded-[18px] border-[3px] border-sky-100 bg-white/85 px-4 py-6 text-center text-sm font-semibold text-slate-600 md:col-span-2">
                                No earned badges yet.
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {leaderboardOpen && (
          <div className="fixed inset-0 z-[100] overflow-y-auto bg-slate-950/35 px-4 py-6">
            <div className="flex min-h-full items-start justify-center">
              <div className="relative w-full max-w-lg rounded-[30px] border-[4px] border-amber-200 bg-[linear-gradient(180deg,#ffffff_0%,#fffbeb_100%)] p-5 shadow-[0_14px_34px_rgba(15,23,42,0.16)] md:p-6">
                <div className="mb-2 pr-12">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.12em] text-amber-700">
                      Leaderboard
                    </p>
                    <h2
                      className="mt-2 text-xl font-black leading-tight tracking-normal text-amber-900 sm:text-2xl"
                      style={{ fontFamily: "var(--font-body), Arial, Helvetica, sans-serif" }}
                    >
                      {leaderboardHeading}
                    </h2>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <DataStateBadge
                        finalized={
                          leaderboardView === "today" ? leaderboardFinalized : true
                        }
                        compact
                      />
                      {leaderboardRefreshLabel ? (
                        <span className="inline-flex items-center rounded-full border border-amber-100 bg-white/90 px-3 py-1 text-[10px] font-black uppercase tracking-[0.08em] text-slate-500">
                          {leaderboardRefreshLabel}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setLeaderboardOpen(false)}
                  className="absolute right-5 top-5 inline-flex h-9 w-9 items-center justify-center rounded-full border-[3px] border-amber-200 bg-white text-lg font-black leading-none text-amber-700 shadow-[0_8px_18px_rgba(245,158,11,0.12)]"
                  aria-label="Close leaderboard"
                >
                  ×
                </button>

                {showFriendsLeaderboardScope ? (
                  <div className="mt-4 flex justify-center">
                    <div className="inline-flex max-w-full flex-nowrap rounded-full border-[3px] border-sky-200 bg-[linear-gradient(180deg,#f8fdff_0%,#e0f2fe_100%)] p-1 shadow-[0_8px_20px_rgba(56,189,248,0.16)]">
                      <button
                        type="button"
                        onClick={() => setLeaderboardScope("all")}
                        className={`rounded-full px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.06em] transition sm:px-4 sm:text-[11px] sm:tracking-[0.08em] ${
                          leaderboardScope === "all"
                            ? "bg-[linear-gradient(180deg,#60a5fa_0%,#2563eb_100%)] text-white shadow-[0_6px_14px_rgba(37,99,235,0.24)]"
                            : "text-sky-700"
                        }`}
                      >
                        All Players
                      </button>
                      <button
                        type="button"
                        onClick={() => setLeaderboardScope("friends")}
                        className={`rounded-full px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.06em] transition sm:px-4 sm:text-[11px] sm:tracking-[0.08em] ${
                          leaderboardScope === "friends"
                            ? "bg-[linear-gradient(180deg,#60a5fa_0%,#2563eb_100%)] text-white shadow-[0_6px_14px_rgba(37,99,235,0.24)]"
                            : "text-sky-700"
                        }`}
                      >
                        Friends
                      </button>
                    </div>
                  </div>
                ) : null}
                <div className="mt-3 inline-flex max-w-full flex-nowrap rounded-full border-[3px] border-amber-200 bg-white p-1 shadow-[0_8px_20px_rgba(245,158,11,0.12)]">
                  <button
                    type="button"
                    onClick={() => setLeaderboardView("today")}
                    className={`rounded-full px-3 py-2 text-[10px] font-black uppercase tracking-[0.06em] transition sm:px-4 sm:text-[11px] sm:tracking-[0.08em] ${
                      leaderboardView === "today"
                        ? "bg-[linear-gradient(180deg,#f59e0b_0%,#d97706_100%)] text-white shadow-[0_6px_14px_rgba(217,119,6,0.24)]"
                        : "text-amber-700"
                    }`}
                  >
                    Today&apos;s Puzzle
                  </button>
                  <button
                    type="button"
                    onClick={() => setLeaderboardView("yesterday")}
                    className={`rounded-full px-3 py-2 text-[10px] font-black uppercase tracking-[0.06em] transition sm:px-4 sm:text-[11px] sm:tracking-[0.08em] ${
                      leaderboardView === "yesterday"
                        ? "bg-[linear-gradient(180deg,#f59e0b_0%,#d97706_100%)] text-white shadow-[0_6px_14px_rgba(217,119,6,0.24)]"
                        : "text-amber-700"
                    }`}
                  >
                    Yesterday
                  </button>
                  <button
                    type="button"
                    onClick={() => setLeaderboardView("all-time")}
                    className={`rounded-full px-3 py-2 text-[10px] font-black uppercase tracking-[0.06em] transition sm:px-4 sm:text-[11px] sm:tracking-[0.08em] ${
                      leaderboardView === "all-time"
                        ? "bg-[linear-gradient(180deg,#f59e0b_0%,#d97706_100%)] text-white shadow-[0_6px_14px_rgba(217,119,6,0.24)]"
                        : "text-amber-700"
                    }`}
                  >
                    All Time
                  </button>
                </div>

                <div className="mt-5 max-h-[70vh] overflow-y-auto pr-1">
                  {leaderboardView === "today" ? leaderboardError ? (
                    <div className="rounded-[18px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
                      {leaderboardError}
                    </div>
                  ) : leaderboardLoading && leaderboard.length === 0 ? (
                    <div className="rounded-[18px] border-[3px] border-amber-100 bg-white/85 px-4 py-6 text-center text-sm font-semibold text-slate-600">
                      Loading leaderboard...
                    </div>
                  ) : leaderboard.length > 0 ? (
                    <div className="space-y-3">
                      {leaderboard.map((entry, index) => (
                        <button
                          type="button"
                          key={entry.submission_id}
                          onClick={() => void openPublicProfile(entry.user_id)}
                          className="flex w-full flex-col items-start gap-2 rounded-[18px] border-[3px] border-amber-100 bg-white/90 px-3 py-3 text-left transition hover:-translate-y-0.5 hover:border-amber-200 hover:shadow-[0_12px_28px_rgba(245,158,11,0.12)] sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-4"
                        >
                          <div className="min-w-0 w-full sm:w-auto">
                            <p className="text-[10px] font-black uppercase tracking-[0.08em] text-amber-700">
                              #{index + 1}
                            </p>
                            <p className="mt-1 truncate text-sm font-bold text-slate-900">
                              {entry.display_name}
                            </p>
                            <LeaderboardBadgeIcons badgeKeys={entry.featured_badges} />
                          </div>
                          <div className="w-full shrink-0 text-left sm:w-auto sm:text-right">
                            <p className="text-[10px] font-black uppercase tracking-[0.08em] text-slate-500">
                              Total Points
                            </p>
                            <p className="mt-1 text-base font-black text-amber-700 sm:text-lg">
                              {Number(entry.final_score).toLocaleString(undefined, {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}
                            </p>
                          </div>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-[18px] border-[3px] border-amber-100 bg-white/85 px-4 py-6 text-center text-sm font-semibold text-slate-600">
                      {currentLeaderboardEmptyMessage}
                    </div>
                  ) : leaderboardView === "yesterday" ? homeRecapLoading ? (
                    <div className="rounded-[18px] border-[3px] border-amber-100 bg-white/85 px-4 py-6 text-center text-sm font-semibold text-slate-600">
                      Loading yesterday&apos;s leaderboard...
                    </div>
                  ) : filteredYesterdayWinners.length > 0 ? (
                    <div className="space-y-3">
                      {filteredYesterdayWinners.map((entry) => (
                        <button
                          type="button"
                          key={`${entry.user_id}-${entry.placement}`}
                          onClick={() => void openPublicProfile(entry.user_id)}
                          className="flex w-full flex-col items-start gap-2 rounded-[18px] border-[3px] border-amber-100 bg-white/90 px-3 py-3 text-left transition hover:-translate-y-0.5 hover:border-amber-200 hover:shadow-[0_12px_28px_rgba(245,158,11,0.12)] sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-4"
                        >
                          <div className="min-w-0 w-full sm:w-auto">
                            <p className="text-[10px] font-black uppercase tracking-[0.08em] text-amber-700">
                              #{entry.placement}
                            </p>
                            <p className="mt-1 truncate text-sm font-bold text-slate-900">
                              {entry.display_name}
                            </p>
                            <LeaderboardBadgeIcons badgeKeys={entry.featured_badges ?? []} />
                          </div>
                          <div className="w-full shrink-0 text-left sm:w-auto sm:text-right">
                            <p className="text-[10px] font-black uppercase tracking-[0.08em] text-slate-500">
                              Total Points
                            </p>
                            <p className="mt-1 text-base font-black text-amber-700 sm:text-lg">
                              {Number(entry.final_score).toLocaleString(undefined, {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}
                            </p>
                          </div>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-[18px] border-[3px] border-amber-100 bg-white/85 px-4 py-6 text-center text-sm font-semibold text-slate-600">
                      {currentLeaderboardEmptyMessage}
                    </div>
                  ) : allTimeLeaderboardError ? (
                    <div className="rounded-[18px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
                      {allTimeLeaderboardError}
                    </div>
                  ) : allTimeLeaderboardLoading && allTimeLeaderboard.length === 0 ? (
                    <div className="rounded-[18px] border-[3px] border-amber-100 bg-white/85 px-4 py-6 text-center text-sm font-semibold text-slate-600">
                      Loading all-time leaderboard...
                    </div>
                  ) : allTimeLeaderboard.length > 0 ? (
                    <div className="space-y-3">
                      {allTimeLeaderboard.map((entry, index) => (
                        <button
                          type="button"
                          key={entry.user_id}
                          onClick={() => void openPublicProfile(entry.user_id)}
                          className="flex w-full flex-col items-start gap-2 rounded-[18px] border-[3px] border-amber-100 bg-white/90 px-3 py-3 text-left transition hover:-translate-y-0.5 hover:border-amber-200 hover:shadow-[0_12px_28px_rgba(245,158,11,0.12)] sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-4"
                        >
                          <div className="min-w-0 w-full sm:w-auto">
                            <p className="text-[10px] font-black uppercase tracking-[0.08em] text-amber-700">
                              #{index + 1}
                            </p>
                            <p className="mt-1 truncate text-sm font-bold text-slate-900">
                              {entry.display_name}
                            </p>
                            <LeaderboardBadgeIcons badgeKeys={entry.featured_badges} />
                            <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.06em] text-amber-700/80">
                              Best finish #{entry.best_finish}
                            </p>
                          </div>
                          <div className="w-full shrink-0 text-left sm:w-auto sm:text-right">
                            <p className="text-[10px] font-black uppercase tracking-[0.08em] text-slate-500">
                              Top 10s
                            </p>
                            <p className="mt-1 text-base font-black text-amber-700 sm:text-lg">
                              {entry.top_10_finishes.toLocaleString()}
                            </p>
                          </div>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-[18px] border-[3px] border-amber-100 bg-white/85 px-4 py-6 text-center text-sm font-semibold text-slate-600">
                      {currentLeaderboardEmptyMessage}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {rulesOpen && (
          <div className="fixed inset-0 z-[100] overflow-y-auto bg-slate-950/35 px-4 py-6">
            <div className="flex min-h-full items-start justify-center">
              <div className="w-full max-w-xl rounded-[30px] border-[4px] border-sky-200 bg-[linear-gradient(180deg,#ffffff_0%,#f0f9ff_100%)] p-5 shadow-[0_14px_34px_rgba(15,23,42,0.16)] md:p-6">
              <div className="sticky top-0 z-10 -mx-1 -mt-1 mb-2 flex items-start justify-between gap-4 bg-[linear-gradient(180deg,#ffffff_0%,#f0f9ff_100%)] px-1 pt-1">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.12em] text-sky-700">
                    Rules
                  </p>
                  <h2
                    className="mt-2 text-2xl font-black tracking-normal text-sky-900"
                    style={{ fontFamily: "var(--font-body), Arial, Helvetica, sans-serif" }}
                  >
                    How This Puzzle Works
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setRulesOpen(false)}
                  className="rounded-full border-[3px] border-sky-200 bg-white px-3 py-1 text-xs font-black uppercase tracking-[0.08em] text-sky-700"
                >
                  Close
                </button>
              </div>

              <div className="mt-5 max-h-[70vh] overflow-y-auto pr-1 space-y-4 text-sm text-slate-700">
                <p>
                  <span className="font-bold text-sky-900">Sport:</span>{" "}
                  {puzzleData.puzzle.sport.toUpperCase()}
                </p>
                <p>
                  <span className="font-bold text-sky-900">Objective:</span>{" "}
                  Fill all 5 lineup slots with different players who satisfy the puzzle rules, then maximize your final score by balancing high fantasy totals with strong connectivity between the players you picked.
                </p>
                <p>
                  <span className="font-bold text-sky-900">Time Period:</span>{" "}
                  {puzzleData.theme?.display_name ?? "N/A"} is the scoring window for this puzzle. A player&apos;s fantasy total only comes from games and seasons that fall inside that exact time period.
                </p>
                <p>
                  Time periods can be a single season, a span of seasons, or a themed era like <span className="font-semibold text-sky-900">2012</span>, <span className="font-semibold text-sky-900">2010s</span>, or <span className="font-semibold text-sky-900">2020-2025</span>. If a player was great outside that window, those outside stats do not count here.
                </p>
                <p>
                  <span className="font-bold text-sky-900">Slot Rules:</span>{" "}
                  Each slot has its own filter. That could be a position like <span className="font-semibold text-sky-900">QB</span> or <span className="font-semibold text-sky-900">WR</span>, a team requirement, a draft rule, a division or conference rule, or another career qualifier. A player is only eligible for a slot if they match that slot&apos;s rule.
                </p>
                <p>
                  You cannot use the same player twice in one lineup. Every valid lineup must contain five unique players.
                </p>
                <p>
                  <span className="font-bold text-sky-900">Links:</span>{" "}
                  {relationshipLabel} is the connection rule being tested between every pair of selected players. With 5 players there are 10 possible pairings, and each valid pairing becomes an active link.
                </p>
                <p>
                  Links are not just cosmetic. They build your multiplier. The more active links you create, the larger your bonus becomes, and the curve rewards deep, well-connected lineups more than random one-off connections.
                </p>
                <p>
                  <span className="font-bold text-sky-900">Scoring Formula:</span>{" "}
                  Final Score = Base Fantasy Points x Link Multiplier.
                </p>
                <p>
                  <span className="font-bold text-sky-900">Base Score:</span>{" "}
                  Add together the fantasy points from your 5 selected players during the active time period.
                </p>
                <p>
                  Those fantasy points are based on each player&apos;s actual fantasy production inside the puzzle window, using the season totals stored for this project. In other words, every player first brings a raw point total from the selected era, and only after that does the link multiplier boost the lineup.
                </p>
                <p>
                  <span className="font-bold text-sky-900">Multiplier:</span>{" "}
                  The multiplier is based on your active links. Each active link adds a clean <span className="font-semibold text-sky-900">+10%</span> to your base score, so a fully connected 10-link lineup reaches <span className="font-semibold text-sky-900">2.00x</span>.
                </p>
                <p>
                  Example: with the current curve, {activeLinkCount} active links gives you a{" "}
                  <span className="font-semibold text-sky-900">{multiplier.toFixed(2)}x</span> multiplier and a{" "}
                  <span className="font-semibold text-sky-900">+{linkBonusPct.toFixed(1)}%</span> total bonus.
                </p>
                <p>
                  <span className="font-bold text-sky-900">Available Players:</span>{" "}
                  {players.length} players match today&apos;s overall theme and can appear across the five slot filters.
                </p>
                <p>
                  <span className="font-bold text-sky-900">Submission Rules:</span>{" "}
                  You can only submit when all 5 slots are filled with valid, unique players. Guest browsers get one submission per date per browser. Signed-in accounts get one submission per date per account.
                </p>
                <p>
                  Once a lineup is submitted, that entry is locked for leaderboard purposes. You can still inspect the puzzle, compare scores, and review the live leaderboard after submitting, but you do not get another official entry for that date.
                </p>
                <p>
                  The current first-place lineup can still be viewed after you submit, but the true optimal lineup stays hidden until the leaderboard and badge snapshot are finalized for that puzzle date.
                </p>
                <p>
                  <span className="font-bold text-sky-900">Leaderboard:</span>{" "}
                  The live leaderboard is account-based. Registered users can track their finishes, badges, and profile stats across days.
                </p>
                <p>
                  Daily leaderboard badges are based on the finalized end-of-day top 10 for that puzzle date. The board can move during the day, but the official top-10 award is determined from the finished daily snapshot.
                </p>
                <p>
                  <span className="font-bold text-sky-900">Date Access:</span>{" "}
                  You can replay older puzzles, but future puzzle dates are hidden until their day arrives.
                </p>
                <p>
                  The core strategy is to find players who are both individually strong in the scoring window and tightly connected under the current link rule. Great lineups usually need both.
                </p>
              </div>
            </div>
            </div>
          </div>
        )}

        {!isBoardLocked && !rulesOpen && (
          <div className="pointer-events-none fixed bottom-[max(0.75rem,env(safe-area-inset-bottom))] left-1/2 z-[90] w-[min(78vw,16rem)] -translate-x-1/2 sm:hidden">
            {mobileNavigatorOpen ? (
              <div className="pointer-events-auto flex w-full items-center gap-2 rounded-[20px] border-[2px] border-sky-200 bg-white/95 px-2 py-1.5 shadow-[0_16px_36px_rgba(125,211,252,0.22)] backdrop-blur-md">
                <button
                  type="button"
                  onClick={() => focusRelativeNode(-1)}
                  disabled={submitted}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-[2px] border-sky-200 bg-[linear-gradient(180deg,#ffffff_0%,#eff6ff_100%)] text-sky-700 transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
                  aria-label="Go to previous slot"
                >
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 24 24"
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M15 5l-7 7 7 7" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={() => focusNode(activeNodeId, true)}
                  disabled={submitted}
                  className="min-w-0 flex-1 rounded-[14px] border-[2px] border-sky-100 bg-[linear-gradient(180deg,#ffffff_0%,#eff6ff_100%)] px-2 py-1.5 text-center active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <p className="text-[8px] font-black uppercase tracking-[0.06em] text-sky-600">
                    Type Here
                  </p>
                  <p className="mt-0.5 truncate font-[family-name:var(--font-display)] text-[12px] text-sky-900">
                    {activeSlotRule.display_text}
                  </p>
                </button>
                <button
                  type="button"
                  onClick={() => focusRelativeNode(1)}
                  disabled={submitted}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-[2px] border-sky-200 bg-[linear-gradient(180deg,#ffffff_0%,#eff6ff_100%)] text-sky-700 transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
                  aria-label="Go to next slot"
                >
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 24 24"
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M9 5l7 7-7 7" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={() => setMobileNavigatorOpen(false)}
                  className="flex h-8 shrink-0 items-center justify-center px-1 text-sky-600 transition active:scale-95"
                  aria-label="Collapse navigator"
                >
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 24 24"
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                </button>
              </div>
            ) : (
              <div className="pointer-events-auto flex justify-center">
                <button
                  type="button"
                  onClick={() => setMobileNavigatorOpen(true)}
                  className="inline-flex items-center gap-2 rounded-full border-[2px] border-sky-200 bg-white/95 px-3 py-2 text-sky-700 shadow-[0_16px_36px_rgba(125,211,252,0.22)] backdrop-blur-md transition active:scale-95"
                  aria-label="Expand navigator"
                >
                  <span className="text-[8px] font-black uppercase tracking-[0.08em] text-sky-600">
                    Navigate
                  </span>
                  <span className="truncate font-[family-name:var(--font-display)] text-[11px] text-sky-900">
                    {activeSlotRule.display_text}
                  </span>
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 24 24"
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M6 15l6-6 6 6" />
                  </svg>
                </button>
              </div>
            )}
          </div>
        )}
        {isAdmin && (
          <div className="fixed bottom-[max(0.75rem,env(safe-area-inset-bottom))] left-4 z-[120] hidden md:block">
            <div className="flex items-center gap-1 rounded-full border-[2px] border-sky-100 bg-white/95 p-1 shadow-[0_16px_36px_rgba(125,211,252,0.22)] backdrop-blur-md">
              <Link
                href="/"
                className={`rounded-full px-3 py-2 text-[10px] font-black uppercase tracking-[0.12em] ${
                  pathname === "/"
                    ? "bg-sky-300 text-slate-950"
                    : "text-sky-700"
                }`}
              >
                Production
              </Link>
              <Link
                href="/dev"
                className={`rounded-full px-3 py-2 text-[10px] font-black uppercase tracking-[0.12em] ${
                  pathname === "/dev"
                    ? "bg-sky-300 text-slate-950"
                    : "text-sky-700"
                }`}
              >
                Dev
              </Link>
              <Link
                href="/testing"
                className={`rounded-full px-3 py-2 text-[10px] font-black uppercase tracking-[0.12em] ${
                  pathname === "/testing"
                    ? "bg-sky-300 text-slate-950"
                    : "text-sky-700"
                }`}
              >
                Testing
              </Link>
            </div>
          </div>
        )}
      </div>
      <style jsx>{`
        .full-link-confetti {
          animation: full-link-burst 1.15s ease-out infinite;
          transform: translate(-50%, -50%);
        }

        .badge-celebration-shell {
          position: relative;
          overflow: hidden;
        }

        .badge-celebration-shell::before {
          content: "";
          position: absolute;
          inset: -30%;
          background: radial-gradient(circle, rgba(16, 185, 129, 0.12), transparent 55%);
          animation: badge-shell-pulse 2.8s ease-in-out infinite;
          pointer-events: none;
        }

        .badge-reveal-card {
          position: relative;
          animation: badge-reveal-rise 560ms cubic-bezier(0.22, 1, 0.36, 1) both;
        }

        .badge-reveal-card::after {
          content: "";
          position: absolute;
          inset: -8px;
          border-radius: 28px;
          background: radial-gradient(circle, rgba(52, 211, 153, 0.18), transparent 62%);
          filter: blur(16px);
          opacity: 0;
          animation: badge-reveal-glow 900ms ease-out both;
          animation-delay: inherit;
          pointer-events: none;
        }

        @keyframes full-link-burst {
          0% {
            opacity: 0;
            transform: translate(-50%, -50%) scale(0.7) rotate(0deg);
          }
          12% {
            opacity: 1;
          }
          100% {
            opacity: 0;
            transform: translate(
                calc(-50% + var(--burst-x)),
                calc(-50% + var(--burst-y))
              )
              scale(1.15) rotate(var(--burst-rotate));
          }
        }

        @keyframes badge-reveal-rise {
          0% {
            opacity: 0;
            transform: translateY(18px) scale(0.96);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        @keyframes badge-reveal-glow {
          0% {
            opacity: 0;
            transform: scale(0.92);
          }
          35% {
            opacity: 1;
          }
          100% {
            opacity: 0;
            transform: scale(1.08);
          }
        }

        @keyframes badge-shell-pulse {
          0%,
          100% {
            opacity: 0.65;
            transform: scale(1);
          }
          50% {
            opacity: 1;
            transform: scale(1.04);
          }
        }

      `}</style>
    </main>
  );
}

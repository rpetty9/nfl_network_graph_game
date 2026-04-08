import type { Pool, PoolClient } from "pg";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { getLinkMultiplier } from "./scoring";
import { canonicalTeamAbbrSql, teamAbbrMatches } from "./team-abbr";
import {
  lineupSatisfiesPuzzleRules,
  partialLineupCanStillSatisfyPuzzleRules,
  playerAllowedByPuzzleRules,
} from "./puzzle-rules";

type DbClient = Pool | PoolClient;

export type SlotRule = {
  slot_number: number;
  slot_rule_id: string | number;
  rule_name: string;
  parameter_type: string;
  parameter_value: string | null;
  display_text: string;
};

type CandidatePlayer = {
  player_id: string;
  player_name: string;
  primary_position: string | null;
  career_start_season: number | null;
  career_end_season: number | null;
  super_bowl_win_count?: number | null;
  theme_start_season: number | null;
  theme_end_season: number | null;
  fantasy_points: number;
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

export type DevPuzzleConfig = {
  title: string;
  startSeason: number;
  endSeason: number;
  relationshipRuleId: string | number;
  slotRuleIds: Array<string | number>;
  positionOverlayEnabled: boolean;
  qbExclusionEnabled: boolean;
};

export type PreviewPayload = {
  theme: {
    filter_id: string | number;
    filter_name: string;
    display_name: string;
    rule_logic_key: string;
  };
  relationship_rule: {
    relationship_rule_id: string | number;
    relationship_type: string;
    display_text: string;
    bonus_pct: number;
  };
  candidate_pool_summary: Array<{
    slot_number: number;
    display_text: string;
    parameter_type: string;
    candidate_count: number;
  }>;
  optimal_lineup: Array<{
    slot_number: number;
    slot_rule: SlotRule;
    player: CandidatePlayer;
    previous_optimal_usage_count: number;
  }>;
  optimal_base_score: number;
  optimal_active_links: number;
  optimal_multiplier: number;
  optimal_final_score: number;
  position_overlay_enabled: boolean;
  qb_exclusion_enabled: boolean;
};

export type DevPuzzleListItem = {
  puzzle_id: string;
  puzzle_date: string;
  title: string;
  theme_display_name: string;
  relationship_display_text: string | null;
  relationship_type: string | null;
  position_overlay_enabled: boolean;
  qb_exclusion_enabled: boolean;
  published_flag: boolean;
  future_editable: boolean;
};

export type DevPuzzleDetail = {
  puzzle: {
    puzzle_id: string;
    puzzle_date: string;
    title: string;
    sport: string;
    theme_display_name: string;
    theme_rule_logic_key: string;
    relationship_display_text: string | null;
    relationship_type: string | null;
    position_overlay_enabled: boolean;
    qb_exclusion_enabled: boolean;
    published_flag: boolean;
    future_editable: boolean;
    created_at: string;
  };
  slots: Array<{
    slot_number: number;
    display_text: string;
    parameter_type: string;
    parameter_value: string | null;
    rule_name: string;
  }>;
  submissions: {
    submission_count: number;
    entries: Array<{
      submission_id: string;
      user_id: string | null;
      username: string | null;
      display_name: string;
      submitted_at: string;
      final_score: number;
    }>;
  };
  cached_optimal: null | {
    computed_at: string;
    optimal_active_links: number | null;
    optimal_final_score: number | null;
    optimal_lineup: Array<{
      slot_number: number;
      slot_label: string;
      player_name: string;
      previous_optimal_usage_count: number;
    }>;
  };
};

export type DevDashboardStats = {
  total_users: number;
  users_created_today: number;
  total_puzzles: number;
  published_puzzles: number;
  total_submissions: number;
  submissions_today: number;
  todays_puzzle_submissions: number;
  todays_unique_submitters: number;
  leaderboard_finishes_awarded: number;
  next_open_date: string;
  user_trend: Array<{
    date: string;
    count: number;
  }>;
  submission_trend: Array<{
    date: string;
    count: number;
  }>;
  daily_puzzle_submission_trend: Array<{
    date: string;
    count: number;
  }>;
};

export type DevGeneratorSettings = {
  targetPendingCount: number;
  minActiveLinks: number;
  usageThresholdTotal: number;
  maxQbs: number;
  minFantasyPointsPerSeason: number;
  maxAttemptsPerPuzzle: number;
  forcePositionLock: boolean;
  forceNoQbs: boolean;
  useAnchorSearch: boolean;
  useSkeletonScoring: boolean;
  useThresholdMemory: boolean;
  anchorCount: number;
  stageWidth: number;
  beamWidth: number;
};

export type DevGeneratorJobStatus = {
  job_id: string;
  active_flag: boolean;
  settings: DevGeneratorSettings;
  last_status: string | null;
  last_error: string | null;
  last_run_at: string | null;
  updated_at: string | null;
  created_at: string | null;
};

type PreviewThresholdFailureReason =
  | "active_links"
  | "usage_total"
  | "max_qbs"
  | "impact_threshold";

type PreviewThresholdEvaluation = {
  passed: boolean;
  failureReason: PreviewThresholdFailureReason | null;
  usageTotal: number;
  qbCount: number;
  minimumFantasyPoints: number;
};

type SlotCandidateMetric = {
  candidate_count: number;
  top_fantasy_points: number;
};

export type DevPendingPuzzleListItem = DevPuzzleListItem & {
  optimal_active_links: number | null;
  optimal_final_score: number | null;
  usage_total: number;
  qb_count: number;
};

export type DevOptimizerLogEntry = {
  log_id: string;
  log_key: string | null;
  kind: string;
  title: string;
  detail: string;
  metadata: Record<string, unknown> | null;
  occurred_at: string;
  created_at: string;
};

type CachedOptimalLineupEntry = {
  slot_number?: number | string | null;
  slot_rule?: {
    display_text?: string | null;
  } | null;
  player?: {
    player_name?: string | null;
  } | null;
  previous_optimal_usage_count?: number | string | null;
};

type BestLineupResult = {
  lineup: Array<{
    slot_number: number;
    slot_rule: SlotRule;
    player: CandidatePlayer;
  }>;
  base_score: number;
  active_links: number;
  final_score: number;
};

type TrackerDayEntry = {
  puzzle_date: string;
  title: string;
  theme: string;
  link: string;
  optimal_players: Array<{
    slot_number: number;
    slot_rule: string;
    player_name: string;
    player_id: string;
    primary_position: string | null;
  }>;
};

const SLOT_LIMITS: Record<string, number> = {
  any: 18,
  position: 24,
  conference: 24,
  division: 22,
  team: 20,
  college: 18,
};

const COLLEGE_TYPE_PICK_RATE = 0.2;
const AUTO_THEME_RANGES = [
  { startSeason: 2021, endSeason: 2021 },
  { startSeason: 2022, endSeason: 2022 },
  { startSeason: 2023, endSeason: 2023 },
  { startSeason: 2024, endSeason: 2024 },
  { startSeason: 2025, endSeason: 2025 },
  { startSeason: 2000, endSeason: 2005 },
  { startSeason: 2006, endSeason: 2010 },
  { startSeason: 2011, endSeason: 2015 },
  { startSeason: 2016, endSeason: 2020 },
  { startSeason: 2021, endSeason: 2025 },
  { startSeason: 2000, endSeason: 2009 },
  { startSeason: 2010, endSeason: 2019 },
  { startSeason: 2020, endSeason: 2025 },
  { startSeason: 2010, endSeason: 2015 },
  { startSeason: 2015, endSeason: 2020 },
  { startSeason: 2020, endSeason: 2025 },
  { startSeason: 2000, endSeason: 2025 },
] as const;

const DEFAULT_GENERATOR_SETTINGS: DevGeneratorSettings = {
  targetPendingCount: 5,
  minActiveLinks: 7,
  usageThresholdTotal: 3,
  maxQbs: 2,
  minFantasyPointsPerSeason: 50,
  maxAttemptsPerPuzzle: 150,
  forcePositionLock: false,
  forceNoQbs: false,
  useAnchorSearch: true,
  useSkeletonScoring: true,
  useThresholdMemory: true,
  anchorCount: 3,
  stageWidth: 6,
  beamWidth: 3,
};

const SEEDED_OPTIMIZER_MILESTONES = [
  {
    log_key: "milestone-search-space",
    occurred_at: "2026-03-18T09:00:00-05:00",
    kind: "milestone",
    title: "Search Space Framed",
    detail:
      "Measured the raw builder space at roughly 1.33 quadrillion puzzle shapes and the auto queue space at about 64.5 trillion.",
  },
  {
    log_key: "milestone-pruning",
    occurred_at: "2026-03-18T09:15:00-05:00",
    kind: "milestone",
    title: "Branch Pruning Tightened",
    detail:
      "The lineup solver now carries active-link counts through the search and cuts branches using a stronger optimistic upper bound.",
  },
  {
    log_key: "milestone-invalid-pool-memory",
    occurred_at: "2026-03-18T09:30:00-05:00",
    kind: "milestone",
    title: "Invalid Pool Memory Added",
    detail:
      "No-candidate slot and full-config failures are persisted so the optimizer can skip impossible shapes instead of relearning them.",
  },
  {
    log_key: "milestone-staged-anchor-search",
    occurred_at: "2026-03-18T09:45:00-05:00",
    kind: "milestone",
    title: "Staged Anchor Search Added",
    detail:
      "The generator now anchors part of the puzzle, mutates only the remaining slots, and searches the local neighborhood before fully rerolling.",
  },
  {
    log_key: "milestone-threshold-memory",
    occurred_at: "2026-03-18T10:00:00-05:00",
    kind: "milestone",
    title: "Threshold Memory Added",
    detail:
      "Exact configs that fail current min-link, usage, QB, or impact settings are cached so repeat attempts can be skipped faster.",
  },
  {
    log_key: "milestone-skeleton-ranking",
    occurred_at: "2026-03-18T10:15:00-05:00",
    kind: "milestone",
    title: "Skeleton Ranking Added",
    detail:
      "Staged slot skeletons are now scored before previewing so the optimizer spends more full solves on stronger candidates.",
  },
] as const;

export const SUPPORTED_SLOT_PARAMETER_TYPES = [
  "any",
  "position",
  "team",
  "conference",
  "division",
  "college",
] as const;

function getPairKey(playerId1: string, playerId2: string) {
  return [String(playerId1), String(playerId2)].sort().join("|");
}

export function sanitizeGeneratorSettings(
  value: Partial<DevGeneratorSettings> | null | undefined
): DevGeneratorSettings {
  return {
    targetPendingCount: Math.min(
      Math.max(Math.trunc(Number(value?.targetPendingCount ?? DEFAULT_GENERATOR_SETTINGS.targetPendingCount)) || DEFAULT_GENERATOR_SETTINGS.targetPendingCount, 1),
      30
    ),
    minActiveLinks: Math.min(
      Math.max(Math.trunc(Number(value?.minActiveLinks ?? DEFAULT_GENERATOR_SETTINGS.minActiveLinks)) || DEFAULT_GENERATOR_SETTINGS.minActiveLinks, 0),
      10
    ),
    usageThresholdTotal: Math.min(
      Math.max(Math.trunc(Number(value?.usageThresholdTotal ?? DEFAULT_GENERATOR_SETTINGS.usageThresholdTotal)) || DEFAULT_GENERATOR_SETTINGS.usageThresholdTotal, 0),
      50
    ),
    maxQbs: Math.min(
      Math.max(Math.trunc(Number(value?.maxQbs ?? DEFAULT_GENERATOR_SETTINGS.maxQbs)) || DEFAULT_GENERATOR_SETTINGS.maxQbs, 0),
      5
    ),
    minFantasyPointsPerSeason: Math.min(
      Math.max(
        Math.trunc(
          Number(
            value?.minFantasyPointsPerSeason ??
              DEFAULT_GENERATOR_SETTINGS.minFantasyPointsPerSeason
          )
        ) || DEFAULT_GENERATOR_SETTINGS.minFantasyPointsPerSeason,
        0
      ),
      500
    ),
    maxAttemptsPerPuzzle: Math.min(
      Math.max(
        Math.trunc(
          Number(value?.maxAttemptsPerPuzzle ?? DEFAULT_GENERATOR_SETTINGS.maxAttemptsPerPuzzle)
        ) || DEFAULT_GENERATOR_SETTINGS.maxAttemptsPerPuzzle,
        1
      ),
      1000
    ),
    forcePositionLock: Boolean(value?.forcePositionLock) && !Boolean(value?.forceNoQbs),
    forceNoQbs: Boolean(value?.forceNoQbs),
    useAnchorSearch:
      typeof value?.useAnchorSearch === "boolean"
        ? value.useAnchorSearch
        : DEFAULT_GENERATOR_SETTINGS.useAnchorSearch,
    useSkeletonScoring:
      typeof value?.useSkeletonScoring === "boolean"
        ? value.useSkeletonScoring
        : DEFAULT_GENERATOR_SETTINGS.useSkeletonScoring,
    useThresholdMemory:
      typeof value?.useThresholdMemory === "boolean"
        ? value.useThresholdMemory
        : DEFAULT_GENERATOR_SETTINGS.useThresholdMemory,
    anchorCount: Math.min(
      Math.max(
        Math.trunc(Number(value?.anchorCount ?? DEFAULT_GENERATOR_SETTINGS.anchorCount)) ||
          DEFAULT_GENERATOR_SETTINGS.anchorCount,
        1
      ),
      4
    ),
    stageWidth: Math.min(
      Math.max(
        Math.trunc(Number(value?.stageWidth ?? DEFAULT_GENERATOR_SETTINGS.stageWidth)) ||
          DEFAULT_GENERATOR_SETTINGS.stageWidth,
        1
      ),
      20
    ),
    beamWidth: Math.min(
      Math.max(
        Math.trunc(Number(value?.beamWidth ?? DEFAULT_GENERATOR_SETTINGS.beamWidth)) ||
          DEFAULT_GENERATOR_SETTINGS.beamWidth,
        1
      ),
      10
    ),
  };
}

async function ensureDevAutomationTables(db: DbClient) {
  await db.query(`
    CREATE TABLE IF NOT EXISTS dev_puzzle_generation_job (
      job_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      active_flag BOOLEAN NOT NULL DEFAULT false,
      settings JSONB NOT NULL DEFAULT '{}'::jsonb,
      last_status TEXT,
      last_error TEXT,
      last_run_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS dev_invalid_slot_candidate_cache (
      theme_rule_logic_key TEXT NOT NULL,
      slot_rule_id BIGINT NOT NULL,
      position_overlay_enabled BOOLEAN NOT NULL DEFAULT false,
      qb_exclusion_enabled BOOLEAN NOT NULL DEFAULT false,
      failure_count INTEGER NOT NULL DEFAULT 1,
      last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (
        theme_rule_logic_key,
        slot_rule_id,
        position_overlay_enabled,
        qb_exclusion_enabled
      )
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS dev_invalid_config_cache (
      theme_rule_logic_key TEXT NOT NULL,
      slot_signature TEXT NOT NULL,
      position_overlay_enabled BOOLEAN NOT NULL DEFAULT false,
      qb_exclusion_enabled BOOLEAN NOT NULL DEFAULT false,
      failure_reason TEXT NOT NULL DEFAULT 'no_candidate_pool',
      failure_count INTEGER NOT NULL DEFAULT 1,
      last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (
        theme_rule_logic_key,
        slot_signature,
        position_overlay_enabled,
        qb_exclusion_enabled,
        failure_reason
      )
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS dev_slot_candidate_metric_cache (
      theme_rule_logic_key TEXT NOT NULL,
      slot_rule_id BIGINT NOT NULL,
      position_overlay_enabled BOOLEAN NOT NULL DEFAULT false,
      qb_exclusion_enabled BOOLEAN NOT NULL DEFAULT false,
      candidate_count INTEGER NOT NULL DEFAULT 0,
      top_fantasy_points DOUBLE PRECISION NOT NULL DEFAULT 0,
      last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (
        theme_rule_logic_key,
        slot_rule_id,
        position_overlay_enabled,
        qb_exclusion_enabled
      )
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS dev_threshold_failure_cache (
      config_signature TEXT NOT NULL,
      min_active_links INTEGER NOT NULL,
      usage_threshold_total INTEGER NOT NULL,
      max_qbs INTEGER NOT NULL,
      min_points_per_season INTEGER NOT NULL,
      failure_reason TEXT NOT NULL,
      failure_count INTEGER NOT NULL DEFAULT 1,
      last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (
        config_signature,
        min_active_links,
        usage_threshold_total,
        max_qbs,
        min_points_per_season,
        failure_reason
      )
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS dev_optimizer_log (
      log_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      log_key TEXT UNIQUE,
      kind TEXT NOT NULL,
      title TEXT NOT NULL,
      detail TEXT NOT NULL,
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

async function ensureSeededOptimizerMilestones(db: DbClient) {
  await ensureDevAutomationTables(db);

  for (const milestone of SEEDED_OPTIMIZER_MILESTONES) {
    await db.query(
      `
      INSERT INTO dev_optimizer_log (
        log_key,
        kind,
        title,
        detail,
        metadata,
        occurred_at,
        created_at
      )
      VALUES ($1, $2, $3, $4, '{}'::jsonb, $5::timestamptz, NOW())
      ON CONFLICT (log_key)
      DO UPDATE SET
        kind = EXCLUDED.kind,
        title = EXCLUDED.title,
        detail = EXCLUDED.detail,
        occurred_at = EXCLUDED.occurred_at
      `,
      [
        milestone.log_key,
        milestone.kind,
        milestone.title,
        milestone.detail,
        milestone.occurred_at,
      ]
    );
  }
}

export async function listDevOptimizerLog(db: DbClient, options?: { limit?: number }) {
  await ensureSeededOptimizerMilestones(db);
  const limit = Math.max(1, Math.min(500, Math.trunc(options?.limit ?? 200) || 200));
  const result = await db.query(
    `
    SELECT
      log_id::text,
      log_key,
      kind,
      title,
      detail,
      metadata,
      occurred_at::text,
      created_at::text
    FROM dev_optimizer_log
    ORDER BY occurred_at DESC, log_id DESC
    LIMIT $1
    `,
    [limit]
  );

  return result.rows as DevOptimizerLogEntry[];
}

export async function appendDevOptimizerLog(
  db: DbClient,
  input: {
    logKey?: string | null;
    kind: string;
    title: string;
    detail: string;
    metadata?: Record<string, unknown> | null;
    occurredAt?: string | null;
  }
) {
  await ensureSeededOptimizerMilestones(db);

  const result = await db.query(
    `
    INSERT INTO dev_optimizer_log (
      log_key,
      kind,
      title,
      detail,
      metadata,
      occurred_at,
      created_at
    )
    VALUES (
      $1,
      $2,
      $3,
      $4,
      COALESCE($5::jsonb, '{}'::jsonb),
      COALESCE($6::timestamptz, NOW()),
      NOW()
    )
    ON CONFLICT (log_key)
    DO UPDATE SET
      kind = EXCLUDED.kind,
      title = EXCLUDED.title,
      detail = EXCLUDED.detail,
      metadata = EXCLUDED.metadata,
      occurred_at = EXCLUDED.occurred_at
    RETURNING
      log_id::text,
      log_key,
      kind,
      title,
      detail,
      metadata,
      occurred_at::text,
      created_at::text
    `,
    [
      input.logKey ?? null,
      input.kind,
      input.title,
      input.detail,
      input.metadata ? JSON.stringify(input.metadata) : null,
      input.occurredAt ?? null,
    ]
  );

  return result.rows[0] as DevOptimizerLogEntry;
}

function pickRandomItem<T>(items: T[]) {
  if (items.length === 0) return null;
  return items[Math.floor(Math.random() * items.length)] ?? null;
}

function pickWeightedRule<
  T extends {
    random_weight?: number | null;
  },
>(items: T[]) {
  const weightedItems = items.filter((item) => Number(item.random_weight ?? 0) > 0);
  if (weightedItems.length === 0) return null;
  const totalWeight = weightedItems.reduce(
    (sum, item) => sum + Number(item.random_weight ?? 0),
    0
  );
  let roll = Math.random() * totalWeight;
  for (const item of weightedItems) {
    roll -= Number(item.random_weight ?? 0);
    if (roll <= 0) {
      return item;
    }
  }
  return weightedItems[weightedItems.length - 1] ?? null;
}

function buildThemeLabel(startSeason: number, endSeason: number) {
  return startSeason === endSeason
    ? `${startSeason} Season`
    : `${startSeason}-${endSeason} Seasons`;
}

function buildSuggestedTitle(themeLabel: string, relationshipLabel: string | null | undefined) {
  return `${themeLabel} ${relationshipLabel ?? "Puzzle"}`;
}

function buildSlotSignature(slotRules: SlotRule[]) {
  return slotRules
    .map(
      (rule) =>
        `${rule.slot_number}:${rule.slot_rule_id}:${rule.parameter_type}:${rule.parameter_value ?? ""}`
    )
    .join("|");
}

function buildCanonicalThemeFilterName(ruleLogicKey: string) {
  const normalized = String(ruleLogicKey ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return `theme_${normalized || "custom"}`;
}

async function rebuildOptimalUsageTrackerDoc(db: DbClient) {
  const result = await db.query(
    `
    SELECT
      dp.puzzle_date::text AS puzzle_date,
      dp.title,
      fd.display_name AS theme_display_name,
      COALESCE(rrd.relationship_type, 'none') AS relationship_type,
      oc.payload
    FROM daily_puzzle dp
    JOIN filter_definition fd
      ON fd.filter_id = dp.theme_filter_id
    LEFT JOIN relationship_rule_definition rrd
      ON rrd.relationship_rule_id = dp.relationship_rule_id
    LEFT JOIN optimal_lineup_cache oc
      ON oc.puzzle_id = dp.puzzle_id
    WHERE dp.sport = 'nfl'
      AND oc.payload IS NOT NULL
    ORDER BY dp.puzzle_date ASC, dp.puzzle_id ASC
    `
  );

  const runningPlayerCounts: Record<string, number> = {};
  const runningTimePeriodCounts: Record<string, number> = {};
  const runningLinkCounts: Record<string, number> = {};

  const days: TrackerDayEntry[] = result.rows.map((row) => {
    const payload = row.payload as {
      optimal_lineup?: CachedOptimalLineupEntry[];
    } | null;
    const optimalPlayers = Array.isArray(payload?.optimal_lineup)
      ? payload.optimal_lineup.map((entry) => ({
          slot_number: Number(entry?.slot_number ?? 0),
          slot_rule: String(entry?.slot_rule?.display_text ?? `Slot ${entry?.slot_number ?? "?"}`),
          player_name: String(entry?.player?.player_name ?? "Unknown"),
          player_id: String(
            ((entry?.player as unknown as { player_id?: string | number | null })?.player_id ??
              "")
          ),
          primary_position: String(
            ((entry?.player as unknown as { primary_position?: string | null })?.primary_position ??
              "")
          ) || null,
        }))
      : [];

    for (const player of optimalPlayers) {
      runningPlayerCounts[player.player_name] =
        (runningPlayerCounts[player.player_name] ?? 0) + 1;
    }
    const themeLabel = String(row.theme_display_name ?? "Unknown Theme");
    runningTimePeriodCounts[themeLabel] = (runningTimePeriodCounts[themeLabel] ?? 0) + 1;
    const linkLabel = String(row.relationship_type ?? "none");
    runningLinkCounts[linkLabel] = (runningLinkCounts[linkLabel] ?? 0) + 1;

    return {
      puzzle_date: String(row.puzzle_date),
      title: String(row.title ?? "Untitled Puzzle"),
      theme: themeLabel,
      link: linkLabel,
      optimal_players: optimalPlayers,
    };
  });

  const trackerPayload = {
    updated_through: days[days.length - 1]?.puzzle_date ?? null,
    days,
    running_player_counts: runningPlayerCounts,
    running_time_period_counts: runningTimePeriodCounts,
    running_link_counts: runningLinkCounts,
  };

  try {
    const docsDir = path.join(process.cwd(), "docs");
    await mkdir(docsDir, { recursive: true });
    await writeFile(
      path.join(docsDir, "optimal-lineup-usage-tracker.json"),
      `${JSON.stringify(trackerPayload, null, 2)}\n`,
      "utf8"
    );
  } catch (error) {
    console.warn("Failed to write optimal lineup tracker doc:", error);
  }
}

function playerMatchesSlotRule(player: CandidatePlayer, rule: SlotRule) {
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

function relationshipPasses(
  relationshipType: string,
  pair: PairRelationship | undefined
) {
  if (!pair) return false;

  switch (relationshipType) {
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

function combinationsOfTwo(count: number) {
  return count > 1 ? (count * (count - 1)) / 2 : 0;
}

function buildConfigSignature(
  puzzleId: string | number,
  themeRule: string,
  relationshipRule: { relationship_type: string; bonus_pct?: number | null },
  slotRules: SlotRule[],
  positionOverlayEnabled: boolean,
  qbExclusionEnabled: boolean
) {
  const slotSignature = buildSlotSignature(slotRules);

  return [
    "v5",
    String(puzzleId),
    themeRule,
    relationshipRule.relationship_type,
    String(relationshipRule.bonus_pct ?? 10),
    positionOverlayEnabled ? "overlay:on" : "overlay:off",
    qbExclusionEnabled ? "qb:off" : "qb:on",
    slotSignature,
  ].join("::");
}

function buildGenerationSignature(
  themeRule: string,
  relationshipRule: { relationship_type: string; bonus_pct?: number | null },
  slotRules: SlotRule[],
  positionOverlayEnabled: boolean,
  qbExclusionEnabled: boolean
) {
  const slotSignature = buildSlotSignature(slotRules);

  return [
    "gen:v1",
    themeRule,
    relationshipRule.relationship_type,
    String(relationshipRule.bonus_pct ?? 10),
    positionOverlayEnabled ? "overlay:on" : "overlay:off",
    qbExclusionEnabled ? "qb:off" : "qb:on",
    slotSignature,
  ].join("::");
}

async function getKnownInvalidSlotRuleIds(
  db: DbClient,
  themeRule: string,
  slotRules: SlotRule[],
  positionOverlayEnabled: boolean,
  qbExclusionEnabled: boolean
) {
  if (slotRules.length === 0) {
    return new Set<string>();
  }

  const result = await db.query(
    `
    SELECT slot_rule_id::text
    FROM dev_invalid_slot_candidate_cache
    WHERE theme_rule_logic_key = $1
      AND position_overlay_enabled = $2
      AND qb_exclusion_enabled = $3
      AND slot_rule_id = ANY($4::bigint[])
    `,
    [
      themeRule,
      positionOverlayEnabled,
      qbExclusionEnabled,
      slotRules.map((rule) => Number(rule.slot_rule_id)),
    ]
  );

  return new Set(result.rows.map((row) => String(row.slot_rule_id)));
}

async function recordInvalidCandidatePool(
  db: DbClient,
  themeRule: string,
  slotRules: SlotRule[],
  failingSlotRules: SlotRule[],
  positionOverlayEnabled: boolean,
  qbExclusionEnabled: boolean
) {
  if (failingSlotRules.length > 0) {
    await db.query(
      `
      INSERT INTO dev_invalid_slot_candidate_cache (
        theme_rule_logic_key,
        slot_rule_id,
        position_overlay_enabled,
        qb_exclusion_enabled,
        failure_count,
        last_seen_at
      )
      SELECT
        $1,
        slot_rule_id,
        $2,
        $3,
        1,
        NOW()
      FROM unnest($4::bigint[]) AS slot_rule_id
      ON CONFLICT (
        theme_rule_logic_key,
        slot_rule_id,
        position_overlay_enabled,
        qb_exclusion_enabled
      )
      DO UPDATE SET
        failure_count = dev_invalid_slot_candidate_cache.failure_count + 1,
        last_seen_at = NOW()
      `,
      [
        themeRule,
        positionOverlayEnabled,
        qbExclusionEnabled,
        failingSlotRules.map((rule) => Number(rule.slot_rule_id)),
      ]
    );
  }

  await db.query(
    `
    INSERT INTO dev_invalid_config_cache (
      theme_rule_logic_key,
      slot_signature,
      position_overlay_enabled,
      qb_exclusion_enabled,
      failure_reason,
      failure_count,
      last_seen_at
    )
    VALUES ($1, $2, $3, $4, 'no_candidate_pool', 1, NOW())
    ON CONFLICT (
      theme_rule_logic_key,
      slot_signature,
      position_overlay_enabled,
      qb_exclusion_enabled,
      failure_reason
    )
    DO UPDATE SET
      failure_count = dev_invalid_config_cache.failure_count + 1,
      last_seen_at = NOW()
    `,
    [
      themeRule,
      buildSlotSignature(slotRules),
      positionOverlayEnabled,
      qbExclusionEnabled,
    ]
  );
}

async function hasKnownInvalidConfig(
  db: DbClient,
  themeRule: string,
  slotRules: SlotRule[],
  positionOverlayEnabled: boolean,
  qbExclusionEnabled: boolean
) {
  const result = await db.query(
    `
    SELECT 1
    FROM dev_invalid_config_cache
    WHERE theme_rule_logic_key = $1
      AND slot_signature = $2
      AND position_overlay_enabled = $3
      AND qb_exclusion_enabled = $4
      AND failure_reason = 'no_candidate_pool'
    LIMIT 1
    `,
    [
      themeRule,
      buildSlotSignature(slotRules),
      positionOverlayEnabled,
      qbExclusionEnabled,
    ]
  );

  return Boolean(result.rows[0]);
}

async function getCachedSlotCandidateMetrics(
  db: DbClient,
  themeRule: string,
  slotRules: SlotRule[],
  positionOverlayEnabled: boolean,
  qbExclusionEnabled: boolean
) {
  if (slotRules.length === 0) {
    return new Map<string, SlotCandidateMetric>();
  }

  const result = await db.query(
    `
    SELECT
      slot_rule_id::text,
      candidate_count::int AS candidate_count,
      top_fantasy_points::float8 AS top_fantasy_points
    FROM dev_slot_candidate_metric_cache
    WHERE theme_rule_logic_key = $1
      AND position_overlay_enabled = $2
      AND qb_exclusion_enabled = $3
      AND slot_rule_id = ANY($4::bigint[])
    `,
    [
      themeRule,
      positionOverlayEnabled,
      qbExclusionEnabled,
      slotRules.map((rule) => Number(rule.slot_rule_id)),
    ]
  );

  return new Map<string, SlotCandidateMetric>(
    result.rows.map((row) => [
      String(row.slot_rule_id),
      {
        candidate_count: Number(row.candidate_count ?? 0),
        top_fantasy_points: Number(row.top_fantasy_points ?? 0),
      },
    ])
  );
}

async function recordSlotCandidateMetrics(
  db: DbClient,
  themeRule: string,
  slotCandidates: Array<
    SlotRule & {
      candidates: CandidatePlayer[];
    }
  >,
  positionOverlayEnabled: boolean,
  qbExclusionEnabled: boolean
) {
  if (slotCandidates.length === 0) {
    return;
  }

  const values: string[] = [];
  const params: Array<string | number | boolean> = [];

  slotCandidates.forEach((slot, index) => {
    const offset = index * 6;
    values.push(
      `($${offset + 1}, $${offset + 2}::bigint, $${offset + 3}, $${offset + 4}, $${offset + 5}::int, $${offset + 6}::float8, NOW())`
    );
    params.push(
      themeRule,
      Number(slot.slot_rule_id),
      positionOverlayEnabled,
      qbExclusionEnabled,
      slot.candidates.length,
      Number(slot.candidates[0]?.fantasy_points ?? 0)
    );
  });

  await db.query(
    `
    INSERT INTO dev_slot_candidate_metric_cache (
      theme_rule_logic_key,
      slot_rule_id,
      position_overlay_enabled,
      qb_exclusion_enabled,
      candidate_count,
      top_fantasy_points,
      last_seen_at
    )
    VALUES ${values.join(", ")}
    ON CONFLICT (
      theme_rule_logic_key,
      slot_rule_id,
      position_overlay_enabled,
      qb_exclusion_enabled
    )
    DO UPDATE SET
      candidate_count = EXCLUDED.candidate_count,
      top_fantasy_points = EXCLUDED.top_fantasy_points,
      last_seen_at = NOW()
    `,
    params
  );
}

async function hasKnownThresholdFailure(
  db: DbClient,
  configSignature: string,
  settings: DevGeneratorSettings
) {
  const result = await db.query(
    `
    SELECT failure_reason
    FROM dev_threshold_failure_cache
    WHERE config_signature = $1
      AND min_active_links = $2
      AND usage_threshold_total = $3
      AND max_qbs = $4
      AND min_points_per_season = $5
    ORDER BY last_seen_at DESC
    LIMIT 1
    `,
    [
      configSignature,
      settings.minActiveLinks,
      settings.usageThresholdTotal,
      settings.maxQbs,
      settings.minFantasyPointsPerSeason,
    ]
  );

  return String(result.rows[0]?.failure_reason ?? "");
}

async function recordThresholdFailure(
  db: DbClient,
  configSignature: string,
  settings: DevGeneratorSettings,
  failureReason: PreviewThresholdFailureReason
) {
  await db.query(
    `
    INSERT INTO dev_threshold_failure_cache (
      config_signature,
      min_active_links,
      usage_threshold_total,
      max_qbs,
      min_points_per_season,
      failure_reason,
      failure_count,
      last_seen_at
    )
    VALUES ($1, $2, $3, $4, $5, $6, 1, NOW())
    ON CONFLICT (
      config_signature,
      min_active_links,
      usage_threshold_total,
      max_qbs,
      min_points_per_season,
      failure_reason
    )
    DO UPDATE SET
      failure_count = dev_threshold_failure_cache.failure_count + 1,
      last_seen_at = NOW()
    `,
    [
      configSignature,
      settings.minActiveLinks,
      settings.usageThresholdTotal,
      settings.maxQbs,
      settings.minFantasyPointsPerSeason,
      failureReason,
    ]
  );
}

export async function getDevPuzzleMeta(db: DbClient) {
  const [relationshipsResult, slotRulesResult, nextDateResult] =
    await Promise.all([
      db.query(
        `
        SELECT relationship_rule_id::text, relationship_type, display_text, bonus_pct::float8 AS bonus_pct
        FROM relationship_rule_definition
        WHERE active_flag = true
        ORDER BY display_text ASC
        `
      ),
      db.query(
        `
        WITH eligible_players AS (
          SELECT p.player_id
          FROM player_dim p
          WHERE p.primary_position IN ('QB', 'RB', 'WR', 'TE')
        ),
        college_counts AS (
          SELECT
            pch.college_name,
            COUNT(DISTINCT pch.player_id)::int AS player_count
          FROM player_college_history pch
          JOIN eligible_players ep
            ON ep.player_id = pch.player_id
          GROUP BY pch.college_name
        )
        SELECT
          srd.slot_rule_id::text,
          srd.rule_name,
          srd.parameter_type,
          srd.parameter_value,
          srd.display_text,
          CASE
            WHEN srd.parameter_type = 'college'
              THEN CASE
                WHEN COALESCE(cc.player_count, 0) < 5 THEN 0
                ELSE POWER(COALESCE(cc.player_count, 1), 3)
              END
            ELSE 1
          END::int AS random_weight
        FROM slot_rule_definition srd
        LEFT JOIN college_counts cc
          ON srd.parameter_type = 'college'
         AND cc.college_name = srd.parameter_value
        WHERE srd.active_flag = true
          AND srd.parameter_type = ANY($1::text[])
          AND (
            srd.parameter_type <> 'college'
            OR COALESCE(cc.player_count, 0) >= 10
          )
        ORDER BY
          CASE srd.parameter_type
            WHEN 'position' THEN 1
            WHEN 'team' THEN 2
            WHEN 'college' THEN 3
            WHEN 'conference' THEN 4
            WHEN 'division' THEN 5
            ELSE 6
          END,
          srd.display_text ASC
        `,
        [SUPPORTED_SLOT_PARAMETER_TYPES]
      ),
      db.query(
        `
        SELECT COALESCE((MAX(puzzle_date) + INTERVAL '1 day')::date::text, ((NOW() AT TIME ZONE 'America/Chicago')::date)::text) AS next_available_date
        FROM daily_puzzle
        WHERE sport = 'nfl'
        `
      ),
    ]);

  return {
    relationships: relationshipsResult.rows,
    slotRules: slotRulesResult.rows,
    nextAvailableDate:
      nextDateResult.rows[0]?.next_available_date ??
      new Date().toISOString().slice(0, 10),
  };
}

export async function getDevDashboardStats(
  db: DbClient,
  trendDays = 14
): Promise<DevDashboardStats> {
  const safeTrendDays = Math.min(Math.max(Math.trunc(trendDays) || 14, 14), 365);
  const result = await db.query(
    `
    WITH chicago_today AS (
      SELECT (NOW() AT TIME ZONE 'America/Chicago')::date AS today
    ),
    next_open AS (
      SELECT COALESCE(
        (MAX(puzzle_date) + INTERVAL '1 day')::date::text,
        ((NOW() AT TIME ZONE 'America/Chicago')::date)::text
      ) AS next_open_date
      FROM daily_puzzle
      WHERE sport = 'nfl'
    ),
    todays_puzzle AS (
      SELECT dp.puzzle_id
      FROM daily_puzzle dp
      JOIN chicago_today ct
        ON dp.puzzle_date = ct.today
      WHERE dp.sport = 'nfl'
      LIMIT 1
    ),
    chicago_days AS (
      SELECT generate_series(
        (SELECT today FROM chicago_today) - ($1::int - 1),
        (SELECT today FROM chicago_today),
        INTERVAL '1 day'
      )::date AS day
    ),
    user_daily AS (
      SELECT
        (au.created_at AT TIME ZONE 'America/Chicago')::date AS day,
        COUNT(*)::int AS count
      FROM app_user au
      WHERE (au.created_at AT TIME ZONE 'America/Chicago')::date >=
            (SELECT MIN(day) FROM chicago_days)
      GROUP BY 1
    ),
    submission_daily AS (
      SELECT
        (ps.submitted_at AT TIME ZONE 'America/Chicago')::date AS day,
        COUNT(*)::int AS count
      FROM puzzle_submission ps
      WHERE (ps.submitted_at AT TIME ZONE 'America/Chicago')::date >=
            (SELECT MIN(day) FROM chicago_days)
      GROUP BY 1
    ),
    daily_puzzle_submission_daily AS (
      SELECT
        dp.puzzle_date AS day,
        COUNT(ps.submission_id)::int AS count
      FROM daily_puzzle dp
      LEFT JOIN puzzle_submission ps
        ON ps.puzzle_id = dp.puzzle_id
      WHERE dp.sport = 'nfl'
        AND dp.puzzle_date >= (SELECT MIN(day) FROM chicago_days)
      GROUP BY dp.puzzle_date
    )
    SELECT
      (SELECT COUNT(*)::int FROM app_user) AS total_users,
      (
        SELECT COUNT(*)::int
        FROM app_user au
        JOIN chicago_today ct
          ON (au.created_at AT TIME ZONE 'America/Chicago')::date = ct.today
      ) AS users_created_today,
      (SELECT COUNT(*)::int FROM daily_puzzle WHERE sport = 'nfl') AS total_puzzles,
      (
        SELECT COUNT(*)::int
        FROM daily_puzzle
        WHERE sport = 'nfl'
          AND published_flag = true
      ) AS published_puzzles,
      (SELECT COUNT(*)::int FROM puzzle_submission) AS total_submissions,
      (
        SELECT COUNT(*)::int
        FROM puzzle_submission ps
        JOIN chicago_today ct
          ON (ps.submitted_at AT TIME ZONE 'America/Chicago')::date = ct.today
      ) AS submissions_today,
      (
        SELECT COUNT(*)::int
        FROM puzzle_submission ps
        JOIN todays_puzzle tp
          ON tp.puzzle_id = ps.puzzle_id
      ) AS todays_puzzle_submissions,
      (
        SELECT COUNT(DISTINCT COALESCE(ps.user_id::text, ps.client_token))::int
        FROM puzzle_submission ps
        JOIN todays_puzzle tp
          ON tp.puzzle_id = ps.puzzle_id
      ) AS todays_unique_submitters,
      (SELECT COUNT(*)::int FROM daily_leaderboard_finish) AS leaderboard_finishes_awarded,
      (SELECT next_open_date FROM next_open) AS next_open_date,
      (
        SELECT json_agg(
          json_build_object(
            'date', cd.day::text,
            'count', COALESCE(ud.count, 0)
          )
          ORDER BY cd.day
        )
        FROM chicago_days cd
        LEFT JOIN user_daily ud
          ON ud.day = cd.day
      ) AS user_trend,
      (
        SELECT json_agg(
          json_build_object(
            'date', cd.day::text,
            'count', COALESCE(sd.count, 0)
          )
          ORDER BY cd.day
        )
        FROM chicago_days cd
        LEFT JOIN submission_daily sd
          ON sd.day = cd.day
      ) AS submission_trend,
      (
        SELECT json_agg(
          json_build_object(
            'date', cd.day::text,
            'count', COALESCE(dpsd.count, 0)
          )
          ORDER BY cd.day
        )
        FROM chicago_days cd
        LEFT JOIN daily_puzzle_submission_daily dpsd
          ON dpsd.day = cd.day
      ) AS daily_puzzle_submission_trend
    `,
    [safeTrendDays]
  );

  const row = result.rows[0];
  const toTrendArray = (
    value: unknown
  ): Array<{ date: string; count: number }> =>
    Array.isArray(value)
      ? value.map((entry) => ({
          date: String((entry as { date?: string }).date ?? ""),
          count: Number((entry as { count?: number }).count ?? 0),
        }))
      : [];

  return {
    total_users: Number(row?.total_users ?? 0),
    users_created_today: Number(row?.users_created_today ?? 0),
    total_puzzles: Number(row?.total_puzzles ?? 0),
    published_puzzles: Number(row?.published_puzzles ?? 0),
    total_submissions: Number(row?.total_submissions ?? 0),
    submissions_today: Number(row?.submissions_today ?? 0),
    todays_puzzle_submissions: Number(row?.todays_puzzle_submissions ?? 0),
    todays_unique_submitters: Number(row?.todays_unique_submitters ?? 0),
    leaderboard_finishes_awarded: Number(row?.leaderboard_finishes_awarded ?? 0),
    next_open_date: String(row?.next_open_date ?? ""),
    user_trend: toTrendArray(row?.user_trend),
    submission_trend: toTrendArray(row?.submission_trend),
    daily_puzzle_submission_trend: toTrendArray(row?.daily_puzzle_submission_trend),
  };
}

export async function getDevPuzzleList(db: DbClient): Promise<DevPuzzleListItem[]> {
  const result = await db.query(
    `
    WITH chicago_today AS (
      SELECT (NOW() AT TIME ZONE 'America/Chicago')::date AS today
    ),
    submission_counts AS (
      SELECT puzzle_id, COUNT(*)::int AS submission_count
      FROM puzzle_submission
      GROUP BY puzzle_id
    )
    SELECT
      dp.puzzle_id::text AS puzzle_id,
      dp.puzzle_date::text AS puzzle_date,
      dp.title,
      fd.display_name AS theme_display_name,
      rrd.display_text AS relationship_display_text,
      rrd.relationship_type,
      dp.position_overlay_enabled,
      COALESCE(dp.qb_exclusion_enabled, false) AS qb_exclusion_enabled,
      dp.published_flag,
      (dp.puzzle_date > (SELECT today FROM chicago_today) AND COALESCE(sc.submission_count, 0) = 0) AS future_editable
    FROM daily_puzzle dp
    JOIN filter_definition fd
      ON fd.filter_id = dp.theme_filter_id
    LEFT JOIN relationship_rule_definition rrd
      ON rrd.relationship_rule_id = dp.relationship_rule_id
    LEFT JOIN submission_counts sc
      ON sc.puzzle_id = dp.puzzle_id
    WHERE dp.sport = 'nfl'
    ORDER BY dp.puzzle_date DESC, dp.puzzle_id DESC
    `
  );

  return result.rows;
}

export async function getDevPuzzleDetail(
  db: DbClient,
  puzzleId: string | number
): Promise<DevPuzzleDetail | null> {
  const puzzleResult = await db.query(
    `
    WITH chicago_today AS (
      SELECT (NOW() AT TIME ZONE 'America/Chicago')::date AS today
    ),
    submission_counts AS (
      SELECT puzzle_id, COUNT(*)::int AS submission_count
      FROM puzzle_submission
      GROUP BY puzzle_id
    )
    SELECT
      dp.puzzle_id::text AS puzzle_id,
      dp.puzzle_date::text AS puzzle_date,
      dp.title,
      dp.sport,
      fd.display_name AS theme_display_name,
      fd.rule_logic_key AS theme_rule_logic_key,
      rrd.display_text AS relationship_display_text,
      rrd.relationship_type,
      dp.position_overlay_enabled,
      COALESCE(dp.qb_exclusion_enabled, false) AS qb_exclusion_enabled,
      dp.published_flag,
      (dp.puzzle_date > (SELECT today FROM chicago_today) AND COALESCE(sc.submission_count, 0) = 0) AS future_editable,
      dp.created_at::text AS created_at
    FROM daily_puzzle dp
    JOIN filter_definition fd
      ON fd.filter_id = dp.theme_filter_id
    LEFT JOIN relationship_rule_definition rrd
      ON rrd.relationship_rule_id = dp.relationship_rule_id
    LEFT JOIN submission_counts sc
      ON sc.puzzle_id = dp.puzzle_id
    WHERE dp.puzzle_id = $1::bigint
      AND dp.sport = 'nfl'
    LIMIT 1
    `,
    [Number(puzzleId)]
  );

  const puzzle = puzzleResult.rows[0];
  if (!puzzle) {
    return null;
  }

  const [slotsResult, submissionsResult, cacheResult] = await Promise.all([
    db.query(
      `
      SELECT
        dpsr.slot_number,
        srd.display_text,
        srd.parameter_type,
        srd.parameter_value,
        srd.rule_name
      FROM daily_puzzle_slot_rule dpsr
      JOIN slot_rule_definition srd
        ON srd.slot_rule_id = dpsr.slot_rule_id
      WHERE dpsr.puzzle_id = $1::bigint
      ORDER BY dpsr.slot_number ASC
      `,
      [Number(puzzleId)]
    ),
    db.query(
      `
      SELECT
        ps.submission_id::text AS submission_id,
        ps.user_id::text AS user_id,
        au.username,
        COALESCE(au.username, ps.display_name) AS display_name,
        ps.submitted_at::text AS submitted_at,
        ps.final_score::float8 AS final_score
      FROM puzzle_submission ps
      LEFT JOIN app_user au
        ON au.user_id = ps.user_id
      WHERE ps.puzzle_id = $1::bigint
      ORDER BY ps.submitted_at ASC, ps.submission_id ASC
      `,
      [Number(puzzleId)]
    ),
    db.query(
      `
      SELECT payload, computed_at::text AS computed_at
      FROM optimal_lineup_cache
      WHERE puzzle_id = $1::bigint
      ORDER BY computed_at DESC
      LIMIT 1
      `,
      [Number(puzzleId)]
    ),
  ]);

  const cacheRow = cacheResult.rows[0] ?? null;
  const payload = cacheRow?.payload ?? null;

  return {
    puzzle,
    slots: slotsResult.rows,
    submissions: {
      submission_count: submissionsResult.rows.length,
      entries: submissionsResult.rows.map((row) => ({
        submission_id: String(row.submission_id),
        user_id: row.user_id ? String(row.user_id) : null,
        username: row.username ? String(row.username) : null,
        display_name: String(row.display_name),
        submitted_at: String(row.submitted_at),
        final_score: Number(row.final_score ?? 0),
      })),
    },
    cached_optimal: payload
      ? {
          computed_at: cacheRow.computed_at,
          optimal_active_links:
            payload?.optimal_active_links != null
              ? Number(payload.optimal_active_links)
              : null,
          optimal_final_score:
            payload?.optimal_final_score != null
              ? Number(payload.optimal_final_score)
              : null,
          optimal_lineup: Array.isArray(payload?.optimal_lineup)
            ? payload.optimal_lineup.map((entry: unknown) => {
                const lineupEntry = entry as CachedOptimalLineupEntry;
                return {
                  slot_number: Number(lineupEntry?.slot_number ?? 0),
                  slot_label: String(
                    lineupEntry?.slot_rule?.display_text ??
                      `Slot ${lineupEntry?.slot_number ?? "?"}`
                  ),
                  player_name: String(lineupEntry?.player?.player_name ?? "Unknown"),
                  previous_optimal_usage_count: Number(
                    lineupEntry?.previous_optimal_usage_count ?? 0
                  ),
                };
            })
            : [],
        }
      : null,
  };
}

async function getLatestDevGeneratorJob(db: DbClient): Promise<DevGeneratorJobStatus | null> {
  await ensureDevAutomationTables(db);
  const result = await db.query(
    `
    SELECT
      job_id::text,
      active_flag,
      settings,
      last_status,
      last_error,
      last_run_at::text AS last_run_at,
      updated_at::text AS updated_at,
      created_at::text AS created_at
    FROM dev_puzzle_generation_job
    ORDER BY job_id DESC
    LIMIT 1
    `
  );
  const row = result.rows[0];
  if (!row) {
    return null;
  }
  return {
    job_id: String(row.job_id),
    active_flag: Boolean(row.active_flag),
    settings: sanitizeGeneratorSettings(
      row.settings as Partial<DevGeneratorSettings> | null | undefined
    ),
    last_status: row.last_status ? String(row.last_status) : null,
    last_error: row.last_error ? String(row.last_error) : null,
    last_run_at: row.last_run_at ? String(row.last_run_at) : null,
    updated_at: row.updated_at ? String(row.updated_at) : null,
    created_at: row.created_at ? String(row.created_at) : null,
  };
}

export async function getDevPendingPuzzles(
  db: DbClient
): Promise<DevPendingPuzzleListItem[]> {
  const result = await db.query(
    `
    WITH latest_cache AS (
      SELECT DISTINCT ON (puzzle_id)
        puzzle_id,
        payload,
        computed_at
      FROM optimal_lineup_cache
      ORDER BY puzzle_id, computed_at DESC
    ),
    usage_totals AS (
      SELECT
        dp.puzzle_id,
        COALESCE(SUM((entry.value->>'previous_optimal_usage_count')::int), 0)::int AS usage_total,
        COALESCE(
          SUM(
            CASE
              WHEN entry.value->'player'->>'primary_position' = 'QB' THEN 1
              ELSE 0
            END
          ),
          0
        )::int AS qb_count
      FROM daily_puzzle dp
      LEFT JOIN latest_cache lc
        ON lc.puzzle_id = dp.puzzle_id
      LEFT JOIN LATERAL jsonb_array_elements(COALESCE(lc.payload->'optimal_lineup', '[]'::jsonb)) entry(value)
        ON true
      WHERE dp.sport = 'nfl'
        AND dp.published_flag = false
      GROUP BY dp.puzzle_id
    )
    SELECT
      dp.puzzle_id::text AS puzzle_id,
      dp.puzzle_date::text AS puzzle_date,
      dp.title,
      fd.display_name AS theme_display_name,
      rrd.display_text AS relationship_display_text,
      rrd.relationship_type,
      dp.position_overlay_enabled,
      COALESCE(dp.qb_exclusion_enabled, false) AS qb_exclusion_enabled,
      dp.published_flag,
      CASE
        WHEN lc.payload->>'optimal_active_links' IS NOT NULL
          THEN (lc.payload->>'optimal_active_links')::int
        ELSE NULL
      END AS optimal_active_links,
      CASE
        WHEN lc.payload->>'optimal_final_score' IS NOT NULL
          THEN (lc.payload->>'optimal_final_score')::float8
        ELSE NULL
      END AS optimal_final_score,
      COALESCE(ut.usage_total, 0)::int AS usage_total,
      COALESCE(ut.qb_count, 0)::int AS qb_count
    FROM daily_puzzle dp
    JOIN filter_definition fd
      ON fd.filter_id = dp.theme_filter_id
    LEFT JOIN relationship_rule_definition rrd
      ON rrd.relationship_rule_id = dp.relationship_rule_id
    LEFT JOIN latest_cache lc
      ON lc.puzzle_id = dp.puzzle_id
    LEFT JOIN usage_totals ut
      ON ut.puzzle_id = dp.puzzle_id
    WHERE dp.sport = 'nfl'
      AND dp.published_flag = false
    ORDER BY dp.puzzle_date ASC, dp.puzzle_id ASC
    `
  );
  return result.rows.map((row) => ({
    ...row,
    optimal_active_links:
      row.optimal_active_links != null ? Number(row.optimal_active_links) : null,
    optimal_final_score:
      row.optimal_final_score != null ? Number(row.optimal_final_score) : null,
    usage_total: Number(row.usage_total ?? 0),
    qb_count: Number(row.qb_count ?? 0),
  })) as DevPendingPuzzleListItem[];
}

export async function getDevApprovalQueue(db: DbClient) {
  const [job, pendingPuzzles] = await Promise.all([
    getLatestDevGeneratorJob(db),
    getDevPendingPuzzles(db),
  ]);
  return {
    job,
    pendingPuzzles,
  };
}

async function assertFutureEditablePuzzle(
  db: DbClient,
  puzzleId: string | number
): Promise<{ puzzle_id: string; puzzle_date: string }> {
  const result = await db.query(
    `
    WITH chicago_today AS (
      SELECT (NOW() AT TIME ZONE 'America/Chicago')::date AS today
    ),
    submission_counts AS (
      SELECT puzzle_id, COUNT(*)::int AS submission_count
      FROM puzzle_submission
      GROUP BY puzzle_id
    )
    SELECT dp.puzzle_id::text AS puzzle_id, dp.puzzle_date::text AS puzzle_date
    FROM daily_puzzle dp
    LEFT JOIN submission_counts sc
      ON sc.puzzle_id = dp.puzzle_id
    WHERE dp.puzzle_id = $1::bigint
      AND dp.sport = 'nfl'
      AND dp.puzzle_date > (SELECT today FROM chicago_today)
      AND COALESCE(sc.submission_count, 0) = 0
    LIMIT 1
    `,
    [Number(puzzleId)]
  );

  const row = result.rows[0];
  if (!row) {
    throw new Error("Only future puzzles without submissions can be edited.");
  }
  return {
    puzzle_id: String(row.puzzle_id),
    puzzle_date: String(row.puzzle_date),
  };
}

export async function upsertDevGeneratorJob(
  db: DbClient,
  input: Partial<DevGeneratorSettings> & { active_flag?: boolean }
) {
  await ensureDevAutomationTables(db);
  const current = await getLatestDevGeneratorJob(db);
  const settings = sanitizeGeneratorSettings({
    ...(current?.settings ?? DEFAULT_GENERATOR_SETTINGS),
    ...input,
  });
  if (!current) {
    const insertResult = await db.query(
      `
      INSERT INTO dev_puzzle_generation_job (
        active_flag,
        settings,
        last_status,
        updated_at
      )
      VALUES ($1, $2::jsonb, $3, NOW())
      RETURNING job_id::text
      `,
      [Boolean(input.active_flag), JSON.stringify(settings), "Ready"]
    );
    return {
      job_id: String(insertResult.rows[0]?.job_id ?? ""),
      active_flag: Boolean(input.active_flag),
      settings,
    };
  }

  await db.query(
    `
    UPDATE dev_puzzle_generation_job
    SET
      active_flag = COALESCE($2, active_flag),
      settings = $3::jsonb,
      last_status = COALESCE($4, last_status),
      last_error = NULL,
      updated_at = NOW()
    WHERE job_id = $1::bigint
    `,
    [
      Number(current.job_id),
      typeof input.active_flag === "boolean" ? input.active_flag : null,
      JSON.stringify(settings),
      typeof input.active_flag === "boolean"
        ? input.active_flag
          ? "Running"
          : "Stopped"
        : null,
    ]
  );
  return {
    job_id: current.job_id,
    active_flag:
      typeof input.active_flag === "boolean"
        ? input.active_flag
        : current.active_flag,
    settings,
  };
}

function buildRandomSlotRuleIds(
  slotRules: Array<{
    slot_rule_id: string;
    parameter_type: string;
    random_weight?: number | null;
  }>
) {
  const rulesByType = new Map<string, typeof slotRules>();
  for (const rule of slotRules) {
    if (rule.parameter_type === "college" && Number(rule.random_weight ?? 0) <= 0) {
      continue;
    }
    const items = rulesByType.get(rule.parameter_type) ?? [];
    items.push(rule);
    rulesByType.set(rule.parameter_type, items);
  }

  const nextSlotRuleIds: string[] = [];

  for (let slotIndex = 0; slotIndex < 5; slotIndex += 1) {
    const typeEntries = Array.from(rulesByType.entries()).filter(([, items]) => items.length > 0);
    if (typeEntries.length === 0) {
      return null;
    }
    const collegeEntry = typeEntries.find(([type]) => type === "college") ?? null;
    const nonCollegeEntries = typeEntries.filter(([type]) => type !== "college");
    const shouldPickCollege =
      Boolean(collegeEntry) &&
      (nonCollegeEntries.length === 0 || Math.random() < COLLEGE_TYPE_PICK_RATE);
    const selectedType = shouldPickCollege
      ? "college"
      : pickRandomItem(nonCollegeEntries)?.[0] ?? collegeEntry?.[0] ?? null;
    if (!selectedType) {
      return null;
    }
    const availableRules = rulesByType.get(selectedType) ?? [];
    const selectedRule =
      selectedType === "college"
        ? pickWeightedRule(availableRules)
        : pickRandomItem(availableRules);
    if (!selectedRule) {
      return null;
    }
    nextSlotRuleIds.push(selectedRule.slot_rule_id);
    const selectedIndex = availableRules.findIndex(
      (item) => item.slot_rule_id === selectedRule.slot_rule_id
    );
    if (selectedIndex >= 0) {
      availableRules.splice(selectedIndex, 1);
    }
    if (availableRules.length === 0) {
      rulesByType.delete(selectedType);
    } else {
      rulesByType.set(selectedType, availableRules);
    }
  }

  return nextSlotRuleIds.length === 5 ? nextSlotRuleIds : null;
}

function previewMeetsGeneratorThresholds(
  preview: PreviewPayload,
  settings: DevGeneratorSettings
) {
  const seasonMatches = preview.theme.rule_logic_key.match(/\d{4}/g) ?? [];
  const startSeason = Number(seasonMatches[0] ?? 0);
  const endSeason = Number(seasonMatches[1] ?? seasonMatches[0] ?? 0);

  return evaluatePreviewAgainstGeneratorThresholds(
    preview,
    settings,
    startSeason,
    endSeason
  ).passed;
}

function evaluatePreviewAgainstGeneratorThresholds(
  preview: PreviewPayload,
  settings: DevGeneratorSettings,
  startSeason: number,
  endSeason: number
): PreviewThresholdEvaluation {
  const usageTotal = preview.optimal_lineup.reduce(
    (sum, entry) => sum + Number(entry.previous_optimal_usage_count ?? 0),
    0
  );
  const qbCount = preview.optimal_lineup.reduce(
    (sum, entry) =>
      sum + (String(entry.player.primary_position ?? "").toUpperCase() === "QB" ? 1 : 0),
    0
  );
  const seasonCount = Math.max(1, endSeason - startSeason + 1);
  const minimumFantasyPoints = seasonCount * settings.minFantasyPointsPerSeason;

  if (preview.optimal_active_links < settings.minActiveLinks) {
    return {
      passed: false,
      failureReason: "active_links",
      usageTotal,
      qbCount,
      minimumFantasyPoints,
    };
  }
  if (usageTotal >= settings.usageThresholdTotal) {
    return {
      passed: false,
      failureReason: "usage_total",
      usageTotal,
      qbCount,
      minimumFantasyPoints,
    };
  }
  if (qbCount > settings.maxQbs) {
    return {
      passed: false,
      failureReason: "max_qbs",
      usageTotal,
      qbCount,
      minimumFantasyPoints,
    };
  }
  if (
    !preview.optimal_lineup.every(
      (entry) => Number(entry.player.fantasy_points ?? 0) >= minimumFantasyPoints
    )
  ) {
    return {
      passed: false,
      failureReason: "impact_threshold",
      usageTotal,
      qbCount,
      minimumFantasyPoints,
    };
  }

  return {
    passed: true,
    failureReason: null,
    usageTotal,
    qbCount,
    minimumFantasyPoints,
  };
}

async function tryGenerateCandidatePuzzle(
  db: DbClient,
  settings: DevGeneratorSettings
): Promise<{ config: DevPuzzleConfig; preview: PreviewPayload; attempts: number } | null> {
  const meta = await getDevPuzzleMeta(db);
  for (let attempt = 0; attempt < settings.maxAttemptsPerPuzzle; attempt += 1) {
    const themeRange = pickRandomItem([...AUTO_THEME_RANGES]);
    const relationship = pickRandomItem(meta.relationships);
    const slotRuleIds = buildRandomSlotRuleIds(meta.slotRules);
    if (!themeRange || !relationship || !slotRuleIds) {
      continue;
    }
    const config: DevPuzzleConfig = {
      title: buildSuggestedTitle(
        buildThemeLabel(themeRange.startSeason, themeRange.endSeason),
        relationship.display_text
      ),
      startSeason: themeRange.startSeason,
      endSeason: themeRange.endSeason,
      relationshipRuleId: relationship.relationship_rule_id,
      slotRuleIds,
      positionOverlayEnabled: settings.forcePositionLock,
      qbExclusionEnabled: settings.forceNoQbs,
    };
    try {
      const preview = await computePreviewPayload(db, config, {
        generatorSettings: settings,
      });
      if (!previewMeetsGeneratorThresholds(preview, settings)) {
        continue;
      }
      return { config, preview, attempts: attempt + 1 };
    } catch (error) {
      if (
        (error as Error).message === "No valid candidate pool for one or more slots." ||
        (error as Error).message === "Configuration cannot meet current generator thresholds."
      ) {
        continue;
      }
    }
  }
  return null;
}

async function findViablePuzzleCandidate(
  db: DbClient,
  settings: DevGeneratorSettings,
  options?: { maxSearchPasses?: number }
) {
  const maxSearchPasses = Math.max(1, Math.trunc(options?.maxSearchPasses ?? 1) || 1);
  let totalAttempts = 0;

  for (let pass = 1; pass <= maxSearchPasses; pass += 1) {
    const candidate = await tryGenerateCandidatePuzzle(db, settings);
    if (candidate) {
      return {
        ...candidate,
        searchPasses: pass,
        totalAttempts: totalAttempts + candidate.attempts,
      };
    }
    totalAttempts += settings.maxAttemptsPerPuzzle;
  }

  return null;
}

export async function processDevGeneratorJobs(
  db: DbClient,
  options?: { force?: boolean; maxGenerate?: number }
) {
  await ensureDevAutomationTables(db);
  const job = await getLatestDevGeneratorJob(db);
  if (!job || (!job.active_flag && !options?.force)) {
    return {
      ran: false,
      generated: 0,
      reason: "No active generator job.",
    };
  }

  const pendingBefore = await getDevPendingPuzzles(db);
  const needed = Math.max(job.settings.targetPendingCount - pendingBefore.length, 0);
  if (needed === 0) {
    await db.query(
      `
      UPDATE dev_puzzle_generation_job
      SET last_status = $2, last_error = NULL, last_run_at = NOW(), updated_at = NOW()
      WHERE job_id = $1::bigint
      `,
      [Number(job.job_id), "Queue already full"]
    );
    return {
      ran: true,
      generated: 0,
      reason: "Queue already full.",
    };
  }

  const maxGeneratedThisRun = Math.min(
    needed,
    Math.max(1, Math.trunc(options?.maxGenerate ?? 3) || 3)
  );
  let generated = 0;
  let totalAttempts = 0;
  let totalSearchPasses = 0;
  const searchPassesPerPuzzle = Math.max(3, Math.min(12, Math.ceil(600 / job.settings.maxAttemptsPerPuzzle)));

  for (let index = 0; index < maxGeneratedThisRun; index += 1) {
    const candidate = await findViablePuzzleCandidate(db, job.settings, {
      maxSearchPasses: searchPassesPerPuzzle,
    });
    if (!candidate) {
      await db.query(
        `
        UPDATE dev_puzzle_generation_job
        SET last_status = $2, last_error = $3, last_run_at = NOW(), updated_at = NOW()
        WHERE job_id = $1::bigint
        `,
        [
          Number(job.job_id),
          "No qualifying puzzle found this run",
          `Generator exhausted ${searchPassesPerPuzzle} builder-style search passes (${searchPassesPerPuzzle * job.settings.maxAttemptsPerPuzzle} attempts).`,
        ]
      );
      break;
    }
    await savePuzzleFromConfig(db, candidate.config, { publishedFlag: false });
    generated += 1;
    totalAttempts += candidate.totalAttempts;
    totalSearchPasses += candidate.searchPasses;
  }

  await db.query(
    `
    UPDATE dev_puzzle_generation_job
    SET last_status = $2, last_error = NULL, last_run_at = NOW(), updated_at = NOW()
    WHERE job_id = $1::bigint
    `,
    [
      Number(job.job_id),
      generated > 0
        ? `Generated ${generated} pending puzzle${generated === 1 ? "" : "s"} after ${totalAttempts} attempt${totalAttempts === 1 ? "" : "s"} across ${totalSearchPasses} search pass${totalSearchPasses === 1 ? "" : "es"}`
        : "No new pending puzzles generated",
    ]
  );

  return {
    ran: true,
    generated,
    attempts: totalAttempts,
    searchPasses: totalSearchPasses,
    reason: null,
  };
}

export async function approvePendingPuzzle(db: DbClient, puzzleId: string | number) {
  const result = await db.query(
    `
    UPDATE daily_puzzle
    SET published_flag = true
    WHERE puzzle_id = $1::bigint
      AND sport = 'nfl'
      AND published_flag = false
    RETURNING puzzle_id::text, puzzle_date::text
    `,
    [Number(puzzleId)]
  );
  if (!result.rows[0]) {
    throw new Error("Pending puzzle not found.");
  }
  await rebuildOptimalUsageTrackerDoc(db);
  return result.rows[0];
}

async function refreshPuzzleOptimalCache(db: DbClient, puzzleId: string | number) {
  const puzzleResult = await db.query(
    `
    SELECT
      dp.puzzle_id::text AS puzzle_id,
      dp.puzzle_date::text AS puzzle_date,
      dp.title,
      dp.position_overlay_enabled,
      COALESCE(dp.qb_exclusion_enabled, false) AS qb_exclusion_enabled,
      dp.theme_filter_id::text AS theme_filter_id,
      dp.relationship_rule_id::text AS relationship_rule_id
    FROM daily_puzzle dp
    WHERE dp.puzzle_id = $1::bigint
      AND dp.sport = 'nfl'
    LIMIT 1
    `,
    [Number(puzzleId)]
  );
  const puzzle = puzzleResult.rows[0];
  if (!puzzle) {
    throw new Error("Puzzle not found.");
  }

  const [themeResult, slotsResult] = await Promise.all([
    db.query(
      `
      SELECT rule_logic_key
      FROM filter_definition
      WHERE filter_id = $1::bigint
      LIMIT 1
      `,
      [Number(puzzle.theme_filter_id)]
    ),
    db.query(
      `
      SELECT srd.slot_rule_id::text
      FROM daily_puzzle_slot_rule dpsr
      JOIN slot_rule_definition srd
        ON srd.slot_rule_id = dpsr.slot_rule_id
      WHERE dpsr.puzzle_id = $1::bigint
      ORDER BY dpsr.slot_number ASC
      `,
      [Number(puzzleId)]
    ),
  ]);

  const themeRule = String(themeResult.rows[0]?.rule_logic_key ?? "");
  const slotRuleIds = slotsResult.rows.map((row) => String(row.slot_rule_id));
  const seasonMatches = [...themeRule.matchAll(/\d{4}/g)].map((match) => Number(match[0]));
  if (!themeRule || seasonMatches.length === 0 || slotRuleIds.length !== 5) {
    throw new Error("Puzzle config could not be reconstructed.");
  }
  const config: DevPuzzleConfig = {
    title: String(puzzle.title ?? ""),
    startSeason: seasonMatches[0],
    endSeason: seasonMatches[1] ?? seasonMatches[0],
    relationshipRuleId: String(puzzle.relationship_rule_id ?? ""),
    slotRuleIds,
    positionOverlayEnabled: Boolean(puzzle.position_overlay_enabled),
    qbExclusionEnabled: Boolean(puzzle.qb_exclusion_enabled),
  };
  const previewPayload = await computePreviewPayload(db, config);
  const slotRules = previewPayload.optimal_lineup.map((entry) => entry.slot_rule);
  const configSignature = buildConfigSignature(
    puzzle.puzzle_id,
    previewPayload.theme.rule_logic_key,
    previewPayload.relationship_rule,
    slotRules,
    config.positionOverlayEnabled,
    config.qbExclusionEnabled
  );
  await db.query(
    `
    INSERT INTO optimal_lineup_cache (puzzle_id, config_signature, payload, computed_at)
    VALUES ($1::bigint, $2, $3::jsonb, NOW())
    ON CONFLICT (puzzle_id)
    DO UPDATE SET
      config_signature = EXCLUDED.config_signature,
      payload = EXCLUDED.payload,
      computed_at = NOW()
    `,
    [
      Number(puzzleId),
      configSignature,
      JSON.stringify({
        puzzle_date: puzzle.puzzle_date,
        relationship_rule: previewPayload.relationship_rule,
        candidate_pool_summary: previewPayload.candidate_pool_summary,
        optimal_lineup: previewPayload.optimal_lineup.map((entry) => ({
          slot_number: entry.slot_number,
          slot_rule: entry.slot_rule,
          player: entry.player,
          previous_optimal_usage_count: entry.previous_optimal_usage_count,
        })),
        optimal_base_score: previewPayload.optimal_base_score,
        optimal_active_links: previewPayload.optimal_active_links,
        optimal_multiplier: previewPayload.optimal_multiplier,
        optimal_final_score: previewPayload.optimal_final_score,
      }),
    ]
  );
}

async function updateCachedPuzzleDate(db: DbClient, puzzleId: number, puzzleDate: string) {
  await db.query(
    `
    UPDATE optimal_lineup_cache
    SET payload = jsonb_set(
      COALESCE(payload, '{}'::jsonb),
      '{puzzle_date}',
      to_jsonb($2::text),
      true
    ),
    computed_at = NOW()
    WHERE puzzle_id = $1::bigint
    `,
    [puzzleId, puzzleDate]
  );
}

export async function rejectPendingPuzzle(db: DbClient, puzzleId: string | number) {
  const puzzleResult = await db.query(
    `
    SELECT puzzle_id::text, puzzle_date::text
    FROM daily_puzzle
    WHERE puzzle_id = $1::bigint
      AND sport = 'nfl'
      AND published_flag = false
    LIMIT 1
    `,
    [Number(puzzleId)]
  );
  const puzzle = puzzleResult.rows[0];
  if (!puzzle) {
    throw new Error("Pending puzzle not found.");
  }

  const submissionsResult = await db.query(
    `
    SELECT COUNT(*)::int AS submission_count
    FROM puzzle_submission
    WHERE puzzle_id = $1::bigint
    `,
    [Number(puzzleId)]
  );
  if (Number(submissionsResult.rows[0]?.submission_count ?? 0) > 0) {
    throw new Error("Cannot reject a pending puzzle that already has submissions.");
  }

  await db.query(`DELETE FROM daily_puzzle WHERE puzzle_id = $1::bigint`, [Number(puzzleId)]);

  const futureSubmissionResult = await db.query(
    `
    SELECT COUNT(*)::int AS submission_count
    FROM puzzle_submission ps
    JOIN daily_puzzle dp
      ON dp.puzzle_id = ps.puzzle_id
    WHERE dp.sport = 'nfl'
      AND dp.puzzle_date > $1::date
    `,
    [puzzle.puzzle_date]
  );
  if (Number(futureSubmissionResult.rows[0]?.submission_count ?? 0) > 0) {
    throw new Error(
      "Cannot shift future puzzles because one or more later dates already have submissions."
    );
  }

  const laterPuzzlesResult = await db.query(
    `
    SELECT puzzle_id::text, puzzle_date::text
    FROM daily_puzzle
    WHERE sport = 'nfl'
      AND puzzle_date > $1::date
    ORDER BY puzzle_date ASC, puzzle_id ASC
    `,
    [puzzle.puzzle_date]
  );

  for (const row of laterPuzzlesResult.rows) {
    const shiftedDateResult = await db.query<{ shifted_date: string }>(
      `SELECT ($1::date - INTERVAL '1 day')::date::text AS shifted_date`,
      [row.puzzle_date]
    );
    const shiftedDate = shiftedDateResult.rows[0]?.shifted_date;
    if (!shiftedDate) {
      continue;
    }
    await db.query(
      `
      UPDATE daily_puzzle
      SET puzzle_date = $1::date
      WHERE puzzle_id = $2::bigint
      `,
      [shiftedDate, Number(row.puzzle_id)]
    );
    await updateCachedPuzzleDate(db, Number(row.puzzle_id), shiftedDate);
  }

  await rebuildOptimalUsageTrackerDoc(db);

  return {
    rejectedPuzzleId: String(puzzleId),
    removedDate: String(puzzle.puzzle_date),
    shiftedCount: laterPuzzlesResult.rows.length,
  };
}

export async function swapFuturePuzzleSlots(
  db: DbClient,
  puzzleId: string | number,
  slotA: number,
  slotB: number
) {
  if (slotA === slotB) {
    throw new Error("Pick two different slots to swap.");
  }
  if (![1, 2, 3, 4, 5].includes(slotA) || ![1, 2, 3, 4, 5].includes(slotB)) {
    throw new Error("Slots must be between 1 and 5.");
  }
  await assertFutureEditablePuzzle(db, puzzleId);

  const rowsResult = await db.query(
    `
    SELECT puzzle_slot_rule_id::text, slot_number
    FROM daily_puzzle_slot_rule
    WHERE puzzle_id = $1::bigint
      AND slot_number = ANY($2::int[])
    ORDER BY slot_number ASC
    `,
    [Number(puzzleId), [slotA, slotB]]
  );
  if (rowsResult.rows.length !== 2) {
    throw new Error("Could not find both slot rows to swap.");
  }

  await db.query(
    `
    UPDATE daily_puzzle_slot_rule
    SET slot_number = 99
    WHERE puzzle_id = $1::bigint
      AND slot_number = $2::int
    `,
    [Number(puzzleId), slotA]
  );
  await db.query(
    `
    UPDATE daily_puzzle_slot_rule
    SET slot_number = $2::int
    WHERE puzzle_id = $1::bigint
      AND slot_number = $3::int
    `,
    [Number(puzzleId), slotA, slotB]
  );
  await db.query(
    `
    UPDATE daily_puzzle_slot_rule
    SET slot_number = $2::int
    WHERE puzzle_id = $1::bigint
      AND slot_number = 99
    `,
    [Number(puzzleId), slotB]
  );

  await refreshPuzzleOptimalCache(db, puzzleId);
  await rebuildOptimalUsageTrackerDoc(db);
}

export async function moveFuturePuzzleByDate(
  db: DbClient,
  puzzleId: string | number,
  direction: "earlier" | "later"
) {
  const puzzle = await assertFutureEditablePuzzle(db, puzzleId);

  const comparison = direction === "earlier" ? "<" : ">";
  const orderDirection = direction === "earlier" ? "DESC" : "ASC";
  const adjacentResult = await db.query(
    `
    WITH chicago_today AS (
      SELECT (NOW() AT TIME ZONE 'America/Chicago')::date AS today
    ),
    submission_counts AS (
      SELECT puzzle_id, COUNT(*)::int AS submission_count
      FROM puzzle_submission
      GROUP BY puzzle_id
    )
    SELECT dp.puzzle_id::text AS puzzle_id, dp.puzzle_date::text AS puzzle_date
    FROM daily_puzzle dp
    LEFT JOIN submission_counts sc
      ON sc.puzzle_id = dp.puzzle_id
    WHERE dp.sport = 'nfl'
      AND dp.puzzle_date > (SELECT today FROM chicago_today)
      AND COALESCE(sc.submission_count, 0) = 0
      AND dp.puzzle_date ${comparison} $1::date
    ORDER BY dp.puzzle_date ${orderDirection}, dp.puzzle_id ${orderDirection}
    LIMIT 1
    `,
    [puzzle.puzzle_date]
  );
  const adjacent = adjacentResult.rows[0];
  if (!adjacent) {
    throw new Error(
      direction === "earlier"
        ? "This puzzle is already the earliest editable future puzzle."
        : "This puzzle is already the latest editable future puzzle."
    );
  }

  await db.query(
    `
    UPDATE daily_puzzle
    SET puzzle_date = '2999-12-31'::date
    WHERE puzzle_id = $1::bigint
    `,
    [Number(puzzleId)]
  );
  await db.query(
    `
    UPDATE daily_puzzle
    SET puzzle_date = $2::date
    WHERE puzzle_id = $1::bigint
    `,
    [Number(adjacent.puzzle_id), puzzle.puzzle_date]
  );
  await db.query(
    `
    UPDATE daily_puzzle
    SET puzzle_date = $2::date
    WHERE puzzle_id = $1::bigint
    `,
    [Number(puzzleId), adjacent.puzzle_date]
  );

  await updateCachedPuzzleDate(db, Number(puzzleId), String(adjacent.puzzle_date));
  await updateCachedPuzzleDate(db, Number(adjacent.puzzle_id), String(puzzle.puzzle_date));
  await rebuildOptimalUsageTrackerDoc(db);
}

export async function deleteFuturePuzzleAndShift(
  db: DbClient,
  puzzleId: string | number
) {
  const puzzle = await assertFutureEditablePuzzle(db, puzzleId);

  const futureSubmissionResult = await db.query(
    `
    SELECT COUNT(*)::int AS submission_count
    FROM puzzle_submission ps
    JOIN daily_puzzle dp
      ON dp.puzzle_id = ps.puzzle_id
    WHERE dp.sport = 'nfl'
      AND dp.puzzle_date > $1::date
    `,
    [puzzle.puzzle_date]
  );
  if (Number(futureSubmissionResult.rows[0]?.submission_count ?? 0) > 0) {
    throw new Error(
      "Cannot shift future puzzles because one or more later dates already have submissions."
    );
  }

  await db.query(`DELETE FROM daily_puzzle WHERE puzzle_id = $1::bigint`, [Number(puzzleId)]);

  const laterPuzzlesResult = await db.query(
    `
    SELECT puzzle_id::text, puzzle_date::text
    FROM daily_puzzle
    WHERE sport = 'nfl'
      AND puzzle_date > $1::date
    ORDER BY puzzle_date ASC, puzzle_id ASC
    `,
    [puzzle.puzzle_date]
  );

  for (const row of laterPuzzlesResult.rows) {
    const shiftedDateResult = await db.query<{ shifted_date: string }>(
      `SELECT ($1::date - INTERVAL '1 day')::date::text AS shifted_date`,
      [row.puzzle_date]
    );
    const shiftedDate = shiftedDateResult.rows[0]?.shifted_date;
    if (!shiftedDate) {
      continue;
    }

    await db.query(
      `
      UPDATE daily_puzzle
      SET puzzle_date = $1::date
      WHERE puzzle_id = $2::bigint
      `,
      [shiftedDate, Number(row.puzzle_id)]
    );
    await updateCachedPuzzleDate(db, Number(row.puzzle_id), shiftedDate);
  }

  await rebuildOptimalUsageTrackerDoc(db);

  return {
    deletedPuzzleId: String(puzzleId),
    removedDate: String(puzzle.puzzle_date),
    shiftedCount: laterPuzzlesResult.rows.length,
  };
}

async function loadConfigDefinition(db: DbClient, config: DevPuzzleConfig) {
  if (config.slotRuleIds.length !== 5) {
    throw new Error("Exactly five slot rules are required.");
  }
  if (
    !Number.isInteger(config.startSeason) ||
    !Number.isInteger(config.endSeason) ||
    config.startSeason < 2000 ||
    config.endSeason > 2025 ||
    config.startSeason > config.endSeason
  ) {
    throw new Error("Choose a valid season or consecutive season range from 2000 to 2025.");
  }

  const themeRule =
    config.startSeason === config.endSeason
      ? `season:${config.startSeason}`
      : `season_range:${config.startSeason}-${config.endSeason}`;
  const themeDisplayName =
    config.startSeason === config.endSeason
      ? `${config.startSeason} Season`
      : `${config.startSeason}-${config.endSeason} Seasons`;

  const [themeResult, relationshipResult, slotRulesResult] = await Promise.all([
    db.query(
      `
      SELECT filter_id::text, filter_name, display_name, rule_logic_key
      FROM filter_definition
      WHERE rule_logic_key = $1
        AND filter_category = 'theme'
        AND active_flag = true
      LIMIT 1
      `,
      [themeRule]
    ),
    db.query(
      `
      SELECT relationship_rule_id::text, relationship_type, display_text, bonus_pct::float8 AS bonus_pct
      FROM relationship_rule_definition
      WHERE relationship_rule_id = $1
        AND active_flag = true
      LIMIT 1
      `,
      [Number(config.relationshipRuleId)]
    ),
    db.query(
      `
      SELECT slot_rule_id::text, rule_name, parameter_type, parameter_value, display_text
      FROM slot_rule_definition
      WHERE slot_rule_id = ANY($1::bigint[])
        AND active_flag = true
      `,
      [config.slotRuleIds.map((id) => Number(id))]
    ),
  ]);

  const theme = themeResult.rows[0] ?? {
    filter_id: `generated:${themeRule}`,
    filter_name:
      config.startSeason === config.endSeason
        ? `theme_season_${config.startSeason}`
        : `seasons_${config.startSeason}_${config.endSeason}`,
    display_name: themeDisplayName,
    rule_logic_key: themeRule,
  };
  const relationshipRule = relationshipResult.rows[0];

  if (!relationshipRule) {
    throw new Error("Relationship rule not found.");
  }

  const slotRuleMap = new Map(
    slotRulesResult.rows.map((row) => [String(row.slot_rule_id), row])
  );
  const slotRules = config.slotRuleIds.map((slotRuleId, index) => {
    const row = slotRuleMap.get(String(slotRuleId));
    if (!row) {
      throw new Error(`Slot rule ${slotRuleId} not found.`);
    }

    return {
      slot_number: index + 1,
      slot_rule_id: row.slot_rule_id,
      rule_name: row.rule_name,
      parameter_type: row.parameter_type,
      parameter_value: row.parameter_value,
      display_text: row.display_text,
    } satisfies SlotRule;
  });

  return { theme, relationshipRule, slotRules };
}

async function loadPlayersForTheme(db: DbClient, themeRule: string) {
  const playersResult = await db.query(
    `
    WITH themed_seasons AS (
      SELECT s.season
      FROM season_dim s
      WHERE
        CASE
          WHEN $1 ~ '^decade:\\d{4}s$'
            THEN s.season BETWEEN
                 SUBSTRING($1 FROM '(\\d{4})')::int
                 AND SUBSTRING($1 FROM '(\\d{4})')::int + 9
          WHEN $1 ~ '^season_range:\\d{4}-\\d{4}$'
            THEN s.season BETWEEN
                 SUBSTRING($1 FROM '(\\d{4})')::int
                 AND SUBSTRING($1 FROM '-(\\d{4})$')::int
          WHEN $1 ~ '^season:\\d{4}$'
            THEN s.season = SUBSTRING($1 FROM '(\\d{4})')::int
          WHEN $1 = 'seasons_2010s' THEN s.season BETWEEN 2010 AND 2019
          WHEN $1 = 'seasons_2000s' THEN s.season BETWEEN 2000 AND 2009
          WHEN $1 = 'seasons_2010_2015' THEN s.season BETWEEN 2010 AND 2015
          WHEN $1 = 'seasons_2020_2025' THEN s.season BETWEEN 2020 AND 2025
          WHEN $1 = 'season_2012' THEN s.season = 2012
          ELSE true
        END
    ),
    eligible_players AS (
      SELECT p.player_id
      FROM player_dim p
      WHERE p.primary_position IN ('QB', 'RB', 'WR', 'TE')
    ),
    player_theme_stats AS (
      SELECT
        ps.player_id,
        MIN(ps.season) AS theme_start_season,
        MAX(ps.season) AS theme_end_season,
        SUM(
          COALESCE(ps.passing_yards, 0) / 25.0 +
          COALESCE(ps.passing_td, 0) * 4.0 +
          COALESCE(ps.rushing_yards, 0) / 10.0 +
          COALESCE(ps.rushing_td, 0) * 6.0 +
          COALESCE(ps.receiving_yards, 0) / 10.0 +
          COALESCE(ps.receiving_td, 0) * 6.0 +
          COALESCE(ps.receptions, 0) * 1.0
        )::numeric(12,2) AS fantasy_points
      FROM player_season_stats ps
      JOIN themed_seasons ts
        ON ps.season = ts.season
      JOIN eligible_players ep
        ON ps.player_id = ep.player_id
      GROUP BY ps.player_id
    ),
    player_slot_traits AS (
      SELECT
        p.player_id,
        ARRAY_REMOVE(
          ARRAY_AGG(DISTINCT t.team_abbr)
            FILTER (WHERE t.team_abbr IS NOT NULL),
          NULL
        ) AS theme_team_abbrs,
        ARRAY_REMOVE(
          ARRAY_AGG(DISTINCT t.conference)
            FILTER (WHERE t.conference IS NOT NULL),
          NULL
        ) AS theme_conferences,
        ARRAY_REMOVE(
          ARRAY_AGG(DISTINCT CONCAT_WS(' ', t.conference, t.division))
            FILTER (
              WHERE t.conference IS NOT NULL
                AND t.division IS NOT NULL
            ),
          NULL
        ) AS theme_divisions
      FROM player_dim p
      JOIN eligible_players ep
        ON p.player_id = ep.player_id
      LEFT JOIN player_team_history pth
        ON p.player_id = pth.player_id
      LEFT JOIN team_dim t
        ON pth.team_id = t.team_id
      GROUP BY p.player_id
    ),
    player_college_traits AS (
      SELECT
        pch.player_id,
        ARRAY_REMOVE(
          ARRAY_AGG(DISTINCT pch.college_name),
          NULL
        ) AS player_colleges
      FROM player_college_history pch
      GROUP BY pch.player_id
    )
    SELECT
      p.player_id::text,
      p.player_name,
      p.primary_position,
      p.career_start_season,
      p.career_end_season,
      p.super_bowl_win_count,
      pts.theme_start_season,
      pts.theme_end_season,
      pts.fantasy_points::float8 AS fantasy_points,
      p.headshot_url,
      COALESCE(pct.player_colleges, ARRAY[]::text[]) AS player_colleges,
      COALESCE(pst.theme_team_abbrs, ARRAY[]::text[]) AS theme_team_abbrs,
      COALESCE(pst.theme_conferences, ARRAY[]::text[]) AS theme_conferences,
      COALESCE(pst.theme_divisions, ARRAY[]::text[]) AS theme_divisions
    FROM player_theme_stats pts
    JOIN player_dim p
      ON pts.player_id = p.player_id
    LEFT JOIN player_slot_traits pst
      ON p.player_id = pst.player_id
    LEFT JOIN player_college_traits pct
      ON p.player_id = pct.player_id
    ORDER BY pts.fantasy_points DESC, p.player_name
    `,
    [themeRule]
  );

  return playersResult.rows as CandidatePlayer[];
}

async function loadPairRelationships(
  db: DbClient,
  candidateIds: number[],
  themeRule: string
) {
  if (candidateIds.length < 2) {
    return [] as PairRelationship[];
  }

  const result = await db.query(
    `
    WITH themed_seasons AS (
      SELECT s.season
      FROM season_dim s
      WHERE
        CASE
          WHEN $2 ~ '^decade:\\d{4}s$'
            THEN s.season BETWEEN
                 SUBSTRING($2 FROM '(\\d{4})')::int
                 AND SUBSTRING($2 FROM '(\\d{4})')::int + 9
          WHEN $2 ~ '^season_range:\\d{4}-\\d{4}$'
            THEN s.season BETWEEN
                 SUBSTRING($2 FROM '(\\d{4})')::int
                 AND SUBSTRING($2 FROM '-(\\d{4})$')::int
          WHEN $2 ~ '^season:\\d{4}$'
            THEN s.season = SUBSTRING($2 FROM '(\\d{4})')::int
          WHEN $2 = 'seasons_2010s' THEN s.season BETWEEN 2010 AND 2019
          WHEN $2 = 'seasons_2000s' THEN s.season BETWEEN 2000 AND 2009
          WHEN $2 = 'seasons_2010_2015' THEN s.season BETWEEN 2010 AND 2015
          WHEN $2 = 'seasons_2020_2025' THEN s.season BETWEEN 2020 AND 2025
          WHEN $2 = 'season_2012' THEN s.season = 2012
          ELSE true
        END
    ),
    pair_base AS (
      SELECT
        p1.player_id AS player_id_1,
        p2.player_id AS player_id_2
      FROM unnest($1::bigint[]) p1(player_id)
      JOIN unnest($1::bigint[]) p2(player_id)
        ON p1.player_id < p2.player_id
    ),
    teammate_flags AS (
      SELECT
        pb.player_id_1,
        pb.player_id_2,
        CASE
          WHEN EXISTS (
            SELECT 1
            FROM player_team_history a
            JOIN player_team_history b
              ON a.season = b.season
             AND a.team_id = b.team_id
            JOIN themed_seasons ts
              ON a.season = ts.season
            WHERE a.player_id = pb.player_id_1
              AND b.player_id = pb.player_id_2
          )
          THEN true
          ELSE false
        END AS were_teammates_flag
      FROM pair_base pb
    )
    SELECT
      pb.player_id_1::text,
      pb.player_id_2::text,
      tf.were_teammates_flag,
      CASE
        WHEN EXISTS (
          SELECT 1
          FROM player_team_history a
          JOIN player_team_history b
            ON COALESCE(a.franchise_id, -1) = COALESCE(b.franchise_id, -2)
          WHERE a.player_id = pb.player_id_1
            AND b.player_id = pb.player_id_2
            AND a.franchise_id IS NOT NULL
        )
        THEN true
        ELSE false
      END AS same_franchise_flag,
      CASE
        WHEN EXISTS (
          SELECT 1
          FROM player_college_history c1
          JOIN player_college_history c2
            ON c1.college_name = c2.college_name
          WHERE c1.player_id = pb.player_id_1
            AND c2.player_id = pb.player_id_2
        )
        THEN true
        ELSE false
      END AS same_college_flag,
      CASE
        WHEN p1.draft_year IS NOT NULL
         AND COALESCE(p1.undrafted_flag, false) = false
         AND COALESCE(p2.undrafted_flag, false) = false
         AND p1.draft_year = p2.draft_year
        THEN true
        ELSE false
      END AS same_draft_class_flag,
      CASE
        WHEN p1.draft_round IS NOT NULL
         AND p1.draft_round = p2.draft_round
        THEN true
        ELSE false
      END AS same_draft_round_flag,
      CASE
        WHEN COALESCE(p1.undrafted_flag, false) = true
         AND COALESCE(p2.undrafted_flag, false) = true
        THEN true
        ELSE false
      END AS both_undrafted_flag,
      CASE
        WHEN p1.draft_round IS NOT NULL
         AND p2.draft_round IS NOT NULL
         AND p1.draft_round > 1
         AND p2.draft_round > 1
        THEN true
        ELSE false
      END AS both_non_first_round_pick_flag,
      CASE
        WHEN p1.draft_round BETWEEN 4 AND 7
         AND p2.draft_round BETWEEN 4 AND 7
        THEN true
        ELSE false
      END AS both_day_3_pick_flag,
      CASE
        WHEN COALESCE(p1.super_bowl_win_count, 0) > 0
         AND COALESCE(p2.super_bowl_win_count, 0) > 0
        THEN true
        ELSE false
      END AS both_super_bowl_winner_flag,
      CASE
        WHEN COALESCE(p1.super_bowl_win_count, 0) = 0
         AND COALESCE(p2.super_bowl_win_count, 0) = 0
        THEN true
        ELSE false
      END AS both_non_super_bowl_winner_flag,
      CASE
          WHEN EXISTS (
            SELECT 1
            FROM player_team_history a
            JOIN team_dim ta
              ON a.team_id = ta.team_id
            WHERE a.player_id = pb.player_id_1
            AND ${canonicalTeamAbbrSql("ta.team_abbr")} = 'GB'
          )
          AND EXISTS (
            SELECT 1
            FROM player_team_history b
            JOIN team_dim tb
              ON b.team_id = tb.team_id
            WHERE b.player_id = pb.player_id_2
            AND ${canonicalTeamAbbrSql("tb.team_abbr")} = 'GB'
          )
        THEN true
        ELSE false
      END AS both_played_packers_flag,
      CASE
        WHEN p1.primary_position IS NOT NULL
         AND p1.primary_position = p2.primary_position
        THEN true
        ELSE false
      END AS same_position_flag
    FROM pair_base pb
    LEFT JOIN teammate_flags tf
      ON pb.player_id_1 = tf.player_id_1
     AND pb.player_id_2 = tf.player_id_2
    JOIN player_dim p1
      ON p1.player_id = pb.player_id_1
    JOIN player_dim p2
      ON p2.player_id = pb.player_id_2
    `,
    [candidateIds, themeRule]
  );

  return result.rows as PairRelationship[];
}

async function loadPreviousUsageCounts(db: DbClient, playerIds: string[]) {
  if (playerIds.length === 0) {
    return new Map<string, number>();
  }

  const result = await db.query(
    `
    SELECT
      entry.value->'player'->>'player_id' AS player_id,
      COUNT(*)::int AS usage_count
    FROM daily_puzzle dp
    JOIN optimal_lineup_cache oc
      ON oc.puzzle_id = dp.puzzle_id
    CROSS JOIN LATERAL jsonb_array_elements(oc.payload->'optimal_lineup') entry(value)
    WHERE dp.sport = 'nfl'
      AND entry.value->'player'->>'player_id' = ANY($1::text[])
    GROUP BY entry.value->'player'->>'player_id'
    `,
    [playerIds]
  );

  return new Map(
    result.rows.map((row) => [String(row.player_id), Number(row.usage_count)])
  );
}

export async function computePreviewPayload(
  db: DbClient,
  config: DevPuzzleConfig,
  options?: {
    generatorSettings?: DevGeneratorSettings | null;
  }
): Promise<PreviewPayload> {
  await ensureDevAutomationTables(db);

  const { theme, relationshipRule, slotRules } = await loadConfigDefinition(
    db,
    config
  );

  if (
    await hasKnownInvalidConfig(
      db,
      theme.rule_logic_key,
      slotRules,
      config.positionOverlayEnabled,
      config.qbExclusionEnabled
    )
  ) {
    throw new Error("No valid candidate pool for one or more slots.");
  }

  const generationSignature = buildGenerationSignature(
    theme.rule_logic_key,
    relationshipRule,
    slotRules,
    config.positionOverlayEnabled,
    config.qbExclusionEnabled
  );

  const generatorSettings = options?.generatorSettings ?? null;
  if (generatorSettings) {
    const knownThresholdFailure = await hasKnownThresholdFailure(
      db,
      generationSignature,
      generatorSettings
    );
    if (knownThresholdFailure) {
      throw new Error("Configuration cannot meet current generator thresholds.");
    }
  }

  const knownInvalidSlotRuleIds = await getKnownInvalidSlotRuleIds(
    db,
    theme.rule_logic_key,
    slotRules,
    config.positionOverlayEnabled,
    config.qbExclusionEnabled
  );
  if (
    slotRules.some((rule) =>
      knownInvalidSlotRuleIds.has(String(rule.slot_rule_id))
    )
  ) {
    throw new Error("No valid candidate pool for one or more slots.");
  }

  if (generatorSettings) {
    const cachedSlotMetrics = await getCachedSlotCandidateMetrics(
      db,
      theme.rule_logic_key,
      slotRules,
      config.positionOverlayEnabled,
      config.qbExclusionEnabled
    );
    if (cachedSlotMetrics.size === slotRules.length) {
      const minimumFantasyPoints =
        (config.endSeason - config.startSeason + 1) *
        generatorSettings.minFantasyPointsPerSeason;
      const impossibleByImpact = slotRules.some((rule) => {
        const metric = cachedSlotMetrics.get(String(rule.slot_rule_id));
        return metric ? metric.top_fantasy_points < minimumFantasyPoints : false;
      });

      if (impossibleByImpact) {
        await recordThresholdFailure(
          db,
          generationSignature,
          generatorSettings,
          "impact_threshold"
        );
        throw new Error("Configuration cannot meet current generator thresholds.");
      }
    }
  }

  const players = await loadPlayersForTheme(db, theme.rule_logic_key);

  const slotCandidates = slotRules.map((rule) => {
    const limit = SLOT_LIMITS[rule.parameter_type] ?? 20;
    return {
      ...rule,
      candidates: players
        .filter(
          (player) =>
            playerMatchesSlotRule(player, rule) &&
            playerAllowedByPuzzleRules(player.primary_position, {
              positionLockEnabled: config.positionOverlayEnabled,
              qbExclusionEnabled: config.qbExclusionEnabled,
            })
        )
        .slice(0, limit),
    };
  });

  await recordSlotCandidateMetrics(
    db,
    theme.rule_logic_key,
    slotCandidates,
    config.positionOverlayEnabled,
    config.qbExclusionEnabled
  );

  if (config.positionOverlayEnabled && config.qbExclusionEnabled) {
    throw new Error("One-of-each lock cannot be combined with No QBs.");
  }

  const failingSlots = slotCandidates.filter((slot) => slot.candidates.length === 0);
  if (failingSlots.length > 0) {
    await recordInvalidCandidatePool(
      db,
      theme.rule_logic_key,
      slotRules,
      failingSlots,
      config.positionOverlayEnabled,
      config.qbExclusionEnabled
    );
    throw new Error("No valid candidate pool for one or more slots.");
  }

  if (generatorSettings) {
    const minimumFantasyPoints =
      (config.endSeason - config.startSeason + 1) *
      generatorSettings.minFantasyPointsPerSeason;
    const impossibleByImpact = slotCandidates.some(
      (slot) => Number(slot.candidates[0]?.fantasy_points ?? 0) < minimumFantasyPoints
    );
    if (impossibleByImpact) {
      await recordThresholdFailure(
        db,
        generationSignature,
        generatorSettings,
        "impact_threshold"
      );
      throw new Error("Configuration cannot meet current generator thresholds.");
    }
  }

  const candidateIds = Array.from(
    new Set(
      slotCandidates.flatMap((slot) =>
        slot.candidates.map((player) => Number(player.player_id))
      )
    )
  ).filter((id) => Number.isInteger(id) && id > 0);

  const pairRelationships = await loadPairRelationships(
    db,
    candidateIds,
    theme.rule_logic_key
  );
  const pairMap = new Map<string, PairRelationship>();

  pairRelationships.forEach((pair) => {
    pairMap.set(getPairKey(pair.player_id_1, pair.player_id_2), pair);
  });

  const orderedSlots = [...slotCandidates].sort(
    (a, b) => a.candidates.length - b.candidates.length
  );
  const remainingMaxBase = new Array<number>(orderedSlots.length).fill(0);

  for (let index = orderedSlots.length - 1; index >= 0; index -= 1) {
    const slotMax = orderedSlots[index].candidates[0]?.fantasy_points ?? 0;
    remainingMaxBase[index] = slotMax + (remainingMaxBase[index + 1] ?? 0);
  }

  let best: BestLineupResult | null = null;

  const chosen = new Map<number, CandidatePlayer>();
  const usedIds = new Set<string>();

  function search(index: number, currentBase: number, currentActiveLinks: number) {
    const remainingSlots = orderedSlots.length - index;
    const chosenCount = chosen.size;
    const optimisticBase = currentBase + (remainingMaxBase[index] ?? 0);
    const optimisticMaxLinks = Math.min(
      10,
      currentActiveLinks +
        chosenCount * remainingSlots +
        combinationsOfTwo(remainingSlots)
    );
    const optimisticScore =
      optimisticBase *
      getLinkMultiplier(
        optimisticMaxLinks,
        Number(relationshipRule.bonus_pct ?? 10)
      );

    if (best && optimisticScore <= best.final_score) {
      return;
    }

    const chosenPositions = Array.from(chosen.values()).map(
      (entry) => entry.primary_position
    );
    if (
      !partialLineupCanStillSatisfyPuzzleRules(
        chosenPositions,
        orderedSlots.length - index,
        {
          positionLockEnabled: config.positionOverlayEnabled,
          qbExclusionEnabled: config.qbExclusionEnabled,
        }
      )
    ) {
      return;
    }

    if (index >= orderedSlots.length) {
      const lineup = slotRules.map((rule) => ({
        slot_number: rule.slot_number,
        slot_rule: rule,
        player: chosen.get(rule.slot_number)!,
      }));

      if (
        !lineupSatisfiesPuzzleRules(
          lineup.map((entry) => entry.player.primary_position),
          {
            positionLockEnabled: config.positionOverlayEnabled,
            qbExclusionEnabled: config.qbExclusionEnabled,
          }
        )
      ) {
        return;
      }

      const finalScore =
        currentBase *
        getLinkMultiplier(
          currentActiveLinks,
          Number(relationshipRule.bonus_pct ?? 10)
        );

      if (!best || finalScore > best.final_score) {
        best = {
          lineup,
          base_score: currentBase,
          active_links: currentActiveLinks,
          final_score: finalScore,
        };
      }
      return;
    }

    const slot = orderedSlots[index];
    for (const candidate of slot.candidates) {
      if (usedIds.has(candidate.player_id)) continue;

      let addedLinks = 0;
      for (const existing of chosen.values()) {
        const pair = pairMap.get(
          getPairKey(existing.player_id, candidate.player_id)
        );
        if (relationshipPasses(relationshipRule.relationship_type, pair)) {
          addedLinks += 1;
        }
      }

      usedIds.add(candidate.player_id);
      chosen.set(slot.slot_number, candidate);
      search(
        index + 1,
        currentBase + Number(candidate.fantasy_points),
        currentActiveLinks + addedLinks
      );
      chosen.delete(slot.slot_number);
      usedIds.delete(candidate.player_id);
    }
  }

  search(0, 0, 0);

  if (!best) {
    throw new Error("Failed to compute optimal lineup.");
  }
  const resolvedBest: BestLineupResult = best;

  const previousUsage = await loadPreviousUsageCounts(
    db,
    resolvedBest.lineup.map((entry) => String(entry.player.player_id))
  );

  const optimalLineupWithUsage = resolvedBest.lineup.map((entry) => ({
    ...entry,
    previous_optimal_usage_count:
      previousUsage.get(String(entry.player.player_id)) ?? 0,
  }));

  if (generatorSettings) {
    const thresholdEvaluation = evaluatePreviewAgainstGeneratorThresholds(
      {
        theme,
        relationship_rule: relationshipRule,
        candidate_pool_summary: [],
        optimal_lineup: optimalLineupWithUsage,
        optimal_base_score: resolvedBest.base_score,
        optimal_active_links: resolvedBest.active_links,
        optimal_multiplier: getLinkMultiplier(
          resolvedBest.active_links,
          Number(relationshipRule.bonus_pct ?? 10)
        ),
        optimal_final_score: resolvedBest.final_score,
        position_overlay_enabled: config.positionOverlayEnabled,
        qb_exclusion_enabled: config.qbExclusionEnabled,
      },
      generatorSettings,
      config.startSeason,
      config.endSeason
    );

    if (!thresholdEvaluation.passed && thresholdEvaluation.failureReason) {
      await recordThresholdFailure(
        db,
        generationSignature,
        generatorSettings,
        thresholdEvaluation.failureReason
      );
    }
  }

  return {
    theme,
    relationship_rule: relationshipRule,
    candidate_pool_summary: slotCandidates.map((slot) => ({
      slot_number: slot.slot_number,
      display_text: slot.display_text,
      parameter_type: slot.parameter_type,
      candidate_count: slot.candidates.length,
    })),
    optimal_lineup: optimalLineupWithUsage,
    optimal_base_score: resolvedBest.base_score,
    optimal_active_links: resolvedBest.active_links,
    optimal_multiplier: getLinkMultiplier(
      resolvedBest.active_links,
      Number(relationshipRule.bonus_pct ?? 10)
    ),
    optimal_final_score: resolvedBest.final_score,
    position_overlay_enabled: config.positionOverlayEnabled,
    qb_exclusion_enabled: config.qbExclusionEnabled,
  };
}

export async function savePuzzleFromConfig(
  db: DbClient,
  config: DevPuzzleConfig,
  options?: {
    publishedFlag?: boolean;
    puzzleDate?: string | null;
  }
) {
  const title = config.title.trim();
  if (!title) {
    throw new Error("Puzzle title is required.");
  }

  const allPlayersEligibilityResult = await db.query(
    `
    SELECT filter_id::text
    FROM filter_definition
    WHERE rule_logic_key = 'all_players'
    LIMIT 1
    `
  );

  const multiplierResult = await db.query(
    `
    SELECT multiplier_id::text
    FROM multiplier_definition
    ORDER BY multiplier_id ASC
    LIMIT 1
    `
  );

  const nextDateResult = await db.query(
    `
    SELECT COALESCE((MAX(puzzle_date) + INTERVAL '1 day')::date::text, ((NOW() AT TIME ZONE 'America/Chicago')::date)::text) AS next_available_date
    FROM daily_puzzle
    WHERE sport = 'nfl'
    `
  );

  const eligibilityFilterId = allPlayersEligibilityResult.rows[0]?.filter_id;
  const multiplierId = multiplierResult.rows[0]?.multiplier_id;
  const nextAvailableDate =
    typeof options?.puzzleDate === "string" && options.puzzleDate
      ? options.puzzleDate
      : nextDateResult.rows[0]?.next_available_date;
  const publishedFlag = options?.publishedFlag ?? true;

  if (!eligibilityFilterId || !multiplierId || !nextAvailableDate) {
    throw new Error("Unable to resolve puzzle save dependencies.");
  }

  const previewPayload = await computePreviewPayload(db, config);
  const { theme, relationship_rule, optimal_lineup } = previewPayload;
  const slotRules = optimal_lineup.map((entry) => entry.slot_rule);
  const canonicalThemeFilterName = buildCanonicalThemeFilterName(
    theme.rule_logic_key
  );
  const existingThemeResult = await db.query(
    `
    SELECT filter_id::text
    FROM filter_definition
    WHERE (rule_logic_key = $1 OR filter_name = $2)
      AND filter_category = 'theme'
    LIMIT 1
    `,
    [theme.rule_logic_key, canonicalThemeFilterName]
  );
  let themeFilterId = existingThemeResult.rows[0]?.filter_id ?? null;
  if (!themeFilterId) {
    const insertedThemeResult = await db.query(
      `
      INSERT INTO filter_definition (
        filter_name,
        display_name,
        filter_category,
        rule_logic_key,
        active_flag
      )
      VALUES ($1, $2, 'theme', $3, true)
      ON CONFLICT (filter_name)
      DO UPDATE SET
        display_name = EXCLUDED.display_name,
        rule_logic_key = EXCLUDED.rule_logic_key,
        active_flag = true
      RETURNING filter_id::text
      `,
      [canonicalThemeFilterName, theme.display_name, theme.rule_logic_key]
    );
    themeFilterId = insertedThemeResult.rows[0]?.filter_id ?? null;
  }
  const statPoolResult = await db.query(
    `
    SELECT stat_id::text, stat_name
    FROM stat_definition
    WHERE stat_name = ANY($1::text[])
    ORDER BY array_position($1::text[], stat_name)
    `,
    [[
      "fantasy_points_ppr",
      "passing_yards",
      "rushing_yards",
      "receiving_yards",
    ]]
  );

  const insertedPuzzle = await db.query(
    `
    INSERT INTO daily_puzzle (
      puzzle_date,
      sport,
      title,
      filter_id,
      theme_filter_id,
      eligibility_filter_id,
      relationship_rule_id,
      multiplier_id,
      stat_pool_size,
      selection_count,
      published_flag,
      position_overlay_enabled,
      qb_exclusion_enabled
    )
    VALUES ($1::date, 'nfl', $2, $3::bigint, $3::bigint, $4::bigint, $5::bigint, $6::bigint, 4, 5, $7, $8, $9)
    RETURNING puzzle_id::text, puzzle_date::text
    `,
    [
      nextAvailableDate,
      title,
      Number(themeFilterId),
      Number(eligibilityFilterId),
      Number(relationship_rule.relationship_rule_id),
      Number(multiplierId),
      publishedFlag,
      config.positionOverlayEnabled,
      config.qbExclusionEnabled,
    ]
  );

  const puzzleId = insertedPuzzle.rows[0]?.puzzle_id;

  if (!puzzleId) {
    throw new Error("Puzzle insert failed.");
  }

  for (const slotRule of slotRules) {
    await db.query(
      `
      INSERT INTO daily_puzzle_slot_rule (puzzle_id, slot_number, slot_rule_id)
      VALUES ($1::bigint, $2::int, $3::bigint)
      `,
      [Number(puzzleId), Number(slotRule.slot_number), Number(slotRule.slot_rule_id)]
    );
  }

  for (const [index, stat] of statPoolResult.rows.entries()) {
    await db.query(
      `
      INSERT INTO daily_puzzle_stat_pool (puzzle_id, stat_id, display_order)
      VALUES ($1::bigint, $2::bigint, $3::int)
      `,
      [Number(puzzleId), Number(stat.stat_id), index + 1]
    );
  }

  const configSignature = buildConfigSignature(
    puzzleId,
    theme.rule_logic_key,
    relationship_rule,
    slotRules,
    config.positionOverlayEnabled,
    config.qbExclusionEnabled
  );

  await db.query(
    `
    INSERT INTO optimal_lineup_cache (puzzle_id, config_signature, payload, computed_at)
    VALUES ($1::bigint, $2, $3::jsonb, NOW())
    ON CONFLICT (puzzle_id)
    DO UPDATE SET
      config_signature = EXCLUDED.config_signature,
      payload = EXCLUDED.payload,
      computed_at = NOW()
    `,
    [
      Number(puzzleId),
      configSignature,
      JSON.stringify({
        puzzle_date: nextAvailableDate,
        relationship_rule: previewPayload.relationship_rule,
        candidate_pool_summary: previewPayload.candidate_pool_summary,
        optimal_lineup: previewPayload.optimal_lineup.map((entry) => ({
          slot_number: entry.slot_number,
          slot_rule: entry.slot_rule,
          player: entry.player,
        })),
        optimal_base_score: previewPayload.optimal_base_score,
        optimal_active_links: previewPayload.optimal_active_links,
        optimal_multiplier: previewPayload.optimal_multiplier,
        optimal_final_score: previewPayload.optimal_final_score,
        position_overlay_enabled: previewPayload.position_overlay_enabled,
        qb_exclusion_enabled: previewPayload.qb_exclusion_enabled,
      }),
    ]
  );

  await rebuildOptimalUsageTrackerDoc(db);

  return {
    puzzleId,
    puzzleDate: nextAvailableDate,
    preview: previewPayload,
  };
}

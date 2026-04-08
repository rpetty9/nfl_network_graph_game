"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { signIn, useSession } from "next-auth/react";

type RelationshipOption = {
  relationship_rule_id: string;
  relationship_type: string;
  display_text: string;
  bonus_pct: number;
};

type SlotRuleOption = {
  slot_rule_id: string;
  rule_name: string;
  parameter_type: string;
  parameter_value: string | null;
  display_text: string;
  random_weight: number;
};

type DevMetaResponse = {
  relationships: RelationshipOption[];
  slotRules: SlotRuleOption[];
  nextAvailableDate: string;
};

type PreviewResponse = {
  theme: {
    filter_id: string | number;
    filter_name: string;
    display_name: string;
    rule_logic_key: string;
  };
  relationship_rule: RelationshipOption;
  candidate_pool_summary: Array<{
    slot_number: number;
    display_text: string;
    parameter_type: string;
    candidate_count: number;
  }>;
  optimal_lineup: Array<{
    slot_number: number;
    slot_rule: {
      slot_number: number;
      slot_rule_id: string | number;
      rule_name: string;
      parameter_type: string;
      parameter_value: string | null;
      display_text: string;
    };
    player: {
      player_id: string;
      player_name: string;
      primary_position: string | null;
      fantasy_points: number;
      theme_start_season: number | null;
      theme_end_season: number | null;
    };
    previous_optimal_usage_count: number;
  }>;
  optimal_base_score: number;
  optimal_active_links: number;
  optimal_multiplier: number;
  optimal_final_score: number;
  position_overlay_enabled: boolean;
  qb_exclusion_enabled: boolean;
};

type PuzzleListItem = {
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

type PuzzleDetailResponse = {
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

type GeneratorSettings = {
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

type GeneratorJobStatus = {
  job_id: string;
  active_flag: boolean;
  settings: GeneratorSettings;
  last_status: string | null;
  last_error: string | null;
  last_run_at: string | null;
  updated_at: string | null;
  created_at: string | null;
};

type PendingPuzzleListItem = PuzzleListItem & {
  optimal_active_links: number | null;
  optimal_final_score: number | null;
  usage_total: number;
  qb_count: number;
};

type ApprovalQueueResponse = {
  job: GeneratorJobStatus | null;
  pendingPuzzles: PendingPuzzleListItem[];
};

type DashboardStatsResponse = {
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

type SubmissionInspectorResponse = {
  lookup: {
    username: string;
    date: string;
    mode: "production" | "testing";
  };
  puzzle: {
    puzzle_id: string;
    puzzle_date: string;
    title: string;
    theme_display_name: string;
    theme_rule_logic_key: string;
    relationship_rule: {
      relationship_type: string;
      display_text: string;
      bonus_pct: number;
    };
    position_overlay_enabled: boolean;
    qb_exclusion_enabled: boolean;
    slot_rules: Array<{
      slot_number: number;
      display_text: string;
      parameter_type: string;
      parameter_value: string | null;
      rule_name: string;
    }>;
  };
  submission: {
    submission_id: string;
    display_name: string;
    username: string | null;
    submitted_at: string;
    stored_base_score: number;
    stored_active_links: number;
    stored_multiplier: number;
    stored_final_score: number;
    optimal_final_score: number | null;
    percent_of_optimal: number | null;
    recomputed_base_score: number;
    recomputed_active_links: number;
    recomputed_multiplier: number;
    recomputed_final_score: number;
    lineup_rule_passes: boolean;
  };
  lineup: Array<{
    slot_number: number;
    slot_rule: {
      slot_number: number;
      display_text: string;
      parameter_type: string;
      parameter_value: string | null;
      rule_name: string;
    };
    submitted_fantasy_points: number;
    slot_match: boolean;
    lineup_rule_match: boolean;
    player: {
      player_id: string;
      player_name: string;
      primary_position: string | null;
      career_start_season: number | null;
      career_end_season: number | null;
      fantasy_points: number;
      theme_start_season: number | null;
      theme_end_season: number | null;
      super_bowl_win_count: number | null;
      draft_round: number | null;
      draft_year: number | null;
      undrafted_flag: boolean | null;
      headshot_url: string | null;
      player_colleges: string[];
      theme_team_abbrs: string[];
      theme_conferences: string[];
      theme_divisions: string[];
    };
  }>;
  pair_debug: Array<{
    player_id_1: string;
    player_name_1: string;
    player_id_2: string;
    player_name_2: string;
    active_for_puzzle: boolean;
    flags?: {
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
  }>;
};

const STATS_TREND_WINDOWS = [
  { label: "14D", days: 14, subtitle: "Last 14 days" },
  { label: "1M", days: 30, subtitle: "Last month" },
  { label: "4M", days: 120, subtitle: "Last 4 months" },
  { label: "6M", days: 180, subtitle: "Last 6 months" },
  { label: "1Y", days: 365, subtitle: "Last year" },
] as const;

const SEARCH_SPACE_SNAPSHOT = {
  activeLinkTypes: 11,
  slotParameters: 165,
  colleges: 107,
  teams: 42,
  conferences: 2,
  divisions: 8,
  positions: 5,
  anySlots: 1,
  toggleModes: 3,
  autoThemeRanges: 17,
  fullThemeRanges: 351,
  orderedSlotTuples: "115,041,963,960",
  autoQueueSpace: "64.5 trillion",
  fullBuilderSpace: "1.33 quadrillion",
} as const;

const AUTO_QUEUE_SEARCH_SPACE_COUNT = 64538541781560;
const FULL_BUILDER_SEARCH_SPACE_COUNT = 1332531068548680;

const DEFAULT_SLOT_RULE_NAMES = [
  "position_qb",
  "position_rb",
  "position_wr",
  "position_te",
  "flex_player",
];
const MIN_SEASON = 2000;
const MAX_SEASON = 2025;
const COLLEGE_TYPE_PICK_RATE = 0.2;
const MAX_AUTO_BUILD_ATTEMPTS = 150;
const MIN_FANTASY_POINTS_PER_SEASON = 50;
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
];
const MAX_AUTO_BUILD_QBS = 2;
const DEFAULT_GENERATOR_SETTINGS: GeneratorSettings = {
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

type OptimizerLogEntry = {
  log_id: string;
  log_key?: string | null;
  timestamp: string;
  kind: "milestone" | "run" | "success" | "error" | "settings";
  title: string;
  detail: string;
  metadata?: Record<string, unknown> | null;
};

type BuilderConfig = {
  startSeason: number;
  endSeason: number;
  relationshipRuleId: string;
  slotRuleIds: string[];
  title: string;
  positionOverlayEnabled?: boolean;
  qbExclusionEnabled?: boolean;
};

function LockButton({
  locked,
  onClick,
}: {
  locked: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] transition ${
        locked
          ? "border-amber-300/40 bg-amber-300/15 text-amber-100"
          : "border-white/15 bg-slate-950/35 text-slate-300"
      }`}
      aria-pressed={locked}
    >
      {locked ? "Locked" : "Unlocked"}
    </button>
  );
}

function formatNumber(value: number) {
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatCompactLargeNumber(value: number) {
  if (!Number.isFinite(value)) {
    return "N/A";
  }
  return new Intl.NumberFormat(undefined, {
    notation: "compact",
    maximumFractionDigits: 2,
  }).format(value);
}

function formatDurationEstimate(minutes: number) {
  if (!Number.isFinite(minutes) || minutes <= 0) {
    return "N/A";
  }
  if (minutes < 1) {
    return `${Math.max(minutes * 60, 1).toFixed(0)} sec`;
  }
  if (minutes < 60) {
    return `${minutes.toFixed(1)} min`;
  }
  const hours = minutes / 60;
  if (hours < 24) {
    return `${hours.toFixed(1)} hr`;
  }
  const days = hours / 24;
  if (days < 365) {
    return `${days.toFixed(1)} days`;
  }
  const years = days / 365;
  return `${years.toFixed(1)} years`;
}

function formatDateLabel(dateValue: string) {
  const parsed = new Date(`${dateValue}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return dateValue;
  }
  return parsed.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatShortDateLabel(dateValue: string) {
  const parsed = new Date(`${dateValue}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return dateValue;
  }
  return parsed.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function TrendChart({
  title,
  subtitle,
  accentClassName,
  series,
}: {
  title: string;
  subtitle: string;
  accentClassName: string;
  series: Array<{ date: string; count: number }>;
}) {
  const safeSeries = series.length > 0 ? series : [{ date: "", count: 0 }];
  const values = safeSeries.map((point) => point.count);
  const maxValue = Math.max(...values, 1);
  const minValue = Math.min(...values, 0);
  const range = Math.max(maxValue - minValue, 1);
  const width = 100;
  const height = 44;
  const points = safeSeries
    .map((point, index) => {
      const x =
        safeSeries.length === 1 ? width / 2 : (index / (safeSeries.length - 1)) * width;
      const y = height - ((point.count - minValue) / range) * height;
      return `${x},${y}`;
    })
    .join(" ");
  const latest = safeSeries[safeSeries.length - 1]?.count ?? 0;
  const peak = Math.max(...values, 0);
  const startLabel = safeSeries[0]?.date ? formatShortDateLabel(safeSeries[0].date) : "";
  const endLabel = safeSeries[safeSeries.length - 1]?.date
    ? formatShortDateLabel(safeSeries[safeSeries.length - 1].date)
    : "";

  return (
    <div className="rounded-[24px] border border-white/10 bg-white/5 p-5 shadow-[0_24px_80px_rgba(2,6,23,0.32)] backdrop-blur-xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-300">
            {title}
          </p>
          <p className="mt-2 text-sm text-slate-300">{subtitle}</p>
        </div>
        <div className="text-right">
          <p className={`text-3xl font-black ${accentClassName}`}>{latest.toLocaleString()}</p>
          <p className="mt-1 text-xs text-slate-400">Peak {peak.toLocaleString()}</p>
        </div>
      </div>
      <div className="mt-5 rounded-[22px] border border-white/10 bg-slate-950/35 px-3 py-4">
        <svg viewBox={`0 0 ${width} ${height + 6}`} className="h-32 w-full overflow-visible">
          <defs>
            <linearGradient id={`trend-fill-${title.replace(/\s+/g, "-").toLowerCase()}`} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="currentColor" stopOpacity="0.35" />
              <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
            </linearGradient>
          </defs>
          <polyline
            fill="none"
            stroke="rgba(148, 163, 184, 0.18)"
            strokeWidth="0.75"
            points={`0,${height} ${width},${height}`}
          />
          <polygon
            fill={`url(#trend-fill-${title.replace(/\s+/g, "-").toLowerCase()})`}
            points={`0,${height} ${points} ${width},${height}`}
            className={accentClassName}
          />
          <polyline
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinejoin="round"
            strokeLinecap="round"
            points={points}
            className={accentClassName}
          />
          {safeSeries.map((point, index) => {
            const x =
              safeSeries.length === 1
                ? width / 2
                : (index / (safeSeries.length - 1)) * width;
            const y = height - ((point.count - minValue) / range) * height;
            return (
              <circle
                key={`${point.date}-${index}`}
                cx={x}
                cy={y}
                r="1.7"
                fill="white"
                className={accentClassName}
              />
            );
          })}
        </svg>
        <div className="mt-1 flex items-center justify-between text-[11px] font-black uppercase tracking-[0.12em] text-slate-500">
          <span>{startLabel}</span>
          <span>{endLabel}</span>
        </div>
      </div>
    </div>
  );
}

function pickWeightedRule(items: SlotRuleOption[]) {
  const weightedItems = items.filter(
    (item) => Number(item.random_weight ?? 0) > 0
  );
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

function pickRandomItem<T>(items: T[]) {
  if (items.length === 0) return null;
  return items[Math.floor(Math.random() * items.length)] ?? null;
}

function pickRandomDistinctIndices(count: number, pickCount: number) {
  const pool = Array.from({ length: count }, (_, index) => index);
  const picks: number[] = [];
  const safePickCount = Math.max(0, Math.min(count, pickCount));

  for (let step = 0; step < safePickCount; step += 1) {
    const chosenPoolIndex = Math.floor(Math.random() * pool.length);
    const [picked] = pool.splice(chosenPoolIndex, 1);
    if (picked == null) {
      break;
    }
    picks.push(picked);
  }

  return picks.sort((a, b) => a - b);
}

export default function DevPuzzlePage() {
  const { data: session, status } = useSession();
  const isAdmin = Boolean(session?.user?.isAdmin);
  const autoBuildStopRequestedRef = useRef(false);
  const approvalAutoQueueStopRequestedRef = useRef(false);
  const approvalAutoQueueRunningRef = useRef(false);

  const [meta, setMeta] = useState<DevMetaResponse | null>(null);
  const [metaLoading, setMetaLoading] = useState(false);
  const [metaError, setMetaError] = useState<string | null>(null);

  const [startSeason, setStartSeason] = useState(2020);
  const [endSeason, setEndSeason] = useState(2025);
  const [relationshipRuleId, setRelationshipRuleId] = useState("");
  const [slotRuleIds, setSlotRuleIds] = useState<string[]>(["", "", "", "", ""]);
  const [positionOverlayEnabled, setPositionOverlayEnabled] = useState(false);
  const [qbExclusionEnabled, setQbExclusionEnabled] = useState(false);
  const [title, setTitle] = useState("");
  const [titleTouched, setTitleTouched] = useState(false);
  const [timePeriodLocked, setTimePeriodLocked] = useState(false);
  const [linkTypeLocked, setLinkTypeLocked] = useState(false);
  const [slotLocks, setSlotLocks] = useState<boolean[]>([
    false,
    false,
    false,
    false,
    false,
  ]);

  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const [saveLoading, setSaveLoading] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveConfirmOpen, setSaveConfirmOpen] = useState(false);
  const [autoBuildLoading, setAutoBuildLoading] = useState(false);
  const [autoBuildMessage, setAutoBuildMessage] = useState<string | null>(null);
  const [autoBuildMinActiveLinks, setAutoBuildMinActiveLinks] = useState(7);
  const [autoBuildUsageThreshold, setAutoBuildUsageThreshold] = useState(3);
  const [autoBuildMaxQbs, setAutoBuildMaxQbs] = useState(MAX_AUTO_BUILD_QBS);
  const [autoBuildMinFantasyPointsPerSeason, setAutoBuildMinFantasyPointsPerSeason] =
    useState(MIN_FANTASY_POINTS_PER_SEASON);
  const [autoBuildMaxAttempts, setAutoBuildMaxAttempts] = useState(
    MAX_AUTO_BUILD_ATTEMPTS
  );
  const [devTab, setDevTab] = useState<
    "overview" | "create" | "review" | "inspector" | "schedule"
  >("overview");
  const [createView, setCreateView] = useState<"manual" | "automation">("manual");
  const [inspectorUsername, setInspectorUsername] = useState("");
  const [inspectorDate, setInspectorDate] = useState("");
  const [inspectorMode, setInspectorMode] = useState<"production" | "testing">("testing");
  const [inspectorLoading, setInspectorLoading] = useState(false);
  const [inspectorError, setInspectorError] = useState<string | null>(null);
  const [inspectorResult, setInspectorResult] = useState<SubmissionInspectorResponse | null>(
    null
  );
  const [dashboardStats, setDashboardStats] = useState<DashboardStatsResponse | null>(null);
  const [dashboardStatsLoading, setDashboardStatsLoading] = useState(false);
  const [dashboardStatsError, setDashboardStatsError] = useState<string | null>(null);
  const [finalizeYesterdayLoading, setFinalizeYesterdayLoading] = useState(false);
  const [finalizeYesterdayMessage, setFinalizeYesterdayMessage] = useState<string | null>(null);
  const [finalizeYesterdayError, setFinalizeYesterdayError] = useState<string | null>(null);
  const [statsTrendDays, setStatsTrendDays] = useState<number>(14);
  const [approvalQueue, setApprovalQueue] = useState<ApprovalQueueResponse | null>(null);
  const [approvalQueueLoading, setApprovalQueueLoading] = useState(false);
  const [approvalQueueError, setApprovalQueueError] = useState<string | null>(null);
  const [selectedPendingPuzzleId, setSelectedPendingPuzzleId] = useState<string | null>(null);
  const [approvalDetail, setApprovalDetail] = useState<PuzzleDetailResponse | null>(null);
  const [approvalDetailLoading, setApprovalDetailLoading] = useState(false);
  const [approvalDetailError, setApprovalDetailError] = useState<string | null>(null);
  const [approvalActionLoading, setApprovalActionLoading] = useState(false);
  const [approvalBrowserQueueRunning, setApprovalBrowserQueueRunning] = useState(false);
  const [approvalActionMessage, setApprovalActionMessage] = useState<string | null>(null);
  const [optimizerHowItWorksOpen, setOptimizerHowItWorksOpen] = useState(false);
  const [queueForm, setQueueForm] = useState<GeneratorSettings>(DEFAULT_GENERATOR_SETTINGS);
  const [optimizerLog, setOptimizerLog] = useState<OptimizerLogEntry[]>([]);
  const [optimizerLogLoading, setOptimizerLogLoading] = useState(false);
  const [optimizerLogError, setOptimizerLogError] = useState<string | null>(null);
  const [optimizerSessionStartedAt, setOptimizerSessionStartedAt] = useState<string | null>(null);
  const [optimizerFoundTimestamps, setOptimizerFoundTimestamps] = useState<string[]>([]);
  const [optimizerAttemptCount, setOptimizerAttemptCount] = useState(0);
  const [optimizerClockMs, setOptimizerClockMs] = useState(Date.now());
  const [puzzleList, setPuzzleList] = useState<PuzzleListItem[]>([]);
  const [puzzleListLoading, setPuzzleListLoading] = useState(false);
  const [puzzleListError, setPuzzleListError] = useState<string | null>(null);
  const [selectedPuzzleId, setSelectedPuzzleId] = useState<string | null>(null);
  const [puzzleDetail, setPuzzleDetail] = useState<PuzzleDetailResponse | null>(null);
  const [puzzleDetailLoading, setPuzzleDetailLoading] = useState(false);
  const [puzzleDetailError, setPuzzleDetailError] = useState<string | null>(null);
  const [puzzleScope, setPuzzleScope] = useState<"future" | "past">("future");
  const [puzzleActionLoading, setPuzzleActionLoading] = useState(false);
  const [puzzleActionMessage, setPuzzleActionMessage] = useState<string | null>(null);
  const [puzzleActionError, setPuzzleActionError] = useState<string | null>(null);
  const [swapSlotA, setSwapSlotA] = useState(1);
  const [swapSlotB, setSwapSlotB] = useState(2);

  const currentThemeLabel =
    startSeason === endSeason
      ? `${startSeason} Season`
      : `${startSeason}-${endSeason} Seasons`;

  const groupedSlotRules = useMemo(() => {
    const groups = new Map<string, SlotRuleOption[]>();
    for (const rule of meta?.slotRules ?? []) {
      const items = groups.get(rule.parameter_type) ?? [];
      items.push(rule);
      groups.set(rule.parameter_type, items);
    }
    return Array.from(groups.entries());
  }, [meta]);

  const confirmedPuzzleList = useMemo(
    () => puzzleList.filter((puzzle) => puzzle.published_flag),
    [puzzleList]
  );

  const filteredConfirmedPuzzleList = useMemo(
    () =>
      [...confirmedPuzzleList]
        .filter((puzzle) =>
          puzzleScope === "future" ? puzzle.future_editable : !puzzle.future_editable
        )
        .sort((a, b) =>
          puzzleScope === "future"
            ? a.puzzle_date.localeCompare(b.puzzle_date)
            : b.puzzle_date.localeCompare(a.puzzle_date)
        ),
    [confirmedPuzzleList, puzzleScope]
  );

  const pendingPuzzleCount = approvalQueue?.pendingPuzzles.length ?? 0;
  const needsApprovalAttention =
    pendingPuzzleCount > 0 ||
    Boolean(approvalQueue?.job?.last_error) ||
    Boolean(approvalActionMessage);
  const futurePuzzleCount = confirmedPuzzleList.filter((puzzle) => puzzle.future_editable).length;
  const archivePuzzleCount = confirmedPuzzleList.length - futurePuzzleCount;
  const optimizerSessionMinutes = optimizerSessionStartedAt
    ? Math.max((optimizerClockMs - new Date(optimizerSessionStartedAt).getTime()) / 60000, 1 / 60)
    : 0;
  const optimizerPuzzlesPerMinute = optimizerSessionStartedAt
    ? optimizerFoundTimestamps.length / optimizerSessionMinutes
    : 0;
  const optimizerRollingWindowMinutes = optimizerSessionStartedAt
    ? Math.max(Math.min(10, optimizerSessionMinutes), 1 / 60)
    : 0;
  const optimizerRollingPuzzlesPerMinute = optimizerSessionStartedAt
    ? optimizerFoundTimestamps.filter(
        (timestamp) => optimizerClockMs - new Date(timestamp).getTime() <= 10 * 60 * 1000
      ).length / optimizerRollingWindowMinutes
    : 0;
  const optimizerAttemptsPerMinute = optimizerSessionStartedAt
    ? optimizerAttemptCount / optimizerSessionMinutes
    : 0;
  const currentPreviewBudgetPerPuzzle = Math.max(1, queueForm.maxAttemptsPerPuzzle);
  const currentPreviewBudgetForQueue = Math.max(
    1,
    queueForm.maxAttemptsPerPuzzle * queueForm.targetPendingCount
  );
  const bruteForceReductionPerPuzzle = AUTO_QUEUE_SEARCH_SPACE_COUNT / currentPreviewBudgetPerPuzzle;
  const bruteForceReductionForQueue = AUTO_QUEUE_SEARCH_SPACE_COUNT / currentPreviewBudgetForQueue;
  const estimatedCurrentBudgetMinutes =
    optimizerAttemptsPerMinute > 0
      ? currentPreviewBudgetPerPuzzle / optimizerAttemptsPerMinute
      : 0;
  const estimatedBruteForceMinutesAtObservedPace =
    optimizerAttemptsPerMinute > 0
      ? AUTO_QUEUE_SEARCH_SPACE_COUNT / optimizerAttemptsPerMinute
      : 0;
  const optimizerTimeline = useMemo(
    () =>
      [...optimizerLog].sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      ),
    [optimizerLog]
  );

  const rangeStartPercent =
    ((startSeason - MIN_SEASON) / (MAX_SEASON - MIN_SEASON)) * 100;
  const rangeEndPercent =
    ((endSeason - MIN_SEASON) / (MAX_SEASON - MIN_SEASON)) * 100;

  const selectedRelationship =
    meta?.relationships.find((item) => item.relationship_rule_id === relationshipRuleId) ??
    null;
  const suggestedTitle = `${currentThemeLabel} ${
    selectedRelationship?.display_text ?? "Puzzle"
  }`;

  useEffect(() => {
    if (!isAdmin) return;

    let cancelled = false;

    async function loadMeta() {
      try {
        setMetaLoading(true);
        setMetaError(null);

        const response = await fetch("/api/admin/dev-puzzle/meta", {
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error((await response.text()) || "Failed to load metadata.");
        }

        const json = (await response.json()) as DevMetaResponse;
        if (cancelled) return;

        setMeta(json);

        setRelationshipRuleId((current) => {
          if (current && json.relationships.some((item) => item.relationship_rule_id === current)) {
            return current;
          }
          return (
            json.relationships.find((item) => item.relationship_type === "teammates")
              ?.relationship_rule_id ?? json.relationships[0]?.relationship_rule_id ?? ""
          );
        });

        const slotRuleLookup = new Map(
          json.slotRules.map((rule) => [rule.rule_name, rule.slot_rule_id])
        );
        setSlotRuleIds((current) => {
          if (current.every(Boolean)) {
            return current;
          }
          return DEFAULT_SLOT_RULE_NAMES.map(
            (ruleName) => slotRuleLookup.get(ruleName) ?? ""
          );
        });
      } catch (error) {
        if (!cancelled) {
          setMetaError((error as Error).message);
        }
      } finally {
        if (!cancelled) {
          setMetaLoading(false);
        }
      }
    }

    void loadMeta();
    return () => {
      cancelled = true;
    };
  }, [isAdmin]);

  useEffect(() => {
    if (titleTouched) return;
    setTitle(suggestedTitle);
  }, [suggestedTitle, titleTouched]);

  useEffect(() => {
    if (!approvalBrowserQueueRunning && !optimizerSessionStartedAt) {
      return;
    }
    const interval = window.setInterval(() => {
      setOptimizerClockMs(Date.now());
    }, 1000);
    return () => window.clearInterval(interval);
  }, [approvalBrowserQueueRunning, optimizerSessionStartedAt]);

  async function refreshOptimizerLog() {
    const response = await fetch("/api/admin/dev-puzzle/optimizer-log", {
      cache: "no-store",
    });
    const json = await response.json();
    if (!response.ok) {
      throw new Error(json?.error ?? "Failed to load optimizer log.");
    }
    const items = (json?.entries ?? []) as Array<{
      log_id: string;
      log_key?: string | null;
      kind: OptimizerLogEntry["kind"];
      title: string;
      detail: string;
      metadata?: Record<string, unknown> | null;
      occurred_at: string;
    }>;
    setOptimizerLog(
      items.map((entry) => ({
        log_id: entry.log_id,
        log_key: entry.log_key ?? null,
        kind: entry.kind,
        title: entry.title,
        detail: entry.detail,
        metadata: entry.metadata ?? null,
        timestamp: entry.occurred_at,
      }))
    );
  }

  async function appendOptimizerLog(
    kind: OptimizerLogEntry["kind"],
    titleValue: string,
    detail: string,
    metadata?: Record<string, unknown> | null
  ) {
    try {
      const response = await fetch("/api/admin/dev-puzzle/optimizer-log", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          kind,
          title: titleValue,
          detail,
          metadata: metadata ?? undefined,
        }),
      });
      const json = await response.json();
      if (!response.ok) {
        throw new Error(json?.error ?? "Failed to write optimizer log.");
      }
      const entry = json.entry as {
        log_id: string;
        log_key?: string | null;
        kind: OptimizerLogEntry["kind"];
        title: string;
        detail: string;
        metadata?: Record<string, unknown> | null;
        occurred_at: string;
      };
      setOptimizerLog((current) => [
        {
          log_id: entry.log_id,
          log_key: entry.log_key ?? null,
          kind: entry.kind,
          title: entry.title,
          detail: entry.detail,
          metadata: entry.metadata ?? null,
          timestamp: entry.occurred_at,
        },
        ...current.filter((item) => item.log_id !== entry.log_id),
      ]);
    } catch (error) {
      setOptimizerLogError((error as Error).message);
    }
  }

  useEffect(() => {
    if (
      !isAdmin ||
      !(
        devTab === "review" ||
        (devTab === "create" && createView === "automation")
      )
    ) {
      return;
    }
    let cancelled = false;

    async function loadOptimizerLog() {
      try {
        setOptimizerLogLoading(true);
        setOptimizerLogError(null);
        await refreshOptimizerLog();
      } catch (error) {
        if (!cancelled) {
          setOptimizerLogError((error as Error).message);
        }
      } finally {
        if (!cancelled) {
          setOptimizerLogLoading(false);
        }
      }
    }

    void loadOptimizerLog();
    return () => {
      cancelled = true;
    };
  }, [createView, devTab, isAdmin]);

  const refreshDashboardStats = useCallback(
    async (requestedDays = statsTrendDays) => {
      const response = await fetch(`/api/admin/dev-puzzle/stats?days=${requestedDays}`, {
        cache: "no-store",
      });
      const json = await response.json();
      if (!response.ok) {
        throw new Error(json?.error ?? "Failed to load dashboard stats.");
      }
      setDashboardStats(json as DashboardStatsResponse);
    },
    [statsTrendDays]
  );

  useEffect(() => {
    if (!isAdmin || devTab !== "overview") return;
    let cancelled = false;

    async function loadDashboardStats() {
      try {
        setDashboardStatsLoading(true);
        setDashboardStatsError(null);
        if (!cancelled) {
          await refreshDashboardStats(statsTrendDays);
        }
      } catch (error) {
        if (!cancelled) {
          setDashboardStatsError((error as Error).message);
        }
      } finally {
        if (!cancelled) {
          setDashboardStatsLoading(false);
        }
      }
    }

    void loadDashboardStats();
    return () => {
      cancelled = true;
    };
  }, [devTab, isAdmin, refreshDashboardStats, statsTrendDays]);

  async function finalizeYesterdayLeaderboard() {
    try {
      setFinalizeYesterdayLoading(true);
      setFinalizeYesterdayMessage(null);
      setFinalizeYesterdayError(null);
      const response = await fetch("/api/admin/finalize-yesterday", {
        method: "POST",
      });
      const json = await response.json();
      if (!response.ok) {
        throw new Error(json?.error ?? "Failed to finalize yesterday's leaderboard.");
      }
      setFinalizeYesterdayMessage(
        json?.message ??
          `Finalized yesterday's leaderboard for ${json?.target_date ?? "the previous day"}.`
      );
      await Promise.all([refreshDashboardStats(), appendOptimizerLog(
        "run",
        "Finalize Yesterday",
        `Manual leaderboard finalize ran for ${json?.target_date ?? "yesterday"}.`,
        {
          target_date: json?.target_date ?? null,
          placements_recorded: json?.placements_recorded ?? 0,
          top_10_badges_awarded: json?.top_10_badges_awarded ?? 0,
          top_10_x5_badges_awarded: json?.top_10_x5_badges_awarded ?? 0,
        }
      )]);
    } catch (error) {
      setFinalizeYesterdayError((error as Error).message);
    } finally {
      setFinalizeYesterdayLoading(false);
    }
  }

  useEffect(() => {
    if (
      !isAdmin ||
      !(
        devTab === "review" ||
        (devTab === "create" && createView === "automation")
      )
    ) {
      return;
    }
    let cancelled = false;

    async function loadApprovalQueue() {
      try {
        setApprovalQueueLoading(true);
        setApprovalQueueError(null);
        const response = await fetch("/api/admin/dev-puzzle/queue", {
          cache: "no-store",
        });
        const json = await response.json();
        if (!response.ok) {
          throw new Error(json?.error ?? "Failed to load approval queue.");
        }
        if (cancelled) return;
        const payload = json as ApprovalQueueResponse;
        setApprovalQueue(payload);
        setQueueForm(payload.job?.settings ?? DEFAULT_GENERATOR_SETTINGS);
        setSelectedPendingPuzzleId(
          (current) =>
            current && payload.pendingPuzzles.some((item) => item.puzzle_id === current)
              ? current
              : payload.pendingPuzzles[0]?.puzzle_id ?? null
        );
      } catch (error) {
        if (!cancelled) {
          setApprovalQueueError((error as Error).message);
        }
      } finally {
        if (!cancelled) {
          setApprovalQueueLoading(false);
        }
      }
    }

    void loadApprovalQueue();
    return () => {
      cancelled = true;
    };
  }, [createView, devTab, isAdmin]);

  useEffect(() => {
    if (!isAdmin || devTab !== "review" || !selectedPendingPuzzleId) return;
    const pendingPuzzleId = selectedPendingPuzzleId;
    let cancelled = false;

    async function loadApprovalDetail() {
      try {
        setApprovalDetailLoading(true);
        setApprovalDetailError(null);
        const response = await fetch(
          `/api/admin/dev-puzzle/puzzles/${encodeURIComponent(pendingPuzzleId)}`,
          { cache: "no-store" }
        );
        const json = await response.json();
        if (!response.ok) {
          throw new Error(json?.error ?? "Failed to load pending puzzle detail.");
        }
        if (!cancelled) {
          setApprovalDetail(json as PuzzleDetailResponse);
        }
      } catch (error) {
        if (!cancelled) {
          setApprovalDetail(null);
          setApprovalDetailError((error as Error).message);
        }
      } finally {
        if (!cancelled) {
          setApprovalDetailLoading(false);
        }
      }
    }

    void loadApprovalDetail();
    return () => {
      cancelled = true;
    };
  }, [devTab, isAdmin, selectedPendingPuzzleId]);

  useEffect(() => {
    if (!isAdmin || devTab !== "schedule") return;
    let cancelled = false;

    async function loadPuzzleList() {
      try {
        setPuzzleListLoading(true);
        setPuzzleListError(null);
        const response = await fetch("/api/admin/dev-puzzle/puzzles", {
          cache: "no-store",
        });
        const json = await response.json();
        if (!response.ok) {
          throw new Error(json?.error ?? "Failed to load puzzles.");
        }
        if (cancelled) return;
        const items = (json?.puzzles ?? []) as PuzzleListItem[];
        setPuzzleList(items);
        setSelectedPuzzleId((current) => current ?? items[0]?.puzzle_id ?? null);
      } catch (error) {
        if (!cancelled) {
          setPuzzleListError((error as Error).message);
        }
      } finally {
        if (!cancelled) {
          setPuzzleListLoading(false);
        }
      }
    }

    void loadPuzzleList();
    return () => {
      cancelled = true;
    };
  }, [devTab, isAdmin]);

  useEffect(() => {
    if (!isAdmin || devTab !== "schedule" || !selectedPuzzleId) return;
    const puzzleId = selectedPuzzleId;
    let cancelled = false;

    async function loadPuzzleDetail() {
      try {
        setPuzzleDetailLoading(true);
        setPuzzleDetailError(null);
        const response = await fetch(
          `/api/admin/dev-puzzle/puzzles/${encodeURIComponent(puzzleId)}`,
          { cache: "no-store" }
        );
        const json = await response.json();
        if (!response.ok) {
          throw new Error(json?.error ?? "Failed to load puzzle detail.");
        }
        if (cancelled) return;
        setPuzzleDetail(json as PuzzleDetailResponse);
      } catch (error) {
        if (!cancelled) {
          setPuzzleDetail(null);
          setPuzzleDetailError((error as Error).message);
        }
      } finally {
        if (!cancelled) {
          setPuzzleDetailLoading(false);
        }
      }
    }

    void loadPuzzleDetail();
    return () => {
      cancelled = true;
    };
  }, [devTab, isAdmin, selectedPuzzleId]);

  useEffect(() => {
    if (devTab !== "schedule") return;
    setSelectedPuzzleId((current) =>
      current && filteredConfirmedPuzzleList.some((puzzle) => puzzle.puzzle_id === current)
        ? current
        : filteredConfirmedPuzzleList[0]?.puzzle_id ?? null
    );
  }, [devTab, filteredConfirmedPuzzleList]);

  useEffect(() => {
    if (!puzzleDetail) return;
    const slots = puzzleDetail.slots.map((slot) => slot.slot_number).sort((a, b) => a - b);
    setSwapSlotA(slots[0] ?? 1);
    setSwapSlotB(slots[1] ?? 2);
  }, [puzzleDetail]);

  function buildThemeLabel(startValue: number, endValue: number) {
    return startValue === endValue
      ? `${startValue} Season`
      : `${startValue}-${endValue} Seasons`;
  }

  function buildSuggestedTitleForConfig(config: {
    startSeason: number;
    endSeason: number;
    relationshipRuleId: string;
  }) {
    const relationshipLabel =
      meta?.relationships.find(
        (item) => item.relationship_rule_id === config.relationshipRuleId
      )?.display_text ?? "Puzzle";
    return `${buildThemeLabel(config.startSeason, config.endSeason)} ${relationshipLabel}`;
  }

  function buildRandomSlotRuleIds(slotRules: SlotRuleOption[]) {
    return buildRandomSlotRuleIdsWithLocks(slotRules, slotRuleIds, slotLocks);
  }

  function buildRandomSlotRuleIdsWithLocks(
    slotRules: SlotRuleOption[],
    currentSlotRuleIds: string[],
    currentSlotLocks: boolean[]
  ) {
    const rulesByType = new Map<string, SlotRuleOption[]>();
    const lockedRuleIds = new Set(
      currentSlotRuleIds.filter((slotRuleId, index) => currentSlotLocks[index] && slotRuleId)
    );
    for (const rule of slotRules) {
      if (rule.parameter_type === "college" && Number(rule.random_weight ?? 0) <= 0) {
        continue;
      }
      if (lockedRuleIds.has(rule.slot_rule_id)) {
        continue;
      }
      const items = rulesByType.get(rule.parameter_type) ?? [];
      items.push(rule);
      rulesByType.set(rule.parameter_type, items);
    }

    const totalAvailableRules = Array.from(rulesByType.values()).reduce(
      (sum, items) => sum + items.length,
      0
    );
    const lockedRuleCount = currentSlotLocks.filter(Boolean).length;
    if (totalAvailableRules + lockedRuleCount < 5) {
      return null;
    }

    const nextSlotRuleIds = currentSlotRuleIds.map((slotRuleId, index) =>
      currentSlotLocks[index] ? slotRuleId : ""
    );

    for (let slotIndex = 0; slotIndex < 5; slotIndex += 1) {
      if (currentSlotLocks[slotIndex]) {
        continue;
      }

      const typeEntries = Array.from(rulesByType.entries()).filter(
        ([, items]) => items.length > 0
      );
      if (typeEntries.length === 0) {
        break;
      }

      const collegeEntry =
        typeEntries.find(([parameterType]) => parameterType === "college") ?? null;
      const nonCollegeEntries = typeEntries.filter(
        ([parameterType]) => parameterType !== "college"
      );

      let selectedType: string | null = null;
      const shouldPickCollege =
        Boolean(collegeEntry) &&
        (nonCollegeEntries.length === 0 || Math.random() < COLLEGE_TYPE_PICK_RATE);

      if (shouldPickCollege) {
        selectedType = "college";
      } else {
        const fallbackEntry = pickRandomItem(nonCollegeEntries);
        selectedType = fallbackEntry?.[0] ?? collegeEntry?.[0] ?? null;
      }

      if (!selectedType) {
        break;
      }

      const availableRules = rulesByType.get(selectedType) ?? [];
      const selectedRule =
        selectedType === "college"
          ? pickWeightedRule(availableRules)
          : pickRandomItem(availableRules);
      if (!selectedRule) {
        break;
      }

      const selectedIndex = availableRules.findIndex(
        (rule) => rule.slot_rule_id === selectedRule.slot_rule_id
      );
      if (selectedIndex >= 0) {
        availableRules.splice(selectedIndex, 1);
      }
      if (availableRules.length === 0) {
        rulesByType.delete(selectedType);
      } else {
        rulesByType.set(selectedType, availableRules);
      }

      nextSlotRuleIds[slotIndex] = selectedRule.slot_rule_id;
    }

    return nextSlotRuleIds.every(Boolean) ? nextSlotRuleIds : null;
  }

  function scoreSlotRuleSkeleton(slotRuleIdsToScore: string[], slotRules: SlotRuleOption[]) {
    const ruleMap = new Map(slotRules.map((rule) => [rule.slot_rule_id, rule]));
    const typeCounts = new Map<string, number>();
    let score = 0;
    let collegeCount = 0;

    for (const slotRuleId of slotRuleIdsToScore) {
      const rule = ruleMap.get(slotRuleId);
      if (!rule) {
        continue;
      }

      typeCounts.set(
        rule.parameter_type,
        (typeCounts.get(rule.parameter_type) ?? 0) + 1
      );

      switch (rule.parameter_type) {
        case "any":
          score += 8;
          break;
        case "conference":
          score += 6;
          break;
        case "division":
          score += 5;
          break;
        case "team":
          score += 4;
          break;
        case "position":
          score += 3;
          break;
        case "college":
          collegeCount += 1;
          score += Math.min(8, Math.log2(Number(rule.random_weight ?? 1) + 1));
          break;
        default:
          score += 1;
      }
    }

    score += typeCounts.size * 4;

    for (const count of typeCounts.values()) {
      if (count > 2) {
        score -= (count - 2) * 3;
      }
    }

    if (collegeCount > 2) {
      score -= (collegeCount - 2) * 8;
    }

    return score;
  }

  async function requestPreview(
    config?: BuilderConfig,
    generatorSettings?: GeneratorSettings | null
  ) {
    const previewPositionOverlayEnabled =
      config?.positionOverlayEnabled ?? positionOverlayEnabled;
    const previewQbExclusionEnabled =
      config?.qbExclusionEnabled ?? qbExclusionEnabled;
    const previewConfig = config ?? {
      title: titleTouched ? title : suggestedTitle,
      startSeason,
      endSeason,
      relationshipRuleId,
      slotRuleIds,
      positionOverlayEnabled,
      qbExclusionEnabled,
    };
    const response = await fetch("/api/admin/dev-puzzle/preview", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title: previewConfig.title,
        startSeason: previewConfig.startSeason,
        endSeason: previewConfig.endSeason,
        relationshipRuleId: previewConfig.relationshipRuleId,
        slotRuleIds: previewConfig.slotRuleIds,
        positionOverlayEnabled: previewPositionOverlayEnabled,
        qbExclusionEnabled: previewQbExclusionEnabled,
        generatorSettings: generatorSettings ?? undefined,
      }),
    });

    const json = await response.json();
    if (!response.ok) {
      throw new Error(json?.error ?? "Failed to generate preview.");
    }

    return json as PreviewResponse;
  }

  function buildCurrentGeneratorSettings(): GeneratorSettings {
    return {
      targetPendingCount: 1,
      minActiveLinks: autoBuildMinActiveLinks,
      usageThresholdTotal: autoBuildUsageThreshold,
      maxQbs: autoBuildMaxQbs,
      minFantasyPointsPerSeason: autoBuildMinFantasyPointsPerSeason,
      maxAttemptsPerPuzzle: autoBuildMaxAttempts,
      forcePositionLock: positionOverlayEnabled,
      forceNoQbs: qbExclusionEnabled,
      useAnchorSearch: true,
      useSkeletonScoring: true,
      useThresholdMemory: true,
      anchorCount: 3,
      stageWidth: 6,
      beamWidth: 3,
    };
  }

  async function requestSavePending(config: BuilderConfig) {
    const pendingPositionOverlayEnabled =
      config.positionOverlayEnabled ?? false;
    const pendingQbExclusionEnabled = config.qbExclusionEnabled ?? false;
    const response = await fetch("/api/admin/dev-puzzle/save", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title: config.title,
        startSeason: config.startSeason,
        endSeason: config.endSeason,
        relationshipRuleId: config.relationshipRuleId,
        slotRuleIds: config.slotRuleIds,
        positionOverlayEnabled: pendingPositionOverlayEnabled,
        qbExclusionEnabled: pendingQbExclusionEnabled,
        publishedFlag: false,
      }),
    });

    const json = await response.json();
    if (!response.ok) {
      throw new Error(json?.error ?? "Failed to save pending puzzle.");
    }

    return json as { puzzle_date: string; puzzle_id: string; preview: PreviewResponse };
  }

  function previewMeetsThresholds(
    candidateConfig: BuilderConfig,
    candidatePreview: PreviewResponse,
    settings: GeneratorSettings
  ) {
    const passesActiveLinks = candidatePreview.optimal_active_links >= settings.minActiveLinks;
    const totalPreviousUsage = candidatePreview.optimal_lineup.reduce(
      (sum, entry) => sum + Number(entry.previous_optimal_usage_count ?? 0),
      0
    );
    const passesUsage = totalPreviousUsage < settings.usageThresholdTotal;
    const quarterbackCount = candidatePreview.optimal_lineup.filter(
      (entry) => entry.player.primary_position === "QB"
    ).length;
    const passesQuarterbackLimit = quarterbackCount <= settings.maxQbs;
    const requiredFantasyPoints =
      (candidateConfig.endSeason - candidateConfig.startSeason + 1) *
      settings.minFantasyPointsPerSeason;
    const passesImpactThreshold = candidatePreview.optimal_lineup.every(
      (entry) => Number(entry.player.fantasy_points ?? 0) >= requiredFantasyPoints
    );

    return (
      passesActiveLinks &&
      passesUsage &&
      passesQuarterbackLimit &&
      passesImpactThreshold
    );
  }

  async function findViableCandidateFromSettings(
    settings: GeneratorSettings
  ): Promise<{ config: BuilderConfig; preview: PreviewResponse; attempts: number } | null> {
    if (!meta || meta.relationships.length === 0) {
      throw new Error("Dev metadata is still loading.");
    }

    const maxAttempts = Math.max(1, settings.maxAttemptsPerPuzzle);
    const useAnchorSearch = settings.useAnchorSearch;
    const anchorCount = useAnchorSearch
      ? Math.max(1, Math.min(4, settings.anchorCount))
      : 0;
    const stageWidth = useAnchorSearch
      ? Math.max(1, Math.min(20, settings.stageWidth))
      : 1;
    const beamWidth = settings.useSkeletonScoring
      ? Math.max(1, Math.min(stageWidth, settings.beamWidth))
      : stageWidth;
    let attempt = 0;

    while (attempt < maxAttempts) {
      if (approvalAutoQueueStopRequestedRef.current) {
        return null;
      }

      const themeRange = pickRandomItem(AUTO_THEME_RANGES);
      const relationship = pickRandomItem(meta.relationships);
      const anchorSeedSlotRuleIds = buildRandomSlotRuleIds(meta.slotRules);

      if (!themeRange || !relationship || !anchorSeedSlotRuleIds) {
        attempt += 1;
        continue;
      }

      const anchorIndices = pickRandomDistinctIndices(5, anchorCount);
      const anchorLocks = Array.from({ length: 5 }, (_, index) =>
        anchorIndices.includes(index)
      );

      const stagedCandidates: string[][] = [];
      for (
        let stageAttempt = 0;
        stageAttempt < stageWidth && attempt + stagedCandidates.length < maxAttempts;
        stageAttempt += 1
      ) {
        const stagedSlotRuleIds = buildRandomSlotRuleIdsWithLocks(
          meta.slotRules,
          anchorSeedSlotRuleIds,
          anchorLocks
        );

        if (!stagedSlotRuleIds) {
          continue;
        }

        stagedCandidates.push(stagedSlotRuleIds);
      }

      const rankedStageCandidates = settings.useSkeletonScoring
        ? stagedCandidates
            .map((slotRuleIds) => ({
              slotRuleIds,
              score: scoreSlotRuleSkeleton(slotRuleIds, meta.slotRules),
            }))
            .sort((a, b) => b.score - a.score)
            .slice(0, beamWidth)
        : stagedCandidates.map((slotRuleIds) => ({
            slotRuleIds,
            score: 0,
          }));

      for (const rankedCandidate of rankedStageCandidates) {
        if (approvalAutoQueueStopRequestedRef.current) {
          return null;
        }

        attempt += 1;

        const candidateConfig: BuilderConfig = {
          startSeason: themeRange.startSeason,
          endSeason: themeRange.endSeason,
          relationshipRuleId: relationship.relationship_rule_id,
          slotRuleIds: rankedCandidate.slotRuleIds,
          title: buildSuggestedTitleForConfig({
            startSeason: themeRange.startSeason,
            endSeason: themeRange.endSeason,
            relationshipRuleId: relationship.relationship_rule_id,
          }),
          positionOverlayEnabled: settings.forcePositionLock,
          qbExclusionEnabled: settings.forceNoQbs,
        };

        let candidatePreview: PreviewResponse;
        try {
          candidatePreview = await requestPreview(
            candidateConfig,
            settings.useThresholdMemory ? settings : null
          );
        } catch (error) {
          const message = error instanceof Error ? error.message : "Preview failed.";
          if (
            message.includes("No valid candidate pool") ||
            message.includes("cannot meet current generator thresholds")
          ) {
            continue;
          }
          throw error;
        }

        if (previewMeetsThresholds(candidateConfig, candidatePreview, settings)) {
          return { config: candidateConfig, preview: candidatePreview, attempts: attempt };
        }
      }
    }

    return null;
  }

  async function refreshMetaNextOpenDay() {
    const response = await fetch("/api/admin/dev-puzzle/meta", {
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error((await response.text()) || "Failed to refresh metadata.");
    }

    const json = (await response.json()) as DevMetaResponse;
    setMeta((current) =>
      current
        ? {
            ...current,
            nextAvailableDate: json.nextAvailableDate,
            relationships: json.relationships,
            slotRules: json.slotRules,
          }
        : json
    );
  }

  async function refreshApprovalQueue() {
    const response = await fetch("/api/admin/dev-puzzle/queue", {
      cache: "no-store",
    });
    const json = await response.json();
    if (!response.ok) {
      throw new Error(json?.error ?? "Failed to refresh approval queue.");
    }
    const payload = json as ApprovalQueueResponse;
    setApprovalQueue(payload);
    setQueueForm(payload.job?.settings ?? DEFAULT_GENERATOR_SETTINGS);
    setSelectedPendingPuzzleId((current) =>
      current && payload.pendingPuzzles.some((item) => item.puzzle_id === current)
        ? current
        : payload.pendingPuzzles[0]?.puzzle_id ?? null
    );
    return payload;
  }

  async function runApprovalBrowserQueue(options: { continuous: boolean }) {
    if (approvalAutoQueueRunningRef.current) {
      return;
    }

    approvalAutoQueueStopRequestedRef.current = false;
    approvalAutoQueueRunningRef.current = true;
    setApprovalBrowserQueueRunning(true);
    setApprovalQueueError(null);
    setOptimizerSessionStartedAt((current) => current ?? new Date().toISOString());
    void appendOptimizerLog(
      "run",
      options.continuous ? "Auto Queue Started" : "Run Now Started",
      options.continuous
        ? "Optimizer loop is searching for qualifying pending puzzles."
        : "Optimizer is searching for one qualifying pending puzzle."
    );

    try {
      let latestQueue = approvalQueue ?? (await refreshApprovalQueue());
      let totalGenerated = 0;
      let totalAttempts = 0;

      while (!approvalAutoQueueStopRequestedRef.current) {
        const settings = latestQueue.job?.settings ?? queueForm;
        const targetPendingCount = settings.targetPendingCount;
        const pendingCount = latestQueue.pendingPuzzles.length;

        if (pendingCount >= targetPendingCount) {
          setApprovalActionMessage(
            totalGenerated > 0
              ? `Queued ${totalGenerated} puzzle${totalGenerated === 1 ? "" : "s"} after ${totalAttempts} total attempt${totalAttempts === 1 ? "" : "s"}.`
              : "Pending queue is already full."
          );
          break;
        }

        setApprovalActionMessage(
          `Searching for pending puzzle ${pendingCount + 1} of ${targetPendingCount}...`
        );

        const candidate = await findViableCandidateFromSettings(settings);
        if (!candidate) {
          setOptimizerAttemptCount((current) => current + settings.maxAttemptsPerPuzzle);
          void appendOptimizerLog(
            "error",
            "No Puzzle Found",
            `Search stopped after ${settings.maxAttemptsPerPuzzle} attempts without finding another qualifying puzzle.`
          );
          setApprovalActionMessage(
            totalGenerated > 0
              ? `Queued ${totalGenerated} puzzle${totalGenerated === 1 ? "" : "s"}, then stopped after no further viable puzzle was found.`
              : `No qualifying puzzle found after ${settings.maxAttemptsPerPuzzle} attempts.`
          );
          break;
        }

        totalGenerated += 1;
        totalAttempts += candidate.attempts;
        setOptimizerAttemptCount((current) => current + candidate.attempts);
        const saved = await requestSavePending(candidate.config);
        setOptimizerFoundTimestamps((current) => [...current, new Date().toISOString()]);
        void appendOptimizerLog(
          "success",
          "Pending Puzzle Queued",
          `${saved.puzzle_date} queued after ${candidate.attempts} attempts with ${candidate.preview.optimal_active_links} active links.`
        );
        if (approvalAutoQueueStopRequestedRef.current) {
          setApprovalActionMessage("Auto queue stopped.");
          void appendOptimizerLog("run", "Auto Queue Stopped", "Stopped after the current save completed.");
          break;
        }
        latestQueue = await refreshApprovalQueue();
        await refreshMetaNextOpenDay();
        if (approvalAutoQueueStopRequestedRef.current) {
          setApprovalActionMessage("Auto queue stopped.");
          void appendOptimizerLog("run", "Auto Queue Stopped", "Stopped after refreshing the queue.");
          break;
        }
        setApprovalActionMessage(
          options.continuous
            ? `Queued ${saved.puzzle_date} after ${candidate.attempts} attempt${candidate.attempts === 1 ? "" : "s"}. Continuing...`
            : `Queued ${saved.puzzle_date} after ${candidate.attempts} attempt${candidate.attempts === 1 ? "" : "s"}.`
        );

        if (!options.continuous) {
          break;
        }
      }
    } catch (error) {
      setApprovalQueueError((error as Error).message);
      void appendOptimizerLog("error", "Optimizer Error", (error as Error).message);
    } finally {
      approvalAutoQueueRunningRef.current = false;
      setApprovalBrowserQueueRunning(false);
    }
  }

  async function refreshPuzzleList() {
    const response = await fetch("/api/admin/dev-puzzle/puzzles", {
      cache: "no-store",
    });
    const json = await response.json();
    if (!response.ok) {
      throw new Error(json?.error ?? "Failed to refresh puzzles.");
    }
    const items = (json?.puzzles ?? []) as PuzzleListItem[];
    setPuzzleList(items);
    setSelectedPuzzleId((current) =>
      current && items.some((item) => item.puzzle_id === current)
        ? current
        : items[0]?.puzzle_id ?? null
    );
    return items;
  }

  async function refreshPuzzleDetail(puzzleId: string) {
    const response = await fetch(
      `/api/admin/dev-puzzle/puzzles/${encodeURIComponent(puzzleId)}`,
      { cache: "no-store" }
    );
    const json = await response.json();
    if (!response.ok) {
      throw new Error(json?.error ?? "Failed to refresh puzzle detail.");
    }
    const detail = json as PuzzleDetailResponse;
    setPuzzleDetail(detail);
    return detail;
  }

  async function submitQueueAction(
    action: "start" | "stop" | "run_now" | "save_settings"
  ) {
    if (action === "run_now") {
      setApprovalActionLoading(true);
      setApprovalActionMessage("Saving queue settings...");
      setApprovalQueueError(null);
      void appendOptimizerLog("settings", "Queue Settings Saved", "Run Now is using the current optimizer settings.");
      try {
        const response = await fetch("/api/admin/dev-puzzle/queue", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            action: "save_settings",
            ...queueForm,
          }),
        });
        const json = await response.json();
        if (!response.ok) {
          throw new Error(json?.error ?? "Failed to update approval queue.");
        }
        const payload = json as ApprovalQueueResponse;
        setApprovalQueue({
          job: payload.job ?? null,
          pendingPuzzles: payload.pendingPuzzles ?? [],
        });
        setSelectedPendingPuzzleId((current) =>
          current && (payload.pendingPuzzles ?? []).some((item) => item.puzzle_id === current)
            ? current
            : payload.pendingPuzzles?.[0]?.puzzle_id ?? null
        );
        setApprovalActionLoading(false);
        await runApprovalBrowserQueue({ continuous: false });
      } catch (error) {
        setApprovalQueueError((error as Error).message);
        setApprovalActionLoading(false);
      }
      return;
    }

    if (action === "stop") {
      approvalAutoQueueStopRequestedRef.current = true;
      setApprovalActionMessage("Stopping auto queue after the current attempt...");
      void appendOptimizerLog("run", "Stop Requested", "Optimizer will stop after the current attempt finishes.");
      setApprovalQueue((current) =>
        current?.job
          ? {
              ...current,
              job: {
                ...current.job,
                active_flag: false,
              },
            }
          : current
      );
    }

    setApprovalActionLoading(true);
    setApprovalActionMessage(
      action === "start"
          ? "Starting auto queue..."
          : action === "stop"
            ? "Stopping auto queue..."
            : "Saving queue settings..."
    );
    setApprovalQueueError(null);
    try {
      const response = await fetch("/api/admin/dev-puzzle/queue", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action,
          ...queueForm,
        }),
      });
      const json = await response.json();
      if (!response.ok) {
        throw new Error(json?.error ?? "Failed to update approval queue.");
      }
      const payload = json as ApprovalQueueResponse & {
        runResult?: { generated?: number; reason?: string | null };
      };
      setApprovalQueue({
        job: payload.job ?? null,
        pendingPuzzles: payload.pendingPuzzles ?? [],
      });
      setSelectedPendingPuzzleId((current) =>
        current && (payload.pendingPuzzles ?? []).some((item) => item.puzzle_id === current)
          ? current
          : payload.pendingPuzzles?.[0]?.puzzle_id ?? null
      );
      if (action === "start") {
        setApprovalActionMessage("Auto queue is running in this tab.");
        void appendOptimizerLog("run", "Auto Queue Armed", "Optimizer will keep filling the pending queue in this tab.");
      } else if (action === "stop") {
        setApprovalActionMessage("Auto queue stopped.");
      } else {
        setApprovalActionMessage("Queue settings saved.");
        void appendOptimizerLog("settings", "Queue Settings Saved", "Updated puzzle goals and optimizer controls.");
      }
      await refreshMetaNextOpenDay();
    } catch (error) {
      setApprovalQueueError((error as Error).message);
    } finally {
      setApprovalActionLoading(false);
    }
  }

  // This loop is intentionally ref-driven so it can keep using the Builder-style search
  // without restarting just because the page rerendered.
  useEffect(() => {
    if (!approvalQueue?.job?.active_flag) {
      approvalAutoQueueStopRequestedRef.current = true;
      return;
    }
    if (approvalAutoQueueRunningRef.current) {
      return;
    }
    if ((approvalQueue.pendingPuzzles.length ?? 0) >= approvalQueue.job.settings.targetPendingCount) {
      return;
    }

    void runApprovalBrowserQueue({ continuous: true });
  }, [approvalQueue?.job?.active_flag, approvalQueue?.job?.settings.targetPendingCount, approvalQueue?.pendingPuzzles.length, meta]); // eslint-disable-line react-hooks/exhaustive-deps

  async function runPendingAction(action: "approve" | "reject") {
    if (!selectedPendingPuzzleId) return;
    const pendingPuzzleId = selectedPendingPuzzleId;
    setApprovalActionLoading(true);
    setApprovalActionMessage(null);
    setApprovalDetailError(null);
    try {
      const response = await fetch(
        `/api/admin/dev-puzzle/pending/${encodeURIComponent(pendingPuzzleId)}/${action}`,
        {
          method: "POST",
        }
      );
      const json = await response.json();
      if (!response.ok) {
        throw new Error(json?.error ?? `Failed to ${action} puzzle.`);
      }
      setApprovalActionMessage(
        action === "approve" ? "Pending puzzle approved." : "Pending puzzle rejected."
      );
      setApprovalDetail(null);
      await refreshApprovalQueue();
      await refreshMetaNextOpenDay();
      await refreshOptimizerLog();
    } catch (error) {
      setApprovalDetailError((error as Error).message);
    } finally {
      setApprovalActionLoading(false);
    }
  }

  async function runPuzzleAction(action: "swap" | "earlier" | "later" | "delete") {
    if (!selectedPuzzleId) return;
    if (
      action === "delete" &&
      !window.confirm(
        "Delete this future puzzle and shift every later puzzle up one day to fill the gap?"
      )
    ) {
      return;
    }
    setPuzzleActionLoading(true);
    setPuzzleActionError(null);
    setPuzzleActionMessage(null);
    try {
      const response = await fetch(
        action === "swap"
          ? `/api/admin/dev-puzzle/puzzles/${encodeURIComponent(selectedPuzzleId)}/swap-slots`
          : action === "delete"
            ? `/api/admin/dev-puzzle/puzzles/${encodeURIComponent(selectedPuzzleId)}/delete`
            : `/api/admin/dev-puzzle/puzzles/${encodeURIComponent(selectedPuzzleId)}/move-date`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body:
            action === "swap"
              ? JSON.stringify({ slotA: swapSlotA, slotB: swapSlotB })
              : action === "delete"
                ? undefined
                : JSON.stringify({ direction: action }),
        }
      );
      const json = await response.json();
      if (!response.ok) {
        throw new Error(json?.error ?? "Puzzle update failed.");
      }
      await refreshPuzzleList();
      if (action === "delete") {
        setPuzzleDetail(null);
      } else {
        await refreshPuzzleDetail(selectedPuzzleId);
      }
      await refreshMetaNextOpenDay();
      setPuzzleActionMessage(
        action === "swap"
          ? "Node positions swapped."
          : action === "delete"
            ? `Deleted ${json?.removedDate ?? "the puzzle date"} and shifted ${json?.shiftedCount ?? 0} later puzzle(s) forward.`
          : action === "earlier"
            ? "Puzzle moved earlier in the future schedule."
            : "Puzzle moved later in the future schedule."
      );
    } catch (error) {
      setPuzzleActionError((error as Error).message);
    } finally {
      setPuzzleActionLoading(false);
    }
  }

  async function handleInspectSubmission() {
    if (!inspectorUsername.trim() || !inspectorDate) {
      setInspectorError("Enter an exact username and puzzle date first.");
      return;
    }

    try {
      setInspectorLoading(true);
      setInspectorError(null);
      const params = new URLSearchParams({
        username: inspectorUsername.trim(),
        date: inspectorDate,
        mode: inspectorMode,
      });
      const response = await fetch(`/api/admin/submission-inspector?${params.toString()}`, {
        cache: "no-store",
      });
      const json = await response.json();
      if (!response.ok) {
        throw new Error(json?.error ?? "Failed to inspect submission.");
      }
      setInspectorResult(json as SubmissionInspectorResponse);
    } catch (error) {
      setInspectorResult(null);
      setInspectorError((error as Error).message);
    } finally {
      setInspectorLoading(false);
    }
  }

  function handleRandomizeSlots() {
    const nextSlotRuleIds = buildRandomSlotRuleIds(meta?.slotRules ?? []);
    if (!nextSlotRuleIds) {
      setPreviewError("Not enough slot rules are available to randomize all five slots.");
      return;
    }

    setSlotRuleIds(nextSlotRuleIds);
    setPreview(null);
    setPreviewError(null);
    setSaveError(null);
    setSaveMessage(null);
    setSaveConfirmOpen(false);
    setAutoBuildMessage(null);
  }

  async function handleAutoBuild() {
    if (!meta || meta.relationships.length === 0) {
      setPreviewError("Dev metadata is still loading.");
      return;
    }

    try {
      autoBuildStopRequestedRef.current = false;
      setAutoBuildLoading(true);
      setAutoBuildMessage("Searching for a puzzle with 7+ active links and fresh players...");
      setPreviewError(null);
      setSaveError(null);
      setSaveMessage(null);
      setSaveConfirmOpen(false);
      const onlyOnePossibleAttempt =
        timePeriodLocked && linkTypeLocked && slotLocks.every(Boolean);
      const maxAttempts = onlyOnePossibleAttempt
        ? 1
        : Math.max(1, autoBuildMaxAttempts);

      for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        if (autoBuildStopRequestedRef.current) {
          setAutoBuildMessage(`Stopped after ${attempt - 1} attempt${attempt - 1 === 1 ? "" : "s"}.`);
          return;
        }

        const themeRange = timePeriodLocked
          ? { startSeason, endSeason }
          : pickRandomItem(AUTO_THEME_RANGES);
        const relationship = linkTypeLocked
          ? meta.relationships.find(
              (item) => item.relationship_rule_id === relationshipRuleId
            ) ?? null
          : pickRandomItem(meta.relationships);
        const randomizedSlotRuleIds = buildRandomSlotRuleIdsWithLocks(
          meta.slotRules,
          slotRuleIds,
          slotLocks
        );

        if (!themeRange || !relationship || !randomizedSlotRuleIds) {
          continue;
        }

        const candidateConfig: BuilderConfig = {
          startSeason: themeRange.startSeason,
          endSeason: themeRange.endSeason,
          relationshipRuleId: relationship.relationship_rule_id,
          slotRuleIds: randomizedSlotRuleIds,
          title: buildSuggestedTitleForConfig({
            startSeason: themeRange.startSeason,
            endSeason: themeRange.endSeason,
            relationshipRuleId: relationship.relationship_rule_id,
          }),
        };

        let candidatePreview: PreviewResponse;
        try {
          candidatePreview = await requestPreview(
            candidateConfig,
            buildCurrentGeneratorSettings()
          );
        } catch (error) {
          const message = error instanceof Error ? error.message : "Preview failed.";
          if (
            message.includes("No valid candidate pool") ||
            message.includes("cannot meet current generator thresholds")
          ) {
            continue;
          }
          throw error;
        }

        if (autoBuildStopRequestedRef.current) {
          setAutoBuildMessage(`Stopped after ${attempt} attempt${attempt === 1 ? "" : "s"}.`);
          return;
        }

        const passesActiveLinks =
          candidatePreview.optimal_active_links >= autoBuildMinActiveLinks;
        const totalPreviousUsage = candidatePreview.optimal_lineup.reduce(
          (sum, entry) => sum + Number(entry.previous_optimal_usage_count ?? 0),
          0
        );
        const passesUsage = totalPreviousUsage < autoBuildUsageThreshold;
        const quarterbackCount = candidatePreview.optimal_lineup.filter(
          (entry) => entry.player.primary_position === "QB"
        ).length;
        const passesQuarterbackLimit = quarterbackCount <= autoBuildMaxQbs;
        const requiredFantasyPoints =
          (candidateConfig.endSeason - candidateConfig.startSeason + 1) *
          autoBuildMinFantasyPointsPerSeason;
        const passesImpactThreshold = candidatePreview.optimal_lineup.every(
          (entry) => Number(entry.player.fantasy_points ?? 0) >= requiredFantasyPoints
        );

        if (
          passesActiveLinks &&
          passesUsage &&
          passesQuarterbackLimit &&
          passesImpactThreshold
        ) {
          setStartSeason(candidateConfig.startSeason);
          setEndSeason(candidateConfig.endSeason);
          setRelationshipRuleId(candidateConfig.relationshipRuleId);
          setSlotRuleIds(candidateConfig.slotRuleIds);
          setTitleTouched(false);
          setTitle(candidateConfig.title);
          setPreview(candidatePreview);
          setAutoBuildMessage(`Found a keeper in ${attempt} attempt${attempt === 1 ? "" : "s"}.`);
          return;
        }
      }

      setAutoBuildMessage(
        `No qualifying puzzle found after ${maxAttempts} attempts.`
      );
    } catch (error) {
      setPreview(null);
      setPreviewError((error as Error).message);
      setAutoBuildMessage(null);
    } finally {
      autoBuildStopRequestedRef.current = false;
      setAutoBuildLoading(false);
    }
  }

  async function handleGenerate() {
    if (!relationshipRuleId || slotRuleIds.some((id) => !id)) {
      setPreviewError("Pick a time period, link type, and five slot parameters first.");
      return;
    }

    try {
      setPreviewLoading(true);
      setPreviewError(null);
      setSaveMessage(null);
      setSaveError(null);
      setSaveConfirmOpen(false);
      setPreview(await requestPreview(undefined, buildCurrentGeneratorSettings()));
    } catch (error) {
      setPreview(null);
      setPreviewError((error as Error).message);
    } finally {
      setPreviewLoading(false);
    }
  }

  async function handleSave() {
    if (!relationshipRuleId || slotRuleIds.some((id) => !id)) {
      setSaveError("Build a valid puzzle before saving.");
      return;
    }

    try {
      setSaveLoading(true);
      setSaveError(null);
      setSaveMessage(null);
      setSaveConfirmOpen(false);

      const response = await fetch("/api/admin/dev-puzzle/save", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: titleTouched ? title : suggestedTitle,
          startSeason,
          endSeason,
          relationshipRuleId,
          slotRuleIds,
          positionOverlayEnabled,
          qbExclusionEnabled,
        }),
      });

      const json = await response.json();
      if (!response.ok) {
        throw new Error(json?.error ?? "Failed to save puzzle.");
      }

      setSaveMessage(`Saved to ${json.puzzle_date}.`);
      await refreshMetaNextOpenDay();
      setPreview(await requestPreview(undefined, buildCurrentGeneratorSettings()));
    } catch (error) {
      setSaveError((error as Error).message);
    } finally {
      setSaveLoading(false);
    }
  }

  if (status === "loading") {
    return <main className="min-h-screen bg-slate-950 p-8 text-white">Loading dev tools...</main>;
  }

  if (!session) {
    return (
      <main className="min-h-screen bg-slate-950 p-8 text-white">
        <div className="mx-auto max-w-2xl rounded-[28px] border border-white/10 bg-white/5 p-8">
          <h1 className="text-3xl font-black">Dev Tools</h1>
          <p className="mt-3 text-sm text-slate-300">
            Sign in with the admin account to access the private puzzle builder.
          </p>
          <button
            type="button"
            onClick={() => void signIn("google")}
            className="mt-6 rounded-full bg-emerald-400 px-5 py-3 text-sm font-black text-slate-950"
          >
            Sign In
          </button>
        </div>
      </main>
    );
  }

  if (!isAdmin) {
    return (
      <main className="min-h-screen bg-slate-950 p-8 text-white">
        <div className="mx-auto max-w-2xl rounded-[28px] border border-rose-400/30 bg-rose-500/10 p-8">
          <h1 className="text-3xl font-black">Unauthorized</h1>
          <p className="mt-3 text-sm text-rose-100">
            This builder is only enabled for the configured admin account.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#1e293b_0%,#0f172a_42%,#020617_100%)] px-4 pb-24 pt-6 text-white sm:px-6">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-300">
              Private Builder
            </p>
            <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">
              Dev Puzzle Generator
            </h1>
              <p className="mt-2 max-w-2xl text-sm text-slate-300">
              Tune the time period, link rule, slot parameters, and lineup rules,
                then preview the optimal lineup before sending the puzzle to the next
                open day.
              </p>
          </div>
          <div className="rounded-[24px] border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200">
            <p className="font-black text-white">Next Open Day</p>
            <p className="mt-1">{meta?.nextAvailableDate ?? "Loading..."}</p>
          </div>
        </div>

        <div className="mb-6 flex flex-wrap items-center gap-2 rounded-full border border-white/10 bg-white/5 p-1 shadow-[0_12px_32px_rgba(2,6,23,0.28)] backdrop-blur-xl">
          <button
            type="button"
            onClick={() => setDevTab("overview")}
            className={`rounded-full px-4 py-2 text-xs font-black uppercase tracking-[0.12em] transition ${
              devTab === "overview"
                ? "bg-amber-300 text-slate-950"
                : "text-slate-300"
            }`}
          >
            Overview
          </button>
          <button
            type="button"
            onClick={() => setDevTab("create")}
            className={`rounded-full px-4 py-2 text-xs font-black uppercase tracking-[0.12em] transition ${
              devTab === "create"
                ? "bg-cyan-300 text-slate-950"
                : "text-slate-300"
            }`}
          >
            Create
          </button>
          <button
            type="button"
            onClick={() => setDevTab("review")}
            className={`rounded-full px-4 py-2 text-xs font-black uppercase tracking-[0.12em] transition ${
              devTab === "review"
                ? "bg-emerald-300 text-slate-950"
                : "text-slate-300"
            }`}
          >
            Review
          </button>
          <button
            type="button"
            onClick={() => setDevTab("inspector")}
            className={`rounded-full px-4 py-2 text-xs font-black uppercase tracking-[0.12em] transition ${
              devTab === "inspector"
                ? "bg-violet-300 text-slate-950"
                : "text-slate-300"
            }`}
          >
            Inspector
          </button>
          <button
            type="button"
            onClick={() => setDevTab("schedule")}
            className={`rounded-full px-4 py-2 text-xs font-black uppercase tracking-[0.12em] transition ${
              devTab === "schedule"
                ? "bg-emerald-300 text-slate-950"
                : "text-slate-300"
            }`}
          >
            Schedule
            <span className="ml-2 rounded-full bg-slate-950/15 px-2 py-0.5 text-[10px]">
              {futurePuzzleCount}
            </span>
          </button>
        </div>

        {devTab === "create" ? (
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-[24px] border border-cyan-300/15 bg-cyan-300/8 px-4 py-4 shadow-[0_18px_48px_rgba(2,6,23,0.28)] backdrop-blur-xl">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.14em] text-cyan-200">
                Create Workspace
              </p>
              <p className="mt-1 text-sm text-slate-300">
                Use Manual Builder for one-off puzzle work, or switch to Automation to keep the pending queue healthy.
              </p>
            </div>
            <div className="flex items-center gap-2 rounded-full border border-white/10 bg-slate-950/35 p-1">
              <button
                type="button"
                onClick={() => setCreateView("manual")}
                className={`rounded-full px-4 py-2 text-xs font-black uppercase tracking-[0.12em] transition ${
                  createView === "manual"
                    ? "bg-cyan-300 text-slate-950"
                    : "text-slate-300"
                }`}
              >
                Manual Builder
              </button>
              <button
                type="button"
                onClick={() => setCreateView("automation")}
                className={`rounded-full px-4 py-2 text-xs font-black uppercase tracking-[0.12em] transition ${
                  createView === "automation"
                    ? "bg-amber-300 text-slate-950"
                    : "text-slate-300"
                }`}
              >
                Automation
              </button>
            </div>
          </div>
        ) : null}

        {devTab === "overview" ? (
          <div className="space-y-6">
            <div className="grid gap-4 xl:grid-cols-4">
              <button
                type="button"
                onClick={() => {
                  setDevTab("create");
                  setCreateView("manual");
                }}
                className="rounded-[24px] border border-cyan-300/20 bg-cyan-300/10 p-5 text-left shadow-[0_20px_60px_rgba(2,6,23,0.32)] backdrop-blur-xl transition hover:border-cyan-200/40"
              >
                <p className="text-[11px] font-black uppercase tracking-[0.14em] text-cyan-200">
                  Create
                </p>
                <h2 className="mt-2 text-2xl font-black text-white">Build A Puzzle</h2>
                <p className="mt-2 text-sm text-slate-300">
                  Jump straight into the manual builder for one-off puzzle work.
                </p>
              </button>
              <button
                type="button"
                onClick={() => {
                  setDevTab("create");
                  setCreateView("automation");
                }}
                className="rounded-[24px] border border-amber-300/20 bg-amber-300/10 p-5 text-left shadow-[0_20px_60px_rgba(2,6,23,0.32)] backdrop-blur-xl transition hover:border-amber-200/40"
              >
                <p className="text-[11px] font-black uppercase tracking-[0.14em] text-amber-200">
                  Automation
                </p>
                <h2 className="mt-2 text-2xl font-black text-white">
                  {approvalQueue?.job?.active_flag ? "Queue Running" : "Queue Stopped"}
                </h2>
                <p className="mt-2 text-sm text-slate-300">
                  {pendingPuzzleCount} pending puzzle{pendingPuzzleCount === 1 ? "" : "s"} in the review queue.
                </p>
              </button>
              <button
                type="button"
                onClick={() => setDevTab("review")}
                className="rounded-[24px] border border-emerald-300/20 bg-emerald-300/10 p-5 text-left shadow-[0_20px_60px_rgba(2,6,23,0.32)] backdrop-blur-xl transition hover:border-emerald-200/40"
              >
                <p className="text-[11px] font-black uppercase tracking-[0.14em] text-emerald-200">
                  Review
                </p>
                <h2 className="mt-2 text-2xl font-black text-white">
                  {pendingPuzzleCount} Waiting
                </h2>
                <p className="mt-2 text-sm text-slate-300">
                  Approve or reject pending puzzles before they enter the published schedule.
                </p>
              </button>
              <button
                type="button"
                onClick={() => setDevTab("schedule")}
                className="rounded-[24px] border border-fuchsia-300/20 bg-fuchsia-300/10 p-5 text-left shadow-[0_20px_60px_rgba(2,6,23,0.32)] backdrop-blur-xl transition hover:border-fuchsia-200/40"
              >
                <p className="text-[11px] font-black uppercase tracking-[0.14em] text-fuchsia-200">
                  Schedule
                </p>
                <h2 className="mt-2 text-2xl font-black text-white">{futurePuzzleCount} Future</h2>
                <p className="mt-2 text-sm text-slate-300">
                  {archivePuzzleCount} archived puzzle{archivePuzzleCount === 1 ? "" : "s"} available for reference.
                </p>
              </button>
            </div>

            <div className="grid gap-4 xl:grid-cols-3">
              <div className="rounded-[24px] border border-white/10 bg-white/5 p-5 shadow-[0_20px_60px_rgba(2,6,23,0.32)] backdrop-blur-xl">
                <p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-300">
                  Review Inbox
                </p>
                <p className="mt-2 text-3xl font-black text-white">{pendingPuzzleCount}</p>
                <p className="mt-2 text-sm text-slate-300">
                  Pending puzzle{pendingPuzzleCount === 1 ? "" : "s"} waiting for approval.
                </p>
                {approvalQueue?.job?.last_error ? (
                  <p className="mt-3 text-sm text-amber-200">{approvalQueue.job.last_error}</p>
                ) : null}
              </div>
              <div className="rounded-[24px] border border-white/10 bg-white/5 p-5 shadow-[0_20px_60px_rgba(2,6,23,0.32)] backdrop-blur-xl">
                <p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-300">
                  Queue Health
                </p>
                <p className="mt-2 text-3xl font-black text-white">
                  {approvalQueue?.job?.active_flag ? "Running" : "Idle"}
                </p>
                <p className="mt-2 text-sm text-slate-300">
                  Target: {queueForm.targetPendingCount} pending puzzle{queueForm.targetPendingCount === 1 ? "" : "s"}.
                </p>
                {approvalActionMessage ? (
                  <p className="mt-3 text-sm text-emerald-300">{approvalActionMessage}</p>
                ) : null}
              </div>
              <div className="rounded-[24px] border border-white/10 bg-white/5 p-5 shadow-[0_20px_60px_rgba(2,6,23,0.32)] backdrop-blur-xl">
                <p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-300">
                  Schedule Snapshot
                </p>
                <p className="mt-2 text-3xl font-black text-white">{futurePuzzleCount}</p>
                <p className="mt-2 text-sm text-slate-300">
                  Future editable puzzle{futurePuzzleCount === 1 ? "" : "s"} queued in the published schedule.
                </p>
                <p className="mt-3 text-sm text-slate-400">
                  {needsApprovalAttention
                    ? "There is something active in the queue or review flow."
                    : "Queue and review look calm right now."}
                </p>
              </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-4">
            {dashboardStatsLoading ? (
              <div className="lg:col-span-2 xl:col-span-4 rounded-[24px] border border-dashed border-white/15 bg-white/5 px-5 py-12 text-sm text-slate-400">
                Loading dashboard stats...
              </div>
            ) : null}
            {dashboardStatsError ? (
              <div className="lg:col-span-2 xl:col-span-4 rounded-[24px] border border-rose-400/20 bg-rose-500/10 px-5 py-5 text-sm text-rose-200">
                {dashboardStatsError}
              </div>
            ) : null}
            {dashboardStats ? (
              <>
                <div className="rounded-[24px] border border-white/10 bg-white/5 p-5 text-center shadow-[0_24px_80px_rgba(2,6,23,0.32)] backdrop-blur-xl">
                  <p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-300">
                    Total Users
                  </p>
                  <p className="mt-3 text-4xl font-black text-white">
                    {dashboardStats.total_users.toLocaleString()}
                  </p>
                  <p className="mt-2 text-sm text-slate-300">
                    {dashboardStats.users_created_today.toLocaleString()} joined today
                  </p>
                </div>
                <div className="rounded-[24px] border border-white/10 bg-white/5 p-5 text-center shadow-[0_24px_80px_rgba(2,6,23,0.32)] backdrop-blur-xl">
                  <p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-300">
                    Total Submissions
                  </p>
                  <p className="mt-3 text-4xl font-black text-white">
                    {dashboardStats.total_submissions.toLocaleString()}
                  </p>
                  <p className="mt-2 text-sm text-slate-300">
                    {dashboardStats.submissions_today.toLocaleString()} submitted today
                  </p>
                </div>
                <div className="rounded-[24px] border border-white/10 bg-white/5 p-5 text-center shadow-[0_24px_80px_rgba(2,6,23,0.32)] backdrop-blur-xl">
                  <p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-300">
                    Today&apos;s Puzzle
                  </p>
                  <p className="mt-3 text-4xl font-black text-white">
                    {dashboardStats.todays_puzzle_submissions.toLocaleString()}
                  </p>
                  <p className="mt-2 text-sm text-slate-300">
                    {dashboardStats.todays_unique_submitters.toLocaleString()} unique submitters
                  </p>
                </div>
                <div className="rounded-[24px] border border-white/10 bg-white/5 p-5 text-center shadow-[0_24px_80px_rgba(2,6,23,0.32)] backdrop-blur-xl">
                  <p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-300">
                    Puzzle Inventory
                  </p>
                  <p className="mt-3 text-4xl font-black text-white">
                    {dashboardStats.total_puzzles.toLocaleString()}
                  </p>
                  <p className="mt-2 text-sm text-slate-300">
                    {dashboardStats.published_puzzles.toLocaleString()} published
                  </p>
                </div>
                <div className="lg:col-span-2 xl:col-span-2 rounded-[24px] border border-white/10 bg-white/5 p-5 text-center shadow-[0_24px_80px_rgba(2,6,23,0.32)] backdrop-blur-xl">
                  <p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-300">
                    Next Open Day
                  </p>
                  <p className="mt-3 text-3xl font-black text-emerald-300">
                    {formatDateLabel(dashboardStats.next_open_date)}
                  </p>
                  <p className="mt-2 text-sm text-slate-300">
                    The next puzzle saved from the builder will land here.
                  </p>
                </div>
                <div className="lg:col-span-2 xl:col-span-2 rounded-[24px] border border-white/10 bg-white/5 p-5 text-center shadow-[0_24px_80px_rgba(2,6,23,0.32)] backdrop-blur-xl">
                  <p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-300">
                    Leaderboard Awards
                  </p>
                  <p className="mt-3 text-3xl font-black text-white">
                    {dashboardStats.leaderboard_finishes_awarded.toLocaleString()}
                  </p>
                  <p className="mt-2 text-sm text-slate-300">
                    Total top-10 finish records awarded so far.
                  </p>
                </div>
                <div className="lg:col-span-2 xl:col-span-4 rounded-[24px] border border-amber-300/20 bg-amber-400/10 p-5 shadow-[0_24px_80px_rgba(2,6,23,0.32)] backdrop-blur-xl">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="max-w-3xl">
                      <p className="text-[11px] font-black uppercase tracking-[0.14em] text-amber-200">
                        Finalize Yesterday
                      </p>
                      <h3 className="mt-2 text-2xl font-black text-white">
                        Manual failsafe for the overnight top-10 finalize
                      </h3>
                      <p className="mt-3 text-sm leading-6 text-slate-200">
                        The app should automatically finalize the previous day at
                        12:01 AM Chicago time. This button is only a backup if the
                        nightly run is missed, so yesterday&apos;s top 10, badge awards,
                        and all-time finish counts can be populated manually.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void finalizeYesterdayLeaderboard()}
                      disabled={finalizeYesterdayLoading}
                      className={`rounded-full px-5 py-3 text-sm font-black uppercase tracking-[0.14em] transition ${
                        finalizeYesterdayLoading
                          ? "cursor-wait bg-slate-700 text-slate-300"
                          : "bg-amber-300 text-slate-950 hover:bg-amber-200"
                      }`}
                    >
                      {finalizeYesterdayLoading ? "Finalizing..." : "Finalize Yesterday"}
                    </button>
                  </div>
                  {finalizeYesterdayMessage ? (
                    <div className="mt-4 rounded-[18px] border border-emerald-300/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-200">
                      {finalizeYesterdayMessage}
                    </div>
                  ) : null}
                  {finalizeYesterdayError ? (
                    <div className="mt-4 rounded-[18px] border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
                      {finalizeYesterdayError}
                    </div>
                  ) : null}
                </div>
                <div className="lg:col-span-2 xl:col-span-4 rounded-[24px] border border-white/10 bg-white/5 p-3 shadow-[0_24px_80px_rgba(2,6,23,0.32)] backdrop-blur-xl">
                  <div className="flex flex-wrap items-center justify-center gap-2">
                    {STATS_TREND_WINDOWS.map((windowOption) => {
                      const active = statsTrendDays === windowOption.days;
                      return (
                        <button
                          key={windowOption.days}
                          type="button"
                          onClick={() => setStatsTrendDays(windowOption.days)}
                          className={`rounded-full px-4 py-2 text-xs font-black uppercase tracking-[0.12em] transition ${
                            active
                              ? "bg-cyan-300 text-slate-950"
                              : "border border-white/10 bg-slate-950/35 text-slate-300 hover:border-white/20"
                          }`}
                        >
                          {windowOption.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="lg:col-span-2 xl:col-span-4 grid gap-6 xl:grid-cols-3">
                  <TrendChart
                    title="New Users"
                    subtitle={
                      STATS_TREND_WINDOWS.find((option) => option.days === statsTrendDays)
                        ?.subtitle ?? "Recent trend"
                    }
                    accentClassName="text-cyan-300"
                    series={dashboardStats.user_trend}
                  />
                  <TrendChart
                    title="All Submissions"
                    subtitle={
                      STATS_TREND_WINDOWS.find((option) => option.days === statsTrendDays)
                        ?.subtitle ?? "Recent trend"
                    }
                    accentClassName="text-emerald-300"
                    series={dashboardStats.submission_trend}
                  />
                  <TrendChart
                    title="Daily Puzzle Volume"
                    subtitle={
                      STATS_TREND_WINDOWS.find((option) => option.days === statsTrendDays)
                        ?.subtitle ?? "Recent trend"
                    }
                    accentClassName="text-amber-300"
                    series={dashboardStats.daily_puzzle_submission_trend}
                  />
                </div>
                <div className="lg:col-span-2 xl:col-span-4 rounded-[24px] border border-cyan-300/20 bg-cyan-400/10 p-5 shadow-[0_24px_80px_rgba(2,6,23,0.32)] backdrop-blur-xl">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="max-w-3xl">
                      <p className="text-[11px] font-black uppercase tracking-[0.14em] text-cyan-200">
                        Generator Search Space
                      </p>
                      <h3 className="mt-2 text-2xl font-black text-white">
                        Why the optimizer needs pruning, staging, and memory
                      </h3>
                      <p className="mt-3 text-sm leading-6 text-slate-200">
                        The raw puzzle space is too large to brute force. Even before
                        checking actual player lineups, the builder is choosing from{" "}
                        <span className="font-black text-white">
                          {SEARCH_SPACE_SNAPSHOT.activeLinkTypes}
                        </span>{" "}
                        active links,{" "}
                        <span className="font-black text-white">
                          {SEARCH_SPACE_SNAPSHOT.slotParameters}
                        </span>{" "}
                        slot parameters,{" "}
                        <span className="font-black text-white">
                          {SEARCH_SPACE_SNAPSHOT.toggleModes}
                        </span>{" "}
                        lineup-rule modes, and hundreds of time windows.
                      </p>
                    </div>
                    <div className="rounded-[20px] border border-white/10 bg-slate-950/35 px-4 py-3 text-center">
                      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">
                        Full Builder Space
                      </p>
                      <p className="mt-2 text-3xl font-black text-cyan-200">
                        {SEARCH_SPACE_SNAPSHOT.fullBuilderSpace}
                      </p>
                    </div>
                  </div>
                  <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <div className="rounded-[20px] border border-white/10 bg-white/5 p-4 text-center">
                      <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">
                        Link Types
                      </p>
                      <p className="mt-2 text-2xl font-black text-white">
                        {SEARCH_SPACE_SNAPSHOT.activeLinkTypes}
                      </p>
                      <p className="mt-2 text-xs text-slate-300">
                        Relationship rules the generator can test.
                      </p>
                    </div>
                    <div className="rounded-[20px] border border-white/10 bg-white/5 p-4 text-center">
                      <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">
                        Slot Parameters
                      </p>
                      <p className="mt-2 text-2xl font-black text-white">
                        {SEARCH_SPACE_SNAPSHOT.slotParameters}
                      </p>
                      <p className="mt-2 text-xs text-slate-300">
                        {SEARCH_SPACE_SNAPSHOT.colleges} colleges,{" "}
                        {SEARCH_SPACE_SNAPSHOT.teams} teams,{" "}
                        {SEARCH_SPACE_SNAPSHOT.divisions} divisions,{" "}
                        {SEARCH_SPACE_SNAPSHOT.positions} positions, plus the rest.
                      </p>
                    </div>
                    <div className="rounded-[20px] border border-white/10 bg-white/5 p-4 text-center">
                      <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">
                        Time Windows
                      </p>
                      <p className="mt-2 text-2xl font-black text-white">
                        {SEARCH_SPACE_SNAPSHOT.autoThemeRanges}
                        <span className="ml-2 text-sm text-slate-400">auto</span>
                      </p>
                      <p className="mt-2 text-xs text-slate-300">
                        {SEARCH_SPACE_SNAPSHOT.fullThemeRanges} total consecutive
                        windows from 2000-2025.
                      </p>
                    </div>
                    <div className="rounded-[20px] border border-white/10 bg-white/5 p-4 text-center">
                      <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">
                        Ordered Slot Tuples
                      </p>
                      <p className="mt-2 text-2xl font-black text-white">
                        {SEARCH_SPACE_SNAPSHOT.orderedSlotTuples}
                      </p>
                      <p className="mt-2 text-xs text-slate-300">
                        Distinct 5-slot parameter orders before players are even tested.
                      </p>
                    </div>
                  </div>
                  <div className="mt-5 grid gap-4 xl:grid-cols-2">
                    <div className="rounded-[20px] border border-emerald-300/20 bg-emerald-400/10 p-4 text-center">
                      <p className="text-[10px] font-black uppercase tracking-[0.12em] text-emerald-200">
                        Auto Queue Search Space
                      </p>
                      <p className="mt-2 text-3xl font-black text-white">
                        {SEARCH_SPACE_SNAPSHOT.autoQueueSpace}
                      </p>
                      <p className="mt-2 text-xs text-slate-200">
                        Based on {SEARCH_SPACE_SNAPSHOT.autoThemeRanges} queue theme
                        windows x {SEARCH_SPACE_SNAPSHOT.activeLinkTypes} links x{" "}
                        {SEARCH_SPACE_SNAPSHOT.toggleModes} lineup modes x ordered slot
                        tuples.
                      </p>
                    </div>
                    <div className="rounded-[20px] border border-amber-300/20 bg-amber-400/10 p-4 text-center">
                      <p className="text-[10px] font-black uppercase tracking-[0.12em] text-amber-200">
                        Why It Gets Faster
                      </p>
                      <p className="mt-2 text-sm leading-6 text-slate-100">
                        The generator now relies on staged anchors, branch pruning,
                        and a persistent invalid-pool cache. Every time it proves a
                        theme or slot shape is impossible, it can skip that dead path
                        next time instead of relearning it.
                      </p>
                    </div>
                  </div>
                </div>
              </>
            ) : null}
            </div>
          </div>
        ) : (devTab === "create" && createView === "automation") || devTab === "review" ? (
          <div
            className={
              devTab === "create"
                ? "flex flex-col gap-6"
                : "grid gap-6 xl:grid-cols-[0.86fr_1.14fr]"
            }
          >
            <section
              className={
                devTab === "create" ? "flex flex-col gap-6" : "space-y-6"
              }
            >
              {devTab === "create" ? (
              <div className="order-3 rounded-[28px] border border-white/10 bg-white/5 p-5 shadow-[0_24px_80px_rgba(2,6,23,0.45)] backdrop-blur-xl">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-300">
                      Optimizer
                    </p>
                    <h2 className="mt-2 text-2xl font-black text-white">
                      Search Control Center
                    </h2>
                    <p className="mt-2 text-sm text-slate-300">
                      Tune puzzle targets, search techniques, and hyperparameters before generating pending puzzles.
                    </p>
                  </div>
                  <div
                    className={`rounded-full px-3 py-2 text-xs font-black uppercase tracking-[0.12em] ${
                      approvalActionLoading
                        ? "border border-cyan-300/30 bg-cyan-300/10 text-cyan-100"
                        : approvalQueue?.job?.active_flag
                        ? "border border-emerald-300/30 bg-emerald-300/10 text-emerald-200"
                        : "border border-white/10 bg-slate-950/35 text-slate-300"
                    }`}
                  >
                    {approvalActionLoading
                      ? "Working"
                      : approvalQueue?.job?.active_flag
                        ? "Running"
                        : "Stopped"}
                  </div>
                </div>

                <div className="mt-5 grid gap-6 xl:grid-cols-2">
                  <div className="min-w-0 space-y-3">
                    <div className="rounded-[18px] border border-emerald-300/20 bg-emerald-400/10 px-4 py-3">
                      <p className="text-[11px] font-black uppercase tracking-[0.14em] text-emerald-200">
                        Puzzle Goals
                      </p>
                      <p className="mt-1 text-xs text-slate-300">
                        These settings describe what a good puzzle should look like once the optimizer finds one.
                      </p>
                    </div>
                    <label className="block rounded-[18px] border border-white/10 bg-slate-950/35 px-4 py-3">
                      <span className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-300">
                        Pending Queue Target
                      </span>
                      <input
                        type="number"
                        min={1}
                        step={1}
                        value={queueForm.targetPendingCount}
                        onChange={(event) =>
                          setQueueForm((current) => ({
                            ...current,
                            targetPendingCount: Math.max(1, Number(event.target.value) || 1),
                          }))
                        }
                        className="mt-2 w-full rounded-[14px] border border-white/10 bg-slate-900 px-3 py-2 text-sm font-black text-white outline-none"
                      />
                    </label>
                    <label className="block rounded-[18px] border border-white/10 bg-slate-950/35 px-4 py-3">
                      <span className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-300">
                        Min Active Links
                      </span>
                      <input
                        type="number"
                        min={0}
                        max={10}
                        step={1}
                        value={queueForm.minActiveLinks}
                        onChange={(event) =>
                          setQueueForm((current) => ({
                            ...current,
                            minActiveLinks: Math.max(0, Number(event.target.value) || 0),
                          }))
                        }
                        className="mt-2 w-full rounded-[14px] border border-white/10 bg-slate-900 px-3 py-2 text-sm font-black text-white outline-none"
                      />
                    </label>
                    <label className="block rounded-[18px] border border-white/10 bg-slate-950/35 px-4 py-3">
                      <span className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-300">
                        Usage Total Limit
                      </span>
                      <input
                        type="number"
                        min={0}
                        step={1}
                        value={queueForm.usageThresholdTotal}
                        onChange={(event) =>
                          setQueueForm((current) => ({
                            ...current,
                            usageThresholdTotal: Math.max(0, Number(event.target.value) || 0),
                          }))
                        }
                        className="mt-2 w-full rounded-[14px] border border-white/10 bg-slate-900 px-3 py-2 text-sm font-black text-white outline-none"
                      />
                    </label>
                    <label className="block rounded-[18px] border border-white/10 bg-slate-950/35 px-4 py-3">
                      <span className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-300">
                        Max QBs
                      </span>
                      <input
                        type="number"
                        min={0}
                        step={1}
                        value={queueForm.maxQbs}
                        onChange={(event) =>
                          setQueueForm((current) => ({
                            ...current,
                            maxQbs: Math.max(0, Number(event.target.value) || 0),
                          }))
                        }
                        className="mt-2 w-full rounded-[14px] border border-white/10 bg-slate-900 px-3 py-2 text-sm font-black text-white outline-none"
                      />
                    </label>
                    <label className="block rounded-[18px] border border-white/10 bg-slate-950/35 px-4 py-3">
                      <span className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-300">
                        Min Points Per Season
                      </span>
                      <input
                        type="number"
                        min={0}
                        step={10}
                        value={queueForm.minFantasyPointsPerSeason}
                        onChange={(event) =>
                          setQueueForm((current) => ({
                            ...current,
                            minFantasyPointsPerSeason: Math.max(0, Number(event.target.value) || 0),
                          }))
                        }
                        className="mt-2 w-full rounded-[14px] border border-white/10 bg-slate-900 px-3 py-2 text-sm font-black text-white outline-none"
                      />
                    </label>
                    <label className="block rounded-[18px] border border-white/10 bg-slate-950/35 px-4 py-3">
                      <span className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-300">
                        Attempts Per Puzzle
                      </span>
                      <input
                        type="number"
                        min={1}
                        step={1}
                        value={queueForm.maxAttemptsPerPuzzle}
                        onChange={(event) =>
                          setQueueForm((current) => ({
                            ...current,
                            maxAttemptsPerPuzzle: Math.max(1, Number(event.target.value) || 1),
                          }))
                        }
                        className="mt-2 w-full rounded-[14px] border border-white/10 bg-slate-900 px-3 py-2 text-sm font-black text-white outline-none"
                      />
                    </label>
                    <label className="block rounded-[18px] border border-white/10 bg-slate-950/35 px-4 py-3">
                      <span className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-300">
                        Queue Lineup Rule
                      </span>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            setQueueForm((current) => ({
                              ...current,
                              forcePositionLock: !current.forcePositionLock,
                              forceNoQbs: !current.forcePositionLock ? false : current.forceNoQbs,
                            }))
                          }
                          className={`rounded-full px-3 py-2 text-[10px] font-black uppercase tracking-[0.12em] transition ${
                            queueForm.forcePositionLock
                              ? "bg-emerald-300 text-slate-950"
                              : "border border-white/10 bg-slate-900 text-slate-300"
                          }`}
                        >
                          One-Each Lock
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setQueueForm((current) => ({
                              ...current,
                              forceNoQbs: !current.forceNoQbs,
                              forcePositionLock: !current.forceNoQbs ? false : current.forcePositionLock,
                            }))
                          }
                          className={`rounded-full px-3 py-2 text-[10px] font-black uppercase tracking-[0.12em] transition ${
                            queueForm.forceNoQbs
                              ? "bg-rose-300 text-slate-950"
                              : "border border-white/10 bg-slate-900 text-slate-300"
                          }`}
                        >
                          No QBs
                        </button>
                      </div>
                      <p className="mt-2 text-xs text-slate-300">
                        Leave both off for open-slot puzzles. These only affect queue generation.
                      </p>
                    </label>
                  </div>

                  <div className="min-w-0 space-y-3">
                    <div className="rounded-[18px] border border-amber-300/20 bg-amber-400/10 px-4 py-3">
                      <p className="text-[11px] font-black uppercase tracking-[0.14em] text-amber-200">
                        Optimizer Controls
                      </p>
                      <p className="mt-1 text-xs text-slate-300">
                        These knobs change how the optimizer explores the search space before it decides a puzzle is worth keeping.
                      </p>
                    </div>
                    <label className="block rounded-[18px] border border-white/10 bg-slate-950/35 px-4 py-3">
                      <span className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-300">
                        Anchor Count
                      </span>
                      <input
                        type="number"
                        min={1}
                        max={4}
                        step={1}
                        value={queueForm.anchorCount}
                        onChange={(event) =>
                          setQueueForm((current) => ({
                            ...current,
                            anchorCount: Math.max(1, Number(event.target.value) || 1),
                          }))
                        }
                        className="mt-2 w-full rounded-[14px] border border-white/10 bg-slate-900 px-3 py-2 text-sm font-black text-white outline-none"
                      />
                      <p className="mt-2 text-xs text-slate-300">
                        How many slot parameters stay fixed in each staged search neighborhood.
                      </p>
                    </label>
                    <label className="block rounded-[18px] border border-white/10 bg-slate-950/35 px-4 py-3">
                      <span className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-300">
                        Stage Width
                      </span>
                      <input
                        type="number"
                        min={1}
                        max={20}
                        step={1}
                        value={queueForm.stageWidth}
                        onChange={(event) =>
                          setQueueForm((current) => ({
                            ...current,
                            stageWidth: Math.max(1, Number(event.target.value) || 1),
                          }))
                        }
                        className="mt-2 w-full rounded-[14px] border border-white/10 bg-slate-900 px-3 py-2 text-sm font-black text-white outline-none"
                      />
                      <p className="mt-2 text-xs text-slate-300">
                        How many staged slot variants get generated around one anchor set.
                      </p>
                    </label>
                    <label className="block rounded-[18px] border border-white/10 bg-slate-950/35 px-4 py-3">
                      <span className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-300">
                        Beam Width
                      </span>
                      <input
                        type="number"
                        min={1}
                        max={10}
                        step={1}
                        value={queueForm.beamWidth}
                        onChange={(event) =>
                          setQueueForm((current) => ({
                            ...current,
                            beamWidth: Math.max(1, Number(event.target.value) || 1),
                          }))
                        }
                        className="mt-2 w-full rounded-[14px] border border-white/10 bg-slate-900 px-3 py-2 text-sm font-black text-white outline-none"
                      />
                      <p className="mt-2 text-xs text-slate-300">
                        How many of the best staged skeletons survive to full preview testing.
                      </p>
                    </label>
                    <label className="block rounded-[18px] border border-white/10 bg-slate-950/35 px-4 py-3">
                      <span className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-300">
                        Search Techniques
                      </span>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            setQueueForm((current) => ({
                              ...current,
                              useAnchorSearch: !current.useAnchorSearch,
                            }))
                          }
                          className={`rounded-full px-3 py-2 text-[10px] font-black uppercase tracking-[0.12em] transition ${
                            queueForm.useAnchorSearch
                              ? "bg-amber-300 text-slate-950"
                              : "border border-white/10 bg-slate-900 text-slate-300"
                          }`}
                        >
                          Staged Anchors
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setQueueForm((current) => ({
                              ...current,
                              useSkeletonScoring: !current.useSkeletonScoring,
                            }))
                          }
                          className={`rounded-full px-3 py-2 text-[10px] font-black uppercase tracking-[0.12em] transition ${
                            queueForm.useSkeletonScoring
                              ? "bg-amber-300 text-slate-950"
                              : "border border-white/10 bg-slate-900 text-slate-300"
                          }`}
                        >
                          Skeleton Scoring
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setQueueForm((current) => ({
                              ...current,
                              useThresholdMemory: !current.useThresholdMemory,
                            }))
                          }
                          className={`rounded-full px-3 py-2 text-[10px] font-black uppercase tracking-[0.12em] transition ${
                            queueForm.useThresholdMemory
                              ? "bg-amber-300 text-slate-950"
                              : "border border-white/10 bg-slate-900 text-slate-300"
                          }`}
                        >
                          Threshold Memory
                        </button>
                      </div>
                      <p className="mt-2 text-xs text-slate-300">
                        Toggle search techniques on or off to compare optimizer behavior as you tune it.
                      </p>
                    </label>
                  </div>
                </div>

                <div className="hidden mt-5 flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => setOptimizerHowItWorksOpen(true)}
                    className="rounded-full border border-amber-300/30 bg-amber-300/10 px-4 py-3 text-xs font-black uppercase tracking-[0.12em] text-amber-100"
                  >
                    How It Works
                  </button>
                  <button
                    type="button"
                    onClick={() => void submitQueueAction("save_settings")}
                    disabled={approvalActionLoading || approvalBrowserQueueRunning}
                    className="rounded-full border border-white/15 bg-slate-950/40 px-4 py-3 text-xs font-black uppercase tracking-[0.12em] text-white disabled:opacity-60"
                  >
                    Save Settings
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      void submitQueueAction(
                        approvalQueue?.job?.active_flag ? "stop" : "start"
                      )
                    }
                    disabled={
                      approvalQueue?.job?.active_flag
                        ? approvalActionLoading
                        : approvalActionLoading || approvalBrowserQueueRunning
                    }
                    className={`rounded-full px-4 py-3 text-xs font-black uppercase tracking-[0.12em] disabled:opacity-60 ${
                      approvalQueue?.job?.active_flag
                        ? "border border-rose-300/30 bg-rose-300/10 text-rose-100"
                        : "bg-emerald-300 text-slate-950"
                    }`}
                  >
                    {approvalQueue?.job?.active_flag ? "Stop Auto Queue" : "Start Auto Queue"}
                  </button>
                  <button
                    type="button"
                    onClick={() => void submitQueueAction("run_now")}
                    disabled={approvalActionLoading || approvalBrowserQueueRunning}
                    className="rounded-full bg-cyan-300 px-4 py-3 text-xs font-black uppercase tracking-[0.12em] text-slate-950 disabled:opacity-60"
                  >
                    {approvalActionLoading || approvalBrowserQueueRunning ? "Running..." : "Run Now"}
                  </button>
                </div>

                <div className="hidden mt-4 space-y-2 text-sm">
                  {approvalQueueError ? (
                    <p className="text-rose-300">{approvalQueueError}</p>
                  ) : null}
                  {approvalActionMessage ? (
                    <p className="text-emerald-300">{approvalActionMessage}</p>
                  ) : null}
                  {approvalQueue?.job?.last_status ? (
                    <p className="text-slate-300">
                      Status: {approvalQueue.job.last_status}
                      {approvalQueue.job.last_run_at
                        ? ` • Last run ${new Date(approvalQueue.job.last_run_at).toLocaleString()}`
                        : ""}
                    </p>
                  ) : null}
                  {approvalQueue?.job?.last_error ? (
                    <p className="text-amber-200">{approvalQueue.job.last_error}</p>
                  ) : null}
                </div>
              </div>
              ) : null}

              {devTab === "review" ? (
              <div className="rounded-[28px] border border-white/10 bg-white/5 p-5 shadow-[0_24px_80px_rgba(2,6,23,0.45)] backdrop-blur-xl">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-300">
                      Pending Review
                    </p>
                    <h2 className="mt-2 text-2xl font-black text-white">
                      Queue
                    </h2>
                  </div>
                  <p className="rounded-full border border-white/10 bg-slate-950/35 px-3 py-2 text-xs font-black text-slate-200">
                    {approvalQueue?.pendingPuzzles.length ?? 0} pending
                  </p>
                </div>
                <div className="mt-5 space-y-3">
                  {approvalQueueLoading ? (
                    <div className="rounded-[22px] border border-dashed border-white/15 bg-slate-950/30 px-4 py-8 text-sm text-slate-400">
                      Loading pending puzzles...
                    </div>
                  ) : null}
                  {!approvalQueueLoading &&
                    (approvalQueue?.pendingPuzzles.length ?? 0) === 0 ? (
                    <div className="rounded-[22px] border border-dashed border-white/15 bg-slate-950/30 px-4 py-8 text-sm text-slate-400">
                      No pending puzzles yet. Start the auto queue or run it once to seed candidates.
                    </div>
                  ) : null}
                  {approvalQueue?.pendingPuzzles.map((puzzle) => {
                    const active = selectedPendingPuzzleId === puzzle.puzzle_id;
                    return (
                      <button
                        key={puzzle.puzzle_id}
                        type="button"
                        onClick={() => setSelectedPendingPuzzleId(puzzle.puzzle_id)}
                        className={`w-full rounded-[22px] border p-4 text-left transition ${
                          active
                            ? "border-cyan-300 bg-cyan-300/12 shadow-[0_14px_30px_rgba(34,211,238,0.15)]"
                            : "border-white/10 bg-slate-950/35 hover:border-white/20"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-[11px] font-black uppercase tracking-[0.14em] text-cyan-200">
                              {formatDateLabel(puzzle.puzzle_date)}
                            </p>
                            <p className="mt-2 text-sm font-black text-white">{puzzle.title}</p>
                            <p className="mt-1 text-xs text-slate-300">
                              {puzzle.theme_display_name} • {puzzle.relationship_display_text ?? "No Link"}
                            </p>
                          </div>
                          <div className="text-right text-xs text-slate-300">
                            <p>{puzzle.optimal_active_links ?? "?"} links</p>
                            <p className="mt-1">Used total {puzzle.usage_total}</p>
                            <p className="mt-1">{puzzle.qb_count} QB</p>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
              ) : (
              <>
              <div className="order-1 rounded-[28px] border border-white/10 bg-white/5 p-5 shadow-[0_24px_80px_rgba(2,6,23,0.45)] backdrop-blur-xl">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-300">
                      Optimizer Metrics
                    </p>
                    <h2 className="mt-2 text-2xl font-black text-white">
                      Live Tuning Snapshot
                    </h2>
                  </div>
                  <p className="rounded-full border border-white/10 bg-slate-950/35 px-3 py-2 text-xs font-black text-slate-200">
                    {pendingPuzzleCount} pending
                  </p>
                </div>
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-[18px] border border-white/10 bg-slate-900/55 px-4 py-3">
                    <p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-400">
                      Puzzles / Minute
                    </p>
                    <p className="mt-1 text-2xl font-black text-amber-200">
                      {optimizerPuzzlesPerMinute.toFixed(2)}
                    </p>
                    <p className="mt-1 text-xs text-slate-300">Session pace</p>
                  </div>
                  <div className="rounded-[18px] border border-white/10 bg-slate-900/55 px-4 py-3">
                    <p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-400">
                      Rolling 10m Pace
                    </p>
                    <p className="mt-1 text-2xl font-black text-cyan-200">
                      {optimizerRollingPuzzlesPerMinute.toFixed(2)}
                    </p>
                    <p className="mt-1 text-xs text-slate-300">Recent throughput</p>
                  </div>
                  <div className="rounded-[18px] border border-white/10 bg-slate-900/55 px-4 py-3">
                    <p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-400">
                      Queued This Session
                    </p>
                    <p className="mt-1 text-2xl font-black text-emerald-300">
                      {optimizerFoundTimestamps.length}
                    </p>
                    <p className="mt-1 text-xs text-slate-300">Successful pending saves</p>
                  </div>
                  <div className="rounded-[18px] border border-white/10 bg-slate-900/55 px-4 py-3">
                    <p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-400">
                      Attempts Logged
                    </p>
                    <p className="mt-1 text-2xl font-black text-white">
                      {optimizerAttemptCount.toLocaleString()}
                    </p>
                    <p className="mt-1 text-xs text-slate-300">Approximate search attempts</p>
                  </div>
                </div>
                <div className="mt-5 rounded-[22px] border border-white/10 bg-slate-950/35 p-4 text-sm text-slate-300">
                  <p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-300">
                    Current Search Stack
                  </p>
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <p>Goal filters control the kind of puzzle you want to keep.</p>
                    <p>Optimizer controls change how the search explores the space.</p>
                    <p>Threshold memory skips exact configs that already failed your current rules.</p>
                    <p>Skeleton scoring ranks staged slot layouts before running full previews.</p>
                  </div>
                </div>
                <div className="mt-5 rounded-[22px] border border-amber-300/20 bg-amber-400/10 p-4 text-sm text-slate-200">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-black uppercase tracking-[0.14em] text-amber-200">
                        Efficiency Estimate
                      </p>
                      <h3 className="mt-2 text-xl font-black text-white">
                        Brute Force vs Current Search Budget
                      </h3>
                    </div>
                    <p className="rounded-full border border-white/10 bg-slate-950/35 px-3 py-2 text-xs font-black text-slate-200">
                      Auto queue space
                    </p>
                  </div>
                  <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <div className="rounded-[18px] border border-white/10 bg-slate-900/55 px-4 py-3">
                      <p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-400">
                        Brute Force Space
                      </p>
                      <p className="mt-1 text-2xl font-black text-white">
                        {formatCompactLargeNumber(AUTO_QUEUE_SEARCH_SPACE_COUNT)}
                      </p>
                      <p className="mt-1 text-xs text-slate-300">
                        Rough full auto-queue search space
                      </p>
                    </div>
                    <div className="rounded-[18px] border border-white/10 bg-slate-900/55 px-4 py-3">
                      <p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-400">
                        Current Preview Budget
                      </p>
                      <p className="mt-1 text-2xl font-black text-cyan-200">
                        {formatCompactLargeNumber(currentPreviewBudgetPerPuzzle)}
                      </p>
                      <p className="mt-1 text-xs text-slate-300">
                        Max full previews per puzzle target
                      </p>
                    </div>
                    <div className="rounded-[18px] border border-white/10 bg-slate-900/55 px-4 py-3">
                      <p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-400">
                        Reduction Ratio
                      </p>
                      <p className="mt-1 text-2xl font-black text-emerald-300">
                        {formatCompactLargeNumber(bruteForceReductionPerPuzzle)}x
                      </p>
                      <p className="mt-1 text-xs text-slate-300">
                        Fewer full previews than brute force
                      </p>
                    </div>
                    <div className="rounded-[18px] border border-white/10 bg-slate-900/55 px-4 py-3">
                      <p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-400">
                        Attempts / Minute
                      </p>
                      <p className="mt-1 text-2xl font-black text-white">
                        {optimizerAttemptsPerMinute > 0 ? optimizerAttemptsPerMinute.toFixed(2) : "N/A"}
                      </p>
                      <p className="mt-1 text-xs text-slate-300">
                        Based on this session
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <div className="rounded-[18px] border border-white/10 bg-slate-900/55 px-4 py-3">
                      <p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-400">
                        Estimated Time At Current Pace
                      </p>
                      <p className="mt-1 text-lg font-black text-white">
                        Current budget: {formatDurationEstimate(estimatedCurrentBudgetMinutes)}
                      </p>
                      <p className="mt-1 text-sm font-black text-amber-200">
                        Brute force: {formatDurationEstimate(estimatedBruteForceMinutesAtObservedPace)}
                      </p>
                    </div>
                    <div className="rounded-[18px] border border-white/10 bg-slate-900/55 px-4 py-3">
                      <p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-400">
                        Queue Fill Budget
                      </p>
                      <p className="mt-1 text-lg font-black text-white">
                        {formatCompactLargeNumber(currentPreviewBudgetForQueue)} previews
                      </p>
                      <p className="mt-1 text-sm font-black text-emerald-300">
                        {formatCompactLargeNumber(bruteForceReductionForQueue)}x reduction for a full queue fill
                      </p>
                    </div>
                  </div>
                  <p className="mt-3 text-xs text-slate-300">
                    This is an estimate, not an exact node count. The brute-force side assumes the full
                    auto-queue puzzle space, while the current side uses your configured preview budget and
                    observed attempt pace from this session.
                  </p>
                  <p className="mt-2 text-xs text-slate-400">
                    For reference, the full builder space is about {formatCompactLargeNumber(FULL_BUILDER_SEARCH_SPACE_COUNT)} total puzzle shapes.
                  </p>
                </div>
              </div>

              <div className="order-2 rounded-[24px] border border-white/10 bg-white/5 px-5 py-4 shadow-[0_20px_60px_rgba(2,6,23,0.38)] backdrop-blur-xl">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => setOptimizerHowItWorksOpen(true)}
                    className="rounded-full border border-amber-300/30 bg-amber-300/10 px-4 py-2.5 text-xs font-black uppercase tracking-[0.12em] text-amber-100"
                  >
                    How It Works
                  </button>
                  <button
                    type="button"
                    onClick={() => void submitQueueAction("save_settings")}
                    disabled={approvalActionLoading || approvalBrowserQueueRunning}
                    className="rounded-full border border-white/15 bg-slate-950/40 px-4 py-2.5 text-xs font-black uppercase tracking-[0.12em] text-white disabled:opacity-60"
                  >
                    Save Settings
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      void submitQueueAction(
                        approvalQueue?.job?.active_flag ? "stop" : "start"
                      )
                    }
                    disabled={
                      approvalQueue?.job?.active_flag
                        ? approvalActionLoading
                        : approvalActionLoading || approvalBrowserQueueRunning
                    }
                    className={`rounded-full px-4 py-2.5 text-xs font-black uppercase tracking-[0.12em] disabled:opacity-60 ${
                      approvalQueue?.job?.active_flag
                        ? "border border-rose-300/30 bg-rose-300/10 text-rose-100"
                        : "bg-emerald-300 text-slate-950"
                    }`}
                  >
                    {approvalQueue?.job?.active_flag ? "Stop Auto Queue" : "Start Auto Queue"}
                  </button>
                  <button
                    type="button"
                    onClick={() => void submitQueueAction("run_now")}
                    disabled={approvalActionLoading || approvalBrowserQueueRunning}
                    className="rounded-full bg-cyan-300 px-4 py-2.5 text-xs font-black uppercase tracking-[0.12em] text-slate-950 disabled:opacity-60"
                  >
                    {approvalActionLoading || approvalBrowserQueueRunning ? "Running..." : "Run Now"}
                  </button>
                </div>

                  <div className="rounded-[18px] border border-white/10 bg-slate-950/35 px-4 py-3 text-sm lg:min-w-[320px]">
                    <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">
                      Queue Status
                    </p>
                    <div className="mt-2 space-y-1.5">
                      {approvalQueueError ? (
                        <p className="text-rose-300">{approvalQueueError}</p>
                      ) : null}
                      {approvalActionMessage ? (
                        <p className="text-emerald-300">{approvalActionMessage}</p>
                      ) : null}
                      {approvalQueue?.job?.last_status ? (
                        <p className="text-slate-300">
                          Status: {approvalQueue.job.last_status}
                          {approvalQueue.job.last_run_at
                            ? ` • Last run ${new Date(approvalQueue.job.last_run_at).toLocaleString()}`
                            : ""}
                        </p>
                      ) : null}
                      {approvalQueue?.job?.last_error ? (
                        <p className="text-amber-200">{approvalQueue.job.last_error}</p>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>
              </>
              )}
            </section>

            <section
              className={`rounded-[28px] border border-white/10 bg-white/5 p-5 shadow-[0_24px_80px_rgba(2,6,23,0.45)] backdrop-blur-xl ${
                devTab === "create" ? "order-4" : ""
              }`}
            >
              {devTab === "create" ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-300">
                        Optimizer Log
                      </p>
                      <h2 className="mt-2 text-2xl font-black text-white">
                        Build History
                      </h2>
                    </div>
                    <p className="rounded-full border border-white/10 bg-slate-950/35 px-3 py-2 text-xs font-black text-slate-200">
                      {optimizerTimeline.length} entries
                    </p>
                  </div>
                  <div className="space-y-3">
                    {optimizerLogLoading ? (
                      <div className="rounded-[20px] border border-dashed border-white/15 bg-slate-900/35 px-4 py-6 text-sm text-slate-400">
                        Loading optimizer journal...
                      </div>
                    ) : null}
                    {optimizerLogError ? (
                      <div className="rounded-[20px] border border-rose-300/20 bg-rose-500/10 px-4 py-4 text-sm text-rose-200">
                        {optimizerLogError}
                      </div>
                    ) : null}
                    {!optimizerLogLoading && !optimizerLogError && optimizerTimeline.length === 0 ? (
                      <div className="rounded-[20px] border border-dashed border-white/15 bg-slate-900/35 px-4 py-6 text-sm text-slate-400">
                        No optimizer log entries yet.
                      </div>
                    ) : null}
                    {!optimizerLogLoading &&
                      !optimizerLogError &&
                      optimizerTimeline.map((entry) => (
                        <div
                          key={entry.log_id}
                          className="rounded-[20px] border border-white/10 bg-slate-900/55 px-4 py-4"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-[11px] font-black uppercase tracking-[0.14em] text-amber-200">
                                {entry.title}
                              </p>
                              <p className="mt-2 text-sm text-slate-200">{entry.detail}</p>
                            </div>
                            <p className="text-[11px] text-slate-400">
                              {new Date(entry.timestamp).toLocaleString()}
                            </p>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              ) : approvalDetailLoading ? (
                <div className="rounded-[24px] border border-dashed border-white/15 bg-slate-950/30 px-5 py-12 text-sm text-slate-400">
                  Loading pending puzzle detail...
                </div>
              ) : approvalDetailError ? (
                <p className="text-sm text-rose-300">{approvalDetailError}</p>
              ) : approvalDetail ? (
                <div className="space-y-5">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-300">
                        Pending Puzzle Detail
                      </p>
                      <h2 className="mt-2 text-2xl font-black text-white">
                        {approvalDetail.puzzle.title}
                      </h2>
                      <p className="mt-2 text-sm text-slate-300">
                        {formatDateLabel(approvalDetail.puzzle.puzzle_date)} |{" "}
                        {approvalDetail.puzzle.theme_display_name}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-3">
                      <button
                        type="button"
                        onClick={() => void runPendingAction("approve")}
                        disabled={approvalActionLoading}
                        className="rounded-full bg-emerald-300 px-4 py-3 text-xs font-black uppercase tracking-[0.12em] text-slate-950 disabled:opacity-60"
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        onClick={() => void runPendingAction("reject")}
                        disabled={approvalActionLoading}
                        className="rounded-full border border-rose-300/30 bg-rose-300/10 px-4 py-3 text-xs font-black uppercase tracking-[0.12em] text-rose-100 disabled:opacity-60"
                      >
                        Reject And Shift Up
                      </button>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-4">
                    <div className="rounded-[18px] border border-white/10 bg-slate-900/55 px-4 py-3">
                      <p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-400">
                        Link
                      </p>
                      <p className="mt-1 text-sm font-black text-white">
                        {approvalDetail.puzzle.relationship_display_text ?? "No Link"}
                      </p>
                    </div>
                    <div className="rounded-[18px] border border-white/10 bg-slate-900/55 px-4 py-3">
                      <p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-400">
                        Lineup Rules
                      </p>
                      <p className="mt-1 text-sm font-black text-white">
                        {approvalDetail.puzzle.position_overlay_enabled
                          ? "One-Each Lock"
                          : approvalDetail.puzzle.qb_exclusion_enabled
                            ? "No QBs"
                            : "Open"}
                      </p>
                    </div>
                    <div className="rounded-[18px] border border-white/10 bg-slate-900/55 px-4 py-3">
                      <p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-400">
                        Active Links
                      </p>
                      <p className="mt-1 text-sm font-black text-white">
                        {approvalDetail.cached_optimal?.optimal_active_links ?? "N/A"}
                      </p>
                    </div>
                    <div className="rounded-[18px] border border-white/10 bg-slate-900/55 px-4 py-3">
                      <p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-400">
                        Final Score
                      </p>
                      <p className="mt-1 text-sm font-black text-emerald-300">
                        {approvalDetail.cached_optimal?.optimal_final_score != null
                          ? formatNumber(approvalDetail.cached_optimal.optimal_final_score)
                          : "N/A"}
                      </p>
                    </div>
                  </div>

                  <div className="rounded-[22px] border border-white/10 bg-slate-950/35 p-4">
                    <p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-300">
                      Slot Rules
                    </p>
                    <div className="mt-3 space-y-3">
                      {approvalDetail.slots.map((slot) => (
                        <div
                          key={`${slot.slot_number}-${slot.rule_name}`}
                          className="rounded-[18px] border border-white/10 bg-slate-900/55 px-4 py-3"
                        >
                          <p className="text-xs font-black uppercase tracking-[0.12em] text-cyan-200">
                            Slot {slot.slot_number}
                          </p>
                          <p className="mt-1 text-sm font-black text-white">{slot.display_text}</p>
                          <p className="mt-1 text-xs text-slate-300">
                            {slot.parameter_type} | {slot.parameter_value ?? "N/A"}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-[22px] border border-white/10 bg-slate-950/35 p-4">
                    <p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-300">
                      Optimal Lineup
                    </p>
                    {approvalDetail.cached_optimal ? (
                      <div className="mt-3 space-y-3">
                        {approvalDetail.cached_optimal.optimal_lineup.map((entry) => (
                          <div
                            key={`${entry.slot_number}-${entry.player_name}`}
                            className="rounded-[18px] border border-white/10 bg-slate-900/55 px-4 py-3"
                          >
                            <p className="text-xs font-black uppercase tracking-[0.12em] text-cyan-200">
                              Slot {entry.slot_number} | {entry.slot_label}
                            </p>
                            <p className="mt-1 text-sm font-black text-white">
                              {entry.player_name}
                            </p>
                            <p className="mt-1 text-xs text-amber-200">
                              Used {entry.previous_optimal_usage_count}x
                            </p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-3 text-sm text-slate-400">
                        No cached optimal lineup found for this pending puzzle yet.
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="rounded-[24px] border border-dashed border-white/15 bg-slate-950/30 px-5 py-12 text-sm text-slate-400">
                  Pick a pending puzzle from the queue to review it.
                </div>
              )}
            </section>
          </div>
        ) : devTab === "create" ? (
        <div className="grid gap-6 xl:grid-cols-[1.12fr_0.88fr]">
          <section className="rounded-[28px] border border-white/10 bg-white/5 p-5 shadow-[0_24px_80px_rgba(2,6,23,0.45)] backdrop-blur-xl">
            <div className="grid gap-5">
              <label className="block">
                <span className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-300">
                  Puzzle Title
                </span>
                <input
                  value={title}
                  onChange={(event) => {
                    const nextTitle = event.target.value;
                    setTitle(nextTitle);
                    setTitleTouched(nextTitle.trim().length > 0);
                  }}
                  className="mt-2 w-full rounded-[18px] border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500"
                  placeholder="Give this puzzle a title"
                />
              </label>

              <div className="rounded-[24px] border border-cyan-400/20 bg-cyan-400/10 p-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-[0.14em] text-cyan-200">
                      Time Period
                    </p>
                    <p className="mt-2 text-xl font-black text-white">
                      {currentThemeLabel}
                    </p>
                  </div>
                  <div className="text-right text-xs text-cyan-100/80">
                    <p>{startSeason === endSeason ? "Single Year" : "Range"}</p>
                    <p>
                      {endSeason - startSeason + 1} season
                      {endSeason === startSeason ? "" : "s"}
                    </p>
                  </div>
                </div>
                <div className="mt-3 flex justify-end">
                  <LockButton
                    locked={timePeriodLocked}
                    onClick={() => setTimePeriodLocked((current) => !current)}
                  />
                </div>
                <div className="mt-4 rounded-[20px] border border-cyan-300/15 bg-slate-950/30 p-4">
                  <div className="relative h-12">
                    <div className="absolute left-0 right-0 top-1/2 h-2 -translate-y-1/2 rounded-full bg-cyan-100/10" />
                    <div
                      className="absolute top-1/2 h-2 -translate-y-1/2 rounded-full bg-gradient-to-r from-cyan-300 via-sky-300 to-emerald-300 shadow-[0_0_20px_rgba(103,232,249,0.35)]"
                      style={{
                        left: `${rangeStartPercent}%`,
                        width: `${Math.max(rangeEndPercent - rangeStartPercent, 0)}%`,
                      }}
                    />
                    <input
                      type="range"
                      min={MIN_SEASON}
                      max={MAX_SEASON}
                      step={1}
                      value={startSeason}
                      onChange={(event) => {
                        const nextStart = Number(event.target.value);
                        setStartSeason(nextStart);
                        setEndSeason((current) => Math.max(current, nextStart));
                      }}
                      className="dev-range-thumb pointer-events-none absolute inset-0 z-20 h-12 w-full appearance-none bg-transparent"
                      aria-label="Start year"
                    />
                    <input
                      type="range"
                      min={MIN_SEASON}
                      max={MAX_SEASON}
                      step={1}
                      value={endSeason}
                      onChange={(event) => {
                        const nextEnd = Number(event.target.value);
                        setEndSeason(nextEnd);
                        setStartSeason((current) => Math.min(current, nextEnd));
                      }}
                      className="dev-range-thumb pointer-events-none absolute inset-0 z-30 h-12 w-full appearance-none bg-transparent"
                      aria-label="End year"
                    />
                    <div
                      className="pointer-events-none absolute top-1/2 z-10 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-cyan-300 shadow-[0_0_0_4px_rgba(34,211,238,0.16)]"
                      style={{ left: `${rangeStartPercent}%` }}
                    />
                    <div
                      className="pointer-events-none absolute top-1/2 z-10 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-emerald-300 shadow-[0_0_0_4px_rgba(52,211,153,0.16)]"
                      style={{ left: `${rangeEndPercent}%` }}
                    />
                  </div>
                  <div className="mt-3 flex items-center justify-between text-xs text-cyan-100/80">
                    <span>{MIN_SEASON}</span>
                    <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 font-black text-white">
                      {currentThemeLabel}
                    </span>
                    <span>{MAX_SEASON}</span>
                  </div>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-[16px] border border-white/10 bg-slate-950/35 px-3 py-3">
                      <p className="text-[11px] font-black uppercase tracking-[0.14em] text-cyan-100/80">
                        Start Year
                      </p>
                      <p className="mt-1 text-lg font-black text-white">{startSeason}</p>
                    </div>
                    <div className="rounded-[16px] border border-white/10 bg-slate-950/35 px-3 py-3">
                      <p className="text-[11px] font-black uppercase tracking-[0.14em] text-cyan-100/80">
                        End Year
                      </p>
                      <p className="mt-1 text-lg font-black text-white">{endSeason}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-300">
                    Link Type
                  </p>
                  <LockButton
                    locked={linkTypeLocked}
                    onClick={() => setLinkTypeLocked((current) => !current)}
                  />
                </div>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {(meta?.relationships ?? []).map((relationship) => {
                    const active =
                      relationship.relationship_rule_id === relationshipRuleId;
                    return (
                      <button
                        key={relationship.relationship_rule_id}
                        type="button"
                        onClick={() =>
                          setRelationshipRuleId(relationship.relationship_rule_id)
                        }
                        className={`rounded-[20px] border px-4 py-4 text-left transition ${
                          active
                            ? "border-emerald-300 bg-emerald-300/20 shadow-[0_16px_36px_rgba(16,185,129,0.2)]"
                            : "border-white/10 bg-slate-950/40 hover:border-white/20"
                        }`}
                      >
                        <p className="text-sm font-black text-white">
                          {relationship.display_text}
                        </p>
                        <p className="mt-1 text-xs text-slate-300">
                          {relationship.relationship_type}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>

              <label className="flex items-center justify-between rounded-[22px] border border-white/10 bg-slate-950/40 px-4 py-4">
                <div>
                  <p className="text-sm font-black text-white">One-Each Lock</p>
                  <p className="mt-1 text-xs text-slate-300">
                    Require exactly one QB, one RB, one WR, one TE, and one extra RB/WR/TE in any slot.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setPositionOverlayEnabled((current) => {
                      const nextValue = !current;
                      if (nextValue) {
                        setQbExclusionEnabled(false);
                      }
                      return nextValue;
                    })
                  }
                  className={`relative h-8 w-14 rounded-full transition ${
                    positionOverlayEnabled ? "bg-emerald-400" : "bg-slate-700"
                  }`}
                  aria-pressed={positionOverlayEnabled}
                >
                  <span
                    className={`absolute top-1 h-6 w-6 rounded-full bg-white transition ${
                      positionOverlayEnabled ? "left-7" : "left-1"
                    }`}
                  />
                </button>
              </label>

              <label className="flex items-center justify-between rounded-[22px] border border-white/10 bg-slate-950/40 px-4 py-4">
                <div>
                  <p className="text-sm font-black text-white">No QBs Allowed</p>
                  <p className="mt-1 text-xs text-slate-300">
                    Remove quarterbacks from the candidate pool for this specific puzzle.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setQbExclusionEnabled((current) => {
                      const nextValue = !current;
                      if (nextValue) {
                        setPositionOverlayEnabled(false);
                      }
                      return nextValue;
                    })
                  }
                  className={`relative h-8 w-14 rounded-full transition ${
                    qbExclusionEnabled ? "bg-emerald-400" : "bg-slate-700"
                  }`}
                  aria-pressed={qbExclusionEnabled}
                >
                  <span
                    className={`absolute top-1 h-6 w-6 rounded-full bg-white transition ${
                      qbExclusionEnabled ? "left-7" : "left-1"
                    }`}
                  />
                </button>
              </label>

              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-300">
                  Slot Parameters
                </p>
                <div className="mt-3 grid gap-4 md:grid-cols-2 xl:grid-cols-1">
                  {slotRuleIds.map((slotRuleId, index) => (
                    <div
                      key={`slot-${index + 1}`}
                      className="rounded-[22px] border border-white/10 bg-slate-950/40 p-4"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-black text-white">
                          Slot {index + 1}
                        </p>
                        <LockButton
                          locked={slotLocks[index] ?? false}
                          onClick={() =>
                            setSlotLocks((current) =>
                              current.map((value, lockIndex) =>
                                lockIndex === index ? !value : value
                              )
                            )
                          }
                        />
                      </div>
                      <select
                        value={slotRuleId}
                        onChange={(event) => {
                          const next = [...slotRuleIds];
                          next[index] = event.target.value;
                          setSlotRuleIds(next);
                        }}
                        className="mt-3 w-full rounded-[16px] border border-white/10 bg-slate-900 px-3 py-3 text-sm text-white outline-none"
                      >
                        <option value="">Choose a slot rule</option>
                        {groupedSlotRules.map(([group, items]) => (
                          <optgroup key={group} label={group.toUpperCase()}>
                            {items.map((rule) => (
                              <option
                                key={rule.slot_rule_id}
                                value={rule.slot_rule_id}
                              >
                                {rule.display_text}
                              </option>
                            ))}
                          </optgroup>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          </section>

          <div className="grid content-start gap-6 self-start">
            <section className="relative z-20 overflow-visible rounded-[24px] border border-white/10 bg-white/5 p-4 shadow-[0_18px_48px_rgba(2,6,23,0.35)] backdrop-blur-xl">
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={handleRandomizeSlots}
                  disabled={metaLoading || autoBuildLoading || !(meta?.slotRules?.length)}
                  className="rounded-full border border-fuchsia-300/35 bg-fuchsia-300/12 px-5 py-3 text-sm font-black text-fuchsia-100 transition disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Randomize Slots
                </button>
                <button
                  type="button"
                  onClick={() => void handleGenerate()}
                  disabled={metaLoading || previewLoading || autoBuildLoading}
                  className="rounded-full bg-cyan-300 px-5 py-3 text-sm font-black text-slate-950 transition disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {previewLoading ? "Generating..." : "Generate Optimal Lineup"}
                </button>
                <button
                  type="button"
                  onClick={() => void handleAutoBuild()}
                  disabled={metaLoading || previewLoading || autoBuildLoading}
                  className="rounded-full border border-amber-300/35 bg-amber-300/12 px-5 py-3 text-sm font-black text-amber-100 transition disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {autoBuildLoading ? "Auto Building..." : "Find Viable Puzzle"}
                </button>
                {autoBuildLoading ? (
                  <button
                    type="button"
                    onClick={() => {
                      autoBuildStopRequestedRef.current = true;
                      setAutoBuildMessage("Stopping search...");
                    }}
                    className="rounded-full border border-rose-300/35 bg-rose-300/12 px-5 py-3 text-sm font-black text-rose-100 transition"
                  >
                    Stop
                  </button>
                ) : null}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => {
                      if (saveConfirmOpen) {
                        void handleSave();
                        return;
                      }
                      setSaveConfirmOpen(true);
                    }}
                    disabled={saveLoading || previewLoading || autoBuildLoading}
                    className="rounded-full border border-emerald-300/40 bg-emerald-300/15 px-5 py-3 text-sm font-black text-emerald-100 transition disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {saveLoading
                      ? "Saving..."
                      : saveConfirmOpen
                        ? "Click Again To Confirm"
                        : "Save To Next Open Day"}
                  </button>
                  {saveConfirmOpen ? (
                    <div className="absolute bottom-[calc(100%+0.5rem)] right-0 z-30 w-64 rounded-[18px] border border-emerald-300/25 bg-slate-950/95 p-3 text-xs text-emerald-100 shadow-[0_18px_40px_rgba(2,6,23,0.45)] backdrop-blur-xl">
                      <p className="font-black uppercase tracking-[0.12em] text-emerald-200">
                        Confirm Save
                      </p>
                      <p className="mt-2 text-slate-200">
                        Save this puzzle to the next open day?
                      </p>
                      <div className="mt-3 flex gap-2">
                        <button
                          type="button"
                          onClick={() => void handleSave()}
                          className="rounded-full bg-emerald-300 px-3 py-2 font-black text-slate-950"
                        >
                          Yes, Save
                        </button>
                        <button
                          type="button"
                          onClick={() => setSaveConfirmOpen(false)}
                          className="rounded-full border border-white/15 px-3 py-2 font-black text-slate-200"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="mt-3 grid gap-2">
                {metaError ? <p className="text-sm text-rose-300">{metaError}</p> : null}
                {previewError ? <p className="text-sm text-rose-300">{previewError}</p> : null}
                {saveError ? <p className="text-sm text-rose-300">{saveError}</p> : null}
                {saveMessage ? <p className="text-sm text-emerald-300">{saveMessage}</p> : null}
                {autoBuildMessage ? (
                  <p className="text-sm text-amber-200">{autoBuildMessage}</p>
                ) : null}
              </div>
            </section>

            <section className="rounded-[28px] border border-white/10 bg-white/5 p-5 shadow-[0_24px_80px_rgba(2,6,23,0.45)] backdrop-blur-xl">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-300">
                  Preview
                </p>
                <h2 className="mt-2 text-2xl font-black text-white">
                  {preview?.theme.display_name ?? "Build a puzzle"}
                </h2>
              </div>
              {preview ? (
                <div className="rounded-[20px] border border-white/10 bg-slate-950/40 px-4 py-3 text-right">
                  <p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-400">
                    Final Score
                  </p>
                  <p className="mt-1 text-xl font-black text-emerald-300">
                    {formatNumber(preview.optimal_final_score)}
                  </p>
                </div>
              ) : null}
            </div>

            {preview ? (
              <div className="mt-5 space-y-4">
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-[20px] border border-white/10 bg-slate-950/40 px-4 py-3">
                    <p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-400">
                      Link
                    </p>
                    <p className="mt-1 font-black text-white">
                      {preview.relationship_rule.display_text}
                    </p>
                  </div>
                  <div className="rounded-[20px] border border-white/10 bg-slate-950/40 px-4 py-3">
                    <p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-400">
                      Active Links
                    </p>
                    <p className="mt-1 font-black text-white">
                      {preview.optimal_active_links}
                    </p>
                  </div>
                    <div className="rounded-[20px] border border-white/10 bg-slate-950/40 px-4 py-3">
                      <p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-400">
                      Lineup Rules
                      </p>
                      <p className="mt-1 font-black text-white">
                      {preview.position_overlay_enabled
                        ? "One-Each Lock"
                        : preview.qb_exclusion_enabled
                          ? "No QBs"
                          : "Open"}
                      </p>
                    </div>
                </div>

                <div className="space-y-3">
                  {preview.optimal_lineup.map((entry) => (
                    <div
                      key={`${entry.slot_number}-${entry.player.player_id}`}
                      className="rounded-[22px] border border-white/10 bg-slate-950/45 p-4"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-[11px] font-black uppercase tracking-[0.14em] text-cyan-200">
                            Slot {entry.slot_number} • {entry.slot_rule.display_text}
                          </p>
                          <p className="mt-2 text-lg font-black text-white">
                            {entry.player.player_name}
                          </p>
                          <p className="mt-1 text-sm text-slate-300">
                            {entry.player.primary_position ?? "N/A"} •{" "}
                            {entry.player.theme_start_season ?? "?"}-
                            {entry.player.theme_end_season ?? "?"}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="rounded-full border border-amber-300/30 bg-amber-300/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.12em] text-amber-200">
                            Used {entry.previous_optimal_usage_count}x
                          </p>
                          <p className="mt-3 text-sm font-black text-emerald-300">
                            {formatNumber(Number(entry.player.fantasy_points ?? 0))}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="mt-5 rounded-[24px] border border-dashed border-white/15 bg-slate-950/30 px-5 py-10 text-sm text-slate-400">
                Generate a preview to inspect the optimal lineup and see how often
                each answer has already been used.
              </div>
            )}
            </section>

            <section className="rounded-[24px] border border-white/10 bg-slate-950/35 p-4 shadow-[0_18px_48px_rgba(2,6,23,0.28)] backdrop-blur-xl">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-300">
                    Auto-Build Filters
                  </p>
                  <p className="mt-2 text-sm text-slate-300">
                    Tune the viability thresholds the search uses while it looks for a
                    puzzle worth keeping.
                  </p>
                </div>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <label className="rounded-[18px] border border-white/10 bg-slate-900/65 px-4 py-3">
                  <span className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-300">
                    Auto Usage Threshold
                  </span>
                  <div className="mt-2 flex items-center gap-3">
                    <input
                      type="number"
                      min={0}
                      step={1}
                      value={autoBuildUsageThreshold}
                      onChange={(event) =>
                        setAutoBuildUsageThreshold(
                          Math.max(0, Number(event.target.value) || 0)
                        )
                      }
                      className="w-24 rounded-[14px] border border-white/10 bg-slate-950 px-3 py-2 text-sm font-black text-white outline-none"
                    />
                    <p className="text-xs text-slate-300">
                      Auto-build keeps puzzles where total `Used X` is below this.
                    </p>
                  </div>
                </label>
                <label className="rounded-[18px] border border-white/10 bg-slate-900/65 px-4 py-3">
                  <span className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-300">
                    Min Active Links
                  </span>
                  <div className="mt-2 flex items-center gap-3">
                    <input
                      type="number"
                      min={0}
                      max={10}
                      step={1}
                      value={autoBuildMinActiveLinks}
                      onChange={(event) =>
                        setAutoBuildMinActiveLinks(
                          Math.max(0, Math.min(10, Number(event.target.value) || 0))
                        )
                      }
                      className="w-24 rounded-[14px] border border-white/10 bg-slate-950 px-3 py-2 text-sm font-black text-white outline-none"
                    />
                    <p className="text-xs text-slate-300">
                      Require at least this many active links in the optimal lineup.
                    </p>
                  </div>
                </label>
                <label className="rounded-[18px] border border-white/10 bg-slate-900/65 px-4 py-3">
                  <span className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-300">
                    Max QBs In Lineup
                  </span>
                  <div className="mt-2 flex items-center gap-3">
                    <input
                      type="number"
                      min={0}
                      max={5}
                      step={1}
                      value={autoBuildMaxQbs}
                      onChange={(event) =>
                        setAutoBuildMaxQbs(
                          Math.max(0, Math.min(5, Number(event.target.value) || 0))
                        )
                      }
                      className="w-24 rounded-[14px] border border-white/10 bg-slate-950 px-3 py-2 text-sm font-black text-white outline-none"
                    />
                    <p className="text-xs text-slate-300">
                      Reject any viable puzzle with more quarterbacks than this.
                    </p>
                  </div>
                </label>
                <label className="rounded-[18px] border border-white/10 bg-slate-900/65 px-4 py-3">
                  <span className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-300">
                    Min Fantasy Points Per Season
                  </span>
                  <div className="mt-2 flex items-center gap-3">
                    <input
                      type="number"
                      min={0}
                      step={5}
                      value={autoBuildMinFantasyPointsPerSeason}
                      onChange={(event) =>
                        setAutoBuildMinFantasyPointsPerSeason(
                          Math.max(0, Number(event.target.value) || 0)
                        )
                      }
                      className="w-24 rounded-[14px] border border-white/10 bg-slate-950 px-3 py-2 text-sm font-black text-white outline-none"
                    />
                    <p className="text-xs text-slate-300">
                      Each optimal player must clear this per-season points floor.
                    </p>
                  </div>
                </label>
                <label className="rounded-[18px] border border-white/10 bg-slate-900/65 px-4 py-3 sm:col-span-2">
                  <span className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-300">
                    Max Attempts
                  </span>
                  <div className="mt-2 flex items-center gap-3">
                    <input
                      type="number"
                      min={1}
                      step={1}
                      value={autoBuildMaxAttempts}
                      onChange={(event) =>
                        setAutoBuildMaxAttempts(
                          Math.max(1, Number(event.target.value) || 1)
                        )
                      }
                      className="w-24 rounded-[14px] border border-white/10 bg-slate-950 px-3 py-2 text-sm font-black text-white outline-none"
                    />
                    <p className="text-xs text-slate-300">
                      Limit how many auto-build tries run before giving up.
                    </p>
                  </div>
                </label>
              </div>
            </section>
          </div>
        </div>
        ) : devTab === "inspector" ? (
          <div className="grid gap-6 xl:grid-cols-[0.78fr_1.22fr]">
            <section className="rounded-[28px] border border-white/10 bg-white/5 p-5 shadow-[0_24px_80px_rgba(2,6,23,0.45)] backdrop-blur-xl">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.14em] text-violet-200">
                  Submission Inspector
                </p>
                <h2 className="mt-2 text-2xl font-black text-white">Troubleshoot A Report</h2>
                <p className="mt-2 text-sm text-slate-300">
                  Load a saved lineup by exact username and puzzle date, then inspect the stored scores, current derived player data, and every pair-link flag.
                </p>
              </div>

              <div className="mt-5 space-y-4">
                <label className="block">
                  <span className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-300">
                    Exact Username
                  </span>
                  <input
                    value={inspectorUsername}
                    onChange={(event) => setInspectorUsername(event.target.value)}
                    placeholder="tester_username"
                    className="mt-2 w-full rounded-[18px] border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500"
                  />
                </label>
                <label className="block">
                  <span className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-300">
                    Puzzle Date
                  </span>
                  <input
                    type="date"
                    value={inspectorDate}
                    onChange={(event) => setInspectorDate(event.target.value)}
                    className="mt-2 w-full rounded-[18px] border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-white outline-none"
                  />
                </label>
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-300">
                    Submission Mode
                  </p>
                  <div className="mt-3 flex gap-2 rounded-full border border-white/10 bg-slate-950/35 p-1">
                    <button
                      type="button"
                      onClick={() => setInspectorMode("production")}
                      className={`rounded-full px-4 py-2 text-xs font-black uppercase tracking-[0.12em] transition ${
                        inspectorMode === "production"
                          ? "bg-cyan-300 text-slate-950"
                          : "text-slate-300"
                      }`}
                    >
                      Production
                    </button>
                    <button
                      type="button"
                      onClick={() => setInspectorMode("testing")}
                      className={`rounded-full px-4 py-2 text-xs font-black uppercase tracking-[0.12em] transition ${
                        inspectorMode === "testing"
                          ? "bg-violet-300 text-slate-950"
                          : "text-slate-300"
                      }`}
                    >
                      Testing
                    </button>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => void handleInspectSubmission()}
                  disabled={inspectorLoading}
                  className="rounded-full bg-violet-300 px-5 py-3 text-sm font-black text-slate-950 disabled:opacity-60"
                >
                  {inspectorLoading ? "Loading..." : "Inspect Submission"}
                </button>
                {inspectorError ? <p className="text-sm text-rose-300">{inspectorError}</p> : null}
              </div>
            </section>

            <section className="rounded-[28px] border border-white/10 bg-white/5 p-5 shadow-[0_24px_80px_rgba(2,6,23,0.45)] backdrop-blur-xl">
              {!inspectorResult ? (
                <div className="rounded-[24px] border border-dashed border-white/15 bg-slate-950/30 px-5 py-12 text-sm text-slate-400">
                  Load a submission to inspect the lineup, score breakdown, and all link/debug data.
                </div>
              ) : (
                <div className="space-y-5">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-300">
                        Loaded Submission
                      </p>
                      <h2 className="mt-2 text-2xl font-black text-white">
                        {inspectorResult.lookup.username} • {formatDateLabel(inspectorResult.lookup.date)}
                      </h2>
                      <p className="mt-2 text-sm text-slate-300">
                        {inspectorResult.puzzle.title} | {inspectorResult.puzzle.theme_display_name} | {inspectorResult.lookup.mode}
                      </p>
                    </div>
                    <div className="rounded-[20px] border border-white/10 bg-slate-950/35 px-4 py-3 text-right text-xs text-slate-300">
                      <p>Submitted {new Date(inspectorResult.submission.submitted_at).toLocaleString()}</p>
                      <p className="mt-1">Rule: {inspectorResult.puzzle.relationship_rule.display_text}</p>
                    </div>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <div className="rounded-[18px] border border-white/10 bg-slate-900/55 px-4 py-3">
                      <p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-400">
                        Stored Final
                      </p>
                      <p className="mt-1 text-lg font-black text-white">
                        {formatNumber(inspectorResult.submission.stored_final_score)}
                      </p>
                    </div>
                    <div className="rounded-[18px] border border-white/10 bg-slate-900/55 px-4 py-3">
                      <p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-400">
                        Recomputed Final
                      </p>
                      <p className="mt-1 text-lg font-black text-emerald-300">
                        {formatNumber(inspectorResult.submission.recomputed_final_score)}
                      </p>
                    </div>
                    <div className="rounded-[18px] border border-white/10 bg-slate-900/55 px-4 py-3">
                      <p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-400">
                        Stored Links
                      </p>
                      <p className="mt-1 text-lg font-black text-white">
                        {inspectorResult.submission.stored_active_links}
                      </p>
                    </div>
                    <div className="rounded-[18px] border border-white/10 bg-slate-900/55 px-4 py-3">
                      <p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-400">
                        Recomputed Links
                      </p>
                      <p className="mt-1 text-lg font-black text-emerald-300">
                        {inspectorResult.submission.recomputed_active_links}
                      </p>
                    </div>
                  </div>

                  <div className="rounded-[22px] border border-white/10 bg-slate-950/35 p-4">
                    <p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-300">
                      Lineup Debug
                    </p>
                    <div className="mt-3 space-y-3">
                      {inspectorResult.lineup.map((entry) => (
                        <div
                          key={`${entry.slot_number}-${entry.player.player_id}`}
                          className="rounded-[18px] border border-white/10 bg-slate-900/55 px-4 py-4"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-4">
                            <div>
                              <p className="text-xs font-black uppercase tracking-[0.12em] text-cyan-200">
                                Slot {entry.slot_number} | {entry.slot_rule.display_text}
                              </p>
                              <p className="mt-2 text-lg font-black text-white">
                                {entry.player.player_name}
                              </p>
                              <p className="mt-1 text-sm text-slate-300">
                                {entry.player.primary_position ?? "N/A"} | Theme {entry.player.theme_start_season ?? "?"}-{entry.player.theme_end_season ?? "?"}
                              </p>
                            </div>
                            <div className="text-right text-xs text-slate-300">
                              <p>Stored points: {formatNumber(entry.submitted_fantasy_points)}</p>
                              <p className="mt-1">Current points: {formatNumber(entry.player.fantasy_points)}</p>
                              <p className={`mt-2 font-black ${entry.slot_match ? "text-emerald-300" : "text-rose-300"}`}>
                                Slot rule: {entry.slot_match ? "Pass" : "Fail"}
                              </p>
                              <p className={`mt-1 font-black ${entry.lineup_rule_match ? "text-emerald-300" : "text-rose-300"}`}>
                                Lineup rule: {entry.lineup_rule_match ? "Pass" : "Fail"}
                              </p>
                            </div>
                          </div>
                          <div className="mt-3 grid gap-2 md:grid-cols-3 text-xs text-slate-300">
                            <div>Teams: {entry.player.theme_team_abbrs.join(", ") || "N/A"}</div>
                            <div>Colleges: {entry.player.player_colleges.join(", ") || "N/A"}</div>
                            <div>
                              Draft: {entry.player.undrafted_flag ? "Undrafted" : entry.player.draft_round ? `Round ${entry.player.draft_round}, ${entry.player.draft_year ?? "?"}` : "N/A"}
                            </div>
                            <div>SB wins: {entry.player.super_bowl_win_count ?? 0}</div>
                            <div>Career: {entry.player.career_start_season ?? "?"}-{entry.player.career_end_season ?? "?"}</div>
                            <div>Player ID: {entry.player.player_id}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-[22px] border border-white/10 bg-slate-950/35 p-4">
                    <p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-300">
                      Pair Link Debug
                    </p>
                    <div className="mt-3 space-y-3">
                      {inspectorResult.pair_debug.map((pair) => (
                        <div
                          key={`${pair.player_id_1}-${pair.player_id_2}`}
                          className="rounded-[18px] border border-white/10 bg-slate-900/55 px-4 py-4"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-4">
                            <div>
                              <p className="text-sm font-black text-white">
                                {pair.player_name_1} + {pair.player_name_2}
                              </p>
                              <p className="mt-1 text-xs text-slate-400">
                                Puzzle link: {inspectorResult.puzzle.relationship_rule.display_text}
                              </p>
                            </div>
                            <p className={`rounded-full px-3 py-1 text-xs font-black uppercase tracking-[0.12em] ${
                              pair.active_for_puzzle
                                ? "bg-emerald-300 text-slate-950"
                                : "border border-white/10 bg-slate-950/35 text-slate-300"
                            }`}>
                              {pair.active_for_puzzle ? "Active Link" : "Inactive"}
                            </p>
                          </div>
                          <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3 text-xs text-slate-300">
                            <div>Teammates: {pair.flags?.were_teammates_flag ? "Yes" : "No"}</div>
                            <div>Same franchise: {pair.flags?.same_franchise_flag ? "Yes" : "No"}</div>
                            <div>Same college: {pair.flags?.same_college_flag ? "Yes" : "No"}</div>
                            <div>Same draft class: {pair.flags?.same_draft_class_flag ? "Yes" : "No"}</div>
                            <div>Same draft round: {pair.flags?.same_draft_round_flag ? "Yes" : "No"}</div>
                            <div>Both undrafted: {pair.flags?.both_undrafted_flag ? "Yes" : "No"}</div>
                            <div>Both non-1st: {pair.flags?.both_non_first_round_pick_flag ? "Yes" : "No"}</div>
                            <div>Both day 3: {pair.flags?.both_day_3_pick_flag ? "Yes" : "No"}</div>
                            <div>Both SB winners: {pair.flags?.both_super_bowl_winner_flag ? "Yes" : "No"}</div>
                            <div>Both non-SB winners: {pair.flags?.both_non_super_bowl_winner_flag ? "Yes" : "No"}</div>
                            <div>Both played Packers: {pair.flags?.both_played_packers_flag ? "Yes" : "No"}</div>
                            <div>Same position: {pair.flags?.same_position_flag ? "Yes" : "No"}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </section>
          </div>
        ) : devTab === "schedule" ? (
          <div className="grid gap-6 xl:grid-cols-[0.88fr_1.12fr]">
            <section className="rounded-[28px] border border-white/10 bg-white/5 p-5 shadow-[0_24px_80px_rgba(2,6,23,0.45)] backdrop-blur-xl">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-300">
                    Confirmed Schedule
                  </p>
                  <h2 className="mt-2 text-2xl font-black text-white">
                    Confirmed NFL Puzzles
                  </h2>
                </div>
                <p className="rounded-full border border-white/10 bg-slate-950/35 px-3 py-2 text-xs font-black text-slate-200">
                  {filteredConfirmedPuzzleList.length} shown
                </p>
              </div>

              <div className="mt-5 flex items-center gap-2 rounded-full border border-white/10 bg-slate-950/25 p-1">
                <button
                  type="button"
                  onClick={() => setPuzzleScope("future")}
                  className={`rounded-full px-4 py-2 text-xs font-black uppercase tracking-[0.12em] transition ${
                    puzzleScope === "future"
                      ? "bg-cyan-300 text-slate-950"
                      : "text-slate-300"
                  }`}
                >
                  Future
                </button>
                <button
                  type="button"
                  onClick={() => setPuzzleScope("past")}
                  className={`rounded-full px-4 py-2 text-xs font-black uppercase tracking-[0.12em] transition ${
                    puzzleScope === "past"
                      ? "bg-amber-300 text-slate-950"
                      : "text-slate-300"
                  }`}
                >
                  Past
                </button>
              </div>

              <div className="mt-5 space-y-3">
                {puzzleListLoading ? (
                  <div className="rounded-[22px] border border-dashed border-white/15 bg-slate-950/30 px-4 py-8 text-sm text-slate-400">
                    Loading puzzles...
                  </div>
                ) : null}
                {puzzleListError ? (
                  <p className="text-sm text-rose-300">{puzzleListError}</p>
                ) : null}
                {!puzzleListLoading &&
                  !puzzleListError &&
                  filteredConfirmedPuzzleList.map((puzzle) => {
                    const active = selectedPuzzleId === puzzle.puzzle_id;
                    return (
                      <button
                        key={puzzle.puzzle_id}
                        type="button"
                        onClick={() => setSelectedPuzzleId(puzzle.puzzle_id)}
                        className={`w-full rounded-[22px] border p-4 text-left transition ${
                          active
                            ? "border-cyan-300 bg-cyan-300/12 shadow-[0_14px_30px_rgba(34,211,238,0.15)]"
                            : "border-white/10 bg-slate-950/35 hover:border-white/20"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-[11px] font-black uppercase tracking-[0.14em] text-cyan-200">
                              {formatDateLabel(puzzle.puzzle_date)}
                            </p>
                            <p className="mt-2 text-sm font-black text-white">
                              {puzzle.title}
                            </p>
                            <p className="mt-1 text-xs text-slate-300">
                              {puzzle.theme_display_name}
                            </p>
                          </div>
                          <div className="text-right text-xs text-slate-300">
                            <p>{puzzle.relationship_display_text ?? "No Link"}</p>
                            <p className="mt-1">
                              {puzzle.position_overlay_enabled
                                ? "One-Each"
                                : puzzle.qb_exclusion_enabled
                                  ? "No QBs"
                                  : "Open"}
                            </p>
                            <p className="mt-1">
                              {puzzle.future_editable ? "Editable" : "Locked"}
                            </p>
                          </div>
                        </div>
                      </button>
                    );
                  })}
              </div>
            </section>

            <section className="rounded-[28px] border border-white/10 bg-white/5 p-5 shadow-[0_24px_80px_rgba(2,6,23,0.45)] backdrop-blur-xl">
              {puzzleDetailLoading ? (
                <div className="rounded-[24px] border border-dashed border-white/15 bg-slate-950/30 px-5 py-12 text-sm text-slate-400">
                  Loading puzzle detail...
                </div>
              ) : puzzleDetailError ? (
                <p className="text-sm text-rose-300">{puzzleDetailError}</p>
              ) : puzzleDetail ? (
                <div className="space-y-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-300">
                        Puzzle Detail
                      </p>
                      <h2 className="mt-2 text-2xl font-black text-white">
                        {puzzleDetail.puzzle.title}
                      </h2>
                      <p className="mt-2 text-sm text-slate-300">
                        {formatDateLabel(puzzleDetail.puzzle.puzzle_date)} |{" "}
                        {puzzleDetail.puzzle.theme_display_name}
                      </p>
                    </div>
                    <div className="rounded-[20px] border border-white/10 bg-slate-950/35 px-4 py-3 text-right text-xs text-slate-300">
                      <p>{puzzleDetail.puzzle.relationship_display_text ?? "No Link"}</p>
                      <p className="mt-1">
                        {puzzleDetail.puzzle.position_overlay_enabled
                          ? "One-Each Lock On"
                          : puzzleDetail.puzzle.qb_exclusion_enabled
                            ? "No QBs On"
                            : "Open Slots"}
                      </p>
                      <p className="mt-1">
                        {puzzleDetail.puzzle.future_editable ? "Future Editable" : "Read Only"}
                      </p>
                    </div>
                  </div>

                  {puzzleDetail.puzzle.future_editable ? (
                    <div className="grid gap-4 lg:grid-cols-2">
                      <div className="rounded-[22px] border border-cyan-300/20 bg-cyan-300/10 p-4">
                        <p className="text-[11px] font-black uppercase tracking-[0.14em] text-cyan-200">
                          Swap Node Positions
                        </p>
                        <p className="mt-2 text-sm text-cyan-100/80">
                          Keep the same parameters, just swap which slot they sit in.
                        </p>
                        <div className="mt-4 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                          <select
                            value={swapSlotA}
                            onChange={(event) => setSwapSlotA(Number(event.target.value))}
                            className="rounded-[14px] border border-white/10 bg-slate-900 px-3 py-2 text-sm font-black text-white outline-none"
                          >
                            {puzzleDetail.slots.map((slot) => (
                              <option key={`a-${slot.slot_number}`} value={slot.slot_number}>
                                Slot {slot.slot_number}
                              </option>
                            ))}
                          </select>
                          <span className="text-xs font-black uppercase tracking-[0.12em] text-cyan-100/70">
                            With
                          </span>
                          <select
                            value={swapSlotB}
                            onChange={(event) => setSwapSlotB(Number(event.target.value))}
                            className="rounded-[14px] border border-white/10 bg-slate-900 px-3 py-2 text-sm font-black text-white outline-none"
                          >
                            {puzzleDetail.slots.map((slot) => (
                              <option key={`b-${slot.slot_number}`} value={slot.slot_number}>
                                Slot {slot.slot_number}
                              </option>
                            ))}
                          </select>
                        </div>
                        <button
                          type="button"
                          onClick={() => void runPuzzleAction("swap")}
                          disabled={puzzleActionLoading || swapSlotA === swapSlotB}
                          className="mt-4 rounded-full bg-cyan-300 px-4 py-3 text-xs font-black uppercase tracking-[0.12em] text-slate-950 disabled:opacity-60"
                        >
                          Swap Slots
                        </button>
                      </div>

                      <div className="rounded-[22px] border border-emerald-300/20 bg-emerald-300/10 p-4">
                        <p className="text-[11px] font-black uppercase tracking-[0.14em] text-emerald-200">
                          Reorder Date
                        </p>
                        <p className="mt-2 text-sm text-emerald-100/80">
                          Move this future puzzle earlier or later in the schedule by one step.
                        </p>
                        <div className="mt-4 flex flex-wrap gap-3">
                          <button
                            type="button"
                            onClick={() => void runPuzzleAction("earlier")}
                            disabled={puzzleActionLoading}
                            className="rounded-full border border-white/15 bg-slate-950/40 px-4 py-3 text-xs font-black uppercase tracking-[0.12em] text-white disabled:opacity-60"
                          >
                            Move Earlier
                          </button>
                          <button
                            type="button"
                            onClick={() => void runPuzzleAction("later")}
                            disabled={puzzleActionLoading}
                            className="rounded-full bg-emerald-300 px-4 py-3 text-xs font-black uppercase tracking-[0.12em] text-slate-950 disabled:opacity-60"
                          >
                            Move Later
                          </button>
                        </div>
                      </div>

                      <div className="rounded-[22px] border border-rose-300/20 bg-rose-300/10 p-4 lg:col-span-2">
                        <p className="text-[11px] font-black uppercase tracking-[0.14em] text-rose-200">
                          Delete Puzzle
                        </p>
                        <p className="mt-2 text-sm text-rose-100/80">
                          Remove this future puzzle and shift every later scheduled puzzle up one day so the calendar gap is filled automatically.
                        </p>
                        <button
                          type="button"
                          onClick={() => void runPuzzleAction("delete")}
                          disabled={puzzleActionLoading}
                          className="mt-4 rounded-full bg-rose-300 px-4 py-3 text-xs font-black uppercase tracking-[0.12em] text-slate-950 disabled:opacity-60"
                        >
                          Delete And Close Gap
                        </button>
                      </div>
                    </div>
                  ) : null}

                  {puzzleActionError ? (
                    <p className="text-sm text-rose-300">{puzzleActionError}</p>
                  ) : null}
                  {puzzleActionMessage ? (
                    <p className="text-sm text-emerald-300">{puzzleActionMessage}</p>
                  ) : null}

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-[20px] border border-white/10 bg-slate-950/35 px-4 py-3">
                      <p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-400">
                        Theme Rule
                      </p>
                      <p className="mt-1 text-sm font-black text-white">
                        {puzzleDetail.puzzle.theme_rule_logic_key}
                      </p>
                    </div>
                    <div className="rounded-[20px] border border-white/10 bg-slate-950/35 px-4 py-3">
                      <p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-400">
                        Created
                      </p>
                      <p className="mt-1 text-sm font-black text-white">
                        {new Date(puzzleDetail.puzzle.created_at).toLocaleString()}
                      </p>
                    </div>
                    <div className="rounded-[20px] border border-white/10 bg-slate-950/35 px-4 py-3">
                      <p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-400">
                        Submission Count
                      </p>
                      <p className="mt-1 text-sm font-black text-white">
                        {puzzleDetail.submissions.submission_count}
                      </p>
                    </div>
                  </div>

                  <div className="rounded-[22px] border border-white/10 bg-slate-950/35 p-4">
                    <p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-300">
                      Slot Rules
                    </p>
                    <div className="mt-3 space-y-3">
                      {puzzleDetail.slots.map((slot) => (
                        <div
                          key={`${slot.slot_number}-${slot.rule_name}`}
                          className="rounded-[18px] border border-white/10 bg-slate-900/55 px-4 py-3"
                        >
                          <p className="text-xs font-black uppercase tracking-[0.12em] text-cyan-200">
                            Slot {slot.slot_number}
                          </p>
                          <p className="mt-1 text-sm font-black text-white">
                            {slot.display_text}
                          </p>
                          <p className="mt-1 text-xs text-slate-300">
                            {slot.parameter_type} | {slot.parameter_value ?? "N/A"}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-[22px] border border-white/10 bg-slate-950/35 p-4">
                    <p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-300">
                      Submitters
                    </p>
                    {puzzleDetail.submissions.entries.length > 0 ? (
                      <div className="mt-3 space-y-3">
                        {puzzleDetail.submissions.entries.map((entry) => (
                          <div
                            key={entry.submission_id}
                            className="rounded-[18px] border border-white/10 bg-slate-900/55 px-4 py-3"
                          >
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div>
                                <p className="text-sm font-black text-white">
                                  {entry.display_name}
                                </p>
                                <p className="mt-1 text-xs text-slate-300">
                                  {entry.username
                                    ? `@${entry.username}`
                                    : "Guest / browser submission"}
                                </p>
                              </div>
                              <div className="text-right text-xs text-slate-300">
                                <p>{new Date(entry.submitted_at).toLocaleString()}</p>
                                <p className="mt-1 font-black text-emerald-300">
                                  {formatNumber(entry.final_score)}
                                </p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-3 text-sm text-slate-400">
                        No submissions have been recorded for this puzzle date.
                      </p>
                    )}
                  </div>

                  <div className="rounded-[22px] border border-white/10 bg-slate-950/35 p-4">
                    <p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-300">
                      Cached Optimal
                    </p>
                    {puzzleDetail.cached_optimal ? (
                      <div className="mt-3 space-y-3">
                        <div className="grid gap-3 sm:grid-cols-3">
                          <div className="rounded-[18px] border border-white/10 bg-slate-900/55 px-4 py-3">
                            <p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-400">
                              Active Links
                            </p>
                            <p className="mt-1 text-lg font-black text-white">
                              {puzzleDetail.cached_optimal.optimal_active_links ?? "N/A"}
                            </p>
                          </div>
                          <div className="rounded-[18px] border border-white/10 bg-slate-900/55 px-4 py-3">
                            <p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-400">
                              Final Score
                            </p>
                            <p className="mt-1 text-lg font-black text-emerald-300">
                              {puzzleDetail.cached_optimal.optimal_final_score != null
                                ? formatNumber(puzzleDetail.cached_optimal.optimal_final_score)
                                : "N/A"}
                            </p>
                          </div>
                          <div className="rounded-[18px] border border-white/10 bg-slate-900/55 px-4 py-3">
                            <p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-400">
                              Computed
                            </p>
                            <p className="mt-1 text-sm font-black text-white">
                              {new Date(
                                puzzleDetail.cached_optimal.computed_at
                              ).toLocaleString()}
                            </p>
                          </div>
                        </div>
                        <div className="space-y-3">
                          {puzzleDetail.cached_optimal.optimal_lineup.map((entry) => (
                            <div
                              key={`${entry.slot_number}-${entry.player_name}`}
                              className="rounded-[18px] border border-white/10 bg-slate-900/55 px-4 py-3"
                            >
                              <p className="text-xs font-black uppercase tracking-[0.12em] text-cyan-200">
                                Slot {entry.slot_number} | {entry.slot_label}
                              </p>
                              <p className="mt-1 text-sm font-black text-white">
                                {entry.player_name}
                              </p>
                              <p className="mt-1 text-xs text-amber-200">
                                Used {entry.previous_optimal_usage_count}x
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <p className="mt-3 text-sm text-slate-400">
                        No cached optimal lineup found for this puzzle yet.
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="rounded-[24px] border border-dashed border-white/15 bg-slate-950/30 px-5 py-12 text-sm text-slate-400">
                  Pick a puzzle from the table to inspect its details.
                </div>
              )}
            </section>
          </div>
        ) : null}
      </div>

      {optimizerHowItWorksOpen && (
        <div className="fixed inset-0 z-[130] overflow-y-auto bg-slate-950/55 px-4 py-6">
          <div className="flex min-h-full items-start justify-center">
            <div className="w-full max-w-3xl rounded-[30px] border border-amber-300/25 bg-[linear-gradient(180deg,rgba(15,23,42,0.98)_0%,rgba(2,6,23,0.98)_100%)] p-5 shadow-[0_24px_80px_rgba(2,6,23,0.55)] md:p-6">
              <div className="sticky top-0 z-10 -mx-1 -mt-1 mb-2 flex items-start justify-between gap-4 bg-[linear-gradient(180deg,rgba(15,23,42,0.98)_0%,rgba(2,6,23,0.98)_100%)] px-1 pt-1">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.12em] text-amber-200">
                    Optimizer Guide
                  </p>
                  <h2 className="mt-2 text-2xl font-black tracking-normal text-white">
                    How The Optimizer Works
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setOptimizerHowItWorksOpen(false)}
                  className="rounded-full border border-amber-300/25 bg-amber-300/10 px-3 py-1 text-xs font-black uppercase tracking-[0.08em] text-amber-100"
                >
                  Close
                </button>
              </div>

              <div className="mt-5 max-h-[75vh] space-y-4 overflow-y-auto pr-1 text-sm leading-6 text-slate-200">
                <p>
                  <span className="font-bold text-amber-200">Big Picture:</span>{" "}
                  The optimizer solves two layers of search. It first hunts for a good
                  puzzle shape, then solves for the best 5-player lineup inside that
                  puzzle.
                </p>
                <p>
                  <span className="font-bold text-amber-200">1. Generate A Puzzle Skeleton:</span>{" "}
                  It starts by sampling a time period, a relationship rule, and five slot
                  parameters. If staged anchor search is on, part of that skeleton stays
                  fixed while only the remaining slots mutate for a few nearby tries.
                </p>
                <p>
                  <span className="font-bold text-amber-200">2. Check Memory First:</span>{" "}
                  Before the full solve, the system checks persistent cache tables for
                  dead shapes. It can skip slot combos with no candidate pool and exact
                  configs that already failed your current thresholds.
                </p>
                <p>
                  <span className="font-bold text-amber-200">3. Build Slot Candidate Pools:</span>{" "}
                  For each slot, the optimizer filters the theme player pool down to
                  players who match that slot rule and also respect lineup-wide toggles
                  like <span className="font-semibold text-white">One-Each Lock</span> or{" "}
                  <span className="font-semibold text-white">No QBs</span>.
                </p>
                <p>
                  <span className="font-bold text-amber-200">4. Reject Impossible Shapes Early:</span>{" "}
                  If any slot has zero candidates, the config is stored as a dead path.
                  The system also records candidate counts and top fantasy values for each
                  slot so future searches can reject thin shapes faster.
                </p>
                <p>
                  <span className="font-bold text-amber-200">5. Rank Skeletons:</span>{" "}
                  If skeleton scoring is enabled, staged slot sets are ranked before the
                  expensive preview solve. That pushes stronger-looking slot mixes to the
                  front of the line.
                </p>
                <p>
                  <span className="font-bold text-amber-200">6. Solve The Lineup:</span>{" "}
                  The shared lineup solver runs branch-and-bound search over the 5 slots.
                  It carries active-link counts through the search, estimates the best
                  possible remaining score, and prunes any branch that cannot beat the
                  current best lineup.
                </p>
                <p>
                  <span className="font-bold text-amber-200">7. Apply Puzzle Goals:</span>{" "}
                  Once an optimal lineup is found, it is checked against your current
                  goals: minimum active links, total prior usage, max QBs, and minimum
                  fantasy points per season.
                </p>
                <p>
                  <span className="font-bold text-amber-200">8. Learn From Threshold Misses:</span>{" "}
                  If a puzzle fails one of those goals, that miss can be cached with the
                  exact threshold settings that caused it. Later tuning changes do not get
                  poisoned, but repeat misses under the same settings become cheaper to
                  skip.
                </p>
                <p>
                  <span className="font-bold text-amber-200">9. Save Or Continue:</span>{" "}
                  <span className="font-semibold text-white">Run Now</span> stops after the
                  first qualifying pending puzzle. <span className="font-semibold text-white">Start Auto Queue</span>{" "}
                  keeps going until the pending queue target is full or you stop it.
                </p>
                <p>
                  <span className="font-bold text-amber-200">What You&apos;re Tuning:</span>{" "}
                  Puzzle Goals define what kind of puzzle is acceptable. Optimizer
                  Controls define how aggressively the search explores the space. The log
                  and puzzles-per-minute metrics let you measure whether the optimizer is
                  actually improving as you change those controls.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="fixed bottom-[max(0.75rem,env(safe-area-inset-bottom))] left-4 z-[120]">
        <div className="flex items-center gap-1 rounded-full border border-white/10 bg-slate-950/85 p-1 shadow-[0_16px_40px_rgba(2,6,23,0.45)] backdrop-blur-xl">
          <Link
            href="/"
            className="rounded-full px-3 py-2 text-xs font-black uppercase tracking-[0.12em] text-slate-300"
          >
            Production
          </Link>
          <Link
            href="/dev"
            className="rounded-full bg-emerald-300 px-3 py-2 text-xs font-black uppercase tracking-[0.12em] text-slate-950"
          >
            Dev
          </Link>
          <Link
            href="/testing"
            className="rounded-full px-3 py-2 text-xs font-black uppercase tracking-[0.12em] text-slate-300"
          >
            Testing
          </Link>
        </div>
      </div>
      <style jsx>{`
        .dev-range-thumb::-webkit-slider-thumb {
          appearance: none;
          pointer-events: auto;
          height: 22px;
          width: 22px;
          border-radius: 9999px;
          border: 2px solid rgba(255, 255, 255, 0.92);
          background: transparent;
          cursor: grab;
        }

        .dev-range-thumb::-moz-range-thumb {
          pointer-events: auto;
          height: 22px;
          width: 22px;
          border-radius: 9999px;
          border: 2px solid rgba(255, 255, 255, 0.92);
          background: transparent;
          cursor: grab;
        }

        .dev-range-thumb::-webkit-slider-runnable-track {
          height: 48px;
          background: transparent;
        }

        .dev-range-thumb::-moz-range-track {
          height: 48px;
          background: transparent;
        }
      `}</style>
    </main>
  );
}

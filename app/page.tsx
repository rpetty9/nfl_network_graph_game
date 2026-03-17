"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { signIn, signOut, useSession } from "next-auth/react";
import {
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
import { getLinkBonusPct, getLinkMultiplier } from "@/lib/scoring";

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

type SubmissionResponse = {
  submission_id: number;
  display_name: string;
  final_score: number;
  percent_of_optimal: number | null;
  awarded_badges?: UserBadge[];
};

type LeaderboardEntry = {
  submission_id: number;
  display_name: string;
  base_score: number;
  active_links: number;
  multiplier: number;
  final_score: number;
  optimal_final_score: number | null;
  percent_of_optimal: number | null;
  submitted_at: string;
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

function getBadgeProgressLabel(
  badge: BadgeDefinition,
  stats: {
    puzzles_submitted: number;
    leaderboard_finishes: number;
    links_created: number;
  }
) {
  switch (badge.key) {
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
    case "top_10_finish":
      return `${Math.min(stats.leaderboard_finishes, 1)}/1`;
    case "top_10_finish_5":
      return `${Math.min(stats.leaderboard_finishes, 5)}/5`;
    default:
      return badge.unlockHint;
  }
}

function clampPageIndex(pageIndex: number, totalItems: number, pageSize: number) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  return Math.min(Math.max(pageIndex, 0), totalPages - 1);
}

function formatAvatarOptionLabel(value: string) {
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

  return (
    <div className="group relative">
      <button
        type="button"
        onClick={onToggle}
        className={`flex w-full items-center gap-3 rounded-[18px] border px-4 py-3 text-center transition hover:-translate-y-0.5 ${
          isCreatorBadge
            ? "border-amber-300 bg-[radial-gradient(circle_at_top,rgba(255,251,235,0.98)_0%,rgba(253,224,71,0.45)_32%,rgba(245,158,11,0.26)_62%,rgba(120,53,15,0.22)_100%)] text-amber-950 shadow-[0_0_0_1px_rgba(251,191,36,0.45),0_0_26px_rgba(251,191,36,0.35),0_18px_42px_rgba(245,158,11,0.28)]"
            : tone.shell
        } ${
          isCreatorBadge
            ? "before:absolute before:inset-0 before:bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.42),transparent_34%),radial-gradient(circle_at_80%_18%,rgba(255,236,179,0.28),transparent_24%)] before:content-['']"
            : "shadow-[0_10px_22px_rgba(15,23,42,0.08)]"
        }`}
      >
        <div
          className={`relative inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] border border-white/50 ${
            isCreatorBadge
              ? "bg-[linear-gradient(145deg,#fff7cc,#facc15_50%,#f59e0b_78%,#b45309)] text-amber-950 shadow-[0_0_18px_rgba(251,191,36,0.45)]"
              : tone.icon
          }`}
        >
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
            <BadgeGlyph icon={badge.icon} />
          </svg>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-center text-sm font-black uppercase tracking-[0.08em] text-slate-900">
            {badge.title}
          </p>
        </div>
      </button>
      {onRemove ? (
        <button
          type="button"
          onClick={onRemove}
          className="absolute right-2 top-2 z-20 rounded-full border border-white/70 bg-white/85 px-2 py-1 text-[10px] font-black uppercase tracking-[0.08em] text-slate-700 shadow-[0_8px_18px_rgba(15,23,42,0.12)] transition hover:bg-white"
        >
          Remove
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
        <p className="mt-1 text-center text-sm font-semibold leading-5 text-slate-600">
          {badge.description}
        </p>
        <p className="mt-2 text-center text-[10px] font-black uppercase tracking-[0.08em] text-sky-700">
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
    dateValue >= "2026-03-15" &&
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

function getCurrentLocalDateIso() {
  const now = new Date();
  const offsetMs = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offsetMs).toISOString().slice(0, 10);
}

function buildNavigationUrl(dateValue: string, todayIso: string) {
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
      return <path d="M4 17h16l-1.4-8-4.3 3.1L12 6 9.7 12.1 5.4 9 4 17Z" />;
    case "diamond":
      return <path d="M12 3 4.5 10.5 12 21l7.5-10.5L12 3Z" />;
    case "comet":
      return (
        <>
          <path d="M7 14a5 5 0 1 0 10 0 5 5 0 0 0-10 0Z" />
          <path d="M5 11 2.5 8.5" />
          <path d="M7 9 4.5 6.5" />
        </>
      );
    case "target":
      return (
        <>
          <path d="M12 5a7 7 0 1 0 7 7" />
          <path d="M12 9a3 3 0 1 0 3 3" />
          <path d="M15 9h6" />
          <path d="M18 6v6" />
        </>
      );
    case "orbit":
      return (
        <>
          <circle cx="12" cy="12" r="2.2" />
          <path d="M4.5 12c1.8-4.6 4.6-7 7.5-7s5.7 2.4 7.5 7c-1.8 4.6-4.6 7-7.5 7s-5.7-2.4-7.5-7Z" />
          <path d="M8 6.8c3.7-.7 7 .6 8.6 3.2 1.6 2.6 1.1 6-.9 9" />
        </>
      );
    case "flame":
      return (
        <>
          <path d="M12.4 3.5c2.3 2.8 3.9 5 3.9 7.7A4.3 4.3 0 0 1 12 15.5a4.6 4.6 0 0 1-4.6-4.7c0-1.9.9-3.9 2.7-6.1.1 1.8 1 3.1 2.3 4.1.5-2 .4-3.8 0-5.3Z" />
          <path d="M12 13.4c1.2 1.1 1.8 2.1 1.8 3.4A2.8 2.8 0 0 1 11 19.5a2.9 2.9 0 0 1-2.8-2.9c0-1 .5-2.1 1.6-3.3.3 1 .9 1.6 2.2 2.1Z" />
        </>
      );
    case "moon":
      return (
        <>
          <path d="M15.5 4.5a7.5 7.5 0 1 0 4 13.8 6.6 6.6 0 0 1-4.7 1.2A7.5 7.5 0 0 1 15.5 4.5Z" />
          <path d="M8.5 6.5h.01" />
          <path d="M6 9h.01" />
        </>
      );
    case "prism":
      return (
        <>
          <path d="M12 3 5 8v8l7 5 7-5V8l-7-5Z" />
          <path d="M5 8h14" />
          <path d="M12 3v18" />
          <path d="M5 16h14" />
        </>
      );
    case "star":
      return (
        <path d="m12 3 2.5 5.4 5.9.7-4.4 4 1.2 5.9L12 16l-5.2 3 1.2-5.9-4.4-4 5.9-.7Z" />
      );
    case "bolt":
      return <path d="M13.5 2 6 13h4.6L9.8 22 18 10.6h-4.7L13.5 2Z" />;
    case "crest":
      return <path d="M12 3 6 5.4v5.7c0 4.2 2.4 7.3 6 9.9 3.6-2.6 6-5.7 6-9.9V5.4L12 3Z" />;
    case "helmet":
    default:
      return (
        <>
          <path d="M7 12.5A5 5 0 0 1 12 7h1.8A4.2 4.2 0 0 1 18 11.2V15H9.2A2.2 2.2 0 0 1 7 12.8v-.3Z" />
          <path d="M18 13h1.6v2H18" />
          <path d="M10 15v1.8" />
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
      className={`inline-flex ${sizeClass} ${paddingClass} items-center justify-center rounded-full shadow-[0_10px_24px_rgba(15,23,42,0.16)]`}
      style={{
        background: `linear-gradient(145deg, ${borderPalette.borderSoft}, ${borderPalette.borderHex})`,
        boxShadow: `0 10px 24px rgba(15,23,42,0.16), 0 0 0 1px ${borderPalette.borderSoft}`,
      }}
    >
      <div
        className={`flex h-full w-full items-center justify-center rounded-full bg-gradient-to-br ${bgPalette.bg}`}
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className={svgClass}
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
        shell: "border-emerald-200 bg-emerald-50/90 text-emerald-900",
        icon: "bg-emerald-500 text-white",
        meta: "text-emerald-700",
      };
    case "amber":
      return {
        shell: "border-amber-200 bg-amber-50/90 text-amber-900",
        icon: "bg-amber-500 text-white",
        meta: "text-amber-700",
      };
    case "violet":
      return {
        shell: "border-violet-200 bg-violet-50/90 text-violet-900",
        icon: "bg-violet-500 text-white",
        meta: "text-violet-700",
      };
    case "rose":
      return {
        shell: "border-rose-200 bg-rose-50/90 text-rose-900",
        icon: "bg-rose-500 text-white",
        meta: "text-rose-700",
      };
    case "slate":
      return {
        shell: "border-slate-200 bg-slate-100/90 text-slate-900",
        icon: "bg-slate-700 text-white",
        meta: "text-slate-600",
      };
    case "sky":
    default:
      return {
        shell: "border-sky-200 bg-sky-50/90 text-sky-900",
        icon: "bg-sky-500 text-white",
        meta: "text-sky-700",
      };
  }
}

function BadgeGlyph({ icon }: { icon: BadgeIcon }) {
  switch (icon) {
    case "stack":
      return (
        <>
          <rect x="5" y="6" width="14" height="4" rx="1.5" />
          <rect x="5" y="10" width="14" height="4" rx="1.5" />
          <rect x="5" y="14" width="14" height="4" rx="1.5" />
        </>
      );
    case "trophy":
      return (
        <>
          <path d="M8 4h8v3a4 4 0 0 1-8 0V4Z" />
          <path d="M12 11v4" />
          <path d="M9 19h6" />
          <path d="M16 6h2a2 2 0 0 1-2 2" />
          <path d="M8 6H6a2 2 0 0 0 2 2" />
        </>
      );
    case "link":
      return (
        <>
          <path d="M9 8H7a4 4 0 1 0 0 8h2" />
          <path d="M15 8h2a4 4 0 1 1 0 8h-2" />
          <path d="M8 12h8" />
        </>
      );
    case "shield":
      return (
        <>
          <path d="M12 3l7 3v5c0 4.2-2.4 7.8-7 10-4.6-2.2-7-5.8-7-10V6l7-3Z" />
          <path d="M9.5 12.5l1.8 1.8 3.4-3.8" />
        </>
      );
    case "flag":
      return (
        <>
          <path d="M7 20V4" />
          <path d="M7 5h8l-1.6 2.5L15 10H7" />
        </>
      );
    case "crown":
      return (
        <>
          <path d="M5 17h14l-1.2-8-3.8 3-2-5-2 5-3.8-3L5 17Z" />
          <path d="M7 20h10" />
          <path d="M8 17h8" />
        </>
      );
    case "spark":
    default:
      return (
        <>
          <path d="m12 3 1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3Z" />
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
  const tone = locked
    ? {
        shell:
          "border-slate-200 bg-[linear-gradient(145deg,rgba(241,245,249,0.96),rgba(226,232,240,0.95))] text-slate-600 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]",
        icon: "bg-[linear-gradient(145deg,#94a3b8,#64748b)] text-white",
        meta: "text-slate-500",
        aura: "",
      }
    : isCreatorBadge
      ? {
          shell:
            "border-amber-300 bg-[radial-gradient(circle_at_top,rgba(255,251,235,0.99)_0%,rgba(253,224,71,0.48)_28%,rgba(245,158,11,0.24)_54%,rgba(120,53,15,0.18)_100%)] text-amber-950 shadow-[0_0_0_1px_rgba(251,191,36,0.38),0_0_26px_rgba(251,191,36,0.24),0_20px_46px_rgba(245,158,11,0.28),inset_0_1px_0_rgba(255,255,255,0.72)]",
          icon: "bg-[linear-gradient(145deg,#fff7cc,#facc15_50%,#f59e0b_72%,#b45309)] text-amber-950 shadow-[0_0_20px_rgba(251,191,36,0.42)]",
          meta: "text-amber-800",
          aura: "before:absolute before:inset-0 before:bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.38),transparent_48%),radial-gradient(circle_at_78%_18%,rgba(255,236,179,0.24),transparent_24%)] before:content-[''] after:absolute after:-inset-8 after:-z-10 after:rounded-[30px] after:bg-[radial-gradient(circle,rgba(251,191,36,0.2),transparent_60%)] after:blur-xl after:content-['']",
        }
      : {
          ...getBadgeToneClasses(badge.tone),
          aura: "",
        };

  return (
    <div
      className={`relative overflow-hidden rounded-[22px] border px-3 py-3 ${tone.shell} ${tone.aura} ${
        compact ? "min-w-[150px]" : ""
      }`}
    >
      <div className="absolute inset-x-4 top-0 h-px bg-white/60" />
      <div className="relative flex items-start gap-3">
        <div
          className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[16px] border border-white/45 shadow-[0_10px_18px_rgba(15,23,42,0.14)] ${tone.icon}`}
        >
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
            <BadgeGlyph icon={badge.icon} />
          </svg>
        </div>
        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-[0.12em]">
            {badge.title}
          </p>
          <p
            className={`mt-1 text-xs font-semibold leading-5 ${
              locked ? "text-slate-600" : isCreatorBadge ? "text-amber-900/85" : "text-slate-600"
            }`}
          >
            {badge.description}
          </p>
          <p className={`mt-2 text-[10px] font-black uppercase tracking-[0.08em] ${tone.meta}`}>
            {locked
              ? helperText ?? "Locked"
              : `Earned ${formatBadgeAwardDate(badge.awardedAt)}`}
          </p>
          {onAction ? (
            <button
              type="button"
              onClick={onAction}
              disabled={actionDisabled}
              className="mt-3 rounded-full border border-white/60 bg-white/80 px-3 py-1 text-[10px] font-black uppercase tracking-[0.08em] text-slate-700 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {actionLabel}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default function HomePage() {
  const todayIso = getCurrentLocalDateIso();
  const loadRequestRef = useRef(0);
  const relationshipRequestRef = useRef(0);
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
    return normalized && isPlayablePuzzleDate(normalized, todayIso)
      ? normalized
      : todayIso;
  });
  const [nodes, setNodes] = useState<NodeState[]>([]);
  const [initialNodes, setInitialNodes] = useState<NodeState[]>([]);
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
  const [submissionResult, setSubmissionResult] = useState<SubmissionResponse | null>(
    null
  );
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);
  const [leaderboardError, setLeaderboardError] = useState<string | null>(null);
  const { data: session, status: sessionStatus, update: updateSession } =
    useSession();
  const signedInUsername = session?.user?.username ?? null;
  const isTrackedAccountUser = Boolean(session?.user?.id && signedInUsername);
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
  const userStats = session?.user?.stats ?? {
    puzzles_submitted: 0,
    leaderboard_finishes: 0,
    links_created: 0,
  };
  const featuredBadgeKeys = useMemo(
    () =>
      ((session?.user?.featuredBadges ?? []) as string[])
        .filter((badgeKey): badgeKey is BadgeKey => typeof badgeKey === "string")
        .slice(0, 3),
    [session?.user?.featuredBadges]
  );
  const publicBadgeDefinitions = getPublicBadgeDefinitions();
  const earnedBadgeMap = useMemo(
    () => new Map(userBadges.map((badge) => [badge.badgeKey, badge])),
    [userBadges]
  );
  const galleryPageSize = 4;
  const pagedGalleryBadges = publicBadgeDefinitions.slice(
    galleryPage * galleryPageSize,
    (galleryPage + 1) * galleryPageSize
  );
  const galleryPageCount = Math.max(
    1,
    Math.ceil(publicBadgeDefinitions.length / galleryPageSize)
  );
  const featuredBadges = featuredBadgeDraft
    .map((badgeKey) => earnedBadgeMap.get(badgeKey))
    .filter((badge): badge is UserBadge => Boolean(badge));
  const featuredBadgeSlots = [0, 1, 2].map((index) => featuredBadges[index] ?? null);
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
          title: "Icon Color",
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
          title: "Style",
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

    if (
      (!urlDate || !isPlayablePuzzleDate(urlDate, todayIso)) &&
      window.location.pathname !== "/"
    ) {
      window.history.replaceState({}, "", "/");
      return;
    }

    if (urlDate === todayIso && window.location.pathname !== "/") {
      window.history.replaceState({}, "", "/");
    }
  }, [todayIso]);

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
    setGalleryPage((current) =>
      clampPageIndex(current, publicBadgeDefinitions.length, galleryPageSize)
    );
  }, [galleryPageSize, publicBadgeDefinitions.length]);

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
    if (isPlayablePuzzleDate(selectedDate, todayIso)) return;
    setSelectedDate(todayIso);

    if (typeof window !== "undefined") {
      window.history.replaceState({}, "", "/");
    }
  }, [selectedDate, todayIso]);

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
        const [puzzleRes, playersRes] = await Promise.all([
          fetch(`/api/puzzle${params}`, {
            cache: "no-store",
            signal: controller.signal,
          }),
          fetch(`/api/players${params}`, {
            cache: "no-store",
            signal: controller.signal,
          }),
        ]);

        if (!puzzleRes.ok || !playersRes.ok) {
          const [puzzleBody, playersBody] = await Promise.all([
            puzzleRes.text(),
            playersRes.text(),
          ]);
          throw new Error(
            `puzzle ${puzzleRes.status}: ${puzzleBody || "no body"} | players ${playersRes.status}: ${playersBody || "no body"}`
          );
        }

        const puzzleJson: PuzzleResponse = await puzzleRes.json();
        const playersJson: PlayersResponse = await playersRes.json();

        if (controller.signal.aborted || requestId !== loadRequestRef.current) {
          return;
        }

        setPuzzleData(puzzleJson);
        setPlayersData(playersJson);
        setAccountHasSubmittedForSelectedDate(
          Boolean(puzzleJson.viewer_has_submitted && isTrackedAccountUser)
        );
        setOptimalLineup(null);
        setOptimalError(null);
        setOptimalLoading(false);
        setSubmissionResult(null);
        setLeaderboard([]);
        setLeaderboardLoading(false);
        setLeaderboardError(null);
        const initial = [1, 2, 3, 4, 5].map((nodeId) => ({
          node_id: nodeId,
          player_id: "",
        }));

        setNodes(initial);
        setInitialNodes(initial);
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
  }, [selectedDate, session?.user?.id, signedInUsername, isTrackedAccountUser]);

  useEffect(() => {
    if (typeof window === "undefined" || !selectedDate) return;
    const nextPath = buildNavigationUrl(selectedDate, todayIso);
    const currentPath = window.location.pathname;
    if (currentPath === nextPath) return;
    window.history.replaceState({}, "", nextPath);
  }, [selectedDate, todayIso]);

  useEffect(() => {
    const handlePopState = () => {
      const urlDate = getDateFromLocation(window.location);
      const nextDate =
        urlDate && isPlayablePuzzleDate(urlDate, todayIso) ? urlDate : todayIso;
      if (nextDate !== selectedDate) {
        setSelectedDate(nextDate);
      }
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [selectedDate, todayIso]);

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
        const response = await fetch(`/api/relationships?${params.toString()}`, {
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
  }, [nodes, selectedDate]);

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
  const bonusPct = puzzleData?.relationship_rule?.bonus_pct ?? 5;
  const formattedPuzzleDate = puzzleData?.puzzle?.puzzle_date
    ? new Date(puzzleData.puzzle.puzzle_date).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "Daily Puzzle";
  function formatPuzzleDateLabel(dateValue: string) {
    const [year, month, day] = dateValue.split("-").map(Number);
    if (!year || !month || !day) return dateValue;

    return new Date(year, month - 1, day).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }
  const availableDates = puzzleData?.available_dates ?? [];
  const sortedAvailableDates = [...availableDates].sort();
  const minPuzzleDate = sortedAvailableDates[0] ?? "2026-03-15";
  const maxPuzzleDate = todayIso;
  const dateOptions = availableDates
    .filter(
      (dateValue) =>
        isPlayablePuzzleDate(dateValue, maxPuzzleDate) &&
        dateValue >= minPuzzleDate
    )
    .sort();
  const renderedDateOptions =
    selectedDate &&
    isPlayablePuzzleDate(selectedDate, maxPuzzleDate) &&
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
  function getPairKey(playerId1: string, playerId2: string) {
    return [String(playerId1), String(playerId2)].sort().join("|");
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
          (teamAbbr) => String(teamAbbr).toUpperCase() === ruleValue
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
  const activeSlotRule = getSlotRule(activeNodeId);

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
  const liveEnergy = isFullyConnected ? 1 : linkProgressPct;
  const ringGlowStrength = 0.22 + liveEnergy * 0.5;
  const shellGlowStrength = 0.12 + liveEnergy * 0.34;
  const pulseDuration = Math.max(1.15, 2.4 - liveEnergy * 1.1);
  const formattedFinalScore = finalScore.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const optimalPercent = optimalLineup?.optimal_final_score
    ? (finalScore / Number(optimalLineup.optimal_final_score)) * 100
    : null;
  const isLockedForSelectedDate = isTrackedAccountUser
    ? accountHasSubmittedForSelectedDate
    : hasSubmittedForSelectedDate;
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
      setSubmissionResult(null);
      setLeaderboard([]);
      setLeaderboardLoading(false);
      setLeaderboardError(null);
      return;
    }

    const controller = new AbortController();

    async function loadOptimalLineup() {
      try {
        setOptimalLoading(true);
        setOptimalError(null);
        const params = selectedDate
          ? `?date=${encodeURIComponent(selectedDate)}`
          : "";
        const response = await fetch(`/api/optimal-lineup${params}`, {
          cache: "no-store",
          signal: controller.signal,
        });

        if (!response.ok) {
          const body = await response.text();
          throw new Error(body || "Failed to load optimal lineup");
        }

        const json: OptimalLineupResponse = await response.json();
        setOptimalLineup(json);
      } catch (error) {
        if ((error as Error).name === "AbortError") return;
        console.error(error);
        setOptimalLineup(null);
        setOptimalError((error as Error).message);
      } finally {
        if (!controller.signal.aborted) {
          setOptimalLoading(false);
        }
      }
    }

    loadOptimalLineup();
    return () => controller.abort();
  }, [submitted, selectedDate]);

  useEffect(() => {
    if (!submitted || !optimalLineup) return;

    const controller = new AbortController();
    const optimalResult = optimalLineup;

    async function saveSubmissionAndLoadLeaderboard() {
      try {
        setLeaderboardLoading(true);
        setLeaderboardError(null);
        setSubmissionError(null);

        if (!isTrackedAccountUser && !browserClientToken) {
          throw new Error("Unable to verify this browser for submission.");
        }

        const saveResponse = await fetch("/api/submissions", {
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
            optimal_final_score: Number(optimalResult.optimal_final_score),
          }),
          signal: controller.signal,
        });

        if (!saveResponse.ok) {
          const body = await saveResponse.json().catch(() => null);
          const message =
            body && typeof body.error === "string"
              ? body.error
              : "Failed to save submission";

          if (saveResponse.status === 409) {
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
        if (isTrackedAccountUser) {
          setAccountHasSubmittedForSelectedDate(true);
        } else {
          markBrowserSubmittedForDate(selectedDate);
          setHasSubmittedForSelectedDate(true);
        }
        if (session?.user?.id) {
          await updateSession();
          if (controller.signal.aborted) return;
        }

        const leaderboardResponse = await fetch(
          `/api/leaderboard?date=${encodeURIComponent(selectedDate)}&limit=10`,
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
        setLeaderboard(leaderboardJson.leaderboard ?? []);
      } catch (error) {
        if ((error as Error).name === "AbortError") return;
        console.error(error);
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
    optimalLineup,
    selectedDate,
    nodes,
    browserClientToken,
    isTrackedAccountUser,
    session?.user?.id,
    updateSession,
  ]);

  useEffect(() => {
    if (!leaderboardOpen || submitted) return;

    const controller = new AbortController();

    async function loadLeaderboard() {
      try {
        setLeaderboardLoading(true);
        setLeaderboardError(null);

        const leaderboardResponse = await fetch(
          `/api/leaderboard?date=${encodeURIComponent(selectedDate)}&limit=10`,
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
        setLeaderboard(leaderboardJson.leaderboard ?? []);
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

    loadLeaderboard();
    return () => controller.abort();
  }, [leaderboardOpen, selectedDate, submitted]);

  function handleSubmit() {
    if (!canSubmit) return;
    setSubmissionError(null);
    setSubmitted(true);
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

  function handleReset() {
    setNodes(initialNodes.map((node) => ({ ...node })));
    setActiveNodeId(1);
    setMobileNavigatorOpen(true);
    setSubmitted(false);
    setOptimalLineup(null);
    setOptimalError(null);
    setOptimalLoading(false);
    setSubmissionResult(null);
    setLeaderboard([]);
    setLeaderboardLoading(false);
    setLeaderboardError(null);
    setSubmissionError(null);
  }

  function renderHeadshot(
    player?: PlayerOption,
    sizeClass = "h-20 w-20 rounded-[22px]"
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
        className={`flex ${sizeClass} items-center justify-center bg-[linear-gradient(135deg,#dbeafe_0%,#bfdbfe_45%,#93c5fd_100%)] text-lg font-bold text-slate-800 ring-2 ring-white/70`}
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
        className={`flex items-center justify-between gap-4 rounded-[18px] border-[3px] bg-white/90 px-4 py-3 ${accentClasses.border}`}
      >
        <div className="flex min-w-0 items-center gap-3">
          <div className="shrink-0">{renderHeadshot(player)}</div>
          <div className="min-w-0">
            {slotLabel ? (
              <p className={`text-[10px] font-black uppercase tracking-[0.08em] ${accentClasses.label}`}>
                {slotLabel}
              </p>
            ) : null}
            <p className="mt-1 truncate text-sm font-bold text-slate-900">
              {player.player_name}
            </p>
            <p className={`mt-1 text-[10px] font-semibold uppercase tracking-[0.06em] ${accentClasses.label}`}>
              {player.primary_position ?? "N/A"} •{" "}
              {player.theme_start_season ?? player.career_start_season ?? "N/A"}–
              {player.theme_end_season ?? player.career_end_season ?? "N/A"}
            </p>
          </div>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-[10px] font-black uppercase tracking-[0.08em] text-slate-500">
            Fantasy Pts
          </p>
          <p className={`mt-1 text-lg font-black ${accentClasses.value}`}>
            {Number(player.fantasy_points).toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </p>
        </div>
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
          if (submitted) return;
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
              disabled={submitted}
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
        <div className="mx-auto max-w-[1080px] overflow-hidden rounded-[38px] border-[4px] border-sky-300 bg-white/84 shadow-[0_24px_0_rgba(56,189,248,0.14),0_26px_80px_rgba(125,211,252,0.16)] backdrop-blur-sm">
          <div className="relative overflow-hidden border-b-[4px] border-sky-300 bg-[linear-gradient(135deg,#38bdf8_0%,#818cf8_42%,#7dd3fc_100%)] px-4 py-5 text-center md:px-10 md:py-8">
            <div className="absolute inset-0 bg-[repeating-linear-gradient(135deg,rgba(255,255,255,0.18)_0,rgba(255,255,255,0.18)_14px,transparent_14px,transparent_30px)]" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.36)_0%,transparent_34%)]" />
            <div className="absolute left-3 top-3 z-20 md:left-5 md:top-5">
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
                    className="relative hidden h-10 items-center rounded-full border-[2px] border-white/60 bg-white/18 pl-9 pr-3 text-[10px] font-black uppercase tracking-[0.08em] text-white backdrop-blur-sm transition hover:bg-white/26 md:inline-flex"
                  >
                    <span className="absolute -left-2 top-1/2 -translate-y-1/2">
                      <ProfileAvatar
                        style={sessionAvatarStyle}
                        bg={sessionAvatarBg}
                        accent={sessionAvatarAccent}
                        border={sessionAvatarBorder}
                        size="sm"
                      />
                    </span>
                    <span>{signedInUsername}</span>
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
              className="absolute right-3 top-3 z-20 inline-flex h-10 w-10 items-center justify-center rounded-full border-[2px] border-white/65 bg-white/20 text-white shadow-[0_8px_18px_rgba(15,23,42,0.18)] backdrop-blur-sm transition hover:scale-105 hover:bg-white/28 md:right-5 md:top-5 md:h-11 md:w-11"
              aria-label={`Open leaderboard for ${formatPuzzleDateLabel(selectedDate)}`}
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
              <div className="mt-5 flex items-center justify-center gap-2 md:mt-8 md:gap-3">
                <h1 className="text-2xl font-black tracking-[0.06em] text-white drop-shadow-[0_4px_0_rgba(30,41,59,0.18)] md:text-5xl md:tracking-[0.08em]">
                  Five Wide
                </h1>
                <span className="inline-flex items-center gap-1.5 rounded-full border-[2px] border-white/70 bg-white/20 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-white shadow-[0_8px_18px_rgba(15,23,42,0.16)] backdrop-blur-sm md:px-3 md:py-1.5 md:text-xs">
                  <span className="h-2.5 w-2.5 rounded-full bg-pink-400 shadow-[0_0_0_3px_rgba(244,114,182,0.18)]" />
                  Beta
                </span>
              </div>
              <p className="mx-auto mt-3 max-w-3xl text-[12px] font-semibold leading-[1.4] text-white/90 md:mt-5 md:max-w-4xl md:text-base">
                Build the strongest 5-player lineup for the daily era, satisfy every slot rule, and chase the best score by combining raw fantasy production with as many valid player-to-player links as possible.
              </p>
            </div>
          </div>
        </div>

        {submitted ? (
          <div className="mx-auto mt-8 max-w-[1080px] rounded-[34px] border-[4px] border-emerald-200 bg-[linear-gradient(180deg,#ffffff_0%,#ecfdf5_100%)] p-10 text-center shadow-[0_18px_0_rgba(52,211,153,0.12),0_24px_60px_rgba(52,211,153,0.12)] backdrop-blur-sm">
            <p className="text-sm font-black uppercase tracking-[0.12em] text-emerald-700">
              Lineup Submitted
            </p>
            <h2 className="mt-5 text-3xl font-black text-sky-700 md:text-5xl">
              Final Score
            </h2>
            <p className="mt-6 text-6xl font-black text-sky-700 md:text-7xl">
              {formattedFinalScore}
            </p>

            <div className="mx-auto mt-8 grid max-w-3xl gap-4 md:grid-cols-3">
              <div className="rounded-[24px] border-[3px] border-sky-100 bg-sky-50/80 p-5">
                <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-slate-500">
                  Base Fantasy Points
                </p>
                <p className="mt-2 text-2xl font-extrabold text-slate-900">
                  {baseFantasyPoints.toFixed(2)}
                </p>
              </div>

              <div className="rounded-[24px] border-[3px] border-sky-100 bg-sky-50/80 p-5">
                <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-slate-500">
                  Active Links
                </p>
                <p className="mt-2 text-2xl font-extrabold text-slate-900">
                  {activeLinkCount}
                </p>
              </div>

              <div className="rounded-[24px] border-[3px] border-emerald-200 bg-emerald-100/70 p-5 shadow-[0_10px_20px_rgba(52,211,153,0.12)]">
                <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-emerald-700">
                  Multiplier
                </p>
                <p className="mt-2 text-2xl font-extrabold text-emerald-900">
                  {multiplier.toFixed(2)}x
                </p>
              </div>
            </div>

            <div className="mx-auto mt-6 grid max-w-3xl gap-4 md:grid-cols-2">
              <div className="rounded-[24px] border-[3px] border-sky-100 bg-sky-50/80 p-5">
                <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-slate-500">
                  Optimal Score
                </p>
                <p className="mt-2 text-2xl font-extrabold text-slate-900">
                  {optimalLineup
                    ? Number(optimalLineup.optimal_final_score).toLocaleString(
                        undefined,
                        {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        }
                      )
                    : optimalLoading
                      ? "Calculating..."
                      : "Unavailable"}
                </p>
              </div>

              <div className="rounded-[24px] border-[3px] border-sky-100 bg-sky-50/80 p-5">
                <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-slate-500">
                  Score vs Optimal
                </p>
                <p className="mt-2 text-2xl font-extrabold text-slate-900">
                  {optimalPercent != null
                    ? `${optimalPercent.toFixed(1)}%`
                    : optimalLoading
                      ? "Calculating..."
                      : "Unavailable"}
                </p>
              </div>
            </div>

            {optimalError && (
              <div className="mx-auto mt-6 max-w-3xl rounded-[20px] border border-rose-200 bg-rose-50 px-4 py-3 text-left text-sm text-rose-900">
                <p className="font-bold">Optimal lineup error</p>
                <p className="mt-1 break-words">{optimalError}</p>
              </div>
            )}

            <div className="mx-auto mt-8 grid max-w-6xl gap-6 xl:grid-cols-2">
              <div className="rounded-[26px] border-[4px] border-sky-200 bg-[linear-gradient(180deg,#ffffff_0%,#f0f9ff_100%)] p-6 text-left shadow-[0_14px_36px_rgba(125,211,252,0.14)]">
                <p className="text-[10px] font-black uppercase tracking-[0.12em] text-sky-700">
                  Your Lineup
                </p>
                <div className="mt-4 space-y-3">
                  {selectedPlayersByFantasyPoints.map((player) =>
                    renderLineupEntry(
                      player,
                      {
                        border: "border-sky-100",
                        label: "text-sky-700/80",
                        value: "text-sky-700",
                      }
                    )
                  )}
                </div>
                <div className="mt-5 grid gap-3 md:grid-cols-3">
                  <div className="rounded-[18px] border-[3px] border-sky-100 bg-white/85 px-4 py-3">
                    <p className="text-[10px] font-black uppercase tracking-[0.08em] text-sky-600">
                      Base
                    </p>
                    <p className="mt-1 text-lg font-black text-slate-900">
                      {baseFantasyPoints.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </p>
                  </div>
                  <div className="rounded-[18px] border-[3px] border-sky-100 bg-white/85 px-4 py-3">
                    <p className="text-[10px] font-black uppercase tracking-[0.08em] text-sky-600">
                      Active Links
                    </p>
                    <p className="mt-1 text-lg font-black text-slate-900">
                      {activeLinkCount}
                    </p>
                  </div>
                  <div className="rounded-[18px] border-[3px] border-sky-100 bg-white/85 px-4 py-3">
                    <p className="text-[10px] font-black uppercase tracking-[0.08em] text-sky-600">
                      Multiplier
                    </p>
                    <p className="mt-1 text-lg font-black text-slate-900">
                      {multiplier.toFixed(2)}x
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-[26px] border-[4px] border-indigo-200 bg-[linear-gradient(180deg,#ffffff_0%,#eef2ff_100%)] p-6 text-left shadow-[0_14px_36px_rgba(129,140,248,0.14)]">
                <p className="text-[10px] font-black uppercase tracking-[0.12em] text-indigo-700">
                  Optimal Lineup
                </p>
                {optimalLineup ? (
                  <>
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
                  </>
                ) : (
                  <div className="mt-4 rounded-[18px] border-[3px] border-indigo-100 bg-white/85 px-4 py-6 text-center text-sm font-semibold text-slate-600">
                    {optimalLoading
                      ? "Calculating optimal lineup..."
                      : "Optimal lineup unavailable"}
                  </div>
                )}
              </div>
            </div>

            {submissionResult?.awarded_badges &&
            submissionResult.awarded_badges.length > 0 ? (
              <div className="mx-auto mt-8 max-w-4xl rounded-[26px] border-[4px] border-emerald-200 bg-[linear-gradient(180deg,#ffffff_0%,#ecfdf5_100%)] p-6 text-left shadow-[0_14px_36px_rgba(16,185,129,0.12)]">
                <p className="text-[10px] font-black uppercase tracking-[0.12em] text-emerald-700">
                  New Badges
                </p>
                <h3 className="mt-2 text-2xl font-black text-emerald-900">
                  You earned {submissionResult.awarded_badges.length} new badge
                  {submissionResult.awarded_badges.length === 1 ? "" : "s"}
                </h3>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  {submissionResult.awarded_badges.map((badge) => (
                    <ProfileBadgeCard key={badge.badgeKey} badge={badge} compact />
                  ))}
                </div>
              </div>
            ) : null}

            <div className="mx-auto mt-8 max-w-4xl rounded-[26px] border-[4px] border-amber-200 bg-[linear-gradient(180deg,#ffffff_0%,#fffbeb_100%)] p-6 text-left shadow-[0_14px_36px_rgba(251,191,36,0.12)]">
              <p className="text-[10px] font-black uppercase tracking-[0.12em] text-amber-700">
                {formatPuzzleDateLabel(selectedDate)} Leaderboard
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
                <div className="mt-4 space-y-3">
                  {leaderboard.map((entry, index) => (
                    <div
                      key={entry.submission_id}
                      className={`flex items-center justify-between gap-4 rounded-[18px] border-[3px] bg-white/90 px-4 py-3 ${
                        submissionResult?.submission_id === entry.submission_id
                          ? "border-emerald-200 shadow-[0_0_20px_rgba(52,211,153,0.12)]"
                          : "border-amber-100"
                      }`}
                    >
                      <div className="min-w-0">
                        <p className="text-[10px] font-black uppercase tracking-[0.08em] text-amber-700">
                          #{index + 1}
                        </p>
                        <p className="mt-1 truncate text-sm font-bold text-slate-900">
                          {entry.display_name}
                        </p>
                        <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.06em] text-amber-700/80">
                          {Number(entry.percent_of_optimal ?? 0).toFixed(1)}% of optimal •{" "}
                          {entry.active_links} links
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-[10px] font-black uppercase tracking-[0.08em] text-slate-500">
                          Final Score
                        </p>
                        <p className="mt-1 text-lg font-black text-amber-700">
                          {Number(entry.final_score).toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-4 rounded-[18px] border-[3px] border-amber-100 bg-white/85 px-4 py-6 text-center text-sm font-semibold text-slate-600">
                  No leaderboard entries yet for this puzzle.
                </div>
              )}
            </div>

            {optimalLineup && (
              <div className="hidden mx-auto mt-8 max-w-3xl rounded-[26px] border-[4px] border-indigo-200 bg-[linear-gradient(180deg,#ffffff_0%,#eef2ff_100%)] p-6 text-left shadow-[0_14px_36px_rgba(129,140,248,0.14)]">
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

            <div className="hidden mx-auto mt-8 max-w-3xl rounded-[26px] border-[4px] border-sky-200 bg-[linear-gradient(180deg,#ffffff_0%,#f0f9ff_100%)] p-6 text-left shadow-[0_14px_36px_rgba(125,211,252,0.14)]">
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

            <div className="mt-8">
              <button
                type="button"
                onClick={handleReset}
                className="rounded-2xl border-[3px] border-sky-300 bg-[linear-gradient(180deg,#ffffff_0%,#eff6ff_100%)] px-6 py-3 text-sm font-bold text-sky-700 transition hover:-translate-y-0.5 hover:bg-sky-50"
              >
                Reset Board
              </button>
            </div>
          </div>
        ) : (
          <>
          <div className="relative mt-4 mx-auto h-[500px] max-w-[1080px] overflow-hidden rounded-[36px] border-[4px] border-sky-200 bg-[radial-gradient(circle_at_top,#ffffff_0%,#f0f9ff_46%,#f8f4ea_100%)] p-3 shadow-[0_20px_0_rgba(125,211,252,0.12),0_24px_60px_rgba(125,211,252,0.18)] backdrop-blur-sm sm:h-[700px] md:h-[760px] md:max-w-[1080px] md:p-4">
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
                            className={`text-[10px] font-black uppercase tracking-[0.08em] sm:font-[family-name:var(--font-display)] sm:text-[8px] sm:tracking-[0.04em] ${
                              isFullyConnected ? "text-emerald-700" : "text-sky-700"
                            }`}
                          >
                            {isFullyConnected ? "Full Connection" : "Live Link Bonus"}
                          </p>

                          <p
                            className={`mt-2 text-[1.8rem] font-black leading-[1.06] tracking-[0.01em] sm:font-[family-name:var(--font-display)] sm:mt-3 sm:text-[1.35rem] sm:leading-[1.35] ${
                              isFullyConnected ? "text-emerald-900" : "text-sky-900"
                            }`}
                          >
                            {isFullyConnected ? "Fully Linked" : relationshipLabel}
                          </p>

                          <p
                            className={`mt-2 text-[14px] font-bold uppercase tracking-[0.05em] sm:mt-3 sm:text-[12px] sm:tracking-[0.08em] ${
                              isFullyConnected ? "text-emerald-700" : "text-sky-700"
                            }`}
                          >
                            {isFullyConnected
                              ? `${multiplier.toFixed(2)}x multiplier`
                              : `+${linkBonusPct.toFixed(1)}% total bonus`}
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

              <div className="mx-auto mt-6 max-w-[1080px] rounded-[30px] border-[4px] border-sky-200 bg-[linear-gradient(180deg,#f0f9ff_0%,#eff6ff_100%)] p-6 shadow-[0_14px_0_rgba(125,211,252,0.1),0_18px_40px_rgba(125,211,252,0.12)] backdrop-blur-sm">
                {(isLockedForSelectedDate || submissionError) && (
                  <div
                    className={`mb-4 rounded-[18px] border px-4 py-3 text-sm font-semibold ${
                      isLockedForSelectedDate
                        ? "border-amber-200 bg-amber-50 text-amber-900"
                        : "border-rose-200 bg-rose-50 text-rose-900"
                    }`}
                  >
                    {isLockedForSelectedDate
                      ? isTrackedAccountUser
                        ? `Your account already submitted for ${formatPuzzleDateLabel(selectedDate)}. You can still explore the puzzle, but each account only gets one leaderboard entry per date.`
                        : `This browser already submitted for ${formatPuzzleDateLabel(selectedDate)}. You can still explore the puzzle, but the leaderboard only accepts one entry per browser per date.`
                      : submissionError}
                  </div>
                )}
                <div className="grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={!canSubmit}
                    className={`sm:order-2 rounded-2xl px-6 py-4 text-sm font-bold transition ${
                      canSubmit
                        ? "border-[3px] border-sky-300 bg-[linear-gradient(180deg,#7dd3fc_0%,#38bdf8_52%,#0ea5e9_100%)] text-white shadow-[0_10px_0_rgba(56,189,248,0.18),0_14px_28px_rgba(56,189,248,0.24)] hover:-translate-y-0.5 hover:brightness-105"
                        : "cursor-not-allowed border border-white/10 bg-white/10 text-slate-400 shadow-none"
                    }`}
                  >
                    Submit Score
                  </button>
                  <button
                    type="button"
                    onClick={() => setRulesOpen(true)}
                    className="sm:order-1 rounded-2xl border-[3px] border-sky-200 bg-white/90 px-6 py-4 text-sm font-bold text-sky-700 shadow-[0_8px_18px_rgba(125,211,252,0.14)] transition hover:-translate-y-0.5 hover:bg-sky-50"
                  >
                    Rules
                  </button>
                </div>
              </div>
          </>
        )}

        {accountChoiceOpen && !signedInUsername && !needsUsername && (
          <div className="fixed inset-0 z-[108] overflow-y-auto bg-slate-950/45 px-4 py-6">
            <div className="flex min-h-full items-center justify-center">
              <div className="w-full max-w-md rounded-[30px] border-[4px] border-sky-200 bg-[linear-gradient(180deg,#ffffff_0%,#f0f9ff_100%)] p-5 shadow-[0_24px_70px_rgba(15,23,42,0.24)] md:p-6">
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
              <div className="w-full max-w-md rounded-[30px] border-[4px] border-sky-200 bg-[linear-gradient(180deg,#ffffff_0%,#f0f9ff_100%)] p-5 shadow-[0_24px_70px_rgba(15,23,42,0.24)] md:p-6">
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
              <div className="w-full max-w-3xl rounded-[30px] border-[4px] border-sky-200 bg-[linear-gradient(180deg,#ffffff_0%,#f0f9ff_100%)] p-5 shadow-[0_24px_70px_rgba(15,23,42,0.24)] md:p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.12em] text-sky-700">
                      Profile
                    </p>
                    <h2 className="mt-2 text-2xl font-black text-sky-900">
                      Customize Your Profile
                    </h2>
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

                  <div className="grid gap-6 md:grid-cols-[240px_1fr]">
                    <div className="space-y-4">
                      <div className="rounded-[26px] border-[3px] border-sky-100 bg-white/90 p-4">
                        <p className="text-[10px] font-black uppercase tracking-[0.1em] text-sky-700">
                          Stats
                        </p>
                        <div className="mt-4 grid gap-3">
                          <div className="rounded-[18px] border border-sky-100 bg-sky-50/70 px-4 py-3 text-left">
                            <p className="text-[10px] font-black uppercase tracking-[0.08em] text-sky-700">
                              Puzzles Submitted
                            </p>
                            <p className="mt-1 text-2xl font-black text-slate-900">
                              {userStats.puzzles_submitted}
                            </p>
                          </div>
                          <div className="rounded-[18px] border border-sky-100 bg-sky-50/70 px-4 py-3 text-left">
                            <p className="text-[10px] font-black uppercase tracking-[0.08em] text-sky-700">
                              Leaderboards Made
                            </p>
                            <p className="mt-1 text-2xl font-black text-slate-900">
                              {userStats.leaderboard_finishes}
                            </p>
                          </div>
                          <div className="rounded-[18px] border border-sky-100 bg-sky-50/70 px-4 py-3 text-left">
                            <p className="text-[10px] font-black uppercase tracking-[0.08em] text-sky-700">
                              Links Created
                            </p>
                            <p className="mt-1 text-2xl font-black text-slate-900">
                              {userStats.links_created}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-5">
                    <div className="rounded-[26px] border-[3px] border-sky-100 bg-white/90 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-[0.1em] text-sky-700">
                            Avatar Studio
                          </p>
                          <p className="mt-1 text-sm font-semibold text-slate-600">
                            Mix styles, background, icon, and border colors to build your look.
                          </p>
                        </div>
                        <span className="rounded-full bg-sky-100 px-2 py-1 text-[10px] font-black uppercase tracking-[0.08em] text-sky-700">
                          {avatarEditorConfig.title}
                        </span>
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2">
                        {[
                          ["style", "Style"],
                          ["background", "Background"],
                          ["icon", "Icon"],
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

                      {avatarOptionPageCount > 1 ? (
                        <div className="mt-3 inline-flex items-center gap-1 rounded-full border border-sky-200 bg-sky-50 px-1 py-1">
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
                      ) : null}

                      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
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
                                className={`rounded-[22px] border-[3px] px-4 py-4 text-center transition ${
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
                                    size="md"
                                  />
                                </div>
                                <p className="mt-3 text-xs font-black uppercase tracking-[0.08em] text-slate-800">
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
                              className={`rounded-[22px] border-[3px] px-4 py-4 text-center transition ${
                                isSelected
                                  ? `${palette.chip} shadow-[0_12px_28px_rgba(56,189,248,0.16)]`
                                  : "border-slate-200 bg-white hover:border-sky-200 hover:bg-sky-50/60"
                              }`}
                            >
                              <div className="flex justify-center">
                                <span
                                  className="inline-flex h-12 w-12 rounded-full border-[4px] shadow-[0_8px_18px_rgba(15,23,42,0.12)]"
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
                                    className={`m-auto inline-flex h-7 w-7 rounded-full ${
                                      avatarEditorTab === "background"
                                        ? `bg-gradient-to-br ${palette.bg}`
                                        : `bg-gradient-to-br ${AVATAR_COLOR_CLASSES[avatarBgDraft].bg}`
                                    }`}
                                  >
                                    <span
                                      className="m-auto h-3 w-3 rounded-full"
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
                              <p className="mt-3 text-xs font-black uppercase tracking-[0.08em] text-slate-800">
                                {formatAvatarOptionLabel(optionKey)}
                              </p>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="rounded-[26px] border-[3px] border-sky-100 bg-white/90 p-4">
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
                          {userBadges.filter((badge) => !badge.manualOnly).length}/
                          {publicBadgeDefinitions.length}
                        </span>
                      </div>
                      {publicBadgeDefinitions.length > galleryPageSize ? (
                        <div className="mt-3 inline-flex items-center gap-1 rounded-full border border-sky-200 bg-sky-50 px-1 py-1">
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
                      ) : null}
                      <div className="mt-4 grid gap-3 md:grid-cols-2">
                        {pagedGalleryBadges.map((badgeDefinition) => {
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
                        })}
                      </div>
                    </div>
                  </div>
                </div>
                </div>

                {(avatarError || badgeError) && (
                  <div className="mt-5 rounded-[18px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-900">
                    {avatarError ?? badgeError}
                  </div>
                )}

                <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => void signOut({ redirect: false })}
                    className="rounded-2xl border-[3px] border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
                  >
                    Sign Out
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleSaveProfile()}
                    disabled={avatarSaving || badgeSaving}
                    className="rounded-2xl border-[3px] border-sky-300 bg-[linear-gradient(180deg,#7dd3fc_0%,#38bdf8_52%,#0ea5e9_100%)] px-5 py-3 text-sm font-bold text-white shadow-[0_10px_0_rgba(56,189,248,0.18),0_14px_28px_rgba(56,189,248,0.24)] transition hover:-translate-y-0.5 hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {avatarSaving || badgeSaving ? "Saving..." : "Save Profile"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {leaderboardOpen && (
          <div className="fixed inset-0 z-[100] overflow-y-auto bg-slate-950/35 px-4 py-6">
            <div className="flex min-h-full items-start justify-center">
              <div className="w-full max-w-lg rounded-[30px] border-[4px] border-amber-200 bg-[linear-gradient(180deg,#ffffff_0%,#fffbeb_100%)] p-5 shadow-[0_24px_70px_rgba(15,23,42,0.24)] md:p-6">
                <div className="sticky top-0 z-10 -mx-1 -mt-1 mb-2 flex items-start justify-between gap-4 bg-[linear-gradient(180deg,#ffffff_0%,#fffbeb_100%)] px-1 pt-1">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.12em] text-amber-700">
                      Trophy Board
                    </p>
                    <h2 className="mt-2 text-2xl font-black tracking-normal text-amber-900">
                      {formatPuzzleDateLabel(selectedDate)} Leaderboard
                    </h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => setLeaderboardOpen(false)}
                    className="rounded-full border-[3px] border-amber-200 bg-white px-3 py-1 text-xs font-black uppercase tracking-[0.08em] text-amber-700"
                  >
                    Close
                  </button>
                </div>

                <div className="mt-5 max-h-[70vh] overflow-y-auto pr-1">
                  {leaderboardError ? (
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
                        <div
                          key={entry.submission_id}
                          className="flex items-center justify-between gap-4 rounded-[18px] border-[3px] border-amber-100 bg-white/90 px-4 py-3"
                        >
                          <div className="min-w-0">
                            <p className="text-[10px] font-black uppercase tracking-[0.08em] text-amber-700">
                              #{index + 1}
                            </p>
                            <p className="mt-1 truncate text-sm font-bold text-slate-900">
                              {entry.display_name}
                            </p>
                          </div>
                          <div className="shrink-0 text-right">
                            <p className="text-[10px] font-black uppercase tracking-[0.08em] text-slate-500">
                              Total Points
                            </p>
                            <p className="mt-1 text-lg font-black text-amber-700">
                              {Number(entry.final_score).toLocaleString(undefined, {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-[18px] border-[3px] border-amber-100 bg-white/85 px-4 py-6 text-center text-sm font-semibold text-slate-600">
                      No leaderboard entries yet for this puzzle.
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
              <div className="w-full max-w-xl rounded-[30px] border-[4px] border-sky-200 bg-[linear-gradient(180deg,#ffffff_0%,#f0f9ff_100%)] p-5 shadow-[0_24px_70px_rgba(15,23,42,0.24)] md:p-6">
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
                  <span className="font-bold text-sky-900">Multiplier:</span>{" "}
                  The multiplier is based on your active links. More links means a bigger boost on top of your base score.
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
                  Once a lineup is submitted, that entry is locked for leaderboard purposes. You can still inspect the puzzle, compare scores, and review the optimal lineup after submitting, but you do not get another official entry for that date.
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

        {!submitted && !rulesOpen && (
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
      </div>
      <style jsx>{`
        .full-link-confetti {
          animation: full-link-burst 1.15s ease-out infinite;
          transform: translate(-50%, -50%);
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
      `}</style>
    </main>
  );
}

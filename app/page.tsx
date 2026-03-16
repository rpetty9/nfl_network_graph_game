"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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

  useEffect(() => {
    if (selectedPlayer) {
      setQuery(getPlayerLabel(selectedPlayer));
    } else {
      setQuery("");
    }
  }, [selectedPlayer, getPlayerLabel]);

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
      inputRef.current?.focus();
      setOpen(true);
    });

    return () => registerFocus(null);
  }, [disabled, registerFocus]);

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

  return (
    <div ref={wrapperRef} className="relative">
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={query}
          disabled={disabled}
          placeholder={placeholder}
          onFocus={() => {
            if (!disabled) {
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

function isSupportedPuzzleDate(dateValue: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(dateValue) && dateValue >= "2026-03-15";
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

export default function HomePage() {
  const todayIso = new Date().toISOString().slice(0, 10);
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
    return normalized && isSupportedPuzzleDate(normalized) ? normalized : todayIso;
  });
  const [nodes, setNodes] = useState<NodeState[]>([]);
  const [initialNodes, setInitialNodes] = useState<NodeState[]>([]);
  const [activeNodeId, setActiveNodeId] = useState(1);
  const [mobileNavigatorOpen, setMobileNavigatorOpen] = useState(true);
  const [submitted, setSubmitted] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showFullLinkConfetti, setShowFullLinkConfetti] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
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

    if ((!urlDate || !isSupportedPuzzleDate(urlDate)) && window.location.pathname !== "/") {
      window.history.replaceState({}, "", "/");
    }
  }, []);

  useEffect(() => {
    if (isSupportedPuzzleDate(selectedDate)) return;
    setSelectedDate(todayIso);

    if (typeof window !== "undefined") {
      window.history.replaceState({}, "", buildPuzzleUrl(todayIso));
    }
  }, [selectedDate, todayIso]);

  useEffect(() => {
    const controller = new AbortController();
    const requestId = ++loadRequestRef.current;

    async function loadData() {
      try {
        setLoading(true);
        setLoadError(null);
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
  }, [selectedDate]);

  useEffect(() => {
    if (typeof window === "undefined" || !selectedDate) return;
    const nextPath = buildPuzzleUrl(selectedDate);
    if (window.location.pathname === nextPath) return;
    window.history.replaceState({}, "", nextPath);
  }, [selectedDate]);

  useEffect(() => {
    const handlePopState = () => {
      const urlDate = getDateFromLocation(window.location);
      if (urlDate && urlDate !== selectedDate) {
        setSelectedDate(urlDate);
      }
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [selectedDate]);

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
  const dateOptions = availableDates
    .filter(
      (dateValue) =>
        isSupportedPuzzleDate(dateValue) && dateValue >= minPuzzleDate
    )
    .sort();
  const renderedDateOptions =
    selectedDate &&
    isSupportedPuzzleDate(selectedDate) &&
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
      const logoSlug = getCollegeLogoSlug(collegeLabel);
      const logoUrl = `https://ncaa-api.henrygd.me/logo/${logoSlug}.svg`;
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
  const canSubmit = allFilled && !duplicatePlayersExist && !submitted;

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

        const saveResponse = await fetch("/api/submissions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            date: selectedDate,
            lineup: nodes.map((node) => ({
              slot_number: node.node_id,
              player_id: Number(node.player_id),
            })),
            optimal_final_score: Number(optimalResult.optimal_final_score),
          }),
          signal: controller.signal,
        });

        if (!saveResponse.ok) {
          const body = await saveResponse.text();
          throw new Error(body || "Failed to save submission");
        }

        const saved: SubmissionResponse = await saveResponse.json();
        if (controller.signal.aborted) return;
        setSubmissionResult(saved);

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

    saveSubmissionAndLoadLeaderboard();
    return () => controller.abort();
  }, [submitted, optimalLineup, selectedDate, nodes]);

  function handleSubmit() {
    if (!canSubmit) return;
    setSubmitted(true);
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
            <div className="relative z-10">
              <h1 className="mt-2 text-2xl font-black tracking-[0.06em] text-white drop-shadow-[0_4px_0_rgba(30,41,59,0.18)] md:mt-6 md:text-5xl md:tracking-[0.08em]">
                Five Wide
              </h1>
              <p className="mx-auto mt-3 max-w-3xl text-[12px] font-semibold leading-[1.4] text-white/90 md:mt-5 md:max-w-4xl md:text-base">
                Pick 5 players, total their fantasy points for the time period, then boost the score with active links.
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
                        window.history.replaceState({}, "", buildPuzzleUrl(nextDate));
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

              <div className="absolute inset-x-4 top-4 z-40 hidden grid-cols-[3fr_4fr_3fr] gap-3 sm:grid">
                <div className="inline-flex min-w-0 items-center justify-center gap-2 rounded-full border-[2px] border-sky-200 bg-white/90 px-4 py-1.5 shadow-[0_6px_16px_rgba(125,211,252,0.14)]">
                  <span className="h-3 w-3 shrink-0 rounded-full bg-lime-400 shadow-[0_0_14px_rgba(74,222,128,0.9)]" />
                  <select
                    value={selectedDate}
                    onChange={(e) => {
                      const nextDate = e.target.value;
                      setSelectedDate(nextDate);
                      if (typeof window !== "undefined") {
                        window.history.replaceState({}, "", buildPuzzleUrl(nextDate));
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

                <div className="group relative inline-flex min-w-0 items-center justify-center gap-1.5 rounded-full border-[2px] border-sky-300 bg-[linear-gradient(180deg,#ffffff_0%,#ecfeff_100%)] px-2 py-1 text-center shadow-[0_6px_18px_rgba(56,189,248,0.16)] sm:gap-2 sm:px-5 sm:py-1.5">
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

                <div className="inline-flex min-w-0 items-center justify-center gap-1.5 rounded-full border-[2px] border-slate-200 bg-white/92 px-2 py-1 text-center shadow-[0_6px_16px_rgba(148,163,184,0.12)] sm:gap-2 sm:px-4 sm:py-1.5">
                  <span className="rounded-full bg-slate-100 px-1.5 py-1 text-[7px] font-black uppercase tracking-[0.08em] text-slate-600 sm:px-2 sm:text-[8px] sm:tracking-[0.1em]">
                    Players
                  </span>
                  <span className="min-w-0 text-[8px] font-black uppercase tracking-[0.04em] text-slate-700 sm:text-[10px] sm:tracking-[0.06em]">
                    {players.length} Available
                  </span>
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

        {rulesOpen && (
          <div className="fixed inset-0 z-[100] overflow-y-auto bg-slate-950/35 px-4 py-6">
            <div className="flex min-h-full items-start justify-center">
              <div className="w-full max-w-xl rounded-[30px] border-[4px] border-sky-200 bg-[linear-gradient(180deg,#ffffff_0%,#f0f9ff_100%)] p-5 shadow-[0_24px_70px_rgba(15,23,42,0.24)] md:p-6">
              <div className="sticky top-0 z-10 -mx-1 -mt-1 mb-2 flex items-start justify-between gap-4 bg-[linear-gradient(180deg,#ffffff_0%,#f0f9ff_100%)] px-1 pt-1">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.12em] text-sky-700">
                    Rules
                  </p>
                  <h2 className="mt-2 text-2xl font-black tracking-normal text-sky-900">
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
                  Fill all 5 slots with unique players and finish with the highest final fantasy score possible.
                </p>
                <p>
                  <span className="font-bold text-sky-900">Time Period:</span>{" "}
                  {puzzleData.theme?.display_name ?? "N/A"} is the season window for the puzzle. Only stats from those seasons count toward each player&apos;s total score.
                </p>
                <p>
                  Time periods are always a specific season or range of seasons, like <span className="font-semibold text-sky-900">2012</span>, <span className="font-semibold text-sky-900">2010s</span>, or <span className="font-semibold text-sky-900">2020-2025</span>. Only production from those years is used.
                </p>
                <p>
                  Each slot can also have its own requirement, like <span className="font-semibold text-sky-900">QB</span>, <span className="font-semibold text-sky-900">WR</span>, a specific <span className="font-semibold text-sky-900">team</span>, or a <span className="font-semibold text-sky-900">conference/division</span>. A player only shows up in that slot if they match the slot rule.
                </p>
                <p>
                  <span className="font-bold text-sky-900">Link:</span>{" "}
                  {relationshipLabel} is the connection rule between two selected players. Each active link increases your bonus, and every additional link is worth more than the last.
                </p>
                <p>
                  Link bonuses stack. More active connections means a bigger multiplier on top of your lineup&apos;s base fantasy points.
                </p>
                <p>
                  <span className="font-bold text-sky-900">Formula:</span>{" "}
                  Final Score = Total Fantasy Points x Link Multiplier.
                </p>
                <p>
                  <span className="font-bold text-sky-900">Available Players:</span>{" "}
                  {players.length}
                </p>
                <p>
                  Example: with the current curve, {activeLinkCount} active links gives you a{" "}
                  <span className="font-semibold text-sky-900">{multiplier.toFixed(2)}x</span> multiplier and a{" "}
                  <span className="font-semibold text-sky-900">+{linkBonusPct.toFixed(1)}%</span> total bonus.
                </p>
                <p>
                  Select five players, activate as many valid links as possible, and submit once every slot is filled.
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

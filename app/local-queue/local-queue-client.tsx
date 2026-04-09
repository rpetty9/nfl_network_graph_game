"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

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

type GeneratorSettings = {
  targetPendingCount: number;
  minActiveLinks: number;
  usageThresholdTotal: number;
  maxQbs: number;
  minFantasyPointsPerSeason: number;
  maxAttemptsPerPuzzle: number;
  forcePositionLock: boolean;
  forceNoQbs: boolean;
  forceNoRbs: boolean;
  forceNoWrs: boolean;
  useAnchorSearch: boolean;
  useSkeletonScoring: boolean;
  useThresholdMemory: boolean;
  anchorCount: number;
  stageWidth: number;
  beamWidth: number;
  lockedStartSeason: number | null;
  lockedEndSeason: number | null;
  lockedRelationshipRuleId: string | null;
  lockedSlotRuleIds: string[];
};

type RunnerSnapshot = {
  running: boolean;
  stopRequested: boolean;
  startedAt: string | null;
  lastHeartbeatAt: string | null;
  finishedAt: string | null;
  statusMessage: string | null;
  lastError: string | null;
  settings: GeneratorSettings | null;
  totalGenerated: number;
  totalAttempts: number;
  totalSearchPasses: number;
  liveCycleAttempts: number;
  liveCycleSearchPass: number;
  cycleCount: number;
  consecutiveMisses: number;
  logs: string[];
};

type QueuePayload = {
  job: {
    settings: GeneratorSettings;
  } | null;
  pendingPuzzles: Array<{ puzzle_id: string; puzzle_date: string; title: string }>;
};

type StatusResponse = {
  runner: RunnerSnapshot;
  meta: {
    nextAvailableDate: string;
    relationships: RelationshipOption[];
    slotRules: SlotRuleOption[];
  };
  queue: QueuePayload;
};

const MIN_SEASON = 2000;
const MAX_SEASON = 2025;

const DEFAULT_SETTINGS: GeneratorSettings = {
  targetPendingCount: 25,
  minActiveLinks: 6,
  usageThresholdTotal: 25,
  maxQbs: 1,
  minFantasyPointsPerSeason: 80,
  maxAttemptsPerPuzzle: 150,
  forcePositionLock: false,
  forceNoQbs: false,
  forceNoRbs: false,
  forceNoWrs: false,
  useAnchorSearch: true,
  useSkeletonScoring: true,
  useThresholdMemory: true,
  anchorCount: 2,
  stageWidth: 8,
  beamWidth: 4,
  lockedStartSeason: null,
  lockedEndSeason: null,
  lockedRelationshipRuleId: null,
  lockedSlotRuleIds: ["", "", "", "", ""],
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

function formatDateTime(value: string | null) {
  if (!value) return "N/A";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString();
}

function buildThemeLabel(startSeason: number, endSeason: number) {
  return startSeason === endSeason
    ? `${startSeason} Season`
    : `${startSeason}-${endSeason} Seasons`;
}

export default function LocalQueueClient() {
  const [settings, setSettings] = useState<GeneratorSettings>(DEFAULT_SETTINGS);
  const [relationships, setRelationships] = useState<RelationshipOption[]>([]);
  const [slotRules, setSlotRules] = useState<SlotRuleOption[]>([]);
  const [startSeason, setStartSeason] = useState(2020);
  const [endSeason, setEndSeason] = useState(2025);
  const [relationshipRuleId, setRelationshipRuleId] = useState("");
  const [slotRuleIds, setSlotRuleIds] = useState<string[]>(["", "", "", "", ""]);
  const [timePeriodLocked, setTimePeriodLocked] = useState(false);
  const [linkTypeLocked, setLinkTypeLocked] = useState(false);
  const [slotLocks, setSlotLocks] = useState<boolean[]>([false, false, false, false, false]);
  const [runner, setRunner] = useState<RunnerSnapshot | null>(null);
  const [queue, setQueue] = useState<QueuePayload | null>(null);
  const [nextAvailableDate, setNextAvailableDate] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [loading, setLoading] = useState(true);
  const [pendingAction, setPendingAction] = useState<"start" | "stop" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<
    "connected" | "reconnecting" | "offline"
  >("connected");
  const [connectionMessage, setConnectionMessage] = useState<string | null>(null);

  const refreshStatus = useCallback(
    async (options?: { syncSettings?: boolean }) => {
      const response = await fetch("/api/local/dev-runner", {
        cache: "no-store",
      });
      const json = (await response.json()) as StatusResponse & { error?: string };
      if (!response.ok) {
        throw new Error(json.error ?? "Failed to load local queue status.");
      }

      setRunner(json.runner);
      setQueue(json.queue);
      setNextAvailableDate(json.meta.nextAvailableDate);
      setRelationships(json.meta.relationships ?? []);
      setSlotRules(json.meta.slotRules ?? []);
      setConnectionStatus("connected");
      setConnectionMessage(null);
      if (options?.syncSettings) {
        const nextSettings = json.runner.settings ?? json.queue.job?.settings ?? DEFAULT_SETTINGS;
        const nextLockedSlotRuleIds =
          nextSettings.lockedSlotRuleIds?.length === 5
            ? nextSettings.lockedSlotRuleIds
            : ["", "", "", "", ""];
        setSettings(nextSettings);
        setStartSeason(nextSettings.lockedStartSeason ?? 2020);
        setEndSeason(nextSettings.lockedEndSeason ?? 2025);
        setRelationshipRuleId(nextSettings.lockedRelationshipRuleId ?? "");
        setSlotRuleIds(nextLockedSlotRuleIds);
        setTimePeriodLocked((current) =>
          current &&
          nextSettings.lockedStartSeason != null &&
          nextSettings.lockedEndSeason != null
        );
        setLinkTypeLocked((current) => current && nextSettings.lockedRelationshipRuleId != null);
        setSlotLocks(nextLockedSlotRuleIds.map((slotRuleId) => slotRuleId.length > 0));
      }
    },
    []
  );

  useEffect(() => {
    void (async () => {
      try {
        setLoading(true);
        setError(null);
        await refreshStatus({ syncSettings: true });
      } catch (loadError) {
        setError((loadError as Error).message);
      } finally {
        setLoading(false);
      }
    })();
  }, [refreshStatus]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      void refreshStatus({ syncSettings: false }).catch((refreshError) => {
        const message = (refreshError as Error).message;
        setConnectionStatus(
          typeof navigator !== "undefined" && navigator.onLine === false
            ? "offline"
            : "reconnecting"
        );
        setConnectionMessage(
          message === "Failed to fetch"
            ? "Local page lost contact with the dev server for a moment. It will keep retrying automatically."
            : message
        );
      });
    }, 3000);

    return () => window.clearInterval(intervalId);
  }, [refreshStatus]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    function handleOnline() {
      setConnectionStatus("reconnecting");
      setConnectionMessage("Connection restored. Refreshing local runner status...");
      void refreshStatus({ syncSettings: false }).catch(() => undefined);
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        handleOnline();
      }
    }

    function handleOffline() {
      setConnectionStatus("offline");
      setConnectionMessage(
        "Browser is offline or suspended. The page will reconnect when your machine wakes back up."
      );
    }

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [refreshStatus]);

  const pendingCount = queue?.pendingPuzzles.length ?? 0;
  const targetCount = runner?.settings?.targetPendingCount ?? settings.targetPendingCount;
  const progressPct = targetCount > 0 ? Math.min((pendingCount / targetCount) * 100, 100) : 0;
  const cycleAttemptLimit = runner?.settings?.maxAttemptsPerPuzzle ?? settings.maxAttemptsPerPuzzle;
  const displayedCurrentAttempts = Math.min(runner?.liveCycleAttempts ?? 0, cycleAttemptLimit);
  const cycleAttemptPct =
    cycleAttemptLimit > 0
      ? Math.min((displayedCurrentAttempts / cycleAttemptLimit) * 100, 100)
      : 0;
  const lastHeartbeatMs = runner?.lastHeartbeatAt
    ? new Date(runner.lastHeartbeatAt).getTime()
    : Number.NaN;
  const heartbeatAgeMs = Number.isFinite(lastHeartbeatMs) ? nowMs - lastHeartbeatMs : Number.POSITIVE_INFINITY;
  const hasFreshHeartbeat = heartbeatAgeMs >= 0 && heartbeatAgeMs <= 15000;
  const hasLiveProgress = (runner?.liveCycleAttempts ?? 0) > 0;
  const isLiveRunning = Boolean(
    runner && ((runner.running && hasFreshHeartbeat) || hasLiveProgress)
  );
  const isStopping = Boolean(runner?.stopRequested) && !isLiveRunning;
  const statusLabel = isLiveRunning ? "Running" : isStopping ? "Stopping" : "Idle";
  const statusMessage =
    runner?.stopRequested && isLiveRunning
      ? "Stop requested. Finishing the current live search before halting."
      : runner?.statusMessage ?? "Waiting for a start command.";
  const currentThemeLabel = buildThemeLabel(startSeason, endSeason);
  const rangeStartPercent = ((startSeason - MIN_SEASON) / (MAX_SEASON - MIN_SEASON)) * 100;
  const rangeEndPercent = ((endSeason - MIN_SEASON) / (MAX_SEASON - MIN_SEASON)) * 100;
  const groupedSlotRules = useMemo(() => {
    const groups = new Map<string, SlotRuleOption[]>();
    for (const rule of slotRules) {
      const items = groups.get(rule.parameter_type) ?? [];
      items.push(rule);
      groups.set(rule.parameter_type, items);
    }

    return Array.from(groups.entries()).map(([group, items]) => [
      group,
      [...items].sort((a, b) => a.display_text.localeCompare(b.display_text)),
    ] as const);
  }, [slotRules]);

  const toggleFields = useMemo(
    () =>
      [
        ["forcePositionLock", "Lock Position Overlay"],
        ["forceNoQbs", "Exclude QBs"],
        ["forceNoRbs", "Exclude RBs"],
        ["forceNoWrs", "Exclude WRs"],
        ["useAnchorSearch", "Use Anchor Search"],
        ["useSkeletonScoring", "Use Skeleton Scoring"],
        ["useThresholdMemory", "Use Threshold Memory"],
      ] as const,
    []
  );

  async function submitAction(action: "start" | "stop") {
    try {
      setPendingAction(action);
      setError(null);
      setConnectionMessage(null);
      const payloadSettings =
        action === "stop"
          ? { action }
          : {
              action,
              ...settings,
              lockedStartSeason: timePeriodLocked ? startSeason : null,
              lockedEndSeason: timePeriodLocked ? endSeason : null,
              lockedRelationshipRuleId: linkTypeLocked ? relationshipRuleId : null,
              lockedSlotRuleIds: slotRuleIds.map((slotRuleId, index) =>
                slotLocks[index] ? slotRuleId : ""
              ),
            };
      const response = await fetch("/api/local/dev-runner", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payloadSettings),
      });
      const json = (await response.json()) as { runner?: RunnerSnapshot; queue?: QueuePayload; error?: string };
      if (!response.ok) {
        throw new Error(json.error ?? "Failed to update local queue runner.");
      }
      if (json.runner) setRunner(json.runner);
      if (json.queue) setQueue(json.queue);
      setConnectionStatus("connected");
      await refreshStatus({ syncSettings: true });
    } catch (actionError) {
      setError((actionError as Error).message);
    } finally {
      setPendingAction(null);
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-8 text-white">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="rounded-[28px] border border-cyan-400/20 bg-slate-900/80 p-6 shadow-[0_24px_80px_rgba(2,6,23,0.45)]">
          <p className="text-[11px] font-black uppercase tracking-[0.2em] text-cyan-300">
            Local Queue Runner
          </p>
          <h1 className="mt-3 text-4xl font-black tracking-tight">Local-Only Puzzle Hunter</h1>
          <p className="mt-3 max-w-3xl text-sm text-slate-300">
            Start this once from your own machine and the local Next.js server will keep
            searching in the background until the pending queue reaches your target. You do
            not need to keep this tab open, but your local dev server and computer must stay
            running.
          </p>
        </div>

        {error ? (
          <div className="rounded-2xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
            {error}
          </div>
        ) : null}

        {connectionMessage ? (
          <div
            className={`rounded-2xl px-4 py-3 text-sm ${
              connectionStatus === "offline"
                ? "border border-amber-400/30 bg-amber-500/10 text-amber-100"
                : connectionStatus === "reconnecting"
                  ? "border border-cyan-400/30 bg-cyan-500/10 text-cyan-100"
                  : "border border-emerald-400/30 bg-emerald-500/10 text-emerald-100"
            }`}
          >
            {connectionMessage}
          </div>
        ) : null}

        <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <section className="rounded-[28px] border border-white/10 bg-slate-900/70 p-6">
            <div className="grid gap-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-300">
                    Runner Settings
                  </p>
                  <p className="mt-2 text-sm text-slate-400">
                    These settings are written into the generator job and used by the local
                    background runner.
                  </p>
                </div>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => void submitAction("start")}
                    disabled={pendingAction === "start" || isLiveRunning || pendingAction === "stop"}
                    className="rounded-full bg-cyan-300 px-5 py-3 text-sm font-black uppercase tracking-[0.12em] text-slate-950 disabled:cursor-wait disabled:opacity-60"
                  >
                    {pendingAction === "start"
                      ? "Working..."
                      : isLiveRunning
                        ? "Runner Active"
                        : "Start Local Runner"}
                  </button>
                  <button
                    type="button"
                    onClick={() => void submitAction("stop")}
                    disabled={pendingAction === "stop" || !isLiveRunning}
                    className="rounded-full border border-white/15 bg-slate-800 px-5 py-3 text-sm font-black uppercase tracking-[0.12em] text-white disabled:opacity-40"
                  >
                    {pendingAction === "stop" ? "Stopping..." : "Stop After Current Search"}
                  </button>
                </div>
              </div>

              <div className="grid gap-5">
                <div className="rounded-[24px] border border-cyan-400/20 bg-cyan-400/10 p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-[11px] font-black uppercase tracking-[0.14em] text-cyan-200">
                        Time Period
                      </p>
                      <p className="mt-2 text-xl font-black text-white">{currentThemeLabel}</p>
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
                        className="local-range-thumb absolute inset-0 z-20 h-12 w-full appearance-none bg-transparent"
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
                        className="local-range-thumb absolute inset-0 z-30 h-12 w-full appearance-none bg-transparent"
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
                    {relationships.map((relationship) => {
                      const active = relationship.relationship_rule_id === relationshipRuleId;
                      return (
                        <button
                          key={relationship.relationship_rule_id}
                          type="button"
                          onClick={() => setRelationshipRuleId(relationship.relationship_rule_id)}
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
                          <p className="text-sm font-black text-white">Slot {index + 1}</p>
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
                                <option key={rule.slot_rule_id} value={rule.slot_rule_id}>
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

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {[
                ["targetPendingCount", "Target Pending Count"],
                ["maxAttemptsPerPuzzle", "Max Attempts Per Puzzle"],
                ["minActiveLinks", "Min Active Links"],
                ["usageThresholdTotal", "Usage Threshold Total"],
                ["maxQbs", "Max QBs In Lineup"],
                ["minFantasyPointsPerSeason", "Min Fantasy Points / Season"],
                ["anchorCount", "Anchor Count"],
                ["stageWidth", "Stage Width"],
                ["beamWidth", "Beam Width"],
              ].map(([field, label]) => (
                <label
                  key={field}
                  className="rounded-2xl border border-white/10 bg-slate-950/40 p-4 text-sm"
                >
                  <span className="text-[11px] font-black uppercase tracking-[0.12em] text-slate-300">
                    {label}
                  </span>
                  <input
                    type="number"
                    value={settings[field as keyof GeneratorSettings] as number}
                    onChange={(event) =>
                      setSettings((current) => ({
                        ...current,
                        [field]: Number(event.target.value),
                      }))
                    }
                    className="mt-3 w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-base text-white outline-none"
                  />
                </label>
              ))}
              </div>

              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {toggleFields.map(([field, label]) => (
                  <label
                    key={field}
                    className="flex items-center justify-between rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3 text-sm"
                  >
                    <span className="font-semibold text-slate-200">{label}</span>
                    <input
                      type="checkbox"
                      checked={Boolean(settings[field])}
                      onChange={(event) =>
                        setSettings((current) => ({
                          ...current,
                          [field]: event.target.checked,
                        }))
                      }
                      className="h-5 w-5 accent-cyan-300"
                    />
                  </label>
                ))}
              </div>
            </div>
          </section>

          <section className="space-y-6">
            <div className="rounded-[28px] border border-white/10 bg-slate-900/70 p-6">
              <p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-300">
                Status
              </p>
              {loading ? (
                <p className="mt-4 text-sm text-slate-400">Loading local runner...</p>
              ) : (
                <>
                  <p className="mt-3 text-3xl font-black text-white">
                    {statusLabel}
                  </p>
                  <p className="mt-2 text-sm text-slate-300">
                    {statusMessage}
                  </p>
                  <div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-800">
                    <div
                      className="h-full rounded-full bg-cyan-300 transition-[width]"
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>
                  <p className="mt-2 text-sm text-slate-400">
                    Pending queue: {pendingCount}/{targetCount}
                  </p>
                  <div className="mt-5 rounded-2xl border border-white/10 bg-slate-950/40 p-4">
                    <p className="text-[11px] font-black uppercase tracking-[0.12em] text-slate-300">
                      This Run
                    </p>
                    <p className="mt-2 text-3xl font-black text-white">
                      {runner?.totalAttempts ?? 0}
                    </p>
                    <p className="mt-1 text-sm text-slate-300">
                      candidate puzzles tried since this runner started
                    </p>
                  </div>
                  <div className="mt-5 rounded-2xl border border-white/10 bg-slate-950/40 p-4">
                    <p className="text-[11px] font-black uppercase tracking-[0.12em] text-slate-300">
                      Current Puzzle Search
                    </p>
                    <div className="mt-3 h-3 overflow-hidden rounded-full bg-slate-800">
                      <div
                        className="h-full rounded-full bg-emerald-300 transition-[width]"
                        style={{ width: `${cycleAttemptPct}%` }}
                      />
                    </div>
                    <p className="mt-2 text-sm text-slate-300">
                      Tried {displayedCurrentAttempts}/{cycleAttemptLimit} candidate puzzles in this live search
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Each attempt is one candidate puzzle configuration checked against your current rules.
                    </p>
                  </div>
                  <div className="mt-4 grid gap-3 text-sm text-slate-300">
                    <p>Next open day: {nextAvailableDate ?? "N/A"}</p>
                    <p>Generated this session: {runner?.totalGenerated ?? 0}</p>
                    <p>Total candidate puzzles tried this session: {runner?.totalAttempts ?? 0}</p>
                    <p>Current live search attempts: {runner?.liveCycleAttempts ?? 0}</p>
                    <p>Completed search windows: {runner?.totalSearchPasses ?? 0}</p>
                    <p>Cycles: {runner?.cycleCount ?? 0}</p>
                    <p>Consecutive misses: {runner?.consecutiveMisses ?? 0}</p>
                    <p>Started: {formatDateTime(runner?.startedAt ?? null)}</p>
                    <p>Last heartbeat: {formatDateTime(runner?.lastHeartbeatAt ?? null)}</p>
                  </div>
                </>
              )}
            </div>

            <div className="rounded-[28px] border border-white/10 bg-slate-900/70 p-6">
              <p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-300">
                Pending Puzzles
              </p>
              <div className="mt-4 space-y-3">
                {(queue?.pendingPuzzles ?? []).length > 0 ? (
                  queue?.pendingPuzzles.map((puzzle) => (
                    <div
                      key={puzzle.puzzle_id}
                      className="rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3"
                    >
                      <p className="text-sm font-bold text-white">{puzzle.title}</p>
                      <p className="mt-1 text-xs uppercase tracking-[0.08em] text-slate-400">
                        {puzzle.puzzle_date}
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-slate-400">No pending puzzles yet.</p>
                )}
              </div>
            </div>
          </section>
        </div>

        <section className="rounded-[28px] border border-white/10 bg-slate-900/70 p-6">
          <p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-300">
            Runner Log
          </p>
          <div className="mt-4 max-h-[28rem] overflow-y-auto rounded-2xl border border-white/10 bg-slate-950/50 p-4">
            {(runner?.logs ?? []).length > 0 ? (
              <div className="space-y-2 font-mono text-xs text-slate-300">
                {runner?.logs.map((line, index) => (
                  <p key={`${line}-${index}`}>{line}</p>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-400">No log lines yet.</p>
            )}
          </div>
        </section>
      </div>
      <style jsx>{`
        .local-range-thumb::-webkit-slider-thumb {
          appearance: none;
          pointer-events: auto;
          height: 22px;
          width: 22px;
          border-radius: 9999px;
          border: 2px solid rgba(255, 255, 255, 0.92);
          background: transparent;
          cursor: grab;
        }

        .local-range-thumb::-moz-range-thumb {
          pointer-events: auto;
          height: 22px;
          width: 22px;
          border-radius: 9999px;
          border: 2px solid rgba(255, 255, 255, 0.92);
          background: transparent;
          cursor: grab;
        }

        .local-range-thumb::-webkit-slider-runnable-track {
          height: 48px;
          background: transparent;
        }

        .local-range-thumb::-moz-range-track {
          height: 48px;
          background: transparent;
        }
      `}</style>
    </main>
  );
}

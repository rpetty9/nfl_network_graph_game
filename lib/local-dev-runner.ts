import { pool } from "@/lib/db";
import { existsSync, readFileSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  getDevApprovalQueue,
  processDevGeneratorJobs,
  sanitizeGeneratorSettings,
  upsertDevGeneratorJob,
  type DevGeneratorSettings,
} from "@/lib/dev-puzzle";

type RunnerSnapshot = {
  running: boolean;
  stopRequested: boolean;
  startedAt: string | null;
  lastHeartbeatAt: string | null;
  finishedAt: string | null;
  statusMessage: string | null;
  lastError: string | null;
  settings: DevGeneratorSettings | null;
  totalGenerated: number;
  totalAttempts: number;
  totalSearchPasses: number;
  liveCycleAttempts: number;
  liveCycleSearchPass: number;
  cycleCount: number;
  consecutiveMisses: number;
  logs: string[];
};

type RunnerStore = RunnerSnapshot & {
  loopPromise: Promise<void> | null;
  lastPersistedAtMs: number;
};

const MAX_LOG_LINES = 160;
const RUNNER_STATE_PATH = path.join(process.cwd(), ".next", "local-dev-runner-state.json");

const globalForLocalRunner = globalThis as typeof globalThis & {
  __fiveWideLocalRunner?: RunnerStore;
};

function createInitialStore(): RunnerStore {
  return {
    running: false,
    stopRequested: false,
    startedAt: null,
    lastHeartbeatAt: null,
    finishedAt: null,
    statusMessage: null,
    lastError: null,
    settings: null,
    totalGenerated: 0,
    totalAttempts: 0,
    totalSearchPasses: 0,
    liveCycleAttempts: 0,
    liveCycleSearchPass: 0,
    cycleCount: 0,
    consecutiveMisses: 0,
    logs: [],
    loopPromise: null,
    lastPersistedAtMs: 0,
  };
}

function getStore() {
  if (!globalForLocalRunner.__fiveWideLocalRunner) {
    globalForLocalRunner.__fiveWideLocalRunner = createInitialStore();
  }

  return globalForLocalRunner.__fiveWideLocalRunner;
}

function addLog(message: string) {
  const store = getStore();
  const timestamp = new Date().toISOString();
  store.logs = [`${timestamp} ${message}`, ...store.logs].slice(0, MAX_LOG_LINES);
}

function buildSnapshot(store: RunnerStore): RunnerSnapshot {
  return {
    running: store.running,
    stopRequested: store.stopRequested,
    startedAt: store.startedAt,
    lastHeartbeatAt: store.lastHeartbeatAt,
    finishedAt: store.finishedAt,
    statusMessage: store.statusMessage,
    lastError: store.lastError,
    settings: store.settings,
    totalGenerated: store.totalGenerated,
    totalAttempts: store.totalAttempts,
    totalSearchPasses: store.totalSearchPasses,
    liveCycleAttempts: store.liveCycleAttempts,
    liveCycleSearchPass: store.liveCycleSearchPass,
    cycleCount: store.cycleCount,
    consecutiveMisses: store.consecutiveMisses,
    logs: [...store.logs],
  };
}

async function normalizeStoreState(store: RunnerStore) {
  if (store.running && !store.loopPromise) {
    store.running = false;
    store.stopRequested = false;
    store.liveCycleAttempts = 0;
    store.liveCycleSearchPass = 0;
    store.finishedAt = new Date().toISOString();
    store.statusMessage =
      "Runner was interrupted before completion. Start it again to resume local searching.";
    addLog("Recovered stale runner state after a dev server restart or interrupted local process.");
    await persistStore(true);
  }
}

async function persistStore(force = false) {
  const store = getStore();
  const now = Date.now();
  if (!force && now - store.lastPersistedAtMs < 750) {
    return;
  }

  store.lastPersistedAtMs = now;
  await mkdir(path.dirname(RUNNER_STATE_PATH), { recursive: true });
  await writeFile(RUNNER_STATE_PATH, JSON.stringify(buildSnapshot(store), null, 2), "utf8");
}

async function hydrateStoreFromDisk() {
  const store = getStore();
  const shouldReadFromDisk = !(
    store.running ||
    store.loopPromise ||
    store.startedAt ||
    store.logs.length > 0 ||
    store.settings
  );

  if (!shouldReadFromDisk) {
    await normalizeStoreState(store);
    return store;
  }

  try {
    const raw = await readFile(RUNNER_STATE_PATH, "utf8");
    const snapshot = JSON.parse(raw) as Partial<RunnerSnapshot>;
    store.running = Boolean(snapshot.running);
    store.stopRequested = Boolean(snapshot.stopRequested);
    store.startedAt = snapshot.startedAt ?? null;
    store.lastHeartbeatAt = snapshot.lastHeartbeatAt ?? null;
    store.finishedAt = snapshot.finishedAt ?? null;
    store.statusMessage = snapshot.statusMessage ?? null;
    store.lastError = snapshot.lastError ?? null;
    store.settings = (snapshot.settings as DevGeneratorSettings | null | undefined) ?? null;
    store.totalGenerated = Number(snapshot.totalGenerated ?? 0);
    store.totalAttempts = Number(snapshot.totalAttempts ?? 0);
    store.totalSearchPasses = Number(snapshot.totalSearchPasses ?? 0);
    store.liveCycleAttempts = Number(snapshot.liveCycleAttempts ?? 0);
    store.liveCycleSearchPass = Number(snapshot.liveCycleSearchPass ?? 0);
    store.cycleCount = Number(snapshot.cycleCount ?? 0);
    store.consecutiveMisses = Number(snapshot.consecutiveMisses ?? 0);
    store.logs = Array.isArray(snapshot.logs)
      ? snapshot.logs.map((line) => String(line)).slice(0, MAX_LOG_LINES)
      : [];
  } catch {
    return store;
  }

  await normalizeStoreState(store);

  return store;
}

async function syncStopRequestFromDisk() {
  try {
    const raw = await readFile(RUNNER_STATE_PATH, "utf8");
    const snapshot = JSON.parse(raw) as Partial<RunnerSnapshot>;
    if (snapshot.stopRequested) {
      getStore().stopRequested = true;
    }
  } catch {
    return;
  }
}

function isStopRequestedNow() {
  const store = getStore();
  if (store.stopRequested) {
    return true;
  }

  try {
    if (!existsSync(RUNNER_STATE_PATH)) {
      return false;
    }
    const raw = readFileSync(RUNNER_STATE_PATH, "utf8");
    const snapshot = JSON.parse(raw) as Partial<RunnerSnapshot>;
    if (snapshot.stopRequested) {
      store.stopRequested = true;
      return true;
    }
  } catch {
    return store.stopRequested;
  }

  return false;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runLoop() {
  const store = getStore();

  while (!store.stopRequested) {
    await syncStopRequestFromDisk();
    if (store.stopRequested) {
      break;
    }
    store.lastHeartbeatAt = new Date().toISOString();
    store.cycleCount += 1;
    await persistStore(true);

    try {
      const result = await processDevGeneratorJobs(pool, {
        force: true,
        maxGenerate: 1,
        onProgress: (progress) => {
          store.lastHeartbeatAt = new Date().toISOString();
          store.liveCycleAttempts = Number(progress.attempts ?? 0);
          store.liveCycleSearchPass = Number(progress.searchPass ?? 0);
          store.statusMessage =
            progress.generated > 0
              ? `Searching for puzzle ${progress.generated + 1} of ${progress.targetThisRun}...`
              : "Testing candidate parameter sets...";
          void persistStore();
        },
        shouldStop: () => isStopRequestedNow(),
      });
      const queue = await getDevApprovalQueue(pool);
      store.liveCycleAttempts = 0;
      store.liveCycleSearchPass = 0;
      store.totalAttempts += Number(result.attempts ?? 0);
      store.totalSearchPasses += Number(result.searchPasses ?? 0);

      if ((result.generated ?? 0) > 0) {
        store.totalGenerated += Number(result.generated ?? 0);
        store.consecutiveMisses = 0;
        store.statusMessage = `Generated ${result.generated} puzzle${result.generated === 1 ? "" : "s"} this cycle.`;
        addLog(
          `Queued ${result.generated} puzzle${result.generated === 1 ? "" : "s"} this cycle after ${Number(result.attempts ?? 0)} attempts; pending queue is now ${queue.pendingPuzzles.length}/${store.settings?.targetPendingCount ?? "?"}.`
        );
      } else {
        store.consecutiveMisses += 1;
        store.statusMessage = result.reason ?? "No puzzle generated this cycle.";
        addLog(
          `No puzzle generated this cycle after ${Number(result.attempts ?? 0)} attempts (${store.consecutiveMisses} miss${store.consecutiveMisses === 1 ? "" : "es"} in a row). ${result.reason ?? ""}`.trim()
        );
      }
      await persistStore(true);

      if (
        store.settings &&
        queue.pendingPuzzles.length >= store.settings.targetPendingCount
      ) {
        store.stopRequested = true;
        store.statusMessage = `Target reached: ${queue.pendingPuzzles.length}/${store.settings.targetPendingCount} pending puzzles ready.`;
        addLog(store.statusMessage);
        await persistStore(true);
        break;
      }
    } catch (error) {
      store.lastError = error instanceof Error ? error.message : "Runner failed.";
      store.statusMessage = "Runner stopped due to an error.";
      addLog(`Runner error: ${store.lastError}`);
      store.stopRequested = true;
      await persistStore(true);
      break;
    }

    await sleep(1000);
  }

  store.running = false;
  store.finishedAt = new Date().toISOString();
  store.loopPromise = null;
  if (!store.lastError && !store.statusMessage) {
    store.statusMessage = "Runner stopped.";
  }
  await persistStore(true);
}

export async function getLocalRunnerSnapshot(): Promise<RunnerSnapshot> {
  const store = await hydrateStoreFromDisk();
  return buildSnapshot(store);
}

export async function startLocalRunner(
  input: Partial<DevGeneratorSettings>
): Promise<RunnerSnapshot> {
  const store = await hydrateStoreFromDisk();

  if (store.loopPromise) {
    store.stopRequested = true;
    await persistStore(true);
    await store.loopPromise.catch(() => undefined);
  }

  const settings = sanitizeGeneratorSettings(input);
  await upsertDevGeneratorJob(pool, {
    ...settings,
    active_flag: false,
  });
  store.running = true;
  store.stopRequested = false;
  store.startedAt = new Date().toISOString();
  store.lastHeartbeatAt = store.startedAt;
  store.finishedAt = null;
  store.statusMessage = "Local queue runner started.";
  store.lastError = null;
  store.settings = settings;
  store.totalGenerated = 0;
  store.totalAttempts = 0;
  store.totalSearchPasses = 0;
  store.liveCycleAttempts = 0;
  store.liveCycleSearchPass = 0;
  store.cycleCount = 0;
  store.consecutiveMisses = 0;
  store.logs = [];
  addLog(
    `Started local queue runner with target=${settings.targetPendingCount}, maxAttempts=${settings.maxAttemptsPerPuzzle}, positionLock=${settings.forcePositionLock}, noQBs=${settings.forceNoQbs}, noRBs=${settings.forceNoRbs}, noWRs=${settings.forceNoWrs}.`
  );
  await persistStore(true);

  store.loopPromise = runLoop();
  return buildSnapshot(store);
}

export async function stopLocalRunner(): Promise<RunnerSnapshot> {
  const store = await hydrateStoreFromDisk();
  store.stopRequested = true;
  store.statusMessage = "Stop requested. The runner will stop after the current cycle.";
  addLog(store.statusMessage);
  await persistStore(true);
  return buildSnapshot(store);
}

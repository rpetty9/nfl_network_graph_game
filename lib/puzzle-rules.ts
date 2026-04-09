export const CORE_LINEUP_POSITIONS = ["QB", "RB", "WR", "TE"] as const;
export const FLEX_ELIGIBLE_POSITIONS = ["RB", "WR", "TE"] as const;

export type PuzzleRuleOptions = {
  positionLockEnabled: boolean;
  qbExclusionEnabled: boolean;
  rbExclusionEnabled: boolean;
  wrExclusionEnabled: boolean;
};

export function normalizePrimaryPosition(position: string | null | undefined) {
  return String(position ?? "").trim().toUpperCase();
}

export function playerAllowedByPuzzleRules(
  position: string | null | undefined,
  options: PuzzleRuleOptions
) {
  const normalized = normalizePrimaryPosition(position);
  if (!normalized) return false;
  if (options.qbExclusionEnabled && normalized === "QB") return false;
  if (options.rbExclusionEnabled && normalized === "RB") return false;
  if (options.wrExclusionEnabled && normalized === "WR") return false;
  return ["QB", "RB", "WR", "TE"].includes(normalized);
}

function countPositions(positions: Array<string | null | undefined>) {
  return positions.reduce<Record<string, number>>((counts, position) => {
    const normalized = normalizePrimaryPosition(position);
    if (!normalized) return counts;
    counts[normalized] = (counts[normalized] ?? 0) + 1;
    return counts;
  }, {});
}

export function lineupSatisfiesPuzzleRules(
  positions: Array<string | null | undefined>,
  options: PuzzleRuleOptions
) {
  if (options.qbExclusionEnabled && positions.some((position) => normalizePrimaryPosition(position) === "QB")) {
    return false;
  }
  if (options.rbExclusionEnabled && positions.some((position) => normalizePrimaryPosition(position) === "RB")) {
    return false;
  }
  if (options.wrExclusionEnabled && positions.some((position) => normalizePrimaryPosition(position) === "WR")) {
    return false;
  }

  if (!options.positionLockEnabled) {
    return positions.every((position) => playerAllowedByPuzzleRules(position, options));
  }

  if (options.qbExclusionEnabled || options.rbExclusionEnabled || options.wrExclusionEnabled) {
    return false;
  }

  const counts = countPositions(positions);
  return (
    positions.length === 5 &&
    (counts.QB ?? 0) === 1 &&
    (counts.RB ?? 0) >= 1 &&
    (counts.WR ?? 0) >= 1 &&
    (counts.TE ?? 0) >= 1 &&
    Object.entries(counts).every(([position, count]) => {
      if (position === "QB") return count <= 1;
      if (FLEX_ELIGIBLE_POSITIONS.includes(position as (typeof FLEX_ELIGIBLE_POSITIONS)[number])) {
        return count <= 2;
      }
      return false;
    })
  );
}

export function partialLineupCanStillSatisfyPuzzleRules(
  positions: Array<string | null | undefined>,
  remainingSlots: number,
  options: PuzzleRuleOptions
) {
  const normalized = positions.map((position) => normalizePrimaryPosition(position));

  if (!normalized.every((position) => playerAllowedByPuzzleRules(position, options))) {
    return false;
  }

  if (!options.positionLockEnabled) {
    return true;
  }

  if (options.qbExclusionEnabled || options.rbExclusionEnabled || options.wrExclusionEnabled) {
    return false;
  }

  const counts = countPositions(normalized);
  if ((counts.QB ?? 0) > 1 || (counts.RB ?? 0) > 2 || (counts.WR ?? 0) > 2 || (counts.TE ?? 0) > 2) {
    return false;
  }

  const requiredStillMissing =
    ((counts.QB ?? 0) >= 1 ? 0 : 1) +
    ((counts.RB ?? 0) >= 1 ? 0 : 1) +
    ((counts.WR ?? 0) >= 1 ? 0 : 1) +
    ((counts.TE ?? 0) >= 1 ? 0 : 1);

  return remainingSlots >= requiredStillMissing;
}

const TEAM_ABBR_ALIASES: Record<string, string> = {
  ARI: "ARI",
  ARZ: "ARI",
  ATL: "ATL",
  BAL: "BAL",
  BLT: "BAL",
  BUF: "BUF",
  CAR: "CAR",
  CHI: "CHI",
  CIN: "CIN",
  CLE: "CLE",
  CLV: "CLE",
  DAL: "DAL",
  DEN: "DEN",
  DET: "DET",
  GB: "GB",
  GNB: "GB",
  HOU: "HOU",
  HST: "HOU",
  IND: "IND",
  JAC: "JAX",
  JAX: "JAX",
  KC: "KC",
  KAN: "KC",
  LA: "LAR",
  LAR: "LAR",
  LV: "LV",
  LVR: "LV",
  OAK: "LV",
  LAC: "LAC",
  SD: "LAC",
  MIA: "MIA",
  MIN: "MIN",
  NE: "NE",
  NWE: "NE",
  NO: "NO",
  NOR: "NO",
  NYG: "NYG",
  NYJ: "NYJ",
  PHI: "PHI",
  PIT: "PIT",
  SEA: "SEA",
  SF: "SF",
  SFO: "SF",
  SL: "LAR",
  STL: "LAR",
  TB: "TB",
  TAM: "TB",
  TEN: "TEN",
  WAS: "WAS",
  WFT: "WAS",
  WSH: "WAS",
};

const TEAM_ABBR_SQL_CASE = Object.entries(TEAM_ABBR_ALIASES)
  .sort(([left], [right]) => left.localeCompare(right))
  .map(([alias, canonical]) => `      WHEN '${alias}' THEN '${canonical}'`)
  .join("\n");

export function canonicalizeTeamAbbr(value: string | null | undefined): string | null {
  const normalized = value?.trim().toUpperCase();
  if (!normalized) return null;
  return TEAM_ABBR_ALIASES[normalized] ?? normalized;
}

export function teamAbbrMatches(
  left: string | null | undefined,
  right: string | null | undefined
): boolean {
  const normalizedLeft = canonicalizeTeamAbbr(left);
  const normalizedRight = canonicalizeTeamAbbr(right);
  return normalizedLeft !== null && normalizedLeft === normalizedRight;
}

export function canonicalTeamAbbrSql(columnRef: string): string {
  return `COALESCE(
    CASE UPPER(${columnRef})
${TEAM_ABBR_SQL_CASE}
    END,
    UPPER(${columnRef})
  )`;
}

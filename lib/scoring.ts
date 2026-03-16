export function getLinkBonusPct(activeLinks: number, baseBonusPct = 5): number {
  const links = Math.max(0, activeLinks);
  const base = Number(baseBonusPct) || 0;
  const step = base / 5;

  return base * links + step * ((links * (links - 1)) / 2);
}

export function getLinkMultiplier(
  activeLinks: number,
  baseBonusPct = 5
): number {
  return 1 + getLinkBonusPct(activeLinks, baseBonusPct) / 100;
}

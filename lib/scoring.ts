export function getLinkBonusPct(activeLinks: number, bonusPerLinkPct = 20): number {
  const links = Math.max(0, Math.min(activeLinks, 10));
  const perLink = Number(bonusPerLinkPct) || 0;
  return links * perLink;
}

export function getLinkMultiplier(
  activeLinks: number,
  bonusPerLinkPct = 20
): number {
  return 1 + getLinkBonusPct(activeLinks, bonusPerLinkPct) / 100;
}

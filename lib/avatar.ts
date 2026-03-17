export const AVATAR_STYLES = ["helmet", "star", "bolt", "crest"] as const;
export type AvatarStyle = (typeof AVATAR_STYLES)[number];

export const AVATAR_COLORS = [
  "sky",
  "emerald",
  "amber",
  "rose",
  "slate",
  "violet",
] as const;
export type AvatarColor = (typeof AVATAR_COLORS)[number];

export const DEFAULT_AVATAR: {
  style: AvatarStyle;
  bg: AvatarColor;
  accent: AvatarColor;
} = {
  style: "helmet",
  bg: "sky",
  accent: "amber",
};

export const AVATAR_COLOR_CLASSES: Record<
  AvatarColor,
  { bg: string; accent: string; ring: string; chip: string }
> = {
  sky: {
    bg: "from-sky-400 to-cyan-300",
    accent: "text-sky-950",
    ring: "ring-sky-200",
    chip: "bg-sky-100 text-sky-800 border-sky-200",
  },
  emerald: {
    bg: "from-emerald-400 to-lime-300",
    accent: "text-emerald-950",
    ring: "ring-emerald-200",
    chip: "bg-emerald-100 text-emerald-800 border-emerald-200",
  },
  amber: {
    bg: "from-amber-300 to-yellow-200",
    accent: "text-amber-950",
    ring: "ring-amber-200",
    chip: "bg-amber-100 text-amber-800 border-amber-200",
  },
  rose: {
    bg: "from-rose-400 to-pink-300",
    accent: "text-rose-950",
    ring: "ring-rose-200",
    chip: "bg-rose-100 text-rose-800 border-rose-200",
  },
  slate: {
    bg: "from-slate-500 to-slate-300",
    accent: "text-slate-950",
    ring: "ring-slate-200",
    chip: "bg-slate-100 text-slate-800 border-slate-200",
  },
  violet: {
    bg: "from-violet-400 to-fuchsia-300",
    accent: "text-violet-950",
    ring: "ring-violet-200",
    chip: "bg-violet-100 text-violet-800 border-violet-200",
  },
};

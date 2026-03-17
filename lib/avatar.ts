export const AVATAR_STYLES = [
  "helmet",
  "star",
  "bolt",
  "crest",
  "crown",
  "diamond",
  "comet",
  "target",
  "orbit",
  "flame",
  "moon",
  "prism",
] as const;
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
  border: AvatarColor;
} = {
  style: "helmet",
  bg: "sky",
  accent: "amber",
  border: "slate",
};

export const AVATAR_COLOR_CLASSES: Record<
  AvatarColor,
  {
    bg: string;
    accent: string;
    chip: string;
    iconHex: string;
    borderHex: string;
    borderSoft: string;
  }
> = {
  sky: {
    bg: "from-sky-400 to-cyan-300",
    accent: "text-sky-950",
    chip: "bg-sky-100 text-sky-800 border-sky-200",
    iconHex: "#0ea5e9",
    borderHex: "#0284c7",
    borderSoft: "#bae6fd",
  },
  emerald: {
    bg: "from-emerald-400 to-lime-300",
    accent: "text-emerald-950",
    chip: "bg-emerald-100 text-emerald-800 border-emerald-200",
    iconHex: "#10b981",
    borderHex: "#059669",
    borderSoft: "#a7f3d0",
  },
  amber: {
    bg: "from-amber-300 to-yellow-200",
    accent: "text-amber-950",
    chip: "bg-amber-100 text-amber-800 border-amber-200",
    iconHex: "#f59e0b",
    borderHex: "#d97706",
    borderSoft: "#fde68a",
  },
  rose: {
    bg: "from-rose-400 to-pink-300",
    accent: "text-rose-950",
    chip: "bg-rose-100 text-rose-800 border-rose-200",
    iconHex: "#f43f5e",
    borderHex: "#e11d48",
    borderSoft: "#fecdd3",
  },
  slate: {
    bg: "from-slate-500 to-slate-300",
    accent: "text-slate-950",
    chip: "bg-slate-100 text-slate-800 border-slate-200",
    iconHex: "#334155",
    borderHex: "#475569",
    borderSoft: "#cbd5e1",
  },
  violet: {
    bg: "from-violet-400 to-fuchsia-300",
    accent: "text-violet-950",
    chip: "bg-violet-100 text-violet-800 border-violet-200",
    iconHex: "#8b5cf6",
    borderHex: "#7c3aed",
    borderSoft: "#ddd6fe",
  },
};

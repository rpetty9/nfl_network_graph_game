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
  "phoenix",
  "nova",
  "rocket",
  "shieldstar",
] as const;
export type AvatarStyle = (typeof AVATAR_STYLES)[number];

export const AVATAR_COLORS = [
  "sky",
  "teal",
  "emerald",
  "lime",
  "amber",
  "orange",
  "red",
  "rose",
  "pink",
  "slate",
  "indigo",
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
  teal: {
    bg: "from-teal-400 to-cyan-300",
    accent: "text-teal-950",
    chip: "bg-teal-100 text-teal-800 border-teal-200",
    iconHex: "#14b8a6",
    borderHex: "#0f766e",
    borderSoft: "#99f6e4",
  },
  emerald: {
    bg: "from-emerald-400 to-lime-300",
    accent: "text-emerald-950",
    chip: "bg-emerald-100 text-emerald-800 border-emerald-200",
    iconHex: "#10b981",
    borderHex: "#059669",
    borderSoft: "#a7f3d0",
  },
  lime: {
    bg: "from-lime-400 to-green-300",
    accent: "text-lime-950",
    chip: "bg-lime-100 text-lime-800 border-lime-200",
    iconHex: "#84cc16",
    borderHex: "#65a30d",
    borderSoft: "#d9f99d",
  },
  amber: {
    bg: "from-amber-300 to-yellow-200",
    accent: "text-amber-950",
    chip: "bg-amber-100 text-amber-800 border-amber-200",
    iconHex: "#f59e0b",
    borderHex: "#d97706",
    borderSoft: "#fde68a",
  },
  orange: {
    bg: "from-orange-400 to-amber-300",
    accent: "text-orange-950",
    chip: "bg-orange-100 text-orange-800 border-orange-200",
    iconHex: "#f97316",
    borderHex: "#ea580c",
    borderSoft: "#fdba74",
  },
  red: {
    bg: "from-red-500 to-orange-300",
    accent: "text-red-950",
    chip: "bg-red-100 text-red-800 border-red-200",
    iconHex: "#ef4444",
    borderHex: "#dc2626",
    borderSoft: "#fecaca",
  },
  rose: {
    bg: "from-rose-400 to-pink-300",
    accent: "text-rose-950",
    chip: "bg-rose-100 text-rose-800 border-rose-200",
    iconHex: "#f43f5e",
    borderHex: "#e11d48",
    borderSoft: "#fecdd3",
  },
  pink: {
    bg: "from-pink-400 to-fuchsia-300",
    accent: "text-pink-950",
    chip: "bg-pink-100 text-pink-800 border-pink-200",
    iconHex: "#ec4899",
    borderHex: "#db2777",
    borderSoft: "#fbcfe8",
  },
  slate: {
    bg: "from-slate-500 to-slate-300",
    accent: "text-slate-950",
    chip: "bg-slate-100 text-slate-800 border-slate-200",
    iconHex: "#334155",
    borderHex: "#475569",
    borderSoft: "#cbd5e1",
  },
  indigo: {
    bg: "from-indigo-500 to-blue-300",
    accent: "text-indigo-950",
    chip: "bg-indigo-100 text-indigo-800 border-indigo-200",
    iconHex: "#6366f1",
    borderHex: "#4f46e5",
    borderSoft: "#c7d2fe",
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

export const HIGHLIGHT_COLORS = ["yellow", "green", "blue", "pink"] as const;
export type HighlightColor = (typeof HIGHLIGHT_COLORS)[number];

export const COLOR_MAP: Record<HighlightColor, string> = {
  yellow: "bg-yellow-200/50",
  green: "bg-green-200/50",
  blue: "bg-blue-200/50",
  pink: "bg-pink-200/50",
};

export const COLOR_SWATCHES: Record<HighlightColor, string> = {
  yellow: "bg-yellow-300",
  green: "bg-green-300",
  blue: "bg-blue-300",
  pink: "bg-pink-300",
};

export const COLOR_DOTS: Record<HighlightColor, string> = {
  yellow: "bg-yellow-400",
  green: "bg-green-400",
  blue: "bg-blue-400",
  pink: "bg-pink-400",
};

export function isHighlightColor(value: string): value is HighlightColor {
  return (HIGHLIGHT_COLORS as readonly string[]).includes(value);
}

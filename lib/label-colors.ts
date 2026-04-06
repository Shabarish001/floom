// Pre-defined label color mapping. Each label gets a subtle bg + text color pair.
// Uses Tailwind classes for consistency with the rest of the UI.

export const SUGGESTED_LABELS = [
  "data",
  "scraping",
  "reporting",
  "email",
  "api",
  "scheduling",
  "pdf",
  "ai",
] as const;

export type SuggestedLabel = (typeof SUGGESTED_LABELS)[number];

export const LABEL_COLORS: Record<string, { bg: string; text: string }> = {
  data: { bg: "bg-blue-100 dark:bg-blue-950", text: "text-blue-700 dark:text-blue-300" },
  scraping: { bg: "bg-amber-100 dark:bg-amber-950", text: "text-amber-700 dark:text-amber-300" },
  reporting: { bg: "bg-purple-100 dark:bg-purple-950", text: "text-purple-700 dark:text-purple-300" },
  email: { bg: "bg-pink-100 dark:bg-pink-950", text: "text-pink-700 dark:text-pink-300" },
  api: { bg: "bg-emerald-100 dark:bg-emerald-950", text: "text-emerald-700 dark:text-emerald-300" },
  scheduling: { bg: "bg-orange-100 dark:bg-orange-950", text: "text-orange-700 dark:text-orange-300" },
  pdf: { bg: "bg-red-100 dark:bg-red-950", text: "text-red-700 dark:text-red-300" },
  ai: { bg: "bg-violet-100 dark:bg-violet-950", text: "text-violet-700 dark:text-violet-300" },
  _default: { bg: "bg-gray-100 dark:bg-gray-900", text: "text-gray-700 dark:text-gray-300" },
};

export function getLabelColor(label: string) {
  return LABEL_COLORS[label] ?? LABEL_COLORS._default;
}

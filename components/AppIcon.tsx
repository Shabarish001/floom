"use client";

import { Box } from "lucide-react";
import { cn } from "@/lib/utils";

const PASTEL_COLORS = [
  { bg: "bg-blue-100", text: "text-blue-700" },
  { bg: "bg-emerald-100", text: "text-emerald-700" },
  { bg: "bg-purple-100", text: "text-purple-700" },
  { bg: "bg-pink-100", text: "text-pink-700" },
  { bg: "bg-amber-100", text: "text-amber-700" },
  { bg: "bg-cyan-100", text: "text-cyan-700" },
  { bg: "bg-rose-100", text: "text-rose-700" },
  { bg: "bg-indigo-100", text: "text-indigo-700" },
];

function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

type AppIconProps = {
  name: string;
  iconSeed?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
};

const sizeMap = {
  sm: { container: "size-8", textSize: "text-xs" },
  md: { container: "size-10", textSize: "text-sm" },
  lg: { container: "size-16", textSize: "text-xl" },
};

export function AppIcon({ name, iconSeed, size = "md", className }: AppIconProps) {
  if (!name) {
    const { container } = sizeMap[size];
    return (
      <div
        className={cn(
          "flex items-center justify-center rounded-xl bg-gray-100",
          container,
          className
        )}
      >
        <Box size={size === "lg" ? 28 : size === "sm" ? 14 : 18} className="text-gray-400" />
      </div>
    );
  }

  const seedStr = iconSeed ?? name;
  const hash = hashCode(seedStr);
  const color = PASTEL_COLORS[hash % PASTEL_COLORS.length];
  const { container, textSize } = sizeMap[size];
  const initial = name.charAt(0).toUpperCase();

  return (
    <div
      className={cn(
        "flex items-center justify-center rounded-xl font-semibold",
        color.bg,
        color.text,
        container,
        textSize,
        className
      )}
    >
      {initial}
    </div>
  );
}

"use client";

import { Box } from "lucide-react";
import { cn } from "@/lib/utils";

const PASTEL_COLORS = [
  { bg: "bg-blue-100", ring: "ring-blue-200" },
  { bg: "bg-green-100", ring: "ring-green-200" },
  { bg: "bg-purple-100", ring: "ring-purple-200" },
  { bg: "bg-pink-100", ring: "ring-pink-200" },
  { bg: "bg-amber-100", ring: "ring-amber-200" },
  { bg: "bg-cyan-100", ring: "ring-cyan-200" },
  { bg: "bg-rose-100", ring: "ring-rose-200" },
  { bg: "bg-indigo-100", ring: "ring-indigo-200" },
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
  size?: "sm" | "md" | "lg";
  className?: string;
};

const sizeMap = {
  sm: { container: "size-8", img: 24, fallback: 14 },
  md: { container: "size-10", img: 32, fallback: 18 },
  lg: { container: "size-16", img: 52, fallback: 28 },
};

export function AppIcon({ name, size = "md", className }: AppIconProps) {
  if (!name) {
    const { container, fallback } = sizeMap[size];
    return (
      <div
        className={cn(
          "flex items-center justify-center rounded-xl bg-gray-100",
          container,
          className
        )}
      >
        <Box size={fallback} className="text-gray-400" />
      </div>
    );
  }

  const hash = hashCode(name);
  const color = PASTEL_COLORS[hash % PASTEL_COLORS.length];
  const { container, img } = sizeMap[size];
  const seed = encodeURIComponent(name.toLowerCase().replace(/\s+/g, "-"));
  const src = `https://api.dicebear.com/9.x/pixel-art/svg?seed=${seed}&backgroundColor=transparent`;

  return (
    <div
      className={cn(
        "flex items-center justify-center rounded-xl",
        color.bg,
        container,
        className
      )}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- DiceBear external SVG, not a static asset */}
      <img
        src={src}
        alt={`${name} icon`}
        width={img}
        height={img}
        className="pointer-events-none"
      />
    </div>
  );
}

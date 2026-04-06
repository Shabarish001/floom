"use client";

import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  XCircle,
  Loader2,
  ArrowRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { LABEL_COLORS } from "@/lib/label-colors";

type Automation = {
  _id: string;
  name: string;
  description: string;
  currentVersion: number;
  createdAt: number;
  status: "active" | "deploying" | "failed";
  schedule: string | null;
  scheduleEnabled?: boolean;
  lastRunStatus: string | null;
  lastRunAt: number | null;
  labels?: string[];
};

const statusConfig = {
  active: { color: "bg-green-500", label: "Active" },
  deploying: { color: "bg-yellow-500", label: "Deploying" },
  failed: { color: "bg-red-500", label: "Failed" },
} as const;

const statusBadgeVariant = {
  active: "secondary" as const,
  deploying: "outline" as const,
  failed: "destructive" as const,
};

const runStatusIcon: Record<
  string,
  { icon: typeof CheckCircle2; className: string }
> = {
  success: { icon: CheckCircle2, className: "text-green-500" },
  error: { icon: XCircle, className: "text-red-500" },
  timeout: { icon: XCircle, className: "text-red-500" },
  running: { icon: Loader2, className: "text-blue-500 animate-spin" },
  pending: { icon: Loader2, className: "text-gray-400" },
};

function formatRelativeTime(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

export function AutomationListRow({
  automation,
}: {
  automation: Automation;
}) {
  const router = useRouter();
  const status = statusConfig[automation.status];
  const runIcon = automation.lastRunStatus
    ? runStatusIcon[automation.lastRunStatus]
    : null;

  return (
    <div
      role="link"
      tabIndex={0}
      onClick={() => router.push(`/a/${automation._id}`)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          router.push(`/a/${automation._id}`);
        }
      }}
      className="group flex items-center gap-4 px-4 py-3 rounded-lg cursor-pointer hover:bg-muted/50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {/* Status + Name */}
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <Badge
          variant={statusBadgeVariant[automation.status]}
          className="gap-1.5 shrink-0"
        >
          <span
            className={cn("size-2 rounded-full", status.color)}
            aria-label={`Status: ${status.label}`}
          />
          {status.label}
        </Badge>
        <span className="text-sm font-medium text-foreground truncate">
          {automation.name}
        </span>
      </div>

      {/* Labels */}
      {automation.labels && automation.labels.length > 0 && (
        <div className="hidden sm:flex items-center gap-1 shrink-0">
          {automation.labels.slice(0, 3).map((label) => {
            const colors = LABEL_COLORS[label] ?? LABEL_COLORS._default;
            return (
              <span
                key={label}
                className={cn(
                  "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium",
                  colors.bg,
                  colors.text
                )}
              >
                {label}
              </span>
            );
          })}
          {automation.labels.length > 3 && (
            <span className="text-[11px] text-muted-foreground">
              +{automation.labels.length - 3}
            </span>
          )}
        </div>
      )}

      {/* Last run */}
      {automation.lastRunAt && runIcon && (
        <div className="hidden md:flex items-center gap-1.5 text-xs text-muted-foreground shrink-0">
          <runIcon.icon size={12} className={runIcon.className} />
          <span>{formatRelativeTime(automation.lastRunAt)}</span>
        </div>
      )}

      {/* Version */}
      <Badge variant="outline" className="text-muted-foreground shrink-0">
        v{automation.currentVersion}
      </Badge>

      {/* Arrow */}
      <ArrowRight
        size={14}
        className="text-muted-foreground/40 group-hover:text-foreground transition-colors shrink-0"
      />
    </div>
  );
}

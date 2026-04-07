"use client";

import { useQuery, useMutation, useConvexAuth } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useState, useEffect, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Nav } from "@/components/Nav";
import {
  Search,
  Box,
  ArrowRight,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  Command as CommandIcon,
  LayoutGrid,
  List,
  Settings,
  Terminal,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getLabelColor, LABEL_COLORS } from "@/lib/label-colors";
import { AppIcon } from "@/components/AppIcon";
import {
  Card,
  CardHeader,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
} from "@/components/ui/command";
import { TemplateCard } from "@/components/TemplateCard";
import { AutomationListRow } from "@/components/AutomationListRow";

const STORAGE_KEY_VIEW = "floom-gallery-view";

export default function GalleryPage() {
  return (
    <Suspense>
      <GalleryContent />
    </Suspense>
  );
}

function GalleryContent() {
  const [query, setQuery] = useState("");
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [deployingSlug, setDeployingSlug] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"grid" | "list">(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(STORAGE_KEY_VIEW);
      if (stored === "grid" || stored === "list") return stored;
    }
    return "grid";
  });
  const [activeLabel, setActiveLabel] = useState<string | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isAuthenticated } = useConvexAuth();

  // Detect if user just came from /welcome to avoid showing redundant deploy instructions
  const [cameFromWelcome, setCameFromWelcome] = useState(false);
  useEffect(() => {
    if (searchParams.get("from") === "welcome") {
      setCameFromWelcome(true);
      router.replace("/gallery");
    }
  }, [searchParams, router]);

  function handleViewChange(mode: "grid" | "list") {
    setViewMode(mode);
    localStorage.setItem(STORAGE_KEY_VIEW, mode);
  }

  const automations = useQuery(
    api.automations.list,
    isAuthenticated ? {} : "skip"
  );

  const templates = useQuery(api.templates.list);
  const deployTemplate = useMutation(api.templates.deploy);

  const handleDeployTemplate = async (slug: string) => {
    setDeployingSlug(slug);
    try {
      const result = await deployTemplate({ slug });
      router.push(`/a/${result.id}`);
    } catch {
      setDeployingSlug(null);
    }
  };

  // True empty state: user has 0 automations and is not searching.
  // Skip if user just came from /welcome (they already saw deploy instructions there).
  const showTemplates =
    automations !== undefined && automations.length === 0 && !query && !cameFromWelcome;

  // Filter by search query
  const searchFiltered = automations?.filter((a: Automation) => {
    if (query) {
      const q = query.toLowerCase();
      return (
        a.name.toLowerCase().includes(q) ||
        a.description.toLowerCase().includes(q)
      );
    }
    return true;
  });

  // Filter by label (client-side)
  const filtered = searchFiltered?.filter((a: Automation) => {
    if (!activeLabel) return true;
    return a.labels?.includes(activeLabel) ?? false;
  });

  // Collect all labels that exist across automations for the filter bar
  const allLabels = automations
    ? Array.from(
        new Set(automations.flatMap((a: Automation) => a.labels ?? []))
      ).sort()
    : [];

  // Command+K listener
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.metaKey && e.key === "k") {
        e.preventDefault();
        setPaletteOpen(true);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <Nav />

      <div className="max-w-6xl mx-auto w-full px-4 py-6 flex-1">
        {/* Header */}
        <div className="flex items-center gap-2 mb-4">
          {/* View toggle */}
          <div className="flex items-center rounded-lg border border-border p-0.5 shrink-0">
            <button
              onClick={() => handleViewChange("grid")}
              className={cn(
                "flex items-center justify-center size-7 rounded-md transition-colors",
                viewMode === "grid"
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
              aria-label="Grid view"
            >
              <LayoutGrid size={14} />
            </button>
            <button
              onClick={() => handleViewChange("list")}
              className={cn(
                "flex items-center justify-center size-7 rounded-md transition-colors",
                viewMode === "list"
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
              aria-label="List view"
            >
              <List size={14} />
            </button>
          </div>

          <Button
            variant="outline"
            onClick={() => setPaletteOpen(true)}
            className="flex-1 sm:flex-none sm:w-64 justify-start gap-2 text-muted-foreground font-normal min-w-0"
          >
            <Search size={14} className="shrink-0" />
            <span className="flex-1 text-left truncate">Search apps...</span>
            <kbd className="hidden sm:flex items-center gap-0.5 px-1.5 py-0.5 bg-muted rounded text-[11px] font-medium text-muted-foreground border border-border">
              <CommandIcon size={11} />K
            </kbd>
          </Button>
        </div>

        {/* Label filter bar */}
        {allLabels.length > 0 && (
          <div className="flex items-center gap-1.5 mb-4 overflow-x-auto pb-1 scrollbar-none">
            <button
              onClick={() => setActiveLabel(null)}
              className={cn(
                "inline-flex items-center rounded-full px-3 py-1 text-xs font-medium transition-colors whitespace-nowrap",
                activeLabel === null
                  ? "bg-foreground text-background"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              )}
            >
              All
            </button>
            {allLabels.map((label) => {
              const colors = LABEL_COLORS[label] ?? LABEL_COLORS._default;
              const isActive = activeLabel === label;
              return (
                <button
                  key={label}
                  onClick={() =>
                    setActiveLabel(isActive ? null : label)
                  }
                  className={cn(
                    "inline-flex items-center rounded-full px-3 py-1 text-xs font-medium transition-colors whitespace-nowrap",
                    isActive
                      ? "ring-2 ring-foreground/20"
                      : "hover:ring-1 hover:ring-foreground/10",
                    colors.bg,
                    colors.text
                  )}
                >
                  {label}
                </button>
              );
            })}
          </div>
        )}

        {/* Loading */}
        {automations === undefined && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-40 rounded-xl" />
            ))}
          </div>
        )}

        {/* Deploy instructions — shown when user has 0 apps */}
        {showTemplates && (
          <div className="mb-8 rounded-xl border border-border p-6">
            <h2 className="text-sm font-medium text-foreground">
              Deploy your first app
            </h2>
            <ol className="mt-3 space-y-2 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <span className="font-medium text-foreground shrink-0">1.</span>
                <span>
                  Get your API key from{" "}
                  <Button
                    variant="link"
                    className="h-auto p-0 text-sm"
                    onClick={() => router.push("/settings/api-key")}
                  >
                    Settings
                    <Settings size={12} className="ml-1" />
                  </Button>
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-medium text-foreground shrink-0">2.</span>
                <span>Run:</span>
              </li>
            </ol>
            <div className="mt-2 ml-5 flex items-center gap-2 rounded-lg bg-muted px-3 py-2 font-mono text-sm text-foreground">
              <Terminal size={14} className="shrink-0 text-muted-foreground" />
              npx floom deploy my-script.py
            </div>
            <p className="mt-3 ml-5 text-xs text-muted-foreground">
              That&apos;s it. Your app will be live in seconds.
            </p>
          </div>
        )}

        {/* Starter templates — shown when user has 0 apps */}
        {showTemplates && templates === undefined && (
          <div>
            <div className="mb-4">
              <Skeleton className="h-4 w-56 rounded" />
              <Skeleton className="h-3 w-72 rounded mt-2" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-48 rounded-xl" />
              ))}
            </div>
          </div>
        )}
        {showTemplates && templates && (
          <div>
            <div className="mb-4">
              <h2 className="text-sm font-medium text-foreground">
                Or start with a template
              </h2>
              <p className="text-xs text-muted-foreground mt-1">
                Pick a starter app and customize it.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {templates.map((t) => (
                <TemplateCard
                  key={t.slug}
                  name={t.name}
                  description={t.description}
                  category={t.category}
                  icon={t.icon}
                  deploying={deployingSlug === t.slug}
                  onDeploy={() => handleDeployTemplate(t.slug)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Search/filter empty state — only when searching/filtering returns no results */}
        {filtered !== undefined && filtered.length === 0 && (query || activeLabel) && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Box size={40} className="text-gray-200 mb-4" />
            <p className="text-muted-foreground text-sm">
              No apps match{" "}
              {query && <>&ldquo;{query}&rdquo;</>}
              {query && activeLabel && " with label "}
              {activeLabel && (
                <span className="font-medium">{activeLabel}</span>
              )}
              .
            </p>
            <Button
              variant="link"
              onClick={() => {
                setQuery("");
                setActiveLabel(null);
              }}
              className="mt-2"
            >
              Clear filters
            </Button>
          </div>
        )}

        {/* Grid view */}
        {filtered !== undefined && filtered.length > 0 && viewMode === "grid" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((automation: Automation) => (
              <AutomationCard
                key={automation._id}
                automation={automation}
                href={`/a/${automation._id}`}
              />
            ))}
          </div>
        )}

        {/* List view */}
        {filtered !== undefined && filtered.length > 0 && viewMode === "list" && (
          <div className="flex flex-col divide-y divide-border rounded-xl border border-border overflow-hidden">
            {filtered.map((automation: Automation) => (
              <AutomationListRow
                key={automation._id}
                automation={automation}
              />
            ))}
          </div>
        )}
      </div>

      {/* Command Palette */}
      <CommandDialog
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        title="Search Apps"
        description="Search for an app to open"
        className="sm:max-w-lg"
      >
        <Command>
          <CommandInput placeholder="Search apps..." />
          <CommandList className="max-h-80">
            <CommandEmpty>
              <p className="text-muted-foreground">
                {automations?.length === 0
                  ? "No apps in this workspace yet."
                  : "No matching apps."}
              </p>
            </CommandEmpty>
            <CommandGroup>
              {(automations ?? []).map((a: Automation) => {
                return (
                  <CommandItem
                    key={a._id}
                    value={`${a.name}__${a._id}`}
                    keywords={[a.description]}
                    onSelect={() => {
                      setPaletteOpen(false);
                      router.push(`/a/${a._id}`);
                    }}
                    className="py-2.5"
                  >
                    <AppIcon name={a.name} size="sm" className="shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{a.name}</p>
                      <p className="text-xs text-muted-foreground line-clamp-1">
                        {a.description}
                      </p>
                    </div>
                    {a.schedule && a.scheduleEnabled !== false && (
                      <span className="text-[11px] text-muted-foreground/60 shrink-0 flex items-center gap-1">
                        <Clock size={10} />
                        {formatSchedule(a.schedule)}
                      </span>
                    )}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
          <CommandSeparator />
          <div className="flex items-center gap-4 px-3 py-2 text-[11px] text-muted-foreground/60">
            <span>
              <kbd className="px-1 py-0.5 bg-muted rounded border text-[10px] mr-1">
                ↑↓
              </kbd>
              navigate
            </span>
            <span>
              <kbd className="px-1 py-0.5 bg-muted rounded border text-[10px] mr-1">
                ↵
              </kbd>
              open
            </span>
            <span>
              <kbd className="px-1 py-0.5 bg-muted rounded border text-[10px] mr-1">
                esc
              </kbd>
              close
            </span>
          </div>
        </Command>
      </CommandDialog>
    </div>
  );
}

// --- Types ---

type Automation = {
  _id: string;
  name: string;
  description: string;
  currentVersion: number;
  createdAt: number;
  status: "active" | "deploying" | "failed";
  schedule: string | null;
  scheduleEnabled?: boolean;
  labels?: string[];
  lastRunStatus: string | null;
  lastRunAt: number | null;
};

// --- Status helpers ---

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

function formatSchedule(schedule: string | null): string | null {
  if (!schedule) return null;
  if (schedule === "* * * * *") return "Every minute";
  if (schedule === "0 * * * *") return "Every hour";
  if (schedule === "0 0 * * *") return "Daily";
  if (schedule === "0 9 * * *") return "Daily at 9am";
  if (schedule === "0 9 * * 1-5") return "Weekdays at 9am";
  if (schedule === "0 0 * * 0") return "Weekly";
  if (schedule === "0 0 1 * *") return "Monthly";
  return schedule;
}

function formatRelativeTime(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

// --- AutomationCard ---

function AutomationCard({
  automation,
  href,
}: {
  automation: Automation;
  href: string;
}) {
  const router = useRouter();
  const status = statusConfig[automation.status];
  const scheduleLabel = formatSchedule(automation.schedule);
  const runIcon = automation.lastRunStatus
    ? runStatusIcon[automation.lastRunStatus]
    : null;

  return (
    <Card
      size="sm"
      role="link"
      tabIndex={0}
      onClick={() => router.push(href)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          router.push(href);
        }
      }}
      className="cursor-pointer hover:ring-foreground/20 hover:shadow-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {/* Top row: status + version + schedule */}
      <CardHeader className="flex-row items-center gap-2">
        <Badge
          variant={statusBadgeVariant[automation.status]}
          className="gap-1.5"
        >
          <span
            className={cn("size-2 rounded-full", status.color)}
            aria-label={`Status: ${status.label}`}
          />
          {status.label}
        </Badge>
        <Badge variant="outline" className="text-muted-foreground">
          v{automation.currentVersion}
        </Badge>
        {scheduleLabel && automation.scheduleEnabled !== false && (
          <span className="ml-auto flex items-center gap-1 text-xs text-muted-foreground">
            <Clock size={11} />
            {scheduleLabel}
          </span>
        )}
      </CardHeader>

      <CardContent className="flex flex-col gap-1 flex-1">
        <div className="flex items-start gap-2.5">
          <AppIcon name={automation.name} size="md" className="shrink-0" />
          <div className="min-w-0 flex-1">
            {/* Name */}
            <h3 className="font-semibold text-foreground text-sm leading-tight">
              {automation.name}
            </h3>

            {/* Description */}
            <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed mt-0.5">
              {automation.description}
            </p>
          </div>
        </div>

        {/* Labels */}
        {automation.labels && automation.labels.length > 0 && (
          <div className="flex items-center gap-1 mt-1.5 flex-wrap">
            {automation.labels.slice(0, 3).map((label) => {
              const color = getLabelColor(label);
              return (
                <span
                  key={label}
                  className={cn(
                    "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium",
                    color.bg,
                    color.text
                  )}
                >
                  {label}
                </span>
              );
            })}
            {automation.labels.length > 3 && (
              <span className="text-[10px] text-muted-foreground">
                +{automation.labels.length - 3}
              </span>
            )}
          </div>
        )}

        {/* Last run */}
        {automation.lastRunAt && runIcon && (
          <div className="flex items-center gap-1.5 mt-2 text-xs text-muted-foreground">
            <runIcon.icon size={12} className={runIcon.className} />
            <span>Last run {formatRelativeTime(automation.lastRunAt)}</span>
          </div>
        )}
      </CardContent>

      {/* Footer */}
      <CardFooter className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          {formatRelativeTime(automation.createdAt)}
        </span>
        <span className="flex items-center gap-1 text-xs font-medium text-primary">
          Open
          <ArrowRight size={12} />
        </span>
      </CardFooter>
    </Card>
  );
}

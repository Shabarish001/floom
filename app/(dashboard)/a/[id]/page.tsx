"use client";

import { useQuery, useMutation, useConvexAuth } from "convex/react";
import { use } from "react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useState, useCallback } from "react";
import { Nav } from "@/components/Nav";
import { StatusDot } from "@/components/ui/StatusDot";
import { RunForm } from "@/components/automation/RunForm";
import { OutputPanel } from "@/components/automation/OutputPanel";
import { RunHistory } from "./RunHistory";

import { VersionsTab } from "./VersionsTab";
import { WebhookTab } from "./WebhookTab";
import { SharePopover } from "./SharePopover";
import { Share2, Pause, Play, MoreHorizontal, Trash2, Loader2, Check } from "lucide-react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { AppIcon } from "@/components/AppIcon";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { LabelsEditor } from "@/components/automation/LabelsEditor";

export default function AutomationPage({
  params: paramsPromise,
}: {
  params: Promise<{ id: string }>;
}) {
  const params = use(paramsPromise);
  const { isAuthenticated } = useConvexAuth();
  const automation = useQuery(
    api.automations.get,
    isAuthenticated ? { id: params.id as Id<"automations"> } : "skip"
  );

  const router = useRouter();
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showSharePopover, setShowSharePopover] = useState(false);

  const setScheduleEnabled = useMutation(api.automations.setScheduleEnabled);
  const triggerRun = useMutation(api.runs.trigger);
  const removeAutomation = useMutation(api.automations.remove);

  const handleToggleSchedule = useCallback(async () => {
    if (!automation) return;
    const currentlyEnabled = automation.scheduleEnabled !== false;
    await setScheduleEnabled({
      id: params.id as Id<"automations">,
      enabled: !currentlyEnabled,
    });
  }, [automation, params.id, setScheduleEnabled]);

  const handleDelete = useCallback(async () => {
    await removeAutomation({ id: params.id as Id<"automations"> });
    router.push("/gallery");
  }, [params.id, removeAutomation, router]);

  const handleRun = useCallback(
    async (inputs: Record<string, unknown>) => {
      setIsRunning(true);
      try {
        const result = await triggerRun({
          automationId: params.id as Id<"automations">,
          inputs,
          triggeredBy: "manual",
        });
        setActiveRunId(result.runId);
      } finally {
        setIsRunning(false);
      }
    },
    [params.id, triggerRun]
  );


  if (automation === undefined) {
    return (
      <div className="min-h-screen bg-background">
        <Nav />
        <div className="flex items-center justify-center h-64">
          <Skeleton className="h-4 w-24" />
        </div>
      </div>
    );
  }

  if (automation === null) {
    return (
      <div className="min-h-screen bg-background">
        <Nav />
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">App not found.</p>
        </div>
      </div>
    );
  }

  if (automation.status === "deploying") {
    return (
      <div className="min-h-screen bg-background">
        <Nav />
        <div className="flex flex-col items-center justify-center h-[70vh] gap-6 animate-in fade-in duration-300">
          <div className="relative">
            <div className="absolute inset-0 rounded-full bg-primary/10 animate-ping" style={{ animationDuration: "1.5s" }} />
            <div className="relative flex items-center justify-center w-14 h-14 rounded-full bg-primary/10">
              <Loader2 className="w-7 h-7 text-primary animate-spin" />
            </div>
          </div>

          <div className="flex flex-col items-center gap-1.5">
            <p className="text-base font-medium">Setting up your automation</p>
            <p className="text-sm text-muted-foreground">This will only take a moment</p>
          </div>

          <div className="flex flex-col gap-2.5 mt-2">
            {["Creating environment", "Installing dependencies", "Almost ready"].map((step, i) => (
              <div
                key={step}
                className="flex items-center gap-2.5 text-sm text-muted-foreground animate-in fade-in slide-in-from-bottom-2 fill-mode-both"
                style={{ animationDelay: `${i * 600}ms`, animationDuration: "400ms" }}
              >
                <Check className="w-3.5 h-3.5 text-primary" />
                {step}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const lastRun = automation.runs?.[0];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Nav />

      {/* Header */}
      <div className="px-4 py-3 border-b">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <AppIcon name={automation.name} size="lg" className="shrink-0" />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <Badge variant="secondary">v{automation.currentVersion}</Badge>
              </div>
              <h1 className="font-semibold text-foreground truncate text-sm sm:text-base">
                {automation.name}
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            <SharePopover automation={automation}>
              <Button variant="outline" size="sm" className="hidden sm:inline-flex">
                <Share2 className="size-3.5" />
                Share
              </Button>
            </SharePopover>
            {automation.isOwner && automation.schedule && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleToggleSchedule}
                title={
                  automation.scheduleEnabled === false
                    ? "Resume schedule"
                    : "Pause schedule"
                }
                className="hidden sm:inline-flex"
              >
                {automation.scheduleEnabled === false ? (
                  <>
                    <Play className="size-3.5 text-amber-500" />
                    <span>Paused</span>
                  </>
                ) : (
                  <>
                    <Pause className="size-3.5 text-muted-foreground" />
                    <span>Pause</span>
                  </>
                )}
              </Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger
                className={cn(
                  buttonVariants({ variant: "outline", size: "icon" })
                )}
              >
                <MoreHorizontal className="size-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={() => setShowSharePopover(true)}
                  className="sm:hidden"
                >
                  <Share2 />
                  Share
                </DropdownMenuItem>
                {automation.isOwner && automation.schedule && (
                  <DropdownMenuItem
                    onClick={handleToggleSchedule}
                    className="sm:hidden"
                  >
                    {automation.scheduleEnabled === false ? <Play /> : <Pause />}
                    {automation.scheduleEnabled === false ? "Resume" : "Pause"}
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem
                  variant="destructive"
                  onClick={() => setShowDeleteConfirm(true)}
                >
                  <Trash2 />
                  Delete app
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
          {automation.description}
        </p>
        <div className="text-xs text-muted-foreground/60 mt-1 flex items-center gap-3 flex-wrap">
          {lastRun && (
            <span>Last run {formatRelativeTime(lastRun.startedAt)}</span>
          )}
          {automation.schedule && (
            <span>Next: {describeSchedule(automation.schedule)}</span>
          )}
        </div>
        <div className="mt-2">
          <LabelsEditor
            automationId={params.id as Id<"automations">}
            labels={(automation as unknown as { labels?: string[] }).labels ?? []}
          />
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="app" className="flex-1 flex flex-col gap-0">
        <div className="px-4 py-2 border-b overflow-x-auto scrollbar-none">
          <TabsList>
            <TabsTrigger value="app">App</TabsTrigger>
            <TabsTrigger value="runs">Runs</TabsTrigger>
            <TabsTrigger value="versions">Versions</TabsTrigger>
            <TabsTrigger value="webhook">Webhook</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="app" className="flex-1 flex flex-col">
          <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
            {/* Left: Run form (40%) */}
            <div
              className="lg:w-[40%] border-b lg:border-b-0 lg:border-r overflow-y-auto"
            >
              <RunForm
                manifest={automation.manifest}
                onRun={handleRun}
                automationId={params.id}
                isRunning={isRunning}
              />
            </div>
            {/* Right: Output panel (60%) */}
            <div
              className={cn(
                "lg:w-[60%] overflow-y-auto transition-opacity duration-200",
                isRunning
                  ? "opacity-100"
                  : !lastRun && !activeRunId
                    ? "opacity-40"
                    : "opacity-100"
              )}
            >
              <OutputPanel
                runId={activeRunId}
                lastRun={lastRun ?? null}
                currentVersionId={automation.currentVersionId as string}
                manifestOutputs={automation.manifest?.outputs ?? []}
              />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="runs" className="flex-1 overflow-y-auto">
          <RunHistory
            runs={automation.runs ?? []}
            onSelectRun={(runId) => setActiveRunId(runId)}
            manifestOutputs={automation.manifest?.outputs ?? []}
          />
        </TabsContent>

        <TabsContent value="versions" className="flex-1 overflow-y-auto">
          <VersionsTab automationId={params.id as Id<"automations">} />
        </TabsContent>

        <TabsContent value="webhook" className="flex-1 overflow-y-auto">
          <WebhookTab
            automationId={params.id}
            webhookEnabled={automation.webhookEnabled}
            webhookTokenPrefix={automation.webhookTokenPrefix}
            webhookCreatedAt={automation.webhookCreatedAt}
            manifest={automation.manifest}
          />
        </TabsContent>

      </Tabs>

      {/* Delete confirmation dialog */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete app</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete{" "}
              <span className="font-medium text-foreground">
                {automation.name}
              </span>
              ? This will permanently remove the app, all versions, and
              run history. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDeleteConfirm(false)}
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Mobile share popover (controlled by dropdown menu) */}
      <SharePopover
        automation={automation}
        open={showSharePopover}
        onOpenChange={setShowSharePopover}
      >
        <span />
      </SharePopover>
    </div>
  );
}

function formatRelativeTime(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

function describeSchedule(cron: string): string {
  const parts = cron.split(" ");
  if (parts.length !== 5) return cron;
  const [min, hour, , , dow] = parts;
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  if (dow !== "*") {
    return `${days[parseInt(dow)] ?? "?"} ${hour.padStart(2, "0")}:${min.padStart(2, "0")} UTC`;
  }
  return `Daily ${hour.padStart(2, "0")}:${min.padStart(2, "0")} UTC`;
}

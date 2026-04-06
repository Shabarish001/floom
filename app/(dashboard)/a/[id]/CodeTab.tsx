"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Download, FileIcon, FolderIcon } from "lucide-react";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function FileTree({ fileList }: { fileList: Array<{ path: string; size: number }> }) {
  // Build a simple tree structure
  const sorted = [...fileList].sort((a, b) => a.path.localeCompare(b.path));

  return (
    <div className="p-4 text-xs font-mono bg-gray-950 text-gray-100 max-h-[60vh] overflow-y-auto">
      {sorted.map((file) => {
        const depth = file.path.split("/").length - 1;
        const name = file.path.split("/").pop() ?? file.path;
        const isDir = false; // All entries are files in our model

        return (
          <div
            key={file.path}
            className="flex items-center gap-2 py-0.5 hover:bg-gray-900 px-1 rounded"
            style={{ paddingLeft: `${depth * 16 + 4}px` }}
          >
            {isDir ? (
              <FolderIcon className="h-3.5 w-3.5 text-blue-400 shrink-0" />
            ) : (
              <FileIcon className="h-3.5 w-3.5 text-gray-500 shrink-0" />
            )}
            <span className="text-gray-200">{name}</span>
            <span className="text-gray-600 ml-auto">{formatBytes(file.size)}</span>
          </div>
        );
      })}
    </div>
  );
}

export function CodeTab({
  automationId,
  currentVersionId,
}: {
  automationId: Id<"automations">;
  currentVersionId: Id<"automationVersions">;
}) {
  const versions = useQuery(api.automations.getVersions, { automationId });
  const [selectedVersionId, setSelectedVersionId] =
    useState<Id<"automationVersions">>(currentVersionId);

  const versionData = useQuery(api.automations.getVersion, {
    versionId: selectedVersionId,
  });

  if (!versions || !versionData) {
    return (
      <div className="p-4 space-y-3">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const selectedVersion = versions.find((v: { _id: string }) => v._id === selectedVersionId);

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-medium text-foreground">Files</h3>
          <Select
            value={selectedVersionId}
            onValueChange={(val) =>
              setSelectedVersionId(val as Id<"automationVersions">)
            }
          >
            <SelectTrigger size="sm">
              <SelectValue placeholder="Select version">
                {selectedVersion
                  ? `v${selectedVersion.version}${selectedVersion._id === currentVersionId ? " (current)" : ""}${selectedVersion.changeNote ? ` · ${selectedVersion.changeNote}` : ""}`
                  : "Select version"}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {versions.map((v) => (
                <SelectItem key={v._id} value={v._id}>
                  v{v.version}
                  {v._id === currentVersionId ? " (current)" : ""}
                  {v.changeNote ? ` · ${v.changeNote}` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Badge variant="outline">Read-only</Badge>
      </div>
      <Card className="overflow-hidden p-0">
        <CardHeader className="flex items-center justify-between border-b bg-muted/50">
          <span className="text-xs font-mono text-muted-foreground">
            {versionData.fileCount ?? 1} file{(versionData.fileCount ?? 1) !== 1 ? "s" : ""}
            {versionData.totalSize != null && ` · ${formatBytes(versionData.totalSize)}`}
            {versionData.entrypoint && ` · entrypoint: ${versionData.entrypoint}`}
          </span>
          <span className="text-xs text-muted-foreground">
            {selectedVersion &&
              new Date(selectedVersion.createdAt).toLocaleDateString()}
            {selectedVersion?.changeNote &&
              ` · ${selectedVersion.changeNote}`}
          </span>
        </CardHeader>
        <CardContent className="p-0">
          {versionData.fileList ? (
            <FileTree fileList={versionData.fileList} />
          ) : (
            <div className="p-4 text-xs text-muted-foreground">No file information available</div>
          )}
        </CardContent>
      </Card>
      {selectedVersionId !== currentVersionId && (
        <p className="mt-2 text-xs text-amber-600">
          Viewing v{selectedVersion?.version} — not the current version.
        </p>
      )}
      <p className="mt-3 text-xs text-muted-foreground">
        To update: run{" "}
        <code className="bg-muted px-1 py-0.5 rounded font-mono">/floom</code>{" "}
        in Claude Code.
      </p>
    </div>
  );
}

"use client";

import { useState, useRef, useEffect } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { SUGGESTED_LABELS, getLabelColor } from "@/lib/label-colors";
import { Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";

export function LabelsEditor({
  automationId,
  labels,
}: {
  automationId: Id<"automations">;
  labels: string[];
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const updateLabels = useMutation(api.automations.updateLabels);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const toggleLabel = (label: string) => {
    const next = labels.includes(label)
      ? labels.filter((l) => l !== label)
      : [...labels, label];
    updateLabels({ id: automationId, labels: next });
  };

  const removeLabel = (label: string) => {
    updateLabels({ id: automationId, labels: labels.filter((l) => l !== label) });
  };

  return (
    <div ref={containerRef} className="relative flex items-center gap-1.5 flex-wrap">
      {labels.map((label) => {
        const color = getLabelColor(label);
        return (
          <button
            key={label}
            onClick={() => removeLabel(label)}
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium transition-colors",
              color.bg,
              color.text,
              "hover:opacity-80"
            )}
            title={`Remove "${label}"`}
          >
            {label}
            <X className="size-3" />
          </button>
        );
      })}
      <button
        onClick={() => setOpen(!open)}
        className="inline-flex items-center justify-center size-5 rounded-full border border-dashed border-muted-foreground/30 text-muted-foreground hover:border-foreground hover:text-foreground transition-colors"
        title="Add label"
      >
        <Plus className="size-3" />
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 z-50 rounded-lg border bg-popover p-2 shadow-md min-w-[200px]">
          <p className="text-xs text-muted-foreground mb-1.5 px-1">Add labels</p>
          <div className="flex flex-wrap gap-1">
            {SUGGESTED_LABELS.map((label) => {
              const isActive = labels.includes(label);
              const color = getLabelColor(label);
              return (
                <button
                  key={label}
                  onClick={() => toggleLabel(label)}
                  className={cn(
                    "rounded-full px-2 py-0.5 text-xs font-medium transition-colors",
                    isActive ? color.bg : "bg-muted",
                    isActive ? color.text : "text-muted-foreground",
                    "hover:opacity-80"
                  )}
                >
                  {isActive ? `- ${label}` : `+ ${label}`}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

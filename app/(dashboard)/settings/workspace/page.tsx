"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useOrganization } from "@clerk/nextjs";
import { useState, useEffect } from "react";
import { Globe, RefreshCw, Check } from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";

function normalizeUrl(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return "";
  if (!/^https?:\/\//i.test(trimmed)) {
    return `https://${trimmed}`;
  }
  return trimmed;
}

function isValidUrl(input: string): boolean {
  try {
    const parsed = new URL(input);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export default function WorkspacePage() {
  const workspace = useQuery(api.organizations.getWorkspace);
  const updateWorkspace = useMutation(api.organizations.updateWorkspace);
  const { organization: clerkOrg } = useOrganization();

  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [rescanning, setRescanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // Populate form fields from workspace data
  useEffect(() => {
    if (workspace) {
      setName(workspace.name ?? "");
      setUrl(workspace.websiteUrl ?? "");
    }
  }, [workspace]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);

    const normalized = normalizeUrl(url);
    if (normalized && !isValidUrl(normalized)) {
      setError("Please enter a valid URL (e.g. example.com)");
      return;
    }

    setSaving(true);
    try {
      const trimmedName = name.trim() || undefined;
      await updateWorkspace({
        name: trimmedName,
        websiteUrl: normalized || undefined,
      });
      // Sync name to Clerk organization so the OrganizationSwitcher updates
      if (trimmedName && clerkOrg) {
        await clerkOrg.update({ name: trimmedName });
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      console.error(err);
      setError(
        err instanceof Error ? err.message : "Something went wrong."
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleRescan() {
    setError(null);
    setRescanning(true);
    try {
      const normalized = normalizeUrl(url);
      if (!normalized || !isValidUrl(normalized)) {
        setError("Enter a valid URL before rescanning.");
        return;
      }
      await updateWorkspace({ websiteUrl: normalized });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      console.error(err);
      setError(
        err instanceof Error ? err.message : "Something went wrong."
      );
    } finally {
      setRescanning(false);
    }
  }

  if (workspace === undefined) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  const hasBrandData =
    workspace.logoUrl ||
    (workspace.brandColors && workspace.brandColors.length > 0) ||
    workspace.companyName ||
    workspace.companyDescription;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Workspace</CardTitle>
          <CardDescription>
            General settings for your workspace. Add a company website to
            auto-extract brand assets.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="workspace-name">Workspace name</Label>
              <Input
                id="workspace-name"
                type="text"
                placeholder="e.g. Acme Corp"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setError(null);
                }}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="website-url">Company website</Label>
              <div className="relative">
                <Globe
                  size={14}
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
                />
                <Input
                  id="website-url"
                  type="text"
                  placeholder="example.com"
                  value={url}
                  onChange={(e) => {
                    setUrl(e.target.value);
                    setError(null);
                  }}
                  className="pl-8"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Floom will scan this URL to extract your logo, brand colors,
                and fonts.
              </p>
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <div className="flex items-center gap-2">
              <Button type="submit" disabled={saving}>
                {saved ? (
                  <>
                    <Check size={14} className="mr-1.5" />
                    Saved
                  </>
                ) : saving ? (
                  "Saving..."
                ) : (
                  "Save"
                )}
              </Button>
              {workspace.websiteUrl && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleRescan}
                  disabled={rescanning}
                >
                  <RefreshCw
                    size={14}
                    className={rescanning ? "animate-spin" : ""}
                  />
                  {rescanning ? "Scanning..." : "Re-scan website"}
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Brand data preview */}
      {hasBrandData && (
        <Card>
          <CardHeader>
            <CardTitle>Extracted Brand</CardTitle>
            <CardDescription>
              Data auto-extracted from {workspace.websiteUrl}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Logo */}
            {workspace.logoUrl && (
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Logo</Label>
                <div className="w-12 h-12 rounded border bg-muted/50 flex items-center justify-center overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={workspace.logoUrl}
                    alt="Workspace logo"
                    className="max-w-full max-h-full object-contain"
                  />
                </div>
              </div>
            )}

            {/* Company name + description */}
            {(workspace.companyName || workspace.companyDescription) && (
              <div className="space-y-1.5">
                {workspace.companyName && (
                  <div>
                    <Label className="text-xs text-muted-foreground">
                      Company name
                    </Label>
                    <p className="text-sm">{workspace.companyName}</p>
                  </div>
                )}
                {workspace.companyDescription && (
                  <div>
                    <Label className="text-xs text-muted-foreground">
                      Description
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      {workspace.companyDescription}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Brand colors */}
            {workspace.brandColors && workspace.brandColors.length > 0 && (
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">
                  Brand colors
                </Label>
                <div className="flex items-center gap-2">
                  {workspace.brandColors.map((color) => (
                    <div key={color} className="flex items-center gap-1.5">
                      <div
                        className="w-6 h-6 rounded border"
                        style={{ backgroundColor: color }}
                      />
                      <span className="text-xs font-mono text-muted-foreground">
                        {color}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Fonts */}
            {workspace.fonts && workspace.fonts.length > 0 && (
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Fonts</Label>
                <div className="flex items-center gap-2 flex-wrap">
                  {workspace.fonts.map((font) => (
                    <Badge key={font} variant="secondary">
                      {font}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Industry + tone */}
            {(workspace.industry || workspace.brandTone) && (
              <>
                <Separator />
                <div className="flex items-center gap-4">
                  {workspace.industry && (
                    <div>
                      <Label className="text-xs text-muted-foreground">
                        Industry
                      </Label>
                      <p className="text-sm capitalize">
                        {workspace.industry}
                      </p>
                    </div>
                  )}
                  {workspace.brandTone && (
                    <div>
                      <Label className="text-xs text-muted-foreground">
                        Brand tone
                      </Label>
                      <p className="text-sm capitalize">
                        {workspace.brandTone}
                      </p>
                    </div>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

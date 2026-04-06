// Security: The raw API key is shown exactly once, held in React state only.
// It is never persisted client-side (no localStorage, no cookies).
// The Convex mutation returns the raw key before hashing; only the SHA-256
// hash is stored in the database. On page refresh, the key is lost and the
// user is redirected to /gallery.

"use client";

import { useMutation, useQuery } from "convex/react";
import { useUser } from "@clerk/nextjs";
import { api } from "@/convex/_generated/api";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Copy, Check, ArrowRight, Terminal, Key } from "lucide-react";
import { Id } from "@/convex/_generated/dataModel";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function WelcomePage() {
  const { user } = useUser();
  const router = useRouter();
  const [orgId, setOrgId] = useState<Id<"organizations"> | null>(null);
  const [rawKey, setRawKey] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);
  const [copiedDeploy, setCopiedDeploy] = useState(false);
  const [copiedInstall, setCopiedInstall] = useState(false);
  const keyCreated = useRef(false);

  const upsertUser = useMutation(api.users.upsert);
  const createFirstKey = useMutation(api.apiKeys.createFirstKey);
  const hasKeys = useQuery(
    api.apiKeys.hasKeys,
    orgId ? { orgId } : "skip"
  );

  const origin = typeof window !== "undefined"
    ? window.location.origin
    : "https://dashboard.floom.dev";

  const installCommand = `curl -s ${origin}/install-skill.sh | bash -s -- ${origin}`;

  // Resolve orgId on mount
  useEffect(() => {
    if (!user) return;
    upsertUser({ email: user.primaryEmailAddress?.emailAddress ?? "" })
      .then((result) => {
        if (result?.orgId) setOrgId(result.orgId);
      })
      .catch(() => {});
  }, [upsertUser, user]);

  // If returning user already has keys, redirect to gallery
  useEffect(() => {
    if (hasKeys === true && rawKey === null && !keyCreated.current) {
      router.replace("/gallery");
    }
  }, [hasKeys, rawKey, router]);

  // Auto-generate first key once orgId resolves and org has no keys
  useEffect(() => {
    if (!orgId || keyCreated.current || hasKeys !== false) return;
    keyCreated.current = true;

    createFirstKey({ orgId })
      .then((key) => {
        if (key) {
          setRawKey(key);
        } else {
          // Org already had keys (race condition), go to gallery
          router.replace("/gallery");
        }
      })
      .catch(() => {
        router.replace("/gallery");
      });
  }, [orgId, hasKeys, createFirstKey, router]);

  async function copyToClipboard(
    text: string,
    setter: (v: boolean) => void
  ) {
    await navigator.clipboard.writeText(text);
    setter(true);
    setTimeout(() => setter(false), 2000);
  }

  // Show nothing while loading/redirecting
  if (!rawKey) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="animate-pulse text-sm text-muted-foreground">
          Setting up your workspace...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-4">
      <div className="w-full max-w-lg space-y-8">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-semibold text-gray-900">
            Welcome to Floom
          </h1>
          <p className="text-sm text-muted-foreground">
            Your API key is below. Save it now; it will not be shown again.
          </p>
        </div>

        {/* API Key Card */}
        <Card>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Key className="size-3.5" />
              <span className="font-medium">API Key</span>
            </div>
            {/* eslint-disable-next-line react/no-unknown-property */}
            <div className="flex items-center gap-2" data-sensitive="true">
              <code className="flex-1 text-sm font-mono bg-muted px-3 py-2 rounded-lg truncate select-all">
                {rawKey}
              </code>
              <Button
                variant="outline"
                size="sm"
                onClick={() => copyToClipboard(rawKey, setCopiedKey)}
              >
                {copiedKey ? (
                  <Check className="size-3.5 text-emerald-500" />
                ) : (
                  <Copy className="size-3.5" />
                )}
                {copiedKey ? "Copied!" : "Copy"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Quick Start */}
        <div className="space-y-3">
          <h2 className="text-sm font-medium text-gray-900">Quick start</h2>

          {/* Deploy command */}
          <div className="flex items-center gap-2 rounded-lg border bg-muted/50 px-3 py-2.5">
            <Terminal className="size-3.5 text-muted-foreground shrink-0" />
            <code className="flex-1 text-xs font-mono text-foreground truncate">
              npx floom deploy
            </code>
            <button
              onClick={() => copyToClipboard("npx floom deploy", setCopiedDeploy)}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              {copiedDeploy ? (
                <Check className="size-3.5 text-emerald-500" />
              ) : (
                <Copy className="size-3.5" />
              )}
            </button>
          </div>

          {/* Install skill command */}
          <div className="space-y-1.5">
            <p className="text-xs text-muted-foreground">
              Or install the Claude Code skill:
            </p>
            <div className="flex items-center gap-2 rounded-lg border bg-muted/50 px-3 py-2.5">
              <Terminal className="size-3.5 text-muted-foreground shrink-0" />
              <code className="flex-1 text-xs font-mono text-foreground truncate">
                {installCommand}
              </code>
              <button
                onClick={() => copyToClipboard(installCommand, setCopiedInstall)}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                {copiedInstall ? (
                  <Check className="size-3.5 text-emerald-500" />
                ) : (
                  <Copy className="size-3.5" />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Continue button */}
        <Button
          onClick={() => router.push("/gallery")}
          className="w-full"
        >
          Continue to dashboard
          <ArrowRight className="size-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}

"use client";

import { useMutation, useQuery, useConvexAuth } from "convex/react";
import { useUser } from "@clerk/nextjs";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useState, useEffect, useRef } from "react";
import { Copy, Check, Terminal, Key, Code, Layers } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { TemplateCard } from "@/components/TemplateCard";

interface Template {
  slug: string;
  name: string;
  description: string;
  category: string;
  icon: string;
}

interface OnboardingBannerProps {
  templates: Template[] | undefined;
  onDeploy: (slug: string) => void;
  deployingSlug: string | null;
}

export function OnboardingBanner({
  templates,
  onDeploy,
  deployingSlug,
}: OnboardingBannerProps) {
  const { user } = useUser();
  const { isAuthenticated } = useConvexAuth();
  const [orgId, setOrgId] = useState<Id<"organizations"> | null>(null);
  const [rawKey, setRawKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);
  const [copiedInstall, setCopiedInstall] = useState(false);
  const [copiedDeploy, setCopiedDeploy] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const orgResolved = useRef(false);

  const upsertUser = useMutation(api.users.upsert);
  const createFirstKey = useMutation(api.apiKeys.createFirstKey);
  const hasKeys = useQuery(api.apiKeys.hasKeys, orgId ? { orgId } : "skip");

  const origin =
    typeof window !== "undefined"
      ? window.location.origin
      : "https://dashboard.floom.dev";
  const installCommand = `curl -s ${origin}/install-skill.sh | bash -s -- ${origin}`;

  // Resolve orgId on mount
  useEffect(() => {
    if (!isAuthenticated || !user || orgResolved.current) return;
    orgResolved.current = true;
    upsertUser({ email: user.primaryEmailAddress?.emailAddress ?? "" })
      .then((result) => {
        if (result?.orgId) setOrgId(result.orgId);
      })
      .catch(() => {});
  }, [isAuthenticated, upsertUser, user]);

  // Hide banner if user has keys with no raw key displayed
  if (hasKeys !== false && rawKey === null) return null;

  async function copyToClipboard(text: string, setter: (v: boolean) => void) {
    await navigator.clipboard.writeText(text);
    setter(true);
    setTimeout(() => setter(false), 2000);
  }

  async function handleGenerateKey() {
    if (!orgId || isGenerating) return;
    setIsGenerating(true);
    setError(null);
    try {
      const key = await createFirstKey({ orgId });
      if (key) {
        setRawKey(key);
      }
    } catch {
      setError("Something went wrong. Try again in a minute.");
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <>
      <div className="mb-8">
        <h2 className="text-lg font-semibold text-foreground mb-1">
          What do you want to publish?
        </h2>
        <p className="text-sm text-muted-foreground mb-4">
          Deploy your own script or start from a template.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Card 1: My own Python */}
          <Card className="flex flex-col">
            <CardContent className="flex-1 space-y-4">
              <div className="flex items-center gap-2.5">
                <span className="flex items-center justify-center size-8 rounded-lg bg-primary/10 text-primary">
                  <Code size={16} />
                </span>
                <h3 className="font-semibold text-foreground text-sm">
                  My own Python script
                </h3>
              </div>

              <ol className="space-y-3 text-sm">
                {/* Step 1: Generate API key */}
                <li className="flex items-start gap-2.5">
                  <span className="flex items-center justify-center size-5 rounded-full bg-muted text-xs font-medium text-muted-foreground shrink-0 mt-0.5">
                    1
                  </span>
                  <div className="flex-1 min-w-0">
                    {rawKey === null ? (
                      <div>
                        <p className="text-muted-foreground text-xs mb-1.5">
                          Generate an API key
                        </p>
                        <Button
                          onClick={handleGenerateKey}
                          disabled={isGenerating || !orgId}
                          size="sm"
                        >
                          <Key className="size-3.5 mr-1.5" />
                          {isGenerating ? "Generating..." : "Generate API Key"}
                        </Button>
                        {error && (
                          <p className="text-xs text-red-500 mt-1.5">{error}</p>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground font-medium">
                          Save this key — it won&apos;t be shown again.
                        </p>
                        <div className="flex items-center gap-2">
                          <code className="flex-1 text-xs font-mono bg-muted px-2.5 py-1.5 rounded-lg truncate select-all min-w-0 overflow-x-auto">
                            {rawKey}
                          </code>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              copyToClipboard(rawKey, setCopiedKey)
                            }
                          >
                            {copiedKey ? (
                              <Check className="size-3.5 text-emerald-500" />
                            ) : (
                              <Copy className="size-3.5" />
                            )}
                            {copiedKey ? "Copied!" : "Copy"}
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </li>

                {/* Step 2: Install skill */}
                <li className="flex items-start gap-2.5">
                  <span className="flex items-center justify-center size-5 rounded-full bg-muted text-xs font-medium text-muted-foreground shrink-0 mt-0.5">
                    2
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-muted-foreground text-xs mb-1.5">
                      Install the Claude Code skill
                    </p>
                    <div className="flex items-center gap-2 rounded-lg border bg-muted/50 px-2.5 py-1.5 min-w-0 overflow-x-auto">
                      <Terminal className="size-3.5 text-muted-foreground shrink-0" />
                      <code className="flex-1 text-xs font-mono text-foreground whitespace-nowrap">
                        {installCommand}
                      </code>
                      <button
                        onClick={() =>
                          copyToClipboard(installCommand, setCopiedInstall)
                        }
                        className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
                      >
                        {copiedInstall ? (
                          <Check className="size-3.5 text-emerald-500" />
                        ) : (
                          <Copy className="size-3.5" />
                        )}
                      </button>
                    </div>
                  </div>
                </li>

                {/* Step 3: Deploy */}
                <li className="flex items-start gap-2.5">
                  <span className="flex items-center justify-center size-5 rounded-full bg-muted text-xs font-medium text-muted-foreground shrink-0 mt-0.5">
                    3
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-muted-foreground text-xs mb-1.5">
                      Deploy your script
                    </p>
                    <div className="flex items-center gap-2 rounded-lg border bg-muted/50 px-2.5 py-1.5 min-w-0 overflow-x-auto">
                      <Terminal className="size-3.5 text-muted-foreground shrink-0" />
                      <code className="flex-1 text-xs font-mono text-foreground whitespace-nowrap">
                        npx floom deploy
                      </code>
                      <button
                        onClick={() =>
                          copyToClipboard("npx floom deploy", setCopiedDeploy)
                        }
                        className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
                      >
                        {copiedDeploy ? (
                          <Check className="size-3.5 text-emerald-500" />
                        ) : (
                          <Copy className="size-3.5" />
                        )}
                      </button>
                    </div>
                  </div>
                </li>
              </ol>
            </CardContent>
          </Card>

          {/* Card 2: Browse templates */}
          <Card className="flex flex-col">
            <CardContent className="flex-1 flex flex-col items-center justify-center text-center space-y-3 py-8">
              <span className="flex items-center justify-center size-10 rounded-lg bg-muted text-muted-foreground">
                <Layers size={20} />
              </span>
              <div>
                <h3 className="font-semibold text-foreground text-sm">
                  Browse templates
                </h3>
                <p className="text-xs text-muted-foreground mt-1 max-w-[220px] mx-auto">
                  Pick a starter app and customize it. Web scrapers, PDF
                  generators, data analyzers, and more.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setTemplatesOpen(true)}
              >
                <Layers className="size-3.5 mr-1.5" />
                Browse templates
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Templates dialog */}
      <Dialog open={templatesOpen} onOpenChange={setTemplatesOpen}>
        <DialogContent className="sm:max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Templates</DialogTitle>
            <DialogDescription>
              Pick a starter app and customize it.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-2">
            {templates?.map((t) => (
              <TemplateCard
                key={t.slug}
                name={t.name}
                description={t.description}
                category={t.category}
                icon={t.icon}
                deploying={deployingSlug === t.slug}
                onDeploy={() => onDeploy(t.slug)}
              />
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

"use client";

import { useState, useCallback } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Copy, Check, RefreshCw, ChevronDown, ChevronUp } from "lucide-react";

type ManifestInput = {
  name: string;
  type: string;
  required?: boolean;
  description?: string;
};

function exampleValue(type: string): string {
  switch (type) {
    case "number": return "42";
    case "boolean": return "true";
    case "json": return "{}";
    default: return '"example text"';
  }
}

function buildExampleJson(inputs: ManifestInput[]): string {
  if (!inputs.length) return "{}";
  const entries = inputs.map(
    (i) => `  "${i.name}": ${exampleValue(i.type)}`
  );
  return `{\n${entries.join(",\n")}\n}`;
}

function CopyButton({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      variant={label ? "outline" : "ghost"}
      size={label ? "sm" : "icon-xs"}
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
    >
      {copied ? <Check className="size-3.5 text-green-600" /> : <Copy className="size-3.5" />}
      {label && (copied ? "Copied!" : label)}
    </Button>
  );
}

function buildCurl(url: string, inputs: ManifestInput[]): string {
  const json = buildExampleJson(inputs);
  return `curl -X POST ${url} \\
  -H "Content-Type: application/json" \\
  -d '${json}'`;
}

function CodeSnippets({
  webhookUrl,
  inputs,
}: {
  webhookUrl: string;
  inputs: ManifestInput[];
}) {
  const [tab, setTab] = useState<"curl" | "python" | "javascript">("curl");
  const [open, setOpen] = useState(false);
  const json = buildExampleJson(inputs);

  const curlSnippet = buildCurl(webhookUrl, inputs);

  const pythonSnippet = `import requests

resp = requests.post(
    "${webhookUrl}",
    json=${json.replace(/"/g, "'").replace(/\n/g, "\n    ")},
)
print(resp.json())`;

  const jsSnippet = `const resp = await fetch("${webhookUrl}", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(${json}),
});
const data = await resp.json();`;

  const snippets = { curl: curlSnippet, python: pythonSnippet, javascript: jsSnippet };

  return (
    <div className="border rounded-lg">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-3 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        Code Snippets
        {open ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
      </button>
      {open && (
        <div className="px-3 pb-3">
          <div className="flex items-center gap-1 mb-2">
            {(["curl", "python", "javascript"] as const).map((t) => (
              <Button
                key={t}
                variant={tab === t ? "default" : "ghost"}
                size="xs"
                onClick={() => setTab(t)}
              >
                {t === "javascript" ? "JS" : t.charAt(0).toUpperCase() + t.slice(1)}
              </Button>
            ))}
            <div className="ml-auto">
              <CopyButton text={snippets[tab]} />
            </div>
          </div>
          <pre className="bg-muted rounded-md p-2.5 text-xs overflow-x-auto whitespace-pre-wrap break-all leading-relaxed">
            {snippets[tab]}
          </pre>
        </div>
      )}
    </div>
  );
}

function ApiReference() {
  const [open, setOpen] = useState(false);

  return (
    <div className="border rounded-lg">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-3 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        API Reference
        {open ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
      </button>
      {open && (
        <div className="px-3 pb-3 space-y-3 text-xs text-muted-foreground">
          <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5">
            <code className="bg-muted px-1.5 py-0.5 rounded text-[11px]">200</code><span>Success: <code>{`{ runId, status: "completed", result }`}</code></span>
            <code className="bg-muted px-1.5 py-0.5 rounded text-[11px]">202</code><span>Async: <code>{`{ runId, status: "running", pollUrl, retryAfter }`}</code></span>
            <code className="bg-muted px-1.5 py-0.5 rounded text-[11px]">400</code><span>Input validation failed</span>
            <code className="bg-muted px-1.5 py-0.5 rounded text-[11px]">404</code><span>Invalid token or webhook disabled</span>
            <code className="bg-muted px-1.5 py-0.5 rounded text-[11px]">429</code><span>Rate limit exceeded (200/hour)</span>
            <code className="bg-muted px-1.5 py-0.5 rounded text-[11px]">500</code><span>Script error (type + message + hint)</span>
          </div>
        </div>
      )}
    </div>
  );
}

export function WebhookTab({
  automationId,
  webhookEnabled,
  webhookTokenPrefix,
  webhookCreatedAt,
  manifest,
}: {
  automationId: string;
  webhookEnabled?: boolean;
  webhookTokenPrefix?: string;
  webhookCreatedAt?: number;
  manifest?: { inputs?: ManifestInput[] };
}) {
  const [tokenDialog, setTokenDialog] = useState<string | null>(null);
  const [showRegenerateConfirm, setShowRegenerateConfirm] = useState(false);

  const enableWebhook = useMutation(api.automations.enableWebhook);
  const disableWebhook = useMutation(api.automations.disableWebhook);
  const regenerateWebhook = useMutation(api.automations.regenerateWebhook);

  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL?.replace(".cloud", ".site") ?? "";
  const inputs = manifest?.inputs ?? [];

  const handleEnable = useCallback(async () => {
    const token = await enableWebhook({
      automationId: automationId as Id<"automations">,
    });
    setTokenDialog(token);
  }, [automationId, enableWebhook]);

  const handleDisable = useCallback(async () => {
    await disableWebhook({
      automationId: automationId as Id<"automations">,
    });
  }, [automationId, disableWebhook]);

  const handleRegenerate = useCallback(async () => {
    const token = await regenerateWebhook({
      automationId: automationId as Id<"automations">,
    });
    setShowRegenerateConfirm(false);
    setTokenDialog(token);
  }, [automationId, regenerateWebhook]);

  const isEnabled = webhookEnabled;

  // Not enabled — simple CTA
  if (!isEnabled) {
    return (
      <div className="p-4 max-w-xl">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Webhook</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Let external services trigger this automation via HTTP
            </p>
          </div>
          <Button size="sm" onClick={handleEnable}>Enable</Button>
        </div>

        {/* Token dialog appears after enable */}
        <TokenDialog
          token={tokenDialog}
          automationId={automationId}
          convexUrl={convexUrl}
          inputs={inputs}
          onClose={() => setTokenDialog(null)}
        />
      </div>
    );
  }

  return (
    <div className="p-4 max-w-xl space-y-3">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="size-2 rounded-full bg-green-500" />
          <span className="text-sm font-medium">Webhook enabled</span>
          {webhookTokenPrefix && (
            <span className="text-xs text-muted-foreground font-mono">
              {webhookTokenPrefix}...
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="xs"
            onClick={() => setShowRegenerateConfirm(true)}
          >
            <RefreshCw className="size-3" />
            Regenerate
          </Button>
          <Button variant="ghost" size="xs" onClick={handleDisable}>
            Disable
          </Button>
        </div>
      </div>

      <CodeSnippets
        webhookUrl={`${convexUrl}/api/hooks/${automationId}/YOUR_TOKEN`}
        inputs={inputs}
      />
      <ApiReference />

      {/* Token dialog — after enable or regenerate */}
      <TokenDialog
        token={tokenDialog}
        automationId={automationId}
        convexUrl={convexUrl}
        inputs={inputs}
        onClose={() => setTokenDialog(null)}
      />

      {/* Regenerate confirmation */}
      <Dialog open={showRegenerateConfirm} onOpenChange={setShowRegenerateConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Regenerate webhook token</DialogTitle>
            <DialogDescription>
              This will invalidate the current URL. External services using the
              old URL will stop working immediately.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRegenerateConfirm(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleRegenerate}>
              Regenerate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function TokenDialog({
  token,
  automationId,
  convexUrl,
  inputs,
  onClose,
}: {
  token: string | null;
  automationId: string;
  convexUrl: string;
  inputs: ManifestInput[];
  onClose: () => void;
}) {
  if (!token) return null;

  const webhookUrl = `${convexUrl}/api/hooks/${automationId}/${token}`;
  const curl = buildCurl(webhookUrl, inputs);

  return (
    <Dialog open={true} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Webhook URL created</DialogTitle>
          <DialogDescription>
            This URL won&apos;t be shown again. Copy the curl command below to test it.
          </DialogDescription>
        </DialogHeader>
        <div className="relative">
          <pre className="bg-muted rounded-lg p-3 text-xs overflow-x-auto whitespace-pre-wrap break-all leading-relaxed pr-12">
            {curl}
          </pre>
          <div className="absolute top-2 right-2">
            <CopyButton text={curl} label="Copy" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

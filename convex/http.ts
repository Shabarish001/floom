import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import { sha256Hash } from "./lib/crypto";

const http = httpRouter();

// Helper: verify floom_... API key from Authorization header.
// SHA-256 hashes the key and looks it up in the apiKeys table.
async function verifyApiKey(
  request: Request,
  ctx: { runQuery: Function }
): Promise<{ orgId: Id<"organizations">; keyId: Id<"apiKeys">; keyName: string }> {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    throw new Error("Missing Authorization header");
  }
  const rawKey = authHeader.slice(7).trim();

  const hashedKey = await sha256Hash(rawKey);

  const apiKey = await ctx.runQuery(internal.apiKeys.getByHashedKey, {
    hashedKey,
  });
  if (!apiKey) throw new Error("Invalid API key");
  if (apiKey.revokedAt) throw new Error("API key has been revoked");

  return { orgId: apiKey.orgId, keyId: apiKey._id, keyName: apiKey.name };
}

const DEFAULT_WAIT_SECONDS = 10;
const MAX_WAIT_SECONDS = 10;

function parseWaitSeconds(body: { wait?: unknown }): number {
  if (body.wait === undefined || body.wait === null) return DEFAULT_WAIT_SECONDS;
  const n = Number(body.wait);
  if (isNaN(n) || n < 0) return 0;
  return Math.min(n, MAX_WAIT_SECONDS);
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function errorResponse(message: string, status = 400): Response {
  return jsonResponse({ error: message }, status);
}

// Timing-safe string comparison to prevent timing attacks on token verification.
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

// Build a rich error response from a finished run document.
function buildErrorResponse(doc: any): { type: string; message: string; hint: string; runId?: string } {
  const errorType = doc.errorType ?? "runtime_error";
  const errorMsg = doc.error ?? "Unknown error";

  let hint: string;
  switch (errorType) {
    case "missing_secret": {
      const match = errorMsg.match(/KeyError:\s*'?([^'"\s]+)/);
      const secretName = match?.[1] ?? "the required secret";
      hint = `Set the ${secretName} secret in your automation's settings`;
      break;
    }
    case "syntax_error":
      hint = "Fix the syntax error in your script and redeploy";
      break;
    case "timeout":
      hint = "Script exceeded the execution timeout. Optimize your code or reduce input size";
      break;
    case "sandbox_error":
      hint = "Internal execution error. Try again or contact support";
      break;
    case "runtime_error":
    default:
      hint = "Check the error message and fix your script";
      break;
  }

  // Truncate raw error message to prevent leaking sensitive data from script output
  const safeMessage = errorMsg.length > 500 ? errorMsg.slice(0, 500) + "..." : errorMsg;
  return { type: errorType, message: safeMessage, hint };
}

// POST /api/artifacts/upload-url — Step 1: get presigned PUT URL for zip upload.
http.route({
  path: "/api/artifacts/upload-url",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    try {
      const { orgId } = await verifyApiKey(request, ctx);

      const result = await ctx.runAction(internal.artifactActions.generateUploadUrl, {
        orgId: orgId as string,
      });

      return jsonResponse({ uploadUrl: result.uploadUrl, r2Key: result.r2Key });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      if (msg.includes("Unauthorized") || msg.includes("Invalid API key") || msg.includes("revoked")) {
        return errorResponse(msg, 401);
      }
      return errorResponse(msg, 400);
    }
  }),
});

// POST /api/artifacts — Step 3: validate zip + create artifact.
http.route({
  path: "/api/artifacts",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    try {
      const { orgId, keyId } = await verifyApiKey(request, ctx);

      const body = (await request.json()) as {
        manifest: unknown;
        entrypoint: string;
        r2Key: string;
      };

      if (!body.manifest || !body.entrypoint || !body.r2Key) {
        return errorResponse("manifest, entrypoint, and r2Key are required");
      }

      const result = await ctx.runAction(internal.artifactActions.processAndCreate, {
        orgId,
        manifest: body.manifest,
        entrypoint: body.entrypoint,
        r2Key: body.r2Key,
        createdBy: keyId as string,
      });

      return jsonResponse({ artifactId: result.artifactId });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      if (msg.includes("Unauthorized") || msg.includes("Invalid API key") || msg.includes("revoked")) {
        return errorResponse(msg, 401);
      }
      if (msg.includes("too large") || msg.includes("exceeds")) {
        return errorResponse(msg, 413);
      }
      return errorResponse(msg, 400);
    }
  }),
});

// POST /api/test — run artifact in sandbox before deploying.
http.route({
  path: "/api/test",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    try {
      const { orgId } = await verifyApiKey(request, ctx);

      const body = (await request.json()) as {
        artifactId: string;
        inputs: unknown;
        automationId?: string;
        wait?: number;
      };

      if (!body.artifactId) {
        return errorResponse("artifactId is required");
      }

      // Fetch artifact and verify org ownership
      const artifact = await ctx.runQuery(internal.artifacts.get, {
        id: body.artifactId as Id<"artifacts">,
      });
      if (!artifact) {
        return errorResponse("Artifact not found", 404);
      }
      if (artifact.orgId !== orgId) {
        return errorResponse("Forbidden", 403);
      }

      const result = await ctx.runMutation(
        internal.testRuns.triggerTestInternal,
        {
          orgId,
          artifactId: body.artifactId as Id<"artifacts">,
          inputs: body.inputs ?? {},
          automationId: body.automationId
            ? (body.automationId as Id<"automations">)
            : undefined,
        }
      );

      const waitSecs = parseWaitSeconds(body);
      if (waitSecs > 0) {
        try {
          const doc = await ctx.runAction(
            internal.lib.waitForResult.waitForTestRun,
            { testRunId: result.testRunId, waitMs: waitSecs * 1000 }
          );
          if (doc && ["success", "error", "timeout"].includes(doc.status)) {
            return jsonResponse({ testRunId: result.testRunId, status: doc.status, result: doc });
          }
          return jsonResponse({ testRunId: result.testRunId, status: doc?.status ?? "pending" });
        } catch {
          // Wait failed — fall back to returning just the ID
          return jsonResponse({ testRunId: result.testRunId });
        }
      }

      return jsonResponse({ testRunId: result.testRunId });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      if (msg.includes("Unauthorized") || msg.includes("Invalid API key") || msg.includes("revoked")) {
        return errorResponse(msg, 401);
      }
      return errorResponse(msg, 400);
    }
  }),
});

// GET /api/test-runs/:id — poll test run status.
http.route({
  pathPrefix: "/api/test-runs/",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    try {
      const url = new URL(request.url);
      const testRunId = url.pathname.split("/")[3];
      if (!testRunId) return errorResponse("Test run ID required");

      const { orgId } = await verifyApiKey(request, ctx);

      const testRun = await ctx.runQuery(internal.testRuns.getInternal, {
        testRunId: testRunId as Id<"testRuns">,
      });

      if (!testRun || testRun.orgId !== orgId) {
        return errorResponse("Test run not found", 404);
      }

      return jsonResponse(testRun);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      return errorResponse(msg, 400);
    }
  }),
});

// POST /api/deploy — deploy from an artifact.
http.route({
  path: "/api/deploy",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    try {
      const { orgId, keyName } = await verifyApiKey(request, ctx);

      const body = (await request.json()) as {
        artifactId: string;
        name?: string;
        description?: string;
        changeNote?: string;
      };

      if (!body.artifactId) {
        return errorResponse("artifactId is required");
      }

      // Fetch and validate the artifact
      const artifact = await ctx.runQuery(internal.artifacts.get, {
        id: body.artifactId as Id<"artifacts">,
      });

      if (!artifact) {
        return errorResponse("Artifact not found", 404);
      }
      if (artifact.orgId !== orgId) {
        return errorResponse("Forbidden", 403);
      }

      const result = await ctx.runMutation(internal.automations.deployInternal, {
        artifactId: body.artifactId as Id<"artifacts">,
        changeNote: body.changeNote,
        clerkUserId: "api:" + keyName,
        orgId,
      });

      const platformUrl =
        process.env.NEXT_PUBLIC_APP_URL ?? "https://dashboard.floom.dev";

      return jsonResponse({
        id: result.id,
        url: `${platformUrl}/a/${result.id}`,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      if (msg.includes("Unauthorized") || msg.includes("Invalid API key") || msg.includes("revoked")) {
        return errorResponse(msg, 401);
      }
      return errorResponse(msg, 400);
    }
  }),
});

// GET /api/automations — list automations for the authenticated org.
http.route({
  path: "/api/automations",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    try {
      const { orgId } = await verifyApiKey(request, ctx);

      const url = new URL(request.url);
      const q = url.searchParams.get("q") ?? undefined;

      const automations = await ctx.runQuery(
        internal.automations.listInternal,
        { orgId, q }
      );

      const platformUrl =
        process.env.NEXT_PUBLIC_APP_URL ?? "https://dashboard.floom.dev";

      const withUrls = automations.map((a: any) => ({
        ...a,
        url: `${platformUrl}/a/${a.id}`,
      }));

      return jsonResponse({ automations: withUrls });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      if (
        msg.includes("Unauthorized") ||
        msg.includes("Invalid API key") ||
        msg.includes("revoked")
      ) {
        return errorResponse(msg, 401);
      }
      return errorResponse(msg, 400);
    }
  }),
});

// GET /api/automations/:id — full automation detail including code.
http.route({
  pathPrefix: "/api/automations/",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    try {
      const url = new URL(request.url);
      const automationId = url.pathname.split("/")[3];
      if (!automationId) return errorResponse("Automation ID required");

      const { orgId } = await verifyApiKey(request, ctx);

      const automation = await ctx.runQuery(
        internal.automations.getDetailInternal,
        { id: automationId as Id<"automations">, orgId }
      );

      if (!automation) {
        return errorResponse("Automation not found", 404);
      }

      const platformUrl =
        process.env.NEXT_PUBLIC_APP_URL ?? "https://dashboard.floom.dev";

      return jsonResponse({
        ...automation,
        url: `${platformUrl}/a/${automation.id}`,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      if (
        msg.includes("Unauthorized") ||
        msg.includes("Invalid API key") ||
        msg.includes("revoked")
      ) {
        return errorResponse(msg, 401);
      }
      return errorResponse(msg, 400);
    }
  }),
});

// POST /api/automations/:id/update|run|rollback — skill updates, triggers, or rolls back automation.
http.route({
  pathPrefix: "/api/automations/",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    try {
      const url = new URL(request.url);
      const parts = url.pathname.split("/");
      // /api/automations/{id}/update
      const automationId = parts[3];
      const action = parts[4];

      if (!automationId) return errorResponse("Automation ID required");

      const { orgId, keyName } = await verifyApiKey(request, ctx);

      const body = (await request.json()) as {
        artifactId?: string;
        changeNote?: string;
        inputs?: unknown;
        versionId?: string;
        wait?: number;
      };

      if (action === "update") {
        if (!body.artifactId) {
          return errorResponse("artifactId is required");
        }

        // Fetch and validate the artifact
        const artifact = await ctx.runQuery(internal.artifacts.get, {
          id: body.artifactId as Id<"artifacts">,
        });

        if (!artifact) {
          return errorResponse("Artifact not found", 404);
        }
        if (artifact.orgId !== orgId) {
          return errorResponse("Forbidden", 403);
        }

        // Verify org ownership of the automation
        const automation = await ctx.runQuery(internal.automations.getInternal, {
          id: automationId as Id<"automations">,
        });
        if (!automation || automation.orgId !== orgId) {
          return errorResponse("Forbidden", 403);
        }

        const result = await ctx.runMutation(internal.automations.updateInternal, {
          id: automationId as Id<"automations">,
          artifactId: body.artifactId as Id<"artifacts">,
          changeNote: body.changeNote,
          clerkUserId: "api:" + keyName,
        });

        return jsonResponse(result);
      }

      if (action === "run") {
        const result = await ctx.runMutation(internal.runs.triggerInternal, {
          automationId: automationId as Id<"automations">,
          inputs: body.inputs ?? {},
          triggeredBy: "skill",
          clerkUserId: "api:" + keyName,
          orgId,
        });

        const waitSecs = parseWaitSeconds(body);
        if (waitSecs > 0) {
          try {
            const doc = await ctx.runAction(
              internal.lib.waitForResult.waitForRun,
              { runId: result.runId, waitMs: waitSecs * 1000 }
            );
            if (doc && ["success", "error", "timeout"].includes(doc.status)) {
              return jsonResponse({ runId: result.runId, status: doc.status, result: doc });
            }
            return jsonResponse({ runId: result.runId, status: doc?.status ?? "pending" });
          } catch {
            return jsonResponse(result);
          }
        }

        return jsonResponse(result);
      }

      if (action === "rollback") {
        if (!body.versionId) {
          return errorResponse("versionId is required");
        }

        const result = await ctx.runMutation(
          internal.automations.rollbackInternal,
          {
            id: automationId as Id<"automations">,
            versionId: body.versionId as Id<"automationVersions">,
            orgId,
          }
        );

        return jsonResponse(result);
      }

      return errorResponse("Unknown action", 404);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      if (msg.includes("Unauthorized") || msg.includes("Invalid API key") || msg.includes("revoked")) {
        return errorResponse(msg, 401);
      }
      if (msg.includes("Forbidden")) return errorResponse(msg, 403);
      return errorResponse(msg, 400);
    }
  }),
});

// GET /api/secrets — list secret names (not values) for the org.
http.route({
  path: "/api/secrets",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    try {
      const { orgId } = await verifyApiKey(request, ctx);
      const names = await ctx.runQuery(internal.secrets.listNamesByOrg, { orgId });
      return jsonResponse({ secrets: names });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      if (msg.includes("Unauthorized") || msg.includes("Invalid API key") || msg.includes("revoked")) {
        return errorResponse(msg, 401);
      }
      return errorResponse(msg, 400);
    }
  }),
});

// POST /api/secrets — skill stores an org secret.
http.route({
  path: "/api/secrets",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    try {
      const { orgId } = await verifyApiKey(request, ctx);

      const body = (await request.json()) as { name: string; value: string };
      if (!body.name || !body.value) return errorResponse("name and value are required");

      const result = await ctx.runMutation(internal.secrets.upsertInternal, {
        orgId,
        name: body.name,
        value: body.value,
      });

      return jsonResponse(result);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      if (msg.includes("Unauthorized") || msg.includes("Invalid API key") || msg.includes("revoked")) {
        return errorResponse(msg, 401);
      }
      return errorResponse(msg, 400);
    }
  }),
});

// GET /api/runs/:runId — skill polls run status.
// Supports two auth modes:
// 1. API key via Authorization header (org-scoped access)
// 2. viewToken via ?token= query param (for webhook/published run polling, no API key needed)
http.route({
  pathPrefix: "/api/runs/",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    try {
      const url = new URL(request.url);
      const runId = url.pathname.split("/")[3];
      if (!runId) return errorResponse("Run ID required");

      const viewToken = url.searchParams.get("token");

      // Auth mode 2: viewToken-based polling (webhook and published runs)
      if (viewToken) {
        const run = await ctx.runQuery(internal.runs.getInternal, {
          runId: runId as Id<"runs">,
        });
        if (!run) return errorResponse("Run not found", 404);
        if (!run.viewToken || run.viewToken !== viewToken) {
          return errorResponse("Run not found", 404);
        }
        return jsonResponse({
          status: run.status,
          outputs: run.outputs,
          error: run.error,
          errorType: run.errorType,
          durationMs: run.durationMs,
        });
      }

      // Auth mode 1: API key (org-scoped access)
      const { orgId } = await verifyApiKey(request, ctx);

      const run = await ctx.runQuery(internal.runs.getInternal, {
        runId: runId as Id<"runs">,
      });

      if (!run) return errorResponse("Run not found", 404);

      // Verify the run belongs to the API key's org
      const automation = await ctx.runQuery(internal.automations.getInternal, {
        id: run.automationId,
      });
      if (!automation || automation.orgId !== orgId) {
        return errorResponse("Run not found", 404);
      }

      return jsonResponse(run);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      return errorResponse(msg, 400);
    }
  }),
});

// GET /api/artifacts/:id/code — download artifact zip.
http.route({
  pathPrefix: "/api/artifacts/",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    try {
      const url = new URL(request.url);
      const parts = url.pathname.split("/");
      // /api/artifacts/:id/code
      const artifactId = parts[3];
      const action = parts[4];

      if (!artifactId || action !== "code") {
        return errorResponse("Not found", 404);
      }

      const { orgId } = await verifyApiKey(request, ctx);

      const artifact = await ctx.runQuery(internal.artifacts.get, {
        id: artifactId as Id<"artifacts">,
      });

      if (!artifact) return errorResponse("Artifact not found", 404);
      if (artifact.orgId !== orgId) return errorResponse("Forbidden", 403);

      const { url: downloadUrl } = await ctx.runAction(
        internal.artifactActions.getDownloadUrl,
        { r2Key: artifact.r2Key }
      );

      return jsonResponse({ downloadUrl, fileList: artifact.fileList });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      if (msg.includes("Unauthorized") || msg.includes("Invalid API key") || msg.includes("revoked")) {
        return errorResponse(msg, 401);
      }
      return errorResponse(msg, 400);
    }
  }),
});

// GET /api/hooks/:automationId/:token/schema — webhook schema endpoint.
http.route({
  pathPrefix: "/api/hooks/",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    try {
      const url = new URL(request.url);
      const parts = url.pathname.split("/");
      const automationId = parts[3];
      const token = parts[4];
      const action = parts[5]; // "schema"

      if (!automationId || !token) {
        return errorResponse("Not found", 404);
      }

      // Verify webhook token
      const automation = await ctx.runQuery(internal.automations.getInternal, {
        id: automationId as Id<"automations">,
      });
      if (!automation || !automation.webhookEnabled) {
        return errorResponse("Not found", 404);
      }
      const hashedToken = await sha256Hash(token);
      if (!automation.webhookTokenHash || !timingSafeEqual(hashedToken, automation.webhookTokenHash)) {
        return errorResponse("Not found", 404);
      }

      if (action !== "schema") {
        return errorResponse("Not found", 404);
      }

      // Get manifest from current version
      const version = automation.currentVersionId !== "placeholder"
        ? await ctx.runQuery(internal.runs.getVersionInternal, { versionId: automation.currentVersionId as Id<"automationVersions"> })
        : null;
      const artifact = version
        ? await ctx.runQuery(internal.artifacts.get, { id: version.artifactId })
        : null;
      const manifest = artifact?.manifest as any;

      return jsonResponse({
        name: automation.name,
        description: automation.description,
        inputs: manifest?.inputs ?? [],
        outputs: manifest?.outputs ?? {},
      });
    } catch {
      return errorResponse("Internal error", 500);
    }
  }),
});

// POST /api/hooks/:automationId/:token — webhook trigger endpoint.
http.route({
  pathPrefix: "/api/hooks/",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    try {
      const url = new URL(request.url);
      const parts = url.pathname.split("/");
      const automationId = parts[3];
      const token = parts[4];

      if (!automationId || !token || parts[5]) {
        return errorResponse("Not found", 404);
      }

      // Fetch automation — use uniform 404 for all auth failures to prevent ID enumeration
      const automation = await ctx.runQuery(internal.automations.getInternal, {
        id: automationId as Id<"automations">,
      });
      if (!automation || !automation.webhookEnabled) {
        return errorResponse("Not found", 404);
      }
      if (automation.status !== "active") {
        return errorResponse("Not found", 404);
      }

      // Timing-safe token comparison
      const hashedToken = await sha256Hash(token);
      if (!automation.webhookTokenHash || !timingSafeEqual(hashedToken, automation.webhookTokenHash)) {
        return errorResponse("Not found", 404);
      }

      // Parse body
      let body: Record<string, unknown> = {};
      try {
        const text = await request.text();
        if (text.trim()) {
          body = JSON.parse(text);
          if (typeof body !== "object" || Array.isArray(body) || body === null) {
            return errorResponse("Request body must be a JSON object", 400);
          }
        }
      } catch {
        return errorResponse("Invalid JSON in request body", 400);
      }

      // Get manifest for input validation
      const version = automation.currentVersionId !== "placeholder"
        ? await ctx.runQuery(internal.runs.getVersionInternal, { versionId: automation.currentVersionId as Id<"automationVersions"> })
        : null;
      if (!version) {
        return errorResponse("Automation is still deploying", 400);
      }
      const artifact = await ctx.runQuery(internal.artifacts.get, { id: version.artifactId });
      const manifest = artifact?.manifest as any;

      // Validate inputs against manifest
      if (manifest?.inputs && Array.isArray(manifest.inputs) && manifest.inputs.length > 0) {
        const { validateInputs } = await import("./lib/validateInputs");
        const validation = validateInputs(body, manifest.inputs);
        if (!validation.valid) {
          return jsonResponse({
            error: {
              type: "validation_error",
              message: "Input validation failed",
              details: validation.errors,
            },
          }, 400);
        }
      }

      // Parse wait parameter from query string
      const waitParam = url.searchParams.get("wait");
      const waitSecs = waitParam !== null
        ? Math.min(Math.max(0, Number(waitParam) || 0), MAX_WAIT_SECONDS)
        : DEFAULT_WAIT_SECONDS;

      // Trigger the run
      const result = await ctx.runMutation(internal.runs.triggerInternal, {
        automationId: automationId as Id<"automations">,
        inputs: body,
        triggeredBy: "webhook",
        clerkUserId: "webhook:" + automationId,
        orgId: automation.orgId,
      });

      const runId = result.runId;
      const viewToken = result.viewToken;

      // Build absolute poll URL
      const origin = url.origin;
      const pollUrl = viewToken
        ? `${origin}/api/runs/${runId}?token=${viewToken}`
        : `${origin}/api/runs/${runId}`;

      // Wait for result if requested
      if (waitSecs > 0) {
        try {
          const doc = await ctx.runAction(
            internal.lib.waitForResult.waitForRun,
            { runId, waitMs: waitSecs * 1000 }
          );
          if (doc && ["success", "error", "timeout"].includes(doc.status)) {
            if (doc.status === "success") {
              return jsonResponse({
                runId,
                status: "completed",
                result: doc.outputs,
              });
            }
            // Rich error response (Step 9)
            return jsonResponse({
              runId,
              status: "error",
              error: buildErrorResponse(doc),
            }, 500);
          }
        } catch {
          // Wait failed — return async response
        }
      }

      // Async response (Step 10)
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
      return jsonResponse({
        runId,
        status: "running",
        pollUrl,
        retryAfter: 2,
        expiresAt,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      if (msg.includes("Rate limit")) {
        return jsonResponse(
          { error: { type: "rate_limit", message: msg, hint: "Try again later" } },
          429
        );
      }
      return errorResponse(msg, 500);
    }
  }),
});

export default http;

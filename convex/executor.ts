"use node";

import { ActionCtx, internalAction } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { Sandbox } from "@e2b/code-interpreter";
import { generateDownloadUrl, getR2Client } from "./files";
import { GetObjectCommand } from "@aws-sdk/client-s3";

const EXECUTION_TIMEOUT_S = 5 * 60; // 5 minutes

// Static runner script — no string interpolation. Reads config from _runner_config.json.
const RUNNER_PY = `import sys, json
sys.path.insert(0, '/home/user')

with open('/home/user/_runner_config.json') as f:
    _config = json.load(f)

import importlib
_ep = _config['entrypoint'].replace('/', '.').removesuffix('.py')
try:
    _mod = importlib.import_module(_ep)
    _run = getattr(_mod, 'run')
except (ModuleNotFoundError, AttributeError, ValueError, ImportError) as e:
    print(json.dumps({"error": str(e),
        "hint": "Entrypoint module must define a module-level run() function. "
                "Check: missing __init__.py? run() inside if __name__ guard?"}))
    sys.exit(1)

class _PlatformEncoder(json.JSONEncoder):
    def default(self, obj):
        import datetime as _dt, decimal as _dec, uuid as _uuid
        if isinstance(obj, (_dt.date, _dt.datetime)):
            return obj.isoformat()
        if isinstance(obj, _dec.Decimal):
            return float(obj)
        if isinstance(obj, _uuid.UUID):
            return str(obj)
        try:
            import numpy as _np
            if isinstance(obj, _np.integer): return int(obj)
            if isinstance(obj, _np.floating): return float(obj)
            if isinstance(obj, _np.ndarray): return obj.tolist()
        except ImportError:
            pass
        return super().default(obj)

_result = _run(**_config.get('inputs', {}))
if not isinstance(_result, dict):
    print(json.dumps({"error": f"run() returned {type(_result).__name__}, expected dict"}))
    sys.exit(1)
print(json.dumps(_result, cls=_PlatformEncoder))
`;

type Timing = {
  sandboxStartupMs: number;
  pipInstallMs: number;
  zipDownloadMs: number;
  zipExtractionMs: number;
  executionMs: number;
  totalMs: number;
};

type FinishResult = {
  status: "success" | "error" | "timeout";
  errorType:
    | "timeout"
    | "syntax_error"
    | "runtime_error"
    | "missing_secret"
    | "sandbox_error"
    | null;
  error: string | null;
  outputs: unknown;
  logs: string;
  durationMs: number;
  timing: Timing;
};

/**
 * Shared sandbox execution logic used by both normal runs and test runs.
 * Artifact is zip-based: r2Key points to a zip in R2, entrypoint is the
 * module path within the zip, manifest carries dependency/input metadata.
 */
async function executeInSandbox(params: {
  r2Key: string;
  entrypoint: string;
  manifest: {
    python_dependencies?: string[];
    inputs?: Array<{ name: string; type: string }>;
  };
  inputs: Record<string, unknown>;
  secrets: Record<string, string>;
}): Promise<FinishResult> {
  const wallStart = Date.now();
  const { r2Key, entrypoint, manifest, inputs, secrets } = params;
  const deps = manifest.python_dependencies ?? [];

  let sandbox: Sandbox | null = null;
  let logs = "";

  const timing: Timing = {
    sandboxStartupMs: 0,
    pipInstallMs: 0,
    zipDownloadMs: 0,
    zipExtractionMs: 0,
    executionMs: 0,
    totalMs: 0,
  };

  try {
    // --- Sandbox startup ---
    const sandboxStart = Date.now();
    sandbox = await Sandbox.create({
      apiKey: process.env.E2B_API_KEY,
      envs: secrets,
      timeoutMs: EXECUTION_TIMEOUT_S * 1000,
    });
    timing.sandboxStartupMs = Date.now() - sandboxStart;

    // --- Pip install ---
    const pipStart = Date.now();
    if (deps.length > 0) {
      const pkgList = deps.map((d) => JSON.stringify(d)).join(" ");
      const installOut = await sandbox.commands.run(
        `python3 -m pip install -q ${pkgList}`,
        { timeoutMs: 60_000 }
      );
      if (installOut.exitCode !== 0) {
        throw new Error(
          `Dependency install failed: ${installOut.stderr ?? "unknown error"}`
        );
      }
    }
    timing.pipInstallMs = Date.now() - pipStart;

    // --- Resolve file inputs: replace R2 keys with presigned GET URLs ---
    const resolvedInputs = { ...inputs };
    const manifestInputs = manifest.inputs ?? [];
    for (const mi of manifestInputs) {
      const val = resolvedInputs[mi.name];
      if (
        mi.type === "file" &&
        typeof val === "string" &&
        !val.startsWith("http")
      ) {
        resolvedInputs[mi.name] = await generateDownloadUrl(val, 600);
      }
    }

    // --- Download zip from R2 ---
    const zipDownloadStart = Date.now();
    const r2 = getR2Client();
    const codeBucket = process.env.R2_CODE_BUCKET_NAME;
    if (!codeBucket) throw new Error("R2_CODE_BUCKET_NAME not configured");
    const getCmd = new GetObjectCommand({
      Bucket: codeBucket,
      Key: r2Key,
    });
    const r2Response = await r2.send(getCmd);
    if (!r2Response.Body) {
      throw new Error(`R2 returned empty body for key: ${r2Key}`);
    }
    const zipBuffer = Buffer.from(await r2Response.Body.transformToByteArray());
    timing.zipDownloadMs = Date.now() - zipDownloadStart;

    // --- Upload zip + extract in sandbox ---
    const zipExtractionStart = Date.now();
    await sandbox.files.write(
      "/tmp/code.zip",
      zipBuffer.buffer.slice(
        zipBuffer.byteOffset,
        zipBuffer.byteOffset + zipBuffer.byteLength
      ) as ArrayBuffer
    );
    const unzipOut = await sandbox.commands.run(
      "unzip -o /tmp/code.zip -d /home/user",
      { timeoutMs: 30_000 }
    );
    if (unzipOut.exitCode !== 0) {
      throw new Error(`Unzip failed: ${unzipOut.stderr ?? "unknown error"}`);
    }
    // Verify entrypoint was extracted
    const lsCheck = await sandbox.commands.run(`test -f /home/user/${entrypoint}`, { timeoutMs: 5_000 });
    if (lsCheck.exitCode !== 0) {
      throw new Error(`Entrypoint "${entrypoint}" not found after extraction`);
    }
    timing.zipExtractionMs = Date.now() - zipExtractionStart;

    // --- Write runner config ---
    const runnerConfig = JSON.stringify({ entrypoint, inputs: resolvedInputs });
    await sandbox.files.write("/home/user/_runner_config.json", runnerConfig);

    // --- Write static runner script ---
    await sandbox.files.write("/home/user/_runner.py", RUNNER_PY);

    // --- Execute ---
    const execStart = Date.now();
    const result = await sandbox.commands.run("python3 /home/user/_runner.py", {
      timeoutMs: EXECUTION_TIMEOUT_S * 1000,
    });
    timing.executionMs = Date.now() - execStart;

    logs = result.stdout ?? "";
    if (result.stderr) logs += `\n[stderr]\n${result.stderr}`;

    // Non-zero exit = user code error
    if (result.exitCode !== 0) {
      const stderr = result.stderr ?? "";
      const stdout = (result.stdout ?? "").trim();

      // Try to parse structured JSON error from stdout (written by _runner.py importlib block)
      let structuredError: { error?: string; hint?: string } | null = null;
      if (stdout) {
        try {
          const parsed = JSON.parse(stdout.split("\n").pop()?.trim() ?? "");
          if (parsed && typeof parsed.error === "string") {
            structuredError = parsed;
          }
        } catch {
          // not JSON
        }
      }

      let errorType: "syntax_error" | "runtime_error" | "missing_secret" =
        "runtime_error";
      if (/ModuleNotFoundError/i.test(stderr) || structuredError) {
        errorType = "runtime_error";
      } else if (/SyntaxError/i.test(stderr)) {
        errorType = "syntax_error";
      } else if (/KeyError.*SECRET_/i.test(stderr)) {
        errorType = "missing_secret";
      }

      let errorMsg = stderr || `Exit code ${result.exitCode}`;
      if (structuredError) {
        errorMsg = structuredError.error ?? errorMsg;
        if (structuredError.hint) errorMsg += `\nHint: ${structuredError.hint}`;
      }

      timing.totalMs = Date.now() - wallStart;
      return {
        status: "error",
        errorType,
        error: errorMsg,
        outputs: null,
        logs,
        durationMs: timing.totalMs,
        timing,
      };
    }

    // Parse last stdout line as JSON output
    const lastLine =
      (result.stdout ?? "").trim().split("\n").pop()?.trim() ?? "";
    let outputs: unknown;
    try {
      outputs = JSON.parse(lastLine);
    } catch {
      outputs = { result: lastLine || logs };
    }

    timing.totalMs = Date.now() - wallStart;
    return {
      status: "success",
      errorType: null,
      error: null,
      outputs,
      logs,
      durationMs: timing.totalMs,
      timing,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const isTimeout =
      msg.toLowerCase().includes("timeout") ||
      msg.toLowerCase().includes("timed out");

    timing.totalMs = Date.now() - wallStart;
    return {
      status: isTimeout ? "timeout" : "error",
      errorType: isTimeout ? "timeout" : "sandbox_error",
      error: msg,
      outputs: null,
      logs,
      durationMs: timing.totalMs,
      timing,
    };
  } finally {
    if (sandbox) {
      try {
        await sandbox.kill();
      } catch {
        // Ignore sandbox cleanup errors
      }
    }
  }
}

// Execute a deployed automation run (code from artifacts via automationVersions).
export const executeRun = internalAction({
  args: { runId: v.id("runs") },
  handler: async (ctx, args) => {
    const run = await ctx.runQuery(internal.runs.getInternal, {
      runId: args.runId,
    });
    if (!run) throw new Error("Run not found");

    const version = await ctx.runQuery(internal.runs.getVersionInternal, {
      versionId: run.versionId,
    });
    if (!version) throw new Error("Version not found");

    // Fetch artifact for r2Key + entrypoint + manifest
    const artifact = await ctx.runQuery(internal.artifacts.get, {
      id: version.artifactId,
    });
    if (!artifact) {
      await ctx.runMutation(internal.runs.finishRun, {
        runId: args.runId,
        status: "error",
        errorType: "sandbox_error",
        error: "Artifact not found",
        outputs: null,
        logs: "",
        durationMs: 0,
      });
      return;
    }

    await ctx.runMutation(internal.runs.updateRunStatus, {
      runId: args.runId,
      status: "running",
    });

    const secrets = (await ctx.runQuery(internal.secrets.listDecrypted, {
      automationId: run.automationId,
    })) as Record<string, string>;

    const result = await executeInSandbox({
      r2Key: artifact.r2Key as string,
      entrypoint: artifact.entrypoint as string,
      manifest: artifact.manifest as {
        python_dependencies?: string[];
        inputs?: Array<{ name: string; type: string }>;
      },
      inputs: run.inputs as Record<string, unknown>,
      secrets,
    });

    const { timing: _t, ...finishResult } = result;
    await ctx.runMutation(internal.runs.finishRun, {
      runId: args.runId,
      ...finishResult,
    });
  },
});

// Execute a test run (code from artifacts).
export const executeTestRun = internalAction({
  args: { testRunId: v.id("testRuns") },
  handler: async (ctx, args) => {
    const testRun = await ctx.runQuery(internal.testRuns.getInternal, {
      testRunId: args.testRunId,
    });
    if (!testRun) throw new Error("Test run not found");

    // Fetch artifact for r2Key + entrypoint + manifest
    const artifact = await ctx.runQuery(internal.artifacts.get, {
      id: testRun.artifactId,
    });
    if (!artifact) {
      await ctx.runMutation(internal.testRuns.finishTestRun, {
        testRunId: args.testRunId,
        status: "error",
        errorType: "sandbox_error",
        error: "Artifact not found",
        outputs: null,
        logs: "",
        durationMs: 0,
      });
      return;
    }

    await ctx.runMutation(internal.testRuns.updateStatus, {
      testRunId: args.testRunId,
      status: "running",
    });

    const secrets = (await ctx.runQuery(internal.secrets.listDecryptedByOrg, {
      orgId: testRun.orgId,
    })) as Record<string, string>;

    const result = await executeInSandbox({
      r2Key: artifact.r2Key as string,
      entrypoint: artifact.entrypoint as string,
      manifest: artifact.manifest as {
        python_dependencies?: string[];
        inputs?: Array<{ name: string; type: string }>;
      },
      inputs: testRun.inputs as Record<string, unknown>,
      secrets,
    });

    const { timing: _t2, ...finishResult2 } = result;
    await ctx.runMutation(internal.testRuns.finishTestRun, {
      testRunId: args.testRunId,
      ...finishResult2,
    });
  },
});

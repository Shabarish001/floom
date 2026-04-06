"use node";

import { internalAction, action } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import nodePath from "path";
import { validateManifestStructure } from "./lib/manifest";
import { getR2Client } from "./files";
import {
  PutObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import JSZip from "jszip";
import { createHash } from "crypto";

const CODE_BUCKET = () => {
  const bucket = process.env.R2_CODE_BUCKET_NAME;
  if (!bucket) throw new Error("R2_CODE_BUCKET_NAME not configured");
  return bucket;
};

const MAX_UNCOMPRESSED_SIZE = 50 * 1024 * 1024; // 50MB zip bomb limit
const MAX_UPLOAD_SIZE = 10 * 1024 * 1024; // 10MB compressed limit

// Reserved filenames that users cannot include (platform writes these at runtime).
const RESERVED_FILENAMES = new Set(["_runner.py", "_runner_config.json"]);

function validateFilePath(filePath: string): string | null {
  if (!filePath || filePath.length === 0) return "Empty file path";
  if (filePath.length > 255) return `Path too long: ${filePath}`;
  if (filePath.startsWith("/")) return `Absolute path not allowed: ${filePath}`;

  // Normalize and reject if normalization changes the path (detects encoded traversal)
  const normalized = nodePath.posix.normalize(filePath);
  if (normalized.startsWith("..") || normalized.includes("/..")) {
    return `Path traversal not allowed: ${filePath}`;
  }

  const basename = normalized.split("/").pop() ?? "";
  if (RESERVED_FILENAMES.has(basename)) {
    return `Reserved filename not allowed: ${basename}`;
  }

  // Reject null bytes
  if (filePath.includes("\0")) return `Null bytes not allowed in path: ${filePath}`;

  return null;
}

// Validate entrypoint is a valid Python module path (no hyphens, no dots in segments)
function validateEntrypoint(entrypoint: string): string | null {
  const segments = entrypoint.replace(/\.py$/, "").split("/");
  for (const seg of segments) {
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(seg)) {
      return `Entrypoint path segment "${seg}" is not a valid Python module name (use underscores, not hyphens)`;
    }
  }
  return null;
}

// Step 1 of 3: Generate a presigned PUT URL for uploading a zip to R2.
export const generateUploadUrl = internalAction({
  args: { orgId: v.string() },
  handler: async (_ctx, args) => {
    const bucket = CODE_BUCKET();
    const uuid = crypto.randomUUID();
    const r2Key = `artifacts/${args.orgId}/${uuid}.zip`;

    const client = getR2Client();
    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: r2Key,
      ContentType: "application/zip",
    });

    const uploadUrl = await getSignedUrl(client, command, { expiresIn: 3600 });
    return { uploadUrl, r2Key };
  },
});

// Step 3 of 3: Download zip from R2, validate, compute metadata, create artifact.
export const processAndCreate = internalAction({
  args: {
    orgId: v.id("organizations"),
    manifest: v.any(),
    entrypoint: v.string(),
    r2Key: v.string(),
    createdBy: v.string(),
  },
  handler: async (ctx, args) => {
    const bucket = CODE_BUCKET();
    const client = getR2Client();

    // Verify r2Key belongs to this org (prevent cross-org artifact injection)
    const expectedPrefix = `artifacts/${args.orgId}/`;
    if (!args.r2Key.startsWith(expectedPrefix)) {
      throw new Error("r2Key does not belong to this organization");
    }

    // Download zip from R2
    const getCommand = new GetObjectCommand({ Bucket: bucket, Key: args.r2Key });
    const response = await client.send(getCommand);
    if (!response.Body) throw new Error("Empty zip file in R2");

    const zipBuffer = Buffer.from(await response.Body.transformToByteArray());

    if (zipBuffer.length > MAX_UPLOAD_SIZE) {
      throw new Error(`Zip file too large: ${zipBuffer.length} bytes (max ${MAX_UPLOAD_SIZE})`);
    }

    // Parse zip
    let zip: JSZip;
    try {
      zip = await JSZip.loadAsync(zipBuffer);
    } catch {
      throw new Error("Invalid or corrupt zip file");
    }

    // Extract and validate all files
    const fileList: Array<{ path: string; size: number; hash: string }> = [];
    let totalUncompressed = 0;
    let entrypointFound = false;
    let entrypointContent = "";
    const seenPaths = new Set<string>();

    for (const [relativePath, zipEntry] of Object.entries(zip.files)) {
      if (zipEntry.dir) continue;

      // Normalize: strip leading ./ or /
      const path = relativePath.replace(/^\.\//, "").replace(/^\//, "");
      if (!path) continue;

      const pathError = validateFilePath(path);
      if (pathError) throw new Error(pathError);

      if (seenPaths.has(path)) throw new Error(`Duplicate path in zip: ${path}`);
      seenPaths.add(path);

      // Zip bomb check: cumulative uncompressed size
      const content = await zipEntry.async("nodebuffer");
      totalUncompressed += content.length;
      if (totalUncompressed > MAX_UNCOMPRESSED_SIZE) {
        throw new Error(
          `Uncompressed size exceeds ${MAX_UNCOMPRESSED_SIZE / 1024 / 1024}MB limit`
        );
      }

      const hash = createHash("sha256").update(content).digest("hex");
      fileList.push({ path, size: content.length, hash });

      if (path === args.entrypoint) {
        entrypointFound = true;
        entrypointContent = content.toString("utf-8");
      }
    }

    if (fileList.length === 0) throw new Error("Zip contains no files");

    // Validate entrypoint is a valid Python module path
    const epError = validateEntrypoint(args.entrypoint);
    if (epError) throw new Error(epError);

    if (!entrypointFound) {
      throw new Error(`Entrypoint "${args.entrypoint}" not found in zip`);
    }

    // Validate entrypoint has run() (regex heuristic, full validation at execution time)
    if (!/^def run\s*\(/m.test(entrypointContent)) {
      throw new Error(
        `Entrypoint "${args.entrypoint}" does not contain a module-level run() function`
      );
    }

    // Validate dependency names (prevent shell injection in pip install)
    const DEP_SAFE = /^[a-zA-Z0-9_\-\[\].,>=<!~^*\s]+$/;
    const deps = (args.manifest as { python_dependencies?: string[] }).python_dependencies ?? [];
    for (const dep of deps) {
      if (!DEP_SAFE.test(dep)) {
        throw new Error(`Invalid dependency name: ${dep}`);
      }
    }

    // Validate manifest structure against entrypoint code
    const manifest = args.manifest as Parameters<typeof validateManifestStructure>[1];
    const validationError = validateManifestStructure(entrypointContent, manifest);
    if (validationError) {
      throw new Error(`Manifest validation failed: ${validationError.message}`);
    }

    const totalSize = fileList.reduce((sum, f) => sum + f.size, 0);

    // Create artifact document
    const result: { artifactId: string } = await ctx.runMutation(internal.artifacts.create, {
      orgId: args.orgId,
      manifest: args.manifest,
      entrypoint: args.entrypoint,
      r2Key: args.r2Key,
      fileList,
      totalSize,
      fileCount: fileList.length,
      createdBy: args.createdBy,
    });

    return { artifactId: result.artifactId };
  },
});

// Generate a presigned GET URL to download the artifact zip.
export const getDownloadUrl = internalAction({
  args: { r2Key: v.string() },
  handler: async (_ctx, args) => {
    const bucket = CODE_BUCKET();
    const client = getR2Client();
    const command = new GetObjectCommand({ Bucket: bucket, Key: args.r2Key });
    return { url: await getSignedUrl(client, command, { expiresIn: 3600 }) };
  },
});

// Public action: get a download URL for a version's code zip.
export const getVersionDownloadUrl = action({
  args: { versionId: v.id("automationVersions") },
  handler: async (ctx, args): Promise<{ url: string }> => {
    // Auth: verify caller is authenticated and owns the automation
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const version = await ctx.runQuery(
      internal.automations.getVersionInternal,
      { versionId: args.versionId }
    );
    if (!version || !version.r2Key) {
      throw new Error("Version not found or has no code artifact");
    }

    // Verify org ownership: version → automation → org
    const automation = await ctx.runQuery(internal.automations.getInternal, {
      id: version.automationId,
    });
    if (!automation) throw new Error("Automation not found");

    const clerkOrgId =
      (identity as { org_id?: string }).org_id ?? identity.tokenIdentifier;
    const org = await ctx.runQuery(internal.users.getOrgByClerkOrgId, {
      clerkOrgId,
    });
    if (!org || automation.orgId !== org._id) {
      throw new Error("Forbidden");
    }

    const { url } = await ctx.runAction(internal.artifactActions.getDownloadUrl, {
      r2Key: version.r2Key,
    });
    return { url };
  },
});

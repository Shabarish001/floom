import { internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";

// Insert artifact document. Called by artifactActions.processAndCreate after validation.
export const create = internalMutation({
  args: {
    orgId: v.id("organizations"),
    manifest: v.any(),
    entrypoint: v.string(),
    r2Key: v.string(),
    fileList: v.array(
      v.object({
        path: v.string(),
        size: v.number(),
        hash: v.string(),
      })
    ),
    totalSize: v.number(),
    fileCount: v.number(),
    createdBy: v.string(),
  },
  handler: async (ctx, args) => {
    const artifactId = await ctx.db.insert("artifacts", {
      orgId: args.orgId,
      manifest: args.manifest,
      entrypoint: args.entrypoint,
      r2Key: args.r2Key,
      fileList: args.fileList,
      totalSize: args.totalSize,
      fileCount: args.fileCount,
      createdAt: Date.now(),
      createdBy: args.createdBy,
    });

    return { artifactId };
  },
});

// Get an artifact by ID.
export const get = internalQuery({
  args: { id: v.id("artifacts") },
  handler: async (ctx, args) => {
    return ctx.db.get(args.id);
  },
});

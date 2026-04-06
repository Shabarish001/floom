import { internalQuery, mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { sha256Hash } from "./lib/crypto";
import { requireAuth } from "./lib/auth";

function generateRawKey(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return (
    "floom_" +
    Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
  );
}

// Create a new API key for an org. Returns the full key (shown once).
// Rate-limited: max 1 key creation per org per 60 seconds.
export const create = mutation({
  args: {
    orgId: v.id("organizations"),
    name: v.string(),
  },
  handler: async (ctx, args) => {
    const { userId, orgId } = await requireAuth(ctx);

    // Verify caller belongs to the target org
    if (args.orgId !== orgId) throw new Error("Forbidden");

    // Rate limit: reject if most recent key was created < 60 seconds ago
    const existingKeys = await ctx.db
      .query("apiKeys")
      .withIndex("by_orgId", (q) => q.eq("orgId", args.orgId))
      .collect();
    const now = Date.now();
    const mostRecent = existingKeys.reduce(
      (latest, k) => (k.createdAt > latest ? k.createdAt : latest),
      0,
    );
    if (mostRecent > 0 && now - mostRecent < 60_000) {
      throw new Error("Rate limited: wait 60 seconds between key creations");
    }

    const rawKey = generateRawKey();
    const prefix = rawKey.slice(0, 12);
    const hashedKey = await sha256Hash(rawKey);

    await ctx.db.insert("apiKeys", {
      orgId,
      name: args.name,
      prefix,
      hashedKey,
      createdBy: userId,
      createdAt: Date.now(),
    });

    return rawKey; // Full key, shown once
  },
});

// List all API keys for an org (prefixes only, never full keys).
export const list = query({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, args) => {
    const { orgId } = await requireAuth(ctx);

    // Only allow listing keys for the caller's own org
    if (args.orgId !== orgId) return [];

    const keys = await ctx.db
      .query("apiKeys")
      .withIndex("by_orgId", (q) => q.eq("orgId", args.orgId))
      .collect();

    return keys.map((k) => ({
      _id: k._id,
      name: k.name,
      prefix: k.prefix,
      createdAt: k.createdAt,
      revokedAt: k.revokedAt ?? null,
    }));
  },
});

// Revoke an API key (soft delete).
export const revoke = mutation({
  args: { keyId: v.id("apiKeys") },
  handler: async (ctx, args) => {
    const { orgId } = await requireAuth(ctx);

    const key = await ctx.db.get(args.keyId);
    if (!key) throw new Error("API key not found");

    // Verify caller owns this key's org
    if (key.orgId !== orgId) throw new Error("Forbidden");

    // Already revoked? No-op.
    if (key.revokedAt) return;

    await ctx.db.patch(args.keyId, { revokedAt: Date.now() });
  },
});

// Check if an org has any (non-revoked) API keys.
export const hasKeys = query({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return false;

    const keys = await ctx.db
      .query("apiKeys")
      .withIndex("by_orgId", (q) => q.eq("orgId", args.orgId))
      .collect();

    return keys.some((k) => !k.revokedAt);
  },
});

// Create the first API key for an org (idempotent — skips if keys exist).
// Returns the raw key, or null if the org already has keys.
// Rate-limited: max 1 key creation per org per 60 seconds.
export const createFirstKey = mutation({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, args) => {
    const { userId, orgId } = await requireAuth(ctx);

    // Verify caller belongs to the target org
    if (args.orgId !== orgId) throw new Error("Forbidden");

    // Check if org already has any active (non-revoked) key
    const keys = await ctx.db
      .query("apiKeys")
      .withIndex("by_orgId", (q) => q.eq("orgId", args.orgId))
      .collect();

    // Rate limit: reject if most recent key was created < 60 seconds ago
    const now = Date.now();
    const mostRecent = keys.reduce(
      (latest, k) => (k.createdAt > latest ? k.createdAt : latest),
      0,
    );
    if (mostRecent > 0 && now - mostRecent < 60_000) {
      throw new Error("Rate limited: wait 60 seconds between key creations");
    }

    if (keys.some((k) => !k.revokedAt)) return null;

    const rawKey = generateRawKey();
    const prefix = rawKey.slice(0, 12);
    const hashedKey = await sha256Hash(rawKey);

    await ctx.db.insert("apiKeys", {
      orgId,
      name: "default",
      prefix,
      hashedKey,
      createdBy: userId,
      createdAt: Date.now(),
    });

    return rawKey;
  },
});

// Internal: look up an API key by its hash. Used by HTTP auth.
export const getByHashedKey = internalQuery({
  args: { hashedKey: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("apiKeys")
      .withIndex("by_hashedKey", (q) => q.eq("hashedKey", args.hashedKey))
      .unique();
  },
});

import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireAuth } from "./lib/auth";

// Complete workspace onboarding — stores optional website URL and marks onboarding done.
export const completeOnboarding = mutation({
  args: {
    websiteUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { orgId } = await requireAuth(ctx);

    // Validate and sanitize URL server-side if provided.
    // Handles: ports, paths, query params, fragments — all parsed by new URL().
    let websiteUrl = args.websiteUrl?.trim();
    if (websiteUrl === "") websiteUrl = undefined; // treat whitespace-only as empty

    if (websiteUrl) {
      if (websiteUrl.length > 2048) {
        throw new Error("URL too long");
      }
      try {
        const parsed = new URL(websiteUrl);
        if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
          throw new Error("Invalid URL: only http and https are allowed");
        }
      } catch (e) {
        if (e instanceof Error && e.message.startsWith("Invalid URL")) throw e;
        throw new Error("Invalid URL format");
      }
    }

    const patch: Record<string, unknown> = {
      onboardingComplete: true,
    };
    if (websiteUrl) {
      patch.websiteUrl = websiteUrl;
    }

    await ctx.db.patch(orgId, patch);
    return { orgId };
  },
});

// Check whether the current user's workspace has completed onboarding.
export const needsOnboarding = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return false;

    const clerkOrgId =
      (identity as { org_id?: string }).org_id ?? identity.tokenIdentifier;

    const org = await ctx.db
      .query("organizations")
      .withIndex("by_clerkOrgId", (q) => q.eq("clerkOrgId", clerkOrgId))
      .unique();

    // Org not yet created by UserSync — return null to signal "still loading"
    // so the client doesn't prematurely skip the redirect.
    if (!org) return null;

    return !org.onboardingComplete;
  },
});

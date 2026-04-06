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

    const patch: Record<string, unknown> = {
      onboardingComplete: true,
    };
    if (args.websiteUrl) {
      patch.websiteUrl = args.websiteUrl;
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

    if (!org) return false;

    return !org.onboardingComplete;
  },
});

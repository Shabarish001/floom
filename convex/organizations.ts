import { mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { requireAuth } from "./lib/auth";

// The onboardingComplete field remains in the schema for backward compatibility
// but is no longer actively used; the welcome page handles new-user flow via
// API key presence checks (hasKeys query).

/** Return the current user's workspace record for the settings page. */
export const getWorkspace = query({
  args: {},
  handler: async (ctx) => {
    const { orgId } = await requireAuth(ctx);
    const org = await ctx.db.get(orgId);
    if (!org) throw new Error("Workspace not found");
    return {
      _id: org._id,
      name: org.name,
      websiteUrl: org.websiteUrl,
      logoUrl: org.logoUrl,
      brandColors: org.brandColors,
      fonts: org.fonts,
      companyName: org.companyName,
      companyDescription: org.companyDescription,
      industry: org.industry,
      brandTone: org.brandTone,
    };
  },
});

/** Update workspace settings: name, website URL. Triggers scraper if URL changed. */
export const updateWorkspace = mutation({
  args: {
    name: v.optional(v.string()),
    websiteUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { orgId } = await requireAuth(ctx);

    const patch: Record<string, unknown> = {};

    // Name
    const name = args.name?.trim();
    if (name !== undefined) {
      if (name.length > 100) throw new Error("Name too long");
      patch.name = name || undefined;
    }

    // URL validation
    let websiteUrl = args.websiteUrl?.trim();
    if (websiteUrl === "") websiteUrl = undefined;

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

    // Only update websiteUrl if it was explicitly provided (even if empty to clear it)
    if (args.websiteUrl !== undefined) {
      patch.websiteUrl = websiteUrl;
    }

    if (Object.keys(patch).length > 0) {
      await ctx.db.patch(orgId, patch);
    }

    // Schedule scraper if a URL was provided
    if (websiteUrl) {
      await ctx.scheduler.runAfter(0, internal.scraper.scrapeWorkspaceUrl, {
        orgId,
        websiteUrl,
      });
    }

    return { orgId };
  },
});

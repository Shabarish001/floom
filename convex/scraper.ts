import { v } from "convex/values";
import { internalAction, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";

// --- Extraction helpers (pure functions, no dependencies) ---

/**
 * Extract the best logo/favicon URL from HTML.
 * Preference: apple-touch-icon > icon > shortcut icon > /favicon.ico fallback.
 */
function extractLogo(html: string, baseUrl: string): string | undefined {
  const candidates: { href: string; priority: number }[] = [];

  // Match <link> tags with rel containing icon variants
  const linkRegex =
    /<link\s[^>]*rel=["']([^"']*)["'][^>]*href=["']([^"']*)["'][^>]*\/?>/gi;
  const linkRegexAlt =
    /<link\s[^>]*href=["']([^"']*)["'][^>]*rel=["']([^"']*)["'][^>]*\/?>/gi;

  let match;
  while ((match = linkRegex.exec(html)) !== null) {
    const rel = match[1].toLowerCase();
    const href = match[2];
    if (href.startsWith("data:")) continue; // skip data URIs
    if (rel.includes("apple-touch-icon")) {
      candidates.push({ href, priority: 3 });
    } else if (rel === "icon" || rel.includes("icon")) {
      candidates.push({ href, priority: 2 });
    } else if (rel.includes("shortcut")) {
      candidates.push({ href, priority: 1 });
    }
  }

  // Also try the alternate attribute order (href before rel)
  while ((match = linkRegexAlt.exec(html)) !== null) {
    const href = match[1];
    if (href.startsWith("data:")) continue; // skip data URIs
    const rel = match[2].toLowerCase();
    if (rel.includes("apple-touch-icon")) {
      candidates.push({ href, priority: 3 });
    } else if (rel === "icon" || rel.includes("icon")) {
      candidates.push({ href, priority: 2 });
    } else if (rel.includes("shortcut")) {
      candidates.push({ href, priority: 1 });
    }
  }

  if (candidates.length === 0) {
    // Fallback to /favicon.ico
    try {
      return new URL("/favicon.ico", baseUrl).href;
    } catch {
      return undefined;
    }
  }

  // Sort by priority descending, pick the best non-data-URI candidate
  candidates.sort((a, b) => b.priority - a.priority);
  const best = candidates[0].href;

  // Final guard: if the top candidate is somehow a data URI, fall back
  if (best.startsWith("data:")) {
    try {
      return new URL("/favicon.ico", baseUrl).href;
    } catch {
      return undefined;
    }
  }

  try {
    return new URL(best, baseUrl).href;
  } catch {
    return undefined;
  }
}

/**
 * Extract brand colors from theme-color meta tag and CSS custom properties.
 */
function extractColors(html: string): string[] {
  const colors = new Set<string>();
  const hexRegex = /#(?:[0-9a-fA-F]{3,4}){1,2}\b/g;

  // <meta name="theme-color" content="...">
  const themeColorRegex =
    /<meta\s[^>]*name=["']theme-color["'][^>]*content=["']([^"']*)["'][^>]*\/?>/gi;
  const themeColorRegexAlt =
    /<meta\s[^>]*content=["']([^"']*)["'][^>]*name=["']theme-color["'][^>]*\/?>/gi;

  let match;
  while ((match = themeColorRegex.exec(html)) !== null) {
    const val = match[1].trim();
    const hexes = val.match(hexRegex);
    if (hexes) hexes.forEach((h) => colors.add(h));
  }
  while ((match = themeColorRegexAlt.exec(html)) !== null) {
    const val = match[1].trim();
    const hexes = val.match(hexRegex);
    if (hexes) hexes.forEach((h) => colors.add(h));
  }

  // Parse <style> blocks for CSS custom properties related to branding
  const styleRegex = /<style[^>]*>([\s\S]*?)<\/style>/gi;
  const brandPropRegex =
    /--(?:primary|brand|accent|color-primary|color-brand|color-accent)\s*:\s*([^;]+)/gi;

  while ((match = styleRegex.exec(html)) !== null) {
    const styleContent = match[1];
    brandPropRegex.lastIndex = 0;
    let propMatch;
    while ((propMatch = brandPropRegex.exec(styleContent)) !== null) {
      const val = propMatch[1].trim();
      const hexes = val.match(hexRegex);
      if (hexes) hexes.forEach((h) => colors.add(h));
    }
  }

  // Check body/html style attributes for background-color
  const bodyStyleRegex =
    /<(?:body|html)\s[^>]*style=["']([^"']*)["'][^>]*>/gi;
  while ((match = bodyStyleRegex.exec(html)) !== null) {
    const style = match[1];
    const bgMatch = /background-color\s*:\s*([^;]+)/i.exec(style);
    if (bgMatch) {
      const hexes = bgMatch[1].match(hexRegex);
      if (hexes) hexes.forEach((h) => colors.add(h));
    }
  }

  return Array.from(colors);
}

/**
 * Extract font family names from Google Fonts links and inline CSS.
 */
function extractFonts(html: string): string[] {
  const fonts = new Set<string>();

  // Google Fonts URLs: parse family parameter
  const gfRegex =
    /fonts\.googleapis\.com\/css2?\?[^"'\s>]*/gi;
  let match;
  while ((match = gfRegex.exec(html)) !== null) {
    const url = match[0];
    // Google Fonts uses family=Name:wght@... or family=Name+Other
    const familyRegex = /family=([^&:]+)/g;
    let familyMatch;
    while ((familyMatch = familyRegex.exec(url)) !== null) {
      const name = decodeURIComponent(familyMatch[1].replace(/\+/g, " "));
      fonts.add(name);
    }
  }

  // Inline <style> blocks: font-family on body/html selectors
  const styleRegex = /<style[^>]*>([\s\S]*?)<\/style>/gi;
  while ((match = styleRegex.exec(html)) !== null) {
    const styleContent = match[1];
    // Match body/html/root font-family declarations
    const ffRegex =
      /(?:body|html|:root)\s*\{[^}]*font-family\s*:\s*([^;]+)/gi;
    let ffMatch;
    while ((ffMatch = ffRegex.exec(styleContent)) !== null) {
      const families = ffMatch[1].split(",").map((f) =>
        f.trim().replace(/^["']|["']$/g, "")
      );
      // Take only the first (primary) font
      if (families[0] && !families[0].startsWith("-")) {
        fonts.add(families[0]);
      }
    }
  }

  return Array.from(fonts);
}

/**
 * Extract company name and description from meta tags.
 * Preference: og:site_name > <title> for name; og:description > description for desc.
 */
function extractMeta(html: string): {
  name: string | undefined;
  description: string | undefined;
} {
  let title: string | undefined;
  let metaDescription: string | undefined;
  let ogSiteName: string | undefined;
  let ogDescription: string | undefined;

  // <title>
  const titleMatch = /<title[^>]*>([^<]*)<\/title>/i.exec(html);
  if (titleMatch) {
    title = titleMatch[1].trim();
  }

  // <meta name="description" content="...">
  const descRegex =
    /<meta\s[^>]*name=["']description["'][^>]*content=["']([^"']*)["'][^>]*\/?>/i;
  const descRegexAlt =
    /<meta\s[^>]*content=["']([^"']*)["'][^>]*name=["']description["'][^>]*\/?>/i;
  const descMatch = descRegex.exec(html) || descRegexAlt.exec(html);
  if (descMatch) {
    metaDescription = descMatch[1].trim();
  }

  // <meta property="og:site_name" content="...">
  const ogNameRegex =
    /<meta\s[^>]*property=["']og:site_name["'][^>]*content=["']([^"']*)["'][^>]*\/?>/i;
  const ogNameRegexAlt =
    /<meta\s[^>]*content=["']([^"']*)["'][^>]*property=["']og:site_name["'][^>]*\/?>/i;
  const ogNameMatch = ogNameRegex.exec(html) || ogNameRegexAlt.exec(html);
  if (ogNameMatch) {
    ogSiteName = ogNameMatch[1].trim();
  }

  // <meta property="og:description" content="...">
  const ogDescRegex =
    /<meta\s[^>]*property=["']og:description["'][^>]*content=["']([^"']*)["'][^>]*\/?>/i;
  const ogDescRegexAlt =
    /<meta\s[^>]*content=["']([^"']*)["'][^>]*property=["']og:description["'][^>]*\/?>/i;
  const ogDescMatch = ogDescRegex.exec(html) || ogDescRegexAlt.exec(html);
  if (ogDescMatch) {
    ogDescription = ogDescMatch[1].trim();
  }

  return {
    name: ogSiteName || title || undefined,
    description: ogDescription || metaDescription || undefined,
  };
}

// --- Convex action: fetch + extract ---

export const scrapeWorkspaceUrl = internalAction({
  args: {
    orgId: v.id("organizations"),
    websiteUrl: v.string(),
  },
  handler: async (ctx, args) => {
    const { orgId, websiteUrl } = args;

    let html: string;
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10_000);

      const response = await fetch(websiteUrl, {
        signal: controller.signal,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (compatible; FloomBot/1.0; +https://floom.dev)",
          Accept: "text/html,application/xhtml+xml",
        },
        redirect: "follow",
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        console.error(
          `Scraper: HTTP ${response.status} fetching ${websiteUrl}`
        );
        return;
      }

      html = await response.text();
    } catch (error) {
      console.error(
        `Scraper: failed to fetch ${websiteUrl}:`,
        error instanceof Error ? error.message : String(error)
      );
      return;
    }

    // Determine base URL for resolving relative paths
    let baseUrl: string;
    try {
      const parsed = new URL(websiteUrl);
      baseUrl = `${parsed.protocol}//${parsed.host}`;
    } catch {
      console.error(`Scraper: invalid URL ${websiteUrl}`);
      return;
    }

    const logoUrl = extractLogo(html, baseUrl);
    const brandColors = extractColors(html);
    const fonts = extractFonts(html);
    const meta = extractMeta(html);

    await ctx.runMutation(internal.scraper.updateWorkspaceBranding, {
      orgId,
      logoUrl,
      brandColors: brandColors.length > 0 ? brandColors : undefined,
      fonts: fonts.length > 0 ? fonts : undefined,
      companyName: meta.name,
      companyDescription: meta.description,
    });
  },
});

// --- Internal mutation: persist scraped branding data ---

export const updateWorkspaceBranding = internalMutation({
  args: {
    orgId: v.id("organizations"),
    logoUrl: v.optional(v.string()),
    brandColors: v.optional(v.array(v.string())),
    fonts: v.optional(v.array(v.string())),
    companyName: v.optional(v.string()),
    companyDescription: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { orgId, ...branding } = args;

    // Only patch fields that have values
    const patch: Record<string, unknown> = {};
    if (branding.logoUrl !== undefined) patch.logoUrl = branding.logoUrl;
    if (branding.brandColors !== undefined)
      patch.brandColors = branding.brandColors;
    if (branding.fonts !== undefined) patch.fonts = branding.fonts;
    if (branding.companyName !== undefined)
      patch.companyName = branding.companyName;
    if (branding.companyDescription !== undefined)
      patch.companyDescription = branding.companyDescription;

    if (Object.keys(patch).length > 0) {
      await ctx.db.patch(orgId, patch);
    }
  },
});

import { v } from "convex/values";
import { internalAction, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";

// --- HTML sanitization ---

/**
 * Strip <script> and <noscript> blocks to avoid false matches in JS code.
 */
function sanitizeHtml(html: string): string {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, "");
}

// --- Extraction helpers (pure functions, no dependencies) ---

/**
 * Extract the best logo/favicon URL from HTML.
 * Preference: apple-touch-icon > mask-icon > icon > shortcut icon > og:image > /favicon.ico fallback.
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
      candidates.push({ href, priority: 4 });
    } else if (rel.includes("mask-icon")) {
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
      candidates.push({ href, priority: 4 });
    } else if (rel.includes("mask-icon")) {
      candidates.push({ href, priority: 3 });
    } else if (rel === "icon" || rel.includes("icon")) {
      candidates.push({ href, priority: 2 });
    } else if (rel.includes("shortcut")) {
      candidates.push({ href, priority: 1 });
    }
  }

  // Fallback: <meta property="og:image"> (many sites use this as a logo-like image)
  if (candidates.length === 0) {
    const ogImageRegex =
      /<meta\s[^>]*property=["']og:image["'][^>]*content=["']([^"']*)["'][^>]*\/?>/i;
    const ogImageRegexAlt =
      /<meta\s[^>]*content=["']([^"']*)["'][^>]*property=["']og:image["'][^>]*\/?>/i;
    const ogImageMatch = ogImageRegex.exec(html) || ogImageRegexAlt.exec(html);
    if (ogImageMatch && !ogImageMatch[1].startsWith("data:")) {
      candidates.push({ href: ogImageMatch[1], priority: 0 });
    }
  }

  if (candidates.length === 0) {
    // Final fallback to /favicon.ico
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
 * Extract brand colors from theme-color meta tag, msapplication-TileColor,
 * color-scheme meta, CSS custom properties, and Tailwind classes.
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

  // <meta name="msapplication-TileColor" content="...">
  const tileColorRegex =
    /<meta\s[^>]*name=["']msapplication-TileColor["'][^>]*content=["']([^"']*)["'][^>]*\/?>/gi;
  const tileColorRegexAlt =
    /<meta\s[^>]*content=["']([^"']*)["'][^>]*name=["']msapplication-TileColor["'][^>]*\/?>/gi;

  while ((match = tileColorRegex.exec(html)) !== null) {
    const val = match[1].trim();
    const hexes = val.match(hexRegex);
    if (hexes) hexes.forEach((h) => colors.add(h));
  }
  while ((match = tileColorRegexAlt.exec(html)) !== null) {
    const val = match[1].trim();
    const hexes = val.match(hexRegex);
    if (hexes) hexes.forEach((h) => colors.add(h));
  }

  // <meta name="color-scheme" content="..."> (values like "light", "dark", "light dark")
  const colorSchemeRegex =
    /<meta\s[^>]*name=["']color-scheme["'][^>]*content=["']([^"']*)["'][^>]*\/?>/gi;
  const colorSchemeRegexAlt =
    /<meta\s[^>]*content=["']([^"']*)["'][^>]*name=["']color-scheme["'][^>]*\/?>/gi;

  while ((match = colorSchemeRegex.exec(html)) !== null) {
    const val = match[1].trim();
    const hexes = val.match(hexRegex);
    if (hexes) hexes.forEach((h) => colors.add(h));
  }
  while ((match = colorSchemeRegexAlt.exec(html)) !== null) {
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

  // Tailwind bg-* classes on body/html elements: map common color names to hex
  const tailwindColorMap: Record<string, string> = {
    "slate-50": "#f8fafc", "slate-900": "#0f172a",
    "gray-50": "#f9fafb", "gray-900": "#111827",
    "zinc-50": "#fafafa", "zinc-900": "#18181b",
    "neutral-50": "#fafafa", "neutral-900": "#171717",
    "stone-50": "#fafaf9", "stone-900": "#1c1917",
    "red-500": "#ef4444", "red-600": "#dc2626",
    "orange-500": "#f97316", "orange-600": "#ea580c",
    "amber-500": "#f59e0b", "amber-600": "#d97706",
    "yellow-500": "#eab308", "yellow-600": "#ca8a04",
    "lime-500": "#84cc16", "lime-600": "#65a30d",
    "green-500": "#22c55e", "green-600": "#16a34a",
    "emerald-500": "#10b981", "emerald-600": "#059669",
    "teal-500": "#14b8a6", "teal-600": "#0d9488",
    "cyan-500": "#06b6d4", "cyan-600": "#0891b2",
    "sky-500": "#0ea5e9", "sky-600": "#0284c7",
    "blue-500": "#3b82f6", "blue-600": "#2563eb",
    "indigo-500": "#6366f1", "indigo-600": "#4f46e5",
    "violet-500": "#8b5cf6", "violet-600": "#7c3aed",
    "purple-500": "#a855f7", "purple-600": "#9333ea",
    "fuchsia-500": "#d946ef", "fuchsia-600": "#c026d3",
    "pink-500": "#ec4899", "pink-600": "#db2777",
    "rose-500": "#f43f5e", "rose-600": "#e11d48",
    "white": "#ffffff", "black": "#000000",
  };
  const bodyHtmlTagRegex = /<(?:body|html)\s[^>]*class=["']([^"']*)["'][^>]*>/gi;
  while ((match = bodyHtmlTagRegex.exec(html)) !== null) {
    const classes = match[1];
    const bgClassRegex = /\bbg-([\w-]+)\b/g;
    let bgMatch;
    while ((bgMatch = bgClassRegex.exec(classes)) !== null) {
      const colorName = bgMatch[1];
      if (tailwindColorMap[colorName]) {
        colors.add(tailwindColorMap[colorName]);
      }
    }
  }

  return Array.from(colors);
}

/**
 * Extract font family names from Google Fonts links, Typekit/Adobe Fonts links,
 * @font-face declarations, and inline CSS.
 */
function extractFonts(html: string): string[] {
  const fonts = new Set<string>();

  // Google Fonts URLs: parse family parameter
  const gfRegex = /fonts\.googleapis\.com\/css2?\?[^"'\s>]*/gi;
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

  // Typekit / Adobe Fonts: detect use.typekit.net links
  const typekitRegex = /use\.typekit\.net\/([a-z0-9]+)\.css/gi;
  while ((match = typekitRegex.exec(html)) !== null) {
    // We can't resolve the kit ID to font names without an API call,
    // but record the presence so callers know Typekit is in use.
    fonts.add(`typekit:${match[1]}`);
  }

  // Inline <style> blocks
  const styleRegex = /<style[^>]*>([\s\S]*?)<\/style>/gi;
  while ((match = styleRegex.exec(html)) !== null) {
    const styleContent = match[1];

    // @font-face declarations: extract font-family name
    const fontFaceRegex =
      /@font-face\s*\{[^}]*font-family\s*:\s*["']?([^;"'}\n]+)["']?/gi;
    let ffaceMatch;
    while ((ffaceMatch = fontFaceRegex.exec(styleContent)) !== null) {
      const name = ffaceMatch[1].trim();
      if (name && !name.startsWith("-")) {
        fonts.add(name);
      }
    }

    // body/html/root font-family declarations
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
 * Preference: og:site_name > application-name > og:title > <title> for name;
 * og:description > description for desc.
 */
function extractMeta(html: string): {
  name: string | undefined;
  description: string | undefined;
} {
  let title: string | undefined;
  let metaDescription: string | undefined;
  let ogSiteName: string | undefined;
  let ogDescription: string | undefined;
  let applicationName: string | undefined;
  let ogTitle: string | undefined;

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

  // <meta name="application-name" content="...">
  const appNameRegex =
    /<meta\s[^>]*name=["']application-name["'][^>]*content=["']([^"']*)["'][^>]*\/?>/i;
  const appNameRegexAlt =
    /<meta\s[^>]*content=["']([^"']*)["'][^>]*name=["']application-name["'][^>]*\/?>/i;
  const appNameMatch = appNameRegex.exec(html) || appNameRegexAlt.exec(html);
  if (appNameMatch) {
    applicationName = appNameMatch[1].trim();
  }

  // <meta property="og:title" content="...">
  const ogTitleRegex =
    /<meta\s[^>]*property=["']og:title["'][^>]*content=["']([^"']*)["'][^>]*\/?>/i;
  const ogTitleRegexAlt =
    /<meta\s[^>]*content=["']([^"']*)["'][^>]*property=["']og:title["'][^>]*\/?>/i;
  const ogTitleMatch = ogTitleRegex.exec(html) || ogTitleRegexAlt.exec(html);
  if (ogTitleMatch) {
    ogTitle = ogTitleMatch[1].trim();
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
    name: ogSiteName || applicationName || ogTitle || title || undefined,
    description: ogDescription || metaDescription || undefined,
  };
}

// --- AI-powered extraction via Gemini (issue #30) ---

interface GeminiExtractionResult {
  colors: string[];
  companyName?: string;
  summary?: string;
  industry?: string;
  brandTone?: string;
}

/**
 * Send trimmed HTML to Gemini for AI-powered brand analysis.
 * Falls back gracefully: returns empty result on any failure.
 */
async function extractWithGemini(
  apiKey: string,
  html: string,
  url: string
): Promise<GeminiExtractionResult> {
  // Trim HTML to first 10K chars (enough for head + hero section)
  const trimmedHtml = html.slice(0, 10_000);

  const prompt = `Analyze this website HTML and extract branding information. Return ONLY valid JSON, no markdown.

Website URL: ${url}

HTML (first 10K chars):
${trimmedHtml}

Extract:
{
  "primaryColor": "#hex of the main brand color",
  "secondaryColor": "#hex of the secondary color (or null)",
  "accentColor": "#hex of the accent/CTA color (or null)",
  "companyName": "the company or product name",
  "summary": "one sentence describing what the company does",
  "industry": "one word category (e.g. fintech, saas, ecommerce, devtools)",
  "brandTone": "one word (professional, playful, technical, minimal, bold)"
}`;

  const body = {
    contents: [
      {
        parts: [{ text: prompt }],
      },
    ],
    generationConfig: {
      temperature: 0.1,
      maxOutputTokens: 500,
    },
  };

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }
  );

  if (!response.ok) {
    throw new Error(`Gemini API error: ${response.status}`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("No Gemini response text");

  // Parse JSON from response (handle potential markdown code-fence wrapping)
  const jsonStr = text
    .replace(/```json\n?/g, "")
    .replace(/```\n?/g, "")
    .trim();
  const result = JSON.parse(jsonStr);

  const colors: string[] = [];
  if (result.primaryColor) colors.push(result.primaryColor);
  if (result.secondaryColor) colors.push(result.secondaryColor);
  if (result.accentColor) colors.push(result.accentColor);

  return {
    colors,
    companyName: result.companyName || undefined,
    summary: result.summary || undefined,
    industry: result.industry || undefined,
    brandTone: result.brandTone || undefined,
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

    // Sanitize HTML: strip <script> and <noscript> blocks to avoid false matches
    const cleanHtml = sanitizeHtml(html);

    // Run each extractor independently; one failure must not kill the others
    let logoUrl: string | undefined;
    let brandColors: string[] = [];
    let fonts: string[] = [];
    let meta: { name: string | undefined; description: string | undefined } = {
      name: undefined,
      description: undefined,
    };
    let industry: string | undefined;
    let brandTone: string | undefined;

    try {
      logoUrl = extractLogo(cleanHtml, baseUrl);
    } catch (error) {
      console.error(
        "Scraper: extractLogo failed:",
        error instanceof Error ? error.message : String(error)
      );
    }

    try {
      brandColors = extractColors(cleanHtml);
    } catch (error) {
      console.error(
        "Scraper: extractColors failed:",
        error instanceof Error ? error.message : String(error)
      );
    }

    try {
      fonts = extractFonts(cleanHtml);
    } catch (error) {
      console.error(
        "Scraper: extractFonts failed:",
        error instanceof Error ? error.message : String(error)
      );
    }

    try {
      meta = extractMeta(cleanHtml);
    } catch (error) {
      console.error(
        "Scraper: extractMeta failed:",
        error instanceof Error ? error.message : String(error)
      );
    }

    // After regex extraction, try Gemini for AI-powered visual analysis
    const geminiApiKey = process.env.GEMINI_API_KEY;
    if (geminiApiKey) {
      try {
        const aiResults = await extractWithGemini(geminiApiKey, cleanHtml, websiteUrl);
        // Merge: AI fills gaps where regex found nothing
        if (brandColors.length === 0 && aiResults.colors.length > 0) {
          brandColors = aiResults.colors;
        }
        if (!meta.name && aiResults.companyName) {
          meta.name = aiResults.companyName;
        }
        if (!meta.description && aiResults.summary) {
          meta.description = aiResults.summary;
        }
        // AI-only fields
        industry = aiResults.industry;
        brandTone = aiResults.brandTone;
      } catch (error) {
        console.error(
          "Gemini extraction failed, using regex results only:",
          error instanceof Error ? error.message : String(error)
        );
      }
    }

    await ctx.runMutation(internal.scraper.updateWorkspaceBranding, {
      orgId,
      logoUrl,
      brandColors: brandColors.length > 0 ? brandColors : undefined,
      fonts: fonts.length > 0 ? fonts : undefined,
      companyName: meta.name,
      companyDescription: meta.description,
      industry,
      brandTone,
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
    industry: v.optional(v.string()),
    brandTone: v.optional(v.string()),
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
    if (branding.industry !== undefined) patch.industry = branding.industry;
    if (branding.brandTone !== undefined) patch.brandTone = branding.brandTone;

    if (Object.keys(patch).length > 0) {
      await ctx.db.patch(orgId, patch);
    }
  },
});

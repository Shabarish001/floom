import { internalMutation, mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { requireAuth } from "./lib/auth";

// Static template definitions — embedded from templates/ directory at build time.
// Each template has code + manifest that can be deployed as a new automation.

export type TemplateDefinition = {
  slug: string;
  name: string;
  description: string;
  category: string;
  labels: string[];
  icon: string; // lucide icon name
  manifest: {
    name: string;
    description: string;
    inputs: Array<{
      name: string;
      label: string;
      type: string;
      description?: string;
      required?: boolean;
      default?: unknown;
      options?: string[];
      min?: number;
      max?: number;
    }>;
    outputs: Array<{
      name: string;
      label: string;
      type: string;
    }>;
    secrets_needed: string[];
    python_dependencies: string[];
    manifest_version: string;
  };
  code: string;
};

export const TEMPLATES: TemplateDefinition[] = [
  {
    slug: "web-scraper",
    name: "Web Scraper",
    description: "Extract structured data from any URL — titles, headings, links, and metadata.",
    category: "Data",
    labels: ["scraping"],
    icon: "Globe",
    manifest: {
      name: "Web Scraper",
      description: "Extract structured data from any URL — titles, headings, links, and metadata.",
      inputs: [
        { name: "url", label: "URL", type: "url", description: "The web page to scrape", required: true },
      ],
      outputs: [
        { name: "result", label: "Extracted Data", type: "text" },
      ],
      secrets_needed: [],
      python_dependencies: ["beautifulsoup4", "requests"],
      manifest_version: "1",
    },
    code: `import json
import requests
from bs4 import BeautifulSoup


def run(url):
    """Extract structured data from a web page."""
    response = requests.get(url, timeout=15, headers={
        "User-Agent": "Mozilla/5.0 (compatible; Floom/1.0)"
    })
    response.raise_for_status()

    soup = BeautifulSoup(response.text, "html.parser")

    title = soup.title.string.strip() if soup.title and soup.title.string else ""

    meta_description = ""
    meta_tag = soup.find("meta", attrs={"name": "description"})
    if meta_tag and meta_tag.get("content"):
        meta_description = meta_tag["content"].strip()

    headings = []
    for level in range(1, 4):
        for h in soup.find_all(f"h{level}"):
            text = h.get_text(strip=True)
            if text:
                headings.append({"level": level, "text": text})

    links = []
    for a in soup.find_all("a", href=True)[:50]:
        text = a.get_text(strip=True)
        href = a["href"]
        if href.startswith("http"):
            links.append({"text": text or href, "href": href})

    images = []
    for img in soup.find_all("img", src=True)[:20]:
        images.append({
            "src": img["src"],
            "alt": img.get("alt", ""),
        })

    data = {
        "title": title,
        "meta_description": meta_description,
        "headings": headings[:30],
        "links": links,
        "images": images,
    }

    return {"result": json.dumps(data, indent=2)}
`,
  },
  {
    slug: "pdf-report-generator",
    name: "PDF Report Generator",
    description: "Generate a formatted PDF report from a title, body text, and optional sections.",
    category: "Documents",
    labels: ["reporting", "pdf"],
    icon: "FileText",
    manifest: {
      name: "PDF Report Generator",
      description: "Generate a formatted PDF report from a title, body text, and optional sections.",
      inputs: [
        { name: "title", label: "Report Title", type: "text", description: "Title of the report", required: true },
        { name: "body", label: "Report Body", type: "textarea", description: "Main content of the report (supports multiple paragraphs)", required: true },
        { name: "author", label: "Author", type: "text", description: "Author name for the report header", required: false, default: "" },
      ],
      outputs: [
        { name: "result", label: "PDF Report", type: "pdf" },
      ],
      secrets_needed: [],
      python_dependencies: ["fpdf2"],
      manifest_version: "1",
    },
    code: `import base64
from datetime import datetime
from fpdf import FPDF


def run(title, body, author=""):
    """Generate a formatted PDF report."""
    pdf = FPDF()
    pdf.set_auto_page_break(auto=True, margin=20)
    pdf.add_page()

    # Title
    pdf.set_font("Helvetica", "B", 20)
    pdf.cell(0, 12, title, new_x="LMARGIN", new_y="NEXT", align="C")
    pdf.ln(4)

    # Author and date line
    pdf.set_font("Helvetica", "", 10)
    meta_parts = []
    if author:
        meta_parts.append(author)
    meta_parts.append(datetime.now().strftime("%B %d, %Y"))
    pdf.set_text_color(120, 120, 120)
    pdf.cell(0, 6, " | ".join(meta_parts), new_x="LMARGIN", new_y="NEXT", align="C")
    pdf.set_text_color(0, 0, 0)
    pdf.ln(8)

    # Divider
    pdf.set_draw_color(200, 200, 200)
    pdf.line(pdf.l_margin, pdf.get_y(), pdf.w - pdf.r_margin, pdf.get_y())
    pdf.ln(8)

    # Body paragraphs
    pdf.set_font("Helvetica", "", 11)
    paragraphs = body.strip().split("\\n\\n")
    for i, para in enumerate(paragraphs):
        # Check if paragraph looks like a heading (starts with # or is all caps short line)
        stripped = para.strip()
        if stripped.startswith("# "):
            pdf.set_font("Helvetica", "B", 14)
            pdf.cell(0, 8, stripped[2:], new_x="LMARGIN", new_y="NEXT")
            pdf.ln(2)
            pdf.set_font("Helvetica", "", 11)
        elif stripped.startswith("## "):
            pdf.set_font("Helvetica", "B", 12)
            pdf.cell(0, 7, stripped[3:], new_x="LMARGIN", new_y="NEXT")
            pdf.ln(2)
            pdf.set_font("Helvetica", "", 11)
        else:
            clean = stripped.replace("\\n", " ")
            pdf.multi_cell(0, 6, clean)
            pdf.ln(4)

    # Output as base64-encoded PDF
    pdf_bytes = pdf.output()
    encoded = base64.b64encode(pdf_bytes).decode("utf-8")

    return {"result": encoded}
`,
  },
  {
    slug: "data-analyzer",
    name: "Data Analyzer",
    description: "Analyze CSV data and return summary statistics, column info, and top insights.",
    category: "Data",
    labels: ["data"],
    icon: "BarChart3",
    manifest: {
      name: "Data Analyzer",
      description: "Analyze CSV data and return summary statistics, column info, and top insights.",
      inputs: [
        { name: "csv_data", label: "CSV Data", type: "textarea", description: "Paste CSV content (with headers in the first row)", required: true },
      ],
      outputs: [
        { name: "result", label: "Analysis Results", type: "text" },
      ],
      secrets_needed: [],
      python_dependencies: ["pandas"],
      manifest_version: "1",
    },
    code: `import io
import json
import pandas as pd


def run(csv_data):
    """Analyze CSV data and return summary statistics."""
    df = pd.read_csv(io.StringIO(csv_data))

    summary = {
        "rows": len(df),
        "columns": len(df.columns),
        "column_names": list(df.columns),
    }

    # Column types and missing values
    column_info = []
    for col in df.columns:
        info = {
            "name": col,
            "dtype": str(df[col].dtype),
            "missing": int(df[col].isna().sum()),
            "unique": int(df[col].nunique()),
        }
        if pd.api.types.is_numeric_dtype(df[col]):
            info["min"] = float(df[col].min()) if not df[col].isna().all() else None
            info["max"] = float(df[col].max()) if not df[col].isna().all() else None
            info["mean"] = round(float(df[col].mean()), 2) if not df[col].isna().all() else None
            info["median"] = round(float(df[col].median()), 2) if not df[col].isna().all() else None
        elif pd.api.types.is_string_dtype(df[col]):
            top = df[col].value_counts().head(5)
            info["top_values"] = {str(k): int(v) for k, v in top.items()}
        column_info.append(info)

    summary["column_info"] = column_info

    # Correlations for numeric columns
    numeric_cols = df.select_dtypes(include="number")
    if len(numeric_cols.columns) >= 2:
        corr = numeric_cols.corr()
        strong = []
        for i in range(len(corr.columns)):
            for j in range(i + 1, len(corr.columns)):
                val = corr.iloc[i, j]
                if abs(val) > 0.5:
                    strong.append({
                        "col_a": corr.columns[i],
                        "col_b": corr.columns[j],
                        "correlation": round(float(val), 3),
                    })
        if strong:
            summary["strong_correlations"] = strong

    # First 5 rows as preview
    summary["preview"] = json.loads(df.head(5).to_json(orient="records"))

    return {"result": json.dumps(summary, indent=2)}
`,
  },
  {
    slug: "text-summarizer",
    name: "Text Summarizer",
    description: "Summarize long text into key points using extractive summarization (no API keys needed).",
    category: "Text",
    labels: ["ai"],
    icon: "AlignLeft",
    manifest: {
      name: "Text Summarizer",
      description: "Summarize long text into key points using extractive summarization (no API keys needed).",
      inputs: [
        { name: "text", label: "Text to Summarize", type: "textarea", description: "The document or article text to summarize", required: true },
        { name: "num_sentences", label: "Number of Sentences", type: "number", description: "How many sentences to include in the summary", required: false, default: 5, min: 1, max: 20 },
      ],
      outputs: [
        { name: "result", label: "Summary", type: "text" },
      ],
      secrets_needed: [],
      python_dependencies: [],
      manifest_version: "1",
    },
    code: `import json
import re
import math
from collections import Counter


def run(text, num_sentences=5):
    """Summarize text using extractive TF-IDF sentence scoring."""
    # Split into sentences
    sentences = re.split(r'(?<=[.!?])\\s+', text.strip())
    sentences = [s.strip() for s in sentences if len(s.strip()) > 10]

    if len(sentences) <= num_sentences:
        return {"result": json.dumps({
            "summary": " ".join(sentences),
            "sentence_count": len(sentences),
            "original_sentences": len(sentences),
            "note": "Text is already short enough, returned as-is.",
        }, indent=2)}

    # Tokenize
    stop_words = {
        "the", "a", "an", "in", "on", "at", "to", "for", "of", "and", "or",
        "but", "is", "are", "was", "were", "be", "been", "being", "have",
        "has", "had", "do", "does", "did", "will", "would", "could", "should",
        "may", "might", "shall", "can", "this", "that", "these", "those",
        "it", "its", "i", "me", "my", "we", "our", "you", "your", "he",
        "she", "him", "her", "his", "they", "them", "their", "with", "from",
        "by", "as", "not", "no", "so", "if", "then", "than", "also", "very",
        "just", "about", "up", "out", "into", "over", "after", "before",
    }

    def tokenize(s):
        words = re.findall(r'\\b[a-z]+\\b', s.lower())
        return [w for w in words if w not in stop_words and len(w) > 2]

    # Term frequency per sentence
    sentence_tokens = [tokenize(s) for s in sentences]

    # Document frequency
    df = Counter()
    for tokens in sentence_tokens:
        for word in set(tokens):
            df[word] += 1

    n_docs = len(sentences)

    # Score each sentence by TF-IDF sum
    scores = []
    for i, tokens in enumerate(sentence_tokens):
        if not tokens:
            scores.append(0.0)
            continue
        tf = Counter(tokens)
        score = 0.0
        for word, count in tf.items():
            idf = math.log(n_docs / (1 + df[word]))
            score += (count / len(tokens)) * idf
        # Slight boost for earlier sentences (position bias)
        position_factor = 1.0 / (1.0 + 0.1 * i)
        scores.append(score * position_factor)

    # Select top sentences, preserve original order
    ranked = sorted(range(len(scores)), key=lambda i: scores[i], reverse=True)
    selected = sorted(ranked[:num_sentences])

    summary = " ".join(sentences[i] for i in selected)

    return {"result": json.dumps({
        "summary": summary,
        "sentence_count": len(selected),
        "original_sentences": len(sentences),
        "compression_ratio": round(len(selected) / len(sentences), 2),
    }, indent=2)}
`,
  },
  {
    slug: "json-transformer",
    name: "JSON Transformer",
    description: "Convert data between formats: CSV to JSON, JSON to CSV, flatten nested JSON, or filter JSON fields.",
    category: "Data",
    labels: ["data"],
    icon: "Braces",
    manifest: {
      name: "JSON Transformer",
      description: "Convert data between formats: CSV to JSON, JSON to CSV, flatten nested JSON, or filter JSON fields.",
      inputs: [
        { name: "data", label: "Input Data", type: "textarea", description: "The data to transform (CSV or JSON)", required: true },
        { name: "operation", label: "Operation", type: "enum", description: "Transformation to apply", required: true, options: ["csv_to_json", "json_to_csv", "flatten", "pick_fields"] },
        { name: "fields", label: "Fields (for pick_fields)", type: "text", description: "Comma-separated field names to keep (only used with pick_fields)", required: false, default: "" },
      ],
      outputs: [
        { name: "result", label: "Transformed Data", type: "text" },
      ],
      secrets_needed: [],
      python_dependencies: [],
      manifest_version: "1",
    },
    code: `import csv
import io
import json


def run(data, operation, fields=""):
    """Convert data between formats."""
    if operation == "csv_to_json":
        return {"result": csv_to_json(data)}
    elif operation == "json_to_csv":
        return {"result": json_to_csv(data)}
    elif operation == "flatten":
        return {"result": flatten_json(data)}
    elif operation == "pick_fields":
        return {"result": pick_fields(data, fields)}
    else:
        return {"result": json.dumps({"error": f"Unknown operation: {operation}"})}


def csv_to_json(csv_data):
    reader = csv.DictReader(io.StringIO(csv_data.strip()))
    rows = list(reader)
    return json.dumps(rows, indent=2)


def json_to_csv(json_data):
    data = json.loads(json_data)
    if isinstance(data, dict):
        data = [data]
    if not data:
        return ""

    # Collect all keys across all rows
    all_keys = []
    seen = set()
    for row in data:
        for k in row:
            if k not in seen:
                all_keys.append(k)
                seen.add(k)

    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=all_keys)
    writer.writeheader()
    for row in data:
        writer.writerow(row)
    return output.getvalue()


def flatten_json(json_data):
    data = json.loads(json_data)

    def _flatten(obj, prefix=""):
        items = {}
        if isinstance(obj, dict):
            for k, v in obj.items():
                new_key = f"{prefix}.{k}" if prefix else k
                items.update(_flatten(v, new_key))
        elif isinstance(obj, list):
            for i, v in enumerate(obj):
                new_key = f"{prefix}[{i}]"
                items.update(_flatten(v, new_key))
        else:
            items[prefix] = obj
        return items

    if isinstance(data, list):
        result = [_flatten(item) for item in data]
    else:
        result = _flatten(data)

    return json.dumps(result, indent=2)


def pick_fields(json_data, fields_str):
    data = json.loads(json_data)
    fields = [f.strip() for f in fields_str.split(",") if f.strip()]
    if not fields:
        return json.dumps({"error": "No fields specified. Provide comma-separated field names."})

    def _pick(obj):
        if isinstance(obj, dict):
            return {k: v for k, v in obj.items() if k in fields}
        return obj

    if isinstance(data, list):
        result = [_pick(item) for item in data]
    else:
        result = _pick(data)

    return json.dumps(result, indent=2)
`,
  },
  {
    slug: "email-template-generator",
    name: "Email Template Generator",
    description: "Generate responsive HTML email templates from parameters like subject, body, and brand color.",
    category: "Documents",
    labels: ["email"],
    icon: "Mail",
    manifest: {
      name: "Email Template Generator",
      description: "Generate responsive HTML email templates from parameters like subject, body, and brand color.",
      inputs: [
        { name: "subject", label: "Email Subject", type: "text", description: "The email subject line (used as the preview heading)", required: true },
        { name: "body", label: "Email Body", type: "textarea", description: "The main content of the email (supports multiple paragraphs)", required: true },
        { name: "cta_text", label: "Button Text", type: "text", description: "Call-to-action button label", required: false, default: "" },
        { name: "cta_url", label: "Button URL", type: "url", description: "URL the button links to", required: false, default: "" },
        { name: "brand_color", label: "Brand Color", type: "text", description: "Hex color for the header and button (e.g., #2563eb)", required: false, default: "#2563eb" },
      ],
      outputs: [
        { name: "result", label: "HTML Email", type: "html" },
      ],
      secrets_needed: [],
      python_dependencies: [],
      manifest_version: "1",
    },
    code: `import html as html_lib


def run(subject, body, cta_text="", cta_url="", brand_color="#2563eb"):
    """Generate a responsive HTML email template."""
    safe_subject = html_lib.escape(subject)
    safe_color = html_lib.escape(brand_color) if brand_color else "#2563eb"

    # Build body paragraphs
    paragraphs = body.strip().split("\\n\\n")
    body_html = ""
    for para in paragraphs:
        safe_para = html_lib.escape(para.strip()).replace("\\n", "<br>")
        body_html += f'<p style="margin:0 0 16px;color:#374151;font-size:16px;line-height:1.6;">{safe_para}</p>\\n'

    # CTA button
    cta_html = ""
    if cta_text and cta_url:
        safe_cta_text = html_lib.escape(cta_text)
        safe_cta_url = html_lib.escape(cta_url)
        cta_html = f'''
            <table role="presentation" style="margin:24px auto;">
              <tr>
                <td style="border-radius:6px;background:{safe_color};">
                  <a href="{safe_cta_url}" target="_blank" style="display:inline-block;padding:12px 24px;color:#ffffff;text-decoration:none;font-size:16px;font-weight:600;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">{safe_cta_text}</a>
                </td>
              </tr>
            </table>'''

    email_html = f'''<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>{safe_subject}</title>
</head>
<body style="margin:0;padding:0;background-color:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f3f4f6;">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:8px;overflow:hidden;">
          <!-- Header -->
          <tr>
            <td style="background:{safe_color};padding:32px 40px;">
              <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">{safe_subject}</h1>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:32px 40px;">
              {body_html}
              {cta_html}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:24px 40px;border-top:1px solid #e5e7eb;">
              <p style="margin:0;color:#9ca3af;font-size:13px;line-height:1.5;text-align:center;">
                You received this email because you are subscribed. <a href="#" style="color:{safe_color};text-decoration:underline;">Unsubscribe</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>'''

    return {"result": email_html}
`,
  },
];

// List all available templates (public, no auth needed for browsing).
export const list = query({
  args: {},
  handler: async () => {
    return TEMPLATES.map((t) => ({
      slug: t.slug,
      name: t.name,
      description: t.description,
      category: t.category,
      icon: t.icon,
    }));
  },
});

// Deploy a template as a new automation in the user's workspace.
// Creates the automation shell immediately, then schedules an action to
// upload template code to R2 and create a validated artifact.
export const deploy = mutation({
  args: {
    slug: v.string(),
  },
  handler: async (ctx, args) => {
    const { userId, orgId } = await requireAuth(ctx);

    const template = TEMPLATES.find((t) => t.slug === args.slug);
    if (!template) {
      throw new Error(`Template not found: ${args.slug}`);
    }

    // Create automation in "deploying" state
    const automationId = await ctx.db.insert("automations", {
      name: template.manifest.name,
      description: template.manifest.description,
      createdBy: userId,
      orgId,
      createdAt: Date.now(),
      status: "deploying",
      schedule: null,
      scheduleInputs: null,
      currentVersionId: "placeholder" as const,
      labels: template.labels,
    });

    // Schedule action to create zip, upload to R2, validate, and finalize
    await ctx.scheduler.runAfter(
      0,
      internal.templateActions.deployTemplateArtifact,
      { automationId, orgId, slug: args.slug, userId }
    );

    return { id: automationId };
  },
});

// Called by deployTemplateArtifact action on success.
export const finalizeDeployment = internalMutation({
  args: {
    automationId: v.id("automations"),
    artifactId: v.id("artifacts"),
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const automation = await ctx.db.get(args.automationId);
    if (!automation) throw new Error("Automation not found");

    const versionId = await ctx.db.insert("automationVersions", {
      automationId: args.automationId,
      version: 1,
      artifactId: args.artifactId,
      createdAt: Date.now(),
      createdBy: args.userId,
      changeNote: `Deployed from template: ${automation.name}`,
    });

    await ctx.db.patch(args.automationId, {
      currentVersionId: versionId,
      status: "active",
    });
  },
});

// Called by deployTemplateArtifact action on failure.
export const failDeployment = internalMutation({
  args: {
    automationId: v.id("automations"),
    error: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.automationId, { status: "failed" });
  },
});

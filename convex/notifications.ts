"use node";

import { internalAction } from "./_generated/server";
import { v } from "convex/values";

export const sendInvitationEmail = internalAction({
  args: {
    toEmail: v.string(),
    automationName: v.string(),
    slug: v.string(),
    inviterEmail: v.string(),
  },
  handler: async (_ctx, args) => {
    console.log("sendInvitationEmail called", {
      to: args.toEmail,
      slug: args.slug,
    });
    const resendKey = process.env.RESEND_API_KEY;
    if (!resendKey) {
      console.log("RESEND_API_KEY not set, skipping email");
      return;
    }

    const { Resend } = await import("resend");
    const resend = new Resend(resendKey);

    const platformUrl =
      process.env.NEXT_PUBLIC_APP_URL ?? "https://dashboard.floom.dev";
    const appUrl = `${platformUrl}/p/${args.slug}`;

    await resend.emails.send({
      from: "Floom <noreply@floom.dev>",
      to: args.toEmail,
      subject: `${args.inviterEmail} shared an app with you on Floom`,
      html: `
        <p><strong>${args.inviterEmail}</strong> shared <strong>${args.automationName}</strong> with you on Floom.</p>
        <p><a href="${appUrl}">Open app →</a></p>
        <p style="color:#888;font-size:12px;">You may need to sign in with this email address to access it.</p>
      `,
    });
  },
});

export const sendFailureEmail = internalAction({
  args: {
    toEmail: v.string(),
    automationName: v.string(),
    automationId: v.id("automations"),
    errorType: v.string(),
    error: v.string(),
  },
  handler: async (_ctx, args) => {
    const resendKey = process.env.RESEND_API_KEY;
    if (!resendKey) return; // Email not configured — skip silently

    const { Resend } = await import("resend");
    const resend = new Resend(resendKey);

    const platformUrl =
      process.env.NEXT_PUBLIC_APP_URL ?? "https://dashboard.floom.dev";
    const automationUrl = `${platformUrl}/a/${args.automationId}`;

    await resend.emails.send({
      from: "Floom <onboarding@resend.dev>",
      to: args.toEmail,
      subject: `Scheduled run failed: ${args.automationName}`,
      html: `
        <p>Your scheduled automation <strong>${args.automationName}</strong> failed.</p>
        <p><strong>Error type:</strong> ${args.errorType}</p>
        <p><strong>Error:</strong> ${args.error}</p>
        <p><a href="${automationUrl}">View run history →</a></p>
        <p>To fix: run <code>/floom fix ${automationUrl}</code> in Claude Code.</p>
      `,
    });
  },
});

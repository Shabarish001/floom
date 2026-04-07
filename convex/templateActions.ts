"use node";

import { internalAction } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import JSZip from "jszip";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getR2Client } from "./files";
import { TEMPLATES } from "./templates";
import crypto from "crypto";

export const deployTemplateArtifact = internalAction({
  args: {
    automationId: v.id("automations"),
    orgId: v.id("organizations"),
    slug: v.string(),
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    try {
      // 1. Look up template
      const template = TEMPLATES.find((t) => t.slug === args.slug);
      if (!template) {
        throw new Error(`Template not found: ${args.slug}`);
      }

      // 2. Create zip containing main.py
      const zip = new JSZip();
      zip.file("main.py", template.code);
      const zipBuffer = await zip.generateAsync({ type: "nodebuffer" });

      // 3. Upload to R2
      const r2Key = `artifacts/${args.orgId}/${crypto.randomUUID()}.zip`;
      const codeBucket = process.env.R2_CODE_BUCKET_NAME;
      if (!codeBucket) throw new Error("R2_CODE_BUCKET_NAME not configured");

      const r2 = getR2Client();
      await r2.send(
        new PutObjectCommand({
          Bucket: codeBucket,
          Key: r2Key,
          Body: zipBuffer,
          ContentType: "application/zip",
        })
      );

      // 4. Validate zip and create artifact (reuses existing pipeline)
      const { artifactId } = (await ctx.runAction(
        internal.artifactActions.processAndCreate,
        {
          orgId: args.orgId,
          manifest: template.manifest,
          entrypoint: "main.py",
          r2Key,
          createdBy: args.userId,
        }
      )) as { artifactId: string };

      // 5. Finalize: create version, set automation active
      await ctx.runMutation(internal.templates.finalizeDeployment, {
        automationId: args.automationId,
        artifactId: artifactId as any, // Convex ID from processAndCreate
        userId: args.userId,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await ctx.runMutation(internal.templates.failDeployment, {
        automationId: args.automationId,
        error: message,
      });
    }
  },
});

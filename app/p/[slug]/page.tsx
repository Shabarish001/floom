import type { Metadata } from "next";
import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import PublishedClient from "./PublishedClient";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  try {
    const meta = await fetchQuery(api.automations.getPublishedMeta, { slug });
    if (!meta) return { title: "App not found" };
    return {
      title: meta.name,
      description: meta.description || `Run ${meta.name} on Floom`,
      openGraph: {
        title: meta.name,
        description: meta.description || `Run ${meta.name} on Floom`,
      },
    };
  } catch {
    return { title: "Floom" };
  }
}

export default async function PublishedPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <PublishedClient slug={slug} />;
}

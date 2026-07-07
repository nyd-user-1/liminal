import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CareTemplate } from "@/components/site/care-template";
import { getTopic } from "@/lib/site-content";
import { searchProviders } from "@/lib/repos/directory";

// /care/[topic] — one template drives every condition and care-type page,
// content-driven from lib/site-content/topics.ts. NEW (public marketing site).

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ topic: string }> }): Promise<Metadata> {
  const { topic: slug } = await params;
  const topic = getTopic(slug);
  if (!topic) return { title: "Care — Liminal" };
  return { title: topic.metaTitle, description: topic.metaDescription };
}

async function getCount(providerType?: string): Promise<number | undefined> {
  if (!providerType) return undefined;
  try {
    const page = await searchProviders({ providerType, pageSize: 1 });
    return page.total || undefined;
  } catch {
    return undefined;
  }
}

export default async function CarePage({ params }: { params: Promise<{ topic: string }> }) {
  const { topic: slug } = await params;
  const topic = getTopic(slug);
  if (!topic) notFound();

  const providerCount = await getCount(topic.providerType);
  return <CareTemplate topic={topic} providerCount={providerCount} />;
}

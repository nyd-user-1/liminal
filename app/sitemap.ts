import type { MetadataRoute } from "next";
import { appBaseUrl } from "@/lib/email";
import { countActiveProviders, listProviderSlugs } from "@/lib/repos/directory";
import { TOPICS } from "@/lib/site-content";

// Chunked sitemap: /sitemap/0.xml = static + care topics; /sitemap/1.xml…N =
// the 116k directory provider profiles, 40k per chunk (sitemap protocol caps
// at 50k URLs each). robots.ts lists every chunk.

export const PROVIDERS_PER_SITEMAP = 40_000;

export async function providerSitemapCount(): Promise<number> {
  try {
    return Math.max(1, Math.ceil((await countActiveProviders()) / PROVIDERS_PER_SITEMAP));
  } catch {
    return 1;
  }
}

export async function generateSitemaps(): Promise<Array<{ id: number }>> {
  const chunks = await providerSitemapCount();
  return Array.from({ length: chunks + 1 }, (_, id) => ({ id }));
}

const STATIC_PATHS = [
  "",
  "/providers",
  "/therapists",
  "/psychiatrists",
  "/psychiatric-np",
  "/for-providers",
  "/for-providers/therapists",
  "/for-providers/prescribers",
  "/for-employers",
  "/for-health-plans",
  "/for-physicians",
  "/join",
];

export default async function sitemap({ id }: { id: number | Promise<string | number> }): Promise<MetadataRoute.Sitemap> {
  // Next 16 delivers generateSitemaps ids as an async param resolving to a string.
  const chunk = Number(await Promise.resolve(id));
  const base = appBaseUrl();

  if (chunk === 0) {
    const statics: MetadataRoute.Sitemap = STATIC_PATHS.map((p) => ({
      url: `${base}${p || "/"}`,
      changeFrequency: "weekly",
      priority: p === "" ? 1 : 0.8,
    }));
    const topics: MetadataRoute.Sitemap = TOPICS.map((t) => ({
      url: `${base}/care/${t.slug}`,
      changeFrequency: "weekly",
      priority: 0.7,
    }));
    return [...statics, ...topics];
  }

  try {
    const slugs = await listProviderSlugs(chunk, PROVIDERS_PER_SITEMAP);
    return slugs.map((slug) => ({
      url: `${base}/providers/${slug}`,
      changeFrequency: "monthly",
      priority: 0.5,
    }));
  } catch {
    return [];
  }
}

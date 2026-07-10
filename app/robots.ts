import type { MetadataRoute } from "next";
import { providerSitemapCount } from "@/app/sitemap";
import { appBaseUrl } from "@/lib/email";

// Public marketing + directory pages are crawlable; the workspace, portal,
// auth, and API surfaces are not. Sitemap chunks come from app/sitemap.ts
// (generateSitemaps serves them at /sitemap/[id].xml).

export default async function robots(): Promise<MetadataRoute.Robots> {
  const base = appBaseUrl();
  const chunks = await providerSitemapCount();
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/api/",
        "/portal/",
        "/calendar",
        "/clients",
        "/inbox",
        "/billing",
        "/library",
        "/settings",
        "/directory",
        "/calls",
        "/design-system",
        "/sign-in",
        "/set-password",
        "/forgot-password",
      ],
    },
    sitemap: Array.from({ length: chunks + 1 }, (_, id) => `${base}/sitemap/${id}.xml`),
  };
}

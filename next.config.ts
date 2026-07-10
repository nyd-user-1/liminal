import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  async redirects() {
    return [
      // /find-care moved to /providers (now the provider search page); fully
      // vacated, so a plain redirect is safe. Query strings pass through
      // automatically (Next.js default).
      { source: "/find-care", destination: "/providers", permanent: true },
      // The clinician-facing marketing pages moved from /providers to
      // /for-providers. Only these two exact sub-paths redirect — bare
      // /providers is deliberately NOT redirected, since that path now
      // serves the provider search page above, not the old marketing
      // landing. ("therapists"/"prescribers" won't collide with a real
      // provider slug at /providers/[slug].)
      { source: "/providers/therapists", destination: "/for-providers/therapists", permanent: true },
      { source: "/providers/prescribers", destination: "/for-providers/prescribers", permanent: true },
    ];
  },
};

export default nextConfig;

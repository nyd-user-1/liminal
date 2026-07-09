import type { ReactNode } from "react";
import { MarketingFooter } from "@/components/marketing/marketing-footer";
import { Nav } from "@/components/marketing/nav";

// Shell for the public marketing pages under (site) — for-employers,
// for-health-plans, for-physicians, home-2, providers + its sub-pages, and
// every /care/[topic] page. Uses the same primary Nav + MarketingFooter as the
// rest of the public site (was a separate SiteNav/SiteFooter pair; converged
// so there's one nav/footer system, not two). A route group adds no URL
// segment and does not wrap the existing top-level pages.

export default function SiteLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-surface">
      <Nav />
      <main className="flex-1">{children}</main>
      <MarketingFooter />
    </div>
  );
}

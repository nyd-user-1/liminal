import type { ReactNode } from "react";
import { SiteNav } from "@/components/site/site-nav";
import { SiteFooter } from "@/components/site/site-footer";

// Shell for the new public marketing pages (/home-2 and its siblings). Provides
// MY own nav + footer so this parallel public site is self-contained and never
// edits the shared marketing chrome the home redesign owns. A route group adds
// no URL segment and does not wrap the existing top-level pages. NEW (public
// marketing site).

export default function SiteLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-surface">
      <SiteNav />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  );
}

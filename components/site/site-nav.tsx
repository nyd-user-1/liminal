"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/ui/logo";
import { Icon } from "@/components/ui/icons";
import { NAV_GROUPS } from "@/lib/site-content";

// My public-site top nav — sticky, transparent on the pale wash at the top of a
// page and switching to a white surface + shadow on scroll (the same Headway-
// style behaviour as the home nav, rebuilt simply from primitives). Dropdowns
// are CSS hover/focus-within (keyboard-reachable, no extra state). Deliberately
// separate from components/marketing/nav.tsx (owned by the home redesign). NEW
// (public marketing site).

export function SiteNav() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Close the mobile menu whenever the route changes.
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const solid = scrolled || mobileOpen;

  return (
    <header
      className={`sticky top-0 z-50 transition-colors duration-200 ${solid ? "bg-surface shadow-card" : "bg-primary-wash"}`}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-6">
        <Link href="/home-2" aria-label="Liminal home" className="shrink-0">
          <Logo variant="onLight" size="md" />
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-1 lg:flex">
          {NAV_GROUPS.map((g) => (
            <div key={g.label} className="group relative">
              <button
                type="button"
                className="inline-flex items-center gap-1 rounded-field px-3 py-2 text-[15px] font-medium text-text transition-colors hover:text-primary"
              >
                {g.label}
                <Icon
                  name="chevron-down"
                  size={16}
                  className="text-text-muted transition-transform group-hover:rotate-180"
                />
              </button>
              <div className="invisible absolute left-1/2 top-full w-72 -translate-x-1/2 pt-2 opacity-0 transition-all group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100">
                <div className="rounded-card border border-border bg-surface p-2 shadow-menu">
                  {g.links?.map((l) => (
                    <Link
                      key={l.href}
                      href={l.href}
                      className="block rounded-field px-3 py-2 transition-colors hover:bg-canvas"
                    >
                      <span className="block text-[15px] font-medium text-text">{l.label}</span>
                      {l.note && <span className="mt-0.5 block text-[13px] text-text-muted">{l.note}</span>}
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </nav>

        {/* Right cluster */}
        <div className="hidden items-center gap-2 lg:flex">
          <Link
            href="/sign-in"
            className="inline-flex h-10 items-center rounded-field px-3 text-[15px] font-medium text-text transition-colors hover:text-primary"
          >
            Log in
          </Link>
          <Link
            href="/find-care"
            className="inline-flex h-10 items-center rounded-field bg-primary px-4 text-[15px] font-semibold text-white transition-colors hover:bg-primary-hover"
          >
            Find care
          </Link>
        </div>

        {/* Mobile toggle */}
        <button
          type="button"
          onClick={() => setMobileOpen((o) => !o)}
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
          aria-expanded={mobileOpen}
          className="inline-flex h-10 w-10 items-center justify-center rounded-field text-text lg:hidden"
        >
          <Icon name={mobileOpen ? "x" : "menu"} size={24} />
        </button>
      </div>

      {/* Mobile panel */}
      {mobileOpen && (
        <div className="border-t border-border bg-surface lg:hidden">
          <div className="mx-auto max-w-6xl space-y-5 px-6 py-6">
            {NAV_GROUPS.map((g) => (
              <div key={g.label}>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-muted">{g.label}</p>
                <div className="mt-1 flex flex-col">
                  {g.links?.map((l) => (
                    <Link key={l.href} href={l.href} className="border-b border-border py-2.5 text-[15px] font-medium text-text">
                      {l.label}
                    </Link>
                  ))}
                </div>
              </div>
            ))}
            <div className="flex gap-3 pt-1">
              <Link
                href="/sign-in"
                className="inline-flex h-11 flex-1 items-center justify-center rounded-field border border-field-border text-[15px] font-semibold text-text"
              >
                Log in
              </Link>
              <Link
                href="/find-care"
                className="inline-flex h-11 flex-1 items-center justify-center rounded-field bg-primary text-[15px] font-semibold text-white"
              >
                Find care
              </Link>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icons";
import { Logo } from "@/components/ui/logo";
import { SearchOverlay } from "@/components/marketing/search-overlay";

// Public marketing nav — sticky, gains a border + shadow once scrolled.
// Flat item set per the Headway pattern, re-skinned Liminal.

export function MarketingNav() {
  const router = useRouter();
  const [scrolled, setScrolled] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      <header
        className={`sticky top-0 z-40 bg-surface/95 backdrop-blur transition-shadow ${
          scrolled ? "border-b border-border shadow-card" : "border-b border-transparent"
        }`}
      >
        <nav className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-6">
          <Link href="/" aria-label="Liminal home">
            <Logo size="sm" />
          </Link>
          <div className="hidden items-center gap-5 md:flex">
            <Link href="/find-care" className="text-[15px] font-medium text-text-body hover:text-text">
              Find care
            </Link>
            <Link href="/join" className="text-[15px] font-medium text-text-body hover:text-text">
              For providers
            </Link>
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="inline-flex items-center gap-1.5 text-[15px] font-medium text-text-body hover:text-text"
            >
              <Icon name="search" size={16} />
              Search
            </button>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Link
              href="/sign-in"
              className="hidden text-[15px] font-medium text-text-body hover:text-text sm:inline"
            >
              Patient portal
            </Link>
            <Link
              href="/sign-in"
              className="hidden text-[15px] font-medium text-text-body hover:text-text sm:inline"
            >
              Provider portal
            </Link>
            <Button size="sm" onClick={() => router.push("/join")}>
              Join as a provider
            </Button>
          </div>
        </nav>
      </header>
      <SearchOverlay open={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  );
}

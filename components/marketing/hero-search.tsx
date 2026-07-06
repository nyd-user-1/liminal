"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icons";

// The hero / closing "find care" bar. A single field wired to the real
// directory search (116k+ providers + programs statewide) — routes to
// /find-care?q=, the same anonymous search the nav overlay uses.

export function HeroSearch() {
  const router = useRouter();
  const [q, setQ] = useState("");

  const go = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    router.push(`/find-care${params.toString() ? `?${params.toString()}` : ""}`);
  };

  return (
    <form
      onSubmit={go}
      className="rounded-card border border-border bg-surface p-2 shadow-card sm:flex sm:items-center sm:gap-2"
    >
      <div className="flex flex-1 items-center gap-2.5 px-3">
        <Icon name="search" size={20} className="shrink-0 text-text-muted" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Search providers and programs"
          placeholder="Search therapists, psychiatrists, and programs"
          className="h-11 w-full min-w-0 bg-transparent text-[15px] text-text outline-none placeholder:text-text-muted sm:h-12"
        />
      </div>
      <Button type="submit" size="xl" className="mt-2 w-full sm:mt-0 sm:w-auto">
        Find care
      </Button>
    </form>
  );
}

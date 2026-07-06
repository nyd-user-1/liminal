"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SearchInput } from "@/components/ui/search-input";

// The hero / closing "find care" bar — the SearchInput primitive, hero-sized.
// Enter routes to the real directory (/find-care?q=), the same anonymous
// search the nav overlay uses. No button.

export function HeroSearch() {
  const router = useRouter();
  const [q, setQ] = useState("");

  const go = () => {
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    router.push(`/find-care${params.toString() ? `?${params.toString()}` : ""}`);
  };

  return (
    <SearchInput
      className="[&_input]:h-14 [&_input]:text-base [&_input]:shadow-card"
      placeholder="Search therapists, psychiatrists, and programs"
      aria-label="Search providers and programs"
      value={q}
      onChange={(e) => setQ(e.target.value)}
      onKeyDown={(e) => e.key === "Enter" && go()}
    />
  );
}

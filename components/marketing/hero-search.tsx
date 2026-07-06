"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { SearchInput } from "@/components/ui/search-input";
import { Select } from "@/components/ui/select";

// Inline "find care" search used in the hero + the closing CTA. Routes to the
// real /find-care directory with q + county params. White card so it reads on
// the navy hero and on light bands alike.

const BOROUGHS = [
  { value: "", label: "All boroughs" },
  { value: "New York", label: "Manhattan" },
  { value: "Kings", label: "Brooklyn" },
  { value: "Queens", label: "Queens" },
  { value: "Bronx", label: "Bronx" },
  { value: "Richmond", label: "Staten Island" },
];

export function HeroSearch() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [county, setCounty] = useState("");

  const go = () => {
    const p = new URLSearchParams();
    if (q.trim()) p.set("q", q.trim());
    if (county) p.set("county", county);
    router.push(`/find-care${p.toString() ? `?${p.toString()}` : ""}`);
  };

  return (
    <div className="rounded-card border border-border bg-surface p-2 shadow-card sm:flex sm:items-center sm:gap-2">
      <div className="p-1 sm:flex-1 sm:p-0">
        <SearchInput
          className="w-full"
          placeholder="Specialty, name, or program"
          aria-label="Search care"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && go()}
        />
      </div>
      <div className="p-1 sm:w-44 sm:p-0">
        <Select
          className="w-full"
          aria-label="Borough"
          placeholder="All boroughs"
          options={BOROUGHS}
          value={county}
          onValueChange={setCounty}
        />
      </div>
      <div className="p-1 sm:p-0">
        <Button className="w-full sm:w-auto" leftIcon="search" onClick={go}>
          Find care
        </Button>
      </div>
    </div>
  );
}

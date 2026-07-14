"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { avatarHue } from "@/components/ui/avatar";
import { SearchInput } from "@/components/ui/search-input";
import { ProviderOverview } from "@/components/providers/provider-overview";
import { ProviderRates } from "@/components/providers/provider-rates";
import type { ProviderNetworkSummary } from "@/lib/repos/networks";
import type { DirectoryProvider } from "@/lib/types";

// One provider's workspace — the calendar-style split: single-column info
// rail (w-80, same as the calendar rail) beside the published-rates table,
// matching heights. Rendered inside a Directory provider tab
// (directory-client) and by the standalone deep-link page
// (/directory/providers/[npi]). Identity lives in the rail's fixed header —
// no page-level entity header, no breadcrumb, no sub-tabs (the Rates
// drill-down gets a new access path later).

/** Jump-to-provider search above the rail (mirrors the calendar's rail
 *  search). Types ahead against the directory; selecting a hit opens that
 *  provider — in the tab flow via onJump, else by deep-link navigation. */
function ProviderJumpSearch({
  currentId,
  onJump,
}: {
  currentId: string;
  onJump?: (p: DirectoryProvider) => void;
}) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<DirectoryProvider[]>([]);
  const seq = useRef(0);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      setHits([]);
      return;
    }
    const s = ++seq.current;
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/directory/providers?q=${encodeURIComponent(term)}`);
        const data = await res.json();
        if (s === seq.current) {
          setHits(
            ((data.items ?? []) as DirectoryProvider[]).filter((p) => p.id !== currentId).slice(0, 8),
          );
        }
      } catch {
        /* type-ahead only — stay quiet */
      }
    }, 250);
    return () => clearTimeout(t);
  }, [q, currentId]);

  function pick(p: DirectoryProvider) {
    setQ("");
    setHits([]);
    if (onJump) onJump(p);
    else if (p.npi) router.push(`/directory/providers/${p.npi}`);
  }

  return (
    <div className="relative">
      <SearchInput
        aria-label="Search providers"
        placeholder="Search providers…"
        className="w-full"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            setQ("");
            setHits([]);
          }
        }}
      />
      {hits.length > 0 && (
        <div className="absolute inset-x-0 top-full z-20 mt-1 overflow-hidden rounded-card border border-border bg-surface shadow-menu">
          {hits.map((p) => (
            <button
              key={p.id}
              type="button"
              className="flex w-full items-baseline gap-2 px-3 py-2 text-left text-sm hover:bg-canvas"
              onClick={() => pick(p)}
            >
              <span className="min-w-0 truncate font-medium text-text">{p.name}</span>
              <span className="ml-auto shrink-0 text-xs text-text-muted">{p.profession ?? ""}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function ProviderView({
  provider,
  network,
  onJump,
}: {
  provider: DirectoryProvider;
  network: ProviderNetworkSummary | null;
  onJump?: (p: DirectoryProvider) => void;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col gap-6 lg:flex-row">
      {/* Rail — search sits above the panel, mirroring the calendar layout. */}
      <aside className="flex min-h-0 flex-col gap-4 lg:h-full lg:w-80 lg:shrink-0">
        <ProviderJumpSearch currentId={provider.id} onJump={onJump} />
        <div className="min-h-0 flex-1">
          <ProviderOverview provider={provider} network={network} hue={avatarHue(provider.id)} />
        </div>
      </aside>
      {/* min-w-0 is load-bearing: without it this flex child grows past the
          viewport and the PAGE scrolls horizontally — the table owns all
          scrolling (Table standard, docs/TASK-TABLE-STANDARD.md). */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <ProviderRates npi={provider.npi} />
      </div>
    </div>
  );
}

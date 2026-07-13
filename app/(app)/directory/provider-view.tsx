"use client";

import { avatarHue } from "@/components/ui/avatar";
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

export function ProviderView({
  provider,
  network,
}: {
  provider: DirectoryProvider;
  network: ProviderNetworkSummary | null;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col gap-6 lg:flex-row">
      <aside className="min-h-0 lg:h-full lg:w-80 lg:shrink-0">
        <ProviderOverview provider={provider} network={network} hue={avatarHue(provider.id)} />
      </aside>
      <div className="flex min-h-0 flex-1 flex-col">
        <ProviderRates npi={provider.npi} />
      </div>
    </div>
  );
}

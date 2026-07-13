"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { TopBarActions } from "@/components/shell/topbar-slot";
import { Avatar } from "@/components/ui/avatar";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Tabs } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/toast";
import { ProviderOverview } from "@/components/providers/provider-overview";
import { ReferModal } from "@/components/providers/refer-modal";
import { PanelsPanel } from "@/components/rates/panels-panel";
import { titleCase } from "@/lib/format";
import type { ProviderNetworkSummary } from "@/lib/repos/networks";
import type { DirectoryProvider } from "@/lib/types";
import { avatarHue } from "../../directory-client";

// Entity header (breadcrumb + avatar + H1 + meta) over Overview/Rates tabs —
// same shape as clients/[id] (ClientHeader + ClientTabs), collapsed into one
// file since neither tab here needs its own server-rendered content file.
// Rates reuses PanelsPanel pre-scoped to this page's NPI (KYR phase 3); Panels'
// "renegotiate"/"see Roster check" jumps have no local tab to land on here, so
// they route out to the standalone /rates tool instead of no-op-ing.

const TABS = [
  { key: "overview", label: "Overview" },
  { key: "rates", label: "Rates" },
];

export function ProviderProfile({
  provider,
  network,
  clients,
  userEmail,
  openRefer,
}: {
  provider: DirectoryProvider;
  network: ProviderNetworkSummary | null;
  clients: Array<{ id: string; name: string }>;
  userEmail?: string;
  openRefer?: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [tab, setTab] = useState("overview");
  // Starts closed on both the server and the client's first render (Modal
  // renders null under typeof document === "undefined") — opening from
  // ?refer=1 happens in an effect, after hydration, to avoid a mismatch.
  const [referOpen, setReferOpen] = useState(false);
  useEffect(() => {
    if (openRefer) setReferOpen(true);
  }, [openRefer]);

  const name = titleCase(provider.name);
  const meta = [
    provider.profession ? titleCase(provider.profession) : null,
    provider.credential,
    provider.city ? titleCase(provider.city) : null,
  ].filter(Boolean);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <TopBarActions>
        <Button size="sm" leftIcon="send" onClick={() => setReferOpen(true)}>
          Refer a client
        </Button>
      </TopBarActions>

      <div className="mb-6 shrink-0">
        <Breadcrumb items={[{ label: "Directory", href: "/directory" }, { label: name }]} className="mb-4" />
        <div className="flex items-center gap-4">
          <Avatar name={name} hue={avatarHue(provider.id)} size="lg" className="!h-16 !w-16 !text-xl" />
          <div className="min-w-0">
            <h1 className="truncate text-[28px] font-bold text-text">{name}</h1>
            {meta.length > 0 && <p className="mt-0.5 truncate text-sm text-text-muted">{meta.join(" · ")}</p>}
          </div>
        </div>
      </div>

      <Tabs className="mb-6 shrink-0" items={TABS} active={tab} onChange={setTab} slideActive />

      <div hidden={tab !== "overview"}>
        <ProviderOverview provider={provider} network={network} />
      </div>
      <div className="min-h-0 flex-1" hidden={tab !== "rates"}>
        <PanelsPanel
          active={tab === "rates"}
          userEmail={userEmail}
          initialNpi={provider.npi ?? undefined}
          onPinBands={() => router.push("/rates")}
          onGoToRoster={() => router.push("/rates")}
        />
      </div>

      <ReferModal
        open={referOpen}
        onClose={() => setReferOpen(false)}
        clients={clients}
        target={provider}
        isProvider
        onSuccess={() => {
          setReferOpen(false);
          toast(
            <>
              Referral sent for <b>{name}</b>.
            </>,
            "success",
          );
        }}
      />
    </div>
  );
}

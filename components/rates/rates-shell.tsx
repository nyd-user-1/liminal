"use client";

import { useState } from "react";
import { IconButton } from "@/components/ui/icon-button";
import { useToast } from "@/components/ui/toast";
import { TopBarActions } from "@/components/shell/topbar-slot";
import { Button } from "@/components/ui/button";
import { Tabs } from "@/components/ui/tabs";
import { ApplyNextPanel } from "@/components/rates/apply-next-panel";
import { BandsPanel } from "@/components/rates/bands-panel";
import { PanelsPanel } from "@/components/rates/panels-panel";
import { RosterPanel } from "@/components/rates/roster-panel";
import { SpreadPanel } from "@/components/rates/spread-panel";

// Rates — screens over the negotiated-rate signals. Services leads (the tab
// a clinician opens the page for — "what does this service pay, by payer");
// Panels answers "where do I stand"; Roster check answers "who's still
// publishing me, and what was it worth"; the spread check prices the
// platform's cut. Panels/Roster stay mounted so lookups and entered figures
// survive tab switches; the CPT picks are shared with the print one-pager
// (/rates/card). `activeNpi` is shared between Roster check and Apply next —
// either can set it (KYR phase 2).

const TABS = [
  { key: "bands", label: "Services" },
  { key: "panels", label: "Panels" },
  { key: "roster", label: "Roster check" },
  { key: "apply-next", label: "Apply next" },
  { key: "spread", label: "Spread check" },
];

// One line per tab, in the space the search vacated when it moved above the
// table: say what the table IS before the reader has to infer it from columns.
const BLURBS: Record<string, string> = {
  bands: "Every negotiated rate we hold for a service, as the insurer published it — by insurer, network and licence tier.",
  panels: "Panels are the payer × network contracts a clinician is listed under, and what each one pays.",
  roster: "Who is still publishing you, and what that listing was worth.",
  "apply-next": "Where to apply next, ranked by what the book already pays people like you.",
  spread: "What the platform's cut costs you, priced against the rates it negotiates.",
};

export function RatesShell({ userEmail }: { userEmail?: string }) {
  const toast = useToast();
  const [tab, setTab] = useState("bands");
  // Empty = no code filter applied (the negotiation card shows every code by
  // default, sorted A-Z) — codes narrow the table, they don't gate it.
  const [codes, setCodes] = useState<string[]>([]);
  const [activeNpi, setActiveNpi] = useState<string | null>(null);
  const [pin, setPin] = useState<{ payer: string; billingCode: string } | null>(null);

  const onPinBands = (payer: string, billingCode: string) => {
    setPin({ payer, billingCode });
    setTab("bands");
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <TopBarActions>
        <Button
          size="sm"
          leftIcon="download"
          onClick={() => window.open(`/rates/card?codes=${codes.join(",")}`, "_blank")}
        >
          Print rate card
        </Button>
        <IconButton icon="bell" label="Notifications" onClick={() => toast("No new notifications.", "info")} />
      </TopBarActions>

      <Tabs className="mt-4 shrink-0" items={TABS} active={tab} onChange={setTab} slideActive />

      {/* Sits under the tab hairline, above the tab body — one line saying what
          this tab's table is. */}
      <p className="mb-4 mt-3 shrink-0 text-[15px] text-text-body">{BLURBS[tab]}</p>

      {/* Bands + Panels own their scroll internally (sticky-header table); Spread
          is a form-then-small-result screen, so its tab body scrolls normally. */}
      <div className="min-h-0 flex-1" hidden={tab !== "bands"}>
        <BandsPanel codes={codes} onCodesChange={setCodes} pin={pin} />
      </div>
      <div className="min-h-0 flex-1" hidden={tab !== "panels"}>
        <PanelsPanel
          active={tab === "panels"}
          userEmail={userEmail}
          onPinBands={onPinBands}
          onGoToRoster={() => setTab("roster")}
        />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto" hidden={tab !== "roster"}>
        <RosterPanel
          activeNpi={activeNpi}
          onActiveNpi={setActiveNpi}
          onGoToApplyNext={(npi) => {
            setActiveNpi(npi);
            setTab("apply-next");
          }}
        />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto" hidden={tab !== "apply-next"}>
        <ApplyNextPanel activeNpi={activeNpi} onActiveNpi={setActiveNpi} onGoToNegotiation={() => setTab("bands")} />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto" hidden={tab !== "spread"}>
        <SpreadPanel />
      </div>
    </div>
  );
}

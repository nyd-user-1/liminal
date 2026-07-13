"use client";

import { useState } from "react";
import { TopBarActions } from "@/components/shell/topbar-slot";
import { Button } from "@/components/ui/button";
import { Tabs } from "@/components/ui/tabs";
import { ApplyNextPanel } from "@/components/rates/apply-next-panel";
import { BandsPanel } from "@/components/rates/bands-panel";
import { PanelsPanel } from "@/components/rates/panels-panel";
import { RosterPanel } from "@/components/rates/roster-panel";
import { SpreadPanel } from "@/components/rates/spread-panel";

// Rates — screens over the negotiated-rate signals. The negotiation card
// leads (the tab a clinician opens the page for); Panels answers "where do I
// stand"; Roster check answers "who's still publishing me, and what was it
// worth"; the spread check prices the platform's cut. Panels/Roster stay
// mounted so lookups and entered figures survive tab switches; the CPT picks
// are shared with the print one-pager (/rates/card). `activeNpi` is shared
// between Roster check and Apply next — either can set it (KYR phase 2).

const TABS = [
  { key: "bands", label: "Negotiation card" },
  { key: "panels", label: "Panels" },
  { key: "roster", label: "Roster check" },
  { key: "apply-next", label: "Apply next" },
  { key: "spread", label: "Spread check" },
];

export function RatesShell() {
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
      </TopBarActions>

      <Tabs className="shrink-0" items={TABS} active={tab} onChange={setTab} slideActive />

      {/* Bands + Panels own their scroll internally (sticky-header table); Spread
          is a form-then-small-result screen, so its tab body scrolls normally. */}
      <div className="min-h-0 flex-1 pt-5" hidden={tab !== "bands"}>
        <BandsPanel codes={codes} onCodesChange={setCodes} pin={pin} />
      </div>
      <div className="min-h-0 flex-1 pt-5" hidden={tab !== "panels"}>
        <PanelsPanel active={tab === "panels"} onPinBands={onPinBands} onGoToRoster={() => setTab("roster")} />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto pt-5" hidden={tab !== "roster"}>
        <RosterPanel
          activeNpi={activeNpi}
          onActiveNpi={setActiveNpi}
          onGoToApplyNext={(npi) => {
            setActiveNpi(npi);
            setTab("apply-next");
          }}
        />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto pt-5" hidden={tab !== "apply-next"}>
        <ApplyNextPanel activeNpi={activeNpi} onActiveNpi={setActiveNpi} onGoToNegotiation={() => setTab("bands")} />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto pt-5" hidden={tab !== "spread"}>
        <SpreadPanel />
      </div>
    </div>
  );
}

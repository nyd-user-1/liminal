"use client";

import { useState } from "react";
import { TopBarActions } from "@/components/shell/topbar-slot";
import { Button } from "@/components/ui/button";
import { Tabs } from "@/components/ui/tabs";
import { DEFAULT_CODES } from "@/components/rates/cpt";
import { BandsPanel } from "@/components/rates/bands-panel";
import { PanelsPanel } from "@/components/rates/panels-panel";
import { SpreadPanel } from "@/components/rates/spread-panel";

// Rates — three screens over the negotiated-rate signals. The negotiation
// card leads (the tab a clinician opens the page for); Panels answers "where
// do I stand"; the spread check prices the platform's cut. Panels stay
// mounted so lookups and entered figures survive tab switches; the CPT picks
// are shared with the print one-pager (/rates/card).

const TABS = [
  { key: "bands", label: "Negotiation card" },
  { key: "panels", label: "Panels" },
  { key: "spread", label: "Spread check" },
];

export function RatesShell() {
  const [tab, setTab] = useState("bands");
  const [codes, setCodes] = useState<string[]>(DEFAULT_CODES);

  return (
    <div>
      <TopBarActions>
        <Button
          size="sm"
          leftIcon="download"
          onClick={() => window.open(`/rates/card?codes=${codes.join(",")}`, "_blank")}
        >
          Print rate card
        </Button>
      </TopBarActions>

      <Tabs items={TABS} active={tab} onChange={setTab} slideActive />

      <div className="pt-5" hidden={tab !== "bands"}>
        <BandsPanel codes={codes} onCodesChange={setCodes} />
      </div>
      <div className="pt-5" hidden={tab !== "panels"}>
        <PanelsPanel />
      </div>
      <div className="pt-5" hidden={tab !== "spread"}>
        <SpreadPanel />
      </div>
    </div>
  );
}

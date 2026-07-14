"use client";

import { useState } from "react";
import type { DictionaryGroup, InsurerBoardRow } from "@/lib/repos/admin";
import { Tabs } from "@/components/ui/tabs";
import { DataDictionary } from "./data-dictionary";
import { InsurersBoard } from "./insurers-board";

const TABS = [
  { key: "dictionary", label: "Data Dictionary" },
  { key: "insurers", label: "Insurers" },
];

export function AdminDataTabs({ groups, insurers }: { groups: DictionaryGroup[]; insurers: InsurerBoardRow[] }) {
  const [tab, setTab] = useState("dictionary");
  return (
    <div className="flex flex-col gap-5">
      <Tabs items={TABS} active={tab} onChange={setTab} slideActive />
      {tab === "dictionary" ? <DataDictionary groups={groups} /> : <InsurersBoard rows={insurers} />}
    </div>
  );
}

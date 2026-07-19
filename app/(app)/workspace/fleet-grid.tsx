"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { AgentCard } from "./agent-card";
import { DocSheet } from "./doc-sheet";

// The fleet roster grid — two rows of three, then "View more" reveals the rest
// (the /library gallery pattern). Clicking a card opens that agent's identity
// file in the editor (editable).

export interface FleetAgent {
  name: string;
  label: string;
  model: "Fable" | "Opus";
  mine?: boolean;
  blurb: string;
  doc: string | null;
}

const INITIAL = 6;

export function FleetGrid({ agents }: { agents: FleetAgent[] }) {
  const [full, setFull] = useState(false);
  const [openName, setOpenName] = useState<string | null>(null);
  const shown = full ? agents : agents.slice(0, INITIAL);

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {shown.map((a) => (
          <AgentCard
            key={a.name}
            label={a.label}
            model={a.model}
            mine={a.mine}
            blurb={a.blurb}
            doc={a.doc}
            onOpen={() => setOpenName(a.name)}
          />
        ))}
      </div>
      {!full && agents.length > INITIAL && (
        <div>
          <Button variant="ghost" size="sm" onClick={() => setFull(true)}>
            View more
          </Button>
        </div>
      )}
      {openName && (
        <DocSheet endpoint={`/api/agents/${openName}`} label="Agent" onClose={() => setOpenName(null)} />
      )}
    </div>
  );
}

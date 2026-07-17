"use client";

import { useCallback, useEffect, useState } from "react";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { ClientRecord, ClientRecordLoading, type ClientRecordBundle } from "@/components/records/client-record";

// One open client tab. The rail opens a record without navigating, so the tab
// fetches its own bundle through the twin (app/api/clients/[id]/record) —
// which is also why /clients pays for no record data until a row is clicked.
//
// `initial` is the deep-link path: /clients/[id] server-renders the bundle and
// hands it over, so a bookmarked record paints with its data already in place
// rather than flashing a spinner.

export function ClientRecordTab({
  clientId,
  initial,
  initialCard,
}: {
  clientId: string;
  initial?: ClientRecordBundle;
  /** The deep link's ?tab= — ensured onto the board and scrolled to. */
  initialCard?: string;
}) {
  const [record, setRecord] = useState<ClientRecordBundle | null>(initial ?? null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch(`/api/clients/${clientId}/record`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Could not load this client record.");
      setRecord(data.record);
    } catch (e) {
      setRecord(null);
      setError(String((e as Error).message ?? e));
    }
  }, [clientId]);

  useEffect(() => {
    if (!initial) void load();
    // The deep-link bundle is this tab's starting state, not a subscription —
    // reloads go through load() from here on.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  if (error) {
    return (
      <div className="rounded-card border border-border bg-surface shadow-card">
        <EmptyState
          icon="users"
          title="Could not load this client"
          subtext={error}
          actions={<Button variant="secondary" onClick={() => void load()}>Try again</Button>}
        />
      </div>
    );
  }
  if (!record) return <ClientRecordLoading />;
  return <ClientRecord record={record} initialCard={initialCard} onReload={() => void load()} />;
}

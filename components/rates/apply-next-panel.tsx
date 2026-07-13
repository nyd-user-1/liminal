"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Banner } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Field } from "@/components/ui/field";
import { Icon } from "@/components/ui/icons";
import { ProgressBar } from "@/components/ui/progress-bar";
import { SearchInput } from "@/components/ui/search-input";
import { PAYER_PORTALS } from "@/components/rates/payer-portals";
import { InsurerMark } from "@/components/rates/insurer-mark";
import { TableSkeleton } from "@/components/rates/table-skeleton";
import type { CredentialingFootprint, GapCard } from "@/lib/repos/rate-signals";

// Screen: Apply Next — the absent NY-book payers, ranked and priced. "Shelley
// needs to apply tonight." Keyed to activeNpi (shared with Roster check);
// own merged input too, for direct entry.

type ApplyNextResult = { npi: string; identity: CredentialingFootprint["identity"]; gaps: GapCard[] };

function portalFor(payer: string): string | null {
  for (const [re, url] of PAYER_PORTALS) if (re.test(payer)) return url;
  return null;
}

const CHECKLIST_MISSING = ["CAQH ID", "Malpractice certificate", "W-9"];

function SubmitClock({ storageKey }: { storageKey: string }) {
  const [submittedAt, setSubmittedAt] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    setSubmittedAt(typeof window !== "undefined" ? localStorage.getItem(storageKey) : null);
  }, [storageKey]);

  if (submittedAt === undefined) return null;

  if (!submittedAt) {
    return (
      <Button
        size="sm"
        variant="secondary"
        onClick={() => {
          const now = new Date().toISOString();
          localStorage.setItem(storageKey, now);
          setSubmittedAt(now);
        }}
      >
        Mark submitted
      </Button>
    );
  }

  const day = Math.max(1, Math.floor((Date.now() - new Date(submittedAt).getTime()) / 86_400_000) + 1);
  return (
    <Badge variant={day > 75 ? "warning" : "info"}>
      day {day} of the payer&rsquo;s ~90-day credentialing window
    </Badge>
  );
}

function GapCardView({ npi, identity, gap }: { npi: string; identity: CredentialingFootprint["identity"]; gap: GapCard }) {
  const heldRows: Array<{ label: string; held: boolean }> = [
    { label: "NPI", held: true },
    { label: "NPPES identity", held: !!identity?.name },
    { label: "License #", held: !!identity?.license },
    { label: "Taxonomy", held: !!identity?.taxonomy },
    { label: "Practice address", held: !!identity?.address },
  ];
  const total = heldRows.length + CHECKLIST_MISSING.length;
  const heldCount = heldRows.filter((r) => r.held).length;
  const pct = Math.round((heldCount / total) * 100 / 5) * 5;
  const portal = portalFor(gap.payer);

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="flex items-center gap-2.5">
          <InsurerMark payer={gap.payer} />
          <h2 className="text-[17px] font-semibold text-text">{gap.payer}</h2>
        </span>
        <Badge variant={gap.negotiability === "flat" ? "neutral" : "info"}>{gap.negotiabilityLabel}</Badge>
      </div>

      <p className="mt-3 text-[15px] text-text-body">{gap.headline}</p>
      {gap.opportunity && <p className="mt-1 text-[17px] font-semibold text-text">{gap.opportunity}</p>}
      {gap.asOf && <p className="mt-1 text-sm text-text-muted">as-of {gap.asOf}</p>}

      <div className="mt-4 border-t border-border pt-4">
        <p className="mb-2 text-sm font-medium text-text">
          Your application is ~{pct}% assembled
        </p>
        <ProgressBar value={pct} showLabel />
        <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm sm:grid-cols-4">
          {heldRows.map((r) => (
            <span key={r.label} className="flex items-center gap-1.5 text-text-body">
              <Icon name="circle-check" size={15} className={r.held ? "text-success" : "text-text-muted/40"} />
              {r.label}
            </span>
          ))}
          {CHECKLIST_MISSING.map((label) => (
            <span key={label} className="flex items-center gap-1.5 text-text-muted">
              <Icon name="circle-check" size={15} className="text-text-muted/40" />
              {label}
            </span>
          ))}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2.5 border-t border-border pt-4">
        {portal && (
          <Button variant="secondary" size="sm" onClick={() => window.open(portal, "_blank")}>
            Open {gap.payer}&rsquo;s join-network portal
          </Button>
        )}
        <Button
          variant="secondary"
          size="sm"
          leftIcon="download"
          onClick={() => window.open(`/rates/packet?npi=${npi}&payer=${encodeURIComponent(gap.payer)}`, "_blank")}
        >
          Download pre-filled packet
        </Button>
        <SubmitClock storageKey={`kyr-clock:${npi}:${gap.payer}`} />
      </div>
    </Card>
  );
}

export function ApplyNextPanel({
  activeNpi,
  onActiveNpi,
  onGoToNegotiation,
}: {
  activeNpi: string | null;
  onActiveNpi: (npi: string) => void;
  onGoToNegotiation: () => void;
}) {
  const [npiInput, setNpiInput] = useState(activeNpi ?? "");
  const [sessionsPerWeek, setSessionsPerWeek] = useState("25");
  const [result, setResult] = useState<ApplyNextResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const npiCandidate = /^\d{10}$/.test(npiInput.trim()) ? npiInput.trim() : null;

  const fetchGaps = async (npi: string, sessions: number) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/rates/apply-next?npi=${npi}&sessions=${sessions}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Lookup failed.");
      setResult(data.result);
      onActiveNpi(npi);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Lookup failed.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeNpi && activeNpi !== result?.npi) {
      setNpiInput(activeNpi);
      fetchGaps(activeNpi, Number(sessionsPerWeek) || 25);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeNpi]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <SearchInput
          value={npiInput}
          onChange={(e) => setNpiInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && npiCandidate && fetchGaps(npiCandidate, Number(sessionsPerWeek) || 25)}
          placeholder="Enter your 10-digit NPI"
          className="w-full max-w-md"
        />
        <Field
          label="Sessions/week"
          inputMode="numeric"
          value={sessionsPerWeek}
          onChange={(e) => setSessionsPerWeek(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && (npiCandidate ?? result?.npi) && fetchGaps(npiCandidate ?? result!.npi, Number(sessionsPerWeek) || 25)}
          className="w-32"
        />
        {npiCandidate ? (
          <Button onClick={() => fetchGaps(npiCandidate, Number(sessionsPerWeek) || 25)} loading={loading}>
            Look up NPI
          </Button>
        ) : (
          result && (
            <Button
              variant="secondary"
              onClick={() => fetchGaps(result.npi, Number(sessionsPerWeek) || 25)}
              loading={loading}
            >
              Recalculate
            </Button>
          )
        )}
      </div>

      {error && <Banner variant="danger">{error}</Banner>}

      {loading && !result && <TableSkeleton head={["Payer", "Headline", "Packet"]} rows={2} />}

      {!loading && !result && !error && (
        <EmptyState
          icon="wand-sparkles"
          title="Find the gap with a fuse lit"
          subtext="Enter your NPI to see every negotiable NY book you're absent from, ranked and priced, with a pre-filled packet ready to go."
        />
      )}

      {result && result.gaps.length === 0 && (
        <EmptyState
          icon="circle-check"
          title="You're in every negotiable NY book we index"
          subtext="See the negotiation card instead."
          actions={
            <Button variant="secondary" onClick={onGoToNegotiation}>
              Go to negotiation card
            </Button>
          }
        />
      )}

      {result?.gaps.map((gap) => (
        <GapCardView key={gap.payer} npi={result.npi} identity={result.identity} gap={gap} />
      ))}
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Banner } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Field } from "@/components/ui/field";
import { SearchInput } from "@/components/ui/search-input";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { clinicianName } from "@/components/rates/clinician-name";
import { cptLabel } from "@/components/rates/cpt";
import { InsurerMark } from "@/components/rates/insurer-mark";
import { TableSkeleton } from "@/components/rates/table-skeleton";
import type { Attestation, CredentialingFootprint, FootprintBook, SpreadResult } from "@/lib/repos/rate-signals";

// Screen: Roster Check — "the post-departure screen." Three stacked moments
// per affiliation card: who's still publishing you (+ your own attestation),
// what your sessions were worth on their contract, and the pivot to Apply
// Next. Copy law: "published under", never "employed by".

function workhorseCode(book: FootprintBook): string | null {
  return "90837" in book.codes ? "90837" : null;
}

function AffiliationCard({
  npi,
  book,
  attestation,
  onAttested,
  onGoToApplyNext,
}: {
  npi: string;
  book: FootprintBook;
  attestation: Attestation | undefined;
  onAttested: (a: Attestation) => void;
  onGoToApplyNext: (npi: string) => void;
}) {
  const [status, setStatus] = useState<"current" | "left">(attestation?.status ?? "current");
  const [month, setMonth] = useState(attestation?.attestedMonth?.slice(0, 7) ?? "");
  const [saved, setSaved] = useState<Attestation | undefined>(attestation);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [pay, setPay] = useState("");
  const [sessionsPerWeek, setSessionsPerWeek] = useState("");
  const [marginResult, setMarginResult] = useState<SpreadResult | null>(null);
  const [marginLoading, setMarginLoading] = useState(false);
  const [marginError, setMarginError] = useState<string | null>(null);

  const code90837 = workhorseCode(book);
  const [placement, setPlacement] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    if (!code90837) return;
    let stale = false;
    fetch(`/api/rates/placement?payer=${encodeURIComponent(book.payer)}&code=${code90837}&tin=${encodeURIComponent(book.tin)}`)
      .then((r) => r.json())
      .then((d) => {
        if (!stale) setPlacement(d.placement ?? null);
      })
      .catch(() => {
        if (!stale) setPlacement(null);
      });
    return () => {
      stale = true;
    };
  }, [book.payer, book.tin, code90837]);

  const saveAttestation = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch("/api/rates/attestations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          npi,
          tin: book.tin,
          status,
          attestedMonth: status === "left" && month ? month : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't save.");
      setSaved(data.attestation);
      onAttested(data.attestation);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Couldn't save.");
    } finally {
      setSaving(false);
    }
  };

  const checkMargin = async () => {
    const code = code90837 ?? Object.keys(book.codes)[0];
    const payNum = Number(pay);
    const sessionsNum = Number(sessionsPerWeek);
    if (!code || !(payNum > 0) || !(sessionsNum > 0)) return;
    setMarginLoading(true);
    setMarginError(null);
    try {
      const res = await fetch("/api/rates/spread", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entries: [{ billingCode: code, remit: payNum, sessions: sessionsNum, cadence: "week" }],
          schedule: { payer: book.payer, tin: book.tin },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't compute the margin.");
      setMarginResult(data.result);
    } catch (e) {
      setMarginError(e instanceof Error ? e.message : "Couldn't compute the margin.");
    } finally {
      setMarginLoading(false);
    }
  };

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <InsurerMark payer={book.payer} />
          <div>
            <h2 className="text-[17px] font-semibold text-text">
              {book.payer} is still publishing you under {book.holder}
            </h2>
            <p className="mt-0.5 text-sm font-medium text-text-muted">as-of {book.asOf}</p>
          </div>
        </div>
        {saved && (
          <Badge variant={saved.status === "current" ? "success" : "neutral"}>
            {saved.status === "current"
              ? "Attested current"
              : `Attested left${saved.attestedMonth ? ` ${saved.attestedMonth.slice(0, 7)}` : ""}`}
          </Badge>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-end gap-3 border-t border-border pt-4">
        <SegmentedControl
          segments={[
            { value: "current", label: "Current" },
            { value: "left", label: "I left this group" },
          ]}
          value={status}
          onChange={(v) => setStatus(v as "current" | "left")}
        />
        {status === "left" && (
          <Field label="Month (optional)" type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
        )}
        <Button size="sm" onClick={saveAttestation} loading={saving}>
          Save
        </Button>
      </div>
      {saveError && <p className="mt-2 text-sm text-danger">{saveError}</p>}

      <div className="mt-5 border-t border-border pt-4">
        <p className="mb-2 text-sm font-medium text-text">What your sessions were worth on their contract</p>
        <ul className="space-y-1 text-[15px] text-text-body">
          {Object.entries(book.codes).map(([code, display]) => (
            <li key={code}>
              <span className="font-medium text-text">{code}</span>{" "}
              <span className="text-text-muted">· {cptLabel(code)}</span> — {display}
            </li>
          ))}
        </ul>

        <div className="mt-4 flex flex-wrap items-end gap-3">
          <Field
            label={`What were you paid per ${code90837 ?? Object.keys(book.codes)[0] ?? "session"} session?`}
            prefix="$"
            inputMode="decimal"
            placeholder="0.00"
            value={pay}
            onChange={(e) => setPay(e.target.value)}
            className="w-40"
          />
          <Field
            label="Sessions/week"
            inputMode="numeric"
            placeholder="0"
            value={sessionsPerWeek}
            onChange={(e) => setSessionsPerWeek(e.target.value)}
            className="w-32"
          />
          <Button size="sm" variant="secondary" onClick={checkMargin} loading={marginLoading}>
            Check the margin
          </Button>
        </div>
        {marginError && <p className="mt-2 text-sm text-danger">{marginError}</p>}
        {marginResult && marginResult.payers[0] && (
          <div className="mt-3 rounded-field bg-canvas p-3.5">
            <p className="text-sm font-medium text-text-muted">The margin your work generated</p>
            <ul className="mt-1 space-y-0.5 text-[15px] text-text-body">
              {marginResult.payers[0].perCode.map((c) => (
                <li key={c.billingCode}>{c.display}</li>
              ))}
            </ul>
            <p className="mt-1 text-[17px] font-semibold text-text">{marginResult.payers[0].annualDisplay}</p>
          </div>
        )}
      </div>

      {code90837 && (
        <div className="mt-5 border-t border-border pt-4">
          <p className="text-[15px] text-text-body">
            {placement === undefined ? (
              "Placing this contract's 90837 in the payer's book…"
            ) : placement ? (
              <>
                <span className="font-semibold text-text">{book.holder}</span>&rsquo;s 90837 sat at{" "}
                <span className="font-semibold text-text">{placement}</span> of {book.payer}&rsquo;s book.
              </>
            ) : (
              "Not enough published rows to place this contract in the book."
            )}
          </p>
          <Button className="mt-3" size="sm" onClick={() => onGoToApplyNext(npi)}>
            The contract left. The rates don&rsquo;t have to. → See where to apply next
          </Button>
        </div>
      )}
    </Card>
  );
}

export function RosterPanel({
  activeNpi,
  onActiveNpi,
  onGoToApplyNext,
}: {
  activeNpi: string | null;
  onActiveNpi: (npi: string) => void;
  onGoToApplyNext: (npi: string) => void;
}) {
  const [npiInput, setNpiInput] = useState(activeNpi ?? "");
  const [footprint, setFootprint] = useState<CredentialingFootprint | null>(null);
  const [attestations, setAttestations] = useState<Attestation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const npiCandidate = /^\d{10}$/.test(npiInput.trim()) ? npiInput.trim() : null;

  const lookup = async (npi: string) => {
    setLoading(true);
    setError(null);
    try {
      const [fpRes, attRes] = await Promise.all([
        fetch(`/api/rates/footprint?npis=${npi}`),
        fetch(`/api/rates/attestations?npi=${npi}`),
      ]);
      const fpData = await fpRes.json();
      const attData = await attRes.json();
      if (!fpRes.ok) throw new Error(fpData.error ?? "Lookup failed.");
      if (!attRes.ok) throw new Error(attData.error ?? "Lookup failed.");
      setFootprint(fpData.footprints[0] ?? null);
      setAttestations(attData.attestations ?? []);
      onActiveNpi(npi);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Lookup failed.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeNpi && activeNpi !== footprint?.npi) {
      setNpiInput(activeNpi);
      lookup(activeNpi);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeNpi]);

  const attByTin = new Map(attestations.map((a) => [a.tin, a]));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <SearchInput
          value={npiInput}
          onChange={(e) => setNpiInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && npiCandidate && lookup(npiCandidate)}
          placeholder="Enter your 10-digit NPI"
          className="w-full max-w-md"
        />
        {npiCandidate && (
          <Button onClick={() => lookup(npiCandidate)} loading={loading}>
            Look up NPI
          </Button>
        )}
      </div>

      {error && <Banner variant="danger">{error}</Banner>}

      {loading && !footprint && <TableSkeleton head={["Payer", "Holder", "As-of"]} rows={2} />}

      {!loading && !footprint && !error && (
        <EmptyState
          icon="corner-down-right"
          title="See who's still publishing you — and what it's worth"
          subtext="Enter your NPI to see every contract holder a payer files you under, attest to whether you're still there, and price what your sessions were worth."
        />
      )}

      {footprint && footprint.foundIn.length === 0 && !loading && (
        <EmptyState
          icon="corner-down-right"
          title="No published books for this NPI"
          subtext={`${footprint.identity ? clinicianName(footprint.identity.name) : footprint.npi} has no published rate rows in the NY books we index.`}
        />
      )}

      {footprint?.foundIn.map((book) => (
        <AffiliationCard
          key={`${book.payer}|${book.tin}`}
          npi={footprint.npi}
          book={book}
          attestation={attByTin.get(book.tin)}
          onAttested={(a) => setAttestations((prev) => [a, ...prev.filter((x) => x.tin !== a.tin)])}
          onGoToApplyNext={onGoToApplyNext}
        />
      ))}
    </div>
  );
}

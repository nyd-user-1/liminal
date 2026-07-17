"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Banner } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Field } from "@/components/ui/field";
import { Icon } from "@/components/ui/icons";
import { SearchInput } from "@/components/ui/search-input";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { LoadMoreRow, Table, Td, Tr, useLazyBatch } from "@/components/ui/table";
import { clinicianName } from "@/components/rates/clinician-name";
import { cptLabel } from "@/components/rates/cpt";
import { InsurerCell, InsurerMark } from "@/components/rates/insurer-mark";
import { TableSkeleton } from "@/components/rates/table-skeleton";
import type {
  Attestation,
  CredentialingFootprint,
  FootprintBook,
  RateBookRow,
  SpreadResult,
} from "@/lib/repos/rate-signals";

// Screen: Roster Check — "the post-departure screen." Copy law: "published
// under", never "employed by".
//
// REDUCTIVE, NOT ADDITIVE. This screen used to be a blank box that asked you to
// guess what it knew: no NPI, no content. It now OPENS on the whole listing —
// every payer×holder book we index — and the search REDUCES it. Type a payer or
// a practice and the table narrows; type your 10-digit NPI and it stops being a
// table at all: it becomes your affiliation cards, with the personalized
// computations switched on. One box, two behaviours, and the data is visible
// before you type either way.

function workhorseCode(book: FootprintBook): string | null {
  return "90837" in book.codes ? "90837" : null;
}

/** The card's rate list. The founder called the old one "organized
 *  disorganization": every line repeated "(fee schedule)", the service name
 *  truncated mid-word, and the amounts didn't line up. Now it is a real dl —
 *  code + FULL service name left, amount right in tabular figures — and the
 *  schedule basis is a badge ONCE per card, up in the header where it belongs.
 *  The header carries the in-network qualifier, which is what licenses the
 *  figure-alone form (see RateSignal.figure's contract). */
function RateList({ book }: { book: FootprintBook }) {
  return (
    <dl className="flex flex-col gap-1.5">
      {Object.entries(book.codes).map(([code, display]) => {
        const parts = book.codeParts[code];
        return (
          <div key={code} className="flex items-baseline justify-between gap-4">
            <dt className="min-w-0 text-[15px]">
              <span className="font-medium text-text">{code}</span>{" "}
              <span className="text-text-muted">{cptLabel(code)}</span>
            </dt>
            {/* Dotted leader: the eye needs to get from a wrapped service name
                to its amount without the two drifting apart. */}
            <span aria-hidden className="min-w-4 flex-1 self-end border-b border-dashed border-border/70" />
            <dd className="shrink-0 text-right text-[15px] font-medium tabular-nums text-text" title={display}>
              {parts?.figure ?? display}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}

/** Collapsed by default — it holds a computation nobody asked for yet, and the
 *  card should not pay for it (or spend the height) until it is opened. */
function Accordion({ label, children }: { label: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-t border-border pt-3">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-1.5 text-left text-[13px] font-medium text-text-body transition-colors hover:text-primary"
      >
        <Icon name={open ? "chevron-down" : "chevron-right"} size={14} />
        {label}
      </button>
      {open && <div className="mt-3">{children}</div>}
    </div>
  );
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

  const saveAttestation = async (nextStatus?: "current" | "left") => {
    const s = nextStatus ?? status;
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch("/api/rates/attestations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ npi, tin: book.tin, status: s, attestedMonth: s === "left" && month ? month : undefined }),
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

  const basis = Object.values(book.codeParts)[0]?.basis;
  const packetHref = `/rates/packet?npi=${npi}&payer=${encodeURIComponent(book.payer)}`;
  const disputeHref = `/rates/dispute?npi=${npi}&payer=${encodeURIComponent(book.payer)}&tin=${encodeURIComponent(book.tin)}`;

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <InsurerMark payer={book.payer} />
          <div>
            <h2 className="text-[17px] font-semibold text-text">
              {book.payer} is still publishing you under {book.holder}
            </h2>
            {/* The in-network qualifier lives here, once — which is what lets
                the rate list below print the figures alone. */}
            <p className="mt-0.5 text-sm font-medium text-text-muted">
              In-network rates as-of {book.asOf}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {basis && <Badge variant="neutral">{basis}</Badge>}
          {saved && (
            <Badge variant={saved.status === "current" ? "success" : "neutral"}>
              {saved.status === "current"
                ? "Attested current"
                : `Attested left${saved.attestedMonth ? ` ${saved.attestedMonth.slice(0, 7)}` : ""}`}
            </Badge>
          )}
        </div>
      </div>

      <div className="mt-4 grid gap-x-8 gap-y-5 border-t border-border pt-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.2fr)_minmax(0,1.2fr)]">
        {/* Column 1 — the attestation */}
        <div className="flex flex-col items-start gap-3">
          <p className="text-[11px] font-medium uppercase tracking-wider text-text-muted">Still with this group?</p>
          {/* self-start is load-bearing: SegmentedControl is inline-flex, and a
              flex COLUMN stretches its children, so without this the control
              blows to full width while its buttons stay content-sized — which
              is exactly the "broken half-input" look. */}
          <SegmentedControl
            className="self-start"
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
          <Button size="sm" onClick={() => saveAttestation()} loading={saving}>
            Save
          </Button>
          {saveError && <p className="text-sm text-danger">{saveError}</p>}
        </div>

        {/* Column 2 — what the sessions were worth */}
        <div className="flex min-w-0 flex-col gap-3">
          <p className="text-[11px] font-medium uppercase tracking-wider text-text-muted">
            What your sessions were worth on their contract
          </p>
          <RateList book={book} />
          {code90837 && (
            <p className="mt-auto pt-1 text-sm text-text-body">
              {placement === undefined ? (
                <span className="text-text-muted">Placing this contract&rsquo;s 90837 in the payer&rsquo;s book…</span>
              ) : placement ? (
                <>
                  <span className="font-semibold text-text">{book.holder}</span>&rsquo;s 90837 sat at{" "}
                  <span className="font-semibold text-text">{placement}</span> of {book.payer}&rsquo;s book.
                </>
              ) : (
                <span className="text-text-muted">Not enough published rows to place this contract in the book.</span>
              )}
            </p>
          )}
        </div>

        {/* Column 3 — IS THIS YOU? The card's job is not to open with a margin
            calculator; it is to ask the one question only this clinician can
            answer, and then do something for them either way. The margin moves
            under the accordion — it is a good tool, it just isn't the point. */}
        <div className="flex min-w-0 flex-col gap-3">
          <p className="text-[11px] font-medium uppercase tracking-wider text-text-muted">
            Is this listing you?
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              leftIcon="circle-check"
              onClick={() => {
                setStatus("current");
                void saveAttestation("current");
              }}
              loading={saving}
            >
              This is me
            </Button>
            <Button size="sm" variant="secondary" leftIcon="x" onClick={() => window.open(disputeHref, "_blank")}>
              This is NOT me
            </Button>
          </div>
          <p className="text-[13px] leading-relaxed text-text-muted">
            {saved?.status === "current" ? (
              <>
                Confirmed. Share it as a PDF — it&rsquo;s the payer&rsquo;s own published attestation that you&rsquo;re
                in-network.
              </>
            ) : (
              <>
                Confirm it and you can share the payer&rsquo;s own attestation as a PDF. Dispute it and we write the
                letter for you to forward.
              </>
            )}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" leftIcon="download" onClick={() => window.open(packetHref, "_blank")}>
              Share (PDF)
            </Button>
            <Button size="sm" variant="ghost" onClick={() => onGoToApplyNext(npi)}>
              See where to apply next →
            </Button>
          </div>

          <Accordion label="What was my work worth?">
            <div className="flex flex-wrap items-end gap-2.5">
              <Field
                label={`Paid per ${code90837 ?? Object.keys(book.codes)[0] ?? "session"}`}
                prefix="$"
                inputMode="decimal"
                placeholder="0.00"
                value={pay}
                onChange={(e) => setPay(e.target.value)}
                className="w-32"
              />
              <Field
                label="Sessions/week"
                inputMode="numeric"
                placeholder="0"
                value={sessionsPerWeek}
                onChange={(e) => setSessionsPerWeek(e.target.value)}
                className="w-28"
              />
              <Button size="sm" variant="secondary" onClick={checkMargin} loading={marginLoading}>
                Check the margin
              </Button>
            </div>
            {marginError && <p className="mt-2 text-sm text-danger">{marginError}</p>}
            {marginResult && marginResult.payers[0] && (
              <div className="mt-3 rounded-field bg-canvas p-3">
                <ul className="space-y-0.5 text-sm text-text-body">
                  {marginResult.payers[0].perCode.map((c) => (
                    <li key={c.billingCode}>{c.display}</li>
                  ))}
                </ul>
                <p className="mt-1 text-[17px] font-semibold text-text">{marginResult.payers[0].annualDisplay}</p>
              </div>
            )}
          </Accordion>
        </div>
      </div>
    </Card>
  );
}

/** The base content: every payer×holder book we index. This is what "reductive"
 *  means here — the entirety is on screen, and the search takes things away. */
function BookTable({ rows, total, truncated }: { rows: RateBookRow[]; total: number; truncated: boolean }) {
  const { visible, hasMore, sentinelRef } = useLazyBatch(rows);
  return (
    <>
      <Table
        stickyHeader
        head={["Insurer", "Contract holder", "County", "Clinicians", "90837 in-network rate", "As-of"]}
      >
        {visible.map((r) => (
          <Tr key={`${r.payer}|${r.tin}`}>
            <Td>
              <InsurerCell payer={r.payer} />
            </Td>
            <Td className="max-w-72">
              <span className="block truncate font-medium text-text" title={r.holder}>
                {r.holder}
              </span>
              <span className="block truncate font-mono text-[12px] text-text-muted">{r.tin}</span>
            </Td>
            <Td className="whitespace-nowrap text-text-body">{r.county ?? "–"}</Td>
            <Td className="whitespace-nowrap tabular-nums text-text-body">{r.clinicians.toLocaleString("en-US")}</Td>
            <Td className="whitespace-nowrap tabular-nums text-text">{r.workhorse ?? "–"}</Td>
            <Td className="whitespace-nowrap text-text-muted">{r.asOf}</Td>
          </Tr>
        ))}
        {hasMore && <LoadMoreRow sentinelRef={sentinelRef} colSpan={6} />}
      </Table>
      {/* Say what this covers. It is NOT every book we hold rates for: sql/027
          allowlists the six insurers whose schedules resolve to one publishable
          figure per billing ID, and excludes both Aetna labels (7.9M of 9.3M
          rows, only ~4% single-rate) and the out-of-state Blues on purpose. A
          listing that implied "everything" would be the additive screen's lie
          told the other way round. */}
      <p className="text-[13px] leading-relaxed text-text-muted">
        {truncated
          ? `Showing ${rows.length.toLocaleString("en-US")} of ${total.toLocaleString("en-US")} contract books — search to narrow, or enter a 10-digit NPI to see one clinician's.`
          : `${total.toLocaleString("en-US")} contract ${total === 1 ? "book" : "books"}. Enter a 10-digit NPI to see one clinician's.`}{" "}
        Covers the insurers whose published schedules resolve to a single rate per billing ID — Aetna and the
        out-of-state Blues publish multi-rate schedules a single figure can&rsquo;t honestly represent.
      </p>
    </>
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
  const [term, setTerm] = useState(activeNpi ?? "");
  const [footprint, setFootprint] = useState<CredentialingFootprint | null>(null);
  const [attestations, setAttestations] = useState<Attestation[]>([]);
  const [books, setBooks] = useState<{ rows: RateBookRow[]; total: number; truncated: boolean } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const npiCandidate = /^\d{10}$/.test(term.trim()) ? term.trim() : null;

  const lookup = useCallback(
    async (npi: string) => {
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
    },
    [onActiveNpi],
  );

  // The listing, debounced. A 10-digit NPI is not a text search — it hands off
  // to the footprint lookup and the cards replace the table entirely.
  useEffect(() => {
    if (npiCandidate) return;
    setFootprint(null);
    const q = term.trim();
    const t = setTimeout(() => {
      setLoading(true);
      fetch(`/api/rates/books?q=${encodeURIComponent(q)}&limit=100`)
        .then((r) => r.json())
        .then((d) => {
          if (d.error) throw new Error(d.error);
          setBooks(d);
          setError(null);
        })
        .catch((e) => setError(e instanceof Error ? e.message : "Couldn't load the books."))
        .finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(t);
  }, [term, npiCandidate]);

  useEffect(() => {
    if (npiCandidate) void lookup(npiCandidate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [npiCandidate]);

  useEffect(() => {
    if (activeNpi && activeNpi !== footprint?.npi) setTerm(activeNpi);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeNpi]);

  const attByTin = new Map(attestations.map((a) => [a.tin, a]));
  const showingCards = !!npiCandidate;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <SearchInput
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Search insurers and contract holders — or enter a 10-digit NPI"
          className="w-full max-w-xl flex-1"
        />
        {showingCards && (
          <Button variant="secondary" onClick={() => setTerm("")}>
            Back to all books
          </Button>
        )}
      </div>

      {error && <Banner variant="danger">{error}</Banner>}

      {loading && !footprint && !books && (
        <TableSkeleton head={["Insurer", "Contract holder", "Clinicians", "As-of"]} rows={6} />
      )}

      {/* The listing — the screen's resting state, never blank. */}
      {!showingCards && books && !error && (
        books.rows.length === 0 ? (
          <EmptyState
            icon="corner-down-right"
            title={`No published book matches “${term.trim()}”`}
            subtext="Search an insurer or a contract holder — or clear the box to see every book we index."
          />
        ) : (
          <BookTable rows={books.rows} total={books.total} truncated={books.truncated} />
        )
      )}

      {/* Reduced to one clinician: the table gives way to their cards. */}
      {showingCards && loading && !footprint && <TableSkeleton head={["Payer", "Holder", "As-of"]} rows={2} />}

      {showingCards && footprint && footprint.foundIn.length === 0 && !loading && (
        <EmptyState
          icon="corner-down-right"
          title="No published books for this NPI"
          subtext={`${footprint.identity ? clinicianName(footprint.identity.name) : footprint.npi} has no published rate rows in the NY books we index.`}
        />
      )}

      {showingCards &&
        footprint?.foundIn.map((book) => (
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

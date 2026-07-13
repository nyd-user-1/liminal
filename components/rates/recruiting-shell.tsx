"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Banner } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Icon } from "@/components/ui/icons";
import { SearchInput } from "@/components/ui/search-input";
import { Table, Td, Tr } from "@/components/ui/table";
import { Tag } from "@/components/ui/tag";
import { TopBarActions } from "@/components/shell/topbar-slot";
import { ChipMenu } from "@/components/rates/chip-menu";
import { clinicianName } from "@/components/rates/clinician-name";
import { RATE_CPTS, cptLabel } from "@/components/rates/cpt";
import { InsurerMark } from "@/components/rates/insurer-mark";
import { TableSkeleton } from "@/components/rates/table-skeleton";
import type { CredentialingFootprint } from "@/lib/repos/rate-signals";

// Screen: Recruiting — a practice owner checks whether a candidate NPI is
// already published in the payer books that matter to them. The claim: a
// published book pays forward the moment the group adds them to the roster
// (weeks), vs full initial credentialing (months). Built on
// getCredentialingFootprint via /api/rates/footprint — same evidence as
// Panels/Roster Check, reshaped for "which books, which gaps, how fast."

const MAX_CANDIDATES = 4;

// Priority order for the qualitative "time-to-revenue" second line — picks
// the most recognizable absent payer to name rather than an arbitrary one.
const MAJOR_PAYER_ORDER = [
  /unitedhealthcare|\buhc\b/i,
  /cigna/i,
  /oxford/i,
  /metroplus/i,
  /emblem/i,
  /fidelis/i,
  /cdphp/i,
  /excellus/i,
  /highmark/i,
];

function pickMajorAbsent(absentFrom: string[]): string | null {
  for (const re of MAJOR_PAYER_ORDER) {
    const hit = absentFrom.find((p) => re.test(p));
    if (hit) return hit;
  }
  return absentFrom[0] ?? null;
}

function moneyOnly(display: string): string {
  return display.match(/\$[\d,.]+/)?.[0] ?? display;
}

function candidateLabel(f: CredentialingFootprint): string {
  return f.identity ? clinicianName(f.identity.name) : f.npi;
}

function FootprintCard({ f, payerMix }: { f: CredentialingFootprint; payerMix: string[] }) {
  const majorAbsent = pickMajorAbsent(f.absentFrom);
  const foundNames = [...new Set(f.foundIn.map((b) => b.payer))];
  const coveredCount = payerMix.length > 0 ? foundNames.filter((p) => payerMix.includes(p)).length : 0;

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-[19px] font-semibold text-text">{candidateLabel(f)}</h2>
          <p className="mt-0.5 text-sm text-text-muted">
            {f.identity
              ? [f.identity.profession, f.identity.license].filter(Boolean).join(" · ") || "Profession on file"
              : "Not in our directory — footprint from payer books only"}
          </p>
        </div>
        {payerMix.length > 0 && (
          <Badge variant={coveredCount > 0 ? "success" : "neutral"}>
            covers {coveredCount} of {payerMix.length} of your payers
          </Badge>
        )}
      </div>

      <div className="mt-3 space-y-1">
        <p className="text-[17px] font-semibold text-text">
          {f.foundIn.length > 0 ? (
            <>
              Published in {foundNames.join(" + ")} today — sessions billable under your group after roster-add
              (weeks), not full credentialing (months).
            </>
          ) : (
            "Not yet published in any NY-book payer we index."
          )}
        </p>
        {majorAbsent && (
          <p className="text-[15px] text-text-body">
            {majorAbsent} requires full initial credentialing (~90-day payer window).
          </p>
        )}
      </div>

      {f.foundIn.length > 0 && (
        <div className="mt-5">
          <Table
            head={["Insurer", "Network", "Holder", ...RATE_CPTS.map((c) => c.code), "As-of"]}
          >
            {f.foundIn.map((book) => {
              const highlighted = payerMix.length > 0 && payerMix.includes(book.payer);
              return (
                <Tr key={`${book.payer}|${book.tin}`} className={highlighted ? "bg-primary-wash/40" : ""}>
                  <Td className="whitespace-nowrap">
                    <span className="flex items-center gap-2">
                      <InsurerMark payer={book.payer} />
                      <span className="font-medium text-text">{book.payer}</span>
                    </span>
                  </Td>
                  <Td>
                    <span className="block max-w-40 truncate" title={book.networks.join(" · ")}>
                      {book.networks.join(" · ")}
                    </span>
                  </Td>
                  <Td>
                    <span className="block max-w-40 truncate" title={book.tin}>
                      {book.holder}
                    </span>
                    {book.platformScale && <span className="text-[13px] text-text-muted">via platform group</span>}
                  </Td>
                  {RATE_CPTS.map((c) => {
                    const val = book.codes[c.code];
                    return (
                      <Td key={c.code} className="whitespace-nowrap" title={cptLabel(c.code)}>
                        {val ? (
                          <span title={val} className="font-medium text-text">
                            {moneyOnly(val)}
                          </span>
                        ) : (
                          <span className="text-text-muted" title={`No published ${c.code} rate`}>
                            —
                          </span>
                        )}
                      </Td>
                    );
                  })}
                  <Td className="whitespace-nowrap text-text-muted">{book.asOf}</Td>
                </Tr>
              );
            })}
          </Table>
        </div>
      )}

      <div className="mt-5 space-y-2 border-t border-border pt-4">
        <p className="text-sm font-medium text-text">
          Checked {f.checkedBooks.length} NY payer books · found in {f.foundIn.length}
        </p>
        {f.absentFrom.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {f.absentFrom.map((p) => (
              <Tag key={p} hue="grey">
                {p}
              </Tag>
            ))}
          </div>
        )}
        <p className="text-[13px] text-text-muted">
          Absence is only claimable for the NY books we index — other-state regional books are not yet indexed.
        </p>
      </div>

      <p className="mt-4 border-t border-border pt-3 text-[13px] leading-relaxed text-text-muted">
        Presence is the payer&rsquo;s own published attestation as of the file date — it does not prove current
        employment or panel status. Never a background check.
      </p>
    </Card>
  );
}

export function RecruitingShell() {
  const [q, setQ] = useState("");
  const [footprints, setFootprints] = useState<CredentialingFootprint[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [payerMix, setPayerMix] = useState<string[]>([]);

  const npiCandidate = /^\d{10}$/.test(q.trim()) ? q.trim() : null;

  const lookup = async () => {
    if (!npiCandidate) return;
    if (footprints.length >= MAX_CANDIDATES) {
      setError(`Compare up to ${MAX_CANDIDATES} candidates at once — dismiss one first.`);
      return;
    }
    if (footprints.some((f) => f.npi === npiCandidate)) {
      setQ("");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/rates/footprint?npis=${npiCandidate}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Lookup failed.");
      setFootprints((prev) => [...prev, ...data.footprints]);
      setQ("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Lookup failed.");
    } finally {
      setLoading(false);
    }
  };

  const payerMixOptions = useMemo(
    () => (footprints[0]?.checkedBooks ?? []).map((p) => ({ value: p, label: p, lead: <InsurerMark payer={p} /> })),
    [footprints],
  );

  const compareRows = useMemo(() => {
    if (footprints.length < 2) return [];
    const payers = [...new Set(footprints.flatMap((f) => f.foundIn.map((b) => b.payer)))].sort();
    return payers.map((payer) => ({
      payer,
      cells: footprints.map((f) => f.foundIn.find((b) => b.payer === payer)?.codes["90837"] ?? null),
    }));
  }, [footprints]);

  return (
    <div className="space-y-5">
      <TopBarActions>
        <Button
          size="sm"
          leftIcon="download"
          disabled={footprints.length === 0}
          onClick={() => window.open(`/recruiting/print?npis=${footprints.map((f) => f.npi).join(",")}`, "_blank")}
        >
          Print comparison
        </Button>
      </TopBarActions>

      <div className="flex flex-wrap items-center gap-3">
        <SearchInput
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && lookup()}
          placeholder="Enter a candidate's 10-digit NPI"
          className="w-full max-w-md"
        />
        {npiCandidate && (
          <Button onClick={lookup} loading={loading}>
            Look up NPI
          </Button>
        )}
        {payerMixOptions.length > 0 && (
          <ChipMenu
            label="Your payers"
            options={payerMixOptions}
            values={payerMix}
            onToggle={(v) => setPayerMix((prev) => (prev.includes(v) ? prev.filter((p) => p !== v) : [...prev, v]))}
            onClear={() => setPayerMix([])}
          />
        )}
        {footprints.map((f) => (
          <Tag key={f.npi} hue="teal" onDismiss={() => setFootprints((prev) => prev.filter((p) => p.npi !== f.npi))}>
            {candidateLabel(f)}
          </Tag>
        ))}
      </div>

      {error && <Banner variant="danger">{error}</Banner>}

      {loading && footprints.length === 0 && <TableSkeleton head={["Candidate", "Identity", "Footprint"]} rows={2} />}

      {!loading && footprints.length === 0 && !error && (
        <EmptyState
          icon="users-round"
          title="Know a candidate's footprint before you hire"
          subtext="Enter any NPI to see which NY payer books already publish them — and how fast that translates into billable sessions after a roster-add."
        />
      )}

      {footprints.map((f) => (
        <FootprintCard key={f.npi} f={f} payerMix={payerMix} />
      ))}

      {compareRows.length > 0 && (
        <Card>
          <h2 className="mb-4 text-[17px] font-semibold text-text">Compare — 90837 by payer</h2>
          <Table
            head={["Insurer", ...footprints.map((f) => candidateLabel(f))]}
          >
            {compareRows.map((row) => (
              <Tr key={row.payer}>
                <Td className="whitespace-nowrap">
                  <span className="flex items-center gap-2">
                    <InsurerMark payer={row.payer} />
                    {row.payer}
                  </span>
                </Td>
                {row.cells.map((cell, i) => (
                  <Td key={i} className="whitespace-nowrap">
                    {cell ? (
                      <span className="flex items-center gap-1.5 font-medium text-text">
                        <Icon name="circle-check" size={16} className="text-success" />
                        {moneyOnly(cell)}
                      </span>
                    ) : (
                      <span className="text-text-muted">—</span>
                    )}
                  </Td>
                ))}
              </Tr>
            ))}
          </Table>
        </Card>
      )}
    </div>
  );
}

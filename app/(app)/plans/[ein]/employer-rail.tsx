import type { Employer, EmployerRegistry } from "@/lib/repos/plans";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Icon } from "@/components/ui/icons";

// Employer detail rail — mirrors ProviderOverview's identity-card idiom
// (fixed header, hairline-divided Record section) from the directory's
// calendar-style split. Employers aren't people, so the header uses an icon
// box instead of an Avatar.

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[15px] font-semibold text-text">{label}</p>
      <div className="mt-0.5 text-[15px] leading-relaxed text-text-body">{children}</div>
    </div>
  );
}

export function EmployerRail({ employer, registry }: { employer: Employer; registry: EmployerRegistry | null }) {
  const name = titleCase(employer.name);

  return (
    <Card className="flex h-full min-h-0 flex-col overflow-hidden !p-0">
      <div className="shrink-0 border-b border-border px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-card bg-primary-wash text-primary">
            <Icon name="credit-card" size={20} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[19px] font-bold leading-tight text-text">{name}</p>
            <p className="mt-0.5 truncate text-sm text-text-muted">EIN {formatEin(employer.ein)}</p>
          </div>
          {employer.selfFunded ? (
            <Badge variant="info" className="shrink-0 self-start">
              Self-funded
            </Badge>
          ) : (
            <Badge variant="neutral" className="shrink-0 self-start">
              Insured
            </Badge>
          )}
        </div>
      </div>

      <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto p-6">
        <section>
          <h2 className="mb-4 text-[17px] font-semibold text-text">Record</h2>
          <div className="space-y-5">
            <Row label="Market type">{employer.marketType ? cap(employer.marketType) : "—"}</Row>
            <Row label="Plans">{employer.planCount.toLocaleString()}</Row>
            <Row label="State">{employer.state ?? "—"}</Row>
          </div>
        </section>

        {registry && (
          // The DOL/EFAST2 record behind the ToC-derived employer — the named
          // carriers it actually files with, and (via stop-loss) the federal
          // confirmation of self-funding the ToC only implied. Public data, no PHI.
          <section className="mt-6 border-t border-border pt-5">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <h2 className="text-[17px] font-semibold text-text">Federal registry</h2>
              <Badge variant="neutral">Form 5500 · {registry.planYear}</Badge>
            </div>
            <div className="space-y-5">
              {registry.selfFundedTell && (
                <Badge variant="info">Stop-loss on file — self-funded</Badge>
              )}
              {registry.participants != null && (
                <Row label="Participants">{registry.participants.toLocaleString()}</Row>
              )}
              <Row label={registry.carrierCount === 1 ? "Named carrier" : `Named carriers (${registry.carrierCount})`}>
                <ul className="space-y-2">
                  {registry.carriers.map((c) => (
                    <li key={c.name} className="flex flex-col">
                      <span className="flex flex-wrap items-center gap-1.5">
                        <span className="min-w-0 break-words">{c.name}</span>
                        {c.health && <Badge variant="success">Health</Badge>}
                        {c.stopLoss && <Badge variant="warning">Stop-loss</Badge>}
                      </span>
                      {c.coveredLives != null && (
                        <span className="text-sm text-text-muted">{c.coveredLives.toLocaleString()} covered lives</span>
                      )}
                    </li>
                  ))}
                  {registry.carrierCount > registry.carriers.length && (
                    <li className="text-sm text-text-muted">
                      +{(registry.carrierCount - registry.carriers.length).toLocaleString()} more
                    </li>
                  )}
                </ul>
              </Row>
            </div>
          </section>
        )}
      </div>
    </Card>
  );
}

function formatEin(ein: string): string {
  const m = ein.match(/^(\d{2})(\d{7})$/);
  return m ? `${m[1]}-${m[2]}` : ein;
}
function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
function titleCase(s: string): string {
  return s.replace(/\b([A-Z])([A-Z']+)\b/g, (_, a, b) => a + b.toLowerCase())
    .replace(/\bLlc\b/i, "LLC").replace(/\bInc\b/i, "Inc").replace(/\bPc\b/i, "PC")
    .replace(/\bUsa\b/i, "USA").replace(/\bNy\b/i, "NY").replace(/\bMta\b/i, "MTA");
}

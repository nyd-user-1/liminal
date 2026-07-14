import type { Employer } from "@/lib/repos/plans";
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

export function EmployerRail({ employer }: { employer: Employer }) {
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

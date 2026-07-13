import type { Employer } from "@/lib/repos/plans";
import { Badge } from "@/components/ui/badge";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Icon } from "@/components/ui/icons";

// Detail-page entity header — the allowed exception to "no H1 in page content".
export function EmployerHeader({
  employer,
  networkCount,
}: {
  employer: Employer;
  networkCount: number;
}) {
  const name = titleCase(employer.name);
  const meta = [
    employer.state,
    employer.marketType ? cap(employer.marketType) : null,
    `${employer.planCount} plan${employer.planCount === 1 ? "" : "s"}`,
    networkCount ? `${networkCount} network${networkCount === 1 ? "" : "s"}` : null,
  ].filter(Boolean);

  return (
    <div className="mb-6">
      <Breadcrumb items={[{ label: "Plans", href: "/plans" }, { label: name }]} className="mb-4" />
      <div className="flex items-center gap-4">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-card bg-primary-wash text-primary">
          <Icon name="credit-card" size={26} />
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="truncate text-[28px] font-bold text-text">{name}</h1>
            {employer.selfFunded ? (
              <Badge variant="info">Self-funded</Badge>
            ) : (
              <Badge variant="neutral">Insured</Badge>
            )}
          </div>
          <p className="mt-0.5 truncate text-sm text-text-muted">
            <span className="font-mono tabular-nums">EIN {formatEin(employer.ein)}</span>
            {meta.length ? ` · ${meta.join(" · ")}` : ""}
          </p>
        </div>
      </div>
    </div>
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

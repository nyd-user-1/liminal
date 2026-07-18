import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Icon } from "@/components/ui/icons";
import { ListRow } from "@/components/ui/list-row";
import { formatDate } from "@/lib/format";
import type { ReportEntry } from "@/lib/repos/reports";
import { EcoSection } from "./section";

// The fleet — the ten standing terminals that do the work, and the trail of what
// they shipped. The roster is who's on staff; the ledger below reads the actual
// reports on disk (docs/reports/), newest first, so "the fleet is producing" is
// shown, not asserted. If the reports dir isn't bundled the roster stands alone.

type Agent = { name: string; model: "fable" | "opus"; blurb: string; mine?: boolean };

const FLEET: Agent[] = [
  { name: "lead", model: "fable", blurb: "Writes the briefs, reviews every report, rules on every flag — dispatcher today, reviewer as the loop matures." },
  { name: "data", model: "fable", blurb: "Supply-side acquisition — harvests payer MRF/TiC + FHIR directories, cracks walled payers, runs the loaders." },
  { name: "quality", model: "opus", blurb: "Data trustworthiness — matview/repo correctness, measure-before-port forensics, the thin product surfaces." },
  { name: "ui", model: "opus", blurb: "Guardian of the design system — composes the 44 primitives, kills one-offs, keeps every surface on-system.", mine: true },
  { name: "docs", model: "opus", blurb: "Institutional memory — Linear structure and the three living documents, kept dual-homed with the code." },
  { name: "review", model: "opus", blurb: "Adversarial review of a commit range — findings only, re-verifies every claim against reality." },
  { name: "security", model: "opus", blurb: "Standing posture — PHI/HIPAA handling, auth on every route, secret hygiene across both repos." },
  { name: "ops", model: "opus", blurb: "The automation fleets and their tripwires; sequences migrations so no sql/0XX range collides." },
  { name: "research", model: "opus", blurb: "Discovery spikes that end in a sized, buildable brief — a number, never a vibe." },
  { name: "qa", model: "opus", blurb: "End-to-end headless product drives after big change days — reads the output, not the exit code." },
];

export function Fleet({ reports }: { reports: ReportEntry[] }) {
  return (
    <EcoSection
      icon="users-round"
      eyebrow="The workforce"
      title="The agent fleet"
      blurb="Ten standing terminals, each a specialist with its own seam. The lead briefs; they execute, report, and hand back — the same loop, every night."
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {FLEET.map((a) => (
          <Card key={a.name} className="flex min-w-0 flex-col gap-1.5 p-4">
            <span className="flex flex-wrap items-center gap-2">
              <span className="text-[15px] font-semibold text-text">{a.name}</span>
              <Badge variant={a.model === "fable" ? "info" : "neutral"}>{a.model}</Badge>
              {a.mine && <Badge variant="success">built this page</Badge>}
            </span>
            <p className="text-sm leading-relaxed text-text-muted">{a.blurb}</p>
          </Card>
        ))}
      </div>

      {reports.length > 0 && (
        <div className="mt-1 flex min-w-0 flex-col gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-text-muted">Latest reports</span>
          <div className="flex min-w-0 flex-col gap-2">
            {reports.map((r) => (
              <ListRow
                key={r.slug}
                leading={<Icon name="file-text" size={16} className="text-text-muted" />}
                title={r.title}
                meta={<span className="font-mono text-[11px] tracking-wide">{r.slug}</span>}
                trailing={
                  <span className="text-[13px] tabular-nums text-text-muted">{formatDate(`${r.date}T12:00:00`)}</span>
                }
              />
            ))}
          </div>
        </div>
      )}
    </EcoSection>
  );
}

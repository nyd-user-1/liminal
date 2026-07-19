import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Icon, type IconName } from "@/components/ui/icons";
import { TextLink } from "@/components/ui/text-link";
import { EcoSection } from "./section";

// The next rung — what turns a fleet that's dispatched into one that sustains
// itself. Three founder-filed High issues, each a mechanism the system is still
// missing: it summons itself, it watches its own fuel, it distrusts its own
// success. This page (NYS-125) is the fourth, shipping now.

type Rung = { id: string; icon: IconName; title: string; why: string; url: string };

const RUNGS: Rung[] = [
  {
    id: "NYS-122",
    icon: "clock",
    title: "Self-summoning agents on cadence",
    why: "Agents invoke themselves on schedule instead of waiting for a pasted kickoff — and the lead's role shifts from dispatcher to reviewer.",
    url: "https://linear.app/nysgpt/issue/NYS-122",
  },
  {
    id: "NYS-123",
    icon: "activity",
    title: "Budget-aware fleet pacing",
    why: "The system reads its own fuel gauge: throttle near window limits, prefer cheap models for mechanical work, hand off across accounts deliberately instead of dying mid-tranche.",
    url: "https://linear.app/nysgpt/issue/NYS-123",
  },
  {
    id: "NYS-124",
    icon: "shield-plus",
    title: "Mechanized false-success detection",
    why: "An implausibly fast “ok” gets marked suspect — the Emblem rescan reported success while loading nothing, and only judgment caught it. Catch it by mechanism next time.",
    url: "https://linear.app/nysgpt/issue/NYS-124",
  },
];

export function NextRung() {
  return (
    <EcoSection
      icon="arrow-right"
      eyebrow="Self-sustaining, self-healing"
      title="The next rung"
      blurb="Plumbing keeps it alive; these make it run itself. Each is a mechanism the fleet still leans on a human for."
    >
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {RUNGS.map((r) => (
          <Card key={r.id} className="flex min-w-0 flex-col gap-2 p-5">
            <span className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2">
                <Icon name={r.icon} size={16} className="text-primary" />
                <span className="font-mono text-[12px] tracking-wide text-text-muted">{r.id}</span>
              </span>
              <Badge variant="warning">High</Badge>
            </span>
            <h3 className="text-[15px] font-semibold leading-snug text-text">{r.title}</h3>
            <p className="flex-1 text-sm leading-relaxed text-text-muted">{r.why}</p>
            <TextLink href={r.url} className="text-[13px]" target="_blank" rel="noreferrer">
              View in Linear
            </TextLink>
          </Card>
        ))}
      </div>
      <p className="text-sm text-text-muted">
        <span className="font-mono text-[12px] text-text-body">NYS-125</span>
        {" — this page, the ecosystem’s front door — is the fourth rung, shipping now."}
      </p>
    </EcoSection>
  );
}

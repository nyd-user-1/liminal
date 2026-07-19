import { Card } from "@/components/ui/card";
import { Icon, type IconName } from "@/components/ui/icons";
import { TextLink } from "@/components/ui/text-link";
import { EcoSection } from "./section";

// Taste — the standards that make ten independent terminals read like one hand.
// Plumbing keeps the ecosystem alive; these keep it coherent. Every invariant
// here is load-bearing: drop one and the surfaces drift, the facts fork, and the
// fleet stops reading as a single author. Each links to where it actually lives.

type Standard = { icon: IconName; title: string; body: string; href?: string; link?: string };

const STANDARDS: Standard[] = [
  {
    icon: "grid",
    title: "Reuse the kit",
    body: "44 primitives, ~30 feature components. Compose them; a genuinely new primitive is a deliberate, announced act — never an accident of local convenience.",
    href: "/design-system",
    link: "Design system",
  },
  {
    icon: "columns-3",
    title: "One source per fact",
    body: "The table registry, the CPT labels, the coverage cohort — each has exactly one home, so no two surfaces can quietly disagree.",
    href: "/admin/data",
    link: "Data dictionary",
  },
  {
    icon: "link",
    title: "Records cross with one motion",
    body: "A value that lives in another table wears the dotted-teal underline that wipes to solid on hover — one meaning, on every surface.",
    href: "/design-system",
    link: "RelatedLink",
  },
  {
    icon: "monitor-check",
    title: "Verified means exercised",
    body: "“Done” means the surface was rendered and looked at — in both themes, at the widths that matter — not that the types happened to pass.",
  },
  {
    icon: "id-card",
    title: "One H1, in the TopBar",
    body: "Every page's title lives in the shell strip; pages never render their own. The frame is the same in every room.",
  },
  {
    icon: "users-round",
    title: "Disjoint seams",
    body: "Each agent owns a slice of the tree. A conflict escalates to the lead — it never clobbers a neighbor's work.",
  },
];

export function Taste() {
  return (
    <EcoSection
      icon="palette"
      eyebrow="Plumbing and taste"
      title="The standards that make ten agents read like one hand"
      blurb="The invariants every terminal inherits — the reason work from ten seams still looks authored by one."
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {STANDARDS.map((st) => (
          <Card key={st.title} className="flex min-w-0 gap-3 p-5">
            <Icon name={st.icon} size={18} className="mt-0.5 shrink-0 text-primary" />
            <div className="min-w-0">
              <h3 className="text-[15px] font-semibold text-text">{st.title}</h3>
              <p className="mt-0.5 text-sm leading-relaxed text-text-muted">{st.body}</p>
              {st.href && st.link && (
                <TextLink href={st.href} className="mt-1.5 text-[13px]">
                  {st.link}
                </TextLink>
              )}
            </div>
          </Card>
        ))}
      </div>
    </EcoSection>
  );
}

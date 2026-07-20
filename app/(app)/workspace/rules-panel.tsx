import { readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { isoDateTime } from "@/lib/format";
import { RULES } from "@/lib/rules";
import { RulesGrid, type RuleCardData } from "./rules-grid";
import { EcoSection } from "./section";

// The standards that make ten independent terminals read like one hand, now a
// real system: three tabs (Design · Agent · Database), each a grid of its rules.
// The card text comes from lib/rules.ts; the rule ITSELF is docs/rules/<id>.md,
// read here for the last-updated stamp and the clipboard, and opened (editable)
// in the DocSheet on click. Plumbing keeps the ecosystem alive; these keep it
// coherent — drop one and the surfaces drift, the facts fork, the fleet stops
// reading as a single author.

/** The rule's source document. Null where it isn't readable (e.g. deployed,
 *  where docs/ isn't traced into the bundle) — the card degrades to plain. */
async function ruleDoc(id: string): Promise<{ doc: string | null; updatedAt: string | null }> {
  try {
    const path = join(process.cwd(), "docs", "rules", `${id}.md`);
    const [doc, info] = await Promise.all([readFile(path, "utf8"), stat(path)]);
    return { doc, updatedAt: isoDateTime(info.mtime) };
  } catch {
    return { doc: null, updatedAt: null };
  }
}

export async function RulesPanel() {
  const sources = await Promise.all(RULES.map((r) => ruleDoc(r.id)));
  const rules: RuleCardData[] = RULES.map((r, i) => ({ ...r, ...sources[i] }));
  return (
    <EcoSection title="Rules">
      <RulesGrid rules={rules} />
    </EcoSection>
  );
}

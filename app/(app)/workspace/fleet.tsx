import { promises as fs } from "fs";
import os from "os";
import path from "path";
import { FleetGrid, type FleetAgent } from "./fleet-grid";
import { EcoSection } from "./section";

// The fleet — the ten standing terminals that do the work. The roster is who's
// on staff; each card opens that agent's identity file in the editor. What they
// shipped lives in the Operations panel's Agent Reports tab, not here.

type RosterAgent = Omit<FleetAgent, "doc">;

const FLEET: RosterAgent[] = [
  { name: "lead", label: "Lead", model: "Fable", blurb: "Writes the briefs, reviews every report, rules on every flag — dispatcher today, reviewer as the loop matures." },
  { name: "data", label: "Data", model: "Fable", blurb: "Supply-side acquisition — harvests payer MRF/TiC + FHIR directories, cracks walled payers, runs the loaders." },
  { name: "quality", label: "Quality", model: "Opus", blurb: "Data trustworthiness — matview/repo correctness, measure-before-port forensics, the thin product surfaces." },
  { name: "ui", label: "UI", model: "Opus", blurb: "Guardian of the design system — composes the 44 primitives, kills one-offs, keeps every surface on-system.", mine: true },
  { name: "docs", label: "Docs", model: "Opus", blurb: "Institutional memory — Linear structure and the three living documents, kept dual-homed with the code." },
  { name: "review", label: "Review", model: "Opus", blurb: "Adversarial review of a commit range — findings only, re-verifies every claim against reality." },
  { name: "security", label: "Security", model: "Opus", blurb: "Standing posture — PHI/HIPAA handling, auth on every route, secret hygiene across both repos." },
  { name: "ops", label: "Ops", model: "Opus", blurb: "The automation fleets and their tripwires; sequences migrations so no sql/0XX range collides." },
  { name: "research", label: "Research", model: "Opus", blurb: "Discovery spikes that end in a sized, buildable brief — a number, never a vibe." },
  { name: "qa", label: "QA", model: "Opus", blurb: "End-to-end headless product drives after big change days — reads the output, not the exit code." },
];

/** The agent's identity file (~/.claude/agents/<name>-agent.md, docs-agent-maintained).
 *  Null where the file isn't readable (e.g. deployed) — the card degrades to plain. */
async function agentDoc(name: string): Promise<string | null> {
  try {
    const p = path.join(os.homedir(), ".claude", "agents", `${name}-agent.md`);
    return await fs.readFile(p, "utf8");
  } catch {
    return null;
  }
}

export async function Fleet() {
  const docs = await Promise.all(FLEET.map((a) => agentDoc(a.name)));
  const agents: FleetAgent[] = FLEET.map((a, i) => ({ ...a, doc: docs[i] }));
  return (
    <EcoSection icon="users-round" title="The agent fleet">
      <FleetGrid agents={agents} />
    </EcoSection>
  );
}

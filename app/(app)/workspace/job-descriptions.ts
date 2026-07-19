// Plain-language description for a sync_runs.job id — grounded in
// ops/harvest/jobs.json's own memos and lib/repos/admin.ts's INSURERS
// registry, so this never drifts into invented prose. Shared by Run History
// and the Sync health card's Harvest runs table — one resolver, one wording.

const FIXED: Record<string, string> = {
  daily: "Nightly matview rebuild — refreshes /rates and /directory for the day.",
  "harvest:rates-rollup": "Read-only morning rate-coverage report — the log is the deliverable.",
  "harvest:fhir-status": "Directory-side coverage snapshot across payer FHIR endpoints.",
  "harvest:nppes-weekly": "Discovers, downloads, and applies the CMS weekly NPPES delta + deactivations.",
  "harvest:probe-payers": "Read-only capability probe (≤2 GETs per payer) — keeps payer reachability honest.",
  "harvest:db-atlas": "Regenerates docs/data/DATABASE.md + the Obsidian atlas from the live schema.",
};

/** Payer slug → canonical name (lib/repos/admin.ts's INSURERS), for the
 *  manifest-driven harvest:mrf(-wide|-stream|-2p)?-<slug> jobs. */
const PAYER_SLUG: Record<string, string> = {
  mvp: "MVP Health Care",
  metroplus: "MetroPlus",
  fidelis: "Fidelis Care (Centene)",
  emblem: "EmblemHealth (HIP/GHI)",
  cdphp: "CDPHP",
  uhc: "UnitedHealthcare / Oxford",
  oxford: "UnitedHealthcare / Oxford",
  anthem: "Empire BCBS / Anthem",
  cigna: "Cigna",
  healthfirst: "Healthfirst",
  aetna: "Aetna (CVS)",
  excellus: "Excellus BCBS",
  highmark: "Independent Health / Highmark",
  univera: "Univera / Molina / Elderplan",
  molina: "Univera / Molina / Elderplan",
};

const MRF_RE = /^harvest:mrf-(?:wide-|stream-|2p-)?(.+)$/;
const PAYER_KEYS = Object.keys(PAYER_SLUG).sort((a, b) => b.length - a.length);

export function jobDescription(job: string): string {
  if (FIXED[job]) return FIXED[job];
  const m = job.match(MRF_RE);
  if (m) {
    const slug = m[1];
    const key = PAYER_KEYS.find((k) => slug.includes(k));
    if (key) return `${PAYER_SLUG[key]} — in-network rate file harvest.`;
  }
  // Unrecognized job (a new manifest, a new recurring job) — humanize the id
  // rather than guess at what it does.
  return job.replace(/^harvest:/, "").replace(/-/g, " ");
}

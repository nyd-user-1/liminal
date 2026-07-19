// The Linear board snapshot the /workspace work queue renders — captured by
// hand (no Linear API in this tree), so it carries an explicit asOf stamp and
// is presented as a snapshot, never as live state. Order is fixed here: In
// Progress first, then the backlog by priority (Urgent → High → Medium → Low →
// None). The queue component renders BACKLOG in array order.

export type Priority = "Urgent" | "High" | "Medium" | "Low" | "None";
export type IssueStatus = "In Progress" | "Backlog";

export interface BacklogIssue {
  id: string;
  title: string;
  priority: Priority;
  status: IssueStatus;
  /** Linear project, where known. The snapshot didn't carry per-issue projects. */
  project?: string;
}

/** The date this snapshot was taken, rendered as the queue's muted sub-line. */
export const ASOF = "2026-07-18";

const IN_PROGRESS: BacklogIssue[] = [
  { id: "NYS-37", priority: "Urgent", status: "In Progress", title: "Find my plan — patient-facing cost at employer-plan resolution" },
  { id: "NYS-25", priority: "High", status: "In Progress", title: "Empire 39-series heap OOM diagnostic" },
  { id: "NYS-26", priority: "High", status: "In Progress", title: "NY-license NPPES expansion (telehealth gap)" },
  { id: "NYS-32", priority: "High", status: "In Progress", title: "KYR phase 2: Recruiting · Roster Check · Apply Next" },
  { id: "NYS-36", priority: "High", status: "In Progress", title: "Model the plan entity" },
  { id: "NYS-147", priority: "Medium", status: "In Progress", title: "DataTable pattern roadmap" },
  { id: "NYS-13", priority: "Medium", status: "In Progress", title: "UHC MRF rates PoC" },
  { id: "NYS-91", priority: "None", status: "In Progress", title: "/rates tools: reductive, not additive" },
];

const BACKLOG_ITEMS: BacklogIssue[] = [
  { id: "NYS-138", priority: "Urgent", status: "Backlog", title: "44b: rotate the leaked Neon DB password" },
  { id: "NYS-130", priority: "High", status: "Backlog", title: "Cloud belt via GitHub Actions" },
  { id: "NYS-39", priority: "High", status: "Backlog", title: "Plans catalog surface" },
  { id: "NYS-148", priority: "High", status: "Backlog", title: "The universal record shape" },
  { id: "NYS-146", priority: "High", status: "Backlog", title: "Load Form 5500-SF" },
  { id: "NYS-123", priority: "High", status: "Backlog", title: "Budget-aware fleet pacing" },
  { id: "NYS-122", priority: "High", status: "Backlog", title: "Self-summoning agents on cadence" },
  { id: "NYS-53", priority: "High", status: "Backlog", title: "Anthem Provider Directory API expansion" },
  { id: "NYS-65", priority: "High", status: "Backlog", title: "Port heavy scripts to the Neon WebSocket Pool" },
  { id: "NYS-41", priority: "High", status: "Backlog", title: "Model organizations as first-class (NPI-2)" },
  { id: "NYS-42", priority: "High", status: "Backlog", title: "Table Standard: one canonical table primitive" },
  { id: "NYS-43", priority: "High", status: "Backlog", title: "Rate-directory row click 404s" },
  { id: "NYS-64", priority: "High", status: "Backlog", title: "scan-tic drops billing_code_modifier" },
  { id: "NYS-78", priority: "High", status: "Backlog", title: "Export/Refresh toolbar drift" },
  { id: "NYS-23", priority: "High", status: "Backlog", title: "HIPAA: vendor BAAs" },
  { id: "NYS-11", priority: "High", status: "Backlog", title: "PHI security hardening pass" },
  { id: "NYS-18", priority: "High", status: "Backlog", title: "Corroboration model + confidence signal" },
  { id: "NYS-149", priority: "Medium", status: "Backlog", title: "Runner scripts: propagate PIPESTATUS" },
  { id: "NYS-29", priority: "Medium", status: "Backlog", title: "HealthSparq wall: Excellus/Univera/MVP/IH" },
  { id: "NYS-142", priority: "Medium", status: "Backlog", title: "Table-naming pass" },
  { id: "NYS-145", priority: "Medium", status: "Backlog", title: "/orgs identity card wrap" },
  { id: "NYS-35", priority: "Medium", status: "Backlog", title: "Employer Signals prospecting" },
  { id: "NYS-22", priority: "Medium", status: "Backlog", title: "Real Stripe billing + superbill PDF" },
  { id: "NYS-94", priority: "Medium", status: "Backlog", title: "/rates TypeError .split" },
  { id: "NYS-134", priority: "Medium", status: "Backlog", title: "Public /search (marketing)" },
  { id: "NYS-133", priority: "Medium", status: "Backlog", title: "Directory search BitmapOr residual" },
  { id: "NYS-50", priority: "Medium", status: "Backlog", title: "Expand the billing-code panel" },
  { id: "NYS-115", priority: "Medium", status: "Backlog", title: "Shared data-dictionary metadata" },
  { id: "NYS-72", priority: "Medium", status: "Backlog", title: "payer_sources hygiene" },
  { id: "NYS-111", priority: "Medium", status: "Backlog", title: "Aetna Provider Directory app" },
  { id: "NYS-112", priority: "Medium", status: "Backlog", title: "Aetna two-entity overlap check" },
  { id: "NYS-108", priority: "Medium", status: "Backlog", title: "Monthly re-harvest cadence" },
  { id: "NYS-107", priority: "Medium", status: "Backlog", title: "Per-payer manifest builders" },
  { id: "NYS-106", priority: "Medium", status: "Backlog", title: "Provider-rights corpus (NY)" },
  { id: "NYS-105", priority: "Medium", status: "Backlog", title: "Hospital price-transparency MRF spike" },
  { id: "NYS-103", priority: "Medium", status: "Backlog", title: "QHP/NYSOH/CMS-PUF discovery spike" },
  { id: "NYS-33", priority: "Medium", status: "Backlog", title: "Marketing nav stale provider count" },
  { id: "NYS-34", priority: "Medium", status: "Backlog", title: "Person-level merge across sources" },
  { id: "NYS-45", priority: "Medium", status: "Backlog", title: "Structured first/last from NPPES" },
  { id: "NYS-61", priority: "Medium", status: "Backlog", title: "ingest-payers pause drops rows" },
  { id: "NYS-63", priority: "Medium", status: "Backlog", title: "Consolidate provider identity onto nppes_npi" },
  { id: "NYS-66", priority: "Medium", status: "Backlog", title: "Name the 1,480 for-profit billing groups" },
  { id: "NYS-24", priority: "Medium", status: "Backlog", title: "HIPAA: administrative safeguards" },
  { id: "NYS-20", priority: "Medium", status: "Backlog", title: "Near-me search multi-office" },
  { id: "NYS-19", priority: "Medium", status: "Backlog", title: "NYS Medicaid enrolled-provider ingest" },
  { id: "NYS-17", priority: "Medium", status: "Backlog", title: "Verify UHC empty-shell psychiatrists" },
  { id: "NYS-12", priority: "Medium", status: "Backlog", title: "Program directory pages design pass" },
  { id: "NYS-141", priority: "Low", status: "Backlog", title: "Scale Horizon 2" },
  { id: "NYS-139", priority: "Low", status: "Backlog", title: "44b sync-health surface" },
  { id: "NYS-140", priority: "Low", status: "Backlog", title: "Agent roster expansion (parked)" },
  { id: "NYS-30", priority: "Low", status: "Backlog", title: "Oscar TiC files" },
  { id: "NYS-62", priority: "Low", status: "Backlog", title: "React hydration mismatch #418" },
  { id: "NYS-79", priority: "Low", status: "Backlog", title: "Object-table extraction tidy-up" },
  { id: "NYS-81", priority: "Low", status: "Backlog", title: "Rx/Orders constant Patient column" },
  { id: "NYS-82", priority: "Low", status: "Backlog", title: "Promote FieldDisplay" },
  { id: "NYS-83", priority: "Low", status: "Backlog", title: "client-billing.tsx unused" },
  { id: "NYS-59", priority: "Low", status: "Backlog", title: "Enrich full Organization+Practitioner resources" },
  { id: "NYS-60", priority: "Low", status: "Backlog", title: "Incremental Anthem via _lastUpdated" },
  { id: "NYS-21", priority: "Low", status: "Backlog", title: "Load NPPES reference files" },
  { id: "NYS-127", priority: "None", status: "Backlog", title: "/directory onto DataTable" },
  { id: "NYS-69", priority: "None", status: "Backlog", title: "Providers-per-network matview" },
  { id: "NYS-46", priority: "None", status: "Backlog", title: "Scheduled payer refresh" },
  { id: "NYS-99", priority: "None", status: "Backlog", title: "Spread check baseline UI" },
  { id: "NYS-68", priority: "None", status: "Backlog", title: "Rate rows by network label" },
  { id: "NYS-70", priority: "None", status: "Backlog", title: "% of Medicare single-rate bias" },
  { id: "NYS-71", priority: "None", status: "Backlog", title: "Data dictionary row counts" },
  { id: "NYS-52", priority: "None", status: "Backlog", title: "TIN/payer aggregates slow" },
  { id: "NYS-47", priority: "None", status: "Backlog", title: "Raw FHIR storage strategy" },
  { id: "NYS-92", priority: "None", status: "Backlog", title: "EVERGREEN extraction loop" },
  { id: "NYS-128", priority: "None", status: "Backlog", title: "Public /search (deferred)" },
  { id: "NYS-10", priority: "None", status: "Backlog", title: "Rename fleet subsystem" },
  { id: "NYS-9/7/6", priority: "None", status: "Backlog", title: "teams hardening trio" },
  { id: "NYS-8", priority: "None", status: "Backlog", title: "teams left-rail accent" },
];

/** The full board, already ordered for the queue: In Progress, then backlog. */
export const BACKLOG: BacklogIssue[] = [...IN_PROGRESS, ...BACKLOG_ITEMS];

// Shared display formatters. All date inputs accept an ISO string or Date.

function toDate(d: string | Date): Date {
  return typeof d === "string" ? new Date(d) : d;
}

/** "Jul 4, 2026" */
export function formatDate(d: string | Date): string {
  return toDate(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/** "Friday, July 4, 2026" */
export function formatDateLong(d: string | Date): string {
  return toDate(d).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
}

/** "2:30 PM" */
export function formatTime(d: string | Date): string {
  return toDate(d).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

/** "Jul 4, 2026 · 2:30 PM" */
export function formatDateTime(d: string | Date): string {
  return `${formatDate(d)} · ${formatTime(d)}`;
}

/** "07/04/2026 2:30 PM" */
export function formatDateTimeNumeric(d: string | Date): string {
  const date = toDate(d);
  const day = date.toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" });
  return `${day} ${formatTime(date)}`;
}

// ── DB row normalizers (repo layer) ───────────────────────────────────────────
// The neon driver returns Postgres date/timestamptz columns as JS Date objects
// while mock-mode rows carry ISO strings. Repos pass every date-ish column
// through these so both modes hand components identical shapes (strings).

/** timestamptz column → full ISO string. Identity on strings / null. */
export function isoDateTime(v: string | Date): string;
export function isoDateTime(v: string | Date | null): string | null;
export function isoDateTime(v: string | Date | null): string | null {
  return v instanceof Date ? v.toISOString() : v;
}

/** Plain `date` column → "YYYY-MM-DD" (local calendar parts — no TZ day shift). */
export function isoDateOnly(v: string | Date): string;
export function isoDateOnly(v: string | Date | null): string | null;
export function isoDateOnly(v: string | Date | null): string | null {
  if (v instanceof Date) {
    const p = (n: number) => String(n).padStart(2, "0");
    return `${v.getFullYear()}-${p(v.getMonth() + 1)}-${p(v.getDate())}`;
  }
  return v ? v.slice(0, 10) : v;
}

/** 12500 → "$125.00" */
export function formatCents(cents: number): string {
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
}

/** "OAKDALE" / "1200 MONTAUK HWY" → "Oakdale" / "1200 Montauk Hwy" — directory address/city columns come out of NPPES all-caps. */
export function titleCase(s: string): string {
  return s
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/\bMhotrs\b/i, "MHOTRS");
}

// Org detection for directory names: NPPES rows carry entity_type ("1" person /
// "2" org), but Medicaid rows are unenriched — for those, a digit or an
// org-shaped token means the name is a business and must not be reordered.
const ORG_NAME =
  /\d|\b(INC|LLC|PLLC|LLP|LP|PC|CORP|CO|COMPANY|CENTER|CENTRE|SERVICES?|ASSOCIATES?|GROUP|CLINIC|HOSPITAL|HEALTH|MEDICAL|CARE|COUNSELING|PSYCHOLOGY|PSYCHOTHERAPY|THERAPY|WELLNESS|PRACTICE|PARTNERS?|FOUNDATION|INSTITUTE|NETWORK|AGENCY|PROGRAM|OPERATING|DEPARTMENT|UNIVERSITY|COLLEGE|OFFICE)\b/i;

/** Directory provider names arrive "LAST FIRST [MIDDLE …]" (NPPES order) —
 *  show people as "First [Middle] Last". Organizations keep their name as-is. */
export function providerDisplayName(raw: string, entityType?: string | null): string {
  const t = titleCase(raw.replace(/^[^A-Za-z0-9]+/, "").trim()); // strip stray leading punctuation ("/MOLLOY MELISSA")
  if (entityType === "2") return t;
  if (entityType !== "1" && ORG_NAME.test(raw)) return t;
  const parts = t.split(/\s+/).filter(Boolean);
  return parts.length < 2 ? t : [...parts.slice(1), parts[0]].join(" ");
}

/** "5184561211" → "(518) 456-1211"; non-10-digit values pass through untouched. */
export function formatPhone(phone: string | null | undefined): string {
  const d = (phone ?? "").replace(/\D/g, "");
  if (d.length === 10) return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  return phone ?? "";
}

// Directory profession → the short label used wherever the full title is too
// long (recruiting Type column, profile header). A provider's real NPPES
// credential (e.g. "PNP") beats this map when present.
const PROFESSION_SHORT: Record<string, string> = {
  "Psychiatric Nurse Practitioner": "Psych NP",
  "Clinical Social Worker": "Social Worker",
  "Mental Health Counselor": "Counselor",
  "Marriage & Family Therapist": "MFT",
  Psychiatrist: "Psychiatrist",
  Psychologist: "Psychologist",
};
export function shortProfession(p: string | null | undefined): string {
  if (!p) return "—";
  return PROFESSION_SHORT[p] ?? PROFESSION_SHORT[titleCase(p)] ?? titleCase(p);
}

/** "122033834" → "12203-3834"; "12203" stays. Strips non-digits first. */
export function formatZip(zip: string | null | undefined): string {
  const d = (zip ?? "").replace(/\D/g, "");
  if (d.length === 9) return `${d.slice(0, 5)}-${d.slice(5)}`;
  return d.slice(0, 5);
}

// First-3-digit ZIP prefix → state. The directory doesn't store a practice
// state (NPPES ingest kept only city/county/zip) and the license state is the
// WRONG answer for NY-licensed out-of-state telehealth rows — the prefix is
// deterministic and always matches the address.
const ZIP3_STATES: Array<[number, number, string]> = [
  [5, 5, "NY"], [6, 9, "PR"], [10, 27, "MA"], [28, 29, "RI"], [30, 38, "NH"],
  [39, 49, "ME"], [50, 59, "VT"], [60, 69, "CT"], [70, 89, "NJ"], [100, 149, "NY"],
  [150, 196, "PA"], [197, 199, "DE"], [200, 205, "DC"], [206, 219, "MD"], [220, 246, "VA"],
  [247, 268, "WV"], [270, 289, "NC"], [290, 299, "SC"], [300, 319, "GA"], [320, 349, "FL"],
  [350, 369, "AL"], [370, 385, "TN"], [386, 397, "MS"], [398, 399, "GA"], [400, 427, "KY"],
  [430, 459, "OH"], [460, 479, "IN"], [480, 499, "MI"], [500, 528, "IA"], [530, 549, "WI"],
  [550, 567, "MN"], [570, 577, "SD"], [580, 588, "ND"], [590, 599, "MT"], [600, 629, "IL"],
  [630, 658, "MO"], [660, 679, "KS"], [680, 693, "NE"], [700, 714, "LA"], [716, 729, "AR"],
  [730, 749, "OK"], [750, 799, "TX"], [800, 816, "CO"], [820, 831, "WY"], [832, 838, "ID"],
  [840, 847, "UT"], [850, 865, "AZ"], [870, 884, "NM"], [885, 885, "TX"], [889, 898, "NV"],
  [900, 961, "CA"], [967, 968, "HI"], [970, 979, "OR"], [980, 994, "WA"], [995, 999, "AK"],
];

/** "12203…" → "NY"; null when the prefix is unknown/military. */
export function stateFromZip(zip: string | null | undefined): string | null {
  const d = (zip ?? "").replace(/\D/g, "");
  if (d.length < 3) return null;
  const p = Number(d.slice(0, 3));
  const hit = ZIP3_STATES.find(([from, to]) => p >= from && p <= to);
  return hit ? hit[2] : null;
}

// MRF network labels are often machine slugs ("localplus-with-ebh-plus-pathwell").
// Prettify ONLY hyphenated all-lowercase words — mixed-case labels (HF
// HF-MANAGEMENT…, Choice Plus) pass through untouched. Known product tokens
// get their branded casing. The durable fix is the canonical network
// crosswalk (Linear NYS-49); this is display-layer only.
const NETWORK_TOKEN: Record<string, string> = {
  localplus: "LocalPlus®",
  ebh: "EBH",
  oap: "OAP",
  hmo: "HMO",
  ppo: "PPO",
  epo: "EPO",
  pos: "POS",
  hdhp: "HDHP",
  snp: "SNP",
  with: "with",
  and: "and",
  of: "of",
  the: "the",
};
// Known literal prefixes (exact match) — decoded entity names ride in front of
// the remaining plan tokens. HF = Healthfirst (these rows came from the
// Aetna-Healthfirst TPA book; labels are truncated at the source).
const NETWORK_LITERAL_PREFIX: Array<[string, string]> = [
  ["HF HF-MANAGEMENT-SERVICES-LLC-", "Healthfirst Management Services LLC · "],
];

export function prettyNetworkLabel(name: string): string {
  for (const [prefix, replacement] of NETWORK_LITERAL_PREFIX) {
    if (name.startsWith(prefix)) {
      const tail = name.slice(prefix.length).replace(/-/g, " ").replace(/\s+/g, " ").trim();
      return replacement + tail;
    }
  }
  return name
    .split(" ")
    .map((word) => {
      if (!word.includes("-") || word !== word.toLowerCase()) return word;
      return word
        .split("-")
        .map((t) => NETWORK_TOKEN[t] ?? (t ? t[0].toUpperCase() + t.slice(1) : t))
        .join(" ");
    })
    .join(" ");
}

/** "Casey Morgan" → "CM" */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0][0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1][0] ?? "") : "";
  return (first + last).toUpperCase();
}

// Patient-facing taxonomy over OMH's 94 program_type values (directory_programs).
// OMH speaks in license categories ("MHOTRS", "CFTSS: OLP", "SP-SRO"); patients
// ask "where do I find housing / a clinic / crisis help / something for my kid."
// Ten families, every one of the 94 types mapped explicitly (fallback:
// community-peer). Editable editorial table — counts as of 2026-07-11.
//
// Population strings are clean enum combos ("Children Adolescents Adults") —
// use parsePopulations() for audience filters, never string-match in pages.

export interface ProgramFamily {
  slug: string;
  label: string;
  /** One-sentence plain-language explainer for the family page hero. */
  blurb: string;
}

export const PROGRAM_FAMILIES: ProgramFamily[] = [
  { slug: "housing", label: "Housing & residential", blurb: "Places to live with mental-health support built in — from supported apartments to staffed residences." },
  { slug: "outpatient", label: "Clinics & outpatient care", blurb: "Licensed clinics and day programs for therapy, medication, and rehabilitation while living at home." },
  { slug: "crisis", label: "Crisis & emergency help", blurb: "Immediate help in a mental-health crisis — hotlines, mobile teams, crisis beds, and stabilization centers." },
  { slug: "care-management", label: "Care management", blurb: "A person who helps coordinate treatment, benefits, housing, and appointments across systems." },
  { slug: "act-intensive", label: "Intensive community treatment", blurb: "Teams that bring full treatment to you in the community when clinic visits aren't enough." },
  { slug: "kids-families", label: "Children, teens & families", blurb: "Services built for young people and the people raising them — at home, in school, and in the community." },
  { slug: "community-peer", label: "Peer support & community", blurb: "Support from people with lived experience — drop-in centers, clubhouses, advocacy, and everyday connection." },
  { slug: "employment-education", label: "Work & school support", blurb: "Help finding and keeping a job or getting back into school, with support that continues after you start." },
  { slug: "inpatient", label: "Hospital care", blurb: "Psychiatric units and hospitals for when someone needs round-the-clock care." },
  { slug: "respite", label: "Respite & short stays", blurb: "Planned short-term stays and breaks that let people and caregivers reset before a crisis builds." },
];

/** Every OMH program_type → family slug. Explicit, editable, exhaustive. */
export const PROGRAM_TYPE_TO_FAMILY: Record<string, string> = {
  // ── housing & residential ──────────────────────────────────────────────────
  "Supportive Housing": "housing",
  "Supportive Single Room Occupancy (SP-SRO)": "housing",
  "Congregate/Treatment": "housing",
  "Congregate/Support": "housing",
  "Apartment/Treatment": "housing",
  "Apartment/Support": "housing",
  "SRO Community Residence": "housing",
  "Children & Youth Community Residence": "housing",
  "Residential Treatment Facility - Children & Youth": "housing",
  "Community Residence for Eating Disorder Integrated Treatment Program": "housing",
  "Homeless Placement Services": "housing",
  "Nursing Home Support": "housing",
  "Adult Home Supportive Case Management": "housing",
  "CTTP for Children Youth and Families: Transitional Residential Setting (TRS)": "housing",
  // ── clinics & outpatient ───────────────────────────────────────────────────
  "Mental Health Outpatient Treatment and Rehabilitative Services (MHOTRS)": "outpatient",
  "Certified Community Behavioral Health Clinic (CCBHC)": "outpatient",
  "Day Treatment": "outpatient",
  "Continuing Day Treatment": "outpatient",
  "Partial Hospitalization": "outpatient",
  "Comprehensive PROS with Clinical Treatment": "outpatient",
  "Comprehensive PROS without Clinical Treatment": "outpatient",
  "OnTrackNY Coordinated Specialty Care First Episode Psychosis Program": "outpatient",
  "On-Site Rehabilitation": "outpatient",
  "Home-Based Family Treatment": "outpatient",
  "CORE Psychosocial Rehabilitation (PSR)": "outpatient",
  "CORE Community Psychiatric Support and Treatment (CPST)": "outpatient",
  // ── crisis & emergency ─────────────────────────────────────────────────────
  "Crisis  Intervention": "crisis", // (sic — OMH double space)
  "Home Based Crisis Intervention": "crisis",
  "Mobile Crisis Services": "crisis",
  "Crisis/Respite Beds": "crisis",
  "CPEP Crisis Intervention": "crisis",
  "Residential Crisis Support": "crisis",
  "Children's Crisis Residence": "crisis",
  "988 Crisis Hotline Center": "crisis",
  "Intensive Crisis Residence": "crisis",
  "CFTSS: Mobile Crisis Intervention (CI)": "crisis",
  "Intensive Crisis Stabilization Center": "crisis",
  "Supportive Crisis Stabilization Center": "crisis",
  "Adult BH HCBS Short-term Crisis Respite": "crisis",
  "Adult BH HCBS Intensive Crisis Respite": "crisis",
  // ── care management & coordination ─────────────────────────────────────────
  "Specialty Mental Health Care Management": "care-management",
  "Health Home Care Management": "care-management",
  "Health Home Non-Medicaid Care Management": "care-management",
  "Non-Medicaid Care Coordination": "care-management",
  "Transition Management Services": "care-management",
  "Critical Time Intervention (CTI) Team - Adult": "care-management",
  "CTTP for Children Youth and Families: Critical Time Intervention (CTI)": "care-management",
  "Safe Options Support Team": "care-management",
  "Mobile Integration Team": "care-management",
  "Geriatric Demo Gatekeeper": "care-management",
  "Geriatric Demo Physical Health - Mental Health Integration": "care-management",
  "Adult BH HCBS Self-Directed Care": "care-management",
  "Promise Zone": "care-management",
  // ── intensive community treatment ──────────────────────────────────────────
  "Assertive Community Treatment (ACT)": "act-intensive",
  "Children and Youth Assertive Community Treatment": "act-intensive",
  "Intensive Mobile Treatment for AOT": "act-intensive",
  "Intensive and Sustained Engagement Teams (INSET)": "act-intensive",
  // ── children, teens & families ─────────────────────────────────────────────
  "Family Peer Support Services - Children & Family": "kids-families",
  "CFTSS: Psychosocial Rehabilitation (PSR)": "kids-families",
  "CFTSS: Community Psychiatric Support and Treatment (CPST)": "kids-families",
  "CFTSS: Other Licensed Practitioner (OLP)": "kids-families",
  "CFTSS: Family Peer Support Services (FPSS)": "kids-families",
  "CFTSS: Youth Peer Support (YPS)": "kids-families",
  "School Mental Health Program": "kids-families",
  "HealthySteps": "kids-families",
  "Vocational Services - Children & Family (C & F)": "kids-families",
  // ── peer support & community ───────────────────────────────────────────────
  "Advocacy/Support Services": "community-peer",
  "CORE Empowerment Services - Peer Supports": "community-peer",
  "CORE Family Support and Training (FST)": "community-peer",
  "Psychosocial Club": "community-peer",
  "Drop In Centers": "community-peer",
  "Self-Help Programs": "community-peer",
  "Recovery Center": "community-peer",
  "Peer Wellness Center": "community-peer",
  "Outreach": "community-peer",
  "Recreation and/or Fitness": "community-peer",
  "Multi-Cultural Initiative": "community-peer",
  "Transportation": "community-peer",
  // ── work & school ──────────────────────────────────────────────────────────
  "Ongoing Integrated Supported Employment Services": "employment-education",
  "Assisted Competitive Employment": "employment-education",
  "Adult BH HCBS Pre-Vocational Services": "employment-education",
  "Adult BH HCBS Ongoing Supported Employment (OSE)": "employment-education",
  "Adult BH HCBS Intensive Supported Employment (ISE)": "employment-education",
  "Adult BH HCBS Education Support Services (ESS)": "employment-education",
  "Adult BH HCBS Transitional Employment": "employment-education",
  "Transitional Employment Placement (TEP)": "employment-education",
  "Work Program": "employment-education",
  "Affirmative Business/Industry": "employment-education",
  "Supported Education": "employment-education",
  "Transformed Business Model": "employment-education",
  // ── hospital ───────────────────────────────────────────────────────────────
  "Inpatient Psychiatric Unit of a General Hospital": "inpatient",
  "State Psychiatric Center Inpatient": "inpatient",
  "Private Inpatient Psychiatric Hospital": "inpatient",
  // ── respite ────────────────────────────────────────────────────────────────
  "Respite Services": "respite",
};

/** Family for a raw OMH program_type (fallback: community-peer). */
export function familyForType(programType: string | null | undefined): string {
  if (!programType) return "community-peer";
  return PROGRAM_TYPE_TO_FAMILY[programType] ?? "community-peer";
}

/** All raw program_type values belonging to a family (for SQL ANY() filters). */
export function typesForFamily(familySlug: string): string[] {
  return Object.entries(PROGRAM_TYPE_TO_FAMILY)
    .filter(([, fam]) => fam === familySlug)
    .map(([type]) => type);
}

export function familyBySlug(slug: string): ProgramFamily | undefined {
  return PROGRAM_FAMILIES.find((f) => f.slug === slug);
}

/** "Children Adolescents Adults" → audience flags. 96% of rows carry this. */
export function parsePopulations(populations: string | null | undefined): {
  children: boolean;
  adolescents: boolean;
  adults: boolean;
} {
  const s = (populations ?? "").toLowerCase();
  return {
    children: s.includes("children"),
    adolescents: s.includes("adolescent"),
    adults: s.includes("adult"),
  };
}

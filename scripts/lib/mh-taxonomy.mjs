// Shared behavioral-health NUCC taxonomy include-set — the single editable list
// that decides whether a provider belongs in our mental-health directory.
//
// Confirmed against NUCC v251. Exact codes plus two clean family prefixes (all
// 103T* are psychologists, all 103G* are clinical neuropsychologists). Psychiatry
// uses the psychiatry-specific 2084 subcodes only — the neurology/pain/sleep 2084
// subcodes are intentionally excluded.
//
// This is the same set scripts/ingest-directory.mjs applies when ingesting NPPES,
// lifted here so the payer ingester (scripts/ingest-payers.mjs) filters on the
// exact same codes. Edit here to change what counts as behavioral health.

export const MH_TAXONOMY = {
  "2084P0800X": "Psychiatrist", // Psychiatry
  "2084P0804X": "Psychiatrist", // Child & Adolescent Psychiatry
  "2084P0805X": "Psychiatrist", // Geriatric Psychiatry
  "2084P0802X": "Psychiatrist", // Addiction Psychiatry
  "2084F0202X": "Psychiatrist", // Forensic Psychiatry
  "2084P0015X": "Psychiatrist", // Psychosomatic Medicine
  "1041C0700X": "Clinical Social Worker",
  "101YM0800X": "Mental Health Counselor",
  "106H00000X": "Marriage & Family Therapist",
  "102L00000X": "Psychoanalyst",
  "103K00000X": "Behavior Analyst",
  "363LP0808X": "Psychiatric Nurse Practitioner",
};

export const MH_TAX_PREFIX = { "103T": "Psychologist", "103G": "Clinical Neuropsychologist" };

/** NUCC code → discipline label, or null if the code isn't behavioral health. */
export function taxLabel(code) {
  if (!code) return null;
  if (MH_TAXONOMY[code]) return MH_TAXONOMY[code];
  for (const pre in MH_TAX_PREFIX) if (code.startsWith(pre)) return MH_TAX_PREFIX[pre];
  return null;
}

/** True if a NUCC code is in the behavioral-health include-set. */
export function isMentalHealthTaxonomy(code) {
  return taxLabel(code) !== null;
}

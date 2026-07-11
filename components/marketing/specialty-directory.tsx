"use client";

import Link from "next/link";
import { useState } from "react";
import { Tabs } from "@/components/ui/tabs";

// /specialty directory — the two real, queryable levels of the NPPES provider
// taxonomy, mirroring the /therapists county list but built on live facets so
// every link lands on a populated /providers page (unlike the /therapists
// Specialties tab, whose curated labels go in as free-text q= and mostly miss).
//
//   • "Specialty"     = profession (the license/discipline level) → need=<value>
//   • "Sub-Specialty" = board sub-specialisation                  → specialty=<value>
//
// Each of the 15 sub-specialties rolls up to exactly one profession. `label` is
// consumer-facing; `value` is the raw facet string the search filters on.
// Verified live against directory_providers (2026-07-10).

// The 10 real profession values (exact-match on `profession`). Labels already
// read cleanly, so label === value. Counts (context): Clinical Social Worker
// 42,965 · Mental Health Counselor 25,962 · Psychologist 20,297 · Psychiatrist
// 9,006 · Behavior Analyst 8,489 · Psychiatric NP 4,883 · Marriage & Family
// Therapist 2,266 · Mental Health Rehabilitation 871 · Psychoanalyst 737 ·
// Clinical Neuropsychologist 494.
const PROFESSIONS = [
  "Behavior Analyst",
  "Clinical Neuropsychologist",
  "Clinical Social Worker",
  "Marriage & Family Therapist",
  "Mental Health Counselor",
  "Mental Health Rehabilitation",
  "Psychiatric Nurse Practitioner",
  "Psychiatrist",
  "Psychoanalyst",
  "Psychologist",
];

// The 15 board-recognized sub-specialties that actually differentiate a
// provider. The four license-restating raw values (Clinical, Mental Health,
// Psychiatry, Psychiatric/Mental Health) are dropped — they just echo the
// profession above and can't be filtered apart ("Clinical" alone covers 32k
// social workers and 7k psychologists under one raw string).
const SUBSPECIALTIES: { label: string; value: string }[] = [
  { label: "Addiction & Substance Use", value: "Addiction (Substance Use Disorder)" },
  { label: "Addiction Psychiatry", value: "Addiction Psychiatry" },
  { label: "Adult Development & Aging", value: "Adult Development & Aging" },
  { label: "Child & Adolescent Psychiatry", value: "Child & Adolescent Psychiatry" },
  { label: "Child & Adolescent Psychology", value: "Clinical Child & Adolescent" },
  { label: "Cognitive & Behavioral", value: "Cognitive & Behavioral" },
  { label: "Counseling Psychology", value: "Counseling" },
  { label: "Forensic Psychiatry", value: "Forensic Psychiatry" },
  { label: "Geriatric Psychiatry", value: "Geriatric Psychiatry" },
  { label: "Group Psychotherapy", value: "Group Psychotherapy" },
  { label: "Intellectual & Developmental Disabilities", value: "Intellectual & Developmental Disabilities" },
  { label: "Psychoanalysis", value: "Psychoanalysis" },
  { label: "Psychosomatic Medicine", value: "Psychosomatic Medicine" },
  { label: "Rehabilitation Psychology", value: "Rehabilitation" },
  { label: "School Psychology", value: "School" },
];

// Per-tab: the URL param the /providers search filters on, and the A–Z item set
// (label shown, value linked).
const PROFESSION_ITEMS = [...PROFESSIONS]
  .sort((a, b) => a.localeCompare(b))
  .map((p) => ({ label: p, value: p }));
const SUBSPECIALTY_ITEMS = [...SUBSPECIALTIES].sort((a, b) => a.label.localeCompare(b.label));

const TABS = {
  specialty: { param: "need", items: PROFESSION_ITEMS },
  subspecialty: { param: "specialty", items: SUBSPECIALTY_ITEMS },
} as const;

export function SpecialtyDirectory() {
  const [tab, setTab] = useState<keyof typeof TABS>("specialty");
  const { param, items } = TABS[tab];

  return (
    <div>
      <Tabs
        slideActive
        active={tab}
        onChange={(k) => setTab(k as keyof typeof TABS)}
        items={[
          { key: "specialty", label: "Specialty" },
          { key: "subspecialty", label: "Sub-Specialty" },
        ]}
      />
      {/* column-major fill: each column reads a→z top-to-bottom before the next.
          `key={tab}` remounts on tab change so the list re-runs its entrance —
          the content visibly refreshes as the rail slides. */}
      <ul key={tab} className="mkt-rise mt-8 columns-2 gap-8 sm:columns-3 lg:columns-4">
        {items.map(({ label, value }) => (
          <li key={value} className="mb-1 break-inside-avoid">
            <Link
              href={`/providers?${param}=${encodeURIComponent(value)}`}
              className="group -mx-2 flex items-center justify-between gap-2 rounded-field px-2 py-1.5 text-[15px] text-text-body transition-colors hover:bg-page-edge hover:text-text"
            >
              {label}
              <span aria-hidden className="text-primary opacity-0 transition-opacity group-hover:opacity-100">
                ↗
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

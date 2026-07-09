"use client";

import Link from "next/link";
import { useState } from "react";
import { Tabs } from "@/components/ui/tabs";

// /therapists directory index — three browse-by tabs. Each item links into a
// pre-filtered /find-care search rather than a dedicated per-item page — there
// are 60+ counties/cities and dozens of specialties, and /find-care is the
// real search surface (see Task 2). County/city are exact facet values (real
// query matches); specialty labels are curated marketing phrasing that won't
// always exact-match the raw NPPES subspecialty text, so they go in as a
// free-text `q` — a specialty with no hits lands on the (now real) empty state
// rather than a broken page.

// All 62 New York counties.
const COUNTIES = [
  "Albany", "Allegany", "Bronx", "Broome", "Cattaraugus", "Cayuga", "Chautauqua", "Chemung",
  "Chenango", "Clinton", "Columbia", "Cortland", "Delaware", "Dutchess", "Erie", "Essex",
  "Franklin", "Fulton", "Genesee", "Greene", "Hamilton", "Herkimer", "Jefferson", "Kings",
  "Lewis", "Livingston", "Madison", "Monroe", "Montgomery", "Nassau", "New York", "Niagara",
  "Oneida", "Onondaga", "Ontario", "Orange", "Orleans", "Oswego", "Otsego", "Putnam",
  "Queens", "Rensselaer", "Richmond", "Rockland", "Saratoga", "Schenectady", "Schoharie",
  "Schuyler", "Seneca", "St. Lawrence", "Steuben", "Suffolk", "Sullivan", "Tioga", "Tompkins",
  "Ulster", "Warren", "Washington", "Wayne", "Westchester", "Wyoming", "Yates",
];

// Top 50 NY cities by population.
const CITIES = [
  "New York", "Buffalo", "Yonkers", "Rochester", "Syracuse", "Albany", "New Rochelle",
  "Mount Vernon", "Schenectady", "Utica", "White Plains", "Troy", "Niagara Falls", "Binghamton",
  "Rome", "Long Beach", "Poughkeepsie", "North Tonawanda", "Jamestown", "Ithaca", "Elmira",
  "Newburgh", "Middletown", "Auburn", "Watertown", "Glen Cove", "Saratoga Springs", "Kingston",
  "Peekskill", "Lockport", "Plattsburgh", "Cortland", "Oswego", "Cohoes", "Rye", "Batavia",
  "Beacon", "Corning", "Dunkirk", "Fulton", "Geneva", "Glens Falls", "Gloversville", "Hornell",
  "Hudson", "Johnstown", "Lackawanna", "Mechanicville", "Norwich", "Ogdensburg",
];

// Full specialty spectrum — the app's care conditions folded together with the
// real clinical subspecialties in the directory (Child & Adolescent, Geriatric,
// Addiction, CBT, Psychoanalysis, Forensic…) plus the standard therapy specialties.
const SPECIALTIES = [
  "ADHD", "Addiction & Substance Use", "Adult Development & Aging", "Anger Management",
  "Anxiety & Stress", "Autism Spectrum", "Bipolar Disorder", "Career & Work Stress",
  "Child & Adolescent", "Chronic Illness & Pain", "Cognitive Behavioral Therapy (CBT)",
  "Couples Counseling", "Depression & Mood", "Divorce & Separation", "Eating Disorders",
  "Forensic Psychiatry", "Geriatric Care", "Grief & Loss", "Group Therapy", "Identity & Race",
  "Intellectual & Developmental Disabilities", "LGBTQIA+ Affirming", "Life Transitions",
  "Marriage & Family", "Men's Mental Health", "OCD", "Panic Disorder", "Parenting",
  "Perinatal & Postpartum", "Personality Disorders", "Phobias", "Psychoanalysis",
  "Psychosomatic Medicine", "Relationships & Family", "School & Academic", "Self-Esteem",
  "Sleep & Insomnia", "Stress Management", "Trauma & PTSD", "Women's Mental Health",
];

const TAB_DATA: Record<string, string[]> = {
  counties: COUNTIES,
  cities: CITIES,
  specialties: SPECIALTIES,
};

const PARAM: Record<string, string> = { counties: "county", cities: "city", specialties: "q" };

export function TherapistDirectory({ profession }: { profession?: string }) {
  const [tab, setTab] = useState("counties");
  const items = [...TAB_DATA[tab]].sort((a, b) => a.localeCompare(b));
  const param = PARAM[tab];

  return (
    <div>
      <Tabs
        active={tab}
        onChange={setTab}
        items={[
          { key: "counties", label: "Counties" },
          { key: "cities", label: "Cities" },
          { key: "specialties", label: "Specialties" },
        ]}
      />
      {/* column-major fill: each column reads a→z top-to-bottom before the next */}
      <ul className="mt-8 columns-2 gap-8 sm:columns-3 lg:columns-4">
        {items.map((x) => {
          const params = new URLSearchParams({ [param]: x });
          if (profession) params.set("need", profession);
          return (
            <li key={x} className="mb-1 break-inside-avoid">
              <Link
                href={`/find-care?${params.toString()}`}
                className="group -mx-2 flex items-center justify-between gap-2 rounded-field px-2 py-1.5 text-[15px] text-text-body transition-colors hover:bg-page-edge hover:text-text"
              >
                {x}
                <span aria-hidden className="text-primary opacity-0 transition-opacity group-hover:opacity-100">
                  ↗
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

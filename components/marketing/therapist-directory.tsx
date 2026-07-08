"use client";

import { useState } from "react";
import { Tabs } from "@/components/ui/tabs";

// /therapists directory index — four browse-by tabs. Lists are static for now
// (not yet wired to per-location / per-specialty pages).

// 5 NYC boroughs + the 5 surrounding downstate NY-metro counties.
const NYC_METRO = [
  "Brooklyn", "Bronx", "Queens", "Staten Island", "Manhattan",
  "Westchester", "Rockland", "Putnam", "Nassau", "Suffolk",
];

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
  "nyc-metro": NYC_METRO,
  counties: COUNTIES,
  cities: CITIES,
  specialties: SPECIALTIES,
};

export function TherapistDirectory() {
  const [tab, setTab] = useState("nyc-metro");
  const items = TAB_DATA[tab];

  return (
    <div>
      <Tabs
        active={tab}
        onChange={setTab}
        items={[
          { key: "nyc-metro", label: "NYC-Metro" },
          { key: "counties", label: "Counties" },
          { key: "cities", label: "Top Cities" },
          { key: "specialties", label: "Specialties" },
        ]}
      />
      <ul className="mt-8 grid grid-cols-2 gap-x-8 gap-y-4 sm:grid-cols-3 lg:grid-cols-4">
        {items.map((x) => (
          <li key={x}>
            <span className="text-[15px] text-text-body transition-colors hover:text-primary">{x}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

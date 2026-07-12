import type { IconName } from "@/components/ui/icons";

// Editorial layer over the 10 program families (see lib/program-taxonomy.ts).
// The taxonomy owns the slug, label, and one-line blurb; this owns the
// patient-facing page dressing — a family icon, a warm-paper hero watercolour,
// and the expanded "what it is / who it's for / how you get in" copy the family
// pages lead with. Content only; no data. Watercolours reuse the background-cut
// scenes already shipped for /care topics (alt text copied verbatim).

const CUT = "https://c1vijjkvyt1skkfe.public.blob.vercel-storage.com/illustrations/cut";

export interface FamilyContent {
  /** Two-tone family icon (icons.tsx name). */
  icon: IconName;
  /** Hero watercolour — bleeds off the right on the warm-paper ground. */
  illo: { src: string; alt: string };
  /** One or two sentences expanding the taxonomy blurb — the hero lede. */
  what: string;
  /** Who the family is built for. */
  who: string;
  /** How someone actually gets connected. */
  how: string;
}

export const FAMILY_CONTENT: Record<string, FamilyContent> = {
  housing: {
    icon: "map-pin",
    illo: {
      src: `${CUT}/veranda.avif`,
      alt: "A watercolour illustration — a columned porch lined with rocking chairs and ceiling fans, the veranda receding toward a calm green lawn.",
    },
    what: "Places to live where mental-health support is part of the address — from your own supported apartment to a staffed residence with help on hand around the clock.",
    who: "Adults, and some young people, who are ready to live in the community but do better with support close by.",
    how: "Most housing is arranged through a care manager or your county mental-health office. Call a program to ask how its referrals work.",
  },
  outpatient: {
    icon: "activity",
    illo: {
      src: `${CUT}/office.avif`,
      alt: "A watercolour illustration — a quiet office kitchenette, a coffee maker and two mugs on a wooden table by a sunlit window.",
    },
    what: "Licensed clinics and day programs for talk therapy, medication, and skills-building — all while you keep living at home.",
    who: "Anyone who wants regular, scheduled care without staying overnight.",
    how: "Many clinics take self-referrals. Call the program to book an intake appointment.",
  },
  crisis: {
    icon: "phone",
    illo: {
      src: `${CUT}/moonlit-dock.avif`,
      alt: "A watercolour illustration — a wooden dock reaching into a still lake at night, a full moon and its soft reflection on the dark water.",
    },
    what: "Immediate help in a mental-health crisis — 24/7 lines, mobile teams that come to you, crisis beds, and stabilization centers.",
    who: "Anyone in acute distress, and the people around them, at any hour.",
    how: "Call or text 988 any time. Mobile-crisis and stabilization programs also take referrals from hospitals, clinics, and care managers.",
  },
  "care-management": {
    icon: "clipboard",
    illo: {
      src: `${CUT}/sunroom.avif`,
      alt: "A watercolour illustration — a garden sunroom at dusk, two wicker chairs and a small table beside tall windows opening onto greenery.",
    },
    what: "One person whose job is to pull it all together — treatment, benefits, housing, and appointments — across every system at once.",
    who: "People juggling several providers, agencies, or benefits who want a single point of contact.",
    how: "Ask any provider or your county office about a care-management or Health Home referral.",
  },
  "act-intensive": {
    icon: "users-round",
    illo: {
      src: `${CUT}/pond.avif`,
      alt: "A watercolour illustration — a still pond at dusk, reeds along the bank, calm reflective water.",
    },
    what: "Full treatment teams that come to you — at home or in the community — for the times clinic visits alone aren't enough.",
    who: "Adults and youth with serious, ongoing needs who've found office-based care hard to stick with.",
    how: "ACT and other intensive teams take referrals from hospitals, clinics, and care managers.",
  },
  "kids-families": {
    icon: "users",
    illo: {
      src: `${CUT}/playground.avif`,
      alt: "A watercolour illustration — an empty swing set and slide in a park clearing, golden light through the trees at the end of the day.",
    },
    what: "Services built around young people and the adults raising them — at home, in school, and in the neighborhood.",
    who: "Children and teens, and the parents and caregivers supporting them.",
    how: "Schools, pediatricians, and county offices can all start a referral.",
  },
  "community-peer": {
    icon: "message-circle-heart",
    illo: {
      src: `${CUT}/lemonade.avif`,
      alt: "A watercolour illustration — a little lemonade stand with a striped awning and a welcome sign under summer trees.",
    },
    what: "Support from people who've been there — drop-in centers, clubhouses, advocacy, and everyday connection.",
    who: "Anyone who wants community and lived-experience support alongside, or instead of, clinical care.",
    how: "Most peer programs are walk-in — call ahead or stop by during open hours.",
  },
  "employment-education": {
    icon: "graduation-cap",
    illo: {
      src: `${CUT}/cityscape.avif`,
      alt: "A watercolour illustration — a coffee and a book resting on a railing that looks out over a soft city skyline at morning.",
    },
    what: "Help finding and keeping a job, or getting back into school — with support that continues well after your first day.",
    who: "People whose mental health has made work or school harder to hold onto.",
    how: "Supported-employment and education programs take referrals from clinics, ACT teams, and care managers.",
  },
  inpatient: {
    icon: "shield-plus",
    illo: {
      src: `${CUT}/lakeside.avif`,
      alt: "A watercolour illustration — a person wrapped in a shawl sits on a bench by a still lake at dawn, holding a warm mug.",
    },
    what: "Psychiatric units and hospitals for the times someone needs safe, round-the-clock care.",
    who: "People in acute distress who need more support than home or a clinic can offer right now.",
    how: "Admission usually comes through an emergency room, a doctor, or a crisis team.",
  },
  respite: {
    icon: "leaf",
    illo: {
      src: `${CUT}/coffee.avif`,
      alt: "A watercolour illustration — a quiet nook with two armchairs and a small table by arched windows, set for an unhurried conversation.",
    },
    what: "Planned short stays and breaks — a supported place to reset before things reach a crisis.",
    who: "People, and the families caring for them, who need a short, restorative pause.",
    how: "Respite is arranged ahead of time through crisis lines, care managers, or the program directly.",
  },
};

import { hasDb, sql } from "@/lib/db";
import { isoDateTime } from "@/lib/format";
import { mockStore } from "@/lib/mock";
import "@/lib/mock/provider-profiles";
import { listPractitioners } from "@/lib/repos/services";
import type { AvatarHue, ProviderProfile } from "@/lib/types";

// Provider-profile content repo — the /providers/[slug] rich content model,
// keyed 1:1 to a practitioner's user_id. Directory providers never have one
// of these; the profile page falls back to the sparse directory_providers row.

type ProfileRow = {
  id: string;
  user_id: string;
  role_title: string | null;
  pronouns: string | null;
  years_experience: number | null;
  intro_md: string | null;
  approach_md: string | null;
  expect_md: string | null;
  identify_as: string | null;
  style_is: string | null;
  training: string | null;
  license_type: string | null;
  licensed_in: string[];
  insurance_accepted: string[];
  top_specialties: string[];
  more_specialties: string[];
  therapy_methods: string[];
  care_types: string[];
  ages_served: string[];
  languages: string[];
  location_label: string | null;
  nearby_areas: string[];
  illustration_key: string | null;
  created_at: string | Date;
  updated_at: string | Date;
};

function toProfile(r: ProfileRow): ProviderProfile {
  return {
    id: r.id,
    userId: r.user_id,
    roleTitle: r.role_title,
    pronouns: r.pronouns,
    yearsExperience: r.years_experience,
    introMd: r.intro_md,
    approachMd: r.approach_md,
    expectMd: r.expect_md,
    identifyAs: r.identify_as,
    styleIs: r.style_is,
    training: r.training,
    licenseType: r.license_type,
    licensedIn: r.licensed_in ?? [],
    insuranceAccepted: r.insurance_accepted ?? [],
    topSpecialties: r.top_specialties ?? [],
    moreSpecialties: r.more_specialties ?? [],
    therapyMethods: r.therapy_methods ?? [],
    careTypes: r.care_types ?? [],
    agesServed: r.ages_served ?? [],
    languages: r.languages ?? [],
    locationLabel: r.location_label,
    nearbyAreas: r.nearby_areas ?? [],
    illustrationKey: r.illustration_key,
    createdAt: isoDateTime(r.created_at),
    updatedAt: isoDateTime(r.updated_at),
  };
}

export async function getProfileByUserId(userId: string): Promise<ProviderProfile | null> {
  if (hasDb) {
    const rows = (await sql`SELECT * FROM provider_profiles WHERE user_id = ${userId}`) as ProfileRow[];
    return rows[0] ? toProfile(rows[0]) : null;
  }
  const store = mockStore();
  return [...store.providerProfiles.values()].find((p) => p.userId === userId) ?? null;
}

/** Lean shape for matching a practitioner + their profile against a search query. */
export interface BookableProfile {
  id: string; // users.id — what /providers/[slug]'s booking rail and /book/{id} use
  name: string;
  avatarHue: AvatarHue;
  slug: string | null;
  roleTitle: string | null;
  topSpecialties: string[];
  moreSpecialties: string[];
  languages: string[];
  insuranceAccepted: string[];
  careTypes: string[];
}

type BookableRow = {
  user_id: string;
  name: string;
  avatar_hue: AvatarHue;
  user_slug: string | null;
  role_title: string | null;
  top_specialties: string[];
  more_specialties: string[];
  languages: string[];
  insurance_accepted: string[];
  care_types: string[];
};

function toBookable(r: BookableRow): BookableProfile {
  return {
    id: r.user_id,
    name: r.name,
    avatarHue: r.avatar_hue,
    slug: r.user_slug,
    roleTitle: r.role_title,
    topSpecialties: r.top_specialties ?? [],
    moreSpecialties: r.more_specialties ?? [],
    languages: r.languages ?? [],
    insuranceAccepted: r.insurance_accepted ?? [],
    careTypes: r.care_types ?? [],
  };
}

/** Leuk's bookable practitioners + their authored profiles — for search merging (find-care). Small (a handful of rows); no pagination. */
export async function listBookableProfiles(): Promise<BookableProfile[]> {
  if (hasDb) {
    const rows = (await sql`
      SELECT u.id AS user_id, u.name, u.avatar_hue, u.slug AS user_slug,
        p.role_title, p.top_specialties, p.more_specialties, p.languages, p.insurance_accepted, p.care_types
      FROM users u JOIN provider_profiles p ON p.user_id = u.id
      WHERE u.role IN ('practitioner','admin') AND u.deleted_at IS NULL
      ORDER BY u.name
    `) as BookableRow[];
    return rows.map(toBookable);
  }
  const practitioners = await listPractitioners();
  const store = mockStore();
  const out: BookableProfile[] = [];
  for (const prac of practitioners) {
    const profile = [...store.providerProfiles.values()].find((p) => p.userId === prac.id);
    if (!profile) continue;
    out.push({
      id: prac.id,
      name: prac.name,
      avatarHue: prac.avatarHue,
      slug: prac.slug,
      roleTitle: profile.roleTitle,
      topSpecialties: profile.topSpecialties,
      moreSpecialties: profile.moreSpecialties,
      languages: profile.languages,
      insuranceAccepted: profile.insuranceAccepted,
      careTypes: profile.careTypes,
    });
  }
  return out;
}

// Rating/review-count has no backing field yet — authored here until reviews
// exist (design lead's call). Shared by the homepage spotlight rail and the
// real provider profile header so both show the same numbers.
const SPOTLIGHT_RATING: Record<string, { rating: number; reviewCount: number }> = {
  "priya-raman": { rating: 4.9, reviewCount: 146 },
  "lena-whitfield": { rating: 5.0, reviewCount: 97 },
  "marcus-bell": { rating: 4.8, reviewCount: 64 },
  "shelley-padgett": { rating: 4.9, reviewCount: 211 },
  "jason-hilario": { rating: 4.9, reviewCount: 21 },
};

export function spotlightRatingFor(slug: string | null | undefined): { rating: number; reviewCount: number } | null {
  return slug ? (SPOTLIGHT_RATING[slug] ?? null) : null;
}

// Seeded directory-row rating/tenure lives in lib/directory-rating.ts (same
// placeholder convention as SPOTLIGHT_RATING, but client-safe — the find-care
// result card imports it, and repos pull in lib/db).

/** Nearest date (within 2 weeks) matching one of a practitioner's available weekdays. */
export function nextAvailableLabel(weekdays: number[]): string {
  if (weekdays.length === 0) return "soon";
  const today = new Date();
  for (let i = 0; i < 14; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    if (weekdays.includes(d.getDay())) {
      return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
    }
  }
  return "soon";
}

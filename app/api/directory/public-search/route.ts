import { NextResponse, type NextRequest } from "next/server";
import { searchPrograms, searchProviders } from "@/lib/repos/directory";
import {
  listBookableProfiles,
  nextAvailableLabel,
  spotlightRatingFor,
  type BookableProfile,
} from "@/lib/repos/provider-profiles";
import { listAvailability } from "@/lib/repos/services";

export const dynamic = "force-dynamic";

// Public, anon-allowed directory search for the marketing front door — the
// "search → provider → booking" spine. Two very different sources merge into
// one result list:
//   - Liminal's own bookable practitioners (users + provider_profiles) — only
//     a handful of rows, matched in-memory, always shown first on page 1 only
//     (never repeated on page 2+) with `bookable: true` and a real `slug`.
//   - The NY directory (directory_providers, ~116k rows) — paginated for real
//     via searchProviders' Page<T>, ranked by trigram similarity when there's
//     a free-text query.
// Programs (directory_programs) are a small, first-page-only list underneath,
// linking to their /programs/[id] page.

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 50;
const PROGRAM_CAP = 6;

// Insurance payers Liminal's own practitioners actually carry (Task 1 content) +
// "Medicaid", which is true of every directory row by construction (source is
// CHECK-constrained to 'medicaid') rather than a real per-row fact we have.
const MEDICAID = "Medicaid";

export type PublicResult = {
  id: string;
  kind: "provider" | "program";
  name: string;
  subtitle: string | null; // profession or program type
  agency: string | null;
  county: string | null;
  phone: string | null;
  address: string | null;
  // provider enrichment (null for programs)
  subspecialty?: string | null;
  credential?: string | null;
  gender?: string | null;
  city?: string | null;
  zip?: string | null;
  // profile linking (additive — nav.tsx's search dropdown ignores these)
  slug?: string | null;
  bookable?: boolean;
  // spotlight-card enrichment, bookable practitioners only (server-computed
  // so the card stays dumb): placeholder rating + next real availability.
  rating?: number;
  reviewCount?: number;
  availableLabel?: string;
};

function matchesQuery(p: BookableProfile, q: string): boolean {
  const haystack = [p.name, p.roleTitle, ...p.topSpecialties, ...p.moreSpecialties, ...p.languages]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return haystack.includes(q.toLowerCase());
}

function matchesType(p: BookableProfile, type: string): boolean {
  if (type === "therapist") return p.roleTitle === "Therapist";
  if (type === "psychiatrist" || type === "prescriber") return p.roleTitle === "Psychiatrist";
  return true;
}

// `need` is an exact profession string (e.g. "Psychiatrist", "Psychiatric
// Nurse Practitioner") from the directory-page browse links — Liminal's own
// roster only ever carries "Therapist" or "Psychiatrist" as a roleTitle, so a
// need for a profession Liminal doesn't staff (e.g. the NP page) correctly
// yields zero Liminal matches rather than showing everyone.
function matchesNeed(p: BookableProfile, need: string): boolean {
  return (p.roleTitle ?? "").toLowerCase() === need.toLowerCase();
}

function matchesSpecialty(p: BookableProfile, specialty: string): boolean {
  const needle = specialty.toLowerCase();
  return [...p.topSpecialties, ...p.moreSpecialties].some((s) => s.toLowerCase().includes(needle));
}

function matchesInsurance(p: BookableProfile, insurance: string): boolean {
  return p.insuranceAccepted.some((i) => i.toLowerCase() === insurance.toLowerCase());
}

async function toPublicResult(p: BookableProfile): Promise<PublicResult> {
  const rating = spotlightRatingFor(p.slug);
  const weekdays = (await listAvailability(p.id)).map((a) => a.weekday);
  return {
    id: p.id,
    kind: "provider",
    name: p.name,
    subtitle: p.roleTitle,
    agency: null,
    county: null,
    phone: null,
    address: null,
    subspecialty: p.topSpecialties[0] ?? null,
    slug: p.slug,
    bookable: true,
    rating: rating?.rating,
    reviewCount: rating?.reviewCount,
    availableLabel: nextAvailableLabel(weekdays),
  };
}

export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const q = p.get("q") ?? undefined;
  const zip = p.get("zip") ?? undefined; // preferred locality filter
  const city = p.get("city") ?? undefined;
  const county = p.get("county") ?? undefined;
  const need = p.get("need") ?? undefined; // profession (providers) / type (programs)
  const specialty = p.get("specialty") ?? undefined; // subspecialty (providers) + Liminal topic tags
  const gender = p.get("gender") ?? undefined;
  const type = p.get("type") ?? undefined; // therapist | psychiatrist | prescriber
  const insurance = p.get("insurance") ?? undefined;
  const kind = p.get("kind") ?? "all"; // all | providers | programs
  const page = Math.max(1, Number(p.get("page")) || 1);
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, Number(p.get("pageSize")) || DEFAULT_PAGE_SIZE));

  const results: PublicResult[] = [];

  // Liminal's own practitioners — page 1 only, never repeated on later pages.
  if (kind !== "programs" && page === 1) {
    const bookable = await listBookableProfiles();
    const matched = bookable.filter((prac) => {
      if (q && !matchesQuery(prac, q)) return false;
      if (type && !matchesType(prac, type)) return false;
      if (need && !matchesNeed(prac, need)) return false;
      if (specialty && !matchesSpecialty(prac, specialty)) return false;
      if (insurance && !matchesInsurance(prac, insurance)) return false;
      return true;
    });
    results.push(...(await Promise.all(matched.map(toPublicResult))));
  }

  let directoryTotal = 0;
  if (kind !== "programs") {
    // Selecting a specific non-Medicaid payer has no honest answer for the NY
    // directory (it carries no insurance data at all — every row is Medicaid-
    // enrolled by construction) — exclude directory rows rather than guess.
    if (!insurance || insurance === MEDICAID) {
      const providers = await searchProviders({
        q, zip, city, county, profession: need, subspecialty: specialty, gender, providerType: type, page, pageSize,
      });
      directoryTotal = providers.total;
      for (const r of providers.items) {
        results.push({
          id: r.id,
          kind: "provider",
          name: r.name,
          subtitle: r.profession,
          agency: null,
          county: r.county,
          phone: r.phone,
          address: r.address,
          subspecialty: r.subspecialty ?? null,
          credential: r.credential ?? null,
          gender: r.gender ?? null,
          city: r.city,
          zip: r.zip,
          slug: r.slug,
          bookable: false,
        });
      }
    }
  }

  if (kind !== "providers" && page === 1 && (!insurance || insurance === MEDICAID)) {
    const programs = await searchPrograms({ q, county, type: need, page: 1, pageSize: PROGRAM_CAP });
    for (const r of programs.items) {
      results.push({
        id: r.id,
        kind: "program",
        name: r.programName,
        subtitle: r.programType,
        agency: r.agency,
        county: r.county,
        phone: r.phone,
        address: r.address,
      });
    }
  }

  return NextResponse.json({ results, total: directoryTotal, page, pageSize });
}

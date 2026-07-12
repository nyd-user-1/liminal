import { NextResponse, type NextRequest } from "next/server";
import { searchPrograms, searchProviders } from "@/lib/repos/directory";
import { listPayerFacets, networkSummariesByNpi } from "@/lib/repos/networks";
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
//   - Leuk's own bookable practitioners (users + provider_profiles) — only
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

// Insurance payers Leuk's own practitioners actually carry (Task 1 content) +
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
  // Insurance-network signal (payer-networks data). Set true only when we hold a
  // network row for this NPI AND it's accepting new patients; omitted otherwise —
  // absence is NOT "not accepting". See lib/repos/networks.ts.
  acceptingNewPatients?: boolean;
  // Distinct payers we hold full-quality network rows for (card: "Accepts N
  // insurance carriers"); omitted when we hold none — absence is never "zero".
  payerCount?: number;
  // Up to a handful of specialty strings (bookable: topSpecialties; directory:
  // the single subspecialty). Card renders the first two.
  specialties?: string[];
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
// Nurse Practitioner") from the directory-page browse links — Leuk's own
// roster only ever carries "Therapist" or "Psychiatrist" as a roleTitle, so a
// need for a profession Leuk doesn't staff (e.g. the NP page) correctly
// yields zero Leuk matches rather than showing everyone.
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
    payerCount: p.insuranceAccepted.length || undefined,
    specialties: p.topSpecialties.slice(0, 5),
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
  const specialty = p.get("specialty") ?? undefined; // subspecialty (providers) + Leuk topic tags
  const gender = p.get("gender") ?? undefined;
  const type = p.get("type") ?? undefined; // therapist | psychiatrist | prescriber
  const insurance = p.get("insurance") ?? undefined;
  const kind = p.get("kind") ?? "all"; // all | providers | programs
  // Payers we hold FULL-quality network data for (Cigna, Humana today; grows as
  // harvests land). An `insurance` value matching one of these slugs filters the
  // NY directory for real; "Medicaid" stays the by-construction pass-through;
  // anything else (legacy display-name values) still matches Leuk's own
  // practitioners only — the directory holds no data for it, so it's excluded
  // rather than guessed.
  const payerFacets = await listPayerFacets();
  const coveredPayer = insurance ? payerFacets.find((f) => f.slug === insurance) : undefined;
  // The provider page's A–Z rail wants the raw directory ordering, so it opts
  // out of the Leuk-practitioners-first merge that /providers relies on.
  const bookableFirst = p.get("bookableFirst") !== "0";
  const page = Math.max(1, Number(p.get("page")) || 1);
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, Number(p.get("pageSize")) || DEFAULT_PAGE_SIZE));

  const results: PublicResult[] = [];

  // Leuk's own practitioners are matched on every page so `total` stays
  // honest, but only *rendered* on page 1 — never repeated on later pages.
  let bookableTotal = 0;
  if (kind !== "programs" && bookableFirst) {
    const bookable = await listBookableProfiles();
    const matched = bookable.filter((prac) => {
      if (q && !matchesQuery(prac, q)) return false;
      if (type && !matchesType(prac, type)) return false;
      if (need && !matchesNeed(prac, need)) return false;
      if (specialty && !matchesSpecialty(prac, specialty)) return false;
      // Covered payers arrive as slugs ("cigna") — match profiles on the payer's
      // display name; legacy values are display names already.
      if (insurance && !matchesInsurance(prac, coveredPayer?.name ?? insurance)) return false;
      return true;
    });
    bookableTotal = matched.length;
    if (page === 1) results.push(...(await Promise.all(matched.map(toPublicResult))));
  }

  let directoryTotal = 0;
  if (kind !== "programs") {
    // Directory rows answer an insurance filter honestly in exactly two cases:
    // a payer we've ingested (filter by real participation rows), or Medicaid
    // (true of every row by construction). Any other payer value excludes the
    // directory rather than guessing.
    if (!insurance || insurance === MEDICAID || coveredPayer) {
      const providers = await searchProviders({
        q, zip, city, county, profession: need, subspecialty: specialty, gender, providerType: type, page, pageSize,
        insurancePayer: coveredPayer?.slug,
      });
      directoryTotal = providers.total;
      // One batched insurance lookup for the whole page — never per card. NPIs
      // with no network data are simply absent from the map (no flag rendered).
      // With a payer filter active the summary is restricted to THAT payer —
      // the accepting flag is a per-source claim, never cross-payer.
      const summaries = await networkSummariesByNpi(
        providers.items.map((r) => r.npi),
        { payerSlug: coveredPayer?.slug },
      );
      // Carrier COUNTS are cross-payer by definition — a second, unscoped batch
      // when a payer filter narrowed the first one (they're the same map otherwise).
      const allSummaries = coveredPayer
        ? await networkSummariesByNpi(providers.items.map((r) => r.npi))
        : summaries;
      for (const r of providers.items) {
        const accepting = r.npi ? summaries.get(r.npi)?.accepting === true : false;
        const payerCount = r.npi ? allSummaries.get(r.npi)?.payers.length : undefined;
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
          acceptingNewPatients: accepting || undefined,
          payerCount: payerCount || undefined,
          specialties: r.subspecialty ? [r.subspecialty] : undefined,
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

  // `total` counts providers only (programs are a capped page-1 garnish, never
  // paginated), so it's what "N providers found" and the infinite scroller's
  // has-more check both read.
  const total = directoryTotal + bookableTotal;
  // Source attribution for a payer-filtered search — drives the results header
  // ("listed in Cigna's directory · 97% accepting · per Cigna, updated …").
  const insuranceMeta = coveredPayer
    ? { payerName: coveredPayer.name, acceptingPct: coveredPayer.acceptingPct, asOf: coveredPayer.asOf }
    : undefined;
  return NextResponse.json({ results, total, page, pageSize, hasMore: page * pageSize < directoryTotal, insuranceMeta });
}

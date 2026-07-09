import { registerFixtures } from "@/lib/mock";
import { slugify } from "@/lib/slug";
import type { DirectoryProgram, DirectoryProvider } from "@/lib/types";

// Directory fixtures — the zero-env demo slice of the NY open-data directory
// (real data lands in Neon via scripts/ingest-directory.mjs). ~15 providers +
// ~10 programs across the five NYC counties, enough to exercise search/filter.

const T = "2026-05-01T00:00:00.000Z";
const PROV = (nn: string) => `00000000-0000-4000-8000-0000004010${nn}`;
const PROG = (nn: string) => `00000000-0000-4000-8000-0000004020${nn}`;

function prov(
  nn: string,
  name: string,
  profession: string,
  address: string,
  city: string,
  county: string,
  zip: string,
  npi: string | null,
): DirectoryProvider {
  return {
    id: PROV(nn),
    npi,
    name,
    slug: slugify(name),
    profession,
    licenseNo: null,
    taxonomy: null,
    address,
    city,
    county,
    zip,
    phone: null,
    source: "medicaid",
    sourceId: npi ?? `mmis-${nn}`,
    updatedAt: T,
  };
}

const providers: DirectoryProvider[] = [
  prov("01", "GRIES LEONARD T", "CLINICAL PSYCHOLOGIST", "80-45 Winchester Blvd", "Briarwood", "Queens", "11427", "1093718234"),
  prov("02", "ZYSMAN SIMON ASHER", "CLINICAL PSYCHOLOGIST", "2432 Grand Concourse", "Bronx", "Bronx", "10458", "1043298171"),
  prov("03", "OKONKWO ADAEZE N", "CLINICAL SOCIAL WORKER", "115 W 30th St Ste 900", "New York", "New York", "10001", "1720394857"),
  prov("04", "RAMIREZ LUISA M", "MENTAL HEALTH COUNSELORS", "560 Fulton St", "Brooklyn", "Kings", "11201", "1588210394"),
  prov("05", "CHEN WEI", "CLINICAL PSYCHOLOGIST", "136-20 38th Ave", "Flushing", "Queens", "11354", "1467720135"),
  prov("06", "GOLDBERG RACHEL S", "CLINICAL SOCIAL WORKER", "26 Court St Ste 1710", "Brooklyn", "Kings", "11242", "1902847561"),
  prov("07", "PATEL NIRAV", "MARRIAGE & FAMILY THERAPIST", "200 W 57th St", "New York", "New York", "10019", "1356729048"),
  prov("08", "WILLIAMS TANYA R", "MENTAL HEALTH COUNSELORS", "1200 Waters Pl", "Bronx", "Bronx", "10461", "1673829104"),
  prov("09", "NGUYEN THAO", "CLINICAL SOCIAL WORKER", "1 Edgewater Plaza", "Staten Island", "Richmond", "10305", "1782930485"),
  prov("10", "ABRAMSON DAVID L", "CLINICAL PSYCHOLOGIST", "16 E 79th St", "New York", "New York", "10075", "1049582017"),
  prov("11", "SANTOS MARIA E", "MENTAL HEALTH COUNSELORS", "90-04 161st St", "Jamaica", "Queens", "11432", "1938475610"),
  prov("12", "FRIEDMAN JOSHUA", "CLINICAL SOCIAL WORKER", "475 Atlantic Ave", "Brooklyn", "Kings", "11217", "1120394857"),
  prov("13", "OKAFOR CHIDI", "MARRIAGE & FAMILY THERAPIST", "1000 Hylan Blvd", "Staten Island", "Richmond", "10305", "1657483920"),
  prov("14", "REYES CARLOS", "CLINICAL PSYCHOLOGIST", "3320 Bainbridge Ave", "Bronx", "Bronx", "10467", "1029384756"),
  prov("15", "KIM SOO-JIN", "CLINICAL SOCIAL WORKER", "35-20 Broadway", "Astoria", "Queens", "11106", "1546372819"),
];

function prog(
  nn: string,
  agency: string,
  facility: string,
  programName: string,
  programType: string,
  populations: string,
  address: string,
  city: string,
  county: string,
  zip: string,
  phone: string,
): DirectoryProgram {
  return {
    id: PROG(nn),
    agency,
    facility,
    programName,
    programType,
    populations,
    address,
    city,
    county,
    zip,
    phone,
    source: "omh",
    sourceId: `mock-prog-${nn}`,
    updatedAt: T,
  };
}

const programs: DirectoryProgram[] = [
  prog("01", "Institute for Community Living", "ICL Manhattan", "Adult Outpatient Clinic", "Outpatient", "Adults", "125 Broad St", "New York", "New York", "10004", "(212) 385-3030"),
  prog("02", "The Jewish Board", "JBFCS Brooklyn", "Children's Mental Health Clinic", "Clinic Treatment", "Children & Families", "1273 53rd St", "Brooklyn", "Kings", "11219", "(718) 851-6300"),
  prog("03", "Montefiore", "Montefiore Behavioral Health", "Assertive Community Treatment", "ACT", "Adults with SMI", "3444 Kossuth Ave", "Bronx", "Bronx", "10467", "(718) 920-4000"),
  prog("04", "Community Healthcare Network", "CHN Queens", "Integrated Outpatient Services", "Outpatient", "Adults", "90-11 160th St", "Jamaica", "Queens", "11432", "(718) 523-2123"),
  prog("05", "Richmond University Medical Center", "RUMC Behavioral Health", "Crisis Respite Program", "Crisis", "Adults", "355 Bard Ave", "Staten Island", "Richmond", "10310", "(718) 818-1234"),
  prog("06", "Fountain House", "Fountain House Clubhouse", "Psychosocial Clubhouse", "Rehabilitation", "Adults with SMI", "425 W 47th St", "New York", "New York", "10036", "(212) 582-0340"),
  prog("07", "CAMBA", "CAMBA Brooklyn", "Supported Housing", "Residential", "Adults", "1720 Church Ave", "Brooklyn", "Kings", "11226", "(718) 287-2600"),
  prog("08", "Coordinated Behavioral Care", "CBC Bronx", "Care Coordination", "Health Home", "Adults", "1400 Pelham Pkwy S", "Bronx", "Bronx", "10461", "(718) 430-3000"),
  prog("09", "Child Center of NY", "CCNY Queens", "School-Based Mental Health", "Outpatient", "Children & Adolescents", "60-02 Roosevelt Ave", "Woodside", "Queens", "11377", "(718) 651-7770"),
  prog("10", "NAMI-NYC", "NAMI Metro", "Peer Support & Education", "Support Services", "Families", "505 Eighth Ave", "New York", "New York", "10018", "(212) 684-3264"),
];

registerFixtures("directory", (store) => {
  // Self-heal: the mock store singleton persists on globalThis across dev HMR,
  // so a store created before these maps were added would lack them. Lazily
  // initialize (no-op on a fresh createStore, which already has them).
  store.directoryProviders ??= new Map();
  store.directoryPrograms ??= new Map();
  store.referrals ??= new Map();
  store.providerApplications ??= new Map();
  for (const p of providers) store.directoryProviders.set(p.id, p);
  for (const p of programs) store.directoryPrograms.set(p.id, p);
});

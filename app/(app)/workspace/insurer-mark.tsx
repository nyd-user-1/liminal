"use client";

// The one place an insurer's mark is decided. Both the Insurers card wall and
// the network-mapping tables render from this map, so a logo added here shows up
// on every surface at once and the two can never disagree about who has one.
//
// Marks come from the same public blob store the marketing strip uses
// (components/site/insurer-strip.tsx). Keyed by OUR insurers.id, never by the
// display name: `anthem-empire` is the Anthem card, `healthfirst` (NY) is not
// `health-first-fl` (Rockledge, Florida), and Oxford is its own brand under UHG
// rather than a UnitedHealthcare mark. An insurer with no mark gets initials — a
// near-miss logo is worse than an honest monogram.
//
// `h` is per-mark OPTICAL sizing, mirroring the strip: most assets carry baked-in
// whitespace and sit right at the shared height, but a few are cropped tight to
// the glyph and read oversized unless scaled down.

const LOGO_BASE = "https://c1vijjkvyt1skkfe.public.blob.vercel-storage.com/logos/insurance";

export const INSURER_LOGOS: Record<string, { file: string; h?: string; hSm?: string }> = {
  uhc: { file: "united.avif" },
  aetna: { file: "aetna.avif" },
  "anthem-empire": { file: "anthem.avif" },
  cigna: { file: "cigna.avif" },
  carelon: { file: "carelon.avif" },
  // A two-line lockup: at the shared height it reads heavier than the single
  // wordmarks beside it, so it comes down a step.
  oscar: { file: "optum-oscar.avif", h: "h-7", hSm: "h-5" },
  cdphp: { file: "cdphp.png", h: "h-5", hSm: "h-4" },
  humana: { file: "humana.avif", h: "h-4", hSm: "h-3" },
  // The strip's pure ratio puts this at ~13px, but its second line is fine-print
  // tagline — height without visual weight — so it reads light there. 16px.
  healthfirst: { file: "healthfirst.svg", h: "h-4", hSm: "h-3" },
};

/** Up to two letters from the name — the fallback for insurers we hold no logo
 *  for. */
export function monogram(name: string): string {
  const words = name.replace(/[^A-Za-z0-9 ]/g, " ").split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

/** A mark or its initials, in a fixed box so a row with a logo and a row without
 *  line up and neither shifts when the image arrives. */
export function InsurerMark({
  id,
  name,
  size = "md",
}: {
  /** insurers.id. Null or unknown → initials. */
  id: string | null;
  name: string;
  /** md = the card wall, sm = a table cell. */
  size?: "md" | "sm";
}) {
  const logo = id ? INSURER_LOGOS[id] : undefined;
  const sm = size === "sm";
  const box = sm ? "h-6 w-[48px]" : "h-9 w-[72px]";
  const initials = sm ? "h-6 w-6 text-[10px]" : "h-9 w-9 text-[13px]";
  const height = logo ? (sm ? (logo.hSm ?? "h-5") : (logo.h ?? "h-8")) : "";

  return (
    <span className={`flex ${box} shrink-0 items-center justify-start`}>
      {logo ? (
        <img src={`${LOGO_BASE}/${logo.file}`} alt="" className={`${height} w-auto max-w-full object-contain`} />
      ) : (
        <span
          className={`flex ${initials} items-center justify-center rounded-field bg-primary-wash font-semibold text-primary-deep`}
        >
          {monogram(name)}
        </span>
      )}
    </span>
  );
}

import { Icon } from "@/components/ui/icons";

// Insurer marks for rate tables — same blob assets the marketing InsurerStrip
// uses (logos/insurance/*). Only unambiguous brand matches get a mark; every
// other reporting entity falls back to the two-tone id-card icon (matching
// the insurance Select's placeholder treatment).

const LOGO_BASE = "https://c1vijjkvyt1skkfe.public.blob.vercel-storage.com/logos/insurance";

const MARKS: Array<[RegExp, string]> = [
  [/cigna/i, `${LOGO_BASE}/cigna.avif`],
  // Oxford is a UHC-owned payer entity with no independent public mark — the
  // parent brand is the correct mark for the payer column. (Optum belongs in
  // the Network column as text, not as the payer's logo.)
  [/unitedhealthcare|united healthcare|\buhc\b|oxford/i, `${LOGO_BASE}/united.avif`],
  [/aetna/i, `${LOGO_BASE}/aetna.avif`],
  [/anthem|empire/i, `${LOGO_BASE}/anthem.avif`],
  [/humana/i, `${LOGO_BASE}/humana.avif`],
  [/healthfirst/i, `${LOGO_BASE}/healthfirst.svg`],
  [/cdphp/i, `${LOGO_BASE}/cdphp.png`],
  [/emblemhealth/i, `${LOGO_BASE}/emblemhealth.png`],
  [/fidelis/i, `${LOGO_BASE}/fidelis.png`],
  [/metroplus/i, `${LOGO_BASE}/metroplus.png`],
  // Highmark's Western NY entity gets its own lockup (the mark says "Western
  // New York" — wrong for its Northeastern NY sibling); every other Blue
  // Cross/Blue Shield state affiliate (Highmark NENY, Excellus, CareFirst,
  // Regence, Florida Blue, BCBS-of-<state> ...) falls through to the generic
  // shield mark. Must stay ordered after Anthem/Empire above.
  [/highmark.*western new york/i, `${LOGO_BASE}/highmark-wny.png`],
  [/blue cross|blue shield|bluecross|blueshield/i, `${LOGO_BASE}/bcbs.avif`],
];

function markFor(payer: string): string | null {
  for (const [re, url] of MARKS) if (re.test(payer)) return url;
  return null;
}

/** The brand mark URL for a payer, or null when there's no unambiguous match —
 *  for callers that need the asset rather than the rendered cell (e.g. the
 *  insurer Select's per-option `image`). Same map as InsurerMark, one source. */
export function insurerLogo(payer: string): string | undefined {
  return markFor(payer) ?? undefined;
}

/** Table-row insurer cell lead: brand mark (contained, never cropped) or icon. */
export function InsurerMark({ payer }: { payer: string }) {
  const url = markFor(payer);
  return url ? (
    <img src={url} alt="" aria-hidden className="h-5 w-9 shrink-0 object-contain" loading="lazy" />
  ) : (
    <Icon name="id-card" size={18} className="shrink-0 fill-primary-wash text-text-muted" />
  );
}

/** Insurer name with its mark; optional muted subline (plan networks). */
export function InsurerCell({ payer, subline }: { payer: string; subline?: string }) {
  return (
    <span className="flex min-w-0 items-center gap-2.5">
      <InsurerMark payer={payer} />
      <span className="min-w-0">
        <span className="block max-w-64 truncate font-medium text-text" title={payer}>
          {payer}
        </span>
        {subline && (
          <span className="block max-w-64 truncate text-[13px] text-text-muted" title={subline}>
            {subline}
          </span>
        )}
      </span>
    </span>
  );
}

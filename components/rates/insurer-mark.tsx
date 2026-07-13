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
];

function markFor(payer: string): string | null {
  for (const [re, url] of MARKS) if (re.test(payer)) return url;
  return null;
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
        <span className="block font-medium text-text">{payer}</span>
        {subline && (
          <span className="block max-w-[26rem] truncate text-[13px] text-text-muted" title={subline}>
            {subline}
          </span>
        )}
      </span>
    </span>
  );
}

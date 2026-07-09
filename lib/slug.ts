// Shared slug generation — persisted, SEO-friendly, never the NPI. Base is a
// plain kebab-case name; collisions append a non-NPI discriminator (city,
// then a short base36 counter) per the provider-profile spec.

export function slugify(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // strip combining diacritics after NFKD split
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Builds a unique slug for `name`, consulting `isTaken` (sync — callers with
 * a large existing-slug set should preload it into a Set/closure rather than
 * querying per call). Collision order: bare name → name-city → name-<base36>.
 */
export function uniqueSlug(name: string, city: string | null | undefined, isTaken: (slug: string) => boolean): string {
  const base = slugify(name);
  if (!isTaken(base)) return base;

  if (city) {
    const withCity = `${base}-${slugify(city)}`;
    if (!isTaken(withCity)) return withCity;
  }

  for (let n = 2; n < 46656; n++) {
    const candidate = `${base}-${n.toString(36)}`;
    if (!isTaken(candidate)) return candidate;
  }
  throw new Error(`Could not generate a unique slug for "${name}"`);
}

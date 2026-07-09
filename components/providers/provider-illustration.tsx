import { Avatar } from "@/components/ui/avatar";
import type { AvatarHue } from "@/lib/types";

// Header illustration — watercolor scene standing in for a headshot (per the
// provider-profile spec: illustrations, not photos; never a landscape forced
// into reading as a face). Named practitioners carry an explicit
// illustration_key (authored alongside their profile).
//
// Everyone else — the ~116k NPI directory rows, and the homepage spotlight
// cards — gets a painted silhouette bust instead of a scene. A scene of *some
// woman in an armchair* implies we know what this provider looks like; a
// silhouette reads as "no photo on file", which is the truth. Gender picks the
// silhouette where NPPES records it; where it doesn't, the id hashes to one
// deterministically (same row → same bust, every load). If nothing resolves we
// fall back to the tinted-initials Avatar.

const BASE = "https://c1vijjkvyt1skkfe.public.blob.vercel-storage.com/illustrations";

// Deployed blob filenames — the woman's is misspelled at the source.
const SILHOUETTES = {
  man: "man_silhouette",
  woman: "woman-silouhette",
} as const;

function urlFor(key: string): string {
  return `${BASE}/${key}.avif`;
}

/** Deterministic (same id → same image, every load) — no Date/Math.random. */
function idHash(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h;
}

/**
 * Placeholder bust for a provider with no authored illustration. NPPES gender
 * is "M"/"F" when present; anything else (absent, "X", a full word) hashes.
 */
export function silhouetteUrl(seed: string, gender?: string | null): string {
  const g = gender?.trim().toLowerCase();
  if (g === "m" || g === "male") return urlFor(SILHOUETTES.man);
  if (g === "f" || g === "female") return urlFor(SILHOUETTES.woman);
  return urlFor(idHash(seed) % 2 === 0 ? SILHOUETTES.man : SILHOUETTES.woman);
}

export function ProviderIllustration({
  name,
  avatarHue,
  illustrationKey,
  directoryId,
  gender,
  photoUrl,
  className = "",
}: {
  name: string;
  avatarHue?: AvatarHue;
  /** Explicit key for named/authored practitioners. */
  illustrationKey?: string | null;
  /** Directory providers with no explicit key get a seeded silhouette. */
  directoryId?: string;
  /** NPPES gender, when recorded — picks which silhouette. */
  gender?: string | null;
  /**
   * Full asset URL, takes priority over illustrationKey/directoryId. Used by
   * the homepage spotlight cards, whose art is resolved by the caller.
   */
  photoUrl?: string | null;
  className?: string;
}) {
  const src =
    photoUrl ?? (illustrationKey ? urlFor(illustrationKey) : directoryId ? silhouetteUrl(directoryId, gender) : null);

  if (!src) {
    return (
      <div className={`flex items-center justify-center rounded-card bg-primary-wash ${className}`}>
        <Avatar name={name} hue={avatarHue} size="lg" />
      </div>
    );
  }

  return (
    <img
      src={src}
      alt=""
      className={`block rounded-card object-cover ${className}`}
      loading="eager"
    />
  );
}

import { Avatar } from "@/components/ui/avatar";
import type { AvatarHue } from "@/lib/types";

// Header illustration — watercolor scene standing in for a headshot (per the
// provider-profile spec: illustrations, not photos; never a landscape forced
// into reading as a face). Named practitioners carry an explicit
// illustration_key (authored alongside their profile). Directory providers
// have no such key, so they're mapped deterministically by id into this same
// curated, hand-reviewed pool — every entry here was visually confirmed to be
// a single figure, not a landscape or a group scene. If a key doesn't resolve
// (unset, or the curated pool is empty), we fall back to the tinted-initials
// Avatar rather than guessing.

const BASE = "https://c1vijjkvyt1skkfe.public.blob.vercel-storage.com/illustrations";

// Every entry hand-reviewed: single figure, reads as a person, not a group or
// bare landscape. Filenames are the real deployed blob assets.
const PORTRAIT_POOL = [
  "liminal_5ziunj5ziunj5ziu", // woman on a video call, armchair
  "maya-1", // woman resting in tall grass
  "maya-2", // woman watering a plant by a window, cat asleep
  "liminal_e0mhvxe0mhvxe0mh", // woman on a bench by water, autumn
  "liminal_e0mhvxe0mhvxe0mh-mint", // same scene, cooler recolor
  "liminal_7h6ra17h6ra17h6r", // woman on a video call, glasses, silver hair
] as const;

function urlFor(key: string): string {
  return `${BASE}/${key}.avif`;
}

/** Deterministic (same id → same image, every load) — no Date/Math.random. */
function hashToPoolIndex(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h % PORTRAIT_POOL.length;
}

export function ProviderIllustration({
  name,
  avatarHue,
  illustrationKey,
  directoryId,
  photoUrl,
  className = "",
}: {
  name: string;
  avatarHue?: AvatarHue;
  /** Explicit key for named/authored practitioners. */
  illustrationKey?: string | null;
  /** Directory providers with no explicit key hash into the curated pool by id. */
  directoryId?: string;
  /**
   * Full asset URL, takes priority over illustrationKey/directoryId. Used by
   * the homepage spotlight cards' random placeholder pool, which lives
   * outside the `illustrations/` prefix `urlFor` assumes — so it's resolved
   * by the caller and passed straight through.
   */
  photoUrl?: string | null;
  className?: string;
}) {
  const src =
    photoUrl ?? (illustrationKey ? urlFor(illustrationKey) : directoryId ? urlFor(PORTRAIT_POOL[hashToPoolIndex(directoryId)]) : null);

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

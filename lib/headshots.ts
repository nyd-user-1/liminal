// Real headshots for the handful of practitioners we actually have a photo
// of (everyone else gets the illustrated silhouette/initials — see
// components/providers/provider-illustration.tsx). Keyed by users.id.
const REAL_HEADSHOTS: Record<string, string> = {
  "00000000-0000-4000-8000-000000001006": "/avatars/shelley-padgett.jpg", // Dr. Shelley Padgett
  "00000000-0000-4000-8000-000000001007": "/avatars/jason-hilario.jpg", // Jason Hilario
};

export function headshotFor(userId: string | null | undefined): string | null {
  if (!userId) return null;
  return REAL_HEADSHOTS[userId] ?? null;
}

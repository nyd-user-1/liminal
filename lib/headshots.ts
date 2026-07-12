// Real headshots for the handful of practitioners we actually have a photo
// of (everyone else gets the illustrated silhouette/initials — see
// components/providers/provider-illustration.tsx). Keyed by users.id.
// Served from the PUBLIC blob store (avatars/ prefix) rather than /public, to
// keep binary assets out of the repo.
const AVATARS = "https://c1vijjkvyt1skkfe.public.blob.vercel-storage.com/avatars";
const REAL_HEADSHOTS: Record<string, string> = {
  "00000000-0000-4000-8000-000000001002": `${AVATARS}/priya-raman.jpg`, // Priya Raman
  "00000000-0000-4000-8000-000000001004": `${AVATARS}/lena-whitfield.jpg`, // Lena Whitfield
  "00000000-0000-4000-8000-000000001005": `${AVATARS}/marcus-bell.jpg`, // Marcus Bell
  "00000000-0000-4000-8000-000000001006": `${AVATARS}/shelley-padgett.jpg`, // Dr. Shelley Padgett
  "00000000-0000-4000-8000-000000001007": `${AVATARS}/jason-hilario.jpg`, // Jason Hilario
};

export function headshotFor(userId: string | null | undefined): string | null {
  if (!userId) return null;
  return REAL_HEADSHOTS[userId] ?? null;
}

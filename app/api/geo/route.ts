import { NextResponse } from "next/server";
import { headers } from "next/headers";

export const dynamic = "force-dynamic";

// Best-effort IP geolocation — no third-party service or API key. Vercel's
// edge network stamps every request to production/preview deployments with
// x-vercel-ip-* headers (city/region/country) resolved from the client IP.
// Locally (`next dev`) there's no edge in front of the request, so these are
// absent — callers must treat a null city as "we don't know," not an error.
export async function GET() {
  const h = await headers();
  const rawCity = h.get("x-vercel-ip-city");
  const region = h.get("x-vercel-ip-country-region"); // e.g. "NY"
  const country = h.get("x-vercel-ip-country"); // e.g. "US"

  return NextResponse.json({
    city: rawCity ? decodeURIComponent(rawCity) : null,
    region,
    country,
  });
}

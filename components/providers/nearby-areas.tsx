import { Card } from "@/components/ui/card";

// Plain two-column list (not pill tags) — column-major fill, matching the
// Headway reference: left column reads top-to-bottom before the right column
// starts.

export function NearbyAreas({ areas }: { areas?: string[] }) {
  if (!areas || areas.length === 0) return null;
  return (
    <Card>
      <h2 className="mb-4 text-[19px] font-semibold text-text">Nearby areas</h2>
      <div className="columns-2 gap-x-8">
        {areas.map((a) => (
          <p key={a} className="mb-4 break-inside-avoid text-[15px] text-text">
            {a}
          </p>
        ))}
      </div>
    </Card>
  );
}

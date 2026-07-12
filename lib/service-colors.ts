// Service color slots — the DB stores a named categorical slot
// (services.color: 'teal' | 'blue' | …); the calendar/EventChips render the
// mapped hex from the Leuk categorical palette (EVENT_COLORS order).
// Pure constants: safe to import from server and client components.
// NOTE (integration): new scheduling-owned module, flagged in the build report.

export const SERVICE_COLOR_SLOTS = [
  { name: "teal", hex: "#3F8290" },
  { name: "green", hex: "#3BA55C" },
  { name: "pink", hex: "#E0447C" },
  { name: "olive", hex: "#8A8F3C" },
  { name: "blue", hex: "#3B6FD4" },
  { name: "purple", hex: "#7C86E8" },
  { name: "amber", hex: "#E07B3C" },
] as const;

export type ServiceColorName = (typeof SERVICE_COLOR_SLOTS)[number]["name"];

/** Named slot → hex (unknown names fall back to teal). */
export function serviceColorHex(name: string): string {
  return SERVICE_COLOR_SLOTS.find((s) => s.name === name)?.hex ?? SERVICE_COLOR_SLOTS[0].hex;
}

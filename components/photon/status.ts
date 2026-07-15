import type { PhotonOrderState, PhotonRxState } from "@/lib/photon";

// Photon state → Badge variant + label, in one place because four surfaces
// render these badges (client Rx tab, /prescriptions, /orders, portal
// Medications). Every variant is an existing Badge tint — no new colours.

/** Expired/Cancelled read as muted rather than danger: both are ordinary
 *  terminal states of a prescription, not failures. Depleted is warning-tinted
 *  because it's the one that usually wants a refill decision. */
export const RX_STATE_VARIANT: Record<PhotonRxState, "success" | "neutral" | "warning"> = {
  DRAFT: "neutral",
  ACTIVE: "success",
  DEPLETED: "warning",
  EXPIRED: "neutral",
  CANCELED: "neutral",
};

export const RX_STATE_LABEL: Record<PhotonRxState, string> = {
  DRAFT: "Draft",
  ACTIVE: "Active",
  DEPLETED: "Depleted",
  EXPIRED: "Expired",
  CANCELED: "Cancelled",
};

/** ROUTING/PENDING are "in flight" (info/teal), PLACED/COMPLETED landed,
 *  CANCELED is muted, ERROR is the only genuine failure. */
export const ORDER_STATE_VARIANT: Record<PhotonOrderState, "success" | "neutral" | "info" | "danger"> = {
  ROUTING: "info",
  PENDING: "info",
  PLACED: "success",
  COMPLETED: "success",
  CANCELED: "neutral",
  ERROR: "danger",
};

export const ORDER_STATE_LABEL: Record<PhotonOrderState, string> = {
  ROUTING: "Routing",
  PENDING: "Pending",
  PLACED: "Placed",
  COMPLETED: "Completed",
  CANCELED: "Cancelled",
  ERROR: "Error",
};

/** "30 Each / 30 day" — Photon's own quantity phrasing. Falls back gracefully
 *  when either half is missing. */
export function quantityLabel(quantity: number | null, unit: string | null, daysSupply: number | null): string {
  const qty = quantity === null ? null : `${quantity}${unit ? ` ${unit}` : ""}`;
  const days = daysSupply === null ? null : `${daysSupply} day`;
  return [qty, days].filter(Boolean).join(" / ") || "–";
}

export type DeliveryVertical = "SHOP" | "GP" | "TIAK";

export type NormalizedDeliveryStep =
  | "CREATED"
  | "PICKED_UP"
  | "IN_TRANSIT"
  | "OUT_FOR_DELIVERY"
  | "DELIVERED"
  | "CANCELLED";

function normalizeInput(value: string | null | undefined): string {
  return String(value ?? "").trim().toUpperCase();
}

export function normalizeDeliveryStep(
  vertical: DeliveryVertical | string | null | undefined,
  rawStatus: string | null | undefined
): NormalizedDeliveryStep {
  const scope = normalizeInput(vertical);
  const status = normalizeInput(rawStatus);

  if (["CANCELED", "CANCELLED", "REJECTED", "FAILED", "EXPIRED"].includes(status)) {
    return "CANCELLED";
  }

  if (status === "DELIVERED" || status === "COMPLETED") {
    return "DELIVERED";
  }

  if (scope === "GP") {
    if (status === "DROPPED_OFF") return "CREATED";
    if (status === "PICKED_UP") return "PICKED_UP";
    if (status === "BOARDED") return "IN_TRANSIT";
    if (status === "ARRIVED") return "OUT_FOR_DELIVERY";
  }

  if (scope === "TIAK") {
    if (["REQUESTED", "ASSIGNED", "ACCEPTED"].includes(status)) return "CREATED";
    if (status === "PICKED_UP") return "PICKED_UP";
  }

  if (scope === "SHOP") {
    if (["PENDING", "CONFIRMED", "FULFILLING", "CREATED"].includes(status)) return "CREATED";
    if (status === "SHIPPED") return "IN_TRANSIT";
    if (status === "OUT_FOR_DELIVERY") return "OUT_FOR_DELIVERY";
  }

  if (status === "PICKED_UP") return "PICKED_UP";
  if (status === "SHIPPED" || status === "IN_TRANSIT" || status === "BOARDED") return "IN_TRANSIT";
  if (status === "ARRIVED" || status === "OUT_FOR_DELIVERY") return "OUT_FOR_DELIVERY";
  return "CREATED";
}

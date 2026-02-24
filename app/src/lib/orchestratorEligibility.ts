export type OrchestratorEligibilityInput = {
  intentType?: string | null;
  objectType?: string | null;
  weightKg?: number | null;
  fromCountry?: string | null;
  toCountry?: string | null;
  fromCity?: string | null;
  toCity?: string | null;
};

function upper(value: string | null | undefined) {
  return typeof value === "string" ? value.trim().toUpperCase() : "";
}

export function isEligibleForGP(intent: OrchestratorEligibilityInput) {
  if (intent.intentType !== "TRANSPORT") return false;
  if (typeof intent.weightKg === "number" && Number.isFinite(intent.weightKg) && intent.weightKg > 120) {
    return false;
  }

  const fromCountry = upper(intent.fromCountry);
  const toCountry = upper(intent.toCountry);
  const crossBorder = Boolean(fromCountry && toCountry && fromCountry !== toCountry);
  const portableObject = ["PARTS", "SMALL_PARCEL", "DOCUMENTS", "KEYS", "NONE"].includes(
    String(intent.objectType ?? "NONE")
  );

  return crossBorder || portableObject;
}

export function isEligibleForTiak(intent: OrchestratorEligibilityInput) {
  if (!["LOCAL_DELIVERY", "TRANSPORT"].includes(String(intent.intentType ?? ""))) return false;
  if (typeof intent.weightKg === "number" && Number.isFinite(intent.weightKg) && intent.weightKg > 30) {
    return false;
  }

  const fromCountry = upper(intent.fromCountry);
  const toCountry = upper(intent.toCountry);
  const sameCountry = !fromCountry || !toCountry || fromCountry === toCountry;
  const fromCity = upper(intent.fromCity);
  const toCity = upper(intent.toCity);
  const sameCity = !fromCity || !toCity || fromCity === toCity;

  return sameCountry && sameCity;
}

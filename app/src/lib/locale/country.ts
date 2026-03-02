export type CountryCode = "FR" | "SN" | (string & {});

export type CountryEntry = {
  code: CountryCode;
  name: string;
  dialCode: string;
  currency?: string;
  flag?: string;
};

export const COUNTRIES: CountryEntry[] = [
  { code: "SN", name: "Senegal", dialCode: "+221", currency: "XOF", flag: "SN" },
  { code: "FR", name: "France", dialCode: "+33", currency: "EUR", flag: "FR" },
];

const COUNTRY_MAP = new Map<string, CountryEntry>(
  COUNTRIES.map((country) => [country.code, country])
);

function normalizeCountry(value: string | null | undefined): CountryCode | null {
  const raw = String(value ?? "").trim().toUpperCase();
  if (!raw) return null;
  return raw as CountryCode;
}

export function getDefaultCountry({
  userCountry,
  geoCountry,
}: {
  userCountry?: string | null;
  geoCountry?: string | null;
}): CountryCode {
  const normalizedUser = normalizeCountry(userCountry);
  if (normalizedUser) return normalizedUser;

  const normalizedGeo = normalizeCountry(geoCountry);
  if (normalizedGeo) return normalizedGeo;

  return "SN";
}

export function getDialCode(country: string | null | undefined): string {
  const normalized = normalizeCountry(country);
  if (!normalized) return "";
  return COUNTRY_MAP.get(normalized)?.dialCode ?? "";
}

export function getCountryName(country: string | null | undefined): string {
  const normalized = normalizeCountry(country);
  if (!normalized) return "";
  return COUNTRY_MAP.get(normalized)?.name ?? normalized;
}

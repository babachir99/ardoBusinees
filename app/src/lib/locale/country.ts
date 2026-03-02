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
  { code: "CI", name: "Cote d'Ivoire", dialCode: "+225", currency: "XOF", flag: "CI" },
  { code: "ML", name: "Mali", dialCode: "+223", currency: "XOF", flag: "ML" },
  { code: "BF", name: "Burkina Faso", dialCode: "+226", currency: "XOF", flag: "BF" },
  { code: "TG", name: "Togo", dialCode: "+228", currency: "XOF", flag: "TG" },
  { code: "BJ", name: "Benin", dialCode: "+229", currency: "XOF", flag: "BJ" },
  { code: "CM", name: "Cameroon", dialCode: "+237", currency: "XAF", flag: "CM" },
  { code: "CG", name: "Congo", dialCode: "+242", currency: "XAF", flag: "CG" },
  { code: "CD", name: "DR Congo", dialCode: "+243", currency: "CDF", flag: "CD" },
  { code: "MA", name: "Morocco", dialCode: "+212", currency: "MAD", flag: "MA" },
  { code: "DZ", name: "Algeria", dialCode: "+213", currency: "DZD", flag: "DZ" },
  { code: "TN", name: "Tunisia", dialCode: "+216", currency: "TND", flag: "TN" },
  { code: "NG", name: "Nigeria", dialCode: "+234", currency: "NGN", flag: "NG" },
  { code: "GH", name: "Ghana", dialCode: "+233", currency: "GHS", flag: "GH" },
  { code: "KE", name: "Kenya", dialCode: "+254", currency: "KES", flag: "KE" },
  { code: "ZA", name: "South Africa", dialCode: "+27", currency: "ZAR", flag: "ZA" },
  { code: "AE", name: "United Arab Emirates", dialCode: "+971", currency: "AED", flag: "AE" },
  { code: "SA", name: "Saudi Arabia", dialCode: "+966", currency: "SAR", flag: "SA" },
  { code: "TR", name: "Turkey", dialCode: "+90", currency: "TRY", flag: "TR" },
  { code: "ES", name: "Spain", dialCode: "+34", currency: "EUR", flag: "ES" },
  { code: "IT", name: "Italy", dialCode: "+39", currency: "EUR", flag: "IT" },
  { code: "BE", name: "Belgium", dialCode: "+32", currency: "EUR", flag: "BE" },
  { code: "DE", name: "Germany", dialCode: "+49", currency: "EUR", flag: "DE" },
  { code: "GB", name: "United Kingdom", dialCode: "+44", currency: "GBP", flag: "GB" },
  { code: "US", name: "United States", dialCode: "+1", currency: "USD", flag: "US" },
  { code: "CA", name: "Canada", dialCode: "+1", currency: "CAD", flag: "CA" },
  { code: "BR", name: "Brazil", dialCode: "+55", currency: "BRL", flag: "BR" },
  { code: "IN", name: "India", dialCode: "+91", currency: "INR", flag: "IN" },
  { code: "CN", name: "China", dialCode: "+86", currency: "CNY", flag: "CN" },
];

const COUNTRY_MAP = new Map<string, CountryEntry>(
  COUNTRIES.map((country) => [country.code, country])
);

function normalizeCountry(value: string | null | undefined): CountryCode | null {
  const raw = String(value ?? "").trim().toUpperCase();
  if (!raw) return null;
  return raw as CountryCode;
}

function resolveKnownCountry(value: string | null | undefined): CountryCode | null {
  const normalized = normalizeCountry(value);
  if (!normalized) return null;
  return COUNTRY_MAP.has(normalized) ? normalized : null;
}

export function getDefaultCountry({
  userCountry,
  geoCountry,
}: {
  userCountry?: string | null;
  geoCountry?: string | null;
}): CountryCode {
  const knownUserCountry = resolveKnownCountry(userCountry);
  if (knownUserCountry) return knownUserCountry;

  const knownGeoCountry = resolveKnownCountry(geoCountry);
  if (knownGeoCountry) return knownGeoCountry;

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

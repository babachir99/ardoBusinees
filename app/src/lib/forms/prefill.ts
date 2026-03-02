import { getDefaultCountry, getDialCode, type CountryCode } from "@/lib/locale/country";

type BuildFormDefaultsInput = {
  sessionUser?: {
    phone?: string | null;
    country?: string | null;
  } | null;
  geoCountry?: string | null;
};

type NormalizePhoneInput = {
  country: string;
  dialCode: string;
  phoneNational: string;
};

function digitsOnly(value: string | null | undefined): string {
  return String(value ?? "").replace(/\D+/g, "");
}

function toNationalNumber(phone: string, dialCode: string): string {
  const phoneDigits = digitsOnly(phone);
  const dialDigits = digitsOnly(dialCode);
  if (!phoneDigits) return "";
  if (!dialDigits) return phoneDigits;

  if (phoneDigits.startsWith(dialDigits)) {
    return phoneDigits.slice(dialDigits.length);
  }

  return phoneDigits;
}

export function buildFormDefaults({
  sessionUser,
  geoCountry,
}: BuildFormDefaultsInput): {
  country: CountryCode;
  dialCode: string;
  phoneNational: string;
  fullPhoneE164?: string;
} {
  const country = getDefaultCountry({
    userCountry: sessionUser?.country ?? null,
    geoCountry,
  });

  const dialCode = getDialCode(country);
  const phoneRaw = String(sessionUser?.phone ?? "").trim();
  const phoneNational = toNationalNumber(phoneRaw, dialCode);

  const normalized = normalizePhoneInput({
    country,
    dialCode,
    phoneNational,
  });

  return {
    country,
    dialCode,
    phoneNational,
    ...(normalized.validBasic ? { fullPhoneE164: normalized.e164 } : {}),
  };
}

export function normalizePhoneInput({
  country: _country,
  dialCode,
  phoneNational,
}: NormalizePhoneInput): {
  e164: string;
  validBasic: boolean;
} {
  const dialDigits = digitsOnly(dialCode);
  let nationalDigits = digitsOnly(phoneNational);

  if (dialDigits && nationalDigits.startsWith(dialDigits)) {
    nationalDigits = nationalDigits.slice(dialDigits.length);
  }

  nationalDigits = nationalDigits.replace(/^0+/, "");

  const validBasic = nationalDigits.length >= 6 && nationalDigits.length <= 14;
  const e164 = dialDigits && nationalDigits ? `+${dialDigits}${nationalDigits}` : "";

  return {
    e164,
    validBasic,
  };
}

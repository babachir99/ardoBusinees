"use client";

import { COUNTRIES, getCountryFlag, getDialCode } from "@/lib/locale/country";

type CountryPhoneValue = {
  country: string;
  dialCode: string;
  phoneNational: string;
};

type CountryPhoneFieldProps = {
  value: CountryPhoneValue;
  onChange: (value: CountryPhoneValue) => void;
  required?: boolean;
  disabled?: boolean;
  locale?: string;
  className?: string;
};

export default function CountryPhoneField({
  value,
  onChange,
  required = false,
  disabled = false,
  locale = "fr",
  className = "",
}: CountryPhoneFieldProps) {
  const isFr = locale === "fr";

  return (
    <div className={`grid gap-2 md:grid-cols-[minmax(0,180px)_110px_minmax(0,1fr)] ${className}`.trim()}>
      <label className="space-y-1">
        <span className="text-xs text-zinc-400">{isFr ? "Pays" : "Country"}{required ? " *" : ""}</span>
        <select
          value={value.country}
          disabled={disabled}
          onChange={(event) => {
            const country = event.target.value;
            onChange({
              country,
              dialCode: getDialCode(country),
              phoneNational: value.phoneNational,
            });
          }}
          className="h-10 rounded-lg border border-white/10 bg-zinc-950 px-3 text-sm text-white"
        >
          {COUNTRIES.map((country) => (
            <option key={country.code} value={country.code}>
              {`${getCountryFlag(country.code)} ${country.name}`.trim()}
            </option>
          ))}
        </select>
      </label>

      <label className="space-y-1">
        <span className="text-xs text-zinc-400">{isFr ? "Indicatif" : "Dial"}</span>
        <input
          value={value.dialCode}
          readOnly
          disabled={disabled}
          className="h-10 rounded-lg border border-white/10 bg-zinc-900 px-3 text-sm text-zinc-300"
        />
      </label>

      <label className="space-y-1">
        <span className="text-xs text-zinc-400">{isFr ? "Numero" : "Phone"}{required ? " *" : ""}</span>
        <input
          value={value.phoneNational}
          disabled={disabled}
          inputMode="tel"
          onChange={(event) => {
            const phoneNational = event.target.value.replace(/[^0-9\s-]/g, "");
            onChange({
              country: value.country,
              dialCode: value.dialCode || getDialCode(value.country),
              phoneNational,
            });
          }}
          className="h-10 rounded-lg border border-white/10 bg-zinc-950 px-3 text-sm text-white"
        />
      </label>
    </div>
  );
}

export function formatMoney(
  cents: number,
  currency: string,
  locale: string
) {
  const normalizedLocale = locale === "fr" ? "fr-FR" : "en-US";
  const value = cents / 100;

  return new Intl.NumberFormat(normalizedLocale, {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

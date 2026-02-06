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

export function getDiscountedPrice(
  cents: number,
  discountPercent?: number | null
) {
  const raw = Number(discountPercent ?? 0);
  if (!Number.isFinite(raw) || raw <= 0) {
    return cents;
  }
  const clamped = Math.min(Math.max(Math.round(raw), 1), 90);
  return Math.max(0, Math.round((cents * (100 - clamped)) / 100));
}

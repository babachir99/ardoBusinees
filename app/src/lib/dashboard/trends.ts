export type DashboardTrendPoint = {
  key: string;
  label: string;
  day: number;
  month: string;
  showMonth: boolean;
};

function normalizeLocale(locale: string) {
  return locale === "fr" ? "fr-FR" : "en-US";
}

export function toDayKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function buildTrendPoints(locale: string, startDate: Date, days: number): DashboardTrendPoint[] {
  const normalizedLocale = normalizeLocale(locale);

  return Array.from({ length: days }).map((_, index) => {
    const current = new Date(startDate);
    current.setDate(startDate.getDate() + index);

    return {
      key: toDayKey(current),
      label: current.toLocaleDateString(normalizedLocale, {
        month: "short",
        day: "numeric",
      }),
      day: current.getDate(),
      month: current.toLocaleDateString(normalizedLocale, { month: "short" }),
      showMonth: current.getDate() === 1 || index === 0,
    };
  });
}

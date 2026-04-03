"use client";

import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";

type TrendPoint = {
  key: string;
  label: string;
  day: number;
  month: string;
  showMonth: boolean;
};

type SellerTrendsPanelProps = {
  dates: TrendPoint[];
  revenueSeries: number[];
  ordersSeries: number[];
  itemsSeries: number[];
  rangeOptions?: number[];
  defaultRange?: number;
  exportFilename?: string;
};

const ranges = [7, 14, 30];

export default function SellerTrendsPanel({
  dates,
  revenueSeries,
  ordersSeries,
  itemsSeries,
  rangeOptions,
  defaultRange,
  exportFilename = "seller-dashboard.csv",
}: SellerTrendsPanelProps) {
  const t = useTranslations("Seller");
  const locale = useLocale();
  const rawOptions = rangeOptions && rangeOptions.length > 0 ? rangeOptions : ranges;
  const options = rawOptions.filter((value) => value <= (dates.length || value));
  const fallbackOptions = options.length > 0 ? options : rawOptions;
  const initialRange =
    defaultRange && fallbackOptions.includes(defaultRange)
      ? defaultRange
      : fallbackOptions[0];
  const [range, setRange] = useState(initialRange);

  const chartPoints = (values: number[]) => {
    if (values.length < 2) {
      return "0,100";
    }
    const max = Math.max(...values, 1);
    return values
      .map((value, index) => {
        const x = (index / (values.length - 1)) * 100;
        const y = 100 - (value / max) * 100;
        return `${x},${y}`;
      })
      .join(" ");
  };

  const safeRange = Math.min(range, dates.length || range);
  const data = useMemo(() => {
    const sliceSeries = (values: number[]) => values.slice(-safeRange);
    return {
      revenue: sliceSeries(revenueSeries),
      orders: sliceSeries(ordersSeries),
      items: sliceSeries(itemsSeries),
      dates: dates.slice(-safeRange),
    };
  }, [safeRange, dates, revenueSeries, ordersSeries, itemsSeries]);

  const comparisons = useMemo(
    () => ({
      revenue: {
        current: revenueSeries.slice(-safeRange).reduce((sum, value) => sum + value, 0),
        previous: revenueSeries.slice(-safeRange * 2, -safeRange).reduce((sum, value) => sum + value, 0),
      },
      orders: {
        current: ordersSeries.slice(-safeRange).reduce((sum, value) => sum + value, 0),
        previous: ordersSeries.slice(-safeRange * 2, -safeRange).reduce((sum, value) => sum + value, 0),
      },
      items: {
        current: itemsSeries.slice(-safeRange).reduce((sum, value) => sum + value, 0),
        previous: itemsSeries.slice(-safeRange * 2, -safeRange).reduce((sum, value) => sum + value, 0),
      },
    }),
    [safeRange, revenueSeries, ordersSeries, itemsSeries]
  );

  const labelStep = safeRange >= 30 ? 3 : safeRange >= 14 ? 2 : 1;
  const numberFormatter = useMemo(() => {
    const normalizedLocale = locale === "fr" ? "fr-FR" : "en-US";
    return new Intl.NumberFormat(normalizedLocale, {
      notation: "compact",
      maximumFractionDigits: 1,
    });
  }, [locale]);

  const formatTick = (value: number, isMoney = false) => {
    const displayValue = isMoney ? value / 100 : value;
    const formatted = numberFormatter.format(displayValue);
    return isMoney ? `${formatted} CFA` : formatted;
  };

  const csvContent = useMemo(() => {
    const rows = data.dates.map((d, index) =>
      [d.label, data.revenue[index] ?? 0, data.orders[index] ?? 0, data.items[index] ?? 0].join(";")
    );
    return [["date", "revenue", "orders", "items"].join(";"), ...rows].join("\n");
  }, [data]);

  const exportCsv = () => {
    const blob = new Blob(["\uFEFF", csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = exportFilename;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  };

  return (
    <section className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-white">{t("trends.title")}</h2>
          <p className="mt-1 text-sm text-zinc-400">{t("trends.subtitle")}</p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            onClick={exportCsv}
            className="rounded-full border border-white/10 bg-zinc-950/60 px-4 py-2 text-[11px] font-medium text-zinc-200 transition hover:border-white/30 hover:text-white"
          >
            {locale === "fr" ? "Exporter CSV" : "Export CSV"}
          </button>
          <div className="flex items-center gap-2 rounded-full border border-white/10 bg-zinc-950/40 px-2 py-1 text-[11px] text-zinc-300">
            {fallbackOptions.map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setRange(value)}
                className={`rounded-full px-3 py-1 transition ${
                  range === value
                    ? "bg-emerald-400 text-zinc-950"
                    : "text-zinc-300 hover:text-white"
                }`}
              >
                {t("trends.range", { days: value })}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        {[
          { key: "revenue", title: t("trends.revenue"), ...comparisons.revenue, isMoney: true },
          { key: "orders", title: t("trends.orders"), ...comparisons.orders, isMoney: false },
          { key: "items", title: t("trends.items"), ...comparisons.items, isMoney: false },
        ].map((item) => {
          const delta = item.current - item.previous;
          const deltaRatio = item.previous > 0 ? delta / item.previous : null;
          const tone =
            delta > 0 ? "text-emerald-300" : delta < 0 ? "text-rose-300" : "text-zinc-300";

          return (
            <div key={item.key} className="rounded-2xl border border-white/10 bg-zinc-900/60 p-4">
              <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">{item.title}</p>
              <div className="mt-2 flex items-end justify-between gap-3">
                <p className="text-lg font-semibold text-white">{formatTick(item.current, item.isMoney)}</p>
                <p className={`text-xs font-medium ${tone}`}>
                  {deltaRatio === null
                    ? locale === "fr"
                      ? "Nouvelle periode"
                      : "New period"
                    : `${deltaRatio >= 0 ? "+" : ""}${Math.round(deltaRatio * 100)}%`}
                </p>
              </div>
              <p className="mt-2 text-xs text-zinc-400">
                {item.previous > 0
                  ? locale === "fr"
                    ? `vs ${formatTick(item.previous, item.isMoney)} sur la periode precedente`
                    : `vs ${formatTick(item.previous, item.isMoney)} over the previous period`
                  : locale === "fr"
                    ? "Pas de periode precedente comparable"
                    : "No comparable previous period"}
              </p>
            </div>
          );
        })}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {[
          {
            key: "revenue",
            title: t("trends.revenue"),
            color: "#34d399",
            gradientId: "sellerRevGradient",
            series: data.revenue,
            isMoney: true,
          },
          {
            key: "orders",
            title: t("trends.orders"),
            color: "#60a5fa",
            gradientId: "sellerOrderGradient",
            series: data.orders,
            isMoney: false,
          },
          {
            key: "items",
            title: t("trends.items"),
            color: "#facc15",
            gradientId: "sellerItemGradient",
            series: data.items,
            isMoney: false,
          },
        ].map((item) => (
          <div
            key={item.key}
            className="rounded-3xl border border-white/10 bg-zinc-900/70 p-6"
          >
            {(() => {
              const maxValue = Math.max(...item.series, 1);
              const points = item.series.map((value, index) => {
                const x = item.series.length > 1 ? (index / (item.series.length - 1)) * 100 : 0;
                const y = 100 - (value / maxValue) * 100;
                return { x, y, value, index };
              });
              const lastPointData =
                points[points.length - 1] ?? { x: 0, y: 100, value: 0, index: 0 };
              const buildTooltip = (index: number, value: number) => {
                const label = data.dates[index]?.label ?? "";
                return label
                  ? `${label} - ${formatTick(value, item.isMoney)}`
                  : formatTick(value, item.isMoney);
              };
              return (
                <div className="grid gap-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-white">{item.title}</h3>
                    <span className="text-xs text-zinc-400">
                      {t("trends.days", { days: safeRange })}
                    </span>
                  </div>
                  <div className="flex items-stretch gap-3">
                    <div className="flex h-24 flex-col justify-between text-[10px] text-zinc-400">
                      <span>{formatTick(Math.max(...item.series, 0), item.isMoney)}</span>
                      <span>
                        {formatTick(
                          Math.round(Math.max(...item.series, 0) / 2),
                          item.isMoney
                        )}
                      </span>
                      <span>{formatTick(0, item.isMoney)}</span>
                    </div>
                    <div className="relative h-24 w-full">
                      <svg viewBox="0 0 100 100" className="h-full w-full">
                        <defs>
                          <linearGradient id={item.gradientId} x1="0" x2="0" y1="0" y2="1">
                            <stop offset="0%" stopColor={item.color} stopOpacity="0.8" />
                            <stop offset="100%" stopColor={item.color} stopOpacity="0" />
                          </linearGradient>
                          <linearGradient id={`${item.gradientId}-bg`} x1="0" x2="0" y1="0" y2="1">
                            <stop offset="0%" stopColor={item.color} stopOpacity="0.12" />
                            <stop offset="100%" stopColor={item.color} stopOpacity="0" />
                          </linearGradient>
                        </defs>
                        <rect width="100" height="100" fill={`url(#${item.gradientId}-bg)`} />
                        <line x1="0" x2="100" y1="0" y2="0" stroke="rgba(255,255,255,0.08)" />
                        <line x1="0" x2="100" y1="50" y2="50" stroke="rgba(255,255,255,0.08)" />
                        <line x1="0" x2="100" y1="100" y2="100" stroke="rgba(255,255,255,0.08)" />
                        <polyline
                          points={chartPoints(item.series)}
                          fill="none"
                          stroke={item.color}
                          strokeWidth="2"
                        />
                        <polygon
                          points={`0,100 ${chartPoints(item.series)} 100,100`}
                          fill={`url(#${item.gradientId})`}
                        />
                        {points.length > 0 && (
                          <circle
                            cx={lastPointData.x}
                            cy={lastPointData.y}
                            r="2.6"
                            fill={item.color}
                          />
                        )}
                      </svg>
                      {points.length > 0 && (
                        <div className="absolute inset-0">
                          {points.map((point) => {
                            const tooltip = buildTooltip(point.index, point.value);
                            return (
                              <button
                                key={point.index}
                                type="button"
                                aria-label={tooltip}
                                className="group absolute -translate-x-1/2 -translate-y-1/2"
                                style={{ left: `${point.x}%`, top: `${point.y}%` }}
                              >
                                <span
                                  className="block h-2.5 w-2.5 rounded-full opacity-0 transition group-hover:opacity-100"
                                  style={{ backgroundColor: item.color }}
                                />
                                <span className="absolute left-1/2 top-[-36px] -translate-x-1/2 rounded-full border border-white/10 bg-zinc-950 px-3 py-1 text-[10px] text-white opacity-0 shadow-lg transition group-hover:opacity-100 whitespace-nowrap">
                                  {tooltip}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="relative pt-3 text-[10px] text-zinc-400">
                    <div className="absolute inset-x-0 top-2 border-t border-white/10" />
                    <div
                      className="grid"
                      style={{
                        gridTemplateColumns: `repeat(${data.dates.length}, minmax(0, 1fr))`,
                      }}
                    >
                      {data.dates.map((d, index) => {
                        const showLabel =
                          index % labelStep === 0 || index === data.dates.length - 1;
                        return (
                          <div key={d.key} className="flex flex-col items-center gap-1">
                            <span className="h-2 w-px bg-white/20" />
                            <span
                              className={`leading-none text-[10px] ${
                                showLabel ? "text-zinc-300 opacity-80" : "opacity-0"
                              }`}
                            >
                              {d.day}
                            </span>
                            <span
                              className={`leading-none text-[9px] text-zinc-500 ${
                                showLabel && d.showMonth ? "opacity-80" : "opacity-0"
                              }`}
                            >
                              {d.month}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        ))}
      </div>
    </section>
  );
}

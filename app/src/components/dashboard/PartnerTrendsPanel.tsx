"use client";

import { useMemo, useState } from "react";
import type { DashboardTrendPoint } from "@/lib/dashboard/trends";

export type PartnerTrendMetric = {
  key: string;
  title: string;
  color: string;
  series: number[];
  isMoney?: boolean;
  moneyLabel?: string;
};

type PartnerTrendsPanelProps = {
  locale: string;
  title: string;
  subtitle: string;
  dates: DashboardTrendPoint[];
  metrics: PartnerTrendMetric[];
  rangeOptions?: number[];
  defaultRange?: number;
};

const defaultRanges = [7, 30, 90];

function chartPoints(values: number[]) {
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
}

export default function PartnerTrendsPanel({
  locale,
  title,
  subtitle,
  dates,
  metrics,
  rangeOptions = defaultRanges,
  defaultRange = 30,
}: PartnerTrendsPanelProps) {
  const isFr = locale === "fr";
  const availableRanges = rangeOptions.filter((value) => value <= (dates.length || value));
  const safeRanges = availableRanges.length > 0 ? availableRanges : rangeOptions;
  const initialRange = safeRanges.includes(defaultRange) ? defaultRange : safeRanges[0] ?? defaultRange;
  const [range, setRange] = useState(initialRange);

  const safeRange = Math.min(range, dates.length || range);
  const numberFormatter = useMemo(() => {
    return new Intl.NumberFormat(isFr ? "fr-FR" : "en-US", {
      notation: "compact",
      maximumFractionDigits: 1,
    });
  }, [isFr]);

  const slicedMetrics = useMemo(() => {
    return metrics.map((metric) => ({
      ...metric,
      series: metric.series.slice(-safeRange),
    }));
  }, [metrics, safeRange]);

  const visibleDates = useMemo(() => dates.slice(-safeRange), [dates, safeRange]);
  const labelStep = safeRange >= 30 ? 3 : safeRange >= 14 ? 2 : 1;

  const formatTick = (metric: PartnerTrendMetric, value: number) => {
    if (metric.isMoney) {
      const label = metric.moneyLabel ?? (isFr ? "FCFA" : "XOF");
      return `${numberFormatter.format(value / 100)} ${label}`;
    }
    return numberFormatter.format(value);
  };

  return (
    <section className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-white">{title}</h2>
          <p className="mt-1 text-sm text-zinc-400">{subtitle}</p>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-white/10 bg-zinc-950/40 px-2 py-1 text-[11px] text-zinc-300">
          {safeRanges.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setRange(value)}
              className={`rounded-full px-3 py-1 transition ${
                range === value ? "bg-emerald-400 text-zinc-950" : "text-zinc-300 hover:text-white"
              }`}
            >
              {value}
              {isFr ? "j" : "d"}
            </button>
          ))}
        </div>
      </div>

      <div className={`grid gap-4 ${metrics.length >= 3 ? "xl:grid-cols-3" : "md:grid-cols-2"}`}>
        {slicedMetrics.map((metric) => {
          const maxValue = Math.max(...metric.series, 1);
          const points = metric.series.map((value, index) => {
            const x = metric.series.length > 1 ? (index / (metric.series.length - 1)) * 100 : 0;
            const y = 100 - (value / maxValue) * 100;
            return { x, y, value, index };
          });
          const lastPoint = points[points.length - 1] ?? { x: 0, y: 100, value: 0, index: 0 };
          const gradientId = `partner-trend-${metric.key}`;

          return (
            <div key={metric.key} className="rounded-3xl border border-white/10 bg-zinc-900/70 p-6">
              <div className="grid gap-3">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-sm font-semibold text-white">{metric.title}</h3>
                  <span className="text-xs text-zinc-400">
                    {safeRange}
                    {isFr ? " jours" : " days"}
                  </span>
                </div>

                <div className="flex items-stretch gap-3">
                  <div className="flex h-24 flex-col justify-between text-[10px] text-zinc-400">
                    <span>{formatTick(metric, Math.max(...metric.series, 0))}</span>
                    <span>{formatTick(metric, Math.round(Math.max(...metric.series, 0) / 2))}</span>
                    <span>{formatTick(metric, 0)}</span>
                  </div>

                  <div className="relative h-24 w-full">
                    <svg viewBox="0 0 100 100" className="h-full w-full">
                      <defs>
                        <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
                          <stop offset="0%" stopColor={metric.color} stopOpacity="0.8" />
                          <stop offset="100%" stopColor={metric.color} stopOpacity="0" />
                        </linearGradient>
                        <linearGradient id={`${gradientId}-bg`} x1="0" x2="0" y1="0" y2="1">
                          <stop offset="0%" stopColor={metric.color} stopOpacity="0.12" />
                          <stop offset="100%" stopColor={metric.color} stopOpacity="0" />
                        </linearGradient>
                      </defs>
                      <rect width="100" height="100" fill={`url(#${gradientId}-bg)`} />
                      <line x1="0" x2="100" y1="0" y2="0" stroke="rgba(255,255,255,0.08)" />
                      <line x1="0" x2="100" y1="50" y2="50" stroke="rgba(255,255,255,0.08)" />
                      <line x1="0" x2="100" y1="100" y2="100" stroke="rgba(255,255,255,0.08)" />
                      <polyline points={chartPoints(metric.series)} fill="none" stroke={metric.color} strokeWidth="2" />
                      <polygon points={`0,100 ${chartPoints(metric.series)} 100,100`} fill={`url(#${gradientId})`} />
                      {points.length > 0 ? <circle cx={lastPoint.x} cy={lastPoint.y} r="2.6" fill={metric.color} /> : null}
                    </svg>

                    {points.length > 0 ? (
                      <div className="absolute inset-0">
                        {points.map((point) => {
                          const label = visibleDates[point.index]?.label;
                          const tooltip = label ? `${label} - ${formatTick(metric, point.value)}` : formatTick(metric, point.value);
                          return (
                            <button
                              key={`${metric.key}-${point.index}`}
                              type="button"
                              aria-label={tooltip}
                              className="group absolute -translate-x-1/2 -translate-y-1/2"
                              style={{ left: `${point.x}%`, top: `${point.y}%` }}
                            >
                              <span
                                className="block h-2.5 w-2.5 rounded-full opacity-0 transition group-hover:opacity-100"
                                style={{ backgroundColor: metric.color }}
                              />
                              <span className="absolute left-1/2 top-[-36px] whitespace-nowrap rounded-full border border-white/10 bg-zinc-950 px-3 py-1 text-[10px] text-white opacity-0 shadow-lg transition group-hover:opacity-100 -translate-x-1/2">
                                {tooltip}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="relative pt-3 text-[10px] text-zinc-400">
                  <div className="absolute inset-x-0 top-2 border-t border-white/10" />
                  <div className="grid" style={{ gridTemplateColumns: `repeat(${visibleDates.length}, minmax(0, 1fr))` }}>
                    {visibleDates.map((date, index) => {
                      const showLabel = index % labelStep === 0 || index === visibleDates.length - 1;
                      return (
                        <div key={`${metric.key}-${date.key}`} className="flex flex-col items-center gap-1">
                          <span className="h-2 w-px bg-white/20" />
                          <span className={`leading-none text-[10px] ${showLabel ? "text-zinc-300 opacity-80" : "opacity-0"}`}>
                            {date.day}
                          </span>
                          <span
                            className={`leading-none text-[9px] text-zinc-500 ${
                              showLabel && date.showMonth ? "opacity-80" : "opacity-0"
                            }`}
                          >
                            {date.month}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

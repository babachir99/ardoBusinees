"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

type Activity = {
  id: string;
  action: string;
  createdAt: string;
};

export default function ActivityPanel() {
  const t = useTranslations("Activity");
  const [items, setItems] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/activity");
      if (!res.ok) {
        throw new Error(t("errors.load"));
      }
      const data = (await res.json()) as Activity[];
      setItems(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errors.load"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  if (loading) {
    return (
      <div className="rounded-3xl border border-white/10 bg-zinc-900/70 p-8">
        <p className="text-sm text-zinc-400">{t("loading")}</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-3xl border border-white/10 bg-zinc-900/70 p-8">
        <p className="text-sm text-rose-300">{error}</p>
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-white/10 bg-zinc-900/70 p-8">
      <h1 className="text-2xl font-semibold">{t("title")}</h1>
      <p className="mt-2 text-sm text-zinc-300">{t("subtitle")}</p>
      <div className="mt-4 grid gap-3 text-xs text-zinc-300">
        {items.length === 0 && (
          <p className="text-xs text-zinc-500">{t("empty")}</p>
        )}
        {items.map((item) => (
          <div
            key={item.id}
            className="flex items-center justify-between rounded-2xl border border-white/10 bg-zinc-950/60 px-4 py-3"
          >
            <span>{item.action}</span>
            <span className="text-zinc-500">
              {new Date(item.createdAt).toLocaleString()}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

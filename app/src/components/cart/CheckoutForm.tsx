"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useCart } from "./CartProvider";
import { formatMoney } from "@/lib/format";
import { useLocale } from "next-intl";
import Link from "next/link";

type CheckoutState = "idle" | "loading" | "success" | "error";

export default function CheckoutForm() {
  const t = useTranslations("Checkout");
  const locale = useLocale();
  const { items, subtotalCents, clear } = useCart();
  const [state, setState] = useState<CheckoutState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<
    "WAVE" | "ORANGE_MONEY" | "CARD" | "CASH"
  >("WAVE");
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
    city: "",
  });

  const feesCents = Math.round(subtotalCents * 0.04);
  const totalCents = subtotalCents + feesCents;
  const hasNonLocal = items.some((item) => item.type !== "LOCAL");

  const handleChange = (field: keyof typeof form) => (value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    setError(null);

    if (!form.email) {
      setError(t("errors.email"));
      return;
    }

    if (items.length === 0) {
      setError(t("errors.empty"));
      return;
    }

    setState("loading");

    try {
      const payload = {
        email: form.email,
        name: form.name || undefined,
        phone: form.phone || undefined,
        shippingAddress: form.address || undefined,
        shippingCity: form.city || undefined,
        feesCents,
        paymentMethod,
        items: items.map((item) => ({
          productId: item.id,
          quantity: item.quantity,
          unitPriceCents: item.priceCents,
          type: item.type,
          optionColor: item.optionColor,
          optionSize: item.optionSize,
        })),
      };

      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Order failed");
      }

      const order = (await res.json()) as { id: string };

      if (paymentMethod !== "CASH") {
        const paymentRes = await fetch("/api/payments/mock", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderId: order.id }),
        });

        if (!paymentRes.ok) {
          const data = await paymentRes.json().catch(() => null);
          throw new Error(data?.error || "Payment failed");
        }
      }

      clear();
      setState("success");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t("errors.generic")
      );
      setState("error");
    }
  };

  if (state === "success") {
    return (
      <div className="rounded-3xl border border-white/10 bg-zinc-900/70 p-8">
        <h2 className="text-xl font-semibold">{t("success.title")}</h2>
        <p className="mt-3 text-sm text-zinc-300">{t("success.desc")}</p>
        <Link
          href={`/${locale}/orders`}
          className="mt-6 inline-flex items-center rounded-full border border-white/20 px-4 py-2 text-xs font-semibold text-white transition hover:border-white/40"
        >
          {t("success.cta")}
        </Link>
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-white/10 bg-zinc-900/70 p-8">
      <h1 className="text-2xl font-semibold">{t("title")}</h1>
      <p className="mt-3 text-sm text-zinc-300">{t("subtitle")}</p>

      <div className="mt-6 grid gap-4">
        <div className="rounded-2xl border border-white/10 bg-zinc-950/60 p-5">
          <p className="text-sm font-semibold">{t("form.contact")}</p>
          <div className="mt-4 grid gap-3 text-xs text-zinc-400">
            <input
              className="rounded-xl border border-white/10 bg-zinc-900/70 px-4 py-3 text-sm text-white outline-none"
              placeholder={t("form.name")}
              value={form.name}
              onChange={(e) => handleChange("name")(e.target.value)}
            />
            <input
              className="rounded-xl border border-white/10 bg-zinc-900/70 px-4 py-3 text-sm text-white outline-none"
              placeholder={t("form.email")}
              value={form.email}
              onChange={(e) => handleChange("email")(e.target.value)}
            />
            <input
              className="rounded-xl border border-white/10 bg-zinc-900/70 px-4 py-3 text-sm text-white outline-none"
              placeholder={t("form.phone")}
              value={form.phone}
              onChange={(e) => handleChange("phone")(e.target.value)}
            />
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-zinc-950/60 p-5">
          <p className="text-sm font-semibold">{t("form.payment")}</p>
          <div className="mt-4 grid gap-3 text-xs text-zinc-400 sm:grid-cols-2">
            {(["WAVE", "ORANGE_MONEY", "CARD", "CASH"] as const).map(
              (method) => {
                const isCash = method === "CASH";
                const disabled = isCash && hasNonLocal;
                return (
                  <button
                    key={method}
                    type="button"
                    disabled={disabled}
                    onClick={() => setPaymentMethod(method)}
                    className={`rounded-xl border px-4 py-3 text-left text-sm transition ${
                      paymentMethod === method
                        ? "border-emerald-400/70 bg-emerald-400/10 text-emerald-100"
                        : "border-white/10 bg-zinc-900/70 text-white"
                    } ${disabled ? "cursor-not-allowed opacity-50" : ""}`}
                  >
                    {t(`paymentMethods.${method.toLowerCase()}`)}
                  </button>
                );
              }
            )}
          </div>
          {hasNonLocal && (
            <p className="mt-3 text-xs text-zinc-500">
              {t("form.cashNote")}
            </p>
          )}
        </div>

        <div className="rounded-2xl border border-white/10 bg-zinc-950/60 p-5">
          <p className="text-sm font-semibold">{t("form.shipping")}</p>
          <div className="mt-4 grid gap-3 text-xs text-zinc-400">
            <input
              className="rounded-xl border border-white/10 bg-zinc-900/70 px-4 py-3 text-sm text-white outline-none"
              placeholder={t("form.address")}
              value={form.address}
              onChange={(e) => handleChange("address")(e.target.value)}
            />
            <input
              className="rounded-xl border border-white/10 bg-zinc-900/70 px-4 py-3 text-sm text-white outline-none"
              placeholder={t("form.city")}
              value={form.city}
              onChange={(e) => handleChange("city")(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-white/10 bg-zinc-950/60 p-5 text-sm text-zinc-300">
        <div className="flex items-center justify-between">
          <span>{t("summary.subtotal")}</span>
          <span>{formatMoney(subtotalCents, "XOF", locale)}</span>
        </div>
        <div className="mt-2 flex items-center justify-between">
          <span>{t("summary.fees")}</span>
          <span>{formatMoney(feesCents, "XOF", locale)}</span>
        </div>
        <div className="mt-2 flex items-center justify-between font-semibold text-white">
          <span>{t("summary.total")}</span>
          <span>{formatMoney(totalCents, "XOF", locale)}</span>
        </div>
      </div>

      {error && (
        <p className="mt-4 text-sm text-rose-300">{error}</p>
      )}

      <button
        type="button"
        onClick={handleSubmit}
        disabled={state === "loading"}
        className="mt-6 w-full rounded-full bg-emerald-400 px-6 py-3 text-sm font-semibold text-zinc-950 transition disabled:opacity-60"
      >
        {state === "loading" ? t("summary.loading") : t("summary.pay")}
      </button>
      <p className="mt-3 text-xs text-zinc-400">{t("summary.note")}</p>
    </div>
  );
}



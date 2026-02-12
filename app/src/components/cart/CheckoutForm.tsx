"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useCart } from "./CartProvider";
import { formatMoney } from "@/lib/format";
import { useLocale } from "next-intl";
import Link from "next/link";

type CheckoutState = "idle" | "loading" | "success" | "error";

type SavedAddress = {
  id: string;
  label: string;
  address: string;
  city: string;
};

type ProfilePayload = {
  email?: string | null;
  name?: string | null;
  phone?: string | null;
};

type CheckoutOrdersResponse = {
  id?: string;
  orderIds?: string[];
  orders?: Array<{ id: string }>;
};

export default function CheckoutForm() {
  const t = useTranslations("Checkout");
  const locale = useLocale();
  const isFr = locale === "fr";
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
  const [contactLocked, setContactLocked] = useState(false);
  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState("");
  const [addressLabel, setAddressLabel] = useState("");

  const feesCents = Math.round(subtotalCents * 0.04);
  const totalCents = subtotalCents + feesCents;
  const hasNonLocal = items.some((item) => item.type !== "LOCAL");
  const forceTestPayment =
    process.env.NODE_ENV !== "production" ||
    process.env.NEXT_PUBLIC_FORCE_TEST_PAYMENTS === "1";
  const shouldRunMockPayment = forceTestPayment || paymentMethod !== "CASH";

  const contactComplete =
    form.name.trim().length > 0 &&
    form.email.trim().length > 0 &&
    form.phone.trim().length > 0;

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const [profileRes, addressesRes] = await Promise.all([
        fetch("/api/profile", { cache: "no-store" }).catch(() => null),
        fetch("/api/addresses", { cache: "no-store" }).catch(() => null),
      ]);

      if (!cancelled && profileRes?.ok) {
        const profile = (await profileRes.json()) as ProfilePayload | null;
        if (profile) {
          const nextName = String(profile.name ?? "").trim();
          const nextEmail = String(profile.email ?? "").trim();
          const nextPhone = String(profile.phone ?? "").trim();

          setForm((prev) => ({
            ...prev,
            name: prev.name || nextName,
            email: prev.email || nextEmail,
            phone: prev.phone || nextPhone,
          }));

          if (nextName && nextEmail && nextPhone) {
            setContactLocked(true);
          }
        }
      }

      if (!cancelled && addressesRes?.ok) {
        const addresses = (await addressesRes.json()) as SavedAddress[];
        if (Array.isArray(addresses)) {
          setSavedAddresses(addresses.slice(0, 20));
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleChange = (field: keyof typeof form) => (value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const applyAddress = (id: string) => {
    setSelectedAddressId(id);
    const selected = savedAddresses.find((entry) => entry.id === id);
    if (!selected) return;
    setForm((prev) => ({
      ...prev,
      address: selected.address,
      city: selected.city,
    }));
  };

  const saveCurrentAddress = async () => {
    setError(null);

    const address = form.address.trim();
    const city = form.city.trim();

    if (!address || !city) {
      setError(
        isFr
          ? "Renseigne adresse et ville pour enregistrer."
          : "Please provide address and city to save."
      );
      return;
    }

    const res = await fetch("/api/addresses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        label: addressLabel.trim(),
        address,
        city,
      }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(data?.error ?? (isFr ? "Enregistrement impossible" : "Cannot save"));
      return;
    }

    const created = (await res.json()) as SavedAddress;
    setSavedAddresses((prev) => [created, ...prev.filter((entry) => entry.id !== created.id)].slice(0, 20));
    setSelectedAddressId(created.id);
    setAddressLabel("");
  };

  const removeAddress = async (id: string) => {
    setError(null);

    const res = await fetch(`/api/addresses/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(data?.error ?? (isFr ? "Suppression impossible" : "Cannot delete"));
      return;
    }

    setSavedAddresses((prev) => prev.filter((entry) => entry.id !== id));
    if (selectedAddressId === id) {
      setSelectedAddressId("");
    }
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
          offerId: item.offerId,
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

      const orderResponse = (await res.json()) as CheckoutOrdersResponse;

      const orderIds = Array.from(
        new Set(
          [
            orderResponse.id,
            ...(Array.isArray(orderResponse.orderIds) ? orderResponse.orderIds : []),
            ...((orderResponse.orders ?? []).map((order) => order.id)),
          ].filter((value): value is string => Boolean(value))
        )
      );

      if (orderIds.length === 0) {
        throw new Error("Order failed");
      }

      if (shouldRunMockPayment) {
        const paymentRes = await fetch("/api/payments/mock", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderIds, forceSuccess: true }),
        });

        if (!paymentRes.ok) {
          const data = await paymentRes.json().catch(() => null);
          throw new Error(data?.error || "Payment failed");
        }
      }

      clear();
      setState("success");
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errors.generic"));
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
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold">{t("form.contact")}</p>
            {contactLocked && contactComplete && (
              <button
                type="button"
                onClick={() => setContactLocked(false)}
                className="rounded-full border border-white/20 px-3 py-1 text-[11px] text-zinc-200"
              >
                {isFr ? "Modifier" : "Edit"}
              </button>
            )}
          </div>

          {contactLocked && contactComplete ? (
            <div className="mt-3 rounded-xl border border-emerald-400/30 bg-emerald-500/5 px-4 py-3 text-xs text-zinc-200">
              <p className="font-medium">{form.name}</p>
              <p className="mt-1">{form.email}</p>
              <p className="mt-1">{form.phone}</p>
            </div>
          ) : (
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
          )}
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
            <p className="mt-3 text-xs text-zinc-500">{t("form.cashNote")}</p>
          )}
        </div>

        <div className="rounded-2xl border border-white/10 bg-zinc-950/60 p-5">
          <p className="text-sm font-semibold">{t("form.shipping")}</p>

          {savedAddresses.length > 0 && (
            <div className="mt-4 grid gap-3">
              <select
                value={selectedAddressId}
                onChange={(e) => applyAddress(e.target.value)}
                className="rounded-xl border border-white/10 bg-zinc-900/70 px-4 py-3 text-sm text-white outline-none"
              >
                <option value="">{isFr ? "Carnet d'adresses" : "Address book"}</option>
                {savedAddresses.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {entry.label} - {entry.city}
                  </option>
                ))}
              </select>
              {selectedAddressId && (
                <button
                  type="button"
                  onClick={() => void removeAddress(selectedAddressId)}
                  className="w-fit rounded-full border border-rose-400/40 px-3 py-1 text-[11px] text-rose-200"
                >
                  {isFr ? "Supprimer cette adresse" : "Delete this address"}
                </button>
              )}
            </div>
          )}

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
            <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
              <input
                className="rounded-xl border border-white/10 bg-zinc-900/70 px-4 py-3 text-sm text-white outline-none"
                placeholder={isFr ? "Nom de l'adresse (optionnel)" : "Address name (optional)"}
                value={addressLabel}
                onChange={(e) => setAddressLabel(e.target.value)}
              />
              <button
                type="button"
                onClick={() => void saveCurrentAddress()}
                className="rounded-xl border border-white/20 px-4 py-3 text-xs font-semibold text-white"
              >
                {isFr ? "Enregistrer" : "Save"}
              </button>
            </div>
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

      {error && <p className="mt-4 text-sm text-rose-300">{error}</p>}

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

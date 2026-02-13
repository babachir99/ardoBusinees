"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type PaymentMethod = "WAVE" | "ORANGE_MONEY" | "CARD" | "CASH";

type GpTripPublisherProps = {
  locale: string;
  canPublish: boolean;
  defaultContactPhone?: string | null;
};

type FormState = {
  originCity: string;
  originAddress: string;
  destinationCity: string;
  destinationAddress: string;
  airline: string;
  flightNumber: string;
  flightDate: string;
  deliveryStartAt: string;
  deliveryEndAt: string;
  availableKg: string;
  pricePerKgCents: string;
  maxPackages: string;
  contactPhone: string;
  notes: string;
  acceptedPaymentMethods: PaymentMethod[];
};

const paymentOptions: Array<{ value: PaymentMethod; fr: string; en: string }> = [
  { value: "WAVE", fr: "Wave", en: "Wave" },
  { value: "ORANGE_MONEY", fr: "Orange Money", en: "Orange Money" },
  { value: "CARD", fr: "Carte", en: "Card" },
  { value: "CASH", fr: "Especes", en: "Cash" },
];

function initialState(defaultContactPhone?: string | null): FormState {
  return {
    originCity: "",
    originAddress: "",
    destinationCity: "",
    destinationAddress: "",
    airline: "",
    flightNumber: "",
    flightDate: "",
    deliveryStartAt: "",
    deliveryEndAt: "",
    availableKg: "",
    pricePerKgCents: "",
    maxPackages: "",
    contactPhone: defaultContactPhone ?? "",
    notes: "",
    acceptedPaymentMethods: ["WAVE", "ORANGE_MONEY"],
  };
}

export default function GpTripPublisher({
  locale,
  canPublish,
  defaultContactPhone,
}: GpTripPublisherProps) {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(() => initialState(defaultContactPhone));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const t = useMemo(
    () => ({
      title: locale === "fr" ? "Publier un trajet GP" : "Publish a GP trip",
      subtitle:
        locale === "fr"
          ? "Annonce ton trajet, tes kilos disponibles et ton tarif au kg."
          : "Publish your route, available kilos and price per kg.",
      forbidden:
        locale === "fr"
          ? "Activez le role Transporteur pour publier sur GP."
          : "Enable the Transporter role to publish on GP.",
      submit: locale === "fr" ? "Publier" : "Publish",
      publishing: locale === "fr" ? "Publication..." : "Publishing...",
      success: locale === "fr" ? "Trajet publie avec succes." : "Trip published successfully.",
      required:
        locale === "fr"
          ? "Veuillez remplir tous les champs obligatoires."
          : "Please fill in all required fields.",
      serverError: locale === "fr" ? "Erreur lors de la publication" : "Failed to publish trip",
    }),
    [locale]
  );

  const updateField = (key: keyof FormState, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const togglePayment = (method: PaymentMethod) => {
    setForm((prev) => {
      const exists = prev.acceptedPaymentMethods.includes(method);
      if (exists) {
        return {
          ...prev,
          acceptedPaymentMethods: prev.acceptedPaymentMethods.filter((entry) => entry !== method),
        };
      }

      return {
        ...prev,
        acceptedPaymentMethods: [...prev.acceptedPaymentMethods, method],
      };
    });
  };

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    if (!canPublish) {
      setError(t.forbidden);
      return;
    }

    if (
      !form.originCity ||
      !form.originAddress ||
      !form.destinationCity ||
      !form.destinationAddress ||
      !form.airline ||
      !form.flightNumber ||
      !form.flightDate ||
      !form.availableKg ||
      !form.pricePerKgCents ||
      form.acceptedPaymentMethods.length === 0
    ) {
      setError(t.required);
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch("/api/gp/trips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          availableKg: Number(form.availableKg),
          pricePerKgCents: Number(form.pricePerKgCents),
          maxPackages: form.maxPackages ? Number(form.maxPackages) : undefined,
          notes: form.notes || undefined,
          contactPhone: form.contactPhone || undefined,
          deliveryStartAt: form.deliveryStartAt || undefined,
          deliveryEndAt: form.deliveryEndAt || undefined,
        }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error || t.serverError);
      }

      setForm(initialState(defaultContactPhone));
      setSuccess(t.success);
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : t.serverError);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-white">{t.title}</h2>
        <p className="mt-1 text-xs text-zinc-400">{t.subtitle}</p>
      </div>

      {!canPublish && <p className="text-xs text-amber-300">{t.forbidden}</p>}

      <div className="grid gap-3 md:grid-cols-2">
        <input
          value={form.originCity}
          onChange={(event) => updateField("originCity", event.target.value)}
          className="rounded-xl border border-white/10 bg-zinc-950/70 px-3 py-2 text-sm text-white"
          placeholder={locale === "fr" ? "Ville de depart" : "Departure city"}
        />
        <input
          value={form.destinationCity}
          onChange={(event) => updateField("destinationCity", event.target.value)}
          className="rounded-xl border border-white/10 bg-zinc-950/70 px-3 py-2 text-sm text-white"
          placeholder={locale === "fr" ? "Ville d'arrivee" : "Arrival city"}
        />
        <input
          value={form.originAddress}
          onChange={(event) => updateField("originAddress", event.target.value)}
          className="rounded-xl border border-white/10 bg-zinc-950/70 px-3 py-2 text-sm text-white"
          placeholder={locale === "fr" ? "Adresse de depart" : "Departure address"}
        />
        <input
          value={form.destinationAddress}
          onChange={(event) => updateField("destinationAddress", event.target.value)}
          className="rounded-xl border border-white/10 bg-zinc-950/70 px-3 py-2 text-sm text-white"
          placeholder={locale === "fr" ? "Adresse d'arrivee" : "Arrival address"}
        />
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <input
          value={form.airline}
          onChange={(event) => updateField("airline", event.target.value)}
          className="rounded-xl border border-white/10 bg-zinc-950/70 px-3 py-2 text-sm text-white"
          placeholder={locale === "fr" ? "Compagnie" : "Airline"}
        />
        <input
          value={form.flightNumber}
          onChange={(event) => updateField("flightNumber", event.target.value)}
          className="rounded-xl border border-white/10 bg-zinc-950/70 px-3 py-2 text-sm uppercase text-white"
          placeholder={locale === "fr" ? "Numero de vol" : "Flight number"}
        />
        <input
          type="datetime-local"
          value={form.flightDate}
          onChange={(event) => updateField("flightDate", event.target.value)}
          className="rounded-xl border border-white/10 bg-zinc-950/70 px-3 py-2 text-sm text-white"
        />
        <input
          type="datetime-local"
          value={form.deliveryStartAt}
          onChange={(event) => updateField("deliveryStartAt", event.target.value)}
          className="rounded-xl border border-white/10 bg-zinc-950/70 px-3 py-2 text-sm text-white"
          placeholder={locale === "fr" ? "Debut livraison" : "Delivery start"}
        />
        <input
          type="datetime-local"
          value={form.deliveryEndAt}
          onChange={(event) => updateField("deliveryEndAt", event.target.value)}
          className="rounded-xl border border-white/10 bg-zinc-950/70 px-3 py-2 text-sm text-white"
          placeholder={locale === "fr" ? "Fin livraison" : "Delivery end"}
        />
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <input
          type="number"
          min={1}
          value={form.availableKg}
          onChange={(event) => updateField("availableKg", event.target.value)}
          className="rounded-xl border border-white/10 bg-zinc-950/70 px-3 py-2 text-sm text-white"
          placeholder={locale === "fr" ? "Kilos disponibles" : "Available kilos"}
        />
        <input
          type="number"
          min={1}
          value={form.pricePerKgCents}
          onChange={(event) => updateField("pricePerKgCents", event.target.value)}
          className="rounded-xl border border-white/10 bg-zinc-950/70 px-3 py-2 text-sm text-white"
          placeholder={locale === "fr" ? "Prix par kilo (FCFA)" : "Price per kilo (FCFA)"}
        />
        <input
          type="number"
          min={1}
          value={form.maxPackages}
          onChange={(event) => updateField("maxPackages", event.target.value)}
          className="rounded-xl border border-white/10 bg-zinc-950/70 px-3 py-2 text-sm text-white"
          placeholder={locale === "fr" ? "Nombre max de colis" : "Max number of parcels"}
        />
        <input
          value={form.contactPhone}
          onChange={(event) => updateField("contactPhone", event.target.value)}
          className="rounded-xl border border-white/10 bg-zinc-950/70 px-3 py-2 text-sm text-white"
          placeholder={locale === "fr" ? "Numero de contact" : "Contact phone"}
        />
      </div>

      <textarea
        value={form.notes}
        onChange={(event) => updateField("notes", event.target.value)}
        className="min-h-[84px] w-full rounded-xl border border-white/10 bg-zinc-950/70 px-3 py-2 text-sm text-white"
        placeholder={locale === "fr" ? "Infos complementaires" : "Additional notes"}
      />

      <div className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-zinc-400">
          {locale === "fr" ? "Paiements acceptes" : "Accepted payments"}
        </p>
        <div className="flex flex-wrap gap-2">
          {paymentOptions.map((option) => {
            const selected = form.acceptedPaymentMethods.includes(option.value);
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => togglePayment(option.value)}
                className={`rounded-full border px-3 py-1 text-xs transition ${
                  selected
                    ? "border-emerald-300/60 bg-emerald-400/15 text-emerald-100"
                    : "border-white/10 text-zinc-300 hover:border-white/30"
                }`}
              >
                {locale === "fr" ? option.fr : option.en}
              </button>
            );
          })}
        </div>
      </div>

      {error && <p className="text-xs text-rose-300">{error}</p>}
      {success && <p className="text-xs text-emerald-300">{success}</p>}

      <button
        type="submit"
        disabled={submitting || !canPublish}
        className="rounded-full bg-emerald-400 px-5 py-2 text-sm font-semibold text-zinc-950 transition disabled:cursor-not-allowed disabled:opacity-40"
      >
        {submitting ? t.publishing : t.submit}
      </button>
    </form>
  );
}

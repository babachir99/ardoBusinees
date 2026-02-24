"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { isEligibleForGP } from "@/lib/orchestratorEligibility";

type PaymentMethod = "WAVE" | "ORANGE_MONEY" | "CARD" | "CASH";
type TripCurrency = "XOF" | "EUR" | "USD";

type GpTripPublisherProps = {
  locale: string;
  canPublish: boolean;
  gpDisplayName?: string | null;
  defaultContactPhone?: string | null;
  defaultPaymentMethods?: PaymentMethod[] | null;
  onPublished?: () => void;
};

type FormState = {
  originCity: string;
  originAddress: string;
  destinationCity: string;
  destinationAddress: string;
  departureDate: string;
  arrivalDate: string;
  deliveryStartAt: string;
  deliveryEndAt: string;
  availableKg: string;
  price: string;
  currency: TripCurrency;
  maxPackages: string;
  contactPhone: string;
  notes: string;
  acceptedPaymentMethods: PaymentMethod[];
};

type OrchestratorIntent = {
  id: string;
  intentType: "TRANSPORT" | "LOCAL_DELIVERY" | "SERVICE_REQUEST";
  objectType: "DOCUMENTS" | "SMALL_PARCEL" | "PARTS" | "KEYS" | "NONE";
  weightKg: number | null;
  fromCountry: string | null;
  toCountry: string | null;
  fromCity: string | null;
  toCity: string | null;
  status: "OPEN" | "MATCHED" | "CLOSED" | "EXPIRED";
  targetVertical?: string | null;
  targetEntityId?: string | null;
};

const paymentOptions: Array<{ value: PaymentMethod; fr: string; en: string }> = [
  { value: "WAVE", fr: "Wave", en: "Wave" },
  { value: "ORANGE_MONEY", fr: "Orange Money", en: "Orange Money" },
  { value: "CARD", fr: "Carte bancaire", en: "Card" },
  { value: "CASH", fr: "Especes", en: "Cash" },
];

const currencyOptions: Array<{ value: TripCurrency; label: string; symbol: string }> = [
  { value: "XOF", label: "XOF / FCFA", symbol: "FCFA" },
  { value: "EUR", label: "EUR", symbol: "EUR" },
  { value: "USD", label: "USD", symbol: "$" },
];

const currencySymbolMap: Record<TripCurrency, string> = {
  XOF: "FCFA",
  EUR: "EUR",
  USD: "$",
};

function initialState(
  defaultContactPhone?: string | null,
  defaultPaymentMethods?: PaymentMethod[] | null
): FormState {
  const allowedMethods = new Set<PaymentMethod>(["WAVE", "ORANGE_MONEY", "CARD", "CASH"]);
  const cleanedPaymentMethods = (defaultPaymentMethods ?? []).filter(
    (method): method is PaymentMethod => allowedMethods.has(method)
  );

  return {
    originCity: "",
    originAddress: "",
    destinationCity: "",
    destinationAddress: "",
    departureDate: "",
    arrivalDate: "",
    deliveryStartAt: "",
    deliveryEndAt: "",
    availableKg: "",
    price: "",
    currency: "XOF",
    maxPackages: "",
    contactPhone: defaultContactPhone ?? "",
    notes: "",
    acceptedPaymentMethods:
      cleanedPaymentMethods.length > 0 ? cleanedPaymentMethods : ["WAVE", "ORANGE_MONEY"],
  };
}

export default function GpTripPublisher({
  locale,
  canPublish,
  gpDisplayName,
  defaultContactPhone,
  defaultPaymentMethods,
  onPublished,
}: GpTripPublisherProps) {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(() =>
    initialState(defaultContactPhone, defaultPaymentMethods)
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const searchParams = useSearchParams();
  const [intentSummary, setIntentSummary] = useState<OrchestratorIntent | null>(null);
  const [intentLoaded, setIntentLoaded] = useState(false);
  const [intentPrefilled, setIntentPrefilled] = useState(false);
  const [createdTripId, setCreatedTripId] = useState<string | null>(null);
  const [attachingIntent, setAttachingIntent] = useState(false);
  const [intentAttachState, setIntentAttachState] = useState<"attached" | "resolved" | "forbidden" | null>(null);

  const t = useMemo(
    () => ({
      title: locale === "fr" ? "Publier un trajet GP" : "Publish a GP trip",
      subtitle:
        locale === "fr"
          ? "Renseigne le trajet, le depart et le tarif dans la devise de ton choix."
          : "Set route, departure and pricing in your preferred currency.",
      forbidden:
        locale === "fr"
          ? "Activez le role Transporteur pour publier sur GP."
          : "Enable the Transporter role to publish on GP.",
      submit: locale === "fr" ? "Publier le trajet" : "Publish trip",
      publishing: locale === "fr" ? "Publication..." : "Publishing...",
      success: locale === "fr" ? "Trajet publie avec succes." : "Trip published successfully.",
      required:
        locale === "fr"
          ? "Veuillez remplir tous les champs obligatoires."
          : "Please fill in all required fields.",
      invalidPrice:
        locale === "fr"
          ? "Le prix doit etre superieur a 0."
          : "Price must be greater than 0.",
      invalidDateOrder:
        locale === "fr"
          ? "La date d'arrivee doit etre superieure ou egale a la date de depart."
          : "Arrival date must be after or equal to departure date.",
      serverError: locale === "fr" ? "Erreur lors de la publication" : "Failed to publish trip",
      intentBadgeTitle: locale === "fr" ? "Intention liee" : "Linked intent",
      intentAttach: locale === "fr" ? "Associer l'intention" : "Attach intent",
      intentAttached: locale === "fr" ? "Intention associee au trajet." : "Intent attached to trip.",
      intentAlreadyResolved:
        locale === "fr"
          ? "Intention deja traitee."
          : "Intent already handled",
      intentAttachForbidden:
        locale === "fr"
          ? "Non autorise a associer cette intention."
          : "Not allowed to attach this intent",
      intentAttachError: locale === "fr" ? "Impossible d'associer l'intention." : "Unable to attach intent.",
      intentSummaryHint: locale === "fr" ? "Pre-remplissage GP depuis orchestrateur (manuel)." : "GP prefill from orchestrator (manual).",
      objectType: locale === "fr" ? "Objet" : "Object",
      fromTo: locale === "fr" ? "Trajet" : "Route",
      weight: locale === "fr" ? "Poids" : "Weight",
      intentAttachedState: locale === "fr" ? "Intention associee" : "Intent attached",
      intentHandledState: locale === "fr" ? "Intention traitee" : "Intent handled",
      intentForbiddenState: locale === "fr" ? "Association refusee" : "Attach blocked",
      groupRoute: locale === "fr" ? "1. Trajet" : "1. Route",
      groupTariff: locale === "fr" ? "2. Tarif" : "2. Pricing",
      groupCapacity: locale === "fr" ? "3. Capacite" : "3. Capacity",
      groupContact: locale === "fr" ? "4. Livraison & contact" : "4. Delivery & contact",
      groupNotes: locale === "fr" ? "5. Notes" : "5. Notes",
    }),
    [locale]
  );

  function objectTypeLabel(value: OrchestratorIntent["objectType"]) {
    if (locale === "fr") {
      if (value === "SMALL_PARCEL") return "Petit colis";
      if (value === "PARTS") return "Pieces";
      if (value === "KEYS") return "Cles";
      if (value === "DOCUMENTS") return "Documents";
      return "Aucun";
    }
    if (value === "SMALL_PARCEL") return "Small parcel";
    if (value === "PARTS") return "Parts";
    if (value === "KEYS") return "Keys";
    if (value === "DOCUMENTS") return "Documents";
    return "None";
  }

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
      !form.departureDate ||
      !form.availableKg ||
      !form.price ||
      form.acceptedPaymentMethods.length === 0
    ) {
      setError(t.required);
      return;
    }

    const parsedPrice = Number(form.price);
    if (!Number.isFinite(parsedPrice) || parsedPrice <= 0) {
      setError(t.invalidPrice);
      return;
    }

    if (form.arrivalDate && form.arrivalDate < form.departureDate) {
      setError(t.invalidDateOrder);
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch("/api/gp/trips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          price: Math.trunc(parsedPrice),
          availableKg: Number(form.availableKg),
          maxPackages: form.maxPackages ? Number(form.maxPackages) : undefined,
          notes: form.notes || undefined,
          contactPhone: form.contactPhone || undefined,
          departureDate: form.departureDate,
          arrivalDate: form.arrivalDate || undefined,
          deliveryStartAt: form.deliveryStartAt || undefined,
          deliveryEndAt: form.deliveryEndAt || undefined,
        }),
      });

      const body = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(body?.error || t.serverError);
      }

      const tripId = typeof body?.id === "string" ? body.id : null;
      setCreatedTripId(tripId);
      setForm(initialState(defaultContactPhone, defaultPaymentMethods));
      setSuccess(t.success);
      router.refresh();
      if (!(intentSummary && intentSummary.status === "OPEN" && tripId)) {
        onPublished?.();
      }
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : t.serverError);
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass =
    "h-11 w-full rounded-xl border border-white/10 bg-zinc-950/70 px-3 text-sm text-white outline-none transition focus:border-indigo-300/60 focus:ring-2 focus:ring-indigo-300/20";

  const currencySymbol = currencySymbolMap[form.currency];

  useEffect(() => {
    const intentIdRaw = searchParams.get("intentId")?.trim();
    if (!intentIdRaw) {
      setIntentLoaded(true);
      return;
    }

    const intentId = intentIdRaw;
    let cancelled = false;

    async function loadIntent() {
      try {
        const response = await fetch(`/api/orchestrator/intents/${encodeURIComponent(intentId)}`, {
          cache: "no-store",
        });

        if (!response.ok) {
          if (!cancelled) {
            setIntentSummary(null);
            setIntentLoaded(true);
          }
          return;
        }

        const body = (await response.json().catch(() => null)) as { intent?: OrchestratorIntent } | null;
        const intent = body?.intent;
        if (!intent || intent.status !== "OPEN" || !isEligibleForGP(intent)) {
          if (!cancelled) {
            setIntentSummary(null);
            setIntentLoaded(true);
          }
          return;
        }

        if (!cancelled) {
          setIntentSummary(intent);
          setIntentLoaded(true);
        }
      } catch {
        if (!cancelled) {
          setIntentSummary(null);
          setIntentLoaded(true);
        }
      }
    }

    void loadIntent();
    return () => {
      cancelled = true;
    };
  }, [searchParams]);

  useEffect(() => {
    if (!intentSummary || intentPrefilled) return;

    setForm((prev) => ({
      ...prev,
      originCity: prev.originCity || (intentSummary.fromCity ?? ""),
      destinationCity: prev.destinationCity || (intentSummary.toCity ?? ""),
      availableKg:
        prev.availableKg ||
        (typeof intentSummary.weightKg === "number" && Number.isFinite(intentSummary.weightKg)
          ? String(Math.max(1, Math.trunc(intentSummary.weightKg)))
          : ""),
      notes:
        prev.notes ||
        (intentSummary.objectType && intentSummary.objectType !== "NONE"
          ? `${locale === "fr" ? "Objet intention: " : "Intent object: "}${intentSummary.objectType}`
          : ""),
    }));
    setIntentPrefilled(true);
  }, [intentSummary, intentPrefilled, locale]);

  useEffect(() => {
    setIntentAttachState(null);
  }, [intentSummary?.id, createdTripId]);

  async function attachIntentToTrip() {
    if (!intentSummary?.id || !createdTripId) return;

    setAttachingIntent(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(`/api/orchestrator/intents/${intentSummary.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "MATCHED", targetVertical: "GP", targetEntityId: createdTripId }),
      });

      const body = (await response.json().catch(() => null)) as { message?: string; intent?: OrchestratorIntent } | null;
      if (!response.ok) {
        if (response.status === 400 || response.status === 409) {
          setIntentAttachState("resolved");
          setSuccess(t.intentAlreadyResolved);
          if (body?.intent) {
            setIntentSummary(body.intent);
          }
          return;
        }
        if (response.status === 403) {
          setIntentAttachState("forbidden");
          setSuccess(t.intentAttachForbidden);
          return;
        }
        setError(body?.message ?? t.intentAttachError);
        return;
      }

      setIntentSummary(body?.intent ?? { ...intentSummary, status: "MATCHED", targetVertical: "GP", targetEntityId: createdTripId });
      setIntentAttachState("attached");
      setSuccess(t.intentAttached);
      onPublished?.();
    } catch {
      setError(t.intentAttachError);
    } finally {
      setAttachingIntent(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <div>
        {gpDisplayName ? (
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-200">
            {locale === "fr" ? `Salut ${gpDisplayName}` : `Hi ${gpDisplayName}`}
          </p>
        ) : null}
        <h2 className="mt-1 text-lg font-semibold text-white">{t.title}</h2>
        <p className="mt-1 text-xs text-zinc-400">{t.subtitle}</p>
      </div>

      {!canPublish && <p className="text-xs text-amber-300">{t.forbidden}</p>}

      {intentSummary && intentLoaded ? (
        <section className="space-y-3 rounded-2xl border border-cyan-300/20 bg-cyan-300/5 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-200">{t.intentBadgeTitle}</p>
              <p className="mt-1 text-xs text-zinc-300">{t.intentSummaryHint}</p>
            </div>
            <span className="rounded-full border border-cyan-300/30 bg-cyan-300/10 px-2.5 py-1 text-[11px] font-medium text-cyan-100">
              {intentAttachState === "attached" ? t.intentAttachedState : intentAttachState === "resolved" ? t.intentHandledState : intentAttachState === "forbidden" ? t.intentForbiddenState : intentSummary.status}
            </span>
          </div>
          <div className="grid gap-2 text-xs text-zinc-300 md:grid-cols-3">
            <p>
              <span className="text-zinc-400">{t.fromTo}: </span>
              {(intentSummary.fromCity ?? "-") + " -> " + (intentSummary.toCity ?? "-")}
            </p>
            <p>
              <span className="text-zinc-400">{t.objectType}: </span>
              {objectTypeLabel(intentSummary.objectType)}
            </p>
            <p>
              <span className="text-zinc-400">{t.weight}: </span>
              {typeof intentSummary.weightKg === "number" ? `${intentSummary.weightKg} kg` : "-"}
            </p>
          </div>
          {createdTripId && intentSummary.status === "OPEN" && intentAttachState === null ? (
            <button
              type="button"
              onClick={() => void attachIntentToTrip()}
              disabled={attachingIntent}
              className="h-10 rounded-xl border border-cyan-300/30 bg-cyan-300/10 px-4 text-sm font-medium text-cyan-100 transition hover:bg-cyan-300/20 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {attachingIntent ? `${t.intentAttach}...` : t.intentAttach}
            </button>
          ) : null}
        </section>
      ) : null}

      <section className="space-y-3 rounded-2xl border border-white/10 bg-zinc-950/50 p-4">
        <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-300">{t.groupRoute}</h3>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="space-y-1.5">
            <span className="text-xs text-zinc-400">{locale === "fr" ? "Ville de depart *" : "Departure city *"}</span>
            <input
              value={form.originCity}
              onChange={(event) => updateField("originCity", event.target.value)}
              className={inputClass}
              placeholder={locale === "fr" ? "Ex: Dakar" : "Ex: Dakar"}
            />
          </label>
          <label className="space-y-1.5">
            <span className="text-xs text-zinc-400">{locale === "fr" ? "Ville d'arrivee *" : "Arrival city *"}</span>
            <input
              value={form.destinationCity}
              onChange={(event) => updateField("destinationCity", event.target.value)}
              className={inputClass}
              placeholder={locale === "fr" ? "Ex: Paris" : "Ex: Paris"}
            />
          </label>
          <label className="space-y-1.5">
            <span className="text-xs text-zinc-400">{locale === "fr" ? "Adresse de depart *" : "Departure address *"}</span>
            <input
              value={form.originAddress}
              onChange={(event) => updateField("originAddress", event.target.value)}
              className={inputClass}
            />
          </label>
          <label className="space-y-1.5">
            <span className="text-xs text-zinc-400">{locale === "fr" ? "Adresse d'arrivee *" : "Arrival address *"}</span>
            <input
              value={form.destinationAddress}
              onChange={(event) => updateField("destinationAddress", event.target.value)}
              className={inputClass}
            />
          </label>
          <label className="space-y-1.5">
            <span className="text-xs text-zinc-400">{locale === "fr" ? "Date de depart *" : "Departure date *"}</span>
            <input
              type="date"
              value={form.departureDate}
              onChange={(event) => updateField("departureDate", event.target.value)}
              className={inputClass}
            />
          </label>
          <label className="space-y-1.5">
            <span className="text-xs text-zinc-400">{locale === "fr" ? "Date d'arrivee" : "Arrival date"}</span>
            <input
              type="date"
              value={form.arrivalDate}
              onChange={(event) => updateField("arrivalDate", event.target.value)}
              className={inputClass}
            />
          </label>
        </div>
      </section>

      <section className="space-y-3 rounded-2xl border border-white/10 bg-zinc-950/50 p-4">
        <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-300">{t.groupTariff}</h3>
        <div className="grid gap-3 md:grid-cols-3">
          <label className="space-y-1.5 md:col-span-2">
            <span className="text-xs text-zinc-400">{locale === "fr" ? "Prix *" : "Price *"}</span>
            <div className="relative">
              <input
                type="number"
                min={0}
                step={1}
                value={form.price}
                onChange={(event) => updateField("price", event.target.value)}
                className={`${inputClass} pr-16`}
              />
              <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-zinc-300">
                {currencySymbol}
              </span>
            </div>
          </label>
          <label className="space-y-1.5">
            <span className="text-xs text-zinc-400">{locale === "fr" ? "Devise *" : "Currency *"}</span>
            <select
              value={form.currency}
              onChange={(event) => updateField("currency", event.target.value)}
              className={inputClass}
            >
              {currencyOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label} ({option.symbol})
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <section className="space-y-3 rounded-2xl border border-white/10 bg-zinc-950/50 p-4">
        <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-300">{t.groupCapacity}</h3>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="space-y-1.5">
            <span className="text-xs text-zinc-400">{locale === "fr" ? "Kilos disponibles *" : "Available kilos *"}</span>
            <input
              type="number"
              min={1}
              value={form.availableKg}
              onChange={(event) => updateField("availableKg", event.target.value)}
              className={inputClass}
            />
          </label>
          <label className="space-y-1.5">
            <span className="text-xs text-zinc-400">{locale === "fr" ? "Nombre max de colis" : "Max parcels"}</span>
            <input
              type="number"
              min={1}
              value={form.maxPackages}
              onChange={(event) => updateField("maxPackages", event.target.value)}
              className={inputClass}
            />
          </label>
        </div>
        <div className="space-y-2">
          <p className="text-xs text-zinc-400">{locale === "fr" ? "Paiements acceptes *" : "Accepted payments *"}</p>
          <div className="flex flex-wrap gap-2">
            {paymentOptions.map((option) => {
              const selected = form.acceptedPaymentMethods.includes(option.value);
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => togglePayment(option.value)}
                  className={`rounded-full border px-3 py-1.5 text-xs transition ${
                    selected
                      ? "border-cyan-300/60 bg-cyan-300/20 text-cyan-100"
                      : "border-white/10 text-zinc-300 hover:border-white/40"
                  }`}
                >
                  {locale === "fr" ? option.fr : option.en}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <section className="space-y-3 rounded-2xl border border-white/10 bg-zinc-950/50 p-4">
        <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-300">{t.groupContact}</h3>
        <div className="grid gap-3 md:grid-cols-3">
          <label className="space-y-1.5 md:col-span-1">
            <span className="text-xs text-zinc-400">{locale === "fr" ? "Telephone contact" : "Contact phone"}</span>
            <input
              value={form.contactPhone}
              onChange={(event) => updateField("contactPhone", event.target.value)}
              className={inputClass}
            />
          </label>
          <label className="space-y-1.5 md:col-span-1">
            <span className="text-xs text-zinc-400">{locale === "fr" ? "Debut livraison" : "Delivery start"}</span>
            <input
              type="datetime-local"
              value={form.deliveryStartAt}
              onChange={(event) => updateField("deliveryStartAt", event.target.value)}
              className={inputClass}
            />
          </label>
          <label className="space-y-1.5 md:col-span-1">
            <span className="text-xs text-zinc-400">{locale === "fr" ? "Fin livraison" : "Delivery end"}</span>
            <input
              type="datetime-local"
              value={form.deliveryEndAt}
              onChange={(event) => updateField("deliveryEndAt", event.target.value)}
              className={inputClass}
            />
          </label>
        </div>
      </section>

      <section className="space-y-3 rounded-2xl border border-white/10 bg-zinc-950/50 p-4">
        <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-300">{t.groupNotes}</h3>
        <label className="space-y-1.5">
          <span className="text-xs text-zinc-400">{locale === "fr" ? "Informations complementaires" : "Additional notes"}</span>
          <textarea
            value={form.notes}
            onChange={(event) => updateField("notes", event.target.value)}
            className="min-h-[96px] w-full rounded-xl border border-white/10 bg-zinc-950/70 px-3 py-2 text-sm text-white outline-none transition focus:border-indigo-300/60 focus:ring-2 focus:ring-indigo-300/20"
          />
        </label>
      </section>

      {error && <p className="text-xs text-rose-300">{error}</p>}
      {success && <p className="text-xs text-emerald-300">{success}</p>}

      <button
        type="submit"
        disabled={submitting || !canPublish}
        className="h-11 rounded-xl bg-gradient-to-r from-indigo-400 to-cyan-400 px-5 text-sm font-semibold text-zinc-950 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {submitting ? t.publishing : t.submit}
      </button>
    </form>
  );
}

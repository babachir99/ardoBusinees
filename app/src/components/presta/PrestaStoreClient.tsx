"use client";

import { type FormEvent, useEffect, useMemo, useState } from "react";
import UserProfileDrawer from "@/components/trust/UserProfileDrawer";
import PrestaNeedSuggestions from "@/components/presta/PrestaNeedSuggestions";
import PrestaNeedProposalsPanel from "@/components/presta/PrestaNeedProposalsPanel";
import PrestaProviderMatchingPanel from "@/components/presta/PrestaProviderMatchingPanel";
import PrestaProviderProposalsPanel from "@/components/presta/PrestaProviderProposalsPanel";
import PrestaFiltersBar, { type PrestaFiltersValue } from "@/components/presta/PrestaFiltersBar";
import PrestaDetailsDrawer, { type PrestaDetailsItem } from "@/components/presta/PrestaDetailsDrawer";
import CountryPhoneField from "@/components/forms/CountryPhoneField";
import { buildFormDefaults, normalizePhoneInput } from "@/lib/forms/prefill";
import { getDialCode } from "@/lib/locale/country";

type PrestaService = {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  city: string | null;
  basePriceCents: number;
  currency: string;
  acceptedPaymentMethods: string[];
  createdAt?: string | null;
  provider: {
    id: string;
    name: string | null;
    image: string | null;
  };
  contactLocked: boolean;
  contactUnlockStatusHint: string | null;
  contactPhone?: string | null;
};

type PrestaNeed = {
  id: string;
  customerId: string;
  title: string;
  description: string;
  city: string | null;
  area: string | null;
  budgetCents: number | null;
  currency: string;
  preferredDate: string | null;
  status: "OPEN" | "IN_REVIEW" | "ACCEPTED" | "CLOSED" | "CANCELED";
  createdAt: string;
  customer: {
    id: string;
    name: string | null;
    image: string | null;
  };
};

type BookingTarget = {
  id: string;
  title: string;
};

type Props = {
  locale: string;
  isLoggedIn: boolean;
  canPublish: boolean;
  currentUserId?: string | null;
  currentUserRole?: string | null;
};

type ProfilePayload = {
  phone?: string | null;
};

type GeoPayload = {
  geoCountry?: string | null;
};

const paymentMethods = ["WAVE", "ORANGE_MONEY", "CARD", "CASH"] as const;

function formatAmount(value: number | null, currency: string) {
  if (value === null) return "-";
  const label = currency === "XOF" ? "FCFA" : currency;
  return `${value} ${label}`;
}

function shortDescription(value: string | null) {
  if (!value) return "";
  if (value.length <= 110) return value;
  return `${value.slice(0, 107)}...`;
}

function formatDateLabel(value: string | null, locale: string) {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleDateString(locale === "fr" ? "fr-FR" : "en-US");
}

function toErrorMessage(data: unknown, fallback: string) {
  const asRecord = data && typeof data === "object" ? (data as Record<string, unknown>) : null;
  if (typeof asRecord?.message === "string") return asRecord.message;
  if (typeof asRecord?.error === "string") return asRecord.error;
  return fallback;
}

function needStatusLabel(status: PrestaNeed["status"], locale: string) {
  if (locale !== "fr") return status;
  const labels: Record<PrestaNeed["status"], string> = {
    OPEN: "Ouvert",
    IN_REVIEW: "En revue",
    ACCEPTED: "Assigne",
    CLOSED: "Clos",
    CANCELED: "Annule",
  };
  return labels[status] ?? status;
}

function needStatusClasses(status: PrestaNeed["status"]) {
  switch (status) {
    case "OPEN":
      return "border-emerald-300/45 bg-emerald-300/12 text-emerald-100";
    case "IN_REVIEW":
      return "border-amber-300/45 bg-amber-300/12 text-amber-100";
    case "ACCEPTED":
      return "border-sky-300/45 bg-sky-300/12 text-sky-100";
    case "CLOSED":
      return "border-white/25 bg-white/8 text-zinc-200";
    case "CANCELED":
      return "border-rose-300/45 bg-rose-300/12 text-rose-100";
    default:
      return "border-white/25 bg-white/8 text-zinc-200";
  }
}

export default function PrestaStoreClient({
  locale,
  isLoggedIn,
  canPublish,
  currentUserId,
  currentUserRole,
}: Props) {
  const [tab, setTab] = useState<"offers" | "needs" | "provider">("offers");

  const [services, setServices] = useState<PrestaService[]>([]);
  const [needs, setNeeds] = useState<PrestaNeed[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [filters, setFilters] = useState<PrestaFiltersValue>({
    query: "",
    city: "",
    category: "",
    budgetMin: "",
    budgetMax: "",
    sort: "recommended",
  });
  const [offersVisible, setOffersVisible] = useState(12);
  const [needsVisible, setNeedsVisible] = useState(12);
  const [showBackTop, setShowBackTop] = useState(false);

  const [formTitle, setFormTitle] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formPrice, setFormPrice] = useState("");
  const [formCurrency, setFormCurrency] = useState("XOF");
  const [formContactPhone, setFormContactPhone] = useState("");
  const initialPhoneDefaults = buildFormDefaults({
    sessionUser: null,
    geoCountry: null,
  });
  const [serviceContactPhone, setServiceContactPhone] = useState({
    country: initialPhoneDefaults.country,
    dialCode: initialPhoneDefaults.dialCode || getDialCode(initialPhoneDefaults.country),
    phoneNational: initialPhoneDefaults.phoneNational,
  });
  const [formMethods, setFormMethods] = useState<string[]>(["CASH"]);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [submittingService, setSubmittingService] = useState(false);

  const [needTitle, setNeedTitle] = useState("");
  const [needDescription, setNeedDescription] = useState("");
  const [needCity, setNeedCity] = useState("");
  const [needArea, setNeedArea] = useState("");
  const [needBudget, setNeedBudget] = useState("");
  const [needCurrency, setNeedCurrency] = useState("XOF");
  const [needPreferredDate, setNeedPreferredDate] = useState("");
  const [needError, setNeedError] = useState<string | null>(null);
  const [needSuccess, setNeedSuccess] = useState<string | null>(null);
  const [submittingNeed, setSubmittingNeed] = useState(false);
  const [showNeedForm, setShowNeedForm] = useState(false);
  const [selectedNeedForProposals, setSelectedNeedForProposals] = useState<string | null>(null);
  const [showProviderProposalsPanel, setShowProviderProposalsPanel] = useState(false);
  const [providerPanelView, setProviderPanelView] = useState<"proposals" | "payouts">("proposals");

  const [bookingService, setBookingService] = useState<BookingTarget | null>(null);
  const [selectedServiceProfile, setSelectedServiceProfile] = useState<PrestaService | null>(null);
  const [bookingMessage, setBookingMessage] = useState("");
  const [bookingMethod, setBookingMethod] = useState("WAVE");
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [bookingSubmitting, setBookingSubmitting] = useState(false);
  const [detailsItem, setDetailsItem] = useState<PrestaDetailsItem | null>(null);

  const isAdmin = currentUserRole === "ADMIN";
  const isFr = locale === "fr";

  async function loadServices() {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/presta/services", {
        method: "GET",
        cache: "no-store",
      });

      const data = await response.json().catch(() => []);

      if (!response.ok) {
        setError(toErrorMessage(data, "Unable to load services"));
        return;
      }

      setServices(Array.isArray(data) ? data : []);
    } catch {
      setError("Unable to load services");
    } finally {
      setLoading(false);
    }
  }

  async function loadNeeds() {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/presta/needs?take=24", {
        method: "GET",
        cache: "no-store",
      });

      const data = await response.json().catch(() => []);

      if (!response.ok) {
        setError(toErrorMessage(data, "Unable to load needs"));
        return;
      }

      setNeeds(Array.isArray(data) ? data : []);
    } catch {
      setError("Unable to load needs");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (tab === "offers") {
      loadServices();
      return;
    }

    if (tab === "needs") {
      loadNeeds();
      return;
    }

    setLoading(false);
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  useEffect(() => {
    let cancelled = false;

    const loadContactDefaults = async () => {
      const [profileRes, geoRes] = await Promise.all([
        fetch("/api/profile", { cache: "no-store" }).catch(() => null),
        fetch("/api/meta/geo", { cache: "no-store" }).catch(() => null),
      ]);

      const profile = profileRes?.ok
        ? ((await profileRes.json().catch(() => null)) as ProfilePayload | null)
        : null;
      const geo = geoRes?.ok
        ? ((await geoRes.json().catch(() => null)) as GeoPayload | null)
        : null;

      const defaults = buildFormDefaults({
        sessionUser: { phone: profile?.phone ?? null },
        geoCountry: geo?.geoCountry ?? null,
      });

      if (cancelled) return;

      setServiceContactPhone((prev) => ({
        country: defaults.country,
        dialCode: defaults.dialCode || getDialCode(defaults.country),
        phoneNational: prev.phoneNational || defaults.phoneNational,
      }));

      if (defaults.fullPhoneE164) {
        setFormContactPhone((current) => current || defaults.fullPhoneE164 || "");
      }
    };

    void loadContactDefaults();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const onScroll = () => {
      setShowBackTop(window.scrollY > 700);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    setOffersVisible(12);
    setNeedsVisible(12);
  }, [filters, tab]);

  function goToLogin() {
    const callbackUrl = encodeURIComponent(window.location.pathname + window.location.search);
    window.location.href = `/${locale}/login?callbackUrl=${callbackUrl}`;
  }

  function togglePaymentMethod(method: string) {
    setFormMethods((current) => {
      if (current.includes(method)) {
        const next = current.filter((entry) => entry !== method);
        return next.length > 0 ? next : ["CASH"];
      }
      return [...current, method];
    });
  }

  function handleServiceContactPhoneChange(next: {
    country: string;
    dialCode: string;
    phoneNational: string;
  }) {
    setServiceContactPhone(next);
    const normalized = normalizePhoneInput(next);
    setFormContactPhone(normalized.validBasic ? normalized.e164 : next.phoneNational.trim());
  }

  async function handleCreateService(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setFormSuccess(null);

    if (!canPublish) {
      setFormError("Forbidden");
      return;
    }

    const parsedPrice = Number(formPrice);
    if (!Number.isFinite(parsedPrice) || parsedPrice <= 0) {
      setFormError("Prix invalide");
      return;
    }

    setSubmittingService(true);
    try {
      const normalizedContact = normalizePhoneInput(serviceContactPhone);
      const finalContactPhone = normalizedContact.validBasic
        ? normalizedContact.e164
        : formContactPhone.trim();

      const response = await fetch("/api/presta/services", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: formTitle,
          description: formDescription,
          basePriceCents: Math.trunc(parsedPrice),
          currency: formCurrency,
          acceptedPaymentMethods: formMethods,
          contactPhone: finalContactPhone || undefined,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setFormError(toErrorMessage(data, "Creation failed"));
        return;
      }

      setFormTitle("");
      setFormDescription("");
      setFormPrice("");
      setFormCurrency("XOF");
      setFormContactPhone("");
      setServiceContactPhone((prev) => ({ ...prev, phoneNational: "" }));
      setFormMethods(["CASH"]);
      setFormSuccess("Service cree");
      await loadServices();
    } catch {
      setFormError("Creation failed");
    } finally {
      setSubmittingService(false);
    }
  }

  async function handleCreateNeed(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNeedError(null);
    setNeedSuccess(null);

    if (!isLoggedIn) {
      setNeedError(locale === "fr" ? "Connexion requise" : "Login required");
      return;
    }

    const normalizedTitle = needTitle.trim();
    const normalizedDescription = needDescription.trim();

    if (!normalizedTitle || !normalizedDescription) {
      setNeedError(locale === "fr" ? "Titre et description obligatoires" : "Title and description are required");
      return;
    }

    if (normalizedTitle.length > 140 || normalizedDescription.length > 3000) {
      setNeedError(locale === "fr" ? "Texte trop long" : "Text is too long");
      return;
    }

    const parsedBudget = needBudget ? Number(needBudget) : null;
    const parsedBudgetValue = parsedBudget ?? undefined;
    if (parsedBudgetValue !== undefined && (!Number.isFinite(parsedBudgetValue) || parsedBudgetValue < 0)) {
      setNeedError(locale === "fr" ? "Budget invalide" : "Invalid budget");
      return;
    }

    setSubmittingNeed(true);

    try {
      const response = await fetch("/api/presta/needs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: normalizedTitle,
          description: normalizedDescription,
          city: needCity || undefined,
          area: needArea || undefined,
          budgetCents: parsedBudgetValue !== undefined ? Math.trunc(parsedBudgetValue) : undefined,
          currency: needCurrency,
          preferredDate: needPreferredDate || undefined,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setNeedError(toErrorMessage(data, "Need publish failed"));
        return;
      }

      setNeedTitle("");
      setNeedDescription("");
      setNeedCity("");
      setNeedArea("");
      setNeedBudget("");
      setNeedCurrency("XOF");
      setNeedPreferredDate("");
      setNeedSuccess(locale === "fr" ? "Besoin publie" : "Need published");
      setShowNeedForm(false);
      await loadNeeds();
    } catch {
      setNeedError("Need publish failed");
    } finally {
      setSubmittingNeed(false);
    }
  }

  function openNeedComposer() {
    if (!isLoggedIn) {
      goToLogin();
      return;
    }

    setNeedError(null);
    setNeedSuccess(null);
    setShowNeedForm((current) => !current);
  }

  async function handleBookingSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!bookingService) return;

    setBookingSubmitting(true);
    setBookingError(null);

    try {
      const response = await fetch(`/api/presta/services/${bookingService.id}/bookings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: bookingMessage,
          paymentMethod: bookingMethod,
          provider: "provider_pending",
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setBookingError(toErrorMessage(data, "Booking failed"));
        return;
      }

      setBookingService(null);
      setBookingMessage("");
      setBookingMethod("WAVE");
      setFormSuccess(`Booking cree: ${(data as { booking?: { id?: string } })?.booking?.id ?? "OK"}`);
      await loadServices();
    } catch {
      setBookingError("Booking failed");
    } finally {
      setBookingSubmitting(false);
    }
  }

  function openBooking(service: BookingTarget) {
    if (!isLoggedIn) {
      goToLogin();
      return;
    }

    setBookingError(null);
    setBookingService(service);
  }

  async function handleRefresh() {
    if (tab === "provider") return;
    setRefreshing(true);
    try {
      if (tab === "offers") {
        await loadServices();
      } else {
        await loadNeeds();
      }
    } finally {
      setRefreshing(false);
    }
  }

  const cityOptions = useMemo(() => {
    const source =
      tab === "offers"
        ? services.map((service) => service.city)
        : needs.map((need) => need.city ?? need.area);
    return Array.from(
      new Set(source.filter((entry): entry is string => Boolean(entry)))
    ).sort((a, b) => a.localeCompare(b));
  }, [tab, services, needs]);

  const categoryOptions = useMemo(() => {
    return Array.from(
      new Set(
        services
          .map((service) => service.category)
          .filter((entry): entry is string => Boolean(entry))
      )
    ).sort((a, b) => a.localeCompare(b));
  }, [services]);

  const filteredServices = useMemo(() => {
    const query = filters.query.trim().toLowerCase();
    const city = filters.city.trim().toLowerCase();
    const category = filters.category.trim().toLowerCase();
    const budgetMin = Number(filters.budgetMin);
    const budgetMax = Number(filters.budgetMax);

    const list = services.filter((service) => {
      if (query) {
        const haystack = [
          service.title,
          service.description ?? "",
          service.category ?? "",
          service.city ?? "",
          service.provider.name ?? "",
        ]
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(query)) return false;
      }

      if (city && (service.city ?? "").toLowerCase() !== city) return false;
      if (category && (service.category ?? "").toLowerCase() !== category) return false;

      if (filters.budgetMin && Number.isFinite(budgetMin) && service.basePriceCents < budgetMin) {
        return false;
      }

      if (filters.budgetMax && Number.isFinite(budgetMax) && service.basePriceCents > budgetMax) {
        return false;
      }

      return true;
    });

    if (filters.sort === "priceAsc") {
      return [...list].sort((a, b) => a.basePriceCents - b.basePriceCents);
    }

    if (filters.sort === "priceDesc") {
      return [...list].sort((a, b) => b.basePriceCents - a.basePriceCents);
    }

    if (filters.sort === "newest") {
      return [...list].sort((a, b) => {
        const right = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        const left = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        return right - left;
      });
    }

    return list;
  }, [filters, services]);

  const filteredNeeds = useMemo(() => {
    const query = filters.query.trim().toLowerCase();
    const city = filters.city.trim().toLowerCase();
    const budgetMin = Number(filters.budgetMin);
    const budgetMax = Number(filters.budgetMax);

    const list = needs.filter((need) => {
      if (query) {
        const haystack = [
          need.title,
          need.description,
          need.city ?? "",
          need.area ?? "",
          need.customer?.name ?? "",
        ]
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(query)) return false;
      }

      if (city) {
        const cityMatch =
          (need.city ?? "").toLowerCase() === city || (need.area ?? "").toLowerCase() === city;
        if (!cityMatch) return false;
      }

      if (filters.budgetMin && Number.isFinite(budgetMin) && (need.budgetCents ?? 0) < budgetMin) {
        return false;
      }

      if (filters.budgetMax && Number.isFinite(budgetMax) && (need.budgetCents ?? 0) > budgetMax) {
        return false;
      }

      return true;
    });

    if (filters.sort === "priceAsc") {
      return [...list].sort((a, b) => (a.budgetCents ?? 0) - (b.budgetCents ?? 0));
    }

    if (filters.sort === "priceDesc") {
      return [...list].sort((a, b) => (b.budgetCents ?? 0) - (a.budgetCents ?? 0));
    }

    if (filters.sort === "newest") {
      return [...list].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }

    return list;
  }, [filters, needs]);

  const visibleServices = useMemo(
    () => filteredServices.slice(0, offersVisible),
    [filteredServices, offersVisible]
  );
  const visibleNeeds = useMemo(() => filteredNeeds.slice(0, needsVisible), [filteredNeeds, needsVisible]);

  const shouldShowServiceEmpty = !loading && tab === "offers" && filteredServices.length === 0;
  const shouldShowNeedEmpty = !loading && tab === "needs" && filteredNeeds.length === 0;

  const openServiceDetails = (service: PrestaService) => {
    setDetailsItem({
      kind: "offer",
      id: service.id,
      title: service.title,
      description: service.description,
      category: service.category,
      city: service.city,
      createdAt: formatDateLabel(service.createdAt ?? null, locale),
      statusLabel:
        service.contactUnlockStatusHint === "BLOCKED_USER"
          ? isFr
            ? "Interaction bloquee"
            : "Interaction blocked"
          : isFr
            ? "Disponible"
            : "Available",
      priceLabel: formatAmount(service.basePriceCents, service.currency),
      providerName: service.provider.name ?? (isFr ? "Prestataire" : "Provider"),
      paymentMethods: service.acceptedPaymentMethods,
    });
  };

  const openNeedDetails = (need: PrestaNeed) => {
    setDetailsItem({
      kind: "need",
      id: need.id,
      title: need.title,
      description: need.description,
      city: need.city,
      area: need.area,
      createdAt: formatDateLabel(need.createdAt, locale),
      preferredDate: formatDateLabel(need.preferredDate, locale),
      statusLabel: needStatusLabel(need.status, locale),
      budgetLabel: formatAmount(need.budgetCents, need.currency),
      customerName: need.customer?.name ?? (isFr ? "Client" : "Customer"),
    });
  };

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-6 scroll-smooth">
      <section className="rounded-2xl border border-white/10 bg-zinc-900/70 p-3">
        <div className="inline-flex flex-wrap gap-2 rounded-full border border-white/10 bg-zinc-950/70 p-1">
          <button
            type="button"
            onClick={() => setTab("offers")}
            className={`rounded-full px-4 py-1 text-xs font-semibold transition ${
              tab === "offers" ? "bg-emerald-400 text-zinc-950" : "text-zinc-300"
            }`}
          >
            {locale === "fr" ? "Offres" : "Offers"}
          </button>
          <button
            type="button"
            onClick={() => setTab("needs")}
            className={`rounded-full px-4 py-1 text-xs font-semibold transition ${
              tab === "needs" ? "bg-emerald-400 text-zinc-950" : "text-zinc-300"
            }`}
          >
            {locale === "fr" ? "Besoins" : "Needs"}
          </button>
          {canPublish && (
            <button
              type="button"
              onClick={() => setTab("provider")}
              className={`rounded-full px-4 py-1 text-xs font-semibold transition ${
                tab === "provider" ? "bg-emerald-400 text-zinc-950" : "text-zinc-300"
              }`}
            >
              {locale === "fr" ? "Je suis prestataire" : "Provider mode"}
            </button>
          )}
        </div>
      </section>

      {tab !== "provider" ? (
        <PrestaFiltersBar
          locale={locale}
          value={filters}
          cities={cityOptions}
          categories={tab === "offers" ? categoryOptions : []}
          onChange={(next) => setFilters((current) => ({ ...current, ...next }))}
          onReset={() =>
            setFilters({
              query: "",
              city: "",
              category: "",
              budgetMin: "",
              budgetMax: "",
              sort: "recommended",
            })
          }
        />
      ) : null}

      {tab === "offers" && canPublish && (
        <section className="rounded-2xl border border-white/10 bg-zinc-900/70 p-4">
          <h2 className="text-base font-semibold text-white">{isFr ? "Creer un service" : "Create a service"}</h2>
          <form className="mt-4 grid gap-3 md:grid-cols-2" onSubmit={handleCreateService}>
            <label className="flex flex-col gap-1 text-xs text-zinc-300">
              {isFr ? "Titre" : "Title"}
              <input className="h-10 rounded-lg border border-white/10 bg-zinc-950 px-3 text-sm text-white" value={formTitle} onChange={(event) => setFormTitle(event.target.value)} required />
            </label>
            <label className="flex flex-col gap-1 text-xs text-zinc-300">
              {isFr ? "Prix" : "Price"}
              <input type="number" min={1} className="h-10 rounded-lg border border-white/10 bg-zinc-950 px-3 text-sm text-white" value={formPrice} onChange={(event) => setFormPrice(event.target.value)} required />
            </label>
            <label className="md:col-span-2 flex flex-col gap-1 text-xs text-zinc-300">
              Description
              <textarea className="min-h-20 rounded-lg border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-white" value={formDescription} onChange={(event) => setFormDescription(event.target.value)} />
            </label>
            <label className="flex flex-col gap-1 text-xs text-zinc-300">
              Devise
              <select className="h-10 rounded-lg border border-white/10 bg-zinc-950 px-3 text-sm text-white" value={formCurrency} onChange={(event) => setFormCurrency(event.target.value)}>
                <option value="XOF">XOF</option>
                <option value="EUR">EUR</option>
                <option value="USD">USD</option>
              </select>
            </label>
            <div className="flex flex-col gap-1 text-xs text-zinc-300">
              <span>{isFr ? "Contact (optionnel)" : "Contact (optional)"}</span>
              <CountryPhoneField
                value={serviceContactPhone}
                locale={locale}
                onChange={handleServiceContactPhoneChange}
              />
            </div>
            <div className="md:col-span-2 flex flex-wrap gap-2">
              {paymentMethods.map((method) => (
                <label key={method} className="inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-1 text-xs text-zinc-200">
                  <input type="checkbox" checked={formMethods.includes(method)} onChange={() => togglePaymentMethod(method)} />
                  {method}
                </label>
              ))}
            </div>
            <div className="md:col-span-2 flex items-center gap-3">
              <button type="submit" disabled={submittingService} className="rounded-lg bg-emerald-400 px-4 py-2 text-sm font-semibold text-zinc-950 disabled:opacity-60">
                {submittingService ? (isFr ? "Envoi..." : "Sending...") : isFr ? "Publier" : "Publish"}
              </button>
              {formError && <p className="text-sm text-rose-300">{formError}</p>}
              {formSuccess && <p className="text-sm text-emerald-300">{formSuccess}</p>}
            </div>
          </form>
        </section>
      )}

      {tab === "needs" && (
        <section className="rounded-2xl border border-white/10 bg-zinc-900/70 p-4">
          <div className="rounded-2xl border border-emerald-300/25 bg-emerald-300/10 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-white">
                  {isFr ? "Besoin d'un professionnel pres de chez vous ?" : "Need a professional near you?"}
                </h2>
                <p className="mt-1 text-sm text-zinc-300">
                  {isFr ? "Publiez votre besoin et comparez rapidement les offres." : "Publish your need and compare offers quickly."}
                </p>
              </div>
              <button
                type="button"
                onClick={openNeedComposer}
                className="rounded-full bg-emerald-400 px-4 py-2 text-xs font-semibold text-zinc-950 transition hover:brightness-110"
              >
                {isFr ? "Creer mon besoin" : "Create my need"}
              </button>
            </div>
          </div>

          {!isLoggedIn && (
            <p className="mt-3 text-xs text-zinc-400">
              {isFr ? "Connecte-toi pour publier un besoin." : "Sign in to publish a need."}
            </p>
          )}

          {showNeedForm && isLoggedIn && (
            <form className="mt-4 grid gap-3 md:grid-cols-2" onSubmit={handleCreateNeed}>
              <label className="flex flex-col gap-1 text-xs text-zinc-300">
                Titre
                <input className="h-10 rounded-lg border border-white/10 bg-zinc-950 px-3 text-sm text-white" value={needTitle} onChange={(event) => setNeedTitle(event.target.value)} required maxLength={140} />
              </label>
              <label className="flex flex-col gap-1 text-xs text-zinc-300">
                Budget
                <input type="number" min={0} className="h-10 rounded-lg border border-white/10 bg-zinc-950 px-3 text-sm text-white" value={needBudget} onChange={(event) => setNeedBudget(event.target.value)} />
              </label>
              <label className="md:col-span-2 flex flex-col gap-1 text-xs text-zinc-300">
                Description
                <textarea className="min-h-20 rounded-lg border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-white" value={needDescription} onChange={(event) => setNeedDescription(event.target.value)} required maxLength={3000} />
              </label>
              <label className="flex flex-col gap-1 text-xs text-zinc-300">
                Ville
                <input className="h-10 rounded-lg border border-white/10 bg-zinc-950 px-3 text-sm text-white" value={needCity} onChange={(event) => setNeedCity(event.target.value)} />
              </label>
              <label className="flex flex-col gap-1 text-xs text-zinc-300">
                Zone
                <input className="h-10 rounded-lg border border-white/10 bg-zinc-950 px-3 text-sm text-white" value={needArea} onChange={(event) => setNeedArea(event.target.value)} />
              </label>
              <label className="flex flex-col gap-1 text-xs text-zinc-300">
                Devise
                <select className="h-10 rounded-lg border border-white/10 bg-zinc-950 px-3 text-sm text-white" value={needCurrency} onChange={(event) => setNeedCurrency(event.target.value)}>
                  <option value="XOF">XOF</option>
                  <option value="EUR">EUR</option>
                  <option value="USD">USD</option>
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs text-zinc-300">
                {locale === "fr" ? "Date souhaitee" : "Preferred date"}
                <input type="date" className="h-10 rounded-lg border border-white/10 bg-zinc-950 px-3 text-sm text-white" value={needPreferredDate} onChange={(event) => setNeedPreferredDate(event.target.value)} />
              </label>
              <div className="md:col-span-2 flex items-center gap-3">
                <button type="submit" disabled={submittingNeed} className="rounded-lg bg-emerald-400 px-4 py-2 text-sm font-semibold text-zinc-950 disabled:opacity-60">
                  {submittingNeed ? (isFr ? "Envoi..." : "Sending...") : isFr ? "Publier" : "Publish"}
                </button>
                {needError && <p className="text-sm text-rose-300">{needError}</p>}
                {needSuccess && <p className="text-sm text-emerald-300">{needSuccess}</p>}
              </div>
            </form>
          )}
        </section>
      )}

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-white">
            {tab === "offers"
              ? isFr
                ? "Offres PRESTA"
                : "PRESTA offers"
              : tab === "needs"
                ? isFr
                  ? "Besoins PRESTA"
                  : "PRESTA needs"
                : isFr
                  ? "Espace prestataire"
                  : "Provider space"}
          </h2>
          {tab !== "provider" ? (
            <div className="flex items-center gap-2">
              <span className="rounded-full border border-white/15 bg-zinc-950/70 px-3 py-1 text-xs text-zinc-300">
                {tab === "offers" ? `${visibleServices.length}/${filteredServices.length}` : `${visibleNeeds.length}/${filteredNeeds.length}`}
              </span>
              <button
                type="button"
                onClick={() => void handleRefresh()}
                className="inline-flex items-center gap-2 rounded-full border border-white/20 px-3 py-1.5 text-xs text-zinc-200 transition hover:border-white/40"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`}>
                  <path d="M20 11a8 8 0 1 0 2.2 5.5" />
                  <path d="M20 4v7h-7" />
                </svg>
                {isFr ? "Rafraichir" : "Refresh"}
              </button>
            </div>
          ) : null}
        </div>

        {tab !== "provider" && error && <p className="text-sm text-rose-300">{error}</p>}

        {tab === "offers" ? (
          <>
            {loading ? (
              <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                {Array.from({ length: 6 }).map((_, index) => (
                  <div key={index} className="h-56 animate-pulse rounded-2xl border border-white/10 bg-zinc-900/60" />
                ))}
              </div>
            ) : (
              <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                {visibleServices.map((service) => (
                  <article
                    key={service.id}
                    className="group flex h-full w-full max-w-md flex-col rounded-2xl border border-zinc-800 bg-zinc-900 p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-emerald-500/40 hover:shadow-xl hover:shadow-emerald-500/10"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="line-clamp-1 text-base font-semibold text-white">{service.title}</h3>
                      <p className="shrink-0 text-sm font-semibold text-emerald-300">
                        {formatAmount(service.basePriceCents, service.currency)}
                      </p>
                    </div>

                    <p className="mt-2 text-xs text-zinc-400">
                      {(service.category ?? (isFr ? "Sans categorie" : "No category")) + " • " + (service.city ?? "-") + " • " + (isFr ? "Disponible" : "Available")}
                    </p>

                    <p className="mt-3 line-clamp-2 text-sm text-zinc-300">
                      {shortDescription(service.description) || (isFr ? "Aucune description." : "No description.")}
                    </p>

                    <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
                      <span className="rounded-full border border-emerald-300/35 bg-emerald-300/12 px-2 py-0.5 text-emerald-100">
                        {isFr ? "Verifie" : "Verified"}
                      </span>
                      <span className="rounded-full border border-sky-300/35 bg-sky-300/10 px-2 py-0.5 text-sky-100">
                        {isFr ? "Repond vite" : "Fast reply"}
                      </span>
                      <span className="rounded-full border border-white/15 bg-white/5 px-2 py-0.5 text-zinc-200">
                        {isFr ? "Note en cours" : "Rating in progress"}
                      </span>
                    </div>

                    {service.contactUnlockStatusHint === "BLOCKED_USER" ? (
                      <p className="mt-3 text-xs text-rose-300">
                        {isFr
                          ? "Interaction bloquee (utilisateur bloque)."
                          : "Interaction blocked (blocked user)."}
                      </p>
                    ) : null}

                    {!service.contactLocked && service.contactPhone ? (
                      <p className="mt-2 text-xs text-zinc-400">Contact: {service.contactPhone}</p>
                    ) : null}

                    <div className="mt-auto flex gap-2 pt-4">
                      <button
                        type="button"
                        onClick={() => openBooking({ id: service.id, title: service.title })}
                        disabled={service.contactUnlockStatusHint === "BLOCKED_USER"}
                        className={`h-10 flex-1 rounded-xl text-sm font-medium transition active:scale-95 ${
                          service.contactUnlockStatusHint === "BLOCKED_USER"
                            ? "cursor-not-allowed bg-zinc-700/40 text-zinc-500"
                            : "bg-emerald-500 text-black hover:bg-emerald-600"
                        }`}
                      >
                        {isFr ? "Reserver" : "Book"}
                      </button>
                      <button
                        type="button"
                        onClick={() => openServiceDetails(service)}
                        className="h-10 rounded-xl border border-zinc-700 px-4 text-sm text-zinc-200 transition hover:border-zinc-500 active:scale-95"
                      >
                        {isFr ? "Details" : "Details"}
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}

            {shouldShowServiceEmpty ? (
              <div className="rounded-2xl border border-dashed border-white/15 bg-zinc-900/60 p-8 text-center">
                <p className="mx-auto grid h-10 w-10 place-items-center rounded-full border border-zinc-700 bg-zinc-900/70 text-zinc-300">
                  i
                </p>
                <h3 className="mt-2 text-lg font-semibold text-white">{isFr ? "Aucune offre trouvee" : "No offer found"}</h3>
                <p className="mt-2 text-sm text-zinc-400">
                  {isFr
                    ? "Essayez d'elargir vos filtres ou creez un besoin."
                    : "Try broadening your filters or create a need."}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setTab("needs");
                    setShowNeedForm(true);
                  }}
                  className="mt-4 rounded-full bg-emerald-400 px-4 py-2 text-sm font-semibold text-zinc-950 transition hover:brightness-110"
                >
                  {isFr ? "Publier un besoin" : "Publish a need"}
                </button>
              </div>
            ) : null}

            {filteredServices.length > visibleServices.length ? (
              <div className="flex justify-center pt-2">
                <button
                  type="button"
                  onClick={() => setOffersVisible((current) => current + 12)}
                  className="rounded-full border border-white/20 px-4 py-2 text-sm text-zinc-200 transition hover:border-white/40"
                >
                  {isFr ? "Afficher plus" : "Load more"}
                </button>
              </div>
            ) : null}
          </>
        ) : tab === "needs" ? (
          <>
            {loading ? (
              <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                {Array.from({ length: 6 }).map((_, index) => (
                  <div key={index} className="h-64 animate-pulse rounded-2xl border border-white/10 bg-zinc-900/60" />
                ))}
              </div>
            ) : (
              <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                {visibleNeeds.map((need) => (
                  <article key={need.id} className="flex h-full w-full max-w-md flex-col rounded-2xl border border-zinc-800 bg-zinc-900 p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-emerald-500/40 hover:shadow-xl hover:shadow-emerald-500/10">
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="line-clamp-1 text-base font-semibold text-white">{need.title}</h3>
                      <p className="shrink-0 text-sm font-semibold text-emerald-300">{formatAmount(need.budgetCents, need.currency)}</p>
                    </div>

                    <p className="mt-2 text-xs text-zinc-400">
                      {(need.city ?? need.area ?? "-") + " • " + (isFr ? "Date" : "Date") + ": " + formatDateLabel(need.preferredDate, locale)}
                    </p>

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <span className={`rounded-full border px-2 py-0.5 text-[11px] ${needStatusClasses(need.status)}`}>
                        {needStatusLabel(need.status, locale)}
                      </span>
                    </div>

                    <p className="mt-3 line-clamp-2 text-sm text-zinc-300">{shortDescription(need.description)}</p>

                    <div className="mt-auto pt-4">
                      <button
                        type="button"
                        onClick={() => openNeedDetails(need)}
                        className="h-10 rounded-xl border border-zinc-700 px-4 text-sm text-zinc-200 transition hover:border-zinc-500 active:scale-95"
                      >
                        {isFr ? "Details" : "Details"}
                      </button>

                      <PrestaNeedSuggestions
                        locale={locale}
                        needId={need.id}
                        isLoggedIn={isLoggedIn}
                        onRequireLogin={goToLogin}
                        onOpenBooking={openBooking}
                      />

                      {need.status === "OPEN" && (Boolean(currentUserId && currentUserId === need.customerId) || isAdmin) ? (
                        <button
                          type="button"
                          onClick={() => setSelectedNeedForProposals(need.id)}
                          className="mt-3 rounded-full border border-white/20 px-3 py-1.5 text-xs text-zinc-200 transition hover:border-white/40"
                        >
                          {isFr ? "Voir propositions" : "View proposals"}
                        </button>
                      ) : null}
                    </div>
                  </article>
                ))}
              </div>
            )}

            {shouldShowNeedEmpty ? (
              <div className="rounded-2xl border border-dashed border-white/15 bg-zinc-900/60 p-8 text-center">
                <p className="mx-auto grid h-10 w-10 place-items-center rounded-full border border-zinc-700 bg-zinc-900/70 text-zinc-300">
                  i
                </p>
                <h3 className="mt-2 text-lg font-semibold text-white">{isFr ? "Aucun besoin trouve" : "No need found"}</h3>
                <p className="mt-2 text-sm text-zinc-400">
                  {isFr
                    ? "Essayez d'elargir vos filtres ou publiez une nouvelle demande."
                    : "Try broader filters or publish a new request."}
                </p>
                <button
                  type="button"
                  onClick={openNeedComposer}
                  className="mt-4 rounded-full bg-emerald-400 px-4 py-2 text-sm font-semibold text-zinc-950 transition hover:brightness-110"
                >
                  {isFr ? "Creer mon besoin" : "Create my need"}
                </button>
              </div>
            ) : null}

            {filteredNeeds.length > visibleNeeds.length ? (
              <div className="flex justify-center pt-2">
                <button
                  type="button"
                  onClick={() => setNeedsVisible((current) => current + 12)}
                  className="rounded-full border border-white/20 px-4 py-2 text-sm text-zinc-200 transition hover:border-white/40"
                >
                  {isFr ? "Afficher plus" : "Load more"}
                </button>
              </div>
            ) : null}
          </>
        ) : (
          <div className="space-y-4">
            <div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setProviderPanelView("proposals");
                    setShowProviderProposalsPanel(true);
                  }}
                  className="rounded-lg border border-white/20 px-3 py-2 text-xs text-white"
                >
                  {locale === "fr" ? "Mes propositions" : "My proposals"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setProviderPanelView("payouts");
                    setShowProviderProposalsPanel(true);
                  }}
                  className="rounded-lg border border-white/20 px-3 py-2 text-xs text-white"
                >
                  {locale === "fr" ? "Mes payouts" : "My payouts"}
                </button>
              </div>
            </div>
            <PrestaProviderMatchingPanel locale={locale} isLoggedIn={isLoggedIn} enabled={canPublish} onRequireLogin={goToLogin} />
          </div>
        )}
      </section>

      <PrestaDetailsDrawer
        locale={locale}
        open={Boolean(detailsItem)}
        item={detailsItem}
        onClose={() => setDetailsItem(null)}
        onBook={
          detailsItem?.kind === "offer"
            ? () => {
                openBooking({ id: detailsItem.id, title: detailsItem.title });
                setDetailsItem(null);
              }
            : undefined
        }
        onViewProfile={
          detailsItem?.kind === "offer"
            ? () => {
                const service = services.find((entry) => entry.id === detailsItem.id);
                if (service) {
                  setSelectedServiceProfile(service);
                }
                setDetailsItem(null);
              }
            : undefined
        }
        onNeedPrimaryAction={detailsItem?.kind === "need" ? () => setDetailsItem(null) : undefined}
      />

      <UserProfileDrawer
        open={Boolean(selectedServiceProfile)}
        onClose={() => setSelectedServiceProfile(null)}
        locale={locale}
        userId={selectedServiceProfile?.provider.id}
        viewerUserId={currentUserId}
        name={selectedServiceProfile?.provider.name ?? (isFr ? "Prestataire" : "Provider")}
        avatarUrl={selectedServiceProfile?.provider.image ?? null}
        roleLabel={isFr ? "Prestataire" : "Provider"}
        reliabilityLabel={isFr ? "Fiabilite en progression" : "Reliability in progress"}
        details={
          selectedServiceProfile
            ? [
                {
                  label: isFr ? "Service" : "Service",
                  value: selectedServiceProfile.title,
                },
                {
                  label: isFr ? "Categorie" : "Category",
                  value: selectedServiceProfile.category ?? "-",
                },
                {
                  label: isFr ? "Ville" : "City",
                  value: selectedServiceProfile.city ?? "-",
                },
                {
                  label: isFr ? "Paiement" : "Payment",
                  value: selectedServiceProfile.acceptedPaymentMethods.join(", "),
                },
              ]
            : []
        }
        primaryAction={
          selectedServiceProfile && selectedServiceProfile.contactUnlockStatusHint !== "BLOCKED_USER"
            ? {
                label: isFr ? "Reserver ce service" : "Book this service",
                onClick: () => {
                  openBooking({
                    id: selectedServiceProfile.id,
                    title: selectedServiceProfile.title,
                  });
                  setSelectedServiceProfile(null);
                },
              }
            : undefined
        }
      >
        {selectedServiceProfile?.contactUnlockStatusHint === "BLOCKED_USER" ? (
          <p className="mt-3 text-xs text-rose-300">
            {isFr
              ? "Interaction bloquee (utilisateur bloque)."
              : "Interaction blocked (blocked user)."}
          </p>
        ) : null}
      </UserProfileDrawer>

      {selectedNeedForProposals && (
        <PrestaNeedProposalsPanel
          needId={selectedNeedForProposals}
          onClose={async () => {
            setSelectedNeedForProposals(null);
            await loadNeeds();
          }}
        />
      )}

      {showProviderProposalsPanel && (
        <PrestaProviderProposalsPanel
          initialView={providerPanelView}
          onClose={() => setShowProviderProposalsPanel(false)}
        />
      )}

      {bookingService && (
        <div className="fixed inset-0 z-[120] flex items-end justify-center bg-black/70 p-3 md:items-center" role="dialog" aria-modal="true">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-zinc-900 p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-white">Reserver: {bookingService.title}</h3>
              <button type="button" className="rounded-full border border-white/20 px-2 py-1 text-xs text-zinc-200" onClick={() => setBookingService(null)}>
                Fermer
              </button>
            </div>

            <form className="mt-4 space-y-3" onSubmit={handleBookingSubmit}>
              <label className="flex flex-col gap-1 text-xs text-zinc-300">
                Message
                <textarea className="min-h-20 rounded-lg border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-white" value={bookingMessage} onChange={(event) => setBookingMessage(event.target.value)} />
              </label>
              <label className="flex flex-col gap-1 text-xs text-zinc-300">
                Methode de paiement
                <select className="h-10 rounded-lg border border-white/10 bg-zinc-950 px-3 text-sm text-white" value={bookingMethod} onChange={(event) => setBookingMethod(event.target.value)}>
                  {paymentMethods.map((method) => (
                    <option key={method} value={method}>
                      {method}
                    </option>
                  ))}
                </select>
              </label>

              {bookingError && <p className="text-sm text-rose-300">{bookingError}</p>}

              <button type="submit" disabled={bookingSubmitting} className="w-full rounded-lg bg-emerald-400 px-4 py-2 text-sm font-semibold text-zinc-950 disabled:opacity-60">
                {bookingSubmitting ? "Envoi..." : "Confirmer la reservation"}
              </button>
            </form>
          </div>
        </div>
      )}

      {showBackTop ? (
        <button
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          className="fixed bottom-6 right-6 z-40 rounded-full border border-white/20 bg-zinc-950/85 px-3 py-2 text-xs font-semibold text-zinc-200 shadow-[0_12px_24px_rgba(0,0,0,0.35)] transition hover:border-emerald-300/45 hover:text-white"
        >
          {isFr ? "Retour en haut" : "Back to top"}
        </button>
      ) : null}
    </div>
  );
}




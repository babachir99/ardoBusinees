"use client";

import { type FormEvent, useMemo, useState } from "react";
import { Link, useRouter } from "@/i18n/navigation";
import { formatMoney } from "@/lib/format";

type PublisherSummary = {
  id: string;
  name: string;
  slug: string;
  verified: boolean;
  city: string | null;
  country: string | null;
  logoUrl: string | null;
};

type CarListingItem = {
  id: string;
  title: string;
  description: string;
  priceCents: number;
  currency: string;
  country: string;
  city: string;
  make: string;
  model: string;
  year: number;
  mileageKm: number;
  fuelType: "GASOLINE" | "DIESEL" | "HYBRID" | "ELECTRIC" | "LPG" | "OTHER";
  gearbox: "MANUAL" | "AUTO" | "OTHER";
  imageUrls: string[];
  status: "DRAFT" | "PUBLISHED" | "PAUSED" | "ARCHIVED";
  isFeatured: boolean;
  featuredUntil: string | null;
  boostUntil: string | null;
  createdAt: string;
  updatedAt: string;
  publisherId: string | null;
  publisher: PublisherSummary | null;
};

type DealerOption = PublisherSummary & {
  role: "OWNER" | "AGENT";
  includedPublishedQuota: number;
  extraSlots: number;
  usedPublishedCount: number;
  boostCredits: number;
  featuredCredits: number;
};

type CarMonetizationPurchase = {
  id: string;
  listingId: string | null;
  publisherId: string;
  kind: "FEATURED" | "BOOST" | "BOOST_PACK_10" | "FEATURED_PACK_4" | "EXTRA_SLOTS_10";
  status: "PENDING" | "CONFIRMED" | "FAILED" | "EXPIRED";
  createdAt: string;
};

type Props = {
  locale: string;
  canCreateDealerOnboarding: boolean;
  listings: CarListingItem[];
  dealers: DealerOption[];
  recentPurchases: CarMonetizationPurchase[];
};

type ListingForm = {
  title: string;
  description: string;
  priceCents: string;
  currency: string;
  country: string;
  city: string;
  make: string;
  model: string;
  year: string;
  mileageKm: string;
  fuelType: CarListingItem["fuelType"];
  gearbox: CarListingItem["gearbox"];
  publisherId: string;
  imageUrls: string;
};

type ListingMonetizationKind = "FEATURED" | "BOOST";
type PackMonetizationKind = "BOOST_PACK_10" | "FEATURED_PACK_4" | "EXTRA_SLOTS_10";

function parseImageUrlsInput(value: string): string[] {
  return Array.from(
    new Set(
      value
        .split(/[\n,]/)
        .map((item) => item.trim())
        .filter(Boolean)
    )
  );
}

function mergeImageUrlText(existing: string, incoming: string[]) {
  return Array.from(new Set([...parseImageUrlsInput(existing), ...incoming])).join("\n");
}

function emptyForm(): ListingForm {
  return {
    title: "",
    description: "",
    priceCents: "",
    currency: "XOF",
    country: "SN",
    city: "",
    make: "",
    model: "",
    year: "",
    mileageKm: "",
    fuelType: "GASOLINE",
    gearbox: "MANUAL",
    publisherId: "",
    imageUrls: "",
  };
}

export default function CarsMyDashboard({ locale, canCreateDealerOnboarding, listings: initialListings, dealers, recentPurchases }: Props) {
  const router = useRouter();
  const [listings, setListings] = useState(initialListings);
  const [createForm, setCreateForm] = useState<ListingForm>(emptyForm());
  const [edits, setEdits] = useState<Record<string, ListingForm>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusBusyId, setStatusBusyId] = useState<string | null>(null);
  const [uploadingTarget, setUploadingTarget] = useState<string | null>(null);
  const [monetizationPending, setMonetizationPending] = useState<Record<string, boolean>>({});
  const [message, setMessage] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [dealerCreateForm, setDealerCreateForm] = useState({ name: "", country: "SN", city: "" });
  const [dealerCreateOpen, setDealerCreateOpen] = useState(false);
  const [dealerCreateBusy, setDealerCreateBusy] = useState(false);
  const [agentManagerOpen, setAgentManagerOpen] = useState<Record<string, boolean>>({});
  const [agentAddByDealer, setAgentAddByDealer] = useState<Record<string, string>>({});
  const [agentAddBusyDealerId, setAgentAddBusyDealerId] = useState<string | null>(null);

  const t = useMemo(
    () => ({
      title: locale === "fr" ? "Mes annonces voitures" : "My car listings",
      create: locale === "fr" ? "Creer une annonce" : "Create listing",
      save: locale === "fr" ? "Enregistrer" : "Save",
      publish: locale === "fr" ? "Publier" : "Publish",
      pause: locale === "fr" ? "Mettre en pause" : "Pause",
      archive: locale === "fr" ? "Archiver" : "Archive",
      empty:
        locale === "fr"
          ? "Aucune annonce voiture. Creez votre premiere annonce."
          : "No car listing yet. Create your first listing.",
      created: locale === "fr" ? "Annonce creee." : "Listing created.",
      updated: locale === "fr" ? "Annonce mise a jour." : "Listing updated.",
      statusUpdated: locale === "fr" ? "Statut mis a jour." : "Status updated.",
      genericError: locale === "fr" ? "Erreur serveur." : "Server error.",
      titleLabel: locale === "fr" ? "Titre" : "Title",
      descriptionLabel: locale === "fr" ? "Description" : "Description",
      priceLabel: locale === "fr" ? "Prix (cents)" : "Price (cents)",
      currencyLabel: locale === "fr" ? "Devise" : "Currency",
      countryLabel: locale === "fr" ? "Pays" : "Country",
      cityLabel: locale === "fr" ? "Ville" : "City",
      makeLabel: locale === "fr" ? "Marque" : "Make",
      modelLabel: locale === "fr" ? "Modele" : "Model",
      yearLabel: locale === "fr" ? "Annee" : "Year",
      mileageLabel: locale === "fr" ? "Kilometrage" : "Mileage",
      fuelLabel: locale === "fr" ? "Carburant" : "Fuel",
      gearboxLabel: locale === "fr" ? "Boite" : "Gearbox",
      imagesLabel: locale === "fr" ? "Photos (URLs, une par ligne)" : "Photos (URLs, one per line)",
      uploadImages: locale === "fr" ? "Uploader des photos" : "Upload photos",
      uploading: locale === "fr" ? "Upload..." : "Uploading...",
      uploadSuccess: locale === "fr" ? "Photos ajoutees." : "Photos added.",
      dealerLabel: locale === "fr" ? "Concessionnaire" : "Dealer",
      individual: locale === "fr" ? "Particulier" : "Individual",
      draft: locale === "fr" ? "Brouillon" : "Draft",
      published: locale === "fr" ? "Publie" : "Published",
      paused: locale === "fr" ? "Pause" : "Paused",
      archived: locale === "fr" ? "Archive" : "Archived",
      createdAt: locale === "fr" ? "Cree le" : "Created",
      updateCard: locale === "fr" ? "Modifier" : "Update",
      myDealers: locale === "fr" ? "Mes concessions" : "My dealers",
      proBlockTitle: locale === "fr" ? "CARS Pro" : "CARS Pro",
      createDealer: locale === "fr" ? "Creer un concessionnaire" : "Create dealer",
      createDealerHint: locale === "fr" ? "Configure ta vitrine concessionnaire pour publier en pro et gerer tes agents." : "Set up your dealer storefront to publish as a pro and manage agents.",
      dealerNameLabel: locale === "fr" ? "Nom du concessionnaire" : "Dealer name",
      dealerCreated: locale === "fr" ? "Concessionnaire cree." : "Dealer created.",
      manageAgents: locale === "fr" ? "Gerer les agents" : "Manage agents",
      agentUserIdLabel: locale === "fr" ? "User ID agent" : "Agent user ID",
      addAgent: locale === "fr" ? "Ajouter agent" : "Add agent",
      agentAdded: locale === "fr" ? "Agent ajoute." : "Agent added.",
      dealerStorefront: locale === "fr" ? "Vitrine" : "Storefront",
      noDealerMember:
        locale === "fr"
          ? "Aucune adhesion concessionnaire active."
          : "No active dealer membership.",
      quota: locale === "fr" ? "Quota publie" : "Published quota",
      credits: locale === "fr" ? "Credits" : "Credits",
      buyBoostPack: locale === "fr" ? "Acheter Boost x10" : "Buy Boost x10",
      buyFeaturedPack: locale === "fr" ? "Acheter Mise en avant x4" : "Buy Featured x4",
      buyExtraSlots: locale === "fr" ? "Acheter +10 slots" : "Buy +10 slots",
      monetizationFeatured: locale === "fr" ? "Mettre en avant (7j)" : "Feature (7d)",
      monetizationBoost: locale === "fr" ? "Booster (3j)" : "Boost (3d)",
      monetizationFeaturedCredit: locale === "fr" ? "Utiliser credit mise en avant" : "Use featured credit",
      monetizationBoostCredit: locale === "fr" ? "Utiliser credit boost" : "Use boost credit",
      featuredUntilLabel: locale === "fr" ? "Mise en avant jusqu au" : "Featured until",
      boostUntilLabel: locale === "fr" ? "Boost jusqu au" : "Boost until",
      receipt: locale === "fr" ? "Recu" : "Receipt",
      retry: locale === "fr" ? "Reessayer" : "Retry",
      checkoutMissing: locale === "fr" ? "Checkout indisponible." : "Checkout unavailable.",
      creditApplied: locale === "fr" ? "Credit applique avec succes." : "Credit applied successfully.",
    }),
    [locale]
  );

  const dealerById = useMemo(() => new Map(dealers.map((dealer) => [dealer.id, dealer])), [dealers]);

  const latestListingPurchaseByKind = useMemo(() => {
    const map = new Map<string, CarMonetizationPurchase>();
    for (const purchase of recentPurchases) {
      if (!purchase.listingId) continue;
      const key = `${purchase.listingId}:${purchase.kind}`;
      if (!map.has(key)) map.set(key, purchase);
    }
    return map;
  }, [recentPurchases]);

  const latestDealerPurchaseByKind = useMemo(() => {
    const map = new Map<string, CarMonetizationPurchase>();
    for (const purchase of recentPurchases) {
      const key = `${purchase.publisherId}:${purchase.kind}`;
      if (!map.has(key)) map.set(key, purchase);
    }
    return map;
  }, [recentPurchases]);

  function purchaseStatusLabel(status: CarMonetizationPurchase["status"]) {
    if (status === "PENDING") return locale === "fr" ? "Paiement en attente" : "Payment pending";
    if (status === "CONFIRMED") return locale === "fr" ? "Paiement confirme" : "Payment confirmed";
    if (status === "FAILED") return locale === "fr" ? "Paiement echoue" : "Payment failed";
    return locale === "fr" ? "Paiement expire" : "Payment expired";
  }

  function getStatusLabel(status: CarListingItem["status"]) {
    if (status === "DRAFT") return t.draft;
    if (status === "PUBLISHED") return t.published;
    if (status === "PAUSED") return t.paused;
    return t.archived;
  }

  function listingFormFromItem(item: CarListingItem): ListingForm {
    return {
      title: item.title,
      description: item.description,
      priceCents: String(item.priceCents),
      currency: item.currency,
      country: item.country,
      city: item.city,
      make: item.make,
      model: item.model,
      year: String(item.year),
      mileageKm: String(item.mileageKm),
      fuelType: item.fuelType,
      gearbox: item.gearbox,
      publisherId: item.publisherId ?? "",
      imageUrls: item.imageUrls.join("\n"),
    };
  }

  function updateEditField(id: string, next: ListingForm) {
    setEdits((prev) => ({ ...prev, [id]: next }));
  }

  async function uploadImages(files: FileList | null, target: "create" | string) {
    if (!files || files.length === 0) return;

    setUploadingTarget(target);
    setErrorMsg("");
    setMessage("");

    try {
      const urls = await Promise.all(
        Array.from(files).map(async (file) => {
          const formData = new FormData();
          formData.set("file", file);

          const response = await fetch("/api/upload", {
            method: "POST",
            body: formData,
          });

          const body = (await response.json().catch(() => null)) as { error?: string; url?: string } | null;
          if (!response.ok || !body?.url) {
            throw new Error(body?.error ?? t.genericError);
          }

          return body.url;
        })
      );

      if (target === "create") {
        setCreateForm((prev) => ({
          ...prev,
          imageUrls: mergeImageUrlText(prev.imageUrls, urls),
        }));
      } else {
        const current = edits[target] ?? (() => {
          const listing = listings.find((item) => item.id === target);
          return listing ? listingFormFromItem(listing) : null;
        })();

        if (current) {
          updateEditField(target, {
            ...current,
            imageUrls: mergeImageUrlText(current.imageUrls, urls),
          });
        }
      }

      setMessage(t.uploadSuccess);
    } catch (error) {
      setErrorMsg(error instanceof Error ? error.message : t.genericError);
    } finally {
      setUploadingTarget(null);
    }
  }

  async function createListing(event: FormEvent) {
    event.preventDefault();
    setErrorMsg("");
    setMessage("");
    setIsSubmitting(true);

    const response = await fetch("/api/cars/listings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...createForm,
        priceCents: Number(createForm.priceCents),
        year: Number(createForm.year),
        mileageKm: Number(createForm.mileageKm),
        publisherId: createForm.publisherId || null,
        imageUrls: parseImageUrlsInput(createForm.imageUrls),
      }),
      cache: "no-store",
    }).catch(() => null);

    setIsSubmitting(false);

    if (!response) {
      setErrorMsg(t.genericError);
      return;
    }

    const json = (await response.json().catch(() => null)) as
      | { error?: string; message?: string; listing?: CarListingItem }
      | null;
    const createdListing = json?.listing;

    if (!response.ok || !createdListing?.id) {
      setErrorMsg(json?.message ?? t.genericError);
      return;
    }

    setListings((prev) => [createdListing, ...prev]);
    setCreateForm(emptyForm());
    setMessage(t.created);
  }

  async function saveListing(id: string) {
    const current = listings.find((item) => item.id === id);
    if (!current) return;
    const form = edits[id] ?? listingFormFromItem(current);

    setStatusBusyId(id);
    setErrorMsg("");
    setMessage("");

    const response = await fetch(`/api/cars/listings/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        priceCents: Number(form.priceCents),
        year: Number(form.year),
        mileageKm: Number(form.mileageKm),
        publisherId: form.publisherId || null,
        imageUrls: parseImageUrlsInput(form.imageUrls),
      }),
      cache: "no-store",
    }).catch(() => null);

    setStatusBusyId(null);

    if (!response) {
      setErrorMsg(t.genericError);
      return;
    }

    const json = (await response.json().catch(() => null)) as
      | { error?: string; message?: string; listing?: CarListingItem }
      | null;
    const updatedListing = json?.listing;

    if (!response.ok || !updatedListing?.id) {
      setErrorMsg(json?.message ?? t.genericError);
      return;
    }

    setListings((prev) => prev.map((item) => (item.id === id ? { ...item, ...updatedListing } : item)));
    setMessage(t.updated);
  }

  async function changeStatus(id: string, action: "publish" | "pause" | "archive") {
    setStatusBusyId(id);
    setErrorMsg("");
    setMessage("");

    const response =
      action === "publish"
        ? await fetch(`/api/cars/listings/${id}/publish`, {
            method: "POST",
            cache: "no-store",
          }).catch(() => null)
        : await fetch(`/api/cars/listings/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: action === "pause" ? "PAUSED" : "ARCHIVED" }),
            cache: "no-store",
          }).catch(() => null);

    setStatusBusyId(null);

    if (!response) {
      setErrorMsg(t.genericError);
      return;
    }

    const json = (await response.json().catch(() => null)) as
      | { error?: string; message?: string; listing?: CarListingItem }
      | null;
    const updatedListing = json?.listing;

    if (!response.ok || !updatedListing?.id) {
      setErrorMsg(json?.message ?? t.genericError);
      return;
    }

    setListings((prev) => prev.map((item) => (item.id === id ? { ...item, ...updatedListing } : item)));
    setMessage(t.statusUpdated);
  }

  async function startCheckout(
    pendingKey: string,
    payload: { kind: ListingMonetizationKind | PackMonetizationKind; listingId?: string; publisherId?: string }
  ) {
    setMonetizationPending((prev) => ({ ...prev, [pendingKey]: true }));
    setErrorMsg("");
    setMessage("");

    try {
      const response = await fetch("/api/cars/monetization/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const body = (await response.json().catch(() => null)) as
        | {
            message?: string;
            checkoutUrl?: string | null;
            appliedWithCredits?: boolean;
            listing?: { id: string; featuredUntil?: string | null; boostUntil?: string | null };
          }
        | null;

      if (!response.ok) {
        setErrorMsg(body?.message ?? t.genericError);
        return;
      }

      if (body?.appliedWithCredits) {
        setMessage(t.creditApplied);
        router.refresh();
        return;
      }

      if (body?.checkoutUrl) {
        window.location.href = body.checkoutUrl;
        return;
      }

      setMessage(t.checkoutMissing);
    } catch {
      setErrorMsg(t.genericError);
    } finally {
      setMonetizationPending((prev) => ({ ...prev, [pendingKey]: false }));
    }
  }

  async function applyCredit(listingId: string, kind: ListingMonetizationKind) {
    const pendingKey = `credit:${listingId}:${kind}`;
    setMonetizationPending((prev) => ({ ...prev, [pendingKey]: true }));
    setErrorMsg("");
    setMessage("");

    try {
      const response = await fetch("/api/cars/monetization/apply-credit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listingId, kind }),
      });

      const body = (await response.json().catch(() => null)) as
        | { message?: string }
        | null;

      if (!response.ok) {
        setErrorMsg(body?.message ?? t.genericError);
        return;
      }

      setMessage(t.creditApplied);
      router.refresh();
    } catch {
      setErrorMsg(t.genericError);
    } finally {
      setMonetizationPending((prev) => ({ ...prev, [pendingKey]: false }));
    }
  }

  function startMonetization(listingId: string, kind: ListingMonetizationKind) {
    void startCheckout(`listing:${listingId}:${kind}`, { listingId, kind });
  }

  function startPackPurchase(publisherId: string, kind: PackMonetizationKind) {
    void startCheckout(`pack:${publisherId}:${kind}`, { publisherId, kind });
  }

  async function createDealer() {
    if (!canCreateDealerOnboarding) return;

    setDealerCreateBusy(true);
    setErrorMsg("");
    setMessage("");

    try {
      const response = await fetch("/api/cars/publishers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: dealerCreateForm.name,
          country: dealerCreateForm.country,
          city: dealerCreateForm.city,
        }),
      });

      const body = (await response.json().catch(() => null)) as { message?: string } | null;
      if (!response.ok) {
        setErrorMsg(body?.message ?? t.genericError);
        return;
      }

      setMessage(t.dealerCreated);
      setDealerCreateOpen(false);
      setDealerCreateForm({ name: "", country: "SN", city: "" });
      router.refresh();
    } catch {
      setErrorMsg(t.genericError);
    } finally {
      setDealerCreateBusy(false);
    }
  }

  async function addAgent(dealerId: string) {
    const userId = (agentAddByDealer[dealerId] ?? "").trim();
    if (!userId) return;

    setAgentAddBusyDealerId(dealerId);
    setErrorMsg("");
    setMessage("");

    try {
      const response = await fetch(`/api/cars/publishers/${dealerId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, role: "AGENT" }),
      });

      const body = (await response.json().catch(() => null)) as { message?: string } | null;
      if (!response.ok) {
        setErrorMsg(body?.message ?? t.genericError);
        return;
      }

      setMessage(t.agentAdded);
      setAgentAddByDealer((prev) => ({ ...prev, [dealerId]: "" }));
    } catch {
      setErrorMsg(t.genericError);
    } finally {
      setAgentAddBusyDealerId(null);
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-white/10 bg-zinc-900/70 p-6">
        <h1 className="text-2xl font-semibold text-white">{t.title}</h1>
        {message ? <p className="mt-2 text-xs text-emerald-200">{message}</p> : null}
        {errorMsg ? <p className="mt-2 text-xs text-rose-200">{errorMsg}</p> : null}
      </section>

      <section className="rounded-3xl border border-white/10 bg-zinc-900/70 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-cyan-200">{t.proBlockTitle}</p>
            <h2 className="mt-1 text-sm font-semibold uppercase tracking-[0.2em] text-zinc-300">{t.myDealers}</h2>
          </div>
          {canCreateDealerOnboarding && dealers.length === 0 ? (
            <button
              type="button"
              onClick={() => setDealerCreateOpen((prev) => !prev)}
              className="rounded-full border border-cyan-300/40 px-3 py-1 text-xs font-semibold text-cyan-200"
            >
              {t.createDealer}
            </button>
          ) : null}
        </div>
        {canCreateDealerOnboarding && dealers.length === 0 && dealerCreateOpen ? (
          <div className="mt-4 rounded-2xl border border-cyan-300/20 bg-cyan-300/5 p-4">
            <p className="text-xs text-zinc-300">{t.createDealerHint}</p>
            <div className="mt-3 grid gap-2 md:grid-cols-3">
              <input value={dealerCreateForm.name} onChange={(event) => setDealerCreateForm((prev) => ({ ...prev, name: event.target.value }))} placeholder={t.dealerNameLabel} className="rounded-xl border border-white/15 bg-zinc-950/70 px-3 py-2 text-sm" />
              <input value={dealerCreateForm.city} onChange={(event) => setDealerCreateForm((prev) => ({ ...prev, city: event.target.value }))} placeholder={t.cityLabel} className="rounded-xl border border-white/15 bg-zinc-950/70 px-3 py-2 text-sm" />
              <input value={dealerCreateForm.country} onChange={(event) => setDealerCreateForm((prev) => ({ ...prev, country: event.target.value.toUpperCase() }))} placeholder={t.countryLabel} className="rounded-xl border border-white/15 bg-zinc-950/70 px-3 py-2 text-sm" />
              <button type="button" onClick={() => void createDealer()} disabled={dealerCreateBusy} className="md:col-span-3 rounded-xl border border-cyan-300/40 px-4 py-2 text-sm font-semibold text-cyan-200 disabled:opacity-60">
                {dealerCreateBusy ? "..." : t.createDealer}
              </button>
            </div>
          </div>
        ) : null}
        {dealers.length === 0 ? (
          <p className="mt-2 text-xs text-zinc-400">{t.noDealerMember}</p>
        ) : (
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {dealers.map((dealer) => (
              <article key={dealer.id} className="rounded-2xl border border-cyan-300/20 bg-cyan-300/5 p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-white">{dealer.name}</p>
                  <span className="text-[11px] text-cyan-100">{dealer.role}</span>
                </div>
                <p className="mt-1 text-xs text-zinc-300">{t.quota}: {dealer.usedPublishedCount}/{dealer.includedPublishedQuota + dealer.extraSlots}</p>
                <p className="mt-1 text-xs text-zinc-300">{t.credits}: boost={dealer.boostCredits}, featured={dealer.featuredCredits}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button type="button" onClick={() => startPackPurchase(dealer.id, "BOOST_PACK_10")} disabled={monetizationPending[`pack:${dealer.id}:BOOST_PACK_10`] === true} className="rounded-full border border-sky-300/40 px-3 py-1 text-xs font-semibold text-sky-100 disabled:opacity-60">{monetizationPending[`pack:${dealer.id}:BOOST_PACK_10`] ? "..." : t.buyBoostPack}</button>
                  <button type="button" onClick={() => startPackPurchase(dealer.id, "FEATURED_PACK_4")} disabled={monetizationPending[`pack:${dealer.id}:FEATURED_PACK_4`] === true} className="rounded-full border border-amber-300/40 px-3 py-1 text-xs font-semibold text-amber-100 disabled:opacity-60">{monetizationPending[`pack:${dealer.id}:FEATURED_PACK_4`] ? "..." : t.buyFeaturedPack}</button>
                  <button type="button" onClick={() => startPackPurchase(dealer.id, "EXTRA_SLOTS_10")} disabled={monetizationPending[`pack:${dealer.id}:EXTRA_SLOTS_10`] === true} className="rounded-full border border-emerald-300/40 px-3 py-1 text-xs font-semibold text-emerald-100 disabled:opacity-60">{monetizationPending[`pack:${dealer.id}:EXTRA_SLOTS_10`] ? "..." : t.buyExtraSlots}</button>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Link href={`/cars/dealers/${dealer.slug}`} className="rounded-full border border-white/20 px-3 py-1 text-xs font-semibold text-white">{t.dealerStorefront}</Link>
                  {dealer.role === "OWNER" ? (
                    <button
                      type="button"
                      onClick={() => setAgentManagerOpen((prev) => ({ ...prev, [dealer.id]: !prev[dealer.id] }))}
                      className="rounded-full border border-white/20 px-3 py-1 text-xs font-semibold text-white"
                    >
                      {t.manageAgents}
                    </button>
                  ) : null}
                </div>
                {dealer.role === "OWNER" && agentManagerOpen[dealer.id] ? (
                  <div className="mt-3 grid gap-2 md:grid-cols-[1fr_auto]">
                    <input
                      value={agentAddByDealer[dealer.id] ?? ""}
                      onChange={(event) => setAgentAddByDealer((prev) => ({ ...prev, [dealer.id]: event.target.value }))}
                      placeholder={t.agentUserIdLabel}
                      className="rounded-xl border border-white/15 bg-zinc-950/70 px-3 py-2 text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => void addAgent(dealer.id)}
                      disabled={agentAddBusyDealerId === dealer.id || !(agentAddByDealer[dealer.id] ?? "").trim()}
                      className="rounded-xl border border-cyan-300/40 px-4 py-2 text-sm font-semibold text-cyan-200 disabled:opacity-60"
                    >
                      {agentAddBusyDealerId === dealer.id ? "..." : t.addAgent}
                    </button>
                  </div>
                ) : null}
                <div className="mt-3 space-y-1 text-xs text-zinc-300">
                  {(["BOOST_PACK_10", "FEATURED_PACK_4", "EXTRA_SLOTS_10"] as const).map((kind) => {
                    const purchase = latestDealerPurchaseByKind.get(`${dealer.id}:${kind}`);
                    if (!purchase) return null;
                    return (
                      <div key={kind} className="flex flex-wrap items-center gap-2">
                        <span>{kind}: {purchaseStatusLabel(purchase.status)}</span>
                        {purchase.status !== "PENDING" ? <Link href={`/cars/my/receipts/${purchase.id}`} className="rounded-full border border-emerald-300/40 px-2 py-0.5 text-[10px] font-semibold text-emerald-100">{t.receipt}</Link> : null}
                        {purchase.status === "FAILED" ? <button type="button" onClick={() => startPackPurchase(dealer.id, kind)} className="rounded-full border border-white/20 px-2 py-0.5 text-[10px] font-semibold text-white">{t.retry}</button> : null}
                      </div>
                    );
                  })}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-3xl border border-white/10 bg-zinc-900/70 p-6">
        <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-300">{t.create}</h2>
        <form onSubmit={createListing} className="mt-4 grid gap-2 md:grid-cols-3">
          <input value={createForm.title} onChange={(event) => setCreateForm((prev) => ({ ...prev, title: event.target.value }))} placeholder={t.titleLabel} className="rounded-xl border border-white/15 bg-zinc-950/70 px-3 py-2 text-sm" />
          <input value={createForm.make} onChange={(event) => setCreateForm((prev) => ({ ...prev, make: event.target.value }))} placeholder={t.makeLabel} className="rounded-xl border border-white/15 bg-zinc-950/70 px-3 py-2 text-sm" />
          <input value={createForm.model} onChange={(event) => setCreateForm((prev) => ({ ...prev, model: event.target.value }))} placeholder={t.modelLabel} className="rounded-xl border border-white/15 bg-zinc-950/70 px-3 py-2 text-sm" />
          <input value={createForm.priceCents} onChange={(event) => setCreateForm((prev) => ({ ...prev, priceCents: event.target.value }))} placeholder={t.priceLabel} className="rounded-xl border border-white/15 bg-zinc-950/70 px-3 py-2 text-sm" />
          <input value={createForm.year} onChange={(event) => setCreateForm((prev) => ({ ...prev, year: event.target.value }))} placeholder={t.yearLabel} className="rounded-xl border border-white/15 bg-zinc-950/70 px-3 py-2 text-sm" />
          <input value={createForm.mileageKm} onChange={(event) => setCreateForm((prev) => ({ ...prev, mileageKm: event.target.value }))} placeholder={t.mileageLabel} className="rounded-xl border border-white/15 bg-zinc-950/70 px-3 py-2 text-sm" />
          <input value={createForm.city} onChange={(event) => setCreateForm((prev) => ({ ...prev, city: event.target.value }))} placeholder={t.cityLabel} className="rounded-xl border border-white/15 bg-zinc-950/70 px-3 py-2 text-sm" />
          <input value={createForm.country} onChange={(event) => setCreateForm((prev) => ({ ...prev, country: event.target.value }))} placeholder={t.countryLabel} className="rounded-xl border border-white/15 bg-zinc-950/70 px-3 py-2 text-sm" />
          <input value={createForm.currency} onChange={(event) => setCreateForm((prev) => ({ ...prev, currency: event.target.value.toUpperCase() }))} placeholder={t.currencyLabel} className="rounded-xl border border-white/15 bg-zinc-950/70 px-3 py-2 text-sm" />
          <select value={createForm.fuelType} onChange={(event) => setCreateForm((prev) => ({ ...prev, fuelType: event.target.value as ListingForm["fuelType"] }))} className="rounded-xl border border-white/15 bg-zinc-950/70 px-3 py-2 text-sm">
            <option value="GASOLINE">Gasoline</option>
            <option value="DIESEL">Diesel</option>
            <option value="HYBRID">Hybrid</option>
            <option value="ELECTRIC">Electric</option>
            <option value="OTHER">Other</option>
          </select>
          <select value={createForm.gearbox} onChange={(event) => setCreateForm((prev) => ({ ...prev, gearbox: event.target.value as ListingForm["gearbox"] }))} className="rounded-xl border border-white/15 bg-zinc-950/70 px-3 py-2 text-sm">
            <option value="MANUAL">Manual</option>
            <option value="AUTO">Auto</option>
            <option value="OTHER">Other</option>
          </select>
          {dealers.length > 0 ? (
            <select value={createForm.publisherId} onChange={(event) => setCreateForm((prev) => ({ ...prev, publisherId: event.target.value }))} className="rounded-xl border border-white/15 bg-zinc-950/70 px-3 py-2 text-sm">
              <option value="">{t.individual}</option>
              {dealers.map((dealer) => (
                <option key={dealer.id} value={dealer.id}>{dealer.name}</option>
              ))}
            </select>
          ) : null}
          <textarea value={createForm.imageUrls} onChange={(event) => setCreateForm((prev) => ({ ...prev, imageUrls: event.target.value }))} placeholder={t.imagesLabel} className="md:col-span-2 rounded-xl border border-white/15 bg-zinc-950/70 px-3 py-2 text-sm" rows={3} />
          <label className="flex cursor-pointer items-center justify-center rounded-xl border border-dashed border-white/20 bg-zinc-950/40 px-3 py-2 text-xs text-zinc-300">
            <input type="file" accept="image/*" multiple className="hidden" onChange={(event) => void uploadImages(event.target.files, "create")} />
            {uploadingTarget === "create" ? t.uploading : t.uploadImages}
          </label>
          {parseImageUrlsInput(createForm.imageUrls).length > 0 ? (
            <div className="md:col-span-3 grid grid-cols-3 gap-2">
              {parseImageUrlsInput(createForm.imageUrls).slice(0, 6).map((url) => (
                <img key={url} src={url} alt="preview" className="h-20 w-full rounded-lg border border-white/10 object-cover" loading="lazy" />
              ))}
            </div>
          ) : null}
          <textarea value={createForm.description} onChange={(event) => setCreateForm((prev) => ({ ...prev, description: event.target.value }))} placeholder={t.descriptionLabel} className="md:col-span-3 rounded-xl border border-white/15 bg-zinc-950/70 px-3 py-2 text-sm" rows={3} />
          <button disabled={isSubmitting} className="md:col-span-3 rounded-xl bg-cyan-400 px-4 py-2 text-sm font-semibold text-zinc-950 disabled:opacity-60">
            {isSubmitting ? "..." : t.create}
          </button>
        </form>
      </section>

      <section className="grid gap-4">
        {listings.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-zinc-900/70 p-6 text-sm text-zinc-300">{t.empty}</div>
        ) : (
          listings.map((listing) => {
            const editForm = edits[listing.id] ?? listingFormFromItem(listing);
            const featuredPurchase = latestListingPurchaseByKind.get(`${listing.id}:FEATURED`);
            const boostPurchase = latestListingPurchaseByKind.get(`${listing.id}:BOOST`);
            const dealer = listing.publisherId ? dealerById.get(listing.publisherId) : undefined;
            const featuredActive = Boolean(listing.featuredUntil && new Date(listing.featuredUntil).getTime() > Date.now());
            const boostActive = Boolean(listing.boostUntil && new Date(listing.boostUntil).getTime() > Date.now());
            return (
              <article key={listing.id} className="rounded-2xl border border-white/10 bg-zinc-900/70 p-5">
                {listing.imageUrls[0] ? (
                  <img src={listing.imageUrls[0]} alt={listing.title} className="h-40 w-full rounded-xl border border-white/10 object-cover" loading="lazy" />
                ) : (
                  <div className="h-40 w-full rounded-xl border border-dashed border-white/15 bg-zinc-950/40" />
                )}
                <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-lg font-semibold text-white">{listing.title}</h3>
                  <div className="flex flex-wrap items-center gap-2">{featuredActive ? <span className="rounded-full border border-amber-300/40 px-2 py-0.5 text-[10px] font-semibold text-amber-100">Featured</span> : null}{boostActive ? <span className="rounded-full border border-sky-300/40 px-2 py-0.5 text-[10px] font-semibold text-sky-100">Boost</span> : null}<span className="rounded-full border border-white/20 px-3 py-1 text-xs text-zinc-300">{getStatusLabel(listing.status)}</span></div>
                </div>
                <p className="mt-1 text-xs text-zinc-500">{listing.make} {listing.model} - {formatMoney(listing.priceCents, listing.currency, locale)}</p>
                <p className="mt-1 text-xs text-zinc-500">{t.createdAt}: {new Date(listing.createdAt).toLocaleDateString(locale)}</p>
                <p className="mt-1 text-xs text-zinc-500">{t.dealerLabel}: {listing.publisher?.name ?? t.individual}</p>
                {listing.featuredUntil ? <p className="mt-1 text-xs text-amber-200">{t.featuredUntilLabel}: {new Date(listing.featuredUntil).toLocaleDateString(locale)}</p> : null}
                {listing.boostUntil ? <p className="mt-1 text-xs text-sky-200">{t.boostUntilLabel}: {new Date(listing.boostUntil).toLocaleDateString(locale)}</p> : null}

                {listing.status === "DRAFT" || listing.status === "PAUSED" ? (
                  <div className="mt-4 grid gap-2 md:grid-cols-3">
                    <input value={editForm.title} onChange={(event) => setEdits((prev) => ({ ...prev, [listing.id]: { ...editForm, title: event.target.value } }))} placeholder={t.titleLabel} className="rounded-xl border border-white/15 bg-zinc-950/70 px-3 py-2 text-sm" />
                    <input value={editForm.priceCents} onChange={(event) => setEdits((prev) => ({ ...prev, [listing.id]: { ...editForm, priceCents: event.target.value } }))} placeholder={t.priceLabel} className="rounded-xl border border-white/15 bg-zinc-950/70 px-3 py-2 text-sm" />
                    <input value={editForm.city} onChange={(event) => setEdits((prev) => ({ ...prev, [listing.id]: { ...editForm, city: event.target.value } }))} placeholder={t.cityLabel} className="rounded-xl border border-white/15 bg-zinc-950/70 px-3 py-2 text-sm" />
                    {dealers.length > 0 ? (
                      <select value={editForm.publisherId} onChange={(event) => setEdits((prev) => ({ ...prev, [listing.id]: { ...editForm, publisherId: event.target.value } }))} className="rounded-xl border border-white/15 bg-zinc-950/70 px-3 py-2 text-sm">
                        <option value="">{t.individual}</option>
                        {dealers.map((dealer) => (
                          <option key={dealer.id} value={dealer.id}>{dealer.name}</option>
                        ))}
                      </select>
                    ) : null}
                    <textarea value={editForm.imageUrls} onChange={(event) => setEdits((prev) => ({ ...prev, [listing.id]: { ...editForm, imageUrls: event.target.value } }))} placeholder={t.imagesLabel} className="md:col-span-2 rounded-xl border border-white/15 bg-zinc-950/70 px-3 py-2 text-sm" rows={2} />
                    <label className="flex cursor-pointer items-center justify-center rounded-xl border border-dashed border-white/20 bg-zinc-950/40 px-3 py-2 text-xs text-zinc-300">
                      <input type="file" accept="image/*" multiple className="hidden" onChange={(event) => void uploadImages(event.target.files, listing.id)} />
                      {uploadingTarget === listing.id ? t.uploading : t.uploadImages}
                    </label>
                    <textarea value={editForm.description} onChange={(event) => setEdits((prev) => ({ ...prev, [listing.id]: { ...editForm, description: event.target.value } }))} placeholder={t.descriptionLabel} className="md:col-span-3 rounded-xl border border-white/15 bg-zinc-950/70 px-3 py-2 text-sm" rows={2} />
                    <button
                      type="button"
                      onClick={() => saveListing(listing.id)}
                      disabled={statusBusyId === listing.id}
                      className="md:col-span-3 rounded-xl border border-cyan-300/40 px-4 py-2 text-sm font-semibold text-cyan-200 disabled:opacity-60"
                    >
                      {t.updateCard}
                    </button>
                  </div>
                ) : null}

                <div className="mt-4 flex flex-wrap gap-2">
                  {listing.status === "DRAFT" || listing.status === "PAUSED" ? (
                    <button type="button" disabled={statusBusyId === listing.id} onClick={() => changeStatus(listing.id, "publish")} className="rounded-full border border-emerald-300/40 px-4 py-2 text-xs font-semibold text-emerald-200 disabled:opacity-60">
                      {t.publish}
                    </button>
                  ) : null}
                  {listing.status === "PUBLISHED" ? (
                    <button type="button" disabled={statusBusyId === listing.id} onClick={() => changeStatus(listing.id, "pause")} className="rounded-full border border-amber-300/40 px-4 py-2 text-xs font-semibold text-amber-200 disabled:opacity-60">
                      {t.pause}
                    </button>
                  ) : null}
                  {listing.status !== "ARCHIVED" ? (
                    <button type="button" disabled={statusBusyId === listing.id} onClick={() => changeStatus(listing.id, "archive")} className="rounded-full border border-rose-300/40 px-4 py-2 text-xs font-semibold text-rose-200 disabled:opacity-60">
                      {t.archive}
                    </button>
                  ) : null}
                  {listing.status === "PUBLISHED" && listing.publisherId ? (
                    <>
                      <button type="button" onClick={() => ((dealer?.featuredCredits ?? 0) > 0 ? applyCredit(listing.id, "FEATURED") : startMonetization(listing.id, "FEATURED"))} disabled={monetizationPending[`listing:${listing.id}:FEATURED`] === true || monetizationPending[`credit:${listing.id}:FEATURED`] === true} className="rounded-full border border-amber-300/40 px-3 py-1 text-xs font-semibold text-amber-100 disabled:opacity-60">{(dealer?.featuredCredits ?? 0) > 0 ? t.monetizationFeaturedCredit : t.monetizationFeatured}</button>
                      <button type="button" onClick={() => ((dealer?.boostCredits ?? 0) > 0 ? applyCredit(listing.id, "BOOST") : startMonetization(listing.id, "BOOST"))} disabled={monetizationPending[`listing:${listing.id}:BOOST`] === true || monetizationPending[`credit:${listing.id}:BOOST`] === true} className="rounded-full border border-sky-300/40 px-3 py-1 text-xs font-semibold text-sky-100 disabled:opacity-60">{(dealer?.boostCredits ?? 0) > 0 ? t.monetizationBoostCredit : t.monetizationBoost}</button>
                      {featuredPurchase ? <span className="text-xs text-zinc-300">FEATURED: {purchaseStatusLabel(featuredPurchase.status)} {featuredPurchase.status !== "PENDING" ? <Link href={`/cars/my/receipts/${featuredPurchase.id}`} className="ml-1 rounded-full border border-emerald-300/40 px-2 py-0.5 text-[10px] font-semibold text-emerald-100">{t.receipt}</Link> : null}</span> : null}
                      {boostPurchase ? <span className="text-xs text-zinc-300">BOOST: {purchaseStatusLabel(boostPurchase.status)} {boostPurchase.status !== "PENDING" ? <Link href={`/cars/my/receipts/${boostPurchase.id}`} className="ml-1 rounded-full border border-emerald-300/40 px-2 py-0.5 text-[10px] font-semibold text-emerald-100">{t.receipt}</Link> : null}</span> : null}
                      {featuredPurchase?.status === "FAILED" ? <button type="button" onClick={() => startMonetization(listing.id, "FEATURED")} className="rounded-full border border-white/20 px-3 py-1 text-xs font-semibold text-white">{t.retry}</button> : null}
                      {boostPurchase?.status === "FAILED" ? <button type="button" onClick={() => startMonetization(listing.id, "BOOST")} className="rounded-full border border-white/20 px-3 py-1 text-xs font-semibold text-white">{t.retry}</button> : null}
                    </>
                  ) : null}
                </div>
              </article>
            );
          })
        )}
      </section>
    </div>
  );
}

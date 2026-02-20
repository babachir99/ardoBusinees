"use client";

import { type FormEvent, useMemo, useState } from "react";
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

type AutoListingItem = {
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
  fuelType: "GASOLINE" | "DIESEL" | "HYBRID" | "ELECTRIC" | "OTHER";
  gearbox: "MANUAL" | "AUTO" | "OTHER";
  status: "DRAFT" | "PUBLISHED" | "PAUSED" | "ARCHIVED";
  createdAt: string;
  updatedAt: string;
  publisherId: string | null;
  publisher: PublisherSummary | null;
};

type DealerOption = PublisherSummary & {
  role: "OWNER" | "AGENT";
};

type Props = {
  locale: string;
  listings: AutoListingItem[];
  dealers: DealerOption[];
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
  fuelType: AutoListingItem["fuelType"];
  gearbox: AutoListingItem["gearbox"];
  publisherId: string;
};

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
  };
}

export default function AutoMyDashboard({ locale, listings: initialListings, dealers }: Props) {
  const [listings, setListings] = useState(initialListings);
  const [createForm, setCreateForm] = useState<ListingForm>(emptyForm());
  const [edits, setEdits] = useState<Record<string, ListingForm>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusBusyId, setStatusBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState<string>("");

  const t = useMemo(
    () => ({
      title: locale === "fr" ? "Mes annonces AUTO" : "My AUTO listings",
      create: locale === "fr" ? "Creer une annonce" : "Create listing",
      save: locale === "fr" ? "Enregistrer" : "Save",
      publish: locale === "fr" ? "Publier" : "Publish",
      pause: locale === "fr" ? "Mettre en pause" : "Pause",
      archive: locale === "fr" ? "Archiver" : "Archive",
      empty:
        locale === "fr"
          ? "Aucune annonce auto. Creez votre premiere annonce."
          : "No auto listing yet. Create your first listing.",
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
      dealerLabel: locale === "fr" ? "Concessionnaire" : "Dealer",
      individual: locale === "fr" ? "Particulier" : "Individual",
      draft: locale === "fr" ? "Brouillon" : "Draft",
      published: locale === "fr" ? "Publie" : "Published",
      paused: locale === "fr" ? "Pause" : "Paused",
      archived: locale === "fr" ? "Archive" : "Archived",
      createdAt: locale === "fr" ? "Cree le" : "Created",
      updateCard: locale === "fr" ? "Modifier" : "Update",
      myDealers: locale === "fr" ? "Mes concessions" : "My dealers",
      noDealerMember:
        locale === "fr"
          ? "Aucune adhesion concessionnaire active."
          : "No active dealer membership.",
    }),
    [locale]
  );

  function getStatusLabel(status: AutoListingItem["status"]) {
    if (status === "DRAFT") return t.draft;
    if (status === "PUBLISHED") return t.published;
    if (status === "PAUSED") return t.paused;
    return t.archived;
  }

  function listingFormFromItem(item: AutoListingItem): ListingForm {
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
    };
  }

  async function createListing(event: FormEvent) {
    event.preventDefault();
    setErrorMsg("");
    setMessage("");
    setIsSubmitting(true);

    const response = await fetch("/api/auto/listings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...createForm,
        priceCents: Number(createForm.priceCents),
        year: Number(createForm.year),
        mileageKm: Number(createForm.mileageKm),
        publisherId: createForm.publisherId || null,
      }),
      cache: "no-store",
    }).catch(() => null);

    setIsSubmitting(false);

    if (!response) {
      setErrorMsg(t.genericError);
      return;
    }

    const json = (await response.json().catch(() => null)) as
      | { error?: string; message?: string; listing?: AutoListingItem }
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

    const response = await fetch(`/api/auto/listings/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        priceCents: Number(form.priceCents),
        year: Number(form.year),
        mileageKm: Number(form.mileageKm),
        publisherId: form.publisherId || null,
      }),
      cache: "no-store",
    }).catch(() => null);

    setStatusBusyId(null);

    if (!response) {
      setErrorMsg(t.genericError);
      return;
    }

    const json = (await response.json().catch(() => null)) as
      | { error?: string; message?: string; listing?: AutoListingItem }
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
        ? await fetch(`/api/auto/listings/${id}/publish`, {
            method: "POST",
            cache: "no-store",
          }).catch(() => null)
        : await fetch(`/api/auto/listings/${id}`, {
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
      | { error?: string; message?: string; listing?: AutoListingItem }
      | null;
    const updatedListing = json?.listing;

    if (!response.ok || !updatedListing?.id) {
      setErrorMsg(json?.message ?? t.genericError);
      return;
    }

    setListings((prev) => prev.map((item) => (item.id === id ? { ...item, ...updatedListing } : item)));
    setMessage(t.statusUpdated);
  }

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-white/10 bg-zinc-900/70 p-6">
        <h1 className="text-2xl font-semibold text-white">{t.title}</h1>
        {message ? <p className="mt-2 text-xs text-emerald-200">{message}</p> : null}
        {errorMsg ? <p className="mt-2 text-xs text-rose-200">{errorMsg}</p> : null}
      </section>

      <section className="rounded-3xl border border-white/10 bg-zinc-900/70 p-6">
        <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-300">{t.myDealers}</h2>
        {dealers.length === 0 ? (
          <p className="mt-2 text-xs text-zinc-400">{t.noDealerMember}</p>
        ) : (
          <div className="mt-3 flex flex-wrap gap-2">
            {dealers.map((dealer) => (
              <span key={dealer.id} className="rounded-full border border-cyan-300/35 bg-cyan-300/10 px-3 py-1 text-xs text-cyan-100">
                {dealer.name} ({dealer.role})
              </span>
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
            return (
              <article key={listing.id} className="rounded-2xl border border-white/10 bg-zinc-900/70 p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-lg font-semibold text-white">{listing.title}</h3>
                  <span className="rounded-full border border-white/20 px-3 py-1 text-xs text-zinc-300">{getStatusLabel(listing.status)}</span>
                </div>
                <p className="mt-1 text-xs text-zinc-500">{listing.make} {listing.model} - {formatMoney(listing.priceCents, listing.currency, locale)}</p>
                <p className="mt-1 text-xs text-zinc-500">{t.createdAt}: {new Date(listing.createdAt).toLocaleDateString(locale)}</p>
                <p className="mt-1 text-xs text-zinc-500">{t.dealerLabel}: {listing.publisher?.name ?? t.individual}</p>

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
                    <textarea value={editForm.description} onChange={(event) => setEdits((prev) => ({ ...prev, [listing.id]: { ...editForm, description: event.target.value } }))} placeholder={t.descriptionLabel} className="md:col-span-2 rounded-xl border border-white/15 bg-zinc-950/70 px-3 py-2 text-sm" rows={2} />
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
                </div>
              </article>
            );
          })
        )}
      </section>
    </div>
  );
}

"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { formatMoney } from "@/lib/format";

type DealerOption = {
  id: string;
  name: string;
  slug: string;
  verified: boolean;
  city: string | null;
  country: string | null;
  role: "OWNER" | "AGENT";
};

type ListingItem = {
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
  status: "DRAFT" | "PUBLISHED" | "PAUSED" | "ARCHIVED";
  createdAt: string;
  updatedAt: string;
  publisherId: string | null;
  publisher: { id: string; name: string; slug: string; verified: boolean; city: string | null; country: string | null; logoUrl: string | null } | null;
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
  fuelType: ListingItem["fuelType"];
  gearbox: ListingItem["gearbox"];
  publisherId: string;
};

function formFromListing(item: ListingItem): ListingForm {
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

export default function CarsMyDashboard({
  locale,
  listings,
  dealers,
}: {
  locale: string;
  listings: ListingItem[];
  dealers: DealerOption[];
}) {
  const router = useRouter();
  const [createForm, setCreateForm] = useState<ListingForm>({
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
  });
  const [editById, setEditById] = useState<Record<string, ListingForm>>(() => Object.fromEntries(listings.map((l) => [l.id, formFromListing(l)])));
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [message, setMessage] = useState("");

  const t = useMemo(() => ({
    title: locale === "fr" ? "Mes annonces voitures" : "My car listings",
    subtitle: locale === "fr" ? "Creer, modifier et publier des annonces voitures." : "Create, edit and publish car listings.",
    create: locale === "fr" ? "Creer un brouillon" : "Create draft",
    save: locale === "fr" ? "Enregistrer" : "Save",
    publish: locale === "fr" ? "Publier" : "Publish",
    pause: locale === "fr" ? "Mettre en pause" : "Pause",
    archive: locale === "fr" ? "Archiver" : "Archive",
    draft: locale === "fr" ? "Brouillon" : "Draft",
    published: locale === "fr" ? "Publie" : "Published",
    paused: locale === "fr" ? "En pause" : "Paused",
    archived: locale === "fr" ? "Archive" : "Archived",
    dealer: locale === "fr" ? "Concessionnaire" : "Dealer",
    noDealer: locale === "fr" ? "Particulier" : "Individual",
    verified: locale === "fr" ? "Verifie" : "Verified",
    noListings: locale === "fr" ? "Aucune annonce." : "No listings yet.",
    genericError: locale === "fr" ? "Erreur serveur." : "Server error.",
    createdOk: locale === "fr" ? "Annonce creee." : "Listing created.",
    updatedOk: locale === "fr" ? "Annonce mise a jour." : "Listing updated.",
    statusOk: locale === "fr" ? "Statut mis a jour." : "Status updated.",
    titleField: locale === "fr" ? "Titre" : "Title",
    descriptionField: locale === "fr" ? "Description" : "Description",
    priceField: locale === "fr" ? "Prix" : "Price",
    countryField: locale === "fr" ? "Pays" : "Country",
    cityField: locale === "fr" ? "Ville" : "City",
    makeField: locale === "fr" ? "Marque" : "Make",
    modelField: locale === "fr" ? "Modele" : "Model",
    yearField: locale === "fr" ? "Annee" : "Year",
    mileageField: locale === "fr" ? "Kilometrage" : "Mileage",
    fuelField: locale === "fr" ? "Carburant" : "Fuel",
    gearboxField: locale === "fr" ? "Boite" : "Gearbox",
    dealerField: locale === "fr" ? "Concessionnaire (optionnel)" : "Dealer (optional)",
  }), [locale]);

  const dealerOptions = dealers;

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    setErrorMsg("");
    setMessage("");
    setBusyKey("create");
    const res = await fetch("/api/cars/listings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({
        ...createForm,
        priceCents: Number(createForm.priceCents),
        year: Number(createForm.year),
        mileageKm: Number(createForm.mileageKm),
        publisherId: createForm.publisherId || null,
      }),
    }).catch(() => null);
    setBusyKey(null);
    if (!res) return void setErrorMsg(t.genericError);
    const body = await res.json().catch(() => null) as { message?: string } | null;
    if (!res.ok) return void setErrorMsg(body?.message ?? t.genericError);
    setMessage(t.createdOk);
    router.refresh();
  }

  async function patchListing(id: string, payload: Record<string, unknown>, okMessage: string) {
    setErrorMsg("");
    setMessage("");
    setBusyKey(id);
    const res = await fetch(`/api/cars/listings/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify(payload),
    }).catch(() => null);
    setBusyKey(null);
    if (!res) return void setErrorMsg(t.genericError);
    const body = await res.json().catch(() => null) as { message?: string } | null;
    if (!res.ok) return void setErrorMsg(body?.message ?? t.genericError);
    setMessage(okMessage);
    router.refresh();
  }

  async function publishListing(id: string) {
    setErrorMsg("");
    setMessage("");
    setBusyKey(`publish:${id}`);
    const res = await fetch(`/api/cars/listings/${id}/publish`, { method: "POST", cache: "no-store" }).catch(() => null);
    setBusyKey(null);
    if (!res) return void setErrorMsg(t.genericError);
    const body = await res.json().catch(() => null) as { message?: string } | null;
    if (!res.ok) return void setErrorMsg(body?.message ?? t.genericError);
    setMessage(t.statusOk);
    router.refresh();
  }

  function statusLabel(status: ListingItem["status"]) {
    if (status === "DRAFT") return t.draft;
    if (status === "PUBLISHED") return t.published;
    if (status === "PAUSED") return t.paused;
    return t.archived;
  }

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-white/10 bg-zinc-900/70 p-6">
        <h1 className="text-2xl font-semibold text-white">{t.title}</h1>
        <p className="mt-1 text-sm text-zinc-300">{t.subtitle}</p>
        {errorMsg ? <p className="mt-3 text-sm text-rose-300">{errorMsg}</p> : null}
        {message ? <p className="mt-3 text-sm text-emerald-300">{message}</p> : null}

        <form onSubmit={handleCreate} className="mt-4 grid gap-2 md:grid-cols-3">
          <input value={createForm.title} onChange={(e) => setCreateForm((v) => ({ ...v, title: e.target.value }))} placeholder={t.titleField} className="rounded-xl border border-white/15 bg-zinc-950/70 px-3 py-2 text-sm" required />
          <input value={createForm.make} onChange={(e) => setCreateForm((v) => ({ ...v, make: e.target.value }))} placeholder={t.makeField} className="rounded-xl border border-white/15 bg-zinc-950/70 px-3 py-2 text-sm" required />
          <input value={createForm.model} onChange={(e) => setCreateForm((v) => ({ ...v, model: e.target.value }))} placeholder={t.modelField} className="rounded-xl border border-white/15 bg-zinc-950/70 px-3 py-2 text-sm" required />
          <textarea value={createForm.description} onChange={(e) => setCreateForm((v) => ({ ...v, description: e.target.value }))} placeholder={t.descriptionField} className="md:col-span-3 rounded-xl border border-white/15 bg-zinc-950/70 px-3 py-2 text-sm" rows={3} required />
          <input value={createForm.priceCents} onChange={(e) => setCreateForm((v) => ({ ...v, priceCents: e.target.value }))} placeholder={t.priceField} className="rounded-xl border border-white/15 bg-zinc-950/70 px-3 py-2 text-sm" required />
          <input value={createForm.year} onChange={(e) => setCreateForm((v) => ({ ...v, year: e.target.value }))} placeholder={t.yearField} className="rounded-xl border border-white/15 bg-zinc-950/70 px-3 py-2 text-sm" required />
          <input value={createForm.mileageKm} onChange={(e) => setCreateForm((v) => ({ ...v, mileageKm: e.target.value }))} placeholder={t.mileageField} className="rounded-xl border border-white/15 bg-zinc-950/70 px-3 py-2 text-sm" required />
          <input value={createForm.country} onChange={(e) => setCreateForm((v) => ({ ...v, country: e.target.value.toUpperCase() }))} placeholder={t.countryField} className="rounded-xl border border-white/15 bg-zinc-950/70 px-3 py-2 text-sm" />
          <input value={createForm.city} onChange={(e) => setCreateForm((v) => ({ ...v, city: e.target.value }))} placeholder={t.cityField} className="rounded-xl border border-white/15 bg-zinc-950/70 px-3 py-2 text-sm" required />
          <select value={createForm.fuelType} onChange={(e) => setCreateForm((v) => ({ ...v, fuelType: e.target.value as ListingItem["fuelType"] }))} className="rounded-xl border border-white/15 bg-zinc-950/70 px-3 py-2 text-sm">
            {(["GASOLINE","DIESEL","HYBRID","ELECTRIC","LPG","OTHER"] as const).map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
          <select value={createForm.gearbox} onChange={(e) => setCreateForm((v) => ({ ...v, gearbox: e.target.value as ListingItem["gearbox"] }))} className="rounded-xl border border-white/15 bg-zinc-950/70 px-3 py-2 text-sm">
            {(["MANUAL","AUTO","OTHER"] as const).map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
          {dealerOptions.length > 0 ? (
            <select value={createForm.publisherId} onChange={(e) => setCreateForm((v) => ({ ...v, publisherId: e.target.value }))} className="rounded-xl border border-white/15 bg-zinc-950/70 px-3 py-2 text-sm">
              <option value="">{t.dealerField}</option>
              {dealerOptions.map((dealer) => (
                <option key={dealer.id} value={dealer.id}>{dealer.name}{dealer.verified ? ' (verified)' : ''}</option>
              ))}
            </select>
          ) : <div className="rounded-xl border border-white/10 bg-zinc-950/40 px-3 py-2 text-xs text-zinc-400">{t.noDealer}</div>}
          <div className="md:col-span-3 flex justify-end">
            <button disabled={busyKey === "create"} className="rounded-full bg-cyan-400 px-4 py-2 text-sm font-semibold text-zinc-950 disabled:opacity-60">{busyKey === "create" ? '...' : t.create}</button>
          </div>
        </form>
      </section>

      <section className="grid gap-4">
        {listings.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-zinc-900/70 p-6 text-sm text-zinc-300">{t.noListings}</div>
        ) : listings.map((listing) => {
          const form = editById[listing.id] ?? formFromListing(listing);
          return (
            <article key={listing.id} className="rounded-2xl border border-white/10 bg-zinc-900/70 p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-xs text-zinc-400">{listing.make} {listing.model}</p>
                  <h2 className="text-lg font-semibold text-white">{listing.title}</h2>
                  <p className="text-xs text-zinc-400">{statusLabel(listing.status)} ? {formatMoney(listing.priceCents, listing.currency, locale)} ? {listing.city}, {listing.country}</p>
                </div>
                <div className="text-xs text-zinc-300">
                  {listing.publisher ? `${t.dealer}: ${listing.publisher.name}${listing.publisher.verified ? ` (${t.verified})` : ''}` : t.noDealer}
                </div>
              </div>

              {(listing.status === "DRAFT" || listing.status === "PAUSED") ? (
                <form onSubmit={(e) => { e.preventDefault(); void patchListing(listing.id, { ...form, priceCents: Number(form.priceCents), year: Number(form.year), mileageKm: Number(form.mileageKm), publisherId: form.publisherId || null }, t.updatedOk); }} className="mt-4 grid gap-2 md:grid-cols-3">
                  <input value={form.title} onChange={(e) => setEditById((m) => ({ ...m, [listing.id]: { ...form, title: e.target.value } }))} className="rounded-xl border border-white/15 bg-zinc-950/70 px-3 py-2 text-sm" />
                  <input value={form.make} onChange={(e) => setEditById((m) => ({ ...m, [listing.id]: { ...form, make: e.target.value } }))} className="rounded-xl border border-white/15 bg-zinc-950/70 px-3 py-2 text-sm" />
                  <input value={form.model} onChange={(e) => setEditById((m) => ({ ...m, [listing.id]: { ...form, model: e.target.value } }))} className="rounded-xl border border-white/15 bg-zinc-950/70 px-3 py-2 text-sm" />
                  <textarea value={form.description} onChange={(e) => setEditById((m) => ({ ...m, [listing.id]: { ...form, description: e.target.value } }))} rows={2} className="md:col-span-3 rounded-xl border border-white/15 bg-zinc-950/70 px-3 py-2 text-sm" />
                  <input value={form.priceCents} onChange={(e) => setEditById((m) => ({ ...m, [listing.id]: { ...form, priceCents: e.target.value } }))} className="rounded-xl border border-white/15 bg-zinc-950/70 px-3 py-2 text-sm" />
                  <input value={form.year} onChange={(e) => setEditById((m) => ({ ...m, [listing.id]: { ...form, year: e.target.value } }))} className="rounded-xl border border-white/15 bg-zinc-950/70 px-3 py-2 text-sm" />
                  <input value={form.mileageKm} onChange={(e) => setEditById((m) => ({ ...m, [listing.id]: { ...form, mileageKm: e.target.value } }))} className="rounded-xl border border-white/15 bg-zinc-950/70 px-3 py-2 text-sm" />
                  <input value={form.country} onChange={(e) => setEditById((m) => ({ ...m, [listing.id]: { ...form, country: e.target.value.toUpperCase() } }))} className="rounded-xl border border-white/15 bg-zinc-950/70 px-3 py-2 text-sm" />
                  <input value={form.city} onChange={(e) => setEditById((m) => ({ ...m, [listing.id]: { ...form, city: e.target.value } }))} className="rounded-xl border border-white/15 bg-zinc-950/70 px-3 py-2 text-sm" />
                  <select value={form.fuelType} onChange={(e) => setEditById((m) => ({ ...m, [listing.id]: { ...form, fuelType: e.target.value as ListingItem["fuelType"] } }))} className="rounded-xl border border-white/15 bg-zinc-950/70 px-3 py-2 text-sm">
                    {(["GASOLINE","DIESEL","HYBRID","ELECTRIC","LPG","OTHER"] as const).map((v) => <option key={v} value={v}>{v}</option>)}
                  </select>
                  <select value={form.gearbox} onChange={(e) => setEditById((m) => ({ ...m, [listing.id]: { ...form, gearbox: e.target.value as ListingItem["gearbox"] } }))} className="rounded-xl border border-white/15 bg-zinc-950/70 px-3 py-2 text-sm">
                    {(["MANUAL","AUTO","OTHER"] as const).map((v) => <option key={v} value={v}>{v}</option>)}
                  </select>
                  {dealerOptions.length > 0 ? (
                    <select value={form.publisherId} onChange={(e) => setEditById((m) => ({ ...m, [listing.id]: { ...form, publisherId: e.target.value } }))} className="rounded-xl border border-white/15 bg-zinc-950/70 px-3 py-2 text-sm">
                      <option value="">{t.dealerField}</option>
                      {dealerOptions.map((dealer) => <option key={dealer.id} value={dealer.id}>{dealer.name}</option>)}
                    </select>
                  ) : <div className="rounded-xl border border-white/10 bg-zinc-950/40 px-3 py-2 text-xs text-zinc-400">{t.noDealer}</div>}
                  <div className="md:col-span-3 flex flex-wrap gap-2">
                    <button type="submit" disabled={busyKey === listing.id} className="rounded-full border border-white/20 px-3 py-1 text-xs font-semibold text-white disabled:opacity-60">{busyKey === listing.id ? '...' : t.save}</button>
                    <button type="button" disabled={busyKey === `publish:${listing.id}`} onClick={() => void publishListing(listing.id)} className="rounded-full border border-emerald-300/40 px-3 py-1 text-xs font-semibold text-emerald-100 disabled:opacity-60">{busyKey === `publish:${listing.id}` ? '...' : t.publish}</button>
                    {listing.status === "PAUSED" ? (
                      <button type="button" disabled={busyKey === `status:${listing.id}:ARCHIVED`} onClick={() => void patchListing(listing.id, { status: "ARCHIVED" }, t.statusOk)} className="rounded-full border border-white/20 px-3 py-1 text-xs font-semibold text-white disabled:opacity-60">{t.archive}</button>
                    ) : null}
                  </div>
                </form>
              ) : null}

              <div className="mt-4 flex flex-wrap gap-2">
                {listing.status === "PUBLISHED" ? (
                  <button type="button" disabled={busyKey === `status:${listing.id}:PAUSED`} onClick={() => void patchListing(listing.id, { status: "PAUSED" }, t.statusOk)} className="rounded-full border border-white/20 px-3 py-1 text-xs font-semibold text-white disabled:opacity-60">{t.pause}</button>
                ) : null}
                {listing.status !== "ARCHIVED" ? (
                  <button type="button" disabled={busyKey === `status:${listing.id}:ARCHIVED`} onClick={() => void patchListing(listing.id, { status: "ARCHIVED" }, t.statusOk)} className="rounded-full border border-white/20 px-3 py-1 text-xs font-semibold text-white disabled:opacity-60">{t.archive}</button>
                ) : null}
                {(listing.status === "DRAFT" || listing.status === "PAUSED") ? (
                  <button type="button" disabled={busyKey === `publish:${listing.id}`} onClick={() => void publishListing(listing.id)} className="rounded-full border border-emerald-300/40 px-3 py-1 text-xs font-semibold text-emerald-100 disabled:opacity-60">{t.publish}</button>
                ) : null}
              </div>
            </article>
          );
        })}
      </section>
    </div>
  );
}

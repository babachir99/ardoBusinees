"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useRouter } from "@/i18n/navigation";
import { formatMoney } from "@/lib/format";

type ImmoListingRow = {
  id: string;
  title: string;
  description: string;
  listingType: "SALE" | "RENT";
  propertyType: "APARTMENT" | "HOUSE" | "LAND" | "COMMERCIAL" | "OTHER";
  priceCents: number;
  currency: string;
  surfaceM2: number;
  rooms: number | null;
  city: string;
  country: string;
  imageUrls: string[];
  status: "DRAFT" | "PUBLISHED" | "PAUSED" | "ARCHIVED";
  isFeatured: boolean;
  featuredUntil: string | null;
  boostUntil: string | null;
  publisherId?: string | null;
  publisher?: {
    id: string;
    name: string;
    slug: string;
    verified: boolean;
  } | null;
  createdAt: string;
};

type AgencyOption = {
  id: string;
  name: string;
  slug: string;
  verified: boolean;
  city: string | null;
  country: string | null;
};

type Props = {
  locale: string;
  listings: ImmoListingRow[];
  agencies: AgencyOption[];
};

type DraftCreate = {
  title: string;
  description: string;
  listingType: "SALE" | "RENT";
  propertyType: "APARTMENT" | "HOUSE" | "LAND" | "COMMERCIAL" | "OTHER";
  priceCents: string;
  surfaceM2: string;
  rooms: string;
  city: string;
  country: string;
  currency: string;
  publisherId: string;
  imageUrls: string;
};

const defaultCreate: DraftCreate = {
  title: "",
  description: "",
  listingType: "RENT",
  propertyType: "APARTMENT",
  priceCents: "",
  surfaceM2: "",
  rooms: "",
  city: "",
  country: "SN",
  currency: "EUR",
  publisherId: "",
  imageUrls: "",
};

const actionLabels = {
  fr: {
    heading: "Mes annonces IMMO",
    subtitle: "Cree, modifie et publie tes annonces sans exposer tes coordonnees.",
    create: "Creer un brouillon",
    save: "Enregistrer",
    publish: "Publier",
    pause: "Mettre en pause",
    archive: "Archiver",
    titlePlaceholder: "Titre",
    descriptionPlaceholder: "Description",
    listingTypeSale: "Vente",
    listingTypeRent: "Location",
    propertyApartment: "Appartement",
    propertyHouse: "Maison",
    propertyLand: "Terrain",
    propertyCommercial: "Commercial",
    propertyOther: "Autre",
    price: "Prix",
    surface: "Surface m2",
    rooms: "Pieces",
    city: "Ville",
    images: "Photos (URLs, une par ligne)",
    uploadImages: "Uploader des photos",
    uploading: "Upload...",
    uploadSuccess: "Photos ajoutees.",
    agency: "Agence",
    monetizationFeatured: "Mettre en avant (7j)",
    monetizationBoost: "Booster (3j)",
    featuredUntil: "Mise en avant jusqu'au",
    boostUntil: "Boost jusqu'au",
    monetizationCheckoutMissing: "Checkout indisponible pour le moment.",
    monetizationStart: "Checkout de monetisation initialise.",
    empty: "Aucune annonce pour le moment.",
    successCreate: "Brouillon cree.",
    successUpdate: "Annonce mise a jour.",
    successAction: "Statut mis a jour.",
    errorDefault: "Action impossible pour le moment.",
  },
  en: {
    heading: "My IMMO listings",
    subtitle: "Create, edit and publish listings without exposing direct contact details.",
    create: "Create draft",
    save: "Save",
    publish: "Publish",
    pause: "Pause",
    archive: "Archive",
    titlePlaceholder: "Title",
    descriptionPlaceholder: "Description",
    listingTypeSale: "Sale",
    listingTypeRent: "Rent",
    propertyApartment: "Apartment",
    propertyHouse: "House",
    propertyLand: "Land",
    propertyCommercial: "Commercial",
    propertyOther: "Other",
    price: "Price",
    surface: "Surface m2",
    rooms: "Rooms",
    city: "City",
    images: "Photos (URLs, one per line)",
    uploadImages: "Upload photos",
    uploading: "Uploading...",
    uploadSuccess: "Photos added.",
    agency: "Agency",
    monetizationFeatured: "Feature (7d)",
    monetizationBoost: "Boost (3d)",
    featuredUntil: "Featured until",
    boostUntil: "Boost until",
    monetizationCheckoutMissing: "Checkout unavailable right now.",
    monetizationStart: "Monetization checkout initialized.",
    empty: "No listings yet.",
    successCreate: "Draft created.",
    successUpdate: "Listing updated.",
    successAction: "Listing status updated.",
    errorDefault: "Action unavailable right now.",
  },
};

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

function statusLabel(locale: string, status: ImmoListingRow["status"]) {
  if (locale === "fr") {
    if (status === "DRAFT") return "Brouillon";
    if (status === "PUBLISHED") return "Publie";
    if (status === "PAUSED") return "En pause";
    return "Archive";
  }

  return status;
}

export default function ImmoMyDashboard({ locale, listings, agencies }: Props) {
  const l = locale === "fr" ? actionLabels.fr : actionLabels.en;
  const router = useRouter();

  const [createForm, setCreateForm] = useState<DraftCreate>(defaultCreate);
  const [saving, setSaving] = useState<string | null>(null);
  const [uploading, setUploading] = useState<string | null>(null);
  const [monetizationPending, setMonetizationPending] = useState<Record<string, boolean>>({});
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const editDefaults = useMemo(() => {
    return Object.fromEntries(
      listings.map((item) => [
        item.id,
        {
          title: item.title,
          description: item.description,
          priceCents: String(item.priceCents),
          surfaceM2: String(item.surfaceM2),
          rooms: item.rooms === null ? "" : String(item.rooms),
          city: item.city,
          country: item.country,
          currency: item.currency,
          publisherId: item.publisherId ?? "",
          imageUrls: item.imageUrls.join("\n"),
        },
      ])
    ) as Record<
      string,
      {
        title: string;
        description: string;
        priceCents: string;
        surfaceM2: string;
        rooms: string;
        city: string;
        country: string;
        currency: string;
        publisherId: string;
        imageUrls: string;
      }
    >;
  }, [listings]);

  const [editForm, setEditForm] = useState(editDefaults);

  const updateEditField = (id: string, key: keyof (typeof editDefaults)[string], value: string) => {
    setEditForm((prev) => ({
      ...prev,
      [id]: {
        ...prev[id],
        [key]: value,
      },
    }));
  };

  async function uploadImages(files: FileList | null, target: "create" | string) {
    if (!files || files.length === 0) return;

    const list = Array.from(files);
    setUploading(target);
    setError("");
    setMessage("");

    try {
      const uploadedUrls = await Promise.all(
        list.map(async (file) => {
          const formData = new FormData();
          formData.set("file", file);

          const response = await fetch("/api/upload", {
            method: "POST",
            body: formData,
          });

          const body = (await response.json().catch(() => null)) as
            | { error?: string; url?: string }
            | null;

          if (!response.ok || !body?.url) {
            throw new Error(body?.error ?? l.errorDefault);
          }

          return body.url;
        })
      );

      if (target === "create") {
        setCreateForm((prev) => ({
          ...prev,
          imageUrls: mergeImageUrlText(prev.imageUrls, uploadedUrls),
        }));
      } else {
        setEditForm((prev) => {
          const current = prev[target];
          if (!current) return prev;

          return {
            ...prev,
            [target]: {
              ...current,
              imageUrls: mergeImageUrlText(current.imageUrls, uploadedUrls),
            },
          };
        });
      }

      setMessage(l.uploadSuccess);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : l.errorDefault);
    } finally {
      setUploading(null);
    }
  }

  async function createDraft(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving("create");
    setError("");
    setMessage("");

    try {
      const response = await fetch("/api/immo/listings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...createForm,
          ...(createForm.publisherId ? { publisherId: createForm.publisherId } : {}),
          priceCents: Number(createForm.priceCents),
          surfaceM2: Number(createForm.surfaceM2),
          rooms: createForm.rooms ? Number(createForm.rooms) : null,
          imageUrls: parseImageUrlsInput(createForm.imageUrls),
        }),
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as
          | { message?: string }
          | null;
        setError(body?.message ?? l.errorDefault);
        return;
      }

      setMessage(l.successCreate);
      setCreateForm(defaultCreate);
      router.refresh();
    } catch {
      setError(l.errorDefault);
    } finally {
      setSaving(null);
    }
  }

  async function saveListing(id: string) {
    const draft = editForm[id];
    if (!draft) return;

    setSaving(`save:${id}`);
    setError("");
    setMessage("");

    try {
      const response = await fetch(`/api/immo/listings/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: draft.title,
          description: draft.description,
          priceCents: Number(draft.priceCents),
          surfaceM2: Number(draft.surfaceM2),
          rooms: draft.rooms ? Number(draft.rooms) : null,
          city: draft.city,
          country: draft.country,
          currency: draft.currency,
          publisherId: draft.publisherId || null,
          imageUrls: parseImageUrlsInput(draft.imageUrls),
        }),
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as
          | { message?: string }
          | null;
        setError(body?.message ?? l.errorDefault);
        return;
      }

      setMessage(l.successUpdate);
      router.refresh();
    } catch {
      setError(l.errorDefault);
    } finally {
      setSaving(null);
    }
  }

  async function changeStatus(id: string, action: "publish" | "pause" | "archive") {
    setSaving(`${action}:${id}`);
    setError("");
    setMessage("");

    try {
      const response = await fetch(`/api/immo/listings/${id}/${action}`, {
        method: "POST",
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as
          | { message?: string }
          | null;
        setError(body?.message ?? l.errorDefault);
        return;
      }

      setMessage(l.successAction);
      router.refresh();
    } catch {
      setError(l.errorDefault);
    } finally {
      setSaving(null);
    }
  }


  async function startMonetization(listingId: string, kind: "FEATURED" | "BOOST") {
    setMonetizationPending((prev) => ({ ...prev, [listingId]: true }));
    setError("");
    setMessage("");

    try {
      const response = await fetch("/api/immo/monetization/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listingId, kind }),
      });

      const body = (await response.json().catch(() => null)) as
        | { message?: string; checkoutUrl?: string | null }
        | null;

      if (!response.ok) {
        setError(body?.message ?? l.errorDefault);
        return;
      }

      if (body?.checkoutUrl) {
        window.location.href = body.checkoutUrl;
        return;
      }

      setMessage(l.monetizationCheckoutMissing);
    } catch {
      setError(l.errorDefault);
    } finally {
      setMonetizationPending((prev) => ({ ...prev, [listingId]: false }));
    }
  }

  return (
    <section className="rounded-3xl border border-white/10 bg-zinc-900/70 p-6">
      <h1 className="text-2xl font-semibold text-white">{l.heading}</h1>
      <p className="mt-2 text-sm text-zinc-300">{l.subtitle}</p>

      <form onSubmit={createDraft} className="mt-6 grid gap-3 md:grid-cols-2">
        <input
          value={createForm.title}
          onChange={(event) => setCreateForm((prev) => ({ ...prev, title: event.target.value }))}
          placeholder={l.titlePlaceholder}
          className="rounded-xl border border-white/15 bg-zinc-950/70 px-3 py-2 text-sm text-white"
          required
        />
        <input
          value={createForm.city}
          onChange={(event) => setCreateForm((prev) => ({ ...prev, city: event.target.value }))}
          placeholder={l.city}
          className="rounded-xl border border-white/15 bg-zinc-950/70 px-3 py-2 text-sm text-white"
          required
        />
        <textarea
          value={createForm.description}
          onChange={(event) => setCreateForm((prev) => ({ ...prev, description: event.target.value }))}
          placeholder={l.descriptionPlaceholder}
          className="rounded-xl border border-white/15 bg-zinc-950/70 px-3 py-2 text-sm text-white md:col-span-2"
          rows={3}
          required
        />
        <textarea
          value={createForm.imageUrls}
          onChange={(event) => setCreateForm((prev) => ({ ...prev, imageUrls: event.target.value }))}
          placeholder={l.images}
          className="rounded-xl border border-white/15 bg-zinc-950/70 px-3 py-2 text-sm text-white md:col-span-2"
          rows={2}
        />
        <label className="rounded-xl border border-white/15 bg-zinc-950/70 px-3 py-2 text-xs text-zinc-200 md:col-span-2">
          {uploading === "create" ? l.uploading : l.uploadImages}
          <input
            type="file"
            multiple
            accept="image/*"
            className="mt-2 block w-full text-xs text-zinc-300"
            disabled={uploading === "create"}
            onChange={(event) => {
              void uploadImages(event.currentTarget.files, "create");
              event.currentTarget.value = "";
            }}
          />
        </label>
        <input
          value={createForm.priceCents}
          onChange={(event) => setCreateForm((prev) => ({ ...prev, priceCents: event.target.value }))}
          placeholder={l.price}
          className="rounded-xl border border-white/15 bg-zinc-950/70 px-3 py-2 text-sm text-white"
          inputMode="numeric"
          required
        />
        <input
          value={createForm.surfaceM2}
          onChange={(event) => setCreateForm((prev) => ({ ...prev, surfaceM2: event.target.value }))}
          placeholder={l.surface}
          className="rounded-xl border border-white/15 bg-zinc-950/70 px-3 py-2 text-sm text-white"
          inputMode="numeric"
          required
        />
        <div className="flex gap-2">
          <select
            value={createForm.listingType}
            onChange={(event) =>
              setCreateForm((prev) => ({
                ...prev,
                listingType: event.target.value as DraftCreate["listingType"],
              }))
            }
            className="w-full rounded-xl border border-white/15 bg-zinc-950/70 px-3 py-2 text-sm text-white"
          >
            <option value="SALE">{l.listingTypeSale}</option>
            <option value="RENT">{l.listingTypeRent}</option>
          </select>
          <select
            value={createForm.propertyType}
            onChange={(event) =>
              setCreateForm((prev) => ({
                ...prev,
                propertyType: event.target.value as DraftCreate["propertyType"],
              }))
            }
            className="w-full rounded-xl border border-white/15 bg-zinc-950/70 px-3 py-2 text-sm text-white"
          >
            <option value="APARTMENT">{l.propertyApartment}</option>
            <option value="HOUSE">{l.propertyHouse}</option>
            <option value="LAND">{l.propertyLand}</option>
            <option value="COMMERCIAL">{l.propertyCommercial}</option>
            <option value="OTHER">{l.propertyOther}</option>
          </select>
        </div>
        {agencies.length > 0 ? (
          <select
            value={createForm.publisherId}
            onChange={(event) =>
              setCreateForm((prev) => ({
                ...prev,
                publisherId: event.target.value,
              }))
            }
            className="rounded-xl border border-white/15 bg-zinc-950/70 px-3 py-2 text-sm text-white"
          >
            <option value="">{l.agency}</option>
            {agencies.map((agency) => (
              <option key={agency.id} value={agency.id}>
                {agency.name}
              </option>
            ))}
          </select>
        ) : null}
        <button
          type="submit"
          disabled={saving === "create"}
          className="rounded-xl bg-emerald-400 px-4 py-2 text-sm font-semibold text-zinc-950 disabled:opacity-60"
        >
          {saving === "create" ? "..." : l.create}
        </button>
      </form>

      {message ? <p className="mt-3 text-sm text-emerald-300">{message}</p> : null}
      {error ? <p className="mt-3 text-sm text-rose-300">{error}</p> : null}

      <div className="mt-8 space-y-4">
        {listings.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-zinc-950/40 p-4 text-sm text-zinc-300">
            {l.empty}
          </div>
        ) : (
          listings.map((listing) => {
            const draft = editForm[listing.id];
            const isEditable = listing.status === "DRAFT" || listing.status === "PAUSED";

            return (
              <article key={listing.id} className="rounded-2xl border border-white/10 bg-zinc-950/40 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-lg font-semibold text-white">{listing.title}</h2>
                  <span className="rounded-full border border-white/20 px-3 py-1 text-xs text-zinc-200">
                    {statusLabel(locale, listing.status)}
                  </span>
                </div>
                {listing.imageUrls[0] ? (
                  <img
                    src={listing.imageUrls[0]}
                    alt={listing.title}
                    className="mt-3 h-36 w-full rounded-xl border border-white/10 object-cover"
                    loading="lazy"
                  />
                ) : null}
                <p className="mt-2 text-sm text-zinc-300">{formatMoney(listing.priceCents, listing.currency, locale)}</p>
                {listing.publisher?.name ? (
                  <p className="mt-1 text-xs text-zinc-400">{l.agency}: {listing.publisher.name}</p>
                ) : null}
                {listing.featuredUntil ? (
                  <p className="mt-1 text-xs text-amber-200">{l.featuredUntil} {new Date(listing.featuredUntil).toLocaleDateString(locale)}</p>
                ) : null}
                {listing.boostUntil ? (
                  <p className="mt-1 text-xs text-sky-200">{l.boostUntil} {new Date(listing.boostUntil).toLocaleDateString(locale)}</p>
                ) : null}
                {isEditable && draft ? (
                  <div className="mt-3 grid gap-2 md:grid-cols-2">
                    <input
                      value={draft.title}
                      onChange={(event) => updateEditField(listing.id, "title", event.target.value)}
                      className="rounded-xl border border-white/15 bg-zinc-900/70 px-3 py-2 text-sm text-white"
                    />
                    <input
                      value={draft.city}
                      onChange={(event) => updateEditField(listing.id, "city", event.target.value)}
                      className="rounded-xl border border-white/15 bg-zinc-900/70 px-3 py-2 text-sm text-white"
                    />
                    <input
                      value={draft.priceCents}
                      onChange={(event) => updateEditField(listing.id, "priceCents", event.target.value)}
                      className="rounded-xl border border-white/15 bg-zinc-900/70 px-3 py-2 text-sm text-white"
                    />
                    <input
                      value={draft.surfaceM2}
                      onChange={(event) => updateEditField(listing.id, "surfaceM2", event.target.value)}
                      className="rounded-xl border border-white/15 bg-zinc-900/70 px-3 py-2 text-sm text-white"
                    />
                    <textarea
                      value={draft.description}
                      onChange={(event) =>
                        updateEditField(listing.id, "description", event.target.value)
                      }
                      className="rounded-xl border border-white/15 bg-zinc-900/70 px-3 py-2 text-sm text-white md:col-span-2"
                      rows={2}
                    />
                    <textarea
                      value={draft.imageUrls}
                      onChange={(event) => updateEditField(listing.id, "imageUrls", event.target.value)}
                      className="rounded-xl border border-white/15 bg-zinc-900/70 px-3 py-2 text-sm text-white md:col-span-2"
                      rows={2}
                      placeholder={l.images}
                    />
                    <label className="rounded-xl border border-white/15 bg-zinc-900/70 px-3 py-2 text-xs text-zinc-200 md:col-span-2">
                      {uploading === listing.id ? l.uploading : l.uploadImages}
                      <input
                        type="file"
                        multiple
                        accept="image/*"
                        className="mt-2 block w-full text-xs text-zinc-300"
                        disabled={uploading === listing.id}
                        onChange={(event) => {
                          void uploadImages(event.currentTarget.files, listing.id);
                          event.currentTarget.value = "";
                        }}
                      />
                    </label>
                    {agencies.length > 0 ? (
                      <select
                        value={draft.publisherId}
                        onChange={(event) => updateEditField(listing.id, "publisherId", event.target.value)}
                        className="rounded-xl border border-white/15 bg-zinc-900/70 px-3 py-2 text-sm text-white md:col-span-2"
                      >
                        <option value="">{l.agency}</option>
                        {agencies.map((agency) => (
                          <option key={agency.id} value={agency.id}>
                            {agency.name}
                          </option>
                        ))}
                      </select>
                    ) : null}
                  </div>
                ) : null}

                <div className="mt-4 flex flex-wrap gap-2">
                  {isEditable ? (
                    <button
                      type="button"
                      onClick={() => void saveListing(listing.id)}
                      disabled={saving === `save:${listing.id}`}
                      className="rounded-full border border-white/20 px-3 py-1 text-xs font-semibold text-white disabled:opacity-60"
                    >
                      {saving === `save:${listing.id}` ? "..." : l.save}
                    </button>
                  ) : null}

                  {(listing.status === "DRAFT" || listing.status === "PAUSED") ? (
                    <button
                      type="button"
                      onClick={() => void changeStatus(listing.id, "publish")}
                      disabled={saving === `publish:${listing.id}`}
                      className="rounded-full bg-emerald-400 px-3 py-1 text-xs font-semibold text-zinc-950 disabled:opacity-60"
                    >
                      {saving === `publish:${listing.id}` ? "..." : l.publish}
                    </button>
                  ) : null}

                  {listing.status === "PUBLISHED" ? (
                    <button
                      type="button"
                      onClick={() => void changeStatus(listing.id, "pause")}
                      disabled={saving === `pause:${listing.id}`}
                      className="rounded-full border border-white/20 px-3 py-1 text-xs font-semibold text-white disabled:opacity-60"
                    >
                      {saving === `pause:${listing.id}` ? "..." : l.pause}
                    </button>
                  ) : null}

                  {listing.status !== "ARCHIVED" ? (
                    <button
                      type="button"
                      onClick={() => void changeStatus(listing.id, "archive")}
                      disabled={saving === `archive:${listing.id}`}
                      className="rounded-full border border-rose-300/40 px-3 py-1 text-xs font-semibold text-rose-100 disabled:opacity-60"
                    >
                      {saving === `archive:${listing.id}` ? "..." : l.archive}
                    </button>
                  ) : null}

                  {listing.status === "PUBLISHED" && listing.publisherId ? (
                    <button
                      type="button"
                      onClick={() => void startMonetization(listing.id, "FEATURED")}
                      disabled={monetizationPending[listing.id] === true}
                      className="rounded-full border border-amber-300/40 px-3 py-1 text-xs font-semibold text-amber-100 disabled:opacity-60"
                    >
                      {monetizationPending[listing.id] ? "..." : l.monetizationFeatured}
                    </button>
                  ) : null}

                  {listing.status === "PUBLISHED" && listing.publisherId ? (
                    <button
                      type="button"
                      onClick={() => void startMonetization(listing.id, "BOOST")}
                      disabled={monetizationPending[listing.id] === true}
                      className="rounded-full border border-sky-300/40 px-3 py-1 text-xs font-semibold text-sky-100 disabled:opacity-60"
                    >
                      {monetizationPending[listing.id] ? "..." : l.monetizationBoost}
                    </button>
                  ) : null}
                </div>
              </article>
            );
          })
        )}
      </div>
    </section>
  );
}

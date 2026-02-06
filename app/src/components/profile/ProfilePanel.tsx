"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { formatMoney, getDiscountedPrice } from "@/lib/format";
import { useCart } from "@/components/cart/CartProvider";

type Profile = {
  id: string;
  email: string;
  name?: string | null;
  image?: string | null;
  phone?: string | null;
  role: string;
  createdAt: string;
};

type Activity = {
  id: string;
  action: string;
  createdAt: string;
};

type Favorite = {
  id: string;
  productId: string;
  product: {
    id: string;
    title: string;
    priceCents: number;
    discountPercent?: number | null;
    currency: string;
    slug: string;
    type: "PREORDER" | "DROPSHIP" | "LOCAL";
    images: { url: string; alt?: string | null }[];
    seller?: { displayName?: string | null } | null;
  };
};

export default function ProfilePanel() {
  const t = useTranslations("Profile");
  const locale = useLocale();
  const { addItem } = useCart();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [favoritesLoading, setFavoritesLoading] = useState(true);
  const [cartAddedIds, setCartAddedIds] = useState<Record<string, boolean>>({});
  const [kyc, setKyc] = useState({
    targetRole: "TRANSPORTER",
    docIdUrl: "",
    driverLicenseUrl: "",
    proofAddressUrl: "",
    selfieUrl: "",
    notes: "",
  });
  const [kycStatus, setKycStatus] = useState<string | null>(null);
  const [kycLoading, setKycLoading] = useState(false);
  const [kycUploadingField, setKycUploadingField] = useState<string | null>(
    null
  );
  const [kycPreviews, setKycPreviews] = useState<Record<string, string>>({});
  const [kycApproved, setKycApproved] = useState(false);
  const [kycSubmission, setKycSubmission] = useState<{
    id?: string;
    status?: string | null;
    docIdUrl?: string | null;
    driverLicenseUrl?: string | null;
    proofAddressUrl?: string | null;
    selfieUrl?: string | null;
  } | null>(null);
  const [showKycForm, setShowKycForm] = useState(false);
  const [selectedRole, setSelectedRole] = useState("TRANSPORTER");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const kycRef = useRef<HTMLDivElement | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [profileRes, favoritesRes] = await Promise.all([
        fetch("/api/profile"),
        fetch("/api/favorites"),
      ]);
      if (!profileRes.ok) {
        throw new Error(t("errors.load"));
      }
      const profileData = (await profileRes.json()) as Profile;
      setProfile(profileData);
      if (favoritesRes.ok) {
        const favoriteData = (await favoritesRes.json()) as Favorite[];
        setFavorites(favoriteData);
      }
      const kycRes = await fetch("/api/kyc/status");
      if (kycRes.ok) {
        const kycData = (await kycRes.json()) as {
          id?: string;
          status?: string | null;
          docIdUrl?: string | null;
          driverLicenseUrl?: string | null;
          proofAddressUrl?: string | null;
          selfieUrl?: string | null;
        };
        setKycStatus(kycData.status ?? null);
        setKycApproved(kycData.status === "APPROVED");
        setKycSubmission(kycData);
        setKyc((prev) => ({
          ...prev,
          docIdUrl: kycData.docIdUrl ?? prev.docIdUrl,
          driverLicenseUrl: kycData.driverLicenseUrl ?? prev.driverLicenseUrl,
          proofAddressUrl: kycData.proofAddressUrl ?? prev.proofAddressUrl,
          selfieUrl: kycData.selfieUrl ?? prev.selfieUrl,
        }));
        setKycPreviews((prev) => ({
          ...prev,
          docIdUrl: kycData.docIdUrl ?? prev.docIdUrl,
          driverLicenseUrl: kycData.driverLicenseUrl ?? prev.driverLicenseUrl,
          proofAddressUrl: kycData.proofAddressUrl ?? prev.proofAddressUrl,
          selfieUrl: kycData.selfieUrl ?? prev.selfieUrl,
        }));
        if (kycData.status) {
          setShowKycForm(false);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errors.load"));
    } finally {
      setLoading(false);
      setFavoritesLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (showKycForm) {
      kycRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [showKycForm]);

  const save = async () => {
    return;
  };

  const submitKyc = async () => {
    setKycLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/kyc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(kyc),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || t("errors.save"));
      }
      setKycStatus("PENDING");
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errors.save"));
    } finally {
      setKycLoading(false);
    }
  };

  const uploadField = async (
    field: keyof typeof kyc,
    file?: File | null
  ) => {
    if (!file) return;
    setKycUploadingField(field);
    setError(null);
    try {
      if (!file.type.startsWith("image/")) {
        throw new Error(t("kyc.errors.fileType"));
      }
      if (file.size > 2 * 1024 * 1024) {
        throw new Error(t("kyc.errors.fileSize"));
      }
      const data = new FormData();
      data.append("file", file);
      const res = await fetch("/api/upload", {
        method: "POST",
        body: data,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.error || t("errors.save"));
      }
      const json = (await res.json()) as { url: string };
      setKyc((prev) => ({ ...prev, [field]: json.url }));
      setKycPreviews((prev) => ({
        ...prev,
        [field]: URL.createObjectURL(file),
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errors.save"));
    } finally {
      setKycUploadingField(null);
    }
  };

  const clearField = (field: keyof typeof kyc) => {
    setKyc((prev) => ({ ...prev, [field]: "" }));
    setKycPreviews((prev) => {
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  const chooseRole = (role: string) => {
    setSelectedRole(role);
    setKyc((prev) => ({ ...prev, targetRole: role }));
  };

  if (loading) {
    return (
      <div className="rounded-3xl border border-white/10 bg-zinc-900/70 p-8">
        <p className="text-sm text-zinc-400">{t("loading")}</p>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="rounded-3xl border border-white/10 bg-zinc-900/70 p-8">
        <p className="text-sm text-zinc-400">{t("errors.load")}</p>
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
      <div className="rounded-3xl border border-white/10 bg-zinc-900/70 p-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">{t("title")}</h1>
            <p className="mt-2 text-sm text-zinc-300">{t("subtitle")}</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="h-14 w-14 overflow-hidden rounded-full border border-white/10 bg-zinc-950/60">
              {profile.image ? (
                <img
                  src={profile.image}
                  alt={profile.name ?? profile.email}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-sm font-semibold text-zinc-300">
                  {(profile.name ?? profile.email ?? "?")
                    .slice(0, 1)
                    .toUpperCase()}
                </div>
              )}
            </div>
            <div className="text-xs text-zinc-400">
              <p className="text-sm font-semibold text-white">
                {profile.name ?? t("fields.name")}
              </p>
              <p>{profile.email}</p>
            </div>
          </div>
        </div>

        <div className="mt-6 grid gap-3 text-sm">
          <div className="rounded-2xl border border-white/10 bg-zinc-950/60 px-4 py-3 text-xs text-zinc-300">
            {t("fields.email")}: {profile.email}
          </div>
          <div className="rounded-2xl border border-white/10 bg-zinc-950/60 px-4 py-3 text-xs text-zinc-300">
            {t("fields.role")}: {profile.role}
          </div>
        </div>

        {error && <p className="mt-3 text-sm text-rose-300">{error}</p>}

        <div className="mt-6 flex flex-wrap gap-3 text-xs">
          <Link
            href="/profile/edit"
            className="rounded-full border border-white/20 px-4 py-2 text-white transition hover:border-white/40"
          >
            {t("actions.edit")}
          </Link>
          <Link
            href="/orders"
            className="rounded-full border border-white/20 px-4 py-2 text-white transition hover:border-white/40"
          >
            {t("actions.orders")}
          </Link>
          <Link
            href="/favorites"
            className="rounded-full border border-white/20 px-4 py-2 text-white transition hover:border-white/40"
          >
            {t("actions.favorites")}
          </Link>
          <Link
            href="/activity"
            className="rounded-full border border-white/20 px-4 py-2 text-white transition hover:border-white/40"
          >
            {t("actions.activity")}
          </Link>
        </div>

        <div className="mt-8 rounded-3xl border border-white/10 bg-zinc-950/70 p-5">
          <h3 className="text-sm font-semibold text-white">
            {t("shortcuts.title")}
          </h3>
          <p className="mt-1 text-xs text-zinc-400">
            {t("shortcuts.subtitle")}
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <Link
              href="/orders"
              className="rounded-2xl border border-white/10 bg-zinc-950/60 px-4 py-4 text-left text-xs text-white transition hover:border-emerald-400/40"
            >
              <p className="text-sm font-semibold">{t("shortcuts.orders")}</p>
              <p className="mt-1 text-[11px] text-zinc-400">
                {t("shortcuts.ordersDesc")}
              </p>
            </Link>
            <Link
              href="/orders"
              className="rounded-2xl border border-white/10 bg-zinc-950/60 px-4 py-4 text-left text-xs text-white transition hover:border-emerald-400/40"
            >
              <p className="text-sm font-semibold">{t("shortcuts.purchases")}</p>
              <p className="mt-1 text-[11px] text-zinc-400">
                {t("shortcuts.purchasesDesc")}
              </p>
            </Link>
            <Link
              href="/favorites"
              className="rounded-2xl border border-white/10 bg-zinc-950/60 px-4 py-4 text-left text-xs text-white transition hover:border-emerald-400/40"
            >
              <p className="text-sm font-semibold">{t("shortcuts.favorites")}</p>
              <p className="mt-1 text-[11px] text-zinc-400">
                {t("shortcuts.favoritesDesc")}
              </p>
            </Link>
          </div>
        </div>

        <div className="mt-6 rounded-3xl border border-white/10 bg-zinc-950/70 p-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-white">
                {t("favorites.title")}
              </h3>
              <p className="mt-1 text-xs text-zinc-400">
                {t("favorites.subtitle")}
              </p>
            </div>
            <div className="flex items-center gap-3 text-xs">
              {!favoritesLoading && favorites.length > 0 && (
                <span className="rounded-full border border-white/10 px-3 py-1 text-[11px] text-zinc-300">
                  {t("favorites.count", { count: favorites.length })}
                </span>
              )}
            <Link
              href="/favorites"
              className="text-xs text-emerald-200 transition hover:text-emerald-100"
            >
              {t("favorites.viewAll")}
            </Link>
            </div>
          </div>

          {favoritesLoading && (
            <p className="mt-4 text-xs text-zinc-400">{t("favorites.loading")}</p>
          )}

          {!favoritesLoading && favorites.length === 0 && (
            <p className="mt-4 text-xs text-zinc-500">{t("favorites.empty")}</p>
          )}

          {!favoritesLoading && favorites.length > 0 && (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {favorites.slice(0, 4).map((fav) => (
                <div
                  key={fav.id}
                  className="group rounded-2xl border border-white/10 bg-zinc-950/60 p-3 transition hover:border-emerald-400/40"
                >
                  <Link href={`/shop/${fav.product.slug}`} className="block">
                    <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-zinc-900">
                      {fav.product.images?.[0]?.url ? (
                        <img
                          src={fav.product.images[0].url}
                          alt={fav.product.images[0].alt ?? fav.product.title}
                          className="h-full w-full object-cover"
                        />
                      ) : null}
                      <span className="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-rose-300 transition group-hover:scale-110 group-hover:text-rose-200">
                        <svg
                          viewBox="0 0 24 24"
                          fill="currentColor"
                          className="h-4 w-4"
                        >
                          <path d="M12 21s-7.5-4.35-9.5-8.5C1 8.5 3.5 6 6.5 6c1.9 0 3.4 1 4.5 2.4C12.1 7 13.6 6 15.5 6 18.5 6 21 8.5 21.5 12.5 19.5 16.65 12 21 12 21z" />
                        </svg>
                      </span>
                    </div>
                    <p className="mt-3 text-xs font-semibold text-white">
                      {fav.product.title}
                    </p>
                    <p className="mt-1 text-[11px] text-zinc-400">
                      {fav.product.seller?.displayName ?? t("favorites.unknown")}
                    </p>
                    <p className="mt-2 text-xs text-emerald-200">
                      {fav.product.discountPercent ? (
                        <>
                          {formatMoney(
                            getDiscountedPrice(
                              fav.product.priceCents,
                              fav.product.discountPercent
                            ),
                            fav.product.currency,
                            locale
                          )}
                        </>
                      ) : (
                        formatMoney(
                          fav.product.priceCents,
                          fav.product.currency,
                          locale
                        )
                      )}
                    </p>
                  </Link>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const discountedCents = getDiscountedPrice(
                          fav.product.priceCents,
                          fav.product.discountPercent
                        );
                        const finalPrice = fav.product.discountPercent
                          ? discountedCents
                          : fav.product.priceCents;
                        addItem({
                          id: fav.product.id,
                          slug: fav.product.slug,
                          title: fav.product.title,
                          priceCents: finalPrice,
                          currency: fav.product.currency,
                          type: fav.product.type,
                          sellerName: fav.product.seller?.displayName ?? undefined,
                        });
                        setCartAddedIds((prev) => ({
                          ...prev,
                          [fav.product.id]: true,
                        }));
                        setTimeout(() => {
                          setCartAddedIds((prev) => ({
                            ...prev,
                            [fav.product.id]: false,
                          }));
                        }, 1400);
                      }}
                      className="inline-flex items-center gap-2 rounded-full bg-emerald-400 px-4 py-2 text-[11px] font-semibold text-zinc-950"
                    >
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        className="h-3.5 w-3.5"
                      >
                        <path
                          d="M6 6h15l-1.5 8.5H7.5L6 6Z"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        <path
                          d="M6 6H4"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        <circle cx="9" cy="19" r="1.5" />
                        <circle cx="17" cy="19" r="1.5" />
                      </svg>
                      {cartAddedIds[fav.product.id]
                        ? t("favorites.added")
                        : t("favorites.addToCart")}
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        await fetch(`/api/favorites?productId=${fav.productId}`, {
                          method: "DELETE",
                        });
                        load();
                      }}
                      className="inline-flex items-center gap-2 rounded-full border border-white/15 px-4 py-2 text-[11px] text-white transition hover:border-rose-300/60"
                    >
                      <svg
                        viewBox="0 0 24 24"
                        fill="currentColor"
                        className="h-3.5 w-3.5 text-rose-300"
                      >
                        <path d="M12 21s-7.5-4.35-9.5-8.5C1 8.5 3.5 6 6.5 6c1.9 0 3.4 1 4.5 2.4C12.1 7 13.6 6 15.5 6 18.5 6 21 8.5 21.5 12.5 19.5 16.65 12 21 12 21z" />
                      </svg>
                      {t("favorites.remove")}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {["SELLER", "COURIER", "TRANSPORTER"].includes(profile.role) && (
          <div className="mt-6 rounded-2xl border border-emerald-400/30 bg-emerald-400/10 p-4 text-xs text-emerald-100">
            <p>{t("roles.active")}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {profile.role === "SELLER" && (
                <Link
                  href="/seller"
                  className="rounded-full bg-emerald-400 px-4 py-2 text-[11px] font-semibold text-zinc-950"
                >
                  {t("roles.goSeller")}
                </Link>
              )}
              {profile.role === "COURIER" && (
                <Link
                  href="/stores/jontaado-tiak-tiak"
                  className="rounded-full bg-emerald-400 px-4 py-2 text-[11px] font-semibold text-zinc-950"
                >
                  {t("roles.goCourier")}
                </Link>
              )}
              {profile.role === "TRANSPORTER" && (
                <Link
                  href="/stores/jontaado-gp"
                  className="rounded-full bg-emerald-400 px-4 py-2 text-[11px] font-semibold text-zinc-950"
                >
                  {t("roles.goTransporter")}
                </Link>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="rounded-3xl border border-white/10 bg-zinc-900/70 p-8">
        <h2 className="text-xl font-semibold">{t("roles.title")}</h2>
        <p className="mt-2 text-sm text-zinc-300">{t("roles.subtitle")}</p>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          {[
            { key: "SELLER", label: t("roles.seller") },
            { key: "COURIER", label: t("roles.courier") },
            { key: "TRANSPORTER", label: t("roles.transporter") },
          ].map((role) => (
            <button
              key={role.key}
              type="button"
              onClick={() => chooseRole(role.key)}
              className={`rounded-2xl border px-4 py-4 text-left text-xs transition ${
                selectedRole === role.key
                  ? "border-emerald-400/60 bg-emerald-400/10 text-emerald-100"
                  : "border-white/10 bg-zinc-950/60 text-white"
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/10">
                  {role.key === "SELLER" && (
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      className="h-5 w-5"
                    >
                      <path
                        d="M3 10.5L12 4l9 6.5v8a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1v-8Z"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  )}
                  {role.key === "COURIER" && (
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      className="h-5 w-5"
                    >
                      <path
                        d="M4 16h9l3-6h4l-2 6h-4"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <circle cx="7" cy="18" r="2" />
                      <circle cx="17" cy="18" r="2" />
                    </svg>
                  )}
                  {role.key === "TRANSPORTER" && (
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      className="h-5 w-5"
                    >
                      <path
                        d="M3 12l18-6-6 18-2-7-7-2Z"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  )}
                </span>
                <p className="text-sm font-semibold">{role.label}</p>
              </div>
              <p className="mt-2 text-xs text-zinc-400">
                {t(`roles.${role.key.toLowerCase()}Desc`)}
              </p>
            </button>
          ))}
        </div>
        {!showKycForm && (
          <p className="mt-4 text-xs text-zinc-500">
            {t("roles.chooseHint")}
          </p>
        )}
        <button
          type="button"
          onClick={() => {
            setKyc((prev) => ({ ...prev, targetRole: selectedRole }));
            setShowKycForm(true);
          }}
          className="mt-5 rounded-full bg-emerald-400 px-6 py-3 text-sm font-semibold text-zinc-950"
        >
          {t("roles.cta")}
        </button>
      </div>

      {(showKycForm || kycStatus) && (
        <div
          ref={kycRef}
          className="rounded-3xl border border-white/10 bg-zinc-900/70 p-8"
        >
          <h2 className="text-xl font-semibold">{t("kyc.title")}</h2>
          <p className="mt-2 text-sm text-zinc-300">{t("kyc.subtitle")}</p>
          {kycStatus && (
            <span
              className={`mt-3 inline-flex rounded-full px-3 py-1 text-xs ${
                kycStatus === "APPROVED"
                  ? "bg-emerald-400/20 text-emerald-200"
                  : kycStatus === "REJECTED"
                  ? "bg-rose-400/20 text-rose-200"
                  : "bg-amber-400/20 text-amber-200"
              }`}
            >
              {t(`kyc.status.${kycStatus.toLowerCase()}`)}
            </span>
          )}

          {kycApproved ? (
            <div className="mt-5 rounded-2xl border border-emerald-400/30 bg-emerald-400/10 p-4 text-xs text-emerald-100">
              {t("kyc.approvedNote")}
            </div>
          ) : showKycForm ? (
            <div className="mt-4 grid gap-3">
              <p className="text-xs text-zinc-500">{t("kyc.note")}</p>
              <div className="rounded-2xl border border-white/10 bg-zinc-950/60 px-4 py-3 text-sm text-white">
                {t("kyc.selectedRole")}:{" "}
                <span className="font-semibold">
                  {t(`kyc.roles.${kyc.targetRole.toLowerCase()}`)}
                </span>
              </div>
              {[
                { key: "docIdUrl", label: t("kyc.fields.docId") },
                { key: "driverLicenseUrl", label: t("kyc.fields.driver") },
                { key: "proofAddressUrl", label: t("kyc.fields.proof") },
                { key: "selfieUrl", label: t("kyc.fields.selfie") },
              ].map((field) => (
                <div key={field.key} className="grid gap-2">
                  <input
                    className="rounded-xl border border-white/10 bg-zinc-950/60 px-4 py-3 text-sm text-white outline-none"
                    placeholder={field.label}
                    value={(kyc as Record<string, string>)[field.key]}
                    onChange={(e) =>
                      setKyc((prev) => ({ ...prev, [field.key]: e.target.value }))
                    }
                  />
                  {kycPreviews[field.key] && (
                    <div className="overflow-hidden rounded-2xl border border-white/10">
                      <img
                        src={kycPreviews[field.key]}
                        alt="Preview"
                        className="h-28 w-full object-cover"
                      />
                    </div>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <label className="inline-flex cursor-pointer items-center justify-center rounded-xl border border-dashed border-white/20 px-4 py-2 text-[11px] text-zinc-300">
                      {kycUploadingField === field.key
                        ? t("kyc.uploading")
                        : t("kyc.upload")}
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          uploadField(field.key as keyof typeof kyc, file);
                          e.target.value = "";
                        }}
                      />
                    </label>
                    {(kyc as Record<string, string>)[field.key] && (
                      <button
                        type="button"
                        onClick={() => clearField(field.key as keyof typeof kyc)}
                        className="rounded-xl border border-white/15 px-4 py-2 text-[11px] text-white"
                      >
                        {t("kyc.remove")}
                      </button>
                    )}
                  </div>
                </div>
              ))}
              <textarea
                className="rounded-xl border border-white/10 bg-zinc-950/60 px-4 py-3 text-sm text-white outline-none"
                placeholder={t("kyc.fields.notes")}
                value={kyc.notes}
                onChange={(e) =>
                  setKyc((prev) => ({ ...prev, notes: e.target.value }))
                }
              />
            </div>
          ) : null}

          {!kycApproved && showKycForm && (
            <button
              type="button"
              onClick={submitKyc}
              disabled={
                kycLoading ||
                !kyc.docIdUrl ||
                !kyc.proofAddressUrl ||
                !kyc.selfieUrl
              }
              className="mt-6 rounded-full bg-emerald-400 px-6 py-3 text-sm font-semibold text-zinc-950 disabled:opacity-60"
            >
              {kycLoading ? t("kyc.loading") : t("kyc.submit")}
            </button>
          )}
          {!kycApproved && !showKycForm && (
            <button
              type="button"
              onClick={() => setShowKycForm(true)}
              className="mt-6 rounded-full border border-white/20 px-6 py-3 text-sm font-semibold text-white transition hover:border-white/40"
            >
              {t("kyc.resume")}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

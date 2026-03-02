"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { formatMoney, getDiscountedPrice } from "@/lib/format";
import { useCart } from "@/components/cart/CartProvider";
import { buildFormDefaults } from "@/lib/forms/prefill";
import { COUNTRIES, getCountryFlag } from "@/lib/locale/country";
import ProfileHeaderCard from "@/components/profile/ProfileHeaderCard";
import KycFlowPanel from "@/components/profile/KycFlowPanel";

type Profile = {
  id: string;
  email: string;
  name?: string | null;
  image?: string | null;
  phone?: string | null;
  role: string;
  roles?: string[];
  createdAt: string;
};

type Activity = {
  id: string;
  action: string;
  createdAt: string;
};

type GeoPayload = {
  geoCountry?: string | null;
};


const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Admin",
  CLIENT: "Client",
  CUSTOMER: "Client",
  SELLER: "Seller",
  PRESTA_PROVIDER: "Presta",
  GP_CARRIER: "GP",
  TRANSPORTER: "GP",
  TIAK_COURIER: "Tiak",
  COURIER: "Tiak",
  IMMO_AGENT: "Immo",
  IMMO_AGENCY: "Immo",
  CAR_DEALER: "Cars",
};

const ROLE_SHORTCUTS: Array<{ key: string; href: string; label: string }> = [
  { key: "SELLER", href: "/seller", label: "roles.goSeller" },
  { key: "PRESTA_PROVIDER", href: "/stores/jontaado-presta", label: "PRESTA" },
  { key: "TIAK_COURIER", href: "/stores/jontaado-tiak-tiak", label: "roles.goCourier" },
  { key: "COURIER", href: "/stores/jontaado-tiak-tiak", label: "roles.goCourier" },
  { key: "GP_CARRIER", href: "/stores/jontaado-gp", label: "roles.goTransporter" },
  { key: "TRANSPORTER", href: "/stores/jontaado-gp", label: "roles.goTransporter" },
  { key: "IMMO_AGENT", href: "/immo/my", label: "IMMO" },
];

function normalizeRoleKey(role: string): string {
  if (role === "TRANSPORTER") return "GP_CARRIER";
  if (role === "COURIER") return "TIAK_COURIER";
  if (role === "IMMO_AGENCY") return "IMMO_AGENT";
  if (role === "CAR_DEALER") return "SELLER";
  if (role === "CUSTOMER") return "CLIENT";
  return role;
}

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

type KycFieldKey =
  | "phoneVerified"
  | "addressCity"
  | "addressCountry"
  | "docIdUrl"
  | "driverLicenseUrl"
  | "selfieUrl"
  | "proofAddressUrl"
  | "passportUrl"
  | "proofTravelUrl"
  | "businessRegistrationUrl"
  | "companyName"
  | "companyAddress"
  | "companyRibUrl"
  | "legalRepIdUrl"
  | "legalRepSelfieUrl"
  | "professionalLicenseUrl";

type KycRequirement = {
  roleRequested: string;
  kycType: "INDIVIDUAL" | "BUSINESS";
  kycLevel: "BASIC" | "ENHANCED" | "PROFESSIONAL";
  requiredFields: KycFieldKey[];
  optionalFields: KycFieldKey[];
};

const KYC_UPLOAD_FIELDS = new Set<KycFieldKey>([
  "docIdUrl",
  "driverLicenseUrl",
  "selfieUrl",
  "proofAddressUrl",
  "passportUrl",
  "proofTravelUrl",
  "businessRegistrationUrl",
  "companyRibUrl",
  "legalRepIdUrl",
  "legalRepSelfieUrl",
  "professionalLicenseUrl",
]);

export default function ProfilePanel() {
  const t = useTranslations("Profile");
  const locale = useLocale();
  const { addItem } = useCart();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [favoritesLoading, setFavoritesLoading] = useState(true);
  const [cartAddedIds, setCartAddedIds] = useState<Record<string, boolean>>({});
  const [kyc, setKyc] = useState({
    targetRole: "SELLER",
    docIdUrl: "",
    passportUrl: "",
    driverLicenseUrl: "",
    proofTravelUrl: "",
    proofAddressUrl: "",
    selfieUrl: "",
    businessRegistrationUrl: "",
    companyName: "",
    companyAddress: "",
    companyRibUrl: "",
    legalRepIdUrl: "",
    legalRepSelfieUrl: "",
    professionalLicenseUrl: "",
    addressCity: "",
    addressCountry: "",
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
    targetRole?: string | null;
    kycType?: string | null;
    kycLevel?: string | null;
    docIdUrl?: string | null;
    passportUrl?: string | null;
    driverLicenseUrl?: string | null;
    proofTravelUrl?: string | null;
    proofAddressUrl?: string | null;
    selfieUrl?: string | null;
    businessRegistrationUrl?: string | null;
    companyName?: string | null;
    companyAddress?: string | null;
    companyRibUrl?: string | null;
    legalRepIdUrl?: string | null;
    legalRepSelfieUrl?: string | null;
    professionalLicenseUrl?: string | null;
    addressCity?: string | null;
    addressCountry?: string | null;
    notes?: string | null;
    reviewedAt?: string | null;
    reviewReason?: string | null;
  } | null>(null);
  const [showKycForm, setShowKycForm] = useState(false);
  const [selectedRole, setSelectedRole] = useState("SELLER");
  const [kycRequirement, setKycRequirement] = useState<KycRequirement | null>(null);
  const [kycRequirementLoading, setKycRequirementLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [profileRes, favoritesRes, geoRes] = await Promise.all([
        fetch("/api/profile"),
        fetch("/api/favorites"),
        fetch("/api/meta/geo", { cache: "no-store" }).catch(() => null),
      ]);
      if (!profileRes.ok) {
        throw new Error(t("errors.load"));
      }
      const profileData = (await profileRes.json()) as Profile;
      setProfile(profileData);

      const geoData = geoRes?.ok
        ? ((await geoRes.json().catch(() => null)) as GeoPayload | null)
        : null;
      const formDefaults = buildFormDefaults({
        sessionUser: { phone: profileData.phone ?? null },
        geoCountry: geoData?.geoCountry ?? null,
      });
      if (favoritesRes.ok) {
        const favoriteData = (await favoritesRes.json()) as Favorite[];
        setFavorites(favoriteData);
      }
      const kycRes = await fetch("/api/kyc/status");
      if (kycRes.ok) {
        const kycData = (await kycRes.json()) as {
          id?: string;
          status?: string | null;
          targetRole?: string | null;
          kycType?: string | null;
          kycLevel?: string | null;
          docIdUrl?: string | null;
          passportUrl?: string | null;
          driverLicenseUrl?: string | null;
          proofTravelUrl?: string | null;
          proofAddressUrl?: string | null;
          selfieUrl?: string | null;
          businessRegistrationUrl?: string | null;
          companyName?: string | null;
          companyAddress?: string | null;
          companyRibUrl?: string | null;
          legalRepIdUrl?: string | null;
          legalRepSelfieUrl?: string | null;
          professionalLicenseUrl?: string | null;
          addressCity?: string | null;
          addressCountry?: string | null;
          notes?: string | null;
          reviewedAt?: string | null;
          reviewReason?: string | null;
        };
        setKycStatus(kycData.status ?? null);
        setKycApproved(kycData.status === "APPROVED");
        setKycSubmission(kycData);
        if (kycData.targetRole) {
          setSelectedRole(kycData.targetRole);
        }
        setKyc((prev) => ({
          ...prev,
          targetRole: kycData.targetRole ?? prev.targetRole,
          docIdUrl: kycData.docIdUrl ?? prev.docIdUrl,
          passportUrl: kycData.passportUrl ?? prev.passportUrl,
          driverLicenseUrl: kycData.driverLicenseUrl ?? prev.driverLicenseUrl,
          proofTravelUrl: kycData.proofTravelUrl ?? prev.proofTravelUrl,
          proofAddressUrl: kycData.proofAddressUrl ?? prev.proofAddressUrl,
          selfieUrl: kycData.selfieUrl ?? prev.selfieUrl,
          businessRegistrationUrl: kycData.businessRegistrationUrl ?? prev.businessRegistrationUrl,
          companyName: kycData.companyName ?? prev.companyName,
          companyAddress: kycData.companyAddress ?? prev.companyAddress,
          companyRibUrl: kycData.companyRibUrl ?? prev.companyRibUrl,
          legalRepIdUrl: kycData.legalRepIdUrl ?? prev.legalRepIdUrl,
          legalRepSelfieUrl: kycData.legalRepSelfieUrl ?? prev.legalRepSelfieUrl,
          professionalLicenseUrl: kycData.professionalLicenseUrl ?? prev.professionalLicenseUrl,
          addressCity: kycData.addressCity ?? prev.addressCity,
          addressCountry: (kycData.addressCountry ?? prev.addressCountry) || formDefaults.country,
          notes: kycData.notes ?? prev.notes,
        }));
        setKycPreviews((prev) => ({
          ...prev,
          docIdUrl: kycData.docIdUrl ?? prev.docIdUrl,
          passportUrl: kycData.passportUrl ?? prev.passportUrl,
          driverLicenseUrl: kycData.driverLicenseUrl ?? prev.driverLicenseUrl,
          proofTravelUrl: kycData.proofTravelUrl ?? prev.proofTravelUrl,
          proofAddressUrl: kycData.proofAddressUrl ?? prev.proofAddressUrl,
          selfieUrl: kycData.selfieUrl ?? prev.selfieUrl,
          businessRegistrationUrl: kycData.businessRegistrationUrl ?? prev.businessRegistrationUrl,
          companyRibUrl: kycData.companyRibUrl ?? prev.companyRibUrl,
          legalRepIdUrl: kycData.legalRepIdUrl ?? prev.legalRepIdUrl,
          legalRepSelfieUrl: kycData.legalRepSelfieUrl ?? prev.legalRepSelfieUrl,
          professionalLicenseUrl: kycData.professionalLicenseUrl ?? prev.professionalLicenseUrl,
        }));
        if (kycData.status) {
          setShowKycForm(false);
        }
      }

      setKyc((prev) => ({
        ...prev,
        addressCountry: prev.addressCountry || formDefaults.country,
      }));
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
    let cancelled = false;

    const loadRequirement = async () => {
      setKycRequirementLoading(true);

      try {
        const params = new URLSearchParams({ role: selectedRole });
        const response = await fetch(`/api/kyc/requirements?${params.toString()}`, {
          cache: "no-store",
        });

        if (!response.ok) {
          if (!cancelled) setKycRequirement(null);
          return;
        }

        const payload = (await response.json().catch(() => null)) as KycRequirement | null;
        if (!cancelled) {
          setKycRequirement(payload);
        }
      } catch {
        if (!cancelled) setKycRequirement(null);
      } finally {
        if (!cancelled) setKycRequirementLoading(false);
      }
    };

    void loadRequirement();

    return () => {
      cancelled = true;
    };
  }, [selectedRole]);

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
      setShowKycForm(false);
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
      const isImage = file.type.startsWith("image/");
      const isPdf = file.type === "application/pdf";
      if (!isImage && !isPdf) {
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
      setKycPreviews((prev) => {
        const next = { ...prev };
        if (isImage) {
          next[field] = URL.createObjectURL(file);
        } else {
          delete next[field];
        }
        return next;
      });
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

  const rolesFromApi = Array.isArray(profile.roles) ? profile.roles : [];
  const normalizedRoles = Array.from(
    new Set(
      [...rolesFromApi, profile.role]
        .filter((role): role is string => Boolean(role))
        .map((role) => normalizeRoleKey(role))
    )
  );

  const roleLabels = normalizedRoles.map((role) => ROLE_LABELS[role] ?? role);
  const activeRoleShortcuts = ROLE_SHORTCUTS.filter((shortcut) =>
    normalizedRoles.includes(normalizeRoleKey(shortcut.key))
  );

  const isFr = locale === "fr";
  const roleOptions: Array<{ key: string; label: string; description: string }> = [
    {
      key: "SELLER",
      label: isFr ? "Vendeur" : "Seller",
      description: isFr
        ? "Compte particulier avec verification basique + piece d'identite (CNI ou passeport)."
        : "Individual seller account with basic verification + identity document (ID card or passport).",
    },
    {
      key: "GP_CARRIER",
      label: isFr ? "Transporteur GP" : "GP Carrier",
      description: isFr
        ? "Transport international (France ? Senegal) avec passeport."
        : "International transport (France ? Senegal) with passport.",
    },
    {
      key: "TIAK_COURIER",
      label: isFr ? "Coursier Tiak" : "Tiak Courier",
      description: isFr
        ? "Livraison locale avec CNI ou passeport, plus permis."
        : "Local delivery with ID card or passport, plus driver license.",
    },
    {
      key: "IMMO_AGENCY",
      label: isFr ? "Agence immo" : "Immo Agency",
      description: isFr
        ? "Entreprise: RCCM/NINEA ou KBIS/SIRET + RIB entreprise."
        : "Business: RCCM/NINEA or KBIS/SIRET + company RIB.",
    },
    {
      key: "CAR_DEALER",
      label: isFr ? "Concessionnaire auto" : "Car Dealer",
      description: isFr
        ? "Entreprise automobile avec dossier professionnel complet."
        : "Automotive business with full professional dossier.",
    },
  ];

  const fieldLabels: Record<KycFieldKey, string> = {
    phoneVerified: isFr ? "Numero de telephone renseigne" : "Phone number on profile",
    addressCity: isFr ? "Ville" : "City",
    addressCountry: isFr ? "Pays" : "Country",
    docIdUrl: isFr ? "URL piece d'identite (CNI ou passeport)" : "Identity document URL (ID card or passport)",
    driverLicenseUrl: isFr ? "URL permis" : "Driver license URL",
    selfieUrl: isFr ? "URL selfie" : "Selfie URL",
    proofAddressUrl: isFr ? "URL justificatif de domicile" : "Proof of address URL",
    passportUrl: isFr ? "URL passeport" : "Passport URL",
    proofTravelUrl: isFr ? "URL justificatif voyage (optionnel au publish)" : "Travel proof URL (optional at trip publish)",
    businessRegistrationUrl: isFr
      ? "URL immatriculation entreprise (FR: KBIS/SIRET, SN: RCCM/NINEA)"
      : "Business registration URL (FR: KBIS/SIRET, SN: RCCM/NINEA)",
    companyName: isFr ? "Nom de l'entreprise" : "Company name",
    companyAddress: isFr ? "Adresse entreprise" : "Company address",
    companyRibUrl: isFr ? "URL RIB entreprise" : "Company RIB URL",
    legalRepIdUrl: isFr ? "URL piece d'identite representant legal" : "Legal representative ID card URL",
    legalRepSelfieUrl: isFr ? "URL selfie representant legal" : "Legal representative selfie URL",
    professionalLicenseUrl: isFr ? "URL licence/carte pro (optionnel)" : "Professional license/card URL (optional)",
  };

  const requiredFields = kycRequirement?.requiredFields ?? [];
  const optionalFields = kycRequirement?.optionalFields ?? [];

  const isFieldFilled = (field: KycFieldKey) => {
    if (field === "phoneVerified") {
      return Boolean(profile.phone?.trim());
    }
    return Boolean((kyc as Record<string, string>)[field]?.trim());
  };

  const visibleKycFields = Array.from(
    new Set([...requiredFields, ...optionalFields].filter((field) => field !== "phoneVerified"))
  );

  const missingRequiredFields = requiredFields.filter((field) => !isFieldFilled(field));

  const canSubmitKyc =
    !kycLoading &&
    requiredFields.length > 0 &&
    missingRequiredFields.length === 0;

  const quickActions = [
    { href: "/profile/edit", label: t("actions.edit") },
    { href: "/orders", label: t("actions.orders") },
    { href: "/favorites", label: t("actions.favorites") },
    { href: "/activity", label: t("actions.activity") },
  ];

  const statCards = [
    { label: isFr ? "Commandes" : "Orders", value: "--" },
    { label: isFr ? "Achats" : "Purchases", value: "--" },
    {
      label: isFr ? "Favoris" : "Favorites",
      value: favoritesLoading ? "..." : String(favorites.length),
    },
  ];

  return (
    <>
      <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-6">
          <ProfileHeaderCard
            profile={profile}
            title={t("title")}
            subtitle={t("subtitle")}
            roleLabels={roleLabels}
            quickActions={quickActions}
            stats={statCards}
            error={error}
          />

          <div className="rounded-3xl border border-white/10 bg-zinc-900/70 p-5">
            <h3 className="text-sm font-semibold text-white">{t("shortcuts.title")}</h3>
            <p className="mt-1 text-xs text-zinc-400">{t("shortcuts.subtitle")}</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <Link
                href="/orders"
                className="rounded-2xl border border-white/10 bg-zinc-950/60 px-4 py-4 text-left text-xs text-white transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-emerald-400/40"
              >
                <p className="text-sm font-semibold">{t("shortcuts.orders")}</p>
                <p className="mt-1 text-[11px] text-zinc-400">{t("shortcuts.ordersDesc")}</p>
              </Link>
              <Link
                href="/orders"
                className="rounded-2xl border border-white/10 bg-zinc-950/60 px-4 py-4 text-left text-xs text-white transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-emerald-400/40"
              >
                <p className="text-sm font-semibold">{t("shortcuts.purchases")}</p>
                <p className="mt-1 text-[11px] text-zinc-400">{t("shortcuts.purchasesDesc")}</p>
              </Link>
              <Link
                href="/favorites"
                className="rounded-2xl border border-white/10 bg-zinc-950/60 px-4 py-4 text-left text-xs text-white transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-emerald-400/40"
              >
                <p className="text-sm font-semibold">{t("shortcuts.favorites")}</p>
                <p className="mt-1 text-[11px] text-zinc-400">{t("shortcuts.favoritesDesc")}</p>
              </Link>
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-zinc-900/70 p-5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-white">{t("favorites.title")}</h3>
                <p className="mt-1 text-xs text-zinc-400">{t("favorites.subtitle")}</p>
              </div>
              <div className="flex items-center gap-3 text-xs">
                {!favoritesLoading && favorites.length > 0 && (
                  <span className="rounded-full border border-white/10 px-3 py-1 text-[11px] text-zinc-300">
                    {t("favorites.count", { count: favorites.length })}
                  </span>
                )}
                <Link href="/favorites" className="text-xs text-emerald-200 transition hover:text-emerald-100">
                  {t("favorites.viewAll")}
                </Link>
              </div>
            </div>

            {favoritesLoading && <p className="mt-4 text-xs text-zinc-400">{t("favorites.loading")}</p>}

            {!favoritesLoading && favorites.length === 0 && (
              <p className="mt-4 text-xs text-zinc-500">{t("favorites.empty")}</p>
            )}

            {!favoritesLoading && favorites.length > 0 && (
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {favorites.slice(0, 4).map((fav) => (
                  <div
                    key={fav.id}
                    className="group rounded-2xl border border-white/10 bg-zinc-950/60 p-3 transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-emerald-400/40"
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
                          <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
                            <path d="M12 21s-7.5-4.35-9.5-8.5C1 8.5 3.5 6 6.5 6c1.9 0 3.4 1 4.5 2.4C12.1 7 13.6 6 15.5 6 18.5 6 21 8.5 21.5 12.5 19.5 16.65 12 21 12 21z" />
                          </svg>
                        </span>
                      </div>
                      <p className="mt-3 text-xs font-semibold text-white">{fav.product.title}</p>
                      <p className="mt-1 text-[11px] text-zinc-400">{fav.product.seller?.displayName ?? t("favorites.unknown")}</p>
                      <p className="mt-2 text-xs text-emerald-200">
                        {fav.product.discountPercent
                          ? formatMoney(
                              getDiscountedPrice(fav.product.priceCents, fav.product.discountPercent),
                              fav.product.currency,
                              locale
                            )
                          : formatMoney(fav.product.priceCents, fav.product.currency, locale)}
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
                          <path d="M6 6h15l-1.5 8.5H7.5L6 6Z" strokeLinecap="round" strokeLinejoin="round" />
                          <path d="M6 6H4" strokeLinecap="round" strokeLinejoin="round" />
                          <circle cx="9" cy="19" r="1.5" />
                          <circle cx="17" cy="19" r="1.5" />
                        </svg>
                        {cartAddedIds[fav.product.id] ? t("favorites.added") : t("favorites.addToCart")}
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
                        <svg viewBox="0 0 24 24" fill="currentColor" className="h-3.5 w-3.5 text-rose-300">
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

          {activeRoleShortcuts.length > 0 && (
            <div className="rounded-2xl border border-emerald-400/30 bg-emerald-400/10 p-4 text-xs text-emerald-100">
              <p>{t("roles.active")}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {activeRoleShortcuts.map((shortcut) => (
                  <Link
                    key={`${shortcut.key}-${shortcut.href}`}
                    href={shortcut.href}
                    className="rounded-full bg-emerald-400 px-4 py-2 text-[11px] font-semibold text-zinc-950"
                  >
                    {shortcut.label.startsWith("roles.") ? t(shortcut.label) : shortcut.label}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <section className="rounded-3xl border border-white/10 bg-zinc-900/70 p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-[11px] uppercase tracking-[0.14em] text-zinc-500">
                  {isFr ? "Devenir partenaire" : "Become partner"}
                </p>
                <h2 className="mt-1 text-xl font-semibold text-white">{t("roles.title")}</h2>
                <p className="mt-2 text-sm text-zinc-300">{t("roles.subtitle")}</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-zinc-950/70 p-2 text-[11px] text-zinc-300">
                <p className="font-semibold">1. {isFr ? "Choisir le role" : "Choose role"}</p>
                <p className="mt-1">2. {isFr ? "Envoyer le dossier" : "Submit dossier"}</p>
              </div>
            </div>

            {kycStatus ? (
              <div className="mt-4 rounded-2xl border border-white/10 bg-zinc-950/65 p-3 text-xs text-zinc-200">
                <div className="flex items-center justify-between gap-3">
                  <span
                    className={`inline-flex rounded-full px-3 py-1 text-[11px] ${
                      kycStatus === "APPROVED"
                        ? "bg-emerald-400/20 text-emerald-200"
                        : kycStatus === "REJECTED"
                        ? "bg-rose-400/20 text-rose-200"
                        : "bg-amber-400/20 text-amber-200"
                    }`}
                  >
                    {t(`kyc.status.${kycStatus.toLowerCase()}`)}
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowKycForm(true)}
                    className="rounded-full border border-white/15 px-3 py-1.5 text-[11px] font-medium text-white transition hover:border-white/40"
                  >
                    {isFr ? "Voir mon dossier" : "View my dossier"}
                  </button>
                </div>
                {kycStatus === "REJECTED" && kycSubmission?.reviewReason ? (
                  <p className="mt-2 text-[11px] text-rose-200">{kycSubmission.reviewReason}</p>
                ) : null}
              </div>
            ) : null}

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {roleOptions.map((role) => (
                <button
                  key={role.key}
                  type="button"
                  onClick={() => chooseRole(role.key)}
                  className={`rounded-2xl border px-4 py-4 text-left text-xs transition-all duration-200 ease-out hover:-translate-y-0.5 ${
                    selectedRole === role.key
                      ? "border-emerald-400/60 bg-emerald-400/10 text-emerald-100 shadow-[0_12px_30px_rgba(16,185,129,0.12)]"
                      : "border-white/10 bg-zinc-950/60 text-white hover:border-white/30"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold">{role.label}</p>
                    <span
                      className={`inline-flex h-5 w-5 items-center justify-center rounded-full border text-[10px] ${
                        selectedRole === role.key
                          ? "border-emerald-300 bg-emerald-300 text-zinc-900"
                          : "border-white/30 text-zinc-500"
                      }`}
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-current" />
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-zinc-400">{role.description}</p>
                </button>
              ))}
            </div>

            <p className="mt-4 text-xs text-zinc-500">{t("roles.chooseHint")}</p>

            <button
              type="button"
              onClick={() => {
                setKyc((prev) => ({ ...prev, targetRole: selectedRole }));
                setShowKycForm(true);
              }}
              className="mt-5 rounded-full bg-emerald-400 px-6 py-3 text-sm font-semibold text-zinc-950 transition hover:brightness-105"
            >
              {t("roles.cta")}
            </button>
          </section>
        </div>
      </div>

      <KycFlowPanel
        open={showKycForm}
        onClose={() => setShowKycForm(false)}
        title={t("kyc.title")}
        subtitle={t("kyc.subtitle")}
      >
        {kycStatus && (
          <span
            className={`inline-flex rounded-full px-3 py-1 text-xs ${
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

        {kycStatus === "REJECTED" && kycSubmission?.reviewReason ? (
          <div className="mt-3 rounded-2xl border border-rose-400/30 bg-rose-400/10 p-4 text-xs text-rose-100">
            <p className="font-semibold">{isFr ? "Motif de refus" : "Rejection reason"}</p>
            <p className="mt-1 text-rose-50/90">{kycSubmission.reviewReason}</p>
          </div>
        ) : null}

        {kycApproved ? (
          <div className="mt-5 rounded-2xl border border-emerald-400/30 bg-emerald-400/10 p-4 text-xs text-emerald-100">
            {t("kyc.approvedNote")}
          </div>
        ) : (
          <div className="mt-4 grid gap-3">
            <p className="text-xs text-zinc-500">{t("kyc.note")}</p>
            <div className="rounded-2xl border border-white/10 bg-zinc-950/60 px-4 py-3 text-sm text-white">
              <p>
                {t("kyc.selectedRole")}: <span className="font-semibold">{selectedRole}</span>
              </p>
              <p className="mt-1 text-xs text-zinc-400">
                {isFr ? "Type" : "Type"}: {kycRequirement?.kycType ?? "-"} - {isFr ? "Niveau" : "Level"}: {kycRequirement?.kycLevel ?? "-"}
              </p>
            </div>

            {kycRequirementLoading ? (
              <p className="text-xs text-zinc-500">{isFr ? "Chargement des exigences..." : "Loading requirements..."}</p>
            ) : null}

            {requiredFields.length > 0 ? (
              <div className="rounded-2xl border border-amber-400/30 bg-amber-400/10 px-4 py-3">
                <p className="text-xs font-semibold text-amber-100">
                  {isFr ? "Documents requis pour ce role" : "Required documents for this role"}
                </p>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-[11px] text-amber-50">
                  {requiredFields.map((field) => (
                    <li key={`required-${field}`}>{fieldLabels[field]}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            {optionalFields.length > 0 ? (
              <div className="rounded-2xl border border-white/10 bg-zinc-950/50 px-4 py-3">
                <p className="text-xs font-semibold text-zinc-200">
                  {isFr ? "Documents optionnels" : "Optional documents"}
                </p>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-[11px] text-zinc-400">
                  {optionalFields.map((field) => (
                    <li key={`optional-${field}`}>{fieldLabels[field]}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            {missingRequiredFields.includes("phoneVerified") ? (
              <p className="text-xs text-rose-300">
                {isFr
                  ? "Numero de telephone requis: ajoute ton numero sur ton profil."
                  : "Phone number required: add your phone number on your profile."}
              </p>
            ) : null}

            {visibleKycFields.map((field) => {
              const isUploadField = KYC_UPLOAD_FIELDS.has(field);
              const value = (kyc as Record<string, string>)[field] ?? "";
              const isRequired = requiredFields.includes(field);

              return (
                <div key={field} className="grid gap-2">
                  {field === "addressCountry" ? (
                    <select
                      className="rounded-xl border border-white/10 bg-zinc-950/60 px-4 py-3 text-sm text-white outline-none"
                      value={value}
                      onChange={(e) =>
                        setKyc((prev) => ({ ...prev, [field]: e.target.value }))
                      }
                    >
                      {COUNTRIES.map((country) => (
                        <option key={country.code} value={country.code}>
                          {`${getCountryFlag(country.code)} ${country.name}`.trim()}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      className="rounded-xl border border-white/10 bg-zinc-950/60 px-4 py-3 text-sm text-white outline-none"
                      placeholder={`${fieldLabels[field]}${isRequired ? " *" : ""}`}
                      value={value}
                      onChange={(e) =>
                        setKyc((prev) => ({ ...prev, [field]: e.target.value }))
                      }
                    />
                  )}
                  {kycPreviews[field] ? (
                    <div className="overflow-hidden rounded-2xl border border-white/10">
                      <img
                        src={kycPreviews[field]}
                        alt="Preview"
                        className="h-28 w-full object-cover"
                      />
                    </div>
                  ) : null}
                  {isUploadField ? (
                    <div className="flex flex-wrap gap-2">
                      <label className="inline-flex cursor-pointer items-center justify-center rounded-xl border border-dashed border-white/20 px-4 py-2 text-[11px] text-zinc-300">
                        {kycUploadingField === field ? t("kyc.uploading") : t("kyc.upload")}
                        <input
                          type="file"
                          accept="image/*,application/pdf"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            uploadField(field as keyof typeof kyc, file);
                            e.target.value = "";
                          }}
                        />
                      </label>
                      {value ? (
                        <button
                          type="button"
                          onClick={() => clearField(field as keyof typeof kyc)}
                          className="rounded-xl border border-white/15 px-4 py-2 text-[11px] text-white"
                        >
                          {t("kyc.remove")}
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              );
            })}

            <textarea
              className="rounded-xl border border-white/10 bg-zinc-950/60 px-4 py-3 text-sm text-white outline-none"
              placeholder={t("kyc.fields.notes")}
              value={kyc.notes}
              onChange={(e) =>
                setKyc((prev) => ({ ...prev, notes: e.target.value }))
              }
            />
          </div>
        )}

        {!kycApproved && (
          <button
            type="button"
            onClick={submitKyc}
            disabled={!canSubmitKyc}
            className="mt-6 rounded-full bg-emerald-400 px-6 py-3 text-sm font-semibold text-zinc-950 disabled:opacity-60"
          >
            {kycLoading ? t("kyc.loading") : t("kyc.submit")}
          </button>
        )}
      </KycFlowPanel>
    </>
  );
}








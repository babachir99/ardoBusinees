"use client";

import { useMemo } from "react";
import { usePathname } from "next/navigation";
import { Link, useRouter } from "@/i18n/navigation";
import Image from "next/image";

type InternalNavigationHeaderProps = {
  locale: string;
};

const LABELS = {
  fr: {
    home: "Accueil",
    about: "A propos",
    activity: "Activite",
    admin: "Admin",
    auto: "Auto",
    cars: "Cars",
    cart: "Panier",
    categories: "Categories",
    checkout: "Paiement",
    dealers: "Concessionnaires",
    edit: "Modifier",
    favorites: "Favoris",
    forgot: "Mot de passe oublie",
    gp: "GP",
    immo: "Immo",
    kyc: "KYC",
    login: "Connexion",
    messages: "Messagerie",
    monetization: "Monetisation",
    new: "Nouveau",
    orders: "Commandes",
    payouts: "Payouts",
    privacy: "Confidentialite",
    products: "Produits",
    profile: "Profil",
    receipts: "Recus",
    report: "Signaler",
    reset: "Reinitialisation",
    security: "Securite",
    seller: "Vendeur",
    sellers: "Vendeurs",
    shipments: "Expeditions",
    shop: "Marketplace",
    signup: "Inscription",
    stores: "Boutiques",
    terms: "Conditions",
    transporter: "Transporteur",
    transporters: "Transporteurs",
    trust: "Trust Center",
    users: "Utilisateurs",
    verify: "Verification",
    jontaadoCares: "JONTAADO Cares",
    jontaadoCars: "JONTAADO Cars",
    jontaadoGp: "JONTAADO GP",
    jontaadoImmo: "JONTAADO Immo",
    jontaadoPresta: "JONTAADO Presta",
    jontaadoTiak: "JONTAADO Tiak Tiak",
    detail: "Detail",
    back: "Retour",
    currentPage: "Page actuelle",
  },
  en: {
    home: "Home",
    about: "About",
    activity: "Activity",
    admin: "Admin",
    auto: "Auto",
    cars: "Cars",
    cart: "Cart",
    categories: "Categories",
    checkout: "Checkout",
    dealers: "Dealers",
    edit: "Edit",
    favorites: "Favorites",
    forgot: "Forgot password",
    gp: "GP",
    immo: "Real estate",
    kyc: "KYC",
    login: "Login",
    messages: "Messages",
    monetization: "Monetization",
    new: "New",
    orders: "Orders",
    payouts: "Payouts",
    privacy: "Privacy",
    products: "Products",
    profile: "Profile",
    receipts: "Receipts",
    report: "Report",
    reset: "Reset",
    security: "Security",
    seller: "Seller",
    sellers: "Sellers",
    shipments: "Shipments",
    shop: "Marketplace",
    signup: "Sign up",
    stores: "Stores",
    terms: "Terms",
    transporter: "Transporter",
    transporters: "Transporters",
    trust: "Trust Center",
    users: "Users",
    verify: "Verification",
    jontaadoCares: "JONTAADO Cares",
    jontaadoCars: "JONTAADO Cars",
    jontaadoGp: "JONTAADO GP",
    jontaadoImmo: "JONTAADO Immo",
    jontaadoPresta: "JONTAADO Presta",
    jontaadoTiak: "JONTAADO Tiak Tiak",
    detail: "Detail",
    back: "Back",
    currentPage: "Current page",
  },
} as const;

function titleCase(value: string) {
  return value.replace(/\b\w/g, (char) => char.toUpperCase());
}

function humanizeSegment(segment: string) {
  return titleCase(
    decodeURIComponent(segment)
      .replace(/[-_]+/g, " ")
      .trim()
  );
}

function looksLikeOpaqueId(segment: string) {
  return segment.length >= 16 && /^[a-z0-9]+$/i.test(segment);
}

function normalizeSegmentLabel(segment: string, locale: string) {
  const copy = LABELS[locale as "fr" | "en"] ?? LABELS.fr;
  const byKey: Record<string, string> = {
    "jontaado-cares": copy.jontaadoCares,
    "jontaado-cars": copy.jontaadoCars,
    "jontaado-gp": copy.jontaadoGp,
    "jontaado-immo": copy.jontaadoImmo,
    "jontaado-presta": copy.jontaadoPresta,
    "jontaado-tiak-tiak": copy.jontaadoTiak,
  };

  if (segment in copy) {
    return copy[segment as keyof typeof copy] as string;
  }

  if (segment in byKey) {
    return byKey[segment];
  }

  if (looksLikeOpaqueId(segment)) {
    return copy.detail;
  }

  return humanizeSegment(segment);
}

export default function InternalNavigationHeader({
  locale,
}: InternalNavigationHeaderProps) {
  const pathname = usePathname();
  const router = useRouter();
  const copy = LABELS[locale as "fr" | "en"] ?? LABELS.fr;

  const meta = useMemo(() => {
    const rawPath = pathname || `/${locale}`;
    const withoutLocale = rawPath.replace(new RegExp(`^/${locale}(?=/|$)`), "") || "/";
    const segments = withoutLocale.split("/").filter(Boolean);

    if (segments.length === 0) {
      return null;
    }

    const breadcrumbs = segments.map((segment, index) => ({
      label: normalizeSegmentLabel(segment, locale),
      href: `/${segments.slice(0, index + 1).join("/")}`,
      isLast: index === segments.length - 1,
    }));

    const parentHref = segments.length > 1 ? `/${segments.slice(0, -1).join("/")}` : "/";
    const parentLabel =
      breadcrumbs.length > 1 ? breadcrumbs[breadcrumbs.length - 2]?.label ?? copy.home : copy.home;
    const currentLabel = breadcrumbs[breadcrumbs.length - 1]?.label ?? copy.home;

    return {
      breadcrumbs,
      currentLabel,
      parentLabel,
      parentHref,
    };
  }, [copy.home, locale, pathname]);

  const rawPath = pathname || `/${locale}`;
  const withoutLocale = rawPath.replace(new RegExp(`^/${locale}(?=/|$)`), "") || "/";
  const hideForMarketplaceStores = /^\/stores\/jontaado-(cars|gp|immo|cares|presta|tiak-tiak)(\/|$)/.test(
    withoutLocale
  );

  if (!meta || hideForMarketplaceStores) {
    return null;
  }

  const handleBack = () => {
    if (
      typeof window !== "undefined" &&
      window.history.length > 1 &&
      (!document.referrer || document.referrer.startsWith(window.location.origin))
    ) {
      router.back();
      return;
    }

    router.push(meta.parentHref);
  };

  return (
    <div className="sticky top-0 z-40 border-b border-white/8 bg-zinc-950/80 backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-6xl items-center gap-3 px-4 py-3 sm:px-6">
        <Link href="/" className="hidden shrink-0 items-center sm:flex">
          <Image
            src="/logo.png"
            alt="JONTAADO logo"
            width={120}
            height={120}
            className="h-[52px] w-auto"
            priority
          />
        </Link>

        <div className="min-w-0 flex flex-1 items-center gap-2 rounded-2xl border border-white/8 bg-zinc-900/70 px-2 py-2 shadow-[0_10px_30px_rgba(0,0,0,0.25)]">
          <button
            type="button"
            onClick={handleBack}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/12 bg-zinc-950/75 text-zinc-100 transition hover:border-emerald-300/35 hover:bg-zinc-800/80 focus:outline-none focus:ring-2 focus:ring-emerald-400/35"
            aria-label={copy.back}
            title={copy.back}
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 20 20"
              className="h-4 w-4 fill-none stroke-current stroke-[1.8]"
            >
              <path d="M12.5 4.5 7 10l5.5 5.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          <div className="min-w-0 flex-1 px-1">
            <p className="truncate text-[10px] uppercase tracking-[0.18em] text-zinc-500">
              {meta.parentHref === "/" ? copy.home : meta.parentLabel}
            </p>
            <p className="truncate text-sm font-semibold text-zinc-100 sm:text-[15px]">
              {meta.currentLabel}
            </p>
          </div>

          {meta.parentHref !== "/" ? (
            <Link
              href={meta.parentHref}
              className="hidden rounded-full border border-white/12 bg-zinc-950/75 px-3 py-2 text-xs font-medium text-zinc-200 transition hover:border-emerald-300/35 hover:bg-zinc-800/75 md:inline-flex"
            >
              {meta.parentLabel}
            </Link>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Link
            href="/"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/12 bg-zinc-900/65 text-zinc-200 transition hover:border-white/35 hover:bg-zinc-800/75 sm:h-11 sm:w-auto sm:px-4"
            title={copy.home}
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 20 20"
              className="h-4 w-4 fill-none stroke-current stroke-[1.8]"
            >
              <path
                d="M3.5 8.5 10 3l6.5 5.5v7a1 1 0 0 1-1 1h-3.5v-4.5h-4V16.5H4.5a1 1 0 0 1-1-1z"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span className="hidden sm:ml-2 sm:inline">{copy.home}</span>
          </Link>
        </div>
      </div>
    </div>
  );
}

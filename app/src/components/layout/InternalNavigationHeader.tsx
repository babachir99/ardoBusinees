"use client";

import { useMemo } from "react";
import { usePathname } from "next/navigation";
import { Link, useRouter } from "@/i18n/navigation";

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
    jontaadoCars: "JONTAADO Cars",
    jontaadoGp: "JONTAADO GP",
    jontaadoImmo: "JONTAADO Immo",
    jontaadoPresta: "JONTAADO Presta",
    jontaadoTiak: "JONTAADO Tiak Tiak",
    detail: "Detail",
    back: "Retour",
    backToParent: "Retour a {label}",
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
    jontaadoCars: "JONTAADO Cars",
    jontaadoGp: "JONTAADO GP",
    jontaadoImmo: "JONTAADO Immo",
    jontaadoPresta: "JONTAADO Presta",
    jontaadoTiak: "JONTAADO Tiak Tiak",
    detail: "Detail",
    back: "Back",
    backToParent: "Back to {label}",
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
      parentHref,
      backLabel:
        parentLabel && parentHref !== "/"
          ? copy.backToParent.replace("{label}", parentLabel)
          : copy.back,
    };
  }, [copy.back, copy.backToParent, copy.home, copy.detail, locale, pathname]);

  if (!meta) {
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
    <div className="border-b border-white/8 bg-zinc-950/70">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <div className="min-w-0 flex flex-1 items-center gap-3">
          <button
            type="button"
            onClick={handleBack}
            className="inline-flex h-10 shrink-0 items-center justify-center rounded-full border border-white/15 bg-zinc-900/70 px-3 text-sm font-medium text-zinc-100 transition hover:border-emerald-300/35 hover:bg-zinc-800/80 focus:outline-none focus:ring-2 focus:ring-emerald-400/35"
            aria-label={meta.backLabel}
            title={meta.backLabel}
          >
            <span aria-hidden="true" className="text-base leading-none">
              ←
            </span>
            <span className="ml-2 hidden sm:inline">{copy.back}</span>
          </button>

          <div className="min-w-0">
            <nav
              aria-label={copy.currentPage}
              className="flex max-w-full items-center gap-1 overflow-x-auto whitespace-nowrap text-[11px] uppercase tracking-[0.18em] text-zinc-500"
            >
              <Link href="/" className="transition hover:text-zinc-200">
                {copy.home}
              </Link>
              {meta.breadcrumbs.map((item) => (
                <span key={item.href} className="flex items-center gap-1">
                  <span aria-hidden="true">/</span>
                  {item.isLast ? (
                    <span className="text-zinc-300">{item.label}</span>
                  ) : (
                    <Link href={item.href} className="transition hover:text-zinc-200">
                      {item.label}
                    </Link>
                  )}
                </span>
              ))}
            </nav>
            <p className="truncate text-sm font-semibold text-zinc-100">{meta.currentLabel}</p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Link
            href={meta.parentHref}
            className="hidden rounded-full border border-white/15 bg-zinc-900/65 px-3 py-2 text-xs font-medium text-zinc-200 transition hover:border-emerald-300/35 hover:bg-zinc-800/75 md:inline-flex"
          >
            {meta.backLabel}
          </Link>
          <Link
            href="/"
            className="rounded-full border border-white/15 bg-zinc-900/65 px-3 py-2 text-xs font-medium text-zinc-200 transition hover:border-white/35 hover:bg-zinc-800/75"
          >
            {copy.home}
          </Link>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "@/i18n/navigation";
import GpTripPublisher from "@/components/gp/GpTripPublisher";

type PaymentMethod = "WAVE" | "ORANGE_MONEY" | "CARD" | "CASH";

type GpTripPublishModalProps = {
  locale: string;
  isLoggedIn: boolean;
  hasGpProfile: boolean;
  gpDisplayName?: string | null;
  defaultContactPhone?: string | null;
  defaultPaymentMethods?: PaymentMethod[] | null;
  profileHref?: string;
};

export default function GpTripPublishModal({
  locale,
  isLoggedIn,
  hasGpProfile,
  gpDisplayName,
  defaultContactPhone,
  defaultPaymentMethods,
  profileHref = "/profile",
}: GpTripPublishModalProps) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  const t = useMemo(
    () => ({
      cta: locale === "fr" ? "Publier un trajet" : "Add new trip",
      title: locale === "fr" ? "Publier un nouveau trajet" : "Publish a new trip",
      close: locale === "fr" ? "Fermer" : "Close",
      footer:
        locale === "fr"
          ? "Verifie les infos avant publication"
          : "Double-check trip info before publishing",
      signInTitle:
        locale === "fr"
          ? "Se connecter pour publier"
          : "Sign in to publish",
      signInHint:
        locale === "fr"
          ? "Connecte-toi pour creer une annonce GP."
          : "Sign in to create a GP listing.",
      signInCta: locale === "fr" ? "Se connecter" : "Sign in",
      createProfileTitle:
        locale === "fr"
          ? "Creer ton profil GP pour publier une annonce"
          : "Create your GP profile to publish a listing",
      createProfileHint:
        locale === "fr"
          ? "Un profil GP aide a inspirer confiance (nom, contact, paiements)."
          : "A GP profile builds trust (name, contact, payments).",
      createProfileCta:
        locale === "fr" ? "Creer mon profil GP" : "Create my GP profile",
      later: locale === "fr" ? "Plus tard" : "Later",
      greeting:
        gpDisplayName && locale === "fr"
          ? `Salut ${gpDisplayName}`
          : gpDisplayName
          ? `Hi ${gpDisplayName}`
          : null,
    }),
    [locale, gpDisplayName]
  );

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  const modal = (
    <div
      className={`fixed inset-0 z-[9998] transition-all duration-300 ${
        open ? "pointer-events-auto" : "pointer-events-none"
      }`}
      aria-hidden={!open}
    >
      <div
        className={`absolute inset-0 z-[9998] bg-black/70 transition-opacity duration-300 ${
          open ? "opacity-100" : "opacity-0"
        }`}
        onClick={() => setOpen(false)}
      />

      <div className="absolute inset-0 z-[9999] flex items-stretch justify-center md:items-center md:p-8">
        <div
          className={`w-full md:max-w-2xl transition-all duration-300 ${
            open ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0"
          }`}
          onClick={(event) => event.stopPropagation()}
        >
          <div className="h-[100dvh] overflow-hidden rounded-none border-y border-white/15 bg-zinc-900/95 shadow-2xl md:h-[90vh] md:rounded-3xl md:border">
            <div className="flex h-full min-h-0 flex-col overflow-hidden">
              <div className="sticky top-0 z-10 shrink-0 border-b border-white/10 bg-zinc-900/95 px-4 py-4 md:px-6">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-indigo-200">JONTAADO GP</p>
                    {t.greeting ? (
                      <p className="mt-1 text-xs font-semibold text-cyan-200">{t.greeting}</p>
                    ) : null}
                    <h3 className="mt-1 text-xl font-semibold text-white">{t.title}</h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-zinc-200 transition hover:border-white/30"
                  >
                    {t.close}
                  </button>
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 md:px-6 md:py-5">
                {!isLoggedIn ? (
                  <div className="rounded-2xl border border-white/10 bg-zinc-950/60 p-5 text-sm text-zinc-300">
                    <h4 className="text-base font-semibold text-white">{t.signInTitle}</h4>
                    <p className="mt-2 text-xs text-zinc-400">{t.signInHint}</p>
                    <Link
                      href="/login"
                      className="mt-4 inline-flex rounded-full bg-emerald-400 px-4 py-2 text-xs font-semibold text-zinc-950"
                    >
                      {t.signInCta}
                    </Link>
                  </div>
                ) : !hasGpProfile ? (
                  <div className="rounded-2xl border border-white/10 bg-zinc-950/60 p-5 text-sm text-zinc-300">
                    <h4 className="text-base font-semibold text-white">{t.createProfileTitle}</h4>
                    <p className="mt-2 text-xs text-zinc-400">{t.createProfileHint}</p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Link
                        href={profileHref}
                        className="inline-flex rounded-full bg-emerald-400 px-4 py-2 text-xs font-semibold text-zinc-950"
                      >
                        {t.createProfileCta}
                      </Link>
                      <button
                        type="button"
                        onClick={() => setOpen(false)}
                        className="inline-flex rounded-full border border-white/15 px-4 py-2 text-xs font-semibold text-zinc-200 transition hover:border-white/40"
                      >
                        {t.later}
                      </button>
                    </div>
                  </div>
                ) : (
                  <GpTripPublisher
                    locale={locale}
                    canPublish
                    gpDisplayName={gpDisplayName}
                    defaultContactPhone={defaultContactPhone}
                    defaultPaymentMethods={defaultPaymentMethods}
                    onPublished={() => setOpen(false)}
                  />
                )}
              </div>

              <div className="sticky bottom-0 z-10 shrink-0 border-t border-white/10 bg-zinc-900/95 px-4 py-3 md:px-6">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs text-zinc-400">{t.footer}</p>
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="rounded-lg border border-white/15 px-3 py-1.5 text-xs text-zinc-200 transition hover:border-white/40"
                  >
                    {t.close}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="h-11 rounded-xl bg-gradient-to-r from-indigo-400 to-cyan-400 px-5 text-sm font-semibold text-zinc-950 transition hover:brightness-110"
      >
        {t.cta}
      </button>

      {mounted ? createPortal(modal, document.body) : null}
    </>
  );
}

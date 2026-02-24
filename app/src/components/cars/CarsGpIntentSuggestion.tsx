"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/navigation";

type Props = {
  locale: string;
  listingId: string;
  fromCountry: string;
  fromCity: string;
  objectType: "PARTS" | "NONE";
};

export default function CarsGpIntentSuggestion({ locale, listingId, fromCountry, fromCity, objectType }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const t = {
    title: locale === "fr" ? "Transport international (GP)" : "International transport (GP)",
    hint:
      locale === "fr"
        ? "Suggestion douce: creer une intention de transport pour pre-remplir votre parcours GP. Aucun job n'est cree automatiquement."
        : "Soft suggestion: create a transport intent to prefill your GP journey. No job is created automatically.",
    cta: locale === "fr" ? "Continuer vers GP" : "Continue to GP",
    login: locale === "fr" ? "Se connecter" : "Sign in",
    authRequired: locale === "fr" ? "Connecte-toi pour creer une intention." : "Sign in to create an intent.",
    genericError: locale === "fr" ? "Impossible de creer l'intention." : "Unable to create intent.",
  };

  async function createIntent() {
    setBusy(true);
    setErrorMsg("");

    try {
      const response = await fetch("/api/orchestrator/intents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceVertical: "CARS",
          sourceEntityId: listingId,
          intentType: "TRANSPORT",
          objectType,
          fromCountry,
          fromCity,
          toCountry: fromCountry.toUpperCase() === "SN" ? null : "SN",
        }),
      });

      const body = (await response.json().catch(() => null)) as { error?: string; message?: string; intentId?: string } | null;
      if (response.status === 401) {
        router.push(`/login?callbackUrl=/cars/${listingId}`);
        return;
      }
      if (!response.ok || !body?.intentId) {
        setErrorMsg(body?.message ?? t.genericError);
        return;
      }

      router.push(`/gp?intentId=${encodeURIComponent(body.intentId)}`);
    } catch {
      setErrorMsg(t.genericError);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-6 rounded-2xl border border-cyan-300/20 bg-cyan-300/5 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-200">{t.title}</p>
      <p className="mt-2 text-sm text-zinc-300">{t.hint}</p>
      {errorMsg ? <p className="mt-2 text-xs text-rose-200">{errorMsg}</p> : null}
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void createIntent()}
          disabled={busy}
          className="rounded-full border border-cyan-300/40 px-4 py-2 text-xs font-semibold text-cyan-100 disabled:opacity-60"
        >
          {busy ? "..." : t.cta}
        </button>
      </div>
    </div>
  );
}

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "@/i18n/navigation";
import { formatMoney } from "@/lib/format";

type InquiryMessage = {
  id: string;
  body: string;
  attachmentUrl?: string | null;
  createdAt: string;
  senderId: string;
  sender?: { id: string; name?: string | null; email?: string | null; role?: string | null } | null;
};

type InquiryOffer = {
  id: string;
  amountCents: number;
  currency: string;
  quantity: number;
  status: "PENDING" | "ACCEPTED" | "REJECTED" | "CANCELED" | "EXPIRED";
  note?: string | null;
  createdAt: string;
};

type InquiryPayload = {
  blocked?: boolean;
  blockedMessage?: string | null;
  isSellerOwner: boolean;
  meId: string;
  productTitle?: string | null;
  messages: InquiryMessage[];
  offers: InquiryOffer[];
};

type ProductActionCardClientProps = {
  locale: string;
  productId: string;
  productType: "PREORDER" | "DROPSHIP" | "LOCAL";
  buyHref: string;
  isAuthenticated: boolean;
  isSellerOwner?: boolean;
  openChatDefault?: boolean;
  sellerPhoneHref?: string;
  sellerEmailHref?: string;
  sellerWhatsappHref?: string;
};

const offerStatusLabel: Record<string, { fr: string; en: string }> = {
  PENDING: { fr: "En attente", en: "Pending" },
  ACCEPTED: { fr: "Acceptee", en: "Accepted" },
  REJECTED: { fr: "Refusee", en: "Rejected" },
  CANCELED: { fr: "Annulee", en: "Canceled" },
  EXPIRED: { fr: "Expiree", en: "Expired" },
};

export default function ProductActionCardClient({
  locale,
  productId,
  productType,
  buyHref,
  isAuthenticated,
  isSellerOwner,
  openChatDefault,
  sellerPhoneHref,
  sellerEmailHref,
  sellerWhatsappHref,
}: ProductActionCardClientProps) {
  const isFr = locale === "fr";
  const [panel, setPanel] = useState<"none" | "chat" | "offer">("none");
  const [autoOpenedChat, setAutoOpenedChat] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [payload, setPayload] = useState<InquiryPayload | null>(null);

  const [messageDraft, setMessageDraft] = useState("");
  const [messageAttachmentUrl, setMessageAttachmentUrl] = useState<string | null>(null);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [uploadingMessageAttachment, setUploadingMessageAttachment] = useState(false);
  const [contactTemplateLoaded, setContactTemplateLoaded] = useState(false);

  const [offerAmount, setOfferAmount] = useState("");
  const [offerQuantity, setOfferQuantity] = useState(1);
  const [offerNote, setOfferNote] = useState("");
  const [sendingOffer, setSendingOffer] = useState(false);
  const [showExternalContacts, setShowExternalContacts] = useState(false);

  const disabledByOwner = Boolean(isSellerOwner || payload?.isSellerOwner);
  const blockedByTrust = Boolean(payload?.blocked);
  const canNegotiate = productType === "LOCAL";
  const hasExternalContacts = Boolean(sellerPhoneHref || sellerEmailHref || sellerWhatsappHref);

  const labels = useMemo(
    () => ({
      buy: isFr ? "Acheter" : "Buy",
      contact: isFr ? "Contacter le vendeur" : "Contact seller",
      offer: isFr ? "Faire une offre" : "Make an offer",
      whatsapp: "WhatsApp",
      call: isFr ? "Appeler le vendeur" : "Call seller",
      email: isFr ? "Envoyer un email" : "Send email",
      login: isFr ? "Se connecter" : "Sign in",
      chatTitle: isFr ? "Messagerie vendeur" : "Seller chat",
      chatPlaceholder: isFr ? "Ecris ton message..." : "Write your message...",
      send: isFr ? "Envoyer" : "Send",
      emptyChat: isFr ? "Aucun message pour le moment." : "No messages yet.",
      offerTitle: isFr ? "Proposer un prix" : "Make an offer",
      amount: isFr ? "Montant (XOF)" : "Amount (XOF)",
      quantity: isFr ? "Quantite" : "Quantity",
      note: isFr ? "Note (optionnelle)" : "Note (optional)",
      submitOffer: isFr ? "Envoyer l'offre" : "Send offer",
      myOffers: isFr ? "Mes offres" : "My offers",
      notAllowed: isFr
        ? "Action indisponible sur ton produit."
        : "Action unavailable on your own product.",
      blockedByTrust: isFr
        ? "Contact indisponible: un compte a bloque l'autre."
        : "Contact unavailable: one account has blocked the other.",
      loading: isFr ? "Chargement..." : "Loading...",
      localOnly: isFr
        ? "Messagerie et offres disponibles uniquement pour les produits locaux."
        : "Chat and offers are available only for local products.",
      moreContacts: isFr ? "Autres moyens de contact" : "Other contact options",
      hideContacts: isFr ? "Masquer" : "Hide",
    }),
    [isFr]
  );

  const loadInquiry = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/products/${productId}/inquiry`, { cache: "no-store" });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Request failed");
      }

      const data = (await res.json()) as InquiryPayload;
      setPayload(data);
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
      return null;
    } finally {
      setLoading(false);
    }
  }, [productId]);

  const toggleExternalContacts = async () => {
    if (!payload) {
      const latest = await loadInquiry();
      if (latest?.blocked) {
        return;
      }
    }

    setShowExternalContacts((value) => !value);
  };

  const openPanel = async (next: "chat" | "offer") => {
    if (!canNegotiate) {
      setError(labels.localOnly);
      return;
    }

    setError(null);
    setPanel(next);
    if (!payload) {
      await loadInquiry();
    }
  };

  useEffect(() => {
    if (!openChatDefault || autoOpenedChat) return;
    if (!isAuthenticated || disabledByOwner || blockedByTrust || !canNegotiate) return;

    setAutoOpenedChat(true);
    setPanel("chat");

    if (!payload) {
      void loadInquiry();
    }
  }, [autoOpenedChat, blockedByTrust, canNegotiate, disabledByOwner, isAuthenticated, loadInquiry, openChatDefault, payload]);

  useEffect(() => {
    if (!isAuthenticated || disabledByOwner || !canNegotiate || payload) return;
    void loadInquiry();
  }, [canNegotiate, disabledByOwner, isAuthenticated, loadInquiry, payload]);


  useEffect(() => {
    setContactTemplateLoaded(false);
  }, [productId]);

  useEffect(() => {
    if (!isAuthenticated) return;
    if (panel !== "chat") return;
    if (!canNegotiate || disabledByOwner || blockedByTrust) return;
    if (contactTemplateLoaded) return;
    if (messageDraft.trim().length > 0) return;

    const params = new URLSearchParams({ vertical: "SHOP" });
    const productTitle = payload?.productTitle;
    if (typeof productTitle === "string" && productTitle.trim().length > 0) {
      params.set("productTitle", productTitle);
    }

    let isCancelled = false;
    setContactTemplateLoaded(true);

    void fetch(`/api/messages/templates?${params.toString()}`, { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) return null;
        const data = (await res.json().catch(() => null)) as
          | { template?: { body?: string | null } }
          | null;
        return data?.template?.body?.trim() || null;
      })
      .then((body) => {
        if (isCancelled || !body) return;
        setMessageDraft((current) => (current.trim().length > 0 ? current : body));
      })
      .catch(() => null);

    return () => {
      isCancelled = true;
    };
  }, [
    blockedByTrust,
    canNegotiate,
    contactTemplateLoaded,
    disabledByOwner,
    isAuthenticated,
    messageDraft,
    panel,
    payload?.productTitle,
  ]);

  const uploadMessageAttachment = async (file: File) => {
    setUploadingMessageAttachment(true);
    setError(null);

    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: form });
      const data = await res.json().catch(() => null);
      if (!res.ok || typeof data?.url !== "string") {
        throw new Error(data?.error || "Upload failed");
      }
      setMessageAttachmentUrl(data.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploadingMessageAttachment(false);
    }
  };

  const sendMessage = async () => {
    const message = messageDraft.trim();
    if (!message && !messageAttachmentUrl) return;

    setSendingMessage(true);
    setError(null);

    try {
      const res = await fetch(`/api/products/${productId}/inquiry/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, attachmentUrl: messageAttachmentUrl }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Unable to send message");
      }

      const created = (await res.json()) as InquiryMessage;
      setMessageDraft("");
      setMessageAttachmentUrl(null);
      setPayload((current) => {
        if (!current) return current;
        return {
          ...current,
          messages: [...current.messages, created],
        };
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to send message");
    } finally {
      setSendingMessage(false);
    }
  };

  const submitOffer = async () => {
    const amountMajor = Number(offerAmount);
    if (!Number.isFinite(amountMajor) || amountMajor <= 0) {
      setError(isFr ? "Montant invalide" : "Invalid amount");
      return;
    }

    const amountCents = Math.round(amountMajor * 100);

    setSendingOffer(true);
    setError(null);

    try {
      const res = await fetch(`/api/products/${productId}/offers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amountCents,
          quantity: offerQuantity,
          note: offerNote,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Unable to submit offer");
      }

      const created = (await res.json()) as InquiryOffer;
      setOfferAmount("");
      setOfferNote("");
      setPayload((current) => {
        if (!current) return current;
        return {
          ...current,
          offers: [created, ...current.offers],
        };
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to submit offer");
    } finally {
      setSendingOffer(false);
    }
  };


  return (
    <div className="mt-4 grid gap-2">
      <a
        href={buyHref}
        className="inline-flex items-center justify-center rounded-xl bg-emerald-400 px-4 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-emerald-300"
      >
        {labels.buy}
      </a>

      {isAuthenticated ? (
        canNegotiate ? (
          blockedByTrust ? null : (
          <>
            <button
              type="button"
              onClick={() => openPanel("offer")}
              disabled={disabledByOwner || blockedByTrust}
              className="inline-flex items-center justify-center rounded-xl border border-white/25 bg-zinc-900/70 px-4 py-3 text-sm font-semibold text-white transition hover:border-white/45 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {labels.offer}
            </button>
            <button
              type="button"
              onClick={() => openPanel("chat")}
              disabled={disabledByOwner || blockedByTrust}
              className="inline-flex items-center justify-center rounded-xl border border-sky-300/50 bg-sky-300/10 px-4 py-3 text-sm font-semibold text-sky-200 transition hover:border-sky-300/80 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {labels.contact}
            </button>
          </>
          )
        ) : (
          <p className="rounded-xl border border-white/10 bg-zinc-900/60 px-3 py-2 text-xs text-zinc-400">
            {labels.localOnly}
          </p>
        )
      ) : (
        <Link
          href="/login"
          className="inline-flex items-center justify-center rounded-xl border border-white/25 bg-zinc-900/70 px-4 py-3 text-sm font-semibold text-white"
        >
          {labels.login}
        </Link>
      )}

      {canNegotiate && hasExternalContacts && isAuthenticated && !disabledByOwner && !blockedByTrust && (
        <button
          type="button"
          onClick={() => void toggleExternalContacts()}
          className="inline-flex items-center justify-center rounded-xl border border-white/20 bg-zinc-900/60 px-4 py-2 text-xs font-semibold text-zinc-300 transition hover:border-white/45"
        >
          {showExternalContacts ? labels.hideContacts : labels.moreContacts}
        </button>
      )}

      {canNegotiate && hasExternalContacts && showExternalContacts && isAuthenticated && !disabledByOwner && !blockedByTrust && (
        <div className="grid gap-2">
          {sellerPhoneHref && (
            <a
              href={sellerPhoneHref}
              className="inline-flex items-center justify-center rounded-xl border border-white/25 bg-zinc-900/70 px-4 py-3 text-sm font-semibold text-zinc-100 transition hover:border-white/45"
            >
              {labels.call}
            </a>
          )}

          {sellerEmailHref && (
            <a
              href={sellerEmailHref}
              className="inline-flex items-center justify-center rounded-xl border border-white/25 bg-zinc-900/70 px-4 py-3 text-sm font-semibold text-zinc-100 transition hover:border-white/45"
            >
              {labels.email}
            </a>
          )}

          {sellerWhatsappHref && (
            <a
              href={sellerWhatsappHref}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center rounded-xl border border-emerald-300/45 bg-emerald-300/10 px-4 py-3 text-sm font-semibold text-emerald-200 transition hover:border-emerald-300/80"
            >
              {labels.whatsapp}
            </a>
          )}
        </div>
      )}

      {error && <p className="text-xs text-rose-300">{error}</p>}
      {disabledByOwner && <p className="text-xs text-zinc-500">{labels.notAllowed}</p>}
      {blockedByTrust && <p className="text-xs text-rose-300">{payload?.blockedMessage || labels.blockedByTrust}</p>}
      {!canNegotiate && <p className="text-xs text-zinc-500">{labels.localOnly}</p>}

      {panel === "chat" && (
        <div className="mt-2 rounded-2xl border border-white/10 bg-zinc-950/70 p-3">
          <p className="text-xs uppercase tracking-wide text-zinc-400">{labels.chatTitle}</p>
          {loading ? (
            <p className="mt-2 text-xs text-zinc-500">{labels.loading}</p>
          ) : (
            <>
              <div className="mt-3 max-h-48 space-y-2 overflow-y-auto pr-1">
                {(payload?.messages?.length ?? 0) === 0 ? (
                  <p className="text-xs text-zinc-500">{labels.emptyChat}</p>
                ) : (
                  payload?.messages.map((msg) => {
                    const mine = msg.senderId === payload?.meId;
                    return (
                      <div key={msg.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                        <div className="max-w-[85%] rounded-xl border border-white/10 bg-zinc-900 px-3 py-2 text-xs text-zinc-200">
                          <p className="text-[10px] text-zinc-500">
                            {new Date(msg.createdAt).toLocaleString(locale)}
                          </p>
                          {msg.body ? <p className="mt-1 whitespace-pre-wrap">{msg.body}</p> : null}
                          {msg.attachmentUrl ? (
                            <a
                              href={msg.attachmentUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="mt-1 inline-flex text-[11px] text-emerald-300 underline"
                            >
                              {isFr ? "Voir la piece jointe" : "Open attachment"}
                            </a>
                          ) : null}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <input
                  value={messageDraft}
                  onChange={(event) => setMessageDraft(event.target.value)}
                  placeholder={labels.chatPlaceholder}
                  className="w-full rounded-xl border border-white/10 bg-zinc-900 px-3 py-2 text-xs text-white"
                />
                <label className="inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border border-neutral-800/70 bg-neutral-900/40 text-neutral-300 transition-all duration-200 ease-out hover:border-emerald-400/20 hover:bg-neutral-800/40 hover:text-neutral-100 focus-within:ring-2 focus-within:ring-emerald-400/40">
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/avif,image/gif"
                    className="hidden"
                    aria-label={isFr ? "Joindre un fichier" : "Attach a file"}
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (!file) return;
                      void uploadMessageAttachment(file);
                      event.currentTarget.value = "";
                    }}
                  />
                  <span className="sr-only">{isFr ? "Joindre" : "Attach"}</span>
                  {uploadingMessageAttachment ? (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4 animate-spin">
                      <path d="M12 3a9 9 0 1 0 9 9" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
                      <path d="m21.44 11.05-8.49 8.49a6 6 0 0 1-8.49-8.49l8.49-8.49a4 4 0 1 1 5.66 5.66l-8.5 8.5a2 2 0 0 1-2.82-2.83l7.78-7.78" />
                    </svg>
                  )}
                </label>
                <button
                  type="button"
                  onClick={sendMessage}
                  disabled={sendingMessage || (!messageDraft.trim() && !messageAttachmentUrl)}
                  className="rounded-xl bg-emerald-400 px-3 py-2 text-xs font-semibold text-zinc-950 disabled:opacity-60"
                >
                  {labels.send}
                </button>
              </div>
              {messageAttachmentUrl ? (
                <div className="mt-2 flex items-center gap-2 text-[11px] text-zinc-300">
                  <a href={messageAttachmentUrl} target="_blank" rel="noreferrer" className="truncate text-emerald-300 underline">
                    {isFr ? "Piece jointe prete" : "Attachment ready"}
                  </a>
                  <button
                    type="button"
                    onClick={() => setMessageAttachmentUrl(null)}
                    className="rounded-full border border-white/20 px-2 py-0.5 text-[10px]"
                  >
                    {isFr ? "Retirer" : "Remove"}
                  </button>
                </div>
              ) : null}
            </>
          )}
        </div>
      )}

      {panel === "offer" && (
        <div className="mt-2 rounded-2xl border border-white/10 bg-zinc-950/70 p-3">
          <p className="text-xs uppercase tracking-wide text-zinc-400">{labels.offerTitle}</p>

          <div className="mt-3 grid gap-2">
            <label className="text-xs text-zinc-400">{labels.amount}</label>
            <input
              type="number"
              min={1}
              value={offerAmount}
              onChange={(event) => setOfferAmount(event.target.value)}
              className="rounded-xl border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-white"
            />

            <label className="text-xs text-zinc-400">{labels.quantity}</label>
            <input
              type="number"
              min={1}
              max={99}
              value={offerQuantity}
              onChange={(event) => setOfferQuantity(Number(event.target.value || 1))}
              className="rounded-xl border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-white"
            />

            <label className="text-xs text-zinc-400">{labels.note}</label>
            <textarea
              value={offerNote}
              onChange={(event) => setOfferNote(event.target.value)}
              className="min-h-20 rounded-xl border border-white/10 bg-zinc-900 px-3 py-2 text-xs text-white"
            />

            <button
              type="button"
              onClick={submitOffer}
              disabled={sendingOffer}
              className="rounded-xl bg-emerald-400 px-4 py-2 text-xs font-semibold text-zinc-950 disabled:opacity-60"
            >
              {labels.submitOffer}
            </button>
          </div>

          <div className="mt-4">
            <p className="text-xs text-zinc-400">{labels.myOffers}</p>
            <div className="mt-2 grid gap-2">
              {(payload?.offers?.length ?? 0) === 0 ? (
                <p className="text-xs text-zinc-500">-</p>
              ) : (
                payload?.offers.map((offer) => (
                  <div
                    key={offer.id}
                    className="rounded-xl border border-white/10 bg-zinc-900/80 px-3 py-2"
                  >
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="font-semibold text-emerald-200">
                        {formatMoney(offer.amountCents, offer.currency, locale)} x{offer.quantity}
                      </span>
                      <span className="text-zinc-400">
                        {offerStatusLabel[offer.status]?.[isFr ? "fr" : "en"] ?? offer.status}
                      </span>
                    </div>
                    {offer.note && <p className="mt-1 text-xs text-zinc-500">{offer.note}</p>}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}



















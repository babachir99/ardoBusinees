"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import useAdaptivePolling from "@/components/messages/useAdaptivePolling";

type InquiryMessage = {
  id: string;
  body: string;
  attachmentUrl?: string | null;
  createdAt: string;
  senderId: string;
  sender?: {
    id: string;
    name?: string | null;
    email?: string | null;
    image?: string | null;
  } | null;
};

type InquiryChatThreadProps = {
  locale: string;
  inquiryId: string;
  meId: string;
  initialMessages: InquiryMessage[];
  onBackToList?: (() => void) | undefined;
};

function toErrorMessage(data: unknown, fallback: string) {
  const record = data && typeof data === "object" ? (data as Record<string, unknown>) : null;
  if (typeof record?.error === "string") return record.error;
  if (typeof record?.message === "string") return record.message;
  return fallback;
}

export default function InquiryChatThread({
  locale,
  inquiryId,
  meId,
  initialMessages,
  onBackToList,
}: InquiryChatThreadProps) {
  const isFr = locale === "fr";
  const [messages, setMessages] = useState(initialMessages);
  const [loading, setLoading] = useState(false);
  const [draft, setDraft] = useState("");
  const [attachmentUrl, setAttachmentUrl] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const pollIntervalMs = useAdaptivePolling({ active: Boolean(inquiryId) });

  const loadMessages = useCallback(
    async (silent = false) => {
      if (!silent) {
        setLoading(true);
      }

      try {
        const res = await fetch(`/api/inquiries/${inquiryId}/messages`, { cache: "no-store" });
        const data = await res.json().catch(() => null);
        if (!res.ok) {
          throw new Error(toErrorMessage(data, isFr ? "Conversation indisponible." : "Conversation unavailable."));
        }

        const nextMessages = Array.isArray(data?.messages) ? (data.messages as InquiryMessage[]) : [];
        setMessages(nextMessages);
        setError(null);
      } catch (err) {
        if (!silent) {
          setError(err instanceof Error ? err.message : isFr ? "Erreur de chargement." : "Loading failed.");
        }
      } finally {
        if (!silent) {
          setLoading(false);
        }
      }
    },
    [inquiryId, isFr]
  );

  useEffect(() => {
    void loadMessages(false);
  }, [loadMessages]);

  useEffect(() => {
    if (pollIntervalMs === null) return;

    const interval = window.setInterval(() => {
      void loadMessages(true);
    }, pollIntervalMs);

    return () => window.clearInterval(interval);
  }, [loadMessages, pollIntervalMs]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length]);

  const uploadAttachment = async (file: File) => {
    setUploadingAttachment(true);
    setError(null);

    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: form });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(toErrorMessage(data, isFr ? "Upload impossible." : "Upload failed."));
      }
      const url = typeof data?.url === "string" ? data.url : null;
      if (!url) {
        throw new Error(isFr ? "URL upload invalide." : "Invalid upload URL.");
      }
      setAttachmentUrl(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : isFr ? "Upload impossible." : "Upload failed.");
    } finally {
      setUploadingAttachment(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const sendMessage = async () => {
    const message = draft.trim();
    if ((!message && !attachmentUrl) || sending) return;

    setSending(true);
    setError(null);

    try {
      const res = await fetch(`/api/inquiries/${inquiryId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, attachmentUrl }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(toErrorMessage(data, isFr ? "Impossible d'envoyer." : "Unable to send message"));
      }

      const created = data as InquiryMessage;
      setDraft("");
      setAttachmentUrl(null);
      setMessages((current) => [...current, created]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to send message");
    } finally {
      setSending(false);
    }
  };

  return (
    <section className="rounded-3xl border border-white/10 bg-zinc-900/70 p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-xs uppercase tracking-[0.18em] text-zinc-400">
          {isFr ? "Conversation" : "Conversation"}
        </p>
        {onBackToList ? (
          <button
            type="button"
            onClick={onBackToList}
            className="rounded-full border border-white/15 px-2 py-1 text-[11px] text-zinc-200"
          >
            {isFr ? "Retour" : "Back"}
          </button>
        ) : null}
      </div>

      <div className="mt-2 flex h-[420px] flex-col rounded-2xl border border-white/10 bg-zinc-950/70">
        <div className="flex-1 overflow-y-auto p-3">
          {loading && messages.length === 0 ? (
            <div className="space-y-2">
              <div className="h-14 animate-pulse rounded-xl bg-zinc-900" />
              <div className="h-14 animate-pulse rounded-xl bg-zinc-900" />
              <div className="h-14 animate-pulse rounded-xl bg-zinc-900" />
            </div>
          ) : messages.length === 0 ? (
            <p className="text-xs text-zinc-500">
              {isFr ? "Aucun message pour le moment." : "No messages yet."}
            </p>
          ) : (
            <div className="space-y-2">
              {messages.map((message) => {
                const mine = message.senderId === meId;
                const senderLabel =
                  message.sender?.name || message.sender?.email || (isFr ? "Utilisateur" : "User");

                return (
                  <div key={message.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-[82%] rounded-2xl border px-3 py-2 text-sm ${
                        mine
                          ? "border-emerald-300/35 bg-emerald-300/10 text-emerald-50"
                          : "border-white/10 bg-zinc-900 text-zinc-100"
                      }`}
                    >
                      <p className="text-[11px] text-zinc-400">{senderLabel}</p>
                      {message.body ? <p className="mt-1 whitespace-pre-wrap break-words">{message.body}</p> : null}
                      {message.attachmentUrl ? (
                        <a
                          href={message.attachmentUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-1 inline-flex text-xs text-emerald-300 underline"
                        >
                          {isFr ? "Voir la piece jointe" : "Open attachment"}
                        </a>
                      ) : null}
                      <p className="mt-1 text-[10px] text-zinc-500">
                        {new Date(message.createdAt).toLocaleString(locale)}
                      </p>
                    </div>
                  </div>
                );
              })}
              <div ref={bottomRef} />
            </div>
          )}
        </div>

        <div className="border-t border-white/10 bg-zinc-950/90 p-3">
          <div className="flex items-center gap-2">
            <input
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  void sendMessage();
                }
              }}
              placeholder={isFr ? "Ecris ton message..." : "Write your message..."}
              className="flex-1 rounded-xl border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-white"
            />
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/avif,image/gif"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                void uploadAttachment(file);
              }}
              className="hidden"
            />
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingAttachment || sending}
                aria-label={isFr ? "Joindre un fichier" : "Attach a file"}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-neutral-800/70 bg-neutral-900/40 text-neutral-300 transition-all duration-200 ease-out hover:border-emerald-400/20 hover:bg-neutral-800/40 hover:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-emerald-400/40 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <span className="sr-only">{isFr ? "Joindre" : "Attach"}</span>
                {uploadingAttachment ? (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4 animate-spin">
                    <path d="M12 3a9 9 0 1 0 9 9" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
                    <path d="m21.44 11.05-8.49 8.49a6 6 0 0 1-8.49-8.49l8.49-8.49a4 4 0 1 1 5.66 5.66l-8.5 8.5a2 2 0 0 1-2.82-2.83l7.78-7.78" />
                  </svg>
                )}
              </button>
              <button
                type="button"
                onClick={() => void sendMessage()}
                disabled={sending || (!draft.trim() && !attachmentUrl)}
                className="inline-flex h-10 items-center justify-center rounded-full bg-emerald-400 px-4 text-sm font-semibold text-zinc-950 disabled:opacity-60"
              >
                {isFr ? "Envoyer" : "Send"}
              </button>
            </div>
          </div>

          {attachmentUrl ? (
            <div className="mt-2 flex items-center gap-2 text-xs text-zinc-300">
              <a href={attachmentUrl} target="_blank" rel="noreferrer" className="truncate text-emerald-300 underline">
                {isFr ? "Piece jointe prete" : "Attachment ready"}
              </a>
              <button
                type="button"
                onClick={() => setAttachmentUrl(null)}
                className="rounded-full border border-white/20 px-2 py-0.5 text-[10px]"
              >
                {isFr ? "Retirer" : "Remove"}
              </button>
            </div>
          ) : null}

          {error ? <p className="mt-2 text-xs text-rose-300">{error}</p> : null}
        </div>
      </div>
    </section>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";

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
}: InquiryChatThreadProps) {
  const isFr = locale === "fr";
  const [messages, setMessages] = useState(initialMessages);
  const [draft, setDraft] = useState("");
  const [attachmentUrl, setAttachmentUrl] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

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
      <p className="text-xs uppercase tracking-[0.18em] text-zinc-400">
        {isFr ? "Conversation" : "Conversation"}
      </p>

      <div className="mt-4 h-[420px] overflow-y-auto rounded-2xl border border-white/10 bg-zinc-950/70 p-3">
        {messages.length === 0 ? (
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

      <div className="mt-3 flex gap-2">
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
          className="w-full rounded-xl border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-white"
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
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploadingAttachment || sending}
          className="rounded-xl border border-white/20 px-3 py-2 text-sm text-zinc-200 disabled:opacity-60"
        >
          {uploadingAttachment ? (isFr ? "Upload..." : "Upload...") : isFr ? "Joindre" : "Attach"}
        </button>
        <button
          type="button"
          onClick={() => void sendMessage()}
          disabled={sending || (!draft.trim() && !attachmentUrl)}
          className="rounded-xl bg-emerald-400 px-4 py-2 text-sm font-semibold text-zinc-950 disabled:opacity-60"
        >
          {isFr ? "Envoyer" : "Send"}
        </button>
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

      {error && <p className="mt-2 text-xs text-rose-300">{error}</p>}
    </section>
  );
}

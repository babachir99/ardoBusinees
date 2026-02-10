"use client";

import { useEffect, useRef, useState } from "react";

type InquiryMessage = {
  id: string;
  body: string;
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

export default function InquiryChatThread({
  locale,
  inquiryId,
  meId,
  initialMessages,
}: InquiryChatThreadProps) {
  const isFr = locale === "fr";
  const [messages, setMessages] = useState(initialMessages);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length]);

  const sendMessage = async () => {
    const message = draft.trim();
    if (!message || sending) return;

    setSending(true);
    setError(null);

    try {
      const res = await fetch(`/api/inquiries/${inquiryId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Unable to send message");
      }

      const created = (await res.json()) as InquiryMessage;
      setDraft("");
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
                    <p className="mt-1 whitespace-pre-wrap break-words">{message.body}</p>
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
        <button
          type="button"
          onClick={() => void sendMessage()}
          disabled={sending}
          className="rounded-xl bg-emerald-400 px-4 py-2 text-sm font-semibold text-zinc-950 disabled:opacity-60"
        >
          {isFr ? "Envoyer" : "Send"}
        </button>
      </div>

      {error && <p className="mt-2 text-xs text-rose-300">{error}</p>}
    </section>
  );
}

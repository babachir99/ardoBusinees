import type { EmailProvider, EmailSendInput, EmailSendResult } from "@/lib/notifications/providers/EmailProvider";

const DEFAULT_API_URL = "https://api.resend.com/emails";

export class ResendProvider implements EmailProvider {
  private readonly apiKey: string;
  private readonly fromEmail: string;
  private readonly apiUrl: string;

  constructor(params: { apiKey: string; fromEmail: string; apiUrl?: string }) {
    this.apiKey = params.apiKey;
    this.fromEmail = params.fromEmail;
    this.apiUrl = params.apiUrl?.trim() || DEFAULT_API_URL;
  }

  async send(input: EmailSendInput): Promise<EmailSendResult> {
    const response = await fetch(this.apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        from: this.fromEmail,
        to: [input.toEmail],
        subject: input.subject,
        html: input.html,
        text: input.text,
      }),
    });

    const payload = (await response.json().catch(() => null)) as { id?: string; message?: string } | null;

    if (!response.ok) {
      throw new Error(payload?.message || `RESEND_HTTP_${response.status}`);
    }

    return {
      providerMessageId: payload?.id ?? null,
    };
  }
}

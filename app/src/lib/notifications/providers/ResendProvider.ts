import {
  EmailProviderError,
  type EmailProvider,
  type EmailSendInput,
  type EmailSendResult,
} from "@/lib/notifications/providers/EmailProvider";

const DEFAULT_API_URL = "https://api.resend.com/emails";

function isRetryableStatus(status: number) {
  return status === 408 || status === 409 || status === 425 || status === 429 || status >= 500;
}

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
    try {
      const response = await fetch(this.apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
          ...(input.idempotencyKey ? { "Idempotency-Key": input.idempotencyKey } : {}),
        },
        body: JSON.stringify({
          from: this.fromEmail,
          to: [input.toEmail],
          subject: input.subject,
          html: input.html,
          text: input.text,
        }),
      });

      const payload = (await response.json().catch(() => null)) as
        | { id?: string; message?: string }
        | null;

      if (!response.ok) {
        throw new EmailProviderError(
          payload?.message || `RESEND_HTTP_${response.status}`,
          {
            retryable: isRetryableStatus(response.status),
            code: `RESEND_HTTP_${response.status}`,
          }
        );
      }

      return {
        providerMessageId: payload?.id ?? null,
      };
    } catch (error) {
      if (error instanceof EmailProviderError) {
        throw error;
      }

      throw new EmailProviderError("RESEND_NETWORK_ERROR", {
        retryable: true,
        code: "RESEND_NETWORK_ERROR",
      });
    }
  }
}

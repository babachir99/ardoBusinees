export type EmailSendInput = {
  outboxId: string;
  dedupeKey: string;
  idempotencyKey?: string | null;
  toEmail: string;
  subject: string;
  html: string;
  text: string;
};

export type EmailSendResult = {
  providerMessageId?: string | null;
};

export interface EmailProvider {
  send(input: EmailSendInput): Promise<EmailSendResult>;
}

export class EmailProviderError extends Error {
  readonly retryable: boolean;
  readonly code?: string;

  constructor(message: string, options: { retryable: boolean; code?: string }) {
    super(message);
    this.name = "EmailProviderError";
    this.retryable = options.retryable;
    this.code = options.code;
  }
}

export function isRetryableEmailProviderError(error: unknown): boolean {
  if (error instanceof EmailProviderError) {
    return error.retryable;
  }

  return false;
}

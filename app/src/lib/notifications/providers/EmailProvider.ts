export type EmailSendInput = {
  outboxId: string;
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

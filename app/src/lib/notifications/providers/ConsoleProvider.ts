import type { EmailProvider, EmailSendInput, EmailSendResult } from "@/lib/notifications/providers/EmailProvider";

export class ConsoleProvider implements EmailProvider {
  async send(input: EmailSendInput): Promise<EmailSendResult> {
    console.log(
      JSON.stringify({
        ts: new Date().toISOString(),
        channel: "email.console",
        outboxId: input.outboxId,
        subject: input.subject,
      })
    );

    return {
      providerMessageId: `console:${input.outboxId}`,
    };
  }
}

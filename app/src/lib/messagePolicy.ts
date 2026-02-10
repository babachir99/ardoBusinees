export type MessagePolicyViolation =
  | "LINK_NOT_ALLOWED"
  | "EMAIL_NOT_ALLOWED"
  | "PHONE_NOT_ALLOWED";

const URL_PROTOCOL_REGEX = /(https?:\/\/|www\.)\S+/i;
const DOMAIN_REGEX = /\b[a-z0-9-]+\.(com|net|org|io|me|fr|sn|co|biz|app|dev)\b/i;
const EMAIL_REGEX = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
const CONTIGUOUS_PHONE_REGEX = /\b\d{8,15}\b/;
const PHONE_WITH_SEPARATOR_REGEX = /\b(?:\+?\d{1,3}[\s.-])?(?:\d{2,4}[\s.-]){2,}\d{2,4}\b/g;

function isLikelyDateToken(value: string): boolean {
  const token = value.trim();
  return (
    /^\d{4}[-/.]\d{2}[-/.]\d{2}$/.test(token) ||
    /^\d{2}[-/.]\d{2}[-/.]\d{4}$/.test(token)
  );
}

function hasPhoneWithSeparators(message: string): boolean {
  const matches = message.match(PHONE_WITH_SEPARATOR_REGEX);
  if (!matches) return false;

  for (const token of matches) {
    if (isLikelyDateToken(token)) continue;

    const digits = token.replace(/\D/g, "");
    const separators = (token.match(/[\s.-]/g) || []).length;

    if (digits.length >= 8 && digits.length <= 15 && separators >= 2) {
      return true;
    }
  }

  return false;
}

export function getMessagePolicyViolation(
  message: string
): MessagePolicyViolation | null {
  if (URL_PROTOCOL_REGEX.test(message) || DOMAIN_REGEX.test(message)) {
    return "LINK_NOT_ALLOWED";
  }

  if (EMAIL_REGEX.test(message)) {
    return "EMAIL_NOT_ALLOWED";
  }

  if (CONTIGUOUS_PHONE_REGEX.test(message) || hasPhoneWithSeparators(message)) {
    return "PHONE_NOT_ALLOWED";
  }

  return null;
}

export function getMessagePolicyErrorMessage(locale: "fr" | "en" = "en"): string {
  if (locale === "fr") {
    return "Le partage de liens, emails ou numeros de telephone est interdit dans la messagerie.";
  }

  return "Sharing links, emails, or phone numbers is not allowed in chat.";
}

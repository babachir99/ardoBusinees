const MAX_REDACTED_LENGTH = 500;

const EMAIL_REGEX = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const URL_REGEX = /https?:\/\/[^\s]+/gi;
const SECRET_PAIR_REGEX = /(token|secret|signature|sig|api[_-]?key|authorization|bearer|password)\s*[:=]\s*[^\s,;]+/gi;
const QUERYSTRING_REGEX = /\?[^\s#]+/g;

export function redactError(value: string | null | undefined): string | null {
  if (!value || typeof value !== "string") return null;

  let redacted = value
    .replace(EMAIL_REGEX, "[redacted-email]")
    .replace(URL_REGEX, "[redacted-url]")
    .replace(SECRET_PAIR_REGEX, "$1=[redacted]")
    .replace(QUERYSTRING_REGEX, "?[redacted]");

  if (redacted.length > MAX_REDACTED_LENGTH) {
    redacted = redacted.slice(0, MAX_REDACTED_LENGTH);
  }

  return redacted;
}

export const REDACTED_ERROR_MAX_LENGTH = MAX_REDACTED_LENGTH;

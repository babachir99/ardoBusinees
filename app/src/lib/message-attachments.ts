const ATTACHMENT_TOKEN_REGEX = /\n?\[\[ATTACHMENT:([\s\S]+?)\]\]\s*$/;

const DEV_ALLOWED_HOSTS = new Set([
  "localhost",
  "127.0.0.1",
  "localhost:3000",
  "127.0.0.1:3000",
]);

function getAllowedAbsoluteHosts() {
  const hosts = new Set<string>();

  const candidates = [
    process.env.PUBLIC_ASSET_BASE_URL,
    process.env.PUBLIC_APP_ORIGIN,
    process.env.INTERNAL_BASE_URL,
  ];

  for (const candidate of candidates) {
    if (!candidate) continue;
    try {
      const parsed = new URL(candidate);
      hosts.add(parsed.host.toLowerCase());
    } catch {
      continue;
    }
  }

  for (const host of DEV_ALLOWED_HOSTS) {
    hosts.add(host.toLowerCase());
  }

  return hosts;
}

function isUploadPath(value: string) {
  return /^\/uploads\/[^?#]+/.test(value);
}

export function normalizeMessageAttachmentUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const raw = value.trim();
  if (!raw) return null;

  if (raw.startsWith("/uploads/") && isUploadPath(raw)) {
    return raw.slice(0, 600);
  }

  try {
    const parsed = new URL(raw);
    if (!["http:", "https:"].includes(parsed.protocol)) return null;
    if (!isUploadPath(parsed.pathname)) return null;

    const allowedHosts = getAllowedAbsoluteHosts();
    if (!allowedHosts.has(parsed.host.toLowerCase())) return null;

    return `${parsed.origin}${parsed.pathname}${parsed.search}`.slice(0, 600);
  } catch {
    return null;
  }
}

export function serializeMessageBody(
  message: string,
  attachmentUrl: string | null
): string {
  if (!attachmentUrl) return message;
  return `${message}${message ? "\n" : ""}[[ATTACHMENT:${attachmentUrl}]]`;
}

export function parseMessageBody(body: string): {
  body: string;
  attachmentUrl: string | null;
} {
  const match = ATTACHMENT_TOKEN_REGEX.exec(body);
  if (!match) {
    return { body, attachmentUrl: null };
  }

  const attachmentUrl = normalizeMessageAttachmentUrl(match[1]);
  const cleanedBody = body.slice(0, match.index).trimEnd();
  return { body: cleanedBody, attachmentUrl };
}

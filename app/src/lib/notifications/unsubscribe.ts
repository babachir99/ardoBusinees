import { createHmac, timingSafeEqual } from "crypto";

export type UnsubscribeScope = "marketing" | "price_drop" | "deals";
export type UnsubscribeKind = "MARKETING";

type UnsubscribePayload = {
  userId: string;
  scope: UnsubscribeScope;
  kind: UnsubscribeKind;
  iat: number;
  exp: number;
};

const DEFAULT_TTL_SECONDS = 60 * 60 * 24 * 30;

function parsePositiveInt(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  const normalized = Math.trunc(parsed);
  return normalized > 0 ? normalized : fallback;
}

function getTokenTtlSeconds() {
  return parsePositiveInt(process.env.UNSUBSCRIBE_TOKEN_TTL_SECONDS, DEFAULT_TTL_SECONDS);
}

function getCurrentSecret() {
  return (
    process.env.HMAC_SECRET_CURRENT ||
    process.env.NOTIFICATIONS_UNSUBSCRIBE_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    "dev-notifications-secret"
  );
}

function getVerificationSecrets() {
  const current = String(getCurrentSecret()).trim();
  const previous = String(process.env.HMAC_SECRET_PREVIOUS ?? "").trim();
  const secrets = [current];

  if (previous && previous !== current) {
    secrets.push(previous);
  }

  return secrets;
}

function toBase64Url(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function fromBase64Url(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function sign(base64Payload: string, secret: string) {
  return createHmac("sha256", secret).update(base64Payload).digest("hex");
}

function hasValidSignature(encodedPayload: string, signature: string): boolean {
  const providedBuffer = Buffer.from(signature);

  for (const secret of getVerificationSecrets()) {
    const expectedSignature = sign(encodedPayload, secret);
    const expectedBuffer = Buffer.from(expectedSignature);

    if (providedBuffer.length !== expectedBuffer.length) {
      continue;
    }

    if (timingSafeEqual(providedBuffer, expectedBuffer)) {
      return true;
    }
  }

  return false;
}

export function createUnsubscribeToken(userId: string, scope: UnsubscribeScope): string {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const payload: UnsubscribePayload = {
    userId,
    scope,
    kind: "MARKETING",
    iat: nowSeconds,
    exp: nowSeconds + getTokenTtlSeconds(),
  };

  const encodedPayload = toBase64Url(JSON.stringify(payload));
  const signature = sign(encodedPayload, getCurrentSecret());
  return `${encodedPayload}.${signature}`;
}

export function verifyUnsubscribeToken(token: string): UnsubscribePayload | null {
  const [encodedPayload, signature] = String(token ?? "").split(".");
  if (!encodedPayload || !signature) return null;

  if (!hasValidSignature(encodedPayload, signature)) return null;

  try {
    const parsed = JSON.parse(fromBase64Url(encodedPayload)) as UnsubscribePayload;
    if (!parsed?.userId || !parsed.scope || typeof parsed.iat !== "number" || typeof parsed.exp !== "number") {
      return null;
    }

    if (!["marketing", "price_drop", "deals"].includes(parsed.scope)) return null;
    if (parsed.kind !== "MARKETING") return null;

    const nowSeconds = Math.floor(Date.now() / 1000);
    if (parsed.exp <= nowSeconds) return null;

    return parsed;
  } catch {
    return null;
  }
}

export function buildUnsubscribeUrl(userId: string, scope: UnsubscribeScope) {
  const token = createUnsubscribeToken(userId, scope);
  const base =
    process.env.PUBLIC_APP_ORIGIN || process.env.BASE_URL || process.env.NEXTAUTH_URL || "";

  if (!base) {
    return `/api/unsubscribe?token=${encodeURIComponent(token)}`;
  }

  return new URL(`/api/unsubscribe?token=${encodeURIComponent(token)}`, base).toString();
}

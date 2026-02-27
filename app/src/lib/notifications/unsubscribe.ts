import { createHmac, timingSafeEqual } from "crypto";

export type UnsubscribeScope = "marketing" | "price_drop" | "deals";

type UnsubscribePayload = {
  userId: string;
  scope: UnsubscribeScope;
  iat: number;
};

function getSecret() {
  return (
    process.env.NOTIFICATIONS_UNSUBSCRIBE_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    "dev-notifications-secret"
  );
}

function toBase64Url(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function fromBase64Url(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function sign(base64Payload: string) {
  return createHmac("sha256", getSecret()).update(base64Payload).digest("hex");
}

export function createUnsubscribeToken(userId: string, scope: UnsubscribeScope): string {
  const payload: UnsubscribePayload = {
    userId,
    scope,
    iat: Date.now(),
  };

  const encodedPayload = toBase64Url(JSON.stringify(payload));
  const signature = sign(encodedPayload);
  return `${encodedPayload}.${signature}`;
}

export function verifyUnsubscribeToken(token: string): UnsubscribePayload | null {
  const [encodedPayload, signature] = String(token ?? "").split(".");
  if (!encodedPayload || !signature) return null;

  const expectedSignature = sign(encodedPayload);
  const providedBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);
  if (providedBuffer.length !== expectedBuffer.length) return null;
  if (!timingSafeEqual(providedBuffer, expectedBuffer)) return null;

  try {
    const parsed = JSON.parse(fromBase64Url(encodedPayload)) as UnsubscribePayload;
    if (!parsed?.userId || !parsed.scope || typeof parsed.iat !== "number") return null;
    if (!["marketing", "price_drop", "deals"].includes(parsed.scope)) return null;
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

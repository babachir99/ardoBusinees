type HistoryCursorPayload = {
  createdAt: string;
  id: string;
};

export const DEFAULT_THREAD_TAKE = 24;
export const MAX_THREAD_TAKE = 60;

export function parseThreadTake(value: string | null | undefined) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return DEFAULT_THREAD_TAKE;
  return Math.min(MAX_THREAD_TAKE, Math.max(12, Math.trunc(parsed)));
}

export function decodeHistoryCursor(value: string | null | undefined) {
  if (!value) return null;

  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as HistoryCursorPayload;
    const createdAt = new Date(parsed.createdAt);
    if (!parsed.id || Number.isNaN(createdAt.getTime())) return null;
    return { id: parsed.id, createdAt };
  } catch {
    return null;
  }
}

export function encodeHistoryCursor(value: { id: string; createdAt: Date } | null) {
  if (!value) return null;

  return Buffer.from(
    JSON.stringify({
      id: value.id,
      createdAt: value.createdAt.toISOString(),
    }),
    "utf8"
  ).toString("base64url");
}

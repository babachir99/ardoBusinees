export type AuthTokenPurpose = "verify" | "reset";

function normalizeAuthTokenEmail(email: string) {
  return String(email ?? "").trim().toLowerCase();
}

export function buildAuthTokenIdentifier(purpose: AuthTokenPurpose, email: string) {
  const normalizedEmail = normalizeAuthTokenEmail(email);
  return normalizedEmail ? `${purpose}:${normalizedEmail}` : "";
}

export function buildLegacyAuthTokenIdentifier(email: string) {
  return normalizeAuthTokenEmail(email);
}

export function getAuthTokenPurgeIdentifiers(purpose: AuthTokenPurpose, email: string) {
  return Array.from(
    new Set([
      buildAuthTokenIdentifier(purpose, email),
      buildLegacyAuthTokenIdentifier(email),
    ].filter(Boolean))
  );
}

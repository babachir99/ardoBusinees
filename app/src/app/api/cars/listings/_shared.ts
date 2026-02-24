import { NextResponse } from "next/server";
import { hasAnyUserRole, hasUserRole } from "@/lib/userRoles";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CUID_PATTERN = /^c[a-z0-9]{24}$/i;

export function isIdLikeKey(value: string) {
  return UUID_PATTERN.test(value) || CUID_PATTERN.test(value);
}

export function errorResponse(status: number, error: string, message: string) {
  return NextResponse.json({ error, message }, { status });
}

export function normalizeString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export function normalizeUpper(value: unknown) {
  return normalizeString(value).toUpperCase();
}

export function parseNullableInt(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return Math.max(0, Math.trunc(parsed));
}

export function parseBoolean(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  if (normalized === "true" || normalized === "1") return true;
  if (normalized === "false" || normalized === "0") return false;
  return null;
}

export function parseImageUrls(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;

  const normalized = Array.from(
    new Set(
      value
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter(Boolean)
    )
  );

  if (normalized.length > 20) return null;

  for (const url of normalized) {
    const isInternal = url.startsWith("/uploads/");
    const isExternal = /^https?:\/\//i.test(url);
    if (!isInternal && !isExternal) {
      return null;
    }
  }

  return normalized;
}

export function normalizeTake(value: unknown, fallback = 24, max = 50) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(Math.trunc(parsed), 1), max);
}

export function normalizeSkip(value: unknown, max = 5000) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.min(Math.max(Math.trunc(parsed), 0), max);
}

export function canAccessAdmin(user: { role?: string | null; roles?: string[] | null } | null | undefined) {
  return hasUserRole(user, "ADMIN");
}

export function canPublishCars(user: { role?: string | null; roles?: string[] | null } | null | undefined) {
  return hasAnyUserRole(user, ["SELLER", "ADMIN"]);
}

export function canManageCarPublisher(user: { role?: string | null; roles?: string[] | null } | null | undefined) {
  return hasAnyUserRole(user, ["SELLER", "ADMIN"]);
}

export function slugifyCarPublisher(input: string) {
  const normalized = input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);

  const slug = normalized || "cars-dealer";
  return isIdLikeKey(slug) ? `dealer-${slug}` : slug;
}

import { NextResponse } from "next/server";
import { hasAnyUserRole, hasUserRole } from "@/lib/userRoles";

export function errorResponse(status: number, error: string, message: string) {
  return NextResponse.json({ error, message }, { status });
}

export function normalizeString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
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

export function slugifyImmoPublisher(input: string) {
  const normalized = input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);

  return normalized || "agence";
}

export function canAccessAdmin(user: { role?: string | null; roles?: string[] | null } | null | undefined) {
  return hasUserRole(user, "ADMIN");
}

export function canPublishImmo(user: { role?: string | null; roles?: string[] | null } | null | undefined) {
  return hasAnyUserRole(user, ["SELLER", "IMMO_AGENT", "ADMIN"]);
}

export function canManagePublisher(user: { role?: string | null; roles?: string[] | null } | null | undefined) {
  return hasAnyUserRole(user, ["IMMO_AGENT", "ADMIN"]);
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

import { NextResponse } from "next/server";
import { hasAnyUserRole, hasUserRole } from "@/lib/userRoles";

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

export function normalizeTake(value: unknown, fallback = 24, max = 60) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(Math.trunc(parsed), 1), max);
}

export function normalizeSkip(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(Math.trunc(parsed), 0);
}

export function canAccessAdmin(user: { role?: string | null; roles?: string[] | null } | null | undefined) {
  return hasUserRole(user, "ADMIN");
}

export function canPublishAuto(user: { role?: string | null; roles?: string[] | null } | null | undefined) {
  return hasAnyUserRole(user, ["SELLER", "ADMIN"]);
}

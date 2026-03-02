import { NextRequest, NextResponse } from "next/server";
import { COUNTRIES } from "@/lib/locale/country";

const SUPPORTED = new Set(COUNTRIES.map((country) => country.code));

function pickCountry(value: string | null | undefined): string | null {
  const raw = String(value ?? "").split(",")[0]?.trim().toUpperCase() ?? "";
  if (!raw) return null;
  return SUPPORTED.has(raw) ? raw : null;
}

function fromAcceptLanguage(value: string | null | undefined): string | null {
  const normalized = String(value ?? "").toLowerCase();
  if (!normalized) return null;
  if (normalized.includes("-sn") || normalized.includes("sn-")) return "SN";
  if (normalized.includes("-fr") || normalized.includes("fr-") || normalized.startsWith("fr")) return "FR";
  return null;
}

export async function GET(request: NextRequest) {
  const headers = request.headers;
  const geoCountry =
    pickCountry(headers.get("x-vercel-ip-country")) ??
    pickCountry(headers.get("cf-ipcountry")) ??
    pickCountry(headers.get("x-country-code")) ??
    fromAcceptLanguage(headers.get("accept-language"));

  return NextResponse.json({ geoCountry: geoCountry ?? null });
}

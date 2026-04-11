#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";

function loadEnvFromDotEnv() {
  const envPath = path.join(process.cwd(), ".env");
  if (!fs.existsSync(envPath)) return;

  const content = fs.readFileSync(envPath, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx <= 0) continue;
    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

function parseCsv(value) {
  return String(value ?? "")
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
}

function asUrlHost(value) {
  try {
    return new URL(String(value ?? "")).host.toLowerCase();
  } catch {
    return null;
  }
}

loadEnvFromDotEnv();

const required = [
  "PUBLIC_APP_ORIGIN",
  "INTERNAL_BASE_URL",
  "ALLOWED_HOSTS",
  "INTERNAL_API_TOKEN",
  "NEXTAUTH_SECRET",
];

const missing = required.filter((key) => !String(process.env[key] ?? "").trim());
if (missing.length > 0) {
  console.error(`[qa:env:staging] Missing required env(s): ${missing.join(", ")}`);
  process.exit(1);
}

const errors = [];
const warnings = [];

if (String(process.env.ALLOW_INSECURE_INTERNAL_CALLS ?? "").trim() === "1") {
  errors.push("ALLOW_INSECURE_INTERNAL_CALLS must stay 0.");
}

if (String(process.env.AUTH_DEBUG_TOKENS ?? "").trim() === "1") {
  errors.push("AUTH_DEBUG_TOKENS must stay 0.");
}

const cspMode = String(process.env.CSP_MODE ?? "report-only").trim().toLowerCase();
if (!["off", "report-only", "reportonly", "report_only", "enforce"].includes(cspMode)) {
  errors.push("CSP_MODE must be one of: off, report-only, enforce.");
}

if ((cspMode === "report-only" || cspMode === "reportonly" || cspMode === "report_only") && !String(process.env.CSP_REPORT_URI ?? "").trim()) {
  warnings.push("CSP_REPORT_URI is empty while CSP_MODE=report-only. You will not collect violations centrally.");
}

const publicHost = asUrlHost(process.env.PUBLIC_APP_ORIGIN);
const internalHost = asUrlHost(process.env.INTERNAL_BASE_URL);
const allowedHosts = parseCsv(process.env.ALLOWED_HOSTS);

if (!publicHost) {
  errors.push("PUBLIC_APP_ORIGIN must be a valid absolute URL.");
}

if (!internalHost) {
  errors.push("INTERNAL_BASE_URL must be a valid absolute URL.");
}

if (publicHost && !allowedHosts.includes(publicHost)) {
  errors.push(`ALLOWED_HOSTS does not include PUBLIC_APP_ORIGIN host: ${publicHost}`);
}

if (internalHost && !allowedHosts.includes(internalHost)) {
  warnings.push(`ALLOWED_HOSTS does not include INTERNAL_BASE_URL host: ${internalHost}`);
}

const invalidateBefore = String(process.env.AUTH_SESSION_INVALIDATE_BEFORE ?? "").trim();
if (invalidateBefore) {
  const parsed =
    /^\d+$/.test(invalidateBefore) ? Number(invalidateBefore) : Date.parse(invalidateBefore);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    errors.push("AUTH_SESSION_INVALIDATE_BEFORE must be an ISO date or a positive timestamp.");
  }
}

if (errors.length > 0) {
  console.error("[qa:env:staging] FAILED");
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  if (warnings.length > 0) {
    console.error("[qa:env:staging] warnings:");
    for (const warning of warnings) {
      console.error(`- ${warning}`);
    }
  }
  process.exit(1);
}

console.log("[qa:env:staging] OK - core staging env looks consistent.");
if (warnings.length > 0) {
  console.log("[qa:env:staging] warnings:");
  for (const warning of warnings) {
    console.log(`- ${warning}`);
  }
}

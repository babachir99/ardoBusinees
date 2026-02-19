#!/usr/bin/env node

/**
 * PRESTA race test (local, no test framework)
 *
 * Usage (PowerShell):
 *   $env:BASE_URL='http://localhost:3000'
 *   $env:COOKIE_CUSTOMER='next-auth.session-token=...'
 *   $env:PROPOSAL_ID='proposal_winner_id'
 *   $env:OTHER_PROPOSAL_ID='proposal_other_id'
 *   # optional (auto-detected from PATCH response if omitted)
 *   $env:NEED_ID='need_id'
 *   node app/scripts/presta_race_test.mjs
 *
 * Expected output (example):
 *   [PATCH A1] HTTP 200 | error=null | message=null | bookingId=...
 *   [PATCH A2] HTTP 200 | error=null | message=null | bookingId=...
 *   [PATCH B1] HTTP 409 | error=ALREADY_ACCEPTED | message=Need already accepted or not open. | bookingId=null
 *   [PATCH B2] HTTP 409 | error=ALREADY_ACCEPTED | message=Need already accepted or not open. | bookingId=null
 *   contractCheck: PASS
 *   noDoubleBooking: PASS (bookingCount=1)
 */

const requiredEnv = ["BASE_URL", "COOKIE_CUSTOMER", "PROPOSAL_ID", "OTHER_PROPOSAL_ID"];
for (const key of requiredEnv) {
  if (!process.env[key] || !process.env[key].trim()) {
    console.error(`[config] Missing env: ${key}`);
    process.exit(1);
  }
}

const BASE_URL = process.env.BASE_URL.replace(/\/$/, "");
const COOKIE_CUSTOMER = process.env.COOKIE_CUSTOMER;
const PROPOSAL_ID = process.env.PROPOSAL_ID;
const OTHER_PROPOSAL_ID = process.env.OTHER_PROPOSAL_ID;
let NEED_ID = (process.env.NEED_ID || "").trim() || null;

const commonHeaders = {
  "Content-Type": "application/json",
  Cookie: COOKIE_CUSTOMER,
};

function safeJsonStringify(value) {
  try {
    return JSON.stringify(value);
  } catch {
    return '"<unserializable>"';
  }
}

async function readJsonSafe(response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { _raw: text };
  }
}

async function patchAccept(proposalId, label) {
  const url = `${BASE_URL}/api/presta/proposals/${encodeURIComponent(proposalId)}`;
  const response = await fetch(url, {
    method: "PATCH",
    headers: commonHeaders,
    body: JSON.stringify({ status: "ACCEPTED", paymentMethod: "CASH" }),
  });

  const body = await readJsonSafe(response);
  return {
    label,
    url,
    statusCode: response.status,
    ok: response.ok,
    body,
    error: body && typeof body === "object" ? body.error ?? null : null,
    message: body && typeof body === "object" ? body.message ?? null : null,
    bookingId: body && typeof body === "object" ? body.booking?.id ?? null : null,
    proposalNeedId: body && typeof body === "object" ? body.proposal?.needId ?? null : null,
  };
}

function normalizeSettledResult(settled, label) {
  if (settled.status === "fulfilled") {
    return settled.value;
  }
  return {
    label,
    url: null,
    statusCode: 0,
    ok: false,
    body: { error: "REQUEST_FAILED", message: String(settled.reason) },
    error: "REQUEST_FAILED",
    message: String(settled.reason),
    bookingId: null,
    proposalNeedId: null,
  };
}

function extractProposals(payload) {
  if (Array.isArray(payload)) return payload;
  if (payload && typeof payload === "object") {
    if (Array.isArray(payload.proposals)) return payload.proposals;
    if (payload.data && Array.isArray(payload.data.proposals)) return payload.data.proposals;
  }
  return [];
}

function summarizeResult(r) {
  console.log(
    `[PATCH ${r.label}] HTTP ${r.statusCode} | error=${r.error ?? "null"} | message=${r.message ?? "null"} | bookingId=${r.bookingId ?? "null"}`
  );
}

function validateErrorContract(r) {
  if (r.statusCode === 200) return true;
  return Boolean(r.body && typeof r.body === "object" && typeof r.body.error === "string" && typeof r.body.message === "string");
}

async function fetchNeedProposals(needId) {
  const url = `${BASE_URL}/api/presta/needs/${encodeURIComponent(needId)}/proposals`;
  const response = await fetch(url, {
    method: "GET",
    headers: {
      Cookie: COOKIE_CUSTOMER,
    },
  });
  const body = await readJsonSafe(response);
  return { statusCode: response.status, body };
}

async function main() {
  console.log("[race] starting parallel PATCH requests...");

  const settled = await Promise.allSettled([
    patchAccept(PROPOSAL_ID, "A1"),
    patchAccept(PROPOSAL_ID, "A2"),
    patchAccept(OTHER_PROPOSAL_ID, "B1"),
    patchAccept(OTHER_PROPOSAL_ID, "B2"),
  ]);

  const labels = ["A1", "A2", "B1", "B2"];
  const results = settled.map((item, idx) => normalizeSettledResult(item, labels[idx]));

  for (const result of results) {
    summarizeResult(result);
  }

  if (!NEED_ID) {
    NEED_ID = results.find((r) => r.proposalNeedId)?.proposalNeedId ?? null;
  }

  const contractPass = results.every(validateErrorContract);
  console.log(`contractCheck: ${contractPass ? "PASS" : "FAIL"}`);

  if (!NEED_ID) {
    console.log("noDoubleBooking: SKIPPED (NEED_ID missing and not returned by PATCH payload)");
    process.exit(contractPass ? 0 : 2);
  }

  console.log(`[verify] loading proposals for need ${NEED_ID} ...`);
  const proposalsResp = await fetchNeedProposals(NEED_ID);

  if (proposalsResp.statusCode !== 200) {
    console.log(
      `noDoubleBooking: FAIL (GET proposals status=${proposalsResp.statusCode}, body=${safeJsonStringify(proposalsResp.body)})`
    );
    process.exit(2);
  }

  const proposals = extractProposals(proposalsResp.body);
  const proposalRows = proposals.map((p) => ({
    id: p?.id ?? null,
    status: p?.status ?? null,
    bookingId: p?.bookingId ?? null,
  }));

  for (const row of proposalRows) {
    console.log(`[proposal] id=${row.id} status=${row.status} bookingId=${row.bookingId}`);
  }

  const bookingIds = new Set(proposalRows.map((p) => p.bookingId).filter(Boolean));
  const noDoubleBookingPass = bookingIds.size === 1;
  console.log(`noDoubleBooking: ${noDoubleBookingPass ? "PASS" : "FAIL"} (bookingCount=${bookingIds.size})`);

  if (!contractPass || !noDoubleBookingPass) {
    process.exit(2);
  }
}

main().catch((error) => {
  console.error("[fatal]", error);
  process.exit(2);
});

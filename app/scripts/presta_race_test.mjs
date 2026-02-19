#!/usr/bin/env node

/**
 * PRESTA race test (local, no test framework)
 *
 * Usage (PowerShell):
 *   $env:BASE_URL='http://localhost:3000'
 *   $env:COOKIE_CUSTOMER='next-auth.session-token=...'
 *   $env:PROPOSAL_ID='proposal_winner_id'
 *   $env:OTHER_PROPOSAL_ID='proposal_other_id'
 *   # optional verification step
 *   $env:NEED_ID='need_id'
 *   node app/scripts/presta_race_test.mjs
 *
 * Expected output (PASS - example):
 *   [PATCH A1] HTTP 200 | error=null | message=null | bookingId=bk_123
 *   [PATCH A2] HTTP 200 | error=null | message=null | bookingId=bk_123
 *   [PATCH B1] HTTP 409 | error=ALREADY_ACCEPTED | message=Need already accepted or not open. | bookingId=null
 *   [PATCH B2] HTTP 409 | error=INVALID_PROPOSAL_STATE | message=Proposal not pending. | bookingId=null
 *   VERDICT: PASS
 *   REASONS: []
 *   UNIQUE_BOOKING_IDS: ["bk_123"]
 *
 * Expected output (FAIL - example):
 *   [PATCH A1] HTTP 500 | error=INTERNAL | message=... | bookingId=null
 *   [PATCH A2] HTTP 409 | error=ALREADY_ACCEPTED | message=... | bookingId=null
 *   [PATCH B1] HTTP 409 | error=ALREADY_ACCEPTED | message=... | bookingId=null
 *   [PATCH B2] HTTP 409 | error=ALREADY_ACCEPTED | message=... | bookingId=null
 *   VERDICT: FAIL
 *   REASONS: ["NO_SUCCESS_200","UNEXPECTED_RESPONSE_A1_HTTP500_INTERNAL"]
 *   UNIQUE_BOOKING_IDS: []
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
const NEED_ID = (process.env.NEED_ID || "").trim() || null;

const commonHeaders = {
  "Content-Type": "application/json",
  Cookie: COOKIE_CUSTOMER,
};

const ALLOWED_409_ERRORS = new Set(["ALREADY_ACCEPTED", "INVALID_PROPOSAL_STATE"]);

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

function asObject(value) {
  return value && typeof value === "object" ? value : null;
}

function logResult(label, result) {
  const body = asObject(result.body);
  const error = body?.error ?? null;
  const message = body?.message ?? null;
  const bookingId = body?.booking?.id ?? null;
  console.log(
    `[PATCH ${label}] HTTP ${result.statusCode} | error=${error ?? "null"} | message=${message ?? "null"} | bookingId=${bookingId ?? "null"}`
  );
}

async function patchAccept(proposalId, label) {
  const url = `${BASE_URL}/api/presta/proposals/${encodeURIComponent(proposalId)}`;
  const response = await fetch(url, {
    method: "PATCH",
    headers: commonHeaders,
    body: JSON.stringify({ status: "ACCEPTED", paymentMethod: "CASH" }),
  });

  const body = await readJsonSafe(response);
  const obj = asObject(body);

  return {
    label,
    url,
    statusCode: response.status,
    body,
    error: obj?.error ?? null,
    message: obj?.message ?? null,
    bookingId: obj?.booking?.id ?? null,
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
    body: {
      error: "REQUEST_FAILED",
      message: String(settled.reason),
    },
    error: "REQUEST_FAILED",
    message: String(settled.reason),
    bookingId: null,
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

function validateResponseRules(results) {
  const reasons = [];
  const successResponses = results.filter((r) => r.statusCode === 200);

  if (successResponses.length === 0) {
    reasons.push("NO_SUCCESS_200");
  }

  for (const r of results) {
    if (r.statusCode === 200) {
      continue;
    }

    const body = asObject(r.body);
    const hasContract = typeof body?.error === "string" && typeof body?.message === "string";
    if (!hasContract) {
      reasons.push(`INVALID_ERROR_CONTRACT_${r.label}`);
      continue;
    }

    if (r.statusCode === 409 && ALLOWED_409_ERRORS.has(body.error)) {
      continue;
    }

    reasons.push(`UNEXPECTED_RESPONSE_${r.label}_HTTP${r.statusCode}_${body.error}`);
  }

  return reasons;
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
  return {
    statusCode: response.status,
    body,
  };
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
    logResult(result.label, result);
  }

  const reasons = validateResponseRules(results);

  const bookingIdsFrom200 = new Set(results.filter((r) => r.statusCode === 200).map((r) => r.bookingId).filter(Boolean));

  if (bookingIdsFrom200.size > 1) {
    reasons.push("DOUBLE_BOOKING_IDS_IN_200_RESPONSES");
  }

  if (NEED_ID) {
    console.log(`[verify] loading proposals for need ${NEED_ID} ...`);
    const proposalsResp = await fetchNeedProposals(NEED_ID);

    if (proposalsResp.statusCode !== 200) {
      reasons.push(`VERIFY_PROPOSALS_HTTP_${proposalsResp.statusCode}`);
      console.log(`[verify] failed: HTTP ${proposalsResp.statusCode} body=${safeJsonStringify(proposalsResp.body)}`);
    } else {
      const proposals = extractProposals(proposalsResp.body);
      const acceptedCount = proposals.filter((p) => p?.status === "ACCEPTED").length;
      const hasAnyBookingField = proposals.some((p) => Object.prototype.hasOwnProperty.call(p ?? {}, "bookingId"));

      console.log(`[verify] proposalsCount=${proposals.length} acceptedCount=${acceptedCount}`);

      if (acceptedCount > 1) {
        reasons.push("MULTIPLE_ACCEPTED_PROPOSALS_FOR_NEED");
      }

      if (hasAnyBookingField) {
        const visibleBookingIds = new Set(proposals.map((p) => p?.bookingId).filter(Boolean));
        console.log(`[verify] visibleBookingIds=${safeJsonStringify(Array.from(visibleBookingIds))}`);
        if (visibleBookingIds.size > 1) {
          reasons.push("DOUBLE_BOOKING_IDS_IN_NEED_PROPOSALS");
        }
      } else {
        console.log("[verify] bookingId not visible in proposals payload; non-blocking check skipped.");
      }
    }
  } else {
    console.log("[verify] NEED_ID not provided; proposals cross-check skipped.");
  }

  const pass = reasons.length === 0;

  console.log("VERDICT:", pass ? "PASS" : "FAIL");
  console.log("REASONS:", safeJsonStringify(reasons));
  console.log("UNIQUE_BOOKING_IDS:", safeJsonStringify(Array.from(bookingIdsFrom200)));

  process.exit(pass ? 0 : 1);
}

main().catch((error) => {
  console.error("[fatal]", error);
  console.log("VERDICT: FAIL");
  console.log("REASONS:", safeJsonStringify([`FATAL_${String(error)}`]));
  console.log("UNIQUE_BOOKING_IDS:", safeJsonStringify([]));
  process.exit(1);
});

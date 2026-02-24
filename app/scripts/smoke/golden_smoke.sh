#!/usr/bin/env bash
set -euo pipefail

# JONTAADO cross-vertical smoke tests (golden curls)
# Purpose: quick stability checks for IMMO quota+slots, orchestrator+GP attach, and webhook replay idempotence.
#
# Usage (example):
#   BASE_URL="http://localhost:3000" \
#   COOKIE_IMMO_MEMBER="next-auth.session-token=..." \
#   COOKIE_GP_USER="next-auth.session-token=..." \
#   PAYMENTS_CALLBACK_TOKEN="..." \
#   IMMO_DRAFT_LISTING_ID="..." \
#   IMMO_AGENCY_ID="..." \
#   IMMO_EXTRA_SLOTS_INTENT_ID="..." \
#   CARS_LISTING_ID="..." \
#   GP_ATTACH_TRIP_ID="..." \
#   ORCH_INTENT_ID="..." \
#   ./scripts/smoke/golden_smoke.sh
#
# Notes:
# - Replace placeholder ids/tokens before running.
# - Test #9 (GP publish) is optional if you already have a trip id from UI publish; otherwise use your real POST /api/gp/trips payload.
# - UI prefill check is manual: open /gp?intentId=<ORCH_INTENT_ID> before publishing and confirm fields are prefilled.

BASE_URL="${BASE_URL:-http://localhost:3000}"
COOKIE_IMMO_MEMBER="${COOKIE_IMMO_MEMBER:-next-auth.session-token=<TOKEN_IMMO_MEMBER>}"
COOKIE_GP_USER="${COOKIE_GP_USER:-next-auth.session-token=<TOKEN_GP_USER>}"
PAYMENTS_CALLBACK_TOKEN="${PAYMENTS_CALLBACK_TOKEN:-<PAYMENTS_CALLBACK_TOKEN>}"

IMMO_DRAFT_LISTING_ID="${IMMO_DRAFT_LISTING_ID:-<IMMO_DRAFT_LISTING_ID>}"
IMMO_AGENCY_ID="${IMMO_AGENCY_ID:-<IMMO_AGENCY_ID>}"
IMMO_EXTRA_SLOTS_INTENT_ID="${IMMO_EXTRA_SLOTS_INTENT_ID:-<IMMO_EXTRA_SLOTS_INTENT_ID>}"
CARS_LISTING_ID="${CARS_LISTING_ID:-<CARS_LISTING_ID>}"
ORCH_INTENT_ID="${ORCH_INTENT_ID:-<ORCH_INTENT_ID>}"
GP_ATTACH_TRIP_ID="${GP_ATTACH_TRIP_ID:-<GP_TRIP_ID_CREATED_FROM_UI_OR_POST>}"

run() {
  local title="$1"
  shift
  echo
  echo "=================================================="
  echo "$title"
  echo "=================================================="
  "$@"
}

# 1) IMMO quota block (expect 409 QUOTA_EXCEEDED when agency quota is full)
run "1. IMMO publish blocked by quota (expect 409 QUOTA_EXCEEDED)"   curl -i -X POST "$BASE_URL/api/immo/listings/$IMMO_DRAFT_LISTING_ID/publish"     -H "Cookie: $COOKIE_IMMO_MEMBER"

# 2) IMMO checkout EXTRA_SLOTS_10 (dealer pro buys slots)
run "2. IMMO checkout EXTRA_SLOTS_10 (expect 200/201 with checkoutUrl + pending purchase)"   curl -i -X POST "$BASE_URL/api/immo/monetization/checkout"     -H "Content-Type: application/json"     -H "Cookie: $COOKIE_IMMO_MEMBER"     --data '{"publisherId":"'"$IMMO_AGENCY_ID"'","kind":"EXTRA_SLOTS_10"}'

# 3) IMMO webhook confirm slots purchase (expect processed/200)
run "3. PayDunya webhook confirm IMMO EXTRA_SLOTS_10 (first delivery)"   curl -i -X POST "$BASE_URL/api/payments/webhook/paydunya"     -H "Content-Type: application/json"     -H "x-payments-callback-token: $PAYMENTS_CALLBACK_TOKEN"     --data '{"intentId":"'"$IMMO_EXTRA_SLOTS_INTENT_ID"'","status":"CONFIRMED","provider":"PAYDUNYA"}'

# 4) IMMO webhook replay confirm (idempotence: no double slots)
run "4. PayDunya webhook replay (idempotence, should no-op safely)"   curl -i -X POST "$BASE_URL/api/payments/webhook/paydunya"     -H "Content-Type: application/json"     -H "x-payments-callback-token: $PAYMENTS_CALLBACK_TOKEN"     --data '{"intentId":"'"$IMMO_EXTRA_SLOTS_INTENT_ID"'","status":"CONFIRMED","provider":"PAYDUNYA"}'

# 5) IMMO publish retry after slots purchase (expect 200)
run "5. IMMO publish succeeds after slots purchase (expect 200)"   curl -i -X POST "$BASE_URL/api/immo/listings/$IMMO_DRAFT_LISTING_ID/publish"     -H "Cookie: $COOKIE_IMMO_MEMBER"

# 6) CARS sanity (source entity for orchestrator intent should exist)
run "6. CARS listing detail (source for intent)"   curl -i "$BASE_URL/api/cars/listings/$CARS_LISTING_ID"

# 7) Orchestrator intent create from CARS (GP transport suggestion path)
run "7. Orchestrator intent create (CARS -> GP transport)"   curl -i -X POST "$BASE_URL/api/orchestrator/intents"     -H "Content-Type: application/json"     -H "Cookie: $COOKIE_GP_USER"     --data '{"sourceVertical":"CARS","sourceEntityId":"'"$CARS_LISTING_ID"'","intentType":"TRANSPORT","objectType":"PARTS","fromCountry":"SN","fromCity":"Dakar","toCountry":"FR","toCity":"Paris","weightKg":8}'

# 8) Orchestrator intent GET (API payload used by GP prefill UI)
run "8. Orchestrator intent GET (manual UI prefill check: open /gp?intentId=... in browser)"   curl -i "$BASE_URL/api/orchestrator/intents/$ORCH_INTENT_ID"     -H "Cookie: $COOKIE_GP_USER"

# 9) GP trip publish (optional if trip created from UI prefill; otherwise use a real payload)
run "9. GP trip create (optional if you already created via UI and set GP_ATTACH_TRIP_ID)"   curl -i -X POST "$BASE_URL/api/gp/trips"     -H "Content-Type: application/json"     -H "Cookie: $COOKIE_GP_USER"     --data '{"originCity":"Dakar","originAddress":"Point A","destinationCity":"Paris","destinationAddress":"Point B","departureDate":"2026-03-15","availableKg":10,"price":5000,"currency":"XOF","acceptedPaymentMethods":["CASH"]}'

# 10) Attach intent to GP trip (expect 200 + status MATCHED)
run "10. Attach orchestrator intent to GP trip (expect MATCHED)"   curl -i -X PATCH "$BASE_URL/api/orchestrator/intents/$ORCH_INTENT_ID"     -H "Content-Type: application/json"     -H "Cookie: $COOKIE_GP_USER"     --data '{"status":"MATCHED","targetVertical":"GP","targetEntityId":"'"$GP_ATTACH_TRIP_ID"'"}'

# 11) Re-click attach / replay attach (expect 400/409, no crash/idempotent UX path)
run "11. Re-attach same intent (expect 400/409 already handled)"   curl -i -X PATCH "$BASE_URL/api/orchestrator/intents/$ORCH_INTENT_ID"     -H "Content-Type: application/json"     -H "Cookie: $COOKIE_GP_USER"     --data '{"status":"MATCHED","targetVertical":"GP","targetEntityId":"'"$GP_ATTACH_TRIP_ID"'"}'

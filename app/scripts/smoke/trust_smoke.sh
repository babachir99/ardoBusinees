#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3000}"
COOKIE_USER="${COOKIE_USER:-next-auth.session-token=<TOKEN_USER>}"
COOKIE_ADMIN="${COOKIE_ADMIN:-next-auth.session-token=<TOKEN_ADMIN>}"
REPORT_USER_ID="${REPORT_USER_ID:-<USER_ID_TO_REPORT>}"
BLOCK_USER_ID="${BLOCK_USER_ID:-<USER_ID_TO_BLOCK>}"
REPORT_ID="${REPORT_ID:-<REPORT_ID>}"
ORDER_REF_ID="${ORDER_REF_ID:-<ORDER_OR_REF_ID>}"

run() {
  local title="$1"
  shift
  echo
  echo "=================================================="
  echo "$title"
  echo "=================================================="
  "$@"
}

run "1. Create trust report (expect 201)"   curl -i -X POST "$BASE_URL/api/trust/reports"     -H "Content-Type: application/json"     -H "Cookie: $COOKIE_USER"     --data '{"reportedUserId":"'"$REPORT_USER_ID"'","reason":"Spam abusif","description":"Cet utilisateur envoie des messages repetitifs et suspects sur plusieurs annonces."}'

run "2. Re-submit same report quickly (expect 409 DUPLICATE_REPORT)"   curl -i -X POST "$BASE_URL/api/trust/reports"     -H "Content-Type: application/json"     -H "Cookie: $COOKIE_USER"     --data '{"reportedUserId":"'"$REPORT_USER_ID"'","reason":"Spam abusif","description":"Cet utilisateur envoie des messages repetitifs et suspects sur plusieurs annonces."}'

run "3. List reports (admin)"   curl -i "$BASE_URL/api/trust/reports?status=PENDING&take=20&skip=0"     -H "Cookie: $COOKIE_ADMIN"

run "4. Update report status (admin -> UNDER_REVIEW)"   curl -i -X PATCH "$BASE_URL/api/trust/reports/$REPORT_ID"     -H "Content-Type: application/json"     -H "Cookie: $COOKIE_ADMIN"     --data '{"status":"UNDER_REVIEW"}'

run "5. Create trust dispute (expect 201)"   curl -i -X POST "$BASE_URL/api/trust/disputes"     -H "Content-Type: application/json"     -H "Cookie: $COOKIE_USER"     --data '{"vertical":"SHOP","orderId":"'"$ORDER_REF_ID"'","reason":"Produit non conforme","description":"Le produit recu ne correspond pas a la description et le vendeur ne repond plus."}'

run "6. Block + unblock user" bash -lc "curl -i -X POST '$BASE_URL/api/trust/blocks' -H 'Content-Type: application/json' -H 'Cookie: $COOKIE_USER' --data '{\"blockedUserId\":\"$BLOCK_USER_ID\"}' && curl -i -X DELETE '$BASE_URL/api/trust/blocks/$BLOCK_USER_ID' -H 'Cookie: $COOKIE_USER'"

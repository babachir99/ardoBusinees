#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3000}"
COOKIE_USER="${COOKIE_USER:-}"
COOKIE_ADMIN="${COOKIE_ADMIN:-}"
COOKIE_USER_FILE="${COOKIE_USER_FILE:-_tmp_cookie_agent.txt}"
COOKIE_ADMIN_FILE="${COOKIE_ADMIN_FILE:-_tmp_cookie_admin.txt}"
REPORT_USER_ID="${REPORT_USER_ID:-<USER_ID_TO_REPORT>}"
BLOCK_USER_ID="${BLOCK_USER_ID:-<USER_ID_TO_BLOCK>}"
REPORT_ID="${REPORT_ID:-<REPORT_ID>}"
ORDER_REF_ID="${ORDER_REF_ID:-<ORDER_OR_REF_ID>}"

build_cookie_args() {
  local kind="$1"
  local raw="$2"
  local file="$3"
  local -n out_ref="$4"

  out_ref=()
  if [[ -n "$raw" ]]; then
    out_ref=(-H "Cookie: $raw")
    return 0
  fi
  if [[ -n "$file" && -f "$file" ]]; then
    out_ref=(--cookie "$file")
    return 0
  fi

  echo "Missing $kind auth cookie. Set ${kind^^} env var or ${kind^^}_FILE path." >&2
  return 1
}

run() {
  local title="$1"
  shift
  echo
  echo "=================================================="
  echo "$title"
  echo "=================================================="
  "$@"
}

build_cookie_args "cookie_user" "$COOKIE_USER" "$COOKIE_USER_FILE" USER_COOKIE_ARGS
build_cookie_args "cookie_admin" "$COOKIE_ADMIN" "$COOKIE_ADMIN_FILE" ADMIN_COOKIE_ARGS

run "1. Create trust report (expect 201)"   curl -i -X POST "$BASE_URL/api/trust/reports"     -H "Content-Type: application/json"     "${USER_COOKIE_ARGS[@]}"     --data '{"reportedUserId":"'"$REPORT_USER_ID"'","reason":"Spam abusif","description":"Cet utilisateur envoie des messages repetitifs et suspects sur plusieurs annonces."}'

run "2. Re-submit same report quickly (expect 409 DUPLICATE_REPORT)"   curl -i -X POST "$BASE_URL/api/trust/reports"     -H "Content-Type: application/json"     "${USER_COOKIE_ARGS[@]}"     --data '{"reportedUserId":"'"$REPORT_USER_ID"'","reason":"Spam abusif","description":"Cet utilisateur envoie des messages repetitifs et suspects sur plusieurs annonces."}'

run "3. List reports (admin)"   curl -i "$BASE_URL/api/trust/reports?status=PENDING&take=20&skip=0"     "${ADMIN_COOKIE_ARGS[@]}"

run "4. Update report status (admin -> UNDER_REVIEW)"   curl -i -X PATCH "$BASE_URL/api/trust/reports/$REPORT_ID"     -H "Content-Type: application/json"     "${ADMIN_COOKIE_ARGS[@]}"     --data '{"status":"UNDER_REVIEW"}'

run "5. Create trust dispute (expect 201)"   curl -i -X POST "$BASE_URL/api/trust/disputes"     -H "Content-Type: application/json"     "${USER_COOKIE_ARGS[@]}"     --data '{"vertical":"SHOP","orderId":"'"$ORDER_REF_ID"'","reason":"Produit non conforme","description":"Le produit recu ne correspond pas a la description et le vendeur ne repond plus."}'

run "6. Block user (expect 200)"   curl -i -X POST "$BASE_URL/api/trust/blocks"     -H "Content-Type: application/json"     "${USER_COOKIE_ARGS[@]}"     --data '{"blockedUserId":"'"$BLOCK_USER_ID"'"}'

run "7. Unblock user (expect 200)"   curl -i -X DELETE "$BASE_URL/api/trust/blocks/$BLOCK_USER_ID"     "${USER_COOKIE_ARGS[@]}"

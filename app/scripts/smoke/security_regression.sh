#!/usr/bin/env bash
set -euo pipefail

: "${BASE_URL:=http://localhost:3000}"
: "${COOKIE_ADMIN:=next-auth.session-token=<ADMIN_TOKEN>}"

echo "[1] forgot/register token echo disabled (run app in production mode to validate)"
curl -i -X POST "${BASE_URL}/api/auth/forgot"   -H "Content-Type: application/json"   --data '{"email":"user@example.com"}' || true
curl -i -X POST "${BASE_URL}/api/auth/register"   -H "Content-Type: application/json"   --data '{"email":"x@example.com","password":"Secret123!"}' || true

echo "[2] login rate limit smoke (expect 429 after threshold)"
for i in $(seq 1 20); do
  curl -s -o /dev/null -w "%{http_code}\n" -X POST "${BASE_URL}/api/auth/callback/credentials"     -H "Content-Type: application/x-www-form-urlencoded"     --data "email=invalid@example.com&password=bad" || true
done

echo "[3] same-origin guard smoke on admin mutation (expect 403 in prod config)"
curl -i -X POST "${BASE_URL}/api/admin/payouts/release"   -H "Origin: https://evil.example"   -H "Content-Type: application/json"   -H "Cookie: ${COOKIE_ADMIN}"   --data '{"type":"PRESTA","payoutId":"dummy"}' || true

echo "[4] seller public payload should not leak commissionRate/payoutAccountRef"
SELLERS_JSON=$(curl -s "${BASE_URL}/api/sellers?take=1" || true)
echo "$SELLERS_JSON"
if echo "$SELLERS_JSON" | grep -Eq 'commissionRate|payoutAccountRef'; then
  echo "FAIL: seller payload leaked sensitive fields" >&2
  exit 1
fi

echo "[5] static regression: payment init callers must not use request.url base"
rg -n 'new URL\(\s*"/api/payments/initialize"\s*,\s*request\.url' src/app/api || true

echo "[5b] static regression: internal payment init calls should use trusted base helper + explicit Origin"
rg -n 'getTrustedInternalApiUrl\("/api/payments/initialize"\)|Origin: initializeUrl.origin' src/app/api/presta src/app/api/tiak-tiak || true

echo "Done."

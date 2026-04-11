This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.


## Production Security Checklist

- Set `AUTH_DEBUG_TOKENS=0` (or leave unset) in production so auth endpoints never echo reset/verification tokens.
- Configure `PUBLIC_APP_ORIGIN`, `INTERNAL_BASE_URL`, and `ALLOWED_HOSTS` with trusted production values.
- Include ALL public webhook/callback hostnames (prod + preview/staging domains) in `ALLOWED_HOSTS`, otherwise PayDunya webhooks will be blocked.
- Keep `ALLOW_INSECURE_INTERNAL_CALLS=0` in production and preview/staging environments.
- Set `INTERNAL_API_TOKEN` for server-to-server internal API calls (payment initialization bridges) and keep it secret.
- Rotate and protect `NEXTAUTH_SECRET`, `PAYDUNYA_WEBHOOK_SECRET`, and `PAYMENTS_CALLBACK_TOKEN`.
- Roll out CSP progressively with `CSP_MODE=report-only`, then switch to `CSP_MODE=enforce` once reports are clean.
- Optional: set `AUTH_SESSION_INVALIDATE_BEFORE` to force browser re-auth after a chosen cutoff.
- Enforce HTTPS at the reverse proxy and keep HSTS enabled in production.
- Replace in-memory rate limiting with a shared backend (Redis) before horizontal scaling.
- For distributed auth rate limiting in production, configure `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` (fallback is in-memory only).
- Use a least-privilege database runtime user (no schema migration permissions).
- Treat local `public/uploads` storage as temporary; move uploads to an isolated asset domain/bucket.
- For production, set `PUBLIC_ASSET_BASE_URL` to an isolated asset domain/bucket.
- TODO: `/public/uploads` is still same-origin static serving; move uploads to a dedicated asset domain/bucket (or serve via a hardened download route) before production scale.
- Monitor audit logs for auth abuse, payout conflicts, and payment webhook failures.


## Security Validation Runbook (Staging/Prod)

Set these environment variables on the server (staging first, then production):

```bash
PUBLIC_APP_ORIGIN=https://ton-domaine.tld
ALLOWED_HOSTS=ton-domaine.tld,www.ton-domaine.tld
INTERNAL_BASE_URL=https://ton-domaine.tld
INTERNAL_API_TOKEN=<random-long-secret>
ALLOW_INSECURE_INTERNAL_CALLS=0
AUTH_DEBUG_TOKENS=0
NEXTAUTH_SECRET=<secret>
PAYDUNYA_WEBHOOK_SECRET=<secret>
PAYMENTS_CALLBACK_TOKEN=<secret>
UPSTASH_REDIS_REST_URL=<optional-for-distributed-rate-limit>
UPSTASH_REDIS_REST_TOKEN=<optional-for-distributed-rate-limit>
PUBLIC_ASSET_BASE_URL=<optional-assets-domain>
CSP_MODE=report-only
CSP_REPORT_URI=<optional-report-collector>
AUTH_SESSION_INVALIDATE_BEFORE=<optional-iso-date-or-timestamp>
```

PowerShell (current session):

```powershell
$env:PUBLIC_APP_ORIGIN="https://ton-domaine.tld"
$env:ALLOWED_HOSTS="ton-domaine.tld,www.ton-domaine.tld"
$env:INTERNAL_BASE_URL="https://ton-domaine.tld"
$env:INTERNAL_API_TOKEN="<random-long-secret>"
$env:ALLOW_INSECURE_INTERNAL_CALLS="0"
$env:AUTH_DEBUG_TOKENS="0"
$env:NEXTAUTH_SECRET="<secret>"
$env:PAYDUNYA_WEBHOOK_SECRET="<secret>"
$env:PAYMENTS_CALLBACK_TOKEN="<secret>"
$env:UPSTASH_REDIS_REST_URL="<optional-for-distributed-rate-limit>"
$env:UPSTASH_REDIS_REST_TOKEN="<optional-for-distributed-rate-limit>"
$env:PUBLIC_ASSET_BASE_URL="<optional-assets-domain>"
$env:CSP_MODE="report-only"
$env:CSP_REPORT_URI="<optional-report-collector>"
$env:AUTH_SESSION_INVALIDATE_BEFORE="<optional-iso-date-or-timestamp>"
```

Build and run:

```bash
npm run build
npm start
```

Run security smoke checks (from another terminal in `app/`):

```bash
export BASE_URL=https://ton-domaine.tld
export COOKIE_ADMIN='next-auth.session-token=<token_admin_valide>'
export INTERNAL_API_TOKEN='<internal_api_token>' # optional but recommended for smoke [7b]
bash scripts/smoke/security_regression.sh
```

PowerShell:

```powershell
$env:BASE_URL="https://ton-domaine.tld"
$env:COOKIE_ADMIN="next-auth.session-token=<token_admin_valide>"
$env:INTERNAL_API_TOKEN="<internal_api_token>" # optional but recommended for smoke [7b]
bash scripts/smoke/security_regression.sh
```

Notes:
- Run this on staging before production.
- `ALLOW_INSECURE_INTERNAL_CALLS` must stay `0` on production/preview/staging.
- Include all webhook/callback hostnames in `ALLOWED_HOSTS`.
- Run `npm run qa:seed-auth-fixtures` on a fresh QA/CI database before smoke login checks.
- See `docs/preprod-security-checklist.md` for the compact pre-prod flow.
- See `docs/csp-rollout.md` and `.env.staging.example` for the staged CSP rollout.

## Trust Smoke Runbook (Windows + Bash)

Use this to validate Trust Center flows (`reports`, `disputes`, `blocks`) with real sessions.

Prerequisites:
- App running on the same host used by your browser session (`localhost` vs `192.168.x.x` must match).
- A valid user cookie file (example: `_tmp_cookie_agent.txt`).
- A valid admin cookie (either `_tmp_cookie_admin.txt` or `COOKIE_ADMIN` env var).

PowerShell setup (from `app/`):

```powershell
$env:BASE_URL="http://localhost:3000"
$env:COOKIE_USER_FILE="_tmp_cookie_agent.txt"
$env:COOKIE_ADMIN_FILE="_tmp_cookie_admin.txt"   # or set $env:COOKIE_ADMIN directly
$env:REPORT_USER_ID="<USER_ID_TO_REPORT>"
$env:BLOCK_USER_ID="<USER_ID_TO_BLOCK>"
$env:ORDER_REF_ID="<ORDER_OR_REF_ID>"
$env:REPORT_ID="<REPORT_ID>"
```

Validate sessions before smoke:

```powershell
curl.exe -i --cookie $env:COOKIE_USER_FILE "$env:BASE_URL/api/profile"
curl.exe -i --cookie $env:COOKIE_ADMIN_FILE "$env:BASE_URL/api/profile"
```

Both checks should return `200`. If admin returns `401`, refresh/regenerate admin cookie first.

Run smoke:

```powershell
bash scripts/smoke/trust_smoke.sh
```


## Notification System (V0.1)

- Outbox model: emails are queued in `EmailOutbox` and dispatched asynchronously by `POST /api/cron/notifications`.
- Idempotence: each notification uses a unique `dedupeKey` (example: `order_paid:<orderId>`).
- Providers: `EMAIL_PROVIDER=console` (dev) or `EMAIL_PROVIDER=resend` with `RESEND_API_KEY` + `RESEND_FROM_EMAIL`.
- Cron auth: send `x-cron-secret: <CRON_SECRET>` (or `Authorization: Bearer <CRON_SECRET>`).
- Marketing unsubscribe: links use signed tokens via `/api/unsubscribe?token=...`.
- Unsubscribe signing uses `HMAC_SECRET_CURRENT` (active) and optionally `HMAC_SECRET_PREVIOUS` for secret rotation.
- Unsubscribe tokens are marketing-only and expire (`UNSUBSCRIBE_TOKEN_TTL_SECONDS`, default 30 days).
- Current hooks: order paid, delivery status updates, price-drop alerts (favorites), payment reminders, weekly deals digest.

Example cron trigger:

```bash
curl -X POST "http://localhost:3000/api/cron/notifications" \
  -H "Content-Type: application/json" \
  -H "x-cron-secret: <CRON_SECRET>" \
  --data '{"limit":50}'
```

Quick QA check (static + optional runtime checks):

```bash
npm run qa:notifications
```

Optional runtime assertions for `/api/admin/notifications/health`:
- Set `BASE_URL` + `COOKIE_ADMIN` to validate admin `200` response shape.
- Set `COOKIE_USER` to validate non-admin `403 FORBIDDEN` response.

Example:

```bash
BASE_URL=http://localhost:3000 \
COOKIE_ADMIN='next-auth.session-token=<admin_token>' \
COOKIE_USER='next-auth.session-token=<user_token>' \
npm run qa:notifications
```


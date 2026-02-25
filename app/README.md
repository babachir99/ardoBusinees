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
- Keep `ALLOW_INSECURE_INTERNAL_CALLS=0` in production and preview/staging environments.
- Set `INTERNAL_API_TOKEN` for server-to-server internal API calls (payment initialization bridges) and keep it secret.
- Rotate and protect `NEXTAUTH_SECRET`, `PAYDUNYA_WEBHOOK_SECRET`, and `PAYMENTS_CALLBACK_TOKEN`.
- Enforce HTTPS at the reverse proxy and keep HSTS enabled in production.
- Replace in-memory rate limiting with a shared backend (Redis) before horizontal scaling.
- Use a least-privilege database runtime user (no schema migration permissions).
- Treat local `public/uploads` storage as temporary; move uploads to an isolated asset domain/bucket.
- Monitor audit logs for auth abuse, payout conflicts, and payment webhook failures.

# Pre-Prod Security Checklist

## 1. Environnements et secrets
- Configurer `PUBLIC_APP_ORIGIN`, `ALLOWED_HOSTS`, `INTERNAL_BASE_URL`, `INTERNAL_API_TOKEN`
- Garder `ALLOW_INSECURE_INTERNAL_CALLS=0`
- Garder `AUTH_DEBUG_TOKENS=0`
- Rotater `NEXTAUTH_SECRET`, `PAYDUNYA_WEBHOOK_SECRET`, `PAYMENTS_CALLBACK_TOKEN`
- Utiliser un secret distinct par environnement

## 2. Sessions et neutralisation
- Rotation globale immediate: changer `NEXTAUTH_SECRET` pour invalider les JWT existants
- Neutralisation progressive cote UX: definir `AUTH_SESSION_INVALIDATE_BEFORE` avec une date ISO ou un timestamp
- Exemple: `AUTH_SESSION_INVALIDATE_BEFORE=2026-04-11T12:00:00Z`
- Cette option force la reconnexion navigateur au prochain chargement; la rotation de `NEXTAUTH_SECRET` reste la voie forte pour une revocation globale

## 3. CSP progressive
- Etape 1: `CSP_MODE=report-only` sur preview/staging
- Etape 2: collecter les violations via `CSP_REPORT_URI` si disponible
- Etape 3: passer la production en `report-only`
- Etape 4: basculer en `CSP_MODE=enforce` une fois les violations legitimes nettoyees
- `CSP_MODE=off` reste reserve au debug local

## 4. QA minimale avant mise en ligne
- `npm run lint`
- `npm run typecheck`
- `npm run qa:auth`
- `npm run qa:kyc`
- `npm run qa:forms-prefill`
- `npm run build`
- `npm run qa:smoke -- --readonly`

## 5. Base fraiche locale / CI 
```bash
npx prisma migrate deploy
npm run seed
npm run qa:seed-auth-fixtures
npm run verify
```

Puis:

```bash
npm start
npm run qa:smoke -- --readonly
```

## 6. Point d'attention restant
- `npm audit` est descendu a 3 vulnerabilites moderées transitives cote Prisma tooling
- Ne pas lancer `npm audit fix --force` ici: il propose un downgrade Prisma non souhaite

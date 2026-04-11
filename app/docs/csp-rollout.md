# CSP Rollout Plan

## Objectif
Passer de `Content-Security-Policy-Report-Only` a `Content-Security-Policy` sans casser les flows critiques.

## Variables
- `CSP_MODE=off|report-only|enforce`
- `CSP_REPORT_URI=<collector>`

## Etape 1 - Preview / staging en report-only
- Copier `.env.staging.example`
- Garder `CSP_MODE=report-only`
- Renseigner `CSP_REPORT_URI`
- Verifier les envs:

```bash
npm run qa:env:staging
```

- Lancer la suite locale/CI:

```bash
npm run verify
npm run qa:smoke:readonly -- --base-url=http://127.0.0.1:3010
```

## Etape 2 - Corriger les violations legitimes
Verifier surtout:
- cartes/iframes externes
- scripts tiers
- images externes
- callbacks / webhooks / APIs front
- uploads et assets

## Etape 3 - Production en report-only
- Basculer d'abord la prod sur `CSP_MODE=report-only`
- Laisser tourner 24 a 48h
- Observer les violations reelles
- Filtrer le bruit navigateur / extensions

## Etape 4 - Enforcement
- Passer `CSP_MODE=enforce`
- Garder le meme policy set
- Conserver `CSP_REPORT_URI` si tu veux encore monitorer

## Rollback rapide
Si un flow critique casse:
- repasser `CSP_MODE=report-only`
- redeployer

## Checklist avant enforce
- login OK
- recherche OK
- checkout OK
- pages verticales OK
- maps / embeds OK
- upload / affichage image OK
- dashboards admin / seller OK
- smoke readonly OK
- QA auth / kyc / forms-prefill OK

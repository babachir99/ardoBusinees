# JONTAADO Verticales (Canonique)

## Definition des verticales
- `SHOP`: marketplace produits (catalogue + panier + checkout)
- `PRESTA`: services (prestataires)
- `GP`: transport au kilo (voyageur)
- `TIAK_TIAK`: livraison/courses

Source de verite code:
- `src/lib/verticals.ts`
- `src/lib/policies/contactPolicy.ts`

## Routes existantes par verticale

### SHOP
- Pages: `src/app/[locale]/shop/page.tsx`, `src/app/[locale]/shop/[slug]/page.tsx`
- API: `src/app/api/products/route.ts`, `src/app/api/orders/route.ts`, `src/app/api/cart/route.ts`

### GP
- Pages: `src/app/[locale]/stores/jontaado-gp/page.tsx`
- API: `src/app/api/gp/trips/route.ts`, `src/app/api/gp/trips/[id]/route.ts`, `src/app/api/gp/trips/[id]/bookings/route.ts`, `src/app/api/gp/trips/[id]/reviews/route.ts`

### PRESTA
- Pages: `src/app/[locale]/stores/jontaado-presta/page.tsx`
- API skeleton: `src/app/api/presta/route.ts`

### TIAK TIAK
- Pages: `src/app/[locale]/stores/jontaado-tiak-tiak/page.tsx`
- API skeleton: `src/app/api/tiak-tiak/route.ts`

### Admin / Paiements (transversal)
- Admin: `src/app/[locale]/admin/page.tsx` et routes `src/app/api/admin/**`
- Paiements provider-ready: `src/app/api/payments/initialize/route.ts`, `src/app/api/payments/callback/route.ts`

## Privacy contact (etat actuel)
- GP: contact verrouille par defaut pour le public.
- Deverrouillage contact: owner/admin ou booking client statut `CONFIRMED|COMPLETED|DELIVERED`.
- Les endpoints publics GP ne doivent pas exposer `phone`/`contactPhone`.

## Brancher PayDunya plus tard
- Point d'entree creation intention: `src/app/api/payments/initialize/route.ts`
- Retour provider/webhook: `src/app/api/payments/callback/route.ts`
- Integration future: mapper refs PayDunya vers `Payment` + synchro `Order`/`Payout`.

## Extension Tiak Tiak (prochaine etape)
- Ajouter endpoints metier:
  - bookings lifecycle (assignation, pickup, in_transit, delivered)
  - tracking events (preuve photo + horodatage)
  - disputes (incident, mediation, resolution)
  - payouts coursiers
- Reutiliser la policy contact canonique (`src/lib/policies/contactPolicy.ts`).

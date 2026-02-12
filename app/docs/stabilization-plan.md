# Stabilization Sprint (7 days)

## Goals
- Freeze regressions on critical user flows.
- Keep delivery speed while reducing hotfix churn.
- Standardize quality checks before each feature merge.

## Critical flows (must pass)
1. Sign up / login / logout / redirect to home.
2. Add to cart / cart persistence per user / checkout.
3. Order payment (mock) / stock decrement / seller+admin stats update.
4. Product detail / wishlist / share / message seller.
5. Seller product create/edit with category + media.
6. Admin moderation (users, sellers, products, categories, stores).

## Day-by-day plan

### Day 1 - Baseline and blockers
- [x] Fix lint blocking error in cart scope resolver.
- [x] Re-validate build success on current branch.
- [x] Add `npm run verify` pipeline command.
- [ ] Snapshot known warnings and rank by impact.

### Day 2 - Cart and checkout reliability
- [ ] Enforce quantity <= stock on all entry points (detail, cart, checkout).
- [ ] Add explicit UI states for out-of-stock and stock race.
- [ ] Cover multi-seller cart split order edge cases.

### Day 3 - Orders and stats integrity
- [ ] Audit payment mock callback consistency.
- [ ] Ensure seller/admin dashboards refresh from persisted order state.
- [ ] Add idempotency guard on payment finalization.

### Day 4 - Messaging and offers hardening
- [ ] Conversation access rules (buyer/seller/admin only).
- [ ] Anti-abuse text filters (links/phone/email) in message pipeline.
- [ ] Offer lifecycle checks (open/counter/accepted/rejected).

### Day 5 - Seller publishing workflow
- [ ] Validate category-specific required fields.
- [ ] Normalize product media rules and upload limits.
- [ ] Improve publish form error messaging and recovery.

### Day 6 - Admin control surface
- [ ] CRUD parity audit (categories, subcategories, stores, sellers).
- [ ] Add safe guards for destructive actions.
- [ ] Add small operational logs in admin actions.

### Day 7 - QA and release gate
- [ ] Manual QA runbook execution on the 6 critical flows.
- [ ] Clean top lint warnings affecting reliability.
- [ ] Tag release candidate and lock regression checklist.

## Quality gate (before shipping)
- `npm run verify` passes.
- No 5xx on critical APIs during manual smoke.
- No broken links from profile/cart/orders/product detail.

## Notes
- UI polishing is intentionally deferred unless it blocks conversion.
- Backend consistency and flow reliability are the priority.

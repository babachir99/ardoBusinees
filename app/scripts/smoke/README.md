# Smoke tests (golden curls)

Files:
- `golden_smoke.sh`: 11 curl-based checks covering IMMO quota/slots, webhook replay idempotence, CARS -> orchestrator -> GP attach flow.

Scenarios covered:
1. Dealer pro (IMMO): quota full -> buy `EXTRA_SLOTS_10` -> webhook confirm -> publish OK.
2. Intent GP (CARS source): create intent -> GET intent (prefill source for UI) -> create GP trip -> attach -> re-attach (409/400 expected).
3. Webhook replay confirm: same PayDunya confirm called twice (must no-op safely).

Manual UI step included (not automatable with curl):
- Open `/gp?intentId=<ORCH_INTENT_ID>` and verify prefill before creating the GP trip.

Prerequisites:
- Replace placeholder env vars in the script (cookies, IDs, callback token, webhook intent id).
- Optional: copy `scripts/smoke/.env.example` to a local env file and `source` it before running the script.
- Run from repo root `app/` or invoke with full path.
- Ensure DB migrations are applied and dev server is running.

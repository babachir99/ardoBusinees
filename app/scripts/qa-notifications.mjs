import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

function assertContains(source, pattern, label) {
  if (!pattern.test(source)) {
    throw new Error(`Missing ${label}`);
  }
}

async function main() {
  const root = process.cwd();
  const schema = await readFile(path.join(root, "prisma", "schema.prisma"), "utf8");
  const service = await readFile(path.join(root, "src", "lib", "notifications", "NotificationService.ts"), "utf8");
  const provider = await readFile(path.join(root, "src", "lib", "notifications", "providers", "ResendProvider.ts"), "utf8");
  const unsubscribe = await readFile(path.join(root, "src", "lib", "notifications", "unsubscribe.ts"), "utf8");
  const callbackRoute = await readFile(path.join(root, "src", "app", "api", "payments", "callback", "route.ts"), "utf8");
  const webhookRoute = await readFile(path.join(root, "src", "app", "api", "payments", "webhook", "paydunya", "route.ts"), "utf8");
  const eventsRoute = await readFile(path.join(root, "src", "app", "api", "orders", "[id]", "events", "route.ts"), "utf8");

  assertContains(schema, /model\s+NotificationPreference\s+\{/, "NotificationPreference model");
  assertContains(schema, /model\s+EmailOutbox\s+\{/, "EmailOutbox model");
  assertContains(schema, /dedupeKey\s+String\s+@unique/, "EmailOutbox dedupe unique key");
  assertContains(service, /P2002/, "queueEmail dedupe conflict handling");
  assertContains(service, /releaseStaleLocks/, "stale lock recovery");
  assertContains(service, /updateMany\([\s\S]*lockId,\s*lockedAt:\s*now/, "atomic lock set via updateMany + lockId");
  assertContains(service, /findMany\([\s\S]*where:\s*\{\s*lockId,/, "fetch locked rows by lockId");

  // QA case 1: retryable provider errors requeue with backoff
  assertContains(service, /status:\s*retryable\s*\?\s*EmailOutboxStatus\.PENDING\s*:\s*EmailOutboxStatus\.FAILED/, "retryable errors go back to PENDING");
  assertContains(service, /scheduledAt:\s*nextScheduledAt/, "retry/backoff scheduling applied");

  // QA case 2: non-retryable provider errors fail definitively
  assertContains(service, /const retryable = shouldRetrySend\(error, nextAttempt\);/, "retryability gate");
  assertContains(service, /lastError:\s*getProviderErrorCode\(error\)/, "sanitized provider error code persisted");

  assertContains(service, /idempotencyKey:\s*row\.dedupeKey/, "provider idempotency key uses dedupeKey");
  assertContains(provider, /"Idempotency-Key":\s*input\.idempotencyKey/, "Resend idempotency header");

  assertContains(service, /marketingEmailEnabled/, "marketing preference guard");
  assertContains(service, /priceDropEmailEnabled/, "price-drop preference guard");
  assertContains(unsubscribe, /kind:\s*"MARKETING"/, "unsubscribe token marketing kind");
  assertContains(unsubscribe, /exp:\s*nowSeconds\s*\+\s*getTokenTtlSeconds\(\)/, "unsubscribe token expiration");
  assertContains(unsubscribe, /HMAC_SECRET_CURRENT/, "unsubscribe current HMAC secret");
  assertContains(unsubscribe, /HMAC_SECRET_PREVIOUS/, "unsubscribe previous HMAC secret rotation");
  assertContains(unsubscribe, /if \(parsed\.kind !== "MARKETING"\) return null;/, "unsubscribe kind verification");
  assertContains(unsubscribe, /if \(parsed\.exp <= nowSeconds\) return null;/, "unsubscribe expiration verification");
  assertContains(callbackRoute, /queueOrderPaidEmail\(/, "callback paid notification hook");
  assertContains(webhookRoute, /queueOrderPaidEmail\(/, "webhook paid notification hook");
  assertContains(eventsRoute, /queueDeliveryUpdateEmail\(/, "delivery update notification hook");

  console.log("[qa:notifications] OK - notification guardrails and hooks detected.");
}

main().catch((error) => {
  console.error("[qa:notifications] FAILED:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});

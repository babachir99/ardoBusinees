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
  const callbackRoute = await readFile(path.join(root, "src", "app", "api", "payments", "callback", "route.ts"), "utf8");
  const webhookRoute = await readFile(path.join(root, "src", "app", "api", "payments", "webhook", "paydunya", "route.ts"), "utf8");
  const eventsRoute = await readFile(path.join(root, "src", "app", "api", "orders", "[id]", "events", "route.ts"), "utf8");

  assertContains(schema, /model\s+NotificationPreference\s+\{/, "NotificationPreference model");
  assertContains(schema, /model\s+EmailOutbox\s+\{/, "EmailOutbox model");
  assertContains(schema, /dedupeKey\s+String\s+@unique/, "EmailOutbox dedupe unique key");
  assertContains(service, /P2002/, "queueEmail dedupe conflict handling");
  assertContains(service, /lockId/, "outbox locking field usage");
  assertContains(service, /releaseStaleLocks/, "stale lock recovery");
  assertContains(service, /marketingEmailEnabled/, "marketing preference guard");
  assertContains(service, /priceDropEmailEnabled/, "price-drop preference guard");
  assertContains(callbackRoute, /queueOrderPaidEmail\(/, "callback paid notification hook");
  assertContains(webhookRoute, /queueOrderPaidEmail\(/, "webhook paid notification hook");
  assertContains(eventsRoute, /queueDeliveryUpdateEmail\(/, "delivery update notification hook");

  console.log("[qa:notifications] OK - notification guardrails and hooks detected.");
}

main().catch((error) => {
  console.error("[qa:notifications] FAILED:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});

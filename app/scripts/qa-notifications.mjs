import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";
import process from "node:process";
import ts from "typescript";


function loadTsModule(source, filename) {
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
    fileName: filename,
  }).outputText;

  const module = { exports: {} };
  const context = vm.createContext({
    module,
    exports: module.exports,
    process,
    console,
  });

  vm.runInContext(transpiled, context, { filename });
  return module.exports;
}


async function runRuntimeHealthCheck() {
  const baseUrl = String(process.env.BASE_URL ?? "").trim();
  const adminCookie = String(process.env.COOKIE_ADMIN ?? "").trim();
  const userCookie = String(process.env.COOKIE_USER ?? "").trim();

  if (!baseUrl) {
    return { adminExecuted: false, userExecuted: false };
  }

  let adminExecuted = false;
  let userExecuted = false;

  if (adminCookie) {
    const adminResponse = await fetch(`${baseUrl.replace(/\/$/, "")}/api/admin/notifications/health`, {
      method: "GET",
      headers: {
        cookie: adminCookie,
        accept: "application/json",
      },
      cache: "no-store",
    });

    assert.equal(adminResponse.status, 200, "runtime health endpoint should return 200 for admin");

    const adminBody = await adminResponse.json().catch(() => null);
    assert.ok(adminBody && typeof adminBody === "object", "runtime health payload should be JSON object");
    assert.equal(adminBody.ok, true, "runtime health ok flag");
    assert.equal(adminBody.code, "NOTIFICATIONS_HEALTH", "runtime health code");
    assert.ok(adminBody.health && typeof adminBody.health === "object", "runtime health object present");
    assert.ok(adminBody.health.counts && typeof adminBody.health.counts === "object", "runtime counts object present");
    adminExecuted = true;
  }

  if (userCookie) {
    const userResponse = await fetch(`${baseUrl.replace(/\/$/, "")}/api/admin/notifications/health`, {
      method: "GET",
      headers: {
        cookie: userCookie,
        accept: "application/json",
      },
      cache: "no-store",
    });

    assert.equal(userResponse.status, 403, "runtime health endpoint should return 403 for non-admin");
    const userBody = await userResponse.json().catch(() => null);
    assert.ok(userBody && typeof userBody === "object", "runtime non-admin payload should be JSON object");
    assert.equal(userBody.ok, false, "runtime non-admin ok flag");
    assert.equal(userBody.code, "FORBIDDEN", "runtime non-admin code");
    userExecuted = true;
  }

  return { adminExecuted, userExecuted };
}

function assertContains(source, pattern, label) {
  if (!pattern.test(source)) {
    throw new Error(`Missing ${label}`);
  }
}

async function main() {
  const root = process.cwd();
  const schema = await readFile(path.join(root, "prisma", "schema.prisma"), "utf8");
  const service = await readFile(path.join(root, "src", "lib", "notifications", "NotificationService.ts"), "utf8");
  const templateRegistry = await readFile(path.join(root, "src", "lib", "notifications", "templates", "registry.ts"), "utf8");
  const provider = await readFile(path.join(root, "src", "lib", "notifications", "providers", "ResendProvider.ts"), "utf8");
  const unsubscribe = await readFile(path.join(root, "src", "lib", "notifications", "unsubscribe.ts"), "utf8");
  const healthRoute = await readFile(path.join(root, "src", "app", "api", "admin", "notifications", "health", "route.ts"), "utf8");
  const deliveryStep = await readFile(path.join(root, "src", "lib", "notifications", "delivery-step.ts"), "utf8");
  const callbackRoute = await readFile(path.join(root, "src", "app", "api", "payments", "callback", "route.ts"), "utf8");
  const webhookRoute = await readFile(path.join(root, "src", "app", "api", "payments", "webhook", "paydunya", "route.ts"), "utf8");
  const eventsRoute = await readFile(path.join(root, "src", "app", "api", "orders", "[id]", "events", "route.ts"), "utf8");
  const gpTimelineRoute = await readFile(path.join(root, "src", "app", "api", "gp", "shipments", "[id]", "timeline", "route.ts"), "utf8");

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

  // Invariants: template key, payload size, scheduling, attempts cap
  assertContains(templateRegistry, /isKnownNotificationTemplateKey/, "template key registry helper");
  assertContains(service, /UNKNOWN_TEMPLATE_KEY/, "queueEmail rejects unknown templates");
  assertContains(service, /PAYLOAD_TOO_LARGE/, "queueEmail payload size invariant");
  assertContains(service, /SCHEDULE_TOO_FAR/, "queueEmail schedule horizon invariant");
  assertContains(service, /ATTEMPTS_HARD_CAP\s*=\s*8/, "sendPendingBatch hard attempts cap");
  assertContains(service, /if \(row\.attempts >= ATTEMPTS_HARD_CAP\)/, "row-level attempts cap enforcement");

  assertContains(service, /marketingEmailEnabled/, "marketing preference guard");
  assertContains(service, /priceDropEmailEnabled/, "price-drop preference guard");
  assertContains(unsubscribe, /kind:\s*"MARKETING"/, "unsubscribe token marketing kind");
  assertContains(unsubscribe, /exp:\s*nowSeconds\s*\+\s*getTokenTtlSeconds\(\)/, "unsubscribe token expiration");
  assertContains(unsubscribe, /HMAC_SECRET_CURRENT/, "unsubscribe current HMAC secret");
  assertContains(unsubscribe, /HMAC_SECRET_PREVIOUS/, "unsubscribe previous HMAC secret rotation");
  assertContains(unsubscribe, /if \(parsed\.kind !== "MARKETING"\) return null;/, "unsubscribe kind verification");
  assertContains(unsubscribe, /if \(parsed\.exp <= nowSeconds\) return null;/, "unsubscribe expiration verification");
  assertContains(healthRoute, /NO_SESSION/, "notifications health auth guard");
  assertContains(healthRoute, /FORBIDDEN/, "notifications health admin guard");
  assertContains(healthRoute, /code:\s*"NOTIFICATIONS_HEALTH"/, "notifications health response code");
  assertContains(healthRoute, /counts/, "notifications health counts shape");
  assertContains(healthRoute, /topTemplateFailures/, "notifications health top failures shape");
  assertContains(callbackRoute, /queueOrderPaidEmail\(/, "callback paid notification hook");
  assertContains(webhookRoute, /queueOrderPaidEmail\(/, "webhook paid notification hook");
  assertContains(eventsRoute, /queueDeliveryUpdateEmail\(/, "delivery update notification hook");
  assertContains(service, /normalizeDeliveryStep\(/, "normalized delivery step used in notification service");
  assertContains(gpTimelineRoute, /normalizeDeliveryStep\("GP"/, "normalized delivery step used for GP updates");

  const { normalizeDeliveryStep } = loadTsModule(
    deliveryStep,
    path.join(root, "src", "lib", "notifications", "delivery-step.ts")
  );

  assert.equal(normalizeDeliveryStep("SHOP", "SHIPPED"), "IN_TRANSIT");
  assert.equal(normalizeDeliveryStep("GP", "BOARDED"), "IN_TRANSIT");
  assert.equal(normalizeDeliveryStep("TIAK", "PICKED_UP"), "PICKED_UP");

  const runtimeCheck = await runRuntimeHealthCheck();
  const runtimeParts = [];
  if (runtimeCheck.adminExecuted) runtimeParts.push("admin health check executed");
  if (runtimeCheck.userExecuted) runtimeParts.push("non-admin authz check executed");
  const runtimeSuffix =
    runtimeParts.length > 0
      ? ` Runtime checks: ${runtimeParts.join(" + ")}.`
      : " Runtime checks skipped (set BASE_URL and COOKIE_ADMIN and/or COOKIE_USER).";

  console.log(
    `[qa:notifications] OK - notification guardrails and hooks detected.${runtimeSuffix}`
  );
}

main().catch((error) => {
  console.error("[qa:notifications] FAILED:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});

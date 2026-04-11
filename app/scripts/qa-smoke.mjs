#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

function parseArgs(argv) {
  const options = {
    mode: "full",
    cleanup: "auto",
    baseUrl: process.env.QA_BASE_URL ?? "http://127.0.0.1:3000",
    email: process.env.QA_EMAIL,
    password: process.env.QA_PASSWORD,
    expectMockPayment: process.env.QA_EXPECT_MOCK_PAYMENT === "1",
    verbose: false,
  };

  for (const arg of argv) {
    if (arg === "--help" || arg === "-h") {
      options.help = true;
      continue;
    }
    if (arg === "--readonly") {
      options.mode = "readonly";
      continue;
    }
    if (arg === "--full") {
      options.mode = "full";
      continue;
    }
    if (arg === "--no-cleanup") {
      options.cleanup = "off";
      continue;
    }
    if (arg === "--verbose") {
      options.verbose = true;
      continue;
    }
    if (arg === "--expect-mock-payment") {
      options.expectMockPayment = true;
      continue;
    }
    if (arg.startsWith("--mode=")) {
      const value = arg.slice("--mode=".length).trim().toLowerCase();
      if (value === "readonly" || value === "full") {
        options.mode = value;
      }
      continue;
    }
    if (arg.startsWith("--base-url=")) {
      options.baseUrl = arg.slice("--base-url=".length).trim();
      continue;
    }
    if (arg.startsWith("--email=")) {
      options.email = arg.slice("--email=".length).trim();
      continue;
    }
    if (arg.startsWith("--password=")) {
      options.password = arg.slice("--password=".length);
      continue;
    }
  }

  return options;
}

function printHelp() {
  console.log(
    [
      "QA smoke runner",
      "",
      "Usage:",
      "  node scripts/qa-smoke.mjs [options]",
      "",
      "Options:",
      "  --full                Run checkout/payment + messaging tests (default).",
      "  --readonly            Run only non-order flow (no order/payment creation).",
      "  --no-cleanup          Keep created QA records (full mode only).",
      "  --base-url=URL        API base URL (default: http://127.0.0.1:3000).",
      "  --email=EMAIL         Account for login (optional).",
      "  --password=PASS       Password for login (optional).",
      "  --expect-mock-payment Fail if mock payment is unavailable.",
      "  --verbose             Print extra details.",
      "  --help, -h            Show this help.",
      "",
      "Environment:",
      "  QA_BASE_URL, QA_EMAIL, QA_PASSWORD, DATABASE_URL, QA_EXPECT_MOCK_PAYMENT",
      "",
      "Notes:",
      "  - Server must already be running.",
      "  - In full mode, the script attempts DB cleanup if DATABASE_URL is available.",
    ].join("\n")
  );
}

function loadEnvFromDotEnv() {
  const envPath = path.join(process.cwd(), ".env");
  if (!fs.existsSync(envPath)) return;

  const content = fs.readFileSync(envPath, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx <= 0) continue;
    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

class HttpClient {
  constructor(baseUrl) {
    this.baseUrl = baseUrl.replace(/\/+$/, "");
    this.cookies = new Map();
  }

  setCookiesFromResponse(response) {
    const values = response.headers.getSetCookie?.() ?? [];
    for (const raw of values) {
      const pair = String(raw).split(";")[0];
      const idx = pair.indexOf("=");
      if (idx <= 0) continue;
      const name = pair.slice(0, idx);
      const value = pair.slice(idx + 1);
      if (!value) this.cookies.delete(name);
      else this.cookies.set(name, value);
    }
  }

  getCookieHeader() {
    return Array.from(this.cookies.entries())
      .map(([name, value]) => `${name}=${value}`)
      .join("; ");
  }

  async request(pathname, init = {}) {
    const headers = new Headers(init.headers ?? {});
    const cookie = this.getCookieHeader();
    if (cookie) headers.set("cookie", cookie);
    const response = await fetch(`${this.baseUrl}${pathname}`, {
      ...init,
      headers,
      redirect: "manual",
    });
    this.setCookiesFromResponse(response);
    return response;
  }

  async json(pathname, init = {}) {
    const response = await this.request(pathname, init);
    const data = await response.json().catch(() => null);
    return { response, data };
  }
}

function createReporter(verbose = false) {
  const checks = [];

  function add(step, ok, details = "") {
    checks.push({ step, ok, details });
    const prefix = ok ? "[PASS]" : "[FAIL]";
    console.log(`${prefix} ${step}${details ? ` - ${details}` : ""}`);
  }

  function info(message, payload) {
    if (!verbose) return;
    if (payload === undefined) {
      console.log(`[INFO] ${message}`);
      return;
    }
    console.log(`[INFO] ${message}: ${JSON.stringify(payload, null, 2)}`);
  }

  return {
    add,
    info,
    get checks() {
      return checks;
    },
  };
}

async function ensureServerReachable(client) {
  try {
    const response = await client.request("/api/profile");
    return response.status === 200 || response.status === 401;
  } catch {
    return false;
  }
}

async function login(client, email, password) {
  const { response: csrfRes, data: csrfData } = await client.json("/api/auth/csrf");
  if (!csrfRes.ok || !csrfData?.csrfToken) {
    return { ok: false, reason: `csrf_${csrfRes.status}` };
  }

  const body = new URLSearchParams({
    csrfToken: String(csrfData.csrfToken),
    email,
    password,
    callbackUrl: `${client.baseUrl}/fr`,
    json: "true",
  });

  const authRes = await client.request("/api/auth/callback/credentials", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (authRes.status !== 200 && authRes.status !== 302) {
    return { ok: false, reason: `login_${authRes.status}` };
  }

  const { response: profileRes, data: profileData } = await client.json("/api/profile");
  if (!profileRes.ok || !profileData?.id) {
    return { ok: false, reason: `profile_${profileRes.status}` };
  }

  return { ok: true, profile: profileData };
}

function fallbackCredentials() {
  const seededPassword = "123456";
  return [
    { email: "bachir.ba.bb@gmail.com", password: seededPassword },
    { email: "admin@ardobusiness.com", password: seededPassword },
    { email: "seller@ardobusiness.com", password: seededPassword },
    { email: "ousmane@gmail.com", password: seededPassword },
    { email: "awa@gmail.com", password: seededPassword },
    { email: "amy@gmail.com", password: seededPassword },
    { email: "malick@gmail.com", password: seededPassword },
  ];
}

function uniqueCredentials(list) {
  const seen = new Set();
  const result = [];
  for (const entry of list) {
    if (!entry?.email || !entry?.password) continue;
    const key = `${entry.email.toLowerCase()}::${entry.password}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(entry);
  }
  return result;
}

function createPrismaFromEnv() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) return null;
  const schema = new URL(databaseUrl).searchParams.get("schema") ?? "public";
  const adapter = new PrismaPg({ connectionString: databaseUrl }, { schema });
  return new PrismaClient({ adapter });
}

async function cleanupOrder(prisma, orderId) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: { select: { productId: true, quantity: true, type: true } } },
  });
  if (!order) return { orderId, removed: false, reason: "not_found" };

  const result = {
    orderId,
    removed: true,
    payouts: 0,
    payment: 0,
    events: 0,
    orderMessages: 0,
    orderItems: 0,
    restocked: [],
  };

  await prisma.$transaction(async (tx) => {
    result.payouts = (await tx.payout.deleteMany({ where: { orderId } })).count;
    result.payment = (await tx.payment.deleteMany({ where: { orderId } })).count;
    result.events = (await tx.orderEvent.deleteMany({ where: { orderId } })).count;
    result.orderMessages = (await tx.orderMessage.deleteMany({ where: { orderId } })).count;
    result.orderItems = (await tx.orderItem.deleteMany({ where: { orderId } })).count;
    await tx.order.delete({ where: { id: orderId } });

    for (const item of order.items) {
      if (item.type !== "LOCAL" || item.quantity <= 0) continue;
      const updated = await tx.product.updateMany({
        where: { id: item.productId },
        data: { stockQuantity: { increment: item.quantity } },
      });
      if (updated.count > 0) {
        result.restocked.push({ productId: item.productId, quantity: item.quantity });
      }
    }
  });

  return result;
}

function createSummary(checks, context) {
  const failed = checks.filter((check) => !check.ok);
  return {
    ok: failed.length === 0,
    failedSteps: failed.map((check) => check.step),
    checks,
    context,
  };
}

async function main() {
  loadEnvFromDotEnv();
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printHelp();
    return;
  }

  const reporter = createReporter(options.verbose);
  const client = new HttpClient(options.baseUrl);

  const context = {
    mode: options.mode,
    baseUrl: options.baseUrl,
    account: null,
    profile: null,
    pickedProduct: null,
    cart: null,
    order: null,
    messaging: null,
    cleanup: null,
    loginAttempts: [],
  };

  const serverReady = await ensureServerReachable(client);
  reporter.add("server_reachable", serverReady, options.baseUrl);
  if (!serverReady) {
    console.log(JSON.stringify(createSummary(reporter.checks, context), null, 2));
    process.exit(1);
  }

  const credentialsToTry = uniqueCredentials([
    options.email && options.password
      ? { email: options.email, password: options.password }
      : null,
    options.email && !options.password
      ? { email: options.email, password: "123456" }
      : null,
    ...fallbackCredentials(),
  ]);

  let loggedIn = null;
  for (const candidate of credentialsToTry) {
    const attempt = await login(client, candidate.email, candidate.password);
    context.loginAttempts.push({
      email: candidate.email,
      ok: attempt.ok,
      reason: attempt.reason ?? null,
    });
    if (attempt.ok) {
      loggedIn = { ...attempt, ...candidate };
      break;
    }
  }

  reporter.add(
    "login",
    Boolean(loggedIn),
    loggedIn ? loggedIn.email : "no valid credentials"
  );
  if (!loggedIn) {
    console.log(JSON.stringify(createSummary(reporter.checks, context), null, 2));
    process.exit(1);
  }

  context.account = loggedIn.email;
  context.profile = {
    id: loggedIn.profile.id,
    email: loggedIn.profile.email,
    role: loggedIn.profile.role,
  };

  const { response: sellerRes, data: sellerData } = await client.json("/api/seller/me");
  const mySellerId = sellerRes.ok ? sellerData?.id : null;

  const { response: productsRes, data: productsData } = await client.json("/api/products?take=120");
  const productsOk = productsRes.ok && Array.isArray(productsData);
  reporter.add("load_products", productsOk, `status=${productsRes.status}`);
  if (!productsOk) {
    console.log(JSON.stringify(createSummary(reporter.checks, context), null, 2));
    process.exit(1);
  }

  const products = productsData;
  const targetProduct =
    products.find(
      (product) =>
        product?.type === "LOCAL" &&
        product?.isActive &&
        Number(product?.stockQuantity ?? 0) > 0 &&
        (!mySellerId || product?.seller?.id !== mySellerId)
    ) ??
    products.find((product) => product?.isActive && (!mySellerId || product?.seller?.id !== mySellerId));

  const productSelected = Boolean(targetProduct);
  reporter.add("select_product", productSelected);
  if (!productSelected) {
    console.log(JSON.stringify(createSummary(reporter.checks, context), null, 2));
    process.exit(1);
  }

  context.pickedProduct = {
    id: targetProduct.id,
    title: targetProduct.title,
    type: targetProduct.type,
    stockQuantity: targetProduct.stockQuantity,
    sellerId: targetProduct.seller?.id ?? null,
  };

  await client.request("/api/cart", { method: "DELETE" });

  const requestedQty =
    targetProduct.type === "LOCAL"
      ? Math.max(1, Number(targetProduct.stockQuantity ?? 1) + 5)
      : 2;

  const { response: cartAddRes, data: cartAddData } = await client.json("/api/cart", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ productId: targetProduct.id, quantity: requestedQty }),
  });

  const cartAddOk = cartAddRes.ok && Array.isArray(cartAddData?.items);
  reporter.add("add_to_cart", cartAddOk, `status=${cartAddRes.status}`);
  if (!cartAddOk) {
    await client.request("/api/cart", { method: "DELETE" });
    console.log(JSON.stringify(createSummary(reporter.checks, context), null, 2));
    process.exit(1);
  }

  const cartItems = cartAddData.items;
  const cartLine = cartItems.find((item) => item.id === targetProduct.id);
  const cartLineOk = Boolean(cartLine);
  reporter.add("cart_line_found", cartLineOk);
  if (!cartLineOk) {
    await client.request("/api/cart", { method: "DELETE" });
    console.log(JSON.stringify(createSummary(reporter.checks, context), null, 2));
    process.exit(1);
  }

  const localClampOk =
    targetProduct.type !== "LOCAL" ||
    Number(cartLine.quantity) <= Number(targetProduct.stockQuantity ?? 0);
  reporter.add(
    "local_stock_clamp",
    localClampOk,
    `requested=${requestedQty} actual=${cartLine.quantity}`
  );

  context.cart = {
    requestedQty,
    actualQty: cartLine.quantity,
    localClampOk,
  };

  const cleanupState = {
    orderIds: [],
    messageId: null,
  };

  if (options.mode === "full") {
    const orderPayload = {
      userId: loggedIn.profile.id,
      email: loggedIn.profile.email,
      name: loggedIn.profile.name ?? "QA User",
      phone: loggedIn.profile.phone ?? "770000000",
      shippingAddress: "QA Address",
      shippingCity: "Dakar",
      feesCents: 0,
      paymentMethod: "WAVE",
      items: cartItems.map((item) => ({
        productId: item.id,
        quantity: item.quantity,
        type: item.type,
        optionColor: item.optionColor,
        optionSize: item.optionSize,
        offerId: item.offerId,
      })),
    };

    const { response: orderRes, data: orderData } = await client.json("/api/orders", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(orderPayload),
    });

    const orderCreatedOk = Boolean(orderRes.ok && orderData);
    reporter.add("create_order", orderCreatedOk, `status=${orderRes.status}`);

    const orderIds = orderCreatedOk
      ? Array.from(
          new Set(
            [
              orderData.id,
              ...(Array.isArray(orderData.orderIds) ? orderData.orderIds : []),
              ...((orderData.orders ?? []).map((order) => order.id)),
            ].filter(Boolean)
          )
        )
      : [];

    cleanupState.orderIds = orderIds;

    const orderIdsOk = orderIds.length > 0;
    reporter.add("order_ids_resolved", orderIdsOk, orderIds.join(", "));

    if (orderIdsOk) {
      const { response: payRes, data: payData } = await client.json("/api/payments/mock", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ orderIds }),
      });
      const mockPaymentDisabled =
        payRes.status === 403 &&
        typeof payData?.error === "string" &&
        payData.error.toLowerCase().includes("mock payments are disabled");
      const mockPaymentOk = payRes.ok || (!options.expectMockPayment && mockPaymentDisabled);
      reporter.add(
        "mock_payment",
        mockPaymentOk,
        mockPaymentDisabled ? `skipped - ${payData.error}` : `status=${payRes.status}`
      );

      const { response: ordersRes, data: ordersData } = await client.json("/api/orders?take=50");
      const hasOrders = ordersRes.ok && Array.isArray(ordersData);
      reporter.add("orders_api", hasOrders, `status=${ordersRes.status}`);

      if (hasOrders) {
        const createdOrders = ordersData.filter((order) => orderIds.includes(order.id));
        const finalStatusesOk = mockPaymentDisabled
          ? createdOrders.length === orderIds.length &&
            createdOrders.every(
              (order) => order.status === "PENDING" && order.paymentStatus === "PENDING"
            )
          : createdOrders.length === orderIds.length &&
            createdOrders.every(
              (order) => order.status === "CONFIRMED" && order.paymentStatus === "PAID"
            );
        reporter.add(
          "order_final_status",
          finalStatusesOk,
          mockPaymentDisabled ? "mock disabled, pending state preserved" : ""
        );
        context.order = {
          orderIds,
          foundInOrdersApi: createdOrders.length === orderIds.length,
          mockPaymentDisabled,
          finalStatuses: createdOrders.map((order) => ({
            id: order.id,
            status: order.status,
            paymentStatus: order.paymentStatus,
          })),
        };
      }
    }
  }

  const { response: blockedMsgRes, data: blockedMsgData } = await client.json(
    `/api/products/${targetProduct.id}/inquiry/messages`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ message: "Contact me on https://example.com" }),
    }
  );
  const blockedMessageOk = blockedMsgRes.status === 400;
  reporter.add("message_policy_block_link", blockedMessageOk, `status=${blockedMsgRes.status}`);

  let allowedMessageOk = true;
  if (options.mode === "full") {
    const { response: allowedRes, data: allowedData } = await client.json(
      `/api/products/${targetProduct.id}/inquiry/messages`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          message: `QA smoke message ${new Date().toISOString()}`,
        }),
      }
    );
    allowedMessageOk = allowedRes.status === 201 && Boolean(allowedData?.id);
    reporter.add("message_policy_allow_plain_text", allowedMessageOk, `status=${allowedRes.status}`);
    cleanupState.messageId = allowedData?.id ?? null;
  }

  context.messaging = {
    blockedLinkStatus: blockedMsgRes.status,
    blockedLinkError: blockedMsgData?.error ?? null,
    plainTextCreated: options.mode === "full" ? allowedMessageOk : null,
  };

  await client.request("/api/cart", { method: "DELETE" });

  let cleanupResult = null;
  if (options.mode === "full" && options.cleanup !== "off") {
    const prisma = createPrismaFromEnv();
    if (!prisma) {
      cleanupResult = {
        ok: false,
        reason: "DATABASE_URL missing; cleanup skipped",
      };
      reporter.add("cleanup", false, cleanupResult.reason);
    } else {
      try {
        const removedOrders = [];
        for (const orderId of cleanupState.orderIds) {
          removedOrders.push(await cleanupOrder(prisma, orderId));
        }

        let removedMessage = 0;
        if (cleanupState.messageId) {
          removedMessage = (
            await prisma.productInquiryMessage.deleteMany({
              where: { id: cleanupState.messageId },
            })
          ).count;
        }

        cleanupResult = {
          ok: true,
          removedOrders,
          removedMessage,
        };
        reporter.add("cleanup", true);
      } catch (error) {
        cleanupResult = {
          ok: false,
          reason: error instanceof Error ? error.message : "cleanup failed",
        };
        reporter.add("cleanup", false, cleanupResult.reason);
      } finally {
        await prisma.$disconnect();
      }
    }
  }

  context.cleanup = cleanupResult;
  const summary = createSummary(reporter.checks, context);
  console.log("\n=== QA Smoke Summary ===");
  console.log(JSON.stringify(summary, null, 2));

  if (!summary.ok) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("[qa-smoke] Unexpected failure:", error);
  process.exit(1);
});

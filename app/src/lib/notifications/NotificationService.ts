import { randomUUID } from "crypto";
import { EmailOutboxStatus, NotificationKind, Prisma, type NotificationPreference } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { EmailProvider } from "@/lib/notifications/providers/EmailProvider";
import { ConsoleProvider } from "@/lib/notifications/providers/ConsoleProvider";
import { ResendProvider } from "@/lib/notifications/providers/ResendProvider";
import {
  renderNotificationTemplate,
  type NotificationTemplatePayload,
  type NotificationTemplateRender,
} from "@/lib/notifications/templates/registry";
import { buildUnsubscribeUrl, type UnsubscribeScope } from "@/lib/notifications/unsubscribe";

const LOCK_TIMEOUT_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;

type QueueEmailInput = {
  userId?: string | null;
  toEmail?: string | null;
  kind: NotificationKind;
  templateKey: string;
  payload: NotificationTemplatePayload;
  dedupeKey: string;
  scheduledAt?: Date;
};

type QueueEmailResult = {
  queued: boolean;
  duplicate?: boolean;
  skipped?: boolean;
  reason?: string;
  outboxId?: string;
};

type SendBatchResult = {
  processed: number;
  sent: number;
  failed: number;
  skipped: number;
};

let cachedProvider: EmailProvider | null = null;

function getProvider(): EmailProvider {
  if (cachedProvider) return cachedProvider;

  const provider = String(process.env.EMAIL_PROVIDER ?? "").trim().toLowerCase();
  const resendApiKey = String(process.env.RESEND_API_KEY ?? "").trim();
  const resendFrom = String(process.env.RESEND_FROM_EMAIL ?? "").trim();

  if ((provider === "resend" || (!provider && resendApiKey && resendFrom)) && resendApiKey && resendFrom) {
    cachedProvider = new ResendProvider({
      apiKey: resendApiKey,
      fromEmail: resendFrom,
      apiUrl: process.env.RESEND_API_URL,
    });
    return cachedProvider;
  }

  cachedProvider = new ConsoleProvider();
  return cachedProvider;
}

function normalizePayload(payload: NotificationTemplatePayload): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(payload)) as Prisma.InputJsonValue;
}

function isP2002(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

function getMarketingScope(templateKey: string): UnsubscribeScope {
  const normalized = templateKey.trim().toLowerCase();
  if (normalized === "price_drop") return "price_drop";
  if (normalized === "deals_digest") return "deals";
  return "marketing";
}

type ResolvedRecipient = {
  toEmail: string;
  preference: NotificationPreference | null;
};

async function resolveRecipient(input: QueueEmailInput): Promise<ResolvedRecipient | null> {
  if (input.userId) {
    const user = await prisma.user.findUnique({
      where: { id: input.userId },
      select: {
        email: true,
        notificationPreference: true,
      },
    });

    if (!user?.email) return null;

    return {
      toEmail: input.toEmail?.trim() || user.email,
      preference: user.notificationPreference,
    };
  }

  const email = input.toEmail?.trim();
  if (!email) return null;

  return {
    toEmail: email,
    preference: null,
  };
}

function isAllowedByPreference(params: {
  kind: NotificationKind;
  templateKey: string;
  preference: NotificationPreference | null;
}) {
  const { kind, templateKey, preference } = params;

  if (kind === "TRANSACTIONAL") {
    if (!preference) return true;
    return preference.transactionalEmailEnabled;
  }

  if (!preference) return false;
  if (!preference.marketingEmailEnabled) return false;

  const normalizedTemplate = templateKey.trim().toLowerCase();
  if (normalizedTemplate === "price_drop") {
    return preference.priceDropEmailEnabled;
  }
  if (normalizedTemplate === "deals_digest") {
    return preference.dealsEmailEnabled;
  }

  return true;
}

async function releaseStaleLocks(now: Date) {
  const staleBefore = new Date(now.getTime() - LOCK_TIMEOUT_MS);
  await prisma.emailOutbox.updateMany({
    where: {
      status: EmailOutboxStatus.PENDING,
      lockId: { not: null },
      lockedAt: { lt: staleBefore },
    },
    data: {
      lockId: null,
      lockedAt: null,
    },
  });
}

async function lockPendingRows(limit: number, now: Date, lockId: string) {
  const candidates = await prisma.emailOutbox.findMany({
    where: {
      status: EmailOutboxStatus.PENDING,
      scheduledAt: { lte: now },
      lockId: null,
    },
    select: { id: true },
    orderBy: [{ scheduledAt: "asc" }, { createdAt: "asc" }],
    take: limit,
  });

  if (candidates.length === 0) return [] as Array<{
    id: string;
    toEmail: string;
    userId: string | null;
    kind: NotificationKind;
    templateKey: string;
    payloadJson: Prisma.JsonValue;
    attempts: number;
  }>;

  const ids = candidates.map((row) => row.id);

  await prisma.emailOutbox.updateMany({
    where: {
      id: { in: ids },
      status: EmailOutboxStatus.PENDING,
      lockId: null,
    },
    data: {
      lockId,
      lockedAt: now,
    },
  });

  return prisma.emailOutbox.findMany({
    where: {
      id: { in: ids },
      lockId,
    },
    select: {
      id: true,
      toEmail: true,
      userId: true,
      kind: true,
      templateKey: true,
      payloadJson: true,
      attempts: true,
    },
    orderBy: [{ createdAt: "asc" }],
  });
}

function getRetryDelayMs(nextAttempt: number) {
  return Math.min(nextAttempt * 5 * 60 * 1000, 60 * 60 * 1000);
}

function safePayloadFromJson(value: Prisma.JsonValue): NotificationTemplatePayload {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return value as NotificationTemplatePayload;
}

async function markCancelledAsPreferenceDisabled(id: string, lockId: string, now: Date) {
  await prisma.emailOutbox.updateMany({
    where: { id, lockId },
    data: {
      status: EmailOutboxStatus.CANCELLED,
      attempts: { increment: 1 },
      lastError: "PREFERENCE_DISABLED",
      lockId: null,
      lockedAt: null,
      updatedAt: now,
    },
  });
}

async function processOutboxRow(params: {
  row: {
    id: string;
    toEmail: string;
    userId: string | null;
    kind: NotificationKind;
    templateKey: string;
    payloadJson: Prisma.JsonValue;
    attempts: number;
  };
  lockId: string;
  now: Date;
  provider: EmailProvider;
}): Promise<"sent" | "failed" | "skipped"> {
  const { row, lockId, now, provider } = params;

  let preference: NotificationPreference | null = null;
  if (row.userId) {
    const user = await prisma.user.findUnique({
      where: { id: row.userId },
      select: {
        notificationPreference: true,
      },
    });
    preference = user?.notificationPreference ?? null;
  }

  const allowed = isAllowedByPreference({
    kind: row.kind,
    templateKey: row.templateKey,
    preference,
  });

  if (!allowed) {
    await markCancelledAsPreferenceDisabled(row.id, lockId, now);
    return "skipped";
  }

  const payload = safePayloadFromJson(row.payloadJson);
  const rendered = renderNotificationTemplate(row.templateKey, payload);

  try {
    const sendResult = await provider.send({
      outboxId: row.id,
      toEmail: row.toEmail,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
    });

    await prisma.emailOutbox.updateMany({
      where: {
        id: row.id,
        lockId,
      },
      data: {
        status: EmailOutboxStatus.SENT,
        providerMessageId: sendResult.providerMessageId ?? null,
        sentAt: now,
        attempts: { increment: 1 },
        lastError: null,
        lockId: null,
        lockedAt: null,
        updatedAt: now,
      },
    });

    return "sent";
  } catch (error) {
    const nextAttempt = row.attempts + 1;
    const terminalFailure = nextAttempt >= MAX_ATTEMPTS;
    const nextScheduledAt = new Date(now.getTime() + getRetryDelayMs(nextAttempt));

    await prisma.emailOutbox.updateMany({
      where: {
        id: row.id,
        lockId,
      },
      data: {
        status: terminalFailure ? EmailOutboxStatus.FAILED : EmailOutboxStatus.PENDING,
        attempts: nextAttempt,
        lastError: error instanceof Error ? error.message.slice(0, 400) : "SEND_FAILED",
        scheduledAt: terminalFailure ? now : nextScheduledAt,
        lockId: null,
        lockedAt: null,
        updatedAt: now,
      },
    });

    return "failed";
  }
}

async function queueEmail(input: QueueEmailInput): Promise<QueueEmailResult> {
  const dedupeKey = input.dedupeKey.trim();
  if (!dedupeKey) {
    return { queued: false, skipped: true, reason: "MISSING_DEDUPE_KEY" };
  }

  const recipient = await resolveRecipient(input);
  if (!recipient?.toEmail) {
    return { queued: false, skipped: true, reason: "NO_RECIPIENT" };
  }

  if (!isAllowedByPreference({ kind: input.kind, templateKey: input.templateKey, preference: recipient.preference })) {
    return { queued: false, skipped: true, reason: "PREFERENCE_DISABLED" };
  }

  const payload: NotificationTemplatePayload = { ...(input.payload ?? {}) };

  if (input.kind === "MARKETING" && input.userId) {
    const scope = getMarketingScope(input.templateKey);
    payload.unsubscribeUrl = buildUnsubscribeUrl(input.userId, scope);
  }

  try {
    const row = await prisma.emailOutbox.create({
      data: {
        toEmail: recipient.toEmail,
        userId: input.userId ?? null,
        kind: input.kind,
        templateKey: input.templateKey,
        payloadJson: normalizePayload(payload),
        dedupeKey,
        status: EmailOutboxStatus.PENDING,
        scheduledAt: input.scheduledAt ?? new Date(),
      },
      select: { id: true },
    });

    return {
      queued: true,
      outboxId: row.id,
    };
  } catch (error) {
    if (isP2002(error)) {
      return { queued: false, duplicate: true, reason: "DUPLICATE_DEDUPE_KEY" };
    }
    throw error;
  }
}

async function sendPendingBatch(params: { limit?: number } = {}): Promise<SendBatchResult> {
  const now = new Date();
  const limit = Math.min(Math.max(params.limit ?? 50, 1), 200);
  const lockId = randomUUID();
  const provider = getProvider();

  await releaseStaleLocks(now);
  const rows = await lockPendingRows(limit, now, lockId);

  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const row of rows) {
    const outcome = await processOutboxRow({ row, lockId, now: new Date(), provider });
    if (outcome === "sent") sent += 1;
    if (outcome === "failed") failed += 1;
    if (outcome === "skipped") skipped += 1;
  }

  return {
    processed: rows.length,
    sent,
    failed,
    skipped,
  };
}

function resolveOrderLink(orderId: string) {
  const base = process.env.PUBLIC_APP_ORIGIN || process.env.BASE_URL || process.env.NEXTAUTH_URL || "";
  if (!base) return `/orders/${orderId}`;
  return new URL(`/orders/${orderId}`, base).toString();
}

async function queueOrderPaidEmail(orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      userId: true,
      user: {
        select: {
          email: true,
        },
      },
    },
  });

  if (!order?.userId) {
    return { queued: false, skipped: true, reason: "ORDER_NOT_FOUND" };
  }

  return queueEmail({
    userId: order.userId,
    toEmail: order.user?.email ?? null,
    kind: NotificationKind.TRANSACTIONAL,
    templateKey: "order_paid",
    payload: {
      orderId: order.id,
      link: resolveOrderLink(order.id),
    },
    dedupeKey: `order_paid:${order.id}`,
  });
}

async function queueDeliveryUpdateEmail(params: {
  orderId: string;
  trackingStep: string;
  eta?: string | null;
  link?: string | null;
}) {
  const order = await prisma.order.findUnique({
    where: { id: params.orderId },
    select: {
      id: true,
      userId: true,
      user: { select: { email: true } },
    },
  });

  if (!order?.userId) {
    return { queued: false, skipped: true, reason: "ORDER_NOT_FOUND" };
  }

  const link = params.link || resolveOrderLink(order.id);

  return queueEmail({
    userId: order.userId,
    toEmail: order.user?.email ?? null,
    kind: NotificationKind.TRANSACTIONAL,
    templateKey: "delivery_update",
    payload: {
      orderId: order.id,
      trackingStep: params.trackingStep,
      eta: params.eta ?? "",
      link,
    },
    dedupeKey: `delivery_update:${order.id}:${params.trackingStep}`,
  });
}

async function schedulePaymentReminders(params: { hours?: number; limit?: number } = {}) {
  const hours = Math.max(params.hours ?? 24, 1);
  const limit = Math.min(Math.max(params.limit ?? 100, 1), 500);
  const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);

  const orders = await prisma.order.findMany({
    where: {
      paymentStatus: "PENDING",
      paymentMethod: { not: "CASH" },
      status: { in: ["PENDING", "CONFIRMED", "FULFILLING", "SHIPPED"] },
      createdAt: { lte: cutoff },
    },
    orderBy: [{ createdAt: "asc" }],
    take: limit,
    select: {
      id: true,
      userId: true,
      user: { select: { email: true } },
    },
  });

  let queued = 0;

  for (const order of orders) {
    const result = await queueEmail({
      userId: order.userId,
      toEmail: order.user?.email ?? null,
      kind: NotificationKind.TRANSACTIONAL,
      templateKey: "payment_reminder",
      payload: {
        orderId: order.id,
        link: resolveOrderLink(order.id),
      },
      dedupeKey: `payment_reminder:${order.id}:t${hours}h`,
    });

    if (result.queued) queued += 1;
  }

  return { scanned: orders.length, queued };
}

function isoWeekKey(date: Date) {
  const utcDate = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNum = utcDate.getUTCDay() || 7;
  utcDate.setUTCDate(utcDate.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(utcDate.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((utcDate.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${utcDate.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

async function scheduleDealsDigestEmails(params: { userLimit?: number; dealsLimit?: number } = {}) {
  const userLimit = Math.min(Math.max(params.userLimit ?? 200, 1), 1000);
  const dealsLimit = Math.min(Math.max(params.dealsLimit ?? 8, 1), 20);
  const weekKey = isoWeekKey(new Date());

  const [preferences, topDeals] = await Promise.all([
    prisma.notificationPreference.findMany({
      where: {
        marketingEmailEnabled: true,
        dealsEmailEnabled: true,
      },
      orderBy: [{ updatedAt: "desc" }],
      take: userLimit,
      select: {
        userId: true,
        user: { select: { email: true } },
      },
    }),
    prisma.product.findMany({
      where: {
        isActive: true,
        discountPercent: { gt: 0 },
      },
      orderBy: [{ updatedAt: "desc" }],
      take: dealsLimit,
      select: {
        id: true,
        title: true,
        slug: true,
        priceCents: true,
        currency: true,
        discountPercent: true,
      },
    }),
  ]);

  if (topDeals.length === 0) {
    return { scanned: preferences.length, queued: 0 };
  }

  const dealsPayload = topDeals.map((deal) => {
    const oldPriceRaw = Math.round(deal.priceCents / (1 - (deal.discountPercent ?? 0) / 100));
    const oldPriceCents = Number.isFinite(oldPriceRaw) ? oldPriceRaw : deal.priceCents;
    return {
      title: deal.title,
      price: `${deal.priceCents} ${deal.currency}`,
      oldPrice: `${oldPriceCents} ${deal.currency}`,
      url: resolveProductLink(deal.slug),
    };
  });

  let queued = 0;

  for (const preference of preferences) {
    const result = await queueEmail({
      userId: preference.userId,
      toEmail: preference.user?.email ?? null,
      kind: NotificationKind.MARKETING,
      templateKey: "deals_digest",
      payload: {
        deals: dealsPayload,
      },
      dedupeKey: `deals_digest:${preference.userId}:${weekKey}`,
    });

    if (result.queued) queued += 1;
  }

  return { scanned: preferences.length, queued };
}

function resolveProductLink(slug: string) {
  const base = process.env.PUBLIC_APP_ORIGIN || process.env.BASE_URL || process.env.NEXTAUTH_URL || "";
  if (!base) return `/shop/${slug}`;
  return new URL(`/shop/${slug}`, base).toString();
}

async function queueContactAckEmail(params: {
  userId: string;
  contextLabel: string;
  dedupeKey: string;
}) {
  const user = await prisma.user.findUnique({
    where: { id: params.userId },
    select: {
      email: true,
      notificationPreference: {
        select: {
          messageAutoEnabled: true,
        },
      },
    },
  });

  if (!user?.email) {
    return { queued: false, skipped: true, reason: "USER_NOT_FOUND" };
  }

  if (user.notificationPreference && !user.notificationPreference.messageAutoEnabled) {
    return { queued: false, skipped: true, reason: "MESSAGE_AUTO_DISABLED" };
  }

  return queueEmail({
    userId: params.userId,
    toEmail: user.email,
    kind: NotificationKind.TRANSACTIONAL,
    templateKey: "contact_ack",
    payload: {
      contextLabel: params.contextLabel,
    },
    dedupeKey: params.dedupeKey,
  });
}

async function queuePriceDropEmails(params: {
  productId: string;
  oldPriceCents: number;
  newPriceCents: number;
}) {
  if (!params.productId) return { scanned: 0, queued: 0 };
  if (!Number.isFinite(params.oldPriceCents) || !Number.isFinite(params.newPriceCents)) {
    return { scanned: 0, queued: 0 };
  }
  if (params.newPriceCents >= params.oldPriceCents) {
    return { scanned: 0, queued: 0 };
  }

  const product = await prisma.product.findUnique({
    where: { id: params.productId },
    select: {
      id: true,
      title: true,
      slug: true,
      currency: true,
      favorites: {
        select: {
          userId: true,
          user: {
            select: {
              email: true,
            },
          },
        },
        take: 500,
      },
    },
  });

  if (!product) {
    return { scanned: 0, queued: 0 };
  }

  let queued = 0;

  for (const favorite of product.favorites) {
    const result = await queueEmail({
      userId: favorite.userId,
      toEmail: favorite.user?.email ?? null,
      kind: NotificationKind.MARKETING,
      templateKey: "price_drop",
      payload: {
        productTitle: product.title,
        oldPrice: `${params.oldPriceCents} ${product.currency}`,
        newPrice: `${params.newPriceCents} ${product.currency}`,
        link: resolveProductLink(product.slug),
      },
      dedupeKey: `price_drop:${product.id}:${params.newPriceCents}:${favorite.userId}`,
    });

    if (result.queued) queued += 1;
  }

  return {
    scanned: product.favorites.length,
    queued,
  };
}

export const NotificationService = {
  queueEmail,
  sendPendingBatch,
  renderTemplate: (templateKey: string, payload: NotificationTemplatePayload): NotificationTemplateRender =>
    renderNotificationTemplate(templateKey, payload),
  queueOrderPaidEmail,
  queueDeliveryUpdateEmail,
  schedulePaymentReminders,
  scheduleDealsDigestEmails,
  queuePriceDropEmails,
  queueContactAckEmail,
};

export type { QueueEmailInput, QueueEmailResult, SendBatchResult };

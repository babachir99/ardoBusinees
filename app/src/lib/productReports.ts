import { NotificationKind, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { NotificationService } from "@/lib/notifications/NotificationService";
import { PRODUCT_REPORT_AUTO_HIDE_THRESHOLD } from "@/lib/productReports.shared";

export const PRODUCT_REPORT_ACTION = "PRODUCT_REPORT_SUBMITTED";
export const PRODUCT_REPORT_ENTITY_TYPE = "PRODUCT";
export const PRODUCT_REPORT_ADMIN_ALERT_ACTION = "ADMIN_PRODUCT_REPORT_SUBMITTED";
export const PRODUCT_REPORT_SELLER_ALERT_ACTION = "SELLER_PRODUCT_AUTO_HIDDEN";
export const PRODUCT_REPORT_STATUSES = [
  "PENDING",
  "UNDER_REVIEW",
  "RESOLVED",
  "DISMISSED",
] as const;
export const PRODUCT_REPORT_REASONS = [
  "SCAM",
  "MISLEADING",
  "PROHIBITED",
  "DUPLICATE",
  "ABUSE",
  "OTHER",
] as const;

export type ProductReportStatus = (typeof PRODUCT_REPORT_STATUSES)[number];
export type ProductReportReason = (typeof PRODUCT_REPORT_REASONS)[number];

type ProductReportMetadata = {
  reason: ProductReportReason;
  description: string | null;
  status: ProductReportStatus;
  reviewedAt?: string | null;
  reviewedBy?: string | null;
  adminNote?: string | null;
  autoHiddenAt?: string | null;
};

export type ProductReportListItem = {
  id: string;
  productId: string;
  createdAt: string;
  reporter: {
    id: string;
    name: string | null;
    email: string | null;
  };
  product: {
    id: string;
    slug: string;
    title: string;
    imageUrl: string | null;
    sellerName: string | null;
    isActive: boolean;
    activeReportCount: number;
    autoHiddenByReports: boolean;
    autoHiddenAt: string | null;
  } | null;
  reason: ProductReportReason;
  description: string | null;
  status: ProductReportStatus;
  reviewedAt: string | null;
  reviewedBy: string | null;
  adminNote: string | null;
};

export type ProductReportCounts = {
  total: number;
  pending: number;
};

function normalizeReason(value: unknown): ProductReportReason {
  if (
    typeof value === "string" &&
    PRODUCT_REPORT_REASONS.includes(value as ProductReportReason)
  ) {
    return value as ProductReportReason;
  }

  return "OTHER";
}

export function normalizeProductReportStatus(value: unknown): ProductReportStatus {
  if (
    typeof value === "string" &&
    PRODUCT_REPORT_STATUSES.includes(value as ProductReportStatus)
  ) {
    return value as ProductReportStatus;
  }

  return "PENDING";
}

function readMetadata(raw: unknown): ProductReportMetadata {
  const source =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};

  return {
    reason: normalizeReason(source.reason),
    description:
      typeof source.description === "string" && source.description.trim().length > 0
        ? source.description.trim()
        : null,
    status: normalizeProductReportStatus(source.status),
    reviewedAt:
      typeof source.reviewedAt === "string" && source.reviewedAt.trim().length > 0
        ? source.reviewedAt
        : null,
    reviewedBy:
      typeof source.reviewedBy === "string" && source.reviewedBy.trim().length > 0
        ? source.reviewedBy
        : null,
    adminNote:
      typeof source.adminNote === "string" && source.adminNote.trim().length > 0
        ? source.adminNote.trim()
        : null,
    autoHiddenAt:
      typeof source.autoHiddenAt === "string" && source.autoHiddenAt.trim().length > 0
        ? source.autoHiddenAt
        : null,
  };
}

function isActiveReportStatus(status: ProductReportStatus) {
  return status === "PENDING" || status === "UNDER_REVIEW";
}

function countActiveProductReports(rows: Array<{ metadata: unknown }>) {
  return rows.reduce((count, row) => {
    return isActiveReportStatus(readMetadata(row.metadata).status) ? count + 1 : count;
  }, 0);
}

export async function getActiveProductReportCount(productId: string) {
  const rows = await prisma.activityLog.findMany({
    where: {
      action: PRODUCT_REPORT_ACTION,
      entityType: PRODUCT_REPORT_ENTITY_TYPE,
      entityId: productId,
    },
    select: {
      metadata: true,
    },
  });

  return countActiveProductReports(rows);
}

function getReasonLabel(locale: string, reason: ProductReportReason) {
  const isFr = locale.toLowerCase().startsWith("fr");
  const labels: Record<ProductReportReason, { fr: string; en: string }> = {
    SCAM: { fr: "Arnaque", en: "Scam" },
    MISLEADING: { fr: "Annonce trompeuse", en: "Misleading listing" },
    PROHIBITED: { fr: "Produit interdit", en: "Prohibited product" },
    DUPLICATE: { fr: "Doublon", en: "Duplicate" },
    ABUSE: { fr: "Contenu abusif", en: "Abusive content" },
    OTHER: { fr: "Autre", en: "Other" },
  };

  return labels[reason][isFr ? "fr" : "en"];
}

function resolveAdminProductsLink(locale: string) {
  const normalizedLocale = locale.toLowerCase().startsWith("fr") ? "fr" : "en";
  const path = `/${normalizedLocale}/admin/products`;
  const base = process.env.PUBLIC_APP_ORIGIN || process.env.BASE_URL || process.env.NEXTAUTH_URL || "";
  if (!base) return path;
  return new URL(path, base).toString();
}

function resolveSellerProductsLink(locale: string) {
  const normalizedLocale = locale.toLowerCase().startsWith("fr") ? "fr" : "en";
  const path = `/${normalizedLocale}/seller`;
  const base = process.env.PUBLIC_APP_ORIGIN || process.env.BASE_URL || process.env.NEXTAUTH_URL || "";
  if (!base) return path;
  return new URL(path, base).toString();
}

async function notifyAdminsAboutProductReport(input: {
  reportId: string;
  productId: string;
  productTitle: string;
  reason: ProductReportReason;
  activeReportCount: number;
  autoHiddenProduct: boolean;
}) {
  const admins = await prisma.user.findMany({
    where: { role: "ADMIN" },
    select: { id: true, email: true, locale: true },
    take: 20,
  });

  if (admins.length === 0) return;

  await Promise.allSettled(
    admins.map((admin) => {
      const locale = admin.locale || "fr";
      return NotificationService.queueEmail({
        userId: admin.id,
        toEmail: admin.email ?? null,
        kind: NotificationKind.TRANSACTIONAL,
        templateKey: "product_report_submitted",
        payload: {
          productTitle: input.productTitle,
          reasonLabel: getReasonLabel(locale, input.reason),
          activeReportCount: input.activeReportCount,
          autoHiddenLine: input.autoHiddenProduct
            ? locale.toLowerCase().startsWith("fr")
              ? `L'annonce a ete masquee automatiquement apres ${PRODUCT_REPORT_AUTO_HIDE_THRESHOLD} signalements actifs.`
              : `The listing was automatically hidden after ${PRODUCT_REPORT_AUTO_HIDE_THRESHOLD} active reports.`
            : "",
          link: resolveAdminProductsLink(locale),
        },
        dedupeKey: `product_report_submitted:${input.reportId}:${admin.id}`,
      });
    })
  );
}

async function createAdminProductReportNotifications(input: {
  reportId: string;
  productId: string;
  productTitle: string;
  reason: ProductReportReason;
  activeReportCount: number;
  autoHiddenProduct: boolean;
}) {
  const admins = await prisma.user.findMany({
    where: { role: "ADMIN" },
    select: { id: true },
    take: 20,
  });

  if (admins.length === 0) return;

  await prisma.activityLog.createMany({
    data: admins.map((admin) => ({
      userId: admin.id,
      action: PRODUCT_REPORT_ADMIN_ALERT_ACTION,
      entityType: PRODUCT_REPORT_ENTITY_TYPE,
      entityId: input.productId,
      metadata: {
        reportId: input.reportId,
        productId: input.productId,
        productTitle: input.productTitle,
        reason: input.reason,
        activeReportCount: input.activeReportCount,
        autoHiddenProduct: input.autoHiddenProduct,
      } as Prisma.InputJsonValue,
    })),
  });
}

async function notifySellerAboutAutoHiddenListing(input: {
  productId: string;
  productTitle: string;
  sellerUserId: string | null;
  sellerEmail: string | null;
  sellerLocale: string;
  activeReportCount: number;
}) {
  if (!input.sellerUserId) return;

  const sellerLink = resolveSellerProductsLink(input.sellerLocale);

  await Promise.allSettled([
    prisma.activityLog.create({
      data: {
        userId: input.sellerUserId,
        action: PRODUCT_REPORT_SELLER_ALERT_ACTION,
        entityType: PRODUCT_REPORT_ENTITY_TYPE,
        entityId: input.productId,
        metadata: {
          productId: input.productId,
          productTitle: input.productTitle,
          activeReportCount: input.activeReportCount,
          reason: "AUTO_HIDDEN_AFTER_REPORTS",
        } as Prisma.InputJsonValue,
      },
    }),
    NotificationService.queueEmail({
      userId: input.sellerUserId,
      toEmail: input.sellerEmail,
      kind: NotificationKind.TRANSACTIONAL,
      templateKey: "product_listing_auto_hidden",
      payload: {
        productTitle: input.productTitle,
        activeReportCount: input.activeReportCount,
        link: sellerLink,
      },
      dedupeKey: `product_listing_auto_hidden:${input.productId}:${input.sellerUserId}`,
    }),
  ]);
}

export async function createProductReport(input: {
  userId: string;
  productId: string;
  reason: ProductReportReason;
  description?: string | null;
}) {
  const product = await prisma.product.findUnique({
    where: { id: input.productId },
    select: {
      id: true,
      title: true,
      seller: {
        select: {
          userId: true,
          user: {
            select: {
              email: true,
              locale: true,
            },
          },
        },
      },
    },
  });

  if (!product) {
    return { ok: false as const, code: "PRODUCT_NOT_FOUND" };
  }

  if (product.seller?.userId === input.userId) {
    return { ok: false as const, code: "SELF_REPORT_BLOCKED" };
  }

  const latestExisting = await prisma.activityLog.findFirst({
    where: {
      userId: input.userId,
      action: PRODUCT_REPORT_ACTION,
      entityType: PRODUCT_REPORT_ENTITY_TYPE,
      entityId: input.productId,
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      metadata: true,
    },
  });

  if (latestExisting) {
    const existingStatus = readMetadata(latestExisting.metadata).status;
    if (existingStatus === "PENDING" || existingStatus === "UNDER_REVIEW") {
      return { ok: false as const, code: "DUPLICATE_ACTIVE_REPORT" };
    }
  }

  const outcome = await prisma.$transaction(async (tx) => {
    const baseMetadata: ProductReportMetadata = {
      reason: input.reason,
      description: input.description?.trim() || null,
      status: "PENDING",
      reviewedAt: null,
      reviewedBy: null,
      adminNote: null,
      autoHiddenAt: null,
    };

    const report = await tx.activityLog.create({
      data: {
        userId: input.userId,
        action: PRODUCT_REPORT_ACTION,
        entityType: PRODUCT_REPORT_ENTITY_TYPE,
        entityId: input.productId,
        metadata: baseMetadata,
      },
      select: { id: true },
    });

    const productRows = await tx.activityLog.findMany({
      where: {
        action: PRODUCT_REPORT_ACTION,
        entityType: PRODUCT_REPORT_ENTITY_TYPE,
        entityId: input.productId,
      },
      select: { metadata: true },
    });

    const activeReportCount = countActiveProductReports(productRows);
    let autoHiddenProduct = false;

    if (activeReportCount >= PRODUCT_REPORT_AUTO_HIDE_THRESHOLD) {
      const autoHiddenAt = new Date().toISOString();
      const updateResult = await tx.product.updateMany({
        where: { id: input.productId, isActive: true },
        data: { isActive: false },
      });
      autoHiddenProduct = updateResult.count > 0;

      await tx.activityLog.update({
        where: { id: report.id },
        data: {
          metadata: {
            ...baseMetadata,
            autoHiddenAt,
          } satisfies ProductReportMetadata,
        },
      });
    }

    return {
      reportId: report.id,
      activeReportCount,
      autoHiddenProduct,
    };
  });

  await Promise.allSettled([
    notifyAdminsAboutProductReport({
      reportId: outcome.reportId,
      productId: input.productId,
      productTitle: product.title,
      reason: input.reason,
      activeReportCount: outcome.activeReportCount,
      autoHiddenProduct: outcome.autoHiddenProduct,
    }),
    createAdminProductReportNotifications({
      reportId: outcome.reportId,
      productId: input.productId,
      productTitle: product.title,
      reason: input.reason,
      activeReportCount: outcome.activeReportCount,
      autoHiddenProduct: outcome.autoHiddenProduct,
    }),
    outcome.autoHiddenProduct
      ? notifySellerAboutAutoHiddenListing({
          productId: input.productId,
          productTitle: product.title,
          sellerUserId: product.seller?.userId ?? null,
          sellerEmail: product.seller?.user?.email ?? null,
          sellerLocale: product.seller?.user?.locale ?? "fr",
          activeReportCount: outcome.activeReportCount,
        })
      : Promise.resolve(),
  ]);

  return {
    ok: true as const,
    reportId: outcome.reportId,
    activeReportCount: outcome.activeReportCount,
    autoHiddenProduct: outcome.autoHiddenProduct,
  };
}

export async function listProductReports() {
  const rows = await prisma.activityLog.findMany({
    where: {
      action: PRODUCT_REPORT_ACTION,
      entityType: PRODUCT_REPORT_ENTITY_TYPE,
    },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });

  const productIds = Array.from(
    new Set(
      rows
        .map((row) => row.entityId)
        .filter((value): value is string => typeof value === "string" && value.length > 0)
    )
  );

  const products =
    productIds.length > 0
      ? await prisma.product.findMany({
          where: { id: { in: productIds } },
          select: {
            id: true,
            slug: true,
            title: true,
            isActive: true,
            seller: { select: { displayName: true } },
            images: {
              select: { url: true },
              take: 1,
              orderBy: { position: "asc" },
            },
          },
        })
      : [];

  const reportRowsByProduct =
    productIds.length > 0
      ? await prisma.activityLog.findMany({
          where: {
            action: PRODUCT_REPORT_ACTION,
            entityType: PRODUCT_REPORT_ENTITY_TYPE,
            entityId: { in: productIds },
          },
          select: {
            entityId: true,
            metadata: true,
          },
        })
      : [];

  const productById = new Map(products.map((product) => [product.id, product]));
  const activeReportCountByProductId = reportRowsByProduct.reduce<Map<string, number>>((acc, row) => {
    if (!row.entityId) return acc;
    const nextCount = isActiveReportStatus(readMetadata(row.metadata).status)
      ? (acc.get(row.entityId) ?? 0) + 1
      : acc.get(row.entityId) ?? 0;
    acc.set(row.entityId, nextCount);
    return acc;
  }, new Map());
  const autoHiddenAtByProductId = reportRowsByProduct.reduce<Map<string, string | null>>((acc, row) => {
    if (!row.entityId) return acc;
    const autoHiddenAt = readMetadata(row.metadata).autoHiddenAt ?? null;
    if (!autoHiddenAt) {
      if (!acc.has(row.entityId)) acc.set(row.entityId, null);
      return acc;
    }

    const current = acc.get(row.entityId);
    if (!current || new Date(autoHiddenAt).getTime() > new Date(current).getTime()) {
      acc.set(row.entityId, autoHiddenAt);
    }
    return acc;
  }, new Map());

  return rows.map<ProductReportListItem>((row) => {
    const metadata = readMetadata(row.metadata);
    const product = row.entityId ? productById.get(row.entityId) : null;
    const activeReportCount = row.entityId ? activeReportCountByProductId.get(row.entityId) ?? 0 : 0;
    const autoHiddenAt = row.entityId ? autoHiddenAtByProductId.get(row.entityId) ?? null : null;

    return {
      id: row.id,
      productId: row.entityId ?? "",
      createdAt: row.createdAt.toISOString(),
      reporter: {
        id: row.user.id,
        name: row.user.name ?? null,
        email: row.user.email ?? null,
      },
      product: product
        ? {
            id: product.id,
            slug: product.slug,
            title: product.title,
            imageUrl: product.images[0]?.url ?? null,
            sellerName: product.seller?.displayName ?? null,
            isActive: product.isActive,
            activeReportCount,
            autoHiddenByReports:
              !product.isActive && activeReportCount >= PRODUCT_REPORT_AUTO_HIDE_THRESHOLD,
            autoHiddenAt,
          }
        : null,
      reason: metadata.reason,
      description: metadata.description,
      status: metadata.status,
      reviewedAt: metadata.reviewedAt ?? null,
      reviewedBy: metadata.reviewedBy ?? null,
      adminNote: metadata.adminNote ?? null,
    };
  });
}

export async function getProductReportCounts() {
  const rows = await prisma.activityLog.findMany({
    where: {
      action: PRODUCT_REPORT_ACTION,
      entityType: PRODUCT_REPORT_ENTITY_TYPE,
    },
    select: {
      metadata: true,
    },
  });

  return rows.reduce<ProductReportCounts>(
    (acc, row) => {
      const status = readMetadata(row.metadata).status;
      acc.total += 1;
      if (isActiveReportStatus(status)) {
        acc.pending += 1;
      }
      return acc;
    },
    { total: 0, pending: 0 }
  );
}

export async function updateProductReportReview(input: {
  reportId: string;
  adminId: string;
  status?: ProductReportStatus;
  adminNote?: string | null;
}) {
  const existing = await prisma.activityLog.findUnique({
    where: { id: input.reportId },
    select: {
      id: true,
      action: true,
      entityType: true,
      metadata: true,
    },
  });

  if (
    !existing ||
    existing.action !== PRODUCT_REPORT_ACTION ||
    existing.entityType !== PRODUCT_REPORT_ENTITY_TYPE
  ) {
    return null;
  }

  const current = readMetadata(existing.metadata);
  const nextStatus = input.status ?? current.status;
  const nextMetadata: ProductReportMetadata = {
    ...current,
    status: nextStatus,
    adminNote:
      typeof input.adminNote === "string" && input.adminNote.trim().length > 0
        ? input.adminNote.trim()
        : current.adminNote ?? null,
    reviewedAt:
      nextStatus === "PENDING" ? null : new Date().toISOString(),
    reviewedBy: nextStatus === "PENDING" ? null : input.adminId,
  };

  await prisma.activityLog.update({
    where: { id: input.reportId },
    data: {
      metadata: nextMetadata,
    },
  });

  return nextMetadata;
}

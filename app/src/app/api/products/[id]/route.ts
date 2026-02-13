import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/slug";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import type { Prisma } from "@prisma/client";
import {
  deleteProductSafely,
  PRODUCT_DELETE_CONFLICT_MESSAGE,
} from "@/lib/product-delete";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const allowedTypes = new Set(["PREORDER", "DROPSHIP", "LOCAL"]);

function sanitizeStringList(
  value: unknown,
  maxItems = 20,
  maxLength = 64
): string[] {
  if (!Array.isArray(value)) return [];

  return Array.from(
    new Set(
      value
        .map((item) => String(item ?? "").trim())
        .filter((item) => item.length > 0)
        .map((item) => item.slice(0, maxLength))
    )
  ).slice(0, maxItems);
}

function sanitizeAttributes(value: unknown): Prisma.JsonObject | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  const entries = Object.entries(value as Record<string, unknown>)
    .map(([key, raw]) => [String(key).trim().slice(0, 64), String(raw ?? "").trim().slice(0, 256)] as const)
    .filter(([key, val]) => key.length > 0 && val.length > 0)
    .slice(0, 24);

  if (entries.length === 0) return undefined;

  return Object.fromEntries(entries) as Prisma.JsonObject;
}

async function ensureUniqueProductSlug(
  sellerId: string,
  baseSlug: string,
  excludeProductId?: string
) {
  let candidate = baseSlug;
  let suffix = 2;

  while (true) {
    const existing = await prisma.product.findUnique({
      where: { sellerId_slug: { sellerId, slug: candidate } },
      select: { id: true },
    });

    if (!existing || existing.id === excludeProductId) {
      return candidate;
    }

    candidate = `${baseSlug}-${suffix}`;
    suffix += 1;
  }
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const product = await prisma.product.findUnique({
    where: { id: id },
    include: {
      images: true,
      seller: {
        select: { id: true, displayName: true, slug: true },
      },
    },
  });

  if (!product) {
    return NextResponse.json(
      { error: "Not found" },
      { status: 404, headers: { "Cache-Control": "no-store" } }
    );
  }

  return NextResponse.json(product, {
    headers: { "Cache-Control": "no-store" },
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const existing = await prisma.product.findUnique({
    where: { id: id },
    select: { id: true, sellerId: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (session.user.role !== "ADMIN") {
    const seller = await prisma.sellerProfile.findUnique({
      where: { userId: session.user.id },
      select: { id: true },
    });
    if (!seller || seller.id !== existing.sellerId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const body = await request.json().catch(() => null);

  if (!body) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const data: Record<string, unknown> = {};
  const discountRaw = body.discountPercent;
  const requestBoost = body.requestBoost === true;
  const addImageUrls = Array.isArray(body.addImageUrls)
    ? body.addImageUrls.filter(Boolean)
    : [];
  const removeImageIds = Array.isArray(body.removeImageIds)
    ? body.removeImageIds.filter(Boolean)
    : [];
  const replaceImageUrls = Array.isArray(body.imageUrls)
    ? body.imageUrls.filter(Boolean)
    : [];

  if (body.title !== undefined) data.title = String(body.title).trim();

  if (body.slug !== undefined) {
    const baseSlug = slugify(String(body.slug));
    if (!baseSlug) {
      return NextResponse.json({ error: "slug is invalid" }, { status: 400 });
    }
    data.slug = await ensureUniqueProductSlug(existing.sellerId, baseSlug, existing.id);
  }

  if (body.description !== undefined) data.description = body.description;
  if (body.priceCents !== undefined) data.priceCents = Number(body.priceCents);
  if (body.currency) data.currency = String(body.currency);
  if (body.preorderLeadDays !== undefined) {
    data.preorderLeadDays = body.preorderLeadDays;
  }
  if (body.dropshipSupplier !== undefined) {
    data.dropshipSupplier = body.dropshipSupplier;
  }
  if (body.isActive !== undefined) data.isActive = Boolean(body.isActive);
  if (body.type) {
    const type = String(body.type).toUpperCase();
    if (!allowedTypes.has(type)) {
      return NextResponse.json(
        { error: "type must be PREORDER, DROPSHIP, or LOCAL" },
        { status: 400 }
      );
    }
    data.type = type;
  }

  if (body.stockQuantity !== undefined) {
    data.stockQuantity = Number(body.stockQuantity);
  }
  if (body.pickupLocation !== undefined) {
    data.pickupLocation = body.pickupLocation;
  }
  if (body.deliveryOptions !== undefined) {
    data.deliveryOptions = body.deliveryOptions;
  }
  if (body.colorOptions !== undefined) {
    data.colorOptions = sanitizeStringList(body.colorOptions, 20, 40);
  }
  if (body.sizeOptions !== undefined) {
    data.sizeOptions = sanitizeStringList(body.sizeOptions, 20, 32);
  }
  if (body.attributes !== undefined) {
    data.attributes = sanitizeAttributes(body.attributes) ?? null;
  }
  if (body.isActive !== undefined) {
    data.isActive = Boolean(body.isActive);
  }

  if (discountRaw !== undefined) {
    const parsed = Number(discountRaw);
    if (!Number.isFinite(parsed) || parsed < 0 || parsed > 90) {
      return NextResponse.json(
        { error: "discountPercent must be between 0 and 90" },
        { status: 400 }
      );
    }
    data.discountPercent = parsed > 0 ? Math.round(parsed) : null;
  }

  if (requestBoost || body.boostStatus === "PENDING") {
    data.boostStatus = "PENDING";
    data.boostRequestedAt = new Date();
  }

  if (replaceImageUrls.length > 0) {
    data.images = {
      deleteMany: {},
      create: replaceImageUrls.map((url: string, index: number) => ({
        url,
        alt: body.imageAlt ?? body.title ?? undefined,
        position: index,
      })),
    };
  } else if (addImageUrls.length > 0 || removeImageIds.length > 0) {
    const imagesOps: Record<string, unknown> = {};
    if (removeImageIds.length > 0) {
      imagesOps.deleteMany = { id: { in: removeImageIds } };
    }
    if (addImageUrls.length > 0) {
      const count = await prisma.productImage.count({
        where: { productId: existing.id },
      });
      imagesOps.create = addImageUrls.map((url: string, index: number) => ({
        url,
        alt: body.imageAlt ?? body.title ?? undefined,
        position: count + index,
      }));
    }
    data.images = imagesOps;
  }

  const product = await prisma.product.update({
    where: { id: id },
    data,
  });

  return NextResponse.json(product);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getServerSession(authOptions);

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const existing = await prisma.product.findUnique({
    where: { id },
    select: { id: true, sellerId: true },
  });

  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (session.user.role !== "ADMIN") {
    const seller = await prisma.sellerProfile.findUnique({
      where: { userId: session.user.id },
      select: { id: true },
    });

    if (!seller || seller.id !== existing.sellerId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const result = await deleteProductSafely(existing.id);

  if (!result.ok) {
    return NextResponse.json(
      { error: PRODUCT_DELETE_CONFLICT_MESSAGE },
      { status: 409 }
    );
  }

  return NextResponse.json({ ok: true });
}


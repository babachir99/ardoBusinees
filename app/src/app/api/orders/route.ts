import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

const allowedTypes = new Set(["PREORDER", "DROPSHIP", "LOCAL"]);
const allowedPaymentMethods = new Set([
  "WAVE",
  "ORANGE_MONEY",
  "CARD",
  "CASH",
]);

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  const { searchParams } = new URL(request.url);
  const takeParam = Number(searchParams.get("take") ?? "20");
  const take = Number.isFinite(takeParam)
    ? Math.min(Math.max(takeParam, 1), 50)
    : 20;
  const status = searchParams.get("status") ?? undefined;
  const email = searchParams.get("email") ?? undefined;
  const userId = searchParams.get("userId") ?? undefined;

  const where: Record<string, unknown> = {};
  if (status) where.status = status;
  if (email) where.buyerEmail = email;
  if (userId) where.userId = userId;

  const isAdmin = session?.user?.role === "ADMIN";
  const isSeller = session?.user?.role === "SELLER";
  let sellerScopeId: string | undefined;

  if (isSeller && session?.user?.id) {
    const sellerProfile = await prisma.sellerProfile.findUnique({
      where: { userId: session.user.id },
      select: { id: true },
    });
    sellerScopeId = sellerProfile?.id;
  }

  const orders = await prisma.order.findMany({
    take,
    orderBy: { createdAt: "desc" },
    where: isAdmin
      ? Object.keys(where).length > 0
        ? where
        : undefined
      : isSeller
      ? sellerScopeId
        ? { sellerId: sellerScopeId, ...(Object.keys(where).length > 0 ? where : {}) }
        : { sellerId: "__missing__" }
      : session?.user?.id
      ? {
          userId: session.user.id,
          ...(Object.keys(where).length > 0 ? where : {}),
        }
      : undefined,
    include: {
      items: {
        include: {
          product: {
            select: { id: true, title: true, slug: true },
          },
        },
      },
      events: { orderBy: { createdAt: "asc" } },
      user: { select: { id: true, email: true, name: true } },
      seller: { select: { id: true, displayName: true, slug: true } },
    },
  });

  return NextResponse.json(orders);
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);

  if (!body) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  let userId = body.userId ? String(body.userId) : "";
  const sellerId = body.sellerId ? String(body.sellerId) : undefined;
  const currency = body.currency ?? "XOF";
  const paymentMethod = body.paymentMethod
    ? String(body.paymentMethod).toUpperCase()
    : undefined;
  const items = Array.isArray(body.items) ? body.items : [];

  if (!userId && !body.email) {
    return NextResponse.json(
      { error: "userId or email is required" },
      { status: 400 }
    );
  }

  if (items.length === 0) {
    return NextResponse.json(
      { error: "items are required" },
      { status: 400 }
    );
  }

  if (!userId) {
    const email = String(body.email);
    const name = body.name ? String(body.name) : undefined;
    const phone = body.phone ? String(body.phone) : undefined;

    const user = await prisma.user.upsert({
      where: { email },
      update: { name, phone, role: "CUSTOMER" },
      create: { email, name, phone, role: "CUSTOMER" },
    });

    userId = user.id;
  }

  let subtotalCents = 0;
  const mappedItems = [];

  for (const item of items) {
    const quantity = Number(item.quantity ?? 1);
    const unitPriceCents = Number(item.unitPriceCents);
    const type = String(item.type ?? "").toUpperCase();

    if (!allowedTypes.has(type)) {
      return NextResponse.json(
        { error: "Each item needs a valid type" },
        { status: 400 }
      );
    }

    if (!item.productId || !Number.isFinite(unitPriceCents)) {
      return NextResponse.json(
        { error: "Each item needs productId and unitPriceCents" },
        { status: 400 }
      );
    }

    subtotalCents += quantity * unitPriceCents;

    mappedItems.push({
      productId: String(item.productId),
      quantity,
      unitPriceCents,
      type,
    });
  }

  if (
    paymentMethod === "CASH" &&
    mappedItems.some((item) => item.type !== "LOCAL")
  ) {
    return NextResponse.json(
      { error: "Cash is only available for local products." },
      { status: 400 }
    );
  }

  const shippingCents = Number(body.shippingCents ?? 0);
  const feesCents = Number(body.feesCents ?? 0);
  const totalCents = subtotalCents + shippingCents + feesCents;

  if (paymentMethod && !allowedPaymentMethods.has(paymentMethod)) {
    return NextResponse.json(
      { error: "paymentMethod must be WAVE, ORANGE_MONEY, CARD, or CASH" },
      { status: 400 }
    );
  }

  const order = await prisma.order.create({
    data: {
      userId,
      sellerId,
      buyerName: body.name ?? undefined,
      buyerEmail: body.email ?? undefined,
      buyerPhone: body.phone ?? undefined,
      shippingAddress: body.shippingAddress ?? undefined,
      shippingCity: body.shippingCity ?? undefined,
      paymentMethod: paymentMethod ?? undefined,
      subtotalCents,
      shippingCents,
      feesCents,
      totalCents,
      currency,
      items: { create: mappedItems },
      events: {
        create: [
          {
            status: "PENDING",
            note: "Order placed",
          },
        ],
      },
    },
    include: { items: true },
  });

  await prisma.activityLog.create({
    data: {
      userId,
      action: "ORDER_CREATED",
      entityType: "Order",
      entityId: order.id,
    },
  });

  return NextResponse.json(order, { status: 201 });
}

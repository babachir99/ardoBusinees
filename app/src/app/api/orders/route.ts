import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const allowedTypes = new Set(["PREORDER", "DROPSHIP", "LOCAL"]);

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const takeParam = Number(searchParams.get("take") ?? "20");
  const take = Number.isFinite(takeParam)
    ? Math.min(Math.max(takeParam, 1), 50)
    : 20;
  const status = searchParams.get("status") ?? undefined;

  const orders = await prisma.order.findMany({
    take,
    orderBy: { createdAt: "desc" },
    where: status ? { status } : undefined,
    include: {
      items: true,
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

  const shippingCents = Number(body.shippingCents ?? 0);
  const feesCents = Number(body.feesCents ?? 0);
  const totalCents = subtotalCents + shippingCents + feesCents;

  const order = await prisma.order.create({
    data: {
      userId,
      sellerId,
      subtotalCents,
      shippingCents,
      feesCents,
      totalCents,
      currency,
      items: { create: mappedItems },
    },
    include: { items: true },
  });

  return NextResponse.json(order, { status: 201 });
}

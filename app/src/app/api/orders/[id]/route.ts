import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Order id is required" }, { status: 400 });
  }
  const order = await prisma.order.findUnique({
    where: { id },
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
      payment: true,
    },
  });

  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  return NextResponse.json(order);
}

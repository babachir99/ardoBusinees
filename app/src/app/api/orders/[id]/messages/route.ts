import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { UserRole } from "@prisma/client";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const order = await prisma.order.findUnique({
    where: { id: id },
    select: { id: true, sellerId: true, userId: true },
  });

  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  if (session.user.role !== "ADMIN") {
    if (session.user.role === "SELLER") {
      const seller = await prisma.sellerProfile.findUnique({
        where: { userId: session.user.id },
        select: { id: true },
      });
      if (!seller || seller.id !== order.sellerId) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    } else if (session.user.id !== order.userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const messages = await prisma.orderMessage.findMany({
    where: { orderId: order.id },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      body: true,
      senderRole: true,
      sender: { select: { name: true, email: true } },
      createdAt: true,
    },
  });

  return NextResponse.json(messages);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const message = String(body.message ?? "").trim();
  if (!message) {
    return NextResponse.json(
      { error: "message is required" },
      { status: 400 }
    );
  }

  const order = await prisma.order.findUnique({
    where: { id: id },
    select: { id: true, sellerId: true, userId: true },
  });

  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  if (session.user.role !== "ADMIN") {
    if (session.user.role === "SELLER") {
      const seller = await prisma.sellerProfile.findUnique({
        where: { userId: session.user.id },
        select: { id: true },
      });
      if (!seller || seller.id !== order.sellerId) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    } else if (session.user.id !== order.userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const created = await prisma.orderMessage.create({
    data: {
      orderId: order.id,
      senderId: session.user.id,
      senderRole: session.user.role as UserRole,
      body: message,
    },
  });

  return NextResponse.json(created, { status: 201 });
}



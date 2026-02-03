import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const seller = await prisma.sellerProfile.findUnique({
    where: { id: params.id },
    include: {
      user: { select: { id: true, email: true, name: true } },
      products: { take: 10, orderBy: { createdAt: "desc" } },
      services: { take: 10, orderBy: { createdAt: "desc" } },
    },
  });

  if (!seller) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(seller);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const body = await request.json().catch(() => null);

  if (!body) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const data: Record<string, unknown> = {};

  if (body.displayName) data.displayName = String(body.displayName);
  if (body.slug) data.slug = String(body.slug);
  if (body.status) data.status = body.status;
  if (body.commissionRate !== undefined) {
    data.commissionRate = Number(body.commissionRate);
  }
  if (body.payoutAccountRef !== undefined) {
    data.payoutAccountRef = body.payoutAccountRef;
  }

  const seller = await prisma.sellerProfile.update({
    where: { id: params.id },
    data,
  });

  return NextResponse.json(seller);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  await prisma.sellerProfile.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}

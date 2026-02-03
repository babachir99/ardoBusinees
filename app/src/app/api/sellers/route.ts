import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const takeParam = Number(searchParams.get("take") ?? "20");
  const take = Number.isFinite(takeParam)
    ? Math.min(Math.max(takeParam, 1), 50)
    : 20;

  const sellers = await prisma.sellerProfile.findMany({
    take,
    orderBy: { createdAt: "desc" },
    include: {
      user: { select: { id: true, email: true, name: true } },
    },
  });

  return NextResponse.json(sellers);
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);

  if (!body) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const userId = String(body.userId ?? "");
  const displayName = String(body.displayName ?? "");
  const slug = String(body.slug ?? "");

  if (!userId || !displayName || !slug) {
    return NextResponse.json(
      { error: "userId, displayName, slug are required" },
      { status: 400 }
    );
  }

  const seller = await prisma.sellerProfile.create({
    data: {
      userId,
      displayName,
      slug,
      status: body.status ?? "PENDING",
      commissionRate: body.commissionRate ?? 10,
      payoutAccountRef: body.payoutAccountRef ?? undefined,
    },
  });

  return NextResponse.json(seller, { status: 201 });
}

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const addresses = await prisma.userAddress.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      label: true,
      address: true,
      city: true,
      createdAt: true,
    },
  });

  return NextResponse.json(addresses);
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const label = String(body?.label ?? "").trim();
  const address = String(body?.address ?? "").trim();
  const city = String(body?.city ?? "").trim();

  if (!address || !city) {
    return NextResponse.json(
      { error: "address and city are required" },
      { status: 400 }
    );
  }

  const existingCount = await prisma.userAddress.count({
    where: { userId: session.user.id },
  });

  if (existingCount >= 20) {
    return NextResponse.json(
      { error: "Address book limit reached (20)." },
      { status: 400 }
    );
  }

  const nextLabel = label || `Address ${existingCount + 1}`;

  const created = await prisma.userAddress.create({
    data: {
      userId: session.user.id,
      label: nextLabel.slice(0, 80),
      address: address.slice(0, 200),
      city: city.slice(0, 80),
    },
    select: {
      id: true,
      label: true,
      address: true,
      city: true,
      createdAt: true,
    },
  });

  return NextResponse.json(created, { status: 201 });
}

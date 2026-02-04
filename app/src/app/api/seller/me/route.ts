import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const seller = await prisma.sellerProfile.findUnique({
    where: { userId: session.user.id },
    include: { user: { select: { email: true, name: true } } },
  });

  if (!seller) {
    return NextResponse.json({ error: "Seller profile not found" }, { status: 404 });
  }

  return NextResponse.json(seller);
}

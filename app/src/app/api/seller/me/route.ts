import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function loadSellerByUserId(userId: string, includeStatus = true) {
  if (includeStatus) {
    return prisma.sellerProfile.findUnique({
      where: { userId },
      select: {
        id: true,
        displayName: true,
        slug: true,
        status: true,
      },
    });
  }

  const seller = await prisma.sellerProfile.findUnique({
    where: { userId },
    select: {
      id: true,
      displayName: true,
      slug: true,
    },
  });

  return seller ? { ...seller, status: "PENDING" as const } : null;
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let seller = null;
    try {
      seller = await loadSellerByUserId(session.user.id, true);
    } catch {
      // Fallback for transient schema/client mismatch in dev mode.
      seller = await loadSellerByUserId(session.user.id, false);
    }

    if (!seller) {
      return NextResponse.json({ error: "Seller profile not found" }, { status: 404 });
    }

    return NextResponse.json(seller);
  } catch (error) {
    console.error("[api/seller/me] GET failed:", error);
    return NextResponse.json(
      { error: "Unable to load seller profile" },
      { status: 500 }
    );
  }
}

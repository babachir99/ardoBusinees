import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasUserRole } from "@/lib/userRoles";
import {
  getHomePromoEntries,
  HOME_PROMO_ACTIVITY_ACTION,
  resolveHomePromoEntries,
} from "@/lib/homePromos";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !hasUserRole(session.user, "ADMIN")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const config = await getHomePromoEntries();
  return NextResponse.json(config);
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !hasUserRole(session.user, "ADMIN")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const entries = resolveHomePromoEntries(body?.promos);

  await prisma.activityLog.create({
    data: {
      userId: session.user.id,
      action: HOME_PROMO_ACTIVITY_ACTION,
      entityType: "HOME_PROMOS",
      metadata: {
        promos: entries,
      },
    },
  });

  const config = await getHomePromoEntries();
  return NextResponse.json(config);
}

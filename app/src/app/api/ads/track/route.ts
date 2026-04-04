import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  HOME_PROMO_TRACK_ACTIVITY_ACTION,
} from "@/lib/homePromos";
import { HOME_PROMO_PLACEMENTS } from "@/lib/homePromos.shared";

const TRACKABLE_EVENTS = new Set(["IMPRESSION", "CLICK", "DISMISS"]);
let cachedTrackingActorId: string | null | undefined;

function sanitizeText(value: unknown, maxLength: number) {
  const normalized = typeof value === "string" ? value.trim() : "";
  return normalized ? normalized.slice(0, maxLength) : null;
}

async function getTrackingActorId(sessionUserId: string | null | undefined) {
  if (sessionUserId) {
    return sessionUserId;
  }

  if (cachedTrackingActorId !== undefined) {
    return cachedTrackingActorId;
  }

  const adminUser = await prisma.user.findFirst({
    where: { role: "ADMIN" },
    select: { id: true },
    orderBy: { createdAt: "asc" },
  });

  cachedTrackingActorId = adminUser?.id ?? null;
  return cachedTrackingActorId;
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  const body = await request.json().catch(() => null);

  const campaignId = sanitizeText(body?.campaignId, 64);
  const eventType = sanitizeText(body?.eventType, 24)?.toUpperCase();
  const placement = sanitizeText(body?.placement, 24)?.toUpperCase();

  if (
    !campaignId ||
    !eventType ||
    !TRACKABLE_EVENTS.has(eventType) ||
    !placement ||
    !HOME_PROMO_PLACEMENTS.includes(placement as (typeof HOME_PROMO_PLACEMENTS)[number])
  ) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const actorId = await getTrackingActorId(session?.user?.id);
  if (!actorId) {
    return NextResponse.json({ ok: true, tracked: false });
  }

  await prisma.activityLog.create({
    data: {
      userId: actorId,
      action: HOME_PROMO_TRACK_ACTIVITY_ACTION,
      entityType: "HOME_PROMO",
      entityId: campaignId,
      metadata: {
        eventType,
        placement,
        href: sanitizeText(body?.href, 240),
        locale: sanitizeText(body?.locale, 12),
        pathname: sanitizeText(body?.pathname, 240),
        advertiserName: sanitizeText(body?.advertiserName, 80),
        anonymous: !session?.user?.id,
        viewerUserId: session?.user?.id ?? null,
        visitorId: sanitizeText(body?.visitorId, 80),
      },
    },
  });

  return NextResponse.json({ ok: true, tracked: true });
}

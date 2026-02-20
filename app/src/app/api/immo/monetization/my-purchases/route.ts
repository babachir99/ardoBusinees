import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canAccessAdmin, errorResponse } from "@/app/api/immo/listings/_shared";

function parseTake(value: unknown, fallback = 20, max = 60) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(Math.trunc(parsed), 1), max);
}

function parseSkip(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(Math.trunc(parsed), 0);
}

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return errorResponse(401, "UNAUTHORIZED", "Authentication required.");
  }

  const { searchParams } = new URL(request.url);
  const take = parseTake(searchParams.get("take"));
  const skip = parseSkip(searchParams.get("skip"));

  const isAdmin = canAccessAdmin(session.user);

  const membershipPublisherIds = isAdmin
    ? []
    : (
        await prisma.immoPublisherMember.findMany({
          where: {
            userId: session.user.id,
            status: "ACTIVE",
            publisher: {
              status: "ACTIVE",
              type: "AGENCY",
            },
          },
          select: { publisherId: true },
        })
      ).map((row) => row.publisherId);

  if (!isAdmin && membershipPublisherIds.length === 0) {
    return NextResponse.json({ purchases: [] });
  }

  const purchases = await prisma.immoMonetizationPurchase.findMany({
    where: isAdmin
      ? {}
      : {
          publisherId: { in: membershipPublisherIds },
        },
    orderBy: [{ createdAt: "desc" }],
    take,
    skip,
    select: {
      id: true,
      listingId: true,
      publisherId: true,
      kind: true,
      durationDays: true,
      amountCents: true,
      currency: true,
      status: true,
      paymentLedgerId: true,
      createdAt: true,
      updatedAt: true,
      listing: {
        select: {
          id: true,
          title: true,
          city: true,
          country: true,
        },
      },
      publisher: {
        select: {
          id: true,
          name: true,
          slug: true,
          verified: true,
          city: true,
          country: true,
          logoUrl: true,
        },
      },
      paymentLedger: {
        select: {
          id: true,
          provider: true,
          providerIntentId: true,
          status: true,
          amountTotalCents: true,
          currency: true,
          createdAt: true,
        },
      },
    },
  });

  return NextResponse.json({ purchases });
}

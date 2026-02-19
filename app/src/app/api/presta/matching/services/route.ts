import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { evaluateContactPolicy } from "@/lib/policies/contactPolicy";
import { Vertical, getVerticalRules } from "@/lib/verticals";

const vertical = Vertical.PRESTA;
const rules = getVerticalRules(vertical);

function hasMatchingDelegates() {
  const runtimePrisma = prisma as unknown as {
    prestaNeed?: unknown;
    prestaService?: unknown;
    prestaProposal?: unknown;
  };

  return Boolean(runtimePrisma.prestaNeed && runtimePrisma.prestaService && runtimePrisma.prestaProposal);
}

function normalizeTake(value: string | null, fallback: number, max: number) {
  const parsed = Number(value ?? String(fallback));
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(Math.trunc(parsed), 1), max);
}

function truncate(value: string | null, maxLength: number) {
  if (!value) return "";
  return value.length > maxLength ? `${value.slice(0, maxLength - 3)}...` : value;
}

function errorResponse(status: number, error: string, message: string) {
  return NextResponse.json({ error, message }, { status });
}

function dedupeServices<T extends { id: string }>(lists: T[][], take: number) {
  const seen = new Set<string>();
  const merged: T[] = [];

  for (const list of lists) {
    for (const item of list) {
      if (seen.has(item.id)) continue;
      seen.add(item.id);
      merged.push(item);
      if (merged.length >= take) {
        return merged;
      }
    }
  }

  return merged;
}

// curl -X GET "http://localhost:3000/api/presta/matching/services?needId=<needId>"
// curl -X GET "http://localhost:3000/api/presta/matching/services?needId=<needId>&take=20"
export async function GET(request: NextRequest) {
  if (!hasMatchingDelegates()) {
    return errorResponse(
      503,
      "DELEGATE_UNAVAILABLE",
      "PRESTA matching delegates unavailable. Run npx prisma generate and restart dev server."
    );
  }

  const session = await getServerSession(authOptions);

  const { searchParams } = new URL(request.url);
  const needId = searchParams.get("needId")?.trim();
  const take = normalizeTake(searchParams.get("take"), 12, 30);

  if (!needId) {
    return errorResponse(400, "NEED_ID_REQUIRED", "needId query parameter is required.");
  }

  const need = await prisma.prestaNeed.findUnique({
    where: { id: needId },
    select: {
      id: true,
      customerId: true,
      status: true,
      city: true,
      area: true,
      title: true,
    },
  });

  if (!need) {
    return errorResponse(404, "NEED_NOT_FOUND", "Need not found.");
  }

  const isAdmin = session?.user?.role === "ADMIN";
  const isOwner = Boolean(session?.user?.id && session.user.id === need.customerId);

  if (need.status !== "OPEN" && !isAdmin && !isOwner) {
    return errorResponse(409, "NEED_NOT_OPEN", "Need is not open for service suggestions.");
  }

  const cityMatches = need.city
    ? await prisma.prestaService.findMany({
        where: {
          isActive: true,
          city: { contains: need.city, mode: "insensitive" },
        },
        orderBy: [{ createdAt: "desc" }],
        take: Math.min(take * 2, 60),
        select: {
          id: true,
          providerId: true,
          title: true,
          description: true,
          basePriceCents: true,
          currency: true,
          city: true,
          createdAt: true,
          acceptedPaymentMethods: true,
          provider: {
            select: {
              id: true,
              name: true,
              image: true,
            },
          },
        },
      })
    : [];

  const areaMatches = need.area
    ? await prisma.prestaService.findMany({
        where: {
          isActive: true,
          OR: [
            { title: { contains: need.area, mode: "insensitive" } },
            { description: { contains: need.area, mode: "insensitive" } },
            { city: { contains: need.area, mode: "insensitive" } },
          ],
        },
        orderBy: [{ createdAt: "desc" }],
        take: Math.min(take * 2, 60),
        select: {
          id: true,
          providerId: true,
          title: true,
          description: true,
          basePriceCents: true,
          currency: true,
          city: true,
          createdAt: true,
          acceptedPaymentMethods: true,
          provider: {
            select: {
              id: true,
              name: true,
              image: true,
            },
          },
        },
      })
    : [];

  const fallback = await prisma.prestaService.findMany({
    where: { isActive: true },
    orderBy: [{ createdAt: "desc" }],
    take: Math.min(take * 3, 90),
    select: {
      id: true,
      providerId: true,
      title: true,
      description: true,
      basePriceCents: true,
      currency: true,
      city: true,
      createdAt: true,
      acceptedPaymentMethods: true,
      provider: {
        select: {
          id: true,
          name: true,
          image: true,
        },
      },
    },
  });

  const mergedServices = dedupeServices([cityMatches, areaMatches, fallback], take);
  const providerIds = Array.from(new Set(mergedServices.map((service) => service.providerId)));

  const proposalRows =
    providerIds.length > 0
      ? await prisma.prestaProposal.findMany({
          where: {
            needId: need.id,
            providerId: { in: providerIds },
          },
          select: {
            providerId: true,
          },
        })
      : [];

  const proposalByProvider = new Set(proposalRows.map((proposal) => proposal.providerId));
  const providerRoles = new Set(rules.publishRoles);

  return NextResponse.json({
    need: {
      id: need.id,
      status: need.status,
      title: need.title,
      city: need.city,
      area: need.area,
    },
    services: mergedServices.map((service) => {
      const alreadyProposed = proposalByProvider.has(service.providerId);
      const policy = evaluateContactPolicy({
        viewerId: session?.user?.id,
        viewerRole: session?.user?.role,
        ownerId: service.providerId,
        lockedByDefault: rules.contact.lockedByDefault,
        unlockStatusHint: rules.contact.unlockStatusHint,
      });

      const canPropose = Boolean(
        session?.user?.id &&
          session.user.id === service.providerId &&
          session.user.id !== need.customerId &&
          providerRoles.has(session.user.role as (typeof rules.publishRoles)[number]) &&
          need.status === "OPEN" &&
          !alreadyProposed
      );

      return {
        id: service.id,
        title: service.title,
        description: truncate(service.description, 240),
        basePriceCents: service.basePriceCents,
        currency: service.currency,
        city: service.city,
        area: null,
        createdAt: service.createdAt,
        provider: {
          id: service.provider.id,
          name: service.provider.name,
          image: service.provider.image,
        },
        canPropose,
        alreadyProposed,
        contactLocked: policy.contactLocked,
        contactUnlockStatusHint: policy.contactUnlockStatusHint,
      };
    }),
  });
}

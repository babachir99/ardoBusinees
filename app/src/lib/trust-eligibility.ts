import { PrismaClient, UserRoleType } from "@prisma/client";

async function isAdminActor(prisma: PrismaClient, actorId: string) {
  const actor = await prisma.user.findUnique({
    where: { id: actorId },
    select: { role: true },
  });

  if (!actor) return false;
  if (actor.role === "ADMIN") return true;

  const adminAssignment = await prisma.userRoleAssignment.findFirst({
    where: {
      userId: actorId,
      role: UserRoleType.ADMIN,
      status: "ACTIVE",
    },
    select: { id: true },
  });

  return Boolean(adminAssignment);
}

export async function canTrustAction(prisma: PrismaClient, actorId: string, targetId: string): Promise<boolean> {
  if (!actorId || !targetId || actorId === targetId) return false;

  if (await isAdminActor(prisma, actorId)) {
    return true;
  }

  const [hasInquiry, hasOrderMessage, hasOrder, hasPrestaBooking, hasGpBooking, hasTiakDelivery, hasAcceptedOffer] =
    await Promise.all([
      prisma.productInquiry.findFirst({
        where: {
          OR: [
            { buyerId: actorId, seller: { userId: targetId } },
            { buyerId: targetId, seller: { userId: actorId } },
          ],
        },
        select: { id: true },
      }),
      prisma.orderMessage.findFirst({
        where: {
          OR: [
            {
              senderId: actorId,
              order: {
                OR: [{ userId: targetId }, { seller: { userId: targetId } }],
              },
            },
            {
              senderId: targetId,
              order: {
                OR: [{ userId: actorId }, { seller: { userId: actorId } }],
              },
            },
          ],
        },
        select: { id: true },
      }),
      prisma.order.findFirst({
        where: {
          OR: [
            { userId: actorId, seller: { userId: targetId } },
            { userId: targetId, seller: { userId: actorId } },
          ],
        },
        select: { id: true },
      }),
      prisma.prestaBooking.findFirst({
        where: {
          OR: [
            { customerId: actorId, providerId: targetId },
            { customerId: targetId, providerId: actorId },
          ],
        },
        select: { id: true },
      }),
      prisma.gpTripBooking.findFirst({
        where: {
          OR: [
            { customerId: actorId, transporterId: targetId },
            { customerId: targetId, transporterId: actorId },
          ],
        },
        select: { id: true },
      }),
      prisma.tiakDelivery.findFirst({
        where: {
          OR: [
            { customerId: actorId, courierId: targetId },
            { customerId: targetId, courierId: actorId },
          ],
        },
        select: { id: true },
      }),
      prisma.productOffer.findFirst({
        where: {
          status: "ACCEPTED",
          OR: [
            { buyerId: actorId, seller: { userId: targetId } },
            { buyerId: targetId, seller: { userId: actorId } },
          ],
        },
        select: { id: true },
      }),
    ]);

  return Boolean(
    hasInquiry ||
      hasOrderMessage ||
      hasOrder ||
      hasPrestaBooking ||
      hasGpBooking ||
      hasTiakDelivery ||
      hasAcceptedOffer
  );
}

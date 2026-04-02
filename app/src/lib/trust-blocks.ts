import { prisma } from "@/lib/prisma";
import type { PrismaClient } from "@prisma/client";

export async function isBlocked(blockerId: string, blockedId: string) {
  if (!blockerId || !blockedId) return false;
  const db = prisma as PrismaClient;
  if (!db?.userBlock?.findFirst) return false;
  const row = await db.userBlock.findFirst({
    where: { blockerId, blockedId },
    select: { id: true },
  });
  return Boolean(row);
}

export async function isEitherBlocked(userAId: string, userBId: string) {
  if (!userAId || !userBId || userAId === userBId) return false;
  const db = prisma as PrismaClient;
  if (!db?.userBlock?.findFirst) return false;
  const row = await db.userBlock.findFirst({
    where: {
      OR: [
        { blockerId: userAId, blockedId: userBId },
        { blockerId: userBId, blockedId: userAId },
      ],
    },
    select: { id: true },
  });
  return Boolean(row);
}

import { prisma } from "@/lib/prisma";

export const GP_THREAD_READ_ACTION = "GP_THREAD_READ";
const READ_THROTTLE_MS = 60 * 1000;

export async function getGpThreadReadMap(userId: string, shipmentIds: string[]) {
  const ids = [...new Set(shipmentIds.filter(Boolean))];
  const map = new Map<string, Date>();

  if (ids.length === 0) {
    return map;
  }

  const logs = await prisma.activityLog.findMany({
    where: {
      userId,
      action: GP_THREAD_READ_ACTION,
      entityType: "GpShipment",
      entityId: { in: ids },
    },
    orderBy: [{ entityId: "asc" }, { createdAt: "desc" }],
    select: {
      entityId: true,
      createdAt: true,
    },
  });

  for (const log of logs) {
    if (log.entityId && !map.has(log.entityId)) {
      map.set(log.entityId, log.createdAt);
    }
  }

  return map;
}

export async function recordGpThreadRead(userId: string, shipmentId: string) {
  const cutoff = new Date(Date.now() - READ_THROTTLE_MS);
  const latest = await prisma.activityLog.findFirst({
    where: {
      userId,
      action: GP_THREAD_READ_ACTION,
      entityType: "GpShipment",
      entityId: shipmentId,
    },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });

  if (latest && latest.createdAt >= cutoff) {
    return latest.createdAt;
  }

  const created = await prisma.activityLog.create({
    data: {
      userId,
      action: GP_THREAD_READ_ACTION,
      entityType: "GpShipment",
      entityId: shipmentId,
      metadata: { source: "messages" },
    },
    select: { createdAt: true },
  });

  return created.createdAt;
}

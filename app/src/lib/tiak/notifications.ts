import { NotificationKind, Prisma } from "@prisma/client";
import { NotificationService } from "@/lib/notifications/NotificationService";
import { prisma } from "@/lib/prisma";

function toDeliveryRef(deliveryId: string) {
  return `TIAK-${deliveryId.slice(0, 8).toUpperCase()}`;
}

function toDeliveryLink(deliveryId: string) {
  return `/tiak-tiak?deliveryId=${encodeURIComponent(deliveryId)}`;
}

async function queueDeliveryUpdateEmail(params: {
  userId: string;
  deliveryId: string;
  trackingStep: string;
  dedupeKey: string;
}) {
  return NotificationService.queueEmail({
    userId: params.userId,
    kind: NotificationKind.TRANSACTIONAL,
    templateKey: "delivery_update",
    payload: {
      orderId: toDeliveryRef(params.deliveryId),
      trackingStep: params.trackingStep,
      eta: "",
      link: toDeliveryLink(params.deliveryId),
    },
    dedupeKey: params.dedupeKey,
  });
}

async function logActivity(params: {
  userId: string;
  action: string;
  deliveryId: string;
  metadata?: Record<string, unknown>;
}) {
  await prisma.activityLog.create({
    data: {
      userId: params.userId,
      action: params.action,
      entityType: "TiakDelivery",
      entityId: params.deliveryId,
      metadata: (params.metadata ?? {}) as Prisma.InputJsonValue,
    },
  });
}

export async function queueTiakAssignedNotification(params: {
  deliveryId: string;
  courierId: string;
  customerId?: string | null;
  assignedById?: string | null;
}) {
  const tasks: Array<Promise<unknown>> = [
    queueDeliveryUpdateEmail({
      userId: params.courierId,
      deliveryId: params.deliveryId,
      trackingStep: "ASSIGNED",
      dedupeKey: `tiak_assigned:${params.deliveryId}:${params.courierId}`,
    }),
  ];

  if (params.customerId) {
    tasks.push(
      logActivity({
        userId: params.customerId,
        action: "TIAK_DELIVERY_ASSIGNED",
        deliveryId: params.deliveryId,
        metadata: {
          courierId: params.courierId,
          assignedById: params.assignedById ?? null,
        },
      })
    );

    tasks.push(
      queueDeliveryUpdateEmail({
        userId: params.customerId,
        deliveryId: params.deliveryId,
        trackingStep: "ASSIGNED",
        dedupeKey: `tiak_assigned_customer:${params.deliveryId}:${params.customerId}`,
      })
    );
  }

  await Promise.allSettled(tasks);
}

export async function queueTiakAcceptedNotification(params: {
  deliveryId: string;
  customerId: string;
  courierId: string;
}) {
  await Promise.allSettled([
    logActivity({
      userId: params.customerId,
      action: "TIAK_DELIVERY_ACCEPTED",
      deliveryId: params.deliveryId,
      metadata: {
        courierId: params.courierId,
      },
    }),
    queueDeliveryUpdateEmail({
      userId: params.customerId,
      deliveryId: params.deliveryId,
      trackingStep: "ACCEPTED",
      dedupeKey: `tiak_accepted:${params.deliveryId}:${params.courierId}`,
    }),
  ]);
}

export async function queueTiakDeclinedNotification(params: {
  deliveryId: string;
  customerId: string;
  courierId: string;
}) {
  await Promise.allSettled([
    logActivity({
      userId: params.customerId,
      action: "TIAK_DELIVERY_DECLINED",
      deliveryId: params.deliveryId,
      metadata: {
        courierId: params.courierId,
      },
    }),
    queueDeliveryUpdateEmail({
      userId: params.customerId,
      deliveryId: params.deliveryId,
      trackingStep: "REJECTED",
      dedupeKey: `tiak_declined:${params.deliveryId}:${params.customerId}`,
    }),
  ]);
}

export async function queueTiakStatusNotification(params: {
  deliveryId: string;
  recipientId: string;
  trackingStep: "PICKED_UP" | "DELIVERED" | "COMPLETED" | "CANCELED" | "REJECTED";
  action: string;
  actorId?: string | null;
}) {
  await Promise.allSettled([
    logActivity({
      userId: params.recipientId,
      action: params.action,
      deliveryId: params.deliveryId,
      metadata: {
        actorId: params.actorId ?? null,
        trackingStep: params.trackingStep,
      },
    }),
    queueDeliveryUpdateEmail({
      userId: params.recipientId,
      deliveryId: params.deliveryId,
      trackingStep: params.trackingStep,
      dedupeKey: `tiak_status:${params.deliveryId}:${params.trackingStep}:${params.recipientId}`,
    }),
  ]);
}


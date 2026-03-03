import { NotificationKind } from "@prisma/client";
import { NotificationService } from "@/lib/notifications/NotificationService";
import { prisma } from "@/lib/prisma";

function toDeliveryRef(deliveryId: string) {
  return `TIAK-${deliveryId.slice(0, 8).toUpperCase()}`;
}

function toDeliveryLink(deliveryId: string) {
  return `/tiak-tiak?deliveryId=${encodeURIComponent(deliveryId)}`;
}

export async function queueTiakAssignedNotification(params: {
  deliveryId: string;
  courierId: string;
}) {
  const dedupeKey = `tiak_assigned:${params.deliveryId}:${params.courierId}`;

  return NotificationService.queueEmail({
    userId: params.courierId,
    kind: NotificationKind.TRANSACTIONAL,
    templateKey: "delivery_update",
    payload: {
      orderId: toDeliveryRef(params.deliveryId),
      trackingStep: "ASSIGNED",
      eta: "",
      link: toDeliveryLink(params.deliveryId),
    },
    dedupeKey,
  });
}

export async function queueTiakAcceptedNotification(params: {
  deliveryId: string;
  customerId: string;
  courierId: string;
}) {
  const dedupeKey = `tiak_accepted:${params.deliveryId}:${params.courierId}`;

  await prisma.activityLog.create({
    data: {
      userId: params.customerId,
      action: "TIAK_DELIVERY_ACCEPTED",
      entityType: "TiakDelivery",
      entityId: params.deliveryId,
      metadata: {
        courierId: params.courierId,
      },
    },
  });

  return NotificationService.queueEmail({
    userId: params.customerId,
    kind: NotificationKind.TRANSACTIONAL,
    templateKey: "delivery_update",
    payload: {
      orderId: toDeliveryRef(params.deliveryId),
      trackingStep: "ACCEPTED",
      eta: "",
      link: toDeliveryLink(params.deliveryId),
    },
    dedupeKey,
  });
}

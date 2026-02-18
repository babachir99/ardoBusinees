export type TiakDeliveryStatus =
  | "REQUESTED"
  | "ACCEPTED"
  | "PICKED_UP"
  | "DELIVERED"
  | "COMPLETED"
  | "CANCELED"
  | "REJECTED";

export type TiakUserLite = {
  id: string;
  name: string | null;
  image: string | null;
};

export type TiakDelivery = {
  id: string;
  customerId: string;
  courierId: string | null;
  status: TiakDeliveryStatus;
  pickupArea: string;
  dropoffArea: string;
  pickupAddress?: string;
  dropoffAddress?: string;
  note: string | null;
  priceCents: number | null;
  currency: string;
  paymentMethod: string | null;
  paymentStatus: "PENDING" | "PAID" | "FAILED" | "REFUNDED" | null;
  paidAt: string | null;
  orderId: string | null;
  createdAt: string;
  updatedAt: string;
  customer: TiakUserLite | null;
  courier: TiakUserLite | null;
  contactLocked: boolean;
  contactUnlockStatusHint: string | null;
  canContact: boolean;
};

export type TiakDeliveryEvent = {
  id: string;
  deliveryId: string;
  status: TiakDeliveryStatus;
  note: string | null;
  proofUrl: string | null;
  createdAt: string;
  actorId: string;
  actor: {
    id: string;
    name: string | null;
    image: string | null;
    role: string;
  } | null;
};

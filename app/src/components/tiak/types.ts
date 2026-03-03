export type TiakDeliveryStatus =
  | "REQUESTED"
  | "ASSIGNED"
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
  assignedAt: string | null;
  assignExpiresAt: string | null;
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

export type TiakCourierProfile = {
  id: string;
  courierId: string;
  isActive: boolean;
  isConfirmedCourier?: boolean;
  cities: string[];
  areas: string[];
  vehicleType: string | null;
  maxWeightKg: number | null;
  availableHours: string | null;
  createdAt: string;
  updatedAt: string;
  courier: {
    id: string;
    name: string | null;
    image: string | null;
    role: string;
  };
};

export type TiakPayout = {
  id: string;
  status: "PENDING" | "READY" | "PAID" | "FAILED";
  amountTotalCents: number;
  platformFeeCents: number;
  courierPayoutCents: number;
  currency: string;
  createdAt: string;
  deliveryId: string;
};

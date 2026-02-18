export const Vertical = {
  SHOP: "SHOP",
  PRESTA: "PRESTA",
  GP: "GP",
  TIAK_TIAK: "TIAK_TIAK",
} as const;

export type VerticalId = (typeof Vertical)[keyof typeof Vertical];

export type VerticalUserRole =
  | "ADMIN"
  | "SELLER"
  | "CUSTOMER"
  | "TRANSPORTER"
  | "COURIER";

export type VerticalAccessRules = {
  publishRoles: readonly VerticalUserRole[];
  kycRequiredForPublishing: boolean;
  contact: {
    lockedByDefault: boolean;
    unlockStatusHint: string | null;
  };
};

export const STORE_SLUG_TO_VERTICAL: Record<string, VerticalId> = {
  "jontaado-marketplace": Vertical.SHOP,
  "jontaado-shop": Vertical.SHOP,
  "jontaado-presta": Vertical.PRESTA,
  "jontaado-gp": Vertical.GP,
  "jontaado-tiak-tiak": Vertical.TIAK_TIAK,
};

export const VERTICAL_ACCESS_RULES: Record<VerticalId, VerticalAccessRules> = {
  [Vertical.SHOP]: {
    publishRoles: ["SELLER", "ADMIN"],
    kycRequiredForPublishing: false,
    contact: {
      lockedByDefault: false,
      unlockStatusHint: null,
    },
  },
  [Vertical.PRESTA]: {
    publishRoles: ["SELLER", "ADMIN"],
    kycRequiredForPublishing: true,
    contact: {
      lockedByDefault: true,
      unlockStatusHint: "BOOKING_CONFIRMED",
    },
  },
  [Vertical.GP]: {
    publishRoles: ["TRANSPORTER", "ADMIN"],
    kycRequiredForPublishing: true,
    contact: {
      lockedByDefault: true,
      unlockStatusHint: "CONFIRMED|COMPLETED|DELIVERED",
    },
  },
  [Vertical.TIAK_TIAK]: {
    publishRoles: ["COURIER", "ADMIN"],
    kycRequiredForPublishing: true,
    contact: {
      lockedByDefault: true,
      unlockStatusHint: "ACCEPTED|PICKED_UP|DELIVERED|COMPLETED",
    },
  },
};

export function getVerticalByStoreSlug(slug: string | null | undefined): VerticalId {
  if (!slug) return Vertical.SHOP;
  return STORE_SLUG_TO_VERTICAL[slug] ?? Vertical.SHOP;
}

export function getVerticalRules(vertical: VerticalId): VerticalAccessRules {
  return VERTICAL_ACCESS_RULES[vertical];
}
export function isVertical(value: unknown): value is VerticalId {
  return typeof value === "string" && Object.values(Vertical).includes(value as VerticalId);
}

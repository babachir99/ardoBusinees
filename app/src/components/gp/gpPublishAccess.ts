type PaymentMethod = "WAVE" | "ORANGE_MONEY" | "CARD" | "CASH";

type ViewerSnapshot = {
  role: string;
  name?: string | null;
  phone?: string | null;
  gpTrips?: Array<{
    contactPhone?: string | null;
    acceptedPaymentMethods?: string[];
  }>;
} | null;

export function resolveGpPublishAccess(viewer: ViewerSnapshot, isLoggedIn: boolean) {
  if (!isLoggedIn) {
    return {
      isLoggedIn: false,
      hasGpProfile: false,
      displayName: null,
      defaultContactPhone: null,
      defaultPaymentMethods: [] as PaymentMethod[],
    };
  }

  const isTransporter = viewer?.role === "TRANSPORTER";
  const isAdmin = viewer?.role === "ADMIN";
  const hasTrips = Boolean(viewer?.gpTrips?.length);

  const allowedMethods = new Set<PaymentMethod>(["WAVE", "ORANGE_MONEY", "CARD", "CASH"]);
  const paymentFromLastTrip = (viewer?.gpTrips?.[0]?.acceptedPaymentMethods ?? []).filter(
    (method): method is PaymentMethod => allowedMethods.has(method as PaymentMethod)
  );

  return {
    isLoggedIn: true,
    hasGpProfile: isTransporter || isAdmin || hasTrips,
    displayName: viewer?.name ?? null,
    defaultContactPhone: viewer?.gpTrips?.[0]?.contactPhone ?? viewer?.phone ?? null,
    defaultPaymentMethods: paymentFromLastTrip,
  };
}

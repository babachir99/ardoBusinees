import type { HomePromoPlacement } from "@/lib/homePromos.shared";

export const AD_REQUEST_STATUSES = ["PENDING", "APPROVED", "REJECTED"] as const;

export type AdRequestStatus = (typeof AD_REQUEST_STATUSES)[number];

export type AdRequestEntry = {
  id: string;
  activityLogId: string;
  createdAt: string;
  updatedAt: string;
  status: AdRequestStatus;
  companyName: string;
  contactName: string;
  email: string;
  phone: string | null;
  websiteUrl: string;
  campaignTitle: string;
  campaignDescription: string;
  ctaLabel: string;
  desiredPlacement: HomePromoPlacement;
  billingStatus: "QUOTE_PENDING" | "PAYMENT_PENDING" | "PAID" | "READY";
  targetStoreSlugs: string[];
  logoUrl: string | null;
  imageUrl: string | null;
  budget: string | null;
  notes: string | null;
  locale: string;
  sourceVertical: string;
  submittedByUserId: string | null;
  anonymous: boolean;
  adminNote: string | null;
  approvedCampaignId: string | null;
  reviewedAt: string | null;
  reviewedBy: { id: string; name: string | null; email: string | null } | null;
};

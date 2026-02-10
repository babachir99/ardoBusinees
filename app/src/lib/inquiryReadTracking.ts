import { Prisma } from "@prisma/client";

let cachedSupport: boolean | null = null;

export type InquiryReadTrackingUpdate = {
  buyerLastReadAt?: Date;
  sellerLastReadAt?: Date;
};

export function supportsInquiryReadTrackingFields(): boolean {
  if (cachedSupport !== null) {
    return cachedSupport;
  }

  const inquiryModel = Prisma.dmmf.datamodel.models.find(
    (model) => model.name === "ProductInquiry"
  );
  const fields = new Set(inquiryModel?.fields.map((field) => field.name) ?? []);
  cachedSupport =
    fields.has("buyerLastReadAt") && fields.has("sellerLastReadAt");
  return cachedSupport;
}

export function getInquiryReadTrackingUpdate(
  actor: "buyer" | "seller",
  at: Date
): InquiryReadTrackingUpdate {
  if (!supportsInquiryReadTrackingFields()) {
    return {};
  }

  return actor === "buyer"
    ? { buyerLastReadAt: at }
    : { sellerLastReadAt: at };
}

import type { KycLevel, KycRole, KycType, UserRoleType } from "@prisma/client";

export type KycFieldKey =
  | "phoneVerified"
  | "addressCity"
  | "addressCountry"
  | "docIdUrl"
  | "driverLicenseUrl"
  | "selfieUrl"
  | "proofAddressUrl"
  | "passportUrl"
  | "proofTravelUrl"
  | "businessRegistrationUrl"
  | "companyName"
  | "companyAddress"
  | "companyRibUrl"
  | "legalRepIdUrl"
  | "legalRepSelfieUrl"
  | "professionalLicenseUrl";

export type KycRequirement = {
  roleRequested: KycRole;
  kycType: KycType;
  kycLevel: KycLevel;
  requiredFields: KycFieldKey[];
  optionalFields: KycFieldKey[];
};

type ValidateContext = {
  phone?: string | null;
  phoneVerified?: boolean;
};

const ROLE_ALIASES: Record<string, KycRole> = {
  SELLER: "SELLER",
  TRANSPORTER: "GP_CARRIER",
  GP_CARRIER: "GP_CARRIER",
  COURIER: "TIAK_COURIER",
  TIAK_COURIER: "TIAK_COURIER",
  IMMO_AGENT: "IMMO_AGENCY",
  IMMO_AGENCY: "IMMO_AGENCY",
  CAR_DEALER: "CAR_DEALER",
};

const REQUIREMENTS_BY_ROLE: Record<KycRole, Omit<KycRequirement, "roleRequested">> = {
  SELLER: {
    kycType: "INDIVIDUAL",
    kycLevel: "BASIC",
    requiredFields: ["phoneVerified", "addressCity", "addressCountry", "docIdUrl"],
    optionalFields: ["proofAddressUrl", "selfieUrl"],
  },
  TRANSPORTER: {
    kycType: "INDIVIDUAL",
    kycLevel: "ENHANCED",
    requiredFields: ["passportUrl", "selfieUrl", "phoneVerified"],
    optionalFields: ["proofAddressUrl", "proofTravelUrl"],
  },
  GP_CARRIER: {
    kycType: "INDIVIDUAL",
    kycLevel: "ENHANCED",
    requiredFields: ["passportUrl", "selfieUrl", "phoneVerified"],
    optionalFields: ["proofAddressUrl", "proofTravelUrl"],
  },
  COURIER: {
    kycType: "INDIVIDUAL",
    kycLevel: "ENHANCED",
    requiredFields: ["docIdUrl", "driverLicenseUrl", "selfieUrl", "phoneVerified"],
    optionalFields: ["proofAddressUrl"],
  },
  TIAK_COURIER: {
    kycType: "INDIVIDUAL",
    kycLevel: "ENHANCED",
    requiredFields: ["docIdUrl", "driverLicenseUrl", "selfieUrl", "phoneVerified"],
    optionalFields: ["proofAddressUrl"],
  },
  IMMO_AGENCY: {
    kycType: "BUSINESS",
    kycLevel: "PROFESSIONAL",
    requiredFields: [
      "businessRegistrationUrl",
      "companyName",
      "companyAddress",
      "companyRibUrl",
      "legalRepIdUrl",
      "legalRepSelfieUrl",
    ],
    optionalFields: ["professionalLicenseUrl"],
  },
  CAR_DEALER: {
    kycType: "BUSINESS",
    kycLevel: "PROFESSIONAL",
    requiredFields: [
      "businessRegistrationUrl",
      "companyName",
      "companyAddress",
      "companyRibUrl",
      "legalRepIdUrl",
      "legalRepSelfieUrl",
    ],
    optionalFields: [],
  },
};

export function normalizeKycRole(role: string | null | undefined): KycRole | null {
  const normalized = String(role ?? "").trim().toUpperCase();
  return ROLE_ALIASES[normalized] ?? null;
}

export function getKycRequirements(roleRequested: string | null | undefined): KycRequirement | null {
  const role = normalizeKycRole(roleRequested);
  if (!role) return null;

  const requirement = REQUIREMENTS_BY_ROLE[role];
  return {
    roleRequested: role,
    kycType: requirement.kycType,
    kycLevel: requirement.kycLevel,
    requiredFields: [...requirement.requiredFields],
    optionalFields: [...requirement.optionalFields],
  };
}

function roleAcceptsPassportAsIdentity(role: KycRole): boolean {
  return role === "SELLER" || role === "COURIER" || role === "TIAK_COURIER";
}

function fieldValue(payload: Record<string, unknown>, key: KycFieldKey): string {
  const raw = payload[key];
  return typeof raw === "string" ? raw.trim() : "";
}

export function validateKycPayload(
  roleRequested: string | null | undefined,
  payload: Record<string, unknown>,
  context: ValidateContext = {}
): { requirement: KycRequirement; missingFields: KycFieldKey[] } {
  const requirement = getKycRequirements(roleRequested);
  if (!requirement) {
    throw new Error("INVALID_ROLE_REQUESTED");
  }

  const missingFields: KycFieldKey[] = [];

  const normalizedRole = normalizeKycRole(roleRequested);
  const passportAsIdentity = normalizedRole ? roleAcceptsPassportAsIdentity(normalizedRole) : false;

  for (const field of requirement.requiredFields) {
    if (field === "phoneVerified") {
      const hasPhone = Boolean(String(context.phone ?? "").trim());
      const verified = context.phoneVerified ?? hasPhone;
      if (!verified) {
        missingFields.push(field);
      }
      continue;
    }

    if (field === "docIdUrl" && passportAsIdentity) {
      const hasDocId = Boolean(fieldValue(payload, "docIdUrl"));
      const hasPassport = Boolean(fieldValue(payload, "passportUrl"));
      if (!hasDocId && !hasPassport) {
        missingFields.push("docIdUrl");
      }
      continue;
    }

    if (!fieldValue(payload, field)) {
      missingFields.push(field);
    }
  }

  return { requirement, missingFields };
}

export function mapKycRoleToUserRoleType(roleRequested: string | null | undefined): UserRoleType | null {
  const normalized = normalizeKycRole(roleRequested);
  if (!normalized) return null;

  if (normalized === "GP_CARRIER" || normalized === "TRANSPORTER") return "GP_CARRIER";
  if (normalized === "TIAK_COURIER" || normalized === "COURIER") return "TIAK_COURIER";
  if (normalized === "IMMO_AGENCY") return "IMMO_AGENT";
  if (normalized === "CAR_DEALER") return "SELLER";
  if (normalized === "SELLER") return "SELLER";
  return null;
}


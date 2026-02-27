import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  getKycRequirements,
  normalizeKycRole,
  validateKycPayload,
} from "@/lib/kyc/requirements";

function normalizeOptionalString(value: unknown, max = 2048): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized ? normalized.slice(0, max) : null;
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const roleRequestedRaw = String(
    (body as { roleRequested?: unknown; targetRole?: unknown }).roleRequested ??
      (body as { targetRole?: unknown }).targetRole ??
      ""
  );
  const roleRequested = normalizeKycRole(roleRequestedRaw);

  if (!roleRequested) {
    return NextResponse.json({ error: "Invalid roleRequested" }, { status: 400 });
  }

  const requirement = getKycRequirements(roleRequested);
  if (!requirement) {
    return NextResponse.json({ error: "Invalid roleRequested" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { phone: true },
  });

  const { missingFields } = validateKycPayload(
    roleRequested,
    body as Record<string, unknown>,
    { phone: user?.phone ?? null }
  );

  if (missingFields.length > 0) {
    return NextResponse.json(
      {
        error: "VALIDATION_ERROR",
        missingFields,
        requiredFields: requirement.requiredFields,
        optionalFields: requirement.optionalFields,
      },
      { status: 400 }
    );
  }

  const data = {
    userId: session.user.id,
    targetRole: roleRequested,
    kycType: requirement.kycType,
    kycLevel: requirement.kycLevel,
    docIdUrl: normalizeOptionalString((body as { docIdUrl?: unknown }).docIdUrl),
    passportUrl: normalizeOptionalString((body as { passportUrl?: unknown }).passportUrl),
    driverLicenseUrl: normalizeOptionalString((body as { driverLicenseUrl?: unknown }).driverLicenseUrl),
    proofTravelUrl: normalizeOptionalString((body as { proofTravelUrl?: unknown }).proofTravelUrl),
    proofAddressUrl: normalizeOptionalString((body as { proofAddressUrl?: unknown }).proofAddressUrl),
    selfieUrl: normalizeOptionalString((body as { selfieUrl?: unknown }).selfieUrl),
    businessRegistrationUrl: normalizeOptionalString(
      (body as { businessRegistrationUrl?: unknown }).businessRegistrationUrl
    ),
    companyName: normalizeOptionalString((body as { companyName?: unknown }).companyName, 160),
    companyAddress: normalizeOptionalString((body as { companyAddress?: unknown }).companyAddress, 260),
    companyRibUrl: normalizeOptionalString((body as { companyRibUrl?: unknown }).companyRibUrl),
    legalRepIdUrl: normalizeOptionalString((body as { legalRepIdUrl?: unknown }).legalRepIdUrl),
    legalRepSelfieUrl: normalizeOptionalString((body as { legalRepSelfieUrl?: unknown }).legalRepSelfieUrl),
    professionalLicenseUrl: normalizeOptionalString(
      (body as { professionalLicenseUrl?: unknown }).professionalLicenseUrl
    ),
    addressCity: normalizeOptionalString((body as { addressCity?: unknown }).addressCity, 120),
    addressCountry: normalizeOptionalString((body as { addressCountry?: unknown }).addressCountry, 120),
    notes: normalizeOptionalString((body as { notes?: unknown }).notes, 1200),
    status: "PENDING" as const,
    reviewedById: null,
    reviewedAt: null,
    reviewReason: null,
  };

  const existing = await prisma.kycSubmission.findFirst({
    where: {
      userId: session.user.id,
      targetRole: roleRequested,
    },
    orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
    select: { id: true },
  });

  const submission = existing
    ? await prisma.kycSubmission.update({
        where: { id: existing.id },
        data,
      })
    : await prisma.kycSubmission.create({
        data,
      });

  await prisma.activityLog.create({
    data: {
      userId: session.user.id,
      action: "KYC_SUBMITTED",
      entityType: "KycSubmission",
      entityId: submission.id,
      metadata: { targetRole: roleRequested, kycType: requirement.kycType, kycLevel: requirement.kycLevel },
    },
  });

  return NextResponse.json(
    {
      id: submission.id,
      status: submission.status,
      targetRole: submission.targetRole,
      kycType: submission.kycType,
      kycLevel: submission.kycLevel,
      requiredFields: requirement.requiredFields,
      optionalFields: requirement.optionalFields,
    },
    { status: 201 }
  );
}

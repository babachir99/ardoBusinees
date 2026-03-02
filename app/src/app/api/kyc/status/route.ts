import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { normalizeKycRole } from "@/lib/kyc/requirements";

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const roleParam = searchParams.get("role");
  const requestedRole = normalizeKycRole(roleParam);

  if (roleParam && !requestedRole) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }

  const submission = await prisma.kycSubmission.findFirst({
    where: {
      userId: session.user.id,
      ...(requestedRole ? { targetRole: requestedRole } : {}),
    },
    orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      targetRole: true,
      kycType: true,
      kycLevel: true,
      status: true,
      docIdUrl: true,
      passportUrl: true,
      driverLicenseUrl: true,
      proofTravelUrl: true,
      proofAddressUrl: true,
      selfieUrl: true,
      businessRegistrationUrl: true,
      companyName: true,
      companyAddress: true,
      companyRibUrl: true,
      legalRepIdUrl: true,
      legalRepSelfieUrl: true,
      professionalLicenseUrl: true,
      addressCity: true,
      addressCountry: true,
      notes: true,
    },
  });

  return NextResponse.json(submission ?? { status: null, targetRole: requestedRole ?? null });
}

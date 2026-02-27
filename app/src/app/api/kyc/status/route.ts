import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const submission = await prisma.kycSubmission.findFirst({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
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

  return NextResponse.json(submission ?? { status: null });
}

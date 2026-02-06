import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { KycRole } from "@prisma/client";

const allowedRoles = new Set(["SELLER", "TRANSPORTER", "COURIER"]);

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const targetRole = String(body?.targetRole ?? "").toUpperCase();
  if (!allowedRoles.has(targetRole)) {
    return NextResponse.json({ error: "Invalid targetRole" }, { status: 400 });
  }
  const typedTargetRole = targetRole as KycRole;

  const submission = await prisma.kycSubmission.create({
    data: {
      userId: session.user.id,
      targetRole: typedTargetRole,
      docIdUrl: body?.docIdUrl ?? undefined,
      driverLicenseUrl: body?.driverLicenseUrl ?? undefined,
      proofAddressUrl: body?.proofAddressUrl ?? undefined,
      selfieUrl: body?.selfieUrl ?? undefined,
      notes: body?.notes ?? undefined,
    },
  });

  await prisma.activityLog.create({
    data: {
      userId: session.user.id,
      action: "KYC_SUBMITTED",
      entityType: "KycSubmission",
      entityId: submission.id,
      metadata: { targetRole: typedTargetRole },
    },
  });

  return NextResponse.json(submission, { status: 201 });
}

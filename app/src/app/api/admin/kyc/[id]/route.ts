import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { KycStatus } from "@prisma/client";
import { mapKycRoleToUserRoleType, normalizeKycRole } from "@/lib/kyc/requirements";
import { mapUserRoleTypeToLegacyRole } from "@/lib/userRoles";

const allowedStatus = new Set(["APPROVED", "REJECTED"]);

function normalizeReason(value: unknown) {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized ? normalized.slice(0, 1200) : null;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const status = String(body?.status ?? "").toUpperCase();
  if (!allowedStatus.has(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const reviewReason = normalizeReason(body?.reviewReason);
  const typedStatus = status as KycStatus;

  const submission = await prisma.kycSubmission.update({
    where: { id },
    data: {
      status: typedStatus,
      reviewedById: session.user.id,
      reviewedAt: new Date(),
      reviewReason,
    },
    include: {
      user: true,
      reviewedBy: {
        select: { id: true, name: true, email: true },
      },
    },
  });

  if (typedStatus === "APPROVED") {
    const normalizedTargetRole = normalizeKycRole(submission.targetRole);
    const assignmentRole = mapKycRoleToUserRoleType(normalizedTargetRole);

    if (assignmentRole) {
      await prisma.userRoleAssignment
        .upsert({
          where: {
            userId_role: {
              userId: submission.userId,
              role: assignmentRole,
            },
          },
          update: { status: "ACTIVE" },
          create: {
            userId: submission.userId,
            role: assignmentRole,
            status: "ACTIVE",
          },
        })
        .catch(() => null);
    }

    await prisma.user.update({
      where: { id: submission.userId },
      data: {
        ...(assignmentRole ? { role: mapUserRoleTypeToLegacyRole(assignmentRole) } : {}),
        activityLogs: {
          create: [
            {
              action: "KYC_APPROVED",
              entityType: "KycSubmission",
              entityId: submission.id,
              metadata: {
                reviewedById: session.user.id,
                reviewReason,
                targetRole: submission.targetRole,
                assignedRole: assignmentRole,
              },
            },
          ],
        },
      },
    });
  } else {
    await prisma.activityLog.create({
      data: {
        userId: submission.userId,
        action: "KYC_REJECTED",
        entityType: "KycSubmission",
        entityId: submission.id,
        metadata: {
          reviewedById: session.user.id,
          reviewReason,
          targetRole: submission.targetRole,
        },
      },
    });
  }

  return NextResponse.json(submission);
}

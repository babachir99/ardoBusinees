import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const allowedStatus = new Set(["APPROVED", "REJECTED"]);

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

  const submission = await prisma.kycSubmission.update({
    where: { id },
    data: { status },
    include: { user: true },
  });

  if (status === "APPROVED") {
    await prisma.user.update({
      where: { id: submission.userId },
      data: {
        role: submission.targetRole,
        activityLogs: {
          create: [
            {
              action: "KYC_APPROVED",
              entityType: "KycSubmission",
              entityId: submission.id,
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
      },
    });
  }

  return NextResponse.json(submission);
}

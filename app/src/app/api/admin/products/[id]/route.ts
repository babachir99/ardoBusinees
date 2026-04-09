import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  deleteProductSafely,
  PRODUCT_DELETE_CONFLICT_MESSAGE,
} from "@/lib/product-delete";
import {
  getActiveProductReportCount,
} from "@/lib/productReports";
import { PRODUCT_REPORT_AUTO_HIDE_THRESHOLD } from "@/lib/productReports.shared";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { id } = await params;
  const data: Record<string, unknown> = {};
  if (typeof body.isActive === "boolean") {
    if (body.isActive === true) {
      const activeReportCount = await getActiveProductReportCount(id);
      if (activeReportCount >= PRODUCT_REPORT_AUTO_HIDE_THRESHOLD) {
        return NextResponse.json(
          {
            error: "ACTIVE_REPORT_THRESHOLD_REACHED",
            message: `Listing cannot be reactivated while it still has ${activeReportCount} active reports.`,
            activeReportCount,
            threshold: PRODUCT_REPORT_AUTO_HIDE_THRESHOLD,
          },
          { status: 409 }
        );
      }
    }
    data.isActive = body.isActive;
  }

  if (body.boostStatus) {
    const status = String(body.boostStatus).toUpperCase();
    if (!["NONE", "PENDING", "APPROVED", "REJECTED"].includes(status)) {
      return NextResponse.json(
        { error: "boostStatus must be NONE, PENDING, APPROVED, or REJECTED" },
        { status: 400 }
      );
    }
    data.boostStatus = status;
    if (status === "APPROVED") {
      const boostedUntil = body.boostedUntil
        ? new Date(body.boostedUntil)
        : new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
      if (Number.isNaN(boostedUntil.getTime())) {
        return NextResponse.json(
          { error: "boostedUntil must be a valid date" },
          { status: 400 }
        );
      }
      data.boostedUntil = boostedUntil;
    }
    if (status === "REJECTED" || status === "NONE") {
      data.boostedUntil = null;
    }
    if (status === "NONE") {
      data.boostRequestedAt = null;
    }
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json(
      { error: "No updates provided" },
      { status: 400 }
    );
  }

  const product = await prisma.product.update({
    where: { id },
    data,
  });

  return NextResponse.json(product);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const existing = await prisma.product.findUnique({
    where: { id },
    select: { id: true },
  });

  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const result = await deleteProductSafely(existing.id);

  if (!result.ok) {
    return NextResponse.json(
      { error: PRODUCT_DELETE_CONFLICT_MESSAGE },
      { status: 409 }
    );
  }

  return NextResponse.json({ ok: true });
}

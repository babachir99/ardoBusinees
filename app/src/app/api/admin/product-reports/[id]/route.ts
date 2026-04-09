import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  PRODUCT_REPORT_STATUSES,
  type ProductReportStatus,
  updateProductReportReview,
} from "@/lib/productReports";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = (await request.json().catch(() => null)) as
    | {
        status?: string;
        adminNote?: string;
      }
    | null;

  const nextStatus =
    body?.status && PRODUCT_REPORT_STATUSES.includes(body.status as ProductReportStatus)
      ? (body.status as ProductReportStatus)
      : undefined;

  const updated = await updateProductReportReview({
    reportId: id,
    adminId: session.user.id,
    status: nextStatus,
    adminNote: body?.adminNote,
  });

  if (!updated) {
    return NextResponse.json({ error: "Report not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, metadata: updated });
}

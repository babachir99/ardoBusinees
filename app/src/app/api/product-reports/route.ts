import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { assertActionRateLimit } from "@/lib/action-rate-limit";
import {
  createProductReport,
  PRODUCT_REPORT_REASONS,
  type ProductReportReason,
} from "@/lib/productReports";

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as
    | {
        productId?: string;
        reason?: string;
        description?: string;
      }
    | null;

  const productId = body?.productId?.trim();
  const reason = body?.reason?.trim();
  const description = body?.description?.trim() ?? "";

  if (!productId || !reason || !PRODUCT_REPORT_REASONS.includes(reason as ProductReportReason)) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const rateLimited = await assertActionRateLimit(request, {
    routeKey: "product-report",
    label: "reports",
    windowMs: 60 * 60 * 1000,
    ipLimit: 30,
    scopes: [
      { prefix: "user", id: session.user.id, limit: 12 },
      { prefix: "product-user", id: `${session.user.id}:${productId}`, limit: 2 },
    ],
  });
  if (rateLimited) {
    return rateLimited;
  }

  const result = await createProductReport({
    userId: session.user.id,
    productId,
    reason: reason as ProductReportReason,
    description,
  });

  if (!result.ok) {
    if (result.code === "PRODUCT_NOT_FOUND") {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    if (result.code === "SELF_REPORT_BLOCKED") {
      return NextResponse.json(
        { error: "You cannot report your own listing", code: result.code },
        { status: 400 }
      );
    }

    if (result.code === "DUPLICATE_ACTIVE_REPORT") {
      return NextResponse.json(
        { error: "An active report already exists for this listing", code: result.code },
        { status: 409 }
      );
    }

    return NextResponse.json({ error: "Unable to submit report" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, reportId: result.reportId });
}

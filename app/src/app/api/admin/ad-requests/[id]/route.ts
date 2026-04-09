import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { reviewAdRequest } from "@/lib/adRequests";
import { hasUserRole } from "@/lib/userRoles";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !hasUserRole(session.user, "ADMIN")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const body = await request.json().catch(() => null);
  const rawStatus = typeof body?.status === "string" ? body.status.toUpperCase() : "";

  if (rawStatus !== "APPROVED" && rawStatus !== "REJECTED") {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  try {
    const reviewed = await reviewAdRequest({
      requestId: id,
      status: rawStatus,
      adminNote: typeof body?.adminNote === "string" ? body.adminNote : null,
      reviewer: {
        id: session.user.id,
        name: session.user.name ?? null,
        email: session.user.email ?? null,
      },
    });

    return NextResponse.json({ ok: true, request: reviewed });
  } catch (error) {
    if (error instanceof Error && error.message === "AD_REQUEST_NOT_FOUND") {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ error: "Unable to review ad request" }, { status: 500 });
  }
}

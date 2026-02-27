import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getContactTemplate } from "@/lib/notifications/contact-template";

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ ok: false, code: "NO_SESSION" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const vertical = searchParams.get("vertical");

  const template = await getContactTemplate({
    vertical,
    context: {
      listingTitle: searchParams.get("listingTitle") ?? undefined,
      productTitle: searchParams.get("productTitle") ?? undefined,
      serviceTitle: searchParams.get("serviceTitle") ?? undefined,
      orderRef: searchParams.get("orderRef") ?? undefined,
      proposedDates: searchParams.get("proposedDates") ?? undefined,
      phoneOptional: searchParams.get("phoneOptional") ?? undefined,
    },
  });

  return NextResponse.json({
    ok: true,
    code: "MESSAGE_TEMPLATE",
    template,
  });
}

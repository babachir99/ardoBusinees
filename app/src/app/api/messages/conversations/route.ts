import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  listMessageConversations,
  parseConversationTake,
} from "@/lib/messages/conversations";

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "UNAUTHORIZED", message: "Authentication required." }, { status: 401 });
  }

  const locale = request.nextUrl.searchParams.get("locale") === "fr" ? "fr" : "en";
  const take = parseConversationTake(request.nextUrl.searchParams.get("take") ?? undefined);
  const shopCursor = request.nextUrl.searchParams.get("shopCursor");
  const tiakCursor = request.nextUrl.searchParams.get("tiakCursor");
  const gpCursor = request.nextUrl.searchParams.get("gpCursor");

  const sellerProfile = await prisma.sellerProfile.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });

  const payload = await listMessageConversations({
    userId: session.user.id,
    sellerProfileId: sellerProfile?.id ?? null,
    locale,
    take,
    shopCursor,
    tiakCursor,
    gpCursor,
  });

  return NextResponse.json(payload);
}

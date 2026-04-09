import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasUserRole } from "@/lib/userRoles";
import {
  getHomePromoEntries,
  persistHomePromoEntries,
  resolveHomePromoEntries,
} from "@/lib/homePromos";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !hasUserRole(session.user, "ADMIN")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const config = await getHomePromoEntries();
  return NextResponse.json(config);
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !hasUserRole(session.user, "ADMIN")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const entries = resolveHomePromoEntries(body?.promos);
  const config = await persistHomePromoEntries(entries, session.user.id);
  return NextResponse.json(config);
}

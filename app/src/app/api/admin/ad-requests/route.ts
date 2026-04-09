import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getAdRequests } from "@/lib/adRequests";
import { hasUserRole } from "@/lib/userRoles";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !hasUserRole(session.user, "ADMIN")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const requests = await getAdRequests();
  return NextResponse.json({ requests });
}

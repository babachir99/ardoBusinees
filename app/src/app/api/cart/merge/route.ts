import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { CartError, mergeCartForUser } from "@/lib/cart-server";

async function resolveSessionUserId() {
  const session = await getServerSession(authOptions);
  return session?.user?.id;
}

function toErrorResponse(error: unknown) {
  if (error instanceof CartError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }

  return NextResponse.json({ error: "Cart merge failed" }, { status: 500 });
}

export async function POST(request: NextRequest) {
  const userId = await resolveSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!body || !Array.isArray(body.items)) {
    return NextResponse.json({ error: "items array is required" }, { status: 400 });
  }

  try {
    const items = await mergeCartForUser(userId, body.items);
    return NextResponse.json({ items });
  } catch (error) {
    return toErrorResponse(error);
  }
}

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  CartError,
  removeCartItemForUser,
  updateCartItemQuantityForUser,
} from "@/lib/cart-server";

async function resolveSessionUserId() {
  const session = await getServerSession(authOptions);
  return session?.user?.id;
}

function toErrorResponse(error: unknown) {
  if (error instanceof CartError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }

  return NextResponse.json({ error: "Cart request failed" }, { status: 500 });
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ lineId: string }> }
) {
  const userId = await resolveSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const params = await context.params;
  const lineId = String(params?.lineId ?? "");
  const quantity = Number(body.quantity ?? 0);

  if (!lineId) {
    return NextResponse.json({ error: "lineId is required" }, { status: 400 });
  }

  try {
    const items = await updateCartItemQuantityForUser(userId, lineId, quantity);
    return NextResponse.json({ items });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ lineId: string }> }
) {
  const userId = await resolveSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const params = await context.params;
  const lineId = String(params?.lineId ?? "");

  if (!lineId) {
    return NextResponse.json({ error: "lineId is required" }, { status: 400 });
  }

  try {
    const items = await removeCartItemForUser(userId, lineId);
    return NextResponse.json({ items });
  } catch (error) {
    return toErrorResponse(error);
  }
}

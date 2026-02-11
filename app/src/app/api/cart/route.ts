import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  CartError,
  addCartItemForUser,
  clearCartForUser,
  getCartItemsForUser,
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

export async function GET() {
  const userId = await resolveSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const items = await getCartItemsForUser(userId);
    return NextResponse.json({ items });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  const userId = await resolveSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  try {
    const items = await addCartItemForUser(userId, {
      productId: String(body.productId ?? ""),
      quantity: Number(body.quantity ?? 1),
      optionColor: body.optionColor,
      optionSize: body.optionSize,
      offerId: body.offerId,
    });
    return NextResponse.json({ items });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function DELETE() {
  const userId = await resolveSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const items = await clearCartForUser(userId);
    return NextResponse.json({ items });
  } catch (error) {
    return toErrorResponse(error);
  }
}

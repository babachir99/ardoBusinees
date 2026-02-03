import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const allowedTypes = new Set(["PREORDER", "DROPSHIP"]);

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const product = await prisma.product.findUnique({
    where: { id: params.id },
    include: {
      images: true,
      seller: {
        select: { id: true, displayName: true, slug: true },
      },
    },
  });

  if (!product) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(product);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const body = await request.json().catch(() => null);

  if (!body) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const data: Record<string, unknown> = {};

  if (body.title) data.title = String(body.title);
  if (body.slug) data.slug = String(body.slug);
  if (body.description !== undefined) data.description = body.description;
  if (body.priceCents !== undefined) data.priceCents = Number(body.priceCents);
  if (body.currency) data.currency = String(body.currency);
  if (body.preorderLeadDays !== undefined) {
    data.preorderLeadDays = body.preorderLeadDays;
  }
  if (body.dropshipSupplier !== undefined) {
    data.dropshipSupplier = body.dropshipSupplier;
  }
  if (body.isActive !== undefined) data.isActive = Boolean(body.isActive);
  if (body.type) {
    const type = String(body.type).toUpperCase();
    if (!allowedTypes.has(type)) {
      return NextResponse.json(
        { error: "type must be PREORDER or DROPSHIP" },
        { status: 400 }
      );
    }
    data.type = type;
  }

  const product = await prisma.product.update({
    where: { id: params.id },
    data,
  });

  return NextResponse.json(product);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  await prisma.product.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}

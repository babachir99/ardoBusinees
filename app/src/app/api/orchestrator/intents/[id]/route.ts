import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasUserRole } from "@/lib/userRoles";

function errorResponse(status: number, error: string, message: string) {
  return NextResponse.json({ error, message }, { status });
}

function serializeIntent(intent: {
  id: string;
  sourceVertical: string;
  sourceEntityId: string;
  intentType: string;
  objectType: string;
  weightKg: number | null;
  fromCountry: string | null;
  toCountry: string | null;
  fromCity: string | null;
  toCity: string | null;
  status: string;
  createdByUserId: string;
  createdAt: Date;
}) {
  return {
    ...intent,
    createdAt: intent.createdAt.toISOString(),
  };
}

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return errorResponse(401, "UNAUTHORIZED", "Authentication required.");
  }

  const { id } = await context.params;
  const intent = await prisma.crossVerticalIntent.findUnique({
    where: { id },
    select: {
      id: true,
      sourceVertical: true,
      sourceEntityId: true,
      intentType: true,
      objectType: true,
      weightKg: true,
      fromCountry: true,
      toCountry: true,
      fromCity: true,
      toCity: true,
      status: true,
      createdByUserId: true,
      createdAt: true,
    },
  });

  if (!intent) {
    return errorResponse(404, "NOT_FOUND", "Intent not found.");
  }

  const isAdmin = hasUserRole(session.user, "ADMIN");
  if (!isAdmin && intent.createdByUserId !== session.user.id) {
    return errorResponse(403, "FORBIDDEN", "Access denied.");
  }

  return NextResponse.json({ intent: serializeIntent(intent) });
}

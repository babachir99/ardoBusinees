import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getUserRoles, normalizeRole } from "@/lib/userRoles";
import { assertSameOrigin } from "@/lib/request-security";

type SessionUserLike = {
  id?: string | null;
  email?: string | null;
  name?: string | null;
  image?: string | null;
  role?: string | null;
  roles?: readonly string[] | null;
};

function deriveRolesFromSession(user: SessionUserLike): string[] {
  const unique = new Set<string>();

  const directRole = normalizeRole(user.role ?? null);
  if (directRole) unique.add(directRole);

  if (Array.isArray(user.roles)) {
    for (const role of user.roles) {
      const normalized = normalizeRole(role);
      if (normalized) unique.add(normalized);
    }
  }

  if (unique.size === 0) {
    unique.add("CLIENT");
  }

  return Array.from(unique);
}

function buildSessionFallbackProfile(user: SessionUserLike) {
  return {
    id: user.id ?? "",
    email: user.email ?? "",
    name: user.name ?? null,
    image: user.image ?? null,
    phone: null,
    role: user.role ?? "CUSTOMER",
    roles: deriveRolesFromSession(user),
    createdAt: new Date().toISOString(),
    degraded: true,
  };
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        email: true,
        name: true,
        image: true,
        phone: true,
        role: true,
        createdAt: true,
      },
    });

    if (!user) {
      return NextResponse.json(buildSessionFallbackProfile(session.user));
    }

    const roles = await getUserRoles(user.id).catch(() => deriveRolesFromSession(session.user));
    return NextResponse.json({
      ...user,
      roles,
    });
  } catch {
    return NextResponse.json(buildSessionFallbackProfile(session.user));
  }
}

export async function PUT(request: NextRequest) {
  const csrfBlocked = assertSameOrigin(request);
  if (csrfBlocked) return csrfBlocked;
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const name = body.name ? String(body.name) : undefined;
  const phone = body.phone ? String(body.phone) : undefined;
  const image = body.image ? String(body.image) : undefined;

  try {
    const user = await prisma.user.update({
      where: { id: session.user.id },
      data: {
        name,
        phone,
        image,
        activityLogs: {
          create: [{ action: "PROFILE_UPDATED" }],
        },
      },
      select: {
        id: true,
        email: true,
        name: true,
        image: true,
        phone: true,
        role: true,
        createdAt: true,
      },
    });

    const roles = await getUserRoles(user.id).catch(() => deriveRolesFromSession(session.user));
    return NextResponse.json({
      ...user,
      roles,
    });
  } catch {
    return NextResponse.json(
      { error: "PROFILE_UPDATE_FAILED" },
      { status: 503 }
    );
  }
}

import { prisma } from "@/lib/prisma";
import { UserRole, UserRoleType } from "@prisma/client";

type SessionRoleLike = {
  role?: string | null;
  roles?: readonly string[] | null;
};

const USER_ROLE_PRIORITY: UserRoleType[] = [
  "ADMIN",
  "SELLER",
  "PRESTA_PROVIDER",
  "GP_CARRIER",
  "TIAK_COURIER",
  "IMMO_AGENT",
  "CLIENT",
];

export function mapLegacyRoleToUserRoleType(role: UserRole | string | null | undefined): UserRoleType {
  switch (role) {
    case "ADMIN":
      return "ADMIN";
    case "SELLER":
      return "SELLER";
    case "TRANSPORTER":
      return "GP_CARRIER";
    case "COURIER":
      return "TIAK_COURIER";
    case "CUSTOMER":
    default:
      return "CLIENT";
  }
}

export function mapUserRoleTypeToLegacyRole(role: UserRoleType): UserRole {
  switch (role) {
    case "ADMIN":
      return "ADMIN";
    case "SELLER":
    case "PRESTA_PROVIDER":
    case "IMMO_AGENT":
      return "SELLER";
    case "GP_CARRIER":
      return "TRANSPORTER";
    case "TIAK_COURIER":
      return "COURIER";
    case "CLIENT":
    default:
      return "CUSTOMER";
  }
}

export function normalizeRole(role: string | null | undefined): UserRoleType | null {
  if (!role) return null;
  switch (role) {
    case "ADMIN":
      return "ADMIN";
    case "SELLER":
      return "SELLER";
    case "PRESTA_PROVIDER":
      return "PRESTA_PROVIDER";
    case "GP_CARRIER":
    case "TRANSPORTER":
      return "GP_CARRIER";
    case "TIAK_COURIER":
    case "COURIER":
      return "TIAK_COURIER";
    case "IMMO_AGENT":
      return "IMMO_AGENT";
    case "CLIENT":
    case "CUSTOMER":
      return "CLIENT";
    default:
      return null;
  }
}

export async function getUserRoles(userId: string): Promise<UserRoleType[]> {
  if (!userId) return ["CLIENT"];

  const runtimePrisma = prisma as unknown as {
    userRoleAssignment?: {
      findMany: (args: {
        where: { userId: string; status: "ACTIVE" };
        select: { role: true };
      }) => Promise<Array<{ role: UserRoleType }>>;
    };
  };

  const roleRowsPromise = runtimePrisma.userRoleAssignment?.findMany
    ? runtimePrisma.userRoleAssignment
        .findMany({
          where: {
            userId,
            status: "ACTIVE",
          },
          select: { role: true },
        })
        .catch(() => [])
    : Promise.resolve<Array<{ role: UserRoleType }>>([]);

  const [roleRows, user] = await Promise.all([
    roleRowsPromise,
    prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    }),
  ]);

  const unique = new Set<UserRoleType>();

  for (const row of roleRows) {
    unique.add(row.role);
  }

  if (user?.role) {
    unique.add(mapLegacyRoleToUserRoleType(user.role));
  }

  if (unique.size === 0) {
    unique.add("CLIENT");
  }

  return USER_ROLE_PRIORITY.filter((role) => unique.has(role));
}

export function hasUserRole(user: SessionRoleLike | null | undefined, role: string): boolean {
  if (!user) return false;

  const required = normalizeRole(role);
  if (!required) return false;

  const direct = normalizeRole(user.role ?? null);
  if (direct === required) return true;

  const roleList = Array.isArray(user.roles) ? user.roles : [];
  return roleList.some((item) => normalizeRole(item) === required);
}

export function hasAnyUserRole(user: SessionRoleLike | null | undefined, roles: readonly string[]): boolean {
  return roles.some((role) => hasUserRole(user, role));
}

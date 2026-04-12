import { Prisma, UserRole, UserRoleStatus, UserRoleType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { sha256Hex } from "@/lib/request-security";
import { getUserRoles, mapLegacyRoleToUserRoleType } from "@/lib/userRoles";

const MIN_PASSWORD_LENGTH = 10;
const MAX_PASSWORD_LENGTH = 128;
const SELLER_FAMILY_ROLES = new Set<UserRoleType>([
  "SELLER",
  "PRESTA_PROVIDER",
  "IMMO_AGENT",
]);

type SecurityStampInput = {
  passwordHash: string | null;
  role: UserRole | string;
  isActive: boolean;
  roles: readonly string[];
};

type SecurityUser = {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  emailVerified: Date | null;
  passwordHash: string | null;
  role: UserRole;
  isActive: boolean;
};

export function getMinPasswordLength() {
  return MIN_PASSWORD_LENGTH;
}

export function validatePassword(password: string) {
  const normalized = String(password ?? "");

  if (normalized.length < MIN_PASSWORD_LENGTH) {
    return {
      code: "PASSWORD_TOO_SHORT",
      message: `Password must contain at least ${MIN_PASSWORD_LENGTH} characters.`,
    };
  }

  if (normalized.length > MAX_PASSWORD_LENGTH) {
    return {
      code: "PASSWORD_TOO_LONG",
      message: `Password must contain at most ${MAX_PASSWORD_LENGTH} characters.`,
    };
  }

  return null;
}

export function buildUserSecurityStamp(input: SecurityStampInput) {
  const roles = Array.from(new Set(input.roles.map((role) => String(role)))).sort();

  return sha256Hex(
    JSON.stringify({
      passwordHash: input.passwordHash ?? null,
      role: String(input.role ?? ""),
      isActive: input.isActive === true,
      roles,
    })
  );
}

async function resolveUserSecurityState(user: SecurityUser | null) {
  if (!user) {
    return null;
  }

  const roles = await getUserRoles(user.id);

  return {
    user,
    roles,
    securityStamp: buildUserSecurityStamp({
      passwordHash: user.passwordHash,
      role: user.role,
      isActive: user.isActive,
      roles,
    }),
  };
}

export async function getUserSecurityState(userId: string) {
  if (!userId) {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      image: true,
      emailVerified: true,
      passwordHash: true,
      role: true,
      isActive: true,
    },
  });

  return resolveUserSecurityState(user);
}

export async function getUserSecurityStateByEmail(email: string) {
  const normalizedEmail = String(email ?? "").trim().toLowerCase();
  if (!normalizedEmail) {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    select: {
      id: true,
      email: true,
      name: true,
      image: true,
      emailVerified: true,
      passwordHash: true,
      role: true,
      isActive: true,
    },
  });

  return resolveUserSecurityState(user);
}

function getDesiredAssignmentRoles(
  legacyRole: UserRole,
  existingRoles: readonly UserRoleType[]
) {
  switch (legacyRole) {
    case "ADMIN":
      return new Set<UserRoleType>(["ADMIN"]);
    case "TRANSPORTER":
      return new Set<UserRoleType>(["GP_CARRIER"]);
    case "COURIER":
      return new Set<UserRoleType>(["TIAK_COURIER"]);
    case "SELLER": {
      const sellerFamily = existingRoles.filter((role) => SELLER_FAMILY_ROLES.has(role));
      return new Set<UserRoleType>(sellerFamily.length > 0 ? sellerFamily : ["SELLER"]);
    }
    case "CUSTOMER":
    default:
      return new Set<UserRoleType>([mapLegacyRoleToUserRoleType("CUSTOMER")]);
  }
}

export async function syncUserLegacyRoleAssignments(
  tx: Prisma.TransactionClient,
  userId: string,
  legacyRole: UserRole
) {
  const assignments = await tx.userRoleAssignment.findMany({
    where: { userId },
    select: { id: true, role: true, status: true },
  });

  const desiredRoles = getDesiredAssignmentRoles(
    legacyRole,
    assignments
      .filter((assignment) => assignment.status === UserRoleStatus.ACTIVE)
      .map((assignment) => assignment.role)
  );

  for (const assignment of assignments) {
    const shouldBeActive = desiredRoles.has(assignment.role);
    const nextStatus = shouldBeActive ? UserRoleStatus.ACTIVE : UserRoleStatus.SUSPENDED;

    if (assignment.status !== nextStatus) {
      await tx.userRoleAssignment.update({
        where: { id: assignment.id },
        data: { status: nextStatus },
      });
    }
  }

  for (const role of desiredRoles) {
    const existing = assignments.find((assignment) => assignment.role === role);
    if (existing) {
      continue;
    }

    await tx.userRoleAssignment.create({
      data: {
        userId,
        role,
        status: UserRoleStatus.ACTIVE,
      },
    });
  }
}

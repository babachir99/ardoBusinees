import { PrismaAdapter } from "@next-auth/prisma-adapter";
import type { NextAuthOptions } from "next-auth";
import type { JWT } from "next-auth/jwt";
import Credentials from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import { compare } from "bcryptjs";
import { prisma } from "@/lib/prisma";
import {
  getUserSecurityState,
  getUserSecurityStateByEmail,
} from "@/lib/account-security";
import {
  mapLegacyRoleToUserRoleType,
  mapUserRoleTypeToLegacyRole,
  normalizeRole,
} from "@/lib/userRoles";

const providers = [];

function parseAuthSessionInvalidateBefore(raw: string | undefined) {
  const value = String(raw ?? "").trim();
  if (!value) return null;

  if (/^\d+$/.test(value)) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric <= 0) return null;
    return numeric < 1_000_000_000_000 ? numeric * 1000 : numeric;
  }

  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

const authSessionInvalidateBefore = parseAuthSessionInvalidateBefore(
  process.env.AUTH_SESSION_INVALIDATE_BEFORE
);

function isSessionTokenMarkedStale(
  token: JWT,
  user?: {
    id?: string;
  } | null
) {
  if (!authSessionInvalidateBefore) {
    return false;
  }

  const issuedAtMs = user
    ? Date.now()
    : typeof token.iat === "number"
      ? token.iat * 1000
      : null;

  return typeof issuedAtMs === "number" && issuedAtMs < authSessionInvalidateBefore;
}

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  providers.push(
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    })
  );
}

providers.push(
  Credentials({
    name: "Credentials",
    credentials: {
      email: { label: "Email", type: "email" },
      password: { label: "Password", type: "password" },
    },
    async authorize(credentials) {
      const email = credentials?.email?.toLowerCase().trim();
      const password = credentials?.password;
      if (!email || !password) {
        return null;
      }
      const securityState = await getUserSecurityStateByEmail(email);
      if (!securityState) {
        return null;
      }
      const user = securityState.user;
      if (!user.passwordHash || !user.emailVerified || !user.isActive) {
        return null;
      }
      const ok = await compare(password, user.passwordHash);
      if (!ok) return null;
      return {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        roles: securityState.roles,
        image: user.image,
        emailVerified: user.emailVerified,
        securityStamp: securityState.securityStamp,
      };
    },
  })
);

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers,
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as { role?: string }).role ?? "CUSTOMER";
        token.roles = (user as { roles?: string[] }).roles ?? [];
        token.image = (user as { image?: string | null }).image ?? null;
        token.name = user.name ?? token.name;
        token.securityStamp =
          (user as { securityStamp?: string }).securityStamp ?? token.securityStamp;
      }

      let securityInvalidated = false;
      const tokenUserId = typeof token.id === "string" && token.id.trim() ? token.id : null;
      if (tokenUserId) {
        const securityState = await getUserSecurityState(tokenUserId);

        if (!securityState?.user.isActive) {
          securityInvalidated = true;
        } else {
          token.roles = securityState.roles;
          token.image = securityState.user.image ?? null;
          token.name = securityState.user.name ?? token.name ?? null;

          if (securityState.roles.includes("ADMIN")) {
            token.role = "ADMIN";
          } else {
            token.role = securityState.user.role;
            if (!token.role && securityState.roles.length > 0) {
              const normalized = normalizeRole(securityState.roles[0]);
              token.role = mapUserRoleTypeToLegacyRole(normalized ?? "CLIENT");
            }
          }

          const previousSecurityStamp =
            typeof token.securityStamp === "string" ? token.securityStamp : null;
          if (!previousSecurityStamp && !user) {
            securityInvalidated = true;
          } else if (
            previousSecurityStamp &&
            previousSecurityStamp !== securityState.securityStamp
          ) {
            securityInvalidated = true;
          }
          token.securityStamp = securityState.securityStamp;
        }
      }

      if (!token.role) {
        token.role = "CUSTOMER";
      }

      token.authInvalidated =
        securityInvalidated ||
        isSessionTokenMarkedStale(token, user as { id?: string } | null | undefined);

      if (token.authInvalidated) {
        token.id = "";
        token.role = undefined;
        token.roles = [];
      }

      return token;
    },
    async session({ session, token }) {
      session.authInvalidated = token.authInvalidated === true;
      if (session.user) {
        session.user.id = typeof token.id === "string" ? token.id : "";
        session.user.role = (token.role as string) ?? "CUSTOMER";
        session.user.roles = Array.isArray(token.roles)
          ? token.roles.map((role) => String(role))
          : [];
        if (token.image) session.user.image = token.image as string;
        if (token.name) session.user.name = token.name as string;
      }
      return session;
    },
    async signIn() {
      return true;
    },
  },
  events: {
    async createUser({ user }) {
      const roleType = mapLegacyRoleToUserRoleType(user.role);

      await prisma.userRoleAssignment
        .upsert({
          where: {
            userId_role: {
              userId: user.id,
              role: roleType,
            },
          },
          update: { status: "ACTIVE" },
          create: {
            userId: user.id,
            role: roleType,
            status: "ACTIVE",
          },
        })
        .catch(() => null);

      await prisma.notificationPreference
        .upsert({
          where: { userId: user.id },
          update: {},
          create: {
            userId: user.id,
            transactionalEmailEnabled: true,
            marketingEmailEnabled: false,
            priceDropEmailEnabled: false,
            dealsEmailEnabled: false,
            messageAutoEnabled: true,
          },
        })
        .catch(() => null);

      await prisma.activityLog.create({
        data: {
          userId: user.id,
          action: "USER_CREATED",
          metadata: { method: "auth" },
        },
      });
    },
    async signIn({ user }) {
      if (!user?.id) return;
      await prisma.activityLog.create({
        data: {
          userId: user.id,
          action: "USER_SIGNIN",
          metadata: { method: "auth" },
        },
      });
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};

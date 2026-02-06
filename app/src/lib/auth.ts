import { PrismaAdapter } from "@next-auth/prisma-adapter";
import type { NextAuthOptions } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import { compare } from "bcryptjs";
import { prisma } from "@/lib/prisma";

const providers = [];

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
        const user = await prisma.user.findUnique({
          where: { email },
        });
        if (!user?.passwordHash || !user.emailVerified) {
          return null;
        }
        const ok = await compare(password, user.passwordHash);
        if (!ok) return null;
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          image: user.image,
          emailVerified: user.emailVerified,
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
        token.image = (user as { image?: string | null }).image ?? null;
        token.name = user.name ?? token.name;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = (token.role as string) ?? "CUSTOMER";
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

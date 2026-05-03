import { PrismaAdapter } from "@next-auth/prisma-adapter";
import bcrypt from "bcryptjs";
import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import { prisma } from "@/lib/prisma";

async function safeGetUsername(userId: string | undefined | null): Promise<string | null> {
  if (!userId) return null;
  try {
    const u = await prisma.user.findUnique({
      where: { id: userId },
      select: { username: true },
    });
    return u?.username ?? null;
  } catch {
    // Never block auth flow because of profile enrichment.
    return null;
  }
}

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    }),
    CredentialsProvider({
      name: "Email/Password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials.password) return null;
        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
        });
        if (!user?.passwordHash) return null;
        const isValid = await bcrypt.compare(credentials.password, user.passwordHash);
        return isValid ? { id: user.id, email: user.email, name: user.name } : null;
      },
    }),
  ],
  callbacks: {
    async redirect({ url, baseUrl }) {
      if (url.startsWith("/")) return `${baseUrl}${url}`;
      try {
        const next = new URL(url);
        if (next.origin === baseUrl) return url;
      } catch {
        /* ignore */
      }
      return baseUrl;
    },
    async jwt({ token, user, trigger }) {
      if (user?.id) {
        token.sub = user.id;
        token.username = await safeGetUsername(user.id);
      }
      if (trigger === "update" && token.sub) {
        token.username = await safeGetUsername(token.sub);
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
        if (typeof token.username === "string" || token.username === null) {
          session.user.username = token.username;
        } else {
          session.user.username = await safeGetUsername(token.sub);
        }
      }
      return session;
    },
  },
  pages: {
    signIn: "/sign-in",
  },
};

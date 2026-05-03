import { PrismaAdapter } from "@next-auth/prisma-adapter";
import bcrypt from "bcryptjs";
import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import { prisma } from "@/lib/prisma";

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
      if (user) {
        token.sub = user.id;
        const u = await prisma.user.findUnique({
          where: { id: user.id },
          select: { username: true },
        });
        token.username = u?.username ?? null;
      }
      if (trigger === "update" && token.sub) {
        const u = await prisma.user.findUnique({
          where: { id: token.sub },
          select: { username: true },
        });
        token.username = u?.username ?? null;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
        if (typeof token.username === "string" || token.username === null) {
          session.user.username = token.username;
        } else {
          const u = await prisma.user.findUnique({
            where: { id: token.sub },
            select: { username: true },
          });
          session.user.username = u?.username ?? null;
        }
      }
      return session;
    },
  },
  pages: {
    signIn: "/sign-in",
  },
};

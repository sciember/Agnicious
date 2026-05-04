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

async function loadUserJwtFields(userId: string) {
  try {
    const u = await prisma.user.findUnique({
      where: { id: userId },
      select: { username: true, onboardingCompleted: true },
    });
    return {
      username: u?.username ?? null,
      onboardingCompleted: Boolean(u?.onboardingCompleted),
    };
  } catch {
    return { username: null as string | null, onboardingCompleted: true };
  }
}

async function upsertOAuthUserByEmail(input: {
  email: string;
  name?: string | null;
  image?: string | null;
}) {
  const email = input.email.trim().toLowerCase();
  if (!email) return null;
  try {
    const user = await prisma.user.upsert({
      where: { email },
      update: {
        ...(input.name ? { name: input.name } : {}),
        ...(input.image ? { image: input.image } : {}),
      },
      create: {
        email,
        name: input.name ?? null,
        image: input.image ?? null,
      },
      select: { id: true, username: true },
    });
    return user;
  } catch (error) {
    console.error("[next-auth][upsertOAuthUserByEmail]", error);
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
    async signIn({ user, account, profile }) {
      try {
        if (account?.provider !== "google") return true;
        const email = user.email ?? (typeof profile?.email === "string" ? profile.email : null);
        if (!email) {
          console.error("[next-auth][signIn] Google profile missing email", { profile });
          return "/sign-in?error=OAuthEmailMissing";
        }
        const persisted = await upsertOAuthUserByEmail({
          email,
          name: user.name ?? (typeof profile?.name === "string" ? profile.name : null),
          image: user.image ?? (typeof profile?.picture === "string" ? profile.picture : null),
        });
        if (!persisted) {
          return "/sign-in?error=OAuthPersistFailed";
        }
        if (!persisted.username) {
          return "/setup-profile";
        }
        return true;
      } catch (error) {
        console.error("[next-auth][signIn callback]", error);
        return "/sign-in?error=Callback";
      }
    },
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
      try {
        if (user?.id) {
          token.sub = user.id;
          const fields = await loadUserJwtFields(user.id);
          token.username = fields.username;
          token.onboardingCompleted = fields.onboardingCompleted;
        }

        if (!token.sub && typeof token.email === "string") {
          const persisted = await upsertOAuthUserByEmail({
            email: token.email,
            name: typeof token.name === "string" ? token.name : null,
            image: typeof token.picture === "string" ? token.picture : null,
          });
          if (persisted?.id) {
            token.sub = persisted.id;
            token.username = persisted.username ?? null;
            token.onboardingCompleted = Boolean(persisted.username);
          }
        }

        if (trigger === "update" && token.sub) {
          const fields = await loadUserJwtFields(token.sub);
          token.username = fields.username;
          token.onboardingCompleted = fields.onboardingCompleted;
        }
      } catch (error) {
        console.error("[next-auth][jwt callback]", error);
      }
      return token;
    },
    async session({ session, token }) {
      try {
        if (session.user && token.sub) {
          session.user.id = token.sub;
          if (typeof token.username === "string" || token.username === null) {
            session.user.username = token.username;
          } else {
            session.user.username = await safeGetUsername(token.sub);
          }
          session.user.onboardingCompleted = token.onboardingCompleted ?? true;
        } else if (session.user && session.user.email) {
          const persisted = await upsertOAuthUserByEmail({
            email: session.user.email,
            name: session.user.name ?? null,
            image: session.user.image ?? null,
          });
          if (persisted?.id) {
            session.user.id = persisted.id;
            session.user.username = persisted.username ?? null;
            session.user.onboardingCompleted = Boolean(persisted.username);
          }
        } else if (session.user) {
          session.user.username = null;
          session.user.onboardingCompleted = false;
        }
      } catch (error) {
        console.error("[next-auth][session callback]", error);
        if (session.user) {
          // Keep session usable even if enrichment fails.
          session.user.username = session.user.username ?? null;
          session.user.onboardingCompleted = session.user.onboardingCompleted ?? false;
          if (!session.user.id && typeof token.sub === "string") session.user.id = token.sub;
        }
      }
      if (session.user && !session.user.id && typeof token.sub === "string") {
        session.user.id = token.sub;
      }
      if (session.user) {
        if (typeof session.user.username === "undefined") session.user.username = null;
        if (typeof session.user.onboardingCompleted === "undefined") {
          session.user.onboardingCompleted = Boolean(session.user.username);
        }
      }
      return session;
    },
  },
  events: {
    async createUser({ user }) {
      try {
        if (!user?.email) return;
        await upsertOAuthUserByEmail({
          email: user.email,
          name: user.name ?? null,
          image: user.image ?? null,
        });
      } catch (error) {
        console.error("[next-auth][events.createUser]", error);
      }
    },
  },
  pages: {
    signIn: "/sign-in",
  },
};

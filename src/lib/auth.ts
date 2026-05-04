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

async function getUserIdByEmail(email: string) {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return null;
  try {
    const rows = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT "id"
      FROM "User"
      WHERE "email" = ${normalized}
      LIMIT 1
    `;
    return rows[0]?.id ?? null;
  } catch (error) {
    console.error("[next-auth][getUserIdByEmail]", error);
    return null;
  }
}

async function ensureUserByEmail(input: {
  email: string;
  name?: string | null;
  image?: string | null;
}) {
  const email = input.email.trim().toLowerCase();
  if (!email) return null;
  try {
    const id = crypto.randomUUID();
    const rows = await prisma.$queryRaw<Array<{ id: string; username: string | null }>>`
      INSERT INTO "User" ("id", "email", "name", "image", "createdAt", "updatedAt")
      VALUES (${id}, ${email}, ${input.name ?? null}, ${input.image ?? null}, NOW(), NOW())
      ON CONFLICT ("email")
      DO UPDATE SET
        "name" = COALESCE(EXCLUDED."name", "User"."name"),
        "image" = COALESCE(EXCLUDED."image", "User"."image"),
        "updatedAt" = NOW()
      RETURNING "id", "username"
    `;
    return rows[0] ?? null;
  } catch (error) {
    console.error("[next-auth][ensureUserByEmail]", error);
    return null;
  }
}

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
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
        const rows = await prisma.$queryRaw<
          Array<{ id: string; email: string; name: string | null; passwordHash: string | null }>
        >`
          SELECT "id", "email", "name", "passwordHash"
          FROM "User"
          WHERE "email" = ${credentials.email.trim().toLowerCase()}
          LIMIT 1
        `;
        const user = rows[0];
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
        const googleProfile = profile as { email?: string; name?: string; picture?: string } | undefined;
        const email = user.email ?? (typeof profile?.email === "string" ? profile.email : null);
        if (!email) {
          console.error("[next-auth][signIn] Google profile missing email", { profile });
          return false;
        }
        const persisted = await ensureUserByEmail({
          email,
          name: user.name ?? (typeof googleProfile?.name === "string" ? googleProfile.name : null),
          image: user.image ?? (typeof googleProfile?.picture === "string" ? googleProfile.picture : null),
        });
        if (!persisted) {
          // Do not block login if enrichment/upsert fails; adapter flow may still succeed.
          console.error("[next-auth][signIn] upsert returned null, continuing auth flow");
        }
        return true;
      } catch (error) {
        console.error("[next-auth][signIn callback]", error);
        // Never throw/cancel auth from callback instrumentation.
        return true;
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
    async jwt({ token, user, trigger, account }) {
      try {
        // Credentials sign-in already returns DB user id.
        if (user?.id && account?.provider === "credentials") {
          token.sub = user.id;
          const fields = await loadUserJwtFields(user.id);
          token.username = fields.username;
          token.onboardingCompleted = fields.onboardingCompleted;
        }

        // For OAuth, never trust provider id for app user id; always map by DB email.
        if (typeof token.email === "string") {
          const persisted = await ensureUserByEmail({
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

        // Self-heal stale token.sub values by remapping from email.
        if (token.sub && typeof token.email === "string") {
          const fields = await loadUserJwtFields(token.sub);
          if (fields.username === null) {
            const dbUserId = await getUserIdByEmail(token.email);
            if (dbUserId && dbUserId !== token.sub) {
              token.sub = dbUserId;
              const repaired = await loadUserJwtFields(dbUserId);
              token.username = repaired.username;
              token.onboardingCompleted = repaired.onboardingCompleted;
            } else {
              token.username = fields.username;
              token.onboardingCompleted = fields.onboardingCompleted;
            }
          } else {
            token.username = fields.username;
            token.onboardingCompleted = fields.onboardingCompleted;
          }
        }

        if (trigger === "update" && token.sub) {
          const fields = await loadUserJwtFields(token.sub);
          token.username = fields.username;
          token.onboardingCompleted = fields.onboardingCompleted;

          // If update trigger still sees stale id, repair once more via email.
          if (fields.username === null && typeof token.email === "string") {
            const dbUserId = await getUserIdByEmail(token.email);
            if (dbUserId && dbUserId !== token.sub) {
              token.sub = dbUserId;
              const repaired = await loadUserJwtFields(dbUserId);
              token.username = repaired.username;
              token.onboardingCompleted = repaired.onboardingCompleted;
            }
          }
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
          const persisted = await ensureUserByEmail({
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
  pages: {
    signIn: "/sign-in",
  },
};

import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type AuthUser = {
  id: string;
  email: string | null;
};

export async function resolveAuthUser(): Promise<AuthUser | null> {
  const session = await getServerSession(authOptions);
  const rawEmail = session?.user?.email?.trim().toLowerCase() ?? null;
  const sessionId = session?.user?.id ?? null;

  if (!sessionId && !rawEmail) return null;

  if (sessionId) {
    try {
      const byId = await prisma.user.findUnique({
        where: { id: sessionId },
        select: { id: true, email: true },
      });
      if (byId) {
        return { id: byId.id, email: byId.email };
      }
    } catch {
      // Fall through to email-based recovery.
    }
  }

  if (!rawEmail) return null;

  try {
    const id = crypto.randomUUID();
    const rows = await prisma.$queryRaw<Array<{ id: string; email: string }>>`
      INSERT INTO "User" ("id", "email", "createdAt", "updatedAt")
      VALUES (${id}, ${rawEmail}, NOW(), NOW())
      ON CONFLICT ("email")
      DO UPDATE SET "updatedAt" = NOW()
      RETURNING "id", "email"
    `;
    const row = rows[0];
    if (!row) return null;
    return { id: row.id, email: row.email };
  } catch {
    return null;
  }
}

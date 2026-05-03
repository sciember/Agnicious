import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { publicDisplayName } from "@/lib/user-public";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const feed = await prisma.activity.findMany({
    where: { userId: session.user.id },
    select: {
      id: true,
      message: true,
      createdAt: true,
      user: { select: { id: true, displayName: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return NextResponse.json(
    feed.map((item) => ({
      id: item.id,
      message: item.message.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "hidden"),
      createdAt: item.createdAt,
      user: {
        id: item.user.id,
        displayName: publicDisplayName(item.user.displayName, item.user.name),
      },
    })),
  );
}

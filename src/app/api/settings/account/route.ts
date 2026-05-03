import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function DELETE(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { confirm } = (await request.json().catch(() => ({}))) as { confirm?: string };
  if (confirm !== "DELETE") {
    return NextResponse.json({ error: 'Type "DELETE" to confirm account deletion.' }, { status: 400 });
  }

  await prisma.user.delete({ where: { id: session.user.id } });
  return NextResponse.json({ ok: true });
}

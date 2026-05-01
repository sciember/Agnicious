import { FriendStatus } from "@prisma/client";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const friends = await prisma.friend.findMany({
    where: {
      OR: [{ requesterId: session.user.id }, { addresseeId: session.user.id }],
    },
    include: {
      requester: { select: { id: true, name: true, email: true, image: true } },
      addressee: { select: { id: true, name: true, email: true, image: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(friends);
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { targetEmail, action, requestId } = (await request.json()) as {
    targetEmail?: string;
    action?: "request" | "accept";
    requestId?: string;
  };

  if (action === "request") {
    if (!targetEmail) return NextResponse.json({ error: "targetEmail required" }, { status: 400 });
    const target = await prisma.user.findUnique({ where: { email: targetEmail } });
    if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 });
    if (target.id === session.user.id) return NextResponse.json({ error: "Cannot add self" }, { status: 400 });

    const friendship = await prisma.friend.upsert({
      where: { requesterId_addresseeId: { requesterId: session.user.id, addresseeId: target.id } },
      create: { requesterId: session.user.id, addresseeId: target.id, status: FriendStatus.PENDING },
      update: { status: FriendStatus.PENDING },
    });
    return NextResponse.json(friendship);
  }

  if (action === "accept") {
    if (!requestId) return NextResponse.json({ error: "requestId required" }, { status: 400 });
    const friendship = await prisma.friend.findUnique({ where: { id: requestId } });
    if (!friendship || friendship.addresseeId !== session.user.id) {
      return NextResponse.json({ error: "Friend request not found" }, { status: 404 });
    }

    const accepted = await prisma.friend.update({
      where: { id: requestId },
      data: { status: FriendStatus.ACCEPTED },
    });
    return NextResponse.json(accepted);
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}

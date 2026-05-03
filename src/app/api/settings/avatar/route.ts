import { put } from "@vercel/blob";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const MAX_BYTES = 2 * 1024 * 1024;

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json({ error: "File uploads are not configured (missing BLOB_READ_WRITE_TOKEN)." }, { status: 503 });
  }

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file required" }, { status: 400 });
  }
  if (!file.type.startsWith("image/")) {
    return NextResponse.json({ error: "Only image files are allowed." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Image must be 2MB or smaller." }, { status: 400 });
  }

  const ext = file.type.split("/")[1] || "jpg";
  const pathname = `avatars/${session.user.id}-${Date.now()}.${ext}`;

  const blob = await put(pathname, file, {
    access: "public",
    token: process.env.BLOB_READ_WRITE_TOKEN,
  });

  const user = await prisma.user.update({
    where: { id: session.user.id },
    data: { avatarUrl: blob.url },
    select: { avatarUrl: true },
  });

  return NextResponse.json({ url: user.avatarUrl });
}

export async function DELETE() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await prisma.user.update({
    where: { id: session.user.id },
    data: { avatarUrl: null },
  });

  return NextResponse.json({ ok: true });
}

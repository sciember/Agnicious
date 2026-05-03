import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SHOP_ITEMS } from "@/lib/gamification/shop-items";

const purchaseSchema = z.object({
  itemId: z.string().min(1),
});

type ShopUnlocks = { frames?: string[]; themes?: string[] };

function mergeUnlocks(raw: unknown, kind: "frame" | "theme", id: string): ShopUnlocks {
  const base = (raw && typeof raw === "object" ? raw : {}) as ShopUnlocks;
  if (kind === "frame") {
    const frames = new Set([...(base.frames ?? []), id]);
    return { ...base, frames: [...frames] };
  }
  const themes = new Set([...(base.themes ?? []), id]);
  return { ...base, themes: [...themes] };
}

export async function GET() {
  return NextResponse.json({ items: SHOP_ITEMS });
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = purchaseSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const item = SHOP_ITEMS.find((i) => i.id === parsed.data.itemId);
  if (!item) return NextResponse.json({ error: "Unknown item" }, { status: 400 });

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { coins: true, shopUnlocks: true, streakFreezeCount: true },
  });
  if (!user || user.coins < item.price) {
    return NextResponse.json({ error: "Not enough coins" }, { status: 400 });
  }

  if (item.kind === "freeze") {
    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        coins: { decrement: item.price },
        streakFreezeCount: { increment: 1 },
      },
    });
  } else if (item.kind === "frame") {
    const next = mergeUnlocks(user.shopUnlocks, "frame", item.id);
    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        coins: { decrement: item.price },
        shopUnlocks: next as object,
      },
    });
  } else if (item.kind === "theme") {
    const next = mergeUnlocks(user.shopUnlocks, "theme", item.id);
    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        coins: { decrement: item.price },
        shopUnlocks: next as object,
      },
    });
  }

  const fresh = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { coins: true, streakFreezeCount: true, shopUnlocks: true },
  });

  return NextResponse.json({ ok: true, user: fresh });
}

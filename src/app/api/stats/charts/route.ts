import { format, subDays } from "date-fns";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const startDate = subDays(new Date(), 89);
  const logs = await prisma.habitLog.findMany({
    where: { userId: session.user.id, date: { gte: startDate } },
    select: { date: true, status: true },
    orderBy: { date: "asc" },
  });

  const map = new Map<string, { done: number; skip: number; fail: number }>();
  logs.forEach((log) => {
    const key = format(new Date(log.date), "yyyy-MM-dd");
    const val = map.get(key) ?? { done: 0, skip: 0, fail: 0 };
    if (log.status === "DONE") val.done += 1;
    if (log.status === "SKIP") val.skip += 1;
    if (log.status === "FAIL") val.fail += 1;
    map.set(key, val);
  });

  const series = Array.from({ length: 90 }, (_, i) => {
    const d = subDays(new Date(), 89 - i);
    const key = format(d, "yyyy-MM-dd");
    const val = map.get(key) ?? { done: 0, skip: 0, fail: 0 };
    return {
      date: format(d, "dd MMM"),
      key,
      done: val.done,
      skip: val.skip,
      fail: val.fail,
      completion: val.done - val.fail,
      heat: Math.max(0, val.done),
      low: Math.max(0, val.done - val.fail),
      high: val.done + val.skip,
      open: val.done,
      close: val.done - val.fail,
    };
  });

  return NextResponse.json({ series });
}

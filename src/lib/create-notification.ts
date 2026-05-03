import { prisma } from "@/lib/prisma";

export async function createNotification(input: {
  userId: string;
  fromId?: string | null;
  type: string;
  message: string;
  data?: Record<string, unknown>;
}) {
  return prisma.notification.create({
    data: {
      userId: input.userId,
      fromId: input.fromId ?? null,
      type: input.type,
      message: input.message,
      data: input.data ? JSON.stringify(input.data) : null,
    },
  });
}

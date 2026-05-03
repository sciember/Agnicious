import { HabitType, LifeArea, RepeatPattern } from "@prisma/client";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { serializeHabitUiMeta } from "@/lib/habit-ui-meta";
import { encodeStoredGoal, type OnboardingGoalKey } from "@/lib/onboarding";
import { prisma } from "@/lib/prisma";

const bodySchema = z.object({
  goal: z.enum(["HEALTH", "PRODUCTIVITY", "LEARNING", "MINDFULNESS", "CUSTOM"]),
  customGoalLabel: z.string().max(80).optional(),
  firstHabit: z.object({
    title: z.string().min(2).max(120),
    emoji: z.string().max(8).default("✨"),
    accent: z
      .string()
      .regex(/^#[0-9A-Fa-f]{6}$/)
      .default("#6366f1"),
    lifeArea: z.nativeEnum(LifeArea),
  }),
  reminderTime: z.string().regex(/^\d{2}:\d{2}$/),
});

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const json: unknown = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { goal, customGoalLabel, firstHabit, reminderTime } = parsed.data;
  const goalKey = goal as OnboardingGoalKey;
  const storedGoal = encodeStoredGoal(goalKey, customGoalLabel);
  const description =
    serializeHabitUiMeta({
      emoji: firstHabit.emoji,
      accent: firstHabit.accent,
    }) ?? null;

  await prisma.$transaction(async (tx) => {
    const habit = await tx.habit.create({
      data: {
        userId: session.user.id,
        title: firstHabit.title,
        description,
        type: HabitType.DAILY,
        repeatPattern: RepeatPattern.EVERYDAY,
        customWeekdays: [],
        reminderTime,
        lifeArea: firstHabit.lifeArea,
      },
    });
    await tx.streak.create({
      data: { userId: session.user.id, habitId: habit.id },
    });
    await tx.user.update({
      where: { id: session.user.id },
      data: {
        onboardingGoal: storedGoal,
        onboardingCompleted: true,
        defaultReminderTime: reminderTime,
      },
    });
  });

  return NextResponse.json({ ok: true });
}

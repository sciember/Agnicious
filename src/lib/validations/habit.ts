import { HabitType, LifeArea, RepeatPattern } from "@prisma/client";
import { z } from "zod";

export const habitSchema = z.object({
  title: z.string().min(2).max(120),
  description: z.string().max(500).optional(),
  type: z.nativeEnum(HabitType),
  repeatPattern: z.nativeEnum(RepeatPattern),
  customWeekdays: z.array(z.number().int().min(0).max(6)).default([]),
  reminderTime: z.string().optional(),
  lifeArea: z.nativeEnum(LifeArea),
  stackAfterHabitId: z.string().optional(),
});

export const habitLogSchema = z.object({
  habitId: z.string().min(1),
  date: z.string().datetime(),
  status: z.enum(["DONE", "SKIP", "FAIL"]),
  note: z.string().max(280).optional(),
});

import { z } from "zod";

export const moodLogSchema = z.object({
  moodScore: z.number().int().min(1).max(5),
  note: z.string().max(500).optional(),
});

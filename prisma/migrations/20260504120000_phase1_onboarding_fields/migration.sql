-- AlterTable
ALTER TABLE "User" ADD COLUMN "onboardingGoal" TEXT;
ALTER TABLE "User" ADD COLUMN "onboardingCompleted" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN "defaultReminderTime" TEXT;

-- Existing rows only: treat as already onboarded (new sign-ups keep default false)
UPDATE "User" SET "onboardingCompleted" = true;

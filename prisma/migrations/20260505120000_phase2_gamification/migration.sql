-- AlterTable
ALTER TABLE "User" ADD COLUMN "coins" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN "aiCoachTurns" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN "shopUnlocks" JSONB;

-- CreateTable
CREATE TABLE "UserDailyChallengeProgress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "challengeKey" TEXT NOT NULL,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserDailyChallengeProgress_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserDailyChallengeProgress_userId_date_challengeKey_key" ON "UserDailyChallengeProgress"("userId", "date", "challengeKey");

-- CreateIndex
CREATE INDEX "UserDailyChallengeProgress_userId_date_idx" ON "UserDailyChallengeProgress"("userId", "date");

-- AddForeignKey
ALTER TABLE "UserDailyChallengeProgress" ADD CONSTRAINT "UserDailyChallengeProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

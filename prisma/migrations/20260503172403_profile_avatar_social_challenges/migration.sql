-- CreateEnum
CREATE TYPE "WeekStart" AS ENUM ('MONDAY', 'SUNDAY');

-- CreateEnum
CREATE TYPE "ChallengeParticipantStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "avatarUrl" TEXT,
ADD COLUMN     "bio" TEXT,
ADD COLUMN     "weekStartsOn" "WeekStart" NOT NULL DEFAULT 'MONDAY';

-- CreateTable
CREATE TABLE "SocialChallenge" (
    "id" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "durationDays" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SocialChallenge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SocialChallengeParticipant" (
    "id" TEXT NOT NULL,
    "challengeId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "ChallengeParticipantStatus" NOT NULL DEFAULT 'PENDING',
    "progressDays" INTEGER NOT NULL DEFAULT 0,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "SocialChallengeParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SocialChallenge_creatorId_idx" ON "SocialChallenge"("creatorId");

-- CreateIndex
CREATE INDEX "SocialChallengeParticipant_userId_idx" ON "SocialChallengeParticipant"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "SocialChallengeParticipant_challengeId_userId_key" ON "SocialChallengeParticipant"("challengeId", "userId");

-- AddForeignKey
ALTER TABLE "SocialChallenge" ADD CONSTRAINT "SocialChallenge_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SocialChallengeParticipant" ADD CONSTRAINT "SocialChallengeParticipant_challengeId_fkey" FOREIGN KEY ("challengeId") REFERENCES "SocialChallenge"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SocialChallengeParticipant" ADD CONSTRAINT "SocialChallengeParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

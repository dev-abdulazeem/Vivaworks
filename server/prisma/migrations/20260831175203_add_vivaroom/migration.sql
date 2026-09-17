-- CreateEnum
CREATE TYPE "VivaRoomStatus" AS ENUM ('live', 'ended');

-- CreateEnum
CREATE TYPE "VivaRoomVisibility" AS ENUM ('public', 'followers_only', 'private');

-- CreateEnum
CREATE TYPE "VivaRoomRole" AS ENUM ('host', 'co_host', 'speaker', 'listener');

-- CreateTable
CREATE TABLE "VivaRoom" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "VivaRoomStatus" NOT NULL DEFAULT 'live',
    "visibility" "VivaRoomVisibility" NOT NULL DEFAULT 'public',
    "hostId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VivaRoom_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VivaRoomParticipant" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "VivaRoomRole" NOT NULL DEFAULT 'listener',
    "isMuted" BOOLEAN NOT NULL DEFAULT false,
    "isSpeaking" BOOLEAN NOT NULL DEFAULT false,
    "handRaised" BOOLEAN NOT NULL DEFAULT false,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leftAt" TIMESTAMP(3),

    CONSTRAINT "VivaRoomParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VivaRoomMessage" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VivaRoomMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VivaRoom_status_idx" ON "VivaRoom"("status");

-- CreateIndex
CREATE INDEX "VivaRoom_hostId_idx" ON "VivaRoom"("hostId");

-- CreateIndex
CREATE INDEX "VivaRoom_visibility_idx" ON "VivaRoom"("visibility");

-- CreateIndex
CREATE INDEX "VivaRoom_startedAt_idx" ON "VivaRoom"("startedAt");

-- CreateIndex
CREATE INDEX "VivaRoomParticipant_roomId_idx" ON "VivaRoomParticipant"("roomId");

-- CreateIndex
CREATE INDEX "VivaRoomParticipant_userId_idx" ON "VivaRoomParticipant"("userId");

-- CreateIndex
CREATE INDEX "VivaRoomParticipant_role_idx" ON "VivaRoomParticipant"("role");

-- CreateIndex
CREATE UNIQUE INDEX "VivaRoomParticipant_roomId_userId_key" ON "VivaRoomParticipant"("roomId", "userId");

-- CreateIndex
CREATE INDEX "VivaRoomMessage_roomId_idx" ON "VivaRoomMessage"("roomId");

-- CreateIndex
CREATE INDEX "VivaRoomMessage_createdAt_idx" ON "VivaRoomMessage"("createdAt");

-- AddForeignKey
ALTER TABLE "VivaRoom" ADD CONSTRAINT "VivaRoom_hostId_fkey" FOREIGN KEY ("hostId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VivaRoomParticipant" ADD CONSTRAINT "VivaRoomParticipant_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "VivaRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VivaRoomParticipant" ADD CONSTRAINT "VivaRoomParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VivaRoomMessage" ADD CONSTRAINT "VivaRoomMessage_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "VivaRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VivaRoomMessage" ADD CONSTRAINT "VivaRoomMessage_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

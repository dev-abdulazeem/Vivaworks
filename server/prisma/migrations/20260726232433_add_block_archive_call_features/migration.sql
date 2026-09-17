-- CreateTable
CREATE TABLE "BlockedContact" (
    "id" TEXT NOT NULL,
    "blockerId" TEXT NOT NULL,
    "blockedId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BlockedContact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ArchivedConversation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "otherUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ArchivedConversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VideoCall" (
    "id" TEXT NOT NULL,
    "callerId" TEXT NOT NULL,
    "receiverId" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "callType" TEXT NOT NULL DEFAULT 'video',
    "status" TEXT NOT NULL DEFAULT 'ringing',
    "duration" INTEGER,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "VideoCall_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BlockedContact_blockerId_idx" ON "BlockedContact"("blockerId");

-- CreateIndex
CREATE INDEX "BlockedContact_blockedId_idx" ON "BlockedContact"("blockedId");

-- CreateIndex
CREATE UNIQUE INDEX "BlockedContact_blockerId_blockedId_key" ON "BlockedContact"("blockerId", "blockedId");

-- CreateIndex
CREATE INDEX "ArchivedConversation_userId_idx" ON "ArchivedConversation"("userId");

-- CreateIndex
CREATE INDEX "ArchivedConversation_otherUserId_idx" ON "ArchivedConversation"("otherUserId");

-- CreateIndex
CREATE UNIQUE INDEX "ArchivedConversation_userId_otherUserId_key" ON "ArchivedConversation"("userId", "otherUserId");

-- CreateIndex
CREATE UNIQUE INDEX "VideoCall_roomId_key" ON "VideoCall"("roomId");

-- CreateIndex
CREATE INDEX "VideoCall_callerId_idx" ON "VideoCall"("callerId");

-- CreateIndex
CREATE INDEX "VideoCall_receiverId_idx" ON "VideoCall"("receiverId");

-- CreateIndex
CREATE INDEX "VideoCall_status_idx" ON "VideoCall"("status");

-- AddForeignKey
ALTER TABLE "BlockedContact" ADD CONSTRAINT "BlockedContact_blockerId_fkey" FOREIGN KEY ("blockerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BlockedContact" ADD CONSTRAINT "BlockedContact_blockedId_fkey" FOREIGN KEY ("blockedId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArchivedConversation" ADD CONSTRAINT "ArchivedConversation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArchivedConversation" ADD CONSTRAINT "ArchivedConversation_otherUserId_fkey" FOREIGN KEY ("otherUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VideoCall" ADD CONSTRAINT "VideoCall_callerId_fkey" FOREIGN KEY ("callerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VideoCall" ADD CONSTRAINT "VideoCall_receiverId_fkey" FOREIGN KEY ("receiverId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "shares" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "sharedById" TEXT NOT NULL,
    "recipientId" TEXT,
    "shareLink" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shares_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "shares_shareLink_key" ON "shares"("shareLink");

-- CreateIndex
CREATE INDEX "shares_postId_idx" ON "shares"("postId");

-- CreateIndex
CREATE INDEX "shares_sharedById_idx" ON "shares"("sharedById");

-- CreateIndex
CREATE INDEX "shares_recipientId_idx" ON "shares"("recipientId");

-- CreateIndex
CREATE INDEX "shares_shareLink_idx" ON "shares"("shareLink");

-- AddForeignKey
ALTER TABLE "shares" ADD CONSTRAINT "shares_postId_fkey" FOREIGN KEY ("postId") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shares" ADD CONSTRAINT "shares_sharedById_fkey" FOREIGN KEY ("sharedById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shares" ADD CONSTRAINT "shares_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

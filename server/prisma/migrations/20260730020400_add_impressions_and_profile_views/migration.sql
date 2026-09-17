-- CreateTable
CREATE TABLE "post_impressions" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "viewerId" TEXT NOT NULL,
    "viewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "post_impressions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "profile_views" (
    "id" TEXT NOT NULL,
    "viewedId" TEXT NOT NULL,
    "viewerId" TEXT NOT NULL,
    "viewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "profile_views_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "post_impressions_postId_idx" ON "post_impressions"("postId");

-- CreateIndex
CREATE INDEX "post_impressions_viewerId_idx" ON "post_impressions"("viewerId");

-- CreateIndex
CREATE INDEX "post_impressions_viewedAt_idx" ON "post_impressions"("viewedAt");

-- CreateIndex
CREATE UNIQUE INDEX "post_impressions_postId_viewerId_key" ON "post_impressions"("postId", "viewerId");

-- CreateIndex
CREATE INDEX "profile_views_viewedId_idx" ON "profile_views"("viewedId");

-- CreateIndex
CREATE INDEX "profile_views_viewerId_idx" ON "profile_views"("viewerId");

-- CreateIndex
CREATE INDEX "profile_views_viewedAt_idx" ON "profile_views"("viewedAt");

-- CreateIndex
CREATE UNIQUE INDEX "profile_views_viewedId_viewerId_key" ON "profile_views"("viewedId", "viewerId");

-- AddForeignKey
ALTER TABLE "post_impressions" ADD CONSTRAINT "post_impressions_postId_fkey" FOREIGN KEY ("postId") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_impressions" ADD CONSTRAINT "post_impressions_viewerId_fkey" FOREIGN KEY ("viewerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profile_views" ADD CONSTRAINT "profile_views_viewedId_fkey" FOREIGN KEY ("viewedId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profile_views" ADD CONSTRAINT "profile_views_viewerId_fkey" FOREIGN KEY ("viewerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

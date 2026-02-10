-- CreateTable
CREATE TABLE "users" (
    "id" BIGINT NOT NULL,
    "username" TEXT,
    "firstName" TEXT,
    "lastName" TEXT,
    "isAdmin" BOOLEAN NOT NULL DEFAULT false,
    "isBanned" BOOLEAN NOT NULL DEFAULT false,
    "totalDownloads" INTEGER NOT NULL DEFAULT 0,
    "lastActiveAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "required_channels" (
    "id" SERIAL NOT NULL,
    "channelId" TEXT NOT NULL,
    "channelName" TEXT NOT NULL,
    "channelLink" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "required_channels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cached_files" (
    "id" SERIAL NOT NULL,
    "cacheKey" TEXT NOT NULL,
    "originalUrl" TEXT NOT NULL,
    "formatId" TEXT NOT NULL,
    "resolution" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,
    "archiveMessageId" INTEGER NOT NULL,
    "title" TEXT,
    "uploader" TEXT,
    "duration" INTEGER,
    "fileSize" BIGINT,
    "fileType" TEXT NOT NULL,
    "downloadCount" INTEGER NOT NULL DEFAULT 1,
    "lastAccessedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cached_files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "downloads" (
    "id" SERIAL NOT NULL,
    "userId" BIGINT NOT NULL,
    "cachedFileId" INTEGER NOT NULL,
    "wasFromCache" BOOLEAN NOT NULL DEFAULT false,
    "downloadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "downloads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "advertisements" (
    "id" SERIAL NOT NULL,
    "content" TEXT NOT NULL,
    "mediaFileId" TEXT,
    "buttonText" TEXT,
    "buttonUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "showInterval" INTEGER NOT NULL DEFAULT 5,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "clickCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "advertisements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "advertisement_views" (
    "id" SERIAL NOT NULL,
    "userId" BIGINT NOT NULL,
    "adId" INTEGER NOT NULL,
    "clicked" BOOLEAN NOT NULL DEFAULT false,
    "viewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "advertisement_views_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_stats" (
    "id" SERIAL NOT NULL,
    "date" DATE NOT NULL,
    "newUsers" INTEGER NOT NULL DEFAULT 0,
    "totalDownloads" INTEGER NOT NULL DEFAULT 0,
    "cacheHits" INTEGER NOT NULL DEFAULT 0,
    "cacheMisses" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "daily_stats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "video_sessions" (
    "id" TEXT NOT NULL,
    "originalUrl" TEXT NOT NULL,
    "videoId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "uploader" TEXT,
    "duration" INTEGER,
    "viewCount" BIGINT,
    "likeCount" BIGINT,
    "uploadDate" TEXT,
    "thumbnail" TEXT,
    "formats" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "video_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "users_username_idx" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "required_channels_channelId_key" ON "required_channels"("channelId");

-- CreateIndex
CREATE UNIQUE INDEX "cached_files_cacheKey_key" ON "cached_files"("cacheKey");

-- CreateIndex
CREATE INDEX "cached_files_cacheKey_idx" ON "cached_files"("cacheKey");

-- CreateIndex
CREATE INDEX "cached_files_originalUrl_idx" ON "cached_files"("originalUrl");

-- CreateIndex
CREATE INDEX "cached_files_lastAccessedAt_idx" ON "cached_files"("lastAccessedAt");

-- CreateIndex
CREATE INDEX "downloads_userId_idx" ON "downloads"("userId");

-- CreateIndex
CREATE INDEX "downloads_cachedFileId_idx" ON "downloads"("cachedFileId");

-- CreateIndex
CREATE INDEX "advertisement_views_userId_idx" ON "advertisement_views"("userId");

-- CreateIndex
CREATE INDEX "advertisement_views_adId_idx" ON "advertisement_views"("adId");

-- CreateIndex
CREATE UNIQUE INDEX "daily_stats_date_key" ON "daily_stats"("date");

-- CreateIndex
CREATE INDEX "daily_stats_date_idx" ON "daily_stats"("date");

-- CreateIndex
CREATE INDEX "video_sessions_expiresAt_idx" ON "video_sessions"("expiresAt");

-- AddForeignKey
ALTER TABLE "downloads" ADD CONSTRAINT "downloads_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "downloads" ADD CONSTRAINT "downloads_cachedFileId_fkey" FOREIGN KEY ("cachedFileId") REFERENCES "cached_files"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "advertisement_views" ADD CONSTRAINT "advertisement_views_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "advertisement_views" ADD CONSTRAINT "advertisement_views_adId_fkey" FOREIGN KEY ("adId") REFERENCES "advertisements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
